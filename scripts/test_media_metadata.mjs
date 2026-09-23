import test from 'node:test';
import assert from 'node:assert/strict';

// Capture a dispatcher before mediaStorage imports fetch. No request can leave this process.
process.env.VITE_SUPABASE_URL = 'https://database.invalid';
process.env.VITE_SUPABASE_ANON_KEY = 'fixture-only';
const nativeFetch = globalThis.fetch;
let request = () => assert.fail('Unexpected network request');
globalThis.fetch = (...args) => request(...args);
const { extractVideoMetadata, remoteDb } = await import('../src/services/apiClient.js');
const auth = await import('../src/services/authSession.js');

function mockVideo(t, options = {}) {
  const saved = { document: globalThis.document, create: URL.createObjectURL,
    revoke: URL.revokeObjectURL, set: globalThis.setTimeout, clear: globalThis.clearTimeout };
  const calls = { created: 0, revoked: [], cleared: [], loaded: 0, removed: [] };
  const video = { duration: 1.6, videoWidth: 64, videoHeight: 64,
    removeAttribute(name) { calls.removed.push(name); },
    load() { calls.loaded++; if (options.cleanupThrows) throw new Error('cleanup'); } };
  globalThis.document = { createElement(name) {
    assert.equal(name, 'video'); if (options.creationThrows) throw new Error('creation'); return video;
  } };
  URL.createObjectURL = () => { calls.created++; return 'blob:fixture'; };
  URL.revokeObjectURL = url => calls.revoked.push(url);
  globalThis.setTimeout = (fn, milliseconds) => { calls.timeout = fn; calls.delay = milliseconds; return 42; };
  globalThis.clearTimeout = id => calls.cleared.push(id);
  t.after(() => {
    if (saved.document === undefined) delete globalThis.document; else globalThis.document = saved.document;
    URL.createObjectURL = saved.create; URL.revokeObjectURL = saved.revoke;
    globalThis.setTimeout = saved.set; globalThis.clearTimeout = saved.clear;
  });
  return { video, calls };
}

test('media metadata and canonical thumbnail contracts', async t => {
  t.after(() => { globalThis.fetch = nativeFetch; auth.clearAuthSession(); });
  await t.test('valid metadata settles once and releases handlers, source, timer and blob', async t => {
    const { video, calls } = mockVideo(t);
    const pending = extractVideoMetadata({});
    const loaded = video.onloadedmetadata;
    loaded(); loaded();
    assert.deepEqual(await pending, { duration: 2, width: 64, height: 64 });
    assert.equal(video.onloadedmetadata, null); assert.equal(video.onerror, null);
    assert.deepEqual(calls.revoked, ['blob:fixture']);
    assert.deepEqual(calls.removed, ['src']); assert.equal(calls.loaded, 1);
    assert.deepEqual(calls.cleared, [42]);
  });
  for (const duration of [0, -1, NaN, Infinity]) {
    await t.test(`invalid duration ${duration} is rejected without a fallback duration`, async t => {
      const { video, calls } = mockVideo(t); video.duration = duration;
      const pending = extractVideoMetadata({}); video.onloadedmetadata();
      await assert.rejects(pending); assert.equal(calls.revoked.length, 1);
    });
  }
  await t.test('media decode errors reject and clean up', async t => {
    const { video, calls } = mockVideo(t);
    const pending = extractVideoMetadata({}); video.onerror();
    await assert.rejects(pending); assert.equal(calls.revoked.length, 1);
  });
  await t.test('metadata timeout rejects after the configured 15 seconds', async t => {
    const { calls } = mockVideo(t);
    const pending = extractVideoMetadata({}); assert.equal(calls.delay, 15000); calls.timeout();
    await assert.rejects(pending); assert.equal(calls.revoked.length, 1);
  });
  await t.test('selection cancellation rejects immediately and releases resources', async t => {
    const { video, calls } = mockVideo(t); const controller = new AbortController();
    const pending = extractVideoMetadata({}, { signal: controller.signal }); controller.abort();
    await assert.rejects(pending); assert.equal(video.onloadedmetadata, null);
    assert.equal(calls.revoked.length, 1);
  });
  await t.test('already cancelled selection allocates no media resources', async t => {
    const { calls } = mockVideo(t); const controller = new AbortController(); controller.abort();
    await assert.rejects(extractVideoMetadata({}, { signal: controller.signal }));
    assert.equal(calls.created, 0);
  });
  await t.test('cleanup exception does not leave the metadata promise pending', async t => {
    const { video, calls } = mockVideo(t, { cleanupThrows: true });
    const pending = extractVideoMetadata({}); video.onloadedmetadata();
    assert.equal((await pending).duration, 2); assert.equal(calls.revoked.length, 1);
  });
  await t.test('DOM creation failure still revokes its allocated object URL', async t => {
    const { calls } = mockVideo(t, { creationThrows: true });
    await assert.rejects(extractVideoMetadata({}), /creation/);
    assert.equal(calls.revoked.length, 1);
  });
  await t.test('legacy private thumbnail is signed for display and canonicalized on save', async () => {
    auth.setAuthSession({ access_token: 'fixture-jwt', refresh_token: 'fixture-refresh', expires_at: Date.now() / 1000 + 3600 });
    const original = 'https://database.invalid/storage/v1/object/lectures/thumbs/example.jpg';
    let persisted;
    request = async (url, options = {}) => {
      if (url.includes('/rest/v1/courses?')) return new Response(JSON.stringify([{ id: 'course', thumbnail: original }]));
      if (url.includes('/storage/v1/object/sign/lectures/thumbs/example.jpg')) {
        assert.equal(options.headers.Authorization, 'Bearer fixture-jwt');
        return new Response(JSON.stringify({ signedURL: '/object/sign/lectures/thumbs/example.jpg?token=fixture-signature' }));
      }
      if (url.endsWith('/rpc/save_course_record')) {
        persisted = JSON.parse(options.body);
        return new Response(JSON.stringify({ id: 'course' }));
      }
      assert.fail(`Unexpected mocked route: ${url}`);
    };
    const [course] = await remoteDb.getCourses();
    assert.match(course.thumbnail, /\/object\/sign\/.*\?token=fixture-signature$/);
    await remoteDb.updateCourse(course.id, { thumbnail: course.thumbnail });
    assert.equal(persisted.p_course.thumbnail, original);
    assert.ok(!JSON.stringify(persisted).includes('fixture-signature'));
  });
});
