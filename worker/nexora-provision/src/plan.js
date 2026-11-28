// Pure installation plan. No Cloudflare API or customer database is called here.
import {key,product} from '../../../commercial-core.js';
export function installationPlan(input){
 const p=product(input.product);if(p!=='LOTIGEST')throw Error('La primera plantilla de instalación solo admite LotiGest Pro.');
 const slug=key(input.slug);if(input.fictitious!==true||!/^qa-[a-z0-9-]{3,55}$/.test(slug))throw Error('La primera instalación debe ser ficticia y usar prefijo qa-.');
 const name=String(input.name||'').trim();if(!name||name.length>100)throw Error('Nombre no válido.');
 const modules=input.modules;if(!Array.isArray(modules)||modules.some(x=>typeof x!=='string'||!/^[-a-z0-9]{2,50}$/.test(x))||new Set(modules).size!==modules.length)throw Error('Módulos no válidos.');
 const databaseName='lotigest-'+slug.replaceAll('-','_');
 return Object.freeze({product:p,slug,name,databaseName,environment:'qa',modules:[...modules],steps:[
  'Crear D1 exclusiva '+databaseName,
  'Aplicar esquema LotiGest Pro probado a esa D1',
  'Configurar identidad y módulos en la instalación QA',
  'Crear invitación de administrador de un solo uso mediante servidor',
  'Verificar inicio de sesión, aislamiento y URL de QA',
  'Registrar identificador D1, URL y contrato en Nexora Control'
 ]});
}
