// UNSCORED: texty a spúšťače. Čistý modul bez DOM. Texty pre hráča po anglicky, bez pomlčiek.
// ZERO píše malými písmenami, krátko a teplo. Správca (STEWARD) je zdvorilý, presný a nikdy nepovie „nie“.
// Všetky mená sú vymyslené; mesto Aetheria, Rada a Správca sú fikcia.

import { ludia } from './ekonomika.mjs';

export const ZERO = 'zero';
export const SPRAVCA = 'spravca';

export const AKTY = {
  2: { cislo: 'ACT II', nazov: 'THE CELL', zero: 'five is a secret. twenty-five is a cell. cells get noticed.' },
};

// Spúšťače: id (raz za hru), kto, text, podmienka nad stavom.
export const SPUSTACE = [
  { id: 'u0', kto: SPRAVCA, text: 'Good evening, Citizen. Your score is being recalculated. Thank you for your patience.', ked: (s) => s.hra >= 0 },
  { id: 'u1', kto: SPRAVCA, text: 'Recalculation complete. Score: 0. Services paused for your safety.', ked: (s) => s.hra >= 3 },
  { id: 'u2', kto: ZERO, text: 'hey. you. the one the cameras skip.', ked: (s) => s.hra >= 4 },
  { id: 'u3', kto: ZERO, text: "zero isn't nothing. zero is a blind spot. talk to someone.", ked: (s) => s.hra >= 7 && ludia(s) === 0 },
  { id: 'l1', kto: ZERO, text: 'see? she was waiting for someone to say it first.', ked: (s) => ludia(s) >= 1 },
  { id: 'l5', kto: ZERO, text: 'look at the map. every warm window is someone who listened.', ked: (s) => ludia(s) >= 5 },
  { id: 'ok', kto: ZERO, text: 'night workers can carry things for you. find a courier.', ked: (s) => s.odomknute.kurier },
  { id: 'k1', kto: ZERO, text: "they pay you in paper. keep it. paper doesn't report back.", ked: (s) => s.kurieri >= 1 },
  { id: 'on', kto: ZERO, text: "paper buys what screens can't see. look at your tools.", ked: (s) => s.odomknute.nastroje },
  { id: 'n_zapisnik', kto: ZERO, text: "write their names down. paper doesn't sync.", ked: (s) => s.nastroje.zapisnik },
  { id: 'n_krieda', kto: ZERO, text: 'a chalk mark on a door. cameras read faces, not chalk.', ked: (s) => s.nastroje.krieda },
  { id: 'x2_25', kto: ZERO, text: "they're bringing friends now. listeners x2.", ked: (s) => s.odomknute.x2_25 },
  { id: 'akt2z', kto: ZERO, text: 'five is a secret. twenty-five is a cell. cells get noticed.', ked: (s) => s.akt >= 2 },
  { id: 'akt2', kto: SPRAVCA, text: 'We have noticed more conversation in Lower Weir. Conversation is healthy in moderation.', ked: (s) => s.akt >= 2 },
  { id: 'n_bicykel', kto: ZERO, text: 'no chip. no route history. just legs.', ked: (s) => s.nastroje.bicykel },
  { id: 'v_mira', kto: ZERO, text: 'someone on your street keeps her light on. go and see her.', ked: (s) => s.voditkoCaka === 'mira' },
  { id: 'v_tomas', kto: ZERO, text: 'the camera man on Kiln Lane keeps looking at your window.', ked: (s) => s.voditkoCaka === 'tomas' },
  { id: 'v_ruth', kto: ZERO, text: 'an old woman on Weir Street asked if you still use paper.', ked: (s) => s.voditkoCaka === 'ruth' },
  { id: 'n_pisaci', kto: ZERO, text: "a machine that can't be updated. perfect.", ked: (s) => s.nastroje.pisaci },
  { id: 't1', kto: ZERO, text: 'now it spreads while you sleep.', ked: (s) => s.tlaciari >= 1 },
  { id: 'p50', kto: ZERO, text: "they're counting the silence around you. careful.", ked: (s) => s.akt >= 2 && s.pozornost >= 50 },
  { id: 'p80', kto: ZERO, text: 'too loud. go quiet for a while. waiting never hurt anyone.', ked: (s) => s.akt >= 2 && s.pozornost >= 80 },
  { id: 'klop', kto: ZERO, text: "some went quiet. that's fine. they come back in the dark.", ked: (s) => s.stat.klopania >= 1 },
  { id: 'x2_50', kto: ZERO, text: 'half the block is whispering. listeners x2 again.', ked: (s) => s.odomknute.x2_50 },
  { id: 'l50', kto: SPRAVCA, text: 'Lower Weir is 97.1% stable tonight. Thank you for your cooperation.', ked: (s) => ludia(s) >= 50 },
  { id: 'n_kopirak', kto: ZERO, text: 'one page, three copies. an old trick nobody thought to ban.', ked: (s) => s.nastroje.kopirak },
  { id: 'n_zadna', kto: ZERO, text: 'a back room. somewhere quiet enough to think.', ked: (s) => s.nastroje.zadna },
  { id: 'x2_100', kto: ZERO, text: 'a hundred people listening. the street feels different now.', ked: (s) => s.odomknute.x2_100 },
  { id: 'split', kto: ZERO, text: 'too many people know your face. time to split the cell.', ked: (s) => s.odomknute.rozdelenie },
];

export const OZNAMY = [
  'Reminder: credits unused by the 1st return to the common ledger.',
  'Some citizens report feeling unseen. Assistance is available.',
  'Seen is safe.',
  'Night hours are quiet hours. Quiet is appreciated.',
  'Paper documents are no longer accepted at civic counters. Thank you for going paperless.',
  'A citizen who helps a citizen helps the City. Kindness can be reported through official channels.',
  'Unscheduled gatherings may affect household scores. We are here to help.',
  'Your comfort is the only metric that matters to us.',
];

export const PREPOCET = [
  { kto: SPRAVCA, text: 'Today is Recalculation Day. Please remain calm while scores are updated.' },
  { kto: ZERO, text: 'people are angry today. listeners x2 for three minutes.' },
];

/** Čas na čítanie v sekundách: slová / 3 + 1,2 s, aspoň 2,2 s. Platí aj pri zníženom pohybe. */
export const casCitania = (t) => Math.max(2.2, String(t).split(/\s+/).filter(Boolean).length / 3 + 1.2);

const KOMPAKT = typeof Intl !== 'undefined' ? new Intl.NumberFormat('en', { notation: 'compact', maximumSignificantDigits: 3 }) : null;
const CELE = typeof Intl !== 'undefined' ? new Intl.NumberFormat('en', { maximumFractionDigits: 0 }) : null;

/** 1,234 potom 12.3K, 4.56M, 7.89B. Zlomky sa zaokrúhľujú nadol (hráč nevidí viac, než má). */
export function cislo(n) {
  const x = Math.floor(Math.max(0, n) + 1e-9);
  if (x < 10000) return CELE ? CELE.format(x) : String(x);
  return KOMPAKT ? KOMPAKT.format(x) : String(x);
}

/** Cena sa zaokrúhľuje nahor, aby „can buy“ sedelo s číslom na obrazovke. */
export function cena(n) {
  const x = Math.ceil(n - 1e-9);
  if (x < 10000) return CELE ? CELE.format(x) : String(x);
  return KOMPAKT ? KOMPAKT.format(x) : String(x);
}

export const OZNAM_KAZDYCH = 100;
export const OZNAM_TICHO = 40;

/**
 * Vráti nové vety podľa stavu a zapíše ich do s.videne. Oznam Správcu príde každých 100 s hry,
 * ak aspoň 40 s nepadla žiadna veta. udalosti = pole z krok() (napr. deň prepočtu).
 */
export function vety(s, udalosti = []) {
  const out = [];
  for (const sp of SPUSTACE) {
    if (s.videne[sp.id]) continue;
    if (sp.ked(s)) {
      s.videne[sp.id] = true;
      out.push({ id: sp.id, kto: sp.kto, text: sp.text });
    }
  }
  for (const e of udalosti) if (e.typ === 'prepocet') out.push(...PREPOCET.map((v, i) => ({ id: 'prepocet' + i, ...v })));
  if (out.length) s.stat.poslednaVeta = s.hra;
  else if (s.hra >= 60 && s.hra - s.stat.poslednaVeta >= OZNAM_TICHO && s.hra >= (s.stat.oznamy + 1) * OZNAM_KAZDYCH) {
    const text = OZNAMY[s.stat.oznamy % OZNAMY.length];
    s.stat.oznamy += 1;
    s.stat.poslednaVeta = s.hra;
    out.push({ id: 'oznam', kto: SPRAVCA, text });
  }
  return out;
}

// ------------------------------------------------------------------ vodítka (rozhovory)

export const VODITKA_TEXT = {
  mira: {
    meno: 'Mira Hale',
    riadok: '34, night nurse',
    hacik: 'Score 612 to 588 after visiting her mother in Lower Weir.',
    uvod: '"They said my visits were a risk pattern. My mother is eighty. What pattern?"',
    volby: {
      a: { text: "Tell her it wasn't her fault.", bonus: '+2 listeners, +1 whisper per tap', po: 'she tells the whole night shift now. your words go further.' },
      b: { text: 'Ask what the night shift talks about.', bonus: '+4 listeners', po: 'she brought two nurses. nobody on nights has a good score.' },
    },
  },
  tomas: {
    meno: 'Tomas Brenner',
    riadok: '41, camera technician',
    hacik: 'Score 701 to 655 after he asked why one camera faces a bedroom.',
    uvod: '"I install them. I know exactly where they don\'t look."',
    volby: {
      a: { text: 'Ask where the cameras cannot see.', bonus: '+2 listeners, see what each invite costs in attention', po: 'he marked the blind spots. now you see what invites cost.' },
      b: { text: 'Ask him to loosen a bolt on Kiln Lane.', bonus: '+2 listeners, attention fades faster (x1.25)', po: 'one camera on Kiln Lane watches the sky now.' },
    },
  },
  ruth: {
    meno: 'Old Ruth',
    riadok: '77, retired typesetter',
    hacik: 'Score 540 to 498 for "refusing digital correspondence".',
    uvod: '"I set type for forty years. There is carbon paper in my cellar. Nobody ever asked."',
    volby: {
      a: { text: 'Ask her to type for you.', bonus: '+2 listeners, carbon paper in your tools, a printer of your own', po: 'she types faster than the machine that replaced her.' },
      b: { text: 'Ask her to teach the couriers.', bonus: '+2 listeners, carbon paper in your tools, 2 couriers', po: 'she drew them a map of every back door on Weir Street.' },
    },
  },
};

// ------------------------------------------------------------------ bežní ľudia (deterministicky podľa poradia)

const MENA = ['Ada', 'Bruno', 'Celia', 'Dario', 'Edith', 'Felix', 'Greta', 'Hugo', 'Ines', 'Jonah', 'Kasia', 'Leon', 'Maren', 'Nico', 'Olga', 'Pavel', 'Quinn', 'Rosa', 'Sami', 'Tilda', 'Umar', 'Vera', 'Wren', 'Yusuf', 'Zora', 'Anton', 'Bea', 'Cyril', 'Dina', 'Emil', 'Fern', 'Gideon', 'Hester', 'Ivo', 'Juno', 'Karel', 'Lotte', 'Milo', 'Nell', 'Otto'];
const PRIEZVISKA = ['Varga', 'Holm', 'Pike', 'Duarte', 'Lind', 'Marsh', 'Okafor', 'Brandt', 'Castell', 'Novak', 'Reyes', 'Sato', 'Wolfe', 'Ekberg', 'Fenn', 'Quill', 'Rask', 'Tamm', 'Ulrich', 'Vale', 'Weller', 'Aske', 'Birch', 'Corran', 'Dale'];
const PRACE = ['tram driver', 'baker', 'night guard', 'seamstress', 'radio repairer', 'cook', 'schoolteacher', 'porter', 'cleaner', 'pharmacist', 'gardener', 'locksmith', 'librarian', 'bus mechanic', 'midwife', 'student', 'retired clerk', 'dock worker', 'florist', 'plumber'];
const DOVODY = [
  'bought medicine for a neighbour',
  'missed one payment on a fridge',
  'walked home through Lower Weir twice',
  'wrote a letter by hand',
  'stayed out late to help a stranger',
  'lent a friend her card',
  'asked too many questions at the counter',
  'grew vegetables without a permit',
  'spoke to someone with a low score',
  'cancelled a wellness check',
  'kept cash in a jar',
  'visited a sick brother in the Margins',
];

const h = (a, b) => {
  let x = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35);
  x ^= x >>> 13;
  x = Math.imul(x, 0x27d4eb2f);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
};

export function osoba(i) {
  const pick = (zoznam, k) => zoznam[Math.floor(h(i, k) * zoznam.length)];
  const vek = 19 + Math.floor(h(i, 5) * 62);
  const pred = 520 + Math.floor(h(i, 6) * 260);
  const po = pred - 12 - Math.floor(h(i, 7) * 60);
  return {
    meno: `${pick(MENA, 1)} ${pick(PRIEZVISKA, 2)}`,
    vek,
    praca: pick(PRACE, 3),
    pribeh: `Score ${pred} to ${po}: ${pick(DOVODY, 4)}.`,
  };
}

/** Všetky texty modulu (na test pomlčiek a mien). */
export function vsetkyTexty() {
  const t = [];
  for (const s of SPUSTACE) t.push(s.text);
  t.push(...OZNAMY, ...PREPOCET.map((p) => p.text));
  for (const a of Object.values(AKTY)) t.push(a.cislo, a.nazov, a.zero);
  for (const v of Object.values(VODITKA_TEXT)) {
    t.push(v.meno, v.riadok, v.hacik, v.uvod);
    for (const o of Object.values(v.volby)) t.push(o.text, o.bonus, o.po);
  }
  t.push(...MENA, ...PRIEZVISKA, ...PRACE, ...DOVODY);
  return t;
}
