/* Testy trenia na ceste od výsledku k platbe (relácia 205, SPEC 7.2 a až d; Z3 časť 4.4, T2, T3, T4, T6).
 *
 * (a) T2: kúpa pod bezchybným výsledkom (#kupa-vysledok) najprv prenesie skontrolovaný súbor do formulára
 *     a uloží návrh, aby po platbe čakala vo formulári tá faktúra, ktorú človek kontroloval; po návrate
 *     zo Stripe veta, že je pripravená. Platba sa tu nevolá, testuje sa len logika (v prehliadači ?test=1).
 * (b) T3: pri tlačidle veta, pre koho je platené XML a že ho nástroj neodosiela.
 * (c) T4: pri CII stav netvrdí, že súbor prešiel.
 * (d) T6: platobný blok ani blok e-mailu nie pod vzorom.
 * Funkcie sa ťahajú zo zdroja app.js a spúšťajú v Node so zástupnými závislosťami.
 * usage: node --test products/arling-sk/efaktura/trenie.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { zUbl } from './z-ubl.mjs';
import { vytvorUbl } from './ubl.js';
import { skontroluj } from './pravidla.mjs';

const TU = fileURLToPath(new URL('.', import.meta.url));
const APP = readFileSync(new URL('./app.js', import.meta.url), 'utf8');

function zdrojFunkcie(meno) {
  const od = APP.indexOf('function ' + meno + '(');
  assert.ok(od > 0, 'app.js: funkcia ' + meno + ' sa nenašla');
  let hlbka = 0;
  for (let j = APP.indexOf('{', od); j < APP.length; j++) {
    if (APP[j] === '{') hlbka += 1;
    else if (APP[j] === '}') { hlbka -= 1; if (hlbka === 0) return APP.slice(od, j + 1); }
  }
  throw new Error('app.js: telo funkcie ' + meno + ' sa neskončilo');
}

// ---------------------------------------------------------------- zástupné prostredie stránky

const KLUC_NAVRH = 'efaktura:navrh:sk';
const KLUC_Z_KONTROLY = 'efaktura:z-kontroly:sk';
function ulozisko() {
  const m = new Map();
  return {
    m,
    nacitaj: (k) => { const s = m.get(k); return s ? JSON.parse(s) : null; },
    uloz: (k, v) => m.set(k, JSON.stringify(v)),
    zmaz: (k) => m.delete(k),
  };
}
class Prvok {
  constructor(tag) { this.tagName = tag; this.children = []; this.attrs = {}; this.textContent = ''; this.className = ''; this.id = ''; this.parentNode = null; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  insertBefore(c, ref) { c.parentNode = this; const i = this.children.indexOf(ref); if (i === -1) this.children.push(c); else this.children.splice(i, 0, c); return c; }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  get firstChild() { return this.children[0] || null; }
  get nextSibling() { const p = this.parentNode; if (!p) return null; return p.children[p.children.indexOf(this) + 1] || null; }
  querySelector(sel) {
    const najdi = (u) => { for (const c of u.children) { if ((sel === 'p' && c.tagName === 'p') || (sel.startsWith('.') && c.className.split(' ').includes(sel.slice(1)))) return c; const x = najdi(c); if (x) return x; } return null; };
    return najdi(this);
  }
}
const el = (meno, trieda, text) => { const e = new Prvok(meno); if (trieda) e.className = trieda; if (text) e.textContent = String(text); return e; };

/** Stránka po načítaní: faktúra z úložiska ako v app.js (nacitaj(KLUC_NAVRH) || novaFaktura()). */
function stranka({ ul, ukazka = false, potvrdenie = () => true, teraz = Date.now() } = {}) {
  const kostra = new Prvok('div');
  const stav = new Prvok('p');
  stav.id = 'stav-platby';
  kostra.appendChild(stav);
  const prvky = { 'stav-platby': stav };
  const $ = (id) => prvky[id] || kostra.children.find((c) => c.id === id) || null;
  const T = { prepisatNavrh: 'Nahradiť?', navrhPripraveny: 'Faktúra, ktorú ste kontrolovali, je pripravená vo formulári.' };
  const zdroj = ['zapisPrenos', 'navrhPredKupou', 'ukazPripravenyNavrh', 'navrhJeRozpisany', 'ulozNavrh'].map(zdrojFunkcie).join('\n');
  const telo = 'let faktura = nacitaj(KLUC_NAVRH) || { polozky: [{ nazov: "" }], odberatel: {}, cislo: "" };\n'
    + 'let poslednyPrenos = ""; let opravaAktivna = false; const vstupJeUkazka = ukazka;\n'
    + 'const Date = { now: () => teraz };\n'
    + zdroj + '\nreturn { navrhPredKupou, ukazPripravenyNavrh, zmenFakturu: (f) => { f(faktura); ulozNavrh(); }, faktura: () => faktura };';
  const api = new Function('zUbl', 'nacitaj', 'uloz', 'zmaz', 'postavFormular', 'window', '$', 'el', 'T', 'LANG', 'KLUC_NAVRH', 'KLUC_Z_KONTROLY', 'PLATNOST_Z_KONTROLY', 'ukazka', 'teraz', telo)(
    zUbl, ul.nacitaj, ul.uloz, ul.zmaz, () => {}, { confirm: potvrdenie }, $, el, T, 'sk', KLUC_NAVRH, KLUC_Z_KONTROLY, 6 * 3600 * 1000, ukazka, teraz);
  return Object.assign(api, { kostra, stav });
}

function fakturaZoSuboru() {
  return {
    typ: '380', profil: 'peppol', cislo: 'KONTROLA-2026-55',
    datumVystavenia: '2026-10-20', datumDodania: '2026-10-19', datumSplatnosti: '2026-11-03', mena: 'EUR',
    referenciaOdberatela: 'OBJ-9', variabilnySymbol: '202655', poznamka: '',
    dodavatel: { nazov: 'Dodavatel s. r. o.', ico: '11223344', icDph: 'SK1122334455', ulica: 'Slnecna 12', mesto: 'Bratislava', psc: '81101', krajina: 'SK', iban: 'SK3112000000198742637541', endpoint: '1122334455', endpointSchema: '0245' },
    odberatel: { nazov: 'Odberatel a. s.', ico: '99887766', icDph: 'SK9988776655', ulica: 'Nadrazna 5', mesto: 'Kosice', psc: '04001', krajina: 'SK', endpoint: '9988776655', endpointSchema: '0245' },
    sposobPlatby: '58',
    polozky: [{ nazov: 'Konzultacie', mnozstvo: 2, jednotka: 'HUR', cena: 50, sadzba: 23, kategoria: 'S' }],
  };
}
const XML = vytvorUbl(fakturaZoSuboru(), { profil: 'peppol', jazyk: 'sk' });

// ---------------------------------------------------------------- (a) T2

test('(a) pred: bez prenosu by po návrate zo Stripe nečakala vo formulári žiadna faktúra', () => {
  // Takto sa správalo tlačidlo do 22. 10. 2026: klikNaKupu len presmerovalo, návrh sa neuložil.
  const ul = ulozisko();
  const poNavrate = stranka({ ul });
  assert.equal(poNavrate.faktura().cislo, '', 'formulár po návrate je prázdny');
  assert.equal(poNavrate.ukazPripravenyNavrh(), false, 'bez prenosu veta o pripravenej faktúre nesmie zaznieť');
  assert.equal(poNavrate.stav.parentNode.children.length, 1);
});

test('(a) po: kúpa pod výsledkom uloží skontrolovanú faktúru a po návrate povie, že je vo formulári', () => {
  const ul = ulozisko();
  const predKupou = stranka({ ul });
  assert.equal(predKupou.navrhPredKupou(XML), true);
  assert.equal(ul.nacitaj(KLUC_NAVRH).cislo, 'KONTROLA-2026-55', 'návrh nie je faktúra zo súboru');
  // Návrat zo Stripe: nové načítanie stránky číta to isté úložisko.
  const poNavrate = stranka({ ul });
  assert.equal(poNavrate.faktura().cislo, 'KONTROLA-2026-55');
  assert.equal(poNavrate.faktura().odberatel.nazov, 'Odberatel a. s.');
  assert.equal(poNavrate.ukazPripravenyNavrh(), true);
  const veta = poNavrate.stav.parentNode.children[0];
  assert.equal(veta.textContent, 'Faktúra, ktorú ste kontrolovali, je pripravená vo formulári.');
  assert.equal(veta.attrs.role, 'status');
  assert.equal(ul.m.has(KLUC_Z_KONTROLY), false, 'značka sa po použití nezmazala');
  // Druhé otvorenie odkazu už vetu neukáže.
  assert.equal(stranka({ ul }).ukazPripravenyNavrh(), false);
});

test('(a) veta neklame: zmenený návrh, stará značka ani značka z budúcnosti ju neukážu', () => {
  const ul = ulozisko();
  stranka({ ul }).navrhPredKupou(XML);
  const s = stranka({ ul });
  s.zmenFakturu((f) => { f.cislo = 'INA-1'; });
  assert.equal(stranka({ ul }).ukazPripravenyNavrh(), false, 'návrh sa medzitým zmenil');
  const ul2 = ulozisko();
  stranka({ ul: ul2 }).navrhPredKupou(XML);
  assert.equal(stranka({ ul: ul2, teraz: Date.now() + 7 * 3600 * 1000 }).ukazPripravenyNavrh(), false, 'značka staršia ako 6 h');
  const ul3 = ulozisko();
  stranka({ ul: ul3, teraz: Date.now() + 3600 * 1000 }).navrhPredKupou(XML);
  assert.equal(stranka({ ul: ul3 }).ukazPripravenyNavrh(), false, 'značka z budúcnosti');
});

test('(a) rozpísanú inú faktúru bez súhlasu neprepíše; vzor a poškodené XML sa neprenášajú', () => {
  const ul = ulozisko();
  ul.uloz(KLUC_NAVRH, { cislo: 'MOJA-ROZPISANA', odberatel: { nazov: 'Moj klient' }, polozky: [{ nazov: 'x' }] });
  assert.equal(stranka({ ul, potvrdenie: () => false }).navrhPredKupou(XML), false);
  assert.equal(ul.nacitaj(KLUC_NAVRH).cislo, 'MOJA-ROZPISANA');
  assert.equal(ul.m.has(KLUC_Z_KONTROLY), false);
  assert.equal(stranka({ ul, potvrdenie: () => true }).navrhPredKupou(XML), true);
  assert.equal(ul.nacitaj(KLUC_NAVRH).cislo, 'KONTROLA-2026-55');
  const ul2 = ulozisko();
  assert.equal(stranka({ ul: ul2, ukazka: true }).navrhPredKupou(XML), false, 'vzor');
  assert.equal(stranka({ ul: ul2 }).navrhPredKupou('<Invoice><zle'), false, 'poškodené XML');
  assert.equal(ul2.m.size, 0);
});

test('(a) app.js: tlačidlo #kupa-vysledok prenesie súbor pred presmerovaním, návrat ukáže vetu len zo Stripe', () => {
  assert.ok(APP.includes("btnVysledok.addEventListener('click', () => { navrhPredKupou(xmlText); klikNaKupu(btnVysledok, 'jedna', CENA_JEDNA, 'vysledok'); });"),
    'tlačidlo pod výsledkom stále len presmeruje bez prenosu do formulára');
  const n = zdrojFunkcie('poNavrate');
  assert.ok(n.includes('if (zoStripe) ukazPripravenyNavrh();'), 'po návrate zo Stripe sa veta neukáže');
  assert.ok(n.includes('if (!zoStripe) zmaz(KLUC_Z_KONTROLY);'), 'značka prežije aj bez návratu zo Stripe');
  assert.ok(n.indexOf("prepni('vytvorit', true);") < n.indexOf('ukazPripravenyNavrh()'), 'veta sa ukáže pred prepnutím na formulár');
  // doFormulara a kúpa zdieľajú ten istý zápis prenosu.
  assert.ok(zdrojFunkcie('doFormulara').includes('const pocetPoloziek = zapisPrenos(v);'));
  assert.equal((APP.match(/navrhPripraveny: '/g) || []).length, 4, 'veta nie je vo všetkých štyroch jazykoch');
});

// ---------------------------------------------------------------- (b) T3

test('(b) pri tlačidle kúpy pod výsledkom je veta, pre koho je platené XML, raz a len cez textContent', () => {
  const doplnPreKoho = new Function('el', 'T', zdrojFunkcie('doplnPreKoho') + '\nreturn doplnPreKoho;')(el, { kupaPreKoho: 'VETA' });
  const blok = new Prvok('div');
  const prvy = el('p', 'pomoc', 'Kontrola aj náhľad ostávajú zadarmo.');
  blok.appendChild(prvy);
  blok.appendChild(el('div', 'cta'));
  doplnPreKoho(blok);
  doplnPreKoho(blok);
  assert.equal(blok.children.length, 3, 'veta sa pridala viackrát');
  assert.equal(blok.children[1].textContent, 'VETA');
  assert.equal(blok.children[1].className, 'pomoc kupa-pre-koho');
  // SK veta je doslova tá z #brana na SK stránke.
  const sk = readFileSync(join(TU, 'index.html'), 'utf8');
  const skVeta = (APP.match(/kupaPreKoho: '([^']+)'/) || [])[1];
  assert.equal(skVeta, 'Platené XML je určené najmä pre XRechnung do Nemecka a Peppol mimo Slovenska. Náš nástroj XML neodosiela.');
  assert.ok(sk.includes(skVeta), 'SK veta sa nezhoduje s #brana');
  assert.equal((APP.match(/kupaPreKoho: '/g) || []).length, 4);
  for (const v of APP.match(/kupaPreKoho: '([^']+)'/g)) assert.ok(!/[–—]/.test(v), 'pomlčka v texte');
  assert.ok(zdrojFunkcie('spustiKontrolu').includes('if (!kupaBlok.hidden) doplnPreKoho(kupaBlok);'));
});

// ---------------------------------------------------------------- (c) T4

test('(c) pri CII stav nehovorí, že súbor prešiel, ale že treba UBL 2.1', () => {
  const cii = skontroluj('<?xml version="1.0"?><rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"></rsm:CrossIndustryInvoice>');
  assert.equal(cii.typ, 'CII');
  assert.equal(cii.sumar.chyby, 0, 'bez opravy by stav povedal T.bezChyb');
  const k = zdrojFunkcie('spustiKontrolu');
  assert.ok(k.includes("const stav = v.typ === 'CII'\n    ? el('p', 'sumar-stav je-info', T.ciiStav)"), 'CII stále dostane vetu bez chýb');
  const vety = [...APP.matchAll(/ciiStav: '([^']+)'/g)].map((m) => m[1]);
  assert.equal(vety.length, 4);
  for (const v of vety) {
    assert.ok(v.includes('UBL 2.1') && v.includes('CII'), v);
    assert.ok(!/[–—]/.test(v), 'pomlčka v texte');
  }
});

// ---------------------------------------------------------------- (d) T6

test('(d) platobný blok ani blok e-mailu sa pod vzorom neukážu', () => {
  const k = zdrojFunkcie('spustiKontrolu');
  assert.ok(k.includes('kupaBlok.hidden = !(bezaliPravidla && s.chyby === 0 && !vstupJeUkazka);'), 'platobný blok sa ukazuje aj pod vzorom');
  assert.ok(zdrojFunkcie('ukazBlokEmailu').includes('blokSmie(v, vstupJeUkazka)'));
  // Vzor s chybami vložený ručne do poľa je tiež vzor.
  assert.ok(zdrojFunkcie('prijmiText').includes('text.trim() === VZOR_CHYBY.trim()'));
});
