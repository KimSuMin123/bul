import puppeteer from 'puppeteer-core';
import path from 'node:path';

const artifactDir = 'C:\\Users\\sehyeon\\.gemini\\antigravity-ide\\brain\\fabfb462-3ca6-45a3-b75e-813173ab9587';
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function run() {
  console.log('Launching Chrome...');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  console.log('Navigating to http://localhost:4173/ ...');
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle0' });

  // 1. 메인 홈페이지 배너 상태
  console.log('Capturing Step 0: Homepage Rehearsal Banner...');
  await page.screenshot({ path: path.join(artifactDir, 'ceremony_step0_home.png') });

  // 2. D-30초 세레머니 입장 클릭
  console.log('Clicking D-30s Ceremony Entry...');
  const entryBtn = await page.waitForSelector('.rehearsal-replay-banner button');
  if (entryBtn) await entryBtn.click();
  await new Promise(r => setTimeout(r, 600));

  console.log('Capturing Step 1: D-30s Midnight Curtain Countdown...');
  await page.screenshot({ path: path.join(artifactDir, 'ceremony_step1_countdown.png') });

  // 3. D-0분 즉시 이동
  console.log('Moving to D-0m Ribbon ready state...');
  const skipBtn = await page.waitForSelector('.ceremony-top-controls button:nth-child(2)');
  if (skipBtn) await skipBtn.click();
  await new Promise(r => setTimeout(r, 500));

  console.log('Capturing Step 2: Dancheong Ribbon & Cut Button...');
  await page.screenshot({ path: path.join(artifactDir, 'ceremony_step2_ribbon.png') });

  // 4. 가위로 자르기 클릭
  console.log('Clicking Scissor Cut Button...');
  const cutBtn = await page.waitForSelector('.btn-dancheong-cut');
  if (cutBtn) await cutBtn.click();

  // 자르는 중 (장막 걷히는 모션 중 - 3.0초 중 1.5초 시점)
  await new Promise(r => setTimeout(r, 1500));
  console.log('Capturing Step 3: Ribbon Split & Curtains Opening Slowly...');
  await page.screenshot({ path: path.join(artifactDir, 'ceremony_step3_curtain_open.png') });

  // 5. 장막 완전히 걷힌 후 메인 홈페이지 공개
  await new Promise(r => setTimeout(r, 2500));
  console.log('Capturing Step 4: Full Homepage Revealed...');
  await page.screenshot({ path: path.join(artifactDir, 'ceremony_step4_opened.png') });

  await browser.close();
  console.log('All screenshots captured successfully in artifact directory!');
}

run().catch(err => {
  console.error('Error during capture:', err);
  process.exit(1);
});
