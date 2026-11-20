export const laboratoryTiers = Object.freeze([
  {value:'off',label:'Desactivado'},
  {value:'basic',label:'Laboratorio Básico'},
  {value:'full',label:'Laboratorio Full'}
]);
const ownerRe = /^[a-z0-9][a-z0-9-]{2,79}$/;
export function validOwner(value) {return typeof value==='string' && ownerRe.test(value);}
export function validDate(value) {
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const date=new Date(value+'T12:00:00Z');
 return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10)===value;
}
export function normalizeClient(input) {
 const name=String(input.name||'').trim().replace(/\s+/g,' ');
 const ownerKey=String(input.ownerKey||'').trim().toLowerCase();
 if(name.length<3||name.length>100)throw Error('Ingresá un nombre de clínica de 3 a 100 caracteres.');
 if(!validOwner(ownerKey))throw Error('El identificador SIAC debe tener entre 3 y 80 caracteres: letras minúsculas, números y guiones.');
 return {name,ownerKey,product:'SIAC'};
}
export function normalizeLicense(input) {
 const ownerKey=String(input.ownerKey||'').trim().toLowerCase();
 const tier=String(input.tier||'');
 const expiresOn=String(input.expiresOn||'').trim()||null;
 const contractRef=String(input.contractRef||'').trim();
 if(!validOwner(ownerKey))throw Error('Seleccioná una clínica con identificador SIAC válido.');
 if(!laboratoryTiers.some(t=>t.value===tier))throw Error('Seleccioná un nivel válido de Laboratorio.');
 if(expiresOn!==null&&!validDate(expiresOn))throw Error('Ingresá una fecha de vencimiento válida.');
 if(contractRef.length>100)throw Error('La referencia comercial no puede superar 100 caracteres.');
 return {ownerKey,product:'SIAC',module:'laboratory',tier,expiresOn,contractRef};
}
export function labelTier(tier){return laboratoryTiers.find(t=>t.value===tier)?.label||'No configurado';}
export function licenseReviewStatus(record) {
 if(!record)return 'Sin propuesta';
 return record.status==='verified'?'Aplicación confirmada manualmente':'Borrador · no aplicado en SIAC';
}
const sqlQuote=value=>"'"+String(value).replaceAll("'","''")+"'";
/** SQL for vendor review ONLY: user must apply it on the specific SIAC D1 instance. */
export function generateSiacLicenseSql(input) {
 const row=normalizeLicense(input);
 const payload=JSON.stringify({version:1,laboratory:row.tier,expiresOn:row.expiresOn});
 const o=sqlQuote(row.ownerKey),d=sqlQuote(payload),actor=sqlQuote('Nexora Systems · activación autorizada');
 return [
  '-- SIAC · propuesta de licencia. REQUIERE revisión, respaldo y aplicación externa autorizada.',
  '-- Este archivo NO activa SIAC por sí mismo. Clínica: '+row.ownerKey,
  'BEGIN TRANSACTION;',
  'INSERT INTO siac_clinic_module_license_events(id,owner,at,changed_by,previous_data,next_data) VALUES (lower(hex(randomblob(16))),'+o+",datetime('now'),"+actor+', (SELECT data FROM siac_clinic_module_licenses WHERE owner='+o+'),'+d+');',
  'INSERT INTO siac_clinic_module_licenses(owner,data,updated_at,updated_by) VALUES ('+o+','+d+",datetime('now'),"+actor+') ON CONFLICT(owner) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at,updated_by=excluded.updated_by;',
  'COMMIT;'
 ].join('\n');
}

/** Human-readable preview of a proposed commercial change, never an SIAC activation. */
export function reviewLicenseChange(previous,input,clinicName=''){
 const next=normalizeLicense(input),old=previous?normalizeLicense(previous):null;
 const sensitive=next.tier==='off'||next.tier==='full'||previous?.status==='verified'||(old!==null&&(old.tier!==next.tier||old.expiresOn!==next.expiresOn));
 return {
  requiresTyping:Boolean(sensitive),
  summary:[
   'Clínica: '+(clinicName||next.ownerKey),
   'Instalación SIAC: '+next.ownerKey,
   'Propuesta anterior: '+(old?labelTier(old.tier):'Ninguna'),
   'Propuesta nueva: '+labelTier(next.tier),
   'Vencimiento anterior: '+(old?(old.expiresOn||'Sin fecha'):'No establecido'),
   'Vencimiento nuevo: '+(next.expiresOn||'Sin vencimiento'),
   'Contrato: '+(next.contractRef||'Sin referencia'),
   '',
   'IMPORTANTE: guardar esta propuesta NO cambia la licencia operativa ni los datos clínicos de SIAC.'
  ].join('\n')
 };
}

/** Require explicit HTTPS origin; never let a worker URL carry credentials or paths. */
export function validatedLicenseApiOrigin(value){
 if(value===''||value==null)return null;
 if(typeof value!=='string'||value.length>250)throw Error('Dirección del servicio de licencias no válida.');
 let url;
 try{url=new URL(value)}catch{throw Error('Dirección del servicio de licencias no válida.')}
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||
  !['','/'].includes(url.pathname)||url.port||url.hostname==='localhost'||!url.hostname.includes('.'))
  throw Error('El servicio de licencias debe utilizar un origen HTTPS seguro.');
 return url.origin;
}
export function describeLiveLicense(draft,serverResponse,owner){
 if(serverResponse?.source!=='siac_live'||serverResponse.readOnly!==true||
  serverResponse.ownerKey!==owner||
  !['off','basic','full'].includes(serverResponse.license?.laboratory)||
  !['off','basic','full'].includes(serverResponse.license?.contractedLaboratory))
  throw Error('La respuesta no confirma una licencia válida para esta clínica.');
 const live=serverResponse.license;
 const expired=live.expired===true;
 const effective=expired?'Desactivado por vencimiento':labelTier(live.laboratory);
 const matches=Boolean(draft)&&draft.tier===live.contractedLaboratory&&
  (draft.expiresOn??null)===(live.expiresOn??null);
 return {
  matches,
  description:'Licencia verificada en SIAC: '+effective+
   ' · Plan contratado: '+labelTier(live.contractedLaboratory)+
   ' · Vencimiento: '+(live.expiresOn||'Sin fecha')+
   ' · '+(matches?'Coincide con la propuesta guardada.':'Difiere de la propuesta o no hay propuesta guardada.')+
   ' · Consulta: '+serverResponse.verifiedAt
 };
}
