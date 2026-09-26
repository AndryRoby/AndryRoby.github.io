/* Little Island Zoo: the drawing, checked without a browser.
   A fake 2D canvas records every call; the tests print both islands and every animal
   through it (Chrome path and the Firefox path, where lines become fills) and fail on
   a thrown error or a NaN coordinate. Plus the geometry: habitats never overlap, stand
   on the island and off the path.
   node --test products/arling-sk/games/zoo/tests-scena.mjs */
import { test } from 'node:test';
import assert from 'node:assert/strict';

/* ── a fake canvas ─────────────────────────────────────────────────────── */
let volania = 0, zle = [];
const cislo = (x, meno) => { if (typeof x === 'number' && !Number.isFinite(x)) zle.push(meno); };
class Cesta {
  constructor() { this.n = 0; }
  moveTo(x, y) { cislo(x, 'moveTo'); cislo(y, 'moveTo'); this.n++; }
  lineTo(x, y) { cislo(x, 'lineTo'); cislo(y, 'lineTo'); this.n++; }
  quadraticCurveTo(a, b, x, y) { [a, b, x, y].forEach(v => cislo(v, 'quad')); this.n++; }
  bezierCurveTo(a, b, c, d, x, y) { [a, b, c, d, x, y].forEach(v => cislo(v, 'bezier')); this.n++; }
  arc(x, y, r) { cislo(x, 'arc'); cislo(y, 'arc'); cislo(r, 'arc'); if (r < 0) zle.push('arc r<0'); this.n++; }
  ellipse(x, y, rx, ry) { [x, y, rx, ry].forEach(v => cislo(v, 'ellipse')); if (rx < 0 || ry < 0) zle.push('ellipse r<0'); this.n++; }
  rect(x, y, w, h) { [x, y, w, h].forEach(v => cislo(v, 'rect')); }
  closePath() {}
}
class Ctx extends Cesta {
  constructor(canvas) {
    super();
    Object.assign(this, { canvas, globalAlpha: 1, globalCompositeOperation: 'source-over', fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, lineCap: 'butt', lineJoin: 'miter', miterLimit: 10, lineDashOffset: 0, font: '10px x', textAlign: 'left', textBaseline: 'alphabetic', imageSmoothingEnabled: true });
    this._dash = [];
  }
  createImageData(w, h) { return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h }; }
  putImageData() {}
  createPattern() { return { setTransform() {} }; }
  createRadialGradient() { return { addColorStop() {} }; }
  drawImage() { volania++; }
  fillRect(x, y, w, h) { [x, y, w, h].forEach(v => cislo(v, 'fillRect')); volania++; }
  clearRect() {}
  beginPath() {}
  fill() { volania++; }
  stroke() { volania++; }
  clip() {}
  save() {} restore() {}
  translate(x, y) { cislo(x, 'translate'); cislo(y, 'translate'); }
  scale(x, y) { cislo(x, 'scale'); cislo(y, 'scale'); }
  rotate(a) { cislo(a, 'rotate'); }
  transform(...a) { a.forEach(v => cislo(v, 'transform')); }
  setTransform(...a) { a.forEach(v => cislo(v, 'setTransform')); }
  getTransform() { return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }; }
  setLineDash(d) { this._dash = d; }
  getLineDash() { return this._dash; }
  measureText(s) { return { width: s.length * 5, actualBoundingBoxLeft: s.length * 2.5, actualBoundingBoxRight: s.length * 2.5, actualBoundingBoxAscent: 5, actualBoundingBoxDescent: 2 }; }
  fillText(s, x, y) { cislo(x, 'fillText'); cislo(y, 'fillText'); volania++; }
}
class Platno {
  constructor() { this.width = 300; this.height = 150; this._c = null; }
  getContext() { return this._c || (this._c = new Ctx(this)); }
  addEventListener() {}
}
globalThis.document = { createElement: () => new Platno() };
globalThis.Path2D = Cesta;
globalThis.DOMMatrix = class { constructor(m) { this.m = m; } };

const { Pen, OPT } = await import('../village/riso.js?v=3');
const S = await import('./scena.js?v=1');
const E = await import('./ekonomika.mjs');

function pero() { const cv = new Platno(); const p = new Pen(cv.getContext('2d')); p.scale(1.5); return p; }
function parcely(ostrov, stavy) {
  const o = E.ostrov(ostrov);
  return o.druhy.map((id, i) => ({ id, meno: E.ZVIERATA[id].meno, stav: stavy[i] }));
}

for (const firefox of [false, true]) {
  test(`both islands print without errors (${firefox ? 'Firefox path' : 'Chrome path'})`, () => {
    OPT.fillStrokes = firefox;
    for (const ostrov of [0, 1, 2, 5]) {
      const W = S.postav(ostrov);
      for (const stavy of [
        ['built', 'next', 'empty', 'empty', 'empty', 'empty', 'empty'],
        ['built', 'built', 'built', 'built', 'built', 'built', 'built'],
        ['built', 'built', 'built', 'next', 'empty', 'empty', 'empty']
      ]) {
        zle = []; volania = 0;
        const p = pero();
        S.kresliStaticke(p, W, parcely(ostrov, stavy), -1);
        S.kresliStaticke(p, W, parcely(ostrov, stavy), 2);
        assert.deepEqual(zle, [], `island ${ostrov}: NaN in ${zle.slice(0, 3)}`);
        assert.ok(volania > 200, `island ${ostrov} printed only ${volania} calls`);
      }
    }
    OPT.fillStrokes = false;
  });

  test(`every animal, person, box and ring draws with finite numbers (${firefox ? 'Firefox path' : 'Chrome path'})`, () => {
    OPT.fillStrokes = firefox;
    zle = [];
    const p = pero();
    for (const id of Object.keys(E.ZVIERATA)) {
      const D = S.DRUH[id];
      assert.ok(D, `no drawing for ${id}`);
      for (const [g, t, n, voda] of [[0, 0, 0, false], [0.5, 3.3, 1, true], [1, 12.3, 2, false], [0, 100.7, 5, true]]) {
        D.kresli(p, 10, 20, D.s, n % 2 ? 1 : -1, 0.5, n === 2, g, t, n, voda);
      }
    }
    for (const v of [0, 1, 7]) S.osoba(p, 5, 5, 'blue', v * 1.3, v === 7, v === 1 ? 'sun' : null, v);
    for (const f of [0, 0.4, 1, 1.5]) S.schranka(p, 0, 0, f, f >= 1);
    for (const a of [0, 0.5, 0.99]) S.kruh(p, 0, 0, a);
    for (let k = 0; k < 7; k++) for (const stav of ['built', 'next', 'empty']) S.kresliParcelu(p, k, { id: E.ostrov(k % 2).druhy[k], meno: 'Hedgehogs', stav });
    assert.deepEqual(zle, [], `NaN in ${zle.slice(0, 3)}`);
    OPT.fillStrokes = false;
  });
}

test('geometry: seven habitats that never overlap, all on the island, off the ring path', () => {
  for (let a = 0; a < 7; a++) for (let b = a + 1; b < 7; b++) {
    const [ai, aj] = S.plotCenter(a), [bi, bj] = S.plotCenter(b);
    const gap = Math.max(Math.abs(ai - bi), Math.abs(aj - bj)) - S.PLOT_W;
    assert.ok(gap > 0.15, `habitats ${a} and ${b} overlap (gap ${gap.toFixed(2)})`);
  }
  for (let seed = 0; seed < 40; seed++) {
    for (let k = 0; k < 7; k++) {
      const [ci, cj] = S.plotCenter(k), h = S.PLOT_W / 2;
      for (const [u, v] of [[-h, -h], [h, -h], [h, h], [-h, h]]) {
        const di = ci + u - S.C[0], dj = cj + v - S.C[1];
        const r = Math.hypot(di, dj), edge = S.edgeR(Math.atan2(dj, di), 7 + seed * 13);
        assert.ok(r < edge - 0.15, `island ${seed}: corner of habitat ${k} over the edge (${r.toFixed(2)} vs ${edge.toFixed(2)})`);
      }
      const [bi, bj] = S.boxAt(k);
      assert.ok(Math.hypot(bi - S.C[0], bj - S.C[1]) > S.RING + 0.3, `box ${k} stands on the ring path`);
    }
  }
  for (let k = 0; k < 7; k++) {
    const [ci, cj] = S.plotCenter(k), h = S.PLOT_W / 2;
    const nearest = Math.hypot(Math.max(Math.abs(ci - S.C[0]) - h, 0), Math.max(Math.abs(cj - S.C[1]) - h, 0));
    assert.ok(nearest > S.RING + 0.25, `habitat ${k} reaches the ring path`);
  }
});

test('the island is the same on every build (no randomness)', () => {
  const a = S.postav(3), b = S.postav(3);
  assert.deepEqual(a.top, b.top);
  assert.deepEqual(a.bb, b.bb);
  assert.equal(a.deco.length, b.deco.length);
  assert.notDeepEqual(S.postav(0).top, S.postav(1).top, 'each island has its own shape');
});
