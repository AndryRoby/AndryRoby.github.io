/* Nazvy suborov cisla su v app.js kopiou ops/puzzlepost/tajne-cesty.json.
 * Kopia sa rozide potichu a chyba sa ukaze az 404-kou po zaplateni, preto to
 * kontroluje test: nazvy musia sediet s mapou aj so subormi na disku.
 * usage: node --test products/arling-sk/puzzle-post/cislo.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const TU = dirname(fileURLToPath(import.meta.url));
const KOREN = resolve(TU, '../../..');
const APP = join(TU, 'app.js');
const MAPA = join(KOREN, 'ops/puzzlepost/tajne-cesty.json');
const PRIECINOK = join(TU, 'issues');

const app = readFileSync(APP, 'utf8');
const nazvyVApp = [...app.matchAll(/file: '([^']+\.pdf)'/g)].map((m) => m[1]);

test('app.js pozna prave tri subory cisla', () => {
  assert.equal(nazvyVApp.length, 3, 'e-ink, A4 a US Letter');
  assert.equal(new Set(nazvyVApp).size, 3);
});

test('nazvy suborov sedia s mapou tajnych ciest', () => {
  const mapa = JSON.parse(readFileSync(MAPA, 'utf8'));
  const cislo = '2026-10';
  assert.ok(mapa[cislo], 'v mape chyba cislo ' + cislo);
  for (const format of ['eink', 'a4', 'letter']) {
    const klucik = mapa[cislo][format];
    assert.match(klucik, /^[a-z0-9]{16}$/, format + ': klucik nema 16 znakov');
    const caka = 'puzzle-post-' + cislo + '-' + format + '-' + klucik + '.pdf';
    assert.ok(nazvyVApp.includes(caka), 'app.js nema ' + caka);
  }
});

test('subory naozaj lezia v priecinku cisel na hube', () => {
  for (const n of nazvyVApp) assert.ok(existsSync(join(PRIECINOK, n)), 'chyba subor ' + n);
});

test('stranka ma tlacidlo na jedno cislo s prazdnymi zastupkami odkazov', () => {
  const html = readFileSync(join(TU, 'index.html'), 'utf8');
  const tagy = html.match(/<[a-zA-Z][^<>]*\sdata-titul="puzzle-post-2026-10"[^<>]*>/g) || [];
  assert.equal(tagy.length, 1);
  assert.match(tagy[0], /\sdata-link="[^"]*"/);
  assert.match(tagy[0], /\sdata-link-test="[^"]*"/);
});

test('tlacidla predplatneho ostali nedotknute a ziju', () => {
  const html = readFileSync(join(TU, 'index.html'), 'utf8');
  for (const plan of ['mesacne', 'rocne']) {
    const tagy = html.match(new RegExp('<[a-zA-Z][^<>]*\\sdata-plan="' + plan + '"[^<>]*>', 'g')) || [];
    assert.equal(tagy.length, 1, plan + ': tlacidlo plánu musi byt prave raz');
    assert.match(tagy[0], /\sdata-link="https:\/\/buy\.stripe\.com\/[^"]+"/, plan + ': zivy odkaz sa nesmie stratit');
    assert.match(tagy[0], /\sdata-link-test="https:\/\/buy\.stripe\.com\/test_[^"]+"/, plan + ': testovy odkaz sa nesmie stratit');
  }
});
