// User-entered SMTP secret is persisted only in the existing ignored .env file.
// This helper never loads that file into process.env or connects to SMTP/APIs.
import {createServer} from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {readFile,lstat,open,rename,unlink,chmod,realpath} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const run=promisify(execFile);
const workspace=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const validPassword=value=>typeof value==='string'&&value.length>=8&&value.length<=128&&!/[\x00-\x20\x7f'\r\n]/.test(value);
const safeError=()=>new Error('SMTP setup could not safely save the password.');

export function updateSmtpPasswordText(text,password){
 if(typeof text!=='string'||!validPassword(password)||text.includes('\0'))throw safeError();
 const bom=text.startsWith('\uFEFF')?'\uFEFF':'';text=text.slice(bom.length);
 const eol=text.includes('\r\n')?'\r\n':'\n';const spans=[];let offset=0;
 while(offset<text.length){
  let end=text.indexOf('\n',offset);if(end<0)end=text.length;else end++;
  const line=text.slice(offset,end);
  const assignment=line.match(/^[\t ]*(?:export[\t ]+)?([A-Za-z_][A-Za-z0-9_]*)[\t ]*=[\t ]*/);
  if(assignment){
   const valueStart=offset+assignment[0].length,quote=text[valueStart];
   if(["'",'"','`'].includes(quote)){
    const close=text.indexOf(quote,valueStart+1);if(close<0)throw safeError();
    end=text.indexOf('\n',close);if(end<0)end=text.length;else end++;
   }
   if(assignment[1]==='SMTP_PASSWORD')spans.push({start:offset,end,eol:text.slice(offset,end).endsWith('\r\n')?'\r\n':text.slice(offset,end).endsWith('\n')?'\n':''});
  }
  offset=end;
 }
 const assignment=`SMTP_PASSWORD='${password}'`;
 if(!spans.length)return bom+text+(text&&!text.endsWith('\n')?eol:'')+assignment+eol;
 let output='',last=0;
 for(const [index,span] of spans.entries()){output+=text.slice(last,span.start)+(index===0?assignment+span.eol:'');last=span.end;}
 return bom+output+text.slice(last);
}

export async function restrictSecretFile(file){
 if(process.platform!=='win32'){await chmod(file,0o600);return;}
 // Replace ACL on this one file, without changing its parent/project ACL.
 const command="$ErrorActionPreference='Stop'; $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User; $acl=New-Object Security.AccessControl.FileSecurity; $acl.SetAccessRuleProtection($true,$false); foreach($principal in @($sid,(New-Object Security.Principal.SecurityIdentifier('S-1-5-18')))){ $rule=New-Object Security.AccessControl.FileSystemAccessRule($principal,'FullControl','Allow'); $acl.AddAccessRule($rule) }; [IO.File]::SetAccessControl($env:SMTP_SETUP_ACL_PATH,$acl)";
 await run('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{windowsHide:true,timeout:15000,env:{...process.env,SMTP_SETUP_ACL_PATH:file}});
}

export async function saveSmtpPassword({envPath,password,protectFile=restrictSecretFile}={}){
 let lock,temporary,original;
 try{
  const target=path.resolve(envPath||path.join(workspace,'.env'));
  if(path.basename(target)!=='.env'||!validPassword(password))throw safeError();
  const parent=await realpath(path.dirname(target));
  if(parent.toLowerCase()!==path.dirname(target).toLowerCase())throw safeError();
  const before=await lstat(target);if(!before.isFile()||before.isSymbolicLink()||before.nlink!==1||before.size>1024*1024)throw safeError();
  lock=await open(`${target}.smtp-setup.lock`,'wx',0o600);lock.target=`${target}.smtp-setup.lock`;
  original=await readFile(target);const updated=updateSmtpPasswordText(original.toString('utf8'),password);
  // Do not rewrite invalid UTF-8 or accidentally change another setting's bytes.
  if(!Buffer.from(original.toString('utf8')).equals(original))throw safeError();
  temporary=`${target}.smtp-setup-${randomBytes(12).toString('hex')}.tmp`;
  const handle=await open(temporary,'wx',0o600);
  try{await protectFile(temporary);await handle.writeFile(updated,'utf8');await handle.sync();}finally{await handle.close();}
  const current=await lstat(target);
  if(!current.isFile()||current.isSymbolicLink()||current.nlink!==1||current.ino!==before.ino||current.dev!==before.dev||!(await readFile(target)).equals(original))throw safeError();
  await rename(temporary,target);temporary=undefined;
  return {status:'saved',setting:'SMTP_PASSWORD',mailSent:false};
 }catch{throw safeError();}
 finally{original?.fill(0);password=undefined;if(temporary)await unlink(temporary).catch(()=>{});if(lock){await lock.close().catch(()=>{});await unlink(lock.target).catch(()=>{});}}
}

const headers={'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Pragma':'no-cache','Referrer-Policy':'same-origin','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"};
const html=body=>`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>백업 메일 비밀번호 설정</title><body>${body}</body></html>`;
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sameSecret=(value,expected)=>typeof value==='string'&&Buffer.byteLength(value)===Buffer.byteLength(expected)&&timingSafeEqual(Buffer.from(value),Buffer.from(expected));

export async function startSmtpSetupServer({envPath=path.join(workspace,'.env'),save=saveSmtpPassword,onResult=()=>{},timeoutMs=15*60*1000}={}){
 const target=path.resolve(envPath),csrf=randomBytes(32).toString('hex');let origin='',state='ready';
 const server=createServer(async(req,res)=>{
  const send=(status,body)=>{res.writeHead(status,headers);res.end(html(body));};
  if(!origin||req.socket.remoteAddress!=='127.0.0.1'||req.headers.host!==new URL(origin).host){send(403,'허용되지 않은 요청입니다.');return;}
  if(req.method==='GET'&&req.url==='/'){
   if(state!=='ready'){send(410,'이미 사용했거나 만료된 입력 창입니다.');return;}
   send(200,`<h1>네이버 백업 메일 앱 비밀번호</h1><p>입력한 앱 비밀번호를 <strong>${escape(target)}</strong> 파일의 <strong>SMTP_PASSWORD</strong>에 평문으로 저장합니다. 파일 접근은 현재 Windows 사용자와 SYSTEM으로 제한합니다. 다른 설정은 유지합니다.</p><p>네이버 로그인 비밀번호가 아닌 메일용 앱 비밀번호를 입력하세요. 이 도구는 메일을 보내거나 외부 서버에 접속하지 않습니다. 15분 후 만료됩니다.</p><form method="post" action="/save" autocomplete="off"><input type="hidden" name="csrf" value="${csrf}"><label>앱 비밀번호 <input type="password" name="password" autocomplete="off" required minlength="8" maxlength="128"></label><label>앱 비밀번호 확인 <input type="password" name="confirmation" autocomplete="off" required minlength="8" maxlength="128"></label><button type="submit">.env에 앱 비밀번호 저장</button></form>`);return;
  }
  if(req.method!=='POST'||req.url!=='/save'){send(405,'지원하지 않는 요청입니다.');return;}
  if(req.headers.origin!==origin||!['same-origin',undefined].includes(req.headers['sec-fetch-site'])||!/^application\/x-www-form-urlencoded(?:;|$)/i.test(req.headers['content-type']||'')){send(403,'허용되지 않은 요청입니다.');return;}
  if(state!=='ready'){send(410,'이미 처리 중이거나 사용된 입력 창입니다.');return;}
  const chunks=[];let raw,password='',confirmation='';
  try{
   let length=0;for await(const chunk of req){chunks.push(chunk);length+=chunk.length;if(length>4096){send(413,'입력 크기가 너무 큽니다.');return;}}
   raw=Buffer.concat(chunks);const fields=new URLSearchParams(raw.toString('utf8'));
   if(fields.getAll('csrf').length!==1||!sameSecret(fields.get('csrf'),csrf)){send(403,'입력 창의 인증 값을 확인하지 못했습니다.');return;}
   if(fields.getAll('password').length!==1||fields.getAll('confirmation').length!==1){send(400,'입력값을 확인해 주세요.');return;}
   password=fields.get('password');confirmation=fields.get('confirmation');fields.delete('password');fields.delete('confirmation');
   if(!validPassword(password)||password!==confirmation){send(400,'앱 비밀번호 형식 또는 확인 값이 일치하지 않습니다. 공백·작은따옴표 없이 8~128자를 입력하세요.');return;}
   if(state!=='ready'){send(410,'이미 처리 중이거나 사용된 입력 창입니다.');return;}
   state='processing';let ok=false;
   try{ok=(await save({envPath:target,password}))?.status==='saved';}catch{/* Never return filesystem errors or supplied values. */}
   state='finished';try{onResult({status:ok?'saved':'failed',mailSent:false});}catch{}
   send(ok?200:409,ok?'<h1>저장 완료</h1><p>.env의 SMTP_PASSWORD를 저장했습니다. 메일 발송과 인증 확인은 수행하지 않았습니다. 이 입력 창은 다시 사용할 수 없습니다.</p>':'<h1>저장 확인 필요</h1><p>안전한 저장을 완료하지 못했습니다. 운영자가 파일 권한과 변경 상태를 확인해야 합니다. 비밀번호는 이 화면이나 로그에 표시하지 않습니다.</p>');
  }catch{if(state!=='ready')state='finished';if(!res.headersSent)send(400,'요청을 처리하지 못했습니다.');}
  finally{raw?.fill(0);for(const chunk of chunks)chunk.fill(0);password='';confirmation='';}
 });
 server.headersTimeout=5000;server.requestTimeout=10000;
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});origin=`http://127.0.0.1:${server.address().port}`;
 const timer=setTimeout(()=>{state='finished';server.close();server.closeAllConnections();},timeoutMs);timer.unref();
 return {url:origin,close:async()=>{clearTimeout(timer);server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 try{
  // Require an existing, ignored and untracked workspace .env before showing UI.
  const envPath=path.join(workspace,'.env');await lstat(envPath);
  await run('git',['check-ignore','--quiet','--no-index','--','.env'],{cwd:workspace,windowsHide:true});
  const tracked=await run('git',['ls-files','--','.env'],{cwd:workspace,windowsHide:true});if(tracked.stdout.trim())throw safeError();
  const instance=await startSmtpSetupServer({envPath,onResult:result=>console.log(JSON.stringify(result))});
  console.log(JSON.stringify({status:'ready',url:instance.url}));
 }catch{console.error(JSON.stringify({status:'failed'}));process.exitCode=1;}
}
