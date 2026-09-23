import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createMediaStorage } from '../src/services/mediaStorage.js';
import { createVideoUploadMiddleware } from '../src/server/videoUploader.js';

function fakeXhr(log, status=200, response='{}') {
 return () => ({ upload:{}, headers:{}, open(method,url) { this.method=method;this.url=url; },
  setRequestHeader(name,value) { this.headers[name]=value; }, send(file) { log.push(this);this.status=status;this.responseText=response;queueMicrotask(()=>this.onload()); } });
}
const url='https://storage.invalid',key='public-key';
test('production video upload goes directly to private bucket using user JWT',async()=>{
 const calls=[];
 const media=createMediaStorage({url,key,token:async()=>'user-jwt',xhrFactory:fakeXhr(calls)});
 const result=await media.uploadLectureVideo({name:'test.mp4',type:'video/mp4',size:100});
 assert.match(calls[0].url,/\/storage\/v1\/object\/lectures\//);
 assert.equal(calls[0].headers.Authorization,'Bearer user-jwt');assert.equal(calls[0].headers.apikey,key);
 assert.equal(result.publicUrl.includes('/public/'),false);
});
test('local mode is explicit and never falls back after server failure',async()=>{
 const calls=[];
 const media=createMediaStorage({url,key,token:async()=>'user-jwt',localMode:true,xhrFactory:fakeXhr(calls,404,'{}')});
 await assert.rejects(()=>media.uploadLectureVideo({name:'test.mp4',type:'video/mp4',size:100}));
 assert.equal(calls.length,1);assert.match(calls[0].url,/^\/api\/upload-video/);
});
test('anonymous upload and large direct upload fail before sending file',async()=>{
 const calls=[];
 const anonymous=createMediaStorage({url,key,token:async()=>key,xhrFactory:fakeXhr(calls)});
 await assert.rejects(()=>anonymous.uploadLectureVideo({name:'test.mp4',type:'video/mp4',size:100}));
 const admin=createMediaStorage({url,key,token:async()=>'jwt',xhrFactory:fakeXhr(calls)});
 await assert.rejects(()=>admin.uploadLectureVideo({name:'test.mp4',type:'video/mp4',size:49*1024*1024}));
 assert.equal(calls.length,0);
});
test('private lecture URLs are freshly signed including retry after expiry',async()=>{
 let requests=0;
 const media=createMediaStorage({url,key,token:async()=>'jwt',request:async(target,options)=>{
  assert.equal(target,`${url}/storage/v1/object/sign/lectures/video.mp4`);
  assert.equal(options.headers.Authorization,'Bearer jwt');assert.equal(JSON.parse(options.body).expiresIn,3600);
  return Response.json({signedURL:`/object/sign/lectures/video.mp4?token=${++requests}`});
 }});
 const source=`${url}/storage/v1/object/public/lectures/video.mp4`;
 assert.match(await media.getLectureVideoUrl(source),/token=1$/);
 assert.match(await media.getLectureVideoUrl(source),/token=2$/);
 assert.equal(await media.getLectureVideoUrl('https://external.invalid/example.mp4'),'https://external.invalid/example.mp4');
});
test('legacy thumbnail signing permits anonymous token but not video signing',async()=>{
 const media=createMediaStorage({url,key,token:async()=>key,request:async()=>Response.json({signedURL:'/object/sign/lectures/thumbs/a.jpg?token=thumb'})});
 assert.match(await media.getThumbnailUrl(`${url}/storage/v1/object/public/lectures/thumbs/a.jpg`),/token=thumb/);
 await assert.rejects(()=>media.getLectureVideoUrl(`${url}/storage/v1/object/public/lectures/a.mp4`));
});
test('deletion resolves private and legacy object URLs and ignores external sources', async () => {
 const calls=[];
 const media=createMediaStorage({url,key,token:async()=>'jwt',request:async(target,options)=>{
  calls.push({target,...options});return Response.json({});
 }});
 for (const source of ['object/lectures/folder/a%20b.mp4','object/public/lectures/folder/a%20b.mp4','object/sign/lectures/folder/a%20b.mp4?token=temporary']) {
  assert.equal(await media.deleteLectureVideo(`${url}/storage/v1/${source}`),true);
 }
 assert.equal(await media.deleteLectureVideo('https://external.invalid/storage/v1/object/lectures/a.mp4'),false);
 assert.equal(calls.length,3);
 for(const call of calls){
  assert.equal(call.method,'DELETE');assert.equal(call.headers.Authorization,'Bearer jwt');
  assert.deepEqual(JSON.parse(call.body),{prefixes:['folder/a b.mp4']});
 }
});
async function invoke(middleware,{headers={},body='video'}={}) {
 const req=Readable.from([Buffer.from(body)]);req.method='POST';req.url='/api/upload-video?name=test.mp4';req.headers=headers;
 const res=new EventEmitter();res.destroyed=false;res.writableEnded=false;
 res.writeHead=status=>{res.status=status;};res.end=value=>{res.value=JSON.parse(value);res.writableEnded=true;};
 await middleware(req,res,()=>assert.fail('Unexpected next'));
 return res;
}
test('local middleware rejects missing JWT and non-admin before reading body',async()=>{
 const dir=path.join(os.tmpdir(),`lms-media-denied-${crypto.randomUUID()}`);
 let requests=0;
 const middleware=createVideoUploadMiddleware({supabaseUrl:url,anonKey:key,uploadDir:dir,request:async target=>{
  requests++;return Response.json(target.endsWith('/user')?{id:'auth-user'}:{role:'student'});
 }});
 assert.equal((await invoke(middleware)).status,401);assert.equal(requests,0);
 assert.equal((await invoke(middleware,{headers:{authorization:'Bearer jwt','content-type':'video/mp4'}})).status,403);
 await assert.rejects(()=>fs.stat(dir),{code:'ENOENT'});
});
test('local middleware enforces byte limit before creating a temporary file',async()=>{
 const dir=path.join(os.tmpdir(),`lms-media-large-${crypto.randomUUID()}`);
 const middleware=createVideoUploadMiddleware({supabaseUrl:url,anonKey:key,uploadDir:dir,maxBytes:5,request:async target=>Response.json(target.endsWith('/user')?{id:'auth-user'}:{role:'admin'})});
 const response=await invoke(middleware,{headers:{authorization:'Bearer jwt','content-type':'video/mp4','content-length':'6'}});
 assert.equal(response.status,413);await assert.rejects(()=>fs.stat(dir),{code:'ENOENT'});
});
test('local conversion forwards user JWT and cleans temporary files',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'lms-media-test-'));
 t.after(async()=>{ assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));await fs.rm(dir,{recursive:true,force:true}); });
 let uploadHeaders;
 const middleware=createVideoUploadMiddleware({supabaseUrl:url,anonKey:key,uploadDir:dir,
  exec:(_binary,args,options,done)=>{
   assert.equal(options.windowsHide,true);assert.equal(options.timeout,600000);
   fs.writeFile(args.at(-1),'encoded').then(()=>done(null),done);
  },request:async(target,options)=>{
   if(target.endsWith('/user')) return Response.json({id:'auth-user'});
   if(target.endsWith('/current_lms_user')) return Response.json({role:'admin'});
   uploadHeaders=options.headers;
   for await(const chunk of options.body) assert.equal(chunk.toString(),'encoded');
   return Response.json({});
  }});
 const response=await invoke(middleware,{headers:{authorization:'Bearer jwt','content-type':'video/mp4'}});
 assert.equal(response.status,200);assert.equal(uploadHeaders.Authorization,'Bearer jwt');assert.equal(uploadHeaders.apikey,key);
 assert.deepEqual(await fs.readdir(dir),[]);
});
test('failed conversion removes its temporary upload files',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'lms-media-failure-'));
 t.after(async()=>{assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));await fs.rm(dir,{recursive:true,force:true});});
 const middleware=createVideoUploadMiddleware({supabaseUrl:url,anonKey:key,uploadDir:dir,
  exec:(_binary,_args,_options,done)=>done(new Error('encoder failed')),
  request:async target=>Response.json(target.endsWith('/user')?{id:'auth-user'}:{role:'admin'})});
 assert.equal((await invoke(middleware,{headers:{authorization:'Bearer jwt','content-type':'video/mp4'}})).status,500);
 assert.deepEqual(await fs.readdir(dir),[]);
});
