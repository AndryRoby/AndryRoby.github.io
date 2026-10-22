/*
 * Stráž e-shopu vo výsledku bezplatnej kontroly (relácia 209, 22. 10. 2026). Zmluva: ops/druhy-ucet/209/PRODUKT.md.
 *
 * buildStrazBox(lang, place, platform, report) vyrobí box ponuky (názov, cena, čo sleduje, ako často, e-mail len pri zmene,
 * zrušenie jedným klikom, adresa obchodu ako text, e-mail, nepovinný feed, Pokračovať na platbu). strazLink(kod, lang) vyrobí
 * odkaz „Sledovať ďalej“ na kotvu boxu a zapamätá si kód nálezu pre meranie. Texty SK, EN, DE sú v tomto súbore (nie v i18n.mjs,
 * ten mení relácia 208). app.mjs modul načíta voliteľne: strazOn() povie, či sa ponuka smie ukázať (/straz-eshopu/stav.json má
 * live true alebo je zapnutý test: ?test=1 uložené v sessionStorage 'straz:test' = '1'); inak sa nevloží nič.
 *
 * Odoslanie: POST https://feed-monitor.arling.workers.dev/v1/straz {store_url, email, lang, feed_url, test}; pri 200 alebo 201 sa
 * overí tvar odpovede (id, key, checkout_url len https://buy.stripe.com/), uloží sa localStorage 'straz:navrat' {id, key, lang, at},
 * pošle sa Umami ar_straz_subscribe_click {lang, place, finding?}, počká sa na jeho odoslanie najviac 400 ms a location.assign(checkout_url).
 * Umami nikdy nedostane adresu obchodu, feedu ani e-mail; pri ?test alebo sessionStorage 'straz:test' sa nepošle nič.
 * Kolo 1 (PRODUKT.md časť 6b): Z2 dopyt nesie prev_id a prev_key zo 'straz:navrat', ak je mladší ako 24 h; Z1 403 test_not_allowed
 * povie, že testovací režim je len pre ARLing; Z3 pri skóre null alebo 0 stránkach box povie, že údaje pre AI sa nedali vyhodnotiť;
 * Z5 kontakt SK podpora@arling.sk, EN a DE support@arling.sk.
 *
 * AGENTS.md bod 12: naraz beží jeden dopyt (polia len na čítanie, tlačidlo vypnuté), každý dopyt má poradové číslo a odpoveď, ktorá
 * nepatrí poslednému, alebo prišla do boxu, ktorý už nie je na stránke (nová kontrola), sa zahodí; časový limit; chyba nič neukáže
 * ako hotové a údaje ostanú vo formulári; texty len cez textContent; odpoveď, ktorá sa nedá bezpečne použiť, sa odmietne.
 * Bez vložených skriptov a štýlov (CSP): štýly sú v straz-box.css, ktorý modul pripojí cez <link>. Testy: straz.test.mjs.
 */
import {RULES} from './core.mjs';
import {EU_CODES,validEu,toneOf} from './eu-zobraz.mjs';

export const API='https://feed-monitor.arling.workers.dev/v1/straz';
export const STAV_URL='/straz-eshopu/stav.json';
export const BOX_ID='ar-straz';
export const NAVRAT='straz:navrat',TEST_KLUC='straz:test';
export const STRANKA={sk:'/straz-eshopu/',en:'/straz-eshopu/en/',de:'/straz-eshopu/de/'};
const JAZYKY=['sk','en','de'],MIESTA=['result','sample'],PLATFORMY=['yes','no','unknown'];
const ZNAME=new Set([...RULES.map(r=>r.code),...EU_CODES]);

export const T={
 sk:{
  title:'Stráž e-shopu: táto kontrola znova každý týždeň',
  lead:'Stráž zopakuje túto kontrolu každý týždeň a napíše vám, keď sa výsledok zmení: keď sa niečo pokazí alebo keď sa oprava prejaví.',
  shopify:'Stráž funguje na každej platforme vrátane Shopify a do obchodu sa nič neinštaluje. Je to samostatná služba, nie Pro v našej appke pre Shopify.',
  watchTitle:'Čo sleduje',
  watch:['Povinnosti EÚ na verejných stránkach obchodu, raz týždenne: funkciu na odstúpenie od zmluvy online, oznámenie o zákonnej záruke a všeobecné environmentálne tvrdenia.',
   'Údaje pre AI nákupných asistentov, raz týždenne: cenu, dostupnosť, dopravu a vrátenie v údajoch produktov a v zásadách obchodu (najviac 20 produktov a 3 produktové stránky).',
   'Chyby produktového feedu, každý deň, ak zadáte jeho adresu.'],
  noAi:'Údaje pre AI nákupných asistentov sa pri tomto obchode nedali vyhodnotiť, lebo sme nenašli čitateľné produktové stránky. Stráž bude každý týždeň sledovať povinnosti EÚ a údaje pre AI vyhodnotí, keď budú produktové stránky čitateľné.',
  watchNoAi:'Údaje pre AI nákupných asistentov, raz týždenne, keď budú produktové stránky čitateľné: cenu, dostupnosť, dopravu a vrátenie v údajoch produktov (najviac 20 produktov a 3 produktové stránky). Teraz sa nedali vyhodnotiť.',
  often:'Prvá kontrola prebehne hneď po zaplatení. Potom obchod raz týždenne a feed každý deň.',
  mail:'E-mail príde hneď po zapnutí s prvými výsledkami a potom len pri zmene. Keď sa nič nezmení, nepíšeme.',
  limits:'Číta len verejné stránky, bez prihlásenia a bez spúšťania JavaScriptu; nič sa neinštaluje. Je to technická kontrola, nie právna rada.',
  store:'Obchod:',
  emailLabel:'E-mail pre správy',emailHint:'Sem pošleme prvé výsledky a správy o zmenách.',
  feedLabel:'Adresa produktového feedu (nepovinné)',
  feedHint:'Shoptet: v administrácii otvorte Prepojenie, XML feedy, Google nákupy a skopírujte adresu feedu. Feed vo formáte Heureka zatiaľ nehodnotíme a povieme vám to.',
  name:'Stráž e-shopu',price:'9 € mesačne vrátane DPH',
  cancel:'Zrušíte kedykoľvek jedným klikom na stránke Stráže. Predplatné skončí na konci zaplateného mesiaca, ďalšia platba už nebude.',
  button:'Pokračovať na platbu',sending:'Pripravujem platbu',redirect:'Otváram platbu v Stripe',
  pay:'Predajcom pri platbe je Link (Sold through Link, LLC) cez Stripe, ktorý vám pošle doklad. V pokladni Stripe sa položka volá Feed Doctor Monitor.',
  privacy:['E-mail a adresy použijeme len na Stráž: kontroly, správy o zmenách a predplatné. Ako ich uchovávame:','arling.sk/privacy/#s4','/privacy/#s4'],
  more:'Viac o Stráži e-shopu',
  sample:'Toto je ukážka fiktívneho obchodu, preto sa tu Stráž zapnúť nedá. Najprv skontrolujte svoj obchod.',sampleLink:'Skontrolovať môj obchod',
  link:'Sledovať ďalej',linkAria:'Sledovať ďalej: Stráž e-shopu, 9 € mesačne',
  errors:{email:'Zadajte platný e-mail, napríklad meno@obchod.sk.',
   feed:'Adresa feedu musí začínať https:// alebo http://. Pole môžete nechať prázdne.',
   store:'Adresu tohto obchodu Stráž neprijala. Skontrolujte obchod znova s jeho verejnou adresou.',
   invalid:'Údaje sa nepodarilo overiť. Skontrolujte e-mail a adresu feedu.',
   active:'Na tento e-mail už u nás beží monitor. Odkaz na jeho správu je v e-maile, ktorý ste od nás dostali; pomôžeme aj na podpora@arling.sk.',
   rate:'Z tejto siete prišlo za hodinu priveľa žiadostí. Skúste to neskôr, údaje ostali vo formulári.',
   server:'Server žiadosť nespracoval. Skúste to znova, údaje ostali vo formulári.',
   network:'Spojenie zlyhalo. Skúste to znova, údaje ostali vo formulári.',
   timeout:'Server neodpovedal včas. Žiadosť mohla prísť; skúste to znova, druhý monitor nevznikne.',
   bad:'Odpoveď servera sa nedala bezpečne použiť, na platbu sme vás neposlali. Napíšte nám na podpora@arling.sk.',
   testOnly:'Testovací režim je len pre ARLing, na platbu sme vás neposlali. Zatvorte túto kartu a otvorte kontrolu znova bez test=1 v adrese.'}},
 en:{
  title:'Shop Guard: this check again every week',
  lead:'Shop Guard repeats this check every week and emails you when the result changes: when something breaks or when a fix shows up.',
  shopify:'Shop Guard works on every platform, Shopify included, and nothing is installed in your store. It is a separate service, not Pro in our Shopify app.',
  watchTitle:'What it watches',
  watch:['EU duties on the public pages of your store, once a week: the online withdrawal function, the notice on the legal guarantee and generic environmental claims.',
   'Data for AI shopping assistants, once a week: price, availability, shipping and returns in your product data and store policies (up to 20 products and 3 product pages).',
   'Errors in your product feed, every day, if you add its address.'],
  noAi:'Data for AI shopping assistants could not be evaluated for this store, because we found no readable product pages. Shop Guard will watch the EU duties every week and will evaluate the data for AI once the product pages are readable.',
  watchNoAi:'Data for AI shopping assistants, once a week as soon as the product pages are readable: price, availability, shipping and returns in your product data (up to 20 products and 3 product pages). It could not be evaluated now.',
  often:'The first check runs right after payment. Then the store once a week and the feed every day.',
  mail:'You get an email right after it starts, with the first results, and after that only when something changes. No change, no email.',
  limits:'Reads public pages only, without logging in and without running JavaScript; nothing is installed. A technical check, not legal advice.',
  store:'Store:',
  emailLabel:'Email for reports',emailHint:'We send the first results and change reports here.',
  feedLabel:'Product feed address (optional)',
  feedHint:'Shoptet: in the admin open Prepojenie (Connections), XML feedy, Google nákupy and copy the feed address. We do not evaluate feeds in the Heureka format yet and will tell you so.',
  name:'Shop Guard',price:'9 EUR a month, VAT included',
  cancel:'Cancel any time with one click on the Shop Guard page. The subscription ends at the end of the paid month, no further payment.',
  button:'Continue to payment',sending:'Preparing payment',redirect:'Opening payment in Stripe',
  pay:'At checkout the merchant of record is Link (Sold through Link, LLC) via Stripe, which sends you the receipt. In the Stripe checkout the item is called Feed Doctor Monitor.',
  privacy:['We use the email and addresses only for Shop Guard: checks, change reports and the subscription. How we keep them:','arling.sk/privacy/en/#s4','/privacy/en/#s4'],
  more:'More about Shop Guard',
  sample:'This is a sample from a fictional store, so Shop Guard cannot be started here. Check your own store first.',sampleLink:'Check my store',
  link:'Keep watching',linkAria:'Keep watching: Shop Guard, 9 EUR a month',
  errors:{email:'Enter a valid email, for example name@shop.com.',
   feed:'The feed address must start with https:// or http://. You can leave the field empty.',
   store:'Shop Guard did not accept the address of this store. Check the store again with its public address.',
   invalid:'We could not validate the details. Check the email and the feed address.',
   active:'A monitor already runs for this email. The link to manage it is in the email we sent you; you can also write to support@arling.sk.',
   rate:'Too many requests from this network in the last hour. Please try later; your details are still in the form.',
   server:'The server did not process the request. Please try again; your details are still in the form.',
   network:'The connection failed. Please try again; your details are still in the form.',
   timeout:'The server did not answer in time. The request may have arrived; try again, no second monitor is created.',
   bad:'The server answer could not be used safely, so we did not send you to payment. Please write to support@arling.sk.',
   testOnly:'Test mode is only for ARLing, so we did not send you to payment. Close this tab and open the check again without test=1 in the address.'}},
 de:{
  title:'Shop-Wächter: diese Prüfung jede Woche erneut',
  lead:'Der Shop-Wächter wiederholt diese Prüfung jede Woche und schreibt Ihnen, wenn sich das Ergebnis ändert: wenn etwas kaputtgeht oder eine Korrektur sichtbar wird.',
  shopify:'Der Shop-Wächter funktioniert auf jeder Plattform, auch mit Shopify, und in Ihrem Shop wird nichts installiert. Er ist ein eigener Dienst, nicht Pro in unserer Shopify-App.',
  watchTitle:'Was er beobachtet',
  watch:['EU-Pflichten auf den öffentlichen Seiten Ihres Shops, einmal pro Woche: die Online-Widerrufsfunktion, den Hinweis auf die gesetzliche Gewährleistung und allgemeine Umweltaussagen.',
   'Daten für KI-Einkaufsassistenten, einmal pro Woche: Preis, Verfügbarkeit, Versand und Rückgabe in Ihren Produktdaten und Shop-Richtlinien (bis zu 20 Produkte und 3 Produktseiten).',
   'Fehler in Ihrem Produktfeed, jeden Tag, wenn Sie seine Adresse angeben.'],
  noAi:'Die Daten für KI-Einkaufsassistenten ließen sich für diesen Shop nicht auswerten, weil wir keine lesbaren Produktseiten gefunden haben. Der Shop-Wächter beobachtet jede Woche die EU-Pflichten und wertet die Daten für KI aus, sobald die Produktseiten lesbar sind.',
  watchNoAi:'Daten für KI-Einkaufsassistenten, einmal pro Woche, sobald die Produktseiten lesbar sind: Preis, Verfügbarkeit, Versand und Rückgabe in Ihren Produktdaten (bis zu 20 Produkte und 3 Produktseiten). Jetzt ließen sie sich nicht auswerten.',
  often:'Die erste Prüfung läuft direkt nach der Zahlung. Danach der Shop einmal pro Woche und der Feed jeden Tag.',
  mail:'Sie bekommen direkt nach dem Start eine E-Mail mit den ersten Ergebnissen und danach nur, wenn sich etwas ändert. Ohne Änderung keine E-Mail.',
  limits:'Liest nur öffentliche Seiten, ohne Anmeldung und ohne JavaScript; nichts wird installiert. Eine technische Prüfung, keine Rechtsberatung.',
  store:'Shop:',
  emailLabel:'E-Mail für Berichte',emailHint:'Hierhin senden wir die ersten Ergebnisse und Berichte über Änderungen.',
  feedLabel:'Adresse des Produktfeeds (optional)',
  feedHint:'Shoptet: im Admin unter Prepojenie, XML feedy, Google nákupy die Feed-Adresse kopieren. Feeds im Heureka-Format bewerten wir noch nicht und sagen Ihnen das.',
  name:'Shop-Wächter',price:'9 EUR im Monat inkl. MwSt.',
  cancel:'Jederzeit mit einem Klick auf der Shop-Wächter-Seite kündbar. Das Abo endet zum Ende des bezahlten Monats, keine weitere Zahlung.',
  button:'Weiter zur Zahlung',sending:'Zahlung wird vorbereitet',redirect:'Zahlung in Stripe wird geöffnet',
  pay:'Verkäufer an der Kasse ist Link (Sold through Link, LLC) über Stripe; Link schickt Ihnen den Beleg. In der Stripe-Kasse heißt der Posten Feed Doctor Monitor.',
  privacy:['E-Mail und Adressen nutzen wir nur für den Shop-Wächter: Prüfungen, Berichte über Änderungen und das Abo. Wie wir sie speichern:','arling.sk/privacy/de/#s4','/privacy/de/#s4'],
  more:'Mehr über den Shop-Wächter',
  sample:'Dies ist ein Beispiel eines fiktiven Shops, daher lässt sich der Shop-Wächter hier nicht starten. Prüfen Sie zuerst Ihren eigenen Shop.',sampleLink:'Meinen Shop prüfen',
  link:'Weiter beobachten',linkAria:'Weiter beobachten: Shop-Wächter, 9 EUR im Monat',
  errors:{email:'Geben Sie eine gültige E-Mail-Adresse ein, zum Beispiel name@shop.de.',
   feed:'Die Feed-Adresse muss mit https:// oder http:// beginnen. Sie können das Feld leer lassen.',
   store:'Der Shop-Wächter hat die Adresse dieses Shops nicht angenommen. Prüfen Sie den Shop erneut mit seiner öffentlichen Adresse.',
   invalid:'Die Angaben ließen sich nicht prüfen. Prüfen Sie die E-Mail und die Feed-Adresse.',
   active:'Für diese E-Mail läuft bei uns bereits ein Monitor. Den Link zur Verwaltung finden Sie in unserer E-Mail; Hilfe auch unter support@arling.sk.',
   rate:'Aus diesem Netz kamen in der letzten Stunde zu viele Anfragen. Bitte später erneut versuchen; Ihre Angaben bleiben im Formular.',
   server:'Der Server hat die Anfrage nicht verarbeitet. Bitte erneut versuchen; Ihre Angaben bleiben im Formular.',
   network:'Die Verbindung ist fehlgeschlagen. Bitte erneut versuchen; Ihre Angaben bleiben im Formular.',
   timeout:'Der Server hat nicht rechtzeitig geantwortet. Die Anfrage kann angekommen sein; versuchen Sie es erneut, es entsteht kein zweiter Monitor.',
   bad:'Die Antwort des Servers ließ sich nicht sicher verwenden, daher haben wir Sie nicht zur Zahlung geschickt. Bitte schreiben Sie an support@arling.sk.',
   testOnly:'Der Testmodus ist nur für ARLing, daher haben wir Sie nicht zur Zahlung geschickt. Schließen Sie diesen Tab und öffnen Sie die Prüfung erneut ohne test=1 in der Adresse.'}}
};

// Závislosti, ktoré testy nahradia (fetch, časovače, presmerovanie, úložiská, okno pre Umami).
export const deps={
  fetch:(url,init)=>fetch(url,init),
  setTimeout:(f,ms)=>setTimeout(f,ms),
  clearTimeout:(t)=>clearTimeout(t),
  later:(f)=>queueMicrotask(f),
  timeoutMs:15000,stavMs:3000,
  assign:(url)=>location.assign(url),
  search:()=>typeof location!=='undefined'?String(location.search||''):'',
  local:()=>{try{return localStorage;}catch{return null;}},
  session:()=>{try{return sessionStorage;}catch{return null;}},
  win:()=>typeof window!=='undefined'?window:null,
  doc:()=>typeof document!=='undefined'?document:null,
  now:()=>new Date(),
  stav:null, // Promise<boolean> | null; prvé volanie strazOn() ju vytvorí
};

const jazyk=l=>JAZYKY.includes(l)?l:'en';
const parametre=()=>{try{return new URLSearchParams(deps.search());}catch{return new URLSearchParams();}};
/** Test mód ponuky: ?test=1 sa uloží do sessionStorage 'straz:test' = '1' a platí do zatvorenia karty. */
export function testMode(){
  const ss=deps.session();
  try{if(parametre().get('test')==='1')ss?.setItem(TEST_KLUC,'1');}catch{}
  try{return ss?.getItem(TEST_KLUC)==='1';}catch{return false;}
}
/** Umami mlčí pri akomkoľvek ?test v adrese aj pri zapnutom test móde (PRODUKT.md časť 6). */
const bezMerania=()=>parametre().has('test')||testMode();

/** Umami: skúsi window.umami, inak udalosť odloží do window.__strazFronta a pošle ju po načítaní skriptu; nikdy výnimku.
 *  Keď umami.track vráti Promise (Umami v2 posiela cez fetch), vráti Promise, ktorá sa vždy splní (aj pri chybe). */
export function track(name,data){
  if(bezMerania())return;
  const w=deps.win();if(!w)return;
  try{
    if(w.umami&&typeof w.umami.track==='function'){const r=w.umami.track(name,data);return r&&typeof r.then==='function'?Promise.resolve(r).then(()=>{},()=>{}):undefined;}
    (w.__strazFronta||(w.__strazFronta=[])).push([name,data]);
    if(w.__strazCaka)return;w.__strazCaka=true;let pokus=0;
    const tik=()=>{try{
      if(w.umami&&typeof w.umami.track==='function'){w.__strazCaka=false;for(const [n,d] of w.__strazFronta.splice(0)){try{w.umami.track(n,d);}catch{}}return;}
      if(++pokus<40)deps.setTimeout(tik,500);else w.__strazCaka=false;
    }catch{w.__strazCaka=false;}};
    deps.setTimeout(tik,500);
  }catch{}
}

function pridajStyl(){
  const d=deps.doc();if(!d||!d.head||d.querySelector?.('link[data-ar-straz]'))return;
  const l=d.createElement('link');l.rel='stylesheet';l.href=new URL('./straz-box.css?v=2',import.meta.url).href;l.dataset.arStraz='';d.head.append(l);
}
/** Smie sa ponuka ukázať? Test mód alebo /straz-eshopu/stav.json s live === true; chyba, pomalá odpoveď alebo iný tvar = nie. */
export function strazOn(){
  if(deps.stav)return deps.stav;
  deps.stav=(async()=>{
    if(testMode())return true;
    let casovac=null;const ovladac=typeof AbortController!=='undefined'?new AbortController():null;
    const limit=new Promise((ok)=>{casovac=deps.setTimeout(()=>{ovladac?.abort();ok(null);},deps.stavMs);});
    try{
      const r=await Promise.race([Promise.resolve().then(()=>deps.fetch(STAV_URL,{cache:'no-store',credentials:'omit',signal:ovladac?.signal})),limit]);
      if(!r||!r.ok)return false;
      const j=await Promise.race([r.json(),limit]);
      return Boolean(j&&typeof j==='object'&&j.live===true);
    }catch{return false;}finally{deps.clearTimeout(casovac);}
  })().then(on=>{if(on){try{pridajStyl();}catch{}}return on;},()=>false);
  return deps.stav;
}

/** Verejná http(s) adresa bez prihlasovacích údajov; inak null. */
export function webAdresa(value){
  try{const s=String(value||'').trim();if(!s||s.length>2048)return null;const u=new URL(s);
    if(!['https:','http:'].includes(u.protocol)||u.username||u.password||!u.hostname||!u.hostname.includes('.'))return null;return u;}catch{return null;}
}
export const platnyEmail=(s)=>typeof s==='string'&&s.length<=254&&/^[^@\s<>"]+@[^@\s<>".]+(?:\.[^@\s<>".]+)+$/.test(s);
/** Odpoveď POST /v1/straz, ktorú možno bezpečne použiť, alebo null (zlé id, kľúč alebo adresa pokladne mimo buy.stripe.com). */
export function platnaOdpoved(data){
  if(!data||typeof data!=='object')return null;
  const {id,key,checkout_url:url}=data;
  if(typeof id!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(id)||typeof key!=='string'||!/^[A-Za-z0-9_-]{8,256}$/.test(key))return null;
  try{const u=new URL(url);
    if(u.protocol!=='https:'||u.hostname!=='buy.stripe.com'||u.username||u.password||u.port)return null;
    const ref=u.searchParams.get('client_reference_id');if(ref!==null&&ref!==id)return null;
    return {id,key,checkout_url:u.href};}catch{return null;}
}
export const NAVRAT_VEK=24*60*60*1000,CAKANIE_MERANIA=400;
/** prev_id a prev_key zo 'straz:navrat' (Z2): len platný tvar, mladší ako 24 h a nie z budúcnosti (5 min rezerva); inak null. */
export function predosly(raw,now){
  try{const x=JSON.parse(raw||'null');if(!x||typeof x!=='object')return null;
    if(typeof x.id!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(x.id)||typeof x.key!=='string'||!/^[A-Za-z0-9_-]{8,256}$/.test(x.key))return null;
    const at=Date.parse(x.at),t=now.getTime();if(!Number.isFinite(at)||t-at>=NAVRAT_VEK||at-t>5*60*1000)return null;
    return {prev_id:x.id,prev_key:x.key};}catch{return null;}
}
/** Kontrola bez čitateľných produktových stránok (Z3): skóre null alebo 0 prečítaných stránok; údaje pre AI sa nedali vyhodnotiť. */
export const bezUdajovAi=(report)=>Boolean(report&&typeof report==='object'&&(report.score===null||report.sample?.pages===0));
/** Počet nálezov pre meranie: neúspešné pravidlá plus nálezy EÚ s tónom review alebo unknown. */
export function pocetNalezov(report){
  const rules=Array.isArray(report?.rules)?report.rules.filter(r=>r&&r.status==='fail').length:0;
  const eu=validEu(report?.eu)?report.eu.rules.filter(r=>['review','unknown'].includes(toneOf(r.code,r.status))).length:0;
  return rules+eu;
}

function el(tag,text,cls){const e=deps.doc().createElement(tag);if(text!=null)e.textContent=String(text);if(cls)e.className=cls;return e;}
let zvoleny=null; // kód nálezu z posledného kliku na „Sledovať ďalej“
let odomkni=null; // odomknutie posledného boxu pri návrate z pokladne (bfcache)
let pageshow=false;

/** Odkaz „Sledovať ďalej“ pri náleze; vedie na kotvu boxu a zapamätá si kód (len známy kód pravidla alebo nálezu EÚ). */
export function strazLink(kod,lang){
  const t=T[jazyk(lang)],a=el('a',t.link,'ar-straz-odkaz');a.href='#'+BOX_ID;a.setAttribute('aria-label',t.linkAria);
  const k=typeof kod==='string'&&ZNAME.has(kod)?kod:null;if(k)a.dataset.finding=k;
  a.addEventListener('click',()=>{if(k)zvoleny=k;});
  return a;
}

/** Box ponuky do výsledku kontroly alebo null, keď sa adresa obchodu nedá bezpečne použiť. */
export function buildStrazBox(lang,place,platform,report){
  const L=jazyk(lang),t=T[L],miesto=MIESTA.includes(place)?place:'result',plat=PLATFORMY.includes(platform)?platform:'unknown';
  const store=miesto==='sample'?null:webAdresa(report?.storeUrl);
  if(miesto!=='sample'&&!store)return null;
  zvoleny=null;
  const box=el('section',null,'ar-straz');box.id=BOX_ID;box.tabIndex=-1;box.setAttribute('aria-labelledby',BOX_ID+'-nadpis');box.dataset.place=miesto;
  const h=el('h3',t.title);h.id=BOX_ID+'-nadpis';box.append(h,el('p',t.lead,'ar-straz-lead'));
  const bezAi=miesto!=='sample'&&bezUdajovAi(report);
  if(bezAi)box.append(el('p',t.noAi,'ar-straz-bez-ai'));
  if(plat==='yes')box.append(el('p',t.shopify,'ar-straz-platforma'));
  const co=el('ul',null,'ar-straz-co');t.watch.forEach((w,i)=>co.append(el('li',bezAi&&i===1?t.watchNoAi:w)));
  box.append(el('h4',t.watchTitle),co,el('p',t.often+' '+t.mail,'ar-straz-ako'),el('p',t.limits,'ar-muted ar-straz-hranice'));
  const cena=()=>{const p=el('p',null,'ar-straz-cena');p.append(el('strong',t.name+': '+t.price));return p;};
  if(miesto==='sample'){
    const v=el('p',t.sample+' ','ar-straz-vzorka'),a=el('a',t.sampleLink);a.href='#store-url';v.append(a);
    const platba=el('div',null,'ar-straz-platba');platba.append(cena(),el('p',t.cancel,'ar-straz-zrusenie'));
    box.append(platba,v);
  }else box.append(formular(t,L,miesto,store,box,cena));
  const viac=el('p',null,'ar-straz-viac'),va=el('a',t.more);va.href=STRANKA[L];viac.append(va);box.append(viac);
  // Umami raz po vložení boxu (app.mjs ho vloží hneď po vytvorení); len jazyk, miesto, platforma a počet nálezov.
  const findings=pocetNalezov(report);
  deps.later(()=>{if(box.isConnected)track('ar_straz_offer_view',{lang:L,place:miesto,platform:plat,findings});});
  return box;
}

function formular(t,lang,place,store,box,cena){
  const form=el('form',null,'ar-straz-form');form.noValidate=true;
  const obchod=el('p',null,'ar-straz-obchod');obchod.append(el('span',t.store),' ',el('strong',store.origin));
  const lE=el('label',t.emailLabel);lE.htmlFor=BOX_ID+'-email';
  const email=el('input',null,'ar-straz-pole');Object.assign(email,{id:BOX_ID+'-email',name:'email',type:'email',autocomplete:'email',inputMode:'email',spellcheck:false,required:true,maxLength:254});
  email.setAttribute('aria-describedby',BOX_ID+'-email-pomoc');
  const hE=el('p',t.emailHint,'ar-straz-napoveda');hE.id=BOX_ID+'-email-pomoc';
  const lF=el('label',t.feedLabel);lF.htmlFor=BOX_ID+'-feed';
  const feed=el('input',null,'ar-straz-pole');Object.assign(feed,{id:BOX_ID+'-feed',name:'feed',type:'url',autocomplete:'off',inputMode:'url',spellcheck:false,maxLength:2048});
  feed.setAttribute('aria-describedby',BOX_ID+'-feed-pomoc');
  const hF=el('p',t.feedHint,'ar-straz-napoveda');hF.id=BOX_ID+'-feed-pomoc';
  const tlacidlo=el('button',t.button,'ar-straz-tlacidlo');tlacidlo.type='submit';
  const chyba=el('p',null,'ar-straz-chyba');chyba.setAttribute('role','alert');chyba.hidden=true;
  const platba=el('div',null,'ar-straz-platba');platba.append(cena(),el('p',t.cancel,'ar-straz-zrusenie'),tlacidlo,chyba,el('p',t.pay,'ar-muted ar-straz-pokladna'));
  const sukromie=el('p',t.privacy[0]+' ','ar-muted ar-straz-sukromie'),z=el('a',t.privacy[1]);z.href=t.privacy[2];sukromie.append(z);
  form.append(obchod,lE,email,hE,lF,feed,hF,platba,sukromie);

  let bezi=false,verzia=0,presmerovane=false;
  const zamkni=(ano,text)=>{bezi=ano;email.readOnly=ano;feed.readOnly=ano;tlacidlo.disabled=ano;tlacidlo.textContent=ano?text:t.button;form.setAttribute('aria-busy',String(ano));};
  const zrusChybu=()=>{chyba.hidden=true;chyba.textContent='';email.removeAttribute('aria-invalid');feed.removeAttribute('aria-invalid');};
  const ukaz=(text,pole)=>{chyba.textContent=text;chyba.hidden=false;if(pole){pole.setAttribute('aria-invalid','true');try{pole.focus();}catch{}}};
  for(const p of [email,feed])p.addEventListener('input',()=>{if(!chyba.hidden&&!bezi)zrusChybu();});
  odomkni=()=>{if(presmerovane){presmerovane=false;zamkni(false);}};
  const w=deps.win();if(w&&!pageshow&&typeof w.addEventListener==='function'){pageshow=true;w.addEventListener('pageshow',e=>{if(e&&e.persisted&&odomkni)odomkni();});}
  const chyba400=(data)=>{const s=JSON.stringify(data?.issues??'');return /feed/.test(s)?[t.errors.feed,feed]:/email/.test(s)?[t.errors.email,email]:/store/.test(s)?[t.errors.store,null]:[t.errors.invalid,null];};

  form.addEventListener('submit',async e=>{
    e?.preventDefault?.();
    if(bezi)return;
    zrusChybu();
    const adresa=String(email.value||'').trim(),f=String(feed.value||'').trim();
    if(!platnyEmail(adresa))return ukaz(t.errors.email,email);
    let feedUrl='';
    if(f){const u=webAdresa(f);if(!u)return ukaz(t.errors.feed,feed);feedUrl=u.href;}
    const moja=++verzia;zamkni(true,t.sending);
    let casovac=null,vyprsalo=false;const ovladac=typeof AbortController!=='undefined'?new AbortController():null;
    const limit=new Promise((_,zle)=>{casovac=deps.setTimeout(()=>{vyprsalo=true;ovladac?.abort();zle(new Error('timeout'));},deps.timeoutMs);});
    limit.catch(()=>{});
    const plati=()=>moja===verzia&&box.isConnected;
    try{
      let prev=null;try{prev=predosly(deps.local()?.getItem(NAVRAT),deps.now());}catch{}
      const body={store_url:store.origin,email:adresa,lang,feed_url:feedUrl,test:testMode(),...(prev||{})};
      const dopyt=Promise.resolve().then(()=>deps.fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),credentials:'omit',cache:'no-store',signal:ovladac?.signal}));
      dopyt.catch(()=>{}); // neskorá chyba po vypršaní limitu nesmie skončiť ako neodchytená
      const r=await Promise.race([dopyt,limit]);
      if(!plati())return;
      let data=null;try{data=await Promise.race([r.json(),limit]);}catch(x){if(vyprsalo)throw x;}
      if(!plati())return;
      if(r.status===200||r.status===201){
        const ok=platnaOdpoved(data);
        if(!ok)return ukaz(t.errors.bad,null);
        try{deps.local()?.setItem(NAVRAT,JSON.stringify({id:ok.id,key:ok.key,lang,at:deps.now().toISOString()}));}catch{}
        deps.clearTimeout(casovac);casovac=null;
        presmerovane=true;zamkni(true,t.redirect);
        // Ako app.mjs stránky Stráže: počkať na odoslanie kliku do Umami najviac 400 ms, inak sa pri odchode zo stránky stratí.
        const odoslane=track('ar_straz_subscribe_click',zvoleny?{lang,place,finding:zvoleny}:{lang,place});
        if(odoslane){let c=null;await Promise.race([odoslane,new Promise(ok=>{c=deps.setTimeout(ok,CAKANIE_MERANIA);})]);deps.clearTimeout(c);}
        if(!box.isConnected){presmerovane=false;return;}
        deps.assign(ok.checkout_url);
        return;
      }
      if(r.status===409)ukaz(t.errors.active,email);
      else if(r.status===403&&data?.error==='test_not_allowed')ukaz(t.errors.testOnly,null);
      else if(r.status===429)ukaz(t.errors.rate,null);
      else if(r.status===400){const [text,pole]=chyba400(data);ukaz(text,pole);}
      else ukaz(t.errors.server,null);
    }catch{if(plati())ukaz(vyprsalo?t.errors.timeout:t.errors.network,null);}
    finally{deps.clearTimeout(casovac);if(moja===verzia&&!presmerovane)zamkni(false);}
  });
  return form;
}
