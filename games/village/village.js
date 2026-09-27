/* ARLing Puzzle Village: the engine.
   Performance plan, because a pretty page that eats a laptop is not pretty:
   1. The still print (paper, island, water, houses, trees) is drawn once per
      zoom level into 512 px tiles and kept. Moving the camera only copies tiles.
   2. Every moving thing is a small sprite. Each frame asks every sprite for its
      state; only sprites whose state changed by half a pixel are redrawn, over
      a clean copy of the tiles under them. Nothing else is touched.
   3. Two loops. The hand loop runs at the screen's rate only while the view
      moves (drag, zoom, the camera gliding to a house, a house opening). The
      life loop (breathing, blinking, ripples, smoke, the walkers) runs on every
      n-th frame of the screen, 30 to 38 frames a second and evenly spaced, and
      stops after forty quiet seconds, like a print. Hidden tab or village
      scrolled away: nothing. Scrolling the page never wakes a village at rest;
      only coming back onto the screen does.
   4. Reduced motion prints one still frame and never starts a loop.
   5. My village (27 Sep 2026): a house whose puzzle was solved today has its
      window lit. The lights are drawn over the print only where something is
      drawn anyway (drawSprites): no sprite is added, and the village still
      rests after forty quiet seconds. It is not free: every full frame (a drag,
      a zoom) fills the lit panes and their bars again, at 14 of 14 up to 23 flat
      fills and 13 bars, plus one warm ring a window at dusk (the gradient is made
      once per window and kept). A light that comes on while you watch is a
      spring of 360 ms, on the hand loop, and then stops.
   All module URLs carry the same ?v= so a new engine never meets old drawings;
   bump it in every import and in index.html together. */
import { Pen, OPT, inksLost } from './riso.js?v=7';
import { build, drawStatic, HALO, panel } from './svet.js?v=7';
import { PLACES, ambient, ACT, ORDER } from './miesta.js?v=7';
import {
  HRY, svetlaDnes, dnesBratislava, msDoPolnoci, najblizsia, noveSvetla, citajVidene, zapisVidene,
  textSvetiel, textDomu, textZdielania, textOznamu, menoSuboru, rozlozenieKarty, kresliKartu, atrament, rozvrh, CASY,
  DENNE_SKLO, viditelne, vDohlade
} from './moja.js?v=7';
import { PRESETS, cssEasing } from '../../motion/src/core.js';
import { createNumber } from '../../motion/components/number/number.js';

const $ = s => document.querySelector(s);
const stage = $('#vl-stage'), cv = $('#vl-canvas');

/* CPU tiles (26 Sep 2026). A Galaxy Z Fold 7 (Adreno 830, Chrome 153) draws the village with blocks of
   noise and whole tiles printed at the wrong place, with no lost context at all (?diag showed 0), while a
   Fold 3 and desktop browsers draw it right. So on an Adreno 8xx GPU the tiles and scratch plates are
   printed on the CPU (willReadFrequently keeps a 2D canvas in memory); the screen canvas stays on the GPU.
   On a desktop that kept dragging at 13 ms a frame (p95 27 ms). The GPU name is read only on Android.
   ?soft=2 forces CPU tiles anywhere, ?soft=1 puts every canvas on the CPU (dragging 173 ms a frame on a
   desktop, a last resort), ?soft=0 turns it off; ?diag shows the GPU, the choice and lost contexts. */
const Q = new URLSearchParams(location.search);
const GPU = Q.has('diag') || /Android/.test(navigator.userAgent) ? gpuName() : '';
const ADRENO8 = /Adreno[^0-9]*[89]\d\d/.test(GPU);
const SOFT = Q.get('soft') === '1' || Q.get('soft') === '2' || (Q.get('soft') !== '0' && ADRENO8);
const SOFT_MAIN = Q.get('soft') === '1';
OPT.soft = SOFT;
function gpuName() {
  try {
    const c = document.createElement('canvas'), gl = c.getContext('webgl');
    if (!gl) return '';
    const e = gl.getExtension('WEBGL_debug_renderer_info');
    const n = String(gl.getParameter(e ? e.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    return n;
  } catch { return ''; }
}
if (stage && cv && cv.getContext) start();

/* 25 Sep 2026, Firefox 156 in a real window. Two kinds of drawing leave its fast GPU
   path: a line inked with a pattern (the grain) and letters filled with one. A line costs
   about 60 µs, and either one, once on a plate, moves that whole plate to the processor
   for good: every later copy of a tile onto it cost 7 ms instead of 0.1. Tiles took 13 to
   110 ms to print, a frame 12 to 24 ms, zooming stalled up to 107 ms. So in Gecko lines
   are printed as the filled shapes they cover, letters go through a scratch plate
   (riso.js) and the water and path unions are one nonzero fill instead of a mask
   (svet.js): the same pixels up to edge antialiasing (mean difference under 0.2 of 255).
   A test print at start could not tell the two ways apart (the cost only shows next to
   the busy main plate), so the engine is recognised by its user agent; Chrome and Safari
   keep their strokes, pixel for pixel as before. */
function isGecko() { return /\bGecko\/\d/.test(navigator.userAgent); }

function start() {
  const ctx = cv.getContext('2d', { alpha: false, willReadFrequently: SOFT_MAIN });
  const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  let reduce = mqReduce.matches;
  let weak = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  let DPR = Math.min(window.devicePixelRatio || 1, weak ? 1.5 : 2);
  // Tile size in device pixels. Chrome prints 512 px tiles fast and composes fewer of them;
  // Gecko starts with 256 px (below); any browser that prints a 512 px tile slower than 24 ms
  // twice switches to 256 px, so the size is chosen by measurement.
  // window.__vlTile = 256 or 512 before load fixes the size (tests comparing snapshots)
  const T_FIXED = window.__vlTile === 256 || window.__vlTile === 512 ? window.__vlTile : 0;
  let T = T_FIXED || 512;
  // a phone, a touch screen or a small screen keeps fewer tiles (see trim below)
  const mobile = (navigator.maxTouchPoints || 0) > 0 || matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) < 700;
  let slowTileSeen = 0, calmUntil = 0;
  const REST_MS = 40000;                   // quiet this long: the village holds still

  /* ── World ─────────────────────────────────────────────────────────── */
  const W = build(PLACES);
  const ISLE = W.frame;
  const BOUND = { x0: ISLE.x0 - 200, x1: ISLE.x1 + 200, y0: ISLE.y0 - 160, y1: ISLE.y1 + 160 };

  /* ── My village: today's lights ─────────────────────────────────────
     Read from the games' own saves in this browser (moja.js says how); nothing
     leaves it. No storage (a private window, blocked site data) reads as no
     light at all, and the village draws exactly as it would without them. */
  const readKey = k => { try { return window.localStorage ? window.localStorage.getItem(k) : null; } catch (e) { return null; } };
  const writeKey = (k, v) => { try { if (!window.localStorage) return; if (v == null) window.localStorage.removeItem(k); else window.localStorage.setItem(k, v); } catch (e) { /* the lights still show, they only come on again with ink next time */ } };
  let today = svetlaDnes(readKey, dnesBratislava());
  // houses solved since the last visit ('vl-seen'): each comes on with ink once the village is on
  // the screen and the house is in view (checkArrival below); until then its window stays dark
  let fresh = noveSvetla(today, citajVidene(readKey('vl-seen')));
  // the lights the row above the poster counts: a new one is counted CASY.start after the village shows,
  // the number rolling on then (countArrival), while its window may still wait for its house to be seen;
  // so the row never says less than was solved today once the page has arrived (review 2, V1)
  const told = new Set(today.svietia.filter(k => !fresh.includes(k)));
  const glowing = new Map();                // key -> { L: its windows (W.lights), t0: ms the ink starts, null = simply lit }
  let inkSprites = [], inkUntil = 0;        // while a light comes on: markers that tell the frame loop where to draw
  for (const k of today.svietia) {
    // a house whose puzzle is done shows its family's little scene done too (the loop drawn, the walkway laid)
    ACT.done.add(k);
    // reduced motion: every light is simply on from the first frame
    if (reduce || !fresh.includes(k)) glowing.set(k, { L: W.lights.get(k), t0: null });
  }

  const hour = new Date().getHours();
  let eve = hour >= 18 || hour < 6;
  try { const s = localStorage.getItem('vl-light'); if (s === 'day' || s === 'eve') eve = s === 'eve'; } catch (e) {}
  // every window lit today: the village rests in its early evening (unless the visitor chose day today);
  // when the last light is only coming on now, the evening follows it (lightsDone below)
  if (today.vsetky && (reduce || !fresh.length) && readKey('vl-day14') !== today.datum) eve = true;
  let sprites = [];
  function makeSprites() {
    sprites = [];
    for (const pl of PLACES) for (const s of pl.sprites()) { s.pl = pl; sprites.push(s); }
    for (const s of ambient(W, eve)) sprites.push(s);
    for (const s of inkSprites) sprites.push(s);
    for (const s of sprites) { s.k = null; s.bx = null; }
  }
  makeSprites();
  // window.__vlFill = 0 or 1 before load forces either way (for tests that compare the two)
  OPT.fillStrokes = window.__vlFill != null ? !!window.__vlFill : isGecko();
  // there a fresh 512 px tile still takes 15 to 35 ms the first time a zoom level is
  // printed, a 256 px one 3 to 8: small tiles from the start, not after the first stall
  if (OPT.fillStrokes && !T_FIXED) T = 256;

  /* ── Camera ────────────────────────────────────────────────────────── */
  let cssW = 0, cssH = 0;
  const cam = { x: 0, y: 360, z: 0.8 };
  let goal = null;                          // eased target {x, y, z}
  let vel = null;                           // pan inertia, css px per ms
  let zMin = 0.3, zMax = 4;
  const phone = () => cssW < 640;
  function fitZ() { return Math.min(cssW / (ISLE.x1 - ISLE.x0), cssH / (ISLE.y1 - ISLE.y0)); }
  // the whole island, on a phone as well: the stage there is cut to its shape
  function homeCam() { return { x: (ISLE.x0 + ISLE.x1) / 2, y: (ISLE.y0 + ISLE.y1) / 2, z: fitZ() }; }
  function clampCam(c) {
    c.z = Math.max(zMin, Math.min(zMax, c.z));
    const hw = cssW / 2 / c.z, hh = cssH / 2 / c.z;
    const bx0 = BOUND.x0, bx1 = BOUND.x1, by0 = BOUND.y0, by1 = BOUND.y1;
    c.x = (bx1 - bx0 < hw * 2) ? (bx0 + bx1) / 2 : Math.max(bx0 + hw, Math.min(bx1 - hw, c.x));
    c.y = (by1 - by0 < hh * 2) ? (by0 + by1) / 2 : Math.max(by0 + hh, Math.min(by1 - hh, c.y));
    return c;
  }
  const Z = () => cam.z * DPR;
  const OX = () => cv.width / 2 - cam.x * Z();
  const OY = () => cv.height / 2 - cam.y * Z();
  function toWorld(px, py) { return [(px - cssW / 2) / cam.z + cam.x, (py - cssH / 2) / cam.z + cam.y]; }
  function toScreen(wx, wy) { return [(wx - cam.x) * cam.z + cssW / 2, (wy - cam.y) * cam.z + cssH / 2]; }

  /* ── Tiles ─────────────────────────────────────────────────────────── */
  const tiles = new Map();
  let queue = [];
  let lvl = 1, lvl0 = 0.5, prevLvl = 0;
  const levelFor = s => Math.pow(2, Math.max(-4, Math.min(6, Math.ceil(Math.log2(s) * 2 - 0.25))) / 2);
  const tkey = (L, tx, ty) => `${L}|${tx}|${ty}|${eve ? 1 : 0}`;
  /* 26 Sep 2026: on a Galaxy Z Fold 7 (Adreno) the village came up with bands of noise and
     tiles shifted against their neighbours, every edge on a 512 px tile edge. Whatever the
     GPU does to a canvas (it loses its context and hands it back empty, or a canvas kept
     for the background comes back spoilt), a still tile is never printed again by itself.
     So: every lost context (main canvas, tiles, inks) prints everything again; a page that
     comes back from hiding, from the back button or onto another screen prints its tiles
     again quietly while the old ones still show (a new print generation); a plate is never
     reused while a live tile or a bitmap in the making points to it; and on a phone all
     tiles together keep to a budget in bytes. The picture itself is not changed. */
  let gen = 0;                              // tiles of an older generation show, but are printed again
  let plateGen = 0;                         // a plate made before a lost context is never reused
  // a finished tile is kept as an ImageBitmap only in Firefox: copying it to the plate there
  // costs half what copying its canvas does (25 Sep 2026); elsewhere it gained nothing, and a
  // canvas at least reports a lost context itself
  const useBitmaps = isGecko() && !!window.createImageBitmap;
  function free(c) {
    c.removeEventListener('contextlost', gpuLost); c.removeEventListener('contextrestored', gpuLost);
    c.pen = null; c.width = c.height = 0;   // gives its memory back now, not at the next collection
  }
  function pool(c) { if (c.width === T && c.gen === plateGen && spare.length < spareMax()) spare.push(c); else free(c); }
  // a tile taken out of the map: its bitmap is closed, its plate goes back (unless a bitmap is
  // still being made from it: then it goes back when that is done)
  function drop(rec) {
    const c = rec.c; rec.c = null;
    if (!c) return;
    if (c.close) c.close();
    else if (!rec.busy) pool(c);
  }
  function dropAll() { for (const v of tiles.values()) drop(v); tiles.clear(); queue = []; }
  function renderTile(L, tx, ty) {
    const span = T / L, wx = tx * span, wy = ty * span;
    // a plate whose tile is already kept as a bitmap is printed over again (drawStatic
    // covers it edge to edge with paper first); making a canvas, its context and a pen
    // with twelve inks for every tile cost Firefox a stall now and then
    let c = spare.pop();
    while (c && (c.width !== T || c.gen !== plateGen)) { free(c); c = spare.pop(); }
    if (!c) {
      c = document.createElement('canvas'); c.width = c.height = T; c.gen = plateGen;
      c.pen = new Pen(c.getContext('2d', { alpha: false, willReadFrequently: SOFT }));
      c.addEventListener('contextlost', gpuLost); c.addEventListener('contextrestored', gpuLost);
    }
    const p = c.pen, g = p.c;
    // back to a fresh context's state: the print reads some of it (line caps, joins)
    if (g.reset) g.reset();
    else {
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.lineWidth = 1; g.lineCap = 'butt'; g.lineJoin = 'miter';
      g.miterLimit = 10; g.setLineDash([]); g.lineDashOffset = 0; g.font = '10px sans-serif'; g.textAlign = 'start'; g.textBaseline = 'alphabetic';
    }
    g.setTransform(L, 0, 0, L, -wx * L, -wy * L);
    p.scale(L);
    drawStatic(p, W, [wx, wy, wx + span, wy + span], eve);
    return c;
  }
  const spare = [];
  function visibleTiles(L, rect) {
    const span = T / L, out = [];
    const r = rect || viewRect(0);
    for (let ty = Math.floor(r[1] / span); ty <= Math.floor(r[3] / span); ty++)
      for (let tx = Math.floor(r[0] / span); tx <= Math.floor(r[2] / span); tx++) out.push([tx, ty]);
    return out;
  }
  function viewRect(m) { const hw = cssW / 2 / cam.z, hh = cssH / 2 / cam.z; return [cam.x - hw - m, cam.y - hh - m, cam.x + hw + m, cam.y + hh + m]; }
  let zoomingUntil = 0;
  function need() {
    // while a zoom is under way the current tiles are only stretched; the
    // sharp ones for the new size are printed once the hand stops
    const zooming = performance.now() < zoomingUntil || (goal && Math.abs(Math.log(goal.z / cam.z)) > 0.01);
    // a new level lays the whole picture again: its tiles may all be kept already, and then
    // no print would ask for it (the old level stayed stretched after zooming out)
    if (!zooming && levelFor(Z()) !== lvl) { prevLvl = lvl; lvl = levelFor(Z()); full = true; }
    const want = [];
    for (const [tx, ty] of visibleTiles(lvl0, viewRect(40))) want.push([lvl0, tx, ty, 0]);
    if (lvl !== lvl0 && !zooming) for (const [tx, ty] of visibleTiles(lvl, viewRect(60))) want.push([lvl, tx, ty, 1]);
    // when nothing else is waiting, print the low tiles of the whole map ahead
    if (!want.some(w => !tiles.has(tkey(w[0], w[1], w[2])))) for (const [tx, ty] of visibleTiles(lvl0, [BOUND.x0, BOUND.y0, BOUND.x1, BOUND.y1])) want.push([lvl0, tx, ty, 2]);
    // missing tiles first; kept ones of an older generation after them, printed over again
    queue = [];
    for (const w of want) { const r = tiles.get(tkey(w[0], w[1], w[2])); if (!r) queue.push(w); else if (r.g !== gen) queue.push([w[0], w[1], w[2], w[3] + 3]); }
    const span = T / lvl;
    queue.sort((a, b) => a[3] - b[3] || (Math.hypot((a[1] + 0.5) * span - cam.x, (a[2] + 0.5) * span - cam.y) - Math.hypot((b[1] + 0.5) * span - cam.x, (b[2] + 0.5) * span - cam.y)));
  }
  let tick = 0;
  function work(budget) {
    const t0 = performance.now();
    let n = 0;
    while (queue.length && performance.now() - t0 < budget && !(n && budget < 8)) {
      const [L, tx, ty] = queue.shift();
      const k = tkey(L, tx, ty), old = tiles.get(k);
      if (old && old.g === gen) continue;
      const tt = performance.now();
      const rec = { c: renderTile(L, tx, ty), L, tx, ty, u: ++tick, g: gen, busy: false };
      tiles.set(k, rec);
      if (old) drop(old);                    // the old print showed until this very moment
      if (useBitmaps) {
        const plate = rec.c;
        rec.busy = true;
        createImageBitmap(plate).then(bm => {
          rec.busy = false;
          if (tiles.get(k) === rec && rec.c === plate) rec.c = bm; else bm.close();
          if (rec.c !== plate) pool(plate);
        }, () => { rec.busy = false; if (rec.c !== plate) pool(plate); });
      }
      const dtt = performance.now() - tt; stats.tileN++; stats.tileMs += dtt; stats.tileMax = Math.max(stats.tileMax, dtt);
      // a print over an old one, or right after a lost context, says nothing about this device
      if (T === 512 && !T_FIXED && dtt > 24 && !old && tt > calmUntil && ++slowTileSeen >= 2) { smallTiles(); return n; }
      n++;
    }
    trim();
    return n;
  }
  /* Memory. A desktop keeps 72 MiB of tiles (72 of 512 px, 288 of 256), as before; a phone,
     a touch screen or a weak device 48 MiB (40 on a weak one) and a smaller spare pool, a
     third less than before and without a bitmap next to each plate. Levels no longer in use go
     first, oldest first; only if the levels in use alone are over, the one zoomed away from and
     the sharp tiles out of view follow. Never a tile on screen, so the picture never changes. */
  const TB = () => T * T * 4;
  const tileBudget = () => (weak ? 40 : mobile ? 48 : 72) * 1048576;
  const spareMax = () => (weak || mobile ? 4 : 6);
  function trim() {
    const cap = Math.floor(tileBudget() / TB());
    if (tiles.size <= cap) return;
    const all = [...tiles.entries()].sort((a, b) => a[1].u - b[1].u);
    let out = all.filter(([, v]) => v.L !== lvl0 && v.L !== lvl && v.L !== prevLvl);
    if (tiles.size - out.length > cap) {
      const seen = new Set(visibleTiles(lvl, viewRect(60)).map(([tx, ty]) => tkey(lvl, tx, ty)));
      out = out.concat(all.filter(([k, v]) => v.L !== lvl0 && ((v.L === prevLvl && v.L !== lvl) || (v.L === lvl && !seen.has(k)))));
    }
    for (const [k, v] of out.slice(0, tiles.size - cap)) { tiles.delete(k); drop(v); }
  }
  // this browser prints a big tile too slowly: from now on the island is printed in small ones
  // (the queue is refilled at once: nothing else would ask for the tiles until the next touch)
  function smallTiles() { T = 256; dropAll(); stats.tileSize = T; full = true; need(); }
  function drawLevel(L, r, strict) {
    const z = Z(), ox = OX(), oy = OY(), span = T / L;
    let missing = false;
    for (const [tx, ty] of visibleTiles(L, r)) {
      const t = tiles.get(tkey(L, tx, ty));
      if (!t) { missing = true; continue; }
      if (strict) continue;
      t.u = ++tick;
      const dx0 = Math.round(tx * span * z + ox), dy0 = Math.round(ty * span * z + oy);
      const dx1 = Math.round((tx + 1) * span * z + ox), dy1 = Math.round((ty + 1) * span * z + oy);
      ctx.drawImage(t.c, dx0, dy0, dx1 - dx0, dy1 - dy0);
    }
    return missing;
  }
  function drawBase(r) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (drawLevel(lvl, r, true)) {
      // not all sharp tiles are ready: lay rough ones, or plain paper, under them
      if (lvl === lvl0 || drawLevel(lvl0, r, true)) { ctx.fillStyle = eve ? '#8f8ca8' : '#f4ecd9'; ctx.fillRect(Math.floor(r[0] * Z() + OX()), Math.floor(r[1] * Z() + OY()), Math.ceil((r[2] - r[0]) * Z()) + 2, Math.ceil((r[3] - r[1]) * Z()) + 2); }
      if (lvl !== lvl0) drawLevel(lvl0, r, false);
      if (prevLvl && prevLvl !== lvl0 && prevLvl !== lvl) drawLevel(prevLvl, r, false);
    }
    drawLevel(lvl, r, false);
  }

  /* ── Sprites ───────────────────────────────────────────────────────── */
  let pen = new Pen(ctx);                   // made again after a lost context
  const boxOf = (s, t) => (typeof s.box === 'function' ? s.box(t) : s.box);
  let quant = 2;                              // key steps per device pixel
  function keyOf(s, t, z) { const st = s.st(t); let k = ''; for (const v of st) k += Math.round(v * z * quant) + ','; return k; }
  const hit = (a, b) => !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
  function drawSprites(r, t) {
    ctx.setTransform(Z(), 0, 0, Z(), OX(), OY());
    pen.scale(Z()); pen.eve = eve;
    // today's lit windows first, over the print and under everything that moves
    if (glowing.size) drawLights(pen, r, performance.now());
    const list = [];
    for (const s of sprites) { const b = s.bx || boxOf(s, t); if (hit(b, r)) list.push([b[3], s]); }
    list.sort((a, b) => a[0] - b[0]);
    for (const [, s] of list) s.draw(pen, t);
    pen.reset();
  }
  /* A lit window. By day its pane is one flat warm colour (DENNE_SKLO); at dusk
     it is the full warm light over the low one every window keeps (svet.js),
     with a warm ring round it like the lamps'. Its bars (a cottage's mullion, a
     round window's cross) stay dark across the light. a < 1: the light is still
     coming on, a circle of ink growing from the middle of each pane. */
  function drawLights(p, r, now) {
    for (const g of glowing.values()) {
      if (!g.L || !g.L.bb || (r && !hit(g.L.bb, r))) continue;
      const a = g.t0 == null ? 1 : atrament(now - g.t0, reduce);
      if (a > 0) lightUp(p, g.L, a, eve);
    }
  }
  // the warm ring of a window lives in world units like the window itself, so the steady one is
  // made once per window and canvas and kept (a drag or zoom at 14 of 14 no longer makes 23 a frame)
  let rings = new WeakMap();
  function haloGrad(c, w, a) {
    const g = c.createRadialGradient(w.cx, w.cy, 0, w.cx, w.cy, HALO);
    g.addColorStop(0, 'rgba(255,196,110,' + (0.4 * a).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,196,110,0)');
    return g;
  }
  function haloKept(c, w) {
    let m = rings.get(c);
    if (!m) rings.set(c, m = new Map());
    let g = m.get(w);
    if (!g) m.set(w, g = haloGrad(c, w, 1));
    return g;
  }
  const DAYLIT = 'rgb(' + DENNE_SKLO.join(',') + ')';
  function lightUp(p, L, a, dusk) {
    const c = p.c;
    for (const w of L.polys) {
      if (dusk) {
        c.globalCompositeOperation = 'screen'; c.globalAlpha = 1;
        c.fillStyle = a >= 1 ? haloKept(c, w) : haloGrad(c, w, a);
        c.beginPath(); c.arc(w.cx, w.cy, HALO, 0, 6.2832); c.fill();
      }
      // by day, while it comes on, a little warm light spills out round the window and is gone
      // when it is on (a window is a few pixels across from afar: this is what the eye catches)
      else if (a < 1) p.circle('sun', 0.34 * Math.sin(Math.PI * a), w.cx, w.cy, HALO * a);
      c.save();
      if (a < 1) { c.beginPath(); c.arc(w.cx, w.cy, Math.max(0.01, w.R * a), 0, 6.2832); c.clip(); }
      c.globalCompositeOperation = 'source-over';
      if (dusk) panel(c, w, 1); else panel(c, w, 1, DAYLIT);
      c.restore();
    }
    p.reset();
  }

  /* ── Frames ────────────────────────────────────────────────────────── */
  let full = true, raf = 0, timer = 0, inView = true, lastFrame = 0, shown = false, wasMoving = false, settledAt = 0, lookedAt = '';
  let lastInput = performance.now();
  let tFrozen = 12.3;                       // reduced motion: one moment, kept
  const clock = now => (reduce ? tFrozen : now / 1000);
  const stats = { frames: 0, fulls: 0, partial: 0, rects: 0, tiles: 0, work: 0, tileN: 0, tileMs: 0, tileMax: 0, hz: 0, tileSize: T, fillStrokes: OPT.fillStrokes };
  window.__village = stats;
  // a house that has just opened plays its little scene on the hand loop, and so does
  // a window whose light is coming on (360 ms at the screen's own rate, then nothing)
  const acting = now => (!!ACT.k && !reduce && clock(now) - ACT.t0 < 2.8) || now < inkUntil;

  function renderFull(t) {
    const r = viewRect(4);
    drawBase(r);
    for (const s of sprites) { s.bx = boxOf(s, t); s.k = keyOf(s, t, Z()); }
    drawSprites(r, t);
    stats.fulls++;
  }
  function renderDirty(t) {
    const z = Z(), rects = [];
    const vr = viewRect(20);
    for (const s of sprites) {
      const b = boxOf(s, t);
      if (!hit(b, vr) && !(s.bx && hit(s.bx, vr))) { s.bx = b; continue; }
      const k = keyOf(s, t, z);
      if (k === s.k) continue;
      const o = s.bx || b;
      rects.push([Math.min(o[0], b[0]), Math.min(o[1], b[1]), Math.max(o[2], b[2]), Math.max(o[3], b[3])]);
      s.k = k; s.bx = b;
    }
    if (!rects.length) return 0;
    // merge rectangles that touch, so no pixel is drawn twice
    for (let a = 0; a < rects.length; a++) for (let b = a + 1; b < rects.length; b++) {
      if (hit(rects[a], rects[b])) { const A = rects[a], Bq = rects[b]; rects[a] = [Math.min(A[0], Bq[0]), Math.min(A[1], Bq[1]), Math.max(A[2], Bq[2]), Math.max(A[3], Bq[3])]; rects.splice(b, 1); b = a; }
    }
    const ox = OX(), oy = OY();
    for (const r of rects) {
      const dx0 = Math.floor(r[0] * z + ox) - 2, dy0 = Math.floor(r[1] * z + oy) - 2;
      const dx1 = Math.ceil(r[2] * z + ox) + 2, dy1 = Math.ceil(r[3] * z + oy) + 2;
      if (dx1 < 0 || dy1 < 0 || dx0 > cv.width || dy0 > cv.height) continue;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.beginPath(); ctx.rect(dx0, dy0, dx1 - dx0, dy1 - dy0); ctx.clip();
      const wr = [(dx0 - ox) / z, (dy0 - oy) / z, (dx1 - ox) / z, (dy1 - oy) / z];
      drawBase(wr);
      drawSprites(wr, t);
      ctx.restore();
    }
    stats.partial++; stats.rects += rects.length;
    return rects.length;
  }

  /* A lost GPU context: the browser hands every 2D canvas back empty (on a desktop the
     village went black for good, on a Fold it showed noise and shifted tiles). Any canvas
     of ours that reports it, lost or restored, and the next frame throws every tile, plate
     and ink away and prints them all again; the main canvas is laid again whole. */
  let lostN = 0, doneN = 0;
  function gpuLost() { lostN++; full = true; if (!raf && !timer) wake(true); }
  // ?diag: what this device got (GPU, CPU drawing, pixel ratio, tile size, lost contexts), for a screenshot
  if (Q.has('diag')) {
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;z-index:9999;padding:10px 12px;border-radius:10px;background:#111;color:#f3ead8;font:13px/1.45 ui-monospace,monospace;white-space:pre-wrap;pointer-events:none';
    document.body.appendChild(box);
    const ukaz = () => {
      const chrome = (/Chrome\/(\d+)/.exec(navigator.userAgent) || [])[1] || '?';
      box.textContent = 'GPU: ' + (GPU || 'unknown') + '\nCPU drawing: ' + (SOFT_MAIN ? 'all canvases' : SOFT ? 'tiles' : 'off') + (Q.has('soft') ? ' (forced)' : ' (auto)') +
        '\nChrome ' + chrome + ' · DPR ' + DPR + ' (device ' + (window.devicePixelRatio || 1) + ') · tile ' + T + ' px' +
        '\nview ' + innerWidth + 'x' + innerHeight + ' · screen ' + screen.width + 'x' + screen.height +
        '\ntiles ' + tiles.size + ' · lost contexts ' + lostN + (weak ? ' · weak' : '') + (mobile ? ' · mobile' : '');
    };
    ukaz(); setInterval(ukaz, 1000);
  }
  OPT.lost = gpuLost;
  cv.addEventListener('contextlost', gpuLost);
  cv.addEventListener('contextrestored', gpuLost);
  function recover() {
    doneN = lostN;
    plateGen++; gen++;
    dropAll();
    while (spare.length) free(spare.pop());
    inksLost(); pen = new Pen(ctx); rings = new WeakMap();
    calmUntil = performance.now() + 3000;
    stats.recovered = (stats.recovered || 0) + 1;
    full = true; need();
  }
  // print every tile again, quietly: the old ones show until the new ones replace them
  function reprint() { gen++; full = true; }
  let settleDue = true;
  function frame(now) {
    raf = 0;
    if (lostN !== doneN) recover();
    const dt = Math.min(64, lastFrame ? now - lastFrame : 16);
    lastFrame = now;
    const w0 = performance.now();
    let moving = false;
    if (goal) {
      const k = 1 - Math.exp(-dt / (reduce ? 1 : 110));
      const lz = Math.log(cam.z), gz = Math.log(goal.z);
      cam.x += (goal.x - cam.x) * k; cam.y += (goal.y - cam.y) * k; cam.z = Math.exp(lz + (gz - lz) * k);
      if (Math.abs(goal.x - cam.x) * cam.z < 0.3 && Math.abs(goal.y - cam.y) * cam.z < 0.3 && Math.abs(gz - Math.log(cam.z)) < 0.002) { cam.x = goal.x; cam.y = goal.y; cam.z = goal.z; goal = null; }
      clampCam(cam); moving = true; full = true;
    } else if (vel) {
      cam.x -= vel.x * dt / cam.z; cam.y -= vel.y * dt / cam.z;
      const d = Math.exp(-dt / 260); vel.x *= d; vel.y *= d;
      if (Math.hypot(vel.x, vel.y) < 0.02) vel = null;
      clampCam(cam); moving = true; full = true;
    }
    if (full || queue.length || (!goal && levelFor(Z()) !== lvl && performance.now() >= zoomingUntil)) need();
    // while the view moves, a slow device only stretches the tiles it has and
    // prints sharp ones when the hand stops; a fast one prints one per frame
    const slowTiles = stats.tileN > 2 && stats.tileMs / stats.tileN > 6;
    // right after the view settles, one tile a frame, so the hand never feels a stall
    if (moving || dragging || now < zoomingUntil) settledAt = now;
    // a tile printed over again waits until the view has been still for a moment
    const again = queue.length && queue[0][3] >= 3 && (moving || dragging || now - settledAt < 600);
    // printing tiles over again (or after a lost context) is extra work the device did not ask
    // for: it must not make the engine think the device is weak (that would lower the sharpness)
    let extra = false;
    if (queue.length && !again && !((moving || dragging) && slowTiles && queue[0][3] !== 0)) { extra = queue[0][3] >= 3 || performance.now() < calmUntil; if (work(moving || dragging || now - settledAt < 600 ? 6 : 10)) full = true; }
    const t = clock(now);
    const wasFull = full;
    if (full) { renderFull(t); full = false; if (!moving && !dragging || layer.contains(document.activeElement)) placeButtons(); else placeFloat(); }
    else if (!reduce) renderDirty(t);
    // once the view is still and every tile printed, the picture is laid once more from the
    // tiles (a copy, cheap): nothing the pieces left behind can stay on the plate
    if (moving || dragging || goal || vel || queue.length || now < zoomingUntil) settleDue = true;
    else if (settleDue) { settleDue = false; if (!wasFull) full = true; }
    if (!shown && !queue.some(q => q[3] === 0)) { shown = true; stage.classList.add('vl-ready'); countArrival(); checkArrival(); prepareCard(); }
    if (wasMoving && !moving && !dragging) placeButtons();
    // while a light waits to be seen: the view holds still somewhere new, so its house may be in view now
    if (fresh.length && shown && !moving && !dragging && !goal && !vel) {
      const at = cam.x.toFixed(1) + ',' + cam.y.toFixed(1) + ',' + cam.z.toFixed(3);
      if (at !== lookedAt) { lookedAt = at; checkArrival(); }
    }
    wasMoving = moving || dragging;
    stats.frames++; stats.tiles = tiles.size;
    const w = performance.now() - w0;
    stats.work += w;
    if (!extra) { slow.push(w); if (slow.length > 90) slow.shift(); }
    if (!weak && slow.length === 90 && slow.reduce((a, b) => a + b, 0) / 90 > 9) { weak = true; if (DPR > 1.5) setDpr(1.5); }
    schedule(moving);
  }
  const slow = [];
  // the screen's own frame, from two animation frames in a row (median of the last few)
  const ivs = [];
  let vsync = 1000 / 60, lastRaf = 0, lifeN = 0, every = 2;
  function seen(now) {
    if (lastRaf) {
      const d = now - lastRaf;
      if (d > 3 && d < 60) { ivs.push(d); if (ivs.length > 15) ivs.shift(); const s = ivs.slice().sort((a, b) => a - b); vsync = s[s.length >> 1]; }
    }
    lastRaf = now;
  }
  const onRaf = now => { raf = 0; seen(now); frame(now); };
  function lifeTick(now) {
    raf = 0; seen(now);
    // a touch, a camera on its way or tiles to print go to the hand loop at once
    if (full || dragging || goal || vel || queue.length || ++lifeN >= every) { lifeN = 0; frame(now); return; }
    raf = requestAnimationFrame(lifeTick);
  }
  function schedule(moving) {
    if (raf || timer) return;
    if (!inView || document.hidden) { lastRaf = 0; return; }
    const now = performance.now();
    // the hand loop: at the screen's rate, only while the view moves
    if (moving || queue.length || dragging || full || now < zoomingUntil + 60 || acting(now)) { quant = 2; stats.hz = Math.round(1000 / vsync); raf = requestAnimationFrame(onRaf); return; }
    if (reduce) { lastRaf = 0; return; }
    // the life loop: breathing, blinking and the walkers on every n-th frame of the
    // screen, n picked so they move at 30 frames a second or a little more, evenly
    // spaced (25 Sep 2026: a timer at 24, later 12 a second met a 60 or 75 Hz screen
    // unevenly and the animals visibly stuttered); after forty quiet seconds it rests
    const quiet = now - lastInput;
    if (quiet > REST_MS) { lastRaf = 0; sleep(); return; }
    every = Math.max(1, Math.floor(1000 / vsync / 30 + 0.05));
    quant = weak ? 1 : 2;
    stats.hz = Math.round(1000 / vsync / every);
    lifeN = 0;
    raf = requestAnimationFrame(lifeTick);
  }
  /* after forty quiet seconds the village holds still, like the print it is,
     in a calm moment (no hare in mid air); it costs nothing until a touch */
  let asleep = false;
  function sleep() {
    if (asleep) return;
    asleep = true; stats.hz = 0;
    const t = performance.now() / 1000;
    tFrozen = Math.floor(t / 2.3) * 2.3 + 1.6;
    if (ACT.k) ACT.t0 = -1e9;                // an opening scene is shown finished
    const r = reduce; reduce = true; full = true;
    frameOnce();
    reduce = r;
  }
  function frameOnce() { const r = raf; raf = 0; frame(performance.now()); if (raf) { cancelAnimationFrame(raf); raf = 0; } if (timer) { clearTimeout(timer); timer = 0; } raf = r; }
  function wake(fullRedraw) {
    if (asleep) { asleep = false; fullRedraw = true; }
    if (fullRedraw) full = true;
    lastInput = performance.now();
    if (timer) { clearTimeout(timer); timer = 0; }
    schedule(false);
  }

  /* ── Size ──────────────────────────────────────────────────────────── */
  // a new size or pixel density lays the whole picture again; another screen (a phone
  // folded or unfolded, a window moved to another monitor) prints its tiles again as well
  let scr = '';
  function resize() {
    const r = stage.getBoundingClientRect();
    const w = Math.round(r.width), h = Math.round(r.height);
    const d = Math.min(window.devicePixelRatio || 1, weak ? 1.5 : 2);
    const sc = screen.width + 'x' + screen.height;
    if (w === cssW && h === cssH && d === DPR) return;
    const first = !cssW;
    if (d !== DPR) { DPR = d; dropAll(); prevLvl = 0; }
    else if (!first && sc !== scr) reprint();
    scr = sc;
    cssW = w; cssH = h;
    cv.width = Math.round(w * DPR); cv.height = Math.round(h * DPR);
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    zMin = fitZ() * 0.9;
    zMax = Math.max(3.6, 1.5 / fitZ() * 0.9) * (phone() ? 1.2 : 1);
    lvl0 = levelFor(Math.min(1, Math.max(0.35, fitZ() * DPR)));
    if (first) Object.assign(cam, homeCam());
    clampCam(cam);
    labW = null;
    wake(true);
    checkArrival();
  }
  new ResizeObserver(resize).observe(stage);
  window.addEventListener('resize', () => { if (cssW) resize(); });

  /* ── Place buttons: real, focusable, over each open house ──────────── */
  const layer = $('#vl-places');
  const buttons = PLACES.map(pl => {
    if (pl.soon) return null;               // not out yet: nothing to open
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'vl-spot';
    b.setAttribute('aria-label', pl.square ? `${pl.name}: about the village` : `${pl.name}: ${pl.where.replace(/^The /, 'the ')}`);
    b.dataset.k = pl.kluc;
    b.addEventListener('click', () => open(pl, true, true));
    b.addEventListener('focus', () => { focusRing(pl); ensureVisible(pl); });
    b.addEventListener('blur', () => focusRing(null));
    layer.appendChild(b);
    return b;
  });
  function hitCenter(pl) { return [pl.x + pl.hit[0], pl.y + pl.hit[1]]; }
  function placeFloat() { if (openPl) placeCard(); if (hoverPl) placeTip(hoverPl); placeLabels(false); }
  function setDpr(d) {
    DPR = d; dropAll();
    cv.width = Math.round(cssW * DPR); cv.height = Math.round(cssH * DPR);
    lvl0 = levelFor(Math.min(1, Math.max(0.35, fitZ() * DPR))); prevLvl = 0; full = true;
  }
  function placeButtons() {
    PLACES.forEach((pl, n) => {
      const b = buttons[n]; if (!b) return;
      const [cx, cy] = hitCenter(pl), [sx, sy] = toScreen(cx, cy);
      const w = pl.hit[2] * 2 * cam.z, h = pl.hit[3] * 2 * cam.z;
      b.style.transform = `translate(${(sx - w / 2).toFixed(1)}px,${(sy - h / 2).toFixed(1)}px)`;
      b.style.width = w.toFixed(1) + 'px'; b.style.height = h.toFixed(1) + 'px';
    });
    if (openPl) placeCard();
    if (hoverPl) placeTip(hoverPl);
    placeLabels(true);
  }
  let ringPl = null;
  function focusRing(pl) { ringPl = pl; stage.classList.toggle('vl-focus', !!pl); }
  function ensureVisible(pl) {
    const [cx, cy] = hitCenter(pl), [sx, sy] = toScreen(cx, cy);
    const m = 60;
    if (sx < m || sy < m || sx > cssW - m || sy > cssH - m) { goal = clampCam({ x: cx, y: cy, z: cam.z }); wake(true); }
  }

  /* ── Name labels: from afar the signs on the plate are a few pixels, so
     readable names sit over the houses until the signs themselves can be read */
  const LAB_Z = 1.2;
  const labLayer = document.createElement('div');
  labLayer.className = 'vl-labels'; labLayer.setAttribute('aria-hidden', 'true');
  layer.after(labLayer);
  // a label is a box placed over its house (s) and its face (f): the face is what lands when the
  // house's light comes on. A house lit today shows a small warm window before its name, so from
  // afar, where a window is a few pixels, the lit houses still read at a glance. A house solved
  // today keeps the window's room from the start, even while its light waits to be seen, so the
  // box is measured and placed once and never moves when the light comes on (review 2, D1).
  const labs = PLACES.filter(pl => !pl.square).map(pl => {
    const s = document.createElement('span');
    s.className = 'vl-lab' + (pl.soon ? ' vl-lab-soon' : '');
    const f = document.createElement('span'); f.className = 'vl-lab-in';
    const win = document.createElement('i'); win.className = 'vl-lab-okno'; win.hidden = true;
    const nm = document.createElement('span'); nm.textContent = pl.name;
    f.appendChild(win); f.appendChild(nm);
    if (pl.soon) { const e = document.createElement('em'); e.textContent = 'soon'; f.appendChild(e); }
    s.appendChild(f);
    labLayer.appendChild(s);
    return { pl, s, f, win, w: 0, h: 0, dy: 0, off: false };
  });
  let labW = null, labsOn = null;
  // houses solved today claim their place first (lit or waiting, so the order never changes when a
  // light comes on), then the open ones; the ones still to come give way
  const labRank = l => (today.svietia.includes(l.pl.kluc) ? 0 : 1) + (l.pl.soon ? 2 : 0);
  function placeLabels(settle) {
    const on = cam.z < LAB_Z && !(goal && goal.z >= LAB_Z);
    if (on !== labsOn) { labsOn = on; stage.classList.toggle('vl-labs-on', on); }
    if (!on) return;
    if (!labW) { for (const l of labs) { l.w = l.s.offsetWidth; l.h = l.s.offsetHeight; } labW = true; }
    const taken = [];
    for (const l of settle ? labs.slice().sort((a, b) => labRank(a) - labRank(b)) : labs) {
      const w = l.w, h = l.h;
      const [sx, sy] = toScreen(l.pl.top[0], l.pl.top[1]);
      let x = sx - w / 2, y = sy - h - 4;
      if (settle) {
        // try over the house, then just below that spot, then above; else hide
        l.off = true;
        for (const dy of [0, h + 3, -(h + 3)]) {
          const r = [x - 2, y + dy - 2, x + w + 2, y + dy + h + 2];
          if (r[0] < 4 || r[2] > cssW - 4 || r[1] < 4 || r[3] > cssH - 4) continue;
          if (taken.some(q => hit(q, r))) continue;
          taken.push(r); l.dy = dy; l.off = false; break;
        }
        l.s.style.visibility = l.off ? 'hidden' : '';
      }
      l.s.style.transform = `translate(${x.toFixed(1)}px,${(y + l.dy).toFixed(1)}px)`;
    }
  }
  /* a house's light came on (land: now, while you watch) or went (a new day): its label shows the
     warm window or not; seen from afar, the face lands once on the press spring (CASY.stitok).
     The room for the window changes only when what was solved today changes (a new solve read,
     a new day); the light coming on only shows the window in it. */
  const LAND = cssEasing(PRESETS[CASY.stitok.pruzina], 30);
  function labelLit(k, land) {
    const l = labs.find(q => q.pl.kluc === k);
    if (!l) return;
    const room = today.svietia.includes(k), on = room && glowing.has(k);
    if (l.win.hidden === room) { l.win.hidden = !room; labW = null; full = true; }
    l.win.style.visibility = on ? '' : 'hidden';
    if (!land || !on || !labsOn || reduce || typeof l.f.animate !== 'function') return;
    const kf = [{ transform: 'scale(' + CASY.stitok.od + ')' }, { transform: 'scale(1)' }];
    try { l.f.animate(kf, { duration: LAND.duration, easing: LAND.easing }); }
    catch (e) { try { l.f.animate(kf, { duration: LAND.duration, easing: 'ease-out' }); } catch (e2) { /* the window glyph alone says it */ } }
  }

  /* ── Card ──────────────────────────────────────────────────────────── */
  const card = $('#vl-card'), tip = $('#vl-tip');
  let openPl = null, hoverPl = null;
  /* gesture: opened by a click or tap (a chime may play); hash links are quiet */
  function open(pl, fromKey, gesture) {
    if (pl.soon) return;
    if (ACT.k && ACT.k !== pl.kluc) ACT.done.add(ACT.k);
    openPl = pl;
    ACT.k = pl.kluc; ACT.t0 = reduce ? -1e9 : clock(performance.now());
    $('#vl-card-where').textContent = pl.where;
    $('#vl-card-name').textContent = pl.name;
    $('#vl-card-scene').textContent = Array.isArray(pl.scene) ? pl.scene[eve ? 1 : 0] : pl.scene;
    $('#vl-card-rule').textContent = pl.rule;
    updateCardLit();
    const a = $('#vl-card-play');
    a.href = pl.square ? '/games/' : `/games/${pl.kluc}/`;
    a.textContent = pl.square ? 'See every daily puzzle' : 'Play today’s puzzle';
    a.dataset.umamiEvent = 'village_play'; a.dataset.umamiEventGame = pl.kluc;
    card.hidden = false;
    card.classList.remove('vl-in'); void card.offsetWidth; card.classList.add('vl-in');
    // close enough that the house and its family fill about half the stage
    // beside the card (on a phone, most of it: the card sits under it there)
    const bb = pl.bb, bw = bb[2] - bb[0], bh = bb[3] - bb[1];
    const zFit = phone() ? Math.min(cssW * 0.95 / bw, cssH * 0.9 / bh) : Math.min(cssW * 0.55 / bw, cssH * 0.85 / bh);
    const zt = Math.max(cam.z, pl.square ? 1.8 : phone() ? Math.max(1.7, Math.min(2.6, zFit)) : Math.max(2.2, Math.min(3.4, zFit)));
    let cx = pl.x + (bb[0] + bb[2]) / 2, cy = pl.y + (bb[1] + bb[3]) / 2;
    // on a phone, a house you can look into is the centre of the picture
    const rm = phone() && sprites.find(s => s.pl === pl && s.focus);
    if (rm) { cx = (cx + rm.focus[0] * 2) / 3; cy = (cy + rm.focus[1] * 2) / 3; }
    goal = clampCam({ x: phone() ? cx : cx + (cssW * 0.16) / zt, y: cy, z: rm ? Math.max(zt, 2.2) : zt });
    wake(true);
    placeCard();
    if (gesture) chime(pl);
    if (fromKey) setTimeout(() => $('#vl-card-name').focus({ preventScroll: true }), 30);
    else if (gesture && phone()) setTimeout(() => card.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' }), 60);
    try { window.umami && window.umami.track('village_open', { game: pl.kluc }); } catch (e) {}
  }
  function close(back) {
    if (!openPl) return;
    const pl = openPl; openPl = null; card.hidden = true;
    ACT.done.add(pl.kluc); ACT.k = null;
    wake(false);
    if (back) { const b = buttons[PLACES.indexOf(pl)]; b && b.focus({ preventScroll: true }); }
  }
  function placeCard() {
    if (!openPl || phone()) { card.style.transform = ''; return; }
    // beside the house's whole scene, right if it fits, else left
    const pl = openPl, bb = pl.bb;
    const [x0, y0] = toScreen(pl.x + bb[0], pl.y + bb[1]), [x1, y1] = toScreen(pl.x + bb[2], pl.y + bb[3]);
    const w = card.offsetWidth, h = card.offsetHeight;
    let x = x1 + 16;
    if (x + w > cssW - 12) x = x0 - w - 16;
    x = Math.max(12, Math.min(cssW - w - 12, x));
    const y = Math.max(12, Math.min(cssH - h - 12, (y0 + y1) / 2 - h / 2));
    card.style.transform = `translate(${x.toFixed(0)}px,${y.toFixed(0)}px)`;
  }
  $('#vl-card-close').addEventListener('click', () => close(true));
  function placeTip(pl) {
    const [sx, sy] = toScreen(pl.top[0], pl.top[1]);
    tip.style.transform = `translate(${sx.toFixed(0)}px,${(sy - 10).toFixed(0)}px) translate(-50%,-100%)`;
  }
  function hover(pl) {
    if (pl === hoverPl) return;
    hoverPl = pl;
    cv.style.cursor = pl && !pl.soon ? 'pointer' : 'grab';
    if (!pl || pl === openPl) { tip.hidden = true; return; }
    tip.textContent = pl.soon ? `${pl.name}, opening soon` : pl.name;
    tip.hidden = false; placeTip(pl);
  }
  function placeAt(px, py) {
    const [wx, wy] = toWorld(px, py);
    let best = null, bd = 1;
    for (const pl of PLACES) {
      const [cx, cy] = hitCenter(pl);
      const d = Math.hypot((wx - cx) / pl.hit[2], (wy - cy) / pl.hit[3]);
      if (d < bd) { bd = d; best = pl; }
    }
    return best;
  }

  /* ── Pointer: drag to pan, pinch or ctrl + wheel to zoom, tap to open ─ */
  const ptrs = new Map();
  let dragging = false, moved = 0, pinch = null, downT = 0, lastMove = null;
  function zoomAt(px, py, f, animate) {
    const [wx, wy] = toWorld(px, py);
    const z = Math.max(zMin, Math.min(zMax, (goal ? goal.z : cam.z) * f));
    const nx = wx - (px - cssW / 2) / z, ny = wy - (py - cssH / 2) / z;
    if (animate && !reduce) goal = clampCam({ x: nx, y: ny, z });
    else { Object.assign(cam, clampCam({ x: nx, y: ny, z })); goal = null; }
    vel = null; wake(true);
  }
  const local = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cv.addEventListener('pointerdown', e => {
    cv.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, local(e));
    goal = null; vel = null; moved = 0; downT = performance.now();
    dragging = true; lastMove = { t: downT, x: 0, y: 0 };
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] }; }
    stage.classList.add('vl-grab');
    wake(false);
  });
  cv.addEventListener('pointermove', e => {
    const p = local(e);
    if (!ptrs.has(e.pointerId)) { lastInput = performance.now(); if (asleep || (!raf && !timer)) wake(false); if (e.pointerType === 'mouse') hover(placeAt(p[0], p[1])); return; }
    const q = ptrs.get(e.pointerId);
    ptrs.set(e.pointerId, p);
    if (ptrs.size === 1) {
      const dx = p[0] - q[0], dy = p[1] - q[1];
      moved += Math.abs(dx) + Math.abs(dy);
      if (moved > 6) {
        cam.x -= dx / cam.z; cam.y -= dy / cam.z; clampCam(cam);
        const now = performance.now(), dtm = Math.max(1, now - lastMove.t);
        lastMove = { t: now, x: dx / dtm * 0.6 + (lastMove.x || 0) * 0.4, y: dy / dtm * 0.6 + (lastMove.y || 0) * 0.4 };
        if (hoverPl) hover(null);
        wake(true);
      }
    } else if (ptrs.size === 2 && pinch) {
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const [wx, wy] = toWorld(pinch.m[0], pinch.m[1]);
      cam.z = Math.max(zMin, Math.min(zMax, cam.z * d / pinch.d));
      cam.x = wx - (m[0] - cssW / 2) / cam.z; cam.y = wy - (m[1] - cssH / 2) / cam.z;
      clampCam(cam); pinch = { d, m }; moved += 99; zoomingUntil = performance.now() + 180;
      wake(true);
    }
  });
  function up(e) {
    if (!ptrs.has(e.pointerId)) return;
    const p = ptrs.get(e.pointerId);
    ptrs.delete(e.pointerId);
    if (ptrs.size === 1) { pinch = null; lastMove = { t: performance.now(), x: 0, y: 0 }; return; }
    if (ptrs.size) return;
    dragging = false; pinch = null;
    stage.classList.remove('vl-grab');
    if (moved <= 6 && e.type === 'pointerup' && performance.now() - downT < 600) {
      const pl = placeAt(p[0], p[1]);
      if (pl && !pl.soon) open(pl, false, true); else close(false);
    } else if (lastMove && performance.now() - lastMove.t < 80 && !reduce) {
      vel = { x: lastMove.x, y: lastMove.y };
      if (Math.hypot(vel.x, vel.y) < 0.05) vel = null;
    }
    wake(false);
  }
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !ptrs.size) hover(null); });
  const hint = $('#vl-hint');
  let hintT = 0;
  cv.addEventListener('wheel', e => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const [px, py] = local(e);
      zoomingUntil = performance.now() + 180;
      zoomAt(px, py, Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.0022)), false);
    } else {
      hint.hidden = false; clearTimeout(hintT); hintT = setTimeout(() => { hint.hidden = true; }, 1600);
    }
  }, { passive: false });
  cv.addEventListener('dblclick', e => { const [px, py] = local(e); zoomAt(px, py, 1.8, true); });

  /* ── Keyboard ──────────────────────────────────────────────────────── */
  stage.addEventListener('keydown', e => {
    const step = 90 / cam.z;
    let done = true;
    switch (e.key) {
      case 'ArrowLeft': goal = clampCam({ x: (goal || cam).x - step, y: (goal || cam).y, z: (goal || cam).z }); break;
      case 'ArrowRight': goal = clampCam({ x: (goal || cam).x + step, y: (goal || cam).y, z: (goal || cam).z }); break;
      case 'ArrowUp': goal = clampCam({ x: (goal || cam).x, y: (goal || cam).y - step, z: (goal || cam).z }); break;
      case 'ArrowDown': goal = clampCam({ x: (goal || cam).x, y: (goal || cam).y + step, z: (goal || cam).z }); break;
      case '+': case '=': zoomAt(cssW / 2, cssH / 2, 1.4, true); break;
      case '-': case '_': zoomAt(cssW / 2, cssH / 2, 1 / 1.4, true); break;
      case '0': case 'Home': goal = clampCam(homeCam()); break;
      case 'Escape': if (openPl) close(true); else done = false; break;
      default: done = false;
    }
    if (done) { e.preventDefault(); vel = null; wake(true); }
  });
  $('#vl-in').addEventListener('click', () => zoomAt(cssW / 2, cssH / 2, 1.5, true));
  $('#vl-out').addEventListener('click', () => zoomAt(cssW / 2, cssH / 2, 1 / 1.5, true));
  $('#vl-home').addEventListener('click', () => { close(false); goal = clampCam(homeCam()); vel = null; wake(true); });

  /* ── Light: day or early evening, from the visitor's clock ─────────── */
  const lightBtn = $('#vl-light');
  function showLight() {
    lightBtn.setAttribute('aria-pressed', String(eve));
    lightBtn.querySelector('span').textContent = eve ? 'Evening' : 'Day';
    stage.classList.toggle('vl-eve', eve);
    if (openPl && Array.isArray(openPl.scene)) $('#vl-card-scene').textContent = openPl.scene[eve ? 1 : 0];
  }
  lightBtn.addEventListener('click', () => {
    const v = !eve;
    try { localStorage.setItem('vl-light', v ? 'eve' : 'day'); } catch (e) {}
    // with every window lit the evening is the day's own; choosing day keeps day until tomorrow
    if (today.vsetky) writeKey('vl-day14', v ? null : today.datum);
    setEve(v, true);
  });
  showLight();
  /* Day to evening and back. The new light is printed under the old picture,
     which fades off it once the tiles in view are ready (only opacity), so the
     change never shows a half printed village. The fade is the gentle spring of
     calm light (CASY.vecer) as a CSS linear() easing, set here; a browser without
     linear() keeps the stylesheet's plain 700 ms fade. Reduced motion: at once. */
  const VECER = cssEasing(PRESETS[CASY.vecer.pruzina], 60);
  // the veil is a copy of the whole stage (15 MB at 1408 x 684 and DPR 2): once off the page it
  // gives its memory back at once, like a discarded tile (the rule after the Fold 7, README)
  const dropVeil = c => { if (!c) return; if (c.remove) c.remove(); c.width = c.height = 0; };
  function setEve(v, fade) {
    if (v === eve) return;
    let veil = null;
    if (fade && !reduce && cssW && shown) {
      try {
        veil = document.createElement('canvas');
        veil.className = 'vl-veil'; veil.setAttribute('aria-hidden', 'true');
        veil.width = cv.width; veil.height = cv.height;
        veil.style.width = cssW + 'px'; veil.style.height = cssH + 'px';
        veil.style.transition = 'opacity ' + VECER.duration + 'ms ' + VECER.easing;
        veil.getContext('2d').drawImage(cv, 0, 0);
        cv.after(veil);
      } catch (e) { dropVeil(veil); veil = null; }
    }
    eve = v;
    makeSprites(); showLight(); queue = []; wake(true);
    prepareCard();
    if (!veil) return;
    const t0 = performance.now();
    const lift = () => {
      if (queue.some(q => q[3] <= 1) && performance.now() - t0 < 1600) { setTimeout(lift, 60); return; }
      veil.classList.add('vl-veil-out');
      setTimeout(() => dropVeil(veil), Math.max(VECER.duration, CASY.vecer.ms) + 120);
    };
    setTimeout(lift, 60);
  }

  /* ── Sound: a soft chime when a house opens, only if asked for ─────── */
  const soundBtn = $('#vl-sound');
  let sound = false, ac = null;
  try { sound = localStorage.getItem('vl-sound') === '1'; } catch (e) {}
  const showSound = () => { soundBtn.setAttribute('aria-pressed', String(sound)); soundBtn.querySelector('span').textContent = sound ? 'Sound on' : 'Sound off'; };
  soundBtn.addEventListener('click', () => { sound = !sound; try { localStorage.setItem('vl-sound', sound ? '1' : '0'); } catch (e) {} showSound(); if (sound) chime(PLACES[0]); });
  showSound();
  const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31, 33];
  // called from a click, tap or key press, where the browser lets a page make sound;
  // and when a window lights up on arrival (arrival = true): then only if sound is on
  // and the browser already lets this page play (a click on the way here). If it does
  // not, the chime stays silent: it never plays later, out of its moment.
  function chime(pl, arrival) {
    if (!sound) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if (arrival && ac.state !== 'running') {
        const t0 = performance.now(), r = ac.resume();
        if (r && r.then) r.then(() => { if (ac.state === 'running' && performance.now() - t0 < 300) ring(pl); }, () => {});
        return;
      }
      if (ac.state === 'suspended') ac.resume();
      ring(pl);
    } catch (e) {}
  }
  function ring(pl) {
    try {
      const n = SCALE[PLACES.indexOf(pl) % SCALE.length], now = ac.currentTime;
      for (const [semi, delay, vol] of [[n, 0, 0.16], [n + 7, 0.09, 0.09]]) {
        const f = 392 * Math.pow(2, semi / 12);
        const o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain();
        o.type = 'sine'; o.frequency.value = f; o2.type = 'sine'; o2.frequency.value = f * 4.02;
        const g2 = ac.createGain(); g2.gain.value = 0.18;
        o2.connect(g2); g2.connect(g); o.connect(g); g.connect(ac.destination);
        g.gain.setValueAtTime(0, now + delay);
        g.gain.linearRampToValueAtTime(vol, now + delay + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0008, now + delay + 1.1);
        o.start(now + delay); o2.start(now + delay); o.stop(now + delay + 1.2); o2.stop(now + delay + 1.2);
      }
    } catch (e) {}
  }

  /* ── My village: the row of lights, the lights coming on, the card ─── */
  const track = (name, data) => { try { if (window.umami && typeof window.umami.track === 'function') window.umami.track(name, data); } catch (e) { /* statistics are not part of the village */ } };
  // the statistics script loads last: an event from the loading page waits for it (10 s at most)
  const trackSoon = (name, data, n = 0) => { if (window.umami && typeof window.umami.track === 'function') track(name, data); else if (n < 20) setTimeout(() => trackSoon(name, data, n + 1), 500); };
  // a visit that came from a shared card (the card's link carries ?ref=card): counted once, nothing else is read
  { const ref = Q.get('ref'); if (ref && /^[a-z0-9-]{1,24}$/.test(ref)) trackSoon('village_open_ref', { ref }); }
  const HOUSES = ORDER.filter(k => HRY.includes(k));          // the village's own order, west to east
  const POS = {};
  for (const pl of PLACES) if (!pl.square) POS[pl.kluc] = hitCenter(pl);
  const placeOf = k => PLACES.find(q => q.kluc === k);
  const el = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };
  // the windows lit on the screen now: a light whose ink has started counts, one waiting to be seen does not
  const litCount = () => { const now = performance.now(); let n = 0; for (const g of glowing.values()) if (g.t0 == null || g.t0 <= now) n++; return n; };
  // the number in the row: every light of today it has counted so far (reduced motion: all of them at once)
  const rowCount = () => (reduce ? today.pocet : told.size);
  /* "5 of 14 lights today", the nearest house still dark and the card, in a row right above
     the village: seen on arrival without scrolling, on a phone too, and never over the print.
     index.html keeps its place, so nothing shifts when it fills; made here if it is missing. */
  let chip = $('#vl-lights');
  if (!chip) { chip = el('div', 'vl-lights'); chip.id = 'vl-lights'; stage.parentNode.insertBefore(chip, stage); }
  chip.setAttribute('role', 'group'); chip.setAttribute('aria-label', 'Today’s lights');
  chip.textContent = '';
  const chipN = el('span', 'vl-lights-n');
  const chipGlyph = el('span', 'vl-lights-glyph'); chipGlyph.setAttribute('aria-hidden', 'true');
  const chipText = el('span', 'vl-lights-text');
  const chipPre = el('span'), chipNum = el('span', 'vl-lights-num'), chipPo = el('span'), chipToday = el('span', 'vl-lights-today');
  chipText.appendChild(chipPre); chipText.appendChild(chipNum); chipText.appendChild(chipPo); chipText.appendChild(chipToday);
  chipN.appendChild(chipGlyph); chipN.appendChild(chipText);
  const chipRow = el('span', 'vl-lights-row');
  const chipNext = el('a', 'vl-lights-next');
  const chipShare = el('button', 'vl-lights-share');
  chipShare.type = 'button';
  chipRow.appendChild(chipNext); chipRow.appendChild(chipShare);
  chip.appendChild(chipN); chip.appendChild(chipRow);
  const chipMsg = el('div', 'vl-lights-msg');
  chipMsg.setAttribute('role', 'status'); chipMsg.hidden = true;
  chip.appendChild(chipMsg);
  // what a screen reader hears when windows come on; the row's own words change quietly
  const chipSr = el('div', 'vl-sr');
  chipSr.setAttribute('role', 'status');
  chip.appendChild(chipSr);
  chip.classList.add('vl-lights-ready');
  // on a touch screen the card goes to the phone's own share sheet; elsewhere it is saved as a picture
  const sheet = () => (matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints || 0) > 0) && typeof navigator.share === 'function' && typeof navigator.canShare === 'function';
  chipShare.innerHTML = sheet()
    ? '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 10V2.5M5 5.2 8 2.3l3 2.9M3.5 8.5v4.5h9V8.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Share card</span>'
    : '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5V10M5 7.2 8 10.1l3-2.9M3.5 11v2.5h9V11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Save card</span>';
  // the spoken name starts with the words the button shows (WCAG 2.5.3); the tooltip says more
  chipShare.setAttribute('aria-label', sheet() ? 'Share card of my village' : 'Save card of my village');
  chipShare.title = sheet() ? 'Share a picture of my village today' : 'Save a picture of my village today, with its link copied';
  let msgT = 0;
  function say(text) { chipMsg.textContent = text; chipMsg.hidden = false; clearTimeout(msgT); msgT = setTimeout(() => { chipMsg.hidden = true; }, CASY.sprava); }
  // the count rolls to its new number (motion/components/number, CASY.pocet); reduced motion: simply there
  let num = null, numPlain = false;
  function setCount(v) {
    if (numPlain) { chipNum.textContent = String(v); return; }
    try { if (!num) num = createNumber({ el: chipNum, value: v }); else if (num.value() !== v) num.set(v); }
    catch (e) { numPlain = true; chipNum.textContent = String(v); }
  }
  function updateChip() {
    const next = najblizsia(today, POS, HOUSES);
    const n = rowCount();
    const t = textSvetiel(today, next, n);
    // the words around the number; the number itself rolls (setCount)
    chipPre.textContent = t.pred; chipPo.textContent = t.po; chipToday.textContent = t.dnes;
    chipNum.hidden = t.cislo == null;
    if (t.cislo != null) setCount(t.cislo);
    chip.title = t.nazov;
    chip.classList.toggle('vl-lights-on', n > 0);
    chip.classList.toggle('vl-lights-all', n >= today.spolu);
    if (next) {
      chipNext.hidden = false;
      chipNext.href = '/games/' + next + '/';
      chipNext.textContent = t.odkaz;
      chipNext.setAttribute('aria-label', t.popis);
      chipNext.dataset.umamiEvent = 'village_to_game'; chipNext.dataset.umamiEventGame = next; chipNext.dataset.umamiEventFrom = 'lights';
    } else chipNext.hidden = true;
    chipShare.hidden = !today.pocet;
  }
  // the house's card says whether its window is lit; the list below marks the lit houses too
  const cardLit = $('#vl-card-lit');
  function updateCardLit() {
    if (!cardLit) return;
    if (!openPl || openPl.square) { cardLit.hidden = true; return; }
    const on = today.svietia.includes(openPl.kluc);
    cardLit.hidden = false; cardLit.textContent = textDomu(on); cardLit.classList.toggle('vl-on', on);
  }
  const listLinks = [];
  for (const a of document.querySelectorAll('.vl-list a')) {
    const m = /^\/games\/([a-z]+)\/$/.exec(a.getAttribute('href') || '');
    if (!m || !HRY.includes(m[1])) continue;
    listLinks.push([m[1], a]);
    a.addEventListener('click', () => track('village_to_game', { game: m[1], from: 'list' }));
  }
  function updateList() {
    for (const [k, a] of listLinks) {
      if (!a.parentNode || a.parentNode.tagName !== 'H3') continue;
      const on = today.svietia.includes(k);
      let tag = a.parentNode.querySelector('.vl-lit-tag');
      if (on && !tag) { tag = el('span', 'vl-lit-tag'); tag.textContent = 'Lit today'; a.parentNode.appendChild(tag); }
      if (tag) tag.hidden = !on;
    }
  }
  $('#vl-card-play').addEventListener('click', () => { if (openPl && !openPl.square) track('village_to_game', { game: openPl.kluc, from: 'house' }); });

  /* Arrival, in two places. The row above the poster is seen on arrival (it sits
     over the village, on a phone too), so it tells the truth at once: CASY.start
     after the village shows, or after the page comes back, the count rolls on to
     every light solved today, one step a house in the order they were solved
     (the rhythm of the ink below), and a screen reader hears which (countArrival).
     The windows come on where they are seen. A house solved since the last visit
     keeps its window dark until the village is on the screen (CASY.videt of it,
     looked at on every 5 % step of IntersectionObserver, on scrolling and when
     the view comes to rest) and the house itself is in that part of it. Then,
     CASY.start later, its window fills with ink from the middle (CASY.okno,
     snappy spring), one house after another in the order they were solved: its
     name label lands and its chime plays if sound is on. A house out of view
     (below the fold, or zoomed away from) keeps waiting until the view comes to
     it. Markers (inkSprites) tell the frame loop where to draw while the ink
     lasts, then the window is simply lit. */
  let countT = 0, countUntil = 0;
  const stepping = new Set();               // counted in a wave still under way
  const toCount = () => noveSvetla(today, { d: today.datum, k: [...told, ...stepping] });
  function countArrival() {
    // the village printed its first frame, or is not on the screen at all (then nothing waits for it)
    if (countT || document.hidden || !(shown || !inView)) return;
    if (!toCount().length) return;
    countT = setTimeout(countNew, CASY.start);
  }
  function countNew() {
    clearTimeout(countT); countT = 0;
    if (document.hidden) return;              // back on the screen, back() asks again
    const add = toCount();                    // in the order they were solved
    if (!add.length) return;
    const at = rozvrh(add, reduce), last = add.length - 1, datum = today.datum;
    // the number rolls about 400 ms after its last step (motion/components/number)
    countUntil = performance.now() + at[last] + 700;
    for (const k of add) stepping.add(k);
    const step = i => {
      stepping.delete(add[i]);
      if (today.datum !== datum) return;      // a new day came meanwhile: it starts dark
      if (today.svietia.includes(add[i])) told.add(add[i]);
      updateChip();
      if (i === last) chipSr.textContent = textOznamu(add.filter(k => told.has(k)), rowCount(), today.spolu);
    };
    add.forEach((k, i) => { if (at[i]) setTimeout(() => step(i), at[i]); else step(i); });
  }
  let arriveT = 0, scrollOn = false;
  const seenPart = () => viditelne(stage.getBoundingClientRect(), window.innerWidth || 0, window.innerHeight || 0);
  function houseSeen(k, v) {
    const L = W.lights.get(k);
    if (!L || !L.bb) return true;             // a house with no window: nothing to wait for (lightNew skips it)
    const [x, y] = toScreen((L.bb[0] + L.bb[2]) / 2, (L.bb[1] + L.bb[3]) / 2);
    return x >= 0 && y >= 0 && x <= cssW && y <= cssH && vDohlade(v, x, y);
  }
  function checkArrival() {
    watchScroll(fresh.length > 0);
    if (!fresh.length || !shown || arriveT || !cssW || document.hidden) return;
    if (!seenPart().dost) return;
    arriveT = setTimeout(arrive, CASY.start);
  }
  function arrive() {
    arriveT = 0;
    if (!fresh.length || document.hidden) return;
    const v = seenPart();
    if (!v.dost) return;                      // scrolled away meanwhile: the next look brings it
    // reduced motion: the windows were lit from the first frame, this only chimes
    const now = reduce ? fresh.slice() : fresh.filter(k => houseSeen(k, v));
    if (!now.length) return;
    // the row has counted them by now; if its turn is due in this same moment, it goes first
    if (countT) countNew();
    fresh = fresh.filter(k => !now.includes(k));
    lightNew(now);
    watchScroll(fresh.length > 0);
  }
  // scrolling is watched only while a light is still waiting to be seen
  function watchScroll(on) {
    if (on === scrollOn) return;
    scrollOn = on;
    if (on) window.addEventListener('scroll', checkArrival, { passive: true });
    else window.removeEventListener('scroll', checkArrival, { passive: true });
  }
  function lightNew(keys) {
    keys = keys.filter(k => today.svietia.includes(k) && W.lights.get(k) && W.lights.get(k).bb);
    if (!keys.length) return;
    const now = performance.now(), at = rozvrh(keys, reduce);
    keys.forEach((k, i) => {
      const L = W.lights.get(k);
      ACT.done.add(k);
      if (glowing.has(k)) return;                 // reduced motion: lit from the first frame already
      if (reduce) { glowing.set(k, { L, t0: null }); return; }
      const t0 = now + at[i];
      glowing.set(k, { L, t0 });
      const s = { box: L.bb, st: () => [atrament(performance.now() - t0) * 1000], draw() {}, ink: true, k: null, bx: null };
      inkSprites.push(s); sprites.push(s);
    });
    writeKey('vl-seen', zapisVidene(today, glowing.keys()));
    // each house in its turn: its label lands (its box keeps its place) and it chimes; reduced
    // motion: all at once, and only the house solved last chimes
    const last = keys.length - 1;
    keys.forEach((k, i) => setTimeout(() => {
      labelLit(k, true);
      if (!reduce || i === last) { const pl = placeOf(k); if (pl) chime(pl, true); }
    }, at[i]));
    inkUntil = reduce ? 0 : now + at[last] + CASY.okno.ms + 40;
    full = true;
    wake(false);
    setTimeout(lightsDone, reduce ? 0 : at[last] + CASY.okno.ms + 80);
  }
  function lightsDone() {
    if (performance.now() < inkUntil) { setTimeout(lightsDone, 50); return; }
    for (const g of glowing.values()) g.t0 = null;
    if (inkSprites.length) { const gone = new Set(inkSprites); sprites = sprites.filter(s => !gone.has(s)); inkSprites = []; }
    updateChip();
    // the fourteenth light: the evening comes, once every window is lit here (none still waiting to be seen)
    if (today.vsetky && !fresh.length && glowing.size >= today.spolu && !eve && readKey('vl-day14') !== today.datum) setTimeout(() => setEve(true, true), CASY.vecer.po);
    prepareCard();
  }
  /* Back from a puzzle in another tab, or past midnight: read the saves again.
     A new light is counted in the row on arrival and comes on with ink once
     seen; a new day starts dark. */
  function refreshLights() {
    const next = svetlaDnes(readKey, dnesBratislava());
    if (next.datum === today.datum && next.svietia.join() === today.svietia.join()) return;
    const was = today.svietia;
    today = next;
    for (const k of [...glowing.keys()]) if (!today.svietia.includes(k)) { glowing.delete(k); if (was.includes(k)) ACT.done.delete(k); }
    for (const k of [...told]) if (!today.svietia.includes(k)) told.delete(k);
    fresh = fresh.filter(k => today.svietia.includes(k));
    const add = noveSvetla(today, citajVidene(readKey('vl-seen'))).filter(k => !glowing.has(k) && !fresh.includes(k));
    // already watched come on (in another tab of the village, say): simply lit, and counted
    for (const k of today.svietia) if (!add.includes(k) && !fresh.includes(k) && !glowing.has(k)) { glowing.set(k, { L: W.lights.get(k), t0: null }); ACT.done.add(k); told.add(k); }
    // reduced motion: lit at once (the row counts them at once too, a screen reader hears them on arrival)
    if (reduce) for (const k of add) glowing.set(k, { L: W.lights.get(k), t0: null });
    fresh = fresh.concat(add);
    // every label: a house solved today keeps room for its window, lit or still waiting
    for (const l of labs) labelLit(l.pl.kluc, false);
    updateChip(); updateList(); updateCardLit();
    full = true;
    wake(true);
    countArrival();
    checkArrival();
    prepareCard();
  }
  let midnightT = 0;
  function armMidnight() { clearTimeout(midnightT); midnightT = setTimeout(() => { refreshLights(); armMidnight(); }, msDoPolnoci()); }
  armMidnight();
  // a puzzle solved in another window next to this one lights its house here, once seen
  window.addEventListener('storage', e => { if (!document.hidden && (!e.key || /^[a-z]+:\d{4}-\d{2}-\d{2}$/.test(e.key))) refreshLights(); });
  for (const k of today.svietia) labelLit(k, false);
  updateChip(); updateList();

  /* The card: "My village, <date>: N of 14 lights", 1080 x 1350, in the poster's
     frame (moja.js). The island on it is printed fresh by this engine at the
     card's own size, lit as it is now, so it is sharp on any screen. Made on the
     visitor's device; nothing is sent anywhere. */
  function drawIslandInto(p, box) {
    const R = W.island, rw = R[2] - R[0], rh = R[3] - R[1];
    const s = Math.min(box.w / rw, box.h / rh);
    const ox = box.x + (box.w - rw * s) / 2 - R[0] * s, oy = box.y + (box.h - rh * s) / 2 - R[1] * s;
    const g = p.c, keep = { k: ACT.k, t0: ACT.t0 };
    ACT.k = null;                            // no house card is open on the card
    g.save();
    try {
      g.beginPath(); g.rect(box.x, box.y, box.w, box.h); g.clip();
      g.setTransform(s, 0, 0, s, ox, oy);
      p.scale(s); p.eve = false; p.bare = true;
      drawStatic(p, W, [(box.x - ox) / s, (box.y - oy) / s, (box.x + box.w - ox) / s, (box.y + box.h - oy) / s], eve);
      p.bare = false;
      g.setTransform(s, 0, 0, s, ox, oy); p.scale(s); p.eve = eve;
      for (const k of today.svietia) { const L = W.lights.get(k); if (L && L.bb) lightUp(p, L, 1, eve); }
      // the animals at a calm moment, like the village at rest (no hare in mid air)
      const t = Math.floor(performance.now() / 1000 / 2.3) * 2.3 + 1.6;
      const list = [];
      for (const sp of sprites) if (!sp.ink) list.push([boxOf(sp, t)[3], sp]);
      list.sort((a, b) => a[0] - b[0]);
      for (const [, sp] of list) sp.draw(p, t);
      p.reset();
    } finally {
      g.restore();
      p.bare = false;
      ACT.k = keep.k; ACT.t0 = keep.t0;
    }
  }
  /* The card is printed ahead, in a quiet moment (requestIdleCallback, else a timer;
     never while the page scrolls, the view moves, a light or the count is about to
     come on or comes on, or the page is hidden), whenever the lights or the light of
     day change; also while a light still waits to be seen, since the card shows what
     was solved, and on a phone that light often waits for a scroll. A tap then shares
     it at once: Safari opens the share sheet only straight from the tap, and printing
     it in the tap froze the tap itself (100 to 600 ms on a slow phone, estimated, not
     measured: window.__village.kartaMs keeps the last print). On a computer a hand on
     the button (the mouse over it, keyboard focus) prints it at once if it is not yet. */
  let cardJob = null, cardJobKey = '', cardReady = null, prepOn = false, scrolledAt = -1e9;
  // a scroll is only marked (no layout read): the card is not printed in the middle of one
  window.addEventListener('scroll', () => { scrolledAt = performance.now(); }, { passive: true });
  const cardKey = () => today.datum + '|' + today.svietia.join() + '|' + eve;
  function makeCard() {
    const key = cardKey();
    if (cardJob && cardJobKey === key) return cardJob;
    cardJobKey = key;
    const name = menoSuboru(today);
    const job = new Promise(res => {
      let c = null;
      // the plate is 5.8 MB: it gives its memory back as soon as its picture is made (as tiles do)
      const free = () => { if (c) { c.width = c.height = 0; c = null; } };
      try {
        const lay = rozlozenieKarty({ datum: today.datum, svietia: today.svietia, eve });
        c = document.createElement('canvas');
        c.width = lay.w; c.height = lay.h;
        const p = new Pen(c.getContext('2d', { alpha: false }));
        const t0 = performance.now();
        kresliKartu(p, lay, drawIslandInto);
        stats.kartaMs = Math.round(performance.now() - t0);
        c.toBlob(b => { free(); res(b || null); }, 'image/png');
      } catch (e) { free(); res(null); }
    }).then(blob => {
      if (!blob) { if (cardJob === job) { cardJob = null; cardJobKey = ''; } return null; }
      let file = null;
      try { file = new File([blob], name, { type: 'image/png' }); } catch (e) { file = null; }
      const made = { key, blob, file, name };
      if (cardJobKey === key) cardReady = made;
      return made;
    });
    cardJob = job;
    return job;
  }
  const cardFresh = () => !!(cardReady && cardReady.key === cardKey());
  function prepareCard() {
    if (prepOn || !today.pocet || cardFresh()) return;
    prepOn = true;
    const later = () => (typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback(go, { timeout: 4000 }) : setTimeout(go, 1200));
    const go = () => {
      // hidden, nothing to show or done already: not now (back() and the lights ask again)
      if (document.hidden || !today.pocet || cardFresh()) { prepOn = false; return; }
      // a light waiting to be seen does not stop it; the scroll that brings it, the ink and the count do
      const now = performance.now();
      if (!shown || dragging || goal || vel || arriveT || countT || now < inkUntil || now < countUntil || now - scrolledAt < 500) { setTimeout(later, 1500); return; }
      prepOn = false;
      makeCard();
    };
    later();
  }
  const cardNow = () => { if (today.pocet && !cardFresh()) makeCard(); };
  chipShare.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') cardNow(); });
  chipShare.addEventListener('focus', () => { if (!sheet()) cardNow(); });
  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.rel = 'noopener'; a.hidden = true;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  let sharing = false;
  chipShare.addEventListener('click', () => {
    if (sharing || !today.pocet) return;
    sharing = true; chipShare.setAttribute('aria-busy', 'true');
    const done = () => { sharing = false; chipShare.removeAttribute('aria-busy'); };
    // printed ahead: the sheet opens (or the picture is saved) straight from the tap; else it is
    // printed now, and a browser that then refuses the sheet gets it with a second tap
    const job = cardFresh() ? deliver(cardReady, true) : makeCard().then(c => (c ? deliver(c, false) : say('The card could not be made in this browser.')));
    Promise.resolve(job).then(done, done);
  });
  function deliver(c, fromTap) {
    let can = false;
    try { can = !!(c.file && sheet() && navigator.canShare({ files: [c.file] })); } catch (e) { can = false; }
    if (!can) { save(c); return Promise.resolve(); }
    let p;
    try { p = navigator.share({ files: [c.file], title: 'My village', text: textZdielania(today) }); } catch (e) { p = Promise.reject(e); }
    return Promise.resolve(p).then(() => track('village_share', { how: 'image' }), e => {
      if (e && e.name === 'AbortError') return;                     // the visitor closed the sheet
      if (e && e.name === 'NotAllowedError' && !fromTap) { say('Your card is ready. Tap Share card again.'); return; }
      save(c);
    });
  }
  // saved as a picture, with the words and the link on the clipboard (a picture's link cannot be tapped)
  function save(c) {
    download(c.blob, c.name);
    track('village_share', { how: 'download' });
    const msg = 'Saved as ' + c.name + '.';
    say(msg);
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        Promise.resolve(navigator.clipboard.writeText(textZdielania(today))).then(() => say(msg + ' Link copied.'), () => { /* no clipboard: the picture alone */ });
      }
    } catch (e) { /* no clipboard: the picture alone */ }
  }
  // for Fable's checks in a browser and for ops/games/village.test.mjs: the state, and the card as a PNG blob
  // (svieti = windows lit on the screen, riadok = the number in the row, caka = lights waiting to be seen)
  stats.lights = () => ({ datum: today.datum, pocet: today.pocet, svietia: today.svietia.slice(), eve, glowing: glowing.size, svieti: litCount(), riadok: rowCount(), caka: fresh.slice(), ink: inkSprites.length, sprity: sprites.length, inkUntil, karta: cardFresh() });
  stats.karta = () => makeCard().then(c => (c ? c.blob : null));

  /* ── Stop when unseen ──────────────────────────────────────────────── */
  const halt = () => { if (raf) cancelAnimationFrame(raf); if (timer) clearTimeout(timer); raf = timer = 0; lastRaf = 0; };
  /* Any of it on the screen: the loop may run. Only coming onto the screen wakes the village; the
     5 % steps in between only look whether a waiting light may come on, so scrolling the page never
     wakes a village at rest (27 Sep 2026: every step called wake, a full frame and 40 s more life). */
  new IntersectionObserver(es => {
    const e = es[es.length - 1], was = inView;
    inView = e.isIntersecting;
    if (!inView) halt(); else if (!was) wake(false);
    countArrival(); checkArrival();
  }, { threshold: Array.from({ length: 21 }, (_, i) => i / 20) }).observe(stage);
  /* Back on screen: the picture is laid again whole. A page that was hidden a while (a
     phone keeps a hidden page's canvases off the GPU and may hand them back spoilt), or
     that comes back from the back button, prints its tiles again, quietly. */
  let hiddenAt = 0;
  // coming back is also when a puzzle solved meanwhile lights its house (refreshLights, once seen)
  function back(again) { lastFrame = 0; if (again) reprint(); refreshLights(); wake(true); countArrival(); checkArrival(); prepareCard(); }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = performance.now(); halt(); }
    else { back(hiddenAt > 0 && performance.now() - hiddenAt > 1000); hiddenAt = 0; }
  });
  window.addEventListener('pageshow', e => { if (e.persisted) back(true); });
  document.addEventListener('resume', () => back(true));
  window.addEventListener('focus', () => { if (cssW && !document.hidden) back(false); });
  mqReduce.addEventListener && mqReduce.addEventListener('change', e => { reduce = e.matches; wake(true); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && openPl) close(true); });

  /* #hedgehogs opens that house; #view=x,y,z sets the camera (for links and
     tests). Read on load and again whenever the hash changes. */
  function fromHash(first) {
    const h = decodeURIComponent(location.hash.slice(1));
    const pl = PLACES.find(q => q.kluc === h);
    const v = /^view=(-?[\d.]+),(-?[\d.]+),([\d.]+)$/.exec(h);
    if (pl && !pl.soon) { open(pl, false, false); if (first) { Object.assign(cam, goal); goal = null; } }
    else if (pl) { close(false); const [cx, cy] = hitCenter(pl); goal = clampCam({ x: cx, y: cy, z: Math.max(cam.z, 1.6) }); if (first) { Object.assign(cam, goal); goal = null; } }
    else if (v) { close(false); goal = null; Object.assign(cam, clampCam({ x: +v[1], y: +v[2], z: +v[3] })); }
    else return;
    wake(true);
  }
  window.addEventListener('hashchange', () => { if (cssW) fromHash(false); });

  /* The canvas text uses our font: wait for it, a little, before printing */
  const ready = document.fonts && document.fonts.load ? Promise.race([document.fonts.load('700 20px "ARLing Sans"'), new Promise(r => setTimeout(r, 900))]) : Promise.resolve();
  ready.then(() => {
    resize();
    fromHash(true);
    wake(true);
  });
}
