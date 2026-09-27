// Demo for the video, 8 beats at 120 BPM (4 s): a plan picker that starts on its middle option.
// The cursor clicks the last option on beat 1 (the thumb travels and changes width on the way),
// the first option on beat 2.5, and, while the thumb is still on its way there, the middle
// option again on beat 2.85: the thumb turns around from its current speed instead of starting
// over. Home before beat 8, so the last frame equals the first.

/** [beat, which option]: 'last', 'first' or 'start' (the option chosen at first). */
export const CLICKS = [[1, 'last'], [2.5, 'first'], [2.85, 'start']];

export function demo(api, B) {
  api.keep = true;
  const start = api.selected();
  const pick = { last: api.items.length - 1, first: 0, start };
  for (const [b, which] of CLICKS) api.select(pick[which], { t: B(b) });
  const rest = { el: api.items[start], dx: 22, dy: 34 };
  return {
    duration: B(8),
    cursor: [
      { t: 0, ...rest },
      ...CLICKS.map(([b, which]) => ({ t: B(b), el: api.items[pick[which]], click: true })),
      { t: B(4.5), ...rest },
    ],
  };
}
