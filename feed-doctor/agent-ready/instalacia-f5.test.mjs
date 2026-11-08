// F5 kampane 10 inštalácií Product Checku (ops/shopify/pc-10-instalacii/PLAN.md F5 a časť 6, PRIPRAVENOST.md problém 12), 7. 11. 2026.
// A) Výsledok webovej kontroly obchodu so znakmi Shopify a živou appkou má dve tlačidlá: hlavné „Check all products: install free“ priamo
//    na zápis v Shopify App Store (rel noopener, nová karta, veta, že odchádza na Shopify App Store, udalosť Umami ar_check_to_install
//    s jazykom a zdrojom) a vedľajšie „See Agentic Product Check“ na /agent-ready/ (udalosť ar_check_to_app ostáva).
// B) Appka je v Shopify App Store od 2. 11. 2026 (ops/shopify/den-schvalenia/STAV.md): stránka nesmie naraz tvrdiť „available“ a
//    „cannot be installed yet“, ani bez JavaScriptu; čakacia listina „when Pro can be started“ ani odber „when the app is available“
//    už adresy nezbierajú (výsledok nemá blok čakacej listiny, statické HTML nemá formuláre, cakacia.mjs formulár neotvorí).
// node --test products/arling-sk/feed-doctor/agent-ready/instalacia-f5.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// ---------- malý falošný DOM (vzor kontrola-218.test.mjs) ----------
class Text { constructor(t) { this.data = t; this.parentNode = null; } get textContent() { return this.data; } }
class El {
  constructor(tag, doc) { this.tagName = tag.toUpperCase(); this.ownerDocument = doc; this.childNodes = []; this.attributes = {}; this.dataset = {}; this.className = ''; this.hidden = false; this.parentNode = null; this._l = {}; this.id = ''; this.value = ''; }
  append(...xs) { for (let x of xs) { if (!(x instanceof El)) x = new Text(String(x)); if (x.parentNode) x.parentNode.childNodes.splice(x.parentNode.childNodes.indexOf(x), 1); x.parentNode = this; this.childNodes.push(x); } }
  replaceChildren(...xs) { for (const c of this.childNodes) c.parentNode = null; this.childNodes = []; this.append(...xs); }
  remove() { if (this.parentNode) { this.parentNode.childNodes.splice(this.parentNode.childNodes.indexOf(this), 1); this.parentNode = null; } }
  get children() { return this.childNodes.filter((c) => c instanceof El); }
  get textContent() { return this.childNodes.map((c) => c.textContent).join(''); }
  set textContent(v) { for (const c of this.childNodes) c.parentNode = null; const t = new Text(String(v)); t.parentNode = this; this.childNodes = [t]; }
  setAttribute(k, v) { this.attributes[k] = String(v); } getAttribute(k) { return k in this.attributes ? this.attributes[k] : null; } removeAttribute(k) { delete this.attributes[k]; }
  addEventListener(t, f) { (this._l[t] ||= []).push(f); }
  async fire(t, e = {}) { for (const f of this._l[t] || []) await f(e); }
  focus() { this.ownerDocument.activeElement = this; } scrollIntoView() {} click() { return this.fire('click', {}); }
  closest() { return null; } querySelector() { return null; } querySelectorAll() { return []; }
  all(pred) { const out = []; const walk = (n) => { for (const c of n.children) { if (pred(c)) out.push(c); walk(c); } }; walk(this); return out; }
}
const ma = (el, cls) => String(el.className).split(/\s+/).includes(cls);
const triedy = (root, cls) => root.all((e) => ma(e, cls));
function stranka(lang) {
  const doc = {};
  doc.documentElement = new El('html', doc); doc.documentElement.lang = lang;
  doc.head = new El('head', doc); doc.body = new El('body', doc); doc.documentElement.append(doc.head, doc.body);
  doc.createElement = (t) => new El(t, doc);
  doc.getElementById = (id) => doc.documentElement.all((e) => e.id === id)[0] || null;
  doc.querySelector = () => null; doc.querySelectorAll = () => []; doc.readyState = 'complete'; doc.addEventListener = () => {};
  doc.activeElement = null;
  globalThis.document = doc;
  const prvok = (tag, id) => { const e = doc.createElement(tag); e.id = id; doc.body.append(e); return e; };
  prvok('form', 'check-form'); prvok('section', 'report').hidden = true; prvok('p', 'status'); prvok('button', 'check'); prvok('button', 'cancel'); prvok('input', 'store-url'); prvok('input', 'product-url'); prvok('button', 'sample');
  return doc;
}

// ---------- globály ----------
const udalosti = [];
globalThis.window = { umami: { track: (n, d) => udalosti.push([n, d]) }, addEventListener() {} };
globalThis.location = { search: '', hash: '', pathname: '/feed-doctor/agent-ready/', hostname: 'arling.sk', origin: 'https://arling.sk', assign() {} };
globalThis.history = { state: null, replaceState() {} };
globalThis.matchMedia = () => ({ matches: true });

const LISTING = 'https://apps.shopify.com/arling-agentic-product-check';
const VZORKA = JSON.parse(readFileSync(new URL('./sample-report.json', import.meta.url), 'utf8'));
const prechod = await import('./prechod.mjs');
const odpoved = (status, data) => ({ ok: status >= 200 && status < 300, status, json: async () => data });
const pockaj = (ms) => new Promise((r) => setTimeout(r, ms));
async function cakajNa(pred, popis = 'podmienka') { for (let i = 0; i < 400; i++) { if (pred()) return; await pockaj(5); } assert.fail('nesplnené: ' + popis); }
const OBCHOD = 'https://obchod.example.org/products/linen-shirt';
const sShopify = (zmena = {}) => ({ ...VZORKA, storeUrl: OBCHOD, ...zmena });
const bezShopify = (zmena = {}) => sShopify({ platform: 'html-only', shopify: { detected: false, signals: [] }, ...zmena });

let appka = null, odpovedKontroly = () => odpoved(200, sShopify()), strazZiva = false;
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.startsWith('file:')) return odpoved(200, JSON.parse(readFileSync(new URL(u), 'utf8')));
  if (u === '/straz-eshopu/stav.json') return odpoved(200, { live: strazZiva });
  if (u === '/agent-ready/stranka.json') return appka ? odpoved(200, appka) : odpoved(404, null);
  if (u.startsWith('https://feed-monitor.arling.workers.dev/v1/agent-ready/check')) return odpovedKontroly(u);
  return odpoved(404, null);
};
const ZIVA = { stav: 'live', appStoreUrl: LISTING + '?utm_source=arling&utm_medium=web&utm_campaign=product-check' };
let poradie = 0;
// straz.mjs?v=2 je zdieľaný modul (app.mjs ho importuje vždy tou istou adresou) a stav ponuky si pamätá v deps.stav.
const straz = await import('./straz.mjs?v=2');
async function app({ lang = 'en', stavAppky = ZIVA, zivaStraz = false } = {}) {
  appka = stavAppky; udalosti.length = 0;
  strazZiva = zivaStraz; straz.deps.stav = null;
  const doc = stranka(lang);
  await import('./app.mjs?f5=' + (++poradie));
  const $ = (id) => doc.getElementById(id), rep = $('report');
  const posli = async (data) => {
    odpovedKontroly = () => odpoved(200, data);
    $('store-url').value = 'obchod.example.org'; $('product-url').value = '';
    rep.hidden = true;
    await $('check-form').fire('submit', { preventDefault() {} });
    await cakajNa(() => !rep.hidden, 'výsledok ' + lang);
  };
  const vzorka = async () => { rep.hidden = true; await $('sample').click(); await cakajNa(() => !rep.hidden, 'vzorka ' + lang); };
  return { doc, $, rep, posli, vzorka };
}
const odkazy = (el) => el.all((e) => e.tagName === 'A');

// ---------- A: adresa zápisu ----------
test('A: INSTALL_URL je zápis appky v Shopify App Store (nie /agent-ready/), prejde tým istým pravidlom ako appStoreUrl v stranka.json', () => {
  assert.equal(typeof prechod.INSTALL_URL, 'string', 'prechod.mjs exportuje INSTALL_URL');
  assert.ok(prechod.INSTALL_URL.startsWith(LISTING + '?'), prechod.INSTALL_URL);
  assert.equal(new URL(prechod.INSTALL_URL).pathname, '/arling-agentic-product-check');
  assert.equal(prechod.appIsLive({ stav: 'live', appStoreUrl: prechod.INSTALL_URL }), true, 'tvar adresy ako zápis v stranka.json');
  assert.ok(!prechod.INSTALL_URL.includes('arling.sk/agent-ready'));
});

// ---------- A: dve tlačidlá vo výsledku ----------
const TEXTY = {
  en: { cta: 'Check all products: install free', druhy: 'See Agentic Product Check', pozn: /Shopify App Store/ },
  sk: { cta: 'Skontrolovať všetky produkty: inštalácia zadarmo', druhy: 'Pozrieť Agentic Product Check', pozn: /Shopify App Store/ },
  de: { cta: 'Alle Produkte prüfen: kostenlos installieren', druhy: 'Agentic Product Check ansehen', pozn: /Shopify App Store/ },
};
test('A: obchod so Shopify a živou appkou: hlavné tlačidlo inštalácie priamo na zápis (prvé, plné, noopener, nová karta, veta o odchode) a vedľajší odkaz na /agent-ready/ (SK, EN, DE)', async () => {
  for (const lang of ['en', 'sk', 'de']) {
    const { rep, posli } = await app({ lang });
    await posli(sShopify());
    const bloky = triedy(rep, 'ar-next'); assert.equal(bloky.length, 1, lang + ': jeden blok appky');
    const a = odkazy(bloky[0]); assert.equal(a.length, 2, lang + ': dve tlačidlá');
    const [hlavne, druhe] = a;
    assert.equal(hlavne.href, prechod.INSTALL_URL, lang); assert.equal(hlavne.textContent, TEXTY[lang].cta, lang);
    assert.ok(ma(hlavne, 'ar-next-link') && ma(hlavne, 'ar-next-instalacia'), lang + ': hlavné je plné tlačidlo');
    assert.equal(hlavne.rel, 'noopener', lang); assert.equal(hlavne.target, '_blank', lang);
    const pozn = bloky[0].all((e) => e.id && e.id === hlavne.getAttribute('aria-describedby'));
    assert.equal(pozn.length, 1, lang + ': aria-describedby ukazuje na vetu v bloku'); assert.match(pozn[0].textContent, TEXTY[lang].pozn, lang);
    assert.equal(druhe.href, prechod.APP_URL, lang); assert.equal(druhe.textContent, TEXTY[lang].druhy, lang);
    assert.ok(ma(druhe, 'ar-next-druhy') && !ma(druhe, 'ar-next-link'), lang + ': vedľajší je text, nie druhé plné tlačidlo');
    for (const t of Object.values(TEXTY[lang])) if (typeof t === 'string') assert.ok(!/[–—]/.test(t), lang + ': pomlčka');
  }
});
test('A: klik na inštaláciu meria ar_check_to_install s jazykom a zdrojom (check, sample), nikdy adresu obchodu; vedľajší ostáva ar_check_to_app', async () => {
  const { rep, posli, vzorka } = await app({ lang: 'sk' });
  await posli(sShopify());
  let [hlavne, druhe] = odkazy(triedy(rep, 'ar-next')[0]);
  udalosti.length = 0;
  await hlavne.click(); await druhe.click();
  assert.deepEqual(udalosti, [['ar_check_to_install', { lang: 'sk', source: 'check' }], ['ar_check_to_app', { lang: 'sk', source: 'check' }]]);
  assert.ok(!JSON.stringify(udalosti).includes('obchod.example.org'));
  await vzorka();
  [hlavne] = odkazy(triedy(rep, 'ar-next')[0]);
  udalosti.length = 0; await hlavne.click();
  assert.deepEqual(udalosti, [['ar_check_to_install', { lang: 'sk', source: 'sample' }]]);
});
test('A: bez živej appky (stranka.json nehovorí live) alebo bez znakov Shopify nie je blok appky ani tlačidlo inštalácie', async () => {
  for (const [popis, stavAppky, data] of [['nie live', null, sShopify()], ['iný stav', { stav: 'cakanie', appStoreUrl: LISTING }, sShopify()], ['bez Shopify', ZIVA, bezShopify()]]) {
    const { rep, posli } = await app({ lang: 'en', stavAppky });
    await posli(data);
    assert.equal(triedy(rep, 'ar-next').length, 0, popis);
    assert.equal(triedy(rep, 'ar-next-hore').length, 0, popis + ': ani riadok pod skóre');
    assert.equal(odkazy(rep).filter((a) => String(a.href).startsWith('https://apps.shopify.com/')).length, 0, popis);
  }
});

// ---------- Brána F5 pokus 1, nález 1: tlačidlo inštalácie pri skóre, blok appky pred boxom Stráže ----------
const HORE = {
  en: /^This was a sample from your public data\. In our Shopify app, the Free plan checks every active and unlisted product and shows the score and counts, with full detail for 3 products\.$/,
  sk: /^Toto bola vzorka z vašich verejných údajov\. V našej appke pre Shopify plán Free skontroluje každý produkt v stave Active alebo Unlisted a ukáže skóre a počty, úplný detail pri 3 produktoch\.$/,
  de: /^Das war eine Stichprobe aus Ihren öffentlichen Daten\. In unserer Shopify-App prüft der Free-Tarif jedes Produkt mit dem Status Active oder Unlisted und zeigt Score und Anzahlen, mit vollständigem Detail für 3 Produkte\.$/,
};
// Brána F5 pokus 2, nález 2: pri hlavnom tlačidle pod skóre aj veta o jazyku appky (ako copy.app.terms a #pro), v SK a DE; je vo vete
// hneď pod tlačidlom, na ktorú tlačidlo ukazuje cez aria-describedby (v texte nad tlačidlom by pri DE 390 px posunula tlačidlo z prvého okna).
const POZN_HORE = {
  en: /^The install button opens the Shopify App Store in a new tab\.$/,
  sk: /^Tlačidlo inštalácie otvorí Shopify App Store na novej karte\. Appka je po anglicky\.$/,
  de: /^Die Schaltfläche zur Installation öffnet den Shopify App Store in einem neuen Tab\. Die App ist auf Englisch\.$/,
};
// Brána F5 pokus 2, nález 1: vzorka je fiktívny obchod (pruh „Sample report from a fictional store“), riadok pod skóre preto
// nesmie hovoriť o verejných údajoch návštevníka; povie, že ho ukáže skutočná kontrola obchodu na Shopify (ako copy.app.sampleWhy).
const HORE_VZORKA = {
  en: /^For a Shopify store, a real check shows this row\. In our Shopify app, the Free plan checks every active and unlisted product and shows the score and counts, with full detail for 3 products\.$/,
  sk: /^Skutočná kontrola obchodu na Shopify ukáže tento riadok\. V našej appke pre Shopify plán Free skontroluje každý produkt v stave Active alebo Unlisted a ukáže skóre a počty, úplný detail pri 3 produktoch\.$/,
  de: /^Eine echte Prüfung eines Shopify-Shops zeigt diese Zeile\. In unserer Shopify-App prüft der Free-Tarif jedes Produkt mit dem Status Active oder Unlisted und zeigt Score und Anzahlen, mit vollständigem Detail für 3 Produkte\.$/,
};
const VASE_UDAJE = /your public data|vašich verejných údajov|Ihren öffentlichen Daten|This was a sample|Toto bola vzorka|Das war eine Stichprobe/;
test('pokus 2, nález 1: vo vzorke (fiktívny obchod) riadok pod skóre netvrdí „vzorka z vašich verejných údajov“, povie, kde sa ukáže pri skutočnej kontrole (EN, SK, DE); tlačidlo ostáva so sample-top', async () => {
  for (const lang of ['en', 'sk', 'de']) {
    const { rep, posli, vzorka } = await app({ lang });
    await vzorka();
    let hore = triedy(rep, 'ar-next-hore');
    assert.equal(hore.length, 1, lang + ': vo vzorke je riadok pod skóre');
    let text = triedy(hore[0], 'ar-next-hore-text')[0].textContent;
    assert.ok(!VASE_UDAJE.test(text), `${lang}: vzorka tvrdí údaje návštevníka: ${text}`);
    assert.match(text, HORE_VZORKA[lang], lang);
    assert.ok(!/[–—]/.test(hore[0].textContent), lang + ': pomlčka');
    const pozn = hore[0].all((e) => e.id && e.id === odkazy(hore[0])[0].getAttribute('aria-describedby'));
    assert.equal(pozn.length, 1, lang); assert.match(pozn[0].textContent, POZN_HORE[lang], lang + ': veta pod tlačidlom vo vzorke');
    udalosti.length = 0; await odkazy(hore[0])[0].click();
    assert.deepEqual(udalosti, [['ar_check_to_install', { lang, source: 'sample-top' }]], lang);
    // Skutočná kontrola po vzorke má zase vetu o verejných údajoch (výsledok sa stavia znova, nie zo starého textu vzorky).
    await posli(sShopify());
    hore = triedy(rep, 'ar-next-hore');
    assert.equal(hore.length, 1, lang + ': po skutočnej kontrole jeden riadok');
    text = triedy(hore[0], 'ar-next-hore-text')[0].textContent;
    assert.match(text, HORE[lang], lang + ': skutočná kontrola');
  }
});
test('nález 1: Shopify so živou appkou: hlavné tlačidlo inštalácie je hneď pod skóre (v prvých 6 deťoch reportu, pred zoznamom opráv), na zápise, nová karta, veta o odchode (EN, SK, DE)', async () => {
  for (const lang of ['en', 'sk', 'de']) {
    const { rep, posli } = await app({ lang });
    await posli(sShopify());
    const deti = rep.children, iHore = deti.findIndex((e) => ma(e, 'ar-next-hore'));
    const iSkore = deti.findIndex((e) => ma(e, 'ar-scoreline')), iZoznam = deti.findIndex((e) => e.tagName === 'UL' && ma(e, 'ar-list'));
    assert.ok(iHore >= 0 && iHore <= 5, `${lang}: riadok s tlačidlom v prvých 6 deťoch (index ${iHore})`);
    assert.ok(iSkore >= 0 && iSkore < iHore && iHore < iZoznam, `${lang}: skóre ${iSkore}, tlačidlo ${iHore}, zoznam ${iZoznam}`);
    assert.equal(deti[iHore - 1].tagName, 'P', lang + ': hneď za vetou pod skóre'); assert.equal(deti[iHore - 2], deti[iSkore], lang);
    const hore = deti[iHore], a = odkazy(hore);
    assert.equal(a.length, 1, lang + ': jedno tlačidlo');
    assert.equal(a[0].href, prechod.INSTALL_URL, lang); assert.equal(a[0].textContent, TEXTY[lang].cta, lang);
    assert.ok(ma(a[0], 'ar-next-link') && ma(a[0], 'ar-next-instalacia'), lang + ': plné tlačidlo');
    assert.equal(a[0].rel, 'noopener', lang); assert.equal(a[0].target, '_blank', lang);
    const pozn = hore.all((e) => e.id && e.id === a[0].getAttribute('aria-describedby'));
    assert.equal(pozn.length, 1, lang + ': aria-describedby ukazuje na vetu v riadku'); assert.match(pozn[0].textContent, POZN_HORE[lang], lang);
    const ids = rep.all((e) => e.id && e.id.startsWith('ar-next-pozn-')).map((e) => e.id);
    assert.equal(new Set(ids).size, ids.length, lang + ': id viet sú jedinečné');
    assert.match(triedy(hore, 'ar-next-hore-text')[0].textContent, HORE[lang], lang);
    assert.ok(!/[–—]/.test(hore.textContent), lang + ': pomlčka');
  }
});
test('nález 1: klik na tlačidlo pod skóre meria ar_check_to_install so source check-top (vzorka sample-top), nikdy adresu obchodu', async () => {
  const { rep, posli, vzorka } = await app({ lang: 'de' });
  await posli(sShopify());
  udalosti.length = 0; await odkazy(triedy(rep, 'ar-next-hore')[0])[0].click();
  assert.deepEqual(udalosti, [['ar_check_to_install', { lang: 'de', source: 'check-top' }]]);
  assert.ok(!JSON.stringify(udalosti).includes('obchod.example.org'));
  await vzorka();
  udalosti.length = 0; await odkazy(triedy(rep, 'ar-next-hore')[0])[0].click();
  assert.deepEqual(udalosti, [['ar_check_to_install', { lang: 'de', source: 'sample-top' }]]);
});
test('nález 1: so živou Strážou: pri Shopify je blok appky pred boxom Stráže (za EÚ); bez Shopify box Stráže ostáva hneď za EÚ a riadok pod skóre nie je', async () => {
  const { rep, posli } = await app({ lang: 'en', zivaStraz: true });
  await posli(sShopify());
  let deti = rep.children;
  const iEu = deti.findIndex((e) => ma(e, 'ar-eu')), iNext = deti.findIndex((e) => ma(e, 'ar-next')), iStraz = deti.findIndex((e) => ma(e, 'ar-straz'));
  assert.ok(iStraz >= 0, 'box Stráže je vo výsledku');
  assert.ok(iEu >= 0 && iNext === iEu + 1 && iStraz === iNext + 1, `EÚ ${iEu}, appka ${iNext}, Stráž ${iStraz}`);
  assert.ok(deti.findIndex((e) => ma(e, 'ar-next-hore')) < iEu, 'tlačidlo pod skóre je nad EÚ aj nad Strážou');
  assert.ok(ma(deti[iStraz + 1], 'ar-vysledok-miesto'), 'blok e-mailu za boxom Stráže');
  const druhy = await app({ lang: 'en', zivaStraz: true });
  await druhy.posli(bezShopify());
  deti = druhy.rep.children;
  const jEu = deti.findIndex((e) => ma(e, 'ar-eu')), jStraz = deti.findIndex((e) => ma(e, 'ar-straz'));
  assert.ok(jEu >= 0 && jStraz === jEu + 1, `bez Shopify: EÚ ${jEu}, Stráž ${jStraz}`);
  assert.equal(triedy(druhy.rep, 'ar-next-hore').length + triedy(druhy.rep, 'ar-next').length, 0);
});

// ---------- B: výsledok bez čakacej listiny ----------
test('B: výsledok nemá blok čakacej listiny ani formulár na e-mail pre Pro (Shopify so živou appkou aj bez nej); blok e-mailu výsledku stojí hneď za blokom appky', async () => {
  for (const stavAppky of [ZIVA, null]) {
    const { rep, posli } = await app({ lang: 'de', stavAppky });
    await posli(sShopify());
    assert.equal(triedy(rep, 'ar-pro-cakacia').length, 0, 'bez bloku čakacej listiny');
    assert.equal(rep.all((e) => e.tagName === 'FORM').length, 0, 'vo výsledku žiadny formulár');
    assert.ok(!/waitlist|Warteliste|čakaci/i.test(rep.textContent), 'ani slovo o čakacej listine');
    const deti = rep.children, miesto = deti.findIndex((e) => ma(e, 'ar-vysledok-miesto'));
    if (stavAppky) assert.ok(ma(deti[miesto - 1], 'ar-next'), 'miesto hneď za blokom appky');
    else assert.ok(ma(deti[miesto - 1], 'ar-eu'), 'bez appky miesto hneď za EÚ');
  }
});

// ---------- B: cakacia.mjs (kalendár a staršie app.mjs z vyrovnávacej pamäte) ----------
test('B: cakacia.mjs má zber predvolene zastavený a buildWaitlist nevytvorí formulár ani vetu o čakaní; veta o App Store je viditeľná', async () => {
  stranka('en');
  const c = await import('./cakacia.mjs?f5-zber');
  assert.equal(c.deps.zberOtvoreny, false, 'zber adries je zastavený');
  const box = c.buildWaitlist('en', 'result', 'yes');
  assert.equal(box.all((e) => e.tagName === 'FORM').length, 0, 'bez formulára');
  assert.equal(box.all((e) => 'proCakanie' in e.dataset).length, 0, 'bez vety o čakaní');
  const live = box.all((e) => 'proLive' in e.dataset);
  assert.equal(live.length, 1); assert.equal(live[0].hidden, false, 'veta o App Store je viditeľná hneď');
  assert.match(live[0].textContent, /available in the Shopify App Store/);
  assert.ok(!/waiting|when Pro can be started|waitlist/i.test(box.textContent), box.textContent);
});

// ---------- B: statické HTML v troch jazykoch (bez JavaScriptu) ----------
const HTML = [['./index.html', 'en'], ['./sk/index.html', 'sk'], ['./de/index.html', 'de']];
const STARE = [/cannot be installed/i, /waiting for Shopify/i, /Shopify.{0,3}s review/i, /nedá nainštalovať/i, /čaká na (posúdenie|schválenie)/i, /noch nicht installiert/i, /wartet auf die (Prüfung|Freigabe)/i,
  /when Pro can be started/i, /Pro zapnúť/i, /Pro gestartet/i, /when the app is available/i, /keď bude aplikácia dostupná/i, /sobald die App/i, /waitlist/i, /čakaci[au] listin/i, /Warteliste/i];
const INSTAL_ODKAZ = { en: 'Install free from the Shopify App Store', sk: 'Nainštalovať zadarmo zo Shopify App Store', de: 'Kostenlos aus dem Shopify App Store installieren' };
test('B: statické HTML (EN, SK, DE) netvrdí, že appka čaká alebo sa nedá nainštalovať, nemá formuláre čakacej listiny ani odberu; veta o App Store je viditeľná a vedie priamo na zápis', () => {
  for (const [subor, lang] of HTML) {
    const html = readFileSync(new URL(subor, import.meta.url), 'utf8');
    for (const re of STARE) assert.ok(!re.test(html), `${subor}: ${re}`);
    for (const x of ['data-pro-cakanie', 'data-ar-pro', 'data-odber-ar', 'data-odber-sekcia', 'odber-ar.js', 'ar-pro-form']) assert.ok(!html.includes(x), `${subor}: ${x}`);
    const sekcia = (/<section class="ar-pro-cakacia" id="pro"[\s\S]*?<\/section>/.exec(html) || [''])[0];
    assert.ok(sekcia, subor + ': sekcia #pro ostáva');
    assert.match(sekcia, /<p data-pro-live>[^<]*Shopify App Store/, subor + ': veta o App Store bez atribútu hidden');
    const url = 'https://apps.shopify.com/arling-agentic-product-check?utm_source=arling&amp;utm_medium=check-page&amp;utm_campaign=product-check';
    // Brána F5 pokus 1, nález 5: inštalácia je plné tlačidlo (tie isté triedy ako vo výsledku), stránka appky podčiarknutý text.
    const odkaz = `<a class="ar-next-link ar-next-instalacia" href="${url}" rel="noopener" data-umami-event="ar_check_to_install" data-umami-event-lang="${lang}" data-umami-event-source="page">${INSTAL_ODKAZ[lang]}</a>`;
    assert.ok(sekcia.includes(odkaz), subor + ': priamy odkaz na zápis s udalosťou\n' + sekcia);
    const odkazy = (/<p class="ar-pro-odkazy">([\s\S]*?)<\/p>/.exec(sekcia) || ['', ''])[1].match(/<a [^>]*>/g) || [];
    assert.equal(odkazy.length, 2, subor + ': dva odkazy v #pro');
    assert.ok(odkazy[0].includes('ar-next-instalacia') && !odkazy[1].includes('ar-next-link') && odkazy[1].includes('class="ar-next-druhy"'), subor + ': jedno plné tlačidlo, druhý odkaz text');
    // Brána F5 pokus 1, nález 4: plán bez zdroja (EÚ kontroly v týždennej kontrole Pro) nie je na stránke ako veta vedľa „available“.
    for (const re of [/We plan to add/i, /chceme pridať/i, /Wir wollen diese/i, /three EU checks to that weekly/i]) assert.ok(!re.test(html), `${subor}: ${re}`);
    assert.ok(!/[–—]/.test(sekcia.replace(/<[^>]+>/g, '')), subor + ': pomlčka');
    assert.equal((html.match(/\/feed-doctor\/agent-ready\/app\.mjs\?v=7"/g) || []).length, 1, subor + ': app.mjs?v=7');
    assert.equal((html.match(/\/feed-doctor\/agent-ready\/style\.css\?v=6"/g) || []).length, 1, subor + ': style.css?v=6');
  }
});

// ---------- Brána F5 pokus 1, nález 2: 16-checks (na ňu odkazuje kontrolovaná stránka) v meta, og a JSON-LD ----------
test('nález 2: 16-checks/index.html netvrdí, že appka čaká na schválenie (meta description, og:description, JSON-LD), a CSP odtlačky sedia s vloženými skriptami', async () => {
  const html = readFileSync(new URL('./16-checks/index.html', import.meta.url), 'utf8');
  for (const re of [/until the app is approved/i, ...STARE]) assert.ok(!re.test(html), `16-checks: ${re}`);
  const veta = 'The 16 product checks our Shopify app runs, with where to fix each one in your Shopify admin. Run them by hand, or install the app from the Shopify App Store.';
  assert.ok(html.includes(`<meta name="description" content="${veta}">`), 'meta description');
  assert.ok(html.includes(`<meta property="og:description" content="${veta}">`), 'og:description');
  const ld = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1]);
  assert.equal(ld.description, veta, 'JSON-LD'); assert.equal(ld.dateModified, '2026-11-07');
  // Tá istá logika ako ops/design/csp-hash.mjs: CRLF na LF, vložené skripty bez src okrem application/json.
  const { createHash } = await import('node:crypto');
  const lf = html.split('\r\n').join('\n');
  const treba = [...lf.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)].filter((m) => !/type="application\/json"/.test(m[1])).map((m) => "'sha256-" + createHash('sha256').update(m[2], 'utf8').digest('base64') + "'");
  const src = /script-src ([^;]+)/.exec(/Content-Security-Policy" content="([^"]+)"/.exec(lf)[1])[1].split(/\s+/).filter((x) => x.startsWith("'sha256-"));
  assert.deepEqual([...new Set(treba)].sort(), src.sort(), 'CSP odtlačky');
});

// ---------- A: štýl dvoch tlačidiel (390 px, dotyk, fokus, kontrast) ----------
test('A: style.css: vedľajší odkaz má cieľ dotyku 48 px a viditeľný fokus; na mobile sú tlačidlá pod sebou; hlavné tlačidlo v tmavom režime má tmavý text na medenej', () => {
  const css = readFileSync(new URL('./style.css', import.meta.url), 'utf8');
  assert.match(css, /\.ar-page a\.ar-next-druhy\{[^}]*min-height:48px/);
  assert.match(css, /a\.ar-next-druhy:focus-visible[^{]*\{[^}]*outline:2px solid/);
  assert.match(css, /@media\(max-width:760px\)\{[^}]*\.ar-next-akcie\{[^}]*flex-direction:column/);
  assert.match(css, /body\.noc\.ar-page a\.ar-next-instalacia\{[^}]*background:var\(--accent\);color:#1b0e08/);
  // brána F5 pokus 1: riadok pod skóre a #pro s plným tlačidlom; na mobile #pro pod sebou s medzerou 12 px
  assert.match(css, /\.ar-next-hore\{[^}]*margin:0 0 32px/);
  assert.match(css, /\.ar-page \.ar-pro-odkazy a\.ar-next-link\{margin:0\}/);
  assert.match(css, /@media\(max-width:760px\)\{\.ar-next-akcie\{[^}]*\}\.ar-page \.ar-pro-odkazy\{flex-direction:column;align-items:stretch;gap:12px\}/);
  // kontrast: #1b0e08 na --accent tmavého režimu (#f2643c) a na hover (--accent-light #ffb59d) aspoň 4,5 : 1
  const L = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const k = (a, b) => (Math.max(L(a), L(b)) + 0.05) / (Math.min(L(a), L(b)) + 0.05);
  assert.ok(k('#1b0e08', '#f2643c') >= 4.5, 'text na tlačidle ' + k('#1b0e08', '#f2643c').toFixed(2));
  assert.ok(k('#1b0e08', '#ffb59d') >= 4.5, 'hover');
});
