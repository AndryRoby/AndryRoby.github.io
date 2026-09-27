// Demo for the video, 8 beats at 120 BPM (4 s): conversations per month, 0 to 2,000 in steps of
// 50, starting at 400. The cursor takes the thumb on beat 1 (it grows) and drags it to 1,200 by
// beat 2.25; on release the thumb settles on the step and springs back to its size. The Right
// arrow on beats 3 and 3.5 adds 50 twice, and a press on the track at the starting value on
// beat 5 glides the thumb back. Home before beat 8, so the last frame equals the first.

/** Where the drag ends. */
export const TO = 1200;

const count = new Intl.NumberFormat('en-US');
/** The bubble text of the demo scene, for example "1,200 conversations". */
export const conversations = (v) => `${count.format(v)} conversations`;

export function demo(api, B) {
  api.keep = true;
  const from = api.value();
  const to = Math.min(TO, api.bounds.max);
  api.drag(to, { t: B(1), duration: B(1.25), ease: 'in' });
  api.key('ArrowRight', { t: B(3) });
  api.key('ArrowRight', { t: B(3.5) });
  api.tap(from, { t: B(5) });
  // the cursor aims at the root, which does not move, with the thumb's offset at a value
  const at = (v, more = {}) => ({ el: api.root, dx: api.offsetOf(v), dy: 0, ...more });
  const rest = at(from, { dy: 26 });
  return {
    duration: B(8),
    cursor: [
      { t: 0, ...rest },
      { t: B(1), ...at(from), down: true },
      { t: B(2.25), ...at(to), up: true },
      { t: B(2.9), ...at(to, { dy: 30 }) },
      { t: B(5), ...at(from), click: true },
      { t: B(6), ...rest },
    ],
    keys: [
      { t: B(3), key: 'ArrowRight' },
      { t: B(3.5), key: 'ArrowRight' },
    ],
  };
}
