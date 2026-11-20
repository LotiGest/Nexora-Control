import test from 'node:test';
import assert from 'node:assert/strict';
import {createLicenseWorker} from '../src/index.js';
const verify=async()=>({uid:'qa-admin',email:'qa@example.test'});
const w=createLicenseWorker(verify);
const make=(url,method='GET',body,origin='https://lotigest.github.io')=>new Request('https://nexora-licencias.example'+url,{method,headers:{
 origin,...(body?{'content-type':'application/json'}:{}),authorization:'Bearer synthetic'},body:body===undefined?undefined:body});
const env={NEXORA_ADMIN_UIDS:'qa-admin'};
test('read-only proposal endpoint returns digest without changing SIAC or Firestore',async()=>{
 const body=JSON.stringify({ownerKey:'siac-clinic-default',tier:'full',expiresOn:'2026-12-31',requestId:'qa-license-request-001'});
 const response=await w.fetch(make('/api/licenses/preview','POST',body),env);
 assert.equal(response.status,200);const data=await response.json();
 assert.equal(data.status,'validated_not_applied');
 assert.equal(data.activationEnabled,false);
 assert.equal(data.revisionDigest.length,64);
 assert.equal(data.ownerKey,'siac-clinic-default');
 assert.equal(data.requestId,'qa-license-request-001');
 assert.deepEqual(await (await w.fetch(make('/api/licenses/preview','POST',body),env)).json(),data);
});
test('unauthorized or unconfigured workers never offer proposal previews',async()=>{
 assert.equal((await w.fetch(make('/api/licenses/preview','POST','{}'),{})).status,503);
 assert.equal((await w.fetch(make('/api/licenses/activate','POST','{}'),env)).status,503);
 assert.equal((await w.fetch(make('/api/licenses/preview','POST','{}','https://evil.example'),env)).status,403);
});
test('proposal validation rejects malformed, oversized and extra fields',async()=>{
 const good={ownerKey:'siac-clinic-default',tier:'basic',expiresOn:null,requestId:'qa-license-request-002'};
 for(const payload of [
  {...good,tier:'premium'},{...good,ownerKey:'SIAC'},{...good,expiresOn:'2026-02-30'},
  {...good,unexpected:true},{...good,requestId:'short'}
 ]){
  const res=await w.fetch(make('/api/licenses/preview','POST',JSON.stringify(payload)),env);
  assert.equal(res.status,400,JSON.stringify(payload));
 }
 const huge=await w.fetch(make('/api/licenses/preview','POST',JSON.stringify({...good,padding:'x'.repeat(5200)})),env);
 assert.equal(huge.status,400);
 const malformed=await w.fetch(make('/api/licenses/preview','POST','{bad-json'),env);
 assert.equal(malformed.status,400);
});
test('CORS, methods, and status disclose no private license data',async()=>{
 assert.equal((await w.fetch(make('/api/session','OPTIONS'),env)).status,204);
 const preflight=await w.fetch(make('/api/licenses/preview','OPTIONS'),env);
 assert.equal(preflight.status,204);
 assert.equal(preflight.headers.get('access-control-allow-methods'),'POST, OPTIONS');
 assert.equal((await w.fetch(make('/api/licenses/preview','GET'),env)).status,405);
 assert.equal((await w.fetch(make('/health','GET'),env)).status,200);
 assert.equal((await w.fetch(make('/api/licenses','GET'),env)).status,503);
});
