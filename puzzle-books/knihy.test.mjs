/* Knihy hlavolamov: zdroj stranky bez ciest k PDF a ciste funkcie z knihy.js.
 *
 * Preco (25. 9. 2026): app.js do vtedy niesol 16-znakove kluciky vsetkych
 * desiatich knih a adresu PDF si skladal sam, takze si kazdu knihu mohol
 * stiahnut ktokolvek bez platby. Odteraz odkazy da len licencna sluzba
 * (GET /licence/api/purchase/links) podla products/licence-service/puzzle_books.json.
 * Test strazi oboje: ze sa ziadny klucik ani priecinok PDF do zdroja stranky
 * nevrati a ze sluzba pozna kazdu knihu, ktoru stranka predava.
 * usage: node --test products/arling-sk/puzzle-books/knihy.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, extname, relative } from 'node:path';
import {
  KNIHY, VSETKY, relacieZoZaznamu, pridajRelaciu, stareOdomknutie, knihyRelacie, poradieRelacii,
  suboryPodlaKnihy, pokryta, stavKnihy, odkazyPlatby,
} from './knihy.js';
import { LICENCIE } from '../titul.js';

const TU = dirname(fileURLToPath(import.meta.url));
const KOREN = resolve(TU, '../../..');
const citaj = (p) => JSON.parse(readFileSync(p, 'utf8'));
const MAPA_SLUZBY = join(KOREN, 'products/licence-service/puzzle_books.json');
const ODKAZY = join(KOREN, 'ops/stripe/puzzle-books-odkazy.json');
const ODKAZY_TEST = join(KOREN, 'ops/stripe/puzzle-books-test-odkazy.json');
const html = readFileSync(join(TU, 'index.html'), 'utf8');
const app = readFileSync(join(TU, 'app.js'), 'utf8');

/* Textove subory, ktore dostane prehliadac, v celom priecinku knih vratane podstranok. */
function zdroje(d = TU, von = []) {
  for (const meno of readdirSync(d)) {
    const p = join(d, meno);
    if (statSync(p).isDirectory()) {
      if (['pdf', 'files', 'ukazka', 'nahlad'].includes(meno)) continue;
      zdroje(p, von);
      continue;
    }
    if (meno.endsWith('.test.mjs')) continue;
    if (['.html', '.js', '.mjs', '.json', '.txt', '.xml', '.webmanifest'].includes(extname(meno).toLowerCase())) von.push(p);
  }
  return von;
}

/* Kluciky zo vsetkych map tajnych ciest (knihy, cisla, bulletin, tituly). */
function kluciky() {
  const von = new Set();
  const pridaj = (k) => { if (typeof k === 'string' && /^[a-z0-9]{16}$/.test(k)) von.add(k); };
  const p = (x) => join(KOREN, x);
  if (existsSync(p('ops/puzzle-books/tajne-cesty.json'))) Object.values(citaj(p('ops/puzzle-books/tajne-cesty.json'))).forEach(pridaj);
  if (existsSync(p('ops/puzzlepost/tajne-cesty.json'))) for (const z of Object.values(citaj(p('ops/puzzlepost/tajne-cesty.json')))) Object.values(z).forEach(pridaj);
  if (existsSync(p('ops/puzzlepost/bulletin/tajne-cesty.json'))) for (const z of Object.values(citaj(p('ops/puzzlepost/bulletin/tajne-cesty.json')))) Object.values(z).forEach(pridaj);
  if (existsSync(p('ops/design/tajne-cesty-tituly.json'))) for (const z of Object.values(citaj(p('ops/design/tajne-cesty-tituly.json')))) pridaj(z.klucik);
  return [...von];
}

const polozky = (j) => (j && j.polozky && typeof j.polozky === 'object' ? j.polozky : j);

/* ── Zdroj stranky ─────────────────────────────────────────────────────── */

test('ziadny klucik platenych suborov v zdroji stranky knih ani podstranok', () => {
  const k = kluciky();
  assert.ok(k.length >= 10, 'mapy klucikov sa nenacitali, test by nic nestrazil');
  const subory = zdroje();
  assert.ok(subory.some((s) => s.endsWith('app.js')) && subory.some((s) => s.endsWith('knihy.js')));
  for (const s of subory) {
    const t = readFileSync(s, 'utf8');
    for (const x of k) assert.ok(!t.includes(x), relative(TU, s) + ' prezradza klucik ' + x);
  }
});

test('app.js, knihy.js a index.html nemenuju priecinok PDF ani mapu CESTY', () => {
  const knihy = readFileSync(join(TU, 'knihy.js'), 'utf8');
  for (const [meno, t] of [['app.js', app], ['knihy.js', knihy], ['index.html', html]]) {
    assert.doesNotMatch(t, /pdf\//, meno + ' menuje priecinok pdf/');
    assert.doesNotMatch(t, /\bCESTY\s*=/, meno + ' ma mapu CESTY');
  }
  // Jedine PDF na stranke su ukazky zadarmo.
  for (const m of html.matchAll(/(?:href|src)="([^"]*\.pdf)"/g)) assert.match(m[1], /^ukazka\/[a-z]+\.pdf$/, 'index.html odkazuje na ' + m[1]);
});

test('kazda karta na stranke je kniha, ktoru pozna knihy.js', () => {
  const karty = [...html.matchAll(/<li id="([a-z]+)" data-kniha="([a-z]+)"/g)].map((m) => m[2]);
  assert.deepEqual([...karty].sort(), [...KNIHY].sort());
});

test('licencna sluzba pozna kazdu knihu a balik, ktore stranka predava', () => {
  const mapa = citaj(MAPA_SLUZBY);
  for (const [subor, pole] of [[ODKAZY, 'data-link'], [ODKAZY_TEST, 'data-link-test']]) {
    if (!existsSync(subor)) continue;
    for (const [kniha, v] of Object.entries(polozky(citaj(subor)))) {
      // Tlacidlo na stranke vedie na ten isty platobny odkaz, ktoreho cena je v mape sluzby.
      const tag = html.match(new RegExp('<button[^<>]*\\sdata-kniha="' + kniha + '"[^<>]*>'));
      assert.ok(tag, kniha + ': tlacidlo chyba');
      assert.ok(tag[0].includes(pole + '="' + v.odkaz + '"'), kniha + ': ' + pole + ' na stranke nesedi s ' + relative(KOREN, subor));
      const z = mapa[v.cena];
      assert.ok(z, kniha + ': price id ' + v.cena + ' chyba v puzzle_books.json (node products/licence-service/puzzle-books-json.mjs --zapis)');
      assert.equal(z.product, 'puzzle-books');
      assert.equal(z.kniha, kniha);
      const ocakavane = kniha === VSETKY ? KNIHY.length * 2 : 2;
      assert.equal(z.files.length, ocakavane, kniha);
      for (const f of z.files) assert.ok(kniha === VSETKY || f.kniha === kniha, kniha + ' ma subor inej knihy');
    }
  }
});

/* ── Ciste funkcie ─────────────────────────────────────────────────────── */

const SID = 'cs_live_a1B2c3D4e5';
const SID2 = 'cs_test_zz99yy88';

test('zaznam platieb prezije poskodene ulozisko a zahodi cudzie kluce', () => {
  assert.deepEqual(relacieZoZaznamu(null), {});
  assert.deepEqual(relacieZoZaznamu('nie je json'), {});
  assert.deepEqual(relacieZoZaznamu([1, 2]), {});
  const z = relacieZoZaznamu({ [SID]: { kniha: 'otters', t: 5 }, 'cs_/../x': { kniha: 'otters' }, [SID2]: { kniha: 'nieco', test: 1 } });
  assert.deepEqual(z, { [SID]: { kniha: 'otters', test: false, t: 5 }, [SID2]: { kniha: '', test: true, t: 0 } });
});

test('pridanie platby nezabudne uz znamu knihu', () => {
  let r = pridajRelaciu({}, SID, 'otters', false, 10);
  r = pridajRelaciu(r, SID, '', true, 20);
  assert.deepEqual(r[SID], { kniha: 'otters', test: true, t: 20 });
  assert.deepEqual(pridajRelaciu(r, 'zle', 'otters', false, 1), r, 'zle session id sa neulozi');
});

test('balik vsetkych sa pyta prvy, potom novsie platby', () => {
  const r = { cs_live_a: { kniha: 'otters', t: 30 }, cs_live_b: { kniha: VSETKY, t: 10 }, cs_live_c: { kniha: 'magpies', t: 20 } };
  assert.deepEqual(poradieRelacii(r), ['cs_live_b', 'cs_live_a', 'cs_live_c']);
  assert.deepEqual(knihyRelacie({ kniha: VSETKY }), [...KNIHY]);
  assert.deepEqual(knihyRelacie({ kniha: '' }), []);
});

const ODKAZ = (f) => LICENCIE + '/download?p=puzzle-books&f=' + f + '&exp=1&sig=' + '0'.repeat(64);

test('odkazy sa rozdelia podla knihy a formatu, cudzie a relativne sa zahodia', () => {
  const k = suboryPodlaKnihy({ ok: true, files: [
    { label: 'Otters, A4 PDF', url: ODKAZ('o-a4.pdf'), kniha: 'otters', format: 'a4' },
    { label: 'Otters, US Letter PDF', url: ODKAZ('o-l.pdf'), kniha: 'otters', format: 'letter' },
    { label: 'zly', url: 'javascript:alert(1)', kniha: 'magpies', format: 'a4' },
    { label: 'cudzi', url: 'https://zly.example/x.pdf', kniha: 'magpies', format: 'a4' },
    { label: 'relativny', url: 'pdf/magpies-a4-x.pdf', kniha: 'magpies', format: 'a4' },
    { label: 'neznama kniha', url: ODKAZ('x.pdf'), kniha: 'dormice', format: 'a4' },
    { label: 'neznamy format', url: ODKAZ('x.pdf'), kniha: 'otters', format: 'eink' },
  ] });
  assert.deepEqual(Object.keys(k), ['otters']);
  assert.equal(k.otters.a4.href, ODKAZ('o-a4.pdf'));
  assert.equal(k.otters.letter.nazov, 'Otters, US Letter PDF');
  assert.deepEqual(suboryPodlaKnihy({ ok: false, files: [] }), {});
  assert.deepEqual(suboryPodlaKnihy(null), {});
});

test('stav knihy: odkazy zo sluzby, cakanie, chyba, stare odomknutie, zamknuta', () => {
  const relacie = { [SID]: { kniha: 'otters', t: 1 } };
  assert.equal(stavKnihy('otters', { relacie }).stav, 'caka');
  assert.deepEqual(stavKnihy('otters', { relacie, vysledky: { [SID]: { ok: false, dovod: 'siet' } } }),
    { stav: 'chyba', relacie: [SID] });
  const knihy = { otters: { a4: { href: ODKAZ('a'), nazov: 'A4' } } };
  const s = stavKnihy('otters', { relacie, vysledky: { [SID]: { ok: true, knihy } } });
  assert.equal(s.stav, 'odkazy');
  assert.equal(s.subory.a4.href, ODKAZ('a'));
  assert.equal(stavKnihy('magpies', { relacie }).stav, 'zamknuta');
  assert.equal(stavKnihy('magpies', { relacie, stare: { knihy: { magpies: true } } }).stav, 'bez-relacie');
  assert.equal(stavKnihy('swans', { stare: JSON.stringify({ vsetky: true }) }).stav, 'bez-relacie');
  assert.deepEqual(stareOdomknutie('zle'), { vsetky: false, knihy: {} });
});

test('plati odpoved sluzby, nie parameter book v navratovej adrese', () => {
  // Platba ulozena ako "magpies", sluzba ale povie "otters": magpies sa neodomkne.
  const relacie = { [SID]: { kniha: 'magpies', t: 1 } };
  const vysledky = { [SID]: { ok: true, knihy: { otters: { a4: { href: ODKAZ('a') } } } } };
  assert.equal(stavKnihy('magpies', { relacie, vysledky }).stav, 'zamknuta');
  assert.equal(stavKnihy('otters', { relacie, vysledky }).stav, 'odkazy');
});

test('platba pokryta balikom sa uz nepyta', () => {
  const vsetky = Object.fromEntries(KNIHY.map((k) => [k, { a4: { href: ODKAZ(k) } }]));
  assert.equal(pokryta({ kniha: 'otters' }, { cs_live_x: { ok: true, knihy: vsetky } }), true);
  assert.equal(pokryta({ kniha: 'otters' }, { cs_live_x: { ok: false } }), false);
  assert.equal(pokryta({ kniha: '' }, { cs_live_x: { ok: true, knihy: vsetky } }), false, 'neznama kniha sa pyta vzdy');
});

function odpoved(status, telo) {
  return async () => ({ ok: status >= 200 && status < 300, status, json: async () => telo });
}

test('dopyt na sluzbu: ok, nezaplatene, vypnute stahovanie, vypadok siete', async () => {
  let adresa = '';
  const ok = await odkazyPlatby(SID, { fetch: async (u) => { adresa = u; return odpoved(200, { ok: true, files: [
    { label: 'Otters, A4 PDF', url: ODKAZ('a.pdf'), kniha: 'otters', format: 'a4' }] })(); } });
  assert.equal(adresa, LICENCIE + '/purchase/links?session_id=' + SID);
  assert.equal(ok.ok, true);
  assert.deepEqual(Object.keys(ok.knihy), ['otters']);
  assert.deepEqual(await odkazyPlatby(SID, { fetch: odpoved(402, { ok: false, reason: 'unpaid' }) }), { ok: false, dovod: 'unpaid' });
  assert.deepEqual(await odkazyPlatby(SID, { fetch: odpoved(503, { ok: false, reason: 'downloads-off' }) }), { ok: false, dovod: 'downloads-off' });
  assert.deepEqual(await odkazyPlatby(SID, { fetch: odpoved(200, { ok: true, files: [] }) }), { ok: false, dovod: 'prazdne' });
  assert.deepEqual(await odkazyPlatby(SID, { fetch: async () => { throw new Error('siet'); } }), { ok: false, dovod: 'siet' });
  assert.deepEqual(await odkazyPlatby(SID, { fetch: null }), { ok: false, dovod: 'siet' });
  assert.deepEqual(await odkazyPlatby('cs_/../v1', { fetch: odpoved(200, {}) }), { ok: false, dovod: 'siet' }, 'zle session id sa ani neposle');
});
