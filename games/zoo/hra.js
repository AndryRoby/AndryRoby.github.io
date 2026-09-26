/* Little Island Zoo, M0: one screen, the whole core.
   The economy lives in ekonomika.mjs (pure, tested in node). This file keeps the
   park on screen: the island in inks, the list of habitats, springs for every move,
   sound only when asked for, and a save in this browser that never breaks the game. */
import * as E from './ekonomika.mjs?v=1';
import { Pen, OPT, inksLost } from '../village/riso.js?v=3';
import * as S from './scena.js?v=1';

/* The rewarded video is designed in (NAVRH.md 4.7) but switched off in M0: no ad
   network is loaded, the offer never shows, and a test fails if one is called. */
const REKLAMA_ZAPNUTA = false;
const reklama = { dostupna: () => REKLAMA_ZAPNUTA, odmena: async () => false };

const $ = id => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const TEST = Q.get('test');
const KLUC = TEST ? 'arling:zoo:test' : 'arling:zoo:v1';
const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
/* Firefox: lines and letters inked with a pattern move the canvas off the GPU for
   good (village/README.md), so there every line is printed as a fill. */
OPT.fillStrokes = /\bGecko\/\d/.test(navigator.userAgent);
const slabe = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;

/* ── Saving: every read and write may fail (private window, blocked storage) ── */
let ulozenieIde = true;
function citaj() { try { return localStorage.getItem(KLUC); } catch (e) { ulozenieIde = false; return null; } }
/* t is the moment the saved park is up to date, not the moment of writing: while the
   tab is hidden the park waits, and the time away is counted on return, capped. */
function zapis() {
  try { localStorage.setItem(KLUC, JSON.stringify({ t: posledny, s: stav, n: nastavenia })); ulozenieIde = true; }
  catch (e) { ulozenieIde = false; }
}

let posledny = Date.now();                 // the park is up to date until this moment
let stav = E.novyStav();
let nastavenia = { zvuk: false, pokoj: null };
let ulozenyCas = 0;
const surove = citaj();
if (surove) {
  try {
    const o = JSON.parse(surove);
    stav = E.nacitaj(JSON.stringify(o.s));
    ulozenyCas = Number(o.t) || 0;
    if (o.n && typeof o.n === 'object') nastavenia = { zvuk: o.n.zvuk === true, pokoj: typeof o.n.pokoj === 'boolean' ? o.n.pokoj : null };
  } catch (e) { stav = E.novyStav(); }
}
/* ?test=bohaty: a park rich enough to try studies and a voyage (its own save slot) */
if (TEST === 'bohaty' && !surove) { stav.mince = 1e13; stav.zarobene = 3e12; }
const pokoj = () => (nastavenia.pokoj == null ? mqReduce.matches : nastavenia.pokoj);

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
  if (!nastavenia.zvuk || !ac) return;
  const t = ac.currentTime + neskor, o = ac.createOscillator(), g = ac.createGain();
  o.type = typ; o.frequency.setValueAtTime(f, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(hlas, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(hlavny); o.start(t); o.stop(t + dur + 0.03);
}
const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
let kombo = 0, komboT = 0;
function zvukMinca() {
  const now = performance.now();
  kombo = now - komboT < 1500 ? Math.min(kombo + 1, PENTA.length - 1) : 0; komboT = now;
  ton(PENTA[kombo], 0.14, 'triangle', 0.2); ton(PENTA[kombo] * 2, 0.07, 'sine', 0.05, 0.02);
}
const zvukNakup = () => { ton(196, 0.08, 'square', 0.05); ton(783.99, 0.2, 'sine', 0.16, 0.035); };
const zvukMilnik = () => [659.25, 783.99, 1046.5].forEach((f, k) => ton(f, 0.26, 'triangle', 0.18, k * 0.09));
const zvukStrazca = () => { ton(1318.5, 0.08, 'sine', 0.1); ton(1760, 0.12, 'sine', 0.09, 0.07); };
const zvukPlavba = () => [261.63, 329.63, 392, 523.25].forEach((f, k) => ton(f, 1.3, 'sine', 0.1, k * 0.06));
const zvukZviera = () => ton(PENTA[2] * 1.5, 0.09, 'sine', 0.07);

/* ── Canvas, camera ─────────────────────────────────────────────────────── */
const scena = $('scena'), cv = $('svet'), ctx = cv.getContext('2d');
let pen = new Pen(ctx);
let W = S.postav(stav.ostrov);
let Wcss = 1, Hcss = 1, dpr = 1, fitZ = 1, pripravene = false;
const cam = { x: 0, y: 0, z: 1, vx: 0, vy: 0, vz: 0, tx: 0, ty: 0, tz: 1 };
const zMin = () => fitZ * 0.92, zMax = () => Math.max(fitZ * 3.2, 1.6);
const clampZ = z => Math.min(zMax(), Math.max(zMin(), z));

function stredOstrova() { const bb = W.bb; return [(bb.x0 + bb.x1) / 2, (bb.y0 + bb.y1) / 2]; }
function velkost() {
  const r = scena.getBoundingClientRect();
  Wcss = Math.max(1, Math.round(r.width)); Hcss = Math.max(1, Math.round(r.height));
  dpr = Math.min(window.devicePixelRatio || 1, slabe ? 1.5 : 2);
  cv.width = Math.round(Wcss * dpr); cv.height = Math.round(Hcss * dpr);
  const bb = W.bb, bw = bb.x1 - bb.x0, bh = bb.y1 - bb.y0;
  const pomer = pripravene ? cam.tz / fitZ : 1;
  fitZ = Math.min(Wcss / bw, Hcss / bh);
  if (!pripravene) { [cam.x, cam.y] = stredOstrova(); cam.tx = cam.x; cam.ty = cam.y; cam.z = cam.tz = fitZ; pripravene = true; }
  else { cam.z = cam.tz = clampZ(fitZ * pomer); obmedz(); cam.x = cam.tx; cam.y = cam.ty; }
  treba = true; zobud();
}
function obmedz() {
  const bb = W.bb, hw = Wcss / 2 / cam.tz, hh = Hcss / 2 / cam.tz;
  const [cx, cy] = stredOstrova();
  const mx = Math.max(0, (bb.x1 - bb.x0) / 2 - hw), my = Math.max(0, (bb.y1 - bb.y0) / 2 - hh);
  cam.tx = Math.min(cx + mx, Math.max(cx - mx, cam.tx));
  cam.ty = Math.min(cy + my, Math.max(cy - my, cam.ty));
}
/* rubber band past the edge while dragging */
function guma(v, lo, hi) { return v < lo ? lo - (lo - v) * 0.35 : v > hi ? hi + (v - hi) * 0.35 : v; }
function hraniceX() { const bb = W.bb, [cx] = stredOstrova(), m = Math.max(0, (bb.x1 - bb.x0) / 2 - Wcss / 2 / cam.z); return [cx - m, cx + m]; }
function hraniceY() { const bb = W.bb, [, cy] = stredOstrova(), m = Math.max(0, (bb.y1 - bb.y0) / 2 - Hcss / 2 / cam.z); return [cy - m, cy + m]; }

/* A critically damped spring, closed form, so it moves the same at 60 and 144 Hz. */
function pruzina(o, k, vk, tk, w, dt, eps) {
  const d = o[k] - o[tk];
  if (Math.abs(d) < eps && Math.abs(o[vk]) < eps * 4) { o[k] = o[tk]; o[vk] = 0; return false; }
  const e = Math.exp(-w * dt), a = o[vk] + w * d;
  o[k] = o[tk] + (d + a * dt) * e;
  o[vk] = (o[vk] - w * a * dt) * e;
  return true;
}
function pohniKameru(dt) {
  if (tah && tah.pohol) return true;
  if (pokoj()) { const m = cam.x !== cam.tx || cam.y !== cam.ty || cam.z !== cam.tz; cam.x = cam.tx; cam.y = cam.ty; cam.z = cam.tz; return m; }
  const a = pruzina(cam, 'x', 'vx', 'tx', 11, dt, 0.02);
  const b = pruzina(cam, 'y', 'vy', 'ty', 11, dt, 0.02);
  const c = pruzina(cam, 'z', 'vz', 'tz', 13, dt, 0.0002);
  return a || b || c;
}
function naSvet(lx, ly) { return [(lx - Wcss / 2) / cam.z + cam.x, (ly - Hcss / 2) / cam.z + cam.y]; }
function naObrazovku(wx, wy) { const r = cv.getBoundingClientRect(); return [(wx - cam.x) * cam.z + Wcss / 2 + r.left, (wy - cam.y) * cam.z + Hcss / 2 + r.top]; }
function priblizNa(cx, cy, nz) {
  const r = cv.getBoundingClientRect(), lx = cx - r.left, ly = cy - r.top;
  const [wx, wy] = naSvet(lx, ly);
  cam.tz = clampZ(nz);
  cam.tx = wx - (lx - Wcss / 2) / cam.tz; cam.ty = wy - (ly - Hcss / 2) / cam.tz;
  obmedz(); zobud();
}

/* ── The static print: printed again only when the park or the zoom changes ── */
const plat = document.createElement('canvas');
let platS = 0, platKluc = '';
plat.addEventListener('contextlost', () => { platKluc = ''; });
plat.addEventListener('contextrestored', () => { platKluc = ''; inksLost(); pen = new Pen(ctx); treba = true; zobud(); });
cv.addEventListener('contextlost', () => { platKluc = ''; });
cv.addEventListener('contextrestored', () => { inksLost(); pen = new Pen(ctx); platKluc = ''; treba = true; zobud(); });
OPT.lost = () => { inksLost(); pen = new Pen(ctx); platKluc = ''; treba = true; zobud(); };

let pop = { k: -1, t0: 0 };                // a habitat just built grows in as a sprite first
function parcely() {
  const o = E.ostrov(stav.ostrov);
  return E.TIERY.map((_, i) => ({ id: o.druhy[i], meno: E.ZVIERATA[o.druhy[i]].meno, stav: stav.d[i].n > 0 ? 'built' : E.odomknuty(stav, i) ? 'next' : 'empty' }));
}
function tlacStatiku() {
  const ciel = Math.min(4, Math.max(0.5, cam.tz * dpr));
  const pl = parcely();
  const k = pl.map(p => p.stav[0]).join('') + '|' + stav.ostrov + '|' + pop.k;
  if (k === platKluc && Math.abs(ciel / platS - 1) < 0.3) return;
  const bb = W.bb, bw = bb.x1 - bb.x0, bh = bb.y1 - bb.y0;
  const s = Math.min(ciel, 4096 / Math.max(bw, bh));
  plat.width = Math.ceil(bw * s); plat.height = Math.ceil(bh * s);
  const g = plat.getContext('2d');
  const pp = new Pen(g); pp.scale(s);
  g.setTransform(s, 0, 0, s, -bb.x0 * s, -bb.y0 * s);
  S.kresliStaticke(pp, W, pl, pop.k);
  platS = s; platKluc = k;
}

/* ── Animals, visitors, effects ─────────────────────────────────────────── */
const ZV = [];
function zvierataHabitatu(k, n) {
  const v = Math.min(slabe ? 4 : 6, Math.ceil(Math.log2(n + 1)));      // a weak phone shows fewer at once
  const arr = ZV[k] || (ZV[k] = []);
  const [ci, cj] = S.plotCenter(k);
  while (arr.length < v) {
    const a = arr.length, seed = k * 10 + a;
    arr.push({ x: ci + (S.hash(seed, 1) - 0.5) * 1.1, y: cj + (S.hash(1, seed) - 0.5) * 1.1, vx: 0, vy: 0, f: S.hash(seed, 9) < 0.5 ? -1 : 1, seed, n: a, g0: -9, voda: false });
  }
  if (arr.length > v) arr.length = v;
  return arr;
}
const VODA_PODIEL = { swans: 1, otters: 0.7, beavers: 0.6, herons: 0.4, cranes: 0.3 };
function pohybuj(dt, t) {
  const o = E.ostrov(stav.ostrov);
  for (let k = 0; k < E.TIERY.length; k++) {
    const x = stav.d[k];
    if (!x.n) continue;
    const arr = zvierataHabitatu(k, x.n), id = o.druhy[k];
    const [ci, cj] = S.plotCenter(k);
    const P = S.jeVoda(id) ? S.vodaPlochy(id, k) : null;
    for (const a of arr) {
      const per = 3.5 + S.hash(a.seed, 5) * 3.5, ep = Math.floor((t + a.seed * 1.9) / per);
      const h1 = S.hash(a.seed * 7 + 1, ep), h2 = S.hash(ep + 11, a.seed * 3 + 2);
      let tx, ty;
      if (P && S.hash(a.seed, ep + 3) < (VODA_PODIEL[id] || 0)) {
        const ang = h1 * Math.PI * 2, rr = Math.sqrt(h2) * 0.85;
        tx = P[0] + Math.cos(ang) * P[2] * rr; ty = P[1] + Math.sin(ang) * P[3] * rr;
      } else { tx = ci + (h1 - 0.5) * 1.5; ty = cj + (h2 - 0.5) * 1.5; }
      // a slow critically damped walk to the target, in small steps
      let rest = Math.min(dt, 0.25);
      while (rest > 0) {
        const h = Math.min(rest, 1 / 60); rest -= h;
        const w = 2.2;
        a.vx += (w * w * (tx - a.x) - 2 * w * a.vx) * h; a.vy += (w * w * (ty - a.y) - 2 * w * a.vy) * h;
        a.x += a.vx * h; a.y += a.vy * h;
      }
      const sx = (a.vx - a.vy) * 32;
      if (Math.abs(sx) > 4) a.f = sx > 0 ? 1 : -1;
      a.voda = !!P && ((a.x - P[0]) / P[2]) ** 2 + ((a.y - P[1]) / P[3]) ** 2 < 1.05;
    }
  }
}
const dych = (t, s) => 0.5 + 0.5 * Math.sin(t * 1.9 + s * 1.3);
const zmurk = (t, s) => { const per = 3.4 + (s * 0.73) % 2.6; return ((t + s * 1.37) % per) < 0.14; };
const gesto = (t, a) => { const u = t - a.g0; return u > 0 && u < 0.7 ? Math.sin(Math.PI * u / 0.7) : 0; };

const kruhy = [];                           // milestone rings { k, t0 }
const texty = [];                           // floating "+coins" { x, y, s, t0 }
let vyber = { k: -1, t0: 0 };
const INKY = ['blue', 'pink', 'teal', 'plum', 'orange', 'sun'];
let posledneKeeperPop = [];

/* t = the animals' clock (frozen in calm motion), tr = real time for the effects */
function kresliSprity(t, tr) {
  const p = pen, list = [], o = E.ostrov(stav.ostrov);
  const r = E.prijemSpolu(stav);
  for (let k = 0; k < E.TIERY.length; k++) {
    const x = stav.d[k];
    if (!x.n || k === pop.k) continue;
    const id = o.druhy[k], D = S.DRUH[id];
    for (const a of zvierataHabitatu(k, x.n)) {
      const [wx, wy] = S.iso(a.x, a.y);
      const g = gesto(t, a);
      list.push({ y: wy, d: () => D.kresli(p, wx, wy, D.s, a.f, dych(t, a.seed), zmurk(t, a.seed), g, t, a.n, a.voda) });
    }
    const [bi, bj] = S.boxAt(k), [bx, by] = S.iso(bi, bj);
    if (x.k) {
      const [kx, ky] = S.iso(bi + 0.28, bj + 0.28);
      list.push({ y: ky, d: () => S.osoba(p, kx, ky, 'green', 0, true, 'sun', k) });
    } else {
      const cap = E.kapacitaBoxu(stav, k) * (stav.boost > 0 ? 2 : 1), f = cap > 0 ? x.box / cap : 0;
      list.push({ y: by + 0.5, d: () => S.schranka(p, bx, by, f, f >= 0.995) });
    }
  }
  // visitors walk the ring, more of them as the park earns more
  const nv = Math.min(10, Math.max(1, Math.floor(1 + 1.4 * Math.log10(1 + r))));
  for (let v = 0; v < nv; v++) {
    const dir = v % 2 ? 1 : -1, sp = 0.09 + S.hash(v, 3) * 0.05;
    const ang = S.hash(v, 1) * Math.PI * 2 + dir * sp * t, side = (S.hash(v, 2) - 0.5) * 0.36;
    const [x, y] = S.iso(S.C[0] + Math.cos(ang) * (S.RING + side), S.C[1] + Math.sin(ang) * (S.RING + side));
    list.push({ y, d: () => S.osoba(p, x, y, INKY[v % INKY.length], t * 8 + v * 1.7, false, null, v) });
  }
  list.sort((a, b) => a.y - b.y);
  for (const s of list) s.d();
  // a habitat being built grows in with a small overshoot
  if (pop.k >= 0) {
    const u = tr - pop.t0, [ci, cj] = S.plotCenter(pop.k), [cx, cy] = S.iso(ci, cj);
    const sc = pokoj() ? 1 : pruzinaKrok(u, 16, 0.5, 0.35);
    const c = p.c; c.save(); c.translate(cx, cy); c.scale(sc, sc); c.translate(-cx, -cy);
    S.kresliParcelu(p, pop.k, parcely()[pop.k]);
    c.restore();
  }
  for (let n = kruhy.length - 1; n >= 0; n--) {
    const u = (tr - kruhy[n].t0) / 0.9;
    if (u >= 1) { kruhy.splice(n, 1); continue; }
    if (u < 0) continue;
    const [ci, cj] = S.plotCenter(kruhy[n].k), [cx, cy] = S.iso(ci, cj);
    S.kruh(p, cx, cy - 6, 1 - Math.pow(1 - u, 3));
  }
  if (vyber.k >= 0 && tr - vyber.t0 < 1.6 && tr >= vyber.t0) {
    const [ci, cj] = S.plotCenter(vyber.k), [cx, cy] = S.iso(ci, cj);
    const a = 1 - (tr - vyber.t0) / 1.6, c = p.c;
    c.setLineDash([5, 4]); c.lineDashOffset = -tr * 12;
    p.path('blue', 0.8 * a, (cc, ox, oy) => cc.ellipse(cx + ox, cy + oy, S.PLOT_W * 0.78 * 45.25, S.PLOT_W * 0.78 * 22.63, 0, 0, Math.PI * 2), 1.4);
    c.setLineDash([]); c.lineDashOffset = 0;
  }
  for (let n = texty.length - 1; n >= 0; n--) {
    const u = (tr - texty[n].t0) / 1.3;
    if (u >= 1 || u < 0) { if (u >= 1) texty.splice(n, 1); continue; }
    const q = texty[n];
    p.text('night', 0.9 * (1 - u * u), q.s, q.x, q.y - 22 - u * 18, 8, 700);
  }
  p.reset();
}
/* the value at time u of a spring from a to 1 (underdamped when z < 1) */
function pruzinaKrok(u, w, z, a) {
  if (u <= 0) return a;
  const wd = w * Math.sqrt(1 - z * z), e = Math.exp(-z * w * u);
  return 1 - (1 - a) * e * (Math.cos(wd * u) + (z * w / wd) * Math.sin(wd * u));
}

function kresli(t, tr) {
  const c = ctx, z = cam.z * dpr;
  const ox = cv.width / 2 - cam.x * z, oy = cv.height / 2 - cam.y * z;
  c.setTransform(z, 0, 0, z, ox, oy);
  pen.scale(z);
  // paper everywhere, in the same grain as the printed island
  pen.ink('paper', 1);
  const [x0, y0] = naSvet(0, 0), [x1, y1] = naSvet(Wcss, Hcss);
  c.fillRect(x0 - 2, y0 - 2, x1 - x0 + 4, y1 - y0 + 4);
  c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  const bb = W.bb;
  c.imageSmoothingEnabled = true;
  c.drawImage(plat, bb.x0, bb.y0, bb.x1 - bb.x0, bb.y1 - bb.y0);
  kresliSprity(t, tr);
}

/* ── The loop: runs only while something moves ─────────────────────────── */
let beh = false, predT = 0, poslednaSnimka = 0, poslednyVstup = performance.now(), treba = true;
const ZMRAZENE_T = 12.3;
function zobud() { poslednyVstup = performance.now(); if (!beh && !document.hidden) { beh = true; predT = 0; requestAnimationFrame(snimka); } }
function snimka(now) {
  if (document.hidden) { beh = false; return; }
  const dt = Math.min(0.1, predT ? (now - predT) / 1000 : 0.016); predT = now;
  const kam = pohniKameru(dt);
  const lietaju = animujMince(now);
  const pokojne = pokoj();
  const idle = now - poslednyVstup;
  const fps = pokojne ? 0 : idle < 40000 ? (slabe ? 20 : 30) : idle < 180000 ? 12 : 0;
  const tr = now / 1000;
  // short effects draw every frame; the floating "+coins" ride along at the normal rate
  const efekt = pop.k >= 0 || kruhy.length > 0 || (vyber.k >= 0 && tr - vyber.t0 < 1.7);
  const t = pokojne ? ZMRAZENE_T : tr;
  if (pop.k >= 0 && tr - pop.t0 > 0.75) { pop.k = -1; treba = true; }
  const cas = fps > 0 && now - poslednaSnimka >= 1000 / fps - 3;
  if (kam || treba || cas || efekt) {
    if (!pokojne) pohybuj(Math.min(0.25, (now - (poslednaSnimka || now)) / 1000), t);
    tlacStatiku();
    kresli(t, tr);
    poslednaSnimka = now; treba = false;
  }
  if (!kam && !lietaju && !efekt && fps === 0 && !treba) { beh = false; return; }
  requestAnimationFrame(snimka);
}

/* ── Coins that fly to the counter ─────────────────────────────────────── */
const letVrstva = $('let'), pocitadlo = $('mince');
const letiace = [];
const bump = { s: 1, v: 0, t: 1 };
function vypustMince(sx, sy, pocet) {
  if (pokoj()) { bumpni(); return; }
  const r = pocitadlo.getBoundingClientRect(), ex = r.left + 14, ey = r.top + r.height / 2;
  for (let n = 0; n < pocet; n++) {
    const el = document.createElement('i');
    letVrstva.appendChild(el);
    letiace.push({ el, x0: sx + (S.hash(n, 4) - 0.5) * 18, y0: sy + (S.hash(4, n) - 0.5) * 10, x1: ex, y1: ey, t0: performance.now() + n * 45, prvy: n === 0 });
  }
  zobud();
}
function bumpni() { bump.v += 3.2; zobud(); }
function animujMince(now) {
  for (let n = letiace.length - 1; n >= 0; n--) {
    const m = letiace[n], u = (now - m.t0) / 1000;
    if (u < 0) { m.el.style.opacity = '0'; continue; }
    const w = 8.5, p = 1 - (1 + w * u) * Math.exp(-w * u);          // critically damped, no overshoot
    const cx = (m.x0 + m.x1) / 2, cy = Math.min(m.y0, m.y1) - 90;
    const q = 1 - p, x = q * q * m.x0 + 2 * q * p * cx + p * p * m.x1, y = q * q * m.y0 + 2 * q * p * cy + p * p * m.y1;
    const sc = 1.15 - 0.5 * p;
    m.el.style.opacity = '1';
    m.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scale(${sc.toFixed(3)})`;
    if (p > 0.965) { m.el.remove(); letiace.splice(n, 1); bumpni(); if (m.prvy) zvukMinca(); }
  }
  // the counter answers with a small bounce
  const moving = Math.abs(bump.s - 1) > 0.001 || Math.abs(bump.v) > 0.01;
  if (moving) {
    const dt = 1 / 60, w = 20, z = 0.55;
    bump.v += (-w * w * (bump.s - 1) - 2 * z * w * bump.v) * dt; bump.s += bump.v * dt;
    bump.s = Math.max(0.9, Math.min(1.14, bump.s));
    pocitadlo.style.transform = `scale(${bump.s.toFixed(4)})`;
  } else if (pocitadlo.style.transform) pocitadlo.style.transform = '';
  return letiace.length > 0 || moving;
}

/* ── Input on the island ───────────────────────────────────────────────── */
const prsty = new Map();
let tah = null, stip = null;
cv.addEventListener('pointerdown', e => {
  try { cv.setPointerCapture(e.pointerId); } catch (x) {}
  prsty.set(e.pointerId, { x: e.clientX, y: e.clientY });
  zobud();
  if (prsty.size === 1) {
    const now = performance.now();
    tah = { id: e.pointerId, sx: e.clientX, sy: e.clientY, cx: cam.x, cy: cam.y, t0: now, pohol: false, vx: 0, vy: 0, lx: e.clientX, ly: e.clientY, lt: now };
    cam.vx = cam.vy = 0;
  } else if (prsty.size === 2) {
    const [a, b] = [...prsty.values()], r = cv.getBoundingClientRect();
    const mx = (a.x + b.x) / 2 - r.left, my = (a.y + b.y) / 2 - r.top;
    stip = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, z: cam.z, w: naSvet(mx, my) };
    if (tah) tah.pohol = true;
  }
});
cv.addEventListener('pointermove', e => {
  if (!prsty.has(e.pointerId)) return;
  prsty.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (stip && prsty.size >= 2) {
    const [a, b] = [...prsty.values()], r = cv.getBoundingClientRect();
    const nz = clampZ(stip.z * Math.hypot(a.x - b.x, a.y - b.y) / stip.d);
    const mx = (a.x + b.x) / 2 - r.left, my = (a.y + b.y) / 2 - r.top;
    cam.z = cam.tz = nz;
    cam.x = cam.tx = stip.w[0] - (mx - Wcss / 2) / nz; cam.y = cam.ty = stip.w[1] - (my - Hcss / 2) / nz;
    treba = true; zobud(); return;
  }
  if (!tah || e.pointerId !== tah.id) return;
  const dx = e.clientX - tah.sx, dy = e.clientY - tah.sy;
  if (!tah.pohol && Math.hypot(dx, dy) > 8) tah.pohol = true;
  if (!tah.pohol) return;
  const [lx, hx] = hraniceX(), [ly, hy] = hraniceY();
  cam.x = cam.tx = guma(tah.cx - dx / cam.z, lx, hx);
  cam.y = cam.ty = guma(tah.cy - dy / cam.z, ly, hy);
  const now = performance.now(), d = (now - tah.lt) / 1000;
  if (d > 0) {
    tah.vx = tah.vx * 0.6 + (-(e.clientX - tah.lx) / cam.z / d) * 0.4;
    tah.vy = tah.vy * 0.6 + (-(e.clientY - tah.ly) / cam.z / d) * 0.4;
  }
  tah.lx = e.clientX; tah.ly = e.clientY; tah.lt = now;
  treba = true; zobud();
});
function pustenie(e) {
  prsty.delete(e.pointerId);
  if (stip) { if (prsty.size < 2) { stip = null; tah = null; obmedz(); zobud(); } return; }
  if (!tah || e.pointerId !== tah.id) return;
  const t = tah; tah = null;
  if (!t.pohol) { if (e.type === 'pointerup' && performance.now() - t.t0 < 600) tapni(e.clientX, e.clientY); return; }
  if (!pokoj() && performance.now() - t.lt < 90) { cam.tx = cam.x + t.vx * 0.22; cam.ty = cam.y + t.vy * 0.22; }
  obmedz(); zobud();
}
cv.addEventListener('pointerup', pustenie);
cv.addEventListener('pointercancel', pustenie);
cv.addEventListener('wheel', e => {
  e.preventDefault();
  const f = Math.exp(-e.deltaY * (e.deltaMode ? 0.06 : 0.0016));
  priblizNa(e.clientX, e.clientY, cam.tz * f);
}, { passive: false });
cv.addEventListener('dblclick', e => { priblizNa(e.clientX, e.clientY, cam.tz > fitZ * 1.5 ? fitZ : cam.tz * 1.8); });
cv.addEventListener('keydown', e => {
  const k = e.key, krok = 50 / cam.z;
  if (k === 'ArrowLeft') cam.tx -= krok; else if (k === 'ArrowRight') cam.tx += krok;
  else if (k === 'ArrowUp') cam.ty -= krok; else if (k === 'ArrowDown') cam.ty += krok;
  else if (k === '+' || k === '=') cam.tz = clampZ(cam.tz * 1.25);
  else if (k === '-' || k === '_') cam.tz = clampZ(cam.tz / 1.25);
  else if (k === '0' || k === 'Home') { [cam.tx, cam.ty] = stredOstrova(); cam.tz = fitZ; }
  else return;
  e.preventDefault(); obmedz(); zobud();
});

/* a tap: which habitat is under the finger (the ground, or the animals above it) */
function habitatPod(lx, ly) {
  const [wx, wy] = naSvet(lx, ly);
  let best = -1, bd = 1e9;
  for (const dy of [0, 14, 28]) {
    const i = (wx / 32 + (wy + dy) / 16) / 2, j = ((wy + dy) / 16 - wx / 32) / 2;
    for (let k = 0; k < E.TIERY.length; k++) {
      const [ci, cj] = S.plotCenter(k), d = Math.max(Math.abs(i - ci), Math.abs(j - cj));
      if (d < S.PLOT_W / 2 + 0.2 && d + dy * 0.01 < bd) { bd = d + dy * 0.01; best = k; }
    }
  }
  return best;
}
function tapni(cx, cy) {
  const r = cv.getBoundingClientRect(), k = habitatPod(cx - r.left, cy - r.top);
  if (k < 0) return;
  vyber = { k, t0: performance.now() / 1000 };
  const x = stav.d[k];
  if (x.n > 0) {
    for (const a of ZV[k] || []) a.g0 = performance.now() / 1000 + a.n * 0.06;
    if (!x.k && x.box >= 0.5) zber(k, cx, cy); else zvukZviera();
  }
  oznacRiadok(k);
  treba = true; zobud();
}

/* ── Actions ───────────────────────────────────────────────────────────── */
let nasobok = '1';
function zber(k, sx, sy) {
  const r = E.zber(stav, k);
  if (!(r.zisk > 0)) return;
  stav = r.stav;
  if (sx == null) { const [bi, bj] = S.boxAt(k), [wx, wy] = S.iso(bi, bj); [sx, sy] = naObrazovku(wx, wy - 12); }
  vypustMince(sx, sy, Math.min(8, 2 + Math.floor(Math.log10(1 + r.zisk))));
  if (pokoj()) zvukMinca();
  if (!pomoc.zbieral) { pomoc.zbieral = true; }
  obnov(true);
}
function kup(i) {
  const n = stav.d[i].n;
  let m = nasobok === 'max' ? Math.max(1, E.maxKupit(i, n, stav.mince)) : Number(nasobok);
  if (n === 0) m = 1;
  const r = E.kup(stav, i, m);
  if (!r.ok) return;
  stav = r.stav;
  zvukNakup();
  const meno = E.ZVIERATA[E.ostrov(stav.ostrov).druhy[i]].meno;
  const now = performance.now() / 1000;
  if (r.novy) {
    pop = { k: i, t0: now };
    oznam(`New habitat: ${meno}. Tap it to empty its box.`);
  }
  if (r.milnik) {
    if (!pokoj()) kruhy.push({ k: i, t0: now + 0.1 });
    zvukMilnik();
    oznam(`${meno}: milestone reached, twice the coins.`);
  }
  for (const a of ZV[i] || []) a.g0 = now + a.n * 0.05;
  treba = true; zobud(); obnov(true); zapis();
}
function najmi(i) {
  const r = E.najmi(stav, i);
  if (!r.ok) return;
  stav = r.stav;
  zvukStrazca();
  const meno = E.ZVIERATA[E.ostrov(stav.ostrov).druhy[i]].meno;
  oznam(`A keeper looks after the ${meno.toLowerCase()} now. Their box empties itself, even while you are away.`);
  treba = true; zobud(); obnov(true); zapis();
}
function studuj(id) {
  const r = E.kupStudiu(stav, id);
  if (!r.ok) return;
  stav = r.stav;
  zvukMilnik();
  const s = E.studie(stav).find(q => q.id === id);
  oznam(`${s.meno}: ${ucinok(s)}.`);
  obnov(true); zapis();
}
function ucinok(s) {
  if (s.druh < 0) return `the whole park earns x${s.nasobok}`;
  return `${E.ZVIERATA[E.ostrov(stav.ostrov).druhy[s.druh]].meno.toLowerCase()} earn x${s.nasobok}`;
}
function plav() {
  const r = E.plavba(stav);
  if (!r.ok) return;
  stav = r.stav;
  zvukPlavba();
  W = S.postav(stav.ostrov);
  ZV.length = 0; kruhy.length = 0; texty.length = 0; pop = { k: -1, t0: 0 }; platKluc = '';
  [cam.tx, cam.ty] = stredOstrova(); cam.tz = fitZ;
  postavZoznam();
  vyberKartu('hab');
  oznam(`Welcome to ${E.ostrov(stav.ostrov).meno}. ${r.priatelia} friends came along: +${r.priatelia * 10} % on every island.`);
  treba = true; zobud(); obnov(true); zapis();
}

/* ── The list of habitats ──────────────────────────────────────────────── */
const riadky = [];
const pomoc = { zbieral: false };
function ikonka(canvas, id) {
  const g = canvas.getContext('2d'), p = new Pen(g), D = S.DRUH[id];
  const s = 2.35;
  g.setTransform(1, 0, 0, 1, 0, 0);
  p.scale(s);
  g.setTransform(s, 0, 0, s, canvas.width / 2, canvas.height * 0.8);
  p.ink('paper', 1); g.fillRect(-40, -40, 80, 80);
  D.kresli(p, 0, 0, D.s * (id === 'herons' || id === 'cranes' ? 0.7 : 1), 1, 0.5, false, 0, 0, 0, id === 'swans' || id === 'otters');
  p.reset();
}
function postavZoznam() {
  const ol = $('habitaty'), o = E.ostrov(stav.ostrov);
  ol.textContent = '';
  riadky.length = 0;
  for (let i = 0; i < E.TIERY.length; i++) {
    const z = E.ZVIERATA[o.druhy[i]];
    const li = document.createElement('li');
    li.className = 'hab';
    li.innerHTML = '<canvas class="hab-ikona" width="96" height="96" aria-hidden="true"></canvas>'
      + '<div class="hab-text"><div class="hab-meno"><span class="hab-nazov"></span><span class="hab-pocet"></span></div>'
      + '<div class="hab-info"><span class="hab-prijem"></span><span class="hab-milnik"></span></div>'
      + '<div class="hab-pruh" aria-hidden="true"><i></i></div></div>'
      + '<div class="hab-akcie"><button type="button" class="kup"><span></span><b></b></button></div>'
      + '<div class="hab-dalsie"></div>';
    const q = sel => li.querySelector(sel);
    const row = { li, i, nazov: q('.hab-nazov'), pocet: q('.hab-pocet'), prijem: q('.hab-prijem'), milnik: q('.hab-milnik'), pruh: q('.hab-pruh i'), kup: q('.kup'), kupT: q('.kup span'), kupC: q('.kup b'), dalsie: q('.hab-dalsie'), zber: null, strazca: null, cache: {} };
    row.nazov.textContent = z.meno;
    row.kup.addEventListener('click', () => kup(i));
    const zb = document.createElement('button'); zb.type = 'button'; zb.className = 'mala zber'; zb.addEventListener('click', () => zber(i)); row.zber = zb;
    const st = document.createElement('button'); st.type = 'button'; st.className = 'mala strazca-btn'; st.addEventListener('click', () => najmi(i)); row.strazca = st;
    ol.appendChild(li);
    riadky.push(row);
    try { ikonka(q('.hab-ikona'), o.druhy[i]); } catch (e) { /* an icon is a nicety, the row works without it */ }
  }
  $('ostrov-meno').textContent = E.ostrov(stav.ostrov).meno;
}
function nastav(el, kluc, cache, hodnota, vlastnost = 'textContent') {
  if (cache[kluc] === hodnota) return;
  cache[kluc] = hodnota;
  if (vlastnost === 'textContent') el.textContent = hodnota; else el.setAttribute(vlastnost, hodnota);
}
function obnovRiadok(row) {
  const i = row.i, x = stav.d[i], c = row.cache;
  const odomk = E.odomknuty(stav, i);
  const vidno = x.n > 0 || odomk;
  if (row.li.hidden === vidno) row.li.hidden = !vidno;
  if (!vidno) return;
  const meno = E.ZVIERATA[E.ostrov(stav.ostrov).druhy[i]];
  if (x.n === 0) {
    nastav(row.pocet, 'p', c, 'new habitat');
    nastav(row.prijem, 'r', c, meno.domov);
    nastav(row.milnik, 'm', c, `each one brings ${E.formatuj(E.TIERY[i].prijem * E.nasobokPriatelov(stav.priatelia))} a second`);
    row.pruh.parentElement.hidden = true;
    const cena = E.cena(i, 0);
    nastav(row.kupT, 'kt', c, 'Build');
    nastav(row.kupC, 'kc', c, E.formatuj(cena));
    row.kup.classList.add('stavba');
    row.kup.disabled = stav.mince < cena;
    nastav(row.kup, 'al', c, `Build the ${meno.domov.toLowerCase()} for ${E.formatuj(cena)} coins`, 'aria-label');
    if (row.dalsie.firstChild) row.dalsie.textContent = '';
    return;
  }
  row.kup.classList.remove('stavba');
  row.pruh.parentElement.hidden = false;
  nastav(row.pocet, 'p', c, String(x.n));
  const prij = E.prijemDruhu(stav, i) * (stav.boost > 0 ? 2 : 1);
  nastav(row.prijem, 'r', c, `${E.formatuj(prij)} a second`);
  const dm = E.dalsiMilnik(x.n), pm = E.predoslyMilnik(x.n);
  nastav(row.milnik, 'm', c, `x2 at ${dm}`);
  const w = Math.round(100 * (x.n - pm) / (dm - pm)) + '%';
  if (c.w !== w) { c.w = w; row.pruh.style.width = w; }
  let m = nasobok === 'max' ? Math.max(1, E.maxKupit(i, x.n, stav.mince)) : Number(nasobok);
  const cena = E.cena(i, x.n, m);
  nastav(row.kupT, 'kt', c, `Add ${m}`);
  nastav(row.kupC, 'kc', c, E.formatuj(cena));
  row.kup.disabled = stav.mince < cena;
  nastav(row.kup, 'al', c, `Add ${m} ${m === 1 ? meno.jeden : meno.meno.toLowerCase()} for ${E.formatuj(cena)} coins`, 'aria-label');
  // second line: empty the box, hire a keeper
  const chceZber = !x.k && x.box >= 1, chceStr = !x.k;
  if (chceZber !== (row.zber.parentNode === row.dalsie)) { if (chceZber) row.dalsie.prepend(row.zber); else row.zber.remove(); }
  if (chceStr !== (row.strazca.parentNode === row.dalsie)) { if (chceStr) row.dalsie.append(row.strazca); else row.strazca.remove(); }
  if (chceZber) nastav(row.zber, 'z', c, `Empty the box: ${E.formatuj(x.box)}`);
  if (chceStr) {
    const ks = E.cenaStrazcu(i);
    nastav(row.strazca, 's', c, `Hire a keeper: ${E.formatuj(ks)}`);
    row.strazca.disabled = stav.mince < ks;
  }
}
function oznacRiadok(k) {
  const row = riadky[k];
  if (!row || row.li.hidden) return;
  if ($('p-hab').hidden) vyberKartu('hab');
  row.li.classList.add('vybrany');
  row.li.scrollIntoView({ block: 'nearest', behavior: pokoj() ? 'auto' : 'smooth' });
  setTimeout(() => row.li.classList.remove('vybrany'), 700);
}

/* ── The park tab: studies, the voyage, numbers ────────────────────────── */
let studieKluc = '';
function obnovPark() {
  const zoznam = E.studie(stav).filter(s => !stav.st.includes(s.id) && (s.druh < 0 || stav.d[s.druh].n > 0)).slice(0, 5);
  const k = zoznam.map(s => s.id).join(',') + '|' + stav.ostrov;
  const ol = $('studie');
  if (k !== studieKluc) {
    studieKluc = k; ol.textContent = '';
    for (const s of zoznam) {
      const li = document.createElement('li'); li.className = 'studia';
      li.innerHTML = '<div><div class="studia-meno"></div><div class="studia-ucinok"></div></div><button type="button" class="kup"><span>Study</span><b></b></button>';
      li.querySelector('.studia-meno').textContent = s.meno;
      li.querySelector('.studia-ucinok').textContent = ucinok(s);
      li.querySelector('b').textContent = E.formatuj(s.cena);
      const b = li.querySelector('button'); b.dataset.id = s.id; b.dataset.cena = String(s.cena);
      b.setAttribute('aria-label', `${s.meno}, ${ucinok(s)}, for ${E.formatuj(s.cena)} coins`);
      b.addEventListener('click', () => studuj(s.id));
      ol.appendChild(li);
    }
    if (!zoznam.length) { const li = document.createElement('li'); li.className = 'studia'; li.textContent = 'Build more habitats to find more to study.'; ol.appendChild(li); }
  }
  for (const b of ol.querySelectorAll('button[data-id]')) b.disabled = stav.mince < Number(b.dataset.cena);
  const f = E.priateliaZa(stav.zarobene);
  $('pl-priatelia').textContent = String(stav.priatelia);
  $('pl-bonus').textContent = `+${stav.priatelia * 10} %`;
  $('pl-nove').textContent = `${f} ${f === 1 ? 'friend' : 'friends'} (+${f * 10} %)`;
  const btn = $('plavba-btn');
  btn.disabled = !E.plavbaMozna(stav);
  btn.textContent = f >= E.PLAVBA_MIN ? `Sail on with ${f} friends` : 'Sail on';
  let rada;
  if (f < E.PLAVBA_MIN) {
    const dalej = E.PRIATELIA_E0 * E.PLAVBA_MIN * E.PLAVBA_MIN - stav.zarobene;
    rada = `A voyage opens at ${E.PLAVBA_MIN} friends. Earn ${E.formatuj(Math.max(0, dalej))} more coins on this island.`;
  } else if (f < Math.max(E.PLAVBA_MIN, stav.priatelia)) rada = `You can sail now. It pays most once a voyage at least doubles your friends (${stav.priatelia}).`;
  else rada = 'A good moment to sail: this voyage at least doubles your friends.';
  $('plavba-rada').textContent = rada;
  $('st-ostrov').textContent = `${stav.ostrov + 1}, ${E.ostrov(stav.ostrov).meno}`;
  $('st-tu').textContent = E.formatuj(stav.zarobene);
  $('st-spolu').textContent = E.formatuj(stav.spolu);
  $('st-offline').textContent = `up to ${E.stropOffline(stav) / 3600} h`;
  $('video-blok').hidden = !(REKLAMA_ZAPNUTA && reklama.dostupna());
}

/* ── Header numbers, hints, notes ──────────────────────────────────────── */
let posledneMince = '';
function obnov(vsetko) {
  const m = E.formatuj(stav.mince);
  if (m !== posledneMince) { posledneMince = m; pocitadlo.textContent = m; }
  const r = E.prijemSpolu(stav);
  $('rychlost').textContent = `${E.formatuj(r)} a second${stav.boost > 0 ? ', doubled' : ''}`;
  for (const row of riadky) obnovRiadok(row);
  const skryte = E.TIERY.length - riadky.filter(r2 => !r2.li.hidden).length;
  $('dalsie').textContent = skryte > 0 ? `${skryte} more ${skryte === 1 ? 'habitat waits' : 'habitats wait'} to be found on this island.` : '';
  if (vsetko || !$('p-park').hidden) obnovPark();
  obnovRadu();
}
function obnovRadu() {
  const el = $('rada');
  let t = '';
  const x0 = stav.d[0];
  if (!pomoc.zbieral && !x0.k && stav.cas < 600) t = 'Tap a habitat to empty its box.';
  else if (!stav.d.some(x => x.k) && stav.mince >= E.cenaStrazcu(0) * 0.6 && stav.cas < 1800) t = 'A keeper empties a box for you, even while you are away.';
  if (el.textContent !== t) { el.textContent = t; el.hidden = !t; }
}
let oznamCas = 0;
function oznam(text) {
  const el = $('oznam');
  el.textContent = text; el.classList.add('vidno');
  clearTimeout(oznamCas);
  oznamCas = setTimeout(() => el.classList.remove('vidno'), 3200);
}

/* ── Tabs, multiplier, dialogs, settings ───────────────────────────────── */
function vyberKartu(ktora) {
  const hab = ktora === 'hab';
  $('k-hab').setAttribute('aria-selected', String(hab)); $('k-park').setAttribute('aria-selected', String(!hab));
  $('k-hab').tabIndex = hab ? 0 : -1; $('k-park').tabIndex = hab ? -1 : 0;
  $('p-hab').hidden = !hab; $('p-park').hidden = hab;
  $('nasobok').hidden = !hab;
  if (!hab) obnovPark();
}
$('k-hab').addEventListener('click', () => vyberKartu('hab'));
$('k-park').addEventListener('click', () => vyberKartu('park'));
for (const t of [$('k-hab'), $('k-park')]) t.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const d = $('k-hab').getAttribute('aria-selected') === 'true' ? 'park' : 'hab'; vyberKartu(d); $(d === 'hab' ? 'k-hab' : 'k-park').focus(); e.preventDefault(); }
});
for (const b of $('nasobok').querySelectorAll('button')) b.addEventListener('click', () => {
  nasobok = b.dataset.m;
  for (const x of $('nasobok').querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b));
  obnov(false);
});
$('plavba-btn').addEventListener('click', () => {
  const f = E.priateliaZa(stav.zarobene);
  $('plavba-dialog').returnValue = '';
  $('pd-text').textContent = `${f} friends of the park come with you: +${f * 10} % on every island, for good (+${(stav.priatelia + f) * 10} % in all). The next island is ${E.ostrov(stav.ostrov + 1).meno}.`;
  otvor($('plavba-dialog'));
});
$('plavba-dialog').addEventListener('close', () => { if ($('plavba-dialog').returnValue === 'ano') plav(); });
function otvor(d) { try { d.showModal(); } catch (e) { d.setAttribute('open', ''); } }

function zvukUI() {
  const b = $('zvuk');
  b.setAttribute('aria-pressed', String(nastavenia.zvuk));
  b.setAttribute('aria-label', nastavenia.zvuk ? 'Sound is on. Turn sound off' : 'Sound is off. Turn sound on');
  $('ns-zvuk').checked = nastavenia.zvuk;
}
$('zvuk').addEventListener('click', () => {
  nastavenia.zvuk = !nastavenia.zvuk;
  if (nastavenia.zvuk) { zvukPriprav(); zvukMinca(); }
  zvukUI(); zapis();
});
$('menu').addEventListener('click', () => {
  $('ns-pokoj').checked = pokoj();
  $('ns-ulozenie').textContent = ulozenieIde ? 'Your park is saved in this browser, a few times a minute.' : 'This browser window does not allow saving, so the park will start again next time.';
  otvor($('nastavenia'));
});
$('ns-zvuk').addEventListener('change', e => { nastavenia.zvuk = e.target.checked; if (nastavenia.zvuk) zvukPriprav(); zvukUI(); zapis(); });
$('ns-pokoj').addEventListener('change', e => { nastavenia.pokoj = e.target.checked; treba = true; zobud(); zapis(); });
let znovaCas = 0;
$('ns-znova').addEventListener('click', e => {
  const b = e.currentTarget;
  if (!b.classList.contains('pozor')) {
    b.classList.add('pozor'); b.textContent = 'Tap again to erase this park';
    clearTimeout(znovaCas); znovaCas = setTimeout(() => { b.classList.remove('pozor'); b.textContent = 'Start a new park'; }, 4000);
    return;
  }
  clearTimeout(znovaCas);
  b.classList.remove('pozor'); b.textContent = 'Start a new park';
  stav = E.novyStav();
  W = S.postav(0); ZV.length = 0; platKluc = ''; pomoc.zbieral = false;
  [cam.tx, cam.ty] = stredOstrova(); cam.tz = fitZ;
  postavZoznam(); obnov(true); zapis();
  $('nastavenia').close();
  treba = true; zobud();
});

/* ── Welcome back ──────────────────────────────────────────────────────── */
function uvitaj(r, prec) {
  if (!(r.zisk > 0)) return;
  $('navrat-text').textContent = `You were away for ${E.formatujCas(prec)}. The keepers collected ${E.formatuj(r.zisk)} coins.`;
  $('navrat-strop').textContent = r.odrezane > 1
    ? `The park counts up to ${E.formatujCas(r.strop)} while you are away, so the last ${E.formatujCas(r.odrezane)} did not count.`
    : `The park counts up to ${E.formatujCas(r.strop)} while you are away.`;
  otvor($('navrat'));
}
$('navrat').addEventListener('close', () => {
  const r = pocitadlo.getBoundingClientRect();
  vypustMince(r.left + 40, r.top + 160, 6);
});

/* ── Time ──────────────────────────────────────────────────────────────── */
/* While the tab is hidden the park waits; on return the whole time away is counted
   once, with the same cap as a closed tab. */
function krok() {
  if (document.hidden) return;
  const now = Date.now();
  const dt = (now - posledny) / 1000; posledny = now;
  if (dt > 60) { const r = E.offline(stav, dt); stav = r.stav; uvitaj(r, dt); }
  else if (dt > 0) stav = E.tik(stav, dt);
  // keepers show what they bring: a small "+coins" over the habitat every 4 s
  const t = performance.now() / 1000, o = stav.d;
  for (let k = 0; k < o.length; k++) {
    if (!o[k].k || pokoj()) continue;
    const slot = Math.floor((t + k * 0.57) / 4);
    if (posledneKeeperPop[k] === slot) continue;
    posledneKeeperPop[k] = slot;
    const [ci, cj] = S.plotCenter(k), [x, y] = S.iso(ci, cj);
    texty.push({ x, y, s: '+' + E.formatuj(E.prijemDruhu(stav, k) * (stav.boost > 0 ? 2 : 1) * 4), t0: t });
    if (texty.length > 14) texty.shift();
  }
  obnov(false);
}

/* ── Start ─────────────────────────────────────────────────────────────── */
postavZoznam();
zvukUI();
if (ulozenyCas) {
  const prec = (Date.now() - ulozenyCas) / 1000;
  if (prec > 60) { const r = E.offline(stav, prec); stav = r.stav; setTimeout(() => uvitaj(r, prec), 400); }
  else if (prec > 0) stav = E.tik(stav, prec);
}
if (stav.cas > 30) pomoc.zbieral = true;
obnov(true);
new ResizeObserver(() => velkost()).observe(scena);
velkost();
setInterval(krok, 250);
setInterval(zapis, 5000);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) zapis();
  else { krok(); treba = true; zobud(); }
});
window.addEventListener('pagehide', zapis);
mqReduce.addEventListener?.('change', () => { treba = true; zobud(); });
if (TEST) window.__zoo = { get stav() { return stav; }, E, cam };
