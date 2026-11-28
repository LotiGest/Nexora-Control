// Server-side orchestration helper. No credentials or production identifiers supplied by the browser.
// Adapter must be authenticated server-side to a fixed QA account; schema comes from a reviewed pinned release.
import {installationPlan} from './plan.js';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const QA_SCHEMA_PATHS=Object.freeze(['backend/schema.sql','deploy/cloudflare/migrations/0001_receipt_balances.sql','deploy/cloudflare/migrations/0002_user_passwords.sql','deploy/cloudflare/migrations/0003_app_persistence.sql','deploy/cloudflare/migrations/0004_login_limits.sql','deploy/cloudflare/migrations/0005_map_asset_mime.sql','deploy/cloudflare/migrations/0006_public_lot_maps.sql']);
export const QA_SCHEMA_RELEASE='24b74215e9d974acea1d22419615106f26d352c7';
export const QA_SCHEMA_BLOBS=Object.freeze(['ff3ac62892688317a6da33d13e2a6074ea6dad04','c7f74ec819d6367cca401b6116baf1a6a3e4362b','6becc40b44a7cec75165ed10ba1a84b9d84310f0','5fdf93add68ad67a4327e7e7b4ad4d34eb9299ee','15c6092132b92775584c37a75549d8eaf7b420ea','ad1407b5bc9320cd57a628d605b873bc08b7d4a1','04a924749e0cb743d365ca6e46047209b003a5a8']);
export async function gitBlobId(sql){
 const bytes=new TextEncoder().encode(sql),prefix=new TextEncoder().encode('blob '+bytes.length+'\0'),all=new Uint8Array(prefix.length+bytes.length);
 all.set(prefix);all.set(bytes,prefix.length);return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-1',all)),b=>b.toString(16).padStart(2,'0')).join('');
}
// trustedBlobs is server-side dependency injection for tests, never request input.
export async function prepareQaD1(input,{adapter,schema,protectedIds,expectedAccount,trustedBlobs=QA_SCHEMA_BLOBS}){

 const plan=installationPlan(input);
 if(!expectedAccount||adapter.accountId!==expectedAccount||adapter.environment!=='qa')throw Error('Cuenta QA no verificada.');
 if(!(protectedIds instanceof Set)||protectedIds.size===0)throw Error('Falta inventario de bases protegidas.');
 if(!Array.isArray(schema)||schema.length!==QA_SCHEMA_PATHS.length||schema.some((x,i)=>x.path!==QA_SCHEMA_PATHS[i]||typeof x.sql!=='string'||!x.sql.trim()))throw Error('Esquema central incompleto.');
 if(!Array.isArray(trustedBlobs)||trustedBlobs.length!==QA_SCHEMA_PATHS.length||trustedBlobs.some(x=>!(/^[a-f0-9]{40}$/).test(x)))throw Error('Manifiesto de esquema no válido.');
 const frozen=schema.map(f=>({path:f.path,sql:f.sql}));for(let i=0;i<frozen.length;i++)if(await gitBlobId(frozen[i].sql)!==trustedBlobs[i])throw Error('El esquema no coincide con la versión revisada: '+frozen[i].path);
 const name=plan.databaseName;if(!name.startsWith('lotigest-qa_'))throw Error('Nombre QA inválido.');
 const inventory=async()=>{const rows=await adapter.list();if(!Array.isArray(rows)||rows.some(d=>!uuid.test(d?.uuid??'')||typeof d.name!=='string')||new Set(rows.map(d=>d.uuid.toLowerCase())).size!==rows.length||new Set(rows.map(d=>d.name)).size!==rows.length)throw Error('Inventario D1 inconsistente.');return rows;};
 const protectedLower=new Set([...protectedIds].map(x=>String(x).toLowerCase()));if([...protectedLower].some(x=>!uuid.test(x)))throw Error('Inventario protegido inválido.');
 const existing=await inventory();if(existing.some(d=>d.name===name))throw Error('Ya existe una D1 con ese nombre; revisar antes de reintentar.');
 const db=await adapter.create(name);
 if(!uuid.test(db?.uuid??'')||db.name!==name||protectedLower.has(db.uuid.toLowerCase())||existing.some(d=>d.uuid.toLowerCase()===db.uuid.toLowerCase()))throw Error('Identidad D1 nueva no comprobada.');
 try{const confirm=async()=>{const confirmed=await inventory();if(!confirmed.some(d=>d.name===name&&d.uuid===db.uuid)||protectedLower.has(db.uuid.toLowerCase()))throw Error('D1 no encontrada en cuenta QA.');};await confirm();
 const before=await adapter.inspect(db.uuid);if(before.tables!==0)throw Error('D1 no vacía.');
 for(const f of frozen){await confirm();await adapter.apply(db.uuid,f.sql);}await confirm();
 const after=await adapter.inspect(db.uuid);if(after.tables<33||after.users!==0||after.clients!==0||after.sessions!==0)throw Error('Esquema o limpieza inicial no comprobados.');
 return {product:'LOTIGEST',databaseId:db.uuid,databaseName:name,environment:'qa',state:'schema-ready',tables:after.tables,migrations:frozen.length-1,schemaRelease:QA_SCHEMA_RELEASE,activation:'pending'};
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
