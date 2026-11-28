import {normalizeLink} from '../../../commercial-installation-core.js';
// The trusted inventory must come from an authorized server. The browser may only submit a draft.
// No database query, network request, binding change or license activation is performed here.
export function verifyExistingQaLink(input,{inventory,protectedIds,expectedAccount}){
 const draft=normalizeLink(input);
 if(!(protectedIds instanceof Set)||!protectedIds.size||!Array.isArray(inventory)||!expectedAccount||draft.accountId!==expectedAccount||protectedIds.has(draft.databaseId))throw Error('Inventario o cuenta QA no autorizados.');
 if(!draft.clientKey.startsWith('qa-'))throw Error('La vinculación de prueba exige una empresa ficticia.');
 const matches=inventory.filter(x=>x.databaseId===draft.databaseId);
 if(matches.length!==1)throw Error('D1 no encontrada de forma exclusiva.');
 const x=matches[0];
 if(x.accountId!==expectedAccount||x.environment!=='qa'||x.fictitious!==true||x.installationId!==draft.clientKey||x.bindingDatabaseId!==draft.databaseId||x.databaseMarker!==draft.clientKey||x.databaseEnvironment!=='qa')throw Error('Identidad de instalación no comprobada.');
 if(x.origin!==draft.url||(x.alias??'')!==draft.alias)throw Error('Las direcciones no coinciden con el inventario autorizado.');
 if(inventory.some(y=>y!==x&&(y.installationId===x.installationId||y.origin===x.origin||(draft.alias&&(y.alias===draft.alias||y.origin===draft.alias))||y.alias===x.origin)))throw Error('Conflicto entre instalaciones.');
 const missing=[];
 if(x.scope!=='full-product')missing.push('Verificación del producto completo');
 if(x.ownerVerified!==true)missing.push('Propietario verificado');
 if(x.licenseVerified!==true)missing.push('Licencia verificada');
 if(x.readOnlyVerified!==true)missing.push('Vinculación no destructiva');
 return {contractId:draft.contractId,databaseId:draft.databaseId,origin:draft.url,environment:'qa',state:missing.length?'pending-verification':'ready-for-manual-review',missing,bindingChanged:false,licenseApplied:false,productionAuthorized:false};
}
