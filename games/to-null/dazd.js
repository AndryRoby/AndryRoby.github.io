// TO: NULL: dážď vlastných glyfov, vypálená vrstva, glitch, premena LEXICON a karta aktu na jednom canvase (SPEC 3.7, 3.8, 4).
// V snímke len drawImage z atlasu (atlas vzniká raz pri štarte a pri zmene témy). Žiadne fillText, shadowBlur,
// getImageData, filter ani globalAlpha; žiadne alokácie v ceste snímky (stĺpce sú typované polia vopred).

import { GLYFY, POCET_SLUZ, CISLICE, INDEX, PRAZDNY, glyfZnaku } from './glyfy.mjs';
import { TEMY, odtiene, rgb } from './temy.mjs';
import { LIST } from './ekonomika.mjs';
import { LISTY } from './listy.mjs';
import { springStep, PRESETS } from './pohyb.js';

export const V = { HEAD: 0, S0: 1, S1: 2, S2: 3, S3: 4, S4: 5, S5: 6, S6: 7, S7: 8, KEEPER: 9, GLOW: 10, LETTER: 11, TEXT: 12, HOT: 13, BG: 14 };
const NV = 15;
export const SOLID = GLYFY.length;
export const MAX_KRESIEB = 1300;
export const KROK = 1000 / 30;
const LETY = 12;

function xs(seed) {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    return x / 4294967296;
  };
}

/** Zalomenie textu po slovách na šírku w znakov. */
export function zalom(text, w) {
  const out = [];
  let r = '';
  for (const slovo of text.split(' ')) {
    if (!r.length) r = slovo;
    else if (r.length + 1 + slovo.length <= w) r += ' ' + slovo;
    else { out.push(r); r = slovo; }
  }
  if (r.length) out.push(r);
  return out;
}

export class Dazd {
  constructor(canvas, o = {}) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.doc = o.doc || (typeof document !== 'undefined' ? document : null);
    this.rnd = xs(o.seed || 12345);
    this.rndO = xs(((o.seed || 12345) ^ 0x5bd1e995) >>> 0);
    this.reduced = !!o.reduced;
    this.tema = 'green';
    this.cols = 0; this.rows = 0; this.aktivne = 0; this.pocetKresieb = 0; this.pozadovane = 0;
    // záchranný režim výkonu (SPEC 3.8): 24 krokov za sekundu a stopy × 0,7
    this.usporny = false; this.krokMs = KROK; this.stopyK = 1;
    this.akt = 1; this.procesy = { hook: 0, sieve: 0, thread: 0 };
    this.tma = 0; this.flood = false; this.glitchK = 0;
    this.burn = { lines: 0, cells: 0, lex: false, dark: false, shown: 0, dirty: true, koniec: -1 };
    this.slovo = null;
    this.krokT = 0; this.kroky = 0;
    this.lety = [];
    for (let i = 0; i < LETY; i++) this.lety.push({ on: false, g: 0, x0: 0, y0: 0, x1: 0, y1: 0, t0: 0, dur: 350 });
    this.glitch = { do: 0, pasy: 0, y: new Int16Array(3), h: new Int8Array(3), off: 0, dalsi: 0 };
    this.lex = null;
    this.karta = null;
    this.chyt3 = null;
    this.mrznutie = false;
    this.bleskZnacky = 0;
    this.novyHak = -1e9;
    this.burnInit = false;
    this.burnVidno = true;
    this.onGlitch = null;
    this.onLexKoniec = null;
    // kolo oprav 2: pri zníženom pohybe sa kreslí len pri zmene (spinavy) alebo počas krátkeho okna po udalosti (spinavyDo)
    this.spinavy = true;
    this.spinavyDo = 0;
    this.textyHotove = false;
    // pomocné polia premeny LEXICON (bez alokácií v snímke)
    this._diff = new Int8Array(35);
    this._flip = new Uint8Array(35);
  }

  /** Treba kresliť? (znížený pohyb: len pri zmene alebo v okne po udalosti). */
  potrebaKresby(teraz) {
    return this.spinavy || this.burn.dirty || teraz < this.spinavyDo || !!this.chyt3 || !!this.karta;
  }

  _okno(teraz, ms) { this.spinavy = true; this.spinavyDo = Math.max(this.spinavyDo, teraz + ms); }

  nastavProcesy(hook, sieve, thread) {
    const p = this.procesy;
    if (p.hook !== hook || p.sieve !== sieve || p.thread !== thread) { p.hook = hook; p.sieve = sieve; p.thread = thread; this.spinavy = true; }
  }

  nastavTmu(v) {
    if ((v > 0.5) !== (this.tma > 0.5) || (v > 0) !== (this.tma > 0)) this.spinavy = true;
    this.tma = v;
  }

  nastavFlood(on) {
    if (this.flood !== !!on) { this.flood = !!on; this.spinavy = true; }
  }

  // ------------------------------------------------------------ rozmery a atlas

  /**
   * Mierka canvasu: pomer zariadenie / canvas je vždy celé číslo, aby bodové glyfy ostali ostré
   * (DPR ≤ 2 → mierka = DPR, pomer 1; DPR 3 → 1,5, pomer 2 s image-rendering: pixelated).
   */
  static mierka(dpr0) {
    const d = Math.max(1, Math.min(4, dpr0 || 1));
    return d / Math.ceil(d / 2 - 1e-9);
  }

  velkost(wCss, hCss, telefon, dpr0) {
    const dpr = Dazd.mierka(dpr0);
    this.dpr = dpr;
    this.cw = telefon ? 14 : 15;
    this.chC = telefon ? 18 : 20;
    this.tw = Math.round(this.cw * dpr);
    this.th = Math.round(this.chC * dpr);
    this.dot = Math.max(1, Math.round(2 * dpr));
    this.wCss = Math.max(1, Math.floor(wCss));
    this.hCss = Math.max(1, Math.floor(hCss));
    this.W = Math.round(this.wCss * dpr);
    this.H = Math.round(this.hCss * dpr);
    // stĺpce a riadky z rozmerov v zariadeniových px (tw je zaokrúhlené, krajné stĺpce sa nesmú orezať)
    const cols = Math.max(4, Math.floor(this.W / this.tw));
    const rows = Math.max(8, Math.floor(this.H / this.th));
    const noveStlpce = cols !== this.cols || !this.y;
    const stareRiadky = this.rows;
    const noveRiadky = rows !== this.rows;
    this.cols = cols;
    this.rows = rows;
    this.x0 = Math.floor((this.W - cols * this.tw) / 2);
    this.cv.width = this.W;
    this.cv.height = this.H;
    if (this.cv.style && this.cv.style.setProperty) {
      this.cv.style.setProperty('width', this.wCss + 'px');
      this.cv.style.setProperty('height', this.hCss + 'px');
    }
    this._atlas();
    this._vrstvy();
    // zmena len výšky (lišta attention, CARRY THEM, otočenie bez zmeny šírky): stĺpce si nechajú y a stopu, dážď neskočí
    if (noveStlpce) this._stlpce();
    else if (noveRiadky) this._riadky(stareRiadky);
    this._okolieKresli();
    this.burn.dirty = true;
    // zmena rozmeru počas momentu LEXICON: texty a zamrznuté stĺpce sa pripravia znova (inak by Akt III ukázal glyf 0)
    if (this.lex) this._lexPrepocitaj();
    if (this.akt === 3) this._textPrekresli();
    this.spinavy = true;
  }

  /** Nový počet riadkov pri rovnakých stĺpcoch: bunky a vety sa skopírujú, nové riadky sa doplnia. */
  _riadky(stare) {
    const n = this.cols;
    const r = this.rows;
    const b = new Uint8Array(n * r);
    for (let c = 0; c < n; c++) for (let i = 0; i < r; i++) b[c * r + i] = i < stare ? this.bunky[c * stare + i] : this._nahodnyGlyf();
    this.bunky = b;
    const w = n + 1;
    const t = new Uint8Array(w * (r + 1)).fill(PRAZDNY);
    t.set(this.text.subarray(0, Math.min(this.text.length, t.length)));
    this.text = t;
    this.mrazene = new Uint8Array(n * r).fill(PRAZDNY);
    const rv = [];
    for (let i = 0; i <= r; i++) rv.push(i <= stare && this.riadkyViet[i] ? this.riadkyViet[i] : this.textyHotove ? this._riadokViet(i, true) : []);
    this.riadkyViet = rv;
    this._burnRozlozenie();
  }

  _canvas(w, h) {
    const c = this.doc.createElement('canvas');
    c.width = Math.max(1, w);
    c.height = Math.max(1, h);
    return c;
  }

  _stlpce() {
    const n = this.cols;
    const r = this.rows;
    this.y = new Float32Array(n);
    this.spd = new Float32Array(n);
    this.stopa = new Uint8Array(n);
    this.mraz = new Float64Array(n);
    this.blesk = new Float64Array(n);
    this.hlava = new Float64Array(n);
    this.start = new Float64Array(n);
    this.akt1 = new Uint8Array(n);
    this.bunky = new Uint8Array(n * r);
    this.oy = new Float32Array(n);
    this.ospd = new Float32Array(n);
    this.olen = new Uint8Array(n);
    for (let c = 0; c < n; c++) this._okolieNove(c, true);
    this.text = new Uint8Array((n + 1) * (r + 1)).fill(PRAZDNY);
    this.textyHotove = false;
    this.mrazene = new Uint8Array(n * r).fill(PRAZDNY);
    this.poradie = this._poradie(n);
    this.rank = new Int16Array(n);
    for (let i = 0; i < n; i++) this.rank[this.poradie[i]] = i;
    for (let c = 0; c < n; c++) { this._novyStlpec(c, true); }
    for (let i = 0; i < this.bunky.length; i++) this.bunky[i] = this._nahodnyGlyf();
    this.riadkyViet = [];
    for (let i = 0; i <= r; i++) this.riadkyViet.push([]);
    this._burnRozlozenie();
    this.nastavStlpce(this.aktivne, 0);
  }

  /** Poradie aktivácie stĺpcov: prvých 6 rovnomerne, potom vždy do najväčšej medzery. */
  _poradie(n) {
    const out = [];
    const used = new Uint8Array(n);
    const prvych = Math.min(6, n);
    for (let i = 0; i < prvych; i++) {
      const c = Math.min(n - 1, Math.floor(((i + 0.5) * n) / prvych));
      if (!used[c]) { used[c] = 1; out.push(c); }
    }
    while (out.length < n) {
      let best = -1;
      let bd = -1;
      for (let c = 0; c < n; c++) {
        if (used[c]) continue;
        let d = n;
        for (const o of out) d = Math.min(d, Math.abs(o - c));
        if (d > bd) { bd = d; best = c; }
      }
      used[best] = 1;
      out.push(best);
    }
    return out;
  }

  _nahodnyGlyf() {
    return this.rnd() < 0.85 ? Math.floor(this.rnd() * POCET_SLUZ) : CISLICE[Math.floor(this.rnd() * 10)];
  }

  _novyStlpec(c, prvy) {
    this.spd[c] = 7 + this.rnd() * 6;
    this.stopa[c] = 10 + Math.floor(this.rnd() * 9);
    this.y[c] = prvy ? this.rnd() * this.rows : -this.rnd() * this.rows * 0.5;
  }

  // okolitý dážď (vizuálne kolo 3): tlmený prúd v každom stĺpci, tmavé odtiene, bez hlavy a žiary, 2,5 až 6 buniek/s,
  // nechytateľný; predkreslené plátno (štart, rozmer, téma), v snímke najviac 2 drawImage na stĺpec
  _okolieNove(c, prvy) {
    const R = this.rows;
    this.ospd[c] = 2.5 + this.rndO() * 3.5;
    this.olen[c] = 6 + Math.floor(this.rndO() * 11);
    this.oy[c] = prvy ? this.rndO() * (R + this.olen[c]) : -this.rndO() * R * 0.3;
  }

  _okolieKresli() {
    if (!this.atlas || !this.cols) return;
    const n = this.cols;
    const R = this.rows;
    const tw = this.tw;
    const th = this.th;
    if (!this.okolieCv || this.okolieCv.width !== n * tw || this.okolieCv.height !== 2 * R * th) this.okolieCv = this._canvas(n * tw, 2 * R * th);
    const x = this.okolieCv.getContext('2d');
    x.clearRect(0, 0, this.okolieCv.width, this.okolieCv.height);
    // čelo a chvost: pri bode 2 px (svieti štvrtina plochy) S4 a S5, inak S5 a S6
    const vc = this.dot <= 2 ? V.S4 : V.S5;
    for (let c = 0; c < n; c++) for (let r = 1; r < R; r++) {
      const g = this.rndO() < 0.85 ? Math.floor(this.rndO() * POCET_SLUZ) : CISLICE[Math.floor(this.rndO() * 10)];
      x.drawImage(this.atlas, g * tw, vc * th, tw, th, c * tw, r * th, tw, th);
      x.drawImage(this.atlas, g * tw, (vc + 1) * th, tw, th, c * tw, (R + r) * th, tw, th);
    }
  }

  _okolieKrok(teraz, mult) {
    const R = this.rows;
    const dt = (mult * this.krokMs) / 1000;
    for (let c = 0; c < this.cols; c++) {
      if (teraz < this.start[c]) continue;
      this.oy[c] += this.ospd[c] * dt;
      if (this.oy[c] - this.olen[c] > R) this._okolieNove(c, false);
    }
  }

  /** Čelo (2 bunky) a chvost; v aktívnom stĺpci len pod hlavou. Nie v Akte III, LEXICON, tme a pred rozbehom. */
  _kresliOkolie(teraz) {
    if (!this.okolieCv || this.akt === 3 || this.lex || this.tma > 0.5) return;
    const R = this.rows;
    const tw = this.tw;
    const th = this.th;
    for (let c = 0; c < this.cols; c++) {
      if (this.usporny && c & 1) continue;
      if (teraz < this.start[c]) continue;
      const h = Math.floor(this.oy[c]);
      let lo = h - this.olen[c] + 1;
      let hi = h;
      if (lo < 1) lo = 1;
      if (hi > R - 1) hi = R - 1;
      if (this.akt1[c]) { const ha = Math.floor(this.y[c]) + 4; if (lo < ha) lo = ha; }
      if (hi < lo) continue;
      const cel = Math.max(lo, h - 1);
      const x = this.x0 + c * tw;
      if (cel > lo && this._smie()) {
        this.ctx.drawImage(this.okolieCv, c * tw, (R + lo) * th, tw, (cel - lo) * th, x, lo * th, tw, (cel - lo) * th);
        this.pocetKresieb++;
      }
      if (hi >= cel && this._smie()) {
        this.ctx.drawImage(this.okolieCv, c * tw, cel * th, tw, (hi - cel + 1) * th, x, cel * th, tw, (hi - cel + 1) * th);
        this.pocetKresieb++;
      }
    }
  }

  /** Počet aktívnych stĺpcov (6 + 4 za sektor + 2 za hromadu); nové štartujú od riadku odkial (vyrazia z obrazu). */
  nastavStlpce(pocet, teraz, odkial = -1) {
    const n = Math.min(this.cols, Math.max(0, pocet));
    for (let i = 0; i < this.cols; i++) {
      const c = this.poradie[i];
      const ma = i < n ? 1 : 0;
      if (ma && !this.akt1[c]) {
        this.start[c] = teraz;
        if (odkial >= 0) this.y[c] = odkial;
      }
      this.akt1[c] = ma;
    }
    if (this.aktivne !== n) this.spinavy = true;
    this.aktivne = n;
  }

  /** Staggerovaný štart (boot, prebudenie): stĺpce i štartujú o i · krok ms neskôr. */
  rozbeh(teraz, krokMs, prvych = 6, zvysokMs = 400) {
    for (let i = 0; i < this.cols; i++) {
      const c = this.poradie[i];
      this.start[c] = teraz + (i < prvych ? i * krokMs : prvych * krokMs + ((i - prvych) / Math.max(1, this.cols - prvych)) * zvysokMs);
      this.y[c] = -1 - this.rnd() * 3;
    }
  }

  tema_(meno) {
    this.tema = meno;
    this._atlas();
    this._okolieKresli();
    this.burn.dirty = true;
    if (this.akt === 3 || this.lex) this._textPrekresli();
    if (this.lex) this._mrazKresli();
    this.spinavy = true;
  }

  /** Atlas: LED body 5 × 7 s 1 px medzerou, HEAD, HOT a GLOW so zapečenou žiarou (ImageData mimo snímky, bez shadowBlur). */
  _atlas() {
    if (!this.tw) return;
    const t = TEMY[this.tema] || TEMY.green;
    this.farby = t;
    const od = odtiene(t);
    this._lexFarba = od[2];
    const farba = [od[0], ...od, t.keeper, t['burn-glow'], t.letter, t['fos-3'], t.hot, t.bg];
    const nG = GLYFY.length + 1;
    const W = nG * this.tw;
    const H = NV * this.th;
    const a = this.atlas && this.atlas.width === W && this.atlas.height === H ? this.atlas : this._canvas(W, H);
    this.atlas = a;
    const x = a.getContext('2d');
    x.clearRect(0, 0, a.width, a.height);
    const d = this.dot;
    // bod 2 px plný (1 px s medzerou bol zrnitý)
    this.led = d >= 3 ? d - 1 : d;
    this.gx = Math.floor((this.tw - (5 * d - (d - this.led))) / 2);
    this.gy = Math.floor((this.th - (7 * d - (d - this.led))) / 2);
    let img = null;
    try { img = typeof x.createImageData === 'function' ? x.createImageData(W, H) : null; } catch { img = null; }
    if (img && img.data && img.data.length === W * H * 4 && typeof x.putImageData === 'function') {
      this._atlasPixely(img.data, W, farba, t);
      x.putImageData(img, 0, 0);
      return;
    }
    // záloha bez ImageData (falošné plátna): body bez žiary
    for (let v = 0; v < NV; v++) {
      x.fillStyle = farba[v];
      for (let gi = 0; gi < nG; gi++) {
        if (gi === SOLID) { x.fillRect(gi * this.tw, v * this.th, this.tw, this.th); continue; }
        const g = GLYFY[gi];
        const ox = gi * this.tw + this.gx;
        const oy = v * this.th + this.gy;
        for (let yy = 0; yy < 7; yy++) for (let xx = 0; xx < 5; xx++) if ((g[yy] >> (4 - xx)) & 1) x.fillRect(ox + xx * d, oy + yy * d, this.led, this.led);
      }
    }
  }

  /** Masky bodov a mapy žiary (len od rozmeru bunky, nie od témy). */
  _atlasMasky() {
    const tw = this.tw;
    const th = this.th;
    const d = this.dot;
    const kluc = tw + 'x' + th + 'x' + d;
    if (this._masky && this._masky.kluc === kluc) return this._masky;
    const n = tw * th;
    const s = this.led;
    // gauss sigma 1,1 CSS px, k okraju bunky plynulo na nulu (bez tvrdej hrany)
    const sig = 1.1 * this.dpr;
    const R = Math.max(1, Math.ceil(2.5 * sig));
    const jadro = new Float32Array(2 * R + 1);
    let sj = 0;
    for (let i = -R; i <= R; i++) { jadro[i + R] = Math.exp(-(i * i) / (2 * sig * sig)); sj += jadro[i + R]; }
    for (let i = 0; i < jadro.length; i++) jadro[i] /= sj;
    const okno = new Float32Array(n);
    const hrana = 1.4 * this.dpr;
    for (let yy = 0; yy < th; yy++) for (let xx = 0; xx < tw; xx++) {
      const e = Math.min(xx + 0.5, tw - xx - 0.5, yy + 0.5, th - yy - 0.5);
      const f = Math.max(0, Math.min(1, (e - 0.5) / hrana));
      okno[yy * tw + xx] = f * f * (3 - 2 * f);
    }
    const tmp = new Float32Array(n);
    const masky = [];
    const ziara = [];
    for (let gi = 0; gi < GLYFY.length; gi++) {
      const g = GLYFY[gi];
      const m = new Float32Array(n);
      for (let yy = 0; yy < 7; yy++) for (let xx = 0; xx < 5; xx++) {
        if (!((g[yy] >> (4 - xx)) & 1)) continue;
        const x0 = this.gx + xx * d;
        const y0 = this.gy + yy * d;
        for (let py = 0; py < s; py++) for (let px = 0; px < s; px++) {
          const roh = s >= 3 && (py === 0 || py === s - 1) && (px === 0 || px === s - 1);
          const X = x0 + px;
          const Y = y0 + py;
          if (X >= 0 && X < tw && Y >= 0 && Y < th) m[Y * tw + X] = roh ? 0.55 : 1;
        }
      }
      const z = new Float32Array(n);
      for (let yy = 0; yy < th; yy++) for (let xx = 0; xx < tw; xx++) {
        let acc = 0;
        for (let k = -R; k <= R; k++) { const X = xx + k; if (X >= 0 && X < tw) acc += m[yy * tw + X] * jadro[k + R]; }
        tmp[yy * tw + xx] = acc;
      }
      for (let yy = 0; yy < th; yy++) for (let xx = 0; xx < tw; xx++) {
        let acc = 0;
        for (let k = -R; k <= R; k++) { const Y = yy + k; if (Y >= 0 && Y < th) acc += tmp[Y * tw + xx] * jadro[k + R]; }
        z[yy * tw + xx] = acc * okno[yy * tw + xx];
      }
      masky.push(m);
      ziara.push(z);
    }
    this._masky = { kluc, masky, ziara };
    return this._masky;
  }

  _atlasPixely(data, W, farba, t) {
    const { masky, ziara } = this._atlasMasky();
    const tw = this.tw;
    const th = this.th;
    const nG = GLYFY.length + 1;
    const ziaraUrovne = new Float32Array(NV);
    const ziaraFarba = new Array(NV).fill(null);
    // pri bode 2 px je medzera veľká ako bod, silná žiara by glyf zaliala
    const k = this.dot <= 2 ? 0.5 : 1;
    ziaraUrovne[V.HEAD] = 2.2 * k; ziaraFarba[V.HEAD] = rgb(t.fos);
    ziaraUrovne[V.HOT] = 1.7 * k; ziaraFarba[V.HOT] = rgb(t.fos);
    ziaraUrovne[V.GLOW] = 1.4 * k; ziaraFarba[V.GLOW] = rgb(t['burn-glow']);
    const strop = this.dot <= 2 ? 0.42 : 0.7;
    for (let v = 0; v < NV; v++) {
      const [cr, cg, cb] = rgb(farba[v]);
      const gain = ziaraUrovne[v];
      const zf = ziaraFarba[v];
      for (let gi = 0; gi < nG; gi++) {
        const ox = gi * tw;
        const oy = v * th;
        if (gi === SOLID) {
          for (let yy = 0; yy < th; yy++) for (let xx = 0; xx < tw; xx++) {
            const i = ((oy + yy) * W + ox + xx) * 4;
            data[i] = cr; data[i + 1] = cg; data[i + 2] = cb; data[i + 3] = 255;
          }
          continue;
        }
        const m = masky[gi];
        const z = ziara[gi];
        for (let yy = 0; yy < th; yy++) for (let xx = 0; xx < tw; xx++) {
          const p = yy * tw + xx;
          const ma = m[p];
          const ga = zf ? Math.min(strop, z[p] * gain) : 0;
          const A = ma + ga * (1 - ma);
          if (A < 0.004) continue;
          const i = ((oy + yy) * W + ox + xx) * 4;
          const kg = (ga * (1 - ma)) / A;
          const km = ma / A;
          data[i] = zf ? cr * km + zf[0] * kg : cr;
          data[i + 1] = zf ? cg * km + zf[1] * kg : cg;
          data[i + 2] = zf ? cb * km + zf[2] * kg : cb;
          data[i + 3] = Math.round(A * 255);
        }
      }
    }
  }

  _vrstvy() {
    this.burnCv = this._canvas(this.W, this.H);
    this.textCv = this._canvas(this.W, (this.rows + 1) * this.th);
    this.ring = this._canvas(12 * this.tw, this.rows * this.th);
    // zamrznutý dážď počas LEXICON: predkreslená bitmapa, v snímke 1 drawImage (kolo oprav 2)
    this.mrazCv = this._canvas(this.W, this.H);
  }

  // ------------------------------------------------------------ vypálená vrstva (msg_0000)

  _burnRozlozenie() {
    const w = Math.max(8, this.cols - 2);
    let bloky = [];
    LIST.forEach((t, li) => { bloky.push({ li, riadky: zalom(t, w) }); });
    const vyska = this.rows - 1;
    const sucet = (bl, medzery) => bl.reduce((a, b) => a + b.riadky.length + (medzery ? 1 : 0), 0) - (medzery ? 1 : 0);
    // úzka obrazovka: ak sa list nezmestí, ukáže sa okno riadkov okolo práve vypaľovaného
    if (sucet(bloky, false) > vyska) {
      const stred = Math.min(6, this.burn.lines);
      let od = stred;
      let po = stred;
      while (true) {
        const skusOd = od > 0 ? od - 1 : od;
        const skusPo = po < 6 ? po + 1 : po;
        if (skusPo !== po && sucet(bloky.slice(od, skusPo + 1), false) <= vyska) { po = skusPo; continue; }
        if (skusOd !== od && sucet(bloky.slice(skusOd, po + 1), false) <= vyska) { od = skusOd; continue; }
        break;
      }
      bloky = bloky.slice(od, po + 1);
    }
    const spolu = sucet(bloky, true);
    const kompaktne = spolu > vyska;
    let r = 1 + Math.max(0, Math.floor((vyska - (kompaktne ? spolu - bloky.length + 1 : spolu)) / 2));
    this.burnBunky = [];
    for (const b of bloky) {
      let idx = 0;
      for (const riadok of b.riadky) {
        const c0 = Math.floor((this.cols - riadok.length) / 2);
        for (let i = 0; i < riadok.length; i++) {
          const ch = riadok[i];
          if (ch === ' ') continue;
          if (r < this.rows) this.burnBunky.push({ c: c0 + i, r, li: b.li, idx, ch, sluz: (ch.charCodeAt(0) * 7 + idx * 13 + b.li * 5) % POCET_SLUZ });
          idx++;
        }
        r++;
      }
      if (!kompaktne) r++;
    }
  }

  /** Stav vypálenej vrstvy: riadky hotové, bunky ďalšieho riadku, LEXICON, tma. */
  nastavBurn(lines, cells, lex, dark, teraz) {
    const b = this.burn;
    const noveRiadky = b.lines !== lines;
    if (noveRiadky || b.lex !== lex || b.dark !== dark) b.dirty = true;
    if (!this.burnInit || cells < b.shown || noveRiadky) { b.shown = cells; b.dirty = true; this.burnInit = true; }
    b.lines = lines; b.cells = cells; b.lex = lex; b.dark = dark;
    if (noveRiadky && this.cols) this._burnRozlozenie();
    if (this.reduced && b.shown !== cells) { b.shown = cells; b.dirty = true; }
    if (b.shownT === undefined) b.shownT = teraz;
  }

  _burnKresli(teraz) {
    const b = this.burn;
    const x = this.burnCv.getContext('2d');
    x.fillStyle = this.farby.bg;
    x.fillRect(0, 0, this.W, this.H);
    // vypálená vrstva sa ukáže až od SECTOR 02 (SPEC 1.2)
    if (!this.burnVidno) { b.dirty = false; return; }
    const koniecRiadky = b.koniec >= 0 ? Math.min(7, Math.floor((teraz - b.koniec) / 300) + 1) : -1;
    // Akt III a LEXICON: medzi vetami len v tme a pri konci M1 (inak presvital ako cudzie vety)
    if ((this.akt === 3 || this.lex) && !b.dark && koniecRiadky < 0) { b.dirty = false; return; }
    for (const k of this.burnBunky) {
      let v = V.S7;
      let g = k.sluz;
      const hotovy = k.li < b.lines || k.li < koniecRiadky;
      const odhaleny = k.li === b.lines && k.idx < b.shown;
      if (hotovy) v = b.dark || koniecRiadky >= 0 ? V.GLOW : V.S5;
      else if (odhaleny) v = b.dark ? V.GLOW : V.S5;
      if (hotovy || odhaleny) g = k.li < 4 || b.lex ? glyfZnaku(k.ch) : k.sluz;
      if (!hotovy && !odhaleny) g = k.sluz;
      x.drawImage(this.atlas, g * this.tw, v * this.th, this.tw, this.th, this.x0 + k.c * this.tw, k.r * this.th, this.tw, this.th);
    }
    b.dirty = false;
  }

  // ------------------------------------------------------------ Akt III: riadky viet

  /** Vygeneruje mriežku viet (každý riadok číta vety z listy.mjs). plny: riadok nesmie ostať prázdny (náhrada chytenej vety). */
  _riadokViet(r, plny = false) {
    const out = [];
    let c = Math.floor(this.rnd() * 10);
    if (!plny && this.rnd() < 0.42) c = this.cols;
    let seg = [];
    const base = r * (this.cols + 1);
    for (let i = 0; i < this.cols + 1; i++) this.text[base + i] = PRAZDNY;
    while (c < this.cols - 6) {
      const si = Math.floor(this.rnd() * LISTY.length);
      const veta = LISTY[si];
      const kus = veta.length > this.cols - c ? veta.slice(0, this.cols - c) : veta;
      for (let i = 0; i < kus.length; i++) this.text[base + c + i] = glyfZnaku(kus[i]);
      seg.push([c, c + kus.length - 1, si]);
      c += kus.length + 4 + Math.floor(this.rnd() * 6);
    }
    out.push(...seg);
    return out;
  }

  pripravTexty() {
    for (let r = 0; r <= this.rows; r++) this.riadkyViet[r] = this._riadokViet(r);
    this.posunT = 0;
    this.textyHotove = true;
    this._textPrekresli();
    this.spinavy = true;
  }

  _textPrekresli() {
    if (!this.textCv) return;
    const x = this.textCv.getContext('2d');
    x.clearRect(0, 0, this.textCv.width, this.textCv.height);
    for (let r = 0; r <= this.rows; r++) {
      const base = r * (this.cols + 1);
      // podklad celej vety (aj medzier), aby vypálená vrstva presvitala len mimo viet
      for (const sg of this.riadkyViet[r] || []) {
        let ma = false;
        for (let c = sg[0]; c <= sg[1]; c++) if (this.text[base + c] !== PRAZDNY) { ma = true; break; }
        if (!ma) continue;
        // stred dlaždice (roh primiešal susedný riadok atlasu)
        x.drawImage(this.atlas, SOLID * this.tw + (this.tw >> 1), V.BG * this.th + (this.th >> 1), 1, 1, this.x0 + sg[0] * this.tw, r * this.th, (sg[1] - sg[0] + 1) * this.tw, this.th);
      }
      for (let c = 0; c < this.cols; c++) {
        const g = this.text[base + c];
        if (g === PRAZDNY) continue;
        x.drawImage(this.atlas, g * this.tw, V.TEXT * this.th, this.tw, this.th, this.x0 + c * this.tw, r * this.th, this.tw, this.th);
      }
    }
  }

  /** Posun viet o riadok nadol (každých 1,4 s). */
  _posunViet() {
    const w = this.cols + 1;
    this.text.copyWithin(w, 0, this.rows * w);
    for (let r = this.rows; r > 0; r--) this.riadkyViet[r] = this.riadkyViet[r - 1];
    this.riadkyViet[0] = this._riadokViet(0);
    this._textPrekresli();
    this.spinavy = true;
  }

  // ------------------------------------------------------------ vstup

  /** Najbližší aktívny stĺpec k x (CSS px), prednostne v okruhu 24 px. */
  stlpecPri(xCss) {
    let best = -1;
    let bd = 1e9;
    const xDev = xCss * this.dpr;
    for (let c = 0; c < this.cols; c++) {
      if (!this.akt1[c]) continue;
      const stred = this.x0 + c * this.tw + this.tw / 2;
      const d = Math.abs(stred - xDev);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  stredStlpca(c) { return (this.x0 + c * this.tw + this.tw / 2) / this.dpr; }

  /**
   * Chytenie: stĺpec zastane 140 ms, hlava a 2 bunky --hot, 3 glyfy vyletia hore.
   * slaby: ťuk nad strop 10 za sekundu, bez zisku: len krátke bliknutie hlavy, bez zastavenia a letu glyfov.
   */
  chyt(c, teraz, slaby = false) {
    if (c < 0) return;
    this._okno(teraz, 160);
    if (slaby) { this.blesk[c] = teraz + 50; return; }
    this.mraz[c] = teraz + 140;
    this.blesk[c] = teraz + 140;
    if (this.reduced) return;
    const hr = Math.floor(this.y[c]);
    for (let k = 0; k < 3; k++) {
      const row = Math.max(1, Math.min(this.rows - 1, hr - k));
      const g = this.akt === 3 ? this.text[row * (this.cols + 1) + c] : this.bunky[c * this.rows + row];
      this._let(g, this.x0 + c * this.tw, row * this.th, this.x0 + c * this.tw + (k - 1) * this.tw, 0, teraz + k * 30, 350);
    }
  }

  _let(g, x0, y0, x1, y1, t0, dur) {
    let l = null;
    for (const x of this.lety) if (!x.on) { l = x; break; }
    if (!l) return;
    l.on = true; l.g = g; l.x0 = x0; l.y0 = y0; l.x1 = x1; l.y1 = y1; l.t0 = t0; l.dur = dur;
  }

  /** Slovo v daždi: stĺpec podľa x (0..1) z ekonomiky. */
  nastavSlovo(w, teraz, citatelne = null) {
    if (!w) { if (this.slovo) this.spinavy = true; this.slovo = null; return; }
    if (this.slovo && this.slovo.id === w.id) return;
    this.spinavy = true;
    const i = Math.min(this.aktivne - 1, Math.floor(w.x * this.aktivne));
    const c = this.poradie[Math.max(0, i)];
    const r0 = 2 + Math.floor(w.x * 997) % Math.max(1, this.rows - w.len - 3);
    const glyfy = [];
    // od DECODER 2 sú niektoré znaky slova čitateľné (t▒m▒rr▒w)
    for (let k = 0; k < w.len; k++) glyfy.push(citatelne && citatelne[k] && citatelne[k] !== ' ' ? glyfZnaku(citatelne[k]) : Math.floor(this.rnd() * POCET_SLUZ));
    this.slovo = { id: w.id, c, r0, len: w.len, t0: teraz, glyfy };
  }

  slovoStlpec() { return this.slovo ? this.slovo.c : -1; }

  chytSlovo(teraz, citatelne) {
    const s = this.slovo;
    if (!s) return;
    for (let k = 0; k < s.len; k++) {
      const g = citatelne && citatelne[k] && citatelne[k] !== ' ' ? glyfZnaku(citatelne[k]) : s.glyfy[k];
      this._let(g, this.x0 + s.c * this.tw, (s.r0 + k) * this.th, this.x0 + s.c * this.tw, 0, teraz, 350);
    }
    this.slovo = null;
    this.spinavy = true;
  }

  /** Akt III: ťuk chytí vetu v riadku pod prstom. Vracia index vety alebo -1. */
  chytVetu(xCss, yCss, teraz, rezim) {
    const off = this._offY(teraz);
    const r = Math.max(0, Math.min(this.rows, Math.floor((yCss * this.dpr - off) / this.th)));
    const c = Math.floor((xCss * this.dpr - this.x0) / this.tw);
    const segs = this.riadkyViet[r] || [];
    let best = null;
    let bd = 1e9;
    for (const s of segs) {
      const d = c < s[0] ? s[0] - c : c > s[1] ? c - s[1] : 0;
      if (d < bd) { bd = d; best = s; }
    }
    if (!best || bd > 4) return -1;
    // predchádzajúca chytená veta sa pred novou dokončí (inak by ostala stáť v mriežke)
    if (this.chyt3 && !this.chyt3.hotovo) this._dokonciChyt3(this.chyt3);
    this.chyt3 = { r, c0: best[0], c1: best[1], t0: teraz, rezim, hotovo: false, si: best[2] };
    this._okno(teraz, 560);
    return best[2];
  }

  // ------------------------------------------------------------ stavy

  nastavGlitch(k) { this.glitchK = Math.max(0, Math.min(1, k)); }

  zacniLexicon(teraz) {
    // zmrazí dážď, pripraví cieľovú mriežku viet a predkreslí zamrznuté stĺpce do bitmapy
    this.lex = { t0: teraz, pripravene: new Int8Array(this.cols).fill(-1), slot: 0, hotovo: false };
    this.pripravTexty();
    this._zmraz();
    this._mrazKresli();
    this.mrznutie = true;
    this.spinavy = this.burn.dirty = true;
  }

  /** Zmrazí aktuálne stopy aktívnych stĺpcov do mrazene. */
  _zmraz() {
    this.mrazene.fill(PRAZDNY);
    for (let c = 0; c < this.cols; c++) {
      if (!this.akt1[c]) continue;
      const hr = Math.floor(this.y[c]);
      for (let k = 0; k <= this.stopa[c]; k++) {
        const r = hr - k;
        if (r >= 1 && r < this.rows) this.mrazene[c * this.rows + r] = this.bunky[c * this.rows + r];
      }
    }
  }

  /** Predkreslí zamrznuté stĺpce (priehľadné pozadie, vypálená vrstva presvitá). Mimo snímky (štart momentu, zmena rozmeru, téma). */
  _mrazKresli() {
    if (!this.mrazCv || !this.atlas) return;
    const x = this.mrazCv.getContext('2d');
    x.clearRect(0, 0, this.mrazCv.width, this.mrazCv.height);
    for (let c = 0; c < this.cols; c++) {
      const hr = Math.floor(this.y[c]);
      for (let r = 1; r < this.rows; r++) {
        const g = this.mrazene[c * this.rows + r];
        if (g === PRAZDNY) continue;
        x.drawImage(this.atlas, g * this.tw, (r === hr ? V.HEAD : V.S3) * this.th, this.tw, this.th, this.x0 + c * this.tw, r * this.th, this.tw, this.th);
      }
    }
  }

  /** Zmena rozmeru počas LEXICON: nové texty (ak sa zmenili stĺpce), nové zmrazenie, prázdny kruh premien. */
  _lexPrepocitaj() {
    if (!this.textyHotove) this.pripravTexty();
    else this._textPrekresli();
    this._zmraz();
    this._mrazKresli();
    this.lex.pripravene = new Int8Array(this.cols).fill(-1);
    this.lex.slot = 0;
  }

  _lexStart(c) { return this.lex.t0 + 600 + (c * (4000 - 240)) / Math.max(1, this.cols - 1); }

  /** Dva medzistupne premeny stĺpca c do kruhu (bez alokácií: typované polia a vložený xorshift). */
  _lexPriprav(c) {
    const slot = this.lex.slot++ % 6;
    this.lex.pripravene[c] = slot;
    const x = this.ring.getContext('2d');
    const d = this.dot;
    let sx = (c * 7919 + 17) >>> 0 || 1;
    x.clearRect(slot * 2 * this.tw, 0, 2 * this.tw, this.rows * this.th);
    x.fillStyle = this._lexFarba;
    const diff = this._diff;
    const flip = this._flip;
    for (let r = 1; r < this.rows; r++) {
      const a = GLYFY[this.mrazene[c * this.rows + r]];
      const b = GLYFY[this.text[r * (this.cols + 1) + c]];
      let m = 0;
      for (let yy = 0; yy < 7; yy++) for (let xx = 0; xx < 5; xx++) if (((a[yy] ^ b[yy]) >> (4 - xx)) & 1) diff[m++] = yy * 5 + xx;
      for (let i = m - 1; i > 0; i--) {
        sx ^= sx << 13; sx >>>= 0; sx ^= sx >>> 17; sx ^= sx << 5; sx >>>= 0;
        const j = Math.floor((sx / 4294967296) * (i + 1));
        const t = diff[i]; diff[i] = diff[j]; diff[j] = t;
      }
      for (let st = 0; st < 2; st++) {
        const k = Math.round((m * (st + 1)) / 3);
        for (let i = 0; i < k; i++) flip[diff[i]] = 1;
        for (let yy = 0; yy < 7; yy++) for (let xx = 0; xx < 5; xx++) {
          const p = yy * 5 + xx;
          let on = (a[yy] >> (4 - xx)) & 1;
          if (flip[p]) on ^= 1;
          if (on) x.fillRect((slot * 2 + st) * this.tw + this.gx + xx * d, r * this.th + this.gy + yy * d, this.led, this.led);
        }
        for (let i = 0; i < k; i++) flip[diff[i]] = 0;
      }
    }
  }

  /** Preskočí moment LEXICON na koniec (ťuk). */
  lexKoniec() {
    if (!this.lex) return;
    this.lex = null;
    this.mrznutie = false;
    this.akt = 3;
    this.posunT = 0;
    this.spinavy = true;
    if (this.onLexKoniec) this.onLexKoniec();
  }

  /** Karta aktu (SPEC 4.10): 2 500 ms, ťuk preskočí. */
  zacniKartu(riadky, teraz) {
    const pts = [];
    const n = Math.max(...riadky.map((r) => r.length));
    const d = Math.max(3, Math.min(8, Math.floor((0.9 * this.wCss) / (6 * n))));
    const dd = Math.round(d * this.dpr);
    const vyska = riadky.length * 8 * dd + (riadky.length - 1) * 2 * dd;
    let y = Math.floor((this.H - vyska) / 2);
    for (const riadok of riadky) {
      const sirka = riadok.length * 6 * dd - dd;
      const x0 = Math.floor((this.W - sirka) / 2);
      for (let i = 0; i < riadok.length; i++) {
        const g = GLYFY[glyfZnaku(riadok[i])];
        for (let yy = 0; yy < 7; yy++) for (let xx = 0; xx < 5; xx++) if ((g[yy] >> (4 - xx)) & 1) {
          pts.push({ x: x0 + (i * 6 + xx) * dd, y: y + yy * dd, t: this.rnd() * 600, vy: 0.5 + this.rnd() });
        }
      }
      y += 10 * dd;
    }
    this.karta = { t0: teraz, pts, dd, ds: dd >= 3 ? dd - Math.max(1, Math.round(dd / 6)) : dd };
    this._okno(teraz, 2600);
  }

  koniecM1(teraz) { this.burn.koniec = teraz; this.burn.dirty = true; this._okno(teraz, 2500); }

  // ------------------------------------------------------------ krok (30 za sekundu)

  _offY(teraz) {
    if (this.akt !== 3 || this.reduced) return -this.th;
    const p = Math.min(1, (teraz - this.posunT) / 1400);
    return -this.th + Math.floor(p * this.th);
  }

  krok(teraz) {
    if (!this.krokT) this.krokT = teraz;
    let n = 0;
    const K = this.krokMs;
    while (teraz - this.krokT >= K && n < 6) { this.krokT += K; this._krok1(this.krokT); n++; }
    if (teraz - this.krokT > 1000) this.krokT = teraz;
    return n;
  }

  /** Záchranný režim výkonu: 24 krokov za sekundu (rýchlosť pádu v bunkách za sekundu ostáva) a stopy × 0,7. */
  nastavUsporny(on) {
    this.usporny = !!on;
    this.krokMs = on ? 1000 / 24 : KROK;
    this.stopyK = on ? 0.7 : 1;
  }

  _krok1(teraz) {
    this.kroky++;
    if (this.reduced || this.mrznutie) return;
    const mult = (this.tma > 0 ? 1 - 0.9 * this.tma : 1) * (this.flood ? 1.5 : 1);
    const karta = this.karta && teraz - this.karta.t0 > 200 && teraz - this.karta.t0 < 2100;
    if (!karta && this.oy) this._okolieKrok(teraz, this.tma > 0 ? 1 - 0.9 * this.tma : 1);
    for (let c = 0; c < this.cols; c++) {
      if (!this.akt1[c] || teraz < this.start[c]) continue;
      if (teraz < this.mraz[c] || karta) continue;
      const pred = Math.floor(this.y[c]);
      this.y[c] += (this.spd[c] * mult * this.krokMs) / 1000;
      const po = Math.floor(this.y[c]);
      if (po !== pred && po >= 1 && po < this.rows) this.bunky[c * this.rows + po] = this._nahodnyGlyf();
      if (teraz >= this.hlava[c]) {
        this.hlava[c] = teraz + 90 + this.rnd() * 70;
        if (po >= 1 && po < this.rows) this.bunky[c * this.rows + po] = this._nahodnyGlyf();
      }
      const t = this.stopa[c];
      const zmien = Math.max(1, Math.round(t * 0.03));
      for (let k = 0; k < zmien; k++) {
        if (this.rnd() < 0.5) continue;
        const r = po - 1 - Math.floor(this.rnd() * t);
        if (r >= 1 && r < this.rows) this.bunky[c * this.rows + r] = this._nahodnyGlyf();
      }
      if (this.y[c] - t * (this.flood ? 3 : 1) > this.rows) this._novyStlpec(c, false);
    }
    if (this.akt === 3 && !this.lex && teraz - this.posunT >= 1400) {
      this.posunT = this.posunT ? this.posunT + 1400 : teraz;
      if (teraz - this.posunT > 1400) this.posunT = teraz;
      this._posunViet();
    }
    // glitch: udalosť každých 1 / (0,5 + 2,5k) s, trvá 80 ms (najviac 3 za sekundu)
    const g = this.glitch;
    if (this.glitchK > 0 && teraz >= g.dalsi) {
      const k = this.glitchK;
      g.dalsi = teraz + Math.max(334, 1000 / (0.5 + 2.5 * k));
      g.do = teraz + 80;
      g.pasy = 1 + Math.floor(this.rnd() * 3);
      g.off = Math.round((1 + 2 * k) * this.dpr);
      for (let i = 0; i < g.pasy; i++) { g.h[i] = 1 + Math.floor(this.rnd() * 3); g.y[i] = 1 + Math.floor(this.rnd() * Math.max(1, this.rows - 4)); }
      if (this.onGlitch) this.onGlitch(k);
    }
  }

  // ------------------------------------------------------------ snímka

  /** Počíta požadované kreslenie (aj to, ktoré strop orezal) a povie, či sa ešte smie kresliť. */
  _smie() {
    this.pozadovane++;
    return this.pocetKresieb < MAX_KRESIEB;
  }

  _put(g, v, c, r, dy = 0) {
    if (!this._smie()) return false;
    this.ctx.drawImage(this.atlas, g * this.tw, v * this.th, this.tw, this.th, this.x0 + c * this.tw, r * this.th + dy, this.tw, this.th);
    this.pocetKresieb++;
    return true;
  }

  kresli(teraz) {
    const ctx = this.ctx;
    this.pocetKresieb = 0;
    this.pozadovane = 0;
    this.spinavy = false;
    if (!this.atlas) return;
    if (this.burn.shown < this.burn.cells && !this.reduced) {
      const kolko = Math.floor((teraz - (this.burn.shownT || teraz)) / 60);
      if (kolko > 0) { this.burn.shown = Math.min(this.burn.cells, this.burn.shown + kolko); this.burn.shownT = teraz; this.burn.dirty = true; this.burn.nova = teraz; }
    } else this.burn.shownT = teraz;
    if (this.burn.koniec >= 0 && teraz - this.burn.koniec < 2400) this.burn.dirty = true;
    if (this.burn.dirty) this._burnKresli(teraz);
    ctx.drawImage(this.burnCv, 0, 0);
    this.pocetKresieb++;
    this.pozadovane++;
    this._kresliOkolie(teraz);
    // nová bunka vypálenej vrstvy: 1 krok --hot
    if (this.burn.nova && teraz - this.burn.nova < KROK * 2) {
      const k = this._burnBunka(this.burn.lines, this.burn.shown - 1);
      if (k) this._put(k.li < 4 || this.burn.lex ? glyfZnaku(k.ch) : k.sluz, V.HOT, k.c, k.r);
    }

    if (this.lex) { this._kresliLex(teraz); this._kresliLety(teraz); return; }

    const offY = this._offY(teraz);
    if (this.akt === 3) {
      ctx.drawImage(this.textCv, 0, offY);
      this.pocetKresieb++;
      this.pozadovane++;
    }
    this._kresliZnacky(teraz);
    this._kresliStlpce(teraz, offY);
    if (this.akt === 3 && this.chyt3) this._kresliChyt3(teraz, offY);
    this._kresliSlovo(teraz);
    this._kresliLety(teraz);
    this._kresliGlitch(teraz);
    if (this.karta) this._kresliKartu(teraz);
  }

  _burnBunka(li, idx) {
    for (const k of this.burnBunky) if (k.li === li && k.idx === idx) return k;
    return null;
  }

  _kresliZnacky(teraz) {
    const p = this.procesy;
    if (this.akt === 3) return;
    const n = this.aktivne;
    if (p.hook > 0 && n > 0) {
      const z = p.hook >= 100 ? INDEX['█'] : p.hook >= 50 ? INDEX['▓'] : p.hook >= 25 ? INDEX['▒'] : INDEX['░'];
      const v = this.bleskZnacky > teraz ? V.HOT : V.S3;
      const kolko = Math.min(n, p.hook);
      const posl = (p.hook - 1) % n;
      let pad = 0;
      if (!this.reduced && teraz - this.novyHak < 250) pad = -Math.round((1 - springStep(PRESETS.snappy, (teraz - this.novyHak) / 1000)) * this.th);
      for (let i = 0; i < kolko; i++) this._put(z, v, this.poradie[i], 0, i === posl ? pad : 0);
    }
    if (p.thread > 0) {
      const kolko = Math.min(n, p.thread);
      const h = Math.max(2, Math.floor(this.rows / 3) - 1);
      for (let i = 0; i < kolko; i++) for (let r = 1; r <= h; r += 2) this._put(INDEX['│'], V.S6, this.poradie[i], r);
    }
  }

  _kresliStlpce(teraz, offY) {
    const tmavsie = this.tma > 0.5 ? 3 : 0;
    // FLOOD: hustota ×3 (stopy ×3, rozpočet 1 300 ich oreže); karta aktu: stopy 2× na prvých 300 ms (SPEC 4.10)
    let f = this.flood ? 3 : 1;
    if (this.karta && teraz - this.karta.t0 < 300) f *= 2;
    const zvysok = MAX_KRESIEB - this.pocetKresieb - 80;
    const naStlpec = Math.max(4, Math.floor(zvysok / Math.max(1, this.aktivne)) - 1);
    const akt3 = this.akt === 3;
    const w = this.cols + 1;
    const sito = this.procesy.sieve;
    for (let c = 0; c < this.cols; c++) {
      if (!this.akt1[c] || teraz < this.start[c]) continue;
      const hr = Math.floor(this.y[c]);
      let t = Math.min(Math.round(this.stopa[c] * f * this.stopyK), naStlpec);
      if (akt3) t = Math.min(t, 3);
      const blesk = teraz < this.blesk[c];
      for (let k = t; k >= 0; k--) {
        const r = hr - k;
        if (r < 1 || r >= this.rows) continue;
        let v;
        if (blesk && k <= 2) v = k === 0 ? V.HEAD : V.HOT;
        else if (k === 0) v = V.HEAD;
        else v = Math.min(V.S7, V.S0 + Math.ceil((k * 7) / Math.max(1, t)) + tmavsie);
        const g = akt3 ? this.text[r * w + c] : this.bunky[c * this.rows + r];
        if (akt3 && g === PRAZDNY) continue;
        this._put(g, v, c, r, akt3 ? offY : 0);
      }
      if (!akt3 && sito > 0 && this.rank[c] % 4 === 0 && this.rank[c] / 4 < sito && hr + 1 >= 1 && hr + 1 < this.rows) this._put(INDEX['╤'], V.S4, c, hr + 1);
    }
  }

  /**
   * Chytená veta zmizne z mriežky. Pri zníženom pohybe sa vety neposúvajú, preto ju v tom istom riadku hneď
   * nahradí nový riadok viet (zmena obsahu, nie pohyb); inak by sa dážď v Akte III vyprázdnil.
   */
  _dokonciChyt3(h) {
    if (h.hotovo) return;
    h.hotovo = true;
    const w = this.cols + 1;
    if (h.r < 0 || h.r > this.rows) return;
    if (this.reduced) this.riadkyViet[h.r] = this._riadokViet(h.r, true);
    else for (let c = h.c0; c <= h.c1; c++) this.text[h.r * w + c] = PRAZDNY;
    this._textPrekresli();
    this.spinavy = true;
  }

  _kresliChyt3(teraz, offY) {
    const h = this.chyt3;
    const dt = teraz - h.t0;
    const w = this.cols + 1;
    if (dt > 500 || this.reduced && dt > 200) {
      this._dokonciChyt3(h);
      this.chyt3 = null;
      return;
    }
    const stred = (h.c0 + h.c1) / 2;
    for (let c = h.c0; c <= h.c1; c++) {
      const g = this.text[h.r * w + c];
      if (g === PRAZDNY) continue;
      if (dt < 200 || this.reduced) { this._put(g, V.LETTER, c, h.r, offY); continue; }
      const p = springStep(PRESETS.snappy, (dt - 200) / 1000);
      if (h.rezim === 'mend') {
        const cc = Math.round(c + (stred - c) * p);
        this._put(g, V.LETTER, cc, h.r, offY);
      } else {
        const gg = (g * 7 + c) % POCET_SLUZ;
        this._put(gg, V.S2 + Math.floor(p * 5), c, h.r, offY + Math.round(p * this.th * (1 + (c % 3))));
      }
    }
  }

  _kresliSlovo(teraz) {
    const s = this.slovo;
    if (!s) return;
    const pulz = this.reduced ? 0 : Math.floor((teraz - s.t0) / 200) % 2;
    for (let k = 0; k < s.len; k++) this._put(s.glyfy[k], pulz ? V.S1 : V.HOT, s.c, s.r0 + k);
  }

  _kresliLety(teraz) {
    for (const l of this.lety) {
      if (!l.on) continue;
      const dt = teraz - l.t0;
      if (dt < 0) continue;
      if (dt > l.dur) { l.on = false; continue; }
      const p = springStep(PRESETS.snappy, dt / 1000);
      const x = Math.round(l.x0 + (l.x1 - l.x0) * p);
      const y = Math.round(l.y0 + (l.y1 - l.y0) * p);
      const v = Math.min(V.S7, V.S0 + Math.floor((dt / l.dur) * 8));
      if (!this._smie()) continue;
      this.ctx.drawImage(this.atlas, l.g * this.tw, v * this.th, this.tw, this.th, x, y, this.tw, this.th);
      this.pocetKresieb++;
    }
  }

  _kresliGlitch(teraz) {
    const g = this.glitch;
    if (!(teraz < g.do) && !this.glitchZmrazeny) return;
    const ctx = this.ctx;
    for (let i = 0; i < g.pasy; i++) {
      const y = g.y[i] * this.th;
      const h = g.h[i] * this.th;
      if (!this._smie()) continue;
      ctx.drawImage(this.cv, 0, y, this.W - g.off, h, g.off, y, this.W - g.off, h);
      this.pocetKresieb++;
      if (this.glitchK >= 0.8) {
        const w = this.cols + 1;
        for (let c = 0; c < this.cols; c++) {
          if (!this.akt1[c]) continue;
          const hr = Math.floor(this.y[c]);
          for (let r = g.y[i]; r < g.y[i] + g.h[i]; r++) {
            if (r > hr || hr - r > this.stopa[c]) continue;
            const gl = this.akt === 3 ? this.text[r * w + c] : this.bunky[c * this.rows + r];
            if (!this._smie()) continue;
            ctx.drawImage(this.atlas, gl * this.tw, V.KEEPER * this.th, this.tw, this.th, this.x0 + c * this.tw + g.off + 1, r * this.th, this.tw, this.th);
            this.pocetKresieb++;
          }
        }
      }
    }
  }

  /**
   * Premena LEXICON (kolo oprav 2): hotové stĺpce sú jeden súvislý blok vľavo (1 drawImage z textCv), zamrznuté
   * jeden blok vpravo (1 drawImage z predkreslenej bitmapy); bunka po bunke sa kreslia len stĺpce v premene (najviac 4).
   */
  _kresliLex(teraz) {
    const L = this.lex;
    let hotoveDo = this.cols;
    let mrazOd = this.cols;
    for (let c = 0; c < this.cols; c++) {
      const st = this._lexStart(c);
      if (hotoveDo === this.cols && !(teraz >= st + 240 || this.reduced)) hotoveDo = c;
      if (teraz < st) { mrazOd = c; break; }
    }
    if (hotoveDo > mrazOd) hotoveDo = mrazOd;
    const vyska = (this.rows - 1) * this.th;
    if (hotoveDo > 0 && this._smie()) {
      const sx = this.x0;
      this.ctx.drawImage(this.textCv, sx, this.th, hotoveDo * this.tw, vyska, sx, this.th, hotoveDo * this.tw, vyska);
      this.pocetKresieb++;
    }
    if (mrazOd < this.cols && this._smie()) {
      const sx = this.x0 + mrazOd * this.tw;
      const sw = (this.cols - mrazOd) * this.tw;
      this.ctx.drawImage(this.mrazCv, sx, this.th, sw, vyska, sx, this.th, sw, vyska);
      this.pocetKresieb++;
    }
    for (let c = hotoveDo; c < mrazOd; c++) {
      const st = this._lexStart(c);
      if (L.pripravene[c] < 0) this._lexPriprav(c);
      const stage = Math.min(1, Math.floor((teraz - st) / 80));
      const slot = L.pripravene[c];
      for (let r = 1; r < this.rows; r++) {
        if (!this._smie()) continue;
        this.ctx.drawImage(this.ring, (slot * 2 + stage) * this.tw, r * this.th, this.tw, this.th, this.x0 + c * this.tw, r * this.th, this.tw, this.th);
        this.pocetKresieb++;
      }
    }
  }

  _kresliKartu(teraz) {
    const K = this.karta;
    const dt = teraz - K.t0;
    if (dt > 2500) { this.karta = null; return; }
    const ctx = this.ctx;
    for (const p of K.pts) {
      if (dt < 500 + p.t && !this.reduced) continue;
      let y = p.y;
      if (dt > 2100 && !this.reduced) {
        const f = (dt - 2100) / 1000;
        y += Math.round(0.5 * 2400 * f * f * p.vy * this.dpr);
        if (y > this.H) continue;
      }
      if (!this._smie()) continue;
      ctx.drawImage(this.atlas, SOLID * this.tw + (this.tw >> 1), V.HOT * this.th + (this.th >> 1), 2, 2, p.x, y, K.ds, K.ds);
      this.pocetKresieb++;
    }
  }
}
