// Private QA journal; one operation per installation, no automatic replay after an uncertain write.
const digest=/^[a-f0-9]{64}$/,id=/^LOTIGEST__qa-[a-z0-9-]{3,55}$/,uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function provisionJournal(db){
 if(!db)throw Error('Journal required');
 return {
 async claim({contractId,revision,uid}){
  if(!id.test(contractId)||!digest.test(revision)||typeof uid!=='string'||!uid||uid.length>128)throw Error('Invalid operation');
  const res=await db.prepare("INSERT INTO provision_operations(contract_id,revision,requested_by,state) VALUES(?,?,?,'running') ON CONFLICT(contract_id) DO NOTHING").bind(contractId,revision,uid).run();
  const row=await db.prepare("SELECT contract_id AS contractId,revision,state,database_id AS databaseId,database_name AS databaseName FROM provision_operations WHERE contract_id=?").bind(contractId).first();
  if(!row)throw Error('Missing operation');
  return {claimed:res.meta.changes===1,row};
 },
 async finish({contractId,revision,result}){
  if(result?.state!=='schema-ready'||!uuid.test(result.databaseId??'')||typeof result.databaseName!=='string'||result.databaseName!=='lotigest-'+contractId.slice(10).replaceAll('-','_'))throw Error('Invalid infrastructure result');
  const r=await db.prepare("UPDATE provision_operations SET state='schema-ready',database_id=?,database_name=?,finished_at=CURRENT_TIMESTAMP WHERE contract_id=? AND revision=? AND state='running'").bind(result.databaseId,result.databaseName,contractId,revision).run();
  if(r.meta.changes!==1)throw Error('Operation state changed');
 },
 async fail({contractId,revision,databaseId}){
  await db.prepare("UPDATE provision_operations SET state='review-required',database_id=?,finished_at=CURRENT_TIMESTAMP WHERE contract_id=? AND revision=? AND state='running'").bind(uuid.test(databaseId??'')?databaseId:null,contractId,revision).run();
 }
 };
}
