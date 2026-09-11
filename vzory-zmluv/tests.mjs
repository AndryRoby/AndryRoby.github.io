/* Testy vzorov zmlúv: node tests.mjs
 *
 * Overuje to, na čom stojí predaj: že sa každý z piatich dokumentov poskladá
 * z prázdneho aj z plne vyplneného formulára, že v ňom sú povinné časti,
 * že v texte nie sú pomlčky ani nevyplnené zástupné hodnoty a že DOCX je
 * platný ZIP s document.xml.
 */
import { DOKUMENTY, prazdnyFormular, chybajucePovinne, podmienkaPlati, doplnText, datumSK, PRAVNY_STAV } from './dokumenty-sk.js';
import { docx, html, zip, teloXML } from './docx.js';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok    ' + name); }
  catch (e) { failed++; console.log('  FAIL  ' + name + ': ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e)); }
}
function assert(c, m) { if (!c) throw new Error(m || 'assert'); }

const text = (bloky) => bloky.map((b) => b.t || b.p || (b.ul || []).join(' ') || (b.tbl || []).flat().join(' ')).join('\n');

/* Plný formulár: každé pole dostane hodnotu podľa svojho typu, aby sa
 * prešlo aj vetvami, ktoré sa pri predvolených hodnotách neukážu. */
function plnyFormular(dok, prepis = {}) {
  const d = {};
  let i = 0;
  for (const p of dok.polia) {
    i++;
    if (p.typ === 'zaskrtnutie') { d[p.id] = true; continue; }
    if (p.typ === 'vyber') { d[p.id] = p.predvolene || (p.moznosti[0] && p.moznosti[0].hodnota) || ''; continue; }
    if (p.typ === 'datum') { d[p.id] = '2026-09-1' + (i % 9); continue; }
    if (p.typ === 'cislo') { d[p.id] = String(100 + i); continue; }
    d[p.id] = p.predvolene ? String(p.predvolene) : 'Údaj ' + i;
  }
  return { ...d, ...prepis };
}

const ZLE = /undefined|NaN|\[object|\{\{|\}\}/;
const POMLCKY = /[\u2010-\u2015\u2212]/;

test('päť dokumentov s id, názvom, popisom, paragrafmi, poznámkou a otázkami', () => {
  assert(DOKUMENTY.length === 5, 'počet ' + DOKUMENTY.length);
  const cakane = ['najom-bytu', 'kupna-zmluva-vozidlo', 'plna-moc', 'darovacia-zmluva', 'vypoved-najmu-bytu'];
  assert(cakane.every((x) => DOKUMENTY.some((y) => y.id === x)), 'chýba dokument');
  for (const x of DOKUMENTY) {
    assert(x.nazov && x.popis, x.id + ' bez názvu alebo popisu');
    assert(x.paragrafy.length >= 10, x.id + ' má málo paragrafov: ' + x.paragrafy.length);
    assert(x.poznamka && x.poznamka.length > 100, x.id + ' bez poznámky o tom, čo vzor nerieši');
    assert(x.faq.length >= 5, x.id + ' má málo otázok: ' + x.faq.length);
    for (const q of x.faq) assert(q.otazka && q.odpoved, x.id + ' neúplná otázka');
  }
});

test('prázdny formulár: každý dokument sa poskladá, má H1 a zástupné texty v zátvorkách', () => {
  for (const x of DOKUMENTY) {
    const b = x.fn(prazdnyFormular(x.zdroj));
    assert(b.length >= 15, x.id + ' krátky: ' + b.length);
    assert(b[0].h === 1, x.id + ' bez nadpisu prvej úrovne');
    const t = text(b);
    assert(!ZLE.test(t), x.id + ': ' + (t.match(/.{0,60}(undefined|NaN|\[object|\{\{).{0,60}/) || [])[0]);
    assert(/\[[a-záčďéíĺľňóôŕšťúýž ]/i.test(t), x.id + ' nemá zástupné texty v hranatých zátvorkách');
  }
});

test('plný formulár: nič nechýba, mená a sumy sú v texte, žiadne hranaté zátvorky s výzvou', () => {
  for (const x of DOKUMENTY) {
    const d = plnyFormular(x.zdroj);
    const t = text(x.fn(d));
    assert(!ZLE.test(t), x.id + ' zlý text');
    assert(t.includes('Údaj 2') || t.includes('Údaj 3'), x.id + ' nepoužil vyplnené údaje');
    assert(chybajucePovinne(x.zdroj, d).length === 0, x.id + ' hlási chýbajúce povinné polia pri plnom formulári');
  }
});

test('žiadne pomlčky ani v textoch zmlúv, ani v paragrafoch a otázkach', () => {
  for (const x of DOKUMENTY) {
    for (const d of [prazdnyFormular(x.zdroj), plnyFormular(x.zdroj)]) {
      const t = text(x.fn(d));
      assert(!POMLCKY.test(t), x.id + ' pomlčka: ' + (t.match(/.{0,40}[\u2010-\u2015\u2212].{0,40}/) || [])[0]);
    }
    const okolie = x.paragrafy.join(' ') + ' ' + x.poznamka + ' ' + x.faq.map((q) => q.otazka + ' ' + q.odpoved).join(' ') + ' ' + x.nazov + ' ' + x.popis;
    assert(!POMLCKY.test(okolie), x.id + ' pomlčka mimo textu zmluvy');
  }
});

test('povinné časti: strany, predmet, práva a povinnosti, záverečné ustanovenia, podpisy', () => {
  const cakane = {
    'najom-bytu': ['Zmluvné strany', 'Predmet nájmu', 'Nájomné', 'Záverečné ustanovenia', 'podpis'],
    'kupna-zmluva-vozidlo': ['Zmluvné strany', 'Predmet', 'Kúpna cena', 'Záverečné ustanovenia', 'podpis'],
    'plna-moc': ['Splnomocniteľ', 'Splnomocnenec', 'Rozsah', 'podpis'],
    'darovacia-zmluva': ['Zmluvné strany', 'Predmet daru', 'Záverečné ustanovenia', 'podpis'],
    'vypoved-najmu-bytu': ['nájom', 'Dôvod', 'lehota', 'podpis'],
  };
  for (const x of DOKUMENTY) {
    const t = text(x.fn(plnyFormular(x.zdroj))).toLowerCase();
    for (const c of cakane[x.id]) assert(t.includes(c.toLowerCase()), x.id + ' nemá časť ' + c);
  }
});

test('každý vzor cituje paragraf zákona priamo v texte', () => {
  for (const x of DOKUMENTY) {
    const t = text(x.fn(prazdnyFormular(x.zdroj)));
    assert(/§\s*\d/.test(t), x.id + ' necituje žiadny paragraf');
  }
});

test('výber režimu mení text: nájom podľa Občianskeho zákonníka a krátkodobý nájom', () => {
  const x = DOKUMENTY.find((y) => y.id === 'najom-bytu');
  const oz = text(x.fn(plnyFormular(x.zdroj, { rezim: 'oz' })));
  const kzn = text(x.fn(plnyFormular(x.zdroj, { rezim: 'kzn' })));
  assert(oz.includes('§ 685') && !oz.includes('98/2014'), 'režim oz');
  assert(kzn.includes('98/2014'), 'režim kzn');
  assert(oz !== kzn, 'oba režimy dávajú rovnaký text');
});

test('darovacia zmluva: nehnuteľnosť pridá kataster a osvedčený podpis, hnuteľná vec nie', () => {
  const x = DOKUMENTY.find((y) => y.id === 'darovacia-zmluva');
  const nehnut = text(x.fn(plnyFormular(x.zdroj, { predmet: 'nehnutelnost' })));
  const hnut = text(x.fn(plnyFormular(x.zdroj, { predmet: 'hnutelna' })));
  assert(/kataster|katastr/i.test(nehnut) && /osvedč/i.test(nehnut), 'nehnuteľnosť bez katastra alebo osvedčenia');
  assert(!/vklad do katastra/i.test(hnut), 'hnuteľná vec spomína vklad do katastra');
});

test('podmienené povinné polia: pri nehnuteľnosti pribudnú povinné údaje', () => {
  const x = DOKUMENTY.find((y) => y.id === 'darovacia-zmluva');
  const zaklad = prazdnyFormular(x.zdroj);
  const hnut = chybajucePovinne(x.zdroj, { ...zaklad, predmet: 'hnutelna' }).length;
  const nehnut = chybajucePovinne(x.zdroj, { ...zaklad, predmet: 'nehnutelnost' }).length;
  assert(nehnut > hnut, 'pri nehnuteľnosti nepribudli povinné polia: ' + hnut + ' vs ' + nehnut);
});

test('zástupné hodnoty a podmienky: náhrada v zátvorkách, vyplnene, vZozname, rovna', () => {
  const dok = { polia: [
    { id: 'a', typ: 'text', predvolene: '' },
    { id: 'b', typ: 'vyber', predvolene: 'x', moznosti: [{ hodnota: 'x', text: 'Iks' }, { hodnota: 'y', text: 'Ypsilon' }] },
    { id: 'c', typ: 'zaskrtnutie', predvolene: false },
    { id: 'e', typ: 'datum', predvolene: '' },
  ], bloky: [] };
  assert(doplnText(dok, {}, '{{a|meno}}') === '[meno]', 'náhrada');
  assert(doplnText(dok, { a: 'Jana' }, '{{a|meno}}') === 'Jana', 'hodnota');
  assert(doplnText(dok, {}, '{{b@text}}') === 'Iks', 'text možnosti');
  assert(doplnText(dok, { b: 'y' }, '{{b@text}}') === 'Ypsilon', 'text vybranej možnosti');
  assert(doplnText(dok, { e: '2026-09-11' }, '{{e|dátum}}') === '11. 9. 2026', 'dátum po slovensky');
  assert(datumSK('2026-01-05') === '5. 1. 2026', 'datumSK');
  assert(podmienkaPlati(dok, { a: 'x' }, { pole: 'a', vyplnene: true }), 'vyplnene true');
  assert(podmienkaPlati(dok, {}, { pole: 'a', vyplnene: false }), 'vyplnene false');
  assert(podmienkaPlati(dok, { c: true }, { pole: 'c', rovna: true }), 'zaškrtnutie true');
  assert(podmienkaPlati(dok, {}, { pole: 'c', rovna: false }), 'zaškrtnutie predvolene false');
  assert(podmienkaPlati(dok, { b: 'y' }, { pole: 'b', vZozname: ['y', 'z'] }), 'vZozname');
  assert(!podmienkaPlati(dok, { b: 'x' }, { pole: 'b', vZozname: ['y', 'z'] }), 'vZozname negatívne');
  assert(podmienkaPlati(dok, { b: 'y' }, { alebo: [{ pole: 'b', rovna: 'y' }, { pole: 'a', vyplnene: true }] }), 'alebo');
  assert(podmienkaPlati(dok, { a: 'x', b: 'y' }, [{ pole: 'a', vyplnene: true }, { pole: 'b', rovna: 'y' }]), 'pole podmienok');
  assert(!podmienkaPlati(dok, { a: '', b: 'y' }, [{ pole: 'a', vyplnene: true }, { pole: 'b', rovna: 'y' }]), 'pole podmienok negatívne');
});

test('html náhľad escapuje a nesie tučné písmo aj tabuľky', () => {
  const s = html([{ p: 'a < b & **c**' }, { tbl: [['x', 'y'], ['1', '2']] }]);
  assert(s.includes('a &lt; b &amp; <b>c</b>'), s);
  assert(s.includes('<th>x</th>') && s.includes('<td>2</td>'));
});

test('docx: každý dokument je platný ZIP s piatimi záznamami a XML bez holých ampersandov', () => {
  for (const x of DOKUMENTY) {
    const b = docx(x.fn(plnyFormular(x.zdroj)), 'Vytvorené na arling.sk/vzory-zmluv/ dňa 11. 9. 2026. Vzor, nie právne poradenstvo.');
    assert(b[0] === 0x50 && b[1] === 0x4B && b[2] === 3 && b[3] === 4, x.id + ' local header');
    const koniec = b.length - 22;
    assert(b[koniec] === 0x50 && b[koniec + 1] === 0x4B && b[koniec + 2] === 5 && b[koniec + 3] === 6, x.id + ' end of central dir');
    const pocet = b[koniec + 10] | (b[koniec + 11] << 8);
    assert(pocet === 5, x.id + ' entries ' + pocet);
    const stredOffset = b[koniec + 16] | (b[koniec + 17] << 8) | (b[koniec + 18] << 16) | (b[koniec + 19] << 24);
    assert(b[stredOffset] === 0x50 && b[stredOffset + 1] === 0x4B && b[stredOffset + 2] === 1 && b[stredOffset + 3] === 2, x.id + ' central dir');
    const txt = new TextDecoder().decode(b);
    assert(txt.includes('word/document.xml') && txt.includes('word/styles.xml'), x.id + ' chýba časť balíka');
    const doc = txt.slice(txt.indexOf('<w:document'), txt.indexOf('</w:document>'));
    assert(!/&(?!amp;|lt;|gt;|quot;|#)/.test(doc), x.id + ' holé & v XML');
    assert((doc.match(/<w:p>/g) || []).length === (doc.match(/<\/w:p>/g) || []).length, x.id + ' p nevyvážené');
    assert((doc.match(/<w:tc>/g) || []).length === (doc.match(/<\/w:tc>/g) || []).length, x.id + ' tc nevyvážené');
    assert(doc.includes('Heading1'), x.id + ' bez nadpisu');
    assert(b.length > 6000, x.id + ' podozrivo malý DOCX: ' + b.length);
  }
});

test('docx z prázdneho formulára je tiež platný a obsahuje zástupné texty', () => {
  for (const x of DOKUMENTY) {
    const b = docx(x.fn(prazdnyFormular(x.zdroj)), 'Vytvorené na arling.sk/vzory-zmluv/ dňa 11. 9. 2026.');
    assert(b[0] === 0x50 && b[1] === 0x4B, x.id + ' nie je ZIP');
    const txt = new TextDecoder().decode(b);
    assert(txt.includes('<w:document'), x.id + ' bez document.xml');
  }
});

test('päta v DOCX je odkaz na arling.sk/vzory-zmluv/', () => {
  const pata = 'Vytvorené na arling.sk/vzory-zmluv/ dňa 11. 9. 2026. Vzor, nie právne poradenstvo.';
  const xml = teloXML([{ p: 'test' }], pata);
  assert(xml.includes('<w:hyperlink r:id="rId2">'), 'päta nie je odkaz');
  const b = docx([{ h: 1, t: 'X' }], pata);
  assert(new TextDecoder().decode(b).includes('Target="https://arling.sk/vzory-zmluv/"'), 'chýba cieľ odkazu');
});

test('zip: obsah sa dá prečítať späť z uloženého (nekomprimovaného) záznamu', () => {
  const z = zip([['a.txt', 'ahoj & svet'], ['b/c.xml', '<x/>']]);
  const s = new TextDecoder().decode(z);
  assert(s.includes('a.txtahoj & svet') && s.includes('b/c.xml<x/>'));
});

test('nájomná zmluva: príloha s odovzdávacím protokolom, stavmi meračov a podpismi', () => {
  const x = DOKUMENTY.find((y) => y.id === 'najom-bytu');
  for (const rezim of ['oz', 'kzn']) {
    const b = x.fn(plnyFormular(x.zdroj, { rezim }));
    const t = text(b);
    assert(/Príloha č\. 1: Odovzdávací a preberací protokol/.test(t), rezim + ': chýba príloha s protokolom');
    for (const c of ['Elektromer', 'Plynomer', 'Vodomer studenej vody', 'Pomerové rozdeľovače tepla']) {
      assert(t.includes(c), rezim + ': v protokole chýba ' + c);
    }
    const tabulky = b.filter((y) => y.tbl);
    assert(tabulky.length >= 4, rezim + ': protokol nemá tabuľky, je ich ' + tabulky.length);
    const hlavicky = tabulky.map((y) => y.tbl[0].join(' | '));
    assert(hlavicky.some((h) => h.includes('Pri odovzdaní') && h.includes('Pri vrátení')), rezim + ': chýba tabuľka meračov');
    assert(hlavicky.filter((h) => h.includes('Prenajímateľ') && h.includes('Nájomca')).length === 2, rezim + ': protokol nemá vlastné podpisy');
  }
});

test('nájomná zmluva cituje aj § 680, § 682, § 691, § 692 ods. 2 a § 695', () => {
  const x = DOKUMENTY.find((y) => y.id === 'najom-bytu');
  const t = text(x.fn(plnyFormular(x.zdroj, { rezim: 'oz' })));
  for (const par of ['§ 680', '§ 682', '§ 691', '§ 692 ods. 2', '§ 695']) {
    assert(t.includes(par), 'v texte chýba ' + par);
  }
  const okolie = x.paragrafy.join(' ');
  for (const par of ['§ 680', '§ 691', '§ 692 ods. 2', '§ 695', '§ 6 nariadenia']) {
    assert(okolie.includes(par), 'v zozname paragrafov chýba ' + par);
  }
});

test('každá zmluva má rozhodné právo, účinnosť podpisom a ochranu osobných údajov', () => {
  const zmluvy = ['najom-bytu', 'kupna-zmluva-vozidlo', 'darovacia-zmluva'];
  for (const id of zmluvy) {
    const x = DOKUMENTY.find((y) => y.id === id);
    const t = text(x.fn(plnyFormular(x.zdroj)));
    assert(/právo Slovenskej republiky/.test(t), id + ': chýba rozhodné právo');
    assert(/nadobúda platnosť/.test(t), id + ': chýba veta o nadobudnutí platnosti');
    assert(/2016\/679/.test(t), id + ': chýba ustanovenie o ochrane osobných údajov');
    assert(/slobodne, vážne, určite a zrozumiteľne/.test(t), id + ': chýba vyhlásenie o slobode vôle');
  }
  const pm = DOKUMENTY.find((y) => y.id === 'plna-moc');
  assert(/právnym poriadkom Slovenskej republiky/.test(text(pm.fn(plnyFormular(pm.zdroj)))), 'plná moc: chýba rozhodné právo');
});

test('právny stav: overené proti slov-lex, najmenej sedem predpisov s časovou verziou', () => {
  assert(/slov-lex/.test(PRAVNY_STAV.overene), 'bez zdroja overenia');
  assert(PRAVNY_STAV.predpisy.length >= 7, 'málo predpisov');
  for (const p of PRAVNY_STAV.predpisy) {
    assert(p.predpis && p.znenie && p.zdroj, 'neúplný predpis: ' + JSON.stringify(p));
    assert(p.zdroj.includes('slov-lex.sk'), 'zdroj nie je slov-lex: ' + p.zdroj);
  }
  assert(PRAVNY_STAV.dolezitezmeny.length >= 2, 'chýbajú dôležité zmeny');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
