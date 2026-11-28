export const DEFAULT_PROJECTS=Object.freeze([
 Object.freeze({id:'siac',name:'SIAC',progress:90,stage:'testing',release:'',notes:'Estimación indicada por Nexora; falta confirmar el cierre clínico.',repo:'https://github.com/GjTorres12/SIAC'}),
 Object.freeze({id:'sindex',name:'SINDEX',progress:90,stage:'testing',release:'',notes:'Referencia histórica; pendiente de auditoría actual.',repo:'https://github.com/GjTorres12/SINDEX-v1.1-Pruebas'}),
 Object.freeze({id:'lotigest',name:'LotiGest Pro',progress:100,stage:'production',release:'1.0.58',notes:'Alcance comercial inicial publicado; 557/557 pruebas automatizadas al 27/11/2026. Soporte y multiempresa pendientes.',repo:'https://github.com/LotiGest/lotigest-demo'}),
 Object.freeze({id:'dvolada',name:'Dvolada',progress:85,stage:'testing',release:'',notes:'Estimación de Nexora; pendiente de validación de lanzamiento.',repo:'https://github.com/dvoladanexora/DVolada-3.0'})
]);
export const STAGES=Object.freeze({development:'Desarrollo',testing:'Pruebas',production:'Producción',maintenance:'Mantenimiento',paused:'Pausado'});
export function normalizeProject(id,input){if(!DEFAULT_PROJECTS.some(p=>p.id===id))throw Error('Proyecto no válido.');if(!Number.isInteger(input.progress)||input.progress<0||input.progress>100)throw Error('El avance debe ser un entero de 0 a 100.');if(!Object.hasOwn(STAGES,input.stage))throw Error('Estado no válido.');const release=String(input.release??'').trim(),notes=String(input.notes??'').trim();if(release.length>60||!notes||notes.length>500)throw Error('Indicá una nota de revisión de hasta 500 caracteres y una versión de hasta 60.');return {id,progress:input.progress,stage:input.stage,release,notes};}

// In-memory drafts only. A remote revision must never silently become the base
// of a local edit that was started against an older version.
export function projectDraftState(draft,record){
 const version=record?.version??0;
 if(!draft)return {state:'clean',version};
 return {state:draft.baseVersion===version?'editing':'conflict',version,values:draft.values};
}
