/* Testy cistych funkcii z titul.js (jednorazovy predaj titulu na hube).
 * Funkcie s DOM sa tu testuju cez dvojnika document, preto sa titul.js pri
 * importe niceho z prehliadaca nedotyka; to je aj dovod, preco nastav() nic
 * nespusta sam.
 * usage: node --test products/arling-sk/titul.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  zakladnaSuma, posudPlatbu, stavZoZaznamu, cestaSuboru, platnyOdkaz, titulZDotazu,
  cisloObjednavky, velkostSuboru, platnaAdresaSuboru, suboryZoSluzby, suboryZoStranky,
  odkazyZoSluzby, zdrojSuborov, vykresliPanel, LICENCIE, PANEL,
} from './titul.js';

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
  assert.deepEqual(stavZoZaznamu(null), { tituly: {}, sessions: {}, test: false });
  assert.deepEqual(stavZoZaznamu('nie je json'), { tituly: {}, sessions: {}, test: false });
  assert.deepEqual(stavZoZaznamu('{"tituly":{"ben-hur":true,"x":false},"test":true}'),
    { tituly: { 'ben-hur': true }, sessions: {}, test: true });
  assert.deepEqual(stavZoZaznamu({ tituly: { 'morning-quiet': 1 } }),
    { tituly: { 'morning-quiet': true }, sessions: {}, test: false });
});

test('session sa pamata len k odomknutemu titulu', () => {
  const z = stavZoZaznamu({ tituly: { 'ben-hur': true }, sessions: { 'ben-hur': 'cs_test_a1b2c3d4e5f6', 'monte-cristo': 'cs_x' } });
  assert.deepEqual(z.sessions, { 'ben-hur': 'cs_test_a1b2c3d4e5f6' }, 'cudzi titul si session nenesie');
  assert.deepEqual(stavZoZaznamu({ tituly: { 'ben-hur': true }, sessions: { 'ben-hur': 7 } }).sessions, {});
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

/* ── Drobnosti panela ──────────────────────────────────────────────────── */

test('cislo objednavky je poslednych osem znakov session', () => {
  assert.equal(cisloObjednavky('cs_test_a1b2c3d4e5f6g7h8'), 'e5f6g7h8');
  assert.equal(cisloObjednavky('krátke'), 'krátke');
  assert.equal(cisloObjednavky(''), '');
  assert.equal(cisloObjednavky(null), '');
});

test('velkost suboru sa pise tak, ako ju clovek cita', () => {
  assert.equal(velkostSuboru(5609062), '5.35 MB');
  assert.equal(velkostSuboru(240000), '234 KB');
  assert.equal(velkostSuboru(0), '');
  assert.equal(velkostSuboru('nie cislo'), '');
  assert.equal(velkostSuboru(undefined), '');
});

test('odkaz na subor smie viest len k nam', () => {
  assert.equal(platnaAdresaSuboru('https://homelab.tailbf8f27.ts.net/licence/api/file/abc'),
    'https://homelab.tailbf8f27.ts.net/licence/api/file/abc');
  assert.equal(platnaAdresaSuboru('https://arling.sk/classics/ben-hur/files/x.pdf'), 'https://arling.sk/classics/ben-hur/files/x.pdf');
  assert.equal(platnaAdresaSuboru('files/abcdefgh12345678/Ben-Hur-eink.pdf'), 'files/abcdefgh12345678/Ben-Hur-eink.pdf');
  assert.equal(platnaAdresaSuboru('https://example.com/x.pdf'), '', 'cudzia domena nie');
  assert.equal(platnaAdresaSuboru('http://homelab.tailbf8f27.ts.net/x.pdf'), '', 'len https');
  assert.equal(platnaAdresaSuboru('javascript:alert(1)'), '');
  assert.equal(platnaAdresaSuboru('//example.com/x.pdf'), '');
  assert.equal(platnaAdresaSuboru(''), '');
});

test('subory z odpovede sluzby: len ok:true a len pouzitelne odkazy', () => {
  const odpoved = {
    ok: true,
    product: 'ben-hur',
    files: [
      { label: 'e-ink PDF, 157 x 210 mm', url: 'https://homelab.tailbf8f27.ts.net/licence/api/file/1', bytes: 5609062 },
      { label: 'A4 PDF', url: 'https://zly.example/2.pdf', bytes: 10 },
      null,
    ],
  };
  const s = suboryZoSluzby(odpoved);
  assert.equal(s.length, 1, 'cudzia domena von');
  assert.equal(s[0].nazov, 'e-ink PDF, 157 x 210 mm');
  assert.equal(s[0].velkost, '5.35 MB');
  assert.deepEqual(suboryZoSluzby({ ok: false, reason: 'unpaid' }), []);
  assert.deepEqual(suboryZoSluzby({ ok: true, files: [] }), []);
  assert.deepEqual(suboryZoSluzby(null), []);
});

test('subory zo stranky si velkost vytiahnu z popisu', () => {
  const data = { cesta: 'files/abcdefgh12345678/', subory: [
    { file: 'Ben-Hur-eink.pdf', format: 'eink', nazov: 'e-ink PDF, 157 x 210 mm', popis: '953 pages, 5.35 MB' },
  ] };
  const s = suboryZoStranky(data);
  assert.equal(s.length, 1);
  assert.equal(s[0].href, 'files/abcdefgh12345678/Ben-Hur-eink.pdf');
  assert.equal(s[0].velkost, '5.35 MB');
  assert.equal(s[0].popis, '953 pages');
  assert.equal(suboryZoStranky({ cesta: '', subory: [{ file: 'x.pdf' }] })[0].href, '', 'bez tajnej cesty nie je odkaz');
  assert.deepEqual(suboryZoStranky(null), []);
});

/* ── Najprv sluzba, potom stranka ──────────────────────────────────────── */

const DATA = { titul: 'ben-hur', cesta: 'files/abcdefgh12345678/', subory: [
  { file: 'Ben-Hur-eink.pdf', format: 'eink', nazov: 'e-ink PDF, 157 x 210 mm', popis: '953 pages, 5.35 MB' },
  { file: 'Ben-Hur-A4.pdf', format: 'a4', nazov: 'A4 PDF', popis: '953 pages, 5.36 MB' },
] };

function fetchDvojnik(odpoved, { ok = true, hodVynimku = false } = {}) {
  const volania = [];
  const f = async (url) => {
    volania.push(url);
    if (hodVynimku) throw new Error('siet');
    return { ok, json: async () => odpoved };
  };
  f.volania = volania;
  return f;
}

test('odkazy zo sluzby: dotaz ide na koncovy bod licencnej sluzby', async () => {
  const f = fetchDvojnik({ ok: true, product: 'ben-hur', email: 'kto@example.com', week: '2026-W39',
    files: [{ label: 'e-ink PDF', url: 'https://homelab.tailbf8f27.ts.net/licence/api/file/1', bytes: 5609062 }] });
  const zo = await odkazyZoSluzby('cs_test_123456789012', { fetch: f });
  assert.equal(f.volania[0], LICENCIE + '/purchase/links?session_id=cs_test_123456789012');
  assert.equal(zo.subory.length, 1);
  assert.equal(zo.email, 'kto@example.com');
  assert.equal(zo.tyzden, '2026-W39');
});

test('najprv sluzba: ked odpovie, subory su jej', async () => {
  const f = fetchDvojnik({ ok: true, email: 'kto@example.com',
    files: [{ label: 'e-ink PDF', url: 'https://homelab.tailbf8f27.ts.net/licence/api/file/1', bytes: 5609062 }] });
  const z = await zdrojSuborov('cs_1', DATA, { fetch: f });
  assert.equal(z.zdroj, 'sluzba');
  assert.equal(z.subory.length, 1);
  assert.equal(z.email, 'kto@example.com');
});

test('potom stranka: ok:false, chyba HTTP, vynimka aj chybajuci fetch koncia na bloku titul-data', async () => {
  const pady = [
    await zdrojSuborov('cs_1', DATA, { fetch: fetchDvojnik({ ok: false, reason: 'test-disabled' }) }),
    await zdrojSuborov('cs_1', DATA, { fetch: fetchDvojnik({ ok: true, files: [] }, { ok: false }) }),
    await zdrojSuborov('cs_1', DATA, { fetch: fetchDvojnik(null, { hodVynimku: true }) }),
    await zdrojSuborov('cs_1', DATA, { fetch: null }),
    await zdrojSuborov('', DATA, { fetch: fetchDvojnik({ ok: true, files: [] }) }),
  ];
  for (const z of pady) {
    assert.equal(z.zdroj, 'stranka');
    assert.equal(z.subory.length, 2);
    assert.equal(z.subory[0].href, 'files/abcdefgh12345678/Ben-Hur-eink.pdf');
    assert.equal(z.email, '', 'e-mail pozna len sluzba');
  }
});

/* ── Panel po zaplateni ────────────────────────────────────────────────── */

function fakeDom() {
  const novy = (tag) => ({
    tag, deti: [], atr: {}, dataset: {}, className: '', textContent: '', hidden: true,
    setAttribute(k, v) { this.atr[k] = String(v); },
    removeAttribute(k) { delete this.atr[k]; },
    appendChild(d) { this.deti.push(d); return d; },
  });
  globalThis.document = { createElement: novy, createTextNode: (t) => ({ tag: '#text', deti: [], textContent: String(t) }) };
  return { novy };
}
function text(prvok) {
  if (!prvok) return '';
  return (prvok.textContent || '') + prvok.deti.map(text).join('');
}
function najdi(prvok, trieda) {
  if (!prvok) return null;
  if (prvok.className === trieda || String(prvok.className || '').split(' ').includes(trieda)) return prvok;
  for (const d of prvok.deti) { const n = najdi(d, trieda); if (n) return n; }
  return null;
}

test('panel po zaplateni: nadpis, tlacidlo na kazdy subor, e-mail a cislo objednavky', () => {
  const { novy } = fakeDom();
  const koren = novy('div');
  vykresliPanel(koren, {
    subory: [
      { nazov: 'e-ink PDF, 157 x 210 mm', href: 'files/abcdefgh12345678/Ben-Hur-eink.pdf', velkost: '5.35 MB', popis: '953 pages', format: 'eink' },
      { nazov: 'A4 PDF', href: 'files/abcdefgh12345678/Ben-Hur-A4.pdf', velkost: '5.36 MB', popis: '953 pages' },
    ],
    email: 'kto@example.com',
    session: 'cs_test_a1b2c3d4e5f6g7h8',
    ukazka: { href: 'Ben-Hur-Sample-eink.pdf', text: 'Free sample' },
  });
  assert.equal(koren.hidden, false, 'panel sa ukaze');
  assert.equal(koren.className, 'hotovo hotovo-panel');
  assert.equal(text(najdi(koren, 'hotovo-znacka')), PANEL.znacka);
  assert.equal(text(najdi(koren, 'hotovo-nadpis')), 'Your files');
  const zoznam = najdi(koren, 'hotovo-subory');
  assert.equal(zoznam.deti.length, 2);
  const a = zoznam.deti[0].deti[0];
  assert.ok(String(a.className).includes('btn-solid'), 'kazdy subor je plne tlacidlo');
  assert.equal(a.atr.href, 'files/abcdefgh12345678/Ben-Hur-eink.pdf');
  assert.ok('download' in a.atr);
  assert.equal(a.dataset.format, 'eink');
  assert.equal(text(najdi(a, 'subor-nazov')), 'Download e-ink PDF, 157 x 210 mm');
  assert.equal(text(najdi(a, 'subor-meta')), '5.35 MB · 953 pages');
  assert.equal(text(najdi(koren, 'hotovo-ukazka')), 'Free sample');
  assert.equal(text(najdi(koren, 'hotovo-mail')), PANEL.mailPred + 'kto@example.com.');
  assert.equal(text(najdi(koren, 'hotovo-cislo')), 'Order e5f6g7h8');
  assert.equal(najdi(koren, 'hotovo-riadok'), null, 've zivom rezime ziadna poznamka o teste');
  delete globalThis.document;
});

test('panel bez e-mailu zo sluzby povie, kam sa subory poslali', () => {
  const { novy } = fakeDom();
  const koren = novy('div');
  vykresliPanel(koren, { subory: [{ nazov: 'A4 PDF', href: 'files/x/a.pdf' }], session: '' });
  assert.equal(text(najdi(koren, 'hotovo-mail')), PANEL.mailPred + PANEL.mailBez + '.');
  assert.equal(najdi(koren, 'hotovo-cislo'), null, 'bez session ziadne cislo objednavky');
  delete globalThis.document;
});

test('panel v testovom rezime ma poznamku o teste a vlastny nadpis', () => {
  const { novy } = fakeDom();
  const koren = novy('div');
  vykresliPanel(koren, { subory: [{ nazov: 'A4 PDF', href: 'a.pdf' }], test: true, nadpis: 'Your first sheet', poznamka: 'The files of week 2026-W39.' });
  assert.equal(text(najdi(koren, 'hotovo-nadpis')), 'Your first sheet');
  const riadky = koren.deti.filter((d) => d.className === 'hotovo-riadok');
  assert.equal(riadky.length, 2);
  assert.equal(text(riadky[0]), PANEL.test);
  assert.ok(!PANEL.test.includes('nothing is ordered'), 'vetu o neobjednani sme zrusili');
  assert.equal(text(riadky[1]), 'The files of week 2026-W39.');
  delete globalThis.document;
});

test('bez tajnej cesty sa odkaz nevyrobi a panel povie, co robit', () => {
  const { novy } = fakeDom();
  const koren = novy('div');
  vykresliPanel(koren, { subory: suboryZoStranky({ cesta: '', subory: [{ file: 'Ben-Hur-eink.pdf', nazov: 'e-ink PDF' }] }), session: 'cs_1234567890' });
  assert.equal(najdi(koren, 'hotovo-subory'), null, 'ziadny mrtvy odkaz');
  assert.equal(text(najdi(koren, 'hotovo-riadok')), PANEL.bezCesty);
  delete globalThis.document;
});
