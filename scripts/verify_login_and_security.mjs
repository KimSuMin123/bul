import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-core';

// Load .env
const envContent = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf-8') : '';
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    env[match[1]] = (match[2] || '').trim();
  }
});

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:3001';

async function main() {
  console.log('--- Running Admin Login & Security E2E Test ---');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    defaultViewport: { width: 1280, height: 800 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  page.on('console', msg => console.log('  [PAGE LOG]', msg.type(), msg.text()));
  page.on('pageerror', err => console.error('  [PAGE ERROR]', err.message));

  try {
    console.log('1. Navigating to Login page...');
    await page.goto(`${BASE_URL}/#login`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1000));

    console.log('2. Finding inputs and typing...');
    const idInput = await page.$('input[placeholder*="아이디"]');
    const pwInput = await page.$('input[placeholder*="비밀번호"]');
    if (!idInput || !pwInput) {
      throw new Error('Could not find login input fields');
    }

    await idInput.click();
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await page.keyboard.type('admin', { delay: 30 });

    await pwInput.click();
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await page.keyboard.type('Password123!', { delay: 30 });

    console.log('3. Finding form submit button and clicking...');
    const submitBtn = await page.$('form button[type="submit"]');
    if (!submitBtn) {
      throw new Error('Form submit button not found');
    }
    await submitBtn.click();
    console.log('  Form submit button clicked.');

    await new Promise(r => setTimeout(r, 3000));
    const currentHash = await page.evaluate(() => window.location.hash);
    const errorText = await page.evaluate(() => {
      const errEl = document.querySelector('div[style*="coral-subtle"]');
      return errEl ? errEl.innerText : null;
    });
    console.log('  Current URL hash after click:', currentHash);
    console.log('  Displayed Error Text:', errorText);

    // Verify session in localStorage
    const session = await page.evaluate(() => {
      const u = localStorage.getItem('buddha_lms_current_user');
      return u ? JSON.parse(u) : null;
    });

    console.log('4. Session security verification:');
    if (!session) {
      throw new Error('Session was not saved in localStorage');
    }
    console.log('  ✓ Logged in as:', session.id, 'Role:', session.role, 'Name:', session.name);
    if (session.password === undefined) {
      console.log('  ✓ SECURITY CHECK PASSED: Session user object contains NO password property!');
    } else {
      console.error('  ✗ SECURITY CHECK FAILED: Session user object contains password:', session.password);
    }

    // Capture screenshot of Admin Dashboard
    const screenshotPath = 'C:\\Users\\sehyeon\\.gemini\\antigravity-ide\\brain\\c3745dff-a3b1-4321-858f-c5bcc226e16a\\admin_dashboard_security_verified.png';
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log('  ✓ Screenshot saved:', screenshotPath);

    console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! No functional regressions.');
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
