/*
 * ARLing Motion: Steps.
 * Steps with progress, for a setup or a checkout, like a shadcn Progress under a stepper. A line
 * behind the markers draws on to the current step on a spring, the step you are on lights up (a
 * ring closes in on its marker), and a finished step fills and gets a check that draws itself.
 * Going back undoes it the same way, and a jump over several steps finishes them one after
 * another. Every value is a function of time (the check is stroke-dashoffset from the seconds
 * since its step was finished), so seek(t) paints any moment of a scheduled demo.
 *
 * Markup:
 *   <div class="am-steps">
 *     <ol class="am-steps-list" aria-label="Setup">
 *       <li><span class="am-steps-title">Product feed</span><span class="am-steps-detail">Your feed URL</span></li>
 *       <li><span class="am-steps-title">Check products</span></li>
 *     </ol>
 *   </div>
 * The component adds the parts that are missing: a marker per step (number, filled disc, check
 * and ring, all aria-hidden), a visually hidden "Completed:" before every finished step, the
 * progress line (.am-steps-bar with .am-steps-fill) and a polite status region. Horizontal, one
 * equal column per step.
 *
 * Screen readers: the list keeps its list role (role="list", which some browsers drop with
 * list-style: none), the current step has aria-current="step", and the line is a progressbar
 * with aria-valuenow (steps done), aria-valuemax (steps) and aria-valuetext ("Step 2 of 3: Check
 * products"). A change made by setStep() is also said once in the status region. The steps do not
 * take focus and are not buttons: focus stays on your own Next or Back button, which is always
 * visible. With prefers-reduced-motion every change shows at once.
 * MIT licence.
 */
import { track, driver, steps as discrete, attr, spring, PRESETS } from '../../src/core.js';

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const n4 = (v) => String(Math.round(v * 1e4) / 1e4);
const SVG = 'http://www.w3.org/2000/svg';

/** The line draws on to the current step on this spring (overshoot under 1 %). */
export const LINE = PRESETS.smooth;
/** A finished step's disc grows on this spring. */
export const FILL = PRESETS.snappy;
/** The check draws itself on this spring: critically damped, so the stroke never runs past its end. */
export const DRAW = spring(0.42, 1);
/** The ring of the current step closes in on this spring. */
export const RING = PRESETS.smooth;
/** Going back: the check, the disc and the ring leave on this quick spring without overshoot. */
export const UNDO = PRESETS.exit;
/** The check starts drawing this long after its disc starts to grow. */
export const CHECK_DELAY = 0.12;
/** The new current step lights up this long after the line starts toward it. */
export const CURRENT_DELAY = 0.16;
/** Several steps finished at once fill one after another, this many seconds apart. */
export const STAGGER = 0.08;
/** The ring starts this much larger than the marker and closes in. */
export const RING_FROM = 1.3;
/** The check, in a 24 by 24 box. */
export const CHECK_PATH = 'M5 12.5l4.5 4.5L19 7.5';

/** The default aria-valuetext and announcement: "Step 2 of 3: Check products" or "All 3 steps completed". */
export function describeStep(step, count, titles) {
  return step >= count ? `All ${count} steps completed` : `Step ${step + 1} of ${count}: ${titles[step]}`;
}

/** Sets a new target at time `at`; changes planned after `now` are dropped (the later call wins). */
function aim(tr, now, at, target, sp) {
  tr.ev = tr.ev.filter((e) => e.t <= now);
  tr.to(at, target, sp);
}

/**
 * createSteps({ root, list, step, label, doneText, describe, announce, clock, reduced })
 * step: the current step, 0 is the first; the number of steps means every step is done.
 * label: the name of the progress bar (default: the list's name and "progress").
 * doneText: the hidden word before a finished step (default "Completed").
 * describe(step, count, titles): aria-valuetext and the announcement (default describeStep).
 * announce: false leaves out the status region.
 * setStep(i, { t }) schedules a change (demos, video); without t it happens now and is announced.
 * Returns { setStep, step, count, titles, seek, settled, destroy, driver, root, list, items, bar,
 * status, keep }.
 */
export function createSteps(o) {
  const root = o.root;
  const doc = root.ownerDocument || document;
  root.classList.add('am-steps');
  const list = o.list || root.querySelector('.am-steps-list, ol, ul');
  if (!list) throw new Error('createSteps: root needs a list (ol) inside it');
  list.classList.add('am-steps-list');
  attr(list, 'role', 'list');
  const items = [...list.children].filter((el) => !!el.tagName && (el.tagName === 'LI' || el.classList.contains('am-steps-item')));
  if (!items.length) throw new Error('createSteps: the list has no steps (li)');
  const n = items.length;
  root.style.setProperty('--am-steps-count', String(n));
  const describe = o.describe || describeStep;
  const doneText = o.doneText ?? 'Completed';

  // ---------------------------------------------------------------- parts
  const make = (tag, cls, parent, before) => {
    const el = doc.createElement(tag);
    el.className = cls;
    if (before === undefined) parent.appendChild(el);
    else parent.insertBefore(el, before);
    return el;
  };
  const svg = (tag, attrs) => {
    const s = doc.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v);
    return s;
  };
  const firstOf = (el) => ('firstChild' in el ? el.firstChild : el.firstElementChild);
  const nextOf = (el) => {
    if ('nextSibling' in el) return el.nextSibling;
    const kids = [...el.parentNode.children];
    return kids[kids.indexOf(el) + 1] || null;
  };

  const titles = items.map((li) => {
    const own = li.getAttribute('data-title');
    if (own) return own;
    const title = li.querySelector('.am-steps-title');
    return (title || li).textContent.trim().replace(/\s+/g, ' ');
  });

  const parts = items.map((li, i) => {
    li.classList.add('am-steps-item');
    let marker = li.querySelector('.am-steps-marker');
    if (!marker) marker = make('span', 'am-steps-marker', li, firstOf(li));
    attr(marker, 'aria-hidden', 'true');
    const halo = marker.querySelector('.am-steps-halo') || make('span', 'am-steps-halo', marker);
    const disc = marker.querySelector('.am-steps-disc') || make('span', 'am-steps-disc', marker);
    let num = marker.querySelector('.am-steps-num');
    if (!num) {
      num = make('span', 'am-steps-num', marker);
      num.textContent = String(i + 1);
    }
    let check = marker.querySelector('.am-steps-check');
    if (!check) {
      check = svg('svg', { class: 'am-steps-check', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '3', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', focusable: 'false' });
      check.appendChild(svg('path', { class: 'am-steps-draw', d: CHECK_PATH, pathLength: '1' }));
      marker.appendChild(check);
    }
    const draw = check.querySelector('.am-steps-draw') || check.querySelector('path');
    // the hidden word goes right after the marker, before the title
    const sr = li.querySelector('.am-steps-sr') || make('span', 'am-steps-sr', li, nextOf(marker));
    return { marker, halo, disc, num, check, draw, sr };
  });

  let bar = root.querySelector('.am-steps-bar');
  if (!bar) bar = make('div', 'am-steps-bar', root, firstOf(root));
  const fill = bar.querySelector('.am-steps-fill') || make('span', 'am-steps-fill', bar);
  attr(bar, 'role', 'progressbar');
  attr(bar, 'aria-valuemin', '0');
  attr(bar, 'aria-valuemax', String(n));
  if (o.label) attr(bar, 'aria-label', o.label);
  else if (!bar.hasAttribute('aria-label') && !bar.hasAttribute('aria-labelledby')) {
    const name = list.getAttribute('aria-label');
    attr(bar, 'aria-label', name ? `${name} progress` : 'Progress');
  }
  let status = null;
  if (o.announce !== false) {
    status = root.querySelector('.am-steps-status') || make('span', 'am-steps-status', root);
    attr(status, 'role', 'status');
    attr(status, 'aria-live', 'polite');
    attr(status, 'aria-atomic', 'true');
  }

  // ---------------------------------------------------------------- state as functions of time
  const clampStep = (i) => {
    const v = Math.round(Number(i));
    return Number.isFinite(v) ? Math.max(0, Math.min(n, v)) : 0;
  };
  const s0 = clampStep(o.step ?? root.getAttribute('data-step') ?? 0);
  const frac = (s) => (n > 1 ? Math.min(s, n - 1) / (n - 1) : 0);
  const cur = discrete(s0);
  const line = track(frac(s0), LINE);
  const fills = items.map((_, i) => track(i < s0 ? 1 : 0, FILL));
  const checks = items.map((_, i) => track(i < s0 ? 1 : 0, DRAW));
  const rings = items.map((_, i) => track(i === s0 ? 1 : 0, RING));
  const all = [line, ...fills, ...checks, ...rings];
  let endT = -Infinity;
  const mark = (t) => { if (t > endT) endT = t; };
  const settledAll = (t) => all.every((tr) => tr.settled(t));

  function paint(t, { reduced }) {
    const s = cur.at(t);
    fill.style.transform = `scaleX(${n4(clamp01(reduced ? frac(s) : line.at(t)))})`;
    attr(bar, 'aria-valuenow', String(s));
    attr(bar, 'aria-valuetext', describe(s, n, titles));
    attr(root, 'data-complete', s >= n ? true : null);
    items.forEach((li, i) => {
      const done = i < s;
      attr(li, 'data-state', done ? 'complete' : i === s ? 'current' : 'upcoming');
      attr(li, 'aria-current', i === s ? 'step' : null);
      const P = parts[i];
      const word = done && doneText ? `${doneText}: ` : '';
      if (P.sr.textContent !== word) P.sr.textContent = word;
      const f = reduced ? (done ? 1 : 0) : Math.max(0, fills[i].at(t));
      P.disc.style.transform = `scale(${n4(f)})`;
      P.disc.style.visibility = f > 0.002 ? 'visible' : 'hidden';
      P.num.style.opacity = n4(1 - clamp01(f));
      const c = reduced ? (done ? 1 : 0) : clamp01(checks[i].at(t));
      P.draw.style.strokeDashoffset = n4(1 - c);
      P.check.style.visibility = c > 0.001 ? 'visible' : 'hidden';
      const r = reduced ? (i === s ? 1 : 0) : rings[i].at(t);
      const q = clamp01(r);
      P.halo.style.opacity = n4(q);
      P.halo.style.transform = `scale(${n4(1 + (RING_FROM - 1) * (1 - r))})`;
      P.halo.style.visibility = q > 0.002 ? 'visible' : 'hidden';
    });
  }

  function draw(t, st) {
    paint(t, st);
    if (!api.keep && t >= endT && settledAll(t)) {
      for (const tr of all) tr.compact(t);
      cur.compact();
    }
  }

  const d = driver(draw, { clock: o.clock, reduced: o.reduced });
  d.busy = (t) => t < endT || !settledAll(t);
  const commit = () => { paint(d.now(), { reduced: d.reduced }); d.kick(); };
  const when = (opt) => (opt && opt.t !== undefined ? { t: opt.t, live: false } : { t: d.now(), live: true });

  /** Goes to step i (0 is the first, the number of steps means all done). opt: { t } to schedule it. */
  function setStep(i, opt = {}) {
    const { t, live } = when(opt);
    const next = clampStep(i);
    const prev = cur.last;
    if (next === prev) return api;
    cur.set(t, next);
    aim(line, t, t, frac(next), LINE);
    let k = 0; // the steps finished now fill one after another
    for (let j = 0; j < n; j++) {
      const was = j < prev;
      const is = j < next;
      if (was !== is) {
        if (is) {
          const at = t + STAGGER * k++;
          aim(fills[j], t, at, 1, FILL);
          aim(checks[j], t, at + CHECK_DELAY, 1, DRAW);
          mark(at + CHECK_DELAY);
        } else {
          aim(fills[j], t, t, 0, UNDO);
          aim(checks[j], t, t, 0, UNDO);
        }
      }
      if ((j === prev) !== (j === next)) {
        if (j === next) {
          aim(rings[j], t, t + CURRENT_DELAY, 1, RING);
          mark(t + CURRENT_DELAY);
        } else aim(rings[j], t, t, 0, UNDO);
      }
    }
    mark(t);
    commit();
    if (live && status) status.textContent = describe(next, n, titles);
    return api;
  }

  const api = {
    root,
    list,
    items,
    bar,
    status,
    driver: d,
    keep: false,
    count: n,
    titles,
    setStep,
    /** The current step now, or at time t of a scheduled timeline. */
    step: (t) => (t === undefined ? cur.last : cur.at(t)),
    seek: (t) => paint(t, { reduced: d.reduced }),
    settled: (t) => t >= endT && settledAll(t),
    destroy() { d.stop(); },
  };
  paint(d.now(), { reduced: d.reduced });
  return api;
}
