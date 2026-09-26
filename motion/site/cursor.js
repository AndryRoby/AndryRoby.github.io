/*
 * A drawn pointer for the demos on arling.sk/motion and in demo.html?cursor=1.
 * Every demo returns cursor keyframes { t, el, dx?, dy?, click?, down?, up?, carry?, drop? } and
 * sometimes keys [{ t, key }]. This draws them at time t as a pure function of t (like the
 * components), so a live loop and a frame by frame render show the same thing.
 * The pointer glides to each target in the last 0.45 s before it, clicks leave a small ring,
 * between down and up the pointer is pressed and follows the drag, a carried file shows a label,
 * and keys show as a keycap at the bottom of the stage.
 * MIT licence.
 */
const SVG = 'http://www.w3.org/2000/svg';
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (s) => s * s * (3 - 2 * s);
const easeIn = (s) => s * s;
const GLIDE = 0.45;
const KEY_NAMES = { ArrowDown: '↓', ArrowUp: '↑', ArrowLeft: '←', ArrowRight: '→', Enter: 'Enter', Escape: 'Esc', ' ': 'Space', Backspace: 'Backspace', Tab: 'Tab' };

export function createCursor(stage) {
  const doc = stage.ownerDocument;
  const layer = doc.createElement('div');
  layer.className = 'mo-cursor-layer';
  layer.setAttribute('aria-hidden', 'true');
  const ring = doc.createElement('span');
  ring.className = 'mo-cursor-ring';
  const pointer = doc.createElement('span');
  pointer.className = 'mo-cursor';
  const svg = doc.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 20 26');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '26');
  const path = doc.createElementNS(SVG, 'path');
  path.setAttribute('d', 'M2 2 L2 21 L7.2 16.4 L10.6 24 L14 22.5 L10.7 15.1 L17.5 15.1 Z');
  svg.appendChild(path);
  pointer.appendChild(svg);
  const chip = doc.createElement('span');
  chip.className = 'mo-cursor-chip';
  const keycap = doc.createElement('span');
  keycap.className = 'mo-keycap';
  layer.append(ring, chip, pointer, keycap);
  stage.appendChild(layer);

  function point(k, sr) {
    const r = k.el.getBoundingClientRect();
    return { x: r.left + r.width / 2 + (k.dx || 0) - sr.left, y: r.top + r.height / 2 + (k.dy || 0) - sr.top };
  }

  /** Paints the cursor for time t of a demo whose info is { duration, cursor, keys }. */
  function draw(t, info) {
    const keys = info.cursor || [];
    if (!keys.length) { layer.style.visibility = 'hidden'; return; }
    layer.style.visibility = '';
    const sr = stage.getBoundingClientRect();
    // the loop closes on the first keyframe at the end of the demo
    const list = [...keys, { ...keys[0], t: info.duration, click: false, down: false, up: false, carry: undefined, drop: false }];
    let pos = point(list[0], sr);
    let pressed = false;
    for (let i = 0; i < list.length - 1; i++) {
      const a = list[i];
      const b = list[i + 1];
      if (t < a.t) break;
      if (t >= b.t) { pos = point(b, sr); continue; }
      const pa = point(a, sr);
      const pb = point(b, sr);
      let s;
      if (a.down && b.up) { s = easeIn(clamp01((t - a.t) / (b.t - a.t))); pressed = true; }
      else { const move = Math.min(GLIDE, b.t - a.t); s = smooth(clamp01((t - (b.t - move)) / move)); }
      pos = { x: pa.x + (pb.x - pa.x) * s, y: pa.y + (pb.y - pa.y) * s };
      break;
    }
    // clicks: a short press and a ring that grows and fades
    let ringP = -1;
    for (const k of keys) {
      if (!k.click) continue;
      if (Math.abs(t - k.t) < 0.07) pressed = true;
      const p = (t - k.t) / 0.4;
      if (p >= 0 && p < 1) { ringP = p; ring.style.left = `${point(k, sr).x}px`; ring.style.top = `${point(k, sr).y}px`; }
    }
    pointer.style.transform = `translate(${pos.x.toFixed(1)}px, ${pos.y.toFixed(1)}px) scale(${pressed ? 0.86 : 1})`;
    if (ringP >= 0) {
      ring.style.visibility = '';
      ring.style.opacity = (0.55 * (1 - ringP)).toFixed(3);
      ring.style.transform = `translate(-50%, -50%) scale(${(0.4 + 1.1 * smooth(ringP)).toFixed(3)})`;
    } else ring.style.visibility = 'hidden';
    // a carried file from `carry` until `drop`
    let carry = null;
    for (const k of keys) {
      if (k.t > t) break;
      if (k.carry) carry = k.carry;
      if (k.drop) carry = null;
    }
    if (carry) {
      chip.textContent = carry;
      chip.style.visibility = '';
      chip.style.transform = `translate(${(pos.x + 16).toFixed(1)}px, ${(pos.y + 18).toFixed(1)}px)`;
    } else chip.style.visibility = 'hidden';
    // the last key pressed, for 0.6 s
    let shown = null;
    for (const k of info.keys || []) if (k.t <= t && t - k.t < 0.6) shown = k;
    if (shown) {
      keycap.textContent = KEY_NAMES[shown.key] || shown.key;
      keycap.style.visibility = '';
      keycap.style.opacity = (1 - clamp01((t - shown.t - 0.4) / 0.2)).toFixed(3);
    } else keycap.style.visibility = 'hidden';
  }

  return { draw, remove: () => layer.remove(), layer };
}
