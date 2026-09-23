import { test as base, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const videoBytes = readFileSync(new URL('./assets/short-video.webm', import.meta.url));

export const courseId = 'course-e2e';
export const student = { id: 'e2e-student', name: '테스트 학인', role: 'student', memberNo: 'TEST-001', phone: '010-0000-0001', birthDate: '1990-01-01' };
export const admin = { id: 'e2e-admin', name: '테스트 관리자', role: 'admin', memberNo: 'TEST-ADMIN', phone: '010-0000-0002', birthDate: '1980-01-01' };
export const enrollment = (status = 'active') => ({ id: 'enr-e2e', user_id: student.id, course_id: courseId, status, enrolled_at: '2026-01-01', paid_at: status === 'active' ? '2026-01-01' : null, expire_at: '2099-01-01' });

function initialDatabase() {
  return {
    courses: [{ id: courseId, title: '브라우저 검증 과정', subtitle: '실제 UI를 통한 저장 검증', category: '테스트 과정', thumbnail: '/images/logo.png', default_period_days: 90, sequential_unlock: true, price: 50000, instructor: '테스트 교수', cert_type: '테스트 자격', cert_grade: '2급', cert_type_full: '테스트 자격 2급', raw_exam_text: '' }],
    lectures: [{ id: 'lecture-e2e', course_id: courseId, order_index: 1, title: '브라우저 검증 강의', duration_seconds: 60, video_url: '', description: '테스트 차시' }],
    enrollments: [], payments: [], progress: [], certificates: [], qa_posts: [], exam_attempts: [], donation_receipts: [], site_announcements: [],
    users: [student, admin].map(user => ({ id: user.id, name: user.name, role: user.role, member_no: user.memberNo, phone: user.phone, birth_date: user.birthDate, created_at: '2026-01-01' }))
  };
}

export const test = base.extend({
  backend: async ({ page, context }, use) => {
    const backend = {
      db: initialDatabase(), requests: [], blockedExternal: [], unexpected: [], errors: [], localUploads: [],
      failures: new Map(), sessionUser: null, sessionValid: true, holds: new Map(), loginExpiresIn: 3600,
      fail(method, endpoint, status = 500) { this.failures.set(`${method} ${endpoint}`, status); },
      restore(method, endpoint) { this.failures.delete(`${method} ${endpoint}`); }
    };
    page.on('pageerror', error => backend.errors.push(error.message));
    await context.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin !== 'http://127.0.0.1:4310') {
        backend.blockedExternal.push(url.origin);
        return route.abort('blockedbyclient');
      }
      if (url.pathname.startsWith('/api/')) {
        backend.localUploads.push(url.pathname);
        return route.fulfill({ status: 404, contentType: 'text/html', body: '<!doctype html><h1>Static hosting has no upload API</h1>' });
      }
      if (!/^\/(?:rest|functions|auth|storage)\/v1\//.test(url.pathname)) return route.continue();
      const endpoint = url.pathname;
      const method = request.method();
      const body = request.postData() ? (() => { try { return request.postDataJSON(); } catch { return null; } })() : null;
      const call = { method, endpoint, query: url.search, body, authorization: request.headers().authorization };
      backend.requests.push(call);
      const respond = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
      const failure = backend.failures.get(`${method} ${endpoint}`);
      if (failure) return respond({ message: '검증용 저장 실패' }, failure);
      const hold = backend.holds.get(`${method} ${endpoint}`);
      if (hold) await hold;

      if (endpoint === '/functions/v1/lms-auth') {
        if (body?.action === 'login') {
          const user = [student, admin].find(item => item.id === body.id);
          if (!user || body.password !== 'FixtureOnly123!') return respond({ message: '아이디 또는 비밀번호가 일치하지 않습니다.' }, 401);
          backend.sessionUser = user;
          return respond({ user, session: { access_token: `fixture-token-${user.id}`, refresh_token: `fixture-refresh-${user.id}`, expires_at: Math.floor(Date.now() / 1000) + backend.loginExpiresIn } });
        }
      }
      if (endpoint === '/auth/v1/token') {
        if (!backend.sessionValid || !backend.sessionUser) return respond({ message: 'Expired session' }, 401);
        return respond({ access_token: `fixture-token-${backend.sessionUser.id}`, refresh_token: `fixture-refresh-${backend.sessionUser.id}`, expires_at: Math.floor(Date.now() / 1000) + 3600 });
      }
      if (endpoint === '/auth/v1/logout') { backend.sessionUser = null; return respond({}); }
      if (endpoint === '/rest/v1/rpc/current_lms_user') {
        if (!backend.sessionValid || !backend.sessionUser || !call.authorization?.startsWith('Bearer fixture-token-')) return respond({ message: 'Unauthorized' }, 401);
        return respond(backend.sessionUser);
      }
      if (endpoint === '/rest/v1/rpc/start_course_exam') {
        return respond({ attemptId: 'attempt-e2e', expiresAt: '2099-01-01T00:00:00Z', questions: Array.from({ length: 20 }, (_, i) => ({ id: `q-${i + 1}`, question: `서버 출제 문항 ${i + 1}`, options: ['첫 번째 답안', '두 번째 답안', '세 번째 답안', '네 번째 답안'] })) });
      }
      if (endpoint === '/rest/v1/rpc/get_course_exam') return respond({ questions: [], rawExamText: null });
      if (endpoint === '/rest/v1/rpc/update_lecture_progress') {
        const previous = backend.db.progress.find(row => row.lecture_id === body.p_lecture_id);
        const row = { id: 'progress-server', user_id: student.id, course_id: courseId, lecture_id: body.p_lecture_id, progress_rate: previous?.progress_rate || 0, completed: previous?.completed || false, watched_seconds: previous?.watched_seconds || 0, last_played_seconds: body.p_position, updated_at: new Date().toISOString() };
        backend.db.progress = [...backend.db.progress.filter(item => item.id !== row.id), row];
        return respond(row);
      }
      if (endpoint === '/rest/v1/rpc/submit_course_exam') {
        const attempt = { id: body.p_attempt_id, userId: student.id, courseId, score: 100, passed: true, correctCount: 20, totalCount: 20, createdAt: new Date().toISOString(), submittedAt: new Date().toISOString() };
        backend.db.exam_attempts.push({ id: attempt.id, user_id: attempt.userId, course_id: courseId, score: attempt.score, passed: attempt.passed, correct_count: 20, total_count: 20, created_at: attempt.createdAt });
        return respond(attempt);
      }
      if (endpoint === '/rest/v1/rpc/process_course_payment') {
        backend.db.payments.push({ id: 'pay-e2e', user_id: body.p_user_id, course_id: body.p_course_id, amount: body.p_amount, manager: body.p_manager, paid_at: body.p_paid_at });
        backend.db.enrollments = [enrollment('active')];
        return respond({ success: true, paymentId: 'pay-e2e', expireAt: '2099-01-01', enrollment: enrollment('active') });
      }
      if (method === 'POST' && endpoint.startsWith('/storage/v1/object/sign/lectures/')) return respond({ signedURL: `/object/sign/lectures/${endpoint.split('/').pop()}?token=fixture-signed-token` });
      if (method === 'GET' && endpoint.startsWith('/storage/v1/object/')) return route.fulfill({ status: 200, contentType: 'video/webm', body: videoBytes });
      if (endpoint.startsWith('/storage/v1/object/')) return respond({ Key: 'lecture-videos/e2e.mp4' });
      const table = endpoint.match(/^\/rest\/v1\/([^/]+)$/)?.[1];
      if (table && Object.hasOwn(backend.db, table)) {
        if (method === 'GET') {
          const rows = backend.db[table].filter(row => [...url.searchParams].every(([key, value]) => !value.startsWith('eq.') || String(row[key]) === value.slice(3)));
          return respond(rows);
        }
        if (method === 'POST') {
          const row = { ...body, id: body?.id || `${table}-${backend.db[table].length + 1}` };
          backend.db[table] = [...backend.db[table].filter(item => item.id !== row.id), row];
          return respond([row], 201);
        }
        if (method === 'PATCH') {
          const rows = backend.db[table].filter(row => [...url.searchParams].every(([key, value]) => !value.startsWith('eq.') || String(row[key]) === value.slice(3)));
          rows.forEach(row => Object.assign(row, body));
          return respond(rows);
        }
        if (method === 'DELETE') {
          backend.db[table] = backend.db[table].filter(row => ![...url.searchParams].every(([key, value]) => !value.startsWith('eq.') || String(row[key]) === value.slice(3)));
          return respond([]);
        }
      }
      backend.unexpected.push(call);
      return respond({ message: `Unmocked API: ${method} ${endpoint}` }, 501);
    });
    await use(backend);
    expect(backend.unexpected, 'Every application API request must be explicitly modeled').toEqual([]);
    expect(backend.errors, 'Browser should not have uncaught exceptions').toEqual([]);
  }
});

export { expect };

export async function login(page, id = student.id) {
  await page.goto('/#login');
  await page.getByPlaceholder('아이디를 입력하세요', { exact: true }).fill(id);
  await page.getByPlaceholder('비밀번호를 입력하세요', { exact: true }).fill('FixtureOnly123!');
  await page.locator('form').getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page).toHaveURL(id === admin.id ? /#admin$/ : /#dashboard$/);
  await expect(page.getByRole('button', { name: '로그아웃', exact: true })).toBeVisible();
}
