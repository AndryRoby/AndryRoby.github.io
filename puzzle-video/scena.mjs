// Scéna Puzzle video makera: vertikálne video 1080x1920 s hlavolamom z Puzzle API.
// Čisté funkcie bez DOM: časovanie, rozloženie, kreslenie na hocijaký 2D kontext, zvuk ako PCM.
// Vzor vzhľadu a časovania je ops/video/shorts/sablona.html a render-short.mjs; tu sa kreslí
// na canvas, aby sa video dalo vyrobiť v prehliadači cez WebCodecs. Testy: scena.test.mjs.

export const W = 1080;
export const H = 1920;
export const FPS = 30;
export const KREDIT = 'Puzzle by ARLing, arling.sk';
export const ODPOCTY = [10, 20, 30];
export const OBTIAZNOSTI = ['easy', 'medium', 'hard'];
export const POCET = 200;
export const PISMO = '"ARLing Sans", "Segoe UI", system-ui, sans-serif';

export const FARBY = {
  papier: '#0f0e0c',
  atrament: '#f5f1ea',
  tichy: '#a39d93',
  med: '#f26b3a',
  karta: '#fbfaf7',
  draha: '#2a2723',
};

// Bezpečné zóny Shorts, Reels a TikToku (1080x1920): vpravo od y 1000 sú tlačidlá,
// dole od y 1480 popis videa. Hore necháme miesto pre stavový riadok a záložky.
export const BEZPECNE = { vlavo: 60, hore: 100, vpravo: 1020, dole: 1480, tlacidlaOdY: 1000, tlacidlaOdX: 900 };

// Názov a pravidlo v jednej vete (overené proti návodom v products/arling-sk/games/<druh>/guide/,
// tie isté vety ako ops/video/shorts/render-short.mjs).
export const DRUHY = {
  badgers: ['Killer Sudoku', 'Every row, column and box holds each number once, and each dotted cage adds up to its small number.'],
  cranes: ['Hashi', 'Join the islands with straight bridges. Each number is how many bridges touch it, and bridges never cross.'],
  hares: ['Anti-knight Sudoku', 'Sudoku rules, plus one: the same number can never be a chess knight’s move apart.'],
  hedgehogs: ['Star Battle', 'Every row, column and region gets the same number of stars, and stars never touch, not even diagonally.'],
  herons: ['Numberlink', 'Connect each pair of equal numbers with one line. Lines never cross or share a cell.'],
  magpies: ['Nonogram', 'The numbers tell you the runs of filled cells in each row and column, in that order.'],
  otters: ['Slitherlink', 'Draw one closed loop along the dots. Each number says how many of its four sides the loop uses.'],
  squirrels: ['Kakuro', 'Fill the white cells with 1 to 9 so each run adds up to its clue, with no number repeated in a run.'],
  swans: ['Masyu', 'Draw one loop through every circle. Turn on the black circles, go straight through the white ones.'],
  voles: ['Nurikabe', 'Shade cells so each number sits in an island of that size, all shaded cells connect, and no 2x2 block is shaded.'],
};

/** Overí a znormalizuje voľby. Hodí RangeError pri čomkoľvek mimo ponuky. */
export function volby({ druh, obtiaznost, cislo, sek }) {
  if (!Object.hasOwn(DRUHY, druh)) throw new RangeError('druh');
  if (!OBTIAZNOSTI.includes(obtiaznost)) throw new RangeError('obtiaznost');
  const n = Number(cislo);
  if (!Number.isInteger(n) || n < 1 || n > POCET) throw new RangeError('cislo');
  const s = Number(sek);
  if (!ODPOCTY.includes(s)) throw new RangeError('sek');
  return { druh, obtiaznost, cislo: String(n).padStart(3, '0'), sek: s, nazov: DRUHY[druh][0], pravidlo: DRUHY[druh][1] };
}

export function nahodneCislo(nahoda = Math.random) {
  return 1 + Math.floor(nahoda() * POCET);
}

/** Cesta k hlavolamu v Puzzle API bez prípony: .json, .svg a -solution.svg ležia vedľa seba. */
export function cestaHlavolamu(v) {
  return `/api/puzzles/v1/${v.druh}/${v.obtiaznost}/${v.cislo}`;
}

export function nazovSuboru(v, pripona = 'mp4') {
  return `arling-${v.druh}-${v.obtiaznost}-${v.cislo}-${v.sek}s.${pripona}`;
}

/** Časová os, rovnaká ako v sablona.html: úvod, odpočet, riešenie, záver. */
export function casy(sek) {
  if (!ODPOCTY.includes(sek)) throw new RangeError('sek');
  const T_PUZZLE = 1.2;
  const T_KONIEC_ODPOCTU = T_PUZZLE + sek;
  const T_RIESENIE = T_KONIEC_ODPOCTU + 0.4;
  const T_KONIEC = T_RIESENIE + 5.5;
  const dlzka = T_KONIEC + 4;
  return { T_PUZZLE, T_KONIEC_ODPOCTU, T_RIESENIE, T_KONIEC, dlzka, snimkov: Math.round(dlzka * FPS) };
}

/** Zvuky: tiky posledných 5 sekúnd odpočtu a akord pri riešení (ako render-short.mjs). */
export function zvuky(sek) {
  const c = casy(sek);
  const out = [];
  for (let k = 5; k >= 1; k--) out.push({ t: +(c.T_KONIEC_ODPOCTU - k).toFixed(3), typ: 'tik' });
  out.push({ t: c.T_RIESENIE, typ: 'akord' });
  return out;
}

/** Mono PCM v rozsahu -1 až 1, vlastný zvuk bez cudzej hudby. */
export function pcm(sek, sr = 48000) {
  const c = casy(sek);
  const N = Math.round(c.dlzka * sr);
  const buf = new Float32Array(N);
  const ton = (t0, dur, freqs, hlas) => {
    const od = Math.round(t0 * sr);
    const po = Math.min(N, Math.round((t0 + dur) * sr));
    for (let i = od; i < po; i++) {
      const x = i / sr - t0;
      const obal = Math.min(1, x / 0.005) * Math.exp((-x * 9) / dur);
      let v = 0;
      for (const f of freqs) v += Math.sin(2 * Math.PI * f * x);
      buf[i] = Math.max(-1, Math.min(1, buf[i] + (v / freqs.length) * obal * hlas));
    }
  };
  for (const z of zvuky(sek)) {
    if (z.typ === 'tik') ton(z.t, 0.09, [1320], 0.18);
    else ton(z.t, 1.6, [523.25, 659.25, 783.99], 0.22);
  }
  return buf;
}

/**
 * SVG z API nemá width ani height, len viewBox. Ako <img> by sa vykreslil v malom predvolenom rozmere
 * a na canvase by bol rozmazaný, preto doplníme rozmer podľa viewBoxu a bezpätkové písmo (obrázok
 * nevidí webové písma stránky).
 */
export function pripravSvg(text, dlhsiaStrana = 1400) {
  const m = String(text).match(/<svg\b[^>]*\bviewBox="\s*([-\d.]+)[\s,]+([-\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"/);
  if (!m) throw new Error('svg_bez_viewbox');
  const vw = Number(m[3]);
  const vh = Number(m[4]);
  if (!(vw > 0 && vh > 0)) throw new Error('svg_bez_viewbox');
  const k = dlhsiaStrana / Math.max(vw, vh);
  const w = Math.round(vw * k);
  const h = Math.round(vh * k);
  const svg = String(text).replace(/<svg\b([^>]*)>/, (cele, attrs) => {
    let a = attrs.replace(/\s(width|height)="[^"]*"/g, '');
    if (!/\sfont-family=/.test(a)) a += ' font-family="Segoe UI, Arial, Helvetica, sans-serif"';
    return `<svg width="${w}" height="${h}"${a}>`;
  });
  return { svg, w, h };
}

// --------------------------------------------------------------------------- rozloženie

/** Zalomí text na riadky do šírky podľa ctx.measureText (ctx.font musí byť nastavené). */
export function zalom(ctx, text, sirka) {
  const slova = String(text).split(/\s+/).filter(Boolean);
  const riadky = [];
  let akt = '';
  for (const s of slova) {
    const skusit = akt ? akt + ' ' + s : s;
    if (!akt || ctx.measureText(skusit).width <= sirka) akt = skusit;
    else { riadky.push(akt); akt = s; }
  }
  if (akt) riadky.push(akt);
  return riadky;
}

const font = (vaha, px) => `${vaha} ${px}px ${PISMO}`;

// Pevné rozloženie. Karta je užšia než v sablona.html (760 namiesto 820), aby jej pravý okraj
// ostal pod hranicou tlačidiel (x 900) aj pod y 1000.
export const ROZLOZENIE = {
  x: 90,
  sirkaTextu: 820,
  znackaY: 170,
  nadpisY: [272, 364],
  pravidloOd: 432,
  odpocetY: 596,
  draha: { x: 220, y: 590, w: 650, h: 12 },
  karta: { x: 110, y: 648, w: 760, h: 760, r: 36, okraj: 48 },
  kreditY: 1452,
  koniec: { x: 90, sirka: 800, velkyY: 640, kreditY: 900, drobneY: 990 },
};

/** Pravidlo v najviac troch riadkoch: skúsi 38, 34 a 30 px. */
export function rozlozPravidlo(ctx, pravidlo) {
  for (const px of [38, 34, 30]) {
    ctx.font = font(400, px);
    const riadky = zalom(ctx, pravidlo, ROZLOZENIE.sirkaTextu);
    if (riadky.length <= 3) return { px, riadky, vyska: Math.round(px * 1.32) };
  }
  ctx.font = font(400, 30);
  return { px: 30, riadky: zalom(ctx, pravidlo, ROZLOZENIE.sirkaTextu).slice(0, 3), vyska: 40 };
}

// --------------------------------------------------------------------------- kreslenie

const orez = (x) => Math.max(0, Math.min(1, x));
const ease = (x) => 1 - Math.pow(1 - orez(x), 3);

function zaoblenyObdlznik(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Nakreslí snímok v čase t. `stav` = volby() plus `zadanie` a `riesenie` (obrázky s width a height,
 * môžu chýbať, kým sa načítavajú). Vráti zoznam viditeľných prvkov {typ, text?, x, y, w, h, alfa}
 * v súradniciach videa; testy z neho overujú bezpečné zóny a kreditný riadok.
 *
 * `kredit`: true pre stiahnuté video (licencia API žiada riadok pri hlavolame), false pre kópiu,
 * ktorá ide do TikToku. TikTok Content Sharing Guidelines, Watermark Guidelines: appka nesmie do
 * zdieľaného obsahu vložiť názov značky, logo, odkaz ani propagačný text. Kópia pre TikTok preto
 * nenesie nič o ARLing ani arling.sk; licencia na /api/#licence na to má výnimku.
 */
export function nakresli(ctx, t, stav, { kredit = true } = {}) {
  const c = casy(stav.sek);
  const L = ROZLOZENIE;
  const prvky = [];
  const text = (retazec, x, y, px, vaha, farba, alfa) => {
    if (alfa <= 0.001) return;
    ctx.globalAlpha = alfa;
    ctx.font = font(vaha, px);
    ctx.fillStyle = farba;
    ctx.fillText(retazec, x, y);
    prvky.push({ typ: 'text', text: retazec, x, y: y - px * 0.8, w: ctx.measureText(retazec).width, h: px, alfa });
  };

  ctx.save();
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = FARBY.papier;
  ctx.fillRect(0, 0, W, H);

  const k = ease((t - c.T_KONIEC) / 0.6); // záver
  const zaklad = 1 - k;

  if (zaklad > 0.001) {
    // Úvod: text a karta priletia zdola.
    const a = ease(t / 0.8) * zaklad;
    const b = ease((t - 0.4) / 0.8) * zaklad;
    const dyA = 40 * (1 - ease(t / 0.8));
    const dyB = 60 * (1 - ease((t - 0.4) / 0.8));

    text(`${stav.nazov}, ${stav.obtiaznost}`.toUpperCase(), L.x, L.znackaY + dyA, 34, 700, FARBY.med, a);
    text('Can you solve it', L.x, L.nadpisY[0] + dyA, 88, 700, FARBY.atrament, a);
    text(`in ${stav.sek} seconds?`, L.x, L.nadpisY[1] + dyA, 88, 700, FARBY.atrament, a);
    const pr = rozlozPravidlo(ctx, stav.pravidlo);
    pr.riadky.forEach((r, i) => text(r, L.x, L.pravidloOd + i * pr.vyska + dyA, pr.px, 400, FARBY.tichy, a));

    // Karta so zadaním, cez ňu sa prelnie riešenie.
    const kt = L.karta;
    if (b > 0.001) {
      ctx.globalAlpha = b;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.45)';
      ctx.shadowBlur = 80;
      ctx.shadowOffsetY = 30;
      ctx.fillStyle = FARBY.karta;
      zaoblenyObdlznik(ctx, kt.x, kt.y + dyB, kt.w, kt.h, kt.r);
      ctx.fill();
      ctx.restore();
      prvky.push({ typ: 'karta', x: kt.x, y: kt.y + dyB, w: kt.w, h: kt.h, alfa: b });
      const r = ease((t - c.T_RIESENIE) / 0.7);
      const obrazok = (img, alfa, typ) => {
        if (!img || !img.width || !img.height || alfa <= 0.001) return;
        const vnutro = kt.w - 2 * kt.okraj;
        const m = Math.min(vnutro / img.width, vnutro / img.height);
        const w = img.width * m;
        const h = img.height * m;
        const x = kt.x + (kt.w - w) / 2;
        const y = kt.y + dyB + (kt.h - h) / 2;
        ctx.globalAlpha = alfa;
        ctx.drawImage(img, x, y, w, h);
        prvky.push({ typ, x, y, w, h, alfa });
      };
      obrazok(stav.zadanie, b * (1 - r), 'zadanie');
      obrazok(stav.riesenie, b * r, 'riesenie');
    }

    // Odpočet, potom štítok Solution na tom istom mieste.
    const zostava = Math.max(0, c.T_KONIEC_ODPOCTU - Math.max(t, c.T_PUZZLE));
    const o = ease((t - c.T_PUZZLE + 0.6) / 0.6) * (1 - ease((t - c.T_RIESENIE) / 0.4)) * zaklad;
    if (o > 0.001) {
      text(`${Math.ceil(zostava - 1e-9)} s`, L.x, L.odpocetY, 50, 700, FARBY.atrament, o);
      const d = L.draha;
      ctx.globalAlpha = o;
      ctx.fillStyle = FARBY.draha;
      zaoblenyObdlznik(ctx, d.x, d.y, d.w, d.h, d.h / 2);
      ctx.fill();
      const plne = d.w * (zostava / stav.sek);
      if (plne > d.h) {
        ctx.fillStyle = FARBY.med;
        zaoblenyObdlznik(ctx, d.x, d.y, plne, d.h, d.h / 2);
        ctx.fill();
      }
      prvky.push({ typ: 'draha', x: d.x, y: d.y, w: d.w, h: d.h, alfa: o, zostava });
    }
    const rs = ease((t - c.T_RIESENIE) / 0.7) * zaklad;
    text('Solution', L.x, L.odpocetY - 20 * (1 - ease((t - c.T_RIESENIE) / 0.7)) + 14, 44, 700, FARBY.med, rs);

    // Kreditný riadok podľa licencie API: od prvého snímku pod kartou, kým ho nezakryje záver.
    if (kredit) text(KREDIT, kt.x, L.kreditY, 30, 400, FARBY.tichy, zaklad);
  }

  if (k > 0.001) {
    const kn = L.koniec;
    const dy = 30 * (1 - k);
    ctx.globalAlpha = k;
    ctx.fillStyle = FARBY.papier;
    ctx.fillRect(0, 0, W, H);
    ctx.font = font(700, 96);
    const velky = zalom(ctx, 'How long did it take you?', kn.sirka);
    velky.forEach((r, i) => text(r, kn.x, kn.velkyY + i * 100 + dy, 96, 700, FARBY.atrament, k));
    const posun = (velky.length - 2) * 100;
    if (kredit) text(KREDIT, kn.x, kn.kreditY + posun + dy, 56, 700, FARBY.med, k);
    const drobneY = kredit ? kn.drobneY : kn.kreditY;
    ctx.font = font(400, 36);
    zalom(ctx, 'This puzzle has exactly one solution, checked by the program that made it.', kn.sirka)
      .forEach((r, i) => text(r, kn.x, drobneY + posun + i * 48 + dy, 36, 400, FARBY.tichy, k));
  }

  ctx.restore();
  return prvky;
}

/** Je prvok celý v bezpečnej zóne? */
export function vBezpecnejZone(p, z = BEZPECNE) {
  const prava = p.x + p.w;
  const spodna = p.y + p.h;
  if (p.x < z.vlavo || p.y < z.hore || prava > z.vpravo || spodna > z.dole) return false;
  if (spodna > z.tlacidlaOdY && prava > z.tlacidlaOdX) return false;
  return true;
}
