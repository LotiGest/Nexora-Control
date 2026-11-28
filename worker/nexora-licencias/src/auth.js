/**
 * Firebase Auth ID-token verification for Cloudflare Workers.
 * NO Firebase Admin SDK, API key, service-account key or private credential is needed.
 * SecureToken's JWKS is public; signatures and issuer/audience are checked server-side.
 */
const JWKS_URL='https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const PROJECT_ID='nexora-control-717c6';
const GOOGLE_SIGN_IN='google.com';
const ADMITTED_EMAILS=new Set([
 'gerardotorres034@gmail.com',
 'danylopez614@gmail.com'
]);
let keysCache=null;
const base64url = value=>{
 if(typeof value!=='string'||!value||!/^[A-Za-z0-9_-]+$/.test(value)||value.length>16384)throw new AuthFailure(401,'Token no válido.');
 const padded=value.replace(/-/g,'+').replace(/_/g,'/');
 return Uint8Array.from(atob(padded+'='.repeat((4-padded.length%4)%4)),c=>c.charCodeAt(0));
};
const decodeJson = value=>JSON.parse(new TextDecoder().decode(base64url(value)));
export class AuthFailure extends Error {
 constructor(status,message){super(message);this.status=status}
}
function allowlistedUid(secret,uid){
 if(typeof secret!=='string'||!secret.trim())throw new AuthFailure(503,'Falta configurar los administradores autorizados.');
 return secret.split(',').map(x=>x.trim()).filter(Boolean).includes(uid);
}
async function publicSigningKey(kid,now,fetchKeys){
 if(keysCache&&keysCache.until>now&&keysCache.keys.has(kid))return keysCache.keys.get(kid);
 if(!keysCache||keysCache.until<=now){
  const response=await fetchKeys(JWKS_URL,{redirect:'manual',cache:'no-store'});
  if(response.status>=300&&response.status<400)throw new AuthFailure(503,'Redirección de claves Firebase no autorizada.');
  if(!response.ok)throw new AuthFailure(503,'No fue posible verificar las firmas de Firebase.');
  const json=await response.json();
  if(!Array.isArray(json.keys)||json.keys.length>12)throw new AuthFailure(503,'Claves de Firebase no disponibles.');
  const keys=new Map();
  for(const k of json.keys){
   if(k?.kty==='RSA'&&k?.alg==='RS256'&&k?.use==='sig'&&typeof k.kid==='string'
    &&typeof k.n==='string'&&typeof k.e==='string')keys.set(k.kid,k);
  }
  if(!keys.size)throw new AuthFailure(503,'Claves públicas no disponibles.');
  const maxAge=Number((response.headers.get('cache-control')||'').match(/max-age=(\d+)/)?.[1]||300);
  keysCache={keys,until:now+Math.max(30,Math.min(1800,Number.isFinite(maxAge)?maxAge:300))};
 }
 if(!keysCache.keys.has(kid))throw new AuthFailure(401,'Firma de Firebase no reconocida.');
 return keysCache.keys.get(kid);
}
export function firebaseProject(env={},requireQa=false){
 const mode=env.NEXORA_ENVIRONMENT;
 if(mode==='qa'){
  const id=env.NEXORA_FIREBASE_PROJECT_ID;
  if(typeof id!=='string'||! /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(id)||id===PROJECT_ID)throw new AuthFailure(503,'Firebase QA aislado no configurado.');
  return id;
 }
 if(requireQa||(mode!==undefined&&mode!=='production')||(env.NEXORA_FIREBASE_PROJECT_ID&&env.NEXORA_FIREBASE_PROJECT_ID!==PROJECT_ID))throw new AuthFailure(503,'Ambiente de autenticación no autorizado.');
 return PROJECT_ID;
}
export async function verifyFirebaseAdmin(header,env={},options={}){
 const project=firebaseProject(env);
 if(typeof header!=='string'||!header.startsWith('Bearer ')||header.length>10000)throw new AuthFailure(401,'Iniciá sesión con Google para continuar.');
 const token=header.slice(7).trim(),parts=token.split('.');
 if(parts.length!==3)throw new AuthFailure(401,'Token no válido.');
 let protectedHeader,claims;
 try{protectedHeader=decodeJson(parts[0]);claims=decodeJson(parts[1]);}
 catch{throw new AuthFailure(401,'Token no válido.')}
 if(protectedHeader?.alg!=='RS256'||typeof protectedHeader.kid!=='string'||protectedHeader.kid.length>128
  ||(protectedHeader.typ!==undefined&&protectedHeader.typ!=='JWT'))throw new AuthFailure(401,'Encabezado de autenticación inválido.');
 const now=Math.floor((options.now??Date.now())/1000);
 if(claims?.aud!==project||claims.iss!=='https://securetoken.google.com/'+project||
  typeof claims.sub!=='string'||claims.sub.length<1||claims.sub.length>128||
  !Number.isInteger(claims.exp)||claims.exp<=now||
  !Number.isInteger(claims.iat)||claims.iat>now+60||claims.iat<now-3660||
  !Number.isInteger(claims.auth_time)||claims.auth_time>now+60||
  claims.email_verified!==true||typeof claims.email!=='string'||
  claims.firebase?.sign_in_provider!==GOOGLE_SIGN_IN)throw new AuthFailure(401,'Sesión de Firebase no válida o vencida.');
 const publicKey=await publicSigningKey(protectedHeader.kid,now,options.fetchKeys??fetch);
 let ok=false;
 try{
  const key=await crypto.subtle.importKey('jwk',publicKey,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  ok=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,base64url(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1]));
 }catch{throw new AuthFailure(401,'No fue posible validar el token.')}
 if(!ok)throw new AuthFailure(401,'Firma de autenticación incorrecta.');
 if(!ADMITTED_EMAILS.has(claims.email.trim().toLowerCase())||
  !allowlistedUid(env.NEXORA_ADMIN_UIDS,claims.sub))throw new AuthFailure(403,'Cuenta sin autorización para administrar licencias.');
 return Object.freeze({uid:claims.sub,email:claims.email.trim().toLowerCase(),project});
}
