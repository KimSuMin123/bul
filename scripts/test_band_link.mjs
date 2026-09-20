import puppeteer from 'puppeteer-core';
import { spawn } from 'child_process';

const delay = ms => new Promise(r => setTimeout(r, ms));
const PORT = 5192;
const BASE_URL = `http://localhost:${PORT}`;
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function testBand() {
  console.log('1. Vite Preview 서버 기동...');
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT)], {
    shell: true,
    stdio: 'ignore'
  });
  await delay(1500);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    console.log('2. 홈페이지 접속...');
    await page.goto(`${BASE_URL}/#home`, { waitUntil: 'networkidle0' });
    await delay(600);

    // Mock window.open to test link target
    await page.evaluate(() => {
      window.__openedUrls = [];
      window.open = (url) => {
        window.__openedUrls.push(url);
      };
    });

    console.log('3. About SBA 드롭다운 호버...');
    const aboutBtn = await page.$('nav.desktop-nav-menu button');
    await aboutBtn.hover();
    await delay(400);

    // Find Band 바로가기 button
    console.log('4. Band 바로가기 드롭다운 버튼 클릭...');
    const bandDropdownBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('nav.desktop-nav-menu button'));
      const b = btns.find(btn => btn.innerText.includes('Band 바로가기'));
      if (b) {
        b.click();
        return true;
      }
      return false;
    });

    await delay(300);

    const openedUrls = await page.evaluate(() => window.__openedUrls);
    console.log('호출된 URL:', openedUrls);

    const isBandUrl = openedUrls.includes('https://band.us/n/a7a2b3X7k88dC');
    console.log('Band 링크 트리거 검증:', isBandUrl ? '✔ PASS' : '✖ FAIL');

    // Test mobile drawer
    console.log('5. 모바일 뷰포트에서 Band 링크 확인...');
    await page.setViewport({ width: 390, height: 844 });
    const mobileMenuBtn = await page.$('button[aria-label="메뉴 열기"]');
    if (mobileMenuBtn) {
      await mobileMenuBtn.click();
      await delay(400);

      const hasMobileBand = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        return btns.some(b => b.innerText.includes('Band 바로가기'));
      });
      console.log('모바일 메뉴 내 Band 바로가기 표시:', hasMobileBand ? '✔ PASS' : '✖ FAIL');
    }

    if (isBandUrl) {
      console.log('🎉 Band 바로가기 링크 연동 100% 성공!');
    }
  } finally {
    await browser.close();
    server.kill();
    process.exit(0);
  }
}

testBand().catch(e => {
  console.error(e);
  process.exit(1);
});
