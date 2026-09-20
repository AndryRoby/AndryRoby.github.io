/* Kontrola tvaru a prufziffer nemeckej Leitweg-ID (A-101).
 *
 * Preco samostatny subor: pristavna stranka /efaktura/de/leitweg-id/ ma nad zahybom
 * male tlacidlo zadarmo (vloz Leitweg-ID, povieme ti, ci sedi). Dopyt "leitweg id" je
 * informacny, nie nakupny: za 127 platenych klikov nekupil nikto, lebo stranka
 * najprv odpovie zadarmo a potom pyta celu fakturu a 2,90 €. Kontrola je to jedine,
 * co clovek s Leitweg-ID v ruke naozaj chce hned urobit.
 *
 * Preco nie v pravidla.mjs: tam je ARL-LEITWEG, ktore kontroluje iba tvar retazca
 * v uz hotovej fakture a zamerne nepocita prufziffer (falosny poplach pri internych
 * referenciach, ktore nie su Leitweg-ID). Tu ide o vedomy vstup jednej Leitweg-ID,
 * takze sa pocita aj prufziffer. Ziadna z dvoch funkcii nevola tu druhu.
 *
 * Algoritmus (Leitweg-ID Formatspezifikation 2.0.2, KoSIT):
 *   Grobadressierung    2 az 12 cislic
 *   Feinadressierung    volitelna, za pomlckou, 1 az 30 znakov A-Z a 0-9
 *   Prufziffer          2 cislice, ISO 7064 MOD 97-10 nad spojenim Grob+Fein bez
 *                       pomlciek, pismena ako v IBAN A=10 ... Z=35, cize
 *                       98 - ((cislo * 100) mod 97)
 * Overene na vzorovej ID zo specifikacie 2.0: 991-33333TEST-33 (tento kod vrati 33).
 *
 * Bez DOM a bez window, aby sa dal spustit aj v teste na Node
 * (products/arling-sk/efaktura/tests.mjs).
 */

/* Zvysok po deleni 97 pre retazec, kde sa pismeno berie ako dve cislice (A=10..Z=35).
 * Pocita sa po znakoch, aby sa cislo nikdy nedostalo za Number.MAX_SAFE_INTEGER. */
export function mod97(retazec) {
  let zvysok = 0;
  for (const znak of String(retazec).toUpperCase()) {
    let hodnota;
    if (znak >= '0' && znak <= '9') hodnota = znak.charCodeAt(0) - 48;
    else if (znak >= 'A' && znak <= 'Z') hodnota = znak.charCodeAt(0) - 55;
    else return null; // volajuci si znaky overil, sem sa nic ine nema dostat
    zvysok = (zvysok * (hodnota > 9 ? 100 : 10) + hodnota) % 97;
  }
  return zvysok;
}

/* Prufziffer pre uz ocistenu Grobadressierung + Feinadressierung, vzdy dva znaky. */
export function prufziffer(zaklad) {
  const zvysok = mod97(String(zaklad) + '00');
  if (zvysok === null) return null;
  return String(98 - zvysok).padStart(2, '0');
}

const CISLICE = /^[0-9]+$/;
const ALFANUM = /^[0-9A-Za-z]+$/;

/* Vrati { ok, kod, ... }. Kody su strojove, text si sklada stranka vo svojom jazyku:
 *   prazdne          nic nezadane
 *   znaky            iny znak nez cislica, pismeno alebo pomlcka
 *   bez-pruefziffer  na konci nie je pomlcka a dve cislice
 *   grob             Grobadressierung nie je 2 az 12 cislic
 *   fein             Feinadressierung je prazdna, dlhsia nez 30 alebo ma zly znak
 *   pruefziffer      tvar sedi, prufziffer nie (v ocakavana je spravna)
 *   ok               plati
 */
export function skontrolujLeitweg(vstup) {
  const text = String(vstup == null ? '' : vstup).trim().replace(/\s+/g, '');
  if (text === '') return { ok: false, kod: 'prazdne', hodnota: '' };
  if (!/^[0-9A-Za-z-]+$/.test(text)) return { ok: false, kod: 'znaky', hodnota: text };

  const casti = text.split('-');
  const pruefziffer = casti.length >= 2 ? casti[casti.length - 1] : '';
  if (casti.length < 2 || pruefziffer.length !== 2 || !CISLICE.test(pruefziffer)) {
    return { ok: false, kod: 'bez-pruefziffer', hodnota: text };
  }

  const grob = casti[0];
  // Feinadressierung smie byt len jedna cast; viac pomlciek znamena zly tvar.
  const fein = casti.length === 3 ? casti[1] : '';
  if (casti.length > 3) return { ok: false, kod: 'fein', hodnota: text, grob, fein: casti.slice(1, -1).join('-') };
  if (!CISLICE.test(grob) || grob.length < 2 || grob.length > 12) {
    return { ok: false, kod: 'grob', hodnota: text, grob, fein };
  }
  if (casti.length === 3 && (fein.length === 0 || fein.length > 30 || !ALFANUM.test(fein))) {
    return { ok: false, kod: 'fein', hodnota: text, grob, fein };
  }

  const ocakavana = prufziffer(grob + fein);
  if (ocakavana !== pruefziffer) {
    return { ok: false, kod: 'pruefziffer', hodnota: text, grob, fein, pruefziffer, ocakavana };
  }
  return { ok: true, kod: 'ok', hodnota: text, grob, fein, pruefziffer, ocakavana };
}
