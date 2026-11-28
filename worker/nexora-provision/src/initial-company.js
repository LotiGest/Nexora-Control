import {normalizeCompany,readiness} from '../../../commercial-company-core.js';
import {isoDate} from '../../../commercial-billing-core.js';
// Only confirmed commercial metadata, no credentials, external logos, inventory or previous state.
export function initialCompanyState(raw,today){
 const c=normalizeCompany(raw);isoDate(today);
 if(c.product!=='LOTIGEST'||!/^qa-[a-z0-9-]{3,55}$/.test(c.clientKey)||!readiness(c).ready)throw Error('Ficha QA no válida.');
 return {version:3,created:today,company:{name:c.name,legalName:c.legalName,rtn:c.rtn,location:c.address,phone:c.companyPhone,email:c.email,documentBrandVersion:1},lots:[],clients:[],sales:[],payments:[],residences:[{id:'initial-project',name:'Primer proyecto',location:'',records:{},features:[]}],currentResidence:'initial-project'};
}
export function initialStateRows(state){
 const rows=[],shape={};for(const [k,v] of Object.entries(state)){shape[k]=Array.isArray(v)?v.length:-1;if(Array.isArray(v)){v.forEach((item,i)=>rows.push({key:JSON.stringify([k,i,0]),payload:JSON.stringify(item)}));}else rows.push({key:JSON.stringify([k,-1,0]),payload:JSON.stringify(v)});}
 rows.push({key:'$shape',payload:JSON.stringify(shape)});return rows.sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0);
}
