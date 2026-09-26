// Demo for the video, 8 beats at 120 BPM (4 s): the cursor rests on the first icon for
// half a beat (the hover delay), its tooltip enters on beat 1, then the cursor passes over
// the second and third icons on beats 2 and 3 and the same bubble slides along. The cursor
// leaves, the tooltip hides on beat 5 and is gone well before the loop point.
export function demo(api, B) {
  api.keep = true;
  const [a, b, c] = api.triggers;
  const third = c || b || a;
  const second = b || a;
  api.show(0, { t: B(1) });
  api.show(api.triggers.indexOf(second), { t: B(2) });
  api.show(api.triggers.indexOf(third), { t: B(3) });
  api.hide({ t: B(5) });
  const rest = { el: a, dx: 0, dy: 56 };
  return {
    duration: B(8),
    cursor: [
      { t: 0, ...rest },
      { t: B(0.5), el: a },
      { t: B(2), el: second },
      { t: B(3), el: third },
      { t: B(4), el: third },
      { t: B(5), ...rest },
    ],
  };
}
