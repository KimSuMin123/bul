import puppeteer from 'puppeteer-core';
import { spawn } from 'child_process';

const delay = ms => new Promise(r => setTimeout(r, ms));
const PORT = 5198;
const BASE_URL = `http://localhost:${PORT}`;
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function testRegister() {
  console.log('1. Vite Preview 서버 기동 중...');
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
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

    await page.setViewport({ width: 1280, height: 900 });

    console.log('2. 회원가입 페이지 이동...');
    await page.goto(`${BASE_URL}/#register`, { waitUntil: 'networkidle0' });
    await delay(600);

    const testId = `user${Date.now().toString().slice(-6)}`;
    console.log(`3. 테스트 회원 정보 입력 (ID: ${testId})...`);

    // Focus and type into inputs
    const inputs = await page.$$('input');
    console.log('Found inputs count:', inputs.length);
    for (let i = 0; i < inputs.length; i++) {
      const name = await inputs[i].evaluate(el => el.name);
      console.log(`Input ${i} name:`, name);
    }

    await page.type('input[name="id"]', testId);
    
    // Click ID check button
    const buttons = await page.$$('button');
    for (const b of buttons) {
      const txt = await b.evaluate(el => el.innerText);
      if (txt.includes('중복확인')) {
        await b.click();
        console.log('Clicked 중복확인');
        break;
      }
    }
    await delay(800);

    await page.type('input[name="password"]', 'Pass1234!@#');
    await page.type('input[name="confirmPassword"]', 'Pass1234!@#');
    await page.type('input[name="name"]', '홍길동');
    await page.type('input[name="birthDate"]', '1990-05-15');
    const randomPhone = `010-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`;
    await page.type('input[name="phone"]', randomPhone);

    console.log('4. 회원가입 완료 버튼 클릭...');
    await page.click('button[type="submit"]');
    await delay(2500);

    const bodyText = await page.$eval('body', el => el.innerText);
    console.log('--- Page text preview ---');
    console.log(bodyText.substring(0, 500));
  } finally {
    await browser.close();
    server.kill();
    process.exit(0);
  }
}

testRegister().catch(e => {
  console.error(e);
  process.exit(1);
});
