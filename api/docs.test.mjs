/* Tests for /api/: every address the page shows or builds must be a real file.
 *
 *   node --test products/arling-sk/api/docs.test.mjs
 *
 * What it checks, without a browser and without the network:
 *   1. every puzzle address written in index.html (https://arling.sk/api/...,
 *      /api/..., ./puzzles/...) and every widget address is a file under
 *      api/puzzles/ or embed/puzzle/;
 *   2. every address that ukazky.js can build, for all 10 kinds, 3
 *      difficulties and 200 numbers, is a file;
 *   3. the samples, the JSON view and the field list written into the HTML
 *      for otters-easy-001 are exactly what ukazky.js builds, so the page
 *      without JavaScript shows the same thing as the page with it;
 *   4. the JSON view is valid JSON with the file's content;
 *   5. page hygiene: no em or en dash, JSON-LD parses and its questions are
 *      the questions on the page, the CSP hashes match the inline blocks, no
 *      inline script, handler or style attribute, and the ?v= of api.css,
 *      ukazky.js and docs.js is the fingerprint of their content.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const TU = dirname(fileURLToPath(import.meta.url));      // products/arling-sk/api
const HUB = join(TU, '..');                               // products/arling-sk
const HTML = readFileSync(join(TU, 'index.html'), 'utf8').split('\r\n').join('\n');

const ctx = {};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(readFileSync(join(TU, 'ukazky.js'), 'utf8'), ctx);
const A = ctx.ArlingApi;

const INDEX = JSON.parse(readFileSync(join(TU, 'puzzles', 'v1', 'index.json'), 'utf8'));

const dekoduj = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const bezZnaciek = (s) => s.replace(/<[^>]+>/g, '');

/* A site path (/api/..., /embed/..., /games/...) to a file on disk. A folder
   counts when it has an index.html, the way GitHub Pages serves it. */
function naDisku(cesta) {
  const bezDotazu = cesta.split('#')[0].split('?')[0];
  const p = join(HUB, ...bezDotazu.split('/').filter(Boolean));
  if (bezDotazu.endsWith('/')) return existsSync(join(p, 'index.html'));
  return existsSync(p) && statSync(p).isFile();
}

/* Every puzzle and widget address in a piece of HTML, as a site path. It works
   on the escaped HTML on purpose: a template like today/&lt;kind&gt;.json is
   then easy to tell from a real address followed by a closing tag. */
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function adresy(html) {
  const von = new Set();
  const vzory = [
    /https:\/\/arling\.sk(\/api\/puzzles\/[^\s"'<>`)]+)/g,
    /https:\/\/arling\.sk(\/embed\/puzzle\/[^\s"'<>`)]*)/g,
    /(?:href|src)="(\/api\/puzzles\/[^"]+)"/g,
    /(?:href|src)="(\/embed\/puzzle\/[^"]*)"/g,
    /(?:href|src)="\.\/(puzzles\/[^"]+)"/g,
    /(?:href|src)="(\/games\/[a-z]+\/guide\/)"/g,
    /[\s>](\/api\/puzzles\/v1\/[^\s"'<>`)]+)/g,
  ];
  for (const re of vzory) {
    for (const m of html.matchAll(re)) {
      if (m[1].includes('&lt;') || m[1].includes('{')) continue;   // šablóna, nie adresa
      let a = dekoduj(m[1]);
      if (a.startsWith('puzzles/')) a = '/api/' + a;
      a = a.replace(/[.,;:]+$/, '');
      von.add(a);
    }
  }
  return [...von];
}

/* A widget address must name a puzzle that exists. */
function overWidget(a) {
  const q = new URL(a, 'https://arling.sk').searchParams;
  const kind = q.get('kind'), difficulty = q.get('difficulty'), id = q.get('id');
  if (!id) return;
  const m = /^([a-z]+)-(easy|medium|hard)-(\d{3})$/.exec(id);
  assert.ok(m, 'widget id má tvar druh-obtiaznost-nnn: ' + a);
  assert.equal(m[1], kind, 'widget kind sedí s id: ' + a);
  assert.equal(m[2], difficulty, 'widget difficulty sedí s id: ' + a);
  assert.ok(naDisku('/api/puzzles/v1/' + kind + '/' + difficulty + '/' + m[3] + '.json'), 'widget id vedie na súbor: ' + a);
}

function overVsetky(zoznam, odkial) {
  assert.ok(zoznam.length > 0, 'nejaké adresy v ' + odkial);
  for (const a of zoznam) {
    assert.ok(naDisku(a), a + ' (z ' + odkial + ') nie je súbor pod products/arling-sk');
    if (a.startsWith('/embed/puzzle/')) overWidget(a);
  }
}

test('every puzzle and widget address written in index.html is a real file', () => {
  const zoznam = adresy(HTML);
  overVsetky(zoznam, 'index.html');
  // aspoň tie, ktoré stránka naozaj ukazuje
  for (const nutne of ['/api/puzzles/v1/otters/easy/001.json', '/api/puzzles/v1/otters/easy/001.svg',
    '/api/puzzles/v1/otters/easy/001-solution.svg', '/api/puzzles/v1/otters/easy/index.json',
    '/api/puzzles/v1/today/otters.json', '/embed/puzzle/embed.js']) {
    assert.ok(zoznam.includes(nutne), 'stránka ukazuje ' + nutne);
  }
});

test('every address ukazky.js can build is a real file, for all 6000 puzzles', () => {
  let pocet = 0;
  for (const d of A.DRUHY) {
    for (const o of A.OBTIAZNOSTI) {
      for (let n = 1; n <= A.POCET; n++) {
        const s = A.stav(d.kind, o, n);
        const c = A.cesty(s);
        for (const k of ['json', 'svg', 'solution', 'list', 'today', 'index', 'embedJs']) {
          assert.ok(naDisku(c[k]), c[k]);
          pocet++;
        }
        assert.ok(naDisku(c.widget), c.widget);
        overWidget(c.widget);
        // úryvky celé len pre okraje a jedno číslo v strede, inak by test bežal zbytočne dlho
        if (n === 1 || n === 100 || n === A.POCET) {
          const u = A.ukazky(s);
          for (const k of Object.keys(u)) overVsetky(adresy(esc(u[k])), k + ' pre ' + s.id);
        }
      }
    }
  }
  assert.equal(pocet, 10 * 3 * 200 * 7);
});

test('the JSON field svg names files that sit next to the JSON', () => {
  for (const d of A.DRUHY) {
    for (const o of A.OBTIAZNOSTI) {
      for (const n of [1, 200]) {
        const s = A.stav(d.kind, o, n);
        const c = A.cesty(s);
        const j = JSON.parse(readFileSync(join(HUB, ...c.json.split('/').filter(Boolean)), 'utf8'));
        assert.equal(j.id, s.id);
        const zlozka = c.json.slice(0, c.json.lastIndexOf('/') + 1);
        assert.equal(zlozka + j.svg.puzzle, c.svg);
        assert.equal(zlozka + j.svg.solution, c.solution);
      }
    }
  }
});

test('stav() clamps and falls back instead of building a missing address', () => {
  assert.equal(A.stav('otters', 'easy', 0).id, 'otters-easy-001');
  assert.equal(A.stav('otters', 'easy', 999).id, 'otters-easy-200');
  assert.equal(A.stav('nope', 'nope', 'x').id, 'otters-easy-001');
  assert.equal(A.stav('cranes', 'hard', '42').nnn, '042');
});

test('the kinds, names and types match index.json and the select on the page', () => {
  const zIndexu = Object.fromEntries(INDEX.kinds.map((k) => [k.kind, k]));
  assert.equal(A.DRUHY.length, 10);
  for (const d of A.DRUHY) {
    assert.ok(zIndexu[d.kind], d.kind);
    assert.equal(zIndexu[d.kind].name, d.name);
    assert.equal(zIndexu[d.kind].type, d.type);
    assert.ok(naDisku('/games/' + d.kind + '/guide/'), 'návod pre ' + d.kind);
  }
  const moznosti = [...HTML.matchAll(/<option value="([a-z]+)"[^>]*>([^<]+)<\/option>/g)];
  const druhy = moznosti.filter((m) => zIndexu[m[1]]);
  assert.equal(druhy.length, 10);
  for (const m of druhy) assert.equal(m[2], zIndexu[m[1]].name + ', ' + zIndexu[m[1]].type);
});

test('the samples written in the HTML are exactly what ukazky.js builds for otters-easy-001', () => {
  const u = A.ukazky(A.stav('otters', 'easy', 1));
  for (const k of Object.keys(u)) {
    const m = HTML.match(new RegExp('<pre class="kod" id="kod-' + k + '">([\\s\\S]*?)</pre>'));
    assert.ok(m, 'pre#kod-' + k + ' je v HTML');
    assert.equal(dekoduj(m[1]), u[k], 'úryvok ' + k);
  }
});

test('the JSON view and the field list in the HTML match the file and ukazky.js', () => {
  const j = JSON.parse(readFileSync(join(TU, 'puzzles', 'v1', 'otters', 'easy', '001.json'), 'utf8'));
  const m = HTML.match(/<pre class="kod json" id="json-vystup"[^>]*>([\s\S]*?)<\/pre>/);
  assert.ok(m);
  const text = dekoduj(bezZnaciek(m[1]));
  assert.equal(text, A.formatujText(j));
  assert.deepEqual(JSON.parse(text), j);
  const velkost = HTML.match(/<span id="json-velkost">(\d+) bytes<\/span>/);
  assert.equal(Number(velkost[1]), statSync(join(TU, 'puzzles', 'v1', 'otters', 'easy', '001.json')).size);

  const dl = HTML.match(/<dl class="polia" id="polia">([\s\S]*?)<\/dl>/)[1];
  const riadky = [...dl.matchAll(/<div data-pole="([^"]+)"><dt><code>([^<]+)<\/code><span class="hodnota">([^<]*)<\/span><\/dt><dd>([^<]*)<\/dd><\/div>/g)];
  const polia = A.polia(j);
  assert.equal(riadky.length, polia.length);
  polia.forEach((p, i) => {
    assert.equal(riadky[i][1], p.pole);
    assert.equal(dekoduj(riadky[i][3]), p.hodnota);
    assert.equal(dekoduj(riadky[i][4]), p.popis);
  });

  const pravidla = HTML.match(/<ol id="pravidla">([\s\S]*?)<\/ol>/)[1];
  const otters = INDEX.kinds.find((k) => k.kind === 'otters');
  assert.deepEqual([...pravidla.matchAll(/<li>([^<]*)<\/li>/g)].map((x) => dekoduj(x[1])), otters.rules);
});

test('the JSON view is valid JSON with the same content for every kind, and every field is explained', () => {
  for (const d of A.DRUHY) {
    for (const o of A.OBTIAZNOSTI) {
      const c = A.cesty(A.stav(d.kind, o, 7));
      const j = JSON.parse(readFileSync(join(HUB, ...c.json.split('/').filter(Boolean)), 'utf8'));
      assert.deepEqual(JSON.parse(A.formatujText(j)), j, c.json);
      for (const p of A.polia(j)) {
        assert.ok(p.popis.length > 10, 'popis poľa ' + p.pole + ' pre ' + d.kind);
        assert.ok(p.hodnota.length > 0, 'hodnota poľa ' + p.pole + ' pre ' + d.kind);
      }
    }
  }
  const dnes = JSON.parse(readFileSync(join(TU, 'puzzles', 'v1', 'today', 'otters.json'), 'utf8'));
  for (const p of A.polia(dnes)) assert.ok(p.popis.length > 10, 'today: ' + p.pole);
});

test('no em dash or en dash in the page and its scripts', () => {
  for (const f of ['index.html', 'ukazky.js', 'docs.js', 'api.css']) {
    const t = readFileSync(join(TU, f), 'utf8');
    assert.ok(!/[–—]/.test(t), f + ' obsahuje pomlčku');
  }
});

test('JSON-LD parses and its questions are the questions on the page, in order', () => {
  const bloky = [...HTML.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  const faq = bloky.find((b) => b['@type'] === 'FAQPage');
  assert.ok(faq);
  const sekcia = HTML.match(/<section id="otazky"[\s\S]*?<\/section>/)[0];
  const otazky = [...sekcia.matchAll(/<summary>([^<]+)<\/summary><p>([\s\S]*?)<\/p><\/details>/g)];
  assert.deepEqual(otazky.map((m) => dekoduj(m[1])), faq.mainEntity.map((q) => q.name));
  // odpovede v JSON-LD sú text stránky bez značiek (EUR namiesto znaku €)
  otazky.forEach((m, i) => {
    const naStranke = dekoduj(bezZnaciek(m[2])).replace(/€/g, 'EUR').replace(/\s+/g, ' ');
    assert.equal(faq.mainEntity[i].acceptedAnswer.text, naStranke, 'odpoveď ' + (i + 1));
  });
});

test('CSP: only scripts from this site, and the hashes match the inline JSON-LD', () => {
  const csp = HTML.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
  const src = csp.match(/script-src ([^;]+)/)[1];
  const vlozene = [...HTML.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)];
  for (const m of vlozene) {
    assert.match(m[1], /type="application\/ld\+json"/, 'jediný vložený skript je JSON-LD');
    const h = "'sha256-" + createHash('sha256').update(m[2], 'utf8').digest('base64') + "'";
    assert.ok(src.includes(h), 'CSP pozná ' + h);
  }
  const znacky = HTML.match(/<[a-z][^>]*>/gi) || [];
  for (const z of znacky) {
    assert.ok(!/\son[a-z]+=/i.test(z), 'inline handler: ' + z.slice(0, 80));
    assert.ok(!/\sstyle=/i.test(z), 'inline style: ' + z.slice(0, 80));
  }
  for (const m of HTML.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)) {
    // Jediný cudzí skript je naša Umami analytika na homelabe (vkladá ops/design/obal.mjs).
    const umami = m[1] === 'https://homelab.tailbf8f27.ts.net/script.js';
    assert.ok(m[1].startsWith('/') || m[1].startsWith('./') || umami, 'skript z tohto webu: ' + m[1]);
  }
});

test('the ?v= of the page\'s own files is the fingerprint of their content', () => {
  const odkazy = [...HTML.matchAll(/(?:href|src)="\.\/(api\.css|ukazky\.js|docs\.js)\?v=([0-9a-f]{8})"/g)];
  assert.equal(odkazy.length, 3, 'api.css, ukazky.js a docs.js majú ?v=');
  for (const [, subor, v] of odkazy) {
    const obsah = readFileSync(join(TU, subor), 'utf8').split('\r\n').join('\n');
    assert.equal(v, createHash('sha256').update(obsah, 'utf8').digest('hex').slice(0, 8), subor + ': ?v= nesedí, prepočítaj ho');
  }
});

test('ids the scripts need are in the page, once each', () => {
  const potrebne = ['nahlad', 'v-kind', 'v-index', 'v-pred', 'v-dalsi', 'v-nahodny', 'v-stav', 'img-zadanie', 'img-riesenie',
    'stiahni-zadanie', 'stiahni-riesenie', 'adresa-json', 'otvor-json', 'odkaz-dnes', 'json-vystup', 'json-velkost', 'polia',
    'pravidla', 'odkaz-navod', 'kod-id', 'sprava', 'kredit',
    'kod-iframe', 'kod-script', 'kod-img', 'kod-js', 'kod-curl', 'kod-python', 'kod-spravy',
    'vystup-iframe', 'vystup-script', 'vystup-img', 'vystup-js'];
  for (const id of potrebne) {
    const n = (HTML.match(new RegExp('\\sid="' + id + '"', 'g')) || []).length;
    assert.equal(n, 1, 'id="' + id + '"');
  }
  for (const m of HTML.matchAll(/data-kopiruj="([^"]+)"/g)) assert.ok(potrebne.includes(m[1]), 'kopíruje ' + m[1]);
  for (const m of HTML.matchAll(/aria-controls="([^"]+)"/g)) {
    assert.equal((HTML.match(new RegExp('\\sid="' + m[1] + '"', 'g')) || []).length, 1, 'aria-controls ' + m[1]);
  }
  for (const m of HTML.matchAll(/data-karta="([^"]+)"/g)) assert.ok(HTML.includes('id="' + m[1] + '"'), 'karta ' + m[1]);
});
