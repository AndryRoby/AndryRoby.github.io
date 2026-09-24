/* The pure half of /api/: addresses, the code samples and the JSON view.
 *
 * Nothing in here touches the page. docs.js calls these functions and puts
 * the results into the DOM; api/docs.test.mjs loads this same file in Node
 * and checks that every address a sample can point to is a real file under
 * api/puzzles/. One source for both, so a sample on the page can never name
 * a file that the test did not see.
 *
 * It is a plain script and not a module: the page's Content-Security-Policy
 * allows only scripts from this site, and a classic script is the simplest
 * thing that both the browser and node:vm can run. It defines one global,
 * ArlingApi, and nothing else.
 */
(function (koren) {
  'use strict';

  var WEB = 'https://arling.sk';
  var API = '/api/puzzles/v1/';

  /* The ten kinds in the order of the page's select. Names and types are the
     same as in api/puzzles/v1/index.json. */
  var DRUHY = [
    { kind: 'badgers', name: 'Badgers', type: 'Killer Sudoku' },
    { kind: 'hares', name: 'Hares', type: 'Anti-knight Sudoku' },
    { kind: 'squirrels', name: 'Squirrels', type: 'Kakuro' },
    { kind: 'magpies', name: 'Magpies', type: 'Nonograms' },
    { kind: 'hedgehogs', name: 'Hedgehogs', type: 'Star Battle' },
    { kind: 'otters', name: 'Otters', type: 'Slitherlink' },
    { kind: 'cranes', name: 'Cranes', type: 'Hashi' },
    { kind: 'swans', name: 'Swans', type: 'Masyu' },
    { kind: 'voles', name: 'Voles', type: 'Nurikabe' },
    { kind: 'herons', name: 'Herons', type: 'Numberlink' },
  ];
  var OBTIAZNOSTI = ['easy', 'medium', 'hard'];
  var POCET = 200;

  function druh(kind) {
    for (var i = 0; i < DRUHY.length; i++) if (DRUHY[i].kind === kind) return DRUHY[i];
    return null;
  }

  function tri(n) { return ('00' + n).slice(-3); }

  /* A choice from the page, made safe: an unknown kind or difficulty falls
     back to the first one, a number is clamped to 1..200. */
  function stav(kind, difficulty, n) {
    var d = druh(kind) || DRUHY[5];
    var o = OBTIAZNOSTI.indexOf(difficulty) >= 0 ? difficulty : 'easy';
    var c = Math.min(POCET, Math.max(1, parseInt(n, 10) || 1));
    return { kind: d.kind, name: d.name, type: d.type, difficulty: o, n: c, nnn: tri(c), id: d.kind + '-' + o + '-' + tri(c) };
  }

  /* Paths on this site, starting with a slash. The page loads these; the
     samples show them with https://arling.sk in front. */
  function cesty(s) {
    var zlozka = API + s.kind + '/' + s.difficulty + '/';
    return {
      json: zlozka + s.nnn + '.json',
      svg: zlozka + s.nnn + '.svg',
      solution: zlozka + s.nnn + '-solution.svg',
      list: zlozka + 'index.json',
      today: API + 'today/' + s.kind + '.json',
      index: API + 'index.json',
      widget: '/embed/puzzle/?kind=' + s.kind + '&difficulty=' + s.difficulty + '&id=' + s.id,
      embedJs: '/embed/puzzle/embed.js',
    };
  }

  function naWebe(cesta) { return WEB + cesta; }

  /* The code samples, exactly as they are shown and copied. */
  function ukazky(s) {
    var c = cesty(s);
    var json = naWebe(c.json);
    return {
      iframe: '<iframe src="' + naWebe(c.widget) + '"\n'
        + '        title="' + s.type + ' puzzle by ARLing" width="100%" height="620"\n'
        + '        style="border:0" loading="lazy"\n'
        + '        sandbox="allow-scripts allow-same-origin allow-popups"></iframe>',

      script: '<script src="' + naWebe(c.embedJs) + '"\n'
        + '        data-kind="' + s.kind + '" data-difficulty="' + s.difficulty + '"\n'
        + '        data-id="' + s.id + '"></script>',

      img: '<figure>\n'
        + '  <img src="' + naWebe(c.svg) + '"\n'
        + '       alt="' + s.type + ' puzzle" width="400"\n'
        + '       style="background:#fff; max-width:100%; height:auto">\n'
        + '  <figcaption><a href="https://arling.sk/">Puzzle by ARLing, arling.sk</a></figcaption>\n'
        + '</figure>',

      js: "const url = '" + json + "';\n"
        + '\n'
        + 'fetch(url)\n'
        + '  .then((response) => response.json())\n'
        + '  .then((puzzle) => {\n'
        + '    console.log(puzzle.id);                      // which puzzle this is\n'
        + '    console.log(puzzle.rules);                   // the type and a link to the rules\n'
        + '    console.log(puzzle.size);                    // the side of the grid\n'
        + '    console.log(puzzle.verified.uniqueSolution); // true in every file\n'
        + '    console.log(new URL(puzzle.svg.puzzle, url).href); // the drawing\n'
        + '  });',

      curl: '# the puzzle as JSON\n'
        + 'curl -s ' + json + '\n'
        + '\n'
        + '# the drawing and its answer, saved as ' + s.nnn + '.svg and ' + s.nnn + '-solution.svg\n'
        + 'curl -sO ' + naWebe(c.svg) + '\n'
        + 'curl -sO ' + naWebe(c.solution) + '\n'
        + '\n'
        + '# all 200 puzzles of this kind and difficulty, with a sha256 for every file\n'
        + 'curl -s ' + naWebe(c.list),

      python: 'import json\n'
        + 'import urllib.request\n'
        + '\n'
        + 'url = "' + json + '"\n'
        + 'with urllib.request.urlopen(url) as response:\n'
        + '    puzzle = json.load(response)\n'
        + '\n'
        + 'print(puzzle["id"], puzzle["size"])\n'
        + 'print(puzzle["verified"]["uniqueSolution"])\n'
        + '\n'
        + '# save the drawing and its answer next to this script\n'
        + 'base = url.rsplit("/", 1)[0] + "/"\n'
        + 'for name in puzzle["svg"].values():\n'
        + '    urllib.request.urlretrieve(base + name, name)',
    };
  }

  /* ── The JSON view ─────────────────────────────────────────────────────
     The files are one line each. On the page they are shown one field per
     line, with a space after every comma so that a long array wraps at a
     space and not in the middle of a number. The result is still valid JSON
     with the same content; the test parses it back and compares. */
  function kompakt(v) {
    if (Array.isArray(v)) return '[' + v.map(kompakt).join(', ') + ']';
    if (v && typeof v === 'object') {
      return '{ ' + Object.keys(v).map(function (k) { return JSON.stringify(k) + ': ' + kompakt(v[k]); }).join(', ') + ' }';
    }
    return JSON.stringify(v);
  }

  function jePrimitiv(v) { return v === null || typeof v !== 'object'; }

  function formatuj(j) {
    return Object.keys(j).map(function (k) {
      var v = j[k];
      var hlava = '  ' + JSON.stringify(k) + ': ';
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        var riadok = kompakt(v);
        var kratke = riadok.length <= 64 && Object.keys(v).every(function (kk) { return jePrimitiv(v[kk]); });
        if (!kratke) {
          return { pole: k, text: hlava + '{\n' + Object.keys(v).map(function (kk) {
            return '    ' + JSON.stringify(kk) + ': ' + kompakt(v[kk]);
          }).join(',\n') + '\n  }' };
        }
        return { pole: k, text: hlava + riadok };
      }
      return { pole: k, text: hlava + kompakt(v) };
    });
  }

  function formatujText(j) {
    return '{\n' + formatuj(j).map(function (r) { return r.text; }).join(',\n') + '\n}';
  }

  /* ── What every field means ────────────────────────────────────────────
     Checked against the files on 24 September 2026: every hares file has
     knight true, every herons cell is part of a path, every file has
     uniqueSolution true. */
  var GIVENS = {
    hares: 'The digits printed at the start, n × n in reading order. 0 is an empty cell.',
    squirrels: 'Every cell, n × n in reading order. null is a hollow to fill in; { r, d } is a trunk, where r is the sum of the run to its right and d the sum of the run below it, or null when there is none.',
    hedgehogs: 'n rows of n numbers: the flowerbed every cell belongs to, counted from 0.',
    otters: 'Every patch, n × n in reading order: 0 to 3 for a numbered patch, null for a patch with no number.',
    swans: 'Every cell, n × n in reading order: 0 is empty, 1 is a white swan, 2 is a black swan.',
    voles: 'Every cell, n × n in reading order: the size of the island whose number stands there, or null.',
    herons: 'Every cell, n × n in reading order: 0 is empty, any other number is the pair whose nest is there.',
  };
  var GRID = {
    badgers: 'cages lists every dotted cage as { sum, cells }: what it adds up to, and its cells as places in reading order, counted from 0.',
    magpies: 'clues holds rows and cols: the block lengths for every row from the top and for every column from the left.',
    cranes: 'islands lists every sandbank as { r, c, n }: its row and column, counted from 0, and how many walkways leave it.',
    hedgehogs: 'stars is how many hedgehogs go in every row, every column and every flowerbed.',
    hares: 'rules says which rules are in force. knight is always true; king true adds that equal numbers may not touch, corners included.',
    herons: 'pairs is how many pairs of nests the marsh has.',
  };
  var RIESENIE = {
    badgers: 'cells is the finished grid, n × n digits in reading order.',
    hares: 'cells is the finished grid, n × n digits in reading order.',
    squirrels: 'cells is n × n in reading order: the digit in every hollow, 0 on a trunk.',
    magpies: 'cells is n × n in reading order: 1 for a filled cell, 0 for an empty one.',
    hedgehogs: 'cells is n × n in reading order: 1 where a hedgehog sits, 0 everywhere else.',
    voles: 'cells is n × n in reading order: 1 for water, 0 for island.',
    herons: 'cells is n × n in reading order: the pair whose path runs through each cell.',
    otters: 'h and v are the horizontal and the vertical pieces of grid line, in reading order: 1 where the river runs, 0 where it does not.',
    swans: 'h and v are the links between neighbouring cells, across and down, in reading order: 1 where the loop runs.',
    cranes: 'bridges lists every walkway as { a, b, k }: it joins sandbanks a and b, their places in grid.islands, and k is 1 or 2.',
  };

  function skratka(v) {
    if (Array.isArray(v)) return '[' + v.length + ']';
    if (v && typeof v === 'object') return '{…}';
    if (typeof v === 'string') return v.length > 16 ? '"…"' : JSON.stringify(v);
    return String(v);
  }

  function hodnota(k, v) {
    if (Array.isArray(v)) {
      if (v.length && Array.isArray(v[0])) return v.length + ' rows of ' + v[0].length;
      return v.length + ' values';
    }
    if (v && typeof v === 'object') {
      if (k === 'svg') return Object.keys(v).map(function (kk) { return v[kk]; }).join(', ');
      return '{ ' + Object.keys(v).map(function (kk) { return kk + ': ' + skratka(v[kk]); }).join(', ') + ' }';
    }
    if (typeof v === 'string') return v.length > 44 ? v.slice(0, 42) + '…' : v;
    return String(v);
  }

  function popis(k, j) {
    var d = druh(j.kind);
    switch (k) {
      case 'v': return 'The schema version. It stays 1: a change that would break your code gets a new folder, v2, and v1 stays where it is.';
      case 'kind': return d ? 'Our name for the kind. ' + d.name + ' are ' + d.type + ' puzzles.' : 'Our name for the kind.';
      case 'difficulty': return 'easy, medium or hard. index.json lists the grid sizes of each.';
      case 'id': return 'Kind, difficulty and number in one string. The widget takes it as id.';
      case 'date': return 'The day on which this is the daily game, in Bratislava time.';
      case 'game': return 'The daily game this puzzle comes from.';
      case 'seed': return 'The exact key the puzzle was generated from, so the file can be rebuilt byte for byte. You never need it.';
      case 'size': return 'n, the side of the grid: this one is ' + j.size + ' by ' + j.size + '.';
      case 'rules': return 'The puzzle type and a link to the full rules, written for players.';
      case 'givens': return GIVENS[j.kind] || 'The clues as one flat array.';
      case 'grid': return GRID[j.kind] || 'The clues that are not a flat array.';
      case 'solution': return RIESENIE[j.kind] || 'The answer.';
      case 'verified': return 'uniqueSolution is true in every file: a puzzle that failed the check was never written. solverMs is how long the check took, in milliseconds.';
      case 'licence': return 'Both licences, so the terms travel with the file: free with the credit line, commercial with Bulletin Pro.';
      case 'svg': return 'The two drawings that sit next to this file: the puzzle and its solution.';
      default: return '';
    }
  }

  function polia(j) {
    return Object.keys(j).map(function (k) {
      return { pole: k, hodnota: hodnota(k, j[k]), popis: popis(k, j) };
    });
  }

  var api = {
    WEB: WEB, API: API, DRUHY: DRUHY, OBTIAZNOSTI: OBTIAZNOSTI, POCET: POCET,
    druh: druh, tri: tri, stav: stav, cesty: cesty, naWebe: naWebe, ukazky: ukazky,
    formatuj: formatuj, formatujText: formatujText, polia: polia,
  };
  koren.ArlingApi = api;
})(typeof window !== 'undefined' ? window : globalThis);
