import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,readdir,rm,link,stat} from 'node:fs/promises';
import {request as httpRequest} from 'node:http';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import os from 'node:os';
import {updateSmtpPasswordText,saveSmtpPassword,startSmtpSetupServer} from './smtp_setup_local.mjs';

const password='FixtureAppPass123!';
async function fixture(t,content='SMTP_HOST=smtp.naver.com\r\nKEEP="unchanged # value"\r\n'){
 const folder=await mkdtemp(path.join(os.tmpdir(),'lms-smtp-setup-test-'));const envPath=path.join(folder,'.env');await writeFile(envPath,content);
 t.after(()=>rm(folder,{recursive:true,force:true}));return {folder,envPath,content};
}
const post=(app,body,headers={})=>fetch(`${app.url}/save`,{method:'POST',headers:{Origin:app.url,'Content-Type':'application/x-www-form-urlencoded',...headers},body:new URLSearchParams(body)});
const form=async app=>{const response=await fetch(app.url);const html=await response.text();return {response,html,csrf:html.match(/name="csrf" value="([^"]+)"/)[1]};};

test('text update preserves BOM, CRLF and unrelated settings; replaces duplicate and multiline SMTP values',()=>{
 const original='\uFEFF# original\r\nKEEP="line one\r\nSMTP_PASSWORD=inside other value\r\nline three"\r\nexport SMTP_PASSWORD="old\r\nvalue" # previous\r\nOTHER=unchanged\r\nSMTP_PASSWORD=duplicate\r\n';
 const result=updateSmtpPasswordText(original,password);
 assert.equal(result,'\uFEFF# original\r\nKEEP="line one\r\nSMTP_PASSWORD=inside other value\r\nline three"\r\nSMTP_PASSWORD=\''+password+'\'\r\nOTHER=unchanged\r\n');
 assert.equal(updateSmtpPasswordText('KEEP=yes',password),`KEEP=yes\nSMTP_PASSWORD='${password}'\n`);
 for(const invalid of ['short','abc\nINJECT=yes','12345678\rX=Y',"abcd'efgh",'1234 5678','1234\0abcd','x'.repeat(129)])assert.throws(()=>updateSmtpPasswordText('KEEP=yes',invalid),{message:'SMTP setup could not safely save the password.'});
 assert.throws(()=>updateSmtpPasswordText('KEEP="unterminated',password));
});

test('actual fixture .env save is atomic, preserves settings, restricts file access and leaves no scratch secret',async t=>{
 const f=await fixture(t);const result=await saveSmtpPassword({envPath:f.envPath,password});
 assert.deepEqual(result,{status:'saved',setting:'SMTP_PASSWORD',mailSent:false});
 assert.equal(await readFile(f.envPath,'utf8'),f.content+`SMTP_PASSWORD='${password}'\r\n`);
 assert.deepEqual(await readdir(f.folder),['.env']);
 if(process.platform!=='win32')assert.equal((await stat(f.envPath)).mode&0o777,0o600);
 else{
  const command="$acl=[IO.File]::GetAccessControl($env:SMTP_SETUP_TEST_FILE); $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value; $rules=@($acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])); $ok=$acl.AreAccessRulesProtected -and $rules.Count -eq 2; foreach($rule in $rules){$ok=$ok -and $rule.IdentityReference.Value -in @($sid,'S-1-5-18') -and $rule.AccessControlType -eq 'Allow' -and $rule.FileSystemRights -eq 'FullControl'}; if($ok){'ACL_RESTRICTED'}else{exit 1}";
  const checked=await promisify(execFile)('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{windowsHide:true,env:{...process.env,SMTP_SETUP_TEST_FILE:f.envPath}});assert.equal(checked.stdout.trim(),'ACL_RESTRICTED');
 }
});

test('permission failure, malformed content, lock conflict and hard links cannot overwrite the fixture',async t=>{
 const f=await fixture(t);await assert.rejects(saveSmtpPassword({envPath:f.envPath,password,protectFile:async()=>{throw Error(password);}}),{message:'SMTP setup could not safely save the password.'});
 assert.equal(await readFile(f.envPath,'utf8'),f.content);assert.deepEqual(await readdir(f.folder),['.env']);
 await writeFile(`${f.envPath}.smtp-setup.lock`,'');await assert.rejects(saveSmtpPassword({envPath:f.envPath,password}));assert.equal(await readFile(f.envPath,'utf8'),f.content);await rm(`${f.envPath}.smtp-setup.lock`);
 await link(f.envPath,path.join(f.folder,'alias'));await assert.rejects(saveSmtpPassword({envPath:f.envPath,password}));assert.equal(await readFile(f.envPath,'utf8'),f.content);
});

test('an independently edited .env is preserved instead of overwriting newer settings',async t=>{
 const f=await fixture(t);await assert.rejects(saveSmtpPassword({envPath:f.envPath,password,protectFile:async()=>writeFile(f.envPath,f.content+'NEW_SETTING=preserve\n')}));
 assert.equal(await readFile(f.envPath,'utf8'),f.content+'NEW_SETTING=preserve\n');assert.deepEqual(await readdir(f.folder),['.env']);
});

test('localhost checks Host, Origin, CSRF, duplicate fields, size and password confirmation before saving',async t=>{
 const f=await fixture(t);let calls=0;
 const app=await startSmtpSetupServer({envPath:f.envPath,save:async()=>{calls++;return {status:'saved'};}});t.after(()=>app.close());
 const {response,html,csrf}=await form(app);
 assert.ok(html.includes('평문으로 저장'));assert.ok(html.includes('SMTP_PASSWORD'));assert.ok(html.includes('autocomplete="off"'));assert.equal((html.match(/type="password"/g)||[]).length,2);
 assert.equal(response.headers.get('referrer-policy'),'same-origin');assert.equal(response.headers.get('cache-control'),'no-store');assert.ok(response.headers.get('content-security-policy').includes("frame-ancestors 'none'"));
 const body={csrf,password,confirmation:password};
 assert.equal((await post(app,body,{Origin:'https://attacker.invalid'})).status,403);
 assert.equal((await post(app,body,{Origin:'null'})).status,403);
 assert.equal((await post(app,body,{'Sec-Fetch-Site':'cross-site'})).status,403);
 assert.equal((await post(app,body,{'Content-Type':'application/json'})).status,403);
 assert.equal((await post(app,{...body,csrf:'wrong'})).status,403);
 assert.equal((await post(app,{...body,confirmation:'WrongConfirmation'})).status,400);
 assert.equal((await post(app,{...body,password:'abc\nINJECT=yes',confirmation:'abc\nINJECT=yes'})).status,400);
 assert.equal((await post(app,{...body,extra:'x'.repeat(5000)})).status,413);
 assert.equal((await post(app,[['csrf',csrf],['password',password],['password',password],['confirmation',password]])).status,400);
 const wrongHost=await new Promise((resolve,reject)=>{const req=httpRequest(app.url,{headers:{Host:'attacker.invalid'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.end();});assert.equal(wrongHost,403);
 assert.equal((await fetch(`${app.url}/save`)).status,405);assert.equal(calls,0);assert.equal(await readFile(f.envPath,'utf8'),f.content);
});

test('real localhost POST saves only fixture SMTP_PASSWORD, emits safe status and is one-use',async t=>{
 const f=await fixture(t),events=[];
 const app=await startSmtpSetupServer({envPath:f.envPath,onResult:r=>events.push(r)});t.after(()=>app.close());
 const {csrf}=await form(app),response=await post(app,{csrf,password,confirmation:password});assert.equal(response.status,200);const html=await response.text();assert.ok(html.includes('저장 완료'));assert.ok(!html.includes(password));
 assert.equal(await readFile(f.envPath,'utf8'),f.content+`SMTP_PASSWORD='${password}'\r\n`);assert.deepEqual(events,[{status:'saved',mailSent:false}]);
 assert.equal((await post(app,{csrf,password,confirmation:password})).status,410);assert.equal((await fetch(app.url)).status,410);
});

test('concurrent submission executes once; failed operation is consumed without exposing exception data',async t=>{
 const f=await fixture(t);let calls=0,release,start;const begun=new Promise(r=>start=r),hold=new Promise(r=>release=r);
 const app=await startSmtpSetupServer({envPath:f.envPath,save:async()=>{calls++;start();await hold;throw Error(password);}});t.after(()=>app.close());
 const {csrf}=await form(app),body={csrf,password,confirmation:password};const first=post(app,body);await begun;
 assert.equal((await post(app,body)).status,410);release();const failed=await first;assert.equal(failed.status,409);assert.ok(!(await failed.text()).includes(password));assert.equal(calls,1);
 assert.equal((await post(app,body)).status,410);assert.equal(await readFile(f.envPath,'utf8'),f.content);
});

test('expiry closes loopback listener without touching fixture',async t=>{
 const f=await fixture(t);const app=await startSmtpSetupServer({envPath:f.envPath,timeoutMs:30});
 await new Promise(r=>setTimeout(r,75));await assert.rejects(fetch(app.url));await app.close();assert.equal(await readFile(f.envPath,'utf8'),f.content);
});
