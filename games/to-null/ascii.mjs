// TO: NULL: ASCII obrazy sektorov 24 × 12 (ručne kreslené čiarami) a portréty odosielateľov 16 × 10 (SPEC 4.6).
// Obrazy sektorov sú šablóny z čiar / \ | _ ( ) o, aby sa dali prečítať na prvý pohľad (kolo oprav 1: rasterizované
// primitíva boli nečitateľné). Rasterizácia " .:-=+*#%@" ostáva len na portréty.
// Čisto deterministické (žiadne Math.random). Súradnice sú v bunkách znakov; znak je asi 2,2× vyšší než široký.

export const RAMPA = ' .:-=+*#%@';

// ------------------------------------------------------------------ primitívy portrétov (funkcia pokrytia (x, y) → hodnota alebo -1)

const elipsa = (cx, cy, rx, ry, v) => (x, y) => (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 ? v : -1);
const obdlznik = (x0, y0, x1, y1, v) => (x, y) => (x >= x0 && x <= x1 && y >= y0 && y <= y1 ? v : -1);
/** Lineárny prechod svetla v tvare: hodnota od v0 (pri bode a) po v1 (pri bode b). */
function prechod(tvar, ax, ay, bx, by, v0, v1) {
  const dx = bx - ax, dy = by - ay;
  const L = dx * dx + dy * dy || 1e-9;
  return (x, y) => {
    if (tvar(x, y) < 0) return -1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L));
    return v0 + (v1 - v0) * t;
  };
}

/** Rastrovanie: posledný tvar, ktorý pokrýva vzorku, vyhráva. text = [[x, y, znaky]] prepíše bunky. */
export function rastruj(w, h, tvary, text = []) {
  const riadky = [];
  for (let r = 0; r < h; r++) {
    let s = '';
    for (let c = 0; c < w; c++) {
      let sum = 0;
      for (const [ox, oy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
        let v = 0;
        for (const t of tvary) { const k = t(c + ox, r + oy); if (k >= 0) v = k; }
        sum += v;
      }
      const svetlo = 1 - 0.18 * ((c / w + r / h) / 2);
      const b = (sum / 4) * svetlo;
      s += RAMPA[Math.max(0, Math.min(9, Math.round(b * 9)))];
    }
    riadky.push(s);
  }
  for (const [x, y, z] of text) {
    if (y < 0 || y >= h) continue;
    const r = riadky[y].split('');
    for (let i = 0; i < z.length; i++) if (x + i >= 0 && x + i < w && z[i] !== '\u0000') r[x + i] = z[i];
    riadky[y] = r.join('');
  }
  return riadky;
}

// ------------------------------------------------------------------ obrazy sektorov 24 × 12 (šablóny)

const SABLONY = {
  // SECTOR 01: "the kettle is on. come home when you can."
  kettle: [
    '                    ) ) ',
    '         ___       ( (  ',
    '    .---(___)---.   ) ) ',
    '   /             \\  _   ',
    '  |               |/ /  ',
    '  |               | /   ',
    '  |               |/    ',
    '  |               |     ',
    '   \\             /      ',
    "    '-._______.-'       ",
    '  ___________________   ',
    ' |___________________|  ',
  ],
  // SECTOR 02: "i'm keeping the light on for you."
  lamp: [
    '          ____          ',
    '        _/____\\_        ',
    '        \\ |  | /        ',
    '     .   \\|__|/   .     ',
    '   .      \\  /      .   ',
    '  .       _||_       .  ',
    '           ||           ',
    '           ||           ',
    '           ||           ',
    '           ||           ',
    '          _||_          ',
    '  _______|____|_______  ',
  ],
  // SECTOR 03: "the boat's in. saturday at the quay?"
  crane: [
    '   /\\                   ',
    '  /__\\________________  ',
    '  |/\\|\\/\\/\\/\\/\\/\\/\\/\\/| ',
    '  |\\/|             |    ',
    '  |/\\|             |    ',
    '  |\\/|           [___]  ',
    '  |/\\|                  ',
    '  |\\/|        ____|_    ',
    '  |/\\|  _____|______|__ ',
    ' _|__|_ \\  o  o  o    / ',
    '|______|~\\___________/~~',
    '~~ ~~~ ~~~~  ~~~ ~~~~ ~~',
  ],
  // SECTOR 04: "fixed the bike. it's yours when you're back."
  bike: [
    '                        ',
    '                        ',
    '      ___       __,     ',
    '        \\________|      ',
    '        /\\      /|      ',
    "  .-'''/. \\    /-|''-.  ",
    ' /    /  \\ \\  /   \\   \\ ',
    '|    o=====(_)    o    |',
    ' \\       /    \\       / ',
    "  '-...-'      '-...-'  ",
    '                        ',
    '                        ',
  ],
  // SECTOR 05: "i can see your window from the bridge."
  window: [
    '  ____________________  ',
    ' |  ________________  | ',
    ' | |\\      ||      /| | ',
    ' | | \\     ||     / | | ',
    ' | |  )    ||    (  | | ',
    ' | | /  .  ||  .  \\ | | ',
    ' | |/______||______\\| | ',
    ' | |   .   ||   .   | | ',
    ' | |       ||       | | ',
    ' | |_______||_______| | ',
    ' |____________________| ',
    '/______________________\\',
  ],
  // SECTOR 06: "i'll wait on the bench by the lamp."
  bench: [
    '                 ____   ',
    '               _/____\\_ ',
    '               \\ |  | / ',
    '                \\|__|/  ',
    '                 _||_   ',
    '  ______________  ||    ',
    ' |______________| ||    ',
    ' |______________| ||    ',
    ' |_|__________|_| ||    ',
    ' | |          | | ||    ',
    ' |_|          |_|_||_   ',
    '_________________|__|___',
  ],
  // SECTOR 07: "the door's open. it always was."
  door: [
    '    ________________    ',
    '   |  ____________  |   ',
    '   | |\\ .  .  .  .| |   ',
    '   | | \\  .  .  . | |   ',
    '   | |  | .  .  . | |   ',
    '   | |  |o  .  .  | |   ',
    '   | |  | .  .  . | |   ',
    '   | |  |  .  .  .| |   ',
    '   | |  / .  .  . | |   ',
    '   | | /  .  .  . | |   ',
    '  _|_|/___________|_|_  ',
    ' /  .   .   .   .   . \\ ',
  ],
};

export const OBRAZY = Object.fromEntries(Object.entries(SABLONY).map(([k, v]) => [k, () => v.map((r) => r.padEnd(24).slice(0, 24))]));

export const obrazSektora = (meno) => (OBRAZY[meno] ? OBRAZY[meno]() : []);

// ------------------------------------------------------------------ portréty 16 × 10 zo seedu

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const VLASY = ['short', 'long', 'bun', 'curls', 'part', 'hat'];

/** Portrét odosielateľa: hlava elipsa, 6 typov vlasov, oči, voliteľne okuliare, ramená. Bez tváre skutočnej osoby. */
export function portret(seed) {
  const r = mulberry(seed * 2654435761 + 17);
  const rx = (3.6 + r() * 0.8) * 1.15;
  const ry = 3.2 + r() * 0.6;
  const cx = 8, cy = 4.9;
  const typ = VLASY[Math.floor(r() * VLASY.length)];
  const okuliare = r() < 0.3;
  const zavrete = r() < 0.25;
  const tvary = [
    elipsa(8, 10.9, 7.4, 2.6, 0.55),
    prechod(elipsa(cx, cy, rx, ry, 1), cx - rx, cy - ry, cx + rx, cy + ry, 0.62, 0.42),
  ];
  const vrch = cy - ry;
  if (typ === 'short') tvary.push(elipsa(cx, vrch + 1, rx * 1.02, 1.4, 0.9));
  if (typ === 'long') tvary.push(elipsa(cx, vrch + 1.1, rx * 1.05, 1.5, 0.9), obdlznik(cx - rx - 0.6, cy - 1, cx - rx + 1.2, cy + 3.6, 0.88), obdlznik(cx + rx - 1.2, cy - 1, cx + rx + 0.6, cy + 3.6, 0.88));
  if (typ === 'bun') tvary.push(elipsa(cx, vrch + 0.9, rx, 1.3, 0.9), elipsa(cx, vrch - 0.2, 1.8, 0.8, 0.95));
  if (typ === 'curls') {
    for (let i = 0; i < 9; i++) tvary.push(elipsa(cx - rx + (i * 2 * rx) / 8, vrch + 0.6 + (i % 2) * 0.5, 1.2, 0.7, 0.8 + (i % 3) * 0.06));
  }
  if (typ === 'part') tvary.push(elipsa(cx, vrch + 1, rx * 1.02, 1.4, 0.9), obdlznik(cx - 1.6, vrch - 0.2, cx - 1, vrch + 1.6, 0.3));
  if (typ === 'hat') tvary.push(obdlznik(cx - rx * 0.8, vrch - 0.6, cx + rx * 0.8, vrch + 1.2, 0.95), obdlznik(cx - rx - 1.8, vrch + 1.2, cx + rx + 1.8, vrch + 1.7, 1));
  const riadky = rastruj(16, 10, tvary);
  const oy = Math.round(cy);
  const ox1 = Math.round(cx - rx * 0.42);
  const ox2 = Math.round(cx + rx * 0.42) - 1;
  const oko = zavrete ? '-' : 'o';
  const text = okuliare ? [[ox1 - 1, oy, '(' + oko + ')'], [ox2 - 1, oy, '(' + oko + ')'], [ox1 + 2, oy, '-'.repeat(Math.max(0, ox2 - ox1 - 3))]] : [[ox1, oy, oko], [ox2, oy, oko]];
  const s = oy + 2 < 10 ? [[Math.round(cx) - 1, oy + 2, zavrete ? '..' : '__']] : [];
  return rastruj(16, 10, tvary, [...text, ...s]).map((x, i) => (i === oy || i === oy + 2 ? x : riadky[i]));
}
