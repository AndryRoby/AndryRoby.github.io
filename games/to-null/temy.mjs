// TO: NULL: farby troch tém (SPEC 3.2). Tie isté hodnoty sú v hra.css; test 24 overí zhodu aj kontrast.
// Canvas číta farby odtiaľto (žiadne getComputedStyle v ceste snímky).

export const TEMY = {
  green: {
    bg: '#030805', panel: '#07120B', raised: '#0C1F14', fos: '#39FF88', 'fos-2': '#2FBF6A', 'fos-3': '#27995A',
    frame: '#1E7A45', hot: '#D8FFE6', gc: '#FFB347', keeper: '#8FD3FF', letter: '#FFF1DC', burn: '#0E2A1A', 'burn-glow': '#6BE3A0',
  },
  amber: {
    bg: '#080502', panel: '#120C05', raised: '#1F1408', fos: '#FFB000', 'fos-2': '#D9951A', 'fos-3': '#B87A12',
    frame: '#9A6212', hot: '#FFE7B8', gc: '#39FF88', keeper: '#8FD3FF', letter: '#FFF1DC', burn: '#2A1A06', 'burn-glow': '#FFC25E',
  },
  rose: {
    bg: '#080307', panel: '#12070F', raised: '#1F0C19', fos: '#FF7AC8', 'fos-2': '#E06AAF', 'fos-3': '#C9609E',
    frame: '#A04A7D', hot: '#FFE0F1', gc: '#FFC46B', keeper: '#8FD3FF', letter: '#FFF1DC', burn: '#2A0F20', 'burn-glow': '#FF9FD6',
  },
};

export const TEXTOVE = ['fos', 'fos-2', 'fos-3', 'hot', 'gc', 'keeper', 'letter'];
export const PLOCHY = ['bg', 'panel', 'raised'];

export function rgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function hex([r, g, b]) {
  return '#' + [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function mix(a, b, t) {
  const A = rgb(a);
  const B = rgb(b);
  return hex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}

function lin(c) {
  const x = c / 255;
  return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

export function jas(h) {
  const [r, g, b] = rgb(h);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function kontrast(a, b) {
  const x = jas(a);
  const y = jas(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** 8 odtieňov stopy: hot, hneď sýty fosfor, potom k burn (lineárny mix bol sivý). */
export function odtiene(t) {
  return [t.hot, mix(t.hot, t.fos, 0.55), t.fos, t['fos-2'], t['fos-3'],
    mix(t['fos-3'], t.burn, 0.35), mix(t['fos-3'], t.burn, 0.6), mix(t['fos-3'], t.burn, 0.8)];
}
