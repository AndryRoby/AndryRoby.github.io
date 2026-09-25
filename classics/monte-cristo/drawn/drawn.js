/* The Count of Monte Cristo, drawn in code: the page.
 *
 * Every plate is printed only when it comes near the screen, one at a time,
 * in a background thread (press-worker.js). The page then shows the three ink
 * drums passing over the paper, once, and keeps only the finished print as a
 * compressed image. After that nothing runs: no timer, no animation frame.
 * Off screen, a print in progress jumps to its end; a hidden tab stops all.
 */
import { printSize } from './ink.js';

/* the page's version (drawn.js?v=N) is passed on to the worker and the scenes,
   so a deploy never mixes a cached scene list with new plates */
const V = new URL(import.meta.url).search;

const SHAPES = { pano: [1400, 700], wide: [1200, 800], tall: [1000, 1250] };
const plates = [...document.querySelectorAll('.plate[data-scene]')];
const count = document.querySelector('[data-scene-count]');
if (count) count.textContent = String(plates.length);

const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const weak = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 2;
const stats = { plates: {}, worker: false, weak, animated: 0 };
window.__drawn = stats;

/* ── The press: a worker when the browser can draw off the main thread ── */
let worker = null;
let local = null;
const waiting = new Map();
const canWorker = typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' &&
  'convertToBlob' in OffscreenCanvas.prototype && 'transferToImageBitmap' in OffscreenCanvas.prototype;
if (canWorker) {
  try {
    worker = new Worker(new URL('./press-worker.js' + V, import.meta.url), { type: 'module' });
    stats.worker = true;
    worker.onmessage = (e) => { const w = waiting.get(e.data.id); if (w) { waiting.delete(e.data.id); w(e.data); } };
    worker.onerror = () => { worker = null; stats.worker = false; for (const [id, w] of waiting) { waiting.delete(id); w({ id, retry: true }); } };
  } catch (err) { worker = null; }
}

async function printHere(job) {
  /* the same press on the main thread, in small slices */
  if (!local) local = Promise.all([import('./ink.js'), import('./scenes/index.js' + V)]);
  const [ink, sc] = await local;
  const scene = sc.SCENES[job.id];
  const size = { w: job.w, h: job.h, pr: job.pr };
  const layers = await ink.press(scene, size, job.cell);
  const out = document.createElement('canvas');
  out.width = job.w; out.height = job.h;
  ink.lay(out.getContext('2d'), layers, size);
  const blob = await new Promise((r) => out.toBlob(r, 'image/webp', 0.92));
  let bitmaps = null;
  if (job.layers) {
    /* the same three stages as the worker makes: yellow, yellow and red, all */
    bitmaps = [[1, 0, 0], [1, 1, 0]].map((p) => { const c = document.createElement('canvas'); c.width = job.w; c.height = job.h; ink.lay(c.getContext('2d'), layers, size, p); return c; });
    bitmaps.push(out);
  }
  return { id: job.id, blob, bitmaps };
}

function run(job) {
  if (!worker) return printHere(job);
  return new Promise((resolve) => {
    waiting.set(job.id, (m) => resolve(m.retry ? printHere(job) : m));
    worker.postMessage(job);
  });
}

/* ── Which plates are near, which are on screen ──────────────────────── */
const near = new Set();
const onScreen = new Set();
const done = new WeakMap();
const pending = new Map();
const running = new Map();
let busy = false;

function sizeFor(plate) {
  const art = plate.querySelector('.art');
  const [VW, VH] = SHAPES[plate.dataset.shape] || SHAPES.wide;
  const cssW = Math.max(200, Math.round(art.getBoundingClientRect().width));
  const size = printSize(cssW, VW, VH, window.devicePixelRatio || 1);
  /* halftone cell: about 4 css pixels, a little finer on a small screen */
  const cell = Math.min(4.6, Math.max(3, cssW / 240)) * size.pr;
  return { art, cssW, size, cell };
}

function nextPlate() {
  let best = null, bestD = Infinity;
  const mid = innerHeight / 2;
  for (const p of near) {
    const r = p.getBoundingClientRect();
    const d = Math.abs(r.top + r.height / 2 - mid) - (onScreen.has(p) ? 1e5 : 0);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

async function pump() {
  if (busy || document.hidden) return;
  const plate = nextPlate();
  if (!plate) return;
  busy = true;
  near.delete(plate);
  const { art, cssW, size, cell } = sizeFor(plate);
  const id = plate.dataset.scene;
  /* the drums are shown once, when the plate is first on screen */
  const animate = !reduce.matches;
  const t0 = performance.now();
  try {
    const res = await run({ id, w: size.w, h: size.h, pr: size.pr, cell, layers: animate });
    if (res.error) throw new Error(res.error);
    stats.plates[id] = { ms: Math.round(performance.now() - t0), worker: !!worker, w: size.w, h: size.h, kb: Math.round(res.blob.size / 1024) };
    done.set(plate, cssW);
    if (animate && res.bitmaps && !onScreen.has(plate)) {
      pending.set(plate, { art, res, size });
      if (pending.size > 3) { const [first, p] = pending.entries().next().value; pending.delete(first); show(first, p.art, p.res, p.size, false); }
    }
    else await show(plate, art, res, size, animate);
  } catch (err) {
    plate.classList.add('is-failed');
    stats.plates[id] = { error: String(err && err.message || err) };
  }
  busy = false;
  pump();
}

/* ── Showing a print: the drums once, then a still image ─────────────── */
function show(plate, art, res, size, animate) {
  const url = URL.createObjectURL(res.blob);
  const img = new Image();
  img.alt = '';
  img.decoding = 'async';
  img.className = 'print';
  img.width = size.w; img.height = size.h;
  const finish = () => {
    const old = art.querySelector('.print');
    art.appendChild(img);
    if (old && old !== img) { if (old.src) URL.revokeObjectURL(old.src); old.remove(); }
    if (res.bitmaps) for (const b of res.bitmaps) if (b.close) b.close();
    plate.classList.add('is-printed');
  };
  img.src = url;
  const ready = img.decode ? img.decode().catch(() => {}) : Promise.resolve();
  if (!animate || !res.bitmaps) return ready.then(finish);
  stats.animated++;

  /* The print in three opaque stages (yellow; yellow and red; all three),
     each in a window that opens down the sheet like a drum passing over it.
     A later drum always trails the one before, so it only ever uncovers
     ink that has already been laid. Only transforms move and nothing is
     blended, so the compositor does the work cheaply and the main thread
     stays free. */
  return new Promise((resolve) => {
    plate.classList.add('is-printing');
    const box = document.createElement('div');
    box.className = 'drums';
    box.setAttribute('aria-hidden', 'true');
    const D = weak ? 650 : 950, STAG = weak ? 220 : 340;
    const anims = [];
    res.bitmaps.forEach((bm, i) => {
      const wipe = document.createElement('div');
      wipe.className = 'wipe';
      const inner = document.createElement('div');
      let cv = bm;
      if (!(bm instanceof HTMLCanvasElement)) {
        cv = document.createElement('canvas');
        cv.width = size.w; cv.height = size.h;
        const br = cv.getContext('bitmaprenderer');
        if (br) br.transferFromImageBitmap(bm); else cv.getContext('2d').drawImage(bm, 0, 0);
      }
      inner.appendChild(cv);
      wipe.appendChild(inner);
      box.appendChild(wipe);
      const o = { duration: D, delay: i * STAG, easing: 'cubic-bezier(.33,.1,.25,1)', fill: 'both' };
      anims.push(wipe.animate([{ transform: 'translateY(-100%)' }, { transform: 'translateY(0)' }], o));
      anims.push(inner.animate([{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], o));
    });
    art.appendChild(box);
    let ended = false;
    const end = () => {
      if (ended) return;
      ended = true;
      running.delete(plate);
      ready.then(() => { finish(); box.remove(); plate.classList.remove('is-printing'); resolve(); });
    };
    running.set(plate, () => { for (const an of anims) an.finish(); });
    Promise.all(anims.map((an) => an.finished)).then(end, end);
  });
}

/* ── Observers ────────────────────────────────────────────────────────── */
const nearObs = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (e.isIntersecting && !done.has(e.target)) near.add(e.target);
    else near.delete(e.target);
  }
  pump();
}, { rootMargin: '120% 0px 120% 0px' });
const screenObs = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (e.isIntersecting) {
      onScreen.add(e.target);
      const p = pending.get(e.target);
      if (p) { pending.delete(e.target); show(e.target, p.art, p.res, p.size, true); }
    } else {
      onScreen.delete(e.target);
      const stop = running.get(e.target);
      if (stop) stop();
    }
  }
  pump();
}, { threshold: 0.15 });
for (const p of plates) { nearObs.observe(p); screenObs.observe(p); }
document.addEventListener('visibilitychange', () => {
  if (document.hidden) for (const stop of running.values()) stop();
  else pump();
});

/* A much wider window than the print was made for: print it again, sharper. */
let resizeT = 0;
addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => {
    for (const p of plates) {
      const w = done.get(p);
      if (w && p.querySelector('.art').getBoundingClientRect().width > w * 1.3) { done.delete(p); nearObs.unobserve(p); nearObs.observe(p); }
    }
  }, 500);
}, { passive: true });
