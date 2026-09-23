// Read-only live check. Does not print/store credentials, response bodies, or signed URLs.
// Run with: node --env-file=.env scripts/check_live_audio.mjs
import {chromium} from '@playwright/test';
import {existsSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';

const result={checkedAt:new Date().toISOString(),scope:'post-migration live welcome audio; anonymous signed access and actual playback with deployed private-bucket exception',signing:{attempted:false,status:null,signedUrlExists:false},playback:[],passed:false};
let browser;
try {
 const baseValue=process.env.VITE_SUPABASE_URL||process.env.SUPABASE_URL;
 const key=process.env.VITE_SUPABASE_ANON_KEY||process.env.SUPABASE_ANON_KEY;
 const base=new URL(baseValue||'');
 if(base.protocol!=='https:'||base.username||base.password||!key)throw new Error('configuration');
 const sourcePath='/storage/v1/object/sign/lectures/audio/namo_buddhaya_song.mp3';
 result.signing.attempted=true;
 const signedResponse=await fetch(`${base.origin}${sourcePath}`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({expiresIn:3600}),signal:AbortSignal.timeout(15000),redirect:'error'});
 result.signing.status=signedResponse.status;
 const body=await signedResponse.json().catch(()=>null);
 const signed=body?.signedURL||body?.signedUrl;
 result.signing.signedUrlExists=typeof signed==='string'&&signed.length>0;
 if(!signedResponse.ok||!result.signing.signedUrlExists)throw new Error('signing_failed');
 const signedValue=/^https:\/\//.test(signed)?signed:`${base.origin}${signed.startsWith('/storage/v1/')?'':'/storage/v1'}${signed.startsWith('/')?'':'/'}${signed}`;
 const media=new URL(signedValue);
 if(media.origin!==base.origin||media.pathname!==sourcePath)throw new Error('unexpected_signed_target');
 const executablePath=process.env.BROWSER_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
 browser=await chromium.launch({executablePath,headless:true,args:['--disable-background-networking']});
 for(const viewport of [{name:'desktop',width:1440,height:900},{name:'mobile',width:390,height:844}]) {
  const item={viewport:viewport.name,playbackStarted:false,currentTime:0,paused:false,stoppedWithinTwoSeconds:false,mediaErrorCode:null};
  result.playback.push(item);
  const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},isMobile:viewport.name==='mobile',hasTouch:viewport.name==='mobile'});
  try {
   const page=await context.newPage();
   // No unrelated page, analytics, assets, trace, screenshots or console capture.
   await page.route('**/*',route=>route.request().url()===signedValue&&route.request().method()==='GET'?route.continue():route.abort('blockedbyclient'));
   await page.setContent('<button id="play">Play verified welcome audio</button><audio id="audio" preload="none"></audio>');
   await page.evaluate(src=>{
    const audio=document.getElementById('audio');audio.src=src;audio.muted=true;
    window.audioCheck={playError:false,startedAt:null,stoppedAt:null};
    const stop=()=>{audio.pause();window.audioCheck.stoppedAt=performance.now();};
    audio.addEventListener('playing',()=>{
     window.audioCheck.startedAt??=performance.now();
     // A safety timer caps actual playback even if the test runner is delayed.
     setTimeout(stop,1200);
    },{once:true});
    audio.addEventListener('timeupdate',()=>{if(audio.currentTime>=0.35&&!audio.paused)stop();});
    document.getElementById('play').addEventListener('click',()=>{audio.play().catch(()=>{window.audioCheck.playError=true;});});
   },signedValue);
   await page.click('#play');
   await page.waitForFunction(()=>document.getElementById('audio').currentTime>0||window.audioCheck.playError||document.getElementById('audio').error,{},{timeout:15000});
   const measured=await page.evaluate(()=>{
    const audio=document.getElementById('audio');audio.pause();
    const now=performance.now();const started=window.audioCheck.startedAt;
    const value={playbackStarted:audio.currentTime>0,currentTime:Math.round(audio.currentTime*1000)/1000,paused:audio.paused,stoppedWithinTwoSeconds:started!==null&&now-started<=2000,mediaErrorCode:audio.error?.code||null};
    audio.removeAttribute('src');audio.load();return value;
   });
   Object.assign(item,measured);
  } catch { item.failure='playback_check_failed'; }
  finally {await context.close();}
 }
 result.passed=result.signing.status===200&&result.playback.length===2&&result.playback.every(item=>item.playbackStarted&&item.paused&&item.stoppedWithinTwoSeconds&&!item.mediaErrorCode);
} catch(error) {
 result.failure=['configuration','signing_failed','unexpected_signed_target'].includes(error.message)?error.message:'live_check_failed';
} finally {
 await browser?.close();
 const folder=path.resolve('test_artifacts/enhancements');await mkdir(folder,{recursive:true});
 await writeFile(path.join(folder,'live-audio.json'),JSON.stringify(result,null,2)+'\n',{encoding:'utf8',mode:0o600});
 console.log(JSON.stringify(result));
 if(!result.passed)process.exitCode=1;
}
