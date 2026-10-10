import test from 'node:test';
import assert from 'node:assert/strict';
import { adresaUrovne } from './adresa.js';

const Z = 'https://arling.sk/play/stop/?l=3&utm_source=youtube&utm_medium=shorts&utm_content=abc';

test('prvé načítanie adresu nemení, ani bez l (inak druhá návšteva v trackeri)', () => {
  assert.equal(adresaUrovne(Z, 3, true), Z);
  const bezL = 'https://arling.sk/play/stop/?utm_source=youtube&utm_medium=shorts&utm_campaign=stop-kratka-l32';
  assert.equal(adresaUrovne(bezL, 1, true), bezL);
});

test('zmena úrovne zmaže všetky utm_*, aby sa divák nezarátal znova', () => {
  const u = new URL(adresaUrovne(Z, 4));
  assert.equal(u.searchParams.get('l'), '4');
  assert.equal([...u.searchParams.keys()].filter((k) => k.startsWith('utm_')).length, 0);
});

test('iné parametre ostanú, adresa bez utm sa nezmení okrem úrovne', () => {
  assert.equal(adresaUrovne('https://arling.sk/play/stop/?l=1&x=2', 2), 'https://arling.sk/play/stop/?l=2&x=2');
});

test('hra.js volá adresaUrovne a prvé načítanie s prve = true (brána pokus 2, N3)', async () => {
  const { readFileSync } = await import('node:fs');
  const hra = readFileSync(new URL('./hra.js', import.meta.url), 'utf8');
  assert.match(hra, /history\.replaceState\(null, '', adresaUrovne\(location\.href, n, prve\)\)/);
  assert.match(hra, /nacitaj\(n, true\)/);
  assert.match(hra, /function nacitaj\(k, prve = false\)/);
  assert.doesNotMatch(hra, /searchParams\.set\('l'/);
});
