import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('admin fixes migration: donation receipts, guarded course delete, questions while awaiting payment',async t=>{
 const db=new PGlite();t.after(()=>db.close());
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth; CREATE SCHEMA storage; CREATE TABLE auth.users(id uuid PRIMARY KEY);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 GRANT USAGE ON SCHEMA auth,storage TO anon,authenticated,service_role;
 GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated,service_role;
 CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text,metadata jsonb);
 ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;`);
 const bootstrap=await fs.readFile(new URL('../database_setup.sql',import.meta.url),'utf8');await db.exec(bootstrap.slice(0,bootstrap.indexOf('-- Row Level Security')));
 // Production never had this table; start from the same state.
 await db.exec('DROP TABLE donation_receipts');
 for(const table of ['users','courses','lectures','enrollments','payments','progress','qa_posts','qa_answers','certificates','exam_attempts']) await db.exec(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
 const student='11111111-1111-4111-8111-111111111111',admin='22222222-2222-4222-8222-222222222222';
 await db.exec(`INSERT INTO auth.users VALUES('${student}'),('${admin}');
 INSERT INTO users(id,password,name,birth_date,phone,member_no,role) VALUES('student','old','Student','2000-01-01','01011111111','M1','student'),('admin','old','Admin','2000-01-01','01022222222','M2','admin');
 INSERT INTO courses(id,title) VALUES('c1','Course'),('c2','Empty');
 INSERT INTO lectures(id,course_id,order_index,title,duration_seconds,video_url) VALUES('l1','c1',1,'First',100,'first.mp4'),('l9','c2',1,'Only',100,'only.mp4');`);
 for(const name of ['202609230001_security.sql','202609230002_course_writes.sql','202609230003_enhancements.sql','202609240003_admin_fixes.sql']) await db.exec(await fs.readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
 await db.exec(`UPDATE users SET auth_user_id=CASE id WHEN 'student' THEN '${student}'::uuid ELSE '${admin}'::uuid END;
 INSERT INTO enrollments(id,user_id,course_id,status,enrolled_at,expire_at) VALUES('e1','student','c1','pending',CURRENT_DATE,CURRENT_DATE+90);`);
 const role=async(r='postgres',id='')=>{await db.exec(`RESET ROLE;${r==='postgres'?'':`SET ROLE ${r};`} SELECT set_config('request.jwt.claim.sub','${id}',false)`);};
 const receipt=`INSERT INTO donation_receipts(id,user_id,name,phone,total_amount,last_issued_at,donation_count,history) VALUES('r1','student','Student','01011111111',50000,CURRENT_DATE,1,'[]') ON CONFLICT(phone) DO UPDATE SET total_amount=EXCLUDED.total_amount`;

 await t.test('donation receipts persist for administrators only',async()=>{
  await role('authenticated',student);
  await assert.rejects(()=>db.exec(receipt));
  assert.equal((await db.query('SELECT * FROM donation_receipts')).rows.length,0);
  await role('authenticated',admin);
  await db.exec(receipt);await db.exec(receipt);
  assert.equal((await db.query('SELECT * FROM donation_receipts')).rows.length,1);
  await role('anon');
  await assert.rejects(()=>db.query('SELECT * FROM donation_receipts'));
 });
 await t.test('administrators delete empty courses but not courses with applications',async()=>{
  await role('authenticated',student);
  assert.equal((await db.query("DELETE FROM courses WHERE id='c2' RETURNING id")).rows.length,0);
  await role('authenticated',admin);
  await assert.rejects(()=>db.query("DELETE FROM courses WHERE id='c1'"),/삭제할 수 없습니다/);
  assert.equal((await db.query("DELETE FROM courses WHERE id='c2' RETURNING id")).rows.length,1);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM lectures WHERE course_id='c2'")).rows[0].n,0);
 });
 await t.test('a student awaiting payment can ask and read course questions',async()=>{
  await role('authenticated',student);
  await db.exec("INSERT INTO qa_posts(id,course_id,lecture_id,author_id,author_name,title,content,created_at) VALUES('q1','c1','l1','student','Student','T','C','2026-09-24')");
  assert.equal((await db.query('SELECT id FROM qa_posts')).rows.length,1);
  await role('postgres');
  await db.exec("DELETE FROM enrollments WHERE user_id='student'");
  await role('authenticated',student);
  await assert.rejects(()=>db.exec("INSERT INTO qa_posts(id,course_id,lecture_id,author_id,author_name,title,content,created_at) VALUES('q2','c1','l1','student','Student','T','C','2026-09-24')"));
 });
});
