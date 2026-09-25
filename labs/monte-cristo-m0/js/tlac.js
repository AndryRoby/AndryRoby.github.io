/* Risograficky lis hry: vektorova kresba do troch hustotnych vrstiev atramentu
 * (zlta, cervena, modra), kazda vrstva rastrovana do bodov pod vlastnym uhlom,
 * s nerovnomernym nanosom a zrnom papiera, a vytlacena nasobenim na papier
 * s pevne posunutym sutlacou. Rovnaky princip ako plagat classics/monte-cristo/drawn
 * (ink.js), ale vlastny modul hry: plagat sa nemeni.
 *
 * Rozdiely oproti plagatu: stvrta vrstva "maska" drzi obrys kresby, takze
 * z lisu vychadzaju aj vystrihnute diely (babky, popredie) s priehladnym okolim;
 * a lis vracia jeden hotovy obraz (papier + atramenty), ktory sa v hre uz len kopiruje.
 *
 * Bezi vo Web Workeri (OffscreenCanvas) aj na hlavnom vlakne; DOM nepouziva.
 * Ziadny rastrovy obrazok sa nenacitava: kazdy pixel vznika v tomto kode. */

export const PAPIER = [243, 238, 227];
export const ATRAMENTY = [
  { id: 'y', rgb: [255, 181, 17], uhol: 45, posun: [1.4, -0.9] },
  { id: 'r', rgb: [241, 80, 96], uhol: 75, posun: [-1.1, 1.2] },
  { id: 'b', rgb: [50, 85, 164], uhol: 15, posun: [0, 0] },
];

export function platno(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(Math.max(1, w), Math.max(1, h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, w); c.height = Math.max(1, h);
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

/* ── Kresliaca suprava k ───────────────────────────────────────────── */
const rgba = (d) => 'rgba(0,0,0,' + Math.max(0, Math.min(1, d)).toFixed(3) + ')';

export function suprava(ctxs, maska, W, H, seed) {
  const L = { y: ctxs[0], r: ctxs[1], b: ctxs[2] };
  const keys = ['y', 'r', 'b'];
  const rnd = rng(seed || 7);
  function farba(ctx, v) {
    if (typeof v === 'number') return rgba(v);
    const g = v.lin ? ctx.createLinearGradient(...v.lin) : ctx.createRadialGradient(...v.rad);
    for (const [o, d] of v.s) g.addColorStop(Math.max(0, Math.min(1, o)), rgba(d));
    return g;
  }
  function doMasky(path, lw, rule) {
    if (!maska) return;
    maska.save();
    maska.fillStyle = maska.strokeStyle = '#000';
    if (lw != null) { maska.lineWidth = lw; maska.lineCap = 'round'; maska.lineJoin = 'round'; maska.stroke(path); } else maska.fill(path, rule || 'nonzero');
    maska.restore();
  }
  /* spec = { y, r, b }: hustota kazdeho atramentu (cislo alebo prechod).
     Bez add nahradi, co bolo pod tym (ako separacia); add:true glazuje navrch. */
  function beh(spec, path, o) {
    o = o || {};
    const lw = o.lw;
    if (!o.add && !o.bezMasky) doMasky(path, lw, o.rule);
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
        const st = farba(ctx, v);
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
    fill: (spec, p, o) => beh(spec, p, o),
    add: (spec, p, o) => beh(spec, p, Object.assign({}, o, { add: true })),
    stroke: (spec, p, lw, o) => beh(spec, p, Object.assign({}, o, { lw })),
    addStroke: (spec, p, lw, o) => beh(spec, p, Object.assign({}, o, { lw, add: true })),
    /* len obrys do masky (papier bez atramentu, ale sucast vystrihnuteho dielu) */
    papier: (p, lw) => doMasky(p, lw),
    /* vyrezat tvar zo vsetkych atramentov, spat na holy papier (amount < 1 zosvetli) */
    cut(p, amount, lw) {
      for (const key of keys) {
        const ctx = L[key];
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = ctx.strokeStyle = typeof amount === 'object' ? farba(ctx, amount) : rgba(amount == null ? 1 : amount);
        if (lw != null) { ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(p); } else ctx.fill(p);
        ctx.restore();
      }
    },
    cutInk(key, p, amount) {
      const ctx = L[key];
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = typeof amount === 'object' ? farba(ctx, amount) : rgba(amount == null ? 1 : amount);
      ctx.fill(p);
      ctx.restore();
    },
    clip(p, fn) {
      for (const key of keys) { L[key].save(); L[key].clip(p); }
      if (maska) { maska.save(); maska.clip(p); }
      fn();
      for (const key of keys) L[key].restore();
      if (maska) maska.restore();
    },
    text(spec, str, x, y, font, align) {
      for (const key of keys) {
        if (!spec[key]) continue;
        const ctx = L[key];
        ctx.save();
        ctx.font = font; ctx.textAlign = align || 'center'; ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = rgba(spec[key]);
        ctx.fillText(str, x, y);
        ctx.restore();
      }
    },
    /* rytina: rovnobezne tahy pod uhlom a v roztece, orezane tvarom */
    hatch(spec, p, uhol, rozteca, lw, o) {
      o = o || {};
      const a = (uhol * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
      const d = Math.hypot(W, H);
      const h = new Path2D();
      for (let t = -d; t < d; t += rozteca) {
        const x0 = W / 2 + c * -d - s * t, y0 = H / 2 + s * -d + c * t;
        h.moveTo(x0, y0);
        if (o.vlna) {
          for (let u = -d; u <= d; u += 12) h.lineTo(W / 2 + c * u - s * (t + Math.sin(u * 0.05 + t) * o.vlna), H / 2 + s * u + c * (t + Math.sin(u * 0.05 + t) * o.vlna));
        } else h.lineTo(W / 2 + c * d - s * t, H / 2 + s * d + c * t);
      }
      if (o.cut) this.clip(p, () => this.cut(h, o.cut, lw));
      else this.clip(p, () => beh(spec, h, { lw, add: true }));
    },
    lin: (x0, y0, x1, y1, ...s) => ({ lin: [x0, y0, x1, y1], s }),
    rad: (x, y, r0, r1, ...s) => ({ rad: [x, y, r0, x, y, r1], s }),
    rect(x, y, w, h) { const p = new Path2D(); p.rect(x, y, w, h); return p; },
    circ(x, y, r) { const p = new Path2D(); p.arc(x, y, Math.abs(r), 0, Math.PI * 2); return p; },
    ell(x, y, rx, ry, rot) { const p = new Path2D(); p.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot || 0, 0, Math.PI * 2); return p; },
    poly(pts, open) {
      const p = new Path2D();
      p.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) p.lineTo(pts[i], pts[i + 1]);
      if (!open) p.closePath();
      return p;
    },
    /* hladka krivka cez body (Catmull-Rom ako kubicke Bezierove) */
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

/* ── Textury ───────────────────────────────────────────────────────── */
const T = 256;
let _sum = null;
function sum() {
  if (_sum) return _sum;
  const r = rng(1846);
  const grid = (n) => { const g = new Float32Array(n * n); for (let i = 0; i < g.length; i++) g[i] = r(); return g; };
  const out = new Float32Array(T * T);
  for (const [n, w] of [[8, 0.55], [32, 0.3], [64, 0.15]]) {
    const g = grid(n), s = n / T;
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
  _sum = out;
  return out;
}

let _papier = null;
export function papierDlazdica() {
  if (_papier) return _papier;
  const c = platno(T, T);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(T, T);
  const n = sum();
  const r = rng(27);
  for (let i = 0; i < T * T; i++) {
    const g = (n[i] - 0.5) * 6 + (r() - 0.5) * 7;
    img.data[i * 4] = PAPIER[0] + g;
    img.data[i * 4 + 1] = PAPIER[1] + g;
    img.data[i * 4 + 2] = PAPIER[2] + g * 1.1;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  ctx.lineWidth = 0.6;
  for (let i = 0; i < 22; i++) {
    const x = r() * T, y = r() * T, a = r() * Math.PI, l = 4 + r() * 12;
    ctx.strokeStyle = r() < 0.5 ? 'rgba(120,100,70,.08)' : 'rgba(255,255,255,.3)';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a) * l * 0.6 + 2, y + Math.sin(a) * l * 0.6, x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
  }
  _papier = c;
  return c;
}

/* ── Raster ────────────────────────────────────────────────────────── */
const N = 2048, M = N - 1;
const LUT = new Float32Array(N);
for (let i = 0; i < N; i++) LUT[i] = Math.cos((i / N) * Math.PI * 2);
const voWorkeri = typeof document === 'undefined';
const pauza = () => new Promise((r) => setTimeout(r, 0));

async function rastruj(d, w, h, li, cell, ox0, oy0) {
  const ink = ATRAMENTY[li];
  const tex = sum();
  const sharp = cell / 2.1;
  const th = (ink.uhol * Math.PI) / 180;
  const ca = (Math.cos(th) / cell) * N, sa = (Math.sin(th) / cell) * N;
  const [ir, ig, ib] = ink.rgb;
  const ox = li * 71 + ox0, oy = li * 113 + oy0;
  let t0 = performance.now();
  for (let y = 0; y < h; y++) {
    /* rastrova mriezka je viazana na svetove suradnice (ox0, oy0), takze
       susedne vytlacene kusy toho isteho sveta na seba nadvazuju */
    const yy = y + oy0;
    let u = yy * sa + ox0 * ca, v = yy * ca - ox0 * sa;
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
      c *= 0.74 + 0.3 * tex[ty + ((x + ox) & 255)];
      const X = x + ox0, Y = yy;
      if ((((X * 73856093) ^ (Y * 19349663) ^ (li * 83492791)) & 1023) < 9) c *= 0.35;
      d[i] = ir; d[i + 1] = ig; d[i + 2] = ib;
      d[i + 3] = c > 1 ? 255 : c * 255;
    }
    if (!voWorkeri && (y & 15) === 15 && performance.now() - t0 > 6) { await pauza(); t0 = performance.now(); }
  }
}

/* Vytlaci kresbu. kresba = { w, h, seed, draw(k), maska?, atramenty? }
 * s = zariadenove pixely na logicku jednotku, cell = bunka rastra v zariadenovych pixeloch.
 * o.x0, o.y0 = kde lezi kresba vo svete (pre nadvazny raster), o.papierPosun.
 * Vrati platno: papier + atramenty; s maskou je okolie kresby priehladne. */
export async function lis(kresba, s, cell, o) {
  o = o || {};
  if (kresba.mierka) s *= kresba.mierka;
  const w = Math.max(1, Math.ceil(kresba.w * s)), h = Math.max(1, Math.ceil(kresba.h * s));
  /* kresba s x0, y0 kresli vo svetovych suradniciach, obraz zacina v (x0, y0) */
  const kx = kresba.x0 || 0, ky = kresba.y0 || 0;
  const vrstvy = ATRAMENTY.map(() => platno(w, h));
  const ctxs = vrstvy.map((c) => { const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.setTransform(s, 0, 0, s, -kx * s, -ky * s); return ctx; });
  let m = null, mc = null;
  if (kresba.maska) { mc = platno(w, h); m = mc.getContext('2d'); m.setTransform(s, 0, 0, s, -kx * s, -ky * s); }
  kresba.draw(suprava(ctxs, m, kx + kresba.w, ky + kresba.h, kresba.seed));
  if (!voWorkeri) await pauza();
  const ox0 = Math.round((o.x0 != null ? o.x0 : kx) * s), oy0 = Math.round((o.y0 != null ? o.y0 : ky) * s);
  const pouzite = kresba.atramenty || 'yrb';
  for (let li = 0; li < 3; li++) {
    if (!pouzite.includes(ATRAMENTY[li].id)) continue;
    const ctx = ctxs[li];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const img = ctx.getImageData(0, 0, w, h);
    await rastruj(img.data, w, h, li, Math.max(2.6, cell), ox0, oy0);
    ctx.putImageData(img, 0, 0);
    if (!voWorkeri) await pauza();
  }
  const out = platno(w, h);
  const c = out.getContext('2d');
  c.save();
  c.translate(-(ox0 % T), -(oy0 % T));
  c.fillStyle = c.createPattern(papierDlazdica(), 'repeat');
  c.fillRect(0, 0, w + T, h + T);
  c.restore();
  c.globalCompositeOperation = 'multiply';
  const pr = s / 2;
  for (let li = 0; li < 3; li++) {
    if (!pouzite.includes(ATRAMENTY[li].id)) continue;
    const [px, py] = ATRAMENTY[li].posun;
    c.drawImage(vrstvy[li], Math.round(px * pr), Math.round(py * pr));
  }
  if (mc) {
    c.globalCompositeOperation = 'destination-in';
    c.drawImage(mc, 0, 0);
  }
  c.globalCompositeOperation = 'source-over';
  return out;
}

/* Na koniec prace: z platna urobi ImageBitmap (vo workeri bez kopie). */
export async function naBitmapu(pl) {
  if (pl.transferToImageBitmap) return pl.transferToImageBitmap();
  if (typeof createImageBitmap === 'function') return createImageBitmap(pl);
  return pl;
}
