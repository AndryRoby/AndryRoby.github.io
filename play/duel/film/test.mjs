// Test filmu Duel bez prehliadača: node products/arling-sk/play/duel/film/test.mjs
//
// Falošné 2D plátno zaznamená každé volanie. Film sa nakreslí pre časy 0 až koniec po 1/30 s vo
// všetkých štyroch formátoch a test overí:
//   1. žiadna výnimka (aj záporný polomer v arc/arcTo/ellipse a zlý offset prechodu vyhodia chybu
//      ako v prehliadači, lebo taká chyba v Hedgehogs zastavila rAF),
//   2. žiadne NaN ani nekonečno v súradniciach, rozmeroch a číselných vlastnostiach,
//   3. každý text (fillText aj text zapečený v sprite a zložený cez drawImage) leží celý v zóne
//      zona(W, H), s rezervou 0,5 px,
//   4. najmenšie písmo po všetkých transformáciách je aspoň minPismo(W, H),
//   5. partitúra: každá udalosť má konečný čas v [0, dĺžka] a známy nástroj,
//   6. titulky filmu: čas čítania aspoň slová / 3 + 0,5 s,
//   7. všetky tri verzie záveru (coming-soon, google-play, obchod) prejdú body 1 až 4 v závere.
//
// Šírka textu je odhad (Nunito priemerne okolo 0,55 em na znak). Rozloženie filmu meria text tou istou
// funkciou, takže test overuje logiku rozloženia; v prehliadači meria skutočné písmo.

import { zona, minPismo, format } from './engine/hak.js';

// ---------- falošné plátno ----------

const chyby = [];
const cislo = (meno, ...h) => {
  for (const v of h) if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`${meno}: nečíselná hodnota ${v}`);
};

function sirkaZnaku(ch) {
  if (' .,:;!|\'il'.includes(ch)) return 0.28;
  if ('fjtrI()[]'.includes(ch)) return 0.36;
  if ('mwMW'.includes(ch)) return 0.86;
  if (ch >= '0' && ch <= '9') return 0.56;
  if (ch >= 'A' && ch <= 'Z') return 0.66;
  return 0.55;
}
function pxPisma(font) {
  const m = /(\d+(?:\.\d+)?)px/.exec(font || '');
  return m ? Number(m[1]) : 10;
}
function zmeraj(text, font) {
  const px = pxPisma(font);
  let w = 0;
  for (const ch of String(text)) w += sirkaZnaku(ch);
  return { px, width: w * px };
}

class FalosnyPrechod {
  addColorStop(o, farba) {
    cislo('addColorStop', o);
    if (o < 0 || o > 1) throw new RangeError(`IndexSizeError: addColorStop ${o}`);
    if (typeof farba !== 'string') throw new TypeError('addColorStop bez farby');
  }
}

let pocitadloPlatien = 0;
export class FalosnePlatno {
  constructor(w = 300, h = 150) { this.width = w; this.height = h; this.texty = []; this.id = ++pocitadloPlatien; this._ctx = null; }
  getContext() { return this._ctx || (this._ctx = new FalosnyKontext(this)); }
}

const NUM_VLASTNOSTI = ['lineWidth', 'globalAlpha', 'lineDashOffset', 'shadowBlur', 'shadowOffsetX', 'shadowOffsetY', 'miterLimit'];

class FalosnyKontext {
  constructor(canvas) {
    this.canvas = canvas;
    this.cesta = null; // obálka aktuálnej cesty v súradniciach plátna (na clip)
    this.s = { m: [1, 0, 0, 1, 0, 0], clip: null, font: '10px sans-serif', textAlign: 'start', textBaseline: 'alphabetic', fillStyle: '#000', strokeStyle: '#000', lineCap: 'butt', lineJoin: 'miter', globalCompositeOperation: 'source-over', letterSpacing: '0px' };
    this.num = { lineWidth: 1, globalAlpha: 1, lineDashOffset: 0, shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0, miterLimit: 10 };
    this.zasobnik = [];
    this.shadowColor = 'rgba(0,0,0,0)';
    this.imageSmoothingEnabled = true;
    this.volania = 0;
  }
  // stav
  get font() { return this.s.font; } set font(v) { this.s.font = v; }
  get textAlign() { return this.s.textAlign; } set textAlign(v) { this.s.textAlign = v; }
  get textBaseline() { return this.s.textBaseline; } set textBaseline(v) { this.s.textBaseline = v; }
  get fillStyle() { return this.s.fillStyle; } set fillStyle(v) { if (v === undefined || v === null) throw new TypeError('fillStyle prázdny'); this.s.fillStyle = v; }
  get strokeStyle() { return this.s.strokeStyle; } set strokeStyle(v) { if (v === undefined || v === null) throw new TypeError('strokeStyle prázdny'); this.s.strokeStyle = v; }
  get lineCap() { return this.s.lineCap; } set lineCap(v) { this.s.lineCap = v; }
  get lineJoin() { return this.s.lineJoin; } set lineJoin(v) { this.s.lineJoin = v; }
  get letterSpacing() { return this.s.letterSpacing; } set letterSpacing(v) { this.s.letterSpacing = v; }
  get globalCompositeOperation() { return this.s.globalCompositeOperation; } set globalCompositeOperation(v) { this.s.globalCompositeOperation = v; }
  save() { this.zasobnik.push({ s: { ...this.s, m: [...this.s.m], clip: this.s.clip && { ...this.s.clip } }, num: { ...this.num } }); }
  restore() { const z = this.zasobnik.pop(); if (z) { this.s = z.s; this.num = z.num; } }
  // transformácie
  _nasob(a, b, c, d, e, f) {
    const [A, B, C, D, E, F] = this.s.m;
    this.s.m = [A * a + C * b, B * a + D * b, A * c + C * d, B * c + D * d, A * e + C * f + E, B * e + D * f + F];
  }
  translate(x, y) { cislo('translate', x, y); this._nasob(1, 0, 0, 1, x, y); }
  scale(x, y) { cislo('scale', x, y); this._nasob(x, 0, 0, y, 0, 0); }
  rotate(u) { cislo('rotate', u); const c = Math.cos(u), s = Math.sin(u); this._nasob(c, s, -s, c, 0, 0); }
  transform(a, b, c, d, e, f) { cislo('transform', a, b, c, d, e, f); this._nasob(a, b, c, d, e, f); }
  setTransform(a, b, c, d, e, f) {
    if (typeof a === 'object' && a) { ({ a, b, c, d, e, f } = a); }
    if (a === undefined) { a = 1; b = 0; c = 0; d = 1; e = 0; f = 0; }
    cislo('setTransform', a, b, c, d, e, f); this.s.m = [a, b, c, d, e, f];
  }
  resetTransform() { this.s.m = [1, 0, 0, 1, 0, 0]; }
  getTransform() { const [a, b, c, d, e, f] = this.s.m; return { a, b, c, d, e, f }; }
  _bod(x, y) { const [a, b, c, d, e, f] = this.s.m; return [a * x + c * y + e, b * x + d * y + f]; }
  _mierka() { const [a, b, c, d] = this.s.m; return Math.sqrt(Math.abs(a * d - b * c)); }
  // cesty (obálka bodov kvôli clip; oblúky pridajú štvorec okolo stredu)
  _pridaj(x, y) {
    const [px, py] = this._bod(x, y);
    const c = this.cesta || (this.cesta = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
    c.x0 = Math.min(c.x0, px); c.y0 = Math.min(c.y0, py); c.x1 = Math.max(c.x1, px); c.y1 = Math.max(c.y1, py);
  }
  beginPath() { this.volania++; this.cesta = null; } closePath() {}
  moveTo(x, y) { cislo('moveTo', x, y); this._pridaj(x, y); } lineTo(x, y) { cislo('lineTo', x, y); this._pridaj(x, y); }
  quadraticCurveTo(a, b, c, d) { cislo('quadraticCurveTo', a, b, c, d); this._pridaj(a, b); this._pridaj(c, d); }
  bezierCurveTo(a, b, c, d, e, f) { cislo('bezierCurveTo', a, b, c, d, e, f); this._pridaj(a, b); this._pridaj(c, d); this._pridaj(e, f); }
  arc(x, y, r, a0, a1) { cislo('arc', x, y, r, a0, a1); if (r < 0) throw new RangeError(`IndexSizeError: arc so záporným polomerom ${r}`); this._pridaj(x - r, y - r); this._pridaj(x + r, y + r); }
  arcTo(x1, y1, x2, y2, r) { cislo('arcTo', x1, y1, x2, y2, r); if (r < 0) throw new RangeError(`IndexSizeError: arcTo so záporným polomerom ${r}`); this._pridaj(x1, y1); this._pridaj(x2, y2); }
  ellipse(x, y, rx, ry, rot, a0, a1) { cislo('ellipse', x, y, rx, ry, rot, a0, a1); if (rx < 0 || ry < 0) throw new RangeError('IndexSizeError: ellipse so záporným polomerom'); this._pridaj(x - rx, y - ry); this._pridaj(x + rx, y + ry); }
  rect(x, y, w, h) { cislo('rect', x, y, w, h); this._pridaj(x, y); this._pridaj(x + w, y + h); this._pridaj(x + w, y); this._pridaj(x, y + h); }
  roundRect(x, y, w, h, r = 0) { cislo('roundRect', x, y, w, h); for (const q of [].concat(r)) { cislo('roundRect r', q); if (q < 0) throw new RangeError('roundRect záporný polomer'); } this.rect(x, y, w, h); }
  fill() { this.volania++; } stroke() { this.volania++; }
  clip() {
    const c = this.cesta;
    if (!c) { this.s.clip = { x0: 0, y0: 0, x1: 0, y1: 0 }; return; }
    const o = this.s.clip;
    this.s.clip = o ? { x0: Math.max(o.x0, c.x0), y0: Math.max(o.y0, c.y0), x1: Math.min(o.x1, c.x1), y1: Math.min(o.y1, c.y1) } : { ...c };
  }
  /** Záznam textu orezaný aktuálnym clipom; null, ak z neho nič nevidno. */
  _orez(r) {
    const c = this.s.clip;
    if (!c) return r;
    const q = { ...r, x0: Math.max(r.x0, c.x0), y0: Math.max(r.y0, c.y0), x1: Math.min(r.x1, c.x1), y1: Math.min(r.y1, c.y1) };
    return q.x1 - q.x0 > 0.5 && q.y1 - q.y0 > 0.5 ? q : null;
  }
  fillRect(x, y, w, h) { cislo('fillRect', x, y, w, h); this.volania++; }
  strokeRect(x, y, w, h) { cislo('strokeRect', x, y, w, h); }
  clearRect(x, y, w, h) { cislo('clearRect', x, y, w, h); }
  setLineDash(p) { for (const q of p) cislo('setLineDash', q); }
  getLineDash() { return []; }
  isPointInPath() { return false; }
  // prechody a vzory
  createLinearGradient(a, b, c, d) { if (![a, b, c, d].every(Number.isFinite)) throw new TypeError('createLinearGradient: nekonečno'); return new FalosnyPrechod(); }
  createRadialGradient(a, b, r0, c, d, r1) {
    if (![a, b, r0, c, d, r1].every(Number.isFinite)) throw new TypeError('createRadialGradient: nekonečno');
    if (r0 < 0 || r1 < 0) throw new RangeError('createRadialGradient: záporný polomer');
    return new FalosnyPrechod();
  }
  createPattern(img) { if (!img) throw new TypeError('createPattern bez obrázka'); return {}; }
  createImageData(w, h) { cislo('createImageData', w, h); return { width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) }; }
  getImageData(x, y, w, h) { cislo('getImageData', x, y, w, h); return { width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) }; }
  putImageData() {}
  // text
  measureText(text) {
    const { px, width } = zmeraj(text, this.s.font);
    return { width, actualBoundingBoxAscent: px * 0.72, actualBoundingBoxDescent: px * 0.02, actualBoundingBoxLeft: 0, actualBoundingBoxRight: width, fontBoundingBoxAscent: px * 0.9, fontBoundingBoxDescent: px * 0.25 };
  }
  _text(text, x, y, maxW) {
    cislo('fillText', x, y);
    if (maxW !== undefined) cislo('fillText maxWidth', maxW);
    const { px, width } = zmeraj(text, this.s.font);
    let w = width;
    if (maxW !== undefined && w > maxW) w = maxW;
    const al = this.s.textAlign, bl = this.s.textBaseline;
    const x0 = al === 'center' ? x - w / 2 : al === 'right' || al === 'end' ? x - w : x;
    const y0 = bl === 'top' || bl === 'hanging' ? y : bl === 'middle' ? y - px * 0.5 : bl === 'alphabetic' ? y - px * 0.78 : y - px;
    const rohy = [this._bod(x0, y0), this._bod(x0 + w, y0), this._bod(x0, y0 + px), this._bod(x0 + w, y0 + px)];
    const xs = rohy.map((p) => p[0]), ys = rohy.map((p) => p[1]);
    const r = this._orez({ t: String(text), x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), px: px * this._mierka() });
    if (r) this.canvas.texty.push(r);
    this.volania++;
  }
  fillText(t, x, y, m) { this._text(t, x, y, m); }
  strokeText(t, x, y, m) { this._text(t, x, y, m); }
  drawImage(img, ...a) {
    for (const v of a) cislo('drawImage', v);
    if (!img) throw new TypeError('drawImage bez obrázka');
    if (img instanceof FalosnePlatno && (img.width === 0 || img.height === 0)) throw new Error('InvalidStateError: plátno 0 px');
    let sx = 0, sy = 0, sw = img.width, sh = img.height, dx, dy, dw, dh;
    if (a.length === 2) { [dx, dy] = a; dw = sw; dh = sh; }
    else if (a.length === 4) { [dx, dy, dw, dh] = a; }
    else if (a.length === 8) { [sx, sy, sw, sh, dx, dy, dw, dh] = a; }
    else throw new TypeError('drawImage: zlý počet argumentov ' + a.length);
    this.volania++;
    const kx = dw / sw, ky = dh / sh, m = this._mierka();
    if (img.palec) {
      const p = img.palec, map = ([x, y]) => this._bod(dx + (x - sx) * kx, dy + (y - sy) * ky);
      (this.canvas.palce || (this.canvas.palce = [])).push({ a: map(p.hrot), b: map(p.koniec), r: p.pol * Math.sqrt(Math.abs(kx * ky)) * m });
    }
    if (!(img instanceof FalosnePlatno) || !img.texty.length) return;
    for (const r of img.texty) {
      // text orezaný zdrojovým obdĺžnikom (čo je mimo spritu, sa nenakreslí)
      const ax = Math.max(r.x0, sx), bx = Math.min(r.x1, sx + sw), ay = Math.max(r.y0, sy), by = Math.min(r.y1, sy + sh);
      if (bx <= ax || by <= ay) continue;
      const p = [[ax, ay], [bx, ay], [ax, by], [bx, by]].map(([x, y]) => this._bod(dx + (x - sx) * kx, dy + (y - sy) * ky));
      const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]);
      const z = this._orez({ t: r.t, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), px: r.px * Math.sqrt(Math.abs(kx * ky)) * m });
      if (z) this.canvas.texty.push(z);
    }
  }
}
for (const k of NUM_VLASTNOSTI) {
  Object.defineProperty(FalosnyKontext.prototype, k, {
    get() { return this.num[k]; },
    set(v) { if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`${k} = ${v}`); this.num[k] = v; },
  });
}

globalThis.document = {
  createElement: () => new FalosnePlatno(),
  fonts: { load: async () => [], add() {}, ready: Promise.resolve() },
};

// ---------- test ----------

const FORMATY = [[1080, 1920], [1920, 1080], [1080, 1080], [1080, 1350]];
const REZERVA = 0.5;
const { default: film, nastavZaver, ZAVERY } = await import('./film.js');
await film.pripravit({ render: true });

let spolu = 0, najmensie = Infinity, najkratsiCiel = Infinity;
function over(W, H, casy, meno) {
  const Z = zona(W, H), mp = minPismo(W, H);
  const env = { render: true, slabe: false, dpr: 1, W, H };
  film.vrstvy(W, H, 1, env);
  const hlavne = new FalosnePlatno(W, H);
  const ctx = hlavne.getContext('2d');
  let n = 0, min = Infinity, zle = 0;
  const behy = new Map(); // cieľ -> { beh, najviac } počet snímok za sebou, keď ho palec nezakrýva
  const vzdialenostOdOsi = (p, qx, qy) => {
    const vx = p.b[0] - p.a[0], vy = p.b[1] - p.a[1], l2 = vx * vx + vy * vy || 1;
    const u = Math.max(0, Math.min(1, ((qx - p.a[0]) * vx + (qy - p.a[1]) * vy) / l2));
    return Math.hypot(p.a[0] + u * vx - qx, p.a[1] + u * vy - qy);
  };
  const jeHlaska = (s) => s.trim().length > 1 && [...film.kontrola.hlasky].some((h) => h.includes(s.trim()));
  for (const t of casy) {
    hlavne.texty = []; hlavne.palce = [];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    try { film.kresli(ctx, t, W, H, env); } catch (e) { chyby.push(`${meno} ${W}x${H} t=${t.toFixed(3)}: ${e.message}`); if (++zle > 3) break; continue; }
    if (ctx.zasobnik.length) { chyby.push(`${meno} ${W}x${H} t=${t.toFixed(3)}: save bez restore (${ctx.zasobnik.length})`); ctx.zasobnik.length = 0; }
    // hláška: palec ju nesmie zakryť a ona nesmie ležať na rozhodujúcom cieli (prstenec, krížik)
    const ciele = film.kontrola.ciele(t);
    for (const r of hlavne.texty) {
      if (!jeHlaska(r.t)) continue;
      for (const p of hlavne.palce) {
        let d = Infinity;
        for (let k = 0; k <= 40; k++) {
          const qx = p.a[0] + ((p.b[0] - p.a[0]) * k) / 40, qy = p.a[1] + ((p.b[1] - p.a[1]) * k) / 40;
          d = Math.min(d, Math.hypot(Math.max(r.x0 - qx, 0, qx - r.x1), Math.max(r.y0 - qy, 0, qy - r.y1)));
        }
        if (d < p.r) { chyby.push(`${meno} ${W}x${H} t=${t.toFixed(3)}: palec zakrýva hlášku „${r.t}“`); if (++zle > 12) break; }
      }
      for (const c of ciele) {
        if (r.x1 > c.x - c.r && r.x0 < c.x + c.r && r.y1 > c.y - c.r && r.y0 < c.y + c.r) { chyby.push(`${meno} ${W}x${H} t=${t.toFixed(3)}: hláška „${r.t}“ leží na cieli ${c.meno}`); if (++zle > 12) break; }
      }
    }
    // rozhodujúci cieľ: zakrytý, ak os palca prejde bližšie ako polomer palca plus polomer cieľa
    for (const c of ciele) {
      const kryty = hlavne.palce.some((p) => vzdialenostOdOsi(p, c.x, c.y) < p.r + c.r);
      if (process.env.LADENIE && `${W}x${H} ${c.meno}` === process.env.LADENIE) console.log(t.toFixed(3), kryty, hlavne.palce.map((p) => `${vzdialenostOdOsi(p, c.x, c.y).toFixed(0)}<${(p.r + c.r).toFixed(0)}`).join(' '));
      const b = behy.get(c.meno) || { beh: 0, najviac: 0 };
      b.beh = kryty ? 0 : b.beh + 1; b.najviac = Math.max(b.najviac, b.beh);
      behy.set(c.meno, b);
    }
    // palec (os s polomerom) nesmie prekryť text mimo telefónu: titulky, názov, záver
    const tel = film.kontrola.telefon(t);
    for (const r of hlavne.texty) {
      const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2;
      if (cx > tel.x && cx < tel.x + tel.w && cy > tel.y && cy < tel.y + tel.h) continue;
      for (const p of hlavne.palce) {
        let d = Infinity;
        for (let k = 0; k <= 40; k++) {
          const qx = p.a[0] + ((p.b[0] - p.a[0]) * k) / 40, qy = p.a[1] + ((p.b[1] - p.a[1]) * k) / 40;
          const ex = Math.max(r.x0 - qx, 0, qx - r.x1), ey = Math.max(r.y0 - qy, 0, qy - r.y1);
          d = Math.min(d, Math.hypot(ex, ey));
        }
        if (d < p.r) { chyby.push(`${meno} ${W}x${H} t=${t.toFixed(3)}: palec prekrýva text „${r.t}“`); if (++zle > 12) break; }
      }
    }
    for (const r of hlavne.texty) {
      n++;
      if (r.px < min) min = r.px;
      if (r.px < mp - 0.01) { chyby.push(`${meno} ${W}x${H} t=${t.toFixed(3)}: písmo ${r.px.toFixed(1)} px < ${mp} px: „${r.t}“`); if (++zle > 12) break; }
      if (r.x0 < Z.x0 - REZERVA || r.x1 > Z.x1 + REZERVA || r.y0 < Z.y0 - REZERVA || r.y1 > Z.y1 + REZERVA) {
        chyby.push(`${meno} ${W}x${H} t=${t.toFixed(3)}: text mimo zóny „${r.t}“ [${r.x0.toFixed(0)}, ${r.y0.toFixed(0)}, ${r.x1.toFixed(0)}, ${r.y1.toFixed(0)}] zóna [${Z.x0.toFixed(0)}, ${Z.y0.toFixed(0)}, ${Z.x1.toFixed(0)}, ${Z.y1.toFixed(0)}]`);
        if (++zle > 12) break;
      }
    }
    if (zle > 12) break;
  }
  // krížik a prstenec celé vidno aspoň 0,6 s v kuse (len pri plnom behu, nie pri kontrole záveru)
  if (casy[0] === 0 && zle <= 12) for (const [c, b] of behy) {
    najkratsiCiel = Math.min(najkratsiCiel, b.najviac / 30);
    if (b.najviac / 30 < 0.6 - 1e-9) chyby.push(`${meno} ${W}x${H}: ${c} je celý vidno len ${(b.najviac / 30).toFixed(2)} s v kuse (treba 0,6 s)`);
  }
  // odkazy nad plátnom: celé na plátne a v zóne
  for (const o of film.odkazy(W, H)) {
    cislo('odkaz', o.x, o.y, o.w, o.h);
    if (o.x < Z.x0 - 1 || o.x + o.w > Z.x1 + 1 || o.y < Z.y0 - 1 || o.y + o.h > Z.y1 + 1) chyby.push(`${meno} ${W}x${H}: odkaz mimo zóny ${JSON.stringify(o)}`);
  }
  const sp = film.stredPlagatu(W, H);
  cislo('stredPlagatu', ...sp);
  spolu += n; if (min < najmensie) najmensie = min;
  return { n, min };
}

const krok = 1 / 30;
const vsetky = [];
for (let i = 0; i <= Math.round(film.dlzka / krok); i++) vsetky.push(Math.min(film.dlzka, i * krok));
const zaver = vsetky.filter((t) => t >= film.dlzka - 4.5);

for (const [W, H] of FORMATY) {
  const a = over(W, H, vsetky, 'coming-soon');
  console.log(`${W}x${H} ${format(W, H).druh}: ${vsetky.length} snímok, ${a.n} textov, najmenšie písmo ${a.min.toFixed(1)} px (minimum ${minPismo(W, H)})`);
  if (process.argv.includes('--rozlozenie')) console.log('  ' + JSON.stringify(film.kontrola.rozlozenie()));
}
for (const m of ZAVERY.filter((z) => z !== 'coming-soon')) {
  nastavZaver(m);
  for (const [W, H] of FORMATY) over(W, H, zaver, m);
}
nastavZaver('coming-soon');

// partitúra
const ZNAME = new Set(['zvon', 'pad', 'sum', 'praskot', 'tuk', 'glis', 'appka']);
for (const u of film.zvuk) {
  if (!Number.isFinite(u.t) || u.t < 0 || u.t > film.dlzka) chyby.push(`zvuk: čas ${u.t} mimo [0, ${film.dlzka}]`);
  if (!ZNAME.has(u.typ)) chyby.push(`zvuk: neznámy nástroj ${u.typ}`);
  for (const [k, v] of Object.entries(u)) if (typeof v === 'number' && !Number.isFinite(v)) chyby.push(`zvuk: ${k} = ${v}`);
}
// titulky filmu (to, čo sa číta na obraze): čas čítania
for (const c of film.kontrola.titulky) {
  const slova = c.text.split(/\s+/).filter(Boolean).length;
  const treba = slova / 3 + 0.5;
  if (c.do - c.od < treba - 1e-6) chyby.push(`titulok „${c.text}“ trvá ${(c.do - c.od).toFixed(2)} s, treba ${treba.toFixed(2)} s`);
}
// titulky pre čítačky: po sebe
let pred = -1;
for (const x of film.titulky) { if (x.od < pred) chyby.push(`titulky pre čítačky nie sú po sebe (${x.od})`); pred = x.od; }
// texty bez pomlčiek (em a en)
const vsetkyTexty = [...film.titulky.map((x) => x.text), ...film.kontrola.titulky.map((x) => x.text), ...film.kontrola.texty];
const POMLCKY = new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']'); // en a em pomlčka
for (const s of vsetkyTexty) if (POMLCKY.test(s)) chyby.push(`pomlčka v texte: „${s}“`);
// vlastné kontroly filmu (fakty z appky)
for (const e of film.kontrola.fakty()) chyby.push(e);

if (chyby.length) {
  console.error(`\nZLYHALO: ${chyby.length} chýb`);
  for (const e of chyby.slice(0, 40)) console.error(' - ' + e);
  process.exit(1);
}
console.log(`\nOK: ${FORMATY.length} formáty x ${vsetky.length} snímok (+ ${ZAVERY.length - 1} ďalšie závery), ${spolu} textov, najmenšie písmo ${najmensie.toFixed(1)} px, ${film.zvuk.length} zvukov, prstenec a krížik celé vidno najmenej ${najkratsiCiel.toFixed(2)} s v kuse, hlášky bez palca a mimo cieľov`);
