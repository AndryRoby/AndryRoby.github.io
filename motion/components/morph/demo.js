// Demo for the video, 8 beats at 120 BPM (4 s): the cursor clicks the card on beat 1 and the card
// grows into the dialog while its own text fades and the dialog's content enters. The cursor
// moves to Close and clicks on beat 4.75; the dialog folds back into the card and the card's
// text returns before it lands. Everything is home before beat 8, so the loop is seamless.
export function demo(api, B) {
  api.keep = true;
  const close = api.content.querySelector('[data-am-close]') || api.content.querySelector('button, [href]') || api.panel;
  api.open({ t: B(1) });
  api.close({ t: B(4.75) });
  const rest = { el: api.trigger, dx: 60, dy: 22 };
  return {
    duration: B(8),
    cursor: [
      { t: 0, ...rest },
      { t: B(0.6), el: api.trigger },
      { t: B(1), el: api.trigger, click: true },
      { t: B(4.3), el: close },
      { t: B(4.75), el: close, click: true },
      { t: B(6), ...rest },
    ],
  };
}
