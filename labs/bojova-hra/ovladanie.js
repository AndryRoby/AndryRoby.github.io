// Tumble Dojo: ovládanie na telefóne (joystick vľavo, oblúk tlačidiel vpravo), v snímke len drawImage pri zmene.
import { sprite as spr } from './kresba.js';
import { VIB } from './kombo.js';

export const nastavenie = { controls: 'buttons', keys: 'dojo', size: 'M', opacity: 1, left: false, vib: true, sound: true };
const VEL = { S: 0.85, M: 1, L: 1.2 };
// V2-NAVRH 1.3 (na výšku, M): [id, priemer, stred sprava, stred zdola, atrament]
const TL = [['lunge', 88, 70, 84, 'orange'], ['brace', 68, 166, 60, 'teal'], ['step', 60, 150, 150, 'plum'], ['grab', 60, 66, 184, 'blue'], ['special', 52, 146, 234, 'sun']];
const TL2 = { lunge: 64, brace: 50, step: 48, grab: 48, special: 44 };
const IDX = { lunge: 0, brace: 1, step: 2, grab: 3, special: 4, stick: 5 };

export function kvant(v) { const a = Math.round((v < 0 ? -v : v) * 127), x = a > 127 ? 127 : a; return v < 0 ? -x : x; }
// hráč dole: vpravo +x, hore -y ringu; horný otočený hráč: obe znamienka opačne
export function doRingu(p, vx, vy) { return p ? [kvant(-vx), kvant(-vy)] : [kvant(vx), kvant(vy)]; }

let LK = '', LC = [], IN = { t: 0, b: 0, l: 0, r: 0 };
export function okraje(t, b, l, r) { IN = { t, b, l, r }; LK = ''; }
export function rozlozenie(W, H, rezim) {
  const key = W + 'x' + H + rezim + nastavenie.size + nastavenie.left + IN.t + IN.b + IN.l + IN.r;
  if (key === LK) return LC;
  const land = W > H, two = rezim === 'tel2', sz = VEL[nastavenie.size] || 1, min = two ? 44 : 48;
  const kp = (two ? 0.72 : land ? 0.9 : 1) * (sz > 1 ? sz : 1);
  const L = [];
  for (let p = 0; p < (two ? 2 : 1); p++) {
    const zac = L.length;
    let minX = 1e9;
    for (const [id, d0, pr, zd, ink] of TL) {
      let d = (two ? TL2[id] : d0 * (land ? 0.9 : 1)) * sz; if (d < min) d = min;
      const x = W - IN.r - pr * kp, y = H - IN.b - zd * kp;
      L.push({ id, p, x, y, r: d / 2, ink, i: IDX[id] });
      if (x - d / 2 < minX) minX = x - d / 2;
    }
    // duch joysticku: zmenší sa, ak by siahal k tlačidlám
    let rs = (two ? 46 : 64) * (land ? 0.9 : 1) * (sz > 1 ? sz : 1);
    const volno = (minX - 8 - 24 - IN.l) / 2; if (rs > volno) rs = volno;
    L.push({ id: 'stick', p, x: IN.l + 24 + rs, y: H - IN.b - 24 - rs, r: rs, ink: 'night', i: 5 });
    for (let k = zac; k < L.length; k++) {
      const c = L[k];
      if (nastavenie.left) c.x = W - c.x;
      if (p === 1) { c.x = W - c.x; c.y = H - c.y; }
    }
  }
  LK = key; LC = L;
  return L;
}

// výška pásu ovládania dole
export function vyskaPasu(W, H, rezim) {
  const L = rozlozenie(W, H, rezim); let m = 0;
  for (let k = 0; k < L.length; k++) { const c = L[k]; if (c.p === 0) { const v = H - (c.y - c.r); if (v > m) m = v; } }
  return Math.ceil(m + 8);
}

// slot na ukazovateľ: [id, druh 1 joystick 2 tlačidlo 3 Lunge švihnutý, hráč, index, x, y, aktívny]
const SL = new Float64Array(10 * 7);
// stlačené (hráč * 6 + index), blik do času, joystick [stred x, y, hlavica x, y], pod prstom
const PR = new Uint8Array(12), BL = new Float64Array(12), JS = new Float32Array(8), JON = new Uint8Array(2), JV = new Float32Array(4);
let dotyk = false, ziv = false, vid = false, W0 = 390, H0 = 844, REZ = 'ai', tNow = 0;
export function dotykPrisiel() { dotyk = true; }
// skutočný dotyk prsta: až potom prehliadač dovolí vibrácie
export function aktivuj() { ziv = true; dotyk = true; }
export const bolDotyk = () => dotyk;
export function tlacidlaZap(typ) { return nastavenie.controls === 'buttons' && typ === 'touch'; }
export function vycisti() { SL.fill(0); PR.fill(0); BL.fill(0); JON.fill(0); JV.fill(0); zmena = true; }
const vlastny = (p, dx, dy) => (p ? [-dx, -dy] : [dx, dy]);
function hracNa(y) { return REZ === 'tel2' && y < H0 / 2 ? 1 : 0; }
function volnySlot() { for (let i = 0; i < 10; i++) if (!SL[i * 7 + 6]) return i; return -1; }
function najdi(id) { for (let i = 0; i < 10; i++) if (SL[i * 7 + 6] && SL[i * 7] === id) return i; return -1; }

export function dole(e, W, H, rezim, daj) {
  W0 = W; H0 = H; REZ = rezim;
  const L = rozlozenie(W, H, rezim), x = e.clientX, y = e.clientY, p = hracNa(y), t = e.timeStamp;
  const i = volnySlot(); if (i < 0) return true;
  let best = -1, bd = 1e9;
  for (let k = 0; k < L.length; k++) {
    const c = L[k]; if (c.p !== p || c.id === 'stick') continue;
    const dx = x - c.x, dy = y - c.y, d = Math.sqrt(dx * dx + dy * dy);
    if (d < c.r + 10 && d < bd) { bd = d; best = k; }
  }
  const o = i * 7;
  if (best >= 0) {
    const c = L[best];
    SL[o] = e.pointerId; SL[o + 1] = 2; SL[o + 2] = p; SL[o + 3] = c.i; SL[o + 4] = x; SL[o + 5] = y; SL[o + 6] = 1;
    PR[p * 6 + c.i] = 1; zmena = true;
    if (c.id === 'lunge') daj(t, p, 1, 1);
    else if (c.id === 'brace') daj(t, p, 2, 1);
    else if (c.id === 'step') {
      const sx = JV[p * 2]; let sd = sx < -0.1 ? -1 : sx > 0.1 ? 1 : 2;
      if (p && sd !== 2) sd = -sd;
      daj(t, p, 3, sd); BL[p * 6 + 2] = t + 140;
    } else if (c.id === 'grab') { daj(t, p, 6, 1); BL[p * 6 + 3] = t + 140; }
    else { daj(t, p, 7, 1); BL[p * 6 + 4] = t + 140; }
    return true;
  }
  // plávajúci joystick: ľavá zóna (pre ľavákov pravá) v polovici hráča
  const st = L.find((c) => c.id === 'stick' && c.p === p);
  const [lx] = vlastny(p, x - W / 2, 0), zona = nastavenie.left ? lx > 0.05 * W : lx < -0.05 * W;
  if (!zona) return true;
  const m = 72 * (st.r / 64 > 0.72 ? st.r / 64 : 0.72);
  const cx = x < m ? m : x > W - m ? W - m : x, cy = y < m ? m : y > H - m ? H - m : y;
  SL[o] = e.pointerId; SL[o + 1] = 1; SL[o + 2] = p; SL[o + 3] = 5; SL[o + 4] = cx; SL[o + 5] = cy; SL[o + 6] = 1;
  JON[p] = 1; JS[p * 4] = cx; JS[p * 4 + 1] = cy; JS[p * 4 + 2] = x; JS[p * 4 + 3] = y; zmena = true;
  pakuj(o, x, y, t, daj);
  return true;
}
function pakuj(o, x, y, t, daj) {
  const p = SL[o + 2], L = rozlozenie(W0, H0, REZ), st = L.find((c) => c.id === 'stick' && c.p === p), dosah = st.r;
  let dx = x - SL[o + 4], dy = y - SL[o + 5]; const d = Math.sqrt(dx * dx + dy * dy);
  if (d > dosah) { const k = (d - dosah) / d; SL[o + 4] += dx * k; SL[o + 5] += dy * k; dx = x - SL[o + 4]; dy = y - SL[o + 5]; }  // stred sa ťahá za palcom
  const vx = dx / dosah, vy = dy / dosah, [ox, oy] = vlastny(p, vx, vy);
  JS[p * 4] = SL[o + 4]; JS[p * 4 + 1] = SL[o + 5]; JS[p * 4 + 2] = x; JS[p * 4 + 3] = y; zmena = true;
  const [jx, jy] = doRingu(p, vx, vy);
  if (Math.round(ox * 127) !== Math.round(JV[p * 2] * 127) || Math.round(oy * 127) !== Math.round(JV[p * 2 + 1] * 127)) { daj(t, p, 4, jx); daj(t, p, 5, jy); }
  JV[p * 2] = ox; JV[p * 2 + 1] = oy;
}
// švih z držaného Lunge do strany je Step (FEINT jedným palcom)
const SVIH = 30;
export function pohyb(e, daj) {
  const i = najdi(e.pointerId); if (i < 0) return false;
  const o = i * 7, x = e.clientX, y = e.clientY, t = e.timeStamp;
  if (SL[o + 1] === 1) { pakuj(o, x, y, t, daj); return true; }
  if (SL[o + 1] !== 2) return true;
  const p = SL[o + 2], k = SL[o + 3];
  if (k === 0) {
    const dx = x - SL[o + 4], dy = y - SL[o + 5];
    if ((dx < 0 ? -dx : dx) >= SVIH && (dx < 0 ? -dx : dx) > (dy < 0 ? -dy : dy)) {
      let sd = dx < 0 ? -1 : 1; if (p) sd = -sd;
      daj(t, p, 3, sd); BL[p * 6 + 2] = t + 160; SL[o + 1] = 3; zmena = true;
    }
  } else if (k === 1) {
    // palec skĺzne zo zaprenia na Lunge: COUNTER bez zdvihnutia palca
    const L = rozlozenie(W0, H0, REZ);
    for (let j = 0; j < L.length; j++) {
      const c = L[j]; if (c.p !== p || c.i !== 0) continue;
      const dx = x - c.x, dy = y - c.y;
      if (dx * dx + dy * dy < c.r * c.r) {
        PR[p * 6 + 1] = 0; daj(t, p, 2, 0);
        SL[o + 3] = 0; SL[o + 4] = x; SL[o + 5] = y; PR[p * 6] = 1; daj(t, p, 1, 1); zmena = true;
      }
    }
  }
  return true;   // prst skĺznutý z tlačidla ho nepustí ani nestlačí iné
}
export function hore(e, daj) {
  const i = najdi(e.pointerId); if (i < 0) return false;
  const o = i * 7, p = SL[o + 2], k = SL[o + 3], t = e.timeStamp;
  if (SL[o + 1] === 1) { JON[p] = 0; JV[p * 2] = JV[p * 2 + 1] = 0; daj(t, p, 4, 0); daj(t, p, 5, 0); }
  else { PR[p * 6 + k] = 0; if (k === 0) daj(t, p, 1, 0); else if (k === 1) daj(t, p, 2, 0); }
  SL[o + 6] = 0; zmena = true;
  return true;
}
// klávesnica alebo ukážka: krátke rozsvietenie tlačidla
export function blik(p, id) { BL[p * 6 + IDX[id]] = tNow + 140; zmena = true; }
// ukážka (?demo): vstupy bota na ovládaní
export function ukaz(p, hold, brace, side, grab, stomp, jx, jy) { // HOT
  const o = p * 6;
  if (PR[o] !== (hold ? 1 : 0) || PR[o + 1] !== (brace ? 1 : 0)) { PR[o] = hold ? 1 : 0; PR[o + 1] = brace ? 1 : 0; zmena = true; }
  if (side) { BL[o + 2] = tNow + 160; zmena = true; }
  if (grab) { BL[o + 3] = tNow + 160; zmena = true; }
  if (stomp) { BL[o + 4] = tNow + 160; zmena = true; }
  const vx = (p ? -jx : jx) / 127, vy = (p ? -jy : jy) / 127, on = jx !== 0 || jy !== 0 ? 1 : 0;
  if (on !== JON[p] || vx !== JV[p * 2] || vy !== JV[p * 2 + 1]) { JON[p] = on; JV[p * 2] = vx; JV[p * 2 + 1] = vy; JS[p * 4] = -1; zmena = true; }
}

export function vib(meno) {
  if (!nastavenie.vib || !ziv) return;
  const n = typeof navigator !== 'undefined' ? navigator : null;
  if (!n || !n.vibrate || (n.userActivation && !n.userActivation.hasBeenActive)) return;
  try { n.vibrate(VIB[meno]); } catch (x) {}
}
export const maVibracie = () => typeof navigator !== 'undefined' && !!navigator.vibrate;

let cv = null, g = null, dpr = 1, zmena = true, podpis = '';
const SP = { btn: [], seda: null, krug: [], hlav: [], zak: null, dvaja: false, pop: [] };
// popisky pod tlačidlami na prvé zápasy, poradie ako IDX
const POP = ['LUNGE', 'BRACE', 'STEP', 'GRAB', 'STOMP', 'MOVE'];
let popisky = false;
export function nastavPopisky(v) { if (v !== popisky) { popisky = v; zmena = true; } }
function napis(txt) {
  const fs = 12, w = txt.length * fs * 0.8 + 14;
  return sprite(w, fs * 2, (p, x) => {
    x.font = '800 ' + fs + 'px "ARLing Sans", system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineJoin = 'round'; x.lineWidth = 4; x.strokeStyle = 'rgb(251,246,234)'; x.strokeText(txt, 0, 1);
    const c = p.ink('night', 1); c.fillText(txt, 0, 1);
  });
}
const TAU = 6.2832, sprite = (w, h, fn) => spr(w, h, fn, dpr);
function ikona(p, id, r) {
  const k = 'paper', w = r * 0.13;
  if (id === 'lunge') {
    p.line(k, 1, w * 1.2, [[0, r * 0.3], [0, -r * 0.2]]);
    p.poly(k, 1, [[0, -r * 0.52], [r * 0.3, -r * 0.14], [-r * 0.3, -r * 0.14]]);
    for (const x of [-0.24, 0, 0.24]) p.line(k, 1, w * 0.8, [[x * r, r * 0.46], [x * r, r * 0.62]]);
  } else if (id === 'brace') {
    for (const s of [-1, 1]) {
      p.ellipse(k, 1, s * r * 0.2, r * 0.08, r * 0.15, r * 0.3);
      for (const f of [-0.08, 0, 0.08]) p.line(k, 1, w * 0.55, [[s * r * 0.2 + f * r, -r * 0.2], [s * r * 0.2 + f * r, -r * 0.42]]);
      p.line(k, 1, w * 0.55, [[s * r * 0.33, r * 0.02], [s * r * 0.42, -r * 0.14]]);
    }
  } else if (id === 'step') {
    p.circle(k, 1, 0, -r * 0.08, r * 0.13);
    p.line(k, 1, w * 0.7, [[-r * 0.46, r * 0.3], [r * 0.46, r * 0.3]]);
    for (const s of [-1, 1]) {
      p.line(k, 1, w, [[s * r * 0.2, -r * 0.08], [s * r * 0.42, -r * 0.08]]);
      p.poly(k, 1, [[s * r * 0.6, -r * 0.08], [s * r * 0.36, -r * 0.3], [s * r * 0.36, r * 0.14]]);
    }
  } else if (id === 'grab') {
    // päsť okolo pásu
    p.poly(k, 1, [[-r * 0.58, -r * 0.02], [r * 0.58, -r * 0.02], [r * 0.58, r * 0.2], [-r * 0.58, r * 0.2]]);
    p.poly(k, 1, [[-r * 0.3, -r * 0.34], [r * 0.26, -r * 0.34], [r * 0.34, -r * 0.24], [r * 0.34, r * 0.34], [-r * 0.3, r * 0.34], [-r * 0.36, r * 0.2], [-r * 0.36, -r * 0.24]]);
    for (const f of [-0.16, 0, 0.16]) p.line('night', 0.6, w * 0.45, [[f * r + r * 0.02, -r * 0.3], [f * r + r * 0.02, r * 0.3]]);
    p.line('night', 0.6, w * 0.45, [[-r * 0.3, -r * 0.02], [r * 0.3, -r * 0.02]]);
  } else {
    p.ellipse(k, 1, 0, -r * 0.16, r * 0.34, r * 0.17, -0.25);
    p.path(k, 1, (c, ox, oy) => { c.moveTo(ox - r * 0.48, oy + r * 0.34); for (let i = 1; i <= 8; i++) c.lineTo(ox - r * 0.48 + i * r * 0.12, oy + r * 0.34 + (i & 1 ? -r * 0.09 : r * 0.09)); }, w * 0.9);
  }
}
function tlac(p, ink, id, r, seda) {
  p.circle('paper', 0.9, 0, 0, r);
  p.circle(seda ? 'night' : ink, seda ? 0.35 : 1, 0, 0, r * 0.94);
  p.path('night', 0.5, (c, ox, oy) => c.arc(ox, oy, r * 0.97, 0, TAU), 1.4);
  ikona(p, id, r);
}
export function priprav(canvas, W, H, d, rezim) {
  cv = canvas; g = cv.getContext('2d'); dpr = d; W0 = W; H0 = H; REZ = rezim;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  const L = rozlozenie(W, H, rezim);
  SP.btn.length = 0; SP.krug.length = 0; SP.hlav.length = 0; SP.pop.length = 0;
  for (const x of POP) SP.pop.push(napis(x));
  for (let k = 0; k < 5; k++) {
    const c = L[k], r = c.r;
    SP.btn.push(sprite(r * 2 + 6, r * 2 + 6, (p) => tlac(p, c.ink, c.id, r, false)));
    if (k === 4) SP.seda = sprite(r * 2 + 6, r * 2 + 6, (p) => tlac(p, c.ink, c.id, r, true));
  }
  // krúžok nabitia okolo Lunge: 12 predtlačených dielov
  const rl = L[0].r + 5;
  for (let i = 1; i <= 12; i++) SP.krug.push(sprite(rl * 2 + 8, rl * 2 + 8, (p) => p.path('sun', 1, (c, ox, oy) => c.arc(ox, oy, rl, -1.5708, -1.5708 + TAU * i / 12), 5)));
  SP.obrys = sprite(L[4].r * 2 + 14, L[4].r * 2 + 14, (p) => p.path('sun', 1, (c, ox, oy) => c.arc(ox, oy, L[4].r + 4, 0, TAU), 3));
  // OPEN: obrys Lunge bliká v atramente hráča, kým je súper otvorený
  SP.obrysL = [INKL[0], INKL[1]].map((ink) => sprite(rl * 2 + 16, rl * 2 + 16, (p) => p.path(ink, 1, (c, ox, oy) => c.arc(ox, oy, rl + 3, 0, TAU), 4)));
  const rs = L[5].r;
  SP.zak = sprite(rs * 2 + 6, rs * 2 + 6, (p) => { p.circle('night', 0.12, 0, 0, rs); p.path('night', 0.55, (c, ox, oy) => c.arc(ox, oy, rs, 0, TAU), 2); });
  for (let h = 0; h < 2; h++) SP.hlav.push(sprite(rs * 0.9 + 6, rs * 0.9 + 6, (p) => { p.circle('paper', 1, 0, 0, rs * 0.44); p.circle(h ? 'blue' : 'orange', 1, 0, 0, rs * 0.42); p.circle('night', 0.4, 0, 0, rs * 0.16); }));
  zmena = true; podpis = '';
}
export function zobraz(v) { if (v !== vid) { vid = v; zmena = true; if (cv) cv.hidden = !v; } }
export const zobrazene = () => vid;
function daj1(sp, x, y, a, rot) { // HOT
  g.globalAlpha = a;
  if (rot) { g.setTransform(-dpr, 0, 0, -dpr, x * dpr, y * dpr); g.drawImage(sp.c, -sp.hw, -sp.hh, sp.hw * 2, sp.hh * 2); g.setTransform(dpr, 0, 0, dpr, 0, 0); }
  else g.drawImage(sp.c, x - sp.hw, y - sp.hh, sp.hw * 2, sp.hh * 2);
}
// stav hráčov zo simulácie: nabitie (0 až 12), Special pripravený, súper otvorený
const NB = new Uint8Array(2), RDY = new Uint8Array(2), OT = new Uint8Array(2), INKL = ['orange', 'blue'];
export function atrament(a, b) { INKL[0] = a; INKL[1] = b; }
export function stav(p, ch12, pripraveny, otv) { // HOT
  const o = otv ? 1 : 0;
  if (NB[p] !== ch12 || RDY[p] !== pripraveny || OT[p] !== o) { NB[p] = ch12; RDY[p] = pripraveny; OT[p] = o; zmena = true; }
}
export function kresli(t) { // HOT
  tNow = t;
  if (!vid || !g) return;
  let bl = 0;
  for (let i = 0; i < 12; i++) if (BL[i] > t) bl |= 1 << i;
  const puls = RDY[0] || RDY[1] ? Math.floor(t / 125) & 7 : 0, bo = OT[0] || OT[1] ? Math.floor(t / 250) & 1 : 0;
  if (!zmena && bl === blS && puls === pulsS && bo === boS) return;
  zmena = false; blS = bl; pulsS = puls; boS = bo;
  const L = LC, dvaja = REZ === 'tel2', op = nastavenie.opacity;
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W0, H0);
  for (let k = 0; k < L.length; k++) {
    const c = L[k], p = c.p, o = p * 6, rot = p === 1;
    if (c.i === 5) {
      const x0 = JON[p] && JS[p * 4] >= 0 ? JS[p * 4] : c.x, y0 = JON[p] && JS[p * 4] >= 0 ? JS[p * 4 + 1] : c.y;
      daj1(SP.zak, x0, y0, (JON[p] ? 0.7 : 0.25) * (dvaja ? 1 : op), false);
      let hx = x0, hy = y0;
      if (JON[p]) {
        if (JS[p * 4] >= 0) { hx = JS[p * 4 + 2]; hy = JS[p * 4 + 3]; const dx = hx - x0, dy = hy - y0, d = Math.sqrt(dx * dx + dy * dy); if (d > c.r) { hx = x0 + dx / d * c.r; hy = y0 + dy / d * c.r; } }
        else { hx = x0 + (p ? -JV[p * 2] : JV[p * 2]) * c.r; hy = y0 + (p ? -JV[p * 2 + 1] : JV[p * 2 + 1]) * c.r; }
      }
      daj1(SP.hlav[p], hx, hy, JON[p] ? 0.9 : 0.35 * op, false);
      if (popisky && !JON[p]) daj1(SP.pop[5], c.x, rot ? c.y - c.r * 0.55 : c.y + c.r * 0.55, 0.8, rot);
      continue;
    }
    const zap = PR[o + c.i] || (bl >> (o + c.i)) & 1;
    let a = zap ? 0.95 : (dvaja ? 0.35 : c.i === 0 ? 0.55 : 0.45) * op;
    let sp = SP.btn[c.i];
    if (c.i === 4) {
      if (!RDY[p] && !zap) { sp = SP.seda; a = 0.25 * op; }
      else if (!zap) { a = 0.6; daj1(SP.obrys, c.x, c.y, 0.35 + 0.08 * (puls < 4 ? puls : 8 - puls), rot); }
    }
    daj1(sp, c.x, c.y, a, rot);
    if (c.i === 0 && NB[p]) daj1(SP.krug[NB[p] - 1], c.x, c.y, NB[p] === 12 ? 1 : 0.85, rot);
    if (c.i === 0 && OT[p] && bo) daj1(SP.obrysL[p], c.x, c.y, 1, rot);
    if (popisky) daj1(SP.pop[c.i], c.x, rot ? c.y - c.r - 9 : c.y + c.r + 9, 0.9, rot);
  }
  g.globalAlpha = 1;
}
let blS = 0, pulsS = 0, boS = 0;
