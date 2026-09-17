/* Testy cistych funkcii z titul.js (jednorazovy predaj titulu na hube).
 * Funkcie s DOM sa tu netestuju, preto sa titul.js pri importe niceho z
 * prehliadaca nedotyka; to je aj dovod, preco nastav() nic nespusta sam.
 * usage: node --test products/arling-sk/titul.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zakladnaSuma, posudPlatbu, stavZoZaznamu, cestaSuboru, platnyOdkaz, titulZDotazu } from './titul.js';

test('zakladna suma je suma pred zlavovym kodom', () => {
  assert.equal(zakladnaSuma({ amount_subtotal: 490, amount_total: 390 }), 490);
  assert.equal(zakladnaSuma({ amount_total: 490 }), 490, 'starsi worker posiela len amount_total');
  assert.equal(zakladnaSuma({}), null);
  assert.equal(zakladnaSuma(null), null);
});

test('zaplatene je len jasne zaplatene na dost vysoku sumu', () => {
  assert.equal(posudPlatbu({ paid: true, amount_subtotal: 490, livemode: true }, 490).stav, 'zaplatene');
  assert.equal(posudPlatbu({ paid: true, amount_subtotal: 990, livemode: true }, 490).stav, 'zaplatene');
  assert.equal(posudPlatbu({ paid: true, amount_subtotal: 390, livemode: true }, 490).stav, 'inaSuma');
  assert.equal(posudPlatbu({ paid: true, livemode: true }, 490).stav, 'inaSuma');
  assert.equal(posudPlatbu({ paid: false }, 490).stav, 'caka');
  assert.equal(posudPlatbu(null, 490).stav, 'caka');
});

test('testovy nakup je oznaceny podla livemode', () => {
  assert.equal(posudPlatbu({ paid: true, amount_subtotal: 490, livemode: false }, 490).test, true);
  assert.equal(posudPlatbu({ paid: true, amount_subtotal: 490, livemode: true }, 490).test, false);
});

test('zaznam o odomknuti prezije aj poskodeny obsah uloziska', () => {
  assert.deepEqual(stavZoZaznamu(null), { tituly: {}, test: false });
  assert.deepEqual(stavZoZaznamu('nie je json'), { tituly: {}, test: false });
  assert.deepEqual(stavZoZaznamu('{"tituly":{"ben-hur":true,"x":false},"test":true}'), { tituly: { 'ben-hur': true }, test: true });
  assert.deepEqual(stavZoZaznamu({ tituly: { 'morning-quiet': 1 } }), { tituly: { 'morning-quiet': true }, test: false });
});

test('cesta k suboru je prazdna, kym nie je dosadena tajna cesta', () => {
  assert.equal(cestaSuboru({ cesta: '' }, 'Ben-Hur-eink.pdf'), '');
  assert.equal(cestaSuboru({}, 'Ben-Hur-eink.pdf'), '');
  assert.equal(cestaSuboru({ cesta: 'files/abcdefgh12345678' }, 'Ben-Hur-eink.pdf'), 'files/abcdefgh12345678/Ben-Hur-eink.pdf');
  assert.equal(cestaSuboru({ cesta: 'files/abcdefgh12345678/' }, 'Ben-Hur-eink.pdf'), 'files/abcdefgh12345678/Ben-Hur-eink.pdf');
  assert.equal(cestaSuboru({ cesta: 'files/abcdefgh12345678/' }, ''), '');
});

test('na Stripe sa ide len cez odkaz Stripe', () => {
  assert.equal(platnyOdkaz('https://buy.stripe.com/abc'), 'https://buy.stripe.com/abc');
  assert.equal(platnyOdkaz('https://buy.stripe.com/test_abc'), 'https://buy.stripe.com/test_abc');
  assert.equal(platnyOdkaz(''), '');
  assert.equal(platnyOdkaz('{odkaz}'), '');
  assert.equal(platnyOdkaz('javascript:alert(1)'), '');
  assert.equal(platnyOdkaz('https://example.com/'), '');
});

test('cudzi titul v adrese sa neprijme', () => {
  assert.equal(titulZDotazu('ben-hur', 'ben-hur'), 'ben-hur');
  assert.equal(titulZDotazu('monte-cristo', 'ben-hur'), '');
  assert.equal(titulZDotazu('', 'ben-hur'), '');
  assert.equal(titulZDotazu(null, 'ben-hur'), '');
});

/* Vykreslenie odkazov po zaplateni sa da overit aj bez prehliadaca: staci
   nahradit document.createElement dvojnikom, ktory si pamata, co dostal.
   Kontroluje sa to, na com zalezi: adresa suboru sa stavia az tu a bez tajnej
   cesty z nej nevznikne odkaz. */
function fakeDom() {
  const prvky = [];
  const novy = (tag) => {
    const p = { tag, deti: [], atr: {}, dataset: {}, textContent: '',
      setAttribute(k, v) { this.atr[k] = String(v); },
      removeAttribute(k) { delete this.atr[k]; },
      appendChild(d) { this.deti.push(d); return d; } };
    prvky.push(p);
    return p;
  };
  globalThis.document = { createElement: novy };
  return { prvky, novy };
}

test('po odomknuti sa odkazy postavia z tajnej cesty', async () => {
  const { novy } = fakeDom();
  const { vykresliSubory } = await import('./titul.js');
  const ul = novy('ul');
  const koren = { querySelector: (s) => (s === 'ul' ? ul : null) };
  const data = { cesta: 'files/abcdefgh12345678/', subory: [
    { file: 'Ben-Hur-eink.pdf', format: 'eink', nazov: 'e-ink PDF, 157 x 210 mm', popis: '948 pages, 7.3 MB' },
    { file: 'Ben-Hur-A4.pdf', format: 'a4', nazov: 'A4 PDF', popis: '948 pages, 7.31 MB' },
  ] };
  vykresliSubory(koren, data);
  assert.equal(ul.deti.length, 2);
  const a = ul.deti[0].deti[0];
  assert.equal(a.atr.href, 'files/abcdefgh12345678/Ben-Hur-eink.pdf');
  assert.equal(a.textContent, 'e-ink PDF, 157 x 210 mm');
  assert.equal(a.dataset.format, 'eink');
  assert.ok('download' in a.atr);
  delete globalThis.document;
});

test('bez tajnej cesty sa odkaz nevyrobi a nic sa nestahuje', async () => {
  const { novy } = fakeDom();
  const { vykresliSubory } = await import('./titul.js');
  const ul = novy('ul');
  const koren = { querySelector: (s) => (s === 'ul' ? ul : null) };
  vykresliSubory(koren, { cesta: '', subory: [{ file: 'Ben-Hur-eink.pdf', format: 'eink', nazov: 'e-ink PDF' }] });
  const a = ul.deti[0].deti[0];
  assert.equal(a.atr.href, '#');
  assert.equal(a.atr['aria-disabled'], 'true');
  assert.ok(!('download' in a.atr));
  delete globalThis.document;
});
