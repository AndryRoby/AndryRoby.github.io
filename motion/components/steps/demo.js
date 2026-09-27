// Demo for the video, 8 beats at 120 BPM (4 s): setting up a shop assistant in three steps, from
// the first one. The cursor presses the Next button on beats 1, 2.25 and 3.5: each time the line
// draws on to the next step, the finished step fills and its check draws itself, and the new
// current step lights up. After the third press every step is done; on beat 5 the button starts
// over and the list goes back to the first step. Home before beat 8, so the last frame equals the
// first. The demo expects the list to start on its first step.

/** Beats of the presses that each finish one step. */
export const PRESSES = [1, 2.25, 3.5];
/** The beat of the press that goes back to the first step. */
export const RESET = 5;

export function demo(api, B) {
  api.keep = true;
  PRESSES.forEach((b, i) => api.setStep(Math.min(api.count, i + 1), { t: B(b) }));
  api.setStep(0, { t: B(RESET) });
  // the button of the scene, or the steps themselves when there is none
  const at = api.trigger || api.root;
  const rest = { el: at, dx: 64, dy: 24 };
  return {
    duration: B(8),
    cursor: [
      { t: 0, ...rest },
      ...PRESSES.map((b) => ({ t: B(b), el: at, click: true })),
      { t: B(RESET), el: at, click: true },
      { t: B(6.2), ...rest },
    ],
  };
}
