// Časová os pozvánky na Silvester 2027 (ARLing, 19. 10. 2026). Čisté dáta: berie ich scéna (scena.js), hudba
// (ops/video/pozvanka/hudba.mjs skladá zvuky ohňostroja presne na tieto časy) aj testy. 16 s = 8 taktov pri 120 BPM.

export const DLZKA = 16;
export const BPM = 120;

/** Časy v sekundách. Odhalenie textu trvá ODHAL s od svojho času. */
export const T = {
  hakHore: [1.2, 2.1], // „You're invited“ zo stredu hore
  rokZapal: [2.05, 2.9], // „2027“ sa rozsvieti zľava doprava (prvý výbuch je o 2,0 s)
  rokHore: [5.5, 6.65], // „2027“ do hlavičky
  nazov: 6.2,
  ciara: 6.5,
  datum: 6.8,
  cas: 7.0,
  miesto: 7.2,
  riadok: 7.45,
  kamera: [0, 7.8], // kamera dôjde do pokoja, potom text stojí (čitateľnosť a ostrosť)
  lesk: [[3.15, 4.35], [9.4, 10.9], [13.7, 15.2]], // svetlo prejde cez zlato
};
export const ODHAL = 0.75;

/**
 * Ohňostroj: t = čas výbuchu, x a y = poloha na obrazovke od -1 do 1 (stred 0, hore +1) pri danej hĺbke z (px pred
 * rovinou textu, záporné = za textom), r = polomer v px pri z = 0, typ chryzantéma, vŕba (dlhý zlatý pád) alebo
 * prsteň, jas 0 až 1. Raketa letí RAKETA s pred výbuchom zdola.
 */
export const RAKETA = 0.9;
export const OHNOSTROJE = [
  { t: 2.0, x: 0.0, y: 0.06, z: -700, r: 540, typ: 'chryz', farba: 0, jas: 1.0 },
  { t: 3.5, x: -0.6, y: 0.3, z: -1300, r: 430, typ: 'chryz', farba: 1, jas: 0.85 },
  { t: 4.5, x: 0.62, y: 0.4, z: -1200, r: 440, typ: 'prsten', farba: 0, jas: 0.85 },
  { t: 6.0, x: 0.08, y: 0.78, z: -1700, r: 420, typ: 'chryz', farba: 2, jas: 0.7 },
  { t: 8.0, x: -0.64, y: 0.8, z: -1600, r: 400, typ: 'vrba', farba: 0, jas: 0.75 },
  { t: 10.0, x: 0.66, y: 0.74, z: -1600, r: 400, typ: 'chryz', farba: 1, jas: 0.7 },
  { t: 11.5, x: -0.62, y: -0.74, z: -1400, r: 380, typ: 'prsten', farba: 2, jas: 0.65 },
  { t: 13.0, x: 0.6, y: -0.72, z: -1400, r: 400, typ: 'chryz', farba: 0, jas: 0.7 },
  { t: 14.5, x: 0.0, y: 0.84, z: -1500, r: 470, typ: 'vrba', farba: 0, jas: 0.8 },
];

/** Farby výbuchov: [hlava (horúca), chvost]. Zlatá, šampanské, biele zlato. */
export const FARBY_OHNA = [
  ['#FFF4D6', '#E0A43C'],
  ['#FFF9EE', '#E8C98A'],
  ['#FFFFFF', '#F2D27A'],
];

/** Zvukové udalosti pre hudbu (typy z ops/video/pohyb/lib/hudba.mjs). */
export function zvukyPozvanky() {
  const z = [];
  for (const o of OHNOSTROJE) {
    z.push({ t: +(o.t - 0.42).toFixed(3), type: 'whoosh', gain: 0.32 * o.jas });
    z.push({ t: o.t, type: o.typ === 'vrba' ? 'burstLong' : 'burst', gain: 0.62 * o.jas * (o.z > -1000 ? 1 : 0.8) });
  }
  z.push({ t: 2.45, type: 'chime', gain: 0.55 });
  z.push({ t: T.nazov + 0.1, type: 'chime', gain: 0.3 });
  for (const k of ['datum', 'cas', 'miesto', 'riadok']) z.push({ t: +(T[k] + 0.08).toFixed(3), type: 'tick', gain: 0.22 });
  return z.sort((a, b) => a.t - b.t);
}
