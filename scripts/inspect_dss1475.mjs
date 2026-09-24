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
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}
loadEnv();

const url = (process.env.VITE_SUPABASE_URL || 'https://cxvavdxfcrprcbpnrimw.supabase.co').replace(/\/$/, '');
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

async function inspect() {
  const headers = { apikey: key, Authorization: `Bearer ${key}` };

  // 1. User info
  const userRes = await fetch(`${url}/rest/v1/users?id=eq.dss1475`, { headers });
  const users = await userRes.json();
  console.log('User dss1475:', users);

  // 2. Courses info
  const courseRes = await fetch(`${url}/rest/v1/courses?select=id,title`, { headers });
  const courses = await courseRes.json();
  console.log('All Courses in DB:', courses);

  // 3. Enrollments for dss1475
  const enrRes = await fetch(`${url}/rest/v1/enrollments?user_id=eq.dss1475`, { headers });
  const enrollments = await enrRes.json();
  console.log('Enrollments for dss1475:', enrollments);

  // 4. Progress for dss1475
  const progRes = await fetch(`${url}/rest/v1/progress?user_id=eq.dss1475`, { headers });
  const progress = await progRes.json();
  console.log(`Progress rows for dss1475: ${progress.length}`);
  console.log('Sample progress:', progress.slice(0, 5));

  // 5. All lectures count per course
  for (const c of courses) {
    const lecRes = await fetch(`${url}/rest/v1/lectures?course_id=eq.${c.id}&select=id,duration_seconds`, { headers });
    const lecs = await lecRes.json();
    console.log(`Course ${c.id} (${c.title}) total lectures: ${lecs.length}`);
  }

  // 6. Certificates for dss1475
  const certRes = await fetch(`${url}/rest/v1/certificates?user_id=eq.dss1475`, { headers });
  const certs = await certRes.json();
  console.log('Certificates for dss1475:', certs);

  // 7. Exam attempts for dss1475
  const examRes = await fetch(`${url}/rest/v1/exam_attempts?user_id=eq.dss1475`, { headers });
  const exams = await examRes.json();
  console.log('Exam attempts for dss1475:', exams);
}

inspect().catch(console.error);
