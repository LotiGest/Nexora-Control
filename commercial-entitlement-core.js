import {normalizeContract,contractId} from './commercial-core.js';
import {isoDate} from './commercial-billing-core.js';
const day=86400000;
export function licensePeriod(startsOn,expiresOn,graceDays){
 isoDate(startsOn);isoDate(expiresOn);
 if(expiresOn<startsOn||!Number.isInteger(graceDays)||graceDays<0||graceDays>30)throw Error('Vigencia o gracia no válida (0–30 días).');
 const graceUntil=new Date(Date.parse(expiresOn+'T00:00:00Z')+graceDays*day).toISOString().slice(0,10);isoDate(graceUntil);
 return {startsOn,expiresOn,graceDays,graceUntil};
}
export function commercialLicenseStatus(row,today){
 isoDate(today);if(!row)return 'unissued';const p=licensePeriod(row.startsOn,row.expiresOn,row.graceDays);if(p.graceUntil!==row.graceUntil||!['issued','suspended'].includes(row.state))throw Error('Licencia comercial inconsistente.');
 if(row.state==='suspended')return 'suspended';if(today<p.startsOn)return 'scheduled';if(today<=p.expiresOn)return 'active';if(today<=p.graceUntil)return 'grace';return 'expired';
}
const reasonOf=v=>{const s=String(v??'').trim();if(!s||s.length>500)throw Error('Indicá un motivo de hasta 500 caracteres.');return s;};
export function licenseChange({contract,calendar,previous,action,input,today}){
 isoDate(today);const reason=reasonOf(input.reason);
 if(action==='issue'){
  if(previous)throw Error('Ya existe una licencia comercial.');
  const c=normalizeContract(contract),id=contractId(c.product,c.clientKey);
  if(c.status!=='agreed'||calendar?.contractId!==id||calendar.contractVersion!==contract.version||JSON.stringify(calendar.lines)!==JSON.stringify(c.lines))throw Error('El contrato y el calendario vigente deben coincidir.');
  const p=licensePeriod(input.startsOn,input.expiresOn,input.graceDays);
  if(p.startsOn<today||p.startsOn<isoDate(calendar.initialDue))throw Error('El inicio no puede ser retroactivo ni anterior al calendario.');
  return {contractId:id,product:c.product,clientKey:c.clientKey,contractVersion:contract.version,lines:c.lines,...p,state:'issued',action,reason};
 }
 if(!previous)throw Error('No existe una licencia comercial.');
 const status=commercialLicenseStatus(previous,today);
 const {contractId:id,product,clientKey,contractVersion,lines,startsOn,expiresOn,graceDays,graceUntil,state}=previous;
 const base={contractId:id,product,clientKey,contractVersion,lines,startsOn,expiresOn,graceDays,graceUntil,state};
 if(action==='suspend'&&state==='issued')return {...base,state:'suspended',action,reason};
 if(action==='resume'&&state==='suspended'&&today<=graceUntil&&contract?.status==='agreed'&&contract.version===contractVersion)return {...base,state:'issued',action,reason};
 if(action==='renew'&&state==='issued'){
  if(contract?.status!=='agreed'||contract.version!==contractVersion||calendar?.contractVersion!==contractVersion)throw Error('Cambio de condiciones: revisá primero el acuerdo y calendario.');
  const p=licensePeriod(startsOn,input.expiresOn,input.graceDays);
  if(p.expiresOn<=expiresOn||p.expiresOn<today)throw Error('El nuevo vencimiento debe extender el anterior y no estar vencido.');
  return {...base,...p,action,reason};
 }
 throw Error('Transición de licencia no permitida: '+status);
}
