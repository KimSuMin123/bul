// Real NamoAudio + supplied MP3. No audio/network mocks or application credentials.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {createReadStream,existsSync,statSync,readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from '@playwright/test';

const file='public/audio/namo_buddhaya_song.mp3';
const size=statSync(file).size;
const summary={checkedAt:new Date().toISOString(),source:'supplied master ZIP, optimized local public asset',file,bytes:size,realNativeMedia:true,viewports:[],passed:false};
const bundle=await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import NamoAudio from './src/components/home/NamoAudio.jsx';function App(){const[show,setShow]=React.useState(true);return <>{show&&<NamoAudio/>}<button id="unmount" onClick={()=>setShow(false)}>Unmount</button></>};createRoot(document.getElementById('root')).render(<App/>);`,loader:'jsx',resolveDir:process.cwd()},bundle:true,write:false,format:'iife',platform:'browser',define:{'import.meta.env':'{}'}});
let audioGets=0;
const server=createServer((req,res)=>{
 if(req.url==='/app.js'){res.writeHead(200,{'Content-Type':'application/javascript'});res.end(bundle.outputFiles[0].text);return;}
 if(req.url==='/images/namo_buddhaya.png'){res.writeHead(200,{'Content-Type':'image/png'});res.end(readFileSync('public/images/namo_buddhaya.png'));return;}
 if(req.url==='/audio/namo_buddhaya_song.mp3'){
  if(req.method==='GET')audioGets++;
  const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
  const start=range?Number(range[1]):0,end=range&&range[2]?Math.min(Number(range[2]),size-1):size-1;
  if(start>=size||start>end){res.writeHead(416,{'Content-Range':`bytes */${size}`});res.end();return;}
  res.writeHead(range?206:200,{'Content-Type':'audio/mpeg','Accept-Ranges':'bytes','Content-Length':end-start+1,...(range?{'Content-Range':`bytes ${start}-${end}/${size}`}:{})});
  if(req.method==='HEAD'){res.end();return;}
  const stream=createReadStream(file,{start,end});res.on('close',()=>stream.destroy());stream.pipe(res);return;
 }
 if(req.url==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end('<div id="root"></div><script src="/app.js"></script>');return;}
 res.writeHead(404);res.end();
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
let browser;
try {
 const executablePath=process.env.BROWSER_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
 browser=await chromium.launch({executablePath,headless:true,args:['--disable-background-networking']});
 for(const [name,viewport] of [['desktop',{width:1440,height:900}],['mobile',{width:390,height:844}]]){
  const item={viewport:name,passed:false};summary.viewports.push(item);
  const context=await browser.newContext({viewport,isMobile:name==='mobile',hasTouch:name==='mobile'});
  try {
   const page=await context.newPage();
   await page.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort('blockedbyclient'));
   await page.addInitScript(()=>{
    // Instrument construction only; keep real browser playback/decoding/network methods.
    const NativeAudio=window.Audio;window.realAudioInstances=[];
    window.Audio=new Proxy(NativeAudio,{construct(target,args){const element=new target(...args);element.muted=true;window.realAudioInstances.push(element);return element;}});
   });
   const before=audioGets;
   await page.goto(origin);
   await page.getByRole('button',{name:'나모붓다야 음성 재생'}).waitFor();
   await page.waitForTimeout(300);
   item.getsBeforeClick=audioGets-before;
   assert.equal(item.getsBeforeClick,0,'preload=none must not request the MP3 before a user click');
   assert.equal(await page.evaluate(()=>realAudioInstances.length),1);
   assert.equal(await page.evaluate(()=>realAudioInstances[0] instanceof HTMLAudioElement&&realAudioInstances[0].preload==='none'),true);
   await page.getByRole('button',{name:'나모붓다야 음성 재생'}).click();
   await page.waitForFunction(()=>realAudioInstances[0].currentTime>=0.25,{},{timeout:15000});
   await page.getByRole('button',{name:'나모붓다야 음성 일시정지'}).click();
   const first=await page.evaluate(()=>({time:realAudioInstances[0].currentTime,paused:realAudioInstances[0].paused,duration:realAudioInstances[0].duration,error:realAudioInstances[0].error?.code||null}));
   assert.ok(first.time>=0.25&&first.paused&&!first.error);
   await page.getByRole('button',{name:'나모붓다야 음성 재생'}).click();
   await page.waitForFunction(previous=>realAudioInstances[0].currentTime>previous+0.25,first.time,{timeout:15000});
   await page.getByRole('button',{name:'나모붓다야 음성 일시정지'}).click();
   const resumed=await page.evaluate(()=>({time:realAudioInstances[0].currentTime,paused:realAudioInstances[0].paused,instances:realAudioInstances.length,error:realAudioInstances[0].error?.code||null}));
   assert.ok(resumed.time>first.time+0.25&&resumed.paused&&!resumed.error);
   assert.equal(resumed.instances,1,'pause/resume must reuse the same native Audio object');
   await page.click('#unmount');
   assert.equal(await page.evaluate(()=>realAudioInstances[0].paused&&!realAudioInstances[0].getAttribute('src')),true);
   Object.assign(item,{durationSeconds:first.duration,firstPauseSeconds:first.time,resumePauseSeconds:resumed.time,audioInstances:resumed.instances,getsAfterClick:audioGets-before,unmountStopped:true,passed:true});
  }catch(error){item.failure=error.name||'check_failed';}
  finally{await context.close();}
 }
 summary.passed=summary.viewports.length===2&&summary.viewports.every(item=>item.passed);
}finally{
 await browser?.close();await new Promise(resolve=>server.close(resolve));
 mkdirSync('test_artifacts/enhancements',{recursive:true});writeFileSync('test_artifacts/enhancements/local-audio.json',JSON.stringify(summary,null,2)+'\n');
 console.log(JSON.stringify(summary));if(!summary.passed)process.exitCode=1;
}
