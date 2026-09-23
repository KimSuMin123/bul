import { test, expect, admin, student, enrollment } from '../tests/e2e/fixtures.mjs';
import { mkdirSync, writeFileSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
const label = process.env.PERF_LABEL || 'after';
const rows = [];
const throttled=process.env.PERF_THROTTLED==='1';
const samples=Number(process.env.PERF_SAMPLES||3);
const pages = [
  ['home', 'home', '.hero-heading'], ['about', 'about', '.about-page-container'],
  ['login', 'login', 'form'], ['register', 'register', 'form'],
  ['course', 'course?id=course-e2e', 'h1'], ['verify', 'verify', 'form'],
  ['dashboard', 'dashboard', 'h1', student], ['watch', 'watch?id=lecture-e2e', 'video', student],
  ['admin', 'admin', 'h1', admin]
];
for (const [device, viewport] of (throttled?[['mobile-throttled',{width:390,height:844}]]:[['desktop', {width:1440,height:1000}], ['mobile', {width:390,height:844}]])) {
  for (const [name, hash, selector, user] of pages) for (let run = 1; run <= samples; run++) test(`${device} ${name} ${run}`, async ({page, context, backend}) => {
    await page.setViewportSize(viewport);
    if(throttled){const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:1600000/8,uploadThroughput:750000/8});await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});}
    backend.db.testimonials=[];
    backend.db.ceremony_reservations=[];
    backend.db.enrollments = [enrollment()];
    backend.db.lectures[0].video_url = 'http://127.0.0.1:4310/storage/v1/object/public/lectures/short-video.webm';
    if (user) {
      backend.sessionUser = user;
      await context.addInitScript(({id}) => sessionStorage.setItem('buddha_lms_auth_session', JSON.stringify({access_token:`fixture-token-${id}`,refresh_token:`fixture-refresh-${id}`,expires_at:Math.floor(Date.now()/1000)+3600})), user);
    }
    const started = Date.now();
    await page.goto(`/#${hash}`, {waitUntil:'domcontentloaded'});
    await expect(page.locator(selector).first()).toBeVisible();
    const visibleMs = Date.now() - started;
    await page.waitForTimeout(300);
    const metrics = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const resources = performance.getEntriesByType('resource').filter(r => r.name.startsWith(location.origin));
      const js = resources.filter(r => new URL(r.name).pathname.endsWith('.js'));
      return { domContentLoadedMs:nav.domContentLoadedEventEnd, jsRequests:js.length, jsDecodedBytes:js.reduce((n,r)=>n+r.decodedBodySize,0), resourceRequests:resources.length };
    });
    await page.evaluate(() => location.hash = 'home');
    await expect(page.locator('.hero-heading')).toBeVisible();
    const navigationStart = Date.now();
    await page.evaluate(hash => location.hash = hash, hash);
    await expect(page.locator(selector).first()).toBeVisible();
    rows.push({device,page:name,run,visibleMs,navigationVisibleMs:Date.now()-navigationStart,...metrics,apiRequests:backend.requests.length,blockedExternalOrigins:[...new Set(backend.blockedExternal)]});
  });
}
test.afterAll(() => {
  const dir = 'test_artifacts/performance'; mkdirSync(dir,{recursive:true});
  const assets = `${dir}/${label}-dist/assets`;
  const bundles = readdirSync(assets).filter(f=>f.endsWith('.js')).map(name=>({name,bytes:statSync(`${assets}/${name}`).size,gzipBytes:gzipSync(readFileSync(`${assets}/${name}`)).length}));
  writeFileSync(`${dir}/${label}${throttled?'-throttled':''}.json`,JSON.stringify({label,at:new Date().toISOString(),method:`Local production build; fixture APIs; external requests blocked; fresh context per sample; ${throttled?'CDP150ms RTT/1.6Mbps download/750kbps upload/CPU4x':'no network/CPU throttling'}; ${samples} samples per page and viewport; visible metric includes Playwright observation overhead; warm hash-navigation excludes login; not live/CDN performance`,bundles,rows},null,2));
});
