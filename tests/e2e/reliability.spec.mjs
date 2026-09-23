import { test, expect, login, student, admin, courseId, enrollment } from './fixtures.mjs';
import { fileURLToPath } from 'node:url';

const videoFixture = fileURLToPath(new URL('./assets/short-video.webm', import.meta.url));

const writes = (backend, endpoint) => backend.requests.filter(call => call.method === 'POST' && call.endpoint === endpoint);

test('student login uses a bearer session; refresh validates it and logout clears access', async ({ page, backend }) => {
  backend.db.enrollments = [enrollment()];
  await login(page);
  await expect(page.getByText('브라우저 검증 과정', { exact: true })).toBeVisible();
  expect(writes(backend, '/functions/v1/lms-auth')[0].body).toEqual({ action: 'login', id: student.id, password: 'FixtureOnly123!' });
  expect(backend.requests.filter(call => call.endpoint === '/rest/v1/enrollments').every(call => call.authorization === `Bearer fixture-token-${student.id}`)).toBe(true);
  await page.reload();
  await expect(page.getByRole('button', { name: '로그아웃', exact: true })).toBeVisible();
  expect(writes(backend, '/rest/v1/rpc/current_lms_user').length).toBeGreaterThan(0);
  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await page.goto('/#dashboard');
  await expect(page.getByRole('heading', { name: '로그인이 필요합니다' })).toBeVisible();
  await expect.poll(() => writes(backend, '/auth/v1/logout').length).toBe(1);
});

test('forged cached admin identity cannot open the admin screen', async ({ page, backend }) => {
  // This deliberately models an attacker modifying the old cache, not a successful login.
  await page.addInitScript(() => sessionStorage.setItem('buddha_lms_current_user', JSON.stringify({ id: 'admin', role: 'admin', name: 'forged' })));
  await page.goto('/#admin');
  await expect(page).toHaveURL(/#login$/);
  await expect(page.getByRole('heading', { name: '학사 및 콘텐츠 관리 시스템 (CMS)' })).toHaveCount(0);
  expect(backend.requests.some(call => call.endpoint === '/rest/v1/users')).toBe(false);
});

test('an expired access token is refreshed once before parallel private requests', async ({ page, backend }) => {
  backend.loginExpiresIn = -60;
  backend.db.enrollments = [enrollment()];
  await login(page);
  await expect(page.getByText('브라우저 검증 과정', { exact: true })).toBeVisible();
  expect(writes(backend, '/auth/v1/token')).toHaveLength(1);
  expect(writes(backend, '/auth/v1/token')[0].body).toEqual({ refresh_token: `fixture-refresh-${student.id}` });
  expect(backend.requests.filter(call => call.endpoint === '/rest/v1/enrollments').every(call => call.authorization === `Bearer fixture-token-${student.id}`)).toBe(true);
});

test('server-invalidated session is rejected after refresh', async ({ page, backend }) => {
  await login(page, admin.id);
  backend.sessionValid = false;
  await page.reload();
  await expect(page).toHaveURL(/#login$/);
  await expect(page.getByRole('heading', { name: '학사 및 콘텐츠 관리 시스템 (CMS)' })).toHaveCount(0);
});

test('failed login remains signed out without querying password columns', async ({ page, backend }) => {
  await page.goto('/#login');
  await page.getByPlaceholder('아이디를 입력하세요', { exact: true }).fill(student.id);
  await page.getByPlaceholder('비밀번호를 입력하세요', { exact: true }).fill('incorrect-password');
  await page.locator('form').getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page.getByText('아이디 또는 비밀번호가 일치하지 않습니다.', { exact: true })).toBeVisible();
  expect(backend.requests.some(call => call.endpoint === '/rest/v1/users' || call.query.includes('password'))).toBe(false);
  await expect(page).toHaveURL(/#login$/);
});

test('application persists once and survives a real page reload', async ({ page, backend }) => {
  await login(page);
  await page.goto(`/#courseDetail?id=${courseId}`);
  await page.getByRole('button', { name: '수강 신청 접수하기', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('수강 신청 완료');
  expect(backend.db.enrollments).toHaveLength(1);
  expect(backend.db.enrollments[0]).toMatchObject({ user_id: student.id, course_id: courseId, status: 'pending' });
  expect(writes(backend, '/rest/v1/enrollments')).toHaveLength(1);
  await page.getByRole('dialog').getByRole('button', { name: '확인', exact: true }).click();
  await expect(page).toHaveURL(/#dashboard$/);
  await page.reload();
  await expect(page.getByText('브라우저 검증 과정', { exact: true })).toBeVisible();
  await expect(page.getByText(/교학처 수납 대기|대면 수납 대기/).first()).toBeVisible();
});

test('application failure keeps the form retryable and never shows success', async ({ page, backend }) => {
  backend.fail('POST', '/rest/v1/enrollments');
  await login(page);
  await page.goto(`/#courseDetail?id=${courseId}`);
  await page.getByRole('button', { name: '수강 신청 접수하기', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('수강 신청 실패');
  expect(backend.db.enrollments).toHaveLength(0);
  await page.getByRole('dialog').getByRole('button', { name: '확인', exact: true }).click();
  await expect(page.getByRole('button', { name: '수강 신청 접수하기', exact: true })).toBeEnabled();
  backend.restore('POST', '/rest/v1/enrollments');
  await page.getByRole('button', { name: '수강 신청 접수하기', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('수강 신청 완료');
  expect(backend.db.enrollments).toHaveLength(1);
});

test('Enter on modal cancel preserves the page and restores keyboard focus', async ({ page, backend }) => {
  await page.goto(`/#courseDetail?id=${courseId}`);
  const opener = page.getByRole('button', { name: '수강 신청 접수하기', exact: true });
  await opener.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('로그인 필요 안내');
  await expect(dialog.getByRole('button', { name: '로그인하기', exact: true })).toBeFocused();
  await dialog.getByRole('button', { name: '취소', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`#courseDetail\\?id=${courseId}$`));
  await expect(opener).toBeFocused();
  expect(writes(backend, '/rest/v1/enrollments')).toHaveLength(0);
});

test('admin payment errors do not fall back to partial direct writes', async ({ page, backend }) => {
  backend.fail('POST', '/rest/v1/rpc/process_course_payment');
  backend.db.enrollments = [enrollment('pending')];
  await login(page, admin.id);
  await page.getByRole('button', { name: '+ 대면 수납 등록', exact: true }).click();
  const modal = page.locator('.modal-card').filter({ hasText: '대면 결제 수납 등록' });
  await modal.locator('select').nth(0).selectOption(student.id);
  await modal.locator('select').nth(1).selectOption(courseId);
  await modal.locator('input[type="number"]').fill('50000');
  await modal.getByRole('button', { name: '수납 완료 및 수강 승인', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('수납 처리 실패');
  expect(writes(backend, '/rest/v1/rpc/process_course_payment')).toHaveLength(1);
  expect(writes(backend, '/rest/v1/payments')).toHaveLength(0);
  expect(writes(backend, '/rest/v1/enrollments')).toHaveLength(0);
  expect(backend.db.payments).toHaveLength(0);
  expect(backend.db.enrollments[0].status).toBe('pending');
  await page.getByRole('dialog').getByRole('button', { name: '확인', exact: true }).click();
  await expect(modal.getByRole('button', { name: '수납 완료 및 수강 승인', exact: true })).toBeEnabled();
  const originalRequestId = writes(backend, '/rest/v1/rpc/process_course_payment')[0].body.p_request_id;
  expect(originalRequestId).toMatch(/^[0-9a-f]{8}-[0-9a-f-]{27}$/i);
  backend.restore('POST', '/rest/v1/rpc/process_course_payment');
  await page.reload();
  await page.getByRole('button', { name: '+ 대면 수납 등록', exact: true }).click();
  await modal.locator('select').nth(0).selectOption(student.id);
  await modal.locator('select').nth(1).selectOption(courseId);
  await modal.locator('input[type="number"]').fill('50000');
  await modal.getByRole('button', { name: '수납 완료 및 수강 승인', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('수납 처리 완료');
  expect(writes(backend, '/rest/v1/rpc/process_course_payment')).toHaveLength(2);
  expect(writes(backend, '/rest/v1/rpc/process_course_payment')[1].body.p_request_id).toBe(originalRequestId);
  expect(backend.db.payments).toHaveLength(1);
});

test('admin CMS keeps entered course data after a save error', async ({ page, backend }) => {
  backend.fail('POST', '/rest/v1/rpc/save_course_record');
  await login(page, admin.id);
  await page.getByRole('button', { name: '코스 & VOD 콘텐츠 관리', exact: true }).click();
  await page.getByRole('button', { name: '새 코스 추가', exact: true }).click();
  const title = page.getByPlaceholder('예: 불교의례법사 과정 III (16강~19강)', { exact: true });
  await title.fill('저장 실패 검증 과정');
  await page.getByRole('button', { name: '새 코스 등록 완료', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText(/실패|오류/);
  expect(backend.db.courses).toHaveLength(1);
  await page.getByRole('dialog').getByRole('button', { name: '확인', exact: true }).click();
  await expect(title).toHaveValue('저장 실패 검증 과정');
  await expect(page.getByRole('button', { name: '새 코스 등록 완료', exact: true })).toBeEnabled();
});

test('exam renders server-issued questions and sends only attempt id and answers; failure permits retry', async ({ page, backend }) => {
  backend.db.enrollments = [enrollment()];
  backend.db.progress = [{ id: 'progress-e2e', user_id: student.id, course_id: courseId, lecture_id: 'lecture-e2e', completed: true, progress_rate: 100, watched_seconds: 60, last_played_seconds: 60 }];
  await login(page);
  await page.getByRole('button', { name: /자격 검정 시험 응시하기/ }).click();
  await page.getByRole('button', { name: /자격 평가 시험 시작하기/ }).click();
  await expect(page.getByText('서버 출제 문항 1', { exact: true })).toBeVisible();
  expect(writes(backend, '/rest/v1/rpc/start_course_exam')[0].body).toEqual({ p_course_id: courseId });
  for (let index = 1; index <= 20; index++) {
    await expect(page.getByText(`서버 출제 문항 ${index}`, { exact: true })).toBeVisible();
    await page.getByText('첫 번째 답안', { exact: true }).click();
    if (index < 20) await page.getByRole('button', { name: '다음 문제', exact: true }).click();
  }
  backend.fail('POST', '/rest/v1/rpc/submit_course_exam');
  await page.getByRole('button', { name: '시험 제출하기', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('시험 제출 실패');
  expect(backend.db.exam_attempts).toHaveLength(0);
  const firstSubmission = writes(backend, '/rest/v1/rpc/submit_course_exam')[0].body;
  expect(Object.keys(firstSubmission).sort()).toEqual(['p_answers', 'p_attempt_id']);
  expect(firstSubmission.p_attempt_id).toBe('attempt-e2e');
  expect(Object.keys(firstSubmission.p_answers)).toHaveLength(20);
  await page.getByRole('dialog').getByRole('button', { name: '확인', exact: true }).click();
  backend.restore('POST', '/rest/v1/rpc/submit_course_exam');
  await page.getByRole('button', { name: '시험 제출하기', exact: true }).click();
  await expect(page.getByText('🎉 [합격] 수료 기준 60점 통과', { exact: true })).toBeVisible();
  expect(backend.db.exam_attempts).toHaveLength(1);
  expect(writes(backend, '/rest/v1/rpc/submit_course_exam')[1].body).toEqual(firstSubmission);
  expect(writes(backend, '/rest/v1/exam_attempts')).toHaveLength(0);
});

test('configured direct video upload uses authenticated storage without a development-only API', async ({ page, backend }) => {
  await login(page, admin.id);
  await page.getByRole('button', { name: '+ 신규 VOD 차시 등록', exact: true }).click();
  const modal = page.locator('.modal-card').filter({ hasText: '신규 VOD 차시 등록 (CMS)' });
  await modal.locator('select').selectOption(courseId);
  await modal.getByPlaceholder('예: 4강. 보살행과 일상 속 자비 실천').fill('업로드 경로 검증');
  // This original 64x64 WebM is decoded by the real HTMLVideoElement metadata path.
  await modal.locator('input[type="file"]').setInputFiles(videoFixture);
  await modal.getByRole('button', { name: '프라이빗 서버로 업로드 및 차시 등록 완료', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('차시 등록 완료');
  const uploads = backend.requests.filter(call => call.method === 'POST' && call.endpoint.startsWith('/storage/v1/object/'));
  expect(uploads).toHaveLength(1);
  expect(uploads[0].authorization).toBe(`Bearer fixture-token-${admin.id}`);
  expect(backend.localUploads).toEqual([]);
  expect(backend.db.lectures).toHaveLength(2);
  expect(backend.db.lectures[1].video_url).toContain('/storage/v1/object/lectures/');
  expect(backend.db.lectures[1].video_url).not.toContain('/public/');
  expect(backend.db.lectures[1].duration_seconds).toBe(1);
});

test('administrator video preview resolves a signed URL and reads actual video metadata', async ({ page, backend }) => {
  backend.db.lectures[0].video_url = 'http://127.0.0.1:4310/storage/v1/object/lectures/private-preview.webm';
  await login(page, admin.id);
  await page.getByRole('button', { name: '코스 & VOD 콘텐츠 관리', exact: true }).click();
  await page.getByTitle('동영상 미리보기 재생', { exact: true }).click();
  await expect.poll(() => writes(backend, '/storage/v1/object/sign/lectures/private-preview.webm').length).toBeGreaterThan(0);
  expect(writes(backend, '/storage/v1/object/sign/lectures/private-preview.webm')[0].authorization).toBe(`Bearer fixture-token-${admin.id}`);
  await expect(page.locator('video')).toHaveAttribute('src', /\/object\/sign\/lectures\/private-preview\.webm\?token=fixture-signed-token$/);
  await expect.poll(() => page.locator('video').evaluate(video => Number.isFinite(video.duration) && video.duration > 0)).toBe(true);
});

test('unreadable video metadata rejects the file without uploading or saving a guessed duration', async ({ page, backend }) => {
  await login(page, admin.id);
  await page.getByRole('button', { name: '+ 신규 VOD 차시 등록', exact: true }).click();
  const modal = page.locator('.modal-card').filter({ hasText: '신규 VOD 차시 등록 (CMS)' });
  await modal.locator('select').selectOption(courseId);
  await modal.getByPlaceholder('예: 4강. 보살행과 일상 속 자비 실천').fill('잘못된 영상 거절 확인');
  await modal.locator('input[type="file"]').setInputFiles({ name: 'corrupt-video.mp4', mimeType: 'video/mp4', buffer: Buffer.from('this-is-not-a-video') });
  await expect(page.getByText(/영상 정보를 읽지 못했습니다/)).toBeVisible();
  expect(backend.requests.filter(call => call.method === 'POST' && call.endpoint.startsWith('/storage/v1/object/'))).toHaveLength(0);
  expect(writes(backend, '/rest/v1/lectures')).toHaveLength(0);
  expect(backend.db.lectures).toHaveLength(1);
});

test('a rejected exam start keeps the introduction visible and can be retried', async ({ page, backend }) => {
  backend.db.enrollments = [enrollment()];
  backend.db.progress = [{ id: 'progress-e2e', user_id: student.id, course_id: courseId, lecture_id: 'lecture-e2e', completed: true, progress_rate: 100 }];
  backend.fail('POST', '/rest/v1/rpc/start_course_exam', 403);
  await login(page);
  await page.getByRole('button', { name: /자격 검정 시험 응시하기/ }).click();
  await page.getByRole('button', { name: /자격 평가 시험 시작하기/ }).click();
  await expect(page.getByRole('dialog')).toContainText('시험 시작 실패');
  expect(writes(backend, '/rest/v1/rpc/start_course_exam')).toHaveLength(1);
  await page.getByRole('dialog').getByRole('button', { name: '확인', exact: true }).click();
  await expect(page.getByRole('button', { name: /자격 평가 시험 시작하기/ })).toBeEnabled();
  await expect(page.getByText('서버 출제 문항 1', { exact: true })).toHaveCount(0);
  backend.restore('POST', '/rest/v1/rpc/start_course_exam');
  await page.getByRole('button', { name: /자격 평가 시험 시작하기/ }).click();
  await expect(page.getByText('서버 출제 문항 1', { exact: true })).toBeVisible();
});

test('an enrolled viewer resolves a private video through an authenticated signed URL', async ({ page, backend }) => {
  backend.db.enrollments = [enrollment()];
  backend.db.lectures[0].video_url = 'http://127.0.0.1:4310/storage/v1/object/lectures/private-fixture.mp4';
  await login(page);
  await page.goto('/#watch?id=lecture-e2e');
  await expect.poll(() => writes(backend, '/storage/v1/object/sign/lectures/private-fixture.mp4').length).toBeGreaterThan(0);
  expect(writes(backend, '/storage/v1/object/sign/lectures/private-fixture.mp4')[0]).toMatchObject({
    authorization: `Bearer fixture-token-${student.id}`, body: { expiresIn: 3600 }
  });
  await expect(page.locator('video')).toHaveAttribute('src', /\/storage\/v1\/object\/sign\/lectures\/private-fixture\.mp4\?token=fixture-signed-token$/);
});

test('certificate denial stays an error and never writes a client-generated certificate', async ({ page, backend }) => {
  backend.db.enrollments = [enrollment('completed')];
  backend.db.progress = [{ id: 'progress-e2e', user_id: student.id, course_id: courseId, lecture_id: 'lecture-e2e', completed: true, progress_rate: 100 }];
  backend.db.exam_attempts = [{ id: 'attempt-saved', user_id: student.id, course_id: courseId, score: 100, passed: true, correct_count: 20, total_count: 20, created_at: '2026-09-01' }];
  backend.fail('POST', '/rest/v1/rpc/issue_course_certificate', 403);
  await login(page);
  await page.getByRole('button', { name: /수료증.*발급|수료증.*출력/ }).first().click();
  await expect(page.getByRole('dialog')).toContainText('수료증 발급 오류');
  expect(writes(backend, '/rest/v1/rpc/issue_course_certificate')[0].body).toEqual({ p_course_id: courseId });
  expect(writes(backend, '/rest/v1/certificates')).toHaveLength(0);
  expect(backend.db.certificates).toHaveLength(0);
});
