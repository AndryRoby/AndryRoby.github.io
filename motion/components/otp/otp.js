/*
 * ARLing Motion: One-time code input (OTP).
 * One real input sits over a row of slots, so paste, autofill of one-time codes and screen
 * readers work as in any text field. Each digit enters its slot on its own (rise, blur,
 * fade), the focus ring slides from slot to slot with its leading edge first, and a
 * verified code turns the row green as one circle growing from the last digit: a slot
 * switches colour only once the circle covers it, never through a grey blend.
 *
 * Markup:
 *   <div class="am-otp">
 *     <input class="am-otp-input" aria-label="Verification code" maxlength="6">
 *     <div class="am-otp-slots"></div>
 *   </div>
 * The component adds the slots, the ring and a status line. It sets inputmode="numeric",
 * autocomplete="one-time-code" and pattern on the input.
 *
 * Keyboard: type or paste the code, Backspace deletes. Left, Right, Home, End and Shift with
 * an arrow work as in any text field (screen readers read the characters with them), and the
 * ring follows the caret. Typing puts the caret back at the end, so the ring shows where the
 * next character goes. When the code is complete, onComplete(code) runs; return true or
 * false (or a promise of it), or call success() or error() yourself. After a verified code
 * the ring is gone, and a focused field shows an outline around the row (otp.css).
 * MIT licence.
 */
import { presence, applyPresence, indicator, track, driver, spring, springStep, settleTime, steps, attr, cover, JUMP, PRESETS } from '../../src/core.js';

// ------------------------------------------------------------------ helpers

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const px = (v) => `${Math.round(v * 100) / 100}px`;
const num = (v) => String(Math.round(v * 10000) / 10000);
const SHOWN = { opacity: 1, blur: 0, y: 0, scale: 1, visible: true };
const GONE = { opacity: 0, blur: 0, y: 0, scale: 1, visible: false };

let uid = 0;
const ensureId = (el, prefix) => el.id || (el.id = `${prefix}-${++uid}`);

/** Distance from (x, y) to the nearest point of a box: where a growing circle first touches it. */
const touch = (x, y, b) => Math.hypot(Math.max(b.x - x, 0, x - (b.x + b.w)), Math.max(b.y - y, 0, y - (b.y + b.h)));

// ------------------------------------------------------------------ otp

/** Springs of the focus ring (both edges home within 0.91 s). */
export const RING = { fast: spring(0.28, 0.9), slow: spring(0.48, 0.95) };
const DIGIT = { dyIn: 10, dyOut: -6, blur: 6, scaleFrom: 0.9 };

/**
 * createOtp({ root, length, pattern, onComplete(code), onChange(value), success, base,
 *   successText, errorText, clock, reduced })
 * pattern: one allowed character (default /\d/); success and base: colours of the verified
 * and the plain slot (default var(--am-success, #16a34a) and var(--background, #fff)).
 * Returns { type, setValue, clear, focus, blur, success, error, value, status, seek,
 * settled, destroy, driver, input, slots, keep }.
 */
export function createOtp(o) {
  const root = o.root;
  const doc = root.ownerDocument || document;
  const input = root.querySelector('.am-otp-input') || root.querySelector('input');
  const n = o.length || parseInt(input.getAttribute('maxlength'), 10) || 6;
  const allowed = o.pattern || /\d/;
  const GREEN = o.success || 'var(--am-success, #16a34a)';
  const BASE = o.base || 'var(--background, #ffffff)';

  attr(input, 'maxlength', String(n));
  attr(input, 'autocomplete', 'one-time-code');
  if (!input.hasAttribute('inputmode')) attr(input, 'inputmode', allowed.source === '\\d' ? 'numeric' : 'text');
  if (allowed.source === '\\d') attr(input, 'pattern', `\\d{${n}}`);
  attr(input, 'spellcheck', 'false');
  if (!input.hasAttribute('aria-label') && !input.hasAttribute('aria-labelledby')) attr(input, 'aria-label', 'Verification code');

  const make = (cls, parent, tag = 'div') => { const el = doc.createElement(tag); el.className = cls; parent.appendChild(el); return el; };
  let row = root.querySelector('.am-otp-slots');
  if (!row) row = make('am-otp-slots', root);
  attr(row, 'aria-hidden', 'true');
  const slots = [...row.querySelectorAll('.am-otp-slot')];
  while (slots.length < n) slots.push(make('am-otp-slot', row));
  const parts = slots.slice(0, n).map((slot) => ({
    slot,
    ink: slot.querySelector('.am-otp-ink') || make('am-otp-ink', slot, 'span'),
    char: slot.querySelector('.am-otp-char') || make('am-otp-char', slot, 'span'),
  }));
  const ring = row.querySelector('.am-otp-ring') || make('am-otp-ring', row);
  const status = root.querySelector('.am-otp-status') || make('am-otp-status', root);
  attr(status, 'role', 'status');
  attr(input, 'aria-describedby', ensureId(status, 'am-otp-status'));

  // slot boxes in the row's coordinates
  function measure() {
    const rr = row.getBoundingClientRect();
    return parts.map((p, j) => {
      const r = p.slot.getBoundingClientRect();
      return r.width ? { x: r.left - rr.left, y: r.top - rr.top, w: r.width, h: r.height } : { x: j * 52, y: 0, w: 44, h: 52 };
    });
  }
  let boxes = measure();

  const sanitize = (s) => [...String(s || '')].filter((c) => allowed.test(c)).join('').slice(0, n);
  const value = steps(sanitize(input.value));
  const focusS = steps(false);
  const state = steps(''); // '' | 'success' | 'error'
  const digits = parts.map((_, j) => ({ shown: steps(value.initial[j] || ''), pres: presence(!!value.initial[j], DIGIT) }));
  const activeOf = (v) => Math.min(v.length, n - 1);
  // Live only: the slot of the caret when it is not at the end (moved with the arrow keys).
  let caret = null;
  const ringSlot = (v) => (caret === null ? activeOf(v) : Math.min(caret, n - 1, v.length));
  const b0 = boxes[activeOf(value.initial)];
  const ringInd = indicator(b0.x, b0.x + b0.w, RING.fast, RING.slow);
  const ringOp = track(0, PRESETS.snappy);
  const inks = []; // { t, color, x, y, R, sp }

  let endT = -Infinity;
  const mark = (t) => { if (t > endT) endT = t; };
  const inkSettled = (t) => inks.every((e) => e.t > t || t >= e.t + settleTime(e.sp));
  const settledAll = (t) => ringInd.settled(t) && ringOp.settled(t) && inkSettled(t) && digits.every((dg) => dg.pres.settled(t));

  /** Ink of slot j at t: the base colour and the circles that are on their way across it. */
  function slotInk(j, t, reduced) {
    const b = boxes[j];
    let base = BASE;
    let layers = [];
    for (const e of inks) {
      if (e.t > t) break;
      const r = reduced ? Infinity : springStep(e.sp, t - e.t) * e.R;
      if (r >= cover(e.x - b.x, e.y - b.y, b.w, b.h)) { base = e.color; layers = []; }
      else if (r > touch(e.x, e.y, b)) layers.push({ color: e.color, r, x: e.x - b.x, y: e.y - b.y });
    }
    if (layers.length > 1) layers = layers.slice(-1);
    return { base, layer: layers[0] || null };
  }

  function paint(t, { reduced }) {
    const v = value.at(t);
    const st = state.at(t);
    const focused = focusS.at(t);
    if (input.value !== v) input.value = v;
    attr(input, 'aria-invalid', st === 'error' ? 'true' : null);
    attr(root, 'data-state', st || (v.length === n ? 'complete' : 'idle'));
    const act = ringSlot(v);
    parts.forEach((p, j) => {
      const dg = digits[j];
      const s = reduced ? (v[j] ? SHOWN : GONE) : dg.pres.at(t);
      applyPresence(p.char, s);
      const ch = s.visible ? (reduced ? v[j] || '' : dg.shown.at(t)) : '';
      if (p.char.textContent !== ch) p.char.textContent = ch;
      attr(p.slot, 'data-filled', v[j] ? true : null);
      attr(p.slot, 'data-active', focused && j === act && st !== 'success' ? true : null);
      const k = slotInk(j, t, reduced);
      p.slot.style.background = k.base;
      attr(p.slot, 'data-inked', k.base === GREEN ? true : null);
      if (!k.layer) { p.ink.style.visibility = 'hidden'; p.ink.style.clipPath = ''; p.ink.style.background = ''; }
      else {
        p.ink.style.visibility = 'visible';
        p.ink.style.background = k.layer.color;
        p.ink.style.clipPath = `circle(${px(k.layer.r)} at ${px(k.layer.x)} ${px(k.layer.y)})`;
      }
    });
    const e = reduced ? ringInd.target(t) : ringInd.at(t);
    const op = reduced ? ringOp.target(t) : clamp01(ringOp.at(t));
    ring.style.opacity = num(op);
    ring.style.visibility = op > 0.002 ? '' : 'hidden';
    ring.style.transform = `translateX(${px(e.left)})`;
    ring.style.width = px(Math.max(0, e.right - e.left));
    const msg = st === 'success' ? o.successText || 'Code verified.' : st === 'error' ? o.errorText || 'That code did not work. Try again.' : '';
    if (status.textContent !== msg) status.textContent = msg;
  }

  function draw(t, s) {
    paint(t, s);
    if (!api.keep && t >= endT && (value.ev.length || focusS.ev.length || state.ev.length) && settledAll(t)) {
      ringInd.l.compact(t);
      ringInd.r.compact(t);
      ringOp.compact(t);
      for (const dg of digits) { dg.pres.p.compact(t); dg.pres.marks = []; dg.shown.compact(); }
      if (inks.length) {
        // keep only the colour in force: one finished circle that covers everything
        const last = slotInk(0, t, true).base;
        inks.length = 0;
        if (last !== BASE) inks.push({ t: -1e9, color: last, x: 0, y: 0, R: 1e6, sp: JUMP });
      }
      value.compact();
      focusS.compact();
      state.compact();
    }
  }

  const d = driver(draw, { clock: o.clock, reduced: o.reduced });
  d.busy = (t) => t < endT || !settledAll(t);
  const commit = () => { paint(d.now(), { reduced: d.reduced }); d.kick(); };
  const when = (opt) => (opt && opt.t !== undefined ? { t: opt.t, live: false } : { t: d.now(), live: true });
  const rowBox = () => {
    const last = boxes[boxes.length - 1];
    return { w: last.x + last.w, h: Math.max(...boxes.map((b) => b.y + b.h)) };
  };

  function moveRing(t, i) {
    const b = boxes[i];
    const cur = ringInd.target(t);
    if (Math.abs(cur.left - b.x) < 0.01 && Math.abs(cur.right - b.x - b.w) < 0.01) return;
    if (ringOp.target(t) === 0) {
      // hidden: take the place at once, then show
      ringInd.l.to(t, b.x, JUMP);
      ringInd.r.to(t, b.x + b.w, JUMP);
      ringInd.last = [b.x, b.x + b.w];
    } else ringInd.to(t, b.x, b.x + b.w);
  }

  function growInk(t, color, j, sp) {
    const b = boxes[j];
    const x = b.x + b.w / 2;
    const y = b.y + b.h / 2;
    const { w, h } = rowBox();
    inks.push({ t, color, x, y, R: cover(x, y, w, h), sp });
    inks.sort((a, c) => a.t - c.t);
  }

  /** Sets the whole value (sanitised). Digits that change leave or enter their own slots. */
  function setValue(raw, opt = {}) {
    const { t, live } = when(opt);
    const v = sanitize(raw);
    const old = value.last;
    if (v === old) return api;
    boxes = live ? measure() : boxes;
    value.set(t, v);
    let first = -1;
    for (let j = 0; j < n; j++) {
      const a = old[j];
      const b = v[j];
      if (a === b) continue;
      if (first < 0) first = j;
      const dg = digits[j];
      if (a && !b) dg.pres.exit(t);
      else if (!a && b) { dg.shown.set(t, b); dg.pres.enter(t); }
      else { dg.shown.set(t, b); dg.pres.p.to(t, 0, JUMP); dg.pres.enter(t + 0.001); }
    }
    moveRing(t, ringSlot(v));
    const st = state.last;
    if (st) {
      // editing a checked code starts over: the plain colour grows back from the edit
      state.set(t, '');
      if (st === 'success') growInk(t, BASE, Math.max(0, first), PRESETS.snappy);
      if (ringOp.target(t) === 0 && focusS.last) ringOp.to(t, 1, PRESETS.snappy);
    }
    mark(t + 0.001);
    commit();
    if (live) {
      if (o.onChange) o.onChange(v);
      if (v.length === n && o.onComplete) {
        const r = o.onComplete(v);
        const settle = (ok) => { if (value.last === v) (ok ? success : error)(); };
        if (r === true || r === false) settle(r);
        else if (r && typeof r.then === 'function') r.then((ok) => { if (ok === true || ok === false) settle(ok); });
      }
    }
    return api;
  }

  /** Types characters one after another from opt.t, every opt.every seconds (demos). */
  function type(chars, opt = {}) {
    const t0 = opt.t ?? d.now();
    const every = opt.every ?? 0.25;
    [...chars].forEach((c, k) => setValue(value.last + c, { t: t0 + k * every }));
    return api;
  }

  function success(opt = {}) {
    const { t } = when(opt);
    if (state.last === 'success') return api;
    state.set(t, 'success');
    growInk(t, GREEN, Math.max(0, value.last.length - 1), PRESETS.smooth);
    ringOp.to(t, 0, PRESETS.exit);
    mark(t);
    commit();
    return api;
  }

  function error(opt = {}) {
    const { t } = when(opt);
    if (state.last === 'error') return api;
    const was = state.last;
    state.set(t, 'error');
    if (was === 'success') growInk(t, BASE, 0, PRESETS.snappy);
    mark(t);
    commit();
    return api;
  }

  /** Empties the code: the digits leave from the last one back, the ring returns to the first slot. */
  function clear(opt = {}) {
    const { t } = when(opt);
    const old = value.last;
    if (!old && !state.last) return api;
    value.set(t, '');
    for (let j = old.length - 1, k = 0; j >= 0; j--, k++) digits[j].pres.exit(t + k * 0.02);
    if (state.last === 'success') growInk(t, BASE, 0, PRESETS.snappy);
    if (state.last) state.set(t, '');
    moveRing(t, 0);
    if (focusS.last) ringOp.to(t, 1, PRESETS.snappy);
    mark(t + old.length * 0.02);
    commit();
    return api;
  }

  function setFocus(on, opt = {}) {
    const { t } = when(opt);
    if (focusS.last === on) return api;
    focusS.set(t, on);
    moveRing(t, ringSlot(value.last));
    ringOp.to(t, on && state.last !== 'success' ? 1 : 0, PRESETS.snappy);
    mark(t);
    commit();
    return api;
  }

  // ---------------------------------------------------------------- live input
  const listeners = [];
  const on = (target, type, fn) => { target.addEventListener(type, fn); listeners.push([target, type, fn]); };
  const toEnd = () => { const L = input.value.length; if (input.setSelectionRange) { try { input.setSelectionRange(L, L); } catch { /* type without selection */ } } };

  /** The ring follows the caret after arrow keys, Home, End or a selection (nothing is blocked). */
  const syncCaret = () => {
    const L = input.value.length;
    const c = typeof input.selectionStart === 'number' ? input.selectionStart : L;
    const next = c >= L ? null : Math.max(0, Math.min(c, n - 1));
    if (next === caret) return;
    caret = next;
    if (!focusS.last) return;
    moveRing(d.now(), ringSlot(value.last));
    commit();
  };

  on(input, 'input', () => {
    const clean = sanitize(input.value);
    if (clean !== input.value) input.value = clean;
    caret = null;
    setValue(clean);
    toEnd();
  });
  on(input, 'keyup', syncCaret);
  on(input, 'select', syncCaret);
  // data-focused follows the real focus only (not a demo's scheduled focus): with it otp.css
  // keeps a visible focus outline around the row once the ring has left after success
  on(input, 'focus', () => { caret = null; attr(root, 'data-focused', true); setFocus(true); toEnd(); });
  on(input, 'blur', () => { caret = null; attr(root, 'data-focused', null); setFocus(false); });
  on(input, 'click', () => { toEnd(); syncCaret(); });

  const api = {
    root,
    input,
    slots: parts.map((p) => p.slot),
    driver: d,
    keep: false,
    type,
    setValue,
    clear,
    success,
    error,
    focus: (opt = {}) => { if (opt.t === undefined) input.focus(); else setFocus(true, opt); return api; },
    blur: (opt = {}) => { if (opt.t === undefined) input.blur(); else setFocus(false, opt); return api; },
    value: (t) => (t === undefined ? value.last : value.at(t)),
    status: (t) => (t === undefined ? state.last : state.at(t)),
    seek: (t) => paint(t, { reduced: d.reduced }),
    settled: (t) => t >= endT && settledAll(t),
    destroy() {
      d.stop();
      attr(root, 'data-focused', null);
      for (const [target, type, fn] of listeners) target.removeEventListener(type, fn);
    },
  };
  // already focused (autofocus runs before the component is built): show the ring
  if (doc.activeElement === input) { attr(root, 'data-focused', true); setFocus(true); }
  paint(d.now(), { reduced: d.reduced });
  return api;
}
