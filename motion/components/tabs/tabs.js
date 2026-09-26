/*
 * ARLing Motion: Tabs.
 * The indicator is one shape with two edges on different springs: the leading edge is
 * faster, so it stretches toward the new tab and the trailing edge catches up. Panels
 * share one grid cell (no layout shift) and each has its own entrance and exit.
 *
 * Markup:
 *   <div class="am-tabs">
 *     <div class="am-tabs-list" role="tablist" aria-label="Account">
 *       <button role="tab">Profile</button><button role="tab">Billing</button>
 *     </div>
 *     <div class="am-tabs-panels">
 *       <div role="tabpanel">...</div><div role="tabpanel">...</div>
 *     </div>
 *   </div>
 *
 * Keyboard (WAI-ARIA APG, tabs): Left and Right (Up and Down when vertical) move between
 * tabs and wrap, Home and End jump; with activation 'automatic' focus selects, with
 * 'manual' Enter or Space selects. Only the selected tab is in the Tab order.
 * MIT licence.
 */
import { indicator, presence, applyPresence, driver, spring } from '../../src/core.js';

// ------------------------------------------------------------------ shared helpers

const px = (v) => `${Math.round(v * 100) / 100}px`;
const SHOWN = { opacity: 1, blur: 0, y: 0, scale: 1, visible: true };
const GONE = { opacity: 0, blur: 0, y: 0, scale: 1, visible: false };

function steps(initial) {
  return {
    initial,
    ev: [],
    set(t, v) { this.ev.push([t, v]); this.ev.sort((a, b) => a[0] - b[0]); return this; },
    at(t) { let v = this.initial; for (const [et, x] of this.ev) { if (et > t) break; v = x; } return v; },
    get last() { return this.ev.length ? this.ev[this.ev.length - 1][1] : this.initial; },
    compact() { this.initial = this.last; this.ev = []; },
  };
}

function attr(el, name, value) {
  if (value === null || value === undefined || value === false) {
    if (el.hasAttribute(name)) el.removeAttribute(name);
  } else {
    const v = value === true ? '' : String(value);
    if (el.getAttribute(name) !== v) el.setAttribute(name, v);
  }
}

let uid = 0;
const ensureId = (el, prefix) => el.id || (el.id = `${prefix}-${++uid}`);

// ------------------------------------------------------------------ tabs

/** Springs of the indicator: both land within 0.91 s, overshoot under 0.2 %. */
export const TAB_SPRINGS = { fast: spring(0.28, 0.9), slow: spring(0.48, 0.95) };

/**
 * createTabs({ root, selected, orientation, activation, onChange, clock, reduced })
 * Returns { select, selected, seek, settled, measure, destroy, driver, tabs, panels, keep }.
 */
export function createTabs(o) {
  const root = o.root;
  const doc = root.ownerDocument || document;
  const list = root.querySelector('[role="tablist"]') || root;
  const vertical = (o.orientation || list.getAttribute('aria-orientation')) === 'vertical';
  const manual = o.activation === 'manual';
  const tabs = [...list.querySelectorAll('[role="tab"]')];
  if (!tabs.length) throw new Error('createTabs: no elements with role="tab"');
  const allPanels = [...root.querySelectorAll('[role="tabpanel"]')];
  const panels = tabs.map((tab, i) => {
    const id = tab.getAttribute('aria-controls');
    return (id && allPanels.find((p) => p.id === id)) || allPanels[i] || null;
  });
  if (vertical) attr(list, 'aria-orientation', 'vertical');
  tabs.forEach((tab, i) => {
    if (tab.tagName === 'BUTTON' && !tab.hasAttribute('type')) attr(tab, 'type', 'button');
    const p = panels[i];
    if (!p) return;
    attr(tab, 'aria-controls', ensureId(p, 'am-tabpanel'));
    attr(p, 'aria-labelledby', ensureId(tab, 'am-tab'));
    if (!p.hasAttribute('tabindex')) attr(p, 'tabindex', '0');
  });
  let bar = list.querySelector('.am-tabs-indicator');
  if (!bar) {
    bar = doc.createElement('span');
    bar.className = 'am-tabs-indicator';
    list.appendChild(bar);
  }
  attr(bar, 'aria-hidden', 'true');

  const disabled = (i) => tabs[i].disabled || tabs[i].getAttribute('aria-disabled') === 'true';
  const marked = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
  let first = o.selected ?? (marked >= 0 ? marked : 0);
  if (first < 0 || first >= tabs.length || disabled(first)) first = tabs.findIndex((_, i) => !disabled(i));

  const sel = steps(first);
  const edges = (i) => {
    const lr = list.getBoundingClientRect();
    const r = tabs[i].getBoundingClientRect();
    return vertical ? [r.top - lr.top, r.bottom - lr.top] : [r.left - lr.left, r.right - lr.left];
  };
  const fast = o.fast || TAB_SPRINGS.fast;
  const slow = o.slow || TAB_SPRINGS.slow;
  let ind = indicator(...edges(first), fast, slow);
  const panelMotion = { dyIn: 8, dyOut: -4, blur: 6, scaleFrom: 0.985 };
  const pres = panels.map((_, i) => presence(i === first, panelMotion));
  let endT = -Infinity;
  const mark = (t) => { if (t > endT) endT = t; };
  const settledAll = (t) => ind.settled(t) && pres.every((p) => p.settled(t));

  function paint(t, { reduced }) {
    const s = sel.at(t);
    tabs.forEach((tab, i) => {
      const on = i === s;
      attr(tab, 'aria-selected', String(on));
      attr(tab, 'tabindex', on ? '0' : '-1');
      attr(tab, 'data-state', on ? 'active' : 'inactive');
    });
    const v = reduced ? ind.target(t) : ind.at(t);
    bar.style.transform = vertical ? `translateY(${px(v.left)})` : `translateX(${px(v.left)})`;
    if (vertical) bar.style.height = px(v.right - v.left);
    else bar.style.width = px(v.right - v.left);
    panels.forEach((p, i) => {
      if (!p) return;
      const on = i === s;
      attr(p, 'data-state', on ? 'active' : 'inactive');
      attr(p, 'inert', on ? null : true);
      attr(p, 'aria-hidden', on ? null : 'true');
      applyPresence(p, reduced ? (on ? SHOWN : GONE) : pres[i].at(t));
    });
  }

  function draw(t, s) {
    paint(t, s);
    if (!api.keep && t >= endT && sel.ev.length && settledAll(t)) {
      ind.l.compact(t);
      ind.r.compact(t);
      for (const p of pres) { p.p.compact(t); p.marks = []; }
      sel.compact();
    }
  }

  const d = driver(draw, { clock: o.clock, reduced: o.reduced });
  d.busy = (t) => t < endT || !settledAll(t);
  const commit = () => { paint(d.now(), { reduced: d.reduced }); d.kick(); };
  const when = (opt) => (opt && opt.t !== undefined ? { t: opt.t, live: false } : { t: d.now(), live: true });

  function select(i, opt = {}) {
    const { t, live } = when(opt);
    if (i < 0 || i >= tabs.length || disabled(i)) return api;
    const prev = sel.last;
    if (i !== prev) {
      sel.set(t, i);
      ind.to(t, ...edges(i));
      if (pres[prev]) pres[prev].exit(t);
      if (pres[i]) pres[i].enter(t + 0.06);
      mark(t + 0.06);
      commit();
    }
    if (live) {
      if (opt.focus) tabs[i].focus();
      if (i !== prev && o.onChange) o.onChange(i);
    }
    return api;
  }

  /** The same selections as now, planned again on the current layout. */
  function replan() {
    const e0 = edges(sel.initial);
    const next = indicator(e0[0], e0[1], fast, slow);
    for (const [t, i] of sel.ev) next.to(t, ...edges(i));
    return next;
  }

  const near = (a, b) => Math.abs(a - b) < 0.5;
  const sameTrack = (a, b) => near(a.initial, b.initial) && a.ev.length === b.ev.length
    && a.ev.every((e, k) => e.k === b.ev[k].k && e.t === b.ev[k].t && (e.k !== 'to' || near(e.target, b.ev[k].target)));

  /**
   * Re-measure after a layout change. Live, the indicator jumps to the selected tab without
   * motion. With api.keep (a scheduled demo) the timeline stays as it is: every scheduled
   * selection is planned again on the new layout, so seeking still shows the right tab.
   */
  function measure() {
    if (api.keep) {
      const next = replan();
      if (sameTrack(next.l, ind.l) && sameTrack(next.r, ind.r)) return api;
      ind = next;
      commit();
      return api;
    }
    const e = edges(sel.last);
    const cur = ind.target(Infinity);
    if (Math.abs(cur.left - e[0]) < 0.5 && Math.abs(cur.right - e[1]) < 0.5) return api;
    ind = indicator(e[0], e[1], fast, slow);
    commit();
    return api;
  }

  const step = (from, dir) => {
    for (let k = 1; k <= tabs.length; k++) {
      const j = (from + dir * k + tabs.length * k) % tabs.length;
      if (!disabled(j)) return j;
    }
    return from;
  };

  const listeners = [];
  const on = (el, type, fn) => { el.addEventListener(type, fn); listeners.push([el, type, fn]); };

  on(list, 'keydown', (e) => {
    const tab = e.target && e.target.closest ? e.target.closest('[role="tab"]') : null;
    const cur = tabs.indexOf(tab);
    if (cur < 0) return;
    const nextKey = vertical ? 'ArrowDown' : 'ArrowRight';
    const prevKey = vertical ? 'ArrowUp' : 'ArrowLeft';
    let to = null;
    if (e.key === nextKey) to = step(cur, 1);
    else if (e.key === prevKey) to = step(cur, -1);
    else if (e.key === 'Home') to = step(tabs.length - 1, 1); // first enabled tab
    else if (e.key === 'End') to = step(0, -1); // last enabled tab
    else if (manual && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      select(cur);
      return;
    }
    if (to === null) return;
    e.preventDefault();
    if (manual) tabs[to].focus();
    else select(to, { focus: true });
  });
  on(list, 'click', (e) => {
    const tab = e.target && e.target.closest ? e.target.closest('[role="tab"]') : null;
    const i = tabs.indexOf(tab);
    if (i >= 0) select(i, { focus: true });
  });
  let ro = null;
  if (typeof ResizeObserver === 'function') {
    ro = new ResizeObserver(() => measure());
    ro.observe(list);
  }

  const api = {
    root,
    list,
    tabs,
    panels,
    indicator: bar,
    driver: d,
    keep: false,
    select,
    measure,
    selected: (t) => (t === undefined ? sel.last : sel.at(t)),
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
