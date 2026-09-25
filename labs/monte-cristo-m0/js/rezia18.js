/* Rezia kapitoly 18: kde kto je, kam sa pozera kamera, ake je svetlo a ako prebieha
 * kazdy ukon. Vsetko tu je NAVRH inscenacie (kniha hovori len to, co je v datach
 * s riadkami); texty a repliky sa sem nepisu, tie su len v data-18.json.
 * Vlastny text hry (vyzvy pri ukonoch) je anglicky a nikdy sa nepodava ako citat. */
import { SVET } from './kulisy/vazenie.js';

const ch = SVET.chodba;
const chodba = [];
for (let i = 0; i < ch.length; i += 2) chodba.push({ x: ch[i], y: ch[i + 1] + 9, m: 'plaz' });

export const CESTY = {
  /* rano: z Edmondovej strany chodbou az pod kamen vo Fariovej cele */
  rano: chodba.slice(),
  /* spat: od Farie ku kamenu, dolu a chodbou dolava */
  spat: [{ x: 1062, y: SVET.podlaha, m: 'chod' }, { x: 958, y: SVET.podlaha, m: 'chod' }, ...chodba.slice().reverse()],
};

const FARIA_RANO = { vid: true, x: 1124, y: SVET.podlaha, smer: -1, poza: 'sedPapier', rek: { rukaZ: { meno: 'rek:valcek', uhol: -1.3 } } };
const CELA_F = {
  kulisa: 'svet', kam: { x: 760 }, dron: true,
  svetlo: { F: 0.62, E1: 0.5, E2: 0, E3: 0, Ev: 0, tint: 0, tma: 0 }, kamen: 1, rohoz: 0,
  herci: { edmond: { vid: true, x: 1070, y: SVET.podlaha, smer: 1, poza: 'kolena' }, faria: FARIA_RANO },
};
const VECER = {
  kulisa: 'svet', kam: { x: 0 }, dron: true,
  svetlo: { F: 0, E1: 0, E2: 0, E3: 0, Ev: 0.5, tint: 0.55, tma: 0 }, kamen: 0, rohoz: 1,
  herci: {
    faria: { vid: true, x: 112, y: SVET.podlaha, smer: 1, poza: 'sedPapier', rek: { rukaZ: { meno: 'rek:list', uhol: -0.4 } } },
    edmond: { vid: true, x: 250, y: SVET.podlaha, smer: -1, poza: 'sedStolicka' },
  },
};

export const BEATY = {
  b01: {
    kulisa: 'svet', kam: { sleduj: 'edmond' }, dron: true,
    svetlo: { F: 0.62, E1: 0.5, E2: 0, E3: 0, Ev: 0, tint: 0, tma: 0 }, kamen: 0, rohoz: 0,
    herci: { edmond: { vid: true, cesta: 'rano', u: 0 }, faria: FARIA_RANO },
    opis: 'A cross-section of the Château d’If: Edmond’s cell on the left, the narrow passage under the wall, and the abbé’s cell on the right, where a thin ray of morning light falls from a narrow window onto Faria, seated on his bed.',
  },
  b02: CELA_F, b03: CELA_F, b04: CELA_F, b05: CELA_F, b06: CELA_F,
  b07: Object.assign({}, CELA_F, { opis: 'The abbé’s cell in the morning. Edmond kneels by Faria, who sits in the ray of light.' }),
  b08: {
    kulisa: 'svet', kam: { x: 0 }, dron: true,
    svetlo: { F: 0, E1: 0.55, E2: 0, E3: 0, Ev: 0, tint: 0.05, tma: 0 }, kamen: 0, rohoz: 1,
    herci: { edmond: { vid: true, x: 118, y: SVET.podlaha, smer: 1, poza: 'sedDlane' }, faria: { vid: false } },
    opis: 'Edmond’s cell by day. He sits on his bed with his head in his hands. A patch of light from the small high window moves on the wall.',
  },
  b09: {
    kulisa: 'svet', kam: { x: 0 }, dron: true,
    svetlo: { F: 0, E1: 0, E2: 0, E3: 0, Ev: 0.55, tint: 0.45, tma: 0 }, kamen: 0, rohoz: 1,
    herci: { edmond: { vid: true, x: 118, y: SVET.podlaha, smer: 1, poza: 'sedDlane' }, faria: { vid: false } },
    opis: 'Evening in Edmond’s cell. Low red light. Something drags itself along the passage behind the small opening at the foot of the wall.',
  },
  b10: { kulisa: 'tablo', tablo: 'tablo:1', dron: false, opis: 'Faria’s story as engravings in red ink, one plate after another.' },
  b11: { kulisa: 'tablo', tablo: 'tablo:1807', dron: false, opis: 'Rome, 1807, as Faria remembers it: his study in darkness, a clock, a table with papers, a breviary, the last embers in the fireplace.' },
  b12: Object.assign({}, VECER, { opis: 'Evening in Edmond’s cell. Faria sits on Edmond’s bed and offers him the paper; Edmond sits on the stool beside him.' }),
  b13: VECER, b14: VECER, b15: VECER,
};

/* Ciele Pozornosti v scene (svetove suradnice) a v listoch (riadok knihy). */
export const CIELE = {
  p_ruka: { x: 1104, y: 222, en: 'his left hand' },
  p_pismo: { x: 1080, y: 196, en: 'the writing on the paper', nad: true },
  p_datum: { list: 8342, en: 'the torn year' },
};

/* Gesta k tonom (NAVRH, v scenar-18.md oznacene) */
export const GESTA = {
  't18a:nezne': { faria: { poza: 'sedRuka', rek: { rukaZ: null } } },
  't18a:opatrne': { faria: { poza: 'sedOkno' } },
  't18a:unavene': { faria: { poza: 'sedSeba' } },
};

/* Ukony. druh: cesta (hrac ide po ceste), drzat (podrzanie s postupom), nejst, stlacit. */
export const AKCIE = {
  a_plazit_rano: { druh: 'cesta', cesta: 'rano', vyzvaKoniec: 'Raise the stone with your head', koniec: 'vylez' },
  a_rozvinut: { druh: 'drzat', detail: 'harok', trvanie: 1.3, udrzat: 0.7, vratit: 1.2, vyzva: 'Hold to unroll the paper and keep it open' },
  a_plazit_spat: { druh: 'cesta', cesta: 'spat', koniecX: 700 },
  a_nejst: { druh: 'nejst', vyzva: 'Go to Faria, or stay: hold to wait' },
  a_cakat: { druh: 'drzat', cakanie: true, trvanie: 5, vyzva: 'Hold to let the day pass' },
  a_pomoct: { druh: 'drzat', pomoc: true, trvanie: 3.6, vyzva: 'Hold to help him through the opening' },
  a_sadnut: { druh: 'stlacit', vyzva: 'Place him on the bed' },
  a_zalozka: { druh: 'drzat', detail: 'zalozka', trvanie: 2.4, vyzva: 'Hold to draw the old paper out of the breviary' },
  a_plamen: { druh: 'drzat', detail: 'plamen', trvanie: 3.4, auto: true, vyzva: 'Hold the paper to the flame' },
  a_objatie: { druh: 'drzat', objatie: true, trvanie: 2.2, vyzva: 'Hold his hand' },
};

/* Tablo podla repliky v b10 (panel) a citliveho miesta (prazdny prah namiesto tiel). */
export function tabloPreKrok(k) {
  if (!k.panel) return null;
  if (k.citlive && /prah/.test(k.citlive)) return 'tablo:5b';
  return 'tablo:' + k.panel;
}
