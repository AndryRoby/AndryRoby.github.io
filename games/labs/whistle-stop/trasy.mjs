/* Whistle Stop M0: trasy ľudí v interiéri zhora (nález 1 brány M0, pokus 2). Cez pult ani nábytok sa nechodí.
   Prekážka je každé miesto nábytku (aj prázdne, miesto je vyhradené) zväčšené o polomer postavy s vrecom
   a rezervu; pult navyše so zónou predavača za ním. Trasa je najkratšia cesta v grafe viditeľnosti rohov
   prekážok (Dijkstra, najviac 26 uzlov). Počíta sa len pri novom cieli, nie v každej snímke. Čisté funkcie,
   súradnice pozemku obchodu (pôdorys x 0..720, y -540..0, dvere dole v strede). */

// Najďalší bod človeka zhora od stredu (scena.mjs kresliClovekaZhora) aj s obrysom 1,5: plecia 27 + 1,5,
// klobúk 21 + 1,5, vrece v ruke stredom 18,4 od stredu s polomerom 9, spolu 28,9.
export const POLOMER = 29;
export const REZERVA = 3;
const C = POLOMER + REZERVA;
// Vnútro podlahy (stena 24 jednotiek) a prah dverí x 310..410 v dolnej stene; vonku za dverami y 20.
export const PODLAHA = { x0: 24, x1: 696, y0: -516, y1: -24 };
export const DVERE = { x: 360, y: 20, x0: 310, x1: 410 };
// Predavač stojí 30 nad pultom (telo 29): jeho zóna patrí k prekážke pultu, zákazník za ním neprejde.
export const PREDAVAC_NAD = 30;
export const ZA_PULTOM = PREDAVAC_NAD + POLOMER + 1;
// Zákazníci čakajú na obsluhu 96 pod pultom (pod jeho menovkou) v pásme 50 od jeho koncov.
export const PRED_PULTOM = 96, OD_KONCA_PULTU = 50;

// Prekážky pre stred človeka: miesta zväčšené o C (štvorcové rohy, teda s rezervou aj na uhlopriečke).
export function prekazky(miesta) {
  return miesta.map((q, i) => ({ x0: q.x - C, y0: q.y - (i === 0 ? ZA_PULTOM : 0) - C, x1: q.x + q.w + C, y1: q.y + q.h + C }));
}

const Y_VNUTRI = PODLAHA.y1 - C;          // najnižší stred človeka vo vnútri, pod ním už len prah dverí
const vDverach = (x, y) => y > Y_VNUTRI;

// Stred človeka môže stáť v bode: v podlahe s okrajom C a mimo prekážok (v dverách len v osi prahu).
export function volne(x, y, P) {
  if (vDverach(x, y)) return Math.abs(x - DVERE.x) <= (DVERE.x1 - DVERE.x0) / 2 - C && y <= DVERE.y;
  if (x < PODLAHA.x0 + C || x > PODLAHA.x1 - C || y < PODLAHA.y0 + C) return false;
  for (const r of P) if (x > r.x0 && x < r.x1 && y > r.y0 && y < r.y1) return false;
  return true;
}

// Úsečka nepretína vnútro žiadnej prekážky (Liang a Barsky, dotyk hrany je dovolený).
function useckaVolna(ax, ay, bx, by, P) {
  const dx = bx - ax, dy = by - ay;
  for (const r of P) {
    let t0 = 0, t1 = 1, von = false;
    for (const [p, q] of [[-dx, ax - r.x0], [dx, r.x1 - ax], [-dy, ay - r.y0], [dy, r.y1 - ay]]) {
      if (Math.abs(p) < 1e-9) { if (q <= 1e-6) { von = true; break; } continue; }
      const t = q / p;
      if (p < 0) { if (t > t0) t0 = t; } else if (t < t1) t1 = t;
      if (t0 >= t1 - 1e-9) { von = true; break; }
    }
    if (!von) return false;
  }
  return true;
}

// Uzly grafu: rohy prekážok posunuté o 1 von, ktoré sú voľné. Pre dané miesta sa počítajú raz.
const UZLY = new WeakMap();
function uzly(P) {
  let u = UZLY.get(P);
  if (u) return u;
  u = [];
  for (const r of P) for (const [x, y] of [[r.x0 - 1, r.y0 - 1], [r.x1 + 1, r.y0 - 1], [r.x0 - 1, r.y1 + 1], [r.x1 + 1, r.y1 + 1]]) if (volne(x, y, P)) u.push([x, y]);
  UZLY.set(P, u);
  return u;
}

// Najkratšia cesta vnútri (oba body vo vnútri podlahy). Vracia body bez začiatku, s cieľom; null ak nejde.
function vnutri(ax, ay, bx, by, P) {
  if (useckaVolna(ax, ay, bx, by, P)) return [[bx, by]];
  const N = [[ax, ay], ...uzly(P), [bx, by]], n = N.length;
  const d = new Array(n).fill(Infinity), z = new Array(n).fill(-1), hotovy = new Array(n).fill(false);
  d[0] = 0;
  for (;;) {
    let i = -1;
    for (let k = 0; k < n; k++) if (!hotovy[k] && d[k] < Infinity && (i < 0 || d[k] < d[i])) i = k;
    if (i < 0 || i === n - 1) break;
    hotovy[i] = true;
    for (let k = 0; k < n; k++) {
      if (hotovy[k]) continue;
      const w = d[i] + Math.hypot(N[k][0] - N[i][0], N[k][1] - N[i][1]);
      if (w < d[k] && useckaVolna(N[i][0], N[i][1], N[k][0], N[k][1], P)) { d[k] = w; z[k] = i; }
    }
  }
  if (d[n - 1] === Infinity) return null;
  const cesta = [];
  for (let k = n - 1; k > 0; k = z[k]) cesta.unshift(N[k]);
  return cesta;
}

// Trasa z (ax, ay) do (bx, by). Kto je v dverách alebo za nimi, ide najprv v osi prahu dnu (a von rovnako).
// Vracia body bez začiatku, posledný je cieľ; null, keď cesta neexistuje (test stráži, že v hre nenastane).
export function trasa(ax, ay, bx, by, P) {
  const dnu = [DVERE.x, Y_VNUTRI];
  const zac = vDverach(ax, ay) ? dnu : [ax, ay], kon = vDverach(bx, by) ? dnu : [bx, by];
  const stred = vnutri(zac[0], zac[1], kon[0], kon[1], P);
  if (!stred) return null;
  const out = [];
  if (zac === dnu && (ax !== dnu[0] || ay !== dnu[1])) out.push(dnu);
  out.push(...stred);
  if (kon === dnu) out.push([bx, by]);
  // bez nulových krokov (napr. začiatok priamo v bode dnu); prázdna trasa = človek už stojí v cieli
  const res = [];
  let px = ax, py = ay;
  for (const p of out) if (p[0] !== px || p[1] !== py) { res.push(p); px = p[0]; py = p[1]; }
  return res;
}

// Kruh človeka (polomer POLOMER) zasahuje do obdĺžnika { x, y, w, h }.
export function podStitkom(x, y, stitky) {
  for (const r of stitky) if (Math.hypot(Math.max(r.x - x, 0, x - r.x - r.w), Math.max(r.y - y, 0, y - r.y - r.h)) < POLOMER) return true;
  return false;
}

// Kde si človek kus pozrie: voľný bod o C + 2 od hrany kusu, ktorý nie je pod menovkou (nález 2 brány M0
// pokus 2). Strany v poradí dole, hore, vľavo, vpravo; na každej od stredu k okrajom po 10 jednotiek.
// Volá sa len pri prekreslení menoviek, nie v snímke.
export function bodPohladu(q, P, stitky = []) {
  const cx = q.x + q.w / 2, cy = q.y + q.h / 2, o = C + 2;
  const strany = [[true, q.y + q.h + o, q.w], [true, q.y - o, q.w], [false, q.x - o, q.h], [false, q.x + q.w + o, q.h]];
  for (const [vodorovne, pevna, dlzka] of strany) {
    for (let d = 0; d <= dlzka / 2 + 20; d += 10) for (const z of d ? [1, -1] : [1]) {
      const x = vodorovne ? cx + z * d : pevna, y = vodorovne ? pevna : cy + z * d;
      // dosiahnuteľný od dverí (voľný kút za pecou nestačí)
      if (volne(x, y, P) && !podStitkom(x, y, stitky) && trasa(DVERE.x, DVERE.y, x, y, P)) return { x, y };
    }
  }
  return null;
}
