/*
 * ARLing Motion: Marquee.
 * An endless horizontal band, like the Marquee of Magic UI or an infinite slider. The position
 * of the band is a pure function of time: the distance so far is the speed times the integral
 * of a rate (1 is full speed, 0 is standing), and that integral is written in closed form for
 * every spring (springArea below), so seek(t) paints any moment exactly. Pointing at the band or
 * moving focus into it adds one spring that takes the rate to 0, so the band coasts to a stop
 * instead of jumping; leaving adds a spring back to 1, so it picks up speed again. Keyboard
 * focus also glides the focused item into the middle of the band on a spring, so what has focus
 * can be read. A button pauses the band for good (WCAG 2.2.2 Pause, Stop, Hide).
 *
 * The content is copied exactly as often as the width needs, so the band never shows a gap:
 * ceil(width / content) copies after the original, and one before it, so that an item near the
 * start can glide to the middle while it has focus and the band still has no gap on the left.
 * The copies are aria-hidden and inert: screen readers and the Tab key meet every item once,
 * in the original, and the original is always the one shown while it has focus.
 * With prefers-reduced-motion the band stands at its start, the copies are hidden, the button
 * is hidden and the band scrolls sideways like a normal list.
 *
 * Markup:
 *   <div class="am-marquee" role="group" aria-label="Our tools" data-speed="40">
 *     <div class="am-marquee-viewport">
 *       <div class="am-marquee-track">
 *         <ul class="am-marquee-group">
 *           <li class="am-marquee-item"><a href="/tool-a/">Tool A</a></li>
 *           <li class="am-marquee-item"><a href="/tool-b/">Tool B</a></li>
 *         </ul>
 *       </div>
 *     </div>
 *   </div>
 * The component adds the parts that are missing (viewport, track, the copies and the pause
 * button .am-marquee-toggle). Options may also come from data-speed (px per second),
 * data-direction ("left" or "right") and data-pause-on-hover="false".
 * Horizontal, in a left to right layout. Calls are expected in time order.
 * MIT licence.
 */
import { track, driver, steps, attr, spring, springDisp, PRESETS } from '../../src/core.js';

/** Default speed, px per second. */
export const SPEED = 40;
/** The rate falls to 0 on this spring: critically damped, so the band never runs backwards. */
export const STOP = spring(0.62, 1);
/** The rate climbs back to 1 on this spring: critically damped, so it never runs faster than set. */
export const START = spring(0.6, 1);
/** Keyboard focus glides the focused item into view on this spring. */
export const GLIDE = PRESETS.smooth;
export const DIRECTIONS = ['left', 'right'];
/** aria-label of the button while the band runs (pause) and while it is paused (play). */
export const LABELS = { pause: 'Pause scrolling', play: 'Resume scrolling' };

const TWO_PI = 2 * Math.PI;
const px = (v) => `${Math.round(v * 100) / 100}px`;
const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]';

/** Velocity of springDisp(sp, tau, 1, 0): a unit displacement let go at rest, closed form. */
function dispVel(sp, tau) {
  const w = TWO_PI / sp.response;
  const z = sp.damping;
  if (Math.abs(z - 1) < 1e-6) return -w * w * tau * Math.exp(-w * tau);
  if (z < 1) {
    const wd = w * Math.sqrt(1 - z * z);
    return -Math.exp(-z * w * tau) * ((w * w) / wd) * Math.sin(wd * tau);
  }
  const s = Math.sqrt(z * z - 1);
  const r1 = -w * (z - s);
  const r2 = -w * (z + s);
  const A = -r2 / (r1 - r2);
  return A * r1 * Math.exp(r1 * tau) + (1 - A) * r2 * Math.exp(r2 * tau);
}

/** Seconds a unit step of this spring ends up behind an instant jump: 2 * damping / omega. */
export const lagOf = (sp) => (sp.damping * sp.response) / Math.PI;

/**
 * The integral of springStep(sp, s) for s from 0 to tau, in closed form: how far a speed that
 * steps from 0 to 1 along the spring has carried something after tau seconds. From the spring
 * equation x'' + 2zw x' + w^2 x = 0 with x(0) = 1 and x'(0) = 0, the integral of the
 * displacement x is (2zw (1 - x) - x') / w^2, and the step is 1 - x. Once the spring is home
 * (springDisp returns exactly 0) this is tau - lagOf(sp).
 */
export function springArea(sp, tau) {
  if (tau <= 0) return 0;
  const w = TWO_PI / sp.response;
  const x = springDisp(sp, tau, 1, 0);
  const v = x === 0 ? 0 : dispVel(sp, tau);
  return tau - (2 * sp.damping * w * (1 - x) - v) / (w * w);
}

/**
 * How many groups a viewport W px wide needs with content P px wide, the original included:
 * one copy before it and ceil(W / P) after it. The band shows the track from P + phase. The
 * phase is in [0, P) while it runs and, while an item has keyboard focus, in a window of one
 * group around where that item rests, which stays within [-P / 2, 1.5 P - W / 2). In both cases
 * the groups reach past the right edge of the viewport, so there is never a gap.
 */
export function copiesFor(W, P) {
  return P > 0 && W > 0 ? Math.ceil(W / P) + 2 : 3;
}

const stoppedBy = (f) => f.paused || f.hovered || f.focused;

/**
 * createMarquee({ root, speed, direction, pauseOnHover, paused, labels, onPauseChange, clock, reduced })
 * speed: px per second (default 40); direction: 'left' (default) or 'right'; paused: start
 * paused; labels: { pause, play } for the button. onPauseChange(paused) runs when the button
 * (or pause, play, toggle without { t }) changes the paused state.
 * hover(on, { t }), focusItem(i, { t, glide }), blur({ t }), pause, play and toggle schedule
 * input for demos; loop(duration) makes a scheduled demo end where it started.
 * Returns { root, viewport, track, button, groups, items, driver, keep, hover, focusItem,
 * blur, pause, play, toggle, paused, loop, measure, refresh, offset, speed, period, seek,
 * settled, destroy }.
 */
export function createMarquee(o) {
  const root = o.root;
  const doc = root.ownerDocument || document;
  const data = (k) => (root.hasAttribute(`data-${k}`) ? root.getAttribute(`data-${k}`) : undefined);
  const num = (v, fallback) => (v === undefined || v === null || v === '' || !Number.isFinite(Number(v)) ? fallback : Number(v));
  const make = (cls, tag = 'div') => { const el = doc.createElement(tag); el.className = cls; return el; };

  // ---------------------------------------------------------------- parts
  root.classList.add('am-marquee');
  for (const old of root.querySelectorAll('[data-am-copy]')) old.remove();
  const group = root.querySelector('.am-marquee-group');
  if (!group) throw new Error('createMarquee: no .am-marquee-group inside the root');
  let viewport = root.querySelector('.am-marquee-viewport');
  if (!viewport) {
    viewport = make('am-marquee-viewport');
    root.insertBefore(viewport, root.firstElementChild);
  }
  let trackEl = viewport.querySelector('.am-marquee-track');
  if (!trackEl) {
    trackEl = make('am-marquee-track');
    viewport.appendChild(trackEl);
  }
  if (group.parentNode !== trackEl) trackEl.insertBefore(group, trackEl.firstElementChild);
  let button = root.querySelector('.am-marquee-toggle');
  if (!button) {
    button = make('am-marquee-toggle', 'button');
    root.appendChild(button);
  }
  if (button.tagName === 'BUTTON' && !button.hasAttribute('type')) attr(button, 'type', 'button');

  const speed0 = Math.max(0, num(o.speed ?? data('speed'), SPEED));
  const s = (o.direction ?? data('direction')) === 'right' ? -1 : 1;
  const pauseOnHover = o.pauseOnHover ?? data('pause-on-hover') !== 'false';
  const labels = { ...LABELS, ...(o.labels || {}) };

  let items = [];
  let lead = null; // the copy before the original
  const after = []; // the copies after it
  const copies = () => (lead ? [lead, ...after] : after.slice());
  const readItems = () => { items = [...group.children].filter((c) => c.tagName); };
  readItems();

  /** A copy of the content: hidden from screen readers and the Tab key, without ids. */
  function copy() {
    const c = group.cloneNode(true);
    c.removeAttribute('id');
    for (const el of c.querySelectorAll('[id]')) el.removeAttribute('id');
    for (const el of c.querySelectorAll('[data-focused]')) el.removeAttribute('data-focused');
    attr(c, 'data-am-copy', true);
    attr(c, 'aria-hidden', 'true');
    attr(c, 'inert', true);
    return c;
  }
  /** n groups in all (copiesFor): one copy before the original, n - 2 after it. */
  function setCopies(n) {
    if (!lead) {
      lead = copy();
      trackEl.insertBefore(lead, group);
    }
    while (after.length < n - 2) {
      const c = copy();
      trackEl.appendChild(c);
      after.push(c);
    }
    while (after.length > Math.max(0, n - 2)) after.pop().remove();
  }
  function clearCopies() {
    if (lead) lead.remove();
    lead = null;
    while (after.length) after.pop().remove();
  }

  // ---------------------------------------------------------------- geometry, per layout change
  function measureGeo() {
    const vr = viewport.getBoundingClientRect();
    const gr = group.getBoundingClientRect();
    // k: screen pixels per layout pixel, for a band inside a scaled parent. offsetWidth is a
    // whole number, so k is only trusted when it is clearly not 1: the loop needs the exact
    // subpixel width of a group, or the band would jump a little at every round.
    const lw = group.offsetWidth || 0;
    const raw = lw > 0 && gr.width > 0 ? gr.width / lw : 1;
    const k = Math.abs(raw - 1) < 0.01 ? 1 : raw;
    return {
      W: vr.width / k,
      P: gr.width / k,
      items: items.map((el) => {
        const r = el.getBoundingClientRect();
        return { x: (r.left - gr.left) / k, w: r.width / k };
      }),
    };
  }
  let geo = measureGeo();
  setCopies(copiesFor(geo.W, geo.P));

  // ---------------------------------------------------------------- state as functions of time
  // X(t) = base + V * (integral of the rate since t0) + shift(t): the distance the band has gone
  // in its direction. The band shows X modulo the width of one group.
  let base = 0;
  let V = speed0;
  let flags0 = { hovered: false, focused: false, paused: !!o.paused, item: -1, glide: false };
  let intents = [];
  let loopDur = 0;
  let rate;
  let shift;
  let flagsS;
  let endT = -Infinity;
  let t0 = 0;

  /** The integral of the rate from t0 to t, closed form. */
  function integral(t) {
    let sum = rate.initial * (t - t0);
    let prev = rate.initial;
    for (const e of rate.ev) {
      if (e.t > t) break;
      sum += (e.target - prev) * springArea(e.sp, t - e.t);
      prev = e.target;
    }
    return sum;
  }

  /** The integral from t0 to forever, for a plan whose rate ends at 0 (where the band will rest). */
  function restIntegral() {
    let sum = -rate.initial * t0;
    let prev = rate.initial;
    for (const e of rate.ev) {
      sum -= (e.target - prev) * (e.t + lagOf(e.sp));
      prev = e.target;
    }
    return sum;
  }

  const X = (t) => base + V * integral(t) + shift.at(t);
  /** x modulo one group, in [0, P); values a hair below P count as 0, so a loop closes exactly. */
  const wrapP = (x) => {
    const P = geo.P;
    if (!(P > 0)) return 0;
    const f = x - P * Math.floor(x / P);
    return f < 1e-6 || P - f < 1e-6 ? 0 : f;
  };
  const wrapSym = (x) => (geo.P > 0 ? x - geo.P * Math.round(x / geo.P) : 0);

  /** Where item j rests when it has keyboard focus: in the middle, or at the start if it is near it. */
  function wantOf(j) {
    const it = geo.items[j];
    return it ? Math.max(0, it.x + it.w / 2 - geo.W / 2) : null;
  }

  /**
   * How far into the original group the viewport starts at time t, px, in [-P, P). Normally in
   * [0, P). While an item has keyboard focus, in a window of one group around the place the
   * item glides to: the content repeats every P px, so the choice changes nothing on screen
   * except that the original (which holds the focus) is the one shown, overshoot included.
   */
  function phase(t) {
    const x = s * X(t);
    const f = flagsS.at(t);
    const want = f.focused && f.glide ? wantOf(f.item) : null;
    const lo = want === null ? 0 : Math.max(-geo.P, want - geo.P / 2);
    return lo + wrapP(x - lo);
  }

  /** The shift that makes the band come to rest with item j where wantOf(j) says. */
  function glideFor(j) {
    const want = wantOf(j);
    if (want === null || !(geo.P > 0)) return 0;
    const rest = base + V * restIntegral() + shift.target(Infinity);
    return wrapSym(s * want - rest);
  }

  function apply(f, it) {
    if (it.kind === 'hover') return { ...f, hovered: it.on };
    if (it.kind === 'pause') return { ...f, paused: it.on };
    return it.on ? { ...f, focused: true, item: it.item, glide: it.glide } : { ...f, focused: false, item: -1, glide: false };
  }

  /** Builds the rate, the shift and the flags from the input since t0. */
  function plan() {
    rate = track(stoppedBy(flags0) ? 0 : 1, START);
    shift = track(0, GLIDE);
    flagsS = steps(flags0);
    endT = -Infinity;
    let f = flags0;
    for (const it of intents) {
      f = apply(f, it);
      flagsS.set(it.t, f);
      const want = stoppedBy(f) ? 0 : 1;
      if (want !== rate.target(Infinity)) rate.to(it.t, want, want ? START : STOP);
      if (it.kind === 'focus' && it.on && it.glide) {
        // a scheduled demo plans every glide on the current layout; live glides keep their way
        if (api.keep || it.delta === undefined) it.delta = glideFor(it.item);
        if (it.delta) shift.to(it.t, shift.target(Infinity) + it.delta, GLIDE);
      }
      if (it.t > endT) endT = it.t;
    }
  }

  /**
   * With loop(duration), a scheduled demo ends where it started. With a keyboard glide in it,
   * the band starts where the glide and the ride after it lead (the glide ends at a fixed
   * place, so the start does not change the end). Without one, the speed is set so that the
   * ride is a whole number of groups.
   */
  function fit() {
    if (!loopDur || !(geo.P > 0)) return;
    const t1 = t0 + loopDur;
    V = speed0;
    if (intents.some((it) => it.kind === 'focus' && it.on && it.glide)) {
      plan();
      const b = base + X(t1) - X(t0);
      base = b - geo.P * Math.floor(b / geo.P);
      plan();
      return;
    }
    const I = integral(t1);
    if (I > 0 && speed0 > 0) V = (Math.max(1, Math.round((speed0 * I) / geo.P)) * geo.P) / I;
  }

  // ---------------------------------------------------------------- painting
  const focusTarget = (j) => {
    const el = items[j];
    if (!el) return null;
    return el.matches && el.matches(FOCUSABLE) ? el : el.querySelector(FOCUSABLE) || el;
  };
  let ringed = null;

  function paint(t, { reduced }) {
    const f = flagsS.at(t);
    const target = rate.target(t);
    const still = rate.settled(t);
    attr(root, 'data-motion', reduced ? 'reduced' : 'on');
    attr(root, 'data-state', reduced ? 'stopped' : still ? (target > 0 ? 'running' : 'stopped') : target > 0 ? 'starting' : 'stopping');
    attr(button, 'aria-label', f.paused ? labels.play : labels.pause);
    attr(button, 'data-state', f.paused ? 'paused' : 'playing');
    attr(button, 'hidden', reduced);
    for (const c of copies()) attr(c, 'hidden', reduced);
    // the focus ring of a scheduled keyboard focus (a live one also has :focus-visible)
    const ring = !reduced && f.focused && f.glide ? focusTarget(f.item) : null;
    if (ring !== ringed) {
      if (ringed) attr(ringed, 'data-focused', null);
      if (ring) attr(ring, 'data-focused', true);
      ringed = ring;
    }
    trackEl.style.transform = reduced || !(geo.P > 0) ? '' : `translateX(${px(-(geo.P + phase(t)))})`;
  }

  const settledAll = (t) => rate.settled(t) && shift.settled(t);

  function draw(t, st) {
    paint(t, st);
    // live: once every spring is home, fold the history into where the band is now
    if (!api.keep && intents.length && t >= endT && settledAll(t)) {
      const x = X(t);
      base = geo.P > 0 ? x - geo.P * Math.floor(x / geo.P) : 0;
      flags0 = flagsS.at(t);
      t0 = t;
      intents = [];
      plan();
    }
  }

  let onScreen = true;
  const d = driver(draw, { clock: o.clock, reduced: o.reduced });
  t0 = d.now();
  const running = (t) => rate.target(t) > 0 && geo.P > 0 && V > 0;
  d.busy = (t) => onScreen && (t < endT || !settledAll(t) || running(t));
  const commit = () => { paint(d.now(), { reduced: d.reduced }); d.kick(); };
  const when = (opt) => (opt && opt.t !== undefined ? { t: opt.t, live: false } : { t: d.now(), live: true });

  // ---------------------------------------------------------------- input (in time order)
  function push(it, opt) {
    const { t, live } = when(opt);
    it.t = t;
    intents.push(it);
    intents.sort((a, b) => a.t - b.t);
    plan();
    if (api.keep) fit();
    commit();
    return live;
  }

  /** The pointer is over the band (on) or has left it. opt: { t }. */
  function hover(on, opt = {}) {
    if (flagsS.last.hovered === !!on) return api;
    push({ kind: 'hover', on: !!on }, opt);
    return api;
  }

  /**
   * Focus is on item i: the band stops and, with glide (default, what keyboard focus does),
   * glides the item into the middle. opt: { t, glide }.
   */
  function focusItem(i, opt = {}) {
    const glide = opt.glide !== false;
    const f = flagsS.last;
    if (i < 0 || i >= items.length || (f.focused && f.item === i && f.glide === glide)) return api;
    push({ kind: 'focus', on: true, item: i, glide }, opt);
    return api;
  }

  /** Focus has left the band. opt: { t }. */
  function blur(opt = {}) {
    if (!flagsS.last.focused) return api;
    push({ kind: 'focus', on: false }, opt);
    return api;
  }

  function setPaused(v, opt = {}) {
    if (flagsS.last.paused === v) return api;
    const live = push({ kind: 'pause', on: v }, opt);
    if (live && o.onPauseChange) o.onPauseChange(v);
    return api;
  }

  /** A scheduled demo of `duration` seconds ends where it started (see fit). */
  function loop(duration) {
    loopDur = Math.max(0, Number(duration) || 0);
    plan();
    fit();
    commit();
    return api;
  }

  /** Re-measure after a layout change: the copies follow the width; a demo is planned again. */
  function measure() {
    const g = measureGeo();
    const near = (a, b) => Math.abs(a - b) < 0.5;
    const same = near(g.W, geo.W) && near(g.P, geo.P) && g.items.length === geo.items.length
      && g.items.every((it, i) => near(it.x, geo.items[i].x) && near(it.w, geo.items[i].w));
    if (same) return api;
    geo = g;
    setCopies(copiesFor(geo.W, geo.P));
    if (api.keep) { plan(); fit(); }
    commit();
    return api;
  }

  /** The content changed (items added or edited): copy it again and measure. */
  function refresh() {
    readItems();
    clearCopies();
    geo = measureGeo();
    setCopies(copiesFor(geo.W, geo.P));
    if (api.keep) { plan(); fit(); }
    commit();
    return api;
  }

  // ---------------------------------------------------------------- live input
  const listeners = [];
  const on = (el, type, fn) => { el.addEventListener(type, fn); listeners.push([el, type, fn]); };
  let pointerFocus = false;

  on(button, 'click', () => setPaused(!flagsS.last.paused));
  if (pauseOnHover) {
    // a touch has no hover; the button is there for touch screens
    on(root, 'pointerenter', (e) => { if (e.pointerType !== 'touch') hover(true); });
    on(root, 'pointerleave', (e) => { if (e.pointerType !== 'touch') hover(false); });
  }
  on(viewport, 'pointerdown', () => { pointerFocus = true; });
  on(viewport, 'pointerup', () => { pointerFocus = false; });
  on(viewport, 'focusin', (e) => {
    const glide = !pointerFocus;
    pointerFocus = false;
    const i = items.findIndex((it) => it.contains(e.target));
    if (i >= 0) focusItem(i, { glide });
  });
  on(viewport, 'focusout', (e) => {
    const next = e.relatedTarget;
    if (next && viewport.contains(next)) return;
    blur();
  });
  // Focus must not scroll the viewport (the glide shows the item); with reduced motion it may.
  on(viewport, 'scroll', () => {
    if (d.reduced) return;
    if (viewport.scrollLeft) viewport.scrollLeft = 0;
    if (viewport.scrollTop) viewport.scrollTop = 0;
  });

  let ro = null;
  if (typeof ResizeObserver === 'function') {
    ro = new ResizeObserver(() => measure());
    ro.observe(viewport);
    ro.observe(group);
  }
  let io = null;
  if (typeof IntersectionObserver === 'function') {
    // off screen nothing is drawn; the position stays a function of time, so it is right on return
    io = new IntersectionObserver((entries) => {
      for (const e of entries) onScreen = e.isIntersecting;
      if (onScreen) d.kick();
    });
    io.observe(root);
  }

  const api = {
    root,
    viewport,
    track: trackEl,
    button,
    driver: d,
    keep: false,
    /** Every group in the order of the track: the copy before the original, the original, the copies after. */
    get groups() { return lead ? [lead, group, ...after] : [group, ...after]; },
    /** The original group (the one screen readers and the Tab key use). */
    group,
    get items() { return items.slice(); },
    hover,
    focusItem,
    blur,
    pause: (opt) => setPaused(true, opt),
    play: (opt) => setPaused(false, opt),
    toggle: (opt) => setPaused(!flagsS.last.paused, opt),
    /** Paused by the button (or pause()) now, or at time t of a scheduled timeline. */
    paused: (t) => (t === undefined ? flagsS.last : flagsS.at(t)).paused,
    loop,
    measure,
    refresh,
    /** The translateX of the track at time t (now by default), px (the copy before the original included). */
    offset: (t = d.now()) => (d.reduced || !(geo.P > 0) ? 0 : -(geo.P + phase(t))),
    /** Speed at time t (now by default), px per second in the direction of travel. */
    speed: (t = d.now()) => (d.reduced ? 0 : V * rate.at(t)),
    /** Width of one group, px: the band repeats after this distance. */
    period: () => geo.P,
    seek: (t) => paint(t, { reduced: d.reduced }),
    settled: (t) => t >= endT && settledAll(t),
    destroy() {
      d.stop();
      if (ro) ro.disconnect();
      if (io) io.disconnect();
      for (const [el, type, fn] of listeners) el.removeEventListener(type, fn);
      clearCopies();
      trackEl.style.transform = '';
      if (ringed) attr(ringed, 'data-focused', null);
    },
  };
  plan();
  paint(d.now(), { reduced: d.reduced });
  if (!d.reduced) d.kick();
  return api;
}
