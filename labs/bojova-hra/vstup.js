// Tumble Dojo: vstup. Všetko ide do fronty s event.timeStamp, hra to zaradí do kroku fyziky.
import * as U from './ovladanie.js';

const N = 512, QT = new Float64Array(N), QP = new Uint8Array(N), QK = new Uint8Array(N), QV = new Int8Array(N);
let qh = 0, qt = 0;
// druhy: 1 výpad, 2 zaprenie, 3 úkrok (-1, +1, 2 = ku stredu), 4 joystick x, 5 joystick y, 6 chmat, 7 dupnutie
export const H = [false, false], B = [false, false], SIDE = new Int8Array(2), G = new Uint8Array(2), P = new Uint8Array(2);
export const JX = new Int16Array(2), JY = new Int16Array(2);
export let rezim = 'ai';
let el = null, W = 1, Hh = 1;
const TAN35 = 0.7002, TAN55 = 1.4281;

export function daj(t, p, k, v) { QT[qt] = t; QP[qt] = p; QK[qt] = k; QV[qt] = v; qt = (qt + 1) % N; if (qt === qh) qh = (qh + 1) % N; }
export function doKroku(t) {
  let n = 0;
  while (qh !== qt && QT[qh] <= t) {
    n++;
    const p = QP[qh], k = QK[qh], v = QV[qh];
    if (k === 1) H[p] = v > 0; else if (k === 2) B[p] = v > 0; else if (k === 3) SIDE[p] = v;
    else if (k === 4) JX[p] = v; else if (k === 5) JY[p] = v; else if (k === 6) G[p] = 1; else if (k === 7) P[p] = 1;
    qh = (qh + 1) % N;
  }
  return n;
}
export function vycisti() {
  qh = qt = 0; H[0] = H[1] = B[0] = B[1] = false; SIDE.fill(0); G.fill(0); P.fill(0); JX.fill(0); JY.fill(0); GS.fill(0); SM.fill(0); KD.fill(0);
  U.vycisti();
}
export function nastav(r) { rezim = r; vycisti(); }
// nové kolo: palce ostávajú na skle, zabudnú sa len jednorazové stlačenia
export function noveKolo() { SIDE.fill(0); G.fill(0); P.fill(0); }

// klávesy: [hráč, druh, hodnota]; chôdza druh 8 (1 hore, 2 dole, 3 vľavo, 4 vpravo)
const KL = {
  dojo: { KeyW: [0, 8, 1], KeyS: [0, 8, 2], KeyA: [0, 8, 3], KeyD: [0, 8, 4], KeyJ: [0, 1, 1], Space: [0, 1, 1], KeyK: [0, 2, 1],
    KeyQ: [0, 3, -1], KeyE: [0, 3, 1], KeyI: [0, 6, 1], KeyO: [0, 7, 1] },
  classic: { Space: [0, 1, 1], KeyS: [0, 2, 1], KeyA: [0, 3, -1], KeyD: [0, 3, 1], ArrowUp: [0, 8, 1], ArrowDown: [0, 8, 2], ArrowLeft: [0, 8, 3], ArrowRight: [0, 8, 4],
    KeyE: [0, 6, 1], KeyR: [0, 7, 1], KeyW: [0, 1, 1] },
  kl2: { KeyW: [0, 8, 1], KeyS: [0, 8, 2], KeyA: [0, 8, 3], KeyD: [0, 8, 4], KeyF: [0, 1, 1], KeyG: [0, 2, 1], KeyH: [0, 3, 0], KeyR: [0, 6, 1], KeyT: [0, 7, 1],
    ArrowUp: [1, 8, 1], ArrowDown: [1, 8, 2], ArrowLeft: [1, 8, 3], ArrowRight: [1, 8, 4], KeyK: [1, 1, 1], KeyL: [1, 2, 1], Semicolon: [1, 3, 0], KeyO: [1, 6, 1], KeyP: [1, 7, 1],
    Numpad0: [1, 1, 1], Numpad1: [1, 2, 1], Numpad2: [1, 3, 0], Numpad4: [1, 6, 1], Numpad5: [1, 7, 1] },
  kl2c: { KeyW: [0, 1, 1], KeyS: [0, 2, 1], KeyA: [0, 3, -1], KeyD: [0, 3, 1],
    KeyK: [1, 1, 1], KeyI: [1, 2, 1], KeyJ: [1, 3, -1], KeyL: [1, 3, 1],
    ArrowDown: [1, 1, 1], ArrowUp: [1, 2, 1], ArrowLeft: [1, 3, -1], ArrowRight: [1, 3, 1] }
};
const KD = new Uint8Array(8);   // držané smery chôdze [hráč * 4 + smer]
function chodzaKlav(t, p) {
  const o = p * 4, x = (KD[o + 3] ? 1 : 0) - (KD[o + 2] ? 1 : 0), y = (KD[o + 1] ? 1 : 0) - (KD[o] ? 1 : 0);
  daj(t, p, 4, x * 127); daj(t, p, 5, y * 127);
}
function mapa() {
  if (rezim === 'kl2') return U.nastavenie.keys === 'classic' ? KL.kl2c : KL.kl2;
  return U.nastavenie.keys === 'classic' ? KL.classic : KL.dojo;
}
function klaves(e, dole) {
  const m = mapa()[e.code];
  if (!m || !aktivny()) return;
  e.preventDefault();
  if (e.repeat) return;
  const t = e.timeStamp, p = m[0];
  if (m[1] === 8) { KD[p * 4 + m[2] - 1] = dole ? 1 : 0; chodzaKlav(t, p); return; }
  if (m[1] === 3) {
    if (!dole) return;
    let v = m[2];
    if (v === 0) { const o = p * 4; v = KD[o + 2] && !KD[o + 3] ? -1 : KD[o + 3] && !KD[o + 2] ? 1 : 2; }   // smer podľa chôdze, inak ku stredu
    daj(t, p, 3, v); U.blik(p, 'step'); return;
  }
  if (m[1] === 6 || m[1] === 7) { if (dole) { daj(t, p, m[1], 1); U.blik(p, m[1] === 6 ? 'grab' : 'special'); } return; }
  daj(t, p, m[1], dole ? 1 : 0);
}

// gestá: drž a pusti = výpad, ťah k sebe = zaprenie, švih do strany = úkrok
// GS na ukazovateľ: [id, hráč, x0, y0, t0, stav 1 nabíja, 2 zapiera, 3 hotovo]
const GS = new Float64Array(10 * 6), SM = new Uint8Array(1);
function slot(id) { for (let i = 0; i < 10; i++) if (GS[i * 6 + 5] && GS[i * 6] === id) return i; return -1; }
const hracNa = (y) => (rezim === 'tel2' && y < Hh / 2 ? 1 : 0);
function dole(e) {
  if (!aktivny()) return;
  if (e.pointerType === 'touch') U.aktivuj();
  if (U.tlacidlaZap(e.pointerType) && U.dole(e, W, Hh, rezim, daj)) { zachyt(e); return; }
  let i = -1; for (let k = 0; k < 10; k++) if (!GS[k * 6 + 5]) { i = k; break; }
  if (i < 0) return;
  const p = hracNa(e.clientY);
  for (let k = 0; k < 10; k++) if (GS[k * 6 + 5] && GS[k * 6 + 1] === p) return;
  const o = i * 6; GS[o] = e.pointerId; GS[o + 1] = p; GS[o + 2] = e.clientX; GS[o + 3] = e.clientY; GS[o + 4] = e.timeStamp; GS[o + 5] = 1;
  zachyt(e);
  daj(e.timeStamp, p, 1, 1);
}
function zachyt(e) { try { el.setPointerCapture(e.pointerId); } catch (x) {} e.preventDefault(); }
function pohyb(e) {
  if (U.pohyb(e, daj)) return;
  const i = slot(e.pointerId); if (i < 0) return;
  const o = i * 6; if (GS[o + 5] !== 1) return;
  const p = GS[o + 1];
  let dx = e.clientX - GS[o + 2], dy = e.clientY - GS[o + 3];
  if (p === 1) { dx = -dx; dy = -dy; }                     // horná polovica je otočená o 180°
  const prah = 0.12 * (rezim === 'tel2' ? Hh / 2 : Math.min(Hh, 900) / 2);
  if (dx * dx + dy * dy < prah * prah) return;
  if (e.timeStamp - GS[o + 4] > 250) { GS[o + 5] = 3; return; }  // pomalý posun nie je švih
  const ax = dx < 0 ? -dx : dx, ay = dy < 0 ? -dy : dy;
  const bok = ay <= TAN35 * ax || (ay < TAN55 * ax && ax >= ay);
  const t = e.timeStamp;
  if (bok) { daj(t, p, 3, dx < 0 ? (p ? 1 : -1) : (p ? -1 : 1)); daj(t, p, 1, 0); GS[o + 5] = 3; }
  else if (dy > 0) { daj(t, p, 2, 1); daj(t, p, 1, 0); GS[o + 5] = 2; }
  else { daj(t, p, 1, 0); GS[o + 5] = 3; }
}
function hore(e) {
  if (U.hore(e, daj)) return;
  const i = slot(e.pointerId); if (i < 0) return;
  const o = i * 6, p = GS[o + 1], st = GS[o + 5];
  if (st === 1 || st === 3) daj(e.timeStamp, p, 1, 0);
  else if (st === 2) daj(e.timeStamp, p, 2, 0);
  GS[o + 5] = 0;
}

let aktivny = () => true;
export function pripoj(prvok, jeAktivny) {
  el = prvok; aktivny = jeAktivny;
  addEventListener('keydown', (e) => klaves(e, true));
  addEventListener('keyup', (e) => klaves(e, false));
  el.addEventListener('pointerdown', dole);
  el.addEventListener('pointermove', pohyb);
  el.addEventListener('pointerup', hore);
  el.addEventListener('pointercancel', hore);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  addEventListener('blur', () => {
    const t = performance.now();
    for (let p = 0; p < 2; p++) { daj(t, p, 1, 0); daj(t, p, 2, 0); daj(t, p, 4, 0); daj(t, p, 5, 0); }
    GS.fill(0); KD.fill(0); U.vycisti();
  });
}
export function rozmer(w, h) { W = w; Hh = h; }
export const _test = { dole, pohyb, hore, fronta: () => { const o = []; for (let i = qh; i !== qt; i = (i + 1) % N) o.push([QT[i], QP[i], QK[i], QV[i]]); return o; } };
