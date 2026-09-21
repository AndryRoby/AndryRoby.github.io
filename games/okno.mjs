/* The window of built day pages, shared by the eleven daily games and by
 * their generators. ops/games/okno.mjs re-exports this file, so the number
 * below lives in one place only.
 *
 * A day has a page of its own, /games/<game>/YYYY-MM-DD/, only while it is
 * at most OKNO_DNI days old (future days included, the generators build them
 * ahead). An older day has no page: its puzzle stays in dni/YYYY-MM.json and
 * opens on the game page as /games/<game>/?d=YYYY-MM-DD. The reason is size:
 * the hub is served by GitHub Pages, a published site may take 1 GB, and a
 * page per day per game forever does not fit.
 *
 * No imports and no DOM in here, so the browser and node read the same file.
 */
export const OKNO_DNI = 90;

/* The browser links to a built page only when the day sits this many days
 * inside the window. A visitor whose clock runs a day behind must not be
 * sent to a page the last build has just removed, and ?d= opens every day
 * anyway, so being careful costs nothing. */
export const REZERVA_DNI = 2;

const DEN_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/* A real calendar date written as YYYY-MM-DD, nothing else. */
export function jePlatnyDen(s) {
  if (typeof s !== 'string') return false;
  const m = DEN_RE.exec(s);
  if (!m) return false;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (y < 1 || mo < 1 || mo > 12 || d < 1) return false;
  const priestupny = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  return d <= [31, priestupny ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1];
}

export function posunDen(iso, k) {
  const t = new Date(iso + 'T00:00:00Z');
  t.setUTCDate(t.getUTCDate() + k);
  return t.toISOString().slice(0, 10);
}

/* The oldest day that still has a page of its own when the build runs on `dnes`. */
export function prvyDenOkna(dnes, okno = OKNO_DNI) {
  return posunDen(dnes, -okno);
}

/* The generators' rule: is a page written for day d? Future days count as
 * inside; how far ahead they go is the generator's --dopredu. */
export function maStranku(d, dnes, okno = OKNO_DNI) {
  return d >= prvyDenOkna(dnes, okno);
}

/* The value of ?d= as a day that may be played, or null. Only a real date
 * between the first day of the game and today passes: no future day, no
 * day before the archive starts, no other text. */
export function denZParametra(hodnota, prvyDen, dnes) {
  if (!jePlatnyDen(hodnota) || !jePlatnyDen(prvyDen) || !jePlatnyDen(dnes)) return null;
  return hodnota >= prvyDen && hodnota <= dnes ? hodnota : null;
}

/* The address of a day that works forever, whether or not the day still has
 * a page: for a shared link. zaklad is '/games/hedgehogs/' or the same with
 * the domain in front. */
export function trvalaAdresaDna(zaklad, d) {
  return zaklad + '?d=' + d;
}

/* The address the browser links a day to: the built page while the day is
 * safely inside the window, the game page with ?d= otherwise. */
export function adresaDna(zaklad, d, dnes) {
  return d >= posunDen(dnes, -(OKNO_DNI - REZERVA_DNI)) ? zaklad + d + '/' : trvalaAdresaDna(zaklad, d);
}
