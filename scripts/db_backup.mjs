// Server/operations only. Never import this file into the Vite application.
import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, chmod, open, readFile, readdir, stat, rename, unlink, appendFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { Writable } from 'node:stream';
import path from 'node:path';
import { homedir } from 'node:os';
import { pathToFileURL } from 'node:url';

const MAGIC = Buffer.from('LMSBAK01');
export function encryptionKey(value) {
  if (!value || !/^[A-Za-z0-9+/]{43}=$/.test(value)) throw new Error('BACKUP_ENCRYPTION_KEY must be a base64 32-byte key');
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32) throw new Error('Invalid encryption key');
  return key;
}
export async function secureDirectory(dir) {
  const resolved=path.resolve(dir);
  if([path.parse(resolved).root,path.resolve(process.cwd()),path.resolve(homedir())].some(value=>value.toLowerCase()===resolved.toLowerCase()))throw new Error('Use a dedicated backup directory, not a root, home or project directory');
  await mkdir(dir, {recursive:true,mode:0o700});
  if (process.platform === 'win32') {
    // Restrict inherited ACLs, granting only the job identity and SYSTEM.
    const identity = process.env.USERDOMAIN ? `${process.env.USERDOMAIN}\\${process.env.USERNAME}` : process.env.USERNAME;
    if (!identity) throw new Error('Cannot resolve backup job identity');
    await command('icacls.exe', [dir, '/inheritance:r', '/grant:r', `${identity}:(OI)(CI)F`, '*S-1-5-18:(OI)(CI)F']);
  } else await chmod(dir, 0o700);
}
function child(commandName, args, env) {
  const proc = spawn(commandName,args,{env,windowsHide:true,stdio:['pipe','pipe','pipe']});
  // Tool diagnostics can echo connection details. Deliberately never collect or print them.
  proc.stderr.resume();
  const finished = new Promise((resolve,reject) => {
    proc.on('error',()=>reject(new Error('Database tool unavailable')));
    proc.on('close',code=>code===0?resolve():reject(new Error('Database tool failed')));
  });
  finished.catch(()=>{});
  return {proc,finished};
}
async function command(name,args) { const {proc,finished}=child(name,args,process.env); proc.stdout.resume(); proc.stdin.end(); await finished; }
export function databaseEnvironment(connection, {localOnly=false}={}) {
  let url; try {url=new URL(connection);} catch {throw new Error('Database URL is required');}
  if (!['postgres:','postgresql:'].includes(url.protocol)) throw new Error('PostgreSQL URL required');
  if (localOnly && !['localhost','127.0.0.1','[::1]'].includes(url.hostname)) throw new Error('Restore target must be an isolated localhost database');
  if (!url.pathname.slice(1) || (localOnly && !decodeURIComponent(url.pathname.slice(1)).startsWith('lms_restore_'))) throw new Error('Restore database name must start with lms_restore_');
  // Only pass tool-required variables. No service-role or encryption key inherited by pg tools.
  return {PATH:process.env.PATH,Path:process.env.Path,SystemRoot:process.env.SystemRoot,TEMP:process.env.TEMP,TMP:process.env.TMP,
    PGHOST:url.hostname.replace(/^\[|\]$/g,''),PGPORT:url.port||'5432',PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGDATABASE:decodeURIComponent(url.pathname.slice(1)),PGSSLMODE:localOnly?'prefer':(url.searchParams.get('sslmode')||'verify-full'),PGCONNECT_TIMEOUT:'15',
    ...(process.env.PGSSLROOTCERT?{PGSSLROOTCERT:process.env.PGSSLROOTCERT}:{})};
}
export async function encryptStream(source, destination, key) {
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
  const header=Buffer.concat([MAGIC,iv]); cipher.setAAD(header);
  const file=await open(destination,'wx',0o600); await file.write(header); await file.close();
  await pipeline(source,cipher,createWriteStream(destination,{flags:'a',mode:0o600}));
  await appendFile(destination,cipher.getAuthTag());
}
async function decryption(source,key) {
  const file=await open(source,'r');
  try {
    const {size}=await file.stat(); if(size<37) throw new Error('Invalid encrypted archive');
    const header=Buffer.alloc(20),tag=Buffer.alloc(16);
    await file.read(header,0,20,0); await file.read(tag,0,16,size-16);
    if(!header.subarray(0,8).equals(MAGIC)) throw new Error('Invalid encrypted archive');
    const decipher=createDecipheriv('aes-256-gcm',key,header.subarray(8)); decipher.setAAD(header); decipher.setAuthTag(tag);
    return {stream:createReadStream(source,{start:20,end:size-17}),decipher};
  } finally {await file.close();}
}
export async function verifyArchive(source,key) {
  const {stream,decipher}=await decryption(source,key);
  await pipeline(stream,decipher,new Writable({write(_chunk,_encoding,callback){callback();}}));
}
export async function pruneBackups(dir, days, newest, now=Date.now()) {
  if(!Number.isInteger(days)||days<1) throw new Error('BACKUP_RETENTION_DAYS must be a positive integer');
  for(const name of await readdir(dir)) {
    if(!/^lms-\d{4}-\d{2}-\d{2}T[\d-]+Z-[a-f0-9-]+\.pgdump\.aesgcm$/.test(name)||name===newest)continue;
    const file=path.join(dir,name),info=await stat(file);
    if(info.isFile()&&info.mtimeMs<now-days*86400000)await unlink(file);
  }
}
export async function runBackup(env=process.env) {
  const dir=path.resolve(env.BACKUP_DIR||'backups');
  // This must be a dedicated directory because its ACL is restricted.
  await secureDirectory(dir);
  const lockPath=path.join(dir,'.backup.lock'); let lock;
  try {lock=await open(lockPath,'wx',0o600);} catch {throw new Error('Backup already running or stale lock requires operator inspection');}
  const record={jobId:randomUUID(),startedAt:new Date().toISOString(),status:'failed',notification:'not-configured'};
  let partial,archive;
  try {
    const key=encryptionKey(env.BACKUP_ENCRYPTION_KEY),days=Number(env.BACKUP_RETENTION_DAYS||30);
    if(!Number.isInteger(days)||days<1)throw new Error('Invalid retention');
    const dbEnv=databaseEnvironment(env.BACKUP_DATABASE_URL);
    const name=`lms-${new Date().toISOString().replaceAll(':','-').replace(/\.\d{3}/,'')}-${record.jobId}.pgdump.aesgcm`;
    archive=path.join(dir,name);partial=`${archive}.partial`;
    const {proc,finished}=child(env.PG_DUMP_BIN||'pg_dump',['--format=custom','--no-password'],dbEnv);proc.stdin.end();
    // Wait for both producers to settle before deleting a failed partial file.
    // An early spawn failure must not race a still-opening encryption stream.
    const tasks=[encryptStream(proc.stdout,partial,key),finished];
    for(const task of tasks)task.catch(()=>{proc.kill();proc.stdout.destroy();});
    const settled=await Promise.allSettled(tasks);
    if(settled.some(item=>item.status==='rejected'))throw new Error('Database dump or encryption failed');
    await verifyArchive(partial,key);
    const file=await open(partial,'r+');await file.sync();await file.close();
    await rename(partial,archive);partial=null;
    record.archive=name;record.bytes=(await stat(archive)).size;record.status='success';
    try {await pruneBackups(dir,days,name);} catch {record.retention='failed';}
  } catch {record.error='Backup failed; check configuration, connectivity and installed pg_dump without logging credentials';}
  finally {
    if(partial)await unlink(partial).catch(()=>{});
    record.finishedAt=new Date().toISOString();
    if(env.BACKUP_NOTIFY_URL){
      try {
        const url=new URL(env.BACKUP_NOTIFY_URL);if(url.protocol!=='https:')throw new Error();
        const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jobId:record.jobId,status:record.status,finishedAt:record.finishedAt,archive:record.archive,link:record.status==='success'?env.BACKUP_RESULT_LINK:undefined}),signal:AbortSignal.timeout(15000),redirect:'error'});
        if(!response.ok)throw new Error();record.notification='sent';
      }catch{record.notification='failed';}
    }
    try {
      const log=await open(path.join(dir,'backup-results.jsonl'),'a',0o600);
      try {await log.write(`${JSON.stringify(record)}\n`);await log.sync();}finally{await log.close();}
    }finally{await lock.close();await unlink(lockPath);}
  }
  return record;
}
export async function restoreArchive(source,env=process.env) {
  if(env.RESTORE_CONFIRM!=='ISOLATED_LOCAL_DATABASE')throw new Error('Set RESTORE_CONFIRM only for a disposable local database');
  const key=encryptionKey(env.BACKUP_ENCRYPTION_KEY),dbEnv=databaseEnvironment(env.RESTORE_DATABASE_URL,{localOnly:true});
  await verifyArchive(source,key); // Authenticate the entire archive before pg_restore sees any data.
  const {proc,finished}=child(env.PG_RESTORE_BIN||'pg_restore',['--no-password','--no-owner','--no-acl','--exit-on-error','--single-transaction',`--dbname=${dbEnv.PGDATABASE}`],dbEnv);
  proc.stdout.resume();
  const {stream,decipher}=await decryption(source,key);
  try{await Promise.all([pipeline(stream,decipher,proc.stdin),finished]);}catch(error){proc.kill();await finished.catch(()=>{});throw error;}
  return {status:'restored',note:'Verify expected row counts and application queries separately'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  try {
    const mode=process.argv[2]||'backup';let result;
    if(mode==='backup') result=await runBackup();
    else if(mode==='verify'){await verifyArchive(process.argv[3],encryptionKey(process.env.BACKUP_ENCRYPTION_KEY));result={status:'authenticated'};}
    else if(mode==='restore')result=await restoreArchive(process.argv[3]);
    else throw new Error('Unknown operation');
    console.log(JSON.stringify(result));if(result.status==='failed'||result.notification==='failed'||result.retention==='failed')process.exitCode=1;
  }catch{console.error('Operation failed. Check configuration and durable backup-results.jsonl; credentials are intentionally omitted.');process.exitCode=1;}
}
