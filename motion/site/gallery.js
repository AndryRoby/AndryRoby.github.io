/*
 * arling.sk/motion: the live gallery.
 * Every stage holds a real component you can use. At most one stage plays its demo at a time:
 * the one most in view (IntersectionObserver, at least 60 % visible). A playing stage is inert
 * and draws the demo cursor; pointing at it, touching it or pressing Stop hands it back to you
 * as a live component. With prefers-reduced-motion nothing plays; the components still work and
 * show every state at once.
 * MIT licence.
 */
import { SCENES, copyText, tabsStrip, fontsLoaded } from './scenes.js';
import { seekDemo } from '../components/player.js';
import { createCursor } from './cursor.js';

const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
const reduced = () => !!(mq && mq.matches);
const now = () => performance.now() / 1000;

// ------------------------------------------------------------------ stages

const units = [];
for (const stage of document.querySelectorAll('.mo-stage[data-scene]')) {
  const name = stage.getAttribute('data-scene');
  if (!SCENES[name]) continue;
  const wrap = stage.closest('.mo-stage-wrap') || stage;
  units.push({ stage, wrap, name, button: wrap.querySelector('.mo-play'), mode: null, api: null, raf: 0, cursor: null, held: false, touched: false, ratio: 0 });
}

function clear(u) {
  if (u.raf) cancelAnimationFrame(u.raf);
  u.raf = 0;
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
  u.button.textContent = on ? 'Stop demo' : 'Play demo';
  u.button.setAttribute('aria-pressed', String(on));
  u.button.hidden = reduced();
}

function live(u) {
  clear(u);
  u.mode = 'live';
  u.stage.inert = false;
  u.stage.removeAttribute('data-playing');
  for (const node of SCENES[u.name].build()) u.stage.appendChild(node);
  try { u.api = SCENES[u.name].create(u.stage, {}); } catch (e) { console.error(e); }
  label(u);
}

function play(u) {
  clear(u);
  u.mode = 'demo';
  u.stage.inert = true;
  u.stage.setAttribute('data-playing', '');
  const scene = SCENES[u.name];
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
  const tick = () => {
    const t = (now() - t0) % dur;
    s.seek(t);
    u.cursor.draw(t, s.info);
    u.raf = requestAnimationFrame(tick);
  };
  u.raf = requestAnimationFrame(tick);
  label(u);
}

// ------------------------------------------------------------------ which one plays

let current = null;
let forced = null;
// Nothing is built before the fonts have loaded: demos measure the layout when they are
// scheduled, and widths taken with the fallback font are wrong after the swap.
let started = false;

function pick() {
  document.documentElement.classList.toggle('mo-reduced', reduced());
  if (!started) return;
  let best = null;
  if (!reduced() && !document.hidden) {
    if (forced && forced.ratio > 0 && !forced.touched) best = forced;
    else {
      forced = null;
      let top = 0.6;
      for (const u of units) {
        if (u.held || u.touched) continue;
        if (u.ratio >= top) { best = u; top = u.ratio; }
      }
    }
  }
  if (best === current) { for (const u of units) label(u); return; }
  if (current) live(current);
  current = best;
  if (best) play(best);
  for (const u of units) label(u);
}

for (const u of units) {
  u.wrap.addEventListener('pointerenter', (e) => {
    u.held = true;
    if (e.pointerType === 'touch') u.touched = true;
    if (current === u && forced !== u) pick();
  });
  u.wrap.addEventListener('pointerleave', () => {
    u.held = false;
    if (!current) pick();
  });
  // using the component, not just passing over it, keeps it live until Play is pressed
  for (const type of ['pointerdown', 'keydown', 'focusin']) {
    u.stage.addEventListener(type, () => {
      if (u.mode === 'live' && !u.touched) u.touched = true;    });
  }
  if (u.button) {
    u.button.addEventListener('click', () => {
      if (u.mode === 'demo') {
        u.touched = true;
        forced = null;
        if (current === u) { current = null; live(u); }
        pick();
      } else {
        u.touched = false;
        forced = u;
        // the button sits under the stage, so the stage is in view; the observer corrects this later
        u.ratio = Math.max(u.ratio, 0.01);
        pick();
      }
    });
  }
}

if (typeof IntersectionObserver === 'function') {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const u = units.find((x) => x.stage === e.target);
      if (u) u.ratio = e.isIntersecting ? e.intersectionRatio : 0;
    }
    pick();
  }, { threshold: [0, 0.3, 0.6, 0.75, 0.9, 1] });
  for (const u of units) io.observe(u.stage);
}
document.addEventListener('visibilitychange', pick);
if (mq && mq.addEventListener) mq.addEventListener('change', pick);
pick();

// ------------------------------------------------------------------ still frames of one demo

function stills() {
  for (const frame of document.querySelectorAll('.mo-frame-stage[data-t]')) {
    const t = parseFloat(frame.getAttribute('data-t'));
    frame.appendChild(tabsStrip());
    try {
      const s = seekDemo((clock) => SCENES.tabs.create(frame, { clock, reduced: false }), SCENES.tabs.demo);
      s.seek(t);
      s.api.driver.stop();
      s.api.driver.busy = () => false;
    } catch (e) {
      console.error(e);
    }
    frame.inert = true;
  }
}

// ------------------------------------------------------------------ start after the fonts

fontsLoaded(units.length ? units[0].stage : document.body).then(() => {
  started = true;
  for (const u of units) if (!u.mode) live(u);
  stills();
  pick();
});

// ------------------------------------------------------------------ copy buttons

const status = document.getElementById('mo-status');
const say = (text) => { if (status) { status.textContent = ''; setTimeout(() => { status.textContent = text; }, 30); } };

for (const btn of document.querySelectorAll('button[data-copy]')) {
  const text = btn.getAttribute('data-copy');
  const idle = btn.textContent;
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
      timer = setTimeout(() => { btn.textContent = idle; }, 1800);
    });
  });
}
