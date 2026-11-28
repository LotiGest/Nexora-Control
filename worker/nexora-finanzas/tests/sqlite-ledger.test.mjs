import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {DatabaseSync} from 'node:sqlite';
const schema=readFileSync(new URL('../migrations/0001_finance.sql',import.meta.url),'utf8');
test('migración crea libro aislado y bloquea doble abono, modificaciones y recibos huérfanos',()=>{
 const db=new DatabaseSync(':memory:');db.exec(schema);db.exec('PRAGMA foreign_keys=ON');
 db.prepare('INSERT INTO charges(contract_id,charge_id,product,company,due_date,kind,amount_cents) VALUES(?,?,?,?,?,?,?)').run('LOTIGEST__qa-demo','base__0','LOTIGEST','Empresa ficticia','2026-01-01','initial',1000);
 const insert=db.prepare('INSERT INTO payments(id,contract_id,charge_id,amount_cents,paid_on,reference,recorded_by) VALUES(?,?,?,?,?,?,?)');
 insert.run('p1','LOTIGEST__qa-demo','base__0',600,'2026-01-01','ficticia','admin-test');
 assert.throws(()=>insert.run('p2','LOTIGEST__qa-demo','base__0',500,'2026-01-01','ficticia','admin-test'));
 assert.equal(db.prepare('SELECT paid_cents FROM charges').get().paid_cents,600);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM payments').get().n,1);
 assert.throws(()=>db.exec("UPDATE payments SET amount_cents=1 WHERE id='p1'"));
 assert.throws(()=>db.exec("DELETE FROM payments WHERE id='p1'"));
 assert.throws(()=>insert.run('p3','LOTIGEST__qa-demo','unknown__0',100,'2026-01-01','ficticia','admin-test'));
 db.close();
});
