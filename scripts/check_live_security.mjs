// Authorized read-only post-deployment checks. Never prints bodies, tokens, URLs,
// member data or object names. Run: node --env-file=.env scripts/check_live_security.mjs
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';

const result={checkedAt:new Date().toISOString(),scope:'read-only deployed access boundaries; no account, enrollment, QA or SMS mutations',checks:[],passed:false};
const record=(name,response,passed,extra={})=>result.checks.push({name,status:response.status,passed,...extra});
try{
 const base=new URL(process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL||'');
 const anon=process.env.SUPABASE_ANON_KEY||process.env.VITE_SUPABASE_ANON_KEY;
 const service=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(base.protocol!=='https:'||base.username||base.password||base.pathname!=='/'||!anon||!service)throw Error('configuration');
 const request=async(endpoint,{method='GET',body,key=anon,origin}={})=>{
  const response=await fetch(`${base.origin}${endpoint}`,{method,headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',...(origin?{Origin:origin}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000),redirect:'error'});
  const value=await response.json().catch(()=>null);return {status:response.status,ok:response.ok,value,headers:response.headers};
 };
 for(const table of ['users','progress']){
  const response=await request(`/rest/v1/${table}?select=id&limit=1`);
  record(`anonymous_${table}_protected`,response,[401,403].includes(response.status)||(response.ok&&Array.isArray(response.value)&&response.value.length===0),{rowsExposed:Array.isArray(response.value)?response.value.length:null});
 }
 for(const table of ['courses','site_announcements']){
  const response=await request(`/rest/v1/${table}?select=id&limit=1`);
  record(`public_${table}_readable`,response,response.ok&&Array.isArray(response.value),{rowsReturned:Array.isArray(response.value)?response.value.length:null});
 }
 // These requests terminate before rate-limit writes or any account lookup/write.
 let response=await request('/functions/v1/lms-auth',{method:'POST',body:{action:'register',privacyConsent:false,privacyPolicyVersion:'2026-09-23'}});
 record('registration_without_consent_rejected',response,response.status===400);
 response=await request('/functions/v1/lms-auth',{method:'POST',body:{action:'admin-register'}});
 record('anonymous_admin_action_rejected',response,response.status===401);
 response=await request('/functions/v1/lms-auth',{method:'OPTIONS',origin:'https://unauthorized-audit.invalid'});
 record('unknown_cors_origin_rejected',response,response.status===403&&!response.headers.has('access-control-allow-origin'));
 response=await request('/storage/v1/bucket/lectures',{key:service});
 record('lectures_bucket_private',response,response.ok&&response.value?.public===false);
 const lectures=await request('/rest/v1/lectures?select=video_url&order=id&limit=60',{key:service});
 if(!lectures.ok||!Array.isArray(lectures.value))throw Error('video_discovery_failed');
 let objectPath;
 for(const lecture of lectures.value){
  const raw=lecture.video_url;if(typeof raw!=='string')continue;
  try{
   const url=new URL(raw);
   const match=url.pathname.match(/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/lectures\/(.+)$/);
   if(url.origin===base.origin&&match&&/\.(mp4|webm|mov)$/i.test(match[1])){objectPath=decodeURIComponent(match[1]);break;}
  }catch{if(/^[^?:#]+\.(mp4|webm|mov)$/i.test(raw)){objectPath=raw.replace(/^lectures\//,'');break;}}
 }
 if(!objectPath||objectPath.split('/').some(part=>!part||part==='.'||part==='..'))throw Error('video_discovery_failed');
 const signPath=`/storage/v1/object/sign/lectures/${objectPath.split('/').map(encodeURIComponent).join('/')}`;
 const signedExists=value=>typeof(value?.signedURL||value?.signedUrl)==='string'&&(value.signedURL||value.signedUrl).length>0;
 response=await request(signPath,{method:'POST',key:service,body:{expiresIn:60}});
 record('existing_video_service_sign_allowed',response,response.ok&&signedExists(response.value),{signedUrlExists:signedExists(response.value)});
 response=await request(signPath,{method:'POST',body:{expiresIn:60}});
 record('existing_video_anonymous_sign_denied',response,[400,401,403,404].includes(response.status)&&!signedExists(response.value),{signedUrlExists:signedExists(response.value)});
 result.passed=result.checks.length===10&&result.checks.every(check=>check.passed);
}catch(error){result.failure=['configuration','video_discovery_failed'].includes(error.message)?error.message:'read_only_check_failed';}
const folder=path.resolve('test_artifacts/enhancements');await mkdir(folder,{recursive:true});
await writeFile(path.join(folder,'live-security.json'),JSON.stringify(result,null,2)+'\n',{encoding:'utf8',mode:0o600});
console.log(JSON.stringify(result));if(!result.passed)process.exitCode=1;
