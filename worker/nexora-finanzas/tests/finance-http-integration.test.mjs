import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createFinanceWorker} from '../src/index.js';
import {AuthFailure} from '../../nexora-licencias/src/auth.js';
import {normalizeCompany} from '../../../commercial-company-core.js';
import {normalizeContract} from '../../../commercial-core.js';
import {trialDates,defaultBillingDates} from '../../../commercial-trials-core.js';
import {snapshotCalendar} from '../../../commercial-billing-core.js';
import {reconcileLedger} from '../../../finance-core.js';
import {buildReceiptPdf} from '../../../finance-receipt.js';
import {licenseChange} from '../../../commercial-entitlement-core.js';
import {createRenewal,renewalPreview} from '../../../commercial-renewal-core.js';
import {evaluateAcceptance} from '../../../release-readiness.js';

function qaDb(){
 const db=new DatabaseSync(':memory:');
 for(const name of ['0001_finance.sql','0002_finance_closures.sql'])db.exec(readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8'));
 db.exec('PRAGMA foreign_keys=ON');
 const execute=(sql,args)=>{const stmt=db.prepare(sql);if(/^\s*SELECT\b/i.test(sql))return {success:true,results:stmt.all(...args),meta:{changes:0}};return {success:true,results:[],meta:{changes:Number(stmt.run(...args).changes)}};};
 return {db,adapter:{prepare(sql){return {bind(...args){return {sql,args,async all(){return execute(sql,args)}}}}},async batch(items){db.exec('BEGIN');try{const result=items.map(({sql,args})=>execute(sql,args));db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}}};
}
const line={product:{stringValue:'LOTIGEST'},code:{stringValue:'base'},name:{stringValue:'Base'},kind:{stringValue:'plan'},catalogVersion:{integerValue:'1'},initialCents:{integerValue:'100001'},feeCents:{integerValue:'500'},cadence:{stringValue:'monthly'},cycles:{integerValue:'2'}};
const fields={contractId:{stringValue:'LOTIGEST__demo'},product:{stringValue:'LOTIGEST'},name:{stringValue:'Empresa ficticia'},initialDue:{stringValue:'2026-10-01'},firstDue:{stringValue:'2026-11-01'},lines:{arrayValue:{values:[{mapValue:{fields:line}}]}}};
const worker=createFinanceWorker({now:()=>new Date('2026-11-28T12:00:00Z'),verify:async token=>{if(!['Bearer a','Bearer b'].includes(token))throw new AuthFailure(403,'QA');return {uid:token.slice(7),project:'nexora-control-qa-test'};},fetcher:async()=>new Response(JSON.stringify({fields}),{status:200})});
test('flujo HTTP sobre SQLite: dos administradores, cierre concurrente, reparto y reintento',async()=>{
 const {db,adapter}=qaDb();try{
 const env={NEXORA_FINANCE_DB:adapter,NEXORA_ENVIRONMENT:'qa',NEXORA_FIREBASE_PROJECT_ID:'nexora-control-qa-test',NEXORA_ADMIN_UIDS:'a,b'};
 const call=(path,body,actor='a')=>worker.fetch(new Request('https://qa.example.test/api/finance/'+path,{method:body?'POST':'GET',headers:{origin:'https://lotigest.github.io',authorization:'Bearer '+actor,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined}),env);
 const p={operationId:crypto.randomUUID(),contractId:'LOTIGEST__demo',chargeId:'base__0',amountCents:100001,date:'2026-10-03',reference:'Ficticio'};
 const e={operationId:crypto.randomUUID(),category:'QA',amountCents:20000,date:'2026-10-05',reference:'Ficticio'};
 assert.equal((await call('payment',p,'other')).status,403);
 assert.equal((await call('payment',{...p,date:'2026-11-29'})).status,400);
 assert.equal((await call('expense',{...e,date:'2026-11-29'})).status,400);
 assert.equal((await call('expense',{...e,reference:'x'.repeat(5000)})).status,400);
 assert.equal((await call('payment',p)).status,201);
 assert.equal((await call('expense',e,'b')).status,201);
 const report=await (await call('report?from=2026-01-01&to=2026-12-31')).json();
 assert.equal(report.revenueCents,100001);assert.equal(report.expensesCents,20000);assert.equal(report.profitCents,80001);assert.equal(report.charges[0].paidCents,100001);
 const close={month:'2026-10',savingsBp:2000,partnerABp:5000,expectedRevenueCents:100001,expectedExpensesCents:20000};
 assert.equal((await call('close',{...close,expectedExpensesCents:0})).status,409);
 const res=await call('close',close,'b');assert.equal(res.status,201);const closed=await res.json();assert.equal(closed.closedBy,'b');assert.equal(closed.savingsCents,16000);assert.equal(closed.partnerACents,32000);assert.equal(closed.partnerBCents,32001);
 assert.equal((await call('close',close)).status,200);assert.equal((await call('close',{...close,savingsBp:0})).status,409);
 assert.equal((await call('expense',{...e,operationId:crypto.randomUUID()},'b')).status,400);
 assert.equal((await call('expense',e,'b')).status,200);
 assert.equal((await call('payment',p)).status,200);
 assert.equal((await call('payment',p,'b')).status,409);
 const list=await (await call('closures?year=2026')).json();assert.equal(list.closures.length,1);assert.equal(list.closures[0].profitCents,80001);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM payments').get().n,1);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM expenses').get().n,1);
 }finally{db.close();}
});

test('rechaza cobro de obligación materializada con condiciones distintas',async()=>{
 const {db,adapter}=qaDb();try{
 db.exec("INSERT INTO charges(contract_id,charge_id,product,company,due_date,kind,amount_cents) VALUES('LOTIGEST__demo','base__0','LOTIGEST','QA','2026-10-01','initial',200000)");
 const env={NEXORA_FINANCE_DB:adapter,NEXORA_ENVIRONMENT:'qa',NEXORA_FIREBASE_PROJECT_ID:'nexora-control-qa-test',NEXORA_ADMIN_UIDS:'a,b'};
 const p={operationId:crypto.randomUUID(),contractId:'LOTIGEST__demo',chargeId:'base__0',amountCents:100,date:'2026-10-03',reference:'QA'};
 const r=await worker.fetch(new Request('https://qa.example.test/api/finance/payment',{method:'POST',headers:{authorization:'Bearer a','content-type':'application/json'},body:JSON.stringify(p)}),env);
 assert.equal(r.status,409);assert.equal((await r.json()).error,'charge_conflict');assert.equal(db.prepare('SELECT count(*) n FROM payments').get().n,0);assert.equal(db.prepare('SELECT paid_cents FROM charges').get().paid_cents,0);
 }finally{db.close();}
});

test('integración local de venta ficticia, prueba, abonos, recibo, cierre y renovación; no autoriza producción',async()=>{
 const {db,adapter}=qaDb();try{
 const company=normalizeCompany({product:'LOTIGEST',clientKey:'qa-integration',name:'Empresa ficticia integración',ownerName:'QA',address:'QA',companyPhone:'99999999',adminName:'QA',adminUsername:'admin-qa'});
 const line={product:company.product,code:'base',name:'Base',kind:'plan',catalogVersion:1,initialCents:100000,feeCents:50000,cadence:'monthly',cycles:0};
 const contract={...normalizeContract({product:company.product,clientKey:company.clientKey,name:company.name,reference:'QA-001',status:'agreed',lines:[line]}),version:1};
 const trial=trialDates('2026-09-01',30),dates=defaultBillingDates('2026-10-01',trial),calendar=snapshotCalendar(contract,dates),id=calendar.contractId;
 const encode=v=>typeof v==='string'?{stringValue:v}:typeof v==='number'?{integerValue:String(v)}:Array.isArray(v)?{arrayValue:{values:v.map(encode)}}:{mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,encode(x)]))}};
 const local=createFinanceWorker({now:()=>new Date('2026-11-28T12:00:00Z'),verify:async()=>({uid:'qa-admin-a',project:'nexora-control-qa-test'}),fetcher:async url=>{assert.ok(url.includes('/projects/nexora-control-qa-test/'));return Response.json(encode(calendar).mapValue);}});
 const env={NEXORA_FINANCE_DB:adapter,NEXORA_ENVIRONMENT:'qa',NEXORA_FIREBASE_PROJECT_ID:'nexora-control-qa-test',NEXORA_ADMIN_UIDS:'qa-admin-a'};
 const call=(path,body)=>local.fetch(new Request('https://qa.example.test/api/finance/'+path,{method:body?'POST':'GET',headers:{authorization:'Bearer qa','content-type':'application/json'},body:body?JSON.stringify(body):undefined}),env);
 const payment={operationId:crypto.randomUUID(),contractId:id,chargeId:'base__0',amountCents:60000,date:'2026-10-01',reference:'QA abono'};
 const first=await call('payment',payment);assert.equal(first.status,201);const receipt=await first.json();assert.ok(buildReceiptPdf(receipt).length>500);assert.equal((await call('payment',payment)).status,200);
 assert.equal((await call('payment',{...payment,operationId:crypto.randomUUID(),amountCents:40000})).status,201);
 assert.equal((await call('expense',{operationId:crypto.randomUUID(),category:'QA',amountCents:20000,date:'2026-10-05',reference:'QA gasto'})).status,201);
 const report=await (await call('report?from=2026-01-01&to=2026-12-31')).json(),ledger=reconcileLedger(new Map([[id,calendar]]),report.charges,'2026-01-01','2026-12-31','2026-11-28');
 assert.equal(ledger.charges.find(c=>c.id==='base__0').balanceCents,0);assert.equal(report.revenueCents,100000);
 const close=await call('close',{month:'2026-10',expectedRevenueCents:100000,expectedExpensesCents:20000,savingsBp:2000,partnerABp:5000});assert.equal(close.status,201);assert.equal((await close.json()).partnerACents,32000);
 const license=licenseChange({contract,calendar,action:'issue',input:{startsOn:'2026-11-28',expiresOn:'2026-12-28',graceDays:7,reason:'QA'},today:'2026-11-28'});assert.equal(license.contractId,id);
 const proposal=createRenewal(contract,calendar,{effectiveOn:'2026-12-29',reason:'QA renovación'},'2026-11-28');assert.equal(renewalPreview(contract,calendar,proposal,'2026-11-28').mode,'projection-only');
 assert.equal(evaluateAcceptance({candidateSha:'a'.repeat(40),evidence:[{id:'finance',candidateSha:'a'.repeat(40),environment:'qa',scope:'simulation',result:'pass'}]}).state,'blocked');
 }finally{db.close();}
});
