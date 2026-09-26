// Test filmu The Pumpkin Fair Mix-Up bez prehliadača:
//   node test.mjs   (v priečinku products/arling-sk/shop/pumpkin-escape-kids/film)
//
// Falošné 2D plátno zaznamená každé volanie. Film sa nakreslí pre časy 0 až koniec po 1/30 s vo
// všetkých štyroch formátoch a test overí:
//   1. žiadna výnimka (záporný polomer v arc/ellipse a zlý offset prechodu vyhodia chybu ako v prehliadači),
//   2. žiadne NaN ani nekonečno v súradniciach, rozmeroch a číselných vlastnostiach,
//   3. každý text (fillText aj text zapečený v sprite a zložený cez drawImage, s ohľadom na clip) leží
//      celý v zóne zona(W, H), s rezervou 0,5 px,
//   4. najmenšie písmo po všetkých transformáciách je aspoň minPismo(W, H) (36 px pri 1080); kresby
//      z kresby.js nesmú obsahovať <text> (písmo vo vnútri SVG by test nevidel),
//   5. texty sa neprekrývajú (výnimka: ten istý riadok z toho istého spritu, napr. tieň pod názvom)
//      a žiadny nie je napoly zamaskovaný (clip),
//   6. partitúra: každá udalosť má konečný čas v [0, dĺžka] a známy nástroj,
//   7. titulky: čas čítania aspoň slová / 3 + 0,5 s, nadväzujú, texty bez pomlčiek em a en,
//   8. fakty sedia so zdrojmi sady (pripad.mjs, ops/stripe/sady.mjs, stránka sady),
//   9. žiadne spoilery ani zakázané slová: vo filme nie je žiadna odpoveď kariet 1 až 7 okrem cvičného
//      OWL, poradie kariet 2 až 7 nie je poradie sady a kresby.js neobsahuje kresby s odpoveďou,
//  10. slučka: posledná snímka skladá tie isté obrázky na tie isté miesta ako snímka 0 (do 1 px),
//  11. stránka filmu index.html: fakty (vek, hráči, 16 strán, A4 a US Letter, 6.90), žiadna odpoveď,
//      zakázané slovo, nepodložené tvrdenie ani pomlčka em a en.
//
// Čo test NEOVERUJE (spoľahnúť sa na kontrolné snímky s --zony, robí Fable):
//   - prekryv textu s kresbou (vozík, štítok, Olive a pod.): test pozná len obdĺžniky textov,
//   - skutočnú šírku písma: šírka je tu odhad (okolo 0,55 em na znak) a rozloženie filmu meria text
//     tou istou funkciou, takže kontrola šírky je kruhová; overuje len logiku rozloženia.

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
  arc(x, y, r, a0, a1) { cislo('arc', x, y, r, a0, a1); if (r < 0) throw new RangeError(`IndexSizeError: arc so záporným polomerom ${r}`); this._pridaj(x - r, y - r); this._pridaj(x + r, y + r); }
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
    // text, z ktorého maska odrezala kus, pôsobí napoly zakrytý
    if (q.x0 - r.x0 > 0.5 || r.x1 - q.x1 > 0.5 || q.y0 - r.y0 > 0.5 || r.y1 - q.y1 > 0.5) q.orezany = true;
    return q.x1 - q.x0 > 0.5 && q.y1 - q.y0 > 0.5 ? q : null;
  }
  fillRect(x, y, w, h) { cislo('fillRect', x, y, w, h); }
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
    // záznam skladania (test slučky): ktorý obrázok, kam (rohy po transformácii) a s akou alfou
    if (this.canvas.zaznam) {
      const rohy = [[dx, dy], [dx + dw, dy], [dx, dy + dh], [dx + dw, dy + dh]].map(([x, y]) => this._bod(x, y));
      this.canvas.zaznam.push({ img, rohy, alfa: this.num.globalAlpha });
    }
    // odlesk názvu je ten istý text ako názov (film ho označí), nepočíta sa druhý raz
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

globalThis.document = {
  createElement: () => new FalosnePlatno(),
  fonts: { load: async () => [], add() {}, ready: Promise.resolve() },
};
// SVG obrázky z kresby.js: rozmer z atribútov, onload hneď (v prehliadači ich načíta dekodér)
globalThis.Image = class {
  set src(v) {
    this._src = v;
    const s = decodeURIComponent(String(v).split(',').slice(1).join(','));
    const m = /<svg width="([\d.]+)" height="([\d.]+)"/.exec(s);
    if (!m) chyby.push('kresba bez rozmerov: ' + s.slice(0, 60));
    this.width = m ? Number(m[1]) : 1; this.height = m ? Number(m[2]) : 1;
    queueMicrotask(() => this.onload && this.onload());
  }
  get src() { return this._src; }
};

// ---------- test kreslenia ----------

const FORMATY = [[1080, 1920], [1920, 1080], [1080, 1080], [1080, 1350]];
const REZERVA = 0.5;
const { default: film, FAKTY } = await import('./film.js');
await film.pripravit({ render: true });

let spolu = 0, najmensie = Infinity;
function prekryv(a, b) {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  return w > 1 && h > 1;
}
function over(W, H, casy) {
  const Z = zona(W, H), mp = minPismo(W, H);
  const env = { render: true, slabe: false, dpr: 1, W, H };
  PLATNA.length = 0;
  film.vrstvy(W, H, 1, env);
  // texty v jednom sprite (bez otáčania) sa nesmú prekrývať ani tam
  for (const p of PLATNA) for (let i = 0; i < p.texty.length; i++) for (let j = i + 1; j < p.texty.length; j++) {
    if (p.texty[i].t === p.texty[j].t) continue; // tieň toho istého riadku pod ním
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
      if (T[i].skupina === T[j].skupina) continue; // riadky jedného spritu (tie overí kontrola spritov vyššie, v ich vlastných súradniciach)
      // ten istý riadok z toho istého spritu (napr. dve kópie jedného spritu naraz); rovnaké texty
      // z rôznych spritov („Fair Helper“ na odznaku a na certifikáte) sa kontrolujú
      if (T[i].t === T[j].t && T[i].zdroj && T[i].zdroj === T[j].zdroj) continue;
      if (prekryv(T[i], T[j])) chyba(`t=${t.toFixed(3)}: texty sa prekrývajú „${T[i].t}“ a „${T[j].t}“`);
    }
    if (zle > 12) break;
  }
  for (const o of film.odkazy(W, H)) {
    cislo('odkaz', o.x, o.y, o.w, o.h);
    if (o.x < Z.x0 - 1 || o.x + o.w > Z.x1 + 1 || o.y < Z.y0 - 1 || o.y + o.h > Z.y1 + 1) chyby.push(`${W}x${H}: odkaz mimo zóny ${JSON.stringify(o)}`);
  }
  cislo('stredPlagatu', ...film.stredPlagatu(W, H));
  // slučka: snímka 0 a posledná snímka skladajú tie isté obrázky na tie isté miesta (do 1 px, alfa do 0,01)
  const zaznam = (t) => {
    hlavne.zaznam = []; hlavne.texty = []; ctx.setTransform(1, 0, 0, 1, 0, 0);
    film.kresli(ctx, t, W, H, env);
    const z = hlavne.zaznam; hlavne.zaznam = null; return z;
  };
  const z0 = zaznam(0), z1 = zaznam(film.dlzka);
  if (z0.length !== z1.length) chyby.push(`${W}x${H} slučka: snímka 0 skladá ${z0.length} obrázkov, posledná ${z1.length}`);
  else z0.forEach((a, i) => {
    const b = z1[i];
    const dp = Math.max(...a.rohy.map((p, j) => Math.hypot(p[0] - b.rohy[j][0], p[1] - b.rohy[j][1])));
    if (a.img !== b.img || dp > 1 || Math.abs(a.alfa - b.alfa) > 0.01) chyby.push(`${W}x${H} slučka: obrázok ${i} sa na poslednej snímke líši (posun ${dp.toFixed(2)} px, alfa ${a.alfa.toFixed(2)} a ${b.alfa.toFixed(2)}${a.img !== b.img ? ', iný obrázok' : ''})`);
  });
  spolu += n; if (min < najmensie) najmensie = min;
  return { n, min };
}

const krok = 1 / 30;
const vsetky = [];
for (let i = 0; i <= Math.round(film.dlzka / krok); i++) vsetky.push(Math.min(film.dlzka, i * krok));

for (const [W, H] of FORMATY) {
  const a = over(W, H, vsetky);
  console.log(`${W}x${H} ${format(W, H).druh}: ${vsetky.length} snímok, ${a.n} textov, najmenšie písmo ${a.min.toFixed(1)} px (minimum ${minPismo(W, H)})`);
  if (process.argv.includes('--rozlozenie')) console.log('  ' + JSON.stringify(film.kontrola.rozlozenie()));
}

// ---------- partitúra a titulky ----------

if (film.dlzka < 18 || film.dlzka > 22) chyby.push(`dĺžka ${film.dlzka} s mimo 18 až 22 s`);
const ZNAME = new Set(['zvon', 'pad', 'sum', 'praskot', 'tuk', 'glis']);
for (const u of film.zvuk) {
  if (!Number.isFinite(u.t) || u.t < 0 || u.t > film.dlzka) chyby.push(`zvuk: čas ${u.t} mimo [0, ${film.dlzka}]`);
  if (!ZNAME.has(u.typ)) chyby.push(`zvuk: neznámy nástroj ${u.typ}`);
  for (const [k, v] of Object.entries(u)) if (typeof v === 'number' && !Number.isFinite(v)) chyby.push(`zvuk: ${k} = ${v}`);
}
if (!film.zvuk.some((u) => u.t === 0)) chyby.push('zvuk: nič nehrá od snímky 0');
const tit = film.kontrola.titulky;
tit.forEach((c, i) => {
  const slova = c.text.split(/\s+/).filter(Boolean).length;
  const treba = slova / 3 + 0.5;
  if (c.do - c.od < treba - 1e-6) chyby.push(`titulok „${c.text}“ trvá ${(c.do - c.od).toFixed(2)} s, treba ${treba.toFixed(2)} s`);
  if (i && Math.abs(tit[i - 1].do - c.od) > 1e-9) chyby.push(`titulky nenadväzujú pri ${c.od} s`);
});
let pred = -1;
for (const x of film.titulky) { if (x.od < pred) chyby.push(`titulky pre čítačky nie sú po sebe (${x.od})`); pred = x.od; }
const vsetkyTexty = [...film.titulky.map((x) => x.text), ...film.kontrola.texty];
const POMLCKY = new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']'); // en a em pomlčka
for (const s of vsetkyTexty) if (POMLCKY.test(s)) chyby.push(`pomlčka v texte: „${s}“`);

// ---------- fakty so zdrojmi ----------

const KOREN = new URL('../../../../../', import.meta.url);
const P = await import(new URL('ops/produkty/pumpkin-escape-kids/pripad.mjs', KOREN).href);
const rovne = (a, b, co) => { if (JSON.stringify(a) !== JSON.stringify(b)) chyby.push(`fakt ${co}: film ${JSON.stringify(a)}, zdroj ${JSON.stringify(b)}`); };
rovne(FAKTY.nazov, P.HRA.nazov, 'názov (pripad.mjs HRA.nazov)');
rovne(FAKTY.vek, P.HRA.vek, 'vek (pripad.mjs HRA.vek)');
rovne(FAKTY.hracov, P.HRA.hracov, 'hráči (pripad.mjs HRA.hracov)');
rovne(FAKTY.hier, P.ZAMKY.length, 'počet hier (pripad.mjs ZAMKY)');
rovne(FAKTY.cvik, P.CVIK, 'cvičné slovo (pripad.mjs CVIK)');
for (const [o, p] of FAKTY.kluc) rovne(P.KOD[p], o, `kľúč ${p} (pripad.mjs KOD)`);
rovne(FAKTY.cvikObrazky, [...P.CVIK].map((c) => P.KOD[c]), 'obrázky cvičného slova');
// karty 2 až 7: tá istá množina obrázkov ako v sade, ale nie v poradí sady (poradie je kľúč rodiča)
const poradie = P.ZAMKY.slice(1).map((z) => z.karta);
rovne([...FAKTY.karty.slice(1)].sort(), [...poradie].sort(), 'obrázky kariet 2 až 7 (pripad.mjs ZAMKY.karta)');
if (FAKTY.karty[0] !== 'nota') chyby.push('fakt: prvá karta vo filme má byť karta 1 (Olive’s coded note)');
for (let i = 1; i + 1 < FAKTY.karty.length; i++) {
  const a = poradie.indexOf(FAKTY.karty[i]), b = poradie.indexOf(FAKTY.karty[i + 1]);
  if (b === a + 1) chyby.push(`spoiler: karty ${FAKTY.karty[i]} a ${FAKTY.karty[i + 1]} idú vo filme za sebou ako v sade`);
}
if (!FAKTY.naklad.every((k) => poradie.includes(k))) chyby.push('fakt: náklad vozíka má len obrázky kariet sady');
for (let i = 0; i + 1 < FAKTY.naklad.length; i++) {
  if (poradie.indexOf(FAKTY.naklad[i + 1]) === poradie.indexOf(FAKTY.naklad[i]) + 1) chyby.push(`spoiler: náklad ${FAKTY.naklad[i]} a ${FAKTY.naklad[i + 1]} idú za sebou ako v sade`);
}
rovne(P.ZAMKY[0].karta, null, 'karta 1 leží na stole (bez pásu)');
rovne(FAKTY.otvorena, P.ZAMKY[0].otvori, 'karta, ktorú otvorí odpoveď karty 1');
if (!/Mrs Bramble/.test(P.ZAMKY[1].uvod) || FAKTY.postava !== 'bramble') chyby.push('fakt: na karte Acorn je Mrs Bramble (pripad.mjs ZAMKY[1].uvod)');
const sady = readFileSync(new URL('ops/stripe/sady.mjs', KOREN), 'utf8');
const suma = /'pumpkin-escape-kids':\s*sada\(\{[\s\S]*?suma:\s*(\d+)/.exec(sady);
if (!suma) chyby.push('fakt cena: pumpkin-escape-kids chýba v ops/stripe/sady.mjs');
else rovne(FAKTY.cena, (Number(suma[1]) / 100).toFixed(2), 'cena (ops/stripe/sady.mjs suma)');
const stranka = readFileSync(new URL('products/arling-sk/shop/pumpkin-escape-kids/index.html', KOREN), 'utf8');
for (const s of [FAKTY.cena, `Ages ${FAKTY.vek}`, `${FAKTY.hracov} players`, 'Halloween escape room for kids', '7 fair games in a chain', 'not spooky']) {
  if (!stranka.toLowerCase().includes(s.toLowerCase())) chyby.push(`fakt: stránka sady neobsahuje „${s}“`);
}
if (!P.KONIEC.some((k) => /certificate|thank-you/i.test(k)) && !/certificates/i.test(stranka)) chyby.push('fakt: certifikáty nie sú v sade');
if (!/badges/i.test(stranka)) chyby.push('fakt: odznaky nie sú na stránke sady');

// ---------- spoilery a zakázané slová ----------

const odpovede = P.ZAMKY.map((z) => z.odpoved);
for (const s of vsetkyTexty) {
  for (const o of odpovede) if (new RegExp(`\\b${o}\\b`, 'i').test(s)) chyby.push(`spoiler: odpoveď ${o} v texte „${s}“`);
  if (/\b(barn|basil|bee|bumblebee|wagons)\b/i.test(s)) chyby.push(`spoiler: „${s}“ napovedá koniec`);
  if (P.ZAKAZANE.test(s)) chyby.push(`zakázané slovo v texte „${s}“`);
  if (/\b(kids love|tested with|best|#1|only today|hurry|last chance|buy now)\b/i.test(s)) chyby.push(`nepodložené alebo naliehavé tvrdenie: „${s}“`);
}
const { KRESBY } = await import('./kresby.js');
const POVOLENE = new Set(['vozik', 'olive', 'juniper', 'bramble', 'tekvicaA', 'tekvicaB', 'lampionA', 'lampionB', 'lampionC',
  'acorn', 'leaf', 'pear', 'mitten', 'basket', 'pinecone', 'scarf', 'boot', 'feather',
  'kite', 'heart', 'cloud', 'hat', 'sun', 'bell', 'pecat', 'stuha', 'tekvicka']);
for (const k of Object.keys(KRESBY)) if (!POVOLENE.has(k)) chyby.push(`kresby.js: kresba ${k} nie je na zozname bez spoilerov`);
if (/data-list/.test(KRESBY.vozik.svg)) chyby.push('kresby.js: vozík nesie Big Marigold (listy sú odpoveď zámku)');
// písmo vo vnútri SVG by kontrola písma nevidela (drawImage obrázka nič nezaznamená), preto žiadne
for (const [k, v] of Object.entries(KRESBY)) if (/<text[\s>]/.test(v.svg)) chyby.push(`kresby.js: kresba ${k} obsahuje <text> (písmo pod 36 px, test ho nevidí)`);

// ---------- stránka filmu (index.html) ----------

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const textStranky = html
  .replace(/<header[\s\S]*?<\/header>/, ' ').replace(/<footer[\s\S]*?<\/footer>/, ' ').replace(/<aside[\s\S]*?<\/aside>/, ' ')
  .replace(/<script(?![^>]*ld\+json)[\s\S]*?<\/script>/g, ' ')
  .replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ');
const metaTexty = [...html.matchAll(/<meta (?:name|property)="(?:description|og:[a-z]+)" content="([^"]*)"/g)].map((m) => m[1]);
const strankaVsetko = [textStranky, ...metaTexty].join('\n');
for (const s of [`aged ${FAKTY.vek}`, `${FAKTY.hracov} players`, '16 pages', 'A4', 'US Letter', `${FAKTY.cena} €`]) {
  if (!strankaVsetko.includes(s)) chyby.push(`index.html: chýba fakt „${s}“`);
}
for (const m of strankaVsetko.matchAll(/\b(?:ages|aged)\s+(\d+ to \d+)/gi)) if (m[1] !== FAKTY.vek) chyby.push(`index.html: iný vek ${m[1]}`);
for (const m of strankaVsetko.matchAll(/\b(\d+ to \d+) players/g)) if (m[1] !== FAKTY.hracov) chyby.push(`index.html: iný počet hráčov ${m[1]}`);
if (/\b(\d+)\s+pages\b/.test(strankaVsetko) && [...strankaVsetko.matchAll(/\b(\d+)\s+pages\b/g)].some((m) => m[1] !== '16')) chyby.push('index.html: iný počet strán ako 16');
if (/\b(\d+(?:\.\d+)?)\s*(?:€|EUR|euros)/.test(strankaVsetko) && [...strankaVsetko.matchAll(/\b(\d+(?:\.\d+)?)\s*(?:€|EUR|euros)/g)].some((m) => m[1] !== FAKTY.cena)) chyby.push('index.html: iná cena ako ' + FAKTY.cena);
if (POMLCKY.test(strankaVsetko)) chyby.push('index.html: pomlčka em alebo en');
for (const o of odpovede) if (new RegExp(`\\b${o}\\b`, 'i').test(strankaVsetko)) chyby.push(`index.html: odpoveď ${o}`);
if (/\b(barn|basil|bee|bumblebee|wagons)\b/i.test(strankaVsetko)) chyby.push('index.html: slovo, ktoré napovedá koniec');
// „not spooky“ je zámerný zápor (ako na stránke sady), ostatné zakázané slová nie
if (P.ZAKAZANE.test(strankaVsetko.replace(/not spooky/gi, ''))) chyby.push(`index.html: zakázané slovo „${strankaVsetko.replace(/not spooky/gi, '').match(P.ZAKAZANE)[0]}“`);
if (/\b(kids love|tested with|children love|best|#1|only today|hurry|last chance|buy now)\b/i.test(strankaVsetko)) chyby.push('index.html: nepodložené alebo naliehavé tvrdenie');
if (!/nobody has played it yet/i.test(strankaVsetko)) chyby.push('index.html: chýba, že hru ešte nikto nehral');
if (/every drawing in the film is a drawing from/i.test(strankaVsetko)) chyby.push('index.html: nepravdivé tvrdenie, že každá kresba je zo sady');
if (/empty (red )?wagon|still empty/i.test(strankaVsetko)) chyby.push('index.html: vozík vo filme nie je prázdny');
if (/"@id":"[^"]*#product"/.test(html)) chyby.push('index.html: JSON-LD odkazuje na @id #product, ktoré na stránke sady neexistuje');

if (chyby.length) {
  console.error(`\nZLYHALO: ${chyby.length} chýb`);
  for (const e of chyby.slice(0, 40)) console.error(' - ' + e);
  process.exit(1);
}
console.log(`\nOK: ${FORMATY.length} formáty x ${vsetky.length} snímok, ${spolu} textov, najmenšie písmo ${najmensie.toFixed(1)} px, ${film.zvuk.length} zvukov, fakty sedia so sadou, bez spoilerov`);
