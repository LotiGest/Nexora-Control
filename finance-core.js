import {buildCalendar,isoDate} from './commercial-billing-core.js';
import {checkedCents,product} from './commercial-core.js';
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
export function csvReport(charges){const cell=v=>'"'+String(v??'').replaceAll('"','""')+'"';return '\uFEFF'+[['Empresa','Producto','Contrato','Cuota','Vence','Importe HNL','Abonado HNL','Saldo HNL'],...charges.map(c=>[c.company,c.product,c.contractId,c.id,c.due,(c.amountCents/100).toFixed(2),(c.paidCents/100).toFixed(2),(c.balanceCents/100).toFixed(2)])].map(row=>row.map(cell).join(',')).join('\r\n');}
