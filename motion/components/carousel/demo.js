// Demo for the video, 8 beats at 120 BPM (4 s). The carousel rests on its slide (the scene on
// arling.sk/motion starts on the second of five, so both neighbours peek out under the fade).
// On beat 1 the cursor grabs the middle slide and flicks it left by 0.8 of a step, faster and
// faster; on the release (beat 1.44) the spring keeps that speed and lands two slides on without
// a wobble, while the dots indicator stretches across the dots. Previous on beat 4 and again on
// beat 4.6, while the strip is still gliding, brings it back to where it started; the second
// press continues from the current speed. Home before beat 8, so the last frame equals the first.
// Cursor keyframes may carry down or up for the press and release of a drag.

/** How far the flick drags the strip before the release, in steps (one step is one slide). */
export const FLICK_STEPS = 0.8;
/** How long the flick takes, in beats. */
export const FLICK_BEATS = 0.44;
/** How far right of the middle of the viewport the cursor rests, px (on the middle slide). */
const REST_DX = 90;

export function demo(api, B) {
  api.keep = true;
  const start = api.index();
  const pull = -FLICK_STEPS * api.step();
  const release = B(1 + FLICK_BEATS);
  api.drag(pull, { t: B(1), duration: B(FLICK_BEATS), ease: 'in' });
  const back = api.index(release) - start;
  const presses = [];
  for (let k = 0; k < back; k++) presses.push(B(4 + 0.6 * k));
  for (const t of presses) api.prev({ t });
  const rest = { el: api.viewport, dx: REST_DX, dy: 0 };
  const button = api.prevButton || api.viewport;
  return {
    duration: B(8),
    cursor: [
      { t: 0, ...rest },
      { t: B(1), ...rest, down: true },
      { t: release, el: api.viewport, dx: REST_DX + pull, dy: 0, up: true },
      ...(presses.length ? [{ t: B(3.4), el: button }] : []),
      ...presses.map((t) => ({ t, el: button, click: true })),
      { t: B(6), ...rest },
    ],
  };
}
