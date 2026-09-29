// 비밀번호 찾기(셀프 재설정): 로그인 화면에서 아이디·이름·생년월일 확인 후 새 비밀번호 설정.
import { test, expect, student } from './fixtures.mjs';

const resets = backend => backend.requests.filter(call => call.endpoint === '/functions/v1/lms-auth' && call.body?.action === 'self-reset');

async function openReset(page) {
  await page.goto('/#login');
  await page.getByPlaceholder('아이디를 입력하세요', { exact: true }).fill(student.id);
  await page.getByRole('button', { name: '비밀번호 찾기' }).click();
  return page.getByRole('dialog', { name: '비밀번호 재설정' });
}
async function submit(dialog, { name, birthDate, next = 'NewPass456!', confirm = next }) {
  await dialog.getByLabel('이름').fill(name);
  await dialog.getByLabel('생년월일').fill(birthDate);
  await dialog.getByLabel('새 비밀번호', { exact: true }).fill(next);
  await dialog.getByLabel('새 비밀번호 확인').fill(confirm);
  await dialog.getByRole('button', { name: '비밀번호 재설정하기' }).click();
}

test('a member who forgot the password resets it with id, name and birth date', async ({ page, backend }) => {
  const dialog = await openReset(page);
  await expect(dialog.getByLabel('아이디')).toHaveValue(student.id);
  await submit(dialog, { name: student.name, birthDate: student.birthDate });
  await expect(page.getByRole('dialog')).toContainText('비밀번호 재설정 완료');
  expect(resets(backend)).toHaveLength(1);
  expect(resets(backend)[0].body).toEqual({ action: 'self-reset', id: student.id, name: student.name, birthDate: student.birthDate, newPassword: 'NewPass456!' });
  await page.getByRole('dialog').getByRole('button', { name: '확인', exact: true }).click();
  await expect(page.getByPlaceholder('아이디를 입력하세요', { exact: true })).toHaveValue(student.id);
});

test('mismatched details show the server message; weak or mismatched passwords never reach the server', async ({ page, backend }) => {
  const dialog = await openReset(page);
  await submit(dialog, { name: '다른 사람', birthDate: student.birthDate });
  await expect(dialog.getByRole('alert')).toHaveText('입력하신 아이디, 이름, 생년월일과 일치하는 회원 정보가 없습니다.');
  await submit(dialog, { name: student.name, birthDate: student.birthDate, next: 'weakpass' });
  await expect(dialog.getByRole('alert')).toHaveText('비밀번호는 영문, 숫자, 기호를 포함하여 8자 이상이어야 합니다.');
  await submit(dialog, { name: student.name, birthDate: student.birthDate, next: 'NewPass456!', confirm: 'NewPass456?' });
  await expect(dialog.getByRole('alert')).toHaveText('새 비밀번호와 확인이 일치하지 않습니다.');
  expect(resets(backend)).toHaveLength(1);
  await expect(dialog).toContainText('교학처(010-4702-0283)');
});
