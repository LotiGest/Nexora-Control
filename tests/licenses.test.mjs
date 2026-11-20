import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeClient,normalizeLicense,generateSiacLicenseSql,licenseReviewStatus,validDate,validOwner} from '../license-core.mjs';
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
