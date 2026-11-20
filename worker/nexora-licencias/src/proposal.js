/**
 * Pure, strict validation of a SIAC licensing proposal.
 * This module does not connect to databases and cannot activate any license.
 */
const tiers=new Set(['off','basic','full']);
const ownerPattern=/^[a-z0-9][a-z0-9-]{2,79}$/;
const requestPattern=/^[a-zA-Z0-9_-]{16,80}$/;
export class ProposalError extends Error{
 constructor(message){super(message);this.status=400}
}
function validDay(s){
 if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
 const date=new Date(s+'T12:00:00Z');
 return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===s;
}
export function validateProposal(data){
 if(data===null||typeof data!=='object'||Array.isArray(data))throw new ProposalError('La propuesta debe ser un objeto JSON.');
 const keys=Object.keys(data),allowed=['ownerKey','tier','expiresOn','requestId'];
 if(keys.some(k=>!allowed.includes(k))||keys.length!==allowed.length||!allowed.every(k=>Object.hasOwn(data,k)))throw new ProposalError('La propuesta contiene campos desconocidos o incompletos.');
 if(typeof data.ownerKey!=='string'||!ownerPattern.test(data.ownerKey))throw new ProposalError('Identificador de clínica no válido.');
 if(typeof data.tier!=='string'||!tiers.has(data.tier))throw new ProposalError('Plan de laboratorio no válido.');
 if(data.expiresOn!==null&&!validDay(data.expiresOn))throw new ProposalError('Vencimiento no válido.');
 if(typeof data.requestId!=='string'||!requestPattern.test(data.requestId))throw new ProposalError('Identificador de solicitud no válido.');
 return Object.freeze({ownerKey:data.ownerKey,tier:data.tier,expiresOn:data.expiresOn,requestId:data.requestId});
}
export async function readJsonLimited(request,maxBytes=4096){
 if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw new ProposalError('Usá Content-Type: application/json.');
 if(Number(request.headers.get('content-length'))>maxBytes)throw new ProposalError('La propuesta supera el tamaño permitido.');
 if(!request.body)throw new ProposalError('La propuesta está vacía.');
 const reader=request.body.getReader();
 let chunks=[],length=0;
 try{
  while(true){
   const {value,done}=await reader.read();
   if(done)break;
   length+=value.byteLength;
   if(length>maxBytes)throw new ProposalError('La propuesta supera el tamaño permitido.');
   chunks.push(value);
  }
 }catch(err){await reader.cancel().catch(()=>{});throw err}
 const bytes=new Uint8Array(length);let position=0;
 for(const chunk of chunks){bytes.set(chunk,position);position+=chunk.byteLength}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))}
 catch{throw new ProposalError('JSON incorrecto.')}
}
export async function previewProposal(data){
 const proposal=validateProposal(data);
 const bytes=new TextEncoder().encode(JSON.stringify({version:1,owner:proposal.ownerKey,laboratory:proposal.tier,expiresOn:proposal.expiresOn}));
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
 return {ok:true,requestId:proposal.requestId,ownerKey:proposal.ownerKey,tier:proposal.tier,expiresOn:proposal.expiresOn,revisionDigest:digest,
  status:'validated_not_applied',activationEnabled:false,
  message:'Propuesta validada para revisión. No modifica la licencia de SIAC.'};
}
