// Demo for the video, 8 beats at 120 BPM (4 s): the field takes focus on beat 0.5 (the ring
// appears on the first slot), six digits arrive every half beat from beat 1 to beat 3.5,
// each entering its own slot while the ring slides ahead; on beat 4 the code is verified and
// the row turns green as one circle growing from the last digit. The field lets go of focus
// on beat 5 and is cleared on beat 5.5: the digits leave from the last one back and the
// plain colour grows back from the first slot. Home before beat 8.
// The code comes from data-demo-code on the root (default 428193, made up for the demo).
export function demo(api, B) {
  api.keep = true;
  const n = api.slots.length;
  const code = (api.root.getAttribute('data-demo-code') || '428193').slice(0, n).padEnd(n, '0');
  api.focus({ t: B(0.5) });
  api.type(code, { t: B(1), every: B(0.5) });
  api.success({ t: B(4) });
  api.blur({ t: B(5) });
  api.clear({ t: B(5.5) });
  // typed, not clicked: the cursor rests below the field and keys can become captions
  return {
    duration: B(8),
    cursor: [{ t: 0, el: api.root, dx: 0, dy: 72 }],
    keys: [...code].map((c, k) => ({ t: B(1) + k * B(0.5), key: c })),
  };
}
