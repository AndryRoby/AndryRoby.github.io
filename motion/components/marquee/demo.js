// Demo for the video, 8 beats at 120 BPM (4 s). The band runs. The pointer comes to rest on it
// by beat 1 and the band coasts to a stop under it; the pointer leaves by beat 2.75 and the band
// picks up speed again. On beat 3.5 Tab moves focus into the band: it stops and glides the first
// item into view with its focus ring. Shift+Tab on beat 5.25 moves focus out and the band runs
// again, at full speed well before beat 8. loop(4 s) picks where the band starts so that the
// ride and the glide add up to whole rounds: the last frame equals the first.

/** Beats when the pointer crosses into the band on its way in and out of it on its way back. */
export const HOVER = [0.55, 2.3];
/** Beats of Tab (focus to the first item) and Shift+Tab (focus leaves the band). */
export const FOCUS = [3.5, 5.25];

export function demo(api, B) {
  api.keep = true;
  api.hover(true, { t: B(HOVER[0]) });
  api.hover(false, { t: B(HOVER[1]) });
  api.focusItem(0, { t: B(FOCUS[0]) });
  api.blur({ t: B(FOCUS[1]) });
  api.loop(B(8));
  // the cursor rests below the band (not over it) and aims at the viewport, which does not move
  const rest = { el: api.root, dx: 0, dy: 44 };
  return {
    duration: B(8),
    cursor: [
      { t: 0, ...rest },
      { t: B(1), el: api.viewport, dx: -24, dy: 0 },
      { t: B(2.75), ...rest },
    ],
    keys: [
      { t: B(FOCUS[0]), key: 'Tab' },
      { t: B(FOCUS[1]), key: 'Shift+Tab' },
    ],
  };
}
