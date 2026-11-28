import {normalizeCatalog,catalogId} from './commercial-core.js';
const rate=(product,code,name,kind,initial,fee,cadence='monthly',enabled=true)=>Object.freeze(normalizeCatalog({product,code,name,kind,initialCents:initial*100,feeCents:fee*100,cadence,cycles:0,enabled}));
export const REFERENCE_RATES=Object.freeze([
 rate('SIAC','consultorio','SIAC Consultorio','plan',4500,1200),
 rate('SIAC','profesional','SIAC Profesional','plan',9000,2500),
 rate('SIAC','integral','SIAC Integral (todos los módulos)','plan',14000,4500),
 rate('SIAC','lab-basic','Laboratorio Básico (incluido)','module',0,0),
 rate('SIAC','lab-plus','Lab Plus (incluye Lab Connect)','module',3000,1200),
 rate('SIAC','lab-connect','SIAC Lab Connect (gratis con Lab Plus)','module',0,0),
 rate('SIAC','imagenologia','Imagenología','module',1500,500),
 rate('SIAC','hospitalizacion','Hospitalización','module',3000,1500),
 rate('LOTIGEST','promocion','Promoción primeros clientes','plan',5000,2000),
 rate('LOTIGEST','profesional','LotiGest Profesional','plan',7500,2500),
 rate('LOTIGEST','empresarial','LotiGest Empresarial','plan',12000,4000),
 rate('LOTIGEST','corporativo','LotiGest Corporativo (desde)','plan',20000,6000),
 rate('DVOLADA','restaurante','Restaurante (primer mes de cuota gratis)','plan',1500,500),
 rate('DVOLADA','repartidor','Repartidor (primer mes sin comisión)','plan',0,5,'delivery'),
 rate('DVOLADA','cliente','Cliente (sin comisión de plataforma)','plan',0,0),
 rate('DVOLADA','carrusel-7','Carrusel 7 días','module',150,0,'once',false),
 rate('DVOLADA','carrusel-15','Carrusel 15 días','module',250,0,'once',false),
 rate('DVOLADA','carrusel-30','Publicidad 30 días','module',400,0,'once',false),
 rate('DVOLADA','destacado','Restaurante destacado 30 días','module',600,0,'once',false),
 rate('DVOLADA','campana','Campaña especial (desde)','module',1000,0,'once',false)
]);
export function missingRates(existing){const ids=new Set(existing.map(r=>catalogId(r.product,r.code)));return REFERENCE_RATES.filter(r=>!ids.has(catalogId(r.product,r.code)));}
