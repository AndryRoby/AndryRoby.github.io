/*
 * Čakacia listina na Agentic Product Check Pro (A-189, 20. 10. 2026): verejná kontrola obchodu, výsledok kontroly a kalendár
 * povinností e-shopu. Existujúci zoznam ARLing (POST https://api.arling.workers.dev/subscribe/api/subscribe, služba
 * products/subscribe-service, zásady časť 3 „E-mailový zoznam“): ukladá len e-mail, zdroj, jazyk a dátum. Zdroj je pevný
 * (agent-ready-pro). Umami ar_pro_waitlist nesie len jazyk, miesto a to, či obchod ukázal znaky Shopify (yes, no, unknown);
 * nikdy adresu. Pri zápise sa nič neposiela e-mailom.
 *
 * AGENTS.md bod 12 (brána A-189 pokus 1, nález 1): naraz beží jeden dopyt; počas neho je pole adresy len na čítanie, takže
 * odpoveď vždy patrí k adrese v poli; každý dopyt má poradové číslo a odpoveď, ktorá nepatrí poslednému, sa zahodí; dopyt má
 * časový limit (deps.timeoutMs), po ňom sa formulár odomkne s vetou, že server neodpovedal včas (dopyt mohol prísť, preto nie
 * „adresa sa neodoslala“, brána pokus 2, na vedomie 2). 409 (adresa už v zozname) je úspech, služba je
 * idempotentná. Pri chybe adresa ostane vo formulári a nič sa neukáže ako hotové. Testy: cakacia.test.mjs.
 *
 * Pravdivosť po schválení (nález 10): veta „appka čaká na posúdenie“ ostane len, kým /agent-ready/stranka.json nehovorí live;
 * pri live sa formulár skryje a ukáže sa odkaz na appku (prechod.mjs createAppPageCheck, pri chybe ostane stav „čaká“).
 * Bez vložených skriptov a štýlov (CSP script-src 'self'); texty sa vkladajú cez textContent.
 */
import {EU_UI} from './i18n.mjs?v=4';

export const SOURCE='agent-ready-pro';
// Odkaz na appku po schválení nesie miesto (result, sample, page, calendar) v utm_medium, aby meranie rozlíšilo, odkiaľ prechod prišiel
// (brána pokus 2, na vedomie 4). Adresa bez utm_medium ostane, ako je.
export const sMiestom=(url,place)=>{try{const u=new URL(url);if(u.searchParams.has('utm_medium')&&/^[a-z]{2,12}$/.test(place))u.searchParams.set('utm_medium',place);return u.href;}catch{return url;}};
const lokalne=typeof location!=='undefined'&&['127.0.0.1','localhost'].includes(location.hostname);
export const ENDPOINT=(lokalne?location.origin+'/subscribe':'https://api.arling.workers.dev/subscribe')+'/api/subscribe';
const JAZYKY=['en','sk','de'],PLATFORMY=['yes','no','unknown'];
const jazykStranky=()=>{const l=String(document.documentElement.lang||'en').slice(0,2).toLowerCase();return JAZYKY.includes(l)?l:'en';};
// Závislosti, ktoré testy nahradia (fetch, časovače, stav appky, meranie).
export const deps={
  fetch:(url,init)=>fetch(url,init),
  setTimeout:(f,ms)=>setTimeout(f,ms),
  clearTimeout:(t)=>clearTimeout(t),
  timeoutMs:15000,
  appState:null, // Promise<{live:boolean,url:string}> | null; prvé volanie appLive() ju vytvorí
  track:(name,data)=>{if(typeof location!=='undefined'&&new URLSearchParams(location.search).has('test'))return;try{window.umami?.track(name,data);}catch{}},
};
/** Je appka v Shopify App Store? Číta /agent-ready/stranka.json cez prechod.mjs; chyba alebo pomalá odpoveď = nie (ostane „čaká“). */
export function appLive(){
  if(!deps.appState)deps.appState=import('./prechod.mjs').then(async m=>({live:await m.createAppPageCheck()(),url:m.APP_URL}),()=>({live:false,url:''}));
  return deps.appState;
}
function el(tag,text,cls){const e=document.createElement(tag);if(text!=null)e.textContent=String(text);if(cls)e.className=cls;return e;}
let pocitadlo=0;

/** Čakacia listina ako DOM (do výsledku kontroly obchodu so znakmi Shopify). Statické stránky majú to isté v HTML (postav.mjs). */
export function buildWaitlist(lang=jazykStranky(),place='result',shopify='unknown'){
  const t=(EU_UI[lang]||EU_UI.en).pro,id='ar-pro-'+(++pocitadlo);
  const box=el('section',null,'ar-pro-cakacia');box.setAttribute('aria-labelledby',id+'-nadpis');box.dataset.proSekcia='';
  const h=el('h3',t.title);h.id=id+'-nadpis';
  const cakanie=el('p',t.waiting);cakanie.dataset.proCakanie='';
  const live=el('p',t.live+' ');live.dataset.proLive='';live.hidden=true;const odkaz=el('a',t.liveLink);odkaz.href='/agent-ready/';live.append(odkaz);
  const cena=el('p',null,'ar-pro-cena');cena.append(el('strong',t.price),' ',el('span',t.priceNote));
  const form=el('form',null,'ar-pro-form');form.dataset.arPro='';form.dataset.place=place;form.dataset.jazyk=lang;form.dataset.shopify=PLATFORMY.includes(shopify)?shopify:'unknown';form.noValidate=true;form.hidden=true;
  const label=el('label',t.label);label.htmlFor=id+'-email';
  const input=el('input',null,'ar-pro-pole');Object.assign(input,{id:id+'-email',name:'email',type:'email',autocomplete:'email',inputMode:'email',spellcheck:false,required:true,maxLength:254});
  input.setAttribute('aria-describedby',id+'-suhlas');
  const suhlas=el('p',t.consent,'ar-pro-suhlas');suhlas.id=id+'-suhlas';
  const tlacidlo=el('button',t.button,'ar-quiet ar-pro-tlacidlo');tlacidlo.type='submit';
  const chyba=el('p',null,'ar-pro-chyba');chyba.dataset.proChyba='';chyba.setAttribute('role','alert');chyba.hidden=true;
  const spravca=el('p',t.controller+' ','ar-muted ar-pro-spravca');const z=el('a',t.privacy[0]);z.href=t.privacy[1];spravca.append(z);
  const pasca=el('div',null,'ar-pro-pasca');pasca.setAttribute('aria-hidden','true');const pl=el('label','Website');pl.htmlFor=id+'-web';
  const pi=el('input');Object.assign(pi,{id:id+'-web',name:'website',type:'text',tabIndex:-1,autocomplete:'off'});pasca.append(pl,pi);
  form.append(label,input,suhlas,tlacidlo,chyba,spravca,pasca);
  const hotovo=el('div',null,'ar-pro-hotovo');hotovo.dataset.proStav='';hotovo.setAttribute('role','status');hotovo.hidden=true;
  const hh=el('p',t.success,'ar-pro-hotovo-nadpis');hh.tabIndex=-1;hotovo.append(hh,el('p',t.successNote,'ar-muted'));
  box.append(h,el('p',t.text),cakanie,live,cena,form,hotovo);
  wire(form);
  return box;
}
/** Vo výsledku obchodu bez znakov Shopify: veta namiesto formulára (Pro je appka pre Shopify, nález 9b). */
export function buildNote(lang=jazykStranky()){
  const t=(EU_UI[lang]||EU_UI.en).pro,box=el('section',null,'ar-pro-cakacia ar-pro-poznamka');
  box.append(el('h3',t.title),el('p',t.noShopify));
  return box;
}

/** Zapojí formulár [data-ar-pro]; druhé volanie na ten istý formulár nič nerobí. */
export function wire(form){
  if(!form||form.dataset.wired)return;
  const lang=JAZYKY.includes(form.dataset.jazyk)?form.dataset.jazyk:jazykStranky(),place=form.dataset.place||'page',t=(EU_UI[lang]||EU_UI.en).pro;
  const shopify=PLATFORMY.includes(form.dataset.shopify)?form.dataset.shopify:'unknown';
  const sekcia=form.closest('[data-pro-sekcia]')||form.parentNode;
  const email=form.querySelector('input[type="email"]'),pasca=form.querySelector('input[name="website"]'),tlacidlo=form.querySelector('button[type="submit"]');
  const chyba=form.querySelector('[data-pro-chyba]'),stav=sekcia.querySelector('[data-pro-stav]');
  if(!email||!tlacidlo||!chyba||!stav)return;
  form.dataset.wired='1';form.hidden=false; // bez JavaScriptu formulár ostane skrytý a stránka ukáže vetu v <noscript>
  const povodny=tlacidlo.textContent;let bezi=false,verzia=0;
  const ukazChybu=text=>{chyba.textContent=text;chyba.hidden=false;email.setAttribute('aria-invalid','true');};
  const zamkni=(ano)=>{bezi=ano;email.readOnly=ano;if(pasca)pasca.readOnly=ano;tlacidlo.disabled=ano;tlacidlo.textContent=ano?t.sending:povodny;};
  email.addEventListener('input',()=>{if(!chyba.hidden){chyba.hidden=true;email.removeAttribute('aria-invalid');}});
  // Po schválení appky: namiesto čakacej listiny odkaz na appku; veta „čaká na posúdenie“ zmizne.
  appLive().then(({live,url})=>{
    if(!live)return;
    const cakanie=sekcia.querySelector('[data-pro-cakanie]'),liveEl=sekcia.querySelector('[data-pro-live]');
    if(cakanie)cakanie.hidden=true;
    if(liveEl){liveEl.hidden=false;const a=liveEl.querySelector('a');if(a&&url)a.href=sMiestom(url,place);}
    if(!bezi&&stav.hidden)form.hidden=true;
  },()=>{});
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    if(bezi)return;
    chyba.hidden=true;email.removeAttribute('aria-invalid');
    const adresa=(email.value||'').trim();
    if(!adresa||!email.checkValidity()){ukazChybu(t.errors.invalid);email.focus();return;}
    const moja=++verzia;zamkni(true);
    let casovac=null,vyprsalo=false;const ovladac=typeof AbortController!=='undefined'?new AbortController():null;
    const limit=new Promise((_,zle)=>{casovac=deps.setTimeout(()=>{vyprsalo=true;ovladac?.abort();zle(new Error('timeout'));},deps.timeoutMs);});
    try{
      const dopyt=Promise.resolve().then(()=>deps.fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:adresa,source:SOURCE,lang,hp:pasca?String(pasca.value||''):''}),credentials:'omit',cache:'no-store',signal:ovladac?.signal}));
      dopyt.catch(()=>{}); // neskorá chyba dopytu po vypršaní limitu nesmie skončiť ako neodchytená
      const r=await Promise.race([dopyt,limit]);
      if(moja!==verzia)return; // odpoveď staršieho dopytu
      if(r.ok||r.status===409){
        if((email.value||'').trim()!==adresa){ukazChybu(t.errors.changed);return;}
        form.hidden=true;stav.hidden=false;(stav.querySelector('[tabindex]')||stav).focus();
        deps.track('ar_pro_waitlist',{lang,place,shopify});
        return;
      }
      ukazChybu(r.status===400?t.errors.invalid:r.status===429?t.errors.rate:t.errors.server);
    }catch{if(moja===verzia)ukazChybu(vyprsalo?t.errors.timeout:t.errors.network);}
    finally{deps.clearTimeout(casovac);if(moja===verzia)zamkni(false);}
  });
}

function start(){for(const f of document.querySelectorAll('form[data-ar-pro]'))wire(f);}
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();}
