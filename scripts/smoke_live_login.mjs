// Optional read-only smoke check. Credentials are supplied through environment variables.
import { chromium, expect } from '@playwright/test';
import { preview } from 'vite';

if (!process.env.LMS_TEST_ID || !process.env.LMS_TEST_PASSWORD) throw new Error('Set LMS_TEST_ID and LMS_TEST_PASSWORD.');
const server = await preview({ preview: { host: '127.0.0.1', port: 4312, strictPort: true, open: false } });
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await context.route('**/*', async route => {
    const request = route.request();
    const safePost = /\/rpc\/(login_user|current_lms_user)$/.test(new URL(request.url()).pathname)
      || /\/auth\/v1\/(token|logout)/.test(request.url())
      || (/\/functions\/v1\/lms-auth$/.test(request.url()) && request.postDataJSON()?.action === 'login');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method()) && !safePost) return route.abort();
    return route.continue();
  });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4312/#login');
  await page.getByPlaceholder('아이디를 입력하세요').fill(process.env.LMS_TEST_ID);
  await page.getByPlaceholder('비밀번호를 입력하세요', { exact: true }).fill(process.env.LMS_TEST_PASSWORD);
  await page.locator('form button[type="submit"]').click();
  await expect(page.getByRole('button', { name: '로그아웃', exact: true }).first()).toBeVisible({ timeout: 20000 });
  await page.goto('http://127.0.0.1:4312/#admin');
  await expect(page.getByRole('heading', { name: '학사 및 콘텐츠 관리 시스템 (CMS)' })).toBeVisible({ timeout: 15000 });
  console.log('PASS live account login and administrator view (read-only)');
} finally {
  await browser?.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
