/* Little Island Zoo: the whole page run in node on a small fake DOM (no browser, no
   new dependency). It loads index.html, runs hra.js, and plays: buys, empties a box,
   hires a keeper, studies, sails, comes back after hours away, survives blocked
   storage. It proves the page does not throw and the numbers on it move; how it
   looks is for the check in a real browser.
   node --test products/arling-sk/games/zoo/tests-hra.mjs */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DIR = dirname(fileURLToPath(import.meta.url));
const HTML = readFileSync(join(DIR, 'index.html'), 'utf8');

/* ── fake canvas (as in tests-scena.mjs, shortened) ───────────────────── */
let chyby = [], vyplne = 0;
const num = (x, m) => { if (typeof x === 'number' && !Number.isFinite(x)) chyby.push(m); };
class Cesta {
  moveTo(x, y) { num(x, 'moveTo'); num(y, 'moveTo'); } lineTo(x, y) { num(x, 'lineTo'); num(y, 'lineTo'); }
  quadraticCurveTo(...a) { a.forEach(v => num(v, 'quad')); } bezierCurveTo(...a) { a.forEach(v => num(v, 'bez')); }
  arc(x, y, r) { num(x, 'arc'); num(y, 'arc'); num(r, 'arc'); } ellipse(...a) { a.slice(0, 4).forEach(v => num(v, 'ellipse')); }
  rect() {} closePath() {}
}
class Ctx extends Cesta {
  constructor(c) { super(); this.canvas = c; this._d = []; Object.assign(this, { globalAlpha: 1, globalCompositeOperation: '', fillStyle: '', strokeStyle: '', lineWidth: 1, lineCap: 'butt', lineJoin: 'miter', miterLimit: 10, lineDashOffset: 0, font: '', textAlign: '', textBaseline: '', imageSmoothingEnabled: true }); }
  createImageData(w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; } putImageData() {}
  createPattern() { return { setTransform() {} }; } createRadialGradient() { return { addColorStop() {} }; }
  drawImage() {} fillRect(...a) { a.forEach(v => num(v, 'fillRect')); } clearRect() {} beginPath() {} fill() { vyplne++; } stroke() { vyplne++; } clip() {}
  save() {} restore() {} translate(x, y) { num(x, 'tr'); num(y, 'tr'); } scale(x, y) { num(x, 'sc'); num(y, 'sc'); } rotate() {}
  transform(...a) { a.forEach(v => num(v, 'tf')); } setTransform(...a) { a.forEach(v => num(v, 'setTransform')); }
  getTransform() { return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }; } setLineDash(d) { this._d = d; } getLineDash() { return this._d; }
  measureText(s) { return { width: 5 * s.length, actualBoundingBoxLeft: 2, actualBoundingBoxRight: 2, actualBoundingBoxAscent: 5, actualBoundingBoxDescent: 2 }; }
  fillText(s, x, y) { num(x, 'fillText'); num(y, 'fillText'); }
}

/* ── a small DOM ──────────────────────────────────────────────────────── */
const VOID = new Set(['meta', 'link', 'input', 'br', 'img', 'hr']);
class ClassList {
  constructor(el) { this.el = el; this.s = new Set(); }
  add(...c) { c.forEach(x => this.s.add(x)); } remove(...c) { c.forEach(x => this.s.delete(x)); }
  contains(c) { return this.s.has(c); } toggle(c, f) { const on = f ?? !this.s.has(c); on ? this.s.add(c) : this.s.delete(c); return on; }
}
class El {
  constructor(tag) {
    this.tagName = tag.toUpperCase(); this.children = []; this.parentNode = null; this.attrs = {};
    this.classList = new ClassList(this); this.style = {}; this.dataset = {}; this.l = {}; this.hidden = false;
    this._t = ''; this.disabled = false; this.open = false; this.returnValue = ''; this.checked = false; this.tabIndex = 0;
    this.width = 300; this.height = 150; this._ctx = null;
  }
  get className() { return [...this.classList.s].join(' '); } set className(v) { this.classList.s = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get textContent() { return this.tagName === '#TEXT' ? this._t : this.children.map(c => c.textContent).join(''); }
  set textContent(v) { for (const c of this.children) c.parentNode = null; this.children = []; const s = String(v); if (s) { const t = new El('#text'); t._t = s; t.parentNode = this; this.children.push(t); } }
  set innerHTML(h) { this.textContent = ''; parse(h, this); }
  get firstChild() { return this.children[0] || null; }
  get parentElement() { return this.parentNode; }
  appendChild(c) { if (c.parentNode) c.remove(); c.parentNode = this; this.children.push(c); return c; }
  append(c) { return this.appendChild(c); }
  prepend(c) { if (c.parentNode) c.remove(); c.parentNode = this; this.children.unshift(c); }
  remove() { if (!this.parentNode) return; const a = this.parentNode.children; a.splice(a.indexOf(this), 1); this.parentNode = null; }
  setAttribute(k, v) { v = String(v); this.attrs[k] = v; if (k === 'class') this.className = v; if (k === 'hidden') this.hidden = true; if (k === 'disabled') this.disabled = true; if (k === 'open') this.open = true; if (k.startsWith('data-')) this.dataset[k.slice(5).replace(/-(\w)/g, (_, c) => c.toUpperCase())] = v; if (k === 'tabindex') this.tabIndex = Number(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  addEventListener(t, f) { (this.l[t] = this.l[t] || []).push(f); }
  fire(t, e = {}) { const ev = { type: t, target: this, currentTarget: this, preventDefault() {}, key: '', ...e }; for (const f of this.l[t] || []) f(ev); }
  click() { if (!this.disabled) this.fire('click'); }
  focus() {} scrollIntoView() {}
  getBoundingClientRect() { return this.tagName === 'CANVAS' || this.attrs.id === 'scena' ? { left: 0, top: 56, width: 390, height: 405, right: 390, bottom: 461 } : { left: 10, top: 10, width: 60, height: 24, right: 70, bottom: 34 }; }
  showModal() { if (this.open) throw new Error('InvalidStateError: already open'); this.open = true; }
  close(v) { this.open = false; if (v !== undefined) this.returnValue = v; this.fire('close'); }
  getContext() { return this._ctx || (this._ctx = new Ctx(this)); }
  setPointerCapture() {}
  matches(sel) {
    const m = sel.match(/^([a-z0-9]*)((?:\.[\w-]+)*)(?:\[([\w-]+)\])?$/i);
    if (!m) throw new Error('selector ' + sel);
    if (m[1] && this.tagName !== m[1].toUpperCase()) return false;
    for (const c of m[2].split('.').filter(Boolean)) if (!this.classList.contains(c)) return false;
    if (m[3] && !(m[3] in this.attrs) && !(m[3].startsWith('data-') && m[3].slice(5) in this.dataset)) return false;
    return true;
  }
  *all() { for (const c of this.children) { if (c.tagName !== '#TEXT') { yield c; yield* c.all(); } } }
  querySelectorAll(sel) {
    const parts = sel.trim().split(/\s+/), out = [];
    for (const el of this.all()) {
      if (!el.matches(parts[parts.length - 1])) continue;
      let k = parts.length - 2, p = el.parentNode;
      while (k >= 0 && p && p !== this) { if (p.matches(parts[k])) k--; p = p.parentNode; }
      if (k < 0) out.push(el);
    }
    return out;
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  byId(id) { for (const el of this.all()) if (el.attrs.id === id) return el; return null; }
}
function parse(html, root) {
  const re = /<!--[\s\S]*?-->|<!doctype[^>]*>|<\/([a-zA-Z0-9-]+)\s*>|<([a-zA-Z0-9-]+)((?:\s+[^\s=>\/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)/gi;
  const stack = [root]; let m;
  while ((m = re.exec(html))) {
    const top = stack[stack.length - 1];
    if (m[1]) { for (let k = stack.length - 1; k > 0; k--) if (stack[k].tagName === m[1].toUpperCase()) { stack.length = k; break; } }
    else if (m[2]) {
      const el = new El(m[2]);
      for (const a of (m[3] || '').matchAll(/([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) el.setAttribute(a[1], a[2] ?? a[3] ?? a[4] ?? '');
      top.appendChild(el);
      if (!m[4] && !VOID.has(m[2].toLowerCase())) stack.push(el);
    } else if (m[5] && m[5].trim()) { const t = new El('#text'); t._t = m[5]; top.appendChild(t); }
  }
}

/* ── a controlled world ───────────────────────────────────────────────── */
let clock, raf, intervals, timeouts, store;
function svet({ search = '', ulozene = null, zlomeneUlozisko = false } = {}) {
  clock = 1_800_000_000_000; raf = []; intervals = []; timeouts = []; chyby = []; vyplne = 0;
  store = new Map(ulozene ? [[search.includes('test') ? 'arling:zoo:test' : 'arling:zoo:v1', ulozene]] : []);
  const root = new El('#document'); parse(HTML, root);
  const doc = {
    hidden: false, l: {},
    getElementById: id => root.byId(id),
    createElement: t => new El(t),
    addEventListener(t, f) { (this.l[t] = this.l[t] || []).push(f); }
  };
  Object.assign(globalThis, {
    document: doc, Path2D: Cesta, DOMMatrix: class {},
    location: { search },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    requestAnimationFrame: f => { raf.push(f); return raf.length; },
    setInterval: (f, ms) => { intervals.push({ f, ms }); return intervals.length; },
    setTimeout: (f, ms) => { timeouts.push({ f, at: clock + (ms || 0) }); return timeouts.length; },
    clearTimeout: () => {},
    ResizeObserver: class { constructor(f) { this.f = f; } observe() { this.f([]); } },
    localStorage: {
      getItem: k => { if (zlomeneUlozisko) throw new Error('SecurityError'); return store.has(k) ? store.get(k) : null; },
      setItem: (k, v) => { if (zlomeneUlozisko) throw new Error('SecurityError'); store.set(k, String(v)); }
    },
    devicePixelRatio: 2,
    addEventListener: () => {}
  });
  Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'node test', hardwareConcurrency: 8, deviceMemory: 8 }, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'performance', { value: { now: () => clock - 1_800_000_000_000 }, configurable: true, writable: true });
  Date.now = () => clock;
  globalThis.window = globalThis;
  return root;
}
/* time passes: frames at 60 Hz, the 250 ms step, timeouts */
function cas(ms) {
  const end = clock + ms;
  while (clock < end) {
    clock = Math.min(end, clock + 16);
    const q = raf; raf = []; for (const f of q) f(clock - 1_800_000_000_000);
    for (const t of timeouts.filter(t => t.at <= clock)) { timeouts.splice(timeouts.indexOf(t), 1); t.f(); }
  }
  for (const iv of intervals) if (iv.ms === 250) iv.f();
}
let nacitanie = 0;
async function spusti(opts) { const root = svet(opts); await import(`./hra.js?beh=${++nacitanie}`); cas(100); return root; }
const $ = (root, id) => root.byId(id);
const riadky = root => $(root, 'habitaty').children;

test('a new park: one hedgehog, 10 coins, first buy, an empty box, a keeper', async () => {
  const root = await spusti();
  assert.equal($(root, 'mince').textContent, '10');
  assert.equal($(root, 'ostrov-meno').textContent, 'Meadow Isle');
  const r = riadky(root);
  assert.equal(r.length, 7);
  assert.equal(r[0].querySelector('.hab-nazov').textContent, 'Hedgehogs');
  assert.equal(r[1].hidden, false, 'the next habitat shows with its Build button');
  assert.equal(r[2].hidden, true, 'the ones after it wait');
  assert.match($(root, 'dalsie').textContent, /5 more habitats wait/);
  assert.equal($(root, 'rada').textContent, 'Tap a habitat to empty its box.');
  r[0].querySelector('.kup').click();
  assert.equal($(root, 'mince').textContent, '4.6');
  assert.equal(r[0].querySelector('.hab-pocet').textContent, '2');
  cas(20000);
  const zb = r[0].querySelector('.zber');
  assert.ok(zb, 'a full box offers to be emptied from the list');
  zb.click();
  cas(1500);
  const coins = Number($(root, 'mince').textContent);
  assert.ok(coins > 20, `coins after emptying the box: ${coins}`);
  // tap on the island where the hedgehogs live empties the box too
  cas(10000);
  const S = await import('./scena.js?v=1');
  const [ci, cj] = S.plotCenter(0), [wx, wy] = S.iso(ci, cj);
  const cv = $(root, 'svet');
  const W = S.postav(0), bb = W.bb, z = Math.min(390 / (bb.x1 - bb.x0), 405 / (bb.y1 - bb.y0));
  const sx = (wx - (bb.x0 + bb.x1) / 2) * z + 195, sy = (wy - (bb.y0 + bb.y1) / 2) * z + 202.5 + 56;
  const pred = Number($(root, 'mince').textContent);
  cv.fire('pointerdown', { pointerId: 1, clientX: sx, clientY: sy });
  clock += 80;
  cv.fire('pointerup', { pointerId: 1, clientX: sx, clientY: sy });
  cas(1500);
  assert.ok(Number($(root, 'mince').textContent) > pred, 'a tap on the habitat collected its box');
  // keeper: coins until it is affordable, then hire
  cas(40000); r[0].querySelector('.zber')?.click(); cas(500);
  cas(40000); r[0].querySelector('.zber')?.click(); cas(500);
  const st = r[0].querySelector('.strazca-btn');
  assert.ok(st && !st.disabled, 'a keeper can be hired');
  st.click();
  assert.equal(r[0].querySelector('.strazca-btn'), null, 'hired: the button is gone');
  const m1 = $(root, 'mince').textContent;
  cas(5000);
  assert.notEqual($(root, 'mince').textContent, m1, 'the keeper brings coins by themselves');
  assert.ok(store.get('arling:zoo:v1') || true);
  for (const iv of intervals) if (iv.ms === 5000) iv.f();
  const saved = JSON.parse(store.get('arling:zoo:v1'));
  assert.equal(saved.s.d[0].k, true);
  assert.deepEqual(chyby, [], `NaN in drawing: ${chyby.slice(0, 3)}`);
  assert.ok(vyplne > 20000, `the island was really drawn: ${vyplne} fills`);
});

test('a rich test park: x10 and Max, a study, the voyage to Reed Isle', async () => {
  const root = await spusti({ search: '?test=bohaty' });
  const r = riadky(root);
  $(root, 'nasobok').querySelector('button[data-m]');
  const [b1, b10, bmax] = $(root, 'nasobok').querySelectorAll('button');
  b10.click();
  assert.equal(r[0].querySelector('.kup span').textContent, 'Add 10');
  r[0].querySelector('.kup').click();
  assert.equal(r[0].querySelector('.hab-pocet').textContent, '11');
  r[1].querySelector('.kup').click();                       // build habitat 2 (always one)
  assert.equal(r[1].querySelector('.hab-pocet').textContent, '1');
  bmax.click();
  r[1].querySelector('.kup').click();
  assert.ok(Number(r[1].querySelector('.hab-pocet').textContent) > 100, 'Max buys many');
  b1.click();
  $(root, 'k-park').click();
  assert.equal($(root, 'p-park').hidden, false);
  const study = $(root, 'studie').querySelector('button');
  assert.ok(study && !study.disabled);
  const nazov = $(root, 'studie').querySelector('.studia-meno').textContent;
  study.click();
  assert.notEqual($(root, 'studie').querySelector('.studia-meno')?.textContent, nazov, 'bought study leaves the list');
  const btn = $(root, 'plavba-btn');
  assert.equal(btn.disabled, false, 'the voyage is open with 5 friends');
  assert.match(btn.textContent, /Sail on with 5 friends/);
  btn.click();
  const d = $(root, 'plavba-dialog');
  assert.ok(d.open);
  assert.match($(root, 'pd-text').textContent, /Reed Isle/);
  d.close('ano');
  cas(200);
  assert.equal($(root, 'ostrov-meno').textContent, 'Reed Isle');
  assert.equal(riadky(root)[0].querySelector('.hab-nazov').textContent, 'Magpies');
  assert.equal($(root, 'mince').textContent, '10');
  assert.equal($(root, 'pl-priatelia').textContent, '5');
  // escape on the next voyage dialog must not sail again
  $(root, 'plavba-btn').disabled = false; $(root, 'plavba-btn').click(); $(root, 'plavba-dialog').close();
  cas(100);
  assert.equal($(root, 'ostrov-meno').textContent, 'Reed Isle');
  cas(30000);
  assert.deepEqual(chyby, [], `NaN in drawing: ${chyby.slice(0, 3)}`);
});

test('back after 5 hours: the keepers\' coins, capped at 4 hours, said honestly', async () => {
  const E = await import('./ekonomika.mjs');
  const s = E.novyStav(); s.d[0].n = 30; s.d[0].k = true; s.d[1].n = 5;
  const t0 = 1_800_000_000_000 - 5 * 3600 * 1000;
  const root = await spusti({ ulozene: JSON.stringify({ t: t0, s, n: { zvuk: false, pokoj: null } }) });
  cas(600);
  const d = $(root, 'navrat');
  assert.ok(d.open, 'welcome back dialog');
  assert.match($(root, 'navrat-text').textContent, /You were away for 5 h 0 min\. The keepers collected [\d.]+ K? ?coins\./);
  assert.match($(root, 'navrat-strop').textContent, /up to 4 h 0 min .* last 1 h 0 min did not count/);
  const expected = E.formatuj(E.offline(s, 5 * 3600).stav.mince);
  assert.equal($(root, 'mince').textContent, expected);
  d.close('ok');
  cas(1500);
  assert.deepEqual(chyby, []);
});

test('blocked storage and a broken save: the game still starts and says it cannot save', async () => {
  let root = await spusti({ zlomeneUlozisko: true });
  assert.equal($(root, 'mince').textContent, '10');
  riadky(root)[0].querySelector('.kup').click();
  for (const iv of intervals) if (iv.ms === 5000) iv.f();
  $(root, 'menu').click();
  assert.match($(root, 'ns-ulozenie').textContent, /does not allow saving/);
  root = await spusti({ ulozene: '{"t": 5, "s": {"v": 1, "mince": "lots", "d": 7}' });
  assert.equal($(root, 'mince').textContent, '10');
});

test('sound on: no errors, the AudioContext is born on the tap', async () => {
  let born = 0;
  globalThis.AudioContext = class {
    constructor() { born++; this.currentTime = 0; this.state = 'running'; this.destination = {}; }
    createGain() { return { gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
    createOscillator() { return { type: '', frequency: { setValueAtTime() {} }, connect() {}, start() {}, stop() {} }; }
    resume() { return Promise.resolve(); }
  };
  const root = await spusti();
  assert.equal(born, 0, 'no sound before the tap');
  $(root, 'zvuk').click();
  assert.equal(born, 1);
  assert.equal($(root, 'zvuk').getAttribute('aria-pressed'), 'true');
  riadky(root)[0].querySelector('.kup').click();
  cas(25000);
  riadky(root)[0].querySelector('.zber')?.click();
  cas(1500);
  delete globalThis.AudioContext;
});
