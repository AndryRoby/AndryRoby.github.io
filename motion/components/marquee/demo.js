// Demo for the video, 8 beats at 120 BPM (4 s). The band flows at full speed. The pointer comes
// up from below and crosses into the band on beat 1.5; the band coasts to a stop under it. On
// beat 3.25 Tab moves focus to the first item: its ring shows and the band glides it to the
// middle. Shift+Tab on beat 5 takes focus out, the pointer leaves on beat 5.4 and the band picks
// up speed again, at full speed before beat 8. loop(4 s) picks where the band starts so that the
// ride and the glide add up to whole rounds: the last frame equals the first.

/** Beats when the pointer crosses into the band on its way in and out of it on its way back. */
export const HOVER = [1.5, 5.4];
/** Beats of Tab (focus to the first item) and Shift+Tab (focus leaves the band). */
export const FOCUS = [3.25, 5];

export function demo(api, B) {
  api.keep = true;
  api.hover(true, { t: B(HOVER[0]) });
  api.focusItem(0, { t: B(FOCUS[0]) });
  api.blur({ t: B(FOCUS[1]) });
  api.hover(false, { t: B(HOVER[1]) });
  api.loop(B(8));
  // the cursor rests below the band and right of the keycaps, and aims at the band, which does not move
  const rest = { el: api.viewport, dx: 72, dy: 40 };
  return {
    duration: B(8),
    cursor: [
      { t: 0, ...rest },
      { t: B(2), el: api.viewport, dx: -24, dy: 0 },
      { t: B(5.75), ...rest },
    ],
    keys: [
      { t: B(FOCUS[0]), key: 'Tab' },
      { t: B(FOCUS[1]), key: 'Shift+Tab' },
    ],
  };
}
