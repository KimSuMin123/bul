// 본인 비밀번호 변경: 현재 비밀번호 확인 → 규칙 검사 → Supabase Auth 비밀번호 변경.
import { test, expect, login, student } from './fixtures.mjs';

const puts = backend => backend.requests.filter(call => call.method === 'PUT' && call.endpoint === '/auth/v1/user');
const logins = backend => backend.requests.filter(call => call.endpoint === '/functions/v1/lms-auth' && call.body?.action === 'login');

async function open(page) {
  await page.getByRole('button', { name: '비밀번호 변경', exact: true }).click();
  return page.getByRole('dialog', { name: '비밀번호 변경' });
}
async function fill(dialog, current, next, confirm = next) {
  await dialog.getByLabel('현재 비밀번호').fill(current);
  await dialog.getByLabel('새 비밀번호', { exact: true }).fill(next);
  await dialog.getByLabel('새 비밀번호 확인').fill(confirm);
  await dialog.getByRole('button', { name: '비밀번호 변경하기' }).click();
}

test('a student changes their own password after proving the current one', async ({ page, backend }) => {
  await login(page);
  const dialog = await open(page);
  await fill(dialog, 'FixtureOnly123!', 'NewPass456!');
  await expect(page.getByRole('dialog')).toContainText('비밀번호 변경 완료');
  expect(logins(backend)).toHaveLength(2);
  expect(logins(backend)[1].body).toEqual({ action: 'login', id: student.id, password: 'FixtureOnly123!' });
  expect(puts(backend)).toHaveLength(1);
  expect(puts(backend)[0]).toMatchObject({ body: { password: 'NewPass456!' }, authorization: `Bearer fixture-token-${student.id}` });
  await expect(page.getByRole('button', { name: '로그아웃', exact: true })).toBeVisible();
});

test('a wrong current password, a weak password, or a mismatch never changes anything', async ({ page, backend }) => {
  await login(page);
  const dialog = await open(page);
  await fill(dialog, 'Wrong-Pass1!', 'NewPass456!');
  await expect(dialog.getByRole('alert')).toHaveText('현재 비밀번호가 일치하지 않습니다.');
  await fill(dialog, 'FixtureOnly123!', 'short1!');
  await expect(dialog.getByRole('alert')).toHaveText('비밀번호는 영문, 숫자, 기호를 포함하여 8자 이상이어야 합니다.');
  await fill(dialog, 'FixtureOnly123!', 'NewPass456!', 'NewPass456?');
  await expect(dialog.getByRole('alert')).toHaveText('새 비밀번호와 확인이 일치하지 않습니다.');
  expect(puts(backend)).toHaveLength(0);
  await dialog.getByRole('button', { name: '닫기' }).click();
  await expect(dialog).toHaveCount(0);
});
