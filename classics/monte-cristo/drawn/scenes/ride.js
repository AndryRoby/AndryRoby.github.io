/* Horses and carriages, shared by volumes four and five. Same kit `k`. */
import { C } from '../parts.js';

/* A horse seen from the side, hooves at y, withers h high, facing dir. */
export function horse(k, x, y, h, o) {
  o = o || {};
  const s = h / 100, d = o.dir || 1;
  const X = (dx) => x + dx * s * d, Y = (dy) => y - dy * s;
  const pts = (arr) => { const out = []; for (let i = 0; i < arr.length; i += 2) out.push(X(arr[i]), Y(arr[i + 1])); return out; };
  const coat = o.coat || { y: 0.62, r: 0.62, b: 0.5 };
  const leg = (a) => k.stroke(coat, k.poly(pts(a), true), 7 * s);
  leg([-40, 62, -44, 30, -40, 2]); leg([36, 62, 40, 30, 36, 2]);
  k.fill(coat, k.blob(pts([-52, 70, -48, 92, -10, 98, 30, 96, 52, 88, 56, 66, 40, 56, -30, 56, -50, 60])));
  k.fill(coat, k.poly(pts([38, 92, 58, 128, 70, 132, 64, 112, 52, 84])));
  k.fill(coat, k.blob(pts([58, 128, 66, 140, 82, 128, 88, 114, 80, 110, 68, 118])));
  k.fill(o.mane || C.ink, k.poly(pts([40, 94, 58, 132, 64, 136, 50, 100])));
  k.fill(o.mane || C.ink, k.poly(pts([-50, 84, -64, 60, -62, 30, -54, 60])));
  leg([-30, 60, -32, 30, -28, 2]); leg([44, 62, 50, 34, 46, 2]);
  k.add({ b: 0.25 }, k.blob(pts([-50, 64, 50, 64, 40, 56, -30, 56])));
  k.fill(C.ink, k.circ(X(76), Y(126), 1.4 * s));
  if (o.saddle) k.fill(o.saddle, k.poly(pts([-20, 96, 14, 96, 12, 84, -18, 84])));
}

/* A closed carriage on two pairs of wheels, facing dir. */
export function carriage(k, x, y, w, o) {
  o = o || {};
  const s = w / 100, d = o.dir || 1;
  const X = (dx) => x + dx * s * d, Y = (dy) => y - dy * s;
  const pts = (arr) => { const out = []; for (let i = 0; i < arr.length; i += 2) out.push(X(arr[i]), Y(arr[i + 1])); return out; };
  const body = o.body || C.ink;
  k.fill(body, k.blob(pts([-44, 26, -48, 60, -40, 70, 30, 70, 40, 58, 42, 26])));
  k.fill(o.win || { b: 0.3, y: 0.3 }, k.rect(Math.min(X(-30), X(-6)), Y(64), 24 * s, 20 * s));
  k.fill(o.win || { b: 0.3, y: 0.3 }, k.rect(Math.min(X(4), X(26)), Y(64), 22 * s, 20 * s));
  k.fill(o.trim || C.gold, k.rect(Math.min(X(-46), X(42)), Y(30), 88 * s, 2.4 * s));
  k.fill(body, k.poly(pts([40, 44, 60, 50, 64, 46, 44, 40])));
  const wheel = (cx, r) => {
    k.stroke(o.wheel || C.gold, k.circ(X(cx), Y(r), r * s), 3 * s);
    const sp = k.P();
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; sp.moveTo(X(cx), Y(r)); sp.lineTo(X(cx) + Math.cos(a) * r * s, Y(r) + Math.sin(a) * r * s); }
    k.stroke(o.wheel || C.gold, sp, 1.4 * s);
    k.fill(C.dark, k.circ(X(cx), Y(r), 3 * s));
  };
  wheel(-32, 22); wheel(34, 16);
  k.stroke(C.dark, k.poly(pts([50, 20, 100, 30]), true), 2 * s);
}
