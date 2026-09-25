/* Tests for Grandpa's Lighthouse (escape.js). Run: node escape.test.mjs
 *
 * What they prove:
 *   1. every lock has exactly one answer, found by trying every possibility
 *      (all 33,554,432 fillings of the picture grid, all 120 flag orders, all
 *      11,881,376 five-letter words, all 1,000 dial settings, all 53,130 ways to
 *      put five pebbles on the board, every digit grid the sum plate allows);
 *   2. the whole way through works, from the letter to the lit lamp;
 *   3. no lock can be skipped: a lock refuses even its right answer without the
 *      things only the previous lock gives, and among every state the game can
 *      reach, the lamp is lit only where all six locks are open;
 *   4. the hints alone solve every lock, and every hint step is forced logic,
 *      not a guess; a wrong mark is pointed out first; one hint counts once,
 *      and a hint that only points the way never marks a lock;
 *   5. the page has every element the script needs, no inline script, no dashes;
 *      every clue of both grids reaches a screen reader; every thing in the room
 *      is at least 24 CSS px at a 320 px screen; the privacy note names every
 *      statistics event the page sends. */
import { readFileSync } from 'node:fs';
import {
  SRDCE, TRUHLA_RIADKY, TRUHLA_STLPCE, bloky, spravneTruhla,
  VLAJKY, VLAJKY_ZACIATOK, PRAVIDLA_VLAJOK, spravneVlajky, MAMA_BLIKNE,
  SIFRA, ABECEDA, sifruj, desifruj, DENNIK_SLOVO, spravneDennik,
  MUSLE, POLICA, PORADIE_MUSLI, pocetMusli, KOD_SKRINE, spravneSkrina,
  DOSKA, PLATNE, spravneDoska,
  PLATNA_RIADKY, PLATNA_STLPCE, PLATNA_RIESENIE, spravnePlatna,
  ZAMKY, FINALE, zamok, novyStav, mozeSkusit, skus, mozeZapalit, zapal, dalsiCiel,
  prazdnaCast, odpovedZCasti, KROKY, napovedaHlavolamu, napoveda, NAV,
  KOS_IZBA, zapocitajNapovedu, truhlaMriezkaHtml, platnaMriezkaHtml, scenaSvg,
} from './escape.js';

let passed = 0, failed = 0;
function test(name, fn) {
  const t0 = Date.now();
  try { fn(); passed++; console.log('  ok    ' + name + ' (' + (Date.now() - t0) + ' ms)'); }
  catch (e) { failed++; console.log('  FAIL  ' + name + ': ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e)); }
}
function assert(c, m) { if (!c) throw new Error(m || 'assert'); }
function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' ' + JSON.stringify(a) + ' != ' + JSON.stringify(b)); }

/* The right answer of each lock, written out here independently of the game's data. */
const ODPOVEDE = {
  truhla: [...'0101011111111110111000100'].map((x) => (x === '1' ? 1 : 0)),
  vlajky: ['W', 'Y', 'B', 'R', 'G'],
  dennik: 'SHELL',
  skrina: [4, 6, 3],
  doska: (() => { const m = new Array(25).fill(0); [[0, 1], [1, 3], [2, 0], [3, 2], [4, 4]].forEach(([r, c]) => { m[r * 5 + c] = 1; }); return m; })(),
  dvere: [8, 6, 9, 9, 8, 7, 1, 2, 4],
};

// ── 1. Exactly one answer per lock ─────────────────────────────────────────
test('sea chest: of all 2^25 fillings exactly one fits the clues, and it is the heart', () => {
  // Independent check with bit masks: a row or column is a 5 bit number.
  const blokyMasky = (m) => bloky([4, 3, 2, 1, 0].map((b) => (m >> b) & 1)).join(',');
  const riadokOk = TRUHLA_RIADKY.map((cl) => Array.from({ length: 32 }, (_, m) => blokyMasky(m) === cl.join(',')));
  const stlpecOk = TRUHLA_STLPCE.map((cl) => Array.from({ length: 32 }, (_, m) => blokyMasky(m) === cl.join(',')));
  const najdene = [];
  for (let g = 0; g < 1 << 25; g++) {
    if (!riadokOk[0][g & 31] || !riadokOk[1][(g >> 5) & 31] || !riadokOk[2][(g >> 10) & 31] || !riadokOk[3][(g >> 15) & 31] || !riadokOk[4][(g >> 20) & 31]) continue;
    let ok = true;
    for (let c = 0; c < 5 && ok; c++) {
      let m = 0;
      for (let r = 0; r < 5; r++) m = (m << 1) | ((g >> (r * 5 + (4 - c))) & 1);
      ok = stlpecOk[c][m];
    }
    if (ok) najdene.push(g);
  }
  eq(najdene.length, 1, 'fillings that fit');
  const g = najdene[0];
  const mriezka = Array.from({ length: 25 }, (_, i) => (g >> (Math.floor(i / 5) * 5 + (4 - (i % 5)))) & 1);
  eq(mriezka, ODPOVEDE.truhla, 'the one filling');
  eq(mriezka.join(''), SRDCE.join(''), 'game data');
});
test('sea chest: the game check agrees with the independent one', () => {
  assert(spravneTruhla(ODPOVEDE.truhla), 'solution accepted');
  assert(spravneTruhla(ODPOVEDE.truhla.map((v) => (v ? 1 : 2))), 'crosses on the empty cells change nothing');
  for (let i = 0; i < 25; i++) {
    const m = ODPOVEDE.truhla.slice();
    m[i] = m[i] ? 0 : 1;
    assert(!spravneTruhla(m), 'one cell off at ' + i + ' must be refused');
  }
  let x = 12345;
  const rnd = () => { x = (x * 1103515245 + 12345) & 0x7fffffff; return x; };
  for (let k = 0; k < 200000; k++) {
    const m = Array.from({ length: 25 }, () => rnd() % 3);
    const plna = m.map((v) => (v === 1 ? 1 : 0));
    assert(spravneTruhla(m) === (plna.join('') === ODPOVEDE.truhla.join('')), 'random grid ' + k);
  }
  assert(!spravneTruhla([1, 2, 3]) && !spravneTruhla(null), 'nonsense refused');
});
test('signal line: of all 120 orders exactly one fits the rhyme', () => {
  const vsetky = [];
  (function rec(p, zvysok) {
    if (!zvysok.length) { vsetky.push(p); return; }
    zvysok.forEach((f, i) => rec([...p, f], zvysok.filter((_, j) => j !== i)));
  })([], Object.keys(VLAJKY));
  eq(vsetky.length, 120);
  const dobre = vsetky.filter(spravneVlajky);
  eq(dobre, [ODPOVEDE.vlajky]);
  assert(!spravneVlajky(VLAJKY_ZACIATOK), 'the starting order is not the answer');
  assert(!spravneVlajky(['W', 'Y', 'B', 'R', 'R']) && !spravneVlajky(['W', 'Y', 'B', 'R']) && !spravneVlajky(['W', 'Y', 'B', 'R', 'toString']), 'broken orders refused');
  // Every line of the rhyme is needed: drop one and more than one order fits.
  PRAVIDLA_VLAJOK.forEach((_, k) => {
    const n = vsetky.filter((p) => PRAVIDLA_VLAJOK.every((r, j) => j === k || r.plati(p))).length;
    assert(n > 1, 'rule ' + (k + 1) + ' is redundant');
  });
});
test('logbook: of all 26^5 words exactly one opens the clasp, and it is the cipher read back', () => {
  eq(DENNIK_SLOVO, ODPOVEDE.dennik);
  eq(desifruj(SIFRA, MAMA_BLIKNE), ODPOVEDE.dennik);
  eq(sifruj(ODPOVEDE.dennik, MAMA_BLIKNE), SIFRA);
  assert(MAMA_BLIKNE >= 1 && MAMA_BLIKNE <= 25, 'the shift is a real shift');
  let pocet = 0, najdene = '';
  const w = [0, 0, 0, 0, 0];
  for (let n = 0; n < 26 ** 5; n++) {
    let k = n;
    for (let i = 4; i >= 0; i--) { w[i] = k % 26; k = (k - w[i]) / 26; }
    const slovo = ABECEDA[w[0]] + ABECEDA[w[1]] + ABECEDA[w[2]] + ABECEDA[w[3]] + ABECEDA[w[4]];
    if (spravneDennik(slovo)) { pocet++; najdene = slovo; }
  }
  eq(pocet, 1, 'words that open');
  eq(najdene, 'SHELL');
  // No other shift gives a word the player could mistake for it: every other reading differs.
  for (let o = 1; o < 26; o++) if (o !== MAMA_BLIKNE) assert(desifruj(SIFRA, o) !== 'SHELL', 'shift ' + o);
});
test('cabinet: of all 1,000 dial settings exactly one opens it, and it is the shell count', () => {
  const dobre = [];
  for (let a = 0; a < 10; a++) for (let b = 0; b < 10; b++) for (let c = 0; c < 10; c++) if (spravneSkrina([a, b, c])) dobre.push([a, b, c]);
  eq(dobre, [ODPOVEDE.skrina]);
  // Count the shelf by hand, independent of pocetMusli.
  const rucne = { hviezdica: 0, hrebenatka: 0, ulita: 0 };
  for (const rad of POLICA) for (const d of rad) rucne[d]++;
  eq(PORADIE_MUSLI.map((d) => rucne[d]), ODPOVEDE.skrina, 'shelf count');
  eq(KOD_SKRINE, ODPOVEDE.skrina);
  eq(PORADIE_MUSLI.map(pocetMusli), ODPOVEDE.skrina);
  for (const d of Object.keys(MUSLE)) assert(pocetMusli(d) >= 1 && pocetMusli(d) <= 9, d + ' count fits one dial');
  assert(new Set(PORADIE_MUSLI).size === 3 && PORADIE_MUSLI.every((d) => MUSLE[d]), 'order names every kind once');
});
test('pebble board: of all 53,130 ways to place five pebbles exactly one keeps every rule', () => {
  const dobre = [];
  let vsetky = 0;
  for (let a = 0; a < 25; a++) for (let b = a + 1; b < 25; b++) for (let c = b + 1; c < 25; c++) for (let d = c + 1; d < 25; d++) for (let e = d + 1; e < 25; e++) {
    vsetky++;
    const m = new Array(25).fill(0);
    m[a] = m[b] = m[c] = m[d] = m[e] = 1;
    if (spravneDoska(m)) dobre.push(m.join(''));
  }
  eq(vsetky, 53130);
  eq(dobre, [ODPOVEDE.doska.join('')]);
  assert(spravneDoska(ODPOVEDE.doska.map((v) => (v ? 1 : 2))), 'dots elsewhere change nothing');
  assert(!spravneDoska(new Array(25).fill(1)), 'a full board is refused');
});
test('pebble board: five patches, each in one piece, named and coloured', () => {
  eq(DOSKA.length, 5);
  assert(DOSKA.every((r) => /^[0-4]{5}$/.test(r)), 'shape');
  eq(PLATNE.length, 5);
  assert(new Set(PLATNE.map((p) => p.nazov)).size === 5 && new Set(PLATNE.map((p) => p.farba)).size === 5, 'names and colours differ');
  for (let o = 0; o < 5; o++) {
    const bunky = [];
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) if (Number(DOSKA[r][c]) === o) bunky.push([r, c]);
    assert(bunky.length >= 3, 'patch ' + o + ' too small');
    const videne = new Set([bunky[0].join()]);
    const fronta = [bunky[0]];
    while (fronta.length) {
      const [r, c] = fronta.shift();
      for (const [a, b] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
        if (a >= 0 && b >= 0 && a < 5 && b < 5 && Number(DOSKA[a][b]) === o && !videne.has(a + ',' + b)) { videne.add(a + ',' + b); fronta.push([a, b]); }
      }
    }
    eq(videne.size, bunky.length, 'patch ' + o + ' is in one piece');
  }
});
test('sum plate: of every digit grid exactly one fits the sums without a repeated digit', () => {
  // A grid that breaks a row sum or repeats a digit in a row is refused anyway (checked
  // below on random grids), so trying every row that fits covers every grid.
  const trojice = (s) => {
    const t = [];
    for (let a = 1; a <= 9; a++) for (let b = 1; b <= 9; b++) for (let c = 1; c <= 9; c++) if (a !== b && b !== c && a !== c && a + b + c === s) t.push([a, b, c]);
    return t;
  };
  const T = PLATNA_RIADKY.map(trojice);
  const dobre = [];
  let skusane = 0;
  for (const x of T[0]) for (const y of T[1]) for (const z of T[2]) {
    skusane++;
    const g = [...x, ...y, ...z];
    if (spravnePlatna(g)) dobre.push(g.join(''));
  }
  eq(dobre, [ODPOVEDE.dvere.join('')]);
  eq(PLATNA_RIESENIE, ODPOVEDE.dvere);
  let x = 99;
  const rnd = () => { x = (x * 1103515245 + 12345) & 0x7fffffff; return x; };
  for (let k = 0; k < 300000; k++) {
    const g = Array.from({ length: 9 }, () => 1 + (rnd() % 9));
    if (spravnePlatna(g)) eq(g, ODPOVEDE.dvere, 'random grid accepted');
  }
  assert(!spravnePlatna([8, 6, 9, 9, 8, 7, 1, 2, 0]) && !spravnePlatna(null), 'empty cell refused');
  assert(skusane > 0);
});

// ── 2. The whole way through ───────────────────────────────────────────────
function prechod() {
  let s = novyStav();
  const kroky = [];
  for (const z of ZAMKY) {
    eq(dalsiCiel(s), z.id, 'next goal');
    assert(mozeSkusit(s, z.id), z.id + ' should be ready');
    const v = skus(s, z.id, ODPOVEDE[z.id]);
    assert(v.ok, z.id + ' did not open: ' + v.dovod);
    s = v.stav;
    kroky.push(z.id);
  }
  eq(dalsiCiel(s), 'finale');
  assert(mozeZapalit(s), 'the lamp should be ready');
  const l = zapal(s);
  assert(l.ok, 'the lamp did not light');
  s = l.stav;
  eq(dalsiCiel(s), null);
  return { s, kroky };
}
test('the whole way through: six locks in order, then the lamp', () => {
  const { s, kroky } = prechod();
  eq(kroky, ['truhla', 'vlajky', 'dennik', 'skrina', 'doska', 'dvere']);
  assert(s.lampa, 'lamp lit');
  eq(s.otvorene.length, 6);
  for (const v of ['vlajky', 'cislo', 'stranka', 'olej', 'doska', 'kluc', 'schody']) assert(s.veci.includes(v), 'missing ' + v);
  assert(!zapal(s).ok, 'a lit lamp is not lit twice');
});
test('the same way through with the answers the player builds in the page', () => {
  let s = novyStav();
  const casti = Object.fromEntries(ZAMKY.map((z) => [z.id, prazdnaCast(z.id)]));
  casti.truhla = ODPOVEDE.truhla.map((v) => (v ? 1 : 2));
  casti.vlajky = ODPOVEDE.vlajky.slice();
  casti.dennik = [...ODPOVEDE.dennik];
  casti.skrina = ODPOVEDE.skrina.slice();
  casti.doska = ODPOVEDE.doska.slice();
  casti.dvere = ODPOVEDE.dvere.slice();
  for (const z of ZAMKY) {
    const v = skus(s, z.id, odpovedZCasti(z.id, casti[z.id]));
    assert(v.ok, z.id + ': ' + v.dovod);
    s = v.stav;
  }
  assert(zapal(s).ok);
});

// ── 3. No lock can be skipped ──────────────────────────────────────────────
test('from the start only the sea chest opens, even with every right answer', () => {
  const s = novyStav();
  for (const z of ZAMKY) {
    const v = skus(s, z.id, ODPOVEDE[z.id]);
    if (z.id === 'truhla') assert(v.ok, 'chest');
    else { assert(!v.ok && v.dovod === 'chyba-vec', z.id + ' opened from the start'); assert(!mozeSkusit(s, z.id)); }
  }
  assert(!mozeZapalit(s) && !zapal(s).ok, 'lamp from the start');
});
test('each lock refuses its right answer while any thing it needs is missing', () => {
  let s = novyStav();
  for (const z of ZAMKY) {
    for (const v of z.potrebuje) {
      const bez = { ...s, veci: s.veci.filter((x) => x !== v) };
      const r = skus(bez, z.id, ODPOVEDE[z.id]);
      assert(!r.ok && r.dovod === 'chyba-vec', z.id + ' opened without ' + v);
    }
    s = skus(s, z.id, ODPOVEDE[z.id]).stav;
  }
  for (const v of FINALE.potrebuje) assert(!zapal({ ...s, veci: s.veci.filter((x) => x !== v) }).ok, 'lamp without ' + v);
});
test('every state the game can reach: the lamp is lit only with all six locks open', () => {
  // Try every action in every reachable state: each lock with its right answer, and the lamp.
  const kluc = (s) => [...s.otvorene].sort().join(',') + '|' + [...s.veci].sort().join(',') + '|' + s.lampa;
  const videne = new Map();
  const fronta = [novyStav()];
  videne.set(kluc(fronta[0]), fronta[0]);
  while (fronta.length) {
    const s = fronta.shift();
    const dalsie = ZAMKY.map((z) => skus(s, z.id, ODPOVEDE[z.id])).filter((v) => v.ok).map((v) => v.stav);
    const l = zapal(s);
    if (l.ok) dalsie.push(l.stav);
    for (const n of dalsie) if (!videne.has(kluc(n))) { videne.set(kluc(n), n); fronta.push(n); }
  }
  const stavy = [...videne.values()];
  eq(stavy.length, 8, 'reachable states: start, six locks one by one, lit lamp');
  for (const s of stavy) if (s.lampa) eq([...s.otvorene].sort(), ZAMKY.map((z) => z.id).sort(), 'lit lamp with a lock closed');
  // And the order is forced: in every reachable state the open locks are a prefix of the chain.
  for (const s of stavy) eq(s.otvorene, ZAMKY.slice(0, s.otvorene.length).map((z) => z.id), 'order');
});
test('the chain: every thing a lock needs is given by exactly one earlier lock', () => {
  const kto = {};
  ZAMKY.forEach((z, i) => z.dava.forEach((v) => { assert(!(v in kto), v + ' given twice'); kto[v] = i; }));
  ZAMKY.forEach((z, i) => z.potrebuje.forEach((v) => { assert(v in kto, z.id + ' needs ' + v + ' that nothing gives'); assert(kto[v] < i, z.id + ' needs ' + v + ' from a later lock'); }));
  FINALE.potrebuje.forEach((v) => assert(v in kto, 'lamp needs ' + v));
  // Walking the needs back from the lamp reaches every lock.
  const treba = new Set();
  const zasobnik = [...FINALE.potrebuje];
  while (zasobnik.length) {
    const v = zasobnik.pop();
    const z = ZAMKY[kto[v]];
    if (treba.has(z.id)) continue;
    treba.add(z.id);
    zasobnik.push(...z.potrebuje);
  }
  eq([...treba].sort(), ZAMKY.map((z) => z.id).sort(), 'the lamp depends on every lock');
  assert(ZAMKY.length >= 5 && ZAMKY.length <= 7, 'five to seven locks');
});
test('wrong answers and repeated tries never open anything', () => {
  let s = novyStav();
  for (const z of ZAMKY) {
    const zle = skus(s, z.id, odpovedZCasti(z.id, prazdnaCast(z.id)));
    assert(!zle.ok && zle.dovod === 'zle', z.id + ' opened with the empty state');
    s = skus(s, z.id, ODPOVEDE[z.id]).stav;
    const znova = skus(s, z.id, ODPOVEDE[z.id]);
    assert(!znova.ok && znova.dovod === 'otvorene', z.id + ' opened twice');
    eq(s.veci.filter((v) => z.dava.includes(v)).length, z.dava.length, z.id + ' items once');
  }
  assert(!skus(s, 'nic', 1).ok && zamok('nic') === null, 'unknown lock');
});

// ── 4. Hints ───────────────────────────────────────────────────────────────
const bezPomlciek = (t) => !/[–—]/.test(t);
test('hints alone solve every lock, one forced step at a time', () => {
  for (const z of ZAMKY) {
    let c = prazdnaCast(z.id);
    const kluce = new Set();
    for (let k = 0; k < 40 && !z.over(odpovedZCasti(z.id, c)); k++) {
      const h = napovedaHlavolamu(z.id, c);
      assert(h && h.t1 && h.t2 && h.aplikuj, z.id + ': no hint at step ' + k);
      assert(bezPomlciek(h.t1) && bezPomlciek(h.t2), z.id + ': dash in a hint');
      assert(!kluce.has(h.kluc), z.id + ': the same hint twice, ' + h.kluc);
      kluce.add(h.kluc);
      c = h.aplikuj(c);
    }
    assert(z.over(odpovedZCasti(z.id, c)), z.id + ' not solved by hints');
    // Swapping flags can put a later flag in place by the way; every other lock needs every step.
    if (z.id === 'vlajky') assert(kluce.size <= KROKY.vlajky.length, 'flags');
    else eq(kluce.size, KROKY[z.id].length, z.id + ' uses every scripted step');
    const po = napovedaHlavolamu(z.id, c);
    assert(po && !po.aplikuj, z.id + ': a solved lock gets no more steps');
  }
});
test('a wrong mark is pointed out first, and the second step clears it', () => {
  const pripady = {
    truhla: (() => { const m = prazdnaCast('truhla'); m[0] = 1; return m; })(),
    doska: (() => { const m = prazdnaCast('doska'); m[0] = 1; return m; })(),
    dvere: (() => { const m = prazdnaCast('dvere'); m[4] = 5; return m; })(),
  };
  for (const [id, m] of Object.entries(pripady)) {
    const h = napovedaHlavolamu(id, m);
    assert(h.kluc.includes('chyba'), id + ' did not see the mistake');
    const po = h.aplikuj(m);
    assert(po.every((v) => v === 0), id + ' did not clear it');
  }
  // A cross on a cell of the picture is a mistake too.
  const m = prazdnaCast('truhla'); m[1] = 2;
  assert(napovedaHlavolamu('truhla', m).kluc.includes('chyba'), 'cross on a filled cell');
});
test('picture grid hints: each step is forced by line logic from what is known', () => {
  // A line solver: all placements of the blocks that agree with the known cells.
  const umiestnenia = (clue, n) => {
    const out = [];
    (function rec(i, poz, riadok) {
      if (i === clue.length) { out.push(riadok.concat(new Array(n - riadok.length).fill(0))); return; }
      const zvysok = clue.slice(i + 1).reduce((a, b) => a + b + 1, 0);
      for (let p = poz; p + clue[i] + zvysok <= n; p++) {
        const r = riadok.concat(new Array(p - riadok.length).fill(0), new Array(clue[i]).fill(1));
        rec(i + 1, p + clue[i] + 1, i + 1 < clue.length ? r.concat([0]) : r);
      }
    })(0, 0, []);
    return out.map((r) => r.slice(0, n));
  };
  const vyries = (znam) => {
    let zmena = true;
    while (zmena) {
      zmena = false;
      for (const [cl, bunky] of [...TRUHLA_RIADKY.map((cl, r) => [cl, [0, 1, 2, 3, 4].map((c) => r * 5 + c)]), ...TRUHLA_STLPCE.map((cl, c) => [cl, [0, 1, 2, 3, 4].map((r) => r * 5 + c)])]) {
        const moze = umiestnenia(cl, 5).filter((u) => u.every((v, j) => znam[bunky[j]] === null || znam[bunky[j]] === v));
        assert(moze.length, 'contradiction');
        for (let j = 0; j < 5; j++) {
          if (znam[bunky[j]] !== null) continue;
          if (moze.every((u) => u[j] === moze[0][j])) { znam[bunky[j]] = moze[0][j]; zmena = true; }
        }
      }
    }
    return znam;
  };
  // Before step k, the player knows only the lines of the earlier steps.
  let znam = new Array(25).fill(null);
  for (const k of KROKY.truhla) {
    const odvodene = vyries(znam.slice());
    for (let c = 0; c < 5; c++) {
      const i = k.riadok * 5 + c;
      assert(odvodene[i] !== null, 'row ' + (k.riadok + 1) + ' cell ' + (c + 1) + ' is not forced yet');
      eq(odvodene[i], ODPOVEDE.truhla[i]);
    }
    for (let c = 0; c < 5; c++) znam[k.riadok * 5 + c] = ODPOVEDE.truhla[k.riadok * 5 + c];
  }
});
test('pebble board hints: each pebble is the only free cell of the group the hint names', () => {
  const oblast = (r, c) => Number(DOSKA[r][c]);
  const skupiny = [
    // step 1: the red patch, once column 1 belongs to the blue patch
    (r, c) => oblast(r, c) === 0 && !(c === 0 && oblast(r, c) !== 2),
    (r, c) => oblast(r, c) === 3,   // step 2: the green patch
    (r, c) => c === 3,              // step 3: column 4
    (r, c) => r === 2,              // step 4: row 3
    (r, c) => oblast(r, c) === 4,   // step 5: the grey patch
  ];
  eq(PLATNE[0].nazov, 'red'); eq(PLATNE[2].nazov, 'blue'); eq(PLATNE[3].nazov, 'green'); eq(PLATNE[4].nazov, 'grey');
  for (let c = 0; c < 5; c++) for (let r = 0; r < 5; r++) if (oblast(r, c) === 2) eq(c, 0, 'blue patch lies in column 1');
  const polozene = [];
  KROKY.doska.forEach((k, i) => {
    const volne = [];
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
      if (!skupiny[i](r, c)) continue;
      const bije = polozene.some(([a, b]) => a === r || b === c || oblast(a, b) === oblast(r, c) || (Math.abs(a - r) <= 1 && Math.abs(b - c) <= 1));
      if (!bije) volne.push([r, c]);
    }
    eq(volne, [k.bunka], 'step ' + (i + 1));
    polozene.push(k.bunka);
  });
});
test('sum plate hints: each digit is forced by its rows and columns, no guessing', () => {
  // Line logic only: a cell keeps the digits that appear in some way to fill its row, and
  // some way to fill its column, with different digits and the right sum. Repeat until
  // nothing changes. A hint step is honest when this leaves its cell a single digit,
  // knowing only the digits of the earlier steps.
  const linie = [[0, 1, 2, 0], [3, 4, 5, 1], [6, 7, 8, 2]].map(([a, b, c, r]) => [[a, b, c], PLATNA_RIADKY[r]])
    .concat([[0, 3, 6, 0], [1, 4, 7, 1], [2, 5, 8, 2]].map(([a, b, c, s]) => [[a, b, c], PLATNA_STLPCE[s]]));
  const vyries = (znam) => {
    const kand = znam.map((v) => (v ? new Set([v]) : new Set([1, 2, 3, 4, 5, 6, 7, 8, 9])));
    let zmena = true;
    while (zmena) {
      zmena = false;
      for (const [bunky, sucet] of linie) {
        const moze = bunky.map(() => new Set());
        for (const a of kand[bunky[0]]) for (const b of kand[bunky[1]]) for (const c of kand[bunky[2]]) {
          if (a === b || b === c || a === c || a + b + c !== sucet) continue;
          moze[0].add(a); moze[1].add(b); moze[2].add(c);
        }
        bunky.forEach((i, j) => { if (moze[j].size < kand[i].size) { kand[i] = moze[j]; zmena = true; } });
      }
    }
    return kand;
  };
  const znam = new Array(9).fill(0);
  for (const k of KROKY.dvere) {
    const kand = vyries(znam);
    eq([...kand[k.i]], [k.c], 'cell ' + k.i);
    znam[k.i] = k.c;
  }
});
test('navigation hints exist for every goal and point at a thing in the room', () => {
  for (const id of [...ZAMKY.map((z) => z.id), 'finale']) {
    assert(NAV[id] && NAV[id].t1 && NAV[id].t2 && NAV[id].hs, id);
    assert(bezPomlciek(NAV[id].t1 + NAV[id].t2), id + ' dash');
  }
  const s = novyStav();
  const casti = Object.fromEntries(ZAMKY.map((z) => [z.id, prazdnaCast(z.id)]));
  eq(napoveda(s, casti, null).kluc, 'nav:truhla');
  eq(napoveda(s, casti, 'dennik').kluc, 'nav:truhla', 'another close-up still points at the goal');
  eq(napoveda(s, casti, 'truhla').kluc, 'truhla:0', 'inside the goal the hint is about the puzzle');
  eq(napoveda(prechod().s, casti, null), null, 'nothing left after the lamp');
});
test('hint counting: one hint counts once, and a hint that points the way never marks a lock', () => {
  const s = novyStav();
  const casti = Object.fromEntries(ZAMKY.map((z) => [z.id, prazdnaCast(z.id)]));
  let pocty = { napovedy: 0, napovedyZamok: {} };
  // In the room: a navigation hint, both presses.
  const nav = napoveda(s, casti, null);
  eq(nav.kos, KOS_IZBA, 'a navigation hint belongs to the room');
  pocty = zapocitajNapovedu(pocty, nav, false);
  pocty = zapocitajNapovedu(pocty, nav, true);
  eq(pocty.napovedy, 1, 'two presses of one hint count once');
  assert(!pocty.napovedyZamok.truhla, 'finding the chest does not mark the chest');
  eq(pocty.napovedyZamok[KOS_IZBA], 1);
  // Inside the chest: a puzzle hint, both presses, then a second hint with only its first press.
  const h1 = napoveda(s, casti, 'truhla');
  eq(h1.kos, 'truhla');
  pocty = zapocitajNapovedu(pocty, h1, false);
  pocty = zapocitajNapovedu(pocty, h1, true);
  const h2 = napoveda(s, { ...casti, truhla: h1.aplikuj(casti.truhla) }, 'truhla');
  assert(h2.kluc !== h1.kluc, 'the next hint is a new one');
  pocty = zapocitajNapovedu(pocty, h2, false);
  eq(pocty.napovedy, 3, 'three hints in all');
  eq(pocty.napovedyZamok.truhla, 2, 'two of them helped with the chest');
  // The lamp room hint belongs to the room too, and no ZAMKY id is ever the room.
  const koniec = { otvorene: ZAMKY.map((z) => z.id), veci: ['schody', 'olej'], lampa: false };
  eq(napoveda(koniec, casti, 'finale').kos, KOS_IZBA);
  assert(!ZAMKY.some((z) => z.id === KOS_IZBA), 'the room is not a lock');
  // Every navigation goal: its hint is counted for the room, never for a lock.
  let st = novyStav();
  for (const z of ZAMKY) {
    const h = napoveda(st, casti, null);
    eq(h.kos, KOS_IZBA, 'nav hint for ' + z.id);
    st = skus(st, z.id, ODPOVEDE[z.id]).stav;
  }
});

// ── 5. The page ────────────────────────────────────────────────────────────
test('the page has every element the script looks up, and no inline script', () => {
  const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  const js = readFileSync(new URL('./escape.js', import.meta.url), 'utf8');
  const idy = [...js.matchAll(/\$\('([a-z-]+)'\)/g)].map((m) => m[1]);
  assert(idy.length > 15, 'ids found');
  for (const id of idy) assert(html.includes('id="' + id + '"'), 'missing #' + id);
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/type="application\/ld\+json"/.test(m[1])) { JSON.parse(m[2]); continue; } // data, never run
    assert(/\bsrc=/.test(m[1]), 'inline script: ' + m[0].slice(0, 80));
    eq(m[2].trim(), '', 'script with a body');
  }
  assert(/<meta http-equiv="Content-Security-Policy"[^>]*script-src 'self'/.test(html), 'CSP');
  assert(!/script-src[^;"]*unsafe-inline/.test(html), 'no unsafe-inline scripts');
  assert(html.includes('<link rel="canonical" href="https://arling.sk/games/escape/lighthouse/">'), 'canonical');
  assert(html.includes('src="/games/escape/lighthouse/escape.js'), 'script');
  assert(html.includes('href="/games/escape/lighthouse/escape.css'), 'styles');
  assert(/<h2[^>]*id="panel-nadpis"[^>]*tabindex="-1"/.test(html), 'panel heading is an h2 under the h1, and focusable');
  assert(!/<h3\b/.test(html.slice(0, html.indexOf('id="rules"'))), 'no h3 before any h2');
  // The hint button and the message line live together in the bar under the stage.
  const lista = html.slice(html.indexOf('id="lista"'), html.indexOf('class="vrecko"'));
  assert(lista.includes('id="hint"') && lista.includes('id="stav"') && lista.includes('aria-live="polite"'), 'hint and message in the bar');
  const manifest = JSON.parse(readFileSync(new URL('./manifest.json', import.meta.url), 'utf8'));
  eq(manifest.start_url, '/games/escape/lighthouse/', 'manifest start');
});
test('the privacy note names every statistics event the page sends', () => {
  const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  const js = readFileSync(new URL('./escape.js', import.meta.url), 'utf8');
  const odsek = (html.match(/<p[^>]*id="statistiky"[^>]*>([\s\S]*?)<\/p>/) || [])[1] || '';
  assert(odsek, 'the privacy paragraph');
  // What each game event is called in plain words on the page.
  const SLOVAMI = {
    game_start: 'someone started', game_lock: 'opened a lock', game_hint: 'asked for a hint',
    game_setting: 'changed a setting', game_share: 'shared the result', game_solved: 'lit the lamp',
  };
  const udalosti = new Set([...js.matchAll(/track\('([a-z_]+)'/g)].map((m) => m[1]));
  assert(udalosti.size >= 5, 'events found');
  for (const u of udalosti) {
    assert(SLOVAMI[u], 'event ' + u + ' is sent but has no words in this test: add it here and to the page');
    assert(odsek.includes(SLOVAMI[u]), 'the page does not mention ' + u + ' ("' + SLOVAMI[u] + '")');
  }
  // Link clicks are counted by data-umami-event, in the page and in what the script draws.
  const odkazy = [...html.matchAll(/data-umami-event="([a-z_]+)"/g), ...js.matchAll(/data-umami-event="([a-z_]+)"/g)];
  assert(odkazy.length > 0, 'link events found');
  assert(odsek.includes('which of our links'), 'the page does not mention the link clicks');
  assert(!/Nothing else\./.test(odsek), 'no blanket claim');
});
test('every clue of both grids reaches a screen reader, not only the eye', () => {
  const text = (h) => h.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const prvok = (html, id) => {
    const m = html.match(new RegExp('<div[^>]*id="' + id + '"[^>]*>([\\s\\S]*?)</div>'));
    assert(m, 'missing #' + id);
    return { tag: m[0].slice(0, m[0].indexOf('>') + 1), text: text(m[1]) };
  };
  const nono = truhlaMriezkaHtml(prazdnaCast('truhla'));
  TRUHLA_STLPCE.forEach((b, c) => {
    const p = prvok(nono, 'nono-c' + c);
    assert(/role="columnheader"/.test(p.tag) && !/aria-hidden/.test(p.tag), 'column ' + (c + 1) + ' is a header a reader can reach');
    eq(p.text, 'Column ' + (c + 1) + ' clue ' + b.join(' '), 'column ' + (c + 1));
  });
  TRUHLA_RIADKY.forEach((b, r) => {
    const p = prvok(nono, 'nono-r' + r);
    assert(/role="rowheader"/.test(p.tag), 'row header');
    eq(p.text, 'Row ' + (r + 1) + ' clue ' + b.join(' '), 'row ' + (r + 1));
  });
  // Column headers sit in a row of the grid, and every cell points at both of its clues.
  assert(/role="row"><div class="nono-roh"[^>]*><\/div><div class="nono-h stlpec" role="columnheader"/.test(nono), 'column headers inside a row');
  for (let i = 0; i < 25; i++) {
    const r = Math.floor(i / 5), c = i % 5;
    assert(new RegExp('data-i="' + i + '"[^>]*aria-describedby="nono-r' + r + ' nono-c' + c + '"').test(nono), 'cell ' + i + ' describedby');
  }
  const suma = platnaMriezkaHtml(prazdnaCast('dvere'), 0);
  PLATNA_STLPCE.forEach((x, k) => eq(prvok(suma, 'suma-c' + k).text, 'Column ' + (k + 1) + ' adds up to ' + x));
  PLATNA_RIADKY.forEach((x, r) => eq(prvok(suma, 'suma-r' + r).text, 'Row ' + (r + 1) + ' adds up to ' + x));
  for (let i = 0; i < 9; i++) assert(new RegExp('data-i="' + i + '"[^>]*aria-describedby="suma-r' + Math.floor(i / 3) + ' suma-c' + (i % 3) + '"').test(suma), 'sum cell ' + i);
});
test('every thing in the room is at least 24 CSS px at a 320 px screen, and none overlap', () => {
  const svg = scenaSvg();
  const hity = [...svg.matchAll(/<g class="hs" data-hs="([a-z]+)"[\s\S]*?<rect class="hit" x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)]
    .map((m) => ({ id: m[1], x: +m[2], y: +m[3], w: +m[4], h: +m[5] }));
  eq(hity.map((h) => h.id).sort(), ['dennik', 'dvere', 'kabat', 'list', 'obraz', 'okno', 'polica', 'skrina', 'truhla']);
  // At 320 px the stage is the screen minus 16 px on each side; the room is 800 units wide.
  const k = (320 - 32) / 800;
  for (const h of hity) {
    assert(h.w * k >= 24 && h.h * k >= 24, h.id + ' is ' + (h.w * k).toFixed(1) + ' x ' + (h.h * k).toFixed(1) + ' px at 320');
    assert(h.x >= 0 && h.y >= 0 && h.x + h.w <= 800 && h.y + h.h <= 600, h.id + ' inside the room');
  }
  for (let i = 0; i < hity.length; i++) for (let j = i + 1; j < hity.length; j++) {
    const a = hity[i], b = hity[j];
    const prekryv = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    assert(!prekryv, a.id + ' and ' + b.id + ' overlap');
  }
});
test('the rhyme card: two couplets, one rule per line, and the words the hints quote are on it', () => {
  eq(PRAVIDLA_VLAJOK.length, 4);
  // Spelling cannot tell a rhyme (Blue, you), so the rhyming pairs are pinned here: whoever
  // rewrites a line has to keep its couplet rhyming and update this list on purpose.
  const koniec = (t) => t.replace(/[^a-z ]/gi, '').trim().split(' ').pop().toLowerCase();
  eq(PRAVIDLA_VLAJOK.map((r) => koniec(r.text)), ['end', 'friend', 'blue', 'you'], 'line endings');
  assert(KROKY.vlajky[0].t1.includes('never the window end'), 'hint quotes line 1');
});
test('no em dash or en dash in the page, the script or the styles', () => {
  for (const f of ['index.html', 'escape.js', 'escape.css']) {
    const t = readFileSync(new URL('./' + f, import.meta.url), 'utf8');
    assert(bezPomlciek(t), f + ' has a dash');
  }
  const texty = [...PRAVIDLA_VLAJOK.map((r) => r.text), ...ZAMKY.map((z) => z.nazov)];
  for (const k of Object.values(KROKY)) for (const x of k) texty.push(x.t1, x.t2);
  assert(texty.every(bezPomlciek), 'dash in a text');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
