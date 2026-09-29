// 비밀번호 셀프 재설정 잠금 SQL(202609300001): 5회 실패 시 30분 잠금, 성공 시 초기화, 브라우저 역할은 호출 불가.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('self password reset lock: five failures lock for 30 minutes; clear resets; browser roles cannot call it',async t=>{
 const db=new PGlite();t.after(()=>db.close());
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA lms_private;`);
 await db.exec(await fs.readFile(new URL('../supabase/migrations/202609300001_self_password_reset.sql',import.meta.url),'utf8'));
 const one=async sql=>Object.values((await db.query(sql)).rows[0])[0];
 assert.equal(await one(`SELECT public.lms_self_reset_locked('u1')`),false);
 for(let i=1;i<=4;i++) assert.equal(await one(`SELECT public.lms_self_reset_fail('u1')`),false,`failure ${i} does not lock`);
 assert.equal(await one(`SELECT public.lms_self_reset_fail('u1')`),true,'fifth failure locks');
 assert.equal(await one(`SELECT public.lms_self_reset_locked('u1')`),true);
 assert.equal(await one(`SELECT public.lms_self_reset_locked('u2')`),false,'other accounts are unaffected');
 // lock expires after 30 minutes; the next failure starts counting from 1 again
 await db.exec(`UPDATE lms_private.self_reset_failures SET locked_until=now()-interval '1 second' WHERE user_id='u1'`);
 assert.equal(await one(`SELECT public.lms_self_reset_locked('u1')`),false);
 assert.equal(await one(`SELECT public.lms_self_reset_fail('u1')`),false);
 assert.equal(await one(`SELECT failures FROM lms_private.self_reset_failures WHERE user_id='u1'`),1);
 // old failures (30+ minutes ago) do not accumulate
 await db.exec(`UPDATE lms_private.self_reset_failures SET failures=4,updated_at=now()-interval '31 minutes' WHERE user_id='u1'`);
 assert.equal(await one(`SELECT public.lms_self_reset_fail('u1')`),false);
 await db.exec(`SELECT public.lms_self_reset_clear('u1')`);
 assert.equal(await one(`SELECT count(*)::int FROM lms_private.self_reset_failures`),0);
 for(const role of ['anon','authenticated']) {
  await db.exec(`SET ROLE ${role}`);
  await assert.rejects(db.query(`SELECT public.lms_self_reset_fail('u1')`),/permission denied/);
  await db.exec('RESET ROLE');
 }
});
