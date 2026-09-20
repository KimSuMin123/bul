import puppeteer from 'puppeteer-core';
import { spawn } from 'child_process';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 5199;
const BASE_URL = `http://localhost:${PORT}`;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testAdminLogin() {
  console.log('1. Vite Preview 서버 기동 중...');
  const server = spawn('npx.cmd', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
    shell: true,
    stdio: 'pipe'
  });

  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(BASE_URL);
      if (res.ok) break;
    } catch {
      await delay(400);
    }
  }

  console.log('2. Chrome 기동...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    console.log('3. 로그인 페이지로 이동...');
    await page.goto(`${BASE_URL}/#login`, { waitUntil: 'networkidle0' });
    await delay(800);

    console.log('4. 관리자 계정 입력 (admin / Password123!)...');
    const inputs = await page.$$('input');
    await inputs[0].type('admin');
    await inputs[1].type('Password123!');

    const submitBtn = await page.$('button[type="submit"]');
    await submitBtn.click();
    console.log('5. 로그인 버튼 클릭...');
    await delay(1500);

    // Check current hash or view
    const currentUrl = page.url();
    console.log('로그인 후 URL:', currentUrl);

    // Check if warning modal appeared
    const modalText = await page.$eval('body', el => el.innerText);
    const hasWarningModal = modalText.includes('접근 권한 제한') || modalText.includes('관리자 계정(admin)만 접근할 수 있는 페이지입니다');

    if (hasWarningModal) {
      console.error('✖ FAIL: 관리자 페이지 접근 시 경고창이 여전히 표시됩니다!');
    } else {
      console.log('✔ PASS: 경고창 없이 정상적으로 진입되었습니다!');
    }

    const hasAdminDashboard = modalText.includes('학사 및 콘텐츠 관리') || modalText.includes('수납 장부') || modalText.includes('수강생 관리') || modalText.includes('관리자 CMS');
    console.log('관리자 대시보드 렌더링 확인:', hasAdminDashboard ? '✔ PASS' : '✖ FAIL');

  } finally {
    await browser.close();
    server.kill();
  }
}

testAdminLogin().catch(console.error);
