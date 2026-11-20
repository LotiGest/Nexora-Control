import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,createHmac} from 'node:crypto';
import {getSiacLicenseStatus,statusConfig,SiacStatusError} from '../src/siac-status.js';
import {createLicenseWorker} from '../src/index.js';
const shared=randomBytes(32),key=shared.toString('base64url');
const env={NEXORA_SIAC_OWNER:'siac-clinic-default',
 NEXORA_SIAC_SHARED_KEY:key,
 NEXORA_SIAC_STATUS_URL:'https://siac.example/api/internal/nexora-license'};
const validData={owner:'siac-clinic-default',license:{laboratory:'basic',
 contractedLaboratory:'basic',expired:false,expiresOn:null,source:'nexora'},
 readAt:'2026-11-20T05:00:00Z',readOnly:true,environment:'production'};
const clock=Date.parse('2026-11-20T05:15:00Z');
test('SIAC status uses a fresh HMAC signature and cannot write',async()=>{
 let calls=0;
 const result=await getSiacLicenseStatus(env,async(url,options)=>{
  calls++;
  assert.equal(url,env.NEXORA_SIAC_STATUS_URL);
  assert.equal(options.method,'GET');
  assert.equal(options.redirect,'error');
  assert.equal(options.body,undefined);
  const t=options.headers['x-nexora-timestamp'],n=options.headers['x-nexora-nonce'];
  const expect=createHmac('sha256',shared).update('GET\n/api/internal/nexora-license\n'+t+'\n'+n).digest('hex');
  assert.equal(options.headers['x-nexora-signature'],expect);
  return new Response(JSON.stringify(validData),{status:200,headers:{'content-type':'application/json'}});
 },clock);
 assert.equal(calls,1);
 assert.equal(result.license.laboratory,'basic');
 assert.equal(result.source,'siac_live');
 assert.equal(result.activationEnabled,false);
});
test('invalid configuration and untrusted host never make an outbound request',async()=>{
 for(const changes of [
  {NEXORA_SIAC_OWNER:'other;DROP'},
  {NEXORA_SIAC_SHARED_KEY:'not-a-key'},
  {NEXORA_SIAC_STATUS_URL:'http://siac.example/api/internal/nexora-license'},
  {NEXORA_SIAC_STATUS_URL:'https://localhost/api/internal/nexora-license'},
  {NEXORA_SIAC_STATUS_URL:'https://siac.example/api/internal/another'},
  {NEXORA_SIAC_STATUS_URL:'https://siac.example/api/internal/nexora-license?fake=1'}
 ]){
  assert.throws(()=>statusConfig({...env,...changes}),SiacStatusError);
 }
});
test('wrong SIAC tenant, unauthenticated responses or invalid content are rejected',async()=>{
 for(const data of [{...validData,owner:'another-clinic'},
  {...validData,readOnly:false},{...validData,license:{...validData.license,laboratory:'platinum'}}]){
  await assert.rejects(()=>getSiacLicenseStatus(env,
   async()=>new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}}),clock),
   e=>e instanceof SiacStatusError&&e.status===502);
 }
 await assert.rejects(()=>getSiacLicenseStatus(env,async()=>new Response('{}',{status:401}),clock),
  e=>e instanceof SiacStatusError&&e.status===502);
});
test('Nexora Worker cannot query a clinic other than the one configured on server',async()=>{
 let called=0;
 const w=createLicenseWorker(async()=>({uid:'qa-admin',email:'qa@example.test'}),async()=>{
  called++;return {ok:true,ownerKey:env.NEXORA_SIAC_OWNER,license:validData.license,source:'siac_live'};
 });
 const noOwner=await w.fetch(new Request('https://worker.example/api/licenses/status',{headers:{origin:'https://lotigest.github.io'}}),{NEXORA_ADMIN_UIDS:'qa-admin',NEXORA_SIAC_OWNER:env.NEXORA_SIAC_OWNER});
 assert.equal(noOwner.status,403);
 const other=await w.fetch(new Request('https://worker.example/api/licenses/status?ownerKey=other-clinic',{headers:{origin:'https://lotigest.github.io'}}),{NEXORA_ADMIN_UIDS:'qa-admin',NEXORA_SIAC_OWNER:env.NEXORA_SIAC_OWNER});
 assert.equal(other.status,403);
 assert.equal(called,0);
 const yes=await w.fetch(new Request('https://worker.example/api/licenses/status?ownerKey=siac-clinic-default',{headers:{origin:'https://lotigest.github.io'}}),{NEXORA_ADMIN_UIDS:'qa-admin',NEXORA_SIAC_OWNER:env.NEXORA_SIAC_OWNER});
 assert.equal(yes.status,200);
 assert.equal(called,1);
});

test('license status never forwards unsolicited SIAC fields to the commercial browser',async()=>{
 const response={...validData,patientDetails:'secret',
  license:{...validData.license,patientRecord:'PRIVATE',temporarySecret:'DO_NOT_FORWARD'}};
 const status=await getSiacLicenseStatus(env,async()=>new Response(JSON.stringify(response),
  {status:200,headers:{'content-type':'application/json'}}),clock);
 assert.equal(status.patientDetails,undefined);
 assert.equal(status.license.patientRecord,undefined);
 assert.equal(status.license.temporarySecret,undefined);
 assert.deepEqual(Object.keys(status.license).sort(),
  ['contractedLaboratory','expired','expiresOn','laboratory','source'].sort());
});

test('QA status may never be classified as a real active SIAC license',async()=>{
 const status=await getSiacLicenseStatus(env,async()=>new Response(
  JSON.stringify({...validData,environment:'qa'}),
  {status:200,headers:{'content-type':'application/json'}}),clock);
 assert.equal(status.source,'siac_qa');
 assert.equal(status.environment,'qa');
 assert.equal(status.activationEnabled,false);
 const missing=JSON.stringify({...validData,environment:undefined});
 await assert.rejects(()=>getSiacLicenseStatus(env,
  async()=>new Response(missing,{status:200,headers:{'content-type':'application/json'}}),clock),
  err=>err instanceof SiacStatusError&&err.status===502);
});
