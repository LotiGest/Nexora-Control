// QA-only delivery package. This module neither provisions nor issues a credential.
import {installationPlan} from './plan.js';
import {activationReadiness} from './qa-d1.js';
import {normalizeCompany,readiness} from '../../../commercial-company-core.js';
import {commercialLicenseStatus} from '../../../commercial-entitlement-core.js';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const sha=/^[0-9a-f]{40}$/;
const cleanOrigin=s=>{const u=new URL(s);if(u.protocol!=='https:'||u.username||u.password||u.port||u.pathname!=='/'||u.search||u.hash||!u.hostname.endsWith('.workers.dev'))throw Error('Origen QA no permitido.');return u.origin;};
export function prepareDelivery({company,installation,license,evidence,today,protectedIds,approvedOrigin}){
 const c=normalizeCompany(company);
 if(c.product!=='LOTIGEST'||!c.clientKey.startsWith('qa-')||installation?.environment!=='qa'||installation?.fictitious!==true)throw Error('Entrega limitada a empresa ficticia QA.');
 const plan=installationPlan({product:c.product,slug:c.clientKey,name:c.name,fictitious:true,modules:(license?.lines||[]).filter(x=>x.kind==='module').map(x=>x.code)});
 if(installation.installationId!==c.clientKey||installation.databaseName!==plan.databaseName||!uuid.test(installation.databaseId)||!(protectedIds instanceof Set)||!protectedIds.size||protectedIds.has(installation.databaseId))throw Error('Identidad de base QA no confirmada.');
 const origin=cleanOrigin(installation.url);
 if(origin!==cleanOrigin(approvedOrigin)||!sha.test(installation.releaseSha))throw Error('Origen o versión sin verificar.');
 const missing=[...readiness(c).missing,...activationReadiness({...evidence,databaseId:installation.databaseId}).missing];
 if(evidence?.installationId!==installation.installationId||evidence?.databaseId!==installation.databaseId||evidence?.releaseSha!==installation.releaseSha||evidence?.origin!==origin)missing.push('Evidencia de la misma instalación y versión');
 if(evidence?.scope!=='full-product')missing.push('Producto completo (no solo autenticación)');
 if(evidence?.identityVerified!==true||evidence?.brandingVerified!==true)missing.push('Identidad y personalización');
 if(evidence?.inviteOneTimeVerified!==true||evidence?.inviteExpiredDenied!==true||evidence?.inviteCrossTenantDenied!==true)missing.push('Invitación segura');
 if(evidence?.auditApproved!==true)missing.push('Auditoría 1 aprobada');
 if(!license||license.contractId!=='LOTIGEST__'+c.clientKey||license.product!=='LOTIGEST'||license.clientKey!==c.clientKey||commercialLicenseStatus(license,today)!=='active')missing.push('Licencia comercial vigente');
 return {environment:'qa',state:missing.length?'blocked':'ready-for-manual-review',missing:[...new Set(missing)],customer:{name:c.name,product:c.product,username:c.adminUsername},installation:{id:installation.installationId,url:origin,releaseSha:installation.releaseSha},modules:plan.modules,licenseExpiresOn:license?.expiresOn??null,steps:['Confirmar identidad y evidencia de instalación','Emitir invitación de un solo uso por canal seguro separado','El administrador elige su contraseña y accede con su cuenta','Comprobar identidad, permisos y módulos','Registrar aceptación sin guardar invitación ni contraseña'],activationPerformed:false,credentialsIssued:false};
}
export function deliveryText(packageData){
 if(packageData?.state!=='ready-for-manual-review'||packageData.environment!=='qa')throw Error('Entrega bloqueada hasta completar verificaciones.');
 const {customer,installation,modules,licenseExpiresOn}=packageData;
 return ['NEXORA SYSTEMS — ENTREGA QA (FICTICIA)',customer.name,'Producto: LotiGest Pro','Acceso: '+installation.url,'Usuario: '+customer.username,'Módulos: '+(modules.join(', ')||'Plan base'),'Vigencia comercial: '+licenseExpiresOn,'La invitación se entrega separadamente mediante canal seguro. No contiene contraseña.','La instalación debe ser verificada por el administrador antes de aceptar la entrega.'].join('\n');
}
