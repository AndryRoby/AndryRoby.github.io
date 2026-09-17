/* Badgers (Killer Sudoku) pre knihu: mriežka s hrubými hranicami blokov,
   prerušovaný obrys každej ohrady a jej súčet v ľavom hornom rohu. Na zadaní
   nie je vyplnené nič, celý hlavolam sú ohrady. Súčet sedí na malom bielom
   podklade, aby ho prerušovaná čiara nikdy neprekrížila. */
import { S, obal, obdlznik, mriezka, text, obrysOhrady } from './spolocne.mjs';

const P = 16;
const ODSUN = 11;

function blok(n) {
  const vyska = n === 9 ? 3 : n === 6 ? 2 : 2;
  const sirka = n === 9 ? 3 : n === 6 ? 3 : 2;
  return (r, c, smer) => (smer === 'h' ? r % vyska === 0 : c % sirka === 0);
}

function ohrady(p) {
  const n = p.n, out = [];
  for (const cage of p.cages) {
    out.push(obrysOhrady(P, P, cage.cells, n, ODSUN));
    const i = Math.min.apply(null, cage.cells);
    const r = (i / n) | 0, c = i % n;
    const x = P + c * S + ODSUN + 3, y = P + r * S + ODSUN + 3;
    const sirka = String(cage.sum).length * 19 + 8;
    out.push(obdlznik(x - 3, y - 1, sirka, 32, '#fff'));
    out.push(text(x + 1, y + 15, cage.sum, 30, { kotva: 'start', tucne: true }));
  }
  return out.join('');
}

export function zadanie(p) {
  const w = p.n * S + 2 * P;
  return obal(w, w, mriezka(P, P, p.n, blok(p.n)) + ohrady(p));
}

/* Riešenie je len mriežka s číslami. Prerušované ohrady a ich súčty by na
   šestine strany ležali cez číslice a z riešenia by sa stala šedá kaša; kto si
   chce riešenie overiť, má zadanie na svojej strane. */
export function riesenie(p) {
  const n = p.n, w = n * S + 2 * P, out = [mriezka(P, P, n, blok(n))];
  for (let i = 0; i < n * n; i++) {
    const r = (i / n) | 0, c = i % n;
    out.push(text(P + c * S + S / 2, P + r * S + S / 2, p.solution[i], 54));
  }
  return obal(w, w, out.join(''));
}

export const popisMriezky = (p) => p.n + ' x ' + p.n;
