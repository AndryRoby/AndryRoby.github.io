// Tumble Dojo: fyzika ringu. Len + - * / a sqrt: rovnaký vstup = rovnaký stav všade.
import { O, PB, CO, FE, FL, TH, DP, RP, GW, PT, BL, ET, SP, OTVARA, FOCUS } from './kombo.js';
export const HZ = 120, DT = 1 / HZ;
export const C = {
  R: 0.14, FR: 3, CH0: 15, CH1: 72, V0: 0.9, V1: 2.2, ACT: 30, LREC: 24,
  BIN: 7, BREC: 12, SIN: 4, SST: 22, SSV: 0.22 / (22 / 120), SREC: 30, STAG: 36, PERF: 18,
  E: 0.4, EB: 0.8, EP: 1.1, HS: 4, SILNY: 1.8, KL: 0.35, SHR0: 20 * 120, SHR: 0.02 / 120, RMIN: 0.12, START: 0.3,
  GIN: 14, GHOLD: 60, GREC: 42, GREACH: 0.07, GPULL: 0.4, GESC: 18, GREL: 48, GPUSH: 0.3,
  WV: 0.30, WVCH: 0.12, WACC: 0.30 / 12, JDZ: 0.1, JFULL: 0.7, BUF: 12
};
// stavy tela
export const I = 0, CH = 1, LU = 2, LR = 3, BI = 4, BR = 5, BRR = 6, SI = 7, SS = 8, SR = 9, ST = 10, OUT = 11, TAP = 12,
  GI = 13, GH = 14, GR = 15, HD = 16, BP = 17, SPI = 18, SPR = 19, TU = 20;
// pohyby (príčina bodu)
export const NIC = 0, VYPAD = 1, ZAPRENIE = 2, UKROK = 3, CHMAT = 4, DUPNUTIE = 5;
// otočenie za krok: 540 °/s, pri nabíjaní 45 °/s
const T1C = 0.9969173337331280, T1S = 0.07845909572784494, T2C = 0.9999785816641292, T2S = 0.006544937967351858;

function telo() {
  return { x: 0, y: 0, vx: 0, vy: 0, wx: 0, wy: 0, px: 0, py: 0, fx: 0, fy: 0, st: I, t: 0, ch: 0, sx: 0, sy: 0, brAt: -9999, brEnd: -9999,
    last: NIC, lastAt: -9999, hitBy: NIC, hitAt: -9999, hitK: 0, inH: false, inB: false, inS: 0, inSAt: -9999, inG: 0, inGAt: -9999, inP: 0, inPAt: -9999,
    jx: 0, jy: 0, hPend: -1, hBlk: false, rov: 0, stD: C.STAG, lv: 0, lh: false, cl: false, lact: C.ACT, lrecX: 0, flk: false, lk: 0, dbrk: false,
    kl: false, pad: NIC, padK: 0, padEnd: -9999, sila: 0, lastK: 0, lastKAt: -9999, cntrUntil: -1, cntrV: 0, dblUntil: -1, dblBr: false,
    chAt: -9999, fz: 0, runN: 0, runGap: 0, gwAt: -9999, grAt: -9999, holdAt: -9999, grD: C.GREC, giEnd: false, bpBr: 0, noBr: -1,
    edgeAt: -9999, spRec: 0, tuM: 0, tuK: 0, tuN: 0, tuC: 1, tuS: 0, tux: 0, tuy: 0, tvx: 0, tvy: 0, opU: -1, opK: 0, opAt: -9999 };
}
// OPEN: súper nemôže zaprieť, ďalší výpad ho vychýli a tlačí 1,3x; vypadnutie do 2 s je COMBO FINISH
function otvor(s, o, k) {
  // reťaz: bod patrí kombinácii, ktorá reťaz začala
  if (o.opU >= s.step && o.opK) { o.opU = s.step + O.OP_DUR; o.opAt = s.step; o.padEnd = s.step; return; }
  o.opU = s.step + O.OP_DUR; o.opK = k; o.opAt = s.step;
  if (o.noBr < o.opU) o.noBr = o.opU;
  if (o.st === BI || o.st === BR) { o.st = BRR; o.t = 0; o.brEnd = s.step; }
  if (!(o.pad && o.padEnd === s.step)) o.pad = VYPAD;
  o.padK = k; o.padEnd = s.step;
}
function pad(s, m, pricina, k) {
  if (!(m.pad && s.step - m.padEnd <= C.STAG + 108)) { m.pad = pricina; m.padK = k; }
  m.padEnd = s.step;
}
// udalosť kombinácie do kruhového zásobníka s.ev (id, hráč, krok)
function emit(s, m, k) {
  const p = m === s.a ? 0 : 1, i = (s.evN & 63) * 3;
  s.ev[i] = k; s.ev[i + 1] = p; s.ev[i + 2] = s.step; s.evN++;
  s.kc[p * 13 + k]++;
  if (FOCUS[k] && m.sila < O.SILA) m.sila++;
  m.lastK = k; m.lastKAt = s.step;
  if (OTVARA[k]) otvor(s, p ? s.a : s.b, k);
}
export function nova() {
  return { a: telo(), b: telo(), step: 0, rr: 1, stop: 0, win: -1, cat: NIC, catK: 0, outAt: -1,
    hit: 0, hx: 0, hy: 0, hv: 0, perf: 0, flank: 0, prelet: 0, vlna: 0, vx: 0, vy: 0, vHit: 0, vP: 0, tren: false,
    ev: new Int32Array(64 * 3), evN: 0, kc: new Int32Array(26) };
}
export function kolo(s) {
  const sa = s.a.sila, sb = s.b.sila;
  const a = Object.assign(s.a, telo()), b = Object.assign(s.b, telo());
  a.sila = sa; b.sila = sb;
  a.x = 0; a.y = C.START; a.fx = 0; a.fy = -1; b.x = 0; b.y = -C.START; b.fx = 0; b.fy = 1;
  a.px = a.x; a.py = a.y; b.px = b.x; b.py = b.y;
  s.step = 0; s.rr = 1; s.stop = 0; s.win = -1; s.cat = NIC; s.catK = 0; s.outAt = -1; s.perf = 0; s.flank = 0; s.prelet = 0; s.kc.fill(0);
  return s;
}
export function zapas(s) { s.a.sila = s.b.sila = 0; return kolo(s); }
// hráč p: výpad, zaprenie, úkrok -1/+1 (2 ku stredu), chmat, dupnutie, joystick ±127
export function vstup(s, p, hold, brace, side, grab, stomp, jx, jy) {
  const m = p ? s.b : s.a;
  if (hold && !m.inH) m.hPend = s.step;
  if (!hold && m.inH) m.hBlk = false;
  m.inH = hold; m.inB = brace;
  if (side) { m.inS = side; m.inSAt = s.step; }
  if (grab) { m.inG = 1; m.inGAt = s.step; }
  if (stomp) { m.inP = 1; m.inPAt = s.step; }
  m.jx = (jx | 0) / 127; m.jy = (jy | 0) / 127;
}

const volny = (st) => st === I || st === CH || st === TAP;
const okraj = (s, m) => Math.sqrt(m.x * m.x + m.y * m.y) >= s.rr - O.ET_EDGE;
function dotyk(m, o) { const dx = o.x - m.x, dy = o.y - m.y, D = 2 * C.R + 0.06; return dx * dx + dy * dy <= D * D; }
export function kStredu(m, o) {
  let dx = o.x - m.x, dy = o.y - m.y; const d = Math.sqrt(dx * dx + dy * dy) || 1; dx /= d; dy /= d;
  const sx = -dy > 1e-9 ? 1 : -dy < -1e-9 ? -1 : (dx > 0 ? 1 : -1);
  return m.x * dy - m.y * dx >= 0 ? sx : -sx;
}
const KOL = new Float64Array(3);
function kolmica(m, o, side) {
  let dx = o.x - m.x, dy = o.y - m.y; const d = Math.sqrt(dx * dx + dy * dy) || 1; dx /= d; dy /= d;
  const sd = side === 2 ? kStredu(m, o) : side;
  let px = -dy, py = dx, sg = 1;
  if ((px > 1e-9 ? 1 : px < -1e-9 ? -1 : (py > 0 ? 1 : -1)) !== sd) { px = -px; py = -py; sg = -1; }
  KOL[0] = px; KOL[1] = py; KOL[2] = sg;
}

function vypad(s, m, v, act, recX, flk, k) {
  m.vx = m.fx * v; m.vy = m.fy * v; m.lv = v; m.lh = false; m.cl = false; m.st = LU; m.t = 0; m.ch = 0;
  m.last = VYPAD; m.lastAt = s.step; m.lact = act; m.lrecX = recX; m.flk = flk; m.lk = k; m.dbrk = false;
  m.hPend = -1; m.rov = 0; m.fz = 0;
}
function ukrok(s, m, o, side) {
  kolmica(m, o, side);
  m.sx = KOL[0]; m.sy = KOL[1]; m.st = SI; m.t = 0; m.ch = 0; m.inS = 0; m.last = UKROK; m.lastAt = s.step;
}
function vych(s, m, pricina, dur, k) {
  m.st = ST; m.t = 0; m.stD = dur; m.rov = dur; m.ch = 0; m.inS = 0; m.inG = 0; m.inP = 0; m.kl = pricina === ZAPRENIE; m.fz = 0; m.hPend = -1;
  pad(s, m, pricina, k);
}
function otocZacni(s, m, o, k, n, c, sn) {
  m.st = TU; m.t = 0; m.tuM = 1; m.tuK = k; m.tuN = n; m.tuC = c; m.tuS = sn; o.st = TU; o.t = 0; o.tuM = 0; o.tuK = k;
  m.inS = 0; m.hPend = -1; o.inS = 0; o.hPend = -1; o.ch = 0; o.fz = 0;
}
// K11 otočka na okraji: výmena miest o 180° okolo stredu dotyku
function otocka(s, m, o, side) {
  kolmica(m, o, side);
  o.tvx = o.vx; o.tvy = o.vy;
  m.tux = (m.x + o.x) / 2; m.tuy = (m.y + o.y) / 2;
  m.vx = m.vy = o.vx = o.vy = m.wx = m.wy = o.wx = o.wy = 0;
  otocZacni(s, m, o, ET, O.ET_N, O.ET_C, KOL[2] * O.ET_S);
  emit(s, m, ET); pad(s, o, UKROK, ET);
}
// K5 hod: súper po kružnici okolo teba o 90°
function hod(s, m, o, side) {
  kolmica(m, o, side);
  m.tux = m.x; m.tuy = m.y;
  m.vx = m.vy = o.vx = o.vy = 0;
  otocZacni(s, m, o, TH, O.TH_N, O.TH_C, KOL[2] * O.TH_S);
  m.last = CHMAT; m.lastAt = s.step;
  emit(s, m, TH); pad(s, o, CHMAT, TH);
}
function tocenie(s) {
  const m = s.a.st === TU && s.a.tuM ? s.a : s.b.st === TU && s.b.tuM ? s.b : null;
  if (!m) return;
  const o = m === s.a ? s.b : s.a;
  if (s.win >= 0) { m.st = I; m.t = 0; m.tuM = 0; if (o.st === TU) { o.st = I; o.t = 0; } return; }
  const c = m.tuC, sn = m.tuS, cx = m.tux, cy = m.tuy;
  let rx = o.x - cx, ry = o.y - cy;
  o.px = o.x; o.py = o.y; o.x = cx + rx * c - ry * sn; o.y = cy + rx * sn + ry * c;
  if (m.tuK === ET) { rx = m.x - cx; ry = m.y - cy; m.px = m.x; m.py = m.y; m.x = cx + rx * c - ry * sn; m.y = cy + rx * sn + ry * c; }
  else { m.px = m.x; m.py = m.y; }
  if (--m.tuN > 0) return;
  m.tuM = 0;
  if (m.tuK === ET) {
    m.st = I; m.t = 0; vych(s, o, UKROK, O.ET_STAG, ET);
    const r = Math.sqrt(o.x * o.x + o.y * o.y) || 1; o.vx = o.tvx + o.x / r * O.ET_V; o.vy = o.tvy + o.y / r * O.ET_V; o.kl = true;
  } else {
    m.st = GR; m.t = 0; m.grD = O.TH_REC;
    let dx = o.x - m.x, dy = o.y - m.y; const d = Math.sqrt(dx * dx + dy * dy) || 1; dx /= d; dy /= d;
    const D = 2 * C.R + 0.01, sg = sn > 0 ? 1 : -1;
    o.x = m.x + dx * D; o.y = m.y + dy * D;
    o.vx = -dy * sg * O.TH_V; o.vy = dx * sg * O.TH_V;
    vych(s, o, CHMAT, O.TH_STAG, TH); o.kl = false;
  }
}
// K9 pretiahnutie: útočník ×1,2, smer o 30°, obranca uhne 0,10 z dráhy
function pretiahni(s, m, u) {
  const vx = u.fx * u.lv, vy = u.fy * u.lv, c = O.PT_C, sn = O.PT_S;
  const ax = vx * c - vy * sn, ay = vx * sn + vy * c, bx = vx * c + vy * sn, by = -vx * sn + vy * c;
  let da, db;
  if (m.jx * m.jx + m.jy * m.jy > C.JDZ * C.JDZ) { da = ax * m.jx + ay * m.jy; db = bx * m.jx + by * m.jy; }
  else { da = ax * u.x + ay * u.y; db = bx * u.x + by * u.y; }
  const kladne = da >= db, nx = kladne ? ax : bx, ny = kladne ? ay : by;
  u.lh = true; u.cl = true;
  vych(s, u, CHMAT, O.PT_STAG, PT);
  u.vx = nx * O.PT_K; u.vy = ny * O.PT_K;
  const l = Math.sqrt(vx * vx + vy * vy) || 1; let px = -vy / l, py = vx / l;
  if (px * nx + py * ny > 0) { px = -px; py = -py; }
  m.x += px * O.PT_SHIFT; m.y += py * O.PT_SHIFT; m.st = GR; m.t = 0; m.grD = 12; m.inG = 0;
  m.last = CHMAT; m.lastAt = s.step;
  s.hit++; s.hx = (m.x + u.x) / 2; s.hy = (m.y + u.y) / 2; s.hv = 0.5; s.stop = C.HS;
  emit(s, m, PT);
}
// chmat na konci nábehu; oba naraz = oba minú
function chmatKoniec(s, m, o) {
  const dx = o.x - m.x, dy = o.y - m.y, gap = Math.sqrt(dx * dx + dy * dy) - 2 * C.R, st = o.st;
  if (gap <= C.GREACH && st === LU) { vych(s, m, VYPAD, C.STAG, 0); return; }
  if (gap <= C.GREACH && st !== SI && st !== SS && st !== OUT && st !== TU && st !== HD && st !== GH && st !== BP) {
    m.st = GH; m.t = 0; m.holdAt = s.step; m.hPend = -1;
    o.st = HD; o.t = 0; o.ch = 0; o.inS = 0; o.hPend = -1; o.fz = 0; o.bpBr = 0; o.rov = 0;
    return;
  }
  m.st = GR; m.t = 0; m.grD = C.GREC;
}
// S dupnutie: kombinácia len pri zásahu
function vlna(s, m, o) {
  const dx = o.x - m.x, dy = o.y - m.y, d = Math.sqrt(dx * dx + dy * dy) || 1, nx = dx / d, ny = dy / d;
  const chrani = kryje(o, -nx, -ny) || o.st === SI || o.st === SS || o.st === OUT || o.st === TU;
  s.vlna++; s.vx = m.x; s.vy = m.y; s.vP = m === s.a ? 0 : 1;
  if (d <= O.SP_R && !chrani) {
    vych(s, o, DUPNUTIE, O.SP_STAG, SP); o.kl = false;
    o.vx += nx * O.SP_V; o.vy += ny * O.SP_V; m.spRec = O.SP_REC; s.vHit = 1;
    s.stop = C.HS; s.hit++; s.hx = o.x; s.hy = o.y; s.hv = 0.6;
    emit(s, m, SP);
  } else { m.spRec = O.SP_REC + O.SP_MISS; s.vHit = 0; }
  m.st = SPR; m.t = 0;
}
// K7: kroky chôdze k súperovi (±35°), prestávka najviac 6
function beh(m, o) {
  const st = m.st, j2 = m.jx * m.jx + m.jy * m.jy;
  if ((st === I || st === TAP || st === CH) && j2 > C.JDZ * C.JDZ) {
    const dx = o.x - m.x, dy = o.y - m.y, d = Math.sqrt(dx * dx + dy * dy) || 1, jm = Math.sqrt(j2);
    if ((m.jx * dx + m.jy * dy) / (jm * d) >= O.RP_COS) { m.runN++; m.runGap = 0; return; }
  }
  if (++m.runGap > O.RP_GAP) m.runN = 0;
}

function ovladaj(s, m, o) {
  if (s.win >= 0 || m.st === OUT) { m.inS = m.inG = m.inP = 0; m.hPend = -1; return; }
  const n = s.step;
  beh(m, o);
  if (m.inS && n - m.inSAt > C.BUF) m.inS = 0;
  if (m.inG && n - m.inGAt > C.BUF) m.inG = 0;
  if (m.inP && n - m.inPAt > C.BUF) m.inP = 0;
  if (m.hPend >= 0 && n - m.hPend > C.BUF) m.hPend = -1;
  const st = m.st;
  if (st === TU) return;
  if (m.inS) {
    const side = m.inS;
    // K11 aj z vychýlenia, lebo práve vtedy ťa tlačia von
    if (n - m.edgeAt <= O.ET_WIN && okraj(s, m) && dotyk(m, o) && st !== GI && st !== GH && st !== BP && st !== HD && st !== SPI && st !== LU
      && o.st !== HD && o.st !== TU && o.st !== OUT) { otocka(s, m, o, side); return; }
    if (st === GH && n - m.holdAt <= (s.tren ? O.TH_WIN * 3 : O.TH_WIN)) { hod(s, m, o, side); return; }
    if (st === HD && m.t >= C.GESC && o.st === GH) { o.st = I; o.t = 0; ukrok(s, m, o, side); return; }
    if (volny(st)) {
      if (st === CH && m.ch >= O.FE_MIN) {
        m.fz = m.ch;
        // K3 finta
        if (o.brAt >= m.chAt && (o.st === BI || o.st === BR || (o.brEnd >= o.brAt && n - o.brEnd < O.FE_BR))) emit(s, m, FE);
      }
      ukrok(s, m, o, side); return;
    }
  }
  if (m.inG && (volny(st) || st === BRR)) {
    m.inG = 0;
    if (o.st === LU && o.lh && m.hitBy === VYPAD && n - m.hitAt <= O.PT_POST) { pretiahni(s, m, o); return; }
    m.st = GI; m.t = 0; m.ch = 0; m.grAt = n; m.last = CHMAT; m.lastAt = n; m.hBlk = m.inH; m.hPend = -1; return;
  }
  if (m.inP && m.sila >= O.SILA && (volny(st) || st === BRR)) {
    m.inP = 0; m.sila = 0; m.st = SPI; m.t = 0; m.ch = 0; m.last = DUPNUTIE; m.lastAt = n; m.hBlk = m.inH;
    return;
  }
  if (m.hPend >= 0) {
    // K2 protiúder
    if (n <= m.cntrUntil && (st === BR || st === BI || st === BRR || st === I || st === TAP)) {
      const v0 = m.cntrV > O.CO_VMIN ? m.cntrV : O.CO_VMIN; let v = O.CO_K * v0; if (v > O.CO_VMAX) v = O.CO_VMAX;
      m.cntrUntil = -1; vypad(s, m, v, C.ACT, O.CO_REC - C.LREC, false, CO); m.hBlk = true; emit(s, m, CO); return;
    }
    // K6 dvojitý štuch
    if (n <= m.dblUntil && ((st === LU && m.lh) || st === LR || (st === ST && m.dblBr))) {
      const brk = m.dblBr; m.dblUntil = -1;
      vypad(s, m, O.DP_V, O.DP_ACT, O.DP_REC - C.LREC, false, DP); m.dbrk = brk; m.hBlk = true; emit(s, m, DP); return;
    }
    // K10 za pás von
    if (st === GH && o.st === HD && n - m.holdAt <= O.BL_WIN) {
      m.st = BP; m.t = 0; m.bpBr = 0; m.hPend = -1; m.hBlk = true; m.last = CHMAT; m.lastAt = n;
      emit(s, m, BL); pad(s, o, CHMAT, BL); return;
    }
    // K4 obchvat: úkrok, potom výpad
    if (st === SR && !m.fz && m.t <= O.FL_WIN) { vypad(s, m, O.FL_V, C.ACT, 0, true, 0); m.hBlk = true; return; }
  }
  if (m.fz) {
    // po finte sa pustením vypáli zmrazené nabitie ako obchvat
    if (st === SR && m.t <= O.FL_WIN && !m.inH) {
      const v = C.V0 + (C.V1 - C.V0) * (m.fz - C.CH0) / (C.CH1 - C.CH0);
      vypad(s, m, v, C.ACT, 0, true, 0); return;
    }
    if (!(st === SI || st === SS || (st === SR && m.t <= O.FL_WIN))) { m.fz = 0; m.hBlk = m.inH; }
  }
  if (m.inB && (volny(st) || st === BRR) && n > m.noBr) {
    m.st = BI; m.t = 0; m.ch = 0; m.brAt = n; m.last = ZAPRENIE; m.lastAt = n;
    // K8 poddajnosť: joystick od súpera
    m.gwAt = -9999;
    const j2 = m.jx * m.jx + m.jy * m.jy;
    if (j2 > C.JDZ * C.JDZ) {
      const dx = m.x - o.x, dy = m.y - o.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      if ((m.jx * dx + m.jy * dy) / (Math.sqrt(j2) * d) >= O.GW_COS) m.gwAt = n;
    }
    return;
  }
  if (st === BR && !m.inB) { m.st = BRR; m.t = 0; m.brEnd = n; return; }
  if (st === I && m.inH && !m.hBlk) { m.st = CH; m.t = 0; m.ch = 0; m.chAt = n; return; }
  if (st === CH) {
    if (m.inH) { if (m.ch < C.CH1) m.ch++; return; }
    // ťuk = krátky výpad V0; K7 rozbeh
    let v = m.ch > C.CH0 ? C.V0 + (C.V1 - C.V0) * (m.ch - C.CH0) / (C.CH1 - C.CH0) : C.V0, rec = 0, k = 0;
    if (m.runN >= O.RP_WALK && m.ch >= C.CH1) { v *= O.RP_K; if (v > O.RP_MAX) v = O.RP_MAX; rec = O.RP_REC; k = RP; }
    vypad(s, m, v, C.ACT, rec, false, k);
    if (k) emit(s, m, RP);
  }
}

function casovace(s, m, o) {
  const t = ++m.t;
  switch (m.st) {
    case LU: if (t >= m.lact) {
      m.st = LR; m.t = 0;
      if (!m.cl && o.last === UKROK && s.step - o.lastAt <= 72) pad(s, m, UKROK, 0);   // preletel do prázdna
    } break;
    case LR: if (t >= C.LREC + m.lrecX) { m.st = I; m.t = 0; } break;
    case BI: if (t >= C.BIN) { m.st = BR; m.t = 0; } break;
    case BRR: if (t >= C.BREC) { m.st = I; m.t = 0; } break;
    case SI: if (t >= C.SIN) { m.st = SS; m.t = 0; } break;
    case SS: if (t >= C.SST) { m.st = SR; m.t = 0; m.vx = m.vy = 0; } break;
    case SR: if (t >= C.SREC) { m.st = I; m.t = 0; } break;
    case ST: if (t >= m.stD) { m.st = I; m.t = 0; } break;
    case TAP: if (t >= 6) { m.st = I; m.t = 0; } break;
    case GI: if (t >= C.GIN) m.giEnd = true; break;
    case GH: if (o.st !== HD) { m.st = I; m.t = 0; } else if (t >= C.GHOLD) { m.st = I; m.t = 0; vych(s, o, CHMAT, C.GREL, 0); pustit(m, o); } break;
    case GR: if (t >= m.grD) { m.st = I; m.t = 0; } break;
    case HD: if (o.st !== GH && o.st !== BP) { m.st = I; m.t = 0; } break;
    case BP:
      if (o.st !== HD) { m.st = I; m.t = 0; break; }
      if (o.inB && ++m.bpBr >= O.BL_BR) {       // súper sa zaprel: vychýlený si ty
        vych(s, m, ZAPRENIE, O.BL_STAG, 0); o.st = BR; o.t = 0; o.brAt = -9999; o.vx = o.vy = 0; m.vx = m.vy = 0; break;
      }
      if (t >= O.BL_DUR) { m.st = I; m.t = 0; vych(s, o, CHMAT, O.BL_STAG, BL); }
      break;
    case SPI: if (t >= O.SP_IN) vlna(s, m, o); break;
    case SPR: if (t >= m.spRec) { m.st = I; m.t = 0; } break;
  }
  if (m.rov > 0) m.rov--;
}
function pustit(m, o) {
  const dx = o.x - m.x, dy = o.y - m.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
  o.vx = dx / d * C.GPUSH; o.vy = dy / d * C.GPUSH;
}
function chmaty(s) {
  const a = s.a, b = s.b, ea = a.giEnd, eb = b.giEnd;
  if (!ea && !eb) return;
  a.giEnd = b.giEnd = false;
  if (ea && eb) { a.st = GR; a.t = 0; a.grD = C.GREC; b.st = GR; b.t = 0; b.grD = C.GREC; return; }
  if (ea) chmatKoniec(s, a, b); else chmatKoniec(s, b, a);
}

function otoc(m, o) {
  // smer je pevný vo výpade, zaprení a pri páse (zaprenie sa dá obísť)
  const st = m.st;
  if (st === LU || st === LR || st === ST || st === OUT || st === BI || st === BR || st === BP || st === HD || st === TU) return;
  let dx = o.x - m.x, dy = o.y - m.y; const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 1e-9) return;
  dx /= d; dy /= d;
  const c = st === CH ? T2C : T1C, sn = st === CH ? T2S : T1S;
  if (m.fx * dx + m.fy * dy >= c) { m.fx = dx; m.fy = dy; return; }
  const k = m.fx * dy - m.fy * dx >= 0 ? sn : -sn;
  const nx = m.fx * c - m.fy * k, ny = m.fx * k + m.fy * c;
  const nn = Math.sqrt(nx * nx + ny * ny); m.fx = nx / nn; m.fy = ny / nn;
}
function drz(m, o) {
  if (m.st === GH && o.st === HD) {
    const dx = m.x - o.x, dy = m.y - o.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
    if (d - 2 * C.R > 0.002) { o.vx = dx / d * C.GPULL; o.vy = dy / d * C.GPULL; } else { o.vx = o.vy = 0; }
    m.vx = m.vy = 0;
  } else if (m.st === BP && o.st === HD) { m.vx = m.fx * O.BL_V; m.vy = m.fy * O.BL_V; o.vx = m.vx; o.vy = m.vy; }
}

function pohni(m) {
  const st = m.st;
  if (st === TU) return;
  m.px = m.x; m.py = m.y;
  if (st === SS) { m.vx = m.sx * C.SSV; m.vy = m.sy * C.SSV; }
  else if (st === LU && !m.lh) { m.vx = m.fx * m.lv; m.vy = m.fy * m.lv; }   // výpad letí plnou rýchlosťou po prvý dotyk
  else if (st !== BP && st !== HD && st !== GH) {
    // po odraze kĺzanie na pätách, za okrajom rýchle zastavenie
    if (m.kl && m.vx * m.vx + m.vy * m.vy < 0.04) m.kl = false;
    const k = C.FR * (st === OUT ? 3 : st === BI || st === BR ? 2 : m.kl ? C.KL : 1);
    const f = 1 - k * DT; m.vx *= f; m.vy *= f;
  }
  // chôdza len v stoji, pri nabíjaní plazenie
  const wmax = st === I || st === TAP ? C.WV : st === CH ? C.WVCH : 0;
  if (wmax === 0) { m.wx = m.wy = 0; }
  else {
    let tx = 0, ty = 0; const j2 = m.jx * m.jx + m.jy * m.jy;
    if (j2 > C.JDZ * C.JDZ) {
      const jm = Math.sqrt(j2); let k = (jm - C.JDZ) / (C.JFULL - C.JDZ); if (k > 1) k = 1;
      tx = m.jx / jm * k * wmax; ty = m.jy / jm * k * wmax;
    }
    const ex = tx - m.wx, ey = ty - m.wy, e = Math.sqrt(ex * ex + ey * ey);
    if (e <= C.WACC) { m.wx = tx; m.wy = ty; } else { m.wx += ex / e * C.WACC; m.wy += ey / e * C.WACC; }
  }
  m.x += (m.vx + m.wx) * DT; m.y += (m.vy + m.wy) * DT;
}

// zaprenie chráni len spredu (±60°)
const kryje = (m, nx, ny) => m.st === BR && m.fx * nx + m.fy * ny >= 0.5;
const rezim = (o, kr) => o.st === LU ? VYPAD : kr ? ZAPRENIE : (o.st === SI || o.st === SS || o.st === SR) ? UKROK : NIC;
const drzi = (m) => m.st === GH || m.st === BP || m.st === HD;

// K8 poddajnosť: obranca d pohltí nový výpad útočníka u
function poddaj(s, d, u) {
  if (!(d.st === BI || d.st === BR) || s.step - d.gwAt > O.GW_WIN) return false;
  let nx = u.x - d.x, ny = u.y - d.y; const l = Math.sqrt(nx * nx + ny * ny) || 1; nx /= l; ny /= l;
  if (d.fx * nx + d.fy * ny < 0.5) return false;
  d.vx = -nx * O.GW_BACK; d.vy = -ny * O.GW_BACK; d.gwAt = -9999;
  u.lh = true; u.cl = true; vych(s, u, ZAPRENIE, O.GW_STAG, GW); u.kl = false;
  d.cntrUntil = s.step + O.CO_WIN; d.cntrV = u.lv;
  u.vx = -nx * O.GW_FWD; u.vy = -ny * O.GW_FWD;
  s.hit++; s.hx = (d.x + u.x) / 2; s.hy = (d.y + u.y) / 2; s.hv = 0.3;
  emit(s, d, GW);
  return true;
}
// výpad u narazil do o (ko zaprenie, cu čistý, fu obchvat, dok dokonalé, ou otvorený)
function naraz(s, u, o, ko, cu, fu, dok, ou) {
  if (fu) { vych(s, o, VYPAD, O.FL_STAG, FL); o.kl = true; emit(s, u, FL); return true; }
  // otvorený súper: ďalší výpad ho pošle kĺzať sa
  if (ou) {
    o.opU = -1; vych(s, o, VYPAD, O.OP_STAG, o.opK);
    if (u.lk !== o.opK) {
      o.kl = true; if (o.noBr < s.step + O.OP_NOBR) o.noBr = s.step + O.OP_NOBR;
      let dx = o.x - u.x, dy = o.y - u.y; const d = Math.sqrt(dx * dx + dy * dy) || 1; dx /= d; dy /= d;
      const v = o.vx * dx + o.vy * dy; if (v < O.OP_VMIN) { o.vx += dx * (O.OP_VMIN - v); o.vy += dy * (O.OP_VMIN - v); }
    }
    return true;
  }
  if (ko) {
    if (u.lk === DP && u.dbrk) { o.noBr = s.step + O.DP_BRK; vych(s, o, VYPAD, O.DP_STAG, DP); otvor(s, o, DP); return true; }
    vych(s, u, ZAPRENIE, dok ? O.PB_STAG : C.STAG, dok ? PB : 0);
    o.cntrUntil = s.step + O.CO_WIN; o.cntrV = u.lv;
    if (dok) emit(s, o, PB);
    return true;
  }
  if (o.st === GI) { vych(s, o, VYPAD, C.STAG, u.lk); return true; }   // výpad preruší nábeh chmatu
  if (cu) {
    if (u.lk === DP && o.st === ST) { vych(s, o, VYPAD, C.STAG, DP); o.kl = true; }
    else if (u.lv >= C.SILNY) { vych(s, o, VYPAD, C.STAG, u.lk); if (u.lk === RP) o.kl = true; }
    u.cl = true; return true;
  }
  return false;
}
function zrazka(s, a, b) {
  if (a.st === TU || b.st === TU) return;
  const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy, D = 2 * C.R;
  if (d2 >= D * D || d2 < 1e-12) return;
  const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
  const ra = a.x * a.x + a.y * a.y, rb = b.x * b.x + b.y * b.y;
  if (rb < ra && okraj(s, a)) a.edgeAt = s.step;
  if (ra < rb && okraj(s, b)) b.edgeAt = s.step;
  const ka = kryje(a, nx, ny), kb = kryje(b, -nx, -ny);
  const ia = ka ? 1 / 3 : 1, ib = kb ? 1 / 3 : 1, sum = ia + ib, ov = D - d;
  a.x -= nx * ov * ia / sum; a.y -= ny * ov * ia / sum; b.x += nx * ov * ib / sum; b.y += ny * ov * ib / sum;
  if (drzi(a) || drzi(b)) return;
  const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (vn >= 0) return;
  const la = a.st === LU && !a.lh, lb = b.st === LU && !b.lh;
  // K8 a K9 odpovedajú na nový výpad namiesto odrazu
  if (la && !lb) { if (poddaj(s, b, a)) return; if (b.st === GI && s.step - b.grAt <= O.PT_PRE) { pretiahni(s, b, a); return; } }
  if (lb && !la) { if (poddaj(s, a, b)) return; if (a.st === GI && s.step - a.grAt <= O.PT_PRE) { pretiahni(s, a, b); return; } }
  let e = C.E, dok = false;
  if (ka || kb) { e = C.EB; if ((ka && s.step - a.brAt <= O.PB_MAX) || (kb && s.step - b.brAt <= O.PB_MAX)) { e = O.PB_E; dok = true; } }
  const j = -(1 + e) * vn / sum;
  // K4 obchvat
  const fa = la && a.flk && (b.fx * -nx + b.fy * -ny < O.FL_CONE || b.st === BI || b.st === BR || s.step - b.brEnd <= O.FL_BR),
    fb = lb && b.flk && (a.fx * nx + a.fy * ny < O.FL_CONE || a.st === BI || a.st === BR || s.step - a.brEnd <= O.FL_BR);
  const oa = la && b.opU >= s.step, ob = lb && a.opU >= s.step;
  const ja = fb ? j * O.FL_IMP : ob ? j * O.OP_IMP : j, jb = fa ? j * O.FL_IMP : oa ? j * O.OP_IMP : j;
  a.vx -= ja * ia * nx; a.vy -= ja * ia * ny; b.vx += jb * ib * nx; b.vy += jb * ib * ny;
  if (a.st === SS) { a.st = SR; a.t = 0; }
  if (b.st === SS) { b.st = SR; b.t = 0; }
  a.hitBy = rezim(b, kb); a.hitAt = s.step; a.hitK = lb ? b.lk : 0; b.hitBy = rezim(a, ka); b.hitAt = s.step; b.hitK = la ? a.lk : 0;
  if (a.st === LU) a.lh = true;
  if (b.st === LU) b.lh = true;
  if (!la && !lb) return;
  if (la) { a.dblUntil = a.lk === DP ? -1 : s.step + O.DP_WIN; a.dblBr = kb && !dok; }
  if (lb) { b.dblUntil = b.lk === DP ? -1 : s.step + O.DP_WIN; b.dblBr = ka && !dok; }
  // čistý zásah mieri najviac 45° vedľa, inak výpad len šuchne
  const ca = la && a.fx * nx + a.fy * ny >= 0.7, cb = lb && -(b.fx * nx + b.fy * ny) >= 0.7;
  let tuk = true;
  if ((la && b.st === BR && !kb) || (lb && a.st === BR && !ka)) s.flank++;
  if (la && lb) {
    if (a.lv > b.lv) vych(s, b, VYPAD, C.STAG, a.lk); else if (b.lv > a.lv) vych(s, a, VYPAD, C.STAG, b.lk);
    else { vych(s, a, VYPAD, C.STAG, 0); vych(s, b, VYPAD, C.STAG, 0); }
  } else if (la) tuk = naraz(s, a, b, kb, ca, fa, dok, oa);
  else tuk = naraz(s, b, a, ka, cb, fb, dok, ob);
  if (!tuk) return;
  s.stop = C.HS; s.hit++; s.hx = (a.x + b.x) / 2; s.hy = (a.y + b.y) / 2; s.hv = -vn;
  if (dok) s.perf++;
}

function vonku(s, m) { return m.st !== OUT && m.x * m.x + m.y * m.y > s.rr * s.rr; }

function zapis(s, w) {
  s.win = w; s.outAt = s.step;
  const W = w ? s.b : s.a, L = w ? s.a : s.b;
  if (L.pad && s.step - L.padEnd <= 240) { s.cat = L.pad; s.catK = L.padK; }
  else { s.cat = W.last; s.catK = L.hitK && s.step - L.hitAt <= 180 ? L.hitK : 0; }
  if (s.cat === UKROK && L.last === VYPAD) s.prelet++;
}

export function krok(s) {
  const a = s.a, b = s.b;
  if (s.stop > 0) { s.stop--; s.step++; a.px = a.x; a.py = a.y; b.px = b.x; b.py = b.y; return; }
  ovladaj(s, a, b); ovladaj(s, b, a);
  casovace(s, a, b); casovace(s, b, a);
  chmaty(s);
  otoc(a, b); otoc(b, a);
  drz(a, b); drz(b, a);
  tocenie(s);
  pohni(a); pohni(b);
  zrazka(s, a, b);
  if (s.step > C.SHR0 && !s.tren) { const r = 1 - (s.step - C.SHR0) * C.SHR; s.rr = r > C.RMIN ? r : C.RMIN; }   // v úvode sa ring nezmenšuje
  if (s.win < 0) {
    const oa = vonku(s, a), ob = vonku(s, b);
    if (oa || ob) {
      const ra = a.x * a.x + a.y * a.y, rb = b.x * b.x + b.y * b.y;
      const l = oa && ob ? (ra >= rb ? 0 : 1) : oa ? 0 : 1;
      zapis(s, 1 - l);
    }
  }
  if (s.win >= 0) { const L = s.win ? a : b; if (L.st !== OUT) { L.st = OUT; L.t = 0; } }
  s.step++;
}

export function rng(seed) {
  let x = seed >>> 0 || 1;
  return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
}
// odtlačok pre testy je v test-pomoc.mjs
