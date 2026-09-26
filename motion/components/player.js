/*
 * Demo player for ARLing Motion components.
 *
 * Every component exports demo(api, B) from its demo.js. The demo schedules 8 beats of
 * changes (120 BPM, B(1) = 0.5 s) on a component whose driver runs on a clock you give it.
 * The last frame equals the first, so the demo loops.
 *
 *   // live, looping on the page
 *   playDemo((clock) => createTabs({ root, clock }), demo);
 *
 *   // video: paint any time t, frame by frame
 *   const s = seekDemo((clock) => createTabs({ root, clock, reduced: false }), demo);
 *   s.seek(1.25);
 *
 * demo() returns { duration, cursor }, where cursor is a list of { t, el, click? } keyframes
 * a renderer can use to draw a pointer that aims at the element at time t.
 */
import { beats } from '../src/core.js';

export const DEMO_BEATS = 8;

/** A clock in seconds that wraps every duration seconds. */
export function loopClock(duration, now = () => performance.now() / 1000) {
  const t0 = now();
  return () => (now() - t0) % duration;
}

/** Plays a demo live in a loop. create(clock) must build the component with that clock. */
export function playDemo(create, demo, { bpm = 120, length = DEMO_BEATS } = {}) {
  const B = beats(bpm);
  const clock = loopClock(B(length));
  const api = create(clock);
  const info = demo(api, B);
  api.driver.busy = () => true;
  api.driver.kick();
  return { api, info, stop: () => api.driver.stop() };
}

/** Builds a demo for frame by frame rendering: seek(t) paints the component at time t. */
export function seekDemo(create, demo, { bpm = 120 } = {}) {
  let now = 0;
  const api = create(() => now);
  const info = demo(api, beats(bpm));
  return {
    api,
    info,
    seek(t) {
      now = t;
      api.seek(t);
    },
  };
}
