// Quiet Grids: 11 Logic Games, film na 18 sekúnd nakreslený a ozvučený kódom (kodfilm engine).
// Vzhľad podľa skutočnej appky (products/hlavolamy-android): papier #F5F2E9, biela karta dosky s rohom
// 20 dp a obrysom Ink .08, Ink #203E45, Nunito, farby typov z core/Layout.kt, kreslenie dosiek z
// BoardScreen.kt, ťah pod prstom z drawPending, vlna hotovej jednotky z drawWave, zvuky marimby zo
// syntézy ops/games/hlavolamy/zvuky.mjs.
//
// Tri skutočné zadania z banky appky (hlavolamy.js), každé s jedným skutočným ťahom:
//   Herons 2. 9. 2026 (medium 6 x 6): posledná cesta páru 2, jediné možné doplnenie (overí test)
//   Cranes 26. 8. 2026 (medium 9 x 9): prvý krok reťazca Hintu appky, all-double na rohovej 4
//   Magpies 24. 8. 2026 (easy 8 x 8): riadok a stĺpec s nápovedou 8 sa vyplnia celé
// Potom jedenásť typov appky a záver s hotovou mriežkou (rovnaké zloženie ako hák).

import { okno, obmedz, lerp, ease, obalka } from './engine/cas.js';
import { platno, zrno } from './engine/kresba.js';
import { hak, format, zona, minPismo } from './engine/hak.js';
import { pridajNastroj } from './engine/zvuk.js';
import { FARBA, ZVIERATA, meno, rgba, nun, nacitajPisma, sprite, spriteTextu, spriteFarebny, znak, spritePrsta, zaoblene } from './kresby.js';
import { ZAZNAMY, PRAVIDLA, rozbal, retaz, cesty, mosty, obrazok } from './hlavolamy.js';

// ---------- záver: prepínač pre deň spustenia (ops/video/kodfilm/DOSTUPNE-V-OBCHODE.md) ----------
export const ZAVERY = ['coming-soon', 'google-play', 'obchod'];
const ZAVER_PREDVOLENY = 'coming-soon'; // v deň, keď verejná stránka obchodu vráti 200: 'google-play'
let ZAVER = (() => {
  try {
    const q = new URLSearchParams(globalThis.location?.search || '').get('zaver');
    return ZAVERY.includes(q) ? q : ZAVER_PREDVOLENY;
  } catch { return ZAVER_PREDVOLENY; }
})();
export function nastavZaver(z) { if (ZAVERY.includes(z)) ZAVER = z; }
const PLAY_URL = 'https://play.google.com/store/apps/details?id=sk.arling.quietgrids';
const TEXT_ZAVERU = {
  'coming-soon': 'Coming soon to Google Play',
  'google-play': 'Get it on Google Play',
  // store-listing-en.md: „nothing needs the internet to play“, „There is no account“
  obchod: 'Plays offline. No account.',
};

const DLZKA = 18.3;

// ---------- zadania ----------
const PH = rozbal(ZAZNAMY.herons.text), PC = rozbal(ZAZNAMY.cranes.text), PM = rozbal(ZAZNAMY.magpies.text);
const HER = cesty(PH), CRA = mosty(PC), MAG = obrazok(PM);
const RET_C = retaz(PC.retaz, CRA.sloty, PRAVIDLA.cranes.length);

// Herons: cesta páru 2 od konca, ktorý už je nakreslený (bunka 32), okolo pravého okraja k hniezdu (bunka 2).
// Bunky 33 až 3 sú krok 10 reťazca Hintu appky (cell-needs-all); ostatné cesty sú hotové, preto je to
// posledný ťah a jediné možné doplnenie (test.mjs to overí prehľadaním všetkých možností).
const H_TAH = [32, 33, 34, 35, 29, 23, 17, 11, 5, 4, 3, 2];
const H_PRAZDNE = H_TAH.slice(1, -1); // bunky, ktoré ťah vyplní (hniezdo 2 je vytlačené)
// Cranes: prvý krok reťazca = all-double na ostrove 4 (roh 0,8, potrebuje 4, má dvoch susedov)
const C_KROK = RET_C[0];
const C_TAH = [3, 4, 8]; // ostrovy: 3 (0,6) -> 4 (0,8) -> 8 (2,8)
// Magpies: dolný riadok (nápoveda 8) zľava doprava, potom pravý stĺpec (nápoveda 8) zdola nahor
const M_RIADOK = Array.from({ length: 8 }, (_, i) => 56 + i);
const M_STLPEC = [55, 47, 39, 31, 23, 15, 7];

const HAK = hak({ drz: 1.3, odchod: 0.6 });
const T = {
  // Herons
  hSpat: [1.45, 1.95], hPrst: [2.0, 2.4], hTah: [2.45, 3.65], hPust: 3.7, hPrec: [3.75, 4.3], hVlna: 3.85,
  // Cranes
  cIn: 4.95, cPrst: [5.5, 5.95], cTah1: [6.0, 6.7], cPust1: 6.75, cSpat: [6.8, 7.2], cTah2: [7.25, 7.85], cPust2: 7.9, cPrec: [7.95, 8.5],
  // Magpies
  mIn: 8.65, mPrst: [9.1, 9.5], mTah1: [9.55, 10.35], mPust1: 10.4, mPresun: [10.45, 10.8], mTah2: [10.85, 11.45], mPust2: 11.5, mPrec: [11.55, 12.0],
  // jedenásť typov
  zIn: 11.85, zOut: 14.35,
  // záver
  // texty záveru až keď doska dosadne (15,0): nikdy sa nestretnú s jej hranou
  presun: [14.45, 15.0], nazov: 15.05, veta: 15.4, veta2: 15.7, tlacidlo: 16.0, tiraz: 16.35,
};

const TITULKY = [
  // Teach.kt, karta RULE daného typu; posledný zo store-listing-en.md (short description)
  { od: 1.95, do: 4.95, text: [['Join each '], ['pair', FARBA.green], [' and fill every square.']] },
  { od: 5.0, do: 8.65, text: [['Each island takes the '], ['number of bridges', FARBA.green], [' it shows.']] },
  { od: 8.7, do: 11.9, text: [['The clues count the '], ['filled blocks', FARBA.green], [' in order.']] },
  { od: 11.95, do: 14.4, text: [['Eleven', FARBA.green], [' logic puzzles a day.']] },
];

// ---------- vrstvy ----------
let L = null;

function rozlozenie(W, H) {
  const F = format(W, H), Z = zona(W, H), mp = minPismo(W, H);
  const siroky = F.druh === 'siroky';
  const R = { F, Z, mp, siroky };
  if (!siroky) {
    // na výšku a štvorec: navrchu titulok a hlavička, pod nimi doska; prst prichádza sprava zdola,
    // pod dosku, kde nie je text
    const s = Math.min(Z.w * 1.2, Z.h * 0.8);
    R.s = s; R.zar = 'center';
    R.capPx = Math.max(s * 0.05, mp * 1.2);
    R.capH = R.capPx * 1.25 * 2 + R.capPx * 0.35;
    R.znak = s * 0.078; R.menoPx = Math.max(s * 0.052, mp * 1.1); R.klasPx = Math.max(s * 0.036, mp * 1.02);
    R.hlavH = Math.max(R.znak, R.menoPx * 1.2 + R.klasPx * 1.3);
    R.g1 = s * 0.03; R.g2 = s * 0.028;
    const B = Math.min(Z.w, Z.h - R.capH - R.g1 - R.hlavH - R.g2);
    const spolu = R.capH + R.g1 + R.hlavH + R.g2 + B;
    R.capY = Z.y0 + (Z.h - spolu) / 2;
    R.hy = R.capY + R.capH + R.g1;
    R.B = B; R.bx = (W - B) / 2; R.by = R.hy + R.hlavH + R.g2;
    R.tx = Z.x0; R.tw = Z.w; R.hx = R.bx;
    R.px = { nazov: s * 0.14, veta: s * 0.058, veta2: Math.max(s * 0.04, mp * 1.1), cta: Math.max(mp * 1.15, s * 0.046), url: Math.max(s * 0.066, mp * 1.25) };
  } else {
    const s = Math.min(W * 0.55, H);
    R.s = s; R.zar = 'left';
    const B = Math.min(H * 0.84, W * 0.46);
    R.B = B; R.bx = Math.max(Z.x0, W * 0.07); R.by = (H - B) / 2;
    R.tx = R.bx + B + W * 0.055; R.tw = Z.x1 - R.tx; R.hx = R.tx;
    R.capPx = Math.max(s * 0.054, mp * 1.2);
    R.capH = R.capPx * 1.25 * 3 + R.capPx * 0.35;
    R.znak = s * 0.085; R.menoPx = Math.max(s * 0.06, mp * 1.1); R.klasPx = Math.max(s * 0.04, mp * 1.02);
    R.hlavH = Math.max(R.znak, R.menoPx * 1.2 + R.klasPx * 1.3);
    R.g1 = s * 0.05;
    const spolu = R.hlavH + R.g1 + R.capH;
    R.hy = (H - spolu) / 2; R.capY = R.hy + R.hlavH + R.g1;
    R.px = { nazov: Math.min(s * 0.13, R.tw * 0.16), veta: s * 0.056, veta2: Math.max(s * 0.04, mp * 1.1), cta: Math.max(mp * 1.15, s * 0.044), url: Math.max(s * 0.066, mp * 1.3) };
  }
  return R;
}

/** Názov (Ink ako nadpis appky) plus zelenšia verzia na odlesk háku. */
function spriteNazvu(dpr, text, px, w, zarovnanie) {
  const m = platno(4, 4).getContext('2d');
  m.font = nun(800, px);
  const sirka = m.measureText(text).width;
  const vel = sirka > w * 0.94 ? (px * w * 0.94) / sirka : px;
  const h = vel * 1.22, x0 = zarovnanie === 'center' ? w / 2 : 0;
  const kresli = (farba) => (x) => { x.font = nun(800, vel); x.textBaseline = 'top'; x.textAlign = zarovnanie; x.fillStyle = farba; x.fillText(text, x0, vel * 0.04); };
  const s = sprite(dpr, w, h, kresli(FARBA.ink));
  s.svetly = sprite(dpr, w, h, kresli('#5b8f97')).c;
  s.px = vel; s.textW = (sirka * vel) / px;
  return s;
}

/** Geometria dosky pri strane karty B: vankúš 4 dp, dp prepočítané z dosky 340 dp. */
function geometria(B) {
  const dp = B / 340, vank = 4 * dp, G = B - 2 * vank;
  return { B, dp, vank, G };
}

function stavVrstiev(W, H, dpr) {
  const R = rozlozenie(W, H);
  const { mp } = R, g = R.s * 0.03;
  const podlaha = mp * 1.1; // texty, ktoré pulzujú (mierka .92), majú rezervu

  // --- koncový blok (a hák v rovnakom zložení) ---
  const ew = R.tw, zar = R.zar;
  const nazov = spriteNazvu(dpr, 'Quiet Grids', R.px.nazov, ew, zar);
  const veta = spriteTextu(dpr, 'Draw, reason, solve.', R.px.veta, ew, { vaha: 800, zarovnanie: zar, maxRiadkov: 2, minPx: mp });
  const veta2 = spriteTextu(dpr, 'No countdowns, no rush.', R.px.veta2, ew, { vaha: 700, farba: FARBA.green, zarovnanie: zar, maxRiadkov: 2, minPx: mp });
  const cta = spriteTextu(dpr, TEXT_ZAVERU[ZAVER], R.px.cta, ew, { vaha: 800, farba: rgba(FARBA.ink, 0.8), zarovnanie: zar, maxRiadkov: 2, minPx: mp * 1.1 });
  const url = spriteTextu(dpr, 'arling.sk', R.px.url, ew, { vaha: 800, farba: FARBA.green, zarovnanie: zar, maxRiadkov: 1, minPx: mp });
  const blokH = nazov.h + g * 0.35 + veta.h + g * 0.15 + veta2.h + g * 0.9 + cta.h + g * 0.35 + url.h;
  const poz = {};
  if (!R.siroky) {
    const gB = R.s * 0.045;
    R.B2 = Math.min(R.B, R.Z.h - blokH - gB);
    const spolu = blokH + gB + R.B2;
    R.ey = R.Z.y0 + (R.Z.h - spolu) / 2;
    R.bx2 = (W - R.B2) / 2; R.by2 = R.ey + blokH + gB;
  } else {
    R.B2 = R.B; R.bx2 = R.bx; R.by2 = R.by;
    R.ey = Math.max(R.Z.y0, (H - blokH) / 2);
  }
  R.kE = R.B2 / R.B;
  let y = R.ey;
  poz.nazov = y; y += nazov.h + g * 0.35;
  poz.veta = y; y += veta.h + g * 0.15;
  poz.veta2 = y; y += veta2.h + g * 0.9;
  poz.cta = y; y += cta.h + g * 0.35;
  poz.url = y;

  // --- titulky a hlavičky dosiek ---
  const titulky = TITULKY.map((tt) => ({ ...tt, sp: spriteFarebny(dpr, tt.text, R.capPx, ew, { zarovnanie: zar }) }));
  const hlavicka = (id, klas) => ({
    id, farba: FARBA.typy[ZVIERATA.findIndex((z) => z[0] === id)],
    meno: spriteTextu(dpr, meno(id), R.menoPx, R.tw * 0.8, { vaha: 800, zarovnanie: 'left', maxRiadkov: 1, minPx: mp }),
    klas: spriteTextu(dpr, klas, R.klasPx, R.tw * 0.8, { vaha: 600, farba: rgba(FARBA.ink, FARBA.text), zarovnanie: 'left', maxRiadkov: 1, minPx: mp }),
  });
  const hlavicky = { herons: hlavicka('herons', 'Numberlink'), cranes: hlavicka('cranes', 'Hashi'), magpies: hlavicka('magpies', 'Nonogram') };

  // --- dosky: geometria a čísla ako sprity (podiel bunky s podlahou pre minimum písma) ---
  const gS = geometria(R.B);
  const cisla = new Map();
  const cislo = (txt, px, farba, vaha = 600) => {
    const k = `${txt}|${Math.round(px * 10)}|${farba}|${vaha}`;
    if (!cisla.has(k)) cisla.set(k, spriteTextu(dpr, txt, px, px * (txt.length * 0.8 + 0.6), { vaha, farba, maxRiadkov: 1, minPx: 0 }));
    return cisla.get(k);
  };
  // Herons (aj v háku a na konci): číslo hniezda 0,46 bunky (Glyph.DIGIT_SP podlaha), pri menšej doske stále aspoň minimum
  const stepH = gS.G / HER.n;
  const pxH = Math.max(stepH * 0.46, podlaha / R.kE);
  const herons = { step: stepH, cisla: Array.from({ length: HER.pary + 1 }, (_, k) => (k ? cislo(String(k), pxH, FARBA.ink) : null)) };
  // Cranes: číslo ostrova 0,42 bunky; hotový ostrov Muted
  const stepC = gS.G / CRA.n;
  const pxC = Math.max(stepC * 0.42, podlaha);
  const cranes = { step: stepC, px: pxC, ink: {}, muted: {} };
  for (const o of CRA.ostrovy) { cranes.ink[o.need] = cislo(String(o.need), pxC, FARBA.ink); cranes.muted[o.need] = cislo(String(o.need), pxC, rgba(FARBA.ink, FARBA.text)); }
  // Magpies: nápovedy v páse (Clues.size); pás je širší ako v appke, aby čísla mali aspoň minimum
  const pxM = podlaha;
  const behRiadku = (cl) => pxM * (cl.reduce((a, x) => a + String(x).length, 0) * 0.62 + cl.length * 0.25);
  const stohStlpca = (cl) => pxM * (0.25 + 0.78 + (cl.length - 1) * 1.0);
  const pas = Math.max(...MAG.riadkove.map(behRiadku), ...MAG.stlpcove.map(stohStlpca), Math.min(MAG.riadkove.length * 12 * gS.dp, gS.G / 7)) + pxM * 0.3;
  const stepM = (gS.G - pas) / MAG.n;
  const magpies = { pas, step: stepM, px: pxM, riadky: MAG.riadkove.map((cl) => cislo(cl.join(' '), pxM, rgba(FARBA.ink, 0.9))), stlpce: MAG.stlpcove.map((cl) => cl.map((v) => cislo(String(v), pxM, rgba(FARBA.ink, 0.9)))) };

  // --- jedenásť typov (Today: znak, meno, klasický názov) ---
  const zoznam = ZVIERATA.map(([id, klas], i) => ({
    id, farba: FARBA.typy[i],
    meno: spriteTextu(dpr, meno(id), R.menoPx * 0.92, R.tw * 0.45, { vaha: 800, zarovnanie: 'left', maxRiadkov: 1, minPx: mp }),
    klas: spriteTextu(dpr, klas, R.klasPx, R.tw * 0.62, { vaha: 600, farba: rgba(FARBA.ink, FARBA.text), zarovnanie: 'left', maxRiadkov: 1, minPx: mp }),
  }));

  // --- pozadie: papier appky a jemné svetlo zhora ---
  const Wd = Math.round(W * dpr), Hd = Math.round(H * dpr);
  const poz0 = platno(Wd, Hd), px = poz0.getContext('2d');
  px.scale(dpr, dpr);
  px.fillStyle = FARBA.paper; px.fillRect(0, 0, W, H);
  const sv = px.createRadialGradient(W * 0.5, H * 0.3, 0, W * 0.5, H * 0.3, Math.max(W, H) * 0.8);
  sv.addColorStop(0, 'rgba(255,253,246,0.7)'); sv.addColorStop(1, 'rgba(230,224,208,0.35)');
  px.fillStyle = sv; px.fillRect(0, 0, W, H);

  // --- karta dosky (biela, roh 20 dp, obrys Ink .08, jemný tieň len pre film) ---
  const okraj = gS.B * 0.08;
  const karta = sprite(dpr, gS.B + okraj * 2, gS.B + okraj * 2, (x) => {
    x.save();
    x.shadowColor = 'rgba(32,62,69,0.10)'; x.shadowBlur = gS.B * 0.05; x.shadowOffsetY = gS.B * 0.015;
    zaoblene(x, okraj, okraj, gS.B, gS.B, 20 * gS.dp); x.fillStyle = FARBA.card; x.fill();
    x.restore();
    zaoblene(x, okraj + 0.5, okraj + 0.5, gS.B - 1, gS.B - 1, 20 * gS.dp); x.lineWidth = gS.dp; x.strokeStyle = rgba(FARBA.ink, 0.08); x.stroke();
  });
  karta.okraj = okraj;

  const prst = spritePrsta(gS.B * 0.085, dpr);
  const zrna = zrno(3, Math.round(160 * dpr), 1, 11).map((z) => ({ z }));
  L = { W, H, dpr, R, gS, poz0, karta, prst, zrna, herons, cranes, magpies, hlavicky, zoznam, texty: { nazov, veta, veta2, cta, url, poz, titulky } };
  L.prstK = choreografia(R);
}

// ---------- stavy dosiek v čase t (čisté funkcie) ----------

/** Herons: čísla buniek v čase t (0 = prázdna) a ťah pod prstom. */
function stavHerons(t) {
  const v = HER.riesenie.slice();
  const vyprazdni = (bunky) => { for (const i of bunky) v[i] = 0; };
  if (t >= HAK.koniec && t < T.hPust) vyprazdni(H_PRAZDNE);
  else if (t >= T.hSpat[0] && t < HAK.koniec) {
    // spätný chod: cesta sa zmotá od hniezda späť k bunke 32
    const q = ease.inOutSine(okno(t, T.hSpat[0], T.hSpat[1]));
    const n = Math.round(q * H_PRAZDNE.length);
    vyprazdni(H_PRAZDNE.slice(H_PRAZDNE.length - n));
  }
  return v;
}
/** Poloha na lomenej čiare bodov pri postupe q (0..1) a index posledného dosiahnutého bodu. */
function poCiare(body, q) {
  const n = body.length - 1, f = obmedz(q) * n, i = Math.min(n - 1, Math.floor(f)), u = f - i;
  return { x: lerp(body[i][0], body[i + 1][0], u), y: lerp(body[i][1], body[i + 1][1], u), hlava: u > 0.5 ? i + 1 : i };
}

// ---------- kreslenie dosiek (súradnice plátna, doska v obdĺžniku bx, by, B) ----------

function mriezka(x, n, step, x0, y0, dp, tazke = 0) {
  for (let k = 0; k <= n; k++) {
    const hrube = tazke > 0 && k % tazke === 0;
    x.strokeStyle = rgba(FARBA.ink, hrube ? 0.5 : 0.18); x.lineWidth = (hrube ? 2.2 : 1) * dp;
    x.beginPath(); x.moveTo(x0 + k * step, y0); x.lineTo(x0 + k * step, y0 + n * step); x.stroke();
    x.beginPath(); x.moveTo(x0, y0 + k * step); x.lineTo(x0 + n * step, y0 + k * step); x.stroke();
  }
}
function drawImageStred(x, s, cx, cy, k = 1) {
  x.drawImage(s.c, cx - (s.w * k) / 2, cy - (s.h * k) / 2, s.w * k, s.h * k);
}

/** Paths: drawPaths z BoardScreen.kt (pás .30 bunky vo farbe páru, hniezdo biele s obrysom 2,4 dp). */
function kresliHerons(x, t, D) {
  const { x0, y0, step, dp, k } = D, n = HER.n;
  const v = stavHerons(t);
  mriezka(x, n, step, x0, y0, dp);
  const sirka = step * 0.30;
  x.lineCap = 'round';
  for (let i = 0; i < n * n; i++) {
    const o = v[i];
    if (!o) continue;
    const cx = x0 + (i % n + 0.5) * step, cy = y0 + (Math.floor(i / n) + 0.5) * step;
    x.fillStyle = FARBA.typy[o - 1]; x.strokeStyle = FARBA.typy[o - 1]; x.lineWidth = sirka;
    x.beginPath(); x.arc(cx, cy, sirka / 2, 0, Math.PI * 2); x.fill();
    for (const j of [i + 1, i + n]) {
      if (j >= n * n || (j === i + 1 && Math.floor(j / n) !== Math.floor(i / n)) || v[j] !== o) continue;
      x.beginPath(); x.moveTo(cx, cy); x.lineTo(x0 + (j % n + 0.5) * step, y0 + (Math.floor(j / n) + 0.5) * step); x.stroke();
    }
  }
  // ťah pod prstom (drawPending, rodina NODES): GreenDeep .70, šírka .18 bunky, krúžky na začiatku a hlave
  const ciara = H_TAH.map((i) => [x0 + (i % n + 0.5) * step, y0 + (Math.floor(i / n) + 0.5) * step]);
  const q = okno(t, T.hTah[0], T.hTah[1]);
  const usadenie = okno(t, T.hPust, T.hPust + 0.12);
  if (t >= T.hTah[0] && t < T.hPust + 0.12) {
    const p = poCiare(ciara, ease.inOutSine(q));
    const alfa = t < T.hPust ? 0.7 : 0.7 + 0.3 * usadenie;
    kresliTah(x, ciara.slice(0, p.hlava + 1), step * 0.18, alfa, step, dp);
    if (t < T.hPust) { x.fillStyle = rgba(FARBA.green, 0.28); x.beginPath(); x.arc(p.x, p.y, step * 0.42, 0, Math.PI * 2); x.fill(); }
  }
  // hniezda
  for (let i = 0; i < n * n; i++) {
    const e = HER.konce[i];
    if (!e) continue;
    const cx = x0 + (i % n + 0.5) * step, cy = y0 + (Math.floor(i / n) + 0.5) * step;
    x.beginPath(); x.arc(cx, cy, step * 0.34, 0, Math.PI * 2); x.fillStyle = FARBA.card; x.fill();
    x.lineWidth = 2.4 * dp; x.strokeStyle = FARBA.typy[e - 1]; x.stroke();
    drawImageStred(x, L.herons.cisla[e], cx, cy, k);
  }
}

function kresliTah(x, body, sirka, alfa, step, dp) {
  if (!body.length) return;
  x.save();
  x.globalAlpha = alfa;
  x.strokeStyle = FARBA.greenDeep; x.lineWidth = sirka; x.lineCap = 'round'; x.lineJoin = 'round';
  if (body.length > 1) { x.beginPath(); x.moveTo(body[0][0], body[0][1]); for (const b of body.slice(1)) x.lineTo(b[0], b[1]); x.stroke(); }
  const h = body[body.length - 1];
  x.strokeStyle = FARBA.green; x.lineWidth = 2.4 * dp;
  x.beginPath(); x.arc(h[0], h[1], step * 0.20, 0, Math.PI * 2); x.stroke();
  if (body.length > 1) { x.globalAlpha = alfa * 0.7; x.beginPath(); x.arc(body[0][0], body[0][1], step * 0.14, 0, Math.PI * 2); x.stroke(); }
  x.restore();
}

/** Bridges: drawBridges (most GreenDeep 3,5 dp, dvojitý posunutý o .11 bunky; ostrov biely, obrys 2,4 dp). */
function kresliCranes(x, t, D) {
  const { x0, y0, step, dp } = D;
  const v = new Array(CRA.sloty).fill(0);
  const e34 = CRA.indexPary(3, 4), e48 = CRA.indexPary(4, 8);
  const pocet = t >= T.cPust2 ? 2 : t >= T.cPust1 ? 1 : 0;
  v[e34] = pocet; v[e48] = pocet;
  const stred = (o) => [x0 + (CRA.ostrovy[o].c + 0.5) * step, y0 + (CRA.ostrovy[o].r + 0.5) * step];
  const w = 2.2 * dp * 1.6;
  x.strokeStyle = FARBA.greenDeep; x.lineWidth = w; x.lineCap = 'butt';
  CRA.pary.forEach((s, e) => {
    if (!v[e]) return;
    const [ax, ay] = stred(s.a), [bx, by] = stred(s.b);
    if (v[e] === 1) { x.beginPath(); x.moveTo(ax, ay); x.lineTo(bx, by); x.stroke(); return; }
    const dx = s.vodorovne ? 0 : step * 0.11, dy = s.vodorovne ? step * 0.11 : 0;
    x.beginPath(); x.moveTo(ax - dx, ay - dy); x.lineTo(bx - dx, by - dy); x.moveTo(ax + dx, ay + dy); x.lineTo(bx + dx, by + dy); x.stroke();
  });
  // ťah pod prstom
  const tah = (od, dokedy, pust) => {
    if (t < od || t >= pust + 0.12) return;
    const body = C_TAH.map(stred);
    const p = poCiare(body, ease.inOutSine(okno(t, od, dokedy)));
    const alfa = t < pust ? 0.7 : 0.7 + 0.3 * okno(t, pust, pust + 0.12);
    kresliTah(x, body.slice(0, p.hlava + 1), 3.4 * dp, alfa, step, dp);
    if (t < pust) { x.fillStyle = rgba(FARBA.green, 0.28); x.beginPath(); x.arc(p.x, p.y, step * 0.42, 0, Math.PI * 2); x.fill(); }
  };
  tah(T.cTah1[0], T.cTah1[1], T.cPust1);
  tah(T.cTah2[0], T.cTah2[1], T.cPust2);
  CRA.ostrovy.forEach((o, i) => {
    const [cx, cy] = stred(i);
    let ma = 0;
    for (const e of CRA.paryOstrova[i]) ma += CRA.pocetMostov(v[e]);
    const hotovy = ma === o.need;
    x.beginPath(); x.arc(cx, cy, step * 0.38, 0, Math.PI * 2); x.fillStyle = FARBA.card; x.fill();
    x.lineWidth = 2.4 * dp; x.strokeStyle = hotovy ? FARBA.greenDeep : FARBA.ink; x.stroke();
    drawImageStred(x, hotovy ? L.cranes.muted[o.need] : L.cranes.ink[o.need], cx, cy);
  });
}

/** Picture Grid: drawPictureGrid (nápovedy v páse, plné políčko pero Round v akcente, čiary hrubé po 5). */
function kresliMagpies(x, t, D) {
  const { x0, y0, dp } = D, M = L.magpies, n = MAG.n, pas = M.pas, step = M.step;
  const gx = x0 + pas, gy = y0 + pas;
  // nápovedy riadkov (vpravo zarovnané k mriežke) a stĺpcov (odspodu nahor)
  const vzduch = M.px * 0.25;
  MAG.riadkove.forEach((_, r) => {
    const s = M.riadky[r];
    x.drawImage(s.c, gx - vzduch - s.textW - (s.w - s.textW) / 2, gy + (r + 0.5) * step - s.h / 2, s.w, s.h);
  });
  MAG.stlpcove.forEach((cl, c) => {
    let y = gy - vzduch;
    for (let k = cl.length - 1; k >= 0; k--) {
      const s = M.stlpce[c][k];
      x.drawImage(s.c, gx + (c + 0.5) * step - s.w / 2, y - M.px * 1.0, s.w, s.h);
      y -= M.px * 1.0;
    }
  });
  // políčka: hotové ťahy, ťah pod prstom (alfa .55, posledné políčko nafúknuté), vlna hotovej jednotky
  const plne = new Set();
  if (t >= T.mPust1) M_RIADOK.forEach((i) => plne.add(i));
  if (t >= T.mPust2) M_STLPEC.forEach((i) => plne.add(i));
  const bunka = (i) => [gx + (i % n) * step, gy + Math.floor(i / n) * step];
  const pero = (i, farba, k = 1) => { const [bx, by] = bunka(i); x.fillStyle = farba; x.beginPath(); x.arc(bx + step / 2, by + step / 2, step * 0.42 * k, 0, Math.PI * 2); x.fill(); };
  for (const i of plne) pero(i, FARBA.accent);
  const tah = (bunky, od, dokedy, pust) => {
    if (t < od || t >= pust) return;
    const q = ease.inOutSine(okno(t, od, dokedy)), hlava = Math.min(bunky.length - 1, Math.floor(q * (bunky.length - 1) + 0.5));
    bunky.slice(0, hlava + 1).forEach((i, k) => {
      if (plne.has(i)) return;
      const nafuk = k === hlava ? 1 + 0.10 * Math.sin(Math.PI * obmedz(((q * (bunky.length - 1)) % 1) + 0.5)) : 1;
      pero(i, rgba(FARBA.accent, 0.55), nafuk);
    });
    const [px, py] = bunka(bunky[hlava]);
    x.fillStyle = rgba(FARBA.green, 0.28); x.beginPath(); x.arc(px + step / 2, py + step / 2, step * 0.42, 0, Math.PI * 2); x.fill();
  };
  tah(M_RIADOK, T.mTah1[0], T.mTah1[1], T.mPust1);
  // stĺpec sa začína na prázdnom políčku 55: ťah začatý na plnom políčku by v appke krížikoval (Moves.strokeValue)
  tah(M_STLPEC, T.mTah2[0], T.mTah2[1], T.mPust2);
  const vlna = (bunky, od) => {
    const p = okno(t, od, od + 0.32); // Motion.wave(8) = 320 ms
    if (p <= 0 || p >= 1) return;
    bunky.forEach((i, k) => {
      const podiel = k / bunky.length, lok = obmedz((p - podiel * 0.6) / 0.4), svit = obmedz(1 - Math.abs(lok * 2 - 1));
      if (svit <= 0) return;
      const [bx, by] = bunka(i);
      x.fillStyle = rgba(FARBA.accent, 0.45 * svit); x.fillRect(bx, by, step, step);
    });
  };
  vlna(M_RIADOK, T.mPust1);
  vlna([...M_STLPEC].reverse().concat([63]), T.mPust2);
  // čiary: tenké .18, hrubé .5 pri každom piatom
  for (let k = 0; k <= n; k++) {
    const hrube = k % 5 === 0;
    x.strokeStyle = rgba(FARBA.ink, hrube ? 0.5 : 0.18); x.lineWidth = (hrube ? 2.2 : 1) * dp;
    x.beginPath(); x.moveTo(gx + k * step, gy); x.lineTo(gx + k * step, gy + n * step); x.stroke();
    x.beginPath(); x.moveTo(gx, gy + k * step); x.lineTo(gx + n * step, gy + k * step); x.stroke();
  }
}

/** Karta dosky a obsah jedného typu v obdĺžniku (bx, by, B), priehľadnosť a. */
function kresliDosku(x, t, typ, bx, by, B, a) {
  if (a <= 0) return;
  const gS = L.gS, k = B / gS.B, dp = gS.dp * k, vank = gS.vank * k, G = B - 2 * vank;
  x.save();
  x.globalAlpha = a;
  const o = L.karta.okraj * k;
  x.drawImage(L.karta.c, bx - o, by - o, B + 2 * o, B + 2 * o);
  const D = { x0: bx + vank, y0: by + vank, dp, k, step: G / (typ === 'herons' ? HER.n : CRA.n) };
  if (typ === 'herons') kresliHerons(x, t, D);
  else if (typ === 'cranes') kresliCranes(x, t, D);
  else {
    // Picture Grid má vlastný krok (pás nápovied), sprity nápovied sú vo veľkosti príbehu
    kresliMagpies(x, t, { x0: bx + vank, y0: by + vank, dp });
  }
  x.restore();
}

function kresliHlavicku(x, h, a, posun) {
  if (a <= 0) return;
  const { R } = L;
  x.save();
  x.globalAlpha = a;
  const y = R.hy + posun;
  const zs = R.znak;
  znak(x, h.id, h.farba, R.hx + zs / 2, y + R.hlavH / 2, zs);
  const tx = R.hx + zs + zs * 0.28;
  const hTxt = h.meno.h * 0.92 + h.klas.h * 0.92;
  const ty = y + (R.hlavH - hTxt) / 2;
  x.drawImage(h.meno.c, tx, ty, h.meno.w, h.meno.h);
  x.drawImage(h.klas.c, tx, ty + h.meno.h * 0.92, h.klas.w, h.klas.h);
  x.restore();
}

/** Jedenásť typov: znak, meno a klasický názov (Today, „The eleven grids“), riadky naskočia po jednom. */
function kresliZoznam(x, t) {
  const { R } = L;
  // zoznam úplne zmizne skôr (14,35), než sa na jeho miesto vráti doska (od 14,5)
  const a = Math.min(ease.outCubic(okno(t, T.zIn, T.zIn + 0.3)), 1 - ease.inOutQuad(okno(t, T.zOut - 0.3, T.zOut)));
  if (a <= 0) return;
  const top = R.siroky ? R.by : R.hy, vyska = R.siroky ? R.B : R.hlavH + R.g2 + R.B;
  const riad = vyska / ZVIERATA.length, zs = Math.min(riad * 0.78, R.znak * 1.05);
  const x0 = R.siroky ? R.bx : R.bx;
  const sirkaMena = Math.max(...L.zoznam.map((z) => z.meno.textW));
  L.zoznam.forEach((z, i) => {
    const q = ease.outCubic(okno(t, T.zIn + 0.1 + i * 0.07, T.zIn + 0.45 + i * 0.07));
    if (q <= 0) return;
    const y = top + i * riad, cy = y + riad / 2;
    x.save();
    x.globalAlpha = a * q;
    x.translate((1 - q) * riad * 0.4, 0);
    znak(x, z.id, z.farba, x0 + zs / 2, cy, zs);
    const tx = x0 + zs * 1.3;
    x.drawImage(z.meno.c, tx, cy - z.meno.h / 2, z.meno.w, z.meno.h);
    x.drawImage(z.klas.c, tx + sirkaMena + zs * 0.45, cy - z.klas.h / 2 + z.meno.px * 0.06, z.klas.w, z.klas.h);
    if (i < ZVIERATA.length - 1) { x.fillStyle = rgba(FARBA.ink, 0.10); x.fillRect(tx, y + riad - 1, R.B - (tx - x0), 1); }
    x.restore();
  });
}

// ---------- prst ----------
function choreografia(R) {
  const { B, bx, by } = R, gS = geometria(B), x0 = bx + gS.vank, y0 = by + gS.vank;
  // na výšku sprava zdola a plocho (pod dosku, kde nie je text), na šírku zľava zdola (text je vpravo)
  const u = R.siroky ? 0.32 : -1.3;
  const dom = R.siroky ? [bx + B * 0.25, by + B * 1.4] : [bx + B * 1.5, by + B * 0.95];
  const hS = gS.G / HER.n, hB = (i) => [x0 + (i % HER.n + 0.5) * hS, y0 + (Math.floor(i / HER.n) + 0.5) * hS];
  const cS = gS.G / CRA.n, cB = (o) => [x0 + (CRA.ostrovy[o].c + 0.5) * cS, y0 + (CRA.ostrovy[o].r + 0.5) * cS];
  const M = L_magpiesGeom(R, gS), mB = (i) => [M.gx + (i % MAG.n + 0.5) * M.step, M.gy + (Math.floor(i / MAG.n) + 0.5) * M.step];
  const nad = (b, d) => [b[0] - Math.sin(u) * d, b[1] + Math.cos(u) * d];
  const k = (t, b, p = 0) => ({ t, x: b[0], y: b[1], p });
  const ciara = (od, dokedy, body) => ({ od, dokedy, body });
  return {
    u,
    kluce: [
      k(0, dom), k(T.hPrst[0], dom), k(T.hPrst[1], nad(hB(32), B * 0.03)), k(T.hTah[0], hB(32), 1),
      k(T.hTah[1], hB(2), 1), k(T.hPust, hB(2), 1), k(T.hPrec[0], nad(hB(2), B * 0.04)), k(T.hPrec[1], dom),
      k(T.cPrst[0], dom), k(T.cPrst[1], nad(cB(3), B * 0.03)), k(T.cTah1[0], cB(3), 1), k(T.cTah1[1], cB(8), 1), k(T.cPust1, cB(8), 1),
      k(T.cSpat[0], nad(cB(8), B * 0.04)), k(T.cSpat[1], nad(cB(3), B * 0.03)), k(T.cTah2[0], cB(3), 1), k(T.cTah2[1], cB(8), 1), k(T.cPust2, cB(8), 1),
      k(T.cPrec[0], nad(cB(8), B * 0.04)), k(T.cPrec[1], dom),
      k(T.mPrst[0], dom), k(T.mPrst[1], nad(mB(56), B * 0.03)), k(T.mTah1[0], mB(56), 1), k(T.mTah1[1], mB(63), 1), k(T.mPust1, mB(63), 1),
      k(T.mPresun[0], nad(mB(63), B * 0.03)), k(T.mPresun[1], nad(mB(55), B * 0.02)), k(T.mTah2[0], mB(55), 1), k(T.mTah2[1], mB(7), 1), k(T.mPust2, mB(7), 1),
      k(T.mPrec[0], nad(mB(7), B * 0.04)), k(T.mPrec[1], dom), k(DLZKA, dom),
    ],
    // počas ťahu ide prst presne po lomenej čiare cez stredy (čiara nemešká za prstom, Motion.LINE = 0)
    ciary: [ciara(T.hTah[0], T.hTah[1], H_TAH.map(hB)), ciara(T.cTah1[0], T.cTah1[1], C_TAH.map(cB)), ciara(T.cTah2[0], T.cTah2[1], C_TAH.map(cB)),
      ciara(T.mTah1[0], T.mTah1[1], M_RIADOK.map(mB)), ciara(T.mTah2[0], T.mTah2[1], M_STLPEC.map(mB))],
  };
}
function L_magpiesGeom(R, gS) {
  // tá istá geometria ako v stavVrstiev (pás nápovied), počítaná bez spritov
  const pxM = R.mp * 1.1;
  const behRiadku = (cl) => pxM * (cl.reduce((a, x) => a + String(x).length, 0) * 0.62 + cl.length * 0.25);
  const stohStlpca = (cl) => pxM * (0.25 + 0.78 + (cl.length - 1) * 1.0);
  const pas = Math.max(...MAG.riadkove.map(behRiadku), ...MAG.stlpcove.map(stohStlpca), Math.min(MAG.riadkove.length * 12 * gS.dp, gS.G / 7)) + pxM * 0.3;
  const step = (gS.G - pas) / MAG.n;
  return { pas, step, gx: R.bx + gS.vank + pas, gy: R.by + gS.vank + pas };
}

function pozaPrsta(t) {
  const P = L.prstK;
  for (const c of P.ciary) if (t >= c.od && t <= c.dokedy) { const p = poCiare(c.body, ease.inOutSine(okno(t, c.od, c.dokedy))); return { x: p.x, y: p.y, p: 1 }; }
  const K = P.kluce;
  if (t <= K[0].t) return K[0];
  for (let i = 1; i < K.length; i++) if (t <= K[i].t) { const a = K[i - 1], b = K[i], q = ease.inOutCubic(okno(t, a.t, b.t)); return { x: lerp(a.x, b.x, q), y: lerp(a.y, b.y, q), p: lerp(a.p, b.p, q) }; }
  return K[K.length - 1];
}
function kresliPrst(x, t) {
  if (t < T.hPrst[0] - 0.05 || t > T.mPrec[1] + 0.05) return;
  const p = pozaPrsta(t), s = L.prst, m = 1.04 - 0.04 * p.p;
  x.save();
  x.translate(p.x, p.y); x.rotate(L.prstK.u); x.scale(m, m);
  x.drawImage(s.c, -s.hrot[0], -s.hrot[1], s.w, s.h);
  x.restore();
}

// ---------- ktorá doska kde a kedy ----------
/** 1 = poloha háku a konca (menšia doska, blok názvu), 0 = príbeh. */
function polohaKonca(t) {
  if (t < HAK.koniec) return 1 - HAK.navrat(t);
  return ease.inOutCubic(okno(t, T.presun[0], T.presun[1]));
}
function doskaV(t) {
  const { R } = L, p = polohaKonca(t);
  const B = lerp(R.B, R.B2, p);
  return { B, bx: lerp(R.bx, R.bx2, p), by: lerp(R.by, R.by2, p) };
}
/** Priehľadnosť dosiek: Herons v háku a príbehu, Cranes, Magpies, potom Herons na konci. */
function alfyDosiek(t) {
  const prechod = (od, trv = 0.3) => ease.inOutQuad(okno(t, od, od + trv));
  return {
    herons: t < T.zIn ? 1 - prechod(T.cIn) : prechod(T.presun[0] + 0.05, 0.45),
    cranes: Math.min(prechod(T.cIn), 1 - prechod(T.mIn)),
    magpies: Math.min(prechod(T.mIn), 1 - prechod(T.zIn, 0.25)),
  };
}

// ---------- texty mimo dosky ----------
function kresliTexty(x, t) {
  const { R, texty } = L, { poz } = texty, ex = R.tx;
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
    x.drawImage(tt.sp.c, ex, R.capY + (1 - vstup) * R.s * 0.015, tt.sp.w, tt.sp.h);
    x.globalAlpha = 1;
  }
  // záver: text sa rozžiari a mierne zdvihne na svoje miesto, bez masky (maska pri doske pôsobila,
  // akoby text zakrývala horná hrana dosky); posun je malý, nikdy nesiahne k doske
  const vyjdi = (s, od, y, trv = 0.6) => {
    const p = ease.outCubic(okno(t, od, od + trv));
    if (p <= 0) return;
    x.save();
    x.globalAlpha = obmedz(p * 1.4);
    x.drawImage(s.c, ex, y + (1 - p) * Math.min(12, R.s * 0.012), s.w, s.h);
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
  x.globalAlpha = 0.03;
  x.fillStyle = z.vzor;
  x.fillRect(0, 0, L.W * L.dpr, L.H * L.dpr);
  x.restore();
}

/** Filmový lesk po hotovej mriežke (šikmý svetlý pás), v háku a po poslednej ceste Herons. */
function kresliLesk(x, t, D) {
  const lesk = (od, trv) => {
    const q = okno(t, od, od + trv);
    if (q <= 0 || q >= 1) return;
    const { B, bx, by } = D, pos = lerp(-0.4, 1.4, ease.inOutSine(q)) * B, sirka = B * 0.18;
    x.save();
    x.beginPath(); x.rect(bx, by, B, B); x.clip();
    x.globalAlpha = 0.28 * Math.sin(Math.PI * q);
    x.fillStyle = '#ffffff';
    x.beginPath();
    x.moveTo(bx + pos - sirka, by); x.lineTo(bx + pos + sirka, by); x.lineTo(bx + pos + sirka - B * 0.5, by + B); x.lineTo(bx + pos - sirka - B * 0.5, by + B);
    x.closePath(); x.fill();
    x.restore();
  };
  lesk(-0.3, 1.35); // v háku je lesk viditeľný už na snímke 0
  lesk(T.hVlna, 0.9);
  lesk(T.presun[1], 1.0);
}

const film = {
  dlzka: DLZKA,
  plagat: 1.0,
  titulky: [
    { od: 0, text: 'Quiet Grids. A finished Paths grid on a white card: five coloured paths join their numbered pairs and fill every square. Draw, reason, solve. No countdowns, no rush.' },
    { od: 1.45, text: 'The long yellow path unwinds back to its start. Herons, also called Numberlink. Join each pair and fill every square.' },
    { od: 2.45, text: 'A finger draws the last path around the right edge and along the top to its twin. The grid is solved.' },
    { od: 4.95, text: 'Cranes, also called Hashi. Each island takes the number of bridges it shows. The 4 in the corner has only two neighbours, so both get double bridges: the finger draws them twice.' },
    { od: 8.65, text: 'Magpies, also called Nonogram. The clues count the filled blocks in order. The bottom row and the right column both say 8, so the finger fills them from end to end.' },
    { od: 11.85, text: 'Eleven logic puzzles a day: Badgers, Hares, Squirrels, Cranes, Swans, Magpies, Herons, Voles, Otters, Hedgehogs and Dormice, each with its classic name.' },
    { od: 14.45, text: 'Quiet Grids. Draw, reason, solve. No countdowns, no rush. Coming soon to Google Play. arling.sk' },
  ],
  async pripravit() {
    await nacitajPisma(import.meta.url);
    if (typeof document !== 'undefined' && document.fonts && document.fonts.load) {
      await Promise.all([400, 600, 700, 800].map((v) => document.fonts.load(nun(v, 40)))).catch(() => {});
    }
  },
  vrstvy(W, H, dpr) { stavVrstiev(W, H, dpr); },
  kresli(x, t, W, H, env) {
    x.drawImage(L.poz0, 0, 0, W, H);
    const a = alfyDosiek(t);
    const D = doskaV(t);
    // hlavičky dosiek (len v príbehu)
    const hA = (od, dokedy) => Math.min(ease.outCubic(okno(t, od, od + 0.35)), 1 - ease.inOutQuad(okno(t, dokedy - 0.3, dokedy)));
    kresliHlavicku(x, L.hlavicky.herons, hA(1.55, T.cIn + 0.3), 0);
    kresliHlavicku(x, L.hlavicky.cranes, hA(T.cIn, T.mIn + 0.3), 0);
    kresliHlavicku(x, L.hlavicky.magpies, hA(T.mIn, T.zIn + 0.25), 0);
    kresliDosku(x, t, 'herons', D.bx, D.by, D.B, a.herons);
    if (a.cranes > 0) kresliDosku(x, t, 'cranes', L.R.bx, L.R.by, L.R.B, a.cranes);
    if (a.magpies > 0) kresliDosku(x, t, 'magpies', L.R.bx, L.R.by, L.R.B, a.magpies);
    if (a.herons > 0) kresliLesk(x, t, D);
    kresliZoznam(x, t);
    kresliPrst(x, t);
    kresliTexty(x, t);
    kresliZrno(x, t, env);
  },
  stredPlagatu() { const D = doskaV(film.plagat); return [D.bx + D.B / 2, D.by + D.B / 2]; },
  odkazy() {
    const { R, texty } = L, s = texty.cta;
    const w = Math.min(s.textW + 8, R.tw), x0 = R.zar === 'center' ? R.tx + (R.tw - w) / 2 : R.tx;
    const doObchodu = ZAVER === 'google-play';
    return [{ x: x0, y: texty.poz.cta, w, h: s.h, href: doObchodu ? PLAY_URL : '#about', text: doObchodu ? 'Get it on Google Play' : 'About Quiet Grids', od: T.tlacidlo, udalost: doObchodu ? 'quiet_grids_film_play' : 'quiet_grids_film_about' }];
  },
  zvuk: [],
  kontrola: {
    telefon: (t) => { const D = doskaV(t); return { x: D.bx, y: D.by, w: D.B, h: D.B, a: alfyDosiek(t).herons }; },
    rozlozenie() {
      const { R, texty, magpies, cranes, herons } = L, r = (v) => Math.round(v);
      return {
        druh: R.F.druh, doska: [r(R.bx), r(R.by), r(R.B)], doskaKoniec: [r(R.bx2), r(R.by2), r(R.B2)], kE: +R.kE.toFixed(3),
        titulkyY: r(R.capY), titulkyPx: r(R.capPx), hlavickaY: r(R.hy),
        koniec: { nazov: [r(texty.poz.nazov), r(texty.nazov.px)], veta: [r(texty.poz.veta), r(texty.veta.px)], cta: [r(texty.poz.cta), r(texty.cta.px), texty.cta.riadky], url: [r(texty.poz.url), r(texty.url.px)] },
        bunky: { herons: r(herons.step), cranes: r(cranes.step), magpies: r(magpies.step), pasMagpies: r(magpies.pas) },
        pismoDosky: { herons: r(herons.cisla[1].px), cranes: r(cranes.px), magpies: r(magpies.px) },
      };
    },
    titulky: TITULKY.map((c) => ({ od: c.od, do: c.do, text: c.text.map((a) => a[0]).join('') })),
    texty: [...Object.values(TEXT_ZAVERU), 'Draw, reason, solve.', 'No countdowns, no rush.', ...ZVIERATA.flat()],
    fakty() {
      const e = [];
      // zadania z banky sú platné podľa pravidiel appky
      if (!HER.jeVyriesene(HER.riesenie)) e.push('Herons: riešenie z banky neprejde pravidlami');
      if (!CRA.jeVyriesene(CRA.odpoved)) e.push('Cranes: riešenie z banky neprejde pravidlami');
      if (!MAG.jeVyriesene(MAG.riesenie)) e.push('Magpies: riešenie z banky neprejde pravidlami');
      // Herons: ťah ide po susedných bunkách, začína na bunke páru 2 a končí v jeho hniezde
      for (let i = 1; i < H_TAH.length; i++) { const a = H_TAH[i - 1], b = H_TAH[i]; if (Math.abs(a - b) !== 1 && Math.abs(a - b) !== HER.n) e.push(`Herons: ťah skáče ${a} -> ${b}`); }
      if (HER.riesenie[H_TAH[0]] !== 2 || HER.konce[H_TAH[H_TAH.length - 1]] !== 2) e.push('Herons: ťah nezačína na páre 2 alebo nekončí v jeho hniezde');
      if (H_PRAZDNE.some((i) => HER.riesenie[i] !== 2 || HER.konce[i])) e.push('Herons: vyprázdnené bunky nie sú voľné bunky páru 2');
      // ... a je to krok 10 reťazca Hintu appky (cell-needs-all)
      const retH = retaz(PH.retaz, HER.sloty, PRAVIDLA.herons.length);
      const k10 = retH[9];
      if (PRAVIDLA.herons[k10.pravidlo] !== 'cell-needs-all' || k10.ciele.map((c) => c[0]).sort((a, b) => a - b).join() !== [...H_PRAZDNE].sort((a, b) => a - b).join() || k10.ciele.some((c) => c[1] !== 2)) e.push('Herons: vyprázdnené bunky nie sú krok 10 reťazca');
      // jediné doplnenie: prehľadanie všetkých priradení párov prázdnym bunkám (s orezaním: bunka nesmie
      // mať viac susedov svojho páru, než pravidlo dovolí; hniezdo 1, ostatné 2), na konci Paths.isSolved
      const v = HER.riesenie.slice(); for (const i of H_PRAZDNE) v[i] = 0;
      const n = HER.n, sus = (i) => [i - n, i + n, i % n ? i - 1 : -1, (i + 1) % n ? i + 1 : -1].filter((j) => j >= 0 && j < n * n);
      const ok = (i) => { if (!v[i]) return true; const m = HER.konce[i] ? 1 : 2; return sus(i).filter((j) => v[j] === v[i]).length <= m; };
      let rieseni = 0;
      const skus = (k) => {
        if (k === H_PRAZDNE.length) { if (HER.jeVyriesene(v)) rieseni++; return; }
        const c = H_PRAZDNE[k];
        for (let p = 1; p <= HER.pary; p++) {
          v[c] = p;
          if (ok(c) && sus(c).every(ok)) skus(k + 1);
        }
        v[c] = 0;
      };
      skus(0);
      if (rieseni !== 1) e.push(`Herons: doplnenie nie je jediné (${rieseni})`);
      // Cranes: prvý krok reťazca je all-double na páry 3-4 a 4-8 s hodnotou 2 a zhoduje sa s riešením
      const par = C_KROK.ciele.map(([s, h]) => `${CRA.pary[s].a}-${CRA.pary[s].b}=${h}`).join(',');
      if (PRAVIDLA.cranes[C_KROK.pravidlo] !== 'all-double' || par !== '3-4=2,4-8=2') e.push(`Cranes: prvý krok reťazca je ${PRAVIDLA.cranes[C_KROK.pravidlo]} ${par}`);
      if (C_KROK.ciele.some(([s, h]) => CRA.odpoved[s] !== h)) e.push('Cranes: krok nesedí s riešením');
      const o4 = CRA.ostrovy[4];
      if (o4.r !== 0 || o4.c !== 8 || o4.need !== 4 || CRA.paryOstrova[4].length !== 2) e.push('Cranes: ostrov 4 nie je rohová 4 s dvoma susedmi');
      // Magpies: nápoveda dolného riadku a pravého stĺpca je 8, teda celé plné
      if (MAG.riadkove[7].join() !== '8' || MAG.stlpcove[7].join() !== '8') e.push('Magpies: dolný riadok alebo pravý stĺpec nemá nápovedu 8');
      if ([...M_RIADOK, ...M_STLPEC].some((i) => MAG.riesenie[i] !== 1)) e.push('Magpies: vyplnené políčka nie sú v riešení');
      return e;
    },
  },
};

// ---------- zvuk ----------
// Marimba appky (zvuky.mjs): čiastkové tóny 1, 3,94 a 9,2 násobku so zosilnením 1, .32, .11 a dozvukom
// .55 / 1, 2,4, 4,5 s; nábeh 8 až 12 ms, doznievanie e^(-t / .45), dojazd 20 ms. cell_tone A4 120 ms,
// unit_chord A4 + E5 + A5 420 ms, board_chime A4, C#5 po 150 ms, E5 po 320 ms, 900 ms.
// Appka ich hrá cez SoundPool s rýchlosťou podľa pentatoniky (core/Feel.kt Tones).
const ZVUKY_APPKY = {
  bunka: { dlzka: 0.12, noty: [[440, 0, 1.0]] },
  akord: { dlzka: 0.42, noty: [[440, 0, 1.0], [660, 0, 0.7], [880, 0, 0.5]] },
  zvonkohra: { dlzka: 0.9, noty: [[440, 0, 0.9], [550, 0.15, 0.85], [660, 0.32, 0.9]] },
};
const PARTIALY = [[1.0, 1.0, 1.0], [3.94, 0.32, 2.4], [9.2, 0.11, 4.5]];
pridajNastroj('appka', (g, e, k) => {
  const ctx = g.ctx, r = e.rychlost ?? 1, z = ZVUKY_APPKY[e.zvuk] || ZVUKY_APPKY.bunka, hl = (e.hlas ?? 0.5) * 0.9;
  for (const [f, od, zisk] of z.noty) {
    const k0 = k + od / r, koniec = k + z.dlzka / r;
    if (koniec - k0 < 0.03) continue;
    for (const [nas, podiel, rych] of PARTIALY) {
      const o = ctx.createOscillator(), a = ctx.createGain();
      o.frequency.value = f * r * nas;
      const amp = hl * zisk * podiel, tau = (0.55 / rych) / r, tauObalky = 0.45 / r;
      const trvanie = Math.max(0.03, koniec - k0 - 0.02), nab = 0.009 / r;
      const ciel = amp * Math.exp(-(trvanie - nab) / tau) * Math.exp(-(trvanie - nab) / tauObalky);
      a.gain.setValueAtTime(0, k0);
      a.gain.linearRampToValueAtTime(amp, k0 + nab);
      a.gain.exponentialRampToValueAtTime(Math.max(1e-4, ciel), k0 + trvanie);
      a.gain.linearRampToValueAtTime(0, koniec);
      o.connect(a);
      a.connect(g.suchy);
      const s = ctx.createGain(); s.gain.value = e.dozvuk ?? 0.2;
      a.connect(s).connect(g.dozvuk);
      o.start(k0); o.stop(koniec + 0.02);
    }
  }
});

const STUPNICA = [-12, -10, -8, -5, -3, 0, 2, 4, 7, 9, 12]; // Tones.scale
const krok = (i) => Math.pow(2, STUPNICA[Math.min(STUPNICA.length - 1, i)] / 12);
function partitura() {
  const u = [];
  const appka = (t, zvuk, rychlost, hlas = 0.5) => u.push({ t, typ: 'appka', zvuk, rychlost, hlas });
  // ťah: DOWN na prvom mieste, STEP o stupeň vyššie za každé ďalšie (Feel.voice, GridSounds.step)
  const tah = (od, dokedy, pocet) => { for (let i = 0; i < pocet; i++) appka(od + ((dokedy - od) * i) / Math.max(1, pocet - 1), 'bunka', krok(i), i ? 0.42 : 0.45); };
  // hák: úvodný akord filmu so zvonmi (A, pentatonika appky) a zvonkohra vyriešenej dosky
  u.push(...HAK.zvuk({ akord: ['A2', 'E3', 'C4', 'E4'], zvony: ['A4', 'E5', 'A5'], hlas: 0.7 }));
  appka(0.04, 'zvonkohra', 1, 0.5);
  // spätný chod cesty
  u.push({ t: T.hSpat[0], typ: 'glis', f0: 'E5', f1: 'A4', dlzka: 0.45, hlas: 0.03, dozvuk: 0.4 });
  // Herons: 12 buniek ťahu, potom SOLVED
  tah(T.hTah[0], T.hTah[1], H_TAH.length);
  appka(T.hPust + 0.02, 'zvonkohra', 1, 0.55);
  // Cranes: dva ťahy cez tri ostrovy (bez akordu, Bridges nemá jednotku)
  tah(T.cTah1[0], T.cTah1[1], 3);
  tah(T.cTah2[0], T.cTah2[1], 3);
  // Magpies: riadok 8 políčok a akord jednotky, stĺpec a akord
  tah(T.mTah1[0], T.mTah1[1], 8);
  appka(T.mPust1, 'akord', 1, 0.5);
  tah(T.mTah2[0], T.mTah2[1], M_STLPEC.length);
  appka(T.mPust2, 'akord', 1, 0.5);
  // jedenásť typov: tichý tón za každý riadok (film)
  for (let i = 0; i < 11; i++) u.push({ t: T.zIn + 0.12 + i * 0.07, typ: 'zvon', f: ['A4', 'C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6', 'G6', 'A6'][i], index: 0.35, dlzka: 0.6, hlas: 0.03, pan: -0.4 + i * 0.08, dozvuk: 0.4 });
  // plochy filmu pod príbehom (tiché): Am, F, C, G, Am na konci
  u.push({ t: 1.6, typ: 'pad', noty: ['A2', 'E3', 'C4', 'E4'], dlzka: 3.6, nabeh: 1.0, dobeh: 1.0, hlas: 0.08, filter: 800, filter2: 1100 });
  u.push({ t: 4.9, typ: 'pad', noty: ['F2', 'C3', 'A3', 'E4'], dlzka: 3.9, nabeh: 0.8, dobeh: 1.0, hlas: 0.08, filter: 850 });
  u.push({ t: 8.6, typ: 'pad', noty: ['C3', 'G3', 'E4', 'G4'], dlzka: 3.5, nabeh: 0.8, dobeh: 1.0, hlas: 0.08, filter: 900 });
  u.push({ t: 11.8, typ: 'pad', noty: ['G2', 'D3', 'B3', 'E4'], dlzka: 2.9, nabeh: 0.6, dobeh: 0.9, hlas: 0.07, filter: 900 });
  u.push({ t: T.presun[0], typ: 'sum', filter: 'bandpass', f0: 900, f1: 3000, q: 0.6, dlzka: 0.6, nabeh: 0.3, tvar: 'narast', hlas: 0.04, dozvuk: 0.3 });
  u.push({ t: T.nazov, typ: 'pad', noty: ['A1', 'E2', 'C3', 'E3', 'B3', 'E4'], dlzka: 3.2, nabeh: 0.3, dobeh: 2.0, hlas: 0.15, filter: 1500, filter2: 800 });
  u.push({ t: T.nazov, typ: 'zvon', f: 'A3', index: 0.5, dlzka: 3.0, hlas: 0.12, dozvuk: 0.55 });
  u.push({ t: T.nazov + 0.02, typ: 'zvon', f: 'E4', index: 0.4, dlzka: 2.6, hlas: 0.05, dozvuk: 0.55 });
  u.push({ t: T.veta, typ: 'zvon', f: 'C5', index: 0.4, dlzka: 1.4, hlas: 0.045, dozvuk: 0.5 });
  appka(T.presun[1], 'zvonkohra', 1, 0.35);
  u.push({ t: T.tlacidlo + 0.08, typ: 'tuk', f: 320, dlzka: 0.07, hlas: 0.05 });
  u.push({ t: T.tlacidlo + 0.08, typ: 'zvon', f: 'E6', index: 0.5, dlzka: 0.8, hlas: 0.04, dozvuk: 0.5 });
  return u.filter((x) => x.t < DLZKA).sort((a, b) => a.t - b.t);
}
film.zvuk = partitura();

export default film;
