/* The embeddable widget: drawing and input for the ten ARLing puzzle kinds.
 *
 * What this file is and is not. It draws a board and turns taps into marks.
 * It never decides whether a board is right: that comes from the game's own
 * /games/<kind>/logika.mjs and /games/<kind>/generator.mjs, loaded over the
 * network by widget.mjs and handed in here as `L` and `G`. Those are the same
 * modules the daily game on arling.sk runs, so a board that the widget calls
 * finished is finished by the same rules as the game.
 *
 * Why the widget draws its own board instead of reusing games/<kind>/game.js:
 * that script is the whole game page. It reads thirty elements by id, writes
 * to localStorage, keeps a streak, talks to the account and counts events.
 * An iframe with no cookies and no analytics cannot run it, and cutting it
 * apart would be copying it. The marks, the geometry and the rules all still
 * come from the shared modules; only the paint is local, and it is small.
 *
 * Geometry: one cell is S units, the board has a margin of P units, and the
 * <svg> carries only a viewBox, so CSS decides the size on the page.
 *
 * Every kind exports the same five things:
 *   novy(p)                 the empty board
 *   zoSolution(p, G)        the board that holds the answer
 *   svg(p, st, opts)        { w, h, telo } for one drawing
 *   klik(p, st, ciel)       one tap; returns true when something changed
 *   kontrola(L, G, p, st)   { zle, znamok, hotovo } from the game's own rules
 * and optionally `pad(p)`, the numbers a phone keyboard cannot type.
 */

export const S = 100;
export const P = 26;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const c = (x) => String(Math.round(x * 100) / 100);

const ciara = (x1, y1, x2, y2, tr) => '<line class="' + tr + '" x1="' + c(x1) + '" y1="' + c(y1) + '" x2="' + c(x2) + '" y2="' + c(y2) + '"/>';
const text = (x, y, s, v, tr = 'val') => '<text class="' + tr + '" x="' + c(x) + '" y="' + c(y) + '" font-size="' + c(v) + '">' + esc(s) + '</text>';
const kruh = (x, y, r, tr) => '<circle class="' + tr + '" cx="' + c(x) + '" cy="' + c(y) + '" r="' + c(r) + '"/>';
const obd = (x, y, w, h, tr) => '<rect class="' + tr + '" x="' + c(x) + '" y="' + c(y) + '" width="' + c(w) + '" height="' + c(h) + '"/>';
const plocha = (i, n, tr = 'hit') => {
  const r = (i / n) | 0, k = i % n;
  return '<rect class="' + tr + '" data-c="' + i + '" x="' + c(P + k * S) + '" y="' + c(P + r * S) + '" width="' + S + '" height="' + S + '"/>';
};
const stred = (i, n) => ({ x: P + (i % n) * S + S / 2, y: P + ((i / n) | 0) * S + S / 2 });

/* n x n grid. `hruba(r, k, smer)` says whether an inner line is a block line:
   'h' is the line above row r, 'v' the line left of column k. */
function mriezka(n, hruba) {
  const out = [];
  for (let r = 1; r < n; r++) out.push(ciara(P, P + r * S, P + n * S, P + r * S, hruba && hruba(r, 0, 'h') ? 'mr2' : 'mr'));
  for (let k = 1; k < n; k++) out.push(ciara(P + k * S, P, P + k * S, P + n * S, hruba && hruba(0, k, 'v') ? 'mr2' : 'mr'));
  out.push(obd(P, P, n * S, n * S, 'ram'));
  return out.join('');
}

/* Outline of a set of cells, inset by `odsun`, as one path. Used for the
   killer cages and the star battle flowerbeds. */
function obrys(cells, n, odsun, trieda) {
  const vnutri = new Set(cells);
  const je = (r, k) => r >= 0 && k >= 0 && r < n && k < n && vnutri.has(r * n + k);
  const d = [];
  for (const i of cells) {
    const r = (i / n) | 0, k = i % n;
    const lx = P + k * S, ty = P + r * S, rx = lx + S, by = ty + S;
    const ix = lx + odsun, iy = ty + odsun, ax = rx - odsun, ay = by - odsun;
    const hore = je(r - 1, k), dole = je(r + 1, k), vlavo = je(r, k - 1), vpravo = je(r, k + 1);
    const u = (x1, y1, x2, y2) => d.push('M' + c(x1) + ' ' + c(y1) + 'L' + c(x2) + ' ' + c(y2));
    if (!hore) u(vlavo ? lx : ix, iy, vpravo ? rx : ax, iy);
    if (!dole) u(vlavo ? lx : ix, ay, vpravo ? rx : ax, ay);
    if (!vlavo) u(ix, hore ? ty : iy, ix, dole ? by : ay);
    if (!vpravo) u(ax, hore ? ty : iy, ax, dole ? by : ay);
    if (hore && vlavo && !je(r - 1, k - 1)) { u(lx, iy, ix, iy); u(ix, ty, ix, iy); }
    if (hore && vpravo && !je(r - 1, k + 1)) { u(ax, iy, rx, iy); u(ax, ty, ax, iy); }
    if (dole && vlavo && !je(r + 1, k - 1)) { u(lx, ay, ix, ay); u(ix, ay, ix, by); }
    if (dole && vpravo && !je(r + 1, k + 1)) { u(ax, ay, rx, ay); u(ax, ay, ax, by); }
  }
  return '<path class="' + trieda + '" d="' + d.join('') + '"/>';
}

const blokBadgers = (n) => {
  const vy = n === 9 ? 3 : 2, si = n === 9 ? 3 : 3;
  return (r, k, smer) => (smer === 'h' ? r % vy === 0 : k % si === 0);
};
const blokHares = (n) => {
  const vy = n === 9 ? 3 : 2, si = 3;
  return (r, k, smer) => (smer === 'h' ? r % vy === 0 : k % si === 0);
};

/* ── Kinds that hold a number in every cell ─────────────────────────────── */

function cisla({ blok, dane, rozsah }) {
  return {
    novy: (p) => new Array(p.n * p.n).fill(0),
    zoSolution: (p) => Array.from(p.solution.cells),
    pad: (p) => Array.from({ length: rozsah(p) }, (_, i) => i + 1),
    svg(p, st, o = {}) {
      const n = p.n, w = n * S + 2 * P;
      const out = [mriezka(n, blok(n))];
      const pevne = dane ? dane(p) : null;
      for (let i = 0; i < n * n; i++) {
        if (pevne && pevne[i]) continue;
        if (!o.riesenie) out.push(plocha(i, n, o.vyber === i ? 'hit sel' : 'hit'));
      }
      for (let i = 0; i < n * n; i++) {
        const s = stred(i, n);
        const pevneTu = pevne && pevne[i];
        const hodnota = pevneTu || st[i];
        if (!hodnota) continue;
        const zle = o.zle && o.zle.has(i);
        out.push(text(s.x, s.y, hodnota, 54, pevneTu ? 'giv' : zle ? 'val chyba' : 'val'));
      }
      return { w, h: w, telo: out.join('') };
    },
    klik(p, st, ciel) {
      if (ciel.typ !== 'cislo' || ciel.i == null) return false;
      const pevne = dane ? dane(p) : null;
      if (pevne && pevne[ciel.i]) return false;
      st[ciel.i] = ciel.hodnota;
      return true;
    },
  };
}

const badgers = {
  ...cisla({ blok: blokBadgers, dane: null, rozsah: (p) => p.n }),
  svg(p, st, o = {}) {
    const n = p.n, w = n * S + 2 * P;
    const out = [mriezka(n, blokBadgers(n))];
    for (const cage of p.grid.cages) {
      out.push(obrys(cage.cells, n, 11, 'ohrada'));
      const i = Math.min.apply(null, cage.cells);
      /* Súčet je zarovnaný doľava do vnútra políčka: pri dvojcifernom súčte
         v prvom stĺpci by stred siahol na hrubý okraj dosky. */
      out.push(text(P + (i % n) * S + 9, P + ((i / n) | 0) * S + 22, cage.sum, 27, 'sucet'));
    }
    if (!o.riesenie) for (let i = 0; i < n * n; i++) out.push(plocha(i, n, o.vyber === i ? 'hit sel' : 'hit'));
    for (let i = 0; i < n * n; i++) {
      if (!st[i]) continue;
      const s = stred(i, n);
      out.push(text(s.x, s.y, st[i], 52, o.zle && o.zle.has(i) ? 'val chyba' : 'val'));
    }
    return { w, h: w, telo: out.join('') };
  },
  kontrola: (L, G, p, st) => ({
    zle: new Set(L.porovnaj(st, p.solution.cells).zle),
    znamok: st.filter(Boolean).length,
    hotovo: L.jeVyriesene(st, p.grid.cages, p.n),
  }),
};

const hares = {
  ...cisla({ blok: blokHares, dane: (p) => p.givens, rozsah: (p) => p.n }),
  kontrola: (L, G, p, st) => ({
    zle: new Set(L.porovnaj(spojDane(st, p.givens), p.solution.cells).zle),
    znamok: st.filter(Boolean).length,
    hotovo: L.jeVyriesene(spojDane(st, p.givens), p.n, p.grid.rules),
  }),
};
const spojDane = (st, givens) => st.map((x, i) => givens[i] || x || 0);

const squirrels = {
  ...cisla({ blok: () => null, dane: null, rozsah: () => 9 }),
  svg(p, st, o = {}) {
    const n = p.n, w = n * S + 2 * P;
    const out = [mriezka(n, null)];
    for (let i = 0; i < n * n; i++) {
      const bunka = p.givens[i];
      const r = (i / n) | 0, k = i % n;
      const x = P + k * S, y = P + r * S;
      if (bunka === null) { if (!o.riesenie) out.push(plocha(i, n, o.vyber === i ? 'hit sel' : 'hit')); continue; }
      out.push(obd(x, y, S, S, 'kmen'));
      out.push(ciara(x, y, x + S, y + S, 'mr'));
      if (bunka.d) out.push(text(x + 26, y + 70, bunka.d, 34, 'sucet-kakuro'));
      if (bunka.r) out.push(text(x + 72, y + 30, bunka.r, 34, 'sucet-kakuro'));
    }
    for (let i = 0; i < n * n; i++) {
      if (p.givens[i] !== null || !st[i]) continue;
      const s = stred(i, n);
      out.push(text(s.x, s.y, st[i], 52, o.zle && o.zle.has(i) ? 'val chyba' : 'val'));
    }
    return { w, h: w, telo: out.join('') };
  },
  klik(p, st, ciel) {
    if (ciel.typ !== 'cislo' || ciel.i == null || p.givens[ciel.i] !== null) return false;
    st[ciel.i] = ciel.hodnota;
    return true;
  },
  kontrola: (L, G, p, st) => ({
    zle: new Set(L.porovnaj(st, p.solution.cells).zle),
    znamok: st.filter(Boolean).length,
    hotovo: L.jeVyriesene(st, p.givens, p.n),
  }),
};

/* ── Kinds where a tap cycles a cell through marks ──────────────────────── */

function cyklus({ stavov = 3 } = {}) {
  return {
    novy: (p) => new Array(p.n * p.n).fill(0),
    klik(p, st, ciel) {
      if (ciel.typ !== 'bunka' || ciel.i == null) return false;
      st[ciel.i] = (st[ciel.i] + (ciel.spat ? stavov - 1 : 1)) % stavov;
      return true;
    },
  };
}

const magpies = {
  ...cyklus({}),
  zoSolution: (p) => Array.from(p.solution.cells).map((x) => (x ? 1 : 0)),
  svg(p, st, o = {}) {
    const n = p.n, rows = p.grid.clues.rows, cols = p.grid.clues.cols;
    const maxR = Math.max(...rows.map((x) => x.length)), maxC = Math.max(...cols.map((x) => x.length));
    const lx = maxR * 44 + 14, ty = maxC * 44 + 14;
    const w = n * S + 2 * P + lx, h = n * S + 2 * P + ty;
    const out = ['<g transform="translate(' + c(lx) + ',' + c(ty) + ')">'];
    out.push(mriezka(n, (r, k, smer) => (smer === 'h' ? r % 5 === 0 : k % 5 === 0)));
    for (let i = 0; i < n * n; i++) {
      if (st[i] === 1) { const s = stred(i, n); out.push(obd(s.x - S / 2, s.y - S / 2, S, S, o.zle && o.zle.has(i) ? 'plne chyba' : 'plne')); }
      else if (st[i] === 2) {
        const s = stred(i, n);
        out.push('<path class="' + (o.zle && o.zle.has(i) ? 'krizik chyba' : 'krizik') + '" d="M' + c(s.x - 22) + ' ' + c(s.y - 22) + 'L' + c(s.x + 22) + ' ' + c(s.y + 22) + 'M' + c(s.x + 22) + ' ' + c(s.y - 22) + 'L' + c(s.x - 22) + ' ' + c(s.y + 22) + '"/>');
      }
    }
    if (!o.riesenie) for (let i = 0; i < n * n; i++) out.push(plocha(i, n));
    for (let r = 0; r < n; r++) {
      rows[r].forEach((x, k) => out.push(text(P - 14 - (rows[r].length - 1 - k) * 44, P + r * S + S / 2, x, 38, 'ind')));
    }
    for (let k = 0; k < n; k++) {
      cols[k].forEach((x, r) => out.push(text(P + k * S + S / 2, P - 14 - (cols[k].length - 1 - r) * 44, x, 38, 'ind')));
    }
    out.push('</g>');
    return { w, h, telo: out.join(''), posun: { x: lx, y: ty } };
  },
  kontrola(L, G, p, st) {
    const r = L.porovnaj(st, p.solution.cells);
    return {
      zle: new Set([...r.zleVyplnene, ...r.zleKrizky]),
      znamok: r.vyplnene + r.krizky,
      hotovo: L.jeVyriesene(st, p.grid.clues),
    };
  },
};

const voles = {
  ...cyklus({}),
  zoSolution: (p) => Array.from(p.solution.cells).map((x) => (x === 1 ? 1 : 0)),
  svg(p, st, o = {}) {
    const n = p.n, w = n * S + 2 * P;
    const out = [];
    for (let i = 0; i < n * n; i++) {
      const s = stred(i, n);
      if (st[i] === 1) out.push(obd(s.x - S / 2, s.y - S / 2, S, S, o.zle && o.zle.has(i) ? 'voda chyba' : 'voda'));
    }
    out.push(mriezka(n, null));
    for (let i = 0; i < n * n; i++) {
      const s = stred(i, n);
      if (p.givens[i] !== null && p.givens[i] !== undefined) out.push(text(s.x, s.y, p.givens[i], 50, 'giv'));
      else if (st[i] === 2) out.push(kruh(s.x, s.y, 11, o.zle && o.zle.has(i) ? 'bodka chyba' : 'bodka'));
    }
    if (!o.riesenie) for (let i = 0; i < n * n; i++) out.push(plocha(i, n));
    return { w, h: w, telo: out.join('') };
  },
  klik(p, st, ciel) {
    if (ciel.typ !== 'bunka' || ciel.i == null) return false;
    if (p.givens[ciel.i] !== null && p.givens[ciel.i] !== undefined) return false;
    st[ciel.i] = (st[ciel.i] + (ciel.spat ? 2 : 1)) % 3;
    return true;
  },
  kontrola(L, G, p, st) {
    const r = L.porovnaj(st, p.solution.cells);
    return { zle: new Set([...r.zlaVoda, ...r.zleBodky]), znamok: r.voda + r.bodky, hotovo: L.jeVyriesene(st, p.givens, p.n) };
  },
};

const hedgehogs = {
  ...cyklus({}),
  zoSolution: (p) => Array.from(p.solution.cells).map((x) => (x === 1 ? 2 : 0)),
  svg(p, st, o = {}) {
    const n = p.n, w = n * S + 2 * P;
    const regions = p.givens;
    const out = [mriezka(n, null)];
    /* Flowerbeds: one outline per region, so the thick lines never depend on
       the order the grid was drawn in. */
    const skupiny = new Map();
    for (let i = 0; i < n * n; i++) {
      const g = regions[(i / n) | 0][i % n];
      if (!skupiny.has(g)) skupiny.set(g, []);
      skupiny.get(g).push(i);
    }
    for (const bunky of skupiny.values()) out.push(obrys(bunky, n, 0, 'zahon'));
    for (let i = 0; i < n * n; i++) {
      const s = stred(i, n);
      const zle = o.zle && o.zle.has(i) ? ' chyba' : '';
      if (st[i] === 2) out.push('<path class="jezko' + zle + '" d="' + hviezda(s.x, s.y, 34) + '"/>');
      else if (st[i] === 1) out.push(kruh(s.x, s.y, 10, 'bodka' + zle));
    }
    if (!o.riesenie) for (let i = 0; i < n * n; i++) out.push(plocha(i, n));
    return { w, h: w, telo: out.join('') };
  },
  kontrola(L, G, p, st) {
    const r = L.porovnaj(st, p.solution.cells);
    return { zle: new Set([...r.zleJezky, ...r.zleBodky]), znamok: r.hedgehogs + r.dots, hotovo: L.jeVyriesene(st, p.givens, p.grid.stars) };
  },
};
function hviezda(cx, cy, r) {
  const b = [];
  for (let i = 0; i < 10; i++) {
    const uhol = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 === 0 ? r : r * 0.42;
    b.push(c(cx + rr * Math.cos(uhol)) + ' ' + c(cy + rr * Math.sin(uhol)));
  }
  return 'M' + b.join('L') + 'Z';
}

/* ── The two loop kinds: a tap cycles one edge ──────────────────────────── */

function hranove() {
  return {
    novy: (p, G) => new Array(G.geometria(p.n).E).fill(0),
    zoSolution: (p, G) => Array.from(G.stavZHran({ h: p.solution.h, v: p.solution.v }, p.n)),
    klik(p, st, ciel) {
      if (ciel.typ !== 'hrana' || ciel.e == null) return false;
      st[ciel.e] = (st[ciel.e] + (ciel.spat ? 2 : 1)) % 3;
      return true;
    },
    kontrola(L, G, p, st) {
      const r = L.porovnaj(st, { h: p.solution.h, v: p.solution.v });
      return {
        zle: new Set([...r.zleCiary, ...r.zleKrizky].map((e) => 'e' + e)),
        znamok: r.ciary + r.krizky,
        hotovo: L.jeVyriesene(st, p.givens, p.n),
      };
    },
  };
}

/* Otters (Slitherlink): the marks sit on the grid lines between the dots. */
const otters = {
  ...hranove(),
  svg(p, st, o = {}) {
    const n = p.n, w = n * S + 2 * P;
    const g = o.G.geometria(n);
    const out = [];
    for (let i = 0; i < n * n; i++) {
      const cl = p.givens[i];
      if (cl === null || cl === undefined) continue;
      const s = stred(i, n);
      out.push(text(s.x, s.y, cl, 46, 'giv'));
    }
    for (let e = 0; e < g.E; e++) {
      const h = o.G.hrana(e, n);
      const a = h.typ === 'h' ? { x1: P + h.c * S, y1: P + h.r * S, x2: P + (h.c + 1) * S, y2: P + h.r * S }
        : { x1: P + h.c * S, y1: P + h.r * S, x2: P + h.c * S, y2: P + (h.r + 1) * S };
      const zle = o.zle && o.zle.has('e' + e) ? ' chyba' : '';
      if (st[e] === 1) out.push('<line class="tah' + zle + '" x1="' + c(a.x1) + '" y1="' + c(a.y1) + '" x2="' + c(a.x2) + '" y2="' + c(a.y2) + '"/>');
      else if (st[e] === 2) {
        const mx = (a.x1 + a.x2) / 2, my = (a.y1 + a.y2) / 2;
        out.push('<path class="krizik' + zle + '" d="M' + c(mx - 13) + ' ' + c(my - 13) + 'L' + c(mx + 13) + ' ' + c(my + 13) + 'M' + c(mx + 13) + ' ' + c(my - 13) + 'L' + c(mx - 13) + ' ' + c(my + 13) + '"/>');
      }
      if (!o.riesenie) {
        out.push('<line class="hitline" data-e="' + e + '" x1="' + c(a.x1) + '" y1="' + c(a.y1) + '" x2="' + c(a.x2) + '" y2="' + c(a.y2) + '"/>');
      }
    }
    for (let r = 0; r <= n; r++) for (let k = 0; k <= n; k++) out.push(kruh(P + k * S, P + r * S, 7, 'bod'));
    return { w, h: w, telo: out.join('') };
  },
};

/* Swans (Masyu): the marks sit between the middles of two neighbouring cells. */
const swans = {
  ...hranove(),
  svg(p, st, o = {}) {
    const n = p.n, w = n * S + 2 * P;
    const g = o.G.geometria(n);
    const out = [mriezka(n, null)];
    for (let e = 0; e < g.E; e++) {
      const h = o.G.hrana(e, n);
      const a = h.typ === 'h'
        ? { x1: P + h.c * S + S / 2, y1: P + h.r * S + S / 2, x2: P + (h.c + 1) * S + S / 2, y2: P + h.r * S + S / 2 }
        : { x1: P + h.c * S + S / 2, y1: P + h.r * S + S / 2, x2: P + h.c * S + S / 2, y2: P + (h.r + 1) * S + S / 2 };
      const zle = o.zle && o.zle.has('e' + e) ? ' chyba' : '';
      if (st[e] === 1) out.push('<line class="tah' + zle + '" x1="' + c(a.x1) + '" y1="' + c(a.y1) + '" x2="' + c(a.x2) + '" y2="' + c(a.y2) + '"/>');
      else if (st[e] === 2) {
        const mx = (a.x1 + a.x2) / 2, my = (a.y1 + a.y2) / 2;
        out.push('<path class="krizik' + zle + '" d="M' + c(mx - 12) + ' ' + c(my - 12) + 'L' + c(mx + 12) + ' ' + c(my + 12) + 'M' + c(mx + 12) + ' ' + c(my - 12) + 'L' + c(mx - 12) + ' ' + c(my + 12) + '"/>');
      }
      if (!o.riesenie) out.push('<line class="hitline" data-e="' + e + '" x1="' + c(a.x1) + '" y1="' + c(a.y1) + '" x2="' + c(a.x2) + '" y2="' + c(a.y2) + '"/>');
    }
    for (let i = 0; i < n * n; i++) {
      const s = stred(i, n);
      if (p.givens[i] === 1) out.push(kruh(s.x, s.y, 26, 'perla biela'));
      else if (p.givens[i] === 2) out.push(kruh(s.x, s.y, 26, 'perla cierna'));
    }
    return { w, h: w, telo: out.join('') };
  },
};

/* ── Herons (Numberlink): cells belong to a path ────────────────────────── */

const herons = {
  novy: (p) => new Array(p.n * p.n).fill(0),
  zoSolution: (p) => Array.from(p.solution.cells),
  svg(p, st, o = {}) {
    const n = p.n, w = n * S + 2 * P;
    const out = [mriezka(n, null)];
    /* Len to, čo hráč naozaj nakreslil. Hniezdo síce vždy patrí svojej ceste,
       ale kým ho nikto neťukol, nie je súčasťou nakreslenej cesty a doska by
       inak vyzerala rozrobená už na začiatku. */
    for (let i = 0; i < n * n; i++) {
      const par = st[i];
      if (!par) continue;
      const s = stred(i, n);
      const zle = o.zle && o.zle.has(i) ? ' chyba' : '';
      out.push(obd(s.x - S / 2 + 6, s.y - S / 2 + 6, S - 12, S - 12, 'cesta c' + ((par - 1) % 8) + zle));
    }
    for (let i = 0; i < n * n; i++) {
      if (!p.givens[i]) continue;
      const s = stred(i, n);
      out.push(kruh(s.x, s.y, 34, 'hniezdo'));
      out.push(text(s.x, s.y, p.givens[i], 46, 'giv'));
    }
    if (!o.riesenie) for (let i = 0; i < n * n; i++) out.push(plocha(i, n, o.vyber === i ? 'hit sel' : 'hit'));
    return { w, h: w, telo: out.join('') };
  },
  /* Tap a nest to take its pair, then tap cell after cell. Tapping a cell of
     the path again clears it, so nothing needs a second button. */
  klik(p, st, ciel) {
    if (ciel.typ !== 'bunka' || ciel.i == null) return false;
    const i = ciel.i;
    if (p.givens[i]) { ciel.stav.par = p.givens[i]; return true; }
    if (st[i]) { st[i] = 0; return true; }
    if (!ciel.stav.par) return false;
    st[i] = ciel.stav.par;
    return true;
  },
  kontrola(L, G, p, st) {
    const r = L.porovnaj(st, p.solution.cells);
    return { zle: new Set(r.zle), znamok: r.vyplnene, hotovo: L.jeVyriesene(st, p.givens, p.n) };
  },
};

/* ── Cranes (Hashi): a tap adds a walkway between two sandbanks ─────────── */

const cranes = {
  novy: (p, G) => new Array(G.graf(p.grid.islands, p.n).E).fill(0),
  zoSolution: (p, G) => Array.from(G.poleLaviek(p.solution.bridges, G.graf(p.grid.islands, p.n))),
  svg(p, st, o = {}) {
    const n = p.n, w = n * S + 2 * P;
    const g = o.G.graf(p.grid.islands, n);
    const ostrovy = p.grid.islands;
    const out = [];
    const bod = (i) => ({ x: P + ostrovy[i].c * S + S / 2, y: P + ostrovy[i].r * S + S / 2 });
    for (let e = 0; e < g.E; e++) {
      const a = bod(g.pary[e].a), b = bod(g.pary[e].b);
      const zle = o.zle && o.zle.has('e' + e) ? ' chyba' : '';
      const kolmo = g.pary[e].vodorovna ? { x: 0, y: 12 } : { x: 12, y: 0 };
      if (st[e] >= 1) {
        const posun = st[e] === 2 ? [-1, 1] : [0];
        for (const k of posun) {
          out.push('<line class="lavka' + zle + '" x1="' + c(a.x + kolmo.x * k) + '" y1="' + c(a.y + kolmo.y * k)
            + '" x2="' + c(b.x + kolmo.x * k) + '" y2="' + c(b.y + kolmo.y * k) + '"/>');
        }
      }
      if (!o.riesenie) {
        out.push('<line class="hitline" data-e="' + e + '" x1="' + c(a.x) + '" y1="' + c(a.y) + '" x2="' + c(b.x) + '" y2="' + c(b.y) + '"/>');
      }
    }
    for (let i = 0; i < ostrovy.length; i++) {
      const s = bod(i);
      out.push(kruh(s.x, s.y, 36, 'ostrov'));
      out.push(text(s.x, s.y, ostrovy[i].n, 46, 'giv'));
    }
    return { w, h: w, telo: out.join('') };
  },
  klik(p, st, ciel) {
    if (ciel.typ !== 'hrana' || ciel.e == null) return false;
    st[ciel.e] = (st[ciel.e] + (ciel.spat ? 2 : 1)) % 3;
    return true;
  },
  kontrola(L, G, p, st) {
    const g = G.graf(p.grid.islands, p.n);
    const r = L.porovnaj(st, p.solution.bridges, p.grid.islands, p.n, g);
    return {
      zle: new Set([...r.zleDvojice, ...r.krizenia].map((e) => 'e' + e)),
      znamok: r.lavky,
      hotovo: L.jeVyriesene(st, p.grid.islands, p.n, g),
    };
  },
};

export const DRUHY = { badgers, hares, squirrels, magpies, hedgehogs, voles, otters, swans, herons, cranes };

/* One <svg> for a board. The viewBox is the only size the file carries, so the
   page decides how big the puzzle is. */
export function obal(kus, popis) {
  return '<svg viewBox="0 0 ' + c(kus.w) + ' ' + c(kus.h) + '" xmlns="http://www.w3.org/2000/svg"'
    + ' preserveAspectRatio="xMidYMid meet" aria-label="' + esc(popis) + '">' + kus.telo + '</svg>';
}
