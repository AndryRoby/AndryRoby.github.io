/*
 * demo.html: one component on a clean canvas, for rendering video frames.
 *
 *   demo.html?c=tabs                 the demo plays live in a loop
 *   demo.html?c=tabs&t=1.25          the frame at 1.25 s, painted once and held
 *   &w=360&h=640                     canvas size in CSS pixels (default: the window)
 *   &cursor=1                        draw the demo cursor (clicks, drags, carried file, keys)
 *   &theme=dark                      the dark shadcn palette instead of warm paper
 *
 *   &render=1                        like t=0: no live loop, the renderer seeks
 *
 * The scene is built and its demo scheduled only after the web fonts have loaded
 * (document.fonts.ready): demos measure the layout (tab edges, bubble widths, menu rows) when
 * they are scheduled, and a measurement taken with the fallback font would be wrong for every
 * frame after the font swap.
 *
 * For a renderer, window.__motion = { ready, scene, duration, fps, info, seek(t), frames(fps) }:
 * wait for document.documentElement.dataset.ready === '1', then call __motion.seek(t) for every
 * frame and capture the page. Render at deviceScaleFactor 3 for 1080 x 1920 from w=360&h=640.
 * The frame at t = duration equals the frame at t = 0, so the clip loops.
 * window.__pohyb offers the interface of ops/video/pohyb (ready, meta, seek, seekRaw), with a
 * click sound on every click, press, drop and key of the demo. It exists as soon as the module
 * runs; its ready promise resolves after the fonts have loaded and the scene is built.
 * MIT licence.
 */
import { SCENES, fontsLoaded } from './scenes.js';
import { seekDemo } from '../components/player.js';
import { createCursor } from './cursor.js';

const params = new URLSearchParams(location.search);
const name = params.get('c') || 'tabs';
const tParam = params.get('t');
const w = parseInt(params.get('w') || '', 10);
const hgt = parseInt(params.get('h') || '', 10);
const withCursor = params.get('cursor') === '1';
const canvas = document.getElementById('canvas');
const stage = document.getElementById('stage');
const error = document.getElementById('error');

function fail(message) {
  error.hidden = false;
  error.textContent = message;
  document.documentElement.dataset.ready = 'error';
}

if (params.get('theme') === 'dark') document.documentElement.dataset.theme = 'dark';
if (w > 0) canvas.style.width = `${w}px`;
if (hgt > 0) canvas.style.height = `${hgt}px`;

const scene = SCENES[name];
if (!scene) {
  fail(`Unknown component "${name}". Use one of: ${Object.keys(SCENES).join(', ')}.`);
} else {
  document.title = `${scene.title}: ARLing Motion demo`;
  stage.setAttribute('data-scene', name);
  stage.setAttribute('aria-label', `${scene.title}, demo`);
  stage.inert = true;

  let s = null;
  let cursor = null;
  let sounds = [];
  const paint = (t) => {
    if (!s) return;
    s.seek(t);
    if (cursor) cursor.draw(t, s.info);
  };
  const D = () => (s ? s.info.duration : 0);

  window.__motion = {
    ready: false,
    scene: name,
    get duration() { return D(); },
    fps: 60,
    get info() { return s ? s.info : null; },
    seek: paint,
    /** Frame times for a whole loop at fps frames per second (the last frame before duration). */
    frames: (fps = 60) => Array.from({ length: Math.round(D() * fps) }, (_, i) => i / fps),
  };

  /** Builds the scene and schedules its demo, with the final fonts in the layout. */
  const build = () => {
    for (const node of scene.build()) stage.appendChild(node);
    s = seekDemo((clock) => scene.create(stage, { clock, reduced: false }), scene.demo);
    s.api.driver.stop();
    s.api.driver.busy = () => false;
    cursor = withCursor ? createCursor(stage) : null;
    sounds = [
      ...s.info.cursor.filter((k) => k.click || k.down || k.drop).map((k) => ({ t: k.t, type: 'click', gain: k.click ? 1 : 0.6, note: '' })),
      ...(s.info.keys || []).map((k) => ({ t: k.t, type: 'click', gain: 0.5, note: '' })),
    ].map((x) => ({ ...x, t: Math.round(x.t * 1000) / 1000 })).sort((a, b) => a.t - b.t);
  };

  const start = () => {
    if (tParam !== null || params.get('render') === '1') {
      const t = Math.max(0, parseFloat(tParam || '0') || 0);
      paint(t);
    } else {
      const t0 = performance.now() / 1000;
      const tick = () => {
        paint((performance.now() / 1000 - t0) % D());
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
    window.__motion.ready = true;
    document.documentElement.dataset.ready = '1';
  };

  const built = fontsLoaded(stage).then(() => {
    try {
      build();
    } catch (e) {
      fail(`The demo failed to build: ${e && e.message ? e.message : e}`);
      throw e;
    }
    start();
  });

  // The same interface as the ARLing video engine (ops/video/pohyb, define()), so its renderer
  // can drive this page: ready (font check), meta() with click sounds, seek and seekRaw.
  window.__pohyb = {
    get duration() { return D(); },
    bpm: 120,
    seekRaw: paint,
    seek: (t) => { const d = D(); if (d > 0) paint(((t % d) + d) % d); },
    meta: () => ({ duration: D(), bpm: 120, music: {}, sounds, title: `ARLing Motion: ${scene.title}` }),
    ready: built.then(
      () => (document.fonts ? document.fonts.check('600 40px "ARLing Sans"') : true),
      () => false,
    ),
  };
}
