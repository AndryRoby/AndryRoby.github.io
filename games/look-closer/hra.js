/* Look Closer, M0: the game on one screen.
   The scene and every measurement live in scena.mjs and silueta.mjs (pure, tested
   in node). This file keeps the print on screen: a camera with pinch, drag, wheel
   and keys; the hint in two steps; the list below; a save in this browser that
   never breaks the game; sound only when asked for. The print is made once (and a
   sharp part of it after zooming); only things that move are drawn again. */
import { Pen, OPT, inksLost } from '../village/riso.js?v=3';
import * as S from './scena.mjs?v=1';
import { hranice } from './silueta.mjs?v=1';

/* A rewarded video is designed in (NAVRH.md) but switched off in M0: no ad network
   is loaded, the offer never shows, and a test fails if that changes. Hints are free. */
const REKLAMA_ZAPNUTA = false;
const reklama = { dostupna: () => REKLAMA_ZAPNUTA, odmena: async () => false };

const $ = id => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const TEST = Q.has('test');
const LADENIE = Q.get('debug') === 'hit';
const KLUC = TEST ? 'arling:look-closer:test' : 'arling:look-closer:v1';
const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
/* Firefox: lines and letters inked with a pattern move the canvas off the GPU for
   good (village/README.md), so there every line is printed as a fill. */
OPT.fillStrokes = /\bGecko\/\d/.test(navigator.userAgent);
const slabe = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
const { min, max, abs, hypot, sin, cos, PI, round, ceil, sqrt } = Math;
const TAU = PI * 2;

/* ── Saving: every read and write may fail (private window, blocked storage) ── */
let ulozenieIde = true;
function prazdne() { return { v: 1, n: { zvuk: false, pokoj: null, cas: true }, dni: {}, nek: novyPostup(1), rezim: 'den', videl: false }; }
function novyPostup(n) { return { n, f: [], h: 0, m: 0, s: 0, hotovo: false, o: '' }; }
function citaj() {
  try { const t = localStorage.getItem(KLUC); return t ? JSON.parse(t) : null; }
  catch (e) { ulozenieIde = false; return null; }
}
function platnyPostup(p, n) {
  const q = novyPostup(n);
  if (!p || typeof p !== 'object') return q;
  if (Array.isArray(p.f)) q.f = p.f.filter(x => Number.isInteger(x) && x >= 0 && x < 12);
  for (const k of ['h', 'm', 's']) q[k] = Number.isFinite(p[k]) && p[k] >= 0 ? p[k] : 0;
  q.hotovo = p.hotovo === true; q.o = typeof p.o === 'string' ? p.o : '';
  return q;
}
function normalizuj(o) {
  const z = prazdne();
  if (!o || typeof o !== 'object' || o.v !== 1) return z;
  if (o.n && typeof o.n === 'object') z.n = { zvuk: o.n.zvuk === true, pokoj: typeof o.n.pokoj === 'boolean' ? o.n.pokoj : null, cas: o.n.cas !== false };
  if (o.dni && typeof o.dni === 'object') for (const d of Object.keys(o.dni).sort().slice(-62)) if (/^\d{4}-\d{2}-\d{2}$/.test(d)) z.dni[d] = platnyPostup(o.dni[d], 0);
  const n = o.nek && Number.isInteger(o.nek.n) && o.nek.n >= 1 ? o.nek.n : 1;
  z.nek = platnyPostup(o.nek, n); z.nek.n = n;
  z.rezim = o.rezim === 'nek' ? 'nek' : 'den';
  z.videl = o.videl === true;
  return z;
}
let ulozene = normalizuj(citaj());
function zapis() {
  try { localStorage.setItem(KLUC, JSON.stringify(ulozene)); ulozenieIde = true; }
  catch (e) { ulozenieIde = false; }
}
const pokoj = () => (ulozene.n.pokoj == null ? mqReduce.matches : ulozene.n.pokoj);

/* ── Sound: Web Audio, made in code, born only on a tap ─────────────────── */
let ac = null, hlavny = null;
function zvukPriprav() {
  if (ac) { if (ac.state === 'suspended') ac.resume().catch(() => {}); return; }
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    hlavny = ac.createGain(); hlavny.gain.value = 0.55; hlavny.connect(ac.destination);
  } catch (e) { ac = null; }
}
function ton(f, dur = 0.12, typ = 'sine', hlas = 0.2, neskor = 0) {
  if (!ulozene.n.zvuk || !ac) return;
  const t = ac.currentTime + neskor, o = ac.createOscillator(), g = ac.createGain();
  o.type = typ; o.frequency.setValueAtTime(f, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(hlas, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(hlavny); o.start(t); o.stop(t + dur + 0.03);
}
const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5];
const zvukNajdi = n => { const f = PENTA[min(n, PENTA.length - 1)]; ton(f, 0.9, 'sine', 0.16); ton(f * 2, 0.4, 'triangle', 0.04, 0.005); ton(f * 3, 0.18, 'sine', 0.02, 0.01); };
const zvukMimo = () => ton(196, 0.05, 'sine', 0.04);
const zvukNapoveda = krok => { if (krok === 1) ton(659.25, 0.18, 'sine', 0.06); else { ton(523.25, 0.3, 'sine', 0.07); ton(783.99, 0.4, 'sine', 0.06, 0.12); } };
const zvukKoniec = () => [261.63, 392, 329.63, 392, 523.25].forEach((f, k) => ton(f, 1.2, 'sine', 0.09, k * 0.12));

/* ── Which scene ─────────────────────────────────────────────────────────── */
const dnes = S.dnesBratislava();
const denZ = Q.get('d');
const datum = denZ && /^\d{4}-\d{2}-\d{2}$/.test(denZ) ? denZ : dnes;
const semienkoZ = Number(Q.get('s'));
const lenSemienko = Number.isInteger(semienkoZ) && semienkoZ > 0 ? semienkoZ : 0;
let rezim = lenSemienko ? 'den' : ulozene.rezim;
let sc = null, postup = null, najdene = [];
let docasny = novyPostup(0);                   // ?s= review scenes are not saved

function odtlacok(s) { let h = 0; for (let k = 0; k < s.length; k++) h = (h * 31 + s.charCodeAt(k)) | 0; return (h >>> 0).toString(36); }

/* ── Canvas, camera ─────────────────────────────────────────────────────── */
const scena = $('scena'), cv = $('platno'), ctx = cv.getContext('2d');
let pen = new Pen(ctx);
let W = 1, H = 1, dpr = 1, fitZ = 0, pripravene = false;
const cam = { x: 0, y: 0, z: 1, vx: 0, vy: 0, vz: 0, tx: 0, ty: 0, tz: 1 };
const R = S.RECT, OKRAJ = 6;
const stredX = (R.x0 + R.x1) / 2, stredY = (R.y0 + R.y1) / 2;
const zMax = () => fitZ * 3;
const clampZ = z => min(zMax(), max(fitZ, z));

function velkost() {
  const r = scena.getBoundingClientRect();
  W = max(1, round(r.width)); H = max(1, round(r.height));
  dpr = min(window.devicePixelRatio || 1, slabe ? 1.5 : 2);
  cv.width = round(W * dpr); cv.height = round(H * dpr);
  const pomer = pripravene ? cam.tz / fitZ : 1;
  fitZ = max(0.2, min((W - 16) / S.SW, (H - 16) / S.SH));
  if (!pripravene) { cam.x = cam.tx = stredX; cam.y = cam.ty = stredY; cam.z = cam.tz = fitZ; pripravene = true; }
  else { cam.z = cam.tz = clampZ(fitZ * pomer); obmedz(); cam.x = cam.tx; cam.y = cam.ty; }
  ostreOk = false; kurzorVStrede();
  if (sc) obnovLupu();
  treba = true; zobud();
}
function obmedz() {
  const hw = W / 2 / cam.tz, hh = H / 2 / cam.tz, m = 10 / cam.tz;
  const mx = max(0, S.SW / 2 + m - hw), my = max(0, S.SH / 2 + m - hh);
  cam.tx = min(stredX + mx, max(stredX - mx, cam.tx));
  cam.ty = min(stredY + my, max(stredY - my, cam.ty));
}
function guma(v, lo, hi) { return v < lo ? lo - (lo - v) * 0.35 : v > hi ? hi + (v - hi) * 0.35 : v; }
function hranice2(z) {
  const m = 10 / z, mx = max(0, S.SW / 2 + m - W / 2 / z), my = max(0, S.SH / 2 + m - H / 2 / z);
  return [stredX - mx, stredX + mx, stredY - my, stredY + my];
}
/* a critically damped spring in closed form: the same motion at 60 and 144 Hz */
function pruzina(o, k, vk, tk, w, dt, eps) {
  const d = o[k] - o[tk];
  if (abs(d) < eps && abs(o[vk]) < eps * 4) { o[k] = o[tk]; o[vk] = 0; return false; }
  const e = Math.exp(-w * dt), a = o[vk] + w * d;
  o[k] = o[tk] + (d + a * dt) * e;
  o[vk] = (o[vk] - w * a * dt) * e;
  return true;
}
function pohniKameru(dt) {
  if ((tah && tah.pohol) || stip) return true;
  if (pokoj()) { const m = cam.x !== cam.tx || cam.y !== cam.ty || cam.z !== cam.tz; cam.x = cam.tx; cam.y = cam.ty; cam.z = cam.tz; return m; }
  const a = pruzina(cam, 'x', 'vx', 'tx', 12, dt, 0.02);
  const b = pruzina(cam, 'y', 'vy', 'ty', 12, dt, 0.02);
  const c = pruzina(cam, 'z', 'vz', 'tz', 14, dt, 0.0002);
  return a || b || c;
}
function naSvet(lx, ly) { return [(lx - W / 2) / cam.z + cam.x, (ly - H / 2) / cam.z + cam.y]; }
function priblizNa(lx, ly, nz) {
  const [wx, wy] = naSvet(lx, ly);
  cam.tz = clampZ(nz);
  cam.tx = wx - (lx - W / 2) / cam.tz; cam.ty = wy - (ly - H / 2) / cam.tz;
  obmedz(); zobud(); obnovLupu();
}
function celaScena() { cam.tx = stredX; cam.ty = stredY; cam.tz = fitZ; zobud(); obnovLupu(); }
function obnovLupu() { const zoom = cam.tz > fitZ * 1.05; $('cely').hidden = !zoom; $('priblizit').hidden = cam.tz >= zMax() * 0.98; }

/* ── The print: once for the whole scene, and sharp for the view after zooming ── */
const plat = document.createElement('canvas');
const ostre = document.createElement('canvas');
let platOk = false, platS = 0, ostreOk = false, ostreR = null, ostreS = 0, ostreCas = 0;
function stratene() { inksLost(); pen = new Pen(ctx); platOk = false; ostreOk = false; pohyby.length = 0; treba = true; zobud(); }
for (const c of [cv, plat, ostre]) { c.addEventListener('contextlost', () => { platOk = false; ostreOk = false; }); c.addEventListener('contextrestored', stratene); }
OPT.lost = stratene;

function tlacPlat() {
  const s = fitZ * dpr;
  plat.width = ceil((S.SW + 2 * OKRAJ) * s); plat.height = ceil((S.SH + 2 * OKRAJ) * s);
  const g = plat.getContext('2d'), pp = new Pen(g);
  pp.scale(s);
  g.setTransform(s, 0, 0, s, -(R.x0 - OKRAJ) * s, -(R.y0 - OKRAJ) * s);
  pp.ink('paper', 1); g.fillRect(R.x0 - OKRAJ, R.y0 - OKRAJ, S.SW + 2 * OKRAJ, S.SH + 2 * OKRAJ);
  S.kresliScenu(pp, sc); S.kresliRam(pp); pp.reset();
  platOk = true; platS = s; ostreOk = false;
}
function pohladR() { const [x0, y0] = naSvet(0, 0), [x1, y1] = naSvet(W, H); return [x0, y0, x1, y1]; }
function tlacOstre() {
  const v = pohladR(), mx = (v[2] - v[0]) * 0.2, my = (v[3] - v[1]) * 0.2;
  const r = [max(v[0] - mx, R.x0 - OKRAJ), max(v[1] - my, R.y0 - OKRAJ), min(v[2] + mx, R.x1 + OKRAJ), min(v[3] + my, R.y1 + OKRAJ)];
  let s = cam.z * dpr;
  const px = (r[2] - r[0]) * (r[3] - r[1]) * s * s, lim = slabe ? 2.4e6 : 4.8e6;
  if (px > lim) s *= sqrt(lim / px);
  ostre.width = ceil((r[2] - r[0]) * s); ostre.height = ceil((r[3] - r[1]) * s);
  const g = ostre.getContext('2d'), pp = new Pen(g);
  pp.scale(s);
  g.setTransform(s, 0, 0, s, -r[0] * s, -r[1] * s);
  pp.ink('paper', 1); g.fillRect(r[0], r[1], r[2] - r[0], r[3] - r[1]);
  S.kresliScenu(pp, sc, { rect: r }); S.kresliRam(pp); pp.reset();
  ostreR = r; ostreS = s; ostreOk = true;
}
function ostreTreba() {
  if (cam.z <= fitZ * 1.08) return false;
  if (!ostreOk) return true;
  const v = pohladR();
  const vnutri = v[0] >= ostreR[0] - 1 && v[1] >= ostreR[1] - 1 && v[2] <= ostreR[2] + 1 && v[3] <= ostreR[3] + 1;
  return !vnutri || abs(cam.z * dpr / ostreS - 1) > 0.2;
}

/* ── Things that move: a found thing answers, the chimneys smoke ────────── */
const pohyby = [];                    // { k, o, r, pod, nad, t0, dur }
function prekryv(b, r) { return b && !(b[2] < r[0] || b[0] > r[2] || b[3] < r[1] || b[1] > r[3]); }
function zacniPohyb(k, t0) {
  if (pokoj()) return;
  const o = sc.ciele[k].obj, b = o.bb, pad = 14;
  const r = [max(b[0] - pad, R.x0 + 1), max(b[1] - pad - 10, R.y0 + 1), min(b[2] + pad, R.x1 - 1), min(b[3] + pad, R.y1 - 1)];
  const s = min(cam.z * dpr, 8);
  const pod = document.createElement('canvas');
  pod.width = max(1, ceil((r[2] - r[0]) * s)); pod.height = max(1, ceil((r[3] - r[1]) * s));
  const g = pod.getContext('2d'), pp = new Pen(g);
  pp.scale(s);
  g.setTransform(s, 0, 0, s, -r[0] * s, -r[1] * s);
  pp.ink('paper', 1); g.fillRect(r[0], r[1], r[2] - r[0], r[3] - r[1]);
  S.kresliScenu(pp, sc, { rect: r, az: o }); pp.reset();
  const idx = sc.objekty.indexOf(o);
  const nad = sc.objekty.slice(idx + 1).filter(q => prekryv(q.bb, r));
  for (let n = pohyby.length - 1; n >= 0; n--) if (pohyby[n].k === k) pohyby.splice(n, 1);
  pohyby.push({ k, o, r, pod, nad, t0, dur: 0.8 });
  zobud();
}
function kresliPohyby(t) {
  const c = ctx;
  for (let n = pohyby.length - 1; n >= 0; n--) {
    const q = pohyby[n], u = (t - q.t0) / q.dur;
    if (u < 0) continue;
    const g = u >= 1 ? 0 : sin(PI * u) * (u < 0.5 ? 1 : 1 - (u - 0.5) * 0.3);
    c.save(); c.beginPath(); c.rect(q.r[0], q.r[1], q.r[2] - q.r[0], q.r[3] - q.r[1]); c.clip();
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    c.drawImage(q.pod, q.r[0], q.r[1], q.r[2] - q.r[0], q.r[3] - q.r[1]);
    q.o.kresli(pen, g);
    for (const o of q.nad) o.kresli(pen, 0);
    pen.reset();
    c.restore();
    if (u >= 1) pohyby.splice(n, 1);
  }
}
let kominy = [];
function kresliDym(t) {
  const krok = Math.floor(t * 12) / 12;
  kominy.forEach(([x, y], k) => {
    const ph = (k * 0.37) % 1;
    for (let n = 0; n < 3; n++) {
      const f = (krok / 3.8 + n / 3 + ph) % 1, px = x + f * 10 + sin(f * 6 + ph * 6) * 2.4, py = y - f * 30, rr = 1.8 + f * 4.4;
      const a = (1 - f) * min(1, f * 5);
      pen.circle('blue', a * 0.3, px, py, rr);
      pen.circle('paper', a * 0.55, px - rr * 0.25, py - rr * 0.3, rr * 0.6);
    }
  });
  pen.reset();
}

/* ── Rings, the hint, misses, the keyboard glass: plain colours on top ─── */
const kruhy = new Map();              // k -> the moment its ring began
const omyly = [];                     // { x, y, t0 }
let napoveda = { krok: 0, k: -1, t0: 0, tlmit: false };
const ukazane = new Set();            // shown by the second step, until found
const kurzor = { x: 0, y: 0, vidno: false };
function kurzorVStrede() { kurzor.x = W / 2; kurzor.y = H / 2; }

function elipsa(k) {
  const b = sc.ciele[k].v.bb;
  return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2, (b[2] - b[0]) / 2 * 1.12 + 5, (b[3] - b[1]) / 2 * 1.12 + 5];
}
function kresliPrekrytie(t) {
  const c = ctx, z = cam.z, pk = pokoj();
  c.save();
  c.globalCompositeOperation = 'source-over';
  // the first step: three quarters of the print lift their ink, one stays
  if (napoveda.krok >= 1 && napoveda.tlmit) {
    const a = pk ? 1 : min(1, (t - napoveda.t0) / 0.35);
    const q = sc.ciele[napoveda.k].kvadrant, cx = stredX, cy = stredY;
    const rects = [[R.x0, R.y0, cx, cy], [cx, R.y0, R.x1, cy], [R.x0, cy, cx, R.y1], [cx, cy, R.x1, R.y1]];
    c.fillStyle = `rgba(244,236,217,${(0.55 * a).toFixed(3)})`;
    rects.forEach((rr, n) => { if (n !== q) c.fillRect(rr[0], rr[1], rr[2] - rr[0], rr[3] - rr[1]); });
    c.strokeStyle = `rgba(52,96,178,${(0.9 * a).toFixed(3)})`; c.lineWidth = 2.5 / z; c.setLineDash([]);
    const rr = rects[q]; c.strokeRect(rr[0] + 1.5 / z, rr[1] + 1.5 / z, rr[2] - rr[0] - 3 / z, rr[3] - rr[1] - 3 / z);
  }
  // rings round the things found: paper edge, ink line, drawn round once
  for (const [k, t0] of kruhy) {
    const [x, y, rx, ry] = elipsa(k);
    const u = pk ? 1 : min(1, (t - t0) / 0.32), e = 1 - Math.pow(1 - u, 3);
    const a0 = -PI / 2, a1 = a0 + TAU * (pk ? 1 : e);
    c.globalAlpha = pk ? min(1, (t - t0) / 0.15) : 1;
    c.setLineDash([]); c.lineCap = 'round';
    c.strokeStyle = 'rgba(251,246,234,0.95)'; c.lineWidth = 7 / z;
    c.beginPath(); c.ellipse(x, y, rx, ry, 0, a0, a1); c.stroke();
    c.strokeStyle = '#283046'; c.lineWidth = 3 / z;
    c.beginPath(); c.ellipse(x, y, rx, ry, 0, a0, a1); c.stroke();
    c.globalAlpha = 1;
  }
  // the second step: a dashed ring closes in on the thing
  for (const k of ukazane) {
    if (najdene[k]) continue;
    const [x, y, rx, ry] = elipsa(k), t0 = k === napoveda.k ? napoveda.t0 : 0;
    const u = pk ? 1 : min(1, (t - t0) / 0.5), f = 1 + 2.2 * Math.pow(1 - u, 3);
    c.lineCap = 'butt';
    c.strokeStyle = 'rgba(251,246,234,0.95)'; c.lineWidth = 7 / z; c.setLineDash([]);
    c.beginPath(); c.ellipse(x, y, rx * f + 3 / z, ry * f + 3 / z, 0, 0, TAU); c.stroke();
    c.strokeStyle = '#3460b2'; c.lineWidth = 3 / z; c.setLineDash([7 / z, 5 / z]);
    c.beginPath(); c.ellipse(x, y, rx * f + 3 / z, ry * f + 3 / z, 0, 0, TAU); c.stroke();
  }
  c.setLineDash([]);
  // a tap on nothing: a small ink mark that fades
  for (let n = omyly.length - 1; n >= 0; n--) {
    const q = omyly[n], u = (t - q.t0) / 0.6;
    if (u >= 1) { omyly.splice(n, 1); continue; }
    const s = (pk ? 1 : 0.6 + 0.4 * min(1, u * 3)) * 6 / z;
    c.globalAlpha = 0.7 * (1 - u);
    c.strokeStyle = '#283046'; c.lineWidth = 2.2 / z; c.lineCap = 'round';
    c.beginPath(); c.moveTo(q.x - s, q.y - s * 0.4); c.lineTo(q.x + s, q.y + s * 0.4); c.moveTo(q.x - s * 0.3, q.y + s * 0.8); c.lineTo(q.x + s * 0.3, q.y - s * 0.8); c.stroke();
    c.globalAlpha = 1;
  }
  // the looking glass for keys
  if (kurzor.vidno) {
    const [x, y] = naSvet(kurzor.x, kurzor.y), rr = 20 / z;
    c.strokeStyle = 'rgba(251,246,234,0.95)'; c.lineWidth = 6 / z;
    c.beginPath(); c.arc(x, y, rr, 0, TAU); c.stroke();
    c.strokeStyle = '#3460b2'; c.lineWidth = 2.5 / z;
    c.beginPath(); c.arc(x, y, rr, 0, TAU); c.moveTo(x - rr * 0.45, y); c.lineTo(x + rr * 0.45, y); c.moveTo(x, y - rr * 0.45); c.lineTo(x, y + rr * 0.45); c.stroke();
  }
  // ?debug=hit: what the game measured, to hold against the drawing
  if (LADENIE) {
    const tol = S.TOL_DOTYK / z;
    for (const cl of sc.ciele) {
      const B = cl.v.body;
      c.fillStyle = 'rgba(20,90,255,0.35)';
      for (let i = 0; i < B.length; i += 8) c.fillRect(B[i] - 0.5, B[i + 1] - 0.5, 1, 1);
      const b = cl.v.bb;
      c.strokeStyle = 'rgba(220,0,80,0.9)'; c.lineWidth = 1 / z;
      c.strokeRect(b[0] - tol, b[1] - tol, b[2] - b[0] + 2 * tol, b[3] - b[1] + 2 * tol);
    }
  }
  c.restore();
}
function efektyBezia(t) {
  if (pohyby.length) return true;
  if (omyly.length) return true;
  for (const [, t0] of kruhy) if (t - t0 < 0.4) return true;
  if (napoveda.krok >= 1 && t - napoveda.t0 < 0.6) return true;
  return false;
}

/* ── Drawing a frame ────────────────────────────────────────────────────── */
function kresli(t) {
  if (!platOk || abs(platS - fitZ * dpr) > 1e-6) tlacPlat();
  const c = ctx, a = cam.z * dpr;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  c.fillStyle = '#f4ecd9'; c.fillRect(0, 0, cv.width, cv.height);
  c.setTransform(a, 0, 0, a, cv.width / 2 - cam.x * a, cv.height / 2 - cam.y * a);
  c.imageSmoothingEnabled = true;
  c.drawImage(plat, R.x0 - OKRAJ, R.y0 - OKRAJ, S.SW + 2 * OKRAJ, S.SH + 2 * OKRAJ);
  if (ostreOk && cam.z > fitZ * 1.04) c.drawImage(ostre, ostreR[0], ostreR[1], ostreR[2] - ostreR[0], ostreR[3] - ostreR[1]);
  pen.scale(a);
  kresliPohyby(t);
  if (!pokoj()) kresliDym(t);
  kresliPrekrytie(t);
}

/* ── The loop: runs only while something moves ─────────────────────────── */
let beh = false, predT = 0, poslednaSnimka = 0, posledny = performance.now(), treba = true;
function zobud() { if (!beh && !document.hidden) { beh = true; predT = 0; requestAnimationFrame(snimka); } }
function vstup() { posledny = performance.now(); zobud(); }
function snimka(now) {
  if (document.hidden || !sc) { beh = false; return; }
  const dt = min(0.1, predT ? (now - predT) / 1000 : 0.016); predT = now;
  const t = now / 1000;
  const kam = pohniKameru(dt);
  const ef = efektyBezia(t);
  const dym = !pokoj() && kominy.length > 0 && now - posledny < 40000;
  const cas = dym && now - poslednaSnimka >= 1000 / 12 - 3;
  if (kam || treba || ef || cas) { kresli(t); poslednaSnimka = now; treba = false; }
  // the sharp part is printed once the view has settled
  let caka = false;
  if (!kam && !tah && !stip && ostreTreba()) {
    if (!ostreCas) ostreCas = now;
    if (now - ostreCas > 140) { tlacOstre(); ostreCas = 0; treba = true; }
    caka = true;
  } else ostreCas = 0;
  if (kam) obnovLupu();
  if (!kam && !ef && !dym && !treba && !caka) { beh = false; return; }
  requestAnimationFrame(snimka);
}

/* ── Input: one finger drags, two pinch, a tap looks ───────────────────── */
const prsty = new Map();
let tah = null, stip = null;
const tuky = [];
cv.addEventListener('pointerdown', e => {
  try { cv.setPointerCapture(e.pointerId); } catch (x) { /* fine */ }
  prsty.set(e.pointerId, { x: e.clientX, y: e.clientY });
  kurzor.vidno = false;
  vstup();
  if (prsty.size === 1) {
    tah = { id: e.pointerId, sx: e.clientX, sy: e.clientY, cx: cam.x, cy: cam.y, t0: performance.now(), pohol: false, vx: 0, vy: 0, lx: e.clientX, ly: e.clientY, lt: performance.now(), typ: e.pointerType };
    cam.vx = cam.vy = 0;
  } else if (prsty.size === 2) {
    const [a, b] = [...prsty.values()], r = cv.getBoundingClientRect();
    const mx = (a.x + b.x) / 2 - r.left, my = (a.y + b.y) / 2 - r.top;
    stip = { d: hypot(a.x - b.x, a.y - b.y) || 1, z: cam.z, w: naSvet(mx, my) };
    if (tah) tah.pohol = true;
  }
});
cv.addEventListener('pointermove', e => {
  if (!prsty.has(e.pointerId)) return;
  prsty.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (stip && prsty.size >= 2) {
    const [a, b] = [...prsty.values()], r = cv.getBoundingClientRect();
    const nz = clampZ(stip.z * hypot(a.x - b.x, a.y - b.y) / stip.d);
    const mx = (a.x + b.x) / 2 - r.left, my = (a.y + b.y) / 2 - r.top;
    cam.z = cam.tz = nz;
    cam.x = cam.tx = stip.w[0] - (mx - W / 2) / nz; cam.y = cam.ty = stip.w[1] - (my - H / 2) / nz;
    treba = true; vstup(); return;
  }
  if (!tah || e.pointerId !== tah.id) return;
  const dx = e.clientX - tah.sx, dy = e.clientY - tah.sy;
  if (!tah.pohol && hypot(dx, dy) > 8) { tah.pohol = true; cv.classList.add('tahane'); }
  if (!tah.pohol) return;
  const [lx, hx, ly, hy] = hranice2(cam.z);
  cam.x = cam.tx = guma(tah.cx - dx / cam.z, lx, hx);
  cam.y = cam.ty = guma(tah.cy - dy / cam.z, ly, hy);
  const now = performance.now(), d = (now - tah.lt) / 1000;
  if (d > 0) {
    tah.vx = tah.vx * 0.6 + (-(e.clientX - tah.lx) / cam.z / d) * 0.4;
    tah.vy = tah.vy * 0.6 + (-(e.clientY - tah.ly) / cam.z / d) * 0.4;
  }
  tah.lx = e.clientX; tah.ly = e.clientY; tah.lt = now;
  treba = true; vstup();
});
function pustenie(e) {
  prsty.delete(e.pointerId);
  cv.classList.remove('tahane');
  if (stip) { if (prsty.size < 2) { stip = null; tah = null; cam.tz = cam.z; obmedz(); vstup(); obnovLupu(); } return; }
  if (!tah || e.pointerId !== tah.id) return;
  const t = tah; tah = null;
  if (!t.pohol) {
    if (e.type === 'pointerup' && performance.now() - t.t0 < 700) { const r = cv.getBoundingClientRect(); tapni(e.clientX - r.left, e.clientY - r.top, t.typ); }
    return;
  }
  if (!pokoj() && performance.now() - t.lt < 90) { cam.tx = cam.x + t.vx * 0.2; cam.ty = cam.y + t.vy * 0.2; }
  obmedz(); vstup();
}
cv.addEventListener('pointerup', pustenie);
cv.addEventListener('pointercancel', pustenie);
cv.addEventListener('wheel', e => {
  e.preventDefault();
  const r = cv.getBoundingClientRect();
  const f = Math.exp(-e.deltaY * (e.deltaMode ? 0.06 : 0.0016));
  priblizNa(e.clientX - r.left, e.clientY - r.top, cam.tz * f); vstup();
}, { passive: false });
cv.addEventListener('dblclick', e => {
  const r = cv.getBoundingClientRect();
  if (cam.tz > fitZ * 1.5) celaScena(); else priblizNa(e.clientX - r.left, e.clientY - r.top, cam.tz * 2);
  vstup();
});
cv.addEventListener('keydown', e => {
  const k = e.key, krok = e.shiftKey ? 6 : 18;
  let pohyb = null;
  if (k === 'ArrowLeft') pohyb = [-krok, 0]; else if (k === 'ArrowRight') pohyb = [krok, 0];
  else if (k === 'ArrowUp') pohyb = [0, -krok]; else if (k === 'ArrowDown') pohyb = [0, krok];
  if (pohyb) {
    kurzor.vidno = true;
    kurzor.x = min(W - 8, max(8, kurzor.x + pohyb[0])); kurzor.y = min(H - 8, max(8, kurzor.y + pohyb[1]));
    // near the edge of the view the camera follows the glass
    const okraj = 48;
    if (cam.tz > fitZ * 1.02 && (kurzor.x < okraj || kurzor.x > W - okraj || kurzor.y < okraj || kurzor.y > H - okraj)) {
      cam.tx += (kurzor.x < okraj ? -1 : kurzor.x > W - okraj ? 1 : 0) * krok * 2 / cam.tz;
      cam.ty += (kurzor.y < okraj ? -1 : kurzor.y > H - okraj ? 1 : 0) * krok * 2 / cam.tz;
      obmedz();
    }
  } else if (k === 'Enter' || k === ' ') { kurzor.vidno = true; tapni(kurzor.x, kurzor.y, 'keyboard'); }
  else if (k === '+' || k === '=') priblizNa(kurzor.x, kurzor.y, cam.tz * 1.5);
  else if (k === '-' || k === '_') priblizNa(kurzor.x, kurzor.y, cam.tz / 1.5);
  else if (k === '0' || k === 'Home') celaScena();
  else if (k === 'h' || k === 'H') klikNapoveda();
  else return;
  e.preventDefault(); treba = true; vstup();
});
cv.addEventListener('focus', () => { let k = false; try { k = cv.matches(':focus-visible'); } catch (e) { /* older browsers */ } if (k) { kurzor.vidno = true; treba = true; zobud(); } });
cv.addEventListener('blur', () => { kurzor.vidno = false; treba = true; zobud(); });
$('priblizit').addEventListener('click', () => { priblizNa(W / 2, H / 2, cam.tz * 1.8); vstup(); });
$('cely').addEventListener('click', () => { celaScena(); vstup(); cv.focus({ preventScroll: true }); });

/* ── A tap: what is under it ───────────────────────────────────────────── */
function tapni(lx, ly, typ) {
  const now = performance.now();
  // more than four taps a second are let go quietly: a guard, not a penalty
  while (tuky.length && now - tuky[0] > 1000) tuky.shift();
  if (tuky.length >= 4) return;
  tuky.push(now);
  if (!ulozene.videl) { ulozene.videl = true; skryBublinu(); }
  if (napoveda.tlmit) { napoveda.tlmit = false; treba = true; }
  const [wx, wy] = naSvet(lx, ly);
  const tol = (typ === 'mouse' ? S.TOL_MYS : S.TOL_DOTYK) / cam.z;
  const hladane = [], idx = [];
  sc.ciele.forEach((c, k) => { if (!najdene[k]) { hladane.push(c.v); idx.push(k); } });
  const n = S.zasahni({ ciele: hladane.map(v => ({ v })) }, wx, wy, tol);
  if (n >= 0) { najdi(idx[n]); return; }
  // a thing already found answers again, and that is not a miss
  const hotove = [], hidx = [];
  sc.ciele.forEach((c, k) => { if (najdene[k]) { hotove.push({ v: c.v }); hidx.push(k); } });
  const m = S.zasahni({ ciele: hotove }, wx, wy, tol);
  if (m >= 0) { zacniPohyb(hidx[m], performance.now() / 1000); return; }
  if (postup.hotovo) return;
  postup.m++;
  omyly.push({ x: wx, y: wy, t0: now / 1000 });
  zvukMimo();
  treba = true; zobud();
  ulozSkoro();
}

function najdi(k) {
  najdene[k] = true;
  if (!postup.f.includes(k)) postup.f.push(k);
  const t = performance.now() / 1000;
  kruhy.set(k, t);
  zacniPohyb(k, t);
  ukazane.delete(k);
  const kolko = najdene.filter(Boolean).length, N = sc.ciele.length;
  zvukNajdi(kolko - 1);
  oznacRiadok(k);
  if (napoveda.k === k) zrusNapovedu();
  oznam(`Found the ${sc.ciele[k].meno}. ${kolko} of ${N}.`);
  treba = true; zobud();
  zapis();
  if (kolko === N) koniec(true);
}

/* ── The hint, in two steps, free ──────────────────────────────────────── */
function najtazsi() {
  let best = -1;
  sc.ciele.forEach((c, k) => { if (!najdene[k] && !ukazane.has(k) && (best < 0 || c.tazkost > sc.ciele[best].tazkost)) best = k; });
  return best;
}
function klikNapoveda() {
  if (postup.hotovo) { dalsia(); return; }
  const t = performance.now() / 1000;
  if (napoveda.krok === 1 && !najdene[napoveda.k]) {
    // second step: show me
    const c = sc.ciele[napoveda.k];
    ukazane.add(napoveda.k);
    napoveda = { krok: 2, k: napoveda.k, t0: t, tlmit: false };
    postup.h++;
    const veta = `Here is the ${c.meno}${c.veta ? ', ' + c.veta : ''}. Tap it.`;
    bublina(veta); oznam(veta);
    zvukNapoveda(2);
    napovedaText('Hint');
  } else {
    const k = najtazsi();
    if (k < 0) { const v = 'The rest are circled. Tap them.'; bublina(v); oznam(v); return; }
    const c = sc.ciele[k];
    napoveda = { krok: 1, k, t0: t, tlmit: true };
    postup.h++;
    const veta = `Look ${c.kvadrant === 0 ? 'at the top left' : c.kvadrant === 1 ? 'at the top right' : c.kvadrant === 2 ? 'at the bottom left' : 'at the bottom right'}: the ${c.meno} is there.`;
    bublina(veta); oznam(veta);
    zvukNapoveda(1);
    napovedaText('Show me');
    for (const li of zoznamLi) li.classList.remove('hladane');
    zoznamLi[k].classList.add('hladane');
  }
  treba = true; zobud(); zapis();
}
function zrusNapovedu() {
  napoveda = { krok: 0, k: -1, t0: 0, tlmit: false };
  napovedaText(postup.hotovo ? nazovDalej() : 'Hint');
  for (const li of zoznamLi) li.classList.remove('hladane');
}
function napovedaText(s) { $('napoveda-text').textContent = s; $('napoveda').classList.toggle('dalej', !!postup && postup.hotovo); }
$('napoveda').addEventListener('click', () => { vstup(); klikNapoveda(); });
$('video-ano').addEventListener('click', async () => { if (!REKLAMA_ZAPNUTA) return; await reklama.odmena('hint'); });
$('video-nie').addEventListener('click', () => { $('video').hidden = true; });

/* ── Notes on screen and for screen readers ────────────────────────────── */
let bublinaCas = 0;
function bublina(text, trvanie = 6000) {
  const el = $('bublina');
  el.textContent = text; el.hidden = false;
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  clearTimeout(bublinaCas);
  if (trvanie) bublinaCas = setTimeout(skryBublinu, trvanie);
}
function skryBublinu() { $('bublina').hidden = true; }
let oznamCas = 0;
function oznam(text) {
  const el = $('oznam');
  el.textContent = '';
  clearTimeout(oznamCas);
  oznamCas = setTimeout(() => { el.textContent = text; }, 30);
}

/* ── The list below the print ──────────────────────────────────────────── */
let zoznamLi = [];
function ikona(canvas, c) {
  const n = canvas.width, g = canvas.getContext('2d'), pp = new Pen(g);
  const bb = hranice(p => S.kresliIkonu(p, c, 1));
  const w = max(1, bb[2] - bb[0]), h = max(1, bb[3] - bb[1]), s = min(n * 0.76 / w, n * 0.76 / h);
  g.setTransform(1, 0, 0, 1, 0, 0);
  pp.scale(s);
  pp.ink('paper', 1); g.fillRect(0, 0, n, n);
  g.setTransform(s, 0, 0, s, n / 2 - (bb[0] + bb[2]) / 2 * s, n / 2 - (bb[1] + bb[3]) / 2 * s);
  S.kresliIkonu(pp, c, 1);
  pp.reset();
}
function postavZoznam() {
  const ul = $('zoznam');
  ul.textContent = '';
  ul.style.setProperty('--n', String(sc.ciele.length));
  zoznamLi = sc.ciele.map((c, k) => {
    const li = document.createElement('li');
    const cvs = document.createElement('canvas'); cvs.width = cvs.height = 112; cvs.setAttribute('aria-hidden', 'true');
    const meno = document.createElement('span'); meno.className = 'meno';
    const stav = document.createElement('span'); stav.className = 'sr';
    li.append(cvs, meno, stav);
    meno.textContent = c.meno.charAt(0).toUpperCase() + c.meno.slice(1);
    ul.appendChild(li);
    try { ikona(cvs, c); } catch (e) { /* an icon is a nicety; the name is there */ }
    li._stav = stav;
    return li;
  });
  zoznamLi.forEach((li, k) => oznacRiadok(k, true));
}
function oznacRiadok(k) {
  const li = zoznamLi[k]; if (!li) return;
  li.classList.toggle('najdene', !!najdene[k]);
  li._stav.textContent = najdene[k] ? ', found' : ', not found yet';
  if (najdene[k]) li.classList.remove('hladane');
  $('zoznam-h').textContent = `Things to find, ${najdene.filter(Boolean).length} of ${sc.ciele.length} found`;
}

/* ── The end of a scene ────────────────────────────────────────────────── */
function nazovDalej() { return rezim === 'den' && !lenSemienko ? 'Endless' : 'Next'; }
function koniec(animuj) {
  postup.hotovo = true;
  zapis();
  zrusNapovedu();
  const N = sc.ciele.length;
  if (animuj && !pokoj()) {
    // the scene answers: everything found moves once, one after another
    const t = performance.now() / 1000 + 0.45;
    postup.f.forEach((k, n) => zacniPohyb(k, t + n * 0.16));
    zvukKoniec();
    setTimeout(ukazKartu, 1100 + N * 160);
  } else ukazKartu();
}
function trvanie(s) { s = round(s); return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`; }
function ukazKartu() {
  const N = sc.ciele.length;
  $('koniec-h').textContent = rezim === 'den' && !lenSemienko ? "Today's scene: all found" : `Scene ${lenSemienko ? lenSemienko : ulozene.nek.n}: all found`;
  $('koniec-text').textContent = `You found all ${N} in ${sc.meno}.` + (ulozene.n.cas ? ` It took ${trvanie(postup.s)}.` : '');
  const h = postup.h, m = postup.m;
  $('koniec-cisla').textContent = `${h === 0 ? 'No hints' : h === 1 ? '1 hint' : h + ' hints'}, ${m === 0 ? 'no taps on nothing' : m === 1 ? '1 tap on nothing' : m + ' taps on nothing'}.` + (rezim === 'den' && !lenSemienko ? ' A new scene comes at midnight in Bratislava.' : '');
  $('dalsia').textContent = rezim === 'den' && !lenSemienko ? 'Play endless scenes' : 'Next scene';
  $('koniec').hidden = false;
  oznam($('koniec-h').textContent + '. ' + $('koniec-text').textContent);
}
$('pozriet').addEventListener('click', () => { $('koniec').hidden = true; cv.focus({ preventScroll: true }); });
$('dalsia').addEventListener('click', dalsia);
function dalsia() {
  $('koniec').hidden = true;
  if (rezim === 'den' || lenSemienko) { if (lenSemienko) { location.search = ''; return; } prepniRezim('nek'); return; }
  ulozene.nek = novyPostup(ulozene.nek.n + 1);
  zapis();
  nacitaj();
}

/* ── Loading a scene ───────────────────────────────────────────────────── */
function kratkyDatum(d) {
  try { return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(d + 'T12:00:00Z')); }
  catch (e) { return d; }
}
function nacitaj() {
  if (lenSemienko) { sc = S.vytvor(lenSemienko, S.UROVEN_DNA); postup = docasny; }
  else if (rezim === 'den') { sc = S.dennaScena(datum); postup = ulozene.dni[datum] || (ulozene.dni[datum] = novyPostup(0)); }
  else { sc = S.nekonecnaScena(ulozene.nek.n); postup = ulozene.nek; }
  // a save from an older drawing of this seed does not fit: start the scene again
  const o = odtlacok(sc.odtlacok);
  if (postup.o && postup.o !== o) Object.assign(postup, novyPostup(postup.n || 0), { n: postup.n });
  postup.o = o;
  postup.f = postup.f.filter(k => k < sc.ciele.length);
  najdene = sc.ciele.map((_, k) => postup.f.includes(k));
  kominy = S.kominy(sc);
  kruhy.clear(); ukazane.clear(); omyly.length = 0; pohyby.length = 0;
  for (const k of postup.f) kruhy.set(k, -10);
  napoveda = { krok: 0, k: -1, t0: 0, tlmit: false };
  $('podnazov').textContent = lenSemienko ? `Seed ${lenSemienko} · ${sc.meno}` : rezim === 'den' ? `${datum === dnes ? 'Today' : 'Day'}, ${kratkyDatum(datum)} · ${sc.meno}` : `Scene ${ulozene.nek.n} · ${sc.meno}`;
  $('r-den').setAttribute('aria-selected', String(rezim === 'den')); $('r-nek').setAttribute('aria-selected', String(rezim === 'nek'));
  $('r-den').tabIndex = rezim === 'den' ? 0 : -1; $('r-nek').tabIndex = rezim === 'nek' ? 0 : -1;
  $('scena').setAttribute('aria-labelledby', rezim === 'den' ? 'r-den' : 'r-nek');
  cv.setAttribute('aria-label', `${sc.meno}: a corner of Puzzle Village where ${sc.ciele.length} things hide`);
  $('koniec').hidden = true;
  postavZoznam();
  napovedaText(postup.hotovo ? nazovDalej() : 'Hint');
  $('video').hidden = !(REKLAMA_ZAPNUTA && reklama.dostupna());
  cam.tx = stredX; cam.ty = stredY; cam.tz = fitZ || cam.tz; cam.x = cam.tx; cam.y = cam.ty; cam.z = cam.tz;
  obnovLupu();
  platOk = false; ostreOk = false; treba = true;
  if (postup.hotovo) ukazKartu();
  else if (!ulozene.videl) bublina(`Find the ${sc.ciele.length} things on your list. Tap each one when you see it.`, 0);
  zobud();
}
function prepniRezim(r) {
  if (lenSemienko || r === rezim) return;
  rezim = r; ulozene.rezim = r; zapis();
  skryBublinu();
  nacitaj();
}
$('r-den').addEventListener('click', () => prepniRezim('den'));
$('r-nek').addEventListener('click', () => prepniRezim('nek'));
for (const b of [$('r-den'), $('r-nek')]) b.addEventListener('keydown', e => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  const r = rezim === 'den' ? 'nek' : 'den';
  prepniRezim(r); $(r === 'den' ? 'r-den' : 'r-nek').focus(); e.preventDefault();
});

/* ── Settings and sound ────────────────────────────────────────────────── */
function zvukUI() {
  const b = $('zvuk');
  b.setAttribute('aria-pressed', String(ulozene.n.zvuk));
  b.setAttribute('aria-label', ulozene.n.zvuk ? 'Sound is on. Turn sound off' : 'Sound is off. Turn sound on');
  $('ns-zvuk').checked = ulozene.n.zvuk;
}
$('zvuk').addEventListener('click', () => {
  ulozene.n.zvuk = !ulozene.n.zvuk;
  if (ulozene.n.zvuk) { zvukPriprav(); zvukNajdi(0); }
  zvukUI(); zapis();
});
function otvor(d) { try { d.showModal(); } catch (e) { d.setAttribute('open', ''); } }
$('menu').addEventListener('click', () => {
  $('ns-pokoj').checked = pokoj();
  $('ns-cas').checked = ulozene.n.cas;
  $('ns-ulozenie').textContent = ulozenieIde ? 'Your progress is saved in this browser.' : 'This browser window does not allow saving, so the scene starts again next time.';
  otvor($('nastavenia'));
});
$('ns-zvuk').addEventListener('change', e => { ulozene.n.zvuk = e.target.checked; if (ulozene.n.zvuk) zvukPriprav(); zvukUI(); zapis(); });
$('ns-pokoj').addEventListener('change', e => { ulozene.n.pokoj = e.target.checked; pohyby.length = 0; treba = true; zobud(); zapis(); });
$('ns-cas').addEventListener('change', e => { ulozene.n.cas = e.target.checked; zapis(); if (!$('koniec').hidden) ukazKartu(); });
mqReduce.addEventListener?.('change', () => { treba = true; zobud(); });

/* ── Time: counted only while the page is seen and someone plays ───────── */
let ulozCas = 0;
function ulozSkoro() { if (!ulozCas) ulozCas = setTimeout(() => { ulozCas = 0; zapis(); }, 1500); }
setInterval(() => {
  if (document.hidden || !postup || postup.hotovo) return;
  if (performance.now() - posledny > 60000) return;
  postup.s += 1;
  if (postup.s % 5 === 0) ulozSkoro();
}, 1000);
/* back after more than a second away: the GPU may have emptied the plates (a phone
   folding, memory pressure), so they are printed again, as in the village */
let skryteOd = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { skryteOd = performance.now(); zapis(); }
  else { if (skryteOd && performance.now() - skryteOd > 1000) { platOk = false; ostreOk = false; } skryteOd = 0; treba = true; zobud(); }
});
window.addEventListener('pagehide', zapis);
window.addEventListener('pageshow', e => { if (e.persisted) { platOk = false; ostreOk = false; treba = true; zobud(); } });

/* ── Start ─────────────────────────────────────────────────────────────── */
zvukUI();
new ResizeObserver(() => velkost()).observe(scena);
velkost();
nacitaj();
if (TEST) window.__lookCloser = { get sc() { return sc; }, get postup() { return postup; }, najdi, klikNapoveda, cam, S };
