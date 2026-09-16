import puppeteer from 'puppeteer-core';

async function genIcons() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();

  const getHtml = (size, radius, lotusSize, mainSize, subSize, badgeSize, badgePad) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { margin: 0; padding: 0; background: transparent; display: flex; align-items: center; justify-content: center; }
        .icon-box {
          width: ${size}px; height: ${size}px; border-radius: ${radius}px;
          background: linear-gradient(135deg, #163028 0%, #22473D 50%, #12241E 100%);
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          position: relative; overflow: hidden;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .lotus-circle {
          width: ${lotusSize}px; height: ${lotusSize}px; border-radius: 50%;
          background: radial-gradient(circle, rgba(212, 175, 55, 0.3) 0%, rgba(212, 175, 55, 0) 70%);
          position: absolute;
        }
        .main-text {
          color: #E6CA65; font-size: ${mainSize}px; font-weight: 800; letter-spacing: -1px;
          text-shadow: 0 4px 12px rgba(0,0,0,0.5); z-index: 2; margin-bottom: 4px;
        }
        .sub-text {
          color: #F8FAFC; font-size: ${subSize}px; font-weight: 600; letter-spacing: 2px;
          z-index: 2; opacity: 0.95;
        }
        .admin-badge {
          margin-top: ${badgePad.top}px; background: #C8963E; color: #163028; font-size: ${badgeSize}px;
          font-weight: 800; padding: ${badgePad.pad}; border-radius: 20px; z-index: 2; letter-spacing: 1px;
        }
      </style>
    </head>
    <body>
      <div class="icon-box">
        <div class="lotus-circle"></div>
        <div class="main-text">世花</div>
        <div class="sub-text">붓다아카데미</div>
        <div class="admin-badge">CMS 관리자</div>
      </div>
    </body>
    </html>
  `;

  // 512x512
  await page.setContent(getHtml(512, 110, 260, 92, 32, 22, { top: 18, pad: '8px 24px' }));
  await page.setViewport({ width: 512, height: 512 });
  await page.screenshot({ path: 'public/images/pwa-icon-512.png', omitBackground: true });
  console.log('✓ 512x512 icon generated');

  // 192x192
  await page.setContent(getHtml(192, 42, 98, 34, 12, 9, { top: 7, pad: '3px 10px' }));
  await page.setViewport({ width: 192, height: 192 });
  await page.screenshot({ path: 'public/images/pwa-icon-192.png', omitBackground: true });
  console.log('✓ 192x192 icon generated');

  await browser.close();
  console.log('PWA Icons ready!');
}

genIcons().catch(console.error);
