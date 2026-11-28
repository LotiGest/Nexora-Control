// QA-only orchestrator. It never accepts resource IDs, credentials, SQL or modules from the browser.
import {verifyFirebaseAdmin,AuthFailure,firebaseProject} from '../../nexora-licencias/src/auth.js';
import {readJsonLimited} from '../../nexora-licencias/src/proposal.js';
import {normalizeCompany,readiness} from '../../../commercial-company-core.js';
import {normalizeContract,normalizeLine,contractId} from '../../../commercial-core.js';
import {snapshotCalendar} from '../../../commercial-billing-core.js';
import {commercialLicenseStatus} from '../../../commercial-entitlement-core.js';
import {installationPlan} from './plan.js';
import {prepareQaD1} from './qa-d1.js';
import {digest} from './initial-access.js';
import {provisionJournal} from './journal.js';
import {createCloudflareQaInfrastructure} from './cloudflare-adapter.js';
const key=/^LOTIGEST__qa-[a-z0-9-]{3,55}$/;
const collections=['nexoraCompanyProfiles','nexoraCommercialContracts','nexoraBillingCalendars','nexoraCommercialLicenses'];
const version=x=>Number.isSafeInteger(x)&&x>0;
const json=(status,body)=>Response.json(body,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
function decode(f){
 if(f?.stringValue!==undefined)return f.stringValue;
 if(f?.integerValue!==undefined){const n=Number(f.integerValue);if(!Number.isSafeInteger(n))throw Error('Campo numérico inválido.');return n;}
 if(f?.booleanValue!==undefined)return f.booleanValue;
 if(f?.nullValue!==undefined)return null;
 if(f?.timestampValue!==undefined)return f.timestampValue;
 if(f?.mapValue)return Object.fromEntries(Object.entries(f.mapValue.fields||{}).map(([k,v])=>[k,decode(v)]));
 if(f?.arrayValue)return (f.arrayValue.values||[]).map(decode);
 throw Error('Campo Firebase no admitido.');
}
export async function fetchCommercialRecords({project,id,authorization,fetcher=fetch}){
 const root='https://firestore.googleapis.com/v1/projects/'+encodeURIComponent(project)+'/databases/(default)/documents/';
 return Promise.all(collections.map(async collection=>{
  const url=root+collection+'/'+encodeURIComponent(id);
  const res=await fetcher(url,{headers:{authorization},redirect:'manual',cache:'no-store'});
  if(!res.ok)throw Error('No se pudo confirmar '+collection+'.');
  const record=await res.json();if(record.name!=='projects/'+project+'/databases/(default)/documents/'+collection+'/'+id||!record.fields)throw Error('Identidad de documento no confirmada.');
  return Object.fromEntries(Object.entries(record.fields).map(([k,v])=>[k,decode(v)]));
 }));
}
export async function prepareCommercialPlan(id,records,today){
 if(typeof id!=='string'||!key.test(id)||!Array.isArray(records)||records.length!==4)throw Error('Solo se admite LotiGest ficticio QA.');
 const [raw,agreement,calendar,license]=records,c=normalizeCompany(raw),contract=normalizeContract(agreement);
 if(!readiness(c).ready||c.adminUsername==='lotigest-admin'||contractId(c.product,c.clientKey)!==id||contractId(contract.product,contract.clientKey)!==id||contract.status!=='agreed'||!version(raw.version)||!version(agreement.version)||!version(license.version))throw Error('Ficha o contrato no confirmado.');
 const expected=snapshotCalendar(agreement,calendar);
 if(calendar.contractId!==id||calendar.contractVersion!==agreement.version||calendar.product!==c.product||calendar.clientKey!==c.clientKey||calendar.name!==contract.name||calendar.reference!==contract.reference||JSON.stringify(calendar.lines.map(normalizeLine))!==JSON.stringify(expected.lines)||c.name!==contract.name)throw Error('Calendario o empresa no coinciden con contrato.');
 if(license.contractId!==id||license.clientKey!==c.clientKey||license.product!==c.product||license.contractVersion!==agreement.version||commercialLicenseStatus(license,today)!=='active'||JSON.stringify(license.lines.map(normalizeLine))!==JSON.stringify(expected.lines))throw Error('Licencia comercial vigente y términos exactos requeridos.');
 const input={product:c.product,slug:c.clientKey,name:c.name,fictitious:true,modules:expected.lines.filter(l=>l.kind==='module').map(l=>l.code)};
 const plan=installationPlan(input);
 const revision=await digest(JSON.stringify({company:c,companyVersion:raw.version,contract,contractVersion:agreement.version,calendar:expected,licenseVersion:license.version,startsOn:license.startsOn,expiresOn:license.expiresOn,graceUntil:license.graceUntil}));
 return {input,plan,revision,licenseVersion:license.version,contractVersion:agreement.version};
}
// Infrastructure adapter is a trusted server dependency, never constructed from request data.
// Without a configured adapter the endpoint is intentionally preview-only.
export function createProvisionWorker({verify=verifyFirebaseAdmin,fetcher=fetch,now=()=>new Date(),infrastructure=null,journal=null,prepare=prepareQaD1}={}){
 return {async fetch(request,env={}){
  const path=new URL(request.url).pathname;
  if(request.method!=='POST'||!['/api/provision/preview','/api/provision/prepare'].includes(path))return json(404,{error:'not_found'});
  if(request.headers.get('origin')!==new URL(request.url).origin)return json(403,{error:'forbidden_origin'});
  let project,admin;try{project=firebaseProject(env,true);admin=await verify(request.headers.get('authorization'),env);if(admin.project!==project)throw new AuthFailure(403,'Proyecto incorrecto.');}catch(e){return json(e instanceof AuthFailure?e.status:503,{error:'authorization_failed'});}
  let raw;try{raw=await readJsonLimited(request,2048);if(!raw||typeof raw!=='object'||Array.isArray(raw)||typeof raw.contractId!=='string'||!key.test(raw.contractId)||Object.keys(raw).some(k=>!['contractId','revision'].includes(k)))throw Error();}catch{return json(400,{error:'invalid_request'});}
  const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Tegucigalpa',year:'numeric',month:'2-digit',day:'2-digit'}).format(now());
  let data;try{data=await prepareCommercialPlan(raw.contractId,await fetchCommercialRecords({project,id:raw.contractId,authorization:request.headers.get('authorization'),fetcher}),today);}catch{return json(409,{error:'commercial_records_not_verified'});}
  if(path.endsWith('/preview'))return json(200,{state:'preview',plan:data.plan,revision:data.revision,contractVersion:data.contractVersion,licenseVersion:data.licenseVersion,activationPerformed:false});
  if(raw.revision!==data.revision)return json(409,{error:'commercial_revision_changed'});
  let infra;try{if(env.NEXORA_QA_PROVISION!=='enabled')throw Error();infra=infrastructure??createCloudflareQaInfrastructure(env);}catch{return json(503,{error:'provision_adapter_not_configured'});}
  let ledger,claim;try{ledger=journal??provisionJournal(env.NEXORA_PROVISION_JOURNAL);claim=await ledger.claim({contractId:raw.contractId,revision:data.revision,uid:admin.uid});}catch{return json(503,{error:'provision_journal_unavailable'});}
  if(!claim.claimed){const row=claim.row;if(row.revision!==data.revision)return json(409,{error:'existing_operation_revision_changed'});if(row.state==='schema-ready')return json(200,{state:row.state,databaseId:row.databaseId,databaseName:row.databaseName,activationPerformed:false,credentialsIssued:false});return json(409,{error:'provision_review_required',state:row.state,activationPerformed:false});}
  try{const result=await prepare(data.input,infra);await ledger.finish({contractId:raw.contractId,revision:data.revision,result});return json(201,{state:result.state,databaseId:result.databaseId,databaseName:result.databaseName,activationPerformed:false,credentialsIssued:false});}
  catch(e){try{await ledger.fail({contractId:raw.contractId,revision:data.revision,databaseId:e?.databaseId});}catch{}return json(409,{error:'provision_review_required',activationPerformed:false});}
 }};
}
export default createProvisionWorker();
