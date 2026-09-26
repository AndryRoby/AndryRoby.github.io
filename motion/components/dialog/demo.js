// Demo for the video, 8 beats at 120 BPM (4 s): the cursor clicks the button on beat 1,
// the button grows into the dialog, the cursor moves to Cancel, clicks on beat 5 and the
// dialog closes back into the button. Everything is home before beat 8, so the loop is seamless.
export function demo(api, B) {
  api.keep = true;
  const cancel = api.content.querySelector('[data-am-close]') || api.content.querySelector('button') || api.panel;
  api.open({ t: B(1) });
  api.close({ t: B(5) });
  const rest = { el: api.trigger, dx: 64, dy: 44 };
  return {
    duration: B(8),
    cursor: [
      { t: 0, ...rest },
      { t: B(0.6), el: api.trigger },
      { t: B(1), el: api.trigger, click: true },
      { t: B(3.6), el: cancel },
      { t: B(5), el: cancel, click: true },
      { t: B(6), ...rest },
    ],
  };
}
