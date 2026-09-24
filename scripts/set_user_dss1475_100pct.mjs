import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

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
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
}
loadEnv();

const url = process.env.VITE_SUPABASE_URL.replace(/\/$/, '');
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Supabase URL or SERVICE_ROLE_KEY missing in .env');
  process.exit(1);
}

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
  Prefer: 'resolution=merge-duplicates,return=representation'
};

async function main() {
  console.log('=== [사] 세화불학원 dss1475 유저: 2개 강좌 전 강의 진도율 100% (시험 직전 상태) 설정 시작 ===');

  // 1. 유저 정보 확인
  const userRes = await fetch(`${url}/rest/v1/users?id=eq.dss1475`, { headers });
  const users = await userRes.json();
  if (!users || users.length === 0) {
    throw new Error('유저 dss1475를 찾을 수 없습니다.');
  }
  const user = users[0];
  console.log(`유저 확인: ${user.name} (${user.id}), 회원번호: ${user.member_no}`);

  // 2. 전체 강의 목록 조회 (2개 강좌 총 60강)
  const lecRes = await fetch(`${url}/rest/v1/lectures?select=id,course_id,order_index,title,duration_seconds&order=order_index.asc`, { headers });
  const lectures = await lecRes.json();
  console.log(`총 강의 차시: ${lectures.length}개`);

  // 3. dss1475의 각 강의별 100% 진도 데이터 준비
  const nowIso = new Date().toISOString();
  const progressPayloads = lectures.map(l => {
    const dur = l.duration_seconds || 2400;
    return {
      id: `prog_dss1475_${l.id}`,
      user_id: 'dss1475',
      course_id: l.course_id,
      lecture_id: l.id,
      last_played_seconds: dur,
      watched_seconds: dur,
      progress_rate: 100.0,
      completed: true,
      updated_at: nowIso
    };
  });

  console.log(`총 ${progressPayloads.length}개 강의 진도 데이터를 100% (완강)으로 저장합니다...`);

  // Supabase에 batch upsert (on_conflict: user_id,lecture_id)
  const progUpsertRes = await fetch(`${url}/rest/v1/progress?on_conflict=user_id,lecture_id`, {
    method: 'POST',
    headers,
    body: JSON.stringify(progressPayloads)
  });

  if (!progUpsertRes.ok) {
    const errText = await progUpsertRes.text();
    throw new Error(`진도율 저장 실패 (${progUpsertRes.status}): ${errText}`);
  }
  const insertedProgress = await progUpsertRes.json();
  console.log(`✔ 진도율 100% 반영 완료: ${insertedProgress.length}개 강의 전체 완강(100%) 완료`);

  // 4. "시험 직전" 상태 유지: dss1475의 시험 및 수료증 기록 초기화(미응시 상태)
  // 사용자가 직접 시험에 응시할 수 있도록 exam_attempts와 certificates는 비워둡니다.
  const delExamRes = await fetch(`${url}/rest/v1/exam_attempts?user_id=eq.dss1475`, {
    method: 'DELETE',
    headers
  });
  console.log(`✔ 시험 응시 기록 초기화 (시험 직전 상태 유지, status: ${delExamRes.status})`);

  const delCertRes = await fetch(`${url}/rest/v1/certificates?user_id=eq.dss1475`, {
    method: 'DELETE',
    headers
  });
  console.log(`✔ 수료증 발급 기록 초기화 (시험 합격 후 직접 발급 가능, status: ${delCertRes.status})`);

  // 5. enrollments 상태 확인 (active 상태 유지)
  const courseIds = ['course_rit_exp_02', 'course_rit_02'];
  for (const cid of courseIds) {
    const enrRes = await fetch(`${url}/rest/v1/enrollments?user_id=eq.dss1475&course_id=eq.${cid}`, { headers });
    const enrs = await enrRes.json();
    if (enrs && enrs.length > 0) {
      console.log(`수강 권한 확인: course=${cid}, status=${enrs[0].status}, expire_at=${enrs[0].expire_at}`);
    }
  }

  console.log('\n=== 설정 완료: dss1475 유저가 두 강좌 모두 전 강좌 완강(100%) 및 "시험 직전(시험 응시 대상)" 상태로 설정되었습니다 ===');
}

main().catch(err => {
  console.error('오류 발생:', err);
  process.exit(1);
});
