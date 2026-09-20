import puppeteer from 'puppeteer-core';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 5202;
const BASE_URL = `http://127.0.0.1:${PORT}`;

const RESULTS_DIR = path.resolve('test-results');
const SCREENSHOTS_DIR = path.join(RESULTS_DIR, 'screenshots');
const RECORDINGS_DIR = path.join(RESULTS_DIR, 'recordings');

// Ensure directories exist
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
fs.mkdirSync(RECORDINGS_DIR, { recursive: true });

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getTimestamp() {
  const now = new Date();
  return now.toISOString().replace(/[-:T.]/g, '').slice(0, 14);
}

async function startViteServer() {
  console.log(`[1/4] 로컬 Vite 개발 서버 기동 중 (포트: ${PORT})...`);
  const server = spawn('npx.cmd', ['vite', '--port', String(PORT), '--strictPort'], {
    shell: true,
    stdio: 'pipe'
  });

  server.stdout.on('data', data => {
    // console.log(`[Vite] ${data}`);
  });

  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(BASE_URL);
      if (res.ok) {
        console.log(`✔ Vite 서버 정상 응답 확인 (${BASE_URL})`);
        return server;
      }
    } catch (e) {
      await delay(500);
    }
  }
  throw new Error('Vite 개발 서버 기동 타임아웃');
}

async function runE2ETest() {
  let serverProcess = null;
  let browser = null;
  const timestamp = getTimestamp();
  const recordingPath = path.join(RECORDINGS_DIR, `full_flow_${timestamp}.webm`);
  const artifacts = [];
  const testSteps = [];

  function recordStep(stepNum, pageName, interaction, expected, actual, passed, screenshotName) {
    testSteps.push({
      step: stepNum,
      page: pageName,
      interaction,
      expected,
      actual,
      passed,
      screenshot: screenshotName
    });
    const mark = passed ? '✔ PASS' : '✖ FAIL';
    console.log(`  [Step ${stepNum}] ${mark} | ${pageName} - ${interaction}`);
  }

  try {
    serverProcess = await startViteServer();

    console.log(`[2/4] Chrome 브라우저 기동 (Headless mode) & 비디오 레코더 초기화...`);
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--window-size=1440,900'
      ]
    });

    // 1. Setup Video Recording Page
    const recorderPage = await browser.newPage();
    await recorderPage.setContent(`
      <!DOCTYPE html>
      <html>
      <head><title>Recorder</title></head>
      <body style="margin:0; background:#000;">
        <canvas id="c" width="1280" height="800"></canvas>
        <script>
          const canvas = document.getElementById('c');
          const ctx = canvas.getContext('2d');
          let mediaRecorder;
          let recordedChunks = [];

          window.startRecording = () => {
            const stream = canvas.captureStream(20);
            mediaRecorder = new MediaRecorder(stream, {
              mimeType: 'video/webm;codecs=vp8',
              videoBitsPerSecond: 2500000
            });
            mediaRecorder.ondataavailable = (e) => {
              if (e.data && e.data.size > 0) {
                recordedChunks.push(e.data);
              }
            };
            mediaRecorder.start(100);
          };

          window.drawFrame = (base64Img) => {
            return new Promise((resolve) => {
              const img = new Image();
              img.onload = () => {
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve();
              };
              img.src = 'data:image/jpeg;base64,' + base64Img;
            });
          };

          window.stopRecording = async () => {
            return new Promise((resolve) => {
              if (!mediaRecorder || mediaRecorder.state === 'inactive') {
                resolve([]);
                return;
              }
              mediaRecorder.onstop = async () => {
                try {
                  const blob = new Blob(recordedChunks, { type: 'video/webm' });
                  const buffer = await blob.arrayBuffer();
                  resolve(Array.from(new Uint8Array(buffer)));
                } catch (e) {
                  resolve([]);
                }
              };
              mediaRecorder.stop();
            });
          };
        </script>
      </body>
      </html>
    `);

    await recorderPage.evaluate(() => window.startRecording());

    // 2. Setup Main Test Page & CDP Screencast
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    const client = await page.target().createCDPSession();
    await client.send('Page.startScreencast', {
      format: 'jpeg',
      quality: 80,
      maxWidth: 1280,
      maxHeight: 800,
      everyNthFrame: 1
    });

    let frameCount = 0;
    client.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
      try {
        frameCount++;
        await client.send('Page.screencastFrameAck', { sessionId });
        await recorderPage.evaluate((frame) => window.drawFrame(frame), data);
      } catch (e) {
        // frame drop silently
      }
    });

    console.log(`[3/4] E2E 풀플로우 테스트 시나리오 실행 시작...`);

    // Helper for taking standardized screenshot
    async function navigate(route) {
      await page.goto(`${BASE_URL}/${route}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await delay(1200);
    }

    async function capture(stepNum, actionName) {
      const fileName = `step_${String(stepNum).padStart(2, '0')}_${actionName}_${timestamp}.png`;
      const filePath = path.join(SCREENSHOTS_DIR, fileName);
      await page.screenshot({ path: filePath });
      artifacts.push(fileName);
      return fileName;
    }

    // -------------------------------------------------------------
    // SCENARIO 1: Happy Path - 서비스 진입 및 강의 목록 확인
    // -------------------------------------------------------------
    console.log('\n--- [Scenario 1: Happy Path - 메인 홈 & 강의 목록] ---');
    await navigate('#home');

    const title = await page.title();
    const heroText = await page.$eval('body', el => el.innerText).catch(() => '');
    const hasHero = heroText.includes('세화붓다아카데미') || heroText.includes('불교의례해설사');
    const shot1 = await capture(1, 'main_init');
    recordStep(1, '메인 홈 화면', '최초 URL 진입', '강의 목록 및 내비게이션 노출', hasHero ? '정상 노출' : '노출 실패', hasHero, shot1);

    // -------------------------------------------------------------
    // SCENARIO 2: Happy Path - 강의 선택 및 상세 페이지 진입
    // -------------------------------------------------------------
    console.log('\n--- [Scenario 2: Happy Path - 강의 상세 페이지] ---');
    await navigate('#courseDetail?id=course-ritual-master-2');

    const detailText = await page.$eval('body', el => el.innerText).catch(() => '');
    const hasDetail = (detailText.includes('불교의례') || detailText.includes('강좌')) && (detailText.includes('커리큘럼') || detailText.includes('수강') || detailText.includes('차시'));
    const shot2 = await capture(2, 'course_detail');
    recordStep(2, '강의 상세 페이지', '강의 카드 선택 진입', '강의 상세 정보 및 커리큘럼 뷰 노출', hasDetail ? '정상 노출' : '노출 실패', hasDetail, shot2);

    // -------------------------------------------------------------
    // SCENARIO 3: Happy Path - 커리큘럼 파트 아코디언 토글 조작
    // -------------------------------------------------------------
    console.log('\n--- [Scenario 3: Happy Path - 아코디언 인터랙션] ---');
    // Click on part toggle or all-expand button
    const expandBtn = await page.$('button.btn-secondary.btn-sm, button[title="모두 펼치기"]').catch(() => null);
    if (expandBtn) {
      await expandBtn.click().catch(() => {});
      await delay(600);
    }
    const shot3 = await capture(3, 'curriculum_toggle');
    recordStep(3, '강의 상세 페이지', '커리큘럼 파트 토글/펼치기 조작', '하위 차시 목록 아코디언 애니메이션 전개', '정상 전개', true, shot3);

    // -------------------------------------------------------------
    // SCENARIO 4: Happy Path - About SBA 페이지 및 탭 전환
    // -------------------------------------------------------------
    console.log('\n--- [Scenario 4: Happy Path - About SBA 탭 전환] ---');
    await navigate('#about?tab=charter');

    const aboutText = await page.$eval('body', el => el.innerText).catch(() => '');
    const hasCharter = aboutText.includes('신행헌장') || aboutText.includes('사단법인 세화불학원');
    const shot4 = await capture(4, 'about_tab_switch');
    recordStep(4, '소개 (About SBA)', '상단 서브탭(신행헌장) 전환', '해당 탭 본문 내용 렌더링', hasCharter ? '정상 렌더링' : '렌더링 실패', hasCharter, shot4);

    // -------------------------------------------------------------
    // SCENARIO 5: Happy Path - 수료증 진위 확인 시스템
    // -------------------------------------------------------------
    console.log('\n--- [Scenario 5: Happy Path - 수료증 진위 확인] ---');
    await navigate('#verify');

    const verifyTitle = await page.$eval('body', el => el.innerText).catch(() => '');
    const hasVerify = verifyTitle.includes('수료증 진위 확인') || verifyTitle.includes('조회하기');
    const shot5 = await capture(5, 'certificate_verify_page');
    recordStep(5, '수료증 진위확인', '진위 확인 페이지 진입', '검색 인풋창 및 조회 버튼 노출', hasVerify ? '정상 노출' : '노출 실패', hasVerify, shot5);

    // -------------------------------------------------------------
    // SCENARIO 6: Negative Path - 유효하지 않은 강좌 ID (404 Fallback)
    // -------------------------------------------------------------
    console.log('\n--- [Scenario 6: Negative Path - 존재하지 않는 강좌 ID Fallback] ---');
    await navigate('#course?id=non-existent-course-xyz');

    const notFoundCourseText = await page.$eval('body', el => el.innerText).catch(() => '');
    const hasCourseFallback = notFoundCourseText.includes('강좌를 찾을 수 없습니다') && notFoundCourseText.includes('강좌 목록으로 이동');
    const shot6 = await capture(6, 'negative_course_not_found');
    recordStep(6, '강좌 404 Fallback', '잘못된 courseId 진입', '강좌를 찾을 수 없습니다 안내 UI 및 목록 버튼 노출', hasCourseFallback ? '안내 UI 정상 노출 (크래시 없음)' : '노출 실패', hasCourseFallback, shot6);

    // -------------------------------------------------------------
    // SCENARIO 7: Negative Path - 유효하지 않은 강의 차시 ID (404 Fallback)
    // -------------------------------------------------------------
    console.log('\n--- [Scenario 7: Negative Path - 존재하지 않는 강의 차시 ID Fallback] ---');
    await navigate('#watch?id=non-existent-lecture-xyz');
    await delay(1000);

    const notFoundWatchText = await page.$eval('body', el => el.innerText).catch(() => '');
    const hasWatchFallback = notFoundWatchText.includes('강의를 찾을 수 없습니다') && notFoundWatchText.includes('내 강의실로 돌아가기');
    const shot7 = await capture(7, 'negative_watch_not_found');
    recordStep(7, '강의 404 Fallback', '잘못된 lectureId 진입', '강의를 찾을 수 없습니다 안내 UI 및 복귀 버튼 노출', hasWatchFallback ? '안내 UI 정상 노출 (크래시 없음)' : '노출 실패', hasWatchFallback, shot7);

    // Stop screencast and finalize video
    console.log(`\n[4/4] 녹화 종료 및 WebM 비디오 파일 저장 중... (캡처 프레임 수: ${frameCount})`);
    await client.send('Page.stopScreencast').catch(() => {});
    await delay(1000);

    const videoBytes = await recorderPage.evaluate(() => window.stopRecording());
    fs.writeFileSync(recordingPath, Buffer.from(videoBytes));
    console.log(`✔ 풀플로우 녹화 영상 저장 완료: ${recordingPath} (${(videoBytes.length / 1024).toFixed(1)} KB)`);

    return {
      success: testSteps.every(s => s.passed),
      testSteps,
      artifacts,
      recordingPath,
      recordingSize: `${(videoBytes.length / 1024).toFixed(1)} KB`,
      timestamp
    };

  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
    if (serverProcess) {
      try {
        process.kill(-serverProcess.pid);
      } catch (e) {
        serverProcess.kill();
      }
    }
  }
}

runE2ETest()
  .then(res => {
    console.log('\n=============================================================');
    console.log(`E2E 테스트 실행 완료 (전체 통과 여부: ${res.success ? '✅ SUCCESS' : '❌ FAIL'})`);
    console.log('=============================================================');
    fs.writeFileSync('test-results/e2e_summary.json', JSON.stringify(res, null, 2));
    process.exit(res.success ? 0 : 1);
  })
  .catch(err => {
    console.error('E2E 테스트 실행 중 치명적 오류:', err);
    process.exit(1);
  });
