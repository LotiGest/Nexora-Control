/**
 * External QA smoke checks. No auth tokens, secrets, or PHI.
 * Requests are purposely unauthenticated to ensure SIAC denies access.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
const root='https://siac-license-qa.nexorasystems.workers.dev';
async function get(path,method='GET'){
 const response=await fetch(root+path,{method,redirect:'manual',signal:AbortSignal.timeout(12000)});
 const raw=await response.text();
 assert.ok(raw.length<=2048,'Unexpected excessive public response');
 return {response,raw};
}
test('SIAC QA worker health answers without clinical data',async()=>{
 const {response,raw}=await get('/health');
 assert.equal(response.status,200,raw);
 assert.match(response.headers.get('cache-control')||'',/no-store/);
 const data=JSON.parse(raw);
 assert.equal(data.service,'siac-license-qa');
 assert.equal(data.readOnly,true);
 assert.equal(data.ready,true,'QA Worker cannot read its isolated D1');
 assert.equal(data.patient,undefined);
 assert.equal(data.license,undefined);
});
test('unsigned license status cannot expose information',async()=>{
 const {response,raw}=await get('/api/internal/nexora-license');
 const category=(()=>{try{return JSON.parse(raw).error}catch{return 'non_json'}})();
 console.log('Unsigned QA license result:',response.status,'sanitized_category:',category);
 assert.ok([401,503].includes(response.status),'Unprotected status route: '+response.status+' '+raw);
 assert.equal(raw.includes('patient'),false);
 assert.equal(raw.includes('laboratory'),false);
});
test('QA license writes are rejected, and unknown routes are absent',async()=>{
 const attempt=await get('/api/internal/nexora-license','POST');
 assert.equal(attempt.response.status,405,attempt.raw);
 const missing=await get('/nonexistent');
 assert.equal(missing.response.status,404,missing.raw);
});
