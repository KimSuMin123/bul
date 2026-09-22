import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'https://sehwa-buddha-academy.netlify.app';
const OUT_DIR = path.resolve('manual_assets');

const devices = [
  { name: 'pc', width: 1440, height: 900, isMobile: false, scale: 2 },
  { name: 'mobile_large', width: 430, height: 932, isMobile: true, scale: 2 }, // iPhone 14 Pro Max
  { name: 'mobile_small', width: 375, height: 667, isMobile: true, scale: 2 }   // iPhone SE
];

// Ensure output folders exist
['pc', 'mobile_large', 'mobile_small', 'modals'].forEach(sub => {
  const p = path.join(OUT_DIR, sub);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function captureDeviceScreens(browser, devConfig) {
  console.log(`\n========================================`);
  console.log(`📸 Capturing for Device: ${devConfig.name} (${devConfig.width}x${devConfig.height})`);
  console.log(`========================================`);

  const page = await browser.newPage();
  await page.setViewport({
    width: devConfig.width,
    height: devConfig.height,
    isMobile: devConfig.isMobile,
    hasTouch: devConfig.isMobile,
    deviceScaleFactor: devConfig.scale
  });

  const devDir = path.join(OUT_DIR, devConfig.name);

  try {
    // 1. Home Page (Hero)
    console.log('1. Home Page...');
    await page.goto(`${BASE_URL}/#home`, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(1200);
    await page.screenshot({ path: path.join(devDir, '01_home_hero.png'), fullPage: false });

    // 2. Home Courses Section
    const coursesEl = await page.$('.courses-grid') || await page.$('#courses');
    if (coursesEl) {
      await coursesEl.scrollIntoView();
      await delay(800);
      await page.screenshot({ path: path.join(devDir, '02_home_courses.png'), fullPage: false });
    }

    // 3. Home Features & Curriculum
    const featEl = await page.$('.features-grid') || await page.$('.curriculum-section');
    if (featEl) {
      await featEl.scrollIntoView();
      await delay(800);
      await page.screenshot({ path: path.join(devDir, '03_home_features.png'), fullPage: false });
    }

    // 4. Home Footer
    const footerEl = await page.$('footer');
    if (footerEl) {
      await footerEl.scrollIntoView();
      await delay(800);
      await page.screenshot({ path: path.join(devDir, '04_home_footer.png'), fullPage: false });
    }

    // 5. Register Page
    console.log('5. Register Page...');
    await page.goto(`${BASE_URL}/#register`, { waitUntil: 'networkidle2' });
    await delay(1000);
    await page.screenshot({ path: path.join(devDir, '05_register_page.png'), fullPage: false });

    // 6. Login Page & Password Reset Modal
    console.log('6. Login Page...');
    await page.goto(`${BASE_URL}/#login`, { waitUntil: 'networkidle2' });
    await delay(1000);
    await page.screenshot({ path: path.join(devDir, '06_login_page.png'), fullPage: false });

    // Click '비밀번호 찾기'
    const findPwBtn = await page.$('button::-p-text(비밀번호 찾기)') || await page.$('a::-p-text(비밀번호 찾기)');
    if (findPwBtn) {
      await findPwBtn.click();
      await delay(700);
      await page.screenshot({ path: path.join(devDir, '07_find_password_modal.png'), fullPage: false });
      // Close modal
      const closeBtn = await page.$('.modal-close-btn') || await page.$('button::-p-text(닫기)');
      if (closeBtn) await closeBtn.click();
      await delay(500);
    }

    // 7. Course Detail Page
    console.log('7. Course Detail Page...');
    await page.goto(`${BASE_URL}/#courseDetail?id=course-ritual-8-11`, { waitUntil: 'networkidle2' });
    await delay(1000);
    await page.screenshot({ path: path.join(devDir, '08_course_detail.png'), fullPage: false });

    // 8. Public Certificate Verification Portal
    console.log('8. Certificate Verification Portal (#verify)...');
    await page.goto(`${BASE_URL}/#verify`, { waitUntil: 'networkidle2' });
    await delay(1000);
    await page.screenshot({ path: path.join(devDir, '09_certificate_verify_page.png'), fullPage: false });

    // 9. Login as Admin to access Dashboard, Watch & Admin CMS
    console.log('9. Logging in as Admin...');
    await page.goto(`${BASE_URL}/#login`, { waitUntil: 'networkidle2' });
    await delay(800);

    const idInput = await page.$('input[placeholder*="아이디"]');
    const pwInput = await page.$('input[placeholder*="비밀번호"]');
    if (idInput && pwInput) {
      await idInput.click({ clickCount: 3 });
      await idInput.type('admin');
      await pwInput.click({ clickCount: 3 });
      await pwInput.type('admin1234');
      const loginBtn = await page.$('button[type="submit"]') || await page.$('button::-p-text(로그인)');
      if (loginBtn) await loginBtn.click();
      await delay(2000);
    }

    // 10. Dashboard (Student & Admin View)
    console.log('10. Dashboard Page...');
    await page.goto(`${BASE_URL}/#dashboard`, { waitUntil: 'networkidle2' });
    await delay(1200);
    await page.screenshot({ path: path.join(devDir, '10_dashboard_page.png'), fullPage: false });

    // 11. Video Watch Player Page
    console.log('11. Video Watch Page (#watch)...');
    await page.goto(`${BASE_URL}/#watch?id=lec-ritual-08-1`, { waitUntil: 'networkidle2' });
    await delay(1500);
    await page.screenshot({ path: path.join(devDir, '11_watch_video_player.png'), fullPage: false });

    // Q&A Tab on Watch Page
    const qaTabBtn = await page.$('button::-p-text(질의응답)') || await page.$('button::-p-text(Q&A)');
    if (qaTabBtn) {
      await qaTabBtn.click();
      await delay(800);
      await page.screenshot({ path: path.join(devDir, '12_watch_qa_board.png'), fullPage: false });
    }

    // 12. Admin CMS Tabs
    console.log('12. Admin CMS Tabs...');
    await page.goto(`${BASE_URL}/#admin`, { waitUntil: 'networkidle2' });
    await delay(1500);
    await page.screenshot({ path: path.join(devDir, '13_admin_students_tab.png'), fullPage: false });

    // Tab: Payment Ledger
    const payTab = await page.$('button::-p-text(대면 수납)') || await page.$('button::-p-text(수납)');
    if (payTab) {
      await payTab.click();
      await delay(800);
      await page.screenshot({ path: path.join(devDir, '14_admin_payment_ledger.png'), fullPage: false });
    }

    // Tab: CMS Courses & Lectures
    const cmsTab = await page.$('button::-p-text(강좌 및 차시)') || await page.$('button::-p-text(CMS)');
    if (cmsTab) {
      await cmsTab.click();
      await delay(800);
      await page.screenshot({ path: path.join(devDir, '15_admin_course_cms.png'), fullPage: false });
    }

    // Tab: Admin Q&A
    const adminQaTab = await page.$('button::-p-text(학습 질의응답)') || await page.$('button::-p-text(Q&A)');
    if (adminQaTab) {
      await adminQaTab.click();
      await delay(800);
      await page.screenshot({ path: path.join(devDir, '16_admin_qa_management.png'), fullPage: false });
    }

    // Tab: Certificates Management
    const certTab = await page.$('button::-p-text(수료증 발급)') || await page.$('button::-p-text(수료증)');
    if (certTab) {
      await certTab.click();
      await delay(800);
      await page.screenshot({ path: path.join(devDir, '17_admin_certificates_tab.png'), fullPage: false });
    }

  } catch (err) {
    console.error(`Error during capture for ${devConfig.name}:`, err);
  } finally {
    await page.close();
  }
}

async function captureAllModals(browser) {
  console.log(`\n========================================`);
  console.log(`🔔 Capturing All Modal Dialogs (Full Resolution)`);
  console.log(`========================================`);

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  const modalDir = path.join(OUT_DIR, 'modals');

  try {
    await page.goto(`${BASE_URL}/#home`, { waitUntil: 'networkidle2' });
    await delay(1000);

    // 1. Success Modal Alert
    console.log('1. Modal: Success Alert...');
    await page.evaluate(() => {
      window.__showModalAlert?.('수강 신청이 정상 접수되었습니다!\n\n현재 [대기상태 (대면 수납 대기)]로 등록되었습니다.\n교학처(010-4702-0283)에 방문하시어 수납을 완료하시면 [수강 중]으로 전환됩니다.', {
        title: '수강 신청 접수 완료',
        type: 'success'
      });
    });
    await delay(600);
    await page.screenshot({ path: path.join(modalDir, 'modal_01_success_apply.png') });
    await page.evaluate(() => window.__closeModalAlert?.());
    await delay(400);

    // 2. Warning Modal Alert (Sequential Lock)
    console.log('2. Modal: Warning Alert (Sequential Lock)...');
    await page.evaluate(() => {
      window.__showModalAlert?.('이전 차시를 100% 완강하셔야 다음 차시를 수강하실 수 있습니다.\n(단계별 순차 학습 원칙 적용)', {
        title: '순차 학습 잠금 안내',
        type: 'warning'
      });
    });
    await delay(600);
    await page.screenshot({ path: path.join(modalDir, 'modal_02_warning_lock.png') });
    await page.evaluate(() => window.__closeModalAlert?.());
    await delay(400);

    // 3. Info Modal Alert (Download notice)
    console.log('3. Modal: Info Alert (Download)...');
    await page.evaluate(() => {
      window.__showModalAlert?.('[제8강_불교의례실무교안.pdf] 교안 다운로드가 시작되었습니다.\n학습 참고용으로 활용하시기 바랍니다.', {
        title: '교안 다운로드 안내',
        type: 'info'
      });
    });
    await delay(600);
    await page.screenshot({ path: path.join(modalDir, 'modal_03_info_download.png') });
    await page.evaluate(() => window.__closeModalAlert?.());
    await delay(400);

    // 4. Error Modal Alert
    console.log('4. Modal: Error Alert...');
    await page.evaluate(() => {
      window.__showModalAlert?.('비밀번호가 일치하지 않습니다.\n입력하신 정보를 다시 확인해 주시기 바랍니다.', {
        title: '로그인 인증 오류',
        type: 'error'
      });
    });
    await delay(600);
    await page.screenshot({ path: path.join(modalDir, 'modal_04_error_alert.png') });
    await page.evaluate(() => window.__closeModalAlert?.());
    await delay(400);

    // 5. Confirm Dialog Modal
    console.log('5. Modal: Confirm Dialog...');
    await page.evaluate(() => {
      window.__showModalConfirm?.('[홍길동 (buddha-user)] 학인의 대면 수납을 승인하시겠습니까?\n\n• 수납 금액: 50,000원\n• 승인 즉시 장부에 등재되며, 학인의 상태가 [수강 중]으로 전환됩니다.', {
        title: '대면 수납 승인 확인',
        type: 'info',
        confirmText: '수납 승인',
        cancelText: '취소'
      });
    });
    await delay(600);
    await page.screenshot({ path: path.join(modalDir, 'modal_05_confirm_payment.png') });
    await page.evaluate(() => window.__closeModalAlert?.());
    await delay(400);

    // 6. Delete Confirm Dialog Modal
    console.log('6. Modal: Delete Confirm...');
    await page.evaluate(() => {
      window.__showModalConfirm?.('선택하신 강의 차시를 정말 삭제하시겠습니까?\n삭제된 영상 정보와 스트리밍 연결은 복구할 수 없습니다.', {
        title: '차시 영구 삭제 확인',
        type: 'warning',
        confirmText: '삭제'
      });
    });
    await delay(600);
    await page.screenshot({ path: path.join(modalDir, 'modal_06_confirm_delete.png') });
    await page.evaluate(() => window.__closeModalAlert?.());
    await delay(400);

    // 7. Login to trigger In-app Examination and Certificate Modals
    console.log('7. Logging in as Admin to capture Exam and Certificate Modals...');
    await page.goto(`${BASE_URL}/#login`, { waitUntil: 'networkidle2' });
    await delay(800);

    const idInput = await page.$('input[placeholder*="아이디"]');
    const pwInput = await page.$('input[placeholder*="비밀번호"]');
    if (idInput && pwInput) {
      await idInput.click({ clickCount: 3 });
      await idInput.type('admin');
      await pwInput.click({ clickCount: 3 });
      await pwInput.type('admin1234');
      const loginBtn = await page.$('button[type="submit"]') || await page.$('button::-p-text(로그인)');
      if (loginBtn) await loginBtn.click();
      await delay(2000);
    }

    // Go to #admin certificates tab to trigger Certificate Preview Modal
    await page.goto(`${BASE_URL}/#admin`, { waitUntil: 'networkidle2' });
    await delay(1200);

    // Switch to cert tab
    const certTab = await page.$('button::-p-text(수료증 발급)') || await page.$('button::-p-text(수료증)');
    if (certTab) {
      await certTab.click();
      await delay(1000);

      // Click '수료증 보기'
      const viewCertBtn = await page.$('button::-p-text(수료증 보기)') || await page.$('button::-p-text(보기)');
      if (viewCertBtn) {
        console.log('Capturing Certificate Modal...');
        await viewCertBtn.click();
        await delay(1000);
        await page.screenshot({ path: path.join(modalDir, 'modal_07_certificate_preview.png') });
        const closeCertBtn = await page.$('.cert-close-btn') || await page.$('button::-p-text(닫기)') || await page.$('.modal-close-btn');
        if (closeCertBtn) await closeCertBtn.click();
        await delay(500);
      }
    }

    // Switch to CMS tab and open '새 코스 개설' modal
    const cmsTab = await page.$('button::-p-text(강좌 및 차시)') || await page.$('button::-p-text(CMS)');
    if (cmsTab) {
      await cmsTab.click();
      await delay(800);
      const newCourseBtn = await page.$('button::-p-text(새 코스 개설)') || await page.$('button::-p-text(코스 개설)');
      if (newCourseBtn) {
        console.log('Capturing New Course Modal...');
        await newCourseBtn.click();
        await delay(800);
        await page.screenshot({ path: path.join(modalDir, 'modal_08_new_course_cms.png') });
        const closeBtn = await page.$('.modal-close-btn') || await page.$('button::-p-text(취소)');
        if (closeBtn) await closeBtn.click();
        await delay(500);
      }

      // Open '새 차시 등록' modal
      const newLecBtn = await page.$('button::-p-text(새 차시 등록)') || await page.$('button::-p-text(차시 등록)');
      if (newLecBtn) {
        console.log('Capturing New Lecture Modal...');
        await newLecBtn.click();
        await delay(800);
        await page.screenshot({ path: path.join(modalDir, 'modal_09_new_lecture_upload.png') });
        const closeBtn = await page.$('.modal-close-btn') || await page.$('button::-p-text(취소)');
        if (closeBtn) await closeBtn.click();
        await delay(500);
      }
    }

    // Switch to Students tab and open manual user register / pw reset modal
    const stuTab = await page.$('button::-p-text(수강생 관리)') || await page.$('button::-p-text(수강생)');
    if (stuTab) {
      await stuTab.click();
      await delay(800);
      const regUserBtn = await page.$('button::-p-text(신규 회원 직접 등록)') || await page.$('button::-p-text(회원 등록)');
      if (regUserBtn) {
        console.log('Capturing Admin Register User Modal...');
        await regUserBtn.click();
        await delay(800);
        await page.screenshot({ path: path.join(modalDir, 'modal_10_admin_register_user.png') });
        const closeBtn = await page.$('.modal-close-btn') || await page.$('button::-p-text(취소)');
        if (closeBtn) await closeBtn.click();
        await delay(500);
      }

      const resetPwBtn = await page.$('button::-p-text(비번 초기화)') || await page.$('button::-p-text(초기화)');
      if (resetPwBtn) {
        console.log('Capturing Admin Reset Password Modal...');
        await resetPwBtn.click();
        await delay(800);
        await page.screenshot({ path: path.join(modalDir, 'modal_11_admin_reset_password.png') });
        const closeBtn = await page.$('.modal-close-btn') || await page.$('button::-p-text(취소)');
        if (closeBtn) await closeBtn.click();
        await delay(500);
      }
    }

  } catch (err) {
    console.error('Error during modal captures:', err);
  } finally {
    await page.close();
  }
}

async function main() {
  console.log('Launching Chrome for Full Manual Assets Capture...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  try {
    for (const dev of devices) {
      await captureDeviceScreens(browser, dev);
    }
    await captureAllModals(browser);
    console.log('\n🎉 ALL ASSETS CAPTURED SUCCESSFULLY!');
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
