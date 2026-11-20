/**
 * Read the commercial license from a separately hosted SIAC installation.
 * This module cannot write a license. All target endpoints and secrets
 * must come from Worker environment bindings, never from the web client.
 */
const VALID_OWNER=/^[a-z0-9][a-z0-9-]{2,79}$/;
const TIERS=new Set(['off','basic','full']);
export class SiacStatusError extends Error{
 constructor(status,message){super(message);this.status=status}
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
 return {owner,endpoint:destination.href,privateJwk:readPrivateJwk(env.NEXORA_SIAC_PRIVATE_JWK)};
}
export async function getSiacLicenseStatus(env={},fetchImpl=fetch,now=Date.now()){
 const settings=statusConfig(env);
 const timestamp=Math.floor(now/1000),nonce=crypto.randomUUID();
 const signed='GET\n/api/internal/nexora-license\n'+timestamp+'\n'+nonce;
 const key=await crypto.subtle.importKey('jwk',settings.privateJwk,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
 const signature=hex(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,new TextEncoder().encode(signed)));
 let response;
 try{
  response=await fetchImpl(settings.endpoint,{method:'GET',headers:{
   'x-nexora-timestamp':String(timestamp),'x-nexora-nonce':nonce,
   'x-nexora-signature':signature,'accept':'application/json'
  },redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(5000)});
 }catch{throw new SiacStatusError(502,'No fue posible consultar SIAC de manera segura.')}
 if(response.status>=300&&response.status<400)throw new SiacStatusError(502,'SIAC devolvió una redirección no autorizada.');
 if(!response.ok)throw new SiacStatusError(502,'SIAC no confirmó la consulta.');
 const type=response.headers.get('content-type')||'';
 if(!type.toLowerCase().includes('application/json'))throw new SiacStatusError(502,'Respuesta de SIAC inesperada.');
 let data;
 try{data=await response.json()}catch{throw new SiacStatusError(502,'Respuesta de SIAC no válida.')}
 const tier=data?.license?.laboratory,contracted=data?.license?.contractedLaboratory;
 if(data?.owner!==settings.owner||data?.readOnly!==true||!TIERS.has(tier)||!TIERS.has(contracted)||
  typeof data?.license?.expired!=='boolean'||typeof data.readAt!=='string'||
  !['qa','production'].includes(data.environment))
  throw new SiacStatusError(502,'SIAC devolvió una licencia que no corresponde a esta instalación.');
 const license={laboratory:tier,contractedLaboratory:contracted,
  expiresOn:data.license.expiresOn??null,expired:data.license.expired,
  source:data.license.source==='nexora'?'nexora':'legacy'};
 return {ok:true,ownerKey:settings.owner,license,verifiedAt:data.readAt,
  source:data.environment==='production'?'siac_live':'siac_qa',environment:data.environment,
  readOnly:true,activationEnabled:false};
}
