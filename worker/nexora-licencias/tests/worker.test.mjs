import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
const call=(path,method='GET')=>worker.fetch(new Request('https://nexora-licencias.example'+path,{method}));
test('health is read-only and discloses no customer information',async()=>{
 const res=await call('/health');
 assert.equal(res.status,200);
 const data=await res.json();
 assert.equal(data.service,'nexora-licencias');
 assert.equal(data.activationEnabled,false);
 assert.equal(res.headers.get('cache-control'),'no-store, max-age=0');
 assert.equal(res.headers.get('access-control-allow-origin'),null);
});
test('an unconfigured worker rejects every license mutation and query',async()=>{
 for(const [path,method] of [['/api/licenses','GET'],['/api/licenses/activate','POST'],['/api/v1/license','PUT'],['/api/licenses/revoke','DELETE']]){
  const res=await call(path,method);
  assert.equal(res.status,503,path);
  assert.equal((await res.json()).error,'activation_not_configured');
 }
});
test('unrecognized routes never serve data',async()=>{
 assert.equal((await call('/')).status,404);
 assert.equal((await call('/health','POST')).status,405);
 assert.equal((await call('/api/licenses','OPTIONS')).status,503);
});
