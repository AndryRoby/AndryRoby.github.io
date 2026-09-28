/* Whistle Stop M0: kamera (GDD 2.5). Čisté funkcie polohy, bez DOM.
   Mobil na výšku: jedna budova na 80 % šírky a po 10 % susedov, švih so snapom na celú budovu, hybnosť preskočí
   najviac 2 budovy. Počítač: celá ulica naraz, ak sa zmestí. Svet je v jednotkách pozemku (720 na budovu). */

export const POZEMOK = 720;          // šírka pozemku v jednotkách sveta
export const MEDZERA = 150;          // ulička medzi budovami
export const KROK = POZEMOK + MEDZERA;

// Stred budovy i vo svete (budova 0 začína na x = 0).
export function stredBudovy(i) { return i * KROK + POZEMOK / 2; }
export function dlzkaUlice(pocet) { return pocet * POZEMOK + (pocet - 1) * MEDZERA; }

// Rozloženie podľa okna: mierka (px na jednotku) a či je režim jednej budovy.
export function rozlozenie(sirka, vyska, pocet) {
  const naVysku = sirka < 760 || sirka / Math.max(vyska, 1) < 0.9;
  if (naVysku) return { jednaBudova: true, mierka: (sirka * 0.8) / POZEMOK };
  const okraj = 0.12 * sirka;
  return { jednaBudova: false, mierka: Math.min((sirka - 2 * okraj) / dlzkaUlice(pocet), (vyska * 0.5) / 1400) };
}

// Kam dosadne švih: poloha kamery (stred obrazovky vo svete), rýchlosť (jednotky sveta za s, kladná = doprava
// vo svete, teda ťah prstom doľava), aktuálna budova a počet budov. Vždy celá budova, najviac 2 od aktuálnej.
export function cielSvihu(poloha, rychlost, aktualna, pocet) {
  const projekcia = poloha + rychlost * 0.22;        // kde by kamera zastala trením
  let i = Math.round((projekcia - POZEMOK / 2) / KROK);
  i = Math.max(aktualna - 2, Math.min(aktualna + 2, i));
  // krátky rýchly švih posunie aspoň o jednu budovu, aj keď projekcia nedosiahne polovicu
  if (i === aktualna && Math.abs(rychlost) > 900) i += Math.sign(rychlost);
  return Math.max(0, Math.min(pocet - 1, i));
}

// Z klávesnice: šípky o jednu, 1 až 9 priamo.
export function cielKlavesy(kluc, aktualna, pocet) {
  if (kluc === 'ArrowRight') return Math.min(pocet - 1, aktualna + 1);
  if (kluc === 'ArrowLeft') return Math.max(0, aktualna - 1);
  const c = Number(kluc);
  if (Number.isInteger(c) && c >= 1 && c <= Math.min(9, pocet)) return c - 1;
  return aktualna;
}
