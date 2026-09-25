/* The press: turns vector drawing into a three ink risograph print.
 *
 * A scene draws shapes into three density layers (yellow, red, blue), where the
 * alpha of each pixel is how much ink that colour should lay down there. Each
 * layer is then screened into halftone dots at its own angle, given an uneven
 * ink texture, and printed over paper with the multiply blend, slightly out of
 * register, the way a two or three drum risograph prints a poster.
 *
 * This file runs both in a Web Worker (OffscreenCanvas) and on the main thread,
 * so it never touches the DOM directly: canvases come from makeCanvas().
 * Nothing here loads an image: every pixel comes from the code below. */

export const PAPER = [243, 238, 227];
export const INKS = [
  { id: 'y', name: 'sunflower yellow', rgb: [255, 181, 17], angle: 45, off: [1.4, -0.9] },
  { id: 'r', name: 'bright red', rgb: [241, 80, 96], angle: 75, off: [-1.1, 1.2] },
  { id: 'b', name: 'medium blue', rgb: [50, 85, 164], angle: 15, off: [0, 0] },
];

export function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── Drawing kit: what a scene uses ─────────────────────────────────────── */

const rgba = (d) => 'rgba(0,0,0,' + Math.max(0, Math.min(1, d)).toFixed(3) + ')';

export function kit(ctxs, W, H, seed) {
  const L = { y: ctxs[0], r: ctxs[1], b: ctxs[2] };
  const keys = ['y', 'r', 'b'];
  const rnd = rng(seed);

  function paint(ctx, v) {
    if (typeof v === 'number') return rgba(v);
    const g = v.lin ? ctx.createLinearGradient(...v.lin) : ctx.createRadialGradient(...v.rad);
    for (const [o, d] of v.s) g.addColorStop(Math.max(0, Math.min(1, o)), rgba(d));
    return g;
  }

  /* spec = { y, r, b }: density of each ink (number or gradient).
     Default mode replaces what was there (like a separation), add:true glazes on top. */
  function run(spec, path, o) {
    o = o || {};
    const lw = o.lw;
    for (const key of keys) {
      const ctx = L[key];
      const v = spec[key];
      if (!v && o.add) continue;
      ctx.save();
      if (lw != null) { ctx.lineWidth = lw; ctx.lineCap = o.cap || 'round'; ctx.lineJoin = 'round'; }
      if (!o.add) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = ctx.strokeStyle = '#000';
        if (lw != null) ctx.stroke(path); else ctx.fill(path, o.rule || 'nonzero');
      }
      if (v) {
        ctx.globalCompositeOperation = 'source-over';
        const st = paint(ctx, v);
        if (lw != null) { ctx.strokeStyle = st; ctx.stroke(path); } else { ctx.fillStyle = st; ctx.fill(path, o.rule || 'nonzero'); }
      }
      ctx.restore();
    }
  }

  const k = {
    W, H, rnd,
    R: (a, b) => a + (b - a) * rnd(),
    pick: (arr) => arr[Math.floor(rnd() * arr.length)],
    P: (d) => (d ? new Path2D(d) : new Path2D()),
    fill: (spec, p, o) => run(spec, p, o),
    add: (spec, p, o) => run(spec, p, Object.assign({}, o, { add: true })),
    stroke: (spec, p, lw, o) => run(spec, p, Object.assign({}, o, { lw })),
    addStroke: (spec, p, lw, o) => run(spec, p, Object.assign({}, o, { lw, add: true })),
    /* knock a shape out of every ink, back to bare paper (amount < 1 lightens) */
    cut(p, amount, lw) {
      for (const key of keys) {
        const ctx = L[key];
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = ctx.strokeStyle = typeof amount === 'object' ? paint(ctx, amount) : rgba(amount == null ? 1 : amount);
        if (lw != null) { ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(p); } else ctx.fill(p);
        ctx.restore();
      }
    },
    /* lighten only one ink */
    cutInk(key, p, amount, lw) {
      const ctx = L[key];
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = ctx.strokeStyle = typeof amount === 'object' ? paint(ctx, amount) : rgba(amount == null ? 1 : amount);
      if (lw != null) { ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.stroke(p); } else ctx.fill(p);
      ctx.restore();
    },
    clip(p, fn) {
      for (const key of keys) { L[key].save(); L[key].clip(p); }
      fn();
      for (const key of keys) L[key].restore();
    },
    text(spec, str, x, y, font, align, cut) {
      for (const key of keys) {
        const ctx = L[key];
        ctx.save();
        ctx.font = font;
        ctx.textAlign = align || 'center';
        ctx.textBaseline = 'alphabetic';
        if (cut) {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.fillStyle = '#000';
          ctx.fillText(str, x, y);
        } else if (spec[key]) {
          ctx.fillStyle = rgba(spec[key]);
          ctx.fillText(str, x, y);
        }
        ctx.restore();
      }
    },
    lin: (x0, y0, x1, y1, ...s) => ({ lin: [x0, y0, x1, y1], s }),
    rad: (x, y, r0, r1, ...s) => ({ rad: [x, y, r0, x, y, r1], s }),
    rect(x, y, w, h) { const p = new Path2D(); p.rect(x, y, w, h); return p; },
    circ(x, y, r) { const p = new Path2D(); p.arc(x, y, r, 0, Math.PI * 2); return p; },
    ell(x, y, rx, ry, rot) { const p = new Path2D(); p.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot || 0, 0, Math.PI * 2); return p; },
    poly(pts, open) {
      const p = new Path2D();
      p.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) p.lineTo(pts[i], pts[i + 1]);
      if (!open) p.closePath();
      return p;
    },
    /* a smooth closed blob through points (Catmull-Rom as cubic Béziers) */
    blob(pts, open) {
      const p = new Path2D();
      const n = pts.length / 2;
      const P = (i) => { i = open ? Math.max(0, Math.min(n - 1, i)) : (i + n) % n; return [pts[i * 2], pts[i * 2 + 1]]; };
      const [sx, sy] = P(0);
      p.moveTo(sx, sy);
      const last = open ? n - 1 : n;
      for (let i = 0; i < last; i++) {
        const [x0, y0] = P(i - 1), [x1, y1] = P(i), [x2, y2] = P(i + 1), [x3, y3] = P(i + 2);
        p.bezierCurveTo(x1 + (x2 - x0) / 6, y1 + (y2 - y0) / 6, x2 - (x3 - x1) / 6, y2 - (y3 - y1) / 6, x2, y2);
      }
      if (!open) p.closePath();
      return p;
    },
  };
  return k;
}

/* ── Shared textures ────────────────────────────────────────────────────── */

const T = 256;
let noiseTile = null;
function noise() {
  if (noiseTile) return noiseTile;
  const r = rng(1846);
  const grid = (n) => { const g = new Float32Array(n * n); for (let i = 0; i < g.length; i++) g[i] = r(); return g; };
  const oct = [[8, 0.55], [32, 0.3], [64, 0.15]];
  const out = new Float32Array(T * T);
  for (const [n, w] of oct) {
    const g = grid(n);
    const s = n / T;
    for (let y = 0; y < T; y++) {
      const gy = y * s, y0 = Math.floor(gy), fy = gy - y0, sy = fy * fy * (3 - 2 * fy);
      for (let x = 0; x < T; x++) {
        const gx = x * s, x0 = Math.floor(gx), fx = gx - x0, sx = fx * fx * (3 - 2 * fx);
        const a = g[(y0 % n) * n + (x0 % n)], b = g[(y0 % n) * n + ((x0 + 1) % n)];
        const c = g[((y0 + 1) % n) * n + (x0 % n)], d = g[((y0 + 1) % n) * n + ((x0 + 1) % n)];
        out[y * T + x] += w * ((a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy);
      }
    }
  }
  noiseTile = out;
  return out;
}

let paperCanvas = null;
export function paperTile() {
  if (paperCanvas) return paperCanvas;
  const c = makeCanvas(T, T);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(T, T);
  const n = noise();
  const r = rng(27);
  for (let i = 0; i < T * T; i++) {
    const g = (n[i] - 0.5) * 6 + (r() - 0.5) * 7;
    img.data[i * 4] = PAPER[0] + g;
    img.data[i * 4 + 1] = PAPER[1] + g;
    img.data[i * 4 + 2] = PAPER[2] + g * 1.1;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  /* a few paper fibres */
  ctx.lineWidth = 0.6;
  for (let i = 0; i < 22; i++) {
    const x = r() * T, y = r() * T, a = r() * Math.PI, l = 4 + r() * 12;
    ctx.strokeStyle = r() < 0.5 ? 'rgba(120,100,70,.08)' : 'rgba(255,255,255,.3)';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a) * l * 0.6 + 2, y + Math.sin(a) * l * 0.6, x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
  }
  paperCanvas = c;
  return c;
}

/* ── The press itself ───────────────────────────────────────────────────── */

const N = 2048, M = N - 1;
const LUT = new Float32Array(N);
for (let i = 0; i < N; i++) LUT[i] = Math.cos((i / N) * Math.PI * 2);

const inWorker = typeof document === 'undefined';
const pause = () => new Promise((r) => setTimeout(r, 0));

/* Size of the print in device pixels for a plate cssW wide, capped so a weak
   phone never holds more than it can move smoothly. */
export function printSize(cssW, VW, VH, dpr) {
  const pr0 = Math.min(dpr || 1, 2);
  let w = Math.round(cssW * pr0);
  let h = Math.round((w * VH) / VW);
  const cap = 1400000;
  if (w * h > cap) { const s = Math.sqrt(cap / (w * h)); w = Math.round(w * s); h = Math.round(h * s); }
  return { w, h, pr: w / cssW };
}

/* Screen one density layer into halftone dots in place. */
async function screen(d, w, h, li, cell) {
  const ink = INKS[li];
  const tex = noise();
  const sharp = cell / 2.1;
  const th = (ink.angle * Math.PI) / 180;
  const ca = (Math.cos(th) / cell) * N, sa = (Math.sin(th) / cell) * N;
  const [ir, ig, ib] = ink.rgb;
  const ox = li * 71, oy = li * 113;
  let t0 = performance.now();
  for (let y = 0; y < h; y++) {
    let u = y * sa, v = y * ca;
    let i = y * w * 4;
    const ty = ((y + oy) & 255) * T;
    for (let x = 0; x < w; x++, i += 4, u += ca, v -= sa) {
      const a = d[i + 3];
      if (a === 0) continue;
      const den = a / 255;
      const t = 0.5 + 0.25 * (LUT[(u | 0) & M] + LUT[(v | 0) & M]);
      let c = (den - t) * sharp + 0.5;
      const solid = (den - 0.86) * 8;
      if (solid > c) c = solid;
      if (c <= 0) { d[i + 3] = 0; continue; }
      if (c > 1) c = 1;
      const n = tex[ty + ((x + ox) & 255)];
      c *= 0.74 + 0.3 * n;
      /* pinholes where the drum did not quite ink */
      if ((((x * 73856093) ^ (y * 19349663) ^ (li * 83492791)) & 1023) < 9) c *= 0.35;
      d[i] = ir; d[i + 1] = ig; d[i + 2] = ib;
      d[i + 3] = c > 1 ? 255 : c * 255;
    }
    /* on the main thread, give the page a frame every few milliseconds */
    if (!inWorker && (y & 15) === 15 && performance.now() - t0 > 6) { await pause(); t0 = performance.now(); }
  }
}

/* Draw the scene and screen it. Returns three canvases, one per ink,
   each holding that ink's colour with coverage in the alpha channel.
   cell is the halftone cell in device pixels. */
export async function press(scene, size, cell) {
  const { w, h } = size;
  const layers = INKS.map(() => makeCanvas(w, h));
  const ctxs = layers.map((c) => {
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.setTransform(w / scene.w, 0, 0, h / scene.h, 0, 0);
    return ctx;
  });
  scene.draw(kit(ctxs, scene.w, scene.h, scene.seed || 7));
  if (!inWorker) await pause();
  for (let li = 0; li < INKS.length; li++) {
    const ctx = ctxs[li];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const img = ctx.getImageData(0, 0, w, h);
    await screen(img.data, w, h, li, Math.max(3.2, cell));
    ctx.putImageData(img, 0, 0);
    if (!inWorker) await pause();
  }
  return layers;
}

/* Lay the inks on paper. p[i] in 0..1 is how far the drum has carried ink i
   down the sheet. Without p the print is finished. */
export function lay(ctx, layers, size, p) {
  const { w, h, pr } = size;
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  if (!ctx._paper) ctx._paper = ctx.createPattern(paperTile(), 'repeat');
  ctx.fillStyle = ctx._paper;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < layers.length; i++) {
    const q = p ? p[i] : 1;
    if (q <= 0) continue;
    const e = 1 - Math.pow(1 - q, 3);
    const [ox, oy] = INKS[i].off;
    ctx.save();
    if (q < 1) {
      ctx.beginPath();
      ctx.rect(0, 0, w, h * e + 1);
      ctx.clip();
      ctx.globalAlpha = 0.45 + 0.55 * e;
    }
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(layers[i], ox * pr, oy * pr - (1 - e) * 6 * pr);
    ctx.restore();
  }
}
