// TO: NULL: celá stránka na malom falošnom DOM a falošnom canvase s virtuálnymi hodinami (bez prehliadača).
// Testy 25 až 28 a dym: štart, ťuk, nákup, uloženie, neprítomnosť, zamknuté úložisko, znížený pohyb, 10 minút automatom,
// SLEEP, LEXICON, koniec M1, príkazy a statické obrazovky ?obrazovka=1..9 so snímkou ukazky.snap.json.
// node --test products/arling-sk/games/to-null/tests-ui.mjs   (UPDATE_SNAP=1 vypíše nové hashe obrazoviek)

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import * as E from './ekonomika.mjs';
import * as U from './ulozenie.mjs';
import * as P from './pribeh.mjs';
import { CITANIE } from './terminal.js';
import { PRAZDNY } from './glyfy.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const HTML = readFileSync(join(DIR, 'index.html'), 'utf8');

// ------------------------------------------------------------ virtuálne hodiny

function hodiny() {
  let teraz = 0;
  let id = 1;
  const fronta = [];
  // skrt > 0: opakované časovače sa prebúdzajú najviac raz za skrt ms (ako Chrome v skrytej karte po 5 min)
  const stav = { skrt: 0 };
  const pridaj = (fn, ms, opak) => {
    const t = { id: id++, fn, kedy: teraz + Math.max(0, ms || 0), opak: opak ? Math.max(1, ms) : 0 };
    fronta.push(t);
    return t.id;
  };
  const zrus = (i) => { const k = fronta.findIndex((t) => t.id === i); if (k >= 0) fronta.splice(k, 1); };
  return {
    stav,
    now: () => teraz,
    setTimeout: (fn, ms) => pridaj(fn, ms, false),
    setInterval: (fn, ms) => pridaj(fn, ms, true),
    clearTimeout: zrus,
    clearInterval: zrus,
    async posun(ms) {
      const ciel = teraz + ms;
      for (;;) {
        fronta.sort((a, b) => a.kedy - b.kedy || a.id - b.id);
        const t = fronta[0];
        if (!t || t.kedy > ciel) break;
        teraz = t.kedy;
        if (t.opak) t.kedy += Math.max(t.opak, stav.skrt); else fronta.shift();
        t.fn(teraz);
        await Promise.resolve();
      }
      teraz = ciel;
      for (let i = 0; i < 5; i++) await Promise.resolve();
    },
  };
}

// ------------------------------------------------------------ falošný canvas (zaznamenáva kreslenie)

const ZAKAZANE = ['fillText', 'getImageData', 'strokeText'];
function falosnyCtx(cv, zaznam) {
  const ciel = {
    canvas: cv,
    save() {}, restore() {}, setTransform() {}, beginPath() {}, fill() {}, stroke() {}, rect() {},
    fillRect() {}, clearRect() {},
    drawImage(...a) { if (zaznam && zaznam.hlavny === cv) zaznam.draws.push(a.slice(1).map((x) => Math.round(x))); },
  };
  for (const z of ZAKAZANE) ciel[z] = () => { if (zaznam && zaznam.hlavny === cv) zaznam.zakazane.push(z); };
  return new Proxy(ciel, {
    set(t, k, v) {
      if (zaznam && zaznam.hlavny === cv && ['filter', 'shadowBlur', 'globalAlpha'].includes(k)) zaznam.zakazane.push(k);
      t[k] = v;
      return true;
    },
  });
}

// ------------------------------------------------------------ falošný DOM

class Styl {
  constructor() { this.p = {}; }
  setProperty(k, v) { this.p[k] = String(v); }
  getPropertyValue(k) { return this.p[k] || ''; }
  removeProperty(k) { delete this.p[k]; }
}

class Uzol {
  constructor(tag, dok) {
    this.tagName = tag.toUpperCase();
    this.dok = dok;
    this.attrs = {};
    this.childNodes = [];
    this.parentNode = null;
    this.style = new Styl();
    this.dataset = {};
    this.listeners = {};
    this.value = '';
    this.type = '';
    this.className = '';
    const self = this;
    this.classList = {
      add: (...c) => c.forEach((x) => self._tr().includes(x) || (self.className = (self.className + ' ' + x).trim())),
      remove: (...c) => (self.className = self._tr().filter((x) => !c.includes(x)).join(' ')),
      toggle: (c, f) => { const m = self._tr().includes(c); const chce = f === undefined ? !m : !!f; if (chce && !m) self.classList.add(c); if (!chce && m) self.classList.remove(c); return chce; },
      contains: (c) => self._tr().includes(c),
    };
    if (this.tagName === 'CANVAS') { this.width = 300; this.height = 150; this._ctx = falosnyCtx(this, dok.zaznam); }
  }
  _tr() { return this.className.split(/\s+/).filter(Boolean); }
  get children() { return this.childNodes.filter((c) => c instanceof Uzol); }
  get id() { return this.attrs.id || ''; }
  set id(v) { this.attrs.id = v; }
  get hidden() { return 'hidden' in this.attrs; }
  set hidden(v) { if (v) this.attrs.hidden = ''; else delete this.attrs.hidden; }
  setAttribute(k, v) {
    if (k === 'class') this.className = String(v); else this.attrs[k] = String(v);
    if (k.startsWith('data-')) this.dataset[k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(v);
  }
  getAttribute(k) { return k === 'class' ? this.className : k in this.attrs ? this.attrs[k] : null; }
  hasAttribute(k) { return k in this.attrs; }
  removeAttribute(k) { delete this.attrs[k]; }
  appendChild(c) { if (c.parentNode) c.remove(); c.parentNode = this; this.childNodes.push(c); return c; }
  remove() { const p = this.parentNode; if (!p) return; p.childNodes = p.childNodes.filter((x) => x !== this); this.parentNode = null; }
  get textContent() { return this.childNodes.map((c) => c.textContent).join(''); }
  set textContent(v) {
    for (const c of this.childNodes) c.parentNode = null;
    this.childNodes = [];
    if (v !== '' && v !== null && v !== undefined) this.appendChild(this.dok.createTextNode(String(v)));
  }
  addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn); }
  removeEventListener(t, fn) { this.listeners[t] = (this.listeners[t] || []).filter((f) => f !== fn); }
  dispatch(t, props = {}) {
    const e = { type: t, target: this, button: 0, detail: 1, clientX: 100, clientY: 100, preventDefault() {}, ...props };
    let n = this;
    while (n) { for (const fn of n.listeners[t] || []) fn(e); n = n.parentNode; }
    for (const fn of this.dok.listeners[t] || []) fn(e);
    return e;
  }
  click() { this.dispatch('click', { detail: 1 }); }
  getBoundingClientRect() {
    const w = this.dok.sirky;
    let r = { width: 120, height: 40 };
    if (this.id === 'catch') r = { width: w.dazd, height: w.vyska };
    else if (this.id === 'p-log') r = { width: 360, height: 800 };
    else if (this.id === 'p-rain') r = { width: w.dazd + 36, height: 800 };
    else if (this.id === 'p-proc') r = { width: 400, height: 800 };
    else if (this.className.includes('okno')) r = { width: 414, height: 400 };
    else if (this.className === 'meraj') r = { width: 180, height: 22 };
    return { left: 0, top: 0, right: r.width, bottom: r.height, x: 0, y: 0, ...r };
  }
  get offsetHeight() { return 22; }
  focus() { this.dok.activeElement = this; }
  getContext() { return this._ctx; }
  matches(sel) { return sel.split(',').some((c) => zhoda(this, c.trim())); }
  querySelectorAll(sel) {
    const out = [];
    const prejdi = (n) => { for (const c of n.children) { if (c.matches(sel)) out.push(c); prejdi(c); } };
    prejdi(this);
    return out;
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}

function zhodaZlozeny(n, z) {
  if (/[[\]:>]/.test(z)) return false;
  const m = z.match(/^([a-zA-Z0-9-]*)((?:\.[a-zA-Z0-9_-]+)*)$/);
  if (!m) return false;
  if (m[1] && n.tagName !== m[1].toUpperCase()) return false;
  for (const t of m[2].split('.').filter(Boolean)) if (!n.classList.contains(t)) return false;
  return true;
}
function zhoda(n, sel) {
  const casti = sel.split(/\s+/);
  if (!zhodaZlozeny(n, casti[casti.length - 1])) return false;
  let p = n.parentNode;
  for (let i = casti.length - 2; i >= 0; i--) {
    while (p && !(p instanceof Uzol && zhodaZlozeny(p, casti[i]))) p = p.parentNode;
    if (!p) return false;
    p = p.parentNode;
  }
  return true;
}

class Text {
  constructor(t) { this.nodeValue = t; this.parentNode = null; }
  get textContent() { return this.nodeValue; }
  remove() { if (this.parentNode) this.parentNode.childNodes = this.parentNode.childNodes.filter((x) => x !== this); }
}

const PRAZDNE = new Set(['meta', 'link', 'br', 'input', 'img']);

function postavDokument(hod, zaznam, sirky) {
  const dok = {
    hodiny: hod, zaznam, sirky, listeners: {}, hidden: false, activeElement: null,
    createElement: (t) => new Uzol(t, dok),
    createTextNode: (t) => new Text(t),
    addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn); },
    getElementById(id) { return this.vsetky.find((n) => n.id === id) || null; },
    querySelectorAll(sel) { return this.body.querySelectorAll(sel); },
    querySelector(sel) { return this.body.querySelector(sel); },
    fonts: { ready: Promise.resolve() },
  };
  const koren = new Uzol('html', dok);
  dok.documentElement = koren;
  dok.vsetky = [];
  const zasobnik = [koren];
  const telo = HTML.replace(/<!--[\s\S]*?-->/g, '').replace(/<!doctype[^>]*>/i, '');
  const re = /<\/?([a-zA-Z0-9-]+)([^>]*?)(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(telo))) {
    const top = zasobnik[zasobnik.length - 1];
    if (m[4] !== undefined) { if (m[4].trim()) top.appendChild(new Text(m[4].replace(/&gt;/g, '>').replace(/&lt;/g, '<'))); continue; }
    const tag = m[1].toLowerCase();
    if (m[0].startsWith('</')) { const i = zasobnik.map((x) => x.tagName).lastIndexOf(tag.toUpperCase()); if (i > 0) zasobnik.length = i; continue; }
    const n = new Uzol(tag, dok);
    const ar = /([a-zA-Z-:]+)(?:="([^"]*)")?/g;
    let a;
    while ((a = ar.exec(m[2]))) n.setAttribute(a[1], a[2] === undefined ? '' : a[2]);
    if (n.attrs.type) n.type = n.attrs.type;
    top.appendChild(n);
    dok.vsetky.push(n);
    if (tag === 'body') dok.body = n;
    if (!(m[3] === '/' || PRAZDNE.has(tag) || tag === 'script')) zasobnik.push(n);
    if (tag === 'script') re.lastIndex = telo.indexOf('</script>', re.lastIndex) + 9;
  }
  const ce = dok.createElement;
  dok.createElement = (t) => { const n = ce(t); dok.vsetky.push(n); return n; };
  return dok;
}

// ------------------------------------------------------------ falošný Web Audio (počíta prehrané zvuky)

function falosneAudio(pocitadlo) {
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} });
  const uzol = (extra = {}) => ({ connect(n) { return n; }, gain: param(), frequency: param(), playbackRate: param(), type: '', ...extra });
  return class {
    constructor() { this.currentTime = 0; this.sampleRate = 8000; this.state = 'running'; this.destination = uzol(); }
    createGain() { return uzol(); }
    createDynamicsCompressor() { return uzol(); }
    createBiquadFilter() { return uzol(); }
    createOscillator() { return uzol({ start() { pocitadlo.n++; }, stop() {} }); }
    createBufferSource() { return uzol({ start() { pocitadlo.n++; }, loop: false, buffer: null }); }
    createBuffer(ch, len) { const d = new Float32Array(len); return { getChannelData: () => d }; }
    resume() { this.state = 'running'; }
    suspend() { this.state = 'suspended'; }
  };
}

// ------------------------------------------------------------ prostredie a štart

let beh = 0;
async function spusti({ hladanie = '', reduced = false, uloziste = 'ok', ulozene = null, telefon = false, sirka = 624, vyska = 560 } = {}) {
  const hod = hodiny();
  const zaznam = { hlavny: null, draws: [], zakazane: [] };
  const dok = postavDokument(hod, zaznam, { dazd: sirka, vyska });
  zaznam.hlavny = dok.getElementById('platno');
  const pamat = new Map();
  if (ulozene) pamat.set('tonull.save', ulozene);
  const ls = uloziste === 'ok'
    ? { getItem: (k) => (pamat.has(k) ? pamat.get(k) : null), setItem: (k, v) => pamat.set(k, String(v)), removeItem: (k) => pamat.delete(k) }
    : { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('SecurityError'); }, removeItem() {} };
  let datum = 1_800_000_000_000;
  const zvuky = { n: 0 };
  const g = globalThis;
  g.document = dok;
  g.window = { localStorage: ls, devicePixelRatio: 2, innerHeight: 900, AudioContext: falosneAudio(zvuky), addEventListener() {}, navigator: { vibrate() {} } };
  g.localStorage = ls;
  g.location = { search: hladanie, reload() { g.__reload = true; } };
  g.matchMedia = (q) => ({ matches: q.includes('reduce') ? reduced : q.includes('max-width') ? telefon : false, addEventListener() {} });
  g.requestAnimationFrame = (fn) => hod.setTimeout(() => fn(hod.now()), 16);
  g.cancelAnimationFrame = hod.clearTimeout;
  g.setTimeout = hod.setTimeout;
  g.setInterval = hod.setInterval;
  g.clearTimeout = hod.clearTimeout;
  g.clearInterval = hod.clearInterval;
  g.ResizeObserver = class { observe() {} };
  // navyse.ms: posun performance.now() navyše (test záchranného režimu: "kreslenie trvá 16 ms")
  const navyse = { ms: 0 };
  Object.defineProperty(g, 'performance', { value: { now: () => hod.now() + navyse.ms }, configurable: true, writable: true });
  const DatePovodny = Date;
  g.Date = class extends DatePovodny { static now() { return datum + hod.now(); } };
  const mod = await import(pathToFileURL(join(DIR, 'ui.js')).href + '?beh=' + ++beh);
  await hod.posun(20);
  return {
    dok, mod, zaznam, zvuky, pamat, hod, navyse,
    $: (id) => dok.getElementById(id),
    skry(ano) { dok.hidden = !!ano; for (const fn of dok.listeners.visibilitychange || []) fn(); },
    klaves(key, extra = {}) { for (const fn of dok.listeners.keydown || []) fn({ key, code: key === ' ' ? 'Space' : '', target: dok.body, preventDefault() {}, repeat: false, ...extra }); },
    posun: (ms) => hod.posun(ms),
    skok(ms) { datum += ms; },
    koniec() { g.Date = DatePovodny; },
    tukni(x = 100, y = 200) { dok.getElementById('catch').dispatch('pointerdown', { clientX: x, clientY: y }); },
    riadok(k) { return dok.getElementById('proc').children.find((c) => c.tagName === 'BUTTON' && c.textContent.includes(k)); },
    logText() { return dok.getElementById('log').textContent; },
    viditelne(id) { let n = dok.getElementById(id); while (n) { if (n.hidden) return false; n = n.parentNode; } return true; },
  };
}

const text = (n) => (n ? n.textContent : '');
/** Všetky ID riadkov príbehu okrem tých, ktoré test chce ešte vidieť (už "videné" riadky sa pri načítaní neopakujú). */
const bityPred = (okrem) => P.BEATS.map((b) => b.id).filter((id) => !okrem.test(id));

// ------------------------------------------------------------ testy

test('štart: boot, gc hovorí, ťuk pridá glyf, HOOK sa dá kúpiť, uloženie do 10 s', async () => {
  const h = await spusti();
  await h.posun(2500);
  assert.match(h.logText(), /lantern relay 2\.3/);
  assert.match(h.logText(), /there you are\. good\./);
  assert.match(h.logText(), /catch\./);
  assert.equal(h.$('p-proc').hidden, true, 'PROC až s riadkom HOOK');
  assert.equal(h.$('pozornost').hidden, true);
  for (let i = 0; i < 16; i++) { h.tukni(80 + i * 20); await h.posun(120); }
  await h.posun(300);
  assert.equal(text(h.$('pocet')), '16');
  assert.equal(h.$('p-proc').hidden, false);
  const hak = h.riadok('HOOK');
  assert.ok(hak, 'riadok HOOK');
  hak.click();
  await h.posun(300);
  assert.equal(h.mod._test.s.n.hook, 1);
  assert.equal(text(h.$('pocet')), '1');
  await h.posun(11000);
  assert.ok(h.pamat.has('tonull.save'), 'uložené do 10 s');
  assert.match(h.logText(), /now it works without you/);
  assert.deepEqual(h.zaznam.zakazane, []);
  h.koniec();
});

test('neprítomnosť: skrytá karta 2 h, pri návrate obrazovka s číslom a jednou voľbou', async () => {
  const s = E.novyStav(3, 1_800_000_000_000 - 2 * 3600 * 1000);
  Object.assign(s, { sec: 3, g: 100, tot: 5000, run: 5000 });
  s.n.hook = 20;
  s.beats = ['boot1', 'boot2', 'boot3', 'gc.a1', 'gc.a2'];
  const h = await spusti({ ulozene: U.zbal(s) });
  await h.posun(400);
  assert.equal(h.$('navrat').hidden, false);
  assert.match(text(h.$('navrat-riadky')), /the queue turned 2h 0m without you\./);
  assert.match(text(h.$('navrat-riadky')), /half pace, capped at 8h\./);
  const tl = h.$('navrat-tlacidla').children;
  assert.equal(tl.length, 1);
  assert.equal(text(tl[0]), '[ TAKE IT ]');
  const g0 = h.mod._test.s.g;
  tl[0].click();
  assert.ok(h.$('zisky').children.length > 0, 'plávajúci zisk aj pri výbere offline zisku (SPEC 4.1)');
  await h.posun(200);
  assert.ok(h.mod._test.s.g > g0 + 1000);
  assert.equal(h.$('navrat').hidden, true);
  h.koniec();
});

test('zamknuté úložisko: hra beží a menu povie, že neukladá', async () => {
  const h = await spusti({ uloziste: 'zamknute' });
  await h.posun(3000);
  h.tukni();
  await h.posun(300);
  assert.equal(text(h.$('pocet')), '1');
  h.$('tl-menu').click();
  await h.posun(50);
  assert.equal(text(h.$('m-uklada')), 'saving is off in this browser');
  await h.posun(11000);
  h.koniec();
});

/** Všetky inline transformy v stránke okrem 'none' (znížený pohyb: žiadne posuny ani mierky). */
function transformy(h) {
  const zle = [];
  for (const n of h.dok.vsetky) {
    const t = n.style.getPropertyValue('transform');
    if (t && t !== 'none') zle.push(`${n.id || n.className || n.tagName}: ${t}`);
    if (n.classList.contains('rozpad')) zle.push(`${n.id || n.className}: rozpad`);
  }
  return zle;
}

test('26 znížený pohyb: žiadne posuny ani mierky (boot, ťuk, brána, SLEEP, LEXICON), časy čítania ostávajú', async () => {
  const h = await spusti({ reduced: true });
  await h.posun(200);
  assert.match(h.logText(), /lantern relay/, 'boot celý hneď');
  assert.equal(h.$('log').style.getPropertyValue('transform'), '');
  // hlasy gc: ďalší riadok najskôr po 2 500 ms + 50 ms na znak
  const t1 = 'there you are. good.';
  // merané relatívne: gc.a2 najskôr CITANIE(gc.a1) po tom, čo sa gc.a1 ukázal celý naraz
  let tA1 = -1;
  let tA2 = -1;
  for (let t = 200; t < 9000; t += 25) {
    await h.posun(25);
    const l = h.logText();
    if (tA1 < 0 && l.includes(t1)) { tA1 = t; assert.ok(!/there you are\. goo$/.test(l), 'gc.a1 celý naraz'); }
    if (tA2 < 0 && l.includes('catch.')) tA2 = t;
  }
  assert.ok(tA1 >= 0 && tA1 < 1500, `gc.a1 v ${tA1} ms`);
  assert.ok(tA2 - tA1 >= CITANIE(t1.length) - 50, `gc.a2 ${tA2 - tA1} ms po gc.a1, treba ${CITANIE(t1.length)} ms`);
  assert.match(h.logText(), /catch\./);
  h.tukni();
  await h.posun(100);
  assert.ok(h.$('zisky').children.length > 0, 'zisk sa ukázal');
  assert.deepEqual(transformy(h), []);
  h.koniec();

  // brána: SECTOR 01 bez rozpadu textu a bez posunu obrazu
  const sb = E.novyStav(11, 1_800_000_000_000);
  Object.assign(sb, { g: 5000, tot: 5000, run: 5000 });
  sb.n.hook = 5;
  sb.beats = bityPred(/^K\.c11$/);
  const hb = await spusti({ reduced: true, ulozene: U.zbal(sb) });
  await hb.posun(300);
  const brana = hb.riadok('SECTOR 01');
  assert.ok(brana, 'riadok brány');
  brana.click();
  for (let i = 0; i < 30; i++) {
    await hb.posun(100);
    assert.deepEqual(transformy(hb), [], `brána ${i * 100} ms`);
    if (i === 5) assert.match(text(hb.$('obraz')), /\.---\(___\)---\./, 'ručne kreslená kanvica (SECTOR 01)');
  }
  assert.equal(hb.mod._test.s.sec, 1);
  hb.koniec();

  // SLEEP: bez stlačenia obrazovky (scaleY) a bez mierky čiary
  const ss = E.novyStav(4, 1_800_000_000_000);
  Object.assign(ss, { sec: 7, g: 5000, tot: 70000, run: 70000 });
  ss.n.hook = 40;
  ss.beats = bityPred(/^(gc\.s1|K8|gc\.b|K9|K1[0-4]|gc\.c|K\.c|card3|key|end\.)/);
  const hs = await spusti({ reduced: true, ulozene: U.zbal(ss) });
  await hs.posun(300);
  hs.riadok('[ SLEEP ]').click();
  await hs.posun(50);
  hs.$('dialog-ano').click();
  let videlSpanok = false;
  let tCierna = -1;
  let tText = -1;
  for (let i = 0; i < 40; i++) {
    await hs.posun(50);
    videlSpanok ||= !hs.$('spanok').hidden;
    if (tCierna < 0 && !hs.$('spanok').hidden) tCierna = i * 50;
    if (tText < 0 && text(hs.$('sp-up'))) tText = i * 50;
    assert.deepEqual(transformy(hs), [], `SLEEP ${i * 50} ms`);
  }
  assert.ok(videlSpanok, 'obrazovka spánku sa ukázala');
  // SPEC 4.1: strih do čiernej na 600 ms, až potom texty
  assert.ok(tText - tCierna >= 550, `čierna ${tCierna} ms, text ${tText} ms`);
  assert.equal(hs.mod._test.s.sleeps, 1);
  hs.koniec();

  // LEXICON: premena bez posunov
  const sl = E.novyStav(5, 1_800_000_000_000);
  Object.assign(sl, { sec: 7, stacks: 5, sleeps: 4, lines: 4, act: 2, dec: 4, g: 6e8, tot: 5e9, run: 1e9, R: 30 });
  sl.n.bank = 30;
  sl.beats = [...bityPred(/^(gc\.c|K\.c|card3|key|end\.|K14|gc\.b11)/), 'wake.2', 'wake.3', 'wake.4'];
  const hl = await spusti({ reduced: true, ulozene: U.zbal(sl) });
  await hl.posun(300);
  hl.riadok('LEXICON').click();
  await hl.posun(50);
  hl.$('dialog-ano').click();
  for (let i = 0; i < 40; i++) { await hl.posun(100); assert.deepEqual(transformy(hl), [], `LEXICON ${i * 100} ms`); }
  assert.equal(hl.mod._test.s.lex, true);
  assert.equal(text(hl.$('pocet-meno')), 'LETTERS');
  hl.koniec();
});

test('10 minút hry automatom: S02 a viac, rozpočet 1 300 drawImage, žiadne zakázané volania, žiadna chyba', async () => {
  const h = await spusti();
  let maxKresieb = 0;
  for (let sek = 0; sek < 600; sek++) {
    for (let i = 0; i < 3; i++) { h.tukni(40 + ((sek * 7 + i * 13) % 560), 220); await h.posun(333); }
    if (sek % 2 === 0) {
      const s = h.mod._test.s;
      for (const r of h.$('proc').children) {
        if (r.tagName === 'BUTTON' && !r.classList.contains('drahe') && !/SLEEP|LEXICON/.test(r.textContent)) { r.click(); break; }
      }
      if (s.att >= 88 && s.darkMs === 0 && !h.$('pozornost').hidden) h.$('tl-tma').click();
    }
    // požadované kreslenia (aj tie, ktoré by strop orezal): strop 1 300 nesmie nič potichu zahodiť
    maxKresieb = Math.max(maxKresieb, h.mod._test.dazd.pozadovane);
  }
  const s = h.mod._test.s;
  assert.ok(s.sec >= 2, `sektory ${s.sec}`);
  assert.ok(maxKresieb > 50 && maxKresieb <= 1300, `požadovaných kreslení ${maxKresieb}`);
  assert.deepEqual(h.zaznam.zakazane, []);
  assert.ok(U.over(s).length === 0);
  h.koniec();
});

test('27 falošný canvas: 44 stĺpcov a FLOOD, najviac 1 300 drawImage za snímok, v snímke nič zakázané', async () => {
  const s = E.novyStav(9, 1_800_000_000_000);
  Object.assign(s, { sec: 7, stacks: 5, sleeps: 3, act: 2, att: 100, g: 1e7, tot: 1e9, run: 1e7 });
  s.n.hook = 150; s.n.sieve = 150; s.n.thread = 150;
  s.beats = ['boot1', 'boot2', 'boot3', 'gc.a1', 'gc.a2'];
  const h = await spusti({ ulozene: U.zbal(s), sirka: 44 * 15 + 4, vyska: 44 * 20 });
  await h.posun(500);
  assert.ok(h.mod._test.s.floodMs > 0, 'FLOOD beží');
  assert.ok(h.mod._test.dazd.aktivne >= 44, `stĺpce ${h.mod._test.dazd.aktivne}`);
  let max = 0;
  let maxPoz = 0;
  for (let i = 0; i < 60; i++) {
    h.zaznam.draws = [];
    await h.posun(34);
    max = Math.max(max, h.mod._test.dazd.pocetKresieb);
    maxPoz = Math.max(maxPoz, h.mod._test.dazd.pozadovane);
  }
  assert.ok(max > 300, `kreslí sa (${max})`);
  // tvrdí sa počet požadovaných kreslení, nie orezaný počet (ten by strop nikdy neprekročil)
  assert.ok(maxPoz <= 1300, `${maxPoz} požadovaných drawImage (nakreslených ${max})`);
  assert.deepEqual(h.zaznam.zakazane, []);
  h.koniec();
});

test('28 skrytá karta: po visibilitychange sa nekreslí ani nehrá zvuk', async () => {
  const h = await spusti();
  await h.posun(2500);
  h.tukni();
  await h.posun(500);
  h.dok.hidden = true;
  for (const fn of h.dok.listeners.visibilitychange) fn();
  const kreslenia = h.zaznam.draws.length;
  const zvuky = h.zvuky.n;
  await h.posun(5000);
  assert.equal(h.zaznam.draws.length, kreslenia, 'nekreslí sa');
  assert.equal(h.zvuky.n, zvuky, 'nehrá sa');
  h.dok.hidden = false;
  for (const fn of h.dok.listeners.visibilitychange) fn();
  await h.posun(200);
  assert.ok(h.zaznam.draws.length > kreslenia, 'po návrate kreslí');
  h.koniec();
});

test('SLEEP: potvrdenie s číslami, CRT moment, uptime +1, karta ACT II, 1 HOOK zadarmo', async () => {
  const s = E.novyStav(4, 1_800_000_000_000);
  Object.assign(s, { sec: 7, g: 5000, tot: 70000, run: 70000 });
  s.n.hook = 40;
  s.beats = bityPred(/^(gc\.s1|K8|gc\.b|K9|K1[0-4]|gc\.c|K\.c|card3|key|end\.)/);
  const h = await spusti({ ulozene: U.zbal(s) });
  await h.posun(500);
  const r = h.riadok('[ SLEEP ]');
  assert.ok(r);
  assert.match(r.textContent, /\+4 recall · all catch ×1\.76/);
  r.click();
  await h.posun(50);
  assert.equal(h.$('dialog').hidden, false);
  assert.match(text(h.$('dialog-text')), /resets glyphs, procs, patches/);
  assert.doesNotMatch(text(h.$('dialog-text')), /mend|letter/, 'pred LEXICON dialóg nič neprezradí');
  h.$('dialog-ano').click();
  await h.posun(1000);
  assert.equal(h.$('spanok').hidden, false);
  assert.match(text(h.$('sp-up')), /uptime 14,622 → 14,623 days/);
  await h.posun(2000);
  assert.equal(h.$('spanok').hidden, true);
  assert.equal(h.$('app').style.getPropertyValue('transform'), 'none');
  const t = h.mod._test.s;
  assert.equal(t.sleeps, 1); assert.equal(t.n.hook, 1); assert.equal(t.act, 2); assert.equal(t.lines, 1);
  assert.equal(text(h.$('uptime')), '14,623');
  await h.posun(3000);
  assert.match(h.logText(), /ACT II · THE STACKS/);
  assert.match(h.logText(), /morning\. uptime plus one day\./);
  h.koniec();
});

test('LEXICON: poctivý dialóg, 8 s moment, GLYPHS → LETTERS, log sa odšifruje, voľba CONSUME a MEND s číslami', async () => {
  const s = E.novyStav(5, 1_800_000_000_000);
  Object.assign(s, { sec: 7, stacks: 5, sleeps: 4, lines: 4, act: 2, dec: 4, g: 6e8, tot: 5e9, run: 1e9, R: 30 });
  s.n.bank = 30;
  s.beats = [...bityPred(/^(gc\.c|K\.c|card3|key|end\.|K14|gc\.b11)/), 'wake.2', 'wake.3', 'wake.4'];
  s.log = [{ id: 'K1' }, { id: 'K13' }];
  const h = await spusti({ ulozene: U.zbal(s) });
  await h.posun(500);
  assert.match(h.logText(), /▒/);
  const r = h.riadok('LEXICON');
  r.click();
  await h.posun(50);
  assert.match(text(h.$('dialog-text')), /gc advises against it/);
  assert.match(text(h.$('dialog-text')), /costs 500M/);
  h.$('dialog-ano').click();
  await h.posun(2000);
  assert.equal(text(h.$('pocet-meno')), 'GLYPHS', 'počas premeny ešte GLYPHS');
  await h.posun(7000);
  assert.equal(text(h.$('pocet-meno')), 'LETTERS');
  assert.equal(text(h.$('podriadok')), 'from 11,204 messages. never delivered.');
  assert.match(h.logText(), /PLEASE STOP\. THEY ARE LETTERS\./);
  assert.match(h.logText(), /HELD FOR PICKUP\. NOBODY CAME\. I STAYED\./);
  await h.posun(20000);
  assert.match(h.logText(), /they were letters\./);
  const volba = h.$('proc').children.find((c) => c.className === 'volba');
  assert.ok(volba && !volba.hidden);
  assert.match(volba.textContent, /\[ CONSUME \].*\/s now/);
  assert.match(volba.textContent, /\[ MEND \].*each mended \+0\.3% forever/);
  volba.children[1].click();
  await h.posun(300);
  assert.equal(h.mod._test.s.mode, 'mend');
  h.koniec();
});

test('koniec M1: mended 1 000, whoami sa napíše samo, CARRY THEM, karta ACT IV a KEEP MENDING', async () => {
  const s = E.novyStav(6, 1_800_000_000_000);
  Object.assign(s, { sec: 7, stacks: 5, sleeps: 7, lines: 7, act: 3, lex: true, dec: 5, mode: 'mend', mended: 999, keys: 2, mendPool: 1e8 * 1.01 ** 999 - 1, g: 1e12, tot: 1e14, run: 1e12, R: 100 });
  s.themes = ['green', 'amber', 'rose'];
  s.n.loom = 50;
  s.beats = [...bityPred(/^(K\.c9|K\.c10|K\.c11|end\.)/), 'wake.2', 'wake.3', 'wake.4', 'wake.5', 'wake.6', 'wake.7', 'cmd.whoami'];
  const h = await spusti({ ulozene: U.zbal(s) });
  await h.posun(15000);
  assert.equal(h.mod._test.s.keys, 3);
  assert.match(h.logText(), /EVERY LETTER HAS A RECIPIENT\./);
  assert.match(h.logText(), /EXCEPT ONE\./);
  assert.match(h.logText(), /> whoami/);
  assert.match(h.logText(), /msg_0000\. to: NULL\. from: operator console, 05:58\./);
  assert.match(h.logText(), /WILL YOU CARRY THEM\?/);
  assert.equal(h.$('tl-carry').hidden, false);
  h.$('tl-carry').click();
  await h.posun(6000);
  assert.equal(h.$('karta').hidden, false);
  assert.equal(text(h.$('karta-t1')), 'ACT IV · UPWARD');
  assert.equal(text(h.$('karta-t2')), 'not written yet.');
  assert.equal(h.$('karta-tl').hidden, false);
  assert.equal(h.mod._test.s.ended, true);
  h.$('karta-tl').click();
  await h.posun(100);
  assert.equal(h.$('karta').hidden, true);
  h.koniec();
});

test('príkazový riadok: whoami, help, theme zamknutá; medzerník chytá; D ide do tmy', async () => {
  const s = E.novyStav(8, 1_800_000_000_000);
  Object.assign(s, { sec: 3, g: 10, tot: 2000, run: 2000, att: 20 });
  s.beats = ['boot1', 'boot2', 'boot3', 'gc.a1', 'gc.a2'];
  const h = await spusti({ ulozene: U.zbal(s) });
  await h.posun(300);
  assert.equal(h.$('prikaz-form').hidden, false);
  h.$('prikaz').value = 'whoami';
  h.$('prikaz-form').dispatch('submit');
  await h.posun(3000);
  assert.match(h.logText(), /> whoami/);
  assert.match(h.logText(), /▒▒▒_▒▒▒▒/);
  assert.match(h.logText(), /that's you\. the name will clear up\./);
  h.$('prikaz').value = 'theme amber';
  h.$('prikaz-form').dispatch('submit');
  await h.posun(300);
  assert.match(h.logText(), /locked\. keep going\./);
  assert.doesNotMatch(h.logText(), /letter|mend/, 'pred LEXICON nič o listoch');
  const g0 = h.mod._test.s.stats.taps;
  for (const fn of h.dok.listeners.keydown) fn({ key: ' ', code: 'Space', target: h.dok.body, preventDefault() {} });
  await h.posun(100);
  assert.equal(h.mod._test.s.stats.taps, g0 + 1);
  for (const fn of h.dok.listeners.keydown) fn({ key: 'd', target: h.dok.body, preventDefault() {} });
  await h.posun(100);
  assert.ok(h.mod._test.s.darkMs > 0);
  h.koniec();
});

test('telefón 390: záložky PROC, LOG, > a pás hlasu drží čas na čítanie aj bez zníženého pohybu', async () => {
  // skutočná šírka dažďa pri 390 px: panel 42 znakov po 8,4 px mínus 4 znaky vnútorného okraja = 319 px (22 stĺpcov)
  const h = await spusti({ telefon: true, sirka: 319, vyska: 330 });
  const t1 = 'there you are. good.';
  let hotovo1 = -1;
  let start2 = -1;
  let logCatch = -1;
  for (let t = 0; t < 12000; t += 25) {
    await h.posun(25);
    const p = text(h.$('pas'));
    if (hotovo1 < 0 && p === 'gc  ' + t1) hotovo1 = t;
    if (start2 < 0 && hotovo1 >= 0 && p !== 'gc  ' + t1) start2 = t;
    if (logCatch < 0 && /catch\./.test(h.logText())) logCatch = t;
  }
  assert.ok(hotovo1 >= 0, 'pás dopísal gc.a1');
  assert.ok(logCatch >= 0 && logCatch < hotovo1 + 1200, `log píše gc.a2 ďalej (${logCatch} ms vs ${hotovo1} ms)`);
  assert.ok(start2 - hotovo1 >= CITANIE(t1.length) - 50, `pás držal gc.a1 ${start2 - hotovo1} ms, treba ${CITANIE(t1.length)} ms`);
  assert.match(text(h.$('pas')), /catch\./);
  assert.equal(h.$('zalozky').hidden, false);
  assert.equal(h.mod._test.dazd.cols, 22);
  h.$('z-log').click();
  assert.equal(h.$('plocha').dataset.tab, 'log');
  // aktívny rám na telefóne (SPEC 3.4) patrí panelu vybranej záložky
  assert.ok(h.$('p-log').classList.contains('aktivny'));
  assert.ok(!h.$('p-rain').classList.contains('aktivny'));
  h.koniec();
});

test('pás: dva riadky gc po 1 200 ms, pás drží prvý aspoň 2 500 + 50 · n ms od dopísania', async () => {
  const s = E.novyStav(12, 1_800_000_000_000);
  s.beats = bityPred(/^K\.c11$/);
  const h = await spusti({ telefon: true, sirka: 319, vyska: 330, ulozene: U.zbal(s) });
  await h.posun(3000);
  const a = 'the first line holds still for a while.';
  const b = 'the second line waits its turn.';
  h.mod._test.term.pridaj({ h: 'gc', t: a });
  await h.posun(1200);
  h.mod._test.term.pridaj({ h: 'gc', t: b });
  let hotovo = -1;
  let zmena = -1;
  for (let t = 0; t < 12000; t += 25) {
    await h.posun(25);
    const p = text(h.$('pas'));
    if (hotovo < 0 && p === 'gc  ' + a) hotovo = t;
    if (hotovo >= 0 && zmena < 0 && p !== 'gc  ' + a) zmena = t;
  }
  assert.ok(hotovo >= 0 && zmena > hotovo, `${hotovo} ${zmena}`);
  assert.ok(zmena - hotovo >= CITANIE(a.length) - 50, `pás držal ${zmena - hotovo} ms, treba ${CITANIE(a.length)} ms`);
  assert.equal(text(h.$('pas')), 'gc  ' + b);
  assert.match(h.logText(), /the second line waits its turn\./, 'log nečaká na pás');
  h.koniec();
});

test('skrytá karta 1 h: časovače škrtené na 1 za 60 001 ms, po návrate zisk = 0,5 · P · 3 600 (±1 %)', async () => {
  const s = E.novyStav(3, 1_800_000_000_000);
  Object.assign(s, { sec: 3, g: 0, tot: 5000, run: 5000 });
  s.n.hook = 20; s.n.sieve = 5;
  s.beats = bityPred(/^K\.c11$/);
  const h = await spusti({ ulozene: U.zbal(s) });
  await h.posun(500);
  const P0 = E.tempoPlne(h.mod._test.s);
  h.skry(true);
  const g0 = h.mod._test.s.g;
  h.hod.stav.skrt = 60001;
  for (let i = 0; i < 60; i++) await h.posun(60001);
  assert.equal(h.mod._test.s.g, g0, 'v skrytej karte sa nič nepripisuje');
  h.hod.stav.skrt = 0;
  h.skry(false);
  await h.posun(300);
  assert.equal(h.$('navrat').hidden, false, 'obrazovka návratu');
  assert.match(text(h.$('navrat-riadky')), /the queue turned 1h 0m without you\./);
  h.$('navrat-tlacidla').children[0].click();
  await h.posun(100);
  const zisk = h.mod._test.s.g - g0;
  const ocak = 0.5 * P0 * 3600;
  assert.ok(Math.abs(zisk - ocak) / ocak < 0.01, `zisk ${zisk} vs ${ocak}`);
  h.koniec();
});

test('obrazovka návratu: druhá neprítomnosť sa pripočíta; zavretá karta bez výberu zisk nestratí', async () => {
  const s = E.novyStav(3, 1_800_000_000_000 - 2 * 3600 * 1000);
  Object.assign(s, { sec: 3, g: 0, tot: 5000, run: 5000 });
  s.n.hook = 20;
  s.beats = bityPred(/^K\.c11$/);
  const h = await spusti({ ulozene: U.zbal(s) });
  await h.posun(400);
  assert.equal(h.$('navrat').hidden, false);
  const z1 = h.mod._test.s.pending.zisk;
  assert.ok(z1 > 0);
  // hráč nechá obrazovku otvorenú a odíde ešte na hodinu
  h.skry(true);
  h.skok(3600 * 1000);
  h.skry(false);
  await h.posun(300);
  assert.match(text(h.$('navrat-riadky')), /the queue turned 3h 0m without you\./);
  const z2 = h.mod._test.s.pending.zisk;
  assert.ok(Math.abs(z2 - 1.5 * z1) / z2 < 0.01, `${z2} vs ${1.5 * z1}`);
  // nič nevyberie, uloženie beží, karta sa zavrie
  await h.posun(11000);
  const ulozene = h.pamat.get('tonull.save');
  h.koniec();
  const h2 = await spusti({ ulozene });
  await h2.posun(400);
  assert.equal(h2.$('navrat').hidden, false, 'po obnovení sa obrazovka návratu ukáže znova');
  const g0 = h2.mod._test.s.g;
  h2.$('navrat-tlacidla').children[0].click();
  await h2.posun(100);
  assert.ok(Math.abs(h2.mod._test.s.g - g0 - z2) / z2 < 0.001);
  assert.equal(h2.mod._test.s.pending, null);
  h2.koniec();
});

test('CARRY THEM po obnovení stránky: K.c11 v beats a ended = false ukáže tlačidlo', async () => {
  const s = E.novyStav(6, 1_800_000_000_000);
  Object.assign(s, { sec: 7, stacks: 5, sleeps: 7, lines: 7, act: 3, lex: true, dec: 5, mode: 'mend', mended: 1000, keys: 3, g: 1e12, tot: 1e14, run: 1e12, R: 100 });
  s.themes = ['green', 'amber', 'rose'];
  s.beats = [...P.BEATS.map((b) => b.id), 'wake.2', 'wake.3', 'wake.4', 'wake.5', 'wake.6', 'wake.7'];
  s.log = [{ id: 'K.c11' }];
  const h = await spusti({ ulozene: U.zbal(s) });
  await h.posun(300);
  assert.equal(h.$('tl-carry').hidden, false);
  h.$('tl-carry').click();
  await h.posun(100);
  assert.equal(h.mod._test.s.ended, true);
  h.koniec();
});

test('strop ťukov: podržaný medzerník (repeat) nič nepridá, najviac 10 ťukov so ziskom za sekundu', async () => {
  const s = E.novyStav(8, 1_800_000_000_000);
  Object.assign(s, { sec: 3, g: 10, tot: 2000, run: 2000 });
  s.beats = bityPred(/^K\.c11$/);
  const h = await spusti({ ulozene: U.zbal(s) });
  await h.posun(300);
  const t0 = h.mod._test.s.stats.taps;
  h.klaves(' ');
  for (let i = 0; i < 30; i++) { h.klaves(' ', { repeat: true }); await h.posun(33); }
  assert.equal(h.mod._test.s.stats.taps, t0 + 1, 'len prvý stisk');
  await h.posun(1000);
  const t1 = h.mod._test.s.stats.taps;
  for (let i = 0; i < 30; i++) { h.tukni(40 + i * 10); await h.posun(30); }
  assert.equal(h.mod._test.s.stats.taps - t1, 10 + 0, 'za 900 ms najviac 10');
  await h.posun(1000);
  h.tukni();
  assert.equal(h.mod._test.s.stats.taps - t1, 11, 'po sekunde zase ide');
  h.koniec();
});

test('záchranný režim výkonu: keď kreslenie trvá 16 ms, dážď prejde na 24 krokov a kratšie stopy; ?debug=1 to vypíše', async () => {
  const h = await spusti({ hladanie: '?debug=1' });
  await h.posun(3000);
  assert.equal(h.mod._test.dazd.usporny, false, 'rýchle kreslenie nič neprepne');
  const d = h.mod._test.dazd;
  const povodne = d.kresli.bind(d);
  d.kresli = (t) => { povodne(t); h.navyse.ms += 16; };
  await h.posun(3000);
  assert.equal(d.usporny, true);
  assert.equal(d.krokMs, 1000 / 24);
  assert.ok(h.mod._test.vykon.priemer > 14);
  assert.match(h.$('titul').dataset.debug || '', /saver 24\/s/);
  h.koniec();
});

test('LEXICON bez dosť glyfov: klik dialóg neotvorí (zatrasie); import pri novšom uložení ho najprv odloží bokom', async () => {
  const s = E.novyStav(5, 1_800_000_000_000);
  Object.assign(s, { sec: 7, stacks: 5, sleeps: 4, lines: 4, act: 2, dec: 4, g: 1e8, tot: 5e9, run: 1e9, R: 30 });
  s.beats = [...bityPred(/^(gc\.c|K\.c|card3|key|end\.|K14|gc\.b11)/), 'wake.2', 'wake.3', 'wake.4'];
  const h = await spusti({ ulozene: U.zbal(s) });
  await h.posun(300);
  h.riadok('LEXICON').click();
  await h.posun(50);
  assert.equal(h.$('dialog').hidden, true);
  h.koniec();

  const novsie = JSON.stringify({ ...E.novyStav(1, 0), v: 99 });
  const h2 = await spusti({ ulozene: novsie });
  await h2.posun(300);
  h2.$('tl-menu').click();
  assert.equal(text(h2.$('m-uklada')), 'saving is paused: a newer save exists.', 'skutočný dôvod, nie "saving is off"');
  h2.$('m-import').value = U.exportuj(s);
  h2.$('m-importuj').click();
  await h2.posun(50);
  assert.equal(h2.pamat.get('tonull.save.bad'), novsie, 'novšie uloženie odložené');
  assert.match(text(h2.$('m-sprava')), /kept aside/);
  h2.koniec();
});

// ------------------------------------------------------------ kolo oprav 2

/** Stav Aktu III (MEND, 2 kľúče, všetky riadky okrem posledných beatov prečítané). */
function stavAkt3(seed = 6) {
  const s = E.novyStav(seed, 1_800_000_000_000);
  Object.assign(s, { sec: 7, stacks: 5, sleeps: 7, lines: 5, act: 3, lex: true, dec: 5, mode: 'consume', mended: 300, keys: 1, g: 1e12, tot: 1e14, run: 1e12, R: 100 });
  s.themes = ['green', 'amber'];
  s.n.loom = 40;
  s.beats = [...bityPred(/^(K\.c9|K\.c10|K\.c11|end\.|key)/), 'wake.2', 'wake.3', 'wake.4', 'wake.5', 'wake.6', 'wake.7'];
  return s;
}

const plneBunky = (d) => { let n = 0; for (let i = 0; i < (d.rows + 1) * (d.cols + 1); i++) if (d.text[i] !== PRAZDNY) n++; return n; };

test('znížený pohyb, Akt III: 90 ťukov (3 za sekundu) nechá aspoň 80 % plných buniek viet', async () => {
  const h = await spusti({ reduced: true, ulozene: U.zbal(stavAkt3()) });
  await h.posun(500);
  const d = h.mod._test.dazd;
  assert.equal(d.akt, 3);
  const p0 = plneBunky(d);
  assert.ok(p0 > 50, `vety na začiatku (${p0})`);
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 90; i++) { h.tukni(10 + rnd() * 600, 10 + rnd() * 540); await h.posun(333); }
  await h.posun(500);
  const p1 = plneBunky(d);
  assert.ok(p1 >= 0.8 * p0, `plné bunky ${p1} z pôvodných ${p0}`);
  h.koniec();
});

test('znížený pohyb: statický dážď sa bez zmeny nekreslí 30× za sekundu, ťuk ho prekreslí', async () => {
  const s = E.novyStav(8, 1_800_000_000_000);
  Object.assign(s, { sec: 1, g: 10, tot: 200, run: 200 });
  s.beats = bityPred(/^K\.c11$/);
  const h = await spusti({ reduced: true, ulozene: U.zbal(s) });
  await h.posun(2000);
  const d = h.mod._test.dazd;
  let n = 0;
  const povodne = d.kresli.bind(d);
  d.kresli = (t) => { n++; povodne(t); };
  await h.posun(3000);
  assert.ok(n <= 6, `${n} prekreslení za 3 s bez zmeny`);
  const pred = n;
  h.tukni(200, 200);
  await h.posun(50);
  assert.ok(n > pred, 'ťuk prekreslí');
  h.koniec();
});

test('LEXICON na vysokom plátne 52 × 65 buniek: celý moment do 1 300 drawImage; otočenie uprostred ho neprekazí', async () => {
  const s = E.novyStav(5, 1_800_000_000_000);
  Object.assign(s, { sec: 7, stacks: 5, sleeps: 4, lines: 4, act: 2, dec: 4, g: 6e8, tot: 5e9, run: 1e9, R: 30 });
  s.n.bank = 30; s.n.hook = 150; s.n.sieve = 100; s.n.thread = 80;
  s.beats = [...bityPred(/^(gc\.c|K\.c|card3|key|end\.|K14|gc\.b11)/), 'wake.2', 'wake.3', 'wake.4'];
  const h = await spusti({ ulozene: U.zbal(s), sirka: 52 * 15 + 4, vyska: 65 * 20 });
  await h.posun(500);
  const d = h.mod._test.dazd;
  assert.equal(d.cols, 52);
  assert.equal(d.rows, 65);
  h.riadok('LEXICON').click();
  await h.posun(50);
  h.$('dialog-ano').click();
  let maxPoz = 0;
  let videlLex = false;
  for (let t = 0; t < 7000; t += 34) {
    await h.posun(34);
    videlLex ||= !!d.lex;
    maxPoz = Math.max(maxPoz, d.pozadovane);
  }
  assert.ok(videlLex, 'moment LEXICON bežal');
  assert.ok(maxPoz <= 1300, `${maxPoz} požadovaných drawImage v momente LEXICON`);
  assert.deepEqual(h.zaznam.zakazane, []);
  h.koniec();

  // otočenie telefónu uprostred momentu: po LEXICON číta mriežka vety, nie glyf 0
  const h2 = await spusti({ ulozene: U.zbal(s), sirka: 624, vyska: 560 });
  await h2.posun(500);
  h2.riadok('LEXICON').click();
  await h2.posun(50);
  h2.$('dialog-ano').click();
  await h2.posun(2000);
  const d2 = h2.mod._test.dazd;
  d2.velkost(420, 700, false, 2);
  await h2.posun(7000);
  assert.equal(d2.akt, 3);
  const w = d2.cols + 1;
  let plne = 0;
  let nula = 0;
  for (let r = 1; r < d2.rows; r++) for (let c = 0; c < d2.cols; c++) { const g = d2.text[r * w + c]; if (g !== PRAZDNY) plne++; if (g === 0) nula++; }
  assert.ok(plne > 0.1 * d2.cols * d2.rows, `vety (${plne})`);
  assert.ok(nula < 0.2 * plne, `glyf 0 v ${nula} z ${plne} buniek`);
  h2.koniec();
});

test('brána: rozpad textu v ďalšej snímke (prechod má odkiaľ ísť); popis hromady bez "+columns", keď pribudnúť nemajú', async () => {
  const sb = E.novyStav(11, 1_800_000_000_000);
  Object.assign(sb, { g: 5000, tot: 5000, run: 5000 });
  sb.n.hook = 5;
  sb.beats = bityPred(/^K\.c11$/);
  const h = await spusti({ ulozene: U.zbal(sb) });
  await h.posun(300);
  const brana = h.riadok('SECTOR 01');
  brana.click();
  assert.ok(!brana.classList.contains('rozpad'), 'v tom istom tiku ešte bez triedy');
  assert.ok(brana.querySelectorAll('.zn').length > 5, 'text rozdelený na znaky');
  await h.posun(20);
  assert.ok(brana.classList.contains('rozpad'), 'v ďalšej snímke rozpad');
  // rozpad trvá 500 ms, ui() beží z tiku logiky po 250 ms
  await h.posun(800);
  assert.ok(!brana.classList.contains('rozpad'), 'po rozpade riadok ďalšej brány bez triedy');
  assert.match(text(brana), /SECTOR 02|[▒░▓█╤│┼═║╪┤├▌▐▀▄]/, 'riadok ukazuje ďalšiu bránu (alebo jej dešifrovanie)');
  h.koniec();

  // telefón: všetky stĺpce už bežia, hromada nesmie sľubovať nové
  const sh = E.novyStav(12, 1_800_000_000_000);
  Object.assign(sh, { sec: 7, sleeps: 1, act: 2, lines: 1, g: 1e6, tot: 1e7, run: 1e6, R: 4 });
  sh.n.hook = 40;
  sh.beats = bityPred(/^(K\.c|card3|key|end\.|gc\.c|K9|K1[0-4]|gc\.b)/);
  const ht = await spusti({ telefon: true, sirka: 319, vyska: 330, ulozene: U.zbal(sh) });
  await ht.posun(300);
  const d = ht.mod._test.dazd;
  assert.equal(d.aktivne, d.cols, 'na telefóne od S04 bežia všetky stĺpce');
  const hr = ht.riadok('STACK A');
  assert.ok(hr, 'riadok STACK A');
  hr.click();
  await ht.posun(1200);
  assert.doesNotMatch(text(ht.$('obraz')), /columns/);
  ht.koniec();
});

test('medzerník na zameranom tlačidle patrí tlačidlu, nie chytaniu; ťuk nad strop je bez letu glyfov', async () => {
  const s = E.novyStav(8, 1_800_000_000_000);
  Object.assign(s, { sec: 3, g: 10, tot: 2000, run: 2000 });
  s.beats = bityPred(/^K\.c11$/);
  const h = await spusti({ ulozene: U.zbal(s) });
  await h.posun(300);
  const t0 = h.mod._test.s.stats.taps;
  h.klaves(' ', { target: h.$('tl-menu') });
  await h.posun(50);
  assert.equal(h.mod._test.s.stats.taps, t0, 'medzerník na [ MENU ] nechytá');
  h.klaves(' ');
  await h.posun(50);
  assert.equal(h.mod._test.s.stats.taps, t0 + 1, 'mimo tlačidla chytá');
  await h.posun(1100);
  const d = h.mod._test.dazd;
  for (let i = 0; i < 10; i++) h.tukni(40 + i * 50);
  for (const l of d.lety) l.on = false;
  h.tukni(300);
  assert.equal(d.lety.filter((l) => l.on).length, 0, 'jedenásty ťuk v sekunde: žiadny let');
  h.koniec();
});

test('PROC bez zdvojeného nadpisu (sekcia JOBS), bez holej čiary pod HOOK ×0, riadky obrazovky zarovnané, vinetácia preč pri čítaní', async () => {
  const h = await spusti();
  await h.posun(2500);
  for (let i = 0; i < 16; i++) { h.tukni(80 + i * 20); await h.posun(120); }
  await h.posun(300);
  assert.equal(h.$('p-proc').hidden, false);
  const proc = text(h.$('proc'));
  assert.match(proc, /├─\[ JOBS \]/);
  assert.doesNotMatch(proc, /\[ PROC \]/, 'nadpis PROC je len v ráme panelu');
  const hak = h.riadok('HOOK');
  assert.match(text(hak), /HOOK ×0/);
  assert.doesNotMatch(text(hak), /─/, 'pod HOOK ×0 nie je holá čiara');
  hak.click();
  await h.posun(400);
  assert.match(text(h.riadok('HOOK')), /[─·]+→/, 's prvým háčikom prietoková čiara so šípkou');
  assert.match(h.$('catch').style.getPropertyValue('--sl'), /^[0-2]\.\d\dpx$/);
  assert.equal(h.$('catch').classList.contains('citanie'), false);
  h.koniec();
  const s = E.novyStav(9, 1_800_000_000_000);
  Object.assign(s, { act: 3, sec: 7, stacks: 5, lex: true, g: 1e9, tot: 1e10, run: 1e9 });
  s.beats = bityPred(/^K\.c11$/);
  const h3 = await spusti({ ulozene: U.zbal(s) });
  await h3.posun(500);
  assert.equal(h3.$('catch').classList.contains('citanie'), true, 'Akt III: vety v daždi bez vinetácie');
  h3.koniec();
});

async function model(n) {
  const h = await spusti({ hladanie: `?obrazovka=${n}` });
  const body = h.dok.body;
  const skryte = (x) => { let p = x; while (p) { if (p.hidden) return true; p = p.parentNode; } return false; };
  const textovy = [];
  const prejdi = (u) => {
    for (const c of u.childNodes) {
      if (c instanceof Uzol) { if (!skryte(c) && c.id !== 'log-sr') prejdi(c); } else if (c.textContent.trim()) textovy.push(c.textContent.trim());
    }
  };
  prejdi(body);
  assert.equal(h.dok.documentElement.dataset.hotovo, '1', `obrazovka ${n}: data-hotovo až po document.fonts.ready`);
  const m = { text: textovy, kreslenie: h.zaznam.draws, zakazane: h.zaznam.zakazane };
  const hash = createHash('sha256').update(JSON.stringify(m)).digest('hex').slice(0, 16);
  h.koniec();
  return { m, hash, h };
}

test('25 statické obrazovky 1 až 9: deterministické, zhoda so ukazky.snap.json, obsah podľa SPEC 7', async () => {
  const hashe = {};
  const modely = {};
  for (let n = 1; n <= 9; n++) {
    const a = await model(n);
    const b = await model(n);
    assert.equal(a.hash, b.hash, `obrazovka ${n} nie je deterministická`);
    assert.deepEqual(a.m.zakazane, []);
    hashe[n] = a.hash;
    modely[n] = a.m.text.join('\n');
    // DUMP_SNAP=cesta: modely obrazoviek na disk (kontrola obsahu pred prepísaním hashov)
    if (process.env.DUMP_SNAP) writeFileSync(`${process.env.DUMP_SNAP}-${n}.json`, JSON.stringify(a.m, null, 1));
  }
  assert.match(modely[1], /there you are\. good\./);
  assert.match(modely[1], /GLYPHS/);
  assert.ok(!/attention/.test(modely[1]));
  assert.match(modely[2], /whoami/);
  assert.match(modely[2], /attention .* 62%/);
  assert.match(modely[2], /SECTOR 04/);
  assert.match(modely[3], /recall/);
  assert.match(modely[3], /STACK B · RETURN TO SENDER/);
  assert.match(modely[3], /DECODER 0\/5/);
  assert.match(modely[4], /GLYPHS/);
  assert.match(modely[5], /the queue turned 6h 12m without you\./);
  assert.match(modely[5], /caught 41\.2K\. half pace, capped at 8h\./);
  assert.match(modely[5], /\[ TAKE IT \]/);
  assert.match(modely[6], /LETTERS/);
  assert.match(modely[6], /mended 412 \/ 11,204/);
  assert.match(modely[6], /keys 2\/3/);
  assert.match(modely[6], /trust .* 41%/);
  assert.match(modely[7], /attention .* 92%/);
  assert.match(modely[7], /CAPACITY 97%|C.P.C1TY 97%|97%/);
  assert.match(modely[8], /uptime 14,624 → 14,625 days/);
  assert.match(modely[9], /ACT IV · UPWARD/);
  assert.match(modely[9], /\[ KEEP MENDING \]/);
  assert.match(modely[9], /msg_0000\. to: NULL\. from: operator console, 05:58\./);
  if (process.env.UPDATE_SNAP) { console.log('SNAP ' + JSON.stringify(hashe)); return; }
  const cesta = join(DIR, 'ukazky.snap.json');
  assert.ok(existsSync(cesta), 'chýba ukazky.snap.json');
  assert.deepEqual(hashe, JSON.parse(readFileSync(cesta, 'utf8')));
});
