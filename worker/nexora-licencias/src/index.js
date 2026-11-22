import {verifyFirebaseAdmin,AuthFailure} from './auth.js';
import {readJsonLimited,previewProposal,ProposalError} from './proposal.js';
import {getSiacLicenseStatus,SiacStatusError} from './siac-status.js';
/**
 * Nexora Licencias: authenticated, read-only proposal validation.
 * Outbound credentials are Worker secrets. This Worker has no SIAC D1 binding.
 */
const ORIGIN='https://lotigest.github.io';
const HEADERS={
 'content-type':'application/json; charset=utf-8',
 'cache-control':'no-store, max-age=0, private',
 'x-content-type-options':'nosniff',
 'referrer-policy':'no-referrer',
 'cross-origin-resource-policy':'cross-origin',
 'content-security-policy':"default-src 'none'; frame-ancestors 'none'"
};
function reply(status,payload,origin){
 const headers={...HEADERS};
 if(origin===ORIGIN){headers['access-control-allow-origin']=ORIGIN;headers['access-control-allow-methods']='GET, POST, OPTIONS';headers['access-control-allow-headers']='authorization, content-type';headers['vary']='Origin'}
 return new Response(JSON.stringify(payload),{status,headers});
}
export function createLicenseWorker(verify=verifyFirebaseAdmin,fetchSiac=getSiacLicenseStatus){
 return {async fetch(request,env={}){
  const url=new URL(request.url),path=url.pathname,origin=request.headers.get('origin');
  const recognized=path==='/api/session'||path==='/api/licenses/preview'||path==='/api/licenses/status';
  if(request.method==='OPTIONS'){
   if(origin===ORIGIN&&recognized)return new Response(null,{status:204,headers:{
    'access-control-allow-origin':ORIGIN,
    'access-control-allow-methods':path==='/api/licenses/preview'?'POST, OPTIONS':'GET, OPTIONS',
    'access-control-allow-headers':'authorization, content-type',
    'access-control-max-age':'600','vary':'Origin','cache-control':'no-store'
   }});
   return reply(403,{error:'forbidden_origin'},origin);
  }
  if(path==='/health'){
   if(request.method!=='GET')return reply(405,{error:'method_not_allowed'},origin);
   return reply(200,{service:'nexora-licencias',ready:true,activationEnabled:false,
    authenticatedSessionEnabled:Boolean(env.NEXORA_ADMIN_UIDS),
    message:'Servidor de licencias listo. Activaciones de SIAC deshabilitadas.'},origin);
  }
  if(!path.startsWith('/api/'))return reply(404,{error:'not_found'},origin);
  if(origin&&origin!==ORIGIN)return reply(403,{error:'forbidden_origin'},origin);
  if(!env.NEXORA_ADMIN_UIDS)return reply(503,{error:'auth_not_configured',
   message:'Todavía no está configurada la lista de administradores.'},origin);
  if(!recognized)return reply(503,{error:'activation_not_configured',
   message:'Nexora Licencias no permite modificar ni leer licencias de SIAC.'},origin);
  if((path==='/api/session'||path==='/api/licenses/status')&&request.method!=='GET'||path==='/api/licenses/preview'&&request.method!=='POST')
   return reply(405,{error:'method_not_allowed'},origin);
  let admin;
  try{admin=await verify(request.headers.get('authorization'),env)}
  catch(err){
   if(err instanceof AuthFailure)return reply(err.status,{error:'authentication_failed',message:err.message},origin);
   return reply(503,{error:'verification_unavailable',message:'No se pudo verificar la sesión.'},origin);
  }
  if(path==='/api/session')return reply(200,{ok:true,admin:{uid:admin.uid,email:admin.email},
   activationEnabled:false,clinicConnection:false},origin);
  if(path==='/api/licenses/status'){
   const requestedOwner=url.searchParams.get('ownerKey')||'';
   if(!requestedOwner||requestedOwner!==env.NEXORA_SIAC_OWNER)return reply(403,{error:'owner_not_configured',
    message:'La instalación solicitada no está vinculada a este servidor.'},origin);
   try{return reply(200,await fetchSiac(env),origin)}
   catch(err){
    if(err instanceof SiacStatusError)return reply(err.status,{error:'siac_unavailable',category:err.category,message:err.message},origin);
    return reply(503,{error:'siac_unavailable',message:'No se pudo obtener una licencia verificada.'},origin);
   }
  }
  try{
   const input=await readJsonLimited(request);
   return reply(200,await previewProposal(input),origin);
  }catch(err){
   if(err instanceof ProposalError)return reply(err.status,{error:'invalid_proposal',message:err.message},origin);
   return reply(503,{error:'preview_unavailable',message:'No se pudo validar la propuesta.'},origin);
  }
 }};
}
export default createLicenseWorker();
