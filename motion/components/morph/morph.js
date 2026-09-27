/*
 * ARLing Motion: Morph.
 * A card that grows into a dialog and folds back into the card, like the Morphing Dialog of
 * Motion Primitives. FLIP: the dialog is laid out where it ends; at the first frame it is moved
 * and scaled (from its top left corner) onto the card's box, and one spring takes position and
 * size to the dialog's own, so both always cover the same share of the way. Nothing inside
 * stretches: the card's face and the dialog's content sit under the inverse scale, the face
 * fades out while the content enters, the corners are corrected per axis so they stay round,
 * and the 1 px ring stays 1 px. Closing while it still grows adds a spring back from where the
 * dialog is and how fast it moves, so it turns around without a jolt.
 *
 * Markup (the component adds the face and the ring):
 *   <button class="am-morph-card" type="button"> ...what the card shows... </button>
 *   <div class="am-morph-root" hidden>
 *     <div class="am-morph-backdrop"></div>
 *     <div class="am-morph-panel" role="dialog" aria-labelledby="title-id">
 *       <div class="am-morph-content">
 *         <h2 class="am-morph-title" id="title-id">...</h2> ... <button data-am-close>Close</button>
 *       </div>
 *     </div>
 *   </div>
 * The face is a copy of the card (aria-hidden, inert), taken each time the dialog opens. For a
 * seamless landing give the card and the panel the same background.
 *
 * Keyboard (WAI-ARIA APG, modal dialog): Enter or Space on the card opens, focus moves into the
 * dialog, Tab and Shift+Tab stay inside, Escape closes, focus returns to the card. A click on
 * the backdrop or on an element with data-am-close closes too. With prefers-reduced-motion the
 * dialog opens and closes at once.
 * MIT licence.
 */
import { track, presence, driver, steps, attr, PRESETS } from '../../src/core.js';

/** Position and size move on this one spring (about 1.5 % overshoot, tested under 3 %). */
export const MORPH = PRESETS.morph;
/** The dialog's content starts entering this long after the card starts to grow. */
export const CONTENT_DELAY = 0.1;
/** On close, the card's face starts coming back this long after the dialog starts to fold. */
export const FACE_DELAY = 0.12;

const FACE = { dyIn: 0, dyOut: 0, blur: 0, scaleFrom: 1 };
const CONTENT = { dyIn: 10, dyOut: -6, blur: 6, scaleFrom: 0.98 };
const SHOWN = { opacity: 1, blur: 0, y: 0, scale: 1, visible: true };
const GONE = { opacity: 0, blur: 0, y: 0, scale: 1, visible: false };
const MIN_SCALE = 0.01;

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const px = (v) => `${Math.round(v * 100) / 100}px`;
const n4 = (v) => String(Math.round(v * 1e4) / 1e4);

let uid = 0;
const ensureId = (el, prefix) => el.id || (el.id = `${prefix}-${++uid}`);

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]';
function tabbables(root) {
  return [...root.querySelectorAll(FOCUSABLE)].filter((el) => !el.disabled && el.tabIndex >= 0 && !el.closest('[hidden], [inert]'));
}

function radiusOf(el, fallback) {
  try {
    const v = parseFloat(getComputedStyle(el).borderTopLeftRadius);
    return Number.isFinite(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

/**
 * createMorph({ trigger, root, onOpenChange, clock, reduced })
 * trigger: the card; root: the .am-morph-root with the dialog inside.
 * Returns { open, close, toggle, isOpen, seek, settled, destroy, driver, keep, trigger, root,
 * panel, content, face }.
 */
export function createMorph(o) {
  const { trigger: card, root } = o;
  const panel = root.querySelector('[role="dialog"], [role="alertdialog"]');
  if (!panel) throw new Error('createMorph: root needs an element with role="dialog"');
  const doc = root.ownerDocument || document;
  const make = (cls) => { const el = doc.createElement('div'); el.className = cls; return el; };
  const ours = (el) => el.classList && (el.classList.contains('am-morph-face') || el.classList.contains('am-morph-ring'));

  let content = panel.querySelector('.am-morph-content');
  if (!content) {
    content = make('am-morph-content');
    for (const c of [...panel.childNodes]) if (!ours(c)) content.appendChild(c);
    panel.appendChild(content);
  }
  let ring = panel.querySelector('.am-morph-ring');
  if (!ring) {
    ring = make('am-morph-ring');
    panel.appendChild(ring);
  }
  attr(ring, 'aria-hidden', 'true');
  const backdrop = root.querySelector('.am-morph-backdrop');

  /** A copy of the card for the first frames of the dialog: no ids, no ARIA, not focusable. */
  function buildFace() {
    const f = card.cloneNode(true);
    for (const name of f.getAttributeNames()) if (name !== 'class' && name !== 'type') f.removeAttribute(name);
    for (const el of f.querySelectorAll('[id]')) el.removeAttribute('id');
    f.classList.add('am-morph-face');
    f.style.opacity = '';
    f.style.transform = '';
    attr(f, 'aria-hidden', 'true');
    attr(f, 'tabindex', '-1');
    attr(f, 'inert', true);
    return f;
  }
  let face = panel.querySelector('.am-morph-face');
  if (face) face.remove();
  face = buildFace();
  panel.insertBefore(face, panel.firstElementChild);

  ensureId(panel, 'am-morph');
  attr(panel, 'aria-modal', 'true');
  if (!panel.hasAttribute('tabindex')) attr(panel, 'tabindex', '-1');
  if (!panel.hasAttribute('aria-labelledby') && !panel.hasAttribute('aria-label')) {
    const title = panel.querySelector('.am-morph-title, h1, h2, h3');
    if (title) attr(panel, 'aria-labelledby', ensureId(title, 'am-morph-title'));
  }
  if (card.tagName === 'BUTTON' && !card.hasAttribute('type')) attr(card, 'type', 'button');
  attr(card, 'aria-haspopup', 'dialog');
  attr(card, 'aria-controls', panel.id);
  attr(card, 'aria-expanded', 'false');

  // ---------------------------------------------------------------- state as functions of time
  const openS = steps(false);
  const geo = steps(null);
  const m = track(0, MORPH); // 0 = the card's box, 1 = the dialog
  const back = track(0, PRESETS.smooth);
  const faceP = presence(true, FACE);
  const body = presence(false, CONTENT);
  let endT = -Infinity;
  const mark = (t) => { if (t > endT) endT = t; };
  const settledAll = (t) => m.settled(t) && back.settled(t) && faceP.settled(t) && body.settled(t);

  /** The card's box against the dialog's own box (the panel measured without its transform). */
  function measure() {
    const was = root.hidden;
    const moved = panel.style.transform;
    const rounded = panel.style.borderRadius;
    root.hidden = false;
    panel.style.transform = '';
    panel.style.borderRadius = '';
    const pr = panel.getBoundingClientRect();
    const cr = card.getBoundingClientRect();
    const r1 = radiusOf(panel, 16);
    panel.style.transform = moved;
    panel.style.borderRadius = rounded;
    root.hidden = was;
    const ok = pr.width > 0 && pr.height > 0 && cr.width > 0 && cr.height > 0;
    return {
      flat: !ok, // nothing to measure (hidden or no layout yet): only the crossfade
      dx: ok ? cr.left - pr.left : 0,
      dy: ok ? cr.top - pr.top : 0,
      sx: ok ? Math.max(MIN_SCALE, cr.width / pr.width) : 1,
      sy: ok ? Math.max(MIN_SCALE, cr.height / pr.height) : 1,
      cw: cr.width,
      ch: cr.height,
      r0: radiusOf(card, 12),
      r1,
    };
  }
  const sameGeo = (a, b) => !!a && !!b && ['dx', 'dy', 'cw', 'ch'].every((k) => Math.abs(a[k] - b[k]) < 0.5)
    && Math.abs(a.sx - b.sx) < 1e-3 && Math.abs(a.sy - b.sy) < 1e-3;

  function paintPart(el, st, inverse) {
    el.style.opacity = n4(st.opacity);
    el.style.filter = st.blur > 0.05 ? `blur(${st.blur.toFixed(2)}px)` : '';
    const own = Math.abs(st.y) > 0.005 || Math.abs(st.scale - 1) > 1e-4 ? `translateY(${st.y.toFixed(2)}px) scale(${st.scale.toFixed(4)})` : '';
    el.style.transform = [inverse, own].filter(Boolean).join(' ');
    el.style.visibility = st.visible ? '' : 'hidden';
  }

  function paint(t, { reduced }) {
    const isOpen = openS.at(t);
    // closing stays on screen until every spring is home; before the first open all is settled
    const visible = isOpen || (!reduced && !settledAll(t));
    attr(card, 'aria-expanded', String(isOpen));
    attr(panel, 'data-state', isOpen ? 'open' : 'closed');
    root.hidden = !visible;
    card.style.opacity = visible && !reduced ? '0' : '';
    if (!visible) return;
    const g = geo.at(t);
    const k = reduced || !g ? 1 : m.at(t);
    const f = 1 - k;
    const moving = !!g && !g.flat && Math.abs(f) > 1e-9;
    let inverse = '';
    if (moving) {
      const sx = Math.max(MIN_SCALE, 1 - (1 - g.sx) * f);
      const sy = Math.max(MIN_SCALE, 1 - (1 - g.sy) * f);
      const r = g.r0 + (g.r1 - g.r0) * clamp01(k);
      panel.style.transform = `translate(${px(g.dx * f)}, ${px(g.dy * f)}) scale(${n4(sx)}, ${n4(sy)})`;
      // corrected per axis: after the scale the corners are round with radius r
      panel.style.borderRadius = `${px(r / sx)} / ${px(r / sy)}`;
      ring.style.borderWidth = `${px(1 / sy)} ${px(1 / sx)}`;
      inverse = `scale(${n4(1 / sx)}, ${n4(1 / sy)})`;
    } else {
      panel.style.transform = '';
      panel.style.borderRadius = '';
      ring.style.borderWidth = '';
    }
    if (g) {
      face.style.width = px(g.cw);
      face.style.height = px(g.ch);
    }
    if (backdrop) backdrop.style.opacity = n4(reduced ? 1 : clamp01(back.at(t)));
    paintPart(face, reduced ? GONE : faceP.at(t), inverse);
    paintPart(content, reduced ? (isOpen ? SHOWN : GONE) : body.at(t), inverse);
  }

  function draw(t, st) {
    paint(t, st);
    if (!api.keep && t >= endT && openS.ev.length && settledAll(t)) {
      for (const tr of [m, back, faceP.p, body.p]) tr.compact(t);
      faceP.marks = faceP.marks.slice(-1);
      body.marks = body.marks.slice(-1);
      openS.compact();
      geo.compact();
    }
  }

  const d = driver(draw, { clock: o.clock, reduced: o.reduced });
  d.busy = (t) => t < endT || !settledAll(t);
  const commit = () => { paint(d.now(), { reduced: d.reduced }); d.kick(); };
  const when = (opt) => (opt && opt.t !== undefined ? { t: opt.t, live: false } : { t: d.now(), live: true });

  /** Opens: the card grows into the dialog. opt: { t } to schedule it (demo, video). */
  function open(opt = {}) {
    const { t, live } = when(opt);
    if (openS.last) return api;
    const nf = buildFace(); // the card as it looks now
    panel.insertBefore(nf, face);
    face.remove();
    face = nf;
    openS.set(t, true);
    geo.set(t, measure());
    m.to(t, 1);
    back.to(t, 1);
    faceP.exit(t);
    body.enter(t + CONTENT_DELAY);
    mark(t + CONTENT_DELAY);
    commit();
    if (live) {
      const first = panel.querySelector('[autofocus]') || tabbables(content)[0] || panel;
      first.focus();
      // A real browser will not focus the content while it is still visibility:hidden (it fades in
      // after CONTENT_DELAY): hold focus on the panel (tabindex -1), so Escape and Tab already work,
      // and hand it to the first control once the content shows.
      if (doc.activeElement !== first) {
        panel.focus();
        if (first !== panel) {
          clearTimeout(focusTimer);
          focusTimer = setTimeout(() => {
            if (openS.last && doc.activeElement === panel) first.focus();
          }, Math.ceil(CONTENT_DELAY * 1000) + 50);
        }
      }
      if (o.onOpenChange) o.onOpenChange(true);
    }
    return api;
  }

  /** Closes: the dialog folds back into the card, from wherever it is. opt: { t }. */
  function close(opt = {}) {
    const { t, live } = when(opt);
    if (!openS.last) return api;
    const prev = geo.last;
    const g = measure();
    openS.set(t, false);
    // the same boxes as before: keep the same numbers, so a close mid flight has no jump
    geo.set(t, sameGeo(prev, g) ? prev : g);
    body.exit(t);
    back.to(t, 0);
    m.to(t, 0);
    faceP.enter(t + FACE_DELAY);
    mark(t + FACE_DELAY);
    commit();
    if (live) {
      card.focus();
      if (o.onOpenChange) o.onOpenChange(false);
    }
    return api;
  }

  const listeners = [];
  const on = (el, type, fn) => { el.addEventListener(type, fn); listeners.push([el, type, fn]); };
  let focusTimer = 0;

  on(card, 'click', () => (openS.last ? close() : open()));
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
    trigger: card,
    root,
    panel,
    content,
    get face() { return face; },
    driver: d,
    keep: false,
    open,
    close,
    toggle: (opt) => (openS.last ? close(opt) : open(opt)),
    isOpen: (t) => (t === undefined ? openS.last : openS.at(t)),
    seek: (t) => paint(t, { reduced: d.reduced }),
    settled: (t) => t >= endT && settledAll(t),
    destroy() {
      clearTimeout(focusTimer);
      d.stop();
      for (const [el, type, fn] of listeners) el.removeEventListener(type, fn);
    },
  };
  paint(d.now(), { reduced: d.reduced });
  return api;
}
