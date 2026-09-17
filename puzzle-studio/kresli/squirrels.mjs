/* Squirrels (Kakuro) pre knihu: kmene sú sivé políčka preťaté uhlopriečkou,
   súčet behu doprava je nad ňou, súčet behu dole pod ňou. Sivá je svetlá
   zámerne: kmeňov je na doske veľa a plne čierne políčka by z každej strany
   spravili plochu tonera, pričom rozdiel oproti bielej dutine je aj takto
   jednoznačný.
   Uhlopriečka je na oboch koncoch skrátená o pár jednotiek, inak sa
   uhlopriečky susedných kmeňov spoja do jednej dlhej čiary cez pol dosky a
   nie je vidieť, kde jeden kmeň končí a druhý začína.
   Na strane s riešeniami sa súčty ani uhlopriečky nekreslia: čísla behov už
   nikto nepotrebuje a v šestine strany by sa aj tak nedali prečítať. */
import { S, TENKA, HRUBA, obal, ciara, obdlznik, text } from './spolocne.mjs';

const P = 16;
const KMEN = '#cfcfcf';
const SKRAT = 4;

function doska(p, znaky) {
  const n = p.n, out = [];
  for (let i = 0; i < n * n; i++) {
    if (p.cells[i] === null) continue;
    const r = (i / n) | 0, c = i % n;
    const x = P + c * S, y = P + r * S;
    out.push(obdlznik(x, y, S, S, KMEN));
    if (!znaky) continue;
    const { r: vpravo, d: dole } = p.cells[i];
    if (vpravo != null || dole != null) {
      out.push(ciara(x + SKRAT, y + SKRAT, x + S - SKRAT, y + S - SKRAT, 5));
    }
    if (vpravo != null) out.push(text(x + 0.72 * S, y + 0.26 * S, vpravo, 33, { tucne: true }));
    if (dole != null) out.push(text(x + 0.28 * S, y + 0.74 * S, dole, 33, { tucne: true }));
  }
  for (let k = 1; k < n; k++) {
    out.push(ciara(P, P + k * S, P + n * S, P + k * S, TENKA));
    out.push(ciara(P + k * S, P, P + k * S, P + n * S, TENKA));
  }
  out.push(obdlznik(P, P, n * S, n * S, 'none', '#000', HRUBA));
  return out.join('');
}

export function zadanie(p) {
  const w = p.n * S + 2 * P;
  return obal(w, w, doska(p, true));
}

export function riesenie(p) {
  const n = p.n, w = n * S + 2 * P, out = [doska(p, false)];
  for (let i = 0; i < n * n; i++) {
    if (p.cells[i] !== null) continue;
    const r = (i / n) | 0, c = i % n;
    out.push(text(P + c * S + S / 2, P + r * S + S / 2, p.solution[i], 54));
  }
  return obal(w, w, out.join(''));
}

export const popisMriezky = (p) => p.n + ' x ' + p.n;
