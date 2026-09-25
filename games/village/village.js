/* ARLing Puzzle Village: the engine.
   Performance plan, because a pretty page that eats a laptop is not pretty:
   1. The still print (paper, island, water, houses, trees) is drawn once per
      zoom level into 512 px tiles and kept. Moving the camera only copies tiles.
   2. Every moving thing is a small sprite. Each frame asks every sprite for its
      state; only sprites whose state changed by half a pixel are redrawn, over
      a clean copy of the tiles under them. Nothing else is touched.
   3. Two loops. The hand loop runs at the screen's rate only while the view
      moves (drag, zoom, the camera gliding to a house, a house opening). The
      life loop (breathing, blinking, ripples, smoke) runs at 24 frames a second
      at most, 12 on a slow device, drops to 12 after ten quiet seconds and stops
      after forty, like a print. Hidden tab or village scrolled away: nothing.
   4. Reduced motion prints one still frame and never starts a loop.
   All module URLs carry the same ?v= so a new engine never meets old drawings;
   bump it in every import and in index.html together. */
import { Pen } from './riso.js?v=2';
import { build, drawStatic } from './svet.js?v=2';
import { PLACES, ambient, ACT } from './miesta.js?v=2';

const $ = s => document.querySelector(s);
const stage = $('#vl-stage'), cv = $('#vl-canvas');
if (stage && cv && cv.getContext) start();

function start() {
  const ctx = cv.getContext('2d', { alpha: false });
  const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  let reduce = mqReduce.matches;
  let weak = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  let DPR = Math.min(window.devicePixelRatio || 1, weak ? 1.5 : 2);
  // Tile size in device pixels. 25 Sep 2026: in Firefox one 512 px tile took 33 ms on average and
  // up to 110 ms, and the view froze after every zoom; 256 px tiles take under 8 ms there. Chrome
  // prints 512 px tiles fast and composes fewer of them, so the size is chosen by measurement.
  let T = 512;
  let MAX_TILES = weak ? 40 : 72;
  let slowTileSeen = 0;
  const REST_MS = 40000;                   // quiet this long: the village holds still
  const CALM_MS = 10000;                   // quiet this long: the life loop halves

  /* ── World ─────────────────────────────────────────────────────────── */
  const W = build(PLACES);
  const ISLE = W.frame;
  const BOUND = { x0: ISLE.x0 - 200, x1: ISLE.x1 + 200, y0: ISLE.y0 - 160, y1: ISLE.y1 + 160 };
  const hour = new Date().getHours();
  let eve = hour >= 18 || hour < 6;
  try { const s = localStorage.getItem('vl-light'); if (s === 'day' || s === 'eve') eve = s === 'eve'; } catch (e) {}
  let sprites = [];
  function makeSprites() {
    sprites = [];
    for (const pl of PLACES) for (const s of pl.sprites()) { s.pl = pl; sprites.push(s); }
    for (const s of ambient(W, eve)) sprites.push(s);
    for (const s of sprites) { s.k = null; s.bx = null; }
  }
  makeSprites();

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
  function renderTile(L, tx, ty) {
    const span = T / L, wx = tx * span, wy = ty * span;
    const c = document.createElement('canvas'); c.width = c.height = T;
    const g = c.getContext('2d', { alpha: false });
    g.setTransform(L, 0, 0, L, -wx * L, -wy * L);
    const p = new Pen(g); p.scale(L);
    drawStatic(p, W, [wx, wy, wx + span, wy + span], eve);
    return c;
  }
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
    if (!zooming && levelFor(Z()) !== lvl) { prevLvl = lvl; lvl = levelFor(Z()); }
    const want = [];
    for (const [tx, ty] of visibleTiles(lvl0, viewRect(40))) want.push([lvl0, tx, ty, 0]);
    if (lvl !== lvl0 && !zooming) for (const [tx, ty] of visibleTiles(lvl, viewRect(60))) want.push([lvl, tx, ty, 1]);
    // when nothing else is waiting, print the low tiles of the whole map ahead
    if (!want.some(w => !tiles.has(tkey(w[0], w[1], w[2])))) for (const [tx, ty] of visibleTiles(lvl0, [BOUND.x0, BOUND.y0, BOUND.x1, BOUND.y1])) want.push([lvl0, tx, ty, 2]);
    queue = want.filter(w => !tiles.has(tkey(w[0], w[1], w[2])));
    const span = T / lvl;
    queue.sort((a, b) => a[3] - b[3] || (Math.hypot((a[1] + 0.5) * span - cam.x, (a[2] + 0.5) * span - cam.y) - Math.hypot((b[1] + 0.5) * span - cam.x, (b[2] + 0.5) * span - cam.y)));
  }
  let tick = 0;
  function work(budget) {
    const t0 = performance.now();
    let n = 0;
    while (queue.length && performance.now() - t0 < budget && !(n && budget < 8)) {
      const [L, tx, ty] = queue.shift();
      const k = tkey(L, tx, ty);
      if (tiles.has(k)) continue;
      const tt = performance.now();
      tiles.set(k, { c: renderTile(L, tx, ty), L, tx, ty, u: ++tick });
      const dtt = performance.now() - tt; stats.tileN++; stats.tileMs += dtt; stats.tileMax = Math.max(stats.tileMax, dtt);
      if (T === 512 && dtt > 24 && ++slowTileSeen >= 2) { smallTiles(); return n; }
      n++;
    }
    if (tiles.size > MAX_TILES) {
      const old = [...tiles.entries()].filter(([, v]) => v.L !== lvl0 && v.L !== lvl && v.L !== prevLvl).sort((a, b) => a[1].u - b[1].u);
      for (const [k] of old.slice(0, tiles.size - MAX_TILES)) tiles.delete(k);
    }
    return n;
  }
  // this browser prints a big tile too slowly: from now on the island is printed in small ones
  function smallTiles() { T = 256; MAX_TILES = weak ? 160 : 288; tiles.clear(); queue = []; stats.tileSize = T; full = true; }
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
  const pen = new Pen(ctx);
  const boxOf = (s, t) => (typeof s.box === 'function' ? s.box(t) : s.box);
  let quant = 2;                              // key steps per device pixel
  function keyOf(s, t, z) { const st = s.st(t); let k = ''; for (const v of st) k += Math.round(v * z * quant) + ','; return k; }
  const hit = (a, b) => !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
  function drawSprites(r, t) {
    ctx.setTransform(Z(), 0, 0, Z(), OX(), OY());
    pen.scale(Z()); pen.eve = eve;
    const list = [];
    for (const s of sprites) { const b = s.bx || boxOf(s, t); if (hit(b, r)) list.push([b[3], s]); }
    list.sort((a, b) => a[0] - b[0]);
    for (const [, s] of list) s.draw(pen, t);
    pen.reset();
  }

  /* ── Frames ────────────────────────────────────────────────────────── */
  let full = true, raf = 0, timer = 0, inView = true, lastFrame = 0, shown = false, wasMoving = false, settledAt = 0;
  let lastInput = performance.now();
  let tFrozen = 12.3;                       // reduced motion: one moment, kept
  const clock = now => (reduce ? tFrozen : now / 1000);
  const stats = { frames: 0, fulls: 0, partial: 0, rects: 0, tiles: 0, work: 0, tileN: 0, tileMs: 0, tileMax: 0, hz: 0 };
  window.__village = stats;
  // a house that has just opened plays its little scene on the hand loop
  const acting = now => !!ACT.k && !reduce && clock(now) - ACT.t0 < 2.8;

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

  function frame(now) {
    raf = 0;
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
    if (queue.length && !((moving || dragging) && slowTiles && queue[0][3] !== 0)) { if (work(moving || dragging || now - settledAt < 600 ? 6 : 10)) full = true; }
    const t = clock(now);
    if (full) { renderFull(t); full = false; if (!moving && !dragging || layer.contains(document.activeElement)) placeButtons(); else placeFloat(); }
    else if (!reduce) renderDirty(t);
    if (!shown && !queue.some(q => q[3] === 0)) { shown = true; stage.classList.add('vl-ready'); }
    if (wasMoving && !moving && !dragging) placeButtons();
    wasMoving = moving || dragging;
    stats.frames++; stats.tiles = tiles.size;
    const w = performance.now() - w0;
    stats.work += w;
    slow.push(w); if (slow.length > 90) slow.shift();
    if (!weak && slow.length === 90 && slow.reduce((a, b) => a + b, 0) / 90 > 9) { weak = true; if (DPR > 1.5) setDpr(1.5); }
    schedule(moving);
  }
  const slow = [];
  function schedule(moving) {
    if (raf || timer) return;
    if (!inView || document.hidden) return;
    const now = performance.now();
    // the hand loop: at the screen's rate, only while the view moves
    if (moving || queue.length || dragging || full || now < zoomingUntil + 60 || acting(now)) { quant = 2; stats.hz = 60; raf = requestAnimationFrame(frame); return; }
    if (reduce) return;
    // the life loop: breathing and ripples read the same at 24 frames a second
    // as at 60 and cost a third; after ten quiet seconds 12, after forty it rests
    const quiet = now - lastInput;
    if (quiet > REST_MS) { sleep(); return; }
    const calm = quiet > CALM_MS;
    const hz = weak ? (calm ? 8 : 12) : (calm ? 12 : 24);
    quant = weak || calm ? 0.5 : 1;
    stats.hz = hz;
    timer = setTimeout(() => { timer = 0; raf = requestAnimationFrame(frame); }, 1000 / hz - 3);
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
  function resize() {
    const r = stage.getBoundingClientRect();
    const w = Math.round(r.width), h = Math.round(r.height);
    if (w === cssW && h === cssH) return;
    const first = !cssW;
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
  }
  new ResizeObserver(resize).observe(stage);

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
    DPR = d; tiles.clear(); queue = [];
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
  const labs = PLACES.filter(pl => !pl.square).map(pl => {
    const s = document.createElement('span');
    s.className = 'vl-lab' + (pl.soon ? ' vl-lab-soon' : '');
    s.textContent = pl.name;
    if (pl.soon) { const e = document.createElement('em'); e.textContent = 'soon'; s.appendChild(e); }
    labLayer.appendChild(s);
    return { pl, s, dy: 0, off: false };
  });
  // open houses claim their place first, the ones still to come give way
  labs.sort((a, b) => (a.pl.soon - b.pl.soon));
  let labW = null, labsOn = null;
  function placeLabels(settle) {
    const on = cam.z < LAB_Z && !(goal && goal.z >= LAB_Z);
    if (on !== labsOn) { labsOn = on; stage.classList.toggle('vl-labs-on', on); }
    if (!on) return;
    if (!labW) labW = labs.map(l => [l.s.offsetWidth, l.s.offsetHeight]);
    const taken = [];
    labs.forEach((l, n) => {
      const [w, h] = labW[n];
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
    });
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
    eve = !eve;
    try { localStorage.setItem('vl-light', eve ? 'eve' : 'day'); } catch (e) {}
    makeSprites(); showLight(); queue = []; wake(true);
  });
  showLight();

  /* ── Sound: a soft chime when a house opens, only if asked for ─────── */
  const soundBtn = $('#vl-sound');
  let sound = false, ac = null;
  try { sound = localStorage.getItem('vl-sound') === '1'; } catch (e) {}
  const showSound = () => { soundBtn.setAttribute('aria-pressed', String(sound)); soundBtn.querySelector('span').textContent = sound ? 'Sound on' : 'Sound off'; };
  soundBtn.addEventListener('click', () => { sound = !sound; try { localStorage.setItem('vl-sound', sound ? '1' : '0'); } catch (e) {} showSound(); if (sound) chime(PLACES[0]); });
  showSound();
  const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31, 33];
  // only ever called from a click, tap or key press: the AudioContext is born
  // inside a gesture, never on page load or from a link
  function chime(pl) {
    if (!sound) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
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

  /* ── Stop when unseen ──────────────────────────────────────────────── */
  const halt = () => { if (raf) cancelAnimationFrame(raf); if (timer) clearTimeout(timer); raf = timer = 0; };
  new IntersectionObserver(es => { inView = es[0].isIntersecting; if (inView) wake(false); else halt(); }).observe(stage);
  document.addEventListener('visibilitychange', () => { if (document.hidden) halt(); else { lastFrame = 0; wake(false); } });
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
