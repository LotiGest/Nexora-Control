// Read-only candidate. Registry is injected by the trusted server, never by the browser.
// No Cloudflare credentials, account enumeration, writes, or customer database reads here.
const qaId=/^qa-[a-z0-9-]{3,55}$/;
const release=/^[0-9a-f]{40}$/;
function validateTarget(t){
 if(!t||t.environment!=='qa'||!qaId.test(t.id)||!release.test(t.releaseSha))throw Error('Instalación QA no autorizada.');
 const u=new URL(t.origin);if(u.protocol!=='https:'||u.username||u.password||u.port||u.pathname!=='/'||u.search||u.hash||!u.hostname.endsWith('.workers.dev'))throw Error('Origen QA no permitido.');
 return u.origin;
}
export async function probeInstallation(id,{registry,fetcher=fetch,clock=Date.now,timeoutMs=5000}){
 if(!(registry instanceof Map)||!registry.has(id))throw Error('Instalación no registrada.');
 const target=registry.get(id),origin=validateTarget(target);if(target.id!==id)throw Error('Identidad de registro inconsistente.');
 const started=clock(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),Math.min(10000,Math.max(1,timeoutMs)));
 const result=(state,extra={})=>({installationId:id,environment:'qa',state,checkedAt:new Date(clock()).toISOString(),latencyMs:Math.max(0,clock()-started),...extra});
 try{
  const res=await fetcher(origin+'/health',{method:'GET',redirect:'manual',cache:'no-store',signal:controller.signal,headers:{accept:'application/json'}});
  if(!res.ok)return result('unavailable',{httpStatus:res.status});
  if(!res.headers.get('content-type')?.includes('application/json')||!res.body)return result('unverified');
  const reader=res.body.getReader(),decoder=new TextDecoder();let size=0,raw='';
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();return result('unverified');}raw+=decoder.decode(value,{stream:true});}
  const data=JSON.parse(raw+decoder.decode());
  if(data.ok!==true||data.environment!=='qa'||data.installation!==id)return result('identity-mismatch');
  if(data.scope!=='full-product')return result('limited-scope',{scope:'authentication-only'});
  if(data.releaseSha!==target.releaseSha)return result('version-mismatch');
  return result('reachable',{scope:'full-product',releaseSha:target.releaseSha});
 }catch{return result(controller.signal.aborted?'timeout':'unavailable');}finally{clearTimeout(timer);}
}
