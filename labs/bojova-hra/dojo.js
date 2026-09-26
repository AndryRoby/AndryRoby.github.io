// Tumble Dojo: šesť dojo (V3-NAVRH 3.4), tlačené raz do pozadia. Tvary podľa products/arling-sk/games/village/
// (iso.js, svet.js, 25. 9. 2026). Bez symbolov a písmen.
const TAU = 6.2832;
const box = (p, ink, a, x0, y0, x1, y1) => p.poly(ink, a, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
// animácie diorámy: [typ 1 dym, 2 kruhy, 3 svetluška, x, y, veľkosť]
export const DA = { n: 0, s: 1, a: new Float32Array(96) };
const em = (t, x, y, v) => { if (DA.n < 96) { DA.a.set([t, x, y, v], DA.n); DA.n += 4; } };
function strom(p, x, y, s, ink = 'green', ovocie = 0) {
  p.ellipse('night', 0.14, x + 5 * s, y + 1.5 * s, 12 * s, 4 * s);
  p.poly('orange', 0.65, [[x - 1.8 * s, y], [x + 1.8 * s, y], [x + 1.2 * s, y - 13 * s], [x - 1.2 * s, y - 13 * s]]);
  const r = 9.5 * s, cy = y - 19 * s;
  const kor = (c, ox, oy) => { for (const [dx, dy, rr] of [[-4.5, 2, 0.8], [4.5, 1.5, 0.78], [0, -4.5, 0.92]]) { c.moveTo(x + dx * s + r * rr + ox, cy + dy * s + oy); c.arc(x + dx * s + ox, cy + dy * s + oy, r * rr, 0, TAU); } };
  p.path('paper', 1, kor); p.path(ink, 0.8, kor);
  p.ellipse('teal', 0.25, x + 3 * s, cy + 3 * s, r * 0.7, r * 0.5);
  for (let k = 0; k < ovocie; k++) p.circle(k & 1 ? 'orange' : 'pink', 0.95, x + Math.cos(k * 2.3) * r * 0.9, cy + Math.sin(k * 2.3) * r * 0.55, 1.5 * s);
}
function borovica(p, x, y, s) {
  p.ellipse('night', 0.14, x + 4 * s, y + 1.5 * s, 10 * s, 3.5 * s);
  p.poly('orange', 0.6, [[x - 1.6 * s, y], [x + 1.6 * s, y], [x + 1.2 * s, y - 8 * s], [x - 1.2 * s, y - 8 * s]]);
  const t = (c, ox, oy) => { for (let k = 0; k < 3; k++) { const yy = y - 6 * s - k * 7.5 * s, w = (11 - k * 2.6) * s; c.moveTo(x - w + ox, yy + oy); c.lineTo(x + w + ox, yy + oy); c.lineTo(x + ox, yy - 13 * s + oy); c.closePath(); } };
  p.path('paper', 1, t); p.path('teal', 0.85, t); p.path('green', 0.25, t);
}
function lampa(p, x, y, s, sviet) {
  if (sviet) p.circle('sun', 0.22, x, y - 26 * s, 9 * s);
  p.line('night', 0.75, 1.5 * s, [[x, y], [x, y - 22 * s]], 'butt');
  p.poly('night', 0.8, [[x - 3.2 * s, y - 22 * s], [x + 3.2 * s, y - 22 * s], [x + 2 * s, y - 30 * s], [x - 2 * s, y - 30 * s]]);
  p.poly('sun', 0.9, [[x - 2.2 * s, y - 23 * s], [x + 2.2 * s, y - 23 * s], [x + 1.4 * s, y - 28.5 * s], [x - 1.4 * s, y - 28.5 * s]]);
}
function trstina(p, x, y, s) {
  for (let k = 0; k < 4; k++) { const dx = (k - 1.5) * 2.6 * s, h = (9 + (k % 2) * 4) * s; p.line('green', 0.85, s, [[x + dx, y], [x + dx + (k - 1.5) * 0.9 * s, y - h]]); }
  p.ellipse('orange', 0.85, x + 1.4 * s, y - 12 * s, 1.1 * s, 3 * s);
}
function dom(p, x, y, w, h, s, strecha, sviet) {
  p.ellipse('night', 0.12, x + w * 0.1, y + 2 * s, w * 0.62, 4 * s);
  box(p, 'paper', 1, x - w / 2, y - h, x + w / 2, y); box(p, 'orange', 0.35, x - w / 2, y - h, x + w / 2, y);
  for (let k = 1; k < 4; k++) p.line('orange', 0.5, 0.8 * s, [[x - w / 2, y - h * k / 4], [x + w / 2, y - h * k / 4]]);
  const roof = [[x - w * 0.62, y - h], [x + w * 0.62, y - h], [x + w * 0.4, y - h - h * 0.55], [x - w * 0.4, y - h - h * 0.55]];
  p.poly('paper', 1, roof); p.poly(strecha, 0.8, roof); p.line('night', 0.35, 0.8 * s, [[x - w * 0.62, y - h], [x + w * 0.62, y - h]]);
  box(p, 'night', 0.55, x - w * 0.1, y - h * 0.6, x + w * 0.1, y);
  box(p, sviet ? 'sun' : 'paper', sviet ? 0.9 : 1, x + w * 0.2, y - h * 0.7, x + w * 0.36, y - h * 0.42);
  p.line('night', 0.5, 0.8 * s, [[x + w * 0.2, y - h * 0.7], [x + w * 0.36, y - h * 0.7], [x + w * 0.36, y - h * 0.42], [x + w * 0.2, y - h * 0.42], [x + w * 0.2, y - h * 0.7]]);
}
// komín z tehál so strieškou; dym z neho kreslí animácia (em typ 1)
function komin(p, x, y0, y1, s) { box(p, 'paper', 1, x - 3 * s, y1, x + 3 * s, y0); box(p, 'orange', 0.7, x - 3 * s, y1, x + 3 * s, y0); box(p, 'night', 0.55, x - 4 * s, y1 - 2 * s, x + 4 * s, y1); em(1, x, y1 - 2 * s, 0); }
// kruh na vode: pokojný (tlač), alebo sa rozbieha (animácia)
function kruh(p, x, y, r, s, an) { if (an) em(2, x, y, r * s); else p.path('paper', 1, (c, ox, oy) => c.ellipse(x + ox, y + oy, r * s, r * 0.35 * s, 0, 0, TAU), 1 * s); }
function kamene(p, x, y, s, n, ink = 'night') { for (let k = 0; k < n; k++) p.ellipse(ink, 0.3 + (k % 3) * 0.08, x + (k * 7.3 % 23) * s, y + (k * 3.1 % 5) * s, (2.5 + k % 3) * s, (1.6 + k % 2) * s); }
function voda(p, W, y0, y1, s, ink = 'blue') {
  box(p, ink, 0.32, 0, y0, W, y1);
  for (let y = y0 + 6 * s, k = 0; y < y1 - 2; y += 9 * s, k++) for (let x = (k % 2) * 23 * s; x < W; x += 46 * s) p.line('paper', 0.9, 1.1 * s, [[x, y], [x + 12 * s, y]]);
}
function kopce(p, W, y, s, ink) {
  for (let k = 0; k < 3; k++) p.path(ink, 0.14 + k * 0.1, (c, ox, oy) => { const yy = y - (26 - k * 9) * s; c.moveTo(ox, y + oy); c.lineTo(ox, yy + oy); for (let x = 0; x <= W; x += 30 * s) c.lineTo(x + ox, yy + Math.sin(x / (70 * s) + k * 1.7) * 8 * s + oy); c.lineTo(W + ox, y + oy); c.closePath(); });
}
function plot(p, x0, x1, y, s, ink = 'green') {
  for (let x = x0; x < x1; x += 9 * s) { p.ellipse('paper', 1, x, y - 6 * s, 7 * s, 7 * s); p.ellipse(ink, 0.55, x, y - 6 * s, 7 * s, 7 * s); }
  for (let x = x0 + 4 * s; x < x1; x += 9 * s) p.ellipse('teal', 0.28, x, y - 3 * s, 5 * s, 4 * s);
}
// dosky podlahy so škárami a posunutými spojmi
function dosky(p, W, y0, y1, s, a) {
  for (let y = y0 + 14 * s, k = 0; y < y1; y += 16 * s, k++) {
    p.line('orange', a * 0.55, 1 * s, [[0, y], [W, y]]);
    for (let x = ((k * 67) % 200) * s; x < W; x += 200 * s) p.line('orange', a * 0.45, 1 * s, [[x, y - 16 * s], [x, y]]);
  }
}

// i majster, WF šírka plátna, Wv šírka pre svet, st horizont, boky drobnosti pri ringu, an animácie (bez tlače svetlušiek a kruhov)
export function dojo(p, i, WF, H, st, cx, cy, S, Wv, boky, an) {
  const W = Wv || WF, s = Math.max(0.55, Math.min(2.1, st / 80)), g = st, L = cx - S * 1.3, vol = boky && L > 70 && S < 400;
  DA.n = 0; DA.s = s;
  box(p, 'paper', 1, 0, 0, WF, H);
  const xl = Math.min(W * 0.14, 90 * s), xr = W - xl;
  // vysoký pás (menu, karta, počítač): ďaleké kopce a oblaky
  if (g > 150) {
    const hy = g - 40 * s;
    p.path(i === 5 ? 'plum' : 'teal', 0.13, (c, ox, oy) => { c.moveTo(ox, g + oy); for (let x = 0; x <= WF + 40 * s; x += 40 * s) c.lineTo(x + ox, hy - (20 + 16 * Math.sin(x / (110 * s) + i * 1.3)) * s + oy); c.lineTo(WF + ox, g + oy); c.closePath(); });
    for (let k = 0; k < 4; k++) {
      const x = ((k * 0.29 + i * 0.13) % 1) * W + 20 * s, y = (g - 60 * s) * (0.25 + (k % 2) * 0.3);
      for (const [dx, dy, rx] of [[0, 0, 26], [12, -5, 14], [-10, -3, 11]]) { p.ellipse('paper', 1, x + dx * s, y + dy * s, rx * s, 7 * s); p.ellipse(i === 5 ? 'plum' : 'blue', 0.1, x + dx * s, y + dy * s, rx * s, 7 * s); }
    }
  }
  if (i === 0) {                                    // Hedgehog: záhrada, altánok, jablone, živý plot, jazierko
    box(p, 'green', 0.16, 0, g, WF, H); box(p, 'sun', 0.1, 0, 0, WF, g);
    plot(p, 0, WF, g - 14 * s, s * 0.8, 'green'); plot(p, 0, WF, g, s, 'green');
    strom(p, xl, g - 4 * s, s * 1.1, 'green', 7); strom(p, xr - 20 * s, g - 8 * s, s * 0.9, 'green', 5);
    const ax = W * 0.7, ah = 30 * s;
    for (const dx of [-18, 18]) p.line('orange', 0.8, 2.4 * s, [[ax + dx * s, g], [ax + dx * s, g - ah]]);
    p.poly('paper', 1, [[ax - 26 * s, g - ah], [ax + 26 * s, g - ah], [ax, g - ah - 18 * s]]); p.poly('orange', 0.7, [[ax - 26 * s, g - ah], [ax + 26 * s, g - ah], [ax, g - ah - 18 * s]]);
    p.line('orange', 0.6, 1.2 * s, [[ax - 18 * s, g - 12 * s], [ax + 18 * s, g - 12 * s]]);
    box(p, 'orange', 0.75, xl + 18 * s, g - 7 * s, xl + 32 * s, g); for (let k = 0; k < 4; k++) p.circle(k & 1 ? 'pink' : 'orange', 0.95, xl + 20 * s + k * 3.6 * s, g - 8 * s, 2 * s);
    p.line('night', 0.55, 1 * s, [[W * 0.3, g], [W * 0.33, g - 26 * s]]); for (let k = 0; k < 4; k++) p.line('night', 0.55, 0.8 * s, [[W * 0.33 + (k - 1.5) * 2 * s, g - 26 * s], [W * 0.33 + (k - 1.5) * 2 * s, g - 30 * s]]);
    lampa(p, W * 0.24, g, s * 0.8); lampa(p, W * 0.86, g, s * 0.8);
    p.ellipse('paper', 1, xl + 4 * s, g + 12 * s, 13 * s, 4 * s); p.ellipse('blue', 0.35, xl + 4 * s, g + 12 * s, 12 * s, 3.6 * s); kruh(p, xl + 2 * s, g + 12 * s, 5, s, an);
  } else if (i === 1) {                             // Hare: lúčna stodola s komínom, kopce, seno, mrkvy
    box(p, 'sun', 0.2, 0, g, WF, H); box(p, 'green', 0.1, 0, g, WF, H);
    kopce(p, WF, g, s, 'green');
    komin(p, W * 0.74 + 13 * s, g - 45 * s, g - 55 * s, s);
    dom(p, W * 0.74, g, 56 * s, 30 * s, s, 'plum', false);
    for (const [x, y] of [[xl, g], [xl + 20 * s, g + 2 * s], [W * 0.3, g - 2 * s]]) { p.ellipse('paper', 1, x, y - 7 * s, 10 * s, 7 * s); p.ellipse('sun', 0.85, x, y - 7 * s, 10 * s, 7 * s); p.line('orange', 0.6, 0.8 * s, [[x - 7 * s, y - 7 * s], [x + 7 * s, y - 7 * s]]); }
    for (let r = 0; r < 2; r++) for (let x = W * 0.42; x < W * 0.6; x += 9 * s) { p.line('green', 0.8, 1 * s, [[x, g - 2 * s - r * 6 * s], [x - 2 * s, g - 7 * s - r * 6 * s]]); p.ellipse('orange', 0.9, x, g - r * 6 * s, 1.4 * s, 2.4 * s); }
    box(p, 'orange', 0.6, xr - 30 * s, g - 7 * s, xr + 4 * s, g - 5 * s); p.line('orange', 0.6, 1.4 * s, [[xr - 27 * s, g - 5 * s], [xr - 27 * s, g]]); p.line('orange', 0.6, 1.4 * s, [[xr, g - 5 * s], [xr, g]]);
    box(p, 'teal', 0.8, xr - 14 * s, g - 12 * s, xr - 8 * s, g - 5 * s);
    kamene(p, W * 0.9, g - 2 * s, s, 5);
  } else if (i === 2) {                             // Otter: rieka, dojo na kolách, mostík, trstina
    box(p, 'orange', 0.12, 0, g, WF, H); dosky(p, WF, g, H, s, 0.28);
    voda(p, WF, g - 26 * s, g, s);
    const dx = W * 0.72, dy = g - 18 * s;
    for (const k of [-20, -6, 8, 22]) p.line('orange', 0.8, 2 * s, [[dx + k * s, dy], [dx + k * s, g - 2 * s]]);
    dom(p, dx, dy, 52 * s, 26 * s, s, 'teal', false);
    const bx0 = W * 0.18, bx1 = W * 0.42, n = 10;   // mostík spredu
    for (let k = 0; k <= n; k++) { const x = bx0 + (bx1 - bx0) * k / n, y = g - 18 * s - Math.sin(k / n * 3.1416) * 8 * s; p.line('orange', 0.85, 3.4 * s, [[x, y], [x, y + 4 * s]], 'butt'); }
    p.path('orange', 0.9, (c, ox, oy) => { c.moveTo(bx0 + ox, g - 26 * s + oy); c.quadraticCurveTo((bx0 + bx1) / 2 + ox, g - 42 * s + oy, bx1 + ox, g - 26 * s + oy); }, 1.4 * s);
    for (const x of [W * 0.05, W * 0.46, W * 0.94]) trstina(p, x, g - 1 * s, s);
    for (const [x, r] of [[W * 0.55, 8], [W * 0.1, 6]]) kruh(p, x, g - 10 * s, r, s, an);
    p.path('orange', 0.85, (c, ox, oy) => { c.moveTo(xr - 18 * s + ox, g - 6 * s + oy); c.lineTo(xr + 14 * s + ox, g - 6 * s + oy); c.lineTo(xr + 8 * s + ox, g - 1 * s + oy); c.lineTo(xr - 12 * s + ox, g - 1 * s + oy); c.closePath(); });
    lampa(p, W * 0.6, g, s * 0.8);
  } else if (i === 3) {                             // Badger: dojo vo svahu, okrúhle dvere, komín z kopca, korene, huby
    box(p, 'orange', 0.16, 0, g, WF, H); box(p, 'green', 0.06, 0, g, WF, H);
    p.path('green', 0.4, (c, ox, oy) => { c.moveTo(ox, g + oy); c.quadraticCurveTo(W * 0.5 + ox, g - 90 * s + oy, W + ox, g + oy); c.closePath(); });
    p.path('orange', 0.3, (c, ox, oy) => { c.moveTo(W * 0.2 + ox, g + oy); c.quadraticCurveTo(W * 0.5 + ox, g - 60 * s + oy, W * 0.8 + ox, g + oy); c.closePath(); });
    komin(p, W * 0.44, g - 42 * s, g - 54 * s, s);   // vrchol kopca je pri 0,5 W vo výške 45 s
    const dx = W * 0.64, r = 15 * s;
    p.circle('paper', 1, dx, g - r, r); p.circle('teal', 0.85, dx, g - r, r); p.circle('sun', 0.9, dx + r * 0.55, g - r, 1.6 * s);
    p.path('orange', 0.9, (c, ox, oy) => c.arc(dx + ox, g - r + oy, r + 2 * s, 3.1416, 0), 2.4 * s);
    lampa(p, dx - 26 * s, g, s * 0.75); lampa(p, dx + 26 * s, g, s * 0.75);
    for (const [x, k] of [[W * 0.12, 1], [W * 0.36, -1]]) p.path('orange', 0.7, (c, ox, oy) => { c.moveTo(x + ox, g + oy); c.quadraticCurveTo(x + k * 10 * s + ox, g - 10 * s + oy, x + k * 22 * s + ox, g - 4 * s + oy); }, 2 * s);
    for (const x of [W * 0.2, W * 0.88]) { p.ellipse('night', 0.3, x, g - 4 * s, 9 * s, 5 * s); p.ellipse('green', 0.7, x - 1 * s, g - 7 * s, 7 * s, 2.5 * s); }
    for (const x of [W * 0.28, W * 0.3]) { p.line('paper', 1, 1.4 * s, [[x, g], [x, g - 5 * s]]); p.ellipse('pink', 0.9, x, g - 5 * s, 3 * s, 1.8 * s, 0, 3.1416, TAU); }
    p.line('orange', 0.8, 1.4 * s, [[xl - 8 * s, g - 22 * s], [xl + 18 * s, g - 22 * s]]); for (const [k, ink] of [[0, 'sun'], [1, 'green'], [2, 'blue']]) p.line(ink, 0.9, 2 * s, [[xl - 3 * s + k * 7 * s, g - 22 * s], [xl - 3 * s + k * 7 * s, g - 10 * s]]);
    for (let k = 0; k < 3; k++) box(p, 'orange', 0.7, dx - 8 * s, g + k * 3 * s, dx + 8 * s, g + k * 3 * s + 2 * s);
  } else if (i === 4) {                             // Magpie: strecha medzi komínmi, anténa, hniezdo, bielizeň
    box(p, 'blue', 0.08, 0, 0, WF, g); box(p, 'plum', 0.12, 0, g, WF, H);
    for (let y = g + 8 * s, k = 0; y < H; y += 12 * s, k++) for (let x = (k % 2) * 9 * s; x < WF; x += 18 * s) p.path('plum', 0.3, (c, ox, oy) => c.arc(x + ox, y + oy, 9 * s, 0, 3.1416), 0.8 * s);
    p.line('night', 0.35, 2.4 * s, [[0, g - 1 * s], [WF, g - 1 * s]]);
    for (const [x, h] of [[W * 0.16, 44], [W * 0.62, 58], [W * 0.88, 36]]) { box(p, 'paper', 1, x - 8 * s, g - h * s, x + 8 * s, g); box(p, 'orange', 0.65, x - 8 * s, g - h * s, x + 8 * s, g); box(p, 'night', 0.5, x - 10 * s, g - h * s - 3 * s, x + 10 * s, g - h * s); for (let y = g - h * s + 6 * s; y < g; y += 6 * s) p.line('paper', 0.8, 0.7 * s, [[x - 8 * s, y], [x + 8 * s, y]]); if (h !== 58) em(1, x, g - h * s - 3 * s, 0); }
    const nx = W * 0.62, ny = g - 58 * s - 3 * s;   // hniezdo s gombíkmi a lyžičkou
    p.ellipse('orange', 0.8, nx, ny - 2 * s, 11 * s, 4 * s); for (let k = 0; k < 5; k++) p.line('orange', 0.9, 0.7 * s, [[nx - 10 * s + k * 4 * s, ny], [nx - 6 * s + k * 4 * s, ny - 5 * s]]);
    for (const [k, ink] of [[-4, 'sun'], [1, 'teal'], [5, 'pink']]) p.circle(ink, 0.95, nx + k * s, ny - 5 * s, 1.8 * s);
    p.line('night', 0.6, 0.9 * s, [[nx + 7 * s, ny - 4 * s], [nx + 13 * s, ny - 9 * s]]);
    const ax = W * 0.36; p.line('night', 0.6, 1.2 * s, [[ax, g], [ax, g - 52 * s]]); for (const [y, w] of [[42, 12], [34, 9], [26, 6]]) p.line('night', 0.6, 1 * s, [[ax - w * s, g - y * s], [ax + w * s, g - y * s]]);
    p.path('night', 0.5, (c, ox, oy) => { c.moveTo(W * 0.66 + ox, g - 30 * s + oy); c.quadraticCurveTo(W * 0.76 + ox, g - 22 * s + oy, W * 0.86 + ox, g - 28 * s + oy); }, 0.8 * s);
    for (const [k, ink] of [[0, 'pink'], [1, 'teal'], [2, 'sun']]) { const x = W * 0.69 + k * W * 0.05; box(p, ink, 0.8, x - 4 * s, g - 26 * s, x + 4 * s, g - 17 * s); }
    p.ellipse('blue', 0.5, xl * 0.7, g - 3 * s, 8 * s, 2.5 * s); p.ellipse('paper', 1, xl * 0.7, g - 4 * s, 6 * s, 1.5 * s);
  } else {                                          // Crane: pavilón pri jazere v podvečer, borovice, lampy, svetlušky
    box(p, 'plum', 0.16, 0, 0, WF, g); box(p, 'blue', 0.1, 0, 0, WF, g * 0.5);
    box(p, 'orange', 0.14, 0, g, WF, H); dosky(p, WF, g, H, s, 0.3);
    voda(p, WF, g - 30 * s, g, s, 'blue'); box(p, 'plum', 0.12, 0, g - 30 * s, WF, g);
    for (const [x, sc] of [[W * 0.08, 1.2], [W * 0.2, 0.9], [W * 0.9, 1.1]]) borovica(p, x, g - 30 * s, s * sc);
    const px = W * 0.6, py = g - 30 * s;
    for (const k of [-24, 24]) p.line('orange', 0.8, 2.2 * s, [[px + k * s, py], [px + k * s, py - 26 * s]]);
    p.poly('paper', 1, [[px - 38 * s, py - 26 * s], [px + 38 * s, py - 26 * s], [px + 24 * s, py - 40 * s], [px - 24 * s, py - 40 * s]]); p.poly('teal', 0.8, [[px - 38 * s, py - 26 * s], [px + 38 * s, py - 26 * s], [px + 24 * s, py - 40 * s], [px - 24 * s, py - 40 * s]]);
    box(p, 'orange', 0.8, px - 30 * s, py - 1 * s, px + 30 * s, py + 2 * s);
    box(p, 'orange', 0.75, W * 0.3, g - 16 * s, W * 0.5, g - 13 * s); for (let x = W * 0.3; x <= W * 0.5; x += 14 * s) p.line('orange', 0.8, 1.4 * s, [[x, g - 13 * s], [x, g - 4 * s]]);
    lampa(p, px - 30 * s, py, s * 0.7, true); lampa(p, px + 30 * s, py, s * 0.7, true); lampa(p, W * 0.3, g - 16 * s, s * 0.6, true);
    kamene(p, W * 0.78, g - 12 * s, s, 4); trstina(p, W * 0.96, g - 2 * s, s); trstina(p, W * 0.04, g - 2 * s, s);
    if (an) em(2, W * 0.16, g - 9 * s, 7 * s);
    for (let k = 0; k < 14; k++) { const x = (k * 0.173 + 0.05) % 1 * W, y = g - 34 * s - (k * 37 % 50) * s; if (an) em(3, x, y, k); else { p.circle('sun', 0.3, x, y, 3.4 * s); p.circle('sun', 1, x, y, 1.1 * s); } }
  }
  // na širokej obrazovke drobnosti aj na zemi vedľa ringu
  if (vol) {
    const k = i === 5, y1 = Math.min(cy + S * 0.3, H - 10), y2 = Math.min(cy + S * 0.75, H - 10), R = 2 * cx - L, sl = Math.min(s, L / 60);
    lampa(p, L * 0.55, y1, sl, k); lampa(p, R + (W - R) * 0.45, y1, sl, k);
    if (i !== 2 && i !== 5) { strom(p, L * 0.3, y2, sl * 1.2, i === 3 ? 'teal' : 'green', i === 0 ? 5 : 0); strom(p, R + (W - R) * 0.7, y2, sl, 'green', 0); }
    else { borovica(p, L * 0.35, y2, sl * 1.3); borovica(p, R + (W - R) * 0.7, y2, sl); }
  }
  p.line('night', 0.3, 1.5, [[0, g], [WF, g]]);
}
