/**
 * Nexora Licencias - bootstrap Cloudflare Worker.
 * Strict separation from Lotigest Workers/D1. No credentials or D1 bindings.
 *
 * License writes are deliberately disabled until Nexora admin authentication,
 * per-installation SIAC authorization, idempotency and audit are implemented.
 */
const RESPONSE_HEADERS={
 'content-type':'application/json; charset=utf-8',
 'cache-control':'no-store, max-age=0',
 'x-content-type-options':'nosniff',
 'referrer-policy':'no-referrer',
 'cross-origin-resource-policy':'same-origin'
};
function json(status,body){return new Response(JSON.stringify(body),{status,headers:RESPONSE_HEADERS})}
export default {
 async fetch(request){
  const path=new URL(request.url).pathname;
  if(path==='/health'){
   if(request.method!=='GET')return json(405,{error:'method_not_allowed'});
   return json(200,{service:'nexora-licencias',ready:true,activationEnabled:false,
    message:'Servicio inicializado. Activaciones pendientes de autenticación segura.'});
  }
  if(path.startsWith('/api/')){
   return json(503,{error:'activation_not_configured',
    message:'Nexora Licencias todavía no permite consultar ni modificar licencias reales.'});
  }
  return json(404,{error:'not_found'});
 }
};
