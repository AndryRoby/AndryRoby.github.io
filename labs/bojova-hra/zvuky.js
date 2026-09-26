// Tumble Dojo: zvuky syntetizované raz po prvom geste, žiadne súbory. V snímke len jeden zdroj na prehratie.
import { nastavenie } from './ovladanie.js';

let ac = null, hlas = null;
const BUF = [];
let R = 44100, x0 = 12345;
const sum = () => { x0 = (x0 * 1103515245 + 12345) & 0x7fffffff; return x0 / 0x7fffffff * 2 - 1; };
// tón f0 -> f1 s doznením
function ton(d, t0, dur, f0, f1, amp, dec, pila) {
  const a = Math.round(t0 * R), n = Math.round(dur * R);
  for (let i = 0, ph = 0; i < n && a + i < d.length; i++) {
    const t = i / R, f = f0 + (f1 - f0) * (t / dur); ph += f / R;
    const w = pila ? (ph % 1) * 2 - 1 : Math.sin(6.2832 * ph);
    d[a + i] += w * amp * Math.exp(-t * dec);
  }
}
// šum cez pásmový filter c0 -> c1
function sus(d, t0, dur, c0, c1, amp, dec, q) {
  const a = Math.round(t0 * R), n = Math.round(dur * R); let lo = 0, bp = 0;
  for (let i = 0; i < n && a + i < d.length; i++) {
    const t = i / R, c = c0 + (c1 - c0) * (t / dur), f = 2 * Math.sin(3.1416 * c / R);
    const hi = sum() - lo - q * bp; bp += f * hi; lo += f * bp;
    const obal = Math.min(1, t * 200) * Math.exp(-t * dec);
    d[a + i] += bp * amp * obal;
  }
}
function tuk(d, t0, k) {
  const a = Math.round(t0 * R), n = Math.round(0.11 * R);
  for (let i = 0, ph = 0; i < n && a + i < d.length; i++) {
    const t = i / R; ph += 6.2832 * (70 + 120 * Math.exp(-t * 38)) * k / R;
    d[a + i] += (Math.sin(ph) * 0.9 + (i < 180 ? sum() * 0.4 : 0)) * Math.exp(-t * 30);
  }
}
// 0 tuk, 1 až 11 kombinácie (poradie kombo.js), 12 dupnutie, 13 COMBO FINISH
const RECEPT = [
  (d) => tuk(d, 0, 1),
  (d) => { tuk(d, 0, 1); ton(d, 0, 0.06, 1100, 1100, 0.5, 60); ton(d, 0, 0.04, 2200, 2200, 0.15, 90); },
  (d) => { tuk(d, 0, 1); tuk(d, 0.05, 1.5); },
  (d) => sus(d, 0, 0.16, 400, 1600, 1.4, 14, 0.5),
  (d) => { sus(d, 0, 0.14, 500, 1400, 1.2, 16, 0.5); tuk(d, 0.12, 1.1); },
  (d) => { sus(d, 0, 0.3, 1400, 300, 1.4, 7, 0.45); tuk(d, 0.26, 0.9); },
  (d) => { tuk(d, 0, 1); tuk(d, 0.09, 1.2); },
  (d) => { for (let i = 0; i < 3; i++) ton(d, i * 0.07, 0.04, 70, 55, 0.6, 40); tuk(d, 0.21, 1); },
  (d) => { sus(d, 0, 0.22, 3000, 2200, 0.9, 16, 1.2); tuk(d, 0.02, 0.6); },
  (d) => { sus(d, 0, 0.14, 600, 1300, 1.1, 18, 0.5); sus(d, 0.12, 0.03, 4200, 4200, 1.3, 60, 0.8); },
  (d) => { ton(d, 0, 0.3, 80, 80, 0.6, 5); sus(d, 0, 0.3, 200, 200, 0.5, 5, 0.9); for (let i = 0; i < 3; i++) ton(d, 0.05 + i * 0.09, 0.04, 70, 55, 0.4, 40); },
  (d) => { const a = 0, n = Math.round(0.25 * R); for (let i = 0, ph = 0; i < n; i++) { const t = i / R; ph += (180 + 25 * Math.sin(t * 90)) / R; d[a + i] += ((ph % 1) * 2 - 1) * 0.35 * Math.exp(-t * 9) * (0.6 + 0.4 * Math.sin(t * 140)); } sus(d, 0.05, 0.15, 900, 500, 0.9, 14, 0.5); },
  (d) => { ton(d, 0, 0.4, 60, 40, 1, 7); sus(d, 0, 0.4, 150, 90, 1.2, 8, 0.8); },
  (d) => { tuk(d, 0, 1.2); ton(d, 0.03, 0.12, 523, 523, 0.35, 14); ton(d, 0.11, 0.12, 659, 659, 0.35, 14); ton(d, 0.19, 0.22, 784, 784, 0.4, 9); }
];
export function priprav() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  try {
    ac = new AudioContext(); R = ac.sampleRate;
    for (let i = 0; i < RECEPT.length; i++) {
      const b = ac.createBuffer(1, Math.round(R * 0.45), R), d = b.getChannelData(0);
      x0 = 12345 + i * 77; RECEPT[i](d);
      let mx = 0; for (let k = 0; k < d.length; k++) { const v = d[k] < 0 ? -d[k] : d[k]; if (v > mx) mx = v; }
      if (mx > 1) for (let k = 0; k < d.length; k++) d[k] /= mx;
      BUF.push(b);
    }
    hlas = ac.createGain(); hlas.gain.value = 0.55; hlas.connect(ac.destination);
  } catch (e) { ac = null; }
}
export function hraj(i) {
  if (!ac || ac.state !== 'running' || !nastavenie.sound || !BUF[i]) return;
  const z = ac.createBufferSource(); z.buffer = BUF[i]; z.connect(hlas); z.start();
}
