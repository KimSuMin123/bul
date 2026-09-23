import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';

const out = 'test_artifacts/enhancements';
mkdirSync(out, { recursive: true });
let rows = [{ id: 'welcome', title: '개원 안내', content: '함께해 주셔서 감사합니다.', type: 'image', image_url: '/images/logo.png', link_url: 'https://example.org/welcome', enabled: true, starts_at: null, ends_at: null, updated_at: new Date().toISOString() }];
let js = '';
let css = '';
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const json = (value, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); };
  if (url.pathname === '/app.js') { res.writeHead(200, { 'Content-Type': 'text/javascript' }); res.end(js); return; }
  if (url.pathname === '/app.css') { res.writeHead(200, { 'Content-Type': 'text/css' }); res.end(css); return; }
  if (['/images/logo.png', '/images/namo_buddhaya.png', '/images/official_seal.png'].includes(url.pathname)) { res.writeHead(200, { 'Content-Type': 'image/png' }); res.end(readFileSync(`public${url.pathname}`)); return; }
  if (url.pathname.startsWith('/rest/v1/site_announcements')) {
    if (req.method === 'GET') return json(url.searchParams.get('enabled') ? rows.filter(row => row.enabled) : rows);
    let body = ''; for await (const chunk of req) body += chunk;
    if (req.method === 'POST') { const row = { ...JSON.parse(body), id: `row-${rows.length + 1}` }; rows.push(row); return json([row], 201); }
    const id = url.searchParams.get('id')?.slice(3);
    if (req.method === 'PATCH') { const row = rows.find(row => row.id === id); Object.assign(row, JSON.parse(body)); return json([row]); }
    if (req.method === 'DELETE') { const removed = rows.filter(row => row.id === id).map(row => ({ id: row.id })); rows = rows.filter(row => row.id !== id); return json(removed); }
  }
  if (url.pathname === '/storage/v1/object/sign/lectures/audio/namo_buddhaya_song.mp3') return json({ signedURL: '/object/sign/lectures/audio/namo_buddhaya_song.mp3?token=fixture' });
  if (url.pathname.startsWith('/storage/v1/object/announcement-images/')) return json({ Key: url.pathname });
  res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<meta charset="utf-8"><link rel="stylesheet" href="/app.css"><div id="root"></div><script type="module" src="/app.js"></script>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const bundle = await build({ stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import NamoAudio from './src/components/home/NamoAudio.jsx'; import OpeningCeremony from './src/components/home/OpeningCeremony.jsx'; import AnnouncementPopup from './src/components/announcements/AnnouncementPopup.jsx'; import AnnouncementManager from './src/components/announcements/AnnouncementManager.jsx'; import CertificateModal from './src/components/certificate/CertificateModal.jsx'; import './src/styles/tokens.css'; import './src/styles/base.css'; import './src/styles/components.css'; import './src/styles/home-experience.css'; import './src/styles/certificate.css'; function App(){const [view,setView]=React.useState('home'); return <><nav><button onClick={()=>setView('home')}>홈</button><button onClick={()=>setView('admin')}>관리</button><button onClick={()=>setView('cert')}>자격증</button></nav>{view==='home'&&<><NamoAudio/><OpeningCeremony/><AnnouncementPopup/></>}{view==='admin'&&<AnnouncementManager/>}{view==='cert'&&<CertificateModal certificate={{certNo:'CERT-2026-0010',certRegNo:'제 2026-00183호',studentName:'검증 학인',birthDate:'1990-01-01',memberNo:'BUDDHA-001',certType:'불교의례해설사',certGrade:'2급',courseTitle:'불교의례법사 과정',period:'2026년 1월~9월',status:'valid',issuedAt:'2026-09-23',competency:'불교 의례 해설',issuingOrg:'사단법인 세화불학원',representative:'이사장',regOffice:'문화체육관광부'}} onClose={()=>setView('home')}/>}</>}; createRoot(document.getElementById('root')).render(<App/>);`, loader: 'jsx', resolveDir: process.cwd() }, bundle: true, write: false, outfile: 'app.js', format: 'esm', platform: 'browser', define: { 'import.meta.env': JSON.stringify({ VITE_SUPABASE_URL: base, VITE_SUPABASE_ANON_KEY: 'fixture-key', VITE_NAMO_AUDIO_URL: '/test.wav', VITE_OPENING_START_AT: '2026-10-01T18:30:00+09:00' }), 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(base), 'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('fixture-key'), 'import.meta.env.VITE_NAMO_AUDIO_URL': JSON.stringify('/test.wav'), 'import.meta.env.VITE_OPENING_START_AT': JSON.stringify('2026-10-01T18:30:00+09:00') }, plugins: [{ name: 'auth-stub', setup(b) { b.onResolve({ filter: /authSession\.js$/ }, () => ({ path: 'auth', namespace: 'test' })); b.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const getAccessToken=async()=>"fixture-admin-token"; export const getAuthSession=()=>null; export const setAuthSession=()=>{}; export const beginAuthAttempt=()=>0; export const clearAuthSession=()=>{}; export const callAuthAction=async()=>({});', loader: 'js' })); } }] });
js = bundle.outputFiles.find(file => file.path.endsWith('.js')).text;
css = bundle.outputFiles.find(file => file.path.endsWith('.css')).text;
const executablePath = process.env.BROWSER_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
let browser;
try {
  browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript(() => { window.Audio = class { constructor() { this.paused = true; this.listeners = {}; } set src(value) { this.source = value; } addEventListener(name, fn) { this.listeners[name] = fn; } removeEventListener(name) { delete this.listeners[name]; } removeAttribute() {} load() {} async play() { this.paused = false; } pause() { this.paused = true; } }; });
  await page.goto(base);
  await page.getByRole('dialog', { name: '개원 안내' }).waitFor();
  assert.equal(await page.locator('.announcement-popup-image').locator('..').getAttribute('href'), 'https://example.org/welcome');
  await page.screenshot({ path: `${out}/mobile-popup.png`, fullPage: true });
  await page.getByRole('button', { name: '오늘 하루 보지 않기' }).click();
  assert.equal(await page.getByRole('dialog', { name: '개원 안내' }).count(), 0);
  await page.reload();
  assert.equal(await page.getByRole('dialog', { name: '개원 안내' }).count(), 0);
  await page.getByRole('button', { name: '나모붓다야 음성 재생' }).click();
  await page.getByText('음성 재생 중', { exact: false }).waitFor();
  await page.getByRole('button', { name: '나모붓다야 음성 일시정지' }).click();
  await page.getByText('음성 일시정지', { exact: false }).waitFor();
  await page.getByRole('button', { name: '미리 체험하기' }).click();
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.waitForTimeout(1100);
  await page.getByRole('button', { name: '일시정지' }).click();
  const paused = await page.locator('.opening-ceremony progress').getAttribute('value');
  await page.waitForTimeout(350);
  assert.equal(await page.locator('.opening-ceremony progress').getAttribute('value'), paused);
  await page.getByRole('button', { name: '처음부터' }).click();
  assert.equal(Number(await page.locator('.opening-ceremony progress').getAttribute('value')), 0);
  await page.getByRole('button', { name: '관리' }).click();
  await page.getByLabel('제목').fill('새 공지');
  await page.getByLabel('본문').fill('관리자가 작성했습니다.');
  await page.getByRole('button', { name: '공지 등록' }).click();
  await page.getByText('새 공지', { exact: true }).waitFor();
  assert.equal(rows.length, 2);
  await page.getByRole('button', { name: '수정' }).last().click();
  await page.getByLabel('제목').fill('수정 공지');
  await page.getByRole('button', { name: '공지 수정' }).click();
  await page.getByText('수정 공지', { exact: true }).waitFor();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '삭제' }).last().click();
  assert.equal(rows.length, 1);
  await page.getByRole('button', { name: '자격증' }).click();
  await page.screenshot({ path: `${out}/mobile-certificate.png`, fullPage: true });
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.screenshot({ path: `${out}/desktop-certificate.png`, fullPage: true });
  await page.emulateMedia({ media: 'print' });
  const printBounds = await page.evaluate(() => {
    const page = document.querySelector('.cert-paper').getBoundingClientRect();
    return Object.fromEntries(['.cert-header', '.cert-main', '.cert-footer', '.cert-issuer', '.cert-office', '.cert-check'].map(selector => { const rect = document.querySelector(selector).getBoundingClientRect(); return [selector, { top: rect.top, bottom: rect.bottom, pageTop: page.top, pageBottom: page.bottom }]; }));
  });
  for (const [selector, rect] of Object.entries(printBounds)) assert.ok(rect.top >= rect.pageTop && rect.bottom <= rect.pageBottom, `${selector} exceeds A4 page: ${JSON.stringify(rect)}`);
  assert.ok(printBounds['.cert-main'].bottom < printBounds['.cert-footer'].top, 'certificate content overlaps issuer footer');
  const pdf = await page.pdf({ path: `${out}/certificate.pdf`, printBackground: true, preferCSSPageSize: true });
  const pageCount = [...pdf.toString('latin1').matchAll(/\/Type\s*\/Page\b/g)].length;
  assert.equal(pageCount, 1, `A4 PDF expected 1 page, got ${pageCount}`);
  await page.evaluate(() => { document.querySelectorAll('.cert-details dd')[3].textContent = '불교의례 해설 및 전통 의식 지도 전문 교육과정 '.repeat(4); document.querySelector('.cert-statement strong').textContent = '불교의례 해설 및 전통 의식 지도 전문 교육과정 '.repeat(3); });
  const longBounds = await page.evaluate(() => { const main = document.querySelector('.cert-main').getBoundingClientRect(); const footer = document.querySelector('.cert-footer').getBoundingClientRect(); return { mainBottom: main.bottom, footerTop: footer.top }; });
  assert.ok(longBounds.mainBottom < longBounds.footerTop, `long certificate text overlaps issuer: ${JSON.stringify(longBounds)}`);
  const eventPage = await browser.newPage();
  await eventPage.clock.install({ time: new Date('2026-10-01T09:29:59Z') });
  await eventPage.goto(base);
  await eventPage.getByText('개원을 기다리고 있습니다').waitFor();
  await eventPage.clock.runFor(1000);
  await eventPage.getByText('환영합니다').waitFor();
  await eventPage.clock.runFor(180000);
  await eventPage.getByText('개원을 축하합니다').waitFor();
  await eventPage.screenshot({ path: `${out}/ribbon-cut.png`, fullPage: true });
  await eventPage.clock.runFor(120000);
  await eventPage.getByText('행사가 마무리되었습니다').waitFor();
  await eventPage.close();
  console.log(`browser enhancements pass; PDF pages=${pageCount}; artifacts=${out}`);
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
