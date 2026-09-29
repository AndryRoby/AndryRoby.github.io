// Kreslené ikonky vecí pre stopy a odpovede (28. 9. 2026, Fable): jednoduché ťahy 24 x 24, farba z currentColor.
const P = {
  'the lantern': '<path d="M9 4h6M10 4V2.8h4V4M8 6h8l-1 2v9l1 2H8l1-2V8z"/><path d="M12 10.5c-1.2 1.4-1.2 3 0 4 1.2-1 1.2-2.6 0-4z"/>',
  'the picnic basket': '<path d="M4 10h16l-2 9H6z"/><path d="M8 10a4 4 0 0 1 8 0"/><path d="M5.5 14h13"/>',
  'the brass key': '<circle cx="7.5" cy="12" r="3.5"/><path d="M11 12h9M17 12v3M20 12v2"/>',
  'the prize pumpkin': '<path d="M12 7c-5 0-7 3-7 6.5S7.5 19 12 19s7-2 7-5.5S17 7 12 7z"/><path d="M12 7c-2 2-2 10 0 12M12 7c2 2 2 10 0 12M12 7c0-2 1-3 2.5-3.5"/>',
  'the recipe book': '<path d="M5 5h9a3 3 0 0 1 3 3v11H8a3 3 0 0 1-3-3z"/><path d="M5 16a3 3 0 0 1 3-3h9M9 8h5"/>',
  'the teapot': '<path d="M6 11h10v3a5 5 0 0 1-10 0z"/><path d="M16 12h1.5a2 2 0 0 1 0 4H15M6 13l-3-3M9 11V9h4v2M11 7v2"/>',
  'the fishing rod': '<path d="M4 20L18 4M18 4v10"/><path d="M18 14a2 2 0 1 1-2 2"/><circle cx="7" cy="17" r="1.5"/>',
  'the umbrella': '<path d="M3 12a9 9 0 0 1 18 0z"/><path d="M12 12v6a2 2 0 0 1-4 0M12 3v1"/>',
  'the old map': '<path d="M4 6l5-2 6 2 5-2v14l-5 2-6-2-5 2z"/><path d="M9 4v14M15 6v14"/>',
  'the violin': '<path d="M12 2.5v4.5"/><path d="M10 7h4c1 1 1 2.5 0 3.5 1.5 1 2 2.5 2 4a4 4 0 0 1-8 0c0-1.5.5-3 2-4-1-1-1-2.5 0-3.5z"/><path d="M11 12.5h2M11 15h2"/>',
};
export function ikona(vec, trieda = 'case-ik') {
  const d = P[vec];
  return d ? `<svg class="${trieda}" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>` : '';
}
export const VECI_S_IKONOU = Object.keys(P);
