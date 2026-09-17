/* Dormice: the staircase, the cast list and the clue list as HTML.
 *
 * One module, two callers: game.js draws the board in the browser and
 * ops/games/dormice/postav.mjs pre-renders exactly the same markup into every
 * built day page, so a day paints before a line of JavaScript runs and the
 * page the crawler sees is the page the player sees. Nothing here touches the
 * DOM or localStorage; it only turns a puzzle into strings.
 *
 * The staircase. Categories are 0 (the dormice, the anchor), then what, where
 * and, when there are four, the weeks. The columns run what, where, when left
 * to right; the row blocks run the dormice first and then the other
 * categories backwards, so block i only reaches across the column groups that
 * come before its own mirror. That is what makes the shape a staircase and
 * puts each unordered pair of categories in exactly one small table:
 *
 *      what   where  when          k = 4, N = 4: six tables,
 *   who  ##     ##     ##          twelve columns, twelve rows.
 *   when ##     ##
 *   where##
 */

export function poradieStlpcov(k) {
  const out = [];
  for (let a = 1; a < k; a++) out.push(a);
  return out;
}
export function poradieRiadkov(k) {
  const out = [0];
  for (let a = k - 1; a >= 2; a--) out.push(a);
  return out;
}
/* Is there a table where row block i meets column group j? */
export function jeTabulka(k, i, j) { return i === 0 || j < k - 1 - i; }

/* The header of one item: a single character, because twelve columns at
   390 px leave about 29 px per square and a word does not fit in that. The
   weeks get their number, everything else the first letter of its name, and
   the generator guarantees those letters are all different inside one puzzle
   (ops/spec-hra-detektiv.md, part 3.5). The full names are in the cast list
   under the board. */
export function jednoznak(zad, a, i) {
  return zad.cats[a].id === 'when' ? String(i + 1) : zad.cats[a].items[i].charAt(0).toUpperCase();
}

/* Our own thin line icons, drawn here and nowhere else: no icon library, no
   emoji from a font. One per category, so a block band says what it is
   without spelling it out twice. */
export const IKONY = {
  who: '<path d="M4 10.5a4 4 0 0 1 7.6-1.7"/><circle cx="8.5" cy="9.5" r="4"/><path d="M6.7 6.1a1.6 1.6 0 1 1 2.2-2.2"/><path d="M12 12.6c1.6.6 1.9 2.6.2 2.9"/>',
  what: '<path d="M8 3.2c2.6 0 4.2 2 4.2 4.6 0 3-2 5-4.2 5S3.8 10.8 3.8 7.8C3.8 5.2 5.4 3.2 8 3.2z"/><path d="M8 3.2V1.6"/><path d="M6 6.4c.7.7 1.7 1 2.6.6"/>',
  where: '<path d="M8 1.8 4.2 7h2L3 12h10l-3.2-5h2z"/><path d="M8 12v2.4"/>',
  when: '<rect x="2.4" y="3.4" width="11.2" height="10.2" rx="1.6"/><path d="M2.4 6.6h11.2M5.6 1.8v2.6M10.4 1.8v2.6"/><path d="M6 9.8h4"/>',
};
export function ikona(id) {
  return '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">' + (IKONY[id] || '') + '</svg>';
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* The whole board as the inner HTML of .doska. Buttons carry everything the
   page needs to read a square back: the canonical table (a < b), the row and
   column inside it, and which item of which category each side names. */
export function plochaHTML(zad) {
  const k = zad.k, N = zad.N;
  const stlpce = poradieStlpcov(k);
  const riadky = poradieRiadkov(k);
  const sirka = (k - 1) * N;
  let out = '';
  let ar = 0;      // aria-rowindex, counted over every row of the grid
  let poradie = 0; // the tab order of the squares, left to right, top to bottom

  // Band over the column groups: icon and category name.
  ar++;
  out += '<div class="riadok" role="row" aria-rowindex="' + ar + '"><div class="h roh" role="columnheader" aria-colindex="1"></div>';
  stlpce.forEach((a, j) => {
    out += '<div class="h skupina" role="columnheader" aria-colindex="' + (2 + j * N) + '" style="grid-column:span ' + N + '">'
      + ikona(zad.cats[a].id) + esc(zad.cats[a].label) + '</div>';
  });
  out += '</div>';

  // The single characters of every column.
  ar++;
  out += '<div class="riadok" role="row" aria-rowindex="' + ar + '"><div class="h roh" role="columnheader" aria-colindex="1"></div>';
  stlpce.forEach((a, j) => {
    for (let y = 0; y < N; y++) {
      out += '<div class="h hc" role="columnheader" aria-colindex="' + (2 + j * N + y) + '" data-a="' + a + '" data-x="' + y + '"'
        + ' title="' + esc(zad.cats[a].items[y]) + '">' + esc(jednoznak(zad, a, y)) + '</div>';
    }
  });
  out += '</div>';

  riadky.forEach((a, i) => {
    // Band in front of the row block.
    ar++;
    out += '<div class="riadok" role="row" aria-rowindex="' + ar + '"><div class="h skupina pruh" role="rowheader" aria-colindex="1" style="grid-column:1 / -1">'
      + ikona(zad.cats[a].id) + esc(zad.cats[a].label) + '</div></div>';
    for (let x = 0; x < N; x++) {
      ar++;
      const rr = i * N + x;
      out += '<div class="riadok" role="row" aria-rowindex="' + ar + '">'
        + '<div class="h hr" role="rowheader" aria-colindex="1" data-a="' + a + '" data-x="' + x + '"'
        + ' title="' + esc(zad.cats[a].items[x]) + '">' + esc(jednoznak(zad, a, x)) + '</div>';
      stlpce.forEach((b, j) => {
        for (let y = 0; y < N; y++) {
          const cc = j * N + y;
          const triedy = [];
          if (y === 0) triedy.push('tl');
          if (x === 0) triedy.push('tt');
          if (!jeTabulka(k, i, j)) {
            out += '<div class="prazdne ' + triedy.join(' ') + '" role="gridcell" aria-disabled="true" aria-colindex="' + (cc + 2) + '"></div>';
            continue;
          }
          const prvy = a < b;
          const t = prvy ? a + ',' + b : b + ',' + a;
          const r = prvy ? x : y;
          const c = prvy ? y : x;
          out += '<button class="b ' + triedy.join(' ') + '" role="gridcell" data-i="' + poradie + '"'
            + ' data-t="' + t + '" data-r="' + r + '" data-c="' + c + '"'
            + ' data-ra="' + a + '" data-rx="' + x + '" data-ca="' + b + '" data-cy="' + y + '"'
            + ' data-rr="' + rr + '" data-cc="' + cc + '" aria-colindex="' + (cc + 2) + '"></button>';
          poradie++;
        }
      });
      out += '</div>';
    }
  });
  return out;
}

/* How many squares plochaHTML draws, so a caller can tell a built page from
   an empty one without counting the markup. */
export function pocetPolicok(zad) {
  const k = zad.k, N = zad.N;
  let n = 0;
  for (let i = 0; i < k - 1; i++) for (let j = 0; j < k - 1; j++) if (jeTabulka(k, i, j)) n += N * N;
  return n;
}

/* The cast, in full names, grouped by category: the words the single
   characters in the grid stand for. */
export function legendaHTML(zad) {
  let out = '';
  for (let a = 0; a < zad.k; a++) {
    out += '<div><h3>' + ikona(zad.cats[a].id) + esc(zad.cats[a].label) + '</h3><ul>';
    for (let i = 0; i < zad.N; i++) {
      out += '<li><button type="button" class="pol" data-a="' + a + '" data-x="' + i + '">'
        + '<b>' + esc(jednoznak(zad, a, i)) + '</b><span>' + esc(zad.cats[a].items[i]) + '</span></button></li>';
    }
    out += '</ul></div>';
  }
  return out;
}

/* The closing question. It is the point of the puzzle: without it the reward
   for finishing is a filled in table, which is paperwork. */
export function otazkaText(zad) {
  const co = zad.cats[1].items[zad.question.what];
  return 'The ' + co + ' went missing from the shared larder overnight. Which dormouse had them, in which tree'
    + (zad.ordered === 3 ? ' and in which week' : '') + '?';
}

export function indicieHTML(zad, texty) {
  let out = '';
  for (let i = 0; i < texty.length; i++) {
    out += '<li data-i="' + i + '"><button type="button" class="veta" aria-pressed="false" data-i="' + i + '">' + esc(texty[i]) + '</button></li>';
  }
  return out;
}
