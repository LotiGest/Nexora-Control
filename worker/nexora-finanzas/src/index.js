import {verifyFirebaseAdmin,AuthFailure,firebaseProject} from '../../nexora-licencias/src/auth.js';
import {readJsonLimited} from '../../nexora-licencias/src/proposal.js';
import {allocation,validateCloseMonth} from '../../../finance-profit.js';
import {normalizePayment} from '../../../finance-core.js';
import {addMonths,isoDate} from '../../../commercial-billing-core.js';
import {checkedCents,normalizeLine} from '../../../commercial-core.js';
const ORIGIN='https://lotigest.github.io';
const json=(status,value,origin)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...(origin===ORIGIN?{'access-control-allow-origin':ORIGIN,'access-control-allow-headers':'authorization, content-type','access-control-allow-methods':'GET, POST, OPTIONS','vary':'Origin'}:{})}});
const bad=(s)=>{throw Error(s)};
const operationId=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(x)?x:bad('Identificador de operación no válido.');
const same=(row,fields)=>row&&Object.entries(fields).every(([key,value])=>row[key]===value);
const identifier=x=>typeof x==='string'&&/^(SIAC|SINDEX|LOTIGEST)__[a-z0-9][a-z0-9-]{2,59}$/.test(x)?x:bad('Contrato no válido.');
async function body(request){return readJsonLimited(request,4096);}
const civilDay=now=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Tegucigalpa',year:'numeric',month:'2-digit',day:'2-digit'}).format(now());
const cashDate=(date,now)=>{isoDate(date);if(date>civilDay(now))throw Error('No se permiten movimientos de caja con fecha futura.');return date;};
async function calendarFor(id,token,fetcher,project){const url='https://firestore.googleapis.com/v1/projects/'+encodeURIComponent(project)+'/databases/(default)/documents/nexoraBillingCalendars/'+encodeURIComponent(id);
 const response=await fetcher(url,{headers:{authorization:token},redirect:'manual'});if(!response.ok)throw Error('No se pudo verificar el calendario en Firebase.');
 const source=(await response.json()).fields;if(!source)throw Error('Calendario inexistente.');
 function value(f){if(f?.stringValue!==undefined)return f.stringValue;if(f?.integerValue!==undefined)return Number(f.integerValue);if(f?.arrayValue)return (f.arrayValue.values||[]).map(value);if(f?.mapValue)return Object.fromEntries(Object.entries(f.mapValue.fields||{}).map(([k,v])=>[k,value(v)]));return undefined;}
 const c=Object.fromEntries(Object.entries(source).map(([k,v])=>[k,value(v)]));if(c.contractId!==id||c.product!==id.split('__')[0]||typeof c.name!=='string'||!c.name.trim()||!Array.isArray(c.lines)||!c.lines.length||c.lines.length>16)throw Error('Calendario inconsistente.');
 const lines=c.lines.map(normalizeLine);if(lines[0].kind!=='plan'||lines.slice(1).some(l=>l.kind!=='module')||lines.some(l=>l.product!==c.product)||new Set(lines.map(l=>l.code)).size!==lines.length||isoDate(c.firstDue)<isoDate(c.initialDue))throw Error('Calendario inconsistente.');return {...c,lines};
}
export function createFinanceWorker({verify=verifyFirebaseAdmin,fetcher=fetch,now=()=>new Date()}={}){return {async fetch(request,env={}){
 const url=new URL(request.url),origin=request.headers.get('origin'),path=url.pathname;
 if(origin&&origin!==ORIGIN)return json(403,{error:'forbidden_origin'},origin);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'access-control-allow-origin':ORIGIN,'access-control-allow-headers':'authorization, content-type','access-control-allow-methods':'GET, POST, OPTIONS','vary':'Origin'}});
 if(!path.startsWith('/api/finance/'))return json(404,{error:'not_found'},origin);
 if(!env.NEXORA_FINANCE_DB||!env.NEXORA_ADMIN_UIDS)return json(503,{error:'finance_not_configured'},origin);
 let admin,project;try{project=firebaseProject(env,true);admin=await verify(request.headers.get('authorization'),env);if(admin.project!==project)throw new AuthFailure(403,'Proyecto de sesión incorrecto.');}catch(e){return json(e instanceof AuthFailure?e.status:503,{error:'authentication_failed'},origin);}
 try{
  if(path==='/api/finance/payment'&&request.method==='POST'){
   const raw=await body(request),id=operationId(raw.operationId),p=normalizePayment(raw);cashDate(p.date,now);const calendar=await calendarFor(identifier(p.contractId),request.headers.get('authorization'),fetcher,project);
   const [code,sequenceText]=p.chargeId.split('__'),sequence=Number(sequenceText),line=calendar.lines.map(normalizeLine).find(l=>l.code===code);
   if(!line||!Number.isInteger(sequence)||sequence>1200||sequence<0)throw Error('Cuota inexistente.');
   const step={monthly:1,quarterly:3,annual:12}[line.cadence];
   if(sequence>0&&(!step||!line.feeCents||(sequence-1)*step>1200||(line.cycles&&sequence>line.cycles)))throw Error('Cuota inexistente.');
   const due=sequence===0?isoDate(calendar.initialDue):isoDate(addMonths(calendar.firstDue,(sequence-1)*step));
   const charge={due,kind:sequence===0?'initial':'recurring',amountCents:sequence===0?line.initialCents:line.feeCents};
   if(!charge.amountCents)throw Error('Cuota sin importe.');
   const results=await env.NEXORA_FINANCE_DB.batch([
    env.NEXORA_FINANCE_DB.prepare('INSERT INTO charges(contract_id,charge_id,product,company,due_date,kind,amount_cents) SELECT ?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM payments WHERE id=?) ON CONFLICT(contract_id,charge_id) DO NOTHING').bind(p.contractId,p.chargeId,calendar.product,calendar.name,charge.due,charge.kind,charge.amountCents,id),
    env.NEXORA_FINANCE_DB.prepare('INSERT INTO payments(id,contract_id,charge_id,amount_cents,paid_on,reference,recorded_by) SELECT ?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM charges WHERE contract_id=? AND charge_id=? AND product=? AND due_date=? AND kind=? AND amount_cents=?) ON CONFLICT(id) DO NOTHING').bind(id,p.contractId,p.chargeId,p.amountCents,p.date,p.reference,admin.uid,p.contractId,p.chargeId,calendar.product,charge.due,charge.kind,charge.amountCents),
    env.NEXORA_FINANCE_DB.prepare('SELECT id,contract_id AS contractId,charge_id AS chargeId,amount_cents AS amountCents,paid_on AS date,reference,recorded_by AS recordedBy FROM payments WHERE id=?').bind(id)
   ]);
   if(!results[2].results[0])return json(409,{error:'charge_conflict',message:'La obligación registrada no coincide con el calendario. Revisá antes de cobrar.'},origin);
   if(!same(results[2].results[0],{...p,recordedBy:admin.uid}))return json(409,{error:'operation_conflict',message:'La operación ya existe con otros datos.'},origin);
   return json(results[1].meta.changes?201:200,{id,receipt:'NX-'+id,company:calendar.name,contractId:p.contractId,chargeId:p.chargeId,amountCents:p.amountCents,date:p.date,reference:p.reference},origin);
  }
  if(path==='/api/finance/expense'&&request.method==='POST'){
   const x=await body(request),id=operationId(x.operationId),amountCents=checkedCents(x.amountCents),date=cashDate(x.date,now),category=String(x.category||'').trim(),reference=String(x.reference||'').trim();
   if(!amountCents||!category||category.length>80||!reference||reference.length>100)throw Error('Gasto no válido.');const results=await env.NEXORA_FINANCE_DB.batch([
    env.NEXORA_FINANCE_DB.prepare('INSERT INTO expenses(id,category,amount_cents,spent_on,reference,recorded_by) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(id,category,amountCents,date,reference,admin.uid),
    env.NEXORA_FINANCE_DB.prepare('SELECT id,category,amount_cents AS amountCents,spent_on AS date,reference,recorded_by AS recordedBy FROM expenses WHERE id=?').bind(id)
   ]);
   if(!same(results[1].results[0],{category,amountCents,date,reference,recordedBy:admin.uid}))return json(409,{error:'operation_conflict',message:'La operación ya existe con otros datos.'},origin);
   return json(results[0].meta.changes?201:200,{id,receipt:'NXG-'+id,amountCents,date,category,reference},origin);
  }
  if(path==='/api/finance/closures'&&request.method==='GET'){
   const year=url.searchParams.get('year');if(!/^20\d{2}$/.test(year||''))throw Error('Año no válido.');
   const rows=await env.NEXORA_FINANCE_DB.prepare('SELECT month,revenue_cents AS revenueCents,expenses_cents AS expensesCents,savings_bp AS savingsBp,partner_a_bp AS partnerABp,closed_by AS closedBy,closed_at AS closedAt FROM finance_closures WHERE month BETWEEN ? AND ? ORDER BY month').bind(year+'-01',year+'-12').all();
   return json(200,{closures:rows.results.map(r=>({...r,...allocation(r.revenueCents,r.expensesCents,r.savingsBp,r.partnerABp)}))},origin);
  }
  if(path==='/api/finance/close'&&request.method==='POST'){
   const x=await body(request),today=civilDay(now),month=validateCloseMonth(x.month,today);
   allocation(x.expectedRevenueCents,x.expectedExpensesCents,x.savingsBp,x.partnerABp);
   const from=month+'-01',to=addMonths(from,1);
   const rows=await env.NEXORA_FINANCE_DB.batch([
    env.NEXORA_FINANCE_DB.prepare('INSERT INTO finance_closures(month,revenue_cents,expenses_cents,savings_bp,partner_a_bp,closed_by) SELECT ?,r,e,?,?,? FROM (SELECT COALESCE((SELECT SUM(amount_cents) FROM payments WHERE paid_on>=? AND paid_on<?),0) AS r,COALESCE((SELECT SUM(amount_cents) FROM expenses WHERE spent_on>=? AND spent_on<?),0) AS e) WHERE r=? AND e=? ON CONFLICT(month) DO NOTHING').bind(month,x.savingsBp,x.partnerABp,admin.uid,from,to,from,to,x.expectedRevenueCents,x.expectedExpensesCents),
    env.NEXORA_FINANCE_DB.prepare('SELECT month,revenue_cents AS revenueCents,expenses_cents AS expensesCents,savings_bp AS savingsBp,partner_a_bp AS partnerABp,closed_by AS closedBy,closed_at AS closedAt FROM finance_closures WHERE month=?').bind(month)
   ]);
   const r=rows[1].results[0];if(!r||r.savingsBp!==x.savingsBp||r.partnerABp!==x.partnerABp||r.revenueCents!==x.expectedRevenueCents||r.expensesCents!==x.expectedExpensesCents)return json(409,{error:'closure_conflict',message:'El libro cambió o el mes ya fue cerrado con otros valores. Actualizá y verificá el cierre.'},origin);
   return json(rows[0].meta.changes?201:200,{...r,...allocation(r.revenueCents,r.expensesCents,r.savingsBp,r.partnerABp)},origin);
  }
  if(path==='/api/finance/report'&&request.method==='GET'){
   const from=isoDate(url.searchParams.get('from')),to=isoDate(url.searchParams.get('to'));if(to<from||Number(to.slice(0,4))-Number(from.slice(0,4))>1)throw Error('Rango máximo: dos años.');
   const [payments,expenses,charges]=await env.NEXORA_FINANCE_DB.batch([
    env.NEXORA_FINANCE_DB.prepare('SELECT p.id,p.contract_id AS contractId,p.charge_id AS chargeId,p.amount_cents AS amountCents,p.paid_on AS date,p.reference,p.recorded_by AS recordedBy,c.company FROM payments p JOIN charges c ON c.contract_id=p.contract_id AND c.charge_id=p.charge_id WHERE p.paid_on BETWEEN ? AND ? ORDER BY p.paid_on,p.id LIMIT 10000').bind(from,to),
    env.NEXORA_FINANCE_DB.prepare('SELECT id,category,amount_cents AS amountCents,spent_on AS date,reference,recorded_by AS recordedBy FROM expenses WHERE spent_on BETWEEN ? AND ? ORDER BY spent_on,id LIMIT 10000').bind(from,to),
    env.NEXORA_FINANCE_DB.prepare('SELECT contract_id AS contractId,charge_id AS chargeId,product,company,due_date AS due,kind,amount_cents AS amountCents,paid_cents AS paidCents FROM charges WHERE due_date BETWEEN ? AND ? ORDER BY due_date LIMIT 10000').bind(from,to)
   ]);
   if([payments,expenses,charges].some(x=>x.results.length>=10000))throw Error('Informe demasiado grande; consultá un período menor.');
   const sum=rows=>rows.reduce((n,r)=>n+r.amountCents,0),revenueCents=sum(payments.results),expensesCents=sum(expenses.results);
   const byProduct={},byMonth={};const chargeProducts=new Map(charges.results.map(c=>[c.contractId+'|'+c.chargeId,c.product]));
   for(const p of payments.results){const product=chargeProducts.get(p.contractId+'|'+p.chargeId)||p.contractId.split('__')[0];byProduct[product]=(byProduct[product]||0)+p.amountCents;const m=p.date.slice(0,7);(byMonth[m]??={revenueCents:0,expensesCents:0}).revenueCents+=p.amountCents;}
   for(const e of expenses.results){const m=e.date.slice(0,7);(byMonth[m]??={revenueCents:0,expensesCents:0}).expensesCents+=e.amountCents;}
   for(const row of Object.values(byMonth))row.profitCents=row.revenueCents-row.expensesCents;
   return json(200,{payments:payments.results,expenses:expenses.results,charges:charges.results,revenueCents,expensesCents,profitCents:revenueCents-expensesCents,byProduct,byMonth},origin);
  }
  return json(405,{error:'method_not_allowed'},origin);
 }catch(e){return json(400,{error:'invalid_operation',message:e.message},origin);}
 }};}
export default createFinanceWorker();
