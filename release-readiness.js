// Read-only acceptance evaluator. Evidence must come from authorized QA reviewers.
// Even a complete report cannot publish or approve production by itself.
const sha=/^[0-9a-f]{40}$/;
export const ACCEPTANCE_CHECKS=Object.freeze([
 ['audit1','Auditoría inicial y regresión completa'],
 ['firebase','Firebase QA independiente; dos administradores reales y tercero denegado'],
 ['finance','Cobros, recibos, cierres y conciliación en QA remoto'],
 ['renewal','Renovación efectiva sin alterar anticipos ni obligaciones anteriores'],
 ['licenses','Aplicación y verificación de licencias en producto'],
 ['existing','Vinculación no destructiva de instalación ficticia existente'],
 ['provision','Dos instalaciones completas con recursos exclusivos'],
 ['delivery','Entrega segura y aceptación de cliente ficticio'],
 ['monitor','Salud, consumo y alertas con fuentes verificadas'],
 ['restore','Respaldo y restauración de una instalación sin afectar otra'],
 ['devices','Pruebas de navegador Android, iPhone y PC'],
 ['audit2','Auditoría final y revisión de seguridad']
].map(Object.freeze));
export function evaluateAcceptance({candidateSha,evidence=[]}){
 if(!sha.test(candidateSha??'')||!Array.isArray(evidence))throw Error('Candidato o evidencia no válida.');
 const allowed=new Set(ACCEPTANCE_CHECKS.map(([id])=>id)),records=new Map();
 for(const e of evidence){if(!e||!allowed.has(e.id)||records.has(e.id))throw Error('Evidencia desconocida o duplicada.');records.set(e.id,e);}
 const checks=ACCEPTANCE_CHECKS.map(([id,label])=>{
  const e=records.get(id);let state='pending';
  if(e){if(e.candidateSha!==candidateSha)state='stale';else if(e.environment!=='qa'||e.scope!=='real-qa')state='unverified';else if(e.result==='fail')state='failed';else if(e.result==='pass'&&typeof e.reference==='string'&&e.reference.trim().length>=8&&e.reference.length<=250&&typeof e.checkedAt==='string'&&Number.isFinite(Date.parse(e.checkedAt)))state='verified';else state='unverified';}
  return {id,label,state};
 });
 const verified=checks.filter(c=>c.state==='verified').length;
 return {candidateSha,checks,verified,total:checks.length,state:verified===checks.length?'ready-for-manual-qa-review':'blocked',productionAuthorized:false,activationPerformed:false};
}
