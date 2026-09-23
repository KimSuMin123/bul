// Public HTML only. No authentication, private API calls, or external writes.
import { mkdir,writeFile } from 'node:fs/promises';
const url='https://xn--2j1bkkm2t5tbj2hx7go2ry0o.com/';
const rows=[];
for(let i=0;i<3;i++){
  const t=performance.now(),response=await fetch(url,{signal:AbortSignal.timeout(20000)});
  const headersMs=performance.now()-t,body=await response.text();
  rows.push({run:i+1,status:response.status,headersMs:Math.round(headersMs),totalMs:Math.round(performance.now()-t),decodedBytes:Buffer.byteLength(body),
    headers:Object.fromEntries(['server','content-type','cache-control','age','content-encoding','content-security-policy','content-security-policy-report-only','x-frame-options','x-content-type-options','strict-transport-security','referrer-policy'].map(k=>[k,response.headers.get(k)])),
    moduleScripts:[...body.matchAll(/<script[^>]+src="([^"]+)"/g)].map(match=>match[1])});
}
const result={at:new Date().toISOString(),url,method:'3 sequential public GET requests from this machine; response/header timing only, not browser paint or a cold-user Web Vital',rows};
await mkdir('test_artifacts/netlify',{recursive:true});
await writeFile('test_artifacts/netlify/live-http-before.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
