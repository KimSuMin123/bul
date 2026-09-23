import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createSmsHandler,renderMessage,solapiAuthorization,APPROVAL_NOTICE} from '../supabase/functions/lms-sms/handler.js';
const jobs=['enrollment_student','enrollment_admin','question_admin','answer_student'].map((kind,i)=>({id:`job-${i}`,lease_token:'lease',kind,payload:{name:'테스트 회원',phone:'01011111111',courseTitle:'불교입문',price:50000,questionContent:'질문 원문입니다.',lectureId:'l1',postId:'q1'}}));
function fixture({provider='mock',reply,throwSend=false,missingConfig=false,finish=false}={}) {
 const calls=[],results=[];
 const handler=createSmsHandler({url:'https://db.invalid',serviceKey:'service',workerSecret:'worker',provider,apiKey:'key',apiSecret:'secret',sender:missingConfig?'':'0212345678',adminPhone:'01022222222',siteUrl:'https://academy.invalid',fetch:async(url,opts)=>{
  const body=JSON.parse(opts.body); calls.push({url,body,headers:opts.headers});
  if(url.endsWith('lms_claim_sms')) return Response.json(jobs);
  if(url.endsWith('lms_finish_sms')) {results.push(body);return Response.json(!finish);}
  if(throwSend) throw new Error('network contains private phone 01011111111');
  return reply?reply():Response.json({groupInfo:{groupId:'G1',count:{registeredSuccess:1,registeredFailed:0}}});
 }});
 return {calls,results,async call(token='worker',method='POST'){const r=await handler(new Request('https://edge.invalid',{method,headers:{Authorization:`Bearer ${token}`}}));return {status:r.status,body:await r.json()};}};
}
test('mock default records four notification cases without contacting provider',async()=>{
 const f=fixture(),r=await f.call();assert.equal(r.status,200);assert.equal(r.body.mock,4);assert.ok(f.calls.every(c=>c.url.startsWith('https://db.invalid')));
 const text=renderMessage(jobs[0]);assert.ok(text.includes('301-0264-3664-41'));assert.ok(text.includes(APPROVAL_NOTICE));
 assert.ok(!renderMessage(jobs[2]).includes('테스트 회원'));
});
test('worker rejects anonymous and missing config before claiming work',async()=>{
 const f=fixture();assert.equal((await f.call('invalid')).status,401);assert.equal(f.calls.length,0);assert.equal((await f.call('worker','GET')).status,405);
 const m=fixture({provider:'solapi',missingConfig:true});assert.equal((await m.call()).status,503);assert.equal(m.calls.length,0);
});
test('SOLAPI signs documented date+salt and routes recipients correctly',async()=>{
 const h=await solapiAuthorization('key','secret','date','salt');assert.ok(h.endsWith(createHmac('sha256','secret').update('datesalt').digest('hex')));
 const f=fixture({provider:'solapi'}),r=await f.call();assert.equal(r.body.accepted,4);
 const sends=f.calls.filter(c=>c.url.includes('api.solapi.com'));assert.deepEqual(sends.map(c=>c.body.messages[0].to),['01011111111','01022222222','01022222222','01011111111']);
 assert.ok(sends.every(c=>c.body.allowDuplicates===false));assert.ok(f.results.every(r=>r.p_provider_id==='G1'));
});
test('429 retries but network/5xx ambiguity cannot blindly resend',async()=>{
 for(const [setup,status] of [[{reply:()=>Response.json({}, {status:429})},'retry'],[{throwSend:true},'uncertain'],[{reply:()=>Response.json({}, {status:503})},'uncertain'],[{reply:()=>Response.json({}, {status:400})},'failed'],[{reply:()=>Response.json({groupInfo:{count:{registeredSuccess:0,registeredFailed:1}}})},'failed']]){
  const f=fixture({provider:'solapi',...setup}),r=await f.call();assert.equal(r.body[status],4);assert.ok(f.results.every(v=>v.p_status===status));assert.ok(!JSON.stringify(r.body).includes('01011111111'));
 }
});
test('unknown success response is uncertain; failed result persistence stops processing',async()=>{
 const f=fixture({provider:'solapi',reply:()=>Response.json({})});assert.equal((await f.call()).body.uncertain,4);
 const lost=fixture({finish:true}),r=await lost.call();assert.equal(r.status,503);assert.equal(lost.results.length,1);assert.ok(!JSON.stringify(r.body).includes('테스트'));
});

test('question text and answer links are included, long content preserves full link within LMS byte budget',()=>{
 const text=renderMessage(jobs[2],'https://academy.invalid');assert.ok(text.includes('질문 원문입니다.'));assert.ok(text.includes('/#watch?id=l1&question=q1'));
 const long=renderMessage({...jobs[2],payload:{...jobs[2].payload,questionContent:'불교 질문'.repeat(2000)}},'https://academy.invalid');
 assert.ok(new TextEncoder().encode(long).length<=1900);assert.ok(long.includes('…'));assert.ok(long.endsWith('/#watch?id=l1&question=q1'));
 assert.ok(renderMessage(jobs[3],'https://academy.invalid').includes('/#watch?id=l1&question=q1'));
});
