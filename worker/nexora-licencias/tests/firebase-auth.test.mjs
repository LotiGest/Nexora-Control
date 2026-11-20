import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createSign} from 'node:crypto';
import {verifyFirebaseAdmin,AuthFailure} from '../src/auth.js';
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const kid='test-firebase-key';
const jwk={...publicKey.export({format:'jwk'}),kid,kty:'RSA',alg:'RS256',use:'sig'};
const fakeFetch=async url=>{
 assert.match(url,/googleapis.com\/service_accounts/);
 return new Response(JSON.stringify({keys:[jwk]}),{status:200,headers:{'cache-control':'public, max-age=300'}});
};
const base64=data=>Buffer.from(typeof data==='string'?data:JSON.stringify(data)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const claims={
 aud:'nexora-control-717c6',iss:'https://securetoken.google.com/nexora-control-717c6',
 sub:'qa-uid-123',email:'gerardotorres034@gmail.com',email_verified:true,
 exp:now+1800,iat:now-20,auth_time:now-90,
 firebase:{sign_in_provider:'google.com'}
};
function sign(payload=claims,header={alg:'RS256',kid,typ:'JWT'}){
 const unsigned=base64(header)+'.'+base64(payload);
 return unsigned+'.'+createSign('RSA-SHA256').update(unsigned).sign(privateKey).toString('base64url');
}
const opts={fetchKeys:fakeFetch,now:now*1000};
const active={NEXORA_ADMIN_UIDS:'qa-uid-123'};
test('Firebase-signed verified Google admin token passes exact project and UID checks',async()=>{
 const session=await verifyFirebaseAdmin('Bearer '+sign(),active,opts);
 assert.deepEqual(session,{uid:'qa-uid-123',email:'gerardotorres034@gmail.com',project:'nexora-control-717c6'});
});
test('missing UID configuration fails closed even with a valid signed token',async()=>{
 await assert.rejects(()=>verifyFirebaseAdmin('Bearer '+sign(),{},opts),err=>err instanceof AuthFailure&&err.status===503);
});
test('valid Google identity with unapproved UID or email is denied',async()=>{
 await assert.rejects(()=>verifyFirebaseAdmin('Bearer '+sign(),{NEXORA_ADMIN_UIDS:'someone-else'},opts),e=>e.status===403);
 await assert.rejects(()=>verifyFirebaseAdmin('Bearer '+sign({...claims,email:'attacker@gmail.com'}),active,opts),e=>e.status===403);
});
test('JWT tampering, wrong Firebase audience and expired sessions are rejected',async()=>{
 const token=sign(),parts=token.split('.');
 await assert.rejects(()=>verifyFirebaseAdmin('Bearer '+parts[0]+'.'+base64({...claims,email:'danylopez614@gmail.com'})+'.'+parts[2],active,opts),e=>e.status===401);
 for(const invalid of [
  {...claims,aud:'other-firebase-project'},
  {...claims,iss:'https://attacker.example'},
  {...claims,exp:now-1},
  {...claims,iat:now+200},
  {...claims,auth_time:now+200},
  {...claims,email_verified:false},
  {...claims,firebase:{sign_in_provider:'password'}}
 ])await assert.rejects(()=>verifyFirebaseAdmin('Bearer '+sign(invalid),active,opts),e=>e.status===401);
});
test('none, HS256, missing token and malformed JWT cannot authorize',async()=>{
 for(const h of [{alg:'none',kid},{alg:'HS256',kid}])
  await assert.rejects(()=>verifyFirebaseAdmin('Bearer '+sign(claims,h),active,opts),e=>e.status===401);
 for(const token of ['','Bearer broken','Basic abcd'])
  await assert.rejects(()=>verifyFirebaseAdmin(token,active,opts),e=>e.status===401);
});
