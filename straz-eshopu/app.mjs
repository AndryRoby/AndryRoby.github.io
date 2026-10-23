// Stráž e-shopu (relácia 209, 22. 10. 2026): jeden modul pre predajné zobrazenie a správu jedného monitora.
// Zmluva: ops/druhy-ucet/209/PRODUKT.md (časti 2, 3, 4 a 6). Texty sú v texty.mjs, statický obsah v HTML.
// Bez id a key: predaj (formulár sa ukáže len pri stav.json live true alebo v test režime).
// S id a key: správa (GET stav, zrušenie, obnovenie, e-maily, kontrola teraz, adresa obchodu, zmazanie, návrat po platbe).
// AGENTS.md bod 12: každá odpoveď nesie poradie (createLatest), dvojklik nič nepokazí, chyba nič neukáže ako hotové,
// údaje vo formulári ostanú; všetko zo servera ide do stránky len cez textContent, odkazy len po kontrole adresy.
// Čistá logika je exportovaná a testovaná v app.test.mjs (node --test); DOM sa spustí len v prehliadači.
import {createLatest} from '../feed-doctor/agent-ready/controller.mjs';
import {TEXTY} from './texty.mjs?v=5';

export const API='https://feed-monitor.arling.workers.dev';
export const STAV_URL='/straz-eshopu/stav.json';
export const PORTAL='https://billing.stripe.com/p/login/3cIaER9M63hNeFcg8B4ko00';
export const UMAMI_SKRIPT='https://api.arling.workers.dev/script.js';
export const UMAMI_WEB='77002c4b-a825-4462-af8c-4c7859af24b2';
export const NAVRAT_KLUC='straz:navrat';
export const TEST_KLUC='straz:test';
// Tvar id a kľúča z workera (products/feed-doctor/monitor/src/db.js genId a genToken). Iný tvar sa odmietne a nič sa nevolá.
export const ID_RE=/^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|m_[0-9]{10,16}_[a-z0-9]{1,12})$/;
export const KEY_RE=/^[0-9a-f]{64}$/;
export const JAZYKY=['sk','en','de'];
export const jazyk=x=>JAZYKY.includes(x)?x:'sk';
export const POLLING={interval:3000,limit:120000};
// link_found (zmluva 208): odkaz na stránku objednávky platformy pri funkcii na odstúpenie, funkčnosť neoverená.
const EU_STAVY=['found','not_found','not_applicable','unknown','link_found'];
const WEEKLY_STAVY=['pending','running','done','failed','not_configured'];

export const vypln=(s,v)=>String(s).replace(/\{(\w+)\}/g,(m,k)=>Object.hasOwn(v,k)?String(v[k]):m);
/** Text zo servera: len reťazec, bez riadiacich znakov, skrátený. Iný typ je prázdny reťazec. */
export function cistyText(x,n=300){return typeof x==='string'?x.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,n):'';}
const cele=(x,min=0,max=Infinity)=>Number.isInteger(x)&&x>=min&&x<=max?x:null;

/** Parametre adresy stránky. platne = id aj key majú očakávaný tvar. */
export function parametre(search){
  const p=new URLSearchParams(search),id=p.get('id')||'',key=p.get('key')||'';
  return {id,key,ma:p.has('id')||p.has('key'),platne:ID_RE.test(id)&&KEY_RE.test(key),paid:p.get('paid')==='1'};
}
/** predaj | sprava | chyba (neúplný alebo zlý odkaz; nič sa nevolá). */
export function rezim(par){return !par.ma?'predaj':par.platne?'sprava':'chyba';}
/** Test režim (PRODUKT.md časť 2 a 6): ?test=1 sa zapíše do sessionStorage. test = ponuka v test móde, merat = smie ísť udalosť do Umami. */
export function testRezim(search,storage){
  const p=new URLSearchParams(search);let ulozene=null;
  try{if(p.get('test')==='1')storage?.setItem(TEST_KLUC,'1');ulozene=storage?.getItem(TEST_KLUC)??null;}catch{}
  return {test:p.get('test')==='1'||ulozene==='1',merat:!p.has('test')&&ulozene!=='1'};
}
/** Ponuka sa ukáže len pri live true alebo v test režime; čokoľvek iné (chyba, iný tvar) ju skryje. */
export function ponukaViditelna(stav,test){return test===true||Boolean(stav&&typeof stav==='object'&&!Array.isArray(stav)&&stav.live===true);}
/** Jeden GET stav.json bez cache; chyba, pomalá odpoveď alebo zlý JSON dajú null (ponuka ostane skrytá). */
export function nacitajStav(fetchImpl,url=STAV_URL,ms=4000,casovac=setTimeout){
  return Promise.race([
    Promise.resolve().then(()=>fetchImpl(url,{cache:'no-store',credentials:'omit'})).then(r=>r&&r.ok===true?r.json():null).catch(()=>null),
    new Promise(resolve=>casovac(()=>resolve(null),ms)),
  ]);
}

/** Adresa obchodu: prijme aj bez https:// (R73), http sa zmení na https (worker berie len https, agent-ready publicUrl). Vráti pôvod s lomkou alebo null. */
export function normalizujObchod(v){
  let s=String(v??'').trim();if(!s||s.length>2048||/\s/.test(s))return null;
  if(!/^[a-z][a-z0-9+.-]*:\/\//i.test(s))s='https://'+s;
  let u;try{u=new URL(s);}catch{return null;}
  if(u.protocol==='http:')u.protocol='https:';
  if(u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443'))return null;
  if(!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/.test(u.hostname))return null;
  return u.origin+'/';
}
/** Adresa feedu je nepovinná: '' = bez feedu, inak verejná http(s) adresa, null = neplatná. */
export function normalizujFeed(v){
  let s=String(v??'').trim();if(!s)return '';if(s.length>2048||/\s/.test(s))return null;
  if(!/^[a-z][a-z0-9+.-]*:\/\//i.test(s))s='https://'+s;
  let u;try{u=new URL(s);}catch{return null;}
  if(!['http:','https:'].includes(u.protocol)||u.username||u.password)return null;
  if(!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/.test(u.hostname))return null;
  return u.href;
}
export function platnyEmail(v){const s=String(v??'').trim();return s.length<=254&&/^[^\s@<>()",;:\\]+@[^\s@<>()",;:\\]+\.[^\s@<>()",;:\\.]{2,}$/.test(s)?s:null;}
export const NAVRAT_MAX_VEK=24*60*60*1000;
/** Zmena zmluvy Z2 (kolo 1): predošlý čakajúci monitor z localStorage 'straz:navrat', ak je mladší ako 24 h a má platný tvar.
 * Worker ho aktualizuje len pri tom istom e-maile a vráti to isté id a kľúč; inak vytvorí nový riadok. Iný tvar = null. */
export function predoslyNavrat(raw,now=Date.now()){
  if(typeof raw!=='string'||raw.length>1000)return null;
  try{
    const x=JSON.parse(raw);if(!x||typeof x!=='object'||!ID_RE.test(String(x.id))||!KEY_RE.test(String(x.key)))return null;
    const at=Date.parse(x.at);if(!Number.isFinite(at)||now-at>=NAVRAT_MAX_VEK||at-now>5*60*1000)return null;
    return {prev_id:x.id,prev_key:x.key};
  }catch{return null;}
}
/** Telo POST /v1/straz alebo zoznam chybných polí (v poradí formulára). predosly = výsledok predoslyNavrat (nepovinné). */
export function pripravTelo({obchod,email,feed,lang,test,predosly=null}){
  const store_url=normalizujObchod(obchod),mail=platnyEmail(email),feed_url=normalizujFeed(feed),chyby=[];
  if(!store_url)chyby.push('store_url');if(!mail)chyby.push('email');if(feed_url===null)chyby.push('feed_url');
  if(chyby.length)return {chyby};
  const telo={store_url,email:mail,lang:jazyk(lang),feed_url,test:test===true};
  if(predosly&&ID_RE.test(String(predosly.prev_id))&&KEY_RE.test(String(predosly.prev_key))){telo.prev_id=predosly.prev_id;telo.prev_key=predosly.prev_key;}
  return {chyby,telo};
}
/** Na Stripe sa ide len na https://buy.stripe.com/ (živý aj testovací Payment Link). */
export function bezpecnyCheckout(u){
  try{const x=new URL(u);return x.protocol==='https:'&&x.hostname==='buy.stripe.com'&&!x.username&&!x.password&&!x.port?x.href:null;}catch{return null;}
}
const POLIA=['store_url','email','feed_url'];
/** Polia z 400 validation_failed {issues}; tvar issues nepoznáme presne, preto reťazec aj objekt {field|path|name}. */
export function poliaZIssues(issues){
  if(!Array.isArray(issues))return [];
  const out=new Set();
  for(const i of issues.slice(0,20)){
    const t=typeof i==='string'?i:i&&typeof i==='object'?String(i.field??i.path??i.name??''):'';
    for(const p of POLIA)if(t===p||t.startsWith(p)||t.includes(p))out.add(p);
    if(/(^|[^a-z_])store/.test(t))out.add('store_url');if(/(^|[^a-z_])feed/.test(t))out.add('feed_url');
  }
  return POLIA.filter(p=>out.has(p));
}
/** Odpoveď POST /v1/straz. Úspech len s platným id, key a checkout_url; inak chyba (nič sa neukáže ako hotové). */
export function vysledokOdoslania(status,data){
  if(status===200||status===201){
    const ok=data&&typeof data==='object'&&ID_RE.test(String(data.id))&&KEY_RE.test(String(data.key));
    const checkout=ok?bezpecnyCheckout(data.checkout_url):null;
    return checkout?{ok:true,id:data.id,key:data.key,checkout}:{ok:false,chyba:'server',polia:[]};
  }
  if(status===400)return {ok:false,chyba:'validation',polia:poliaZIssues(data?.issues)};
  if(status===403&&data?.error==='test_not_allowed')return {ok:false,chyba:'test_not_allowed',polia:[]};
  if(status===409&&data?.error==='already_active')return {ok:false,chyba:'already_active',polia:[]};
  if(status===429)return {ok:false,chyba:'rate',polia:[]};
  if(status===503)return {ok:false,chyba:'unavailable',polia:[]};
  return {ok:false,chyba:'server',polia:[]};
}
/** localStorage 'straz:navrat' pred odchodom na Stripe (PRODUKT.md časť 3). Zlý tvar id alebo kľúča = nič sa neuloží. */
export function navratZaznam(id,key,lang,now=new Date()){
  if(!ID_RE.test(String(id))||!KEY_RE.test(String(key)))return null;
  return JSON.stringify({id,key,lang:jazyk(lang),at:now.toISOString()});
}
export function cestaStraze(lang){const l=jazyk(lang);return '/straz-eshopu/'+(l==='sk'?'':l+'/');}
export function adresaStatusu(id,key){return `${API}/v1/monitors/${encodeURIComponent(id)}?key=${encodeURIComponent(key)}`;}
export function adresaAkcie(id,key,akcia){return `${API}/v1/monitors/${encodeURIComponent(id)}/${akcia}?key=${encodeURIComponent(key)}`;}
export function adresaAgentReady(id,key,run=false){return `${API}/v1/agent-ready/monitors/${encodeURIComponent(id)}${run?'/run':''}?key=${encodeURIComponent(key)}`;}
/** Adresa bez paid=1 (po zapnutí sa paid odstráni z adresy cez history.replaceState). */
export function bezPaid(href){const u=new URL(href);u.searchParams.delete('paid');return u.pathname+u.search+u.hash;}

/** Ochrana stavu zo servera: musí byť objekt toho istého monitora. */
export function platnyStav(d,id){return Boolean(d&&typeof d==='object'&&!Array.isArray(d)&&d.id===id&&typeof d.plan==='string');}
/** pro | pro_zrusene | caka | free */
export function planStav(d){
  if(d.plan==='pro')return typeof d.cancel_at==='string'&&d.cancel_at?'pro_zrusene':'pro';
  return d.status==='pending_payment'?'caka':'free';
}
export function datum(iso,lang){
  if(typeof iso!=='string'||!iso)return '';const d=new Date(iso);if(Number.isNaN(d.getTime()))return '';
  try{return d.toLocaleDateString({sk:'sk-SK',en:'en-GB',de:'de-DE'}[jazyk(lang)],{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Bratislava'});}
  catch{return d.toISOString().slice(0,10);}
}
const LOKALY={sk:'sk-SK',en:'en-GB',de:'de-DE'};
/** Krátky dátum do tabuľky histórie (22. 10. 2026, 22/10/2026, 22.10.2026); zlý vstup ''. */
export function datumKratky(iso,lang){
  if(typeof iso!=='string'||!iso)return '';const d=new Date(iso);if(Number.isNaN(d.getTime()))return '';
  try{return d.toLocaleDateString(LOKALY[jazyk(lang)],{day:'numeric',month:'numeric',year:'numeric',timeZone:'Europe/Bratislava'});}
  catch{return d.toISOString().slice(0,10);}
}
/** Dátum a čas (posledná kontrola pri limite 3 za hodinu); zlý vstup ''. */
export function datumCas(iso,lang){
  if(typeof iso!=='string'||!iso)return '';const d=new Date(iso);if(Number.isNaN(d.getTime()))return '';
  try{return d.toLocaleString(LOKALY[jazyk(lang)],{day:'numeric',month:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Bratislava'});}
  catch{return d.toISOString().slice(0,16).replace('T',' ');}
}
// Odkaz {label, page} zo stavu weekly.eu (similar alebo link); spoločné čistenie pre podobnyOdkaz a najdenyOdkaz (zmluva 208).
const odkazZ=s=>{
  if(Array.isArray(s))s=s[0];
  if(!s||typeof s!=='object'||Array.isArray(s))return null;
  return {label:cistyText(s.label,120),page:typeof s.page==='string'&&/^[a-z]{1,20}$/.test(s.page)?s.page:''};
};
/** Zmena zmluvy C1: podobný odkaz pri funkcii na odstúpenie z weekly.eu[].similar {label, page}. Prijme aj pole (prvý prvok),
 * iný tvar je null. label je očistený text, page len známy kľúč stránky (inak '' a text povie „stránke produktu“). */
export function podobnyOdkaz(r){return odkazZ(r&&typeof r==='object'?r.similar:null);}
const jePodobny=(code,state,r)=>code==='eu_withdrawal'&&state==='not_found'&&podobnyOdkaz(r)!==null;
/** Zmluva 208 (bod F): odkaz na stránku objednávky platformy (Shoptet /moja-objednavka/) pri funkcii na odstúpenie zo stavu link_found,
 * weekly.eu[].link {label, page} (worker report-mail.mjs euRules). Rovnaké čistenie a tvar ako podobnyOdkaz, iný tvar je null. */
export function najdenyOdkaz(r){return odkazZ(r&&typeof r==='object'?r.link:null);}
const jeOdkaz=(code,state)=>code==='eu_withdrawal'&&state==='link_found';
/** Relácia 208, agent M2: odkaz na stránku objednávky platformy s textom bez odstúpenia (Shoptet „Moja objednávka“) pri odstúpení
 * not_found, weekly.eu[].order {label, page} (worker report-mail.mjs euRules). Rovnaké čistenie a tvar ako podobnyOdkaz, iný tvar je null. */
export function odkazObjednavky(r){return odkazZ(r&&typeof r==='object'?r.order:null);}
/** Riadky troch nálezov EÚ zo stavu weekly.eu [{code,state,similar?,link?,order?,shoptet?}]: len známe kódy a stavy, texty z EU_UI (i18n.mjs), tón z eu-zobraz.mjs.
 * Pri odstúpení not_found s podobným odkazom rovnaké pravidlo ako bezplatná kontrola (eu-zobraz.mjs riadky 55 a 56): štítok
 * „Overte odkaz“, tón unknown a veta o odkaze s iným znením (veta), nikdy červené „Označenie sme nenašli“.
 * Zmluva 208: link_found (len pri odstúpení) má štítok „Odkaz nájdený, funkčnosť neoverená“, tón unknown a vetu o odkaze z r.link
 * (bez r.link žiadna veta). Prehliadač môže mať starý i18n.mjs?v=2 bez nových kľúčov: vtedy „Overte odkaz“ a veta o podobnom
 * odkaze, nikdy undefined.
 * Relácia 208, agent M2: not_found s r.order (odkaz „Moja objednávka“ na stránku objednávky Shoptetu) má vetu orderPage; štítok a tón
 * ako pri not_found (s podobným odkazom „Overte odkaz“, unknown a obe vety: najprv o objednávke, potom o podobnom odkaze).
 * Relácia 218 (r.shoptet): veta shoptetNoLink na začiatku vety a postup v administrácii v poli postup s nadpisom postupNadpis. */
export function euRiadky(eu,lang,{EU_UI,toneOf,EU_CODES}){
  if(!Array.isArray(eu))return [];
  const t=EU_UI[jazyk(lang)]||EU_UI.en,stranka=p=>p&&Object.hasOwn(t.pages,p)?t.pages[p]:t.pages.product;
  return EU_CODES.map(code=>{
    const r=eu.find(x=>x&&typeof x==='object'&&x.code===code);
    if(!r||!EU_STAVY.includes(r.state)||(r.state==='link_found'&&!jeOdkaz(code,r.state)))return null;
    const x=t.rules[code],podobny=jePodobny(code,r.state,r),odkaz=jeOdkaz(code,r.state);
    const badge=odkaz?x.status?.link_found||x.status?.check||t.status.link_found||t.status.unknown
      :podobny&&x.status?.check?x.status.check:x.status?.[r.state]||t.status[r.state];
    const out={code,title:x.title,badge,tone:podobny||odkaz?'unknown':toneOf(code,r.state)};
    // Agent M2: pri not_found najprv veta o odkaze na stránku objednávky (r.order), potom o podobnom odkaze, v poradí riadkov stránky
    // kontroly (eu-zobraz.mjs); štítok a tón ostávajú. Starý i18n.mjs?v=2 bez orderPage: veta o objednávke chýba, nikdy undefined.
    const vety=[],o=code==='eu_withdrawal'&&r.state==='not_found'?odkazObjednavky(r):null;
    if(o&&o.label&&typeof x.orderPage==='string')vety.push(vypln(x.orderPage,{label:o.label,page:stranka(o.page)}));
    // Relácia 218: Shoptet bez odkazu na stránku objednávky (r.shoptet z workera, len pri not_found a bez r.order): veta, že Shoptet má
    // funkciu zabudovanú, pred podobným odkazom. Postup v administrácii je samostatné pole postup s nadpisom ručnej kontroly z EU_UI
    // (postupNadpis, „Overte ručne“), nie koniec tlmenej vety (brána 218 D1: veta, podobný odkaz a postup sa zliali do jedného tlmeného
    // odseku s asi 800 znakmi). Starý i18n.mjs?v=2 bez týchto kľúčov: nič navyše.
    const shoptet=code==='eu_withdrawal'&&r.state==='not_found'&&r.shoptet===true&&!(o&&o.label)&&typeof x.shoptetNoLink==='string';
    if(shoptet)vety.push(x.shoptetNoLink);
    if(podobny){const p=podobnyOdkaz(r);if(p.label)vety.push(vypln(x.similar,{label:p.label,page:stranka(p.page)}));}
    if(vety.length)out.veta=vety.join(' ');
    if(shoptet&&typeof x.manualShoptetNoLink==='string'){out.postup=x.manualShoptetNoLink;if(typeof t.manual==='string'&&t.manual)out.postupNadpis=t.manual;}
    if(odkaz){const p=najdenyOdkaz(r);if(p&&p.label)out.veta=vypln(typeof x.linkFound==='string'?x.linkFound:x.similar,{label:p.label,page:stranka(p.page)});}
    return out;
  }).filter(Boolean);
}
/** Adresa miesta z weekly.failing[].where (zmena zmluvy C2): len https bez prihlasovacích údajov, inak ''. Prijme aj pole (prvý prvok). */
export function adresaMiesta(w){
  if(Array.isArray(w))w=w[0];
  if(typeof w!=='string'||!w||w.length>2048)return '';
  try{const u=new URL(w);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}
}
/** Prvá veta opravy (localRule(...).fix): krátka veta pod názvom pravidla, najviac 300 znakov. */
export function prvaVeta(s){
  const t=cistyText(s,2000);if(!t)return '';
  const m=/^[\s\S]*?[.!?](?=\s|$)/.exec(t),v=m?m[0]:t;
  return v.length>300?v.slice(0,299).replace(/\s+\S*$/,'')+'…':v;
}
/** Pravidlá RULES (core.mjs) pre zoznam kódov: názov, prvá veta opravy a adresa miesta (C2: {code, where?}; starý tvar reťazec
 * kódu bez miesta). Neznáme kódy sa zahodia, poradie podľa váhy ako na stránke kontroly. */
export function nazvyPravidiel(kody,lang,{RULES,localRule}){
  if(!Array.isArray(kody))return [];
  const videne=new Set(),out=[];
  for(const k of kody.slice(0,60)){
    const code=typeof k==='string'?k:k&&typeof k==='object'?k.code:null;if(typeof code!=='string'||videne.has(code))continue;
    const i=RULES.findIndex(r=>r.code===code);if(i<0)continue;videne.add(code);
    const lr=localRule(RULES[i],i,jazyk(lang));
    out.push({code,weight:RULES[i].weight||0,title:lr.title,fix:prvaVeta(lr.fix),where:k&&typeof k==='object'?adresaMiesta(k.where):''});
  }
  return out.sort((a,b)=>b.weight-a.weight).map(({code,title,fix,where})=>({code,title,fix,where}));
}
/** Zmeny oproti minulej kontrole zo weekly.changed [{code, from, to}] rozdelené ako v e-maile (report-mail.mjs compareReports):
 * pravidlo, ktoré teraz zlyháva (to 'fail', predtým nie), sa pokazilo; z 'fail' na 'pass' sa opravilo. Nález EÚ: tón z 'ok'
 * na 'review' sa pokazil, z 'review' na 'ok' opravil (eu-zobraz.mjs toneOf). Ostatné zmeny, neznáme kódy a starý tvar bez
 * from a to sa vynechajú, rovnako ako v e-maile.
 * Zmena zmluvy C1: odstúpenie not_found s podobným odkazom (v zmene alebo v aktuálnom weekly.eu) má tón unknown, nie pokazené.
 * Zmena zmluvy C2: pri pokazenom pravidle aj prvá veta opravy a adresa miesta z aktuálneho weekly.failing.
 * Zmluva 208: link_found má tón unknown, takže zmena medzi link_found a not_found alebo found nie je pokazené ani opravené. */
export function zmenyPodlaSmeru(zmeny,lang,zdroje,{eu=[],failing=[]}={}){
  const out={pokazene:[],opravene:[]};if(!Array.isArray(zmeny))return out;
  const t=zdroje.EU_UI[jazyk(lang)]||zdroje.EU_UI.en,videne=new Set(),str=x=>typeof x==='string'?x:null;
  const teraz=Array.isArray(eu)?eu.find(x=>x&&typeof x==='object'&&x.code==='eu_withdrawal'):null;
  const miesta=new Map(nazvyPravidiel(failing,lang,zdroje).map(r=>[r.code,r.where]));
  for(const z of zmeny.slice(0,60)){
    if(!z||typeof z!=='object'||typeof z.code!=='string'||videne.has(z.code))continue;
    const code=z.code,from=str(z.from),to=str(z.to);let smer=null,polozka=null;
    if(zdroje.EU_CODES.includes(code)){
      if(!to||!EU_STAVY.includes(to)||(from&&!EU_STAVY.includes(from)))continue;
      const podobny=jePodobny(code,to,z)||(teraz&&teraz.state===to&&jePodobny(code,to,teraz));
      const ton=s=>jeOdkaz(code,s)?'unknown':zdroje.toneOf(code,s);
      const pred=from?ton(from):'unknown',po=podobny?'unknown':ton(to);
      smer=pred==='ok'&&po==='review'?'pokazene':pred==='review'&&po==='ok'?'opravene':null;polozka={code,title:t.rules[code].title};
    }else{
      const p=nazvyPravidiel([code],lang,zdroje);if(!p.length)continue;
      smer=to==='fail'&&from!=='fail'?'pokazene':from==='fail'&&to==='pass'?'opravene':null;
      polozka=smer==='pokazene'?{code,title:p[0].title,fix:p[0].fix,where:miesta.get(code)||''}:{code,title:p[0].title};
    }
    if(!smer)continue;videne.add(code);out[smer].push(polozka);
  }
  return out;
}
/** Uložená produktová stránka ostane len pri tom istom obchode (worker inak odmietne product_same_origin_required). */
export function produktTehoIstehoObchodu(produkt,obchod){
  if(typeof produkt!=='string'||!produkt)return '';
  try{const p=new URL(produkt);return p.protocol==='https:'&&p.origin===new URL(obchod).origin?p.href:'';}catch{return '';}
}
/** Týždenná kontrola obchodu zo stavu: overený tvar, inak null. */
export function weeklyStav(w){
  if(!w||typeof w!=='object'||!WEEKLY_STAVY.includes(w.status))return null;
  return {status:w.status,at:typeof w.at==='string'?w.at:null,score:cele(w.score,0,100),coverage:cele(w.coverage,0,100),eu:Array.isArray(w.eu)?w.eu:[],failing:Array.isArray(w.failing)?w.failing:[],changed:Array.isArray(w.changed)?w.changed:[]};
}
/** História feedu: najviac 10 riadkov, najnovšie hore, len čísla a dátumy. datum je surový čas zo servera (worker posiela
 * celý ISO čas, db.js historyEntry), na stránku ide cez datumKratky. */
export function historiaFeedu(h){
  if(!Array.isArray(h))return [];
  return h.slice(-10).reverse().map(r=>r&&typeof r==='object'?{datum:cistyText(r.date,40)||cistyText(r.at,40),produkty:cele(r.products,1),chyby:cele(r.error),upozornenia:cele(r.warning)}:null).filter(r=>r&&r.datum);
}
/** W4 (22. 10. 2026): stĺpce histórie feedu. Skóre feedu sa neukazuje (computeScore odpočítava za každý výskyt, skutočný
 * Shoptet feed má 0); stĺpec Produkty len vtedy, keď ho má aspoň jeden riadok (staré kontroly bez products ho nemajú). */
export function stlpceHistorie(hist){
  const sProduktmi=Array.isArray(hist)&&hist.some(r=>r&&r.produkty!=null);
  return sProduktmi?['datum','produkty','chyby','upozornenia']:['datum','chyby','upozornenia'];
}
/** Celé číslo podľa jazyka: 1 282 (sk), 1,282 (en), 1.282 (de). */
export function cislo(n,lang){
  try{return new Intl.NumberFormat(LOKALY[jazyk(lang)],{maximumFractionDigits:0}).format(n);}catch{return String(n);}
}
/** W4: hlavná veta feedu, počty namiesto skóre: chyby a upozornenia pri N produktoch (last_products), bez N, keď ho nepoznáme.
 * '' pri starom texty.mjs bez feedPocty. s = TEXTY[lang].sprava. */
export function vetaFeedu(d,s,lang){
  const t=s&&s.feedPocty&&typeof s.feedPocty==='object'?s.feedPocty:null;if(!t||!d||typeof d!=='object')return '';
  const c=d.last_counts&&typeof d.last_counts==='object'?d.last_counts:{},n=cele(d.last_products,1);
  const forma=n==null?'bez':n===1?'jeden':'vela',vzor=typeof t[forma]==='string'?t[forma]:t.bez;
  return typeof vzor==='string'?vypln(vzor,{datum:datum(d.last_check_at,lang)||'?',chyby:cislo(cele(c.error)??0,lang),upozornenia:cislo(cele(c.warning)??0,lang),produkty:n==null?'':cislo(n,lang)}):'';
}
/** W4: najčastejšie problémy feedu z last_top_issues: najviac päť chýb a upozornení s názvom pravidla v jazyku a počtom.
 * nazvy = Map id -> názov (checkProducts z hubovej kópie Feed Doctora); pravidlo bez názvu sa vynechá, surové id nikdy. */
export function problemyFeedu(top,lang,nazvy){
  if(!Array.isArray(top)||!(nazvy instanceof Map))return [];
  return top.filter(i=>i&&typeof i==='object'&&(i.severity==='error'||i.severity==='warning')&&typeof i.rule==='string'&&nazvy.has(i.rule))
    .slice(0,5).map(i=>({nazov:nazvy.get(i.rule),pocet:cislo(cele(i.count)??0,lang),zavaznost:i.severity}));
}
/** Názvy pravidiel feedu v jazyku z modulu Feed Doctor (checkProducts([], lang).table); prázdna mapa pri chybe. */
export function nazvyPravidielFeedu(fd,lang){
  try{return new Map(fd.checkProducts([],jazyk(lang)).table.map(r=>[r.id,r.title]));}catch{return new Map();}
}
/** W3 (22. 10. 2026): veta pri feede nad 8 MB, ktorý worker vyhodnotil len na prvých N produktoch (last_sample, last_products).
 * Len pri last_sample === true a celom kladnom počte; inak '' (aj pri starom texty.mjs bez feedVzorka). s = TEXTY[lang].sprava. */
export function vetaVzorky(d,s){
  if(!d||typeof d!=='object'||d.last_sample!==true)return '';
  const n=cele(d.last_products,1),t=s&&s.feedVzorka&&typeof s.feedVzorka==='object'?s.feedVzorka:null;if(!n||!t)return '';
  const forma=n===1?'jeden':n<=4?'malo':'vela',vzor=typeof t[forma]==='string'?t[forma]:t.vela;
  return typeof vzor==='string'?vypln(vzor,{pocet:n}):'';
}
/** Riadok tabuľky histórie na zobrazenie: dátum podľa jazyka (pri nečitateľnom dátume prvých 10 znakov), čísla alebo ''. */
export function bunkyHistorie(r,lang,stlpce=['datum','produkty','chyby','upozornenia']){
  return stlpce.map(k=>k==='datum'?datumKratky(r.datum,lang)||r.datum.slice(0,10):r[k]==null?'':cislo(r[k],lang)).map(String);
}

/** Odpoveď POST /v1/agent-ready/monitors/:id/run (zmena zmluvy Z4): {text, chyba?, obnov?, neskor?}.
 * Hotovo len pri status 'done' a fresh true; hotová správa bez fresh je stará a stránka to povie s jej dátumom.
 * 429 povie dátum a čas poslednej kontroly (last_at). s = TEXTY[lang].sprava. */
export function vysledokKontroly(status,data,lang,s){
  const h=s.hlasenia,d=data&&typeof data==='object'?data:{};
  if(status===200){
    if(d.status==='done'&&d.fresh===true)return {text:h.kontrolaHotova,obnov:true};
    if(d.status==='done'){const dt=datum(d.report&&typeof d.report==='object'?d.report.at:null,lang);return dt?{text:vypln(h.kontrolaStara,{datum:dt}),chyba:true,obnov:true}:{text:h.kontrolaZlyhala,chyba:true,obnov:true};}
    if(d.status==='failed')return {text:h.kontrolaZlyhala,chyba:true,obnov:true};
    if(d.status==='not_configured')return {text:s.weekly.not_configured,chyba:true};
    if(d.status==='running'||d.status==='pending')return {text:h.kontrolaBezi,neskor:true};
    return {text:h.chyba,chyba:true};
  }
  if(status===429){const dt=datumCas(d.last_at,lang);return {text:dt?vypln(h.kontrolaLimitDatum,{datum:dt}):h.kontrolaLimit,chyba:true};}
  return null;
}
/** Odpoveď DELETE /v1/monitors/:id: zmazane, nezrusene (200 so subscription_cancelled false: monitor je preč, predplatné
 * treba zrušiť v portáli), portal (502: nič sa nezmazalo, predplatné sa nedalo zrušiť), inak null (všeobecná chyba). */
export function vysledokZmazania(status,data){
  if(status===404)return {zmazane:true,nezrusene:false};
  if(status>=200&&status<300)return {zmazane:true,nezrusene:Boolean(data&&typeof data==='object'&&data.subscription_cancelled===false)};
  if(status===502)return {zmazane:false,portal:true};
  return null;
}

/** Čakanie na plan 'pro' po platbe: GET každé 3 s najviac 120 s (PRODUKT.md časť 3). Hodiny a čakanie sú vstrieknuté (testy). */
export async function cakajNaPro({nacitaj,interval=POLLING.interval,limit=POLLING.limit,now=()=>Date.now(),spi=ms=>new Promise(r=>setTimeout(r,ms)),aktualne=()=>true,priStave=()=>{}}){
  const start=now();let posledne=null;
  for(;;){
    if(!aktualne())return {vysledok:'zrusene',data:posledne};
    let data=null;try{data=await nacitaj();}catch{data=null;}
    if(!aktualne())return {vysledok:'zrusene',data:posledne};
    if(data){posledne=data;priStave(data);if(data.plan==='pro')return {vysledok:'pro',data};}
    if(now()-start+interval>limit)return {vysledok:'cas',data:posledne};
    await spi(interval);
  }
}
/** ar_straz_paid raz za monitor (localStorage 'straz:zaplatene:<id>'). Bez úložiska sa pošle (adresa sa potom vyčistí). */
export function zaplateneRaz(storage,id){
  const k='straz:zaplatene:'+id;
  try{if(storage.getItem(k))return false;storage.setItem(k,'1');return true;}catch{return true;}
}
/** Umami (PRODUKT.md časť 6): v test režime nič; bez načítaného Umami sa udalosť odloží do window.__strazFronta a pošle po načítaní.
 * cista: pri správe je v adrese kľúč, preto sa udalosť posiela s adresou bez parametrov. Nikdy nevyhodí výnimku. */
export function createTracker(win,{merat,cista=false}){
  const fronta=merat?(Array.isArray(win.__strazFronta)?win.__strazFronta:(win.__strazFronta=[])):[];
  const posli=(u,name,data)=>cista?u.track(p=>({...p,url:win.location?.pathname||'/',referrer:'',name,data})):u.track(name,data);
  function flush(){try{const u=win.umami;if(!u||typeof u.track!=='function')return;while(fronta.length){const [n,d]=fronta.shift();try{posli(u,n,d);}catch{}}}catch{}}
  function track(name,data){
    if(!merat)return Promise.resolve(false);
    try{const u=win.umami;if(u&&typeof u.track==='function'){flush();return Promise.resolve(posli(u,name,data)).then(()=>true,()=>false);}fronta.push([name,data]);}catch{}
    return Promise.resolve(false);
  }
  return {track,flush,fronta};
}

/* ---------------- DOM (len v prehliadači) ---------------- */
function node(tag,text,cls){const e=document.createElement(tag);if(text!=null)e.textContent=String(text);if(cls)e.className=cls;return e;}
function tlacidlo(text,cls){const b=node('button',text,cls);b.type='button';return b;}
/** Položka Na opravu alebo Pokazilo sa (nález brány 8, C2): názov, prvá veta opravy a odkaz na miesto. Všetko cez textContent,
 * odkaz len na https adresu z adresaMiesta (javascript:, data: ani http sa sem nedostanú). Bez opravy a miesta len názov. */
function polozkaPravidla(r,s){
  const li=node('li');li.append(node('span',r.title,'st-pravidlo-nazov'));
  if(r.fix)li.append(node('p',r.fix,'ar-muted st-pravidlo-oprava'));
  const href=adresaMiesta(r.where);
  if(href){const p=node('p',null,'st-pravidlo-miesto');p.append(s.kde+' ');const a=node('a',href.replace(/^https:\/\//,'').slice(0,120));a.href=href;a.rel='noopener noreferrer';p.append(a);li.append(p);}
  return li;
}
const spi=ms=>new Promise(r=>setTimeout(r,ms));
const init={credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer'};

function nacitajUmami(tracker,cista){
  if(location.hostname!=='arling.sk')return;
  const s=document.createElement('script');s.src=UMAMI_SKRIPT;s.defer=true;s.dataset.websiteId=UMAMI_WEB;
  // Adresa správy nesie kľúč: bez zobrazenia stránky v Umami a bez parametrov v adrese udalostí.
  s.dataset.excludeSearch='true';s.dataset.excludeHash='true';if(cista)s.dataset.autoTrack='false';
  s.addEventListener('load',()=>tracker.flush());document.head.append(s);
}

export function spustPredaj(t,lang,rez,tracker){
  const $=id=>document.getElementById(id);
  const ponuka=[...document.querySelectorAll('[data-ponuka]')],coskoro=[...document.querySelectorAll('[data-coskoro]')];
  if(rez.test){const p=$('st-test');if(p){p.textContent=t.test;p.hidden=false;}}
  const stavHotovy=nacitajStav((u,i)=>fetch(u,i)).then(stav=>{
    const vidno=ponukaViditelna(stav,rez.test);
    for(const e of ponuka)e.hidden=!vidno;for(const e of coskoro)e.hidden=vidno;
    // Bez ponuky nadpis nevyzýva na zapnutie, ktoré sa nedá urobiť.
    const nad=$('st-objednat-nadpis');if(nad&&!vidno)nad.textContent=t.coskoroNadpis;
    if(vidno)tracker.track('ar_straz_offer_view',{lang,place:'page'});
  });
  const form=$('straz-form');if(!form)return stavHotovy;
  const pole={store_url:$('st-obchod'),email:$('st-email'),feed_url:$('st-feed')},odoslat=$('st-odoslat'),stav=$('st-stav'),chyba=$('st-chyba');
  const odoslanie=createLatest();let odosiela=false,odislo=false;
  function oznac(polia){for(const [k,el] of Object.entries(pole)){const zle=polia.includes(k);el.setAttribute('aria-invalid',String(zle));const h=$(el.id+'-chyba');if(h){h.textContent=zle?t.form.polia[k]:'';h.hidden=!zle;}}}
  function ukazChybu(kod,polia=[]){oznac(polia);stav.textContent='';chyba.textContent=t.form.chyby[kod]||t.form.chyby.server;chyba.hidden=false;if(polia.length)pole[polia[0]].focus();}
  function hotovo(){odosiela=false;odoslat.disabled=false;form.removeAttribute('aria-busy');}
  for(const el of Object.values(pole))el.addEventListener('input',()=>{if(el.getAttribute('aria-invalid')==='true'){el.setAttribute('aria-invalid','false');const h=$(el.id+'-chyba');if(h)h.hidden=true;}});
  // Návrat tlačidlom Späť zo Stripe (bfcache): formulár znova odoslateľný, údaje ostali.
  addEventListener('pageshow',e=>{if(e.persisted){odoslanie.cancel();odislo=false;hotovo();stav.textContent='';}});
  form.addEventListener('submit',async e=>{
    e.preventDefault();if(odosiela)return;
    chyba.hidden=true;chyba.textContent='';
    let raw=null;try{raw=localStorage.getItem(NAVRAT_KLUC);}catch{}
    const p=pripravTelo({obchod:pole.store_url.value,email:pole.email.value,feed:pole.feed_url.value,lang,test:rez.test,predosly:predoslyNavrat(raw)});
    if(p.chyby.length){ukazChybu('validation',p.chyby);return;}
    oznac([]);pole.store_url.value=p.telo.store_url;if(p.telo.feed_url)pole.feed_url.value=p.telo.feed_url;
    odosiela=true;odoslat.disabled=true;form.setAttribute('aria-busy','true');stav.textContent=t.form.odosielam;
    const req=odoslanie.begin(),limit=setTimeout(()=>{if(req.current()){odoslanie.cancel();hotovo();ukazChybu('network');}},20000);
    try{
      const res=await fetch(API+'/v1/straz',{...init,method:'POST',signal:req.signal,headers:{'content-type':'application/json'},body:JSON.stringify(p.telo)});
      let data=null;try{data=await res.json();}catch{}
      if(!req.current())return;
      const v=vysledokOdoslania(res.status,data);
      if(!v.ok){ukazChybu(v.chyba,v.polia);return;}
      const z=navratZaznam(v.id,v.key,lang);try{if(z)localStorage.setItem(NAVRAT_KLUC,z);}catch{}
      stav.textContent=t.form.presmerovanie;
      await Promise.race([tracker.track('ar_straz_subscribe_click',{lang,place:'page'}),spi(400)]);
      if(!req.current())return;
      odislo=true;location.assign(v.checkout);
    }catch{if(req.current())ukazChybu('network');}
    finally{clearTimeout(limit);if(req.current()&&!odislo)hotovo();}
  });
  return stavHotovy;
}

/** opt: nastavenia čakania po platbe pre testy (interval, limit, now, spi), predáva sa do cakajNaPro. */
export async function spustSpravu(t,lang,par,rez,tracker,opt={}){
  const s=t.sprava,predaj=document.getElementById('predaj'),sekcia=document.getElementById('sprava');
  if(predaj)predaj.hidden=true;if(!sekcia)return;sekcia.hidden=false;sekcia.replaceChildren();
  // Nález brány 10: hlavný nadpis stránky povie „Vaša Stráž e-shopu“ a h2 pod ním je adresa obchodu (skrytý, kým ju nepoznáme),
  // nie ten istý názov dvakrát pod sebou. Bez h1 (iná stránka) ostane h2 s názvom ako doteraz.
  const h1=document.getElementById('st-nadpis');
  const h=node('h2',h1?null:s.nadpis,h1?'st-adresa':null);h.id='sprava-nadpis';h.tabIndex=-1;
  if(h1){h1.textContent=s.nadpis;h1.tabIndex=-1;h.hidden=true;sekcia.setAttribute('aria-labelledby','st-nadpis');}
  const ciel=h1||h;
  const hlavny=node('p',null,'ar-status st-hlavny-stav');hlavny.setAttribute('role','status');hlavny.setAttribute('aria-live','polite');
  const obsah=node('div',null,'st-sprava-obsah');
  const spat=node('p',null,'st-spat');const a=node('a',s.spatNaPredaj);a.href=cestaStraze(lang);spat.append(a);
  sekcia.append(h,hlavny,obsah,spat);
  if(rez.test){const p=node('p',t.test,'ar-muted st-test');sekcia.insertBefore(p,obsah);}
  if(!par.platne){hlavny.textContent=s.zlaAdresa;return;}
  const {id,key}=par,nacitanie=createLatest(),hlasenia=new Map();let aktualne=null,zdroje=null,zmazane=false;
  // Po návrate zo Stripe (paid=1) sa počas overovania ani po vypršaní 120 s nikdy neukáže výzva na platbu (riziko dvojitej
  // platby); vypne sa až pri pláne pro. Nález brány 7: plán „Platba sa overuje“ a veta o prvej kontrole po potvrdení platby
  // (overujem); Zmazať je skryté len kým beží overovanie (najviac 120 s), aby zákazník nezmazal monitor, ktorý webhook o chvíľu zapne.
  let overujem=par.paid===true,overovanieBezi=par.paid===true;
  hlavny.textContent=s.nacitavam;
  const zdrojePromise=Promise.all([import('../feed-doctor/agent-ready/eu-zobraz.mjs'),import('../feed-doctor/agent-ready/core.mjs'),import('../feed-doctor/agent-ready/i18n.mjs?v=3')])
    .then(([eu,core,i18n])=>({EU_UI:i18n.EU_UI,toneOf:eu.toneOf,EU_CODES:eu.EU_CODES,RULES:core.RULES,localRule:i18n.localRule}),()=>null);
  // W4: názvy pravidiel feedu (hubová kópia Feed Doctora); bez nej sa zoznam najčastejších problémov vynechá, počty ostanú.
  const feedNazvyPromise=import('../feed-doctor/feed-doctor.js').then(fd=>nazvyPravidielFeedu(fd,lang),()=>new Map());let feedNazvy=null;

  async function nacitaj(){
    const req=nacitanie.begin();
    try{
      const res=await fetch(adresaStatusu(id,key),{...init,signal:req.signal});
      if(!req.current())return {stare:true};
      if(res.status===404)return {chyba:'nenajdene'};
      if(!res.ok)return {chyba:res.status===503?'nedostupne':'chybaNacitania'};
      const d=await res.json();if(!req.current())return {stare:true};
      return platnyStav(d,id)?{data:d}:{chyba:'chybaNacitania'};
    }catch{return req.current()?{chyba:'siet'}:{stare:true};}
  }
  async function obnov(){
    const r=await nacitaj();if(r.stare||zmazane)return null;
    if(r.chyba){if(!aktualne)hlavny.textContent=s[r.chyba];else hlasenie('hore',{text:s[r.chyba],chyba:true});return null;}
    hlasenie('hore',null);
    await vykresli(r.data);return r.data;
  }
  function hlasenie(blok,h){if(h)hlasenia.set(blok,h);else hlasenia.delete(blok);const el=obsah.querySelector(`[data-hlasenie="${blok}"]`);if(el)napisHlasenie(el,h);}
  function napisHlasenie(el,h){el.replaceChildren();el.hidden=!h;if(!h)return;el.className='st-hlasenie'+(h.chyba?' st-hlasenie-chyba':'');el.append(h.text);
    if(h.odkaz){el.append(' ');const a=node('a',h.odkaz.text);a.href=h.odkaz.href;a.rel='noopener';el.append(a);}}
  function miestoHlasenia(blok){const p=node('p');p.dataset.hlasenie=blok;p.setAttribute('role','status');napisHlasenie(p,hlasenia.get(blok));return p;}
  // Akcia: jedno tlačidlo naraz (dvojklik nič nepošle dvakrát), poradie cez createLatest, chyba nič neukáže ako hotové.
  const akcie=createLatest();let bezi=false;
  async function akcia(blok,button,fn){
    if(bezi||zmazane)return;bezi=true;const povodny=button.textContent;button.disabled=true;button.setAttribute('aria-busy','true');
    const req=akcie.begin();hlasenie(blok,{text:s.pracujem});
    try{const h=await fn(req);if(req.current())hlasenie(blok,h);}
    catch{if(req.current())hlasenie(blok,{text:s.hlasenia.siet,chyba:true});}
    finally{bezi=false;if(button.isConnected){button.disabled=false;button.removeAttribute('aria-busy');button.textContent=povodny;}}
  }
  async function post(url,telo){
    const res=await fetch(url,{...init,method:'POST',headers:telo?{'content-type':'application/json'}:undefined,body:telo?JSON.stringify(telo):undefined});
    let data=null;try{data=await res.json();}catch{}return {status:res.status,data};
  }
  const vseobecna=st=>({text:st===503?s.hlasenia.nedostupne:st===402?s.hlasenia.proRequired:s.hlasenia.chyba,chyba:true});

  async function vykresli(d){
    aktualne=d;const z=zdroje||(zdroje=await zdrojePromise);const fn=feedNazvy||(feedNazvy=await feedNazvyPromise);if(aktualne!==d||zmazane)return;
    const ps=planStav(d),pro=ps==='pro'||ps==='pro_zrusene',store=cistyText(d.store_url,300),feed=cistyText(d.feed_url,500);
    if(hlavny.dataset.drzat!=='1')hlavny.textContent='';
    if(h1){let host='';try{host=store?new URL(store).host:'';}catch{host='';}h.textContent=host;h.hidden=!host;}
    obsah.replaceChildren();
    const dl=node('dl',null,'st-udaje');
    const riadok=(k,v)=>{const w=node('div');w.append(node('dt',k),node('dd',v));dl.append(w);};
    riadok(s.udaje.plan,!pro&&overujem?s.plan.overuje:s.plan[ps]);riadok(s.udaje.obchod,store||s.obchodNie);riadok(s.udaje.feed,feed||s.feedNie);
    if(cistyText(d.email_masked,120))riadok(s.udaje.email,cistyText(d.email_masked,120));
    riadok(s.udaje.emaily,d.mail_off===true?s.emailyVyp:s.emailyZap);
    if(pro)riadok(s.udaje.predplatne,ps==='pro'?s.predplatneBezi:datum(d.cancel_at,lang)?vypln(s.predplatneKonci,{datum:datum(d.cancel_at,lang)}):s.predplatneKonciBez);
    obsah.append(dl,miestoHlasenia('hore'));

    if(!pro&&overujem){const box=node('div',null,'st-blok st-platba');box.append(node('p',s.paid.netrebaZnova));obsah.append(box);}
    else if(!pro){
      const box=node('div',null,'st-blok st-platba');
      box.append(node('p',ps==='caka'?s.cakaVeta:s.freeVeta));
      const href=bezpecnyCheckout(rez.test?d.upgrade_url_test:d.upgrade_url);
      if(href){const a=node('a',ps==='caka'?s.dokoncitPlatbu:s.zapnutStraz,'ar-next-link');a.href=href;
        a.addEventListener('click',()=>{const z=navratZaznam(id,key,lang);try{if(z)localStorage.setItem(NAVRAT_KLUC,z);}catch{}});box.append(a);}
      else box.append(node('p',s.bezOdkazu,'ar-muted'));
      obsah.append(box);
    }

    // Posledná kontrola obchodu
    const ob=node('section',null,'st-blok');ob.setAttribute('aria-labelledby','st-obchod-nadpis');const oh=node('h3',s.obchodNadpis);oh.id='st-obchod-nadpis';ob.append(oh);
    const w=weeklyStav(d.weekly);
    if(!pro)ob.append(node('p',overujem?s.weekly.poPlatbe:s.weekly.none,'ar-muted'));
    else if(!w)ob.append(node('p',store?s.weekly.pending:s.weekly.not_configured));
    else if(w.status!=='done')ob.append(node('p',s.weekly[w.status]));
    else{
      // Zmena zmluvy Z3: skóre null (obchod bez čitateľných produktových stránok) je pravdivá veta, nie „?“ ani „bez nálezov“.
      const bezSkore=w.score===null;
      if(bezSkore)ob.append(node('p',vypln(s.skoreNull,{datum:datum(w.at,lang)||'?'}),'st-skore'),node('p',s.skoreNullVysvetlenie,'ar-muted'));
      else ob.append(node('p',vypln(s.skore,{datum:datum(w.at,lang)||'?',skore:w.score,pokrytie:w.coverage??'?'}),'st-skore'),node('p',s.skoreVysvetlenie,'ar-muted'));
      // Bez modulov agent-ready (chyba načítania) ostane len skóre; nič sa neukáže ako „bez nálezov“.
      if(z){
      const eu=euRiadky(w.eu,lang,z);
      // Postup Shoptetu (relácia 218, brána D1) ako vlastný odsek pod vetou, nie tlmený, s nadpisom „Overte ručne:“ ako na stránke kontroly.
      if(eu.length){ob.append(node('h4',s.euNadpis));const ul=node('ul',null,'st-eu');for(const r of eu){const li=node('li');const b=node('span',r.badge,'ar-eu-badge');b.dataset.tone=r.tone;li.append(node('span',r.title,'st-eu-nazov'),b);if(r.veta)li.append(node('p',r.veta,'ar-muted st-eu-veta'));
        if(r.postup){const p=node('p',null,'st-eu-postup');if(r.postupNadpis)p.append(node('strong',r.postupNadpis+':'),' ');p.append(r.postup);li.append(p);}ul.append(li);}ob.append(ul);}
      if(!bezSkore){const zly=nazvyPravidiel(w.failing,lang,z);ob.append(node('h4',s.zlyhaneNadpis));
      if(zly.length){const ul=node('ul',null,'st-zoznam st-pravidla');for(const r of zly)ul.append(polozkaPravidla(r,s));ob.append(ul);}else ob.append(node('p',s.zlyhaneZiadne));}
      const zm=zmenyPodlaSmeru(w.changed,lang,z,{eu:w.eu,failing:w.failing});
      for(const [k,nadpis] of [['pokazene',s.pokaziloNadpis],['opravene',s.opraviloNadpis]])if(zm[k].length){ob.append(node('h4',nadpis));const ul=node('ul',null,'st-zoznam st-pravidla');for(const r of zm[k])ul.append(polozkaPravidla(r,s));ob.append(ul);}
      }
    }
    if(pro&&d.status==='active'&&store){
      const b=tlacidlo(s.skontrolovat,'ar-quiet');
      b.addEventListener('click',()=>akcia('obchod',b,async()=>{
        const r=await post(adresaAgentReady(id,key,true));
        const v=vysledokKontroly(r.status,r.data,lang,s);if(!v)return vseobecna(r.status);
        if(v.obnov)await obnov();
        if(v.neskor)setTimeout(()=>{if(!zmazane)obnov();},60000);
        return {text:v.text,chyba:v.chyba===true};
      }));
      const akc=node('div',null,'ar-actions');akc.append(b);ob.append(akc);
    }
    ob.append(miestoHlasenia('obchod'));obsah.append(ob);

    // Feed
    const fb=node('section',null,'st-blok');fb.setAttribute('aria-labelledby','st-feed-nadpis');const fh=node('h3',s.feedNadpis);fh.id='st-feed-nadpis';fb.append(fh);
    if(!feed)fb.append(node('p',s.feedZiadny));
    else{
      // W4: skóre feedu sa neukazuje, last_score slúži len ako znak, že posledná kontrola feed vyhodnotila (stav ok).
      const vyhodnoteny=cele(d.last_score,0,100)!=null,veta=vyhodnoteny?vetaFeedu(d,s,lang):'';
      fb.append(node('p',veta||s.feedZiadnaKontrola));
      const vzorka=veta?vetaVzorky(d,s):'';if(vzorka)fb.append(node('p',vzorka,'ar-muted st-feed-vzorka'));
      const problemy=veta?problemyFeedu(d.last_top_issues,lang,fn):[];
      if(problemy.length){fb.append(node('h4',s.feedProblemyNadpis));const ul=node('ul',null,'st-zoznam st-feed-problemy');for(const p of problemy)ul.append(node('li',`${p.nazov} (${p.pocet})`));fb.append(ul);}
      const hist=historiaFeedu(d.history),stlpce=stlpceHistorie(hist);
      if(hist.length){const wrap=node('div',null,'st-tabulka');const tab=node('table');tab.append(node('caption',s.historia.popis));const th=node('tr');for(const k of stlpce)th.append(node('th',s.historia[k]));const thead=node('thead');thead.append(th);const tb=node('tbody');
        for(const r of hist){const tr=node('tr');for(const v of bunkyHistorie(r,lang,stlpce))tr.append(node('td',v));tb.append(tr);}tab.append(thead,tb);wrap.append(tab);fb.append(wrap);}
    }
    obsah.append(fb);

    // Nastavenia
    const nb=node('section',null,'st-blok');nb.setAttribute('aria-labelledby','st-nast-nadpis');const nh=node('h3',s.nastaveniaNadpis);nh.id='st-nast-nadpis';nb.append(nh);
    if(pro&&d.status==='active'){
      const otvor=tlacidlo(store?s.zmenitObchod:s.nastavitObchod,'ar-quiet st-plna');const form=node('form',null,'ar-form st-uprava');form.hidden=true;form.noValidate=true;
      const lab=node('label',s.poleObchod);const inp=node('input');inp.id='st-uprava-obchod';lab.htmlFor=inp.id;inp.type='text';inp.inputMode='url';inp.autocomplete='url';inp.spellcheck=false;inp.maxLength=2048;inp.value=store;inp.placeholder=lang==='de'?'https://ihr-shop.de':lang==='en'?'https://your-shop.com':'https://vas-obchod.sk';
      const ulozit=node('button',s.ulozit);ulozit.type='submit';const nie=tlacidlo(s.zrusitUpravu,'ar-quiet');const fa=node('div',null,'ar-actions');fa.append(ulozit,nie);form.append(lab,inp,fa);
      otvor.addEventListener('click',()=>{form.hidden=false;otvor.hidden=true;inp.focus();});
      nie.addEventListener('click',()=>{form.hidden=true;otvor.hidden=false;inp.value=store;inp.removeAttribute('aria-invalid');hlasenie('nastavenia',null);});
      form.addEventListener('submit',e=>{e.preventDefault();const url=normalizujObchod(inp.value);
        if(!url){inp.setAttribute('aria-invalid','true');hlasenie('nastavenia',{text:s.hlasenia.zlaAdresaObchodu,chyba:true});inp.focus();return;}
        inp.setAttribute('aria-invalid','false');
        akcia('nastavenia',ulozit,async req=>{
          const g=await fetch(adresaAgentReady(id,key),{...init});if(!g.ok)return vseobecna(g.status);
          const cur=await g.json();if(!req.current())return null;
          const nast=cur&&typeof cur==='object'&&cur.settings&&typeof cur.settings==='object'?cur.settings:null;
          const revision=nast&&Number.isInteger(nast.revision)&&nast.revision>=0?nast.revision:0;
          const product_url=produktTehoIstehoObchodu(nast?.product_url,url);
          const r=await post(adresaAgentReady(id,key),{store_url:url,product_url,revision});
          if(r.status===200){await obnov();return {text:s.hlasenia.ulozene};}
          if(r.status===409){await obnov();return {text:s.hlasenia.konflikt,chyba:true};}
          if(r.status===400)return {text:s.hlasenia.zlaAdresaObchodu,chyba:true};
          return vseobecna(r.status);
        });});
      nb.append(otvor,form);
    }
    const nakc=node('div',null,'ar-actions st-nastavenia');
    const mail=tlacidlo(d.mail_off===true?s.zapnut:s.vypnut,'ar-quiet');
    mail.addEventListener('click',()=>akcia('nastavenia',mail,async()=>{const on=aktualne?.mail_off===true;const r=await post(adresaAkcie(id,key,'mail'),{on});
      if(r.status===200){await obnov();return {text:on?s.hlasenia.emailyZapnute:s.hlasenia.emailyVypnute};}return vseobecna(r.status);}));
    nakc.append(mail);
    if(ps==='pro'){const b=tlacidlo(s.zrusit,'ar-quiet');b.addEventListener('click',()=>akcia('nastavenia',b,async()=>{const r=await post(adresaAkcie(id,key,'cancel'));
      if(r.status===200&&r.data?.ok!==false){await obnov();const dt=datum(r.data?.cancel_at,lang);return {text:dt?vypln(s.hlasenia.zrusene,{datum:dt}):s.hlasenia.zruseneBez};}
      if(r.status===409){await obnov();return {text:s.hlasenia.notPro,chyba:true};}
      if(r.status===502)return {text:s.hlasenia.zrusenieZlyhalo,chyba:true,odkaz:{href:PORTAL,text:s.hlasenia.portal}};
      return vseobecna(r.status);}));nakc.append(b);}
    if(ps==='pro_zrusene'){const b=tlacidlo(s.obnovit);b.addEventListener('click',()=>akcia('nastavenia',b,async()=>{const r=await post(adresaAkcie(id,key,'resume'));
      if(r.status===200&&r.data?.ok!==false){await obnov();return {text:s.hlasenia.obnovene};}
      if(r.status===409){await obnov();return {text:s.hlasenia.notCancelled,chyba:true};}
      return vseobecna(r.status);}));nakc.append(b);}
    nb.append(nakc);if(ps==='pro')nb.append(node('p',s.zrusitVeta,'ar-muted'));nb.append(miestoHlasenia('nastavenia'));obsah.append(nb);

    // Zmazanie s potvrdením (#zmazat z e-mailu otvorí rovno otázku). Počas overovania platby (paid=1, ešte nie pro) skryté.
    if(!pro&&overovanieBezi)return;
    const zb=node('section',null,'st-blok st-zmazat');zb.id='zmazat';zb.setAttribute('aria-labelledby','st-zmazat-nadpis');const zh=node('h3',s.zmazatNadpis);zh.id='st-zmazat-nadpis';
    const riadokZ=node('div',null,'ar-actions');const zmaz=tlacidlo(s.zmazat,'ar-quiet st-nebezpecne');riadokZ.append(zmaz);
    // Veta o Zrušiť predplatné len pri bežiacom predplatnom (po zrušení alebo bez predplatného by nebola pravdivá).
    zb.append(zh,node('p',ps==='pro'?s.zmazatVeta+' '+s.zmazatVetaZrusit:s.zmazatVeta,'ar-muted'),riadokZ,miestoHlasenia('zmazat'));obsah.append(zb);
    function potvrd(){riadokZ.replaceChildren();const otazka=node('p',s.zmazatOtazka,'st-otazka');otazka.tabIndex=-1;const ano=tlacidlo(s.zmazatAno,'st-nebezpecne'),nie=tlacidlo(s.zmazatNie,'ar-quiet');
      nie.addEventListener('click',()=>{riadokZ.replaceChildren(zmaz);zmaz.focus();});
      ano.addEventListener('click',()=>akcia('zmazat',ano,async()=>{
        const res=await fetch(`${API}/v1/monitors/${encodeURIComponent(id)}?key=${encodeURIComponent(key)}`,{...init,method:'DELETE'});
        let data=null;try{data=await res.json();}catch{}
        const v=vysledokZmazania(res.status,data);
        if(v&&v.zmazane){zmazane=true;nacitanie.cancel();try{const n=JSON.parse(localStorage.getItem(NAVRAT_KLUC)||'null');if(n&&n.id===id)localStorage.removeItem(NAVRAT_KLUC);}catch{}
          try{history.replaceState(null,'',location.pathname);}catch{}
          obsah.replaceChildren();if(h1)h.hidden=true;hlavny.dataset.drzat='1';hlavny.textContent=s.hlasenia.zmazane;
          // Server zmazal monitor, ale predplatné nezrušil: povedať to a dať odkaz na portál, inak by platba bežala ďalej potichu.
          if(v.nezrusene){const p=node('p');p.setAttribute('role','alert');napisHlasenie(p,{text:s.hlasenia.zmazaneNezrusene,chyba:true,odkaz:{href:PORTAL,text:s.hlasenia.portal}});obsah.append(p);}
          ciel.focus();return null;}
        if(v&&v.portal)return {text:s.hlasenia.zmazanieZlyhalo,chyba:true,odkaz:{href:PORTAL,text:s.hlasenia.portal}};
        return vseobecna(res.status);}));
      riadokZ.append(otazka,ano,nie);otazka.focus();}
    zmaz.addEventListener('click',potvrd);
    if(location.hash==='#zmazat'&&!vykresli.zmazatOtvorene){vykresli.zmazatOtvorene=true;potvrd();zb.scrollIntoView({block:'start'});}
  }

  if(!par.paid){await obnov();return;}
  // Návrat po platbe (PRODUKT.md časť 3)
  const t3=s.paid,cakanie=createLatest().begin();hlavny.dataset.drzat='1';hlavny.textContent=t3.overujem;
  const r=await cakajNaPro({...opt,nacitaj:async()=>{const x=await nacitaj();return x.data||null;},aktualne:()=>cakanie.current()&&!zmazane,priStave:d=>{if(d.plan==='pro')overujem=false;return vykresli(d);}});
  if(r.vysledok==='pro'){
    overujem=false;hlavny.textContent=t3.zapnute;
    if(zaplateneRaz(localStorage,id))tracker.track('ar_straz_paid',{lang});
    try{const n=JSON.parse(localStorage.getItem(NAVRAT_KLUC)||'null');if(n&&n.id===id)localStorage.removeItem(NAVRAT_KLUC);}catch{}
    try{history.replaceState(null,'',bezPaid(location.href));}catch{}
  }else if(r.vysledok==='cas'){
    hlavny.textContent=t3.caka;overovanieBezi=false;
    try{await fetch(adresaAkcie(id,key,'paid-return'),{...init,method:'POST'});}catch{}
    // Po 120 s sa vráti Zmazať: prekreslí sa posledný zobrazený stav (nikdy starší než ten, čo už je na stránke), bez ďalšieho GET.
    if(!zmazane){if(aktualne)await vykresli(aktualne);else await obnov();}
  }
}

if(typeof window!=='undefined'&&typeof document!=='undefined'&&document.documentElement){
  const lang=jazyk(document.documentElement.lang),t=TEXTY[lang],par=parametre(location.search);
  let ss=null;try{ss=sessionStorage;}catch{}
  const rez=testRezim(location.search,ss),mod=rezim(par);
  const tracker=createTracker(window,{merat:rez.merat,cista:mod!=='predaj'});
  if(rez.merat)nacitajUmami(tracker,mod!=='predaj');
  if(mod==='predaj')spustPredaj(t,lang,rez,tracker);else spustSpravu(t,lang,par,rez,tracker);
}
