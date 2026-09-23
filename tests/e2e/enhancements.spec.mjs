import { test, expect, login, student, courseId, enrollment } from './fixtures.mjs';

test('registration consent starts clear, is readable, and gates submission', async ({ page, backend }) => {
  await page.goto('/#register');
  const consent = page.getByRole('checkbox', { name: '[필수] 개인정보 수집·이용에 동의합니다.' });
  await expect(consent).not.toBeChecked();
  await expect(page.getByRole('button', { name: '회원가입 완료' })).toBeDisabled();
  await page.getByText('개인정보 수집·이용 동의 내용 보기').click();
  await expect(page.getByText(/수집 항목: 아이디/)).toBeVisible();
  await consent.check();
  await expect(page.getByRole('button', { name: '회원가입 완료' })).toBeEnabled();
  expect(backend.requests.filter(item => item.body?.action === 'register')).toHaveLength(0);
});

for (const rate of [79.99, 80, 80.01]) {
  test(`next lecture UI boundary ${rate}%`, async ({ page, backend }) => {
    backend.db.enrollments = [enrollment()];
    backend.db.lectures.push({ ...backend.db.lectures[0], id: 'lecture-next', order_index: 2, title: '다음 경계 강의' });
    backend.db.progress = [{ id: 'progress-1', user_id: student.id, course_id: courseId, lecture_id: 'lecture-e2e', progress_rate: rate, watched_seconds: 48, last_played_seconds: 48, completed: false }];
    await login(page);
    await page.goto(`/#courseDetail?id=${courseId}`);
    await expect(page.getByText('다음 경계 강의', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '잠김', exact: true })).toHaveCount(rate < 80 ? 1 : 0);
    if (rate < 80) {
      await page.getByRole('button', { name: '잠김', exact: true }).click();
      await expect(page.getByRole('dialog').getByText(/80% 이상/)).toBeVisible();
    }
  });
}

test('saved enrollment popup contains bank amount and the new approval schedule', async ({ page, backend }) => {
  await login(page);
  await page.goto(`/#courseDetail?id=${courseId}`);
  await page.getByRole('button', { name: '수강 신청 접수하기', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('농협 301-0264-3664-41');
  await expect(dialog).toContainText('50,000원');
  await expect(dialog).toContainText('입금 확인 및 수강 승인은 매일 오전 10시~11시, 오후 6시~7시에 진행됩니다.');
  expect(backend.db.enrollments).toHaveLength(1);
});

test('SMS question link opens and focuses the question without breaking later filters', async ({ page, backend }) => {
  backend.db.enrollments = [enrollment()];
  backend.db.qa_posts = [{ id: 'question-focus', course_id: courseId, lecture_id: 'lecture-e2e', author_id: student.id,
    author_name: student.name, title: '문자 링크 질문', content: '문자에서 들어온 질문 원문', created_at: '2026-09-23',
    is_private: false, qa_answers: [{ id: 'answer-focus', author_id: 'e2e-admin', author_name: '관리자', content: '답변 내용', created_at: '2026-09-23' }] }];
  await login(page);
  await page.goto('/#watch?id=lecture-e2e&question=question-focus');
  await expect(page.locator('#question-question-focus')).toBeFocused();
  await page.getByRole('button', { name: '답변 대기 (0)', exact: true }).click();
  await expect(page.locator('#question-question-focus')).toHaveCount(0);
  await page.getByRole('button', { name: '전체 질문 (1)', exact: true }).click();
  await expect(page.getByText('문자에서 들어온 질문 원문', { exact: true })).toBeVisible();
});
