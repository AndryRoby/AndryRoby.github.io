/* Testy pre nastavenie stránky /games/two-stars/: 9 × 9, dve hviezdy.
 * Spustenie: node tests-two-stars.mjs (popri node tests.mjs pre generátor). */
import { generate, solve } from './generator.mjs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok    ' + name); }
  catch (e) { failed++; console.log('  FAIL  ' + name + ': ' + e.message); }
}
function assert(c, m) { if (!c) throw new Error(m || 'assert'); }
function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' ' + JSON.stringify(a) + ' != ' + JSON.stringify(b)); }

function countsOk(p) {
  const n = p.n, k = p.stars;
  const row = new Array(n).fill(0), col = new Array(n).fill(0), reg = new Array(n).fill(0);
  const stars = [];
  for (let i = 0; i < n * n; i++) {
    if (p.solution[i] !== 1) continue;
    stars.push(i);
    row[Math.floor(i / n)]++;
    col[i % n]++;
    reg[p.regions[Math.floor(i / n)][i % n]]++;
  }
  for (let a = 0; a < stars.length; a++) {
    for (let b = a + 1; b < stars.length; b++) {
      const ra = Math.floor(stars[a] / n), ca = stars[a] % n, rb = Math.floor(stars[b] / n), cb = stars[b] % n;
      if (Math.abs(ra - rb) <= 1 && Math.abs(ca - cb) <= 1) return 'touch';
    }
  }
  if (stars.length !== n * k) return 'count ' + stars.length;
  if (row.some((x) => x !== k) || col.some((x) => x !== k) || reg.some((x) => x !== k)) return 'line counts';
  return 'ok';
}

test('9 x 9 with two stars: 18 stars, 2 per row, column and region, no touching, unique solution', () => {
  for (const d of ['2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14']) {
    const p = generate(d, { n: 9, stars: 2 });
    eq(p.n, 9); eq(p.stars, 2);
    eq(countsOk(p), 'ok', d);
    const s = solve(p.regions, 2, { limit: 2 });
    eq(s.solutions.length, 1, 'uniqueness ' + d);
    eq(s.solutions[0].join(''), p.solution.join(''), 'solver equals intended ' + d);
  }
});
test('9 x 9 with two stars is deterministic and different days differ', () => {
  const a = generate('2026-09-10', { n: 9, stars: 2 });
  const b = generate('2026-09-10', { n: 9, stars: 2 });
  eq(JSON.stringify(a.regions), JSON.stringify(b.regions));
  const c = generate('2026-09-11', { n: 9, stars: 2 });
  assert(JSON.stringify(a.regions) !== JSON.stringify(c.regions), 'another day, another puzzle');
});
test('9 x 9 with two stars is generated in under 2 seconds', () => {
  const t0 = Date.now();
  generate('2026-10-01', { n: 9, stars: 2 });
  assert(Date.now() - t0 < 2000, 'took ' + (Date.now() - t0) + ' ms');
});
test('30 consecutive days all produce a valid unique puzzle (no fallback)', () => {
  let fallback = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(Date.UTC(2026, 8, 10 + i)).toISOString().slice(0, 10);
    const p = generate(d, { n: 9, stars: 2 });
    if (p.fallback) fallback++;
    eq(countsOk(p), 'ok', d);
  }
  eq(fallback, 0, 'fallback days');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exitCode = 1;
