import {buildCalendar,isoDate} from './commercial-billing-core.js';
import {checkedCents,product} from './commercial-core.js';
import {summarizeYear,allocation} from './finance-profit.js';
export function normalizePayment(p){
 if(!p||typeof p!=='object'||typeof p.contractId!=='string'||!/^(SIAC|SINDEX|LOTIGEST)__[a-z0-9][a-z0-9-]{2,59}$/.test(p.contractId))throw Error('Contrato no válido.');
 if(typeof p.chargeId!=='string'||!/^[a-z0-9][a-z0-9-]{2,59}__(?:0|[1-9]\d{0,3})$/.test(p.chargeId))throw Error('Cuota no válida.');
 const amountCents=checkedCents(p.amountCents);if(!amountCents)throw Error('El abono debe ser mayor que cero.');
 const date=isoDate(p.date);const reference=String(p.reference??'').trim();if(!reference||reference.length>100)throw Error('Indicá una referencia de hasta 100 caracteres.');
 return {contractId:p.contractId,chargeId:p.chargeId,amountCents,date,reference};
}
export function reconcile(calendars,payments,from,to,asOf){
 isoDate(from);isoDate(to);isoDate(asOf);if(from>to)throw Error('Rango no válido.');
 const charges=[];const byKey=new Map();
 for(const [id,calendar] of calendars){const rows=buildCalendar(calendar,from,to);for(const row of rows){const key=id+'|'+row.id,charge={...row,contractId:id,product:product(calendar.product),company:calendar.name,paidCents:0};if(byKey.has(key))throw Error('Cuota duplicada.');byKey.set(key,charge);charges.push(charge);}}
 const receipts=[];for(const raw of payments){const p=normalizePayment(raw),key=p.contractId+'|'+p.chargeId,charge=byKey.get(key);if(!charge)continue;charge.paidCents+=p.amountCents;receipts.push(p);}
 let scheduledCents=0,paidCents=0,pendingCents=0,overdueCents=0;const byProduct={};
 for(const c of charges){c.balanceCents=Math.max(0,c.amountCents-c.paidCents);c.overdue=c.due<asOf&&c.balanceCents>0;scheduledCents+=c.amountCents;paidCents+=c.paidCents;pendingCents+=c.balanceCents;if(c.overdue)overdueCents+=c.balanceCents;byProduct[c.product]=(byProduct[c.product]||0)+c.paidCents;}
 return {charges,receipts,scheduledCents,paidCents,pendingCents,overdueCents,byProduct};
}
export function csvReport(charges){const cell=safeCsvCell;return '\uFEFF'+[['Empresa','Producto','Contrato','Cuota','Vence','Importe HNL','Abonado HNL','Saldo HNL'],...charges.map(c=>[c.company,c.product,c.contractId,c.id,c.due,(c.amountCents/100).toFixed(2),(c.paidCents/100).toFixed(2),(c.balanceCents/100).toFixed(2)])].map(row=>row.map(cell).join(',')).join('\r\n');}

/** Match immutable calendar obligations against confirmed D1 charge balances.
 * Payment dates may fall outside the due-date period, so the ledger's cumulative
 * paidCents is authoritative. Absence of a materialized charge means no payment.
 */
export function reconcileLedger(calendars,ledger,from,to,asOf){
 if(!Array.isArray(ledger))throw Error('Saldos financieros no verificados.');
 const report=reconcile(calendars,[],from,to,asOf);
 const expected=new Map(report.charges.map(c=>[c.contractId+'|'+c.id,c]));
 const seen=new Set();
 for(const row of ledger){
  const key=row.contractId+'|'+row.chargeId,c=expected.get(key);
  if(!c||seen.has(key)||row.due!==c.due||row.amountCents!==c.amountCents||row.product!==c.product)throw Error('El libro financiero no coincide con el calendario.');
  const paid=checkedCents(row.paidCents);
  if(paid>c.amountCents)throw Error('Abono superior a la obligación.');
  seen.add(key);c.paidCents=paid;
 }
 report.paidCents=0;report.pendingCents=0;report.overdueCents=0;report.byProduct={};
 for(const c of report.charges){
  c.balanceCents=c.amountCents-c.paidCents;c.overdue=c.due<asOf&&c.balanceCents>0;
  report.paidCents+=c.paidCents;report.pendingCents+=c.balanceCents;
  if(c.overdue)report.overdueCents+=c.balanceCents;
  report.byProduct[c.product]=(report.byProduct[c.product]||0)+c.paidCents;
 }
 return report;
}

export function collectableCharges(calendars,ledger,contractId,year,asOf){
 if(!/^20\d{2}$/.test(String(year)))throw Error('Año no válido.');
 return reconcileLedger(calendars,ledger,year+'-01-01',year+'-12-31',asOf).charges.filter(c=>c.contractId===contractId&&c.balanceCents>0);
}
export function safeCsvCell(value){
 let text=String(value??'');
 if(/^[\s\uFEFF]*[=+\-@]/.test(text)||/^[\t\r\n]/.test(text))text="'"+text;
 return '"'+text.replaceAll('"','""')+'"';
}

export function chargeStatus(c,confirmed){if(!confirmed)return 'Proyección';if(c.balanceCents===0)return 'Pagada';if(c.overdue)return c.paidCents?'Vencida · parcial':'Vencida';return c.paidCents?'Abono parcial':'Pendiente';}

// Validate complete financial snapshot BEFORE enabling any mutations or publishing balances.
export function validateFinanceSnapshot(calendars,report,closures,year,today){
 if(!/^20\d{2}$/.test(String(year))||!report||!Array.isArray(report.payments)||!Array.isArray(report.expenses)||!Array.isArray(closures))throw Error('Informe financiero incompleto.');
 const ledger=reconcileLedger(calendars,report.charges,year+'-01-01',year+'-12-31',today);
 const summary=summarizeYear(report.payments,report.expenses,year);
 if(report.revenueCents!==summary.revenueCents||report.expensesCents!==summary.expensesCents||report.profitCents!==summary.revenueCents-summary.expensesCents)throw Error('Totales financieros inconsistentes.');
 const months=new Map(summary.months.map(m=>[m.month,m])),seen=new Set();
 for(const c of closures){
  const m=months.get(c.month);if(!m||seen.has(c.month)||c.month>=today.slice(0,7)||m.revenueCents!==c.revenueCents||m.expensesCents!==c.expensesCents)throw Error('Cierre inconsistente con el libro financiero.');
  const a=allocation(c.revenueCents,c.expensesCents,c.savingsBp,c.partnerABp);
  if(Object.entries(a).some(([key,value])=>c[key]!==value))throw Error('Distribución de cierre inconsistente.');
  seen.add(c.month);
 }
 return {ledger,summary};
}
