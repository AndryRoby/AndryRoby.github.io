// Test filmu Advent Puzzle Calendar 2026 bez prehliadača:
//   node test.mjs   (v priečinku products/arling-sk/puzzle-books/advent-puzzle-calendar/film)
//
// Falošné 2D plátno (podľa shop/pumpkin-escape-kids/film/test.mjs) zaznamená každé volanie. Film sa
// nakreslí pre časy 0 až koniec po 1/30 s vo všetkých štyroch formátoch a test overí:
//   1. žiadna výnimka (záporný polomer, zlý offset prechodu, save bez restore),
//   2. žiadne NaN ani nekonečno v súradniciach, rozmeroch a číselných vlastnostiach,
//   3. každý text (fillText aj text zapečený v sprite a zložený cez drawImage, s ohľadom na clip) leží
//      celý v zóne zona(W, H), s rezervou 0,5 px,
//   4. najmenšie písmo po všetkých transformáciách je aspoň minPismo(W, H) (36 px pri 1080),
//   5. texty sa neprekrývajú a žiadny nie je napoly zamaskovaný,
//   6. slučka: posledná snímka skladá tie isté obrázky na tie isté miesta ako snímka 0 (do 1 px),
//      v každej štvrťsekunde je na obraze list PDF, list sa pred obnovou otočí zo zadnej strany na prednú,
//      plagát (film.plagat) má list s mriežkou, zadaniami a zvončekom, názov, štítok PRINTABLE PDF, ponuku a adresu,
//      štítok, ponuka a adresa majú plný kontrast (alfa 0,99) aspoň max(3 s, slová / 3 + 0,5 s) od snímky 0
//      aj do poslednej snímky (krok 1/60 s),
//   7. partitúra: čas v [0, dĺžka], známy nástroj, zvuk od snímky 0,
//   8. titulky: čas čítania aspoň slová / 3 + 0,5 s, nadväzujú, nie sú na obraze s hákom ani záverom, bez pomlčiek,
//   9. riešenie: riadkový riešič filmu vyrieši zadanie 1. decembra úplne (bez hádania) a zhodne so
//      zadania.json; kroky idú po sebe v okne riešenia,
//  10. fakty sedia so zdrojmi (zadania.json, texty.mjs, etsy.json, ponuka.json, zasobnik-q4.mjs),
//  11. stránka filmu index.html: fakty, žiadna pomlčka em a en, žiadna naliehavosť ani nepodložené tvrdenie.
//
// Čo test NEOVERUJE (kontrolné snímky s --zony, robí Fable): prekryv textu s kresbou a skutočnú šírku
// písma (šírka je tu odhad okolo 0,55 em na znak).

import { readFileSync } from 'node:fs';
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
const pxPisma = (font) => { const m = /(\d+(?:\.\d+)?)px/.exec(font || ''); return m ? Number(m[1]) : 10; };
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

const PLATNA = [];
let skupiny = 0;
class FalosnePlatno {
  constructor(w = 300, h = 150) { this.width = w; this.height = h; this.texty = []; this._ctx = null; PLATNA.push(this); }
  getContext() { return this._ctx || (this._ctx = new FalosnyKontext(this)); }
}
const NUM_VLASTNOSTI = ['lineWidth', 'globalAlpha', 'lineDashOffset', 'shadowBlur', 'shadowOffsetX', 'shadowOffsetY', 'miterLimit'];

class FalosnyKontext {
  constructor(canvas) {
    this.canvas = canvas;
    this.cesta = null;
    this.s = { m: [1, 0, 0, 1, 0, 0], clip: null, font: '10px sans-serif', textAlign: 'start', textBaseline: 'alphabetic', fillStyle: '#000', strokeStyle: '#000', lineCap: 'butt', lineJoin: 'miter', globalCompositeOperation: 'source-over', letterSpacing: '0px' };
    this.num = { lineWidth: 1, globalAlpha: 1, lineDashOffset: 0, shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0, miterLimit: 10 };
    this.zasobnik = [];
    this.shadowColor = 'rgba(0,0,0,0)';
    this.imageSmoothingEnabled = true;
  }
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
  _pridaj(x, y) {
    const [px, py] = this._bod(x, y);
    const c = this.cesta || (this.cesta = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
    c.x0 = Math.min(c.x0, px); c.y0 = Math.min(c.y0, py); c.x1 = Math.max(c.x1, px); c.y1 = Math.max(c.y1, py);
  }
  beginPath() { this.cesta = null; } closePath() {}
  moveTo(x, y) { cislo('moveTo', x, y); this._pridaj(x, y); } lineTo(x, y) { cislo('lineTo', x, y); this._pridaj(x, y); }
  quadraticCurveTo(a, b, c, d) { cislo('quadraticCurveTo', a, b, c, d); this._pridaj(a, b); this._pridaj(c, d); }
  bezierCurveTo(a, b, c, d, e, f) { cislo('bezierCurveTo', a, b, c, d, e, f); this._pridaj(a, b); this._pridaj(c, d); this._pridaj(e, f); }
  arc(x, y, r, a0, a1) {
    cislo('arc', x, y, r, a0, a1); if (r < 0) throw new RangeError(`IndexSizeError: arc so záporným polomerom ${r}`); this._pridaj(x - r, y - r); this._pridaj(x + r, y + r);
    if (this.canvas.kresba) this.canvas.kresba.push({ typ: 'arc', r: r * this._mierka(), alfa: this.num.globalAlpha });
  }
  arcTo(x1, y1, x2, y2, r) { cislo('arcTo', x1, y1, x2, y2, r); if (r < 0) throw new RangeError(`IndexSizeError: arcTo so záporným polomerom ${r}`); this._pridaj(x1, y1); this._pridaj(x2, y2); }
  ellipse(x, y, rx, ry, rot, a0, a1) { cislo('ellipse', x, y, rx, ry, rot, a0, a1); if (rx < 0 || ry < 0) throw new RangeError('IndexSizeError: ellipse so záporným polomerom'); this._pridaj(x - rx, y - ry); this._pridaj(x + rx, y + ry); }
  rect(x, y, w, h) { cislo('rect', x, y, w, h); this._pridaj(x, y); this._pridaj(x + w, y + h); this._pridaj(x + w, y); this._pridaj(x, y + h); }
  roundRect(x, y, w, h, r = 0) { cislo('roundRect', x, y, w, h); for (const q of [].concat(r)) { cislo('roundRect r', q); if (q < 0) throw new RangeError('roundRect záporný polomer'); } this.rect(x, y, w, h); }
  fill() {} stroke() {}
  clip() {
    const c = this.cesta;
    if (!c) { this.s.clip = { x0: 0, y0: 0, x1: 0, y1: 0 }; return; }
    const o = this.s.clip;
    this.s.clip = o ? { x0: Math.max(o.x0, c.x0), y0: Math.max(o.y0, c.y0), x1: Math.min(o.x1, c.x1), y1: Math.min(o.y1, c.y1) } : { ...c };
  }
  _orez(r) {
    const c = this.s.clip;
    if (!c) return r;
    const q = { ...r, x0: Math.max(r.x0, c.x0), y0: Math.max(r.y0, c.y0), x1: Math.min(r.x1, c.x1), y1: Math.min(r.y1, c.y1) };
    if (q.x0 - r.x0 > 0.5 || r.x1 - q.x1 > 0.5 || q.y0 - r.y0 > 0.5 || r.y1 - q.y1 > 0.5) q.orezany = true;
    return q.x1 - q.x0 > 0.5 && q.y1 - q.y0 > 0.5 ? q : null;
  }
  fillRect(x, y, w, h) {
    cislo('fillRect', x, y, w, h);
    if (this.canvas.kresba) this.canvas.kresba.push({ typ: 'rect', farba: this.s.fillStyle, w: Math.abs(w) * this._mierka(), alfa: this.num.globalAlpha });
  }
  strokeRect(x, y, w, h) { cislo('strokeRect', x, y, w, h); }
  clearRect(x, y, w, h) { cislo('clearRect', x, y, w, h); }
  setLineDash(p) { for (const q of p) cislo('setLineDash', q); }
  getLineDash() { return []; }
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
    const r = this._orez({ t: String(text), x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), px: px * this._mierka(), skupina: ++skupiny });
    if (r) this.canvas.texty.push(r);
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
    if (this.canvas.zaznam) {
      const rohy = [[dx, dy], [dx + dw, dy], [dx, dy + dh], [dx + dw, dy + dh]].map(([x, y]) => this._bod(x, y));
      this.canvas.zaznam.push({ img, rohy, alfa: this.num.globalAlpha });
    }
    if (!(img instanceof FalosnePlatno) || !img.texty.length || img.bezKontroly) return;
    const kx = dw / sw, ky = dh / sh, m = this._mierka(), skupina = ++skupiny;
    for (const r of img.texty) {
      const ax = Math.max(r.x0, sx), bx = Math.min(r.x1, sx + sw), ay = Math.max(r.y0, sy), by = Math.min(r.y1, sy + sh);
      if (bx <= ax || by <= ay) continue;
      const p = [[ax, ay], [bx, ay], [ax, by], [bx, by]].map(([x, y]) => this._bod(dx + (x - sx) * kx, dy + (y - sy) * ky));
      const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]);
      const z = this._orez({ t: r.t, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), px: r.px * Math.sqrt(Math.abs(kx * ky)) * m, orezany: r.orezany, skupina, zdroj: img });
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
globalThis.document = { createElement: () => new FalosnePlatno(), fonts: { load: async () => [], add() {}, ready: Promise.resolve() } };

// ---------- kreslenie vo všetkých formátoch ----------

const FORMATY = [[1080, 1920], [1920, 1080], [1080, 1080], [1080, 1350]];
const REZERVA = 0.5;
const { default: film, FAKTY, riesNonogram } = await import('./film.js');
await film.pripravit({ render: true });

let spolu = 0, najmensie = Infinity;
const prekryv = (a, b) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 1 && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 1;

function over(W, H, casy) {
  const Z = zona(W, H), mp = minPismo(W, H);
  const env = { render: true, slabe: false, dpr: 1, W, H };
  PLATNA.length = 0;
  film.vrstvy(W, H, 1, env);
  for (const p of PLATNA) for (let i = 0; i < p.texty.length; i++) for (let j = i + 1; j < p.texty.length; j++) {
    if (p.texty[i].t === p.texty[j].t) continue;
    if (prekryv(p.texty[i], p.texty[j])) chyby.push(`${W}x${H} sprite: texty sa prekrývajú „${p.texty[i].t}“ a „${p.texty[j].t}“`);
  }
  const hlavne = new FalosnePlatno(W, H);
  const ctx = hlavne.getContext('2d');
  let n = 0, min = Infinity, zle = 0;
  const chyba = (s) => { chyby.push(`${W}x${H} ${s}`); zle++; };
  for (const t of casy) {
    hlavne.texty = [];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    try { film.kresli(ctx, t, W, H, env); } catch (e) { chyba(`t=${t.toFixed(3)}: ${e.message}`); if (zle > 12) break; continue; }
    if (ctx.zasobnik.length) { chyba(`t=${t.toFixed(3)}: save bez restore (${ctx.zasobnik.length})`); ctx.zasobnik.length = 0; }
    const T = hlavne.texty;
    for (const r of T) {
      n++;
      if (r.px < min) min = r.px;
      if (r.px < mp - 0.01) chyba(`t=${t.toFixed(3)}: písmo ${r.px.toFixed(1)} px < ${mp} px: „${r.t}“`);
      if (r.x0 < Z.x0 - REZERVA || r.x1 > Z.x1 + REZERVA || r.y0 < Z.y0 - REZERVA || r.y1 > Z.y1 + REZERVA) {
        chyba(`t=${t.toFixed(3)}: text mimo zóny „${r.t}“ [${r.x0.toFixed(0)}, ${r.y0.toFixed(0)}, ${r.x1.toFixed(0)}, ${r.y1.toFixed(0)}] zóna [${Z.x0.toFixed(0)}, ${Z.y0.toFixed(0)}, ${Z.x1.toFixed(0)}, ${Z.y1.toFixed(0)}]`);
      }
      if (r.orezany) chyba(`t=${t.toFixed(3)}: text „${r.t}“ je napoly zamaskovaný`);
    }
    for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) {
      if (T[i].skupina === T[j].skupina) continue;
      if (T[i].t === T[j].t && T[i].zdroj && T[i].zdroj === T[j].zdroj) continue;
      if (prekryv(T[i], T[j])) chyba(`t=${t.toFixed(3)}: texty sa prekrývajú „${T[i].t}“ a „${T[j].t}“`);
    }
    if (zle > 12) break;
  }
  for (const o of film.odkazy(W, H)) {
    cislo('odkaz', o.x, o.y, o.w, o.h);
    if (o.x < Z.x0 - 1 || o.x + o.w > Z.x1 + 1 || o.y < Z.y0 - 1 || o.y + o.h > Z.y1 + 1) chyby.push(`${W}x${H}: odkaz mimo zóny ${JSON.stringify(o)}`);
    if (o.href !== FAKTY.url) chyby.push(`${W}x${H}: odkaz nevedie na ponuku ${FAKTY.url}`);
  }
  // 1:1 a 4:5: výzva aspoň 10 % nad spodnou hranou (ops/video/kodfilm/README.md)
  if (format(W, H).druh === 'stvorec' || format(W, H).druh === 'portret') {
    for (const o of film.odkazy(W, H)) if (o.y + o.h > H * 0.9 + 1) chyby.push(`${W}x${H}: adresa obchodu nižšie ako 10 % nad spodkom`);
  }
  cislo('stredPlagatu', ...film.stredPlagatu(W, H));
  const zaznam = (t) => {
    hlavne.zaznam = []; hlavne.texty = []; ctx.setTransform(1, 0, 0, 1, 0, 0);
    film.kresli(ctx, t, W, H, env);
    const z = hlavne.zaznam; hlavne.zaznam = null; return z;
  };
  const TT = film.kontrola.T, SP = film.kontrola.sprity();
  // jeden list od začiatku do konca (nález brány 28. 9.): v každej snímke je nakreslený list PDF s alfou 1
  for (let t = 0; t <= film.dlzka; t += 0.25) {
    if (!zaznam(t).some((d) => SP.listy.includes(d.img) && d.alfa >= 0.99)) chyby.push(`${W}x${H} t=${t.toFixed(2)}: na obraze nie je list PDF`);
  }
  // otočenie späť: zadná strana (Hashi) sa otočí na prednú so zvončekom ešte pred obnovou mriežky
  const prvyList = (t) => zaznam(t).find((d) => SP.listy.includes(d.img));
  const pol = (TT.spatOd + TT.spatDo) / 2;
  if (prvyList(pol - 0.05)?.img !== SP.listy[2] || prvyList(pol + 0.05)?.img !== SP.listy[1]) chyby.push(`${W}x${H}: list sa neotočí zo zadnej strany na prednú`);
  // plagát (nález brány 28. 9.): snímka háku s listom (mriežka, zadania, zvonček), názvom, štítkom PRINTABLE PDF,
  // ponukou a adresou, všetko s alfou 1
  const zp = zaznam(film.plagat);
  for (const [meno, img] of [['list s mriežkou', SP.listy[0]], ['zadania', SP.zadania], ['hlavička listu', SP.hlavicka], ['zvonček', SP.zvon], ['názov', SP.nazov], ['štítok PRINTABLE PDF', SP.znacka], ['ponuka', SP.veta], ['adresa', SP.url]]) {
    if (!zp.some((d) => d.img === img && d.alfa >= 0.99)) chyby.push(`${W}x${H} plagát ${film.plagat} s: chýba ${meno} v plnom kontraste`);
  }
  // hranice scén (nález brány pokus 2, 12,1 s: desať kruhov Hashi naraz zmizlo): obsah listu 1/240 s pred
  // hranicou a po nej je ten istý. Obsah = ostrovy Hashi (kruhy aj zapečené v zadnej strane), čísla ostrovov,
  // červené bunky zvončeka (sprite alebo jednotlivé bunky), alfa mriežky, hlavičky a zadaní.
  const RZ = film.kontrola.rozlozenie(), cerv = film.kontrola.farbaBunky;
  const jednotiek = [...FAKTY.riesenie].filter((ch) => ch === '1').length;
  const obsahListu = (t) => {
    hlavne.kresba = [];
    const z = zaznam(t), kr = hlavne.kresba;
    hlavne.kresba = null;
    const alfa = (img) => Math.max(0, ...z.filter((d) => d.img === img).map((d) => d.alfa));
    const zadna = alfa(SP.listy[2]) >= 0.5 ? FAKTY.ostrovy.length : 0;
    return {
      ostrovy: kr.filter((k) => k.typ === 'arc' && k.alfa >= 0.5 && k.r >= RZ.ostrovR * 0.5).length + zadna,
      cisla: SP.cisla.filter((c) => alfa(c) >= 0.5).length,
      bunky: alfa(SP.zvon) >= 0.5 ? jednotiek : kr.filter((k) => k.typ === 'rect' && k.farba === cerv && k.alfa >= 0.5 && k.w >= RZ.list.c * 0.5).length,
      mriezka: alfa(SP.listy[0]), hlavicka: alfa(SP.hlavicka), zadania: alfa(SP.zadania),
    };
  };
  const hranice = ['resetOd', 'riesOd', 'hotovo', 'flipOd', 'flipDo', 'ostrovyOd', 'zadnyTextPrec', 'spatOd', 'spatDo', 'obnovaOd', 'nazov'];
  const TOLERANCIA = { ostrovy: 1, cisla: 1, bunky: 3, mriezka: 0.15, hlavicka: 0.15, zadania: 0.15 };
  for (const h of hranice) {
    const a = obsahListu(TT[h] - 1 / 240), b = obsahListu(TT[h] + 1 / 240);
    for (const [k, tol] of Object.entries(TOLERANCIA)) {
      if (Math.abs(a[k] - b[k]) > tol) chyby.push(`${W}x${H} hranica ${h} (${TT[h]} s): obsah listu skočí, ${k} ${+a[k].toFixed(2)} na ${+b[k].toFixed(2)}`);
    }
  }
  // odkaz nad pilulkou adresy (nález brány pokus 2): aktívny vždy, keď je pilulka v plnom kontraste (hák aj
  // záver), na plagáte a nikdy bez nakreslenej pilulky (okraj okna 0,05 s na nábeh a odchod)
  const CO = film.kontrola.casyOdkazu, aktivny = (t) => CO.some(([a, b]) => t >= a && t < b);
  for (const o of film.odkazy(W, H)) if (JSON.stringify(o.casy) !== JSON.stringify(CO)) chyby.push(`${W}x${H}: odkaz nemá okná casyOdkazu`);
  if (!aktivny(film.plagat)) chyby.push(`${W}x${H}: odkaz nie je aktívny na plagáte ${film.plagat} s`);
  for (let i = 0; i <= film.dlzka * 60; i++) {
    const t = i / 60, u = Math.max(0, ...zaznam(t).filter((d) => d.img === SP.url).map((d) => d.alfa));
    if (u >= 0.99 && !aktivny(t)) chyby.push(`${W}x${H} t=${t.toFixed(2)}: pilulka adresy je na obraze, odkaz neaktívny`);
    if (u === 0 && aktivny(t - 0.05) && aktivny(t) && aktivny(t + 0.05)) chyby.push(`${W}x${H} t=${t.toFixed(2)}: odkaz aktívny bez pilulky`);
  }
  // ponuka a adresa (nález brány 28. 9.): plný kontrast aspoň max(3 s, slová / 3 + 0,5 s) na začiatku (od snímky 0)
  // aj na konci (do poslednej snímky); štítok a ponuka sa čítajú spolu, preto slová oboch
  const P = film.kontrola.ponuka, slova = (s) => s.split(/\s+/).filter(Boolean).length;
  const trebaPonuka = Math.max(3, (slova(P.znacka) + slova(P.veta)) / 3 + 0.5), trebaAdresa = Math.max(3, slova(P.adresa) / 3 + 0.5);
  const sledovane = [['štítok PRINTABLE PDF', SP.znacka, trebaPonuka], ['ponuka', SP.veta, trebaPonuka], ['adresa', SP.url, trebaAdresa]];
  const kp = 1 / 60, plne = (z, img) => z.some((d) => d.img === img && d.alfa >= 0.99);
  const zaciatok = sledovane.map(() => null), koniec = sledovane.map(() => null);
  for (let t = 0; t <= 4.5 && zaciatok.includes(null); t += kp) {
    const z = zaznam(t);
    sledovane.forEach(([, img], i) => { if (zaciatok[i] === null && !plne(z, img)) zaciatok[i] = t; });
  }
  for (let t = film.dlzka; t >= film.dlzka - 6 && koniec.includes(null); t -= kp) {
    const z = zaznam(t);
    sledovane.forEach(([, img], i) => { if (koniec[i] === null && !plne(z, img)) koniec[i] = film.dlzka - t; });
  }
  const casyPonuky = [];
  sledovane.forEach(([meno, , treba], i) => {
    const a = zaciatok[i] ?? 4.5, b = koniec[i] ?? 6;
    casyPonuky.push(`${meno} ${a.toFixed(2)} a ${b.toFixed(2)} s`);
    if (a < treba - kp) chyby.push(`${W}x${H}: ${meno} má na začiatku plný kontrast ${a.toFixed(2)} s, treba ${treba.toFixed(2)} s`);
    if (b < treba - kp) chyby.push(`${W}x${H}: ${meno} má na konci plný kontrast ${b.toFixed(2)} s, treba ${treba.toFixed(2)} s`);
  });
  const z0 = zaznam(0), z1 = zaznam(film.dlzka);
  if (z0.length !== z1.length) chyby.push(`${W}x${H} slučka: snímka 0 skladá ${z0.length} obrázkov, posledná ${z1.length}`);
  else z0.forEach((a, i) => {
    const b = z1[i];
    const dp = Math.max(...a.rohy.map((p, j) => Math.hypot(p[0] - b.rohy[j][0], p[1] - b.rohy[j][1])));
    if (a.img !== b.img || dp > 1 || Math.abs(a.alfa - b.alfa) > 0.01) chyby.push(`${W}x${H} slučka: obrázok ${i} sa na poslednej snímke líši (posun ${dp.toFixed(2)} px, alfa ${a.alfa.toFixed(2)} a ${b.alfa.toFixed(2)}${a.img !== b.img ? ', iný obrázok' : ''})`);
  });
  spolu += n; if (min < najmensie) najmensie = min;
  return { n, min, casyPonuky };
}

const krok = 1 / 30;
const vsetky = [];
for (let i = 0; i <= Math.round(film.dlzka / krok); i++) vsetky.push(Math.min(film.dlzka, i * krok));
for (const [W, H] of FORMATY) {
  const a = over(W, H, vsetky);
  console.log(`${W}x${H} ${format(W, H).druh}: ${vsetky.length} snímok, ${a.n} textov, najmenšie písmo ${a.min.toFixed(1)} px (minimum ${minPismo(W, H)}); plný kontrast na začiatku a na konci: ${a.casyPonuky.join(', ')}`);
  if (process.argv.includes('--rozlozenie')) console.log('  ' + JSON.stringify(film.kontrola.rozlozenie()));
}

// ---------- partitúra a titulky ----------

if (film.dlzka < 15 || film.dlzka > 20) chyby.push(`dĺžka ${film.dlzka} s mimo 15 až 20 s (zadanie filmu)`);
const ZNAME = new Set(['zvon', 'pad', 'sum', 'praskot', 'tuk', 'glis']);
for (const u of film.zvuk) {
  if (!Number.isFinite(u.t) || u.t < 0 || u.t > film.dlzka) chyby.push(`zvuk: čas ${u.t} mimo [0, ${film.dlzka}]`);
  if (!ZNAME.has(u.typ)) chyby.push(`zvuk: neznámy nástroj ${u.typ}`);
  for (const [k, v] of Object.entries(u)) if (typeof v === 'number' && !Number.isFinite(v)) chyby.push(`zvuk: ${k} = ${v}`);
}
if (!film.zvuk.some((u) => u.t === 0)) chyby.push('zvuk: nič nehrá od snímky 0');
const tit = film.kontrola.titulky;
const TK = film.kontrola.T, { nabeh: TN, dobeh: TD } = film.kontrola.titObalka;
tit.forEach((c, i) => {
  const slova = c.text.split(/\s+/).filter(Boolean).length, treba = slova / 3 + 0.5;
  // plný kontrast = trvanie bez nábehu a odchodu
  const plny = c.do - c.od - TN - TD;
  if (plny < treba - 1e-6) chyby.push(`titulok „${c.text}“ má plný kontrast ${plny.toFixed(2)} s, treba ${treba.toFixed(2)} s`);
  if (i && Math.abs(tit[i - 1].do - c.od) > 1e-9) chyby.push(`titulky nenadväzujú pri ${c.od} s`);
});
// titulky sú v páse názvu háku a záveru: prvý až po odchode háku, posledný pred príchodom záveru
if (tit[0].od < 3.55) chyby.push(`prvý titulok (${tit[0].od} s) príde skôr, ako odíde hák (3,55 s)`);
if (tit[tit.length - 1].do > TK.nazov + 1e-9) chyby.push(`posledný titulok (${tit[tit.length - 1].do} s) je na obraze ešte v závere (${TK.nazov} s)`);
let pred = -1;
for (const x of film.titulky) { if (x.od < pred) chyby.push(`titulky pre čítačky nie sú po sebe (${x.od})`); pred = x.od; }
const vsetkyTexty = [...film.titulky.map((x) => x.text), ...film.kontrola.texty];
const POMLCKY = new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']');
for (const s of vsetkyTexty) {
  if (POMLCKY.test(s)) chyby.push(`pomlčka v texte: „${s}“`);
  if (/\b(best|#1|only today|hurry|last chance|buy now|bestseller|limited)\b/i.test(s)) chyby.push(`nepodložené alebo naliehavé tvrdenie: „${s}“`);
}

// produkt je PDF s listami (nie kalendár s dvierkami): štítok PRINTABLE PDF v háku a závere, nikde dvierka
if (film.kontrola.ponuka.znacka !== 'PRINTABLE PDF' || !film.kontrola.texty.includes('PRINTABLE PDF')) chyby.push('hák nemá štítok „PRINTABLE PDF“');
if (!film.kontrola.texty.includes('24 days, 48 logic puzzles')) chyby.push('hák nemá ponuku „24 days, 48 logic puzzles“');
for (const s of [...film.kontrola.texty, ...film.titulky.map((x) => x.text)]) if (/\bdoors?\b/i.test(s)) chyby.push(`text „${s}“ opisuje dvierka, produkt je PDF`);

// ---------- riešenie Nonogramu ----------

const KOREN = new URL('../../../../../', import.meta.url);
const Z = JSON.parse(readFileSync(new URL('products/hlavolamy-advent/zadania.json', KOREN), 'utf8'));
const d1 = Z.dni[0];
const rovne = (a, b, co) => { if (JSON.stringify(a) !== JSON.stringify(b)) chyby.push(`fakt ${co}: film ${JSON.stringify(a)}, zdroj ${JSON.stringify(b)}`); };
const kroky = film.kontrola.kroky;
const g = Array(100).fill(-1);
let posledny = -Infinity;
for (const k of kroky) {
  if (!k.nove.length) chyby.push('riešenie: krok bez novej bunky');
  if (k.od < posledny - 1e-9 || k.do <= k.od) chyby.push(`riešenie: kroky nejdú po sebe (${k.od})`);
  posledny = k.do;
  if (k.od < film.kontrola.T.riesOd - 1e-9 || k.do > film.kontrola.T.hotovo + 1e-9) chyby.push(`riešenie: krok mimo okna riešenia (${k.od} až ${k.do})`);
  for (const b of k.nove) { if (g[b.j] !== -1) chyby.push(`riešenie: bunka ${b.j} zistená dvakrát`); g[b.j] = b.v; }
}
if (g.includes(-1)) chyby.push('riešenie: riadkový riešič nevyriešil všetky bunky (film by hádal)');
rovne(g.join(''), d1.nonogram.solution.join(''), 'riešenie 1. decembra (zadania.json dni[0].nonogram.solution)');
rovne(riesNonogram(d1.nonogram.clues.rows, d1.nonogram.clues.cols).g.join(''), d1.nonogram.solution.join(''), 'riešič nad zadaním zo zadania.json');

// ---------- fakty so zdrojmi ----------

rovne(FAKTY.riadky, d1.nonogram.clues.rows, 'zadania riadkov (zadania.json)');
rovne(FAKTY.stlpce, d1.nonogram.clues.cols, 'zadania stĺpcov (zadania.json)');
rovne(FAKTY.riesenie, d1.nonogram.solution.join(''), 'riešenie (zadania.json)');
rovne(FAKTY.meno, d1.nonogram.meno, 'meno obrázka 1. decembra');
rovne(FAKTY.n, d1.nonogram.n, 'rozmer Nonogramu 1. decembra');
rovne(FAKTY.den, d1.den, 'deň');
rovne(d1.druhy.hra, 'cranes', 'zadná strana 1. decembra je Hashi (cranes)');
rovne(FAKTY.hashiN, d1.druhy.p.n, 'rozmer Hashi');
rovne(FAKTY.ostrovy, d1.druhy.p.islands, 'ostrovy Hashi (zadania.json dni[0].druhy.p.islands)');
rovne(FAKTY.dni, Z.dni.length, 'počet dní');
rovne(FAKTY.hlavolamov, Z.dni.filter((d) => d.nonogram && d.druhy).length * 2, 'počet hlavolamov (Nonogram + druhý na deň)');
rovne(Z.dni.filter((d) => d.nonogram.n === 10).map((d) => d.den), Array.from({ length: FAKTY.malychDni }, (_, i) => i + 1), 'Nonogramy 10 x 10 v dňoch 1 až 8');
if (Z.dni.some((d) => d.den > FAKTY.malychDni && d.nonogram.n !== 15)) chyby.push('fakt: dni 9 až 24 nemajú Nonogram 15 x 15');
const { TEXTY } = await import(new URL('products/hlavolamy-advent/texty.mjs', KOREN).href);
if (!TEXTY.en.podtitul.startsWith('24 days, 48 logic puzzles')) chyby.push('fakt: texty.mjs podtitul nezačína „24 days, 48 logic puzzles“');
rovne(TEXTY.en.druhy.slice(1), FAKTY.zadne, 'druhy na zadnej strane (texty.mjs druhy)');
if (!TEXTY.en.uvod.some((x) => /line by line, without guessing/.test(x))) chyby.push('fakt: „line by line, without guessing“ nie je v texty.mjs');
if (!TEXTY.en.druhy[0].includes('Nonogram')) chyby.push('fakt: predná strana nie je Nonogram');
const en = JSON.parse(readFileSync(new URL('products/hlavolamy-advent/etsy/en/etsy.json', KOREN), 'utf8'));
const de = JSON.parse(readFileSync(new URL('products/hlavolamy-advent/etsy/de/etsy.json', KOREN), 'utf8'));
rovne(FAKTY.ponukaEn, en.listing_id, 'ponuka EN (etsy/en/etsy.json)');
rovne(FAKTY.ponukaDe, de.listing_id, 'ponuka DE (etsy/de/etsy.json)');
rovne(FAKTY.url, en.url, 'adresa ponuky EN');
const ponuka = JSON.parse(readFileSync(new URL('products/hlavolamy-advent/etsy/en/ponuka.json', KOREN), 'utf8'));
rovne(FAKTY.cena, ponuka.price.listing_eur.toFixed(2), 'cena (etsy/en/ponuka.json)');
if (!/63 pages/.test(ponuka.description)) chyby.push('fakt: ponuka.json neuvádza 63 strán');
const zas = readFileSync(new URL('ops/social/zasobnik-q4.mjs', KOREN), 'utf8');
const obchod = /ETSY_OBCHOD\s*=\s*'https:\/\/([^/']+)\/?'/.exec(zas);
rovne(FAKTY.obchod, obchod && obchod[1], 'obchod na Etsy (ops/social/zasobnik-q4.mjs ETSY_OBCHOD)');
// film ukazuje riešenie len jedného dňa
const src = readFileSync(new URL('./film.js', import.meta.url), 'utf8');
for (const d of Z.dni.slice(1)) if (src.includes(d.nonogram.solution.join(''))) chyby.push(`spoiler: film obsahuje riešenie dňa ${d.den}`);

// ---------- stránka filmu (index.html) ----------

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const textStranky = html
  .replace(/<header[\s\S]*?<\/header>/, ' ').replace(/<footer[\s\S]*?<\/footer>/, ' ').replace(/<aside[\s\S]*?<\/aside>/, ' ')
  .replace(/<script(?![^>]*ld\+json)[\s\S]*?<\/script>/g, ' ')
  .replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ');
const metaTexty = [...html.matchAll(/<meta (?:name|property)="(?:description|og:[a-z]+)" content="([^"]*)"/g)].map((m) => m[1]);
const stranka = [textStranky, ...metaTexty].join('\n');
for (const s of ['24 days', '48 logic puzzles', '48 puzzles', 'A4', 'US Letter', '63 pages', `${FAKTY.cena} €`, 'Hashi, Kakuro or Slitherlink', 'December 1 to 8', FAKTY.obchod, '20 seconds']) {
  if (!stranka.includes(s)) chyby.push(`index.html: chýba fakt „${s}“`);
}
if (!html.includes(FAKTY.url)) chyby.push('index.html: chýba odkaz na ponuku EN');
if (!html.includes(de.url)) chyby.push('index.html: chýba odkaz na ponuku DE');
if ([...stranka.matchAll(/\b(\d+(?:\.\d+)?)\s*(?:€|EUR|euros)/g)].some((m) => m[1] !== FAKTY.cena)) chyby.push('index.html: iná cena ako ' + FAKTY.cena);
if ([...stranka.matchAll(/\b(\d+)\s+pages\b/g)].some((m) => m[1] !== '63')) chyby.push('index.html: iný počet strán ako 63');
if (POMLCKY.test(stranka)) chyby.push('index.html: pomlčka em alebo en');
if (/\b(best|#1|only today|hurry|last chance|buy now|bestseller|limited|loved by)\b/i.test(stranka)) chyby.push('index.html: nepodložené alebo naliehavé tvrdenie');
if (!html.includes('https://arling.sk/puzzle-books/advent-puzzle-calendar/film/')) chyby.push('index.html: chýba canonical');
if (/og:image/.test(html)) chyby.push('index.html: og:image odkazuje na obrázok, ktorý ešte neexistuje');

if (chyby.length) {
  console.error(`\nZLYHALO: ${chyby.length} chýb`);
  for (const e of chyby.slice(0, 40)) console.error(' - ' + e);
  process.exit(1);
}
console.log(`\nOK: ${FORMATY.length} formáty x ${vsetky.length} snímok, ${spolu} textov, najmenšie písmo ${najmensie.toFixed(1)} px, ${film.zvuk.length} zvukov, ${kroky.length} krokov riešenia bez hádania, fakty sedia so zdrojmi`);
