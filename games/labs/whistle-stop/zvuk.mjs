/* Whistle Stop M0: zvuk syntézou Web Audio, bez súborov (GDD 4.7). AudioContext vznikne až po prvom geste
   hráča; bez kontextu (Node, zakázaný zvuk) každá funkcia potichu nič nerobí. Úrovne: vietor −28 dBFS. */

const PENTATONIKA = [196, 220, 261.63, 293.66, 329.63, 392, 440];   // G dur pentatonika, drevený ťuk podľa budovy
export const DB = (d) => Math.pow(10, d / 20);

export function vytvorZvuk(AC = globalThis.AudioContext || globalThis.webkitAudioContext) {
  let ctx = null, hlavny = null, sum = null, vietor = null, zapnuty = true, dalsieVrzgnutie = 0;

  function sumBuffer() {
    const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = b.getChannelData(0);
    let x = 0.5;
    for (let i = 0; i < d.length; i++) { x = (x * 1103515245 + 12345) % 2147483648; d[i] = (x / 1073741824) - 1; }
    return b;
  }

  function start() {
    if (ctx || !AC) return !!ctx;
    try { ctx = new AC(); } catch { ctx = null; return false; }
    hlavny = ctx.createGain(); hlavny.gain.value = zapnuty ? 1 : 0; hlavny.connect(ctx.destination);
    sum = sumBuffer();
    // vietor: filtrovaný šum, pomaly dýcha (hlasitosť sa mení LFO), −28 dBFS
    const src = ctx.createBufferSource(); src.buffer = sum; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 0.7;
    const g = ctx.createGain(); g.gain.value = DB(-28);
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.07; lg.gain.value = DB(-34);
    lfo.connect(lg); lg.connect(g.gain);
    const lfo2 = ctx.createOscillator(), lg2 = ctx.createGain(); lfo2.frequency.value = 0.11; lg2.gain.value = 180;
    lfo2.connect(lg2); lg2.connect(f.frequency);
    src.connect(f); f.connect(g); g.connect(hlavny); src.start(); lfo.start(); lfo2.start();
    vietor = g;
    dalsieVrzgnutie = ctx.currentTime + 3;
    return true;
  }

  function obalka(g, t, utok, dlzka, vrchol) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vrchol, t + utok);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dlzka);
  }
  function ton(freq, dlzka, vrchol, typ = 'sine', kedy = 0, sklz = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + kedy, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = typ; o.frequency.setValueAtTime(freq, t);
    if (sklz) o.frequency.exponentialRampToValueAtTime(freq * sklz, t + dlzka);
    obalka(g, t, 0.004, dlzka, vrchol);
    o.connect(g); g.connect(hlavny); o.start(t); o.stop(t + dlzka + 0.02);
  }
  function sumik(dlzka, vrchol, freq, q = 1, kedy = 0, typ = 'bandpass') {
    if (!ctx) return;
    const t = ctx.currentTime + kedy, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = sum; f.type = typ; f.frequency.value = freq; f.Q.value = q;
    obalka(g, t, 0.002, dlzka, vrchol);
    s.connect(f); f.connect(g); g.connect(hlavny); s.start(t, Math.random() * 1.5); s.stop(t + dlzka + 0.02);
  }

  return {
    start,
    get bezi() { return !!ctx; },
    get zapnuty() { return zapnuty; },
    prepni(z) {
      zapnuty = z;
      if (ctx) { hlavny.gain.setTargetAtTime(z ? 1 : 0, ctx.currentTime, 0.05); if (z && ctx.state === 'suspended') ctx.resume(); }
    },
    uspi() { if (ctx && ctx.state === 'running') ctx.suspend(); },
    zobud() { if (ctx && ctx.state === 'suspended' && zapnuty) ctx.resume(); },
    // drevený ťuk 60 ms, výška podľa budovy
    tuk(budova = 1) { ton(PENTATONIKA[(budova * 2 + 1) % PENTATONIKA.length] * 2, 0.06, 0.22, 'triangle'); sumik(0.03, 0.08, 2400, 2); },
    // cinknutie mince 80 ms
    minca() { ton(1318.5, 0.08, 0.07); ton(1975.5, 0.07, 0.04, 'sine', 0.035); },
    // kladivo na klinec 90 ms
    kupa() { sumik(0.05, 0.25, 900, 1.5); ton(140, 0.09, 0.3, 'sine', 0, 0.6); ton(2600, 0.06, 0.05, 'square', 0.005); },
    // míľnik: tri údery kladiva nahor a „ťuk ťuk ťuk“, 400 ms
    milnik() { for (let i = 0; i < 3; i++) { sumik(0.05, 0.22, 900 + i * 200, 1.5, i * 0.13); ton(PENTATONIKA[2 + i * 2] * 2, 0.08, 0.2, 'triangle', i * 0.13); } },
    // najatie: zvonček pultu
    najatie() { ton(1760, 0.5, 0.12); ton(2637, 0.4, 0.06, 'sine', 0.01); },
    // nábytok dosadne
    nabytok() { ton(110, 0.12, 0.35, 'sine', 0, 0.7); sumik(0.06, 0.12, 600, 1); },
    // studňa: vedro o kameň a špľachnutie
    vedro() { ton(520, 0.12, 0.12, 'triangle', 0, 0.8); sumik(0.35, 0.12, 1800, 0.6, 0.12, 'highpass'); },
    // prázdny ťuk (obchod už beží)
    tlmeny() { ton(160, 0.05, 0.08, 'triangle'); },
    // interiér: fasáda sa zdvihne
    fasada() { sumik(0.3, 0.06, 500, 0.8); },
    // vŕzganie veterníka každých 6 až 12 s; volá hra v každej snímke, zvuk si stráži čas sám
    vrzganie(rychlost = 1) {
      if (!ctx || ctx.currentTime < dalsieVrzgnutie) return;
      dalsieVrzgnutie = ctx.currentTime + 6 + Math.random() * 6;
      if (rychlost <= 0) return;
      ton(300 + Math.random() * 60, 0.35, 0.035, 'sawtooth', 0, 1.25);
      ton(340 + Math.random() * 60, 0.25, 0.025, 'sawtooth', 0.4, 0.85);
    }
  };
}
