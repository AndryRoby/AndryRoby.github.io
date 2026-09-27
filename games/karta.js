/* Karta výsledku denných hier: obrázok 1080 x 1350 na zdieľanie.
 * Fable, 27. 9. 2026 (M-plán A, M1: ops/games/VYLEPSENIA-HIER-2026-09-27.md
 * časť 3.5, 4 a 6; vizuálna špecifikácia ops/games/denne-karta/SPEC.md;
 * testy ops/games/karta.test.mjs).
 *
 * Prečo. Hry sa hrajú, ale nikto ich neposiela ďalej (game_share za 7 dní
 * vo výpise nie je): zdieľanie kopírovalo len tri riadky textu. Karta je
 * vec, ktorú človek pošle: dnešné zadanie nakreslené ako výstrižok z novín,
 * čas, pomoc, týždeň a adresa.
 *
 * Čo karta nikdy neukáže: riešenie ani stav buniek hráča. Obraz zadania robí
 * obrazZadania(hra, zadanie) len zo zadania (test ho porovná so zadaním s
 * pokazeným riešením) a rozlozenieKarty nemá parameter pre dosku.
 *
 * Kreslí sa v zariadení na plátno, nič neodchádza na server. Zdieľanie:
 *   1. dotyk a zariadenie vie poslať súbor: systémový hárok s obrázkom (how: image),
 *   2. dotyk bez súborov: hárok s textom (how: text),
 *   3. počítač: stiahnutie PNG a text do schránky (how: download),
 *   4. dotyk bez hárku (webview Instagramu či Facebooku): text do schránky a
 *      pokus o stiahnutie, ktoré tam prehliadač často ticho zahodí (how: text),
 *   5. schránka nejde: text v poli na ručné skopírovanie.
 * Udalosť Umami game_share { game, how, level }; zrušený hárok sa nepočíta.
 * Príchod z odkazu na karte (?ref=card) pošle raz game_open_ref, až keď beží
 * Umami (jeho skript má defer a je za game.js, pri načítaní modulu ešte nie je).
 *
 * Po vyriešení (kolo 2, kontrola 1 nález 2): v prilepenej lište tlačidiel sú
 * Undo, Redo, Clear, Hint a Check mŕtve a karta je pod okrajom okna. Lišta
 * preto dostane namiesto nich Share s malou kartou (v dosahu palca, stránka sa
 * nehýbe); veľký náhľad ostáva pod vetou výsledku. Len s novým hra.css
 * (body.hra-ui --hra-karta: 1), inak ostane Share tam, kde ho má stránka.
 *
 * Kolo 3 (kontrola 2): na karte je zviera hry z Puzzle Village (iso.js sa
 * načíta až pri kreslení), čísla a písmená zadania majú aspoň 20 px, vety
 * stránky o Share a o štatistikách sa za behu prepíšu na pravdivé a mŕtve
 * tlačidlá lišty v momente odídu pružinou exit.
 *
 * Použitie v game.js:
 *   const karta = pripojKartu({ hra: 'hedgehogs', tlacidlo: zdielajBtn,
 *     sprava: zdielanieStav, pole: zdielanieText, blok: zdielanieEl,
 *     stav: stavEl, track, data: dataKarty });
 *   karta.nahlad()                  vyriešený deň po obnovení: blok karty, kreslí hneď
 *   karta.nahlad({ poVlne: true })  v oslave: zoznam prvkov, ktoré prídu s kartou
 *                                   (blok a Share v lište), kreslí až po vlne
 * dataKarty() vracia { hra, datum, dnes, cvicenie, uroven, rozmer, indicie,
 * sekundy, casovac, hints, checks, dni, obraz: obrazZadania(hra, zadanie) },
 * alebo null, kým deň nie je vyriešený.
 * V Node bez DOM sa modul načíta a nerobí nič.
 */
import { trvalaAdresaDna, posunDen } from './okno.mjs?v=1';

export const ROZMER = Object.freeze({ sirka: 1080, vyska: 1350 });

/* Papier z /style/paper.css (:root). Karta ide do chatov a na siete ako
 * výstrižok, preto svetlý papier, nie tmavá obrazovka hry. Kontrast testuje
 * karta.test.mjs (text 4,5 : 1, značky 3 : 1). */
export const PALETA = Object.freeze({
  papier: '#faf9f5',
  atrament: '#141413',
  telo: '#3d3d3a',
  tichy: '#5e5d59',
  tehla: '#b23a1d',
  zelena: '#4a6b3f',
  linka: '#e4e2d8',
  mriezka: '#cfcabb',
  kamen: '#5e5d59',
  tmava: '#2b2a27',
  uhlopriecka: '#6b6a64',
  tony: Object.freeze(['#f5f2ea', '#e9e4d6', '#f0e4db', '#e4e8dc', '#ebe7e1']),
  pary: Object.freeze(['#b23a1d', '#2d5b8a', '#2f6b4f', '#8a5a12', '#6b3f7a', '#1f6f78', '#5a6420', '#4a4f5c', '#a0356b', '#7a4a2a']),
  // sovy (Owls) a strom (Beavers) v farbách hier, na papieri s atramentovým obrysom
  sova: Object.freeze({ denTelo: '#fffdf9', denKridla: '#d3cbba', denTvar: '#a89c86', nocTelo: '#8a7f6d', nocTvar: '#5c5347', oko: '#221d17', svetla: '#f6f4ef', korunaPlocha: '#dee2d8', kmen: '#8a6a45' }),
  // Atramenty zvieratiek Puzzle Village (village/riso.js INK) na farbách karty:
  // tlmené, aby sa k výstrižku hodili; tieň (dots) je svetlý tón papiera.
  atramenty: Object.freeze({ paper: '#faf9f5', night: '#141413', orange: '#b23a1d', sun: '#96671a', blue: '#2d5b8a', green: '#2f6b4f', teal: '#1f6f78', pink: '#a0356b', plum: '#6b3f7a', dots: '#e2ddcf' }),
});

/* 14 hier a ich vzor ovládania (ops/spec-hry-ux.md časť 1). */
export const HRY = Object.freeze({
  hedgehogs: Object.freeze({ nazov: 'Hedgehogs', vzor: 'D' }),
  magpies: Object.freeze({ nazov: 'Magpies', vzor: 'D' }),
  voles: Object.freeze({ nazov: 'Voles', vzor: 'D' }),
  dormice: Object.freeze({ nazov: 'Dormice', vzor: 'D' }),
  owls: Object.freeze({ nazov: 'Owls', vzor: 'D' }),
  beavers: Object.freeze({ nazov: 'Beavers', vzor: 'D' }),
  foxes: Object.freeze({ nazov: 'Foxes', vzor: 'D' }),
  badgers: Object.freeze({ nazov: 'Badgers', vzor: 'A' }),
  squirrels: Object.freeze({ nazov: 'Squirrels', vzor: 'A' }),
  hares: Object.freeze({ nazov: 'Hares', vzor: 'A' }),
  otters: Object.freeze({ nazov: 'Otters', vzor: 'B1' }),
  cranes: Object.freeze({ nazov: 'Cranes', vzor: 'B2' }),
  herons: Object.freeze({ nazov: 'Herons', vzor: 'C' }),
  swans: Object.freeze({ nazov: 'Swans', vzor: 'C' }),
});

const SANS = '"ARLing Sans", system-ui, -apple-system, "Segoe UI", sans-serif';
const SERIF = '"ARLing Serif", Georgia, "Times New Roman", serif';
const pismo = (rez, velkost, rodina) => rez + ' ' + velkost + 'px ' + (rodina === 'serif' ? SERIF : SANS);

/* ── Kontrast podľa WCAG 2 ────────────────────────────────────────────── */
function kanal(c) { const x = c / 255; return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }
function jas(hex) {
  const h = String(hex).replace('#', '');
  return 0.2126 * kanal(parseInt(h.slice(0, 2), 16)) + 0.7152 * kanal(parseInt(h.slice(2, 4), 16)) + 0.0722 * kanal(parseInt(h.slice(4, 6), 16));
}
export function pomerKontrastu(a, b) {
  const x = jas(a), y = jas(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/* ── Dátum, adresa, týždeň ────────────────────────────────────────────── */
const DNI = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MESIACE = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function kratkyDen(iso) {
  const t = new Date(iso + 'T12:00:00Z');
  return DNI[t.getUTCDay()] + ' ' + t.getUTCDate() + ' ' + MESIACE[t.getUTCMonth()] + ' ' + t.getUTCFullYear();
}
function menoSady(sada) {
  const [u, c] = String(sada || '').split('-');
  return (u ? u.charAt(0).toUpperCase() + u.slice(1) : 'Practice') + ' practice' + (c ? ' ' + c : '');
}

/* Adresa na karte: dnešok stránka hry, starší deň trvalé ?d= (okno.mjs), cvičenie stránka sady. */
export function adresaKarty({ hra, datum, dnes, cvicenie } = {}) {
  const zaklad = '/games/' + hra + '/';
  if (cvicenie) return 'arling.sk' + zaklad + 'practice/' + cvicenie.sada + '/' + (cvicenie.k > 1 ? cvicenie.k + '/' : '');
  if (!datum || datum === dnes) return 'arling.sk' + zaklad;
  return 'arling.sk' + trvalaAdresaDna(zaklad, datum);
}

function citajUlozisko(kluc) {
  try {
    if (typeof localStorage === 'undefined' || !localStorage) return null;
    const s = localStorage.getItem(kluc);
    return s ? JSON.parse(s) : null;
  } catch (e) { return null; }
}

/* Dni týždňa (alebo zadania cvičnej sady) a ich stav z uložených dní hry,
 * kľúče <hra>:<dátum> a <hra>:p:<sada>:<k> (rovnaké vo všetkých 14 hrách). */
export function tyzdenKarty({ hra, dni, dnes, datum, cvicenie, citaj = citajUlozisko } = {}) {
  const precitaj = (k) => { try { return citaj(k); } catch (e) { return null; } };
  if (cvicenie) {
    const out = [];
    for (let k = 1; k <= (cvicenie.pocet || 0); k++) {
      const s = precitaj(hra + ':p:' + cvicenie.sada + ':' + k);
      out.push({ d: String(k), stav: s && s.done ? 'hotovo' : 'nic', dnes: k === cvicenie.k });
    }
    return out;
  }
  return (dni || []).map((d) => {
    const s = precitaj(hra + ':' + d);
    return { d, stav: s && s.done ? 'hotovo' : dnes && d > dnes ? 'buduci' : 'nic', dnes: d === datum };
  });
}

/* Živá séria dní; len na karte dnešného dňa. */
export function seriaKarty({ hra, dnes, datum, citaj = citajUlozisko } = {}) {
  if (!datum || datum !== dnes) return 0;
  let s = null;
  try { s = citaj(hra + ':streak'); } catch (e) { s = null; }
  if (!s || !s.pocet) return 0;
  return s.posledny === dnes || s.posledny === posunDen(dnes, -1) ? s.pocet : 0;
}

function textPomoci(hints, checks) {
  const casti = [];
  if (hints) casti.push(hints + (hints === 1 ? ' hint' : ' hints'));
  if (checks) casti.push(checks + (checks === 1 ? ' check' : ' checks'));
  return casti.join(' and ');
}
function textCasu(sekundy, casovac) {
  if (casovac === false || !(sekundy > 0)) return null;
  const s = Math.round(sekundy);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0');
}

/* ── Rozloženie karty (čisté) ─────────────────────────────────────────── *
 * Dostane len to, čo hra zmerala (čas, pomoc, dni), nikdy dosku ani riešenie.
 * Súradnice sú v pixeloch karty 1080 x 1350, y je základná čiara textu. */
const OKRAJ = 96;
const PRAVY = ROZMER.sirka - OKRAJ;
export const ZADANIE_BOX = Object.freeze({ x: OKRAJ, y: 372, w: ROZMER.sirka - 2 * OKRAJ, h: 596 });
/* Zviera hry ako malá značka pri názve (kontrola 2, nález 1): rámček vpravo
 * na riadku názvu (najdlhší názov „Hedgehogs.“ končí okolo x 782), nohy na
 * základnej čiare názvu, zarovnané k pravému okraju ako dátum nad ním. */
export const ZVIERA_RAM = Object.freeze({ x: PRAVY - 120, y: 146, w: 120, h: 140, zem: 256 });
export const ZVIERA_NAJVIAC = 120;   // px, väčší rozmer značky (M-plán: 96 až 120)
/* Hra a jej zvieratko v games/village/iso.js (Puzzle Village). */
export const ZVIERATA = Object.freeze({
  hedgehogs: 'hedgehog', magpies: 'magpie', otters: 'otter', cranes: 'crane', swans: 'swan', voles: 'vole', squirrels: 'squirrel',
  herons: 'heron', badgers: 'badger', hares: 'hare', dormice: 'dormouse', owls: 'owl', beavers: 'beaver', foxes: 'fox',
});

export function rozlozenieKarty({ hra, datum, dnes, cvicenie, uroven, rozmer, indicie, sekundy, casovac, hints, checks, tyzden, seria }) {
  const P = PALETA;
  const hraInfo = HRY[hra] || { nazov: String(hra || ''), vzor: 'D' };
  const texty = [];
  const text = (id, t, x, y, rez, velkost, rodina, farba, zarovnanie = 'left', rozostup = 0) => {
    texty.push({ id, text: t, x, y, rez, velkost, rodina, font: pismo(rez, velkost, rodina), farba, zarovnanie, rozostup });
  };
  const denny = !cvicenie;
  // Hlavička: čo to je a kedy (pre všetkých ten istý deň).
  text('hlavicka', denny ? 'DAILY PUZZLE' : 'PRACTICE', OKRAJ, 112, 600, 32, 'sans', P.tehla, 'left', 0.12);
  const vpravo = denny
    ? (datum ? kratkyDen(datum).toUpperCase() : '')
    : (String(cvicenie.sada || '').split('-').join(' ').toUpperCase() + ' · NO. ' + (cvicenie.k || 1));
  if (vpravo) text('datum', vpravo, PRAVY, 112, 600, 32, 'sans', P.tichy, 'right', 0.12);
  // Názov a podnadpis.
  text('nazov', hraInfo.nazov + '.', OKRAJ, 256, 600, 128, 'serif', P.atrament);
  const pod = [uroven, rozmer].filter(Boolean);
  if (indicie > 0) pod.push(indicie + (indicie === 1 ? ' clue' : ' clues'));
  if (pod.length) text('podnadpis', pod.join(' · '), OKRAJ, 328, 500, 40, 'sans', P.telo);
  // Čas veľkým písmom, alebo „Solved“, keď hráč hodiny skryl.
  const cas = textCasu(sekundy, casovac);
  const casText = cas || 'Solved';
  text('cas', casText, OKRAJ, 1116, 700, casText.length > 5 ? 112 : 150, 'sans', P.atrament);
  // Pomoc: čisté riešenie zelenou, inak počty.
  const pomoc = textPomoci(hints, checks);
  text('pomoc', pomoc ? 'With ' + pomoc : 'Clean: no hint, no check', OKRAJ, 1178, 600, 36, 'sans', pomoc ? P.telo : P.zelena);
  // Týždeň (alebo sada) ako bodky vpravo pri čase.
  const dni = Array.isArray(tyzden) ? tyzden : [];
  const velke = dni.length <= 7;
  const r = velke ? 20 : 16, krok = velke ? 56 : 48, okolo = velke ? 7 : 6;
  const bodky = dni.map((x, i) => {
    const cx = PRAVY - r - okolo - 1.5 - (dni.length - 1 - i) * krok;   // miesto na krúžok dňa karty
    const typ = x.stav === 'hotovo' ? 'plna' : x.stav === 'buduci' ? 'mala' : 'kruzok';
    return { x: cx, y: 1062, r, stav: x.stav, dnes: !!x.dnes, typ, farba: typ === 'plna' ? P.zelena : P.tichy, obruc: x.dnes ? P.atrament : null, okolo };
  });
  const popis = !denny ? 'This set' : seria >= 2 && datum && datum === dnes ? 'Streak ' + seria + ' days' : 'This week';
  if (dni.length) text('seria', popis, PRAVY, 1178, 600, 32, 'sans', P.tichy, 'right');
  // Adresa: jeden riadok, alebo dva (do 32 znakov), keď je dlhšia.
  const adresa = adresaKarty({ hra, datum, dnes, cvicenie });
  const zlom = ('arling.sk/games/' + hra + '/').length;
  const riadky = adresa.length <= 32 ? [adresa] : [adresa.slice(0, zlom), adresa.slice(zlom)];
  if (riadky.length === 1) text('adresa', riadky[0], OKRAJ, 1284, 600, 34, 'sans', P.atrament);
  else { text('adresa', riadky[0], OKRAJ, 1264, 600, 32, 'sans', P.atrament); text('adresa', riadky[1], OKRAJ, 1304, 600, 32, 'sans', P.atrament); }
  return {
    sirka: ROZMER.sirka,
    vyska: ROZMER.vyska,
    vzor: hraInfo.vzor,
    pozadie: P.papier,
    texty,
    linky: [
      { x1: OKRAJ, y1: 138, x2: PRAVY, y2: 138, farba: P.linka, hrubka: 2 },
      { x1: OKRAJ, y1: 1212, x2: PRAVY, y2: 1212, farba: P.linka, hrubka: 2 },
    ],
    bodky,
    zadanieBox: { ...ZADANIE_BOX },
    znacka: { x: PRAVY - 78, y: riadky.length === 1 ? 1252 : 1258, w: 78, h: 34 },
    zviera: ZVIERATA[hra] ? { meno: ZVIERATA[hra], ...ZVIERA_RAM } : null,
    adresa,
  };
}

/* Text do chatu: deň a úroveň, výsledok, týždeň ako 7 štvorčekov (dni, nie
 * bunky), odkaz s ref=card. */
export function textKarty({ hra, datum, dnes, cvicenie, uroven, sekundy, casovac, hints, checks, tyzden }) {
  const meno = (HRY[hra] || { nazov: String(hra || '') }).nazov;
  const riadky = [];
  if (cvicenie) riadky.push(meno + ' · ' + menoSady(cvicenie.sada) + ', no. ' + (cvicenie.k || 1));
  else riadky.push([meno, datum ? kratkyDen(datum) : '', uroven].filter(Boolean).join(' · '));
  const cas = textCasu(sekundy, casovac);
  const pomoc = textPomoci(hints, checks);
  riadky.push('Solved' + (cas ? ' in ' + cas : '') + (pomoc ? ' with ' + pomoc : ', clean: no hint, no check'));
  if (!cvicenie && Array.isArray(tyzden) && tyzden.length) {
    // Len dni po dnešok: prázdny štvorček pre budúci deň by sa čítal ako
    // zmeškaný (v pondelok „■□□□□□□“), kontrola 1, nález 5.
    const dni = tyzden.filter((x) => x.stav !== 'buduci');
    if (dni.length) riadky.push('This week ' + dni.map((x) => (x.stav === 'hotovo' ? '■' : '□')).join(''));
  }
  const adresa = 'https://' + adresaKarty({ hra, datum, dnes, cvicenie });
  riadky.push(adresa + (adresa.includes('?') ? '&' : '?') + 'ref=card');
  return riadky.join('\n');
}

/* ── Obraz zadania: len zadanie, nikdy riešenie ───────────────────────── */
function bloky(n) {
  if (n === 9) return { v: 3, s: 3 };
  if (n === 6) return { v: 2, s: 3 };
  if (n === 4) return { v: 2, s: 2 };
  const b = Math.round(Math.sqrt(n));
  return b * b === n ? { v: b, s: b } : null;
}
const OBRAZY = {
  hedgehogs: (z) => ({ vzor: 'D', r: z.n, s: z.n, oblasti: z.regions.flat() }),
  magpies: (z) => ({ vzor: 'D', r: z.n, s: z.n, okraj: { riadky: z.clues.rows.map((a) => a.slice()), stlpce: z.clues.cols.map((a) => a.slice()) } }),
  voles: (z) => ({ vzor: 'D', r: z.n, s: z.n, cisla: Array.from(z.clues, (x) => (x == null ? null : x)) }),
  owls: (z) => ({ vzor: 'D', r: z.n, s: z.n, symboly: Array.from(z.givens, (g) => (g === 0 ? 'den' : g === 1 ? 'noc' : null)) }),
  beavers: (z) => {
    const symboly = new Array(z.n * z.n).fill(null);
    for (const t of z.trees) symboly[t] = 'strom';
    return { vzor: 'D', r: z.n, s: z.n, symboly, okraj: { riadky: z.rows.map((x) => [x]), stlpce: z.cols.map((x) => [x]) } };
  },
  foxes: (z) => ({ vzor: 'D', r: z.n, s: z.n, oblasti: Array.from(z.komory), kamene: Array.from(z.kamene), znaky: Array.from(z.znaky), indicie: z.clues.length }),
  dormice: (z) => {
    const k = z.k, N = z.N;
    const znak = (a, i) => (z.cats[a].id === 'when' ? String(i + 1) : String(z.cats[a].items[i]).charAt(0).toUpperCase());
    const stlpce = [], riadky = [0];
    for (let a = 1; a < k; a++) stlpce.push(a);
    for (let a = k - 1; a >= 2; a--) riadky.push(a);
    return {
      vzor: 'D',
      schody: { k, N, stlpce: stlpce.map((a) => Array.from({ length: N }, (_, i) => znak(a, i))), riadky: riadky.map((a) => Array.from({ length: N }, (_, i) => znak(a, i))) },
      indicie: z.clues.length,
    };
  },
  badgers: (z) => ({ vzor: 'A', n: z.n, bloky: bloky(z.n), klietky: z.cages.map((c) => ({ sum: c.sum, cells: Array.from(c.cells) })) }),
  squirrels: (z) => ({ vzor: 'A', n: z.n, kakuro: z.cells.map((c) => (c ? { r: c.r == null ? null : c.r, d: c.d == null ? null : c.d } : null)) }),
  hares: (z) => ({ vzor: 'A', n: z.n, bloky: bloky(z.n), dane: Array.from(z.givens) }),
  otters: (z) => ({ vzor: 'B1', n: z.n, cisla: Array.from(z.clues, (x) => (x == null ? null : x)) }),
  cranes: (z) => ({ vzor: 'B2', n: z.n, ostrovy: z.islands.map((o) => ({ r: o.r, c: o.c, n: o.n })) }),
  herons: (z) => ({ vzor: 'C', n: z.n, konce: Array.from(z.ends) }),
  swans: (z) => ({ vzor: 'C', n: z.n, perly: Array.from(z.pearls) }),
};
export function obrazZadania(hra, zadanie) {
  const f = OBRAZY[hra];
  if (!f || !zadanie) return null;
  return f(zadanie);
}

/* ── Kreslenie ────────────────────────────────────────────────────────── */

/* Cesty SVG (M, L, H, V, C, S, Q, T, Z, veľké aj malé písmená) ako čiary
 * plátna: rovnaké kreslenie v prehliadači aj v teste. */
function kresliCestu(ctx, d) {
  const t = String(d).match(/[MmLlHhVvCcSsQqTtZz]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) || [];
  let i = 0, x = 0, y = 0, sx = 0, sy = 0, px = 0, py = 0, prikaz = '', pred = '';
  const cislo = () => Number(t[i++]);
  while (i < t.length) {
    if (/[A-Za-z]/.test(t[i])) prikaz = t[i++];
    const rel = prikaz === prikaz.toLowerCase();
    const P = prikaz.toUpperCase();
    if (P === 'Z') { ctx.closePath(); x = sx; y = sy; pred = 'Z'; continue; }
    if (P === 'M') {
      x = cislo() + (rel ? x : 0); y = cislo() + (rel ? y : 0); sx = x; sy = y;
      ctx.moveTo(x, y); prikaz = rel ? 'l' : 'L'; pred = 'M'; continue;
    }
    if (P === 'L') { x = cislo() + (rel ? x : 0); y = cislo() + (rel ? y : 0); ctx.lineTo(x, y); }
    else if (P === 'H') { x = cislo() + (rel ? x : 0); ctx.lineTo(x, y); }
    else if (P === 'V') { y = cislo() + (rel ? y : 0); ctx.lineTo(x, y); }
    else if (P === 'C') {
      const a = cislo() + (rel ? x : 0), b = cislo() + (rel ? y : 0), c = cislo() + (rel ? x : 0), e = cislo() + (rel ? y : 0);
      const nx = cislo() + (rel ? x : 0), ny = cislo() + (rel ? y : 0);
      ctx.bezierCurveTo(a, b, c, e, nx, ny); px = c; py = e; x = nx; y = ny;
    } else if (P === 'S') {
      const a = pred === 'C' || pred === 'S' ? 2 * x - px : x, b = pred === 'C' || pred === 'S' ? 2 * y - py : y;
      const c = cislo() + (rel ? x : 0), e = cislo() + (rel ? y : 0), nx = cislo() + (rel ? x : 0), ny = cislo() + (rel ? y : 0);
      ctx.bezierCurveTo(a, b, c, e, nx, ny); px = c; py = e; x = nx; y = ny;
    } else if (P === 'Q') {
      const a = cislo() + (rel ? x : 0), b = cislo() + (rel ? y : 0), nx = cislo() + (rel ? x : 0), ny = cislo() + (rel ? y : 0);
      ctx.quadraticCurveTo(a, b, nx, ny); px = a; py = b; x = nx; y = ny;
    } else if (P === 'T') {
      const a = pred === 'Q' || pred === 'T' ? 2 * x - px : x, b = pred === 'Q' || pred === 'T' ? 2 * y - py : y;
      const nx = cislo() + (rel ? x : 0), ny = cislo() + (rel ? y : 0);
      ctx.quadraticCurveTo(a, b, nx, ny); px = a; py = b; x = nx; y = ny;
    } else { i++; continue; }
    pred = P;
  }
}

/* Značka ARLing z hlavičky webu (viewBox 488 x 215): písmená a bodka. */
const LOGO_PISMENA = 'M0,213L74,214L181,85L285,214L360,214L206,21L185,4L164,10Z M221,0L263,50L395,50L409,55L419,76L401,96L313,98L411,214L487,214L422,139L457,123L482,88L482,48L463,19L417,0Z';
const LOGO_BODKA = 'M269,66L269,67L268,68L268,70L267,71L267,76L268,77L268,79L270,81L270,82L271,82L273,84L274,84L277,86L279,86L280,87L287,87L288,86L290,86L291,85L294,84L298,80L298,79L299,78L299,75L300,74L300,72L299,71L299,69L298,68L297,65L295,63L294,63L289,60L278,60L277,61L276,61L275,62L272,63Z';
function kresliZnacku(ctx, z) {
  if (!z) return;
  const k = z.h / 215;
  ctx.save();
  ctx.translate(z.x, z.y);
  ctx.scale(k, k);
  ctx.fillStyle = PALETA.atrament;
  ctx.beginPath(); kresliCestu(ctx, LOGO_PISMENA); ctx.fill();
  ctx.fillStyle = PALETA.tehla;
  ctx.beginPath(); kresliCestu(ctx, LOGO_BODKA); ctx.fill();
  ctx.restore();
}

/* Znaky dna vo Foxes (mach, korene, list), 16 x 16, z games/foxes/plocha.mjs. */
const ZNAKY_DNA = [
  'M1.5 14c1.2-2.4 3.4-2.4 4.6 0M6 14c1.2-2.8 3.6-2.8 4.8 0M10.6 14c1-2.2 3-2.2 4 0',
  'M5.5 0v4.2c0 1.6-1.2 2.2-1.2 3.8M10.5 0v3.2c0 1.6 1.3 2.3 1.3 4.2M8 0v2.4',
  'M2.6 13.4C2.6 7.2 6.6 3 13.4 2.6c-.4 6.8-4.6 10.8-10.8 10.8zM2.6 13.4 9 7',
];

function ciara(ctx, x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
function kruh(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); }
/* Číslo na strede: základná čiara 0,36 výšky písma pod stredom (výška číslic
 * asi 0,72 em), rovnako v každom prehliadači. */
function cisloNaStred(ctx, t, x, y, velkost, rez, farba) {
  ctx.font = pismo(rez, velkost, 'sans');
  ctx.fillStyle = farba;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(String(t), x, y + Math.round(velkost * 0.36));
}
/* Mriežka s bunkou s, vycentrovaná v boxe, celé pixely. okrajL a okrajH sú
 * pásy pre čísla pri okraji v násobkoch bunky. */
function umiestni(box, stlpcov, riadkov, najviac, okrajL = 0, okrajH = 0, rezerva = 6) {
  const w = box.w - 2 * rezerva, h = box.h - 2 * rezerva;
  const s = Math.max(4, Math.floor(Math.min(najviac, w / (stlpcov + okrajL), h / (riadkov + okrajH))));
  const L = Math.round(okrajL * s), T = Math.round(okrajH * s);
  const x0 = box.x + rezerva + Math.round((w - stlpcov * s - L) / 2) + L;
  const y0 = box.y + rezerva + Math.round((h - riadkov * s - T) / 2) + T;
  return { s, x0, y0, W: stlpcov * s, H: riadkov * s, L, T };
}
const hrubka = (s) => (s >= 48 ? 6 : 4);

/* Písmo zadania na karte (čísla, súčty, písmená): najmenej 20 px na 1080,
 * v chate okolo 7 px, aj pri Magpies 15 x 15 (kontrola 2, nález 1; predtým
 * 13 px). Pri veľkých mriežkach sa preto zmenší bunka, nie písmo. Test
 * karta.test.mjs prejde 14 hier a všetky dni mesiaca. */
export const PISMO_ZADANIA_MIN = 20;
const pismoZadania = (x) => Math.max(PISMO_ZADANIA_MIN, Math.round(x));
/* Šírka čísla v ARLing Sans 600 (číslice 0,38 až 0,62 em), s rezervou. */
const sirkaCisla = (t, F) => String(t).length * 0.62 * F;
function sirkaTextu(ctx, t, F) {
  try { if (typeof ctx.measureText === 'function') { const w = ctx.measureText(String(t)).width; if (w > 0) return w; } } catch (e) { /* the estimate below */ }
  return sirkaCisla(t, F);
}

/* Mriežka s číslami pri okraji (Magpies, Beavers): pásy pre čísla sa rátajú
 * z písma F, nie z bunky; bunka je najväčšia, pri ktorej sa všetko zmestí a
 * číslo stĺpca sa zmestí do stĺpca. */
function umiestniSOkrajom(box, R, C, okraj, najviac, pomer, rezerva = 6) {
  const w = box.w - 2 * rezerva, h = box.h - 2 * rezerva;
  const naStlpec = Math.max(1, ...okraj.stlpce.map((a) => a.length));
  const cifier = Math.max(1, ...[...okraj.riadky.flat(), ...okraj.stlpce.flat()].map((x) => String(x).length));
  for (let s = Math.floor(Math.min(najviac, w / C, h / R)); s >= 8; s--) {
    const F = pismoZadania(s * pomer);
    const medzera = Math.round(0.45 * F);
    const L = Math.ceil(Math.max(...okraj.riadky.map((a) => a.reduce((x, c) => x + sirkaCisla(c, F), 0) + Math.max(0, a.length - 1) * medzera)) + 0.5 * F);
    const T = Math.ceil(naStlpec * 1.1 * F + 0.3 * F);
    if (L + C * s > w || T + R * s > h) continue;
    if (cifier * 0.62 * F > s - 4 || 0.72 * F > s - 4) continue;
    const x0 = box.x + rezerva + Math.round((w - C * s - L) / 2) + L;
    const y0 = box.y + rezerva + Math.round((h - R * s - T) / 2) + T;
    return { s, F, medzera, x0, y0, W: C * s, H: R * s };
  }
  return null;
}

function tenkaMriezka(ctx, x0, y0, R, C, s, P) {
  ctx.strokeStyle = P.mriezka;
  ctx.lineWidth = 2;
  ctx.lineCap = 'butt';
  for (let c = 1; c < C; c++) ciara(ctx, x0 + c * s, y0, x0 + c * s, y0 + R * s);
  for (let r = 1; r < R; r++) ciara(ctx, x0, y0 + r * s, x0 + C * s, y0 + r * s);
}
function ram(ctx, x0, y0, W, H, s, P) {
  ctx.strokeStyle = P.atrament;
  ctx.lineWidth = hrubka(s);
  ctx.lineJoin = 'miter';
  ctx.beginPath();
  ctx.rect(x0, y0, W, H);
  ctx.stroke();
}

/* Oblasti (záhony, komory) tónmi papiera: susedné oblasti iným tónom. */
function tonyOblasti(oblasti, R, C, pocet) {
  const ids = [...new Set(oblasti)].sort((a, b) => a - b);
  const susedia = new Map(ids.map((i) => [i, new Set()]));
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const a = oblasti[r * C + c];
    if (c + 1 < C && oblasti[r * C + c + 1] !== a) { susedia.get(a).add(oblasti[r * C + c + 1]); susedia.get(oblasti[r * C + c + 1]).add(a); }
    if (r + 1 < R && oblasti[(r + 1) * C + c] !== a) { susedia.get(a).add(oblasti[(r + 1) * C + c]); susedia.get(oblasti[(r + 1) * C + c]).add(a); }
  }
  const ton = new Map();
  for (const id of ids) {
    const pouzite = new Set([...susedia.get(id)].map((x) => ton.get(x)).filter((x) => x !== undefined));
    let f = 0;
    while (pouzite.has(f) && f < pocet - 1) f++;
    ton.set(id, f);
  }
  return ton;
}
function hraniceOblasti(ctx, oblasti, R, C, x0, y0, s, P) {
  ctx.strokeStyle = P.atrament;
  ctx.lineWidth = hrubka(s);
  ctx.lineCap = 'square';
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const a = oblasti[r * C + c];
    if (c + 1 < C && oblasti[r * C + c + 1] !== a) ciara(ctx, x0 + (c + 1) * s, y0 + r * s, x0 + (c + 1) * s, y0 + (r + 1) * s);
    if (r + 1 < R && oblasti[(r + 1) * C + c] !== a) ciara(ctx, x0 + c * s, y0 + (r + 1) * s, x0 + (c + 1) * s, y0 + (r + 1) * s);
  }
  ctx.lineCap = 'butt';
}

/* Sovy a strom sú tie isté kresby ako v hrách (owls/index.html a
 * beavers/index.html, SVG 40 x 40 a 24 x 24), len farby pre papier:
 * denná sova svetlá s atramentovým obrysom, nočná sivohnedá s chocholkami. */
const SOVA_DEN = {
  telo: 'M20 5.5c8.2 0 13.5 5.9 13.5 13.6 0 9.3-5.8 15.9-13.5 15.9S6.5 28.4 6.5 19.1C6.5 11.4 11.8 5.5 20 5.5z',
  kridla: 'M8.4 18.6C6.9 24.4 8.4 30 12.6 33c-1.3-4.4-1.3-9.2.4-13.2zM31.6 18.6c1.5 5.8 0 11.4-4.2 14.4 1.3-4.4 1.3-9.2-.4-13.2z',
  tvar: 'M20 11.6c-1.8-2.7-5.5-3.7-8.1-2.2-2.9 1.6-3.3 5.9-1.4 9.1 2 3.7 5.9 5.9 9.5 7.1 3.6-1.2 7.5-3.4 9.5-7.1 1.9-3.2 1.5-7.5-1.4-9.1-2.6-1.5-6.3-.5-8.1 2.2z',
  zobak: 'M20 18l-1.6 2.4 1.6 2 1.6-2z',
};
const SOVA_NOC = {
  telo: 'M11.6 12.6L10.4 3.6l6 5.6c1.2-.4 2.4-.6 3.6-.6s2.4.2 3.6.6l6-5.6-1.2 9c2.6 2.6 4 6 4 9.9 0 7.8-5.6 12.9-12.4 12.9S7.6 30.3 7.6 22.5c0-3.9 1.4-7.3 4-9.9z',
  tvar: 'M20 14.2c-1.7-2-4.4-2.8-6.9-1.9-3.2 1.2-4.4 5-2.8 8 1.4 2.7 4.8 3.7 7.4 2.2L20 21.2l2.3 1.3c2.6 1.5 6 .5 7.4-2.2 1.6-3 .4-6.8-2.8-8-2.5-.9-5.2-.1-6.9 1.9z',
  zobak: 'M20 21.4l-1.6 2.4 1.6 1.3 1.6-1.3z',
  nohy: 'M14.6 28.2l1.6 1.4 1.6-1.4M22.2 28.2l1.6 1.4 1.6-1.4',
};
const STROM = {
  koruna: 'M12 2.9c-2.9 0-5 2.1-5 4.8 0 .4 0 .8.1 1.1-1.5.8-2.5 2.3-2.5 4 0 2.6 2.1 4.6 4.8 4.6h5.2c2.7 0 4.8-2 4.8-4.6 0-1.7-1-3.2-2.5-4 .1-.3.1-.7.1-1.1 0-2.7-2.1-4.8-5-4.8z',
  kmen: 'M12 21.2v-8.6M12 15.8l-2.4-2.2M12 14.3l2.2-2',
};
function plocha(ctx, d, farba) { ctx.beginPath(); kresliCestu(ctx, d); ctx.fillStyle = farba; ctx.fill(); }
function obrys(ctx, d, farba, sirka) { ctx.beginPath(); kresliCestu(ctx, d); ctx.strokeStyle = farba; ctx.lineWidth = sirka; ctx.stroke(); }
function kresliSovu(ctx, x, y, s, noc, P) {
  const S = P.sova;
  ctx.save();
  ctx.translate(x + s * 0.06, y + s * 0.06);
  ctx.scale(s * 0.88 / 40, s * 0.88 / 40);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (noc) {
    plocha(ctx, SOVA_NOC.telo, S.nocTelo);
    obrys(ctx, SOVA_NOC.telo, P.atrament, 1.4);
    plocha(ctx, SOVA_NOC.tvar, S.nocTvar);
    for (const cx of [15.2, 24.8]) { kruh(ctx, cx, 18, 3.5); ctx.fillStyle = S.svetla; ctx.fill(); kruh(ctx, cx, 18.2, 1.6); ctx.fillStyle = S.oko; ctx.fill(); }
    plocha(ctx, SOVA_NOC.zobak, S.svetla);
    obrys(ctx, SOVA_NOC.nohy, S.nocTvar, 1.2);
  } else {
    plocha(ctx, SOVA_DEN.telo, S.denTelo);
    plocha(ctx, SOVA_DEN.kridla, S.denKridla);
    obrys(ctx, SOVA_DEN.telo, P.atrament, 1.4);
    plocha(ctx, SOVA_DEN.tvar, S.denTelo);
    obrys(ctx, SOVA_DEN.tvar, S.denTvar, 1.4);
    for (const cx of [15.3, 24.7]) { kruh(ctx, cx, 15.9, 3.1); ctx.fillStyle = S.oko; ctx.fill(); kruh(ctx, cx + 1, 14.9, 1); ctx.fillStyle = S.svetla; ctx.fill(); }
    plocha(ctx, SOVA_DEN.zobak, S.nocTelo);
  }
  ctx.restore();
}
function kresliStrom(ctx, x, y, s, P) {
  ctx.save();
  ctx.translate(x + s * 0.1, y + s * 0.1);
  ctx.scale(s * 0.8 / 24, s * 0.8 / 24);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  plocha(ctx, STROM.koruna, P.sova.korunaPlocha);
  obrys(ctx, STROM.koruna, P.zelena, 1.6);
  obrys(ctx, STROM.kmen, P.sova.kmen, 1.6);
  ctx.restore();
}

/* Vzor D: značky v políčku. */
function kresliD(ctx, o, box, P) {
  if (o.schody) return kresliSchody(ctx, o, box, P);
  const R = o.r, C = o.s;
  let pole = null;
  if (o.okraj) {
    const jednotlive = o.okraj.riadky.every((a) => a.length <= 1) && o.okraj.stlpce.every((a) => a.length <= 1);
    pole = umiestniSOkrajom(box, R, C, o.okraj, 84, jednotlive ? 0.44 : 0.4);
    if (!pole) {
      // Nezmestí sa ani pri malej bunke (dnes sa nestáva): pásy v násobkoch bunky, písmo podľa nej.
      const maxR = Math.max(1, ...o.okraj.riadky.map((a) => a.length));
      const maxS = Math.max(1, ...o.okraj.stlpce.map((a) => a.length));
      const u = umiestni(box, C, R, 84, 0.25 + maxR * 0.5, 0.2 + maxS * 0.48);
      pole = { ...u, F: Math.max(10, Math.round(u.s * 0.4)), medzera: Math.round(u.s * 0.5 - u.s * 0.4 * 0.62) };
    }
  }
  const { s, x0, y0, W, H } = pole || umiestni(box, C, R, 84);
  ctx.fillStyle = P.papier;
  ctx.fillRect(x0, y0, W, H);
  if (o.oblasti) {
    const ton = tonyOblasti(o.oblasti, R, C, P.tony.length);
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      ctx.fillStyle = P.tony[ton.get(o.oblasti[r * C + c])];
      ctx.fillRect(x0 + c * s, y0 + r * s, s, s);
    }
  }
  tenkaMriezka(ctx, x0, y0, R, C, s, P);
  if (o.oblasti) hraniceOblasti(ctx, o.oblasti, R, C, x0, y0, s, P);
  if (o.kamene) {
    ctx.fillStyle = P.kamen;
    for (const i of o.kamene) {
      const x = x0 + (i % C) * s + s / 2, y = y0 + Math.floor(i / C) * s + s / 2;
      ctx.beginPath();
      ctx.ellipse(x, y + s * 0.03, s * 0.32, s * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (o.znaky) {
    ctx.strokeStyle = P.tichy;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    o.znaky.forEach((f, i) => {
      if (!(f >= 0) || !ZNAKY_DNA[f]) return;
      ctx.save();
      ctx.translate(x0 + (i % C) * s + s * 0.08, y0 + Math.floor(i / C) * s + s * 0.08);
      ctx.scale(s * 0.84 / 16, s * 0.84 / 16);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      kresliCestu(ctx, ZNAKY_DNA[f]);
      ctx.stroke();
      ctx.restore();
    });
    ctx.lineCap = 'butt';
  }
  if (o.cisla) {
    o.cisla.forEach((x, i) => { if (x != null) cisloNaStred(ctx, x, x0 + (i % C) * s + s / 2, y0 + Math.floor(i / C) * s + s / 2, pismoZadania(s * 0.5), 600, P.atrament); });
  }
  if (o.symboly) {
    o.symboly.forEach((x, i) => {
      if (!x) return;
      const bx = x0 + (i % C) * s, by = y0 + Math.floor(i / C) * s;
      if (x === 'strom') kresliStrom(ctx, bx, by, s, P);
      else kresliSovu(ctx, bx, by, s, x === 'noc', P);
    });
  }
  ram(ctx, x0, y0, W, H, s, P);
  if (o.okraj) {
    // Riadky: čísla zarovnané k doske sprava, s medzerou; stĺpce: nad sebou, spodné pri doske.
    const { F, medzera } = pole;
    ctx.font = pismo(600, F, 'sans');
    ctx.fillStyle = P.atrament;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'right';
    o.okraj.riadky.forEach((a, r) => {
      let x = x0 - Math.round(0.4 * F);
      const y = y0 + r * s + s / 2 + Math.round(F * 0.36);
      for (let k = a.length - 1; k >= 0; k--) {
        ctx.fillText(String(a[k]), x, y);
        x -= sirkaTextu(ctx, a[k], F) + medzera;
      }
    });
    ctx.textAlign = 'center';
    o.okraj.stlpce.forEach((a, c) => {
      a.forEach((x, k) => {
        const y = y0 - Math.round(0.35 * F) - (a.length - 1 - k) * Math.round(1.1 * F);
        ctx.fillText(String(x), x0 + c * s + s / 2, y);
      });
    });
  }
}

/* Dormice: schody tabuliek (k - 1 skupín stĺpcov a riadkov po N), písmená mien. */
function kresliSchody(ctx, o, box, P) {
  const { k, N, stlpce, riadky } = o.schody;
  const G = k - 1;
  const jednotiek = G * N;
  // Pásy pre písmená z písma (najširšie písmeno asi 1 em), bunka najväčšia, pri ktorej sa zmestia.
  const rezerva = 6, w = box.w - 2 * rezerva, h = box.h - 2 * rezerva;
  let s = Math.floor(Math.min(64, w / jednotiek, h / jednotiek)), velkost = 0, L = 0, T = 0;
  for (; s > 8; s--) {
    velkost = pismoZadania(s * 0.46);
    L = Math.ceil(1.4 * velkost);
    T = Math.ceil(1.3 * velkost);
    if (L + jednotiek * s <= w && T + jednotiek * s <= h && velkost <= s - 2) break;
  }
  const x0 = box.x + rezerva + Math.round((w - jednotiek * s - L) / 2) + L;
  const y0 = box.y + rezerva + Math.round((h - jednotiek * s - T) / 2) + T;
  for (let i = 0; i < G; i++) {
    for (let j = 0; j < G; j++) {
      if (!(i === 0 || j < k - 1 - i)) continue;
      const tx = x0 + j * N * s, ty = y0 + i * N * s;
      ctx.fillStyle = P.papier;
      ctx.fillRect(tx, ty, N * s, N * s);
      tenkaMriezka(ctx, tx, ty, N, N, s, P);
      ram(ctx, tx, ty, N * s, N * s, s, P);
    }
  }
  ctx.font = pismo(600, velkost, 'sans');
  ctx.fillStyle = P.telo;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'center';
  stlpce.forEach((pismena, j) => pismena.forEach((t, i) => ctx.fillText(t, x0 + (j * N + i) * s + s / 2, y0 - Math.round(0.4 * velkost))));
  ctx.textAlign = 'right';
  riadky.forEach((pismena, i) => pismena.forEach((t, r) => ctx.fillText(t, x0 - Math.round(0.35 * velkost), y0 + (i * N + r) * s + s / 2 + Math.round(velkost * 0.36))));
}

/* Vzor A: bunky s hodnotami (bloky, klietky, krížový súčet, zadané číslice). */
function kresliA(ctx, o, box, P) {
  const n = o.n;
  const { s, x0, y0, W, H } = umiestni(box, n, n, 84);
  ctx.fillStyle = P.papier;
  ctx.fillRect(x0, y0, W, H);
  if (o.kakuro) {
    o.kakuro.forEach((c, i) => {
      if (!c) return;
      const x = x0 + (i % n) * s, y = y0 + Math.floor(i / n) * s;
      ctx.fillStyle = P.tmava;
      ctx.fillRect(x, y, s, s);
    });
  }
  tenkaMriezka(ctx, x0, y0, n, n, s, P);
  if (o.kakuro) {
    // Súčty v rohoch ako v tlačenom krížovom súčte: vodorovný vpravo hore,
    // zvislý vľavo dole, celé mimo uhlopriečky (pri 12 x 12 bunka 48 px a
    // písmo 20 px, predtým 14 px v strede polovíc).
    const velkost = pismoZadania(s * 0.34);
    const p = Math.max(3, Math.round(s * 0.06));
    o.kakuro.forEach((c, i) => {
      if (!c || (c.r == null && c.d == null)) return;
      const x = x0 + (i % n) * s, y = y0 + Math.floor(i / n) * s;
      ctx.strokeStyle = P.uhlopriecka;
      ctx.lineWidth = 2;
      ciara(ctx, x + 2, y + 2, x + s - 2, y + s - 2);
      ctx.font = pismo(600, velkost, 'sans');
      ctx.fillStyle = P.papier;
      ctx.textBaseline = 'alphabetic';
      if (c.r != null) { ctx.textAlign = 'right'; ctx.fillText(String(c.r), x + s - p, y + p + Math.round(velkost * 0.72)); }
      if (c.d != null) { ctx.textAlign = 'left'; ctx.fillText(String(c.d), x + p, y + s - p); }
    });
  }
  if (o.bloky) {
    ctx.strokeStyle = P.atrament;
    ctx.lineWidth = hrubka(s);
    for (let c = o.bloky.s; c < n; c += o.bloky.s) ciara(ctx, x0 + c * s, y0, x0 + c * s, y0 + H);
    for (let r = o.bloky.v; r < n; r += o.bloky.v) ciara(ctx, x0, y0 + r * s, x0 + W, y0 + r * s);
  }
  if (o.klietky) kresliKlietky(ctx, o.klietky, n, x0, y0, s, P);
  if (o.dane) o.dane.forEach((x, i) => { if (x) cisloNaStred(ctx, x, x0 + (i % n) * s + s / 2, y0 + Math.floor(i / n) * s + s / 2, pismoZadania(s * 0.55), 600, P.atrament); });
  ram(ctx, x0, y0, W, H, s, P);
}

/* Klietky Badgers: obrys prerušovanou čiarou vo vnútri buniek, súčet v rohu. */
function kresliKlietky(ctx, klietky, n, x0, y0, s, P) {
  const d = Math.max(4, Math.round(s * 0.1));
  const vodorovne = [], zvisle = [];
  for (const k of klietky) {
    const v = new Set(k.cells);
    const je = (r, c) => r >= 0 && c >= 0 && r < n && c < n && v.has(r * n + c);
    for (const i of k.cells) {
      const r = Math.floor(i / n), c = i % n;
      const x = x0 + c * s, y = y0 + r * s;
      // hore a dole
      for (const [dr, yy] of [[-1, y + d], [1, y + s - d]]) {
        if (je(r + dr, c)) continue;
        const zac = !je(r, c - 1) ? x + d : je(r + dr, c - 1) ? x - d : x;
        const kon = !je(r, c + 1) ? x + s - d : je(r + dr, c + 1) ? x + s + d : x + s;
        vodorovne.push([yy, zac, kon]);
      }
      // vľavo a vpravo
      for (const [dc, xx] of [[-1, x + d], [1, x + s - d]]) {
        if (je(r, c + dc)) continue;
        const zac = !je(r - 1, c) ? y + d : je(r - 1, c + dc) ? y - d : y;
        const kon = !je(r + 1, c) ? y + s - d : je(r + 1, c + dc) ? y + s + d : y + s;
        zvisle.push([xx, zac, kon]);
      }
    }
  }
  const zluc = (useky) => {
    useky.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const out = [];
    for (const u of useky) {
      const p = out[out.length - 1];
      if (p && p[0] === u[0] && u[1] <= p[2] + 0.5) p[2] = Math.max(p[2], u[2]);
      else out.push(u.slice());
    }
    return out;
  };
  ctx.strokeStyle = P.tichy;
  ctx.lineWidth = 2;
  ctx.setLineDash([Math.max(4, Math.round(s * 0.1)), Math.max(3, Math.round(s * 0.07))]);
  for (const [y, a, b] of zluc(vodorovne)) ciara(ctx, a, y, b, y);
  for (const [x, a, b] of zluc(zvisle)) ciara(ctx, x, a, x, b);
  ctx.setLineDash([]);
  const velkost = pismoZadania(s * 0.26);   // 9 x 9: bunka 64 px, súčet 20 px (predtým 15)
  ctx.font = pismo(600, velkost, 'sans');
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  for (const k of klietky) {
    const prva = Math.min(...k.cells);
    const x = x0 + (prva % n) * s + d - 1, y = y0 + Math.floor(prva / n) * s + d - 1;
    const t = String(k.sum);
    const w = typeof ctx.measureText === 'function' ? ctx.measureText(t).width : t.length * velkost * 0.6;
    ctx.fillStyle = P.papier;
    ctx.fillRect(x - 1, y - 1, Math.ceil(w) + 5, velkost + 3);
    ctx.fillStyle = P.atrament;
    ctx.fillText(t, x + 2, y + Math.round(velkost * 0.86));
  }
}

/* Vzor B1: body v rohoch a čísla v bunkách (Otters). */
function kresliB1(ctx, o, box, P) {
  const n = o.n;
  const { s, x0, y0 } = umiestni(box, n, n, 84, 0, 0, 12);
  const r = Math.max(4, Math.round(s * 0.075));
  ctx.fillStyle = P.atrament;
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) { kruh(ctx, x0 + j * s, y0 + i * s, r); ctx.fill(); }
  o.cisla.forEach((x, i) => { if (x != null) cisloNaStred(ctx, x, x0 + (i % n) * s + s / 2, y0 + Math.floor(i / n) * s + s / 2, pismoZadania(s * 0.5), 600, P.atrament); });
}

/* Vzor B2: ostrovy s číslami na jemnej mriežke bodov (Cranes). */
function kresliB2(ctx, o, box, P) {
  const n = o.n;
  const polomer = 0.44;
  const { s, x0, y0 } = umiestni(box, n - 1 + 2 * polomer, n - 1 + 2 * polomer, 96);
  const ox = x0 + Math.round(polomer * s), oy = y0 + Math.round(polomer * s);
  ctx.fillStyle = P.mriezka;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { kruh(ctx, ox + c * s, oy + r * s, Math.max(2, s * 0.04)); ctx.fill(); }
  const R = Math.round(s * polomer);
  for (const ost of o.ostrovy) {
    const x = ox + ost.c * s, y = oy + ost.r * s;
    kruh(ctx, x, y, R);
    ctx.fillStyle = P.papier;
    ctx.fill();
    ctx.strokeStyle = P.atrament;
    ctx.lineWidth = Math.max(3, Math.round(s * 0.06));
    ctx.stroke();
    cisloNaStred(ctx, ost.n, x, y, pismoZadania(s * 0.5), 600, P.atrament);
  }
}

/* Vzor C: dvojice hniezd (Herons) alebo perly (Swans) v mriežke. */
function kresliC(ctx, o, box, P) {
  const n = o.n;
  const { s, x0, y0, W, H } = umiestni(box, n, n, 84);
  ctx.fillStyle = P.papier;
  ctx.fillRect(x0, y0, W, H);
  tenkaMriezka(ctx, x0, y0, n, n, s, P);
  ram(ctx, x0, y0, W, H, s, P);
  if (o.konce) {
    o.konce.forEach((p, i) => {
      if (!p) return;
      const x = x0 + (i % n) * s + s / 2, y = y0 + Math.floor(i / n) * s + s / 2;
      kruh(ctx, x, y, Math.round(s * 0.34));
      ctx.fillStyle = P.pary[(p - 1) % P.pary.length];
      ctx.fill();
      cisloNaStred(ctx, p, x, y, pismoZadania(s * 0.38), 700, P.papier);
    });
  }
  if (o.perly) {
    o.perly.forEach((p, i) => {
      if (!p) return;
      const x = x0 + (i % n) * s + s / 2, y = y0 + Math.floor(i / n) * s + s / 2;
      const hr = Math.max(3, Math.round(s * 0.07));
      kruh(ctx, x, y, Math.round(s * 0.3) - (p === 1 ? hr / 2 : 0));
      if (p === 1) {
        ctx.fillStyle = P.papier;
        ctx.fill();
        ctx.strokeStyle = P.atrament;
        ctx.lineWidth = hr;
        ctx.stroke();
      } else {
        ctx.fillStyle = P.atrament;
        ctx.fill();
      }
    });
  }
}

/* Zadanie do boxu na karte podľa vzoru; nič nekreslí mimo boxu. */
export function kresliZadanie(ctx, obraz, box = ZADANIE_BOX, P = PALETA) {
  if (!obraz) return;
  ctx.save();
  if (obraz.vzor === 'D') kresliD(ctx, obraz, box, P);
  else if (obraz.vzor === 'A') kresliA(ctx, obraz, box, P);
  else if (obraz.vzor === 'B1') kresliB1(ctx, obraz, box, P);
  else if (obraz.vzor === 'B2') kresliB2(ctx, obraz, box, P);
  else if (obraz.vzor === 'C') kresliC(ctx, obraz, box, P);
  ctx.restore();
}

/* Text s prestrkaním (rozostup v em) kreslený po znakoch: rovnako v každom
 * prehliadači, aj tam, kde plátno letterSpacing nepozná. */
function kresliText(ctx, t) {
  ctx.font = t.font;
  ctx.fillStyle = t.farba;
  ctx.textBaseline = 'alphabetic';
  if (!t.rozostup) {
    ctx.textAlign = t.zarovnanie;
    ctx.fillText(t.text, t.x, t.y);
    return;
  }
  const medzera = t.rozostup * t.velkost;
  const znaky = Array.from(t.text);
  const sirky = znaky.map((z) => ctx.measureText(z).width);
  const spolu = sirky.reduce((a, b) => a + b, 0) + medzera * (znaky.length - 1);
  let x = t.zarovnanie === 'right' ? t.x - spolu : t.zarovnanie === 'center' ? t.x - spolu / 2 : t.x;
  ctx.textAlign = 'left';
  znaky.forEach((z, i) => { ctx.fillText(z, x, t.y); x += sirky[i] + medzera; });
}
function kresliBodku(ctx, b) {
  if (b.typ === 'plna') { kruh(ctx, b.x, b.y, b.r); ctx.fillStyle = b.farba; ctx.fill(); }
  else if (b.typ === 'mala') { kruh(ctx, b.x, b.y, Math.max(4, Math.round(b.r * 0.28))); ctx.fillStyle = b.farba; ctx.fill(); }
  else { kruh(ctx, b.x, b.y, b.r - 1.5); ctx.strokeStyle = b.farba; ctx.lineWidth = 3; ctx.stroke(); }
  if (b.obruc) { kruh(ctx, b.x, b.y, b.r + (b.okolo || 7)); ctx.strokeStyle = b.obruc; ctx.lineWidth = 3; ctx.stroke(); }
}

/* ── Zviera hry (kontrola 2, nález 1) ─────────────────────────────────── *
 * M-plán A chce na karte „meno hry a jej zviera ako malá značka“. Kresby sú
 * zvieratká Puzzle Village (games/village/iso.js, kreslené kódom, bez
 * súborov); iso.js sa načíta až pri kreslení karty (nacitajZvierata), hra
 * ho pri hraní nepotrebuje. Kreslí ich tu ploché pero s rovnakými metódami
 * ako pero dediny (village/riso.js: poly, circle, ellipse, line, path, c):
 * atramenty dediny na farbách PALETA.atramenty, bez zrna, bez multiply a
 * bez posunu tlače. Na svetlom papieri karty by biely žeriav a labuť zmizli,
 * preto má silueta obrys 3 px atramentom (kontrast 17 : 1): štyri ťahy
 * pera, tiene, obrys siluety, papier siluety, farby. Tón s alfou do 0,3 len
 * tieňuje to, čo je pod ním, a čiara tenšia než 4 px (fúzy, nohy volavky)
 * je detail bez obrysu; test karta.test.mjs overí, že taký detail má sám
 * kontrast aspoň 3 : 1. */
export const OBRYS_ZVIERATA = 3;
export const DETAIL_ZVIERATA = 4;
export const PREKRYV_ZVIERATA = 0.3;
export const TAHY_ZVIERATA = Object.freeze(['tien', 'obrys', 'podklad', 'farba']);

class PeroKarty {
  constructor(ctx, tah, P = PALETA) { this.c = ctx; this.tah = tah; this.P = P; this.glow = null; this.posledny = null; }
  /* Tón s alfou do 0,3 (tieň chvosta, bruško) patrí na tvar pred ním: v
   * dedine ho drží multiply, tu orezanie tým tvarom, aby nevytŕčal za obrys
   * (chvost veveričky). Prvý tón bez tvaru pred ním (voda pod labuťou) ostáva. */
  prekryv(ink, a) { return ink !== 'dots' && a <= PREKRYV_ZVIERATA; }
  kresli(ink, a, cesta, dokonci) {
    const c = this.c;
    const orez = this.tah === 'farba' && this.prekryv(ink, a) && this.posledny;
    if (orez) { c.save(); c.beginPath(); this.posledny(); c.clip(); }
    c.beginPath(); cesta(); dokonci();
    if (orez) c.restore();
  }
  /* Patrí tvar do tohto ťahu? sirka > 0 je čiara. */
  patri(ink, a, sirka = 0) {
    if (this.tah === 'meranie') return true;
    if (ink === 'dots') return this.tah === 'tien';
    if (this.tah === 'tien') return false;
    if (this.tah === 'farba') return true;
    return a > PREKRYV_ZVIERATA && !(sirka > 0 && sirka < DETAIL_ZVIERATA);
  }
  farba(ink) { return this.P.atramenty[ink] || this.P.atramenty.night; }
  vypln(ink, a) {
    const c = this.c;
    if (this.tah === 'obrys') {
      c.globalAlpha = 1; c.strokeStyle = this.P.atrament; c.lineWidth = 2 * OBRYS_ZVIERATA; c.lineJoin = 'round'; c.stroke();
      return;
    }
    c.globalAlpha = this.tah === 'podklad' || this.tah === 'tien' ? 1 : a;
    c.fillStyle = this.tah === 'podklad' ? this.P.papier : this.farba(ink);
    c.fill();
  }
  tahni(ink, a, w, cap) {
    const c = this.c;
    c.lineCap = cap; c.lineJoin = 'round';
    c.globalAlpha = this.tah === 'obrys' || this.tah === 'podklad' ? 1 : a;
    c.strokeStyle = this.tah === 'obrys' ? this.P.atrament : this.tah === 'podklad' ? this.P.papier : this.farba(ink);
    c.lineWidth = this.tah === 'obrys' ? w + 2 * OBRYS_ZVIERATA : w;
    c.stroke();
  }
  /* Plný tvar; cesta() ho postaví (aj znova, na orezanie tónu po ňom). */
  tvar(ink, a, cesta) {
    if (this.patri(ink, a)) this.kresli(ink, a, cesta, () => this.vypln(ink, a));
    if (ink !== 'dots' && !this.prekryv(ink, a)) this.posledny = cesta;
  }
  /* Čiara; tón po nej sa neorezáva (čiara nemá plochu). */
  ciara(ink, a, w, cesta, cap) {
    if (this.patri(ink, a, w)) this.kresli(ink, a, cesta, () => this.tahni(ink, a, w, cap));
    if (!this.prekryv(ink, a)) this.posledny = null;
  }
  poly(ink, a, pts) {
    this.tvar(ink, a, () => {
      const c = this.c;
      c.moveTo(pts[0][0], pts[0][1]);
      for (let k = 1; k < pts.length; k++) c.lineTo(pts[k][0], pts[k][1]);
      c.closePath();
    });
  }
  circle(ink, a, x, y, r) { this.tvar(ink, a, () => this.c.arc(x, y, Math.max(r, 0.01), 0, Math.PI * 2)); }
  ellipse(ink, a, x, y, rx, ry, rot = 0, a0 = 0, a1 = Math.PI * 2) {
    this.tvar(ink, a, () => this.c.ellipse(x, y, Math.max(rx, 0.01), Math.max(ry, 0.01), rot, a0, a1));
  }
  line(ink, a, w, pts, cap = 'round') {
    this.ciara(ink, a, w, () => {
      const c = this.c;
      c.moveTo(pts[0][0], pts[0][1]);
      for (let k = 1; k < pts.length; k++) c.lineTo(pts[k][0], pts[k][1]);
    }, cap);
  }
  path(ink, a, fn, stroke = 0) {
    const cesta = () => fn(this.c, 0, 0);
    if (stroke) this.ciara(ink, a, stroke, cesta, 'round');
    else this.tvar(ink, a, cesta);
  }
  text() { /* the animals write nothing */ }
  reset() { this.c.globalAlpha = 1; }
}

/* Kontext, ktorý nič nekreslí, len zmeria, kam by kreslil (obdĺžnik v
 * súradniciach plátna): posun, mierka, otočenie, oblúky, krivky, orezanie. */
class MeraciKontext {
  constructor() {
    this.m = [1, 0, 0, 1, 0, 0]; this.zasobnik = []; this.cesta = []; this.orez = null; this.bod = null;
    this.x0 = Infinity; this.y0 = Infinity; this.x1 = -Infinity; this.y1 = -Infinity;
    this.lineWidth = 1; this.lineCap = 'butt'; this.lineJoin = 'miter'; this.globalAlpha = 1; this.fillStyle = '#000'; this.strokeStyle = '#000';
  }
  save() { this.zasobnik.push({ m: this.m.slice(), orez: this.orez, lineWidth: this.lineWidth }); }
  restore() { const z = this.zasobnik.pop(); if (z) { this.m = z.m; this.orez = z.orez; this.lineWidth = z.lineWidth; } }
  transform(a, b, c, d, e, f) { const m = this.m; this.m = [m[0] * a + m[2] * b, m[1] * a + m[3] * b, m[0] * c + m[2] * d, m[1] * c + m[3] * d, m[0] * e + m[2] * f + m[4], m[1] * e + m[3] * f + m[5]]; }
  translate(x, y) { this.transform(1, 0, 0, 1, x, y); }
  scale(x, y) { this.transform(x, 0, 0, y, 0, 0); }
  rotate(r) { const c = Math.cos(r), s = Math.sin(r); this.transform(c, s, -s, c, 0, 0); }
  t(x, y) { const m = this.m; return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }
  beginPath() { this.cesta = []; this.bod = null; }
  moveTo(x, y) { this.bod = [x, y]; this.cesta.push(this.t(x, y)); }
  lineTo(x, y) { this.bod = [x, y]; this.cesta.push(this.t(x, y)); }
  closePath() {}
  quadraticCurveTo(cx, cy, x, y) {
    const [x0, y0] = this.bod || [cx, cy];
    for (let i = 1; i <= 16; i++) { const t = i / 16, u = 1 - t; this.cesta.push(this.t(u * u * x0 + 2 * u * t * cx + t * t * x, u * u * y0 + 2 * u * t * cy + t * t * y)); }
    this.bod = [x, y];
  }
  bezierCurveTo(ax, ay, bx, by, x, y) {
    const [x0, y0] = this.bod || [ax, ay];
    for (let i = 1; i <= 24; i++) {
      const t = i / 24, u = 1 - t;
      this.cesta.push(this.t(u * u * u * x0 + 3 * u * u * t * ax + 3 * u * t * t * bx + t * t * t * x, u * u * u * y0 + 3 * u * u * t * ay + 3 * u * t * t * by + t * t * t * y));
    }
    this.bod = [x, y];
  }
  ellipse(x, y, rx, ry, rot = 0, a0 = 0, a1 = Math.PI * 2) {
    const kus = a1 >= a0 ? a1 - a0 : a1 - a0 + Math.PI * 2;
    const n = Math.max(8, Math.ceil(96 * Math.min(1, kus / (Math.PI * 2))));
    const cr = Math.cos(rot), sr = Math.sin(rot);
    for (let i = 0; i <= n; i++) {
      const a = a0 + kus * (i / n), ex = rx * Math.cos(a), ey = ry * Math.sin(a);
      this.bod = [x + ex * cr - ey * sr, y + ex * sr + ey * cr];
      this.cesta.push(this.t(this.bod[0], this.bod[1]));
    }
  }
  arc(x, y, r, a0 = 0, a1 = Math.PI * 2) { this.ellipse(x, y, r, r, 0, a0, a1); }
  rect(x, y, w, h) { this.moveTo(x, y); this.lineTo(x + w, y); this.lineTo(x + w, y + h); this.lineTo(x, y + h); }
  pridaj(okolo) {
    for (const [px, py] of this.cesta) {
      let a = px - okolo, b = py - okolo, c = px + okolo, d = py + okolo;
      if (this.orez) { a = Math.max(a, this.orez[0]); b = Math.max(b, this.orez[1]); c = Math.min(c, this.orez[2]); d = Math.min(d, this.orez[3]); if (a > c || b > d) continue; }
      this.x0 = Math.min(this.x0, a); this.y0 = Math.min(this.y0, b); this.x1 = Math.max(this.x1, c); this.y1 = Math.max(this.y1, d);
    }
  }
  fill() { this.pridaj(0); }
  stroke() { const m = this.m; this.pridaj(this.lineWidth * Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) / 2); }
  clip() {
    if (!this.cesta.length) return;
    const xs = this.cesta.map((p) => p[0]), ys = this.cesta.map((p) => p[1]);
    const r = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    this.orez = this.orez ? [Math.max(r[0], this.orez[0]), Math.max(r[1], this.orez[1]), Math.min(r[2], this.orez[2]), Math.min(r[3], this.orez[3])] : r;
  }
  setLineDash() {} getLineDash() { return []; } fillRect() {} fillText() {}
}

/* Čo v dedine kreslí miesto, nie zviera: hraboš vykúka z nory (tie isté
 * pomery ako village/miesta.js:509, hlina a tmavá diera), inak by mal na
 * karte rovno odrezaný spodok. */
const DOPLNKY_ZVIERAT = {
  vole: (p, x, y, s) => { p.ellipse('orange', 0.6, x, y + 0.19 * s, 6.08 * s, 2.85 * s); p.ellipse('night', 0.8, x, y - 0.38 * s, 4.37 * s, 2.09 * s); },
};
function kresliCeleZviera(f, meno, pero, x, y, s) {
  if (DOPLNKY_ZVIERAT[meno]) DOPLNKY_ZVIERAT[meno](pero, x, y, s);
  f(pero, x, y, s, -1, 0, false);
}

/* Rozmery zvieraťa v jeho jednotkách (s = 1, nohy v 0, 0, tvárou doľava):
 * vsetko = každý tvar aj s tieňom a detailmi, silueta = len tvary s obrysom
 * (ten pridá OBRYS_ZVIERATA px na karte). Rovnaké pre každú kartu, preto raz. */
const rozmeryZvierat = new Map();
function zmeraj(f, meno, tah) {
  const m = new MeraciKontext();
  kresliCeleZviera(f, meno, new PeroKarty(m, tah), 0, 0, 1);
  return Number.isFinite(m.x0) ? { x0: m.x0, y0: m.y0, x1: m.x1, y1: m.y1 } : null;
}
export function rozmerZvierata(meno, iso) {
  const ulozene = rozmeryZvierat.get(meno);
  if (ulozene && ulozene.iso === iso) return ulozene.r;
  const f = iso && iso[meno];
  if (typeof f !== 'function') return null;
  const vsetko = zmeraj(f, meno, 'meranie'), silueta = zmeraj(f, meno, 'podklad');
  const r = vsetko && silueta ? { vsetko, silueta } : null;
  rozmeryZvierat.set(meno, { iso, r });
  return r;
}
/* Mierka a poloha zvieraťa v rámčeku: celé vnútri aj s obrysom siluety,
 * nohy na základnej čiare (zem), pravý okraj na pravom okraji rámčeka. Každá
 * hrana je najďalej z dvoch: tvar (v * s) alebo silueta s obrysom (v * s + O),
 * lineárne v s, preto sa najväčšie s dá vypočítať priamo. Čisté. */
export function umiestniZviera(rozmer, ram) {
  if (!rozmer || !ram || !rozmer.vsetko || !rozmer.silueta) return null;
  const O = OBRYS_ZVIERATA, a = rozmer.vsetko, b = rozmer.silueta;
  // [koeficient, konštanta] každej hrany: vľavo a hore záporné smery
  const vpravo = [[a.x1, 0], [b.x1, O]], vlavo = [[-a.x0, 0], [-b.x0, O]];
  const hore = [[-a.y0, 0], [-b.y0, O]], dole = [[a.y1, 0], [b.y1, O]];
  let s = Infinity;
  const obmedz = (hrany1, hrany2, miesto) => {
    for (const [k1, c1] of hrany1) for (const [k2, c2] of (hrany2 || [[0, 0]])) {
      const k = k1 + k2, c = c1 + c2;
      if (k > 0) s = Math.min(s, (miesto - c) / k);
      else if (c > miesto) s = 0;
    }
  };
  obmedz(vpravo, vlavo, ram.w);
  obmedz(hore, null, ram.zem - ram.y);
  obmedz(dole, null, ram.y + ram.h - ram.zem);
  // malá značka: najviac ZVIERA_NAJVIAC px na výšku aj s tieňom (rámček je vyšší, aby sa tieň zmestil pod čiaru)
  obmedz(hore, dole, ZVIERA_NAJVIAC);
  if (!(s > 0) || !Number.isFinite(s)) return null;
  const pravyOkraj = Math.max(a.x1 * s, b.x1 * s + O);
  return { s, x: ram.x + ram.w - pravyOkraj, y: ram.zem };
}
/* Jeden ťah pera (tien, obrys, podklad, farba); test ich skúma po jednom. */
export function kresliZvieraTah(ctx, z, iso, tah, P = PALETA) {
  const f = z && iso ? iso[z.meno] : null;
  const u = f ? umiestniZviera(rozmerZvierata(z.meno, iso), z) : null;
  if (typeof f !== 'function' || !u) return false;
  ctx.save();
  try { kresliCeleZviera(f, z.meno, new PeroKarty(ctx, tah, P), u.x, u.y, u.s); }
  catch (e) { ctx.restore(); return false; }
  ctx.restore();
  return true;
}
/* Nakreslí zviera do rámčeka r.zviera; bez iso.js (ešte sa načítava, alebo
 * sa načítať nedalo) nekreslí nič a karta je celá aj tak. */
export function kresliZviera(ctx, z, iso, P = PALETA) {
  if (!z || !iso) return false;
  for (const tah of TAHY_ZVIERATA) if (!kresliZvieraTah(ctx, z, iso, tah, P)) return false;
  ctx.globalAlpha = 1;
  return true;
}

/* iso.js až keď treba kresliť kartu: raz, potom z pamäte (zvieratModul). */
let zvieratModul = null, zvierataSlub = null;
export function nacitajZvierata() {
  if (zvieratModul) return Promise.resolve(zvieratModul);
  if (!zvierataSlub) {
    zvierataSlub = import('./village/iso.js').then((m) => { zvieratModul = m; return m; }, () => { zvierataSlub = null; return null; });
  }
  return zvierataSlub;
}

/* Celá karta na plátno 1080 x 1350 (pri inej veľkosti plátna volajúci škáluje).
 * iso: modul games/village/iso.js pre zviera hry; bez neho karta bez zvieraťa. */
export function kresliKartu(ctx, r, obraz, iso = null) {
  ctx.save();
  ctx.fillStyle = r.pozadie;
  ctx.fillRect(0, 0, r.sirka, r.vyska);
  ctx.lineCap = 'butt';
  for (const l of r.linky) { ctx.strokeStyle = l.farba; ctx.lineWidth = l.hrubka; ciara(ctx, l.x1, l.y1, l.x2, l.y2); }
  for (const t of r.texty) kresliText(ctx, t);
  for (const b of r.bodky) kresliBodku(ctx, b);
  kresliZadanie(ctx, obraz, r.zadanieBox, PALETA);
  kresliZnacku(ctx, r.znacka);
  if (r.zviera && iso) kresliZviera(ctx, r.zviera, iso);
  ctx.restore();
}

/* ── Prehliadač: plátno, súbor, zdieľanie ─────────────────────────────── */
const PISMA = ['600 132px "ARLing Serif"', '700 150px "ARLing Sans"', '600 32px "ARLing Sans"', '500 40px "ARLing Sans"'];
function pripravPisma() {
  const f = typeof document !== 'undefined' && document && document.fonts;
  if (!f || typeof f.load !== 'function') return Promise.resolve();
  return new Promise((hotovo) => {
    const casovac = setTimeout(hotovo, 2500);
    Promise.all(PISMA.map((x) => f.load(x).catch(() => null))).then(() => { clearTimeout(casovac); hotovo(); }, () => { clearTimeout(casovac); hotovo(); });
  });
}
/* Písma ARLing už načítané (stránka ich má), teda stačí kresliť raz. */
function pismaPripravene() {
  try {
    const f = typeof document !== 'undefined' && document && document.fonts;
    return !!f && typeof f.check === 'function' && PISMA.every((x) => f.check(x));
  } catch (e) { return false; }
}
function doplnData(d) {
  return {
    ...d,
    tyzden: Array.isArray(d.tyzden) ? d.tyzden : tyzdenKarty({ hra: d.hra, dni: d.dni, dnes: d.dnes, datum: d.datum, cvicenie: d.cvicenie }),
    seria: typeof d.seria === 'number' ? d.seria : seriaKarty({ hra: d.hra, dnes: d.dnes, datum: d.datum }),
  };
}
function menoSuboru(d) {
  return d.cvicenie
    ? d.hra + '-practice-' + d.cvicenie.sada + '-' + (d.cvicenie.k || 1) + '.png'
    : d.hra + '-' + (d.datum || d.dnes || 'day') + '.png';
}
function nazovZdielania(d) {
  const meno = (HRY[d.hra] || { nazov: d.hra }).nazov;
  return d.cvicenie ? meno + ', ' + menoSady(d.cvicenie.sada) : meno + (d.datum ? ', ' + kratkyDen(d.datum) : '');
}
function platno(sirka, vyska) {
  const c = document.createElement('canvas');
  c.width = sirka;
  c.height = vyska;
  return c;
}
function nakresli(c, d, iso = zvieratModul) {
  const ctx = c.getContext && c.getContext('2d');
  if (!ctx) return false;
  ctx.save();
  if (c.width !== ROZMER.sirka) ctx.scale(c.width / ROZMER.sirka, c.height / ROZMER.vyska);
  kresliKartu(ctx, rozlozenieKarty(d), d.obraz, iso);
  ctx.restore();
  return true;
}
/* Kým sa zvieratká načítavajú, karta na zdieľanie čaká najviac chvíľu;
 * potom sa kreslí aj bez zvieraťa (zdieľanie nesmie visieť na sieti). */
const CAKAJ_NA_ZVIERA = 1500;
function zvierataNajviac(ms) {
  return Promise.race([nacitajZvierata(), new Promise((ok) => setTimeout(() => ok(null), ms))]);
}
async function pngKarty(d) {
  await Promise.all([pripravPisma(), zvierataNajviac(CAKAJ_NA_ZVIERA)]);
  try {
    const c = platno(ROZMER.sirka, ROZMER.vyska);
    if (!nakresli(c, d) || typeof c.toBlob !== 'function') return null;
    const blob = await new Promise((ok) => c.toBlob((b) => ok(b || null), 'image/png'));
    if (!blob || typeof File !== 'function') return null;
    return new File([blob], menoSuboru(d), { type: 'image/png' });
  } catch (e) { return null; }
}
function dotykove() {
  try { return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches; } catch (e) { return false; }
}
/* Spustí stiahnutie. true znamená len „spustené“: webview ho môže ticho
 * zahodiť, preto texty hovoria „downloading“, nie „saved“. */
function stiahni(subor, meno) {
  try {
    const url = URL.createObjectURL(subor);
    const a = document.createElement('a');
    a.href = url;
    a.download = meno;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) { /* nothing */ } }, 4000);
    return true;
  } catch (e) { return false; }
}
async function skopiruj(text) {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); return true; }
  } catch (e) { /* the old way below */ }
  try {
    const t = document.createElement('textarea');
    t.value = text;
    t.setAttribute('readonly', '');
    t.style.position = 'fixed'; t.style.top = '0'; t.style.left = '0'; t.style.opacity = '0';
    document.body.appendChild(t);
    t.select();
    const ok = document.execCommand('copy');
    t.remove();
    return !!ok;
  } catch (e) { return false; }
}

/* Zdieľanie jednej karty. volby.subor = hotový PNG (hárok sa potom otvorí
 * hneď v tom istom ťuku, čo Safari vyžaduje). Vráti { how, text, cez, ... }
 * (cez: 'harok' alebo 'schranka') alebo { how: null, zrusene: true } po
 * zrušenom hárku; bez DOM null. */
export async function zdielajKartu(data, volby = {}) {
  if (typeof document === 'undefined' || !document || !data) return null;
  const d = doplnData(data);
  const text = textKarty(d);
  const title = nazovZdielania(d);
  const nav = typeof navigator !== 'undefined' ? navigator : null;
  // Systémový hárok len na dotyku (spec časť 3.5); na počítači stiahnutie a schránka.
  const dotyk = dotykove();
  const vieHarok = dotyk && !!nav && typeof nav.share === 'function';
  if (vieHarok) {
    let subor = volby.subor || null;
    if (!subor && typeof nav.canShare === 'function') subor = await pngKarty(d);
    if (subor && typeof nav.canShare === 'function') {
      let smie = false;
      try { smie = nav.canShare({ files: [subor] }); } catch (e) { smie = false; }
      if (smie) {
        try { await nav.share({ files: [subor], text, title }); return { how: 'image', text, cez: 'harok' }; }
        catch (e) { if (e && e.name === 'AbortError') return { how: null, zrusene: true, text }; }
      }
    }
    try { await nav.share({ text, title }); return { how: 'text', text, cez: 'harok' }; }
    catch (e) { if (e && e.name === 'AbortError') return { how: null, zrusene: true, text }; }
  }
  // Počítač (alebo bez hárku): najprv text do schránky, kým ťuk ešte platí
  // (Safari to inak odmietne), potom obrázok na stiahnutie.
  const kopia = skopiruj(text);
  let subor = volby.subor || null;
  if (!subor) subor = await pngKarty(d);
  const stiahnute = subor ? stiahni(subor, menoSuboru(d)) : false;
  const skopirovane = await kopia;
  // Na počítači sťahovanie funguje. Na dotyku bez hárku (webview Instagramu či
  // Facebooku) ho prehliadač často ticho zahodí: tam sa počíta text, ktorý
  // je v schránke alebo v poli (kontrola 1, nález 6).
  const how = stiahnute && !dotyk ? 'download' : 'text';
  return { how, text, cez: 'schranka', stiahnute, skopirovane, dotyk };
}

/* ── Pripojenie k stránke hry ─────────────────────────────────────────── */
const VYSVETLENIE = 'A picture of the puzzle as it started, with your time. Never the solution.';
const NAPIS_LISTY = 'Share your card';
const DRZ_NAPIS = 2600;           // ms, ako dlho ostane v lište správa po zdieľaní
/* V oslave sa náhľad kreslí až po vlne: čelo atramentu dobehne do asi
 * 410 ms a posledná značka dosadá ešte 240 ms (CASY.dosadnutie), teda do
 * asi 650 ms; karta príde o 900 ms (CASY v oslava.js). Kreslenie o 700 ms
 * tak neberie snímky vlne ani popu na slabom telefóne (kontrola 1, nález 8;
 * kontrola 2, nález 9: 480 ms bolo ešte počas dosadnutia). */
export const KRESLIT_PO_VLNE = 700;
const MINI = Object.freeze({ sirka: 24, vyska: 30 });   // karta v tlačidle lišty, CSS px
/* Mŕtve tlačidlá lišty odchádzajú pružinou exit (hra.css, karta-odchod): o
 * 150 ms je z nich 5 %, o 200 ms 1 %, potom zmiznú z riadku (nález 13). */
export const ODCHOD_TLACIDIEL = 200;
const POKUSY_UMAMI = 8;           // po udalosti load ešte najviac 8 pokusov po 400 ms
let prichodZapisany = false;

function obsahuje(a, b) {
  return !!a && !!b && (a === b || (typeof a.contains === 'function' && a.contains(b)));
}

/* ── Pravdivé texty stránky po M1 ─────────────────────────────────────── *
 * Kontrola 2, nález 2: odsek Controls v Cranes, Swans, Herons, Voles a Owls
 * sľuboval, že Share skopíruje jeden riadok a nikdy nie vodu či jazero;
 * teraz Share robí obrázok zadania. Nález 6: veta o štatistikách „Nothing
 * else.“ nespomínala game_share (s how) ani game_open_ref. Obe vety sa
 * prepíšu za behu v stránke aj v paneli Rules (hra-ui.js ho klonuje zo
 * sekcie #rules); natrvalo ich opraví Fable pri prestavbe šablón, potom sa
 * tu nič nenájde a nič sa nezmení. Čisté funkcie testuje karta.test.mjs
 * nad skutočnými šablónami 14 hier. */
const STARA_VETA_SHARE = /(Share|Copy result) (shows up once the (\w+) is solved and )?copies (one|a short) line[^.]*\.( It never copies[^.]*\.)?/;
export const VETA_SHARE = 'makes a picture of the puzzle as it started, with your time, the help you used and your week, never your answer. On a phone it opens the share sheet; on a computer it downloads the picture and copies a short text with the link.';
/* Kde je stará veta o Share a čím ju nahradiť: { od, po, tucne, text } alebo null. */
export function najdiVetuShare(text) {
  const m = STARA_VETA_SHARE.exec(String(text || ''));
  if (!m) return null;
  return { od: m.index, po: m.index + m[0].length, tucne: 'Share', text: ' ' + (m[3] ? 'shows up once the ' + m[3] + ' is solved and ' : '') + VETA_SHARE };
}
const STARE_STATISTIKY = [
  [', and that Check or Hint was used. Nothing else.',
    ', that Check or Hint was used, that a result was shared and how (picture, text or download), and that a visit came from a shared card. Nothing else.'],
  [', and that Check, Hint or Share was used. Nothing else.',
    ', that Check, Hint or Share was used, how a result was shared (picture, text or download), and that a visit came from a shared card. Nothing else.'],
  ['; and that the result was shared, without its text. Nothing else.',
    '; that the result was shared and how (picture, text or download), without its text; and that a visit came from a shared card. Nothing else.'],
];
/* Kde je stará veta o štatistikách a čím ju nahradiť: { od, po, text } alebo null. */
export function najdiVetuStatistik(text) {
  const t = String(text || '');
  for (const [stara, nova] of STARE_STATISTIKY) {
    const i = t.indexOf(stara);
    if (i >= 0) return { od: i, po: i + stara.length, text: nova };
  }
  return null;
}
/* V odseku p nahradí text od..po (indexy do p.textContent) uzlami nove.
 * Prvky celé v rozsahu zmiznú, textové uzly sa rozdelia. Keď by rozsah
 * pretínal prvok (napríklad <b>), nezmení sa nič (false). */
function nahradVOdseku(p, od, po, nove) {
  const plan = [];
  let pos = 0;
  for (const u of Array.from(p.childNodes || [])) {
    const t = u.textContent || '';
    const a = pos, b = pos + t.length;
    pos = b;
    if (b <= od || a >= po) continue;
    if (u.nodeType !== 3 && (a < od || b > po)) return false;
    plan.push({ u, a });
  }
  if (!plan.length) return false;
  const prvy = plan[0], posledny = plan[plan.length - 1];
  const pred = prvy.u.nodeType === 3 ? String(prvy.u.data).slice(0, Math.max(0, od - prvy.a)) : '';
  const za = posledny.u.nodeType === 3 ? String(posledny.u.data).slice(Math.max(0, po - posledny.a)) : '';
  const vloz = [];
  if (pred) vloz.push(document.createTextNode(pred));
  vloz.push(...nove);
  if (za) vloz.push(document.createTextNode(za));
  for (const x of vloz) p.insertBefore(x, prvy.u);
  for (const { u } of plan) p.removeChild(u);
  return true;
}
function odsekyV(koren) {
  return koren && typeof koren.querySelectorAll === 'function' ? Array.from(koren.querySelectorAll('p')) : [];
}
function opravTexty() {
  try {
    const pravidla = [...odsekyV(document.getElementById('rules')), ...odsekyV(document.getElementById('hu-pravidla'))];
    for (const p of pravidla) {
      const s = najdiVetuShare(p.textContent);
      if (!s) continue;
      const b = document.createElement('b');
      b.textContent = s.tucne;
      nahradVOdseku(p, s.od, s.po, [b, document.createTextNode(s.text)]);
    }
    for (const p of odsekyV(document.body)) {
      const t = p.textContent || '';
      if (t.indexOf('Nothing else.') < 0) continue;
      const s = najdiVetuStatistik(t);
      if (s) nahradVOdseku(p, s.od, s.po, [document.createTextNode(s.text)]);
    }
  } catch (e) { /* the page keeps its old words, the game runs on */ }
}

/* Nastavenie Celebration sľubovalo konfety, ktoré už nie sú. */
function opravNastavenie() {
  try {
    const vstup = document.querySelector('input[data-nastavenie="oslava"]');
    const label = vstup && vstup.parentNode;
    if (!label || !label.childNodes) return;
    for (const u of Array.from(label.childNodes)) if (u !== vstup && u.nodeType === 3) label.removeChild(u);
    label.appendChild(document.createTextNode(' Celebration: a wave across the board when you finish'));
  } catch (e) { /* the label stays as it was */ }
}

/* Umami (skript s defer, v stránke za game.js) pri spustení modulu ešte nebeží:
 * udalosť poslaná vtedy by ticho zmizla (kontrola 1, nález 1). Najneskôr pri
 * load už beží; pre istotu ešte niekoľko pokusov. Keď ho niečo blokuje
 * (blokovač reklám), nestane sa nič. */
function umamiBezi() {
  try { return typeof window !== 'undefined' && !!window && !!window.umami && typeof window.umami.track === 'function'; } catch (e) { return false; }
}
function poUmami(f) {
  if (umamiBezi()) { f(); return; }
  let pokusy = 0;
  const skus = () => {
    if (umamiBezi()) { f(); return; }
    if (++pokusy <= POKUSY_UMAMI) setTimeout(skus, 400);
  };
  try {
    if (document.readyState === 'complete' || typeof window === 'undefined' || !window || typeof window.addEventListener !== 'function') skus();
    else window.addEventListener('load', skus, { once: true });
  } catch (e) { skus(); }
}

/* Nový hra.css nastaví na body.hra-ui --hra-karta: 1. Bez neho (starý hra.css
 * z pamäte prehliadača, alebo hra-ui.js neprebehol) ostane Share tam, kde ho
 * má stránka, a lišta sa nemení. */
function novyStyl() {
  try {
    if (typeof getComputedStyle !== 'function' || !document.body) return false;
    return String(getComputedStyle(document.body).getPropertyValue('--hra-karta') || '').trim() === '1';
  } catch (e) { return false; }
}

export function pripojKartu(volby = {}) {
  const nic = { nahlad: () => null, zdielaj: async () => null };
  if (typeof document === 'undefined' || !document) return nic;
  const { hra, tlacidlo = null, sprava = null, pole = null, blok = null, stav = null, data = null } = volby;
  const sleduj = (meno, x) => { try { if (typeof volby.track === 'function') volby.track(meno, x); } catch (e) { /* statistics are not part of the game */ } };

  // Príchod z odkazu na karte: raz za načítanie stránky, keď už beží Umami.
  try {
    const hladanie = typeof location !== 'undefined' && location ? String(location.search || '') : '';
    if (!prichodZapisany && /[?&]ref=card(&|$)/.test(hladanie)) {
      prichodZapisany = true;
      poUmami(() => sleduj('game_open_ref', { game: hra, ref: 'card' }));
    }
  } catch (e) { /* nothing */ }

  try {
    if (tlacidlo) tlacidlo.textContent = 'Share';
    if (blok && sprava) sprava.textContent = VYSVETLENIE;
    opravNastavenie();
    opravTexty();
  } catch (e) { /* the page keeps its old words, the game runs on */ }

  let koren = null, platnoNahladu = null, spravaBloku = sprava, poleBloku = pole;
  let lista = null, mini = null, napisListy = null, casNapisu = null;
  let kluc = null, subor = null, klucSuboru = null, kreslenie = null, nakreslene = false;

  function postavBlok() {
    // Náhľad je pre prst a myš (ťuk zdieľa ako Share). Klávesnica a čítačka
    // majú jedno tlačidlo Share, preto náhľad nie je tlačidlo, nie je v
    // poradí Tab ani v strome čítačky (kontrola 1, nález 10).
    const nahladEl = document.createElement('div');
    nahladEl.className = 'karta-nahlad';
    nahladEl.setAttribute('aria-hidden', 'true');
    // Veľkosť aj priamo v štýle: so starým hra.css by plátno ostalo v plnej
    // veľkosti (kontrola 1, nález 7); nový hra.css dá --karta-w.
    nahladEl.style.width = 'var(--karta-w, 112px)';
    platnoNahladu = document.createElement('canvas');
    const ps = platnoNahladu.style;
    ps.display = 'block'; ps.width = '100%'; ps.height = 'auto';
    nahladEl.appendChild(platnoNahladu);
    nahladEl.addEventListener('click', () => { zdielaj(); });
    if (blok) {
      koren = blok;
      blok.classList.add('s-kartou');
      blok.insertBefore(nahladEl, blok.childNodes[0] || null);
      return;
    }
    // Share je v lište (Cranes, Swans, Herons, Voles): vlastný blok pod #stav.
    koren = document.createElement('div');
    koren.className = 'karta-blok';
    const popis = document.createElement('p');
    popis.className = 'karta-popis';
    popis.setAttribute('aria-live', 'polite');
    popis.textContent = VYSVETLENIE;
    const t = document.createElement('textarea');
    t.className = 'karta-text';
    t.setAttribute('readonly', '');
    t.setAttribute('rows', '4');
    t.setAttribute('aria-label', 'The text to copy');
    t.hidden = true;
    koren.appendChild(nahladEl);
    koren.appendChild(popis);
    koren.appendChild(t);
    spravaBloku = popis;
    poleBloku = t;
    if (stav && stav.parentNode) stav.after(koren);
  }

  /* Po vyriešení sú Undo, Redo, Clear, Hint a Check mŕtve a karta je pod
   * okrajom okna (kontrola 1, nález 2). Prilepená lišta preto dostane Share
   * s malou kartou (triedou karta-lista hra.css ostatné tlačidlá skryje):
   * v dosahu palca, vždy na obrazovke, riadok lišty ostane rovnako vysoký a
   * doska sa nepohne. Share rodiny 1 prejde z bloku pod vetou do lišty.
   * V momente (odchod) mŕtve tlačidlá najprv odídu priehľadnosťou pružinou
   * exit (trieda karta-odchod, hra.css) a až potom zmiznú z riadku; Share
   * medzitým drží miesto len v zozname, v riadku nie je (kontrola 2, nález 13). */
  function doListy(odchod) {
    if (lista || !tlacidlo || !novyStyl()) return;
    const panel = stav && typeof stav.closest === 'function' ? stav.closest('.hra') : null;
    const l = (typeof tlacidlo.closest === 'function' ? tlacidlo.closest('.ovladanie') : null)
      || (panel && typeof panel.querySelector === 'function' ? panel.querySelector('.ovladanie') : null);
    if (!l) return;
    // Hráč s klávesnicou dokončil hru tlačidlom v lište (druhé stlačenie
    // Hint): to tlačidlo teraz zmizne, fokus prejde na Share.
    const fokus = document.activeElement;
    const fokusVListe = !!fokus && fokus !== tlacidlo && obsahuje(l, fokus);
    if (tlacidlo.parentNode !== l) {
      // Pred prvý riadok textu lišty (séria), teda do riadku tlačidiel.
      const riadok = Array.from(l.children || []).find((c) => c.tagName === 'SPAN') || null;
      l.insertBefore(tlacidlo, riadok);
      if (koren && koren.classList) koren.classList.add('karta-bez-share');
    }
    mini = document.createElement('canvas');
    mini.className = 'karta-mini';
    mini.setAttribute('aria-hidden', 'true');
    mini.style.width = MINI.sirka + 'px';
    mini.style.height = MINI.vyska + 'px';
    napisListy = document.createElement('span');
    napisListy.className = 'karta-napis';
    napisListy.textContent = NAPIS_LISTY;
    tlacidlo.textContent = '';
    tlacidlo.appendChild(mini);
    tlacidlo.appendChild(napisListy);
    tlacidlo.classList.remove('btn-line');
    tlacidlo.classList.add('btn-solid', 'karta-zdielaj');
    lista = l;
    if (odchod) {
      l.classList.add('karta-odchod');
      setTimeout(() => { l.classList.remove('karta-odchod'); l.classList.add('karta-lista'); }, ODCHOD_TLACIDIEL);
    } else l.classList.add('karta-lista');
    if (nakreslene) doMini();
    if (fokusVListe) fokusNaShare();
  }
  /* Share je počas oslavy neviditeľný (visibility z oslava.js) a fokus by
   * neprijal: fokus až keď ho vidno, najviac asi 3 s snímok. */
  function fokusNaShare() {
    let snimok = 0;
    const skus = () => {
      if (!tlacidlo || tlacidlo.isConnected === false) return;
      // Kto medzitým dal fokus inam (Tab), tomu ho neberieme.
      const teraz = document.activeElement;
      if (teraz && teraz !== document.body && !obsahuje(lista, teraz)) return;
      if (tlacidlo.style.visibility !== 'hidden') { try { tlacidlo.focus({ preventScroll: true }); } catch (e) { /* nothing */ } return; }
      if (++snimok < 180 && typeof requestAnimationFrame === 'function') requestAnimationFrame(skus);
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(skus); else skus();
  }

  function dpr() {
    return typeof window !== 'undefined' && window && window.devicePixelRatio ? Math.min(3, Math.max(1, window.devicePixelRatio)) : 2;
  }
  /* Malá karta v lište je zmenšenina náhľadu, nič sa nekreslí druhý raz. */
  function doMini() {
    if (!mini || !platnoNahladu) return;
    try {
      const k = dpr();
      mini.width = Math.round(MINI.sirka * k);
      mini.height = Math.round(MINI.vyska * k);
      const c = mini.getContext && mini.getContext('2d');
      if (!c || typeof c.drawImage !== 'function') return;
      c.imageSmoothingQuality = 'high';
      c.drawImage(platnoNahladu, 0, 0, mini.width, mini.height);
    } catch (e) { /* the small card stays plain paper */ }
  }
  function nakresliNahlad(d) {
    if (!platnoNahladu) return;
    const w = Math.round(132 * dpr());
    platnoNahladu.width = w;
    platnoNahladu.height = Math.round(w * ROZMER.vyska / ROZMER.sirka);
    try { nakresli(platnoNahladu, d); } catch (e) { return; /* the preview stays empty, sharing still works */ }
    nakreslene = true;
    doMini();
  }
  /* poVlne: kresliť až po vlne oslavy. Písma ARLing sú na stránke zvyčajne už
   * načítané; keď nie, nakreslí sa hneď s náhradným písmom a znova po nich.
   * Zvieratká (iso.js) sa začnú načítavať hneď pri vyriešení, v oslave sú
   * o 700 ms zvyčajne tu; keď ešte nie, náhľad sa nakreslí bez zvieraťa a
   * znova, keď prídu (nie počas vlny: najskôr o KRESLIT_PO_VLNE). */
  function naplanujKreslenie(d, k, poVlne) {
    if (kreslenie) { clearTimeout(kreslenie); kreslenie = null; }
    const zvierata = nacitajZvierata();
    const kresli = () => {
      if (kluc !== k) return;
      const bezZvierata = !zvieratModul;
      nakresliNahlad(d);
      if (bezZvierata) zvierata.then((m) => { if (m && kluc === k) nakresliNahlad(d); }).catch(() => {});
      if (!pismaPripravene()) pripravPisma().then(() => { if (kluc === k) nakresliNahlad(d); }).catch(() => {});
    };
    if (poVlne) kreslenie = setTimeout(() => { kreslenie = null; kresli(); }, KRESLIT_PO_VLNE);
    else kresli();
  }

  function aktualne() {
    const d0 = typeof data === 'function' ? data() : null;
    if (!d0 || !d0.hra) return null;
    const d = doplnData(d0);
    return { d, k: JSON.stringify([rozlozenieKarty(d), d.obraz || null]) };
  }

  /* Prvky, ktoré prídu s kartou (oslava ich ukáže o 900 ms): blok karty a
   * Share, keď je v lište. Share v bloku ide s blokom. */
  function prvky() {
    const out = [];
    if (koren) out.push(koren);
    if (tlacidlo && !obsahuje(koren, tlacidlo) && typeof tlacidlo.closest === 'function' && tlacidlo.closest('.ovladanie')) out.push(tlacidlo);
    return out;
  }

  /* Nikdy nevyhodí chybu: karta nesmie zastaviť hru.
   *   nahlad()                  blok karty (vyriešený deň po obnovení), kreslí hneď
   *   nahlad({ poVlne })        zoznam prvkov pre oslavu; poVlne: kresliť po vlne
   * Bez volieb vracia jeden prvok ako predtým: starý game.js z pamäte
   * prehliadača ho dáva oslave, ktorá zoznam ešte nepoznala. */
  function nahlad(o) {
    try { nahladBez(o || {}); } catch (e) { /* the game runs on without the card */ }
    if (!o) return koren;
    try { return prvky(); } catch (e) { return koren ? [koren] : []; }
  }
  function nahladBez(o) {
    const a = aktualne();
    if (!a) return;
    if (!koren) postavBlok();
    doListy(!!o.poVlne);
    if (a.k !== kluc) {
      kluc = a.k;
      naplanujKreslenie(a.d, a.k, !!o.poVlne);
      // Veľký PNG až po oslave (keď je prehliadač voľný): hárok sa potom
      // otvorí hneď v tom istom ťuku, čo Safari vyžaduje.
      const k = a.k;
      const vyrob = () => {
        if (kluc !== k) return;
        pngKarty(a.d).then((f) => { if (kluc === k && f) { subor = f; klucSuboru = k; } }).catch(() => {});
      };
      setTimeout(() => {
        if (typeof requestIdleCallback === 'function') requestIdleCallback(vyrob, { timeout: 2000 });
        else vyrob();
      }, 1700);
    }
  }

  function napis(t) { if (spravaBloku) spravaBloku.textContent = t; }
  /* Krátka správa priamo na Share v lište (tam, kam hráč ťukol), potom späť. */
  function napisVListe(t) {
    if (!napisListy) return;
    napisListy.textContent = t;
    if (casNapisu) clearTimeout(casNapisu);
    casNapisu = setTimeout(() => { casNapisu = null; if (napisListy) napisListy.textContent = NAPIS_LISTY; }, DRZ_NAPIS);
  }
  function ukazPole(text) {
    if (!poleBloku) return false;
    poleBloku.value = text;
    poleBloku.hidden = false;
    try { poleBloku.focus(); poleBloku.select(); } catch (e) { /* nothing */ }
    return true;
  }

  let bezi = false;
  async function zdielaj() {
    if (bezi) return null;
    bezi = true;
    try {
      const a = aktualne();
      if (!a) return null;
      const r = await zdielajKartu(a.d, { subor: klucSuboru === a.k ? subor : null });
      if (!r || !r.how) return r;
      sleduj('game_share', { game: hra, how: r.how, level: String(a.d.uroven || '').toLowerCase() });
      const pocitac = r.stiahnute && !r.dotyk;
      if (r.cez === 'harok') {
        napis(r.how === 'image' ? 'Shared. The card shows the puzzle as it started, never the solution.' : 'Shared as text. It says nothing about the cells.');
        napisVListe('Shared');
      } else if (r.skopirovane) {
        if (poleBloku) poleBloku.hidden = true;
        if (pocitac) { napis('Your card is downloading and the text is copied. Nothing was sent anywhere.'); napisVListe('Card downloading, text copied'); }
        else if (r.stiahnute) { napis('The text is copied. The picture may download too, if this browser allows it. Nothing was sent anywhere.'); napisVListe('Text copied'); }
        else { napis('Copied. Nothing was sent anywhere.'); napisVListe('Copied'); }
      } else {
        const zac = pocitac ? 'Your card is downloading. ' : '';
        if (ukazPole(r.text)) napis(zac + 'This browser would not copy for you: the text is in the box.');
        else napis(zac + 'Copying is blocked here. Your text: ' + r.text.split('\n').join(' '));
        napisVListe(pocitac ? 'Card downloading' : 'Copy the text below');
      }
      return r;
    } catch (e) {
      napis('Sharing did not work in this browser. The address is arling.sk/games/' + hra + '/');
      return null;
    } finally { bezi = false; }
  }

  try { if (tlacidlo) tlacidlo.addEventListener('click', () => { zdielaj(); }); } catch (e) { /* no Share button on this page */ }
  return { nahlad, zdielaj };
}
