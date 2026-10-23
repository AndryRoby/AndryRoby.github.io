// Testy relácie 218 pre kontrolu e-shopu (AGENTS.md bod 12) s malým falošným DOM (vzor vysledok-blok.test.mjs):
// S1 (relácia 208, ops/druhy-ucet/218/zber/Z1-208.md časť a): výsledok obchodu bez znakov Shopify čakaciu listinu Pro neponúka
// (od brány 218 D2 ani vetou o appke), preto sa statická sekcia #pro skryje; zrušenie, chyba, nová kontrola, vzorka a úprava vstupu
// ju vrátia do stavu z HTML; pri Shopify a neznámej platforme ostáva. Z-392 (brána 205 O1): miesto bloku „Poslať si výsledok
// e-mailom“ stojí za boxom Stráže, čakacou listinou (len Shopify a neznáma platforma) a appkou, tesne pred zoznamom všetkých kontrol;
// bez Shopify hneď za boxom Stráže (brána 218 D2).
// cd products/arling-sk/feed-doctor/agent-ready && node --test kontrola-218.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';

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
// pro: 'viditelna' (ako v HTML), 'skryta' (sekcia s atribútom hidden) alebo null (stránka bez sekcie)
function stranka(lang, pro) {
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
  // Statická sekcia stojí v HTML mimo #report (za metodikou a #odber, pred #monitor-pro).
  if (pro) { const s = prvok('section', 'pro'); s.className = 'ar-pro-cakacia'; s.dataset.proSekcia = ''; s.hidden = pro === 'skryta'; }
  return doc;
}

// ---------- globály ----------
globalThis.window = { umami: { track() {} }, addEventListener() {} };
globalThis.location = { search: '', hash: '', pathname: '/feed-doctor/agent-ready/sk/', hostname: 'arling.sk', origin: 'https://arling.sk', assign() {} };
globalThis.history = { state: null, replaceState() {} };
globalThis.matchMedia = () => ({ matches: true });

// app.mjs importovaný z adresy s „bez-prechodu“ dostane prechod.mjs, ktorý zlyhá (platforma unknown, ako pri chybe siete).
register('data:text/javascript,' + encodeURIComponent("export async function resolve(s,c,dalej){if(s==='./prechod.mjs'&&String(c.parentURL||'').includes('bez-prechodu'))return {url:'data:text/javascript,throw new Error(%22prechod%22)',shortCircuit:true};return dalej(s,c);}"));

const VZORKA = JSON.parse(readFileSync(new URL('./sample-report.json', import.meta.url), 'utf8'));
const { UI } = await import('./i18n.mjs?v=5'); // tá istá inštancia, ktorú načíta app.mjs
const S = await import('./straz.mjs?v=2'); // tá istá inštancia, ktorú načíta app.mjs (deps.stav sa pred každou stránkou vynuluje)
const odpoved = (status, data) => ({ ok: status >= 200 && status < 300, status, json: async () => data });
const pockaj = (ms) => new Promise((r) => setTimeout(r, ms));
async function cakajNa(pred, popis = 'podmienka') { for (let i = 0; i < 400; i++) { if (pred()) return; await pockaj(5); } assert.fail('nesplnené: ' + popis); }
const OBCHOD = 'https://obchod.example.org/products/linen-shirt';
const sShopify = (zmena = {}) => ({ ...VZORKA, storeUrl: OBCHOD, ...zmena });
const bezShopify = (zmena = {}) => sShopify({ platform: 'html-only', shopify: { detected: false, signals: [] }, ...zmena });

let strazLive = false, appka = null, odpovedKontroly = () => odpoved(200, sShopify());
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.startsWith('file:')) return odpoved(200, JSON.parse(readFileSync(new URL(u), 'utf8')));
  if (u === '/straz-eshopu/stav.json') return odpoved(200, { live: strazLive });
  if (u === '/agent-ready/stranka.json') return appka ? odpoved(200, appka) : odpoved(404, null);
  if (u.startsWith('https://feed-monitor.arling.workers.dev/v1/agent-ready/check')) return odpovedKontroly(u);
  return odpoved(404, null);
};
let poradie = 0;
async function app({ lang = 'sk', pro = 'viditelna', live = false, stavAppky = null, bezPrechodu = false } = {}) {
  strazLive = live; appka = stavAppky; S.deps.stav = null; odpovedKontroly = () => odpoved(200, sShopify());
  const doc = stranka(lang, pro);
  await import('./app.mjs?' + (bezPrechodu ? 'bez-prechodu=' : 'beh=') + (++poradie));
  const $ = (id) => doc.getElementById(id), rep = $('report');
  // Kontrola s danou odpoveďou workera; čaká na vykreslenie výsledku alebo na vetu chyby.
  const posli = async (data, { status = 200 } = {}) => {
    odpovedKontroly = () => odpoved(status, data);
    $('store-url').value = 'obchod.example.org'; $('product-url').value = '';
    rep.hidden = true; // nový beh výsledok aj tak skryje; tu len aby sa dalo čakať na nové vykreslenie
    await $('check-form').fire('submit', { preventDefault() {} });
    if (status === 200) await cakajNa(() => !rep.hidden, 'výsledok ' + lang);
    else await cakajNa(() => $('status').textContent === UI[lang].error, 'chyba ' + lang);
  };
  const vzorka = async () => { rep.hidden = true; await $('sample').click(); await cakajNa(() => !rep.hidden, 'vzorka ' + lang); };
  return { doc, $, rep, posli, vzorka };
}

// ---------- S1: statická čakacia listina pri obchode bez Shopify ----------
test('S1 a D2: obchod bez znakov Shopify skryje statickú sekciu #pro a výsledok nemá nič o appke (ani vetu, ani formulár); úprava vstupu, zrušenie, chyba, Shopify a vzorka ju vrátia (SK, EN, DE)', async () => {
  for (const lang of ['sk', 'en', 'de']) {
    const { $, rep, posli, vzorka } = await app({ lang });
    const pro = $('pro');
    assert.equal(pro.hidden, false, lang + ': pred kontrolou ako v HTML');
    await posli(bezShopify());
    assert.equal(pro.hidden, true, lang + ': bez Shopify skrytá');
    // Brána 218 D2: veta „Agentic Product Check Pro … (9,99 USD mesačne) … neponúkame“ pod boxom Stráže už nie je.
    assert.equal(triedy(rep, 'ar-pro-poznamka').length, 0, lang + ': bez vety o appke');
    assert.equal(triedy(rep, 'ar-pro-cakacia').length, 0, lang + ': bez bloku čakacej listiny appky');
    assert.ok(!rep.textContent.includes('9,99') && !rep.textContent.includes('9.99'), lang + ': vo výsledku žiadna cena appky');
    assert.equal(rep.all((e) => e.tagName === 'FORM' && ma(e, 'ar-pro-form')).length, 0, lang + ': vo výsledku žiadny formulár čakacej listiny');
    await $('store-url').fire('input');
    assert.equal(pro.hidden, false, lang + ': úprava vstupu');
    await posli(bezShopify()); assert.equal(pro.hidden, true, lang);
    await $('cancel').click();
    assert.equal(pro.hidden, false, lang + ': zrušenie');
    await posli(bezShopify()); assert.equal(pro.hidden, true, lang);
    await posli(null, { status: 502 });
    assert.equal(pro.hidden, false, lang + ': chyba kontroly');
    await posli(bezShopify()); assert.equal(pro.hidden, true, lang);
    await posli(sShopify());
    assert.equal(pro.hidden, false, lang + ': nová kontrola obchodu so Shopify');
    assert.equal(triedy(rep, 'ar-pro-poznamka').length, 0, lang);
    assert.equal(triedy(rep, 'ar-pro-cakacia').length, 1, lang + ': pri Shopify čakacia listina vo výsledku ostáva');
    await posli(bezShopify()); assert.equal(pro.hidden, true, lang);
    await vzorka();
    assert.equal(pro.hidden, false, lang + ': vzorka (fiktívny obchod Shopify)');
  }
});
test('S1: sekcia skrytá už v HTML ostane skrytá pri Shopify, bez Shopify aj po úprave vstupu; stránka bez sekcie nezlyhá', async () => {
  const { $, posli } = await app({ pro: 'skryta' });
  await posli(sShopify()); assert.equal($('pro').hidden, true, 'Shopify ju neodkryje');
  await posli(bezShopify()); assert.equal($('pro').hidden, true);
  await $('store-url').fire('input'); assert.equal($('pro').hidden, true, 'späť na stav z HTML');
  const bez = await app({ pro: null });
  await bez.posli(bezShopify());
  assert.equal(bez.$('status').textContent, '', 'bez chyby');
  assert.equal(triedy(bez.rep, 'ar-pro-cakacia').length, 0, 'brána 218 D2: bez bloku appky');
  assert.equal(triedy(bez.rep, 'ar-vysledok-miesto').length, 1, 'výsledok je celý');
});
test('S1: keď prechod.mjs zlyhá (platforma unknown), sekcia ostane a výsledok má formulár čakacej listiny ako predtým', async () => {
  const { $, rep, posli } = await app({ bezPrechodu: true });
  await posli(bezShopify());
  assert.equal($('pro').hidden, false);
  assert.equal(triedy(rep, 'ar-pro-poznamka').length, 0);
  assert.equal(triedy(rep, 'ar-pro-cakacia').length, 1);
});

// ---------- Z-385 (a): odkazy na kontrolu jedného pravidla v troch HTML (ops/seo/povinnosti-eu/agent-ready-odkazy.mjs) ----------
test('Z-385 a: za metodikou EÚ jeden odsek data-eu-stranky s odkazom na odstúpenie aj záruku v jazyku stránky, s udalosťou ar_check_to_rule', () => {
  for (const [subor, lang, odstupenie, zaruka, texty] of [
    ['./sk/index.html', 'sk', '/kontrola-tlacidla-na-odstupenie-od-zmluvy/', '/kontrola-oznamenia-o-zakonnej-zaruke/', ['funkcia na odstúpenie od zmluvy', 'oznámenie o zákonnej záruke']],
    ['./index.html', 'en', '/kontrola-tlacidla-na-odstupenie-od-zmluvy/en/', '/kontrola-oznamenia-o-zakonnej-zaruke/en/', ['the online withdrawal function', 'the notice on the legal guarantee']],
    ['./de/index.html', 'de', '/kontrola-tlacidla-na-odstupenie-od-zmluvy/de/', '/kontrola-oznamenia-o-zakonnej-zaruke/de/', ['die Widerrufsfunktion', 'der Hinweis zur gesetzlichen Gewährleistung']],
  ]) {
    const html = readFileSync(new URL(subor, import.meta.url), 'utf8');
    const odseky = html.match(/<p data-eu-stranky>[\s\S]*?<\/p>/g) || [];
    assert.equal(odseky.length, 1, subor);
    assert.ok(/<h3 id="eu-pravidla">[^<]*<\/h3><p>[^<]*<\/p><p data-eu-stranky>/.test(html), subor + ': hneď za odsekom metodiky (bez značiek)');
    const odkazy = [...odseky[0].matchAll(/<a href="([^"]+)" data-umami-event="ar_check_to_rule" data-umami-event-lang="([a-z]+)" data-umami-event-rule="([a-z_]+)">([^<]+)<\/a>/g)].map((m) => m.slice(1));
    assert.deepEqual(odkazy, [[odstupenie, lang, 'eu_withdrawal', texty[0]], [zaruka, lang, 'eu_guarantee_notice', texty[1]]], subor);
    assert.ok(!/[–—]/.test(odseky[0]), subor + ': pomlčka');
  }
});

// ---------- Z-385 (c): článok o zákonnej záruke (products/arling-sk/oznamenie-o-zakonnej-zaruke-eshop/, zber Z2 časť c) ----------
const CLANOK = readFileSync(new URL('../../oznamenie-o-zakonnej-zaruke-eshop/index.html', import.meta.url), 'utf8');
const sekcia = (id) => (new RegExp(`<section id="${id}"[\\s\\S]*?</section>`).exec(CLANOK) || [''])[0];
test('Z-385 c: článok odkazuje na obe kontroly jedného pravidla s udalosťou ar_article_to_check a vlastným miestom; hlavná výzva a blok Stráže ostávajú', () => {
  const odkazy = [...CLANOK.matchAll(/<a (?:class="ar-next-link" )?href="([^"]+)" data-umami-event="ar_article_to_check" data-umami-event-lang="sk" data-umami-event-miesto="([a-z-]+)">([^<]+)<\/a>/g)].map((m) => m.slice(1));
  assert.deepEqual(odkazy, [
    ['/feed-doctor/agent-ready/sk/', 'hore', 'Skontrolujte svoj e-shop zadarmo'],
    ['/kontrola-oznamenia-o-zakonnej-zaruke/', 'pravidlo-zaruka', 'kontrola oznámenia o zákonnej záruke'],
    ['/kontrola-tlacidla-na-odstupenie-od-zmluvy/', 'pravidlo-odstupenie', 'kontrola tlačidla na odstúpenie od zmluvy'],
    ['/feed-doctor/agent-ready/sk/', 'dole', 'Skontrolujte svoj e-shop zadarmo'],
  ]);
  assert.ok(sekcia('oznamenie').includes('/kontrola-oznamenia-o-zakonnej-zaruke/'), 'odkaz na záruku v časti o oznámení');
  assert.ok(sekcia('odstupenie').includes('/kontrola-tlacidla-na-odstupenie-od-zmluvy/'), 'odkaz na odstúpenie v časti o funkcii');
  assert.equal((CLANOK.match(/id="straz-eshopu"/g) || []).length, 1);
  assert.ok(CLANOK.includes('<a href="/straz-eshopu/" data-umami-event="ar_straz_link" data-umami-event-place="article" data-umami-event-lang="sk">Pozrieť Stráž e-shopu</a>'));
});
test('Z-385 c: opravy O1 až O4 v časti o funkcii na odstúpenie (trvalý nosič a trvanlivé médium, päť odsekov, „len“, čl. 6 ods. 1 písm. h)', () => {
  const s = sekcia('odstupenie'), text = s.replace(/<[^>]+>/g, '');
  // O1: smernica „trvalý nosič“, slovenský zákon „trvanlivé médium“; „trvanlivý nosič“ nie je v žiadnom z nich
  assert.ok(!/trvanliv\S* nosi/.test(CLANOK), 'trvanlivý nosič');
  assert.match(text, /na trvalom nosiči[^.]*\(čl\. 11a ods\. 4 smernice\)/);
  assert.match(text, /„na trvanlivom médiu“[^.]*\(§ 20a ods\. 5\)/);
  // O2: päť odsekov čl. 11a (šesť v § 20a), päť bodov zoznamu s odkazmi na ods. 1 až 5
  assert.match(text, /Čl\. 11a smernice má päť odsekov, slovenský § 20a šesť\./);
  const body = (/<ol>([\s\S]*?)<\/ol>/.exec(s) || ['', ''])[1].match(/<li>[\s\S]*?<\/li>/g) || [];
  assert.equal(body.length, 5);
  body.forEach((li, i) => assert.ok(li.includes(`čl. 11a ods. ${i + 1}`), 'bod ' + (i + 1) + ' cituje čl. 11a ods. ' + (i + 1)));
  assert.ok(body[1].includes('§ 20a ods. 3') && body[4].includes('§ 20a ods. 6'), 'online vyhlásenie a včasnosť aj podľa slovenského zákona');
  // O3: „len“ a alternatívna formulácia v smernici; slovenský zákon „obdobná formulácia“ bez „len“
  assert.ok(text.includes('len slovami „potvrdiť odstúpenie od zmluvy“ alebo rovnako jednoznačnou zodpovedajúcou formuláciou (čl. 11a ods. 3)'));
  assert.match(text, /obdobnej formulácii[^.]*\(§ 20a ods\. 4\)/);
  assert.ok(!CLANOK.includes('Predpis opisuje funkciu s tým označením,'), 'veta v časti Častá chyba spomína aj zodpovedajúcu formuláciu');
  // O4: informácia o existencii a umiestnení funkcie pred uzavretím zmluvy
  assert.match(text, /čl\. 6 ods\. 1 písm\. h\) smernice 2011\/83\/EÚ/);
  assert.match(text, /§ 15 ods\. 1 písm\. f\) zákona č\. 108\/2024 Z\. z\./);
  assert.ok(s.includes('čl. 1 body 2 a 3 (čl. 6 ods. 1 písm. h) a čl. 11a smernice 2011/83/EÚ)'), 'zdroj');
  assert.ok(!/[–—]/.test(text), 'pomlčka');
  // JSON-LD Article je platný a nesie dátum úpravy
  const ld = JSON.parse(/<script type="application\/ld\+json">(\{"@context":"https:\/\/schema\.org","@type":"Article"[\s\S]*?)<\/script>/.exec(CLANOK)[1]);
  assert.equal(ld.dateModified, '2026-10-23'); assert.equal(ld.datePublished, '2026-10-22');
});

// Brána 218 D10: „Pri online predaji ho má umiestniť ako všeobecné pripomenutie…“ podávalo odôvodnenie 28 smernice (EÚ) 2024/825 ako
// povinnosť (text článku, nie predpis); veta teraz hovorí, odkiaľ je, a podmieňovacím spôsobom ako odôvodnenie („should be placed“).
test('D10: veta o umiestnení oznámenia pri online predaji cituje odôvodnenie 28 smernice (EÚ) 2024/825, nie ako povinnosť článku', () => {
  const s = sekcia('oznamenie'), text = s.replace(/<[^>]+>/g, '');
  assert.ok(text.includes('Podľa odôvodnenia 28 smernice (EÚ) 2024/825 by sa pri online predaji malo umiestniť ako všeobecné pripomenutie na webovom sídle obchodníka, ktorý tovar predáva.'));
  assert.ok(!CLANOK.includes('Pri online predaji ho má umiestniť'), 'stará veta');
  assert.ok(s.includes('smernica (EÚ) 2024/825, čl. 2 body 3 a 5 a odôvodnenie 28'), 'zdroj časti menuje odôvodnenie 28');
  assert.ok(!/[–—]/.test(text));
});

// ---------- Z-392: blok e-mailu za platenou ponukou ----------
const poradieBlokov = (rep) => {
  const deti = rep.children, i = (pred) => deti.findIndex(pred);
  return {
    deti, opravy: i((e) => e.tagName === 'UL' && ma(e, 'ar-list')), limity: i((e) => ma(e, 'ar-limits')), eu: i((e) => ma(e, 'ar-eu')),
    straz: i((e) => ma(e, 'ar-straz')), listina: i((e) => ma(e, 'ar-pro-cakacia')), appka: i((e) => ma(e, 'ar-next')),
    miesto: i((e) => ma(e, 'ar-vysledok-miesto')), vsetky: i((e) => e.tagName === 'DETAILS'),
  };
};
test('Z-392 a D2: pri živej Stráži stojí miesto bloku e-mailu za EÚ a boxom Stráže, pri Shopify aj za čakacou listinou, bez Shopify hneď za boxom Stráže; tesne pred všetkými kontrolami (SK, EN, DE)', async () => {
  for (const lang of ['sk', 'en', 'de']) for (const [popis, data] of [['Shopify', sShopify()], ['bez Shopify', bezShopify()]]) {
    const { rep, posli } = await app({ lang, live: true });
    await posli(data);
    const p = poradieBlokov(rep), msg = `${lang} ${popis}: ${JSON.stringify(p, (k, v) => (k === 'deti' ? undefined : v))}`;
    assert.equal(triedy(rep, 'ar-vysledok-miesto').length, 1, msg);
    assert.ok(p.opravy >= 0 && p.limity > p.opravy && p.eu > p.limity, msg);
    assert.ok(p.straz > p.eu, msg + ': Stráž za EÚ');
    if (popis === 'Shopify') {
      assert.ok(p.listina > p.straz && p.miesto > p.listina, msg + ': Stráž a listina pred blokom e-mailu');
    } else {
      // Brána 218 D2: obchod bez Shopify nemá blok čakacej listiny appky ani vetu o nej; blok e-mailu hneď za boxom Stráže.
      assert.equal(p.listina, -1, msg + ': bez bloku appky');
      assert.equal(triedy(rep, 'ar-pro-poznamka').length, 0, msg);
      assert.equal(p.miesto, p.straz + 1, msg + ': blok e-mailu hneď za boxom Stráže');
    }
    assert.equal(p.vsetky, p.miesto + 1, msg + ': hneď pred zoznamom všetkých kontrol');
  }
});
test('Z-392: so schválenou appkou stojí miesto aj za blokom appky; bez živej Stráže za čakacou listinou; vzorka miesto nemá', async () => {
  const { rep, posli } = await app({ lang: 'en', stavAppky: { stav: 'live', appStoreUrl: 'https://apps.shopify.com/agentic-product-check' } });
  await posli(sShopify());
  let p = poradieBlokov(rep);
  assert.ok(p.appka > p.listina, 'blok appky sa vykreslil za listinou');
  assert.equal(p.miesto, p.appka + 1, 'miesto hneď za appkou'); assert.equal(p.vsetky, p.miesto + 1);
  const x = await app({ lang: 'sk', live: false });
  await x.posli(sShopify());
  p = poradieBlokov(x.rep);
  assert.equal(p.straz, -1, 'bez živej Stráže box nie je'); assert.equal(p.miesto, p.listina + 1); assert.equal(p.vsetky, p.miesto + 1);
  await x.vzorka();
  assert.equal(triedy(x.rep, 'ar-vysledok-miesto').length, 0);
});
