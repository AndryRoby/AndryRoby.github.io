/*
 * ARLing Motion: Accordion.
 * Opening unfolds the panel: its top stands still, the panel grows downward, and each row
 * of content enters just after the growing edge reaches it. Closing lets the rows leave
 * first, then folds the panel up. The chevron turns on the same spring.
 *
 * Markup:
 *   <div class="am-accordion">
 *     <div class="am-accordion-item">
 *       <h3 class="am-accordion-heading">
 *         <button class="am-accordion-trigger">Shipping</button>
 *       </h3>
 *       <div class="am-accordion-panel" hidden>
 *         <div class="am-accordion-content"><p>Row</p><p>Row</p></div>
 *       </div>
 *     </div>
 *   </div>
 * Each direct child of .am-accordion-content is one row. The component adds the chevron.
 *
 * Keyboard (WAI-ARIA APG, accordion): Enter or Space on a header toggles its panel, Down
 * and Up move between headers and wrap, Home and End jump. Every header stays in the Tab
 * order. When a panel may not collapse, its open header gets aria-disabled="true".
 *
 * Layout: the height of an opening panel moves the content below it, right after the
 * user's click or key. Browsers do not count such shifts in CLS (input within 500 ms).
 * MIT licence.
 */
import { track, presence, applyPresence, driver, springStep, settleTime, steps, attr, PRESETS } from '../../src/core.js';

// ------------------------------------------------------------------ helpers

const px = (v) => `${Math.round(v * 100) / 100}px`;
const SHOWN = { opacity: 1, blur: 0, y: 0, scale: 1, visible: true };
const GONE = { opacity: 0, blur: 0, y: 0, scale: 1, visible: false };

let uid = 0;
const ensureId = (el, prefix) => el.id || (el.id = `${prefix}-${++uid}`);

/** Seconds after the start until a unit step of this spring first reaches frac (unfold timing). */
export function reach(sp, frac) {
  if (frac <= 0) return 0;
  const f = Math.min(frac, 0.98);
  let lo = 0;
  let hi = settleTime(sp);
  for (let i = 0; i < 32; i++) {
    const mid = (lo + hi) / 2;
    if (springStep(sp, mid) >= f) hi = mid; else lo = mid;
  }
  return hi;
}

// ------------------------------------------------------------------ accordion

/** The spring the panel unfolds on, and where in a row the growing edge lets it enter. */
export const UNFOLD = { spring: PRESETS.smooth, rowAt: 0.4 };
const ROW_MOTION = { dyIn: 6, dyOut: -4, blur: 4, scaleFrom: 1 };

/**
 * createAccordion({ root, multiple, collapsible, open, onChange, clock, reduced })
 * multiple: several panels may be open (default false); collapsible: the last open panel
 * may close (default true); open: index or list of indexes open at the start.
 * Returns { open, close, toggle, isOpen, seek, settled, destroy, driver, items, triggers, panels, keep }.
 */
export function createAccordion(o) {
  const root = o.root;
  const doc = root.ownerDocument || document;
  const multiple = !!o.multiple;
  const collapsible = o.collapsible !== false;
  const itemEls = [...root.querySelectorAll('.am-accordion-item')];
  if (!itemEls.length) throw new Error('createAccordion: no .am-accordion-item');
  const startOpen = new Set([].concat(o.open ?? []));

  const items = itemEls.map((item, i) => {
    const trigger = item.querySelector('.am-accordion-trigger') || item.querySelector('button');
    const panel = item.querySelector('.am-accordion-panel');
    const content = panel.querySelector('.am-accordion-content') || panel;
    const rows = [...content.children];
    if (trigger.tagName === 'BUTTON' && !trigger.hasAttribute('type')) attr(trigger, 'type', 'button');
    attr(trigger, 'aria-controls', ensureId(panel, 'am-accordion-panel'));
    attr(panel, 'aria-labelledby', ensureId(trigger, 'am-accordion-trigger'));
    attr(panel, 'role', 'region');
    let chevron = trigger.querySelector('.am-accordion-chevron');
    if (!chevron) {
      chevron = doc.createElement('span');
      chevron.className = 'am-accordion-chevron';
      trigger.appendChild(chevron);
    }
    attr(chevron, 'aria-hidden', 'true');
    const isOpen = startOpen.has(i) || trigger.getAttribute('aria-expanded') === 'true';
    return {
      item,
      trigger,
      panel,
      content,
      rows,
      chevron,
      openS: steps(isOpen),
      h: track(0, UNFOLD.spring),
      rot: track(isOpen ? 1 : 0, PRESETS.snappy),
      pres: rows.map(() => presence(isOpen, ROW_MOTION)),
    };
  });
  const setInitial = (it, v) => {
    it.openS.initial = v;
    it.rot = track(v ? 1 : 0, PRESETS.snappy);
    it.pres = it.rows.map(() => presence(v, ROW_MOTION));
  };
  if (!multiple) {
    // one panel at most: keep the first one asked for
    let seen = false;
    for (const it of items) {
      if (!it.openS.initial) continue;
      if (seen) setInitial(it, false);
      seen = true;
    }
    if (!collapsible && !seen) setInitial(items[0], true);
  }

  let endT = -Infinity;
  const mark = (t) => { if (t > endT) endT = t; };
  const tracksOf = (it) => [it.h, it.rot, ...it.pres.map((p) => p.p)];
  const itemSettled = (it, t) => tracksOf(it).every((tr) => tr.settled(t));
  const settledAll = (t) => items.every((it) => itemSettled(it, t));

  /** Content height and each row's box, measured with the panel shown at its natural height. */
  function measure(it) {
    const { panel, content, rows } = it;
    const wasHidden = panel.hidden;
    const height = panel.style.height;
    panel.hidden = false;
    panel.style.height = '';
    const cr = content.getBoundingClientRect();
    const pr = panel.getBoundingClientRect();
    const H = Math.max(pr.height, cr.bottom - pr.top, 0);
    const boxes = rows.map((r) => {
      const b = r.getBoundingClientRect();
      return { y: b.top - pr.top, h: b.height };
    });
    panel.style.height = height;
    panel.hidden = wasHidden;
    return { H, boxes };
  }
  for (const it of items) if (it.openS.initial) it.h = track(measure(it).H, UNFOLD.spring);

  const blocked = (it) => !collapsible && !multiple && it.openS.last;
  const disabled = (it) => it.trigger.disabled || (it.trigger.getAttribute('aria-disabled') === 'true' && !blocked(it));

  function paint(t, { reduced }) {
    for (const it of items) {
      const isOpen = it.openS.at(t);
      const state = isOpen ? 'open' : 'closed';
      attr(it.trigger, 'aria-expanded', String(isOpen));
      if (!collapsible && !multiple) attr(it.trigger, 'aria-disabled', isOpen ? 'true' : null);
      attr(it.trigger, 'data-state', state);
      attr(it.item, 'data-state', state);
      attr(it.panel, 'data-state', state);
      const still = reduced || itemSettled(it, t);
      it.panel.hidden = !(isOpen || !still);
      it.chevron.style.transform = `rotate(${Math.round((reduced ? it.rot.target(t) : it.rot.at(t)) * 18000) / 100}deg)`;
      if (it.panel.hidden) continue;
      // open and at rest the height is natural again, so the content can reflow
      it.panel.style.height = isOpen && still ? '' : px(Math.max(0, it.h.at(t)));
      it.rows.forEach((row, j) => applyPresence(row, reduced ? (isOpen ? SHOWN : GONE) : it.pres[j].at(t)));
    }
  }

  function draw(t, s) {
    paint(t, s);
    if (!api.keep && t >= endT && settledAll(t) && items.some((it) => it.openS.ev.length)) {
      for (const it of items) {
        for (const tr of tracksOf(it)) tr.compact(t);
        for (const p of it.pres) p.marks = [];
        it.openS.compact();
      }
    }
  }

  const d = driver(draw, { clock: o.clock, reduced: o.reduced });
  d.busy = (t) => t < endT || !settledAll(t);
  const commit = () => { paint(d.now(), { reduced: d.reduced }); d.kick(); };
  const when = (opt) => (opt && opt.t !== undefined ? { t: opt.t, live: false } : { t: d.now(), live: true });

  function openAt(it, t) {
    const g = measure(it);
    const sp = UNFOLD.spring;
    const from = it.h.target(t);
    it.openS.set(t, true);
    it.h.to(t, g.H, sp);
    it.rot.to(t, 1);
    let last = t;
    it.pres.forEach((p, j) => {
      const b = g.boxes[j] || { y: 0, h: 0 };
      const edge = b.y + b.h * UNFOLD.rowAt;
      const tj = t + (g.H > from ? reach(sp, (edge - from) / (g.H - from)) : 0);
      p.enter(tj);
      if (tj > last) last = tj;
    });
    mark(last);
  }

  function closeAt(it, t) {
    // an open panel at rest has its natural height (the content may have reflowed since it
    // opened): with no history left, start the fold from what is on screen now
    if (!it.h.ev.length) it.h = track(measure(it).H, UNFOLD.spring);
    it.openS.set(t, false);
    for (const p of it.pres) p.exit(t);
    it.h.to(t + 0.05, 0, PRESETS.snappy);
    it.rot.to(t, 0);
    mark(t + 0.05);
  }

  function open(i, opt = {}) {
    const { t, live } = when(opt);
    const it = items[i];
    if (!it || it.openS.last) return api;
    if (!multiple) for (const other of items) if (other !== it && other.openS.last) closeAt(other, t);
    openAt(it, t);
    commit();
    if (live && o.onChange) o.onChange(openList());
    return api;
  }

  function close(i, opt = {}) {
    const { t, live } = when(opt);
    const it = items[i];
    if (!it || !it.openS.last || blocked(it)) return api;
    closeAt(it, t);
    commit();
    if (live && o.onChange) o.onChange(openList());
    return api;
  }

  const toggle = (i, opt) => (items[i] && items[i].openS.last ? close(i, opt) : open(i, opt));
  const openList = () => items.map((it, i) => (it.openS.last ? i : -1)).filter((i) => i >= 0);

  // ---------------------------------------------------------------- live input
  const listeners = [];
  const on = (target, type, fn) => { target.addEventListener(type, fn); listeners.push([target, type, fn]); };
  const triggers = items.map((it) => it.trigger);
  const indexOf = (target) => (target && target.closest ? triggers.indexOf(target.closest('.am-accordion-trigger, button')) : -1);

  on(root, 'click', (e) => {
    const i = indexOf(e.target);
    if (i < 0 || disabled(items[i])) return;
    toggle(i);
  });
  on(root, 'keydown', (e) => {
    const i = indexOf(e.target);
    if (i < 0) return;
    const usable = triggers.map((_, j) => j).filter((j) => !items[j].trigger.disabled);
    const k = usable.indexOf(i);
    let to = -1;
    if (e.key === 'ArrowDown') to = usable[(k + 1) % usable.length];
    else if (e.key === 'ArrowUp') to = usable[(k - 1 + usable.length) % usable.length];
    else if (e.key === 'Home') to = usable[0];
    else if (e.key === 'End') to = usable[usable.length - 1];
    if (to === undefined || to < 0) return;
    e.preventDefault();
    triggers[to].focus();
  });

  const api = {
    root,
    items: itemEls,
    triggers,
    panels: items.map((it) => it.panel),
    multiple,
    driver: d,
    keep: false,
    open,
    close,
    toggle,
    isOpen: (i, t) => (items[i] ? (t === undefined ? items[i].openS.last : items[i].openS.at(t)) : false),
    openItems: openList,
    seek: (t) => paint(t, { reduced: d.reduced }),
    settled: (t) => t >= endT && settledAll(t),
    destroy() {
      d.stop();
      for (const [target, type, fn] of listeners) target.removeEventListener(type, fn);
    },
  };
  paint(d.now(), { reduced: d.reduced });
  return api;
}
