import {normalizeContract,normalizeCatalog,contractId} from './commercial-core.js';
import {isoDate,addMonths,buildCalendar,sumCalendar} from './commercial-billing-core.js';
export function compareAgreementPrices(lines,catalog){
 const current=new Map(catalog.map(r=>[r.product+'__'+r.code,r]));
 return lines.map(l=>{const raw=current.get(l.product+'__'+l.code);if(!raw)return {code:l.code,state:'unavailable'};const r=normalizeCatalog(raw);if(!r.enabled||raw.version!==l.catalogVersion||r.cadence!==l.cadence||r.cycles!==l.cycles)return {code:l.code,state:'not-comparable'};return {code:l.code,state:'comparable',initialDifferenceCents:r.initialCents-l.initialCents,feeDifferenceCents:r.feeCents-l.feeCents};});
}
export function createRenewal(contract,calendar,raw,today){
 const c=normalizeContract(contract),id=contractId(c.product,c.clientKey);isoDate(today);
 if(c.status!=='agreed'||calendar?.contractId!==id||!Number.isSafeInteger(calendar.contractVersion)||calendar.contractVersion<1||!Number.isSafeInteger(contract.version)||contract.version<calendar.contractVersion)throw Error('Se requiere un contrato acordado y calendario registrado.');
 const effectiveOn=isoDate(raw.effectiveOn),reason=String(raw.reason??'').trim();
 if(effectiveOn<=today||effectiveOn<=isoDate(calendar.initialDue)||!reason||reason.length>500)throw Error('Indicá una fecha futura y el motivo de renovación.');
 return {contractId:id,product:c.product,clientKey:c.clientKey,contractVersion:contract.version,calendarVersion:calendar.contractVersion,effectiveOn,reason,lines:c.lines,state:'pending-review'};
}
export function renewalState(row,contract,calendar,today){
 isoDate(today);if(row.state==='withdrawn')return 'withdrawn';
 if(contract?.status!=='agreed'||contract.version!==row.contractVersion||calendar?.contractVersion!==row.calendarVersion)return 'stale';
 return row.effectiveOn<=today?'due-review':'pending-review';
}

export function orderedRevisions(rows){
 const versions=new Set();
 return rows.map(r=>{if(!Number.isSafeInteger(r.version)||r.version<1||versions.has(r.version))throw Error('Historial de versiones inconsistente.');versions.add(r.version);return r;}).sort((a,b)=>b.version-a.version);
}
export function revisionDiff(previous,current){
 const a=new Map((previous?.lines||[]).map(l=>[l.code,l])),b=new Map((current.lines||[]).map(l=>[l.code,l]));
 const changed=[];
 for(const code of new Set([...a.keys(),...b.keys()])){
  const before=a.get(code),after=b.get(code);
  if(!before||!after){changed.push({code,type:before?'removed':'added',before:before||null,after:after||null});continue;}
  if(['initialCents','feeCents','cadence','cycles','catalogVersion','name','kind'].some(k=>before[k]!==after[k]))changed.push({code,type:'changed',before,after});
 }
 return changed;
}

// Preview only: the existing calendar is never changed, and no charge identifiers are issued.
export function renewalPreview(contract,calendar,proposal,today){
 isoDate(today);
 if(renewalState(proposal,contract,calendar,today)==='stale'||proposal.state!=='pending-review'||proposal.contractId!==calendar.contractId)throw Error('Propuesta desactualizada o retirada.');
 const from=isoDate(proposal.effectiveOn),to=isoDate(addMonths(from,12));
 const last=new Date(Date.parse(to+'T00:00:00Z')-86400000).toISOString().slice(0,10);
 const old=buildCalendar(calendar,from,last);
 // No assumption that initial installation fees should repeat on renewal.
 const proposed=buildCalendar({...calendar,initialDue:from,firstDue:from,lines:proposal.lines.map(l=>({...l,initialCents:0}))},from,last);
 const currentCents=sumCalendar(old),proposedCents=sumCalendar(proposed);
 return {from,to:last,currentCents,proposedCents,differenceCents:proposedCents-currentCents,currentCount:old.length,proposedCount:proposed.length,requiresLedgerReview:true,mode:'projection-only'};
}
