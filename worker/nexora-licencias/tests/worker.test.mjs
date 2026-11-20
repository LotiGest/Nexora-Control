import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
const call=(path,method='GET',headers={})=>worker.fetch(new Request('https://nexora-licencias.example'+path,{method,headers}),{});
test('public health reveals no customer data or credentials',async()=>{
 const response=await call('/health');assert.equal(response.status,200);
 const json=await response.json();assert.equal(json.activationEnabled,false);
 assert.equal(json.authenticatedSessionEnabled,false);assert.equal(response.headers.get('cache-control').includes('no-store'),true);
});
test('everything in /api is safely disabled before allowlist provisioning',async()=>{
 for(const [path,method] of [['/api/session','GET'],['/api/licenses/activate','POST'],['/api/licenses','GET'],['/api/licenses/revoke','DELETE']]){
  const response=await call(path,method);assert.equal(response.status,503,path);
 }
});
test('only Nexora Pages origin can preflight its read-only session endpoint',async()=>{
 const good=await call('/api/session','OPTIONS',{origin:'https://lotigest.github.io'});
 assert.equal(good.status,204);assert.equal(good.headers.get('access-control-allow-methods'),'GET, OPTIONS');
 const bad=await call('/api/session','OPTIONS',{origin:'https://evil.example'});
 assert.equal(bad.status,403);assert.equal(bad.headers.get('access-control-allow-origin'),null);
 const post=await call('/api/licenses','POST',{origin:'https://evil.example'});
 assert.equal(post.status,403);
});
test('unauthorized routes fail and never expose cookies',async()=>{
 assert.equal((await call('/')).status,404);
 assert.equal((await call('/health','POST')).status,405);
 assert.equal((await call('/api/session','GET',{'authorization':'Bearer fake'})).status,503);
});
