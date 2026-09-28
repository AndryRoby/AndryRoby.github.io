// Halloween Logic Puzzle Book: film na 20 sekúnd pre tlačiteľnú knihu hlavolamov (Etsy 4583729691, 4,90 €),
// nakreslený a ozvučený kódom (kodfilm engine). Vizuálny jazyk knihy a jej Etsy obrázkov: nočná fialová
// (#150f2b, #2c1a47, #3a1f3d), mesiac (#f6c77a, #e8943a), netopiere, oranžová #f28c28 a #d2601a, krémový text.
// Scény: hák (strana knihy s vyriešeným Nonogramom 2, tekvica svieti v tmavej mriežke, názov od snímky 0),
// obrázok zmizne a ostane prázdne zadanie, prvý krok riešiteľa pomaly (pás šestky vľavo a vpravo, istý prekryv),
// potom zvyšných 21 krokov zrýchlene (nové políčka oranžové, staré čierne, ako strany „How to start“ v knihe),
// v 11,0 s (55 %) zhasne svetlo a tekvica sa rozsvieti, mriežka sa zmenší do obsahu knihy (štyri druhy),
// záver v rovnakom zložení ako hák, ustálený vyše 3 s. Pokus 2 po kontrole ops/ai/kontrola/2026-09-28-film-halloween-kniha.md,
// pokus 3 po ops/ai/kontrola/2026-09-28-film-halloween-kniha-pokus2.md (čas čítania len v plnom kontraste).
// Hádanka je Nonogram 2 „Pumpkin“ zo zadania.json (strana 6 knihy); ten istý je na bezplatnom pine
// products/hlavolamy-halloween/piny.mjs (halloween-skus). test.mjs porovná všetky fakty so zdrojmi.

import { okno, obmedz, lerp, ease, hash, obalka, nahoda } from './engine/cas.js';
import { platno, zrno, zaoblene, pismo } from './engine/kresba.js';
import { hak, format, zona, sprite, spriteRiadku, minPismo, MAX_NAZOV_916 } from './engine/hak.js';

const DLZKA = 20;

// Nadpisy (HALLOWEEN a „Logic Puzzle Book“ v háku a v závere) písmom značky ARLing Draw Text: Draw s pripnutou osou
// DRAW = 1000 (ops/design/PISMO-PRAVIDLA.md, Draw Text je hlavná rodina, Draw efektová). Hák musí byť čitateľný od
// snímky 0 a záver sa musí zhodovať so snímkou 0, preto statická sadzba bez kreslenia. Súbor ten istý ako na stránke
// Asistenta (34,8 kB, ten istý pôvod, CSP default-src 'self'). Hrúbky: názov 680 (tmavé pozadie, pravidlo 700 na 680),
// HALLOWEEN 650 s rozostupom 0,3 em; názov s rozostupom -0,015 em. UI strany knihy a titulky ostávajú ARLing Sans.
const PISMO_DRAW = '/asistent/pismo/ARLingDrawText-VF.woff2?v=684e70c1';
const DRAW = '"ARLing Draw Text", "ARLing Sans", system-ui, sans-serif';
const VAHA_NAZOV = 680, VAHA_KICKER = 650, ROZ_NAZOV = -0.015, ROZ_KICKER = 0.3;

// Farby z knihy (products/hlavolamy-halloween/kniha.mjs: obálka r. 151 až 158, ORANZ r. 30, .obalka r. 287 až 297)
// a Etsy obrázkov (etsy/etsy-1.png). Tekvica vo filme je oranžová ako na Etsy náhľade Nonogramu.
const FARBY = {
  noc1: '#150f2b', noc2: '#2c1a47', noc3: '#3a1f3d', zem: '#0d0a18',
  mesiac: '#f6c77a', mesiacOkraj: '#e8943a',
  krem: '#fbf3e6', krem2: '#e9dcc9', oranz: '#f28c28', oranzTmava: '#d2601a', chipText: '#1b1227',
  papier: '#fffdf8', papierHrana: '#e6dccb', atrament: '#141414', seda: '#6a6a6a', bodka: '#555555',
  tmaMriezky: '#1d1430', tekvicaSvetla: '#ffb04a', tekvica: '#f07d1e', tekvicaTien: '#c9531a',
  stopka: '#7d8f3a', sviecka: '#ffd76a',
};

// Fakty vo filme. Zdroje: products/hlavolamy-halloween/zadania.json (kapitoly[0].zoznam[1] = Nonogram 2,
// 4 kapitoly po 20), obrazky.mjs (Pumpkin), kniha.mjs (TEXTY, rozvrh: strana 6 z 91), etsy/ponuka.json
// (price.listing_eur 4.9), stránka puzzle-books/halloween-logic-puzzle-book/index.html. test.mjs ich porovná.
// Štítok vo filme je adresa obchodu arlingpuzzles.etsy.com (ops/social/zasobnik-q4.mjs ETSY_OBCHOD) bez ceny:
// v Shorte sa nedá kliknúť, takže musí byť priamo cieľ, a Etsy ukazuje cenu v mene diváka (ako film Advent).
// Cena 4.90 € ostáva len na stránke filmu a v odkaze pre čítačky.
export const FAKTY = {
  nazov: 'Halloween Logic Puzzle Book',
  pocet: 80, naKapitolu: 20, strana: 6, stran: 91,
  cena: '4.90',
  adresa: 'arlingpuzzles.etsy.com',
  url: 'https://www.etsy.com/listing/4583729691?utm_source=arling&utm_medium=film&utm_campaign=halloween-logic-puzzle-book',
  hadanka: {
    druh: 'Nonogram', cislo: 2, uroven: 'easy', n: 10, meno: 'Pumpkin',
    riadky: [
      '....##....',
      '.....#....',
      '..######..',
      '.########.',
      '##.####.##',
      '#...##...#',
      '##########',
      '##.#..#.##',
      '.##....##.',
      '..######..'],
    rows: [[2], [1], [6], [8], [2, 4, 2], [1, 2, 1], [10], [2, 1, 1, 2], [2, 2], [6]],
    cols: [[4], [2, 3], [2, 1, 2], [3, 2, 1], [1, 5, 1], [7, 1], [3, 2, 1], [2, 1, 2], [2, 3], [4]],
  },
  // kapitoly knihy: titul z kniha.mjs TEXTY, druh zo zadania.json, ikona ako v knihe (IKONY)
  kapitoly: [
    { titul: 'Hidden Pictures', druh: 'Nonogram', mn: 'Nonograms', ikona: 'tekvica' },
    { titul: 'Moonlit Bridges', druh: 'Hashi', mn: 'Hashi', ikona: 'mesiac' },
    { titul: 'Spooky Sums', druh: 'Kakuro', mn: 'Kakuro', ikona: 'netopier' },
    { titul: 'Graveyard Loops', druh: 'Slitherlink', mn: 'Slitherlink', ikona: 'pavuk' },
  ],
};
const P = FAKTY.hadanka, N = P.n;
const KICKER = 'HALLOWEEN';
const NAZOV = 'Logic Puzzle Book';
// krátka ponuka (kontrola pokus 1: „80 printable puzzles“ a adresa spolu aspoň 3 s)
const VETA = `${FAKTY.pocet} printable puzzles, PDF`;
const CHIP = FAKTY.adresa;
const HLAVA_L = `${P.druh.toUpperCase()} ${P.cislo}`;
const HLAVA_P = `${P.uroven.toUpperCase()} · ${N} × ${N}`;
const HLAVA_P_KRATKO = P.uroven.toUpperCase();
// obsah knihy: len názvy štyroch druhov, spoločné „20 puzzles each“ je v titulku (kontrola pokus 1, nález 2)
const KAP_TEXT = FAKTY.kapitoly.map((k) => k.mn);

const HAK = hak({ drz: 1.3, odchod: 0.6 }); // hák do 1,9 s
// Priblíženie názvu na snímke 0 (engine/hak.js PRIBLIZENIE = 1,035, engine ho neexportuje). Záver sa k nemu
// pomaly priblíži, aby posledná snímka bola snímkou 0 (test.mjs porovná obe snímky).
const PRIBLIZENIE_HAKU = 1.035;
// Prekmit pohybu najviac 3 % (skill arling-film, bod 6): outBack so s = 0,8 prekmitne o 2,3 %.
const PREKMIT = 0.8;

// --- časová os (sekundy) ---
const T = {
  // hák: obrázok odtečie (políčka sa zmenšia po uhlopriečke), tma v mriežke sa rozplynie
  odtokOd: 1.25, odtokKruh: 0.5, odtokDo: 1.95,
  // ukážka prvého kroku (riadok 3, číslo 6): pilulka a pás šestky vľavo, posun doprava, istý prekryv, políčka.
  // Pokus 3: začína v 4,0, aby posun padol do plne čitateľného titulku o šestke (od 4,75)
  riesOd: 4.0, ukazOd: 4.0, posunOd: 4.7, posunDo: 5.45, krok0: 5.6, ukazDo: 6.3,
  // zvyšných 21 krokov zrýchlene (skutočné poradie riešiteľa), posledný v 9,5; dokončenie oddelené rámom a zvonom.
  // Pokus 3: úsek od zvyšku riešenia po dokončenie 3,6 s namiesto 4,6 s (kontrola pokus 2, nález 3)
  rychloOd: 6.4, poslednyKrok: 9.5, riesDo: 9.8, hotovo: 10.0,
  // moment (55 % z 20 s, na dobe 120 BPM): svetlo zhasne, tekvica sa rozsvieti vlnou od stredu
  odhal: 11.0, odhalVlna: 0.5,
  // obsah knihy: hlavička a čísla zmiznú, až potom sa mriežka zmenší do ikony prvého riadku; texty riadkov
  // vchádzajú až po zmenšení a odídu pred rastom (text nikdy cez tekvicu, test.mjs); všetky štyri ustálené
  // v 13,53, teda pred plným kontrastom titulku „20 each.“ (13,55)
  obsahPrecOd: 11.95, obsahPrecDo: 12.25, zmensOd: 12.25, zmensDo: 12.85, kapOd: 12.9, kapKrok: 0.09, kapVstup: 0.36,
  kapPrecOd: 16.15, kapPrecDo: 16.3,
  // záver: mriežka narastie späť, názov, veta, štítok (rovnaké zloženie ako hák), potom hlavička a čísla;
  // ponuka a adresa ustálené okolo 16,83 s do konca (aspoň 3 s v plnom kontraste, test.mjs)
  rastOd: 16.3, rastDo: 17.0, obsahSpatOd: 17.0, obsahSpatDo: 17.3,
  nazov: 16.35, nazovVstup: 0.6, veta: 16.43, vetaVstup: 0.5, chip: 16.51, chipVstup: 0.45, lesk: 17.4, nazovBlizsieOd: 17.1,
};
// Prechod titulkov (nábeh aj miznutie) a vstup zdola. Čas čítania sa počíta len v plnom kontraste na mieste
// (kontrola pokus 2, nález 1): do - od - 2 * PRECHOD aspoň slová / 3 + 0,5 s; test.mjs to meria po snímkach.
const PRECHOD = 0.2, VSTUP_TITULKU = 0.3;

// ---------- hádanka: riešiteľ po riadkoch (čistá funkcia, beží raz pri načítaní) ----------

/** Všetky rozloženia behov clue v riadku dĺžky n, ktoré sedia so známymi políčkami (-1 neznáme). */
function moznosti(clue, n, zname) {
  const out = [];
  const rek = (i, poz, a) => {
    if (i === clue.length) {
      const b = a.slice();
      for (let k = poz; k < n; k++) b[k] = 0;
      for (let k = 0; k < n; k++) if (zname[k] >= 0 && zname[k] !== b[k]) return;
      out.push(b);
      return;
    }
    const treba = clue.slice(i + 1).reduce((s, x) => s + x + 1, 0);
    for (let s = poz; s + clue[i] + treba <= n; s++) {
      const b = a.slice();
      for (let k = poz; k < s; k++) b[k] = 0;
      for (let k = s; k < s + clue[i]; k++) b[k] = 1;
      let np = s + clue[i];
      if (i < clue.length - 1) { b[np] = 0; np++; }
      let ok = true;
      for (let k = poz; k < np; k++) if (zname[k] >= 0 && zname[k] !== b[k]) { ok = false; break; }
      if (ok) rek(i + 1, np, b);
    }
  };
  rek(0, 0, new Array(n).fill(0));
  return out;
}

/**
 * Riešenie po riadkoch bez hádania: prechádza riadky a potom stĺpce, kým niečo pribúda. Krok = jeden riadok
 * alebo stĺpec, v ktorom pribudli isté políčka (tie, ktoré majú rovnakú hodnotu vo všetkých možnostiach).
 */
export function riesKrokmi(rows, cols, n) {
  const g = new Array(n * n).fill(-1), kroky = [];
  for (let kolo = 1, zmena = true; zmena && kolo < 30; kolo++) {
    zmena = false;
    for (const typ of ['r', 'c']) {
      for (let i = 0; i < n; i++) {
        const idx = Array.from({ length: n }, (_, k) => (typ === 'r' ? i * n + k : k * n + i));
        const zname = idx.map((j) => g[j]);
        if (!zname.includes(-1)) continue;
        const m = moznosti(typ === 'r' ? rows[i] : cols[i], n, zname);
        if (!m.length) throw new Error('Halloween film: hádanka nemá riešenie');
        const nove = [];
        for (let k = 0; k < n; k++) {
          if (zname[k] >= 0) continue;
          const v = m[0][k];
          if (m.every((a) => a[k] === v)) { g[idx[k]] = v; nove.push([idx[k], v]); }
        }
        if (nove.length) { zmena = true; kroky.push({ typ, i, nove, kolo }); }
      }
    }
  }
  return { g, kroky };
}

const RIESENIE = P.riadky.join('').split('').map((z) => (z === '#' ? 1 : 0));
const { g: VYRIESENE, kroky: KROKY } = riesKrokmi(P.rows, P.cols, N);
if (VYRIESENE.join('') !== RIESENIE.join('')) throw new Error('Halloween film: riešiteľ nedal obrázok z knihy');

// Ukážka prvého kroku: riadok s jedným číslom, pás tej dĺžky vľavo a vpravo, istý je ich prekryv.
const K0 = KROKY[0], CLUE0 = K0.typ === 'r' ? P.rows[K0.i] : P.cols[K0.i];
if (K0.typ !== 'r' || CLUE0.length !== 1) throw new Error('Halloween film: prvý krok nie je riadok s jedným číslom');
const UKAZKA = { r: K0.i, dlz: CLUE0[0], stred: 2 * CLUE0[0] - N };
if (UKAZKA.stred !== 2 || K0.nove.length !== 2) throw new Error('Halloween film: titulok ukážky hovorí o dvoch stredných políčkach');

// časy krokov: krok 0 v ukážke, zvyšné zrýchlene (0,3 s na začiatku, 0,16 s na konci) do [rychloOd, poslednyKrok]
(function casujKroky() {
  K0.t = T.krok0;
  const zvysne = KROKY.slice(1);
  const d = zvysne.slice(0, -1).map((_, k) => 0.3 - 0.14 * (k / Math.max(1, zvysne.length - 2)));
  const mierka = (T.poslednyKrok - T.rychloOd) / d.reduce((a, b) => a + b, 0);
  let t = T.rychloOd;
  zvysne.forEach((k, i) => { k.t = t; t += (d[i] || 0) * mierka; });
})();

// Titulky na plátne: nadväzujú bez medzier, v plnom kontraste (bez prechodov) aspoň slová / 3 + 0,5 s (test.mjs).
// Pokus 3: „Line by line, without guessing.“ a „Exactly one solution.“ spojené do jedného titulku (o jeden prechod
// menej); „It was a pumpkin all along.“ začína po dokončení mriežky (čierna tekvica je už vidieť), svetlo zhasne
// v 11,0 počas neho; posledný titulok „20 each.“ patrí k zoznamu štyroch druhov (blok spolu aspoň 2,5 s).
const TITULKY = [
  { od: 1.9, do: 4.55, text: 'The numbers hide a picture.' },
  { od: 4.55, do: 7.9, text: `The ${UKAZKA.dlz} always covers the middle two.` },
  { od: 7.9, do: 10.35, text: 'One solution, no guessing.' },
  { od: 10.35, do: 13.35, text: 'It was a pumpkin all along.' },
  { od: 13.35, do: T.nazov, text: `${FAKTY.naKapitolu} each.`, sKapitolami: true },
];

// pre každé políčko: kedy ho riešiteľ určil (plné aj bodka); kedy je riadok alebo stĺpec hotový
const CAS_POLICKA = new Array(N * N).fill(Infinity);
const PORADIE_V_KROKU = new Array(N * N).fill(0);
KROKY.forEach((k) => k.nove.forEach(([j], i) => { CAS_POLICKA[j] = k.t + 0.035 * i; PORADIE_V_KROKU[j] = i; }));
const HOTOVY = { r: new Array(N).fill(Infinity), c: new Array(N).fill(Infinity) };
(function hotoveCiary() {
  const g = new Array(N * N).fill(-1);
  for (const k of KROKY) {
    for (const [j, v] of k.nove) g[j] = v;
    for (let i = 0; i < N; i++) {
      if (HOTOVY.r[i] === Infinity && [...Array(N)].every((_, c) => g[i * N + c] >= 0)) HOTOVY.r[i] = k.t + 0.45;
      if (HOTOVY.c[i] === Infinity && [...Array(N)].every((_, r) => g[r * N + i] >= 0)) HOTOVY.c[i] = k.t + 0.45;
    }
  }
})();

// tvár tekvice: prázdne políčka v riadkoch 3 až 8, ktoré majú plné políčko vľavo aj vpravo v tom istom riadku
const TVAR = [];
for (let r = 3; r <= 8; r++) {
  const riadok = P.riadky[r];
  for (let c = 0; c < N; c++) if (riadok[c] === '.' && riadok.slice(0, c).includes('#') && riadok.slice(c + 1).includes('#')) TVAR.push(r * N + c);
}
// farba tekvice po políčkach: stopka (riadky 0 a 1) zelenohnedá, telo zhora svetlejšie a dole tmavšie (bez rebier,
// aby tvár bola čitateľná)
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mixRGB = (a, b, p) => [a[0] + (b[0] - a[0]) * p, a[1] + (b[1] - a[1]) * p, a[2] + (b[2] - a[2]) * p];
const rgb = (a) => `rgb(${Math.round(a[0])},${Math.round(a[1])},${Math.round(a[2])})`;
const RGB = Object.fromEntries(Object.entries(FARBY).map(([k, v]) => [k, hex(v)]));
const FARBA_TEKVICE = RIESENIE.map((v, j) => {
  const r = Math.floor(j / N), c = j % N;
  if (!v) return null;
  if (r <= 1) return RGB.stopka;
  const zvis = (r - 2) / 7;
  return zvis < 0.45 ? mixRGB(RGB.tekvicaSvetla, RGB.tekvica, zvis / 0.45) : mixRGB(RGB.tekvica, RGB.tekvicaTien, (zvis - 0.45) / 0.55 * 0.8);
});
// Svetlo a tma v mriežke sa menia kruhom zo stredu tekvice (farba nikdy neprejde cez špinavú sivú):
// STRED v jednotkách políčka (x, y), VLNA = vzdialenosť stredu políčka od STRED ako podiel polomeru RMAX.
const STRED = [5, 6];
const RMAX = Math.max(...[[0, 0], [N, 0], [0, N], [N, N]].map(([a, b]) => Math.hypot(a - STRED[0], b - STRED[1])));
const VLNA = RIESENIE.map((_, j) => Math.hypot((j % N) + 0.5 - STRED[0], Math.floor(j / N) + 0.5 - STRED[1]) / RMAX);

// ---------- pomôcky ----------

const kyv = (t, amp, perioda, faza = 0) => amp * Math.sin((2 * Math.PI * t) / perioda + faza);

function sirka(text, vaha, px, rodina) {
  const m = platno(4, 4).getContext('2d');
  m.font = pismo(vaha, px, rodina);
  return m.measureText(text).width;
}
/** Rozostup názvu v em cez ctx.letterSpacing (Chrome), so zachovaným kerningom; bez podpory bez rozostupu. */
function rozostupNazvu(x, px) {
  if ('letterSpacing' in x) x.letterSpacing = `${(ROZ_NAZOV * px).toFixed(2)}px`;
}
function sirkaNazvu(px) {
  const m = platno(4, 4).getContext('2d');
  m.font = pismo(VAHA_NAZOV, px, DRAW);
  rozostupNazvu(m, px);
  return m.measureText(NAZOV).width;
}
/** Text s rozostupom písmen po znakoch (rovnaké v každom prehliadači), vracia šírku. */
function rozostup(x, text, x0, y, roz, zar = 'left', kresli = true) {
  const znaky = [...text], sirky = znaky.map((ch) => x.measureText(ch).width);
  const w = sirky.reduce((a, b) => a + b, 0) + roz * (znaky.length - 1);
  if (!kresli) return w;
  let cx = zar === 'center' ? x0 - w / 2 : zar === 'right' ? x0 - w : x0;
  const pred = x.textAlign;
  x.textAlign = 'left';
  znaky.forEach((ch, i) => { if (ch !== ' ') x.fillText(ch, cx, y); cx += sirky[i] + roz; });
  x.textAlign = pred;
  return w;
}
function sirkaRoz(text, vaha, px, roz, rodina) {
  const m = platno(4, 4).getContext('2d');
  m.font = pismo(vaha, px, rodina);
  return rozostup(m, text, 0, 0, roz, 'left', false);
}

// Netopier z knihy (kniha.mjs BAT_D, viewBox 64 x 30): len príkazy M, L, C, Z v absolútnych súradniciach.
const BAT_D = 'M32 9 L30 4 L28.6 10 C24 10 20 13 18 17 C14 12 8 10 1 11 C5 14 6 18 4 22 C9 20 13 21 15 25 C18 21 23 21 26 24 C28 22 30 23 32 27 C34 23 36 22 38 24 C41 21 46 21 49 25 C51 21 55 20 60 22 C58 18 59 14 63 11 C56 10 50 12 46 17 C44 13 40 10 35.4 10 L34 4 Z';
const BAT = (() => {
  const tok = BAT_D.match(/[MLCZ]|-?\d+(?:\.\d+)?/g), out = [];
  let i = 0;
  while (i < tok.length) {
    const c = tok[i++];
    const k = c === 'C' ? 6 : c === 'Z' ? 0 : 2;
    out.push([c, tok.slice(i, i + k).map(Number)]);
    i += k;
  }
  return out;
})();
function cestaNetopiera(x, ox, oy, s) {
  x.beginPath();
  for (const [c, a] of BAT) {
    const p = a.map((v, i) => (i % 2 ? oy + v * s : ox + v * s));
    if (c === 'M') x.moveTo(p[0], p[1]);
    else if (c === 'L') x.lineTo(p[0], p[1]);
    else if (c === 'C') x.bezierCurveTo(p[0], p[1], p[2], p[3], p[4], p[5]);
    else x.closePath();
  }
}

/** Ikony kapitol z knihy (kniha.mjs IKONY), kreslené v štvorci d x d. */
function kresliIkonu(x, druh, x0, y0, d, farba) {
  x.save();
  x.fillStyle = farba; x.strokeStyle = farba; x.lineCap = 'round';
  if (druh === 'mesiac') {
    // M26 4 A17 17 0 1 0 36 30 A14 14 0 1 1 26 4 Z (viewBox 40): kosák ako rozdiel dvoch kruhov
    const s = d / 40;
    const m = platno(Math.ceil(d), Math.ceil(d)), mx = m.getContext('2d');
    mx.fillStyle = farba;
    mx.beginPath(); mx.arc(19 * s, 21 * s, 17 * s, 0, Math.PI * 2); mx.fill();
    mx.globalCompositeOperation = 'destination-out';
    mx.beginPath(); mx.arc(26.5 * s, 16 * s, 13.2 * s, 0, Math.PI * 2); mx.fill();
    x.drawImage(m, x0, y0, d, d);
  } else if (druh === 'netopier') {
    const s = d / 64;
    cestaNetopiera(x, x0, y0 + (d - 30 * s) / 2, s);
    x.fill();
  } else if (druh === 'pavuk') {
    const s = d / 40, P2 = (a, b) => [x0 + a * s, y0 + b * s];
    x.lineWidth = 2.4 * s;
    const ciary = [[[20, 0], [20, 13]], [[15, 20], [6, 13], [3, 16]], [[15, 23], [4, 22], [1, 26]], [[15, 26], [6, 31], [4, 36]],
      [[25, 20], [34, 13], [37, 16]], [[25, 23], [36, 22], [39, 26]], [[25, 26], [34, 31], [36, 36]]];
    for (const c of ciary) {
      x.beginPath();
      c.forEach(([a, b], i) => { const [px, py] = P2(a, b); if (i) x.lineTo(px, py); else x.moveTo(px, py); });
      x.stroke();
    }
    x.beginPath(); x.ellipse(...P2(20, 17), 4.5 * s, 4 * s, 0, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.ellipse(...P2(20, 26), 6.5 * s, 7.5 * s, 0, 0, Math.PI * 2); x.fill();
  } else { // tekvica (viewBox 48 x 44)
    const s = d / 48, oy = y0 + (d - 44 * s) / 2;
    x.lineWidth = 3 * s;
    x.beginPath(); x.moveTo(x0 + 24 * s, oy + 11 * s); x.bezierCurveTo(x0 + 23 * s, oy + 6 * s, x0 + 25 * s, oy + 3 * s, x0 + 29 * s, oy + 2 * s); x.stroke();
    x.beginPath(); x.ellipse(x0 + 15 * s, oy + 27 * s, 11 * s, 14 * s, 0, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.ellipse(x0 + 33 * s, oy + 27 * s, 11 * s, 14 * s, 0, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.ellipse(x0 + 24 * s, oy + 27 * s, 10 * s, 15.5 * s, 0, 0, Math.PI * 2); x.fill();
    x.strokeStyle = FARBY.papier; x.lineWidth = 1.6 * s; x.stroke();
  }
  x.restore();
}

// ---------- rozloženie ----------

let L = null;

function velkosti(W, H) {
  const F = format(W, H), Z = zona(W, H), s = Math.min(W, H);
  // mp: najmenšie písmo s rezervou 5 % (sprite sa kreslí do celých pixelov)
  const mp = minPismo(W, H) * 1.05;
  const vys = F.druh === 'vysoky', por = F.druh === 'portret', stv = F.druh === 'stvorec';
  return {
    F, Z, s, W, H, mp,
    kickerPx: Math.max(mp, s * (vys ? 0.043 : 0.036)),
    nazovMax: s * (vys ? 0.1 : por ? 0.084 : stv ? 0.072 : 0.085),
    // krátka ponuka je údaj na predaj: 48 až 72 px pri 1080 (ops/design/PISMO-PRAVIDLA.md, časť 4)
    vetaPx: Math.max(mp, s * (vys ? 0.05 : F.druh === 'siroky' ? 0.05 : 0.045)),
    chipPx: Math.max(mp, s * (vys ? 0.04 : F.druh === 'siroky' ? 0.04 : 0.035)),
    capPx: Math.max(mp, s * (vys ? 0.054 : F.druh === 'siroky' ? 0.058 : 0.048)),
    medzera: s * 0.022,
  };
}

/** Názov ako sprite písmom ARLing Draw Text: HALLOWEEN (oranžová, rozostup ako na obálke) a „Logic Puzzle Book“. */
function stavTitul(dpr, R, w, zar) {
  const kp = R.kickerPx, roz = kp * ROZ_KICKER;
  // 9:16: text aj s priblížením háku najviac MAX_NAZOV_916 šírky; inak 94 % stĺpca aj s priblížením
  const maxW = R.F.druh === 'vysoky' ? Math.min(w * 0.94, (R.W * MAX_NAZOV_916 * 0.99) / PRIBLIZENIE_HAKU) : (w * 0.94) / PRIBLIZENIE_HAKU;
  const np = Math.max(R.mp, Math.min(R.nazovMax, (R.nazovMax * maxW) / sirkaNazvu(R.nazovMax)));
  const kw = sirkaRoz(KICKER, VAHA_KICKER, kp, roz, DRAW);
  // rezerva hore a dole: priblíženie háku (1,035 okolo stredu) posunie okraje o 1,75 % výšky;
  // riadkovanie názvu 1,2 (pravidlo písma: veľké tituly aspoň 1,18)
  const yK = kp * 0.14, yN = yK + kp * 1.5, h = yN + np * 1.2 + kp * 0.14;
  const x0 = zar === 'center' ? w / 2 : 0;
  const kresli = (svetly) => (x) => {
    x.textBaseline = 'top';
    x.font = pismo(VAHA_KICKER, kp, DRAW);
    x.fillStyle = svetly ? 'rgba(255,248,235,0.9)' : FARBY.oranz;
    rozostup(x, KICKER, x0, yK, roz, zar);
    x.font = pismo(VAHA_NAZOV, np, DRAW); x.textAlign = zar;
    rozostupNazvu(x, np);
    if (svetly) { x.fillStyle = 'rgba(255,255,255,0.95)'; x.fillText(NAZOV, x0, yN); return; }
    x.fillStyle = 'rgba(8,4,20,0.5)'; x.fillText(NAZOV, x0, yN + np * 0.05);
    const g = x.createLinearGradient(0, yN, 0, yN + np);
    g.addColorStop(0, '#fffaf0'); g.addColorStop(0.55, FARBY.krem); g.addColorStop(1, '#f1dcc0');
    x.fillStyle = g; x.fillText(NAZOV, x0, yN);
  };
  const sp = sprite(dpr, w, h, kresli(false));
  sp.svetly = sprite(dpr, w, h, kresli(true)).c;
  sp.svetly.bezKontroly = true; // odlesk je ten istý text ako názov (test.mjs ho nepočíta druhý raz)
  sp.textW = Math.max(kw, sirkaNazvu(np));
  sp.px = np;
  return sp;
}

/** Oranžový štítok s adresou obchodu na Etsy (tvar ako „PRINTABLE PDF“ na Etsy obrázku). */
function stavChip(dpr, R) {
  const px = R.chipPx, tw = sirka(CHIP, 700, px), w = tw + px * 1.3, h = px * 1.7;
  const sp = sprite(dpr, w, h, (x) => {
    zaoblene(x, 0, 0, w, h, h / 2);
    x.fillStyle = FARBY.oranz; x.fill();
    x.font = pismo(700, px); x.textBaseline = 'middle'; x.textAlign = 'center'; x.fillStyle = FARBY.chipText;
    x.fillText(CHIP, w / 2, h / 2 + px * 0.04);
  });
  return sp;
}

/** Strana knihy: rozmery mriežky, čísel a hlavičky v ráme box (text strany ostane v zóne). */
function stavStranu(R, box, zar) {
  // 1:1 je nízky: bez hlavičky strany a s menším okrajom (inak by políčko malo 33 px a čísla 38 px by sa prekrývali)
  const bezHlavy = R.F.druh === 'stvorec';
  const pad = R.s * (bezHlavy ? 0.022 : 0.03);
  const maxR = Math.max(...P.rows.map((r) => r.length)), maxC = Math.max(...P.cols.map((c) => c.length));
  const headH = bezHlavy ? 0 : R.mp * 1.5, headGap = bezHlavy ? 0 : R.mp * 0.45;
  const sirkaRiadku = (clue, px) => {
    const w = P.rows.map((r) => r.reduce((a, v) => a + sirka(String(v), 400, px), 0) + (r.length - 1) * px * 0.45);
    return Math.max(...w) + px * 0.5;
  };
  const maxW = box.x1 - box.x0 + 2 * pad, maxH = box.y1 - box.y0;
  let clue = R.mp, c = 0, rowW = 0, colH = 0;
  for (let i = 0; i < 4; i++) {
    rowW = sirkaRiadku(P.rows, clue);
    colH = maxC * clue * 1.1 + clue * 0.3;
    c = Math.min((maxW - 2 * pad - rowW) / N, (maxH - 2 * pad - headH - headGap - colH) / N);
    clue = Math.max(R.mp, Math.min(c * 0.58, R.s * 0.046));
  }
  rowW = sirkaRiadku(P.rows, clue);
  colH = maxC * clue * 1.1 + clue * 0.3;
  c = Math.min((maxW - 2 * pad - rowW) / N, (maxH - 2 * pad - headH - headGap - colH) / N);
  const w = 2 * pad + rowW + N * c, h = 2 * pad + headH + headGap + colH + N * c;
  const x = zar === 'stred' ? R.W / 2 - w / 2 : box.x0 - pad;
  const y = (box.y0 + box.y1) / 2 - h / 2;
  const S = { x, y, w, h, pad, headH, headGap, clue, c, rowW, colH, maxR };
  S.gx = x + pad + rowW; S.gy = y + pad + headH + headGap + colH;
  S.vnutro = { x: x + pad, y: y + pad, w: w - 2 * pad, h: h - 2 * pad };
  return S;
}

function stavVrstiev(W, H, dpr) {
  const R = velkosti(W, H), { F, Z, s } = R, g = R.medzera;
  L = { W, H, dpr, R, poz: {} };
  if (F.stlpec) {
    L.titul = stavTitul(dpr, R, Z.w, 'center');
    L.veta = spriteRiadku(dpr, VETA, R.vetaPx, Z.w, { vaha: 600, farba: FARBY.krem2, zarovnanie: 'center', maxRiadkov: 2, riadkovanie: 1.22 });
    L.chip = stavChip(dpr, R);
    L.poz.titul = { x: Z.x0, y: Z.y0 };
    // štítok pri odchode háku klesne o 0,4 výšky (engine kresliRiadok), preto rezerva nad spodkom zóny
    L.poz.chip = { x: W / 2 - L.chip.w / 2, y: Z.y1 - L.chip.h * 1.4 };
    L.poz.veta = { x: Z.x0, y: L.poz.chip.y - g * 0.6 - L.veta.h };
    R.blok = { x: Z.x0, y: Z.y0, w: Z.w, h: L.titul.h, zar: 'center' };
    L.S = stavStranu(R, { x0: Z.x0, x1: Z.x1, y0: Z.y0 + L.titul.h + g * 1.3, y1: L.poz.veta.y - g * 1.2 }, 'stred');
  } else {
    L.S = stavStranu(R, { x0: Z.x0, x1: Z.x0 + Z.w * 0.55, y0: Z.y0, y1: Z.y1 }, 'vlavo');
    const cx0 = L.S.x + L.S.w + s * 0.075, cw = Z.x1 - cx0;
    L.titul = stavTitul(dpr, R, cw, 'left');
    L.veta = spriteRiadku(dpr, VETA, R.vetaPx, cw, { vaha: 600, farba: FARBY.krem2, zarovnanie: 'left', maxRiadkov: 2, riadkovanie: 1.22 });
    L.chip = stavChip(dpr, R);
    const spolu = L.titul.h + g * 1.1 + L.veta.h + g * 1.4 + L.chip.h;
    const y0 = H / 2 - spolu / 2;
    L.poz.titul = { x: cx0, y: y0 };
    L.poz.veta = { x: cx0, y: y0 + L.titul.h + g * 1.1 };
    L.poz.chip = { x: cx0, y: L.poz.veta.y + L.veta.h + g * 1.4 };
    R.blok = { x: cx0, y: Z.y0, w: cw, h: Z.h, zar: 'left' };
  }
  // priblíženie názvu na snímke 0 (rovnaký výpočet ako engine/hak.js kresliNazov)
  L.priblizenie0 = PRIBLIZENIE_HAKU;
  if (H / W >= 1.6 && L.titul.textW * PRIBLIZENIE_HAKU > W * MAX_NAZOV_916) L.priblizenie0 = (W * MAX_NAZOV_916) / L.titul.textW;

  L.pozadie = stavPozadie(W, H, dpr, R);
  L.mesiac = stavMesiac(dpr, R);
  const bw = s * 0.1;
  L.netopier = sprite(dpr, bw, bw * (30 / 64), (x) => { x.fillStyle = '#07040d'; cestaNetopiera(x, 0, 0, bw / 64); x.fill(); });
  L.netopiere = [
    { x: 0.86, y: 0.5, ax: 0.05, ay: 0.03, p: 10, f: 0, k: 1.0 },
    { x: 0.72, y: 0.9, ax: 0.04, ay: 0.04, p: 5, f: 2.1, k: 0.75 },
    { x: 0.95, y: 1.45, ax: 0.03, ay: 0.03, p: 20, f: 4.0, k: 0.6 },
    { x: 0.1, y: 0.7, ax: 0.035, ay: 0.03, p: 10, f: 1.3, k: 0.7 },
  ];
  L.strana = stavStranaVrstva(dpr, R, L.S);
  L.hlava = L.S.headH > 0 ? stavHlava(dpr, R, L.S) : null;
  L.cisla = stavCisla(dpr, R, L.S);
  L.kapitoly = stavKapitoly(dpr, R, L.S);
  L.titulky = TITULKY.map((tt) => ({ ...tt, sp: spriteRiadku(dpr, tt.text, Math.min(R.capPx, R.blok.h / 2.7), R.blok.w, { vaha: 600, farba: FARBY.krem, zarovnanie: R.blok.zar, maxRiadkov: 2, riadkovanie: 1.22 }) }));
  L.zrna = zrno(3, Math.round(160 * dpr), 1, 11).map((z) => ({ z }));
}

/** Nočné nebo z obálky knihy: prechod, hviezdy, kopce a pár náhrobkov (kreslí sa raz). */
function stavPozadie(W, H, dpr, R) {
  const c = platno(W * dpr, H * dpr), x = c.getContext('2d');
  x.scale(dpr, dpr);
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, FARBY.noc1); g.addColorStop(0.6, FARBY.noc2); g.addColorStop(1, FARBY.noc3);
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  const m = poziciaMesiaca(R);
  const zg = x.createRadialGradient(m.x, m.y, 0, m.x, m.y, R.s * 0.55);
  zg.addColorStop(0, 'rgba(120,70,150,0.35)'); zg.addColorStop(1, 'rgba(120,70,150,0)');
  x.fillStyle = zg; x.fillRect(0, 0, W, H);
  const r = nahoda(7), n = Math.round(110 * (W * H) / (1080 * 1920));
  for (let i = 0; i < n; i++) {
    x.globalAlpha = 0.3 + r() * 0.5;
    x.fillStyle = '#f4e9d8';
    x.beginPath(); x.arc(r() * W, r() * H * 0.62, R.s * (0.0012 + r() * 0.0022), 0, Math.PI * 2); x.fill();
  }
  x.globalAlpha = 1;
  // kopce (obálka: krivka pri spodku) a náhrobky
  const k = H - R.s * 0.07;
  x.beginPath();
  x.moveTo(0, H); x.lineTo(0, k);
  x.bezierCurveTo(W * 0.2, k - R.s * 0.04, W * 0.4, k + R.s * 0.02, W * 0.6, k - R.s * 0.02);
  x.bezierCurveTo(W * 0.8, k - R.s * 0.05, W * 0.9, k - R.s * 0.03, W, k - R.s * 0.01);
  x.lineTo(W, H); x.closePath();
  x.fillStyle = FARBY.zem; x.fill();
  for (const [fx, v] of [[0.08, 0.05], [0.16, 0.035], [0.9, 0.045]]) {
    const bx = W * fx, by = k - R.s * 0.012, bw = R.s * v * 0.7, bh = R.s * v;
    x.beginPath();
    x.moveTo(bx - bw / 2, by); x.lineTo(bx - bw / 2, by - bh + bw / 2);
    x.arc(bx, by - bh + bw / 2, bw / 2, Math.PI, 0);
    x.lineTo(bx + bw / 2, by); x.closePath(); x.fill();
  }
  const vg = x.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.35, W / 2, H * 0.45, Math.max(W, H) * 0.8);
  vg.addColorStop(0, 'rgba(5,2,15,0)'); vg.addColorStop(1, 'rgba(5,2,15,0.35)');
  x.fillStyle = vg; x.fillRect(0, 0, W, H);
  return c;
}

function poziciaMesiaca(R) {
  const { F, W, H, s, Z } = R;
  if (F.druh === 'vysoky') return { x: W * 0.8, y: Z.y0 * 0.55, r: s * 0.052 };
  if (F.druh === 'siroky') return { x: W * 0.9, y: H * 0.13, r: s * 0.05 };
  return { x: W - s * 0.09, y: s * 0.075, r: s * 0.036 };
}

function stavMesiac(dpr, R) {
  const m = poziciaMesiaca(R), d = m.r * 2;
  const disk = sprite(dpr, d, d, (x) => {
    const g = x.createRadialGradient(m.r, m.r, 0, m.r, m.r, m.r);
    g.addColorStop(0.72, FARBY.mesiac); g.addColorStop(1, FARBY.mesiacOkraj);
    x.fillStyle = g; x.beginPath(); x.arc(m.r, m.r, m.r, 0, Math.PI * 2); x.fill();
  });
  const zr = m.r * 2.4;
  const ziara = sprite(dpr, zr * 2, zr * 2, (x) => {
    const g = x.createRadialGradient(zr, zr, 0, zr, zr, zr);
    g.addColorStop(0, 'rgba(246,199,122,0.4)'); g.addColorStop(1, 'rgba(246,199,122,0)');
    x.fillStyle = g; x.fillRect(0, 0, zr * 2, zr * 2);
  });
  return { m, disk, ziara, zr };
}

/** Strana knihy s kôpkou listov a obálkou pod ňou (kreslí sa raz). */
function stavStranaVrstva(dpr, R, S) {
  const o = R.s * 0.03, w = S.w + o * 2, h = S.h + o * 2;
  const sp = sprite(dpr, w, h, (x) => {
    x.translate(o, o);
    // obálka knihy pod listami (tmavá, mierne pootočená), dva listy pod stranou
    x.save();
    x.translate(S.w / 2, S.h / 2); x.rotate(-0.028); x.translate(-S.w / 2, -S.h / 2);
    x.fillStyle = FARBY.noc2; x.fillRect(-o * 0.3, o * 0.1, S.w + o * 0.4, S.h + o * 0.3);
    x.fillStyle = 'rgba(242,140,40,0.55)'; x.fillRect(-o * 0.3, S.h + o * 0.3, S.w + o * 0.4, Math.max(1.5, o * 0.08));
    x.restore();
    for (const [dx, dy, f] of [[o * 0.5, o * 0.45, '#e9e1d2'], [o * 0.25, o * 0.22, '#f3ecdf']]) {
      x.fillStyle = f; x.fillRect(dx, dy, S.w, S.h);
    }
    x.save();
    x.shadowColor = 'rgba(0,0,0,0.45)'; x.shadowBlur = o * 0.8; x.shadowOffsetY = o * 0.25;
    x.fillStyle = FARBY.papier; x.fillRect(0, 0, S.w, S.h);
    x.restore();
  });
  sp.o = o;
  return sp;
}

/** Hlavička strany ako v knihe: ikona tekvice, NONOGRAM 2 vľavo, EASY · 10 × 10 vpravo. */
function stavHlava(dpr, R, S) {
  const px = R.mp, roz = px * 0.1, w = S.w - 2 * S.pad, ik = px * 0.95;
  const lw = sirkaRoz(HLAVA_L, 500, px, roz) + ik + px * 0.35;
  let prava = HLAVA_P;
  if (lw + sirkaRoz(prava, 500, px, roz) + px > w) prava = HLAVA_P_KRATKO;
  if (lw + sirkaRoz(prava, 500, px, roz) + px > w) prava = '';
  const sp = sprite(dpr, w, S.headH, (x) => {
    kresliIkonu(x, 'tekvica', 0, (S.headH - px * 0.3 - ik) / 2, ik, FARBY.oranzTmava);
    x.font = pismo(500, px); x.textBaseline = 'middle'; x.fillStyle = FARBY.atrament;
    const y = (S.headH - px * 0.3) / 2;
    rozostup(x, HLAVA_L, ik + px * 0.35, y, roz, 'left');
    if (prava) { x.fillStyle = '#4a4a4a'; rozostup(x, prava, w, y, roz, 'right'); }
    // oranžová čiara pod hlavičkou (kniha: .hlava border-bottom .6pt ORANZ)
    const hr = Math.max(1.5, R.s * 0.0022);
    x.fillStyle = FARBY.oranzTmava; x.fillRect(0, S.headH - hr, w, hr);
  });
  sp.prava = prava;
  return sp;
}

/** Čísla Nonogramu (riadky vľavo zarovnané doprava, stĺpce nad mriežkou zdola), ako strana 6 knihy. */
function stavCisla(dpr, R, S) {
  const x0 = S.x, y0 = S.y;
  const sp = sprite(dpr, S.w, S.h, (x) => {
    x.font = pismo(400, S.clue); x.fillStyle = FARBY.atrament; x.textBaseline = 'middle'; x.textAlign = 'left';
    P.rows.forEach((r, i) => {
      const cy = S.gy - y0 + (i + 0.5) * S.c;
      let cx = S.gx - x0 - S.clue * 0.45;
      for (let k = r.length - 1; k >= 0; k--) {
        const t = String(r[k]), w = x.measureText(t).width;
        cx -= w;
        x.fillText(t, cx, cy);
        cx -= S.clue * 0.45;
      }
    });
    x.textAlign = 'center';
    P.cols.forEach((col, i) => {
      const cx = S.gx - x0 + (i + 0.5) * S.c;
      col.forEach((v, k) => {
        const cy = S.gy - y0 - S.clue * 0.3 - (col.length - 1 - k) * S.clue * 1.1 - S.clue * 0.5;
        x.fillText(String(v), cx, cy);
      });
    });
  });
  return sp;
}

/** Obsah knihy: štyri druhy (ikona z knihy a názov druhu), jeden krátky riadok na druh. */
function stavKapitoly(dpr, R, S) {
  const V = S.vnutro, rh = V.h / 4, ik = Math.min(rh * 0.74, V.w * 0.26), gap = R.s * 0.03;
  const tw = V.w - ik - gap;
  const najdlhsi = KAP_TEXT.reduce((a, k) => (sirka(k, 700, 100) > sirka(a, 700, 100) ? k : a), '');
  const tp = Math.max(R.mp, Math.min(R.s * 0.06, rh * 0.42, (100 * tw * 0.96) / sirka(najdlhsi, 700, 100)));
  return FAKTY.kapitoly.map((k, i) => {
    const y = V.y + i * rh, blokH = tp * 1.25;
    const texty = sprite(dpr, tw, blokH, (x) => {
      x.textBaseline = 'top'; x.textAlign = 'left';
      x.font = pismo(700, tp); x.fillStyle = FARBY.atrament; x.fillText(KAP_TEXT[i], 0, tp * 0.1);
    });
    const ikona = i === 0 ? null : sprite(dpr, ik, ik, (x) => kresliIkonu(x, k.ikona, ik * 0.1, ik * 0.1, ik * 0.8, FARBY.oranzTmava));
    return { y, rh, ik, ikX: V.x, ikY: y + (rh - ik) / 2, tx: V.x + ik + gap, ty: y + (rh - blokH) / 2, texty, ikona };
  });
}

// ---------- stav filmu v čase t ----------

/** Sila tmy a svetla tekvice (žiara, iskry): 1 v háku, odtečie 1,25 až 1,75 s, od 10,8 s znova 1 do konca. */
function odhalenie(t) {
  if (t < T.odhal) return 1 - ease.inOutSine(okno(t, T.odtokOd, T.odtokOd + T.odtokKruh));
  return okno(t, T.odhal, T.odhal + T.odhalVlna);
}
/** Viditeľnosť hlavičky a čísel (zmiznú pred obsahom knihy, vrátia sa pred záverom). */
function obsahStrany(t) {
  return 1 - okno(t, T.obsahPrecOd, T.obsahPrecDo) + okno(t, T.obsahSpatOd, T.obsahSpatDo);
}
/** Mriežka v čase t: poloha a veľkosť políčka (zmenší sa do ikony kapitoly 1 a narastie späť). */
function geometriaMriezky(t) {
  const S = L.S, K = L.kapitoly[0];
  const p = ease.inOutCubic(okno(t, T.zmensOd, T.zmensDo)) * (1 - ease.inOutCubic(okno(t, T.rastOd, T.rastDo)));
  const cMala = (K.ik * 0.92) / N;
  const gxM = K.ikX + (K.ik - cMala * N) / 2, gyM = K.ikY + (K.ik - cMala * N) / 2;
  return { gx: lerp(S.gx, gxM, p), gy: lerp(S.gy, gyM, p), c: lerp(S.c, cMala, p), p };
}
/** Plameň sviečky: súčet sínusov s periódami, ktoré delia 20 s (slučka bez skoku). */
const plamen = (t) => 0.86 + kyv(t, 0.07, 0.625) + kyv(t, 0.05, 0.4, 1.3) + kyv(t, 0.02, 0.25, 0.4);

// ---------- kreslenie ----------

function kresliNebo(x, t) {
  const M = L.mesiac, { m } = M;
  x.save();
  x.globalAlpha = 0.75 + kyv(t, 0.2, 5);
  x.drawImage(M.ziara.c, m.x - M.zr, m.y - M.zr, M.zr * 2, M.zr * 2);
  x.globalAlpha = 1;
  x.drawImage(M.disk.c, m.x - m.r, m.y - m.r, m.r * 2, m.r * 2);
  // netopiere krúžia okolo mesiaca (periódy delia 20 s), krídla mávajú po 0,4 s
  const sp = L.netopier;
  for (const [i, b] of L.netopiere.entries()) {
    const u = (2 * Math.PI * t) / b.p + b.f;
    const bx = (b.x < 0.5 ? L.W * b.x : m.x + (b.x - 0.86) * L.R.s * 2.2) + Math.sin(u) * L.R.s * b.ax * 3;
    const by = m.y + (b.y - 0.8) * m.r * 2.4 + Math.sin(2 * u) * L.R.s * b.ay * 1.6;
    const mav = 0.55 + 0.45 * Math.abs(Math.cos((2 * Math.PI * t) / 0.4 + i));
    const w = sp.w * b.k, h = sp.h * b.k * mav;
    x.drawImage(sp.c, bx - w / 2, by - h / 2, w, h);
  }
  x.restore();
}

function kresliStranu(x, t) {
  const S = L.S, st = L.strana;
  x.drawImage(st.c, S.x - st.o, S.y - st.o, st.w, st.h);
  const a = obsahStrany(t);
  if (a > 0.001) {
    x.save();
    x.globalAlpha = a;
    if (L.hlava) x.drawImage(L.hlava.c, S.x + S.pad, S.y + S.pad, L.hlava.w, L.hlava.h);
    kresliZvyraznenie(x, t, 'cisla');
    x.drawImage(L.cisla.c, S.x, S.y, S.w, S.h);
    kresliStlmenie(x, t);
    x.restore();
  }
}

/** Aktívny krok riešiteľa: oranžová pilulka pod číslami riadku alebo stĺpca a pás cez mriežku. */
function aktivnyKrok(t) {
  for (let k = KROKY.length - 1; k >= 0; k--) {
    const K = KROKY[k];
    // krok 0 je ukážka: pilulka svieti od začiatku ukážky, aby divák videl, ktorý riadok sa číta
    const od = k === 0 ? T.ukazOd : K.t - 0.06, nab = k === 0 ? 0.25 : 0.08;
    if (t >= od && t < K.t + 0.5) return { K, a: obalka(t, od, K.t + 0.5, nab, 0.2) };
  }
  return null;
}

/**
 * Ukážka prvého kroku v riadku UKAZKA.r: pás dĺžky čísla vľavo, posunie sa doprava (východisko ostane ako
 * prerušovaný obrys), prekryv oboch polôh sa zvýrazní a v T.krok0 ho riešiteľ vyplní.
 */
function kresliUkazku(x, t, gx, gy, c) {
  if (t < T.ukazOd || t >= T.ukazDo) return;
  const a = ease.outCubic(okno(t, T.ukazOd, T.ukazOd + 0.3)) * (1 - okno(t, T.ukazDo - 0.45, T.ukazDo));
  if (a <= 0.001) return;
  const U = UKAZKA, y = gy + U.r * c + c * 0.13, h = c * 0.74, w = U.dlz * c - c * 0.16, r = h / 2;
  const pos = lerp(0, N - U.dlz, ease.inOutCubic(okno(t, T.posunOd, T.posunDo)));
  x.save();
  x.lineWidth = Math.max(1.5, c * 0.06);
  const obrys = okno(t, T.posunOd, T.posunOd + 0.25);
  if (obrys > 0) {
    x.globalAlpha = a * obrys * 0.9;
    x.strokeStyle = FARBY.oranzTmava; x.setLineDash([c * 0.2, c * 0.13]);
    zaoblene(x, gx + c * 0.08, y, w, h, r); x.stroke();
    x.setLineDash([]);
  }
  const pr = ease.outCubic(okno(t, T.posunDo, T.posunDo + 0.2));
  if (pr > 0) {
    x.globalAlpha = a * pr;
    x.fillStyle = 'rgba(242,140,40,0.42)';
    x.fillRect(gx + (N - U.dlz) * c, gy + U.r * c, U.stred * c, c);
  }
  x.globalAlpha = a;
  x.fillStyle = 'rgba(242,140,40,0.3)'; x.strokeStyle = FARBY.oranz;
  zaoblene(x, gx + pos * c + c * 0.08, y, w, h, r); x.fill(); x.stroke();
  x.restore();
}
function kresliZvyraznenie(x, t, co) {
  const A = aktivnyKrok(t);
  if (!A || A.a <= 0) return;
  const S = L.S, { K, a } = A, G = geometriaMriezky(t);
  x.save();
  x.globalAlpha *= a;
  if (co === 'cisla') {
    x.fillStyle = 'rgba(242,140,40,0.26)';
    if (K.typ === 'r') zaoblene(x, S.x + S.pad * 0.6, S.gy + K.i * S.c + S.c * 0.1, S.gx - S.x - S.pad * 0.6 - S.clue * 0.2, S.c * 0.8, S.c * 0.4);
    else zaoblene(x, S.gx + K.i * S.c + S.c * 0.1, S.y + S.pad + S.headH + S.headGap * 0.4, S.c * 0.8, S.gy - S.y - S.pad - S.headH - S.headGap * 0.4 - S.clue * 0.1, S.c * 0.4);
    x.fill();
  } else {
    x.fillStyle = 'rgba(242,140,40,0.14)';
    if (K.typ === 'r') x.fillRect(G.gx, G.gy + K.i * G.c, N * G.c, G.c);
    else x.fillRect(G.gx + K.i * G.c, G.gy, G.c, N * G.c);
  }
  x.restore();
}
/** Hotové riadky a stĺpce: čísla stlmí tenká vrstva papiera (v háku hotové všetky). */
function kresliStlmenie(x, t) {
  const S = L.S;
  const hak = 1 - okno(t, T.odtokOd, T.odtokOd + 0.45);
  x.fillStyle = FARBY.papier;
  for (let i = 0; i < N; i++) {
    for (const typ of ['r', 'c']) {
      const od = HOTOVY[typ][i];
      const a = Math.max(hak, t >= od ? okno(t, od, od + 0.3) : 0) * 0.55;
      if (a <= 0.001) continue;
      x.globalAlpha = a * obsahStrany(t);
      if (typ === 'r') x.fillRect(S.x + S.pad * 0.5, S.gy + i * S.c, S.gx - S.x - S.pad * 0.5, S.c);
      else x.fillRect(S.gx + i * S.c, S.y + S.pad + S.headH + S.headGap * 0.4, S.c, S.gy - S.y - S.pad - S.headH - S.headGap * 0.4);
    }
  }
  x.globalAlpha = 1;
}

/**
 * Tma v mriežke v čase t: 'plna' (hák a koniec), 'ziadna' (riešenie), 'svetly' (odtok: papier sa šíri
 * kruhom zo stredu tekvice, polomer r) alebo 'tmavy' (moment: tma sa šíri kruhom zo stredu, polomer r).
 * r je podiel RMAX (0 až 1). Farba sa mení len na ostrom okraji kruhu, nikdy sa neprelína cez sivú.
 */
function stavTmy(t) {
  if (t < T.odtokOd) return { typ: 'plna' };
  if (t < T.odtokOd + T.odtokKruh) return { typ: 'svetly', r: ease.inOutSine(okno(t, T.odtokOd, T.odtokOd + T.odtokKruh)) };
  if (t < T.odhal) return { typ: 'ziadna' };
  if (t < T.odhal + T.odhalVlna) return { typ: 'tmavy', r: okno(t, T.odhal, T.odhal + T.odhalVlna) };
  return { typ: 'plna' };
}
// polomer odtoku rastie po ease.inOutSine: r = (1 - cos(pi p)) / 2, teda p = acos(1 - 2 r) / pi
const casOdtoku = (j) => T.odtokOd + (T.odtokKruh * Math.acos(obmedz(1 - 2 * VLNA[j], -1, 1))) / Math.PI;
const casOdhalenia = (j) => T.odhal + VLNA[j] * T.odhalVlna;
/** Je stred políčka j v tme? */
function polickoVTme(tma, j) {
  if (tma.typ === 'plna') return true;
  if (tma.typ === 'ziadna') return false;
  return tma.typ === 'svetly' ? VLNA[j] >= tma.r : VLNA[j] < tma.r;
}

function kresliMriezku(x, t, env) {
  const G = geometriaMriezky(t), { gx, gy, c } = G, sz = N * c;
  const o = odhalenie(t), fl = plamen(t), tma = stavTmy(t);
  const kx = gx + STRED[0] * c, ky = gy + STRED[1] * c, rp = (tma.r || 0) * RMAX * c;
  // oblasti: kreslí v kruhu, mimo kruhu (rect + kruh proti smeru, platí pre nonzero aj evenodd)
  const vKruhu = (kresli) => {
    if (rp <= 0) return;
    x.save(); x.beginPath(); x.rect(gx, gy, sz, sz); x.clip();
    x.beginPath(); x.arc(kx, ky, rp, 0, Math.PI * 2); x.clip();
    kresli(); x.restore();
  };
  const mimoKruhu = (kresli) => {
    x.save(); x.beginPath(); x.rect(gx, gy, sz, sz); x.clip();
    if (rp > 0) { x.beginPath(); x.rect(gx, gy, sz, sz); x.arc(kx, ky, rp, 0, Math.PI * 2, true); x.clip('evenodd'); }
    kresli(); x.restore();
  };
  const vTme = (kresli) => {
    if (tma.typ === 'plna') kresli();
    else if (tma.typ === 'svetly') mimoKruhu(kresli);
    else if (tma.typ === 'tmavy') vKruhu(kresli);
  };
  const naSvetle = (kresli) => {
    if (tma.typ === 'ziadna') kresli();
    else if (tma.typ === 'svetly') vKruhu(kresli);
    else if (tma.typ === 'tmavy') mimoKruhu(kresli);
  };
  const tenke = (farba, a) => {
    x.strokeStyle = farba; x.lineWidth = Math.max(0.8, c * 0.03); x.globalAlpha = a;
    x.beginPath();
    for (let i = 1; i < N; i++) {
      if (i % 5 === 0) continue;
      x.moveTo(gx + i * c, gy); x.lineTo(gx + i * c, gy + sz);
      x.moveTo(gx, gy + i * c); x.lineTo(gx + sz, gy + i * c);
    }
    x.stroke(); x.globalAlpha = 1;
  };
  const hrube = (farba, a) => {
    x.strokeStyle = farba; x.globalAlpha = a; x.lineWidth = Math.max(1.4, c * 0.075);
    x.beginPath();
    x.moveTo(gx + 5 * c, gy); x.lineTo(gx + 5 * c, gy + sz);
    x.moveTo(gx, gy + 5 * c); x.lineTo(gx + sz, gy + 5 * c);
    x.rect(gx, gy, sz, sz);
    x.stroke(); x.globalAlpha = 1;
  };
  x.save();
  // podklad: papier s čiernymi čiarami, tma s tlmenými čiarami a oranžovou žiarou tekvice
  naSvetle(() => { x.fillStyle = FARBY.papier; x.fillRect(gx, gy, sz, sz); tenke('#1a1a1a', 1); });
  vTme(() => {
    x.fillStyle = FARBY.tmaMriezky; x.fillRect(gx, gy, sz, sz);
    tenke('#4a3d66', 0.7);
    const zg = x.createRadialGradient(kx, ky - c * 0.8, 0, kx, ky - c * 0.8, sz * 0.62);
    zg.addColorStop(0, `rgba(255,140,40,${(0.3 * fl).toFixed(3)})`); zg.addColorStop(1, 'rgba(255,140,40,0)');
    x.fillStyle = zg; x.fillRect(gx, gy, sz, sz);
  });
  kresliZvyraznenie(x, t, 'mriezka');
  naSvetle(() => kresliUkazku(x, t, gx, gy, c));
  // políčka: na papieri atrament (nové oranžové ako v knihe), v tme farba tekvice; prepnutie je ostré
  const vRiesenie = t >= T.odtokDo;
  for (let j = 0; j < N * N; j++) {
    const r = Math.floor(j / N), col = j % N, cx = gx + (col + 0.5) * c, cy = gy + (r + 0.5) * c;
    const tmave = polickoVTme(tma, j);
    if (RIESENIE[j]) {
      let sc;
      if (!vRiesenie) {
        const od = casOdtoku(j);
        sc = 1 - ease.inCubic(okno(t, od - 0.04, od + 0.16));
      } else {
        const tf = CAS_POLICKA[j];
        if (t < tf) continue;
        sc = obmedz(ease.outBack(okno(t, tf, tf + 0.2), PREKMIT), 0, 1.03);
        // dlaždica tekvice sa pri prepnutí jemne zväčší z 0,9 (prekmit do 3 %)
        if (tmave && t < T.odhal + T.odhalVlna + 0.3) sc *= 0.9 + 0.1 * obmedz(ease.outBack(okno(t, casOdhalenia(j), casOdhalenia(j) + 0.22), PREKMIT), 0, 1.03);
      }
      if (sc <= 0.001) continue;
      if (tmave || !vRiesenie) { // pri odtoku obrázka ostane dlaždica tekvice, kým nezmizne
        const d = c * sc * 0.93;
        x.fillStyle = rgb(FARBA_TEKVICE[j]);
        x.fillRect(cx - d / 2, cy - d / 2, d, d);
        x.fillStyle = 'rgba(255,240,205,0.2)';
        x.fillRect(cx - d / 2, cy - d / 2, d, d * 0.2);
      } else {
        const nove = vRiesenie ? 1 - okno(t, CAS_POLICKA[j] + 0.3, CAS_POLICKA[j] + 0.7) : 0;
        const d = c * sc;
        x.fillStyle = rgb(mixRGB(RGB.atrament, RGB.oranzTmava, nove));
        x.fillRect(cx - d / 2, cy - d / 2, d, d);
      }
    } else if (vRiesenie && !tmave) {
      const td = CAS_POLICKA[j], a = t >= td ? okno(t, td, td + 0.15) : 0;
      if (a > 0.001) {
        x.globalAlpha = a; x.fillStyle = FARBY.bodka;
        x.beginPath(); x.arc(cx, cy, Math.max(0.8, c * 0.075), 0, Math.PI * 2); x.fill();
        x.globalAlpha = 1;
      }
    }
  }
  // tvár tekvice svieti ako sviečka: mäkká žiara, sviečkové jadro, biele stredy (len v tme)
  for (const [i, j] of TVAR.entries()) {
    if (!polickoVTme(tma, j)) continue;
    const a = tma.typ === 'tmavy' || (t >= T.odhal && t < T.odhal + T.odhalVlna + 0.5) ? ease.outCubic(okno(t, casOdhalenia(j) + 0.1, casOdhalenia(j) + 0.4)) : 1;
    if (a <= 0.001) continue;
    const r = Math.floor(j / N), col = j % N;
    const f = obmedz(fl + kyv(t, 0.05, 0.8, i), 0, 1);
    const cx = gx + (col + 0.5) * c, cy = gy + (r + 0.5) * c;
    const zg = x.createRadialGradient(cx, cy, 0, cx, cy, c * 0.95);
    zg.addColorStop(0, `rgba(255,214,110,${(0.55 * a * f).toFixed(3)})`); zg.addColorStop(1, 'rgba(255,214,110,0)');
    x.fillStyle = zg; x.fillRect(cx - c, cy - c, c * 2, c * 2);
    x.globalAlpha = obmedz(a * (0.75 + 0.25 * f));
    x.fillStyle = FARBY.sviecka;
    x.fillRect(gx + col * c + c * 0.06, gy + r * c + c * 0.06, c * 0.88, c * 0.88);
    x.globalAlpha = obmedz(a * f);
    x.fillStyle = '#fff6d8';
    x.fillRect(gx + col * c + c * 0.22, gy + r * c + c * 0.22, c * 0.56, c * 0.56);
    x.globalAlpha = 1;
  }
  if (!env.slabe && o > 0.001) vTme(() => kresliIskry(x, t, gx, gy, c, o));
  // hrubé čiary každých 5 políčok a rám (kniha: hrubé čiary ako na strane 5); v tme tlmené
  naSvetle(() => hrube('#111111', 1));
  vTme(() => hrube('#5b4d7a', 0.8));
  // dokončenie: rám mriežky raz zasvieti oranžovo (oddelí rýchle riešenie od momentu)
  const q = okno(t, T.hotovo, T.hotovo + 0.7);
  if (q > 0 && q < 1) {
    x.globalAlpha = Math.sin(Math.PI * q);
    x.strokeStyle = FARBY.oranz; x.lineWidth = Math.max(2, c * 0.14);
    x.strokeRect(gx - c * 0.07, gy - c * 0.07, sz + c * 0.14, sz + c * 0.14);
    x.globalAlpha = 1;
  }
  x.restore();
}

/** Iskry nad tekvicou (len v tme): každá stúpa 2,5 s, periódy delia 20 s. */
function kresliIskry(x, t, gx, gy, c, o) {
  x.save();
  x.beginPath(); x.rect(gx, gy, N * c, N * c); x.clip();
  for (let i = 0; i < 12; i++) {
    const per = 2.5, f = (t / per + hash(i, 3)) % 1;
    const ix = gx + (2.2 + hash(i, 7) * 5.6) * c + Math.sin((2 * Math.PI * t) / 1.25 + i) * c * 0.25;
    const iy = gy + (3.2 - f * 3.4) * c;
    const a = o * Math.sin(Math.PI * f) * 0.85;
    if (a <= 0.01) continue;
    x.globalAlpha = a;
    x.fillStyle = i % 3 ? '#ffb45a' : '#ffe39a';
    x.beginPath(); x.arc(ix, iy, c * (0.05 + hash(i, 11) * 0.05), 0, Math.PI * 2); x.fill();
  }
  x.restore();
}

function kresliKapitoly(x, t) {
  const vid = 1 - okno(t, T.kapPrecOd, T.kapPrecDo);
  if (t < T.kapOd || vid <= 0.001) return;
  L.kapitoly.forEach((k, i) => {
    const od = T.kapOd + i * T.kapKrok, p = ease.outCubic(okno(t, od, od + T.kapVstup));
    if (p <= 0.001) return;
    const a = obmedz(p * 1.3) * vid, dx = (1 - p) * L.R.s * 0.03;
    x.save();
    x.globalAlpha = a;
    if (k.ikona) x.drawImage(k.ikona.c, k.ikX + dx, k.ikY, k.ikona.w, k.ikona.h);
    x.drawImage(k.texty.c, k.tx + dx, k.ty, k.texty.w, k.texty.h);
    x.restore();
  });
}

function kresliTexty(x, t) {
  const { poz } = L;
  // hák: názov, veta a štítok od snímky 0 (engine/hak.js)
  HAK.kresliNazov(x, t, L.titul, poz.titul.x, poz.titul.y);
  HAK.kresliRiadok(x, t, L.veta, poz.veta.x, poz.veta.y, 0.06);
  HAK.kresliRiadok(x, t, L.chip, poz.chip.x, poz.chip.y, 0.12);
  // titulky príbehu v mieste názvu
  for (const tt of L.titulky) {
    const a = obalka(t, tt.od, tt.do, PRECHOD, PRECHOD);
    if (a <= 0) continue;
    const vstup = ease.outCubic(okno(t, tt.od, tt.od + VSTUP_TITULKU)), B = L.R.blok;
    x.globalAlpha = a;
    x.drawImage(tt.sp.c, B.x, B.y + (B.h - tt.sp.h) / 2 + (1 - vstup) * L.R.s * 0.012, tt.sp.w, tt.sp.h);
    x.globalAlpha = 1;
  }
  // záver: texty sa vynoria zdola bez masky; názov sa potom pomaly priblíži na mierku snímky 0
  const vyjdi = (sp, od, px0, y, trv = 0.6) => {
    const p = ease.outCubic(okno(t, od, od + trv));
    if (p <= 0) return;
    x.save();
    x.globalAlpha = obmedz(p * 1.4);
    x.drawImage(sp.c, px0, y + (1 - p) * sp.h * 0.25, sp.w, sp.h);
    x.restore();
  };
  if (t >= T.nazov) {
    const sp = L.titul, k = lerp(1, L.priblizenie0, ease.inOutSine(okno(t, T.nazovBlizsieOd, DLZKA)));
    const scx = poz.titul.x + sp.w / 2, scy = poz.titul.y + sp.h / 2;
    x.save(); x.translate(scx, scy); x.scale(k, k); x.translate(-scx, -scy);
    vyjdi(sp, T.nazov, poz.titul.x, poz.titul.y, T.nazovVstup);
    x.restore();
  }
  vyjdi(L.veta, T.veta, poz.veta.x, poz.veta.y, T.vetaVstup);
  if (t >= T.chip) {
    vyjdi(L.chip, T.chip, poz.chip.x, poz.chip.y, T.chipVstup);
    const q = okno(t, T.lesk, T.lesk + 0.6), b = L.chip, bx = poz.chip.x, by = poz.chip.y;
    if (q > 0 && q < 1) {
      x.save();
      zaoblene(x, bx, by, b.w, b.h, b.h / 2); x.clip();
      x.globalCompositeOperation = 'lighter';
      const lx = lerp(bx - b.w * 0.3, bx + b.w * 1.3, ease.inOutSine(q));
      const g = x.createLinearGradient(lx - b.w * 0.15, 0, lx + b.w * 0.15, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.3)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(bx, by, b.w, b.h);
      x.restore();
    }
  }
}

function kresliZrno(x, t, env) {
  if (env.slabe) return;
  const z = L.zrna[Math.abs(Math.floor(t * 12)) % 3];
  if (!z.vzor) z.vzor = x.createPattern(z.z, 'repeat');
  x.save();
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.globalAlpha = 0.03;
  x.fillStyle = z.vzor;
  x.fillRect(0, 0, L.W * L.dpr, L.H * L.dpr);
  x.restore();
}

const film = {
  dlzka: DLZKA,
  plagat: 1.0,
  titulky: [
    { od: 0, text: 'Halloween Logic Puzzle Book. A page of the book: Nonogram 2, easy, 10 by 10, already solved. In the dark grid a pumpkin glows. 80 printable puzzles, PDF. arlingpuzzles.etsy.com.' },
    { od: 1.9, text: 'The picture fades and the empty puzzle is left: numbers beside every row and above every column. The numbers hide a picture.' },
    { od: T.ukazOd, text: 'Row 3 has the number 6. A bar of 6 cells slides from the left end to the right end; the middle two cells are covered either way, so they are filled first.' },
    { od: T.rychloOd, text: 'The rest of the puzzle solves itself quickly, line by line, without guessing. New cells are orange, the ones before are black, empty cells get a dot. Exactly one solution.' },
    { od: T.odhal, text: 'The light goes out and the picture glows: it was a pumpkin all along.' },
    { od: T.kapOd, text: 'The grid shrinks into the table of contents: Nonograms, Hashi, Kakuro, Slitherlink. Four kinds, 20 puzzles each.' },
    { od: T.nazov, text: 'Halloween Logic Puzzle Book. 80 printable puzzles, PDF. arlingpuzzles.etsy.com.' },
  ],
  async pripravit(env = {}) {
    // ARLing Draw Text na nadpisy; v rendri je chýbajúce písmo chyba (ops/design/PISMO-PRAVIDLA.md, časť 4)
    if (typeof FontFace !== 'undefined' && document.fonts && document.fonts.add) {
      try {
        const ff = new FontFace('ARLing Draw Text', `url(${PISMO_DRAW})`, { weight: '200 800', style: 'normal' });
        await ff.load();
        document.fonts.add(ff);
      } catch (e) {
        if (env.render) throw new Error(`Halloween film: písmo ARLing Draw Text sa nenačítalo (${PISMO_DRAW})`);
      }
    }
    if (document.fonts && document.fonts.load) {
      await Promise.all([document.fonts.load(pismo(700, 40)), document.fonts.load(pismo(600, 40)),
        document.fonts.load(pismo(500, 40)), document.fonts.load(pismo(400, 40))]).catch(() => {});
    }
  },
  vrstvy: stavVrstiev,
  kresli(x, t, W, H, env) {
    x.drawImage(L.pozadie, 0, 0, W, H);
    kresliNebo(x, t);
    kresliStranu(x, t);
    kresliMriezku(x, t, env);
    kresliKapitoly(x, t);
    kresliTexty(x, t);
    kresliZrno(x, t, env);
  },
  stredPlagatu() { const S = L.S; return [S.gx + (N * S.c) / 2, S.gy + (N * S.c) / 2]; },
  // štítok s adresou obchodu vedie na stránke filmu priamo na ponuku knihy na Etsy (jeden krok, ako Advent);
  // odkaz je aktívny, kým je štítok nakreslený: v háku (aj na plagáte 1,0 s), kým neodíde (drz + 0,25 - 0,12
  // oneskorenia v kresliTexty), a od záveru do konca. Obraz filmu sa tým nemení, len web.
  odkazy() {
    const b = L.chip, p = L.poz.chip;
    return [{ x: p.x, y: p.y, w: b.w, h: b.h, href: FAKTY.url, text: `Halloween Logic Puzzle Book on Etsy, ${FAKTY.cena} €`, casy: [[0, HAK.drz + 0.25 - 0.12], [T.chip, Infinity]], udalost: 'halloween_book_film_to_etsy' }];
  },
  zvuk: partitura(),
  // pre test.mjs: titulky na plátne, všetky texty filmu, kroky riešiteľa, rozloženie
  kontrola: {
    titulky: TITULKY,
    prechod: PRECHOD,
    // plátna spritov titulkov v poradí TITULKY (test meria plný kontrast každého titulku po snímkach)
    titulkyPlatna: () => L.titulky.map((tt) => tt.sp.c),
    texty: [KICKER, NAZOV, VETA, CHIP, HLAVA_L, HLAVA_P, HLAVA_P_KRATKO, ...KAP_TEXT, ...TITULKY.map((x) => x.text)],
    // test kolízie textu s tekvicou: obdĺžnik mriežky v čase t (aj počas zmenšenia a rastu)
    mriezka: (t) => { const G = geometriaMriezky(t); return { x0: G.gx, y0: G.gy, x1: G.gx + N * G.c, y1: G.gy + N * G.c }; },
    kapitoly: KAP_TEXT,
    zaver: { nazov: NAZOV, veta: VETA, chip: CHIP },
    pismoNadpisu: 'ARLing Draw Text',
    ukazka: UKAZKA,
    kroky: KROKY,
    riesenie: RIESENIE,
    tvar: TVAR,
    rozlozenie: () => L && { S: { x: L.S.x, y: L.S.y, w: L.S.w, h: L.S.h, c: L.S.c, clue: L.S.clue }, poz: L.poz, blok: L.R.blok, hlava: L.hlava ? L.hlava.prava : null },
    T,
  },
};

function partitura() {
  const u = [];
  // hák: Am7 so zvonmi od snímky 0 (tajomne, ale teplo)
  u.push(...HAK.zvuk({ akord: ['A2', 'E3', 'C4', 'G4'], zvony: ['E5', 'A5', 'C6'] }));
  // odtok obrázka: zostupné glissando a jemný šum
  u.push({ t: T.odtokOd, typ: 'glis', f0: 'A5', f1: 'E4', dlzka: 0.6, hlas: 0.03, dozvuk: 0.4 });
  // tep 120 BPM pod riešením (basový ťuk na dobu, vysoký na medzidobu), pred momentom pauza na nádych
  for (let t = 2.0; t < T.riesDo; t += 0.5) {
    u.push({ t, typ: 'tuk', f: 82, dlzka: 0.14, hlas: 0.05 });
    u.push({ t: t + 0.25, typ: 'tuk', f: 330, dlzka: 0.04, hlas: 0.016, pan: 0.2 });
  }
  // akordy pod scénami: Am, F (ukážka), G (rýchle riešenie, napätie pred momentom)
  u.push({ t: 1.9, typ: 'pad', noty: ['A2', 'E3', 'C4', 'E4'], dlzka: 2.6, nabeh: 0.5, dobeh: 0.7, hlas: 0.1, filter: 900 });
  u.push({ t: T.ukazOd, typ: 'pad', noty: ['F2', 'C3', 'A3', 'E4'], dlzka: T.rychloOd - T.ukazOd + 0.2, nabeh: 0.5, dobeh: 0.8, hlas: 0.1, filter: 1000 });
  u.push({ t: T.rychloOd, typ: 'pad', noty: ['G2', 'D3', 'B3', 'D4'], dlzka: T.odhal - T.rychloOd - 0.1, nabeh: 0.6, dobeh: 0.6, hlas: 0.11, filter: 1000, filter2: 1500 });
  // ukážka: pás sa objaví (tichý ťuk), posun doprava (krátke glissando), prekryv (ťuk na dobu)
  u.push({ t: T.ukazOd + 0.05, typ: 'zvon', f: 'E5', index: 0.5, dlzka: 0.8, hlas: 0.04, pan: -0.2, dozvuk: 0.4 });
  u.push({ t: T.posunOd, typ: 'glis', f0: 'A4', f1: 'E5', dlzka: T.posunDo - T.posunOd, hlas: 0.025, dozvuk: 0.3 });
  u.push({ t: T.posunDo, typ: 'tuk', f: 300, dlzka: 0.05, hlas: 0.05 });
  // dokončenie: rám zasvieti, dva zvony
  u.push({ t: T.hotovo, typ: 'zvon', f: 'A5', index: 0.5, dlzka: 1.0, hlas: 0.06, dozvuk: 0.5 });
  u.push({ t: T.hotovo + 0.08, typ: 'zvon', f: 'E6', index: 0.4, dlzka: 0.9, hlas: 0.035, pan: 0.2, dozvuk: 0.5 });
  // každý krok riešiteľa: ceruzka a tón z pentatoniky (C D E G A), väčší krok hlasnejšie
  const TONY = ['A4', 'C5', 'D5', 'E5', 'G5', 'A5', 'C6'];
  KROKY.forEach((k, i) => {
    const plnych = k.nove.filter(([, v]) => v).length, sila = 0.6 + 0.4 * Math.min(1, k.nove.length / 10);
    const pan = k.typ === 'r' ? -0.25 : 0.25;
    u.push({ t: k.t, typ: 'sum', filter: 'bandpass', f0: 3000, f1: 3800, q: 2, dlzka: 0.04 * k.nove.length + 0.08, hlas: 0.022, pan });
    u.push({ t: k.t + 0.02, typ: 'zvon', f: TONY[(i * 2 + (k.typ === 'c' ? 1 : 0)) % TONY.length], index: 0.8, dlzka: 1.0, hlas: 0.075 * sila, pan, dozvuk: 0.35 });
    if (plnych >= 8) u.push({ t: k.t + 0.3, typ: 'zvon', f: 'E6', index: 0.5, dlzka: 0.8, hlas: 0.03, pan, dozvuk: 0.5 });
  });
  // moment: nádych, tma, rozsvietenie (C dur, zvon o oktávu vyššie, trblietka, hlboký dopad)
  u.push({ t: T.riesDo - 0.2, typ: 'sum', filter: 'bandpass', f0: 400, f1: 2400, q: 0.7, dlzka: T.odhal - T.riesDo + 0.2, nabeh: 0.5, tvar: 'narast', hlas: 0.06 });
  u.push({ t: T.odhal, typ: 'tuk', f: 55, dlzka: 0.5, hlas: 0.22 });
  u.push({ t: T.odhal, typ: 'pad', noty: ['C3', 'G3', 'E4', 'G4'], dlzka: 2.4, nabeh: 0.08, dobeh: 1.2, hlas: 0.15, filter: 1600, filter2: 900 });
  u.push({ t: T.odhal + 0.02, typ: 'zvon', f: 'C6', pomer: 3.5, index: 0.7, dlzka: 1.8, hlas: 0.1, dozvuk: 0.6 });
  u.push({ t: T.odhal + 0.14, typ: 'zvon', f: 'G6', index: 0.5, dlzka: 1.4, hlas: 0.05, dozvuk: 0.6 });
  u.push({ t: T.odhal + 0.35, typ: 'zvon', f: 'E6', index: 0.5, dlzka: 1.2, hlas: 0.04, pan: 0.3, dozvuk: 0.6 });
  u.push({ t: T.odhal, typ: 'sum', filter: 'highpass', f0: 5000, f1: 9000, dlzka: 1.0, hlas: 0.035, dozvuk: 0.6 });
  // plameň sviečky: tiché praskanie
  u.push({ t: T.odhal + 0.5, typ: 'praskot', dlzka: 1.4, hlas: 0.05, f: 1800, hustota: 30, semienko: 41 });
  // obsah knihy: Am pod scénou, každý druh svoj tón a ťuk
  u.push({ t: T.zmensOd, typ: 'pad', noty: ['A2', 'E3', 'C4', 'A4'], dlzka: 3.3, nabeh: 0.4, dobeh: 0.7, hlas: 0.1, filter: 1000 });
  u.push({ t: T.zmensOd, typ: 'sum', filter: 'bandpass', f0: 2200, f1: 700, q: 0.8, dlzka: 0.5, nabeh: 0.3, tvar: 'narast', hlas: 0.04 });
  ['A4', 'C5', 'E5', 'G5'].forEach((f, i) => {
    const t = T.kapOd + i * T.kapKrok + 0.1;
    u.push({ t, typ: 'tuk', f: 300 + i * 40, dlzka: 0.05, hlas: 0.05 });
    u.push({ t, typ: 'zvon', f, index: 0.7, dlzka: 1.0, hlas: 0.07, pan: -0.3 + i * 0.2, dozvuk: 0.4 });
  });
  // záver: F, potom C dur, zvony na názov a štítok
  u.push({ t: 15.5, typ: 'pad', noty: ['F2', 'C3', 'A3', 'C4'], dlzka: 0.9, nabeh: 0.3, dobeh: 0.4, hlas: 0.1, filter: 1100 });
  u.push({ t: T.rastOd, typ: 'glis', f0: 'E4', f1: 'A5', dlzka: 0.6, hlas: 0.03, dozvuk: 0.4 });
  u.push({ t: T.nazov, typ: 'pad', noty: ['C3', 'G3', 'E4', 'G4'], dlzka: DLZKA - T.nazov - 0.05, nabeh: 0.3, dobeh: 1.4, hlas: 0.14, filter: 1500, filter2: 800 });
  u.push({ t: T.nazov, typ: 'zvon', f: 'C4', index: 0.5, dlzka: 1.9, hlas: 0.11, dozvuk: 0.55 });
  // záverečné podržanie: tichý zvon na dobu v 18,5 s, aby 3 s ponuky nestáli bez zvuku
  u.push({ t: 18.5, typ: 'zvon', f: 'G5', index: 0.4, dlzka: 1.2, hlas: 0.03, pan: 0.2, dozvuk: 0.5 });
  u.push({ t: T.nazov + 0.02, typ: 'zvon', f: 'G4', index: 0.4, dlzka: 1.8, hlas: 0.06, dozvuk: 0.55 });
  u.push({ t: T.veta, typ: 'zvon', f: 'E5', index: 0.4, dlzka: 1.2, hlas: 0.05, dozvuk: 0.5 });
  u.push({ t: T.chip + 0.1, typ: 'tuk', f: 320, dlzka: 0.07, hlas: 0.06 });
  u.push({ t: T.chip + 0.1, typ: 'zvon', f: 'A5', index: 0.5, dlzka: 1.0, hlas: 0.06, dozvuk: 0.5 });
  u.push({ t: T.lesk, typ: 'zvon', f: 'C6', index: 0.5, dlzka: 0.7, hlas: 0.035, dozvuk: 0.5 });
  return u.filter((e) => e.t >= 0 && e.t < DLZKA);
}

export default film;
