/* Cranes (Hashi) pre knihu: piesočiny ako krúžky s číslom, lávky ako rovné
   čiary medzi nimi, dvojitá lávka ako dve rovnobežky. Čiary sa zastavia na
   okraji krúžku, aby neprešli cez číslo; krúžky sa kreslia až nakoniec s bielou
   výplňou, takže ich žiadna lávka neprečiarkne.

   Mriežka sa pred kreslením stiahne: generátor rozloží piesočiny na
   vybrané riadky a stĺpce n x n mriežky a medzi nimi ostávajú prázdne pásy,
   ktoré na papieri len uberajú miesto. Prázdne riadky a stĺpce sa preto
   vyhodia a piesočiny sa prečíslujú na hustú mriežku. Hlavolam to nemení:
   pravidlá hovoria len o tom, ktoré dve piesočiny stoja v jednom rade s ničím
   medzi sebou, a to rastúce prečíslovanie riadkov a stĺpcov zachováva, rovnako
   ako to, ktoré dvojice lávok by sa krížili. */
import { S, obal, ciara, kruh, text } from './spolocne.mjs';

const P = 26;
const R = 33;      // polomer piesočiny
const ODSTUP = 13; // polovica rozostupu dvojitej lávky

/* Hustá mriežka: pre každú piesočinu nové (r, c) a rozmery dosky.
   Krúžky potom nie sú väčšie, len bližšie pri sebe: o to, aby jeden hlavolam
   nezabral celú stranu, sa stará strop na veľkosť políčka v postav.mjs. */
function stiahni(p) {
  const riadky = [...new Set(p.islands.map((o) => o.r))].sort((a, b) => a - b);
  const stlpce = [...new Set(p.islands.map((o) => o.c))].sort((a, b) => a - b);
  const dr = new Map(riadky.map((v, i) => [v, i]));
  const dc = new Map(stlpce.map((v, i) => [v, i]));
  return {
    riadkov: riadky.length, stlpcov: stlpce.length,
    kde: p.islands.map((o) => ({ r: dr.get(o.r), c: dc.get(o.c), n: o.n })),
  };
}

const stred = (o) => [P + o.c * S + S / 2, P + o.r * S + S / 2];

function lavky(p, m) {
  const out = [];
  for (const b of p.bridges) {
    const a = stred(m.kde[b.a]), z = stred(m.kde[b.b]);
    const vodorovna = a[1] === z[1];
    const [x1, y1, x2, y2] = vodorovna
      ? [Math.min(a[0], z[0]) + R - 2, a[1], Math.max(a[0], z[0]) - R + 2, a[1]]
      : [a[0], Math.min(a[1], z[1]) + R - 2, a[0], Math.max(a[1], z[1]) - R + 2];
    if (b.k >= 2) {
      const dx = vodorovna ? 0 : ODSTUP, dy = vodorovna ? ODSTUP : 0;
      out.push(ciara(x1 - dx, y1 - dy, x2 - dx, y2 - dy, 7, '#000', 'butt'));
      out.push(ciara(x1 + dx, y1 + dy, x2 + dx, y2 + dy, 7, '#000', 'butt'));
    } else {
      out.push(ciara(x1, y1, x2, y2, 7, '#000', 'butt'));
    }
  }
  return out.join('');
}

function piesociny(m) {
  const out = [];
  for (const o of m.kde) {
    const [x, y] = stred(o);
    out.push(kruh(x, y, R, '#fff', '#000', 8));
    out.push(text(x, y, o.n, 44, { tucne: true }));
  }
  return out.join('');
}

export function zadanie(p) {
  const m = stiahni(p);
  return obal(m.stlpcov * S + 2 * P, m.riadkov * S + 2 * P, piesociny(m));
}

export function riesenie(p) {
  const m = stiahni(p);
  return obal(m.stlpcov * S + 2 * P, m.riadkov * S + 2 * P, lavky(p, m) + piesociny(m));
}

export const popisMriezky = (p) => p.n + ' x ' + p.n;
