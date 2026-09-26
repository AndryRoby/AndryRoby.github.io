// UNSCORED: štyri zvuky cez Web Audio, bez súborov. AudioContext vzniká až po prvom ťuku.
// úder klávesu (ťuk), zvonček (nový človek), šum rádia (ZERO), hlboký tón (zaklopanie, pečiatka).

const KLUC = 'unscored.zvuk';
const PENTATONIKA = [523.25, 587.33, 659.25, 783.99, 880];

export class Zvuk {
  constructor() {
    this.ctx = null;
    this.zapnuty = true;
    try {
      this.zapnuty = localStorage.getItem(KLUC) !== 'vyp';
    } catch {
      /* súkromné okno: zvuk ostáva zapnutý, voľba sa neuloží */
    }
    this.poslZvoncek = 0;
    this.i = 0;
  }

  /** Volá sa pri prvom ťuku (gesto používateľa). */
  odomkni() {
    if (this.ctx || typeof window === 'undefined') return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.hlavny = this.ctx.createGain();
      this.hlavny.gain.value = this.zapnuty ? 1 : 0;
      this.hlavny.connect(this.ctx.destination);
      const n = Math.round(this.ctx.sampleRate * 0.6);
      this.sum = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      const d = this.sum.getChannelData(0);
      let b = 0;
      for (let i = 0; i < n; i++) {
        const w = Math.random() * 2 - 1;
        b = 0.97 * b + 0.03 * w;
        d[i] = w * 0.7 + b * 2.2;
      }
    } catch {
      this.ctx = null;
    }
  }

  /** Na dotyku dáva prehliadač povolenie zvuku až pri zdvihnutí prsta: vtedy kontext prebudíme. */
  prebud() {
    this.odomkni();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  prepni() {
    this.zapnuty = !this.zapnuty;
    try {
      localStorage.setItem(KLUC, this.zapnuty ? 'zap' : 'vyp');
    } catch {
      /* nič */
    }
    if (this.hlavny) this.hlavny.gain.setTargetAtTime(this.zapnuty ? 1 : 0, this.ctx.currentTime, 0.02);
    return this.zapnuty;
  }

  _ok() {
    if (!this.ctx || !this.zapnuty) return false;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  }

  _obalka(g, t, hlasitost, nabeh, dozvuk) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(hlasitost, t + nabeh);
    g.gain.exponentialRampToValueAtTime(0.0001, t + nabeh + dozvuk);
  }

  /** Úder klávesu písacieho stroja: šum cez pásmový filter, každý trochu iný, plus klik. */
  tuk() {
    if (!this._ok()) return;
    const c = this.ctx;
    const t = c.currentTime + 0.001;
    const src = c.createBufferSource();
    src.buffer = this.sum;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1800 + ((this.i++ * 373) % 800);
    f.Q.value = 1.3;
    const g = c.createGain();
    this._obalka(g, t, 0.22, 0.001, 0.018);
    src.connect(f).connect(g).connect(this.hlavny);
    src.start(t, Math.random() * 0.4, 0.03);
    const o = c.createOscillator();
    o.frequency.value = 3000;
    const g2 = c.createGain();
    this._obalka(g2, t, 0.05, 0.0005, 0.004);
    o.connect(g2).connect(this.hlavny);
    o.start(t);
    o.stop(t + 0.01);
  }

  /** Jemný zvonček pri novom človeku, najviac jeden za 250 ms. */
  zvoncek(oneskorenie = 0) {
    if (!this._ok()) return;
    const c = this.ctx;
    const t = c.currentTime + oneskorenie;
    if (t - this.poslZvoncek < 0.25) return;
    this.poslZvoncek = t;
    const f = PENTATONIKA[(this.i++ * 3) % PENTATONIKA.length];
    for (const [nasob, hl] of [[1, 0.12], [2.76, 0.035]]) {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * nasob;
      const g = c.createGain();
      this._obalka(g, t, hl, 0.005, nasob === 1 ? 0.9 : 0.4);
      o.connect(g).connect(this.hlavny);
      o.start(t);
      o.stop(t + 1);
    }
  }

  /** Šum starého rádia pod vetou ZERO. */
  radio() {
    if (!this._ok()) return;
    const c = this.ctx;
    const t = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this.sum;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1200;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.06);
    g.gain.setValueAtTime(0.05, t + 0.35);
    g.gain.linearRampToValueAtTime(0.0001, t + 0.55);
    src.connect(f).connect(g).connect(this.hlavny);
    src.start(t, 0, 0.56);
  }

  /** Hlboký tón: zaklopanie (dva údery) alebo pečiatka (jeden). */
  klop(udery = 2) {
    if (!this._ok()) return;
    const c = this.ctx;
    for (let k = 0; k < udery; k++) {
      const t = c.currentTime + k * 0.18;
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(92, t);
      o.frequency.exponentialRampToValueAtTime(52, t + 0.2);
      const g = c.createGain();
      this._obalka(g, t, 0.35, 0.004, 0.25);
      o.connect(g).connect(this.hlavny);
      o.start(t);
      o.stop(t + 0.3);
    }
  }
}
