import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createRelay } from '../model-relay.mjs';
import { createModelClient } from '../lib/model-client.mjs';
import { recordingHandler } from '../lib/recording-server.mjs';
import { loadApiKey, privateFile } from '../lib/config.mjs';
const token='a'.repeat(64),body={model:'openai/gpt-6-astra',messages:[],max_tokens:10};
async function listen(t,server){await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>{server.closeAllConnections();server.close(r);}));return 'http://127.0.0.1:'+server.address().port;}
function post(url,headers={},payload={path:'/api/v1/chat/completions',body}){return fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token,...headers},body:JSON.stringify(payload)});}

test('relay rejects unauthorized, cross-origin, rebound Host and invalid models without spending',async t=>{
 let calls=0;const url=await listen(t,createRelay({token,env:{},request:async()=>{calls++;return {data:{ok:true},latencyMs:1};}}));
 for(const h of [{Authorization:''},{Authorization:'Bearer wrong'},{Origin:'https://evil.example'},{Origin:'null'}])assert.equal((await post(url,h)).status,403,JSON.stringify(h));
 const rebound=await new Promise((resolve,reject)=>{const req=http.request(url,{method:'POST',headers:{Host:'evil.example',Authorization:'Bearer '+token,'Content-Type':'application/json'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.end(JSON.stringify({path:'/api/v1/chat/completions',body}));});
 assert.equal(rebound,403);
 assert.equal((await post(url,{'Content-Type':'text/plain'})).status,415);
 assert.equal((await post(url,{}, {path:'/api/v1/chat/completions',body:{...body,model:'expensive/other'}})).status,502);
 assert.equal((await post(url,{}, {path:'/api/v1/chat/completions',body:{...body,max_tokens:999999}})).status,502);
 assert.equal(calls,0);
 assert.deepEqual(await (await post(url)).json(),{data:{ok:true},latencyMs:1});assert.equal(calls,1);
});
test('relay bounds concurrency before upstream work',async t=>{
 let release,entered;const started=new Promise(r=>entered=r),pending=new Promise(r=>release=r);
 const url=await listen(t,createRelay({token,env:{MC_RELAY_CONCURRENCY:'1'},request:async()=>{entered();await pending;return {data:{}};}}));
 const first=post(url);await started;assert.equal((await post(url)).status,429);release();assert.equal((await first).status,200);
});
test('direct model client limits total attempts and never retries a lost paid response',async()=>{
 let calls=0;const request=createModelClient({env:{MC_MAX_MODEL_CALLS:'1'},getKey:()=> 'fake',fetchImpl:async()=>{calls++;throw Error('network failure');}});
 await assert.rejects(request('/api/v1/chat/completions',body),/network/);
 await assert.rejects(request('/api/v1/chat/completions',body),/limit/);assert.equal(calls,1);
});
test('credentials are explicitly selected and private; relay refuses remote URLs',async t=>{
 assert.throws(()=>loadApiKey({OPENROUTER_API_KEY:'unrelated'}),/Configure/);
 const dir=await mkdtemp(tmpdir()+'/mc-credentials-');t.after(()=>rm(dir,{recursive:true}));
 const file=dir+'/key';await writeFile(file,'fake-key',{mode:0o600});assert.equal(privateFile(file),'fake-key');
 assert.equal(loadApiKey({MC_OPENROUTER_KEY_FILE:file}),'fake-key');
 const request=createModelClient({env:{MODEL_RELAY:'https://evil.example'},fetchImpl:()=>assert.fail('must not send token')});
 await assert.rejects(request('/api/v1/chat/completions',body),/loopback/);
});
test('recorder authenticates lifecycle, rejects replay and enforces chunk/run quotas',async t=>{
 const dir=await mkdtemp(tmpdir()+'/mc-recorder-');t.after(()=>rm(dir,{recursive:true}));let starts=0,ends=0;
 const handler=recordingHandler({dir,token,origin:'http://127.0.0.1:3077',maxChunk:4,maxTotal:6,onStart:()=>starts++,onDone:()=>ends++});
 const url=await listen(t,http.createServer(async(req,res)=>{if(!await handler(req,res)){res.writeHead(404);res.end();}}));
 const send=(path,data='',headers={})=>fetch(url+path,{method:'POST',headers:{Authorization:'Bearer '+token,...headers},body:data});
 assert.equal((await send('/recording/start?id=x','',{Authorization:''})).status,403);assert.equal(starts,0);
 assert.equal((await send('/recording?id=x','abc')).status,409);
 assert.equal((await send('/recording/start?id=x')).status,200);assert.equal(starts,0);
 assert.equal((await send('/recording/ready?id=x')).status,200);assert.equal(starts,1);
 assert.equal((await send('/recording?id=x','abcd')).status,200);
 assert.equal((await send('/recording?id=x','abc')).status,413);
 assert.equal((await send('/recording?id=x','abcde')).status,413);
 assert.equal((await readFile(dir+'/capture-x.webm','utf8')),'abcd');
 assert.equal((await send('/recording/done?id=x')).status,200);assert.equal(ends,1);
 assert.equal((await send('/recording/start?id=x')).status,409);
 assert.equal((await send('/recording/start?id=y')).status,200);assert.equal((await send('/recording/ready?id=y')).status,200);
 assert.equal((await send('/recording?id=y','abc')).status,413);
 assert.equal((await send('/recording/abort?id=y')).status,200);
 assert.equal((await send('/recording/start?id=z')).status,200);
});

test('malformed recording URL does not reject or mutate state',async()=>{let status;const handle=recordingHandler({dir:'/unused',token,origin:'http://127.0.0.1:3077',onStart:()=>assert.fail()});assert.equal(await handle({url:'//['},{writeHead:n=>status=n,end(){}}),true);assert.equal(status,400);});
test('authenticated client and relay preserve response shape without sharing provider key',async t=>{
 const dir=await mkdtemp(tmpdir()+'/mc-relay-client-');t.after(()=>rm(dir,{recursive:true}));await writeFile(dir+'/token',token,{mode:0o600});
 const url=await listen(t,createRelay({token,env:{},request:async()=>({data:{choices:[{message:{content:'ok'}}]},latencyMs:7})}));
 const request=createModelClient({env:{MODEL_RELAY:url,MC_LOCAL_TOKEN_FILE:dir+'/token'},getKey:()=>assert.fail('relay client must not load provider key')});
 assert.deepEqual(await request('/api/v1/chat/completions',body),{data:{choices:[{message:{content:'ok'}}]},latencyMs:7});
});
test('oversized chunked relay input never reaches paid request',async t=>{
 let calls=0;const url=await listen(t,createRelay({token,env:{},request:async()=>{calls++;return {};}}));
 const status=await new Promise((resolve,reject)=>{const req=http.request(url,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','Transfer-Encoding':'chunked'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',e=>e.code==='ECONNRESET'?resolve(413):reject(e));req.write('x'.repeat(1000000));req.end('x'.repeat(1000001));});
 assert.equal(status,413);assert.equal(calls,0);
});
