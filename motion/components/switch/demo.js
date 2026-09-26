// Demo for the video, 8 beats at 120 BPM (4 s): the cursor rests on the switch and clicks
// on beats 1, 3, 4 and 6 (on, off, on, off). Each press stretches the thumb, each change
// grows the new colour as a circle from the thumb. Home before beat 8.
const CLICKS = [1, 3, 4, 6];

export function demo(api, B) {
  api.keep = true;
  CLICKS.forEach((b, i) => {
    api.press({ t: B(b) - 0.12 });
    api.release({ t: B(b) });
    api.set(i % 2 === 0, { t: B(b) });
  });
  return {
    duration: B(8),
    cursor: [
      { t: 0, el: api.el },
      ...CLICKS.map((b) => ({ t: B(b), el: api.el, click: true })),
    ],
  };
}
