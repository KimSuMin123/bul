import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('sequential member and certificate numbers',async t=>{
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
 await db.exec('DROP TABLE donation_receipts');
 const migrations=['202609230001_security.sql','202609230002_course_writes.sql','202609230003_enhancements.sql','202609240001_trial_lectures.sql','202609240002_dharma_name.sql','202609240003_admin_fixes.sql','202609280001_course_complete_80.sql'];
 for(const name of migrations) await db.exec(await fs.readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
 // Every fixture member carries the current consent record, as the registration trigger requires.
 await db.exec(`ALTER TABLE users ALTER COLUMN privacy_consent SET DEFAULT true, ALTER COLUMN privacy_policy_version SET DEFAULT '2026-09-23', ALTER COLUMN privacy_consent_source SET DEFAULT 'registration'`);
 // Same shape as production on 2026-09-29: mixed member numbers and random certificate numbers.
 await db.exec(`INSERT INTO courses(id,title) VALUES('course_rit_02','법사'),('course_rit_exp_02','해설사');
 INSERT INTO lectures(id,course_id,order_index,title,duration_seconds,video_url) VALUES('l1','course_rit_02',1,'A',100,'a.mp4'),('l2','course_rit_exp_02',1,'B',100,'b.mp4');
 INSERT INTO users(id,password,name,birth_date,phone,member_no,role,created_at) VALUES
  ('admin',null,'관리자','1948-01-01','01000000000','BUDDHA-2026-00031','admin','2026-09-17T14:34:02Z'),
  ('Woochun50',null,'W','1961-07-18','01050491350','BUDDHA-2026-00002','student','2026-09-18T08:56:47Z'),
  ('dss1475',null,'D','1960-11-06','01036091475','BUDDHA-2026-00001','student','2026-09-19T04:59:31Z'),
  ('dootam',null,'M','1955-04-23','01037783746','BUDDHA-2026-00005','student','2026-09-23T01:40:44Z'),
  ('aham4',null,'K','1976-04-10','01091002545','BUDDHA-32144ae2-1963-4ce7-85bd-34046e8c4fe9','student','2026-09-25T06:21:16Z'),
  ('yingtao',null,'Y','1970-03-01','01047020283','BUDDHA-d6f22257-6e7f-47b2-b459-4519065f110f','student','2026-09-25T08:01:44Z'),
  ('maha0815',null,'H','1970-01-01','01011112222','BUDDHA-95ed2405-cbaa-4844-911a-ef1a8e42d2f5','student','2026-09-29T01:10:59Z');
 INSERT INTO certificates(cert_no,user_id,course_id,member_no,student_name,birth_date,course_title,period,issued_at,status) VALUES
  ('CERT-37120b57-46a6-4bec-964b-00bdb448e4f0','dss1475','course_rit_02','BUDDHA-2026-00001','D','1960-11-06','법사','2026-09-25','2026-09-25','valid'),
  ('CERT-10c8935f-4dbb-45a2-a27c-b1ba9b57a12b','dss1475','course_rit_exp_02','BUDDHA-2026-00001','D','1960-11-06','해설사','2026-09-25','2026-09-25','valid'),
  ('CERT-d897c117-2748-4e64-8304-f8d38e430129','dootam','course_rit_02','BUDDHA-2026-00005','M','1955-04-23','법사','2026-09-29','2026-09-29','valid');`);
 await db.exec(await fs.readFile(new URL('../supabase/migrations/202609290001_sequential_numbers.sql',import.meta.url),'utf8'));
 await db.exec(await fs.readFile(new URL('../supabase/migrations/202609300002_cert_issue_date_kst.sql',import.meta.url),'utf8'));
 const members=async()=>Object.fromEntries((await db.query('SELECT id,member_no FROM users')).rows.map(r=>[r.id,r.member_no]));
 const certs=async()=>Object.fromEntries((await db.query("SELECT user_id||'/'||course_id AS k,cert_no,member_no FROM certificates")).rows.map(r=>[r.k,r]));

 await t.test('existing members: admin 00000, numbered members kept, random ones continue in sign-up order',async()=>{
  assert.deepEqual(await members(),{admin:'BUDDHA-2026-00000',Woochun50:'BUDDHA-2026-00002',dss1475:'BUDDHA-2026-00001',dootam:'BUDDHA-2026-00005',aham4:'BUDDHA-2026-00006',yingtao:'BUDDHA-2026-00007',maha0815:'BUDDHA-2026-00008'});
 });
 await t.test('existing certificates renumbered per course code in issue order',async()=>{
  const c=await certs();
  assert.equal(c['dss1475/course_rit_02'].cert_no,'CERT-LAW-2026-0001');
  assert.equal(c['dss1475/course_rit_exp_02'].cert_no,'CERT-EXP-2026-0001');
  assert.equal(c['dootam/course_rit_02'].cert_no,'CERT-LAW-2026-0002');
 });
 await t.test('new members get the next number whatever the client sends',async()=>{
  await db.exec(`INSERT INTO users(id,password,name,birth_date,phone,member_no,role) VALUES('new1',null,'N','2000-01-01','01099990001','BUDDHA-${'x'.repeat(8)}','student'),('boss2',null,'B','2000-01-01','01099990002','forged','admin')`);
  const m=await members();
  assert.equal(m.new1,'BUDDHA-2026-00009');
  assert.equal(m.boss2,'BUDDHA-2026-00010','a second admin cannot take 00000 and gets the next number');
 });
 await t.test('issuing a certificate takes the next number for its course once',async()=>{
  const uid='33333333-3333-4333-8333-333333333333';
  await db.exec(`INSERT INTO auth.users VALUES('${uid}'); UPDATE users SET auth_user_id='${uid}' WHERE id='new1';
  INSERT INTO enrollments(id,user_id,course_id,status,enrolled_at,expire_at) VALUES('e1','new1','course_rit_02','active',CURRENT_DATE,CURRENT_DATE+90);
  INSERT INTO progress(id,user_id,course_id,lecture_id,last_played_seconds,watched_seconds,progress_rate,completed,updated_at) VALUES('p1','new1','course_rit_02','l1',80,80,80,false,now());
  INSERT INTO exam_attempts(id,user_id,course_id,score,passed,correct_count,total_count) VALUES('x1','new1','course_rit_02',85,true,17,20);`);
  await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${uid}',false)`);
  const first=(await db.query("SELECT public.issue_course_certificate('course_rit_02') AS c")).rows[0].c;
  const again=(await db.query("SELECT public.issue_course_certificate('course_rit_02') AS c")).rows[0].c;
  await db.exec('RESET ROLE');
  assert.equal(first.cert_no,'CERT-LAW-2026-0003');
  assert.equal(again.cert_no,'CERT-LAW-2026-0003','a repeat claim returns the same certificate');
  assert.equal(first.member_no,'BUDDHA-2026-00009');
  // 발급일은 한국 날짜(서버 UTC 날짜가 아님): 202609300002
  const kst=(await db.query("SELECT ((now() AT TIME ZONE 'Asia/Seoul')::date)::text AS d")).rows[0].d;
  assert.equal(String(first.issued_at).slice(0,10),kst,'issued_at is the Korean date');
  assert.equal((await db.query("SELECT last_value FROM lms_private.number_counters WHERE key='cert:LAW:2026'")).rows[0].last_value,3,'no number burned');
 });
});
