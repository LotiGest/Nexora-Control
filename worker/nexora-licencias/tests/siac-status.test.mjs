import test from 'node:test';
import assert from 'node:assert/strict';
import {getSiacLicenseStatus,statusConfig,SiacStatusError} from '../src/siac-status.js';
import {createLicenseWorker} from '../src/index.js';
const keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
const jwk=JSON.stringify(await crypto.subtle.exportKey('jwk',keys.privateKey));
const env={NEXORA_SIAC_OWNER:'siac-clinic-default',
 NEXORA_SIAC_PRIVATE_JWK:jwk,
 NEXORA_SIAC_KEY_ID:'nexora-qa',
 NEXORA_SIAC_EXPECTED_ENVIRONMENT:'qa',
 NEXORA_SIAC_STATUS_URL:'https://siac.example/api/internal/nexora-license'};
const validData={owner:'siac-clinic-default',license:{laboratory:'basic',
 contractedLaboratory:'basic',expired:false,expiresOn:null,source:'nexora'},
 readOnly:true,environment:'qa'};
const clock=Date.parse('2026-11-20T05:15:00Z');
const okResponse=data=>new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}});
test('SIAC status signs a fresh P-256 ECDSA request and cannot write',async()=>{
 let calls=0;
 const result=await getSiacLicenseStatus(env,async(url,options)=>{
  calls++;
  assert.equal(url,env.NEXORA_SIAC_STATUS_URL);
  assert.equal(options.method,'GET');
  assert.equal(options.redirect,'manual');
  assert.equal(options.body,undefined);
  const t=options.headers['x-nexora-timestamp'],n=options.headers['x-nexora-nonce'];
  assert.equal(options.headers['x-nexora-key-id'],env.NEXORA_SIAC_KEY_ID);
  const msg=new TextEncoder().encode(['siac-license-v1','GET','https://siac.example',
   '/api/internal/nexora-license',env.NEXORA_SIAC_KEY_ID,t,n].join('\n'));
  const sig=Uint8Array.from(options.headers['x-nexora-signature'].match(/../g).map(x=>parseInt(x,16)));
  assert.equal(sig.length,64);
  assert.equal(await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},keys.publicKey,sig,msg),true);
  return okResponse(validData);
 },clock);
 assert.equal(calls,1);
 assert.equal(result.license.laboratory,'basic');
 assert.equal(result.source,'siac_qa');
 assert.equal(result.verifiedAt,new Date(clock).toISOString());
 assert.equal(result.activationEnabled,false);
});
test('invalid signer keys, targets, owners and HTTP endpoints are rejected before fetch',async()=>{
 for(const changes of [
  {NEXORA_SIAC_OWNER:'other;DROP'},
  {NEXORA_SIAC_PRIVATE_JWK:'not-a-private-key'},
  {NEXORA_SIAC_KEY_ID:''},
  {NEXORA_SIAC_KEY_ID:'invalid!'},
  {NEXORA_SIAC_PRIVATE_JWK:JSON.stringify(await crypto.subtle.exportKey('jwk',keys.publicKey))},
  {NEXORA_SIAC_STATUS_URL:'http://siac.example/api/internal/nexora-license'},
  {NEXORA_SIAC_STATUS_URL:'https://localhost/api/internal/nexora-license'},
  {NEXORA_SIAC_STATUS_URL:'https://siac.example/api/internal/another'},
  {NEXORA_SIAC_STATUS_URL:'https://siac.example/api/internal/nexora-license?fake=1'}
 ])assert.throws(()=>statusConfig({...env,...changes}),SiacStatusError);
});
test('wrong SIAC owner, unexpected response or unauthorized status are denied',async()=>{
 for(const data of [{...validData,owner:'another-clinic'},
  {...validData,readOnly:false},{...validData,environment:'unexpected'},
  {...validData,environment:'production'},
  {...validData,license:{...validData.license,laboratory:'platinum'}}]){
  await assert.rejects(()=>getSiacLicenseStatus(env,async()=>okResponse(data),clock),
   e=>e instanceof SiacStatusError&&e.status===502);
 }
 await assert.rejects(()=>getSiacLicenseStatus(env,async()=>new Response('{}',{status:401}),clock),
  e=>e instanceof SiacStatusError&&e.status===502);
});
test('Nexora cannot query any clinic other than the server-selected owner',async()=>{
 let called=0;
 const w=createLicenseWorker(async()=>({uid:'qa-admin',email:'qa@example.test'}),async()=>{
  called++;return {ok:true,ownerKey:env.NEXORA_SIAC_OWNER,license:validData.license,source:'siac_live'};
 });
 const base='https://worker.example/api/licenses/status';
 const headers={origin:'https://lotigest.github.io'};
 assert.equal((await w.fetch(new Request(base,{headers}),{NEXORA_ADMIN_UIDS:'qa-admin',NEXORA_SIAC_OWNER:env.NEXORA_SIAC_OWNER})).status,403);
 assert.equal((await w.fetch(new Request(base+'?ownerKey=other-clinic',{headers}),{NEXORA_ADMIN_UIDS:'qa-admin',NEXORA_SIAC_OWNER:env.NEXORA_SIAC_OWNER})).status,403);
 assert.equal(called,0);
 assert.equal((await w.fetch(new Request(base+'?ownerKey=siac-clinic-default',{headers}),{NEXORA_ADMIN_UIDS:'qa-admin',NEXORA_SIAC_OWNER:env.NEXORA_SIAC_OWNER})).status,200);
 assert.equal(called,1);
});
test('untrusted clinical fields are never forwarded to commercial browser',async()=>{
 const data={...validData,patientDetails:'secret',
  license:{...validData.license,patientRecord:'PRIVATE',temporarySecret:'DO_NOT_FORWARD'}};
 const status=await getSiacLicenseStatus(env,async()=>okResponse(data),clock);
 assert.equal(status.patientDetails,undefined);
 assert.equal(status.license.patientRecord,undefined);
 assert.equal(status.license.temporarySecret,undefined);
 assert.deepEqual(Object.keys(status.license).sort(),
  ['contractedLaboratory','expired','expiresOn','laboratory','source'].sort());
});
test('QA responses never claim production license activation',async()=>{
 const status=await getSiacLicenseStatus(env,async()=>okResponse({...validData,environment:'qa'}),clock);
 assert.equal(status.source,'siac_qa');assert.equal(status.environment,'qa');
 assert.equal(status.activationEnabled,false);
 await assert.rejects(()=>getSiacLicenseStatus(env,
  async()=>okResponse({...validData,environment:undefined}),clock),
  e=>e instanceof SiacStatusError&&e.status===502);
});
test('redirections are never followed',async()=>{
 let called=0;
 await assert.rejects(()=>getSiacLicenseStatus(env,async()=>{
  called++;return new Response(null,{status:302,headers:{location:'https://evil.example'}});
 },clock),e=>e instanceof SiacStatusError&&e.status===502);
 assert.equal(called,1);
});
