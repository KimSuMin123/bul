import { test, expect, student } from './fixtures.mjs';

async function loginWith(page, remember) {
  await page.goto('/#login');
  await page.getByPlaceholder('아이디를 입력하세요', { exact: true }).fill(student.id);
  await page.getByPlaceholder('비밀번호를 입력하세요', { exact: true }).fill('FixtureOnly123!');
  if (remember) await page.getByRole('checkbox', { name: /자동 로그인/ }).check();
  await page.locator('form').getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page.getByRole('button', { name: '로그아웃', exact: true })).toBeVisible();
}

// 새 탭은 sessionStorage가 비어 있어 브라우저를 다시 연 것과 같다.
async function openFreshTab(context) {
  const tab = await context.newPage();
  await tab.goto('/#dashboard');
  await tab.waitForTimeout(1500);
  return tab;
}

test('auto-login keeps the user signed in after the browser is reopened, and logout ends it', async ({ page, context, backend }) => {
  await page.goto('/#login');
  await expect(page.getByRole('checkbox', { name: /자동 로그인/ })).not.toBeChecked();
  await loginWith(page, true);
  await page.close();

  const reopened = await openFreshTab(context);
  await expect(reopened.getByRole('button', { name: '로그아웃', exact: true })).toBeVisible();
  await reopened.screenshot({ path: 'test_artifacts/auto-login/reopened_signed_in.png' });

  await reopened.getByRole('button', { name: '로그아웃', exact: true }).click();
  expect(await reopened.evaluate(() => localStorage.getItem('buddha_lms_auth_session'))).toBeNull();
  const afterLogout = await openFreshTab(context);
  await expect(afterLogout.getByRole('button', { name: '로그아웃', exact: true })).toHaveCount(0);
});

test('without auto-login the login ends when the browser is closed', async ({ page, context, backend }) => {
  await loginWith(page, false);
  expect(await page.evaluate(() => localStorage.getItem('buddha_lms_auth_session'))).toBeNull();
  await page.close();
  const reopened = await openFreshTab(context);
  await expect(reopened.getByRole('button', { name: '로그아웃', exact: true })).toHaveCount(0);
});
