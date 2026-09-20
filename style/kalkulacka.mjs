// A-109. No requests, persistence or tracking of the visitor's financial inputs.
export function vypocet({produkt,count,before=null,after=null,rate=null}){
 if(!['proof','renewals','efaktura'].includes(produkt))throw Error('product');
 if(!Number.isInteger(count)||count<0||count>10000)throw Error('count');
 for(const [v,max] of [[before,1440],[after,1440],[rate,10000]])if(v!==null&&(!Number.isFinite(v)||v<0||v>max))throw Error('input');
 const jednotlivo=produkt==='efaktura'?count*290:null;
 const cena=produkt==='efaktura'?Math.min(jednotlivo,count===0?0:990):count>100?null:0;
 const hours=before===null||after===null?null:count*(before-after)/60;
 return {cena,jednotlivo,plan:produkt==='efaktura'?(count>=4?'30dni':'jedna'):'pilot',hours,value:hours===null||rate===null?null:hours*rate};
}
const copy={
 sk:{blank:'Doplňte oba časy',optional:'Doplňte hodinovú hodnotu',invalid:'Skontrolujte čísla. Počet musí byť celé číslo 0 až 10 000, časy 0 až 1 440 minút a hodinová hodnota 0 až 10 000 €.',over:'Mimo rozsahu pilotu',overNote:'Nad 100 položiek treba dohodnúť rozsah. Cena zatiaľ nie je stanovená.',pilot:'Bezplatný pilot do limitu 100 položiek, podľa voľnej kapacity.',one:'Jednotlivé stiahnutia',pass:'Prístup na 30 dní',versus:'Jednotlivo by to bolo',vat:'bez DPH',empty:'Bez položiek, bez nákupu.',hour:'h'},
 cs:{blank:'Doplňte oba časy',optional:'Doplňte hodinovou hodnotu',invalid:'Zkontrolujte čísla. Počet musí být celé číslo 0 až 10 000, časy 0 až 1 440 minut a hodinová hodnota 0 až 10 000 €.',one:'Jednotlivá stažení',pass:'Přístup na 30 dní',versus:'Jednotlivě by to bylo',vat:'bez DPH',empty:'Bez položek, bez nákupu.',hour:'h'},
 en:{blank:'Enter both times',optional:'Enter an hourly value',invalid:'Check the numbers. Quantity must be an integer from 0 to 10,000, times from 0 to 1,440 minutes and hourly value from €0 to €10,000.',over:'Outside the pilot scope',overNote:'Above 100 items, contact us about the scope. No price has been set.',pilot:'Free pilot up to 100 items, subject to capacity.',one:'Individual downloads',pass:'30-day access',versus:'Individual total would be',vat:'excl. VAT',empty:'No items, no purchase.',hour:'h'},
 de:{blank:'Beide Zeiten eingeben',optional:'Stundenwert eingeben',invalid:'Zahlen prüfen: Anzahl ganzzahlig 0 bis 10.000, Zeiten 0 bis 1.440 Minuten, Stundenwert 0 bis 10.000 €.',over:'Außerhalb des Pilotumfangs',overNote:'Über 100 Vorgänge: Umfang bitte mit uns abstimmen. Es ist noch kein Preis festgelegt.',pilot:'Kostenloser Pilot bis 100 Vorgänge, je nach Kapazität.',one:'Einzelne Downloads',pass:'Zugang für 30 Tage',versus:'Einzeln wären es',vat:'zzgl. MwSt.',empty:'Keine Vorgänge, kein Kauf.',hour:'Std.'}
};
if(typeof document!=='undefined')for(const root of document.querySelectorAll('[data-calculator]')){
 const lang=root.dataset.lang,t=copy[lang]||copy.en,format=new Intl.NumberFormat(lang,{maximumFractionDigits:2}),money=new Intl.NumberFormat(lang,{style:'currency',currency:'EUR'});
 const set=(key,s)=>root.querySelector(`[data-result="${key}"]`).textContent=s;
 function update(){
  try{const values={};for(const input of root.querySelectorAll('input')){if(input.validity.badInput||!input.checkValidity())throw Error('input');values[input.name]=input.value===''?null:input.valueAsNumber;}
   const r=vypocet({produkt:root.dataset.calculator,...values});set('error','');
   set('price',r.cena===null?t.over:money.format(r.cena/100)+(root.dataset.calculator==='efaktura'?' '+t.vat:''));
   set('price-detail',r.cena===null?t.overNote:values.count===0?t.empty:root.dataset.calculator==='efaktura'?(r.plan==='30dni'?`${t.pass}. ${t.versus} ${money.format(r.jednotlivo/100)} ${t.vat}.`:t.one):t.pilot);
   set('time',r.hours===null?t.blank:`${format.format(r.hours)} ${t.hour}`);set('value',r.value===null?t.optional:money.format(r.value));
  }catch{for(const k of ['price','price-detail','time','value'])set(k,'');set('error',t.invalid);}
 }
 root.addEventListener('input',update);update();
}
