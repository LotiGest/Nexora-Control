import {contractId} from './commercial-core.js';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const account=/^[a-f0-9]{32}$/;
function origin(raw){
 let u;try{u=new URL(String(raw??'').trim());}catch{throw Error('URL de instalación no válida.');}
 if(u.protocol!=='https:'||u.username||u.password||u.port||u.pathname!=='/'||u.search||u.hash||!/^([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(u.hostname)||u.hostname.length>253)throw Error('Usá la dirección HTTPS principal, sin rutas, credenciales ni parámetros.');
 return u.origin;
}
export function normalizeLink(input){
 if(input.product!=='LOTIGEST')throw Error('La vinculación existente está disponible primero para LotiGest.');
 const id=contractId(input.product,input.clientKey);
 const accountId=String(input.accountId??'').trim().toLowerCase(),databaseId=String(input.databaseId??'').trim().toLowerCase();
 if(!account.test(accountId)||!uuid.test(databaseId))throw Error('Identificador de cuenta o D1 no válido.');
 const url=origin(input.url),alias=input.alias?origin(input.alias):'';
 if(alias===url)throw Error('El alias debe ser distinto de la URL principal.');
 return {contractId:id,product:'LOTIGEST',clientKey:id.slice('LOTIGEST__'.length),accountId,databaseId,url,alias,state:'pending-verification',source:'existing'};
}
export function linkDraftPlan(input,existing){
 const row=normalizeLink(input);
 if(existing&&existing.contractId!==row.contractId)throw Error('La misma D1 ya está reservada por otra ficha.');
 return {row,steps:['Verificar cuenta y D1 a través del servidor autorizado','Comprobar que las URL y alias apuntan a la misma instalación','Confirmar identidad del propietario sin leer información de compradores','Conservar D1, usuarios, sesiones, contrato y fecha de prueba','Verificar licencia sin bloquear la instalación','Solicitar aprobación explícita para aplicar el vínculo']};
}
