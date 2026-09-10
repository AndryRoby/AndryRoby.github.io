/* Testy generátora Hviezd. Bez rámca: node tests.mjs
 * Vypíše „N passed, M failed" a skončí s kódom 1, ak čokoľvek zlyhá. */
import {
  mulberry32, seedFromString, isValidDate, todayBratislava,
  randomSolution, makeRegions, mergeRegions, regionStats, regionsConnected,
  repair, solve, deduce, checkSolution, generate,
} from './generator.mjs';

let passed = 0, failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('ok   ' + name);
  } catch (e) {
    failed++;
    console.log('FAIL ' + name + '\n     ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join('\n     ') : e));
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assert'); }
function eq(a, b, msg) {
  const ja = JSON.stringify(a), jb = JSON.stringify(b);
  if (ja !== jb) throw new Error((msg || 'eq') + ': ' + ja + ' !== ' + jb);
}
const fromPicture = (rows) => rows.map((row) => row.split('').map((ch) => ch.charCodeAt(0) - 65));
const gridFromPicture = (rows) => rows.join('').split('').map((ch) => (ch === '*' ? 1 : 0));

/* Ručne overené zadanie 6 × 6 (postup úvahy: oblasť C leží celá v stĺpci 1,
   preto stĺpec 1 mimo C vypadne a E má jediné políčko (5,0); hviezda tam
   vylúči riadok 5, takže F má len (4,2); D ostáva len (3,5); B potom len
   (0,4); zvyšné dva riadky majú po jednom voľnom políčku.) */
const KNOWN = fromPicture([
  'AAAABB',
  'ACAAAB',
  'ACAABB',
  'ACAABD',
  'ACFAAD',
  'EEFFDD',
]);
const KNOWN_SOLUTION = gridFromPicture([
  '....*.',
  '.*....',
  '...*..',
  '.....*',
  '..*...',
  '*.....',
]);

/* Každý stĺpec je oblasť: 4 × 4 má presne dve riešenia bez dotyku,
   (1,3,0,2) a (2,0,3,1). */
const TWO_SOLUTIONS = fromPicture(['ABCD', 'ABCD', 'ABCD', 'ABCD']);

// ── PRNG ────────────────────────────────────────────────────────────────
test('mulberry32 dá pre rovnaké semienko rovnakú postupnosť', () => {
  const a = mulberry32(42), b = mulberry32(42);
  for (let i = 0; i < 100; i++) assert(a() === b(), 'rozdiel na kroku ' + i);
});
test('mulberry32 dá pre rôzne semienka rôzne postupnosti a čísla v [0, 1)', () => {
  const a = mulberry32(1), b = mulberry32(2);
  let same = 0;
  for (let i = 0; i < 100; i++) {
    const x = a(), y = b();
    assert(x >= 0 && x < 1 && y >= 0 && y < 1, 'mimo intervalu');
    if (x === y) same++;
  }
  assert(same < 5, 'príliš veľa zhôd: ' + same);
});
test('seedFromString je deterministický a citlivý na znak', () => {
  assert(seedFromString('2026-09-10') === seedFromString('2026-09-10'));
  assert(seedFromString('2026-09-10') !== seedFromString('2026-09-11'));
  assert(Number.isInteger(seedFromString('x')) && seedFromString('x') >= 0);
});

// ── Dátum ───────────────────────────────────────────────────────────────
test('isValidDate prijme len skutočné dátumy v tvare YYYY-MM-DD', () => {
  assert(isValidDate('2026-09-10'));
  assert(isValidDate('2024-02-29'));
  assert(!isValidDate('2026-02-30'));
  assert(!isValidDate('2025-02-29'));
  assert(!isValidDate('2026-13-01'));
  assert(!isValidDate('26-09-10'));
  assert(!isValidDate('2026/09/10'));
  assert(!isValidDate(''));
});
test('todayBratislava vracia YYYY-MM-DD a rešpektuje pásmo (23:30 UTC je už ďalší deň)', () => {
  const s = todayBratislava();
  assert(isValidDate(s), 'tvar: ' + s);
  eq(todayBratislava(new Date(Date.UTC(2026, 6, 15, 23, 30))), '2026-07-16');
  eq(todayBratislava(new Date(Date.UTC(2026, 0, 15, 23, 30))), '2026-01-16');
  eq(todayBratislava(new Date(Date.UTC(2026, 0, 15, 12, 0))), '2026-01-15');
});

// ── Oblasti ─────────────────────────────────────────────────────────────
test('makeRegions(8) dá 8 súvislých oblastí a pridelí každú bunku', () => {
  const regions = makeRegions(8);
  eq(regions.length, 8);
  eq(regionStats(regions).count, 8);
  assert(regionsConnected(regions), 'nesúvislé');
});
test('makeRegions je deterministický pre rovnaký rng a rôzny pre iný', () => {
  eq(makeRegions(8, mulberry32(7)), makeRegions(8, mulberry32(7)));
  assert(JSON.stringify(makeRegions(8, mulberry32(7))) !== JSON.stringify(makeRegions(8, mulberry32(8))));
});
test('makeRegions so semenami: každé semeno je v inej oblasti', () => {
  const seeds = [{ r: 0, c: 0 }, { r: 1, c: 2 }, { r: 2, c: 4 }, { r: 3, c: 1 }, { r: 4, c: 3 }];
  const regions = makeRegions(5, mulberry32(3), seeds);
  const ids = new Set(seeds.map((s) => regions[s.r][s.c]));
  eq(ids.size, 5);
  assert(regionsConnected(regions));
});
test('makeRegions funguje pre 5 × 5 aj 10 × 10 a čísluje oblasti 0 .. n-1', () => {
  for (const n of [5, 10]) {
    const regions = makeRegions(n, mulberry32(n));
    const ids = new Set(regions.flat());
    eq(ids.size, n);
    for (let g = 0; g < n; g++) assert(ids.has(g), 'chýba oblasť ' + g);
    assert(regionsConnected(regions));
  }
});
test('regionsConnected odhalí rozpadnutú oblasť', () => {
  assert(!regionsConnected(fromPicture(['ABA', 'BBB', 'CCC'])), 'A je rozdelené');
  assert(regionsConnected(fromPicture(['AAB', 'CBB', 'CCB'])));
});
test('mergeRegions zlepí 2n oblastí do n súvislých, každá s dvoma semenami', () => {
  const rng = mulberry32(11);
  const rows = randomSolution(10, 2, rng);
  const seeds = [];
  for (let r = 0; r < 10; r++) for (const c of rows[r]) seeds.push({ r, c });
  let merged = null;
  for (let i = 0; i < 20 && !merged; i++) merged = mergeRegions(makeRegions(10, rng, seeds), 2, rng);
  assert(merged, 'zlepenie sa nepodarilo ani na 20 pokusov');
  eq(regionStats(merged).count, 10);
  assert(regionsConnected(merged));
  const perRegion = new Map();
  for (const s of seeds) perRegion.set(merged[s.r][s.c], (perRegion.get(merged[s.r][s.c]) || 0) + 1);
  for (const [g, k] of perRegion) eq(k, 2, 'oblasť ' + g);
});

// ── Rozloženie hviezd ───────────────────────────────────────────────────
test('randomSolution dá platné rozloženie pre 8 × 8 s jednou aj 10 × 10 s dvoma hviezdami', () => {
  for (const [n, stars] of [[8, 1], [10, 2]]) {
    const rows = randomSolution(n, stars, mulberry32(5));
    const grid = new Array(n * n).fill(0);
    for (let r = 0; r < n; r++) for (const c of rows[r]) grid[r * n + c] = 1;
    const errs = checkSolution(makeRegions(n, mulberry32(1)), stars, grid).filter((e) => e.kind !== 'region');
    eq(errs, [], n + 'x' + n);
  }
});

// ── Riešiteľ ────────────────────────────────────────────────────────────
test('solve nájde jediné riešenie ručne overeného zadania 6 × 6', () => {
  const res = solve(KNOWN, 1, { limit: 2 });
  eq(res.solutions.length, 1);
  eq(res.solutions[0], KNOWN_SOLUTION);
  assert(res.complete, 'mal prehľadať celý strom');
});
test('solve odmietne zadanie s dvoma riešeniami (vráti obe a nie je hotový)', () => {
  const res = solve(TWO_SOLUTIONS, 1, { limit: 2 });
  eq(res.solutions.length, 2);
  assert(!res.complete);
  const all = solve(TWO_SOLUTIONS, 1, { limit: 100 });
  eq(all.solutions.length, 2);
  assert(all.complete);
});
test('solve dodrží zákaz dotyku: 2 × 2 so stĺpcovými oblasťami nemá riešenie', () => {
  const res = solve(fromPicture(['AB', 'AB']), 1);
  eq(res.solutions.length, 0);
  assert(res.complete);
});
test('solve vracia len riešenia, ktoré prejdú checkSolution (aj pre 2 hviezdy)', () => {
  const rng = mulberry32(21);
  for (const [n, stars] of [[8, 1], [7, 1], [10, 2]]) {
    let regions = makeRegions(n, rng);
    if (stars === 2) {
      const rows = randomSolution(n, 2, rng);
      const seeds = [];
      for (let r = 0; r < n; r++) for (const c of rows[r]) seeds.push({ r, c });
      regions = null;
      for (let i = 0; i < 20 && !regions; i++) regions = mergeRegions(makeRegions(n, rng, seeds), 2, rng);
    }
    const res = solve(regions, stars, { limit: 5 });
    assert(res.solutions.length >= 1, n + 'x' + n + ' bez riešenia');
    for (const s of res.solutions) eq(checkSolution(regions, stars, s), [], n + 'x' + n);
  }
});
test('solve odmietne mriežku s nesprávnym počtom oblastí', () => {
  const res = solve(fromPicture(['AAB', 'AAB', 'AAB']), 1);
  eq(res.solutions.length, 0);
});

// ── Kontrola riešenia ───────────────────────────────────────────────────
test('checkSolution: správne riešenie bez chýb, posunutá hviezda hlási riadok, stĺpec, oblasť a dotyk', () => {
  eq(checkSolution(KNOWN, 1, KNOWN_SOLUTION), []);
  const bad = KNOWN_SOLUTION.slice();
  bad[1 * 6 + 1] = 0; bad[1 * 6 + 3] = 1; // hviezda z (1,1) na (1,3): dotýka sa (0,4) aj (2,3)
  const kinds = new Set(checkSolution(KNOWN, 1, bad).map((e) => e.kind));
  assert(kinds.has('col') && kinds.has('touch') && kinds.has('region'), [...kinds].join(','));
  assert(!kinds.has('row'), 'riadok 1 má stále jednu hviezdu');
});
test('checkSolution hlási dotyk rohom', () => {
  const grid = new Array(16).fill(0);
  grid[0] = 1; grid[5] = 1;
  const errs = checkSolution(fromPicture(['ABCD', 'ABCD', 'ABCD', 'ABCD']), 1, grid);
  assert(errs.some((e) => e.kind === 'touch' && e.cells[0] === 0 && e.cells[1] === 5));
});

// ── Oprava a úvaha ──────────────────────────────────────────────────────
test('repair spraví z viacznačného zadania jednoznačné a zachová zámer', () => {
  const rng = mulberry32(2026);
  let ok = false;
  for (let i = 0; i < 10 && !ok; i++) {
    const rows = randomSolution(8, 1, rng);
    const seeds = [];
    const intended = new Array(64).fill(0);
    for (let r = 0; r < 8; r++) for (const c of rows[r]) { seeds.push({ r, c }); intended[r * 8 + c] = 1; }
    const regions = makeRegions(8, rng, seeds);
    const before = solve(regions, 1, { limit: 2 }).solutions.length;
    const rep = repair(regions, intended, 1, rng);
    if (!rep.ok) continue;
    ok = true;
    const after = solve(regions, 1, { limit: 2 });
    eq(after.solutions.length, 1);
    eq(after.solutions[0], intended);
    assert(regionsConnected(regions));
    assert(regionStats(regions).min >= 2);
    assert(before >= 1, 'pred opravou muselo existovať aspoň riešenie zámeru');
  }
  assert(ok, 'oprava sa nepodarila ani raz z 10');
});
test('deduce vyrieši ručne overené zadanie úvahou a dôjde k rovnakému riešeniu', () => {
  const d = deduce(KNOWN);
  assert(d.supported && d.solved, 'nevyriešené');
  eq(d.grid, KNOWN_SOLUTION);
  assert(d.level >= 2 && d.steps > 0);
});
test('deduce pri viacznačnom zadaní skončí bez riešenia a pre 2 hviezdy hlási nepodporované', () => {
  const d = deduce(TWO_SOLUTIONS);
  assert(!d.solved);
  const d2 = deduce(fromPicture(['AB', 'AB']), 2);
  assert(!d2.supported && !d2.solved);
});

// ── generate ────────────────────────────────────────────────────────────
test('generate je deterministický: rovnaký dátum dá rovnaké zadanie', () => {
  const a = generate('2026-09-10'), b = generate('2026-09-10');
  eq(a.regions, b.regions);
  eq(a.solution, b.solution);
  eq(a.seed, b.seed);
  eq(a.attempts, b.attempts);
});
test('generate vráti očakávaný tvar a obtiažnosť nad hranicou', () => {
  const p = generate('2026-09-10');
  eq([p.n, p.stars, p.date], [8, 1, '2026-09-10']);
  eq(p.regions.length, 8);
  eq(p.solution.length, 64);
  assert(Number.isInteger(p.seed) && Number.isInteger(p.attempts) && p.attempts >= 1);
  assert(p.difficulty.level >= 2, 'level ' + p.difficulty.level);
  assert(p.difficulty.placements >= 24, 'placements ' + p.difficulty.placements);
  assert(!p.fallback, 'nemal padnúť na záložné zadanie');
});
test('generate pre 5 po sebe idúcich dní: rôzne zadania, každé s jediným riešením', () => {
  const dates = ['2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14'];
  const seen = new Set();
  for (const d of dates) {
    const p = generate(d);
    const key = JSON.stringify(p.regions);
    assert(!seen.has(key), 'zadanie sa opakuje: ' + d);
    seen.add(key);
    assert(regionsConnected(p.regions), d + ' nesúvislé');
    eq(regionStats(p.regions).count, 8, d);
    assert(regionStats(p.regions).min >= 2, d + ' oblasť s jednou bunkou');
    const res = solve(p.regions, 1, { limit: 2 });
    eq(res.solutions.length, 1, d);
    eq(res.solutions[0], p.solution, d);
    eq(checkSolution(p.regions, 1, p.solution), [], d);
    const ded = deduce(p.regions);
    assert(ded.solved, d + ' sa nedá vyriešiť úvahou');
    eq(ded.grid, p.solution, d);
  }
});
test('generate 8 × 8 trvá pod 2 sekundy (5 dní za sebou, každý zvlášť)', () => {
  const dates = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05'];
  for (const d of dates) {
    const t = performance.now();
    generate(d);
    const ms = performance.now() - t;
    assert(ms < 2000, d + ' trvalo ' + ms.toFixed(0) + ' ms');
  }
});
test('generate odmietne zlý dátum', () => {
  let threw = false;
  try { generate('10.9.2026'); } catch (e) { threw = true; }
  assert(threw);
});
test('generate rešpektuje možnosti n a stars (6 × 6 s jednou hviezdou)', () => {
  const p = generate('2026-01-02', { n: 6 });
  eq(p.n, 6);
  eq(p.regions, KNOWN, 'zadanie pre 2026-01-02 pri 6 × 6 je to ručne overené');
  eq(p.solution, KNOWN_SOLUTION);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exitCode = 1;
