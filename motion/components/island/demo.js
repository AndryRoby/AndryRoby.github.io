// Demo for the video, 8 beats at 120 BPM (4 s): the cursor clicks the trigger on beat 1 and the
// island appears as a circle that widens into "Paying…" with a spinner. On beat 2.25 it reshapes
// into "Payment received" and the check draws itself, on beat 3.5 into "Download ready" with a
// second line, and on beat 5.5 it folds into a circle and fades. Home before beat 8, so the last
// frame equals the first. The payment and the file are made up for the demo; nothing is charged.

/** The states in beats after the click; null hides the island. */
export const PAYMENT = [
  [0, { icon: 'spinner', title: 'Paying…' }],
  [1.25, { icon: 'check', title: 'Payment received', tone: 'success' }],
  [2.5, { icon: 'download', title: 'Download ready', detail: 'guide.pdf · 2.4 MB', tone: 'accent' }],
  [4.5, null],
];

export function demo(api, B) {
  api.keep = true;
  for (const [b, state] of PAYMENT) {
    if (state) api.show(state, { t: B(1 + b) });
    else api.hide({ t: B(1 + b) });
  }
  const at = api.trigger || api.el;
  const rest = { el: at, dx: 70, dy: 36 };
  return {
    duration: B(8),
    cursor: [
      { t: 0, ...rest },
      { t: B(0.6), el: at },
      { t: B(1), el: at, click: true },
      { t: B(2), ...rest },
    ],
  };
}
