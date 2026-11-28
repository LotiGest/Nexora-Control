import {after,before,test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,writeBatch,serverTimestamp,deleteDoc} from 'firebase/firestore';
import {normalizeCompany} from '../../commercial-company-core.js';
let env;
const key='emp-12345678-1234-4abc-8def-123456789abc',id='LOTIGEST__'+key;
const p=normalizeCompany({product:'LOTIGEST',clientKey:key,name:'Empresa ficticia QA',adminUsername:'admin-qa'});
const rev=(n)=>'12345678-1234-4abc-8def-'+String(n).padStart(12,'0');
const admin=(uid='qa-admin-a')=>env.authenticatedContext(uid).firestore();
function data(n,uid='qa-admin-a',extra={}){return {...p,version:n,revisionKey:rev(n),updatedBy:uid,updatedAt:serverTimestamp(),...extra};}
function save(db,value){const ref=doc(db,'nexoraCompanyProfiles',id),b=writeBatch(db);b.set(ref,value);b.set(doc(ref,'revisions',value.revisionKey),value);return b.commit();}
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-nexora-control',firestore:{rules:readFileSync('.firebase-qa/firestore.rules','utf8'),host:'127.0.0.1',port:8080}});await env.clearFirestore();});
after(async()=>{await env?.cleanup();});
test('company creation, authorization, atomic revisions and conflicting edits',async()=>{
 const db=admin(),ref=doc(db,'nexoraCompanyProfiles',id);
 await assertFails(setDoc(ref,data(1)));
 await assertFails(save(admin('qa-outsider'),data(1,'qa-outsider')));
 await assertFails(save(db,data(1,'qa-admin-a',{adminUsername:'admin.qa'})));
 await assertFails(save(db,data(1,'qa-admin-a',{password:'never-store'})));
 await assertSucceeds(save(db,data(1)));
 await assertSucceeds(getDoc(ref));
 await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),'nexoraCompanyProfiles',id)));
 await assertFails(getDoc(doc(admin('qa-outsider'),'nexoraCompanyProfiles',id)));
 await assertSucceeds(save(admin('qa-admin-b'),data(2,'qa-admin-b',{name:'Empresa QA actualizada'})));
 await assertFails(save(db,data(2)));
 await assertFails(deleteDoc(ref));
 await assertFails(deleteDoc(doc(ref,'revisions',rev(1))));
 assert.equal((await getDoc(ref)).data().version,2);
});

test('existing installation reserves D1 atomically without permitting activation',async()=>{
 const db=admin();
 const dbId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 const row={contractId:id,product:'LOTIGEST',clientKey:key,accountId:'a'.repeat(32),databaseId:dbId,url:'https://qa.example.invalid',alias:'https://alias.example.invalid',state:'pending-verification',source:'existing',createdBy:'qa-admin-a',createdAt:serverTimestamp()};
 const head=doc(db,'nexoraExistingInstallationRequests',id),claim=doc(db,'nexoraInstallationD1Claims',dbId);
 const reserve=(r)=>{const b=writeBatch(db);b.set(head,r);b.set(claim,{contractId:id,databaseId:dbId,createdBy:'qa-admin-a',createdAt:serverTimestamp()});return b.commit();};
 await assertFails(setDoc(head,row));
 await assertFails(setDoc(claim,{contractId:id,databaseId:dbId,createdBy:'qa-admin-a',createdAt:serverTimestamp()}));
 await assertFails(reserve({...row,state:'active'}));
 await assertSucceeds(reserve(row));
 await assertFails(setDoc(head,{...row,state:'active'}));
 await assertFails(deleteDoc(claim));
 await assertFails(getDoc(doc(admin('qa-outsider'),'nexoraExistingInstallationRequests',id)));
 const otherKey='empresa-otra',otherId='LOTIGEST__'+otherKey,otherProfile=doc(db,'nexoraCompanyProfiles',otherId);
 const otherData={...data(1),clientKey:otherKey};const pb=writeBatch(db);pb.set(otherProfile,otherData);pb.set(doc(otherProfile,'revisions',otherData.revisionKey),otherData);await assertSucceeds(pb.commit());
 const duplicate=writeBatch(db);duplicate.set(doc(db,'nexoraExistingInstallationRequests',otherId),{...row,contractId:otherId,clientKey:otherKey});duplicate.set(claim,{contractId:otherId,databaseId:dbId,createdBy:'qa-admin-a',createdAt:serverTimestamp()});await assertFails(duplicate.commit());
});

test('renewal proposals require authorized versioned writes, preserve calendar and cannot activate services',async()=>{
 const k='renewal-qa',cid='LOTIGEST__'+k,db=admin(),head=doc(db,'nexoraCommercialContracts',cid),cal=doc(db,'nexoraBillingCalendars',cid);
 const line={product:'LOTIGEST',code:'base',name:'Base',kind:'plan',catalogVersion:1,initialCents:1000,feeCents:500,cadence:'monthly',cycles:0};
 const contract={product:'LOTIGEST',clientKey:k,name:'Empresa QA renovación',reference:'QA',status:'agreed',lines:[line],version:1,revisionKey:rev(101),updatedBy:'qa-admin-a',updatedAt:serverTimestamp()};
 const b=writeBatch(db);b.set(head,contract);b.set(doc(head,'revisions',contract.revisionKey),contract);await assertSucceeds(b.commit());
 const calendar={contractId:cid,product:'LOTIGEST',clientKey:k,name:contract.name,reference:'QA',contractVersion:1,initialDue:'2026-01-01',firstDue:'2026-02-01',lines:[line],createdBy:'qa-admin-a',createdAt:serverTimestamp()};
 await assertSucceeds(setDoc(cal,calendar));
 const effectiveOn=new Date(Math.max(Date.now()+30*86400000,Date.parse('2027-01-01'))).toISOString().slice(0,10);
 const proposal={contractId:cid,product:'LOTIGEST',clientKey:k,contractVersion:1,calendarVersion:1,effectiveOn,effectiveAt:new Date(effectiveOn+'T00:00:00Z'),reason:'QA renovación',lines:[line],state:'pending-review',version:1,revisionKey:rev(102),updatedBy:'qa-admin-a',updatedAt:serverTimestamp()};
 const save=(db,row)=>{const h=doc(db,'nexoraCommercialRenewals',cid),batch=writeBatch(db);batch.set(h,row);batch.set(doc(h,'revisions',row.revisionKey),row);return batch.commit();};
 const h=doc(db,'nexoraCommercialRenewals',cid);
 await assertFails(setDoc(h,proposal));
 await assertFails(save(admin('qa-outsider'),{...proposal,updatedBy:'qa-outsider'}));
 await assertFails(save(db,{...proposal,lines:[{...line,feeCents:1}]}));
 await assertFails(save(db,{...proposal,contractVersion:2}));
 await assertFails(save(db,{...proposal,effectiveOn:'2020-01-01',effectiveAt:new Date('2020-01-01T00:00:00Z')}));
 await assertSucceeds(save(db,proposal));
 await assertFails(save(db,{...proposal,version:2,revisionKey:rev(103),state:'active'}));
 await assertFails(save(db,{...proposal,version:2,revisionKey:rev(103),reason:'overwrite'}));
 await assertFails(deleteDoc(h));
 await assertFails(deleteDoc(doc(h,'revisions',rev(102))));
 await assertFails(getDoc(doc(admin('qa-outsider'),'nexoraCommercialRenewals',cid)));
 const withdrawn={...proposal,state:'withdrawn',version:2,revisionKey:rev(103),updatedBy:'qa-admin-b',updatedAt:serverTimestamp()};
 await assertSucceeds(save(admin('qa-admin-b'),withdrawn));
 await assertSucceeds(save(db,{...proposal,version:3,revisionKey:rev(104),updatedAt:serverTimestamp()}));
 assert.equal((await getDoc(h)).data().version,3);
 assert.deepEqual((await getDoc(cal)).data().lines,[line]);
});
