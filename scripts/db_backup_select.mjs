// Public-schema SELECT snapshot requested by the operator, not a pg_dump replacement.
import { mkdir,open,rename,unlink,readdir,stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { secureDirectory } from './db_backup.mjs';

import { selectSnapshot } from '../lib/cloud-backup/select-snapshot.mjs';
export { OMIT_CREDENTIAL,selectSnapshot } from '../lib/cloud-backup/select-snapshot.mjs';

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
