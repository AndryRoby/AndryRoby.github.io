/* Foxes: the board, the chamber legend, the cast, the clue list and the pad
 * of pieces as HTML.
 *
 * One module, two callers: game.js draws the board in the browser and
 * ops/games/foxes/postav.mjs pre-renders exactly the same markup into every
 * built day page, so a day paints before a line of JavaScript runs and the
 * page a crawler reads is the page a player sees. Nothing here touches the
 * DOM or localStorage; it only turns a puzzle into strings.
 *
 * Every drawing is our own thin line SVG, written here and nowhere else: no
 * icon library and no emoji. A fox is a head with two ears and the first
 * letter of its name inside; each lost thing has its own icon; the floor
 * marks sit on the edge of their cell (moss at the bottom, roots hanging from
 * the top, a leaf in the corner) so they stay visible under a piece.
 */
import { menoKomory, bunkaText, VLASTNOSTI, ZNAKY } from './generator.mjs';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const svg = (vb, trieda, telo) => '<svg class="' + trieda + '" viewBox="' + vb + '" aria-hidden="true" focusable="false">' + telo + '</svg>';

export const LISKA = '<path d="M3.6 3.2 8.4 8h7.2l4.8-4.8-.5 8.6L12 20.6 4.1 11.8z"/><path d="M10.2 16.2 12 17.6l1.8-1.4"/>';
/* One icon per thing, in the order of the bank. */
export const VECI = [
  '<circle cx="12" cy="12" r="8"/><path d="M5.6 8.4c4.2.8 9 5 11 11.2M8.2 4.8c4 3 6.8 8.2 7.2 14.6M4.3 13.2c3.2-.2 7 1.8 9.2 6.4"/>',
  '<path d="M12 7.2c-2-1.7-6.2-1.5-7.4 2.2C3.4 13.2 6 19.6 9.2 20.2c1.3.2 2-.5 2.8-.5s1.5.7 2.8.5c3.2-.6 5.8-7 4.6-10.8C18.2 5.7 14 5.5 12 7.2z"/><path d="M12 7.2c0-2 1-3.6 2.7-4.4"/>',
  '<path d="M7.6 21h8.8v-3.2c1.8-1.4 2.8-3.8 2.8-6.6V7.4a1.9 1.9 0 0 0-3.8 0V10V5.2a1.9 1.9 0 0 0-3.8 0V10L9.6 8.2a1.9 1.9 0 0 0-3.2 2l2 4.4v3.2z"/><path d="M7.6 18h8.8"/>',
  '<circle cx="12" cy="12" r="8"/><path d="M5.2 7.2c3 2.2 3 7.4 0 9.6M18.8 7.2c-3 2.2-3 7.4 0 9.6"/>',
  // the tin whistle: a wider mouthpiece with its window, a thin tube and
  // four finger holes, on a slant (the first drawing read as a ruler)
  '<g transform="rotate(-38 12 12)"><path d="M1.2 9.3h6.9v5.4H1.2l-.9-1.5v-2.4z"/><path d="M4.4 9.3l1.4 2h2.3"/><path d="M8.1 10.6h15.2v2.8H8.1"/><path d="M11.6 12h.1M14.4 12h.1M17.2 12h.1M20 12h.1"/></g>',
  '<path d="M6 16.2v-4a6 6 0 0 1 12 0v4l1.6 2.2H4.4z"/><path d="M10.4 20.6a1.7 1.7 0 0 0 3.2 0M12 4.2v2"/>',
  '<circle cx="12" cy="12" r="7.6"/><path d="M7.8 14.2c1.6-4 5.6-6 8.8-4.4M9.6 9c.6-.8 1.6-1.3 2.6-1.4"/>',
  '<path d="M9 3h6.2v9.4l3.3 3.3a3 3 0 0 1-4.2 4.3L9.7 15.6A2.6 2.6 0 0 1 9 13.8z"/><path d="M9 6.2h6.2M9 9.4h6.2"/>',
];
/* Moss, roots, leaves. */
export const ZNAKY_SVG = [
  '<path d="M1.5 14c1.2-2.4 3.4-2.4 4.6 0M6 14c1.2-2.8 3.6-2.8 4.8 0M10.6 14c1-2.2 3-2.2 4 0"/>',
  '<path d="M5.5 0v4.2c0 1.6-1.2 2.2-1.2 3.8M10.5 0v3.2c0 1.6 1.3 2.3 1.3 4.2M8 0v2.4"/>',
  '<path d="M2.6 13.4C2.6 7.2 6.6 3 13.4 2.6c-.4 6.8-4.6 10.8-10.8 10.8zM2.6 13.4 9 7"/>',
];

export function ikonaLisky(pismeno, trieda = 'kus') {
  return '<span class="' + trieda + '">' + svg('0 0 24 24', 'ik', LISKA) + '<b>' + esc(pismeno) + '</b></span>';
}
export function ikonaVeci(i, trieda = 'kus vec') {
  return '<span class="' + trieda + '">' + svg('0 0 24 24', 'ik', VECI[i] || VECI[0]) + '</span>';
}
export function ikonaZnaku(f) { return svg('0 0 16 16', 'zn zn' + f, ZNAKY_SVG[f]); }
export function pismeno(zad, p) { return p === zad.n - 1 ? '' : zad.mena[p].charAt(0).toUpperCase(); }
export function pismenoKomory(zad, k) { return zad.menaKomor[k].charAt(0).toUpperCase(); }

/* A piece as it stands on the board. */
export function kusHTML(zad, p) {
  return p === zad.n - 1 ? ikonaVeci(zad.vecIdx) : ikonaLisky(pismeno(zad, p));
}
/* The notes of one cell: the letters of the foxes in the order of the cast,
   and the small icon of the thing last. */
export function poznamkyHTML(zad, maska) {
  let out = '';
  for (let p = 0; p < zad.n; p++) {
    if (!((maska >> p) & 1)) continue;
    out += p === zad.n - 1 ? '<i class="pv">' + svg('0 0 24 24', 'ik', VECI[zad.vecIdx]) + '</i>' : '<i>' + esc(pismeno(zad, p)) + '</i>';
  }
  return '<span class="pozn" data-p="' + popcount(maska) + '">' + out + '</span>';
}
function popcount(m) { let x = 0; while (m) { m &= m - 1; x++; } return x; }

/* The first cell of every chamber in reading order: where its letter goes. */
export function prveBunkyKomor(zad) {
  const out = new Array(zad.K).fill(-1);
  for (let c = 0; c < zad.n * zad.n; c++) if (out[zad.komory[c]] < 0) out[zad.komory[c]] = c;
  return out;
}

/* The static part of a cell for a screen reader: place, chamber, mark,
   stone. game.js adds who or what is there. */
export function popisBunky(zad, c) {
  const casti = [bunkaText(zad.n, c).replace(/^r/, 'R'), zad.menaKomor[zad.komory[c]]];
  if (zad.znaky[c] >= 0) casti.push(ZNAKY[zad.znaky[c]]);
  return casti.join(', ');
}

/* The whole board as the inner HTML of .doska: rows of cells, a thick line
   where two chambers meet, a tint and a pattern per chamber, the letter of
   the chamber in its first cell, the stones and the floor marks. The span
   .o is where game.js puts a piece, a cross or the notes. */
export function plochaHTML(zad) {
  const n = zad.n, K = zad.komory, kamen = new Set(zad.kamene);
  const prve = new Set(prveBunkyKomor(zad));
  let out = '';
  for (let r = 0; r < n; r++) {
    out += '<div class="riadok" role="row" aria-rowindex="' + (r + 1) + '">';
    for (let s = 0; s < n; s++) {
      const c = r * n + s;
      const triedy = ['b', 'k' + K[c]];
      if (r === 0) triedy.push('r0');
      if (s === 0) triedy.push('c0');
      if (r > 0 && K[c - n] !== K[c]) triedy.push('bt');
      if (s > 0 && K[c - 1] !== K[c]) triedy.push('bl');
      if (kamen.has(c)) triedy.push('kamen');
      let vnutro = '<i class="vz"></i>';
      if (prve.has(c)) vnutro += '<span class="kp">' + esc(pismenoKomory(zad, K[c])) + '</span>';
      if (zad.znaky[c] >= 0) vnutro += ikonaZnaku(zad.znaky[c]);
      if (kamen.has(c)) vnutro += '<span class="kamen-tvar"></span>';
      vnutro += '<span class="o"></span>';
      const popis = popisBunky(zad, c) + (kamen.has(c) ? ': stone' : ': empty');
      out += '<button type="button" class="' + triedy.join(' ') + '" role="gridcell" data-i="' + c + '" aria-colindex="' + (s + 1)
        + '" tabindex="' + (c === 0 ? 0 : -1) + '" aria-label="' + esc(popis) + '">' + vnutro + '</button>';
    }
    out += '</div>';
  }
  return out;
}

/* The chambers in full names under the board, each with its letter, tint
   and pattern, so the colour is never the only way to tell them apart. */
export function legendaHTML(zad) {
  let out = '<ul>';
  for (let k = 0; k < zad.K; k++) {
    out += '<li><span class="vzorka k' + k + '"><i class="vz"></i><b>' + esc(pismenoKomory(zad, k)) + '</b></span>' + esc(zad.menaKomor[k]) + '</li>';
  }
  return out + '</ul>';
}

/* The cast: every fox with its trait, then the lost thing. */
export function obsadenieHTML(zad) {
  const vl = VLASTNOSTI[zad.vlastnost];
  const casti = zad.mena.map((m, p) => '<li>' + ikonaLisky(pismeno(zad, p), 'kus mini') + '<span><b>' + esc(m) + '</b>, ' + esc(vl[zad.skupina[p] ? 'b' : 'a'].je) + '</span></li>');
  casti.push('<li>' + ikonaVeci(zad.vecIdx, 'kus vec mini') + '<span>and the <b>' + esc(zad.vec) + '</b></span></li>');
  return '<ul>' + casti.join('') + '</ul>';
}

export function uvodText(zad) {
  return 'A family of foxes shares one lair, and the ' + zad.vec + ' has gone missing. Every fox is somewhere in the lair, and so is the ' + zad.vec + '.';
}
export function otazkaText(zad) { return 'Who has the ' + zad.vec + ', and in which chamber?'; }

export function indicieHTML(zad, vety) {
  let out = '';
  for (let i = 0; i < vety.length; i++) {
    out += '<li data-i="' + i + '"><button type="button" class="veta" aria-pressed="false" data-i="' + i + '">' + esc(vety[i]) + '</button></li>';
  }
  return out;
}

/* The pad under the board: one chip per piece (key, picture, name and, for a
   fox, its trait), then Nobody, Notes and Delete. The trait is on the chip
   because on a phone the cast above the board is folded away. */
export function padHTML(zad) {
  const vl = VLASTNOSTI[zad.vlastnost];
  let out = '';
  for (let p = 0; p < zad.n; p++) {
    const jeVec = p === zad.n - 1;
    const meno = jeVec ? zad.vec : zad.mena[p];
    const vlast = jeVec ? '' : vl[zad.skupina[p] ? 'b' : 'a'];
    const popis = jeVec ? 'the ' + zad.vec : zad.mena[p] + ', ' + vlast.je;
    out += '<button type="button" class="cip' + (jeVec ? ' cip-vec' : '') + '" data-kus="' + p + '" title="' + esc(popis) + '" aria-label="' + esc(popis + ', key ' + (p + 1)) + '">'
      + '<small>' + (p + 1) + '</small>' + (jeVec ? ikonaVeci(zad.vecIdx, 'kus vec mini') : ikonaLisky(pismeno(zad, p), 'kus mini'))
      + '<span class="meno">' + esc(meno) + '</span>' + (jeVec ? '' : '<span class="vl">' + esc(vlast.slovo) + '</span>') + '</button>';
  }
  return out;
}

/* Which cells and which pieces a clue names, for "Highlight what a clue
   names": the chamber, the cells with the mark, the edge line, the cells next
   to a stone, and the chips of the pieces. */
export function coMenuje(zad, cl, S) {
  const n = zad.n, C = n * n, bunky = [];
  const kusy = new Set();
  if (cl.p !== undefined) kusy.add(cl.p);
  if (cl.q !== undefined) kusy.add(cl.q);
  if (cl.t === 'GNOT' || cl.t === 'HOLDER') for (let p = 0; p < n - 1; p++) if (zad.skupina[p] === cl.g) kusy.add(p);
  if (cl.t === 'HOLDER') kusy.add(n - 1);
  if (cl.k !== undefined) for (let c = 0; c < C; c++) if (zad.komory[c] === cl.k) bunky.push(c);
  if (cl.t === 'ON') for (let c = 0; c < C; c++) if (zad.znaky[c] === cl.f) bunky.push(c);
  if (cl.t === 'EDGE') for (let i = 0; i < n; i++) bunky.push(cl.e === 0 ? i : cl.e === 1 ? (n - 1) * n + i : cl.e === 2 ? i * n : i * n + n - 1);
  if (cl.t === 'BESIDE' && S) for (let c = 0; c < C; c++) if ((S.priM[(c / n) | 0] >> (c % n)) & 1) bunky.push(c);
  return { bunky, kusy: [...kusy] };
}

export { menoKomory };
