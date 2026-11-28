// QA authentication harness, not the full LotiGest application.
import {onRequest as session} from './session.js';
import {hash} from './shared.js';
import {createClaimHandler} from '../src/initial-access.js';
import {PAGE,CLIENT} from './page.js';
const claim=createClaimHandler();
const headers={'cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff','x-frame-options':'DENY','content-security-policy':"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"};
const json=(data,status=200)=>Response.json(data,{status,headers});
export async function verifiedIdentity(env){
 if(env.NEXORA_QA_BOOTSTRAP!=='enabled'||!/^qa-[a-z0-9-]{3,55}$/.test(env.LOTIGEST_INSTALLATION_ID??'')||!env.LOTIGEST_DB)return false;
 const row=await env.LOTIGEST_DB.prepare('SELECT installation_id,environment FROM nexora_installation_identity WHERE singleton=1').first();
 return row?.environment==='qa'&&row.installation_id===env.LOTIGEST_INSTALLATION_ID;
}
export default {async fetch(request,env){
 try{
 if(!await verifiedIdentity(env))return json({error:'installation_unverified'},503);
 const url=new URL(request.url),path=url.pathname;
 if(path==='/health'&&request.method==='GET')return json({ok:true,environment:'qa',installation:env.LOTIGEST_INSTALLATION_ID,scope:'authentication-only'});
 if(path==='/'&&request.method==='GET')return new Response(PAGE,{headers:{...headers,'content-type':'text/html; charset=utf-8'}});
 if(path==='/access.js'&&request.method==='GET')return new Response(CLIENT,{headers:{...headers,'content-type':'text/javascript; charset=utf-8'}});
 if(path==='/api/app/activate')return claim(request,env);
 if(path==='/api/app/session')return session({request,env});
 if(path==='/api/app/salt'&&request.method==='GET'){
 const username=url.searchParams.get('username')??'';if(!/^[a-z0-9][a-z0-9_-]{2,39}$/.test(username))return json({error:'invalid_user'},400);
 const row=await env.LOTIGEST_DB.prepare('SELECT salt FROM d1_user_passwords WHERE name=?').bind(username).first();
 return json({salt:row?.salt??await hash('lotigest-inactive-user:'+env.LOTIGEST_INSTALLATION_ID+':'+username)});
 }
 return json({error:'not_found'},404);
 }catch{return json({error:'qa_unavailable'},503);}
}};
