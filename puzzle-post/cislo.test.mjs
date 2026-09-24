/* Zdroj stranky Puzzle Post nesmie prezradit cestu k platenemu suboru.
 *
 * Preco (25. 9. 2026): do vtedy app.js niesol mena PDF cisla vratane
 * 16-znakovych klucikov (kopia ops/puzzlepost/tajne-cesty.json) a subory lezali
 * verejne v puzzle-post/issues/ na GitHub Pages. Kto si otvoril zdroj stranky,
 * stiahol si cislo bez platby. Odteraz odkazy po platbe da len licencna sluzba
 * (titul.js, ukazPoPlatbe, GET /licence/api/purchase/links). Tento test strazi,
 * aby sa ziadne meno, klucik ani priecinok platenych suborov do stranky nevratil,
 * a aby sluzba o cisle, ktore stranka predava, naozaj vedela.
 * usage: node --test products/arling-sk/puzzle-post/cislo.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, extname, relative } from 'node:path';

const TU = dirname(fileURLToPath(import.meta.url));
const KOREN = resolve(TU, '../../..');
const APP = join(TU, 'app.js');
const INDEX = join(TU, 'index.html');
const MAPA = join(KOREN, 'ops/puzzlepost/tajne-cesty.json');
const MAPA_BULLETIN = join(KOREN, 'ops/puzzlepost/bulletin/tajne-cesty.json');
const CISLA = join(KOREN, 'products/licence-service/puzzlepost_issues.json');
const TITULY = join(KOREN, 'products/licence-service/tituly.json');

const app = readFileSync(APP, 'utf8');
const citaj = (p) => JSON.parse(readFileSync(p, 'utf8'));

/* Textove subory stranky Puzzle Post, ktore dostane prehliadac (bez bulletin/,
   ten ma vlastnu stranku, a bez testov). */
function zdrojeStranky(d = TU, von = []) {
  for (const meno of readdirSync(d)) {
    const p = join(d, meno);
    if (statSync(p).isDirectory()) {
      if (meno === 'bulletin' || meno === 'issues' || meno === 'nahlad') continue;
      zdrojeStranky(p, von);
      continue;
    }
    if (meno.endsWith('.test.mjs')) continue;
    if (['.html', '.js', '.mjs', '.json', '.txt', '.xml', '.webmanifest'].includes(extname(meno).toLowerCase())) von.push(p);
  }
  return von;
}
const zdroje = zdrojeStranky().map((p) => ({ p: relative(TU, p), t: readFileSync(p, 'utf8') }));

/* Vsetko, co by prezradilo plateny subor: klucik, meno suboru a priecinok. */
function tajomstva() {
  const von = new Set(['issues/', 'bulletin/files/']);
  if (existsSync(MAPA)) {
    for (const [cislo, z] of Object.entries(citaj(MAPA))) {
      for (const f of ['eink', 'a4', 'letter']) {
        if (typeof z[f] === 'string' && z[f]) {
          von.add(z[f]);
          von.add('puzzle-post-' + cislo + '-' + f + '-' + z[f] + '.pdf');
        }
      }
    }
  }
  if (existsSync(CISLA)) {
    for (const z of Object.values(citaj(CISLA))) {
      for (const f of ['eink', 'a4', 'letter']) if (typeof z[f] === 'string') von.add(z[f].split('/').pop());
    }
  }
  if (existsSync(MAPA_BULLETIN)) {
    for (const t of Object.values(citaj(MAPA_BULLETIN))) for (const k of Object.values(t || {})) if (typeof k === 'string') von.add(k);
  }
  return [...von].filter(Boolean);
}

test('zdroj stranky nenesie ziadny klucik, meno ani priecinok platenych suborov', () => {
  const t = tajomstva();
  assert.ok(t.length > 3, 'mapa tajnych ciest sa nenacitala, test by nic nestrazil');
  assert.ok(zdroje.some((z) => z.p === 'app.js') && zdroje.some((z) => z.p === 'index.html'));
  for (const z of zdroje) {
    for (const s of t) assert.ok(!z.t.includes(s), z.p + ' prezradza ' + s);
  }
});

test('app.js nema ziadnu cestu k PDF okrem ziadnej', () => {
  // Jedine PDF, ktore stranka smie menovat, je ukazka zadarmo, a ta je v index.html.
  assert.deepEqual(app.match(/[\w./-]+\.pdf/g) || [], []);
  assert.doesNotMatch(app, /\bCISLO\s*=\s*\{/, 'mapa CISLO so subormi sa nema vratit');
  assert.doesNotMatch(app, /ukazPoPlatbe\(\{[^}]*\bdata\s*:/, 'panel nema dostat ziadne udaje o suboroch zo stranky');
});

test('odkazy na PDF v index.html vedu len na ukazku zadarmo', () => {
  const html = readFileSync(INDEX, 'utf8');
  const pdf = [...html.matchAll(/(?:href|src|content)="([^"]*\.pdf)"/g)].map((m) => m[1]);
  for (const u of pdf) assert.match(u, /Puzzle-Post-Sample\.pdf$/, 'index.html odkazuje na ' + u);
});

test('licencna sluzba pozna cislo, ktore stranka predava', () => {
  const id = (app.match(/const CISLO_ID = '([^']+)'/) || [])[1];
  assert.ok(id, 'app.js nema CISLO_ID');
  const kluc = id.replace(/^puzzle-post-/, '');
  assert.ok(citaj(CISLA)[kluc], 'puzzlepost_issues.json nema cislo ' + kluc);
  const zaznamy = Object.values(citaj(TITULY)).filter((z) => z.product === id);
  assert.ok(zaznamy.length >= 1, 'tituly.json nema ziadne price id pre ' + id + ' (node ops/stripe/tituly-json.mjs --zapis)');
  for (const z of zaznamy) assert.equal(z.files.length, 3, 'e-ink, A4 a US Letter');
});

test('stranka ma tlacidlo na jedno cislo s prazdnymi zastupkami odkazov', () => {
  const html = readFileSync(INDEX, 'utf8');
  const tagy = html.match(/<[a-zA-Z][^<>]*\sdata-titul="puzzle-post-2026-10"[^<>]*>/g) || [];
  assert.equal(tagy.length, 1);
  assert.match(tagy[0], /\sdata-link="[^"]*"/);
  assert.match(tagy[0], /\sdata-link-test="[^"]*"/);
});

test('tlacidla predplatneho ostali nedotknute a ziju', () => {
  const html = readFileSync(INDEX, 'utf8');
  for (const plan of ['mesacne', 'rocne']) {
    const tagy = html.match(new RegExp('<[a-zA-Z][^<>]*\\sdata-plan="' + plan + '"[^<>]*>', 'g')) || [];
    assert.equal(tagy.length, 1, plan + ': tlacidlo plánu musi byt prave raz');
    assert.match(tagy[0], /\sdata-link="https:\/\/buy\.stripe\.com\/[^"]+"/, plan + ': zivy odkaz sa nesmie stratit');
    assert.match(tagy[0], /\sdata-link-test="https:\/\/buy\.stripe\.com\/test_[^"]+"/, plan + ': testovy odkaz sa nesmie stratit');
  }
});
