import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createSmsHandler,renderMessage,solapiAuthorization,APPROVAL_NOTICE,OPERATOR_TEST_PHONE} from '../supabase/functions/lms-sms/handler.js';
const jobs=['enrollment_student','enrollment_admin','question_admin','answer_student'].map((kind,i)=>({id:`job-${i}`,lease_token:'lease',kind,payload:{name:'테스트 회원',phone:'01011111111',courseTitle:'불교입문',price:50000,questionContent:'질문 원문입니다.',lectureId:'l1',postId:'q1'}}));
function fixture({provider='mock',reply,throwSend=false,missingConfig=false,finish=false}={}) {
 const calls=[],results=[];let cursor=0;
 const handler=createSmsHandler({url:'https://db.invalid',serviceKey:'service',workerSecret:'worker',provider,apiKey:'key',apiSecret:'secret',sender:missingConfig?'':'0212345678',adminPhone:'01022222222',siteUrl:'https://academy.invalid',fetch:async(url,opts)=>{
  const body=JSON.parse(opts.body); calls.push({url,body,headers:opts.headers});
  if(url.endsWith('lms_claim_sms')) {assert.equal(body.p_limit,3);const batch=jobs.slice(cursor,cursor+body.p_limit);cursor+=batch.length;return Response.json(batch);}
  if(url.endsWith('lms_finish_sms')) {results.push(body);return Response.json(!finish);}
  if(throwSend) throw new Error('network contains private phone 01011111111');
  return reply?reply():Response.json({groupInfo:{groupId:'G1',count:{registeredSuccess:1,registeredFailed:0}}});
 }});
 return {calls,results,async call(token='worker',method='POST'){const r=await handler(new Request('https://edge.invalid',{method,headers:{Authorization:`Bearer ${token}`}}));return {status:r.status,body:await r.json()};}};
}
test('mock default records four notification cases without contacting provider',async()=>{
 const f=fixture(),r=await f.call();assert.equal(r.status,200);assert.equal(r.body.mock,3);assert.equal((await f.call()).body.mock,1);assert.ok(f.calls.every(c=>c.url.startsWith('https://db.invalid')));
 const text=renderMessage(jobs[0]);assert.ok(text.includes('301-0264-3664-41'));assert.ok(text.includes(APPROVAL_NOTICE));
 assert.ok(!renderMessage(jobs[2]).includes('테스트 회원'));
});
test('worker rejects anonymous and missing config before claiming work',async()=>{
 const f=fixture();assert.equal((await f.call('invalid')).status,401);assert.equal(f.calls.length,0);assert.equal((await f.call('worker','GET')).status,405);
 const m=fixture({provider:'solapi',missingConfig:true});assert.equal((await m.call()).status,503);assert.equal(m.calls.length,0);
});
test('SOLAPI signs documented date+salt and routes recipients correctly',async()=>{
 const h=await solapiAuthorization('key','secret','date','salt');assert.ok(h.endsWith(createHmac('sha256','secret').update('datesalt').digest('hex')));
 const f=fixture({provider:'solapi'}),r=await f.call();assert.equal(r.body.accepted,3);assert.equal((await f.call()).body.accepted,1);
 const sends=f.calls.filter(c=>c.url.includes('api.solapi.com'));assert.deepEqual(sends.map(c=>c.body.messages[0].to),['01011111111','01022222222','01022222222','01011111111']);
 assert.ok(sends.every(c=>c.body.allowDuplicates===false));assert.ok(f.results.every(r=>r.p_provider_id==='G1'));
});
test('429 retries but network/5xx ambiguity cannot blindly resend',async()=>{
 for(const [setup,status] of [[{reply:()=>Response.json({}, {status:429})},'retry'],[{throwSend:true},'uncertain'],[{reply:()=>Response.json({}, {status:503})},'uncertain'],[{reply:()=>Response.json({}, {status:400})},'failed'],[{reply:()=>Response.json({groupInfo:{count:{registeredSuccess:0,registeredFailed:1}}})},'failed']]){
  const f=fixture({provider:'solapi',...setup}),r=await f.call();assert.equal(r.body[status],3);assert.ok(f.results.every(v=>v.p_status===status));assert.ok(!JSON.stringify(r.body).includes('01011111111'));
 }
});
test('unknown success response is uncertain; failed result persistence stops processing',async()=>{
 const f=fixture({provider:'solapi',reply:()=>Response.json({})});assert.equal((await f.call()).body.uncertain,3);
 const lost=fixture({finish:true}),r=await lost.call();assert.equal(r.status,503);assert.equal(lost.results.length,1);assert.ok(!JSON.stringify(r.body).includes('테스트'));
});

test('question text and answer links are included, long content preserves full link within LMS byte budget',()=>{
 const text=renderMessage(jobs[2],'https://academy.invalid');assert.ok(text.includes('질문 원문입니다.'));assert.ok(text.includes('/#watch?id=l1&question=q1'));
 const long=renderMessage({...jobs[2],payload:{...jobs[2].payload,questionContent:'불교 질문'.repeat(2000)}},'https://academy.invalid');
 assert.ok(new TextEncoder().encode(long).length<=1900);assert.ok(long.includes('…'));assert.ok(long.endsWith('/#watch?id=l1&question=q1'));
 assert.ok(renderMessage(jobs[3],'https://academy.invalid').includes('/#watch?id=l1&question=q1'));
});

const testId='44444444-4444-4444-8444-444444444444';
const testJob={id:testId,event_key:`operator_test:${testId}`,kind:'enrollment_student',lease_token:'55555555-5555-4555-8555-555555555555',payload:{name:'Operator test',phone:OPERATOR_TEST_PHONE,courseTitle:'SMS test',price:0}};
function operatorFixture({testPhone=OPERATOR_TEST_PHONE,claimed=[testJob],provider='solapi',sender='0212345678'}={}){
 const calls=[];
 const handler=createSmsHandler({url:'https://db.invalid',serviceKey:'service',workerSecret:'worker',provider,apiKey:'key',apiSecret:'secret',sender,adminPhone:'01022222222',testPhone,siteUrl:'https://academy.invalid',fetch:async(url,options)=>{
  const body=JSON.parse(options.body);calls.push({url,body});
  if(url.endsWith('/lms_claim_sms_test'))return Response.json(claimed);
  if(url.endsWith('/lms_claim_sms'))return Response.json(claimed);
  if(url.endsWith('/lms_finish_sms'))return Response.json(true);
  return Response.json({groupInfo:{groupId:'test-group',count:{registeredSuccess:1,registeredFailed:0}}});
 }});
 return {calls,async call(input={action:'operator_test',job_id:testId},token='service',contentType='application/json'){
  const response=await handler(new Request('https://edge.invalid',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':contentType},body:typeof input==='string'?input:JSON.stringify(input)}));return {status:response.status,body:await response.json()};
 }};
}

test('operator test claims only its explicit UUID, sends only the configured approved recipient and records its lease',async()=>{
 const f=operatorFixture(),result=await f.call();assert.equal(result.status,200);assert.equal(result.body.processed,1);assert.equal(result.body.accepted,1);
 assert.ok(!f.calls.some(c=>c.url.endsWith('/lms_claim_sms')));
 assert.deepEqual(f.calls[0].body,{p_id:testId,p_phone:OPERATOR_TEST_PHONE});
 const sent=f.calls.find(c=>c.url.includes('api.solapi.com')).body.messages;assert.equal(sent.length,1);assert.equal(sent[0].to,OPERATOR_TEST_PHONE);
 const finished=f.calls.find(c=>c.url.endsWith('/lms_finish_sms')).body;assert.equal(finished.p_id,testId);assert.equal(finished.p_lease_token,testJob.lease_token);
 assert.ok(!JSON.stringify(result).includes(OPERATOR_TEST_PHONE));
});

test('operator test rejects untrusted role, missing or wrong test configuration and request overrides before any claim',async()=>{
 for(const [setup,input,token,status] of [
  [{},{action:'operator_test',job_id:testId},'worker',403],
  [{},{action:'operator_test',job_id:testId},'anonymous',401],
  [{testPhone:''},{action:'operator_test',job_id:testId},'service',503],
  [{testPhone:'01022222222'},{action:'operator_test',job_id:testId},'service',503],
  [{sender:''},{action:'operator_test',job_id:testId},'service',503],
  [{},{action:'operator_test',job_id:testId,to:'01022222222'},'service',400],
  [{},{action:'operator_test',job_id:[testId]},'service',400],
  [{},{action:'operator_test',job_id:'not-a-uuid'},'service',400],
  [{},{action:'unknown'},'service',400],
  [{},{job_id:testId},'service',400],
  [{},null,'service',400],[{},[],'service',400],[{},'{','service',400],
  [{},'x'.repeat(2049),'service',413]
 ]){const f=operatorFixture(setup);assert.equal((await f.call(input,token)).status,status);assert.equal(f.calls.length,0);}
 const f=operatorFixture();assert.equal((await f.call({},'service','text/plain')).status,400);assert.equal(f.calls.length,0);
});

test('operator test fails closed on wrong claimed recipient, kind, event, UUID, cardinality or missing target',async()=>{
 for(const claimed of [[{...testJob,payload:{...testJob.payload,phone:'01022222222'}}],[{...testJob,kind:'enrollment_admin'}],[{...testJob,event_key:'enrollment:production'}],[{...testJob,id:crypto.randomUUID()}],[testJob,testJob]]){
  const f=operatorFixture({claimed});assert.equal((await f.call()).status,503);assert.equal(f.calls.length,1);assert.ok(f.calls[0].url.endsWith('/lms_claim_sms_test'));
 }
 const missing=operatorFixture({claimed:[]});assert.equal((await missing.call()).status,409);assert.equal(missing.calls.length,1);
 const normal=operatorFixture();assert.equal((await normal.call({})).status,503);assert.equal(normal.calls.length,1);assert.ok(normal.calls[0].url.endsWith('/lms_claim_sms'));
});

test('migration 004 preserves service permissions and isolates targeted leases from normal jobs in actual PostgreSQL',async t=>{
 const db=new PGlite();t.after(()=>db.close());
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE SCHEMA lms_private;CREATE SCHEMA auth;CREATE SCHEMA storage;
 CREATE TABLE auth.users(id uuid PRIMARY KEY);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 GRANT USAGE ON SCHEMA auth,storage TO anon,authenticated,service_role;CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text,metadata jsonb);ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
 GRANT SELECT ON storage.objects TO anon;GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated;`);
 const bootstrap=await readFile(new URL('../database_setup.sql',import.meta.url),'utf8');await db.exec(bootstrap.slice(0,bootstrap.indexOf('-- Row Level Security')));
 for(const name of ['202609230001_security.sql','202609230002_course_writes.sql','202609230003_enhancements.sql','202609230004_sms_operator_test.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
 const role=async name=>db.exec(`RESET ROLE;SET ROLE ${name}`);
 const add=async({id=crypto.randomUUID(),event,kind='enrollment_student',phone=OPERATOR_TEST_PHONE,status='pending',attempts=0,due='2000-01-01'}={})=>{
  await role('postgres');await db.query('INSERT INTO lms_private.sms_outbox(id,event_key,kind,payload,status,attempts,next_attempt_at) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,event||`operator_test:${id}`,kind,JSON.stringify({phone}),status,attempts,due]);return id;
 };
 const claim=async id=>(await db.query('SELECT * FROM public.lms_claim_sms_test($1,$2)',[id,OPERATOR_TEST_PHONE])).rows;
 const normalId=await add({event:'enrollment:production'});const target=await add({id:testId});const other=await add();
 for(const name of ['anon','authenticated']){await role(name);await assert.rejects(()=>claim(target));await assert.rejects(()=>db.query('SELECT * FROM public.lms_claim_sms(3)'));}
 await role('service_role');assert.deepEqual(await claim(normalId),[]);
 await assert.rejects(()=>db.query('SELECT * FROM public.lms_claim_sms_test($1,$2)',[target,'01022222222']));
 const [claimed]=await claim(target);assert.equal(claimed.id,target);assert.equal(claimed.attempts,1);assert.ok(claimed.lease_token);assert.deepEqual(await claim(target),[]);
 const normal=(await db.query('SELECT * FROM public.lms_claim_sms(3)')).rows;assert.deepEqual(normal.map(row=>row.id),[normalId]);
 assert.equal((await db.query("SELECT lms_finish_sms($1,$2,'accepted','provider_accepted','test-group') AS saved",[target,claimed.lease_token])).rows[0].saved,true);
 assert.deepEqual(await claim(target),[]);
 for(const options of [{kind:'enrollment_admin'},{phone:'01022222222'},{status:'accepted'},{status:'mock'},{status:'failed'},{status:'uncertain'},{attempts:5},{due:'2999-01-01'},{event:'operator_test:wrong-id'}]){const id=await add(options);await role('service_role');assert.deepEqual(await claim(id),[]);}
 const prefixLookalike=await add({event:'operatorXtest:ordinary'});await role('service_role');assert.deepEqual((await db.query('SELECT * FROM public.lms_claim_sms(50)')).rows.map(row=>row.id),[prefixLookalike]);
 const [expired]=await claim(other);await role('postgres');await db.query("UPDATE lms_private.sms_outbox SET lease_until=now()-interval '1 minute' WHERE id=$1",[other]);
 await role('service_role');await db.query('SELECT * FROM public.lms_claim_sms(50)');await role('postgres');assert.equal((await db.query('SELECT status FROM lms_private.sms_outbox WHERE id=$1',[other])).rows[0].status,'processing');
 await role('service_role');assert.deepEqual(await claim(other),[]);await role('postgres');assert.equal((await db.query('SELECT status FROM lms_private.sms_outbox WHERE id=$1',[other])).rows[0].status,'uncertain');
 const audit=(await db.query('SELECT status,code FROM lms_private.sms_attempts WHERE outbox_id=$1',[other])).rows;assert.deepEqual(audit,[{status:'uncertain',code:'lease_expired'}]);assert.ok(expired.lease_token);
});

test('verify_credentials validates SOLAPI balance API response and detects 401',async()=>{
 const f=createSmsHandler({url:'https://db.invalid',serviceKey:'service',provider:'solapi',apiKey:'key',apiSecret:'secret',fetch:async url=>{
  if(url.includes('/cash/v1/balance')) return Response.json({balance:5000,point:0});
  return Response.json({});
 }});
 const req=new Request('https://edge.invalid',{method:'POST',headers:{Authorization:'Bearer service','Content-Type':'application/json'},body:JSON.stringify({action:'verify_credentials'})});
 const res=await f(req);assert.equal(res.status,200);
 const data=await res.json();assert.equal(data.ok,true);assert.equal(data.balance,5000);

 const fail=createSmsHandler({url:'https://db.invalid',serviceKey:'service',provider:'solapi',apiKey:'bad',apiSecret:'bad',fetch:async()=>new Response(JSON.stringify({}),{status:401})});
 const failRes=await fail(new Request('https://edge.invalid',{method:'POST',headers:{Authorization:'Bearer service','Content-Type':'application/json'},body:JSON.stringify({action:'verify_credentials'})}));
 const failData=await failRes.json();assert.equal(failData.ok,false);assert.equal(failData.status,401);assert.ok(failData.error.includes('401'));
});

test('test_send dispatches 4 messages to approved target phone',async()=>{
 const sends=[];
 const f=createSmsHandler({url:'https://db.invalid',serviceKey:'service',provider:'solapi',apiKey:'key',apiSecret:'secret',sender:'01080287565',fetch:async(url,opts)=>{
  if(url.includes('/send-many/detail')){sends.push(JSON.parse(opts.body));return Response.json({groupInfo:{groupId:'G1',count:{registeredSuccess:1,registeredFailed:0}}});}
  return Response.json({});
 }});
 const req=new Request('https://edge.invalid',{method:'POST',headers:{Authorization:'Bearer service','Content-Type':'application/json'},body:JSON.stringify({action:'test_send',to:'01030327565'})});
 const res=await f(req);assert.equal(res.status,200);
 const data=await res.json();assert.equal(data.processed,4);assert.equal(data.accepted,4);
 assert.equal(sends.length,4);
 assert.ok(sends.every(s=>s.messages[0].to==='01030327565'&&s.messages[0].from==='01080287565'));
});

