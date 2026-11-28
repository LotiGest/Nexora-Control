import {isoDate} from './commercial-billing-core.js';
import {product} from './commercial-core.js';
export function percentBasisPoints(value){
 const s=String(value??'').trim();if(!/^\d{1,3}(?:\.\d{1,2})?$/.test(s))throw Error('Porcentaje no válido.');
 const [whole,decimal='']=s.split('.'),n=Number(whole)*100+Number(decimal.padEnd(2,'0'));if(n>10000)throw Error('El porcentaje debe estar entre 0 y 100.');return n;
}
function bp(n){if(!Number.isInteger(n)||n<0||n>10000)throw Error('Porcentaje no válido.');return n;}
function total(n){if(!Number.isSafeInteger(n)||n<0)throw Error('Total financiero no válido.');return n;}
const share=(n,b)=>Number(BigInt(n)*BigInt(b)/10000n);
export function allocation(revenueCents,expensesCents,savingsBp,partnerABp){
 total(revenueCents);total(expensesCents);bp(savingsBp);bp(partnerABp);
 const profitCents=revenueCents-expensesCents,available=Math.max(0,profitCents),savingsCents=share(available,savingsBp),distributableCents=available-savingsCents,partnerACents=share(distributableCents,partnerABp);
 return {revenueCents,expensesCents,profitCents,savingsCents,distributableCents,partnerACents,partnerBCents:distributableCents-partnerACents,lossCents:Math.max(0,-profitCents)};
}
export function summarizeYear(payments,expenses,year){
 if(!/^20\d{2}$/.test(String(year)))throw Error('Año no válido.');
 const months=Array.from({length:12},(_,i)=>({month:year+'-'+String(i+1).padStart(2,'0'),revenueCents:0,expensesCents:0,profitCents:0}));
 const byProduct=Object.create(null),byCategory=Object.create(null),byCompany=Object.create(null);
 const add=(obj,key,n)=>{obj[key]=total((obj[key]??0)+n);};
 const seen=new Set();
 for(const [rows,kind] of [[payments,'payment'],[expenses,'expense']])for(const row of rows){
  const date=isoDate(row.date);if(!date.startsWith(year+'-')||!row.id||seen.has(kind+':'+row.id)||!total(row.amountCents))throw Error('Movimiento fuera del período, duplicado o inválido.');seen.add(kind+':'+row.id);
  const m=months[Number(date.slice(5,7))-1],n=row.amountCents;
  if(kind==='payment'){m.revenueCents=total(m.revenueCents+n);add(byProduct,product(row.contractId.split('__')[0]),n);add(byCompany,row.contractId,n);}
  else {m.expensesCents=total(m.expensesCents+n);add(byCategory,String(row.category),n);}
 }
 for(const m of months)m.profitCents=m.revenueCents-m.expensesCents;
 return {months,byProduct,byCategory,byCompany,revenueCents:total(months.reduce((a,m)=>a+m.revenueCents,0)),expensesCents:total(months.reduce((a,m)=>a+m.expensesCents,0))};
}
export function validateCloseMonth(month,today){isoDate(today);if(typeof month!=='string'||!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)||month>=today.slice(0,7))throw Error('Solo se pueden cerrar meses anteriores al actual.');return month;}
