/* Puzzle Studio: the eleven kinds, and the three things the page has to know
 * about each one.
 *
 *   1. what to ask the generator for (size, difficulty, the odd extra rule),
 *   2. how to prove afterwards that the puzzle has exactly one solution,
 *   3. how to draw it and its answer as SVG.
 *
 * Nothing is reimplemented here. The generators are the very files the free
 * daily games run on (products/arling-sk/games/<game>/generator.mjs, loaded
 * over the network by the same URL the game page uses) and the drawings are
 * the book renderer (ops/puzzle-books/kresli/, copied in by
 * ops/puzzle-studio/sync-kresli.mjs and kept in step by its test). This file
 * is the wiring and nothing else.
 *
 * The table below is copied from plan.UROVNE of each game and from
 * ops/puzzle-books/hry.mjs. Copied, because the page must not pull eleven
 * plan.mjs files over the network before it can draw a form. That copy is a
 * risk, so druhy.test.mjs reads the originals and fails if a single number or
 * a single sentence has drifted.
 *
 * The verification is the point of the product and it is done the hard way.
 * The generator already refuses to return a puzzle with two solutions, but
 * that is the generator vouching for itself. So after a puzzle comes back,
 * the game's own solver is run over it from scratch, asked for up to two
 * solutions, and the puzzle is only shown when it finds exactly one and did
 * not hit its search budget on the way. The number of milliseconds on the
 * green line is that second run, measured, not the generator's own.
 */

/* Where the game modules are served from. The page and the worker use the
 * default; Node tests pass a file:// base instead. */
export const ZAKLAD_HIER = '/games/';
export const ZAKLAD_KRESLI = './kresli/';

/* Budget for the verifying solver. Large enough that no puzzle this page can
 * make has ever reached it (the worst measured was Killer Sudoku 9 x 9 at
 * about 18 ms and a few thousand nodes), small enough that a pathological
 * case ends in a red line in under a second instead of a frozen worker. */
export const STROP_UZLOV = 400000;

export const DRUHY = [
  {
    kluc: "badgers", nazov: "Badgers", druh: "Killer Sudoku", jednotka: "sett",
    pravidla: [
      "Every row, every column and every block holds each number once. The grid size sets the numbers: six by six uses 1 to 6, nine by nine uses 1 to 9. A block is the small rectangle marked by the thicker line.",
      "The dotted cages add up. A cage is the group of cells inside one dotted outline, and the small number in its top left corner is what its cells add up to, with no number repeated inside the cage.",
      "Nothing is filled in at the start: the cages are the whole puzzle, and exactly one arrangement fits.",
    ],
    velkosti: [6, 9],
    urovne: {
      easy: {"n":6,"maxVrstva":2},
      medium: {"n":9,"maxVrstva":2},
      hard: {"n":9,"maxVrstva":3},
      challenge: {"n":9,"maxVrstva":3},
    },
  },
  {
    kluc: "magpies", nazov: "Magpies", druh: "Nonograms", jednotka: "picture",
    pravidla: [
      "The numbers beside every row and above every column give the lengths of the blocks of filled cells, in order, with at least one empty cell between two blocks.",
      "A filled cell is a cell a magpie left something shiny in. An empty cell is nothing. Work out from the numbers alone which is which.",
      "Exactly one picture fits every number, and it can always be reached by reasoning, never by guessing. A cross is your own note that a cell stays empty.",
    ],
    velkosti: [8, 10, 12, 15],
    urovne: {
      easy: {"n":8},
      medium: {"n":10},
      hard: {"n":12},
      challenge: {"n":15},
    },
  },
  {
    kluc: "otters", nazov: "Otters", druh: "Slitherlink", jednotka: "river",
    pravidla: [
      "Draw one closed loop along the grid lines. The otters need a single river: no branches, no crossings, no second loop.",
      "A number in a patch counts its sides. It says how many of that patch’s four sides the river runs along, from 0 to 3. A patch with no number says nothing at all.",
      "Exactly one loop fits every number. A cross on a side is your own note that the side stays dry.",
    ],
    velkosti: [5, 6, 7, 8, 9],
    urovne: {
      easy: {"n":5,"maxVrstva":2},
      medium: {"n":6,"maxVrstva":2},
      hard: {"n":7,"maxVrstva":3},
      tough: {"n":8,"maxVrstva":3},
      challenge: {"n":9,"maxVrstva":3},
    },
  },
  {
    kluc: "squirrels", nazov: "Squirrels", druh: "Kakuro", jednotka: "wood",
    pravidla: [
      "Squirrels hide acorns in the hollows. Each sign tells how many acorns are in the run of hollows to its right or below it. A run is the unbroken line of hollows that follows a sign and ends at the next trunk or at the edge of the wood.",
      "Every hollow holds 1 to 9 acorns, and no number repeats within a run. Every hollow belongs to one run across and one run down at the same time, so the number you write has to suit both.",
      "Exactly one filling fits every sign.",
    ],
    velkosti: [6, 8, 10, 12],
    urovne: {
      easy: {"n":6,"maxVrstva":2},
      medium: {"n":8,"maxVrstva":2},
      hard: {"n":10,"maxVrstva":3},
      challenge: {"n":12,"maxVrstva":3},
    },
  },
  {
    kluc: "cranes", nazov: "Cranes", druh: "Hashi", jednotka: "water",
    pravidla: [
      "Join the sandbanks with straight walkways. A walkway runs up and down or left and right, and only between two sandbanks that stand in line with nothing in between.",
      "A number on a sandbank counts its walkways. When it says four, exactly four walkways leave it. Two walkways may run side by side between the same pair, and that counts as two.",
      "Walkways never cross, and when the water is finished every sandbank can be reached from every other.",
    ],
    velkosti: [7, 9, 11, 13],
    urovne: {
      easy: {"n":7,"maxVrstva":2,"ostrovy":[10,12],"krizenie":false},
      medium: {"n":9,"maxVrstva":2,"ostrovy":[16,20],"krizenie":false},
      hard: {"n":11,"maxVrstva":3,"ostrovy":[24,28],"krizenie":true},
      challenge: {"n":13,"maxVrstva":3,"ostrovy":[32,38],"krizenie":true},
    },
  },
  {
    kluc: "swans", nazov: "Swans", druh: "Masyu", jednotka: "lake",
    pravidla: [
      "Draw one loop through every swan. The loop runs from the middle of one cell to the middle of the next, up and down or left and right, never diagonally, and it never crosses itself, branches, or passes through the same cell twice.",
      "A white swan means the loop goes straight through it and turns in the cell just before or just after. A black swan means the loop turns in that cell and goes straight through both neighbouring cells.",
      "Cells with no swan may be left out of the loop altogether. Exactly one loop fits every swan.",
    ],
    velkosti: [6, 7, 8, 10],
    urovne: {
      easy: {"n":6,"maxVrstva":2},
      medium: {"n":7,"maxVrstva":2},
      hard: {"n":8,"maxVrstva":3},
      challenge: {"n":10,"maxVrstva":3},
    },
  },
  {
    kluc: "voles", nazov: "Voles", druh: "Nurikabe", jednotka: "meadow",
    pravidla: [
      "Every number is a vole family, and it says how big their island is, the number’s own cell included. Shade the rest of the meadow as water so that every island holds exactly one number and exactly that many cells.",
      "Islands never touch by a side. Two islands may sit corner to corner, never side by side, or they would be one island with two numbers.",
      "The water always hangs together as a single sheet, and no two by two block is ever all water.",
    ],
    velkosti: [6, 8, 10, 12],
    urovne: {
      easy: {"n":6,"maxVrstva":2},
      medium: {"n":8,"maxVrstva":2},
      hard: {"n":10,"maxVrstva":3},
      challenge: {"n":12,"maxVrstva":3},
    },
  },
  {
    kluc: "hedgehogs", nazov: "Hedgehogs", druh: "Star Battle", jednotka: "garden",
    pravidla: [
      "Two hedgehogs go in every row, in every column and in every flowerbed. The flowerbeds are the outlined shapes, and a garden with eight rows has eight columns and eight flowerbeds, so sixteen hedgehogs in all.",
      "No two hedgehogs may touch, not side by side and not diagonally. Every hedgehog keeps the eight cells around it empty.",
      "Exactly one arrangement fits. Mark the cells you have ruled out however you like; only the hedgehogs count.",
    ],
    velkosti: [9, 10],
    urovne: {
      easy: {"n":9,"stars":2},
      medium: {"n":9,"stars":2},
      hard: {"n":10,"stars":2},
      challenge: {"n":10,"stars":2},
    },
  },
  {
    kluc: "herons", nazov: "Herons", druh: "Numberlink", jednotka: "marsh",
    pravidla: [
      "Every pair of nests belongs to one pair of herons. Draw a flight path between the two nests of every pair. A path steps from one cell to the next, up and down or left and right, never diagonally, and it never runs beside itself.",
      "Paths never cross. Once a cell belongs to one path it is closed to every other.",
      "Every cell of the marsh is used: no cell is left over when the marsh is finished.",
    ],
    velkosti: [5, 6, 7, 8],
    urovne: {
      easy: {"n":5,"maxVrstva":2},
      medium: {"n":6,"maxVrstva":2},
      hard: {"n":7,"maxVrstva":3},
      challenge: {"n":8,"maxVrstva":3},
    },
  },
  {
    kluc: "hares", nazov: "Hares", druh: "Anti-knight Sudoku", jednotka: "meadow",
    pravidla: [
      "Every row, every column and every block holds each number once. A meadow with nine rows has nine columns and nine blocks of three by three; a six by six meadow has blocks of two rows by three columns.",
      "Hares leap like a knight. Two burrows a knight’s leap apart, two one way and one across, never hold the same number. The leap reaches over rows, columns and blocks alike.",
      "In the harder meadows hares also refuse to sit next to the same number in any direction, corners included. Each puzzle says above it which rules are in force.",
    ],
    velkosti: [6, 9],
    /* Hard and Challenge add the king rule (no repeat in any of the eight
       neighbouring cells) on top of the knight rule. On six by six the two
       together leave no full grid at all: 200 attempts on twelve different
       keys found nothing, measured 18. 9. 2026. Those two steps are therefore
       offered on nine by nine only, instead of offering a size that cannot
       produce a puzzle. */
    velkostiUrovne: { hard: [9], challenge: [9] },
    urovne: {
      easy: {"n":6,"maxVrstva":2,"rules":{"knight":true,"king":false},"dane":12},
      medium: {"n":9,"maxVrstva":2,"rules":{"knight":true,"king":false},"dane":30},
      hard: {"n":9,"maxVrstva":3,"rules":{"knight":true,"king":true},"dane":25},
      challenge: {"n":9,"maxVrstva":3,"rules":{"knight":true,"king":true},"dane":20},
    },
  },
  {
    kluc: "dormice", nazov: "Dormice", druh: "Logic Grid", jednotka: "copse",
    pravidla: [
      "Every clue is true, and exactly one arrangement of the dormice fits all of them together. Nothing has to be guessed.",
      "Each dormouse keeps one store and sleeps in one tree. No two dormice share either of them.",
      "The letters along the grid are the first letters of the names above it. Cross a square out when a clue rules it out, tick it when only one square is left in its row or its column.",
    ],
    velkosti: [],
    urovne: {
      easy: {"n":5,"k":3,"N":5,"ordered":-1,"strop":8,"vahy":{"L":3,"X":4,"D":2,"E":2},"maxLink":99,"maxVrstva":"2a"},
      medium: {"n":4,"k":4,"N":4,"ordered":3,"strop":11,"vahy":{"L":2,"X":4,"D":2,"E":2,"O":3,"A":2},"maxLink":99,"maxVrstva":"2b"},
      hard: {"n":4,"k":4,"N":4,"ordered":3,"strop":13,"vahy":{"L":1,"X":4,"D":2,"E":2,"O":3,"A":3,"N":2,"B":2},"maxLink":1,"maxVrstva":"2b"},
      challenge: {"n":4,"k":4,"N":4,"ordered":3,"strop":15,"vahy":{"X":4,"D":2,"E":2,"O":2,"A":4,"N":2,"B":3},"maxLink":0,"vyzadujeL3":true,"maxAttempts":1500,"maxVrstva":"3"},
    },
  },
];

export const PODLA_KLUCA = new Map(DRUHY.map((d) => [d.kluc, d]));

/* Human names for the difficulty steps, in the order the form offers them. */
export const UROVNE_NAZVY = { easy: 'Easy', medium: 'Medium', hard: 'Hard', tough: 'Tough', challenge: 'Challenge' };
export const UROVNE_PORADIE = ['easy', 'medium', 'hard', 'tough', 'challenge'];

export function urovnePre(kluc) {
  const d = PODLA_KLUCA.get(kluc);
  if (!d) return [];
  return UROVNE_PORADIE.filter((u) => d.urovne[u]);
}

/** The board sizes this kind offers at this difficulty. Empty means the
 *  difficulty fixes the shape and the form hides the size control. */
export function velkostiPre(kluc, uroven) {
  const d = PODLA_KLUCA.get(kluc);
  if (!d) return [];
  const zuzene = d.velkostiUrovne && d.velkostiUrovne[uroven];
  return zuzene ? zuzene.slice() : d.velkosti.slice();
}

/* How many sandbanks a Hashi board of a given size carries. Taken from
 * cranes/generator.mjs ROZSAH_OSTROVOV: change the size and the range has to
 * change with it, or the generator spends its whole attempt budget looking
 * for a board that cannot exist. */
const OSTROVY_PODLA_N = { 7: [10, 12], 9: [16, 20], 11: [24, 28], 13: [32, 38] };

/**
 * The options object for one puzzle: the difficulty step's own settings, with
 * the chosen size put on top and the few fields that depend on the size put
 * right again.
 */
export function optsPre(kluc, uroven, velkost) {
  const d = PODLA_KLUCA.get(kluc);
  if (!d) throw new Error('Unknown kind: ' + kluc);
  const zaklad = d.urovne[uroven];
  if (!zaklad) throw new Error(d.nazov + ' has no ' + uroven + ' setting');
  const o = JSON.parse(JSON.stringify(zaklad));
  const povolene = velkostiPre(kluc, uroven);
  if (!povolene.length) return o; // Dormice: the difficulty fixes the shape
  const n = povolene.indexOf(Number(velkost)) >= 0 ? Number(velkost) : zaklad.n;
  if (n === zaklad.n) return o;
  o.n = n;
  if (kluc === 'cranes') o.ostrovy = OSTROVY_PODLA_N[n] || o.ostrovy;
  // Hares counts its given numbers for one board size. Carrying 30 givens on
  // to a 6 x 6 board would hand over the finished grid, so the number is
  // dropped and the generator's own default for that size applies.
  if (kluc === 'hares') delete o.dane;
  return o;
}

/** The size label under a puzzle. Dormice counts dormice, the rest count cells. */
export function popisVelkosti(kluc, p) {
  if (kluc === 'dormice') return p.N + ' dormice, ' + p.k + ' categories';
  return p.n + ' x ' + p.n;
}

/* ── The proof ─────────────────────────────────────────────────────────
 * One entry per kind: take the finished puzzle apart into exactly what the
 * solver is given at the start (never the answer), run the solver with a
 * ceiling of two solutions, and report how many it found.
 *
 * Magpies is the one that looks different and is not. Its solver is a line
 * solver: it propagates the row and column numbers until nothing more is
 * forced. When that finishes the whole picture, every cell was forced, which
 * is uniqueness proved rather than searched for. If it stalls, the puzzle is
 * refused.
 */
export const OVERENIA = {
  badgers: (g, p) => { const r = g.solve(p.cages, p.n, { limit: 2, maxNodes: STROP_UZLOV }); return { pocet: r.count, vycerpane: !!r.vycerpane, uzly: r.nodes }; },
  cranes: (g, p) => { const r = g.solve(p.islands, p.n, { limit: 2, maxNodes: STROP_UZLOV }); return { pocet: r.count, vycerpane: !!r.vycerpane, uzly: r.nodes }; },
  hares: (g, p) => { const r = g.solve(p.givens, p.n, p.rules, { limit: 2, maxNodes: STROP_UZLOV }); return { pocet: r.count, vycerpane: !!r.vycerpane, uzly: r.nodes }; },
  hedgehogs: (g, p) => { const r = g.solve(p.regions, p.stars, { limit: 2 }); return { pocet: r.solutions.length, vycerpane: !r.complete && r.solutions.length < 2, uzly: r.placements }; },
  herons: (g, p) => { const r = g.solve(p.ends, p.n, { limit: 2, maxNodes: STROP_UZLOV }); return { pocet: r.count, vycerpane: !!r.vycerpane, uzly: r.nodes }; },
  magpies: (g, p) => { const r = g.solveLines(p.clues, p.n); return { pocet: r.complete ? 1 : 0, vycerpane: !r.complete, uzly: r.passes }; },
  otters: (g, p) => { const r = g.solve(p.clues, p.n, { limit: 2, maxNodes: STROP_UZLOV }); return { pocet: r.count, vycerpane: !!r.vycerpane, uzly: r.nodes }; },
  squirrels: (g, p) => { const r = g.solve(p.cells, p.n, { limit: 2, maxNodes: STROP_UZLOV }); return { pocet: r.count, vycerpane: !!r.vycerpane, uzly: r.nodes }; },
  swans: (g, p) => { const r = g.solve(p.pearls, p.n, { limit: 2, maxNodes: STROP_UZLOV }); return { pocet: r.count, vycerpane: !!r.vycerpane, uzly: r.nodes }; },
  voles: (g, p) => { const r = g.solve(p.clues, p.n, { limit: 2, maxNodes: STROP_UZLOV }); return { pocet: r.count, vycerpane: !!r.vycerpane, uzly: r.nodes }; },
  dormice: (g, p) => {
    const r = g.solve({ k: p.k, N: p.N, ordered: p.ordered, clues: p.clues }, { limit: 2, maxNodes: STROP_UZLOV });
    return { pocet: r.count, vycerpane: !!r.vycerpane, uzly: r.nodes };
  },
};

/* ── Loading ───────────────────────────────────────────────────────────
 * The generator and the renderer of one kind, fetched once and kept. */
const NACITANE = new Map();

export async function nacitaj(kluc, zaklad = ZAKLAD_HIER, zakladKresli = ZAKLAD_KRESLI) {
  const cache = kluc + '|' + zaklad;
  if (NACITANE.has(cache)) return NACITANE.get(cache);
  const p = (async () => {
    const [gen, kresli] = await Promise.all([
      import(zaklad + kluc + '/generator.mjs'),
      import(zakladKresli + kluc + '.mjs'),
    ]);
    return { kluc, gen, kresli, meta: PODLA_KLUCA.get(kluc) };
  })();
  NACITANE.set(cache, p);
  return p;
}

/**
 * One puzzle, start to finish: generate, prove, draw.
 *
 * `kluce` is the list of seed keys to try in order. The first one is used
 * almost always; the rest exist because two generators can legitimately turn
 * a key down. Hedgehogs can run out of attempts on a given key, and the
 * Dormice renderer refuses a puzzle whose clue text will not fit the page
 * frame. Moving to the next key is the honest answer to both, and the key
 * that was used is reported, so the puzzle stays reproducible.
 *
 * @returns {{p:Object, kluc:string, overenie:Object, msGen:number, msOver:number}}
 */
export function vyrob(modul, uroven, velkost, kluce) {
  const { kluc, gen, kresli } = modul;
  const opts = optsPre(kluc, uroven, velkost);
  const over = OVERENIA[kluc];
  let posledna = null;
  for (const k of kluce) {
    let p, msGen;
    const t0 = cas();
    try { p = gen.generateSeeded('studio', k, opts); } catch (e) { posledna = e; continue; }
    msGen = cas() - t0;
    const t1 = cas();
    let overenie;
    try { overenie = over(gen, p); } catch (e) { posledna = e; continue; }
    const msOver = cas() - t1;
    if (overenie.pocet !== 1 || overenie.vycerpane) {
      posledna = new Error('the solver found ' + overenie.pocet + (overenie.vycerpane ? ' and ran out of budget' : ''));
      continue;
    }
    let zadanie, riesenie;
    try { zadanie = kresli.zadanie(p); riesenie = kresli.riesenie(p); } catch (e) { posledna = e; continue; }
    return { p, kluc: k, zadanie, riesenie, overenie, msGen, msOver };
  }
  throw new Error('No puzzle after ' + kluce.length + ' keys' + (posledna ? ': ' + posledna.message : ''));
}

function cas() {
  return typeof performance === 'object' && performance && typeof performance.now === 'function'
    ? performance.now() : Date.now();
}
