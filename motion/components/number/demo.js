// Demo for the video, 8 beats at 120 BPM (4 s): a price that a shop owner would watch.
// 0 rolls up to 69.08 (one sale), then 897.73 (the month), then 1,204.50 (a new digit opens
// on the left), then back to 0 before beat 8, so the last frame equals the first.
const STEPS = [[1, 69.08], [2.5, 897.73], [4, 1204.5], [5.5, 0]];

export function demo(api, B) {
  api.keep = true;
  for (const [b, v] of STEPS) api.set(v, { t: B(b) });
  return {
    duration: B(8),
    cursor: [{ t: 0, el: api.el }],
  };
}
