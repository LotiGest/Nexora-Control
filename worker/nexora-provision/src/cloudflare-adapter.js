// Cloudflare account-scoped QA adapter. Only newly created resources from this invocation are writable.
import {pinnedSchema} from './pinned-schema.js';
import {initializationSql} from './initialization-schema.js';
import {licensePeriod} from '../../../commercial-entitlement-core.js';
const account=/^[a-f0-9]{32}$/,uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const namePattern=/^lotigest-qa_[a-z0-9_]{3,55}$/;
export function createCloudflareQaInfrastructure(env,{fetcher=fetch}={}){
 const id=env.NEXORA_QA_CF_ACCOUNT_ID,token=env.NEXORA_QA_CF_TOKEN,protectedIds=new Set(String(env.NEXORA_QA_PROTECTED_D1_IDS??'').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean));
 if(env.NEXORA_ENVIRONMENT!=='qa'||env.NEXORA_QA_PROVISION!=='enabled'||!account.test(id??'')||typeof token!=='string'||!token||!protectedIds.size||[...protectedIds].some(v=>!uuid.test(v)))throw Error('Cloudflare QA no configurado.');
 const root='https://api.cloudflare.com/client/v4/accounts/'+id+'/d1/database',created=new Map();
 async function request(path,method='GET',body){
  const response=await fetcher(root+path,{method,headers:{authorization:'Bearer '+token,...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),redirect:'manual',cache:'no-store'});
  if(!response.ok)throw Error('Cloudflare QA no confirmó la operación.');
  const data=await response.json();if(data.success!==true)throw Error('Cloudflare QA rechazó la operación.');return data;
 }
 async function list(){
  const all=[];for(let page=1;page<=100;page++){
   const d=await request('?page='+page+'&per_page=100');
   if(!Array.isArray(d.result))throw Error('Inventario incompleto.');
   all.push(...d.result.map(x=>({uuid:x.uuid,name:x.name})));
   if(d.result.length<100)return all;
  }throw Error('Inventario excede límite seguro.');
 }
 async function assertNew(db){
  const name=created.get(db);if(!name||protectedIds.has(db.toLowerCase()))throw Error('D1 fuera del ámbito nuevo QA.');
  const d=(await request('/'+db)).result;
  if(d?.uuid!==db||d.name!==name)throw Error('Identidad D1 no confirmada.');
 }
 async function query(db,sql,params){
  await assertNew(db);const r=(await request('/'+db+'/query','POST',{sql,...(params?{params}: {})})).result;
  if(!Array.isArray(r)||!r.length||r.some(x=>x.success!==true))throw Error('Consulta D1 QA no confirmada.');return r;
 }
 const adapter={accountId:id,environment:'qa',list,
  async create(name){
   if(!namePattern.test(name))throw Error('Nombre no autorizado.');
   const before=await list();if(before.some(x=>x.name===name))throw Error('Nombre ocupado.');
   const d=(await request('','POST',{name})).result;
   if(!uuid.test(d?.uuid??'')||d.name!==name||protectedIds.has(d.uuid.toLowerCase())||before.some(x=>x.uuid.toLowerCase()===d.uuid.toLowerCase()))throw Error('Recurso nuevo no confirmado.');
   created.set(d.uuid,name);return {uuid:d.uuid,name};
  },
  async inspect(db){
   const tables=(await query(db,"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'"))[0].results.map(x=>x.name);
   if(!tables.length)return {tables:0,users:0,clients:0,sessions:0};
   if(!['users','clients','app_sessions'].every(x=>tables.includes(x)))throw Error('Esquema parcial.');
   const c=(await query(db,'SELECT (SELECT count(*) FROM users) users,(SELECT count(*) FROM clients) clients,(SELECT count(*) FROM app_sessions) sessions'))[0].results[0];
   return {tables:tables.length,...c};
  },
  async apply(db,sql){if(!pinnedSchema.some(x=>x.sql===sql))throw Error('SQL no pertenece al esquema fijado.');await query(db,sql);},
  async initialize(db,e){
   await assertNew(db);const name=created.get(db);const days=(Date.parse(e.graceUntil)-Date.parse(e.expiresOn))/86400000;const period=licensePeriod(e.startsOn,e.expiresOn,days);
   if(!/^qa-[a-z0-9-]{3,55}$/.test(e.installationId)||name!=='lotigest-'+e.installationId.replaceAll('-','_')||e.contractId!=='LOTIGEST__'+e.installationId||!Number.isSafeInteger(e.licenseVersion)||e.licenseVersion<1||!Number.isSafeInteger(e.contractVersion)||e.contractVersion<1||e.state!=='issued'||period.graceUntil!==e.graceUntil||!['promocion','profesional','empresarial','corporativo'].includes(e.planCode))throw Error('Licencia inicial QA no válida.');
   const counts=await adapter.inspect(db);if(counts.tables<33||counts.users!==0||counts.clients!==0||counts.sessions!==0)throw Error('Instalación QA no vacía.');
   for(const sql of initializationSql)await query(db,sql);
   await query(db,"INSERT INTO nexora_installation_identity(singleton,installation_id,environment) VALUES(1,?,'qa')",[e.installationId]);
   await query(db,'INSERT INTO nexora_qa_entitlement(installation_id,contract_id,license_version,contract_version,plan_code,state,starts_on,expires_on,grace_until) VALUES(?,?,?,?,?,?,?,?,?)',[e.installationId,e.contractId,String(e.licenseVersion),String(e.contractVersion),e.planCode,e.state,e.startsOn,e.expiresOn,e.graceUntil]);
   const row=(await query(db,'SELECT installation_id,contract_id,license_version,contract_version,plan_code,state,starts_on,expires_on,grace_until FROM nexora_qa_entitlement'))[0].results;
   if(row.length!==1||JSON.stringify([row[0].installation_id,row[0].contract_id,row[0].license_version,row[0].contract_version,row[0].plan_code,row[0].state,row[0].starts_on,row[0].expires_on,row[0].grace_until])!==JSON.stringify([e.installationId,e.contractId,e.licenseVersion,e.contractVersion,e.planCode,e.state,e.startsOn,e.expiresOn,e.graceUntil]))throw Error('Licencia inicial QA no confirmada.');
  }
 };
 return {adapter,schema:pinnedSchema,protectedIds,expectedAccount:id};
}
