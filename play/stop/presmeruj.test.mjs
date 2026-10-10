/* Testy presmerovania arling.sk/stop -> /play/stop/ (zadanie 167, časť B).
 * Prejsť smie len l (celé číslo 1 až 50) a parametre utm_*; nič iné. Výstup sa vždy začína /play/stop/
 * a parsuje sa späť na rovnaké hodnoty. Druhá časť spustí skutočný súbor ako v prehliadači (vm s falošným
 * location) a overí, že sa volá location.replace s tou istou adresou.
 * usage: node --test products/arling-sk/play/stop/presmeruj.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const SUBOR = fileURLToPath(new URL('./presmeruj.js', import.meta.url));
const { cielStop } = require(SUBOR);

/** Rozloží výstup a overí spoločné pravidlá: cesta /play/stop/, len povolené kľúče. */
function rozloz(vystup) {
  assert.ok(vystup.startsWith('/play/stop/'), `výstup sa nezačína /play/stop/: ${vystup}`);
  const u = new URL(vystup, 'https://arling.sk');
  assert.equal(u.origin, 'https://arling.sk', 'výstup nesmie viesť na inú doménu');
  assert.equal(u.pathname, '/play/stop/');
  assert.equal(u.hash, '');
  for (const k of u.searchParams.keys()) assert.ok(k === 'l' || /^utm_[A-Za-z0-9_]+$/.test(k), `nepovolený kľúč ${k}`);
  return u.searchParams;
}

test('bez parametrov ide na hru bez otáznika', () => {
  assert.equal(cielStop(''), '/play/stop/');
  assert.equal(cielStop('?'), '/play/stop/');
  assert.equal(cielStop(undefined), '/play/stop/');
  assert.equal(cielStop(null), '/play/stop/');
});

test('l: celé číslo 1 až 50 prejde, všetko ostatné sa vynechá', () => {
  assert.equal(cielStop('?l=1'), '/play/stop/?l=1');
  assert.equal(cielStop('?l=17'), '/play/stop/?l=17');
  assert.equal(cielStop('?l=50'), '/play/stop/?l=50');
  assert.equal(cielStop('?l=07'), '/play/stop/?l=7', 'úvodná nula sa normalizuje');
  for (const zle of ['0', '51', '-3', 'abc', '2.7', '', ' 5', '5 ', '1e1', '0x10', '+5', '50.0', '999', 'Infinity']) {
    assert.equal(cielStop('?l=' + encodeURIComponent(zle)), '/play/stop/', `l=${JSON.stringify(zle)} mal byť vynechaný`);
  }
  assert.equal(cielStop('?l=0&utm_source=youtube'), '/play/stop/?utm_source=youtube', 'zlé l nezhodí utm');
});

test('utm s diakritikou prejde a parsuje sa späť na rovnaké hodnoty', () => {
  const vstup = new URLSearchParams({ l: '28', utm_source: 'youtube', utm_campaign: 'slučky-október', utm_content: 'Žltý kôň ľadový' });
  const p = rozloz(cielStop('?' + vstup.toString()));
  assert.equal(p.get('l'), '28');
  assert.equal(p.get('utm_source'), 'youtube');
  assert.equal(p.get('utm_campaign'), 'slučky-október');
  assert.equal(p.get('utm_content'), 'Žltý kôň ľadový');
});

test('utm so znakmi < " & \' a medzerami sa zakóduje, nič neunikne surové', () => {
  const zle = '<script>alert("x")</script> & \'a\' b=c#d';
  const vstup = new URLSearchParams();
  vstup.set('utm_content', zle);
  vstup.set('utm_medium', 'short video');
  const vystup = cielStop('?' + vstup.toString());
  assert.doesNotMatch(vystup, /[<>"' #]/, `surový znak vo výstupe: ${vystup}`);
  assert.equal((vystup.match(/&/g) || []).length, 1, 'jediný & je oddeľovač dvoch parametrov');
  const p = rozloz(vystup);
  assert.equal(p.get('utm_content'), zle);
  assert.equal(p.get('utm_medium'), 'short video');
});

test('nepovolené parametre sa zahodia (x, javascript:, next, utm bez mena, cudzí prefix)', () => {
  const vstup = new URLSearchParams();
  vstup.append('x', '1');
  vstup.append('javascript:alert(1)', '1');
  vstup.append('next', 'https://evil.example/');
  vstup.append('utm_', 'prazdne meno');
  vstup.append('UTM_SOURCE', 'velke');
  vstup.append('xutm_source', 'cudzi');
  vstup.append('utm_source<x>', 'zle meno');
  vstup.append('fbclid', 'abc');
  vstup.append('utm_source', 'youtube');
  const vystup = cielStop('?' + vstup.toString());
  assert.equal(vystup, '/play/stop/?utm_source=youtube');
  assert.equal(cielStop('?javascript:alert(1)'), '/play/stop/');
  assert.equal(cielStop('?x=1'), '/play/stop/');
});

test('opakované utm ostanú všetky v poradí', () => {
  const p = rozloz(cielStop('?utm_source=youtube&utm_source=shorts&l=5&utm_term=a&utm_term=b'));
  assert.deepEqual(p.getAll('utm_source'), ['youtube', 'shorts']);
  assert.deepEqual(p.getAll('utm_term'), ['a', 'b']);
  assert.deepEqual(p.getAll('l'), ['5']);
});

test('opakované l: platí prvé, ako doteraz', () => {
  assert.equal(cielStop('?l=3&l=9'), '/play/stop/?l=3');
  assert.equal(cielStop('?l=abc&l=9'), '/play/stop/');
});

test('vlastné utm_* (utm_id, utm_source_platform) prejdú', () => {
  const p = rozloz(cielStop('?utm_id=42&utm_source_platform=youtube'));
  assert.equal(p.get('utm_id'), '42');
  assert.equal(p.get('utm_source_platform'), 'youtube');
});

/** Spustí presmeruj.js ako klasický skript v prehliadači (bez module) a vráti adresu z location.replace. */
function vPrehliadaci(search, bezUsp = false) {
  const volania = [];
  const kontext = { location: { search, replace: (u) => volania.push(u) } };
  if (!bezUsp) kontext.URLSearchParams = URLSearchParams;
  kontext.globalThis = kontext;
  vm.runInNewContext(readFileSync(SUBOR, 'utf8'), kontext, { filename: 'presmeruj.js' });
  return volania;
}

test('v prehliadači volá location.replace práve raz s rovnakou adresou ako cielStop', () => {
  for (const s of ['', '?l=17', '?l=51&utm_source=youtube&utm_medium=shorts', '?utm_content=%3Cb%3E%22%26', '?x=1&l=2.7']) {
    assert.deepEqual(vPrehliadaci(s), [cielStop(s)], `search ${s}`);
  }
});

test('v prehliadači bez URLSearchParams ide na hru bez parametrov (zlyhanie zatvára)', () => {
  assert.deepEqual(vPrehliadaci('?l=5&utm_source=youtube', true), ['/play/stop/']);
});

test('stránka /stop/: JS presmerovanie beží prvé, meta refresh je len v noscript', () => {
  const html = readFileSync(fileURLToPath(new URL('../../stop/index.html', import.meta.url)), 'utf8');
  const skript = html.indexOf('<script src="/play/stop/presmeruj.js"></script>');
  assert.ok(skript > 0, 'chýba skript presmerovania');
  const noscript = html.match(/<noscript>([\s\S]*?)<\/noscript>/);
  assert.ok(noscript && /http-equiv="refresh"/.test(noscript[1]), 'meta refresh má byť v noscript ako záloha bez JS');
  const mimo = html.replace(/<noscript>[\s\S]*?<\/noscript>/g, '');
  assert.doesNotMatch(mimo, /http-equiv="refresh"/, 'meta refresh mimo noscript by zahodil UTM');
  assert.ok(html.indexOf('<noscript>') > skript, 'noscript až za skriptom');
  assert.match(html, /script-src 'self'/, 'CSP stránky ostáva bez inline skriptov');
  assert.doesNotMatch(html, /[\u2013\u2014]/, 'bez pomlčiek em a en');
});
