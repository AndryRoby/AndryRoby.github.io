/* Grandpa's Lighthouse: a small escape room for arling.sk/games/escape/lighthouse/.
 *
 * One room, six locks, each a small puzzle in the style of our daily games:
 *   1. sea chest     picture grid 5 x 5 (the Magpies mechanic)
 *   2. signal line   put five flags in order from a rhyme (the Dormice kind of deduction)
 *   3. logbook       a letter shift cipher, the shift comes from lock 2
 *   4. cabinet       counting the shells on the shelf, in the order from lock 3
 *   5. pebble board  one pebble per row, column and patch, no two touching (Hedgehogs, one per line)
 *   6. stair door    a 3 x 3 sum plate (the Squirrels mechanic)
 * Then the finale: climb up and light the lamp with the oil from lock 4.
 *
 * The first half of this file is pure logic with exports (no DOM), so escape.test.mjs can
 * prove in Node that every lock has exactly one answer, that the whole way through works
 * and that no lock can be skipped. The second half builds the page and runs only in a
 * browser. Everything is drawn in code (SVG), sounds are synthesised with WebAudio.
 * Nothing leaves the browser except the anonymous Umami events named in track().
 */

// ── 1. Lock 1: the picture grid on the sea chest ─────────────────────────────
export const SRDCE = ['01010', '11111', '11111', '01110', '00100'];
const SRDCE_B = SRDCE.map((r) => [...r].map(Number));
export function bloky(riadok) {
  const out = [];
  let n = 0;
  for (const b of riadok) {
    if (b) n++;
    else if (n) { out.push(n); n = 0; }
  }
  if (n) out.push(n);
  return out;
}
const rovnake = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const PAT = [0, 1, 2, 3, 4];
export const TRUHLA_RIADKY = SRDCE_B.map(bloky);
export const TRUHLA_STLPCE = PAT.map((c) => bloky(SRDCE_B.map((r) => r[c])));
/** m: 25 values, 0 empty, 1 filled, 2 cross. True when every row and column clue is met. */
export function spravneTruhla(m) {
  if (!Array.isArray(m) || m.length !== 25) return false;
  const p = (r, c) => (m[r * 5 + c] === 1 ? 1 : 0);
  for (let r = 0; r < 5; r++) if (!rovnake(bloky(PAT.map((c) => p(r, c))), TRUHLA_RIADKY[r])) return false;
  for (let c = 0; c < 5; c++) if (!rovnake(bloky(PAT.map((r) => p(r, c))), TRUHLA_STLPCE[c])) return false;
  return true;
}

// ── 2. Lock 2: signal flags in the order of Grandpa's rhyme ──────────────────
export const VLAJKY = {
  W: { nazov: 'White' },
  Y: { nazov: 'Yellow' },
  B: { nazov: 'Blue' },
  R: { nazov: 'Red' },
  G: { nazov: 'Green' },
};
const jeVlajka = (x) => Object.prototype.hasOwnProperty.call(VLAJKY, x);
export const VLAJKY_ZACIATOK = ['R', 'G', 'W', 'B', 'Y'];
// Places are counted from the window: place 1 is next to it, place 5 is the far end.
// Grandpa's card is two rhyming couplets, one rule per line (end/friend, Blue/you).
export const PRAVIDLA_VLAJOK = [
  { text: 'Green flies at one end, but never the window end;',
    plati: (p) => { const i = p.indexOf('G'); return (i === 0 || i === 4) && i !== 0; } },
  { text: 'Red flies right beside Green, as close as a friend.', plati: (p) => Math.abs(p.indexOf('R') - p.indexOf('G')) === 1 },
  { text: 'Straight after Yellow, one place on, flies Blue;', plati: (p) => p.indexOf('B') === p.indexOf('Y') + 1 },
  { text: 'White never touches Red. Now the rest is up to you.', plati: (p) => Math.abs(p.indexOf('W') - p.indexOf('R')) !== 1 },
];
export function spravneVlajky(p) {
  return Array.isArray(p) && p.length === 5 && p.every(jeVlajka) && new Set(p).size === 5
    && PRAVIDLA_VLAJOK.every((r) => r.plati(p));
}
/** Grandma answers a correct signal with this many blinks: the shift of the logbook cipher. */
export const MAMA_BLIKNE = 5;

// ── 3. Lock 3: the logbook, a letter shift cipher ────────────────────────────
export const SIFRA = 'XMJQQ';
export const ABECEDA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export function posunPismeno(ch, o) {
  const i = ABECEDA.indexOf(ch);
  if (i < 0) return ch;
  return ABECEDA[(((i + o) % 26) + 26) % 26];
}
export const sifruj = (text, posun) => [...text].map((ch) => posunPismeno(ch, posun)).join('');
export const desifruj = (text, posun) => sifruj(text, -posun);
export const DENNIK_SLOVO = desifruj(SIFRA, MAMA_BLIKNE);
export function spravneDennik(slovo) { return typeof slovo === 'string' && slovo === DENNIK_SLOVO; }

// ── 4. Lock 4: the cabinet, counting shells ──────────────────────────────────
export const MUSLE = {
  hviezdica: { jedna: 'starfish', viac: 'starfish', popis: 'five arms' },
  hrebenatka: { jedna: 'scallop', viac: 'scallops', popis: 'a ribbed fan' },
  ulita: { jedna: 'whelk', viac: 'whelks', popis: 'a curly spiral' },
};
// The shelf from the top board down, each board from left to right.
export const POLICA = [
  ['hrebenatka', 'ulita', 'hviezdica', 'hrebenatka', 'hrebenatka'],
  ['hviezdica', 'ulita', 'hviezdica', 'hrebenatka'],
  ['ulita', 'hrebenatka', 'hviezdica', 'hrebenatka'],
];
export const PORADIE_MUSLI = ['hviezdica', 'hrebenatka', 'ulita'];
export const pocetMusli = (druh) => POLICA.flat().filter((d) => d === druh).length;
export const KOD_SKRINE = PORADIE_MUSLI.map(pocetMusli);
export function spravneSkrina(c) {
  return Array.isArray(c) && c.length === 3 && c.every((x, i) => x === KOD_SKRINE[i]);
}

// ── 5. Lock 5: the pebble board ──────────────────────────────────────────────
export const DOSKA = ['00311', '03311', '23111', '23344', '23444'];
export const PLATNE = [
  { nazov: 'red', farba: '#b8604a' },
  { nazov: 'yellow', farba: '#c49a3f' },
  { nazov: 'blue', farba: '#4c7aa6' },
  { nazov: 'green', farba: '#648f5b' },
  { nazov: 'grey', farba: '#857d70' },
];
const oblast = (r, c) => Number(DOSKA[r][c]);
/** m: 25 values, 0 empty, 1 pebble, 2 dot (the player's note that no pebble goes here). */
export function spravneDoska(m) {
  if (!Array.isArray(m) || m.length !== 25) return false;
  const k = [];
  m.forEach((v, i) => { if (v === 1) k.push([Math.floor(i / 5), i % 5]); });
  if (k.length !== 5) return false;
  if (new Set(k.map(([r]) => r)).size !== 5 || new Set(k.map(([, c]) => c)).size !== 5) return false;
  if (new Set(k.map(([r, c]) => oblast(r, c))).size !== 5) return false;
  for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) {
    if (Math.abs(k[i][0] - k[j][0]) <= 1 && Math.abs(k[i][1] - k[j][1]) <= 1) return false;
  }
  return true;
}

// ── 6. Lock 6: the sum plate on the stair door ───────────────────────────────
export const PLATNA_RIADKY = [23, 24, 7];
export const PLATNA_STLPCE = [18, 16, 20];
const sucet = (t) => t.reduce((a, b) => a + b, 0);
export function spravnePlatna(c) {
  if (!Array.isArray(c) || c.length !== 9 || !c.every((x) => Number.isInteger(x) && x >= 1 && x <= 9)) return false;
  for (let r = 0; r < 3; r++) {
    const t = c.slice(r * 3, r * 3 + 3);
    if (new Set(t).size !== 3 || sucet(t) !== PLATNA_RIADKY[r]) return false;
  }
  for (let s = 0; s < 3; s++) {
    const t = [c[s], c[3 + s], c[6 + s]];
    if (new Set(t).size !== 3 || sucet(t) !== PLATNA_STLPCE[s]) return false;
  }
  return true;
}

// ── 7. The chain of locks ────────────────────────────────────────────────────
// Every lock needs things that only an earlier lock gives. skus() refuses a lock whose
// things are missing even when the answer is right, so no lock can be skipped.
export const ZAMKY = [
  { id: 'truhla', nazov: 'Sea chest', potrebuje: [], dava: ['vlajky'], over: spravneTruhla },
  { id: 'vlajky', nazov: 'Signal line', potrebuje: ['vlajky'], dava: ['cislo'], over: spravneVlajky },
  { id: 'dennik', nazov: "Grandpa's logbook", potrebuje: ['cislo'], dava: ['stranka'], over: spravneDennik },
  { id: 'skrina', nazov: 'Cabinet', potrebuje: ['stranka'], dava: ['olej', 'doska'], over: spravneSkrina },
  { id: 'doska', nazov: 'Pebble board', potrebuje: ['doska'], dava: ['kluc'], over: spravneDoska },
  { id: 'dvere', nazov: 'Stair door', potrebuje: ['kluc'], dava: ['schody'], over: spravnePlatna },
];
export const FINALE = { potrebuje: ['schody', 'olej'] };
export const zamok = (id) => ZAMKY.find((z) => z.id === id) || null;
export function novyStav() { return { otvorene: [], veci: [], lampa: false }; }
export function mozeSkusit(stav, id) {
  const z = zamok(id);
  return !!z && !stav.otvorene.includes(id) && z.potrebuje.every((v) => stav.veci.includes(v));
}
export function skus(stav, id, odpoved) {
  const z = zamok(id);
  if (!z) return { ok: false, dovod: 'neznamy', stav };
  if (stav.otvorene.includes(id)) return { ok: false, dovod: 'otvorene', stav };
  if (!mozeSkusit(stav, id)) return { ok: false, dovod: 'chyba-vec', stav };
  if (!z.over(odpoved)) return { ok: false, dovod: 'zle', stav };
  const nove = z.dava.filter((v) => !stav.veci.includes(v));
  return { ok: true, dava: nove, stav: { ...stav, otvorene: [...stav.otvorene, id], veci: [...stav.veci, ...nove] } };
}
export function mozeZapalit(stav) { return !stav.lampa && FINALE.potrebuje.every((v) => stav.veci.includes(v)); }
export function zapal(stav) {
  if (!mozeZapalit(stav)) return { ok: false, stav };
  return { ok: true, stav: { ...stav, lampa: true } };
}
/** The next thing to do: the first closed lock in the chain, then the lamp, then nothing. */
export function dalsiCiel(stav) {
  const z = ZAMKY.find((x) => !stav.otvorene.includes(x.id));
  if (z) return z.id;
  return stav.lampa ? null : 'finale';
}

// ── 8. Puzzle state and hints in two steps ───────────────────────────────────
export function prazdnaCast(id) {
  if (id === 'truhla' || id === 'doska') return new Array(25).fill(0);
  if (id === 'vlajky') return VLAJKY_ZACIATOK.slice();
  if (id === 'dennik') return ['A', 'A', 'A', 'A', 'A'];
  if (id === 'skrina') return [0, 0, 0];
  if (id === 'dvere') return new Array(9).fill(0);
  return null;
}
/** What the player's partial state means as an answer for the lock. */
export function odpovedZCasti(id, cast) {
  if (id === 'dennik') return cast.join('');
  return cast;
}

const riadokText = (r) => 'row ' + (r + 1);
const bunkaText = (r, c) => 'row ' + (r + 1) + ', column ' + (c + 1);
const CISLA = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

export const KROKY = {
  truhla: [
    { riadok: 1, t1: 'Row 2 says 5, and a row has five cells. There is only one way to fit it.', t2: 'Filled all of row 2.' },
    { riadok: 2, t1: 'Row 3 says 5 as well.', t2: 'Filled all of row 3.' },
    { riadok: 0, t1: 'Columns 1 and 5 say 2, and rows 2 and 3 already fill two cells in each. So row 1 keeps its end cells empty, and its 1 1 needs a gap between the two singles.',
      t2: 'Row 1: filled columns 2 and 4, crossed the rest.' },
    { riadok: 3, t1: 'Row 4 says 3, and its end cells stay empty for the same reason as row 1.', t2: 'Row 4: filled columns 2 to 4.' },
    { riadok: 4, t1: 'Columns 2 and 4 say 4, and rows 1 to 4 already fill four cells in each. Row 5 says 1: where can it go?',
      t2: 'Row 5: filled the middle cell. That is the whole picture.' },
  ],
  vlajky: [
    { vlajka: 'G', miesto: 4, t1: 'Line 1: Green flies at one end, but never the window end. That leaves it one place.', t2: 'Green goes last, in place 5.' },
    { vlajka: 'R', miesto: 3, t1: 'Line 2: Red flies right beside Green, and Green is last.', t2: 'Red goes in place 4.' },
    { vlajka: 'W', miesto: 0, t1: 'Places 1 to 3 are left for White, Yellow and Blue. Yellow and Blue need two places side by side, and White must not touch Red in place 4.',
      t2: 'White goes in place 1, by the window.' },
    { vlajka: 'Y', miesto: 1, t1: 'Line 3: Blue flies straight after Yellow, one place further from the window, and places 2 and 3 are left.', t2: 'Yellow goes in place 2.' },
    { vlajka: 'B', miesto: 2, t1: 'One place is left.', t2: 'Blue goes in place 3. Now hoist the flags.' },
  ],
  dennik: [...SIFRA].map((ch, i) => ({
    koliesko: i,
    t1: i === 0
      ? "Grandpa moved every letter forward by Grandma's number, " + MAMA_BLIKNE + '. To read it, move each letter ' + MAMA_BLIKNE + ' back along the alphabet. Start with the first, ' + ch + '.'
      : 'Next letter: ' + ch + '. Count ' + MAMA_BLIKNE + ' letters back along the alphabet strip.',
    t2: ch + ', ' + MAMA_BLIKNE + ' letters back, is ' + DENNIK_SLOVO[i] + '. Wheel ' + (i + 1) + ' is set.',
  })),
  skrina: PORADIE_MUSLI.map((druh, i) => ({
    ciselnik: i,
    t1: 'The logbook page gives the order: starfish, then scallops, then whelks. Dial ' + (i + 1) + ' is for the '
      + MUSLE[druh].viac + ': count the shells with ' + MUSLE[druh].popis + ' on the shelf.',
    t2: 'There are ' + CISLA[pocetMusli(druh) - 1] + ' ' + (pocetMusli(druh) === 1 ? MUSLE[druh].jedna : MUSLE[druh].viac)
      + ' on the shelf: dial ' + (i + 1) + ' is set to ' + pocetMusli(druh) + '.',
  })),
  doska: [
    { bunka: [0, 1], t1: "The blue patch lies entirely in column 1, so column 1's pebble is blue. That leaves the red patch only one cell it can use.",
      t2: 'A pebble in row 1, column 2: the red patch.' },
    { bunka: [3, 2], t1: 'Look at the green patch now. Nearly all of it shares a row or a column with that pebble, or touches it.',
      t2: 'A pebble in row 4, column 3: the only free cell of the green patch.' },
    { bunka: [1, 3], t1: 'Column 4 has just one cell left that no pebble shares a line with or touches.', t2: 'A pebble in row 2, column 4.' },
    { bunka: [2, 0], t1: 'Row 3 has one free cell left.', t2: 'A pebble in row 3, column 1: the blue patch.' },
    { bunka: [4, 4], t1: 'The last pebble belongs to the grey patch, and row 5 has one free cell.', t2: 'A pebble in row 5, column 5.' },
  ],
  dvere: [
    { i: 8, c: 4, t1: 'The bottom row makes 7 with three different digits: only 1, 2 and 4 can do that. The right column needs 20, and two different digits above it give at most 17.',
      t2: 'So the bottom right cell is 4.' },
    { i: 2, c: 9, t1: 'The right column needs 16 more from two different digits: that is only 7 and 9. The top row makes 23, which only 6, 8 and 9 can do, so it takes the 9.',
      t2: 'Top right is 9.' },
    { i: 5, c: 7, t1: 'The middle of the right column takes the other digit of the pair.', t2: 'Middle right is 7.' },
    { i: 1, c: 6, t1: 'The middle row makes 24: only 7, 8 and 9. The middle column needs 16. If its top were 8, its middle would have to be 9, and 8 and 9 already make 17.',
      t2: 'Top middle is 6.' },
    { i: 0, c: 8, t1: 'The top row makes 23, and 6 and 9 are in.', t2: 'Top left is 8.' },
    { i: 3, c: 9, t1: 'The left column cannot have a second 8, and the middle row has 8 and 9 left.', t2: 'Middle left is 9.' },
    { i: 4, c: 8, t1: 'The middle row makes 24, and 9 and 7 are in.', t2: 'The centre is 8.' },
    { i: 7, c: 2, t1: 'The middle column makes 16, and 6 and 8 are in.', t2: 'Bottom middle is 2.' },
    { i: 6, c: 1, t1: 'The bottom row makes 7, and 2 and 4 are in.', t2: 'Bottom left is 1. The plate is complete.' },
  ],
};
const DOSKA_RIESENIE = new Set(KROKY.doska.map(({ bunka: [r, c] }) => r * 5 + c));
export const PLATNA_RIESENIE = (() => { const t = new Array(9).fill(0); KROKY.dvere.forEach((k) => { t[k.i] = k.c; }); return t; })();

function splneny(id, k, cast) {
  if (id === 'truhla') return PAT.every((c) => (cast[k.riadok * 5 + c] === 1) === (SRDCE_B[k.riadok][c] === 1));
  if (id === 'vlajky') return cast[k.miesto] === k.vlajka;
  if (id === 'dennik') return cast[k.koliesko] === DENNIK_SLOVO[k.koliesko];
  if (id === 'skrina') return cast[k.ciselnik] === KOD_SKRINE[k.ciselnik];
  if (id === 'doska') return cast[k.bunka[0] * 5 + k.bunka[1]] === 1;
  if (id === 'dvere') return cast[k.i] === k.c;
  return true;
}
function aplikujKrok(id, k, cast) {
  const c = cast.slice();
  if (id === 'truhla') PAT.forEach((s) => { c[k.riadok * 5 + s] = SRDCE_B[k.riadok][s] ? 1 : 2; });
  else if (id === 'vlajky') { const j = c.indexOf(k.vlajka); c[j] = c[k.miesto]; c[k.miesto] = k.vlajka; }
  else if (id === 'dennik') c[k.koliesko] = DENNIK_SLOVO[k.koliesko];
  else if (id === 'skrina') c[k.ciselnik] = KOD_SKRINE[k.ciselnik];
  else if (id === 'doska') c[k.bunka[0] * 5 + k.bunka[1]] = 1;
  else if (id === 'dvere') c[k.i] = k.c;
  return c;
}
/** A mark that contradicts the only solution: the first hint points at it, the second clears it. */
function chybaV(id, cast) {
  let i = -1;
  if (id === 'truhla') i = cast.findIndex((v, j) => (v === 1 && !SRDCE_B[Math.floor(j / 5)][j % 5]) || (v === 2 && SRDCE_B[Math.floor(j / 5)][j % 5]));
  else if (id === 'doska') i = cast.findIndex((v, j) => (v === 1 && !DOSKA_RIESENIE.has(j)) || (v === 2 && DOSKA_RIESENIE.has(j)));
  else if (id === 'dvere') i = cast.findIndex((v, j) => v !== 0 && v !== PLATNA_RIESENIE[j]);
  if (i < 0) return null;
  const n = id === 'dvere' ? 3 : 5;
  const r = Math.floor(i / n), c = i % n;
  const co = id === 'dvere' ? 'digit' : 'mark';
  return {
    kluc: id + ':chyba:' + i,
    t1: 'One ' + co + ' here does not fit the only answer. Look again at ' + riadokText(r) + '.',
    t2: 'Cleared ' + bunkaText(r, c) + ': that ' + co + ' did not belong.',
    aplikuj: (cast2) => { const x = cast2.slice(); x[i] = 0; return x; },
  };
}
export function napovedaHlavolamu(id, cast) {
  const chyba = chybaV(id, cast);
  if (chyba) return chyba;
  const kroky = KROKY[id] || [];
  for (let k = 0; k < kroky.length; k++) {
    if (!splneny(id, kroky[k], cast)) {
      const krok = kroky[k];
      return { kluc: id + ':' + k, t1: krok.t1, t2: krok.t2, aplikuj: (c) => aplikujKrok(id, krok, c) };
    }
  }
  const tlacidlo = { vlajky: 'Hoist the flags', dennik: 'Open the clasp', skrina: 'Pull the handle' }[id];
  return { kluc: id + ':hotovo', t1: 'Everything is in place.' + (tlacidlo ? ' Press ' + tlacidlo + '.' : ''), t2: 'Everything is in place.' + (tlacidlo ? ' Press ' + tlacidlo + '.' : '') };
}
export const NAV = {
  truhla: { hs: 'truhla', t1: "Grandpa's letter says the first lock is the one he keeps closest to his heart. An old sailor keeps his treasures in a sea chest.",
    t2: 'The sea chest on the floor, left of the rug. Tap it and fill in the picture on its lid.' },
  vlajky: { hs: 'okno', t1: 'You have the signal flags. Grandma is out on the water: where could she see them?', t2: 'The window. Tap it to clip the flags onto the signal line.' },
  dennik: { hs: 'dennik', t1: "You know Grandma's number now. Something on the table is written in Grandpa's secret way.", t2: "Grandpa's logbook on the table. Tap it." },
  skrina: { hs: 'skrina', t1: 'The logbook page talks about the shells and a cabinet with three dials.', t2: 'Count the shells on the wall shelf, then tap the tall cabinet.' },
  doska: { hs: 'skrina', t1: 'The cabinet held something besides the oil can.', t2: 'The pebble board inside the open cabinet. Tap the cabinet.' },
  dvere: { hs: 'dvere', t1: 'You have a brass key. One door in this room is still shut.', t2: 'The stair door on the right. Tap it.' },
  finale: { hs: 'dvere', t1: 'The way up to the lamp is open, and you have the oil.', t2: 'Tap the open stair door and climb up to the lamp.' },
};
/** The hint for this moment. panel is the lock whose close-up is open (or another view, or null).
 *  kos is where the hint is counted: the lock whose puzzle it helps with, or 'izba' (the room)
 *  for a hint that only points the way, so a lock is marked only when its puzzle needed help. */
export const KOS_IZBA = 'izba';
export function napoveda(stav, casti, panel) {
  const ciel = dalsiCiel(stav);
  if (!ciel) return null;
  if (ciel === 'finale' && panel === 'finale') {
    return { kluc: 'finale', ciel, kos: KOS_IZBA, t1: "The lamp needs oil, and you have Grandpa's oil can.", t2: 'Press the button under the lamp to fill it and light it.' };
  }
  if (ciel !== 'finale' && panel === ciel) {
    const h = napovedaHlavolamu(ciel, casti[ciel]);
    return { ...h, ciel, kos: ciel };
  }
  const n = NAV[ciel];
  return { kluc: 'nav:' + ciel, ciel, kos: KOS_IZBA, t1: n.t1, t2: n.t2, zvyrazni: n.hs };
}
/** One hint is one press of Hint plus, if wanted, the second press that does the step: it counts
 *  once, on the first press. druhy is true for the second press. Returns the new counts. */
export function zapocitajNapovedu(pocty, h, druhy) {
  const zamky = { ...(pocty.napovedyZamok || {}) };
  if (!h || druhy) return { napovedy: pocty.napovedy || 0, napovedyZamok: zamky };
  const kos = h.kos || KOS_IZBA;
  zamky[kos] = (zamky[kos] || 0) + 1;
  return { napovedy: (pocty.napovedy || 0) + 1, napovedyZamok: zamky };
}

// ── 9. The page (browser only) ───────────────────────────────────────────────
// The game starts at the very end of this file, once every drawing constant exists.
const JE_PREHLIADAC = typeof window !== 'undefined' && typeof document !== 'undefined';

function esc(s) {
  return String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}
function formatCas(s) {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(x).padStart(2, '0');
}

// ── 9a. Drawings ─────────────────────────────────────────────────────────────
const FARBY_VLAJOK = { W: '#efe9dc', Y: '#e8b943', B: '#3f78b5', R: '#cf4f37', G: '#4f9a61' };
/** A flag, drawn in a 40 x 28 box with the hoist on the left. */
function vlajkaSvg(id) {
  const f = FARBY_VLAJOK[id];
  if (id === 'Y') return `<path d="M0 0 L40 14 L0 28 Z" fill="${f}" stroke="#8a6a1c" stroke-width="1"/>`;
  if (id === 'G') return `<path d="M0 0 H40 L30 14 L40 28 H0 Z" fill="${f}" stroke="#2f5f3a" stroke-width="1"/>`;
  if (id === 'B') return `<rect width="40" height="28" fill="${f}" stroke="#244a73" stroke-width="1"/><rect x="13" y="8" width="14" height="12" fill="#efe9dc"/>`;
  if (id === 'W') return `<rect width="40" height="28" fill="${f}" stroke="#a79e8b" stroke-width="1.4"/><path d="M0 14 H40" stroke="#c9c0ad" stroke-width="1.2"/>`;
  return `<rect width="40" height="28" fill="${f}" stroke="#86301f" stroke-width="1"/>`;
}
function musla(druh, x, y, k, rot) {
  const t = `transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot}) scale(${k})"`;
  if (druh === 'hrebenatka') {
    return `<g ${t}><path d="M-5 0 L-9 -5 L-2 -4 Z M5 0 L9 -5 L2 -4 Z" fill="#d49b7f"/><path d="M0 -1 L-14 -19 Q0 -33 14 -19 Z" fill="#ecb89c" stroke="#b77c61" stroke-width="1.2" stroke-linejoin="round"/><path d="M0 -2 L-10 -22 M0 -2 L-5 -26 M0 -2 L0 -27 M0 -2 L5 -26 M0 -2 L10 -22" stroke="#c78a6d" stroke-width="1.1" fill="none" stroke-linecap="round"/></g>`;
  }
  if (druh === 'hviezdica') {
    const b = [];
    for (let i = 0; i < 10; i++) {
      const u = (-90 + i * 36) * Math.PI / 180, r = i % 2 ? 5.6 : 14;
      b.push((Math.cos(u) * r).toFixed(2) + ' ' + (-13 + Math.sin(u) * r).toFixed(2));
    }
    return `<g ${t}><path d="M${b.join(' L')} Z" fill="#e27a4d" stroke="#b5532e" stroke-width="2" stroke-linejoin="round"/><circle cx="0" cy="-13" r="2.2" fill="#f2a77f"/><circle cx="0" cy="-21" r="1.2" fill="#f2a77f"/><circle cx="7.4" cy="-15.4" r="1.2" fill="#f2a77f"/><circle cx="-7.4" cy="-15.4" r="1.2" fill="#f2a77f"/><circle cx="4.6" cy="-7" r="1.2" fill="#f2a77f"/><circle cx="-4.6" cy="-7" r="1.2" fill="#f2a77f"/></g>`;
  }
  return `<g ${t}><path d="M-7 0 Q-13 -11 -4 -25 L0 -33 L4 -25 Q13 -11 7 0 Q0 3 -7 0 Z" fill="#ddd2bc" stroke="#978870" stroke-width="1.2" stroke-linejoin="round"/><path d="M-10 -8 Q0 -3 10 -9 M-8 -16 Q0 -12 8 -17 M-5 -23 Q0 -21 4 -25" stroke="#a49479" stroke-width="1.2" fill="none" stroke-linecap="round"/><path d="M3 -1 Q10 -6 5 -13" stroke="#b9785c" stroke-width="1.6" fill="none" stroke-linecap="round"/></g>`;
}
/** A point on a quadratic curve: the signal line hangs like one. */
function bezier(p0, p1, p2, t) {
  const u = 1 - t;
  return [u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]];
}
const MIESTA_T = [0.14, 0.32, 0.5, 0.68, 0.86];
/** The five flags on the small line in the room window, in the order they were hoisted. */
function vlajkyVOkneSvg(poradie) {
  return MIESTA_T.map((t, i) => {
    const [x, y] = bezier([92, 112], [170, 136], [248, 122], t);
    return `<g transform="translate(${(x - 1).toFixed(1)} ${(y - 0.5).toFixed(1)}) scale(.3)">${vlajkaSvg(poradie[i])}</g>`;
  }).join('');
}
const CHVENIE_X = [0, 3, -2, 4, -3, 2, -4, 1];
const CHVENIE_R = [-8, 6, -3, 9, -6, 4, -10, 7];
const CHVENIE_K = [1, 0.93, 1.06, 0.95, 1.03, 0.97, 1.05, 0.94];
/** Shells on the shelf boards: x from x0 to x1, board tops at ys, size k. */
function musleNaPolici(x0, x1, ys, k) {
  let out = '';
  POLICA.forEach((rad, s) => {
    const w = (x1 - x0) / rad.length;
    rad.forEach((druh, i) => {
      const j = (s * 3 + i) % 8;
      out += musla(druh, x0 + w * (i + 0.5) + CHVENIE_X[j] * k * 0.6, ys[s], k * CHVENIE_K[j], CHVENIE_R[j]);
    });
  });
  return out;
}
const OKNO_OBLOHA = `<stop offset="0" stop-color="#101a31"/><stop offset=".42" stop-color="#27304f"/><stop offset=".74" stop-color="#7a4d58"/><stop offset="1" stop-color="#e58b57"/>`;
const OKNO_MORE = `<stop offset="0" stop-color="#2c4a60"/><stop offset="1" stop-color="#0b1824"/>`;

/** A colour between two hex colours, t from 0 to 1. */
function zmiesaj(a, b, t) {
  const x = (h, i) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return '#' + [0, 1, 2].map((i) => Math.round(x(a, i) + (x(b, i) - x(a, i)) * t).toString(16).padStart(2, '0')).join('');
}
/** A straight flight of stairs seen through a doorway: the steps climb away from you, each one
 *  a little smaller and a little warmer, toward the light of the lamp room at the top.
 *  x0..x1 is the width at the floor line yDole, yHore is where the top step ends. */
function schodySvg(x0, x1, yDole, yHore, n) {
  const q = 0.84;
  let spolu = 0;
  for (let i = 0; i < n; i++) spolu += q ** i;
  const H = (yDole - yHore) / spolu;
  const W = x1 - x0, stred = x0 + W * 0.54;
  const wTop = W * q ** n * 0.9;
  const f = (v) => v.toFixed(1);
  let out = `<path d="M${x0} ${yDole} L${f(stred - wTop / 2)} ${yHore} V${yHore - 300} H${x0 - 40} V${yDole} Z" fill="#140d08"/>`
    + `<path d="M${x1} ${yDole} L${f(stred + wTop / 2)} ${yHore} V${yHore - 300} H${x1 + 40} V${yDole} Z" fill="#26170d"/>`;
  let y = yDole;
  for (let i = 0; i < n; i++) {
    const h = H * q ** i;
    const w0 = W * q ** i * 0.9, w1 = W * q ** (i + 1) * 0.9;
    const yT = y - h, yS = y - h * 0.3;
    const t = n > 1 ? i / (n - 1) : 1;
    // The riser faces you; the tread above it is the lit top of the step.
    out += `<path d="M${f(stred - w0 / 2)} ${f(y)} H${f(stred + w0 / 2)} V${f(yS)} H${f(stred - w0 / 2)} Z" fill="${zmiesaj('#2a1a10', '#8f5a2c', t)}"/>`
      + `<path d="M${f(stred - w0 / 2)} ${f(yS)} H${f(stred + w0 / 2)} L${f(stred + w1 / 2)} ${f(yT)} H${f(stred - w1 / 2)} Z" fill="${zmiesaj('#4a3020', '#e0a15a', t)}"/>`;
    y = yT;
  }
  // A handrail along the right wall, climbing with the steps.
  out += `<path d="M${f(x1 - W * 0.04)} ${f(yDole - H * 1.3)} L${f(stred + wTop / 2 + 2)} ${f(yHore - H * 0.5)}" stroke="#c9a25a" stroke-opacity=".55" stroke-width="${f(Math.max(1.5, W / 60))}" stroke-linecap="round"/>`;
  return out;
}

/** The room, seen from one side. 800 x 600. Closed and open states are both drawn; classes on the stage pick one.
 *  Every thing you can tap has a .hit rectangle; the test checks they stay at least 24 CSS px at a 320 px screen. */
export function scenaSvg() {
  const podlaha = [];
  for (let i = -7; i <= 7; i++) podlaha.push(`M${400 + i * 60} 472 L${400 + i * 96} 600`);
  const obklad = [];
  for (let x = 30; x < 800; x += 36) obklad.push(`M${x} 392 V466`);
  const hs = (id, nazov, x, y, w, h, obsah) =>
    `<g class="hs" data-hs="${id}" tabindex="0" role="button" aria-label="${esc(nazov)}">${obsah}<rect class="hit" x="${x}" y="${y}" width="${w}" height="${h}" rx="10"/></g>`;
  return `
<defs>
  <linearGradient id="es-stena" x1="0" x2="1"><stop offset="0" stop-color="#1d1511"/><stop offset=".2" stop-color="#2d221a"/><stop offset=".5" stop-color="#382b21"/><stop offset=".8" stop-color="#2d221a"/><stop offset="1" stop-color="#1b140f"/></linearGradient>
  <linearGradient id="es-obklad" x1="0" x2="1"><stop offset="0" stop-color="#23180f"/><stop offset=".25" stop-color="#35261b"/><stop offset=".5" stop-color="#3e2e22"/><stop offset=".75" stop-color="#35261b"/><stop offset="1" stop-color="#20160e"/></linearGradient>
  <linearGradient id="es-podlaha" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#3d2b1e"/><stop offset="1" stop-color="#2a1d14"/></linearGradient>
  <linearGradient id="es-obloha" x1="0" x2="0" y1="0" y2="1">${OKNO_OBLOHA}</linearGradient>
  <linearGradient id="es-more" x1="0" x2="0" y1="0" y2="1">${OKNO_MORE}</linearGradient>
  <linearGradient id="es-mosadz" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#f1c870"/><stop offset="1" stop-color="#a5712c"/></linearGradient>
  <linearGradient id="es-koza" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#7a3526"/><stop offset="1" stop-color="#561f16"/></linearGradient>
  <radialGradient id="es-svetlo" cx="490" cy="316" r="380" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffc27a" stop-opacity=".30"/><stop offset=".45" stop-color="#ff9a4d" stop-opacity=".08"/><stop offset="1" stop-color="#ff9a4d" stop-opacity="0"/></radialGradient>
  <radialGradient id="es-vinjeta" cx="400" cy="300" r="560" gradientUnits="userSpaceOnUse"><stop offset=".62" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".36"/></radialGradient>
  <radialGradient id="es-plamen" cx=".5" cy=".62" r=".5"><stop offset="0" stop-color="#fff4cf"/><stop offset=".45" stop-color="#ffc45c"/><stop offset="1" stop-color="#ff8a3c" stop-opacity="0"/></radialGradient>
  <linearGradient id="es-schody" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ffb55a" stop-opacity=".55"/><stop offset="1" stop-color="#ffb55a" stop-opacity="0"/></linearGradient>
  <clipPath id="es-sklo"><path d="M96 296 V172 A74 74 0 0 1 244 172 V296 Z"/></clipPath>
  <clipPath id="es-otvor"><path d="M680 466 V178 A51 51 0 0 1 782 178 V466 Z"/></clipPath>
  <linearGradient id="es-veko" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#5a3a24"/><stop offset="1" stop-color="#3a2416"/></linearGradient>
</defs>
<rect width="800" height="600" fill="#0d0907"/>
<rect width="800" height="472" fill="url(#es-stena)"/>
<rect width="800" height="18" fill="#1b140f"/><rect y="18" width="800" height="5" fill="#3b2c21"/>
<path d="M0 25 Q400 40 800 25" stroke="#1d1611" stroke-width="3" fill="none"/>
<rect y="392" width="800" height="76" fill="url(#es-obklad)"/>
<path d="${obklad.join(' ')}" stroke="#1b130e" stroke-width="2"/>
<rect y="385" width="800" height="8" fill="#3c2c20"/><rect y="385" width="800" height="1.5" fill="#54402f"/>
<rect y="472" width="800" height="128" fill="url(#es-podlaha)"/>
<path d="${podlaha.join(' ')}" stroke="#1c130c" stroke-width="1.6" opacity=".8"/>
<path d="M60 522 H250 M470 540 H700 M120 572 H380 M560 586 H760" stroke="#1c130c" stroke-width="1.4" opacity=".7"/>
<rect y="466" width="800" height="7" fill="#1a120d"/>

<g class="lano-klbko" aria-hidden="true">
  <ellipse cx="686" cy="548" rx="46" ry="12" fill="#000" opacity=".3"/>
  <ellipse cx="684" cy="540" rx="42" ry="14" fill="#8a7048"/>
  <ellipse cx="684" cy="537" rx="42" ry="14" fill="#b39868"/>
  <ellipse cx="684" cy="537" rx="33" ry="10.5" fill="none" stroke="#8a7048" stroke-width="2.2"/>
  <ellipse cx="684" cy="537" rx="24" ry="7.5" fill="none" stroke="#8a7048" stroke-width="2.2"/>
  <ellipse cx="684" cy="537" rx="14" ry="4.5" fill="#5e4a2e"/>
  <path d="M718 544 Q744 552 760 546" stroke="#b39868" stroke-width="5" fill="none" stroke-linecap="round"/>
</g>
<g class="koberec">
  <ellipse cx="430" cy="544" rx="152" ry="33" fill="#5f261c"/>
  <ellipse cx="430" cy="542" rx="150" ry="31" fill="#6f2c21"/>
  <ellipse cx="430" cy="542" rx="128" ry="26" fill="none" stroke="#a9553a" stroke-width="3"/>
  <ellipse cx="430" cy="542" rx="104" ry="21" fill="none" stroke="#d6b88a" stroke-width="2" opacity=".75"/>
  <ellipse cx="430" cy="542" rx="80" ry="16" fill="none" stroke="#a9553a" stroke-width="3"/>
  <ellipse cx="430" cy="542" rx="48" ry="9.5" fill="#86372a"/>
</g>

${hs('okno', 'The window and the signal line', 58, 60, 212, 266, `
  <path d="M70 318 V168 A100 100 0 0 1 270 168 V318 Z" fill="#17110d"/>
  <path d="M84 308 V170 A86 86 0 0 1 256 170 V308 Z" fill="#5f412b"/>
  <g clip-path="url(#es-sklo)">
    <rect x="90" y="90" width="160" height="210" fill="url(#es-obloha)"/>
    <circle cx="214" cy="126" r="7" fill="#f3e8cf" opacity=".92"/>
    <g fill="#f3e8cf" opacity=".8"><circle cx="118" cy="122" r="1"/><circle cx="142" cy="150" r=".9"/><circle cx="232" cy="166" r="1"/><circle cx="186" cy="108" r=".9"/><circle cx="110" cy="178" r=".8"/></g>
    <path d="M128 150 q5 -5 10 0 q5 -5 10 0 M196 176 q3.5 -3.5 7 0 q3.5 -3.5 7 0" stroke="#e8dccb" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    <path d="M90 229 C116 214 140 212 162 222 L172 229 Z" fill="#1b2234"/>
    <rect x="90" y="228" width="160" height="72" fill="url(#es-more)"/>
    <rect x="90" y="227" width="160" height="2.5" fill="#f2ae78" opacity=".55"/>
    <path d="M150 238 H186 M156 246 H180 M160 256 H176 M146 268 H170" stroke="#e8955f" stroke-width="1.6" opacity=".45" stroke-linecap="round"/>
    <path class="lano" d="M92 112 Q170 136 248 122" stroke="#cdb892" stroke-width="1.4" fill="none"/>
    <g class="okno-vlajky"></g>
    <g transform="translate(204 246)"><g class="lodka">
      <path d="M-17 0 H17 L11 7 H-11 Z" fill="#1a130e"/>
      <rect x="-7" y="-7" width="9" height="7" fill="#2b1f17"/>
      <path d="M4 0 V-21" stroke="#1a130e" stroke-width="1.6"/>
      <circle class="lucerna-svit" cx="4" cy="-22" r="9" fill="#ffd27a" opacity=".22"/>
      <circle class="lucerna" cx="4" cy="-22" r="2.4" fill="#ffd27a"/>
      <path d="M-12 11 H10" stroke="#ffd27a" stroke-width="1" opacity=".3"/>
    </g></g>
  </g>
  <path d="M170 98 V296 M96 202 H244" stroke="#4d3423" stroke-width="6"/>
  <path d="M96 296 V172 A74 74 0 0 1 244 172 V296 Z" fill="none" stroke="#3f2b1d" stroke-width="3"/>
  <rect x="58" y="306" width="224" height="14" rx="2" fill="#6c4a31"/><rect x="58" y="306" width="224" height="2" fill="#8a6443"/>
  <rect x="64" y="320" width="212" height="6" fill="#140e0a" opacity=".6"/>
  <path d="M248 214 h10 v10 h-10 Z" fill="url(#es-mosadz)"/><path d="M253 219 L270 262" stroke="#cdb892" stroke-width="1.4"/>
`)}

${hs('kabat', "Grandpa's raincoat", 270, 92, 68, 138, `
  <circle cx="302" cy="112" r="3.2" fill="url(#es-mosadz)"/>
  <path d="M288 124 L316 124 L328 214 L276 214 Z" fill="#d7a22d"/>
  <path d="M302 124 L328 214 L304 214 Z" fill="#b9861f"/>
  <path d="M296 124 L302 150 L308 124" fill="none" stroke="#9c711a" stroke-width="2"/>
  <path d="M302 150 V212" stroke="#9c711a" stroke-width="1.6"/>
  <circle cx="306" cy="166" r="1.8" fill="#6d5014"/><circle cx="306" cy="186" r="1.8" fill="#6d5014"/>
  <path d="M286 110 Q302 92 318 110 Z" fill="#d7a22d"/><path d="M280 112 Q302 104 324 112 Q302 118 280 112 Z" fill="#b9861f"/>
`)}

${hs('obraz', 'A photograph of Grandma and Grandpa', 338, 78, 72, 92, `
  <rect x="340" y="86" width="62" height="74" rx="2" fill="#8f6f37"/><rect x="340" y="86" width="62" height="74" rx="2" fill="none" stroke="#b8924a" stroke-width="1.5"/>
  <rect x="346" y="92" width="50" height="62" fill="#d9c8a6"/>
  <rect x="384" y="100" width="6" height="30" fill="#efe4cf"/><path d="M383 100 h8 l-1 -4 h-6 Z" fill="#b24a36"/>
  <path d="M348 154 Q352 132 362 131 Q372 132 374 154 Z" fill="#6f5a42"/>
  <circle cx="361" cy="122" r="6.5" fill="#8a7152"/><rect x="354" y="113" width="14" height="4" rx="1" fill="#4a3a2a"/>
  <path d="M368 154 Q371 135 380 134 Q389 135 392 154 Z" fill="#7d6448"/>
  <circle cx="380" cy="125" r="6" fill="#9a7e5d"/><circle cx="380" cy="117.5" r="3.2" fill="#6a5238"/>
`)}

${hs('polica', 'The shell shelf', 412, 102, 128, 184, `
  <rect x="416" y="110" width="118" height="7" fill="#6a4a31"/>
  <rect x="420" y="117" width="6" height="160" fill="#553a26"/><rect x="524" y="117" width="6" height="160" fill="#553a26"/>
  <rect x="420" y="158" width="110" height="6" fill="#6a4a31"/><rect x="420" y="213" width="110" height="6" fill="#6a4a31"/><rect x="418" y="268" width="114" height="8" fill="#6a4a31"/>
  <rect x="420" y="164" width="110" height="3" fill="#120d0a" opacity=".5"/><rect x="420" y="219" width="110" height="3" fill="#120d0a" opacity=".5"/>
  ${musleNaPolici(426, 524, [158, 213, 268], 0.62)}
`)}

<g class="stol">
  <rect x="292" y="364" width="222" height="16" fill="#523723"/>
  <rect x="298" y="372" width="10" height="96" fill="#4a311f"/><rect x="498" y="372" width="10" height="96" fill="#4a311f"/>
  <rect x="280" y="352" width="246" height="14" rx="2" fill="#7a5336"/><rect x="280" y="352" width="246" height="2.5" fill="#94694a"/>
  <g class="lampa-stol">
    <ellipse cx="492" cy="351" rx="15" ry="4" fill="#6f5028"/>
    <path d="M484 350 Q480 340 486 334 H498 Q504 340 500 350 Z" fill="url(#es-mosadz)"/>
    <path d="M484 334 Q480 316 486 302 H498 Q504 316 500 334 Z" fill="#fff3d6" opacity=".16" stroke="#f7e2b5" stroke-opacity=".45"/>
    <ellipse class="plamen" cx="492" cy="321" rx="4.2" ry="8.5" fill="url(#es-plamen)"/>
  </g>
</g>

${hs('list', "Grandpa's letter", 280, 292, 92, 80, `
  <g transform="rotate(-6 330 342)">
    <rect x="304" y="330" width="54" height="24" fill="#efe4cc"/>
    <path d="M309 337 H350 M309 342 H346 M309 347 H338" stroke="#8d7f67" stroke-width="1.3"/>
    <path d="M304 330 L331 344 L358 330" fill="none" stroke="#d8cbb0" stroke-width="1"/>
  </g>
`)}

${hs('dennik', "Grandpa's logbook", 372, 292, 104, 80, `
  <g class="dennik-zatv">
    <path d="M380 352 L390 322 H462 L452 352 Z" fill="url(#es-koza)"/>
    <path d="M380 352 H452 V358 H380 Z" fill="#e7dbc0"/><path d="M452 352 L462 322 V328 L452 358 Z" fill="#cdbf9f"/>
    <path d="M404 330 H436 L433 340 H401 Z" fill="#d9c39a"/>
    <path d="M444 326 H454 L448 346 H438 Z" fill="url(#es-mosadz)"/>
  </g>
  <g class="dennik-otv">
    <path d="M372 354 L382 328 H420 L416 354 Z" fill="#efe4cc"/><path d="M416 354 L420 328 H458 L462 354 Z" fill="#e6dac0"/>
    <path d="M386 336 H414 M384 342 H412 M382 348 H404 M424 336 H452 M426 342 H454 M428 348 H446" stroke="#8d7f67" stroke-width="1.1"/>
    <path d="M372 354 H462 V358 H372 Z" fill="#5d241a"/>
  </g>
`)}

${hs('truhla', "Grandpa's sea chest", 56, 396, 186, 154, `
  <ellipse cx="148" cy="542" rx="92" ry="9" fill="#000" opacity=".35"/>
  <g class="truhla-zatv">
    <rect x="70" y="466" width="156" height="72" rx="5" fill="#5a3923"/>
    <path d="M66 470 V458 Q148 418 230 458 V470 Z" fill="#6c452b"/>
    <path d="M66 470 H230" stroke="#3b2516" stroke-width="3"/>
    <rect x="92" y="438" width="10" height="100" fill="#2d2622"/><rect x="194" y="438" width="10" height="100" fill="#2d2622"/>
    <rect x="136" y="458" width="24" height="24" rx="2" fill="url(#es-mosadz)"/>
    <path d="M140.8 462v16M145.6 462v16M150.4 462v16M155.2 462v16M140 462.8h16M140 467.6h16M140 472.4h16M140 477.2h16" stroke="#7a5320" stroke-width=".8"/>
  </g>
  <g class="truhla-otv">
    <path d="M76 458 L84 408 Q148 394 212 408 L220 458 Z" fill="url(#es-veko)"/>
    <path d="M86 420 Q148 408 210 420 M82 440 Q148 428 214 440" stroke="#2f1d12" stroke-width="1.4" fill="none" opacity=".7"/>
    <path d="M94 458 L98 406 H107 L104 458 Z M192 458 L189 406 H198 L202 458 Z" fill="#2d2622"/>
    <path d="M76 458 H220 L230 472 H66 Z" fill="#1a110b"/>
    <path d="M82 462 H214 L222 471 H74 Z" fill="#3f2a1b"/>
    <path d="M110 464 H186 L189 469 H107 Z" fill="#54392a" opacity=".6"/>
    <rect x="66" y="470" width="164" height="6" rx="2" fill="#7a4f31"/>
    <rect x="70" y="475" width="156" height="63" rx="5" fill="#5a3923"/>
    <rect x="92" y="475" width="10" height="63" fill="#2d2622"/><rect x="194" y="475" width="10" height="63" fill="#2d2622"/>
    <rect x="140" y="482" width="16" height="14" rx="2" fill="url(#es-mosadz)"/>
  </g>
`)}

${hs('skrina', 'The tall cabinet', 542, 148, 118, 324, `
  <rect x="546" y="156" width="110" height="14" fill="#6d4a31"/><rect x="546" y="156" width="110" height="2" fill="#87603f"/>
  <rect x="552" y="170" width="98" height="290" fill="#553823"/>
  <rect x="549" y="456" width="104" height="10" fill="#3c2819"/>
  <g class="skrina-zatv">
    <rect x="558" y="178" width="41" height="274" fill="#5f3f28" stroke="#47301f" stroke-width="2"/>
    <rect x="603" y="178" width="41" height="274" fill="#5f3f28" stroke="#47301f" stroke-width="2"/>
    <rect x="565" y="190" width="27" height="92" fill="none" stroke="#4b3220" stroke-width="2"/><rect x="610" y="190" width="27" height="92" fill="none" stroke="#4b3220" stroke-width="2"/>
    <rect x="565" y="336" width="27" height="104" fill="none" stroke="#4b3220" stroke-width="2"/><rect x="610" y="336" width="27" height="104" fill="none" stroke="#4b3220" stroke-width="2"/>
    <rect x="578" y="296" width="46" height="22" rx="3" fill="url(#es-mosadz)"/>
    <circle cx="590" cy="307" r="4.5" fill="#3a2a1d"/><circle cx="601" cy="307" r="4.5" fill="#3a2a1d"/><circle cx="612" cy="307" r="4.5" fill="#3a2a1d"/>
  </g>
  <g class="skrina-otv">
    <rect x="558" y="178" width="86" height="274" fill="#1b120c"/>
    <rect x="558" y="262" width="86" height="5" fill="#4a3120"/><rect x="558" y="360" width="86" height="5" fill="#4a3120"/>

    <g class="doska-v-skrini"><rect x="600" y="332" width="38" height="28" fill="#6f4b30"/><rect x="603" y="335" width="32" height="22" fill="#c49a3f" opacity=".7"/><rect x="603" y="335" width="12" height="10" fill="#b8604a" opacity=".8"/><rect x="620" y="346" width="15" height="11" fill="#648f5b" opacity=".8"/></g>
    <path d="M552 176 L540 170 V458 L552 452 Z" fill="#5f3f28"/><path d="M650 176 L662 170 V458 L650 452 Z" fill="#5f3f28"/>
  </g>
`)}

${hs('dvere', 'The stair door to the lamp', 668, 84, 124, 388, `
  <rect x="704" y="92" width="54" height="16" rx="3" fill="#221912" stroke="url(#es-mosadz)" stroke-width="1.5"/>
  <text x="731" y="104.5" text-anchor="middle" font-family="ARLing Sans, system-ui, sans-serif" font-size="10" font-weight="700" letter-spacing="2" fill="#e5b865">LAMP</text>
  <path d="M672 468 V176 A59 59 0 0 1 790 176 V468 Z" fill="#2a1d14"/>
  <g class="dvere-zatv">
    <path d="M680 466 V178 A51 51 0 0 1 782 178 V466 Z" fill="#664629"/>
    <path d="M700 132 V466 M721 124 V466 M741 124 V466 M762 132 V466" stroke="#4c331f" stroke-width="2"/>
    <rect x="680" y="206" width="40" height="7" rx="2" fill="#262120"/><rect x="680" y="404" width="40" height="7" rx="2" fill="#262120"/>
    <rect x="752" y="288" width="20" height="36" rx="3" fill="url(#es-mosadz)"/>
    <circle cx="762" cy="302" r="3" fill="#2a1d14"/><rect x="760.8" y="303" width="2.4" height="8" fill="#2a1d14"/>
  </g>
  <g class="dvere-otv">
    <path d="M680 466 V178 A51 51 0 0 1 782 178 V466 Z" fill="#0d0907"/>
    <g clip-path="url(#es-otvor)">${schodySvg(680, 782, 466, 196, 9)}</g>
    <path d="M680 466 V178 A51 51 0 0 1 782 178 V466 Z" fill="url(#es-schody)" opacity=".7"/>
    <path d="M680 466 V178 L694 190 V458 Z" fill="#664629"/>
  </g>
`)}

<rect class="svetlo" width="800" height="600" fill="url(#es-svetlo)" pointer-events="none"/>
<rect width="800" height="600" fill="url(#es-vinjeta)" pointer-events="none"/>`;
}

/** The view out of the window, larger, for the close-up with the flags. 600 x 300. */
function oknoPohladSvg(poradie, hore) {
  const miesta = MIESTA_T.map((t) => bezier([0, 60], [300, 150], [600, 90], t));
  return `<svg class="blizko okno-pohlad" viewBox="0 0 600 300" role="img" aria-label="The sea at dusk, Grandma's boat out by the point, and Grandpa's signal line running out from the window">
<defs>
  <linearGradient id="ep-obloha" x1="0" x2="0" y1="0" y2="1">${OKNO_OBLOHA}</linearGradient>
  <linearGradient id="ep-more" x1="0" x2="0" y1="0" y2="1">${OKNO_MORE}</linearGradient>
</defs>
<rect width="600" height="300" fill="url(#ep-obloha)"/>
<circle cx="470" cy="62" r="15" fill="#f3e8cf" opacity=".92"/>
<g fill="#f3e8cf" opacity=".8"><circle cx="90" cy="40" r="1.4"/><circle cx="210" cy="30" r="1.1"/><circle cx="330" cy="54" r="1.2"/><circle cx="560" cy="120" r="1.2"/><circle cx="410" cy="26" r="1"/></g>
<path d="M150 110 q9 -9 18 0 q9 -9 18 0 M390 140 q6 -6 12 0 q6 -6 12 0" stroke="#e8dccb" stroke-width="2" fill="none" stroke-linecap="round"/>
<path d="M0 200 C60 172 120 170 190 186 L230 200 Z" fill="#1b2234"/>
<rect y="198" width="600" height="102" fill="url(#ep-more)"/>
<rect y="196" width="600" height="4" fill="#f2ae78" opacity=".5"/>
<path d="M300 214 H380 M314 228 H370 M322 244 H362 M290 266 H350" stroke="#e8955f" stroke-width="2.4" opacity=".45" stroke-linecap="round"/>
<g transform="translate(430 232)"><g class="lodka">
  <path d="M-40 0 H40 L26 16 H-26 Z" fill="#1a130e"/>
  <rect x="-16" y="-16" width="22" height="16" fill="#2b1f17"/><rect x="-12" y="-12" width="6" height="6" fill="#ffd27a" opacity=".5"/>
  <path d="M10 0 V-50" stroke="#1a130e" stroke-width="3"/>
  <circle class="lucerna-svit" cx="10" cy="-53" r="20" fill="#ffd27a" opacity=".2"/>
  <circle class="lucerna" cx="10" cy="-53" r="5" fill="#ffd27a"/>
  <path d="M-30 24 H26" stroke="#ffd27a" stroke-width="2" opacity=".25"/>
</g></g>
<path d="M0 60 Q300 150 600 90" stroke="#cdb892" stroke-width="2.2" fill="none"/>
${miesta.map(([x, y], i) => `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><circle r="3.5" fill="url(#es-mosadz)" stroke="#6b4b1f"/><text y="-9" text-anchor="middle" font-size="12" font-family="ARLing Sans, system-ui, sans-serif" fill="#e8dccb" opacity=".8">${i + 1}</text>${hore ? `<g class="vztyk" style="--d:${i * 90}ms" transform="translate(-4 3)">${vlajkaSvg(poradie[i])}</g>` : ''}</g>`).join('')}
<rect x="0" y="0" width="14" height="300" fill="#4d3423"/>
</svg>`;
}

function truhlaOtvorenaSvg() {
  return `<svg class="blizko truhla-blizko" viewBox="0 0 520 300" role="img" aria-label="The sea chest, open. The lid leans back on its hinges, and the wooden floor inside is empty.">
<defs><linearGradient id="et-m" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#f1c870"/><stop offset="1" stop-color="#a5712c"/></linearGradient>
<linearGradient id="et-v" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#6a452b"/><stop offset=".75" stop-color="#4a2f1d"/><stop offset="1" stop-color="#2e1c11"/></linearGradient>
<linearGradient id="et-d" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#2a1b11"/><stop offset="1" stop-color="#5a3c27"/></linearGradient></defs>
<ellipse cx="260" cy="286" rx="220" ry="12" fill="#000" opacity=".35"/>
<g class="veko">
  <path d="M84 142 L100 30 Q260 2 420 30 L436 142 Z" fill="url(#et-v)"/>
  <path d="M96 58 Q260 34 424 58 M92 86 Q260 64 428 86 M88 114 Q260 94 432 114" stroke="#3a2416" stroke-width="2" fill="none" opacity=".7"/>
  <path d="M126 142 L134 26 H154 L150 142 Z M370 142 L366 26 H386 L394 142 Z" fill="#2d2622"/>
  <circle cx="144" cy="46" r="3" fill="#6b5a44"/><circle cx="376" cy="46" r="3" fill="#6b5a44"/><circle cx="142" cy="100" r="3" fill="#6b5a44"/><circle cx="378" cy="100" r="3" fill="#6b5a44"/>
  <rect x="244" y="22" width="32" height="30" rx="3" fill="url(#et-m)"/><rect x="254" y="46" width="12" height="18" rx="2" fill="url(#et-m)"/>
</g>
<rect x="120" y="138" width="36" height="8" rx="2" fill="#1d1916"/><rect x="364" y="138" width="36" height="8" rx="2" fill="#1d1916"/>
<path d="M84 142 H436 L462 178 H58 Z" fill="#150d08"/>
<path d="M92 148 H428 L446 176 H74 Z" fill="url(#et-d)"/>
<path d="M150 150 L128 176 M230 150 L222 176 M310 150 L318 176 M390 150 L412 176" stroke="#2a1a10" stroke-width="2" opacity=".8"/>
<path d="M176 156 H344 L350 170 H170 Z" fill="#6d4a31" opacity=".45"/>
<rect x="54" y="174" width="412" height="12" rx="4" fill="#7a4f31"/><rect x="54" y="174" width="412" height="3" rx="1.5" fill="#94694a"/>
<rect x="60" y="184" width="400" height="96" rx="10" fill="#5a3923"/>
<path d="M60 232 H460" stroke="#4a2e1c" stroke-width="2" opacity=".6"/>
<rect x="118" y="184" width="22" height="96" fill="#2d2622"/><rect x="380" y="184" width="22" height="96" fill="#2d2622"/>
<rect x="238" y="192" width="44" height="40" rx="4" fill="url(#et-m)"/><circle cx="260" cy="208" r="5" fill="#2a1d14"/><rect x="258" y="210" width="4" height="12" fill="#2a1d14"/>
</svg>`;
}

function dennikObalSvg() {
  return `<svg class="blizko" viewBox="0 0 520 290" role="img" aria-label="The logbook cover. Brass letters: ${SIFRA.split('').join(' ')}. A paper label says: every letter moved forward by Grandma's number.">
<defs><linearGradient id="ed-k" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#7a3526"/><stop offset="1" stop-color="#4a1b13"/></linearGradient>
<linearGradient id="ed-m" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#f4d184"/><stop offset="1" stop-color="#a5712c"/></linearGradient></defs>
<rect x="46" y="14" width="428" height="262" rx="14" fill="#2a120d"/>
<rect x="52" y="10" width="420" height="262" rx="12" fill="url(#ed-k)"/>
<rect x="52" y="10" width="34" height="262" rx="10" fill="#000" opacity=".22"/>
<rect x="100" y="26" width="356" height="230" rx="8" fill="none" stroke="#c79a62" stroke-width="1.6" stroke-dasharray="5 5" opacity=".6"/>
<text x="278" y="62" text-anchor="middle" font-family="ARLing Sans, system-ui, sans-serif" font-size="15" font-weight="700" letter-spacing="6" fill="#d8b27a">LOGBOOK</text>
<text x="278" y="148" text-anchor="middle" font-family="ARLing Sans, system-ui, sans-serif" font-size="54" font-weight="700" letter-spacing="14" fill="url(#ed-m)">${SIFRA}</text>
<g transform="rotate(-2 278 210)"><rect x="122" y="186" width="312" height="46" fill="#ece1c8"/><text x="278" y="214" text-anchor="middle" font-family="ARLing Serif, Georgia, serif" font-style="italic" font-size="16" fill="#3a2c20">moved forward by Grandma's number</text></g>
</svg>`;
}

function policaSvg() {
  let popis = POLICA.map((rad, s) => ['Top board', 'Middle board', 'Bottom board'][s] + ', left to right: ' + rad.map((d) => MUSLE[d].jedna).join(', ') + '.').join(' ');
  return `<svg class="blizko" viewBox="0 0 600 350" role="img" aria-label="${esc(popis)}">
<rect width="600" height="350" fill="#2a2019"/>
<rect x="40" y="18" width="520" height="18" fill="#6a4a31"/>
<rect x="52" y="36" width="16" height="304" fill="#553a26"/><rect x="532" y="36" width="16" height="304" fill="#553a26"/>
${[118, 222, 326].map((y) => `<rect x="52" y="${y}" width="496" height="14" fill="#6a4a31"/><rect x="52" y="${y}" width="496" height="3" fill="#86603f"/><rect x="68" y="${y + 14}" width="464" height="6" fill="#120d0a" opacity=".45"/>`).join('')}
${musleNaPolici(72, 528, [118, 222, 326], 2.3)}
</svg>`;
}

function skrinaSvg(otvorena) {
  return `<svg class="blizko skrina-blizko${otvorena ? ' otv' : ''}" viewBox="0 0 420 320" role="img" aria-label="${otvorena ? 'The cabinet, open. Inside: an oil can on the upper shelf and a wooden pebble board below.' : 'The tall cabinet, shut. On the doors, a brass plate with three dials.'}">
<rect x="20" y="0" width="380" height="320" fill="#553823"/>
<rect x="40" y="10" width="340" height="300" fill="#1b120c"/>
<rect x="40" y="130" width="340" height="10" fill="#4a3120"/><rect x="40" y="240" width="340" height="10" fill="#4a3120"/>
<g class="olej-blizko"><path d="M84 130 V88 Q84 76 96 76 H140 Q152 76 152 88 V130 Z" fill="#8f969a"/><path d="M84 96 H152" stroke="#6c7276" stroke-width="3"/><path d="M146 84 L186 50" stroke="#8f969a" stroke-width="7" stroke-linecap="round"/><rect x="104" y="62" width="20" height="14" fill="#6c7276"/><path d="M92 120 H146" stroke="#b9c0c4" stroke-width="2" opacity=".5"/></g>
<g><rect x="220" y="178" width="130" height="62" rx="4" fill="#6f4b30"/>${[0, 1, 2, 3, 4].map((r) => [0, 1, 2, 3, 4].map((c) => `<rect x="${226 + c * 24}" y="${182 + r * 11}" width="23" height="10" fill="${PLATNE[oblast(r, c)].farba}" opacity=".85"/>`).join('')).join('')}</g>
<g class="dvierko l"><rect x="40" y="10" width="170" height="300" fill="#5f3f28" stroke="#47301f" stroke-width="3"/><rect x="62" y="30" width="126" height="96" fill="none" stroke="#4b3220" stroke-width="3"/><rect x="62" y="194" width="126" height="96" fill="none" stroke="#4b3220" stroke-width="3"/></g>
<g class="dvierko p"><rect x="210" y="10" width="170" height="300" fill="#5f3f28" stroke="#47301f" stroke-width="3"/><rect x="232" y="30" width="126" height="96" fill="none" stroke="#4b3220" stroke-width="3"/><rect x="232" y="194" width="126" height="96" fill="none" stroke="#4b3220" stroke-width="3"/></g>
<g class="platna">
  <defs><linearGradient id="ek-m" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#f4d184"/><stop offset="1" stop-color="#a5712c"/></linearGradient>
  <linearGradient id="ek-o" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#6b4d1f"/><stop offset=".3" stop-color="#f3dca4"/><stop offset=".7" stop-color="#f3dca4"/><stop offset="1" stop-color="#6b4d1f"/></linearGradient></defs>
  <rect x="142" y="134" width="136" height="54" rx="8" fill="url(#ek-m)" stroke="#6b4b1f" stroke-width="1.5"/>
  ${[0, 1, 2].map((i) => `<rect x="${156 + i * 38}" y="143" width="32" height="36" rx="4" fill="url(#ek-o)" stroke="#5a3d17" stroke-width="1.5"/><path d="M${160 + i * 38} 151 H${184 + i * 38} M${160 + i * 38} 171 H${184 + i * 38}" stroke="#8c6a32" stroke-width="1.2" opacity=".7"/>`).join('')}
  <circle cx="148" cy="140" r="2" fill="#6b4b1f"/><circle cx="272" cy="140" r="2" fill="#6b4b1f"/><circle cx="148" cy="182" r="2" fill="#6b4b1f"/><circle cx="272" cy="182" r="2" fill="#6b4b1f"/>
  <rect x="196" y="196" width="28" height="9" rx="4.5" fill="url(#ek-m)" stroke="#6b4b1f"/>
</g>
</svg>`;
}

function dvereSvg(stav) {
  // stav: 'zamknute' (cover shut), 'kryt' (cover open, plate showing below), 'otvorene'
  return `<svg class="blizko dvere-blizko ${stav}" viewBox="0 0 400 300" role="img" aria-label="${stav === 'otvorene' ? 'The stair door stands open. A spiral stair climbs toward a warm light.' : stav === 'kryt' ? 'The brass cover is open. Behind it: the sum plate.' : 'The stair door. A brass cover with a keyhole hides the lock.'}">
<defs><linearGradient id="ev-m" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#f1c870"/><stop offset="1" stop-color="#a5712c"/></linearGradient>
<linearGradient id="ev-s" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ffb55a" stop-opacity=".6"/><stop offset="1" stop-color="#ffb55a" stop-opacity="0"/></linearGradient>
<clipPath id="ev-otvor"><path d="M104 300 V112 A96 96 0 0 1 296 112 V300 Z"/></clipPath></defs>
<rect width="400" height="300" fill="#241b15"/>
<path d="M90 300 V110 A110 110 0 0 1 310 110 V300 Z" fill="#2a1d14"/>
<path d="M104 300 V112 A96 96 0 0 1 296 112 V300 Z" fill="#0d0907"/>
<g clip-path="url(#ev-otvor)">${schodySvg(104, 296, 300, 52, 10)}</g>
<path d="M104 300 V112 A96 96 0 0 1 296 112 V300 Z" fill="url(#ev-s)" opacity=".75"/>
<g class="kridlo"><path d="M104 300 V112 A96 96 0 0 1 296 112 V300 Z" fill="#664629"/>
<path d="M142 40 V300 M181 20 V300 M219 20 V300 M258 40 V300" stroke="#4c331f" stroke-width="3"/>
<rect x="104" y="80" width="70" height="12" rx="3" fill="#262120"/><rect x="104" y="250" width="70" height="12" rx="3" fill="#262120"/>
<rect x="238" y="126" width="44" height="64" rx="6" fill="#3a2a1d"/>
<g class="kryt"><rect x="238" y="126" width="44" height="64" rx="6" fill="url(#ev-m)"/><circle cx="260" cy="150" r="6" fill="#2a1d14"/><rect x="257.5" y="152" width="5" height="16" fill="#2a1d14"/></g>
</g>
</svg>`;
}

function lampaSvg() {
  return `<svg class="blizko lampa-blizko" viewBox="0 0 600 360" role="img" aria-label="The lamp room at the top of the lighthouse. The great lens stands in the middle, windows all around, the sea below.">
<defs>
  <linearGradient id="el-o" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#0d1428"/><stop offset=".6" stop-color="#2a2d4a"/><stop offset="1" stop-color="#6c4552"/></linearGradient>
  <linearGradient id="el-m" x1="0" x2="0" y1="0" y2="1">${OKNO_MORE}</linearGradient>
  <radialGradient id="el-z" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff3cf"/><stop offset=".35" stop-color="#ffc45c" stop-opacity=".85"/><stop offset="1" stop-color="#ff9a3c" stop-opacity="0"/></radialGradient>
  <linearGradient id="el-l" x1="0" x2="1"><stop offset="0" stop-color="#fff1c8" stop-opacity=".75"/><stop offset="1" stop-color="#fff1c8" stop-opacity="0"/></linearGradient>
</defs>
<rect width="600" height="360" fill="url(#el-o)"/>
<g fill="#f3e8cf" opacity=".8"><circle cx="60" cy="40" r="1.3"/><circle cx="160" cy="70" r="1"/><circle cx="420" cy="30" r="1.2"/><circle cx="540" cy="80" r="1.1"/><circle cx="300" cy="20" r="1"/></g>
<rect y="236" width="600" height="124" fill="url(#el-m)"/>
<path d="M0 236 H600" stroke="#f2ae78" stroke-width="2" opacity=".35"/>
<g class="pristav"><path d="M0 300 H110 V312 H0 Z" fill="#17120e"/><path d="M96 300 V282" stroke="#17120e" stroke-width="3"/><circle class="dedo" cx="96" cy="280" r="3.5" fill="#ffd27a"/></g>
<g class="lodka-domov"><path d="M-22 0 H22 L15 9 H-15 Z" fill="#120d0a"/><path d="M6 0 V-26" stroke="#120d0a" stroke-width="2"/><circle cx="6" cy="-28" r="3" fill="#ffd27a"/></g>
<g class="luc"><path d="M300 150 L600 96 V204 Z" fill="url(#el-l)"/></g>
<path d="M0 0 H600 V18 H0 Z M0 342 H600 V360 H0 Z" fill="#1b140f"/>
<path d="M150 18 V342 M300 18 V110 M450 18 V342" stroke="#1b140f" stroke-width="10"/>
<path d="M226 342 L240 236 H360 L374 342 Z" fill="#2e241c"/><path d="M240 236 H360 L362 252 H238 Z" fill="#46362a"/><rect x="214" y="224" width="172" height="12" rx="3" fill="#8a6a36"/><rect x="214" y="224" width="172" height="3" rx="1.5" fill="#c9a25a"/><path d="M262 342 V270 M300 342 V270 M338 342 V270" stroke="#241b15" stroke-width="3"/><rect x="0" y="330" width="600" height="12" fill="#1f1812"/>
<g class="sosovka">
  <ellipse class="lesk" cx="300" cy="150" rx="120" ry="120" fill="url(#el-z)"/>
  <rect x="236" y="70" width="128" height="156" rx="30" fill="#c8d4d6" opacity=".16" stroke="#dfe7e8" stroke-opacity=".5" stroke-width="2"/>
  ${[0, 1, 2, 3, 4, 5].map((i) => `<path d="M${244 + i * 2} ${86 + i * 12} H${356 - i * 2}" stroke="#e8f0f0" stroke-opacity=".35" stroke-width="3"/><path d="M${244 + i * 2} ${214 - i * 12} H${356 - i * 2}" stroke="#e8f0f0" stroke-opacity=".35" stroke-width="3"/>`).join('')}
  <ellipse cx="300" cy="150" rx="22" ry="22" fill="#e8f0f0" opacity=".25"/>
  <circle class="knot" cx="300" cy="152" r="7" fill="#5a4a38"/>
</g>
</svg>`;
}

const IKONY = {
  vlajky: `<svg viewBox="0 0 40 32" aria-hidden="true"><g transform="translate(2 2) scale(.5)">${vlajkaSvg('R')}</g><g transform="translate(14 8) scale(.5)">${vlajkaSvg('Y')}</g><g transform="translate(8 16) scale(.5)">${vlajkaSvg('B')}</g></svg>`,
  cislo: `<svg viewBox="0 0 40 32" aria-hidden="true"><rect x="7" y="4" width="26" height="24" rx="2" fill="#ece1c8"/><text x="20" y="23" text-anchor="middle" font-size="17" font-weight="700" font-family="ARLing Sans, system-ui, sans-serif" fill="#3a2c20">${MAMA_BLIKNE}</text></svg>`,
  stranka: `<svg viewBox="0 0 40 32" aria-hidden="true"><path d="M8 4 H28 L33 9 V28 H8 Z" fill="#ece1c8"/><path d="M12 12 H28 M12 17 H29 M12 22 H24" stroke="#8d7f67" stroke-width="1.6"/></svg>`,
  olej: `<svg viewBox="0 0 40 32" aria-hidden="true"><path d="M9 29 V16 Q9 12 13 12 H23 Q27 12 27 16 V29 Z" fill="#8f969a"/><path d="M25 15 L35 6" stroke="#8f969a" stroke-width="3" stroke-linecap="round"/><rect x="14" y="8" width="7" height="4" fill="#6c7276"/></svg>`,
  kluc: `<svg viewBox="0 0 40 32" aria-hidden="true"><circle cx="12" cy="16" r="6.5" fill="none" stroke="#e1b25c" stroke-width="3"/><path d="M18 16 H35 M30 16 V21 M34 16 V20" stroke="#e1b25c" stroke-width="3" stroke-linecap="round"/></svg>`,
};

const VECI = {
  vlajky: { nazov: 'Signal flags and a rhyme', skryt: (s) => s.otvorene.includes('vlajky') },
  cislo: { nazov: "Grandma's number", skryt: () => false },
  stranka: { nazov: 'Logbook page', skryt: () => false },
  olej: { nazov: 'Oil can', skryt: (s) => s.lampa },
  kluc: { nazov: 'Brass key', skryt: (s) => s.otvorene.includes('dvere') },
};

const TEXT_LIST = [
  'Dear keeper,',
  "Grandma is out in the boat and I have gone down to the harbour to wait for her. Tonight the lamp is yours to light.",
  'You know me: nothing in my room opens without a little puzzle. Every lock has exactly one answer, and the first one is the one I keep closest to my heart.',
  'When the flags fly right, Grandma will answer from her boat.',
  'There is no hurry. The sun is going down, and the lamp will wait for you.',
  'Love, Grandpa',
];
const TEXT_STRANKA = [
  '12 September.',
  'Forty summers of shells on my shelf, and the cabinet keeps its secret with them. Count them and set the three dials in this order: first the starfish, then the scallops, then the curly whelks.',
  'The oil for the lamp is in there too.',
];

// ── 9b. Grids as HTML: pure, so the tests can read what a screen reader gets ──
export function bunkaPopis(r, c, v) {
  return 'Row ' + (r + 1) + ', column ' + (c + 1) + ': ' + (v === 1 ? 'filled' : v === 2 ? 'crossed' : 'empty');
}
const cislaHtml = (b) => b.map((x) => `<span>${x}</span>`).join(' ');
/** The picture grid on the sea chest. Every clue is a real row or column header with words in it,
 *  and every cell points at its row clue and column clue (aria-describedby), so the grid can be
 *  solved by ear as well as by eye. */
export function truhlaMriezkaHtml(m) {
  const hlavicky = `<div class="nono-riadok" role="row"><div class="nono-roh" aria-hidden="true"></div>${TRUHLA_STLPCE.map((b, c) =>
    `<div class="nono-h stlpec" role="columnheader" id="nono-c${c}"><span class="sr">Column ${c + 1} clue </span>${cislaHtml(b)}</div>`).join('')}</div>`;
  const riadky = TRUHLA_RIADKY.map((b, r) => `<div class="nono-riadok" role="row"><div class="nono-h riadok" role="rowheader" id="nono-r${r}"><span class="sr">Row ${r + 1} clue </span>${cislaHtml(b)}</div>${PAT.map((c) => {
    const i = r * 5 + c;
    return `<button type="button" class="nono-b" role="gridcell" data-i="${i}" data-v="${m[i]}" tabindex="${i === 0 ? 0 : -1}" aria-label="${bunkaPopis(r, c, m[i])}" aria-describedby="nono-r${r} nono-c${c}"></button>`;
  }).join('')}</div>`).join('');
  return `<div class="nono" role="grid" aria-label="Picture grid, 5 by 5">${hlavicky}${riadky}</div>`;
}
export function sumaPopis(i, d) {
  return 'Row ' + (Math.floor(i / 3) + 1) + ', column ' + ((i % 3) + 1) + ': ' + (d ? d : 'empty');
}
/** The sum plate on the stair door, with its sums as headers in the same way. */
export function platnaMriezkaHtml(c, vybrata) {
  const bunky = [`<div class="suma-riadok" role="row"><div class="suma-roh" aria-hidden="true"></div>${PLATNA_STLPCE.map((x, k) =>
    `<div class="suma-h stlpec" role="columnheader" id="suma-c${k}"><span class="sr">Column ${k + 1} adds up to </span><span>${x}</span></div>`).join('')}</div>`];
  for (let r = 0; r < 3; r++) {
    bunky.push(`<div class="suma-riadok" role="row"><div class="suma-h riadok" role="rowheader" id="suma-r${r}"><span class="sr">Row ${r + 1} adds up to </span><span>${PLATNA_RIADKY[r]}</span></div>`);
    for (let k = 0; k < 3; k++) {
      const i = r * 3 + k;
      bunky.push(`<button type="button" class="suma-b" role="gridcell" data-i="${i}" tabindex="${i === vybrata ? 0 : -1}" aria-label="${sumaPopis(i, c[i])}" aria-describedby="suma-r${r} suma-c${k}">${c[i] || ''}</button>`);
    }
    bunky.push('</div>');
  }
  return `<div class="suma" role="grid" aria-label="Sum plate, 3 by 3">${bunky.join('')}</div>`;
}

// ── 9c. The game in the page ─────────────────────────────────────────────────
function spustiHru() {
  const $ = (id) => document.getElementById(id);
  const hra = $('escape');
  const stage = $('stage');
  const scena = $('scena');
  const panel = $('panel');
  const panelTelo = $('panel-telo');
  const panelNadpis = $('panel-nadpis');
  const spatBtn = $('spat');
  const stavEl = $('stav');
  const hintBtn = $('hint');
  const hintPocet = $('hint-pocet');
  const casEl = $('cas');
  const casBlok = $('cas-blok');
  const pauzaBtn = $('pauza');
  const pauzaBlok = $('pauza-blok');
  const pauzaCas = $('pauza-cas');
  const pokracujBtn = $('pokracuj');
  const veciEl = $('veci');
  const zamkyEl = $('zamky-pocet');
  const popisEl = $('scena-popis');
  const lista = $('lista');
  const znovaBtn = $('znova');
  const redukovany = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

  const KLUC = 'arling-escape-lighthouse-v1';
  const KLUC_NAST = 'arling-escape-nastavenia-v1';
  function citaj(k) { try { const x = localStorage.getItem(k); return x ? JSON.parse(x) : null; } catch (e) { return null; } }
  function pis(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private window: the game still works, it just forgets */ } }
  function zmaz(k) { try { localStorage.removeItem(k); } catch (e) { /* nothing to clear */ } }
  function track(nazov, data) { try { if (window.umami && typeof window.umami.track === 'function') window.umami.track(nazov, data); } catch (e) { /* statistics are not part of the game */ } }

  function cistyStav() {
    return {
      v: 1, ...novyStav(),
      casti: Object.fromEntries(ZAMKY.map((z) => [z.id, prazdnaCast(z.id)])),
      sekundy: 0, napovedy: 0, napovedyZamok: {}, videl: [], zaciatok: null, koniec: null,
    };
  }
  function platnyStav(x) {
    if (!x || x.v !== 1 || !Array.isArray(x.otvorene) || !Array.isArray(x.veci) || typeof x.casti !== 'object' || !x.casti) return null;
    const c = cistyStav();
    const out = { ...c, ...x, casti: { ...c.casti } };
    for (const z of ZAMKY) {
      const p = x.casti[z.id];
      if (Array.isArray(p) && p.length === c.casti[z.id].length) out.casti[z.id] = p.slice();
    }
    out.otvorene = x.otvorene.filter((id) => zamok(id));
    out.sekundy = Number(x.sekundy) || 0;
    out.napovedy = Number(x.napovedy) || 0;
    out.napovedyZamok = x.napovedyZamok && typeof x.napovedyZamok === 'object' ? x.napovedyZamok : {};
    out.videl = Array.isArray(x.videl) ? x.videl : [];
    return out;
  }
  let s = platnyStav(citaj(KLUC)) || cistyStav();
  const nast = { casovac: true, zvuk: true, oslava: true, ...(citaj(KLUC_NAST) || {}) };
  const uloz = () => pis(KLUC, s);

  // ── Sound: small synthesised tones, nothing is downloaded ──
  let ac = null, hlavny = null, sumBuf = null;
  function audio() {
    if (!nast.zvuk) return null;
    try {
      if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ac = new AC();
        hlavny = ac.createGain();
        hlavny.gain.value = 0.7;
        hlavny.connect(ac.destination);
      }
      if (ac.state === 'suspended') ac.resume();
      return ac;
    } catch (e) { return null; }
  }
  function ton(f, kedy, dlzka, typ, hl, f2) {
    const a = audio();
    if (!a) return;
    try {
      const t = a.currentTime + (kedy || 0);
      const o = a.createOscillator(), g = a.createGain();
      o.type = typ || 'sine';
      o.frequency.setValueAtTime(f, t);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dlzka);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(hl || 0.05, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dlzka);
      o.connect(g); g.connect(hlavny);
      o.start(t); o.stop(t + dlzka + 0.05);
    } catch (e) { /* sound is a courtesy */ }
  }
  function sum(kedy, dlzka, hl, f1, f2) {
    const a = audio();
    if (!a) return;
    try {
      if (!sumBuf) {
        sumBuf = a.createBuffer(1, a.sampleRate, a.sampleRate);
        const d = sumBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      const t = a.currentTime + (kedy || 0);
      const src = a.createBufferSource(), bp = a.createBiquadFilter(), g = a.createGain();
      src.buffer = sumBuf;
      bp.type = 'bandpass'; bp.Q.value = 1.2;
      bp.frequency.setValueAtTime(f1, t);
      if (f2) bp.frequency.exponentialRampToValueAtTime(f2, t + dlzka);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(hl, t + Math.min(0.02, dlzka / 3));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dlzka);
      src.connect(bp); bp.connect(g); g.connect(hlavny);
      src.start(t); src.stop(t + dlzka + 0.05);
    } catch (e) { /* sound is a courtesy */ }
  }
  const ZVUK = {
    klik: () => ton(620, 0, 0.07, 'sine', 0.03),
    znacka: () => ton(540, 0, 0.08, 'triangle', 0.035),
    kamen: () => { ton(300, 0, 0.09, 'triangle', 0.05); sum(0, 0.04, 0.03, 1800); },
    koliesko: () => sum(0, 0.035, 0.05, 2600),
    panel: () => sum(0, 0.16, 0.018, 500, 1400),
    zle: () => { ton(220, 0, 0.2, 'triangle', 0.045); ton(185, 0.13, 0.26, 'triangle', 0.04); },
    otvor: () => { sum(0, 0.06, 0.05, 900); ton(784, 0.06, 1.0, 'sine', 0.05); ton(1175, 0.18, 1.1, 'sine', 0.038); },
    vec: () => { ton(988, 0, 0.4, 'sine', 0.035); ton(1319, 0.09, 0.45, 'sine', 0.028); },
    vztyk: () => sum(0, 0.6, 0.035, 500, 1900),
    blik: () => ton(1319, 0, 0.3, 'sine', 0.03),
    napoveda: () => ton(880, 0, 0.25, 'sine', 0.025),
    finale: () => { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => ton(f, i * 0.18, 1.6, 'sine', 0.045)); ton(98, 0.1, 3, 'sine', 0.05, 92); },
  };
  const zvuk = (k) => { if (nast.zvuk && ZVUK[k]) ZVUK[k](); };

  // ── Time: counted only while the page is visible and someone is playing ──
  let bezi = false, pauza = false, posledny = Date.now(), tik = null;
  const NECINNOST = 60000;
  function hrajuci() {
    posledny = Date.now();
    if (!s.zaciatok) { s.zaciatok = Date.now(); track('game_start', { game: 'lighthouse' }); uloz(); }
    if (!s.lampa && !pauza && !document.hidden) bezi = true;
  }
  function tikaj() {
    if (bezi && !pauza && !s.lampa && !document.hidden) {
      if (Date.now() - posledny > NECINNOST) bezi = false;
      else { s.sekundy += 1; if (s.sekundy % 5 === 0) uloz(); }
    }
    casEl.textContent = formatCas(s.sekundy);
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) { bezi = false; uloz(); } });

  // ── The line in the bar under the stage: hints and what just happened ──
  // typ: 'ok' (something opened), 'zle' (a wrong try), 'info' (a note such as a cleared grid),
  // 'hint'. A wrong try or a note goes away with the next move in the puzzle, and every line goes
  // away when you open or leave a close-up, so the bar never talks about an older state.
  let typHlasenia = '';
  // When the bar has nothing to say, CSS shows this quiet line (never announced): in the room only.
  const KLUD_IZBA = 'Tap anything in the room to look closer.';
  function hlasenie(text, typ) {
    const t = typ === true ? 'ok' : (typ || (text ? 'info' : ''));
    typHlasenia = text ? t : '';
    stavEl.textContent = text;
    stavEl.classList.toggle('ok', t === 'ok' && !!text);
    stavEl.classList.toggle('zle', t === 'zle' && !!text);
    if (text) ukazListu();
  }
  function tah() {
    if (typHlasenia === 'zle' || typHlasenia === 'info') hlasenie('');
    // After the move, a waiting "Hint: show me" stays only while it would still do the same step.
    setTimeout(() => {
      if (!cakaKrok2) return;
      const h = napoveda(s, s.casti, otvorenyPanel && !otvorenyPanel.startsWith('vec:') ? otvorenyPanel : null);
      if (!h || h.kluc !== cakaKrok2) { cakaKrok2 = null; aktualizujNapovedy(); }
    }, 0);
  }
  // The bar sticks to the bottom of the screen while the stage is on it. If a browser cannot
  // do that, bring the bar into view so a hint or a wrong try is never read off screen.
  function ukazListu() {
    try {
      const r = lista.getBoundingClientRect();
      if (r.bottom > window.innerHeight + 1 || r.top < 0) lista.scrollIntoView({ block: 'nearest', behavior: redukovany() ? 'auto' : 'smooth' });
    } catch (e) { /* a courtesy */ }
  }
  // Focus and scrollIntoView keep things above the bar, not under it.
  try {
    const odsad = () => { document.documentElement.style.scrollPaddingBottom = Math.ceil(lista.getBoundingClientRect().height + 12) + 'px'; };
    odsad();
    if (window.ResizeObserver) new ResizeObserver(odsad).observe(lista);
  } catch (e) { /* not needed for play */ }

  // ── Scene ──
  scena.innerHTML = scenaSvg();
  const hotspoty = [...scena.querySelectorAll('.hs')];
  function ukazPopis(g) {
    if (!popisEl) return;
    if (!g) { popisEl.textContent = ''; popisEl.classList.remove('vid'); return; }
    popisEl.textContent = g.getAttribute('aria-label');
    popisEl.classList.add('vid');
  }
  hotspoty.forEach((g) => {
    g.addEventListener('click', () => otvorHotspot(g.dataset.hs, g));
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); otvorHotspot(g.dataset.hs, g); }
    });
    g.addEventListener('pointerenter', () => ukazPopis(g));
    g.addEventListener('pointerleave', () => ukazPopis(null));
    g.addEventListener('focus', () => ukazPopis(g));
    g.addEventListener('blur', () => ukazPopis(null));
  });

  function aktualizujScenu() {
    for (const z of ZAMKY) stage.classList.toggle('o-' + z.id, s.otvorene.includes(z.id));
    stage.classList.toggle('o-lampa', !!s.lampa);
    const vo = scena.querySelector('.okno-vlajky');
    if (vo) vo.innerHTML = s.otvorene.includes('vlajky') ? vlajkyVOkneSvg(s.casti.vlajky) : '';
    zamkyEl.textContent = s.otvorene.length + ' of ' + ZAMKY.length;
    // A shut cabinet or door says so in its name, so a screen reader hears what changed.
    const meno = {
      truhla: s.otvorene.includes('truhla') ? "Grandpa's sea chest, open" : "Grandpa's sea chest",
      skrina: s.otvorene.includes('skrina') ? 'The tall cabinet, open, with the pebble board' : 'The tall cabinet',
      dvere: s.otvorene.includes('dvere') ? 'The stair door, open: climb to the lamp' : 'The stair door to the lamp',
      dennik: s.otvorene.includes('dennik') ? "Grandpa's logbook, open" : "Grandpa's logbook",
    };
    hotspoty.forEach((g) => { if (meno[g.dataset.hs]) g.setAttribute('aria-label', meno[g.dataset.hs]); });
  }

  function aktualizujVrecko() {
    const viditelne = s.veci.filter((v) => VECI[v] && !VECI[v].skryt(s));
    if (!viditelne.length) {
      veciEl.innerHTML = '<span class="prazdne">Empty for now.</span>';
      return;
    }
    veciEl.innerHTML = viditelne.map((v) => `<button type="button" class="vec" data-vec="${v}">${IKONY[v]}<span>${esc(VECI[v].nazov)}</span></button>`).join('');
    veciEl.querySelectorAll('.vec').forEach((b) => b.addEventListener('click', () => { hrajuci(); otvorPanel('vec:' + b.dataset.vec, b); }));
  }

  function aktualizujNapovedy() {
    hintPocet.textContent = String(s.napovedy);
    hintBtn.textContent = cakaKrok2 ? 'Hint: show me' : 'Hint';
    hintBtn.disabled = !!s.lampa || pauza;
  }

  function aktualizujNastavenia() {
    casBlok.hidden = !nast.casovac;
    pauzaBtn.hidden = !nast.casovac || !!s.lampa;
    hra.querySelectorAll('[data-nastavenie]').forEach((i) => { i.checked = !!nast[i.dataset.nastavenie]; });
  }

  // ── Panels (the close-ups) ──
  let otvorenyPanel = null;
  let odkialFokus = null;
  let zatvarac = null;
  function panelPreHotspot(id) {
    if (id === 'okno') return 'vlajky';
    if (id === 'skrina') return s.otvorene.includes('skrina') ? 'doska' : 'skrina';
    if (id === 'dvere') return s.otvorene.includes('dvere') ? 'finale' : 'dvere';
    return id;
  }
  function otvorHotspot(id, g) {
    hrajuci();
    zvyrazni(null);
    otvorPanel(panelPreHotspot(id), g);
  }
  function otvorPanel(id, odkial) {
    if (!id) return;
    if (pauza) return;
    if (zatvarac) { clearTimeout(zatvarac); zatvarac = null; }
    odkialFokus = odkial || odkialFokus;
    // The close-up grows out of the thing that was tapped.
    if (odkial && odkial.getBoundingClientRect) {
      const a = odkial.getBoundingClientRect(), b = stage.getBoundingClientRect();
      if (b.width && a.width) {
        stage.style.setProperty('--ox', ((a.left + a.width / 2 - b.left) / b.width * 100).toFixed(1) + '%');
        stage.style.setProperty('--oy', ((a.top + a.height / 2 - b.top) / Math.max(1, b.height) * 100).toFixed(1) + '%');
      }
    }
    const bolZatvoreny = !otvorenyPanel;
    otvorenyPanel = id;
    if (!s.videl.includes(id)) { s.videl.push(id); uloz(); }
    stavEl.dataset.klud = '';
    hlasenie('');
    vykresliPanel();
    panel.hidden = false;
    scena.setAttribute('inert', '');
    scena.setAttribute('aria-hidden', 'true');
    if (bolZatvoreny) {
      void panel.offsetWidth;
      stage.classList.add('s-panelom');
      zvuk('panel');
    }
    cakaKrok2 = null;
    aktualizujNapovedy();
    panelNadpis.focus({ preventScroll: true });
    const r = stage.getBoundingClientRect();
    if (r.top < 0 || r.top > window.innerHeight * 0.5) stage.scrollIntoView({ block: 'start', behavior: redukovany() ? 'auto' : 'smooth' });
  }
  /** From one close-up straight to the next (the cabinet to its pebble board, the door to the lamp). */
  function prepniPanel(id) {
    otvorenyPanel = id;
    if (!s.videl.includes(id)) { s.videl.push(id); uloz(); }
    cakaKrok2 = null;
    stavEl.dataset.klud = '';
    hlasenie('');
    vykresliPanel();
    aktualizujNapovedy();
    panelNadpis.focus({ preventScroll: true });
    zvuk('panel');
  }
  /** What the bar says in the room: nothing, or after the lamp, where the result is. */
  function hlasenieIzby() {
    if (s.lampa) hlasenie('You lit the lamp in ' + formatCas(s.sekundy) + ' with ' + s.napovedy + (s.napovedy === 1 ? ' hint' : ' hints') + '. Your result and Share are behind the stair door.', 'ok');
    else hlasenie('');
  }
  function zatvorPanel() {
    if (!otvorenyPanel) return;
    otvorenyPanel = null;
    cakaKrok2 = null;
    stavEl.dataset.klud = KLUD_IZBA;
    hlasenieIzby();
    aktualizujNapovedy();
    stage.classList.remove('s-panelom');
    scena.removeAttribute('inert');
    scena.removeAttribute('aria-hidden');
    zatvarac = setTimeout(() => { if (!otvorenyPanel) { panel.hidden = true; panelTelo.innerHTML = ''; } zatvarac = null; }, redukovany() ? 10 : 320);
    const f = odkialFokus && document.contains(odkialFokus) ? odkialFokus : hotspoty[0];
    if (f && f.focus) f.focus({ preventScroll: true });
    zvuk('panel');
  }
  spatBtn.addEventListener('click', zatvorPanel);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && otvorenyPanel && !pauza) { e.preventDefault(); zatvorPanel(); }
  });
  hra.addEventListener('pointerdown', hrajuci);
  hra.addEventListener('keydown', hrajuci);

  function nastavPanel(nadpis, html) {
    panelNadpis.textContent = nadpis;
    panelTelo.innerHTML = html;
  }
  function vykresliPanel() {
    const id = otvorenyPanel;
    if (!id) return;
    panel.dataset.panel = id.replace(':', '-');
    if (id.startsWith('vec:')) return pVec(id.slice(4));
    const f = { list: pList, truhla: pTruhla, vlajky: pVlajky, dennik: pDennik, polica: pPolica, skrina: pSkrina,
      doska: pDoska, dvere: pDvere, finale: pFinale, obraz: pObraz, kabat: pKabat }[id];
    if (f) f();
  }

  // Opens a lock through the engine, so the same rules as in the tests apply.
  function otvorZamok(id) {
    const v = skus(s, id, odpovedZCasti(id, s.casti[id]));
    if (!v.ok) return v;
    s = { ...s, ...v.stav };
    uloz();
    track('game_lock', { game: 'lighthouse', lock: id, hints: s.napovedyZamok[id] || 0 });
    aktualizujScenu();
    return v;
  }
  // The pocket is redrawn only here, so a thing appears when the story hands it over
  // (Grandma's number only after her lantern has finished blinking).
  function pridanyVec(zoznam) {
    aktualizujVrecko();
    const nazvy = zoznam.filter((v) => VECI[v]).map((v) => VECI[v].nazov);
    if (nazvy.length) {
      // The new things land in the pocket with a short pop (CSS waits a moment before it).
      veciEl.querySelectorAll('.vec').forEach((b) => { if (zoznam.includes(b.dataset.vec)) b.classList.add('nova'); });
      setTimeout(() => zvuk('vec'), 450);
    }
  }

  function odseky(t) { return t.map((x) => `<p>${esc(x)}</p>`).join(''); }

  // ── Letter ──
  function pList() {
    nastavPanel("Grandpa's letter", `<div class="papier list-papier">${odseky(TEXT_LIST)}</div>`);
  }
  function pObraz() {
    nastavPanel('A photograph', `<figure class="fotka"><svg class="blizko" viewBox="0 0 300 340" role="img" aria-label="An old photograph of Grandma and Grandpa on the lighthouse gallery">
<rect width="300" height="340" rx="6" fill="#8f6f37"/><rect x="18" y="18" width="264" height="304" fill="#d9c8a6"/>
<rect x="208" y="40" width="30" height="170" fill="#efe4cf"/><path d="M204 40 h38 l-5 -18 h-28 Z" fill="#b24a36"/><rect x="200" y="210" width="46" height="10" fill="#b8a27c"/>
<path d="M28 320 Q44 214 92 210 Q140 214 150 320 Z" fill="#6f5a42"/><circle cx="90" cy="168" r="34" fill="#8a7152"/><rect x="54" y="122" width="72" height="20" rx="5" fill="#4a3a2a"/>
<path d="M140 320 Q152 222 196 218 Q240 222 256 320 Z" fill="#7d6448"/><circle cx="196" cy="180" r="31" fill="#9a7e5d"/><circle cx="196" cy="140" r="16" fill="#6a5238"/>
<path d="M18 262 H282" stroke="#b8a27c" stroke-width="3"/></svg>
<figcaption>Grandma and Grandpa on the gallery, the summer they painted the lighthouse. On the back, in pencil: "Forty summers, and still the best view."</figcaption></figure>`);
  }
  function pKabat() {
    nastavPanel("Grandpa's raincoat", `<p class="panel-uvod">A yellow raincoat and a sou'wester on the hook. In the pocket: a sweet wrapper and a pencil stub. No clue here, just Grandpa.</p>`);
  }

  // ── Items in the pocket ──
  function pVec(v) {
    if (v === 'vlajky') {
      nastavPanel('Signal flags and a rhyme', `<div class="vlajky-rad">${VLAJKY_ZACIATOK.map((f) => `<span class="vlajka-mala"><svg viewBox="0 0 40 28" aria-hidden="true">${vlajkaSvg(f)}</svg>${esc(VLAJKY[f].nazov)}</span>`).join('')}</div>${basenHtml()}`);
    } else if (v === 'cislo') {
      nastavPanel("Grandma's number", `<div class="papier"><p>Grandma's lantern blinked back: ${esc(CISLA[MAMA_BLIKNE - 1])} times, a pause, and ${esc(CISLA[MAMA_BLIKNE - 1])} again.</p><p class="velke-cislo">${MAMA_BLIKNE}</p></div>`);
    } else if (v === 'stranka') {
      nastavPanel('A page from the logbook', `<div class="papier">${odseky(TEXT_STRANKA)}</div>`);
    } else if (v === 'olej') {
      nastavPanel('Oil can', `<p class="panel-uvod">Grandpa's oil can for the lamp, full and heavy. It belongs at the top of the stairs.</p>`);
    } else if (v === 'kluc') {
      nastavPanel('Brass key', `<p class="panel-uvod">A small brass key from the pebble board. It fits a keyhole in a brass cover.</p>`);
    }
  }
  function basenHtml() {
    return `<div class="papier basen"><p><b>Flags for Grandma, counted from the window.</b></p><ol>${PRAVIDLA_VLAJOK.map((r) => `<li>${esc(r.text)}</li>`).join('')}</ol></div>`;
  }

  // ── Undo and Redo for the three grids (picture grid, pebble board, sum plate) ──
  // One stack per puzzle for this visit, as in our daily games: every mark, Clear and a hint
  // step can be undone. The stacks live in memory only; the puzzle itself is saved as usual.
  const historia = {};
  const hist = (id) => historia[id] || (historia[id] = { spat: [], vpred: [] });
  function zapamataj(id) {
    const h = hist(id);
    h.spat.push(s.casti[id].slice());
    if (h.spat.length > 500) h.spat.shift();
    h.vpred.length = 0;
  }
  function vratKrok(id, dopredu) {
    if (s.otvorene.includes(id)) return false;
    const h = hist(id);
    const z = dopredu ? h.vpred : h.spat, na = dopredu ? h.spat : h.vpred;
    if (!z.length) return false;
    na.push(s.casti[id].slice());
    s.casti[id] = z.pop();
    uloz();
    tah();
    zvuk('klik');
    return true;
  }
  const undoHtml = () => '<button type="button" class="btn btn-line" data-krok="spat" aria-keyshortcuts="U Control+Z">Undo</button><button type="button" class="btn btn-line" data-krok="vpred" aria-keyshortcuts="R Control+Y">Redo</button>';
  function aktualizujUndo(id) {
    const h = hist(id);
    const a = panelTelo.querySelector('[data-krok="spat"]'), b = panelTelo.querySelector('[data-krok="vpred"]');
    if (a) a.disabled = !h.spat.length;
    if (b) b.disabled = !h.vpred.length;
  }
  /** Wires the Undo and Redo buttons; obnov redraws the cells in place, so focus stays put. */
  function pripojUndo(id, obnov) {
    panelTelo.querySelectorAll('[data-krok]').forEach((b) => b.addEventListener('click', () => {
      if (vratKrok(id, b.dataset.krok === 'vpred')) obnov();
      if (b.disabled) { const x = panelTelo.querySelector('[data-krok]:not(:disabled)'); if (x) x.focus(); }
    }));
    aktualizujUndo(id);
  }
  /** The moment a grid's lock opens, its Undo, Redo and Clear rest: the answer stands. */
  function hotoveOvladanie() {
    panelTelo.querySelectorAll('[data-krok], #vymaz, .kl').forEach((b) => { b.disabled = true; });
  }
  /** Keys shared by the grids: U or Ctrl+Z undo; R, Ctrl+Y or Ctrl+Shift+Z redo. */
  function undoKlaves(e) {
    const k = (e.key || '').toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z') return e.shiftKey ? 'vpred' : 'spat';
    if ((e.ctrlKey || e.metaKey) && k === 'y') return 'vpred';
    if (e.ctrlKey || e.metaKey || e.altKey) return null;
    if (k === 'u') return 'spat';
    if (k === 'r') return 'vpred';
    return null;
  }

  // ── Grids (picture grid and pebble board) ──
  function mriezkaKlavesy(el, n, onAkcia) {
    el.addEventListener('keydown', (e) => {
      const b = e.target.closest('[data-i]');
      if (!b) return;
      const i = Number(b.dataset.i), r = Math.floor(i / n), c = i % n;
      let j = -1;
      if (e.key === 'ArrowUp') j = r > 0 ? i - n : -1;
      else if (e.key === 'ArrowDown') j = r < n - 1 ? i + n : -1;
      else if (e.key === 'ArrowLeft') j = c > 0 ? i - 1 : -1;
      else if (e.key === 'ArrowRight') j = c < n - 1 ? i + 1 : -1;
      if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        if (j >= 0) {
          const d = el.querySelector(`[data-i="${j}"]`);
          el.querySelectorAll('[data-i]').forEach((x) => { x.tabIndex = -1; });
          d.tabIndex = 0; d.focus();
        }
        return;
      }
      if (onAkcia(i, e.key, e)) e.preventDefault();
    });
  }

  function pTruhla() {
    if (s.otvorene.includes('truhla')) {
      nastavPanel("Grandpa's sea chest", `${truhlaOtvorenaSvg()}<p class="panel-uvod">The chest is open and empty now: you took the five signal flags and Grandpa's rhyme card.</p>`);
      return;
    }
    nastavPanel("Grandpa's sea chest", `
<p class="panel-uvod">A picture grid is set into the lid. The numbers by each row and column are the blocks of filled cells, in order, with at least one empty cell between two blocks. When the picture is right, the lid opens.</p>
<div class="nono-obal">${truhlaMriezkaHtml(s.casti.truhla)}</div>
<p class="panel-pomoc">Tap a cell: fill, cross, empty. Keyboard: arrows move, <kbd>Space</kbd> cycles, <kbd>F</kbd> fill, <kbd>X</kbd> cross, <kbd>Delete</kbd> clears, <kbd>U</kbd> undo, <kbd>R</kbd> redo.</p>
<p class="panel-akcie">${undoHtml()}<button type="button" class="btn btn-line" id="vymaz">Clear the grid</button></p>`);
    const grid = panelTelo.querySelector('.nono');
    const obnov = () => {
      grid.querySelectorAll('.nono-b').forEach((b) => {
        const i = Number(b.dataset.i), v = s.casti.truhla[i];
        b.dataset.v = v;
        b.setAttribute('aria-label', bunkaPopis(Math.floor(i / 5), i % 5, v));
      });
      aktualizujUndo('truhla');
    };
    const nastav = (i, v) => {
      if (s.casti.truhla[i] === v || s.otvorene.includes('truhla')) return;
      zapamataj('truhla');
      tah();
      s.casti.truhla[i] = v;
      obnov();
      uloz();
      zvuk(v === 1 ? 'znacka' : 'klik');
      skontrolujTruhlu();
    };
    grid.addEventListener('click', (e) => {
      const b = e.target.closest('[data-i]');
      if (!b) return;
      const i = Number(b.dataset.i);
      grid.querySelectorAll('[data-i]').forEach((x) => { x.tabIndex = -1; });
      b.tabIndex = 0;
      nastav(i, (s.casti.truhla[i] + 1) % 3);
    });
    mriezkaKlavesy(grid, 5, (i, k, e) => {
      const krok = undoKlaves(e);
      if (krok) { if (vratKrok('truhla', krok === 'vpred')) { obnov(); skontrolujTruhlu(); } return true; }
      const v = s.casti.truhla[i];
      if (k === ' ' || k === 'Enter') nastav(i, (v + 1) % 3);
      else if (k === 'f' || k === 'F') nastav(i, v === 1 ? 0 : 1);
      else if (k === 'x' || k === 'X') nastav(i, v === 2 ? 0 : 2);
      else if (k === 'Delete' || k === 'Backspace') nastav(i, 0);
      else return false;
      return true;
    });
    pripojUndo('truhla', () => { obnov(); skontrolujTruhlu(); });
    panelTelo.querySelector('#vymaz').addEventListener('click', () => {
      if (s.casti.truhla.every((v) => v === 0)) return;
      zapamataj('truhla');
      s.casti.truhla = prazdnaCast('truhla'); uloz(); obnov(); zvuk('klik');
      hlasenie('The grid is clear. Undo brings it back. The clock keeps running.', 'info');
    });
  }
  function skontrolujTruhlu() {
    const m = s.casti.truhla;
    if (spravneTruhla(m)) {
      const v = otvorZamok('truhla');
      if (!v.ok) return;
      hotoveOvladanie();
      zvuk('otvor');
      panelTelo.querySelector('.nono').classList.add('hotovo');
      hlasenie('The picture is a heart, and the lid clicks open. Inside: five signal flags and a card in Grandpa\'s hand. Both go into your pocket.', true);
      pridanyVec(v.dava);
      setTimeout(() => { if (otvorenyPanel === 'truhla') pTruhla(); }, 1400);
    } else if (m.filter((x) => x === 1).length === SRDCE.join('').split('').filter((x) => x === '1').length) {
      hlasenie('As many cells as the numbers ask for, but the lid stays shut: something does not match them yet.', 'zle');
    }
  }

  // ── Signal line ──
  let vybrataVlajka = -1;
  function pVlajky() {
    const ma = s.veci.includes('vlajky');
    const hotovo = s.otvorene.includes('vlajky');
    const poradie = s.casti.vlajky;
    if (!ma) {
      nastavPanel('The window', `${oknoPohladSvg(poradie, false)}<p class="panel-uvod">The sea at dusk. Grandma's boat is out by the point, her lantern small and steady. Grandpa's signal line runs from this window out to the gallery pole, but it is empty. Grandpa keeps his flags somewhere safe.</p>`);
      return;
    }
    if (hotovo) {
      nastavPanel('The window', `${oknoPohladSvg(poradie, true)}<p class="panel-uvod">Your flags fly on the line. Grandma's lantern answered: ${esc(CISLA[MAMA_BLIKNE - 1])} blinks, a pause, and ${esc(CISLA[MAMA_BLIKNE - 1])} again. Grandma's number is ${MAMA_BLIKNE}.</p>`);
      return;
    }
    nastavPanel('The window', `${oknoPohladSvg(poradie, false)}
<div class="vlajky-hra">
  <div>
    <p class="panel-pomoc">Place 1 is by the window. Tap a flag, then another to swap them. Keyboard: <kbd>Enter</kbd> picks a flag up, arrows carry it.</p>
    <div class="sloty" id="sloty" role="list" aria-label="The signal line, place 1 by the window to place 5 at the far end">${poradie.map((f, i) => slotHtml(f, i)).join('')}</div>
    <p class="panel-akcie"><button type="button" class="btn btn-solid" id="vztyc">Hoist the flags</button></p>
  </div>
  ${basenHtml()}
</div>`);
    const sloty = panelTelo.querySelector('#sloty');
    sloty.addEventListener('click', (e) => {
      const b = e.target.closest('.slot');
      if (b) klikSlot(Number(b.dataset.i));
    });
    sloty.addEventListener('keydown', (e) => {
      const b = e.target.closest('.slot');
      if (!b) return;
      const i = Number(b.dataset.i);
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const j = e.key === 'ArrowLeft' ? i - 1 : i + 1;
        if (j < 0 || j > 4) return;
        if (vybrataVlajka === i) { vymenVlajky(i, j); vybrataVlajka = j; oznacVybranu(); }
        sloty.querySelector(`[data-i="${j}"]`).focus();
      } else if (e.key === 'Escape' && vybrataVlajka >= 0) {
        e.stopPropagation(); vybrataVlajka = -1; oznacVybranu();
      }
    });
    panelTelo.querySelector('#vztyc').addEventListener('click', vztycVlajky);
    oznacVybranu();
  }
  function slotHtml(f, i) {
    return `<button type="button" class="slot" role="listitem" data-i="${i}" aria-label="Place ${i + 1}${i === 0 ? ', by the window' : ''}: ${VLAJKY[f].nazov} flag"><span class="slot-c">${i + 1}</span><svg viewBox="0 0 40 28" aria-hidden="true">${vlajkaSvg(f)}</svg><span class="slot-n">${VLAJKY[f].nazov}</span></button>`;
  }
  function klikSlot(i) {
    if (vybrataVlajka < 0) { vybrataVlajka = i; zvuk('klik'); }
    else if (vybrataVlajka === i) { vybrataVlajka = -1; zvuk('klik'); }
    else { vymenVlajky(vybrataVlajka, i); vybrataVlajka = -1; }
    oznacVybranu();
  }
  function oznacVybranu() {
    panelTelo.querySelectorAll('.slot').forEach((b) => {
      const i = Number(b.dataset.i);
      b.classList.toggle('vybrata', i === vybrataVlajka);
      b.setAttribute('aria-pressed', i === vybrataVlajka ? 'true' : 'false');
    });
  }
  function vymenVlajky(a, b, zHintu) {
    const sloty = panelTelo.querySelector('#sloty');
    const pred = sloty ? [...sloty.children].map((x) => x.getBoundingClientRect().left) : null;
    if (!zHintu) tah();
    const p = s.casti.vlajky.slice();
    [p[a], p[b]] = [p[b], p[a]];
    s.casti.vlajky = p;
    uloz();
    zvuk('znacka');
    if (!sloty) return;
    // Rebuild the two slots, then slide them from where they were (a small FLIP).
    const nova = [a, b].map((i) => {
      const t = document.createElement('template');
      t.innerHTML = slotHtml(p[i], i);
      const n = t.content.firstElementChild;
      sloty.replaceChild(n, sloty.children[i]);
      return [i, n];
    });
    if (!redukovany() && pred) {
      nova.forEach(([i, n]) => {
        const odkial = i === a ? pred[b] : pred[a];
        const dx = odkial - n.getBoundingClientRect().left;
        n.animate([{ transform: `translateX(${dx}px)` }, { transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.2,.7,.2,1)' });
      });
    }
    if (!zHintu && document.activeElement === document.body) sloty.children[b].focus();
  }
  function vztycVlajky() {
    const v = otvorZamok('vlajky');
    if (!v.ok) {
      zvuk('zle');
      hlasenie("The flags go up, but Grandma's lantern stays still, and down they come. The order does not fit the rhyme yet: check each line of the card against your line of flags.", 'zle');
      return;
    }
    vybrataVlajka = -1;
    zvuk('vztyk');
    // The flags leave your hands: the slots give way to one quiet line while Grandma answers.
    const sloty = panelTelo.querySelector('.vlajky-hra');
    if (sloty) sloty.outerHTML = '<p class="panel-uvod vlajky-cakanie">The flags climb the line. Watch Grandma\'s lantern out on the water.</p>';
    const svg = panelTelo.querySelector('.okno-pohlad');
    svg.outerHTML = oknoPohladSvg(s.casti.vlajky, true);
    const nove = panelTelo.querySelector('.okno-pohlad');
    nove.classList.add('vztycuje');
    hlasenie('The flags climb the line. Watch Grandma\'s lantern.', 'ok');
    const pocet = MAMA_BLIKNE;
    const krok = redukovany() ? 500 : 620;
    const start = redukovany() ? 400 : 1600;
    for (let k = 0; k < 2; k++) {
      for (let i = 0; i < pocet; i++) {
        const t = start + k * (pocet * krok + 900) + i * krok;
        setTimeout(() => {
          const l = panelTelo.querySelector('.okno-pohlad');
          if (!l) return;
          l.classList.remove('blik'); void l.getBoundingClientRect(); l.classList.add('blik');
          zvuk('blik');
        }, t);
      }
    }
    const koniec = start + 2 * (pocet * krok) + 900 + 400;
    setTimeout(() => {
      if (otvorenyPanel === 'vlajky') hlasenie("Grandma's lantern answers: " + CISLA[pocet - 1] + ' blinks, a pause, and ' + CISLA[pocet - 1] + ' again. You write it down: Grandma\'s number is ' + pocet + '.', true);
      pridanyVec(v.dava);
      if (otvorenyPanel === 'vlajky') {
        const p = panelTelo.querySelector('.vlajky-cakanie');
        if (p) p.outerHTML = `<p class="panel-uvod">Your flags fly on the line. Grandma's lantern answered: ${esc(CISLA[pocet - 1])} blinks, a pause, and ${esc(CISLA[pocet - 1])} again. Grandma's number is ${pocet}.</p>`;
      }
    }, koniec);
  }

  // ── Wheels (logbook letters, cabinet digits) ──
  function kolieskaHtml(hodnoty, znaky, popis, zakazane) {
    return `<div class="kolieska" role="group" aria-label="${esc(popis)}">${hodnoty.map((h, i) => {
      const k = znaky.indexOf(h);
      const pred = znaky[(k - 1 + znaky.length) % znaky.length], po = znaky[(k + 1) % znaky.length];
      return `<div class="koliesko" data-k="${i}">
<button type="button" class="k-sip hore" tabindex="-1" aria-label="${esc(popis)} ${i + 1} up"${zakazane ? ' disabled' : ''}><svg viewBox="0 0 20 12" aria-hidden="true"><path d="M3 10 L10 3 L17 10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
<div class="k-okno" role="spinbutton" tabindex="${zakazane ? -1 : 0}" aria-label="${esc(popis)} ${i + 1}" aria-valuetext="${esc(h)}" aria-valuenow="${k}" aria-valuemin="0" aria-valuemax="${znaky.length - 1}"${zakazane ? ' aria-disabled="true"' : ''}><div class="k-pas"><span>${esc(pred)}</span><span class="k-teraz">${esc(h)}</span><span>${esc(po)}</span></div></div>
<button type="button" class="k-sip dole" tabindex="-1" aria-label="${esc(popis)} ${i + 1} down"${zakazane ? ' disabled' : ''}><svg viewBox="0 0 20 12" aria-hidden="true"><path d="M3 2 L10 9 L17 2" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
</div>`;
    }).join('')}</div>`;
  }
  function pripojKolieska(obal, znaky, citajH, zapisH, popis, onEnter) {
    const posun = (i, o) => {
      tah();
      const h = citajH();
      const k = znaky.indexOf(h[i]);
      const n = h.slice();
      n[i] = znaky[(k + o + znaky.length) % znaky.length];
      zapisH(n);
      prekresliKoliesko(obal, i, znaky, n[i], popis, o);
      zvuk('koliesko');
    };
    const nastavNa = (i, znak) => {
      tah();
      const n = citajH().slice();
      const o = znaky.indexOf(znak) >= znaky.indexOf(n[i]) ? 1 : -1;
      n[i] = znak;
      zapisH(n);
      prekresliKoliesko(obal, i, znaky, znak, popis, o);
      zvuk('koliesko');
    };
    obal.addEventListener('click', (e) => {
      const b = e.target.closest('.k-sip');
      if (!b || b.disabled) return;
      const i = Number(b.closest('.koliesko').dataset.k);
      // Up brings the next symbol (drawn below) up into the window: A to B, 0 to 1.
      posun(i, b.classList.contains('hore') ? 1 : -1);
    });
    obal.addEventListener('keydown', (e) => {
      const o = e.target.closest('.k-okno');
      if (!o || o.getAttribute('aria-disabled') === 'true') return;
      const i = Number(o.closest('.koliesko').dataset.k);
      const vsetky = [...obal.querySelectorAll('.k-okno')];
      if (e.key === 'ArrowUp') { e.preventDefault(); posun(i, 1); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); posun(i, -1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); if (vsetky[i - 1]) vsetky[i - 1].focus(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); if (vsetky[i + 1]) vsetky[i + 1].focus(); }
      else if (e.key === 'Enter') { e.preventDefault(); onEnter(); }
      else if (e.key.length === 1 && znaky.includes(e.key.toUpperCase())) {
        e.preventDefault();
        nastavNa(i, e.key.toUpperCase());
        if (vsetky[i + 1]) vsetky[i + 1].focus();
      }
    });
  }
  function prekresliKoliesko(obal, i, znaky, h, popis, smer) {
    const k = znaky.indexOf(h);
    const w = obal.querySelector(`.koliesko[data-k="${i}"]`);
    const okno = w.querySelector('.k-okno');
    const pas = w.querySelector('.k-pas');
    pas.innerHTML = `<span>${esc(znaky[(k - 1 + znaky.length) % znaky.length])}</span><span class="k-teraz">${esc(h)}</span><span>${esc(znaky[(k + 1) % znaky.length])}</span>`;
    okno.setAttribute('aria-valuetext', h);
    okno.setAttribute('aria-valuenow', String(k));
    if (!redukovany() && smer) pas.animate([{ transform: `translateY(${smer > 0 ? 33 : -33}%)` }, { transform: 'translateY(0)' }], { duration: 170, easing: 'cubic-bezier(.2,.7,.2,1)' });
  }

  // ── Logbook ──
  function pDennik() {
    if (s.otvorene.includes('dennik')) {
      nastavPanel("Grandpa's logbook", `<div class="papier">${odseky(TEXT_STRANKA)}</div><p class="panel-uvod">You tear the page out carefully and keep it in your pocket.</p>`);
      return;
    }
    const pozna = s.veci.includes('cislo');
    nastavPanel("Grandpa's logbook", `${dennikObalSvg()}
<p class="abeceda" aria-label="The alphabet, printed inside the cover">${[...ABECEDA].map((ch) => `<span>${ch}</span>`).join('')}</p>
${pozna ? '' : `<p class="panel-uvod zamknute">Grandpa's lock word is hidden: every letter was moved forward by Grandma's number. You do not know Grandma's number yet. Grandpa's letter says she answers the signal flags.</p>`}
<div class="zamok-kolies">${kolieskaHtml(s.casti.dennik, ABECEDA, 'Letter wheel', !pozna)}
<button type="button" class="btn btn-solid" id="dennik-skus"${pozna ? '' : ' disabled'}>Open the clasp</button></div>`);
    if (!pozna) return;
    const obal = panelTelo.querySelector('.kolieska');
    pripojKolieska(obal, ABECEDA, () => s.casti.dennik, (n) => { s.casti.dennik = n; uloz(); }, 'Letter wheel', skusDennik);
    panelTelo.querySelector('#dennik-skus').addEventListener('click', skusDennik);
  }
  function skusDennik() {
    const v = otvorZamok('dennik');
    if (!v.ok) {
      zvuk('zle');
      hlasenie('The clasp does not give. The word is not ' + s.casti.dennik.join('') + '.', 'zle');
      return;
    }
    zvuk('otvor');
    hlasenie(DENNIK_SLOVO + '. The clasp springs open. Grandpa\'s last entry is about his shells and the cabinet; the page goes into your pocket.', true);
    pridanyVec(v.dava);
    const z = panelTelo.querySelector('.zamok-kolies');
    if (z) z.classList.add('hotovo');
    setTimeout(() => { if (otvorenyPanel === 'dennik') pDennik(); }, 1100);
  }

  // ── Shell shelf ──
  function pPolica() {
    nastavPanel('The shell shelf', `${policaSvg()}
<p class="legenda"><span><svg viewBox="-16 -34 32 38" aria-hidden="true">${musla('hviezdica', 0, 0, 1, 0)}</svg>starfish</span><span><svg viewBox="-16 -34 32 38" aria-hidden="true">${musla('hrebenatka', 0, 0, 1, 0)}</svg>scallop</span><span><svg viewBox="-16 -34 32 38" aria-hidden="true">${musla('ulita', 0, 0, 1, 0)}</svg>whelk</span></p>
<p class="panel-uvod">Forty summers of shells, collected on the beach below the lighthouse.</p>`);
  }

  // ── Cabinet ──
  const CIFRY = '0123456789';
  function pSkrina() {
    const pozna = s.veci.includes('stranka');
    nastavPanel('The tall cabinet', `${skrinaSvg(false)}
${pozna ? '' : `<p class="panel-uvod zamknute">Three dials with no marks on them. Grandpa must have written down somewhere what they are for.</p>`}
<div class="zamok-kolies mosadz">${kolieskaHtml(s.casti.skrina.map(String), CIFRY, 'Dial', !pozna)}
<button type="button" class="btn btn-solid" id="skrina-skus"${pozna ? '' : ' disabled'}>Pull the handle</button></div>`);
    if (!pozna) return;
    const obal = panelTelo.querySelector('.kolieska');
    pripojKolieska(obal, CIFRY, () => s.casti.skrina.map(String), (n) => { s.casti.skrina = n.map(Number); uloz(); }, 'Dial', skusSkrinu);
    panelTelo.querySelector('#skrina-skus').addEventListener('click', skusSkrinu);
  }
  function skusSkrinu() {
    const v = otvorZamok('skrina');
    if (!v.ok) {
      zvuk('zle');
      hlasenie('The handle does not move with the dials at ' + s.casti.skrina.join(' ') + '.', 'zle');
      return;
    }
    zvuk('otvor');
    const svg = panelTelo.querySelector('.skrina-blizko');
    if (svg) svg.classList.add('otv');
    const z = panelTelo.querySelector('.zamok-kolies');
    if (z) {
      // The dials are done: they stay visible, but nothing on them moves any more.
      z.classList.add('hotovo');
      z.querySelectorAll('.k-sip').forEach((b) => { b.disabled = true; });
      z.querySelectorAll('.k-okno').forEach((o) => { o.setAttribute('aria-disabled', 'true'); o.tabIndex = -1; });
      const pull = z.querySelector('#skrina-skus');
      if (pull) pull.remove();
    }
    hlasenie('The doors swing open. The oil can goes into your pocket, and on the shelf below lies a pebble board.', true);
    pridanyVec(v.dava);
    setTimeout(() => {
      if (otvorenyPanel !== 'skrina') return;
      const p = document.createElement('p');
      p.className = 'panel-akcie';
      p.innerHTML = '<button type="button" class="btn btn-solid" id="k-doske">Take out the pebble board</button>';
      if (z) z.appendChild(p); else panelTelo.appendChild(p);
      const b = p.querySelector('button');
      b.addEventListener('click', () => prepniPanel('doska'));
    }, redukovany() ? 100 : 900);
  }

  // ── Pebble board ──
  function pDoska() {
    const hotovo = s.otvorene.includes('doska');
    const m = s.casti.doska;
    const bunky = [];
    for (let r = 0; r < 5; r++) {
      bunky.push(`<div class="doska-riadok" role="row">`);
      for (let c = 0; c < 5; c++) {
        const i = r * 5 + c, o = oblast(r, c);
        const hr = [
          r === 0 || oblast(r - 1, c) !== o, c === 4 || oblast(r, c + 1) !== o,
          r === 4 || oblast(r + 1, c) !== o, c === 0 || oblast(r, c - 1) !== o,
        ].map((x) => (x ? 'var(--hrana)' : 'var(--tenka)'));
        bunky.push(`<button type="button" class="kb p${o}" role="gridcell" data-i="${i}" data-v="${m[i]}" tabindex="${i === 0 ? 0 : -1}" style="border-width:${hr.join(' ')}" aria-label="${kamenPopis(r, c, m[i])}"${hotovo ? ' disabled' : ''}></button>`);
      }
      bunky.push('</div>');
    }
    nastavPanel('The pebble board', `
<p class="panel-uvod">${hotovo ? 'The board is solved, and its little drawer stands open and empty: the brass key is in your pocket.' : 'Grandpa\'s pebble board. Put one pebble in every row, every column and every coloured patch. No two pebbles may touch, not even at a corner.'}</p>
<div class="kamene-obal"><div class="kamene${hotovo ? ' hotovo' : ''}" role="grid" aria-label="Pebble board, 5 by 5, five coloured patches">${bunky.join('')}</div></div>
<p class="legenda platne">${PLATNE.map((p, i) => `<span><i class="p${i}"></i>${esc(p.nazov)}</span>`).join('')}</p>
${hotovo ? '' : `<p class="panel-pomoc">Tap a cell: pebble, dot (your note that no pebble goes there), empty. Keyboard: arrows move, <kbd>Space</kbd> cycles, <kbd>Delete</kbd> clears, <kbd>U</kbd> undo, <kbd>R</kbd> redo.</p>
<p class="panel-akcie">${undoHtml()}<button type="button" class="btn btn-line" id="vymaz">Clear the board</button></p>`}`);
    if (hotovo) return;
    const grid = panelTelo.querySelector('.kamene');
    const obnov = () => {
      grid.querySelectorAll('.kb').forEach((b) => {
        const i = Number(b.dataset.i), v = s.casti.doska[i];
        b.dataset.v = v;
        b.setAttribute('aria-label', kamenPopis(Math.floor(i / 5), i % 5, v));
      });
      aktualizujUndo('doska');
    };
    const nastav = (i, v) => {
      if (s.casti.doska[i] === v || s.otvorene.includes('doska')) return;
      zapamataj('doska');
      tah();
      s.casti.doska[i] = v;
      obnov();
      uloz();
      zvuk(v === 1 ? 'kamen' : 'klik');
      skontrolujDosku();
    };
    grid.addEventListener('click', (e) => {
      const b = e.target.closest('[data-i]');
      if (!b) return;
      grid.querySelectorAll('[data-i]').forEach((x) => { x.tabIndex = -1; });
      b.tabIndex = 0;
      const i = Number(b.dataset.i);
      nastav(i, (s.casti.doska[i] + 1) % 3);
    });
    mriezkaKlavesy(grid, 5, (i, k, e) => {
      const krok = undoKlaves(e);
      if (krok) { if (vratKrok('doska', krok === 'vpred')) { obnov(); skontrolujDosku(); } return true; }
      const v = s.casti.doska[i];
      if (k === ' ' || k === 'Enter') nastav(i, (v + 1) % 3);
      else if (k === 'Delete' || k === 'Backspace') nastav(i, 0);
      else return false;
      return true;
    });
    pripojUndo('doska', () => { obnov(); skontrolujDosku(); });
    panelTelo.querySelector('#vymaz').addEventListener('click', () => {
      if (s.casti.doska.every((v) => v === 0)) return;
      zapamataj('doska');
      s.casti.doska = prazdnaCast('doska'); uloz(); obnov(); zvuk('klik');
      hlasenie('The board is clear. Undo brings it back. The clock keeps running.', 'info');
    });
  }
  function kamenPopis(r, c, v) {
    return 'Row ' + (r + 1) + ', column ' + (c + 1) + ', ' + PLATNE[oblast(r, c)].nazov + ' patch: ' + (v === 1 ? 'pebble' : v === 2 ? 'dot' : 'empty');
  }
  function skontrolujDosku() {
    const m = s.casti.doska;
    if (spravneDoska(m)) {
      const v = otvorZamok('doska');
      if (!v.ok) return;
      hotoveOvladanie();
      zvuk('otvor');
      panelTelo.querySelector('.kamene').classList.add('hotovo');
      hlasenie('Click. A thin drawer slides out of the side of the board. Inside: a small brass key, now in your pocket.', true);
      pridanyVec(v.dava);
      setTimeout(() => { if (otvorenyPanel === 'doska') pDoska(); }, 1400);
    } else if (m.filter((x) => x === 1).length === 5) {
      hlasenie('Five pebbles, but nothing clicks: one of the rules is broken somewhere.', 'zle');
    }
  }

  // ── Stair door and the sum plate ──
  let vybrataBunka = 0;
  function pDvere() {
    const kluc = s.veci.includes('kluc');
    if (!kluc) {
      nastavPanel('The stair door', `${dvereSvg('zamknute')}<p class="panel-uvod zamknute">The door to the lamp. The lock hides behind a brass cover with a keyhole, and you have no key for it yet.</p>`);
      return;
    }
    nastavPanel('The stair door', `${dvereSvg('kryt')}
<p class="panel-uvod">The brass key opens the cover. Behind it: Grandpa's sum plate. Every row and every column adds up to the number beside it, using the digits 1 to 9, and no digit appears twice in a row or a column.</p>
<div class="suma-obal">${platnaMriezkaHtml(s.casti.dvere, vybrataBunka)}
<div class="klavesnica" role="group" aria-label="Digits">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => `<button type="button" class="kl" data-d="${d}">${d}</button>`).join('')}<button type="button" class="kl zmaz" data-d="0" aria-label="Clear the cell">Clear</button></div></div>
<p class="panel-pomoc">Tap a cell, then a digit. Keyboard: arrows move, digits write, <kbd>Delete</kbd> clears, <kbd>U</kbd> undo, <kbd>R</kbd> redo.</p>
<p class="panel-akcie">${undoHtml()}</p>`);
    const grid = panelTelo.querySelector('.suma');
    const oznac = () => grid.querySelectorAll('.suma-b').forEach((b) => {
      const i = Number(b.dataset.i);
      b.classList.toggle('vybrata', i === vybrataBunka);
      b.tabIndex = i === vybrataBunka ? 0 : -1;
    });
    const obnov = () => {
      grid.querySelectorAll('.suma-b').forEach((b) => {
        const i = Number(b.dataset.i), d = s.casti.dvere[i];
        b.textContent = d || '';
        b.setAttribute('aria-label', sumaPopis(i, d));
      });
      aktualizujUndo('dvere');
    };
    const zapis = (d) => {
      if (s.casti.dvere[vybrataBunka] === d || s.otvorene.includes('dvere')) return;
      zapamataj('dvere');
      tah();
      s.casti.dvere[vybrataBunka] = d;
      obnov();
      uloz();
      zvuk(d ? 'znacka' : 'klik');
      skontrolujPlatnu();
    };
    grid.addEventListener('click', (e) => {
      const b = e.target.closest('.suma-b');
      if (!b) return;
      vybrataBunka = Number(b.dataset.i);
      oznac();
      zvuk('klik');
    });
    grid.addEventListener('keydown', (e) => {
      const b = e.target.closest('.suma-b');
      if (!b) return;
      const i = Number(b.dataset.i), r = Math.floor(i / 3), k = i % 3;
      let j = -1;
      if (e.key === 'ArrowUp' && r > 0) j = i - 3;
      else if (e.key === 'ArrowDown' && r < 2) j = i + 3;
      else if (e.key === 'ArrowLeft' && k > 0) j = i - 1;
      else if (e.key === 'ArrowRight' && k < 2) j = i + 1;
      if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        if (j >= 0) { vybrataBunka = j; oznac(); grid.querySelector(`[data-i="${j}"]`).focus(); }
        return;
      }
      const krok = undoKlaves(e);
      if (krok) { e.preventDefault(); if (vratKrok('dvere', krok === 'vpred')) { obnov(); skontrolujPlatnu(); } return; }
      if (/^[1-9]$/.test(e.key)) { e.preventDefault(); vybrataBunka = i; zapis(Number(e.key)); }
      else if (e.key === 'Delete' || e.key === 'Backspace' || e.key === '0') { e.preventDefault(); vybrataBunka = i; zapis(0); }
    });
    panelTelo.querySelector('.klavesnica').addEventListener('click', (e) => {
      const b = e.target.closest('.kl');
      if (!b) return;
      zapis(Number(b.dataset.d));
    });
    pripojUndo('dvere', () => { obnov(); skontrolujPlatnu(); });
    oznac();
  }
  function skontrolujPlatnu() {
    const c = s.casti.dvere;
    if (spravnePlatna(c)) {
      const v = otvorZamok('dvere');
      if (!v.ok) return;
      hotoveOvladanie();
      aktualizujVrecko();
      zvuk('otvor');
      panelTelo.querySelector('.suma').classList.add('hotovo');
      const svg = panelTelo.querySelector('.dvere-blizko');
      if (svg) { svg.classList.remove('kryt'); svg.classList.add('otvorene'); }
      hlasenie('Every row and column adds up. Something heavy turns inside the door, and it swings open onto the stairs.', true);
      setTimeout(() => {
        if (otvorenyPanel !== 'dvere') return;
        const p = document.createElement('p');
        p.className = 'panel-akcie';
        p.innerHTML = '<button type="button" class="btn btn-solid" id="hore">Climb to the lamp</button>';
        const kam = panelTelo.querySelector('.suma-obal');
        kam.replaceWith(p);
        panelTelo.querySelectorAll('.panel-pomoc, [data-krok]').forEach((x) => { const r = x.closest('.panel-akcie'); (r && r !== p ? r : x).remove(); });
        p.querySelector('button').addEventListener('click', () => prepniPanel('finale'));
      }, redukovany() ? 100 : 1100);
    } else if (c.every((x) => x > 0)) {
      hlasenie('The plate is full, but the door stays shut: some row or column does not add up, or a digit repeats.', 'zle');
    }
  }

  // ── The lamp ──
  function pFinale() {
    if (!s.otvorene.includes('dvere')) return pDvere();
    nastavPanel('The lamp room', `${lampaSvg()}
<p class="panel-uvod" id="finale-text">${s.lampa ? finaleText() : 'The lamp room at the top of the stairs. The great lens waits, and far out on the water, Grandma\'s lantern bobs up and down.'}</p>
${s.lampa ? vysledokHtml() : `<p class="panel-akcie"><button type="button" class="btn btn-solid" id="zapal"${s.veci.includes('olej') ? '' : ' disabled'}>Fill the lamp with oil and light it</button></p>`}`);
    if (s.lampa) {
      panelTelo.querySelector('.lampa-blizko').classList.add('svieti', 'doma');
      pripojVysledok();
      return;
    }
    panelTelo.querySelector('#zapal').addEventListener('click', zapalLampu);
  }
  function finaleText() {
    return 'The beam sweeps out over the sea. Grandma\'s lantern turns toward the harbour, and down on the pier a small light waves back: Grandpa. Well done, keeper.';
  }
  function vysledokHtml() {
    const n = s.napovedy;
    const vIzbe = s.napovedyZamok[KOS_IZBA] || 0;
    const cesta = !vIzbe ? '' : n === 1 ? ', to find the way' : vIzbe === n ? ', all to find the way' : ', ' + vIzbe + ' of them to find the way';
    return `<div class="vysledok" id="vysledok" tabindex="-1"><p><b>Lamp lit in ${formatCas(s.sekundy)}</b>, ${n ? 'with ' + n + (n === 1 ? ' hint' : ' hints') + cesta : 'without a single hint'}.</p>
<ul class="zamky-rad" aria-label="The six locks">${ZAMKY.map((z) => `<li class="${s.napovedyZamok[z.id] ? 's-napovedou' : 'bez'}">${esc(z.nazov)}<span class="sr"> ${s.napovedyZamok[z.id] ? 'with a hint' : 'without a hint'}</span></li>`).join('')}</ul>
<p class="vysledok-legenda" aria-hidden="true"><span class="bez">solved without a hint</span><span class="s-napovedou">a hint helped</span></p>
<p class="vysledok-akcie"><button type="button" class="btn btn-solid" data-akcia="zdielaj">Share your result</button><a class="btn btn-line" href="/games/" data-umami-event="lighthouse_result_to_games">Play today's daily puzzles</a></p>
<p class="zdielanie-stav" aria-live="polite">Share sends a short text: your time, your hints and which locks needed one. No answers, so it spoils nothing.</p>
<textarea class="zdielanie-text" rows="4" readonly hidden aria-label="The text to copy"></textarea></div>`;
  }
  function pripojVysledok() {
    const b = panelTelo.querySelector('[data-akcia="zdielaj"]');
    if (b) b.addEventListener('click', () => zdielaj(panelTelo.querySelector('.vysledok')));
  }
  function zapalLampu() {
    const v = zapal(s);
    if (!v.ok) return;
    s = { ...s, ...v.stav, koniec: Date.now() };
    bezi = false;
    uloz();
    track('game_solved', { game: 'lighthouse', seconds: s.sekundy, hints: s.napovedy });
    const svg = panelTelo.querySelector('.lampa-blizko');
    svg.classList.add('svieti');
    zvuk('finale');
    const tlacidlo = panelTelo.querySelector('#zapal');
    if (tlacidlo) tlacidlo.closest('p').remove();
    // The words change with the light, not after it: the lens is no longer waiting.
    const t = panelTelo.querySelector('#finale-text');
    if (t) t.textContent = finaleText();
    hlasenie('The lamp is lit. Time ' + formatCas(s.sekundy) + ', hints ' + s.napovedy + '.', 'ok');
    aktualizujNapovedy();
    aktualizujNastavenia();
    setTimeout(() => { svg.classList.add('doma'); }, redukovany() ? 50 : 1400);
    setTimeout(() => {
      if (otvorenyPanel === 'finale' && !panelTelo.querySelector('.vysledok')) {
        const tt = panelTelo.querySelector('#finale-text');
        if (tt) tt.insertAdjacentHTML('afterend', vysledokHtml());
        pripojVysledok();
        const karta = panelTelo.querySelector('.vysledok');
        if (karta) karta.scrollIntoView({ block: 'nearest', behavior: redukovany() ? 'auto' : 'smooth' });
      }
      aktualizujScenu();
      aktualizujVrecko();
      if (nast.oslava && !redukovany()) {
        import('../../oslava.js').then((m) => m.oslava(hra, { redukovany: false })).catch(() => { /* confetti is optional */ });
      }
    }, redukovany() ? 200 : 2600);
  }

  // ── Hints ──
  let cakaKrok2 = null;
  let zvyraznene = null;
  function zvyrazni(id) {
    if (zvyraznene) zvyraznene.classList.remove('zvyraznene');
    zvyraznene = null;
    if (!id) return;
    const g = hotspoty.find((x) => x.dataset.hs === id);
    if (g) { g.classList.add('zvyraznene'); zvyraznene = g; }
  }
  hintBtn.addEventListener('click', () => {
    if (pauza || s.lampa) return;
    hrajuci();
    const panelId = otvorenyPanel && !otvorenyPanel.startsWith('vec:') ? otvorenyPanel : null;
    const h = napoveda(s, s.casti, panelId);
    if (!h) return;
    const druhy = cakaKrok2 === h.kluc;
    // One hint counts once, on its first press; a hint that only points the way counts for the room.
    const pocty = zapocitajNapovedu(s, h, druhy);
    s.napovedy = pocty.napovedy;
    s.napovedyZamok = pocty.napovedyZamok;
    zvuk('napoveda');
    track('game_hint', { game: 'lighthouse', lock: h.kos, step: druhy ? 2 : 1 });
    if (!druhy) {
      cakaKrok2 = h.kluc;
      hlasenie(h.t1, 'hint');
    } else {
      cakaKrok2 = null;
      if (h.aplikuj && h.ciel === panelId) {
        if (['truhla', 'doska', 'dvere'].includes(h.ciel)) zapamataj(h.ciel);
        s.casti[h.ciel] = h.aplikuj(s.casti[h.ciel]);
        vykresliPanel();
        hlasenie(h.t2, 'hint');
        if (h.ciel === 'truhla') skontrolujTruhlu();
        else if (h.ciel === 'doska') skontrolujDosku();
        else if (h.ciel === 'dvere') skontrolujPlatnu();
      } else if (h.zvyrazni) {
        // Back to the room first, then say where to go: leaving a close-up clears the bar.
        if (otvorenyPanel) zatvorPanel();
        zvyrazni(h.zvyrazni);
        hlasenie(h.t2, 'hint');
      } else {
        hlasenie(h.t2, 'hint');
      }
    }
    uloz();
    aktualizujNapovedy();
  });

  // ── Pause ──
  function nastavPauzu(p) {
    pauza = p;
    pauzaBlok.hidden = !p;
    stage.classList.toggle('pauza', p);
    aktualizujNapovedy();
    if (p) { bezi = false; pauzaCas.textContent = 'Time ' + formatCas(s.sekundy) + '.'; pokracujBtn.focus(); }
    else { hrajuci(); (otvorenyPanel ? panelNadpis : hotspoty[0]).focus({ preventScroll: true }); }
  }
  pauzaBtn.addEventListener('click', () => nastavPauzu(!pauza));
  pokracujBtn.addEventListener('click', () => nastavPauzu(false));

  // ── Settings ──
  hra.querySelectorAll('[data-nastavenie]').forEach((i) => i.addEventListener('change', () => {
    nast[i.dataset.nastavenie] = i.checked;
    pis(KLUC_NAST, nast);
    aktualizujNastavenia();
    if (i.dataset.nastavenie === 'zvuk' && i.checked) zvuk('vec');
    track('game_setting', { game: 'lighthouse', setting: i.dataset.nastavenie, on: i.checked });
  }));
  znovaBtn.addEventListener('click', () => {
    let ok = true;
    try { ok = window.confirm('Start again? This clears your progress, time and hints in this browser.'); } catch (e) { ok = true; }
    if (!ok) return;
    zmaz(KLUC);
    s = cistyStav();
    bezi = false;
    if (otvorenyPanel) zatvorPanel();
    cakaKrok2 = null;
    for (const k of Object.keys(historia)) delete historia[k];
    zvyrazni(null);
    aktualizujVsetko();
    hlasenie("A fresh start. Grandpa's letter is on the table.", 'info');
  });

  // ── Share: no spoilers, only the time, the hints and which locks needed one ──
  function textNaZdielanie() {
    const n = s.napovedy;
    return "Grandpa's Lighthouse, a small escape room\n"
      + 'Lamp lit in ' + formatCas(s.sekundy) + (n ? ' with ' + n + (n === 1 ? ' hint' : ' hints') : ' without a hint') + '\n'
      + 'Locks ' + ZAMKY.map((z) => (s.napovedyZamok[z.id] ? '○' : '●')).join('') + ' (● solved without a hint)\n'
      + 'https://arling.sk/games/escape/lighthouse/';
  }
  const dotykove = () => { try { return window.matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } };
  /** On a phone or tablet the system share sheet; elsewhere, or if it fails, the clipboard;
   *  if the browser refuses that too, the text in a box to copy by hand. */
  async function zdielaj(karta) {
    if (!s.lampa || !karta) return;
    const text = textNaZdielanie();
    const stavZ = karta.querySelector('.zdielanie-stav');
    const box = karta.querySelector('.zdielanie-text');
    if (dotykove() && navigator.share) {
      try {
        await navigator.share({ text });
        stavZ.textContent = 'Shared. It gives away no answer.';
        track('game_share', { game: 'lighthouse', how: 'share' });
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return;
      }
    }
    const ok = await skopiruj(text);
    stavZ.textContent = ok
      ? 'Copied. Paste it wherever you like: it gives away no answer, and nothing was sent anywhere.'
      : 'This browser would not let the page copy for you. Here is the text, take it from the box.';
    box.value = text;
    box.hidden = ok;
    if (!ok) { box.focus(); box.select(); }
    track('game_share', { game: 'lighthouse', how: ok ? 'copy' : 'box' });
  }
  async function skopiruj(text) {
    try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); return true; } } catch (e) { /* below */ }
    try {
      const t = document.createElement('textarea');
      t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.top = '-1000px';
      document.body.appendChild(t); t.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(t);
      return ok;
    } catch (e) { return false; }
  }
  function aktualizujVsetko() {
    aktualizujScenu();
    aktualizujVrecko();
    aktualizujNapovedy();
    aktualizujNastavenia();
    casEl.textContent = formatCas(s.sekundy);
  }
  aktualizujVsetko();
  // On load the bar only speaks when there is something to say, and it does not pull the page down to itself.
  const tichoNaZaciatku = (text, typ) => { typHlasenia = typ; stavEl.textContent = text; stavEl.classList.toggle('ok', typ === 'ok'); };
  if (s.lampa) tichoNaZaciatku('You lit the lamp in ' + formatCas(s.sekundy) + ' with ' + s.napovedy + (s.napovedy === 1 ? ' hint' : ' hints') + '. Your result and Share are behind the stair door; Settings has Start again.', 'ok');
  else if (s.otvorene.length) tichoNaZaciatku('Welcome back. ' + s.otvorene.length + ' of ' + ZAMKY.length + ' locks are open; your pocket is as you left it.', 'info');
  tik = setInterval(tikaj, 1000);
  hra.classList.add('pripravena');
  window.addEventListener('pagehide', uloz);
  // For the automated walk-through only: the state, read-only.
  hra.escapeStav = () => JSON.parse(JSON.stringify(s));
  void tik;
}

if (JE_PREHLIADAC && document.getElementById('escape')) spustiHru();
