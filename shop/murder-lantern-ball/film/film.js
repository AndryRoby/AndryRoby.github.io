// Murder at the Lantern Ball: film na 15 sekúnd (slučka) k tlačiteľnej eliminačnej detektívke, nakreslený
// a ozvučený kódom (kodfilm engine). Vzhľad z obálky PDF (products/eliminacia/kniha.mjs, FARBY a písma):
// zelený stôl, kraftový spis, biely štítok so sponkou, lampión, Courier Prime, ARLing Serif a Sans.
// Scény: hák (kicker „PRINTABLE MURDER MYSTERY“, počítadlo „5,000 suspects“, štítok spisu s názvom, pás
// registra, kde bežia skutočné mená, otázka, riadok produktu, štatistika a obálka PDF so stranou registra
// zo skutočných strán), indície 1 až 3 sa píšu písacím strojom, skutočné riadky registra (prechod P na Q)
// sa prečiarkujú, indície 4 až 8 na inej strane (Harper), potom register prelistuje, zostávajúci hostia
// sú začiernení (žiadne dáta), počítadlo padá po skutočných číslach 5 000 až 1, posledné tri pomaly,
// kamera sa priblíži, chvíľa ticha a pečiatka „?“ zakryje posledný riadok. Záver má zloženie háku.
// Páchateľ nie je vo filme ani v data.js (postav-data.mjs).
// Bez ceny a bez adresy (Etsy a TikTok), film funguje aj bez zvuku (Etsy prehráva nemé).

import { okno, obmedz, lerp, ease, hash } from './engine/cas.js';
import { platno, zaoblene, pismo } from './engine/kresba.js';
import { format, zona, minPismo, vyvazZalom } from './engine/hak.js';
import { DATA } from './data.js';

const DLZKA = 15;
const SERIF = '"ARLing Serif", Georgia, serif';
const MONO = '"Courier Prime", "Courier New", monospace';
// Farby obálky (kniha.mjs FARBY) a stola z obrázka ponuky (pripad-1/etsy/etsy-1.png).
const FARBY = {
  atrament: '#1b1917', tehla: '#a8321a', linka: '#c9c1b3', obal: '#e6d7b6', obalTmavy: '#cdb98e', tlmene: '#5d574e',
  stitok: '#fbf8f1', harok: '#fdfbf6', stol: '#2b4a3c', stolTmavy: '#15281f', lampion: '#e9a25a', sponka: '#7d7a74',
};

// Fakty vo filme: data.js (skutočný prípad 1). Texty na obrazovke sú tieto a nič iné.
// hakKicker a statistika sú z obálky PDF a Etsy obrázku 1 (products/eliminacia/pripad-1/etsy/etsy-1.png).
export const TEXTY = {
  kicker: 'CASE FILE NO. 1 · HALLOWEEN',
  hakKicker: 'PRINTABLE MURDER MYSTERY',
  nazov: ['Murder at the', 'Lantern Ball'],
  nazovRiadok: 'Murder at the Lantern Ball',
  otazka: 'Can you find the killer?',
  produkt: 'Printable PDF and tablet version, solution included',
  produktTehla: 'solution included',
  statistika: '5,000 GUESTS · 16 CLUES · 1 KILLER',
};
const PRIEBEH = DATA.priebeh;

// --- časová os (sekundy) ---
// C: indícia k (index 0 až 15) sa objaví; prvé tri sa píšu (TYP), ďalšie sa len otočia, tempo rastie
// a posledné tri intervaly počítadla (4, 3, 2, 1) sa naťahujú na 0,40, 0,50 a 0,65 s (napätie pred
// posledným). S: riadky padnú a počítadlo klesne.
export const C = [1.2, 3.8, 5.65, 7.38, 7.7, 7.97, 8.22, 8.45, 8.7, 8.9, 9.08, 9.33, 9.68, 10.08, 10.58, 11.23];
const TYP = [0.85, 0.5, 0.62];
const ZAC_PISANIA = [C[0] + 0.1, C[1] + 0.14, C[2] + 0.14];
export const S = C.map((c, i) => (i < 3 ? ZAC_PISANIA[i] + TYP[i] + 0.1 : c + 0.1));
// Vrchol: S[15] = 11,33 (padne „1“), pružina kamery do 11,88, pred úderom pečiatky (11,79) 0,15 s ticha.
const T = {
  hakOdchod: 1.05, hakKoniec: 1.5, otazkaPrec: [0.95, 1.2], stitokNaIndiciu: C[0], riadky: [1.2, 1.45],
  listujA: [6.9, 7.3], listujB: [8.63, 9.28], kamera: [S[15], S[15] + 0.55],
  peciatka: [11.63, 11.79], zhasni: [11.85, 12.1], spat: [11.95, 12.4], stitokSpat: 12.1,
  otazka: [12.1, 12.4], produkt: [12.2, 12.5], doplnky: [12.25, 12.75],
};
const TICKER = 0.14; // hák: jedno meno z registra na 0,14 s
// Tvrdé strihy pre rozmazanie pohybu (render.mjs --sub): výmeny mien v páse háku.
export const STRIHY = Array.from({ length: Math.floor((T.hakOdchod + 0.2) / TICKER) }, (_, i) => +(TICKER * (i + 1)).toFixed(2));
// Otočenie štítku: časy prepnutia obsahu (štítok spisu na indíciu 1, indície 2 až 16, späť na štítok).
const PREPNUTIA = [T.stitokNaIndiciu, ...C.slice(1), T.stitokSpat];

// Stĺpec, ktorý indícia 1 až 8 skúša (riadky ukazujú jeho skutočnú hodnotu z registra).
const DOKAZ = [
  { pole: 'iniciala', nazov: 'SURNAME' }, { pole: 'stol', nazov: 'TABLE' }, { pole: 'vstupenka', nazov: 'TICKET' },
  { pole: 'stol', nazov: 'TABLE' }, { pole: 'prichod', nazov: 'ARRIVED' }, { pole: 'vek', nazov: 'AGE' },
  { pole: 'vstupenka', nazov: 'TICKET' }, { pole: 'napoj', nazov: 'DRINK' },
];

// --- riadky registra ako jeden dlhý pás (sloty), ktorý sa posúva ---
const SLOTOV = 9, DUCHOV = 18;
const B0 = DATA.oknoA.riadky.length + 1, D0 = B0 + DATA.oknoB.riadky.length + 1, BLOK = D0 + DUCHOV;
// začiernený blok zostávajúcich hostí: kedy (číslo indície) ktorý riadok padne; riadok 5 ostane
const BLOK_VYRAD = { 0: 12, 3: 12, 8: 12, 2: 13, 7: 13, 6: 14, 1: 15, 4: 16 };
export const PREZIVSI = 5;
export const RIADKY = [
  ...DATA.oknoA.riadky.map((r, i) => ({ slot: i, r, vyradena: r.vyradena })),
  ...DATA.oknoB.riadky.map((r, i) => ({ slot: B0 + i, r, vyradena: r.vyradena })),
  ...Array.from({ length: DUCHOV }, (_, i) => ({ slot: D0 + i, vyradena: 0, i: 100 + i })),
  ...Array.from({ length: SLOTOV }, (_, j) => ({ slot: BLOK + j, vyradena: BLOK_VYRAD[j] ?? null, i: 200 + j, blok: j })),
];
// poradie v rámci jednej indície (riadky nepadajú naraz, ale v rýchlom slede)
{
  const pocet = {};
  for (const x of RIADKY) if (x.vyradena) { x.poradie = pocet[x.vyradena] = (pocet[x.vyradena] ?? -1) + 1; }
}
// hák: v páse bežia skutočné riadky z oboch okien (meno a číslo vstupenky)
const MENA = [...DATA.oknoA.riadky, ...DATA.oknoB.riadky];

(function over() {
  // počítadlo v bloku sedí s priebehom: po indícii 12 až 16 ostáva v bloku presne toľko riadkov
  for (let k = 12; k <= 16; k++) {
    const zost = SLOTOV - Object.values(BLOK_VYRAD).filter((v) => v <= k).length;
    if (zost !== PRIEBEH[k]) throw new Error('Lantern film: blok po indícii ' + k + ' má ' + zost + ', nie ' + PRIEBEH[k]);
  }
  if (PRIEBEH[11] !== SLOTOV) throw new Error('Lantern film: blok nesedí s počtom po indícii 11');
  if (RIADKY.some((x) => x.r && !(x.vyradena >= 1 && x.vyradena <= 8))) throw new Error('Lantern film: skutočný riadok bez vyradenia do 8');
})();

const kyv = (t, amp, perioda, faza = 0) => amp * Math.sin((2 * Math.PI * t) / perioda + faza); // periódy delia 15 s

let L = null;

function sirka(text, font) {
  const m = platno(4, 4).getContext('2d');
  m.font = font;
  return m.measureText(text).width;
}
function rozostup(ctx, em) { if ('letterSpacing' in ctx) ctx.letterSpacing = em + 'px'; }

// ---------- rozloženie ----------

function rozlozenie(W, H) {
  const F = format(W, H), Z = zona(W, H), s = Math.min(W, H);
  const R = { F, Z, s, W, H, mp: minPismo(W, H) * 1.05 };
  const medzera = Z.h * 0.02;
  if (F.stlpec) {
    const vys = F.druh === 'vysoky';
    R.cit = { x: Z.x0, y: Z.y0, w: Z.w, h: Z.h * (vys ? 0.17 : 0.17) };
    R.karta = { x: Z.x0, y: R.cit.y + R.cit.h + medzera, w: Z.w, h: Z.h * (vys ? 0.23 : 0.235) };
    const hy = R.karta.y + R.karta.h + medzera * 1.6;
    R.harok = { x: Z.x0, y: hy, w: Z.w, h: Z.y1 - hy };
  } else {
    const lw = Z.w * 0.46;
    R.cit = { x: Z.x0, y: Z.y0, w: lw, h: Z.h * 0.25 };
    R.karta = { x: Z.x0, y: R.cit.y + R.cit.h + medzera * 1.5, w: lw, h: Z.h * 0.38 };
    R.harok = { x: Z.x0 + Z.w * 0.53, y: Z.y0, w: Z.w * 0.47, h: Z.h };
  }
  R.hlavicka = R.mp * 1.9;
  R.rh = (R.harok.h - R.hlavicka) / SLOTOV;
  R.rpx = Math.max(R.mp, Math.min(R.rh * 0.52, s * 0.042));
  R.pad = s * 0.028; // okraj papiera registra okolo textu
  // pás registra v háku a závere (jeden riadok)
  const ph = R.rh * 1.5;
  if (F.stlpec) {
    R.pas = { x: R.harok.x, y: R.harok.y, w: R.harok.w, h: ph };
    const cy = R.pas.y + R.pas.h + R.pad * 2.2;
    R.cta = { x: Z.x0, y: cy, w: Z.w, h: Z.y1 - cy };
  } else {
    // 16:9: pás na celú šírku pravého stĺpca, zarovnaný s horným okrajom štítku
    R.pas = { x: R.harok.x, y: R.karta.y, w: R.harok.w, h: ph };
    const cy = R.karta.y + R.karta.h + medzera * 2.5;
    R.cta = { x: Z.x0, y: cy, w: R.karta.w, h: Z.y1 - cy };
  }
  // lampión visí zhora vpravo od počítadla
  const lh = Math.min(R.cit.h * 1.05, s * 0.24), lw2 = lh * (100 / 190);
  R.lamp = { x: (F.stlpec ? Z.x1 : R.cit.x + R.cit.w) - lw2 * 0.9, h: lh, w: lw2, y: R.cit.y + R.cit.h * 0.02, zavesY: 0 };
  return R;
}

// ---------- statické vrstvy ----------

function pozadie(R, dpr) {
  const { W, H, F, s } = R;
  const c = platno(W * dpr, H * dpr), x = c.getContext('2d');
  x.scale(dpr, dpr);
  const g = x.createRadialGradient(W * 0.45, H * 0.4, s * 0.1, W * 0.5, H * 0.5, Math.hypot(W, H) * 0.6);
  g.addColorStop(0, FARBY.stol); g.addColorStop(1, FARBY.stolTmavy);
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  // jemné vlákna plsti (so semienkom)
  for (let i = 0; i < 900; i++) {
    const px = hash(i, 1) * W, py = hash(i, 2) * H, d = s * (0.004 + hash(i, 3) * 0.01), u = hash(i, 4) * Math.PI;
    x.strokeStyle = hash(i, 5) < 0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.05)';
    x.lineWidth = 1;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(u) * d, py + Math.sin(u) * d); x.stroke();
  }
  // kraftový spis s chlopňou, mierne pootočený
  const sp = F.druh === 'vysoky' ? { x: W * 0.045, y: H * 0.05, w: W * 0.91, h: H * 0.86 }
    : F.druh === 'siroky' ? { x: W * 0.035, y: H * 0.07, w: W * 0.93, h: H * 0.9 }
      : { x: W * 0.03, y: H * 0.045, w: W * 0.94, h: H * 0.93 };
  x.save();
  x.translate(sp.x + sp.w / 2, sp.y + sp.h / 2); x.rotate(-0.006); x.translate(-sp.x - sp.w / 2, -sp.y - sp.h / 2);
  x.shadowColor = 'rgba(0,0,0,0.45)'; x.shadowBlur = s * 0.04; x.shadowOffsetY = s * 0.012;
  x.fillStyle = FARBY.obalTmavy;
  zaoblene(x, sp.x + sp.w * 0.06, sp.y - s * 0.03, sp.w * 0.34, s * 0.07, s * 0.018); x.fill();
  x.fillStyle = FARBY.obal;
  zaoblene(x, sp.x, sp.y, sp.w, sp.h, s * 0.01); x.fill();
  x.shadowColor = 'transparent';
  // škvrny kraftu
  for (let i = 0; i < 26; i++) {
    const cx = sp.x + hash(i, 11) * sp.w, cy = sp.y + hash(i, 12) * sp.h, rr = s * (0.06 + hash(i, 13) * 0.2);
    const gg = x.createRadialGradient(cx, cy, 0, cx, cy, rr);
    gg.addColorStop(0, hash(i, 14) < 0.5 ? 'rgba(120,90,40,0.06)' : 'rgba(255,250,235,0.10)');
    gg.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gg; x.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
  }
  x.restore();
  return c;
}

/** Ceruzka na stole (len kde je pod spisom miesto, teda v 9:16); kreslí sa nad obálku PDF. */
function ceruzka(R, dpr) {
  const { W, H, F, s } = R;
  if (F.druh !== 'vysoky') return null;
  const c = platno(W * dpr, H * dpr), x = c.getContext('2d');
  x.scale(dpr, dpr);
  {
    x.save();
    x.translate(W * 0.2, H * 0.955); x.rotate(-0.16);
    const dl = W * 0.62, hr = s * 0.026;
    x.shadowColor = 'rgba(0,0,0,0.4)'; x.shadowBlur = s * 0.015; x.shadowOffsetY = s * 0.006;
    x.fillStyle = '#e0a93a'; x.fillRect(0, -hr / 2, dl, hr);
    x.shadowColor = 'transparent';
    x.fillStyle = '#c98f25'; x.fillRect(0, hr * 0.12, dl, hr * 0.38);
    x.fillStyle = '#b9b3a8'; x.fillRect(dl, -hr / 2, hr * 1.2, hr);
    x.fillStyle = '#c96a5a'; zaoblene(x, dl + hr * 1.2, -hr / 2, hr * 1.3, hr, hr * 0.3); x.fill();
    x.fillStyle = '#ecd2a8';
    x.beginPath(); x.moveTo(0, -hr / 2); x.lineTo(-hr * 1.9, 0); x.lineTo(0, hr / 2); x.closePath(); x.fill();
    x.fillStyle = FARBY.atrament;
    x.beginPath(); x.moveTo(-hr * 1.3, -hr * 0.16); x.lineTo(-hr * 1.9, 0); x.lineTo(-hr * 1.3, hr * 0.16); x.closePath(); x.fill();
    x.restore();
  }
  return c;
}

/** Biely štítok so sponkou (bez obsahu), s okrajom na tieň. */
function zakladKarty(R, dpr) {
  const { karta: k, s } = R, m = s * 0.05;
  const c = platno((k.w + m * 2) * dpr, (k.h + m * 2) * dpr), x = c.getContext('2d');
  x.scale(dpr, dpr);
  x.shadowColor = 'rgba(60,40,10,0.28)'; x.shadowBlur = s * 0.018; x.shadowOffsetY = s * 0.006;
  x.fillStyle = FARBY.stitok; x.fillRect(m, m, k.w, k.h);
  x.shadowColor = 'transparent';
  // sponka (ako na obálke) cez ľavý okraj štítku, mimo hlavičky
  const sw0 = s * 0.03, sx = m - sw0 * 0.5, sy = m - s * 0.035, sw = s * 0.03, sh = s * 0.085;
  x.strokeStyle = FARBY.sponka; x.lineWidth = s * 0.0045; x.lineCap = 'round';
  x.beginPath();
  x.moveTo(sx + sw * 0.3, sy + sh * 0.28); x.lineTo(sx + sw * 0.3, sy + sh * 0.8);
  x.arc(sx + sw * 0.5, sy + sh * 0.8, sw * 0.2, Math.PI, 0, true);
  x.lineTo(sx + sw * 0.7, sy + sh * 0.17);
  x.arc(sx + sw * 0.5, sy + sh * 0.17, sw * 0.2, 0, Math.PI, true);
  x.lineTo(sx + sw * 0.3 - sw * 0.0, sy + sh * 0.75);
  x.stroke();
  return { c, m };
}

/** Obsah štítku: titul spisu alebo indícia. Vracia sprite + šírky predpôn riadkov pre písací stroj. */
function obsahKarty(R, dpr, druh, ind) {
  const { karta: k, mp, s } = R;
  const pad = Math.max(k.h * 0.1, s * 0.026), vnutri = k.w - pad * 2;
  const kpx = Math.max(mp, Math.min(k.h * 0.12, s * 0.04));
  const kicker = druh === 'nazov' ? TEXTY.kicker : 'CLUE ' + String(ind.c).padStart(2, '0');
  let kroz = kpx * 0.1;
  const kfont = pismo(700, kpx, MONO);
  { const sk = sirka(kicker, kfont) + kroz * kicker.length; if (sk > vnutri) kroz = Math.max(0, kroz - (sk - vnutri) / kicker.length); }
  const ky = pad;
  const telo = { y: ky + kpx * 1.75, h: k.h - pad - (ky + kpx * 1.75) };
  let riadky, px, font, lh;
  if (druh === 'nazov') {
    // 1:1 (ponuka Etsy): názov na jeden riadok, aby bol najväčší prvok štítku
    const jeden = R.F.druh === 'stvorec';
    riadky = jeden ? [TEXTY.nazovRiadok] : TEXTY.nazov;
    px = Math.min(telo.h / (jeden ? 1.15 : 2.12), s * 0.1);
    font = pismo(600, px, SERIF);
    const naj = Math.max(...riadky.map((r) => sirka(r, font)));
    if (naj > vnutri) { px *= vnutri / naj; font = pismo(600, px, SERIF); }
    lh = px * 1.04;
  } else {
    px = Math.min(s * 0.056, telo.h / 2.45);
    const m = platno(4, 4).getContext('2d');
    for (;;) {
      font = pismo(700, px, undefined); m.font = font;
      riadky = vyvazZalom(m, ind.text, vnutri);
      if ((riadky.length <= 2 && riadky.length * px * 1.2 <= telo.h) || px <= mp) break;
      px = Math.max(mp, px * 0.95);
    }
    lh = px * 1.2;
  }
  const c = platno(k.w * dpr, k.h * dpr), x = c.getContext('2d');
  x.scale(dpr, dpr);
  x.textBaseline = 'top'; x.textAlign = 'left';
  x.font = kfont; x.fillStyle = FARBY.tehla; rozostup(x, kroz);
  x.fillText(kicker, pad, ky);
  rozostup(x, 0);
  // linka pod hlavičkou ako v knihe
  x.fillStyle = FARBY.linka; x.fillRect(pad, ky + kpx * 1.3, vnutri, Math.max(1, s * 0.0016));
  x.font = font; x.fillStyle = FARBY.atrament;
  const ty = telo.y + (druh === 'nazov' && riadky.length > 1 ? 0 : Math.max(0, (telo.h - (riadky.length - 1) * lh - px) * 0.35));
  const pozicie = riadky.map((r, i) => ({ y: ty + i * lh, h: lh, text: r }));
  pozicie.forEach((p) => x.fillText(p.text, pad, p.y));
  // predpony pre písací stroj: šírka prvých n znakov každého riadku
  const m2 = platno(4, 4).getContext('2d'); m2.font = font;
  const predpony = riadky.map((r) => Array.from({ length: r.length + 1 }, (_, n) => m2.measureText(r.slice(0, n)).width));
  return { c, pad, pozicie, predpony, znakov: riadky.reduce((a, r) => a + r.length, 0), px, telo };
}

function lampion(R, dpr) {
  const { w, h } = R.lamp, sk = h / 190;
  const c = platno(w * dpr, h * dpr), x = c.getContext('2d');
  x.scale(dpr * sk, dpr * sk);
  x.fillStyle = FARBY.atrament;
  zaoblene(x, 38, 4, 24, 9, 2); x.fill();
  x.fillStyle = FARBY.lampion; x.strokeStyle = FARBY.tehla; x.lineWidth = 2;
  x.beginPath(); x.ellipse(50, 74, 44, 60, 0, 0, Math.PI * 2); x.fill(); x.stroke();
  x.lineWidth = 1.2; x.globalAlpha = 0.7;
  for (const rx of [30, 14]) { x.beginPath(); x.ellipse(50, 74, rx, 60, 0, 0, Math.PI * 2); x.stroke(); }
  x.globalAlpha = 0.5; x.lineWidth = 1;
  x.beginPath(); x.moveTo(8, 54); x.lineTo(92, 54); x.moveTo(6, 74); x.lineTo(94, 74); x.moveTo(8, 94); x.lineTo(92, 94); x.stroke();
  x.globalAlpha = 1;
  x.fillStyle = FARBY.atrament; zaoblene(x, 38, 134, 24, 9, 2); x.fill();
  x.strokeStyle = FARBY.atrament; x.lineWidth = 1.4;
  x.beginPath(); x.moveTo(44, 143); x.lineTo(44, 160); x.moveTo(50, 143); x.lineTo(50, 164); x.moveTo(56, 143); x.lineTo(56, 160); x.stroke();
  return c;
}

// ---------- časové pomôcky ----------

/** Koľko indícií už vyradilo riadky v čase t (0 až 16). */
const vyradenych = (t) => S.filter((x) => x <= t).length;

function pocitadlo(t) {
  const i = vyradenych(t);
  if (i === 0) return { n: PRIEBEH[0], puls: 0, i };
  // valenie najviac polovicu rozstupu do ďalšieho úderu, aby sa každé skutočné číslo ustálilo
  // aspoň na 2 snímky (kontrola 2. 10.: 673 až 64 sa predtým nikdy neukázali presne)
  const dalsi = i < S.length ? S[i] - S[i - 1] : Infinity;
  const valenie = Math.min(0.42, dalsi * 0.5);
  const p = ease.outCubic(okno(t, S[i - 1], S[i - 1] + valenie));
  const a = PRIEBEH[i - 1], b = PRIEBEH[i];
  const n = p > 0.97 ? b : Math.round(Math.exp(lerp(Math.log(a), Math.log(b), p)));
  return { n, puls: Math.sin(Math.PI * okno(t, S[i - 1], S[i - 1] + Math.min(0.3, valenie))), i };
}

/** Obsah štítku v čase t: -1 titul spisu, inak index indície; a mierka otočenia (1 = plný štítok). */
function stavKarty(t) {
  let obsah = -1;
  if (t >= T.stitokNaIndiciu && t < T.stitokSpat) { obsah = 0; for (let k = 1; k < 16; k++) if (t >= C[k]) obsah = k; }
  let mierka = 1;
  PREPNUTIA.forEach((p, j) => {
    const pred = j > 0 ? PREPNUTIA[j - 1] : -1, d = j === 0 || j === PREPNUTIA.length - 1 ? 0.15 : Math.min(0.12, (p - pred) * 0.3);
    const v = Math.abs(t - p);
    if (v < d) mierka = Math.min(mierka, ease.outCubic(v / d));
  });
  return { obsah, mierka };
}

/** Postup harku: 0 pás (hák a záver), 1 celý register. */
function harokM(t) {
  if (t < T.hakOdchod) return 0;
  if (t < T.hakKoniec) return ease.inOutCubic(okno(t, T.hakOdchod, T.hakKoniec));
  if (t < T.spat[0]) return 1;
  return 1 - ease.inOutCubic(okno(t, T.spat[0], T.spat[1]));
}
const posun = (t) => lerp(0, B0, ease.inOutCubic(okno(t, ...T.listujA))) + lerp(0, BLOK - B0, ease.inOutCubic(okno(t, ...T.listujB)));
const casVyradenia = (x) => (x.vyradena === 0 ? -1 : x.vyradena ? S[x.vyradena - 1] + x.poradie * 0.05 : Infinity);

/** Aktuálny dôkaz (indícia 1 až 8) a jeho nábeh. */
function dokaz(t) {
  if (t < C[0] || t >= T.listujB[0]) return null;
  let k = 0;
  for (let j = 0; j < 8; j++) if (t >= C[j]) k = j;
  return { k, p: okno(t, C[k], C[k] + 0.18) };
}
const hodnota = (r, k) => (DOKAZ[k].pole === 'iniciala' ? r.meno[0] : r[DOKAZ[k].pole]);

// ---------- kreslenie ----------

function kresliPocitadlo(ctx, t) {
  const { cit, mp } = L.R;
  const { n, puls } = pocitadlo(t);
  const npx = cit.h * 0.6, lpx = Math.max(mp, cit.h * 0.16);
  const jedno = n <= 9;
  ctx.save();
  ctx.translate(cit.x, cit.y + npx * 0.9);
  ctx.font = pismo(700, npx, MONO); ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  const text = n.toLocaleString('en-US');
  let sc = 1 + puls * 0.03;
  if (n === 1) {
    // červená „1“: pružina 1,0 na 1,5 a späť, okolo stredu číslice
    const v = okno(t, S[15], S[15] + 0.6);
    sc = 1 + 0.5 * (Math.sin(v * Math.PI * 3) * Math.exp(-4.5 * v)) / 0.51;
    const cx = ctx.measureText(text).width / 2 - npx * 0.04;
    ctx.translate(cx, -npx * 0.36); ctx.scale(sc, sc); ctx.translate(-cx, npx * 0.36);
  } else ctx.scale(sc, sc);
  ctx.fillStyle = jedno ? FARBY.tehla : FARBY.atrament;
  ctx.fillText(text, -npx * 0.04, 0);
  ctx.restore();
  ctx.font = pismo(700, lpx, MONO); ctx.fillStyle = FARBY.tehla; ctx.textBaseline = 'top';
  rozostup(ctx, lpx * 0.16);
  ctx.fillText(n === 1 ? 'SUSPECT' : 'SUSPECTS', cit.x, cit.y + npx * 1.08);
  rozostup(ctx, 0);
}

function kresliLampion(ctx, t) {
  const { lamp } = L.R;
  const uhol = kyv(t, 0.045, 5);
  const ox = lamp.x + lamp.w / 2;
  ctx.save();
  ctx.translate(ox, -lamp.h * 0.2);
  ctx.rotate(uhol);
  const dl = lamp.y + lamp.h * 0.2;
  ctx.strokeStyle = 'rgba(93,87,78,0.9)'; ctx.lineWidth = Math.max(1.2, lamp.h * 0.008);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, dl + lamp.h * 0.03); ctx.stroke();
  // svetlo lampiónu: teplá žiara, dýcha s periódou 2,5 s
  const cy = dl + lamp.h * 0.39, r = lamp.h * (0.75 + kyv(t, 0.04, 2.5));
  const g = ctx.createRadialGradient(0, cy, lamp.h * 0.05, 0, cy, r);
  g.addColorStop(0, 'rgba(255,196,110,0.32)'); g.addColorStop(1, 'rgba(255,196,110,0)');
  ctx.fillStyle = g; ctx.fillRect(-r, cy - r, r * 2, r * 2);
  ctx.drawImage(L.lampion, -lamp.w / 2, dl, lamp.w, lamp.h);
  ctx.restore();
}

function kresliKartu(ctx, t) {
  const { karta: k } = L.R;
  const { obsah, mierka } = stavKarty(t);
  if (mierka <= 0.001) return;
  ctx.save();
  ctx.translate(k.x + k.w / 2, k.y + k.h / 2);
  ctx.rotate(-0.008);
  ctx.scale(1, mierka);
  ctx.translate(-k.w / 2, -k.h / 2);
  ctx.drawImage(L.zaklad.c, -L.zaklad.m, -L.zaklad.m, k.w + L.zaklad.m * 2, k.h + L.zaklad.m * 2);
  const o = obsah < 0 ? L.nazov : L.indicie[obsah];
  if (obsah >= 0 && obsah < 3) {
    // písací stroj: hlavička celá, telo po znakoch (výrez sprite podľa šírky predpony)
    const zac = ZAC_PISANIA[obsah], p = okno(t, zac, zac + TYP[obsah]);
    let zost = Math.floor(o.znakov * p);
    const hl = o.pozicie[0].y;
    ctx.drawImage(o.c, 0, 0, o.c.width, (hl / k.h) * o.c.height, 0, 0, k.w, hl);
    let kurzor = null;
    o.pozicie.forEach((pz, i) => {
      const n = Math.min(zost, pz.text.length); zost -= n;
      const w = o.predpony[i][n];
      if (n > 0) {
        const sy = (pz.y / k.h) * o.c.height, sh = (pz.h / k.h) * o.c.height, sw = ((o.pad + w) / k.w) * o.c.width;
        ctx.drawImage(o.c, 0, sy, sw, sh, 0, pz.y, o.pad + w, pz.h);
      }
      if (kurzor === null && (n < pz.text.length || i === o.pozicie.length - 1)) kurzor = { x: o.pad + w, y: pz.y };
    });
    const blik = (t * 2.2) % 1 < 0.6;
    if (kurzor && (p < 1 ? true : blik && t < zac + TYP[obsah] + 0.5)) {
      ctx.fillStyle = FARBY.tehla;
      ctx.fillRect(kurzor.x + o.px * 0.06, kurzor.y + o.px * 0.05, Math.max(2, o.px * 0.08), o.px * 1.0);
    }
  } else {
    ctx.drawImage(o.c, 0, 0, k.w, k.h);
  }
  ctx.restore();
}

function zaciernenie(ctx, x0, y, w, rpx, i, alfa) {
  const vys = rpx * 0.6;
  ctx.fillStyle = `rgba(27,25,23,${0.86 * alfa})`;
  zaoblene(ctx, x0, y - vys / 2, w * (0.36 + 0.2 * hash(i, 7)), vys, vys * 0.15); ctx.fill();
  const vw = rpx * (1.6 + 1.2 * hash(i, 8));
  zaoblene(ctx, x0 + w - vw, y - vys / 2, vw, vys, vys * 0.15); ctx.fill();
}

function ciara(ctx, x0, x1, y, p, rpx, i) {
  if (p <= 0) return;
  const xe = lerp(x0, x1, p), d = rpx * 0.12 * (hash(i, 9) - 0.5);
  ctx.strokeStyle = FARBY.tehla; ctx.lineWidth = Math.max(2.5, rpx * 0.09); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y + d);
  ctx.quadraticCurveTo((x0 + xe) / 2, y - d * 1.5 + rpx * 0.05, xe, y - d * 0.5);
  ctx.stroke();
}

function kresliPeciatku(ctx, cx, cy, w, h, t) {
  const p = okno(t, ...T.peciatka);
  if (p <= 0) return;
  const sc = lerp(1.6, 1, ease.outCubic(p)), a = ease.outQuad(okno(t, T.peciatka[0], T.peciatka[0] + 0.08));
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(-0.06); ctx.scale(sc, sc);
  ctx.globalAlpha = a;
  ctx.fillStyle = FARBY.harok;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.strokeStyle = FARBY.tehla; ctx.lineWidth = Math.max(3, h * 0.07);
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.lineWidth = Math.max(1.5, h * 0.025);
  ctx.strokeRect(-w / 2 + h * 0.12, -h / 2 + h * 0.12, w - h * 0.24, h - h * 0.24);
  ctx.fillStyle = FARBY.tehla; ctx.font = pismo(700, h * 0.82, MONO); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('?', 0, h * 0.04);
  ctx.restore();
}

function kresliHarok(ctx, t) {
  const R = L.R, { harok: hk, pas, rh, rpx, pad, hlavicka } = R;
  const m = harokM(t);
  const r = { x: lerp(pas.x, hk.x, m), y: lerp(pas.y, hk.y, m), w: lerp(pas.w, hk.w, m), h: lerp(pas.h, hk.h, m) };
  // papier registra
  ctx.save();
  ctx.shadowColor = 'rgba(60,40,10,0.3)'; ctx.shadowBlur = R.s * 0.02; ctx.shadowOffsetY = R.s * 0.006;
  ctx.fillStyle = FARBY.harok;
  ctx.fillRect(r.x - pad, r.y - pad * 0.8, r.w + pad * 2, r.h + pad * 1.6);
  ctx.restore();
  const x0 = r.x, x1 = r.x + r.w;
  const hlA = okno(m, 0.6, 1);
  const vnutroY = lerp(r.y, hk.y + hlavicka, m);
  // hlavička: register (bez čísla strany, to platí len pre A4) a stĺpec, ktorý indícia skúša
  if (hlA > 0) {
    ctx.save();
    ctx.globalAlpha = hlA;
    ctx.font = pismo(700, R.mp, MONO); ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillStyle = FARBY.tlmene;
    rozostup(ctx, R.mp * 0.08);
    const hy = hk.y + hlavicka * 0.42;
    ctx.fillText('REGISTER', x0, hy);
    const d = dokaz(t);
    if (d) {
      ctx.textAlign = 'right'; ctx.fillStyle = FARBY.tehla;
      if (d.k > 0 && d.p < 1) { ctx.globalAlpha = hlA * (1 - d.p); ctx.fillText(DOKAZ[d.k - 1].nazov, x1, hy); }
      ctx.globalAlpha = hlA * d.p;
      ctx.fillText(DOKAZ[d.k].nazov, x1, hy);
      const sw = sirka(DOKAZ[d.k].nazov, ctx.font) + R.mp * 0.08 * DOKAZ[d.k].nazov.length;
      ctx.fillRect(x1 - sw * d.p, hy + R.mp * 0.62, sw * d.p, Math.max(2, R.mp * 0.06));
    }
    rozostup(ctx, 0);
    ctx.globalAlpha = hlA;
    ctx.fillStyle = FARBY.atrament; ctx.fillRect(x0, hk.y + hlavicka * 0.86, r.w, Math.max(1.5, R.s * 0.002));
    ctx.restore();
  }
  // riadky (výrez na vnútro papiera)
  ctx.save();
  ctx.beginPath(); ctx.rect(r.x - pad, vnutroY, r.w + pad * 2, r.y + r.h - vnutroY); ctx.clip();
  let peciatka = null;
  // hák: pás, v ktorom bežia skutočné mená z registra
  const hakA = 1 - okno(t, T.hakOdchod, T.hakOdchod + 0.2);
  if (hakA > 0 && t < T.spat[0]) {
    const hr = MENA[Math.floor(t / TICKER + 1e-6) % MENA.length];
    ctx.globalAlpha = hakA;
    ctx.font = pismo(600, rpx * 1.15); ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillStyle = FARBY.atrament;
    ctx.fillText(hr.meno, x0, r.y + r.h / 2);
    ctx.font = pismo(700, rpx * 1.15, MONO); ctx.textAlign = 'right'; ctx.fillStyle = FARBY.tlmene;
    ctx.fillText('No. ' + hr.vstupenka, x1, r.y + r.h / 2);
    ctx.globalAlpha = 1;
  }
  const rowsA = okno(t, ...T.riadky);
  const po = posun(t);
  const d = dokaz(t);
  if (rowsA > 0) {
    ctx.save();
    for (const x of RIADKY) {
      const rel = x.slot - po;
      if (rel < -1 || rel > SLOTOV) continue;
      let y = hk.y + hlavicka + rel * rh + rh / 2;
      const tv = casVyradenia(x);
      let alfa = rowsA;
      const ps = obmedz((t - tv) / 0.22);
      if (x.blok === PREZIVSI) {
        // posledný riadok: do stredu pásu, keď sa register zbalí
        const zbal = okno(t, ...T.spat);
        if (zbal > 0) y = lerp(y, r.y + r.h / 2, ease.inOutCubic(zbal));
      } else alfa *= 1 - okno(t, ...T.zhasni); // v závere ostane len posledný riadok
      if (alfa <= 0) continue;
      const tlm = 1 - 0.6 * okno(t, tv + 0.1, tv + 0.3);
      ctx.globalAlpha = alfa * tlm;
      if (x.r) {
        ctx.font = pismo(600, rpx); ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillStyle = FARBY.atrament;
        ctx.fillText(x.r.meno, x0, y);
        if (d) {
          ctx.font = pismo(700, rpx, MONO); ctx.textAlign = 'right';
          if (d.k > 0 && d.p < 1) { ctx.globalAlpha = alfa * tlm * (1 - d.p); ctx.fillText(hodnota(x.r, d.k - 1), x1, y); }
          ctx.globalAlpha = alfa * tlm * d.p;
          ctx.fillText(hodnota(x.r, d.k), x1, y);
        }
      } else {
        zaciernenie(ctx, x0, y, r.w, rpx, x.i, 1);
      }
      ctx.globalAlpha = alfa;
      // čiara len po okraj textu s malou rezervou, nikdy po okraj papiera (ten ju predtým rezal)
      const rez = Math.min(rpx * 0.2, pad * 0.5);
      if (tv < Infinity) ciara(ctx, x0 - rez, x1 + rez, y, x.vyradena === 0 ? 1 : ps, rpx, x.i ?? x.slot);
      // jemná linka pod riadkom
      ctx.globalAlpha = alfa * 0.55; ctx.fillStyle = FARBY.linka;
      ctx.fillRect(x0, y + rh / 2 - 1, r.w, 1);
      ctx.globalAlpha = 1;
      if (x.blok === PREZIVSI) peciatka = { x: (x0 + x1) / 2, y };
    }
    ctx.restore();
  }
  ctx.restore();
  // pečiatka mimo výrezu, aby ju okraj pásu neorezal (logické body, kamera je už v transformácii)
  if (peciatka) kresliPeciatku(ctx, peciatka.x, peciatka.y, r.w * 0.6, Math.max(rh * 1.3, R.mp * 2.4), t);
}

/** Kamera vrcholu: po páde poslednej „1“ priblíženie celej skupiny 1,0 na 1,10 po pružine, späť pri zbalení. */
function kamera(t) {
  const v = okno(t, ...T.kamera);
  if (v <= 0) return 1;
  const pruzina = 1 - Math.exp(-5 * v) * Math.cos(9 * v);
  return 1 + 0.1 * pruzina * (1 - ease.inOutCubic(okno(t, ...T.spat)));
}
function stredKamery() {
  const { harok: hk, hlavicka, rh } = L.R;
  return [hk.x + hk.w / 2, hk.y + hlavicka + PREZIVSI * rh + rh / 2];
}

/** Hák a záver: kicker, otázka, riadok produktu, štatistika z obálky a obálka PDF so stranou registra. */
function kresliCta(ctx, t) {
  const R = L.R, { cta } = R;
  const hak = t < 5, von = 1 - ease.inOutCubic(okno(t, ...T.otazkaPrec));
  const aO = hak ? von : ease.outCubic(okno(t, ...T.otazka));
  const aP = hak ? von : ease.outCubic(okno(t, ...T.produkt));
  const aX = hak ? von : ease.outCubic(okno(t, ...T.doplnky));
  if (aX > 0) {
    ctx.globalAlpha = aX;
    ctx.drawImage(L.hakKicker.c, R.kick.x, R.kick.y, L.hakKicker.w, L.hakKicker.h);
  }
  if (aO > 0) {
    ctx.globalAlpha = aO;
    ctx.drawImage(L.otazka.c, cta.x, cta.y + (1 - aO) * L.otazka.h * 0.15, L.otazka.w, L.otazka.h);
  }
  if (aP > 0) {
    ctx.globalAlpha = aP;
    ctx.drawImage(L.produkt.c, cta.x, R.produktY + (1 - aP) * R.mp * 0.4, L.produkt.w, L.produkt.h);
  }
  if (aX > 0) {
    ctx.globalAlpha = aX;
    ctx.drawImage(L.statistika.c, R.stat.x, R.stat.y + (1 - aX) * R.mp * 0.4, L.statistika.w, L.statistika.h);
    if (L.obr) {
      // obálka odíde nadol a v závere sa zdola vráti (pohyb papiera, nie len prelínanie)
      const o = L.obr, dy = (1 - aX) * o.h * 0.22;
      ctx.drawImage(o.c, o.x - o.m, o.y - o.m + dy, o.w + o.m * 2, o.h + o.m * 2);
    }
  }
  ctx.globalAlpha = 1;
}

function spriteTextu(dpr, riadky, font, farba, w, lh, px, rozost = 0) {
  const h = lh * (riadky.length - 1) + px * 1.3;
  const c = platno(w * dpr, h * dpr), x = c.getContext('2d');
  x.scale(dpr, dpr); x.font = font; x.fillStyle = farba; x.textBaseline = 'top'; x.textAlign = 'left';
  rozostup(x, rozost);
  riadky.forEach((r, i) => x.fillText(r, 0, i * lh));
  return { c, w, h };
}

/** Riadok produktu: atrament, časť „solution included“ tehlou (riadky z vyváženého zalomenia). */
function spriteProduktu(dpr, riadky, font, w, lh, px) {
  const h = lh * (riadky.length - 1) + px * 1.3;
  const c = platno(w * dpr, h * dpr), x = c.getContext('2d');
  x.scale(dpr, dpr); x.font = font; x.textBaseline = 'top'; x.textAlign = 'left';
  const zac = TEXTY.produkt.indexOf(TEXTY.produktTehla);
  let od = 0;
  riadky.forEach((r, i) => {
    const k = obmedz(zac - od, 0, r.length);
    x.fillStyle = FARBY.atrament; x.fillText(r.slice(0, k), 0, i * lh);
    x.fillStyle = FARBY.tehla; x.fillText(r.slice(k), x.measureText(r.slice(0, k)).width, i * lh);
    od += r.length + 1;
  });
  return { c, w, h };
}

/** Obálka PDF šikmo, pod ňou vyčnieva strana registra (skutočné strany A4 1 a 6, bez riešenia). */
function spriteObalky(R, dpr, box) {
  const { s } = R, ob = OBRAZKY.obalka, rg = OBRAZKY.register;
  if (!ob || !rg) return null;
  const pomer = ob.naturalWidth / ob.naturalHeight;
  let ch = box.h, cw = ch * pomer;
  if (cw * 1.5 > box.w) { cw = box.w / 1.5; ch = cw / pomer; }
  const m = s * 0.06, w = box.w, h = box.h;
  const c = platno((w + m * 2) * dpr, (h + m * 2) * dpr), x = c.getContext('2d');
  x.scale(dpr, dpr);
  const cx = m + w / 2 - cw * 0.12, cy = m + h - ch / 2;
  const list = (img, dx, dy, uhol) => {
    x.save();
    x.translate(cx + dx, cy + dy); x.rotate(uhol);
    x.shadowColor = 'rgba(40,25,5,0.38)'; x.shadowBlur = s * 0.022; x.shadowOffsetY = s * 0.008;
    x.fillStyle = '#ffffff'; x.fillRect(-cw / 2, -ch / 2, cw, ch);
    x.shadowColor = 'transparent';
    x.drawImage(img, -cw / 2, -ch / 2, cw, ch);
    x.restore();
  };
  list(rg, cw * 0.36, -ch * 0.05, 0.085);
  list(ob, 0, 0, -0.045);
  return { c, m, w, h, x: box.x, y: box.y };
}

// Skutočné strany PDF (A4 strana 1 a 6), načítané v pripravit() zo súborov vedľa filmu.
const OBRAZKY = { obalka: null, register: null };
function nacitaj(meno) {
  return new Promise((ok) => {
    const img = new Image();
    img.onload = () => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(() => ok(img));
    img.onerror = () => ok(null);
    img.src = new URL(meno, import.meta.url).href;
  });
}

// ---------- zvuk ----------

function partitura() {
  const u = [];
  const klik = (t, i, hlas = 1) => {
    u.push({ t, typ: 'sum', filter: 'highpass', f0: 2600 + 900 * hash(i, 21), f1: 3800, dlzka: 0.028, hlas: (0.07 + 0.03 * hash(i, 22)) * hlas, dozvuk: 0.06 });
    u.push({ t, typ: 'tuk', f: 260 + 80 * hash(i, 23), dlzka: 0.035, hlas: 0.06 * hlas });
  };
  // hák: nízky tón a cvaknutie písacieho stroja od snímky 0
  u.push({ t: 0, typ: 'tuk', f: 55, dlzka: 0.7, hlas: 0.3 });
  klik(0, 1, 1.3); klik(0.13, 2, 1.1);
  u.push({ t: 0.04, typ: 'zvon', f: 'E5', index: 0.5, dlzka: 1.4, hlas: 0.04, pan: 0.3, dozvuk: 0.5 });
  // tichý podklad: Am, F, Dm (doznie pred tichom vrcholu), C od úderu pečiatky; všetko doznie do 14,7 s,
  // aby zvuk nepresahoval koniec obrazu (15,000 s)
  const uder = T.peciatka[1];
  u.push({ t: 0, typ: 'pad', noty: ['A2', 'E3', 'C4'], dlzka: 5.2, nabeh: 0.05, dobeh: 0.8, hlas: 0.12, filter: 900, filter2: 700 });
  u.push({ t: 4.8, typ: 'pad', noty: ['F2', 'C3', 'A3'], dlzka: 4.1, nabeh: 0.6, dobeh: 0.8, hlas: 0.11, filter: 900 });
  u.push({ t: 8.5, typ: 'pad', noty: ['D3', 'F3', 'A3'], dlzka: T.peciatka[0] - 8.5, nabeh: 0.4, dobeh: 0.45, hlas: 0.12, filter: 1100 });
  u.push({ t: uder, typ: 'pad', noty: ['C3', 'G3', 'E4'], dlzka: 14.7 - uder, nabeh: 0.06, dobeh: 1.5, hlas: 0.13, filter: 1300, filter2: 800 });
  // odchod háku: švih papiera
  u.push({ t: T.hakOdchod, typ: 'sum', filter: 'bandpass', f0: 600, f1: 2400, q: 0.8, dlzka: 0.4, nabeh: 0.3, tvar: 'narast', hlas: 0.05, dozvuk: 0.15 });
  // indície 1 až 3: písací stroj po znakoch, na konci prvej zvonček vozíka
  for (let k = 0; k < 3; k++) {
    const o = L ? L.indicie[k] : null;
    const n = o ? o.znakov : DATA.indicie[k].text.length;
    const text = DATA.indicie[k].text;
    for (let j = 0; j < n; j++) if (text[j] !== ' ') klik(ZAC_PISANIA[k] + TYP[k] * (j + 1) / n, k * 100 + j, 0.8);
  }
  u.push({ t: ZAC_PISANIA[0] + TYP[0] + 0.06, typ: 'zvon', f: 'E6', index: 0.3, dlzka: 0.6, hlas: 0.035, pan: 0.4, dozvuk: 0.3 });
  // indície 4 až 16: otočenie štítku (klik a šuchot)
  for (let k = 3; k < 16; k++) {
    klik(C[k], 500 + k, 1);
    u.push({ t: C[k] - 0.03, typ: 'sum', filter: 'bandpass', f0: 2200, f1: 900, q: 0.9, dlzka: 0.1, hlas: 0.035, dozvuk: 0.1 });
  }
  // vyradenie: atramentová čiara a ťuk počítadla; od jednociferných čísel tóny z pentatoniky
  const tony = ['A4', 'G4', 'E4', 'D4', 'C4'];
  S.forEach((s, k) => {
    const posledny = k === 15;
    u.push({ t: s, typ: 'sum', filter: 'bandpass', f0: 1700, f1: 700, q: 1.1, dlzka: posledny ? 0.16 : 0.2, hlas: 0.05, dozvuk: posledny ? 0.03 : 0.1 });
    u.push({ t: s + 0.02, typ: 'tuk', f: posledny ? 110 : 150, dlzka: posledny ? 0.16 : 0.09, hlas: posledny ? 0.12 : 0.08 });
    if (k >= 11 && k < 15) u.push({ t: s + 0.03, typ: 'zvon', f: tony[k - 11], index: 0.6, dlzka: 0.9, hlas: 0.05, dozvuk: 0.35 });
  });
  // prelistovanie registra
  for (const [od, dokedy] of [T.listujA, T.listujB]) u.push({ t: od, typ: 'sum', filter: 'bandpass', f0: 500, f1: 2800, q: 0.7, dlzka: dokedy - od, nabeh: (dokedy - od) * 0.6, tvar: 'narast', hlas: 0.06, dozvuk: 0.2 });
  // posledný: krátky úder pri „1“ (vyššie), potom 0,15 s bez nového zvuku (T.peciatka[0] až úder),
  // a až s úderom pečiatky zvon, ligot a nízky ťuk
  u.push({ t: uder - 0.02, typ: 'tuk', f: 68, dlzka: 0.32, hlas: 0.32 });
  u.push({ t: uder - 0.02, typ: 'sum', filter: 'lowpass', f0: 900, f1: 300, dlzka: 0.12, hlas: 0.12, dozvuk: 0.1 });
  u.push({ t: uder, typ: 'zvon', f: 'C6', pomer: 3.5, index: 0.7, dlzka: 2.2, hlas: 0.1, dozvuk: 0.6 });
  u.push({ t: uder + 0.1, typ: 'zvon', f: 'G5', index: 0.6, dlzka: 2.0, hlas: 0.07, pan: -0.25, dozvuk: 0.6 });
  u.push({ t: uder, typ: 'sum', filter: 'highpass', f0: 5000, f1: 9000, dlzka: 0.9, hlas: 0.025, dozvuk: 0.6 });
  u.push({ t: T.otazka[0] + 0.1, typ: 'zvon', f: 'E5', index: 0.5, dlzka: 1.6, hlas: 0.045, pan: 0.2, dozvuk: 0.5 });
  // kontrola: žiadna udalosť (bez dozvuku) nepresahuje koniec obrazu
  for (const e of u) if (e.t + (e.dlzka ?? 0.5) > DLZKA - 0.05) throw new Error('Lantern film: zvuk presahuje koniec v ' + e.t);
  return u;
}

// ---------- film ----------

export default {
  dlzka: DLZKA,
  plagat: 0.62,
  titulky: [
    { od: 0, text: 'Printable murder mystery. Case File No. 1, Halloween. Murder at the Lantern Ball. 5,000 suspects. Names from the guest register flicker past. The PDF cover: 5,000 guests, 16 clues, 1 killer. Can you find the killer?' },
    { od: C[0], text: 'Clue 1: Surname starts with a letter from A to P. In the register the four Quinns are struck out. 3,456 suspects left.' },
    { od: C[1], text: 'Clue 2: Table is less than 24. Two more guests struck out. 2,013 left.' },
    { od: C[2], text: 'Clue 3: Ticket does not contain the digit 4. 1,176 left.' },
    { od: T.listujA[0], text: 'Clues 4 to 8 strike out the Harpers further on in the register, one by one. 673, 417, 222, 114, 64 left.' },
    { od: T.listujB[0], text: 'Clues 9 to 16. The register flips past. 39, 23, 9, 6, 4, 3, 2 suspects left. The remaining guests are blacked out.' },
    { od: S[15], text: 'One suspect is left. A red stamp with a question mark covers the name.' },
    { od: T.otazka[0], text: 'Can you find the killer? Printable PDF and tablet version, solution included. 5,000 guests, 16 clues, 1 killer.' },
  ],
  async pripravit() {
    const obr = Promise.all([nacitaj('obalka-pdf.jpg'), nacitaj('register-pdf.jpg')])
      .then(([o, r]) => { OBRAZKY.obalka = o; OBRAZKY.register = r; });
    if (document.fonts && document.fonts.load) {
      await Promise.all([
        document.fonts.load(pismo(700, 40)), document.fonts.load(pismo(600, 40)),
        document.fonts.load(pismo(600, 40, SERIF)), document.fonts.load(pismo(700, 40, MONO)),
      ]).catch(() => {});
    }
    await obr;
  },
  vrstvy(W, H, dpr) {
    const R = rozlozenie(W, H);
    const { F, Z, s, mp } = R;
    const m = platno(4, 4).getContext('2d');
    // kicker háku ako na Etsy obrázku 1: Courier Prime 700, tehla, široký rozstup
    let kpx = Math.max(mp, s * 0.035), kroz = kpx * 0.18;
    const kw = F.stlpec ? Z.w : R.harok.w;
    m.font = pismo(700, kpx, MONO);
    const kSirka = () => m.measureText(TEXTY.hakKicker).width + kroz * TEXTY.hakKicker.length;
    if (kSirka() > kw) kroz = Math.max(0, kroz - (kSirka() - kw) / TEXTY.hakKicker.length);
    const hakKicker = spriteTextu(dpr, [TEXTY.hakKicker], pismo(700, kpx, MONO), FARBY.tehla, kw, kpx, kpx, kroz);
    // otázka a riadok produktu (atrament, väčší, „solution included“ tehlou)
    const otazkaPx = Math.max(mp, s * (F.druh === 'siroky' ? 0.058 : F.druh === 'vysoky' ? 0.072 : 0.062));
    const of = pismo(600, otazkaPx, SERIF);
    m.font = of;
    const oR = vyvazZalom(m, TEXTY.otazka, R.cta.w);
    const ppx = Math.max(mp, s * (F.druh === 'siroky' ? 0.04 : 0.044)), pf = pismo(600, ppx);
    m.font = pf;
    const pR = vyvazZalom(m, TEXTY.produkt, R.cta.w);
    const otazka = spriteTextu(dpr, oR, of, FARBY.atrament, R.cta.w, otazkaPx * 1.12, otazkaPx);
    const produkt = spriteProduktu(dpr, pR, pf, R.cta.w, ppx * 1.22, ppx);
    // štatistika z obálky PDF
    // 9:16: rezerva, aby „KILLER“ nekončil presne na hrane zóny; 16:9 potrebuje celú šírku stĺpca na jeden riadok
    const sw = (F.stlpec ? Z.w : R.harok.w) * (F.druh === 'vysoky' ? 0.97 : 1);
    // najprv ubrať rozostup písmen, potom písmo (najviac po minimum), až potom zalomiť
    let spx = Math.max(mp, s * 0.037), sRoz = spx * 0.04;
    const sSirka = (px) => { m.font = pismo(700, px, MONO); return m.measureText(TEXTY.statistika).width + sRoz * TEXTY.statistika.length; };
    if (sSirka(spx) > sw) sRoz = 0;
    while (spx > mp && sSirka(spx) > sw) spx = Math.max(mp, spx * 0.97);
    m.font = pismo(700, spx, MONO);
    const sR = sSirka(spx) > sw ? vyvazZalom(m, TEXTY.statistika, sw) : [TEXTY.statistika];
    const statistika = spriteTextu(dpr, sR, pismo(700, spx, MONO), FARBY.atrament, sw, spx * 1.25, spx, sRoz);

    // rozloženie háku a záveru
    let obrBox = null;
    if (F.stlpec) {
      // kicker, pás, otázka, produkt, štatistika pod sebou; pod nimi obálka PDF, ak je na ňu miesto
      const zac = R.harok.y;
      const vyska = hakKicker.h + mp * 0.35 + R.pas.h + R.pad * 1.6 + otazka.h + mp * 0.3 + produkt.h + mp * 0.45 + statistika.h;
      const dno = R.H * (F.druh === 'vysoky' ? 0.945 : 0.97); // obálka smie ležať aj na stole pod spisom
      const volne = dno - (zac + vyska) - mp * 0.8;
      const sObr = volne >= s * 0.3;
      const dy = sObr ? 0 : Math.max(0, (Z.y1 - (zac + vyska)) * 0.5);
      let y = zac + dy;
      R.kick = { x: Z.x0, y }; y += hakKicker.h + mp * 0.35;
      R.pas.y = y; y += R.pas.h + R.pad * 1.6;
      R.cta.y = y; y += otazka.h + mp * 0.3;
      R.produktY = y; y += produkt.h + mp * 0.45;
      R.stat = { x: Z.x0, y }; y += statistika.h;
      if (sObr) obrBox = { x: Z.x0, y: y + mp * 0.8, w: Z.w, h: dno - y - mp * 0.8 };
    } else {
      // 16:9: vľavo otázka a produkt pod štítkom, vpravo kicker, pás, štatistika a obálka PDF
      R.kick = { x: R.harok.x, y: R.pas.y - hakKicker.h - mp * 0.3 };
      R.produktY = R.cta.y + otazka.h + mp * 0.3;
      R.stat = { x: R.harok.x, y: R.pas.y + R.pas.h + R.pad * 1.6 };
      const y = R.stat.y + statistika.h + mp * 0.8, dno = R.H * 0.985;
      obrBox = { x: R.harok.x, y, w: R.harok.w, h: dno - y };
    }
    L = {
      R, otazka, produkt, hakKicker, statistika,
      obr: obrBox ? spriteObalky(R, dpr, obrBox) : null,
      pozadie: pozadie(R, dpr),
      ceruzka: ceruzka(R, dpr),
      zaklad: zakladKarty(R, dpr),
      nazov: obsahKarty(R, dpr, 'nazov'),
      indicie: DATA.indicie.map((ind) => obsahKarty(R, dpr, 'indicia', ind)),
      lampion: lampion(R, dpr),
    };
  },
  kresli(ctx, t, W, H) {
    // Stav plátna (letterSpacing, font, zarovnanie) sa nesmie preniesť do ďalšej snímky:
    // kontrola determinizmu 2. 10. našla iný obraz v 1,5 a 4,5 s po vykreslení neskorších časov.
    ctx.save();
    try {
      // kamera vrcholu: celá skupina (spis, štítok, register, počítadlo) okolo posledného riadku
      const z = kamera(t);
      if (z !== 1) { const [cx, cy] = stredKamery(); ctx.translate(cx, cy); ctx.scale(z, z); ctx.translate(-cx, -cy); }
      ctx.drawImage(L.pozadie, 0, 0, W, H);
      kresliHarok(ctx, t);
      kresliKartu(ctx, t);
      kresliPocitadlo(ctx, t);
      kresliLampion(ctx, t);
      kresliCta(ctx, t);
      if (L.ceruzka) ctx.drawImage(L.ceruzka, 0, 0, W, H);
    } finally {
      ctx.restore();
    }
  },
  strihy: STRIHY,
  stredPlagatu() { const k = L.R.karta; return [k.x + k.w / 2, k.y + k.h / 2]; },
  odkazy() { return []; },
  zvuk: partitura(),
  // pre kontrolu: rozloženie a časy
  _test: { C, S, T, RIADKY, PRIEBEH, TEXTY, rozlozenie: () => L && L.R },
};
