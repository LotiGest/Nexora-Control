import {checkedCents,formatMoney} from './commercial-core.js';
import {isoDate} from './commercial-billing-core.js';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function receiptDetails(row){
 const payment=typeof row.contractId==='string';
 if(!uuid.test(row.id)||!checkedCents(row.amountCents)||!String(row.reference??'').trim())throw Error('Comprobante no válido.');
 const receipt=(payment?'NX-':'NXG-')+row.id;
 if(row.receipt&&row.receipt!==receipt)throw Error('Identificador de recibo inconsistente.');
 const fields=[['Número',receipt],['Fecha',isoDate(row.date)],['Importe',formatMoney(row.amountCents)],['Referencia',String(row.reference)]];
 if(payment){fields.push(['Empresa',String(row.company||row.contractId)],['Contrato',row.contractId],['Cuota',String(row.chargeId)]);}
 else fields.push(['Categoría',String(row.category)]);
 return {receipt,title:payment?'RECIBO DE ABONO':'COMPROBANTE DE GASTO',fields};
}
// Standard PDF Type 1 font with WinAnsi. Unsupported characters are replaced visibly.
function literal(value){
 return '('+Array.from(String(value).normalize('NFC'),c=>{
  let n=c.codePointAt(0);
  if(n===0x2022)n=149;else if(n===0x2013)n=150;else if(n===0x2014)n=151;else if(n===0x20ac)n=128;else if(n<32||n>255||(n>=127&&n<=159))n=63;
  if(n===40||n===41||n===92||n>=127)return '\\'+n.toString(8).padStart(3,'0');
  return String.fromCharCode(n);
 }).join('')+')';
}
function wrap(value,width=65){const out=[];let s=String(value).replace(/\s+/g,' ').trim();while(s.length>width){let i=s.lastIndexOf(' ',width);if(i<1)i=width;out.push(s.slice(0,i));s=s.slice(i).trimStart();}out.push(s);return out;}
export function buildReceiptPdf(row){
 const data=receiptDetails(row),lines=[];
 const text=(x,y,size,value,bold=false)=>lines.push('BT /'+(bold?'F2':'F1')+' '+size+' Tf 1 0 0 1 '+x+' '+y+' Tm '+literal(value)+' Tj ET');
 lines.push('0.07 0.15 0.26 rg 0 700 595 142 re f','1 1 1 rg');
 text(42,785,23,'NEXORA SYSTEMS',true);text(42,751,14,data.title,true);text(42,725,10,'Administración empresarial');
 lines.push('0.07 0.15 0.26 rg');let y=662;
 for(const [label,value] of data.fields){text(42,y,10,label.toUpperCase(),true);y-=18;for(const line of wrap(value)){text(42,y,12,line);y-=17;}y-=15;}
 lines.push('0.75 0.80 0.85 RG 42 108 m 553 108 l S');text(42,86,10,'Registro administrativo. No sustituye una factura fiscal.');
 text(42,69,9,'Conservar para conciliación y control interno.');
 const stream=lines.join('\n')+'\n';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>','<< /Length '+stream.length+' >>\nstream\n'+stream+'endstream'];
 let pdf='%PDF-1.4\n',offsets=[0];objects.forEach((o,i)=>{offsets.push(pdf.length);pdf+=(i+1)+' 0 obj\n'+o+'\nendobj\n';});const xref=pdf.length;
 pdf+='xref\n0 '+offsets.length+'\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size '+offsets.length+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';
 return new TextEncoder().encode(pdf);
}
