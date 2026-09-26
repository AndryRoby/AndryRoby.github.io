/* Little Island Zoo: the economy.
   Pure and deterministic: no DOM, no clock, no randomness. The page, a Worker and
   the node tests read this same file. Time always comes in from outside as dt in
   seconds; every reward is a fixed number from the tables below. */

export const VERZIA = 1;

/* ── Tables ───────────────────────────────────────────────────────────────
   Every island has seven habitats. The numbers belong to the tier (0 is the
   cheapest), the animals to the island. cena0 = price of the first animal,
   rast = how much dearer each next one is, prijem = coins a second from one
   animal before any bonus. */
export const TIERY = [
  { cena0: 5,       rast: 1.07, prijem: 0.5 },
  { cena0: 80,      rast: 1.08, prijem: 4 },
  { cena0: 1.3e3,   rast: 1.09, prijem: 32 },
  { cena0: 2.1e4,   rast: 1.10, prijem: 256 },
  { cena0: 3.4e5,   rast: 1.11, prijem: 2050 },
  { cena0: 5.4e6,   rast: 1.12, prijem: 16400 },
  { cena0: 8.7e7,   rast: 1.13, prijem: 131000 }
];

export const ZVIERATA = {
  hedgehogs: { meno: 'Hedgehogs', jeden: 'hedgehog', domov: 'Leaf hedge' },
  voles:     { meno: 'Voles',     jeden: 'vole',     domov: 'Burrow bank' },
  hares:     { meno: 'Hares',     jeden: 'hare',     domov: 'Clover field' },
  squirrels: { meno: 'Squirrels', jeden: 'squirrel', domov: 'Old oak' },
  dormice:   { meno: 'Dormice',   jeden: 'dormouse', domov: 'Hazel thicket' },
  badgers:   { meno: 'Badgers',   jeden: 'badger',   domov: 'Sett hill' },
  foxes:     { meno: 'Foxes',     jeden: 'fox',      domov: 'Root den' },
  magpies:   { meno: 'Magpies',   jeden: 'magpie',   domov: 'Nest poles' },
  otters:    { meno: 'Otters',    jeden: 'otter',    domov: 'Otter slide' },
  herons:    { meno: 'Herons',    jeden: 'heron',    domov: 'Shallows' },
  beavers:   { meno: 'Beavers',   jeden: 'beaver',   domov: 'Lodge pond' },
  cranes:    { meno: 'Cranes',    jeden: 'crane',    domov: 'Reed marsh' },
  swans:     { meno: 'Swans',     jeden: 'swan',     domov: 'Swan lake' },
  owls:      { meno: 'Owls',      jeden: 'owl',      domov: 'Owl wood' }
};

/* The archipelago. Islands past the list come round again as a new print of the
   same biome (II, III ...) until new biomes are drawn. */
export const OSTROVY = [
  { id: 'meadow', meno: 'Meadow Isle', druhy: ['hedgehogs', 'voles', 'hares', 'squirrels', 'dormice', 'badgers', 'foxes'] },
  { id: 'reeds',  meno: 'Reed Isle',   druhy: ['magpies', 'otters', 'herons', 'beavers', 'cranes', 'swans', 'owls'] }
];

export const START_MINCE = 10;
/* Before a keeper is hired, a habitat's donation box holds this many seconds of
   its income and then waits to be emptied with a tap. */
export const BOX_SEKUND = 20;
/* A keeper empties the box on their own, for good. Price = first animal x this. */
export const STRAZCA_NASOBOK = 15;
/* Every milestone doubles that habitat. Past the list, one more every 100. */
export const MILNIKY = [25, 50, 100, 150, 200, 250, 300, 400, 500];
export const MILNIK_KROK = 100;
/* Friends of the park: the prestige. Each one adds 10 % to every habitat on every
   island, forever. Friends for a voyage = floor(sqrt(coins earned on this island / E0)). */
export const PRIATEL_BONUS = 0.10;
export const PRIATELIA_E0 = 1e11;
export const PLAVBA_MIN = 5;
/* Coins while away: all of it, up to a cap. The cap grows with friends. */
export const OFFLINE_ZAKLAD = 4 * 3600;
export const OFFLINE_PRAHY = [10, 25, 50, 100, 200, 400];   // +1 hour at each, so 10 hours at most
/* Studies: fixed upgrades bought with coins. Two per habitat, x3 each, and three
   for the whole park, x2 each. */
export const STUDIA_A = 1500, STUDIA_B = 4e6;
export const STUDIE_PARK = [
  { id: 'park-map', meno: 'A map at the gate', nasobok: 2, cena: 2.5e5 },
  { id: 'park-benches', meno: 'Benches by every habitat', nasobok: 2, cena: 5e8 },
  { id: 'park-lanterns', meno: 'Lanterns for evening walks', nasobok: 2, cena: 2e11 }
];
/* The rewarded video, for later. Off in M0. Every video gives the same, known in
   advance: twice the coins for 30 minutes (at most 2 hours banked), or twice what
   came in while away. At most 5 a day. */
export const VIDEO = { nasobok: 2, sekund: 1800, stropSekund: 7200, zaDen: 5 };

/* Numbers stay finite: nothing in the park ever reaches Infinity. */
export const STROP_CISLA = 1e300;

/* ── Small helpers ───────────────────────────────────────────────────────── */
const kladne = x => (Number.isFinite(x) && x > 0 ? x : 0);

export function ostrov(index) {
  const i = Math.max(0, Math.floor(index) || 0);
  const z = OSTROVY[i % OSTROVY.length];
  const kolo = Math.floor(i / OSTROVY.length);
  const rim = ['', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X'];
  return { id: z.id, meno: z.meno + (kolo < rim.length ? rim[kolo] : ' ' + (kolo + 1)), druhy: z.druhy, kolo };
}

export function novyStav() {
  return {
    v: VERZIA,
    mince: START_MINCE,
    zarobene: 0,          // coins earned on this island (friends are counted from it)
    spolu: 0,             // coins earned ever
    priatelia: 0,
    ostrov: 0,
    plavby: 0,
    d: TIERY.map((_, i) => ({ n: i === 0 ? 1 : 0, box: 0, k: false })),
    st: [],               // studies bought on this island
    boost: 0,             // seconds of doubled coins left
    videa: { den: '', n: 0 },
    cas: 0                // seconds played (for the stats line and tests)
  };
}

function kopia(s) {
  return { ...s, d: s.d.map(x => ({ ...x })), st: s.st.slice(), videa: { ...s.videa } };
}

/* ── Milestones ─────────────────────────────────────────────────────────── */
export function milnikov(n) {
  let m = 0;
  for (const t of MILNIKY) if (n >= t) m++;
  const last = MILNIKY[MILNIKY.length - 1];
  if (n >= last + MILNIK_KROK) m += Math.floor((n - last) / MILNIK_KROK);
  return m;
}
export function dalsiMilnik(n) {
  for (const t of MILNIKY) if (n < t) return t;
  const last = MILNIKY[MILNIKY.length - 1];
  return last + (Math.floor((n - last) / MILNIK_KROK) + 1) * MILNIK_KROK;
}
export function predoslyMilnik(n) {
  let p = 0;
  for (const t of MILNIKY) if (n >= t) p = t;
  const last = MILNIKY[MILNIKY.length - 1];
  if (n >= last + MILNIK_KROK) p = last + Math.floor((n - last) / MILNIK_KROK) * MILNIK_KROK;
  return p;
}

/* ── Prices ─────────────────────────────────────────────────────────────── */
/* price of m more animals when the habitat has n */
export function cena(i, n, m = 1) {
  const t = TIERY[i];
  if (m <= 0) return 0;
  const r = t.rast;
  return t.cena0 * Math.pow(r, n) * (Math.pow(r, m) - 1) / (r - 1);
}
/* the most animals affordable with these coins */
export function maxKupit(i, n, mince) {
  const t = TIERY[i];
  if (!(mince >= cena(i, n, 1))) return 0;
  const r = t.rast;
  let m = Math.floor(Math.log(mince * (r - 1) / (t.cena0 * Math.pow(r, n)) + 1) / Math.log(r));
  while (m > 0 && cena(i, n, m) > mince) m--;          // floating point never buys one too many
  while (cena(i, n, m + 1) <= mince) m++;
  return m;
}
export function cenaStrazcu(i) { return TIERY[i].cena0 * STRAZCA_NASOBOK; }

/* ── Studies ────────────────────────────────────────────────────────────── */
const STUDIE_CACHE = new Map();
const STUDIA_PODLA_ID = new Map();
export function studie(stav) {
  const k = (Math.max(0, Math.floor(stav.ostrov) || 0)) % OSTROVY.length;
  let out = STUDIE_CACHE.get(k);
  if (out) return out;
  const o = ostrov(k);
  out = [];
  TIERY.forEach((t, i) => {
    const z = ZVIERATA[o.druhy[i]];
    out.push({ id: `a${i}`, druh: i, meno: `Study the ${z.meno.toLowerCase()}`, nasobok: 3, cena: t.cena0 * STUDIA_A });
    out.push({ id: `b${i}`, druh: i, meno: `A bigger ${z.domov.toLowerCase()}`, nasobok: 3, cena: t.cena0 * STUDIA_B });
  });
  for (const p of STUDIE_PARK) out.push({ ...p, druh: -1 });
  out.sort((a, b) => a.cena - b.cena);
  Object.freeze(out); out.forEach(Object.freeze);
  for (const x of out) STUDIA_PODLA_ID.set(x.id, x);        // the effect of an id is the same on every island
  STUDIE_CACHE.set(k, out);
  return out;
}
export function nasobokStudii(stav, i) {
  if (!stav.st.length) return 1;
  if (!STUDIA_PODLA_ID.size) studie(stav);
  let x = 1;
  for (const id of stav.st) { const s = STUDIA_PODLA_ID.get(id); if (s && (s.druh === i || s.druh === -1)) x *= s.nasobok; }
  return x;
}

/* ── Income ─────────────────────────────────────────────────────────────── */
export function nasobokPriatelov(priatelia) { return 1 + PRIATEL_BONUS * kladne(priatelia); }
/* coins a second from habitat i, without the video boost */
export function prijemDruhu(stav, i) {
  const n = stav.d[i].n;
  if (!n) return 0;
  return n * TIERY[i].prijem * Math.pow(2, milnikov(n)) * nasobokStudii(stav, i) * nasobokPriatelov(stav.priatelia);
}
export function prijemSpolu(stav, sBoostom = true) {
  let x = 0;
  for (let i = 0; i < TIERY.length; i++) x += prijemDruhu(stav, i);
  return sBoostom && stav.boost > 0 ? x * VIDEO.nasobok : x;
}
export function kapacitaBoxu(stav, i) { return BOX_SEKUND * prijemDruhu(stav, i); }
/* coins a second that actually come in on their own (only habitats with a keeper) */
export function prijemSamo(stav) {
  let x = 0;
  for (let i = 0; i < TIERY.length; i++) if (stav.d[i].k) x += prijemDruhu(stav, i);
  return x;
}

/* ── Time ───────────────────────────────────────────────────────────────── */
/* The world moves on by dt seconds. Keepers put coins straight in; the other
   boxes fill up to their size and wait. */
export function tik(stav, dt) {
  dt = kladne(dt);
  const s = kopia(stav);
  if (!dt) return s;
  const zb = Math.min(dt, s.boost), obyc = dt - zb;
  for (let i = 0; i < TIERY.length; i++) {
    const r = prijemDruhu(s, i);
    if (!r) continue;
    const got = r * (zb * VIDEO.nasobok + obyc);
    if (s.d[i].k) { s.mince = Math.min(STROP_CISLA, s.mince + got); s.zarobene = Math.min(STROP_CISLA, s.zarobene + got); s.spolu = Math.min(STROP_CISLA, s.spolu + got); }
    else s.d[i].box = Math.min(kapacitaBoxu(s, i) * (s.boost > 0 ? VIDEO.nasobok : 1), s.d[i].box + got);
  }
  s.boost = Math.max(0, s.boost - dt);
  s.cas += dt;
  return s;
}

export function zber(stav, i) {
  const s = kopia(stav), z = s.d[i].box;
  s.d[i].box = 0;
  s.mince = Math.min(STROP_CISLA, s.mince + z); s.zarobene = Math.min(STROP_CISLA, s.zarobene + z); s.spolu = Math.min(STROP_CISLA, s.spolu + z);
  return { stav: s, zisk: z };
}
export function zberVsetko(stav) {
  let s = stav, spolu = 0;
  for (let i = 0; i < TIERY.length; i++) { const r = zber(s, i); s = r.stav; spolu += r.zisk; }
  return { stav: s, zisk: spolu };
}

/* Back after being away dt seconds: everything that would have come in, up to the cap. */
export function stropOffline(stav) {
  let h = 0;
  for (const t of OFFLINE_PRAHY) if (kladne(stav.priatelia) >= t) h++;
  return OFFLINE_ZAKLAD + h * 3600;
}
export function offline(stav, dt) {
  dt = kladne(dt);
  const strop = stropOffline(stav), sek = Math.min(dt, strop);
  const pred = stav.mince;
  const s = tik(stav, sek);
  return { stav: s, zisk: s.mince - pred, sekundy: sek, strop, odrezane: dt - sek };
}

/* ── Buying ─────────────────────────────────────────────────────────────── */
/* A habitat shows (and can be built) once the one before it has an animal. */
export function odomknuty(stav, i) { return i === 0 || stav.d[i - 1].n > 0; }

export function kup(stav, i, m = 1) {
  if (!odomknuty(stav, i) || !(m >= 1)) return { stav, ok: false };
  const c = cena(i, stav.d[i].n, m);
  if (!(stav.mince >= c)) return { stav, ok: false };
  const s = kopia(stav);
  const pred = milnikov(s.d[i].n);
  s.mince -= c; s.d[i].n += m;
  return { stav: s, ok: true, cena: c, milnik: milnikov(s.d[i].n) > pred, novy: stav.d[i].n === 0 };
}
export function najmi(stav, i) {
  if (stav.d[i].k || !stav.d[i].n) return { stav, ok: false };
  const c = cenaStrazcu(i);
  if (!(stav.mince >= c)) return { stav, ok: false };
  let s = zber(stav, i).stav;
  s.mince -= c; s.d[i].k = true;
  return { stav: s, ok: true, cena: c };
}
export function kupStudiu(stav, id) {
  const x = studie(stav).find(q => q.id === id);
  if (!x || stav.st.includes(id)) return { stav, ok: false };
  if (x.druh >= 0 && !stav.d[x.druh].n) return { stav, ok: false };
  if (!(stav.mince >= x.cena)) return { stav, ok: false };
  const s = kopia(stav);
  s.mince -= x.cena; s.st.push(id);
  return { stav: s, ok: true, cena: x.cena };
}

/* ── The voyage (prestige) ─────────────────────────────────────────────── */
export function priateliaZa(zarobene) {
  const x = kladne(zarobene) / PRIATELIA_E0;
  let f = Math.floor(Math.sqrt(x));
  while (f > 0 && f * f > x) f--;                 // exact at the edges, whatever sqrt rounds to
  while ((f + 1) * (f + 1) <= x) f++;
  return f;
}
export function plavbaMozna(stav) { return priateliaZa(stav.zarobene) >= PLAVBA_MIN; }
/* Sail on: the island stays on the map as it is, the new one starts small. Friends,
   the coins-ever count and any banked boost come along. */
export function plavba(stav) {
  const f = priateliaZa(stav.zarobene);
  if (f < PLAVBA_MIN) return { stav, ok: false, priatelia: 0 };
  const n = novyStav();
  n.priatelia = stav.priatelia + f;
  n.ostrov = stav.ostrov + 1;
  n.plavby = stav.plavby + 1;
  n.spolu = stav.spolu;
  n.boost = stav.boost;
  n.videa = { ...stav.videa };
  n.cas = stav.cas;
  return { stav: n, ok: true, priatelia: f };
}

/* ── The rewarded video (off in M0; the page never calls it while the flag is off) ── */
export function videoMozne(stav, den) {
  const n = stav.videa.den === den ? stav.videa.n : 0;
  return n < VIDEO.zaDen;
}
export function odmenaVidea(stav, druh, den, zisk = 0) {
  if (!videoMozne(stav, den)) return { stav, ok: false };
  const s = kopia(stav);
  s.videa = { den, n: (stav.videa.den === den ? stav.videa.n : 0) + 1 };
  if (druh === 'boost') s.boost = Math.min(VIDEO.stropSekund, s.boost + VIDEO.sekund);
  else if (druh === 'offline') { const z = kladne(zisk); s.mince += z; s.zarobene += z; s.spolu += z; }
  else return { stav, ok: false };
  return { stav: s, ok: true };
}

/* ── Numbers for people ────────────────────────────────────────────────── */
const JEDNOTKY = ['', 'K', 'M', 'B', 'T'];
export function formatuj(x) {
  if (!Number.isFinite(x)) return x > 0 ? 'a lot' : '0';
  if (x < 0) return '-' + formatuj(-x);
  if (x < 1000) return x < 10 && x % 1 ? (Math.floor(x * 10) / 10).toString() : Math.floor(x).toString();
  // always rounded down: the page never shows more coins than there are
  let e = Math.floor(Math.log10(x) / 3);
  let v = x / Math.pow(1000, e);
  if (v >= 1000) { e++; v /= 1000; }
  if (v < 1) { e--; v *= 1000; }
  const txt = v >= 100 ? Math.floor(v).toString() : v >= 10 ? (Math.floor(v * 10) / 10).toFixed(1) : (Math.floor(v * 100) / 100).toFixed(2);
  let u;
  if (e < JEDNOTKY.length) u = JEDNOTKY[e];
  else { const k = e - JEDNOTKY.length; u = String.fromCharCode(97 + Math.floor(k / 26) % 26) + String.fromCharCode(97 + k % 26); }
  return txt + ' ' + u;
}
export function formatujCas(sek) {
  sek = Math.floor(kladne(sek));
  const h = Math.floor(sek / 3600), m = Math.floor(sek % 3600 / 60), s = sek % 60;
  if (h) return `${h} h ${m} min`;
  if (m) return `${m} min${s ? ' ' + s + ' s' : ''}`;
  return `${s} s`;
}

/* ── Saving ─────────────────────────────────────────────────────────────── */
export function serializuj(stav) { return JSON.stringify(stav); }
/* Anything odd in a save (hand edits, an old version, a cut off write) falls back
   field by field; a save that cannot be read at all gives a new park. */
export function nacitaj(text) {
  let o;
  try { o = JSON.parse(text); } catch (e) { return novyStav(); }
  if (!o || typeof o !== 'object' || o.v !== VERZIA) return novyStav();
  const s = novyStav();
  const num = (x, d) => (Number.isFinite(x) && x >= 0 ? x : d);
  s.mince = num(o.mince, s.mince);
  s.zarobene = num(o.zarobene, 0);
  s.spolu = num(o.spolu, 0);
  s.priatelia = Math.floor(num(o.priatelia, 0));
  s.ostrov = Math.floor(num(o.ostrov, 0));
  s.plavby = Math.floor(num(o.plavby, 0));
  s.boost = Math.min(VIDEO.stropSekund, num(o.boost, 0));
  s.cas = num(o.cas, 0);
  if (o.videa && typeof o.videa.den === 'string') s.videa = { den: o.videa.den.slice(0, 10), n: Math.min(VIDEO.zaDen, Math.floor(num(o.videa.n, 0))) };
  if (Array.isArray(o.d)) {
    s.d = TIERY.map((_, i) => {
      const x = o.d[i] || {};
      const n = Math.min(1e6, Math.floor(num(x.n, 0)));
      return { n: i === 0 ? Math.max(1, n) : n, box: num(x.box, 0), k: x.k === true && n > 0 };
    });
  }
  if (Array.isArray(o.st)) { const ok = new Set(studie(s).map(q => q.id)); s.st = [...new Set(o.st.filter(x => ok.has(x)))]; }
  // a box never holds more than it can
  s.d.forEach((x, i) => { x.box = Math.min(x.box, kapacitaBoxu(s, i) * VIDEO.nasobok); });
  return s;
}
