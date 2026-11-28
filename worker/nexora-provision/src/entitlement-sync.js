// Version-checked entitlement synchronization; no customer data changes.
import {licensePeriod} from '../../../commercial-entitlement-core.js';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function entitlementValues(e){
 const days=(Date.parse(e.graceUntil)-Date.parse(e.expiresOn))/86400000,p=licensePeriod(e.startsOn,e.expiresOn,days);
 if(!/^qa-[a-z0-9-]{3,55}$/.test(e.installationId??'')||e.contractId!=='LOTIGEST__'+e.installationId||!Number.isSafeInteger(e.licenseVersion)||e.licenseVersion<1||!Number.isSafeInteger(e.contractVersion)||e.contractVersion<1||!['issued','suspended'].includes(e.state)||p.graceUntil!==e.graceUntil||!['promocion','profesional','empresarial','corporativo'].includes(e.planCode))throw Error('Licencia QA no válida.');
 return [e.installationId,e.contractId,e.licenseVersion,e.contractVersion,e.planCode,e.state,e.startsOn,e.expiresOn,e.graceUntil];
}
export function validateTarget(row,e,protectedIds){
 entitlementValues(e);
 if(!row||row.state!=='schema-ready'||row.contractId!==e.contractId||!uuid.test(row.databaseId??'')||protectedIds.has(row.databaseId.toLowerCase())||row.databaseName!=='lotigest-'+e.installationId.replaceAll('-','_'))throw Error('Instalación no autorizada por registro QA.');
 return row.databaseId;
}
export function currentValues(r){return [r.installation_id,r.contract_id,r.license_version,r.contract_version,r.plan_code,r.state,r.starts_on,r.expires_on,r.grace_until];}
export function entitlementTransition(current,e){
 const target=entitlementValues(e),old=currentValues(current);
 if(old[0]!==target[0]||old[1]!==target[1]||old[3]!==target[3]||old[4]!==target[4]||old[6]!==target[6]||!Number.isSafeInteger(old[2])||old[2]<1)throw Error('Identidad o condiciones cambiaron.');
 if(old[2]===target[2]){if(JSON.stringify(old)!==JSON.stringify(target))throw Error('Versión existente con contenido diferente.');return 'unchanged';}
 if(old[2]>target[2]||target[7]<old[7])throw Error('Versión o vencimiento retroactivo.');
 return 'update';
}
