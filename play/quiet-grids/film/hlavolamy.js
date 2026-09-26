// Quiet Grids film: skutočné zadania z banky appky a ich pravidlá, prepísané z Kotlinu.
//
// Záznamy sú doslovne riadky z products/hlavolamy-android/app/src/main/assets/bank/<typ>.txt (test.mjs
// ich porovná so súborom). Banku postavil ops/games/hlavolamy/postav-banku.mjs z generátorov webových hier
// a generátor prijal len zadanie s jediným riešením (Puzzles.kt, hlavička rozhrania Puzzle).
// Funkcie nižšie sú riadok po riadku prepis Unpack.kt a Puzzles.kt (Paths, Bridges, PictureGrid) a Hint.kt.

export const ZAZNAMY = {
  herons: {
    subor: 'herons.txt', riadok: 17,
    text: '2026-09-02\tmedium\tn=6\te=102000310450000000200540030000000000\ts=112222314452334552234542234442222222\tl=55,0,0\tk=55\thint=1011;10c3;10g5;00o20u20v2;00w2;00d3;00f5;10s4;00r4;00320420520b20h20n20t20x20y20z2;00q4;1084;00k4;00e4;10j3',
  },
  cranes: {
    subor: 'cranes.txt', riadok: 10,
    text: '2026-08-26\tmedium\tn=9\ti=0,0,1;0,2,3;0,4,1;0,6,3;0,8,4;2,2,5;2,4,4;2,6,2;2,8,2;4,2,2;6,0,3;6,2,3;6,8,2;8,0,3;8,2,1;8,4,1;8,6,2;8,8,2\tb=0-1:1;1-5:2;2-6:1;3-4:2;3-7:1;4-8:2;5-6:2;5-9:1;6-7:1;9-11:1;10-11:1;10-13:2;11-12:1;12-17:1;13-14:1;15-16:1;16-17:1\tl=19,1,0\ts=20\thint=7062082;00d00f0;00k00m10n0;10i2;40c0;40e0;20o1;50p1;10l1;00j1;10g10h1;00a1;0010;1032092;2001;0020;3040;2051;1071;00b1',
  },
  magpies: {
    subor: 'magpies.txt', riadok: 8,
    text: '2026-08-24\teasy\tn=8\tr=4,2|2,2|2,3|3,3|1,1,1,2|1,3|2,2,1|8\tc=1,3,1|4,2|5,2|1,1|1,2|2,3|6,1|8\ts=0,1,2,3,6,7,9,10,14,15,17,18,21,22,23,24,25,26,29,30,31,32,34,36,38,39,40,45,46,47,49,50,52,53,55,56,57,58,59,60,61,62,63\tp=2\thint=1011021031061;10l1;00p10q10t10u1;10w10x20y10z2101112121131;11d11g1;01k11l11m11n11o11p11q11r1;20o11c2;00r2;11e11f21h11i21j1;30910h1152;20a10i1162;00820b2;10g20j20m1;0191;2001141;1042;3172;01a1;20c20k20s2182;00e1;10n1;00v1;01b1;30520d2;1071;00f1',
  },
};

// mená pravidiel reťazca Hintu z manifestu banky (manifest.txt, riadky „rules“)
export const PRAVIDLA = {
  herons: ['cell-needs-all', 'nest-one-way', 'only-pair', 'trial-line', 'region-cut'],
  cranes: ['island-full', 'needs-all', 'one-neighbour', 'pair-isolation', 'no-crossing', 'at-least-one', 'trial', 'all-double', 'capacity'],
  magpies: ['row-odd', 'row-even', 'column-even', 'column-odd'],
};

/** Bank.days: dátum, úroveň a polia kľúč=hodnota, reťazec Hintu zvlášť. */
export function rozbal(text) {
  const f = text.split('\t');
  const polia = {};
  let retaz = null;
  for (const p of f.slice(2)) {
    const i = p.indexOf('=');
    if (i <= 0) throw new Error('pole bez mena: ' + p);
    const k = p.slice(0, i), v = p.slice(i + 1);
    if (k === 'hint') retaz = v; else polia[k] = v;
  }
  return { datum: f[0], uroven: f[1], polia, retaz };
}

/** Hint.chain: krok = pravidlo (1 znak base 36) a ciele (slot 2 znaky, hodnota 1 znak). */
export function retaz(packed, sloty, pravidiel) {
  if (!packed) return [];
  return packed.split(';').map((kus) => {
    if ((kus.length - 1) % 3 !== 0 || kus.length < 4) throw new Error('zlý krok ' + kus);
    const pravidlo = parseInt(kus[0], 36);
    if (!(pravidlo >= 0 && pravidlo < pravidiel)) throw new Error('zlé pravidlo ' + kus);
    const ciele = [];
    for (let k = 0; k < (kus.length - 1) / 3; k++) {
      const slot = parseInt(kus.substr(1 + k * 3, 2), 36), hodnota = parseInt(kus[3 + k * 3], 36);
      if (!(slot >= 0 && slot < sloty)) throw new Error('slot mimo dosky ' + kus);
      ciele.push([slot, hodnota]);
    }
    return { pravidlo, ciele };
  });
}

const STEP_R = [-1, 0, 1, 0], STEP_C = [0, 1, 0, -1];
function okolo(i, n) {
  const r = Math.floor(i / n), c = i % n, out = [];
  for (let d = 0; d < 4; d++) { const rr = r + STEP_R[d], cc = c + STEP_C[d]; if (rr >= 0 && rr < n && cc >= 0 && cc < n) out.push(rr * n + cc); }
  return out;
}
function spojene(clenovia, n, vnutri) {
  if (!clenovia.length) return true;
  const videne = new Set([clenovia[0]]), zas = [clenovia[0]];
  while (zas.length) { const a = zas.pop(); for (const j of okolo(a, n)) if (vnutri(j) && !videne.has(j)) { videne.add(j); zas.push(j); } }
  return clenovia.every((x) => videne.has(x));
}
function bloky(riadok) {
  const out = []; let beh = 0;
  for (const x of riadok) { if (x === 1) beh++; else if (beh > 0) { out.push(beh); beh = 0; } }
  if (beh > 0) out.push(beh);
  return out;
}
const rovnake = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Paths (numberlink): Unpack.paths + Paths.isSolved. */
export function cesty(p) {
  const n = Number(p.polia.n);
  const cisla = (s) => (s.includes('|') ? s.split('|').map(Number) : [...s].map(Number));
  const konce = cisla(p.polia.e), riesenie = cisla(p.polia.s);
  if (konce.length !== n * n || riesenie.length !== n * n) throw new Error('herons: zlý rozmer');
  const pocet = {};
  for (const x of konce) if (x) pocet[x] = (pocet[x] || 0) + 1;
  const pary = Object.keys(pocet).length;
  const jeVyriesene = (v) => {
    if (v.length !== n * n) return false;
    for (let i = 0; i < n * n; i++) { if (!(v[i] >= 1 && v[i] <= pary)) return false; if (konce[i] && v[i] !== konce[i]) return false; }
    for (let i = 0; i < n * n; i++) {
      const rovn = okolo(i, n).filter((j) => v[j] === v[i]).length;
      if (konce[i] ? rovn !== 1 : rovn !== 2) return false;
    }
    for (let k = 1; k <= pary; k++) { const bunky = [...v.keys()].filter((i) => v[i] === k); if (!bunky.length || !spojene(bunky, n, (j) => v[j] === k)) return false; }
    return true;
  };
  return { n, konce, riesenie, pary, jeVyriesene, sloty: n * n };
}

/** Bridges (hashi): Unpack.bridges + Bridges (spans v poradí webu, answer, isSolved). */
export function mosty(p) {
  const n = Number(p.polia.n);
  const ostrovy = p.polia.i.split(';').map((s) => { const [r, c, need] = s.split(',').map(Number); return { r, c, need }; });
  const na = new Map(ostrovy.map((o, i) => [o.r * n + o.c, i]));
  const videne = new Set(), surove = [];
  const dr = [-1, 0, 1, 0], dc = [0, 1, 0, -1];
  ostrovy.forEach((o, i) => {
    for (let d = 0; d < 4; d++) {
      let r = o.r + dr[d], c = o.c + dc[d], j = -1;
      while (r >= 0 && r < n && c >= 0 && c < n) { if (na.has(r * n + c)) { j = na.get(r * n + c); break; } r += dr[d]; c += dc[d]; }
      if (j < 0) continue;
      const lo = Math.min(i, j), hi = Math.max(i, j), kluc = lo * ostrovy.length + hi;
      if (videne.has(kluc)) continue;
      videne.add(kluc);
      surove.push({ a: lo, b: hi, vodorovne: ostrovy[lo].r === ostrovy[hi].r });
    }
  });
  surove.sort((x, y) => x.a - y.a || x.b - y.b);
  const mapa = new Map();
  for (const kus of (p.polia.b || '').split(';').filter(Boolean)) {
    const [dvojica, k] = kus.split(':'); const [a, b] = dvojica.split('-').map(Number);
    mapa.set(a * ostrovy.length + b, Number(k));
  }
  const indexPary = (a, b) => { const lo = Math.min(a, b), hi = Math.max(a, b); return surove.findIndex((s) => s.a === lo && s.b === hi); };
  const odpoved = surove.map((s) => mapa.get(s.a * ostrovy.length + s.b) || 0);
  const paryOstrova = ostrovy.map((_, i) => surove.map((s, e) => (s.a === i || s.b === i ? e : -1)).filter((e) => e >= 0));
  const pocetMostov = (v) => (v === 1 || v === 2 ? v : 0);
  const krizenia = surove.map(() => []);
  for (let e = 0; e < surove.length; e++) for (let f = e + 1; f < surove.length; f++) {
    const P = surove[e], Q = surove[f];
    if (P.vodorovne === Q.vodorovne) continue;
    const h = P.vodorovne ? P : Q, vv = P.vodorovne ? Q : P;
    const r = ostrovy[h.a].r, c1 = Math.min(ostrovy[h.a].c, ostrovy[h.b].c), c2 = Math.max(ostrovy[h.a].c, ostrovy[h.b].c);
    const c = ostrovy[vv.a].c, r1 = Math.min(ostrovy[vv.a].r, ostrovy[vv.b].r), r2 = Math.max(ostrovy[vv.a].r, ostrovy[vv.b].r);
    if (c > c1 && c < c2 && r > r1 && r < r2) { krizenia[e].push(f); krizenia[f].push(e); }
  }
  const jeVyriesene = (v) => {
    for (let i = 0; i < ostrovy.length; i++) { let s = 0; for (const e of paryOstrova[i]) s += pocetMostov(v[e]); if (s !== ostrovy[i].need) return false; }
    for (let e = 0; e < surove.length; e++) if (pocetMostov(v[e]) > 0) for (const f of krizenia[e]) if (pocetMostov(v[f]) > 0) return false;
    const vid = new Array(ostrovy.length).fill(false), zas = [0]; vid[0] = true;
    while (zas.length) { const i = zas.pop(); for (const e of paryOstrova[i]) { if (!pocetMostov(v[e])) continue; const j = surove[e].a === i ? surove[e].b : surove[e].a; if (!vid[j]) { vid[j] = true; zas.push(j); } } }
    return vid.every(Boolean);
  };
  return { n, ostrovy, pary: surove, odpoved, paryOstrova, indexPary, pocetMostov, jeVyriesene, sloty: surove.length };
}

/** Picture Grid (nonogram): Unpack.pictureGrid + PictureGrid.isSolved. */
export function obrazok(p) {
  const n = Number(p.polia.n);
  const riadky = (s) => s.split('|').map((l) => (l ? l.split(',').map(Number) : []));
  const riadkove = riadky(p.polia.r), stlpcove = riadky(p.polia.c);
  const riesenie = new Array(n * n).fill(0);
  for (const i of p.polia.s.split(',').map(Number)) riesenie[i] = 1;
  const jeVyriesene = (v) => {
    for (let r = 0; r < n; r++) if (!rovnake(bloky(v.slice(r * n, r * n + n)), riadkove[r])) return false;
    for (let c = 0; c < n; c++) if (!rovnake(bloky(Array.from({ length: n }, (_, i) => v[i * n + c])), stlpcove[c])) return false;
    return true;
  };
  return { n, riadkove, stlpcove, riesenie, jeVyriesene, bloky, sloty: n * n };
}
