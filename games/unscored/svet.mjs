// UNSCORED: geometria štvrte Lower Weir. Čistý modul bez DOM (testy v node).
// Všetko je v jednotkách sveta (1000 x 760), deterministicky zo semienka.

export const SVET = { w: 1000, h: 760 };

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const hash = (a, b = 0) => {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 13; h = Math.imul(h, 0x27d4eb2f); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

export const ULICE = {
  sirka: 22,
  vodorovne: [
    { meno: 'Kiln Lane', y: 190 },
    { meno: 'Lamp Street', y: 360 },
    { meno: 'Weir Street', y: 540 },
  ],
  zvisle: [
    { meno: 'Mill Stair', x: 150 },
    { meno: "Tanner's Row", x: 420 },
    { meno: 'Sluice Lane', x: 690 },
    { meno: 'Ferry Steps', x: 900 },
  ],
};

export const RIEKA = { hore: 566, dole: 704, splav: [[604, 566], [676, 704]], lavka: 278 };

// Bloky: pásy medzi ulicami x stĺpce medzi priečnymi ulicami.
const PASY = [[40, 179], [201, 349], [371, 529]];
const STLPCE = [[26, 139], [161, 409], [431, 679], [701, 889], [911, 974]];
// Úrad Civic Credit (sklo Správcu) zaberá blok pás 0, stĺpec 2.
export const URAD = { x: 446, y: 58, w: 218, h: 104, meno: 'Civic Credit Office' };

// Kamery Správcu: stĺp na križovatke, stredný uhol (radiány, 0 = východ, y dole), rozkmit, dĺžka, perióda.
export const STLPY = [
  { x: 420, y: 190, uhol: Math.PI * 0.5, rozkmit: 0.62, dlzka: 200, perioda: 12.5, faza: 0 },
  { x: 690, y: 360, uhol: Math.PI, rozkmit: 0.55, dlzka: 215, perioda: 10.8, faza: 2.1 },
  { x: 150, y: 540, uhol: -Math.PI * 0.32, rozkmit: 0.5, dlzka: 190, perioda: 13.6, faza: 4.4 },
  { x: 900, y: 540, uhol: -Math.PI * 0.7, rozkmit: 0.55, dlzka: 200, perioda: 11.7, faza: 1.3 },
];

// Uzly mapy súvislostí. x, y = stred kartičky; rodic = kam vedie nitka.
export const UZLY = [
  { id: 'ty', x: 505, y: 292, rot: -2, popis: 'Flat 4C · score 0', stitok: 'You. Flat 4C, 14 Lamp Street. Score 0.', rodic: null },
  { id: 'sused', x: 598, y: 322, rot: 3, popis: 'Flat 4D', stitok: 'Flat 4D, across the hall. The first one who listened.', rodic: 'ty' },
  { id: 'ulica', x: 404, y: 352, rot: -3, popis: 'Lamp Street', stitok: 'Lamp Street. Five windows are yours now.', rodic: 'ty' },
  { id: 'kurier', x: 636, y: 414, rot: 4, popis: 'the courier', stitok: 'The courier. Paper moves where screens cannot.', rodic: 'ty' },
  { id: 'zapisnik', x: 372, y: 246, rot: -4, popis: 'notebook', stitok: 'Notebook. Names written down stay written down.', rodic: 'ty' },
  { id: 'krieda', x: 478, y: 458, rot: 2, popis: 'chalk', stitok: 'Chalk. A mark on a door the cameras cannot read.', rodic: 'ulica' },
  { id: 'bunka', x: 290, y: 318, rot: 3, popis: 'the cell', stitok: 'The cell. Twenty five people who trust each other.', rodic: 'ty' },
  { id: 'bicykel', x: 772, y: 296, rot: -3, popis: 'bicycle', stitok: 'Bicycle. No chip, no route history.', rodic: 'kurier' },
  { id: 'mira', x: 588, y: 488, rot: -2, popis: 'Mira Hale', stitok: 'Mira Hale, 34, night nurse.', rodic: 'ty' },
  { id: 'pisaci', x: 236, y: 238, rot: 4, popis: 'typewriter', stitok: 'Typewriter. A machine that cannot be updated.', rodic: 'bunka' },
  { id: 'tlaciar', x: 214, y: 440, rot: -4, popis: 'leaflets', stitok: 'Leaflets. Now it spreads while you sleep.', rodic: 'pisaci' },
  { id: 'tomas', x: 330, y: 132, rot: 2, popis: 'Tomas Brenner', stitok: 'Tomas Brenner, 41, camera technician.', rodic: 'ty' },
  { id: 'ruth', x: 356, y: 500, rot: 3, popis: 'Old Ruth', stitok: 'Old Ruth, 77, retired typesetter.', rodic: 'ty' },
  { id: 'weir', x: 700, y: 626, rot: -2, popis: 'the weir', stitok: 'The weir. Half the district lives by the water.', rodic: 'ulica' },
  { id: 'kopirak', x: 96, y: 300, rot: -3, popis: 'carbon paper', stitok: 'Carbon paper. One page, three copies.', rodic: 'ruth' },
  { id: 'zadna', x: 826, y: 452, rot: 3, popis: 'back room', stitok: 'Back room. Quiet enough to think.', rodic: 'bunka' },
];

export const KARTA = { w: 64, h: 52 };

function domy(r) {
  const out = [];
  for (let p = 0; p < PASY.length; p++) {
    const [T, B] = PASY[p];
    for (let s = 0; s < STLPCE.length; s++) {
      const [L, R] = STLPCE[s];
      if (p === 0 && s === 2) continue; // úrad
      // zadný rad (vyššie, menší), potom predný rad (pri ulici)
      const rady = [
        { zem: T + Math.round((B - T) * 0.5), vMin: 28, vMax: 40, rad: 0 },
        { zem: B - 1, vMin: 30, vMax: 46, rad: 1 },
      ];
      for (const rd of rady) {
        let x = L + 1;
        while (x < R - 14) {
          let w = 20 + Math.floor(r() * 15);
          if (R - (x + w) < 18) w = R - x - 1;
          if (w < 14) break;
          const h = rd.vMin + Math.floor(r() * (rd.vMax - rd.vMin));
          const strecha = 9 + Math.floor(r() * 8);
          const stit = r() < 0.28 && w < 30;
          const komin = r() < 0.45;
          const tien = r() < 0.5;
          out.push({ x, zem: rd.zem, w, h, strecha, stit, komin, tien, rad: rd.rad, pas: p, stlpec: s });
          x += w + (r() < 0.12 ? 7 : r() < 0.4 ? 1 : 0);
        }
      }
    }
  }
  return out;
}

export const OKNO = { w: 4.5, h: 6.5 };

function okna(zoznam) {
  const out = [];
  zoznam.forEach((d, di) => {
    const top = d.zem - d.h;
    const poschodia = Math.max(1, Math.floor((d.h - 13) / 10.5));
    const k = Math.max(1, Math.floor((d.w - 5) / 8.5));
    const krok = (d.w - 2) / k;
    for (let f = 0; f < poschodia; f++) {
      const y = top + 5 + f * 10.5;
      for (let i = 0; i < k; i++) {
        const x = d.x + 1 + krok * (i + 0.5) - OKNO.w / 2;
        out.push({ x: Math.round(x * 2) / 2, y: Math.round(y * 2) / 2, dom: di });
      }
    }
    // prízemie: dvere a jedno okno, ak je dom dosť široký
    if (d.w >= 22) out.push({ x: d.x + d.w - 9, y: d.zem - 10.5, dom: di });
  });
  return out;
}

export function obalKarty(u, okraj = 4) {
  const w = KARTA.w + 10 + okraj * 2;
  const h = KARTA.h + 12 + okraj * 2;
  return { x: u.x - w / 2, y: u.y - h / 2 - 4, w, h };
}

const prekryva = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export function postavSvet(seed = 7) {
  const r = rng(seed);
  const zoznamDomov = domy(r);
  const vsetkyOkna = okna(zoznamDomov);
  const karty = UZLY.map((u) => obalKarty(u));
  const ty = UZLY[0];
  // okná pod kartičkami nepatria nikomu
  const okn = vsetkyOkna.filter((o) => !karty.some((k) => prekryva(k, { x: o.x - 1, y: o.y - 1, w: OKNO.w + 2, h: OKNO.h + 2 })));
  okn.forEach((o, i) => {
    o.id = i;
    o.cx = o.x + OKNO.w / 2;
    o.cy = o.y + OKNO.h / 2;
    o.poradie = Math.hypot(o.cx - ty.x, (o.cy - ty.y) * 1.15) + hash(i, 11) * 40;
  });
  const poradie = okn.map((o) => o.id).sort((a, b) => okn[a].poradie - okn[b].poradie);
  const stromy = [];
  for (let i = 0; i < 26; i++) stromy.push({ x: 30 + i * 37 + r() * 14, y: 718 + r() * 16, r: 6 + r() * 4 });
  // záhrady: pás medzi zadným radom a strechami predného radu v každom bloku
  const zahrady = [];
  for (const [T, B] of PASY) {
    const zem = T + Math.round((B - T) * 0.5);
    for (let s = 0; s < STLPCE.length; s++) {
      if (T === PASY[0][0] && s === 2) continue;
      zahrady.push({ x: STLPCE[s][0] + 2, y: zem + 1.5, w: STLPCE[s][1] - STLPCE[s][0] - 4 });
    }
  }
  return { ...SVET, ulice: ULICE, rieka: RIEKA, urad: URAD, stlpy: STLPY, uzly: UZLY, domy: zoznamDomov, okna: okn, poradieOkien: poradie, stromy, zahrady };
}

export const uzol = (id) => UZLY.find((u) => u.id === id);
