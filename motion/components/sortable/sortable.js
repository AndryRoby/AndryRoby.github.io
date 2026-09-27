/*
 * ARLing Motion: Sortable.
 * A list you reorder by dragging a handle with a mouse, a pen or a finger, or with the keyboard,
 * like the Reorder of Framer Motion and the sortable list of dnd-kit. The item you drag follows
 * the pointer one to one and lifts a little (scale and shadow). The other items make room on a
 * spring as it passes their middle: each item stays laid out where the DOM puts it, and a
 * transform carries it from where it was to where it belongs (FLIP). When you let go, the item
 * lands in its place on a spring that starts with the speed of your hand. Every position is a
 * pure function of time, so seek(t) paints any moment of a scheduled drag, and the DOM order
 * changes once, when the item is dropped.
 *
 * Markup:
 *   <div class="am-sortable">
 *     <ul class="am-sortable-list" aria-label="Today, in order">
 *       <li data-value="reply"><span class="am-sortable-label">Reply to customers</span></li>
 *       <li data-value="invoices"><span class="am-sortable-label">Send invoices</span></li>
 *     </ul>
 *   </div>
 * The component adds what is missing: a handle per item (a button with a grip icon, named
 * "Move <label>"), the instructions every handle points to (aria-describedby) and an assertive
 * live region for the announcements. One column; items may differ in height.
 *
 * Keyboard (as in the sortable list of dnd-kit): every handle is a button in the tab order.
 * Space or Enter picks the item up, Up and Down move it, Space or Enter drops it, Escape puts it
 * back where it was (Escape also cancels a pointer drag), and moving focus away cancels too. The
 * live region says "Picked up Send invoices, position 2 of 4", "Moved to 3 of 4", "Dropped Send
 * invoices, position 3 of 4" or "Cancelled. Send invoices is back at position 2 of 4". While an
 * item is held its handle has aria-pressed="true". A drop never moves the element that has focus
 * (a real browser would drop the focus): the other items are moved around it.
 * Pointer: pointer events with pointer capture on the handle. Only the handle has
 * touch-action: none, so a finger on the rest of the list still scrolls the page. Dragging is
 * never the only way (WCAG 2.5.7): the keyboard works, and set(order) lets you add Move up and
 * Move down buttons. With prefers-reduced-motion the other items and the drop jump to their
 * places; the held item still follows the pointer.
 * MIT licence.
 */
import { track, driver, steps, attr, spring, PRESETS } from '../../src/core.js';

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const round2 = (v) => Math.round(v * 100) / 100;
const px = (v) => `${round2(v)}px`;
const n4 = (v) => String(Math.round(v * 1e4) / 1e4);
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const SVG = 'http://www.w3.org/2000/svg';

let uid = 0;
const ensureId = (el, prefix) => el.id || (el.id = `${prefix}-${++uid}`);

/** The other items make room on this spring (overshoot under 1 %). */
export const SHIFT = PRESETS.snappy;
/** The dropped item lands on this spring, from where it was let go and with its speed. */
export const DROP = spring(0.36, 0.86);
/** Scale of an item while it is held. */
export const LIFT_SCALE = 1.02;
/** How far an item may be pulled past either end of the list, px (it approaches this). */
export const RUBBER = 24;
/** Samples per second of a scheduled drag (demos and video). */
export const DRAG_RATE = 120;
/** Easing of a scheduled pointer path, with its slope (for the speed at the release). */
export const EASE = {
  linear: [(u) => u, () => 1],
  in: [(u) => u * u, (u) => 2 * u],
  out: [(u) => 1 - (1 - u) * (1 - u), (u) => 2 * (1 - u)],
  inOut: [(u) => u * u * (3 - 2 * u), (u) => 6 * u * (1 - u)],
};
/** What the live region says. Each message gets the item's label, its position and the count. */
export const MESSAGES = {
  pickedUp: (label, position, count) => `Picked up ${label}, position ${position} of ${count}`,
  moved: (label, position, count) => `Moved to ${position} of ${count}`,
  dropped: (label, position, count) => `Dropped ${label}, position ${position} of ${count}`,
  cancelled: (label, position, count) => `Cancelled. ${label} is back at position ${position} of ${count}`,
};
/** The instructions every handle points to with aria-describedby. */
export const INSTRUCTIONS = 'To move an item, press Space or Enter on its handle, then use the Up and Down arrow keys. Press Space or Enter to drop it, or Escape to cancel.';

// a row when the list has no layout yet (hidden, or not in a page); measure() corrects it
const EST = { h: 44, gap: 8, hx: 22, hy: 22 };

/** The order with item k moved to position j. */
export function moveTo(order, k, j) {
  const out = order.filter((x) => x !== k);
  out.splice(Math.max(0, Math.min(out.length, j)), 0, k);
  return out;
}

/**
 * A recorded pointer path as a pure function of time: samples [[t, offset]] in time order,
 * linear between samples. The last 2 ms run at the release speed v, so the track that takes
 * over measures exactly v (the same idea as the drawer).
 */
function pathFn(samples, v) {
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

/** Pointer speed over the last 0.1 s of samples, px per second. */
function releaseVelocity(samples, window = 0.1) {
  if (samples.length < 2) return 0;
  const [t1, end] = samples[samples.length - 1];
  let j = samples.length - 2;
  while (j > 0 && t1 - samples[j][0] < window) j--;
  const [t0, start] = samples[j];
  return t1 > t0 ? (end - start) / (t1 - t0) : 0;
}

/**
 * createSortable({ root, list, onReorder, moveNodes, messages, instructions, clock, reduced })
 * onReorder(values) runs when a drop by the user changes the order, with the data-value of every
 * item (or its label) in the new order. moveNodes (default true) lets the component reorder the
 * DOM at the drop; pass false when a framework owns the items (React), then reorder them in
 * onReorder and call sync() after the render. drag(item, dy, { t, duration, ease }) and
 * key(name, { t, item }) schedule input for demos; set(order, { t }) reorders with the same
 * springs and calls nothing. An item is its data-value, its element, or its index in the markup.
 * Returns { set, sync, drag, key, order, held, offsetOf, travel, measure, seek, settled, destroy,
 * driver, count, root, list, items, handles, status, keep }.
 */
export function createSortable(o) {
  const root = o.root;
  const doc = root.ownerDocument || document;
  const moveNodes = o.moveNodes !== false;
  root.classList.add('am-sortable');
  const list = o.list || root.querySelector('.am-sortable-list, ul, ol');
  if (!list) throw new Error('createSortable: root needs a list (ul or ol) inside it');
  list.classList.add('am-sortable-list');
  const isItem = (el) => !!el && !!el.tagName && (el.tagName === 'LI' || el.classList.contains('am-sortable-item'));
  const items = [...list.children].filter(isItem);
  if (!items.length) throw new Error('createSortable: the list has no items (li)');
  const n = items.length;
  const messages = { ...MESSAGES, ...(o.messages || {}) };

  // ---------------------------------------------------------------- parts
  const make = (tag, cls, parent) => {
    const el = doc.createElement(tag);
    el.className = cls;
    parent.appendChild(el);
    return el;
  };
  const firstOf = (el) => ('firstChild' in el ? el.firstChild : el.firstElementChild);
  const help = root.querySelector('.am-sortable-help') || make('span', 'am-sortable-help', root);
  if (!help.textContent.trim()) help.textContent = o.instructions || INSTRUCTIONS;
  ensureId(help, 'am-sortable-help');
  const status = root.querySelector('.am-sortable-status') || make('span', 'am-sortable-status', root);
  attr(status, 'aria-live', 'assertive');
  attr(status, 'aria-atomic', 'true');

  const labels = items.map((li) => {
    const own = li.getAttribute('data-label');
    if (own) return own;
    const lab = li.querySelector('.am-sortable-label');
    return (lab || li).textContent.trim().replace(/\s+/g, ' ');
  });
  const values = items.map((li, k) => li.getAttribute('data-value') || labels[k]);

  function grip() {
    const s = doc.createElementNS(SVG, 'svg');
    for (const [k, v] of Object.entries({ viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': 'true', focusable: 'false' })) s.setAttribute(k, v);
    for (const cy of [6, 12, 18]) {
      for (const cx of [9, 15]) {
        const c = doc.createElementNS(SVG, 'circle');
        c.setAttribute('cx', String(cx));
        c.setAttribute('cy', String(cy));
        c.setAttribute('r', '1.6');
        s.appendChild(c);
      }
    }
    return s;
  }

  const handles = items.map((li, k) => {
    li.classList.add('am-sortable-item');
    let hd = li.querySelector('.am-sortable-handle');
    if (!hd) {
      hd = doc.createElement('button');
      hd.className = 'am-sortable-handle';
      li.insertBefore(hd, firstOf(li));
    }
    if (hd.tagName === 'BUTTON') {
      if (!hd.hasAttribute('type')) attr(hd, 'type', 'button');
    } else {
      attr(hd, 'role', 'button');
      if (!hd.hasAttribute('tabindex')) attr(hd, 'tabindex', '0');
    }
    if (!hd.hasAttribute('aria-label') && !hd.hasAttribute('aria-labelledby')) attr(hd, 'aria-label', `Move ${labels[k]}`);
    const described = (hd.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
    if (!described.includes(help.id)) attr(hd, 'aria-describedby', [...described, help.id].join(' '));
    if (!hd.querySelector('svg')) hd.appendChild(grip());
    return hd;
  });

  // ---------------------------------------------------------------- geometry, measured on create and on resize
  const domOrder = () => [...list.children].filter(isItem).map((el) => items.indexOf(el)).filter((k) => k >= 0);

  /** Layout boxes in list pixels, without our transforms (heights, the gap, the handle's centre). */
  function measureGeo() {
    const saved = items.map((li) => li.style.transform);
    for (const li of items) li.style.transform = 'none';
    const lr = list.getBoundingClientRect();
    const dom = domOrder();
    const r = items.map((li) => li.getBoundingClientRect());
    const hr = handles.map((hd) => hd.getBoundingClientRect());
    items.forEach((li, k) => { li.style.transform = saved[k]; });
    const layoutH = list.offsetHeight || lr.height || 0;
    // k: screen pixels per layout pixel, for a list inside a scaled parent
    const k = layoutH > 0 && lr.height > 0 ? lr.height / layoutH : 1;
    const ok = dom.length > 0 && r.some((b) => b.height > 0);
    const h = r.map((b) => (ok ? b.height / k : EST.h));
    const gap = ok ? (dom.length > 1 ? Math.max(0, (r[dom[1]].top - r[dom[0]].bottom) / k) : 0) : EST.gap;
    const base = ok ? (r[dom[0]].top - lr.top) / k : 0;
    const sum = h.reduce((a, b) => a + b, 0) + gap * (n - 1);
    return {
      k,
      h,
      gap,
      base,
      w: ok ? lr.width / k : 0,
      listH: ok ? lr.height / k : base + sum,
      left: r.map((b) => (ok ? (b.left - lr.left) / k : 0)),
      hand: hr.map((b, i) => (ok && b.height > 0
        ? { x: (b.left + b.width / 2 - r[i].left) / k, y: (b.top + b.height / 2 - r[i].top) / k }
        : { x: EST.hx, y: EST.hy })),
      sum,
    };
  }
  const sameGeo = (a, b) => Math.abs(a.gap - b.gap) < 0.5 && Math.abs(a.base - b.base) < 0.5 && a.h.every((x, i) => Math.abs(x - b.h[i]) < 0.5);
  let geo = measureGeo();

  /** Top of every item (by item) when the list is in this order, px from the list's top edge. */
  function tops(order) {
    const out = new Array(n);
    let top = geo.base;
    for (const k of order) {
      out[k] = top;
      top += geo.h[k] + geo.gap;
    }
    return out;
  }

  /** Past either end of the list an item resists: it approaches RUBBER px. */
  function shapeY(k, Y) {
    const lo = geo.base;
    const hi = geo.base + geo.sum - geo.h[k];
    const rubber = (over) => RUBBER * (1 - 1 / (1 + over / RUBBER));
    if (Y < lo) return lo - rubber(lo - Y);
    if (Y > hi) return hi + rubber(Y - hi);
    return Y;
  }

  /** The position item k belongs at when its top is at Y: the nearest place among the others. */
  function slotFor(k, Y, order) {
    const others = order.filter((x) => x !== k);
    let best = 0;
    let bestD = Infinity;
    let top = geo.base;
    for (let j = 0; j <= others.length; j++) {
      const dd = Math.abs(Y - top);
      if (dd < bestD) { best = j; bestD = dd; }
      if (j < others.length) top += geo.h[others[j]] + geo.gap;
    }
    return best;
  }

  // ---------------------------------------------------------------- state as functions of time
  const order0 = domOrder();
  const committed = steps(order0); // the order of the DOM
  const held = steps(-1); // the item held now, -1 when none
  const front = steps(-1); // the item held last, drawn above the others until it has landed
  let draft = order0.slice(); // where the items are heading (the order of the last change)
  let by = null; // how the held item was taken: 'keyboard' or 'pointer'
  let origin = null; // the order when it was taken, for Escape
  const T0 = tops(order0);
  let y = items.map((_, k) => track(T0[k], SHIFT)); // each item's top, px
  const lift = items.map(() => track(0, PRESETS.press));
  let live = null; // a pointer that holds an item: { k, id, t0, grab, start, samples }
  let keepFocus = null;
  let endT = -Infinity;
  const mark = (t) => { if (t > endT) endT = t; };
  const settledAll = (t) => y.every((tr) => tr.settled(t)) && lift.every((tr) => tr.settled(t));

  const liveTop = () => shapeY(live.k, live.grab + live.samples[live.samples.length - 1][1]);

  /**
   * Puts the items of the DOM in order. The item that has focus or is held stays where it is and
   * the others move around it: a real browser drops focus and pointer capture from a moved node.
   */
  function arrange(ord) {
    const cur = domOrder();
    if (same(cur, ord)) return;
    const active = doc.activeElement;
    let a = live ? live.k : items.findIndex((li) => !!active && li.contains(active));
    if (a < 0 || !ord.includes(a)) a = ord[0];
    const anchor = items[a];
    const at = ord.indexOf(a);
    const kids = () => [...list.children];
    const nextOf = (el) => { const c = kids(); return c[c.indexOf(el) + 1] || null; };
    for (let i = 0; i < at; i++) list.insertBefore(items[ord[i]], anchor);
    let ref = anchor;
    for (let i = at + 1; i < ord.length; i++) {
      const el = items[ord[i]];
      const next = nextOf(ref);
      if (next !== el) list.insertBefore(el, next);
      ref = el;
    }
  }

  function paint(t, { reduced }) {
    const ord = committed.at(t);
    if (moveNodes) arrange(ord);
    const lay = tops(moveNodes ? ord : domOrder());
    const h = held.at(t);
    const f = front.at(t);
    items.forEach((li, k) => {
      const v = live && live.k === k && t >= live.t0 ? liveTop() : reduced ? y[k].target(t) : y[k].at(t);
      const p = reduced ? lift[k].target(t) : clamp01(lift[k].at(t));
      const s = 1 + (LIFT_SCALE - 1) * p;
      const from = lay[k] === undefined ? v : lay[k];
      li.style.transform = `translateY(${px(v - from)})${Math.abs(s - 1) > 1e-4 ? ` scale(${n4(s)})` : ''}`;
      li.style.setProperty('--am-sortable-lift', n4(p));
      const up = k === f && (k === h || !lift[k].settled(t) || !y[k].settled(t));
      li.style.zIndex = up ? '1' : '';
      attr(li, 'data-state', k === h ? 'dragging' : 'idle');
      attr(handles[k], 'aria-pressed', String(k === h));
    });
    attr(root, 'data-state', h >= 0 ? 'dragging' : 'idle');
  }

  function draw(t, st) {
    paint(t, st);
    if (!api.keep && !live && held.last < 0 && t >= endT && settledAll(t)) {
      for (const tr of [...y, ...lift]) tr.compact(t);
      committed.compact();
      held.compact();
      front.compact();
    }
  }

  const d = driver(draw, { clock: o.clock, reduced: o.reduced });
  d.busy = (t) => !!live || t < endT || !settledAll(t);
  const commit = () => { paint(d.now(), { reduced: d.reduced }); d.kick(); };
  const when = (opt) => (opt && opt.t !== undefined ? { t: opt.t, live: false } : { t: d.now(), live: true });

  // ---------------------------------------------------------------- changes (in time order)
  /** Every item but skip glides from where it is to its place in order. */
  function aimAll(order, t, skip = -1) {
    const T = tops(order);
    items.forEach((_, k) => {
      if (k === skip || Math.abs(y[k].target(Infinity) - T[k]) < 0.01) return;
      y[k].to(t, T[k], SHIFT);
    });
    draft = order.slice();
    mark(t);
  }

  function take(k, t, how) {
    origin = committed.last.slice();
    draft = origin.slice();
    held.set(t, k);
    front.set(t, k);
    lift[k].to(t, 1, PRESETS.press);
    by = how;
    mark(t);
  }

  /** The held item is put down with the list in order: it lands on DROP, its lift springs back. */
  function put(order, t) {
    const k = held.last;
    if (k < 0) return;
    held.set(t, -1);
    lift[k].to(t, 0, PRESETS.release);
    const T = tops(order);
    if (Math.abs(y[k].target(Infinity) - T[k]) >= 0.01) y[k].to(t, T[k], DROP);
    aimAll(order, t, k);
    if (!same(order, committed.last)) committed.set(t, order.slice());
    by = null;
    origin = null;
  }

  /** The held item one place up (-1) or down (1). */
  function stepBy(delta, t) {
    const k = held.last;
    const i = draft.indexOf(k);
    const j = Math.max(0, Math.min(n - 1, i + delta));
    if (j === i) return false;
    aimAll(moveTo(draft, k, j), t);
    return true;
  }

  function say(text) {
    status.textContent = status.textContent === text ? `${text} ` : text;
  }

  /** After a drop by the user: the announcement and onReorder. */
  function report(k, before, cancelled) {
    const pos = committed.last.indexOf(k) + 1;
    say(cancelled ? messages.cancelled(labels[k], pos, n) : messages.dropped(labels[k], pos, n));
    if (!moveNodes && doc.activeElement === handles[k]) keepFocus = handles[k];
    if (!cancelled && !same(before, committed.last) && o.onReorder) o.onReorder(committed.last.map((i) => values[i]));
  }

  /** Ends a keyboard hold: drops the item, or puts it back where it was. */
  function endHold(t, cancelled, now) {
    const k = held.last;
    const before = committed.last;
    put(cancelled ? origin : draft, t);
    commit();
    if (now) report(k, before, cancelled);
  }

  /** Ends a pointer hold: the recorded path goes into the item's track, then it lands. */
  function endLive(t, cancelled, now) {
    const { k, t0, samples, id } = live;
    const hd = handles[k];
    live = null;
    if (hd.releasePointerCapture && id !== undefined) {
      try { hd.releasePointerCapture(id); } catch { /* already released */ }
    }
    const t1 = Math.max(t, t0 + 1e-3);
    samples.push([t1, samples[samples.length - 1][1]]);
    const v = releaseVelocity(samples);
    const path = pathFn(samples, v);
    y[k].drag(t0, t1, (tt, grab) => shapeY(k, grab + path(tt)), DROP);
    const before = committed.last;
    put(cancelled ? origin : draft, t1);
    commit();
    if (now) report(k, before, cancelled);
  }

  function applyKey(name, k, t, now) {
    const h = held.last;
    if (name === ' ' || name === 'Enter' || name === 'Spacebar') {
      if (h < 0) {
        take(k, t, 'keyboard');
        commit();
        if (now) say(messages.pickedUp(labels[k], draft.indexOf(k) + 1, n));
      } else if (h === k && by === 'keyboard') endHold(t, false, now);
      return true;
    }
    if (name === 'ArrowUp' || name === 'ArrowDown') {
      if (h !== k || by !== 'keyboard') return false;
      if (stepBy(name === 'ArrowUp' ? -1 : 1, t)) {
        commit();
        if (now) say(messages.moved(labels[k], draft.indexOf(k) + 1, n));
      }
      return true;
    }
    if (name === 'Escape') {
      if (h !== k) return false;
      if (live) endLive(t, true, now);
      else endHold(t, true, now);
      return true;
    }
    return false;
  }

  const idOf = (x) => {
    if (typeof x === 'number') return Number.isInteger(x) && x >= 0 && x < n ? x : -1;
    if (x && x.tagName) return items.indexOf(x.closest ? x.closest('.am-sortable-item') || x : x);
    return values.indexOf(String(x));
  };
  const focusedItem = () => items.findIndex((li) => !!doc.activeElement && li.contains(doc.activeElement));

  /** Puts down whatever is held: a pointer drag or a keyboard hold goes back where it was. */
  function release(t) {
    if (live) endLive(t, true, false);
    else if (held.last >= 0) put(origin, t);
  }

  /** A key on a handle (' ', 'Enter', 'ArrowUp', 'ArrowDown', 'Escape'). opt: { t, item }. */
  function key(name, opt = {}) {
    const { t, live: now } = when(opt);
    const k = opt.item !== undefined ? idOf(opt.item) : held.last >= 0 ? held.last : focusedItem();
    if (k >= 0) applyKey(name, k, t, now);
    return api;
  }

  /**
   * Scheduled drag for demos: the pointer takes item's handle at t and moves it dy px (layout
   * pixels, negative is up) over duration seconds; the others make room as it passes, and it
   * lands on the place nearest to where it was let go.
   */
  function drag(item, dy, opt = {}) {
    const k = idOf(item);
    if (k < 0) return api;
    const t0 = opt.t ?? d.now();
    release(t0);
    const dur = Math.max(1 / DRAG_RATE, opt.duration ?? 0.5);
    const [ease] = EASE[opt.ease] || EASE.inOut;
    const t1 = t0 + dur;
    const off = (t) => dy * ease(clamp01((t - t0) / dur));
    const grab = y[k].at(t0);
    take(k, t0, 'pointer');
    const count = Math.max(1, Math.ceil(dur * DRAG_RATE));
    for (let i = 1; i <= count; i++) {
      const ts = t0 + (dur * i) / count;
      const j = slotFor(k, shapeY(k, grab + off(ts)), draft);
      if (j !== draft.indexOf(k)) aimAll(moveTo(draft, k, j), ts, k);
    }
    y[k].drag(t0, t1, (t, g) => shapeY(k, g + off(t)), DROP);
    put(draft, t1);
    mark(t1);
    commit();
    return api;
  }

  /** The order of every item (values, elements or indices), reordered on the springs. No callbacks. opt: { t }. */
  function set(order, opt = {}) {
    const { t } = when(opt);
    release(t);
    const next = [];
    for (const x of order || []) {
      const k = idOf(x);
      if (k >= 0 && !next.includes(k)) next.push(k);
    }
    for (const k of committed.last) if (!next.includes(k)) next.push(k);
    if (!same(next, committed.last)) {
      aimAll(next, t);
      committed.set(t, next);
    }
    commit();
    return api;
  }

  /**
   * Takes the DOM order as it is now (after a framework reordered the items, or you did): items
   * glide from where they are to where the DOM put them. After a drop by keyboard it gives focus
   * back to the handle, which a framework may have taken away by moving it.
   */
  function sync() {
    const dom = domOrder();
    if (dom.length === n && !same(dom, committed.last)) {
      const t = d.now();
      release(t);
      aimAll(dom, t);
      committed.set(t, dom);
    }
    // always: the rows are laid out anew, so every transform is measured from the new place
    commit();
    const hd = keepFocus;
    keepFocus = null;
    if (hd && list.contains(hd) && (!doc.activeElement || doc.activeElement === doc.body)) {
      try { hd.focus({ preventScroll: true }); } catch { /* not focusable now */ }
    }
    return api;
  }

  /** Measure again after a layout change. Live and at rest, every item takes its new place at once. */
  function measure() {
    const g = measureGeo();
    if (sameGeo(g, geo)) {
      // the same rows: keep the numbers the tracks were planned with, take the new width
      geo = { ...g, h: geo.h, gap: geo.gap, base: geo.base, sum: geo.sum };
      return api;
    }
    geo = g;
    if (!api.keep && !live && held.last < 0) {
      const T = tops(committed.last);
      y = items.map((_, k) => track(T[k], SHIFT));
    }
    commit();
    return api;
  }

  // ---------------------------------------------------------------- live input
  const listeners = [];
  const on = (el, type, fn) => { el.addEventListener(type, fn); listeners.push([el, type, fn]); };
  const handleOf = (e) => (e.target && e.target.closest ? e.target.closest('.am-sortable-handle') : null);
  const listTop = () => list.getBoundingClientRect().top;

  on(list, 'pointerdown', (e) => {
    const k = handles.indexOf(handleOf(e));
    if (k < 0 || live || (e.button !== undefined && e.button !== 0)) return;
    e.preventDefault(); // no text selection, and no mouse down that would move focus elsewhere
    const t = d.now();
    if (held.last >= 0) endHold(t, true, true); // a keyboard hold goes back first
    const hd = handles[k];
    live = { k, id: e.pointerId, t0: t, grab: d.reduced ? y[k].target(t) : y[k].at(t), start: e.clientY - listTop(), samples: [[t, 0]] };
    try { hd.focus({ preventScroll: true }); } catch { /* not focusable */ }
    if (hd.setPointerCapture && e.pointerId !== undefined) {
      try { hd.setPointerCapture(e.pointerId); } catch { /* not captured */ }
    }
    take(k, t, 'pointer');
    commit();
    say(messages.pickedUp(labels[k], draft.indexOf(k) + 1, n));
  });
  const mine = (e) => live && (live.id === undefined || e.pointerId === undefined || e.pointerId === live.id);
  on(list, 'pointermove', (e) => {
    if (!mine(e)) return;
    const t = d.now();
    live.samples.push([t, (e.clientY - listTop() - live.start) / geo.k]);
    const k = live.k;
    const j = slotFor(k, liveTop(), draft);
    const moved = j !== draft.indexOf(k);
    if (moved) aimAll(moveTo(draft, k, j), t, k);
    commit();
    if (moved) say(messages.moved(labels[k], j + 1, n));
  });
  const finish = (cancelled) => (e) => {
    if (!mine(e)) return;
    endLive(d.now(), cancelled, true);
  };
  on(list, 'pointerup', finish(false));
  on(list, 'pointercancel', finish(true));
  on(list, 'lostpointercapture', finish(false));
  on(list, 'keydown', (e) => {
    const k = handles.indexOf(handleOf(e));
    if (k < 0 || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.repeat && (e.key === ' ' || e.key === 'Enter')) {
      e.preventDefault();
      return;
    }
    if (applyKey(e.key, k, d.now(), true)) {
      e.preventDefault();
      if (e.key === 'Escape') e.stopPropagation(); // not a surrounding dialog's Escape
    }
  });
  // focus that leaves the held handle puts the item back
  on(list, 'focusout', (e) => {
    const k = held.last;
    if (k < 0 || by !== 'keyboard' || e.target !== handles[k] || e.relatedTarget === handles[k]) return;
    endHold(d.now(), true, true);
  });

  let ro = null;
  if (typeof ResizeObserver === 'function') {
    ro = new ResizeObserver(() => measure());
    ro.observe(list);
  }

  const api = {
    root,
    list,
    items,
    handles,
    status,
    driver: d,
    keep: false,
    count: n,
    set,
    sync,
    drag,
    key,
    measure,
    /** The values in order now, or at time t of a scheduled timeline. */
    order: (t) => (t === undefined ? committed.last : committed.at(t)).map((k) => values[k]),
    /** The value of the item held now (or at time t), or null. */
    held: (t) => {
      const k = t === undefined ? held.last : held.at(t);
      return k < 0 ? null : values[k];
    },
    /** Where item's handle is, from the centre of the list, when the item rests where it is heading, moved by dy px. */
    offsetOf(item, dy = 0) {
      const k = idOf(item);
      if (k < 0) return { dx: 0, dy: 0 };
      const top = y[k].target(Infinity) + dy;
      return { dx: round2(geo.left[k] + geo.hand[k].x - geo.w / 2), dy: round2(top + geo.hand[k].y - geo.listH / 2) };
    },
    /** Pixels from where item is heading to its top at position index (0 is first). */
    travel(item, index) {
      const k = idOf(item);
      if (k < 0) return 0;
      return round2(tops(moveTo(draft, k, index))[k] - y[k].target(Infinity));
    },
    seek: (t) => paint(t, { reduced: d.reduced }),
    settled: (t) => !live && t >= endT && settledAll(t),
    destroy() {
      if (live) {
        const hd = handles[live.k];
        if (hd.releasePointerCapture && live.id !== undefined) {
          try { hd.releasePointerCapture(live.id); } catch { /* already released */ }
        }
        live = null;
      }
      d.stop();
      if (ro) ro.disconnect();
      for (const [el, type, fn] of listeners) el.removeEventListener(type, fn);
    },
  };
  paint(d.now(), { reduced: d.reduced });
  return api;
}
