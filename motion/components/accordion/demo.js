// Demo for the video, 8 beats at 120 BPM (4 s): the cursor opens the first section on
// beat 1 (the panel unfolds, rows enter after the edge passes them), opens the second on
// beat 3 (in single mode the first folds at the same time) and closes it on beat 5. With
// multiple open panels allowed it also closes the first on beat 6. Home before beat 8.
export function demo(api, B) {
  api.keep = true;
  const [a, b] = api.triggers;
  const second = b || a;
  const i2 = api.triggers.indexOf(second);
  api.open(0, { t: B(1) });
  api.open(i2, { t: B(3) });
  api.close(i2, { t: B(5) });
  const rest = { el: a, dx: 60, dy: 0 };
  const cursor = [
    { t: 0, ...rest },
    { t: B(1), ...rest, click: true },
    { t: B(2.4), el: second, dx: 60, dy: 0 },
    { t: B(3), el: second, dx: 60, dy: 0, click: true },
    { t: B(5), el: second, dx: 60, dy: 0, click: true },
  ];
  if (api.multiple && i2 !== 0) {
    api.close(0, { t: B(6) });
    cursor.push({ t: B(6), ...rest, click: true });
  } else {
    cursor.push({ t: B(6), ...rest });
  }
  return { duration: B(8), cursor };
}
