export const APPROVAL_NOTICE = '입금 확인 및 수강 승인은 매일 오전 10시~11시, 오후 6시~7시에 진행됩니다.';
const byteLength = text => new TextEncoder().encode(text).length;
function fitMessage(prefix, content, suffix) {
 const budget=1900-byteLength(prefix+suffix);
 let excerpt='',used=0;
 for(const character of content) { const size=byteLength(character); if(used+size>budget-4) break; excerpt+=character;used+=size; }
 return prefix+excerpt+(excerpt.length<content.length?'…':'')+suffix;
}
export function renderMessage(job, siteUrl = '') {
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
export async function solapiAuthorization(apiKey, apiSecret, date = new Date().toISOString(), salt = crypto.randomUUID().replaceAll('-', '')) {
 const key = await crypto.subtle.importKey('raw',new TextEncoder().encode(apiSecret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature = [...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(date+salt)))].map(v=>v.toString(16).padStart(2,'0')).join('');
 return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}
async function equalSecret(a,b) {
 if (!a || !b) return false;
 const hash = async value => new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
 const x=await hash(a),y=await hash(b); let difference=0;
 for(let i=0;i<x.length;i++) difference|=x[i]^y[i];
 return difference===0;
}
export function createSmsHandler({url,serviceKey,workerSecret,provider='mock',apiKey,apiSecret,sender,adminPhone,siteUrl='',fetch:request=globalThis.fetch}) {
 let siteOrigin='';
 try { const parsed=new URL(siteUrl); if(parsed.protocol==='https:' && parsed.origin===siteUrl.replace(/\/$/,'') && !parsed.username && !parsed.password && siteUrl.length<=300) siteOrigin=parsed.origin; } catch { /* Invalid config is rejected before claiming. */ }
 const respond=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
 async function rpc(name,body) {
  const response=await request(`${url}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
  if(!response.ok) throw new Error('database_unavailable');
  return response.json();
 }
 async function send(job) {
  if(provider==='mock') return {status:'mock',code:'mock_no_delivery',providerId:null};
  const to=job.kind.endsWith('_admin')?adminPhone:job.payload.phone;
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
  // API success means accepted by SOLAPI, not delivery to a handset.
  const accepted=Number(result.groupInfo?.count?.registeredSuccess);
  const failed=Number(result.groupInfo?.count?.registeredFailed);
  if(accepted===1 && failed===0 && result.groupInfo?.groupId) return {status:'accepted',code:'provider_accepted',providerId:String(result.groupInfo.groupId).slice(0,100)};
  if(accepted===0 && (failed>0 || result.failedMessageList?.length)) return {status:'failed',code:'provider_rejected',providerId:null};
  return {status:'uncertain',code:'acceptance_unknown',providerId:null};
 }
 return async req=>{
  if(req.method!=='POST') return respond({error:'POST required'},405);
  const token=req.headers.get('Authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if(!await equalSecret(token,workerSecret) && !await equalSecret(token,serviceKey)) return respond({error:'Unauthorized'},401);
  if(!url || !serviceKey || !['mock','solapi'].includes(provider)) return respond({error:'SMS configuration unavailable'},503);
  // Validate all required production settings before claiming any durable work.
  if(provider==='solapi' && (!apiKey || !apiSecret || !siteOrigin || !/^\d{9,15}$/.test(sender||'') || !/^\d{9,15}$/.test(adminPhone||''))) return respond({error:'SMS configuration unavailable'},503);
  try {
   // Five sequential jobs stay within the SQL five-minute lease even at timeouts.
   const jobs=await rpc('lms_claim_sms',{p_limit:5});
   const totals={processed:0,accepted:0,mock:0,retry:0,failed:0,uncertain:0};
   for(const job of jobs) {
    let result;
    try { result=await send(job); } catch { result={status:'failed',code:'invalid_payload',providerId:null}; }
    const saved=await rpc('lms_finish_sms',{p_id:job.id,p_lease_token:job.lease_token,p_status:result.status,p_code:result.code,p_provider_id:result.providerId});
    if(!saved) throw new Error('lease_lost');
    totals.processed++; totals[result.status]++;
   }
   return respond(totals);
  } catch { return respond({error:'SMS processing interrupted; inspect the outbox before retrying.'},503); }
 };
}
