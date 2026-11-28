// Cloudflare account-scoped QA adapter. Only newly created resources from this invocation are writable.
import {pinnedSchema} from './pinned-schema.js';
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
 async function query(db,sql){
  await assertNew(db);const r=(await request('/'+db+'/query','POST',{sql})).result;
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
  async apply(db,sql){if(!pinnedSchema.some(x=>x.sql===sql))throw Error('SQL no pertenece al esquema fijado.');await query(db,sql);}
 };
 return {adapter,schema:pinnedSchema,protectedIds,expectedAccount:id};
}
