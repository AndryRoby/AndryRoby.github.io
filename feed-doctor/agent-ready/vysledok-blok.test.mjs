// Testy relácie 205 pre kontrolu e-shopu (ops/druhy-ucet/205/SPEC.md časti 3, 5.2 a 7.1; AGENTS.md bod 12) s malým falošným DOM:
// miesto pre blok „Poslať si výsledok e-mailom“ za čakacou listinou (bez Shopify za EÚ, brána 218 D2) a pred všetkými kontrolami (Z-392, relácia 218), ukaz so zhrnutím bez adries stránok, handle a textov
// z obchodu, pri vzorke nič, skry pri novom behu, chybe, zrušení a úprave vstupu, neskorý import nič nevykreslí do starého miesta,
// chýbajúci modul hubu nič nerozbije; #url= len predvyplní pole; trenie (a) ponuka opravy 149 USD, (b) vety chýb, (c) riadok rozsahu.
// cd products/arling-sk/feed-doctor/agent-ready && node --test vysledok-blok.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';

// ---------- malý falošný DOM (vzor straz.test.mjs) ----------
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
function stranka(lang, { oprava = true } = {}) {
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
  if (oprava) prvok('section', 'fix-service');
  return doc;
}

// ---------- globály ----------
const udalosti = [];
globalThis.window = { umami: { track: (n, d) => udalosti.push([n, d]) }, addEventListener() {} };
const zamena = [];
globalThis.location = { search: '', hash: '', pathname: '/feed-doctor/agent-ready/sk/', hostname: 'arling.sk', origin: 'https://arling.sk' };
globalThis.history = { state: null, replaceState(s, t, u) { zamena.push(u); globalThis.location.hash = ''; } };
globalThis.matchMedia = () => ({ matches: true });
// Spoločný modul hubu podvrhne háčik načítania (nižšie); zaznamenáva volania sem a každé načítanie modulu do nacitania (P5).
const volania = [], nacitania = [];
globalThis.__vysledok = { volania, nacitania };

const VZORKA = JSON.parse(readFileSync(new URL('./sample-report.json', import.meta.url), 'utf8'));
const { UI } = await import('./i18n.mjs?v=5'); // tá istá inštancia, ktorú načíta app.mjs
const odpoved = (status, data) => ({ ok: status >= 200 && status < 300, status, json: async () => data });
const pockaj = (ms) => new Promise((r) => setTimeout(r, ms));
async function cakajNa(pred, popis = 'podmienka') { for (let i = 0; i < 400; i++) { if (pred()) return; await pockaj(5); } assert.fail('nesplnené: ' + popis); }
const OBCHOD = 'https://obchod.example.org/products/linen-shirt';
const vysledokObchodu = (zmena = {}) => ({ ...VZORKA, storeUrl: OBCHOD, ...zmena });
const bezShopify = (zmena = {}) => vysledokObchodu({ platform: 'html-only', shopify: { detected: false, signals: [] }, ...zmena });

let poradie = 0, odpovedKontroly = () => odpoved(200, vysledokObchodu());
const kontroly = [];
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.startsWith('file:')) return odpoved(200, JSON.parse(readFileSync(new URL(u), 'utf8')));
  if (u === '/straz-eshopu/stav.json') return odpoved(200, { live: false });
  if (u.startsWith('https://feed-monitor.arling.workers.dev/v1/agent-ready/check')) { kontroly.push(u); return odpovedKontroly(u); }
  return odpoved(404, null);
};
async function app({ lang = 'sk', hash = '', search = '', oprava = true } = {}) {
  volania.length = 0; udalosti.length = 0; zamena.length = 0; kontroly.length = 0;
  Object.assign(globalThis.location, { hash, search });
  const doc = stranka(lang, { oprava });
  const modul = await import('./app.mjs?beh=' + (++poradie));
  const $ = (id) => doc.getElementById(id);
  const rep = $('report');
  const posli = async (adresa = 'obchod.example.org', produkt = '') => {
    $('store-url').value = adresa; $('product-url').value = produkt;
    const pred = kontroly.length;
    await $('check-form').fire('submit', { preventDefault() {} });
    return pred;
  };
  return { doc, $, rep, modul, posli };
}
const hotovo = (rep) => cakajNa(() => !rep.hidden, 'výsledok vykreslený');
const ukazy = () => volania.filter(([n]) => n === 'ukaz');
const skrytia = () => volania.filter(([n]) => n === 'skry');

// ---------- 1. modul hubu chýba (pred podvrhnutím) ----------
test('modul /vysledok/vysledok-email.js chýba: výsledok sa vykreslí celý, miesto ostane prázdne, nič nezlyhá', async () => {
  const { rep, posli } = await app();
  await posli(); await hotovo(rep); await pockaj(30);
  const miesto = triedy(rep, 'ar-vysledok-miesto');
  assert.equal(miesto.length, 1); assert.equal(miesto[0].childNodes.length, 0);
  assert.equal(triedy(rep, 'ar-eu').length, 1); assert.equal(volania.length, 0);
});

// Odteraz import modulu hubu vráti falošný modul (o 50 ms, aby sa dal overiť neskorý import). Háčik sa zaregistruje až v tomto teste
// (testy v súbore bežia za sebou), aby prvý test videl chýbajúci modul. P5 (O3a): každé rozlíšenie dostane vlastnú kópiu modulu
// (fragment #n v adrese data:), ktorá pri vyhodnotení zapíše načítanie do nacitania; tak sa dá overiť, kedy app.mjs import začal.
const FALOSNY = 'data:text/javascript,' + encodeURIComponent("const v=()=>globalThis.__vysledok.volania;globalThis.__vysledok.nacitania.push(Date.now());export function ukaz(m,o){v().push(['ukaz',m,o]);}export function skry(m){v().push(['skry',m]);}");
test('podvrhnutie modulu hubu háčikom načítania', () => {
  register('data:text/javascript,' + encodeURIComponent(`const F=${JSON.stringify(FALOSNY)};let n=0;export async function resolve(s,c,dalej){if(s==='/vysledok/vysledok-email.js?v=1'){await new Promise(r=>setTimeout(r,50));return {url:F+'#'+(++n),shortCircuit:true};}return dalej(s,c);}`));
});

// ---------- 2. zhrnutie a miesto ----------
const OCAKAVANE = { obchod: 'https://obchod.example.org/', skore: 88, pokrytie: 100, pravidla: ['feed_description', 'feed_type', 'jsonld_returns', 'jsonld_shipping'],
  eu: [{ kod: 'eu_withdrawal', stav: 'not_found' }, { kod: 'eu_guarantee_notice', stav: 'found' }, { kod: 'eu_green_claims', stav: 'found' }] };
const bezCudzieho = (zhrnutie) => {
  const s = JSON.stringify(zhrnutie);
  for (const x of ['linen-shirt', '/products', 'Right of withdrawal', 'right-of-withdrawal', 'Eco-friendly', 'eco-friendly', 'robots.txt', 'sample.example.org', '<', 'label', 'href', 'affected', 'evidence'])
    assert.ok(!s.includes(x), 'zhrnutie nesmie obsahovať ' + x + ': ' + s);
  assert.equal(s.split('https://').length - 1, 1, 'jediná adresa je pôvod obchodu');
};
test('skutočná kontrola: miesto za zoznamom opráv, limitmi, EÚ a čakacou listinou, tesne pred všetkými kontrolami (Z-392); ukaz raz s nástrojom, jazykom a zhrnutím podľa SPEC časť 3', async () => {
  const { rep, posli } = await app({ lang: 'sk' });
  await posli(); await hotovo(rep); await cakajNa(() => ukazy().length === 1, 'ukaz');
  const deti = rep.children, miesto = triedy(rep, 'ar-vysledok-miesto');
  assert.equal(miesto.length, 1); const i = deti.indexOf(miesto[0]);
  assert.ok(i > deti.findIndex((e) => e.tagName === 'UL' && ma(e, 'ar-list')), 'za zoznamom opráv');
  assert.ok(i > deti.findIndex((e) => ma(e, 'ar-limits')) && i > deti.findIndex((e) => ma(e, 'ar-eu')), 'za limitmi a EÚ');
  assert.ok(ma(deti[i - 1], 'ar-pro-cakacia'), 'hneď za čakacou listinou (platená ponuka je nad blokom)');
  assert.equal(deti[i + 1].tagName, 'DETAILS', 'hneď pred zoznamom všetkých kontrol');
  const [[, m, o]] = ukazy();
  assert.equal(m, miesto[0]);
  assert.deepEqual(Object.keys(o).sort(), ['jazyk', 'nastroj', 'vysledok']);
  assert.equal(o.nastroj, 'agent-ready'); assert.equal(o.jazyk, 'sk');
  assert.deepEqual(o.vysledok, OCAKAVANE); assert.deepEqual(Object.keys(o.vysledok), ['obchod', 'skore', 'pokrytie', 'pravidla', 'eu']);
  bezCudzieho(o.vysledok);
  assert.equal(skrytia().length, 0);
  assert.ok(!JSON.stringify(udalosti).includes('obchod.example.org'), 'Umami bez adresy obchodu');
});
test('miesto aj pri výsledku bez chýb (za vetou bez chýb) a bez prečítanej produktovej stránky (za neutrálnou vetou; bez Shopify hneď za EÚ, bez bloku appky); jazyk EN a DE', async () => {
  // Brána 218 D2: obchod bez Shopify nemá pod EÚ (a boxom Stráže, tu nie je živý) blok čakacej listiny appky ani vetu o nej.
  for (const [lang, data, trieda, listina] of [
    ['en', vysledokObchodu({ rules: VZORKA.rules.map((r) => ({ ...r, status: r.status === 'fail' ? 'pass' : r.status })) }), null, 'ar-pro-cakacia'],
    ['de', bezShopify({ score: null, coverage: 0, sample: { ...VZORKA.sample, products: 0, pages: 0, attemptedPages: 0 }, rules: VZORKA.rules.map((r) => ({ ...r, status: 'unknown' })) }), 'ar-no-pages', 'ar-eu'],
  ]) {
    odpovedKontroly = () => odpoved(200, data);
    const { rep, posli } = await app({ lang });
    await posli(); await hotovo(rep); await cakajNa(() => ukazy().length === 1, 'ukaz ' + lang);
    const deti = rep.children, i = deti.findIndex((e) => ma(e, 'ar-vysledok-miesto'));
    const veta = trieda ? deti.findIndex((e) => ma(e, trieda)) : deti.findIndex((e) => e.tagName === 'P' && e.textContent === UI[lang].empty);
    assert.ok(veta >= 0 && veta < i, lang + ': veta bez chýb alebo neutrálna veta nad miestom');
    assert.ok(ma(deti[i - 1], listina), lang + ': hneď za čakacou listinou (Shopify) alebo za EÚ (bez Shopify)'); assert.equal(deti[i + 1].tagName, 'DETAILS', lang);
    if (lang === 'de') assert.equal(triedy(rep, 'ar-pro-cakacia').length, 0, 'bez Shopify žiadny blok appky');
    const o = ukazy()[0][2]; assert.equal(o.jazyk, lang);
    if (lang === 'en') assert.deepEqual(o.vysledok.pravidla, []);
    else { assert.equal(o.vysledok.skore, null); assert.equal(o.vysledok.pokrytie, 0); assert.deepEqual(o.vysledok.pravidla, []); }
  }
  odpovedKontroly = () => odpoved(200, vysledokObchodu());
});
test('zhrnutieVysledku: len pôvod https obchodu, známe kódy a stavy, najviac 3 EÚ; HTML v adrese ani cudzie polia neprejdú; zlá adresa = null', async () => {
  const { modul } = await app();
  const z = modul.zhrnutieVysledku;
  assert.deepEqual(z(vysledokObchodu()), OCAKAVANE);
  const zle = vysledokObchodu({ storeUrl: 'https://obchod.example.org/<img src=x onerror=alert(1)>?a=1#b', score: 101, coverage: -1,
    rules: [...VZORKA.rules, { code: '<script>', status: 'fail' }, { code: 'feed_type', status: 'fail' }],
    eu: { version: 1, rules: [...VZORKA.eu.rules, { code: 'eu_withdrawal', status: 'found' }, { code: 'eu_x', status: 'found' }, { code: 'eu_green_claims', status: '<b>' }] } });
  const r = z(zle);
  assert.equal(r.obchod, 'https://obchod.example.org/'); assert.equal(r.skore, null); assert.equal(r.pokrytie, null);
  assert.deepEqual(r.pravidla, OCAKAVANE.pravidla, 'neznámy kód zahodený, duplicita raz');
  assert.deepEqual(r.eu, OCAKAVANE.eu, 'najviac 3, každý kód raz, neznáme zahodené');
  bezCudzieho(r);
  for (const adresa of ['http://obchod.example.org', 'https://u:p@obchod.example.org', 'javascript:alert(1)', '', null, 42]) assert.equal(z(vysledokObchodu({ storeUrl: adresa })), null, String(adresa));
  const [w, g, c] = VZORKA.eu.rules;
  assert.deepEqual(z(vysledokObchodu({ eu: { version: 1, rules: [{ ...w, status: '<b>' }, { code: 'eu_x', status: 'found' }, w, { ...w, status: 'found' }, g, c] } })).eu, OCAKAVANE.eu,
    'neznámy stav a kód na začiatku zahodené, druhý eu_withdrawal zahodený');
  assert.deepEqual(z(vysledokObchodu({ eu: null })).eu, []); assert.deepEqual(z(vysledokObchodu({ eu: { version: 1, rules: 'x' } })).eu, []);
  // IDN: pôvod v ASCII (punycode)
  assert.equal(z(vysledokObchodu({ storeUrl: 'https://čaj.example.sk/x' })).obchod, 'https://xn--aj-dma.example.sk/');
});

// ---------- 3. vzorka ----------
test('vzorka: žiadne miesto, ukaz sa nevolá', async () => {
  const { rep, $ } = await app();
  await $('sample').click(); await hotovo(rep); await pockaj(90);
  assert.equal(triedy(rep, 'ar-vysledok-miesto').length, 0); assert.equal(ukazy().length, 0);
  assert.equal(rep.children.find((e) => ma(e, 'ar-status')).textContent, UI.sk.sample);
});

// ---------- 4. skry a súbeh ----------
test('nový beh, vzorka, zrušenie, úprava vstupu a chyba volajú skry na starom mieste; nové ukaz ide len do nového miesta', async () => {
  for (const akcia of ['beh', 'vzorka', 'zrusenie', 'vstup', 'chyba']) {
    const { rep, posli, $ } = await app();
    await posli(); await hotovo(rep); await cakajNa(() => ukazy().length === 1, akcia);
    const stare = ukazy()[0][1];
    if (akcia === 'beh') { await posli('obchod.example.org'); await cakajNa(() => ukazy().length === 2, 'druhé ukaz'); }
    else if (akcia === 'vzorka') { await $('sample').click(); await hotovo(rep); await pockaj(90); }
    else if (akcia === 'zrusenie') await $('cancel').click();
    else if (akcia === 'vstup') await $('store-url').fire('input');
    else { odpovedKontroly = () => odpoved(500, null); await posli(); await cakajNa(() => $('status').textContent === UI.sk.error, 'chyba'); odpovedKontroly = () => odpoved(200, vysledokObchodu()); }
    await cakajNa(() => skrytia().length >= 1, 'skry ' + akcia);
    assert.equal(skrytia()[0][1], stare, akcia + ': skry na starom mieste');
    assert.ok(volania.findIndex(([n, m]) => n === 'skry' && m === stare) < (volania.findIndex(([n, m]) => n === 'ukaz' && m !== stare) >>> 0), akcia + ': skry pred novým ukaz');
    if (akcia === 'beh') { const nove = ukazy()[1][1]; assert.notEqual(nove, stare); assert.equal(nove.parentNode, rep); assert.equal(stare.parentNode, null); }
    else assert.equal(ukazy().length, 1, akcia + ': žiadne ďalšie ukaz');
    if (akcia !== 'beh' && akcia !== 'vzorka') assert.equal(rep.hidden, true, akcia);
  }
});
test('súbeh: import dobehne až po úprave vstupu alebo po novom behu: do starého miesta nič, do nového raz', async () => {
  // a) úprava vstupu skôr, než sa modul načíta (import trvá 50 ms)
  let x = await app();
  await x.posli(); await hotovo(x.rep);
  assert.equal(volania.length, 0, 'modul sa ešte načítava');
  await x.$('store-url').fire('input'); await pockaj(120);
  assert.equal(ukazy().length, 0, 'skrytý výsledok nedostal blok');
  // b) nový beh skôr, než sa modul načíta: prvé miesto nič, druhé raz
  x = await app();
  await x.posli(); await hotovo(x.rep);
  const prve = triedy(x.rep, 'ar-vysledok-miesto')[0];
  await x.posli(); await cakajNa(() => triedy(x.rep, 'ar-vysledok-miesto')[0] !== prve && !x.rep.hidden, 'druhý výsledok');
  const druhe = triedy(x.rep, 'ar-vysledok-miesto')[0];
  await cakajNa(() => ukazy().length >= 1, 'ukaz'); await pockaj(30);
  assert.deepEqual(ukazy().map(([, m]) => m), [druhe]);
  assert.ok(!ukazy().some(([, m]) => m === prve));
  // c) stará odpoveď kontroly po novom behu sa zahodí (controller.mjs): jedno miesto, jedno ukaz s novým obchodom
  let pustStaru; const stara = new Promise((r) => { pustStaru = r; });
  odpovedKontroly = (u) => u.includes('stary') ? stara : odpoved(200, vysledokObchodu({ storeUrl: 'https://novy.example.org/' }));
  x = await app();
  await x.posli('stary.example.org'); await x.posli('novy.example.org');
  await hotovo(x.rep); await cakajNa(() => ukazy().length === 1, 'ukaz nový');
  pustStaru(odpoved(200, vysledokObchodu({ storeUrl: 'https://stary.example.org/' }))); await pockaj(120);
  assert.deepEqual(ukazy().map(([, , o]) => o.vysledok.obchod), ['https://novy.example.org/']);
  assert.equal(triedy(x.rep, 'ar-vysledok-miesto').length, 1);
  odpovedKontroly = () => odpoved(200, vysledokObchodu());
});

// ---------- 4b. P5 (brána 205 pokus 1, O3a): modul bloku sa načíta pri štarte ostrej kontroly ----------
test('P5: ostrá kontrola začne import modulu bloku pred odpoveďou kontroly a blok je pri výsledku hneď (bez čakania na import); vzorka modul nenačíta; zrušená kontrola nič nevykreslí (v oboch poradiach)', async () => {
  const drz = () => { let pusti; const p = new Promise((r) => { pusti = r; }); return { p, pusti: (x) => pusti(x) }; };
  // a) ostrá kontrola: odpoveď kontroly drží test, modul sa medzitým načíta (háčik 50 ms)
  let d = drz(); odpovedKontroly = () => d.p;
  let n0 = nacitania.length;
  let x = await app({ lang: 'sk' });
  await x.posli();
  await cakajNa(() => nacitania.length === n0 + 1, 'modul načítaný počas kontroly');
  assert.equal(kontroly.length, 1, 'dopyt kontroly odišiel'); assert.equal(x.rep.hidden, true, 'odpoveď kontroly ešte neprišla');
  assert.equal(volania.length, 0, 'načítanie samo nič nevykreslí');
  d.pusti(odpoved(200, vysledokObchodu()));
  await hotovo(x.rep);
  // V tej istej úlohe ako výsledok: pri prvom pohľade na vykreslený výsledok už je ukaz (bez čakania 50 ms na import).
  assert.equal(ukazy().length, 1, 'blok sa vložil spolu s výsledkom');
  assert.equal(ukazy()[0][1], triedy(x.rep, 'ar-vysledok-miesto')[0]);
  await pockaj(80); assert.equal(nacitania.length, n0 + 1, 'pri vykreslení sa modul nenačítava znova');
  // b) vzorka: žiadne načítanie modulu, žiadne miesto
  odpovedKontroly = () => odpoved(200, vysledokObchodu());
  n0 = nacitania.length;
  x = await app({ lang: 'en' });
  await x.$('sample').click(); await hotovo(x.rep); await pockaj(90);
  assert.equal(nacitania.length, n0, 'vzorka modul nenačíta'); assert.equal(volania.length, 0);
  // neplatná adresa: kontrola nezačne, modul sa nenačíta
  await x.posli('http://obchod.example.org'); await pockaj(90);
  assert.equal(nacitania.length, n0, 'neplatná adresa modul nenačíta'); assert.equal(kontroly.length, 0);
  // c1) zrušenie po načítaní modulu, potom príde odpoveď: nič sa nevykreslí
  // c2) zrušenie pred načítaním modulu, modul príde po ňom, potom odpoveď: nič sa nevykreslí
  for (const poradieZrusenia of ['po-nacitani', 'pred-nacitanim']) {
    d = drz(); odpovedKontroly = () => d.p;
    n0 = nacitania.length;
    x = await app({ lang: 'de' });
    await x.posli();
    if (poradieZrusenia === 'po-nacitani') await cakajNa(() => nacitania.length === n0 + 1, 'modul načítaný');
    else assert.equal(nacitania.length, n0, 'modul sa ešte načítava');
    await x.$('cancel').click();
    assert.equal(x.$('status').textContent, UI.de.cancelled);
    await cakajNa(() => nacitania.length === n0 + 1, 'modul načítaný po zrušení');
    d.pusti(odpoved(200, vysledokObchodu())); await pockaj(120);
    assert.equal(x.rep.hidden, true, poradieZrusenia + ': výsledok sa nevykreslil');
    assert.equal(triedy(x.rep, 'ar-vysledok-miesto').length, 0, poradieZrusenia);
    assert.equal(ukazy().length, 0, poradieZrusenia + ': žiadne ukaz');
  }
  odpovedKontroly = () => odpoved(200, vysledokObchodu());
});

// ---------- 5. #url= ----------
test('#url=: platná adresa predvyplní pole, fragment zmizne (query s UTM ostane), fokus na Skontrolovať, kontrola sa nespustí', async () => {
  for (const [hash, cakane] of [
    ['#url=https%3A%2F%2Fobchod.example.org%2F', 'https://obchod.example.org/'],
    ['#url=obchod.example.org', 'https://obchod.example.org/'],
    ['#url=https%3A%2F%2Fobchod.example.org%2Fkolekcia', 'https://obchod.example.org/kolekcia'],
  ]) {
    const { $ } = await app({ hash, search: '?utm_source=vysledok-email&utm_medium=email' });
    assert.equal($('store-url').value, cakane, hash);
    assert.deepEqual(zamena, ['/feed-doctor/agent-ready/sk/?utm_source=vysledok-email&utm_medium=email'], hash);
    assert.equal(globalThis.document.activeElement, $('check'), hash);
    await pockaj(20); assert.equal(kontroly.length, 0, 'bez spustenia'); assert.equal($('report').hidden, true);
  }
});
test('#url=: neplatná adresa sa ticho zahodí (fragment aj tak zmizne); iné kotvy a stránka bez fragmentu ostanú nedotknuté', async () => {
  for (const hash of ['#url=http%3A%2F%2Fobchod.example.org', '#url=https%3A%2F%2Fu%3Ap%40obchod.example.org', '#url=https%3A%2F%2Fobchod.example.org%2F%3Fa%3D1',
    '#url=https%3A%2F%2Fobchod.example.org%2F%23x', '#url=javascript%3Aalert(1)', '#url=', '#url=https%3A%2F%2Fob%20chod.example.org']) {
    const { $ } = await app({ hash });
    assert.equal($('store-url').value, '', hash); assert.equal(zamena.length, 1, hash + ': fragment odstránený');
    assert.equal(globalThis.document.activeElement, null, hash + ': fokus sa nepresunie'); assert.equal($('status').textContent, '', hash + ': ticho');
  }
  for (const hash of ['', '#', '#odber', '#pro', '#urlx=https%3A%2F%2Fobchod.example.org']) {
    const { $ } = await app({ hash });
    assert.equal($('store-url').value, '', hash); assert.deepEqual(zamena, [], hash + ': fragment ostal');
  }
  const { modul } = await app();
  assert.deepEqual(modul.adresaZOdkazu('#url=obchod.example.org&x=1'), { najdene: true, adresa: 'https://obchod.example.org/' });
  assert.deepEqual(modul.adresaZOdkazu('url=obchod.example.org'), { najdene: false, adresa: null });
});

// ---------- 6. trenie (a): ponuka opravy 149 USD ----------
test('trenie a: #fix-service po výsledku len pre Shopify so zlyhaným typom produktu, vrátením alebo doručením; pred výsledkom a po skrytí ako v HTML', async () => {
  const opravy = ['feed_type', 'jsonld_returns', 'jsonld_shipping'];
  const len = (kody) => VZORKA.rules.map((r) => ({ ...r, status: kody.includes(r.code) ? 'fail' : r.status === 'fail' ? 'pass' : r.status }));
  for (const [popis, data, skryte] of [
    ['Shopify, zlyhal typ produktu', vysledokObchodu(), false],
    ['Shopify, len vrátenie', vysledokObchodu({ rules: len(['jsonld_returns']) }), false],
    ['Shopify, len doručenie', vysledokObchodu({ rules: len(['jsonld_shipping']) }), false],
    ['Shopify, zlyhal len popis', vysledokObchodu({ rules: len(['feed_description']) }), true],
    ['Shopify bez chýb', vysledokObchodu({ rules: len([]) }), true],
    ['bez Shopify so zlyhaným typom', bezShopify(), true],
  ]) {
    odpovedKontroly = () => odpoved(200, data);
    const { rep, posli, $ } = await app({ lang: 'en' });
    assert.equal($('fix-service').hidden, false, popis + ': pred výsledkom viditeľná');
    await posli(); await hotovo(rep);
    assert.equal($('fix-service').hidden, skryte, popis);
    await $('store-url').fire('input');
    assert.equal($('fix-service').hidden, false, popis + ': po úprave vstupu ako pred výsledkom');
  }
  assert.ok(opravy.every((k) => VZORKA.rules.some((r) => r.code === k)), 'kódy existujú v core.mjs');
  // vzorka (fiktívny obchod Shopify so zlyhaným typom produktu): ponuka ostáva; chyba kontroly ju vráti do pôvodného stavu
  const { rep, $, posli } = await app({ lang: 'en' });
  await $('sample').click(); await hotovo(rep); assert.equal($('fix-service').hidden, false);
  odpovedKontroly = () => odpoved(200, bezShopify());
  await posli(); await cakajNa(() => $('fix-service').hidden === true, 'skrytá');
  odpovedKontroly = () => odpoved(502, null);
  await posli(); await cakajNa(() => $('status').textContent === UI.en.error, 'chyba');
  assert.equal($('fix-service').hidden, false);
  odpovedKontroly = () => odpoved(200, vysledokObchodu());
  // stránka bez sekcie (SK, DE): nič nezlyhá
  const sk = await app({ oprava: false }); await sk.posli(); await hotovo(sk.rep);
});

// ---------- 7. trenie (b): vety chýb ----------
test('trenie b: adresa s ? alebo #, bez https alebo neplatná má vlastnú vetu a nič neodošle; zlá produktová stránka tiež; limit povie ďalší krok', async () => {
  for (const lang of ['sk', 'en', 'de']) {
    for (const adresa of ['https://obchod.example.org/?a=1', 'https://obchod.example.org/#x', 'http://obchod.example.org', 'https://u:p@obchod.example.org', 'ob chod', '   ']) {
      const { posli, $ } = await app({ lang });
      await posli(adresa); await cakajNa(() => $('status').textContent !== UI[lang].busy, 'stav');
      assert.equal($('status').textContent, UI[lang].invalid_url, lang + ' ' + adresa); assert.equal(kontroly.length, 0);
    }
    for (const produkt of ['https://ine.example.org/products/x', 'https://obchod.example.org/products/x#a', 'nie-je-adresa']) {
      const { posli, $ } = await app({ lang });
      await posli('obchod.example.org', produkt); await cakajNa(() => $('status').textContent !== UI[lang].busy, 'stav');
      assert.equal($('status').textContent, UI[lang].invalid_product, lang + ' ' + produkt); assert.equal(kontroly.length, 0);
    }
    odpovedKontroly = () => odpoved(429, { error: 'rate_limited' });
    const { posli, $ } = await app({ lang });
    await posli(); await cakajNa(() => $('status').textContent === UI[lang].rate, 'limit ' + lang);
    odpovedKontroly = () => odpoved(200, vysledokObchodu());
  }
  assert.match(UI.sk.invalid_url, /\? ani #/); assert.match(UI.sk.invalid_url, /https:\/\/obchod\.sk/);
  assert.match(UI.sk.rate, /o hodinu/); assert.match(UI.sk.rate, /vzorový výsledok/); assert.match(UI.en.rate, /sample report/); assert.match(UI.de.rate, /Beispielbericht/);
  // starý i18n.mjs z vyrovnávacej pamäte bez nových kľúčov: všeobecná veta, nikdy undefined
  const zaloha = UI.sk.invalid_url; delete UI.sk.invalid_url;
  try { const { posli, $ } = await app(); await posli('https://obchod.example.org/?a=1'); await cakajNa(() => $('status').textContent !== UI.sk.busy, 'stav'); assert.equal($('status').textContent, UI.sk.error); }
  finally { UI.sk.invalid_url = zaloha; }
  // výnimka s názvom iného kľúča textov (napr. „limit“) neukáže cudziu vetu
  const { posli, $ } = await app();
  odpovedKontroly = () => { throw new Error('limit'); };
  await posli(); await cakajNa(() => $('status').textContent !== UI.sk.busy, 'stav'); assert.equal($('status').textContent, UI.sk.error);
  odpovedKontroly = () => odpoved(200, vysledokObchodu());
});

// ---------- 8. trenie (c): riadok rozsahu ----------
test('trenie c: obchod bez verejného exportu nemá „0 produktov vo feede“, ale vetu o exporte a počet prečítaných stránok; so starým i18n.mjs riadok ako predtým', async () => {
  const bezExportu = bezShopify({ sample: { ...VZORKA.sample, products: 0, pages: 2, attemptedPages: 3 } });
  for (const lang of ['sk', 'en', 'de']) {
    odpovedKontroly = () => odpoved(200, bezExportu);
    const { rep, posli } = await app({ lang });
    await posli(); await hotovo(rep);
    const dd = triedy(rep, 'ar-scope')[0].all((e) => e.tagName === 'DD')[0].textContent;
    assert.equal(dd, `${UI[lang].noFeed}, 2/3 ${UI[lang].pages}`, lang); assert.ok(!dd.includes(UI[lang].products), lang);
    odpovedKontroly = () => odpoved(200, vysledokObchodu());
    const s = await app({ lang }); await s.posli(); await hotovo(s.rep);
    assert.equal(triedy(s.rep, 'ar-scope')[0].all((e) => e.tagName === 'DD')[0].textContent, `1 ${UI[lang].products}, 1/1 ${UI[lang].pages}`, lang + ': s exportom ako predtým');
  }
  const zaloha = UI.sk.noFeed; delete UI.sk.noFeed;
  try {
    odpovedKontroly = () => odpoved(200, bezExportu);
    const { rep, posli } = await app(); await posli(); await hotovo(rep);
    assert.equal(triedy(rep, 'ar-scope')[0].all((e) => e.tagName === 'DD')[0].textContent, `0 ${UI.sk.products}, 2/3 ${UI.sk.pages}`);
  } finally { UI.sk.noFeed = zaloha; odpovedKontroly = () => odpoved(200, vysledokObchodu()); }
});

// ---------- 9. texty, verzie a tri HTML ----------
test('nové texty v SK, EN, DE bez pomlčiek em a en; i18n.mjs má rovnaké ?v v app.mjs aj cakacia.mjs; tri HTML: Umami s data-exclude-hash, app.mjs?v=6 (relácia 218)', () => {
  for (const lang of ['sk', 'en', 'de']) for (const k of ['invalid_url', 'invalid_product', 'noFeed', 'rate']) {
    assert.equal(typeof UI[lang][k], 'string', lang + ' ' + k); assert.ok(!/[–—]/.test(UI[lang][k]), lang + ' ' + k + ': pomlčka');
  }
  const subor = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
  const verzia = (t) => [...t.matchAll(/\.\/i18n\.mjs\?v=(\d+)/g)].map((m) => m[1]);
  // O3a: i18n.mjs zmenený (veta privacy, O2) = ?v=4; relácia 218 (veta o Shoptete v EU_UI) = ?v=5 v oboch importoch aj v
  // straz.test.mjs (tá istá inštancia ako app.mjs)
  assert.deepEqual(verzia(subor('./app.mjs')), ['5']); assert.deepEqual(verzia(subor('./cakacia.mjs')), ['5']); assert.deepEqual(verzia(subor('./straz.test.mjs')), ['5']);
  assert.ok(subor('./app.mjs').includes("'/vysledok/vysledok-email.js?v=1'"));
  for (const p of ['./index.html', './sk/index.html', './de/index.html']) {
    const html = subor(p), umami = html.split('\n').filter((r) => r.includes('api.arling.workers.dev/script.js'));
    assert.equal(umami.length, 1, p);
    assert.match(umami[0], /data-exclude-hash="true"/, p); assert.ok(!umami[0].includes('data-exclude-search'), p + ': UTM sa merajú ďalej');
    assert.equal((html.match(/\/feed-doctor\/agent-ready\/app\.mjs\?v=6"/g) || []).length, 1, p);
    assert.ok(!html.includes('\r\n'), p + ': konce riadkov LF');
  }
});
