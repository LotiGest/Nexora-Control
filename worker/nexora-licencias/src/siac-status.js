/**
 * Read the commercial license from a separately hosted SIAC installation.
 * This module cannot write a license. All target endpoints and secrets
 * must come from Worker environment bindings, never from the web client.
 */
const VALID_OWNER=/^[a-z0-9][a-z0-9-]{2,79}$/;
const TIERS=new Set(['off','basic','full']);
export class SiacStatusError extends Error{
 constructor(status,message,category='siac_unavailable'){super(message);this.status=status;this.category=category}
}
const hex=arr=>Array.from(new Uint8Array(arr)).map(x=>x.toString(16).padStart(2,'0')).join('');
function readPrivateJwk(source){
 if(typeof source!=='string'||source.length>1300)throw new SiacStatusError(503,'Clave de firma Nexora no configurada.');
 let key;
 try{key=JSON.parse(source)}catch{throw new SiacStatusError(503,'Clave de firma Nexora inválida.')}
 if(key?.kty!=='EC'||key.crv!=='P-256'||
  typeof key.x!=='string'||typeof key.y!=='string'||typeof key.d!=='string'||
  ![key.x,key.y,key.d].every(x=>/^[a-zA-Z0-9_-]{43}$/.test(x)))
  throw new SiacStatusError(503,'Clave privada de Nexora no válida.');
 return {kty:'EC',crv:'P-256',x:key.x,y:key.y,d:key.d,ext:true,key_ops:['sign']};
}
function validExpiration(value){
 if(value===null)return true;
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const date=new Date(value+'T12:00:00Z');
 return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}
export function statusConfig(env={}){
 const owner=env.NEXORA_SIAC_OWNER,endpoint=env.NEXORA_SIAC_STATUS_URL;
 if(typeof owner!=='string'||!VALID_OWNER.test(owner)||
  typeof endpoint!=='string'||!endpoint.startsWith('https://'))
  throw new SiacStatusError(503,'El canal de SIAC todavía no está configurado.');
 let destination;
 try{destination=new URL(endpoint)}catch{throw new SiacStatusError(503,'Dirección SIAC incorrecta.')}
 if(destination.protocol!=='https:'||destination.username||destination.password||destination.port||
  destination.pathname!=='/api/internal/nexora-license'||destination.search||destination.hash||
  destination.hostname==='localhost'||!destination.hostname.includes('.'))
  throw new SiacStatusError(503,'Destino SIAC no válido.');
 const kid=env.NEXORA_SIAC_KEY_ID;
 if(typeof kid!=='string'||!/^[a-zA-Z0-9_-]{1,48}$/.test(kid))
  throw new SiacStatusError(503,'Identificador de clave Nexora no configurado.');
 // Never label an unverified QA response as a production license.
 const expectedEnvironment=env.NEXORA_SIAC_EXPECTED_ENVIRONMENT??'qa';
 if(!['qa','production'].includes(expectedEnvironment))
  throw new SiacStatusError(503,'Entorno SIAC de destino no válido.');
 const accessId=env.NEXORA_SIAC_ACCESS_CLIENT_ID,accessSecret=env.NEXORA_SIAC_ACCESS_CLIENT_SECRET;
 if((accessId!==undefined||accessSecret!==undefined)&&
    (![accessId,accessSecret].every(value=>typeof value==='string'&&/^[\x21-\x7e]{1,512}$/.test(value))))
  throw new SiacStatusError(503,'Credenciales de Cloudflare Access incompletas.','access_not_configured');
 if(destination.hostname==='siac-staging.nexorasystems.workers.dev'&&(expectedEnvironment!=='qa'||!accessId))
  throw new SiacStatusError(503,'Staging requiere un token de servicio y un destino QA.','access_not_configured');
 return {owner,endpoint:destination.href,origin:destination.origin,kid,expectedEnvironment,accessId,accessSecret,
  privateJwk:readPrivateJwk(env.NEXORA_SIAC_PRIVATE_JWK)};
}
export async function getSiacLicenseStatus(env={},fetchImpl=fetch,now=Date.now()){
 const settings=statusConfig(env);
 const timestamp=Math.floor(now/1000),nonce=crypto.randomUUID();
 const signed=['siac-license-v1','GET',settings.origin,'/api/internal/nexora-license',
  settings.kid,String(timestamp),nonce].join('\n');
 const key=await crypto.subtle.importKey('jwk',settings.privateJwk,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
 const signature=hex(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,new TextEncoder().encode(signed)));
 let response;
 try{
  response=await fetchImpl(settings.endpoint,{method:'GET',headers:{
   'x-nexora-key-id':settings.kid,'x-nexora-timestamp':String(timestamp),'x-nexora-nonce':nonce,
   'x-nexora-signature':signature,'accept':'application/json',
   ...(settings.accessId?{'CF-Access-Client-Id':settings.accessId,'CF-Access-Client-Secret':settings.accessSecret}:{})
  },redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(5000)});
 }catch{throw new SiacStatusError(502,'No fue posible consultar SIAC de manera segura.')}
 if(response.status>=300&&response.status<400)throw new SiacStatusError(502,'Cloudflare Access no admitió la consulta directa.','upstream_redirect');
 if(!response.ok)throw new SiacStatusError(502,'SIAC no confirmó la consulta.','upstream_http_'+response.status);
 const type=response.headers.get('content-type')||'';
 if(!type.toLowerCase().includes('application/json'))throw new SiacStatusError(502,'Respuesta de SIAC inesperada.');
 let data;
 try{data=await response.json()}catch{throw new SiacStatusError(502,'Respuesta de SIAC no válida.')}
 const tier=data?.license?.laboratory,contracted=data?.license?.contractedLaboratory;
 if(data?.owner!==settings.owner||data?.readOnly!==true||!TIERS.has(tier)||!TIERS.has(contracted)||
  typeof data?.license?.expired!=='boolean'||!validExpiration(data?.license?.expiresOn)||
  !['legacy','nexora'].includes(data.license.source)||
  (data.license.expired?tier!=='off'||data.license.expiresOn===null:tier!==contracted)||
  !['qa','production'].includes(data.environment)||data.environment!==settings.expectedEnvironment)
  throw new SiacStatusError(502,'SIAC devolvió una licencia que no corresponde a esta instalación.');
 const license={laboratory:tier,contractedLaboratory:contracted,
  expiresOn:data.license.expiresOn??null,expired:data.license.expired,
  source:data.license.source==='nexora'?'nexora':'legacy'};
 // The SIAC v1 endpoint does not return readAt: this is the Nexora observation time.
 return {ok:true,ownerKey:settings.owner,license,verifiedAt:new Date(now).toISOString(),
  source:data.environment==='production'?'siac_live':'siac_qa',environment:data.environment,
  readOnly:true,activationEnabled:false};
}
