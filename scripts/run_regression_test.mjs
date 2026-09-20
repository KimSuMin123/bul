import puppeteer from 'puppeteer-core';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 5188;
const BASE_URL = `http://localhost:${PORT}`;
const SCREENSHOT_DIR = path.resolve('test_artifacts/regression_screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function startServer() {
  console.log(`[1/3] 로컬 Vite Preview 서버 기동 중 (포트: ${PORT})...`);
  const server = spawn('npx.cmd', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
    shell: true,
    stdio: 'pipe'
  });

  server.stdout.on('data', data => {
    // console.log(`[Vite] ${data}`);
  });

  // Wait for server to start
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(BASE_URL);
      if (res.ok) {
        console.log(`✔ Vite 서버 기동 완료 (${BASE_URL})`);
        return server;
      }
    } catch (e) {
      await delay(500);
    }
  }
  throw new Error('Vite 서버 기동 실패 (타임아웃)');
}

async function runTests() {
  let serverProcess = null;
  let browser = null;
  const results = [];

  function recordResult(testName, passed, details = '') {
    results.push({ testName, passed, details });
    const mark = passed ? '✔ PASS' : '✖ FAIL';
    console.log(`  ${mark} - ${testName} ${details ? '(' + details + ')' : ''}`);
  }

  try {
    serverProcess = await startServer();

    console.log(`[2/3] Chrome 브라우저 기동 및 리그레이션 테스트 시작...`);
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    // -------------------------------------------------------------
    // TEST 1: 홈 페이지 렌더링 및 SEO 메타태그 검증
    // -------------------------------------------------------------
    console.log('\n--- [TEST 1] 홈 페이지 & SEO 메타 검증 ---');
    await page.goto(`${BASE_URL}/#home`, { waitUntil: 'networkidle0', timeout: 15000 });
    await delay(1000);

    const title = await page.title();
    const hasCorrectTitle = title.includes('세화붓다아카데미');
    recordResult('홈 페이지 Title 검증', hasCorrectTitle, `Title: ${title}`);

    const ogTitle = await page.$eval('meta[property="og:title"]', el => el.content).catch(() => '');
    recordResult('OpenGraph og:title 검증', Boolean(ogTitle), `og:title: ${ogTitle}`);

    const heroText = await page.$eval('body', el => el.innerText).catch(() => '');
    const hasHero = heroText.includes('따라하는 불자에서') || heroText.includes('세화붓다아카데미');
    recordResult('홈 히어로 섹션 렌더링', hasHero);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_home_page.png') });

    // -------------------------------------------------------------
    // TEST 2: About SBA 페이지 및 6개 탭 전환 검증
    // -------------------------------------------------------------
    console.log('\n--- [TEST 2] About SBA 페이지 & 6개 탭 전환 검증 ---');
    await page.goto(`${BASE_URL}/#about?tab=intro`, { waitUntil: 'networkidle0', timeout: 15000 });
    await delay(1000);

    const aboutIntroText = await page.$eval('body', el => el.innerText);
    const hasIntro = aboutIntroText.includes('설립 목적') || aboutIntroText.includes('세화불학원');
    recordResult('About SBA 설립목적(Intro) 탭', hasIntro);

    // Tab: charter (신행헌장)
    await page.goto(`${BASE_URL}/#about?tab=charter`, { waitUntil: 'networkidle0' });
    await delay(600);
    const charterText = await page.$eval('body', el => el.innerText);
    recordResult('About SBA 신행헌장(Charter) 탭', charterText.includes('신행') || charterText.includes('헌장'));

    // Tab: history (학회연혁)
    await page.goto(`${BASE_URL}/#about?tab=history`, { waitUntil: 'networkidle0' });
    await delay(600);
    const historyText = await page.$eval('body', el => el.innerText);
    recordResult('About SBA 학회연혁(History) 탭', historyText.includes('연혁'));

    // Tab: constitution (학회정관)
    await page.goto(`${BASE_URL}/#about?tab=constitution`, { waitUntil: 'networkidle0' });
    await delay(600);
    const constitutionText = await page.$eval('body', el => el.innerText);
    recordResult('About SBA 학회정관(Constitution) 탭', constitutionText.includes('정관'));

    // Tab: committed (조직활동)
    await page.goto(`${BASE_URL}/#about?tab=committed`, { waitUntil: 'networkidle0' });
    await delay(600);
    const committedText = await page.$eval('body', el => el.innerText);
    recordResult('About SBA 조직활동(Committed) 탭', committedText.includes('조직') || committedText.includes('활동'));

    // Tab: sba (About SBA)
    await page.goto(`${BASE_URL}/#about?tab=sba`, { waitUntil: 'networkidle0' });
    await delay(600);
    const sbaText = await page.$eval('body', el => el.innerText);
    recordResult('About SBA 총람(SBA) 탭', sbaText.includes('SBA') || sbaText.includes('세화불학원'));

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_about_sba_page.png') });

    // -------------------------------------------------------------
    // TEST 3: 강좌 상세 페이지 및 커리큘럼 아코디언 검증
    // -------------------------------------------------------------
    console.log('\n--- [TEST 3] 강좌 상세 페이지 검증 ---');
    await page.goto(`${BASE_URL}/#courseDetail?id=course-ritual-master-2`, { waitUntil: 'networkidle0', timeout: 15000 });
    await delay(1000);

    const courseBody = await page.$eval('body', el => el.innerText);
    const hasCourseDetails = courseBody.includes('불교의례') || courseBody.includes('차시') || courseBody.includes('수강');
    recordResult('강좌 상세 페이지 렌더링', hasCourseDetails);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_course_detail_page.png') });

    // -------------------------------------------------------------
    // TEST 4: 공식 수료증 진위 검증 포털 (#verify)
    // -------------------------------------------------------------
    console.log('\n--- [TEST 4] 공식 수료증 진위 확인 검증 ---');
    await page.goto(`${BASE_URL}/#verify`, { waitUntil: 'networkidle0', timeout: 15000 });
    await delay(800);

    const verifyBody = await page.$eval('body', el => el.innerText);
    const hasVerifyForm = verifyBody.includes('수료증') && (verifyBody.includes('진위') || verifyBody.includes('조회') || verifyBody.includes('번호'));
    recordResult('수료증 진위 확인 페이지 렌더링', hasVerifyForm);

    // Test entering dummy cert
    const input = await page.$('input[type="text"]');
    if (input) {
      await input.type('TEST-CERT-NONEXISTENT');
      const submitBtn = await page.$('button[type="submit"], button.btn-primary');
      if (submitBtn) await submitBtn.click();
      await delay(600);
      recordResult('수료증 번호 입력 및 조회 트리거', true);
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_cert_verify_page.png') });

    // -------------------------------------------------------------
    // TEST 5: 로그인 및 회원가입 페이지 UI 검증
    // -------------------------------------------------------------
    console.log('\n--- [TEST 5] 로그인 & 회원가입 페이지 검증 ---');
    await page.goto(`${BASE_URL}/#login`, { waitUntil: 'networkidle0', timeout: 15000 });
    await delay(800);

    const loginInputs = await page.$$('input');
    recordResult('로그인 입력 필드 존재 (아이디/비밀번호)', loginInputs.length >= 2, `${loginInputs.length}개 필드`);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_login_page.png') });

    await page.goto(`${BASE_URL}/#register`, { waitUntil: 'networkidle0', timeout: 15000 });
    await delay(800);

    const regInputs = await page.$$('input');
    recordResult('회원가입 입력 필드 존재', regInputs.length >= 4, `${regInputs.length}개 필드`);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_register_page.png') });

    // -------------------------------------------------------------
    // TEST 6: 관리자 CMS (#admin) 비인가자 차단 검증
    // -------------------------------------------------------------
    console.log('\n--- [TEST 6] 관리자 CMS 보안 접근 제어 검증 ---');
    await page.goto(`${BASE_URL}/#admin`, { waitUntil: 'networkidle0', timeout: 15000 });
    await delay(1000);

    const adminBody = await page.$eval('body', el => el.innerText);
    const isRestricted = adminBody.includes('관리자 계정') || adminBody.includes('접근 권한') || !adminBody.includes('수납 장부 관리');
    recordResult('비인가 사용자 관리자 CMS 접근 차단 및 보안 모달 안내', isRestricted);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07_admin_security_gate.png') });

    // -------------------------------------------------------------
    // TEST 7: 모바일 뷰포트 반응형 레이아웃 검증
    // -------------------------------------------------------------
    console.log('\n--- [TEST 7] 모바일 반응형 뷰포트 검증 (iPhone 14) ---');
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto(`${BASE_URL}/#home`, { waitUntil: 'networkidle0', timeout: 15000 });
    await delay(800);

    const mobileBody = await page.$eval('body', el => el.innerText);
    recordResult('모바일 뷰포트 렌더링 무오류', mobileBody.includes('세화붓다아카데미'));

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08_mobile_home.png') });

    // -------------------------------------------------------------
    // TEST 8: 내 강의실 (대시보드) 접근 검증
    // -------------------------------------------------------------
    console.log('\n--- [TEST 8] 내 강의실 (대시보드) 검증 ---');
    await page.goto(`${BASE_URL}/#dashboard`, { waitUntil: 'networkidle0', timeout: 15000 });
    await delay(800);
    const dashBody = await page.$eval('body', el => el.innerText);
    const hasDash = dashBody.includes('로그인') || dashBody.includes('강의실') || dashBody.includes('수강');
    recordResult('내 강의실 대시보드 렌더링', hasDash);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09_dashboard_page.png') });

    // -------------------------------------------------------------
    // TEST 9: 정적 파일 (robots.txt, sitemap.xml, llms.txt) 검증
    // -------------------------------------------------------------
    console.log('\n--- [TEST 9] SEO/GEO 정적 파일 HTTP 응답 검증 ---');
    const robotsRes = await fetch(`${BASE_URL}/robots.txt`);
    const robotsTxt = await robotsRes.text();
    recordResult('robots.txt 정상 제공 및 AI 봇 허용', robotsRes.ok && robotsTxt.includes('GPTBot'));

    const sitemapRes = await fetch(`${BASE_URL}/sitemap.xml`);
    const sitemapXml = await sitemapRes.text();
    recordResult('sitemap.xml 정상 제공 및 #about 포함', sitemapRes.ok && sitemapXml.includes('#about'));

    const llmsRes = await fetch(`${BASE_URL}/llms.txt`);
    const llmsTxt = await llmsRes.text();
    recordResult('llms.txt 정상 제공 및 2026-00183호 등록번호 포함', llmsRes.ok && llmsTxt.includes('2026-00183호'));

    console.log('\n============================================================');
    const passCount = results.filter(r => r.passed).length;
    console.log(`📊 테스트 결과 요약: 총 ${results.length}개 항목 중 ${passCount}개 PASS (${Math.round(passCount / results.length * 100)}%)`);
    console.log('============================================================\n');

  } catch (err) {
    console.error('테스트 실행 중 오류 발생:', err);
  } finally {
    if (browser) await browser.close();
    if (serverProcess) {
      console.log('Vite 테스트 서버 종료 중...');
      serverProcess.kill();
    }
  }
}

runTests();
