// 1인 1기기: 수강생이 로그인하면 같은 계정의 다른 기기 로그인을 끊고(관리자 제외),
// 끊긴 기기는 로그인 연장이 거절될 때 중복 로그인 안내 후 로그아웃된다.
import { test, expect, login, student, admin, enrollment } from './fixtures.mjs';

const revokes = backend => backend.requests.filter(call => call.method === 'POST' && call.endpoint === '/auth/v1/logout');

test('a student login signs out the account on other devices but keeps this device signed in', async ({ page, backend }) => {
  await login(page);
  await expect.poll(() => revokes(backend).length).toBe(1);
  expect(revokes(backend)[0]).toMatchObject({ query: '?scope=others', authorization: `Bearer fixture-token-${student.id}` });
  expect(backend.sessionUser?.id).toBe(student.id);
  await expect(page.getByRole('button', { name: '로그아웃', exact: true })).toBeVisible();
});

test('an administrator login never signs out other devices', async ({ page, backend }) => {
  await login(page, admin.id);
  await page.waitForTimeout(1000);
  expect(revokes(backend)).toHaveLength(0);
});

test('a device replaced by another login shows the duplicate-login notice and returns to login', async ({ page, backend }) => {
  backend.db.enrollments = [enrollment()];
  await page.clock.install();
  await login(page);
  // Another device logged in: this device's refresh token is revoked, and its access token expires
  backend.sessionValid = false;
  // The next background request needs a renewal, which is rejected
  await page.clock.fastForward('02:00:00');
  const dialog = page.locator('.modal-card').filter({ hasText: '중복 로그인 감지' });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('button', { name: '로그아웃', exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: '다시 로그인하기' }).click();
  await expect(page).toHaveURL(/#login$/);
  await expect(dialog).toHaveCount(0);
});
