/*
 * ARLing Motion: Drawer (a bottom sheet you can drag).
 * The panel rises from the bottom edge on a spring. While you drag it, it follows your
 * pointer 1:1 (above its open place it resists, like a rubber band). When you let go, a
 * spring takes over from where the panel is and how fast it moved: a flick or a pull past
 * the middle closes it, anything else sends it back home.
 *
 * Markup:
 *   <button class="am-drawer-trigger">Edit goal</button>
 *   <div class="am-drawer" hidden>
 *     <div class="am-drawer-overlay"></div>
 *     <div class="am-drawer-panel" role="dialog" aria-labelledby="goal-title">
 *       <div class="am-drawer-handle"></div>
 *       <div class="am-drawer-content">
 *         <h2 id="goal-title">Daily goal</h2> ...
 *         <button data-am-close>Close</button>
 *       </div>
 *     </div>
 *   </div>
 *
 * Keyboard (WAI-ARIA APG, modal dialog): Enter or Space on the trigger opens, focus moves
 * inside, Tab and Shift+Tab stay inside, Escape closes and focus returns to the trigger.
 * Dragging is never the only way: Escape, the overlay and any [data-am-close] close it
 * (WCAG 2.5.7). Pressing on a button, link or field inside the panel does not start a drag,
 * and neither does anything inside [data-am-no-drag] (use it for scrolling content).
 * MIT licence.
 */
import { track, presence, applyPresence, driver, spring, steps, attr, PRESETS } from '../../src/core.js';

// ------------------------------------------------------------------ helpers

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const px = (v) => `${Math.round(v * 100) / 100}px`;
const num = (v) => String(Math.round(v * 10000) / 10000);
const SHOWN = { opacity: 1, blur: 0, y: 0, scale: 1, visible: true };
const GONE = { opacity: 0, blur: 0, y: 0, scale: 1, visible: false };

let uid = 0;
const ensureId = (el, prefix) => el.id || (el.id = `${prefix}-${++uid}`);

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]';
function tabbables(root) {
  return [...root.querySelectorAll(FOCUSABLE)].filter((el) => !el.disabled && el.tabIndex >= 0 && !el.closest('[hidden], [inert]'));
}

/** Easing of a scheduled pointer path, with its slope (for the release velocity). */
export const EASE = {
  linear: [(u) => u, () => 1],
  in: [(u) => u * u, (u) => 2 * u],
  out: [(u) => 1 - (1 - u) * (1 - u), (u) => 2 * (1 - u)],
  inOut: [(u) => u * u * (3 - 2 * u), (u) => 6 * u * (1 - u)],
};

/**
 * A recorded pointer path as a pure function of time: samples [[t, offset]] in time order,
 * linear between samples. The last 2 ms run at the release velocity v, so a Track that
 * measures the slope at the end of the drag gets exactly v.
 */
export function pathFn(samples, v) {
  const [t1, end] = samples[samples.length - 1];
  const tail = 1 / 480;
  return (t) => {
    if (t >= t1 - tail) return end + v * (t - t1);
    if (t <= samples[0][0]) return samples[0][1];
    for (let i = 1; i < samples.length; i++) {
      const [tb, b] = samples[i];
      if (t <= tb) {
        const [ta, a] = samples[i - 1];
        return tb === ta ? b : a + ((b - a) * (t - ta)) / (tb - ta);
      }
    }
    return end;
  };
}

/** Pointer velocity over the last 0.1 s of samples, units per second. */
export function releaseVelocity(samples, window = 0.1) {
  if (samples.length < 2) return 0;
  const [t1, end] = samples[samples.length - 1];
  let j = samples.length - 2;
  while (j > 0 && t1 - samples[j][0] < window) j--;
  const [t0, start] = samples[j];
  return t1 > t0 ? (end - start) / (t1 - t0) : 0;
}

// ------------------------------------------------------------------ drawer

/** How far the panel may be pulled above its open place, px (it approaches this). */
export const RUBBER = 48;
/** A release faster than this (px/s) decides by direction alone. */
export const FLICK = 600;
const DRAG_SPRING = spring(0.5, 0.9);

/**
 * createDrawer({ trigger, root, onOpenChange, clock, reduced })
 * drag(dy, { t, duration, ease }) schedules a pointer drag for demos ('linear', 'in', 'out',
 * 'inOut'); the live pointer path goes through the same code on release.
 * Returns { open, close, toggle, drag, isOpen, height, position, seek, settled, destroy,
 * driver, trigger, root, panel, handle, content, keep }.
 */
export function createDrawer(o) {
  const trigger = o.trigger;
  const root = o.root;
  const doc = root.ownerDocument || document;
  const panel = root.querySelector('.am-drawer-panel') || root.querySelector('[role="dialog"]');
  const overlay = root.querySelector('.am-drawer-overlay');
  const content = panel.querySelector('.am-drawer-content') || panel;
  let handle = panel.querySelector('.am-drawer-handle');
  if (!handle) {
    handle = doc.createElement('div');
    handle.className = 'am-drawer-handle';
    panel.insertBefore(handle, panel.firstElementChild);
  }
  attr(handle, 'aria-hidden', 'true');

  attr(panel, 'role', 'dialog');
  attr(panel, 'aria-modal', 'true');
  if (!panel.hasAttribute('tabindex')) attr(panel, 'tabindex', '-1');
  if (!panel.hasAttribute('aria-labelledby') && !panel.hasAttribute('aria-label')) {
    const title = panel.querySelector('h1, h2, h3, .am-drawer-title');
    if (title) attr(panel, 'aria-labelledby', ensureId(title, 'am-drawer-title'));
  }
  ensureId(panel, 'am-drawer');
  if (trigger.tagName === 'BUTTON' && !trigger.hasAttribute('type')) attr(trigger, 'type', 'button');
  attr(trigger, 'aria-haspopup', 'dialog');
  attr(trigger, 'aria-controls', panel.id);

  // y: 0 = open, 1 = closed (below the edge), as a share of the panel height
  const openS = steps(false);
  const geo = steps({ H: 320 });
  const y = track(1, PRESETS.snappy);
  const body = presence(false, { dyIn: 10, dyOut: 6, blur: 4, scaleFrom: 1 });
  let live = null; // a drag in progress: { t0, grab, startY, samples }
  let endT = -Infinity;
  const mark = (t) => { if (t > endT) endT = t; };
  const settledAll = (t) => y.settled(t) && body.settled(t);

  function measure() {
    const was = root.hidden;
    root.hidden = false;
    const r = panel.getBoundingClientRect();
    root.hidden = was;
    return { H: r.height || geo.last.H };
  }

  /** Above the open place the panel resists: it approaches RUBBER px. */
  const shape = (frac, H) => {
    if (frac >= 0) return frac;
    const over = -frac * H;
    return -(RUBBER * (1 - 1 / (1 + over / RUBBER))) / H;
  };

  function yAt(t, reduced) {
    if (reduced) return y.target(t);
    if (live && t >= live.t0) {
      const last = live.samples[live.samples.length - 1][1];
      return shape(live.grab + last / geo.last.H, geo.last.H);
    }
    return y.at(t);
  }

  function paint(t, { reduced }) {
    const isOpen = openS.at(t);
    const still = reduced || (settledAll(t) && !live);
    attr(trigger, 'aria-expanded', String(isOpen));
    attr(trigger, 'data-state', isOpen ? 'open' : 'closed');
    attr(panel, 'data-state', isOpen ? 'open' : 'closed');
    root.hidden = !(isOpen || !still);
    if (root.hidden) return;
    const H = geo.at(t).H;
    const v = yAt(t, reduced);
    panel.style.transform = `translateY(${px(v * H)})`;
    if (overlay) overlay.style.opacity = num(clamp01(1 - v));
    applyPresence(content, reduced ? (isOpen ? SHOWN : GONE) : body.at(t));
  }

  function draw(t, s) {
    paint(t, s);
    if (!api.keep && !live && t >= endT && openS.ev.length && settledAll(t)) {
      y.compact(t);
      body.p.compact(t);
      body.marks = [];
      openS.compact();
      geo.compact();
    }
  }

  const d = driver(draw, { clock: o.clock, reduced: o.reduced });
  d.busy = (t) => !!live || t < endT || !settledAll(t);
  const commit = () => { paint(d.now(), { reduced: d.reduced }); d.kick(); };
  const when = (opt) => (opt && opt.t !== undefined ? { t: opt.t, live: false } : { t: d.now(), live: true });

  function open(opt = {}) {
    const { t, live: now } = when(opt);
    if (openS.last) return api;
    geo.set(t, measure());
    openS.set(t, true);
    y.to(t, 0, PRESETS.snappy);
    body.enter(t + 0.1);
    mark(t + 0.1);
    commit();
    if (now) {
      (panel.querySelector('[autofocus]') || tabbables(content)[0] || panel).focus();
      if (o.onOpenChange) o.onOpenChange(true);
    }
    return api;
  }

  function closeAt(t) {
    openS.set(t, false);
    body.exit(t);
    y.to(t, 1, PRESETS.snappy);
    mark(t);
  }

  function close(opt = {}) {
    const { t, live: now } = when(opt);
    if (!openS.last) return api;
    closeAt(t);
    commit();
    if (now) {
      trigger.focus();
      if (o.onOpenChange) o.onOpenChange(false);
    }
    return api;
  }

  /**
   * Commits a drag from t0 to t1: offset(t) is the pointer's travel in px since t0, v its
   * velocity at t1 in px/s. Decides where the spring goes and returns true when it closes.
   */
  function commitDrag(t0, t1, offset, v) {
    const H = geo.last.H;
    y.drag(t0, t1, (t, grab) => shape(grab + offset(t) / H, H), DRAG_SPRING);
    const end = y.at(t1);
    const closes = v > FLICK || (v > -FLICK && end + (v / H) * 0.15 > 0.5);
    if (closes) closeAt(t1);
    mark(t1);
    return closes;
  }

  /** Scheduled drag for demos: the pointer travels dy px from t over duration s. */
  function drag(dy, opt = {}) {
    const t0 = opt.t ?? d.now();
    const dur = opt.duration ?? 0.4;
    const [e, slope] = EASE[opt.ease || 'inOut'];
    const t1 = t0 + dur;
    const offset = (t) => dy * e(clamp01((t - t0) / dur));
    commitDrag(t0, t1, offset, (dy * slope(1)) / dur);
    commit();
    return api;
  }

  // ---------------------------------------------------------------- live input
  const listeners = [];
  const on = (target, type, fn) => { target.addEventListener(type, fn); listeners.push([target, type, fn]); };

  on(trigger, 'click', () => (openS.last ? close() : open()));
  on(root, 'keydown', (e) => {
    if (!openS.last) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if (e.key !== 'Tab') return;
    const list = tabbables(content);
    if (!list.length) { e.preventDefault(); panel.focus(); return; }
    const first = list[0];
    const lastEl = list[list.length - 1];
    const active = doc.activeElement;
    if (e.shiftKey && (active === first || active === panel || !panel.contains(active))) { e.preventDefault(); lastEl.focus(); }
    else if (!e.shiftKey && (active === lastEl || !panel.contains(active))) { e.preventDefault(); first.focus(); }
  });
  // a click that ends a drag is not a click on the overlay or on a close button
  let moved = false;
  on(root, 'click', (e) => {
    const target = e.target;
    if (live) return;
    if (moved) { moved = false; return; }
    if (target === overlay || (target.closest && target.closest('[data-am-close]'))) close();
  });
  on(root, 'keydown', () => { moved = false; });

  on(root, 'pointerdown', () => { moved = false; });
  on(panel, 'pointerdown', (e) => {
    if (!openS.last || (e.button !== undefined && e.button !== 0)) return;
    const target = e.target;
    if (target !== handle && target.closest && target.closest('button, a, input, textarea, select, label, [data-am-no-drag]')) return;
    const t0 = d.now();
    live = { t0, grab: y.at(t0), startY: e.clientY, samples: [[t0, 0]], id: e.pointerId };
    moved = false;
    if (panel.setPointerCapture && e.pointerId !== undefined) { try { panel.setPointerCapture(e.pointerId); } catch { /* not captured */ } }
    commit();
  });
  on(panel, 'pointermove', (e) => {
    if (!live) return;
    const dy = e.clientY - live.startY;
    if (Math.abs(dy) > 3) moved = true;
    live.samples.push([d.now(), dy]);
    commit();
  });
  const finish = (e) => {
    if (!live) return;
    const t1 = d.now();
    const dy = e && e.clientY !== undefined && e.type !== 'pointercancel' ? e.clientY - live.startY : live.samples[live.samples.length - 1][1];
    const samples = live.samples.concat([[t1, dy]]);
    const v = releaseVelocity(samples);
    const { t0 } = live;
    live = null;
    const closes = commitDrag(t0, Math.max(t1, t0 + 1e-6), pathFn(samples, v), v);
    commit();
    if (closes) {
      trigger.focus();
      if (o.onOpenChange) o.onOpenChange(false);
    }
  };
  on(panel, 'pointerup', finish);
  on(panel, 'pointercancel', finish);

  const api = {
    trigger,
    root,
    panel,
    handle,
    content,
    driver: d,
    keep: false,
    open,
    close,
    toggle: (opt) => (openS.last ? close(opt) : open(opt)),
    drag,
    isOpen: (t) => (t === undefined ? openS.last : openS.at(t)),
    /** Panel height in px, measured when it last opened. */
    height: () => geo.last.H,
    /** Position as a share of the panel height: 0 open, 1 closed, below 0 pulled above. */
    position: (t) => yAt(t ?? d.now(), d.reduced),
    seek: (t) => paint(t, { reduced: d.reduced }),
    settled: (t) => !live && t >= endT && settledAll(t),
    destroy() {
      d.stop();
      for (const [target, type, fn] of listeners) target.removeEventListener(type, fn);
    },
  };
  paint(d.now(), { reduced: d.reduced });
  return api;
}
