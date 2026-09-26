// Demo for the video, 8 beats at 120 BPM (4 s): the cursor grabs the strip on beat 1 and
// flicks it left by a little under one slide, faster and faster; the release on beat 1.6
// throws it on, so the spring carries the speed and snaps two slides further. Previous is
// clicked on beats 4 and 5 and the strip glides back to the first slide. Home before beat 8.
// Cursor keyframes may carry down or up for the press and release of a drag.
export function demo(api, B) {
  api.keep = true;
  const step = api.step();
  const pull = -0.9 * step;
  const start = 100;
  api.drag(pull, { t: B(1), duration: B(0.6), ease: 'in' });
  api.prev({ t: B(4) });
  api.prev({ t: B(5) });
  const rest = { el: api.viewport, dx: start, dy: 0 };
  const back = api.prevButton || api.viewport;
  return {
    duration: B(8),
    cursor: [
      { t: 0, ...rest },
      { t: B(1), ...rest, down: true },
      { t: B(1.6), el: api.viewport, dx: start + pull, dy: 0, up: true },
      { t: B(3.4), el: back },
      { t: B(4), el: back, click: true },
      { t: B(5), el: back, click: true },
      { t: B(6), ...rest },
    ],
  };
}
