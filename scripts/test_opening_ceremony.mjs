import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getOpeningTimeline, OPENING_START_AT, OPENING_PHASES } from '../src/config/openingCeremony.js';

const start = Date.parse(OPENING_START_AT);
const checks = [];
const check = (name, fn) => { fn(); checks.push(name); };
check('18:28:59.999 hidden; 18:29:00 visible with 60 seconds remaining', () => {
  assert.equal(getOpeningTimeline(start - 60001).visible, false);
  assert.equal(getOpeningTimeline(start - 60000).visible, true);
  assert.equal(getOpeningTimeline(start - 60000).countdown, 60);
});
check('18:30:00 begins the existing timeline', () => {
  assert.equal(getOpeningTimeline(start - 1).before, true);
  assert.equal(getOpeningTimeline(start).before, false);
  assert.equal(getOpeningTimeline(start).elapsed, 0);
  assert.equal(getOpeningTimeline(start).phase.title, '나모붓다야 문구와 인사');
});
check('countdown and celebration at 5 seconds', () => {
  assert.equal(getOpeningTimeline(start + 3999).cutCountdown, null);
  assert.equal(getOpeningTimeline(start + 4000).cutCountdown, 1);
  assert.equal(getOpeningTimeline(start + 4999).cut, false);
  assert.equal(getOpeningTimeline(start + 5000).cut, true);
  assert.equal(getOpeningTimeline(start + 5000).cutCountdown, null);
  assert.equal(getOpeningTimeline(start + 5000).celebrating, true);
  assert.equal(getOpeningTimeline(start + 11000).celebrating, false);
});
check('10-second end boundary and preserved final phase', () => {
  assert.equal(getOpeningTimeline(start + 9999).finished, false);
  assert.equal(getOpeningTimeline(start + 10000).finished, true);
  assert.equal(getOpeningTimeline(start + 25000).elapsed, 10);
  assert.deepEqual(getOpeningTimeline(start + 8000).phase, OPENING_PHASES.at(-2));
  assert.equal(OPENING_PHASES.at(-1).description, '아래 개설 강좌에서 첫 수업을 살펴보세요. 함께해 주셔서 감사합니다.');
});
check('invalid clocks stay hidden; late arrivals jump to current phase', () => {
  assert.equal(getOpeningTimeline(NaN).visible, false);
  assert.equal(getOpeningTimeline(start, NaN).visible, false);
  assert.equal(getOpeningTimeline(start + 6000).phase.title, '부처가 승천');
});

const compiled = await build({ entryPoints: ['src/components/home/OpeningCeremony.jsx'], bundle: true, write: false, platform: 'node', format: 'cjs', external: ['react'], define: { 'import.meta.env': '{}' } });
const cjsModule = { exports: {} };
new Function('require', 'module', 'exports', compiled.outputFiles[0].text)(createRequire(import.meta.url), cjsModule, cjsModule.exports);
const OpeningCeremony = cjsModule.exports.default;
const render = now => renderToStaticMarkup(React.createElement(OpeningCeremony, { now }));
check('SSR hides the entire section before boundary, without a preview escape', () => {
  assert.equal(render(start - 60001), '');
  assert.match(render(start - 60000), /개원 리본 세리머니/);
  assert.match(render(start - 60000), /1:00/);
});
check('SSR countdown, accessible local reaction and final messages', () => {
  assert.match(render(start + 4000), /리본 커팅까지/);
  assert.match(render(start + 4000), /opening-countdown-number">1</);
  assert.match(render(start + 5000), /opening-celebration/);
  assert.match(render(start + 5000), /내 화면에서만 보이는 반응/);
  assert.match(render(start + 10000), /행사가 마무리되었습니다/);
  assert.match(render(start + 10000), /함께해 주셔서 감사합니다. 아래 강좌를 살펴보세요./);
  assert.doesNotMatch(render(start + 10000), /opening-celebration/);
});
console.log(`Opening ceremony: ${checks.length} checks passed.`);

// Local-only visual fixture for the approved computer-use browser. This is not
// bundled into the product and does not expose a public URL/query time override.
if (process.argv.includes('--serve') || process.argv.includes('--fixture')) {
  const bundle = await build({ stdin: { resolveDir: process.cwd(), loader: 'jsx', contents: `
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import OpeningCeremony from './src/components/home/OpeningCeremony.jsx';
    import './src/styles/tokens.css'; import './src/styles/base.css'; import './src/styles/components.css'; import './src/styles/home-experience.css';
    const start = ${start}; const originalNow = Date.now; let fakeNow = start - 61000;
    function App() {
      const [now, setNow] = React.useState(start - 60001); const [automatic, setAutomatic] = React.useState(false);
      React.useEffect(() => { if (!automatic) { Date.now = originalNow; return; } Date.now = () => fakeNow; const t = setInterval(() => {fakeNow += 250;}, 250); return () => {clearInterval(t); Date.now = originalNow;}; }, [automatic]);
      const choose = offset => {setAutomatic(false); setNow(start + offset);};
      return <><nav aria-label="로컬 행사 검증" style={{padding:16,display:'flex',flexWrap:'wrap',gap:8}}>{[[-60001,'18:28:59.999'],[-60000,'18:29'],[0,'18:30'],[175000,'18:32:55 커팅 5초'],[179000,'18:32:59 커팅 1초'],[180000,'18:33 리본 커팅'],[240000,'18:34 마지막 단계'],[300000,'18:35 종료']].map(([offset,label])=><button key={offset} onClick={()=>choose(offset)}>{label}</button>)}<button onClick={()=>{fakeNow=start-62000; Date.now=()=>fakeNow; setAutomatic(true);}}>열린 화면 경계 재현</button><button onClick={()=>{fakeNow=start+174000; Date.now=()=>fakeNow; setAutomatic(true);}}>커팅 자동 진행</button></nav><p style={{padding:16}}>로컬 검증 전용 · 경계 재현은 2초 뒤 자동 노출됩니다.</p><OpeningCeremony now={automatic ? undefined : now}/></>;
    } createRoot(document.getElementById('root')).render(<App/>);
  ` }, bundle: true, write: false, outfile: 'fixture.js', format: 'esm', define: { 'import.meta.env': '{}' } });
  const js = bundle.outputFiles.find(file => file.path.endsWith('.js')).text;
  const css = bundle.outputFiles.find(file => file.path.endsWith('.css')).text;
  const html = '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><div id="root"></div><script type="module" src="/fixture.js"></script></html>';
  const directory = 'test_artifacts/ceremony-fixture';
  mkdirSync(directory, { recursive: true });
  writeFileSync(`${directory}/fixture.js`, js);
  writeFileSync(`${directory}/fixture.css`, css);
  writeFileSync(`${directory}/index.html`, html);
  console.log(`Opening visual fixture written to ${directory}`);
  if (process.argv.includes('--serve')) {
  const server = createServer((req, res) => {
    if (req.url === '/fixture.js') { res.writeHead(200, { 'Content-Type': 'text/javascript' }); res.end(js); }
    else if (req.url === '/fixture.css') { res.writeHead(200, { 'Content-Type': 'text/css' }); res.end(css); }
    else { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html); }
  });
  await new Promise(resolve => server.listen(4314, '127.0.0.1', resolve));
  console.log('Opening visual fixture: http://127.0.0.1:4314 (Ctrl+C to stop)');
  }
}
