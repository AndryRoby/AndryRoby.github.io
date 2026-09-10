/* Testy GDPR dokumentov: node tests.mjs */
import { DOKUMENTY, zoznamDokumentov, cinnosti, NASTROJE, LEHOTY_PREDVOLENE } from './dokumenty-sk.js';
import { docx, html, zip } from './docx.js';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok    ' + name); }
  catch (e) { failed++; console.log('  FAIL  ' + name + ': ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e)); }
}
function assert(c, m) { if (!c) throw new Error(m || 'assert'); }

const PLNE = {
  firma: { nazov: 'Príklad s. r. o.', ico: '12345678', dic: '2020000000', icdph: 'SK2020000000', sidlo: 'Hlavná 1, 811 01 Bratislava', email: 'info@priklad.sk', telefon: '+421 900 000 000', web: 'https://priklad.sk', zastupca: 'Jana Nováková, konateľka' },
  zodpovednaOsoba: { ma: true, meno: 'Peter Kováč', email: 'gdpr@priklad.sk' },
  cinnosti: { eshop: true, kontakt: true, newsletter: true, ucty: true, analytika: true, socialne: true, zamestnanci: true, uchadzaci: true, kamery: true },
  nastroje: NASTROJE.map((n) => n.id),
  nastrojeIne: 'Vlastný CRM na serveri v Bratislave',
  cookies: { analyticke: true, marketingove: true },
  prenosMimoEU: 'ano',
  lehoty: { ...LEHOTY_PREDVOLENE, kontakt: '2 roky' },
  datum: '2026-09-10',
};
const PRAZDNE = { firma: {}, cinnosti: {}, nastroje: [], cookies: {}, lehoty: {}, datum: '' };
const MALE = { firma: { nazov: 'Malá s. r. o.', ico: '1', sidlo: 'Ulica 2, Košice', email: 'a@b.sk', web: 'https://mala.sk' }, cinnosti: { kontakt: true, analytika: true }, nastroje: ['umami', 'websupport'], cookies: {}, prenosMimoEU: 'nie', lehoty: {}, datum: '2026-09-10' };

function vsetkyBloky(d) { return zoznamDokumentov(d).flatMap((x) => x.fn(d)); }
function text(bloky) { return bloky.map((b) => b.t || b.p || (b.ul || []).join(' ') || (b.tbl || []).flat().join(' ')).join('\n'); }

test('plné údaje: všetkých 10 dokumentov, bez undefined, NaN a [object', () => {
  const z = zoznamDokumentov(PLNE);
  assert(z.length === 10, 'počet ' + z.length);
  const t = text(vsetkyBloky(PLNE));
  assert(!/undefined|NaN|\[object/.test(t), 'undefined v texte');
  assert(t.includes('Príklad s. r. o.') && t.includes('Hraničná 12') && t.includes('Peter Kováč'), 'chýba firma alebo úrad');
  assert(t.includes('Data Privacy Framework'), 'prenos do USA sa nespomína');
  assert(t.includes('2 roky'), 'vlastná lehota sa nepoužila');
});

test('prázdne údaje: dokumenty sa vytvoria s [doplňte] miestami, nič nepadne', () => {
  const z = zoznamDokumentov(PRAZDNE);
  assert(z.length === 8, 'bez zamestnancov a kamier má byť 8, je ' + z.length);
  const t = text(vsetkyBloky(PRAZDNE));
  assert(!/undefined|NaN/.test(t));
  assert(t.includes('[názov'), 'chýba zástupný text');
});

test('malá firma bez cookies: zásady nehovoria o cookies tretích strán, prenos mimo EÚ nie', () => {
  const t = text(vsetkyBloky(MALE));
  assert(t.includes('neprenášame mimo Európskej únie'), 'prenos');
  assert(!t.includes('Meta Pixel'), 'Meta sa nemá spomínať');
  assert(t.includes('Umami'), 'Umami sa má spomínať');
  assert(cinnosti(MALE).length === 2);
});

test('každý dokument má nadpis prvej úrovne a aspoň 5 blokov', () => {
  for (const x of DOKUMENTY) {
    const b = x.fn(PLNE);
    assert(b[0].h === 1, x.id + ' bez H1');
    assert(b.length >= 5, x.id + ' krátky');
  }
});

test('html náhľad escapuje a nesie tučné písmo', () => {
  const s = html([{ p: 'a < b & **c**' }, { tbl: [['x', 'y'], ['1', '2']] }]);
  assert(s.includes('a &lt; b &amp; <b>c</b>'), s);
  assert(s.includes('<th>x</th>') && s.includes('<td>2</td>'));
});

test('docx: platný ZIP (podpisy, počet záznamov, koniec) a XML bez holých &', () => {
  const b = docx(PLNE.cinnosti ? DOKUMENTY[2].fn(PLNE) : [], 'Vzor');
  assert(b[0] === 0x50 && b[1] === 0x4B && b[2] === 3 && b[3] === 4, 'local header');
  const koniec = b.length - 22;
  assert(b[koniec] === 0x50 && b[koniec + 1] === 0x4B && b[koniec + 2] === 5 && b[koniec + 3] === 6, 'end of central dir');
  const pocet = b[koniec + 10] | (b[koniec + 11] << 8);
  assert(pocet === 5, 'entries ' + pocet);
  const stredOffset = b[koniec + 16] | (b[koniec + 17] << 8) | (b[koniec + 18] << 16) | (b[koniec + 19] << 24);
  assert(b[stredOffset] === 0x50 && b[stredOffset + 1] === 0x4B && b[stredOffset + 2] === 1 && b[stredOffset + 3] === 2, 'central dir at offset');
  const txt = new TextDecoder().decode(b);
  const doc = txt.slice(txt.indexOf('<w:document'), txt.indexOf('</w:document>'));
  assert(!/&(?!amp;|lt;|gt;|quot;|#)/.test(doc), 'holé & v XML');
  assert((doc.match(/<w:tc>/g) || []).length === (doc.match(/<\/w:tc>/g) || []).length, 'tc nevyvážené');
  assert((doc.match(/<w:p>/g) || []).length === (doc.match(/<\/w:p>/g) || []).length, 'p nevyvážené');
  assert(doc.includes('Heading1') && doc.includes('<w:tbl>'), 'štýly a tabuľka');
});

test('zip: obsah sa dá prečítať späť z uloženého (nekomprimovaného) záznamu', () => {
  const z = zip([['a.txt', 'ahoj & svet'], ['b/c.xml', '<x/>']]);
  const s = new TextDecoder().decode(z);
  assert(s.includes('a.txtahoj & svet') && s.includes('b/c.xml<x/>'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
