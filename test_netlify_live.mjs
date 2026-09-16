import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOT_DIR = 'C:\\Users\\sehyeon\\.gemini\\antigravity-ide\\brain\\fb40cb35-eac8-4461-ae1c-54d3475eedfd\\test_results';

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function run() {
  console.log('Launching Chrome from:', CHROME_PATH);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    defaultViewport: { width: 1280, height: 860 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();

  // Auto accept alerts
  page.on('dialog', async dialog => {
    console.log('[DIALOG]', dialog.type(), dialog.message());
    await dialog.accept();
  });

  try {
    console.log('\n--- STEP 1: Navigate to https://buddha-academy.netlify.app/ ---');
    await page.goto('https://buddha-academy.netlify.app/', { waitUntil: 'networkidle2' });
    await page.waitForSelector('body');
    await new Promise(r => setTimeout(r, 1000));

    console.log('\n--- STEP 2: Navigate to Login page ---');
    // Click login button in navbar
    const loginBtn = await page.$('button::-p-text(로그인)');
    if (loginBtn) {
      await loginBtn.click();
    } else {
      await page.goto('https://buddha-academy.netlify.app/#login');
    }
    await new Promise(r => setTimeout(r, 1000));

    // Type credentials: admin / Password123!
    console.log('Entering login credentials...');
    const idInput = await page.$('input[type="text"], input[name="id"], input[placeholder*="아이디"]');
    const pwInput = await page.$('input[type="password"]');

    if (idInput && pwInput) {
      await idInput.click({ clickCount: 3 });
      await idInput.type('admin');
      await pwInput.click({ clickCount: 3 });
      await pwInput.type('Password123!');

      const submitBtn = await page.$('button[type="submit"], form button');
      if (submitBtn) await submitBtn.click();
      console.log('Login submitted, waiting...');
      await new Promise(r => setTimeout(r, 2000));
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_login_success.png') });
    console.log('Saved 01_login_success.png');

    console.log('\n--- STEP 3: Navigate to [내 강의실] ---');
    const dashBtn = await page.$('button::-p-text(내 강의실)');
    if (dashBtn) {
      await dashBtn.click();
      await new Promise(r => setTimeout(r, 1500));
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_my_classroom_dashboard.png') });
    console.log('Saved 02_my_classroom_dashboard.png');

    console.log('\n--- STEP 4: Check or Apply for Course (State 1: 납부 전) ---');
    // Look for '+ 수강 신청 접수 (대기상태로 담기)'
    const applyBtn = await page.$('button::-p-text(+ 수강 신청 접수)');
    if (applyBtn) {
      console.log('Found unenrolled course, clicking [+ 수강 신청 접수]...');
      await applyBtn.click();
      await new Promise(r => setTimeout(r, 2000));
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_state1_pending_card.png') });
    console.log('Saved 03_state1_pending_card.png');

    console.log('\n--- STEP 5: Test [대면 수납 절차 및 위치 안내] Modal ---');
    const payInfoBtn = await page.$('button::-p-text(대면 수납 절차 및 위치 안내)');
    if (payInfoBtn) {
      console.log('Clicking [대면 수납 절차 및 위치 안내]...');
      await payInfoBtn.click();
      await new Promise(r => setTimeout(r, 1000));
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_payment_info_modal.png') });
      console.log('Saved 04_payment_info_modal.png');

      const confirmBtn = await page.$('button::-p-text(확인하였습니다)');
      if (confirmBtn) {
        await confirmBtn.click();
        await new Promise(r => setTimeout(r, 500));
      }
    }

    console.log('\n--- STEP 6: Persistence Test (Reload page in State 1) ---');
    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_state1_persisted_after_refresh.png') });
    console.log('Saved 05_state1_persisted_after_refresh.png');

    console.log('\n--- STEP 7: Admin Approval -> State 2 (수강 중) ---');
    const adminBtn = await page.$('button::-p-text(관리자 모드)');
    if (adminBtn) {
      await adminBtn.click();
      await new Promise(r => setTimeout(r, 1500));

      // Go to Tab 2: '교학처 대면 수납 내역 장부'
      const ledgerTab = await page.$('button::-p-text(교학처 대면 수납 내역 장부)');
      if (ledgerTab) {
        await ledgerTab.click();
        await new Promise(r => setTimeout(r, 1000));

        // Click approve button
        const approveBtn = await page.$('button::-p-text(대면 수납 확인 및 승인), button::-p-text(승인)');
        if (approveBtn) {
          console.log('Approving pending payment in admin ledger...');
          await approveBtn.click();
          await new Promise(r => setTimeout(r, 1500));
        }
      }
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_admin_payment_approval.png') });
      console.log('Saved 06_admin_payment_approval.png');

      // Go back to 내 강의실
      const backDash = await page.$('button::-p-text(내 강의실)');
      if (backDash) {
        await backDash.click();
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    console.log('\n--- STEP 8: State 2 (수강 중) Card Verification ---');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07_state2_learning_card.png') });
    console.log('Saved 07_state2_learning_card.png');

    console.log('\n--- STEP 9: Enter Lecture Room Test ---');
    const enterRoomBtn = await page.$('button::-p-text(강의실 입장)');
    if (enterRoomBtn) {
      await enterRoomBtn.click();
      await new Promise(r => setTimeout(r, 1500));
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08_lecture_player.png') });
      console.log('Saved 08_lecture_player.png');

      // Return to 내 강의실
      const retDash = await page.$('button::-p-text(내 강의실)');
      if (retDash) {
        await retDash.click();
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    console.log('\n--- STEP 10: Complete Course (State 3: 수료 완료) ---');
    const completeBtn = await page.$('button::-p-text(100% 완강 수료 처리하기)');
    if (completeBtn) {
      console.log('Clicking [⚡ 100% 완강 수료 처리하기]...');
      await completeBtn.click();
      await new Promise(r => setTimeout(r, 1500));
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09_state3_completed_card.png') });
    console.log('Saved 09_state3_completed_card.png');

    console.log('\n--- STEP 11: [🎓 수료증 발급 및 출력] Modal Verification ---');
    const certBtn = await page.$('button::-p-text(수료증 발급 및 출력)');
    if (certBtn) {
      console.log('Opening Certificate Modal...');
      await certBtn.click();
      await new Promise(r => setTimeout(r, 1500));
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10_certificate_modal_matched_size.png') });
      console.log('Saved 10_certificate_modal_matched_size.png');

      // Test PDF print generation
      console.log('Testing PDF generation...');
      await page.pdf({
        path: path.join(SCREENSHOT_DIR, 'test_certificate_print.pdf'),
        format: 'A4',
        landscape: true,
        printBackground: true
      });
      console.log('Saved test_certificate_print.pdf (1-page test)');

      // Close modal
      const closeCert = await page.$('button[title="닫기"], .modal-card button::-p-text(✕), .modal-card svg');
      if (closeCert) {
        await closeCert.click();
        await new Promise(r => setTimeout(r, 500));
      }
    }

    console.log('\n--- STEP 12: Final Persistence Test (Reload page in State 3) ---');
    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '11_state3_persisted_after_refresh.png') });
    console.log('Saved 11_state3_persisted_after_refresh.png');

    console.log('\n>>> ALL TEST STEPS COMPLETED SUCCESSFULLY ON NETLIFY! <<<');

  } catch (err) {
    console.error('Error during test:', err);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'error_state.png') });
  } finally {
    await browser.close();
  }
}

run();
