// Server-only runbook tool. Never stores passwords or prints remote response bodies.
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export async function verifyBackupEvidence(file,host,canonicalId){
  if(!file)throw new Error('ADMIN_BACKUP_MANIFEST_FILE is required before account changes');
  const bytes=await readFile(file),snapshot=JSON.parse(bytes.toString('utf8'));
  const restored=JSON.parse(await readFile(`${file}.restore-report.json`,'utf8'));
  if(snapshot.kind!=='public-select-snapshot'||snapshot.projectHost!==host||snapshot.jobId!==restored.sourceJobId||restored.status!=='passed'||restored.sourceSha256!==createHash('sha256').update(bytes).digest('hex'))throw new Error('Backup target or verified content mismatch');
  const age=Date.now()-Date.parse(snapshot.finishedAt);
  if(!Number.isFinite(age)||age<0||age>86400000)throw new Error('A verified backup from the last 24 hours is required');
  for(const name of ['users','courses','lectures','enrollments','payments','progress','certificates','qa_posts','qa_answers','exam_attempts']){
    const table=snapshot.tables?.[name],check=restored.tables?.[name];
    if(!table||!Array.isArray(table.rows)||table.rows.length!==table.rowCount||check?.restored!==table.rowCount||check.contentMatches!==true)throw new Error('Incomplete SELECT backup evidence');
  }
  if(!snapshot.tables.users.rows.some(row=>row.id===canonicalId&&row.role==='admin'))throw new Error('Target administrator absent from backup');
  return {kind:snapshot.kind,finishedAt:snapshot.finishedAt,sourceSha256:restored.sourceSha256};
}

export async function hiddenPassword() {
  if(!process.stdin.isTTY)throw new Error('NEW_ADMIN_PASSWORD or an interactive terminal is required');
  process.stdout.write('New administrator password (hidden): ');
  const input=process.stdin,wasRaw=input.isRaw;input.setRawMode(true);input.resume();input.setEncoding('utf8');
  return new Promise((resolve,reject)=>{
    let value='';
    const done=()=>{input.off('data',receive);input.setRawMode(wasRaw);input.pause();process.stdout.write('\n');};
    const receive=chunk=>{for(const char of chunk){
      if(char==='\r'||char==='\n'){done();resolve(value);return;}
      if(char==='\u0003'){done();reject(new Error('Cancelled'));return;}
      if(char==='\u007f'||char==='\b')value=value.slice(0,-1);
      else if(char>=' ')value+=char;
    }};
    input.on('data',receive);
  });
}
export async function rotateAdmin({env=process.env,apply=false,password,fetchImpl=fetch}={}) {
  const url=new URL(env.SUPABASE_URL||'');
  if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/')throw new Error('SUPABASE_URL must be an HTTPS project origin');
  const service=env.SUPABASE_SERVICE_ROLE_KEY,anon=env.SUPABASE_ANON_KEY,adminToken=env.ADMIN_ACCESS_TOKEN;
  const canonicalId=env.ADMIN_CANONICAL_ID,alias=(env.NEW_ADMIN_LOGIN||'adsba').trim().toLowerCase();
  if(!service||!anon||!adminToken||!canonicalId)throw new Error('Required server credentials or canonical administrator ID missing');
  if(!/^[a-z0-9_.-]{2,50}$/.test(alias))throw new Error('Invalid login alias');
  if(apply&&env.ADMIN_ROTATION_APPROVED_HOST!==url.hostname)throw new Error('Approved target hostname does not match');
  const backup=apply?await verifyBackupEvidence(env.ADMIN_BACKUP_MANIFEST_FILE,url.hostname,canonicalId):null;
  const call=async(endpoint,{method='GET',body,token=service,key=service}={})=>{
    const response=await fetchImpl(`${url.origin}${endpoint}`,{method,headers:{apikey:key,Authorization:`Bearer ${token}`,'Content-Type':'application/json',Prefer:'return=representation'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000),redirect:'error'});
    if(!response.ok)throw new Error('Remote API operation failed');
    return response.status===204?null:response.json();
  };
  const identity=await call('/auth/v1/user',{token:adminToken,key:anon});
  const profile=await call('/rest/v1/rpc/current_lms_user',{method:'POST',body:{},token:adminToken,key:anon});
  if(profile?.role!=='admin'||profile.id!==canonicalId)throw new Error('Authenticated administrator must match the requested canonical account');
  const query=`/rest/v1/users?id=eq.${encodeURIComponent(canonicalId)}&select=id,login_id,role,auth_user_id`;
  const rows=await call(query),existing=rows?.[0];
  if(rows?.length!==1||existing.role!=='admin'||!existing.auth_user_id||identity?.id!==existing.auth_user_id)throw new Error('Existing linked administrator required; complete security migration first');
  // Database namespace constraint is authoritative and prevents races with registrations.
  const auth=await call(`/auth/v1/admin/users/${encodeURIComponent(existing.auth_user_id)}`);
  const expectedEmail=`${createHash('sha256').update(canonicalId.trim().toLowerCase()).digest('hex')}@lms.invalid`;
  if(auth.id!==existing.auth_user_id||auth.email!==expectedEmail)throw new Error('Unexpected Auth linkage; no changes made');
  if(!apply)return {status:'preflight-only',canonicalId,oldLogin:existing.login_id||null,newLogin:alias,role:'admin',changesApplied:false};
  const nextPassword=password??env.NEW_ADMIN_PASSWORD??await hiddenPassword();
  if(nextPassword.length<8||!/[A-Za-z]/.test(nextPassword)||!/[0-9]/.test(nextPassword)||!/[\W_]/.test(nextPassword))throw new Error('New password must contain letters, digits and symbols and at least 8 characters');
  let aliasAttempted=false,passwordAttempted=false;
  try {
    aliasAttempted=true;
    const updated=await call(query,{method:'PATCH',body:{login_id:alias}});
    if(updated?.length!==1||updated[0].id!==canonicalId||updated[0].role!=='admin'||updated[0].login_id!==alias)throw new Error('Alias update not confirmed');
    passwordAttempted=true;
    await call(`/auth/v1/admin/users/${encodeURIComponent(existing.auth_user_id)}`,{method:'PUT',body:{password:nextPassword}});
    const login=await call('/functions/v1/lms-auth',{method:'POST',body:{action:'login',id:alias,password:nextPassword},token:anon,key:anon});
    if(!login?.session?.access_token)throw new Error('New login failed');
    const verified=await call('/rest/v1/rpc/current_lms_user',{method:'POST',body:{},token:login.session.access_token,key:anon});
    if(verified?.id!==canonicalId||verified.role!=='admin')throw new Error('New session role mismatch');
    const finalRows=await call(query);
    if(finalRows?.length!==1||finalRows[0].id!==canonicalId||finalRows[0].role!=='admin'||finalRows[0].auth_user_id!==existing.auth_user_id||finalRows[0].login_id!==alias)throw new Error('Final profile mismatch');
    // Do not leave this verification session active; logout failure is reported separately.
    let verificationSession='signed-out';
    try{await call('/auth/v1/logout?scope=local',{method:'POST',token:login.session.access_token,key:anon});}catch{verificationSession='logout-unconfirmed';}
    return {status:'verified',canonicalId,newLogin:alias,role:'admin',changesApplied:true,verificationSession,backup};
  } catch {
    let aliasRollback='not-required';
    if(aliasAttempted){
      try{
        const current=(await call(query))?.[0];
        if(current?.login_id===alias){
          await call(`${query}&login_id=eq.${encodeURIComponent(alias)}`,{method:'PATCH',body:{login_id:existing.login_id||null}});
          const restored=(await call(query))?.[0];
          aliasRollback=restored?.login_id===(existing.login_id||null)?'confirmed':'unconfirmed';
        }else aliasRollback=current?.login_id===(existing.login_id||null)?'confirmed':'unconfirmed';
      }catch{aliasRollback='unconfirmed';}
    }
    return {status:'requires-recovery',canonicalId,aliasRollback,passwordState:passwordAttempted?'may-have-changed':'unchanged',changesApplied:'unconfirmed',instructions:'Do not blindly retry. Verify canonical login with the new password; if uncertain, reset through the trusted server-side Auth admin flow. Old password cannot be recovered.'};
  }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  try{const result=await rotateAdmin({apply:process.argv.includes('--apply')});console.log(JSON.stringify(result));if(result.status==='requires-recovery')process.exitCode=1;}
  catch{console.error('Administrator operation failed; no credential or remote response details are logged. Check required variables and migration prerequisites.');process.exitCode=1;}
}
