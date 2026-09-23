import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('security migration and RLS execute in PostgreSQL', async t => {
 const db = new PGlite();
 t.after(() => db.close());
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth; CREATE SCHEMA storage;
 CREATE TABLE auth.users(id uuid PRIMARY KEY);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 GRANT USAGE ON SCHEMA auth,storage TO anon,authenticated,service_role;
 GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated,service_role;
 CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text,metadata jsonb);
 ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
 GRANT SELECT ON storage.objects TO anon;
 GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated;
 INSERT INTO storage.buckets(id,name,public) VALUES('lectures','lectures',true);`);
 const bootstrap = await fs.readFile(new URL('../database_setup.sql',import.meta.url),'utf8');
 await db.exec(bootstrap.slice(0,bootstrap.indexOf('-- Row Level Security')));
 // Enable all tables, as the existing bootstrap would do before permissive policies.
 for(const table of ['users','courses','lectures','enrollments','payments','progress','qa_posts','qa_answers','certificates','exam_attempts']) await db.exec(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
 const uid='11111111-1111-4111-8111-111111111111', other='22222222-2222-4222-8222-222222222222', admin='33333333-3333-4333-8333-333333333333';
 await db.exec(`INSERT INTO auth.users VALUES('${uid}'),('${other}'),('${admin}');
 INSERT INTO users(id,password,name,birth_date,phone,member_no,role) VALUES('student','legacy','Student','2000-01-01','01011111111','M1','student'),('other','legacy','Other','2000-01-01','01022222222','M2','student'),('admin','legacy','Admin','2000-01-01','01033333333','M3','admin');
 INSERT INTO courses(id,title,raw_exam_text) VALUES('c1','Course','original private exam');
 INSERT INTO lectures(id,course_id,order_index,title,duration_seconds,video_url) VALUES('l1','c1',1,'Lecture',60,'https://example.invalid/storage/v1/object/public/lectures/a.mp4');`);
 await db.query('INSERT INTO courses(id,title,raw_exam_text) VALUES($1,$2,$3)',['c2','Legacy course','1. Existing question?\n① First\n② Second\n\n1. ② — Existing explanation']);
 await db.exec(await fs.readFile(new URL('../supabase/migrations/202609230001_security.sql',import.meta.url),'utf8'));
 await db.exec(await fs.readFile(new URL('../supabase/migrations/202609230002_course_writes.sql',import.meta.url),'utf8'));
 await db.exec(`UPDATE users SET auth_user_id=CASE id WHEN 'student' THEN '${uid}'::uuid WHEN 'other' THEN '${other}'::uuid ELSE '${admin}'::uuid END;
 INSERT INTO storage.objects(bucket_id,name) VALUES('lectures','a.mp4');`);
 const asRole = async (role,identity='') => { await db.exec(`RESET ROLE; SET ROLE ${role}; SELECT set_config('request.jwt.claim.sub','${identity}',false);`); };
 const denied = async sql => assert.rejects(()=>db.query(sql));
 await t.test('anonymous cannot read credentials, profiles, private exam text or videos',async()=>{
  await asRole('anon');
  await denied('SELECT password FROM users'); await denied('SELECT id FROM users'); await denied('SELECT raw_exam_text FROM courses');
  await denied('SELECT * FROM lms_private.course_exams');
  assert.equal((await db.query('SELECT id FROM courses')).rows.length,2);
 });
 await t.test('student identity is mapped from verified Auth uid and private users are filtered',async()=>{
  await asRole('authenticated',uid);
  assert.deepEqual((await db.query('SELECT id FROM users')).rows,[{id:'student'}]);
  assert.equal((await db.query('SELECT current_lms_user() AS profile')).rows[0].profile.role,'student');
  await denied("UPDATE users SET role='admin' WHERE id='student'");
  await denied("INSERT INTO enrollments VALUES('e_bad','student','c1','active',CURRENT_DATE,NULL,CURRENT_DATE+90)");
  await denied("INSERT INTO exam_attempts(id,user_id,course_id,score,passed,correct_count,total_count) VALUES('bad','student','c1',100,true,1,1)");
  await denied("SELECT issue_course_certificate('c1')");
  assert.equal((await db.query('SELECT * FROM storage.objects')).rows.length,0);
 });
 const requestId='44444444-4444-4444-8444-444444444444';
 const paymentSql=`SELECT process_course_payment('student','c1',100,'Forged name','cash','${requestId}'::uuid) AS value`;
 await t.test('payment requires admin and retries are idempotent',async()=>{
  await denied(paymentSql);
  await asRole('authenticated',admin);
  const first=(await db.query(paymentSql)).rows[0].value;
  assert.deepEqual((await db.query(paymentSql)).rows[0].value,first);
  assert.equal((await db.query('SELECT * FROM payments')).rows.length,1);
  assert.equal((await db.query('SELECT manager FROM payments')).rows[0].manager,'Admin');
  await denied(paymentSql.replace(',100,',',101,'));
 });
 await t.test('private exam questions can only be managed by admin',async()=>{
  const questions=[{id:'q1',number:1,question:'Example?',options:['yes','no'],correctAnswer:1,explanation:'private'}];
  await db.query('SELECT save_course_exam($1,$2::jsonb)',['c1',JSON.stringify(questions)]);
  await asRole('authenticated',uid);
  await denied("SELECT get_course_exam('c1')");
  await denied("SELECT start_course_exam('c1')");
  assert.equal((await db.query('SELECT * FROM storage.objects')).rows.length,1);
  await denied("INSERT INTO progress(id,user_id,course_id,lecture_id,progress_rate,completed) VALUES('bad','other','c1','l1',100,true)");
  await denied("INSERT INTO progress(id,user_id,course_id,lecture_id,last_played_seconds,watched_seconds,progress_rate,completed) VALUES('p1','student','c1','l1',60,60,100,true)");
 });
 await t.test('heartbeat uses server elapsed time and ignores immediate seeking',async()=>{
  const first=(await db.query("SELECT update_lecture_progress('l1',0) AS value")).rows[0].value;
  assert.equal(first.watched_seconds,0);
  const seek=(await db.query("SELECT update_lecture_progress('l1',60) AS value")).rows[0].value;
  assert.equal(seek.completed,false); assert.ok(seek.watched_seconds<2);
  await denied("SELECT update_lecture_progress('l1',-1)");
  await denied("SELECT update_lecture_progress('l1','NaN')");
  // Advance the private clock in the fixture instead of waiting a real minute.
  for(let step=1;step<=4;step++) {
   await db.exec('RESET ROLE');
   await db.exec(`UPDATE lms_private.playback_clocks SET last_seen=clock_timestamp()-interval '10 seconds',last_position=${(step-1)*15} WHERE user_id='student'`);
   await asRole('authenticated',uid);
   await db.query('SELECT update_lecture_progress($1,$2)',['l1',step*15]);
  }
  const final=(await db.query('SELECT completed,progress_rate,watched_seconds FROM progress')).rows[0];
  assert.equal(final.completed,true); assert.equal(Number(final.progress_rate),100); assert.equal(final.watched_seconds,60);
 });
 await t.test('server grades once, conceals answers, and issues one certificate',async()=>{
  const session=(await db.query("SELECT start_course_exam('c1') AS value")).rows[0].value;
  assert.equal(session.questions[0].correctAnswer,undefined);
  assert.equal(session.questions[0].explanation,undefined);
  const result=(await db.query('SELECT submit_course_exam($1,$2::jsonb) AS value',[session.attemptId,JSON.stringify({q1:1})])).rows[0].value;
  assert.equal(result.score,100); assert.equal(result.passed,true);
  assert.equal((await db.query("SELECT status FROM enrollments WHERE user_id='student' AND course_id='c1'")).rows[0].status,'completed');
  assert.deepEqual((await db.query('SELECT submit_course_exam($1,$2::jsonb) AS value',[session.attemptId,JSON.stringify({q1:2})])).rows[0].value,result);
  const cert=(await db.query("SELECT issue_course_certificate('c1') AS value")).rows[0].value;
  assert.deepEqual((await db.query("SELECT issue_course_certificate('c1') AS value")).rows[0].value,cert);
  await asRole('authenticated',other);
  await denied(`SELECT submit_course_exam('${session.attemptId}','{}')`);
  assert.equal((await db.query('SELECT * FROM certificates')).rows.length,0);
  await asRole('anon');
  const publicCert=(await db.query('SELECT verify_course_certificate($1) AS value',[cert.cert_no])).rows[0].value;
  assert.equal(publicCert.birth_date,undefined); assert.equal(publicCert.student_name,'Student');
 });
 await t.test('legacy exam text was preserved privately and old login RPC removed',async()=>{
  await asRole('service_role');
  assert.equal((await db.query("SELECT raw_text FROM lms_private.legacy_exam_text WHERE course_id='c1'")).rows[0].raw_text,'original private exam');
  const parsed=(await db.query("SELECT questions FROM lms_private.course_exams WHERE course_id='c2'")).rows[0].questions;
  assert.equal(parsed[0].correctAnswer,2); assert.equal(parsed[0].explanation,'Existing explanation');
  assert.deepEqual(parsed[0].options,['First','Second']);
  await denied("SELECT login_user('student','legacy')");
 });
 await t.test('anonymous thumbnail access does not disclose lecture videos',async()=>{
  await db.exec('RESET ROLE');
  await db.exec(`INSERT INTO storage.objects(bucket_id,name,metadata) VALUES
   ('lectures','thumbs/image.jpg','{"mimetype":"image/jpeg"}'),
   ('lectures','thumbs/disguised.jpg','{"mimetype":"video/mp4"}'),
   ('lectures','thumbs/video.mp4','{"mimetype":"video/mp4"}'),
   ('thumbnails','new.jpg','{"mimetype":"image/jpeg"}')`);
  await asRole('anon');
  assert.deepEqual((await db.query('SELECT name FROM storage.objects ORDER BY name')).rows,[{name:'new.jpg'},{name:'thumbs/image.jpg'}]);
 });
 await t.test('course metadata and private bank save atomically and reject non-admin',async()=>{
  const questions=[{id:'atomic-q',question:'Atomic?',options:['yes','no'],correctAnswer:1}];
  await asRole('authenticated',uid);
  await assert.rejects(()=>db.query('SELECT save_course_record($1,$2)',[JSON.stringify({id:'atomic',title:'Forbidden'}),JSON.stringify(questions)]));
  await asRole('authenticated',admin);
  const saved=(await db.query('SELECT save_course_record($1,$2) AS value',[JSON.stringify({id:'atomic',title:'Before',price:10}),JSON.stringify(questions)])).rows[0].value;
  assert.equal(saved.title,'Before');assert.equal(saved.raw_exam_text,undefined);
  const bank=(await db.query("SELECT get_course_exam('atomic') AS value")).rows[0].value.questions;
  assert.deepEqual(bank,questions);
  const invalid=[{...questions[0],correctAnswer:99}];
  await assert.rejects(()=>db.query('SELECT save_course_record($1,$2)',[JSON.stringify({id:'atomic',title:'Must roll back'}),JSON.stringify(invalid)]));
  assert.equal((await db.query("SELECT title FROM courses WHERE id='atomic'")).rows[0].title,'Before');
  assert.deepEqual((await db.query("SELECT get_course_exam('atomic') AS value")).rows[0].value.questions,questions);
  await assert.rejects(()=>db.query('SELECT save_course_record($1,$2)',[JSON.stringify({id:'new-invalid',title:'Must not exist'}),JSON.stringify(invalid)]));
  assert.equal((await db.query("SELECT id FROM courses WHERE id='new-invalid'")).rows.length,0);
  await assert.rejects(()=>db.query('SELECT save_course_record($1)',[JSON.stringify({id:'atomic',title:'Null price',price:null})]));
  await db.query('SELECT save_course_record($1)',[JSON.stringify({id:'new-default',title:'Default bank'})]);
  assert.equal((await db.query("SELECT get_course_exam('new-default') AS value")).rows[0].value.questions.length,20);
  await db.exec('RESET ROLE');
  await db.exec("INSERT INTO courses(id,title) VALUES('existing-no-bank','Requires manual bank')");
  await asRole('authenticated',admin);
  await db.query('SELECT save_course_record($1)',[JSON.stringify({id:'existing-no-bank',title:'Metadata only'})]);
  assert.deepEqual((await db.query("SELECT get_course_exam('existing-no-bank') AS value")).rows[0].value.questions,[]);
 });
 await t.test('repeated playback does not multiply credited time and rounded media end completes',async()=>{
  await db.exec('RESET ROLE');
  await db.exec("INSERT INTO lectures(id,course_id,order_index,title,duration_seconds,video_url) VALUES('repeat','c1',2,'Repeat',60,'repeat.mp4')");
  await asRole('authenticated',uid);
  await db.query("SELECT update_lecture_progress('repeat',0)");
  for(let i=0;i<4;i++) {
   await db.exec('RESET ROLE');
   await db.exec("UPDATE lms_private.playback_clocks SET last_seen=clock_timestamp()-interval '10 seconds',last_position=0 WHERE lecture_id='repeat'");
   await asRole('authenticated',uid);
   await db.query("SELECT update_lecture_progress('repeat',15)");
  }
  const repeated=(await db.query("SELECT watched_seconds,completed FROM progress WHERE lecture_id='repeat'")).rows[0];
  assert.equal(repeated.watched_seconds,15);assert.equal(repeated.completed,false);
  for(let pos of [30,45,59.8]) {
   await db.exec('RESET ROLE');
   await db.exec("UPDATE lms_private.playback_clocks SET last_seen=clock_timestamp()-interval '10 seconds' WHERE lecture_id='repeat'");
   await asRole('authenticated',uid);
   await db.query("SELECT update_lecture_progress('repeat',$1)",[pos]);
  }
  const ended=(await db.query("SELECT watched_seconds,progress_rate,completed FROM progress WHERE lecture_id='repeat'")).rows[0];
  assert.equal(ended.completed,true);assert.equal(Number(ended.progress_rate),100);
  const revisited=(await db.query("SELECT update_lecture_progress('repeat',0) AS value")).rows[0].value;
  assert.equal(revisited.completed,true);assert.equal(Number(revisited.progress_rate),100);
 });
 await t.test('storage authorization matches exact decoded object paths, not suffixes or LIKE patterns',async()=>{
  await db.exec('RESET ROLE');
  await db.exec(`INSERT INTO lectures(id,course_id,order_index,title,duration_seconds,video_url) VALUES
   ('prefix-video','c1',3,'Prefix',60,'https://example.invalid/storage/v1/object/public/lectures/prefixA.mp4'),
   ('encoded-video','c1',4,'Encoded',60,'https://example.invalid/storage/v1/object/lectures/dir%2Fspace%20%25_name.mp4');
   INSERT INTO storage.objects(bucket_id,name) VALUES('lectures','prefixA.mp4'),('lectures','A.mp4'),('lectures','_.mp4'),('lectures','%.mp4'),('lectures','dir/space %_name.mp4');`);
  await asRole('authenticated',uid);
  const readable=(await db.query("SELECT name FROM storage.objects WHERE name IN ('prefixA.mp4','A.mp4','_.mp4','%.mp4','dir/space %_name.mp4') ORDER BY name")).rows;
  assert.deepEqual(readable,[{name:'dir/space %_name.mp4'},{name:'prefixA.mp4'}]);
 });
 await t.test('student application permits safe retries but not paid self-activation',async()=>{
  await asRole('authenticated',uid);
  const apply="INSERT INTO enrollments(id,user_id,course_id,status,enrolled_at,paid_at,expire_at) VALUES('retry-enr','student','c2','pending',CURRENT_DATE,NULL,CURRENT_DATE+90) ON CONFLICT(id) DO UPDATE SET status=excluded.status,enrolled_at=excluded.enrolled_at,paid_at=excluded.paid_at,expire_at=excluded.expire_at";
  await db.query(apply);
  await db.query(apply);
  await denied("UPDATE enrollments SET status='active',paid_at=CURRENT_DATE WHERE id='retry-enr'");
  await db.exec('RESET ROLE');
  await db.exec("UPDATE enrollments SET status='active',paid_at=CURRENT_DATE-100,expire_at=CURRENT_DATE-1 WHERE id='retry-enr'");
  await asRole('authenticated',uid);
  await db.query(apply);
  assert.equal((await db.query("SELECT status FROM enrollments WHERE id='retry-enr'")).rows[0].status,'pending');
  await db.exec('RESET ROLE');
  await db.exec("UPDATE enrollments SET status='active',paid_at=CURRENT_DATE,expire_at=CURRENT_DATE+90 WHERE id='retry-enr'");
  await asRole('authenticated',uid);
  await denied(apply);
  assert.equal((await db.query("SELECT status FROM enrollments WHERE id='retry-enr'")).rows[0].status,'active');
 });
 await t.test('lecture thumbnail persists for admin and remains read-only for students',async()=>{
  await asRole('authenticated',admin);
  await db.query("UPDATE lectures SET thumbnail='https://images.invalid/lecture.jpg' WHERE id='l1'");
  await asRole('authenticated',uid);
  assert.equal((await db.query("SELECT thumbnail FROM lectures WHERE id='l1'")).rows[0].thumbnail,'https://images.invalid/lecture.jpg');
  const changed=await db.query("UPDATE lectures SET thumbnail='forged' WHERE id='l1' RETURNING id");
  assert.equal(changed.rows.length,0);
 });
 await t.test('final heartbeat synchronizes completion when a passing attempt already exists',async()=>{
  await db.exec('RESET ROLE');
  await db.exec(`INSERT INTO courses(id,title) VALUES('past-pass','Past pass');
   INSERT INTO lectures(id,course_id,order_index,title,duration_seconds,video_url) VALUES('short','past-pass',1,'Short',2,'short.mp4');
   INSERT INTO enrollments(id,user_id,course_id,status,enrolled_at,expire_at) VALUES('past-enr','student','past-pass','active',CURRENT_DATE,CURRENT_DATE+90);
   INSERT INTO exam_attempts(id,user_id,course_id,score,passed,correct_count,total_count) VALUES('past-pass-attempt','student','past-pass',100,true,1,1);`);
  await asRole('authenticated',uid);
  await db.query("SELECT update_lecture_progress('short',0)");
  await db.exec('RESET ROLE');
  await db.exec("UPDATE lms_private.playback_clocks SET last_seen=clock_timestamp()-interval '2 seconds' WHERE lecture_id='short'");
  await asRole('authenticated',uid);
  await db.query("SELECT update_lecture_progress('short',2)");
  assert.equal((await db.query("SELECT status FROM enrollments WHERE id='past-enr'")).rows[0].status,'completed');
 });
});
