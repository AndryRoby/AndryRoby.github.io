// Tumble Dojo: kresba. Riso (zrno, multiply, registrácia) sa tlačí raz do skrytých plátien; v snímke (// HOT)
// len drawImage, setTransform, globalAlpha a pár ťahov, bez alokácií.
import { Pen, INK } from './riso.js';
import { C, CH, LU, BI, BR, SI, SS, ST, OUT, GI, GH, HD, BP, SPI, SPR, TU } from './sim.js';
import { MENA, POCET, PB, CO, FE, FL, TH, DP, RP, GW, PT, BL, ET, SP, O } from './kombo.js';
import { VEC, KIT0 } from './zaznam.js';
import { dojo, DA } from './dojo.js';

const SY = 0.8, TAU = 6.2832, OPD = O.OP_DUR;
// kit: výzor strán, ink: atrament strany, jeden: len hráč 0 (Kit), znak: meno majstra
export const K = { W: 0, H: 0, dpr: 1, cx: 0, cy: 0, S: 1, rx: 0, ry: 0, koniec: -1, vitaz: -1, dvaja: false, hore: 0, banX: 0, banW: 0, banY: 0, banY1: 0, krok: 0,
  kit: [Object.assign({}, KIT0), { k: 'k1', p: 'p1', b: 'b0', h: 'h0' }], ink: ['orange', 'blue'], dojo: 0, jeden: false, znak: '', znakK: 0, ticho: false };
const P = { telo: [[], []], noha: [], prach: [], tien: null, krug: null, tuk: null, hv: null, hvm: null, ciary: [], oblukT: null, stopa: [], vlna: null, oblukE: [], spir: null, mena: [[], []],
  velke: [[], []], xn: [[], []], fin: [], miss: null, open: [], openK: [[], []], nab: [[], []], nove: [], znak: null, utr: [], dym: null, kruh: null, sv: null };
// banner: [kombinácia (13 MISS), hráč, čas, reťaz, FINISH, trvanie, štítok 1 NEW MOVE, 2 znak majstra]
const BAN = new Float32Array(7);
let bg, rg, fg, g, r, g2;
const RUKA = ['rgb(214,92,56)', 'rgb(54,88,156)'];
export function strany() {
  for (let h = 0; h < 2; h++) {
    const ki = VEC[K.kit[h].k][2], c = INK[ki] || INK.orange;
    K.ink[h] = ki === 'paper' ? 'night' : ki;
    RUKA[h] = ki === 'paper' ? 'rgb(200,192,174)' : 'rgb(' + Math.round(c[0] * 0.88) + ',' + Math.round(c[1] * 0.88) + ',' + Math.round(c[2] * 0.88) + ')';
  }
}
export const inkRGB = (n) => { const c = INK[n] || INK.night; return 'rgb(' + c.join(',') + ')'; };
// ruky podľa pózy: stoj, nabíjanie, výpad, zaprenie, úkrok, vychýlenie, sed, radosť, chmat, dupnutie
const ARM = new Float32Array([0.98, 0.42, 0.62, 0.22, 0, 0, 1.4, -0.06, 1.15, 0.1, 1.1, -0.55, 0.8, 0.55, 0.7, -1.2, 0, 0, 1.2, -0.5]);
const SQ = new Float32Array(4), ODO = new Float32Array(2), LX = new Float32Array(2), LY = new Float32Array(2);
const NP = 64, PR = new Float32Array(NP * 5), NDR = 96, DR = new Float32Array(NDR);
const RC = new Float32Array(13), RS = new Float32Array(13);   // hod: 12 fáz
for (let i = 0; i <= 12; i++) { RC[i] = Math.cos(i * TAU / 12); RS[i] = Math.sin(i * TAU / 12); }
// efekty: [typ, x, y, ux, uy, t, dur, p, e]
const NF = 24, FX = new Float32Array(NF * 9), NN = 8, NM = new Float32Array(NN * 6);
const SPIN = new Float32Array(2), BX = new Float32Array(2), BY = new Float32Array(2);
let nDR = 0, tukT = 0, tukX = 0, tukY = 0, rrPx = -1;

// predtlačený sprite w × h (CSS px) pri hustote d, stred v strede; používa ho aj ovladanie.js
export function sprite(w, h, fn, d = K.dpr) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * d); c.height = Math.ceil(h * d);
  const x = c.getContext('2d');
  x.setTransform(d, 0, 0, d, c.width / 2, c.height / 2);
  const p = new Pen(x); p.scale(d); fn(p, x); p.reset();
  return { c, hw: c.width / d / 2, hh: c.height / d / 2 };
}
const pas = (p, ink, a, x0, y0, x1, y1) => p.poly(ink, a, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);

// vzor tlače kimona (orezaný do elipsy tela)
function vzor(p, v, rx, ry) {
  if (v === 's') for (let i = -5; i <= 5; i++) p.line('night', 0.26, rx * 0.15, [[i * rx * 0.42 - rx, -ry * 1.2], [i * rx * 0.42 + rx, ry * 1.2]]);
  else if (v === 'd') { for (let y = -ry, k = 0; y <= ry; y += rx * 0.24, k++) for (let x = -rx + (k & 1) * rx * 0.12; x <= rx; x += rx * 0.24) p.circle('paper', 1, x, y, rx * 0.045); }
  else if (v === 'c') { for (let y = -ry, k = 0; y <= ry; y += rx * 0.3, k++) for (let x = -rx + (k & 1) * rx * 0.3; x <= rx; x += rx * 0.6) pas(p, 'night', 0.18, x, y, x + rx * 0.3, y + rx * 0.3); }
  else if (v === 'w') { for (let k = 0; k < 3; k++) p.path('paper', 1, (c, ox, oy) => { const y = -ry * 0.1 + k * ry * 0.26; c.moveTo(-rx + ox, y + oy); for (let x = -rx; x <= rx; x += rx * 0.2) c.quadraticCurveTo(x + rx * 0.1 + ox, y - rx * 0.12 + oy, x + rx * 0.2 + ox, y + oy); }, rx * 0.06); }
  else if (v === 'v') { for (let y = -ry * 0.9, k = 0; y <= ry; y += rx * 0.34, k++) for (let x = -rx + (k & 1) * rx * 0.17; x <= rx; x += rx * 0.34) p.line('night', 0.3, rx * 0.05, [[x - rx * 0.07, y - rx * 0.07], [x, y], [x + rx * 0.07, y - rx * 0.07]]); }
}
function kresliTelo(p, x, hrac, tvar, pos) {
  const rx = K.rx, ry = K.ry, kt = K.kit[hrac], ki = VEC[kt.k][2], bi = VEC[kt.b][2], hi = VEC[kt.h][2], dlhe = kt.h === 'h4';
  p.ellipse('paper', 1, 0, 0, rx, ry);
  if (ki === 'paper') p.ellipse('night', 0.17, rx * 0.18, ry * 0.12, rx * 0.86, ry * 0.86);
  else p.ellipse(ki, 1, 0, 0, rx, ry);
  x.save(); x.beginPath(); x.ellipse(0, 0, rx, ry, 0, 0, TAU); x.clip();
  vzor(p, VEC[kt.p][2], rx, ry);
  if (bi === 'paper') { pas(p, 'paper', 1, -rx * 1.2, ry * 0.26, rx * 1.2, ry * 0.5); p.line('night', 0.6, 1, [[-rx * 1.2, ry * 0.27], [rx * 1.2, ry * 0.27]]); p.line('night', 0.6, 1, [[-rx * 1.2, ry * 0.49], [rx * 1.2, ry * 0.49]]); }
  else pas(p, bi, 0.85, -rx * 1.2, ry * 0.26, rx * 1.2, ry * 0.5);
  pas(p, hi, 0.85, -rx * 1.2, -ry * 0.64, rx * 1.2, -ry * 0.5);
  x.restore();
  if (ki === 'paper') p.path('night', 0.9, (c, ox, oy) => c.ellipse(ox, oy, rx - 0.7, ry - 0.7, 0, 0, TAU), 1.4);
  // značka strany vždy: kruh alebo kosoštvorec (na žltom páse s obrysom)
  const mx = (pos - 1) * rx * 0.35, my = ry * 0.38, m = ry * 0.16, n = m * 1.35, zl = bi === 'sun';
  const tv = (c, ox, oy) => { if (hrac) { c.moveTo(mx + ox, my - n + oy); c.lineTo(mx + n + ox, my + oy); c.lineTo(mx + ox, my + n + oy); c.lineTo(mx - n + ox, my + oy); c.closePath(); } else c.arc(mx + ox, my + oy, m, 0, TAU); };
  p.path('paper', 1, tv);
  if (!zl) p.path('sun', 1, tv);
  if (zl || bi === 'paper') p.path('night', 0.8, tv, 1);
  if (!tvar) {                                   // chrbát: uzol čelenky (Long ties dlhé)
    const d = dlhe ? 2.2 : 1;
    p.line(hi, 0.9, rx * 0.12, [[rx * 0.05, -ry * 0.57], [rx * (0.05 + 0.25 * d), -ry * (0.57 - 0.49 * d)]]);
    p.line(hi, 0.9, rx * 0.12, [[rx * 0.05, -ry * 0.57], [rx * (0.05 + 0.45 * d), -ry * (0.57 - 0.37 * d)]]);
    p.circle(hi, 1, rx * 0.05, -ry * 0.57, rx * 0.11);
    return;
  }
  const fx = (pos - 1) * rx * 0.32, ey = -ry * 0.2, ex = rx * 0.3, w = rx * 0.1;
  if (tvar === 2) {                              // námaha
    p.line('night', 1, rx * 0.08, [[fx - ex - w, ey], [fx - ex + w, ey]]);
    p.line('night', 1, rx * 0.08, [[fx + ex - w, ey], [fx + ex + w, ey]]);
    p.line('night', 1, rx * 0.07, [[fx - w, ey + ry * 0.24], [fx + w, ey + ry * 0.24]]);
    return;
  }
  const er = tvar === 3 ? rx * 0.11 : rx * 0.085;
  p.circle('night', 1, fx - ex, ey, er); p.circle('night', 1, fx + ex, ey, er);
  if (tvar === 3) { p.circle('night', 1, fx, ey + ry * 0.26, w); p.circle('paper', 1, fx, ey + ry * 0.26, w / 2); }
  else p.path('night', 1, (c, ox, oy) => c.arc(fx + ox, ey + ry * 0.06 + oy, rx * 0.16, 0.5, 2.64), rx * 0.07);
}
function hviezda(p, R, ink, n) {
  for (let i = 0; i < n; i++) {
    const a = i * TAU / n + 0.2, c = Math.cos(a), s = Math.sin(a);
    p.poly(ink, 1, [[c * R * 0.35 - s * R * 0.07, s * R * 0.35 + c * R * 0.07], [c * R, s * R], [c * R * 0.35 + s * R * 0.07, s * R * 0.35 - c * R * 0.07]]);
  }
  p.circle('paper', 1, 0, 0, R * 0.22); p.circle(ink, 0.8, 0, 0, R * 0.2);
}
// nápis s papierovým okrajom, tieň druhej farby posunutý (registrácia)
function napis(t, fs, ink, tien) {
  const w = t.length * fs * 0.74 + fs * 1.2;
  let tw = 0;
  const sp = sprite(w, fs * 1.9, (p, x) => {
    x.font = '800 ' + fs + 'px "ARLing Sans", system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    tw = x.measureText(t).width / 2;
    x.lineJoin = 'round'; x.lineWidth = fs * 0.36; x.strokeStyle = 'rgb(251,246,234)'; x.strokeText(t, 0, 1);
    if (tien) { const c = p.ink(tien, 0.55); c.fillText(t, fs * 0.07, 1 + fs * 0.08); }
    const c = p.ink(ink, 1); c.fillText(t, 0, 1);
  });
  sp.tw = tw || sp.hw * 0.8;   // polovica šírky textu
  return sp;
}
export function mena() {
  if (!g2) return;
  const fs = Math.round(Math.max(15, Math.min(26, K.rx * 0.42)));
  const fb = Math.max(20, Math.min(K.W < 380 ? 27 : K.W < 700 ? 30 : 34, Math.floor(K.banW / 9.6)));   // zmestí sa PERFECT BRACE x3
  for (let h = 0; h < 2; h++) {
    const ink = K.ink[h], t0 = h ? 'sun' : 'teal', tien = t0 === ink ? (h ? 'teal' : 'sun') : t0;
    P.mena[h].length = 0; P.velke[h].length = 0; P.xn[h].length = 0;
    for (let k = 0; k <= POCET; k++) {
      if (!k) { P.mena[h].push(null); P.velke[h].push(null); continue; }
      P.mena[h].push(napis(MENA[k], fs, ink, null));
      P.velke[h].push(napis(MENA[k], fb, ink, tien));
    }
    for (let n = 0; n <= 6; n++) P.xn[h].push(n < 2 ? null : napis('x' + n, Math.round(fb * (0.62 + n * 0.07)), ink, tien));
    P.fin[h] = napis('COMBO FINISH', Math.round(fb * 0.62), 'night', ink);
    P.open[h] = napis('OPEN', 13, ink, null);
    P.nove[h] = napis('NEW MOVE', Math.round(fb * 0.42), 'night', 'sun');
  }
  P.znak = K.znak ? napis(K.znak + "'s", Math.round(fb * 0.46), K.ink[1], null) : null;
  P.miss = napis('MISS', Math.round(fb * 0.8), 'night', null);
}
export function banner(k, p, n, fin, stitok) {
  BAN[0] = k; BAN[1] = p; BAN[2] = 0; BAN[3] = n > 6 ? 6 : n; BAN[4] = fin ? 1 : 0; BAN[5] = fin ? 1.4 : k === 13 ? 0.7 : 1.2; BAN[6] = stitok || 0;
}
function vykresli(sp, x, y, z, a, rot) { // HOT
  const d = K.dpr;
  g2.globalAlpha = a;
  if (rot) g2.setTransform(-d * z, 0, 0, -d * z, x * d, y * d); else g2.setTransform(d * z, 0, 0, d * z, x * d, y * d);
  g2.drawImage(sp.c, -sp.hw, -sp.hh, sp.hw * 2, sp.hh * 2);
  g2.setTransform(d, 0, 0, d, 0, 0);
}
function bannerKresli(dt) { // HOT
  const k = BAN[0];
  if (!k) return;
  const t = BAN[2], dur = BAN[5], p = BAN[1], rot = K.dvaja && p === 1, fin = BAN[4] > 0;
  const sp = k === 13 ? P.miss : P.velke[p][k];
  const z = t < 0.1 ? 1.35 - 3.5 * t : 1, a = k === 13 ? (t > dur - 0.2 ? (dur - t) * 5 : 0.7) : t > dur - 0.2 ? (dur - t) * 5 : 1;
  const x = K.banX, y = rot ? K.banY1 : K.banY;
  let w = sp.hw;
  if (fin) {   // C3: COMBO FINISH dopadne ako pečiatka, druhá farba posunutá, kým nedosadne
    const f = P.fin[p], yf = rot ? y + sp.hh * 0.95 : y - sp.hh * 0.95, zf = t < 0.08 && !K.ticho ? 1.4 - 5 * t : 1;
    if (t < 0.2 && !K.ticho) vykresli(P.fin[1 - p], x + 2.5, yf + 2, zf, a * 0.5, rot);
    vykresli(f, x, yf, zf, a, rot); if (f.hw > w) w = f.hw;
  } else if (BAN[6] && k !== 13) {
    const f = BAN[6] === 1 ? P.nove[p] : P.znak;
    if (f) vykresli(f, x, rot ? y + sp.hh * 0.9 : y - sp.hh * 0.9, z, a, rot);
  }
  const n = BAN[3];
  if (n >= 2 && k !== 13) {
    const xs = P.xn[p][n], zx = t < 0.14 ? 1.6 - 4.3 * t : 1, a1 = sp.tw * z, a2 = xs.tw * zx, spolu = a1 + a2 + 6, xm = a1 - spolu, xr = spolu - a2;
    vykresli(sp, rot ? x - xm : x + xm, y, z, a, rot);
    vykresli(xs, rot ? x - xr : x + xr, y, zx, a, rot);
    w = spolu + xs.hw;
  } else vykresli(sp, x, y, z, a, rot);
  g2.globalAlpha = 1;
  const hh = sp.hh * (fin || BAN[6] ? 2.3 : 1.3);
  spinave(x - w * 1.4 - 4, y - hh - sp.hh * 0.4, w * 2.8 + 8, hh * 2 + sp.hh * 0.8);
  BAN[2] = t + dt;
  if (t + dt >= dur) BAN[0] = 0;
}

// pasTop: horný okraj tlačidiel; o (diorámy): pravo, stena, S, cx, cy, bezRingu, bezBokov, anim
let O3 = {};
export function priprav(W, H, dpr, hore, dole, pasTop, o) {
  if (!bg) {
    bg = document.getElementById('bg'); rg = document.getElementById('rg'); fg = document.getElementById('fg');
    g = bg.getContext('2d', { alpha: false }); r = rg.getContext('2d'); g2 = fg.getContext('2d');
  }
  O3 = o || {};
  K.W = W; K.H = H; K.dpr = dpr;
  for (const c of [bg, rg, fg]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
  const t = hore, b = dole, Wr = W - (O3.pravo || 0);
  K.S = O3.S || Math.min(Wr / 2.45, (H - t - b) / (2 * 1.2 * SY), 420);
  K.cx = O3.cx || Wr / 2; K.cy = O3.cy || t + (H - t - b) / 2 + K.S * 0.05;
  const rx = K.rx = C.R * K.S * 1.05, ry = K.ry = C.R * K.S * 1.2;
  K.hore = hore;
  // banner: pás nad tlačidlami, inak stĺpec vedľa ringu, inak nad ringom
  const spod = K.cy + K.S * SY * 1.2, pt = pasTop > 0 ? pasTop : H - dole, lavo = K.cx - K.S * 1.2;
  K.banX = W / 2; K.banW = W - 32;
  if (K.dvaja) { K.banY = K.cy + K.S * SY * 0.55; K.banY1 = K.cy - K.S * SY * 0.55; }
  else if (pt - spod >= 56) K.banY = (spod + pt) / 2;
  else if (lavo >= 200) { K.banW = lavo - 24; K.banX = 12 + K.banW / 2; K.banY = K.cy - K.S * SY * 0.35; }
  else K.banY = K.cy - K.S * SY * 0.62;
  tela();
  P.tien =sprite(rx * 2.6, rx * 1.1, (p) => p.ellipse('night', 0.17, 0, 0, rx * 1.2, rx * 0.44));
  P.krug = sprite(rx * 3.4, rx * 1.8, (p) => p.path('sun', 1, (c, ox, oy) => c.ellipse(ox, oy, rx * 1.5, rx * 0.72, 0, 0, TAU), rx * 0.13));
  P.tuk = sprite(rx * 2.2, rx * 2.2, (p) => {
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + 0.2, c = Math.cos(a) * rx, s = Math.sin(a) * rx; p.line('night', 0.9, rx * 0.09, [[c * 0.55, s * 0.55], [c * 0.95, s * 0.95]]); }
    p.circle('sun', 1, 0, 0, rx * 0.3);
  });
  P.hv = sprite(rx * 3.2, rx * 3.2, (p) => hviezda(p, rx * 1.5, 'sun', 8));
  P.hvm = sprite(rx * 1.6, rx * 1.6, (p) => hviezda(p, rx * 0.7, 'sun', 6));
  // oblúková šípka obchvatu, smer príchodu +x
  P.oblukT = sprite(rx * 3.6, rx * 3.6, (p) => {
    p.path('teal', 1, (c, ox, oy) => c.arc(ox, oy, rx * 1.45, 0.35, 2.4), rx * 0.17);
    const a = 2.4, c = Math.cos(a), s = Math.sin(a), X = c * rx * 1.45, Y = s * rx * 1.45;
    p.poly('teal', 1, [[X - s * rx * 0.34, Y + c * rx * 0.34], [X + c * rx * 0.3, Y + s * rx * 0.3], [X + s * rx * 0.34, Y - c * rx * 0.34]]);
  });
  P.vlna = sprite(K.S * 1.3, K.S * 1.3 * SY, (p) => { p.path('sun', 1, (c, ox, oy) => c.ellipse(ox, oy, K.S * 0.6, K.S * 0.6 * SY, 0, 0, TAU), K.S * 0.035); p.path('night', 0.3, (c, ox, oy) => c.ellipse(ox, oy, K.S * 0.52, K.S * 0.52 * SY, 0, 0, TAU), K.S * 0.012); });
  P.spir = sprite(rx * 2.4, rx * 1.6, (p) => p.path('night', 0.4, (c, ox, oy) => { for (let i = 0; i <= 28; i++) { const a = i * 0.45, q = rx * (0.15 + i * 0.035); if (i) c.lineTo(ox + Math.cos(a) * q, oy + Math.sin(a) * q * 0.6); else c.moveTo(ox + q, oy); } }, rx * 0.07));
  P.utr.length = 0;   // útržky COMBO FINISH
  for (const ink of ['sun', 'pink', 'teal']) P.utr.push(sprite(rx * 0.5, rx * 0.5, (p) => p.poly(ink, 1, [[-rx * 0.12, -rx * 0.07], [rx * 0.13, -rx * 0.1], [rx * 0.1, rx * 0.08], [-rx * 0.13, rx * 0.1]])));
  pozadie();
  // animácie diorámy ako vo Village: obláčik dymu, kruh na vode, svetluška
  const s = DA.s;
  P.dym = null;
  if (O3.anim) {
    P.dym = sprite(16 * s, 16 * s, (p) => { p.circle('blue', 0.3, 0, 0, 6.4 * s); p.circle('paper', 0.55, -1.6 * s, -1.9 * s, 3.8 * s); });
    P.kruh = sprite(44 * s, 16 * s, (p) => p.path('paper', 1, (c, ox, oy) => c.ellipse(ox, oy, 20 * s, 7 * s, 0, 0, TAU), 1.1 * s));
    P.sv = sprite(9 * s, 9 * s, (p) => { p.circle('sun', 0.3, 0, 0, 3.4 * s); p.circle('sun', 1, 0, 0, 1.1 * s); });
  }
  rrPx = -1; ring(1); zmaz();
}
// telá a efekty v atramente strany (pri zmene výzoru stačí toto)
export function tela() {
  strany();
  const rx = K.rx, ry = K.ry;
  for (let h = 0; h < 2; h++) {
    const ink = K.ink[h], T = P.telo[h];
    T.length = 0;
    for (let tv = 0; tv <= 3; tv++) for (let pos = tv ? 0 : 1; pos < (tv ? 3 : 2); pos++) T.push(sprite(rx * 2 + 8, ry * 2 + 8, (p, x) => kresliTelo(p, x, h, tv, pos)));
    P.noha[h] = sprite(rx * 0.8, ry * 0.5, (p) => { p.ellipse(ink, 1, 0, 0, rx * 0.32, ry * 0.16); p.ellipse('night', 0.45, 0, 0, rx * 0.32, ry * 0.16); });
    P.prach[h] = sprite(rx * 0.6, rx * 0.4, (p) => p.path(ink, 0.9, (c, ox, oy) => c.ellipse(ox, oy, rx * 0.2, rx * 0.12, 0, 0, TAU), rx * 0.05));
    P.ciary[h] = sprite(rx * 2.2, rx * 1.4, (p) => { for (let i = -1; i <= 1; i++) p.line(ink, 0.9, rx * 0.09, [[-rx * (0.9 - Math.abs(i) * 0.25), i * rx * 0.4], [rx * 0.8, i * rx * 0.4]]); });
    P.stopa[h] = sprite(rx * 4.4, rx * 4.4, (p) => p.path(ink, 0.8, (c, ox, oy) => c.arc(ox, oy, rx * 2, -2.6, 0.2), rx * 0.18));
    P.oblukE[h] = sprite(rx * 3.6, rx * 3.6, (p) => { p.path(ink, 1, (c, ox, oy) => c.arc(ox, oy, rx * 1.5, h ? 3.3 : 0.15, h ? 5.6 : 2.45), rx * 0.16); });
  }
  for (let h = 0; h < 2; h++) {
    const ink = K.ink[h];
    P.nab[h].length = 0;   // krúžok nabíjania, 12 dielov
    for (let i = 1; i <= 12; i++) P.nab[h].push(sprite(rx * 3.2, rx * 1.9, (p) => p.path(ink, 1, (c, ox, oy) => c.ellipse(ox, oy, rx * 1.3, rx * 0.62, 0, -1.5708, -1.5708 + TAU * i / 12), rx * (i === 12 ? 0.16 : 0.11))));
    P.openK[h].length = 0;   // OPEN krúžok sa odmotáva počas okna 0,9 s (C2)
    for (let i = 1; i <= 12; i++) P.openK[h].push(sprite(rx * 3.4, rx * 2, (p, x) => { x.setLineDash([rx * 0.28, rx * 0.16]); p.path(ink, 1, (c, ox, oy) => c.ellipse(ox, oy, rx * 1.4, rx * 0.68, 0, -1.5708, -1.5708 + TAU * i / 12), rx * 0.12); x.setLineDash([]); }));
  }
  mena();
}
function pozadie() {
  const W = K.W, H = K.H, S = K.S, cx = K.cx, cy = K.cy, d = K.dpr;
  g.setTransform(d, 0, 0, d, 0, 0);
  const p = new Pen(g); p.scale(d);
  const el = (c, ox, oy, k, dy = 0) => c.ellipse(cx + ox, cy + oy + dy, S * k, S * SY * k, 0, 0, TAU);
  const stena = O3.stena || Math.max(Math.min(cy - S * SY * 1.45, H * 0.3), H * 0.1);
  dojo(p, K.dojo, W, H, stena, cx, cy, S, W - (O3.pravo || 0), !O3.bezBokov, !!O3.anim);
  if (O3.bezRingu) { p.reset(); return; }   // Kit: postava stojí priamo v dojo
  p.path('paper', 1, (c, ox, oy) => el(c, ox, oy, 1.16));   // papier pod ringom
  p.path('night', 0.13, (c, ox, oy) => el(c, ox, oy, 1.18, S * SY * 0.1));
  p.path('sun', 0.55, (c, ox, oy) => el(c, ox, oy, 1.15));
  p.path('orange', 0.3, (c, ox, oy) => { c.ellipse(cx + ox, cy + oy + S * SY * 0.06, S * 1.15, S * SY * 1.15, 0, 0, 3.1416); c.ellipse(cx + ox, cy + oy, S * 1.15, S * SY * 1.15, 0, 3.1416, 0, true); });
  p.path('sun', 0.3, (c, ox, oy) => el(c, ox, oy, 1));
  g.setLineDash([S * 0.05, S * 0.028]);
  p.path('orange', 1, (c, ox, oy) => el(c, ox, oy, 1), S * 0.036);
  g.setLineDash([]);
  p.path('night', 0.45, (c, ox, oy) => el(c, ox, oy, 1.035), 1.4);
  for (const k of [-1, 1]) p.line('paper', 1, S * 0.018, [[cx - S * 0.08, cy + k * S * SY * 0.12], [cx + S * 0.08, cy + k * S * SY * 0.12]]);
  p.reset();
}
// animácie diorámy do plátna rg (v menu prázdne); hra volá 12x za s (flip book), t v s
export function dioKresli(t) { // HOT
  const d = K.dpr, A = DA.a, s = DA.s;
  r.setTransform(d, 0, 0, d, 0, 0); r.clearRect(0, 0, K.W, K.H);
  if (!P.dym) return;
  for (let i = 0; i < DA.n; i += 4) {
    const x = A[i + 1], y = A[i + 2], v = A[i + 3];
    if (A[i] === 1) for (let k = 0; k < 3; k++) {          // dym
      const f = (t / 3.8 + k / 3 + x * 0.01) % 1, z = 0.28 + f * 0.72, sp = P.dym;
      r.globalAlpha = (1 - f) * (f < 0.2 ? f * 5 : 1);
      r.drawImage(sp.c, x + (f * 10 + Math.sin(f * 6 + x) * 2.4) * s - sp.hw * z, y - f * 32 * s - sp.hh * z, sp.hw * 2 * z, sp.hh * 2 * z);
    } else if (A[i] === 2) for (let k = 0; k < 2; k++) {   // kruhy na vode
      const f = (t / 3.6 + k * 0.5 + x * 0.013) % 1, z = v / (20 * s) * (0.4 + f * 1.1), sp = P.kruh;
      r.globalAlpha = (1 - f) * 0.6;
      r.drawImage(sp.c, x - sp.hw * z, y - sp.hh * z, sp.hw * 2 * z, sp.hh * 2 * z);
    } else {                                                 // svetluška
      const sp = P.sv;
      r.globalAlpha = 0.5 + 0.5 * Math.sin(t * 2.1 + v * 1.7);
      r.drawImage(sp.c, x + (Math.sin(t * 0.37 + v) * 7 + Math.sin(t * 0.91 + v * 2) * 2) * s - sp.hw, y + (Math.cos(t * 0.29 + v * 3) * 3 + Math.sin(t * 1.3 + v)) * s - sp.hh, sp.hw * 2, sp.hh * 2);
    }
  }
  r.globalAlpha = 1;
}

// zmenšovanie ringu po 20 s, prekreslí sa po pol pixeli
export function ring(rr) {
  const S = K.S, px = rr * S;
  if (Math.abs(px - rrPx) < 0.5) return;
  rrPx = px;
  const d = K.dpr, cx = K.cx, cy = K.cy;
  r.setTransform(d, 0, 0, d, 0, 0);
  r.clearRect(cx - S * 1.25, cy - S * SY * 1.3, S * 2.5, S * SY * 2.6);
  if (rr > 0.999) return;
  r.fillStyle = 'rgba(244,236,217,0.62)';
  r.beginPath(); r.ellipse(cx, cy, S * 1.2, S * SY * 1.2, 0, 0, TAU); r.ellipse(cx, cy, px, px * SY, 0, 0, TAU); r.fill('evenodd');
  r.strokeStyle = 'rgb(226,98,58)'; r.lineWidth = S * 0.032; r.setLineDash([S * 0.05, S * 0.028]);
  r.beginPath(); r.ellipse(cx, cy, px, px * SY, 0, 0, TAU); r.stroke(); r.setLineDash([]);
}

function prach(X, Y, n, sila, faz) {
  for (let i = 0, k2 = 0; i < NP && k2 < n; i++) {
    const k = i * 5;
    if (PR[k + 4] > 0) continue;
    const a = k2 * TAU / n + faz, c = Math.cos(a), sn = Math.sin(a) * SY;
    PR[k] = X + c * K.rx * 0.8; PR[k + 1] = Y + sn * K.rx * 0.8; PR[k + 2] = c * K.S * sila; PR[k + 3] = sn * K.S * sila; PR[k + 4] = 0.45; k2++;
  }
}
// náraz: sploštenie, prach, značka tuk
export function naraz(s) {
  const X = K.cx + s.hx * K.S, Y = K.cy + s.hy * K.S * SY, q = Math.min(0.22, 0.06 + s.hv * 0.06);
  tukT = 0.16; tukX = X; tukY = Y - K.ry;
  SQ[0] = SQ[2] = q; SQ[1] = SQ[3] = 0;
  prach(X, Y, 10, 0.9, s.hit * 0.37);
}
function efekt(typ, x, y, ux, uy, dur, p, e) {
  let j = 0, tmax = -1;
  for (let i = 0; i < NF; i++) { const o = i * 9; if (!FX[o]) { j = i; tmax = 99; break; } if (FX[o + 5] > tmax) { tmax = FX[o + 5]; j = i; } }
  const o = j * 9;
  FX[o] = typ; FX[o + 1] = x; FX[o + 2] = y; FX[o + 3] = ux; FX[o + 4] = uy; FX[o + 5] = 0; FX[o + 6] = dur; FX[o + 7] = p; FX[o + 8] = e;
}
// kombinácia: malé meno pri postave a animácia (súradnice ringu)
export function kombo(k, p, s) {
  const m = p ? s.b : s.a, o = p ? s.a : s.b;
  let dx = o.x - m.x, dy = o.y - m.y; const d = Math.sqrt(dx * dx + dy * dy) || 1; dx /= d; dy /= d;
  const mx = (m.x + o.x) / 2, my = (m.y + o.y) / 2;
  const q = p * 6; NM[q] = k; NM[q + 1] = p; NM[q + 2] = m.x; NM[q + 3] = m.y; NM[q + 4] = 0; NM[q + 5] = 0;
  if (k === PB) efekt(1, m.x + dx * C.R, m.y + dy * C.R, 0, 0, 0.22, p, 1);
  else if (k === CO) { efekt(2, 0, 0, m.fx, m.fy, 0.3, p, 0); efekt(5, mx, my, 0, 0, 0.2, p, 0); efekt(5, mx + dy * 0.05, my - dx * 0.05, 0, 0, 0.25, p, 0.05); }
  else if (k === FE) efekt(11, m.x, m.y, 0, 0, 0.25, p, 0);
  else if (k === FL) { efekt(3, o.x, o.y, -dx, -dy, 0.35, p, 0); efekt(1, mx, my, 0, 0, 0.2, p, 0.7); }
  else if (k === TH) { SPIN[1 - p] = 0.35; efekt(4, m.x, m.y, dx, dy, 0.4, 1 - p, 0); }
  else if (k === DP) efekt(5, mx, my, 0, 0, 0.18, p, 0);
  else if (k === RP) efekt(2, 0, 0, m.fx, m.fy, 0.35, p, 0);
  else if (k === GW) { efekt(6, m.x, m.y, dx, dy, 0.4, p, 0); prach(K.cx + m.x * K.S, K.cy + m.y * K.S * SY, 8, 0.5, 0.3); }
  else if (k === PT) { efekt(4, o.x, o.y, dx, dy, 0.35, 1 - p, 0); efekt(5, mx, my, 0, 0, 0.18, p, 0); }
  else if (k === BL) prach(K.cx + o.x * K.S, K.cy + o.y * K.S * SY, 8, 0.6, 1.1);
  else if (k === ET) efekt(9, mx, my, 0, 0, 0.3, p, 0);
  else if (k === SP) efekt(12, m.x, m.y, 0, 0, 0.35, p, 0);
}
export function utrzky(x, y) { if (!K.ticho) efekt(13, x, y, 0, 0, 0.6, 0, 0); }
export function vlna(s) { efekt(10, s.vx, s.vy, 0, 0, 0.4, 0, 0); prach(K.cx + s.vx * K.S, K.cy + s.vy * K.S * SY, 12, 0.8, 0.2); }

function spinave(x, y, w, h) { // HOT
  if (nDR < NDR) { DR[nDR] = x; DR[nDR + 1] = y; DR[nDR + 2] = w; DR[nDR + 3] = h; nDR += 4; }
}
function ruky(X, y0, y1, sxr, hx, hy, hx2, hy2) { // HOT
  g2.beginPath(); g2.moveTo(X + sxr, y0); g2.lineTo(X + hx, y1 + hy); g2.moveTo(X - sxr, y0); g2.lineTo(X + hx2, y1 + hy2); g2.stroke();
}
// sprite otočený o smer (ux, uy) okolo (x, y)
function otocene(sp, x, y, ux, uy, a) { // HOT
  const d = K.dpr;
  g2.globalAlpha = a;
  g2.setTransform(d * ux, d * uy, -d * uy, d * ux, x * d, y * d);
  g2.drawImage(sp.c, -sp.hw, -sp.hh, sp.hw * 2, sp.hh * 2);
  g2.setTransform(d, 0, 0, d, 0, 0);
}

function postava(m, o, h, a, cas, konec, dt) { // HOT
  const rx = K.rx, ry = K.ry, st = m.st, k2 = h * 2;
  SQ[k2 + 1] += (-SQ[k2] * 900 - SQ[k2 + 1] * 14) * dt; SQ[k2] += SQ[k2 + 1] * dt;
  const ddx = m.x - LX[h], ddy = m.y - LY[h];
  ODO[h] += Math.sqrt(ddx * ddx + ddy * ddy); LX[h] = m.x; LY[h] = m.y;
  const X = K.cx + (m.px + (m.x - m.px) * a) * K.S, Yb = K.cy + (m.py + (m.y - m.py) * a) * K.S * SY + ry * 0.12;
  BX[h] = X; BY[h] = Yb;
  let sx = 1, sy = 1, oy = 0, ox = 0, tvar = 1, ar = 0, noha = 0;
  if (st === CH) { const f = m.ch / C.CH1; sx = 1 + 0.18 * f; sy = 1 - 0.18 * f; tvar = 2; ar = 1; }
  else if (st === LU) { sx = 0.92; sy = 1.12; ar = 2; if (m.lk === RP) { sx = 0.88; sy = 1.15; } }
  else if (st === BI || st === BR) { sx = 1.22; sy = 0.85; tvar = 2; ar = 3; if (m.gwAt > -9999 && st === BI) { sx = 1.1; sy = 0.9; } }
  else if (st === SI || st === SS) { const u = st === SS ? m.t / C.SST : 0; oy = -ry * 1.6 * u * (1 - u); ar = 4; }
  else if (st === ST) { ox = Math.sin(cas * 38) * rx * 0.09; tvar = 3; ar = 5; }
  else if (st === OUT) { sx = 1.1; sy = 0.82; tvar = 3; ar = 6; if (konec > 0.4) { sy = 0.82 - 0.14 * Math.sin(Math.min(konec - 0.4, 0.8) * 3.9); tvar = 1; } }
  else if (st === GI) { sx = 0.95; sy = 1.06; tvar = 2; ar = 8; }
  else if (st === GH || st === BP) { sx = st === BP ? 0.9 : 1.05; sy = st === BP ? 1.1 : 0.97; tvar = 2; ar = 8; }
  else if (st === HD) { ox = Math.sin(cas * 22) * rx * 0.05; tvar = 3; ar = 5; }
  else if (st === SPI) { const f = m.t / 42; sx = 1 - 0.06 * f; sy = 1 + 0.06 * f; ox = rx * 0.12 * f; tvar = 2; ar = 9; noha = f; }
  else if (st === SPR) { const f = m.t < 8 ? 1 - m.t / 8 : 0; sx = 1 + 0.2 * f; sy = 1 - 0.16 * f; tvar = 2; ar = 3; }
  else if (st === TU) { ar = 4; tvar = 3; }
  else sy = 1 + 0.02 * Math.sin(cas * 3 + h * 2);
  if (konec > 0 && K.vitaz === h) {   // víťaz sa 1 s teší, potom sa tiež ukloní
    if (konec < 1) { oy = -Math.abs(Math.sin(konec * 7)) * ry * 0.35; ar = 7; }
    else { const f = konec - 1 < 0.8 ? konec - 1 : 0.8; sy = 1 - 0.16 * Math.sin(f * 3.9); sx = 1.04; tvar = 1; ar = 0; }
  }
  sx *= 1 + SQ[k2]; sy *= 1 - SQ[k2];
  const zad = m.fy < -0.35 && st !== OUT;
  const sp = P.telo[h][zad ? 0 : 1 + (tvar - 1) * 3 + (m.fx < -0.4 ? 0 : m.fx > 0.4 ? 2 : 1)];
  const Xb = X + ox, Yt = Yb + oy, t = P.tien, kg = P.krug, n = P.noha[h];
  g2.drawImage(t.c, X - t.hw, Yb - t.hh, t.hw * 2, t.hh * 2);
  if (st === CH) { const nb = P.nab[h][Math.min(11, Math.floor(12 * m.ch / C.CH1))]; g2.drawImage(nb.c, X - nb.hw, Yb - nb.hh, nb.hw * 2, nb.hh * 2); }
  if (m.opU >= K.krok) {
    const zo = m.opU - K.krok, ok = P.openK[1 - h][zo >= OPD ? 11 : Math.floor(12 * zo / OPD)], ol = P.open[1 - h];
    g2.globalAlpha = 0.75 + 0.25 * Math.sin(cas * 18);
    g2.drawImage(ok.c, X - ok.hw, Yb - ok.hh, ok.hw * 2, ok.hh * 2);
    g2.drawImage(ol.c, X - ol.hw, Yb + ry * 0.62 - ol.hh, ol.hw * 2, ol.hh * 2);
    g2.globalAlpha = 1;
    spinave(X - ok.hw, Yb - ok.hh, ok.hw * 2, ok.hh + ry * 0.62 + ol.hh * 2);
  }
  if (m.rov > 0 || st === ST) { g2.globalAlpha = m.rov > 0 ? 0.35 + 0.65 * m.rov / m.stD : 0.35; g2.drawImage(kg.c, X - kg.hw, Yb - kg.hh, kg.hw * 2, kg.hh * 2); g2.globalAlpha = 1; }
  if (SPIN[h] > 0) {   // hod: telo sa pretočí o 360° za 0,35 s
    const f = 1 - SPIN[h] / 0.35, i = Math.floor(f * 12) % 12, d = K.dpr, cy = Yt - ry * sy;
    SPIN[h] -= dt;
    g2.setTransform(d * RC[i], d * RS[i], -d * RS[i], d * RC[i], Xb * d, cy * d);
    g2.drawImage(sp.c, -sp.hw * sx, -sp.hh * sy, sp.hw * 2 * sx, sp.hh * 2 * sy);
    g2.setTransform(d, 0, 0, d, 0, 0);
    spinave(X - rx * 2.1, Yb - ry * 3.1, rx * 4.2, ry * 3.9);
    return;
  }
  const kr = Math.sin(ODO[h] * 26) * rx * 0.18, zdvih = noha * ry * 0.9;
  g2.drawImage(n.c, Xb - rx * 0.5 - n.hw + kr * 0.3, Yt - n.hh - (kr > 0 ? kr * 0.5 : 0), n.hw * 2, n.hh * 2);
  g2.drawImage(n.c, Xb + rx * 0.5 - n.hw - kr * 0.3 + zdvih * 0.3, Yt - n.hh - (kr < 0 ? -kr * 0.5 : 0) - zdvih, n.hw * 2, n.hh * 2);
  // ruky: zozadu pred telom, spredu po ňom; pri chmate k pásu súpera (do boku spoza tela)
  const y1 = Yt - ry * sy, y0 = y1 + ry * sy * 0.1, sxr = rx * sx * 0.78;
  let hx = rx * ARM[ar * 2], hy = ry * ARM[ar * 2 + 1], hx2 = -hx, hy2 = hy, zaTelom = zad;
  if (ar === 2) { hx = (m.fx * 1.1 + 0.35) * rx; hx2 = hx - rx * 0.7; hy = hy2 = m.fy * ry * 0.9; }
  else if (ar === 5) { hy += ox; hy2 -= ox; }
  else if (ar === 8) {
    const dx = (o.x - m.x) * K.S, dy = (o.y - m.y) * K.S * SY, dd = Math.sqrt(dx * dx + dy * dy) || 1;
    const dos = st === GI ? rx * (0.8 + 0.6 * m.t / 14) : dd - rx * 0.6;
    hx = dx / dd * dos + rx * 0.2; hx2 = dx / dd * dos - rx * 0.2; hy = hy2 = dy / dd * dos + ry * 0.95;
    if (dy < 0 || (dx < 0 ? -dx : dx) > dy) zaTelom = true;
  }
  g2.strokeStyle = RUKA[h]; g2.lineWidth = rx * 0.26; g2.lineCap = 'round';
  if (zaTelom) ruky(Xb, y0, y1, sxr, hx, hy, hx2, hy2);
  g2.drawImage(sp.c, Xb - sp.hw * sx, Yt - (ry + sp.hh) * sy, sp.hw * 2 * sx, sp.hh * 2 * sy);
  if (!zaTelom) ruky(Xb, y0, y1, sxr, hx, hy, hx2, hy2);
  if (st === BP && ((cas * 20) | 0) % 3 === 0) prachJeden(X, Yb, h);
  const hore = oy < 0 ? oy : 0;
  spinave(X - rx * 2.4, Yb - ry * 3.3 + hore, rx * 4.8, ry * 4.1 - hore);
}
function prachJeden(X, Y, h) { // HOT
  for (let i = 0; i < NP; i++) {
    const k = i * 5;
    if (PR[k + 4] > 0) continue;
    PR[k] = X + (h ? -1 : 1) * K.rx * 0.5; PR[k + 1] = Y; PR[k + 2] = 0; PR[k + 3] = K.S * 0.05; PR[k + 4] = 0.3;
    return;
  }
}

// efekty pod telami (vlna, stopa, duch finty) a nad nimi
function efekty(s, dt, nad) { // HOT
  const S = K.S, rx = K.rx;
  for (let i = 0; i < NF; i++) {
    const o = i * 9, typ = FX[o];
    if (!typ) continue;
    const pod = typ === 10 || typ === 4 || typ === 11;
    if (pod === nad) continue;
    const t = FX[o + 5], dur = FX[o + 6], f = t / dur, p = FX[o + 7];
    if (t < 0) { FX[o + 5] = t + dt; continue; }
    const X = K.cx + FX[o + 1] * S, Y = K.cy + FX[o + 2] * S * SY;
    let ux = FX[o + 3], uy = FX[o + 4] * SY; const ul = Math.sqrt(ux * ux + uy * uy) || 1; ux /= ul; uy /= ul;
    let w = rx * 3;
    if (typ === 1 || typ === 5) {                      // hviezda
      const sp = typ === 1 ? P.hv : P.hvm, z = 0.5 + f * (typ === 1 ? 0.9 : 0.6);
      g2.globalAlpha = f < 0.6 ? 1 : (1 - f) * 2.5;
      g2.drawImage(sp.c, X - sp.hw * z, Y - K.ry - sp.hh * z, sp.hw * 2 * z, sp.hh * 2 * z);
      w = sp.hw * 1.6;
    } else if (typ === 2) {                            // čiary rýchlosti
      const bx = BX[p] - ux * rx * 1.6, by = BY[p] - K.ry - uy * rx * 1.6;
      otocene(P.ciary[p], bx, by, ux, uy, 1 - f);
      spinave(bx - rx * 1.4, by - rx * 1.4, rx * 2.8, rx * 2.8);
    } else if (typ === 3) {                            // šípka obchvatu
      otocene(P.oblukT, X, Y - K.ry, ux, uy, f < 0.7 ? 1 : (1 - f) * 3.3);
    } else if (typ === 4) {                            // stopa hodu
      otocene(P.stopa[p], X, Y - K.ry, ux, uy, (1 - f) * 0.9);
      w = rx * 4.4;
    } else if (typ === 6) {                            // špirála prachu
      g2.globalAlpha = 1 - f; const z = 0.7 + f * 0.6, sp = P.spir;
      g2.drawImage(sp.c, X - sp.hw * z, Y - sp.hh * z, sp.hw * 2 * z, sp.hh * 2 * z);
    } else if (typ === 9) {                            // oblúky otočky
      const a = f * 3.1416, c = Math.cos(a), sn = Math.sin(a);
      otocene(P.oblukE[0], X, Y - K.ry, c, sn, 1 - f * 0.6); otocene(P.oblukE[1], X, Y - K.ry, c, sn, 1 - f * 0.6);
      w = rx * 3.6;
    } else if (typ === 10) {                           // vlna dupnutia
      const sp = P.vlna, z = 0.25 + f * 0.95;
      g2.globalAlpha = f < 0.5 ? 1 : (1 - f) * 2;
      g2.drawImage(sp.c, X - sp.hw * z, Y - sp.hh * z, sp.hw * 2 * z, sp.hh * 2 * z);
      w = sp.hw * 1.25;
    } else if (typ === 11) {                           // duch finty
      const sp = P.telo[p][5];
      g2.globalAlpha = 0.35 * (1 - f);
      g2.drawImage(sp.c, X - sp.hw * 1.15, Y + K.ry * 0.12 - (K.ry + sp.hh) * 0.87, sp.hw * 2.3, sp.hh * 1.74);
    } else if (typ === 13) {                           // útržky COMBO FINISH
      for (let k = 0; k < 14; k++) {
        const u = RC[k % 12], v = RS[k % 12], sp = P.utr[k % 3], rch = rx * (2.2 + (k * 7 % 5) * 0.5);
        g2.globalAlpha = f < 0.7 ? 1 : (1 - f) * 3.3;
        g2.drawImage(sp.c, X + u * rch * f - sp.hw, Y - K.ry + v * rch * f * 0.7 + rx * 4 * f * f - sp.hh, sp.hw * 2, sp.hh * 2);
      }
      w = rx * 6;
    } else if (typ === 12) {                           // nádych dupnutia
      g2.globalAlpha = 1 - f; const sp = P.prach[p];
      g2.drawImage(sp.c, BX[p] - rx * 0.9, BY[p] - sp.hh, sp.hw * 2, sp.hh * 2);
      g2.drawImage(sp.c, BX[p] + rx * 0.3, BY[p] - sp.hh, sp.hw * 2, sp.hh * 2);
      spinave(BX[p] - rx * 1.2, BY[p] - rx, rx * 2.6, rx * 2);
    }
    g2.globalAlpha = 1;
    if (typ !== 2 && typ !== 12) spinave(X - w, Y - K.ry - w, w * 2, w * 2 + K.ry);
    FX[o + 5] = t + dt;
    if (t + dt >= dur) FX[o] = 0;
  }
}
function menaKresli(dt) { // HOT
  for (let i = 0; i < NN; i++) {
    const q = i * 6, k = NM[q];
    if (!k) continue;
    const t = NM[q + 4], p = NM[q + 1], sp = P.mena[p][k], hore = K.dvaja && p === 1;
    const Yb = BY[p] - K.ry * 0.12, stup = t / 0.9 * 12;
    let X = BX[p]; if (X < sp.hw) X = sp.hw; else if (X > K.W - sp.hw) X = K.W - sp.hw;
    // nad hlavou; horný hráč pri dvoch otočené; pri hornom povraze pod nohy
    let Y = hore ? Yb + K.ry * 1.7 + stup : Yb - K.ry * 2.7 - stup;
    if (!hore && Y - sp.hh < K.hore + 4) Y = Yb + K.ry * 0.95 + sp.hh;
    let a = t < 0.12 ? t / 0.12 : t < 0.55 ? 1 : (0.9 - t) / 0.35;
    if (a < 0) a = 0;
    if (hore) otocene(sp, X, Y, -1, 0, a);
    else { g2.globalAlpha = a; g2.drawImage(sp.c, X - sp.hw, Y - sp.hh, sp.hw * 2, sp.hh * 2); }
    g2.globalAlpha = 1;
    spinave(X - sp.hw, Y - sp.hh - 14, sp.hw * 2, sp.hh * 2 + 28);
    NM[q + 4] = t + dt;
    if (t + dt >= 0.9) NM[q] = 0;
  }
}

// a = interpolácia medzi krokmi fyziky, dt = čas od poslednej snímky
export function snimka(s, a, cas, dt, konec) { // HOT
  const d = K.dpr, pw = P.prach[0].hw * 2;
  K.krok = s.step;
  g2.setTransform(d, 0, 0, d, 0, 0);
  for (let i = 0; i < nDR; i += 4) g2.clearRect(DR[i] - 2, DR[i + 1] - 2, DR[i + 2] + 4, DR[i + 3] + 4);
  nDR = 0;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (let i = 0; i < NP; i++) {
    const k = i * 5, l = PR[k + 4];
    if (l <= 0) continue;
    const f = 1 - 7 * dt, sp = P.prach[i & 1], z = 0.7 + (0.45 - l) * 2.2;
    PR[k] += PR[k + 2] * dt; PR[k + 1] += PR[k + 3] * dt; PR[k + 2] *= f; PR[k + 3] *= f; PR[k + 4] = l - dt;
    g2.globalAlpha = l * 2.5 > 1 ? 1 : l * 2.5;
    g2.drawImage(sp.c, PR[k] - sp.hw * z, PR[k + 1] - sp.hh * z, sp.hw * 2 * z, sp.hh * 2 * z);
    x0 = Math.min(x0, PR[k] - pw); x1 = Math.max(x1, PR[k] + pw); y0 = Math.min(y0, PR[k + 1] - pw); y1 = Math.max(y1, PR[k + 1] + pw);
  }
  g2.globalAlpha = 1;
  efekty(s, dt, false);
  const pa = s.a.y > s.b.y;
  if (K.jeden) postava(s.a, s.b, 0, a, cas, konec, dt);
  else { postava(pa ? s.b : s.a, pa ? s.a : s.b, pa ? 1 : 0, a, cas, konec, dt); postava(pa ? s.a : s.b, pa ? s.b : s.a, pa ? 0 : 1, a, cas, konec, dt); }
  efekty(s, dt, true);
  menaKresli(dt);
  bannerKresli(dt);
  if (tukT > 0) {
    const t = P.tuk;
    g2.globalAlpha = tukT / 0.16; tukT -= dt;
    g2.drawImage(t.c, tukX - t.hw, tukY - t.hh, t.hw * 2, t.hh * 2);
    g2.globalAlpha = 1;
    x0 = Math.min(x0, tukX - t.hw); x1 = Math.max(x1, tukX + t.hw); y0 = Math.min(y0, tukY - t.hh); y1 = Math.max(y1, tukY + t.hh);
  }
  if (x1 > x0) spinave(x0, y0, x1 - x0, y1 - y0);
}

// DOM plátno n × n CSS px so stredom v strede (vzorky a ikony)
function platno(cv, n) {
  const d = Math.min(2, (typeof devicePixelRatio !== 'undefined' && devicePixelRatio) || 1);
  cv.width = cv.height = Math.round(n * d);
  const x = cv.getContext('2d'); x.setTransform(d, 0, 0, d, n * d / 2, n * d / 2);
  const p = new Pen(x); p.scale(d);
  return [p, x];
}
// vzorka výzoru (Kit, koniec): vytlačený kruh, zamknutá len prerušovaný obrys
export function vzorka(cv, id, kimono, zamk) {
  const n = cv.clientWidth || 56, R = n / 2 - 3, [p, x] = platno(cv, n);
  if (zamk) { x.setLineDash([4, 4]); p.path('night', 0.55, (c, ox, oy) => c.arc(ox, oy, R, 0, TAU), 2); x.setLineDash([]); p.reset(); return; }
  const v = VEC[id], s = id[0], ki = VEC[kimono][2];
  x.save(); x.beginPath(); x.arc(0, 0, R, 0, TAU); x.clip();
  if (s === 'k') { if (v[2] === 'paper') p.circle('night', 0.12, 3, 3, R); else p.circle(v[2], 1, 0, 0, R); }
  else if (s === 'p') { p.circle(ki === 'paper' ? 'sun' : ki, ki === 'paper' ? 0.25 : 1, 0, 0, R); vzor(p, v[2], R * 0.9, R); }
  else if (s === 'b') { pas(p, v[2], v[2] === 'paper' ? 1 : 0.9, -R, -R * 0.2, R, R * 0.2); p.line('night', 0.5, 1, [[-R, -R * 0.2], [R, -R * 0.2]]); p.line('night', 0.5, 1, [[-R, R * 0.2], [R, R * 0.2]]); }
  else { pas(p, v[2], 0.9, -R, -R * 0.14, R, R * 0.14); p.circle(v[2], 1, R * 0.5, R * 0.2, R * 0.2); if (id === 'h4') for (const k of [0.4, 0.75]) p.line(v[2], 0.9, 3, [[R * 0.5, R * 0.2], [R * (0.2 + k), R]]); }
  x.restore();
  p.path('night', 0.8, (c, ox, oy) => c.arc(ox, oy, R, 0, TAU), 1.6);
  p.reset();
}
// C5 znak kombinácie: tvar ako efekt v zápase, farba tlačidla, ktorým začína (Brace, Lunge, Step, Grab, Stomp)
const IK = ['', 'teal', 'teal', 'plum', 'plum', 'blue', 'orange', 'orange', 'teal', 'blue', 'blue', 'plum', 'sun'];
function hrot(p, ink, x, y, ux, uy, w) { p.poly(ink, 1, [[x + ux * w, y + uy * w], [x - uy * w * 0.8 - ux * w * 0.4, y + ux * w * 0.8 - uy * w * 0.4], [x + uy * w * 0.8 - ux * w * 0.4, y - ux * w * 0.8 - uy * w * 0.4]]); }
function oblukH(p, ink, R, a0, a1, cy, w) {   // oblúk okolo (0, cy) so šípkou na konci
  p.path(ink, 1, (c, ox, oy) => c.arc(ox, cy + oy, R, a0, a1), w);
  const c = Math.cos(a1), s = Math.sin(a1); hrot(p, ink, c * R, cy + s * R, -s, c, w * 1.6);
}
export function ikona(cv, k, n) {
  const [p, x] = platno(cv, n), u = n * 0.44, ink = IK[k];
  if (k === PB) hviezda(p, u, ink, 8);
  else if (k === CO) { p.line('night', 0.8, u * 0.18, [[-u * 0.8, -u * 0.75], [-u * 0.8, u * 0.75]]); p.line(ink, 1, u * 0.24, [[-u * 0.5, 0], [u * 0.3, 0]]); hrot(p, ink, u * 0.3, 0, 1, 0, u * 0.5); }
  else if (k === FE) { x.setLineDash([u * 0.22, u * 0.16]); p.path(ink, 0.7, (c, ox, oy) => c.arc(ox - u * 0.4, oy, u * 0.42, 0, TAU), u * 0.13); x.setLineDash([]); p.circle(ink, 1, u * 0.42, 0, u * 0.44); }
  else if (k === FL) { p.circle('night', 0.75, 0, u * 0.25, u * 0.3); oblukH(p, ink, u * 0.66, 3.3, 5.9, u * 0.25, u * 0.2); }
  else if (k === TH) { p.circle('night', 0.75, 0, 0, u * 0.24); oblukH(p, ink, u * 0.68, 0.5, 5.4, 0, u * 0.2); }
  else if (k === DP) for (const o of [-0.35, 0.3]) p.line(ink, 1, u * 0.24, [[(o - 0.3) * u, -u * 0.55], [(o + 0.2) * u, 0], [(o - 0.3) * u, u * 0.55]]);
  else if (k === RP) { for (const y of [-0.45, 0, 0.45]) p.line(ink, 0.6, u * 0.14, [[-u * (0.9 - Math.abs(y) * 0.4), y * u], [-u * 0.2, y * u]]); p.line(ink, 1, u * 0.24, [[u * 0.05, -u * 0.55], [u * 0.55, 0], [u * 0.05, u * 0.55]]); }
  else if (k === GW) p.path(ink, 1, (c, ox, oy) => { for (let i = 0; i <= 22; i++) { const a = i * 0.5, q = u * (0.1 + i * 0.036); if (i) c.lineTo(ox + Math.cos(a) * q, oy + Math.sin(a) * q); else c.moveTo(ox + q, oy); } }, u * 0.16);
  else if (k === PT) { p.circle('night', 0.75, -u * 0.15, -u * 0.42, u * 0.28); p.line(ink, 1, u * 0.22, [[-u * 0.9, u * 0.05], [-u * 0.1, u * 0.05], [u * 0.35, u * 0.42]]); hrot(p, ink, u * 0.35, u * 0.42, 0.78, 0.63, u * 0.45); }
  else if (k === BL) { pas(p, ink, 0.9, -u * 0.9, -u * 0.2, u * 0.2, u * 0.2); for (const y of [-0.2, 0.2]) p.line('night', 0.5, 1, [[-u * 0.9, y * u], [u * 0.2, y * u]]); hrot(p, ink, u * 0.3, 0, 1, 0, u * 0.6); }
  else if (k === ET) { oblukH(p, ink, u * 0.62, 3.6, 5.8, 0, u * 0.2); oblukH(p, ink, u * 0.62, 0.46, 2.66, 0, u * 0.2); }
  else { hrot(p, 'night', 0, -u * 0.25, 0, 1, u * 0.45); p.path(ink, 1, (c, ox, oy) => c.ellipse(ox, oy + u * 0.4, u * 0.85, u * 0.34, 0, 0, TAU), u * 0.18); p.path('night', 0.45, (c, ox, oy) => c.ellipse(ox, oy + u * 0.4, u * 0.5, u * 0.18, 0, 0, TAU), u * 0.1); }
  p.reset();
}
export function zmaz() {
  g2.setTransform(1, 0, 0, 1, 0, 0); g2.clearRect(0, 0, fg.width, fg.height); nDR = 0;
  for (let i = 0; i < NP; i++) PR[i * 5 + 4] = 0;
  FX.fill(0); NM.fill(0); SPIN.fill(0); BAN[0] = 0;
  tukT = 0; SQ.fill(0);
}
export function polohy(s) { LX[0] = s.a.x; LY[0] = s.a.y; LX[1] = s.b.x; LY[1] = s.b.y; }
