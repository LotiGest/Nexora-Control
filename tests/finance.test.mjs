import test from 'node:test';import assert from 'node:assert/strict';import {normalizePayment,reconcile,reconcileLedger,csvReport,collectableCharges,safeCsvCell,chargeStatus,validateFinanceSnapshot} from '../finance-core.js';
const line={product:'SIAC',code:'base',name:'Base',kind:'plan',catalogVersion:1,initialCents:10000,feeCents:5000,cadence:'monthly',cycles:2};
const calendar={product:'SIAC',name:'Clínica ficticia',initialDue:'2026-01-01',firstDue:'2026-02-01',lines:[line]};
test('abonos parciales, saldo vencido y tarifas congeladas',()=>{const p=normalizePayment({contractId:'SIAC__demo',chargeId:'base__0',amountCents:4000,date:'2026-01-02',reference:'Prueba'});const report=reconcile([['SIAC__demo',calendar]],[p],'2026-01-01','2026-03-31','2026-02-02');assert.equal(report.scheduledCents,20000);assert.equal(report.pendingCents,16000);assert.equal(report.overdueCents,11000);assert.equal(report.byProduct.SIAC,4000);assert.match(csvReport(report.charges),/Clínica ficticia/);});
test('rechaza abonos sin referencia o con fechas imposibles',()=>{assert.throws(()=>normalizePayment({contractId:'SIAC__demo',chargeId:'base__0',amountCents:100,date:'2026-02-30',reference:'x'}));assert.throws(()=>normalizePayment({contractId:'SIAC__demo',chargeId:'base__0',amountCents:0,date:'2026-01-01',reference:'x'}));});

test('identificador de cuota canónico: no admite ceros alternativos',()=>{const p={contractId:'SIAC__demo',chargeId:'base__0',amountCents:100,date:'2026-01-01',reference:'QA'};for(const chargeId of ['base__00','base__01','base__0001','base__0000'])assert.throws(()=>normalizePayment({...p,chargeId}));for(const chargeId of ['base__0','base__1','base__1200'])assert.equal(normalizePayment({...p,chargeId}).chargeId,chargeId);});

test('saldos confirmados usan abonos acumulados aunque el pago sea de otro período',()=>{const ledger=[{contractId:'SIAC__demo',chargeId:'base__0',product:'SIAC',due:'2026-01-01',amountCents:10000,paidCents:4000}];const r=reconcileLedger([['SIAC__demo',calendar]],ledger,'2026-01-01','2026-03-31','2026-02-02');assert.equal(r.paidCents,4000);assert.equal(r.pendingCents,16000);assert.equal(r.overdueCents,11000);assert.equal(r.byProduct.SIAC,4000);assert.equal(r.charges.length,3);});
test('libro incoherente no se presenta como saldo real',()=>{const row={contractId:'SIAC__demo',chargeId:'base__0',product:'SIAC',due:'2026-01-01',amountCents:10000,paidCents:4000};const run=ledger=>reconcileLedger([['SIAC__demo',calendar]],ledger,'2026-01-01','2026-03-31','2026-02-02');for(const ledger of [null,[row,row],[{...row,amountCents:10001}],[{...row,paidCents:10001}],[{...row,chargeId:'base__00'}]])assert.throws(()=>run(ledger));});

test('selector omite cuotas pagadas y mantiene las vencidas parciales',()=>{const row={contractId:'SIAC__demo',chargeId:'base__0',product:'SIAC',due:'2026-01-01',amountCents:10000,paidCents:10000},second={...row,chargeId:'base__1',due:'2026-02-01',amountCents:5000,paidCents:2000};const rows=collectableCharges([['SIAC__demo',calendar]],[row,second],'SIAC__demo','2026','2026-02-02');assert.deepEqual(rows.map(c=>c.id),['base__1','base__2']);assert.equal(rows[0].balanceCents,3000);assert.equal(rows[0].overdue,true);assert.throws(()=>collectableCharges([['SIAC__demo',calendar]],null,'SIAC__demo','2026','2026-02-02'));});
test('CSV neutraliza fórmulas de texto',()=>{assert.equal(safeCsvCell('=1+1'),'"\'=1+1"');assert.equal(safeCsvCell(' normal'),'" normal"');assert.equal(safeCsvCell('a"b'),'"a""b"');});

test('estados de cuota distinguen vencidas parciales, pagadas y proyecciones',()=>{assert.equal(chargeStatus({balanceCents:0,paidCents:100,overdue:false},true),'Pagada');assert.equal(chargeStatus({balanceCents:60,paidCents:40,overdue:true},true),'Vencida · parcial');assert.equal(chargeStatus({balanceCents:60,paidCents:40,overdue:false},true),'Abono parcial');assert.equal(chargeStatus({balanceCents:100,paidCents:0,overdue:true},false),'Proyección');});

test('financial snapshot rejects mismatched balances, cash totals and frozen allocations before enabling writes',()=>{
 const calendars=new Map([['SIAC__demo',calendar]]),year='2026',today='2026-03-01';
 const charges=[{contractId:'SIAC__demo',chargeId:'base__0',product:'SIAC',due:'2026-01-01',amountCents:10000,paidCents:4000}];
 const payments=[{id:'qa-payment',contractId:'SIAC__demo',date:'2026-01-02',amountCents:4000}],expenses=[{id:'qa-expense',category:'QA',date:'2026-01-03',amountCents:1000}];
 const report={charges,payments,expenses,revenueCents:4000,expensesCents:1000,profitCents:3000};
 const closed={month:'2026-01',revenueCents:4000,expensesCents:1000,profitCents:3000,savingsBp:2000,partnerABp:5000,savingsCents:600,distributableCents:2400,partnerACents:1200,partnerBCents:1200,lossCents:0};
 const run=(r=report,c=[closed])=>validateFinanceSnapshot(calendars,r,c,year,today);
 assert.equal(run().ledger.paidCents,4000);
 for(const r of [{...report,profitCents:1},{...report,charges:[{...charges[0],amountCents:99}]},{...report,payments:[...payments,...payments]}])assert.throws(()=>run(r));
 for(const c of [[closed,closed],[{...closed,partnerACents:1199}],[{...closed,revenueCents:0}],[{...closed,month:'2026-03'}]])assert.throws(()=>run(report,c));
});
