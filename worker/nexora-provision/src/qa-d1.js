// Server-side orchestration helper. No credentials or production identifiers supplied by the browser.
// Adapter must be authenticated server-side to a fixed QA account; schema comes from a reviewed pinned release.
import {installationPlan} from './plan.js';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const QA_SCHEMA_PATHS=Object.freeze(['backend/schema.sql','deploy/cloudflare/migrations/0001_receipt_balances.sql','deploy/cloudflare/migrations/0002_user_passwords.sql','deploy/cloudflare/migrations/0003_app_persistence.sql','deploy/cloudflare/migrations/0004_login_limits.sql','deploy/cloudflare/migrations/0005_map_asset_mime.sql','deploy/cloudflare/migrations/0006_public_lot_maps.sql']);
export async function prepareQaD1(input,{adapter,schema,protectedIds,expectedAccount}){
 const plan=installationPlan(input);
 if(!expectedAccount||adapter.accountId!==expectedAccount||adapter.environment!=='qa')throw Error('Cuenta QA no verificada.');
 if(!(protectedIds instanceof Set)||protectedIds.size===0)throw Error('Falta inventario de bases protegidas.');
 if(!Array.isArray(schema)||schema.length!==QA_SCHEMA_PATHS.length||schema.some((x,i)=>x.path!==QA_SCHEMA_PATHS[i]||typeof x.sql!=='string'||!x.sql.trim()))throw Error('Esquema central incompleto.');
 const name=plan.databaseName;if(!name.startsWith('lotigest-qa_'))throw Error('Nombre QA inválido.');
 const existing=await adapter.list();if(existing.some(d=>d.name===name))throw Error('Ya existe una D1 con ese nombre; revisar antes de reintentar.');
 const db=await adapter.create(name);
 if(!uuid.test(db?.uuid??'')||db.name!==name||protectedIds.has(db.uuid)||existing.some(d=>d.uuid===db.uuid))throw Error('Identidad D1 nueva no comprobada.');
 try{const confirmed=await adapter.list();if(!confirmed.some(d=>d.name===name&&d.uuid===db.uuid))throw Error('D1 no encontrada en cuenta QA.');
 const before=await adapter.inspect(db.uuid);if(before.tables!==0)throw Error('D1 no vacía.');
 for(const f of schema)await adapter.apply(db.uuid,f.sql);
 const after=await adapter.inspect(db.uuid);if(after.tables<33||after.users!==0||after.clients!==0||after.sessions!==0)throw Error('Esquema o limpieza inicial no comprobados.');
 return {product:'LOTIGEST',databaseId:db.uuid,databaseName:name,environment:'qa',state:'schema-ready',tables:after.tables,migrations:schema.length-1,activation:'pending'};
 }catch(e){const error=new Error('D1 QA creada; revisión manual requerida antes de reintentar.');error.databaseId=db.uuid;error.cause=e;throw error;}
}
// Activation is blocked until product-server evidence is present, not just commercial agreement.
export function activationReadiness(e){
 const missing=[];
 if(!uuid.test(e?.databaseId??'')||e?.databaseExclusive!==true)missing.push('D1 exclusiva verificada');
 if(e?.schemaApplied!==true)missing.push('esquema');
 if(e?.deploymentVerified!==true)missing.push('despliegue');
 if(e?.temporaryCredentialEnforced!==true||e?.firstPasswordChangeEnforced!==true)missing.push('acceso inicial temporal');
 if(e?.crossTenantLoginDenied!==true||e?.crossTenantSessionDenied!==true)missing.push('aislamiento de autenticación');
 if(e?.licenseVerified!==true)missing.push('licencia aplicada');
 return {ready:missing.length===0,missing};
}
