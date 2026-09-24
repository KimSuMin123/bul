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

async function main() {
  console.log('Testing Supabase REST RPC...');
  // 1. Check lectures
  const lecRes = await fetch(`${url}/rest/v1/lectures?select=id,title,order_index,video_url&limit=3`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  const lectures = await lecRes.json();
  console.log('Lectures in DB:', lectures);

  if (lectures.length > 0) {
    const lec1 = lectures[0];
    console.log(`Checking lms_can_watch_lecture for ${lec1.id}...`);
    const rpcRes = await fetch(`${url}/rest/v1/rpc/lms_can_watch_lecture`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_lecture_id: lec1.id })
    });
    console.log('RPC status:', rpcRes.status, await rpcRes.text());
  }

  // Check enrollments
  const enrRes = await fetch(`${url}/rest/v1/enrollments?select=id,user_id,course_id,status&limit=5`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  console.log('Enrollments:', await enrRes.json());
}

main().catch(console.error);
