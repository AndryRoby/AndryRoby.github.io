import sk from './jazyky/sk.js?v=1.4';
import en from './jazyky/en.js?v=1.4';
import cs from './jazyky/cs.js?v=1.4';
import de from './jazyky/de.js?v=1.4';
import { MERANIE_VERZIA } from './verzia.js?v=1.4';
import { normalizuj, priprav, slova, unik, odhadJazyka } from './delenie.js?v=1.4';

export const JAZYKY = { sk, cs, en, de };
const priemer = a => a.length ? a.reduce((s, n) => s + n, 0) / a.length : 0;
const cv = a => {
  const m = priemer(a);
  return m ? Math.sqrt(priemer(a.map(n => (n - m) ** 2))) / m : 0;
};
export const lin = (x, a0, a100) => Math.max(0, Math.min(1, (x - a0) / (a100 - a0))) * 100;
export const pasmo = (n, jazyk = sk) => n < jazyk.PASMA[0] ? 'zivy' : n < jazyk.PASMA[1] ? 'zmiesany' : 'prilis_uhladeny';
// v1.4 po bráne 1: bežné podstatné mená (business, informácia, náměstí, Regierung) nie sú dej namiesto slovesa.
// Základ zo zoznamu BEZNE + najviac 4 znaky koncovky; v nemčine aj ako koniec zloženého slova.
export const bezne = (s, j) => (j.BEZNE ?? []).some(b => {
  const i = s.lastIndexOf(b);
  return i >= 0 && s.length - i - b.length <= 4 && (i === 0 || s[i - 1] === '-' || j.SKLADANE === true);
});
// v1.4 po bráne 1: pomlčka s medzerami je v slovenčine, češtine aj nemčine správna interpunkcia
// (STN 01 6910 a Pravidlá slovenského pravopisu; ČSN 01 6910 a Internetová jazyková příručka ÚJČ AV ČR, heslo
// Pomlčka; Duden, Rechtschreibregeln, Gedankenstrich: Halbgeviertstrich s medzerami). Tam počítame len dlhú
// pomlčku z anglickej sadzby (em dash) a dva spojovníky, ktoré ju nahrádzajú. V angličtine sú správne oba
// zápisy: americký em dash bez medzier (The Chicago Manual of Style, kapitola 6, em dashes) aj britská
// en dash s medzerami (New Hart's Rules, Oxford, kapitola 4, dashes; The Guardian and Observer style guide,
// heslo dashes). Preto v angličtine počítame obe; nález hovorí o častom použití, nie o chybe.
const POMLCKY_EM = /\u2014|(?<= )--(?= )/gu;
const POMLCKY = { sk: POMLCKY_EM, cs: POMLCKY_EM, de: POMLCKY_EM, en: /\u2014|(?<=\s)\u2013(?=\s)|(?<= )--(?= )/gu };

const regexZhody = (text, re) => [...text.matchAll(re.global ? re : new RegExp(re.source, re.flags + 'g'))]
  .map(m => ({ od: m.index, do: m.index + m[0].length, text: m[0] }));
// v1.4: regex každej frázy sa zostaví raz; frázu, ktorej prvé slovo v texte nie je, ani nehľadáme.
const regexFrazy = new Map();
const frazaRe = s => {
  let re = regexFrazy.get(s);
  if (!re) regexFrazy.set(s, re = new RegExp("(?<![\\p{L}\\p{N}'-])" + unik(s).replace(/ /g, '\\s+') + "(?![\\p{L}\\p{N}'-])", 'giu'));
  return re;
};
export function zhody(text, zoznam, konstrukcie = []) {
  const male = text.toLowerCase();
  const kandidati = zoznam.flatMap(s => male.includes(s.toLowerCase().split(' ')[0]) ? regexZhody(text, frazaRe(s)) : []);
  kandidati.push(...konstrukcie.flatMap(re => regexZhody(text, re)));
  kandidati.sort((a, b) => (b.do - b.od) - (a.do - a.od) || a.od - b.od);
  const vybrate = [];
  for (const m of kandidati) if (!vybrate.some(x => m.od < x.do && x.od < m.do)) vybrate.push(m);
  return vybrate.sort((a, b) => a.od - b.od);
}

export function merajText(original, { jazyk } = {}) {
  if (typeof original !== 'string') throw new TypeError('Text musí byť reťazec.');
  if (jazyk !== undefined && !Object.hasOwn(JAZYKY, jazyk)) throw new RangeError('Podporované jazyky: sk, cs, en, de.');
  const norm = normalizuj(original);
  jazyk ??= odhadJazyka(norm.text, JAZYKY);
  const zaklad = { verzia: MERANIE_VERZIA, jazyk, kalibracia: 'orientacne_prahy_nekalibrovane' };
  if (!jazyk) return { ...zaklad, chyba: 'vyber_jazyk', index: null, pasmo: null, merania: {}, zvyraznenia: [] };
  const j = JAZYKY[jazyk], p = priprav(norm.text, j), W = p.slova.length;
  const merane_do = p.orezane ? norm.rozsah(0, p.koniec).do : original.length;
  // Riadky z PDF alebo Wordu, ktoré nie sú súvislý text, a rozdelené zlepené slová.
  const vynechane = norm.vynechane.filter(v => v.od < merane_do);
  const vysledok = { ...zaklad, slov: W, povodne_slov: p.povodneSlov, viet: p.rytmus.length,
    orezane: p.orezane, merane_do, vynechane, zlepene: norm.zlepene, ciastocny: W < 80, index: null, pasmo: null, merania: {}, zvyraznenia: [], vektor: {} };
  if (W < 30) return { ...vysledok, chyba: 'malo_slov', sprava: ({ sk: 'Na meranie treba aspoň 30 slov.', cs: 'K měření je třeba alespoň 30 slov.', en: 'At least 30 words are needed.', de: 'Mindestens 30 Wörter sind erforderlich.' })[jazyk] };

  const text = norm.text.slice(0, p.koniec);
  const start = p.telo[0]?.od ?? text.length;
  const telo = text.slice(start);
  const merania = vysledok.merania, highlights = [];
  const percent = n => n / W * 100;
  const pridaj = (m, typ, offset = 0) => {
    const r = norm.rozsah(m.od + offset, m.do + offset);
    highlights.push({ ...r, typ, text: original.slice(r.od, r.do) });
  };
  const meranie = (id, hodnota, extra = {}) => {
    merania[id] = { hodnota, skore: lin(hodnota, ...j.PRAHY[id]), ...extra };
  };
  const dlzky = p.rytmus.map(v => slova(v.text).length);
  const frazy = zhody(telo, j.FRAZY, j.KONSTRUKCIE);
  for (const m of frazy) pridaj(m, 'fraza', start);
  meranie('M6', percent(frazy.length), { pocet: frazy.length });
  const pomlcky = regexZhody(telo, POMLCKY[jazyk]);
  for (const m of pomlcky) pridaj(m, 'pomlcka', start);
  meranie('M7', percent(pomlcky.length), { pocet: pomlcky.length });
  const nominalizacie = p.slova.filter(w => {
    const s = w.text.toLowerCase();
    return [...s].length >= 7 && !j.VYNIMKY.includes(s) && j.PRIPONY.some(k => s.endsWith(k)) && !bezne(s, j);
  });
  for (const m of nominalizacie) pridaj(m, 'nominalizacia');
  meranie('M8', percent(nominalizacie.length), { pocet: nominalizacie.length });
  const clen = "[\\p{L}\\d'-]+";
  const trojica = new RegExp('(?:^|[,:;]\\s*|\\s)((?:' + clen + '\\s){0,3}' + clen + '),\\s((?:' + clen + '\\s){0,3}' + clen + '),?\\s(?:' + j.SPOJKY + ')\\s((?:' + clen + '\\s?){1,4})', 'u');
  let trojic = 0;
  for (const veta of p.vsetky) {
    const m = trojica.exec(veta.text);
    if (!m) continue;
    // Uzatvorenie vzťažnej vety nie je prvou čiarkou zoznamu.
    if (j.VZTAZNE.test(veta.text.slice(0, veta.text.indexOf(',', m.index + 1)))) continue;
    const medzera = m[0].search(/[\p{L}\d]/u);
    pridaj({ od: m.index + medzera, do: m.index + m[0].trimEnd().length }, 'trojica', veta.od);
    trojic++;
  }
  meranie('M9', percent(trojic), { pocet: trojic });

  const funk = new Set(j.FUNKCNE.map(w => w.toLowerCase()));
  const obsah = s => new Set(slova(s).map(w => w.text.toLowerCase())
    .filter(w => (w.match(/\p{L}/gu) || []).length >= 4 && !funk.has(w)).map(w => w.slice(0, j.KMEN)));
  if (W >= 80) {
    if (dlzky.length >= 5) meranie('M1', cv(dlzky), { dlzky_viet: dlzky });
    if (p.dlzkyOdsekov.length >= 3) meranie('M2', cv(p.dlzkyOdsekov), { dlzky_odsekov: p.dlzkyOdsekov });
    const posledne = p.telo.length === 1 ? p.vsetky.slice(-2) : p.vsetky.filter(v => v.od >= p.telo.at(-1).od);
    const znacky = [];
    if (posledne.length) {
      znacky.push(...zhody(posledne[0].text, j.ZAVER).map(m => ({ ...m, od: m.od + posledne[0].od, do: m.do + posledne[0].od })));
      for (const v of posledne) {
        for (const m of zhody(v.text, j.MORAL)) {
          if (/^[\s"'„“«‚‘]*$/u.test(v.text.slice(0, m.od))) znacky.push({ ...m, od: m.od + v.od, do: m.do + v.od });
        }
      }
    }
    const a = obsah(posledne.map(v => v.text).join(' '));
    const b = obsah((p.nadpis?.text ?? '') + ' ' + (p.telo[0]?.text ?? ''));
    const union = new Set([...a, ...b]).size;
    const J = union ? [...a].filter(w => b.has(w)).length / union : 0;
    for (const m of znacky) pridaj(m, 'pointa');
    const z = znacky.map(m => { const r = norm.rozsah(m.od, m.do); return original.slice(r.od, r.do); });
    merania.M3 = { skore: Math.min(100, (z.length ? 60 : 0) + lin(J, ...j.PRAHY.M3) * .4), znacka: z[0] ?? null, znacky: z, J, rozsah: posledne.length ? norm.rozsah(posledne[0].od, posledne.at(-1).do) : null };

    const cisla = regexZhody(telo, /\d+(?:[ .\u00a0]\d{3})*(?:[.,]\d+)?%?/gu);
    const mena = p.vsetky.flatMap(v => slova(v.text).slice(jazyk === 'de' ? 0 : 1).filter(w => (jazyk === 'de' ? /^(?:[A-ZÄÖÜ]{2,6})$|\p{Ll}\p{Lu}/u.test(w.text) : /^\p{Lu}/u.test(w.text) && w.text !== 'I') && !funk.has(w.text.toLowerCase()))
      .map(w => ({ ...w, od: w.od + v.od, do: w.do + v.od })));
    const citacie = regexZhody(telo, /„[^“”]+[“”]|“[^”]+”|«[^»]+»|‚[^']+'|"[^"]+"|(?<!\p{L})'[^']+'(?!\p{L})/gu).filter(m => slova(m.text).length >= 2);
    const zatvorky = regexZhody(telo, /\([^()]*\)/gu).filter(m => slova(m.text).length >= 2);
    const odbocky = zhody(telo, j.ODBOCKY);
    for (const m of [...cisla, ...citacie, ...zatvorky, ...odbocky]) pridaj(m, 'konkretnost', start);
    for (const m of mena) pridaj(m, 'konkretnost');
    const k = percent(cisla.length + mena.length + 2 * (citacie.length + zatvorky.length + odbocky.length));
    meranie('M4', k, { cisla: cisla.length, mena: mena.length, citacie: citacie.length, zatvorky: zatvorky.length, odbocky: odbocky.length });
    const neistota = zhody(telo, j.NEISTOTA);
    // Bez sémantického modelu: hneď zodpovedané = nasleduje explicitná odpoveď.
    const otazky = p.vsetky.filter((v, i) => /\?/.test(v.text) && !j.ODPOVED.test(p.vsetky[i + 1]?.text ?? ''));
    for (const m of neistota) pridaj(m, 'otvorenost', start);
    for (const m of otazky) pridaj(m, 'otvorenost');
    meranie('M5', percent(neistota.length + otazky.length), { otazky: otazky.length, neistota: neistota.length });
  }
  vysledok.merania = Object.fromEntries(Object.entries(merania).sort(([a], [b]) => a < b ? -1 : 1));
  const polozky = Object.entries(vysledok.merania);
  vysledok.index = Math.round(polozky.reduce((s, [id, m]) => s + j.VAHY[id] * m.skore, 0) / polozky.reduce((s, [id]) => s + j.VAHY[id], 0));
  vysledok.pasmo = pasmo(vysledok.index, j);
  vysledok.ciastocny = polozky.length < 9;
  vysledok.zvyraznenia = highlights.sort((a, b) => a.od - b.od || a.do - b.do || (a.typ < b.typ ? -1 : a.typ > b.typ ? 1 : 0));
  const pocet = re => (telo.match(re) || []).length;
  // v1.4: počty slov raz, nie 50 prechodov textom (30 000 slov).
  const pocetSlov = new Map();
  for (const w of p.slova) { const s = w.text.toLowerCase(); pocetSlov.set(s, (pocetSlov.get(s) ?? 0) + 1); }
  const osobne = zoznam => percent([...new Set(zoznam.map(x => x.toLowerCase()))].reduce((s, x) => s + (pocetSlov.get(x) ?? 0), 0));
  const zaciatky = Object.create(null);
  for (const v of p.rytmus) {
    const s = slova(v.text).slice(0, 2).map(w => w.text.toLowerCase()).join(' ');
    zaciatky[s] = (zaciatky[s] ?? 0) + 1;
  }
  vysledok.vektor = {
    veta_priemer: priemer(dlzky), veta_cv: cv(dlzky), odsek_priemer: priemer(p.dlzkyOdsekov),
    ciarky_na_vetu: p.rytmus.length ? pocet(/,/g) / p.rytmus.length : 0,
    otazky: percent(pocet(/\?/g)), vykricniky: percent(pocet(/!/g)),
    zatvorky: percent(pocet(/\([^()]*\)/g)), pomlcky: percent(pomlcky.length),
    ja: osobne(j.JA), ty: osobne(j.TY), nominalizacie: merania.M8.hodnota,
    konkretnosti: merania.M4?.hodnota ?? null, frazy: merania.M6.hodnota,
    zaciatky: Object.fromEntries(Object.entries(zaciatky).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 10)),
    funkcne: Object.fromEntries(j.FUNKCNE.slice(0, 50).map(w => [w, (pocetSlov.get(w.toLowerCase()) ?? 0) / W]))
  };
  vysledok.dlzky_viet = dlzky;
  vysledok.dlzky_odsekov = p.dlzkyOdsekov;
  return vysledok;
}
