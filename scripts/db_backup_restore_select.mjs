// Restore verification happens only in a new in-memory PGlite database, never remotely.
import { PGlite } from '@electric-sql/pglite';
import { readFile,writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const quote=name=>{if(!/^[A-Za-z_][A-Za-z_0-9]*$/.test(name))throw new Error('Invalid identifier');return `"${name}"`;};
export async function restoreSelect(snapshot){
  const db=new PGlite();
  const report={kind:'isolated-select-restore',sourceJobId:snapshot.jobId,at:new Date().toISOString(),status:'failed',tables:{},limitations:['In-memory PGlite test of selected public columns, not full PostgreSQL/Supabase restore','users.password NOT NULL is relaxed only in the isolated database; credentials are not invented or restored','Production DDL, Auth, RLS and Storage objects are not covered']};
  try{
    const enhanced=Boolean(snapshot.tables.site_announcements||snapshot.tables.users?.columns.includes('privacy_consent'));
    report.schemaProfile=enhanced?'migrations-001-003':'legacy';
    if(enhanced){
      // Platform identifiers only, not Auth accounts, sessions or credentials.
      await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
        CREATE SCHEMA auth; CREATE SCHEMA storage; CREATE TABLE auth.users(id uuid PRIMARY KEY);
        CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
        GRANT USAGE ON SCHEMA auth,storage TO anon,authenticated,service_role;
        GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated,service_role;
        CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
        CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text,metadata jsonb);
        ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;`);
    }
    const schema=await readFile(new URL('../database_setup.sql',import.meta.url),'utf8');
    await db.exec(schema.slice(0,schema.indexOf('-- Row Level Security')));
    if(enhanced){
      for(const name of ['202609230001_security.sql','202609230002_course_writes.sql','202609230003_enhancements.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
      const identifiers=[...new Set((snapshot.tables.users?.rows||[]).map(row=>row.auth_user_id).filter(Boolean))];
      for(const id of identifiers)await db.query('INSERT INTO auth.users(id) VALUES($1)',[id]);
      report.authIdentifierStubs=identifiers.length;
      report.limitations.push('Enhanced schema rebuilt from repository migrations with minimal platform stubs; Auth identifiers alone are placeholders, not restored Auth accounts','User triggers disabled only during isolated data import to preserve timestamps and application_version and prevent SMS jobs; private derived tables are not restored');
    }
    await db.exec('ALTER TABLE users ALTER COLUMN password DROP NOT NULL');
    const order=['users','courses','lectures','enrollments','payments','donation_receipts','progress','qa_posts','qa_answers','certificates','exam_attempts','site_announcements'];
    if(Object.keys(snapshot.tables).some(t=>!order.includes(t)))throw new Error('Unknown table requires schema review');
    await db.transaction(async tx=>{
      for(const name of order){
        const table=snapshot.tables[name];if(!table)continue;
        const columns=table.columns.map(quote).join(','),type=`public.${quote(name)}`,orderBy=table.orderBy.map(quote).join(',');
        if(enhanced)await tx.exec(`ALTER TABLE ${type} DISABLE TRIGGER USER`);
        for(const row of table.rows){
          await tx.query(`INSERT INTO ${type} (${columns}) SELECT ${columns} FROM jsonb_populate_record(NULL::${type},$1::jsonb)`,[JSON.stringify(row)]);
        }
        const count=Number((await tx.query(`SELECT count(*) AS n FROM ${type}`)).rows[0].n);
        if(count!==table.rowCount)throw new Error('Row count mismatch');
        // PostgreSQL casts both input JSON and restored rows into the same table types.
        const actual=(await tx.query(`SELECT to_jsonb(r) AS value FROM (SELECT ${columns} FROM ${type} ORDER BY ${orderBy}) r`)).rows.map(r=>r.value);
        const expected=(await tx.query(`SELECT to_jsonb(r) AS value FROM (SELECT ${columns} FROM jsonb_populate_recordset(NULL::${type},$1::jsonb) ORDER BY ${orderBy}) r`,[JSON.stringify(table.rows)])).rows.map(r=>r.value);
        if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error('Selected column roundtrip mismatch');
        report.tables[name]={expected:table.rowCount,restored:count,contentMatches:true};
        if(enhanced)await tx.exec(`ALTER TABLE ${type} ENABLE TRIGGER USER`);
      }
      if(enhanced){report.generatedSmsJobs=Number((await tx.query('SELECT count(*) AS n FROM lms_private.sms_outbox')).rows[0].n);if(report.generatedSmsJobs!==0)throw new Error('Isolated import generated unintended SMS jobs');}
    });
    report.status='passed';report.rows=Object.values(report.tables).reduce((n,t)=>n+t.restored,0);return report;
  }finally{await db.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  try{
    const source=process.argv[2];if(!source)throw new Error('Snapshot path required');
    const bytes=await readFile(source);
    const result=await restoreSelect(JSON.parse(bytes.toString('utf8')));
    result.sourceSha256=createHash('sha256').update(bytes).digest('hex');
    const reportPath=`${source}.restore-report.json`;await writeFile(reportPath,JSON.stringify(result,null,2),{mode:0o600});
    console.log(JSON.stringify({status:result.status,tables:Object.keys(result.tables).length,rows:result.rows,report:reportPath}));
  }catch(error){console.error('Isolated SELECT restore failed; no source records or SQL details are logged.');process.exitCode=1;}
}
