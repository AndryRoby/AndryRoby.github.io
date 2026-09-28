/* Whistle Stop M0: stav hry a deje nad ním. Čisté funkcie, čas sa podáva zvonka (ms), nič nekreslí.
   Pravidlá (GDD 2.1): obchod bez manažéra beží len na ťuk (jeden ťuk = jeden cyklus 2 s), offline nezarába.
   Manažér spúšťa cykly sám a zarába aj offline (strop 3 h). Ťuk na riadený obchod = okamžitá minca 10 % cyklu,
   najviac 8 ťukov za sekundu. */
import {
  OBCHOD, E, cenaUrovni, cenaManazera, cenaNabytku, kusovNabytku, prijemZaS, zaCyklus, milnikov, stupenFasady
} from './ekonomika.mjs';

export const VERZIA = 1;

export function novyStav(teraz = 0) {
  return {
    peniaze: 0, n: 1, man: false, nab: [0, 0, 0, 0, 0, 0],
    cyklus: -1,            // -1 = stojí, inak uplynulé sekundy cyklu
    zarobok: 0, prvy: teraz, t: teraz, tuky: [], vedier: 0
  };
}

function zarob(s, x) { s.peniaze += x; s.zarobok += x; }

// Ťuk na obchod. Vracia, čo sa stalo, aby hra vedela zahrať zvuk a pohyb.
export function tukObchod(s, terazMs) {
  if (!s.man) {
    if (s.cyklus >= 0) return { typ: 'bezi' };
    s.cyklus = 0;
    return { typ: 'start' };
  }
  // riadený obchod: minca, ale najviac E.tukovZaS za poslednú sekundu
  let k = 0;
  for (let i = 0; i < s.tuky.length; i++) if (terazMs - s.tuky[i] < 1000) s.tuky[k++] = s.tuky[i];
  s.tuky.length = k;
  if (k >= E.tukovZaS) return { typ: 'limit' };
  s.tuky.push(terazMs);
  const suma = zaCyklus(s.n, s.nab) * E.tukPodiel;
  zarob(s, suma);
  return { typ: 'minca', suma };
}

// Studňa v M0 nezarába (funguje len obchod, GDD 6.1); ťuk natiahne vedro, hra zahrá zvuk.
export function tukStudna(s) { s.vedier++; return { typ: 'vedro' }; }

// Posun času počas hrania o dt sekúnd. Vracia počet dokončených cyklov a ich sumu (mince pri dverách).
export function krok(s, dt) {
  if (s.cyklus < 0 || dt <= 0) return { cyklov: 0, suma: 0 };
  const T = OBCHOD.t;
  s.cyklus += dt;
  let cyklov = 0;
  if (s.man) { cyklov = Math.floor(s.cyklus / T); s.cyklus -= cyklov * T; }
  else if (s.cyklus >= T) { cyklov = 1; s.cyklus = -1; }
  const suma = cyklov * zaCyklus(s.n, s.nab);
  if (suma) zarob(s, suma);
  return { cyklov, suma };
}

export function mozeKupit(s, kolko) { return s.peniaze >= cenaUrovni(s.n, kolko); }
export function kupUroven(s, kolko) {
  const cena = cenaUrovni(s.n, kolko);
  if (kolko < 1 || s.peniaze < cena) return null;
  const pred = { m: milnikov(s.n), f: stupenFasady(s.n) };
  s.peniaze -= cena; s.n += kolko;
  return { cena, milnik: milnikov(s.n) > pred.m, fasada: stupenFasady(s.n) > pred.f };
}

export function najmiManazera(s) {
  const cena = cenaManazera();
  if (s.man || s.peniaze < cena) return null;
  s.peniaze -= cena; s.man = true;
  if (s.cyklus < 0) s.cyklus = 0;       // manažér hneď začne
  return { cena };
}

export function interierOtvoreny(s) { return s.n >= E.nabytok.odUrovne; }
export function cenaDalsiehoKusu(s) { return cenaNabytku(kusovNabytku(s.nab)); }
export function kupNabytok(s, miesto) {
  if (!interierOtvoreny(s) || miesto < 0 || miesto >= s.nab.length) return null;
  if (s.nab[miesto] >= E.nabytok.stupnov) return null;
  const cena = cenaDalsiehoKusu(s);
  if (s.peniaze < cena) return null;
  s.peniaze -= cena; s.nab[miesto]++;
  return { cena, stupen: s.nab[miesto] };
}

// Návrat po neprítomnosti (nové spustenie alebo skrytá karta). Hodiny späť: nič sa nestratí, nič sa nezíska,
// uložený čas sa prepíše (GDD 5.2). Offline zarába len riadený obchod, najviac 3 h.
export function offline(s, terazMs) {
  const prec = (terazMs - s.t) / 1000;
  s.t = terazMs;
  if (!(prec > 0) || !s.man) return { sekund: Math.max(0, prec || 0), suma: 0 };
  const efekt = Math.min(prec, E.offlineCapS);
  const suma = prijemZaS(s.n, s.nab) * efekt;
  zarob(s, suma);
  return { sekund: prec, efekt, suma, strop: prec > E.offlineCapS };
}

// Príjem za sekundu, ktorý hra ukazuje: riadený obchod plný beh, neriadený 0 (beží len na ťuk).
export function prijemTeraz(s) { return s.man ? prijemZaS(s.n, s.nab) : 0; }

// Kontrola načítaného stavu: čo nesedí, opraví na bezpečnú hodnotu (poškodené uloženie nesmie zhodiť hru).
export function zdravyStav(x, teraz = 0) {
  const s = novyStav(teraz);
  if (!x || typeof x !== 'object') return s;
  const cislo = (v, d) => (typeof v === 'number' && isFinite(v) && v >= 0 ? v : d);
  s.peniaze = cislo(x.peniaze, 0); s.n = Math.max(1, Math.floor(cislo(x.n, 1)));
  s.man = x.man === true; s.zarobok = cislo(x.zarobok, 0); s.prvy = cislo(x.prvy, teraz); s.t = cislo(x.t, teraz);
  s.vedier = Math.floor(cislo(x.vedier, 0));
  if (Array.isArray(x.nab) && x.nab.length === 6) s.nab = x.nab.map(v => Math.min(3, Math.floor(cislo(v, 0))));
  s.cyklus = s.man ? 0 : -1;
  return s;
}
