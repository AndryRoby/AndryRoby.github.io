/* Zvuk: vsetko syntetizovane cez Web Audio, ziadny subor. AudioContext vznikne
 * az po prvom geste hraca. Jeden kratky buffer bieleho sumu sa vytvori raz a z neho
 * filtrami vznikaju kroky, sustenie papiera, vlecenie, praskanie uhlikov a tlmene hlasy.
 * Plánuje sa casom AudioContext, nie casovacmi JS. Pri document.hidden sa kontext uspi.
 * Kazdy zvuk vracia titulok so smerom, aby sa dalo hrat bez sluchu. */
let ac = null, hlavny = null, sum = null, dron = null;
let hlasitost = 0.7, ticho = false;

export function zvukPriprav() {
  /* bez skutocneho gesta hraca zvuk nevznika (prehliadac by ho aj tak nepustil) */
  if (navigator.userActivation && !navigator.userActivation.isActive && !(ac && navigator.userActivation.hasBeenActive)) return;
  if (ac) { if (ac.state === 'suspended' && !document.hidden) ac.resume().catch(() => {}); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try { ac = new AC(); } catch { ac = null; return; }
  hlavny = ac.createGain();
  hlavny.gain.value = ticho ? 0 : hlasitost;
  hlavny.connect(ac.destination);
  const n = ac.sampleRate * 2;
  sum = ac.createBuffer(1, n, ac.sampleRate);
  const d = sum.getChannelData(0);
  let a = 12345;
  for (let i = 0; i < n; i++) { a = (a * 1103515245 + 12345) & 0x7fffffff; d[i] = (a / 0x7fffffff) * 2 - 1; }
  document.addEventListener('visibilitychange', () => {
    if (!ac) return;
    if (document.hidden) ac.suspend().catch(() => {}); else ac.resume().catch(() => {});
  });
}
export function zvukNastav(h, t) {
  hlasitost = h; ticho = t;
  if (hlavny) hlavny.gain.setTargetAtTime(ticho ? 0 : hlasitost, ac.currentTime, 0.05);
}
const ide = () => ac && !ticho && ac.state !== 'closed';

function sumZdroj(t, trvanie, filter, f, q, zisk, pan, obalka) {
  const s = ac.createBufferSource();
  s.buffer = sum;
  s.loop = true;
  const fl = ac.createBiquadFilter();
  fl.type = filter; fl.frequency.value = f; fl.Q.value = q || 0.7;
  const g = ac.createGain();
  g.gain.value = 0;
  let uzol = g;
  s.connect(fl); fl.connect(g);
  if (pan && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = pan; g.connect(p); uzol = p; }
  uzol.connect(hlavny);
  obalka(g.gain, t, zisk);
  s.start(t, Math.random() * 1.5);
  s.stop(t + trvanie + 0.1);
  return { s, fl, g };
}

export const zvuk = {
  kroky(pan = -0.7, n = 6) {
    if (!ide()) return 'Footsteps in the corridor';
    const t0 = ac.currentTime + 0.05;
    for (let i = 0; i < n; i++) {
      const t = t0 + i * 0.52 + (Math.random() - 0.5) * 0.04;
      const z = 0.25 + (i / n) * 0.35;
      sumZdroj(t, 0.16, 'bandpass', 320 + Math.random() * 90, 1.4, z, pan, (g, t1, v) => { g.setValueAtTime(0, t1); g.linearRampToValueAtTime(v, t1 + 0.008); g.exponentialRampToValueAtTime(0.001, t1 + 0.14); });
      sumZdroj(t, 0.05, 'highpass', 2400, 0.7, z * 0.12, pan, (g, t1, v) => { g.setValueAtTime(v, t1); g.exponentialRampToValueAtTime(0.001, t1 + 0.04); });
    }
    return 'Footsteps in the corridor';
  },
  kvapka() {
    if (!ide()) return '';
    const t = ac.currentTime + 0.02;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(1500 + Math.random() * 500, t);
    o.frequency.exponentialRampToValueAtTime(420, t + 0.09);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.09, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.22);
    const p = ac.createStereoPanner ? ac.createStereoPanner() : null;
    o.connect(g);
    if (p) { p.pan.value = Math.random() * 1.4 - 0.7; g.connect(p); p.connect(hlavny); } else g.connect(hlavny);
    o.start(t); o.stop(t + 0.3);
    return '';
  },
  papier(sila = 1) {
    if (!ide()) return 'Paper rustles';
    const t = ac.currentTime + 0.01;
    sumZdroj(t, 0.45, 'highpass', 2600, 0.8, 0.09 * sila, 0, (g, t1, v) => {
      g.setValueAtTime(0, t1);
      for (let i = 0; i < 7; i++) g.linearRampToValueAtTime(v * (0.3 + Math.random() * 0.7), t1 + 0.02 + i * 0.055);
      g.linearRampToValueAtTime(0, t1 + 0.44);
    });
    return 'Paper rustles';
  },
  vlecenie(pan = 0.6) {
    if (!ide()) return 'Something heavy drags along the passage';
    const t = ac.currentTime + 0.05;
    for (let i = 0; i < 3; i++) {
      sumZdroj(t + i * 1.3, 1.1, 'lowpass', 520, 0.6, 0.22, pan, (g, t1, v) => { g.setValueAtTime(0, t1); g.linearRampToValueAtTime(v, t1 + 0.4); g.linearRampToValueAtTime(v * 0.6, t1 + 0.8); g.linearRampToValueAtTime(0, t1 + 1.1); });
    }
    return 'Something heavy drags along the passage';
  },
  kamen() {
    if (!ide()) return 'Stone grinds on stone';
    const t = ac.currentTime + 0.02;
    sumZdroj(t, 0.7, 'bandpass', 180, 2, 0.3, 0, (g, t1, v) => { g.setValueAtTime(0, t1); g.linearRampToValueAtTime(v, t1 + 0.1); g.linearRampToValueAtTime(v * 0.7, t1 + 0.5); g.linearRampToValueAtTime(0, t1 + 0.7); });
    return 'Stone grinds on stone';
  },
  hlasy(pan = 0.7) {
    if (!ide()) return 'Muffled voices above';
    const t0 = ac.currentTime + 0.05;
    for (let i = 0; i < 14; i++) {
      const t = t0 + i * 0.28 + Math.random() * 0.12, f = 380 + Math.random() * 300;
      sumZdroj(t, 0.3, 'bandpass', f, 6, 0.16, pan, (g, t1, v) => { g.setValueAtTime(0, t1); g.linearRampToValueAtTime(v, t1 + 0.06); g.linearRampToValueAtTime(0, t1 + 0.26); });
    }
    return 'Muffled voices above';
  },
  praskanie(trvanie = 3) {
    if (!ide()) return 'Embers crackle';
    const t0 = ac.currentTime + 0.02;
    for (let i = 0; i < trvanie * 9; i++) {
      const t = t0 + Math.random() * trvanie;
      sumZdroj(t, 0.03, 'highpass', 1800 + Math.random() * 2000, 0.8, 0.12 * Math.random(), Math.random() * 0.6 - 0.3, (g, t1, v) => { g.setValueAtTime(v, t1); g.exponentialRampToValueAtTime(0.001, t1 + 0.025); });
    }
    return 'Embers crackle';
  },
  /* uder hodin: ciastkove tony zvona s exponencialnym doznievanim */
  hodiny(n = 6, rozostup = 1.7) {
    if (!ide()) return 'A clock strikes';
    const t0 = ac.currentTime + 0.1;
    const f0 = 196;
    for (let i = 0; i < n; i++) {
      const t = t0 + i * rozostup;
      [[1, 0.2, 3.2], [2.76, 0.1, 1.9], [5.4, 0.05, 1.1], [8.93, 0.03, 0.6], [0.5, 0.08, 3.8]].forEach(([m, v, d]) => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = 'sine'; o.frequency.value = f0 * m;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0005, t + d);
        o.connect(g); g.connect(hlavny); o.start(t); o.stop(t + d + 0.05);
      });
    }
    return 'A clock strikes';
  },
  zamok() {
    if (!ide()) return '';
    const t = ac.currentTime + 0.02;
    [[523.25, 0.07, 1.4], [784, 0.04, 1.0]].forEach(([f, v, d], i) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t + i * 0.09); g.gain.linearRampToValueAtTime(v, t + i * 0.09 + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, t + i * 0.09 + d);
      o.connect(g); g.connect(hlavny); o.start(t + i * 0.09); o.stop(t + i * 0.09 + d + 0.05);
    });
    return '';
  },
  plamen(trvanie = 2) {
    if (!ide()) return 'A small flame';
    const t = ac.currentTime + 0.02;
    sumZdroj(t, trvanie, 'lowpass', 900, 0.7, 0.06, 0, (g, t1, v) => { g.setValueAtTime(0, t1); g.linearRampToValueAtTime(v, t1 + 0.3); g.linearRampToValueAtTime(v, t1 + trvanie - 0.4); g.linearRampToValueAtTime(0, t1 + trvanie); });
    return 'A small flame';
  },
  /* kapitola 69: klepanie na drevene dvere, okienko, kocar na dlazbe, tikot hodin, dvere, tienidlo, latka */
  klepanie(pan = -0.4) {
    if (!ide()) return 'Knocking at a wooden door';
    const t0 = ac.currentTime + 0.05;
    [0, 0.26, 0.5].forEach((d) => sumZdroj(t0 + d, 0.12, 'bandpass', 240, 3, 0.5, pan, (g, t1, v) => { g.setValueAtTime(0, t1); g.linearRampToValueAtTime(v, t1 + 0.004); g.exponentialRampToValueAtTime(0.001, t1 + 0.1); }));
    return 'Knocking at a wooden door';
  },
  okienko(pan = -0.3) {
    if (!ide()) return 'A small wooden wicket slides open';
    const t = ac.currentTime + 0.02;
    sumZdroj(t, 0.3, 'bandpass', 900, 2, 0.12, pan, (g, t1, v) => { g.setValueAtTime(0, t1); g.linearRampToValueAtTime(v, t1 + 0.05); g.linearRampToValueAtTime(0, t1 + 0.28); });
    sumZdroj(t + 0.3, 0.08, 'bandpass', 420, 4, 0.3, pan, (g, t1, v) => { g.setValueAtTime(v, t1); g.exponentialRampToValueAtTime(0.001, t1 + 0.07); });
    return 'A small wooden wicket slides open';
  },
  kocar(pan = 0) {
    if (!ide()) return 'A carriage on the cobbles';
    const t0 = ac.currentTime + 0.05;
    sumZdroj(t0, 3, 'lowpass', 300, 0.7, 0.16, pan, (g, t1, v) => { g.setValueAtTime(0, t1); g.linearRampToValueAtTime(v, t1 + 0.6); g.linearRampToValueAtTime(v, t1 + 2.2); g.linearRampToValueAtTime(0, t1 + 3); });
    for (let i = 0; i < 12; i++) {
      const t = t0 + 0.2 + i * 0.22 + Math.random() * 0.03;
      sumZdroj(t, 0.06, 'bandpass', 700 + Math.random() * 300, 2, 0.12, pan, (g, t1, v) => { g.setValueAtTime(v, t1); g.exponentialRampToValueAtTime(0.001, t1 + 0.05); });
    }
    return 'A carriage on the cobbles';
  },
  tikot(pan = 0.6, n = 8) {
    if (!ide()) return 'A clock ticks beyond the wall';
    const t0 = ac.currentTime + 0.05;
    for (let i = 0; i < n; i++) sumZdroj(t0 + i * 0.5, 0.03, 'bandpass', i % 2 ? 2600 : 3200, 6, 0.1, pan, (g, t1, v) => { g.setValueAtTime(v, t1); g.exponentialRampToValueAtTime(0.001, t1 + 0.025); });
    return 'A clock ticks beyond the wall';
  },
  dvereZatvor(pan = 0.6) {
    if (!ide()) return 'A door closes';
    const t = ac.currentTime + 0.05;
    sumZdroj(t, 0.4, 'lowpass', 160, 1, 0.5, pan, (g, t1, v) => { g.setValueAtTime(0, t1); g.linearRampToValueAtTime(v, t1 + 0.01); g.exponentialRampToValueAtTime(0.001, t1 + 0.35); });
    sumZdroj(t + 0.02, 0.06, 'bandpass', 1400, 3, 0.1, pan, (g, t1, v) => { g.setValueAtTime(v, t1); g.exponentialRampToValueAtTime(0.001, t1 + 0.05); });
    return 'A door closes';
  },
  cvak() {
    if (!ide()) return 'The shade clicks';
    const t = ac.currentTime + 0.02;
    sumZdroj(t, 0.05, 'bandpass', 2000, 5, 0.18, 0, (g, t1, v) => { g.setValueAtTime(v, t1); g.exponentialRampToValueAtTime(0.001, t1 + 0.04); });
    return 'The shade clicks';
  },
  latka(pan = 0) {
    if (!ide()) return 'Cloth rustles';
    const t = ac.currentTime + 0.01;
    sumZdroj(t, 0.6, 'bandpass', 1200, 0.8, 0.1, pan, (g, t1, v) => { g.setValueAtTime(0, t1); for (let i = 0; i < 6; i++) g.linearRampToValueAtTime(v * (0.4 + Math.random() * 0.6), t1 + 0.05 + i * 0.08); g.linearRampToValueAtTime(0, t1 + 0.58); });
    return 'Cloth rustles';
  },
  /* tichy dron v celach: dva mierne rozladene oscilatory cez dolny priepust */
  dron(zap, rychlo) {
    if (!ac) return;
    const t = ac.currentTime;
    if (zap && !dron) {
      const g = ac.createGain(), f = ac.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 170; f.Q.value = 0.4;
      g.gain.value = 0;
      const os = [55, 55.6, 82.4].map((fr, i) => { const o = ac.createOscillator(); o.type = i === 2 ? 'sine' : 'sawtooth'; o.frequency.value = fr; o.connect(f); o.start(); return o; });
      f.connect(g); g.connect(hlavny);
      g.gain.setTargetAtTime(0.05, t, 2.5);
      dron = { g, os };
    } else if (!zap && dron) {
      const d = dron; dron = null;
      d.g.gain.setTargetAtTime(0, t, rychlo ? 0.6 : 2.4);
      setTimeout(() => d.os.forEach((o) => { try { o.stop(); } catch {} }), rychlo ? 4000 : 12000);
    }
  },
};
