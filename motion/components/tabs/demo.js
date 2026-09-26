// Demo for the video, 8 beats at 120 BPM (4 s): three clicks on beats 2, 4 and 6
// (second tab, third tab, back to the first). The indicator stretches toward each tab and
// the trailing edge catches up; everything is home before beat 8, so the loop is seamless.
export function demo(api, B) {
  api.keep = true;
  const [a, b, c] = api.tabs;
  const third = c || b;
  api.select(1, { t: B(2) });
  api.select(api.tabs.indexOf(third), { t: B(4) });
  api.select(0, { t: B(6) });
  return {
    duration: B(8),
    cursor: [
      { t: 0, el: a },
      { t: B(1.4), el: b },
      { t: B(2), el: b, click: true },
      { t: B(3.4), el: third },
      { t: B(4), el: third, click: true },
      { t: B(5.4), el: a },
      { t: B(6), el: a, click: true },
    ],
  };
}
