import test from 'node:test';
import assert from 'node:assert/strict';

process.env.VITE_SUPABASE_URL = 'https://database.invalid';
process.env.VITE_SUPABASE_ANON_KEY = 'fixture-public-key';
const SESSION_KEY = 'buddha_lms_auth_session';
const validSession = (suffix = 'one') => ({
  access_token: `fixture-access-${suffix}`, refresh_token: `fixture-refresh-${suffix}`,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
});
const expiredSession = () => ({ ...validSession(), expires_at: Math.floor(Date.now() / 1000) - 60 });

test('Supabase token session lifecycle (mock fetch only)', async t => {
  const originalFetch = globalThis.fetch;
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const stored = new Map();
  const expiredEvents = [];
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
    getItem: key => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, value),
    removeItem: key => stored.delete(key),
  } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    dispatchEvent: event => expiredEvents.push(event.type),
  } });
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalStorage) Object.defineProperty(globalThis, 'sessionStorage', originalStorage);
    else delete globalThis.sessionStorage;
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else delete globalThis.window;
  });
  let moduleId = 0;
  const fresh = async () => {
    stored.clear(); expiredEvents.length = 0;
    globalThis.fetch = () => assert.fail('Unexpected request: tests must only use explicit fetch mocks');
    return import(`../src/services/authSession.js?fixture=${++moduleId}`);
  };

  await t.test('stores tokens only and reuses an unexpired access token without network', async () => {
    const auth = await fresh();
    const session = validSession();
    auth.setAuthSession({ ...session, user: { id: 'fixture', role: 'admin' }, password: 'not-a-real-password' });
    assert.deepEqual(auth.getAuthSession(), session);
    assert.deepEqual(JSON.parse(stored.get(SESSION_KEY)), session);
    assert.equal(await auth.getAccessToken(), session.access_token);
  });

  await t.test('malformed or incomplete persisted sessions are ignored', async () => {
    const auth = await fresh();
    stored.set(SESSION_KEY, '{broken json');
    assert.equal(auth.getAuthSession(), null);
    stored.set(SESSION_KEY, JSON.stringify({ access_token: 'incomplete' }));
    assert.equal(auth.getAuthSession(), null);
    assert.throws(() => auth.setAuthSession({ access_token: 'incomplete' }));
  });

  await t.test('overlapping refresh requests share one server refresh', async () => {
    const auth = await fresh();
    auth.setAuthSession(expiredSession());
    let requests = 0;
    let release;
    const refreshed = validSession('refreshed');
    globalThis.fetch = async (url, options) => {
      requests++;
      assert.equal(url, 'https://database.invalid/auth/v1/token?grant_type=refresh_token');
      assert.deepEqual(JSON.parse(options.body), { refresh_token: 'fixture-refresh-one' });
      assert.equal(options.headers.Authorization, 'Bearer fixture-public-key');
      await new Promise(resolve => { release = resolve; });
      return Response.json(refreshed);
    };
    const requestsPending = [auth.getAccessToken(), auth.getAccessToken()];
    assert.equal(requests, 1);
    release();
    assert.deepEqual(await Promise.all(requestsPending), [refreshed.access_token, refreshed.access_token]);
    assert.equal(auth.getAuthSession().access_token, refreshed.access_token);
  });

  await t.test('a refresh response arriving after logout cannot revive the session', async () => {
    const auth = await fresh();
    auth.setAuthSession(expiredSession());
    let release;
    globalThis.fetch = async () => {
      await new Promise(resolve => { release = resolve; });
      return Response.json(validSession('stale'));
    };
    const pending = auth.getAccessToken();
    const rejected = assert.rejects(pending);
    auth.clearAuthSession();
    release();
    await rejected;
    assert.equal(auth.getAuthSession(), null);
    assert.equal(stored.has(SESSION_KEY), false);
  });

  await t.test('an old refresh cannot overwrite a newly signed-in account', async () => {
    const auth = await fresh();
    auth.setAuthSession(expiredSession());
    let release;
    globalThis.fetch = async () => {
      await new Promise(resolve => { release = resolve; });
      return Response.json(validSession('stale'));
    };
    const pending = auth.getAccessToken();
    const rejected = assert.rejects(pending);
    const replacement = validSession('new-account');
    auth.setAuthSession(replacement);
    assert.equal(await auth.getAccessToken(), replacement.access_token);
    release();
    await rejected;
    assert.deepEqual(auth.getAuthSession(), replacement);
  });

  await t.test('invalid refresh credentials clear the session and notify the UI', async () => {
    const auth = await fresh();
    auth.setAuthSession(expiredSession());
    globalThis.fetch = async () => Response.json({ message: 'invalid refresh' }, { status: 401 });
    await assert.rejects(auth.getAccessToken(), error => error.status === 401);
    assert.equal(auth.getAuthSession(), null);
    assert.deepEqual(expiredEvents, ['buddha_auth_expired']);
  });

  await t.test('an old failed refresh cannot clear the replacement account', async () => {
    const auth = await fresh();
    auth.setAuthSession(expiredSession());
    let release;
    globalThis.fetch = async () => {
      await new Promise(resolve => { release = resolve; });
      return Response.json({ message: 'invalid old refresh' }, { status: 401 });
    };
    const pending = auth.getAccessToken();
    const rejected = assert.rejects(pending, error => error.status === 401);
    const replacement = validSession('replacement');
    auth.setAuthSession(replacement);
    release();
    await rejected;
    assert.deepEqual(auth.getAuthSession(), replacement);
    assert.deepEqual(expiredEvents, []);
  });

  await t.test('transient refresh failure keeps the session available for retry', async () => {
    const auth = await fresh();
    const expired = expiredSession();
    auth.setAuthSession(expired);
    globalThis.fetch = async () => Response.json({ message: 'unavailable' }, { status: 503 });
    await assert.rejects(auth.getAccessToken(), error => error.status === 503);
    assert.deepEqual(auth.getAuthSession(), expired);
    assert.deepEqual(expiredEvents, []);
    const replacement = validSession('retry');
    globalThis.fetch = async () => Response.json(replacement);
    assert.equal(await auth.getAccessToken(), replacement.access_token);
  });

  await t.test('logout clears local tokens before the server responds, including failure', async () => {
    const auth = await fresh();
    const session = validSession();
    auth.setAuthSession(session);
    globalThis.fetch = async (url, options) => {
      assert.equal(auth.getAuthSession(), null);
      assert.equal(stored.has(SESSION_KEY), false);
      assert.equal(url, 'https://database.invalid/auth/v1/logout');
      assert.equal(options.headers.Authorization, `Bearer ${session.access_token}`);
      assert.equal(options.body, undefined);
      throw new Error('offline');
    };
    await assert.rejects(auth.signOutSession(), /offline/);
    assert.equal(auth.getAuthSession(), null);
  });

  await t.test('admin auth actions use the live user JWT, public registration uses the public key', async () => {
    const auth = await fresh();
    auth.setAuthSession(validSession());
    const headers = [];
    globalThis.fetch = async (url, options) => {
      assert.equal(url, 'https://database.invalid/functions/v1/lms-auth');
      headers.push(options.headers.Authorization);
      return Response.json({ success: true });
    };
    await auth.callAuthAction('admin-delete', { userId: 'fixture-user' }, true);
    await auth.callAuthAction('register', { id: 'fixture-user' });
    assert.deepEqual(headers, ['Bearer fixture-access-one', 'Bearer fixture-public-key']);
  });
});
