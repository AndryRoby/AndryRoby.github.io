/* Puzzle Village: "my village", the houses whose window is lit today.
   A house lights its window when its daily puzzle was solved today in this
   browser. The fourteen games keep every day as localStorage
   '<game>:<YYYY-MM-DD>' = JSON with `done` (the ms of the solve, null before),
   and "today" is the puzzle day: the date in Bratislava, the rule every game
   uses (todayBratislava in <game>/generator.mjs). Tomorrow starts dark again.
   No luck, nothing to lose: a light is only ever a puzzle you solved.

   Everything here is a pure function or a table: no DOM, no storage of its own,
   nothing runs on import, so Node can load it (ops/games/village.test.mjs).
   village.js reads the storage, draws the lights and the card. */
import { PRESETS, springStep } from '../../motion/src/core.js';
import { INK } from './riso.js?v=7';

/* The fourteen daily games, in the order of games/zoznam.json. */
export const HRY = Object.freeze(['hedgehogs', 'magpies', 'otters', 'squirrels', 'cranes', 'swans', 'voles', 'badgers', 'herons', 'hares', 'dormice', 'owls', 'beavers', 'foxes']);
export const meno = k => k.charAt(0).toUpperCase() + k.slice(1);

/* ── The puzzle day ─────────────────────────────────────────────────── */
export function jeDatum(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}
/* Today's date in Bratislava, as every game counts its days. */
let DEN = null;                             // the formatter, made once
export function dnesBratislava(now = new Date()) {
  try {
    DEN = DEN || new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Bratislava', year: 'numeric', month: '2-digit', day: '2-digit' });
    const s = DEN.format(now);
    if (jeDatum(s)) return s;
  } catch (e) { /* the visitor's own clock below, as the games do */ }
  const p = x => String(x).padStart(2, '0');
  return now.getFullYear() + '-' + p(now.getMonth() + 1) + '-' + p(now.getDate());
}
/* Milliseconds until the date in Bratislava turns, plus half a second (at least
   1 s). The turn is found by halving the next 26 hours down to the millisecond,
   so a day of 23 or 25 hours (29 Mar and 25 Oct 2026) is timed as exactly as any
   other: the clock on the wall is never asked. */
export function msDoPolnoci(now = new Date()) {
  try {
    const t0 = now.getTime(), dnes = dnesBratislava(now);
    if (!Number.isFinite(t0)) return 3600000;
    let lo = t0, hi = t0 + 26 * 3600000;
    if (dnesBratislava(new Date(hi)) === dnes) return 3600000;
    while (hi - lo > 1) { const mid = Math.floor((lo + hi) / 2); if (dnesBratislava(new Date(mid)) === dnes) lo = mid; else hi = mid; }
    return Math.max(1000, hi - t0 + 500);
  } catch (e) { return 3600000; }
}

/* ── Reading the games' days ────────────────────────────────────────── */
/* kluce is whatever holds the saves: a Storage (localStorage), a function
   key => string, a Map or a plain object of key => string (or already parsed).
   A storage that throws (private window, blocked site data) reads as empty. */
function surovy(kluce, k) {
  try {
    if (!kluce) return null;
    if (typeof kluce === 'function') return kluce(k);
    if (typeof kluce.getItem === 'function') return kluce.getItem(k);
    if (kluce instanceof Map) return kluce.has(k) ? kluce.get(k) : null;
    return Object.prototype.hasOwnProperty.call(kluce, k) ? kluce[k] : null;
  } catch (e) { return null; }
}
export function zaznam(kluce, k) {
  const s = surovy(kluce, k);
  if (s == null) return null;
  if (typeof s === 'object') return Array.isArray(s) ? null : s;
  if (typeof s !== 'string') return null;
  try { const o = JSON.parse(s); return o && typeof o === 'object' && !Array.isArray(o) ? o : null; } catch (e) { return null; }
}
/* solved = `done` holds the moment of the solve (or true); null, 0 or text is not */
export function vyriesene(z) {
  const d = z ? z.done : null;
  return d === true || (typeof d === 'number' && Number.isFinite(d) && d > 0);
}

/* The lights of one day. Only today's key of each of the fourteen games counts:
   yesterday, practice sets, streaks and settings never light a window. */
export function svetlaDnes(kluce, dnes) {
  const datum = jeDatum(dnes) ? dnes : null;
  const hry = HRY.map(k => {
    const z = datum ? zaznam(kluce, k + ':' + datum) : null;
    const svieti = vyriesene(z);
    return { kluc: k, meno: meno(k), svieti, kedy: svieti && typeof z.done === 'number' ? z.done : 0 };
  });
  const svietia = hry.filter(h => h.svieti).map(h => h.kluc);
  let posledna = null, kedy = -1;
  for (const h of hry) if (h.svieti && h.kedy > kedy) { kedy = h.kedy; posledna = h.kluc; }
  return { datum, spolu: HRY.length, pocet: svietia.length, vsetky: svietia.length === HRY.length, svietia, posledna, hry };
}

/* The nearest house still dark: nearest on the island to the house lit last,
   ties and a day with no light yet go by the village's own order (west to east,
   Hedgehogs first). polohy = { key: [x, y] }. null when every window is lit. */
export function najblizsia(stav, polohy = {}, poradie = HRY) {
  const lit = new Set((stav && stav.svietia) || []);
  const tmave = poradie.filter(k => HRY.includes(k) && !lit.has(k));
  if (!tmave.length) return null;
  const od = stav && stav.posledna ? polohy[stav.posledna] : null;
  if (!od) return tmave[0];
  let best = null, bd = Infinity;
  for (const k of tmave) {
    const q = polohy[k];
    if (!q) continue;
    const d = Math.hypot(q[0] - od[0], q[1] - od[1]);
    if (d < bd - 1e-9) { bd = d; best = k; }
  }
  return best || tmave[0];
}

/* ── Which lights are new since the last visit ──────────────────────── */
/* The village keeps 'vl-seen' = {"d": day, "k": [keys]}: the lights this browser
   has already watched come on today. A light not in it comes on with ink. */
export function citajVidene(s) {
  try {
    const o = typeof s === 'string' ? JSON.parse(s) : s;
    return o && typeof o === 'object' && typeof o.d === 'string' && Array.isArray(o.k) ? { d: o.d, k: o.k.filter(x => typeof x === 'string') } : null;
  } catch (e) { return null; }
}
export function noveSvetla(stav, videne) {
  const uz = videne && videne.d === stav.datum ? new Set(videne.k) : new Set();
  return stav.hry.filter(h => h.svieti && !uz.has(h.kluc))
    .sort((a, b) => a.kedy - b.kedy || HRY.indexOf(a.kluc) - HRY.indexOf(b.kluc))
    .map(h => h.kluc);
}
/* kluce: the lights this browser has now watched come on (all of today's when left out);
   kept in the order of the fourteen games */
export function zapisVidene(stav, kluce) {
  const k = new Set(kluce ? [...kluce] : stav.svietia);
  return JSON.stringify({ d: stav.datum, k: HRY.filter(h => k.has(h)) });
}

/* ── Words ──────────────────────────────────────────────────────────── */
/* The line above the village. stav = what is solved today; n = the lights on
   the screen now (a light solved elsewhere comes on only once it is seen, and
   the number rolls to it then). The number is its own part (cislo) so it can
   roll. Nothing solved today: an invitation and the first house, not a zero. */
export function textSvetiel(stav, dalsia, n = stav.pocet) {
  const N = stav.spolu, nic = !stav.pocet;
  const casti = nic ? { pred: 'Light a window', cislo: null, po: '' }
    : n >= N ? { pred: 'All ', cislo: N, po: ' lights' }
    : { pred: '', cislo: Math.max(0, n), po: ' of ' + N + ' lights' };
  const slovo = nic ? 'Start: ' : 'Next: ';
  return {
    ...casti, dnes: ' today',
    riadok: casti.pred + (casti.cislo == null ? '' : casti.cislo) + casti.po + ' today',
    odkaz: dalsia ? slovo + meno(dalsia) : null,
    // the spoken name starts with the words on screen (WCAG 2.5.3)
    popis: dalsia ? slovo + meno(dalsia) + ', play today’s puzzle to light its window' : null,
    nazov: 'Solve a house’s puzzle today and its window lights up'
  };
}
/* what a screen reader hears when windows come on: "Now lit: Hedgehogs. 5 of 14 lights today." */
export function textOznamu(kluce, n, N = HRY.length) {
  const m = kluce.filter(k => HRY.includes(k)).map(meno);
  if (!m.length) return '';
  const zoznam = m.length < 2 ? m[0] : m.slice(0, -1).join(', ') + ' and ' + m[m.length - 1];
  return 'Now lit: ' + zoznam + '. ' + (n >= N ? 'All ' + N + ' lights today.' : n + ' of ' + N + ' lights today.');
}
/* the line in a house's card */
export function textDomu(svieti) {
  return svieti ? 'Solved today. Its window stays lit until the day ends.' : 'Solve today’s puzzle and this window lights up.';
}
const DNI = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MESIACE = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function datumSlovami(iso) {
  if (!jeDatum(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return { dlhy: DNI[t.getUTCDay()] + ' ' + d + ' ' + MESIACE[m - 1] + ' ' + y, kratky: d + ' ' + MESIACE[m - 1].slice(0, 3) };
}
export const ADRESA = 'arling.sk/games/village';
export function textZdielania(stav) {
  const d = datumSlovami(stav.datum);
  const n = stav.pocet >= stav.spolu ? 'all ' + stav.spolu + ' lights' : stav.pocet + ' of ' + stav.spolu + ' lights';
  return 'My village' + (d ? ', ' + d.kratky : '') + ': ' + n + '. https://' + ADRESA + '/?ref=card';
}
export function menoSuboru(stav) { return 'my-village-' + (stav.datum || 'today') + '.png'; }

/* ── Motion: every time of the village's own moments, in one table ─── */
/* (section 4 of ops/games/VYLEPSENIA-HIER-2026-09-27.md; springs from motion/src/core.js) */
export const CASY = Object.freeze({
  // the window of a house solved since the last visit fills with light: a circle from its middle
  okno: Object.freeze({ ms: 360, pruzina: 'snappy' }),
  // how much of the village must be on the screen before a light comes on (of the stage, or of
  // the window when the stage is taller); and the house itself must be in that part
  videt: 0.6,
  // after that, so the eye lands first (the canvas itself fades in over 500 ms)
  start: 600,
  // between two houses lit on the same arrival, and the whole wave at most
  odstup: 140, vlna: 1400,
  // seen from afar, the house's name label lands once when its light comes on: scale 1.3 to 1
  stitok: Object.freeze({ pruzina: 'press', od: 1.3 }),
  // the count above the village rolls to the new number (motion/components/number: every digit
  // on the snappy spring, columns 35 ms apart); reduced motion: the number at once
  pocet: Object.freeze({ pruzina: 'snappy' }),
  // day to evening (at 14 of 14, or the button): the old picture fades off the new one on the
  // gentle spring as a CSS linear() easing; it is all but done after ms (the spring rests later)
  vecer: Object.freeze({ ms: 700, pruzina: 'gentle', po: 400 }),
  // the note after the card is shared or saved
  sprava: 2400
});
/* How much of the village is on the screen. r = the stage's rectangle
   (getBoundingClientRect), vw and vh = the window. The part seen is given in
   the stage's own pixels; dost = enough of it for a light to come on. */
export function viditelne(r, vw, vh) {
  const x0 = Math.max(0, -r.left), y0 = Math.max(0, -r.top);
  const x1 = Math.min(r.width, vw - r.left), y1 = Math.min(r.height, vh - r.top);
  const w = Math.max(0, x1 - x0), h = Math.max(0, y1 - y0);
  const podiel = r.width > 0 && r.height > 0 ? (w * h) / (r.width * r.height) : 0;
  const dost = w > 0 && h > 0 && (podiel >= CASY.videt - 1e-9 || (vh > 0 && h >= CASY.videt * vh - 0.5));
  return { x0, y0, x1, y1, podiel, dost };
}
/* a point of the stage (css px) lies in the part on the screen, m px inside its edges */
export function vDohlade(v, x, y, m = 12) { return !!v && x >= v.x0 + m && x <= v.x1 - m && y >= v.y0 + m && y <= v.y1 - m; }
/* How far the ink of a window has come, 0 to 1, ms after it started. Reduced
   motion: lit at once. The snappy spring reaches the edge at 260 ms and its
   0.5 % overshoot is clipped, so the circle only ever grows. */
export function atrament(ms, redukovany = false) {
  if (redukovany) return 1;
  if (!(ms > 0)) return 0;
  if (ms >= CASY.okno.ms) return 1;
  return Math.min(1, Math.max(0, springStep(PRESETS[CASY.okno.pruzina], ms / 1000)));
}
/* when each new light starts, ms after the first, in the order they were solved */
export function rozvrh(nove, redukovany = false) {
  const n = nove.length;
  if (redukovany || n < 2) return nove.map(() => 0);
  const krok = Math.min(CASY.odstup, CASY.vlna / (n - 1));
  return nove.map((k, i) => Math.round(i * krok));
}

/* ── The card: "My village, <date>: N of 14 lights", 1080 x 1350 ───── */
/* Only the date and which houses are lit go in: no board, no time, no answer,
   so the card can never give a puzzle away. The island itself is the village's
   own print, the same for everyone every day. */
export const KARTA = Object.freeze({ w: 1080, h: 1350 });
/* an ink printed with multiply over the paper, as the print shows it */
export function farba(ink, a = 1, pod = INK.paper) {
  const c = INK[ink];
  return pod.map((p, i) => Math.round(p * (1 - a + a * c[i] / 255)));
}
/* A lit pane by day, one flat colour: the sun ink (0.95) and a breath of orange
   (0.2) over the paper, as the print mixes them. A lit pane is smooth light, and
   one flat fill costs a frame a third of three grainy ones (village.js). */
export const DENNE_SKLO = Object.freeze(farba('orange', 0.2, farba('sun', 0.95)));
export function rozlozenieKarty({ datum, svietia = [], eve = false } = {}) {
  const W = KARTA.w, H = KARTA.h, M = 54;
  const lit = new Set((Array.isArray(svietia) ? svietia : []).filter(k => HRY.includes(k)));
  const n = lit.size, N = HRY.length;
  const d = datumSlovami(datum);
  // a stranger in a feed reads it top down: whose village, what day, the island, how many lights
  // and what a light is, which houses, where to go
  const texty = [
    { id: 'znacka', text: 'Puzzle Village', x: 98, y: 104, size: 30, weight: 700, ink: 'blue', a: 0.92 },
    { id: 'titul', text: 'My village', x: 94, y: 204, size: 112, weight: 700, ink: 'blue', a: 0.92, drum: { ink: 'pink', a: 0.9, dx: 3.6, dy: 2.4 } },
    { id: 'datum', text: d ? d.dlhy : 'Today', x: 98, y: 260, size: 34, weight: 600, ink: 'night', a: 0.8 },
    { id: 'pocet', text: n >= N ? 'All ' + N + ' lights' : n + ' of ' + N + ' lights', x: 94, y: 1000, size: 72, weight: 700, ink: 'night', a: 0.95 },
    { id: 'vysvetlenie', text: 'One light per puzzle solved', x: 98, y: 1046, size: 28, weight: 600, ink: 'night', a: 0.8 },
    { id: 'adresa', text: ADRESA, x: 98, y: 1298, size: 30, weight: 600, ink: 'night', a: 0.82 }
  ];
  const cw = (W - 2 * M) / 7;
  const okna = HRY.map((k, i) => {
    const cx = M + cw * (i % 7 + 0.5), top = 1072 + Math.floor(i / 7) * 100;
    return { kluc: k, meno: meno(k), svieti: lit.has(k), x: Math.round(cx - 15), y: top, w: 30, h: 36, tx: Math.round(cx), ty: top + 66, size: 24 };
  });
  return {
    w: W, h: H, eve: !!eve, pocet: n, spolu: N,
    papier: INK.paper.slice(),
    ostrov: { x: M, y: 294, w: W - 2 * M, h: 624 },
    znacky: [[48, 48], [W - 48, 48], [48, H - 48], [W - 48, H - 48]],
    texty,
    okna,
    atramenty: ['blue', 'pink', 'orange', 'sun', 'green', 'teal', 'plum', 'night'],
    // what the tests measure: every word as the paper shows it, the frame of a window glyph
    kontrast: texty.map(t => ({ id: t.id, text: farba(t.ink, t.a) }))
      .concat([{ id: 'meno', text: farba('night', 0.88) }, { id: 'okno', text: farba('night', 0.85), znacka: true }])
  };
}

/* Draws the card with a riso Pen (riso.js) on a 1080 x 1350 canvas; the island
   is drawn by the engine (village.js), handed in as kresliOstrov(p, box). */
export function kresliKartu(p, lay, kresliOstrov) {
  const c = p.c;
  const pismo = (t) => { c.font = t.weight + ' ' + t.size + 'px "ARLing Sans", system-ui, sans-serif'; };
  const napis = (str, x, y) => { if (p.fs) p.textAside(str, x, y); else c.fillText(str, x, y); };
  const zaklad = () => { c.setTransform(1, 0, 0, 1, 0, 0); p.scale(1); p.eve = false; p.reset(); };
  zaklad();
  p.ink('paper', 1); c.fillRect(0, 0, lay.w, lay.h);
  // the island, printed by the village itself, on its plate
  const o = lay.ostrov;
  if (kresliOstrov) kresliOstrov(p, o);
  zaklad();
  // a thin frame round the plate, drawn as four fills (a patterned stroke is slow in Firefox)
  p.ink('night', 0.4);
  c.fillRect(o.x, o.y, o.w, 2); c.fillRect(o.x, o.y + o.h - 2, o.w, 2); c.fillRect(o.x, o.y, 2, o.h); c.fillRect(o.x + o.w - 2, o.y, 2, o.h);
  // printer's marks in three drums, like on the poster
  for (const [x, y] of lay.znacky) {
    for (const [ink, dx] of [['blue', 0], ['pink', 1.2], ['sun', -1]]) {
      p.ink(ink, 0.8);
      c.fillRect(x - 14 + dx, y - 0.5, 28, 1.2); c.fillRect(x + dx - 0.6, y - 14, 1.2, 28);
      p.path(ink, 0.8, (cc) => { cc.moveTo(x + dx + 7.6, y); cc.arc(x + dx, y, 7.6, 0, 6.2832); cc.moveTo(x + dx + 6.4, y); cc.arc(x + dx, y, 6.4, 0, 6.2832, true); });
    }
  }
  // words
  c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  for (const t of lay.texty) {
    pismo(t);
    if (t.drum) { p.ink(t.drum.ink, t.drum.a); c.textAlign = 'left'; c.textBaseline = 'alphabetic'; napis(t.text, t.x + t.drum.dx, t.y + t.drum.dy); }
    p.ink(t.ink, t.a); c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    napis(t.text, t.x, t.y);
  }
  // fourteen windows: lit ones glow with four little rays, dark ones keep their cross
  for (const w of lay.okna) {
    const { x, y } = w, W = w.w, H = w.h;
    p.ink('night', 0.85); c.fillRect(x, y, W, H);
    const pane = [[x + 4, y + 4], [x + W - 4, y + 4], [x + W - 4, y + H - 4], [x + 4, y + H - 4]];
    if (w.svieti) {
      p.poly('paper', 1, pane); p.poly('sun', 0.95, pane); p.poly('orange', 0.18, pane);
      const cx = x + W / 2, cy = y + H / 2;
      for (const [ux, uy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const ax = cx + ux * (W / 2 + 5), ay = cy + uy * (H / 2 + 5);
        p.poly('orange', 0.85, [[ax, ay - 1.4], [ax + ux * 7, ay + uy * 7 - 1.4], [ax + ux * 7, ay + uy * 7 + 1.4], [ax, ay + 1.4]]);
      }
    } else {
      p.ink('paper', 0.9); c.fillRect(x + W / 2 - 1, y + 4, 2, H - 8); c.fillRect(x + 4, y + H / 2 - 1, W - 8, 2);
    }
    c.font = '600 ' + w.size + 'px "ARLing Sans", system-ui, sans-serif';
    p.ink('night', 0.88); c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    napis(w.meno, w.tx, w.ty);
  }
  // the imprint's ink swatches, bottom right
  lay.atramenty.forEach((k, i) => { p.ink(k, 0.9); c.fillRect(lay.w - 96 - (lay.atramenty.length - i) * 22, lay.h - 64, 16, 16); });
  p.reset();
  c.textAlign = 'left';
}
