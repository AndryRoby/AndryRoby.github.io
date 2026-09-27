// Test filmu Puzzle Village bez prehliadača: node products/arling-sk/games/village/film/test.mjs
//
// Falošné 2D plátno zaznamená každé volanie. Film sa nakreslí pre časy 0 až koniec po 1/30 s vo
// všetkých štyroch formátoch (aj tlač ostrova do dlaždíc skutočným kódom dedinky) a test overí:
//   1. žiadna výnimka (záporný polomer v arc, arcTo, ellipse a zlý offset prechodu hádžu ako v prehliadači),
//      save a restore v páre,
//   2. žiadne NaN ani nekonečno v súradniciach, rozmeroch a číselných vlastnostiach,
//   3. každý text filmu (názov, veta, adresa, štítky, titulky; zapečené v sprite a zložené cez drawImage,
//      s ohľadom na clip) leží celý v zóne zona(W, H) s rezervou 0,5 px,
//   4. najmenšie písmo textov filmu po všetkých transformáciách je aspoň minPismo(W, H);
//      drobné nápisy tlače dedinky (tabuľky domov, čísla hlavolamov, „z“ plcha) sú kresba, nie text filmu:
//      test ich spočíta zvlášť,
//   5. determinizmus: to isté t nakreslené znova (aj po inom t medzi tým) dá presne tie isté volania,
//   6. slučka: kamera v čase dĺžky filmu je tam, kde v čase 0, posledná snímka nadväzuje na snímku 0
//      (priblíženie pod 0,5 %, posun pod 1 px) a snímka v čase dĺžky sa kreslí tými istými volaniami ako
//      snímka 0 (čísla do 1 px),
//   7. kamera: bez NaN, bez prekmitu (každý kanál ostáva medzi hodnotami cieľov), žiadny statický úsek
//      (každý bod mriežky 3 x 3 sa pohne menej ako 0,3 px za snímku) dlhší ako 3 s mimo háku,
//   8. svetlá: všetkých 14 okien (aj s teplým kruhom) je vo všetkých formátoch celých v zóne počas celého
//      atramentu (okná vlny aj nad pásom titulkov a 0,1 s pred svetlom); štítok ani titulok žiadne
//      svietiace okno nezakrývajú; pri domoch príbehu kamera pri svetle takmer stojí,
//   8b. domy príbehu v pokoji (kontrola kola 2, kamera „stojí“ pod 3 px za snímku na mriežke 3 x 3): po
//      atramente aspoň 0,4 s pokoja, scénka rodiny aspoň polovicu času pri stojacej kamere a pri nej naozaj
//      mení kresbu domu, posledný dom dohrá scénku pri priblížení aspoň 2,5; vlna až po jeho scénke,
//   9. ráno prekryje snímku do 2,3 s, podvečer skôr, než príde názov; zdroj podvečera je v zóne a kamera stojí,
//  10. partitúra: časy v [0, dĺžka], známe nástroje, konečné čísla; plochy dlhšie ako nábeh a dobeh;
//      slučka: koncová plocha je akord háku v sile plochy háku a dobehne najviac za 0,3 s, ťuk na snímke 0
//      jemný, žiadne cvrknutie cvrčka nechýba ani sa na šve neodreže,
//  11. titulky na obraze: čas čítania aspoň slová / 3 + 0,5 s a nadväzujú bez medzier,
//  12. žiadne pomlčky em ani en v textoch filmu, titulkoch, index.html a README.md,
//  13. fakty: každý text filmu má zdroj v súboroch hry (zoznam.json, moja.js, svet.js, village.js,
//      miesta.js, index.html dedinky a hubu hier) a film importuje tú istú verziu modulov dedinky ako village.js,
//  14. stránka: po načítaní sa vytlačí len celý ostrov, zvyšok až po ťuknutí na Play (dotlac); plagát má
//      zloženie snímky 0 a odkaz nad adresou na ňom platí.
//
// Šírka textu je odhad (ARLing Sans priemerne okolo 0,55 em na znak); rozloženie filmu meria text tou
// istou funkciou, takže test overuje logiku rozloženia. Skutočné písmo ukážu kontrolné snímky so zónami.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { zona, minPismo, format } from './engine/hak.js';

const TU = path.dirname(fileURLToPath(import.meta.url));
const DEDINKA = path.resolve(TU, '..');
const HRY_DIR = path.resolve(DEDINKA, '..');
const citaj = (p) => fs.readFileSync(p, 'utf8');

// ---------- falošné plátno ----------

const chyby = [];
const cislo = (meno, ...h) => {
  for (const v of h) if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`${meno}: nečíselná hodnota ${v}`);
};

function sirkaZnaku(ch) {
  if (' .,:;!|\'il’'.includes(ch)) return 0.28;
  if ('fjtrI()[]/'.includes(ch)) return 0.36;
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
/** Path2D: pamätá si obálku bodov (na clip a fill s cestou). */
class FalosnaCesta {
  constructor() { this.b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }; }
  _p(x, y) { cislo('Path2D', x, y); const b = this.b; b.x0 = Math.min(b.x0, x); b.y0 = Math.min(b.y0, y); b.x1 = Math.max(b.x1, x); b.y1 = Math.max(b.y1, y); }
  moveTo(x, y) { this._p(x, y); } lineTo(x, y) { this._p(x, y); } closePath() {}
  quadraticCurveTo(a, b, c, d) { this._p(a, b); this._p(c, d); }
  bezierCurveTo(a, b, c, d, e, f) { this._p(a, b); this._p(c, d); this._p(e, f); }
  arc(x, y, r) { if (r < 0) throw new RangeError('Path2D arc záporný polomer'); this._p(x - r, y - r); this._p(x + r, y + r); }
  ellipse(x, y, rx, ry) { if (rx < 0 || ry < 0) throw new RangeError('Path2D ellipse záporný polomer'); this._p(x - rx, y - ry); this._p(x + rx, y + ry); }
  rect(x, y, w, h) { this._p(x, y); this._p(x + w, y + h); }
  addPath(p) { if (p && p.b && Number.isFinite(p.b.x0)) { this._p(p.b.x0, p.b.y0); this._p(p.b.x1, p.b.y1); } }
}

let pocitadloPlatien = 0;
export class FalosnePlatno {
  constructor(w = 300, h = 150) { this.width = w; this.height = h; this.texty = []; this.id = ++pocitadloPlatien; this._ctx = null; }
  getContext() { return this._ctx || (this._ctx = new FalosnyKontext(this)); }
  addEventListener() {} removeEventListener() {}
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
    this.imageSmoothingQuality = 'low';
    this.volania = 0;
    this.log = null; // zoznam volaní (na determinizmus a slučku), keď je zapnutý: [meno, ...argumenty]
  }
  _z(...a) { if (this.log) this.log.push(a.map((v) => (typeof v === 'number' ? +v.toPrecision(12) : v))); }
  get font() { return this.s.font; } set font(v) { this._z('font', v); this.s.font = v; }
  get textAlign() { return this.s.textAlign; } set textAlign(v) { this.s.textAlign = v; }
  get textBaseline() { return this.s.textBaseline; } set textBaseline(v) { this.s.textBaseline = v; }
  get fillStyle() { return this.s.fillStyle; } set fillStyle(v) { if (v === undefined || v === null) throw new TypeError('fillStyle prázdny'); this._z('fillStyle', typeof v === 'string' ? v : v.constructor.name); this.s.fillStyle = v; }
  get strokeStyle() { return this.s.strokeStyle; } set strokeStyle(v) { if (v === undefined || v === null) throw new TypeError('strokeStyle prázdny'); this.s.strokeStyle = v; }
  get lineCap() { return this.s.lineCap; } set lineCap(v) { this.s.lineCap = v; }
  get lineJoin() { return this.s.lineJoin; } set lineJoin(v) { this.s.lineJoin = v; }
  get letterSpacing() { return this.s.letterSpacing; } set letterSpacing(v) { this.s.letterSpacing = v; }
  get globalCompositeOperation() { return this.s.globalCompositeOperation; } set globalCompositeOperation(v) { this._z('gco', v); this.s.globalCompositeOperation = v; }
  save() { this._z('save'); this.zasobnik.push({ s: { ...this.s, m: [...this.s.m], clip: this.s.clip && { ...this.s.clip } }, num: { ...this.num } }); }
  restore() { this._z('restore'); const z = this.zasobnik.pop(); if (z) { this.s = z.s; this.num = z.num; } }
  _nasob(a, b, c, d, e, f) {
    const [A, B, C, D, E, F] = this.s.m;
    this.s.m = [A * a + C * b, B * a + D * b, A * c + C * d, B * c + D * d, A * e + C * f + E, B * e + D * f + F];
  }
  translate(x, y) { cislo('translate', x, y); this._z('translate', x, y); this._nasob(1, 0, 0, 1, x, y); }
  scale(x, y) { cislo('scale', x, y); this._z('scale', x, y); this._nasob(x, 0, 0, y, 0, 0); }
  rotate(u) { cislo('rotate', u); this._z('rotate', u); const c = Math.cos(u), s = Math.sin(u); this._nasob(c, s, -s, c, 0, 0); }
  transform(a, b, c, d, e, f) { cislo('transform', a, b, c, d, e, f); this._nasob(a, b, c, d, e, f); }
  setTransform(a, b, c, d, e, f) {
    if (typeof a === 'object' && a) { ({ a, b, c, d, e, f } = a); }
    if (a === undefined) { a = 1; b = 0; c = 0; d = 1; e = 0; f = 0; }
    cislo('setTransform', a, b, c, d, e, f); this._z('setTransform', a, b, c, d, e, f); this.s.m = [a, b, c, d, e, f];
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
  beginPath() { this._z('beginPath'); this.volania++; this.cesta = null; } closePath() {}
  moveTo(x, y) { cislo('moveTo', x, y); this._z('moveTo', x, y); this._pridaj(x, y); }
  lineTo(x, y) { cislo('lineTo', x, y); this._z('lineTo', x, y); this._pridaj(x, y); }
  quadraticCurveTo(a, b, c, d) { cislo('quadraticCurveTo', a, b, c, d); this._z('q', a, b, c, d); this._pridaj(a, b); this._pridaj(c, d); }
  bezierCurveTo(a, b, c, d, e, f) { cislo('bezierCurveTo', a, b, c, d, e, f); this._z('b', a, b, c, d, e, f); this._pridaj(a, b); this._pridaj(c, d); this._pridaj(e, f); }
  arc(x, y, r, a0, a1) { cislo('arc', x, y, r, a0, a1); this._z('arc', x, y, r, a0, a1); if (r < 0) throw new RangeError(`IndexSizeError: arc so záporným polomerom ${r}`); this._pridaj(x - r, y - r); this._pridaj(x + r, y + r); }
  arcTo(x1, y1, x2, y2, r) { cislo('arcTo', x1, y1, x2, y2, r); this._z('arcTo', x1, y1, x2, y2, r); if (r < 0) throw new RangeError(`IndexSizeError: arcTo so záporným polomerom ${r}`); this._pridaj(x1, y1); this._pridaj(x2, y2); }
  ellipse(x, y, rx, ry, rot, a0, a1) { cislo('ellipse', x, y, rx, ry, rot, a0, a1); this._z('ellipse', x, y, rx, ry, rot, a0, a1); if (rx < 0 || ry < 0) throw new RangeError('IndexSizeError: ellipse so záporným polomerom'); this._pridaj(x - rx, y - ry); this._pridaj(x + rx, y + ry); }
  rect(x, y, w, h) { cislo('rect', x, y, w, h); this._z('rect', x, y, w, h); this._pridaj(x, y); this._pridaj(x + w, y + h); this._pridaj(x + w, y); this._pridaj(x, y + h); }
  roundRect(x, y, w, h, r = 0) { cislo('roundRect', x, y, w, h); for (const q of [].concat(r)) { cislo('roundRect r', q); if (q < 0) throw new RangeError('roundRect záporný polomer'); } this.rect(x, y, w, h); }
  fill() { this._z('fill'); this.volania++; } stroke() { this._z('stroke'); this.volania++; }
  clip(cesta) {
    this._z('clip');
    let c = this.cesta;
    if (cesta instanceof FalosnaCesta) {
      const b = cesta.b;
      if (!Number.isFinite(b.x0)) c = null;
      else {
        const rohy = [this._bod(b.x0, b.y0), this._bod(b.x1, b.y0), this._bod(b.x0, b.y1), this._bod(b.x1, b.y1)];
        c = { x0: Math.min(...rohy.map((p) => p[0])), y0: Math.min(...rohy.map((p) => p[1])), x1: Math.max(...rohy.map((p) => p[0])), y1: Math.max(...rohy.map((p) => p[1])) };
      }
    }
    if (!c) { this.s.clip = { x0: 0, y0: 0, x1: 0, y1: 0 }; return; }
    const o = this.s.clip;
    this.s.clip = o ? { x0: Math.max(o.x0, c.x0), y0: Math.max(o.y0, c.y0), x1: Math.min(o.x1, c.x1), y1: Math.min(o.y1, c.y1) } : { ...c };
  }
  _orez(r) {
    const c = this.s.clip;
    if (!c) return r;
    const q = { ...r, x0: Math.max(r.x0, c.x0), y0: Math.max(r.y0, c.y0), x1: Math.min(r.x1, c.x1), y1: Math.min(r.y1, c.y1) };
    return q.x1 - q.x0 > 0.5 && q.y1 - q.y0 > 0.5 ? q : null;
  }
  fillRect(x, y, w, h) { cislo('fillRect', x, y, w, h); this._z('fillRect', x, y, w, h); this.volania++; }
  strokeRect(x, y, w, h) { cislo('strokeRect', x, y, w, h); }
  clearRect(x, y, w, h) { cislo('clearRect', x, y, w, h); }
  setLineDash(p) { for (const q of p) cislo('setLineDash', q); this._dash = p.slice(); }
  getLineDash() { return this._dash ? this._dash.slice() : []; }
  isPointInPath() { return false; }
  createLinearGradient(a, b, c, d) { if (![a, b, c, d].every(Number.isFinite)) throw new TypeError('createLinearGradient: nekonečno'); this._z('lin', a, b, c, d); return new FalosnyPrechod(); }
  createRadialGradient(a, b, r0, c, d, r1) {
    if (![a, b, r0, c, d, r1].every(Number.isFinite)) throw new TypeError('createRadialGradient: nekonečno');
    if (r0 < 0 || r1 < 0) throw new RangeError('createRadialGradient: záporný polomer');
    this._z('rad', a, b, r0, c, d, r1);
    return new FalosnyPrechod();
  }
  createPattern(img) { if (!img) throw new TypeError('createPattern bez obrázka'); this._z('pattern', img.id); return { setTransform() {} }; }
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
    this._z('text', String(text), x, y);
    const { px, width } = zmeraj(text, this.s.font);
    let w = width;
    if (maxW !== undefined && w > maxW) w = maxW;
    const al = this.s.textAlign, bl = this.s.textBaseline;
    const x0 = al === 'center' ? x - w / 2 : al === 'right' || al === 'end' ? x - w : x;
    const y0 = bl === 'top' || bl === 'hanging' ? y : bl === 'middle' ? y - px * 0.5 : bl === 'alphabetic' ? y - px * 0.78 : y - px;
    const rohy = [this._bod(x0, y0), this._bod(x0 + w, y0), this._bod(x0, y0 + px), this._bod(x0 + w, y0 + px)];
    const xs = rohy.map((p) => p[0]), ys = rohy.map((p) => p[1]);
    const r = this._orez({ t: String(text), film: !!this.canvas.textFilmu, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), px: px * this._mierka() });
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
    this._z('drawImage', img.id, ...a);
    this.volania++;
    const kx = dw / sw, ky = dh / sh, m = this._mierka();
    if (!(img instanceof FalosnePlatno) || !img.texty.length) return;
    for (const r of img.texty) {
      const ax = Math.max(r.x0, sx), bx = Math.min(r.x1, sx + sw), ay = Math.max(r.y0, sy), by = Math.min(r.y1, sy + sh);
      if (bx <= ax || by <= ay) continue;
      const p = [[ax, ay], [bx, ay], [ax, by], [bx, by]].map(([x, y]) => this._bod(dx + (x - sx) * kx, dy + (y - sy) * ky));
      const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]);
      const z = this._orez({ t: r.t, film: r.film, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), px: r.px * Math.sqrt(Math.abs(kx * ky)) * m });
      if (z) this.canvas.texty.push(z);
    }
  }
}
for (const k of NUM_VLASTNOSTI) {
  Object.defineProperty(FalosnyKontext.prototype, k, {
    get() { return this.num[k]; },
    set(v) { if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`${k} = ${v}`); if (k === 'globalAlpha') this._z('alpha', v); this.num[k] = v; },
  });
}

globalThis.document = {
  createElement: () => new FalosnePlatno(),
  fonts: { load: async () => [], add() {}, ready: Promise.resolve() },
};
globalThis.Path2D = FalosnaCesta;
globalThis.DOMMatrix = class { constructor(a = [1, 0, 0, 1, 0, 0]) { [this.a, this.b, this.c, this.d, this.e, this.f] = a; } };

// ---------- test ----------

const FORMATY = [[1080, 1920], [1920, 1080], [1080, 1080], [1080, 1350]];
const REZERVA = 0.5;
const zac = Date.now();
const { default: film, VERZIA_DEDINKY } = await import('./film.js');
const { PRESETS, springStep } = await import('../../../motion/src/core.js');
const { HAK_KONIEC } = { HAK_KONIEC: 1.9 };
const K = film.kontrola;
await film.pripravit({ render: true });

const env = (W, H) => ({ render: true, slabe: false, dpr: 1, W, H });
const krok = 1 / 30;
const casy = [];
for (let i = 0; i <= Math.round(film.dlzka / krok); i++) casy.push(Math.min(film.dlzka, i * krok));
const prienik = (a, b) => !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
const bbRect = (r) => ({ x: r.x0, y: r.y0, w: r.x1 - r.x0, h: r.y1 - r.y0 });
const vZone = (r, Z, y1 = Z.y1) => r.x0 >= Z.x0 - 1e-6 && r.x1 <= Z.x1 + 1e-6 && r.y0 >= Z.y0 - 1e-6 && r.y1 <= y1 + 1e-6;

/** Najväčší posun bodu mriežky 3 x 3 (rohy, stredy hrán, stred) medzi kamerami a a b, v px. */
function posunMriezky(W, H, a, b) {
  let m = 0, stred = 0;
  for (const fx of [0, 0.5, 1]) for (const fy of [0, 0.5, 1]) {
    const sx = W * fx, sy = H * fy, wx = a.x + (sx - a.ax) / a.z, wy = a.y + (sy - a.ay) / a.z;
    const d = Math.hypot(b.ax + (wx - b.x) * b.z - sx, b.ay + (wy - b.y) * b.z - sy);
    m = Math.max(m, d); if (fx === 0.5 && fy === 0.5) stred = d;
  }
  return { m, stred };
}

let spolu = 0, najmensie = Infinity, ilustracie = 0, najrychlejsie = 0;
const suhrnFormatov = [];
for (const [W, H] of FORMATY) {
  const meno = `${W}x${H}`;
  const Z = zona(W, H), mp = minPismo(W, H), e = env(W, H);
  const t0 = Date.now();
  film.vrstvy(W, H, 1, e);
  const tVrstvy = Date.now() - t0;
  const hlavne = new FalosnePlatno(W, H);
  const ctx = hlavne.getContext('2d');
  let n = 0, min = Infinity, zle = 0, ilu = 0;
  const kresli = (t) => { hlavne.texty = []; ctx.setTransform(1, 0, 0, 1, 0, 0); film.kresli(ctx, t, W, H, e); };
  for (const t of casy) {
    try { kresli(t); } catch (err) { chyby.push(`${meno} t=${t.toFixed(3)}: ${err.stack.split('\n').slice(0, 3).join(' | ')}`); if (++zle > 3) break; continue; }
    if (ctx.zasobnik.length) { chyby.push(`${meno} t=${t.toFixed(3)}: save bez restore (${ctx.zasobnik.length})`); ctx.zasobnik.length = 0; }
    for (const r of hlavne.texty) {
      if (!r.film) { ilu++; continue; }
      n++;
      if (r.px < min) min = r.px;
      if (r.px < mp - 0.01) { chyby.push(`${meno} t=${t.toFixed(3)}: písmo ${r.px.toFixed(1)} px < ${mp} px: „${r.t}“`); if (++zle > 12) break; }
      if (r.x0 < Z.x0 - REZERVA || r.x1 > Z.x1 + REZERVA || r.y0 < Z.y0 - REZERVA || r.y1 > Z.y1 + REZERVA) {
        chyby.push(`${meno} t=${t.toFixed(3)}: text mimo zóny „${r.t}“ [${r.x0.toFixed(0)}, ${r.y0.toFixed(0)}, ${r.x1.toFixed(0)}, ${r.y1.toFixed(0)}] zóna [${Z.x0.toFixed(0)}, ${Z.y0.toFixed(0)}, ${Z.x1.toFixed(0)}, ${Z.y1.toFixed(0)}]`);
        if (++zle > 12) break;
      }
    }
    if (zle > 12) break;
  }

  // determinizmus: to isté t znova, aj po inom t medzi tým, dá tie isté volania
  const zaznam = (t) => { ctx.log = []; kresli(t); const l = ctx.log; ctx.log = null; return l; };
  const riadok = (x) => x.join(' ');
  if (process.argv.includes('--ladenie') && W === 1080 && H === 1920) {
    console.log('  svetlá: ' + [...K.SVETLA].map(([k, t]) => `${k} ${t.toFixed(2)}`).join(', ') + `; všetkých 14: ${K.T.vsetky.toFixed(2)} s, podvečer ${K.T.vecer.toFixed(2)} s z okna ${K.VLNA[K.VLNA.length - 1]}`);
    for (const t of [0, 1, 1.5, 2, 3.4, 4, 5.5, 7.4, 9, 10.3, 11.6, 12.3, 13, 14.9, 16.2, 18.9]) {
      const l = zaznam(t);
      const texty = [...new Set(hlavne.texty.filter((r) => r.film).map((r) => r.t))];
      const obr = l.filter((x) => x[0] === 'drawImage').length, clip = l.filter((x) => x[0] === 'clip').length;
      const f = K.faza(t);
      console.log(`  t ${t}: ${f.spodok}${f.kruh ? ' + kruh ' + (f.kruh.vecer ? 'podvečera' : 'rána') : ''}, ${l.length} volaní, ${obr} drawImage, ${clip} clip, texty filmu: ${texty.join(' | ')}`);
    }
  }
  for (const t of [0, 1, 1.5, 2, 2.95, 3.4, 4, 5.2, 9, 10.2, 11.6, 12.1, 12.4, 13, 14.9, 17, film.dlzka - krok, film.dlzka]) {
    const a = zaznam(t);
    kresli((t * 7.3 + 2.1) % film.dlzka);
    const b = zaznam(t);
    if (a.length !== b.length || a.some((x, i) => riadok(x) !== riadok(b[i]))) {
      const i = a.findIndex((x, j) => !b[j] || riadok(x) !== riadok(b[j]));
      chyby.push(`${meno} t=${t}: dve kreslenia toho istého t sa líšia (${a.length} a ${b.length} volaní, prvý rozdiel na ${i}: „${a[i] && riadok(a[i])}“ / „${b[i] && riadok(b[i])}“)`);
    }
  }

  // slučka: snímka v čase dĺžky filmu = snímka 0 (tie isté volania, čísla do 1 px), kamera na tom istom mieste
  {
    const a = zaznam(0), b = zaznam(film.dlzka);
    let rozdiel = null, najviac = 0;
    if (a.length !== b.length) rozdiel = `${a.length} a ${b.length} volaní`;
    else for (let i = 0; i < a.length && !rozdiel; i++) {
      const x = a[i], y = b[i];
      if (x.length !== y.length || x[0] !== y[0]) { rozdiel = `volanie ${i}: „${riadok(x)}“ / „${riadok(y)}“`; break; }
      for (let j = 1; j < x.length; j++) {
        if (typeof x[j] === 'number' && typeof y[j] === 'number') { const d = Math.abs(x[j] - y[j]); najviac = Math.max(najviac, d); if (d > 1) { rozdiel = `volanie ${i}: „${riadok(x)}“ / „${riadok(y)}“`; break; } }
        else if (x[j] !== y[j]) { rozdiel = `volanie ${i}: „${riadok(x)}“ / „${riadok(y)}“`; break; }
      }
    }
    if (rozdiel) chyby.push(`${meno}: slučka, snímka v ${film.dlzka} s sa nekreslí ako snímka 0 (${rozdiel})`);
    // kamera: v čase dĺžky presne v polohe snímky 0; posledná snímka (569/30) proti snímke 0: priblíženie pod 0,5 %
    // a poloha (bod sveta v kotve a kotva) pod 1 px; krok slučky nie je väčší než bežný krok pred ním
    const kP2 = K.kamera(Math.round(film.dlzka * 30 - 2) / 30), kP = K.kamera(Math.round(film.dlzka * 30 - 1) / 30);
    const k0 = K.kamera(0), kD = K.kamera(film.dlzka);
    const dD = posunMriezky(W, H, k0, kD).m, dP = posunMriezky(W, H, kP, k0).m, dPred = posunMriezky(W, H, kP2, kP).m;
    const poloha = Math.hypot((kP.x - k0.x) * k0.z, (kP.y - k0.y) * k0.z) + Math.hypot(kP.ax - k0.ax, kP.ay - k0.ay);
    if (Math.abs(kD.z / k0.z - 1) > 1e-6 || dD > 0.01) chyby.push(`${meno}: slučka, kamera v ${film.dlzka} s nie je v polohe snímky 0 (z ${kD.z} a ${k0.z}, posun ${dD.toFixed(3)} px)`);
    if (Math.abs(kP.z / k0.z - 1) > 0.005 || poloha > 1) chyby.push(`${meno}: slučka, posledná snímka nenadväzuje na snímku 0 (priblíženie ${((kP.z / k0.z - 1) * 100).toFixed(2)} %, poloha ${poloha.toFixed(2)} px)`);
    if (dP > dPred * 1.05 + 0.05) chyby.push(`${meno}: slučka, krok z poslednej snímky na snímku 0 je ${dP.toFixed(2)} px, bežný krok pred ním ${dPred.toFixed(2)} px`);
    const h0 = K.hlavicka(0), hD = K.hlavicka(film.dlzka);
    for (const q of Object.keys(h0)) if (Math.abs(h0[q] - hD[q]) > 1e-9) chyby.push(`${meno}: slučka, hlavička „${q}“ je na konci ${hD[q]} a na snímke 0 ${h0[q]}`);
    suhrnFormatov.push(`${meno} slučka: posledná snímka proti snímke 0 priblíženie ${((kP.z / k0.z - 1) * 100).toFixed(3)} %, poloha ${poloha.toFixed(3)} px, roh ${dP.toFixed(2)} px (bežný krok ${dPred.toFixed(2)} px); snímka ${film.dlzka} s = snímka 0 (čísla volaní do ${najviac.toFixed(3)})`);
  }

  // kamera: bez NaN, bez prekmitu, pohyb (stred a mriežka 3 x 3), statické úseky mimo háku
  const kroky = K.kroky();
  const rozsah = (pole) => [Math.min(...kroky.map((k) => k[pole])), Math.max(...kroky.map((k) => k[pole]))];
  const R = { x: rozsah('x'), y: rozsah('y'), lz: rozsah('lz'), ax: rozsah('ax'), ay: rozsah('ay') };
  let rychlo = 0, rychloT = 0, mriezka = 0, mriezkaT = 0;
  for (let i = 0; i <= film.dlzka * 120; i++) {
    const t = i / 120, k = K.kamera(t);
    cislo('kamera', k.x, k.y, k.z, k.ax, k.ay);
    const eps = 1e-6;
    for (const [pole, v] of [['x', k.x], ['y', k.y], ['lz', Math.log(k.z)], ['ax', k.ax], ['ay', k.ay]]) {
      if (v < R[pole][0] - eps * Math.max(1, Math.abs(R[pole][0])) || v > R[pole][1] + eps * Math.max(1, Math.abs(R[pole][1]))) { chyby.push(`${meno} t=${t}: kamera ${pole} ${v} mimo cieľov [${R[pole]}] (prekmit)`); break; }
    }
  }
  let staticky = [0, 0, 0], od = null;
  for (let i = 0; i < Math.round(film.dlzka * 30); i++) {
    const t = i / 30, p = posunMriezky(W, H, K.kamera(t), K.kamera(t + krok));
    if (p.stred > rychlo) { rychlo = p.stred; rychloT = t; }
    if (p.m > mriezka) { mriezka = p.m; mriezkaT = t; }
    const stoji = p.m < 0.3 && t >= HAK_KONIEC;
    if (stoji && od == null) od = t;
    if (!stoji && od != null) { if (t - od > staticky[0]) staticky = [t - od, od, t]; od = null; }
  }
  if (od != null && film.dlzka - od > staticky[0]) staticky = [film.dlzka - od, od, film.dlzka];
  if (staticky[0] > 3) chyby.push(`${meno}: kamera stojí ${staticky[0].toFixed(2)} s (${staticky[1].toFixed(2)} až ${staticky[2].toFixed(2)}), najviac 3 s`);
  najrychlejsie = Math.max(najrychlejsie, rychlo);
  // záver sa približuje viditeľne (aspoň 1,5 % za sekundu od dosadnutia adresy do konca)
  const zAd = K.kamera(K.T.adresa + 0.5).z, zKon = K.kamera(film.dlzka).z, rychlostZaveru = (Math.log(zKon / zAd) / (film.dlzka - K.T.adresa - 0.5)) * 100;
  if (rychlostZaveru < 1.5) chyby.push(`${meno}: záver sa približuje len ${rychlostZaveru.toFixed(2)} % za sekundu`);

  // domy príbehu: pri svetle kamera takmer stojí (aspoň 95 % priblíženia, fokus do 40 px od kotvy, stred do 4 px za snímku)
  const roz0 = K.rozlozenie();
  const prichod = K.T.domy.map((d) => {
    const k = K.kamera(d.svetlo), f = roz0.fokus[d.kluc];
    const vzd = Math.hypot(k.ax + (f[0] - k.x) * k.z - roz0.kotva[0], k.ay + (f[1] - k.y) * k.z - roz0.kotva[1]);
    const pz = k.z / roz0.blizko, pohyb = posunMriezky(W, H, k, K.kamera(d.svetlo + krok)).stred;
    if (pz < 0.95 || vzd > 40 || pohyb > 4) chyby.push(`${meno}: pri svetle ${d.kluc} (${d.svetlo} s) kamera ešte ide: priblíženie ${(pz * 100).toFixed(1)} %, fokus ${vzd.toFixed(0)} px od kotvy, stred ${pohyb.toFixed(1)} px za snímku`);
    return `${d.kluc} ${(pz * 100).toFixed(0)} % ${vzd.toFixed(0)} px ${pohyb.toFixed(1)} px/snímku`;
  });
  // domy príbehu v pokoji (kontrola kola 2): kamera „stojí“, keď sa žiadny bod mriežky 3 x 3 nepohne o 3 px
  // za snímku (tak meral kontrolór); po atramente aspoň 0,4 s pokoja, scénka rodiny aspoň polovicu času pri
  // stojacej kamere a pri nej naozaj niečo zmení (nie ako tabuľa Magpies, ktorá bliká aj bez scénky);
  // posledný dom dohrá scénku pri priblížení aspoň 2,5 (px na jednotku pri 1080)
  const u1080 = Math.min(W, H) / 1080, PRAH = 3;
  const pohybT = (t) => posunMriezky(W, H, K.kamera(t), K.kamera(t + krok)).m;
  const domPlatno = new FalosnePlatno(W, H), domCtx = domPlatno.getContext('2d');
  const zaznamDomu = (k, t, bez) => { domCtx.log = []; domCtx.setTransform(1, 0, 0, 1, 0, 0); K.kresliDom(domCtx, k, t, bez); const l = domCtx.log.map(riadok).join('|'); domCtx.log = null; return l; };
  const pokoj = K.T.domy.map((d, i) => {
    const ink = d.svetlo + K.INK;
    let t = ink; while (t < film.dlzka && pohybT(t) < PRAH) t += 1 / 240;
    const [a, b] = K.scenka(d.kluc);
    let stoji = 0, vzorky = 0, meni = 0;
    for (let q = a; q <= b + 1e-9; q += 1 / 30) {
      vzorky++;
      if (pohybT(q) >= PRAH) continue;
      stoji++;
      if (zaznamDomu(d.kluc, q, false) !== zaznamDomu(d.kluc, q, true)) meni++;
    }
    const zKonca = K.kamera(b).z / u1080, posledny = i === K.T.domy.length - 1;
    if (t - ink < 0.4) chyby.push(`${meno}: pri ${d.kluc} ostane po atramente len ${(t - ink).toFixed(2)} s pokoja (treba 0,4)`);
    if (stoji < vzorky / 2) chyby.push(`${meno}: scénka ${d.kluc} (${a.toFixed(2)} až ${b.toFixed(2)} s) hrá pri stojacej kamere len ${((100 * stoji) / vzorky).toFixed(0)} % času`);
    if (meni < stoji / 2 || meni < 5) chyby.push(`${meno}: scénka ${d.kluc} pri stojacej kamere mení kresbu len v ${meni} z ${stoji} snímok (nie je ju vidieť)`);
    if (posledny && zKonca < 2.5) chyby.push(`${meno}: posledný dom ${d.kluc} dohrá scénku (${b.toFixed(2)} s) pri priblížení ${zKonca.toFixed(2)}, treba aspoň 2,5`);
    return `${d.kluc} pokoj po atramente ${(t - ink).toFixed(2)} s, scénka ${a.toFixed(2)} až ${b.toFixed(2)} s pri stojacej kamere ${((100 * stoji) / vzorky).toFixed(0)} % (mení kresbu v ${meni} z ${stoji}), priblíženie na konci ${zKonca.toFixed(2)}`;
  });
  suhrnFormatov.push(`${meno} domy: ${pokoj.join('; ')}`);
  {
    const [vx, vy] = K.naObrazovku(K.T.vecer, K.VECER_BOD);
    suhrnFormatov.push(`${meno} podvečer v ${K.T.vecer.toFixed(2)} s z okna ${K.VLNA[K.VLNA.length - 1]} na [${vx.toFixed(0)}, ${vy.toFixed(0)}]`);
  }
  if (process.argv.includes('--kamera') && W === 1080 && H === 1920) {
    console.log('  príchod pri rozsvietení: ' + prichod.join('; '));
    for (let t = 0; t <= film.dlzka + 1e-9; t += 0.25) {
      const k = K.kamera(t), p = posunMriezky(W, H, k, K.kamera(Math.min(film.dlzka, t + krok)));
      const wx = k.x + (W / 2 - k.ax) / k.z, wy = k.y + (H / 2 - k.ay) / k.z;
      console.log(`  t ${t.toFixed(2)}  z ${k.z.toFixed(3)}  stred [${wx.toFixed(0)}, ${wy.toFixed(0)}]  posun stredu ${p.stred.toFixed(1)}, mriežky ${p.m.toFixed(1)} px/snímku`);
    }
  }

  // svetlá: všetkých 14 okien celých v zóne počas celého atramentu, okná vlny aj nad pásom titulkov
  // a 0,1 s pred svetlom; štítok ani titulok nezakrývajú žiadne svietiace okno
  for (const [k, tL] of K.SVETLA) {
    const vlna = !K.T.domy.some((d) => d.kluc === k), y1 = vlna ? roz0.pasTitulkov : Z.y1;
    for (let t = tL - (vlna ? K.PRED : 0); t <= tL + K.INK + 1e-9; t += 1 / 60) {
      const r = K.svetlo(k, t);
      if (!vZone(r, Z, y1)) { chyby.push(`${meno} t=${t.toFixed(2)}: okno ${k} (svieti od ${tL.toFixed(2)}) nie je celé v zóne [${r.x0.toFixed(0)}, ${r.y0.toFixed(0)}, ${r.x1.toFixed(0)}, ${r.y1.toFixed(0)}]`); break; }
    }
    for (let t = tL; t <= tL + K.INK + 0.8; t += 1 / 30) {
      const okna = K.okna(k, t), ti = K.titulok(t), st = K.stitky(t);
      for (const o of okna) {
        if (ti && prienik(ti, o)) { chyby.push(`${meno} t=${t.toFixed(2)}: titulok zakrýva okno ${k}`); break; }
        const s = st.find((x) => prienik(x, o));
        if (s) { chyby.push(`${meno} t=${t.toFixed(2)}: štítok ${s.k} zakrýva okno ${k}`); break; }
      }
    }
  }
  for (const d of K.T.domy) {
    for (let t = d.svetlo; t <= d.von[1]; t += 1 / 15) {
      const st = K.stitok(d.kluc, t), ti = K.titulok(t);
      if (st && ti && prienik(st, ti)) chyby.push(`${meno} t=${t.toFixed(2)}: štítok ${d.kluc} sa prekrýva s titulkom`);
    }
    // štítok pri dosadnutí sedí nad svojím domom (zovretie do zóny ho neodtrhlo)
    const t1 = d.svetlo + 0.4, st = K.stitok(d.kluc, t1), [kx, ky] = K.kotvaStitku(d.kluc, t1);
    const odtrh = st ? Math.hypot(st.x + st.w / 2 - kx, st.y + st.h - ky) : Infinity;
    if (odtrh > 24) chyby.push(`${meno}: štítok ${d.kluc} je pri dosadnutí ${odtrh.toFixed(0)} px od svojho domu`);
  }

  // ráno a podvečer: ráno prekryje snímku do 2,3 s, podvečer skôr, než príde názov záveru;
  // zdroj podvečera (posledné okno) je v zóne a kamera pri ňom stojí
  const pok = K.pokrytie();
  if (pok.ranoDo > 2.3) chyby.push(`${meno}: ráno prekryje snímku až v ${pok.ranoDo.toFixed(2)} s`);
  if (pok.vecerDo > K.T.nazov) chyby.push(`${meno}: podvečer ešte neprikryl celú snímku v ${K.T.nazov} s, keď prichádza názov (${pok.vecerDo.toFixed(2)} s)`);
  const [vx, vy] = K.naObrazovku(K.T.vecer, K.VECER_BOD), okrajZ = Z.w * 0.05;
  if (vx < Z.x0 + okrajZ || vx > Z.x1 - okrajZ || vy < Z.y0 + okrajZ || vy > Z.y1 - okrajZ) chyby.push(`${meno}: podvečer začína pri okraji záberu [${vx.toFixed(0)}, ${vy.toFixed(0)}]`);
  const pohybVecer = posunMriezky(W, H, K.kamera(K.T.vecer), K.kamera(K.T.vecer + krok)).m;
  if (pohybVecer > 2) chyby.push(`${meno}: kamera sa pri začiatku podvečera hýbe o ${pohybVecer.toFixed(1)} px za snímku`);
  if (K.faza(0).spodok !== 'vecer' || K.faza(0).kruh) chyby.push(`${meno}: snímka 0 nie je podvečer`);
  if (K.faza(film.dlzka).spodok !== 'vecer' || K.faza(film.dlzka).kruh) chyby.push(`${meno}: koniec nie je podvečer`);
  if (K.faza(2.4).spodok !== 'den' || K.faza(2.4).kruh) chyby.push(`${meno}: v 2,4 s ešte nie je ráno`);

  // odkazy nad plátnom: celé v zóne
  for (const o of film.odkazy(W, H)) {
    cislo('odkaz', o.x, o.y, o.w, o.h);
    if (o.x < Z.x0 - 1 || o.x + o.w > Z.x1 + 1 || o.y < Z.y0 - 1 || o.y + o.h > Z.y1 + 1) chyby.push(`${meno}: odkaz mimo zóny ${JSON.stringify(o)}`);
  }
  cislo('stredPlagatu', ...film.stredPlagatu(W, H));

  const dl = K.dlazdice(), roz = K.rozlozenie();
  console.log(`${meno} ${format(W, H).druh}: ${casy.length} snímok, ${n} textov filmu (najmenšie písmo ${min.toFixed(1)} px, minimum ${mp}), ${ilu} nápisov tlače dedinky; dlaždice deň ${dl[0].join('/')}, podvečer ${dl[1].join('/')} (${tVrstvy} ms); priblíženie ostrov ${roz.domov.s.toFixed(3)}, stredná ${roz.stredna.toFixed(2)}, pri domoch ${roz.blizko.toFixed(2)}; stred najviac ${rychlo.toFixed(1)} px za snímku (t ${rychloT.toFixed(2)}), mriežka ${mriezka.toFixed(1)} (t ${mriezkaT.toFixed(2)}); najdlhšie státie ${staticky[0].toFixed(2)} s; záver ${rychlostZaveru.toFixed(1)} % za s; ráno kryje od ${pok.ranoDo.toFixed(2)} s, podvečer od ${pok.vecerDo.toFixed(2)} s`);
  if (process.argv.includes('--rozlozenie')) console.log('  ' + JSON.stringify(roz));
  spolu += n; ilustracie += ilu; if (min < najmensie) najmensie = min;
}
for (const s of suhrnFormatov) console.log(s);

// cesta pre Firefox (stránka vo Firefoxe tlačí čiary a písmo ako výplne, OPT.fillStrokes): tiež bez chyby
{
  const { OPT } = await import('../riso.js?v=' + VERZIA_DEDINKY);
  OPT.fillStrokes = true;
  const [W, H] = [1080, 1920], e = env(W, H);
  try {
    film.vrstvy(W, H, 1, e);
    const pl = new FalosnePlatno(W, H), c = pl.getContext('2d');
    for (const t of [0, 1.6, 3.4, 5.5, 10.2, 12.3, 12.9, 15, 18.9]) { c.setTransform(1, 0, 0, 1, 0, 0); film.kresli(c, t, W, H, e); if (c.zasobnik.length) chyby.push(`Firefox t=${t}: save bez restore`); }
  } catch (err) { chyby.push('cesta pre Firefox: ' + err.stack.split('\n').slice(0, 3).join(' | ')); }
  OPT.fillStrokes = false;
}

// pružiny rozhrania: prekmit najviac 3 % (kamera, ráno a podvečer majú tlmenie 1, teda žiadny)
for (const meno of ['press', 'enter', 'gentle', 'snappy']) {
  let max = 0;
  for (let i = 0; i < 4000; i++) max = Math.max(max, springStep(PRESETS[meno], i / 1000));
  if (max > 1.03) chyby.push(`pružina ${meno} prekmitne o ${((max - 1) * 100).toFixed(1)} %`);
}

// vlna: rozvrh podľa kamery, všetky ostatné okná (14 mínus domy príbehu), odstup aspoň 140 ms
if (K.VLNA_CHYBA.length) chyby.push(`vlna: okná ${K.VLNA_CHYBA.join(', ')} nikdy nie sú celé v zábere`);
if (K.VLNA.length !== 14 - K.T.domy.length) chyby.push(`vlna má ${K.VLNA.length} okien namiesto ${14 - K.T.domy.length}`);
{
  const casyVlny = K.VLNA.map((k) => K.SVETLA.get(k)), posledny = K.T.domy[K.T.domy.length - 1];
  for (let i = 1; i < casyVlny.length; i++) if (casyVlny[i] - casyVlny[i - 1] < K.ODSTUP - 1e-6) chyby.push(`vlna: ${K.VLNA[i - 1]} a ${K.VLNA[i]} len ${((casyVlny[i] - casyVlny[i - 1]) * 1000).toFixed(0)} ms po sebe`);
  if (casyVlny[0] < K.scenka(posledny.kluc)[1] - 1e-9) chyby.push(`vlna začína (${casyVlny[0].toFixed(2)} s) skôr, než dohrá scénka posledného domu príbehu (${K.scenka(posledny.kluc)[1].toFixed(2)} s)`);
  if (K.T.vecer > K.T.zdvih) chyby.push(`podvečer (${K.T.vecer.toFixed(2)} s) začína až po zdvihu kamery (${K.T.zdvih} s)`);
  // domy príbehu po sebe: odchod najskôr 0,85 s po svetle, ďalší dom až po odchode
  K.T.domy.forEach((d, i) => {
    if (!(d.kluc in K.DOHRA)) chyby.push(`${d.kluc}: film nepozná dĺžku jeho scénky (DOHRA vo film.js podľa miesta.js)`);
    if (d.od < d.svetlo + 0.85 - 1e-9) chyby.push(`${d.kluc}: kamera odchádza ${(d.od - d.svetlo).toFixed(2)} s po svetle, najskôr 0,85 s`);
    if (i && d.pri <= K.T.domy[i - 1].od) chyby.push(`${d.kluc}: príchod pred odchodom z predošlého domu`);
  });
}

// partitúra
const ZNAME = new Set(['zvon', 'pad', 'sum', 'praskot', 'tuk', 'glis', 'zvoncek']);
for (const u of film.zvuk) {
  if (!Number.isFinite(u.t) || u.t < 0 || u.t > film.dlzka) chyby.push(`zvuk: čas ${u.t} mimo [0, ${film.dlzka}]`);
  if (!ZNAME.has(u.typ)) chyby.push(`zvuk: neznámy nástroj ${u.typ}`);
  for (const [k, v] of Object.entries(u)) if (typeof v === 'number' && !Number.isFinite(v)) chyby.push(`zvuk: ${k} = ${v}`);
  if (u.typ === 'pad' && (u.dlzka ?? 4) < (u.nabeh ?? 1.2) + (u.dobeh ?? 1.5) - 1e-9) chyby.push(`zvuk: plocha v ${u.t} kratšia ako nábeh a dobeh`);
  if (u.typ === 'pad' && u.t + (u.dlzka ?? 4) > film.dlzka + 1e-6) chyby.push(`zvuk: plocha v ${u.t} presahuje koniec filmu`);
}
const zvonceky = film.zvuk.filter((u) => u.typ === 'zvoncek');
if (zvonceky.length !== 14) chyby.push(`zvuk: ${zvonceky.length} zvončekov okien namiesto 14`);

// zvuk v slučke (kontrola kola 2): koncová plocha je akord háku v sile plochy háku, znie do konca, jej filter
// skončí tam, kde plocha háku začína, a dobehne najviac za 0,3 s; ťuk na snímke 0 je zjemnený; žiadne
// cvrknutie cvrčka nechýba ani sa na šve neodreže
{
  const plochaHaku = film.zvuk.find((u) => u.typ === 'pad' && u.t === 0);
  const koncova = film.zvuk.find((u) => u.typ === 'pad' && u.t > film.dlzka / 2 && Math.abs(u.t + (u.dlzka ?? 4) - film.dlzka) < 1e-6);
  if (!plochaHaku || !koncova) chyby.push('zvuk: chýba plocha háku alebo koncová plocha, ktorá znie do konca');
  else {
    if (koncova.noty.join() !== plochaHaku.noty.join()) chyby.push(`zvuk: koncová plocha ${koncova.noty} nie je akord háku ${plochaHaku.noty}`);
    if (Math.abs(koncova.hlas - plochaHaku.hlas) > 1e-9) chyby.push(`zvuk: koncová plocha má silu ${koncova.hlas}, plocha háku ${plochaHaku.hlas}`);
    if ((koncova.dobeh ?? 1.5) > 0.3 + 1e-9) chyby.push(`zvuk: koncová plocha dobieha ${koncova.dobeh} s (najviac 0,3)`);
    if (Math.abs((koncova.filter2 ?? koncova.filter) - plochaHaku.filter) > 50) chyby.push(`zvuk: filter koncovej plochy končí na ${koncova.filter2} Hz, plocha háku začína na ${plochaHaku.filter} Hz`);
  }
  const tuk0 = film.zvuk.find((u) => u.typ === 'tuk' && u.t === 0);
  if (tuk0 && tuk0.hlas > 0.07) chyby.push(`zvuk: ťuk na snímke 0 má silu ${tuk0.hlas.toFixed(3)} (v slučke má byť jemný)`);
  for (const [f, , od, per] of K.CVRCKY) {
    const cv = film.zvuk.filter((u) => u.cvrcok === f);
    for (const c of cv) if (c.t < 0 || c.t + c.dlzka > film.dlzka + 1e-9) chyby.push(`zvuk: cvrknutie ${f} Hz v ${c.t.toFixed(3)} s sa na šve odreže`);
    let n = 0;
    for (let i = 0; ; i++) {
      const t0 = K.T.vecer + od + i * per;
      if (t0 - film.dlzka > K.T.rano - 0.3) break;
      for (let j = 0; j < 3; j++) {
        n++;
        // vzdialenosť na kruhu slučky: cvrknutie, ktoré by prekročilo šev, zaznie na snímke 0
        const t = (t0 + j * K.CVRK.krok) % film.dlzka, blizko = (c) => { const d = Math.abs(c.t - t); return Math.min(d, film.dlzka - d) < 0.05; };
        if (!cv.some(blizko)) chyby.push(`zvuk: chýba cvrknutie ${f} Hz v ${t.toFixed(2)} s`);
      }
    }
    if (cv.length !== n) chyby.push(`zvuk: cvrček ${f} Hz má ${cv.length} cvrknutí, čakal som ${n}`);
  }
}

// plagát (pred ťuknutím a pri zníženom pohybe): to isté zloženie ako snímka 0 a odkaz nad adresou na ňom platí
{
  const f = K.faza(film.plagat), h0 = K.hlavicka(0), hP = K.hlavicka(film.plagat);
  if (!(film.plagat > 0 && film.plagat < film.dlzka)) chyby.push(`plagát ${film.plagat} s je mimo filmu`);
  if (f.spodok !== 'vecer' || f.kruh) chyby.push('plagát nie je podvečer bez kruhu');
  for (const q of Object.keys(h0)) if (Math.abs(h0[q] - hP[q]) > 0.01) chyby.push(`plagát: hlavička „${q}“ je ${hP[q]}, na snímke 0 ${h0[q]}`);
  for (const o of film.odkazy(1080, 1920)) if (film.plagat < o.od) chyby.push(`plagát (${film.plagat} s) je pred odkazom ${o.href} (platí od ${o.od} s): pri zníženom pohybe sa naň nedá kliknúť`);
}

// titulky na obraze: čas čítania a nadväznosť
K.TITULKY.forEach((c, i) => {
  const slova = c.text.split(/\s+/).filter(Boolean).length, treba = slova / 3 + 0.5;
  if (c.do - c.od < treba - 1e-6) chyby.push(`titulok „${c.text}“ trvá ${(c.do - c.od).toFixed(2)} s, treba ${treba.toFixed(2)} s`);
  const d = K.TITULKY[i + 1];
  if (d && Math.abs(d.od - c.do) > 1e-9) chyby.push(`titulky nenadväzujú: ${c.do} a ${d.od}`);
});
let pred = -1;
for (const x of film.titulky) { if (x.od < pred) chyby.push(`titulky pre čítačky nie sú po sebe (${x.od})`); pred = x.od; }

// všetkých 14 okien okolo 60 % dĺžky, svetlušky až po nich; adresa dosadne 2,5 až 3,2 s pred koncom
if (K.SVETLA.size !== 14) chyby.push(`svieti ${K.SVETLA.size} domov namiesto 14`);
const podiel = K.T.vsetky / film.dlzka;
if (podiel < 0.55 || podiel > 0.65) chyby.push(`všetkých 14 okien svieti v ${(podiel * 100).toFixed(0)} % dĺžky, má okolo 60 %`);
if (Math.max(...K.SVETLA.values()) > K.T.vecer) chyby.push('okno sa rozsvieti až po podvečere');
{
  let dosadne = K.T.adresa;
  while (springStep(PRESETS.enter, dosadne - K.T.adresa) < 0.99) dosadne += 0.01;
  const poAdrese = film.dlzka - dosadne;
  if (poAdrese < 2.5 || poAdrese > 3.2) chyby.push(`po dosadnutí adresy (${dosadne.toFixed(2)} s) ostáva ${poAdrese.toFixed(2)} s, má 2,5 až 3,2 s`);
}

// pomlčky em a en
const POMLCKY = new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']');
for (const s of [...K.texty, ...film.titulky.map((x) => x.text)]) if (POMLCKY.test(s)) chyby.push(`pomlčka v texte filmu: „${s}“`);
for (const f of ['index.html', 'README.md']) {
  const p = path.join(TU, f);
  if (!fs.existsSync(p)) { chyby.push(`chýba ${f}`); continue; }
  citaj(p).split('\n').forEach((r, i) => { if (POMLCKY.test(r)) chyby.push(`pomlčka v ${f}:${i + 1}`); });
}

// fakty so zdrojom v súboroch hry
{
  const zoznam = JSON.parse(citaj(path.join(HRY_DIR, 'zoznam.json')));
  if (zoznam.length !== 14 || !zoznam.every((g) => g.hotove)) chyby.push('zoznam.json: nie je 14 hotových hier („14 daily logic puzzles“)');
  for (const d of K.T.domy) if (!zoznam.some((g) => g.kluc === d.kluc && g.nazov === d.kluc[0].toUpperCase() + d.kluc.slice(1))) chyby.push(`štítok ${d.kluc} nie je meno hry zo zoznam.json`);
  const hub = citaj(path.join(HRY_DIR, 'index.html'));
  for (const s of ['Fourteen games, a new puzzle every day.', 'Free, no account, no ads', 'Daily logic puzzles']) if (!hub.includes(s)) chyby.push(`games/index.html už nehovorí „${s}“ (zdroj vety „${'14 daily logic puzzles. Free.'}“)`);
  const zdroje = [
    ['moja.js', 'Solve a house’s puzzle today and its window lights up'],
    ['moja.js', 'okno: Object.freeze({ ms: 360, pruzina: \'snappy\' })'],
    ['moja.js', 'odstup: 140, vlna: 1400'],
    ['moja.js', 'Tomorrow starts dark again.'],
    ['svet.js', 'A NEW PUZZLE IN EVERY OPEN HOUSE, EVERY DAY'],
    ['index.html', 'or when all fourteen are lit.'],
    ['index.html', 'A solved puzzle lights its house until the day ends; tomorrow starts dark.'],
    ['index.html', 'Everything in the village is free.'],
    ['village.js', 'const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31, 33];'],
    ['village.js', '392 * Math.pow(2, semi / 12)'],
    ['village.js', 'o2.frequency.value = f * 4.02'],
    ['miesta.js', "if (eve) {\n    const spots"],
    // dĺžky scénok domov príbehu (DOHRA vo film.js) a prečo Magpies nie je v príbehu (tabuľa bliká aj bez scénky)
    ['miesta.js', "act('hedgehogs', t, 0.9, 0.9)"],
    ['miesta.js', 'function trace(k, P, closed, ink, w, delay = 0.5, dur = 1.4)'],
    ['miesta.js', "trace('swans', P, true, 'paper', 2.4)"],
    ['miesta.js', "const paths = [['pink', [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3]]], ['sun', [[1, 0], [1, 1], [1, 2], [2, 2], [2, 3], [3, 3]]], ['teal', [[2, 1], [2, 0], [3, 0], [3, 1], [3, 2]]]];"],
    ['miesta.js', "trace('herons', Q.map(([r, c]) => cell(r, c)), false, 'paper', 1.3, 0.5 + n * 0.45, 0.8)"],
    ['miesta.js', "((t / 2.4) % 1) < 0.62 || act('magpies', t) > 0.3"],
  ];
  for (const [f, s] of zdroje) if (!citaj(path.join(DEDINKA, f)).includes(s)) chyby.push(`${f} už neobsahuje „${s.slice(0, 60)}“ (zdroj filmu)`);
  // film importuje tú istú verziu modulov ako hra (inak by boli dve inštancie ACT, OPT a atramentov)
  const idx = citaj(path.join(DEDINKA, 'index.html')), vHry = (/village\.js\?v=(\d+)/.exec(idx) || [])[1];
  const zdrojFilmu = citaj(path.join(TU, 'film.js'));
  const verzie = [...zdrojFilmu.matchAll(/from '\.\.\/(\w+)\.js\?v=(\d+)'/g)].map((m) => m[2]);
  if (!vHry || verzie.length < 4 || verzie.some((v) => v !== vHry) || VERZIA_DEDINKY !== vHry) chyby.push(`verzia modulov dedinky: hra ?v=${vHry}, film ${[...new Set(verzie)].join(',')} (VERZIA_DEDINKY ${VERZIA_DEDINKY})`);
  for (const m of zdrojFilmu.matchAll(/from '\.\.\/(\w+)\.js\?v=\d+'/g)) if (!citaj(path.join(DEDINKA, m[1] + '.js')).includes(`from './riso.js?v=${vHry}'`) && m[1] !== 'riso') chyby.push(`${m[1]}.js neimportuje riso.js?v=${vHry}`);
  const stranka = citaj(path.join(TU, 'index.html'));
  for (const v of ['riso', 'iso', 'svet', 'miesta', 'moja']) if (!stranka.includes(`/games/village/${v}.js?v=${vHry}`)) chyby.push(`index.html filmu nemá modulepreload ${v}.js?v=${vHry}`);
  if (/zrno\(/.test(zdrojFilmu)) chyby.push('film.js ešte kreslí filmové zrno (tlač dedinky má vlastné)');
}

// stránka: po načítaní len celý ostrov, zvyšok tlače až po ťuknutí na Play (bez requestIdleCallback v Node)
{
  const [W, H] = [390, 693];
  film.vrstvy(W, H, 2, { render: false, slabe: false, dpr: 2, W, H });
  const pred = K.dlazdice(), zvysok = K.zvysokTlace();
  const ostre = pred.flatMap((svetlo) => svetlo.slice(1)).some((s) => !s.endsWith(':0'));
  if (ostre || !zvysok) chyby.push(`stránka: po načítaní sa tlačí viac než celý ostrov (${JSON.stringify(pred)}, zvyšok ${zvysok})`);
  film.dotlac();
  const koniec = Date.now() + 20000;
  while (K.zvysokTlace() && Date.now() < koniec) await new Promise((r) => setTimeout(r, 20));
  if (K.zvysokTlace()) chyby.push(`stránka: po ťuknutí ostalo ${K.zvysokTlace()} nevytlačených dlaždíc`);
  console.log(`stránka 390 x 693 pri DPR 2: po načítaní ${pred.map((s) => s.join('/')).join(' a ')} (celý ostrov), po ťuknutí ${K.dlazdice().map((s) => s.join('/')).join(' a ')}`);
  // počítač: tlač najviac 1,5 px na CSS px (plátno má DPR 2, dlaždice sa zväčšia); kreslenie bez chyby
  const [W2, H2] = [1200, 675], e2 = { render: false, slabe: false, dpr: 2, W: W2, H: H2 };
  film.vrstvy(W2, H2, 2, e2);
  film.dotlac();
  while (K.zvysokTlace() && Date.now() < koniec + 20000) await new Promise((r) => setTimeout(r, 20));
  const pl = new FalosnePlatno(W2 * 2, H2 * 2), c = pl.getContext('2d');
  try {
    for (const t of [0, 1, 2, 3.4, 5.5, 9.9, 11, 12.5, 14, 17]) { c.setTransform(2, 0, 0, 2, 0, 0); film.kresli(c, t, W2, H2, e2); if (c.zasobnik.length) chyby.push(`počítač t=${t}: save bez restore`); }
  } catch (err) { chyby.push('stránka na počítači: ' + err.stack.split('\n').slice(0, 3).join(' | ')); }
  const plat = K.dlazdice().flat().reduce((s, x) => s + Number(x.split(':')[0]), 0);
  if (plat > 100) chyby.push(`stránka na počítači drží ${plat} plátien tlače (najviac 100)`);
  console.log(`stránka 1200 x 675 pri DPR 2 (tlač 1,5): ${plat} plátien po 1 MB`);
}

const sek = ((Date.now() - zac) / 1000).toFixed(1);
if (chyby.length) {
  console.error(`\nZLYHALO: ${chyby.length} chýb (${sek} s)`);
  for (const e of chyby.slice(0, 60)) console.error(' - ' + e);
  process.exit(1);
}
console.log(`\nOK (${sek} s): ${FORMATY.length} formáty x ${casy.length} snímok, ${spolu} textov filmu v zóne, najmenšie písmo ${najmensie.toFixed(1)} px, ${ilustracie} nápisov tlače dedinky (kresba), determinizmus 18 časov na formát, slučka bez skoku, kamera bez prekmitu (stred najviac ${najrychlejsie.toFixed(1)} px za snímku), vlna ${K.VLNA.join(', ')}, všetkých 14 okien v ${K.T.vsetky.toFixed(2)} s (${((K.T.vsetky / film.dlzka) * 100).toFixed(1)} %), podvečer v ${K.T.vecer.toFixed(2)} s z okna ${K.VLNA[K.VLNA.length - 1]}, ${film.zvuk.length} zvukov (14 zvončekov okien)`);
