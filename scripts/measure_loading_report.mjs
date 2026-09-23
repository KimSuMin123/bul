import { readFile,writeFile } from 'node:fs/promises';
const dir='test_artifacts/performance';
const read=async name=>JSON.parse(await readFile(`${dir}/${name}.json`,'utf8'));
const before=await read('before'),after=await read('after'),slowBefore=await read('before-throttled'),slowAfter=await read('after-throttled');
if(before.rows.length!==54||after.rows.length!==54||slowBefore.rows.length!==9||slowAfter.rows.length!==9)throw new Error('Incomplete measurement set');
const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
const rows=[];
for(const device of ['desktop','mobile'])for(const page of ['home','about','login','register','course','verify','dashboard','watch','admin']){
  const b=before.rows.filter(r=>r.device===device&&r.page===page),a=after.rows.filter(r=>r.device===device&&r.page===page);
  rows.push({device,page,beforeVisibleMs:median(b.map(r=>r.visibleMs)),afterVisibleMs:median(a.map(r=>r.visibleMs)),beforeNavigationMs:median(b.map(r=>r.navigationVisibleMs)),afterNavigationMs:median(a.map(r=>r.navigationVisibleMs)),beforeJsBytes:median(b.map(r=>r.jsDecodedBytes)),afterJsBytes:median(a.map(r=>r.jsDecodedBytes)),beforeScenarioApiRequests:median(b.map(r=>r.apiRequests)),afterScenarioApiRequests:median(a.map(r=>r.apiRequests))});
}
const slow=slowBefore.rows.map(b=>{const a=slowAfter.rows.find(a=>a.page===b.page);return{page:b.page,beforeVisibleMs:b.visibleMs,afterVisibleMs:a.visibleMs,beforeNavigationMs:b.navigationVisibleMs,afterNavigationMs:a.navigationVisibleMs};});
const main=bundle=>bundle.bundles.find(b=>b.name.startsWith('index-'));
const summary={at:new Date().toISOString(),method:after.method,throttledMethod:slowAfter.method,mainBundleBefore:main(before),mainBundleAfter:main(after),rows,throttledSingleSamples:slow};
await writeFile(`${dir}/comparison.json`,JSON.stringify(summary,null,2));
let md='# 변경 전후 로딩 측정\n\n고정된 로컬 프로덕션 빌드와 fixture API를 사용했습니다. 외부 요청은 차단했습니다. 아래는 일반 조건 각3회 중앙값이며 운영 CDN 측정이 아닙니다. visible은 Playwright가 요소 표시를 관찰한 시간이고, navigation은 home을 거친 동일 페이지 hash 이동입니다. API 횟수는 이 전체 시나리오 합계입니다.\n\n';
md+=`메인 JS: ${main(before).bytes.toLocaleString()} → ${main(after).bytes.toLocaleString()} bytes, gzip ${main(before).gzipBytes.toLocaleString()} → ${main(after).gzipBytes.toLocaleString()} bytes.\n\n`;
md+='|환경|페이지|표시 전→후 ms|화면이동 전→후 ms|초기 JS 전→후 KB|시나리오API 전→후|\n|---|---|---:|---:|---:|---:|\n';
for(const r of rows)md+=`|${r.device}|${r.page}|${r.beforeVisibleMs} → ${r.afterVisibleMs}|${r.beforeNavigationMs} → ${r.afterNavigationMs}|${(r.beforeJsBytes/1000).toFixed(1)} → ${(r.afterJsBytes/1000).toFixed(1)}|${r.beforeScenarioApiRequests} → ${r.afterScenarioApiRequests}|\n`;
md+='\n모바일 제한 조건은150ms RTT,1.6Mbps 내려받기,750kbps 올리기,CPU4배 제한입니다. 페이지별 단회이므로 통계적 결론이나1초 SLA를 보장하지 않습니다.\n\n|페이지|표시 전→후 ms|화면이동 전→후 ms|\n|---|---:|---:|\n';
for(const r of slow)md+=`|${r.page}|${r.beforeVisibleMs} → ${r.afterVisibleMs}|${r.beforeNavigationMs} → ${r.afterNavigationMs}|\n`;
await writeFile(`${dir}/comparison.md`,md);console.log(JSON.stringify({report:`${dir}/comparison.md`,mainBundleBefore:main(before),mainBundleAfter:main(after),rows:rows.length,throttledSingleSamples:slow}));
