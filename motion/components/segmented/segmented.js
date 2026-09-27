/*
 * ARLing Motion: Segmented control.
 * A row of options with one thumb under the chosen one, like an iOS segmented control or a
 * shadcn toggle group that holds one value. The thumb's position and width move on one spring,
 * so it stretches or narrows toward an option of another width while it travels. A new choice
 * made while the thumb is still moving continues from its current speed: every change adds one
 * spring to the sum and nothing restarts. Pressing the chosen option shrinks the thumb a little
 * until the press ends. Labels switch colour at once, never through a blend.
 *
 * Markup:
 *   <div class="am-segmented" role="radiogroup" aria-label="Billing">
 *     <button role="radio" data-value="monthly">Monthly</button>
 *     <button role="radio" data-value="yearly">Yearly</button>
 *   </div>
 * The component adds the thumb (.am-segmented-thumb) if it is missing. Add data-equal to the
 * root to give every option the same width.
 *
 * Keyboard (WAI-ARIA APG, radio group): Tab moves into the group to the chosen option (roving
 * tabindex, one tab stop). Right and Down choose the next option, Left and Up the previous
 * one, both wrap; Home and End choose the first and the last. Disabled options are skipped.
 * Space chooses the focused option (on a button Enter does too, as on any button). In a right
 * to left layout Left and Right swap.
 * MIT licence.
 */
import { track, driver, steps, attr, PRESETS } from '../../src/core.js';

const px = (v) => `${Math.round(v * 100) / 100}px`;
const round4 = (v) => Math.round(v * 1e4) / 1e4;

/** Position and width of the thumb move on this one spring (overshoot under 1 %). */
export const SEGMENT_SPRING = PRESETS.snappy;
/** Scale of the thumb while the chosen option is pressed. */
export const PRESS_SCALE = 0.96;

/**
 * createSegmented({ root, selected, onChange, spring, clock, reduced })
 * selected: index or data-value of the option chosen at first (default: the one with
 * aria-checked="true", else the first enabled one). onChange(index, value) runs on user input.
 * Returns { select, selected, value, press, release, measure, seek, settled, destroy, driver,
 * root, items, thumb, keep }.
 */
export function createSegmented(o) {
  const root = o.root;
  const doc = root.ownerDocument || document;
  attr(root, 'role', 'radiogroup');
  const items = [...root.querySelectorAll('[role="radio"], .am-segmented-item')];
  if (!items.length) throw new Error('createSegmented: no elements with role="radio"');
  for (const it of items) {
    attr(it, 'role', 'radio');
    if (it.tagName === 'BUTTON' && !it.hasAttribute('type')) attr(it, 'type', 'button');
  }
  let thumb = root.querySelector('.am-segmented-thumb');
  if (!thumb) {
    thumb = doc.createElement('span');
    thumb.className = 'am-segmented-thumb';
    root.insertBefore(thumb, root.firstElementChild);
  }
  attr(thumb, 'aria-hidden', 'true');

  const disabled = (i) => items[i].disabled || items[i].getAttribute('aria-disabled') === 'true';
  const valueOf = (i) => (items[i].hasAttribute('data-value') ? items[i].getAttribute('data-value') : items[i].textContent.trim());
  const indexOf = (target) => (typeof target === 'number' ? target : items.findIndex((_, i) => valueOf(i) === String(target)));

  const marked = items.findIndex((it) => it.getAttribute('aria-checked') === 'true');
  let first = o.selected !== undefined && o.selected !== null ? indexOf(o.selected) : marked;
  if (first < 0 || first >= items.length || disabled(first)) first = items.findIndex((_, i) => !disabled(i));
  if (first < 0) first = 0;

  /** Where option i sits inside the root's padding box, px. */
  const box = (i) => {
    const rr = root.getBoundingClientRect();
    const r = items[i].getBoundingClientRect();
    return { x: r.left - rr.left - (root.clientLeft || 0), w: r.width };
  };

  const sp = o.spring || SEGMENT_SPRING;
  const sel = steps(first);
  const b0 = box(first);
  let x = track(b0.x, sp);
  let w = track(b0.w, sp);
  const press = track(0, PRESETS.press);
  let endT = -Infinity;
  const mark = (t) => { if (t > endT) endT = t; };
  const settledAll = (t) => x.settled(t) && w.settled(t) && press.settled(t);

  function paint(t, { reduced }) {
    const s = sel.at(t);
    items.forEach((it, i) => {
      const on = i === s;
      attr(it, 'aria-checked', String(on));
      attr(it, 'tabindex', on ? '0' : '-1');
      attr(it, 'data-state', on ? 'checked' : 'unchecked');
    });
    const at = (tr) => (reduced ? tr.target(t) : tr.at(t));
    const k = 1 - (1 - PRESS_SCALE) * (reduced ? 0 : press.at(t));
    thumb.style.width = px(Math.max(0, at(w)));
    thumb.style.transform = `translateX(${px(at(x))}) scale(${round4(k)})`;
    attr(root, 'data-state', settledAll(t) ? 'idle' : 'moving');
  }

  function draw(t, st) {
    paint(t, st);
    if (!api.keep && t >= endT && settledAll(t)) {
      x.compact(t);
      w.compact(t);
      press.compact(t);
      sel.compact();
    }
  }

  const d = driver(draw, { clock: o.clock, reduced: o.reduced });
  d.busy = (t) => t < endT || !settledAll(t);
  const commit = () => { paint(d.now(), { reduced: d.reduced }); d.kick(); };
  const when = (opt) => (opt && opt.t !== undefined ? { t: opt.t, live: false } : { t: d.now(), live: true });

  /** Chooses an option by index or data-value. opt: { t } to schedule it, { focus } to focus it. */
  function select(target, opt = {}) {
    const { t, live } = when(opt);
    const i = indexOf(target);
    if (i < 0 || i >= items.length || disabled(i)) return api;
    const prev = sel.last;
    if (i !== prev) {
      sel.set(t, i);
      const b = box(i);
      x.to(t, b.x);
      w.to(t, b.w);
      mark(t);
      commit();
    }
    if (live) {
      if (opt.focus) items[i].focus();
      if (i !== prev && o.onChange) o.onChange(i, valueOf(i));
    }
    return api;
  }

  /** The thumb shrinks to PRESS_SCALE. opt: { t }. */
  function pressDown(opt = {}) {
    const { t } = when(opt);
    if (press.target(Infinity) === 1) return api;
    press.to(t, 1, PRESETS.press);
    mark(t);
    commit();
    return api;
  }

  /** The thumb springs back to its size. opt: { t }. */
  function pressUp(opt = {}) {
    const { t } = when(opt);
    if (press.target(Infinity) === 0) return api;
    press.to(t, 0, PRESETS.release);
    mark(t);
    commit();
    return api;
  }

  const near = (a, b) => Math.abs(a - b) < 0.5;
  const sameTrack = (a, b) => near(a.initial, b.initial) && a.ev.length === b.ev.length
    && a.ev.every((e, k) => e.t === b.ev[k].t && near(e.target, b.ev[k].target));

  /**
   * Re-measure after a layout change. Live, the thumb jumps to the chosen option without
   * motion. With api.keep (a scheduled demo) every scheduled choice is planned again on the new
   * layout, so seeking still shows the right option.
   */
  function measure() {
    if (api.keep) {
      const b = box(sel.initial);
      const nx = track(b.x, sp);
      const nw = track(b.w, sp);
      for (const [t, i] of sel.ev) {
        const bi = box(i);
        nx.to(t, bi.x);
        nw.to(t, bi.w);
      }
      if (sameTrack(nx, x) && sameTrack(nw, w)) return api;
      x = nx;
      w = nw;
      commit();
      return api;
    }
    const b = box(sel.last);
    if (near(x.target(Infinity), b.x) && near(w.target(Infinity), b.w)) return api;
    x = track(b.x, sp);
    w = track(b.w, sp);
    commit();
    return api;
  }

  // ---------------------------------------------------------------- live input
  const listeners = [];
  const on = (el, type, fn) => { el.addEventListener(type, fn); listeners.push([el, type, fn]); };
  const itemOf = (e) => (e.target && e.target.closest ? e.target.closest('[role="radio"]') : null);
  const rtl = () => {
    const dirEl = root.closest ? root.closest('[dir]') : null;
    return !!dirEl && dirEl.getAttribute('dir') === 'rtl';
  };
  const stepFrom = (from, dir) => {
    for (let k = 1; k <= items.length; k++) {
      const j = (from + dir * k + items.length * k) % items.length;
      if (!disabled(j)) return j;
    }
    return from;
  };

  on(root, 'keydown', (e) => {
    const item = itemOf(e);
    const cur = items.indexOf(item);
    if (cur < 0) return;
    const flip = rtl();
    let to = null;
    if (e.key === 'ArrowDown' || e.key === (flip ? 'ArrowLeft' : 'ArrowRight')) to = stepFrom(cur, 1);
    else if (e.key === 'ArrowUp' || e.key === (flip ? 'ArrowRight' : 'ArrowLeft')) to = stepFrom(cur, -1);
    else if (e.key === 'Home') to = stepFrom(items.length - 1, 1); // first enabled option
    else if (e.key === 'End') to = stepFrom(0, -1); // last enabled option
    else if (e.key === ' ' && item.tagName !== 'BUTTON') {
      // a button chooses itself through its own click
      e.preventDefault();
      if (!disabled(cur)) select(cur);
      return;
    }
    if (to === null) return;
    e.preventDefault();
    select(to, { focus: true });
  });
  on(root, 'click', (e) => {
    const i = items.indexOf(itemOf(e));
    if (i >= 0 && !disabled(i)) select(i, { focus: true });
  });
  on(root, 'pointerdown', (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    const i = items.indexOf(itemOf(e));
    if (i >= 0 && i === sel.last && !disabled(i)) pressDown();
  });
  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) on(root, type, () => pressUp());

  let ro = null;
  if (typeof ResizeObserver === 'function') {
    ro = new ResizeObserver(() => measure());
    ro.observe(root);
  }

  const api = {
    root,
    items,
    thumb,
    driver: d,
    keep: false,
    select,
    press: pressDown,
    release: pressUp,
    measure,
    selected: (t) => (t === undefined ? sel.last : sel.at(t)),
    value: (t) => valueOf(t === undefined ? sel.last : sel.at(t)),
    seek: (t) => paint(t, { reduced: d.reduced }),
    settled: (t) => t >= endT && settledAll(t),
    destroy() {
      d.stop();
      if (ro) ro.disconnect();
      for (const [el, type, fn] of listeners) el.removeEventListener(type, fn);
    },
  };
  paint(d.now(), { reduced: d.reduced });
  return api;
}
