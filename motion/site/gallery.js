/*
 * arling.sk/motion: the live gallery.
 * Every stage holds a real component you can use. At most one stage plays its demo at a time:
 * the one most in view (IntersectionObserver, at least 60 % visible). A playing stage is inert
 * and draws the demo cursor; pointing at it, tapping it or pressing Stop hands it back to you
 * as a live component. With prefers-reduced-motion nothing plays; the components still work and
 * show every state at once.
 *
 * Kept smooth on slow devices (measured 3. 10. 2026 with the CPU slowed 4 times):
 *  - the code of a scene (its component and its demo) is fetched with import() only when its
 *    stage comes within one screen of the viewport, so the first view does not download 40
 *    modules; the demo player and the drawn cursor come with the first scene;
 *  - a stage is built only when it comes within one screen of the viewport, in idle time, so the
 *    page does not build 21 components in one long task while it loads;
 *  - nothing is rebuilt while the page scrolls: the demo in view keeps playing, one that left the
 *    view only pauses, and the next one starts once scrolling has stopped;
 *  - a touch that starts a scroll does not take a stage over, only a tap does.
 * MIT licence.
 */
import { copyText, tabsStrip, fontsLoaded } from './scene-kit.js';

// One module per scene, fetched when its stage comes near the viewport (or on the first Play).
const LOAD = {
  hero: () => import('./scenes/hero.js'),
  dialog: () => import('./scenes/dialog.js'),
  tabs: () => import('./scenes/tabs.js'),
  tooltip: () => import('./scenes/tooltip.js'),
  popover: () => import('./scenes/popover.js'),
  toast: () => import('./scenes/toast.js'),
  switch: () => import('./scenes/switch.js'),
  accordion: () => import('./scenes/accordion.js'),
  command: () => import('./scenes/command.js'),
  drawer: () => import('./scenes/drawer.js'),
  carousel: () => import('./scenes/carousel.js'),
  otp: () => import('./scenes/otp.js'),
  dropzone: () => import('./scenes/dropzone.js'),
  number: () => import('./scenes/number.js'),
  island: () => import('./scenes/island.js'),
  segmented: () => import('./scenes/segmented.js'),
  slider: () => import('./scenes/slider.js'),
  morph: () => import('./scenes/morph.js'),
  marquee: () => import('./scenes/marquee.js'),
  sortable: () => import('./scenes/sortable.js'),
  steps: () => import('./scenes/steps.js'),
};

// The demo player and the drawn cursor: needed with the first scene, not before.
let seekDemo = null;
let createCursor = null;
let toolsReady = null;
function tools() {
  if (!toolsReady) {
    toolsReady = Promise.all([import('../components/player.js'), import('./cursor.js')]).then(([p, c]) => {
      seekDemo = p.seekDemo;
      createCursor = c.createCursor;
    });
    toolsReady.catch(() => { toolsReady = null; });
  }
  return toolsReady;
}

// Resolves once the scene of a unit is here (u.scene). A failed download can be tried again.
function load(u) {
  if (!u.loading) {
    u.loading = Promise.all([LOAD[u.name](), tools()]).then(([m]) => { u.scene = m.scene; }, (e) => {
      console.error(e);
      u.loading = null;
    });
  }
  return u.loading;
}

const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
const reduced = () => !!(mq && mq.matches);
const now = () => performance.now() / 1000;
const hasIO = typeof IntersectionObserver === 'function';
// one screen above and below the viewport counts as near
const NEAR = '100% 0px 100% 0px';
// scrolling has stopped when no scroll event came for this long
const SCROLL_REST = 140;

// ------------------------------------------------------------------ stages

const units = [];
for (const stage of document.querySelectorAll('.mo-stage[data-scene]')) {
  const name = stage.getAttribute('data-scene');
  if (!LOAD[name]) continue;
  const wrap = stage.closest('.mo-stage-wrap') || stage;
  units.push({ stage, wrap, name, button: wrap.querySelector('.mo-play'), scene: null, loading: null, mode: null, api: null, raf: 0, tick: null, cursor: null, held: false, touched: false, ratio: 0 });
}
const unitOf = new Map(units.map((u) => [u.stage, u]));

function clear(u) {
  if (u.raf) cancelAnimationFrame(u.raf);
  u.raf = 0;
  u.tick = null;
  if (u.api) {
    try { u.api.destroy(); } catch (e) { console.error(e); }
    u.api = null;
  }
  if (u.cursor) { u.cursor.remove(); u.cursor = null; }
  u.stage.replaceChildren();
}

function label(u) {
  if (!u.button) return;
  const on = u.mode === 'demo';
  const text = on ? 'Stop demo' : 'Play demo';
  if (u.button.textContent !== text) u.button.textContent = text;
  const pressed = String(on);
  if (u.button.getAttribute('aria-pressed') !== pressed) u.button.setAttribute('aria-pressed', pressed);
  const hide = reduced();
  if (u.button.hidden !== hide) u.button.hidden = hide;
}

function live(u) {
  // A scene whose api has handoff(t) (the carousel) continues from the moment of its demo, so
  // taking the stage over mid demo does not make it jump back to its first frame.
  let handoff = null;
  if (u.mode === 'demo' && u.api && typeof u.api.handoff === 'function' && typeof u.t === 'number') {
    try { handoff = u.api.handoff(u.t); } catch (e) { console.error(e); }
  }
  u.t = undefined;
  clear(u);
  u.mode = 'live';
  u.stage.inert = false;
  u.stage.removeAttribute('data-playing');
  for (const node of u.scene.build()) u.stage.appendChild(node);
  try { u.api = u.scene.create(u.stage, handoff ? { handoff } : {}); } catch (e) { console.error(e); }
  label(u);
}

function play(u) {
  clear(u);
  u.mode = 'demo';
  u.stage.inert = true;
  u.stage.setAttribute('data-playing', '');
  const scene = u.scene;
  for (const node of scene.build()) u.stage.appendChild(node);
  let s;
  try {
    s = seekDemo((clock) => scene.create(u.stage, { clock, reduced: false }), scene.demo);
  } catch (e) {
    console.error(e);
    live(u);
    return;
  }
  s.api.driver.stop();
  s.api.driver.busy = () => false;
  u.api = s.api;
  u.cursor = createCursor(u.stage);
  const t0 = now();
  const dur = s.info.duration;
  u.tick = () => {
    const t = (now() - t0) % dur;
    u.t = t;
    s.seek(t);
    u.cursor.draw(t, s.info);
    u.raf = requestAnimationFrame(u.tick);
  };
  u.raf = requestAnimationFrame(u.tick);
  label(u);
}

// A demo that scrolled out of view stops drawing but keeps its DOM, so nothing is rebuilt
// during the scroll; it draws again if it comes back before scrolling stops.
function pause(u) {
  if (u.raf) cancelAnimationFrame(u.raf);
  u.raf = 0;
}
function resume(u) {
  if (!u.raf && u.mode === 'demo' && u.tick) u.raf = requestAnimationFrame(u.tick);
}

// ------------------------------------------------------------------ building near the viewport

const idle = typeof requestIdleCallback === 'function'
  ? (fn) => requestIdleCallback(fn, { timeout: 300 })
  : (fn) => setTimeout(fn, 60);
const queue = [];
let building = false;

function build(u) {
  if (!u.mode && u.scene) live(u);
}

// One stage per idle period: building one measures its layout, and two in a row would be
// a visible pause on a slow phone.
function buildSome() {
  building = false;
  // what is on screen first, then the order of the page
  queue.sort((a, b) => b.ratio - a.ratio);
  const u = queue.shift();
  if (u) build(u);
  if (queue.length) { building = true; idle(buildSome); }
}

function buildSoon(u) {
  if (u.mode || queue.includes(u)) return;
  if (!u.scene) { load(u).then(() => { if (u.scene) buildSoon(u); }); return; }
  queue.push(u);
  if (!building) { building = true; idle(buildSome); }
}

// A stage in view: fetch its scene if needed, then build it at once.
function buildNow(u) {
  if (u.mode) return;
  if (u.scene) { build(u); return; }
  load(u).then(() => {
    if (!u.scene || u.mode) return;
    if (u.ratio > 0) { build(u); pick(); } else buildSoon(u);
  });
}

// ------------------------------------------------------------------ which one plays

let current = null;
let forced = null;
// Nothing is built before the fonts have loaded: demos measure the layout when they are
// scheduled, and widths taken with the fallback font are wrong after the swap.
let started = false;
let scrolling = false;
let scrollTimer = 0;

function pick() {
  document.documentElement.classList.toggle('mo-reduced', reduced());
  if (!started) return;
  if (scrolling) {
    if (current) { if (current.ratio > 0 && !document.hidden) resume(current); else pause(current); }
    return;
  }
  let best = null;
  if (!reduced() && !document.hidden) {
    if (forced && forced.scene && forced.ratio > 0 && !forced.touched) best = forced;
    else {
      forced = null;
      let top = 0.6;
      for (const u of units) {
        if (u.held || u.touched || !u.scene) continue;
        if (u.ratio >= top) { best = u; top = u.ratio; }
      }
    }
  }
  if (best === current) { if (current) resume(current); for (const u of units) label(u); return; }
  if (current) live(current);
  current = best;
  if (best) play(best);
  for (const u of units) label(u);
}

addEventListener('scroll', () => {
  scrolling = true;
  clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => { scrolling = false; pick(); }, SCROLL_REST);
}, { passive: true });

for (const u of units) {
  u.wrap.addEventListener('pointerenter', (e) => {
    // a finger that lands on a stage usually starts a scroll; only a tap (click below) takes over
    if (e.pointerType === 'touch') return;
    u.held = true;
    if (current === u && forced !== u) pick();
  });
  u.wrap.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'touch') return;
    u.held = false;
    if (!current) pick();
  });
  // a tap or click on a playing stage hands it over (the stage is inert, so the wrap gets the click)
  u.wrap.addEventListener('click', (e) => {
    if (u.mode !== 'demo' || (u.button && u.button.contains(e.target))) return;
    u.touched = true;
    forced = null;
    if (current === u) { current = null; live(u); }
    pick();
  });
  // using the component, not just passing over it, keeps it live until Play is pressed
  for (const type of ['pointerdown', 'keydown', 'focusin']) {
    u.stage.addEventListener(type, () => {
      if (u.mode === 'live' && !u.touched) u.touched = true;
    });
  }
  if (u.button) {
    u.button.addEventListener('click', () => {
      if (u.mode === 'demo') {
        u.touched = true;
        forced = null;
        if (current === u) { current = null; live(u); }
        pick();
      } else {
        const start = () => {
          if (!u.scene) return;
          build(u);
          u.touched = false;
          forced = u;
          // the button sits under the stage, so the stage is in view; the observer corrects this later
          u.ratio = Math.max(u.ratio, 0.01);
          // pressing Play is a clear wish: it starts even while the page still glides
          scrolling = false;
          pick();
        };
        if (u.scene) start(); else load(u).then(start);
      }
    });
  }
}

document.addEventListener('visibilitychange', pick);
if (mq && mq.addEventListener) mq.addEventListener('change', pick);
pick();

// ------------------------------------------------------------------ still frames of one demo

function stills() {
  Promise.all([LOAD.tabs(), tools()]).then(([m]) => {
    const tabs = m.scene;
    for (const frame of document.querySelectorAll('.mo-frame-stage[data-t]')) {
      if (frame.firstChild) continue;
      const t = parseFloat(frame.getAttribute('data-t'));
      frame.appendChild(tabsStrip());
      try {
        const s = seekDemo((clock) => tabs.create(frame, { clock, reduced: false }), tabs.demo);
        s.seek(t);
        s.api.driver.stop();
        s.api.driver.busy = () => false;
      } catch (e) {
        console.error(e);
      }
      frame.inert = true;
    }
  }, (e) => console.error(e));
}

// ------------------------------------------------------------------ start after the styles and the fonts

// The full stylesheets of this page load after the first paint (/style/vzhlad.js turns them on and
// then sets the class css on <html>). A scene measures its layout when it is built, so nothing is
// built before they are on.
const stylesOn = () => new Promise((resolve) => {
  if (document.documentElement.classList.contains('css') || !document.querySelector('link[data-async]')) resolve();
  else document.addEventListener('arling:css', () => resolve(), { once: true });
});

stylesOn().then(() => fontsLoaded(units.length ? units[0].stage : document.body)).then(() => {
  started = true;
  const frames = document.querySelector('.mo-frames');
  if (!hasIO) {
    for (const u of units) buildNow(u);
    stills();
    pick();
    return;
  }
  // how much of each stage is in view: decides which demo plays; a stage in view is built at once
  const seen = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const u = unitOf.get(e.target);
      if (!u) continue;
      u.ratio = e.isIntersecting ? e.intersectionRatio : 0;
      if (u.ratio > 0) buildNow(u);
    }
    pick();
  }, { threshold: [0, 0.3, 0.6, 0.75, 0.9, 1] });
  // a stage within one screen of the viewport is built ahead, in idle time
  const near = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      near.unobserve(e.target);
      if (e.target === frames) { idle(stills); continue; }
      const u = unitOf.get(e.target);
      if (u) buildSoon(u);
    }
  }, { rootMargin: NEAR });
  for (const u of units) { seen.observe(u.stage); near.observe(u.stage); }
  if (frames) near.observe(frames);
});

// ------------------------------------------------------------------ copy buttons

const status = document.getElementById('mo-status');
const say = (text) => { if (status) { status.textContent = ''; setTimeout(() => { status.textContent = text; }, 30); } };

for (const btn of document.querySelectorAll('button[data-copy]')) {
  const text = btn.getAttribute('data-copy');
  const idleText = btn.textContent;
  let timer = 0;
  btn.addEventListener('click', () => {
    copyText(text).then((ok) => {
      clearTimeout(timer);
      if (ok) {
        btn.textContent = 'Copied';
        say('Install command copied.');
      } else {
        const code = btn.parentElement && btn.parentElement.querySelector('code');
        if (code && getSelection) {
          const range = document.createRange();
          range.selectNodeContents(code);
          const sel = getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        }
        btn.textContent = 'Press Ctrl+C';
        say('The command is selected. Press Ctrl+C or Cmd+C to copy it.');
      }
      timer = setTimeout(() => { btn.textContent = idleText; }, 1800);
    });
  });
}
