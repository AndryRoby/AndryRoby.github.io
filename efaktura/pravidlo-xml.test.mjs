/* Testy bloku s kontrolou XML na strankach pravidiel (pravidlo-xml.js, 27. 9. 2026).
 *
 * Spustenie: node --test products/arling-sk/efaktura/pravidlo-xml.test.mjs
 *
 * Co sa overuje: blok vola tu istu kontrolu ako nastroj (skontroluj z pravidla.mjs) a z jej
 * vysledku spravne povie, ci sa v subore vyskytuje kod stranky, alebo priamo prizna, ze
 * pravidlo nebezalo (iny profil, subor nie je UBL). Vzory XML sa beru priamo z app.js,
 * rovnako ako vo vzory.test.mjs, aby sa test a stranka nerozisli. Vykreslenie sa skusa
 * nad malym falosnym DOM (len createElement, appendChild, textContent), bez prehliadaca.
 * Zapojenie na stranke (id prvkov, udalost Umami) strazi ops/efaktura/postav-pravidla.test.mjs.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { skontroluj, IMPLEMENTOVANE, nazovProfilu } from './pravidla.mjs';
import * as K from './kodovniky.mjs';
import { TEXTY, URL_PRAVIDIEL, potrebnyProfil, vyhodnot, verdikt, triedaVerdiktu, vykresliNalezy, nacitajModuly } from './pravidlo-xml.js';

const APP = readFileSync(new URL('./app.js', import.meta.url), 'utf8');
const JAZYKY = ['sk', 'cs', 'de', 'en'];

/** XML zapisane natvrdo v app.js, presne ako ho nacita tlacidlo vzoru. */
function vzorZApp(meno) {
  const zac = APP.indexOf('const ' + meno + ' = `');
  assert.ok(zac > 0, 'app.js: ' + meno + ' sa nenasiel');
  return APP.slice(APP.indexOf('<?xml', zac), APP.indexOf('\n`;', zac) + 1);
}
/** Funkcia vzorSChybami z app.js (vzor s dvoma chybami), bez kopirovania jej tela. */
const vzorSChybami = (() => {
  const zac = APP.indexOf('function vzorSChybami(x)');
  assert.ok(zac > 0, 'app.js: funkcia vzorSChybami sa nenasla');
  return new Function('return ' + APP.slice(zac, APP.indexOf('\n}\n', zac) + 2))();
})();

const PEPPOL = vzorZApp('VZOR_XML_EN');
const PEPPOL_CHYBY = vzorSChybami(PEPPOL);
const XRECHNUNG = vzorZApp('VZOR_XML_DE');

/* Maly falosny DOM: presne tolko, kolko pouziva vykresliNalezy. */
class Uzol {
  constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.className = ''; this.text = ''; this.open = false; this.href = ''; }
  set textContent(t) { this.text = String(t); this.children = []; }
  get textContent() { return this.text + this.children.map((c) => c.textContent).join(''); }
  appendChild(c) { this.children.push(c); return c; }
  vsetky(podmienka) {
    const out = [];
    const chod = (u) => { if (podmienka(u)) out.push(u); u.children.forEach(chod); };
    chod(this);
    return out;
  }
}
const DOC = { createElement: (t) => new Uzol(t) };
const trieda = (u, t) => u.className.split(' ').indexOf(t) !== -1;

test('vzor s dvoma chybami: kod stranky je v subore, ostatne nalezy su oddelene', () => {
  const v = skontroluj(PEPPOL_CHYBY);
  assert.equal(v.profil, 'peppol');
  assert.ok(v.nalezy.some((n) => n.kod === 'BR-CO-15'), 'vzor s chybami uz nema BR-CO-15');
  const h = vyhodnot(v, 'BR-CO-15');
  assert.equal(h.stav, 'ano');
  assert.ok(h.tieto.length >= 1 && h.tieto.every((n) => n.kod === 'BR-CO-15'));
  assert.ok(h.ostatne.every((n) => n.kod !== 'BR-CO-15'));
  assert.equal(h.tieto.length + h.ostatne.length, v.nalezy.length);
  assert.ok(h.ostatne.some((n) => n.kod === 'ARL-IBAN'), 'druha chyba vzoru (ARL-IBAN) chyba medzi ostatnymi');
});

test('pravidlo, ktore bezalo a v subore nie je: stav nie', () => {
  const v = skontroluj(PEPPOL_CHYBY);
  assert.equal(vyhodnot(v, 'BR-01').stav, 'nie');
  assert.equal(vyhodnot(v, 'PEPPOL-EN16931-R001').stav, 'nie');
  assert.equal(vyhodnot(v, 'XML-01').stav, 'nie');
  assert.equal(vyhodnot(skontroluj(PEPPOL), 'BR-CO-15').stav, 'nie');
});

test('pravidlo ineho profilu sa nevyhlasi za nepritomne, ale za nevyhodnotene', () => {
  const peppol = skontroluj(PEPPOL);
  const de = skontroluj(XRECHNUNG);
  assert.equal(de.profil, 'xrechnung');
  // nemecke pravidla nad Peppol suborom a Peppol pravidla nad XRechnung nebezia
  assert.ok(!peppol.nalezy.some((n) => potrebnyProfil(n.kod) === 'xrechnung'));
  assert.ok(!de.nalezy.some((n) => potrebnyProfil(n.kod) === 'peppol'));
  assert.equal(vyhodnot(peppol, 'BR-DE-15').stav, 'profil');
  assert.equal(vyhodnot(peppol, 'BR-DE-TMP-32').stav, 'profil');
  assert.equal(vyhodnot(de, 'PEPPOL-EN16931-R001').stav, 'profil');
  assert.equal(vyhodnot(de, 'ARL-MENA').stav, 'profil');
  // BR-DEC je jadro EN 16931 (desatinne miesta), bezi v kazdom profile
  assert.equal(vyhodnot(peppol, 'BR-DEC-01').stav, 'nie');
  assert.equal(vyhodnot(de, 'BR-DEC-01').stav, 'nie');
  // rozsirenie XRechnung: BR-DEX bezi len pri presnom CustomizationID rozsirenia
  assert.equal(vyhodnot(de, 'BR-DEX-01', { rozsirenie: false }).stav, 'profil');
  const rozsirene = XRECHNUNG.split(K.PROFILY.xrechnung + '<').join(K.PROFILY.xrechnungRozsirenie + '<');
  assert.notEqual(rozsirene, XRECHNUNG, 'vo vzore DE sa nenasiel identifikator XRechnung');
  const vr = skontroluj(rozsirene);
  assert.equal(vr.profil, 'xrechnung');
  assert.notEqual(vyhodnot(vr, 'BR-DEX-01', { rozsirenie: true }).stav, 'profil');
});

test('subor, ktory nie je UBL dokladom: pravidla nebezali, okrem kodov samotneho XML', () => {
  const zle = skontroluj('<Invoice><cbc:ID>1</Invoice>');
  assert.equal(zle.typ, 'chybaXml');
  assert.equal(vyhodnot(zle, 'BR-01').stav, 'neplatne');
  assert.equal(vyhodnot(zle, 'XML-01').stav, 'ano');
  assert.equal(vyhodnot(zle, 'CII-01').stav, 'neplatne');
  const cii = skontroluj('<?xml version="1.0"?><rsm:CrossIndustryInvoice xmlns:rsm="' + K.MP.cii + '"/>');
  assert.equal(cii.typ, 'CII');
  assert.equal(vyhodnot(cii, 'CII-01').stav, 'ano');
  assert.equal(vyhodnot(cii, 'XML-01').stav, 'nie');
  assert.equal(vyhodnot(cii, 'XML-02').stav, 'neplatne');
  assert.equal(vyhodnot(cii, 'BR-CO-15').stav, 'neplatne');
  const iny = skontroluj('<?xml version="1.0"?><Order xmlns="urn:x"/>');
  assert.equal(vyhodnot(iny, 'XML-02').stav, 'ano');
  assert.equal(vyhodnot(iny, 'BR-01').stav, 'neplatne');
});

test('orezany vysledok: chybajuci kod sa nevyhlasi za nepritomny', () => {
  const v = skontroluj(PEPPOL);
  const orezany = { ...v, sumar: { ...v.sumar, orezane: true } };
  assert.equal(vyhodnot(orezany, 'BR-01').stav, 'neiste');
});

test('potrebny profil pre kazdy implementovany kod zodpoveda sadam pravidiel v pravidla.mjs', () => {
  for (const k of IMPLEMENTOVANE) {
    const p = potrebnyProfil(k);
    if (k.startsWith('PEPPOL-')) assert.equal(p, 'peppol', k);
    else if (k.startsWith('BR-DEX-')) assert.equal(p, 'xrechnung-rozsirenie', k);
    else if (/^BR-DE-|^BR-TMP-/.test(k)) assert.equal(p, 'xrechnung', k);
    else if (k === 'ARL-MENA') assert.equal(p, 'en16931', k);
    else assert.equal(p, '', k);
  }
});

test('veta s vysledkom: styri jazyky, kod v kazdej vete, bez pomlciek a vykricnikov', () => {
  const v = skontroluj(PEPPOL_CHYBY);
  const pripady = [
    [{ stav: 'ano', tieto: [1] }, 'BR-CO-15'],
    [{ stav: 'ano', tieto: [1, 2, 3] }, 'BR-CO-15'],
    [{ stav: 'nie', tieto: [] }, 'BR-01'],
    [{ stav: 'profil', tieto: [] }, 'BR-DE-15'],
    [{ stav: 'neplatne', tieto: [] }, 'BR-01'],
    [{ stav: 'neiste', tieto: [] }, 'BR-01']
  ];
  for (const j of JAZYKY) {
    for (const [h, kod] of pripady) {
      const veta = verdikt(h, kod, j, nazovProfilu(v, j), nazovProfilu({ profil: 'xrechnung' }, j));
      assert.ok(veta.includes(kod), j + ' ' + h.stav + ': veta bez kodu: ' + veta);
      assert.ok(!/undefined|NaN|null/.test(veta), j + ' ' + h.stav + ': ' + veta);
      assert.ok(!/[–—!]/.test(veta), j + ' ' + h.stav + ': pomlcka alebo vykricnik: ' + veta);
      if (h.stav === 'profil') assert.ok(veta.includes('XRechnung') && veta.includes('Peppol'), j + ': veta o profile neuvadza oba profily');
    }
    assert.ok(verdikt({ stav: 'ano', tieto: [1, 2, 3] }, 'BR-01', j, '', '').includes('3'), j + ': pocet vyskytov chyba');
  }
  assert.equal(triedaVerdiktu('ano'), 'je-ano');
  assert.equal(triedaVerdiktu('nie'), 'je-nie');
  assert.equal(triedaVerdiktu('profil'), 'je-inak');
});

test('texty maju vo vsetkych jazykoch rovnake kluce a ziadne pomlcky', () => {
  const kluce = Object.keys(TEXTY.sk).sort();
  for (const j of JAZYKY) {
    assert.deepEqual(Object.keys(TEXTY[j]).sort(), kluce, j);
    for (const [k, t] of Object.entries(TEXTY[j])) {
      const ukazka = typeof t === 'function' ? t(2, 3, 1) : typeof t === 'object' ? Object.values(t).join(' ') : t;
      assert.ok(!/[–—!]/.test(ukazka), j + '.' + k + ': ' + ukazka);
    }
    assert.equal(TEXTY[j].pocty(0, 0, 0), '');
  }
  assert.equal(TEXTY.sk.pocty(1, 2, 5), '1 chyba, 2 varovania, 5 informácií');
  assert.equal(TEXTY.cs.pocty(2, 1, 0), '2 chyby, 1 varování');
  assert.equal(TEXTY.de.pocty(1, 2, 1), '1 Fehler, 2 Warnungen, 1 Hinweis');
  assert.equal(TEXTY.en.pocty(1, 0, 2), '1 error, 2 notes');
});

test('vykreslenie: vyskyty kodu stranky zvyraznene, ostatne s odkazom na svoju stranku v jazyku stranky', () => {
  const v = skontroluj(PEPPOL_CHYBY);
  for (const j of JAZYKY) {
    const h = vyhodnot(v, 'BR-CO-15');
    const obal = vykresliNalezy(DOC, h, j, IMPLEMENTOVANE, 'Načítané: faktura.xml (4 kB).');
    const tento = obal.vsetky((u) => u.tagName === 'LI' && trieda(u, 'tento'));
    assert.equal(tento.length, h.tieto.length, j);
    assert.ok(tento.every((li) => li.vsetky((u) => u.tagName === 'A').length === 0), j + ': kod stranky nema odkazovat sam na seba');
    assert.ok(tento[0].textContent.includes('BR-CO-15'));
    assert.ok(tento[0].textContent.includes(TEXTY[j].zavaznost.chyba));
    const d = obal.vsetky((u) => u.tagName === 'DETAILS');
    assert.equal(d.length, 1, j);
    assert.ok(d[0].open, j + ': pri malom pocte ostatnych ma byt zoznam otvoreny');
    assert.ok(d[0].children[0].textContent.startsWith(TEXTY[j].ostatne + ': '), j);
    const odkazy = obal.vsetky((u) => u.tagName === 'A').map((a) => a.href);
    assert.ok(odkazy.includes(URL_PRAVIDIEL[j] + 'arl-iban/'), j + ': ' + odkazy.join(' '));
    assert.ok(obal.textContent.includes('faktura.xml'));
  }
  // bez ostatnych nalezov: veta, ze ine nalezy nie su, a ziadny prazdny rozbalovaci blok
  const h = vyhodnot(skontroluj(PEPPOL), 'BR-01');
  const obal = vykresliNalezy(DOC, h, 'en', IMPLEMENTOVANE, '');
  if (!h.ostatne.length) {
    assert.equal(obal.vsetky((u) => u.tagName === 'DETAILS').length, 0);
    assert.ok(obal.textContent.includes(TEXTY.en.ziadneOstatne));
  }
  // pri subore, ktory nie je UBL, je dovod (XML-01) hned vidno
  const zle = vyhodnot(skontroluj('<Invoice><x></Invoice>'), 'BR-01');
  const o = vykresliNalezy(DOC, zle, 'de', IMPLEMENTOVANE, '');
  assert.ok(o.vsetky((u) => u.tagName === 'DETAILS')[0].open);
  assert.ok(o.textContent.includes('XML-01'));
});

test('moduly kontroly sa nacitaju az na poziadanie a su tie iste ako v nastroji', async () => {
  const zdroj = readFileSync(new URL('./pravidlo-xml.js', import.meta.url), 'utf8');
  // ziadny staticky import: stranka pravidla nesmie pri otvoreni tahat 320 kB kontroly
  assert.ok(!/^\s*import\s/m.test(zdroj), 'pravidlo-xml.js ma staticky import');
  assert.ok(!/\bfetch\s*\(|XMLHttpRequest|sendBeacon/.test(zdroj), 'skript bloku nieco odosiela');
  const M = await nacitajModuly();
  assert.equal(M.P.skontroluj, skontroluj);
  assert.equal(M.K.PROFILY.xrechnungRozsirenie, K.PROFILY.xrechnungRozsirenie);
  assert.equal(typeof M.X.parsujXml, 'function');
  assert.equal(typeof M.X.hod, 'function');
});
