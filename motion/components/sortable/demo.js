// Demo for the video, 8 beats at 120 BPM (4 s): a list of four tasks. On beat 1 the cursor takes
// the handle of the third task and drags it up to the top by beat 2.25; the tasks above make room
// on a spring as it passes their middle, and it is let go a little short of the top, so it lands
// there on its own spring. On beats 3.25 to 5.5 the keyboard carries it back: Space picks it up,
// Down twice moves it, Space drops it. Home before beat 8, so the last frame equals the first.

/** The position of the task the demo drags (0 is the first). */
export const FROM = 2;
/** The drag is let go this many px before the top place, so the landing shows. */
export const SHORT = 12;

export function demo(api, B) {
  api.keep = true;
  const order = api.order();
  const item = order[Math.min(FROM, order.length - 1)];
  const from = order.indexOf(item);
  const dy = api.travel(item, 0) + (from > 0 ? SHORT : 0);
  const grab = api.offsetOf(item);
  const letGo = api.offsetOf(item, dy);
  api.drag(item, dy, { t: B(1), duration: B(1.25), ease: 'inOut' });
  const keys = [[3.25, ' '], [4, 'ArrowDown'], [4.75, 'ArrowDown'], [5.5, ' ']];
  for (const [b, key] of keys) api.key(key, { t: B(b), item });
  // the cursor aims at the list, which does not move, with the handle's offset
  const at = (p, more = {}) => ({ el: api.list, dx: p.dx, dy: p.dy, ...more });
  const rest = at({ dx: grab.dx + 64, dy: grab.dy + 30 });
  return {
    duration: B(8),
    cursor: [
      { t: 0, ...rest },
      { t: B(1), ...at(grab), down: true, ease: 'inOut' },
      { t: B(2.25), ...at(letGo), up: true },
      { t: B(2.9), ...rest },
    ],
    keys: keys.map(([b, key]) => ({ t: B(b), key })),
  };
}
