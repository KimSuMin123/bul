import test from 'node:test';
import assert from 'node:assert/strict';

// Import only after setting dummy configuration. Every request is intercepted;
// this suite must never connect to a database.
process.env.VITE_SUPABASE_URL = 'https://database.invalid';
process.env.VITE_SUPABASE_ANON_KEY = 'test-only';
const { remoteDb } = await import('../src/services/apiClient.js');
const auth = await import('../src/services/authSession.js');

const reads = ['getUsers', 'getCourses', 'getLectures', 'getEnrollments', 'getPayments',
  'getProgress', 'getCertificates', 'getQAPosts', 'getExamAttempts'];
const writes = ['upsertEnrollment', 'upsertProgress', 'insertPayment',
  'processCoursePayment', 'insertCertificate', 'insertUser', 'insertCourse', 'updateCourse',
  'deleteCourse', 'insertLecture', 'updateLecture', 'deleteLecture', 'insertQAPost',
  'insertQAAnswer', 'deleteQAPost', 'saveCourseExam', 'startCourseExam', 'submitCourseExam',
  'updateUserPassword', 'deleteUser'];
const userFixture = {
  id: 'test-member', password: 'Test-only123!', name: 'Test Member',
  birthDate: '2000-01-01', phone: '01000000000', memberNo: 'TEST-001', role: 'student'
};
const methodArgs = {
  insertUser: [userFixture], updateCourse: ['course', {}], updateLecture: ['lecture', {}],
  insertQAAnswer: ['post', {}], saveCourseExam: ['course', []], startCourseExam: ['course'],
  submitCourseExam: ['attempt', { question: 2 }], updateUserPassword: ['member', 'Fixture-only123!'],
};
const argsFor = method => methodArgs[method] || [{}];
const sessionFixture = {
  access_token: 'fixture-user-jwt', refresh_token: 'fixture-refresh',
  expires_at: Math.floor(Date.now() / 1000) + 3600,
};

test('remote database failure contracts', async t => {
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  console.warn = () => {};
  auth.clearAuthSession();
  t.after(() => { globalThis.fetch = originalFetch; console.warn = originalWarn; auth.clearAuthSession(); });

  for (const method of [...reads, ...writes]) {
    await t.test(`${method} rejects HTTP failures`, async () => {
      globalThis.fetch = async () => Response.json({ message: 'unavailable' }, { status: 503 });
      await assert.rejects(() => remoteDb[method](...argsFor(method)));
    });
  }
  for (const method of reads) {
    await t.test(`${method} preserves a successful empty collection`, async () => {
      globalThis.fetch = async () => Response.json([]);
      assert.deepEqual(await remoteDb[method](), []);
    });
  }
  await t.test('member directory exposes login alias without changing canonical references or selecting secrets', async () => {
    auth.setAuthSession(sessionFixture);
    globalThis.fetch = async (url, options) => {
      const endpoint = new URL(url);
      assert.equal(endpoint.pathname, '/rest/v1/users');
      assert.equal(options.headers.Authorization, 'Bearer fixture-user-jwt');
      const columns = endpoint.searchParams.get('select').split(',');
      assert.ok(columns.includes('login_id'));
      assert.ok(!columns.includes('password'));
      assert.ok(!columns.includes('auth_user_id'));
      return Response.json([
        { id: 'original-admin', login_id: 'adsba', role: 'admin', name: 'Admin fixture' },
        { id: 'student-fixture', login_id: null, role: 'student' },
      ]);
    };
    const users = await remoteDb.getUsers();
    assert.equal(users[0].id, 'original-admin');
    assert.equal(users[0].loginId, 'adsba');
    assert.equal(users[0].role, 'admin');
    assert.equal(users[1].id, 'student-fixture');
    assert.equal(users[1].loginId, 'student-fixture');
  });
  for (const method of writes) {
    await t.test(`${method} rejects an unconfirmed empty write`, async () => {
      globalThis.fetch = async () => Response.json([]);
      await assert.rejects(() => remoteDb[method](...argsFor(method)));
    });
  }
  for (const [method, args] of [
    ['updateCourse', ['course', { title: 'Updated' }]], ['deleteCourse', ['course']],
    ['insertLecture', [{}]], ['updateLecture', ['lecture', { title: 'Updated' }]],
    ['deleteLecture', ['lecture']], ['insertQAPost', [{}]], ['insertQAAnswer', ['post', {}]],
    ['deleteQAPost', ['post']],
  ]) {
    await t.test(`${method} accepts a confirmed saved row`, async () => {
      globalThis.fetch = async () => Response.json(method === 'updateCourse' ? { id: 'confirmed-row' } : [{ id: 'confirmed-row' }]);
      assert.ok(await remoteDb[method](...args));
    });
  }
  await t.test('course creation persists course and question pool in one RPC', async () => {
    const saved = { id: 'server-course', title: 'Confirmed course' };
    const questions = [{ id: 'q1', question: 'Fixture?', options: ['A', 'B'], correctAnswer: 2 }];
    let calls = 0;
    globalThis.fetch = async (url, options) => {
      calls++;
      assert.equal(url, 'https://database.invalid/rest/v1/rpc/save_course_record');
      const payload = JSON.parse(options.body);
      assert.equal(payload.p_course.title, 'Confirmed course');
      assert.equal(payload.p_course.raw_exam_text, undefined);
      assert.deepEqual(payload.p_questions, questions);
      return Response.json(saved);
    };
    assert.deepEqual(await remoteDb.insertCourse({ title: 'Confirmed course', examQuestions: questions }), saved);
    assert.equal(calls, 1);
  });
  await t.test('legacy browser-graded exam insertion is rejected before network', async () => {
    globalThis.fetch = () => assert.fail('Browser-computed grades must never be written');
    await assert.rejects(() => remoteDb.insertExamAttempt({ score: 100, passed: true }));
  });
  await t.test('payment RPC returns the confirmed database result', async () => {
    const result = { success: true, paymentId: 'pay_server', expireAt: '2027-01-01' };
    globalThis.fetch = async () => Response.json(result);
    assert.deepEqual(await remoteDb.processCoursePayment({ amount: 100 }), result);
  });
  await t.test('payment RPC propagates an uncertain timeout without a second request', async () => {
    let requests = 0;
    globalThis.fetch = async () => {
      requests++;
      throw new DOMException('timeout', 'AbortError');
    };
    await assert.rejects(() => remoteDb.processCoursePayment({ amount: 100 }), /10/);
    assert.equal(requests, 1);
  });
  await t.test('write rejects invalid response JSON', async () => {
    globalThis.fetch = async () => new Response('<html>not an API response</html>');
    await assert.rejects(() => remoteDb.upsertEnrollment({}));
  });
  await t.test('unconfigured writes reject before any network request', async () => {
    const previousUrl = process.env.VITE_SUPABASE_URL;
    process.env.VITE_SUPABASE_URL = '';
    try {
      const { remoteDb: unconfigured } = await import('../src/services/apiClient.js?unconfigured');
      globalThis.fetch = () => assert.fail('Unconfigured client must not send requests');
      await assert.rejects(() => unconfigured.upsertEnrollment({}));
      await assert.rejects(() => unconfigured.insertUser(userFixture));
    } finally {
      process.env.VITE_SUPABASE_URL = previousUrl;
    }
  });
  await t.test('insertUser rejects an empty HTTP 204 response', async () => {
    globalThis.fetch = async () => new Response(null, { status: 204 });
    await assert.rejects(() => remoteDb.insertUser(userFixture));
  });
  await t.test('insertUser uses server Auth registration and returns the server profile', async () => {
    const saved = { id: userFixture.id, memberNo: userFixture.memberNo };
    auth.setAuthSession(sessionFixture);
    globalThis.fetch = async (url, options) => {
      assert.equal(url, 'https://database.invalid/functions/v1/lms-auth');
      const payload = JSON.parse(options.body);
      assert.equal(payload.action, 'register');
      assert.equal(payload.password, userFixture.password);
      assert.equal(options.headers.Authorization, 'Bearer test-only');
      return Response.json({ user: saved });
    };
    assert.deepEqual(await remoteDb.insertUser(userFixture), saved);
  });
  await t.test('admin registration and REST use the authenticated user JWT', async () => {
    auth.setAuthSession(sessionFixture);
    let calls = 0;
    globalThis.fetch = async (url, options) => {
      calls++;
      assert.equal(options.headers.Authorization, 'Bearer fixture-user-jwt');
      if (url.includes('/functions/')) {
        assert.equal(JSON.parse(options.body).action, 'admin-register');
        return Response.json({ user: { id: userFixture.id } });
      }
      assert.match(url, /\/courses\?/);
      assert.doesNotMatch(url, /raw_exam_text|exam_questions/);
      return Response.json([]);
    };
    await remoteDb.insertUser(userFixture, true);
    await remoteDb.getCourses();
    assert.equal(calls, 2);
  });
  await t.test('progress sends only lecture id and position for server computation', async () => {
    const row = { id: 'server-progress', user_id: 'server-user', lecture_id: 'lecture', course_id: 'course',
      last_played_seconds: 12, watched_seconds: 12, progress_rate: 10, completed: false };
    globalThis.fetch = async (url, options) => {
      assert.equal(url, 'https://database.invalid/rest/v1/rpc/update_lecture_progress');
      assert.deepEqual(JSON.parse(options.body), { p_lecture_id: 'lecture', p_position: 12 });
      return Response.json(row);
    };
    const result = await remoteDb.upsertProgress({ userId: 'other-user', lectureId: 'lecture',
      lastPlayedSeconds: 12, watchedSeconds: 9999, progressRate: 100, completed: true });
    assert.equal(result.id, 'server-progress');
    assert.equal(result.userId, 'server-user');
    assert.equal(result.progressRate, 10);
    assert.equal(result.completed, false);
  });
  await t.test('certificate issuance sends only the course id', async () => {
    const row = { cert_no: 'SERVER-CERT', user_id: 'server-user', course_id: 'course', status: 'valid' };
    globalThis.fetch = async (url, options) => {
      assert.equal(url, 'https://database.invalid/rest/v1/rpc/issue_course_certificate');
      assert.deepEqual(JSON.parse(options.body), { p_course_id: 'course' });
      return Response.json(row);
    };
    const result = await remoteDb.insertCertificate({ courseId: 'course', userId: 'other-user', certNo: 'FORGED' });
    assert.equal(result.certNo, 'SERVER-CERT');
    assert.equal(result.userId, 'server-user');
  });
  await t.test('exam start returns a server-issued attempt and questions', async () => {
    const issued = { attemptId: 'server-attempt', questions: [{ id: 'q1', question: 'Fixture?', options: ['A', 'B'] }] };
    globalThis.fetch = async (url, options) => {
      assert.equal(url, 'https://database.invalid/rest/v1/rpc/start_course_exam');
      assert.deepEqual(JSON.parse(options.body), { p_course_id: 'course' });
      return Response.json(issued);
    };
    assert.deepEqual(await remoteDb.startCourseExam('course'), issued);
  });
  await t.test('exam submission sends answers, never client scores or pass status', async () => {
    const result = { score: 60, passed: true, correctCount: 12, totalCount: 20, id: 'server-attempt' };
    globalThis.fetch = async (url, options) => {
      assert.equal(url, 'https://database.invalid/rest/v1/rpc/submit_course_exam');
      assert.deepEqual(JSON.parse(options.body), { p_attempt_id: 'server-attempt', p_answers: { q1: 2 } });
      return Response.json(result);
    };
    assert.deepEqual(await remoteDb.submitCourseExam('server-attempt', { q1: 2 }), result);
  });
  await t.test('course exam metadata is preserved as a JSON object', async () => {
    const result = { courseId: 'course', questions: [], questionCount: 0 };
    globalThis.fetch = async (url, options) => {
      assert.equal(url, 'https://database.invalid/rest/v1/rpc/get_course_exam');
      assert.deepEqual(JSON.parse(options.body), { p_course_id: 'course' });
      return Response.json(result);
    };
    assert.deepEqual(await remoteDb.getCourseExam('course'), result);
  });
  await t.test('exam pool save accepts the SQL boolean confirmation', async () => {
    globalThis.fetch = async () => Response.json(true);
    assert.equal(await remoteDb.saveCourseExam('course', []), true);
  });
  await t.test('delayed login cannot recreate a session after logout', async () => {
    auth.clearAuthSession();
    let release;
    globalThis.fetch = async () => {
      await new Promise(resolve => { release = resolve; });
      return Response.json({ user: { id: 'old-user' }, session: sessionFixture });
    };
    const pending = remoteDb.authenticateUser('old-user', 'Fixture-only123!');
    const rejected = assert.rejects(pending);
    auth.clearAuthSession();
    release();
    await rejected;
    assert.equal(auth.getAuthSession(), null);
  });
  await t.test('an earlier login response cannot overwrite a newer login', async () => {
    auth.clearAuthSession();
    let release;
    const replacement = { ...sessionFixture, access_token: 'fixture-new-user-jwt' };
    globalThis.fetch = async (url, options) => {
      const payload = JSON.parse(options.body);
      if (payload.id === 'old-user') {
        await new Promise(resolve => { release = resolve; });
        return Response.json({ user: { id: 'old-user' }, session: sessionFixture });
      }
      return Response.json({ user: { id: 'new-user' }, session: replacement });
    };
    const old = remoteDb.authenticateUser('old-user', 'Fixture-only123!');
    const rejected = assert.rejects(old);
    await remoteDb.authenticateUser('new-user', 'Fixture-only123!');
    release();
    await rejected;
    assert.equal(auth.getAuthSession().access_token, replacement.access_token);
  });
  await t.test('a stale REST 401 cannot expire a newer authenticated session', async () => {
    auth.setAuthSession(sessionFixture);
    let release;
    globalThis.fetch = async (url, options) => {
      assert.equal(options.headers.Authorization, 'Bearer fixture-user-jwt');
      await new Promise(resolve => { release = resolve; });
      return Response.json({ message: 'expired old token' }, { status: 401 });
    };
    const pending = remoteDb.getCourses();
    const rejected = assert.rejects(pending);
    await new Promise(resolve => setImmediate(resolve));
    const replacement = { ...sessionFixture, access_token: 'fixture-new-session' };
    auth.setAuthSession(replacement);
    release();
    await rejected;
    assert.equal(auth.getAuthSession()?.access_token, replacement.access_token);
  });
  await t.test('lecture thumbnails persist their canonical reference and map back on reads', async () => {
    auth.setAuthSession(sessionFixture);
    const canonical = 'https://database.invalid/storage/v1/object/thumbnails/fixture.jpg';
    const signed = 'https://database.invalid/storage/v1/object/sign/thumbnails/fixture.jpg?token=fixture-signature';
    let stored;
    globalThis.fetch = async (url, options = {}) => {
      assert.ok(url.includes('/lectures'));
      if (options.method === 'PATCH') {
        stored = JSON.parse(options.body);
        return Response.json([{ id: 'lecture' }]);
      }
      return Response.json([{ id: 'lecture', course_id: 'course', thumbnail: canonical }]);
    };
    await remoteDb.updateLecture('lecture', { thumbnail: signed });
    assert.equal(stored.thumbnail, canonical);
    const [lecture] = await remoteDb.getLectures();
    assert.equal(lecture.thumbnail, canonical);
  });
  await t.test('a REST 401 for the current access token still expires that session', async () => {
    auth.setAuthSession(sessionFixture);
    globalThis.fetch = async () => Response.json({ message: 'expired current token' }, { status: 401 });
    await assert.rejects(() => remoteDb.getCourses());
    assert.equal(auth.getAuthSession(), null);
  });
});
