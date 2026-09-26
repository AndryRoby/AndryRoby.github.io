// kodfilm/zvuk.js: zvuk skladaný v prehliadači cez Web Audio. Žiadna nahrávka.
// Partitúra je zoznam udalostí { t, typ, ...parametre }. Tú istú partitúru hrá živý prehrávač
// (plánovanie s predstihom, len po geste používateľa) aj OfflineAudioContext pri rendri do WAV.

import { nahoda } from './cas.js';

const NOTY = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
/** 'A4' -> 440, 'C5' -> 523.25 */
export function hz(nota) {
  if (typeof nota === 'number') return nota;
  const m = /^([A-G][#b]?)(-?\d)$/.exec(nota);
  if (!m) throw new Error('Neznáma nota ' + nota);
  const n = NOTY[m[1]] + (Number(m[2]) + 1) * 12;
  return 440 * Math.pow(2, (n - 69) / 12);
}

/** Impulzová odozva dozvuku (stereo, so semienkom, chvost tmavne). */
function dozvukIR(ctx, dlzka = 2.6, semienko = 3) {
  const sr = ctx.sampleRate, n = Math.floor(sr * dlzka);
  const buf = ctx.createBuffer(2, n, sr);
  for (let ch = 0; ch < 2; ch++) {
    const r = nahoda(semienko + ch * 17), d = buf.getChannelData(ch);
    let y = 0;
    for (let i = 0; i < n; i++) {
      const u = i / n;
      const x = (r() * 2 - 1) * Math.pow(1 - u, 3.2);
      const k = 0.15 + 0.8 * u; // čím neskôr, tým tmavšie
      y = y * k + x * (1 - k);
      d[i] = i < sr * 0.004 ? 0 : y * (1.6 + u);
    }
  }
  return buf;
}

/** Biely šum so semienkom (2 s), zdieľaný všetkými zvukmi jedného kontextu. */
function sumBuffer(ctx, semienko = 9) {
  const sr = ctx.sampleRate, n = sr * 2, buf = ctx.createBuffer(1, n, sr);
  const r = nahoda(semienko), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = r() * 2 - 1;
  return buf;
}

/** Zvukový graf: suchá cesta a dozvuk do mastra s kompresorom. */
export function graf(ctx, { hlasitost = 0.9, dozvuk = 2.6 } = {}) {
  const master = ctx.createGain();
  master.gain.value = hlasitost;
  const komp = ctx.createDynamicsCompressor();
  komp.threshold.value = -14; komp.knee.value = 8; komp.ratio.value = 3;
  komp.attack.value = 0.004; komp.release.value = 0.22;
  master.connect(komp).connect(ctx.destination);
  const suchy = ctx.createGain();
  suchy.connect(master);
  const konv = ctx.createConvolver();
  konv.buffer = dozvukIR(ctx, dozvuk);
  const mokry = ctx.createGain();
  mokry.gain.value = 0.9;
  konv.connect(mokry).connect(master);
  return { ctx, master, suchy, dozvuk: konv, sum: sumBuffer(ctx) };
}

function vystup(g, uzol, kedy, { pan = 0, dozvuk = 0.25 } = {}) {
  const ctx = g.ctx;
  let posledny = uzol;
  if (pan && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    uzol.connect(p);
    posledny = p;
  }
  posledny.connect(g.suchy);
  if (dozvuk > 0) {
    const s = ctx.createGain();
    s.gain.value = dozvuk;
    posledny.connect(s).connect(g.dozvuk);
  }
}

const NASTROJE = {
  /** Zvon: FM (nosná a modulátor), jasný nábeh, dlhý dozvuk. */
  zvon(g, e, k) {
    const ctx = g.ctx, f = hz(e.f), dl = e.dlzka ?? 1.6, h = e.hlas ?? 0.18;
    const o = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain(), a = ctx.createGain();
    o.frequency.value = f;
    m.frequency.value = f * (e.pomer ?? 2);
    const idx = f * (e.index ?? 1.1);
    mg.gain.setValueAtTime(idx, k);
    mg.gain.exponentialRampToValueAtTime(Math.max(0.01, idx * 0.03), k + dl * 0.5);
    m.connect(mg).connect(o.frequency);
    a.gain.setValueAtTime(0, k);
    a.gain.linearRampToValueAtTime(h, k + 0.004);
    a.gain.exponentialRampToValueAtTime(0.0001, k + dl);
    o.connect(a);
    vystup(g, a, k, e);
    o.start(k); m.start(k);
    o.stop(k + dl + 0.05); m.stop(k + dl + 0.05);
  },
  /** Plocha akordu: dva mierne rozladené trojuholníky na tón cez dolnú priepusť. */
  pad(g, e, k) {
    const ctx = g.ctx, dl = e.dlzka ?? 4, nab = e.nabeh ?? 1.2, dob = e.dobeh ?? 1.5, h = (e.hlas ?? 0.12) / e.noty.length;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(e.filter ?? 1100, k);
    if (e.filter2) lp.frequency.linearRampToValueAtTime(e.filter2, k + dl);
    lp.Q.value = 0.4;
    const a = ctx.createGain();
    a.gain.setValueAtTime(0, k);
    a.gain.linearRampToValueAtTime(1, k + nab);
    a.gain.setValueAtTime(1, k + Math.max(nab, dl - dob));
    a.gain.linearRampToValueAtTime(0, k + dl);
    lp.connect(a);
    e.noty.forEach((n, i) => {
      for (const det of [-7, 7]) {
        const o = ctx.createOscillator(), og = ctx.createGain();
        o.type = e.tvar ?? 'triangle';
        o.frequency.value = hz(n);
        o.detune.value = det;
        og.gain.value = h * 0.5;
        if (ctx.createStereoPanner) {
          const p = ctx.createStereoPanner();
          p.pan.value = (i % 2 ? 1 : -1) * 0.35 + det / 60;
          o.connect(og).connect(p).connect(lp);
        } else o.connect(og).connect(lp);
        o.start(k); o.stop(k + dl + 0.05);
      }
    });
    vystup(g, a, k, { dozvuk: e.dozvuk ?? 0.35 });
  },
  /** Šum cez filter s pohybom frekvencie: vietor, švih, nádych pred vrcholom. */
  sum(g, e, k) {
    const ctx = g.ctx, dl = e.dlzka ?? 0.5, h = e.hlas ?? 0.2;
    const s = ctx.createBufferSource();
    s.buffer = g.sum; s.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = e.filter ?? 'bandpass';
    f.Q.value = e.q ?? 0.8;
    f.frequency.setValueAtTime(e.f0 ?? 1200, k);
    f.frequency.exponentialRampToValueAtTime(e.f1 ?? e.f0 ?? 1200, k + dl);
    const a = ctx.createGain();
    const nab = e.nabeh ?? 0.01;
    a.gain.setValueAtTime(0, k);
    a.gain.linearRampToValueAtTime(h, k + nab);
    if (e.tvar === 'narast') a.gain.linearRampToValueAtTime(0, k + dl);
    else a.gain.exponentialRampToValueAtTime(0.0001, k + dl);
    s.connect(f).connect(a);
    vystup(g, a, k, e);
    s.start(k, (e.odkial ?? 0.3) % 1.9); s.stop(k + dl + 0.05);
  },
  /** Praskanie (trhaný papier): krátke zhluky šumu v náhodných, ale pevných časoch. */
  praskot(g, e, k) {
    const ctx = g.ctx, sr = ctx.sampleRate, dl = e.dlzka ?? 0.4, n = Math.ceil(dl * sr);
    const buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0), r = nahoda(e.semienko ?? 21);
    const pocet = Math.round((e.hustota ?? 140) * dl);
    for (let j = 0; j < pocet; j++) {
      const zac = Math.floor(r() * n), dlz = Math.floor(sr * (0.0008 + r() * 0.005)), amp = 0.3 + r() * 0.7;
      const rast = zac / n; // trhanie zosilnie ku koncu
      for (let i = 0; i < dlz && zac + i < n; i++) d[zac + i] += (r() * 2 - 1) * amp * (0.5 + rast) * Math.exp(-i / (dlz * 0.35));
    }
    const s = ctx.createBufferSource();
    s.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = e.f ?? 2600; f.Q.value = 0.6;
    const a = ctx.createGain();
    a.gain.value = e.hlas ?? 0.5;
    s.connect(f).connect(a);
    vystup(g, a, k, e);
    s.start(k);
  },
  /** Ťuk: krátky sínus s padajúcou výškou, váha dopadu. */
  tuk(g, e, k) {
    const ctx = g.ctx, f = hz(e.f ?? 150), dl = e.dlzka ?? 0.16;
    const o = ctx.createOscillator(), a = ctx.createGain();
    o.frequency.setValueAtTime(f, k);
    o.frequency.exponentialRampToValueAtTime(f * 0.45, k + dl);
    a.gain.setValueAtTime(0, k);
    a.gain.linearRampToValueAtTime(e.hlas ?? 0.25, k + 0.003);
    a.gain.exponentialRampToValueAtTime(0.0001, k + dl);
    o.connect(a);
    vystup(g, a, k, { pan: e.pan, dozvuk: e.dozvuk ?? 0.05 });
    o.start(k); o.stop(k + dl + 0.03);
  },
  /** Glissando: sínus, ktorý sa kĺže z f0 na f1. */
  glis(g, e, k) {
    const ctx = g.ctx, dl = e.dlzka ?? 0.3;
    const o = ctx.createOscillator(), a = ctx.createGain();
    o.type = e.tvar ?? 'sine';
    o.frequency.setValueAtTime(hz(e.f0), k);
    o.frequency.exponentialRampToValueAtTime(hz(e.f1), k + dl);
    a.gain.setValueAtTime(0, k);
    a.gain.linearRampToValueAtTime(e.hlas ?? 0.08, k + dl * 0.3);
    a.gain.linearRampToValueAtTime(0, k + dl);
    o.connect(a);
    vystup(g, a, k, e);
    o.start(k); o.stop(k + dl + 0.03);
  },
};

/** Pridanie vlastného nástroja: pridajNastroj('meno', (graf, udalost, kedy) => {...}). */
export function pridajNastroj(meno, fn) { NASTROJE[meno] = fn; }

export function zahraj(g, udalost, kedy) {
  const n = NASTROJE[udalost.typ];
  if (!n) throw new Error('Neznámy nástroj ' + udalost.typ);
  n(g, udalost, kedy);
}

export const zorad = (udalosti) => [...udalosti].sort((a, b) => a.t - b.t);

/** Offline render celej partitúry do AudioBuffer (deterministicky). */
export async function renderOffline(udalosti, dlzka, sr = 48000) {
  const ctx = new OfflineAudioContext(2, Math.ceil(dlzka * sr), sr);
  const g = graf(ctx);
  for (const u of zorad(udalosti)) if (u.t < dlzka) zahraj(g, u, u.t);
  return ctx.startRendering();
}

/** AudioBuffer -> WAV (16 bit PCM), voliteľne len úsek od..do sekúnd. */
export function wav(buffer, od = 0, dokedy = buffer.duration) {
  const sr = buffer.sampleRate, kanaly = buffer.numberOfChannels;
  const i0 = Math.floor(od * sr), i1 = Math.min(buffer.length, Math.floor(dokedy * sr)), n = Math.max(0, i1 - i0);
  const out = new DataView(new ArrayBuffer(44 + n * kanaly * 2));
  const str = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); out.setUint32(4, 36 + n * kanaly * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, kanaly, true);
  out.setUint32(24, sr, true); out.setUint32(28, sr * kanaly * 2, true); out.setUint16(32, kanaly * 2, true); out.setUint16(34, 16, true);
  str(36, 'data'); out.setUint32(40, n * kanaly * 2, true);
  const data = [];
  for (let c = 0; c < kanaly; c++) data.push(buffer.getChannelData(c));
  let o = 44;
  for (let i = i0; i < i1; i++) for (let c = 0; c < kanaly; c++) {
    const v = Math.max(-1, Math.min(1, data[c][i]));
    out.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true);
    o += 2;
  }
  return new Uint8Array(out.buffer);
}

export function base64(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}

/**
 * Živý zvuk: AudioContext vzniká až po geste. Udalosti sa plánujú s predstihom (tik každú snímku),
 * takže pauza (suspend) a pokračovanie držia zvuk aj obraz spolu.
 */
export class ZivyZvuk {
  constructor(udalosti) { this.udalosti = zorad(udalosti); this.ctx = null; }
  async spusti(filmT = 0) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    this.ctx = new AC({ latencyHint: 'playback' });
    this.g = graf(this.ctx);
    try { await this.ctx.resume(); } catch { /* bez zvuku */ }
    this.a0 = this.ctx.currentTime + 0.08 - filmT;
    this.i = this.udalosti.findIndex((u) => u.t >= filmT);
    if (this.i < 0) this.i = this.udalosti.length;
    return this.ctx.state === 'running';
  }
  /** Výkonný čas (performance.now), v ktorom zaznie filmový čas 0. */
  perfNula() {
    const c = this.ctx;
    const ts = c.getOutputTimestamp ? c.getOutputTimestamp() : null;
    if (ts && ts.performanceTime > 0 && ts.contextTime > 0 && Math.abs(ts.performanceTime - performance.now()) < 1000) return ts.performanceTime + (this.a0 - ts.contextTime) * 1000;
    return performance.now() + (this.a0 - c.currentTime + (c.outputLatency || c.baseLatency || 0)) * 1000;
  }
  tik(filmT, dopredu = 1.0) {
    if (!this.ctx) return;
    const u = this.udalosti;
    while (this.i < u.length && u[this.i].t < filmT + dopredu) {
      const k = this.a0 + u[this.i].t;
      if (k >= this.ctx.currentTime - 0.02) zahraj(this.g, u[this.i], Math.max(k, this.ctx.currentTime));
      this.i++;
    }
  }
  pauza() { if (this.ctx && this.ctx.state === 'running') return this.ctx.suspend(); }
  pokracuj() { if (this.ctx && this.ctx.state === 'suspended') return this.ctx.resume(); }
  zastav() {
    if (!this.ctx) return;
    try { this.g.master.disconnect(); } catch { /* už odpojený */ }
    this.ctx.close();
    this.ctx = null;
  }
}
