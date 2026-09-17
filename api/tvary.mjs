/* The shape of one v1 API record, per puzzle kind. One file, two readers:
 * the builder (ops/puzzle-api/schema.mjs) writes records with it and the embed
 * widget (/embed/puzzle/widget.mjs) reads them with it, so a field can never
 * mean one thing on the way out and another on the way in.
 *
 * It is plain ES with no imports, so Node and the browser both load it.
 *
 *   givens    the name of the field on the generator's puzzle that holds the
 *             clues as one flat array, when the kind has such a field
 *   grid      the names of the fields that are not a flat array
 *   riesenie  how the answer is written: 'cells', 'hv' (the two loop kinds) or
 *             'bridges' (Cranes)
 */
export const TVARY = Object.freeze({
  badgers: Object.freeze({ grid: ['cages'], riesenie: 'cells' }),
  hares: Object.freeze({ givens: 'givens', grid: ['rules'], riesenie: 'cells' }),
  squirrels: Object.freeze({ givens: 'cells', riesenie: 'cells' }),
  magpies: Object.freeze({ grid: ['clues'], riesenie: 'cells' }),
  hedgehogs: Object.freeze({ givens: 'regions', grid: ['stars'], riesenie: 'cells' }),
  otters: Object.freeze({ givens: 'clues', riesenie: 'hv' }),
  cranes: Object.freeze({ grid: ['islands'], riesenie: 'bridges' }),
  swans: Object.freeze({ givens: 'pearls', riesenie: 'hv' }),
  voles: Object.freeze({ givens: 'clues', riesenie: 'cells' }),
  herons: Object.freeze({ givens: 'ends', grid: ['pairs'], riesenie: 'cells' }),
});

export const KINDS = Object.freeze(Object.keys(TVARY));
export const DIFFICULTIES = Object.freeze(['easy', 'medium', 'hard']);

/* Typed arrays turn into plain arrays: JSON.stringify would otherwise write a
   Uint8Array as an object with the keys "0", "1", "2". */
export const ciste = (x) => JSON.parse(JSON.stringify(x, (_k, v) => (ArrayBuffer.isView(v) ? Array.from(v) : v)));

/* A puzzle straight from games/<kind>/generator.mjs, written the way the API
   writes it. `extra` carries the fields only the API knows (id, seed, licence
   and so on); this function fills in just the puzzle itself. */
export function naApi(kind, p) {
  const t = TVARY[kind];
  if (!t) throw new Error('Unknown kind: ' + kind);
  const von = { v: 1, kind, size: p.n };
  if (t.givens) von.givens = ciste(p[t.givens]);
  if (t.grid) {
    von.grid = {};
    for (const k of t.grid) von.grid[k] = ciste(p[k]);
  }
  von.solution = t.riesenie === 'hv' ? { h: ciste(p.solution.h), v: ciste(p.solution.v) }
    : t.riesenie === 'bridges' ? { bridges: ciste(p.bridges) }
      : { cells: ciste(p.solution) };
  return von;
}
