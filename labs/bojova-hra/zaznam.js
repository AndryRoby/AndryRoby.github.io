// Tumble Dojo: Record, Kit a ukladanie bez DOM. Odomknutie je čistá funkcia záznamu, nič za peniaze, nič na server.
export const KLUC = 'tumble-dojo-v3', KLUC2 = 'tumble-dojo-v2', NK = 12;
export const SLOTY = [['k', 'Kimono'], ['p', 'Print'], ['b', 'Belt'], ['h', 'Headband']];
export const MAJ = ['Hedgehog', 'Hare', 'Otter', 'Badger', 'Magpie', 'Crane'];
const nk = (r) => { let n = 0; for (let i = 0; i < NK; i++) if (r.k[i] > 0) n++; return n; };
// [id, meno, atrament, podmienka, (rec, lad) => [mám, treba]]; bez funkcie = od začiatku
export const VECI = [
  ['k0', 'Orange', 'orange'], ['k1', 'Blue', 'blue'],
  ['k2', 'Pink', 'pink', 'Win your first match', (r) => [r.w, 1]],
  ['k3', 'Green', 'green', 'Land 25 combos', (r) => [r.c, 25]],
  ['k4', 'Teal', 'teal', 'Win 10 matches', (r) => [r.w, 10]],
  ['k5', 'Plum', 'plum', 'Win 3 matches 3 : 0', (r) => [r.cl, 3]],
  ['k6', 'White', 'paper', 'Beat the Crane', (r, l) => [l.b >= 6 ? 1 : 0, 1]],
  ['p0', 'Plain', ''], ['p1', 'Stripes', 's'],
  ['p2', 'Dots', 'd', 'Score 10 COMBO FINISH points', (r) => [r.f, 10]],
  ['p3', 'Checks', 'c', 'Win 3 matches in a row', (r) => [r.bs, 3]],
  ['p4', 'Waves', 'w', 'Land all 12 moves at least once', (r) => [nk(r), 12]],
  ['p5', 'Pines', 'v', 'Win 5 matches in a row', (r) => [r.bs, 5]],
  ['b0', 'White', 'paper'],
  // b1 až b6: pás za každého porazeného majstra
  ...['Yellow sun', 'Orange orange', 'Green green', 'Blue blue', 'Purple plum', 'Black night'].map((x, i) => ['b' + (i + 1), ...x.split(' '), 'Beat the ' + MAJ[i], (r, l) => [l.b > i ? 1 : 0, 1]]),
  ['h0', 'Teal', 'teal'],
  ['h1', 'Sun', 'sun', 'Score your first COMBO FINISH', (r) => [r.f, 1]],
  ['h2', 'Pink', 'pink', 'Make a Chain x3', (r) => [r.ch, 3]],
  ['h3', 'Orange', 'orange', 'Score a point with GROUND STOMP', (r) => [r.st, 1]],
  ['h4', 'Long ties', 'teal', 'Play 30 matches', (r) => [r.m, 30]]
];
export const VEC = Object.fromEntries(VECI.map((v) => [v[0], v]));
// presná príčina odmeny na konci zápasu
const PRECO = { k2: 'You won your first match.', k3: 'You landed 25 combos.', k4: 'You won 10 matches.', k5: 'You won 3 matches 3 : 0.', k6: 'You beat the Crane.',
  p2: 'You scored 10 COMBO FINISH points.', p3: 'You won 3 matches in a row.', p4: 'You landed all 12 moves.', p5: 'You won 5 matches in a row.',
  h1: 'You scored your first COMBO FINISH.', h2: 'You made a Chain x3.', h3: 'You scored with GROUND STOMP.', h4: 'You played 30 matches.' };
export const preco = (id) => PRECO[id] || (id[0] === 'b' ? 'You beat the ' + MAJ[+id[1] - 1] + '.' : '');
export const nazov = (id) => { const v = VEC[id]; return (v[1] + ' ' + SLOTY.find((s) => s[0] === id[0])[1]).toUpperCase(); };

export function novyRec() { return { m: 0, w: 0, s: 0, bs: 0, c: 0, f: 0, cl: 0, ch: 0, st: 0, pv: 0, k: new Array(NK).fill(0) }; }
export function novyLad() { return { b: 0, l: [0, 0, 0, 0, 0, 0], g: [0, 0, 0, 0, 0, 0] }; }
export const KIT0 = { k: 'k0', p: 'p0', b: 'b0', h: 'h0' };

export function postup(id, rec, lad) { const v = VEC[id]; if (!v || !v[4]) return [1, 1]; const x = v[4](rec, lad); return [Math.min(x[0], x[1]), x[1]]; }
export function odomknute(rec, lad) {
  const o = {};
  for (const v of VECI) o[v[0]] = !v[4] || postup(v[0], rec, lad)[0] >= postup(v[0], rec, lad)[1];
  return o;
}

// ukladanie: každé čítanie a zápis v try/catch, poškodené údaje po poliach na predvolené
const cislo = (x) => (typeof x === 'number' && isFinite(x) && x > 0 ? Math.floor(x) : 0);
const pole = (x, n) => { const o = new Array(n).fill(0); if (Array.isArray(x)) for (let i = 0; i < n; i++) o[i] = cislo(x[i]); return o; };
function cistiRec(x) {
  const r = novyRec(); if (!x || typeof x !== 'object') return r;
  for (const k of ['m', 'w', 's', 'bs', 'c', 'f', 'cl', 'ch', 'st', 'pv']) r[k] = cislo(x[k]);
  r.k = pole(x.k, NK); return r;
}
function cistiLad(x) {
  const l = novyLad(); if (!x || typeof x !== 'object') return l;
  l.b = Math.min(6, cislo(x.b)); l.l = pole(x.l, 6); l.g = pole(x.g, 6); return l;
}
function cistiKit(x) {
  const k = Object.assign({}, KIT0); if (!x || typeof x !== 'object') return k;
  for (const [s] of SLOTY) if (typeof x[s] === 'string' && VEC[x[s]] && x[s][0] === s) k[s] = x[s];
  return k;
}
function cistiN(x) { return x && typeof x === 'object' && !Array.isArray(x) ? x : {}; }
// ls: localStorage alebo null; mk: stretnutí majstri (bity)
export function nacitaj(ls) {
  const st = { v: 3, n: {}, rec: novyRec(), lad: novyLad(), kit: Object.assign({}, KIT0), seen: [], uc: false, uv: false, u: 'normal', h: 0, mk: 0, ukl: false };
  let x = null, y = null;
  try { x = JSON.parse(ls.getItem(KLUC)); } catch (e) { x = null; }
  if (!x || typeof x !== 'object') { try { y = JSON.parse(ls.getItem(KLUC2)); } catch (e) { y = null; } }
  const z = x && typeof x === 'object' ? x : y && typeof y === 'object' ? y : {};
  st.n = cistiN(z.n); st.uc = !!z.uc; st.uv = !!z.uv; st.h = cislo(z.h);
  if (z.u === 'easy' || z.u === 'normal' || z.u === 'hard') st.u = z.u;
  if (z === x) { st.mk = cislo(x.mk) & 63; st.rec = cistiRec(x.rec); st.lad = cistiLad(x.lad); st.kit = cistiKit(x.kit); st.seen = Array.isArray(x.seen) ? x.seen.filter((s) => typeof s === 'string' && VEC[s]) : []; }
  // skúška zápisu: ak nejde, hra beží celá a Record povie, že sa neukladá
  try { ls.setItem(KLUC + '-t', '1'); ls.removeItem(KLUC + '-t'); st.ukl = true; } catch (e) { st.ukl = false; }
  const o = odomknute(st.rec, st.lad);   // oblečená vec musí byť odomknutá
  for (const [s] of SLOTY) if (!o[st.kit[s]]) st.kit[s] = KIT0[s];
  return st;
}
export function uloz(ls, st) {
  try { ls.setItem(KLUC, JSON.stringify({ v: 3, n: st.n, rec: st.rec, lad: st.lad, kit: st.kit, seen: st.seen, uc: st.uc, uv: st.uv, u: st.u, h: st.h, mk: st.mk })); return true; } catch (e) { return false; }
}

// koniec zápasu; vráti { nove, pas, noveKombo }
export function zapisZapas(st, z) {
  const r = st.rec, l = st.lad;
  if (z.dvaja) { r.pv++; return { nove: [], pas: -1, noveKombo: [] }; }
  const pred = odomknute(r, l), noveKombo = [];
  r.m++;
  if (z.vyhra) { r.w++; r.s++; if (r.s > r.bs) r.bs = r.s; if (z.sk[1] === 0) r.cl++; } else r.s = 0;
  for (let k = 1; k <= NK; k++) { const n = z.kc[k] | 0; if (n > 0 && !r.k[k - 1]) noveKombo.push(k); r.k[k - 1] += n; r.c += n; }
  r.f += z.fin | 0; r.st += z.stomp | 0; if ((z.ret | 0) > r.ch) r.ch = z.ret | 0;
  let pas = -1;
  if (z.maj >= 0 && z.maj < 6) {
    if (z.vyhra) { l.l[z.maj] = 0; if (z.gentle) l.g[z.maj]++; if (z.maj === l.b) { l.b++; pas = z.maj; } }
    else l.l[z.maj]++;
  }
  st.h++;
  const po = odomknute(r, l), nove = [];
  for (const v of VECI) if (po[v[0]] && !pred[v[0]]) nove.push(v[0]);
  return { nove, pas, noveKombo };
}
// jeden najbližší cieľ: zamknutá vec s najväčším podielom postupu (pásy povie menu)
export function ciel(rec, lad) {
  let best = null, bq = -1;
  for (const v of VECI) {
    if (!v[4] || v[0][0] === 'b' || v[0] === 'k6') continue;
    const [m, t] = postup(v[0], rec, lad); if (m >= t) continue;
    const q = m / t; if (q > bq) { bq = q; best = v; }
  }
  if (!best) return '';
  const [m, t] = postup(best[0], rec, lad);
  return 'Next: ' + best[3] + ' for ' + best[1] + ' ' + SLOTY.find((s) => s[0] === best[0][0])[1].toLowerCase() + (t > 1 ? '. ' + m + ' of ' + t : '.');
}
export function resetuj(st) { st.rec = novyRec(); st.lad = novyLad(); st.seen = []; st.kit = Object.assign({}, KIT0); }
