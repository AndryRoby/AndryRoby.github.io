/* Scena: sklada vytlacene vrstvy, babky, rekvizity a svetlo do jedneho platna.
 * Kresli len ked sa nieco hybe (volanie z slucka.js). Vsetko sa kreslí bez zmeny
 * mierky na cele zariadenove pixely, kamera sa posuva len o cele pixely, aby raster
 * nevytvaral moare. Parallax zadnej steny je len pocas prechodu kamery medzi celami:
 * v pokoji sedi okno presne nad svojim lucom. */
import { SVET, volnyPriestor } from './kulisy/vazenie.js';
import { MAPA } from './kulisy/tablo.js';
import { kresliBabku, DIELY } from './postavy.js';
import { kresliDetail } from './ruky.js';
import { kresliDom, kresliMapu69, kresliVillefort } from './scena69.js';
import { SVETY69 } from './kulisy/pariz.js';

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export class Scena {
  constructor(platno) {
    this.platno = platno;
    this.ctx = platno.getContext('2d', { alpha: false });
    this.s = 2;
    this.B = new Map();
    this.volny = volnyPriestor();
    this.tweeny = [];
    this.znizeny = false;
    this.cas = 0;
    this.st = {
      kulisa: 'prazdna', tablo: null, tabloPred: null, prechod: 1,
      kam: { x: 0, ciel: 0, v: 0, sleduj: null },
      herci: {
        edmond: { vid: false, x: 0, y: SVET.podlaha, smer: 1, poza: null, rek: null },
        faria: { vid: false, x: 0, y: SVET.podlaha, smer: -1, poza: null, rek: null },
        grof: { vid: false, x: 0, y: 0, smer: 1, poza: null, rek: null, vrstvy: new Set() },
        vyslanec: { vid: false, x: 0, y: 0, smer: 1, poza: null, rek: null },
        komornik: { vid: false, x: 0, y: 0, smer: -1, poza: null, rek: null },
        sluha: { vid: false, x: 0, y: 0, smer: -1, poza: null, rek: null },
      },
      svet: null, dom: { dvere: 0, okienko: 0, kocarX: 20, lampa: false, lampaX: 690, dvereW: 0 }, m69: { kocar: 0, kocar2: 0, grof: 0 }, vlampa: 1,
      kamen: 0, rohoz: 0,
      svetlo: { F: 0, E1: 0, E2: 0, E3: 0, Ev: 0, tint: 0, tma: 0 },
      clona: 0, mapaCesta: 0, dych: true,
    };
  }

  /* ── animacie hodnot ── */
  tween(obj, kluc, na, trvanie, hotovo) {
    this.tweeny = this.tweeny.filter((t) => !(t.obj === obj && t.kluc === kluc));
    if (this.znizeny && trvanie > 0) trvanie = Math.min(trvanie, 0.15);
    if (!trvanie) { obj[kluc] = na; hotovo && hotovo(); return; }
    this.tweeny.push({ obj, kluc, od: obj[kluc], na, t: 0, trvanie, hotovo });
  }
  svetlo(ciel, trvanie = 1.2) { for (const [k, v] of Object.entries(ciel)) this.tween(this.st.svetlo, k, v, trvanie); }
  clona(trvanie = 0.35) {
    return new Promise((res) => this.tween(this.st, 'clona', 1, trvanie, () => res()));
  }
  odclon(trvanie = 0.45) { this.tween(this.st, 'clona', 0, trvanie); }
  tablo(meno, trvanie = 0.9) {
    const st = this.st;
    if (st.kulisa === 'tablo' && st.tablo === meno) return;
    st.tabloPred = st.kulisa === 'tablo' ? st.tablo : null;
    st.kulisa = 'tablo';
    st.tablo = meno;
    st.prechod = 0;
    this.tween(st, 'prechod', 1, this.znizeny ? 0 : trvanie);
  }

  /* ── suradnice ── */
  /* sirka sveta, po ktorom sa kamera posuva */
  sirka() { return this.st.kulisa === 'dom' && SVETY69[this.st.svet] ? SVETY69[this.st.svet].w : SVET.w; }
  maKameru() { return this.st.kulisa === 'svet' || this.st.kulisa === 'dom'; }
  naObrazovku(x, y) {
    const r = this.platno.getBoundingClientRect();
    const k = r.width / 640;
    const kx = this.maKameru() ? this.st.kam.x : 0;
    return { x: (x - kx) * k, y: y * k };
  }
  zObrazovky(fx, fy) {
    const kx = this.maKameru() ? this.st.kam.x : 0;
    return { x: fx * 640 + kx, y: fy * 360 };
  }

  /* ── jedna snimka; vrati true, ak sa nieco este hybe ── */
  snimka(dt, t) {
    this.cas = t;
    let hybe = false;
    for (const tw of this.tweeny) {
      tw.t += dt;
      const q = Math.min(1, tw.t / tw.trvanie);
      tw.obj[tw.kluc] = tw.od + (tw.na - tw.od) * ease(q);
      if (q >= 1) tw.hotovy = true;
    }
    const hotove = this.tweeny.filter((x) => x.hotovy);
    this.tweeny = this.tweeny.filter((x) => !x.hotovy);
    hotove.forEach((x) => x.hotovo && x.hotovo());
    if (this.tweeny.length) hybe = true;
    /* kamera: kriticky tlmena pruzina po osi x */
    const kam = this.st.kam;
    if (kam.sleduj) { const h = this.st.herci[kam.sleduj]; kam.ciel = Math.max(0, Math.min(this.sirka() - 640, h.x - 320)); }
    if (this.znizeny) { kam.x = kam.ciel; kam.v = 0; }
    else {
      const w = 5.2, d = kam.x - kam.ciel;
      const a = -w * w * d - 2 * w * kam.v;
      kam.v += a * dt; kam.x += kam.v * dt;
      if (Math.abs(kam.x - kam.ciel) < 0.3 && Math.abs(kam.v) < 0.5) { kam.x = kam.ciel; kam.v = 0; } else hybe = true;
    }
    this.kresli();
    return hybe;
  }

  kresli() {
    const { ctx, s, st, B } = this;
    const W = this.platno.width, H = this.platno.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#f3eee3';
    ctx.fillRect(0, 0, W, H);
    if (st.kulisa === 'svet') this.kresliSvet();
    else if (st.kulisa === 'tablo') {
      const pred = st.tabloPred && B.get(st.tabloPred), ten = B.get(st.tablo);
      if (pred && st.prechod < 1) ctx.drawImage(pred, 0, 0);
      if (ten) { ctx.globalAlpha = st.prechod; ctx.drawImage(ten, 0, 0); ctx.globalAlpha = 1; }
    } else if (st.kulisa === 'mapa') this.kresliMapu();
    else if (st.kulisa === 'dom') kresliDom(this);
    else if (st.kulisa === 'mapa69') kresliMapu69(this);
    else if (st.kulisa === 'villefort') kresliVillefort(this);
    else if (st.kulisa === 'uvod') { const u = B.get('uvod'); if (u) ctx.drawImage(u, 0, 0); }
    if (this.detail) kresliDetail(ctx, s, B, this.detail);
    if (st.clona > 0.001) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = st.clona;
      ctx.fillStyle = '#f3eee3';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }

  kresliSvet() {
    const { ctx, s, st, B } = this;
    const W = this.platno.width, H = this.platno.height;
    const kx = st.kam.x;
    const cam = Math.round(kx * s);
    /* parallax zadnej steny len medzi celami (NAVRH 0,94 v strede prechodu) */
    const posun = this.znizeny ? 0 : 26 * Math.sin((Math.PI * Math.max(0, Math.min(760, kx))) / 760);
    const zadna = B.get('zadna'), rez = B.get('rez');
    if (zadna) ctx.drawImage(zadna, -Math.round((kx - posun) * s), 0);
    if (rez) ctx.drawImage(rez, -cam, 0);
    ctx.setTransform(1, 0, 0, 1, -cam, 0);
    /* kamen v podlahe a rohoz */
    const km = B.get('rek:kamen'), ro = B.get('rek:rohoz');
    const [k0] = SVET.kamenF;
    if (km) {
      const o = st.kamen;
      ctx.save();
      ctx.translate(Math.round((k0 - 2 + o * 34) * s), Math.round((SVET.podlaha - 2 - Math.sin(o * Math.PI) * 5) * s));
      ctx.rotate(-Math.sin(o * Math.PI) * 0.18);
      ctx.drawImage(km, 0, 0);
      ctx.restore();
    }
    if (ro) ctx.drawImage(ro, Math.round((k0 - 8 + (1 - st.rohoz) * 60) * s), Math.round((SVET.podlaha - 5.5) * s));
    /* svetlo z okien */
    ctx.setTransform(1, 0, 0, 1, -cam, 0);
    for (const [k, v] of Object.entries(st.svetlo)) {
      if (k === 'tint' || k === 'tma' || v < 0.01) continue;
      const b = B.get('luc:' + k);
      if (!b) continue;
      const kr = LUC_POZ[k];
      ctx.globalAlpha = v;
      ctx.drawImage(b, Math.round(kr[0] * s), Math.round(kr[1] * s));
    }
    ctx.globalAlpha = 1;
    /* babky, orezane volnym priestorom (v chodbe nevytrcaju zo skaly) */
    ctx.save();
    ctx.setTransform(s, 0, 0, s, -cam, 0);
    ctx.clip(this.volny);
    ctx.setTransform(1, 0, 0, 1, -cam, 0);
    const dych = st.dych && !this.znizeny ? Math.sin(this.cas * 1.4) : 0;
    for (const meno of ['faria', 'edmond']) {
      const h = st.herci[meno];
      if (!h.vid || !h.poza) continue;
      const p = dych ? Object.assign({}, h.poza, { trup: h.poza.trup + dych * 0.012 * (meno === 'faria' ? 1.4 : 1), hlava: h.poza.hlava - dych * 0.01 }) : h.poza;
      kresliBabku(ctx, this.Bobj || (this.Bobj = {}), meno, p, h.x, h.y, h.smer, s, h.rek);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    /* vecer: farba svetla sa meni nasobenim (lacne, cela snimka) */
    const t = st.svetlo.tint;
    if (t > 0.01) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = `rgb(${Math.round(255 - 70 * t)},${Math.round(255 - 88 * t)},${Math.round(255 - 40 * t)})`;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }
    const tm = st.svetlo.tma;
    if (tm > 0.01) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = `rgb(${Math.round(255 - 190 * tm)},${Math.round(255 - 185 * tm)},${Math.round(255 - 140 * tm)})`;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  kresliMapu() {
    const { ctx, s, st, B } = this;
    const m = B.get('mapa');
    if (m) ctx.drawImage(m, 0, 0);
    /* bodkovana ciara atramentom od If k ostrovu Monte Cristo (NAVRH) */
    const [x0, y0] = MAPA.bod(...MAPA.If), [x1, y1] = MAPA.bod(...MAPA.MonteCristo);
    /* po mori na juhovychod, okolo mysu Corse a dolu k ostrovu (NAVRH trasy) */
    const [ax, ay] = MAPA.bod(7.0, 42.85), [bx, by] = MAPA.bod(9.75, 43.45);
    const n = 40, kolko = Math.floor(n * st.mapaCesta);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgb(241,80,96)';
    for (let i = 1; i <= kolko; i++) {
      const q = i / n, u = 1 - q;
      const x = u * u * u * x0 + 3 * u * u * q * ax + 3 * u * q * q * bx + q * q * q * x1;
      const y = u * u * u * (y0 + 6) + 3 * u * u * q * ay + 3 * u * q * q * by + q * q * q * y1;
      ctx.beginPath(); ctx.arc(Math.round(x * s), Math.round(y * s), 1.9 * s, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /* bitmapy: Map meno -> ImageBitmap; Bobj je ta ista vec ako objekt pre babky */
  pridaj(mapa) {
    for (const [k, v] of mapa) {
      const stara = this.B.get(k);
      if (stara && stara !== v && stara.close) stara.close();
      this.B.set(k, v);
      (this.Bobj || (this.Bobj = {}))[k] = v;
    }
  }
  vycisti() { for (const v of this.B.values()) if (v.close) v.close(); this.B.clear(); this.Bobj = {}; }
}

/* poloha lucov vo svete (x0, y0 z kresieb) */
import { LUCE } from './kulisy/vazenie.js';
const LUC_POZ = {};
for (const [k, v] of Object.entries(LUCE)) LUC_POZ[k.slice(4)] = [v.x0, v.y0];
export const MENA_SVETA = ['zadna', 'rez', ...Object.keys(LUCE), 'rek:kamen', 'rek:rohoz', ...Object.keys(DIELY)];
