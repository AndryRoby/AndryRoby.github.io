/*
 * ARLing Motion: Number.
 * A number that rolls to its new value. Every digit is its own column on the snappy spring
 * (one small overshoot, under 3 %), and the columns start one after another from the right,
 * so a change reads as a count and not as a flicker. Leading columns open and close in width
 * on the smooth spring when the number gains or loses a digit. Group and decimal separators
 * follow the locale (Intl.NumberFormat).
 *
 * Markup:
 *   <span class="am-number" data-value="1204.5" data-decimals="2" data-prefix="€"></span>
 * The component adds the parts. Screen readers get the final value as text at once (and an
 * aria-live announcement when live is set); the rolling columns are aria-hidden.
 * MIT licence.
 */
import { track, driver, attr, PRESETS } from '../../src/core.js';

/** Seconds between the start of neighbouring columns, from the right. */
export const STAGGER = 0.035;

const round2 = (v) => Math.round(v * 100) / 100;

/** Separators of a locale, e.g. { group: ',', decimal: '.' } for en-US. */
export function separators(locale) {
  const parts = new Intl.NumberFormat(locale, { minimumFractionDigits: 1 }).formatToParts(12345.6);
  const pick = (type, fallback) => (parts.find((p) => p.type === type) || { value: fallback }).value;
  return { group: pick('group', ','), decimal: pick('decimal', '.') };
}

/** The digit at place p (0 = units, -1 = tenths) of |value| rounded to `decimals`. */
export function digitAt(value, p, decimals) {
  const n = Math.round(Math.abs(value) * 10 ** decimals);
  return Math.floor(n / 10 ** (p + decimals)) % 10;
}

/** Highest place with a non zero digit, at least 0 (units are always shown). */
export function topPlace(value, decimals) {
  const n = Math.round(Math.abs(value) * 10 ** decimals);
  const whole = Math.floor(n / 10 ** decimals);
  return whole > 0 ? Math.floor(Math.log10(whole) + 1e-9) : 0;
}

/**
 * createNumber({ el, value, decimals, prefix, suffix, locale, grouping, live, clock, reduced })
 * Returns { set, value, seek, settled, destroy, driver, keep, el }.
 */
export function createNumber(o) {
  const el = o.el;
  const doc = el.ownerDocument || document;
  const data = (k) => (el.hasAttribute(`data-${k}`) ? el.getAttribute(`data-${k}`) : undefined);
  const num = (v, d) => (v === undefined || v === null || v === '' || Number.isNaN(Number(v)) ? d : Number(v));
  const decimals = Math.max(0, Math.min(6, Math.round(num(o.decimals ?? data('decimals'), 0))));
  const prefix = o.prefix ?? data('prefix') ?? '';
  const suffix = o.suffix ?? data('suffix') ?? '';
  const locale = o.locale ?? data('locale') ?? 'en-US';
  const grouping = o.grouping ?? data('grouping') !== 'false';
  const sep = separators(locale);
  const fmt = new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: grouping });
  const text = (v) => `${v < 0 ? '−' : ''}${prefix}${fmt.format(Math.abs(v))}${suffix}`;

  const make = (tag, cls, content) => {
    const s = doc.createElement(tag);
    s.className = cls;
    if (content !== undefined) s.textContent = content;
    return s;
  };
  el.textContent = '';
  el.classList.add('am-number');
  const sr = make('span', 'am-number-sr');
  const roll = make('span', 'am-number-roll');
  attr(roll, 'aria-hidden', 'true');
  if (o.live) attr(sr, 'aria-live', o.live === true ? 'polite' : o.live);
  el.appendChild(sr);
  el.appendChild(roll);
  const sign = make('span', 'am-number-sign', '−');
  const pre = make('span', 'am-number-affix', prefix);
  const post = make('span', 'am-number-affix', suffix);
  roll.appendChild(sign);
  if (prefix) roll.appendChild(pre);

  // columns by place, from the highest; each has a digit track and an "open" track (width)
  const cols = new Map();
  let first = null; // leftmost column element, new higher places go before it
  function column(p) {
    if (cols.has(p)) return cols.get(p);
    const box = make('span', 'am-number-col');
    const strip = make('span', 'am-number-strip');
    for (let d = 0; d < 10; d++) strip.appendChild(make('span', 'am-number-digit', String(d)));
    box.appendChild(strip);
    const c = { p, box, strip, pos: track(0, PRESETS.snappy), open: track(p <= 0 ? 1 : 0, PRESETS.smooth), gap: null };
    if (p >= 3 && p % 3 === 0 && grouping) {
      c.gap = make('span', 'am-number-sep', sep.group);
    }
    return c;
  }
  function ensure(top) {
    const low = -decimals;
    let hi = cols.size ? Math.max(...cols.keys()) : low - 1;
    if (!cols.size) {
      for (let p = Math.max(top, 0); p >= low; p--) {
        const c = column(p);
        cols.set(p, c);
        roll.appendChild(c.box);
        if (c.gap) roll.appendChild(c.gap);
        if (p === 0 && decimals) roll.appendChild(make('span', 'am-number-sep am-number-point', sep.decimal));
      }
      first = cols.get(Math.max(top, 0)).box;
      if (suffix) roll.appendChild(post);
      return;
    }
    for (let p = hi + 1; p <= top; p++) {
      const c = column(p);
      cols.set(p, c);
      roll.insertBefore(c.box, first);
      if (c.gap) roll.insertBefore(c.gap, first);
      first = c.box;
    }
  }

  let current = num(o.value ?? data('value'), 0);
  const signTrack = track(current < 0 ? 1 : 0, PRESETS.smooth);
  ensure(topPlace(current, decimals));
  for (const c of cols.values()) {
    c.pos.initial = digitAt(current, c.p, decimals);
    c.open.initial = c.p <= topPlace(current, decimals) ? 1 : 0;
  }
  sr.textContent = text(current);
  attr(el, 'data-state', 'idle');
  let endT = -Infinity;
  const all = () => [signTrack, ...[...cols.values()].flatMap((c) => [c.pos, c.open])];
  const settledAll = (t) => all().every((tr) => tr.settled(t));

  function paint(t, { reduced }) {
    const at = (tr) => (reduced ? tr.target(t) : tr.at(t));
    const s = Math.max(0, Math.min(1, at(signTrack)));
    sign.style.width = `${round2(s * 0.62)}em`;
    sign.style.opacity = String(round2(s));
    for (const c of cols.values()) {
      const open = Math.max(0, Math.min(1, at(c.open)));
      c.box.style.width = `${round2(open)}ch`;
      c.box.style.opacity = String(round2(open));
      c.strip.style.transform = `translateY(${round2(-at(c.pos) * 10)}%)`;
      if (c.gap) {
        c.gap.style.width = open > 0.5 ? '' : '0';
        c.gap.style.opacity = String(round2(Math.max(0, open * 2 - 1)));
      }
    }
    attr(el, 'data-state', settledAll(t) ? 'idle' : 'rolling');
  }

  function draw(t, st) {
    paint(t, st);
    if (!api.keep && t >= endT && settledAll(t)) for (const tr of all()) tr.compact(t);
  }

  const d = driver(draw, { clock: o.clock, reduced: o.reduced });
  d.busy = (t) => t < endT || !settledAll(t);
  const when = (opt) => (opt && opt.t !== undefined ? opt.t : d.now());

  /** Rolls to value. opt: { t } to schedule it (demo, video). */
  function set(value, opt = {}) {
    const v = num(value, current);
    const t = when(opt);
    const top = topPlace(v, decimals);
    ensure(top);
    const places = [...cols.keys()].sort((a, b) => a - b); // from the right
    let k = 0;
    for (const p of places) {
      const c = cols.get(p);
      const target = digitAt(v, p, decimals);
      const start = t + (o.stagger ?? STAGGER) * k;
      if (c.pos.target(Infinity) !== target) {
        c.pos.to(start, target);
        k++;
        if (start > endT) endT = start;
      }
      const openTarget = p <= Math.max(top, 0) ? 1 : 0;
      if (c.open.target(Infinity) !== openTarget) c.open.to(t, openTarget);
    }
    signTrack.to(t, v < 0 ? 1 : 0);
    if (t > endT) endT = t;
    current = v;
    sr.textContent = text(v);
    paint(d.now(), { reduced: d.reduced });
    d.kick();
    return api;
  }

  const api = {
    el,
    driver: d,
    keep: false,
    set,
    value: () => current,
    text: () => text(current),
    seek: (t) => paint(t, { reduced: d.reduced }),
    settled: (t) => t >= endT && settledAll(t),
    destroy() { d.stop(); },
  };
  paint(d.now(), { reduced: d.reduced });
  return api;
}
