// Demo for the video, 8 beats at 120 BPM (4 s): the search is typed letter by letter
// between beats 1 and 2 (rows that stop matching leave, the rest slide up, the list
// shortens), Down on beat 3 stretches the highlight to the next row, Enter on beat 4 gives
// it a short press, and on beat 5 Escape clears the search, so every row comes back and the
// highlight returns to the first. Home before beat 8.
// The query comes from data-demo-query on the root (default "new").
export function demo(api, B) {
  api.keep = true;
  const q = api.root.getAttribute('data-demo-query') || 'new';
  const gap = q.length > 1 ? B(1) / (q.length - 1) : 0;
  const keys = [];
  for (let k = 1; k <= q.length; k++) {
    const t = B(1) + (k - 1) * gap;
    api.search(q.slice(0, k), { t });
    keys.push({ t, key: q[k - 1] });
  }
  api.move(1, { t: B(3) });
  keys.push({ t: B(3), key: 'ArrowDown' });
  api.select(undefined, { t: B(4) });
  keys.push({ t: B(4), key: 'Enter' });
  api.search('', { t: B(5) });
  keys.push({ t: B(5), key: 'Escape' });
  // the command menu is driven by the keyboard: the cursor rests to the right of the field
  // and keys lists the keystrokes a renderer may show as captions
  return {
    duration: B(8),
    cursor: [{ t: 0, el: api.input, dx: 150, dy: 0 }],
    keys,
  };
}
