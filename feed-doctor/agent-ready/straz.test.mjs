// Testy Stráže e-shopu vo výsledku kontroly (relácia 209, ops/druhy-ucet/209/PRODUKT.md; AGENTS.md bod 12) s malým falošným DOM:
// ponuka len pri live alebo test móde, odkazy „Sledovať ďalej“ len pri neúspešných pravidlách prvého zoznamu a nálezoch EÚ s tónom
// review alebo unknown, box za blokom EÚ a pred čakacou listinou, dvojklik pošle jeden dopyt, stará odpoveď ani odpoveď do
// vymeneného boxu nič neprepíše, chyby 400, 409, 429, 500 a sieť nechajú údaje a nič neukážu ako hotové, nebezpečná odpoveď sa
// odmietne, Umami nikdy nedostane adresu obchodu, feedu ani e-mail a v test móde nedostane nič.
// cd products/arling-sk/feed-doctor/agent-ready && node --test straz.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// ---------- malý falošný DOM ----------
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
  get isConnected() { let n = this; while (n.parentNode) n = n.parentNode; return n === this.ownerDocument.documentElement; }
  focus() { this.ownerDocument.activeElement = this; } scrollIntoView() {} click() { return this.fire('click', {}); }
  closest() { return null; } querySelector() { return null; } querySelectorAll() { return []; }
  all(pred) { const out = []; const walk = (n) => { for (const c of n.children) { if (pred(c)) out.push(c); walk(c); } }; walk(this); return out; }
}
const ma = (el, cls) => String(el.className).split(/\s+/).includes(cls);
const triedy = (root, cls) => root.all((e) => ma(e, cls));
const prve = (root, cls) => triedy(root, cls)[0] || null;
function falosnyDoc(lang = 'sk') {
  const doc = {};
  doc.documentElement = new El('html', doc); doc.documentElement.lang = lang;
  doc.head = new El('head', doc); doc.body = new El('body', doc); doc.documentElement.append(doc.head, doc.body);
  doc.createElement = (t) => new El(t, doc);
  doc.getElementById = (id) => doc.documentElement.all((e) => e.id === id)[0] || null;
  doc.querySelector = (s) => s === 'link[data-ar-straz]' ? doc.head.children.find((l) => 'arStraz' in l.dataset) || null : s === '[data-pro-link]' ? doc.proLink || null : null;
  doc.querySelectorAll = () => []; doc.readyState = 'complete'; doc.addEventListener = () => {};
  return doc;
}
const uloziste = () => { const m = new Map(); return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };

// ---------- globály pred importom modulov ----------
const udalosti = [];
const okno = { umami: { track: (n, d) => udalosti.push([n, d]) }, _l: {}, addEventListener(t, f) { (this._l[t] ||= []).push(f); } };
globalThis.window = okno;
globalThis.location = { search: '', hostname: 'arling.sk', origin: 'https://arling.sk', assign() { throw new Error('location.assign nemá byť volané priamo'); } };
globalThis.document = falosnyDoc('sk');
globalThis.matchMedia = () => ({ matches: true });

const S = await import('./straz.mjs?v=2'); // tá istá inštancia, ktorú načíta app.mjs
const { deps, T, API, BOX_ID, NAVRAT, buildStrazBox, strazLink, strazOn, platnaOdpoved, pocetNalezov } = S;
const VZORKA = JSON.parse(readFileSync(new URL('./sample-report.json', import.meta.url), 'utf8'));
const povodne = { ...deps };
const chvila = () => new Promise((r) => setTimeout(r, 0));
const odlozeny = () => { let ok, zle; const p = new Promise((a, b) => { ok = a; zle = b; }); return { p, ok, zle }; };
const odpoved = (status, data) => ({ ok: status >= 200 && status < 300, status, json: async () => data });
const SPRAVNA = { id: 'mon_abc123', key: 'k_0123456789abcdef', checkout_url: 'https://buy.stripe.com/8x214he2mbOj1Sq2hL4ko05?client_reference_id=mon_abc123&prefilled_email=jana%40example.org&locale=sk', plan: 'free', status: 'pending_payment' };

let casovace = [];
function nastav({ fetch, search = '', session = uloziste(), local = uloziste(), umami = true } = {}) {
  Object.assign(deps, povodne);
  casovace = []; udalosti.length = 0; const presmerovania = [];
  okno.umami = umami ? { track: (n, d) => udalosti.push([n, d]) } : undefined; delete okno.__strazFronta; delete okno.__strazCaka;
  Object.assign(deps, { fetch, search: () => search, session: () => session, local: () => local, assign: (u) => presmerovania.push(u), now: () => new Date('2026-10-22T10:00:00.000Z'),
    setTimeout: (f) => { casovace.push(f); return casovace.length; }, clearTimeout: (i) => { if (i) casovace[i - 1] = null; }, stav: null });
  return { presmerovania, session, local };
}
const vyprsi = () => { for (const f of casovace.splice(0)) if (f) f(); };
const report = (storeUrl = 'https://obchod.example.org/products/x') => ({ ...VZORKA, storeUrl });
function box({ lang = 'sk', place = 'result', platform = 'no', data = report() } = {}) {
  const doc = falosnyDoc(lang); globalThis.document = doc;
  const b = buildStrazBox(lang, place, platform, data);
  if (b) doc.body.append(b);
  const ui = b && { box: b, doc, form: b.all((e) => e.tagName === 'FORM')[0], email: b.all((e) => e.id === BOX_ID + '-email')[0], feed: b.all((e) => e.id === BOX_ID + '-feed')[0],
    tlacidlo: prve(b, 'ar-straz-tlacidlo'), chyba: prve(b, 'ar-straz-chyba') };
  return ui;
}
const odosli = (ui) => ui.form.fire('submit', { preventDefault() {} });
const nehotove = (ui, email = 'jana@example.org') => {
  assert.equal(ui.email.value, email, 'e-mail ostal'); assert.equal(ui.tlacidlo.disabled, false); assert.equal(ui.email.readOnly, false); assert.equal(ui.feed.readOnly, false);
  assert.equal(ui.tlacidlo.textContent, T.sk.button); assert.equal(ui.chyba.hidden, false);
};
const bezOsobnych = (zoznam) => { const s = JSON.stringify(zoznam); for (const x of ['example.org', 'jana', '@', 'feed.xml', 'obchod']) assert.ok(!s.includes(x), 'Umami nesmie dostať ' + x + ': ' + s); };

// ---------- 1. zobrazenie len pri live alebo test móde ----------
test('strazOn: live true zapne ponuku a pripojí štýl raz; live false, "true" ako text, 404, chyba siete a pomalá odpoveď ju nechajú vypnutú', async () => {
  for (const [popis, fetch, cakane] of [
    ['live true', async () => odpoved(200, { live: true }), true],
    ['live false', async () => odpoved(200, { live: false }), false],
    ['live ako text', async () => odpoved(200, { live: 'true' }), false],
    ['404', async () => odpoved(404, null), false],
    ['zlý JSON', async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('x'); } }), false],
    ['sieť', async () => { throw new TypeError('Failed to fetch'); }, false],
  ]) {
    const volania = [];
    nastav({ fetch: (u, o) => { volania.push(u); return fetch(u, o); } });
    const doc = falosnyDoc(); globalThis.document = doc;
    assert.equal(await strazOn(), cakane, popis);
    assert.deepEqual(volania, ['/straz-eshopu/stav.json'], popis);
    assert.equal(doc.head.children.length, cakane ? 1 : 0, popis + ': štýl len pri zapnutej ponuke');
    if (cakane) { assert.equal(doc.head.children[0].rel, 'stylesheet'); assert.match(doc.head.children[0].href, /\/straz-box\.css\?v=2$/); }
    deps.stav = null; await strazOn(); assert.equal(doc.head.children.length, cakane ? 1 : 0, 'štýl sa nepridá druhýkrát');
  }
  // pomalá odpoveď: po limite vypnuté
  nastav({ fetch: () => new Promise(() => {}) }); globalThis.document = falosnyDoc();
  const beh = strazOn(); await chvila(); vyprsi();
  assert.equal(await beh, false);
});
test('test mód: ?test=1 sa uloží do sessionStorage straz:test a zapne ponuku bez čítania stav.json; ?test=0 nie', async () => {
  let pocet = 0;
  const { session } = nastav({ fetch: async () => { pocet++; return odpoved(200, { live: false }); }, search: '?test=1' });
  assert.equal(await strazOn(), true); assert.equal(session.getItem('straz:test'), '1'); assert.equal(pocet, 0);
  const s2 = uloziste(); s2.setItem('straz:test', '1');
  nastav({ fetch: async () => { pocet++; return odpoved(200, { live: false }); }, session: s2 });
  assert.equal(await strazOn(), true, 'uložený test mód platí aj bez ?test v adrese'); assert.equal(pocet, 0);
  const s3 = uloziste();
  nastav({ fetch: async () => { pocet++; return odpoved(200, { live: false }); }, search: '?test=0', session: s3 });
  assert.equal(await strazOn(), false); assert.equal(s3.getItem('straz:test'), null); assert.equal(pocet, 1);
});

// ---------- 2. app.mjs: odkazy a poradie vo výsledku ----------
function stranka(lang) {
  const doc = falosnyDoc(lang); globalThis.document = doc;
  const prvok = (tag, id) => { const e = doc.createElement(tag); e.id = id; doc.body.append(e); return e; };
  prvok('form', 'check-form'); prvok('section', 'report').hidden = true; prvok('p', 'status'); prvok('button', 'check'); prvok('button', 'cancel'); prvok('input', 'store-url'); prvok('input', 'product-url'); prvok('button', 'sample');
  return doc;
}
let poradie = 0;
async function spustiApp({ live, lang = 'sk', vysledok = null, sample = true }) {
  const kontroly = [];
  nastav({ fetch: async (u) => { if (u === '/straz-eshopu/stav.json') return odpoved(200, { live }); throw new Error('stav'); } });
  Object.assign(deps, { setTimeout: povodne.setTimeout, clearTimeout: povodne.clearTimeout });
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.startsWith('file:')) return odpoved(200, JSON.parse(readFileSync(new URL(u), 'utf8')));
    if (u.startsWith('https://feed-monitor.arling.workers.dev/v1/agent-ready/check')) { kontroly.push(u); return odpoved(200, vysledok); }
    return odpoved(404, null);
  };
  const doc = stranka(lang);
  await import('./app.mjs?beh=' + (++poradie));
  if (sample) await doc.getElementById('sample').click();
  else { doc.getElementById('store-url').value = 'obchod.example.org'; await doc.getElementById('check-form').fire('submit', { preventDefault() {} }); }
  await chvila();
  return { doc, rep: doc.getElementById('report'), kontroly };
}
test('app.mjs: bez live ani test módu sa nevloží box ani jeden odkaz „Sledovať ďalej“; zvyšok výsledku ostáva', async () => {
  const { rep } = await spustiApp({ live: false });
  assert.equal(rep.hidden, false);
  assert.equal(triedy(rep, 'ar-straz').length, 0); assert.equal(triedy(rep, 'ar-straz-odkaz').length, 0);
  assert.equal(triedy(rep, 'ar-eu').length, 1); assert.equal(triedy(rep, 'ar-pro-cakacia').length, 1, 'čakacia listina sa nemení');
  assert.ok(!udalosti.some(([n]) => n.startsWith('ar_straz')), 'žiadna udalosť Stráže');
});
test('app.mjs pri live: odkazy len pri neúspešných pravidlách prvého zoznamu a pri nálezoch EÚ review alebo unknown; box za EÚ a pred čakacou listinou', async () => {
  const { rep } = await spustiApp({ live: true });
  const boxy = triedy(rep, 'ar-straz'); assert.equal(boxy.length, 1);
  const deti = rep.children, iEu = deti.findIndex((e) => ma(e, 'ar-eu')), iBox = deti.indexOf(boxy[0]), iPro = deti.findIndex((e) => ma(e, 'ar-pro-cakacia'));
  assert.ok(iEu >= 0 && iBox === iEu + 1 && iPro === iBox + 1, `poradie EÚ ${iEu}, box ${iBox}, listina ${iPro}`);
  const prvy = deti.find((e) => e.tagName === 'UL' && ma(e, 'ar-list'));
  const neuspesne = VZORKA.rules.filter((r) => r.status === 'fail').map((r) => r.code).sort();
  const vPrvom = triedy(prvy, 'ar-straz-odkaz');
  assert.equal(vPrvom.length, neuspesne.length, 'jeden odkaz pri každom neúspešnom pravidle');
  assert.deepEqual(vPrvom.map((a) => a.dataset.finding).sort(), neuspesne);
  const vsetky = deti.find((e) => e.tagName === 'DETAILS'); assert.equal(triedy(vsetky, 'ar-straz-odkaz').length, 0, 'v zozname všetkých kontrol nie');
  const eu = triedy(deti[iEu], 'ar-eu-item');
  const sOdkazom = eu.filter((li) => triedy(li, 'ar-straz-odkaz').length).map((li) => prve(li, 'ar-eu-badge').dataset.tone);
  const tony = eu.map((li) => prve(li, 'ar-eu-badge').dataset.tone);
  assert.deepEqual(tony, ['unknown', 'ok', 'review']); assert.deepEqual(sOdkazom, ['unknown', 'review'], 'pri tóne ok odkaz nie je');
  for (const a of triedy(rep, 'ar-straz-odkaz')) { assert.equal(a.href, '#' + BOX_ID); assert.equal(a.textContent, T.sk.link); }
  // vzorka: bez formulára (fiktívny obchod), s vetou o Shopify, meranie raz s miestom sample
  assert.equal(boxy[0].all((e) => e.tagName === 'FORM').length, 0);
  assert.equal(triedy(boxy[0], 'ar-straz-platforma')[0].textContent, T.sk.shopify);
  assert.deepEqual(udalosti.filter(([n]) => n.startsWith('ar_straz')), [['ar_straz_offer_view', { lang: 'sk', place: 'sample', platform: 'yes', findings: 6 }]]);
});
test('app.mjs pri live, skutočná kontrola bez znakov Shopify: formulár s adresou obchodu ako text, bez vety o Shopify, pred vetou pre iné platformy', async () => {
  const vysledok = { ...VZORKA, storeUrl: 'https://obchod.example.org', platform: 'html', shopify: { detected: false, signals: [] } };
  const { rep, kontroly } = await spustiApp({ live: true, lang: 'de', vysledok, sample: false });
  assert.equal(kontroly.length, 1);
  const b = prve(rep, 'ar-straz'); assert.ok(b);
  assert.equal(prve(b, 'ar-straz-obchod').textContent, T.de.store + ' https://obchod.example.org');
  assert.equal(triedy(b, 'ar-straz-platforma').length, 0);
  assert.equal(b.all((e) => e.tagName === 'FORM').length, 1);
  assert.equal(rep.children.indexOf(b) + 1, rep.children.findIndex((e) => ma(e, 'ar-pro-poznamka')));
  assert.equal(b.all((e) => e.tagName === 'A' && e.href === '/straz-eshopu/de/')[0].textContent, T.de.more);
  assert.deepEqual(udalosti.filter(([n]) => n.startsWith('ar_straz')), [['ar_straz_offer_view', { lang: 'de', place: 'result', platform: 'no', findings: 6 }]]);
  bezOsobnych(udalosti);
});

// ---------- 3. odoslanie ----------
test('dvojklik pošle jeden dopyt; úspech uloží straz:navrat, zmeria klik s nálezom a raz presmeruje na Stripe; v Umami nie je adresa ani e-mail', async () => {
  const d = odlozeny(), poslane = [];
  const { presmerovania, local } = nastav({ fetch: (u, o) => { poslane.push([u, o]); return d.p; } });
  const ui = box();
  await chvila(); assert.deepEqual(udalosti, [['ar_straz_offer_view', { lang: 'sk', place: 'result', platform: 'no', findings: pocetNalezov(VZORKA) }]]);
  // klik na „Sledovať ďalej“ pri náleze zaznamená kód
  const a = strazLink('eu_withdrawal', 'sk'); ui.doc.body.append(a); await a.click();
  ui.email.value = ' jana@example.org '; ui.feed.value = 'https://obchod.example.org/feed.xml';
  const p1 = odosli(ui), p2 = odosli(ui); await chvila();
  assert.equal(poslane.length, 1, 'jeden dopyt'); assert.equal(ui.tlacidlo.disabled, true); assert.equal(ui.email.readOnly, true); assert.equal(ui.feed.readOnly, true);
  assert.equal(ui.tlacidlo.textContent, T.sk.sending);
  const [url, init] = poslane[0];
  assert.equal(url, API); assert.equal(init.method, 'POST'); assert.equal(init.credentials, 'omit');
  assert.deepEqual(JSON.parse(init.body), { store_url: 'https://obchod.example.org', email: 'jana@example.org', lang: 'sk', feed_url: 'https://obchod.example.org/feed.xml', test: false });
  d.ok(odpoved(201, SPRAVNA)); await Promise.all([p1, p2]);
  assert.deepEqual(presmerovania, [SPRAVNA.checkout_url]);
  assert.deepEqual(JSON.parse(local.getItem(NAVRAT)), { id: 'mon_abc123', key: 'k_0123456789abcdef', lang: 'sk', at: '2026-10-22T10:00:00.000Z' });
  assert.deepEqual(udalosti[1], ['ar_straz_subscribe_click', { lang: 'sk', place: 'result', finding: 'eu_withdrawal' }]);
  assert.equal(ui.tlacidlo.disabled, true, 'počas presmerovania ostáva zamknuté'); assert.equal(ui.tlacidlo.textContent, T.sk.redirect);
  await odosli(ui); assert.equal(poslane.length, 1, 'ďalší klik počas presmerovania nič nepošle');
  bezOsobnych(udalosti);
  // návrat z pokladne tlačidlom späť (bfcache): formulár sa odomkne
  for (const f of okno._l.pageshow || []) f({ persisted: true });
  assert.equal(ui.tlacidlo.disabled, false); assert.equal(ui.email.readOnly, false);
});
test('stará odpoveď: dopyt po limite zlyhá s vetou o neskorej odpovedi; jeho neskorý úspech nepresmeruje a neprepíše výsledok novšieho dopytu', async () => {
  const stary = odlozeny(), novy = odlozeny(), fronta = [stary, novy];
  const { presmerovania, local } = nastav({ fetch: () => fronta.shift().p });
  const ui = box(); ui.email.value = 'jana@example.org';
  const b1 = odosli(ui); await chvila(); vyprsi(); await b1;
  assert.equal(ui.chyba.textContent, T.sk.errors.timeout); nehotove(ui);
  const b2 = odosli(ui); await chvila();
  stary.ok(odpoved(201, SPRAVNA)); await chvila(); await chvila();
  assert.deepEqual(presmerovania, [], 'starý úspech nepresmeruje'); assert.equal(local.getItem(NAVRAT), null); assert.equal(ui.tlacidlo.disabled, true, 'nový dopyt beží');
  novy.ok(odpoved(409, { error: 'already_active' })); await b2;
  assert.equal(ui.chyba.textContent, T.sk.errors.active); nehotove(ui);
  assert.ok(!udalosti.some(([n]) => n === 'ar_straz_subscribe_click'));
});
test('odpoveď do boxu, ktorý nová kontrola medzitým nahradila, sa zahodí (nepresmeruje na platbu za iný obchod)', async () => {
  const d = odlozeny();
  const { presmerovania, local } = nastav({ fetch: () => d.p });
  const ui = box(); ui.email.value = 'jana@example.org';
  const beh = odosli(ui); await chvila();
  ui.box.remove();
  d.ok(odpoved(201, SPRAVNA)); await beh;
  assert.deepEqual(presmerovania, []); assert.equal(local.getItem(NAVRAT), null);
  assert.ok(!udalosti.some(([n]) => n === 'ar_straz_subscribe_click'));
});
test('chyby 409, 429, 400, 500 a sieť: správna veta, údaje ostanú, nič hotové, žiadne presmerovanie ani meranie kliku', async () => {
  for (const [r, veta, pole] of [
    [odpoved(409, { error: 'already_active', message: 'x' }), T.sk.errors.active, 'email'],
    [odpoved(429, { error: 'rate_limited' }), T.sk.errors.rate, null],
    [odpoved(400, { error: 'validation_failed', issues: [{ field: 'feed_url' }] }), T.sk.errors.feed, 'feed'],
    [odpoved(400, { error: 'validation_failed', issues: ['email'] }), T.sk.errors.email, 'email'],
    [odpoved(400, { error: 'validation_failed', issues: ['store_url'] }), T.sk.errors.store, null],
    [odpoved(500, null), T.sk.errors.server, null],
    [null, T.sk.errors.network, null],
  ]) {
    const { presmerovania, local } = nastav({ fetch: async () => { if (!r) throw new TypeError('Failed to fetch'); return r; } });
    const ui = box(); ui.email.value = 'jana@example.org'; ui.feed.value = 'https://obchod.example.org/feed.xml';
    await odosli(ui);
    assert.equal(ui.chyba.textContent, veta, veta); nehotove(ui); assert.equal(ui.feed.value, 'https://obchod.example.org/feed.xml');
    if (pole) assert.equal(ui[pole].getAttribute('aria-invalid'), 'true');
    assert.deepEqual(presmerovania, []); assert.equal(local.getItem(NAVRAT), null);
    assert.ok(!udalosti.some(([n]) => n === 'ar_straz_subscribe_click'));
    // písanie do poľa chybu skryje
    await ui.email.fire('input'); assert.equal(ui.chyba.hidden, true);
  }
});
test('neplatný e-mail alebo adresa feedu nič nepošle; nebezpečná odpoveď servera sa odmietne a na platbu nepresmeruje', async () => {
  let pocet = 0;
  nastav({ fetch: async () => { pocet++; return odpoved(201, SPRAVNA); } });
  for (const [email, feed, veta] of [['nie-je-adresa', '', T.sk.errors.email], ['jana@example', '', T.sk.errors.email], ['jana@example.org', 'javascript:alert(1)', T.sk.errors.feed], ['jana@example.org', 'ftp://obchod.example.org/f.xml', T.sk.errors.feed], ['jana@example.org', 'https://u:p@obchod.example.org/f.xml', T.sk.errors.feed]]) {
    const ui = box(); ui.email.value = email; ui.feed.value = feed;
    await odosli(ui); assert.equal(ui.chyba.textContent, veta, email + ' ' + feed);
  }
  assert.equal(pocet, 0);
  for (const zla of [{ ...SPRAVNA, checkout_url: 'javascript:alert(1)' }, { ...SPRAVNA, checkout_url: 'https://buy.stripe.com.evil.example/x' }, { ...SPRAVNA, checkout_url: 'http://buy.stripe.com/x' },
    { ...SPRAVNA, checkout_url: 'https://buy.stripe.com/x?client_reference_id=iny' }, { ...SPRAVNA, id: '<img>' }, { ...SPRAVNA, key: '' }, null, 'text']) {
    assert.equal(platnaOdpoved(zla), null, JSON.stringify(zla));
    const { presmerovania, local } = nastav({ fetch: async () => odpoved(201, zla) });
    const ui = box(); ui.email.value = 'jana@example.org';
    await odosli(ui);
    assert.equal(ui.chyba.textContent, T.sk.errors.bad); nehotove(ui); assert.deepEqual(presmerovania, []); assert.equal(local.getItem(NAVRAT), null);
  }
  assert.deepEqual(platnaOdpoved(SPRAVNA)?.id, 'mon_abc123');
});
test('test mód: dopyt nesie test true a Umami nedostane nič; ?test v adrese stíši Umami aj bez test módu ponuky', async () => {
  const s = uloziste(); s.setItem('straz:test', '1'); const poslane = [];
  const { presmerovania } = nastav({ fetch: async (u, o) => { poslane.push(JSON.parse(o.body)); return odpoved(200, SPRAVNA); }, session: s });
  const ui = box({ lang: 'en' }); ui.email.value = 'jana@example.org';
  await chvila(); await odosli(ui);
  assert.equal(poslane[0].test, true); assert.equal(poslane[0].lang, 'en'); assert.deepEqual(presmerovania, [SPRAVNA.checkout_url]);
  assert.deepEqual(udalosti, []);
  nastav({ fetch: async () => odpoved(200, SPRAVNA), search: '?test' });
  const ui2 = box(); ui2.email.value = 'jana@example.org'; await chvila(); await odosli(ui2);
  assert.deepEqual(udalosti, []);
});
test('Umami ešte nie je načítané: udalosť čaká v window.__strazFronta a odíde po načítaní; nikdy výnimka', async () => {
  nastav({ fetch: async () => odpoved(200, SPRAVNA), umami: false });
  S.track('ar_straz_offer_view', { lang: 'sk', place: 'result' });
  assert.equal(okno.__strazFronta.length, 1); assert.deepEqual(udalosti, []);
  vyprsi(); assert.equal(okno.__strazFronta.length, 1, 'stále čaká');
  okno.umami = { track: (n, d) => udalosti.push([n, d]) };
  vyprsi();
  assert.deepEqual(udalosti, [['ar_straz_offer_view', { lang: 'sk', place: 'result' }]]); assert.equal(okno.__strazFronta.length, 0);
  okno.umami = { track: () => { throw new Error('umami'); } };
  assert.doesNotThrow(() => S.track('x', {}));
});
test('odkaz Sledovať ďalej: kotva boxu v jazyku stránky; neznámy kód sa nezapamätá; box z adresy, ktorá nie je http(s), sa odmietne', async () => {
  nastav({ fetch: async () => odpoved(200, SPRAVNA) });
  globalThis.document = falosnyDoc('de');
  const a = strazLink('nieco<script>', 'de');
  assert.equal(a.textContent, 'Weiter beobachten'); assert.equal(a.href, '#ar-straz'); assert.equal(a.dataset.finding, undefined);
  assert.equal(strazLink('jsonld_returns', 'en').textContent, 'Keep watching');
  for (const zla of ['javascript:alert(1)', 'ftp://obchod.example.org', 'https://u:p@obchod.example.org', '', null]) assert.equal(box({ data: report(zla) }), null, String(zla));
  // adresa so znakmi HTML ide len ako text a len pôvod
  const ui = box({ data: report('https://obchod.example.org/<img src=x onerror=alert(1)>') });
  assert.equal(prve(ui.box, 'ar-straz-obchod').textContent, T.sk.store + ' https://obchod.example.org');
  // vymenený box zabudne nález z predchádzajúceho výsledku
  const poslane = []; nastav({ fetch: async (u, o) => { poslane.push(o); return odpoved(200, SPRAVNA); } });
  const stary = strazLink('feed_type', 'sk'); await stary.click();
  const ui2 = box(); ui2.email.value = 'jana@example.org'; await odosli(ui2);
  assert.deepEqual(udalosti.find(([n]) => n === 'ar_straz_subscribe_click'), ['ar_straz_subscribe_click', { lang: 'sk', place: 'result' }]);
});
test('texty SK, EN, DE: rovnaké kľúče, cena a názov zo zmluvy, bez pomlčiek em a en, bez strašenia pokutami', () => {
  const kluce = (o) => Object.keys(o).sort();
  for (const lang of ['sk', 'en', 'de']) {
    assert.deepEqual(kluce(T[lang]), kluce(T.sk), lang); assert.deepEqual(kluce(T[lang].errors), kluce(T.sk.errors), lang);
    assert.equal(T[lang].watch.length, 3);
    const vsetko = JSON.stringify(T[lang]);
    assert.ok(!/[–—]/.test(vsetko), lang + ': pomlčka'); assert.ok(!/pokut|fine[sd]?\b|Bußgeld|Strafe/i.test(vsetko), lang + ': pokuty');
  }
  assert.equal(T.sk.name, 'Stráž e-shopu'); assert.equal(T.en.name, 'Shop Guard'); assert.equal(T.de.name, 'Shop-Wächter');
  assert.equal(T.sk.price, '9 € mesačne vrátane DPH'); assert.equal(T.en.price, '9 EUR a month, VAT included'); assert.equal(T.de.price, '9 EUR im Monat inkl. MwSt.');
  for (const lang of ['sk', 'en', 'de']) assert.match(T[lang].pay, /Feed Doctor Monitor/);
});

// ---------- 4. kolo 1 (PRODUKT.md časť 6b, nálezy ops/druhy-ucet/209/overenie/nalezy-kolo1-*.md) ----------
// Špecificita jednoduchého selektora (id, triedy a atribúty a pseudotriedy, značky); stačí na pravidlá tohto CSS a paper.css.
const specificita = (sel) => {
  const s = sel.replace(/::?[a-z-]+(\([^)]*\))?/gi, (m) => (m.startsWith('::') ? ' ' : '.p'));
  return [(s.match(/#[\w-]+/g) || []).length, (s.match(/\.[\w-]+|\[[^\]]*\]/g) || []).length, (s.replace(/[#.][\w-]+|\[[^\]]*\]/g, ' ').match(/\b[a-z][\w-]*/gi) || []).length];
};
const vacsia = (a, b) => { for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i]; return false; };
// Posledná hodnota padding-top, ktorú pre prvok section.ar-straz vnútri .ar-page na body.noc určia pravidlá s daným filtrom media.
function paddingBoxu(css, media) {
  const pravidla = [];
  const bloky = (text, m, posun) => { for (const x of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) pravidla.push({ m, sel: x[1].trim(), telo: x[2], i: posun + x.index }); };
  const bez = css.replace(/\/\*[\s\S]*?\*\//g, (k) => ' '.repeat(k.length));
  let zvysok = bez;
  for (const x of bez.matchAll(/@media\s*([^{]+)\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g)) {
    zvysok = zvysok.slice(0, x.index) + ' '.repeat(x[0].length) + zvysok.slice(x.index + x[0].length);
    bloky(x[2], x[1].trim(), x.index);
  }
  bloky(zvysok, null, 0);
  pravidla.sort((a, b) => a.i - b.i);
  let vitaz = null;
  for (const p of pravidla) {
    if (p.m && !media) continue;
    const pad = p.telo.match(/padding(?:-top)?\s*:\s*([^;]+)/); if (!pad) continue;
    for (const sel of p.sel.split(',').map((x) => x.trim())) {
      if (!['body.noc section', '.ar-straz', '.ar-page section.ar-straz', '.ar-page .ar-straz'].includes(sel)) continue;
      const sp = specificita(sel);
      if (!vitaz || vacsia(sp, vitaz.sp) || (sp.join() === vitaz.sp.join())) vitaz = { sp, hodnota: pad[1].trim().split(/\s+/)[0], sel };
    }
  }
  return vitaz;
}
test('S straz-box.css:5: padding boxu prebije body.noc section z paper.css na desktope aj pri 390 px (28 a 20 px)', () => {
  const paper = readFileSync(new URL('../style/paper.css', import.meta.url), 'utf8');
  const noc = paper.match(/body\.noc section\{[^}]*\}/)[0];
  assert.match(noc, /padding-top:clamp\(56px/, 'globálne pravidlo, proti ktorému sa box bráni, stále existuje');
  const box = readFileSync(new URL('./straz-box.css', import.meta.url), 'utf8');
  const spolu = noc + '\n' + box; // paper.css sa načíta skôr, straz-box.css neskôr
  const desk = paddingBoxu(spolu, false), mobil = paddingBoxu(spolu, true);
  assert.equal(desk.hodnota, '28px', 'desktop: ' + desk.sel); assert.equal(mobil.hodnota, '20px', '390 px: ' + mobil.sel);
  assert.ok(vacsia(specificita(desk.sel), specificita('body.noc section')));
});
test('Z meranie: pred presmerovaním čaká na odoslanie ar_straz_subscribe_click najviac 400 ms; rýchle odoslanie presmeruje hneď, chyba Umami nevadí', async () => {
  // Umami odosiela pomaly: bez časovača 400 ms sa nepresmeruje, po ňom áno
  const pomale = odlozeny(); const casy = [];
  const { presmerovania } = nastav({ fetch: async () => odpoved(201, SPRAVNA) });
  okno.umami = { track: (n, d) => { udalosti.push([n, d]); return n === 'ar_straz_subscribe_click' ? pomale.p : undefined; } };
  deps.setTimeout = (f, ms) => { casy.push(ms); casovace.push(f); return casovace.length; };
  const ui = box(); ui.email.value = 'jana@example.org';
  const beh = odosli(ui); await chvila(); await chvila(); await chvila();
  assert.ok(udalosti.some(([n]) => n === 'ar_straz_subscribe_click'), 'klik je odoslaný');
  assert.deepEqual(presmerovania, [], 'čaká na Umami');
  assert.equal(ui.tlacidlo.disabled, true); assert.equal(ui.tlacidlo.textContent, T.sk.redirect);
  assert.ok(casy.includes(400), 'čaká najviac 400 ms: ' + casy.join());
  vyprsi(); await beh;
  assert.deepEqual(presmerovania, [SPRAVNA.checkout_url], 'po 400 ms presmeruje aj bez odpovede Umami');
  // Umami odošle hneď: presmeruje bez čakania na časovač
  const r2 = nastav({ fetch: async () => odpoved(201, SPRAVNA) });
  okno.umami = { track: async () => {} };
  const ui2 = box(); ui2.email.value = 'jana@example.org'; await odosli(ui2);
  assert.deepEqual(r2.presmerovania, [SPRAVNA.checkout_url]);
  // Umami zlyhá: žiadna chyba vo formulári, presmeruje
  const r3 = nastav({ fetch: async () => odpoved(201, SPRAVNA) });
  okno.umami = { track: () => Promise.reject(new Error('umami')) };
  const ui3 = box(); ui3.email.value = 'jana@example.org'; await odosli(ui3);
  assert.deepEqual(r3.presmerovania, [SPRAVNA.checkout_url]); assert.equal(ui3.chyba.hidden, true);
  // box nahradený novou kontrolou počas čakania: nepresmeruje
  const pomale4 = odlozeny();
  const r4 = nastav({ fetch: async () => odpoved(201, SPRAVNA) });
  okno.umami = { track: () => pomale4.p };
  const ui4 = box(); ui4.email.value = 'jana@example.org';
  const beh4 = odosli(ui4); await chvila(); await chvila(); await chvila();
  ui4.box.remove(); pomale4.ok(); await beh4;
  assert.deepEqual(r4.presmerovania, []);
});
test('Z5 kontakt podľa jazyka: SK podpora@arling.sk, EN a DE support@arling.sk', () => {
  const adresy = (o) => [...JSON.stringify(o).matchAll(/[a-z]+@arling\.sk/g)].map((m) => m[0]);
  assert.ok(adresy(T.sk).length >= 2); assert.ok(adresy(T.sk).every((a) => a === 'podpora@arling.sk'), adresy(T.sk).join());
  for (const lang of ['en', 'de']) { const a = adresy(T[lang]); assert.ok(a.length >= 2, lang); assert.ok(a.every((x) => x === 'support@arling.sk'), lang + ': ' + a.join()); }
});
test('Z1: 403 test_not_allowed povie, že testovací režim je len pre ARLing; údaje ostanú, nič neodíde na platbu; iná 403 je chyba servera', async () => {
  for (const lang of ['sk', 'en', 'de']) assert.match(T[lang].errors.testOnly, /ARLing/);
  for (const [data, veta] of [[{ error: 'test_not_allowed' }, T.sk.errors.testOnly], [{ error: 'forbidden' }, T.sk.errors.server]]) {
    const s = uloziste(); s.setItem('straz:test', '1');
    const { presmerovania, local } = nastav({ fetch: async () => odpoved(403, data), session: s });
    const ui = box(); ui.email.value = 'jana@example.org';
    await odosli(ui);
    assert.equal(ui.chyba.textContent, veta); nehotove(ui); assert.deepEqual(presmerovania, []); assert.equal(local.getItem(NAVRAT), null);
  }
});
test('Z2: dopyt pošle prev_id a prev_key zo straz:navrat len keď je mladší ako 24 h a má platný tvar', async () => {
  const teraz = Date.parse('2026-10-22T10:00:00.000Z');
  const zaznam = (at, id = 'mon_old1', key = 'k_oldkey12345') => JSON.stringify({ id, key, lang: 'sk', at: new Date(at).toISOString() });
  for (const [popis, raw, cakane] of [
    ['pred hodinou', zaznam(teraz - 3600e3), { prev_id: 'mon_old1', prev_key: 'k_oldkey12345' }],
    ['pred 23 h 59 min', zaznam(teraz - 24 * 3600e3 + 60e3), { prev_id: 'mon_old1', prev_key: 'k_oldkey12345' }],
    ['pred 25 h', zaznam(teraz - 25 * 3600e3), null],
    ['presne 24 h', zaznam(teraz - 24 * 3600e3), null],
    ['z budúcnosti', zaznam(teraz + 3600e3), null],
    ['zlé id', zaznam(teraz - 60e3, '<img>'), null],
    ['krátky kľúč', zaznam(teraz - 60e3, 'mon_old1', 'k'), null],
    ['zlý JSON', '{', null],
    ['nič', null, null],
  ]) {
    const local = uloziste(); if (raw !== null) local.setItem(NAVRAT, raw);
    const poslane = [];
    nastav({ fetch: async (u, o) => { poslane.push(JSON.parse(o.body)); return odpoved(200, SPRAVNA); }, local });
    const ui = box(); ui.email.value = 'jana@example.org'; await odosli(ui);
    const b = poslane[0];
    if (cakane) { assert.equal(b.prev_id, cakane.prev_id, popis); assert.equal(b.prev_key, cakane.prev_key, popis); }
    else { assert.ok(!('prev_id' in b) && !('prev_key' in b), popis + ': ' + JSON.stringify(b)); }
    assert.equal(b.email, 'jana@example.org'); assert.equal(b.store_url, 'https://obchod.example.org');
  }
  assert.deepEqual(S.predosly(zaznam(teraz - 60e3), new Date(teraz)), { prev_id: 'mon_old1', prev_key: 'k_oldkey12345' });
});
test('Z3: pri skóre null alebo 0 produktových stránkach box povie, že údaje pre AI sa nedali vyhodnotiť, a nesľubuje ich sledovanie teraz', () => {
  for (const lang of ['sk', 'en', 'de']) {
    for (const data of [{ ...report(), score: null, sample: { ...VZORKA.sample, pages: 0 } }, { ...report(), score: null }, { ...report(), sample: { ...VZORKA.sample, pages: 0 } }]) {
      nastav({ fetch: async () => odpoved(200, SPRAVNA) });
      const ui = box({ lang, data });
      const pozn = triedy(ui.box, 'ar-straz-bez-ai');
      assert.equal(pozn.length, 1, lang); assert.equal(pozn[0].tagName, 'LI'); assert.equal(pozn[0].textContent, T[lang].watchNoAi);
      const body = prve(ui.box, 'ar-straz-co').children.map((li) => li.textContent);
      assert.deepEqual(body, [T[lang].watch[0], T[lang].watchNoAi, T[lang].watch[2]], lang);
      assert.ok(!body.includes(T[lang].watch[1]), lang + ': bez sľubu, že údaje pre AI sleduje už teraz');
    }
  }
  assert.match(T.sk.watchNoAi, /sme nenašli čitateľné produktové stránky/);
  // bežný výsledok so skóre a stránkami: pôvodný zoznam, bez poznámky
  nastav({ fetch: async () => odpoved(200, SPRAVNA) });
  const ui = box();
  assert.equal(triedy(ui.box, 'ar-straz-bez-ai').length, 0);
  assert.deepEqual(prve(ui.box, 'ar-straz-co').children.map((li) => li.textContent), T.sk.watch);
  assert.equal(S.bezUdajovAi(VZORKA), false); assert.equal(S.bezUdajovAi(null), false);
});

// ---------- 5. kolo 2 (brána pokus 1, ops/druhy-ucet/209/overenie/brana-1-nalezy.md; snímky-2/zoznam.md) ----------
const { UI } = await import('./i18n.mjs?v=2');
const NEVYHODNOTENE = /\b(AI|KI)\b[\s\S]*(nedali vyhodnotiť|nehodnotíme|could not be evaluated|do not evaluate|nicht auswerten|nicht bewerten)/;
test('nález 9: veta o platforme nesľubuje každú platformu, hovorí, že Stráž číta len verejné stránky (SK, EN, DE)', () => {
  assert.equal(T.sk.shopify, 'Stráž číta len verejné stránky, preto funguje aj pri Shopify a do obchodu sa nič neinštaluje. Je to samostatná služba, nie Pro v našej appke pre Shopify.');
  for (const [lang, verejne] of [['sk', /číta len verejné stránky/], ['en', /reads public pages only/], ['de', /liest nur öffentliche Seiten/]]) {
    assert.ok(!/každej platforme|every platform|jeder Plattform/i.test(T[lang].shopify), lang + ': ' + T[lang].shopify);
    assert.match(T[lang].shopify, verejne, lang); assert.match(T[lang].shopify, /Shopify/, lang); assert.match(T[lang].shopify, /Pro/, lang);
  }
});
test('postreh snímok 5: box bez skóre hovorí o nevyhodnotených údajoch pre AI len na jednom mieste', () => {
  for (const lang of ['sk', 'en', 'de']) {
    nastav({ fetch: async () => odpoved(200, SPRAVNA) });
    const ui = box({ lang, data: { ...report(), score: null, sample: { ...VZORKA.sample, pages: 0, attemptedPages: 0 } } });
    const miesta = ui.box.all((e) => e.childNodes.some((c) => !(c instanceof El) && NEVYHODNOTENE.test(c.textContent)));
    assert.equal(miesta.length, 1, lang + ': ' + miesta.map((e) => e.textContent).join(' | '));
    assert.ok(!('noAi' in T[lang]), lang + ': samostatný odsek noAi už nie je');
  }
});
// Shoptet bez rozpoznaných produktových stránok: skóre null, 0 produktov, 0/0 stránok, pravidlá neoverené, EÚ platné.
const shoptet = (eu = VZORKA.eu) => {
  const v = { ...VZORKA, storeUrl: 'https://obchod.example.org', platform: 'html', shopify: { detected: false, signals: [] }, score: null, coverage: 0,
    sample: { ...VZORKA.sample, products: 0, pages: 0, attemptedPages: 0 }, rules: VZORKA.rules.map((r) => ({ ...r, status: 'unknown', affected: 0, checked: 0, affectedIds: [] })) };
  if (eu === 'bez') delete v.eu; else v.eu = eu;
  return v;
};
const NEUTRALNA = {
  sk: 'Neprečítali sme žiadnu produktovú stránku, preto údaje pre AI asistentov nehodnotíme. Povinnosti EÚ nižšie sme skontrolovali.',
  en: 'We could not read any product page, so we do not evaluate the data for AI assistants. We did check the EU duties below.',
  de: 'Wir konnten keine Produktseite lesen, daher bewerten wir die Daten für KI-Assistenten nicht. Die EU-Pflichten unten haben wir geprüft.',
};
test('nález 6: výsledok bez prečítanej produktovej stránky nemá vetu o nevyšlej chybnej kontrole ani o vysokom skóre, len jednu neutrálnu vetu (SK, EN, DE)', async () => {
  for (const live of [false, true]) for (const lang of ['sk', 'en', 'de']) {
    const { rep } = await spustiApp({ live, lang, vysledok: shoptet(), sample: false });
    assert.equal(rep.hidden, false, lang);
    const texty = rep.all((e) => e.tagName === 'P').map((p) => p.textContent);
    assert.ok(!texty.includes(UI[lang].empty), lang + ': veta „nevyšla chybná kontrola“');
    assert.ok(!texty.includes(UI[lang].unknown), lang + ': veta o vysokom skóre');
    assert.ok(!rep.all((e) => e.tagName === 'H3').some((h) => h.textContent === UI[lang].fixes), lang + ': nadpis Čo opraviť najskôr bez obsahu');
    const vety = triedy(rep, 'ar-no-pages');
    assert.equal(vety.length, 1, lang); assert.equal(vety[0].textContent, NEUTRALNA[lang], lang);
    assert.ok(!/[–—]/.test(vety[0].textContent));
    assert.equal(triedy(rep, 'ar-eu').length, 1, lang + ': EÚ ostáva');
    // poradie: neutrálna veta je pred blokom EÚ, ku ktorému odkazuje slovom nižšie
    assert.ok(rep.children.indexOf(vety[0]) < rep.children.findIndex((e) => ma(e, 'ar-eu')), lang);
  }
});
test('nález 6: bez platného bloku EÚ neutrálna veta netvrdí, že sme EÚ skontrolovali; so skóre a 0 stránkami a s chybami ostane zoznam na opravu', async () => {
  for (const eu of ['bez', { version: 'x' }]) {
    const { rep } = await spustiApp({ live: false, lang: 'sk', vysledok: shoptet(eu), sample: false });
    const vety = triedy(rep, 'ar-no-pages');
    assert.equal(vety.length, 1); assert.equal(vety[0].textContent, 'Neprečítali sme žiadnu produktovú stránku, preto údaje pre AI asistentov nehodnotíme.');
  }
  // 0 prečítaných stránok, ale pravidlá z feedu zlyhali: zoznam ostane, veta o vysokom skóre nie, neutrálna veta nie (nebola by pravdivá)
  const s = { ...VZORKA, storeUrl: 'https://obchod.example.org', platform: 'html', shopify: { detected: false, signals: [] }, coverage: 60, sample: { ...VZORKA.sample, pages: 0, attemptedPages: 3 } };
  const { rep } = await spustiApp({ live: false, lang: 'sk', vysledok: s, sample: false });
  const texty = rep.all((e) => e.tagName === 'P').map((p) => p.textContent);
  assert.ok(!texty.includes(UI.sk.unknown)); assert.equal(triedy(rep, 'ar-no-pages').length, 0);
  assert.ok(rep.children.some((e) => e.tagName === 'H3' && e.textContent === UI.sk.fixes));
  assert.ok(rep.children.find((e) => e.tagName === 'UL' && ma(e, 'ar-list')).children.length > 0);
  // bežný výsledok s prečítanou stránkou a pokrytím pod 100: veta o pokrytí ostáva ako predtým
  const b = { ...VZORKA, storeUrl: 'https://obchod.example.org', platform: 'html', shopify: { detected: false, signals: [] }, coverage: 80 };
  const r2 = (await spustiApp({ live: false, lang: 'sk', vysledok: b, sample: false })).rep;
  assert.ok(r2.all((e) => e.tagName === 'P').some((p) => p.textContent === UI.sk.unknown)); assert.equal(triedy(r2, 'ar-no-pages').length, 0);
});
test('medzera pred čiarkou v riadku vzorky nevzniká v texte (app.mjs ani i18n.mjs): „0 produktov vo feede, 0/0“', async () => {
  for (const lang of ['sk', 'en', 'de']) {
    const { rep } = await spustiApp({ live: false, lang, vysledok: shoptet(), sample: false });
    const dd = prve(rep, 'ar-scope').all((e) => e.tagName === 'DD')[0].textContent;
    assert.ok(!dd.includes(' ,'), lang + ': ' + dd);
    assert.equal(dd, `0 ${UI[lang].products}, 0/0 ${UI[lang].pages}`);
  }
});
