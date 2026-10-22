/*
 * Kontrola jedného pravidla EÚ priamo na stránke povinnosti (relácia 213, ops/druhy-ucet/213/PLAN.md časť 2 a 3).
 * Stránka má form[data-pravidlo="eu_withdrawal"|"eu_guarantee_notice"], jazyk sa berie z <html lang>. Modul zavolá tú istú
 * bezplatnú kontrolu ako /feed-doctor/agent-ready/ (GET feed-monitor /v1/agent-ready/check) a ukáže zvýraznene len výsledok
 * pravidla stránky; druhé pravidlo jedným riadkom s odkazom na jeho stránku, ostatné odkazom na celú kontrolu.
 *
 * AGENTS.md bod 12: každý dopyt má poradové číslo (createLatest), stará odpoveď sa zahodí, úprava poľa alebo Zrušiť ruší bežiaci
 * dopyt, časový limit 65 s; chyba nič neukáže ako hotové a adresa ostane v poli; tvar odpovede sa overí pred použitím; texty len
 * cez textContent; odkaz z nálezu len https. Stráž e-shopu len keď strazOn() povie áno (inak nikde nič). Umami: len pravidlo,
 * jazyk, stav a miesto, nikdy adresa obchodu ani e-mail; pri ?test alebo sessionStorage 'straz:test' = '1' sa neposielajú
 * vlastné udalosti ar_duty_* (pageview posiela skript Umami v hlave stránky ako na ostatných stránkach hubu).
 * Fokus (kolo 1 a brána kolo 2): fokus nikdy neostane na body. Počas behu je na Zrušiť, po výsledku na výsledku, po chybe pri
 * myši a klávesnici v poli adresy, na dotyku (pointer: coarse) na stavovej vete, aby softvérová klávesnica neprekryla stav.
 * Testy: kontrola.test.mjs (node --test).
 */
import {texty,STRANKY_PRAVIDIEL,PRAVIDLA} from './texty.mjs?v=1';
import {createLatest} from '../feed-doctor/agent-ready/controller.mjs';

export const API='https://feed-monitor.arling.workers.dev/v1/agent-ready/check';
export const STRAZ_MODUL='/feed-doctor/agent-ready/straz.mjs?v=2';
export const EU_KODY=['eu_withdrawal','eu_guarantee_notice','eu_green_claims'];
// Stavy podľa core.mjs analyzeEu; link_found a pole system pridáva relácia 208 (repo-kontrola.md 3.6), preto ich stránka pozná vopred.
const STAVY={eu_withdrawal:['found','not_found','unknown','link_found'],eu_guarantee_notice:['found','not_found','not_applicable','unknown'],eu_green_claims:['found','not_found','not_applicable','unknown','link_found']};
const TEST_KLUC='straz:test';

export const deps={
  fetch:(url,init)=>fetch(url,init),
  setTimeout:(f,ms)=>setTimeout(f,ms),
  clearTimeout:(t)=>clearTimeout(t),
  win:()=>typeof window!=='undefined'?window:null,
  doc:()=>typeof document!=='undefined'?document:null,
  search:()=>typeof location!=='undefined'?String(location.search||''):'',
  session:()=>{try{return sessionStorage;}catch{return null;}},
  importStraz:()=>import(STRAZ_MODUL),
  limitMs:65000, // ako app.mjs; worker má na sken 55 s
  strazMs:4000,  // dlhšie rozhodovanie o Stráži = ponuka sa neukáže
  interval:500,
};

/* ---------- čisté funkcie ---------- */

/** Adresa obchodu ako v app.mjs: doplní https://, len https, bez mena, hesla, # a ?; inak null. */
export function adresaObchodu(value){
  let s=String(value??'').trim();
  if(!s||s.length>2048||/[?#]/.test(s))return null;
  if(!/^https?:\/\//i.test(s))s='https://'+s;
  let u;try{u=new URL(s);}catch{return null;}
  if(u.protocol!=='https:'||u.username||u.password||u.hash||u.search||u.port)return null;
  const h=u.hostname;
  if(!h.includes('.')||h.startsWith('[')||/^\d+(\.\d+){3}$/.test(h)||h.endsWith('.'))return null;
  return u.href.length>2048?null:u;
}

/** Tvar odpovede, ktorý vieme bezpečne ukázať: version 1.0.0, eu.version 1, známe kódy a stavy, pravidlo stránky prítomné. */
export function platnaSprava(data,kod){
  if(!data||typeof data!=='object'||data.version!=='1.0.0')return false;
  const eu=data.eu;
  if(!eu||typeof eu!=='object'||eu.version!==1||!Array.isArray(eu.rules)||!eu.rules.length||eu.rules.length>EU_KODY.length)return false;
  const videne=new Set();
  for(const r of eu.rules){
    if(!r||typeof r!=='object'||!EU_KODY.includes(r.code)||videne.has(r.code)||!STAVY[r.code].includes(r.status))return false;
    if(r.pages!==undefined&&!(Number.isInteger(r.pages)&&r.pages>=0))return false;
    videne.add(r.code);
  }
  return videne.has(kod);
}
export const pravidloZ=(data,kod)=>data?.eu?.rules?.find(r=>r&&r.code===kod)||null;

const str=(x,n=200)=>typeof x==='string'?x.replace(/\s+/g,' ').trim().slice(0,n):'';
const fill=(s,v)=>String(s).replace(/\{(\w+)\}/g,(m,k)=>Object.hasOwn(v,k)?String(v[k]):m);
const zoznam=(x)=>(Array.isArray(x)?x:[]).filter(f=>f&&typeof f==='object').slice(0,3);
const sNapisom=(x)=>zoznam(x).filter(f=>str(f.label,120));
/** Odkaz z nálezu len ako https adresa bez mena a hesla; inak null (javascript:, http:, data: sa nikdy neukážu ako odkaz). */
export function safeHttps(url){try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}}
/** Slová nápisu bez diakritiky a veľkých písmen. */
export const zlozene=(s)=>String(s??'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().split(' ').filter(Boolean);
/** Obsahuje nápis frázu (slová za sebou) a najviac `navyse` ďalších slov? */
export function maFrazu(label,fraza,navyse=2){
  const w=zlozene(label),f=zlozene(fraza);
  if(!f.length||w.length>f.length+navyse)return false;
  for(let i=0;i+f.length<=w.length;i++)if(f.every((x,j)=>w[i+j]===x))return true;
  return false;
}
/** Prvé slovo, ktoré robí z nápisu otázku alebo návod (bez diakritiky). */
export const OTAZKY_CS=['jak','kdy','proc','co','kde','kdo'];
/** Nápisy, ktoré zelený odznak „Nápis podle zákona nalezen“ dostanú (§ 1830a odst. 2 OZ: „Odstoupit od smlouvy“; slovo „zde“
 *  alebo „tady“ pred ním či za ním). Slová bez diakritiky a veľkých písmen, interpunkcia sa nepočíta. Všetko ostatné je „Ověřte odkaz“. */
export const NAPIS_ZAKON_CS=['odstoupit od smlouvy','odstoupit od smlouvy zde','odstoupit od smlouvy tady','zde odstoupit od smlouvy','tady odstoupit od smlouvy'];
export const napisZakonaCs=(label)=>NAPIS_ZAKON_CS.includes(zlozene(str(label,120)).join(' '));
const stranka=(eu,k)=>typeof k==='string'&&Object.hasOwn(eu.pages,k)?eu.pages[k]:eu.pages.product;

/**
 * Výsledok jedného pravidla bez DOM: odznak (text a tón, stav nikdy len farbou), riadky (text, odkaz len https, tlmene),
 * ručné overenie, predpis, počet prečítaných stránok a či išlo o podobný nápis (pre meranie).
 * Osobitné prípady PLAN.md časť 3: česká stránka a nápis „Odstoupit od smlouvy“ (§ 1830a odst. 2 OZ); slovenská stránka a
 * „Odstúpiť od zmluvy“ bez „tu“ (obdobná formulácia, § 20a ods. 2); odkaz na Your Europe bez vety oznámenia; Shoptet pri not_found.
 */
export function vyhodnot(r,lang){
  const T=texty(lang),eu=T.eu,x=eu.rules[r.code],page=(k)=>stranka(eu,k);
  const st=(k)=>x.status?.[k]||eu.status[k]||eu.status.unknown;
  const m={kod:r.code,status:r.status,tone:'unknown',badge:st('unknown'),title:x.title,applies:x.applies,lines:[],manual:null,
    pages:Number.isInteger(r.pages)&&r.pages>=0?r.pages:0,podobny:false,law:x.law,shoptet:null};
  const riadok=(sablona,f,muted=false)=>({text:fill(sablona,{label:str(f.label,120),page:page(f.page)}),href:safeHttps(f.href),muted});
  if(r.status==='unknown'){m.lines.push({text:x.unknown});return m;}
  if(r.code==='eu_withdrawal'){
    const found=sNapisom(r.found),similar=sNapisom(r.similar);
    if(r.status==='found'){
      m.tone='ok';m.badge=st('found');for(const f of found)m.lines.push(riadok(x.found,f));
      m.lines.push({text:x.foundNote,muted:true});m.manual=x.manualFound;return m;
    }
    if(r.status==='link_found'){
      // Relácia 208: odkaz na stránku objednávky platformy. Starý i18n.mjs bez týchto kľúčov: veta o podobnom odkaze.
      const system=sNapisom(r.system),text=typeof x.linkFound==='string'?x.linkFound:x.similar;
      m.badge=x.status?.link_found||eu.status.link_found||st('check');m.podobny=true;
      for(const f of system)m.lines.push(riadok(text,f));
      if(typeof x.linkFoundNote==='string')m.lines.push({text:x.linkFoundNote,muted:true});
      m.manual=typeof x.manualLinkFound==='string'?x.manualLinkFound:x.manualNotFound;return m;
    }
    // not_found. Český nápis podľa zákona len povoleným zoznamom (NAPIS_ZAKON_CS): „Nelze odstoupit od smlouvy“, „Jak odstoupit
    // od smlouvy“ či „Odstoupit od smlouvy (pdf)“ ostanú podobným odkazom „Ověřte odkaz“ (brána kolo 1 a kolo 2).
    const zakon=T.lang==='cs'?similar.filter(f=>napisZakonaCs(f.label)):[];
    if(zakon.length){
      m.tone='ok';m.badge=T.zakonStatus;m.podobny=true;
      for(const f of zakon)m.lines.push(riadok(T.zakon,f));
      m.lines.push({text:x.foundNote,muted:true});
      for(const f of similar)if(!zakon.includes(f))m.lines.push(riadok(x.similar,f,true));
      m.manual=x.manualFound;return m;
    }
    const obdobna=T.lang==='sk'?similar.filter(f=>maFrazu(f.label,'Odstúpiť od zmluvy')):[];
    m.lines.push({text:x.notFound});
    const orders=typeof x.orderPage==='string'?sNapisom(r.orderPage):[];
    for(const f of orders)m.lines.push(riadok(x.orderPage,f));
    for(const f of obdobna)m.lines.push(riadok(T.obdobna,f));
    for(const f of similar)if(!obdobna.includes(f))m.lines.push(riadok(x.similar,f,true));
    if(similar.length){m.tone='unknown';m.badge=st('check');m.podobny=true;}else{m.tone='review';m.badge=st('not_found');}
    m.manual=orders.length&&typeof x.manualOrderPage==='string'?x.manualOrderPage:x.manualNotFound;
    // Pri podobnom nápise by odsek o Shoptete výsledok len zväčšil; pri odkaze na stránku objednávky (208) to isté už hovorí orderPage.
    if(T.shoptet&&!similar.length&&!orders.length)m.shoptet=T.shoptet;
    return m;
  }
  // eu_guarantee_notice
  m.manual=x.manual;
  if(r.status==='found'){
    m.tone='ok';m.badge=st('found');
    for(const f of zoznam(r.found))m.lines.push({text:fill(f.in==='alt'?x.foundAlt:x.found,{page:page(f.page)}),href:null,muted:false});
    m.lines.push({text:x.foundNote,muted:true});return m;
  }
  if(r.status==='not_applicable'){m.tone='ok';m.badge=st('not_applicable');m.lines.push({text:x.notApplicable});return m;}
  const links=zoznam(r.links);
  m.lines.push({text:x.notFound});
  if(links.length){
    for(const l of links)m.lines.push({text:fill(x.links,{page:page(l.page)}),href:safeHttps(l.href),muted:true});
    m.lines.push({text:T.yourEurope});m.tone='unknown';m.badge=T.overteRucne;m.podobny=true;
  }else{m.tone='review';m.badge=st('not_found');}
  return m;
}

/* ---------- Umami ---------- */

const parametre=()=>{try{return new URLSearchParams(deps.search());}catch{return new URLSearchParams();}};
/** Ticho pri akomkoľvek ?test v adrese alebo zapnutom test móde Stráže (sessionStorage 'straz:test' = '1'). */
export function bezMerania(){
  if(parametre().has('test'))return true;
  try{return deps.session()?.getItem(TEST_KLUC)==='1';}catch{return false;}
}
/** Udalosť do Umami; kým sa skript Umami nenačíta (obal ho načíta po prvom vykreslení), čaká vo fronte (najviac 40 pokusov). */
export function track(name,data){
  if(bezMerania())return false;
  const w=deps.win();if(!w)return false;
  try{
    if(w.umami&&typeof w.umami.track==='function'){w.umami.track(name,data);return true;}
    (w.__pkFronta||(w.__pkFronta=[])).push([name,data]);
    if(!w.__pkCaka){
      w.__pkCaka=true;let pokus=0;
      const tik=()=>{try{
        if(w.umami&&typeof w.umami.track==='function'){w.__pkCaka=false;for(const [n,d] of w.__pkFronta.splice(0)){try{w.umami.track(n,d);}catch{}}return;}
        if(++pokus<40)deps.setTimeout(tik,deps.interval);else w.__pkCaka=false;
      }catch{w.__pkCaka=false;}};
      deps.setTimeout(tik,deps.interval);
    }
  }catch{}
  return true;
}

/* ---------- Stráž e-shopu ---------- */

/** Modul Stráže, keď smie ponuka ísť von (strazOn() === true), inak null; chyba alebo pomalá odpoveď = null, rozhodne sa raz. */
export function nacitajStraz(){
  let casovac=null;
  const limit=new Promise((ok)=>{casovac=deps.setTimeout(()=>ok(null),deps.strazMs);});
  const modul=Promise.resolve().then(()=>deps.importStraz())
    .then((m)=>m&&typeof m.strazOn==='function'&&typeof m.buildStrazBox==='function'?Promise.resolve(m.strazOn()).then((on)=>on===true?m:null):null)
    .catch(()=>null);
  return Promise.race([modul,limit]).then((m)=>{deps.clearTimeout(casovac);return m;},()=>null);
}

/* ---------- DOM ---------- */

// Skratka sa vo výsledku neodtrhne od čísla („odpovídá §“ / „1830a“, kontrola prehliadača kolo 1): nezlomiteľná medzera.
const NBSP=String.fromCharCode(0xa0);
export const nezlom=(s)=>String(s).replace(/(?<![\p{L}])(§|odst\.|ods\.|písm\.|Abs\.|Nr\.|Art\.|čl\.|č\.) (?=\d|[a-z]{1,2}\))/gu,'$1'+NBSP);
function el(d,tag,text,cls){const e=d.createElement(tag);if(text!=null)e.textContent=nezlom(text);if(cls)e.className=cls;return e;}
function odkaz(d,text,href,von=true){const a=el(d,'a',text);a.href=href;if(von){a.rel='noopener';a.target='_blank';}return a;}
const kratko=(href)=>href.replace(/^https:\/\//,'').slice(0,80);

/** Obsah výsledku (nový prvok, do stránky ho vloží volajúci naraz). Vráti {obsah, model}. */
export function vysledokObsah(d,data,kod,lang,naPlnu=()=>{}){
  const T=texty(lang),eu=T.eu,m=vyhodnot(pravidloZ(data,kod),lang);
  const obsah=el(d,'div',null,'pk-v');obsah.dataset.tone=m.tone;
  const hlava=el(d,'div',null,'pk-v-hlava'),odznak=el(d,'span',m.badge,'pk-odznak');odznak.dataset.tone=m.tone;
  hlava.append(el(d,'h3',m.title,'pk-v-nadpis'),odznak);obsah.append(hlava);
  const obchod=safeHttps(data.storeUrl);
  if(obchod)obsah.append(el(d,'p',T.obchod+' '+new URL(obchod).host,'ar-muted pk-v-obchod'));
  if(m.applies)obsah.append(el(d,'p',m.applies,'ar-muted pk-v-plati'));
  const riadky=el(d,'div',null,'pk-v-riadky');
  for(const l of m.lines){
    const p=el(d,'p',l.text,l.muted?'ar-muted':null);
    if(l.href){p.append(' ');p.append(odkaz(d,kratko(l.href),l.href));}
    riadky.append(p);
  }
  obsah.append(riadky);
  if(m.status!=='unknown')obsah.append(el(d,'p',T.precitane(m.pages),'ar-muted pk-v-stranky'));
  if(m.shoptet)obsah.append(el(d,'p',m.shoptet,'pk-v-shoptet'));
  if(m.manual){const p=el(d,'p',null,'pk-v-rucne');p.append(el(d,'strong',eu.manual+':'),' '+m.manual);obsah.append(p);}
  if(Array.isArray(m.law)&&m.law.length){
    const p=el(d,'p',null,'pk-v-predpis');p.append(el(d,'span',eu.law+': '));
    m.law.forEach(([text,href],i)=>{const h=safeHttps(href);if(!h)return;if(i)p.append('; ');p.append(odkaz(d,text,h));});
    obsah.append(p);
  }
  // Druhé pravidlo jedným riadkom: stránka toho pravidla v tom istom jazyku, inak predpis a celá kontrola.
  const ine=kod==='eu_withdrawal'?'eu_guarantee_notice':'eu_withdrawal',r2=pravidloZ(data,ine);
  if(r2){
    const m2=vyhodnot(r2,lang),p=el(d,'p',null,'pk-v-vedlajsi');
    p.append(el(d,'strong',m2.title+':'),' '+m2.badge+'. ');
    const cesta=STRANKY_PRAVIDIEL[ine][T.lang];
    if(cesta){const a=odkaz(d,T.vedlajsiOdkaz,cesta,false);a.dataset.pkPravidlo=ine;p.append(a);}
    else{
      const [zt,zh]=m2.law[0]||[],h=safeHttps(zh);
      if(h){p.append(odkaz(d,zt,h),'; ');}
      const a=odkaz(d,T.vedlajsiOdkaz,T.plnaHref,false);a.dataset.pkPlna='';a.addEventListener('click',naPlnu);p.append(a);
    }
    obsah.append(p);
  }
  const plna=el(d,'p',T.plnaRiadok+' ','pk-v-plna'),a=odkaz(d,T.plna,T.plnaHref,false);a.dataset.pkPlna='';a.addEventListener('click',naPlnu);
  plna.append(a);obsah.append(plna);
  return {obsah,model:m};
}

/** Zapojí formulár stránky. Vráti ovládač pre testy alebo null, keď stránka formulár nemá. */
export function spusti(d=deps.doc()){
  const form=d?.querySelector?.('form[data-pravidlo]');if(!form)return null;
  const kod=form.dataset.pravidlo;if(!PRAVIDLA.includes(kod))return null;
  const T=texty(String(d.documentElement?.lang||'').slice(0,2).toLowerCase()),L=T.lang;
  const $=(id)=>d.getElementById(id);
  const input=$('pk-adresa'),tlacidlo=$('pk-tlacidlo'),zrusit=$('pk-zrusit'),stav=$('pk-stav'),vysledok=$('pk-vysledok');
  if(!input||!tlacidlo||!zrusit||!stav||!vysledok)return null;
  const latest=createLatest(),udaj={rule:kod,lang:L};
  const naPlnu=()=>track('ar_duty_to_check',{...udaj});
  const straz=nacitajStraz();
  straz.then((m)=>{if(!m)return;for(const s of d.querySelectorAll('section[data-straz]'))s.hidden=false;});
  for(const a of d.querySelectorAll('section[data-straz] a'))a.addEventListener('click',()=>track('ar_duty_straz',{...udaj,place:'ponuka'}));
  for(const a of d.querySelectorAll('a[data-pk-plna]'))a.addEventListener('click',naPlnu);

  const doPola=()=>{try{input.focus();}catch{}};
  // Dotyková obrazovka: fokus v poli otvorí softvérovú klávesnicu a tá prekryje stav aj Zrušiť (brána kolo 2). Pole preto
  // dostane fokus programom len pri myši a klávesnici, alebo keď chce používateľ písať (zlá adresa, Zrušiť, skok na kontrolu).
  const dotyk=()=>{try{return !!deps.win()?.matchMedia?.('(pointer: coarse)')?.matches;}catch{return false;}};
  // Zakázané tlačidlo ani skryté Zrušiť fokus nedržia (inak je na body); stavová veta ho drží len do ďalšieho behu.
  const stratenyFokus=()=>{const a=d.activeElement;return !a||a===d.body||a===tlacidlo||a===zrusit||a===stav;};
  // Stavová veta môže dostať fokus programom (chyba na dotyku), poradie Tab sa nemení.
  if(stav.getAttribute?.('tabindex')==null)stav.setAttribute?.('tabindex','-1');
  /** Počas behu ide fokus na Zrušiť, keď ho tlačidlo stratí, a na dotyku aj z poľa (zavrie klávesnicu). Po behu nič nepresúva. */
  const busy=(v)=>{
    const strata=stratenyFokus(),zPola=d.activeElement===input&&dotyk();
    tlacidlo.disabled=v;zrusit.hidden=!v;form.setAttribute('aria-busy',String(v));
    if(v&&(strata||zPola)){try{zrusit.focus();}catch{}}
  };
  /** Po chybe: myš a klávesnica do poľa adresy, dotyk na stavovú vetu s chybou (bez klávesnice). Len keď fokus stratil miesto. */
  const poChybe=()=>{if(!stratenyFokus())return;if(dotyk()){try{stav.focus();}catch{}}else doPola();};
  const skry=()=>{vysledok.hidden=true;vysledok.replaceChildren();};
  /** Veta v riadku stavu; chyba má vlastný vzhľad (data-tone="chyba"), aby sa nedala zameniť s behom. */
  const hlas=(text,chyba=false)=>{stav.textContent=text;if(chyba)stav.dataset.tone='chyba';else delete stav.dataset.tone;};
  // Skok z úvodu (mobil): posunie na kontrolu a dá fokus do poľa adresy.
  for(const a of d.querySelectorAll('a[data-pk-skok]'))a.addEventListener('click',(e)=>{
    e?.preventDefault?.();
    try{const tichy=deps.win()?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;$('kontrola')?.scrollIntoView?.({behavior:tichy?'auto':'smooth',block:'start'});}catch{}
    try{input.focus({preventScroll:true});}catch{}
  });

  async function skontroluj(){
    const u=adresaObchodu(input.value);
    if(!u){latest.cancel();busy(false);skry();input.setAttribute('aria-invalid','true');hlas(T.chyby.adresa,true);doPola();return;}
    input.removeAttribute('aria-invalid');input.value=u.href;
    const req=latest.begin();busy(true);hlas(T.busy);skry();
    track('ar_duty_check',{...udaj});
    const api=new URL(API);api.searchParams.set('url',u.href);
    const casovac=deps.setTimeout(()=>{if(req.current()){latest.cancel();busy(false);skry();hlas(T.chyby.limit,true);poChybe();}},deps.limitMs);
    try{
      let r;
      try{r=await deps.fetch(api.href,{signal:req.signal,credentials:'omit',cache:'no-store'});}catch{throw new Error('siet');}
      if(!req.current())return;
      if(!r||!r.ok){const s=r?.status;throw new Error(s===429?'rate':s===503?'nedostupna':s===400?'adresaServer':'server');}
      let data;try{data=await r.json();}catch{throw new Error('tvar');}
      if(!req.current())return;
      if(!platnaSprava(data,kod))throw new Error('tvar');
      const sz=await straz;if(!req.current())return;
      const {obsah,model}=vysledokObsah(d,data,kod,L,naPlnu);
      if(sz){
        try{
          const box=sz.buildStrazBox(L==='cs'?'sk':L,'result','unknown',data);
          if(box){
            if(T.strazJazyk)obsah.append(el(d,'p',T.strazJazyk,'pk-v-straz-jazyk'));
            box.addEventListener('click',(e)=>{if(e?.target?.closest?.('a,button'))track('ar_duty_straz',{...udaj,place:'box'});});
            obsah.append(box);
          }
        }catch{}
      }
      vysledok.replaceChildren(obsah);vysledok.hidden=false;hlas('');
      try{vysledok.focus({preventScroll:true});const w=deps.win(),tichy=w?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;vysledok.scrollIntoView?.({behavior:tichy?'auto':'smooth',block:'start'});}catch{}
      track('ar_duty_result',{...udaj,status:model.status,podobny:model.podobny?'ano':'nie'});
    }catch(e){
      if(req.current()){skry();hlas(T.chyby[e?.message]||T.chyby.tvar,true);}
    }finally{
      deps.clearTimeout(casovac);if(req.current()){busy(false);if(vysledok.hidden)poChybe();}
    }
  }

  form.addEventListener('submit',(e)=>{e.preventDefault();skontroluj();});
  zrusit.addEventListener('click',()=>{latest.cancel();busy(false);skry();hlas(T.cancelled);doPola();});
  input.addEventListener('input',()=>{latest.cancel();busy(false);skry();hlas('');input.removeAttribute('aria-invalid');});
  track('ar_duty_view',{...udaj});
  return {skontroluj,straz,kod,lang:L};
}

const d0=deps.doc();
if(d0&&d0.querySelector?.('form[data-pravidlo]'))spusti(d0);
