// Tumble Dojo: šesť majstrov (V3-NAVRH 3.2), každý je prekrytie základných parametrov AI.
// Férovosť platí pre všetkých (ai.js). Výzor majstra je len kresba, AI od neho nezávisí.
// Otter, Badger a Crane doladení 26. 9. (V3-STAV, Dokončenie).
import { UROVNE, mnozina } from './ai.js';
import { PB, CO, FE, FL, TH, DP, RP, GW, PT, BL, ET } from './kombo.js';

const VSETKY = [PB, CO, FE, FL, TH, DP, RP, GW, PT, BL, ET];
const Z = (baza, x) => Object.assign({}, UROVNE[baza], x);
export const MAJSTRI = [
  { meno: 'Hedgehog', veta: 'Curls up and braces.', tip: 'Brace guards only the front. Step around it, or grab the belt.', znak: PB,
    kit: { k: 'k1', p: 'p2', b: 'b1', h: 'h0' }, alt: 'k5',
    par: Z('easy', { zapri: 1, vzdyZapri: true, kombo: 0, set: mnozina([]), rMin: 0.46, rMax: 0.46, nadych: 0.45, spravne: 0, rychly: true, chmat: 0.4, cakMin: 0.3, cakMax: 0.8 }) },
  { meno: 'Hare', veta: 'Quick feet, lunges first.', tip: 'Brace just before the lunge lands, then Lunge back: COUNTER.', znak: RP,
    kit: { k: 'k4', p: 'p0', b: 'b2', h: 'h0' }, alt: 'k3',
    par: Z('easy', { cakMin: 0, cakMax: 0.04, nadych: 0.17, rMin: 0.42, rMax: 0.42, spravne: 0.15, kombo: 0.2, set: mnozina([DP, RP]), chmat: 0.1, rychly: true, start: 0.3 }) },
  { meno: 'Otter', veta: 'Slips to the side.', tip: 'Short taps. Do not throw your whole weight at a slippery rival.', znak: GW,
    kit: { k: 'k3', p: 'p4', b: 'b3', h: 'h0' }, alt: 'k4',
    par: Z('normal', { rMin: 0.22, rMax: 0.22, spravne: 0.6, bok: 0.9, uhyb: 0.65, kombo: 0.35, set: mnozina([GW, FL]), max2: false, chmat: 0.15, zapri: 0, cakMin: 0.2, cakMax: 0.5 }) },
  { meno: 'Badger', veta: 'Takes the belt.', tip: 'A lunge beats a grab while the hands reach. Step away from the belt.', znak: BL,
    kit: { k: 'k1', p: 'p3', b: 'b4', h: 'h0' }, alt: 'k5',
    par: Z('normal', { chmat: 1, kombo: 0.6, spravne: 0.3, rMin: 0.28, rMax: 0.28, set: mnozina([TH, BL, PT]), max2: true, zapri: 0 }) },
  { meno: 'Magpie', veta: 'Tricks and feints.', tip: 'Do not brace too early. Watch the held lunge, step when they step.', znak: FE,
    kit: { k: 'k5', p: 'p1', b: 'b5', h: 'h0' }, alt: 'k2',
    par: Z('normal', { rMin: 0.28, rMax: 0.28, spravne: 0.45, kombo: 0.55, set: mnozina([FE, FL]), zapri: 0.45, navnada: 0.5, max2: false }) },
  { meno: 'Crane', veta: 'Balance at the rope.', tip: 'Keep the Crane away from the rope. Push from the side, not straight.', znak: ET,
    kit: { k: 'k6', p: 'p0', b: 'b6', h: 'h2' }, alt: 'k0',
    par: Z('hard', { set: mnozina(VSETKY), etSanca: 0.9, lano: 0.15, rMin: 0.2, rMax: 0.2, dup: true }) }
];
// Gentle (majstri 1 až 5, hráč si ho vyberie po 3 prehrách): reakcia +0,12 s, správne x0,7, kombo x0,5
export function parametre(i, gentle) {
  const p = MAJSTRI[i].par;
  if (!gentle || i >= 5) return p;
  return Object.assign({}, p, { rMin: p.rMin + 0.12, rMax: p.rMax + 0.12, spravne: p.spravne * 0.7, kombo: p.kombo * 0.5 });
}
export const gentleSmie = (i, prehry) => i < 5 && prehry >= 3;
// zhoda farieb: majster pri rovnakom kimone ako hráč oblečie náhradné
export function vyzorMajstra(i, hrac) {
  const m = MAJSTRI[i], k = Object.assign({}, m.kit);
  if (hrac && hrac.k === k.k) k.k = m.alt;
  return k;
}
// súper vo voľnej hre: modré kimono, pri modrom hráčovi oranžové
export function vyzorAI(hrac) { return { k: hrac && hrac.k === 'k1' ? 'k0' : 'k1', p: 'p1', b: 'b0', h: 'h0' }; }
export const PAS = ['Yellow', 'Orange', 'Green', 'Blue', 'Purple', 'Black'];
export const PAS_INK = ['sun', 'orange', 'green', 'blue', 'plum', 'night'];
