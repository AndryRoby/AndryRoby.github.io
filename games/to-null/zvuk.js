// TO: NULL: zvuk cez Web Audio bez súborov (SPEC 5). AudioContext vznikne až pri prvom pointerdown alebo keydown.
// Pentatonika A mol pri ťuku podľa polohy x; každá udalosť má svoj strop za sekundu.

const PENTA = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25, 783.99];

export function vytvorZvuk(okno = globalThis) {
  let ctx = null;
  let master = null;
  let sum = null;
  let hum = null;
  let dron = null;
  let dazdSum = null;
  let lexDron = null;
  const z = {
    on: true,
    humOn: true,
    skryte: false,
    hrane: 0,
    limity: new Map(),
  };

  const cas = () => (ctx ? ctx.currentTime : 0);
  const smie = () => ctx && z.on && !z.skryte;

  function limit(meno, zaSek, teraz) {
    const okno1 = z.limity.get(meno) || [];
    while (okno1.length && teraz - okno1[0] > 1000) okno1.shift();
    if (okno1.length >= zaSek) return false;
    okno1.push(teraz);
    z.limity.set(meno, okno1);
    return true;
  }

  function ton(f, typ, gain, nabeh, doznenie, oneskorenie = 0) {
    if (!smie()) return;
    const t = cas() + oneskorenie;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = typ;
    o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + nabeh);
    g.gain.exponentialRampToValueAtTime(0.0001, t + nabeh + doznenie);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + nabeh + doznenie + 0.05);
    z.hrane++;
  }

  function sumik(dlzka, filter, freq, gain, rychlost = 1) {
    if (!smie() || !sum) return;
    const t = cas();
    const s = ctx.createBufferSource();
    s.buffer = sum;
    s.playbackRate.value = rychlost;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dlzka);
    s.connect(f).connect(g).connect(master);
    s.start(t, 0, dlzka);
    z.hrane++;
  }

  function slucka(freqs, gain, typ = 'sine') {
    const g = ctx.createGain();
    g.gain.value = 0;
    const osc = freqs.map((f) => { const o = ctx.createOscillator(); o.type = typ; o.frequency.value = f; o.connect(g); o.start(); return o; });
    g.connect(master);
    return { g, osc, ciel: gain };
  }

  function prepniSlucku(s, zap, cas0 = 0.4) {
    if (!s || !ctx) return;
    const t = cas();
    s.g.gain.cancelScheduledValues(t);
    s.g.gain.setValueAtTime(s.g.gain.value, t);
    s.g.gain.linearRampToValueAtTime(zap && z.on && !z.skryte ? s.ciel : 0, t + cas0);
  }

  // Firefox: prvý AudioContext blokuje ~1,3 s, preto vznikne vopred (priprav) a ťuk ho len spustí
  z.priprav = () => { if (!ctx) vytvor(); };
  z.odomkni = () => {
    if (!ctx) vytvor();
    if (ctx && ctx.state === 'suspended' && !z.skryte) ctx.resume();
  };
  function vytvor() {
    const AC = okno.AudioContext || okno.webkitAudioContext;
    if (!AC) return;
    try { ctx = new AC(); } catch { ctx = null; return; }
    const komp = ctx.createDynamicsCompressor();
    master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(komp).connect(ctx.destination);
    sum = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.05), ctx.sampleRate);
    const d = sum.getChannelData(0);
    let x = 12345;
    for (let i = 0; i < d.length; i++) { x = (x * 1103515245 + 12345) & 0x7fffffff; d[i] = (x / 0x3fffffff - 1) * (1 - i / d.length); }
    hum = slucka([50, 100], 0.004);
    dron = slucka([55], 0.03);
    lexDron = slucka([55], 0.05);
    const dazdBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const dd = dazdBuf.getChannelData(0);
    for (let i = 0; i < dd.length; i++) { x = (x * 1103515245 + 12345) & 0x7fffffff; dd[i] = x / 0x3fffffff - 1; }
    const src = ctx.createBufferSource();
    src.buffer = dazdBuf;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1200;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(lp).connect(g).connect(master);
    src.start();
    dazdSum = { g, ciel: 0.03 };
    prepniSlucku(hum, z.humOn, 1.2);
  }

  z.nastav = (on, humOn) => {
    z.on = !!on;
    z.humOn = !!humOn;
    if (!ctx) return;
    master.gain.setTargetAtTime(z.on ? 0.6 : 0, cas(), 0.02);
    prepniSlucku(hum, z.humOn);
  };

  z.skry = (skryte) => {
    z.skryte = !!skryte;
    if (!ctx) return;
    if (skryte) { try { ctx.suspend(); } catch { /* nič */ } } else { try { ctx.resume(); } catch { /* nič */ } }
  };

  const teraz = () => (okno.performance ? okno.performance.now() : Date.now());

  z.tuk = (pasmo) => {
    if (!smie() || !limit('tuk', 12, teraz())) return;
    ton(PENTA[Math.max(0, Math.min(9, pasmo))], 'triangle', 0.07, 0.004, 0.14);
  };
  z.slovo = () => { [0, 2, 4].forEach((i, k) => ton(PENTA[4 + i], 'triangle', 0.06, 0.004, 0.2, k * 0.04)); };
  z.pis = (sys) => {
    if (!smie() || !limit('pis', 25, teraz())) return;
    sumik(0.01, 'bandpass', sys ? 3200 : 3800, 0.025, 0.9 + Math.random() * 0.2);
  };
  z.keeper = () => ton(110, 'sine', 0.05, 0.02, 0.28);
  z.list = () => { if (!smie() || !limit('list', 2, teraz())) return; ton(659.25, 'sine', 0.03, 0.005, 0.12); ton(880, 'sine', 0.03, 0.005, 0.16, 0.08); };
  z.kupa = (jeden) => { ton(2000, 'square', 0.04, 0.001, 0.02); if (!jeden) ton(2000, 'square', 0.04, 0.001, 0.02, 0.03); };
  z.nedostupne = () => ton(1400, 'square', 0.02, 0.001, 0.015);
  z.brana = () => {
    for (let i = 0; i < 5; i++) ton(PENTA[3 + i], 'triangle', 0.06, 0.004, 0.18, i * 0.06);
    ton(80, 'sine', 0.06, 0.005, 0.12);
    z.vibruj();
  };
  z.milnik = () => { [440, 523.25, 659.25].forEach((f) => ton(f, 'triangle', 0.05, 0.01, 0.6)); };
  z.glitch = (k) => { if (!smie() || !limit('glitch', 3, teraz())) return; sumik(0.02, 'highpass', 2000, 0.015 + 0.03 * k); };
  z.tma = (zap) => { if (!ctx) return; prepniSlucku(dron, zap); prepniSlucku(hum, !zap && z.humOn); };
  z.bunka = () => { if (!smie() || !limit('bunka', 8, teraz())) return; ton(1320, 'sine', 0.015, 0.003, 0.04); };
  z.flood = (zap) => { if (!ctx || !dazdSum) return; prepniSlucku(dazdSum, zap, 0.6); };
  z.spanok = () => {
    if (!smie()) return;
    const t = cas();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(800, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.7);
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + 0.8);
    z.hrane++;
    z.vibruj();
  };
  z.prebudenie = () => {
    if (!smie()) return;
    const t = cas();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(60, t);
    o.frequency.exponentialRampToValueAtTime(440, t + 0.5);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + 0.6);
    z.hrane++;
  };
  /** LEXICON: ticho za 120 ms, nízky dron, tóny stĺpcov, zvon. */
  z.lexTicho = () => { if (!ctx) return; master.gain.setTargetAtTime(0.0001, cas(), 0.04); setTimeout(() => { if (ctx && z.on) master.gain.setTargetAtTime(0.6, cas(), 0.05); }, 600); };
  z.lexDron = (zap) => { if (ctx) prepniSlucku(lexDron, zap, zap ? 3.5 : 0.8); };
  z.lexStlpec = (i) => ton(PENTA[i % 10], 'sine', 0.012, 0.01, 0.4);
  z.zvon = () => { ton(880, 'sine', 0.05, 0.005, 1.5); ton(1320, 'sine', 0.03, 0.005, 1.5); };
  z.klik = () => ton(2400, 'square', 0.015, 0.001, 0.01);

  let poslVibr = 0;
  z.vibruj = () => {
    const n = okno.navigator;
    if (!z.on || !n || typeof n.vibrate !== 'function') return;
    const t = teraz();
    if (t - poslVibr < 2000) return;
    poslVibr = t;
    try { n.vibrate(8); } catch { /* nič */ }
  };
  return z;
}
