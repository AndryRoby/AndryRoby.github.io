/* Povod kupy knih hlavolamov: UTM z prichodu (video, pin) idu do Stripe ako client_reference_id.
 *
 * Preco (1. 10. 2026, PLAN ops/strategia/organicky-rast-2026-10/PLAN.md, 2.5 a riadok 4b): video vedie na
 * /v/<kod>/, ta na stranku knihy s UTM, jej tlacidlo kupy na policu /puzzle-books/ (bez UTM) a platbu robi
 * app.js. UTM sa po ceste stracali, Stripe nevedel, odkial kupujuci prisiel. Test strazi:
 *   - referencia vznikne len z UTM, v tvare <zdroj>_<kampan>_<obsah> (youtube_f3_stars),
 *     len znaky A-Za-z0-9_-, najviac 200 znakov, zakazane znaky prec, bez UTM ziadny parameter,
 *   - to iste pre testovaci rezim (?test=1, data-link-test) a pre zivy odkaz,
 *   - udalost books_kupa_click nesie utm_campaign a utm_content,
 *   - zachyt UTM nikdy nevyhodi vynimku (ulozisko nejde, zapis zlyha) a nepouziva nic ine nez sessionStorage,
 *   - polica funguje a kupa ide aj ked sa utm.js nenacita (dynamicky import s chybou zahodenou do prazdna),
 *   - kazda stranka pod /puzzle-books/ nacita /puzzle-books/utm.js s aktualnym ?v= (a polica ho ma cez app.js),
 *   - generator ops/seo/landingy.mjs ten tag vklada, takze ho dalsi beh nezmaze,
 *   - kratke adresy /v/<kod>/ do knih nesu UTM, z ktorych referencia vznikne.
 * usage: node --test products/arling-sk/puzzle-books/utm.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, relative } from 'node:path';
import {
  UTM_POLIA, UTM_KLUC, NAJVIAC_HODNOTA, NAJVIAC_REFERENCIA, cistaHodnota, utmZAdresy, utmZUlozenia, prichod,
  referencia, odkazSReferenciou, zapamatajPrichod, utmNavstevy,
} from './utm.js';

const TU = dirname(fileURLToPath(import.meta.url));
const KOREN = resolve(TU, '../../..');
const app = readFileSync(join(TU, 'app.js'), 'utf8');
const utmZdroj = readFileSync(join(TU, 'utm.js'), 'utf8');

/* Odtlacok suboru ako v ops/seo/landingy.mjs: prvych 8 znakov sha256 z textu s LF (GitHub Pages podava LF). */
const odtlacok = (cesta) => createHash('sha256').update(readFileSync(cesta, 'utf8').split('\r\n').join('\n'), 'utf8').digest('hex').slice(0, 8);

const STRIPE_REF = /^[A-Za-z0-9_-]{1,200}$/;
const ZIVY = 'https://buy.stripe.com/4gM9AN7DY8C7eFc3lP4ko0v';
const TESTOVY = 'https://buy.stripe.com/test_aFa5kx6zUcSncx43lP4ko0l';
const F3 = 'https://arling.sk/puzzle-books/star-battle-puzzle-book/?utm_source=youtube&utm_medium=shorts&utm_campaign=f3&utm_content=stars';

/* Maly nahradnik sessionStorage: pocita volania a vie zlyhat, ako ked je ulozisko blokovane alebo plne. */
function ulozisko(pociatok = {}, { zapisChyba = false, citanieChyba = false } = {}) {
  const m = new Map(Object.entries(pociatok));
  const volania = { get: 0, set: 0, remove: 0 };
  return {
    m, volania,
    getItem(k) { volania.get++; if (citanieChyba) throw new Error('SecurityError'); return m.has(k) ? m.get(k) : null; },
    setItem(k, v) { volania.set++; if (zapisChyba) throw new Error('QuotaExceededError'); m.set(k, String(v)); },
    removeItem(k) { volania.remove++; m.delete(k); },
  };
}

/* ── Ciste funkcie ─────────────────────────────────────────────────────── */

test('utmZAdresy berie len pat poli utm_*, ostatne parametre a hash ignoruje', () => {
  const u = utmZAdresy(F3 + '&utm_term=bublina&fbclid=abc&session_id=cs_live_1#cena');
  assert.deepEqual(u, { utm_source: 'youtube', utm_medium: 'shorts', utm_campaign: 'f3', utm_content: 'stars', utm_term: 'bublina' });
  assert.deepEqual(Object.keys(u).sort(), [...UTM_POLIA].sort());
  assert.deepEqual(utmZAdresy('https://arling.sk/puzzle-books/?fbclid=abc&test=1'), {});
});

test('zakazane znaky su prec a hodnota ma najviac 80 znakov', () => {
  const u = utmZAdresy('https://arling.sk/?utm_source=You%20Tube!&utm_campaign=f3%2Fx%3Cscript%3E&utm_medium=%C5%BEivo&utm_content=' + 'a'.repeat(200));
  assert.equal(u.utm_source, 'YouTube');
  assert.equal(u.utm_campaign, 'f3xscript');
  assert.equal(u.utm_medium, 'ivo');
  assert.equal(u.utm_content, 'a'.repeat(NAJVIAC_HODNOTA));
  assert.equal(NAJVIAC_HODNOTA, 80);
  // prazdne a same zakazane hodnoty vypadnu
  assert.deepEqual(utmZAdresy('https://arling.sk/?utm_source=&utm_campaign=%20%20&utm_content=!!!'), {});
  assert.equal(cistaHodnota(42), '');
  assert.equal(cistaHodnota(null), '');
  assert.equal(cistaHodnota({ a: 1 }), '');
});

test('zla adresa nevyhodi vynimku', () => {
  for (const x of ['', 'nie je adresa', undefined, null, 42, {}]) assert.deepEqual(utmZAdresy(x), {}, String(x));
});

test('utmZUlozenia precita JSON aj objekt, cudzie kluce a necisty obsah zahodi', () => {
  assert.deepEqual(utmZUlozenia(JSON.stringify({ utm_source: 'youtube', utm_campaign: 'f3' })), { utm_source: 'youtube', utm_campaign: 'f3' });
  assert.deepEqual(utmZUlozenia({ utm_source: 'pinterest', email: 'a@b.sk', utm_content: 'pin<1>' }), { utm_source: 'pinterest', utm_content: 'pin1' });
  assert.deepEqual(utmZUlozenia({ utm_source: 5, utm_campaign: { a: 1 }, utm_content: ['x'] }), {}, 'len texty');
  for (const x of [null, undefined, '', 'nie je json', '[1,2]', '"text"', '42', [1, 2], true]) assert.deepEqual(utmZUlozenia(x), {}, String(x));
});

test('prichod: UTM z adresy maju prednost, ulozene sa pouziju len ked v adrese nie su', () => {
  const ulozene = JSON.stringify({ utm_source: 'pinterest', utm_campaign: 'puzzle-books' });
  assert.deepEqual(prichod(F3, ulozene), { utm: utmZAdresy(F3), zAdresy: true });
  assert.deepEqual(prichod('https://arling.sk/puzzle-books/#cena', ulozene), { utm: { utm_source: 'pinterest', utm_campaign: 'puzzle-books' }, zAdresy: false });
  assert.deepEqual(prichod('https://arling.sk/puzzle-books/?test=1', ulozene).zAdresy, false, 'adresa bez UTM nie je prichod');
  assert.deepEqual(prichod('https://arling.sk/puzzle-books/', null), { utm: {}, zAdresy: false });
});

test('referencia: <zdroj>_<kampan>_<obsah>, napriklad youtube_f3_stars', () => {
  assert.equal(referencia(utmZAdresy(F3)), 'youtube_f3_stars');
  assert.equal(referencia({ utm_source: 'youtube', utm_campaign: 'f3', utm_content: 'hashi' }), 'youtube_f3_hashi');
  // chybajuca cast sa vynecha
  assert.equal(referencia({ utm_source: 'youtube', utm_campaign: 'f3' }), 'youtube_f3');
  assert.equal(referencia({ utm_source: 'pinterest' }), 'pinterest');
  assert.equal(referencia({ utm_campaign: 'f3', utm_content: 'stars' }), 'f3_stars');
  // medium a term do referencie nejdu
  assert.equal(referencia({ utm_source: 'youtube', utm_medium: 'shorts', utm_term: 'x', utm_campaign: 'f3', utm_content: 'stars' }), 'youtube_f3_stars');
});

test('referencia vznikne len z UTM: bez nich je prazdna', () => {
  for (const x of [undefined, null, '', 'youtube', 42, [], {}, { utm_medium: 'shorts' }, { utm_term: 'x' }, { utm_medium: 'shorts', utm_term: 'x' },
    { client_reference_id: 'x', foo: 'bar', source: 'youtube', campaign: 'f3' }, { utm_source: '', utm_campaign: '!!!', utm_content: 42 }]) {
    assert.equal(referencia(x), '', JSON.stringify(x));
  }
});

test('referencia ma len povolene znaky a najviac 200 znakov, aj z necistych hodnot', () => {
  assert.equal(NAJVIAC_REFERENCIA, 200);
  const necista = referencia({ utm_source: 'You Tube', utm_campaign: 'f3/../x', utm_content: 'ž<b>' });
  assert.equal(necista, 'YouTube_f3x_b');
  const dlha = referencia({ utm_source: 'a'.repeat(300), utm_campaign: 'b'.repeat(300), utm_content: 'c'.repeat(300) });
  assert.equal(dlha.length, 200, 'najviac 200, tri casti po 80 su 242');
  assert.match(dlha, STRIPE_REF);
  // nahodny sum zo vsetkych druhov znakov, vratane tych, co by pokazili adresu
  const znaky = 'abcXYZ019_-.:/\\?#&=%+ <>"\'`~!@$^*()[]{}|;,žščťýáíé\u0000\u202e\n\t';
  let seed = 12345;
  const nahoda = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  for (let i = 0; i < 300; i++) {
    const hodnota = () => Array.from({ length: nahoda(120) }, () => znaky[nahoda(znaky.length)]).join('');
    const adresa = 'https://arling.sk/puzzle-books/?' + ['utm_source', 'utm_campaign', 'utm_content'].map((k) => k + '=' + encodeURIComponent(hodnota())).join('&');
    const r = referencia(utmZAdresy(adresa));
    assert.ok(r === '' || STRIPE_REF.test(r), JSON.stringify(r));
  }
});

test('odkazSReferenciou: client_reference_id do ziveho aj testoveho odkazu Stripe, nic ine', () => {
  const utm = utmZAdresy(F3);
  assert.equal(odkazSReferenciou(ZIVY, utm), ZIVY + '?client_reference_id=youtube_f3_stars');
  assert.equal(odkazSReferenciou(TESTOVY, utm), TESTOVY + '?client_reference_id=youtube_f3_stars');
  const u = new URL(odkazSReferenciou(TESTOVY, utm));
  assert.equal(u.origin + u.pathname, TESTOVY, 'adresa platby sa nemeni');
  assert.deepEqual([...u.searchParams.keys()], ['client_reference_id'], 'ziadny iny parameter');
  assert.match(u.searchParams.get('client_reference_id'), STRIPE_REF);
  // existujuci client_reference_id sa prepise, nezdvoji
  const s = new URL(odkazSReferenciou(ZIVY + '?client_reference_id=stare&prefilled_email=a%40b.sk', utm));
  assert.equal(s.searchParams.getAll('client_reference_id').length, 1);
  assert.equal(s.searchParams.get('client_reference_id'), 'youtube_f3_stars');
  assert.equal(s.searchParams.get('prefilled_email'), 'a@b.sk');
});

test('bez UTM sa k odkazu neprilepi nic, odkaz ostane presne ten isty retazec', () => {
  for (const utm of [{}, undefined, null, { utm_medium: 'shorts' }, { utm_term: 'x' }, { client_reference_id: 'x' }]) {
    assert.strictEqual(odkazSReferenciou(ZIVY, utm), ZIVY, JSON.stringify(utm));
    assert.strictEqual(odkazSReferenciou(TESTOVY, utm), TESTOVY, JSON.stringify(utm));
  }
  assert.ok(!odkazSReferenciou(ZIVY, {}).includes('client_reference_id'));
});

test('menia sa len odkazy na buy.stripe.com, cudzie a prazdne ostanu', () => {
  const utm = utmZAdresy(F3);
  for (const x of ['https://example.com/x', 'http://buy.stripe.com/x', 'https://buy.stripe.com.zly.example/x', 'https://buy.stripe.com@zly.example/x',
    'https://checkout.stripe.com/c/pay/cs_test_1', '/puzzle-books/#hedgehogs', 'javascript:alert(1)', 'https://BUY.stripe.com.zly.example/x', '']) {
    assert.strictEqual(odkazSReferenciou(x, utm), x, x);
  }
  assert.strictEqual(odkazSReferenciou(undefined, utm), undefined);
  assert.strictEqual(odkazSReferenciou(null, utm), null);
});

/* ── Zachyt prichodu ───────────────────────────────────────────────────── */

test('zapamatajPrichod ulozi len povolene polia a vrati UTM tejto navstevy', () => {
  const st = ulozisko();
  const utm = zapamatajPrichod({ adresa: F3 + '&fbclid=abc&email=a%40b.sk', uloziste: st });
  assert.deepEqual(utm, { utm_source: 'youtube', utm_medium: 'shorts', utm_campaign: 'f3', utm_content: 'stars' });
  assert.deepEqual(JSON.parse(st.m.get(UTM_KLUC)), utm);
  assert.equal(st.volania.set, 1);
  assert.deepEqual([...st.m.keys()], [UTM_KLUC], 'do uloziska nic ine');
  assert.equal(UTM_KLUC, 'arling_utm', 'ten isty kluc ako /titul.js a /olive/obchod.js');
});

test('stranka kniha a potom polica: ulozeny prichod ostane a polica ho pouzije', () => {
  const st = ulozisko();
  zapamatajPrichod({ adresa: F3, uloziste: st });
  const nasledne = zapamatajPrichod({ adresa: 'https://arling.sk/puzzle-books/#hedgehogs', uloziste: st });
  assert.equal(referencia(nasledne), 'youtube_f3_stars');
  assert.equal(st.volania.set, 1, 'adresa bez UTM nic neprepisuje');
});

test('nove UTM v adrese prepisu stare', () => {
  const st = ulozisko({ [UTM_KLUC]: JSON.stringify({ utm_source: 'youtube', utm_campaign: 'f3', utm_content: 'stars' }) });
  const utm = zapamatajPrichod({ adresa: 'https://arling.sk/puzzle-books/?utm_source=pinterest&utm_campaign=puzzle-books', uloziste: st });
  assert.equal(referencia(utm), 'pinterest_puzzle-books');
  assert.deepEqual(JSON.parse(st.m.get(UTM_KLUC)), { utm_source: 'pinterest', utm_campaign: 'puzzle-books' }, 'nezostane nic zo stareho obsahu');
});

test('bez UTM v adrese aj v ulozisku nie je nic a nic sa nezapise', () => {
  const st = ulozisko();
  assert.deepEqual(zapamatajPrichod({ adresa: 'https://arling.sk/puzzle-books/?test=1', uloziste: st }), {});
  assert.deepEqual(st.volania, { get: 1, set: 0, remove: 0 });
  assert.equal(referencia(zapamatajPrichod({ adresa: 'https://arling.sk/puzzle-books/', uloziste: st })), '');
});

test('ulozisko vie zlyhat: zapis zlyha, stara kampan sa zmaze a nakup sa nepripise starej', () => {
  const st = ulozisko({ [UTM_KLUC]: JSON.stringify({ utm_source: 'youtube', utm_campaign: 'f3', utm_content: 'stars' }) }, { zapisChyba: true });
  const utm = zapamatajPrichod({ adresa: 'https://arling.sk/puzzle-books/?utm_source=pinterest&utm_campaign=puzzle-books', uloziste: st });
  assert.equal(referencia(utm), 'pinterest_puzzle-books', 'tejto navsteve patri nova kampan');
  assert.equal(st.volania.remove, 1);
  assert.equal(st.m.has(UTM_KLUC), false, 'stara kampan nezostala');
  // dalsia stranka bez UTM potom nema co pripisat
  assert.deepEqual(zapamatajPrichod({ adresa: 'https://arling.sk/puzzle-books/#cena', uloziste: st }), {});
});

test('ulozisko vie zlyhat: citanie zlyha, chybajuce ulozisko, poskodeny obsah', () => {
  assert.deepEqual(zapamatajPrichod({ adresa: 'https://arling.sk/puzzle-books/', uloziste: ulozisko({}, { citanieChyba: true }) }), {});
  const sCitanimChybou = ulozisko({}, { citanieChyba: true });
  assert.equal(referencia(zapamatajPrichod({ adresa: F3, uloziste: sCitanimChybou })), 'youtube_f3_stars');
  assert.equal(referencia(zapamatajPrichod({ adresa: F3, uloziste: null })), 'youtube_f3_stars', 'bez uloziska ide kupa s UTM z adresy');
  assert.deepEqual(zapamatajPrichod({ adresa: 'https://arling.sk/puzzle-books/', uloziste: null }), {});
  assert.deepEqual(zapamatajPrichod({ adresa: 'https://arling.sk/puzzle-books/', uloziste: ulozisko({ [UTM_KLUC]: 'nie je json' }) }), {});
  const cudzie = zapamatajPrichod({ adresa: 'https://arling.sk/puzzle-books/', uloziste: ulozisko({ [UTM_KLUC]: JSON.stringify({ utm_source: 'youtube', email: 'a@b.sk', meno: 'Jan' }) }) });
  assert.deepEqual(cudzie, { utm_source: 'youtube' }, 'cudzie polia neprejdu');
  // aj zapis aj mazanie mozu zlyhat naraz
  const rozbite = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); }, removeItem() { throw new Error('x'); } };
  assert.equal(referencia(zapamatajPrichod({ adresa: F3, uloziste: rozbite })), 'youtube_f3_stars');
});

test('v Node (bez DOM) import nic nespusti a utmNavstevy nevyhodi', () => {
  assert.deepEqual(utmNavstevy(), {});
  assert.equal(utmNavstevy(), utmNavstevy(), 'spocitane raz');
});

test('utm.js nevola siet, nepouziva cookies ani localStorage, pise jedinym setItem do sessionStorage', () => {
  const kod = utmZdroj.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/.*$/gm, '');
  assert.doesNotMatch(kod, /\bfetch\b|XMLHttpRequest|sendBeacon|WebSocket|EventSource|document\.cookie|localStorage|indexedDB|navigator\.|\bimport\s*\(|\bimport\s+/);
  assert.match(kod, /sessionStorage/);
  assert.equal((kod.match(/\.setItem\(/g) || []).length, 1);
  assert.equal((kod.match(/\.getItem\(/g) || []).length, 1);
});

/* ── app.js: skutocny kod kliknutia na kupu ────────────────────────────── */

test('app.js nacita utm.js dynamicky a jeho chyba nezhodi policu; books_kupa_click nesie utm_campaign a utm_content', () => {
  // dynamicky import s chybou zahodenou do prazdna: staticky import by pri chybajucom subore (nenasadeny novy subor,
  // blokator, vypadok) zhodil cely app.js, teda aj tlacidla kupy
  assert.match(app, /let povod = null;\nimport\('\.\/utm\.js'\)\.then\(\(m\) => \{ povod = m; \}, \(\) => \{[^}]*\}\);/);
  assert.doesNotMatch(app, /from '\.\/utm\.js'/, 'staticky import utm.js by pri chybajucom subore zhodil celu policu');
  assert.match(app, /povod\.utmNavstevy\(\)/);
  assert.match(app, /povod\.odkazSReferenciou\(u, utm\)/);
  assert.match(app, /track\('books_kupa_click', \{[^}]*utm_campaign: utm\.utm_campaign \|\| '', utm_content: utm\.utm_content \|\| ''[^}]*\}\)/);
});

/* Kus app.js od testRezim() po odkazy na ukazky sa spusti nad malou nahradou DOM (ako v ops/stripe/puzzle-books-test.test.mjs):
   je to presne ten kod, ktory rozhoduje o odkaze a o udalosti. */
const OD = app.indexOf('function testRezim()');
const DO = app.indexOf("for (const a of document.querySelectorAll('a[data-ukazka]')");
assert.ok(OD > 0 && DO > OD, 'app.js: usek od testRezim() po odkazy na ukazky sa nenasiel');
const KUS = app.slice(OD, DO);
const SPUSTI = new Function('sessionStorage', 'location', 'URL', '$', 'document', 'track', 'T', 'VSETKY', 'CENA_VSETKY', 'CENA_KNIHA', 'stavPlatby',
  'povod', KUS + '\nreturn true;');

/** Jedno kliknutie na tlacidlo kupy. `prichodAdresa` je adresa, na ktorej navstevnik prisiel (UTM sa zachytia ako pri nacitani stranky).
 *  `povodStav` hovori, ako dopadlo nacitanie utm.js: 'ok' (modul nacitany), 'chyba' (nenacitany, povod je null),
 *  'vyhadzuje' (funkcie modulu padnu), 'nezmysel' (odkazSReferenciou vrati nieco ine ako text). */
function klik({ polica, prichodAdresa = polica, dataset, uloziste = ulozisko(), zapisSession = new Map(), povodStav = 'ok' }) {
  const sessionStorage = { getItem: (k) => (zapisSession.has(k) ? zapisSession.get(k) : null), setItem: (k, v) => zapisSession.set(k, String(v)) };
  const location = { href: polica };
  const udalosti = [];
  const tlacidlo = { dataset, handlers: [], addEventListener(typ, f) { if (typ === 'click') this.handlers.push(f); } };
  const stavPlatby = { textContent: '', scrollIntoView() {} };
  const odznak = { hidden: null };
  const utm = zapamatajPrichod({ adresa: prichodAdresa, uloziste });
  const povod = {
    ok: { utmNavstevy: () => utm, odkazSReferenciou },
    chyba: null,
    vyhadzuje: { utmNavstevy() { throw new Error('x'); }, odkazSReferenciou() { throw new Error('x'); } },
    nezmysel: { utmNavstevy: () => utm, odkazSReferenciou: () => ({ nie: 'text' }) },
  }[povodStav];
  SPUSTI(sessionStorage, location, URL, (id) => (id === 'test-odznak' ? odznak : null),
    { querySelectorAll: (sel) => (sel === '[data-link]' ? [tlacidlo] : []) },
    (meno, data) => udalosti.push([meno, data]), { testChyba: 'TEST_CHYBA', zapina: 'ZAPINA' }, 'all', 1990, 490, stavPlatby,
    povod);
  assert.equal(tlacidlo.handlers.length, 1, 'tlacidlo ma presne jeden poslucham kliknutia');
  tlacidlo.handlers[0]();
  return { href: location.href, udalosti, stavPlatby, utm };
}
const KNIHA = { kniha: 'hedgehogs', link: 'https://buy.stripe.com/zivy_h', linkTest: 'https://buy.stripe.com/test_h' };
const BALIK = { link: 'https://buy.stripe.com/zivy_all', linkTest: 'https://buy.stripe.com/test_all' };
const POLICA = 'https://arling.sk/puzzle-books/';
const UTM_F3 = 'utm_source=youtube&utm_medium=shorts&utm_campaign=f3&utm_content=stars';

test('zivy rezim s UTM: klik ide na zivy odkaz s client_reference_id a udalost nesie kampan', () => {
  const r = klik({ polica: POLICA + '?' + UTM_F3 + '#hedgehogs', dataset: KNIHA });
  assert.equal(r.href, 'https://buy.stripe.com/zivy_h?client_reference_id=youtube_f3_stars');
  assert.deepEqual(r.udalosti, [['books_kupa_click', { kniha: 'hedgehogs', cena: 490, produkt: 'books', utm_campaign: 'f3', utm_content: 'stars' }]]);
});

test('testovaci rezim ?test=1 s UTM: klik ide na testovy odkaz s client_reference_id, nikdy na zivy', () => {
  const r = klik({ polica: POLICA + '?test=1&' + UTM_F3, dataset: KNIHA });
  assert.equal(r.href, 'https://buy.stripe.com/test_h?client_reference_id=youtube_f3_stars');
  assert.ok(!r.href.includes('zivy'));
  assert.equal(r.udalosti[0][1].utm_campaign, 'f3');
});

test('testovaci rezim drzi aj ked UTM prisli skor na stranke knihy (ulozene v sessionStorage)', () => {
  const st = ulozisko();
  const zapis = new Map();
  // 1. stranka knihy z videa
  zapamatajPrichod({ adresa: F3, uloziste: st });
  // 2. polica s ?test=1 bez UTM v adrese, v tej istej karte
  const r = klik({ polica: POLICA + '?test=1#hedgehogs', dataset: KNIHA, uloziste: st, zapisSession: zapis });
  assert.equal(r.href, 'https://buy.stripe.com/test_h?client_reference_id=youtube_f3_stars');
  assert.equal(zapis.get('books:test'), '1');
});

test('bez UTM nejde do Stripe ziadny parameter ani v zivom, ani v testovom rezime', () => {
  const zivy = klik({ polica: POLICA + '#hedgehogs', dataset: KNIHA });
  assert.strictEqual(zivy.href, 'https://buy.stripe.com/zivy_h');
  assert.deepEqual(zivy.udalosti, [['books_kupa_click', { kniha: 'hedgehogs', cena: 490, produkt: 'books', utm_campaign: '', utm_content: '' }]]);
  const test = klik({ polica: POLICA + '?test=1', dataset: KNIHA });
  assert.strictEqual(test.href, 'https://buy.stripe.com/test_h');
  // UTM, z ktorych referencia nevznikne (len medium, term), tiez nic nepridaju
  const len = klik({ polica: POLICA + '?utm_medium=profil&utm_term=x', dataset: KNIHA });
  assert.strictEqual(len.href, 'https://buy.stripe.com/zivy_h');
});

test('balik vsetkych desiatich nesie referenciu a spravnu cenu v udalosti', () => {
  const r = klik({ polica: POLICA + '?' + UTM_F3 + '#cena', dataset: BALIK });
  assert.equal(r.href, 'https://buy.stripe.com/zivy_all?client_reference_id=youtube_f3_stars');
  assert.deepEqual(r.udalosti[0][1], { kniha: 'all', cena: 1990, produkt: 'books', utm_campaign: 'f3', utm_content: 'stars' });
});

test('ked sa utm.js nenacita (povod null), kupa ide na povodny odkaz a polica funguje ako predtym', () => {
  const zivy = klik({ polica: POLICA + '?' + UTM_F3, dataset: KNIHA, povodStav: 'chyba' });
  assert.strictEqual(zivy.href, 'https://buy.stripe.com/zivy_h', 'ziadna referencia, ale kupa ide');
  assert.deepEqual(zivy.udalosti, [['books_kupa_click', { kniha: 'hedgehogs', cena: 490, produkt: 'books', utm_campaign: '', utm_content: '' }]]);
  const test = klik({ polica: POLICA + '?test=1&' + UTM_F3, dataset: KNIHA, povodStav: 'chyba' });
  assert.strictEqual(test.href, 'https://buy.stripe.com/test_h');
  // aj prazdny odkaz sa spravia ako predtym: nic sa nenavigovalo, stav platby povie, co je
  const bez = klik({ polica: POLICA, dataset: { ...KNIHA, link: '' }, povodStav: 'chyba' });
  assert.equal(bez.href, POLICA);
  assert.equal(bez.stavPlatby.textContent, 'ZAPINA');
});

test('ked funkcie z utm.js zlyhaju alebo vratia nezmysel, kupa ide na povodny odkaz', () => {
  const pada = klik({ polica: POLICA + '?' + UTM_F3, dataset: KNIHA, povodStav: 'vyhadzuje' });
  assert.strictEqual(pada.href, 'https://buy.stripe.com/zivy_h');
  assert.equal(pada.udalosti.length, 1, 'udalost sa aj tak posle');
  const nezmysel = klik({ polica: POLICA + '?' + UTM_F3, dataset: KNIHA, povodStav: 'nezmysel' });
  assert.strictEqual(nezmysel.href, 'https://buy.stripe.com/zivy_h');
});

test('testovaci rezim bez testoveho odkazu nikdy neposle na zivy odkaz, ani s UTM', () => {
  const r = klik({ polica: POLICA + '?test=1&' + UTM_F3, dataset: { ...KNIHA, linkTest: '' } });
  assert.equal(r.href, POLICA + '?test=1&' + UTM_F3, 'nikam sa nenavigovalo');
  assert.equal(r.stavPlatby.textContent, 'TEST_CHYBA');
});

test('necisty UTM v adrese sa do Stripe nedostane', () => {
  const r = klik({ polica: POLICA + '?utm_source=you%20tube%26x%3D1&utm_campaign=f3%3Cscript%3E&utm_content=%C5%A1tars!', dataset: KNIHA });
  const ref = new URL(r.href).searchParams.get('client_reference_id');
  assert.equal(ref, 'youtubex1_f3script_tars');
  assert.match(ref, STRIPE_REF);
  assert.deepEqual([...new URL(r.href).searchParams.keys()], ['client_reference_id']);
});

/* ── Stranky ───────────────────────────────────────────────────────────── */

/** Stranky pod /puzzle-books/, ktore nacitavaju utm.js samy: vsetky okrem police (utm.js ide cez app.js),
 *  eink-bundle (vlastny zachyt cez /titul.js) a film/ (pomocne stranky filmu, nie pre navstevnikov). */
function strankyNaZachyt(d = TU, von = []) {
  for (const meno of readdirSync(d)) {
    const p = join(d, meno);
    if (statSync(p).isDirectory()) { strankyNaZachyt(p, von); continue; }
    if (meno !== 'index.html') continue;
    const rel = relative(TU, p).split('\\').join('/');
    if (rel === 'index.html' || rel.startsWith('eink-bundle/') || /(^|\/)film\//.test(rel)) continue;
    von.push([rel, p]);
  }
  return von;
}

test('kazda stranka kniha a ponuky pod /puzzle-books/ nacita utm.js s aktualnym ?v= prave raz, hned za prepinac.js', () => {
  const hash = odtlacok(join(TU, 'utm.js'));
  const stranky = strankyNaZachyt();
  assert.ok(stranky.length >= 70, 'cakal som aspon 70 stranok, nasiel som ' + stranky.length);
  for (const [rel, p] of stranky) {
    const h = readFileSync(p, 'utf8');
    const tag = '<script type="module" src="/puzzle-books/utm.js?v=' + hash + '"></script>';
    assert.equal(h.split('/puzzle-books/utm.js').length - 1, 1, rel + ': utm.js musi byt na stranke prave raz');
    assert.ok(h.includes(tag), rel + ': chyba tag s aktualnym ?v=' + hash + ' (po zmene utm.js nahrad stare ?v= v stranke)');
    assert.match(h, /<script src="\/style\/prepinac\.js[^"]*" defer><\/script>\n<script type="module" src="\/puzzle-books\/utm\.js\?v=[0-9a-f]{8}"><\/script>\n<style>/, rel + ': tag ma stat za prepinac.js a pred prvym <style> (odtial ho cita obal stranok ponuk len na Etsy)');
    assert.ok(!h.includes('/puzzle-books/app.js'), rel + ': stranka nema nacitat app.js police');
    const csp = h.match(/Content-Security-Policy" content="([^"]+)"/);
    assert.ok(csp, rel + ': chyba CSP');
    const scriptSrc = csp[1].match(/script-src ([^;]+)/)[1];
    assert.ok(/(^| )'self'( |$)/.test(scriptSrc), rel + ': script-src nema \'self\', modul z nasej domeny by sa nespustil');
    assert.ok(!scriptSrc.includes('unsafe-inline') && !scriptSrc.includes('unsafe-eval'), rel);
  }
});

test('desat kniznych stranok je medzi nimi a vsetky ich tlacidla kupy vedu stale na policu, nie na Stripe', () => {
  const knizne = ['star-battle-puzzle-book', 'nonogram-puzzle-book', 'slitherlink-puzzle-book', 'hashi-puzzle-book', 'masyu-puzzle-book',
    'nurikabe-puzzle-book', 'kakuro-puzzle-book', 'numberlink-puzzle-book', 'killer-sudoku-book', 'anti-knight-sudoku-book'];
  const rel = new Set(strankyNaZachyt().map(([r]) => r));
  for (const slug of knizne) {
    assert.ok(rel.has(slug + '/index.html'), slug);
    const h = readFileSync(join(TU, slug, 'index.html'), 'utf8');
    assert.ok(!h.includes('buy.stripe.com'), slug + ': stranka knihy ma odkaz priamo na Stripe; ten by musel niest client_reference_id (odkazSReferenciou z utm.js), dnes platbu robi polica');
    // B1 (2. 10. 2026, ops/etsy/b1-buy-on-etsy/STAVBA.md): plné tlačidlo je „Buy on Etsy“, kúpa na hube je tichý odkaz
    // na policu (class="tichy"); podstatné ostáva, že vedie na policu, nie na Stripe.
    assert.match(h, /<a class="(?:btn btn-solid|tichy)" href="\/puzzle-books\/#[a-z]+">Buy [A-Za-z]+ for \d+\.\d{2} €<\/a>/, slug + ': tlacidlo kupy vedie na policu');
  }
});

test('polica: app.js ma ?v= zhodne s obsahom a nacita utm.js, takze UTM zachyti aj priamy prichod na policu', () => {
  const html = readFileSync(join(TU, 'index.html'), 'utf8');
  const m = html.match(/<script type="module" src="\/puzzle-books\/app\.js\?v=([0-9a-f]{8})"><\/script>/);
  assert.ok(m, 'polica nacitava app.js ako modul s ?v=');
  assert.equal(m[1], odtlacok(join(TU, 'app.js')), 'po zmene app.js treba v index.html prepisat ?v= na ' + odtlacok(join(TU, 'app.js')));
  assert.ok(existsSync(join(TU, 'utm.js')));
  assert.equal(html.split('/puzzle-books/utm.js').length - 1, 0, 'polica nacita utm.js len cez import v app.js, nie druhy raz');
});

test('generator ops/seo/landingy.mjs vklada utm.js do kniznych stranok, takze ho dalsi beh nezmaze', () => {
  const konf = JSON.parse(readFileSync(join(KOREN, 'ops/seo/landingy.json'), 'utf8'));
  assert.equal(konf.skupiny.knihy.vlozSkript, '/puzzle-books/utm.js');
  assert.deepEqual(konf.skupiny.knihy.zahod, ['/puzzle-books/app.js']);
  const gen = readFileSync(join(KOREN, 'ops/seo/landingy.mjs'), 'utf8');
  assert.match(gen, /if \(g\.vlozSkript\) html = vlozSkript\(html, g\.vlozSkript, kde\);/);
  assert.match(gen, /<script type="module" src="\$\{src\}\?v=\$\{odtlacokSuboru\(src, kde\)\}"><\/script>/);
  // obal stranok ponuk len na Etsy sa cita z kniznej stranky hashi-puzzle-book, ktora tag nesie
  const hashi = readFileSync(join(TU, 'hashi-puzzle-book', 'index.html'), 'utf8');
  assert.ok(hashi.includes('/puzzle-books/utm.js?v=' + odtlacok(join(TU, 'utm.js'))));
});

/* ── Cesta z videa ─────────────────────────────────────────────────────── */

test('kratke adresy /v/<kod>/ do knih nesu UTM, z ktorych vznikne referencia (pri F3 zdroj_kampan_<kod>)', () => {
  const V = join(TU, '..', 'v');
  const ciele = {};
  for (const kod of readdirSync(V)) {
    const subor = join(V, kod, 'index.html');
    if (!existsSync(subor)) continue;
    const m = readFileSync(subor, 'utf8').match(/location\.replace\("([^"]+)"\)/);
    if (!m) continue;
    const cil = new URL(m[1]);
    if (!cil.pathname.startsWith('/puzzle-books/')) continue;
    ciele[kod] = referencia(utmZAdresy(m[1]));
    assert.match(ciele[kod], STRIPE_REF, '/v/' + kod + '/ nema UTM, z ktorych by vznikla referencia');
  }
  // videa F3 (stars, hashi, links, books): referencia ma tri casti a kod videa je jej posledna cast, napriklad youtube_f3_stars;
  // tak sa objednavka da pripisat konkretnemu videu
  for (const kod of ['stars', 'hashi', 'links', 'books']) {
    assert.ok(ciele[kod], '/v/' + kod + '/ chyba alebo nevedie do knih');
    const casti = ciele[kod].split('_');
    assert.equal(casti.length, 3, '/v/' + kod + '/: ' + ciele[kod]);
    assert.equal(casti[2], kod, '/v/' + kod + '/: posledna cast referencie ' + ciele[kod] + ' nie je kod videa');
  }
});
