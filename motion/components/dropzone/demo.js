// Demo for the video, 8 beats at 120 BPM (4 s): the cursor picks up a file on beat 1 and
// carries it over the zone (the border switches on beat 1.5), drops it on beat 2 and the
// zone unfolds into a list of three rows, each entering after the edge reaches it. On beat
// 5.5 it clicks Clear: the rows leave from the last one back and the list folds into the
// zone. Home before beat 8.
// The files are made up for the demo. Cursor keyframes may carry a file (carry, drop).
const FILES = [
  { name: 'brief.pdf', size: 248 * 1024 },
  { name: 'logo.svg', size: 14 * 1024 },
  { name: 'photos.zip', size: 18.6 * 1024 * 1024 },
];

export function demo(api, B) {
  api.keep = true;
  api.over(true, { t: B(1.5) });
  api.over(false, { t: B(2) });
  api.add(FILES, { t: B(2) });
  api.clear({ t: B(5.5) });
  const rest = { el: api.root, dx: 150, dy: 110 };
  return {
    duration: B(8),
    cursor: [
      { t: 0, ...rest },
      { t: B(1), ...rest, carry: `${FILES.length} files` },
      { t: B(1.5), el: api.root, dx: 40, dy: 10 },
      { t: B(2), el: api.root, dx: 40, dy: 10, drop: true },
      { t: B(4.8), el: api.clearButton },
      { t: B(5.5), el: api.clearButton, click: true },
      { t: B(6), ...rest },
    ],
  };
}
