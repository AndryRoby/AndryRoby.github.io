// UNSCORED M1a: statické obrazovky na schválenie vizuálu (?obrazovka=1..9).
// Vymyslené, ale uveriteľné stavy (čísla podľa simulacia.mjs). Nič sa neukladá, čas stojí.

import { novyStav } from './ekonomika.mjs';

const videne = (...ids) => Object.fromEntries(ids.map((i) => [i, true]));

function stav(o) {
  const s = novyStav();
  const { stat, ...zvysok } = o;
  Object.assign(s, zvysok);
  Object.assign(s.stat, stat || {});
  return s;
}

const VETY_5 = ['u0', 'u1', 'u2', 'u3', 'l1', 'l5', 'ok', 'k1', 'on', 'n_zapisnik', 'n_krieda', 'x2_25', 'akt2z', 'akt2', 'n_bicykel', 'v_mira'];
const VETY_7 = [...VETY_5, 'n_pisaci', 't1', 'v_tomas', 'v_ruth'];

const minuta5 = () =>
  stav({
    hra: 300,
    akt: 2,
    sepoty: 212,
    papier: 88,
    posluchaci: 26,
    kurieri: 9,
    kupeneP: 26,
    kupeneK: 9,
    pridaniVBehu: 35,
    pozornost: 4,
    nastroje: { zapisnik: true, krieda: true, bicykel: true },
    odomknute: { kurier: true, papier: true, nastroje: true, x2_25: true },
    voditkoCaka: 'mira',
    voditkaPocet: 1,
    dalsieVoditko: 360,
    videne: videne(...VETY_5),
    stat: { tuky: 820, maxLudi: 35, sepotySpolu: 4100, poslednaVeta: 272, oznamy: 2 },
  });

const minuta7 = () =>
  stav({
    hra: 460,
    akt: 2,
    sepoty: 439,
    papier: 56,
    posluchaci: 34,
    kurieri: 11,
    tlaciari: 2,
    kupeneP: 32,
    kupeneK: 11,
    kupeneT: 2,
    pridaniVBehu: 51,
    pozornost: 38,
    nastroje: { zapisnik: true, krieda: true, bicykel: true, pisaci: true },
    odomknute: { kurier: true, papier: true, nastroje: true, x2_25: true },
    voditka: { mira: 'a', tomas: 'a' },
    voditkaPocet: 3,
    voditkoCaka: 'ruth',
    dalsieVoditko: 540,
    bonusy: { tukPlus: 1, nahlad: true, kopirak: false, pokles: 1 },
    videne: videne(...VETY_7),
    stat: { tuky: 1210, maxLudi: 47, sepotySpolu: 11800, poslednaVeta: 450, oznamy: 3 },
  });

export const UKAZKY = {
  1: {
    popis: 'Začiatok (0:08): len tvoja kartička v hmle, kužele, prvá veta ZERO.',
    stav: () => stav({ hra: 8, sepoty: 3, videne: videne('u0', 'u1', 'u2', 'u3'), stat: { tuky: 3 } }),
    radio: "zero isn't nothing. zero is a blind spot. talk to someone.",
    oznam: 'Recalculation complete. Score: 0. Services paused for your safety.',
  },
  2: {
    popis: '5. minúta: 35 ľudí, akt II práve začal, Mira čaká (teplé svetlo v hmle).',
    stav: minuta5,
    radio: 'someone on your street keeps her light on. go and see her.',
    oznam: null,
  },
  3: {
    popis: 'Akt II (7:40): 47 ľudí, prvý tlačiar, pozornosť 38, Tomas pridaný, Ruth čaká.',
    stav: minuta7,
    radio: 'now it spreads while you sleep.',
    oznam: 'Some citizens report feeling unseen. Assistance is available.',
  },
  4: {
    popis: 'Prechod do aktu II: list papiera, písací stroj, pečiatka (zastavené po dopade).',
    stav: () => {
      const s = minuta5();
      Object.assign(s, { hra: 180, posluchaci: 20, kurieri: 5, kupeneP: 20, kupeneK: 5, pridaniVBehu: 25, sepoty: 13, papier: 10, voditkoCaka: null, voditkaPocet: 0, pozornost: 0 });
      s.nastroje = { zapisnik: true };
      s.stat.maxLudi = 25;
      return s;
    },
    radio: "they're bringing friends now. listeners x2.",
    oznam: null,
    prechod: 2,
  },
  5: {
    popis: 'Návrat po 3 h 12 min: súhrn neprítomnosti na papierovom lístku.',
    stav: minuta7,
    radio: 'now it spreads while you sleep.',
    oznam: null,
    navrat: { sekundy: 11520, rozhovory: 41873, sepoty: 38110, papier: 1204, vratili: 4, orezane: false },
  },
  6: {
    popis: 'Rozhovor s Mirou (vodítko): dve voľby, cena v šepotoch.',
    stav: minuta5,
    radio: 'someone on your street keeps her light on. go and see her.',
    oznam: null,
    rozhovor: true,
  },
  7: {
    popis: 'Zoznam nástrojov (na telefóne spodný list): kúpené s pečiatkou, Back room, zamknuté Split the cell.',
    stav: minuta7,
    radio: 'now it spreads while you sleep.',
    oznam: null,
    zoznam: 'nastroje',
  },
  8: {
    popis: 'Vysoká pozornosť 82: ponuka Go quiet nad klávesom, rýchlejšie kužele.',
    stav: () => {
      const s = minuta7();
      Object.assign(s, { pozornost: 82, voditkoCaka: null, hra: 820, posluchaci: 58, kurieri: 19, tlaciari: 6, kupeneP: 54, kupeneK: 19, kupeneT: 6, pridaniVBehu: 89, sepoty: 2410, papier: 190 });
      s.voditka = { mira: 'a', tomas: 'a', ruth: 'a' };
      s.bonusy.kopirak = true;
      s.stat.maxLudi = 83;
      s.odomknute.x2_50 = true;
      return s;
    },
    radio: 'too loud. go quiet for a while. waiting never hurt anyone.',
    oznam: 'Your comfort is the only metric that matters to us.',
  },
  9: {
    popis: 'Ľudia (na telefóne spodný list): pomenované postavy a posledných osem ľudí.',
    stav: minuta7,
    radio: 'now it spreads while you sleep.',
    oznam: null,
    zoznam: 'ludia',
  },
};
