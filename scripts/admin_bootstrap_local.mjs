// One-use loopback bootstrap. Passwords are accepted only through the local form,
// remain in memory, and are never written to files, CLI arguments or console.
import {createServer} from 'node:http';
import {randomBytes,timingSafeEqual,createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
import {loadEnvFile} from 'node:process';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {verifyBackupEvidence} from './admin_account_rotate.mjs';

const alias='adsba';
const profileColumns='id,login_id,role,auth_user_id';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validPassword=value=>typeof value==='string'&&value.length>=8&&value.length<=128&&/[A-Za-z]/.test(value)&&/[0-9]/.test(value)&&/[^A-Za-z0-9]/.test(value);
const expectedEmail=id=>`${createHash('sha256').update(id.trim().toLowerCase()).digest('hex')}@lms.invalid`;

export async function bootstrapAdmin({env=process.env,password,fetchImpl=fetch}={}) {
 let mutationAttempted=false,phase='preflight',canonicalId='',verificationSession='not-created';
 const sessions=new Set();
 let call;
 try {
  const base=new URL(env.SUPABASE_URL||env.VITE_SUPABASE_URL||'');
  const service=env.SUPABASE_SERVICE_ROLE_KEY,anon=env.SUPABASE_ANON_KEY||env.VITE_SUPABASE_ANON_KEY;
  canonicalId=String(env.ADMIN_CANONICAL_ID||'').trim();
  if(base.protocol!=='https:'||base.username||base.password||base.pathname!=='/'||base.search||base.hash||!service||!anon||!canonicalId||canonicalId.length>50||env.ADMIN_ROTATION_APPROVED_HOST!==base.hostname||!validPassword(password))throw new Error('preflight');
  const backup=await verifyBackupEvidence(env.ADMIN_BACKUP_MANIFEST_FILE,base.hostname,canonicalId);
  call=async(endpoint,{method='GET',body,token=service,key=service}={})=>{
   const response=await fetchImpl(`${base.origin}${endpoint}`,{method,headers:{apikey:key,Authorization:`Bearer ${token}`,'Content-Type':'application/json',Prefer:'return=representation'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000),redirect:'error'});
   if(!response.ok)throw new Error('remote_operation');
   return response.status===204?null:response.json();
  };
  const admins=await call(`/rest/v1/users?role=eq.admin&select=${profileColumns}&limit=2`);
  if(!Array.isArray(admins)||admins.length!==1||admins[0].id!==canonicalId||admins[0].role!=='admin')throw new Error('sole_admin_required');
  const existing=admins[0],email=expectedEmail(canonicalId);
  const collisions=await call(`/rest/v1/users?or=(id.ilike.${alias},login_id.ilike.${alias})&select=id&limit=2`);
  if(!Array.isArray(collisions)||collisions.some(row=>row.id!==canonicalId))throw new Error('alias_collision');
  const query=`/rest/v1/users?id=eq.${encodeURIComponent(canonicalId)}&select=${profileColumns}`;
  let authId=existing.auth_user_id;
  if(authId){
   if(!uuid.test(authId))throw new Error('invalid_link');
   const auth=await call(`/auth/v1/admin/users/${authId}`);
   const identity=auth.user||auth;
   if(identity.id!==authId||identity.email!==email)throw new Error('unexpected_link');
   phase='auth_password';mutationAttempted=true;
   await call(`/auth/v1/admin/users/${authId}`,{method:'PUT',body:{password}});
  }else{
   phase='auth_create';mutationAttempted=true;
   try {
    const created=await call('/auth/v1/admin/users',{method:'POST',body:{email,password,email_confirm:true}});
    const identity=created.user||created;
    if(!uuid.test(identity.id||'')||identity.email!==email)throw new Error('unexpected_identity');
    authId=identity.id;
   }catch{
    // A lost create response or an interrupted earlier bootstrap is recovered
    // only by proving this exact supplied password for the canonical identity.
    const session=await call('/auth/v1/token?grant_type=password',{method:'POST',token:anon,key:anon,body:{email,password}});
    if(!session?.access_token||!uuid.test(session.user?.id||''))throw new Error('create_unconfirmed');
    sessions.add(session.access_token);authId=session.user.id;
    const recovered=await call(`/auth/v1/admin/users/${authId}`);
    const identity=recovered.user||recovered;
    if(identity.id!==authId||identity.email!==email)throw new Error('unexpected_recovery');
   }
  }
  phase='profile_link';
  const unchangedLink=existing.auth_user_id?`eq.${encodeURIComponent(existing.auth_user_id)}`:'is.null';
  try {
   await call(`${query}&role=eq.admin&auth_user_id=${unchangedLink}`,{method:'PATCH',body:{auth_user_id:authId,login_id:alias,password:null}});
  }catch{/* A committed PATCH can lose its response; verify through a fresh SELECT. */}
  const confirmed=await call(query);
  if(!Array.isArray(confirmed)||confirmed.length!==1||confirmed[0].id!==canonicalId||confirmed[0].role!=='admin'||confirmed[0].auth_user_id!==authId||confirmed[0].login_id!==alias)throw new Error('link_unconfirmed');
  phase='verify_login';
  const login=await call('/functions/v1/lms-auth',{method:'POST',token:anon,key:anon,body:{action:'login',id:alias,password}});
  if(typeof login?.session?.access_token==='string'&&login.session.access_token)sessions.add(login.session.access_token);
  if(!login?.session?.access_token||login.session.user?.id!==authId||login.user?.id!==canonicalId||login.user?.role!=='admin')throw new Error('login_unconfirmed');
  const profile=await call('/rest/v1/rpc/current_lms_user',{method:'POST',body:{},token:login.session.access_token,key:anon});
  const finalRows=await call(query);
  if(profile?.id!==canonicalId||profile?.role!=='admin'||profile?.loginId!==alias||finalRows?.length!==1||finalRows[0].id!==canonicalId||finalRows[0].role!=='admin'||finalRows[0].auth_user_id!==authId||finalRows[0].login_id!==alias)throw new Error('verification_failed');
  verificationSession='signed-out';
  for(const token of sessions){try{await call('/auth/v1/logout?scope=local',{method:'POST',token,key:anon});sessions.delete(token);}catch{verificationSession='logout-unconfirmed';}}
  return {status:'verified',canonicalId,loginId:alias,role:'admin',changesApplied:true,verificationSession,backup};
 }catch{
  // Never delete a possibly committed Auth identity or overwrite concurrent
  // profile changes. An uncertain attempt requires operator investigation.
  return {status:mutationAttempted?'requires-recovery':'blocked',phase,changesApplied:mutationAttempted?'unconfirmed':false,
   message:mutationAttempted?'계정 변경 결과가 불확실합니다. 반복 제출하지 말고 운영자가 Auth 연결과 새 비밀번호 로그인을 확인해야 합니다.':'사전 조건을 확인하지 못했습니다. 대상 호스트, 최근 복원 검증 백업, 기존 단일 관리자 및 서버 설정을 확인하세요.'};
 }finally{
  // Best effort cleanup of any verification session, without logging secrets.
  if(call)for(const token of sessions){try{await call('/auth/v1/logout?scope=local',{method:'POST',token,key:env.SUPABASE_ANON_KEY||env.VITE_SUPABASE_ANON_KEY});}catch{}}
  password=undefined;
 }
}

// same-origin preserves the browser's Origin on native form POST while never
// sending a Referer outside this loopback origin. no-referrer produces Origin:null.
const headers={'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Pragma':'no-cache','Referrer-Policy':'same-origin','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"};
const html=body=>`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>관리자 계정 일회성 설정</title><body><main>${body}</main></body></html>`;
const safeEqual=(left,right)=>typeof left==='string'&&Buffer.byteLength(left)===Buffer.byteLength(right)&&timingSafeEqual(Buffer.from(left),Buffer.from(right));

export async function startBootstrapServer({env=process.env,perform=bootstrapAdmin,onResult=()=>{},timeoutMs=15*60*1000}={}){
 const csrf=randomBytes(32).toString('hex');let state='ready',origin='';
 const server=createServer(async(req,res)=>{
  const send=(status,body)=>{res.writeHead(status,headers);res.end(html(body));};
  if(!origin||req.socket.remoteAddress!=='127.0.0.1'||req.headers.host!==new URL(origin).host){send(403,'허용되지 않은 요청입니다.');return;}
  if(req.method==='GET'&&req.url==='/'){
   if(state!=='ready'){send(410,'이 일회성 입력 창은 이미 사용되었습니다. 반복 제출하지 마세요.');return;}
   send(200,`<h1>기존 관리자 계정 설정</h1><p>기존 회원 ID와 역할을 유지하고 로그인 별칭 adsba를 설정합니다. 비밀번호는 전송 후 파일이나 로그에 저장하지 않습니다.</p><form method="post" action="/bootstrap" autocomplete="off"><input type="hidden" name="csrf" value="${csrf}"><label>새 비밀번호 <input type="password" name="password" autocomplete="new-password" required minlength="8" maxlength="128"></label><label>새 비밀번호 확인 <input type="password" name="confirmation" autocomplete="new-password" required minlength="8" maxlength="128"></label><p>영문·숫자·기호를 포함한 8~128자를 입력하세요.</p><button type="submit">관리자 계정 설정 및 로그인 검증</button></form>`);return;
  }
  if(req.method!=='POST'||req.url!=='/bootstrap'){send(405,'지원하지 않는 요청입니다.');return;}
  if(req.headers.origin!==origin||!['same-origin',undefined].includes(req.headers['sec-fetch-site'])||!String(req.headers['content-type']||'').startsWith('application/x-www-form-urlencoded')){send(403,'허용되지 않은 요청입니다.');return;}
  if(state!=='ready'){send(410,'이미 처리 중이거나 사용된 입력 창입니다.');return;}
  let raw=Buffer.alloc(0),password='',confirmation='';
  try{
   const chunks=[];let length=0;
   for await(const chunk of req){length+=chunk.length;if(length>4096){send(413,'입력 크기가 너무 큽니다.');return;}chunks.push(chunk);}
   raw=Buffer.concat(chunks);for(const chunk of chunks)chunk.fill(0);
   const fields=new URLSearchParams(raw.toString('utf8'));
   if(!safeEqual(fields.get('csrf'),csrf)){send(403,'입력 창의 인증 값을 확인하지 못했습니다.');return;}
   password=fields.get('password');confirmation=fields.get('confirmation');fields.delete('password');fields.delete('confirmation');
   if(!validPassword(password)||password!==confirmation){send(400,'비밀번호 형식 또는 확인 값이 일치하지 않습니다. 뒤로 돌아가 다시 입력하세요.');return;}
   // No await between this final gate and locking: concurrent submissions cannot both mutate.
   if(state!=='ready'){send(410,'이미 처리 중이거나 사용된 입력 창입니다.');return;}
   state='processing';
   let result;try{result=await perform({env,password});}catch{result={status:'requires-recovery',changesApplied:'unconfirmed'};}
   state='finished';
   try{onResult(result);}catch{/* Observability must not alter the account result. */}
   const ok=result.status==='verified';
   send(ok?200:409,ok?'<h1>관리자 로그인 검증 완료</h1><p>아이디 adsba와 입력한 새 비밀번호로 로그인하세요. 이 입력 창은 다시 사용할 수 없습니다.</p>':'<h1>운영자 확인 필요</h1><p>처리가 완료되지 않았거나 결과가 불확실합니다. 반복 제출하지 말고 운영자가 백업·Auth 연결 상태를 확인해야 합니다. 입력값은 표시하거나 저장하지 않았습니다.</p>');
  }catch{state=state==='ready'?'ready':'finished';if(!res.headersSent)send(400,'요청을 처리하지 못했습니다.');}
  finally{raw.fill(0);password='';confirmation='';}
 });
 server.headersTimeout=5000;server.requestTimeout=10000;
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 origin=`http://127.0.0.1:${server.address().port}`;
 const timer=setTimeout(()=>{state='finished';server.close();server.closeAllConnections();},timeoutMs);timer.unref();
 return {url:origin,server,close:async()=>{clearTimeout(timer);server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 try{
  const envPath=path.resolve('.env');if(existsSync(envPath))loadEnvFile(envPath);
  const instance=await startBootstrapServer({onResult:result=>console.log(JSON.stringify({status:result.status,phase:result.phase,changesApplied:result.changesApplied,verificationSession:result.verificationSession}))});
  console.log(`Local one-use administrator form: ${instance.url}`);
  console.log('Enter the new password in the browser only. The form expires in 15 minutes.');
 }catch{console.error('Local administrator setup could not start. No credentials or remote response details are logged.');process.exitCode=1;}
}
