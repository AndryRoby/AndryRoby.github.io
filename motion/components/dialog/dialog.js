/*
 * ARLing Motion: Dialog.
 * The modal grows out of the button that opened it and closes back into it. One shape
 * changes (clip of the panel), the new colour grows as a circle from the click point, and
 * the content has its own entrance and exit.
 *
 * Markup (the component adds the surface, ink and label parts it needs):
 *   <button class="am-dialog-trigger">Edit profile</button>
 *   <div class="am-dialog-root" hidden>
 *     <div class="am-dialog-backdrop"></div>
 *     <div class="am-dialog-frame">
 *       <div class="am-dialog" role="dialog" aria-labelledby="title-id">
 *         <div class="am-dialog-content"> ... <button data-am-close>Cancel</button></div>
 *       </div>
 *     </div>
 *   </div>
 *
 * Keyboard (WAI-ARIA APG, modal dialog): Enter or Space on the trigger opens, focus moves
 * into the dialog, Tab and Shift+Tab stay inside, Escape closes, focus returns to the trigger.
 * MIT licence.
 */
import { track, presence, applyPresence, driver, springStep, settleTime, PRESETS } from '../../src/core.js';

// ------------------------------------------------------------------ shared helpers
// (the same small helpers sit in every component file, so each file installs on its own)

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const px = (v) => `${Math.round(v * 100) / 100}px`;
const num = (v) => String(Math.round(v * 10000) / 10000);
// reduced motion shows states from the discrete state, never from a delayed entrance
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

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]';
function tabbables(root) {
  return [...root.querySelectorAll(FOCUSABLE)].filter((el) => !el.disabled && el.tabIndex >= 0 && !el.closest('[hidden], [inert]'));
}

/** Radius that covers a w by h box from the point (x, y). */
const cover = (x, y, w, h) => Math.max(Math.hypot(x, y), Math.hypot(w - x, y), Math.hypot(x, h - y), Math.hypot(w - x, h - y));

/**
 * Ink: a new colour grows as a circle from a point; the base colour switches only when the
 * circle covers the shape. list holds { t, color, x, y, R, sp } in time order.
 */
function inkAt(ink, t, reduced, layers = 2) {
  let base = ink.base;
  let active = [];
  for (const e of ink.list) {
    if (e.t > t) break;
    const p = reduced ? 1 : springStep(e.sp, t - e.t);
    if (p >= 1) { base = e.color; active = []; } else active.push({ color: e.color, r: p * e.R, x: e.x, y: e.y });
  }
  while (active.length > layers) base = active.shift().color;
  return { base, layers: active };
}
const inkSettled = (ink, t) => ink.list.every((e) => e.t > t || t >= e.t + settleTime(e.sp));

function paintInk(state, surface, els) {
  surface.style.background = state.base;
  els.forEach((el, i) => {
    const L = state.layers[i];
    if (!L) { el.style.visibility = 'hidden'; el.style.clipPath = ''; el.style.background = ''; return; }
    el.style.visibility = 'visible'; // the stylesheet hides ink layers until one grows
    el.style.background = L.color;
    el.style.clipPath = `circle(${px(L.r)} at ${px(L.x)} ${px(L.y)})`;
  });
}

function radiusOf(el, fallback) {
  try {
    const v = parseFloat(getComputedStyle(el).borderTopLeftRadius);
    return Number.isFinite(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

// ------------------------------------------------------------------ dialog

/**
 * createDialog({ trigger, root, from, to, onOpenChange, clock, reduced })
 * from: colour of the trigger (default var(--primary)); to: colour of the dialog surface.
 * Returns { open, close, toggle, isOpen, seek, settled, destroy, driver, keep }.
 */
export function createDialog(o) {
  const { trigger, root } = o;
  const panel = root.querySelector('[role="dialog"], [role="alertdialog"]');
  if (!panel) throw new Error('createDialog: root needs an element with role="dialog"');
  const doc = root.ownerDocument || document;
  const FROM = o.from || 'var(--primary, #171717)';
  const TO = o.to || 'var(--background, #ffffff)';

  const make = (cls, tag = 'div') => { const el = doc.createElement(tag); el.className = cls; return el; };
  let surface = panel.querySelector('.am-dialog-surface');
  if (!surface) { surface = make('am-dialog-surface'); panel.insertBefore(surface, panel.firstElementChild); }
  attr(surface, 'aria-hidden', 'true');
  const inks = [...surface.querySelectorAll('.am-dialog-ink')];
  while (inks.length < 2) inks.push(surface.appendChild(make('am-dialog-ink')));
  let label = surface.querySelector('.am-dialog-label');
  if (!label) label = surface.appendChild(make('am-dialog-label', 'span'));
  label.textContent = o.label ?? trigger.textContent.trim();
  let content = panel.querySelector('.am-dialog-content');
  if (!content) {
    content = make('am-dialog-content');
    for (const c of [...panel.childNodes]) if (c !== surface) content.appendChild(c);
    panel.appendChild(content);
  }
  const backdrop = root.querySelector('.am-dialog-backdrop');

  ensureId(panel, 'am-dialog');
  attr(panel, 'aria-modal', 'true');
  if (!panel.hasAttribute('tabindex')) attr(panel, 'tabindex', '-1');
  if (!panel.hasAttribute('aria-labelledby') && !panel.hasAttribute('aria-label')) {
    const title = panel.querySelector('.am-dialog-title, h1, h2, h3');
    if (title) attr(panel, 'aria-labelledby', ensureId(title, 'am-dialog-title'));
  }
  attr(trigger, 'aria-haspopup', 'dialog');
  attr(trigger, 'aria-controls', panel.id);
  attr(trigger, 'aria-expanded', 'false');

  // state as functions of time
  const openS = steps(false);
  const geo = steps(null);
  const m = track(0, PRESETS.morph); // 0 = the trigger's box, 1 = the dialog
  const back = track(0, PRESETS.smooth);
  const body = presence(false);
  const lab = presence(true, { dyIn: 6, dyOut: -4, blur: 4, scaleFrom: 1 });
  const ink = { base: FROM, list: [] };
  let endT = -Infinity;
  const mark = (t) => { if (t > endT) endT = t; };

  // Geometry of the one shape: at k = 0 the panel is moved so its centre sits on the
  // trigger's centre and clipped to the trigger's size; at k = 1 it is the dialog.
  function measure() {
    const was = root.hidden;
    const moved = panel.style.transform;
    root.hidden = false;
    panel.style.transform = '';
    const pr = panel.getBoundingClientRect();
    const tr = trigger.getBoundingClientRect();
    panel.style.transform = moved;
    root.hidden = was;
    const dx = tr.left + tr.width / 2 - (pr.left + pr.width / 2);
    const dy = tr.top + tr.height / 2 - (pr.top + pr.height / 2);
    return {
      pr,
      tr,
      g: {
        dx, dy,
        ix: Math.max(0, (pr.width - tr.width) / 2), iy: Math.max(0, (pr.height - tr.height) / 2),
        w: tr.width, h: tr.height, pw: pr.width, ph: pr.height,
        r0: radiusOf(trigger, 8), r1: radiusOf(panel, 12),
      },
    };
  }

  const settledAll = (t) => m.settled(t) && back.settled(t) && body.settled(t) && lab.settled(t) && inkSettled(ink, t);

  function paint(t, { reduced }) {
    const isOpen = openS.at(t);
    // closing stays on screen until every spring is home; before the first open all is settled
    const visible = isOpen || (!reduced && !settledAll(t));
    attr(trigger, 'aria-expanded', String(isOpen));
    attr(panel, 'data-state', isOpen ? 'open' : 'closed');
    root.hidden = !visible;
    trigger.style.opacity = visible && !reduced ? '0' : '';
    if (!visible) return;
    const g = geo.at(t);
    const k = reduced ? 1 : clamp01(m.at(t));
    if (k >= 1 || !g) {
      panel.style.clipPath = '';
      panel.style.transform = '';
    } else {
      const f = 1 - k;
      panel.style.transform = `translate(${px(g.dx * f)}, ${px(g.dy * f)})`;
      panel.style.clipPath = `inset(${px(g.iy * f)} ${px(g.ix * f)} round ${px(g.r0 + (g.r1 - g.r0) * k)})`;
    }
    if (backdrop) backdrop.style.opacity = num(reduced ? 1 : clamp01(back.at(t)));
    paintInk(inkAt(ink, t, reduced), surface, inks);
    if (g) {
      label.style.left = px(g.ix);
      label.style.top = px(g.iy);
      label.style.width = px(g.w);
      label.style.height = px(g.h);
    }
    applyPresence(label, reduced ? GONE : lab.at(t));
    applyPresence(content, reduced ? (isOpen ? SHOWN : GONE) : body.at(t));
  }

  function draw(t, s) {
    paint(t, s);
    if (!api.keep && t >= endT && openS.ev.length && settledAll(t)) {
      for (const tr of [m, back, body.p, lab.p]) tr.compact(t);
      body.marks = [];
      lab.marks = [];
      openS.compact();
      geo.compact();
      const lastInk = ink.list[ink.list.length - 1];
      if (lastInk) ink.base = lastInk.color;
      ink.list = [];
    }
  }

  const d = driver(draw, { clock: o.clock, reduced: o.reduced });
  d.busy = (t) => t < endT || !settledAll(t);
  const commit = () => { paint(d.now(), { reduced: d.reduced }); d.kick(); };
  const when = (opt) => (opt && opt.t !== undefined ? { t: opt.t, live: false } : { t: d.now(), live: true });

  function open(opt = {}) {
    const { t, live } = when(opt);
    if (openS.last) return api;
    const { pr, tr, g } = measure();
    // the click point in the panel's own coordinates while it sits on the trigger
    const x = (opt.x ?? tr.left + tr.width / 2) - pr.left - g.dx;
    const y = (opt.y ?? tr.top + tr.height / 2) - pr.top - g.dy;
    openS.set(t, true);
    geo.set(t, g);
    m.to(t, 1);
    back.to(t, 1);
    lab.exit(t);
    body.enter(t + 0.14);
    ink.list.push({ t, color: TO, x, y, R: cover(x, y, g.pw, g.ph), sp: PRESETS.smooth });
    ink.list.sort((a, b) => a.t - b.t);
    mark(t + 0.14);
    commit();
    if (live) {
      const first = panel.querySelector('[autofocus]') || tabbables(content)[0] || panel;
      first.focus();
      if (o.onOpenChange) o.onOpenChange(true);
    }
    return api;
  }

  function close(opt = {}) {
    const { t, live } = when(opt);
    if (!openS.last) return api;
    const { g } = measure();
    // the trigger colour grows from the centre while the shape flies back into the button
    const x = g.pw / 2;
    const y = g.ph / 2;
    openS.set(t, false);
    geo.set(t, g);
    body.exit(t);
    back.to(t, 0);
    m.to(t + 0.06, 0);
    lab.enter(t + 0.3);
    ink.list.push({ t: t + 0.06, color: FROM, x, y, R: cover(x, y, g.pw, g.ph), sp: PRESETS.snappy });
    ink.list.sort((a, b) => a.t - b.t);
    mark(t + 0.3);
    commit();
    if (live) {
      trigger.focus();
      if (o.onOpenChange) o.onOpenChange(false);
    }
    return api;
  }

  const listeners = [];
  const on = (el, type, fn) => { el.addEventListener(type, fn); listeners.push([el, type, fn]); };

  on(trigger, 'click', (e) => {
    if (openS.last) return close();
    const pointer = e.detail > 0;
    open(pointer ? { x: e.clientX, y: e.clientY } : {});
  });
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
  on(root, 'click', (e) => {
    const target = e.target;
    if (target === backdrop || (target.closest && target.closest('[data-am-close]'))) close();
  });

  const api = {
    trigger,
    root,
    panel,
    content,
    driver: d,
    keep: false,
    open,
    close,
    toggle: (opt) => (openS.last ? close(opt) : open(opt)),
    isOpen: (t) => (t === undefined ? openS.last : openS.at(t)),
    seek: (t) => paint(t, { reduced: d.reduced }),
    settled: (t) => t >= endT && settledAll(t),
    destroy() {
      d.stop();
      for (const [el, type, fn] of listeners) el.removeEventListener(type, fn);
    },
  };
  paint(d.now(), { reduced: d.reduced });
  return api;
}
