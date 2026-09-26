/* Field Notes: jemný zvuk (M0, 26. 9. 2026).
 * Predvolene vypnutý (ops/spec-hry-ux.md, časť 7). Web Audio, žiadne súbory:
 * nájdené slovo je jeden mäkký tón pentatoniky (každé ďalšie o stupeň vyššie),
 * hotová strana krátky rozklad akordu, ťah perom takmer nepočuteľné ťuknutie.
 * Nič nehrá samo od seba; kontext sa vytvorí až po geste hráča. */
let ctx = null;
let hlavny = null;
let zapnuty = false;
let posledny = 0;
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];

function kontext() {
  if (!ctx) {
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return null;
    ctx = new AC();
    hlavny = ctx.createGain();
    hlavny.gain.value = 0.9;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 3200;
    hlavny.connect(filter).connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function ton(frekv, oKolko, dlzka, sila, typ = 'sine') {
  const c = kontext();
  if (!c) return;
  const t = c.currentTime + oKolko;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = typ;
  o.frequency.value = frekv;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(sila, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dlzka);
  o.connect(g).connect(hlavny);
  o.start(t);
  o.stop(t + dlzka + 0.05);
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(() => {});
    else if (zapnuty) ctx.resume().catch(() => {});
  });
}

export const zvuk = {
  nastav(on) {
    zapnuty = !!on;
    if (zapnuty) kontext();
    else if (ctx) ctx.suspend().catch(() => {});
  },
  jeZapnuty: () => zapnuty,
  tik() {
    if (!zapnuty) return;
    const t = performance.now();
    if (t - posledny < 55) return;
    posledny = t;
    ton(2100, 0, 0.035, 0.01, 'triangle');
  },
  najdene(poradie) {
    if (!zapnuty) return;
    const f = 392 * 2 ** (PENTA[poradie % PENTA.length] / 12);
    ton(f, 0, 1.1, 0.07);
    ton(f * 2, 0, 0.45, 0.014);
  },
  hotovo() {
    if (!zapnuty) return;
    [0, 4, 7, 12].forEach((s, k) => ton(392 * 2 ** (s / 12), k * 0.13, 1.6, 0.045));
  },
};
