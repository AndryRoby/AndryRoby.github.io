// Demo for the video, 8 beats at 120 BPM (4 s): the cursor clicks the trigger on beat 1 and
// the panel rises. On beat 2 it grabs the handle and pulls up: the panel follows but resists
// above its place; on release (beat 2.75) a spring brings it home. On beat 3.5 it grabs
// again and pulls down, faster and faster, 1:1; the release on beat 4.25 is a flick, so the
// spring carries that speed on and closes the panel. Home before beat 8.
// Cursor keyframes may carry down or up for the press and release of a drag.
export function demo(api, B) {
  api.keep = true;
  api.open({ t: B(1) });
  api.drag(-64, { t: B(2), duration: B(0.75), ease: 'out' });
  api.drag(api.height() * 0.45, { t: B(3.5), duration: B(0.75), ease: 'in' });
  const rest = { el: api.trigger, dx: 96, dy: 28 };
  return {
    duration: B(8),
    cursor: [
      { t: 0, ...rest },
      { t: B(0.6), el: api.trigger },
      { t: B(1), el: api.trigger, click: true },
      { t: B(1.7), el: api.handle },
      { t: B(2), el: api.handle, down: true },
      { t: B(2.75), el: api.handle, up: true },
      { t: B(3.5), el: api.handle, down: true },
      { t: B(4.25), el: api.handle, up: true },
      { t: B(5.5), ...rest },
    ],
  };
}
