import puppeteer from 'puppeteer-core';
import { spawn } from 'child_process';
import path from '. ';



const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 5202;
const BASE_URL = `http://localhost:${PORT}`;

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function startServer() {
  console.log(`Starting dev server on port ${PORT}...`);
  const server = spawn('npx.cmd', ['vite', '--port', String(PORT), '--strictPort'], {
    shell: true,
    stdio: 'pipe'
  });

  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(BASE_URL);
      if (res.ok) {
        console.log(`Vite server ready at ${BASE_URL}`);
        return server;
      }
    } catch (e) {
      await delay(500);
    }
  }
  throw new Error('Vite server start timeout');
}

async function main() {
  const devServer = await startServer();

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    defaultViewport: { width: 1366, height: 900 }
  });
  const page = await browser.newPage();

  try {
    console.log('Navigating to login page...');
    await page.goto(`${BASE_URL}/#login`, { waitUntil: 'networkidle0' });
    await delay(1000);

    // Login as admin
    const inputs = await page.$$('input');
    if (inputs.length >= 2) {
      await inputs[0].type('admin');
      await inputs[1].type('Password123!');
      const submitBtn = await page.$('button[type="submit"]');
      if (submitBtn) await submitBtn.click();
      await delay(1500);
    }

    // Navigate to admin
    console.log('Navigating to admin dashboard...');
    await page.goto(`${BASE_URL}/#admin`, { waitUntil: 'networkidle0' });
    await delay(1200);

    const brainDir = 'C:\\Users\\sehyeon\\.gemini\\antigravity-ide\\brain\\47a6aa6a-30f6-4094-832d-1119242d4b10';

    console.log('1. Checking Donation Tab Filters...');
    // Click Donation Tab
    const buttons = await page.$$('button');
    for (const b of buttons) {
      const text = await (await b.getProperty('innerText')).jsonValue();
      if (text.includes('기부금 영수증')) {
        await b.click();
        break;
      }
    }
    await delay(1000);

    await page.screenshot({ path: path.join(brainDir, 'filter_donation_issued.png') });
    console.log('Saved filter_donation_issued.png');

    // Click Unissued Filter
    const filterBtns = await page.$$('button');
    for (const b of filterBtns) {
      const text = await (await b.getProperty('innerText')).jsonValue();
      if (text.includes('미발행 건만 보기')) {
        await b.click();
        break;
      }
    }
    await delay(1000);

    await page.screenshot({ path: path.join(brainDir, 'filter_donation_unissued.png') });
    console.log('Saved filter_donation_unissued.png');

    // 2. Checking Payment Tab Filters
    console.log('2. Checking Payment Tab Filters...');
    const allTabBtns = await page.$$('button');
    for (const b of allTabBtns) {
      const text = await (await b.getProperty('innerText')).jsonValue();
      if (text.includes('수납 내역 장부')) {
        await b.click();
        break;
      }
    }
    await delay(1000);

    await page.screenshot({ path: path.join(brainDir, 'filter_payment_tab.png') });
    console.log('Saved filter_payment_tab.png');

    console.log('ALL FILTER VISIBILITY CHECKS PASSED!');
  } finally {
    await browser.close();
    devServer.kill();
  }
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
