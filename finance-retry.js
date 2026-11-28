// Retain only an opaque fingerprint and operation UUID in this tab. Never store tokens or form fields.
export async function reserveFinanceOperation({storage,uid,path,payload,cryptoProvider=globalThis.crypto}){
 if(!uid||!['/api/finance/payment','/api/finance/expense'].includes(path))throw Error('Sesión financiera no válida.');
 const input=JSON.stringify([uid,path,Object.entries(payload).sort(([a],[b])=>a.localeCompare(b))]);
 const digest=await cryptoProvider.subtle.digest('SHA-256',new TextEncoder().encode(input));
 const key='nexora-finance-pending-v1:'+Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
 let id=storage.getItem(key);
 if(id!==null&&!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id))throw Error('Registro de reintento inválido. Verificá el historial.');
 if(!id){id=cryptoProvider.randomUUID();storage.setItem(key,id);if(storage.getItem(key)!==id)throw Error('No se pudo proteger el reintento.');}
 return {id,confirm(){if(storage.getItem(key)===id)storage.removeItem(key);}};
}
