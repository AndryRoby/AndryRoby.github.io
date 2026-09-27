/*
 * ARLing Motion: Island.
 * A status pill that reshapes between states, Dynamic Island style. Width and height move on the
 * morph spring (one small overshoot, under 3 %) and the ends stay fully round at every size. The
 * old content leaves at once and the new one enters part by part (icon, title, detail) with a
 * short stagger. The spinner turns and the check draws itself as functions of time (rotation and
 * stroke-dashoffset from the seconds since the state appeared), so seek(t) paints any moment
 * exactly and a video frame equals the live frame. Sizes are measured once per show() from the
 * new content (getBoundingClientRect), never per frame.
 *
 * Markup:
 *   <div class="am-island"></div>
 * The component adds the parts. Screen readers get the title and detail of the current state in
 * a polite status region (role="status"); the pill, its icons and the animated text are
 * aria-hidden. Nothing in the island takes focus. The root centres the pill and grows it
 * downward from its top edge; place the root where the island belongs (for example fixed at the
 * top of the page).
 *
 *   const island = createIsland({ el });
 *   island.show({ icon: 'spinner', title: 'Paying…' });
 *   island.show({ icon: 'check', title: 'Payment received', tone: 'success' });
 *   island.show({ icon: 'download', title: 'Download ready', detail: 'guide.pdf', tone: 'accent' });
 *   island.hide();
 * Calls are expected in time order. With prefers-reduced-motion every state shows at once and
 * the spinner stands still.
 * MIT licence.
 */
import { track, presence, stagger, applyPresence, driver, spring, springStep, settleTime, steps, attr, JUMP, PRESETS } from '../../src/core.js';

export const ICONS = ['spinner', 'check', 'download', 'dot'];
export const TONES = ['neutral', 'success', 'accent'];
/** Seconds between the entrances of icon, title and detail. */
export const STAGGER = 0.04;
/** The new content starts entering this long after show(), while the old content leaves. */
export const ENTER_DELAY = 0.08;
/** The check starts drawing (and the download arrow dropping) this long after its icon enters. */
export const DRAW_DELAY = 0.1;
/** Seconds per turn of the spinner. */
export const SPIN_PERIOD = 0.8;
/** Stroke drawing: critically damped, so the line never runs past its end. */
export const DRAW = spring(0.42, 1);
/** hide(): the pill fades and scales down on this spring while it folds into a circle. */
export const HIDE = spring(0.5, 1);
/** Scale of the pill when it is not shown; it grows from here as it appears. */
export const SCALE_FROM = 0.6;

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const round2 = (v) => Math.round(v * 100) / 100;
const px = (v) => `${round2(v)}px`;
const SVG = 'http://www.w3.org/2000/svg';
const PART = { dyIn: 5, dyOut: -4, blur: 6, scaleFrom: 0.94 };
const SHOWN = { opacity: 1, blur: 0, y: 0, scale: 1, visible: true };
const GONE = { opacity: 0, blur: 0, y: 0, scale: 1, visible: false };
/** Drop of the download arrow into its tray, in icon units (24 per icon). */
const DROP = 7;

/** Spinner rotation in degrees after `seconds` of spinning: a pure function of time. */
export function spinAngle(seconds) {
  const turns = Math.max(0, seconds) / SPIN_PERIOD;
  return Math.round((turns - Math.floor(turns)) * 3600) / 10;
}

/** A state with its defaults: unknown icons become no icon, unknown tones become neutral. */
export function normalizeState(s) {
  const o = s || {};
  return {
    icon: ICONS.includes(o.icon) ? o.icon : null,
    title: o.title === undefined || o.title === null ? '' : String(o.title),
    detail: o.detail === undefined || o.detail === null ? '' : String(o.detail),
    tone: TONES.includes(o.tone) ? o.tone : 'neutral',
  };
}

/** Size from the text length, used only when there is no layout to measure (hidden ancestor, server). */
function estimate(s) {
  const chars = Math.max(s.title.length, s.detail.length * 0.86);
  return { w: Math.round((s.icon ? 56 : 32) + chars * 7.4), h: s.detail ? 48 : 36 };
}

/**
 * createIsland({ el, clock, reduced })
 * State: { icon?: 'spinner' | 'check' | 'download' | 'dot', title, detail?, tone?: 'neutral' | 'success' | 'accent' }.
 * Returns { show, hide, state, seek, settled, destroy, driver, keep, el, pill }.
 */
export function createIsland(o) {
  const el = o.el;
  const doc = el.ownerDocument || document;
  const make = (cls, text) => {
    const s = doc.createElement('span');
    s.className = cls;
    if (text !== undefined) s.textContent = text;
    return s;
  };
  const svg = (tag, attrs) => {
    const s = doc.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v);
    return s;
  };

  el.textContent = '';
  el.classList.add('am-island');
  const sr = make('am-island-sr');
  attr(sr, 'role', 'status');
  attr(sr, 'aria-live', 'polite');
  attr(sr, 'aria-atomic', 'true');
  const pill = make('am-island-pill');
  attr(pill, 'aria-hidden', 'true');
  el.appendChild(sr);
  el.appendChild(pill);

  /** One state: its content element, the parts that enter one after another, its icon moves. */
  function build(s) {
    const L = { state: s, el: make('am-island-content'), parts: [], pres: [], enter: [], tIn: 0, tOut: Infinity, tDraw: null, spin: null, draw: null, drop: null };
    attr(L.el, 'data-icon', s.icon || 'none');
    attr(L.el, 'data-tone', s.tone);
    if (s.icon) {
      const box = make('am-island-icon');
      L.el.appendChild(box);
      L.parts.push(box);
      if (s.icon === 'dot') box.appendChild(make('am-island-dot'));
      else {
        const g = svg('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', focusable: 'false' });
        box.appendChild(g);
        if (s.icon === 'spinner') {
          g.appendChild(svg('circle', { class: 'am-island-track', cx: '12', cy: '12', r: '9' }));
          g.appendChild(svg('path', { d: 'M12 3a9 9 0 0 1 9 9' }));
          L.spin = g;
        } else if (s.icon === 'check') {
          L.draw = svg('path', { class: 'am-island-draw', d: 'M6 12.5l4 4 8-8.5', pathLength: '1' });
          g.appendChild(L.draw);
        } else {
          L.drop = svg('g', {});
          L.drop.appendChild(svg('path', { d: 'M12 4.5v10M7.5 10l4.5 4.5 4.5-4.5' }));
          g.appendChild(L.drop);
          g.appendChild(svg('path', { d: 'M5.5 19.5h13' }));
        }
      }
    }
    const text = make('am-island-text');
    const title = make('am-island-title', s.title);
    text.appendChild(title);
    L.parts.push(title);
    if (s.detail) {
      const detail = make('am-island-detail', s.detail);
      text.appendChild(detail);
      L.parts.push(detail);
    }
    L.el.appendChild(text);
    L.pres = L.parts.map(() => presence(false, PART));
    return L;
  }

  /** The natural size of a state's content, once per show(); the pill's own scale is left out. */
  function measure(L) {
    const was = pill.style.transform;
    pill.style.transform = 'none';
    const r = L.el.getBoundingClientRect();
    pill.style.transform = was;
    const e = estimate(L.state);
    return { w: Math.ceil(r.width) || e.w, h: Math.ceil(r.height) || e.h };
  }

  const w = track(0, PRESETS.morph);
  const hgt = track(0, PRESETS.morph);
  const vis = track(0, PRESETS.enter);
  const current = steps(null); // the state in force: a layer, or null when hidden
  const layers = [];
  let endT = -Infinity;
  const mark = (t) => { if (t > endT) endT = t; };
  const drawSettle = Math.max(settleTime(DRAW), settleTime(PRESETS.snappy));
  const settledAll = (t) => w.settled(t) && hgt.settled(t) && vis.settled(t)
    && layers.every((L) => L.pres.every((p) => p.settled(t)) && (L.tDraw === null || t >= L.tDraw + drawSettle));
  const spinning = (t) => { const L = current.at(t); return !!(L && L.spin); };

  let spoken = '';
  function paint(t, { reduced }) {
    const at = (tr) => (reduced ? tr.target(t) : tr.at(t));
    const v = at(vis);
    // opaque from 60 % of the way in: a quick fade in, and on hide it fades late, once it is small
    const opacity = clamp01(v / 0.6);
    const scale = SCALE_FROM + (1 - SCALE_FROM) * v;
    pill.style.visibility = opacity > 0.002 ? 'visible' : 'hidden';
    pill.style.opacity = String(Math.round(opacity * 1000) / 1000);
    pill.style.width = px(Math.max(0, at(w)));
    pill.style.height = px(Math.max(0, at(hgt)));
    pill.style.transform = Math.abs(scale - 1) < 1e-4 ? '' : `scale(${scale.toFixed(4)})`;

    const cur = current.at(t);
    for (const L of layers) {
      const on = L === cur;
      L.parts.forEach((part, i) => {
        // a part whose entrance came after its state was replaced never shows
        const s = reduced ? (on ? SHOWN : GONE) : L.enter[i] >= L.tOut ? GONE : L.pres[i].at(t);
        applyPresence(part, s);
      });
      if (L.spin) L.spin.style.transform = `rotate(${reduced ? 0 : spinAngle(t - L.tIn)}deg)`;
      if (L.draw) L.draw.style.strokeDashoffset = String(reduced ? 0 : Math.round((1 - clamp01(springStep(DRAW, t - L.tDraw))) * 1e4) / 1e4);
      if (L.drop) L.drop.style.transform = `translateY(${reduced ? 0 : round2(-(1 - springStep(PRESETS.snappy, t - L.tDraw)) * DROP)}px)`;
    }
    attr(el, 'data-state', cur ? 'shown' : 'hidden');
    const text = cur ? (cur.state.detail ? `${cur.state.title}, ${cur.state.detail}` : cur.state.title) : '';
    if (text !== spoken) {
      sr.textContent = text;
      spoken = text;
    }
  }

  function compact(t) {
    const cur = current.at(t);
    for (let i = layers.length - 1; i >= 0; i--) {
      if (layers[i] !== cur) {
        layers[i].el.remove();
        layers.splice(i, 1);
      }
    }
    w.compact(t);
    hgt.compact(t);
    vis.compact(t);
    current.compact();
  }

  function draw(t, st) {
    paint(t, st);
    if (!api.keep && t >= endT && settledAll(t)) compact(t);
  }

  const d = driver(draw, { clock: o.clock, reduced: o.reduced });
  d.busy = (t) => t < endT || !settledAll(t) || spinning(t);
  const when = (opt) => (opt && opt.t !== undefined ? opt.t : d.now());
  const commit = () => { paint(d.now(), { reduced: d.reduced }); d.kick(); };

  /** The old content leaves at t; parts that had not started entering never will. */
  function leave(L, t) {
    L.tOut = t;
    L.pres.forEach((p, i) => { if (L.enter[i] < t) p.exit(t); });
  }

  /** Shows a state. opt: { t } to schedule it (demo, video). */
  function show(state, opt = {}) {
    const t = when(opt);
    const L = build(normalizeState(state));
    pill.appendChild(L.el);
    const size = measure(L);
    const prev = current.last;
    if (prev) leave(prev, t);
    // from nothing on screen, the pill starts as a circle of the new height and widens
    if (clamp01(vis.at(t)) < 0.002) {
      w.to(t, size.h, JUMP);
      hgt.to(t, size.h, JUMP);
    }
    w.to(t, size.w);
    hgt.to(t, size.h);
    if (vis.target(Infinity) !== 1) vis.to(t, 1, PRESETS.enter);
    L.tIn = t;
    L.enter = stagger(L.pres, t + ENTER_DELAY, STAGGER);
    if (L.draw || L.drop) {
      L.tDraw = L.enter[0] + DRAW_DELAY;
      mark(L.tDraw);
    }
    mark(L.enter[L.enter.length - 1]);
    current.set(t, L);
    layers.push(L);
    commit();
    return api;
  }

  /** Hides the island: the content leaves, the pill folds into a circle and fades. opt: { t }. */
  function hide(opt = {}) {
    const t = when(opt);
    const prev = current.last;
    if (!prev) return api;
    leave(prev, t);
    current.set(t, null);
    w.to(t, hgt.target(Infinity));
    vis.to(t, 0, HIDE);
    mark(t);
    commit();
    return api;
  }

  const api = {
    el,
    pill,
    driver: d,
    keep: false,
    show,
    hide,
    /** The last state shown (normalized), or null after hide(). */
    state: () => (current.last ? { ...current.last.state } : null),
    seek: (t) => paint(t, { reduced: d.reduced }),
    settled: (t) => t >= endT && settledAll(t) && !spinning(t),
    destroy() { d.stop(); },
  };
  paint(d.now(), { reduced: d.reduced });
  return api;
}
