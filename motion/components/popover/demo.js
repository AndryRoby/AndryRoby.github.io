// Demo for the video, 8 beats at 120 BPM (4 s), on the dropdown menu: the cursor clicks
// the trigger on beat 1 and the menu unfolds with its items entering one after another;
// the cursor passes over the second and third items on beats 2 and 3 (one highlight
// slides along) and picks the third on beat 4, which closes the menu. Home before beat 8.
export function demo(api, B) {
  api.keep = true;
  const items = api.items;
  const second = items[1] || items[0];
  const third = items[2] || second;
  api.open({ t: B(1) });
  api.highlight(items.indexOf(second), { t: B(2) });
  api.highlight(items.indexOf(third), { t: B(3) });
  api.select(items.indexOf(third), { t: B(4) });
  const rest = { el: api.trigger, dx: 72, dy: 0 };
  return {
    duration: B(8),
    cursor: [
      { t: 0, ...rest },
      { t: B(0.6), el: api.trigger },
      { t: B(1), el: api.trigger, click: true },
      { t: B(2), el: second },
      { t: B(3), el: third },
      { t: B(4), el: third, click: true },
      { t: B(5), ...rest },
    ],
  };
}
