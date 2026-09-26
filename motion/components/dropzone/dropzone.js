/*
 * ARLing Motion: Dropzone that unfolds into a file list.
 * The zone is one shape. When files arrive, its prompt leaves, its top edge stands still
 * and the shape grows row by row into a list; each row enters just after the growing edge
 * reaches it. Removing a row lets it leave in place while the rows below slide up; clearing
 * folds the list back into the zone. Nothing is uploaded anywhere: the component only lists
 * the files and hands you the File objects (onChange).
 *
 * Markup:
 *   <div class="am-dropzone">
 *     <input type="file" class="am-dropzone-input" id="files" multiple>
 *     <label class="am-dropzone-prompt" for="files">Drop files here or <u>browse</u></label>
 *   </div>
 * The component adds the list header (Add files, Clear), the list and a status line.
 *
 * Keyboard: the file input is in the Tab order while the zone is empty (Enter or Space
 * opens the picker, its focus ring is drawn on the zone). With files listed, Add files,
 * Clear and each row's Remove button take over; after a removal focus moves to the next
 * row, and to the input when the list is empty. Dragging files onto the zone is never the
 * only way to add them (WCAG 2.5.7).
 *
 * Layout: the zone keeps the space of a list of reserveRows rows (default 3) from the start.
 * While the shape grows or folds, a bottom margin fills the rest of that space, so the
 * content below never moves (no layout shift, even when files arrive from the system dialog
 * seconds after the last click). More rows than that scroll inside the zone. With
 * reserveRows: 0 the zone takes only the space it shows, and the content below moves as the
 * list grows; such a shift counts in CLS when no click or key came just before it.
 * MIT licence.
 */
import { track, presence, applyPresence, driver, springStep, settleTime, steps, attr, PRESETS } from '../../src/core.js';

// ------------------------------------------------------------------ helpers

const px = (v) => `${Math.round(v * 100) / 100}px`;
const num = (v) => String(Math.round(v * 10000) / 10000);
const SHOWN = { opacity: 1, blur: 0, y: 0, scale: 1, visible: true };
const GONE = { opacity: 0, blur: 0, y: 0, scale: 1, visible: false };

let uid = 0;
const ensureId = (el, prefix) => el.id || (el.id = `${prefix}-${++uid}`);

/** A presence state plus a place, written as one transform. */
function applyAt(el, s, y) {
  el.style.opacity = num(s.opacity);
  el.style.filter = s.blur > 0.05 ? `blur(${s.blur.toFixed(2)}px)` : '';
  el.style.transform = `translateY(${px(y + s.y)}) scale(${s.scale.toFixed(4)})`;
  el.style.visibility = s.visible ? '' : 'hidden';
}

/** Seconds after the start until a unit step of this spring first reaches frac (unfold timing). */
function reach(sp, frac) {
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

/** 812 B, 14 KB, 2.4 MB */
export function formatSize(bytes) {
  const b = Math.max(0, Number(bytes) || 0);
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

// ------------------------------------------------------------------ dropzone

export const UNFOLD = { spring: PRESETS.smooth, rowAt: 0.4, step: 0.04 };
/** How long a status message stays in the live region, s. */
export const SAY_FOR = 1;
const ROW_MOTION = { dyIn: 8, dyOut: -4, blur: 4, scaleFrom: 1 };
const PART_MOTION = { dyIn: 6, dyOut: -4, blur: 6, scaleFrom: 0.98 };

/**
 * createDropzone({ root, onChange(files), labels, reserveRows, clock, reduced })
 * labels: { title, add, clear, remove(name) } for the header and buttons.
 * reserveRows: rows of list the layout keeps from the start (default 3, 0 = none).
 * Returns { add, remove, clear, over, files, count, seek, settled, destroy, driver, input,
 * prompt, list, addButton, clearButton, keep }.
 */
export function createDropzone(o) {
  const root = o.root;
  const doc = root.ownerDocument || document;
  const L = { title: 'Selected files', add: 'Add files', clear: 'Clear', remove: (n) => `Remove ${n}`, ...(o.labels || {}) };
  const input = root.querySelector('.am-dropzone-input') || root.querySelector('input[type="file"]');
  const prompt = root.querySelector('.am-dropzone-prompt');
  if (o.multiple !== false) attr(input, 'multiple', true);
  attr(prompt, 'for', ensureId(input, 'am-dropzone-input'));

  const make = (tag, cls, parent, text) => {
    const el = doc.createElement(tag);
    if (cls) el.className = cls;
    if (text) el.textContent = text;
    parent.appendChild(el);
    return el;
  };
  let head = root.querySelector('.am-dropzone-head');
  if (!head) {
    head = make('div', 'am-dropzone-head', root);
    make('span', 'am-dropzone-title', head, L.title);
    make('button', 'am-dropzone-add', head, L.add);
    make('button', 'am-dropzone-clear', head, L.clear);
  }
  const title = head.querySelector('.am-dropzone-title');
  const addButton = head.querySelector('.am-dropzone-add');
  const clearButton = head.querySelector('.am-dropzone-clear');
  for (const b of [addButton, clearButton]) if (b && !b.hasAttribute('type')) attr(b, 'type', 'button');
  let list = root.querySelector('.am-dropzone-list');
  if (!list) list = make('ul', 'am-dropzone-list', root);
  if (title) attr(list, 'aria-labelledby', ensureId(title, 'am-dropzone-title'));
  const status = root.querySelector('.am-dropzone-status') || make('div', 'am-dropzone-status', root);
  attr(status, 'role', 'status');

  // geometry: the empty zone, the header, one row, the space under the last row
  const hOf = (el, fallback) => (el && el.getBoundingClientRect().height) || fallback;
  const zoneH = o.zoneHeight ?? hOf(prompt, 128);
  const headH = o.headHeight ?? hOf(head, 44);
  let rowH = o.rowHeight ?? 44;
  let rowMeasured = o.rowHeight !== undefined;
  const padB = o.padBottom ?? 8;
  if (!rowMeasured) {
    // measure one row now, so the reserved space does not change when the first file arrives
    const probe = make('li', 'am-dropzone-row', list);
    make('span', 'am-dropzone-name', probe, 'file');
    const r = probe.getBoundingClientRect();
    probe.remove();
    if (r.height) { rowH = r.height; rowMeasured = true; }
  }
  const heightFor = (n) => (n ? headH + n * rowH + padB : zoneH);
  const rowY = (k) => headH + k * rowH;
  // the space the zone keeps in the layout; the shape never grows past it (rows then scroll)
  const reserveRows = Math.max(0, Math.floor(o.reserveRows ?? 3));
  const reserveH = () => (reserveRows ? Math.max(zoneH, heightFor(reserveRows)) : Infinity);

  const entries = []; // { id, file, name, size, el, remove, y, pres, added, removed }
  const overS = steps(false);
  const h = track(zoneH, UNFOLD.spring);
  const promptP = presence(true, PART_MOTION);
  const headP = presence(false, PART_MOTION);
  const says = steps(['', -Infinity]);
  let endT = -Infinity;
  const mark = (t) => { if (t > endT) endT = t; };
  const all = () => [h, promptP.p, headP.p, ...entries.flatMap((e) => [e.y, e.pres.p])];
  const settledAll = (t) => all().every((tr) => tr.settled(t));

  const presentAt = (t) => entries.filter((e) => e.added <= t && !(e.removed <= t));
  const presentNow = () => entries.filter((e) => e.removed === Infinity);

  function makeRow(file) {
    const el = doc.createElement('li');
    el.className = 'am-dropzone-row';
    make('span', 'am-dropzone-name', el, file.name);
    make('span', 'am-dropzone-size', el, formatSize(file.size));
    const remove = make('button', 'am-dropzone-remove', el);
    attr(remove, 'type', 'button');
    attr(remove, 'aria-label', L.remove(file.name));
    el.hidden = true;
    list.appendChild(el);
    if (!rowMeasured) {
      el.hidden = false;
      const r = el.getBoundingClientRect();
      el.hidden = true;
      if (r.height) { rowH = r.height; rowMeasured = true; }
    }
    return { el, remove };
  }

  function paint(t, { reduced }) {
    const present = presentAt(t);
    const n = present.length;
    const over = overS.at(t);
    attr(root, 'data-state', over ? 'over' : n ? 'filled' : 'empty');
    attr(input, 'tabindex', n ? '-1' : null);
    // reduced motion shows the size of the list in force now (the fold may start a little later)
    const space = reserveH();
    const shape = Math.min(reduced ? heightFor(n) : h.at(t), space);
    root.style.height = px(shape);
    if (space !== Infinity) root.style.marginBottom = px(space - shape);
    const scroll = reserveRows > 0 && n > reserveRows;
    attr(root, 'data-scroll', scroll ? true : null);
    if (!scroll && root.scrollTop) root.scrollTop = 0;
    applyPresence(prompt, reduced ? (n ? GONE : SHOWN) : promptP.at(t));
    attr(prompt, 'aria-hidden', n ? 'true' : null);
    applyPresence(head, reduced ? (n ? SHOWN : GONE) : headP.at(t));
    attr(head, 'inert', n ? null : true);
    for (const e of entries) {
      const here = e.added <= t && !(e.removed <= t);
      const s = reduced ? (here ? SHOWN : GONE) : e.pres.at(t);
      e.el.hidden = !(here || s.visible);
      attr(e.el, 'aria-hidden', here ? null : 'true');
      attr(e.el, 'inert', here ? null : true);
      if (!e.el.hidden) applyAt(e.el, s, reduced ? e.y.target(t) : e.y.at(t));
    }
    const [msg, at] = says.at(t);
    const text = t < at + SAY_FOR ? msg : '';
    if (status.textContent !== text) status.textContent = text;
  }

  function draw(t, s) {
    paint(t, s);
    if (!api.keep && t >= endT && settledAll(t) && (entries.length || overS.ev.length)) {
      // rows that have left are gone for good
      for (let i = entries.length - 1; i >= 0; i--) {
        const e = entries[i];
        if (e.removed <= t) { e.el.remove(); entries.splice(i, 1); }
      }
      for (const tr of all()) tr.compact(t);
      for (const p of [promptP, headP, ...entries.map((e) => e.pres)]) p.marks = [];
      overS.compact();
    }
  }

  const d = driver(draw, { clock: o.clock, reduced: o.reduced });
  d.busy = (t) => t < endT || !settledAll(t) || t < says.last[1] + SAY_FOR;
  const commit = () => { paint(d.now(), { reduced: d.reduced }); d.kick(); };
  const when = (opt) => (opt && opt.t !== undefined ? { t: opt.t, live: false } : { t: d.now(), live: true });
  const say = (t, msg) => { says.set(t, [msg, t]); mark(t + SAY_FOR); };
  const report = () => { if (o.onChange) o.onChange(presentNow().map((e) => e.file)); };

  /** Lays the present rows out from the top, sliding the ones that moved. */
  function relayout(t, keep) {
    presentNow().forEach((e, k) => {
      const y = rowY(k);
      if (keep.has(e) && Math.abs(e.y.target(t) - y) > 0.01) e.y.to(t, y, PRESETS.snappy);
    });
  }

  /** Adds files (File objects or { name, size }). The zone unfolds into rows. */
  function add(files, opt = {}) {
    const { t, live } = when(opt);
    const incoming = [...(files || [])].filter(Boolean);
    if (!incoming.length) return api;
    const before = presentNow();
    const h0 = h.target(t);
    const fresh = incoming.map((file, j) => {
      const { el, remove } = makeRow(file);
      const k = before.length + j;
      const e = { id: ++uid, file, name: file.name, size: file.size, el, remove, y: track(rowY(k), PRESETS.snappy), pres: presence(false, ROW_MOTION), added: t, removed: Infinity };
      on(remove, 'click', () => removeLive(e));
      entries.push(e);
      return e;
    });
    const n = before.length + fresh.length;
    const H = heightFor(n);
    const sp = UNFOLD.spring;
    let delay = 0;
    if (!before.length) {
      promptP.exit(t);
      headP.enter(t + 0.05);
      delay = 0.08; // the prompt leaves first
    }
    h.to(t, H, sp);
    fresh.forEach((e, j) => {
      const edge = rowY(before.length + j) + rowH * UNFOLD.rowAt;
      const byEdge = H > h0 ? reach(sp, (edge - h0) / (H - h0)) : 0;
      const tj = t + Math.max(byEdge, delay + j * UNFOLD.step);
      e.pres.enter(tj);
      mark(tj);
    });
    say(t, fresh.length === 1 ? `${fresh[0].name} added.` : `${fresh.length} files added.`);
    commit();
    if (live) report();
    return api;
  }

  function removeEntry(e, t) {
    if (e.removed !== Infinity) return false;
    const keep = new Set(presentNow().filter((x) => x !== e));
    e.removed = t;
    e.pres.exit(t);
    relayout(t, keep);
    const n = keep.size;
    h.to(t + 0.04, heightFor(n), PRESETS.snappy);
    if (!n) {
      headP.exit(t);
      promptP.enter(t + 0.12);
    }
    mark(t + 0.12);
    return true;
  }

  /** Removes the file at index i of the current list. */
  function remove(i, opt = {}) {
    const { t, live } = when(opt);
    const e = presentNow()[i];
    if (!e || !removeEntry(e, t)) return api;
    say(t, `${e.name} removed.`);
    commit();
    if (live) report();
    return api;
  }

  function removeLive(e) {
    const list0 = presentNow();
    const i = list0.indexOf(e);
    if (i < 0) return;
    remove(i);
    const rest = presentNow();
    const next = rest[Math.min(i, rest.length - 1)];
    (next ? next.remove : input).focus();
  }

  /** Removes every file: rows leave from the last one back, the list folds into the zone. */
  function clear(opt = {}) {
    const { t, live } = when(opt);
    const now = presentNow();
    if (!now.length) return api;
    for (let k = now.length - 1, j = 0; k >= 0; k--, j++) {
      now[k].removed = t;
      now[k].pres.exit(t + j * 0.02);
    }
    h.to(t + 0.05, zoneH, PRESETS.snappy);
    headP.exit(t);
    promptP.enter(t + 0.12);
    mark(t + 0.12 + now.length * 0.02);
    say(t, 'All files removed.');
    commit();
    if (live) {
      report();
      input.focus();
    }
    return api;
  }

  /** Files dragged over the zone: its border switches at once, nothing moves. */
  function over(on, opt = {}) {
    const { t } = when(opt);
    if (overS.last === !!on) return api;
    overS.set(t, !!on);
    mark(t);
    commit();
    return api;
  }

  // ---------------------------------------------------------------- live input
  const listeners = [];
  const on = (target, type, fn) => { target.addEventListener(type, fn); listeners.push([target, type, fn]); };
  const hasFiles = (e) => !e.dataTransfer || !e.dataTransfer.types || [...e.dataTransfer.types].includes('Files');

  on(input, 'change', () => {
    add(input.files);
    input.value = '';
  });
  if (addButton) on(addButton, 'click', () => input.click());
  if (clearButton) on(clearButton, 'click', () => clear());
  on(root, 'dragenter', (e) => { if (hasFiles(e)) { e.preventDefault(); over(true); } });
  on(root, 'dragover', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    over(true);
  });
  on(root, 'dragleave', (e) => {
    const next = e.relatedTarget;
    if (next && root.contains(next)) return;
    over(false);
  });
  on(root, 'drop', (e) => {
    e.preventDefault();
    over(false);
    const files = e.dataTransfer && e.dataTransfer.files;
    if (files && files.length) add(files);
  });

  const api = {
    root,
    input,
    prompt,
    list,
    addButton,
    clearButton,
    driver: d,
    keep: false,
    add,
    remove,
    clear,
    over,
    files: (t) => (t === undefined ? presentNow() : presentAt(t)).map((e) => e.file),
    count: (t) => (t === undefined ? presentNow() : presentAt(t)).length,
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
