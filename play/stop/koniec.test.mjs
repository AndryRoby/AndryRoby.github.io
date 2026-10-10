/* Koniec kola v hre Stop vedie na cenu (zadanie 167, časť C): statická kontrola index.html, hra.js a ceny.
 * Cena knihy na obrazovke výsledku sa musí zhodovať s cenou na /puzzle-books/; keď sa tam zmení, test padne.
 * usage: node --test products/arling-sk/play/stop/koniec.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const citaj = (cesta) => readFileSync(fileURLToPath(new URL(cesta, import.meta.url)), 'utf8');
const html = citaj('./index.html');
const hra = citaj('./hra.js');
const knihy = citaj('../../puzzle-books/index.html');
const blok = (html.match(/<div class="stop-dalej" id="stop-dalej" hidden>([\s\S]*?)<\/div>/) || [])[1] || '';

test('blok je skrytý, mimo aria-live a až za hlavnými tlačidlami hry', () => {
  assert.ok(blok, 'chýba #stop-dalej s atribútom hidden');
  const iBlok = html.indexOf('id="stop-dalej"');
  for (const id of ['stop-znova', 'stop-dalsia', 'stop-zdielaj', 'stop-zvuk']) assert.ok(html.indexOf(`id="${id}"`) < iBlok, `${id} má byť pred blokom`);
  const ovl = html.match(/<div class="stop-ovl" aria-live="polite">[\s\S]*?<p class="stop-skore"/)[0];
  assert.doesNotMatch(ovl, /stop-dalej/, 'blok nesmie byť v aria-live oblasti');
  assert.doesNotMatch(blok, /style=|<script|onclick=/i, 'žiadny inline štýl ani skript (CSP)');
});

test('odkaz na knihy: cena zo stránky /puzzle-books/, UTM a udalosť stop_kniha', () => {
  const cena = (knihy.match(/Buy for ([0-9.]+) &euro;/) || [])[1];
  assert.equal(cena, '4.90', 'cena jednej knihy na /puzzle-books/');
  assert.match(knihy, /"price": "4\.90"/);
  const a = blok.match(/<a [^>]*data-umami-event="stop_kniha"[^>]*>([\s\S]*?)<\/a>/);
  assert.ok(a, 'chýba odkaz stop_kniha');
  // 10. 10. 2026 (brána yt-cesta, W1): bez interného UTM, aby neprebilo zdroj youtube; klik meria udalosť stop_kniha
  assert.match(a[0], /href="\/puzzle-books\/"/);
  assert.match(a[1], new RegExp(`^Puzzle books on arling\\.sk, ${cena.replace('.', '\\.')}&nbsp;&euro; each<svg`));
  assert.match(blok, new RegExp(`for ${cena.replace('.', '\\.')}&nbsp;&euro;`), 'veta uvádza tú istú cenu');
  assert.match(knihy, /100 puzzles/, 'veta tvrdí 100 hlavolamov v knihe');
});

test('odkaz na Prism 5: Google Play, referrer UTM ako na /play/, rel noopener, udalosť stop_play', () => {
  const a = blok.match(/<a [^>]*data-umami-event="stop_play"[^>]*>([\s\S]*?)<\/a>/);
  assert.ok(a, 'chýba odkaz stop_play');
  assert.match(a[0], /href="https:\/\/play\.google\.com\/store\/apps\/details\?id=sk\.arling\.prism5&amp;referrer=utm_source%3Darling\.sk%26utm_medium%3Dstop%26utm_campaign%3Dprism5%26utm_content%3Dstop-koniec"/);
  assert.match(a[0], /rel="noopener"/);
  assert.match(a[0], /data-umami-event-appka="prism5"/);
  assert.match(a[1], /^Prism 5 on Google Play<svg/);
  const play = citaj('../index.html');
  assert.match(play, /id=sk\.arling\.prism5&amp;referrer=utm_source%3Darling\.sk%26utm_medium%3Dhub%26utm_campaign%3Dprism5%26utm_content%3Dplay-hub/, 'tvar referrera na /play/ sa nezmenil');
});

test('hra.js ukáže blok pri výsledku a skryje ho pri ďalšom kole', () => {
  assert.match(hra, /el\.vysledok\.hidden = false; ukazDalej\(true\)/);
  assert.match(hra, /el\.vysledok\.hidden = true; ukazDalej\(false\)/);
  assert.match(html, /\/play\/stop\/hra\.js\?v=3/);
  assert.match(html, /\/play\/stop\/stop\.css\?v=3/);
});

test('bez pomlčiek em a en v súboroch hry', () => {
  for (const [meno, text] of [['index.html', html], ['hra.js', hra], ['stop.css', citaj('./stop.css')]]) {
    assert.doesNotMatch(text, /[\u2013\u2014]/, meno);
  }
});
