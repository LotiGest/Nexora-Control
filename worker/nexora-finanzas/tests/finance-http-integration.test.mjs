import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createFinanceWorker} from '../src/index.js';
import {AuthFailure} from '../../nexora-licencias/src/auth.js';

function qaDb(){
 const db=new DatabaseSync(':memory:');
 for(const name of ['0001_finance.sql','0002_finance_closures.sql'])db.exec(readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8'));
 db.exec('PRAGMA foreign_keys=ON');
 const execute=(sql,args)=>{const stmt=db.prepare(sql);if(/^\s*SELECT\b/i.test(sql))return {success:true,results:stmt.all(...args),meta:{changes:0}};return {success:true,results:[],meta:{changes:Number(stmt.run(...args).changes)}};};
 return {db,adapter:{prepare(sql){return {bind(...args){return {sql,args,async all(){return execute(sql,args)}}}}},async batch(items){db.exec('BEGIN');try{const result=items.map(({sql,args})=>execute(sql,args));db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}}};
}
const line={product:{stringValue:'LOTIGEST'},code:{stringValue:'base'},name:{stringValue:'Base'},kind:{stringValue:'plan'},catalogVersion:{integerValue:'1'},initialCents:{integerValue:'100001'},feeCents:{integerValue:'500'},cadence:{stringValue:'monthly'},cycles:{integerValue:'2'}};
const fields={contractId:{stringValue:'LOTIGEST__demo'},product:{stringValue:'LOTIGEST'},name:{stringValue:'Empresa ficticia'},initialDue:{stringValue:'2026-10-01'},firstDue:{stringValue:'2026-11-01'},lines:{arrayValue:{values:[{mapValue:{fields:line}}]}}};
const worker=createFinanceWorker({now:()=>new Date('2026-11-28T12:00:00Z'),verify:async token=>{if(!['Bearer a','Bearer b'].includes(token))throw new AuthFailure(403,'QA');return {uid:token.slice(7)};},fetcher:async()=>new Response(JSON.stringify({fields}),{status:200})});
test('flujo HTTP sobre SQLite: dos administradores, cierre concurrente, reparto y reintento',async()=>{
 const {db,adapter}=qaDb();try{
 const env={NEXORA_FINANCE_DB:adapter,NEXORA_ADMIN_UIDS:'a,b'};
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
