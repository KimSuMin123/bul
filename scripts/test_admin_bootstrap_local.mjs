import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {request as httpRequest} from 'node:http';
import {bootstrapAdmin,startBootstrapServer} from './admin_bootstrap_local.mjs';

const artifactRoot=path.resolve('test_artifacts');await mkdir(artifactRoot,{recursive:true});
const dir=await mkdtemp(path.join(artifactRoot,'bootstrap-mock-'));
const manifest={kind:'public-select-snapshot',projectHost:'fixture.invalid',jobId:'bootstrap-fixture',finishedAt:new Date().toISOString(),tables:{}};
const report={status:'passed',sourceJobId:manifest.jobId,tables:{}};
for(const name of ['users','courses','lectures','enrollments','payments','progress','certificates','qa_posts','qa_answers','exam_attempts']){
 const rows=name==='users'?[{id:'existing-admin',role:'admin'}]:[];
 manifest.tables[name]={rows,rowCount:rows.length};report.tables[name]={restored:rows.length,contentMatches:true};
}
const bytes=JSON.stringify(manifest),manifestFile=path.join(dir,'backup.json');report.sourceSha256=createHash('sha256').update(bytes).digest('hex');
await writeFile(manifestFile,bytes);await writeFile(`${manifestFile}.restore-report.json`,JSON.stringify(report));
const env={SUPABASE_URL:'https://fixture.invalid',SUPABASE_SERVICE_ROLE_KEY:'mock-service-key',SUPABASE_ANON_KEY:'mock-anon-key',ADMIN_CANONICAL_ID:'existing-admin',ADMIN_ROTATION_APPROVED_HOST:'fixture.invalid',ADMIN_BACKUP_MANIFEST_FILE:manifestFile};
const password='MockInputOnly123!';
const authId='11111111-1111-4111-8111-111111111111';
const email=`${createHash('sha256').update('existing-admin').digest('hex')}@lms.invalid`;
function fixture({linked=false,createLost=false,patchLost=false,patchReject=false,loginFail=false,wrongRole=false,extraAdmin=false,collision=false,wrongEmail=false,createRejected=false,changeLink=false}={}){
 const state={id:'existing-admin',role:'admin',auth_user_id:linked?authId:null,login_id:null};
 let auth=linked?{id:authId,email:wrongEmail?'unexpected@invalid.test':email}:null;
 const calls=[];
 const fetchImpl=async(value,options)=>{
  const url=new URL(value),body=options.body?JSON.parse(options.body):null;
  calls.push({path:url.pathname,method:options.method,query:url.search,body});
  assert.ok(!url.searchParams.get('select')?.split(',').includes('password'),'never query legacy password');
  if(url.pathname==='/rest/v1/users'){
   if(url.searchParams.has('or'))return Response.json(collision?[{id:'another-user'}]:[]);
   if(url.searchParams.get('role')==='eq.admin'&&options.method==='GET')return Response.json(extraAdmin?[state,{id:'second-admin',role:'admin'}]:[state]);
   if(options.method==='PATCH'){
    assert.equal(url.searchParams.get('role'),'eq.admin');assert.equal(url.searchParams.get('auth_user_id'),linked?`eq.${authId}`:'is.null');
    assert.equal(body.id,undefined);assert.equal(body.role,undefined);assert.equal(body.password,null);
    if(patchReject)return Response.json({},{status:409});
    if(changeLink)return Response.json([]);
    Object.assign(state,body);if(patchLost)throw new Error('simulated response loss');
   }
   return Response.json([{...state}]);
  }
  if(url.pathname==='/auth/v1/admin/users'){
   assert.equal(options.method,'POST');
   if(createRejected)return Response.json({},{status:422});
   auth={id:authId,email:body.email};if(createLost)throw new Error('simulated create response loss');
   return Response.json(auth);
  }
  if(url.pathname===`/auth/v1/admin/users/${authId}`)return Response.json(auth);
  if(url.pathname==='/auth/v1/token')return auth?Response.json({access_token:'mock-recovery-token',user:{id:authId}}):Response.json({},{status:401});
  if(url.pathname==='/functions/v1/lms-auth')return loginFail?Response.json({},{status:401}):Response.json({session:{access_token:'mock-login-token',user:{id:authId}},user:{id:state.id,role:'admin'}});
  if(url.pathname==='/rest/v1/rpc/current_lms_user')return Response.json({id:state.id,role:wrongRole?'student':'admin',loginId:'adsba'});
  if(url.pathname==='/auth/v1/logout')return new Response(null,{status:204});
  assert.fail('Unexpected mocked route');
 };
 return {state,calls,fetchImpl};
}

test('unlinked sole administrator is created and linked without changing canonical ID, role or references',async()=>{
 const f=fixture(),r=await bootstrapAdmin({env,password,fetchImpl:f.fetchImpl});
 assert.equal(r.status,'verified');assert.equal(r.verificationSession,'signed-out');
 assert.deepEqual(f.state,{id:'existing-admin',role:'admin',auth_user_id:authId,login_id:'adsba',password:null});
 assert.equal(f.calls.filter(c=>c.path==='/auth/v1/admin/users'&&c.method==='POST').length,1);
 assert.ok(!JSON.stringify(r).includes(password));assert.ok(!JSON.stringify(r).includes('mock-service-key'));
});
test('already linked administrator verifies synthetic identity before password rotation',async()=>{
 const f=fixture({linked:true}),r=await bootstrapAdmin({env,password,fetchImpl:f.fetchImpl});assert.equal(r.status,'verified');
 assert.equal(f.calls.filter(c=>c.method==='PUT').length,1);assert.ok(!f.calls.some(c=>c.path==='/auth/v1/admin/users'));
 const bad=fixture({linked:true,wrongEmail:true});assert.equal((await bootstrapAdmin({env,password,fetchImpl:bad.fetchImpl})).status,'blocked');assert.ok(!bad.calls.some(c=>['PUT','PATCH','POST'].includes(c.method)));
});
test('missing, mismatched or stale backup and invalid input stop before all remote requests',async()=>{
 for(const override of [{ADMIN_BACKUP_MANIFEST_FILE:undefined},{ADMIN_ROTATION_APPROVED_HOST:'other.invalid'},{SUPABASE_URL:'http://fixture.invalid'}]){
  const f=fixture();assert.equal((await bootstrapAdmin({env:{...env,...override},password,fetchImpl:f.fetchImpl})).status,'blocked');assert.equal(f.calls.length,0);
 }
 const stale={...manifest,finishedAt:new Date(Date.now()-25*60*60*1000).toISOString()},staleBytes=JSON.stringify(stale),staleFile=path.join(dir,'stale.json');
 await writeFile(staleFile,staleBytes);await writeFile(`${staleFile}.restore-report.json`,JSON.stringify({...report,sourceSha256:createHash('sha256').update(staleBytes).digest('hex')}));
 const f=fixture();assert.equal((await bootstrapAdmin({env:{...env,ADMIN_BACKUP_MANIFEST_FILE:staleFile},password,fetchImpl:f.fetchImpl})).status,'blocked');assert.equal(f.calls.length,0);
 assert.equal((await bootstrapAdmin({env,password:'weak',fetchImpl:f.fetchImpl})).status,'blocked');assert.equal(f.calls.length,0);
});
test('sole-admin mismatch and alias collision cannot create or modify Auth users',async()=>{
 for(const options of [{extraAdmin:true},{collision:true}]){const f=fixture(options);assert.equal((await bootstrapAdmin({env,password,fetchImpl:f.fetchImpl})).status,'blocked');assert.ok(!f.calls.some(c=>c.method!=='GET'));}
});
test('lost create response recovers only by password proof, lost profile response by fresh readback',async()=>{
 for(const options of [{createLost:true},{patchLost:true}]){const f=fixture(options),r=await bootstrapAdmin({env,password,fetchImpl:f.fetchImpl});assert.equal(r.status,'verified');assert.equal(f.calls.filter(c=>c.method==='PATCH').length,1);assert.ok(!f.calls.some(c=>c.method==='DELETE'));}
 const denied=fixture({createRejected:true}),r=await bootstrapAdmin({env,password,fetchImpl:denied.fetchImpl});assert.equal(r.status,'requires-recovery');assert.ok(!denied.calls.some(c=>c.method==='PATCH'));
});
test('ambiguous linkage or verification fails closed without deletion or blind rollback',async()=>{
 for(const options of [{patchReject:true},{changeLink:true},{loginFail:true},{wrongRole:true}]){
  const f=fixture(options),r=await bootstrapAdmin({env,password,fetchImpl:f.fetchImpl});assert.equal(r.status,'requires-recovery');assert.ok(!f.calls.some(c=>c.method==='DELETE'));assert.ok(f.calls.filter(c=>c.method==='PATCH').length<=1);assert.ok(!JSON.stringify(r).includes(password));
 }
});
test('loopback form checks Origin, Host, nonce and input before any one-use operation',async()=>{
 let calls=0;
 const local=await startBootstrapServer({perform:async()=>{calls++;return {status:'verified'};}});
 try{
  const page=await fetch(local.url),html=await page.text(),csrf=html.match(/name="csrf" value="([^"]+)"/)[1];
  assert.ok(html.includes('type="password"'));assert.ok(page.headers.get('content-security-policy').includes("frame-ancestors 'none'"));
  assert.equal(page.headers.get('referrer-policy'),'same-origin');
  const post=(body,headers={})=>fetch(`${local.url}/bootstrap`,{method:'POST',headers:{Origin:local.url,'Content-Type':'application/x-www-form-urlencoded',...headers},body:new URLSearchParams(body)});
  for(const response of [await post({csrf,password,confirmation:password},{Origin:'https://attacker.invalid'}),await post({csrf:'bad',password,confirmation:password}),await post({csrf,password:'weak',confirmation:'weak'})])assert.ok([400,403].includes(response.status),`Unexpected rejection status ${response.status}`);
  // Node fetch normalizes Host; send a real raw HTTP Host header for this check.
  const wrongHost=await new Promise((resolve,reject)=>{const request=httpRequest(`${local.url}/`,{headers:{Host:'attacker.invalid'}},response=>{response.resume();resolve(response.statusCode);});request.on('error',reject);request.end();});
  assert.equal(wrongHost,403);
  assert.equal(calls,0);
  const response=await post({csrf,password,confirmation:password});assert.equal(response.status,200);assert.ok(!(await response.text()).includes(password));assert.equal(calls,1);
  assert.equal((await post({csrf,password,confirmation:password})).status,410);assert.equal((await fetch(local.url)).status,410);assert.equal(calls,1);
 }finally{await local.close();}
});
test('concurrent or uncertain local submission is consumed once and cannot be repeated',async()=>{
 let calls=0,release;const hold=new Promise(resolve=>release=resolve);
 const local=await startBootstrapServer({perform:async()=>{calls++;await hold;return {status:'requires-recovery'};}});
 try{
  const html=await (await fetch(local.url)).text(),csrf=html.match(/name="csrf" value="([^"]+)"/)[1];
  const post=()=>fetch(`${local.url}/bootstrap`,{method:'POST',headers:{Origin:local.url,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf,password,confirmation:password})});
  const first=post();while(calls===0)await new Promise(resolve=>setTimeout(resolve,5));
  assert.equal((await post()).status,410);release();assert.equal((await first).status,409);assert.equal((await post()).status,410);assert.equal(calls,1);
 }finally{release();await local.close();}
});
test.after(async()=>{const resolved=path.resolve(dir);assert.ok(resolved.startsWith(artifactRoot+path.sep));await rm(resolved,{recursive:true,force:true});});
