import {verifyFirebaseAdmin,AuthFailure} from './auth.js';
/**
 * Nexora Licencias: read-only authorization entrypoint.
 * No Lotigest D1 bindings, no SIAC credentials, no production writes.
 * A real activation endpoint will be added only after SIAC supports an
 * isolated authenticated service API, idempotency and auditable approval.
 */
const ORIGIN='https://lotigest.github.io';
const BASE_HEADERS={
 'content-type':'application/json; charset=utf-8',
 'cache-control':'no-store, max-age=0, private',
 'x-content-type-options':'nosniff',
 'referrer-policy':'no-referrer',
 'cross-origin-resource-policy':'cross-origin',
 'content-security-policy':"default-src 'none'; frame-ancestors 'none'"
};
const response=(code,obj,origin)=>new Response(JSON.stringify(obj),{status:code,headers:{
 ...BASE_HEADERS,...(origin===ORIGIN?{
 'access-control-allow-origin':ORIGIN,
 'access-control-allow-methods':'GET, OPTIONS',
 'access-control-allow-headers':'authorization, content-type',
 'access-control-max-age':'600',
 'vary':'Origin'
 }:{}),
}});
export default {
 async fetch(request,env={}){
  const url=new URL(request.url),path=url.pathname,origin=request.headers.get('origin');
  if(request.method==='OPTIONS'){
   if(origin===ORIGIN&&path.startsWith('/api/'))return new Response(null,{status:204,headers:{
    'access-control-allow-origin':ORIGIN,'access-control-allow-methods':'GET, OPTIONS',
    'access-control-allow-headers':'authorization, content-type','access-control-max-age':'600',
    'vary':'Origin','cache-control':'no-store'
   }});
   return response(403,{error:'forbidden_origin'},origin);
  }
  if(path==='/health'){
   if(request.method!=='GET')return response(405,{error:'method_not_allowed'},origin);
   return response(200,{service:'nexora-licencias',ready:true,activationEnabled:false,
    authenticatedSessionEnabled:Boolean(env.NEXORA_ADMIN_UIDS),
    message:'API de licencias preparada; la activación en SIAC no está habilitada.'},origin);
  }
  if(!path.startsWith('/api/'))return response(404,{error:'not_found'},origin);
  if(origin&&origin!==ORIGIN)return response(403,{error:'forbidden_origin'},origin);
  if(!env.NEXORA_ADMIN_UIDS)return response(503,{error:'auth_not_configured',
   message:'La autorización de Nexora todavía no está configurada.'},origin);
  if(request.method==='GET'&&path==='/api/session'){
   try{
    const admin=await verifyFirebaseAdmin(request.headers.get('authorization'),env);
    return response(200,{ok:true,admin:{uid:admin.uid,email:admin.email},
     activationEnabled:false,clinicConnection:false},origin);
   }catch(e){
    if(e instanceof AuthFailure)return response(e.status,{error:'authentication_failed',message:e.message},origin);
    return response(503,{error:'verification_unavailable',message:'No se pudo verificar la sesión.'},origin);
   }
  }
  return response(503,{error:'activation_not_configured',
   message:'Nexora Licencias no permite modificar ni leer licencias de SIAC hasta completar el enlace seguro.'},origin);
 }
};
