// Duel: 2 Player Party Games, film na 19 sekúnd nakreslený a ozvučený kódom (kodfilm engine).
// Vzhľad podľa skutočnej appky (products/duel-android): nočný stôl #101116, hráč 1 oranžový kruh,
// hráč 2 modrý kosoštvorec so šikmými pruhmi, téma dosky Night, Nunito, ikony z Icons.kt, moment
// výsledku podľa ops/games/duel/vizual-spec.md časť 3.5 a 3.6 (zmrazenie, záblesk, rozsvietenie
// víťaza, stmavenie porazeného, odhalenie, hláška, +1 do bodky skóre), zvuky prepísané zo syntézy,
// ktorou vznikli WAV súbory appky (ops/games/word-search/prepare-sounds.py).
//
// Príbeh (zápas na dve vyhraté kolá, v appke voľba Length „First to 2“):
//   hák     White Flash: tmavé panely, záblesk, oranžový palec ťukne prvý, polovica sa rozsvieti, +1
//   kolo 2  Odd One Out: Orange je na match pointe, ťukne na zlú šípku, bod ide Blue (1:1)
//   kolo 3  Bigger Circle, Decider!: Orange ťukne na väčší kruh prvý (2:1)
//   koniec  obrazovka výsledku (Winner, 2 : 1, Rematch, konfety), názov a záver
// Každý čas, rozmer a text je v README filmu so zdrojom v kóde appky.

import { okno, obmedz, lerp, ease, hash, obalka } from './engine/cas.js';
import { platno, zrno, zaoblene } from './engine/kresba.js';
import { hak, format, zona, minPismo } from './engine/hak.js';
import { pridajNastroj } from './engine/zvuk.js';
import { FARBA, rgba, nun, nacitajPisma, IKONY, ikona, sprite, spriteTextu, spriteFarebny, spritePalca } from './kresby.js';

// ---------- záver: prepínač pre deň spustenia ----------
// Dnes appka nie je verejne v obchode: záver „Coming soon to Google Play“ bez pilulky a bez ▶, odkaz na
// #about (ops/video/kodfilm/DOSTUPNE-V-OBCHODE.md). V deň, keď verejná stránka obchodu vráti 200, stačí
// zmeniť ZAVER_PREDVOLENY na 'google-play' (alebo renderovať render.html?zaver=google-play).
// 'obchod' je verzia do samotného záznamu v Google Play: bez výzvy a bez „coming soon“.
export const ZAVERY = ['coming-soon', 'google-play', 'obchod'];
const ZAVER_PREDVOLENY = 'coming-soon';
let ZAVER = (() => {
  try {
    const q = new URLSearchParams(globalThis.location?.search || '').get('zaver');
    return ZAVERY.includes(q) ? q : ZAVER_PREDVOLENY;
  } catch { return ZAVER_PREDVOLENY; }
})();
export function nastavZaver(z) { if (ZAVERY.includes(z)) ZAVER = z; }
const PLAY_URL = 'https://play.google.com/store/apps/details?id=sk.arling.duel';
const TEXT_ZAVERU = {
  'coming-soon': 'Coming soon to Google Play',
  'google-play': 'Get it on Google Play',
  // store-listing-en.md: „NO ACCOUNTS, NO INTERNET, NO PURCHASES“
  obchod: 'No account. Nothing to buy.',
};

const DLZKA = 19;

// ---------- obrazovka telefónu v dp (Frame.kt, MiniGame.kt Mirror) ----------
// obrazovka 360 x 700 dp: najnižšie okno bez kompaktného rámu (BoardFrame.COMPACT_BELOW_DP = 700), aby bol
// telefón v 9:16 čo najširší (aspoň 80 % šírky zóny) a pás hráča ostal 12 dp
const SW = 360, SH = 700;
const RAM = 10, BW = SW + 2 * RAM, BH = SH + 2 * RAM; // telo telefónu s rámikom
const PAS_Y0 = SH * 0.45, PAS_Y1 = SH * 0.55, PAS_CY = SH / 2; // Mirror.BAND = .10
const POL = { x: 0, y: PAS_Y1, w: SW, h: SH - PAS_Y1 };          // dolná polovica (horná je jej otočenie)
const DOSKA = { x: 8, y: PAS_Y1 + 8, w: SW - 16, h: SH - PAS_Y1 - 8 - 12 }; // BoardFrame: side 8, band 8, near 12
const LISTA = { y: SH - 12, h: 12 };                                     // railHeight = near = 12
const PAD_H = Math.min(Math.max(DOSKA.h * (1 - 0.74), 64), DOSKA.h * 0.34); // TapPad.height
const PAD = { x: DOSKA.x, y: DOSKA.y + DOSKA.h - PAD_H, w: DOSKA.w, h: PAD_H };
const SCENA_LIGHT = { x: DOSKA.x, y: DOSKA.y, w: DOSKA.w, h: DOSKA.h - PAD_H };
const POL_CY = POL.y + POL.h / 2;

// ---------- kolá: časy (s) a skutočné pravidlá z kódu appky ----------
const ODPOCET = 1.5, TAKT = ODPOCET / 4;  // Hold.COUNTDOWN_MS 1500, Countdown.BEATS 4
const OKNO_REMIZY = 0.020;                // Rules.DRAW_WINDOW_MS
const KOLA = [
  // White Flash (Light.kt): tmavý panel, po náhodnom čakaní (kolo 1: 1,5 až 5 s) biely; ťuk pred zábleskom prehráva.
  // Hák začína v okamihu rozsvietenia: kolo sa rozhodlo 0,25 s pred snímkou 0 (Orange 231 ms po záblesku),
  // takže snímka 0 už ukazuje rozsvietenú polovicu, hlášku a čas; +1 letí do bodky počas háku.
  { id: 'light', nazov: 'White Flash', ikona: IKONY.light, rodina: FARBA.reflex, intro: -99, odpocet: -99, zive: -99,
    blesk: -0.501, tapO: -0.27, tapB: -0.19, vitaz: 'O', koniec: 3.30,
    hlaska: { O: 'Lightning thumbs! ⚡', B: 'Just a blink late 😴' }, metrika: { O: '231 ms' } },
  // Odd One Out (OddOne.kt): kolo 2 = mriežka 3 x 3, rozdiel 78,75° (90 -> 45 po krokoch), všetky ostatné šípky rovnako.
  // Orange ťukne na zlú šípku; Blue sa ešte len blíži k správnej, kolo sa skončí a jeho palec sa stiahne.
  { id: 'oddone', nazov: 'Odd One Out', ikona: IKONY.oddone, rodina: FARBA.visual, intro: 3.30, odpocet: 4.80, zive: 6.30,
    tapO: 7.24, tapB: null, vitaz: 'B', chybaO: true, koniec: 9.06,
    hlaska: { O: 'Look first, tap second 👓', B: 'Cool as ice 🧊' }, metrika: {} },
  // Bigger Circle (Bigger.kt): kolo 3 = plocha menšieho o 36 % menšia, kruhy na x .28 a .72, y .46
  { id: 'bigger', nazov: 'Bigger Circle', ikona: IKONY.bigger, rodina: FARBA.visual, intro: 9.06, odpocet: 10.56, zive: 12.06,
    tapO: 12.64, tapB: null, vitaz: 'O', koniec: 15.26,
    hlaska: { O: 'Nailed it! 🎯', B: 'Almost! 🤏' }, metrika: { O: '580 ms' } },
];
for (const K of KOLA) K.rozhodnute = (K.chybaO || K.tapB == null ? K.tapO : Math.min(K.tapO, K.tapB)) + OKNO_REMIZY; // Round.settleAt
// Hláška kola 2 a 3 až 0,35 s po rozhodnutí (appka 200 ms): palec, ktorý ťukol, dovtedy opustí polovicu.
const KARTA_OD = 0.35;
const VYSLEDOK = KOLA[2].rozhodnute + 2.6; // Hold.MATCH_RESULT_MS 2600, potom obrazovka výsledku

// Odd One Out: poloha a uhly sú naše, pravidlá z OddOne.kt (GRID[1] = 3 x 3, gap = ratio(90, 45, 2))
// Zlá šípka Orange je v strednom rade (bunka 5): správna je v hornej tretine polovice, hláška ide do dolnej
// (QuipPlacement), takže prstenec, krížik aj hláška sú vidno naraz.
const ODD = { stlpce: 3, riadky: 3, gap: 90 + (45 - 90) * (1 / 4), zaklad: 200, ina: 2, zlaO: 5 };
ODD.uhly = Array.from({ length: 9 }, (_, i) => (i === ODD.ina ? ODD.zaklad : ODD.zaklad + ODD.gap));
// Bigger Circle: kolo 3 (Bigger.kt): areaGap = ratio(.55, .17, 3), bigSize .32 až .38, zelený naľavo, fialový väčší
const BIG = { areaGap: 0.55 + (0.17 - 0.55) * 0.5, velky: 0.35, zelenyVlavo: true, zelenyVacsi: false };
BIG.maly = BIG.velky * Math.sqrt(1 - BIG.areaGap);

// hlášky: sady z Result.kt (Quips) na kontrolu, vo filme bez emoji (písmo filmu ich nemá)
const QUIPS = {
  win: ['Lightning thumbs! ⚡', 'Too quick for them! 🏎️', 'Nailed it! 🎯', 'Sharp eyes! 👀', "That's how it's done 😎", 'Boom. Point! 💥', 'Smooth! 🧈', 'Thumb of steel 🦾', 'Clean hit! ✨', 'You saw it first! 🔍', 'Textbook! 📚', 'Cool as ice 🧊', 'Big brain moment 🧠', 'On fire! 🔥'],
  mistake: ['Oops! Wrong one 🙈', 'So close. So wrong. 😅', 'Bold choice! 🫣', 'Thumb slipped? Sure. 😏', 'Nope! 🙃', 'A gift for your rival 🎁', 'Look first, tap second 👓', 'Plot twist: not that one 🌀', 'That was... creative 🎨', 'Eager thumb! 🐇', 'Brain buffering... ⏳', 'The other one! 👉', 'Whoops-a-daisy 🌼'],
  slower: ['Just a blink late 😴', 'Almost! 🤏', 'Next one is yours 💪', 'Warm up those thumbs 🧤', 'Beaten by a whisker 🐱', 'Close race! 🏁', 'They got lucky. Probably. 🍀', 'Shake it off 🕺'],
};
const bezEmoji = (s) => s.replace(/[^\x20-\x7E]+/g, '').trim();

const HAK = hak({ drz: 1.3, odchod: 0.6 }); // hák do 1,9 s

const T = {
  kartyR1: -1,                 // karty hlášok kola 1 sú celé vidno od snímky 0 (hák)
  presunOd: 15.45, presunDo: 16.05,
  nazov: 16.05, veta: 16.3, veta2: 16.5, tlacidlo: 16.75, tiraz: 17.1,
};

// titulky na obraze (čítajú sa): čas čítania slová / 3 + 0,5 s stráži test
const TITULKY = [
  { od: 1.95, do: 4.75, text: [['Lay the phone '], ['flat', FARBA.accent], [' between you.']] },
  { od: 4.8, do: 7.3, text: [['Both halves get the '], ['same round', FARBA.accent], ['.']] },
  { od: 7.32, do: 10.45, text: [['A '], ['wrong tap', FARBA.bad], [' gives the point away.']] },
  { od: 10.5, do: 15.2, text: [['27 quick games', FARBA.accent], [' for two players.']] },
];

// ---------- stav vrstiev ----------
let L = null;

function rozlozenie(W, H) {
  const F = format(W, H), Z = zona(W, H), mp = minPismo(W, H);
  const stlpec = F.druh === 'vysoky' || F.druh === 'portret';
  const R = { F, Z, mp, stlpec };
  if (stlpec) {
    // Telefón v príbehu čo najväčší (9:16: vyše 80 % šírky zóny). Jeho horný rámik a pás hráča smú siahnuť
    // o kúsok nad zónu (prekr), text v telefóne je nižšie a test overí, že ostane v zóne.
    const s = Math.min(Z.w * 1.2, Z.h * 0.8);
    R.s = s; R.zar = 'center';
    R.capPx = Math.max(s * 0.046, mp * 1.2);
    const capH = R.capPx * 1.25 * 2 + R.capPx * 0.35;
    R.g = s * 0.02;
    R.prekr = Math.min(Z.y0 * 0.35, 30);
    let hS = Z.h - capH - R.g + R.prekr, wS = (hS * BW) / BH;
    if (wS > Z.w) { wS = Z.w; hS = (wS * BH) / BW; }
    R.telS = { x: (W - wS) / 2, y: Z.y0 - R.prekr, w: wS, h: hS };
    R.tx = Z.x0; R.tw = Z.w;
    R.capY = R.telS.y + hS + R.g;
    // blok názvu je menší ako predtým, aby telefón na konci ostal veľký a výsledok čitateľný
    R.px = { nazov: s * 0.11, veta: Math.max(s * 0.05, mp * 1.2), veta2: Math.max(s * 0.037, mp * 1.05), cta: Math.max(mp * 1.12, s * 0.042), url: Math.max(s * 0.05, mp * 1.25) };
  } else {
    const hS = H - 2 * Math.max(H * 0.035, 30), wS = (hS * BW) / BH;
    const x0 = F.druh === 'siroky' ? Math.max(Z.x0, W * 0.15) : Z.x0;
    R.telS = { x: x0, y: (H - hS) / 2, w: wS, h: hS };
    R.tx = x0 + wS + Math.max(W * 0.045, 48);
    R.tw = Z.x1 - R.tx; R.zar = 'left';
    const s = Math.min(R.tw * 1.7, H);
    R.s = s;
    R.capPx = Math.max(Math.min(s * 0.055, R.tw * 0.075), mp * 1.2);
    R.g = s * 0.035;
    R.px = { nazov: Math.min(R.tw * 0.36, H * 0.14), veta: Math.max(Math.min(s * 0.056, R.tw * 0.07), mp * 1.2), veta2: Math.max(s * 0.04, mp * 1.1), cta: Math.max(mp * 1.15, Math.min(s * 0.044, R.tw * 0.06)), url: Math.max(s * 0.066, mp * 1.3) };
  }
  R.ppdS = R.telS.w / BW;
  return R;
}

/** Názov ako sprite (text appky) plus svetlá verzia na odlesk háku. */
function spriteNazvu(dpr, text, px, w, zarovnanie) {
  const m = platno(4, 4).getContext('2d');
  m.font = nun(800, px);
  const sirka = m.measureText(text).width;
  const vel = sirka > w * 0.94 ? (px * w * 0.94) / sirka : px;
  const h = vel * 1.22, x0 = zarovnanie === 'center' ? w / 2 : 0;
  const kresli = (farba) => (x) => { x.font = nun(800, vel); x.textBaseline = 'top'; x.textAlign = zarovnanie; x.fillStyle = farba; x.fillText(text, x0, vel * 0.04); };
  const s = sprite(dpr, w, h, kresli(FARBA.text));
  s.svetly = sprite(dpr, w, h, kresli(FARBA.accent)).c;
  s.px = vel; s.textW = (sirka * vel) / px;
  return s;
}

function stavVrstiev(W, H, dpr) {
  const R = rozlozenie(W, H);
  const { mp, ppdS } = R;
  const ew = R.tw, zar = R.zar;

  // --- texty mimo telefónu: koncový blok (a hák v rovnakom zložení) ---
  const nazov = spriteNazvu(dpr, 'Duel', R.px.nazov, ew, zar);
  const veta = spriteTextu(dpr, 'One phone. Two thumbs.', R.px.veta, ew, { vaha: 800, zarovnanie: zar, maxRiadkov: 2, minPx: mp });
  const veta2 = spriteTextu(dpr, '27 mini-games. Plays offline.', R.px.veta2, ew, { vaha: 700, farba: FARBA.textMuted, zarovnanie: zar, maxRiadkov: 2, minPx: mp });
  const cta = spriteTextu(dpr, TEXT_ZAVERU[ZAVER], R.px.cta, ew, { vaha: 800, farba: rgba(FARBA.text, 0.86), zarovnanie: zar, maxRiadkov: 2, minPx: mp * 1.1 });
  const url = spriteTextu(dpr, 'arling.sk', R.px.url, ew, { vaha: 800, farba: FARBA.accent, zarovnanie: zar, maxRiadkov: 1, minPx: mp });
  const g = R.stlpec ? R.s * 0.022 : R.g;
  const blokH = nazov.h + g * 0.35 + veta.h + g * 0.15 + veta2.h + g * 0.9 + cta.h + g * 0.35 + url.h;

  // --- telefón na konci a v háku (na výšku menší kvôli bloku názvu, ale čo najväčší) ---
  let telE;
  if (R.stlpec) {
    const gB = R.s * 0.03;
    const hE = Math.min(R.Z.h - blokH - gB + R.prekr, R.telS.h);
    const wE = (hE * BW) / BH;
    telE = { x: (W - wE) / 2, y: R.Z.y0 - R.prekr, w: wE, h: hE };
    R.ey = telE.y + hE + gB;
  } else {
    telE = { ...R.telS };
    R.ey = Math.max(R.Z.y0, (H - blokH) / 2);
  }
  R.telE = telE;
  R.kE = telE.h / R.telS.h;
  const poz = {};
  let y = R.ey;
  poz.nazov = y; y += nazov.h + g * 0.35;
  poz.veta = y; y += veta.h + g * 0.15;
  poz.veta2 = y; y += veta2.h + g * 0.9;
  poz.cta = y; y += cta.h + g * 0.35;
  poz.url = y;

  // --- titulky pod telefónom (stĺpec) alebo vpravo (šírka) ---
  const titulky = TITULKY.map((tt) => ({ ...tt, sp: spriteFarebny(dpr, tt.text, R.capPx, ew, { zarovnanie: zar }) }));
  const capMaxH = Math.max(...titulky.map((x) => x.sp.h));
  R.capYk = R.stlpec ? R.capY : (H - capMaxH) / 2;

  // --- texty v telefóne: sp appky * px na dp, najmenej cieľová veľkosť vo výslednom videu ---
  // cielPx je výška písma vo videu pri mierke, v ktorej sa text kreslí: príbeh (1) alebo hák a záver (kE).
  // Hlášky kola 1 kreslí aj hák (menší telefón), preto majú mieru háku; kolá 2 a 3 len príbeh.
  const px = (sp, cielPx, vHaku) => Math.max(sp * ppdS, vHaku ? cielPx / R.kE : cielPx);
  const wKarta = (SW - 2 * 20 - 2 * 16) * ppdS; // stĺpec 20 dp, vnútro karty 16 dp
  const T_ = (text, velkost, farba, w = wKarta, riadky = 2, vaha = 800) => spriteTextu(dpr, text, velkost, w, { vaha, farba, maxRiadkov: riadky, minPx: mp * 1.02 });
  const vnutri = {
    tap: { O: T_('TAP', px(22, 40, true), FARBA.p1, SW * 0.5 * ppdS, 1), B: T_('TAP', px(22, 40, true), FARBA.p2, SW * 0.5 * ppdS, 1) },
    nazvy: KOLA.map((K) => T_(K.nazov, px(22, 48), FARBA.text, (SW - 40 - 50) * ppdS, 1)),
    matchPoint: T_('Match point', px(18, 42), FARBA.accent, wKarta, 1),
    decider: T_('Decider!', px(18, 42), FARBA.accent, wKarta, 1),
    ready: T_('Ready', px(28, 46), FARBA.textMuted, wKarta, 1),
    set: T_('Set', px(28, 46), FARBA.textMuted, wKarta, 1),
    go: T_('Go!', px(64, 46), FARBA.good, wKarta, 1),
    karty: KOLA.map((K, k) => ({
      O: { hlaska: T_(bezEmoji(K.hlaska.O), px(22, 42, k === 0), FARBA.text), metrika: K.metrika.O ? T_(K.metrika.O, px(16, 40, k === 0), FARBA.textMuted, wKarta, 1, 700) : null },
      B: { hlaska: T_(bezEmoji(K.hlaska.B), px(22, 42, k === 0), FARBA.text), metrika: K.metrika.B ? T_(K.metrika.B, px(16, 40, k === 0), FARBA.textMuted, wKarta, 1, 700) : null },
    })),
    plus: { O: T_('+1', px(40, 46, true), FARBA.p1, 140 * ppdS, 1), B: T_('+1', px(40, 46, true), FARBA.p2, 140 * ppdS, 1) },
    // obrazovka výsledku sa číta hlavne na konci (menší telefón): väčšie písmo ako v appke
    winner: T_('Winner', px(22, 50, true), FARBA.text),
    soClose: T_('So close', px(22, 50, true), FARBA.text),
    skoreO: T_('2 : 1', px(40, 92, true), FARBA.p1, wKarta, 1),
    skoreB: T_('1 : 2', px(40, 92, true), FARBA.p2, wKarta, 1),
    rematch: T_('Rematch', px(18, 46, true), FARBA.onAccent, 240 * ppdS, 1),
  };

  // --- pozadie: nočný stôl, teplé svetlo lampy okolo telefónu, zrno ---
  const Wd = Math.round(W * dpr), Hd = Math.round(H * dpr);
  const pozadie = platno(Wd, Hd), px2 = pozadie.getContext('2d');
  px2.scale(dpr, dpr);
  px2.fillStyle = '#0B0C10'; px2.fillRect(0, 0, W, H);
  const cx = R.telS.x + R.telS.w / 2, cy = R.telS.y + R.telS.h * 0.5;
  const sv = px2.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.75);
  sv.addColorStop(0, 'rgba(58,52,44,0.55)'); sv.addColorStop(0.45, 'rgba(30,28,30,0.35)'); sv.addColorStop(1, 'rgba(0,0,0,0)');
  px2.fillStyle = sv; px2.fillRect(0, 0, W, H);

  // --- telo telefónu (v príbehu veľkosti), tieň zapečený ---
  const okrajT = 60;
  const telo = sprite(dpr, (BW + okrajT * 2) * ppdS, (BH + okrajT * 2) * ppdS, (x) => {
    x.scale(ppdS, ppdS);
    x.save();
    x.shadowColor = 'rgba(0,0,0,0.6)'; x.shadowBlur = 40 * ppdS; x.shadowOffsetY = 16 * ppdS;
    zaoblene(x, okrajT, okrajT, BW, BH, 46); x.fillStyle = '#07080B'; x.fill();
    x.restore();
    zaoblene(x, okrajT + 0.8, okrajT + 0.8, BW - 1.6, BH - 1.6, 45.5);
    x.lineWidth = 1.6; x.strokeStyle = '#2E3140'; x.stroke();
  });

  const palce = { O: spritePalca(ppdS * dpr, 'svetly'), B: spritePalca(ppdS * dpr, 'tmavy') };
  const zrna = zrno(3, Math.round(160 * dpr), 1, 11).map((z) => ({ z }));

  L = { W, H, dpr, R, pozadie, telo, okrajT, palce, zrna, texty: { nazov, veta, veta2, cta, url, poz, titulky }, vnutri };
  L.pohyb = choreografia(R);
}

// ---------- geometria hier v súradniciach dolnej polovice (dp obrazovky) ----------
function bunkaOdd(i) {
  const cw = DOSKA.w / ODD.stlpce, ch = DOSKA.h / ODD.riadky;
  return { x: DOSKA.x + (i % ODD.stlpce + 0.5) * cw, y: DOSKA.y + (Math.floor(i / ODD.stlpce) + 0.5) * ch, w: cw, h: ch };
}
function kruh(zeleny) {
  const vlavo = zeleny === BIG.zelenyVlavo;
  const vel = zeleny === BIG.zelenyVacsi ? BIG.velky : BIG.maly;
  return { x: DOSKA.x + (vlavo ? 0.28 : 0.72) * DOSKA.w, y: DOSKA.y + 0.46 * DOSKA.h, r: Math.min(vel * DOSKA.w, vel * DOSKA.h) / 2, zeleny };
}
/** Bod dolnej polovice -> ten istý bod na hornej polovici (otočenie o 180° okolo stredu obrazovky). */
const otoc = ([x, y]) => [SW - x, SH - y];

// ---------- palce: kľúčové snímky v dp obrazovky ----------
function choreografia(R) {
  // Orange sedí dole, jeho pravý palec prichádza sprava zdola; Blue sedí oproti, jeho pravý palec zľava
  // zhora (bodová súmernosť cez stred telefónu). Na výšku (stĺpec) prichádzajú palce zboku a plochšie,
  // aby nikdy neprešli cez titulky pod telefónom; na šírku zdola a zhora, lebo text je vpravo.
  const domO = R.stlpec ? { x: SW + 330, y: 600, u: -1.4 } : { x: 250, y: SH + 170, u: -0.28 };
  const domB = R.stlpec ? { x: -330, y: SH - 600, u: Math.PI - 1.4 } : { x: SW - 250, y: -170, u: Math.PI - 0.28 };
  const padO = [PAD.x + PAD.w * 0.72, PAD.y + PAD.h * 0.45], padB = otoc([PAD.x + PAD.w * 0.72, PAD.y + PAD.h * 0.45]);
  const zlaO = bunkaOdd(ODD.zlaO), inaB = otoc([bunkaOdd(ODD.ina).x, bunkaOdd(ODD.ina).y]);
  const vahaO = bunkaOdd(8); // Orange najprv zaváha nad dolnou pravou šípkou
  const velkyO = kruh(BIG.zelenyVacsi), velkyB = otoc([velkyO.x, velkyO.y]);
  const k = (t, b, p = 0) => ({ t, x: b[0], y: b[1], p });
  const nad = (b, dom, d = 30) => [b[0] - Math.sin(dom.u) * d, b[1] + Math.cos(dom.u) * d];
  // von: hrot palca rýchlo mimo telefón (smerom k ruke), aby hláška, prstenec a krížik ostali voľné
  const vonO = (b) => (R.stlpec ? [SW + 90, b[1] + 16] : [b[0] + 26, SH + 90]);
  const vonB = (b) => (R.stlpec ? [-90, b[1] - 16] : [b[0] - 26, -90]);
  const Z = (b) => [b.x, b.y];
  const O = [
    // hák: kolo sa rozhodlo pred snímkou 0, palec sa práve zdvíha z padu a odchádza
    k(0, nad(padO, domO, 20)), k(0.3, vonO(padO)), k(0.95, [domO.x, domO.y]),
    k(5.5, [domO.x, domO.y]), k(6.45, nad(Z(vahaO), domO, 34)), k(6.9, nad(Z(vahaO), domO, 28)),
    k(7.14, nad(Z(zlaO), domO, 20)), k(7.24, Z(zlaO), 1), k(7.3, Z(zlaO), 1), k(7.52, vonO(Z(zlaO))), k(8.2, [domO.x, domO.y]),
    k(11.0, [domO.x, domO.y]), k(12.1, nad(Z(velkyO), domO, 40)), k(12.55, nad(Z(velkyO), domO, 18)),
    k(12.64, Z(velkyO), 1), k(12.7, Z(velkyO), 1), k(12.92, vonO(Z(velkyO))), k(13.6, [domO.x, domO.y]),
  ];
  const B = [
    k(0, nad(padB, domB, 24)), k(0.35, vonB(padB)), k(1.0, [domB.x, domB.y]),
    // kolo 2 a 3: Blue sa blíži k správnej odpovedi, kolo sa skončí skôr, palec sa stiahne (neťukne)
    k(5.7, [domB.x, domB.y]), k(6.7, nad(inaB, domB, 44)), k(7.2, nad(inaB, domB, 26)), k(7.3, nad(inaB, domB, 30)), k(7.55, vonB(inaB)), k(8.3, [domB.x, domB.y]),
    k(11.2, [domB.x, domB.y]), k(12.25, nad(velkyB, domB, 44)), k(12.64, nad(velkyB, domB, 26)), k(12.7, nad(velkyB, domB, 30)), k(12.95, vonB(velkyB)), k(13.6, [domB.x, domB.y]),
  ];
  return { O: { kluce: O, u: domO.u }, B: { kluce: B, u: domB.u }, dotyky: { O: [[KOLA[0].tapO, padO], [KOLA[1].tapO, Z(zlaO)], [KOLA[2].tapO, Z(velkyO)]], B: [[KOLA[0].tapB, padB]] } };
}

function poza(kto, t) {
  const P = L.pohyb[kto], K = P.kluce;
  if (t <= K[0].t) return { x: K[0].x, y: K[0].y, p: K[0].p, u: P.u };
  for (let i = 1; i < K.length; i++) {
    if (t <= K[i].t) {
      const a = K[i - 1], b = K[i], q = ease.inOutCubic(okno(t, a.t, b.t));
      return { x: lerp(a.x, b.x, q), y: lerp(a.y, b.y, q), p: lerp(a.p, b.p, q), u: P.u };
    }
  }
  const z = K[K.length - 1];
  return { x: z.x, y: z.y, p: z.p, u: P.u };
}

// ---------- čas: poloha telefónu, kolo, skóre ----------
/** 1 = poloha háku a konca (menší telefón), 0 = príbeh. */
function polohaKonca(t) {
  if (t < HAK.koniec) return 1 - HAK.navrat(t);
  return ease.inOutCubic(okno(t, T.presunOd, T.presunDo));
}
function fazaKola(K, t) {
  if (t < K.odpocet) return 'intro';
  if (t < K.zive) return 'odpocet';
  if (t < K.rozhodnute) return 'zive';
  return 'rozhodnute';
}
/** Skóre podľa bodiek: bod pribudne, keď +1 doletí (rozhodnutie + 0,6 s štart, 0,4 s let). */
function skore(t) {
  const s = { O: 0, B: 0 };
  for (const K of KOLA) if (t >= K.rozhodnute + 1.0) s[K.vitaz]++;
  return s;
}
const bodkaX = (kto, i) => (kto === 'O' ? 16 + i * 18 + 6 : SW - 16 - i * 18 - 6); // scoreRail: 12 dp, medzera 6, okraj 16

// ---------- kreslenie obrazovky (v dp) ----------
let A0 = 1; // násobok priehľadnosti pre prelínanie obrazoviek
const alfa = (x, v) => { x.globalAlpha = obmedz(A0 * v); };

function polovica(x, kto, fn) {
  if (kto === 'O') { fn(); return; }
  x.save(); x.translate(SW, SH); x.rotate(Math.PI); fn(); x.restore();
}
function sp(x, s, cx, cy, mierka = 1) {
  const k = mierka / L.R.ppdS;
  const w = s.w * k, h = s.h * k;
  x.drawImage(s.c, cx - w / 2, cy - h / 2, w, h);
}
const spW = (s) => s.w / L.R.ppdS, spH = (s) => s.h / L.R.ppdS;

function pruhyHraca(x, box, farba, a, krok = 24, sirka = 6) {
  x.save();
  x.beginPath(); x.rect(box.x, box.y, box.w, box.h); x.clip();
  x.strokeStyle = farba; x.lineWidth = sirka; alfa(x, a);
  x.beginPath();
  for (let q = box.x - box.h; q < box.x + box.w + box.h; q += krok) { x.moveTo(q, box.y + box.h); x.lineTo(q + box.h, box.y); }
  x.stroke();
  x.restore();
}
const farbaHraca = (kto) => (kto === 'O' ? FARBA.p1 : FARBA.p2);
const tvarHraca = (kto) => (kto === 'O' ? IKONY.playerOne : IKONY.playerTwo);

function kresliListu(x, kto, t, vitaz = false) {
  // pás hráča pri jeho okraji; pri dotyku sa rozjasní (0,45 -> 0,85 na 220 ms), víťazovi kola svieti celý moment
  let jas = vitaz ? 0.85 : 0.45;
  for (const [td] of L.pohyb.dotyky[kto]) if (t >= td && t < td + 0.22) jas = 0.85;
  alfa(x, jas); x.fillStyle = farbaHraca(kto); x.fillRect(0, LISTA.y, SW, LISTA.h);
  alfa(x, 1);
}

function kresliPad(x, kto) {
  const f = farbaHraca(kto);
  alfa(x, 0.22); zaoblene(x, PAD.x, PAD.y, PAD.w, PAD.h, 16); x.fillStyle = f; x.fill();
  alfa(x, 1); x.lineWidth = 2; x.strokeStyle = f; x.stroke();
  if (kto === 'B') pruhyHraca(x, PAD, f, 0.30, 12, 6);
  const cx = PAD.x + PAD.w / 2, cy = PAD.y + PAD.h / 2, zn = Math.min(PAD.h * 0.44, 26);
  alfa(x, 1);
  ikona(x, tvarHraca(kto), cx - PAD.w * 0.22 - zn / 2, cy - zn / 2, zn, f, f);
  // slovo TAP začína za tvarom (Draw.kt pad: centre.x + mark * .7)
  const s = L.vnutri.tap[kto], lx = cx + zn * 0.7;
  x.drawImage(s.c, lx - (spW(s) - s.textW / L.R.ppdS) / 2, cy - spH(s) / 2, spW(s), spH(s));
}

function kresliSipku(x, cx, cy, w, h, uhol) {
  const dosah = w / 2;
  x.save();
  x.translate(cx, cy); x.rotate((uhol * Math.PI) / 180);
  x.beginPath();
  x.moveTo(-dosah, 0); x.lineTo(dosah, 0);
  x.moveTo(dosah * 0.35, -h * 0.36); x.lineTo(dosah, 0); x.lineTo(dosah * 0.35, h * 0.36);
  x.lineWidth = 5; x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = FARBA.paper; x.stroke();
  x.restore();
}

function kresliDosku(x, K, t) {
  if (K.id === 'light') {
    const lit = t >= K.blesk;
    zaoblene(x, SCENA_LIGHT.x, SCENA_LIGHT.y, SCENA_LIGHT.w, SCENA_LIGHT.h, 12);
    x.fillStyle = lit ? FARBA.white : FARBA.panel; x.fill();
    return;
  }
  zaoblene(x, DOSKA.x, DOSKA.y, DOSKA.w, DOSKA.h, 12); x.fillStyle = FARBA.panel; x.fill();
  if (K.id === 'oddone') {
    for (let i = 0; i < 9; i++) { const b = bunkaOdd(i); kresliSipku(x, b.x, b.y, b.w * 0.66, b.h * 0.66, ODD.uhly[i]); }
  } else {
    for (const z of [true, false]) {
      const c = kruh(z);
      x.beginPath(); x.arc(c.x, c.y, c.r, 0, Math.PI * 2); x.fillStyle = z ? FARBA.green : FARBA.purple; x.fill();
    }
  }
}

/** Prstenec správnej odpovede (good, 4 dp) s dvoma pulzmi po 300 ms a krížik zlého ťuku (bad). */
function kresliOdhalenie(x, K, kto, dt) {
  if (dt < 0.15 || K.id === 'light') return;
  const p = dt - 0.15;
  const pulz = p < 0.6 ? 1 + 0.06 * Math.sin(Math.PI * ((p % 0.3) / 0.3)) : 1;
  let c;
  if (K.id === 'oddone') { const b = bunkaOdd(ODD.ina); c = { x: b.x, y: b.y, r: Math.min(b.w, b.h) / 2 }; }
  else { const k = kruh(BIG.zelenyVacsi); c = { x: k.x, y: k.y, r: k.r }; }
  alfa(x, obmedz(p / 0.12));
  x.beginPath(); x.arc(c.x, c.y, c.r * pulz, 0, Math.PI * 2);
  x.lineWidth = 4; x.strokeStyle = FARBA.good; x.stroke();
  if (K.chybaO && kto === 'O') {
    const b = bunkaOdd(ODD.zlaO), d = Math.min(b.w, b.h) / 3;
    x.beginPath(); x.moveTo(b.x - d, b.y - d); x.lineTo(b.x + d, b.y + d); x.moveTo(b.x + d, b.y - d); x.lineTo(b.x - d, b.y + d);
    x.lineWidth = 4; x.lineCap = 'round'; x.strokeStyle = FARBA.bad; x.stroke();
  }
  alfa(x, 1);
}

/** Moment výsledku (vizual-spec 3.6): záblesk 120 ms, rozsvietenie 60 ms na .45, doznenie 400 ms na .30,
 *  dýchanie +-.04 pri 1,2 Hz; porazený stmavne na .55 za 250 ms. */
function kresliSvetlo(x, K, kto, dt) {
  if (dt < 0) return;
  const pol = { x: 0, y: POL.y, w: SW, h: POL.h };
  if (kto === K.vitaz) {
    const f = farbaHraca(kto);
    let a;
    if (dt < 0.06) a = 0.45 * (dt / 0.06);
    else if (dt < 0.46) a = lerp(0.45, 0.30, ease.outCubic((dt - 0.06) / 0.4));
    else a = 0.30 + 0.04 * Math.sin(2 * Math.PI * 1.2 * (dt - 0.46));
    alfa(x, a); x.fillStyle = f; x.fillRect(pol.x, pol.y, pol.w, pol.h);
    if (kto === 'B') pruhyHraca(x, pol, f, a * 0.55);
    // dva sústredné obrysy bez rozmazania (vizual-spec 3.3): vonkajší 12 dp s alfou .18, vnútorný 6 dp plný
    zaoblene(x, DOSKA.x, DOSKA.y, DOSKA.w, DOSKA.h, 12);
    alfa(x, 0.18 * obmedz(dt / 0.06)); x.lineWidth = 12; x.strokeStyle = f; x.stroke();
    alfa(x, obmedz(dt / 0.06)); x.lineWidth = 6; x.stroke();
    if (dt < 0.12) { alfa(x, 0.20 * (1 - dt / 0.12)); x.fillStyle = FARBA.white; x.fillRect(pol.x, pol.y, pol.w, pol.h); }
  } else {
    alfa(x, 0.55 * ease.outCubic(obmedz(dt / 0.25))); x.fillStyle = '#000000'; x.fillRect(pol.x, pol.y, pol.w, pol.h);
  }
  alfa(x, 1);
}

/** Čo musí hláška nechať voľné (súradnice dolnej polovice, dp): prstenec správnej odpovede, krížik zlého
 *  ťuku a pri hrách na celú polovicu pad hráča. Obdĺžniky okolo kruhov s rezervou na pulz a obrys. */
function cieleKola(K, kto) {
  const okolo = (x0, y0, r) => ({ x: x0 - r - 4, y: y0 - r - 4, w: 2 * r + 8, h: 2 * r + 8 });
  if (K.id === 'light') return [{ x: PAD.x, y: PAD.y, w: PAD.w, h: PAD.h }];
  if (K.id === 'oddone') {
    const b = bunkaOdd(ODD.ina), out = [okolo(b.x, b.y, (Math.min(b.w, b.h) / 2) * 1.06)];
    if (kto === 'O') { const z = bunkaOdd(ODD.zlaO); out.push(okolo(z.x, z.y, Math.min(z.w, z.h) / 3)); }
    return out;
  }
  const c = kruh(BIG.zelenyVacsi);
  return [okolo(c.x, c.y, c.r * 1.06)];
}
/** Rozmer karty hlášky (dp) a jej umiestnenie podľa vizual-spec 3.6 (QuipPlacement): horná tretina
 *  polovice (v orientácii hráča, pri páse), a ak tam leží zvýraznená odpoveď, dolná tretina. */
function kartaKola(k, kto) {
  const K = KOLA[k], c = L.vnutri.karty[k][kto];
  const hh = spH(c.hlaska), mh = c.metrika ? spH(c.metrika) : 0;
  const tw = Math.max(c.hlaska.textW / L.R.ppdS, c.metrika ? c.metrika.textW / L.R.ppdS : 0);
  const w = Math.min(SW - 40, tw + 32), h = hh + (c.metrika ? mh * 0.92 : 0) + 20;
  const hore = Math.max(POL.y + POL.h / 6, POL.y + h / 2 + 4), dole = Math.min(POL.y + POL.h * (5 / 6), LISTA.y - h / 2 - 6);
  const ciele = cieleKola(K, kto);
  const volne = (cy) => !ciele.some((q) => q.x < SW / 2 + w / 2 && q.x + q.w > SW / 2 - w / 2 && q.y < cy + h / 2 && q.y + q.h > cy - h / 2);
  const cy = [hore, dole, POL_CY].find(volne) ?? hore;
  return { c, w, h, hh, mh, cx: SW / 2, cy };
}

function kresliKartu(x, k, kto, t, od) {
  const dt = t - od;
  if (dt < 0) return;
  const { c, w, h, hh, mh, cx, cy } = kartaKola(k, kto);
  const q = ease.outCubic(obmedz(dt / 0.28));
  const mierka = 0.92 + 0.08 * Math.min(1.03, ease.outBack(obmedz(dt / 0.28), 0.6));
  x.save();
  x.translate(cx, cy); x.scale(mierka, mierka); x.translate(-cx, -cy);
  // pilulka surface: .92 namiesto .85 zo špecifikácie, aby cez ňu vo videu nepresvitala doska
  alfa(x, 0.92 * q); zaoblene(x, cx - w / 2, cy - h / 2, w, h, 16); x.fillStyle = FARBA.surface; x.fill();
  alfa(x, q);
  const y0 = cy - h / 2 + 10;
  sp(x, c.hlaska, cx, y0 + hh / 2);
  if (c.metrika) sp(x, c.metrika, cx, y0 + hh + mh * 0.42);
  x.restore();
  alfa(x, 1);
}

function kresliPlus(x, K, t) {
  const dt = t - (K.rozhodnute + 0.6);
  if (dt < 0 || dt > 0.45) return;
  const kto = K.vitaz, i = skore(K.rozhodnute + 0.5)[kto];
  const q = ease.inOutCubic(obmedz(dt / 0.4));
  const bx = bodkaX('O', i), by = PAS_CY; // v súradniciach hráča: jeho bodky sú pri jeho ľavom okraji
  const karta = kartaKola(KOLA.indexOf(K), kto); // +1 vyletí z hlášky víťaza
  const px = lerp(karta.cx, bx, q), py = lerp(karta.cy, by, q);
  polovica(x, kto, () => {
    alfa(x, 1 - okno(dt, 0.34, 0.45));
    sp(x, L.vnutri.plus[kto], px, py);
    alfa(x, 1);
  });
}

function kresliPas(x, t, K) {
  alfa(x, 1);
  x.fillStyle = FARBA.bg; x.fillRect(0, PAS_Y0, SW, PAS_Y1 - PAS_Y0);
  const s = skore(t);
  for (const kto of ['O', 'B']) {
    const f = farbaHraca(kto);
    for (let i = 0; i < 2; i++) {
      const bx = bodkaX(kto, i);
      x.beginPath(); x.arc(bx, PAS_CY, 6, 0, Math.PI * 2);
      x.lineWidth = 2; alfa(x, 0.5); x.strokeStyle = f; x.stroke(); alfa(x, 1);
      if (i < s[kto]) {
        // bodka naskočí, keď do nej doletí +1 (prekmit najviac 3 %)
        const kolo = KOLA.filter((k) => k.vitaz === kto)[i];
        const p = obmedz((t - (kolo.rozhodnute + 1.0)) / 0.35);
        const r = 6 * (p < 1 ? Math.min(1.03, ease.outBack(p, 0.5)) : 1);
        x.beginPath(); x.arc(bx, PAS_CY, Math.max(0, r), 0, Math.PI * 2); x.fillStyle = f; x.fill();
      }
    }
  }
  if (K && fazaKola(K, t) === 'odpocet') {
    const ms = t - K.odpocet, lit = Math.min(3, Math.floor(ms / TAKT) + 1), go = ms >= 3 * TAKT;
    for (let i = 0; i < 3; i++) {
      const lx = SW / 2 + (i - 1) * 22;
      x.beginPath(); x.arc(lx, PAS_CY, 7, 0, Math.PI * 2);
      if (i < lit) {
        const pop = 1 + 0.03 * Math.sin(Math.PI * obmedz((ms - i * TAKT) / 0.18));
        x.beginPath(); x.arc(lx, PAS_CY, 7 * pop, 0, Math.PI * 2);
        x.fillStyle = go ? FARBA.good : FARBA.accent; x.fill();
      } else { x.lineWidth = 2; x.strokeStyle = FARBA.outline; x.stroke(); }
    }
  }
}

function kresliIntro(x, k, kto, t) {
  const K = KOLA[k], v = L.vnutri;
  const dt = t - K.intro, q = ease.outCubic(obmedz(dt / 0.24));
  const mp = k === 1 && kto === 'O', dec = k === 2;
  const extra = dec ? v.decider : mp ? v.matchPoint : null;
  const nz = v.nazvy[k];
  const ikonaDp = 40, gap = 10;
  const rowH = Math.max(ikonaDp, spH(nz));
  const h = (extra ? spH(extra) + 8 : 0) + rowH;
  let y = POL_CY - h / 2 + (1 - q) * 24;
  alfa(x, q);
  if (extra) { sp(x, extra, SW / 2, y + spH(extra) / 2); y += spH(extra) + 8; }
  const rw = ikonaDp + gap + nz.textW / L.R.ppdS;
  const x0 = SW / 2 - rw / 2;
  ikona(x, K.ikona, x0, y + rowH / 2 - ikonaDp / 2, ikonaDp, FARBA.text, K.rodina);
  x.drawImage(nz.c, x0 + ikonaDp + gap - (spW(nz) - nz.textW / L.R.ppdS) / 2, y + rowH / 2 - spH(nz) / 2, spW(nz), spH(nz));
  alfa(x, 1);
}

function kresliOdpocet(x, K, t) {
  const ms = t - K.odpocet, lit = Math.min(3, Math.floor(ms / TAKT) + 1), go = ms >= 3 * TAKT;
  const v = L.vnutri, s = go ? v.go : lit >= 3 ? v.set : v.ready;
  const zmena = go ? 3 * TAKT : lit >= 3 ? 2 * TAKT : 0;
  const p = obmedz((ms - zmena) / 0.18);
  const m = 0.94 + 0.06 * ease.outCubic(p);
  alfa(x, obmedz(p * 2));
  sp(x, s, SW / 2, POL_CY, m);
  alfa(x, 1);
}

function kresliVlnky(x, t) {
  for (const kto of ['O', 'B']) {
    for (const [td, b] of L.pohyb.dotyky[kto]) {
      const g = (t - td) / 0.3;
      if (g < 0 || g > 1) continue;
      alfa(x, 0.35 * (1 - g));
      x.beginPath(); x.arc(b[0], b[1], 18 + 16 * g, 0, Math.PI * 2); x.fillStyle = FARBA.text; x.fill();
    }
  }
  alfa(x, 1);
}

function kresliKolo(x, k, t) {
  const K = KOLA[k], f = fazaKola(K, t), dt = t - K.rozhodnute;
  alfa(x, 1);
  x.fillStyle = FARBA.bg; x.fillRect(0, 0, SW, SH);
  for (const kto of ['O', 'B']) polovica(x, kto, () => {
    kresliListu(x, kto, t, f === 'rozhodnute' && kto === K.vitaz);
    if (f === 'zive' || f === 'rozhodnute') {
      kresliDosku(x, K, t);
      if (K.id === 'light') kresliPad(x, kto);
      if (f === 'rozhodnute') { kresliOdhalenie(x, K, kto, dt); kresliSvetlo(x, K, kto, dt); }
    }
    if (f === 'intro') kresliIntro(x, k, kto, t);
    if (f === 'odpocet') kresliOdpocet(x, K, t);
  });
  kresliPas(x, t, K);
  if (f === 'rozhodnute') {
    const od = k === 0 ? T.kartyR1 : K.rozhodnute + KARTA_OD;
    for (const kto of ['O', 'B']) polovica(x, kto, () => {
      kresliKartu(x, k, kto, t, od);
      // prstenec správnej odpovede ešte raz nad kartou (MainActivity: correctRings)
      if (K.id !== 'light' && dt > 0.15) kresliOdhalenie(x, { ...K, chybaO: false }, kto, dt);
    });
    kresliPlus(x, K, t);
  }
  kresliVlnky(x, t);
}

// konfety obrazovky výsledku (MainActivity Confetti): 30 kúskov, pád 2600 ms, farby témy night
const KONFETY = Array.from({ length: 30 }, (_, i) => [hash(i, 19), hash(i, 23), hash(i, 29)]);
function kresliKonfety(x, t) {
  const pr = obmedz((t - VYSLEDOK) / 2.6);
  const farby = [FARBA.green, FARBA.warm, FARBA.cool];
  KONFETY.forEach(([napriec, nabeh, tocenie], i) => {
    const dosah = obmedz((pr - nabeh * 0.35) / (1 - nabeh * 0.35));
    const cx = SW * (0.04 + napriec * 0.92), cy = SH * (-0.05 + dosah * dosah * 1.02);
    const d = SW * (0.016 + tocenie * 0.012);
    x.save(); x.translate(cx, cy); x.rotate(tocenie * 6 + pr * (2 + tocenie * 3));
    x.fillStyle = farby[i % 3]; x.fillRect(-d * 0.6, -d * 0.6, d * 1.2, d * 1.2);
    x.restore();
  });
}

function kresliVysledok(x, t) {
  const v = L.vnutri;
  alfa(x, 1);
  x.fillStyle = FARBA.bg; x.fillRect(0, 0, SW, SH);
  kresliKonfety(x, t);
  for (const kto of ['O', 'B']) polovica(x, kto, () => {
    if (kto === 'O') { alfa(x, 0.30); x.fillStyle = FARBA.p1; x.fillRect(0, POL.y, SW, POL.h); alfa(x, 1); }
    const nad = kto === 'O' ? v.winner : v.soClose, sk = kto === 'O' ? v.skoreO : v.skoreB;
    // Rematch: pilulka aspoň 72 dp, accent, ikona odvety a slovo (ResultCoin.REMATCH_DP, Pill); písmo je
    // vo filme väčšie ako v appke, pilulka a ikona rastú s ním
    const rH = Math.max(72, spH(v.rematch) * 1.45), gap = 6;
    const h = spH(nad) + gap + spH(sk) + gap + rH;
    let y = POL_CY - h / 2;
    sp(x, nad, SW / 2, y + spH(nad) / 2); y += spH(nad) + gap;
    sp(x, sk, SW / 2, y + spH(sk) / 2); y += spH(sk) + gap;
    zaoblene(x, 20, y, SW - 40, rH, rH / 2); x.fillStyle = FARBA.accent; x.fill();
    const rw = v.rematch.textW / L.R.ppdS, iw = Math.max(24, spH(v.rematch) * 0.62), sirka = iw + 10 + rw, x0 = SW / 2 - sirka / 2;
    ikona(x, IKONY.rematch, x0, y + rH / 2 - iw / 2, iw, FARBA.onAccent);
    x.drawImage(v.rematch.c, x0 + iw + 10 - (spW(v.rematch) - rw) / 2, y + rH / 2 - spH(v.rematch) / 2, spW(v.rematch), spH(v.rematch));
  });
}

function kresliObrazovku(x, t) {
  x.save();
  zaoblene(x, 0, 0, SW, SH, 34); x.clip();
  A0 = 1;
  // ktorá obrazovka a prelínanie (0,16 s) na hraniciach
  if (t >= VYSLEDOK) {
    const p = obmedz((t - VYSLEDOK) / 0.2);
    if (p < 1) { kresliKolo(x, 2, t); A0 = p; }
    kresliVysledok(x, t);
  } else {
    let k = 0;
    for (let i = 0; i < KOLA.length; i++) if (t >= KOLA[i].intro) k = i;
    const p = k > 0 ? obmedz((t - KOLA[k].intro) / 0.16) : 1;
    if (p < 1) { kresliKolo(x, k - 1, t); A0 = p; }
    kresliKolo(x, k, t);
  }
  A0 = 1; x.globalAlpha = 1;
  x.restore();
}

function kresliPalce(x, t) {
  for (const kto of ['B', 'O']) {
    const p = poza(kto, t), s = L.palce[kto];
    const m = 1 + 0.05 * (1 - p.p); // palec nad sklom je bližšie ku kamere
    x.save();
    x.translate(p.x, p.y); x.rotate(p.u); x.scale(m, m);
    x.drawImage(s.c, -s.hrot[0], -s.hrot[1], s.w, s.h);
    x.restore();
  }
}

// ---------- texty mimo telefónu ----------
function kresliTexty(x, t) {
  const { R, texty } = L, { poz } = texty;
  const ex = R.tx;
  if (t < HAK.koniec) {
    HAK.kresliNazov(x, t, texty.nazov, ex, poz.nazov);
    HAK.kresliRiadok(x, t, texty.veta, ex, poz.veta);
    HAK.kresliRiadok(x, t, texty.veta2, ex, poz.veta2, 0.14);
  }
  for (const tt of texty.titulky) {
    const a = obalka(t, tt.od, tt.do, 0.3, 0.25);
    if (a <= 0) continue;
    const vstup = ease.outCubic(okno(t, tt.od, tt.od + 0.4));
    x.globalAlpha = a;
    x.drawImage(tt.sp.c, ex, R.capYk + (1 - vstup) * R.s * 0.02, tt.sp.w, tt.sp.h);
    x.globalAlpha = 1;
  }
  const vyjdi = (s, od, y, trv = 0.6) => {
    const p = ease.outCubic(okno(t, od, od + trv));
    if (p <= 0) return;
    x.save();
    // maska: text vystúpi zdola, ale pod svojím miestom sa nikdy neukáže (spodný okraj zóny)
    x.beginPath(); x.rect(ex - 10, y - 4, s.w + 20, s.h + 4); x.clip();
    x.globalAlpha = obmedz(p * 1.5);
    x.drawImage(s.c, ex, y + (1 - p) * s.h * 0.9, s.w, s.h);
    x.restore();
  };
  vyjdi(texty.nazov, T.nazov, poz.nazov, 0.7);
  vyjdi(texty.veta, T.veta, poz.veta);
  vyjdi(texty.veta2, T.veta2, poz.veta2);
  vyjdi(texty.cta, T.tlacidlo, poz.cta, 0.5);
  vyjdi(texty.url, T.tiraz, poz.url, 0.6);
}

function kresliZrno(x, t, env) {
  const i = env.slabe ? 0 : Math.abs(Math.floor(t * 12)) % 3;
  const z = L.zrna[i];
  if (!z.vzor) z.vzor = x.createPattern(z.z, 'repeat');
  x.save();
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.globalAlpha = 0.035;
  x.fillStyle = z.vzor;
  x.fillRect(0, 0, L.W * L.dpr, L.H * L.dpr);
  x.restore();
}

/** Obdĺžnik tela telefónu v čase t (logické body plátna). */
function telefon(t) {
  const { telS, telE } = L.R, p = polohaKonca(t);
  return { x: lerp(telS.x, telE.x, p), y: lerp(telS.y, telE.y, p), w: lerp(telS.w, telE.w, p), h: lerp(telS.h, telE.h, p) };
}

const film = {
  dlzka: DLZKA,
  plagat: 0.9,
  titulky: [
    { od: 0, text: 'Duel. A phone lies flat between two players, the screen split in half and the top half turned around. Both panels have just flashed white and the orange thumb was quicker: the bottom half glows orange, Lightning thumbs! 231 ms. The blue half, upside down for the player opposite, is dimmed: Just a blink late. A plus one flies into the orange score dot. One phone. Two thumbs. 27 mini-games. Plays offline.' },
    { od: 1.9, text: 'The phone grows. Lay the phone flat between you.' },
    { od: 3.3, text: 'Next round, Odd One Out. Orange is on match point. Three starting lights, then go. Both halves get the same round: nine arrows, one points a different way.' },
    { od: 7.26, text: 'Orange taps a wrong arrow. A wrong tap gives the point away: the blue half lights up, the right arrow is ringed and the wrong one crossed out. Look first, tap second. Cool as ice. One all.' },
    { od: 9.06, text: 'Decider! Bigger Circle. Orange taps the bigger circle first. Nailed it! 580 ms. Almost! 27 quick games for two players.' },
    { od: 15.26, text: 'Orange wins the match two to one. Winner. So close. Rematch. Duel. One phone. Two thumbs. 27 mini-games. Plays offline. Coming soon to Google Play. arling.sk' },
  ],
  async pripravit() {
    await nacitajPisma(import.meta.url);
    if (typeof document !== 'undefined' && document.fonts && document.fonts.load) {
      await Promise.all([400, 600, 700, 800].map((v) => document.fonts.load(nun(v, 40)))).catch(() => {});
    }
  },
  vrstvy(W, H, dpr) { stavVrstiev(W, H, dpr); },
  kresli(x, t, W, H, env) {
    x.drawImage(L.pozadie, 0, 0, W, H);
    const tel = telefon(t), ppd = tel.w / BW;
    // telo (sprite v mierke príbehu, zmenšené podľa polohy)
    const o = L.okrajT * ppd;
    x.drawImage(L.telo.c, tel.x - o, tel.y - o, tel.w + 2 * o, tel.h + 2 * o);
    x.save();
    x.translate(tel.x + RAM * ppd, tel.y + RAM * ppd);
    x.scale(ppd, ppd);
    kresliObrazovku(x, t);
    kresliPalce(x, t);
    x.restore();
    kresliTexty(x, t);
    kresliZrno(x, t, env);
  },
  stredPlagatu() {
    const tel = telefon(film.plagat), ppd = tel.w / BW;
    return [tel.x + tel.w / 2, tel.y + (RAM + PAS_Y0 * 0.5) * ppd];
  },
  // Duel ešte nie je v Google Play: nápis nevedie do obchodu, ale na odsek o appke na tejto stránke.
  odkazy() {
    const { R, texty } = L, s = texty.cta;
    const w = Math.min(s.textW + 8, R.tw), x0 = R.zar === 'center' ? R.tx + (R.tw - w) / 2 : R.tx;
    const doObchodu = ZAVER === 'google-play';
    return [{ x: x0, y: texty.poz.cta, w, h: s.h, href: doObchodu ? PLAY_URL : '#about', text: doObchodu ? 'Get it on Google Play' : 'About Duel', od: T.tlacidlo, udalost: doObchodu ? 'duel_film_play' : 'duel_film_about' }];
  },
  zvuk: [],
  // pre test.mjs: čo sa na obraze číta a fakty, ktoré musia sedieť s kódom appky
  kontrola: {
    telefon: (t) => telefon(t),
    /** Texty hlášok a metrík (test.mjs: palec ich nesmie zakryť). */
    hlasky: new Set(KOLA.flatMap((K) => [bezEmoji(K.hlaska.O), bezEmoji(K.hlaska.B), K.metrika.O, K.metrika.B].filter(Boolean))),
    /** Rozhodujúce ciele (prstenec správnej odpovede, krížik zlého ťuku) v súradniciach videa v čase t,
     *  keď sú nakreslené; test.mjs overí, že ich palec nechá celé vidno aspoň 0,6 s. */
    ciele(t) {
      const out = [];
      KOLA.forEach((K, k) => {
        if (K.id === 'light' || t < K.rozhodnute + 0.15 || t >= K.koniec) return;
        const tel = telefon(t), ppd = tel.w / BW;
        const naVideo = ([sx, sy], r, meno) => ({ x: tel.x + (RAM + sx) * ppd, y: tel.y + (RAM + sy) * ppd, r: r * ppd, meno: `kolo ${k + 1} ${meno}` });
        for (const kto of ['O', 'B']) {
          const pol = (b) => (kto === 'O' ? b : otoc(b));
          if (K.id === 'oddone') {
            const b = bunkaOdd(ODD.ina);
            out.push(naVideo(pol([b.x, b.y]), Math.min(b.w, b.h) / 2, `${kto} prstenec`));
            if (kto === 'O') { const z = bunkaOdd(ODD.zlaO); out.push(naVideo([z.x, z.y], Math.min(z.w, z.h) / 3, 'O krížik')); }
          } else {
            const c = kruh(BIG.zelenyVacsi);
            out.push(naVideo(pol([c.x, c.y]), c.r, `${kto} prstenec`));
          }
        }
      });
      return out;
    },
    /** Čísla rozloženia pre výpis testu (node test.mjs --rozlozenie). */
    rozlozenie() {
      const { R, texty, vnutri } = L, r = (v) => Math.round(v);
      const px = (s) => r(s.px);
      return {
        druh: R.F.druh, stlpec: R.stlpec, pxNaDp: +R.ppdS.toFixed(3), kE: +R.kE.toFixed(3),
        telefonPribeh: [r(R.telS.x), r(R.telS.y), r(R.telS.w), r(R.telS.h)], telefonKoniec: [r(R.telE.x), r(R.telE.y), r(R.telE.w), r(R.telE.h)],
        textStlpec: [r(R.tx), r(R.tw)], titulkyY: r(R.capYk), titulkyPx: r(R.capPx),
        koniec: { nazov: [r(texty.poz.nazov), px(texty.nazov)], veta: [r(texty.poz.veta), px(texty.veta), texty.veta.riadky], veta2: [r(texty.poz.veta2), px(texty.veta2), texty.veta2.riadky], cta: [r(texty.poz.cta), px(texty.cta), texty.cta.riadky], url: [r(texty.poz.url), px(texty.url)] },
        vTelefone: { hlaska: px(vnutri.karty[0].O.hlaska), hlaskaRiadky: vnutri.karty.map((k) => [k.O.hlaska.riadky, k.B.hlaska.riadky]), nazovHry: px(vnutri.nazvy[1]), go: px(vnutri.go), plus: px(vnutri.plus.O), winner: px(vnutri.winner), skore: px(vnutri.skoreO), rematch: px(vnutri.rematch), tap: px(vnutri.tap.O) },
      };
    },
    titulky: TITULKY.map((c) => ({ od: c.od, do: c.do, text: c.text.map((a) => a[0]).join('') })),
    texty: [...Object.values(TEXT_ZAVERU), 'One phone. Two thumbs.', '27 mini-games. Plays offline.', ...KOLA.flatMap((K) => [K.nazov, bezEmoji(K.hlaska.O), bezEmoji(K.hlaska.B)])],
    fakty() {
      const e = [];
      const plain = (ms) => (ms < 1000 ? `${Math.round(ms)} ms` : `${(Math.round(ms / 100) / 10).toFixed(1)} s`);
      // metriky = plainTime(tap - začiatok) ako v Light.kt a Bigger.kt
      if (plain((KOLA[0].tapO - KOLA[0].blesk) * 1000) !== KOLA[0].metrika.O) e.push('White Flash: metrika nesedí s časom ťuku');
      if (plain((KOLA[2].tapO - KOLA[2].zive) * 1000) !== KOLA[2].metrika.O) e.push('Bigger Circle: metrika nesedí s časom ťuku');
      // pomalší ťuk príde po okne 20 ms, takže sa nepočíta (Round.decide)
      for (const K of KOLA) if (K.tapB != null && K.tapB <= K.rozhodnute) e.push(`${K.id}: ťuk Blue je v okne remízy`);
      // hák: snímka 0 už ukazuje rozhodnuté kolo 1 (rozsvietenie a hláška), +1 letí počas háku
      if (!(KOLA[0].rozhodnute < 0 && T.kartyR1 <= 0 && KOLA[0].rozhodnute + 1.0 < HAK.drz)) e.push('hák: snímka 0 neukazuje rozhodnuté kolo s hláškou');
      // hlášky sú zo sád Result.kt podľa nálady (Quips.mood)
      const sady = { O: KOLA.map((K) => (K.vitaz === 'O' ? QUIPS.win : K.chybaO ? QUIPS.mistake : QUIPS.slower)), B: KOLA.map((K) => (K.vitaz === 'B' ? QUIPS.win : QUIPS.slower)) };
      KOLA.forEach((K, i) => { for (const kto of ['O', 'B']) if (!sady[kto][i].includes(K.hlaska[kto])) e.push(`${K.id}: hláška ${K.hlaska[kto]} nie je v správnej sade`); });
      // Odd One Out: jediná iná šípka, ostatné rovnaké, rozdiel >= Look.MIN_TURN 45
      const ine = ODD.uhly.filter((u) => u !== ODD.uhly[(ODD.ina + 1) % 9]);
      if (ine.length !== 1 || Math.abs(ODD.gap - 78.75) > 1e-9 || ODD.gap < 45) e.push('Odd One Out: mriežka nezodpovedá kolu 2');
      if (ODD.zlaO === ODD.ina) e.push('Odd One Out: zlý ťuk je na správnej šípke');
      // Bigger Circle: plocha menšieho = (1 - areaGap) plochy väčšieho, areaGap kola 3 = .36
      if (Math.abs(BIG.areaGap - 0.36) > 1e-9 || Math.abs((BIG.maly / BIG.velky) ** 2 - (1 - BIG.areaGap)) > 1e-9) e.push('Bigger Circle: rozmery nesedia');
      if (BIG.velky < 0.32 || BIG.velky > 0.38) e.push('Bigger Circle: bigSize mimo .32 až .38');
      // odpočet 1500 ms na 4 doby, White Flash kolo 1 čaká 1,5 až 5 s (vo filme sa čakanie nezobrazuje)
      if (Math.abs(TAKT - 0.375) > 1e-9) e.push('odpočet nesedí s Hold.COUNTDOWN_MS');
      // skóre: zápas do dvoch výhier, Orange 2 : Blue 1
      const s = skore(DLZKA);
      if (s.O !== 2 || s.B !== 1) e.push(`skóre na konci ${s.O} : ${s.B}, čakám 2 : 1`);
      if (Math.abs(VYSLEDOK - KOLA[2].rozhodnute - 2.6) > 1e-9) e.push('posledné kolo nedrží 2600 ms');
      return e;
    },
  },
};

// ---------- zvuk ----------
// Nástroj appky: sínus a oktáva 12 %, nábeh 8 ms, doznievanie e^(-5x), presne ako prepare-sounds.py, ktorým
// vznikli letter_tone.wav (C5, 0,32 s), word_chord.wav (C5 E5 G5, 0,65 s) a level_chime.wav (1,2 s). Duel ich
// prehráva cez SoundPool s rýchlosťou podľa pentatoniky (DuelSounds.kt), takže výška aj dĺžka sa menia spolu.
const ZVUKY_APPKY = {
  ton: { dlzka: 0.32, noty: [[523.25, 0, 0.28]] },
  akord: { dlzka: 0.65, noty: [[523.25, 0, 0.16], [659.25, 0.025, 0.14], [783.99, 0.05, 0.14]] },
  zvonkohra: { dlzka: 1.2, noty: [[523.25, 0, 0.18], [659.25, 0.12, 0.18], [783.99, 0.24, 0.18], [1046.5, 0.4, 0.16], [659.25, 0.4, 0.1], [783.99, 0.4, 0.1]] },
};
pridajNastroj('appka', (g, e, k) => {
  const ctx = g.ctx, r = e.rychlost ?? 1, z = ZVUKY_APPKY[e.zvuk] || ZVUKY_APPKY.ton, hl = (e.hlas ?? 0.5) * 2.4;
  const dl = z.dlzka / r;
  for (const [f, od, zisk] of z.noty) {
    const k0 = k + od / r, koniec = k + dl;
    if (koniec - k0 < 0.03) continue;
    for (const [nas, podiel] of [[1, 1], [2, 0.12]]) {
      const o = ctx.createOscillator(), a = ctx.createGain();
      o.frequency.value = f * r * nas;
      const amp = hl * zisk * podiel, nab = 0.008 / r, dozvuk = Math.max(nab + 0.01, koniec - k0 - 0.05);
      a.gain.setValueAtTime(0, k0);
      a.gain.linearRampToValueAtTime(amp, k0 + nab);
      a.gain.exponentialRampToValueAtTime(Math.max(1e-4, amp * Math.exp(-5 * r * (dozvuk - nab))), k0 + dozvuk);
      a.gain.linearRampToValueAtTime(0, koniec);
      o.connect(a);
      a.connect(g.suchy);
      const s = ctx.createGain(); s.gain.value = e.dozvuk ?? 0.15;
      a.connect(s).connect(g.dozvuk);
      o.start(k0); o.stop(koniec + 0.02);
    }
  }
});

const PENTA = [-12, -10, -8, -5, -3, 0, 2, 4, 7, 9, 12]; // DuelSounds.kt Pentatonic.scale
const rychlost = (poltony) => Math.pow(2, poltony / 12);
function partitura() {
  const u = [];
  const appka = (t, zvuk, poltony, hlas) => u.push({ t, typ: 'appka', zvuk, rychlost: rychlost(poltony), hlas });
  // hák: úvodný akord filmu so zvonmi (engine), pod ním tik ťuku a výhra kola z appky
  u.push(...HAK.zvuk({ akord: ['C3', 'G3', 'E4', 'G4'], zvony: ['C5', 'G5', 'C6'], hlas: 0.7 }));
  const kolo = (K, i) => {
    if (K.intro > 0) appka(K.intro, 'ton', PENTA[Math.min(5, i + 1) + 2], 0.55);        // sounds.intro(round)
    if (K.odpocet > 0) {
      for (let b = 0; b < 3; b++) appka(K.odpocet + b * TAKT, 'ton', PENTA[5], 0.40);   // sounds.tick() x3
      appka(K.odpocet + 3 * TAKT, 'ton', PENTA[7], 0.55);                                // sounds.intro(5) pri Go
    }
    // kolo 1 sa rozhodlo pred snímkou 0: jeho výhra zaznie na snímke 0 spolu s hákom (bez tiku ťuku)
    const tR = Math.max(0, K.rozhodnute);
    if (K.tapO >= 0) appka(K.tapO, 'ton', PENTA[5], 0.40);                               // tik ťuku (LIVE)
    if (K.chybaO) { appka(tR, 'ton', -5, 0.42); appka(tR + 0.3, 'akord', 0, 0.55); appka(tR + 0.3, 'akord', 7, 0.55); }
    else { appka(tR, 'akord', 0, 0.55); appka(tR, 'akord', 7, 0.55); }                  // sounds.won()
    // film: jemný vysoký zvon, keď +1 doletí do bodky
    u.push({ t: K.rozhodnute + 1.0, typ: 'zvon', f: K.vitaz === 'O' ? 'E6' : 'D6', index: 0.5, dlzka: 0.9, hlas: 0.05, pan: K.vitaz === 'O' ? -0.3 : 0.3, dozvuk: 0.4 });
  };
  KOLA.forEach(kolo);
  appka(VYSLEDOK, 'zvonkohra', 0, 0.55);                                                 // sounds.matchOver()
  // plochy filmu pod príbehom: C, Am pri chybe, F pred rozhodujúcim kolom, C na konci
  u.push({ t: 1.6, typ: 'pad', noty: ['C3', 'G3', 'E4', 'G4'], dlzka: 5.4, nabeh: 1.2, dobeh: 1.2, hlas: 0.09, filter: 800, filter2: 1100 });
  u.push({ t: 6.8, typ: 'pad', noty: ['A2', 'E3', 'C4', 'E4'], dlzka: 2.8, nabeh: 0.6, dobeh: 0.9, hlas: 0.09, filter: 800 });
  u.push({ t: 9.2, typ: 'pad', noty: ['F2', 'C3', 'A3', 'E4'], dlzka: 3.6, nabeh: 0.6, dobeh: 1.0, hlas: 0.09, filter: 900 });
  u.push({ t: 12.5, typ: 'pad', noty: ['G2', 'D3', 'B3', 'D4'], dlzka: 2.9, nabeh: 0.4, dobeh: 0.9, hlas: 0.08, filter: 900 });
  u.push({ t: T.presunOd, typ: 'sum', filter: 'bandpass', f0: 900, f1: 3000, q: 0.6, dlzka: 0.6, nabeh: 0.3, tvar: 'narast', hlas: 0.04, dozvuk: 0.3 });
  u.push({ t: T.nazov, typ: 'pad', noty: ['C2', 'G2', 'E3', 'G3', 'D4', 'E4'], dlzka: 3.0, nabeh: 0.3, dobeh: 2.0, hlas: 0.15, filter: 1500, filter2: 800 });
  u.push({ t: T.nazov, typ: 'zvon', f: 'C4', index: 0.5, dlzka: 3.0, hlas: 0.12, dozvuk: 0.55 });
  u.push({ t: T.nazov + 0.02, typ: 'zvon', f: 'G4', index: 0.4, dlzka: 2.6, hlas: 0.05, dozvuk: 0.55 });
  u.push({ t: T.veta, typ: 'zvon', f: 'E5', index: 0.4, dlzka: 1.4, hlas: 0.045, dozvuk: 0.5 });
  u.push({ t: T.tlacidlo + 0.08, typ: 'tuk', f: 320, dlzka: 0.07, hlas: 0.05 });
  u.push({ t: T.tlacidlo + 0.08, typ: 'zvon', f: 'E6', index: 0.5, dlzka: 0.8, hlas: 0.04, dozvuk: 0.5 });
  return u.filter((x) => x.t < DLZKA);
}
film.zvuk = partitura();

export default film;
