import {collection,doc,getDoc,query,orderBy,limit,onSnapshot,serverTimestamp,writeBatch} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import {normalizeClient,normalizeLicense,labelTier,licenseReviewStatus,generateSiacLicenseSql} from './license-core.js';

/** Only call start() after Firebase Auth verifies an approved Nexora administrator. */
export function mountLicenses({auth,db}){
 const $=id=>document.getElementById(id);
 const clientForm=$('license-client-form'),draftForm=$('license-draft-form');
 const clientList=$('license-clients-list'),details=$('license-editor');
 const eventsList=$('license-events-list');
 if(!clientForm||!draftForm||!clientList||!details||!eventsList)throw Error('No está disponible el panel de licencias.');
 let clients=[],licenses=[],events=[],selected='',subscriptions=[],active=false,busy=false,editorOwner='',lastLicenseSignature='',draftDirty=false,generation=0;
 const msg=(text,error=false)=>{const el=$('licenses-status');el.textContent=text;el.dataset.error=error?'true':'false'};
 const element=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e};
 const label=()=>clients.find(c=>c.ownerKey===selected);
 const current=()=>licenses.find(x=>x.ownerKey===selected&&x.module==='laboratory');
 function renderClients(){
  clientList.replaceChildren();
  const filter=$('license-filter').value.trim().toLocaleLowerCase('es-HN');
  const rows=clients.filter(c=>!filter||(c.name+' '+c.ownerKey).toLocaleLowerCase('es-HN').includes(filter));
  if(!rows.length){clientList.append(element('p','muted',clients.length?'No hay coincidencias.':'No hay clientes guardados todavía.'));return}
  for(const c of rows){
   const button=element('button','license-client'+(c.ownerKey===selected?' selected':''));
   button.type='button';button.setAttribute('aria-pressed',String(c.ownerKey===selected));
   button.append(element('strong','',c.name),element('small','',c.ownerKey));
   const record=licenses.find(l=>l.ownerKey===c.ownerKey&&l.module==='laboratory');
   button.append(element('span','license-client-state',record?labelTier(record.tier)+' · '+(record.status==='verified'?'Confirmada manualmente':'Borrador'):'Sin plan'));
   button.addEventListener('click',()=>selectClient(c.ownerKey));clientList.append(button);
  }
 }
 function renderSelection(){
  const customer=label(),license=current();
  $('license-selection-placeholder').hidden=!!customer;
  details.hidden=!customer;
  if(!customer){editorOwner='';lastLicenseSignature='';draftDirty=false;return}
  const changedOwner=editorOwner!==selected;
  const signature=JSON.stringify([license?.tier,license?.expiresOn,license?.contractRef,license?.status,license?.evidenceRef]);
  const changedLicense=signature!==lastLicenseSignature;
  if(changedOwner){editorOwner=selected;draftDirty=false;}
  if(changedLicense)lastLicenseSignature=signature;
  $('license-client-name').textContent=customer.name;
  $('license-client-owner').textContent=customer.ownerKey;
  $('license-state').textContent=licenseReviewStatus(license);
  $('license-state').dataset.status=license?.status||'empty';
  if(changedOwner||changedLicense&&!draftDirty){
   $('license-plan').value=license?.tier||'basic';
   $('license-expires').value=license?.expiresOn||'';
   $('license-contract').value=license?.contractRef||'';
  }
  if(changedOwner||changedLicense){
   $('license-verification').value='';
   $('license-sql-preview').hidden=true;
   $('license-sql-preview').textContent='';
  }
  $('license-verify').disabled=!license||license.status==='verified';
  $('license-verify').title=license?.status==='verified'?'Guardá una nueva propuesta para cambiar el plan.':'';
  $('license-current-evidence').textContent=license?.status==='verified'?'Referencia de verificación externa: '+(license.evidenceRef||'Sin referencia'):'Ningún cambio en SIAC ha sido comprobado desde este panel.';
 }
 function selectClient(ownerKey){selected=ownerKey;renderClients();renderSelection()}
 function renderEvents(){
  eventsList.replaceChildren();
  if(!events.length){eventsList.append(element('p','muted','No hay cambios registrados.'));return}
  for(const event of events.slice(0,15)){
   const card=element('article','license-audit-item');
   const name=clients.find(c=>c.ownerKey===event.ownerKey)?.name||event.ownerKey;
   const when=event.at?.toDate?.();
   card.append(element('strong','',name+' · '+(event.action==='verified'?'Aplicación confirmada manualmente':'Propuesta guardada')));
   card.append(element('small','',labelTier(event.tier)+' · '+(when?when.toLocaleString('es-HN'):'Fecha pendiente de sincronización')));
   if(event.reference)card.append(element('small','',event.reference));
   eventsList.append(card);
  }
 }
 async function commitWithAudit(license,action,reference=''){
  const user=auth.currentUser;
  if(!active||!user)throw Error('Iniciá sesión nuevamente para continuar.');
  const batch=writeBatch(db);
  const data={...license,status:action==='verified'?'verified':'draft',evidenceRef:action==='verified'?reference:'',updatedBy:user.uid,updatedAt:serverTimestamp()};
  if(action==='verified'){data.verifiedAt=serverTimestamp();data.verifiedBy=user.uid;}
  else{data.verifiedAt=null;data.verifiedBy='';}
  batch.set(doc(db,'nexoraLicenses',license.ownerKey+'-laboratory'),data);
  batch.set(doc(collection(db,'nexoraLicenseEvents')),{ownerKey:license.ownerKey,product:'SIAC',module:'laboratory',action,tier:license.tier,expiresOn:license.expiresOn,reference,actorUid:user.uid,at:serverTimestamp()});
  await batch.commit();
 }
 clientForm.addEventListener('submit',async event=>{
  event.preventDefault();if(!active||busy)return;
  try{
   const client=normalizeClient({name:$('license-new-client').value,ownerKey:$('license-new-owner').value});
   busy=true;clientForm.querySelector('[type="submit"]').disabled=true;
   const target=doc(db,'nexoraClients',client.ownerKey);
   if((await getDoc(target)).exists())throw Error('Ese identificador ya tiene una ficha. Seleccionala de la lista.');
   const batch=writeBatch(db);batch.set(target,{...client,createdBy:auth.currentUser.uid,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});await batch.commit();
   selected=client.ownerKey;clientForm.reset();msg('Cliente creado y sincronizado. Ahora elegí su plan de Laboratorio.');
  }catch(e){msg('No se pudo guardar el cliente: '+(e.code==='permission-denied'?'Firestore denegó el acceso. Revisá las reglas de seguridad.':e.message),true)}
  finally{busy=false;clientForm.querySelector('[type="submit"]').disabled=false}
 });
 draftForm.addEventListener('input',()=>{draftDirty=true});
 draftForm.addEventListener('submit',async event=>{
  event.preventDefault();if(!active||busy||!label())return;
  try{
   const license=normalizeLicense({ownerKey:selected,tier:$('license-plan').value,expiresOn:$('license-expires').value,contractRef:$('license-contract').value});
   busy=true;draftForm.querySelector('[type="submit"]').disabled=true;
   await commitWithAudit(license,'draft');draftDirty=false;
   msg('Propuesta guardada en Nexora Control. NO está aplicada en la base SIAC.');
  }catch(e){msg('No se pudo guardar la propuesta: '+(e.code==='permission-denied'?'Firestore denegó la escritura. Revisá las reglas.':e.message),true)}
  finally{busy=false;draftForm.querySelector('[type="submit"]').disabled=false}
 });
 $('license-copy-sql').addEventListener('click',async()=>{
  if(!active||!label())return;
  try{
   const draft=current();
   if(!draft||draftDirty||draft.tier!==$('license-plan').value||draft.expiresOn!==($('license-expires').value||null))throw Error('Guardá primero la propuesta para generar el SQL correspondiente.');
   const sql=generateSiacLicenseSql(draft);
   $('license-sql-preview').textContent=sql;$('license-sql-preview').hidden=false;
   await navigator.clipboard.writeText(sql);
   msg('SQL copiado. Revisalo antes de aplicarlo manualmente en el D1 correcto; copiarlo NO activa SIAC.');
  }catch(e){msg('Revisá los datos antes de copiar. '+(e.message||'Podés seleccionar el SQL que aparece en pantalla.'),true)}
 });
 $('license-verify').addEventListener('click',async()=>{
  if(!active||busy||!label())return;
  const original=current(),reference=$('license-verification').value.trim();
  if(!original||original.status==='verified'||draftDirty){msg('Guardá primero la propuesta y sus cambios antes de confirmar.',true);return}
  if(reference.length<8||reference.length>140){msg('Ingresá una referencia de verificación (8 a 140 caracteres), por ejemplo un identificador de operación D1.',true);return}
  if(!confirm('Confirmá únicamente si verificaste en la base D1 de SIAC que el cambio se aplicó exactamente con esos valores. Nexora Control NO realiza esta comprobación automáticamente. ¿Registrar confirmación manual?'))return;
  try{
   busy=true;$('license-verify').disabled=true;
   const {status,evidenceRef,updatedBy,updatedAt,verifiedAt,verifiedBy,...data}=original;
   await commitWithAudit(normalizeLicense(data),'verified',reference);
   msg('Verificación MANUAL registrada. El panel no comprueba automáticamente la licencia real en SIAC.');
  }catch(e){msg('No se pudo registrar la verificación: '+(e.message||e.code),true)}
  finally{busy=false;$('license-verify').disabled=false}
 });
 $('license-filter').addEventListener('input',renderClients);
 function stop(){
  active=false;for(const unsubscribe of subscriptions)unsubscribe();subscriptions=[];
  generation++;clients=[];licenses=[];events=[];selected='';editorOwner='';lastLicenseSignature='';draftDirty=false;
  renderClients();renderSelection();renderEvents();
  $('license-new-client').value='';$('license-new-owner').value='';
  $('license-filter').value='';msg('Iniciá sesión con Google para consultar clientes y planes.');
 }
 function start(){
  if(active)return;
  active=true;const thisGeneration=++generation;msg('Sincronizando clientes, licencias y auditoría desde Firestore…');
  const streams=[
   {name:'clientes',collection:'nexoraClients',update:docs=>{clients=docs.map(x=>x.data());renderClients();renderSelection()}},
   {name:'licencias',collection:'nexoraLicenses',update:docs=>{licenses=docs.map(x=>x.data());renderClients();renderSelection()}},
   {name:'auditoría',collection:'nexoraLicenseEvents',update:docs=>{events=docs.map(x=>x.data());renderEvents()}}
  ];
  for(const stream of streams){
   const field=stream.collection==='nexoraLicenseEvents'?'at':'updatedAt';
   subscriptions.push(onSnapshot(query(collection(db,stream.collection),orderBy(field,'desc'),limit(150)),snap=>{
    if(!active||generation!==thisGeneration)return;stream.update(snap.docs);msg('Datos sincronizados. Las propuestas de licencias NO activan SIAC automáticamente.');
   },err=>{if(active&&generation===thisGeneration)msg('No se pudieron cargar '+stream.name+' ('+(err.code||'error')+'). Revisá las reglas Firestore.',true)}));
  }
 }
 return {start,stop};
}
