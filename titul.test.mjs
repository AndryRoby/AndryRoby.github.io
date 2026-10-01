/* Testy cistych funkcii z titul.js (jednorazovy predaj titulu na hube).
 * Funkcie s DOM sa tu testuju cez dvojnika document, preto sa titul.js pri
 * importe niceho z prehliadaca nedotyka; to je aj dovod, preco nastav() nic
 * nespusta sam.
 * usage: node --test products/arling-sk/titul.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as titul from './titul.js';
import {
  zakladnaSuma, posudPlatbu, stavZoZaznamu, platnyOdkaz, titulZDotazu,
  cisloObjednavky, velkostSuboru, platnaAdresaSuboru, suboryZoSluzby,
  odkazyZoSluzby, zdrojSuborov, vykresliPanel, ukazPoPlatbe, LICENCIE, PANEL,
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

/* 24. 9. 2026: platene subory lezali verejne a cesta k nim stala v bloku titul-data.
   Stranka uz z bloku ziadny odkaz nevyraba; tieto funkcie zmizli a vratit sa nemaju. */
test('stranka uz nevie vyrobit odkaz na subor z bloku titul-data', () => {
  assert.equal('cestaSuboru' in titul, false);
  assert.equal('suboryZoStranky' in titul, false);
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
  assert.equal(platnaAdresaSuboru('https://api.arling.workers.dev/licence/api/file/abc'),
    'https://api.arling.workers.dev/licence/api/file/abc');
  assert.equal(platnaAdresaSuboru('https://arling.sk/classics/ben-hur/files/x.pdf'), 'https://arling.sk/classics/ben-hur/files/x.pdf');
  assert.equal(platnaAdresaSuboru('files/abcdefgh12345678/Ben-Hur-eink.pdf'), 'files/abcdefgh12345678/Ben-Hur-eink.pdf');
  // Od 27. 9. 2026 dáva licenčná služba odkazy cez Worker files.arling.workers.dev (ops/workers/files).
  const worker = 'https://files.arling.workers.dev/download?p=detective-kit&f=a4.pdf&exp=1790208000&sig=' + 'b'.repeat(64);
  assert.equal(platnaAdresaSuboru(worker), worker);
  assert.equal(platnaAdresaSuboru('https://files.arling.workers.dev.example.com/x.pdf'), '', 'len presne naša doména');
  assert.equal(platnaAdresaSuboru('https://example.com/x.pdf'), '', 'cudzia domena nie');
  assert.equal(platnaAdresaSuboru('http://files.example.org/x.pdf'), '', 'len https');
  assert.equal(platnaAdresaSuboru('javascript:alert(1)'), '');
  assert.equal(platnaAdresaSuboru('//example.com/x.pdf'), '');
  assert.equal(platnaAdresaSuboru(''), '');
});

test('subory z odpovede sluzby: len ok:true a len pouzitelne odkazy', () => {
  const odpoved = {
    ok: true,
    product: 'ben-hur',
    files: [
      { label: 'e-ink PDF, 157 x 210 mm', url: 'https://api.arling.workers.dev/licence/api/file/1', bytes: 5609062 },
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

/* ── Odkazy len zo sluzby ──────────────────────────────────────────────── */

/* Stary tvar bloku so starou tajnou cestou: ani ked ho stranka este nesie,
   nesmie z neho vzniknut odkaz. */
const DATA = { titul: 'ben-hur', cesta: 'files/abcdefgh12345678/', subory: [
  { file: 'Ben-Hur-eink.pdf', format: 'eink', nazov: 'e-ink PDF, 157 x 210 mm', popis: '953 pages, 5.35 MB' },
  { file: 'Ben-Hur-A4.pdf', format: 'a4', nazov: 'A4 PDF', popis: '953 pages, 5.36 MB' },
] };
const PODPISANY = 'https://api.arling.workers.dev/licence/api/download?p=ben-hur&f=Ben-Hur-eink.pdf&exp=1790208000&sig=' + 'a'.repeat(64);

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
    files: [{ label: 'e-ink PDF', url: 'https://api.arling.workers.dev/licence/api/file/1', bytes: 5609062 }] });
  const zo = await odkazyZoSluzby('cs_test_123456789012', { fetch: f });
  assert.equal(f.volania[0], LICENCIE + '/purchase/links?session_id=cs_test_123456789012');
  assert.equal(zo.subory.length, 1);
  assert.equal(zo.email, 'kto@example.com');
  assert.equal(zo.tyzden, '2026-W39');
  assert.equal(zo.emailed, false, 'odpoved bez pola emailed neznamena, ze e-mail odisiel');
});

test('emailed zo sluzby prejde az po stranku, a to len ako true', async () => {
  const ano = await odkazyZoSluzby('cs_1', { fetch: fetchDvojnik({ ok: true, emailed: true, email: 'kto@example.com',
    files: [{ label: 'A4 PDF', url: 'https://arling.sk/f/a.pdf' }] }) });
  assert.equal(ano.emailed, true);
  const nie = await odkazyZoSluzby('cs_1', { fetch: fetchDvojnik({ ok: true, emailed: 'true', email: 'kto@example.com',
    files: [{ label: 'A4 PDF', url: 'https://arling.sk/f/a.pdf' }] }) });
  assert.equal(nie.emailed, false, 'retazec "true" nie je potvrdenie');
});

test('sluzba odpovie: subory su jej podpisane odkazy', async () => {
  const f = fetchDvojnik({ ok: true, email: 'kto@example.com',
    files: [{ label: 'e-ink PDF', url: PODPISANY, bytes: 5609062 }] });
  const z = await zdrojSuborov('cs_1', { fetch: f });
  assert.equal(z.zdroj, 'sluzba');
  assert.equal(z.subory.length, 1);
  assert.equal(z.subory[0].href, PODPISANY);
  assert.equal(z.email, 'kto@example.com');
  assert.equal(z.emailed, false);
});

test('sluzba neodpovie: ziadne odkazy, ani zo starej cesty na stranke', async () => {
  const pady = [
    await zdrojSuborov('cs_1', { fetch: fetchDvojnik({ ok: false, reason: 'downloads-off' }, { ok: false }) }),
    await zdrojSuborov('cs_1', { fetch: fetchDvojnik({ ok: false, reason: 'test-disabled' }) }),
    await zdrojSuborov('cs_1', { fetch: fetchDvojnik({ ok: true, files: [] }, { ok: false }) }),
    await zdrojSuborov('cs_1', { fetch: fetchDvojnik(null, { hodVynimku: true }) }),
    await zdrojSuborov('cs_1', { fetch: null }),
    await zdrojSuborov('', { fetch: fetchDvojnik({ ok: true, files: [] }) }),
  ];
  for (const z of pady) {
    assert.equal(z.zdroj, 'caka');
    assert.deepEqual(z.subory, [], 'ziadny nahradny odkaz');
    assert.equal(z.email, '', 'e-mail pozna len sluzba');
    assert.equal(z.emailed, false, 'ked sluzba neodpovedala, o e-maile nevieme nic');
  }
});

/* ── Panel po zaplateni ────────────────────────────────────────────────── */

function fakeDom() {
  const novy = (tag) => {
    const el = {
      tag, deti: [], atr: {}, dataset: {}, className: '', hidden: true, disabled: false, pocuva: {}, text_: '',
      setAttribute(k, v) { this.atr[k] = String(v); },
      removeAttribute(k) { delete this.atr[k]; },
      appendChild(d) { this.deti.push(d); return d; },
      addEventListener(meno, fn) { this.pocuva[meno] = fn; },
    };
    // Ako v skutocnom DOM: priradenie textContent zmaze vsetky deti (panel sa tak prekresluje).
    Object.defineProperty(el, 'textContent', {
      get() { return this.text_; },
      set(v) { this.text_ = String(v); this.deti = []; },
      enumerable: true,
    });
    return el;
  };
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
    emailed: true,
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

test('potvrdene odoslanie bez adresy povie aspon, kam sa subory poslali', () => {
  const { novy } = fakeDom();
  const koren = novy('div');
  vykresliPanel(koren, { subory: [{ nazov: 'A4 PDF', href: 'files/x/a.pdf' }], emailed: true, session: '' });
  assert.equal(text(najdi(koren, 'hotovo-mail')), PANEL.mailPred + PANEL.mailBez + '.');
  assert.equal(najdi(koren, 'hotovo-cislo'), null, 'bez session ziadne cislo objednavky');
  delete globalThis.document;
});

/* Nalez N4 a N8 auditu z 21. 9. 2026: stranka tvrdila "were also sent to" aj
   vtedy, ked e-mail neodisiel (odkazy zo samotnej stranky alebo zlyhany Resend). */
test('bez potvrdenia od sluzby sa o e-maile netvrdi nic', () => {
  const { novy } = fakeDom();
  const koren = novy('div');
  vykresliPanel(koren, { subory: [{ nazov: 'A4 PDF', href: 'files/x/a.pdf' }], email: 'kto@example.com', session: 'cs_live_a1b2c3d4' });
  const veta = text(najdi(koren, 'hotovo-mail'));
  assert.equal(veta, PANEL.mailNeisty);
  assert.ok(!veta.includes('were also sent to'), 'ziadne tvrdenie o odoslanom e-maile');
  assert.ok(!veta.includes('kto@example.com'), 'adresa sa bez potvrdenia neukazuje ako prijemca');
  assert.ok(veta.includes('support@arling.sk'), 'clovek ma vediet, komu napisat');
  delete globalThis.document;
});

test('emailed sa prijme len ako presne true, nie ako "pravdiva" hodnota', () => {
  for (const hodnota of [undefined, null, false, 1, 'yes', 'true']) {
    const { novy } = fakeDom();
    const koren = novy('div');
    vykresliPanel(koren, { subory: [{ nazov: 'A4 PDF', href: 'a.pdf' }], email: 'kto@example.com', emailed: hodnota });
    assert.equal(text(najdi(koren, 'hotovo-mail')), PANEL.mailNeisty, 'emailed=' + String(hodnota));
    delete globalThis.document;
  }
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

test('sluzba neodpovedala: pokojna veta, Try again, cele cislo platby a kontakt, ziadny odkaz', () => {
  const { novy } = fakeDom();
  const koren = novy('div');
  let znova = 0;
  vykresliPanel(koren, { subory: [], session: 'cs_live_a1b2c3d4e5f6g7h8', znova: () => { znova += 1; } });
  assert.equal(koren.hidden, false);
  assert.equal(najdi(koren, 'hotovo-subory'), null, 'ziadny odkaz, ani mrtvy');
  const riadky = koren.deti.filter((d) => d.className === 'hotovo-riadok').map(text);
  assert.deepEqual(riadky, [PANEL.cakame, PANEL.cakamePomoc]);
  assert.ok(riadky.join(' ').includes('support@arling.sk'));
  const tlacidlo = najdi(koren, 'hotovo-znova').deti[0];
  assert.equal(tlacidlo.tag, 'button');
  assert.equal(tlacidlo.atr.type, 'button');
  assert.equal(text(tlacidlo), 'Try again');
  tlacidlo.pocuva.click();
  assert.equal(znova, 1, 'Try again zavola novy pokus');
  assert.equal(tlacidlo.disabled, true, 'dvojklik neposle dva pokusy naraz');
  assert.equal(text(najdi(koren, 'hotovo-cislo')), 'Payment reference cs_live_a1b2c3d4e5f6g7h8', 'cele session id');
  assert.equal(najdi(koren, 'hotovo-mail'), null, 'bez odkazov sa o e-maile nic netvrdi');
  delete globalThis.document;
});

test('texty cakania nic nesluby a nemaju pomlcky', () => {
  for (const k of ['cakame', 'cakamePomoc', 'cakamePomocBez', 'znova', 'referencia', 'mailNeisty']) {
    assert.ok(!/[–—]/.test(PANEL[k]), k + ' bez pomlcky');
    assert.ok(!/guarantee|always|instantly|within \d+ (minutes|hours)/i.test(PANEL[k]), k + ' bez slubu');
  }
});

test('bez cisla platby povie, z akej adresy napisat', () => {
  const { novy } = fakeDom();
  const koren = novy('div');
  vykresliPanel(koren, { subory: [], session: '' });
  const riadky = koren.deti.filter((d) => d.className === 'hotovo-riadok').map(text);
  assert.deepEqual(riadky, [PANEL.cakame, PANEL.cakamePomocBez]);
  assert.equal(najdi(koren, 'hotovo-cislo'), null);
  assert.equal(najdi(koren, 'hotovo-znova'), null, 'bez funkcie znova ziadne tlacidlo');
  delete globalThis.document;
});

test('po platbe: sluzba neodpovie, Try again sa spyta znova a az potom ukaze subory', async () => {
  const { novy } = fakeDom();
  const koren = novy('div');
  let pokus = 0;
  const f = async () => {
    pokus += 1;
    if (pokus === 1) return { ok: false, json: async () => ({ ok: false, reason: 'downloads-off' }) };
    return { ok: true, json: async () => ({ ok: true, files: [{ label: 'e-ink PDF', url: PODPISANY, bytes: 5609062 }] }) };
  };
  const z1 = await ukazPoPlatbe({ blok: koren, sid: 'cs_live_a1b2c3d4e5f6g7h8', ukazka: null, fetch: f, data: DATA });
  assert.equal(z1.zdroj, 'caka');
  assert.equal(najdi(koren, 'hotovo-subory'), null, 'stary blok titul-data s cestou sa nepouzije');
  const tlacidlo = najdi(koren, 'hotovo-znova').deti[0];
  await tlacidlo.pocuva.click();
  // click vola ukazPoPlatbe, ktore je async; pockame, kym dobehne
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(pokus, 2);
  const zoznam = najdi(koren, 'hotovo-subory');
  assert.ok(zoznam, 'po druhom pokuse su subory');
  assert.equal(zoznam.deti[0].deti[0].atr.href, PODPISANY);
  assert.equal(najdi(koren, 'hotovo-znova'), null);
  delete globalThis.document;
});

// Reklama 26. 9. 2026: UTM z príchodu idú do odkazu Stripe ako utm_* a client_reference_id.
{
  const { utmZAdresy, sOdkazomReklamy } = await import('./titul.js');
  const u = utmZAdresy('https://arling.sk/shop/x/?utm_source=google&utm_medium=cpc&utm_campaign=sady-en&utm_content=a b<c>');
  assert.equal(u.utm_content, 'abc');
  const s = new URL(sOdkazomReklamy('https://buy.stripe.com/abc', u));
  assert.equal(s.searchParams.get('client_reference_id'), 'gads_sady-en_abc');
  // iný zdroj ako Google Ads nedostane gads_ (1. 10. 2026: YouTube F3 sa pripisoval ako reklama)
  const yt = new URL(sOdkazomReklamy('https://buy.stripe.com/abc', utmZAdresy('https://arling.sk/x/?utm_source=youtube&utm_medium=shorts&utm_campaign=f3&utm_content=stars')));
  assert.equal(yt.searchParams.get('client_reference_id'), 'youtube_f3_stars');
  const pin = new URL(sOdkazomReklamy('https://buy.stripe.com/abc', utmZAdresy('https://arling.sk/x/?utm_source=pinterest&utm_medium=social&utm_campaign=eink')));
  assert.equal(pin.searchParams.get('client_reference_id'), 'pinterest_eink');
  assert.equal(s.searchParams.get('utm_campaign'), 'sady-en');
  assert.equal(sOdkazomReklamy('https://buy.stripe.com/abc', { utm_source: 'x' }), 'https://buy.stripe.com/abc');
  assert.equal(sOdkazomReklamy('https://buy.stripe.com/abc', null), 'https://buy.stripe.com/abc');
  assert.equal(sOdkazomReklamy('', u), '');
  console.log('ok reklama utm');
}

/* STAV-57 (posudok stranok postav, nalez P2): cesta z obchodu postavy cez detail nesie ?postava=,
   kupa dostane ig_<postava>_<titul> (nie gads_); aktualne UTM maju prednost pred ulozenymi. */
{
  const { sOdkazomReklamy, postavaZAdresy, prichod } = await import('./titul.js');
  const ref = (h) => new URL(h).searchParams.get('client_reference_id');
  for (const p of ['walt', 'june', 'olive']) {
    assert.equal(postavaZAdresy(`https://arling.sk/morning-quiet/?postava=${p}`), p);
    const bez = sOdkazomReklamy('https://buy.stripe.com/abc', {}, { postava: p, titul: 'morning-quiet' });
    assert.equal(ref(bez), `ig_${p}_morning-quiet`, p + ' bez UTM');
    const s = sOdkazomReklamy('https://buy.stripe.com/abc', { utm_source: 'ig', utm_campaign: 'reel01' }, { postava: p, titul: 'budget-2027' });
    assert.equal(ref(s), `ig_${p}_budget-2027`, p + ' s UTM');
    assert.equal(new URL(s).searchParams.get('utm_campaign'), 'reel01');
  }
  assert.equal(postavaZAdresy('https://arling.sk/x/?postava=evil'), '');
  assert.equal(postavaZAdresy('zla adresa'), '');
  // instagram bez postavy: UTM ano, gads_ nie
  const ig = sOdkazomReklamy('https://buy.stripe.com/abc', { utm_source: 'instagram', utm_campaign: 'bio' });
  assert.equal(ref(ig), null);
  assert.equal(new URL(ig).searchParams.get('utm_source'), 'instagram');
  // aktualne UTM a postava z adresy; ulozene UTM len ako doplnok, ulozena postava sa nikdy nepouzije (brana 28. 9. pokus 3)
  const ulozene = { utm: { utm_source: 'google', utm_campaign: 'stara' }, postava: 'june' };
  assert.deepEqual(prichod('https://arling.sk/x/?utm_source=ig&utm_campaign=nova&postava=walt', ulozene), { utm: { utm_source: 'ig', utm_campaign: 'nova' }, postava: 'walt' });
  assert.deepEqual(prichod('https://arling.sk/x/', ulozene), { utm: ulozene.utm, postava: '' });
  assert.deepEqual(prichod('https://arling.sk/x/?utm_source=google&utm_campaign=ads', ulozene), { utm: { utm_source: 'google', utm_campaign: 'ads' }, postava: '' });
  assert.deepEqual(prichod('https://arling.sk/x/?utm_campaign=nova', { utm: null, postava: 'zla' }), { utm: { utm_campaign: 'nova' }, postava: '' });
  assert.deepEqual(prichod('https://arling.sk/x/', { utm: null, postava: '' }), { utm: {}, postava: '' });
  console.log('ok postava cez detail');
}

/* STAV-52, pokus 3 brany obchodov postav (posudok pokusu 2, nalez 1): o teste rozhoduje adresa
   nezavisle od uloziska; tlacidlo v teste nikdy na zivy odkaz; zive platby na stranke sa v teste vypnu. */
function uloz(stav) {
  const data = { ...(stav.data || {}) };
  return {
    data,
    getItem(k) { if (stav.cita) throw new Error('SecurityError'); return data[k] ?? null; },
    setItem(k, v) { if (stav.zapis) throw new Error('QuotaExceededError'); data[k] = String(v); },
  };
}

test('test rezim: ?test=1 plati pri kazdom stave uloziska, bez neho len ulozene 1', () => {
  const stavy = { funkcne: {}, 'citanie aj zapis vyhodi': { cita: 1, zapis: 1 }, 'zapis vyhodi': { zapis: 1 }, 'citanie vyhodi': { cita: 1 } };
  for (const [meno, st] of Object.entries(stavy)) {
    for (const adresa of ['https://arling.sk/shop/budget-2027/?test=1', 'https://arling.sk/morning-quiet/?utm_source=ig&test=1', 'https://arling.sk/classics/ben-hur/?test=1#x']) {
      assert.equal(titul.testRezimZ(adresa, uloz(st)), true, meno + ' ' + adresa);
    }
    assert.equal(titul.testRezimZ(adresa0(), uloz(st)), false, meno + ' bez testu');
    assert.equal(titul.testRezimZ('https://arling.sk/x/?test=0', uloz(st)), false, meno + ' test=0');
  }
  assert.equal(titul.testRezimZ('https://arling.sk/x/?test=1', null), true, 'bez uloziska vobec');
  assert.equal(titul.testRezimZ('https://arling.sk/x/', uloz({ data: { 'titul:test': '1' } })), true, 'ulozene z predchadzajucej stranky');
  assert.equal(titul.testRezimZ('https://arling.sk/x/', uloz({ data: { 'titul:test': '0' } })), false);
  assert.equal(titul.testRezimZ('nie je adresa', uloz({})), false);
  const u = uloz({});
  titul.testRezimZ('https://arling.sk/x/?test=1', u);
  assert.equal(u.data['titul:test'], '1', 'rezim sa ulozi pre dalsie stranky');
});
function adresa0() { return 'https://arling.sk/shop/budget-2027/'; }

test('tlacidlo kupy: v teste len test_ odkaz, nikdy zivy; mimo testu zivy', () => {
  const ok = { link: 'https://buy.stripe.com/live1', linkTest: 'https://buy.stripe.com/test_1' };
  assert.equal(titul.odkazTlacidla(ok, true), 'https://buy.stripe.com/test_1');
  assert.equal(titul.odkazTlacidla(ok, false), 'https://buy.stripe.com/live1');
  for (const linkTest of ['', undefined, 'https://buy.stripe.com/live1', 'https://www.etsy.com/listing/1', 'javascript:x'])
    assert.equal(titul.odkazTlacidla({ link: ok.link, linkTest }, true), '', String(linkTest));
});

test('ziva platba na stranke titulu: zivy Stripe a Etsy ano, test_ a nase odkazy nie', () => {
  for (const h of ['https://buy.stripe.com/abc', 'https://www.etsy.com/listing/4577343621/x?utm_source=arling', 'https://etsy.com/'])
    assert.equal(titul.zivaPlatba(h), true, h);
  for (const h of ['https://buy.stripe.com/test_abc', '/classics/ben-hur/Ben-Hur-Sample-eink.pdf', 'mailto:support@arling.sk', '', null])
    assert.equal(titul.zivaPlatba(h), false, String(h));
});

test('v teste sa vypne kazdy zivy odkaz na stranke a klik nan sa zastavi', () => {
  const odkazy = ['https://www.etsy.com/listing/1', 'https://buy.stripe.com/live', 'https://buy.stripe.com/test_1', '/shop/'].map((href) => {
    const a = { attrs: { href }, dataset: {}, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
      setAttribute(k, v) { this.attrs[k] = String(v); }, removeAttribute(k) { delete this.attrs[k]; }, closest() { return this; } };
    return a;
  });
  const posluchy = [];
  const doc = { querySelectorAll: () => odkazy.filter((a) => 'href' in a.attrs), addEventListener: (t, f, cap) => posluchy.push({ t, f, cap }) };
  assert.equal(titul.vypniZivePlatby(doc), 2);
  assert.deepEqual(odkazy.map((a) => a.getAttribute('href')), [null, null, 'https://buy.stripe.com/test_1', '/shop/']);
  assert.deepEqual(odkazy.map((a) => a.getAttribute('aria-disabled')), ['true', 'true', null, null]);
  assert.ok(posluchy.some((p) => p.t === 'click' && p.cap), 'poistka v zachytavacej faze');
  for (const [i, cakane] of [[0, true], [1, true], [2, false], [3, false]]) {
    let zastavene = false;
    posluchy[0].f({ target: odkazy[i], preventDefault: () => { zastavene = true; } });
    assert.equal(zastavene, cakane, 'odkaz ' + i);
  }
  assert.equal(titul.vypniZivePlatby(doc), 0, 'druhe volanie nic nove, poistka sa neprida znova');
  assert.equal(posluchy.length, 1);
});
