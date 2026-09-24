import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import solapiPkg from 'solapi';
const { SolapiMessageService } = solapiPkg;

// 1. 환경변수 및 .env 파싱
function loadEnv() {
  const envPath = path.resolve('.env');
  if (existsSync(envPath)) {
    const lines = readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}
loadEnv();

const args = process.argv.slice(2);
const viaEdge = args.includes('--via-edge');
const filteredArgs = args.filter(a => !a.startsWith('--'));

const API_KEY = (process.env.SOLAPI_API_KEY || filteredArgs[0] || '').trim();
const API_SECRET = (process.env.SOLAPI_API_SECRET || filteredArgs[1] || '').trim();
const SENDER = (process.env.LMS_SMS_SENDER || '01080287565').replace(/[^0-9]/g, '');
const RECIPIENT = (process.env.TEST_RECIPIENT || '01030327565').replace(/[^0-9]/g, '');
const SITE_URL = (process.env.LMS_SITE_URL || 'https://buddha-academy.netlify.app').replace(/\/$/, '');
const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || 'https://cxvavdxfcrprcbpnrimw.supabase.co').replace(/\/$/, '');
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

console.log('='.repeat(65));
console.log(' [SOLAPI SMS 연동 재개 및 자격증명 진단 도구]');
console.log('='.repeat(65));
console.log(`- 모드                 : ${viaEdge ? 'Supabase Edge Function 경유 (--via-edge)' : 'Node.js SDK 직접 단건 호출'}`);
console.log(`- 보내는 번호 (Sender) : ${SENDER}`);
console.log(`- 받는 번호 (Recipient): ${RECIPIENT}`);
console.log(`- API Key 설정 여부    : ${API_KEY ? '설정됨 (' + API_KEY.slice(0, 4) + '****)' : '미설정 (Edge Secrets 또는 인자 필요)'}`);
console.log(`- API Secret 설정 여부 : ${API_SECRET ? '설정됨 (길이 ' + API_SECRET.length + '자)' : '미설정 (Edge Secrets 또는 인자 필요)'}`);
console.log('-'.repeat(65));

// 3. 4개의 테스트 메시지 정의
const APPROVAL_NOTICE = '입금 확인 및 수강 승인은 매일 오전 10시~11시, 오후 6시~7시에 진행됩니다.';
const sampleLink = `${SITE_URL}/#watch?id=intro-1&question=q-101`;

const testMessages = [
  {
    type: '1. 수강신청 학생 알림 (enrollment_student)',
    text: `[세화불학원] 김세현님, 불교입문 강좌 수강 신청이 접수되었습니다. 수강료 50,000원. 농협 301-0264-3664-41 (사단법인 세화불학원). ${APPROVAL_NOTICE}`
  },
  {
    type: '2. 수강신청 관리자 알림 (enrollment_admin)',
    text: `[세화불학원] 김세현님의 불교입문 강좌 수강 신청이 접수되었습니다. 관리자 화면에서 확인해 주세요.`
  },
  {
    type: '3. 질문 등록 관리자 알림 (question_admin)',
    text: `[세화불학원] 불교입문 새 질문\n부처님의 사성제와 팔정도에 대해 질문드립니다.\n질문 확인: ${sampleLink}`
  },
  {
    type: '4. 답변 등록 학생 알림 (answer_student)',
    text: `[세화불학원] 김세현님, 불교입문 질문에 답변이 등록되었습니다.\n답변 확인: ${sampleLink}`
  }
];

// --- A. Supabase Edge Function 경유 모드 ---
async function runViaEdge() {
  console.log('\n▶ Supabase Edge Function (lms-sms) 호출을 통한 진단 및 발송...');
  if (!SERVICE_KEY) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY가 .env에 없습니다.');
    process.exit(1);
  }

  // 1단계: Edge Function의 verify_credentials 호출
  console.log('\n[1단계: Edge Function 자격증명 진단 요청]');
  const diagRes = await fetch(`${SUPABASE_URL}/functions/v1/lms-sms`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ action: 'verify_credentials' })
  });

  const diagData = await diagRes.json().catch(() => ({}));
  console.log(`응답 상태: HTTP ${diagRes.status}`, diagData);

  if (!diagRes.ok || diagData.ok === false) {
    console.error('\n❌ [진단 실패] Supabase Edge Function 환경의 SOLAPI 인증 오류입니다.');
    if (diagRes.status === 401) {
      console.error('   🚨 Edge Function 인증 거부 (401 Unauthorized)');
      console.error('   - 원인: Edge Function Secrets의 SUPABASE_SERVICE_ROLE_KEY 또는 LMS_SMS_WORKER_SECRET 불일치');
    } else if (diagData.status === 401) {
      console.error('   🚨 SOLAPI 401 Unauthorized');
      console.error('   - 원인: Edge Secrets에 저장된 SOLAPI_API_KEY 또는 SOLAPI_API_SECRET이 틀렸습니다.');
    }
    return;
  }

  console.log('✅ [진단 성공] Edge Secrets의 SOLAPI 자격증명이 정상입니다!');
  if (diagData.balance !== undefined) {
    console.log(`   - 잔액: ${Number(diagData.balance).toLocaleString()}원, 포인트: ${diagData.point}P`);
  }

  // 2단계: Edge Function을 통한 4개 메시지 전송
  console.log('\n[2단계: Edge Function 테스트 메시지 4건 전송]');
  const sendRes = await fetch(`${SUPABASE_URL}/functions/v1/lms-sms`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      action: 'test_send',
      to: RECIPIENT,
      messages: testMessages.map(m => m.text)
    })
  });

  const sendData = await sendRes.json().catch(() => ({}));
  console.log(`응답 상태: HTTP ${sendRes.status}`, JSON.stringify(sendData, null, 2));
}

// --- B. 로컬 Node.js SDK 직접 호출 모드 ---
async function runDirectSdk() {
  if (!API_KEY || !API_SECRET) {
    console.error('\n❌ [오류] SOLAPI_API_KEY 또는 SOLAPI_API_SECRET이 설정되지 않았습니다.');
    console.error('\n사용 가능한 3가지 실행 방법:');
    console.error('  1) CLI 인자로 키를 넘겨서 직접 실행:');
    console.error('     node scripts/verify_and_send_sms.mjs <API_KEY> <API_SECRET>');
    console.error('  2) .env 파일에 SOLAPI 자격증명 추가 후 실행:');
    console.error('     SOLAPI_API_KEY=NCSIxxxxxxxxxxxx');
    console.error('     SOLAPI_API_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
    console.error('     node scripts/verify_and_send_sms.mjs');
    console.error('  3) Supabase Edge Secrets에 저장된 키를 테스트하려면:');
    console.error('     node scripts/verify_and_send_sms.mjs --via-edge\n');
    process.exit(1);
  }

  const messageService = new SolapiMessageService(API_KEY, API_SECRET);

  // 1단계: 단건 호출 진단
  console.log('▶ 1단계: SOLAPI 자격증명 단건 호출 진단 (messageService.getBalance)...');
  try {
    const balance = await messageService.getBalance();
    console.log('✅ [진단 성공] SOLAPI 자격증명이 유효합니다! (인증 오류 HTTP 401 없음)');
    console.log(`   - 잔액(Balance): ${Number(balance.balance || 0).toLocaleString()}원`);
    console.log(`   - 포인트(Point): ${Number(balance.point || 0).toLocaleString()}P`);
  } catch (error) {
    console.error('\n❌ [진단 실패] SOLAPI API 호출 중 오류가 발생했습니다:');
    if (error.statusCode === 401 || (error.message && error.message.includes('401'))) {
      console.error('   🚨 HTTP 401 Unauthorized (인증 오류)');
      console.error('   - 원인: SOLAPI_API_KEY 또는 SOLAPI_API_SECRET이 올바르지 않습니다.');
      console.error('   - 조치: SOLAPI 콘솔(https://console.solapi.com)에서 API Key 및 Secret을 다시 발급/확인하세요.');
    } else {
      console.error(`   - 상태 코드: ${error.statusCode || 'N/A'}`);
      console.error(`   - 메시지   : ${error.message || error}`);
    }
    process.exit(1);
  }

  // 2단계: 4건의 메시지 전송
  console.log('\n▶ 2단계: 테스트 메시지 4건 전송 시작...');
  console.log(`   - 발신: ${SENDER} -> 수신: ${RECIPIENT}`);
  console.log('-'.repeat(65));

  const results = [];
  for (let i = 0; i < testMessages.length; i++) {
    const item = testMessages[i];
    console.log(`[메시지 ${i + 1}/4] ${item.type}`);
    console.log(`본문: "${item.text}"`);

    try {
      const res = await messageService.send({
        to: RECIPIENT,
        from: SENDER,
        text: item.text
      });

      const groupId = res?.groupInfo?.groupId || res?.groupId || 'N/A';
      console.log(`결과: ✅ 발송 성공! Group ID: ${groupId}`);
      results.push({ index: i + 1, type: item.type, status: 'SUCCESS', groupId });
    } catch (err) {
      console.error(`결과: ❌ 발송 실패!`, err.message || err);
      results.push({ index: i + 1, type: item.type, status: 'FAILED', error: err.message || err });
    }
    console.log('-'.repeat(65));
  }

  const successCount = results.filter(r => r.status === 'SUCCESS').length;
  console.log(`\n▶ 전송 완료: 총 4건 중 ${successCount}건 성공, ${4 - successCount}건 실패\n`);
}

if (viaEdge) {
  runViaEdge().catch(console.error);
} else {
  runDirectSdk().catch(console.error);
}
