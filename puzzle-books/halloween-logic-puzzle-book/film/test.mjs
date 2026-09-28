// Test filmu Halloween Logic Puzzle Book bez prehliadača:
//   node test.mjs   (v priečinku products/arling-sk/puzzle-books/halloween-logic-puzzle-book/film)
//
// Falošné 2D plátno (prevzaté z testu filmu shop/pumpkin-escape-kids/film) zaznamená každé volanie. Film sa
// nakreslí pre časy 0 až koniec po 1/30 s vo všetkých štyroch formátoch a test overí:
//   1. žiadna výnimka (záporný polomer v arc/ellipse a zlý offset prechodu vyhodia chybu ako v prehliadači),
//   2. žiadne NaN ani nekonečno v súradniciach, rozmeroch a číselných vlastnostiach,
//   3. každý text (fillText aj text zapečený v sprite a zložený cez drawImage, s ohľadom na clip) leží
//      celý v zóne zona(W, H), s rezervou 0,5 px,
//   4. najmenšie písmo po všetkých transformáciách je aspoň minPismo(W, H) (36 px pri 1080),
//   5. texty sa neprekrývajú (aj vo vnútri spritov) a žiadny nie je napoly zamaskovaný (clip),
//   6. hák: na snímke 0 je HALLOWEEN, názov, veta a štítok s adresou obchodu (bez ceny); v 1,9 s už názov nie je,
//   7. slučka: posledná snímka skladá tie isté obrázky na tie isté miesta ako snímka 0 (do 1 px),
//   8. partitúra: konečné časy v [0, dĺžka], známe nástroje, zvuk od snímky 0,
//   9. titulky: čas čítania aspoň slová / 3 + 0,5 s, nadväzujú, bez pomlčiek em a en a bez naliehavosti,
//  10. riešiteľ: každý krok určí len políčka, ktoré sú isté (nezávislý výpočet všetkých 2^n riadkov),
//      posledný krok dá obrázok z knihy, moment (odhalenie) je okolo 60 % dĺžky a po poslednom kroku,
//  11. fakty sedia so zdrojmi: zadania.json (Nonogram 2, čísla, riešenie, 4 kapitoly po 20), obrazky.mjs,
//      kniha.mjs (tituly a ikony kapitol, strana 6 z 91, „exactly one solution“, „without guessing“),
//      etsy/ponuka.json (cena, 91 strán), stránka knihy (cena, 91 strán, odkaz na Etsy 4583729691),
//  12. stránka filmu index.html: fakty, jediná cena, jediný počet strán, žiadne pomlčky em a en,
//      žiadne nepodložené ani naliehavé tvrdenie, canonical, udalosti Umami s predponou.
//  Pokus 2 (kontrola ops/ai/kontrola/2026-09-28-film-halloween-kniha.md):
//  13. kolízia textu s tekvicou: žiadny viditeľný text (alfa nad 0,02) nezasahuje do obdĺžnika mriežky v žiadnej
//      snímke, ani počas zmenšenia do obsahu a rastu späť (film.kontrola.mriezka(t)),
//  14. záver: názov, krátka ponuka a adresa obchodu spolu v plnom kontraste (alfa 1) a na mieste aspoň 3 s pred
//      koncom slučky,
//  15. obsah knihy: všetky štyri riadky naraz v plnom kontraste a na mieste aspoň slová / 3 + 0,5 s,
//  16. nadpisy (HALLOWEEN a názov) na snímke 0 a v závere písmom ARLing Draw; plagát okolo 1,0 s s plne
//      čitateľným názvom, ponukou a adresou.
//  Pokus 3 (kontrola ops/ai/kontrola/2026-09-28-film-halloween-kniha-pokus2.md):
//   9b. každý titulok na plátne meraný po snímkach len v plnom kontraste (alfa aspoň 0,99) a na mieste, bez nábehu,
//       miznutia a vstupu: aspoň slová / 3 + 0,5 s,
//   15. (zmenené) titulok „20 each.“ a štyri riadky obsahu spolu v plnom kontraste aspoň 2,5 s.
//
// Čo test NEOVERUJE (kontrolné snímky s --zony, robí Fable):
//   - prekryv textu s kresbou (mesiac, netopiere) a skutočnú šírku písma: šírka je tu odhad (okolo 0,55 em
//     na znak) a rozloženie filmu meria text tou istou funkciou, takže kontrola šírky je kruhová.

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
    const r = this._orez({ t: String(text), x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), px: px * this._mierka(), skupina: ++skupiny, a: this.num.globalAlpha, font: this.s.font });
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
      const z = this._orez({ t: r.t, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), px: r.px * Math.sqrt(Math.abs(kx * ky)) * m, orezany: r.orezany, skupina, zdroj: img, a: (r.a ?? 1) * this.num.globalAlpha, font: r.font });
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

// ---------- test kreslenia ----------

const FORMATY = [[1080, 1920], [1920, 1080], [1080, 1080], [1080, 1350]];
const REZERVA = 0.5;
const { default: film, FAKTY, riesKrokmi } = await import('./film.js');
await film.pripravit({ render: true });

let spolu = 0, najmensie = Infinity;
const vysledky = [];
function prekryv(a, b) {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  return w > 1 && h > 1;
}
function over(W, H, casy) {
  const Z = zona(W, H), mp = minPismo(W, H);
  const env = { render: true, slabe: false, dpr: 1, W, H };
  PLATNA.length = 0;
  film.vrstvy(W, H, 1, env);
  for (const p of PLATNA) for (let i = 0; i < p.texty.length; i++) for (let j = i + 1; j < p.texty.length; j++) {
    if (p.texty[i].t === p.texty[j].t) continue; // tieň toho istého riadku pod ním
    if (prekryv(p.texty[i], p.texty[j])) chyby.push(`${W}x${H} sprite: texty sa prekrývajú „${p.texty[i].t}“ a „${p.texty[j].t}“`);
  }
  const hlavne = new FalosnePlatno(W, H);
  const ctx = hlavne.getContext('2d');
  const snimky = [];
  let n = 0, min = Infinity, zle = 0;
  const chyba = (s) => { chyby.push(`${W}x${H} ${s}`); zle++; };
  const textyV = (t) => { hlavne.texty = []; ctx.setTransform(1, 0, 0, 1, 0, 0); film.kresli(ctx, t, W, H, env); return hlavne.texty.map((r) => r.t); };
  for (const t of casy) {
    hlavne.texty = [];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    try { film.kresli(ctx, t, W, H, env); } catch (e) { chyba(`t=${t.toFixed(3)}: ${e.message}`); if (zle > 12) break; continue; }
    if (ctx.zasobnik.length) { chyba(`t=${t.toFixed(3)}: save bez restore (${ctx.zasobnik.length})`); ctx.zasobnik.length = 0; }
    const T = hlavne.texty;
    snimky.push({ t, texty: T });
    // 13. kolízia textu s tekvicou (mriežka so svietiacou tekvicou, aj pri zmenšení a raste)
    const M = film.kontrola.mriezka(t);
    for (const r of T) if (r.a > 0.02 && prekryv(r, M)) chyba(`t=${t.toFixed(3)}: text „${r.t}“ zasahuje do mriežky s tekvicou`);
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
      if (T[i].skupina === T[j].skupina) continue; // riadky jedného spritu (overené vyššie v jeho súradniciach)
      if (T[i].t === T[j].t && T[i].zdroj && T[i].zdroj === T[j].zdroj) continue;
      if (prekryv(T[i], T[j])) chyba(`t=${t.toFixed(3)}: texty sa prekrývajú „${T[i].t}“ a „${T[j].t}“`);
    }
    if (zle > 12) break;
  }
  for (const o of film.odkazy(W, H)) {
    cislo('odkaz', o.x, o.y, o.w, o.h);
    if (o.x < Z.x0 - 1 || o.x + o.w > Z.x1 + 1 || o.y < Z.y0 - 1 || o.y + o.h > Z.y1 + 1) chyby.push(`${W}x${H}: odkaz mimo zóny ${JSON.stringify(o)}`);
    if (!o.href.startsWith('https://www.etsy.com/listing/4583729691')) chyby.push(`${W}x${H}: odkaz štítka nevedie priamo na ponuku Etsy 4583729691 (${o.href})`);
  }
  cislo('stredPlagatu', ...film.stredPlagatu(W, H));
  // hák: snímka 0 ukazuje HALLOWEEN, názov, vetu a štítok; v 1,9 s (koniec háku) už názov nie je
  const t0 = textyV(0), tPo = textyV(1.9), t0spolu = t0.join(' ');
  const ZV = film.kontrola.zaver;
  if (ZV.veta !== `${FAKTY.pocet} printable puzzles, PDF`) chyby.push(`ponuka „${ZV.veta}“ nie je krátka ponuka s počtom ${FAKTY.pocet}`);
  for (const s of ['Logic Puzzle Book', ZV.veta, FAKTY.adresa]) if (!t0spolu.includes(s)) chyby.push(`${W}x${H} hák: na snímke 0 chýba „${s}“`);

  // 14. záver: názov, ponuka a adresa spolu v plnom kontraste a na mieste (veta a štítok na polohe poslednej snímky)
  const najdi = (sn, text) => sn.texty.find((r) => r.t === text);
  const koniec = snimky[snimky.length - 1];
  const naMieste = (r, ref) => r && ref && Math.abs(r.x0 - ref.x0) <= 1 && Math.abs(r.y0 - ref.y0) <= 1 && Math.abs(r.x1 - ref.x1) <= 1 && Math.abs(r.y1 - ref.y1) <= 1;
  const zaverOk = (sn) => {
    const n = najdi(sn, ZV.nazov), v = najdi(sn, ZV.veta), c = najdi(sn, ZV.chip);
    return n && n.a >= 0.99 && v && v.a >= 0.99 && c && c.a >= 0.99 && naMieste(v, najdi(koniec, ZV.veta)) && naMieste(c, najdi(koniec, ZV.chip));
  };
  if (Math.abs(koniec.t - film.dlzka) > 1e-9) chyby.push(`${W}x${H} záver: posledná vzorka nie je koniec filmu`);
  let i0 = snimky.length - 1;
  while (i0 > 0 && zaverOk(snimky[i0 - 1])) i0--;
  const zaverS = zaverOk(koniec) ? film.dlzka - snimky[i0].t : 0;
  if (zaverS < 3 - 1e-6) chyby.push(`${W}x${H} záver: názov, ponuka a adresa spolu v plnom kontraste len ${zaverS.toFixed(2)} s (treba aspoň 3 s)`);

  // 9b (pokus 3). titulky na plátne: čas čítania len v plnom kontraste (alfa aspoň 0,99) a na mieste (do 1 px
  // od polohy v strede titulku), bez nábehu, miznutia a vstupu zdola; najdlhší súvislý beh snímok
  const slovA = (s) => s.split(/\s+/).filter(Boolean).length;
  const beh = (ok) => { let b = 0, naj = 0; for (const sn of snimky) { b = ok(sn) ? b + 1 : 0; naj = Math.max(naj, b); } return Math.max(0, naj - 1) * krok; };
  const TIT = film.kontrola.titulky, PLATNA_TIT = film.kontrola.titulkyPlatna();
  const casyTit = [];
  const titulokPlny = TIT.map((tt, i) => {
    const c = PLATNA_TIT[i], kusy = (sn) => sn.texty.filter((r) => r.zdroj === c);
    const ref = kusy(snimky.reduce((a, b) => (Math.abs(b.t - (tt.od + tt.do) / 2) < Math.abs(a.t - (tt.od + tt.do) / 2) ? b : a)));
    return (sn) => { const k = kusy(sn); return ref.length > 0 && k.length === ref.length && k.every((r, j) => r.a >= 0.99 && naMieste(r, ref[j])); };
  });
  TIT.forEach((tt, i) => {
    const s = beh(titulokPlny[i]), treba = slovA(tt.text) / 3 + 0.5;
    casyTit.push({ text: tt.text, s, treba });
    if (s < treba - 1e-6) chyby.push(`${W}x${H} titulok „${tt.text}“ v plnom kontraste ${s.toFixed(2)} s, treba ${treba.toFixed(2)} s`);
  });

  // 15. obsah knihy: titulok „20 each.“ a všetky štyri riadky naraz v plnom kontraste a na mieste, spolu aspoň
  // 2,5 s a aspoň slová / 3 + 0,5 s za titulok a zoznam dohromady (kontrola pokus 2, nález 2)
  const KAP = film.kontrola.kapitoly, iKap = TIT.findIndex((tt) => tt.sKapitolami);
  if (iKap < 0) chyby.push('obsah knihy: žiadny titulok nepatrí k zoznamu druhov');
  const trebaKap = Math.max(2.5, (slovA(KAP.join(' ')) + (iKap >= 0 ? slovA(TIT[iKap].text) : 0)) / 3 + 0.5);
  const kapRef = snimky.filter((sn) => KAP.every((k) => najdi(sn, k)?.a >= 0.99)).pop();
  const kapS = beh((sn) => kapRef && iKap >= 0 && titulokPlny[iKap](sn) && KAP.every((k) => { const r = najdi(sn, k); return r && r.a >= 0.99 && naMieste(r, najdi(kapRef, k)); }));
  if (kapS < trebaKap - 1e-6) chyby.push(`${W}x${H} obsah knihy: titulok a štyri riadky spolu čitateľné ${kapS.toFixed(2)} s, treba ${trebaKap.toFixed(2)} s`);

  // 16. nadpisy písmom ARLing Draw (snímka 0 a záver), plagát okolo 1,0 s plne čitateľný
  const DRAWP = film.kontrola.pismoNadpisu;
  for (const sn of [snimky[0], snimky[i0], koniec]) {
    const n = najdi(sn, ZV.nazov), k = sn.texty.filter((r) => n && r.zdroj === n.zdroj && r.t.length === 1);
    if (!n || !n.font.includes(DRAWP)) chyby.push(`${W}x${H} t=${sn.t.toFixed(2)}: názov nie je písmom ${DRAWP} (${n && n.font})`);
    if (k.length < 9 || !k.every((r) => r.font.includes(DRAWP))) chyby.push(`${W}x${H} t=${sn.t.toFixed(2)}: HALLOWEEN nie je písmom ${DRAWP}`);
  }
  if (!(film.plagat >= 0.8 && film.plagat <= 1.15)) chyby.push(`plagát ${film.plagat} s nie je okolo 1,0 s`);
  const snP = snimky.reduce((a, b) => (Math.abs(b.t - film.plagat) < Math.abs(a.t - film.plagat) ? b : a));
  for (const s of [ZV.nazov, ZV.veta, ZV.chip]) if (!(najdi(snP, s)?.a >= 0.99)) chyby.push(`${W}x${H} plagát ${film.plagat} s: „${s}“ nie je v plnom kontraste`);
  vysledky.push({ W, H, zaverS, kapS, trebaKap, casyTit });
  if (/€|\d\.\d\d/.test(t0spolu)) chyby.push(`${W}x${H} hák: na snímke 0 je cena (Etsy ukazuje cenu v mene diváka, cena len na stránke)`);
  if (!t0.join('').includes('HALLOWEEN')) chyby.push(`${W}x${H} hák: na snímke 0 chýba HALLOWEEN`);
  if (tPo.includes('Logic Puzzle Book')) chyby.push(`${W}x${H} hák: názov je ešte v 1,9 s`);
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

if (film.dlzka < 15 || film.dlzka > 20) chyby.push(`dĺžka ${film.dlzka} s mimo 15 až 20 s`);
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
  const treba = slova / 3 + 0.5, plny = c.do - c.od - 2 * film.kontrola.prechod;
  if (plny < treba - 1e-6) chyby.push(`titulok „${c.text}“ má bez prechodov ${plny.toFixed(2)} s, treba ${treba.toFixed(2)} s`);
  if (i && Math.abs(tit[i - 1].do - c.od) > 1e-9) chyby.push(`titulky nenadväzujú pri ${c.od} s`);
});
let pred = -1;
for (const x of film.titulky) { if (x.od < pred) chyby.push(`titulky pre čítačky nie sú po sebe (${x.od})`); pred = x.od; }
const vsetkyTexty = [...film.titulky.map((x) => x.text), ...film.kontrola.texty];
const POMLCKY = new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']'); // en a em pomlčka
const NALIEHAVE = /\b(best|bestsell\w*|hurry|only today|last chance|buy now|limited|kids love|everyone loves|tested with|award\w*)\b|#1/i;
for (const s of vsetkyTexty) {
  if (POMLCKY.test(s)) chyby.push(`pomlčka v texte: „${s}“`);
  if (NALIEHAVE.test(s)) chyby.push(`nepodložené alebo naliehavé tvrdenie: „${s}“`);
}

// ---------- riešiteľ a moment ----------

const H2 = FAKTY.hadanka, N = H2.n, K = film.kontrola;
// nezávislá kontrola: všetky 2^n riadky, ktoré sedia s číslami a so známymi políčkami
const behy = (a) => { const o = []; let k = 0; for (const v of a) { if (v) k++; else if (k) { o.push(k); k = 0; } } if (k) o.push(k); return o; };
const VSETKY = Array.from({ length: 1 << N }, (_, m) => Array.from({ length: N }, (_, k) => (m >> k) & 1));
const g = new Array(N * N).fill(-1);
let posledny = -Infinity;
for (const [i, k] of K.kroky.entries()) {
  const idx = Array.from({ length: N }, (_, j) => (k.typ === 'r' ? k.i * N + j : j * N + k.i));
  const clue = k.typ === 'r' ? H2.rows[k.i] : H2.cols[k.i];
  const zname = idx.map((j) => g[j]);
  const mozne = VSETKY.filter((a) => JSON.stringify(behy(a)) === JSON.stringify(clue) && a.every((v, j) => zname[j] < 0 || zname[j] === v));
  if (!mozne.length) { chyby.push(`riešiteľ: krok ${i} nemá žiadnu možnosť`); break; }
  for (const [j, v] of k.nove) {
    const p = idx.indexOf(j);
    if (p < 0 || zname[p] >= 0) chyby.push(`riešiteľ: krok ${i} určuje políčko ${j} mimo svojho riadku alebo znova`);
    else if (!mozne.every((a) => a[p] === v)) chyby.push(`riešiteľ: krok ${i} hádal políčko ${j}`);
    if (K.riesenie[j] !== v) chyby.push(`riešiteľ: krok ${i} dal políčku ${j} hodnotu ${v}, obrázok ${K.riesenie[j]}`);
    g[j] = v;
  }
  if (!(k.t > posledny)) chyby.push(`riešiteľ: krok ${i} nie je po predchádzajúcom`);
  posledny = k.t;
}
if (g.includes(-1)) chyby.push('riešiteľ: po poslednom kroku ostali neurčené políčka');
if (JSON.stringify(riesKrokmi(H2.rows, H2.cols, N).g) !== JSON.stringify(K.riesenie)) chyby.push('riešiteľ: iný výsledok ako obrázok');
const podiel = K.T.odhal / film.dlzka;
if (podiel < 0.55 || podiel > 0.65) chyby.push(`moment v ${K.T.odhal} s je ${Math.round(podiel * 100)} % dĺžky, má byť okolo 60 %`);
if (posledny + 0.35 > K.T.odhal) chyby.push('moment prichádza skôr, ako riešiteľ dokončí posledný krok');
if (K.T.riesOd < 1.9) chyby.push('riešenie začína ešte počas háku');

// ---------- fakty so zdrojmi ----------

const KOREN = new URL('../../../../../', import.meta.url);
const rovne = (a, b, co) => { if (JSON.stringify(a) !== JSON.stringify(b)) chyby.push(`fakt ${co}: film ${JSON.stringify(a)}, zdroj ${JSON.stringify(b)}`); };
const data = JSON.parse(readFileSync(new URL('products/hlavolamy-halloween/zadania.json', KOREN), 'utf8'));
rovne(FAKTY.pocet, data.kapitoly.reduce((a, k) => a + k.zoznam.length, 0), 'počet hlavolamov (zadania.json)');
rovne(FAKTY.kapitoly.map(() => FAKTY.naKapitolu), data.kapitoly.map((k) => k.zoznam.length), 'hlavolamov na kapitolu (zadania.json)');
rovne(FAKTY.kapitoly.map((k) => k.druh), data.kapitoly.map((k) => k.druh), 'druhy kapitol (zadania.json)');
const z2 = data.kapitoly[0].zoznam.find((z) => z.cislo === H2.cislo);
rovne(H2.druh, data.kapitoly[0].druh, 'druh hádanky');
rovne(H2.uroven, z2 && z2.uroven, 'úroveň Nonogramu 2 (zadania.json)');
rovne(H2.n, z2 && z2.p.n, 'rozmer Nonogramu 2');
rovne(H2.meno, z2 && z2.p.meno, 'meno obrázka Nonogramu 2');
rovne(H2.rows, z2 && z2.p.clues.rows, 'čísla riadkov Nonogramu 2');
rovne(H2.cols, z2 && z2.p.clues.cols, 'čísla stĺpcov Nonogramu 2');
rovne(K.riesenie, z2 && z2.p.solution, 'riešenie Nonogramu 2');
const OBR = await import(new URL('products/hlavolamy-halloween/obrazky.mjs', KOREN).href);
rovne(H2.riadky, OBR.OBRAZKY.find((o) => o.meno === H2.meno)?.riadky, 'obrázok Pumpkin (obrazky.mjs)');
const KN = await import(new URL('products/hlavolamy-halloween/kniha.mjs', KOREN).href);
rovne(FAKTY.kapitoly.map((k) => k.titul), data.kapitoly.map((k) => KN.TEXTY[k.hra].titul), 'tituly kapitol (kniha.mjs TEXTY)');
rovne(FAKTY.kapitoly.map((k) => k.ikona), data.kapitoly.map((k) => KN.TEXTY[k.hra].ikona), 'ikony kapitol (kniha.mjs TEXTY)');
rovne(FAKTY.nazov, KN.NAZOV, 'názov knihy (kniha.mjs NAZOV)');
const strany = KN.rozvrh(data);
const s2 = strany.find((x) => x.druh === 'zadania' && x.kap.hra === 'magpies' && x.kus.some((z) => z.cislo === H2.cislo));
rovne(FAKTY.strana, s2 && s2.cislo, 'strana Nonogramu 2 (kniha.mjs rozvrh)');
rovne(FAKTY.stran, strany.length, 'počet strán (kniha.mjs rozvrh)');
const knihaSrc = readFileSync(new URL('products/hlavolamy-halloween/kniha.mjs', KOREN), 'utf8');
for (const s of ['Every puzzle has exactly one solution', 'line by line, without guessing']) if (!knihaSrc.includes(s)) chyby.push(`fakt: kniha.mjs neobsahuje „${s}“`);
const ponuka = JSON.parse(readFileSync(new URL('products/hlavolamy-halloween/etsy/ponuka.json', KOREN), 'utf8'));
rovne(FAKTY.cena, ponuka.price.listing_eur.toFixed(2), 'cena (etsy/ponuka.json price.listing_eur)');
if (!ponuka.description.includes(`(${FAKTY.stran} pages)`)) chyby.push('fakt: počet strán nesedí s popisom Etsy ponuky');
const knihaStranka = readFileSync(new URL('products/arling-sk/puzzle-books/halloween-logic-puzzle-book/index.html', KOREN), 'utf8');
for (const s of [`"price": "${FAKTY.cena}"`, `${FAKTY.stran} pages`, 'etsy.com/listing/4583729691', '20 Nonograms, 20 Hashi, 20 Kakuro, 20 Slitherlink']) {
  if (!knihaStranka.includes(s)) chyby.push(`fakt: stránka knihy neobsahuje „${s}“`);
}
// štítok: adresa obchodu na Etsy (priamy cieľ, v Shorte sa nedá kliknúť), cena vo filme nie je
const zas = readFileSync(new URL('ops/social/zasobnik-q4.mjs', KOREN), 'utf8');
const obchod = /ETSY_OBCHOD\s*=\s*'https:\/\/([^/']+)\/?'/.exec(zas);
rovne(FAKTY.adresa, obchod && obchod[1], 'adresa obchodu na Etsy (ops/social/zasobnik-q4.mjs ETSY_OBCHOD)');
for (const s of [...film.kontrola.texty, ...film.titulky.map((x) => x.text)]) {
  if (/€|\beuros?\b|\bEUR\b|arling\.sk\/puzzle-books/.test(s)) chyby.push(`film: text „${s}“ má cenu alebo starú adresu (cena len na stránke filmu)`);
}
if (!FAKTY.url.startsWith('https://www.etsy.com/listing/4583729691') || !knihaStranka.includes('etsy.com/listing/4583729691')) chyby.push('fakt: odkaz filmu nie je ponuka Etsy zo stránky knihy');

// ---------- stránka filmu (index.html) ----------

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const textStranky = html
  .replace(/<header[\s\S]*?<\/header>/, ' ').replace(/<footer[\s\S]*?<\/footer>/, ' ').replace(/<aside[\s\S]*?<\/aside>/, ' ')
  .replace(/<script(?![^>]*ld\+json)[\s\S]*?<\/script>/g, ' ')
  .replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ');
const metaTexty = [...html.matchAll(/<meta (?:name|property)="(?:description|og:[a-z]+)" content="([^"]*)"/g)].map((m) => m[1]);
const strankaVsetko = [textStranky, ...metaTexty].join('\n');
for (const s of [`${FAKTY.pocet} logic puzzles`, `${FAKTY.stran} pages`, 'A4', 'US Letter', `${FAKTY.cena} €`, `page ${FAKTY.strana}`, 'Nonogram 2', 'Etsy']) {
  if (!strankaVsetko.includes(s)) chyby.push(`index.html: chýba fakt „${s}“`);
}
for (const m of strankaVsetko.matchAll(/\b(\d+(?:\.\d+)?)\s*(?:€|EUR\b|euros?\b)/g)) if (m[1] !== FAKTY.cena) chyby.push(`index.html: iná cena ${m[1]}`);
for (const m of strankaVsetko.matchAll(/\b(\d+) pages\b/g)) if (Number(m[1]) !== FAKTY.stran) chyby.push(`index.html: iný počet strán ${m[1]}`);
if (POMLCKY.test(strankaVsetko)) chyby.push('index.html: pomlčka em alebo en');
if (NALIEHAVE.test(strankaVsetko)) chyby.push(`index.html: nepodložené alebo naliehavé tvrdenie „${strankaVsetko.match(NALIEHAVE)[0]}“`);
if (!html.includes('<link rel="canonical" href="https://arling.sk/puzzle-books/halloween-logic-puzzle-book/film/">')) chyby.push('index.html: canonical');
if (!/src="\/puzzle-books\/halloween-logic-puzzle-book\/film\/strana\.js/.test(html)) chyby.push('index.html: chýba strana.js filmu');
for (const m of html.matchAll(/data-umami-event="([^"]+)"/g)) if (!/^(halloween_book_film_|shell_)/.test(m[1])) chyby.push(`index.html: udalosť ${m[1]} nemá predponu halloween_book_film_`);

if (chyby.length) {
  console.error(`\nZLYHALO: ${chyby.length} chýb`);
  for (const e of chyby.slice(0, 40)) console.error(' - ' + e);
  process.exit(1);
}
for (const v of vysledky) {
  console.log(`${v.W}x${v.H}: záver v plnom kontraste ${v.zaverS.toFixed(2)} s (min 3), titulok a obsah knihy spolu ${v.kapS.toFixed(2)} s (min ${v.trebaKap.toFixed(2)})`);
  console.log('  titulky v plnom kontraste: ' + v.casyTit.map((c) => `„${c.text}“ ${c.s.toFixed(2)} (min ${c.treba.toFixed(2)})`).join(', '));
}
console.log(`\nOK: ${FORMATY.length} formáty x ${vsetky.length} snímok, ${spolu} textov, najmenšie písmo ${najmensie.toFixed(1)} px, ${film.zvuk.length} zvukov, ${K.kroky.length} krokov riešiteľa bez hádania, moment v ${K.T.odhal} s (${Math.round(podiel * 100)} %), fakty sedia so zdrojmi`);
