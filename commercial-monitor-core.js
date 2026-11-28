import {isoDate} from './commercial-billing-core.js';
import {commercialLicenseStatus} from './commercial-entitlement-core.js';
import {trialStatus} from './commercial-trials-core.js';
const DAY=86400000;
const remaining=(date,today)=>(Date.parse(isoDate(date)+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/DAY;
export function commercialAlerts({contracts,licenses,trials,calendars,renewals,today}){
 isoDate(today);const result=[];
 for(const c of contracts){
  const id=c.id;if(c.status==='inactive')continue;
  const add=(kind,date,level)=>result.push({id,company:c.name,product:c.product,kind,date,level});
  try{const license=licenses.get(id);
  if(license){const state=commercialLicenseStatus(license,today),days=remaining(license.expiresOn,today);
   if(state==='expired'||state==='grace'||state==='suspended')add('license-'+state,license.expiresOn,state==='expired'||state==='suspended'?'critical':'warning');
   else if(state==='active'&&days<=7)add('license-expiring',license.expiresOn,'warning');
  }else if(c.status==='agreed'&&calendars.has(id))add('license-missing',null,'warning');}catch{add('license-invalid',null,'critical');}
  try{const trial=trials.get(id);if(trial&&!calendars.has(id)){const state=trialStatus(trial,today).state;if(state==='expired'||state==='expiring')add('trial-'+state,trial.endsOn,'warning');}}catch{add('trial-invalid',null,'critical');}
  try{const renewal=renewals.get(id);if(renewal?.state==='pending-review'){const days=remaining(renewal.effectiveOn,today);if(renewal.contractVersion!==c.version)add('renewal-stale',renewal.effectiveOn,'warning');else if(days<=7)add('renewal-review',renewal.effectiveOn,'warning');}}catch{add('renewal-invalid',null,'critical');}
 }
 return result.sort((a,b)=>(a.level==='critical'?0:1)-(b.level==='critical'?0:1)||(a.date||'9999').localeCompare(b.date||'9999')||a.id.localeCompare(b.id));
}
export function backupAssessment(backup,{installationId,databaseId,now,maxAgeHours=24}){
 if(!Number.isFinite(now)||!Number.isFinite(maxAgeHours)||maxAgeHours<=0)throw Error('Parámetros de respaldo no válidos.');
 if(!backup)return {state:'unknown',restoreVerified:false};
 if(backup.installationId!==installationId||backup.databaseId!==databaseId||backup.environment!=='qa')return {state:'identity-mismatch',restoreVerified:false};
 const time=Date.parse(backup.createdAt);
 if(!Number.isFinite(time)||time>now||backup.completed!==true)return {state:'unverified',restoreVerified:false};
 const restore=Date.parse(backup.restoreVerifiedAt);
 return {state:now-time>maxAgeHours*3600000?'stale':'recent',restoreVerified:backup.restoreVerified===true&&Number.isFinite(restore)&&restore>=time&&restore<=now};
}
export function usageAssessment({used,limit,period,metric}){
 if(!Number.isSafeInteger(used)||used<0||!Number.isSafeInteger(limit)||limit<=0||!period||!metric)return {state:'unknown',percent:null};
 const percent=used/limit*100;return {state:percent>=100?'exceeded':percent>=75?'warning':'normal',percent,period,metric};
}
