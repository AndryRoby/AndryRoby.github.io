/* Otters (Slitherlink) pre knihu: mriežka bodiek, čísla v políčkach, slučka po
   čiarach mriežky. Zadanie sú len bodky a čísla, riešenie pridá slučku a čísla
   stlmí do sivej, aby bola nakreslená rieka to prvé, čo oko uvidí. */
import { S, CIARA, STREDNA, obal, ciara, kruh, text } from './spolocne.mjs';

const P = 30; // okraj okolo krajných bodiek, aby sa slučka na okraji neorezala

function bodky(n, r) {
  const out = [];
  for (let y = 0; y <= n; y++) for (let x = 0; x <= n; x++) out.push(kruh(P + x * S, P + y * S, r, '#000'));
  return out.join('');
}

function cisla(p, farba) {
  const n = p.n, out = [];
  for (let i = 0; i < n * n; i++) {
    const k = p.clues[i];
    if (k == null) continue;
    const r = (i / n) | 0, cc = i % n;
    out.push(text(P + cc * S + S / 2, P + r * S + S / 2, k, 54, { farba }));
  }
  return out.join('');
}

function slucka(p) {
  const n = p.n, e = p.solution, out = [];
  for (let r = 0; r <= n; r++) {
    for (let cc = 0; cc < n; cc++) {
      if (e.h[r * n + cc] === 1) out.push(ciara(P + cc * S, P + r * S, P + (cc + 1) * S, P + r * S, CIARA, '#000', 'round'));
    }
  }
  for (let r = 0; r < n; r++) {
    for (let cc = 0; cc <= n; cc++) {
      if (e.v[r * (n + 1) + cc] === 1) out.push(ciara(P + cc * S, P + r * S, P + cc * S, P + (r + 1) * S, CIARA, '#000', 'round'));
    }
  }
  return out.join('');
}

export function zadanie(p) {
  const w = p.n * S + 2 * P;
  return obal(w, w, bodky(p.n, 7) + cisla(p, '#000'));
}

export function riesenie(p) {
  const w = p.n * S + 2 * P;
  return obal(w, w, bodky(p.n, 5) + cisla(p, STREDNA) + slucka(p));
}

export const popisMriezky = (p) => p.n + ' x ' + p.n;
