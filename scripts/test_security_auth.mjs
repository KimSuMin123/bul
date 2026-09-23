import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler, digest, syntheticEmail } from '../supabase/functions/lms-auth/handler.js';

function fixture({ users = [], authUsers = [], role = 'student', rate = true, failProfile = false } = {}) {
 const profiles = structuredClone(users), identities = structuredClone(authUsers), calls = [];
 const fakeFetch = async (url, options) => {
  const parsed = new URL(url), path = parsed.pathname, body = options.body ? JSON.parse(options.body) : {};
  calls.push({ path, body, headers: options.headers, method: options.method });
  if (path.endsWith('/lms_auth_rate_limit')) return Response.json(rate);
  if (path.endsWith('/lms_find_user')) return Response.json(profiles.find(p => p.id.toLowerCase() === body.p_id.toLowerCase()) || null);
  if (path.endsWith('/lms_phone_available')) return Response.json(!profiles.some(p => p.phone === body.p_phone));
  if (path === '/auth/v1/user') return options.headers.Authorization === 'Bearer verified-session' ? Response.json({ id: 'auth-actor' }) : Response.json({}, { status: 401 });
  if (path === '/auth/v1/admin/users' && options.method === 'POST') {
   if (identities.some(u=>u.email===body.email)) return Response.json({}, {status:422});
   const user = { id: `auth-${identities.length+1}`, ...body }; identities.push(user); return Response.json(user);
  }
  if (path === '/auth/v1/token') {
   const found=identities.find(u=>u.email===body.email && u.password===body.password);
   return found ? Response.json({ access_token:'valid-token',refresh_token:'valid-refresh',user:{id:found.id} }) : Response.json({}, {status:400});
  }
  if (path.startsWith('/auth/v1/admin/users/')) return Response.json({success:true});
  if (path === '/rest/v1/users') {
   if (parsed.searchParams.has('auth_user_id') && options.method === 'GET') return Response.json([{ id:'actor',auth_user_id:'auth-actor',role }]);
   if (options.method === 'POST') {
    if(failProfile) return Response.json({}, {status:409});
    profiles.push({...body,created_at:'2026-09-23'}); return Response.json([profiles.at(-1)]);
   }
   if (options.method === 'PATCH') {
    const profile=profiles.find(p=>p.id===parsed.searchParams.get('id').slice(3));
    if (profile) Object.assign(profile,body);
    return Response.json(profile?[profile]:[]);
   }
   if(options.method==='DELETE') return new Response(null,{status:204});
  }
  assert.fail(`Unexpected mocked route ${options.method} ${url}`);
 };
 const handler=createHandler({url:'https://test.invalid',serviceKey:'server-secret',anonKey:'public-key',allowedOrigins:['https://app.invalid'],fetch:fakeFetch});
 return {profiles,identities,calls,async call(body,token) {
  const response=await handler(new Request('https://edge.invalid',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://app.invalid',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)}));
  return {status:response.status,body:await response.json()};
 }};
}
const legacy = { id:'Legacy',password:'OldPassword1!',name:'Legacy User',birth_date:'2000-01-01',phone:'01012345678',member_no:'M-1',role:'student',auth_user_id:null };
test('legacy plaintext login migrates on the server and never exposes password',async()=>{
 const f=fixture({users:[legacy]});
 const result=await f.call({action:'login',id:'legacy',password:legacy.password});
 assert.equal(result.status,200); assert.equal(result.body.user.id,'Legacy');
 assert.equal(result.body.user.password,undefined); assert.equal(f.profiles[0].password,null);
 assert.equal(f.profiles[0].auth_user_id,f.identities[0].id);
 assert.equal(result.body.session.access_token,'valid-token');
});
test('legacy hash comparison accepts the password but rejects pass-the-hash',async()=>{
 const hashed=`sha256:${await digest(legacy.password)}`;
 const good=fixture({users:[{...legacy,password:hashed}]});
 assert.equal((await good.call({action:'login',id:'legacy',password:legacy.password})).status,200);
 const bad=fixture({users:[{...legacy,password:hashed}]});
 assert.equal((await bad.call({action:'login',id:'legacy',password:hashed})).status,401);
 assert.equal(bad.identities.length,0);
});
test('wrong password never creates an Auth account',async()=>{
 const f=fixture({users:[legacy]});
 assert.equal((await f.call({action:'login',id:'legacy',password:'incorrect'})).status,401);
 assert.equal(f.identities.length,0);
});
test('existing Auth login does not recreate identities or trust profile role input',async()=>{
 const email=await syntheticEmail('legacy');
 const f=fixture({users:[{...legacy,password:null,auth_user_id:'known'}],authUsers:[{id:'known',email,password:'Password1!'}]});
 const result=await f.call({action:'login',id:'legacy',password:'Password1!',role:'admin'});
 assert.equal(result.status,200); assert.equal(result.body.user.role,'student');
 assert.equal(f.calls.filter(c=>c.path==='/auth/v1/admin/users').length,0);
});
test('public registration generates member number and ignores privileged role',async()=>{
 const f=fixture();
 const result=await f.call({action:'register',id:'new-user',password:'Password1!',name:'New',birthDate:'2000-01-01',phone:'010-1234-5678',role:'admin',memberNo:'forged'});
 assert.equal(result.status,200); assert.equal(result.body.user.role,'student');
 assert.match(result.body.user.memberNo,/^BUDDHA-/); assert.notEqual(result.body.user.memberNo,'forged');
 assert.equal(f.profiles[0].password,null); assert.equal(f.profiles[0].phone,'01012345678');
});
test('admin actions require a verified Auth identity and stored admin role',async()=>{
 for(const token of [undefined,'forged','public-key','server-secret']) {
  const f=fixture({role:'admin'});
  assert.equal((await f.call({action:'admin-delete',userId:'victim'},token)).status,401);
 }
 const student=fixture({role:'student'});
 assert.equal((await student.call({action:'admin-delete',userId:'victim',role:'admin'},'verified-session')).status,403);
 assert.equal(student.calls.some(c=>c.method==='DELETE'),false);
});
test('administrator registration can assign admin and password reset uses Auth admin endpoint',async()=>{
 const f=fixture({role:'admin',users:[{...legacy,auth_user_id:'known'}]});
 const reset=await f.call({action:'admin-reset',userId:'legacy',newPassword:'Updated1!'},'verified-session');
 assert.equal(reset.status,200);
 assert.ok(f.calls.some(c=>c.path==='/auth/v1/admin/users/known' && c.method==='PUT'));
 const created=await f.call({action:'admin-register',id:'new-admin',password:'Password1!',name:'Admin',birthDate:'2000-01-01',phone:'01099999999',role:'admin'},'verified-session');
 assert.equal(created.status,200); assert.equal(created.body.user.role,'admin');
});
test('name and phone are not sufficient to reset a password',async()=>{
 const f=fixture({users:[legacy]});
 assert.equal((await f.call({action:'reset-password',id:'legacy',name:legacy.name,phone:legacy.phone,newPassword:'Changed1!'})).status,400);
 assert.equal(f.calls.length,0);
});
test('rate limit failure denies login before credential lookup',async()=>{
 const f=fixture({users:[legacy],rate:false});
 assert.equal((await f.call({action:'login',id:'legacy',password:legacy.password})).status,429);
 assert.equal(f.calls.length,1);
});
test('profile persistence failure is not reported as successful registration',async()=>{
 const f=fixture({failProfile:true});
 const result=await f.call({action:'register',id:'new-user',password:'Password1!',name:'New',birthDate:'2000-01-01',phone:'01012345678'});
 assert.equal(result.status,400); assert.equal(result.body.user,undefined);
 assert.equal(JSON.stringify(result.body).includes('server-secret'),false);
});
test('legacy Korean and spaced ids can login and receive an administrator reset',async()=>{
 const f=fixture({role:'admin',users:[{...legacy,id:'한글 사용자'}]});
 const login=await f.call({action:'login',id:'  한글 사용자  ',password:legacy.password});
 assert.equal(login.status,200);assert.equal(login.body.user.id,'한글 사용자');
 const reset=await f.call({action:'admin-reset',userId:'한글 사용자',newPassword:'Changed123!'},'verified-session');
 assert.equal(reset.status,200);
 const available=await f.call({action:'availability',id:'한글 사용자'});
 assert.equal(available.body.idAvailable,false);
 const newUser=await f.call({action:'register',id:'신규 한글',password:'New12345!',name:'New',birthDate:'2000-01-01',phone:'01099999999'});
 assert.equal(newUser.status,400);
});
