// Public-schema SELECT snapshot requested by the operator, not a pg_dump replacement.
import { mkdir,open,rename,unlink,readdir,stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { secureDirectory } from './db_backup.mjs';

export const OMIT_CREDENTIAL=/password|passwd|secret|token|salt|credential/i;
export async function selectSnapshot(env=process.env,fetchImpl=fetch){
  const base=new URL(env.SUPABASE_URL||env.VITE_SUPABASE_URL||'');
  if(base.protocol!=='https:')throw new Error('HTTPS project URL required');
  const key=env.SUPABASE_SERVICE_ROLE_KEY;if(!key)throw new Error('Server service key required');
  const request=async(resource,extra={})=>{
    const response=await fetchImpl(`${base.origin}/rest/v1/${resource}`,{headers:{apikey:key,Authorization:`Bearer ${key}`,Accept:'application/json',...extra},signal:AbortSignal.timeout(30000),redirect:'error'});
    if(!response.ok)throw new Error('Read-only data export failed');
    return {body:await response.json(),range:response.headers.get('content-range')};
  };
  const {body:schema}=await request('',{Accept:'application/openapi+json'});
  const snapshot={version:1,kind:'public-select-snapshot',jobId:randomUUID(),startedAt:new Date().toISOString(),projectHost:base.hostname,
    limitations:['Not a transactional snapshot; concurrent writes may produce inconsistent rows','DDL, indexes, RLS, functions, roles, Auth credentials and Storage object files are not backed up','Credential columns are omitted; this file alone cannot fully restore the project'],tables:{}};
  for(const [name,definition]of Object.entries(schema.definitions||{})){
    if(!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)||!schema.paths?.[`/${name}`]?.get)continue;
    const all=Object.keys(definition.properties||{});
    if(all.some(column=>!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)))throw new Error('Unsupported column name requires review');
    const columns=all.filter(column=>!OMIT_CREDENTIAL.test(column));
    if(!columns.length)continue;
    const pk=all.filter(column=>definition.properties[column].description?.includes('<pk/>'));
    const order=pk.length?pk:all.includes('id')?['id']:columns.slice(0,1);
    const rows=[];let total=null;
    for(let offset=0;;){
      const query=new URLSearchParams({select:columns.join(','),order:order.map(c=>`${c}.asc`).join(','),offset:String(offset),limit:'1000'});
      const page=await request(`${encodeURIComponent(name)}?${query}`,{Prefer:'count=exact'});
      if(!Array.isArray(page.body))throw new Error('Unexpected table response');
      const count=page.range?.match(/\/(\d+)$/)?.[1];
      if(count===undefined)throw new Error('Exact row count unavailable');
      if(total===null)total=Number(count);else if(total!==Number(count))throw new Error('Table changed during snapshot; retry later');
      rows.push(...page.body.map(row=>Object.fromEntries(columns.map(column=>[column,row[column]]))));offset+=page.body.length;
      if(offset===total)break;
      if(!page.body.length||offset>total)throw new Error('Incomplete pagination');
    }
    snapshot.tables[name]={columns,omittedColumns:all.filter(c=>OMIT_CREDENTIAL.test(c)),orderBy:order,rowCount:rows.length,rows};
  }
  if(!Object.keys(snapshot.tables).length)throw new Error('No exportable tables discovered');
  snapshot.finishedAt=new Date().toISOString();return snapshot;
}
export async function sendSnapshot(serialized,filename,env=process.env){
  if(!env.SMTP_HOST||!env.SMTP_FROM||!env.SMTP_USER||!env.SMTP_PASSWORD)return 'not-configured';
  const script=fileURLToPath(new URL('./db_backup_email.py',import.meta.url));
  const python=env.PYTHON_BIN||'python';
  return new Promise(resolve=>{
    const child=spawn(python,[script],{windowsHide:true,stdio:['pipe','ignore','ignore'],env:{...process.env,...env,BACKUP_EMAIL_KIND:filename?'attachment':'failure',BACKUP_ATTACHMENT_NAME:filename||''}});
    const timeout=setTimeout(()=>{child.kill();resolve('failed');},60000);
    child.once('error',()=>{clearTimeout(timeout);resolve('failed');});
    child.once('close',code=>{clearTimeout(timeout);resolve(code===0?'sent':'failed');});
    child.stdin.on('error',()=>{});child.stdin.end(serialized);
  });
}
export async function runSelectBackup(env=process.env,{fetchImpl=fetch,send=true}={}){
  const dir=path.resolve(env.BACKUP_DIR||'test_artifacts/backups');await secureDirectory(dir);
  const lock=await open(path.join(dir,'.select.lock'),'wx',0o600);
  const result={startedAt:new Date().toISOString(),status:'failed',email:'not-attempted'};
  let partial;
  try{
    const snapshot=await selectSnapshot(env,fetchImpl),serialized=JSON.stringify(snapshot,null,2);
    const filename=`select-${snapshot.startedAt.replaceAll(':','-')}-${snapshot.jobId}.json`;
    // Send from memory first, then keep the same bytes internally. Failure still preserves the snapshot.
    result.email=send?await sendSnapshot(serialized,filename,env):'not-requested';
    const destination=path.join(dir,filename);partial=`${destination}.partial`;
    const file=await open(partial,'wx',0o600);try{await file.write(serialized);await file.sync();}finally{await file.close();}
    await rename(partial,destination);partial=null;
    Object.assign(result,{status:'saved',file:filename,tableCount:Object.keys(snapshot.tables).length,rowCount:Object.values(snapshot.tables).reduce((n,t)=>n+t.rowCount,0),credentialColumnsOmitted:true,fullDatabaseBackup:false});
    const retention=Number(env.BACKUP_RETENTION_DAYS||7);if(!Number.isInteger(retention)||retention<1)throw new Error('Invalid retention');
    for(const name of await readdir(dir))if(/^select-[\dT:.Z-]+-[a-f0-9-]+\.json$/.test(name)&&name!==filename){const target=path.join(dir,name);if((await stat(target)).mtimeMs<Date.now()-retention*86400000)await unlink(target);}
  }catch{
    result.error='Snapshot, delivery or retention failed; inspect configuration without printing credentials';
    if(send)result.failureNotification=await sendSnapshot(JSON.stringify({status:'failed',at:new Date().toISOString(),message:'SELECT backup did not complete. Prior backups are preserved; inspect the local result log.'}),null,env);
  }
  finally{
    if(partial)await unlink(partial).catch(()=>{});
    result.finishedAt=new Date().toISOString();
    try{const log=await open(path.join(dir,'select-results.jsonl'),'a',0o600);try{await log.write(`${JSON.stringify(result)}\n`);await log.sync();}finally{await log.close();}}
    finally{await lock.close();await unlink(path.join(dir,'.select.lock'));}
  }
  return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  try{const result=await runSelectBackup();console.log(JSON.stringify(result));if(result.status!=='saved'||result.error||!['sent','not-requested'].includes(result.email))process.exitCode=1;}
  catch{console.error('SELECT backup unavailable; credentials and records are intentionally omitted.');process.exitCode=1;}
}
