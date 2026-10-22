// Návrat zo Stripe na Stráž e-shopu (relácia 209, 22. 10. 2026; PRODUKT.md časť 3). Externý modul starej stránky správy
// /feed-doctor/monitor/, aby sa nemenil vložený skript stránky ani jeho logika.
// 1) ?paid=1 bez id a key (Payment Link vracia sem): prečíta localStorage 'straz:navrat' (nie starší ako 24 h)
//    a presmeruje na /straz-eshopu/<jazyk>/?id=&key=&paid=1 (zachová test=1).
// 2) id a key v adrese a monitor s plánom pro alebo zo Stráže: presmeruje na stránku Stráže.
// 3) Klik na odkaz upgrade (a[href^="https://buy.stripe.com/"]) uloží 'straz:navrat' pre bod 1.
// 4) Kotva #zmazat (GET /v1/monitors/:id/delete z e-mailu presmeruje sem): posun na tlačidlo zmazania, zvýraznenie a fokus;
//    pri presmerovaní na stránku Stráže kotva ostane (kolo 1 opráv, 22. 10. 2026).
// Id a kľúč sa pred uložením aj pred presmerovaním overia regexom; iný tvar sa zahodí. Čistá logika je exportovaná
// a testovaná v products/arling-sk/straz-eshopu/app.test.mjs.
export const API='https://feed-monitor.arling.workers.dev';
export const NAVRAT_KLUC='straz:navrat';
export const MAX_VEK=24*60*60*1000;
export const ID_RE=/^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|m_[0-9]{10,16}_[a-z0-9]{1,12})$/;
export const KEY_RE=/^[0-9a-f]{64}$/;
const JAZYKY=['sk','en','de'];
const platne=(id,key)=>typeof id==='string'&&typeof key==='string'&&ID_RE.test(id)&&KEY_RE.test(key);

export function adresaStraze(lang,id,key,{paid=false,test=false}={}){
  const l=JAZYKY.includes(lang)?lang:'en',q=new URLSearchParams({id,key});
  if(paid)q.set('paid','1');if(test)q.set('test','1');
  return '/straz-eshopu/'+(l==='sk'?'':l+'/')+'?'+q.toString();
}
/** Záznam 'straz:navrat' alebo null (zlý JSON, zlý tvar, starší ako 24 h, z budúcnosti). */
export function precitajNavrat(raw,now=Date.now()){
  if(typeof raw!=='string'||raw.length>1000)return null;
  try{
    const x=JSON.parse(raw);if(!x||typeof x!=='object'||!platne(x.id,x.key))return null;
    const at=Date.parse(x.at);if(!Number.isFinite(at)||now-at>MAX_VEK||at-now>5*60*1000)return null;
    return {id:x.id,key:x.key,lang:JAZYKY.includes(x.lang)?x.lang:'en'};
  }catch{return null;}
}
/** Hodnota pre localStorage pri kliku na upgrade alebo null pri zlom tvare id či kľúča. */
export function zaznamNavratu(id,key,lang,now=new Date()){
  if(!platne(id,key))return null;
  return JSON.stringify({id,key,lang:JAZYKY.includes(lang)?lang:'en',at:now.toISOString()});
}
/** Bod 1: cieľ presmerovania pri ?paid=1 bez id a key (ukážka ?demo=1 sa nepresmeruje). */
export function cielPoPlatbe(search,raw,now=Date.now()){
  const p=new URLSearchParams(search);
  if(p.get('paid')!=='1'||p.has('id')||p.has('key')||p.get('demo')==='1')return null;
  const n=precitajNavrat(raw,now);
  return n?adresaStraze(n.lang,n.id,n.key,{paid:true,test:p.get('test')==='1'}):null;
}
/** Bod 2: cieľ pre monitor so stavom z GET /v1/monitors/:id (plán pro alebo zdroj straz), inak null.
 * Kotva #zmazat (odkaz z e-mailu cez GET /delete) ostane, aby stránka Stráže otvorila otázku na zmazanie; iná kotva nie. */
export function cielPreMonitor(search,data,hash=''){
  const p=new URLSearchParams(search),id=p.get('id'),key=p.get('key');
  if(!platne(id,key)||!data||typeof data!=='object'||data.id!==id)return null;
  if(data.plan!=='pro'&&data.source!=='straz')return null;
  return adresaStraze(data.lang,id,key,{paid:p.get('paid')==='1',test:p.get('test')==='1'})+(hash===ZMAZAT?ZMAZAT:'');
}
export const ZMAZAT='#zmazat';
export const ZMAZAT_LIMIT=15000;
/**
 * Bod 4: pri #zmazat (bezplatný monitor, odkaz „zastaviť e-maily“ z e-mailu) posunie stránku na tlačidlo zmazania,
 * zvýrazní ho (trieda navrat-ciel) a dá mu fokus. Tlačidlo kreslí vložený modul až po načítaní monitora, preto sa naň čaká
 * cez MutationObserver najviac `limit` ms. Vráti Promise<boolean>: true, keď sa tlačidlo našlo. Nikdy nevyhodí výnimku.
 */
export function pripravZmazanie(doc,{MO=globalThis.MutationObserver,limit=ZMAZAT_LIMIT,casovac=setTimeout}={}){
  return new Promise(resolve=>{
    let hotovo=false,mo=null;
    const koniec=v=>{if(hotovo)return;hotovo=true;try{mo&&mo.disconnect();}catch{}resolve(v);};
    const skus=()=>{
      try{
        const b=doc.getElementById('delete-btn');if(!b)return false;
        b.classList.add('navrat-ciel');const riadok=b.closest?b.closest('.delete-row'):null;if(riadok)riadok.classList.add('navrat-ciel');
        try{b.scrollIntoView({block:'center'});}catch{}
        try{b.focus({preventScroll:true});}catch{}
        return true;
      }catch{return false;}
    };
    if(skus()){koniec(true);return;}
    try{if(typeof MO==='function'){mo=new MO(()=>{if(skus())koniec(true);});mo.observe(doc.body||doc,{childList:true,subtree:true});}}catch{}
    casovac(()=>koniec(skus()),limit);
  });
}

function spusti(){
  const search=location.search;let raw=null;
  try{raw=localStorage.getItem(NAVRAT_KLUC);}catch{}
  const ciel=cielPoPlatbe(search,raw);
  if(ciel){location.replace(ciel);return;}
  const p=new URLSearchParams(search),id=p.get('id'),key=p.get('key');
  if(!platne(id,key))return;
  let jazykMonitora='en';
  const hash=location.hash;
  if(hash===ZMAZAT)pripravZmazanie(document);
  // Jedna požiadavka, bez opakovania; chyba nič nemení (stará stránka ostane, ako bola).
  fetch(`${API}/v1/monitors/${encodeURIComponent(id)}?key=${encodeURIComponent(key)}`,{credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer'})
    .then(r=>r.ok?r.json():null)
    .then(d=>{if(d&&JAZYKY.includes(d.lang))jazykMonitora=d.lang;const c=cielPreMonitor(search,d,hash);if(c)location.replace(c);})
    .catch(()=>{});
  document.addEventListener('click',e=>{
    const a=e.target instanceof Element?e.target.closest('a[href^="https://buy.stripe.com/"]'):null;if(!a)return;
    const z=zaznamNavratu(id,key,jazykMonitora);if(z)try{localStorage.setItem(NAVRAT_KLUC,z);}catch{}
  },true);
}
if(typeof window!=='undefined'&&typeof document!=='undefined'&&typeof location!=='undefined')spusti();
