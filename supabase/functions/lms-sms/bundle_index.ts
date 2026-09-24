export const APPROVAL_NOTICE = '입금 확인 및 수강 승인은 매일 오전 10시~11시, 오후 6시~7시에 진행됩니다.';
export const OPERATOR_TEST_PHONE = '01080287565';
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const byteLength = (text: string) => new TextEncoder().encode(text).length;
function fitMessage(prefix: string, content: string, suffix: string) {
 const budget=1900-byteLength(prefix+suffix);
 let excerpt='',used=0;
 for(const character of content) { const size=byteLength(character); if(used+size>budget-4) break; excerpt+=character;used+=size; }
 return prefix+excerpt+(excerpt.length<content.length?'…':'')+suffix;
}
export function renderMessage(job: any, siteUrl = '') {
 const { name, courseTitle, price } = job.payload;
 const link=`${siteUrl}/#watch?id=${encodeURIComponent(job.payload.lectureId || '')}&question=${encodeURIComponent(job.payload.postId || '')}`;
 switch (job.kind) {
  case 'enrollment_student': return `[세화불학원] ${name}님, ${courseTitle} 수강 신청이 접수되었습니다. 수강료 ${Number(price).toLocaleString('ko-KR')}원. 농협 301-0264-3664-41 (사단법인 세화불학원). ${APPROVAL_NOTICE}`;
  case 'enrollment_admin': return `[세화불학원] ${name}님의 ${courseTitle} 수강 신청이 접수되었습니다. 관리자 화면에서 확인해 주세요.`;
  case 'question_admin': return fitMessage(`[세화불학원] ${courseTitle} 새 질문\n`,String(job.payload.questionContent || ''),`\n질문 확인: ${link}`);
  case 'answer_student': return `[세화불학원] ${name}님, ${courseTitle} 질문에 답변이 등록되었습니다.\n답변 확인: ${link}`;
  default: throw new Error('unsupported_kind');
 }
}
export async function solapiAuthorization(apiKey: string, apiSecret: string, date = new Date().toISOString(), salt = crypto.randomUUID().replaceAll('-', '')) {
 const key = await crypto.subtle.importKey('raw',new TextEncoder().encode(apiSecret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature = [...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(date+salt)))].map(v=>v.toString(16).padStart(2,'0')).join('');
 return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}
async function equalSecret(a: string | null | undefined, b: string | null | undefined) {
 if (!a || !b) return false;
 const hash = async (value: string) => new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
 const x=await hash(a),y=await hash(b); let difference=0;
 for(let i=0;i<x.length;i++) difference|=x[i]^y[i];
 return difference===0;
}
function decodeJwtRole(token: string | null | undefined) {
 try {
  const parts = String(token||'').split('.');
  if(parts.length !== 3) return null;
  const raw = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
  const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(raw, c => c.charCodeAt(0))));
  if(payload.exp && payload.exp < Date.now() / 1000) return null;
  return payload.role || null;
 } catch { return null; }
}

export function createSmsHandler({url,serviceKey,workerSecret,provider='mock',apiKey,apiSecret,sender,adminPhone,testPhone,siteUrl='',fetch:request=globalThis.fetch}: any) {
 let siteOrigin='';
 try { const parsed=new URL(siteUrl); if(parsed.protocol==='https:' && parsed.origin===siteUrl.replace(/\/$/,'') && !parsed.username && !parsed.password && siteUrl.length<=300) siteOrigin=parsed.origin; } catch { /* Invalid config is rejected before claiming. */ }
 const respond=(body: any,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
 async function rpc(name: string,body: any) {
  const response=await request(`${url}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
  if(!response.ok) throw new Error('database_unavailable');
  return response.json();
 }
 async function checkServiceToken(token: string | null | undefined) {
  if(!token) return false;
  if(serviceKey && await equalSecret(token, serviceKey)) return true;
  if(url && decodeJwtRole(token) === 'service_role') {
   try {
    const testRes = await request(`${url}/rest/v1/users?select=count&limit=1`, {
     method: 'GET',
     headers: { apikey: token, Authorization: `Bearer ${token}` },
     signal: AbortSignal.timeout(5000)
    });
    return testRes.ok;
   } catch { return false; }
  }
  return false;
 }
 const validTestJob=(job: any,id: string)=>job?.id===id&&job.event_key===`operator_test:${id}`&&job.kind==='enrollment_student'&&job.payload?.phone===testPhone&&testPhone===OPERATOR_TEST_PHONE;
 async function send(job: any,testId?: string) {
  if(testId&&!validTestJob(job,testId))throw new Error('invalid_test_job');
  if(provider==='mock') return {status:'mock',code:'mock_no_delivery',providerId:null};
  const to=testId?testPhone:job.kind.endsWith('_admin')?adminPhone:job.payload.phone;
  if(!/^\d{9,15}$/.test(to||'')) return {status:'failed',code:'invalid_recipient',providerId:null};
  let response;
  try {
   response=await request('https://api.solapi.com/messages/v4/send-many/detail',{method:'POST',headers:{Authorization:await solapiAuthorization(apiKey,apiSecret),'Content-Type':'application/json'},body:JSON.stringify({messages:[{to,from:sender,text:renderMessage(job,siteOrigin),autoTypeDetect:true,customFields:{outboxId:job.id}}],allowDuplicates:false,showMessageList:true}),signal:AbortSignal.timeout(20000)});
  } catch { return {status:'uncertain',code:'transport_unknown',providerId:null}; }
  if(response.status===429) return {status:'retry',code:'rate_limited',providerId:null};
  if(response.status>=500) return {status:'uncertain',code:'provider_unknown',providerId:null};
  if(!response.ok) return {status:'failed',code:`http_${response.status}`,providerId:null};
  let result;
  try { result=await response.json(); } catch { return {status:'uncertain',code:'invalid_response',providerId:null}; }
  const accepted=Number(result.groupInfo?.count?.registeredSuccess);
  const failed=Number(result.groupInfo?.count?.registeredFailed);
  if(accepted===1 && failed===0 && result.groupInfo?.groupId) return {status:'accepted',code:'provider_accepted',providerId:String(result.groupInfo.groupId).slice(0,100)};
  if(accepted===0 && (failed>0 || result.failedMessageList?.length)) return {status:'failed',code:'provider_rejected',providerId:null};
  return {status:'uncertain',code:'acceptance_unknown',providerId:null};
 }
 return async (req: Request)=>{
  if(req.method!=='POST') return respond({error:'POST required'},405);
  const token=req.headers.get('Authorization')?.match(/^Bearer (.+)$/i)?.[1];
  const serviceAuthorized=await checkServiceToken(token);
  const workerAuthorized=await equalSecret(token,workerSecret);
  if(!serviceAuthorized && !workerAuthorized) return respond({error:'Unauthorized'},401);
  let input: any;
  try{
   const text=await req.text();if(byteLength(text)>2048)return respond({error:'Request too large'},413);
   if(text.trim()&&!/^application\/json(?:;|$)/i.test(req.headers.get('Content-Type')||''))return respond({error:'JSON required'},400);
   input=text.trim()?JSON.parse(text):{};
   if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('invalid_request');
  }catch{return respond({error:'Invalid request'},400);}

  // Action: verify_credentials (단건 호출 자격증명 진단)
  if(input.action==='verify_credentials'||input.action==='diagnose'){
   if(!serviceAuthorized && !workerAuthorized) return respond({error:'Unauthorized'},401);
   if(!apiKey||!apiSecret) return respond({ok:false,error:'SOLAPI 자격증명(API_KEY, API_SECRET)이 설정되지 않았습니다.',provider},503);
   try {
    const authHeader=await solapiAuthorization(apiKey,apiSecret);
    const balanceRes=await request('https://api.solapi.com/cash/v1/balance',{method:'GET',headers:{Authorization:authHeader},signal:AbortSignal.timeout(10000)});
    const balanceData=await balanceRes.json().catch(()=>({}));
    if(!balanceRes.ok){
     const is401=balanceRes.status===401;
     return respond({ok:false,status:balanceRes.status,error:is401?'SOLAPI 401 Unauthorized: API Key 또는 Secret이 올바르지 않습니다.':`SOLAPI HTTP ${balanceRes.status}`,details:balanceData},200);
    }
    return respond({ok:true,status:200,balance:balanceData.balance,point:balanceData.point,message:'SOLAPI 자격증명 검증 성공'},200);
   }catch(err){
    return respond({ok:false,error:'SOLAPI 통신 실패',details:String(err)},500);
   }
  }

  // Action: test_send (지정 번호로 4개 테스트 메시지 직접 발송)
  if(input.action==='test_send'){
   if(!serviceAuthorized) return respond({error:'Operator authorization required'},403);
   if(provider!=='solapi') return respond({error:'SMS provider is not solapi'},503);
   if(!apiKey||!apiSecret||!sender) return respond({error:'SOLAPI configuration unavailable'},503);
   const to=String(input.to||'').replace(/[^0-9]/g,'');
   if(!/^\d{9,15}$/.test(to)) return respond({error:'Invalid recipient number'},400);
   const site=siteOrigin||'https://buddha-academy.netlify.app';
   const defaultMessages=[
    `[세화불학원] 김세현님, 불교입문 강좌 수강 신청이 접수되었습니다. 수강료 50,000원. 농협 301-0264-3664-41 (사단법인 세화불학원). ${APPROVAL_NOTICE}`,
    `[세화불학원] 김세현님의 불교입문 강좌 수강 신청이 접수되었습니다. 관리자 화면에서 확인해 주세요.`,
    fitMessage(`[세화불학원] 불교입문 새 질문\n`,'부처님의 사성제와 팔정도에 대해 질문드립니다.',`\n질문 확인: ${site}/#watch?id=intro-1&question=q-101`),
    `[세화불학원] 김세현님, 불교입문 질문에 답변이 등록되었습니다.\n답변 확인: ${site}/#watch?id=intro-1&question=q-101`
   ];
   const messagesToSend=Array.isArray(input.messages)&&input.messages.length>0?input.messages:defaultMessages;
   const results=[];
   for(let i=0;i<messagesToSend.length;i++){
    const text=messagesToSend[i];
    try {
     const authHeader=await solapiAuthorization(apiKey,apiSecret);
     const res=await request('https://api.solapi.com/messages/v4/send-many/detail',{method:'POST',headers:{Authorization:authHeader,'Content-Type':'application/json'},body:JSON.stringify({messages:[{to,from:sender,text,autoTypeDetect:true}],allowDuplicates:false,showMessageList:true}),signal:AbortSignal.timeout(20000)});
     const data=await res.json().catch(()=>({}));
     const accepted=Number(data.groupInfo?.count?.registeredSuccess);
     const failed=Number(data.groupInfo?.count?.registeredFailed);
     results.push({index:i+1,to,status:accepted===1&&failed===0?'accepted':'failed',httpStatus:res.status,groupId:data.groupInfo?.groupId||null,data});
    }catch(err){
     results.push({index:i+1,to,status:'failed',error:String(err)});
    }
   }
   return respond({processed:results.length,accepted:results.filter(r=>r.status==='accepted').length,results});
  }

  const operatorTest=input.action==='operator_test';
  if(operatorTest){
   if(!serviceAuthorized)return respond({error:'Operator authorization required'},403);
   if(Object.keys(input).some(key=>!['action','job_id'].includes(key))||typeof input.job_id!=='string'||!uuidPattern.test(input.job_id))return respond({error:'Invalid test request'},400);
   input.job_id=input.job_id.toLowerCase();
   if(testPhone!==OPERATOR_TEST_PHONE)return respond({error:'SMS test configuration unavailable'},503);
  }else if(Object.keys(input).length)return respond({error:'Unsupported request'},400);
  if(!url || !serviceKey || !['mock','solapi'].includes(provider)) return respond({error:'SMS configuration unavailable'},503);
  if(provider==='solapi' && (!apiKey || !apiSecret || !siteOrigin || !/^\d{9,15}$/.test(sender||'') || !/^\d{9,15}$/.test(adminPhone||''))) return respond({error:'SMS configuration unavailable'},503);
  try {
   const jobs=operatorTest?await rpc('lms_claim_sms_test',{p_id:input.job_id,p_phone:testPhone}):await rpc('lms_claim_sms',{p_limit:3});
   if(!Array.isArray(jobs)||jobs.length>(operatorTest?1:3))throw new Error('invalid_claim');
   if(operatorTest){
    if(!jobs.length)return respond({error:'Test job unavailable'},409);
    if(!validTestJob(jobs[0],input.job_id))throw new Error('invalid_test_job');
   }else if(jobs.some(job=>String(job.event_key||'').startsWith('operator_test:')))throw new Error('unexpected_test_job');
   const totals={processed:0,accepted:0,mock:0,retry:0,failed:0,uncertain:0};
   for(const job of jobs) {
    let result;
    try { result=await send(job,operatorTest?input.job_id:undefined); } catch { result={status:'failed',code:'invalid_payload',providerId:null}; }
    const saved=await rpc('lms_finish_sms',{p_id:job.id,p_lease_token:job.lease_token,p_status:result.status,p_code:result.code,p_provider_id:result.providerId});
    if(!saved) throw new Error('lease_lost');
    totals.processed++; (totals as any)[result.status]++;
   }
   return respond(totals);
  } catch { return respond({error:'SMS processing interrupted; inspect the outbox before retrying.'},503); }
 };
}

Deno.serve(createSmsHandler({
 url:Deno.env.get('SUPABASE_URL') || '',
 serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
 workerSecret:Deno.env.get('LMS_SMS_WORKER_SECRET') || '',
 provider:Deno.env.get('LMS_SMS_PROVIDER') || 'mock',
 apiKey:Deno.env.get('SOLAPI_API_KEY') || '',
 apiSecret:Deno.env.get('SOLAPI_API_SECRET') || '',
 sender:Deno.env.get('LMS_SMS_SENDER') || '',
 adminPhone:Deno.env.get('LMS_SMS_ADMIN_PHONE') || '',
 testPhone:Deno.env.get('LMS_SMS_TEST_PHONE') || '',
 siteUrl:Deno.env.get('LMS_SITE_URL') || ''
}));
