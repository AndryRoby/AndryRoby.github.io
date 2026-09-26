/*
 * ARLing Motion: Command menu (the Cmd+K palette).
 * Typing filters the list without a cut: rows that no longer match leave in place, the
 * rows that stay slide up into the gaps, rows that match again enter, and the list's
 * height follows on a spring. One highlight marks the chosen row; it stretches toward the
 * next row with its leading edge first and the trailing edge catches up.
 *
 * Markup:
 *   <div class="am-command">
 *     <input class="am-command-input" placeholder="Type a command or search" aria-label="Command">
 *     <div class="am-command-list" role="listbox" aria-label="Commands">
 *       <div role="option" data-value="new-file" data-keywords="create">New file</div>
 *       <div role="option">Settings</div>
 *     </div>
 *   </div>
 * The component adds the highlight, the empty message and a status line for screen readers.
 * Rows are one height (the first row is measured) and keep their order; there are no groups.
 *
 * Keyboard (WAI-ARIA APG, combobox with a listbox that is always shown): typing filters,
 * Down and Up move the chosen row, Enter picks it, Escape clears the search (with an empty
 * search it is left to a surrounding dialog). Focus stays in the input; the chosen row is
 * aria-activedescendant. Ctrl+K or Cmd+K anywhere on the page focuses the input.
 * MIT licence.
 */
import { track, indicator, presence, driver, spring, steps, attr, JUMP, PRESETS } from '../../src/core.js';

// ------------------------------------------------------------------ helpers

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const px = (v) => `${Math.round(v * 100) / 100}px`;
const num = (v) => String(Math.round(v * 10000) / 10000);
const SHOWN = { opacity: 1, blur: 0, y: 0, scale: 1, visible: true };
const GONE = { opacity: 0, blur: 0, y: 0, scale: 1, visible: false };

let uid = 0;
const ensureId = (el, prefix) => el.id || (el.id = `${prefix}-${++uid}`);

/** A presence state plus a place in the list, written as one transform. */
function applyAt(el, s, y) {
  el.style.opacity = num(s.opacity);
  el.style.filter = s.blur > 0.05 ? `blur(${s.blur.toFixed(2)}px)` : '';
  el.style.transform = `translateY(${px(y + s.y)}) scale(${s.scale.toFixed(4)})`;
  el.style.visibility = s.visible ? '' : 'hidden';
}

// ------------------------------------------------------------------ matching

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');

/** Every word of the query appears in the row's text, value or keywords (case and accents ignored). */
export function matches(haystack, query) {
  const words = norm(query).trim().split(/\s+/).filter(Boolean);
  const h = norm(haystack);
  return words.every((w) => h.includes(w));
}

// ------------------------------------------------------------------ command

/** Stagger between rows that enter again, seconds. */
export const ROW_STEP = 0.025;
const ROW_MOTION = { dyIn: 6, dyOut: -2, blur: 4, scaleFrom: 0.98 };

/**
 * createCommand({ root, onSelect(value, row), loop, shortcut, pad, clock, reduced })
 * loop: Down on the last row goes to the first (default false); shortcut: the letter for
 * Ctrl or Cmd (default 'k', false turns it off); pad: space above the first row, px (4).
 * Returns { search, move, highlight, select, query, active, visible, measure, seek, settled,
 * destroy, driver, input, list, items, keep }.
 */
export function createCommand(o) {
  const root = o.root;
  const doc = root.ownerDocument || document;
  const input = o.input || root.querySelector('.am-command-input') || root.querySelector('input');
  const list = o.list || root.querySelector('[role="listbox"]');
  const items = [...list.querySelectorAll('[role="option"]')];
  const pad = o.pad ?? 4;
  const loop = !!o.loop;

  // ARIA: a combobox whose listbox is always shown
  attr(input, 'role', 'combobox');
  attr(input, 'aria-expanded', 'true');
  attr(input, 'aria-autocomplete', 'list');
  attr(input, 'aria-controls', ensureId(list, 'am-command-list'));
  attr(input, 'autocomplete', 'off');
  attr(input, 'spellcheck', 'false');
  if (!list.hasAttribute('aria-label') && !list.hasAttribute('aria-labelledby')) attr(list, 'aria-label', 'Commands');
  items.forEach((it) => { ensureId(it, 'am-command-item'); attr(it, 'tabindex', null); });

  const make = (cls, text, parent) => {
    const el = doc.createElement('div');
    el.className = cls;
    if (text) el.textContent = text;
    parent.appendChild(el);
    return el;
  };
  const bar = list.querySelector('.am-command-highlight') || make('am-command-highlight', '', list);
  if (bar !== list.firstElementChild) list.insertBefore(bar, list.firstElementChild);
  attr(bar, 'aria-hidden', 'true');
  const empty = list.querySelector('.am-command-empty') || make('am-command-empty', o.emptyText || 'No results.', list);
  attr(empty, 'aria-hidden', 'true'); // the status line says it to screen readers
  const status = root.querySelector('.am-command-status') || make('am-command-status', '', root);
  attr(status, 'role', 'status');

  // a shortcut hint (.am-command-kbd) is shown but not searched
  const labelOf = (it) => {
    const hint = it.querySelector('.am-command-kbd');
    return (hint ? it.textContent.replace(hint.textContent, '') : it.textContent).trim();
  };
  const text = items.map((it) => `${labelOf(it)} ${it.getAttribute('data-value') || ''} ${it.getAttribute('data-keywords') || ''}`);
  const disabled = (i) => items[i].getAttribute('aria-disabled') === 'true';
  const cache = new Map();
  const visibleFor = (q) => {
    if (!cache.has(q)) cache.set(q, items.map((_, i) => matches(text[i], q)));
    return cache.get(q);
  };

  let rowH = 36;
  let emptyH = 54;
  let measured = false;
  function tryMeasure() {
    const r = items[0] ? items[0].getBoundingClientRect() : { height: 0 };
    if (!r.height) return false;
    rowH = r.height;
    const er = empty.getBoundingClientRect();
    emptyH = o.emptyHeight ?? Math.max(er.height, rowH * 1.5);
    measured = true;
    return true;
  }
  tryMeasure();
  const heightFor = (n) => pad * 2 + (n ? n * rowH : emptyH);
  const slotY = (rank) => pad + rank * rowH;
  const firstUsable = (vis) => items.findIndex((_, i) => vis[i] && !disabled(i));

  const query = steps(input.value || '');
  const vis0 = visibleFor(query.initial);
  const rank0 = [];
  { let r = 0; for (let i = 0; i < items.length; i++) rank0.push(vis0[i] ? r++ : -1); }
  const count0 = vis0.filter(Boolean).length;
  const rows = items.map((_, i) => ({
    y: track(slotY(Math.max(0, rank0[i])), PRESETS.snappy),
    pres: presence(vis0[i], ROW_MOTION),
  }));
  const height = track(heightFor(count0), PRESETS.snappy);
  const emptyP = presence(count0 === 0, ROW_MOTION);
  const act = steps(firstUsable(vis0));
  const a0 = act.initial;
  const ind = indicator(slotY(Math.max(0, rank0[a0] ?? 0)), slotY(Math.max(0, rank0[a0] ?? 0)) + rowH, spring(0.26, 0.9), spring(0.42, 0.95));
  const ho = track(a0 >= 0 ? 1 : 0, PRESETS.snappy);
  const press = track(0, PRESETS.press);

  let endT = -Infinity;
  const mark = (t) => { if (t > endT) endT = t; };
  const all = () => [height, ho, press, emptyP.p, ind.l, ind.r, ...rows.flatMap((r) => [r.y, r.pres.p])];
  const settledAll = (t) => all().every((tr) => tr.settled(t));

  /** Where row i sits (and its rank among the shown rows) for a query. */
  const layoutFor = (q) => {
    const vis = visibleFor(q);
    const rank = [];
    let r = 0;
    for (let i = 0; i < items.length; i++) rank.push(vis[i] ? r++ : -1);
    return { vis, rank, count: r };
  };

  function paint(t, { reduced }) {
    const q = query.at(t);
    const { vis, count } = layoutFor(q);
    const a = act.at(t);
    if (input.value !== q) input.value = q;
    items.forEach((it, i) => {
      attr(it, 'aria-hidden', vis[i] ? null : 'true');
      attr(it, 'aria-selected', i === a ? 'true' : 'false');
      attr(it, 'data-selected', i === a ? true : null);
      const r = rows[i];
      applyAt(it, reduced ? (vis[i] ? SHOWN : GONE) : r.pres.at(t), reduced ? r.y.target(t) : r.y.at(t));
    });
    attr(input, 'aria-activedescendant', a >= 0 ? items[a].id : null);
    list.style.height = px(reduced ? height.target(t) : height.at(t));
    applyAt(empty, reduced ? (count ? GONE : SHOWN) : emptyP.at(t), pad);
    const e = reduced ? ind.target(t) : ind.at(t);
    const op = reduced ? ho.target(t) : clamp01(ho.at(t));
    const squeeze = reduced ? 0 : clamp01(press.at(t)) * 0.02;
    bar.style.opacity = num(op);
    bar.style.visibility = op > 0.002 ? '' : 'hidden';
    bar.style.transform = `translateY(${px(e.left)}) scaleX(${num(1 - squeeze)})`;
    bar.style.height = px(Math.max(0, e.right - e.left));
    const msg = !q.trim() ? '' : count === 0 ? 'No results.' : count === 1 ? '1 result' : `${count} results`;
    if (status.textContent !== msg) status.textContent = msg;
  }

  function draw(t, s) {
    paint(t, s);
    if (!api.keep && t >= endT && (query.ev.length || act.ev.length) && settledAll(t)) {
      for (const tr of all()) tr.compact(t);
      for (const r of rows) r.pres.marks = [];
      emptyP.marks = [];
      query.compact();
      act.compact();
    }
  }

  const d = driver(draw, { clock: o.clock, reduced: o.reduced });
  d.busy = (t) => t < endT || !settledAll(t);
  const commit = () => { paint(d.now(), { reduced: d.reduced }); d.kick(); };
  const when = (opt) => (opt && opt.t !== undefined ? { t: opt.t, live: false } : { t: d.now(), live: true });

  /** Moves the highlight to row i (-1 hides it) at time t. */
  function setActive(t, i, rank) {
    const prev = act.last;
    if (i === prev && i >= 0) {
      // the row may have moved in the list: follow it
      const y = slotY(rank[i]);
      if (Math.abs(ind.target(t).left - y) > 0.01) ind.to(t, y, y + rowH);
      return;
    }
    act.set(t, i);
    if (i < 0) { ho.to(t, 0, PRESETS.exit); return; }
    const y = slotY(rank[i]);
    if (prev < 0 && ho.target(t) === 0) {
      // appearing again: jump to the row, then fade in
      ind.l.to(t, y, JUMP);
      ind.r.to(t, y + rowH, JUMP);
      ind.last = [y, y + rowH];
      ho.to(t, 1, PRESETS.snappy);
    } else {
      ind.to(t, y, y + rowH);
      ho.to(t, 1, PRESETS.snappy);
    }
  }

  /** Filters the list for q. Live when opt.t is missing (from the input event). */
  function search(q, opt = {}) {
    const { t } = when(opt);
    if (!measured && tryMeasure() && !query.ev.length) {
      const L = layoutFor(query.last);
      rows.forEach((r, i) => { r.y = track(slotY(Math.max(0, L.rank[i])), PRESETS.snappy); });
      height.initial = heightFor(L.count);
    }
    const before = layoutFor(query.last);
    if (q === query.last) return api;
    const after = layoutFor(q);
    query.set(t, q);
    let entering = 0;
    items.forEach((_, i) => {
      const r = rows[i];
      const was = before.vis[i];
      const now = after.vis[i];
      const y = slotY(Math.max(0, after.rank[i]));
      if (now && !was) {
        // an invisible row takes its new place at once, then enters there
        const shown = r.pres.p.at(t) > 0.002;
        r.y.to(t, y, shown ? PRESETS.snappy : JUMP);
        r.pres.enter(t + 0.04 + entering * ROW_STEP);
        mark(t + 0.04 + entering * ROW_STEP);
        entering++;
      } else if (now && Math.abs(r.y.target(t) - y) > 0.01) {
        r.y.to(t, y, PRESETS.snappy);
      } else if (!now && was) {
        r.pres.exit(t);
      }
    });
    height.to(t, heightFor(after.count), PRESETS.snappy);
    if (after.count === 0 && before.count > 0) emptyP.enter(t + 0.06);
    if (after.count > 0 && before.count === 0) emptyP.exit(t);
    setActive(t, firstUsable(after.vis), after.rank);
    mark(t + 0.06);
    commit();
    return api;
  }

  /** Chooses row i (it must be shown and enabled). */
  function highlight(i, opt = {}) {
    const { t } = when(opt);
    const L = layoutFor(query.last);
    if (i < 0 || i >= items.length || !L.vis[i] || disabled(i) || i === act.last) return api;
    setActive(t, i, L.rank);
    mark(t);
    commit();
    if (opt.t === undefined) reveal(i, L.rank);
    return api;
  }

  /** Down (dir 1) or Up (dir -1) among the shown, enabled rows. */
  function move(dir, opt = {}) {
    const L = layoutFor(query.last);
    const usable = items.map((_, i) => i).filter((i) => L.vis[i] && !disabled(i));
    if (!usable.length) return api;
    const cur = usable.indexOf(act.last);
    let next;
    if (cur < 0) next = dir > 0 ? 0 : usable.length - 1;
    else if (loop) next = (cur + dir + usable.length) % usable.length;
    else next = Math.min(usable.length - 1, Math.max(0, cur + dir));
    return highlight(usable[next], opt);
  }

  /** Picks row i (default: the chosen row): the highlight gives a short press, onSelect runs. */
  function select(i = act.last, opt = {}) {
    const { t, live } = when(opt);
    const L = layoutFor(query.last);
    if (i < 0 || i >= items.length || !L.vis[i] || disabled(i)) return api;
    if (i !== act.last) setActive(t, i, L.rank);
    press.to(t, 1, PRESETS.press);
    press.to(t + 0.1, 0, PRESETS.release);
    mark(t + 0.1);
    commit();
    if (live && o.onSelect) o.onSelect(items[i].getAttribute('data-value') || labelOf(items[i]), items[i]);
    return api;
  }

  /** Keeps the chosen row inside a scrolled list (live only). */
  function reveal(i, rank) {
    const view = list.clientHeight;
    if (typeof view !== 'number' || !(list.scrollHeight > view)) return;
    const y = slotY(rank[i]);
    if (y < list.scrollTop) list.scrollTop = y - pad;
    else if (y + rowH > list.scrollTop + view) list.scrollTop = y + rowH + pad - view;
  }

  /** Re-measure the row height (after a font or size change); rows jump to their places. */
  function measure() {
    measured = false;
    if (!tryMeasure()) return api;
    const t = d.now();
    const L = layoutFor(query.last);
    rows.forEach((r, i) => { if (L.vis[i]) r.y.to(t, slotY(L.rank[i]), JUMP); });
    height.to(t, heightFor(L.count), JUMP);
    if (act.last >= 0) { const y = slotY(L.rank[act.last]); ind.l.to(t, y, JUMP); ind.r.to(t, y + rowH, JUMP); ind.last = [y, y + rowH]; }
    commit();
    return api;
  }

  // ---------------------------------------------------------------- live input
  const listeners = [];
  const on = (target, type, fn) => { target.addEventListener(type, fn); listeners.push([target, type, fn]); };

  on(input, 'input', () => search(input.value));
  on(input, 'keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); select(); }
    else if (e.key === 'Escape' && query.last) {
      e.preventDefault();
      e.stopPropagation();
      search('');
    }
  });
  items.forEach((it, i) => {
    on(it, 'pointermove', () => { if (i !== act.last) highlight(i); });
    // keep focus in the input when a row is pressed
    on(it, 'pointerdown', (e) => e.preventDefault());
    on(it, 'click', () => select(i));
  });
  const key = o.shortcut === false ? null : (o.shortcut || 'k').toLowerCase();
  if (key) {
    on(doc, 'keydown', (e) => {
      if (!(e.ctrlKey || e.metaKey) || !e.key || e.key.toLowerCase() !== key) return;
      e.preventDefault();
      input.focus();
      if (input.select) input.select();
    });
  }

  const api = {
    root,
    input,
    list,
    items,
    driver: d,
    keep: false,
    search,
    move,
    highlight,
    select,
    measure,
    query: (t) => (t === undefined ? query.last : query.at(t)),
    active: (t) => (t === undefined ? act.last : act.at(t)),
    visible: (t) => layoutFor(t === undefined ? query.last : query.at(t)).vis.map((v, i) => (v ? i : -1)).filter((i) => i >= 0),
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
