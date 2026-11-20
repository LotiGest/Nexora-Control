import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeClient,normalizeLicense,generateSiacLicenseSql,licenseReviewStatus,validDate,validOwner,reviewLicenseChange} from '../license-core.js';
test('client IDs are installation scoped and canonical',()=>{
 assert.deepEqual(normalizeClient({name:'  Centro   Médico San Marcos  ',ownerKey:'SIAC-CLINIC-DEFAULT'}),{name:'Centro Médico San Marcos',ownerKey:'siac-clinic-default',product:'SIAC'});
 assert.equal(validOwner('siac-clinic-default'),true);
 for(const key of ['', 'xx','abc def','abc;DROP TABLE','ABC','🧪'])assert.equal(validOwner(key),false);
});
test('license tiers and dates are strictly validated',()=>{
 const draft=normalizeLicense({ownerKey:'siac-clinic-default',tier:'full',expiresOn:'2026-12-31'});
 assert.equal(draft.tier,'full');assert.equal(draft.expiresOn,'2026-12-31');
 assert.equal(normalizeLicense({...draft,tier:'off',expiresOn:''}).expiresOn,null);
 assert.throws(()=>normalizeLicense({...draft,tier:'premium'}));
 assert.throws(()=>normalizeLicense({...draft,expiresOn:'2026-02-30'}));
 assert.equal(validDate('2028-02-29'),true);
 assert.equal(validDate('2026-02-29'),false);
});
test('SQL generation uses D1 audit and does not execute anything',()=>{
 const sql=generateSiacLicenseSql({ownerKey:'siac-clinic-default',tier:'basic',expiresOn:null});
 assert.match(sql,/siac_clinic_module_license_events/);
 assert.match(sql,/siac_clinic_module_licenses/);
 assert.match(sql,/"laboratory":"basic"/);
 assert.match(sql,/"expiresOn":null/);
 assert.match(sql,/BEGIN TRANSACTION/);
 assert.match(sql,/COMMIT;/);
 assert.throws(()=>generateSiacLicenseSql({ownerKey:"cli';delete--",tier:'full'}));
});
test('UI status never claims draft is already activated',()=>{
 assert.equal(licenseReviewStatus(null),'Sin propuesta');
 assert.match(licenseReviewStatus({status:'draft'}),/no aplicado/i);
 assert.match(licenseReviewStatus({status:'verified'}),/manualmente/i);
});

test('plan review explains changes and requires typed confirmation on risky actions',()=>{
 const old={ownerKey:'siac-clinic-default',tier:'basic',expiresOn:null,contractRef:'Contrato 1',status:'draft'};
 const full=reviewLicenseChange(old,{...old,tier:'full',expiresOn:'2027-01-20'},'Clínica de prueba');
 assert.equal(full.requiresTyping,true);
 assert.match(full.summary,/Básico/);
 assert.match(full.summary,/Full/);
 assert.match(full.summary,/2027-01-20/);
 assert.match(full.summary,/NO cambia la licencia operativa/);
 assert.equal(reviewLicenseChange(old,{...old,tier:'off'}).requiresTyping,true);
 assert.equal(reviewLicenseChange(old,{...old,expiresOn:'2026-12-31'}).requiresTyping,true);
 assert.equal(reviewLicenseChange(old,{...old}).requiresTyping,false);
 assert.equal(reviewLicenseChange({...old,status:'verified'},{...old}).requiresTyping,true);
});
