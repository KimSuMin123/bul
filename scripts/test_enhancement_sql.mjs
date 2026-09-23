import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('enhancement migration executes with actual PostgreSQL RLS, triggers and RPCs',async t=>{
 const db=new PGlite();t.after(()=>db.close());
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth; CREATE SCHEMA storage; CREATE TABLE auth.users(id uuid PRIMARY KEY);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 GRANT USAGE ON SCHEMA auth,storage TO anon,authenticated,service_role;
 GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated,service_role;
 CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text,metadata jsonb);
 ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY; GRANT SELECT ON storage.objects TO anon; GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated;
 INSERT INTO storage.buckets VALUES('lectures','lectures',true,NULL,NULL);`);
 const bootstrap=await fs.readFile(new URL('../database_setup.sql',import.meta.url),'utf8');await db.exec(bootstrap.slice(0,bootstrap.indexOf('-- Row Level Security')));
 for(const table of ['users','courses','lectures','enrollments','payments','progress','qa_posts','qa_answers','certificates','exam_attempts']) await db.exec(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
 const student='11111111-1111-4111-8111-111111111111',admin='22222222-2222-4222-8222-222222222222';
 await db.exec(`INSERT INTO auth.users VALUES('${student}'),('${admin}');
 INSERT INTO users(id,password,name,birth_date,phone,member_no,role) VALUES('student','old','Student','2000-01-01','01011111111','M1','student'),('admin','old','Admin','2000-01-01','01022222222','M2','admin');
 INSERT INTO courses(id,title) VALUES('c1','Course');
 INSERT INTO lectures(id,course_id,order_index,title,duration_seconds,video_url) VALUES('l1','c1',1,'First',100,'first.mp4'),('l2','c1',2,'Next',100,'next.mp4');`);
 for(const name of ['202609230001_security.sql','202609230002_course_writes.sql','202609230003_enhancements.sql']) await db.exec(await fs.readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
 await db.exec(`UPDATE users SET auth_user_id=CASE id WHEN 'student' THEN '${student}'::uuid ELSE '${admin}'::uuid END; INSERT INTO storage.objects(bucket_id,name) VALUES('lectures','first.mp4'),('lectures','next.mp4');`);
 const role=async(r='postgres',id='')=>{await db.exec(`RESET ROLE;${r==='postgres'?'':`SET ROLE ${r};`} SELECT set_config('request.jwt.claim.sub','${id}',false)`);};
 const scalar=async sql=>(await db.query(sql)).rows[0];
 await t.test('legacy provenance, new consent server timestamp, alias namespace and protected writes',async()=>{
  assert.equal((await scalar("SELECT privacy_consent_source FROM users WHERE id='student'")).privacy_consent_source,'legacy_admin_backfill');
  await assert.rejects(()=>db.exec("INSERT INTO users(id,name,birth_date,phone,member_no) VALUES('bad','Bad','2000-01-01','01044444444','M4')"));
  await db.exec("INSERT INTO users(id,name,birth_date,phone,member_no,privacy_consent,privacy_consent_at,privacy_policy_version,privacy_consent_source) VALUES('new','New','2000-01-01','01033333333','M3',true,'1990-01-01','2026-09-23','registration')");
  assert.ok(new Date((await scalar("SELECT privacy_consent_at FROM users WHERE id='new'")).privacy_consent_at).getFullYear()>2020);
  await db.exec("UPDATE users SET login_id='adsba' WHERE id='admin'");
  assert.equal((await scalar("SELECT lms_find_user('ADSBA') AS value")).value.id,'admin');
  await assert.rejects(()=>db.exec("UPDATE users SET login_id='student' WHERE id='admin'"));
  await assert.rejects(()=>db.exec("UPDATE users SET login_id='adsba' WHERE id='student'"));
  await role('authenticated',student);await assert.rejects(()=>db.exec("UPDATE users SET privacy_consent=true"));await assert.rejects(()=>db.query("SELECT lms_find_user('admin')"));
 });
 await t.test('application transaction creates two jobs, repeat update deduplicates, reapply creates a new generation',async()=>{
  await db.exec("INSERT INTO enrollments(id,user_id,course_id,status,enrolled_at,expire_at) VALUES('e1','student','c1','applied',CURRENT_DATE,CURRENT_DATE+90)");
  await db.exec("UPDATE enrollments SET status='applied',application_version=100 WHERE id='e1'");
  await role();assert.equal((await scalar('SELECT count(*)::int AS count FROM lms_private.sms_outbox')).count,2);
  assert.equal((await scalar("SELECT application_version FROM enrollments WHERE id='e1'")).application_version,1);
  await db.exec("UPDATE enrollments SET status='active',expire_at=CURRENT_DATE-1 WHERE id='e1'");
  await role('authenticated',student);await db.exec("UPDATE enrollments SET status='applied',expire_at=CURRENT_DATE+90 WHERE id='e1'");
  await role();assert.equal((await scalar('SELECT count(*)::int AS count FROM lms_private.sms_outbox')).count,4);
  await db.exec("UPDATE enrollments SET status='active' WHERE id='e1'");
 });
 await t.test('79.99 is locked, exactly 80 unlocks next RPC/storage without completion or exam eligibility',async()=>{
  await db.exec("INSERT INTO progress(id,user_id,course_id,lecture_id,watched_seconds,progress_rate,completed) VALUES('p1','student','c1','l1',79,79.99,false)");
  await role('authenticated',student);
  assert.equal((await scalar("SELECT lms_can_watch_lecture('l2') AS allowed")).allowed,false);
  assert.deepEqual((await db.query('SELECT name FROM storage.objects ORDER BY name')).rows,[{name:'first.mp4'}]);
  await assert.rejects(()=>db.query("SELECT update_lecture_progress('l2',0)"));
  await assert.rejects(()=>db.query("SELECT lms_update_lecture_progress_internal('l2',0)"));
  await role();await db.exec("UPDATE progress SET watched_seconds=80,progress_rate=80 WHERE id='p1'");
  await role('authenticated',student);
  assert.equal((await scalar("SELECT lms_can_watch_lecture('l2') AS allowed")).allowed,true);
  assert.equal((await db.query('SELECT name FROM storage.objects')).rows.length,2);
  assert.equal((await scalar("SELECT update_lecture_progress('l2',0) AS value")).value.completed,false);
  await role();await db.exec("UPDATE progress SET progress_rate=80.01 WHERE id='p1'");await role('authenticated',student);assert.equal((await scalar("SELECT lms_can_watch_lecture('l2') AS allowed")).allowed,true);
  await assert.rejects(()=>db.query("SELECT start_course_exam('c1')"));
  await assert.rejects(()=>db.query("SELECT issue_course_certificate('c1')"));
 });
 await t.test('question content is private in the outbox and only intended notification kinds are created',async()=>{
  await db.exec("INSERT INTO qa_posts(id,course_id,lecture_id,author_id,author_name,title,content,is_private,created_at) VALUES('q1','c1','l1','student','Student','Private title','Private body',true,'2026-09-23')");
  await role('authenticated',admin);await db.exec("INSERT INTO qa_answers(id,post_id,author_id,author_name,content,created_at) VALUES('a1','q1','admin','Admin','Private answer','2026-09-23')");
  await role();const rows=(await db.query("SELECT kind,payload FROM lms_private.sms_outbox WHERE kind IN ('question_admin','answer_student') ORDER BY kind")).rows;
  assert.equal(rows.length,2);assert.equal(rows.find(r=>r.kind==='question_admin').payload.questionContent,'Private body');assert.equal(rows.find(r=>r.kind==='answer_student').payload.questionContent,undefined);assert.ok(!JSON.stringify(rows).includes('Private answer'));
  await db.exec('BEGIN');await db.exec("INSERT INTO qa_answers(id,post_id,author_id,author_name,content,created_at) VALUES('rollback','q1','admin','Admin','x','2026-09-23')");await db.exec('ROLLBACK');assert.equal((await scalar('SELECT count(*)::int AS count FROM lms_private.sms_outbox')).count,6);
 });
 await t.test('private jobs reject public access; leases deduplicate claims and audit safe outcomes',async()=>{
  await role('authenticated',student);await assert.rejects(()=>db.query('SELECT * FROM lms_private.sms_outbox'));await assert.rejects(()=>db.query('SELECT lms_claim_sms(10)'));await assert.rejects(()=>db.query('SELECT lms_sms_audit()'));
  await role('service_role');const jobs=(await db.query('SELECT * FROM lms_claim_sms(2)')).rows;assert.equal(jobs.length,2);
  const next=(await db.query('SELECT * FROM lms_claim_sms(10)')).rows;assert.equal(next.length,4);assert.ok(next.every(j=>!jobs.some(x=>x.id===j.id)));
  const finish=async(token,status)=> (await db.query('SELECT lms_finish_sms($1,$2,$3,$4,NULL) AS done',[jobs[0].id,token,status,'test'])).rows[0].done;
  assert.equal(await finish(crypto.randomUUID(),'mock'),false);assert.equal(await finish(jobs[0].lease_token,'mock'),true);assert.equal(await finish(jobs[0].lease_token,'mock'),false);
  await role();await db.exec("UPDATE lms_private.sms_outbox SET lease_until=now()-interval '1 minute' WHERE status='processing'");
  await role('service_role');assert.equal((await db.query('SELECT * FROM lms_claim_sms(10)')).rows.length,0);
  await role('authenticated',admin);const audit=(await scalar('SELECT lms_sms_audit() AS value')).value;assert.ok(audit.some(j=>j.status==='uncertain'));assert.ok(!JSON.stringify(audit).includes('01011111111'));
  const uncertain=audit.find(j=>j.status==='uncertain');await assert.rejects(()=>db.query('SELECT lms_retry_sms($1)',[uncertain.id]));
  assert.equal((await db.query('SELECT lms_retry_sms($1,true) AS done',[uncertain.id])).rows[0].done,true);
 });
 await t.test('retry backoff and capped attempts persist while enrollment denial stays authoritative',async()=>{
  await role();await db.exec("UPDATE lms_private.sms_outbox SET attempts=4 WHERE status='retry'");
  await role('service_role');const job=(await db.query('SELECT * FROM lms_claim_sms(1)')).rows[0];assert.equal(job.attempts,5);
  await db.query("SELECT lms_finish_sms($1,$2,'retry','rate_limited',NULL)",[job.id,job.lease_token]);
  await role();assert.equal((await db.query('SELECT status FROM lms_private.sms_outbox WHERE id=$1',[job.id])).rows[0].status,'failed');
  await db.exec("UPDATE enrollments SET expire_at=CURRENT_DATE-1 WHERE id='e1'");
  await role('authenticated',student);assert.equal((await scalar("SELECT lms_can_watch_lecture('l1') AS allowed")).allowed,false);assert.equal((await db.query("SELECT name FROM storage.objects WHERE bucket_id='lectures'")).rows.length,0);
  await assert.rejects(()=>db.query("SELECT update_lecture_progress('l1',80)"));
  await role('authenticated',admin);assert.equal((await scalar("SELECT lms_can_watch_lecture('l2') AS allowed")).allowed,true);
 });
 await t.test('only scheduled enabled announcements are public; students cannot mutate or upload',async()=>{
  await db.exec("INSERT INTO site_announcements(title,content,enabled) VALUES('active','body',true),('disabled','body',false); INSERT INTO site_announcements(title,content,enabled,starts_at) VALUES('future','body',true,now()+interval '1 day'); INSERT INTO site_announcements(title,content,enabled,ends_at) VALUES('expired','body',true,now()-interval '1 day')");
  await assert.rejects(()=>db.exec("INSERT INTO site_announcements(title,type,content) VALUES('no image','image','body')"));
  await assert.rejects(()=>db.exec("INSERT INTO site_announcements(title) VALUES('empty')"));
  await assert.rejects(()=>db.exec("INSERT INTO site_announcements(title,link_url) VALUES('bad','javascript:alert(1)')"));
  await db.exec("INSERT INTO storage.objects(bucket_id,name) VALUES('announcement-images','test.png')");
  await role('anon');assert.deepEqual((await db.query('SELECT title FROM site_announcements')).rows,[{title:'active'}]);
  await role('authenticated',student);await assert.rejects(()=>db.exec("INSERT INTO site_announcements(title) VALUES('forged')"));await assert.rejects(()=>db.exec("INSERT INTO storage.objects(bucket_id,name) VALUES('announcement-images','bad.png')"));
  assert.equal((await db.query("DELETE FROM site_announcements RETURNING id")).rows.length,0);
  await role('authenticated',admin);assert.equal((await db.query('SELECT title FROM site_announcements')).rows.length,4);await assert.rejects(()=>db.exec("INSERT INTO storage.objects(bucket_id,name) VALUES('announcement-images','bad.svg')"));
 });
 await t.test('public song policy exposes only the verified MPEG object, never adjacent audio or lecture videos',async()=>{
  await role();
  await db.exec(`INSERT INTO storage.objects(bucket_id,name,metadata) VALUES
   ('lectures','audio/namo_buddhaya_song.mp3','{"mimetype":"audio/mpeg"}'),
   ('lectures','audio/other_song.mp3','{"mimetype":"audio/mpeg"}'),
   ('lectures','audio/namo_buddhaya_song.mp3.backup','{"mimetype":"audio/mpeg"}'),
   ('lectures','audio/NAMO_BUDDHAYA_SONG.mp3','{"mimetype":"audio/mpeg"}'),
   ('other-bucket','audio/namo_buddhaya_song.mp3','{"mimetype":"audio/mpeg"}')`);
  await role('anon');
  assert.deepEqual((await db.query("SELECT name FROM storage.objects WHERE bucket_id='lectures'")).rows,[{name:'audio/namo_buddhaya_song.mp3'}]);
  assert.equal((await db.query("SELECT name FROM storage.objects WHERE bucket_id='other-bucket'")).rows.length,0);
  await role('authenticated',student);
  assert.deepEqual((await db.query("SELECT name FROM storage.objects WHERE bucket_id='lectures'")).rows,[{name:'audio/namo_buddhaya_song.mp3'}]);
  await role();await db.exec("UPDATE storage.objects SET metadata='{\"mimetype\":\"video/mp4\"}' WHERE bucket_id='lectures' AND name='audio/namo_buddhaya_song.mp3'");
  await role('anon');assert.equal((await db.query("SELECT name FROM storage.objects WHERE bucket_id='lectures'")).rows.length,0);
  await role();assert.equal((await scalar("SELECT public FROM storage.buckets WHERE id='lectures'")).public,false);
 });
});
