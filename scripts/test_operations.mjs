import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { randomBytes,createHash } from 'node:crypto';
import { mkdtemp,readFile,writeFile,readdir,utimes,rm,open } from 'node:fs/promises';
import path from 'node:path';
import { encryptStream,verifyArchive,encryptionKey,pruneBackups,runBackup,databaseEnvironment,restoreArchive } from './db_backup.mjs';
import { rotateAdmin } from './admin_account_rotate.mjs';
import { selectSnapshot } from './db_backup_select.mjs';
import { restoreSelect } from './db_backup_restore_select.mjs';

const dir=await mkdtemp(path.resolve('test_artifacts/operations-'));
let checks=0;
try {
  const key=randomBytes(32),payload=Buffer.from('Fixture SQL archive data; not a real database dump.');
  const encrypted=path.join(dir,'sample.aesgcm');
  await encryptStream(Readable.from(payload),encrypted,key);await verifyArchive(encrypted,key);checks++;
  assert.ok(!(await readFile(encrypted)).includes(payload));
  await assert.rejects(verifyArchive(encrypted,randomBytes(32)));checks++;
  const tampered=await readFile(encrypted);tampered[22]^=1;await writeFile(path.join(dir,'tampered'),tampered);
  await assert.rejects(verifyArchive(path.join(dir,'tampered'),key));checks++;
  assert.throws(()=>encryptionKey('invalid'));assert.deepEqual(encryptionKey(key.toString('base64')),key);checks++;
  assert.throws(()=>databaseEnvironment('postgresql://test:test@example.org/lms_restore_test',{localOnly:true}));
  assert.throws(()=>databaseEnvironment('postgresql://test:test@localhost/production',{localOnly:true}));
  const pgEnv=databaseEnvironment('postgresql://test:example-only@localhost/lms_restore_test',{localOnly:true});
  assert.equal(pgEnv.PGPASSWORD,'example-only');assert.equal(pgEnv.SUPABASE_SERVICE_ROLE_KEY,undefined);checks++;
  await assert.rejects(restoreArchive(encrypted,{BACKUP_ENCRYPTION_KEY:key.toString('base64')}));checks++;
  const old='lms-2020-01-01T00-00-00Z-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.pgdump.aesgcm';
  const newest='lms-2020-01-02T00-00-00Z-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb.pgdump.aesgcm';
  for(const name of [old,newest,'unrelated.txt']){await writeFile(path.join(dir,name),'fixture');await utimes(path.join(dir,name),new Date(0),new Date(0));}
  await pruneBackups(dir,30,newest);const names=await readdir(dir);
  assert.ok(!names.includes(old));assert.ok(names.includes(newest));assert.ok(names.includes('unrelated.txt'));checks++;
  const result=await runBackup({BACKUP_DIR:dir,BACKUP_ENCRYPTION_KEY:key.toString('base64'),BACKUP_DATABASE_URL:'postgresql://fake:fake-secret@localhost/test',PG_DUMP_BIN:path.join(dir,'nonexistent-pg-dump')});
  assert.equal(result.status,'failed');assert.ok((await readdir(dir)).includes(newest));assert.ok(!(await readdir(dir)).some(n=>n.endsWith('.partial')));
  assert.ok(!(await readFile(path.join(dir,'backup-results.jsonl'),'utf8')).includes('fake-secret'));checks++;
  const lock=await open(path.join(dir,'.backup.lock'),'wx');await lock.close();
  await assert.rejects(runBackup({BACKUP_DIR:dir}));checks++;

  const manifest={kind:'public-select-snapshot',projectHost:'fixture.invalid',jobId:'test-job',finishedAt:new Date().toISOString(),tables:{}};
  const restore={status:'passed',sourceJobId:'test-job',tables:{}};
  for(const name of ['users','courses','lectures','enrollments','payments','progress','certificates','qa_posts','qa_answers','exam_attempts']){const rows=name==='users'?[{id:'old-admin',role:'admin'}]:[];manifest.tables[name]={rows,rowCount:rows.length};restore.tables[name]={restored:rows.length,contentMatches:true};}
  const manifestFile=path.join(dir,'backup.json'),manifestBytes=JSON.stringify(manifest);restore.sourceSha256=createHash('sha256').update(manifestBytes).digest('hex');
  await writeFile(manifestFile,manifestBytes);await writeFile(`${manifestFile}.restore-report.json`,JSON.stringify(restore));
  const env={SUPABASE_URL:'https://fixture.invalid',SUPABASE_SERVICE_ROLE_KEY:'fixture-service',SUPABASE_ANON_KEY:'fixture-anon',ADMIN_ACCESS_TOKEN:'fixture-admin',ADMIN_CANONICAL_ID:'old-admin',NEW_ADMIN_LOGIN:'adsba',ADMIN_ROTATION_APPROVED_HOST:'fixture.invalid',ADMIN_BACKUP_MANIFEST_FILE:manifestFile};
  function fixture(failure){
    const state={id:'old-admin',login_id:null,role:'admin',auth_user_id:'auth-id'},calls=[];
    const fetchImpl=async(url,options)=>{
      const u=new URL(url),body=options.body?JSON.parse(options.body):null;calls.push({path:u.pathname,method:options.method,body});
      let value;
      if(u.pathname==='/auth/v1/user')value={id:'auth-id'};
      else if(u.pathname==='/rest/v1/rpc/current_lms_user')value={id:'old-admin',role:failure==='verify'&&calls.some(c=>c.path==='/functions/v1/lms-auth')?'student':'admin'};
      else if(u.pathname==='/rest/v1/users'){
        if(options.method==='PATCH'){
          if(failure==='alias')return new Response('{}',{status:409});
          state.login_id=body.login_id;
        }
        value=[{...state}];
      }else if(u.pathname==='/auth/v1/admin/users/auth-id'){
        if(options.method==='PUT'&&failure==='password')throw new Error('uncertain network response');
        value={id:'auth-id',email:`${createHash('sha256').update('old-admin').digest('hex')}@lms.invalid`};
      }else if(u.pathname==='/functions/v1/lms-auth')value={session:{access_token:'fixture-new-session'}};
      else if(u.pathname==='/auth/v1/logout')return new Response(null,{status:204});
      else throw new Error('Unexpected endpoint');
      return new Response(JSON.stringify(value),{status:200});
    };
    return {state,calls,fetchImpl};
  }
  let f=fixture(),rotation=await rotateAdmin({env,fetchImpl:f.fetchImpl});
  assert.equal(rotation.status,'preflight-only');assert.ok(!f.calls.some(c=>['PATCH','PUT'].includes(c.method)));checks++;
  f=fixture();rotation=await rotateAdmin({env,apply:true,password:'FixtureOnly123!',fetchImpl:f.fetchImpl});
  assert.equal(rotation.status,'verified');assert.equal(f.state.login_id,'adsba');assert.equal(f.state.id,'old-admin');assert.equal(f.state.role,'admin');checks++;
  for(const failure of ['alias','password','verify']){
    f=fixture(failure);rotation=await rotateAdmin({env,apply:true,password:'FixtureOnly123!',fetchImpl:f.fetchImpl});
    assert.equal(rotation.status,'requires-recovery');assert.equal(f.state.login_id,null);
    assert.equal(rotation.passwordState,failure==='alias'?'unchanged':'may-have-changed');
    assert.ok(!JSON.stringify(rotation).includes('FixtureOnly123!'));checks++;
  }
  f=fixture();await assert.rejects(rotateAdmin({env:{...env,ADMIN_ROTATION_APPROVED_HOST:'wrong.invalid'},apply:true,password:'FixtureOnly123!',fetchImpl:f.fetchImpl}));assert.equal(f.calls.length,0);checks++;
  f=fixture();await assert.rejects(rotateAdmin({env:{...env,ADMIN_BACKUP_MANIFEST_FILE:undefined},apply:true,password:'FixtureOnly123!',fetchImpl:f.fetchImpl}));assert.equal(f.calls.length,0);checks++;
  const apiCalls=[];
  const selectFetch=async(url)=>{const u=new URL(url);apiCalls.push(u);if(u.pathname==='/rest/v1/')return new Response(JSON.stringify({definitions:{users:{properties:{id:{description:'<pk/>'},name:{},password:{}}}},paths:{'/users':{get:{}}}}));const offset=Number(u.searchParams.get('offset'));assert.equal(u.searchParams.get('select'),'id,name');return new Response(JSON.stringify(offset===0?[{id:'one',name:'Fixture',password:'must-not-export'}]:[{id:'two',name:'Fixture'}]),{headers:{'content-range':`${offset}-${offset}/2`}});};
  const selected=await selectSnapshot(env,selectFetch);assert.equal(selected.tables.users.rowCount,2);assert.deepEqual(selected.tables.users.omittedColumns,['password']);assert.equal(apiCalls.length,3);assert.ok(!JSON.stringify(selected).includes('must-not-export'));checks++;
  const asTable=rows=>({columns:Object.keys(rows[0]),rows,rowCount:rows.length,orderBy:['id']});
  const legacyUser={id:'restore-student',name:'Fixture',birth_date:'2000-01-01',phone:'01000000000',member_no:'TEST-RESTORE',role:'student',created_at:'2020-01-01T00:00:00Z'};
  const legacySnapshot={jobId:'restore-legacy',tables:{users:asTable([legacyUser])}};
  let restoreResult=await restoreSelect(legacySnapshot);assert.equal(restoreResult.status,'passed');assert.equal(restoreResult.schemaProfile,'legacy');checks++;
  const enhancedSnapshot={jobId:'restore-enhanced',tables:{
    users:asTable([{...legacyUser,auth_user_id:'22222222-2222-4222-8222-222222222222',login_id:'restore-alias',privacy_consent:true,privacy_consent_at:'2020-01-02T03:04:05Z',privacy_policy_version:'2026-09-23',privacy_consent_source:'legacy_admin_backfill'}]),
    courses:asTable([{id:'restore-course',title:'Fixture course'}]),
    enrollments:asTable([{id:'restore-enrollment',user_id:legacyUser.id,course_id:'restore-course',status:'applied',enrolled_at:'2020-01-01',paid_at:null,expire_at:'2099-01-01',application_version:7}]),
    site_announcements:asTable([{id:'33333333-3333-4333-8333-333333333333',title:'Fixture announcement',content:'Fixture text',type:'text',image_url:null,link_url:null,enabled:true,starts_at:null,ends_at:null,created_at:'2020-01-01T03:04:05Z',updated_at:'2020-02-03T04:05:06Z'}])
  }};
  enhancedSnapshot.tables.site_announcements.rows.push({...enhancedSnapshot.tables.site_announcements.rows[0],id:'44444444-4444-4444-8444-444444444444',type:'image',image_url:'https://example.invalid/fixture.png',starts_at:'2020-03-04T05:06:07Z',ends_at:'2030-03-04T05:06:07Z'});
  enhancedSnapshot.tables.site_announcements.rowCount=2;
  restoreResult=await restoreSelect(enhancedSnapshot);assert.equal(restoreResult.status,'passed');assert.equal(restoreResult.schemaProfile,'migrations-001-003');assert.equal(restoreResult.authIdentifierStubs,1);assert.equal(restoreResult.generatedSmsJobs,0);assert.equal(restoreResult.tables.site_announcements.contentMatches,true);assert.equal(restoreResult.tables.enrollments.contentMatches,true);checks++;
  console.log(`${checks} operations checks passed (crypto/failure/mocked Auth; no PostgreSQL restore claimed)`);
} finally {await rm(dir,{recursive:true,force:true});}
