// Olive's Daily Case: jadro bez DOM (28. 9. 2026, Fable). Beží v prehliadači aj v Node (testy).
// Andrej 28. 9.: „nekonečná hra, krásna hra a funkčná hra“. Návrh: ops/games/denny-pripad/NAVRH.md.
//
// Každý deň jeden prípad zo semena dátumu. Susedia si ráno niečo požičali, išli niekam a vyrazili
// v nejakom čase; hráč to poskladá v logickej mriežke. Generátor pridáva pravdivé stopy, kým ich
// ľudské vyvodzovanie (vyvod) nevyrieši celé bez hádania, potom každú zbytočnú stopu zahodí.
// Keď vyvodzovanie vyrieši mriežku, riešenie je jediné (každý krok je platný dôsledok stôp);
// testy to aj tak overujú nezávislým úplným prehľadávaním (pocetRieseni).

export const LUDIA = ['Walt', 'June', 'Olive', 'Hollis', 'Tansy', 'Tilly', 'Juniper'];
export const VECI = ['the lantern', 'the picnic basket', 'the brass key', 'the prize pumpkin', 'the recipe book',
  'the teapot', 'the fishing rod', 'the umbrella', 'the old map', 'the violin'];
export const MIESTA = ['the mill', 'the bakery', 'the orchard', 'the library', 'the pond', 'the clock shop',
  'the greenhouse', 'the post office'];
export const CASY = ['8 am', '9 am', '10 am', '11 am', 'noon'];
export const START = '2026-09-28';

// Náročnosť podľa dňa v týždni (0 = nedeľa): počet susedov a kategórie okrem „kto“.
const TYZDEN = [
  { n: 4, kat: ['what', 'where'], nazov: 'Sunday family case' },
  { n: 3, kat: ['what', 'where'], nazov: 'Monday warm-up' },
  { n: 3, kat: ['what', 'where', 'when'], nazov: 'Tuesday' },
  { n: 4, kat: ['what', 'where'], nazov: 'Wednesday' },
  { n: 4, kat: ['what', 'where', 'when'], nazov: 'Thursday' },
  { n: 4, kat: ['what', 'where', 'when'], nazov: 'Friday' },
  { n: 5, kat: ['what', 'where', 'when'], nazov: 'Saturday big case' },
];

// ---------- náhoda so semenom ----------
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function rng(seed) {
  let a = typeof seed === 'number' ? seed >>> 0 : hash(String(seed));
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function zamiesaj(pole, r) {
  const p = pole.slice();
  for (let i = p.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  return p;
}

// ---------- dátum a číslo prípadu ----------
export function cisloPripadu(datum) {
  return Math.round((Date.parse(datum + 'T12:00:00Z') - Date.parse(START + 'T12:00:00Z')) / 864e5) + 1;
}
export function denVTyzdni(datum) { return new Date(datum + 'T12:00:00Z').getUTCDay(); }

// ---------- mriežka vzťahov ----------
// Kategórie 0..m-1 (0 = kto). Pre dvojicu a < b matica n x n: 0 neznáme, 1 áno, -1 nie.
export function novaMriezka(n, m) {
  const g = { n, m, rel: {} };
  for (let a = 0; a < m; a++) for (let b = a + 1; b < m; b++) g.rel[a + ',' + b] = new Int8Array(n * n);
  return g;
}
export function kopiaMriezky(g) {
  const h = { n: g.n, m: g.m, rel: {} };
  for (const k in g.rel) h.rel[k] = g.rel[k].slice();
  return h;
}
export function daj(g, a, i, b, j) {
  if (a === b) return i === j ? 1 : -1;
  return a < b ? g.rel[a + ',' + b][i * g.n + j] : g.rel[b + ',' + a][j * g.n + i];
}
function zapis(g, a, i, b, j, v) {
  if (a < b) g.rel[a + ',' + b][i * g.n + j] = v; else g.rel[b + ',' + a][j * g.n + i] = v;
}

// ---------- stopy ----------
// Entita E = [kategória, index]. Typy: rovnaky, rozny, jedenZ, skor, hodinaPo, aniAni.
export function pravdivaEntita(ries, E) { return E[0] === 0 ? E[1] : ries[E[0]].indexOf(E[1]); }
export function plati(st, ries) {
  const o = (E) => pravdivaEntita(ries, E);
  const cas = (E) => (st.T === E[0] ? E[1] : ries[st.T][o(E)]);
  switch (st.typ) {
    case 'rovnaky': return o(st.e[0]) === o(st.e[1]);
    case 'rozny': return o(st.e[0]) !== o(st.e[1]);
    case 'jedenZ': { const p = o(st.e[0]); return p === o(st.e[1]) || p === o(st.e[2]); }
    case 'skor': return cas(st.e[0]) < cas(st.e[1]);
    case 'hodinaPo': return cas(st.e[0]) === cas(st.e[1]) + 1;
    case 'aniAni': return o(st.e[0]) !== o(st.e[2]) && o(st.e[1]) !== o(st.e[2]); // A a B môžu byť tá istá osoba
    default: throw new Error('neznáma stopa ' + st.typ);
  }
}

// ---------- ľudské vyvodzovanie ----------
// Vráti { g, vyriesene, spor, kroky }. Krok: { a, i, b, j, v, dovod, ... } kde dovod je číslo stopy alebo pravidlo
// (riadok, posledna, spojenie, vylucenie) a krok nesie aj premisy, z ktorých nápoveda zloží vysvetlenie:
//   riadok: ano = [a, i, b, j] známa zhoda v tom istom riadku alebo stĺpci;
//   posledna: os = 'riadok' | 'stlpec' (v ktorom smere ostala jediná možnosť);
//   spojenie: link = [a, i, b, j] známa zhoda, znama = [a, i, b, j, v] známy vzťah k tretej kategórii;
//   vylucenie: kat = c, moz1 a moz2 = možnosti oboch v kategórii c (nemajú nič spoločné);
//   stopa jedenZ: nie = [a, i, b, j] vylúčená druhá možnosť; stopa skor/hodinaPo: iny = E, moznosti = časy druhého.
export function vyvod(pripad, stopy, zaciatok) {
  const { n, m, T } = pripad;
  const g = zaciatok ? kopiaMriezky(zaciatok) : novaMriezka(n, m);
  const kroky = [];
  let spor = false;
  const nastav = (a, i, b, j, v, dovod, extra) => {
    const s = daj(g, a, i, b, j);
    if (s === v) return false;
    if (s !== 0) { spor = true; return false; }
    zapis(g, a, i, b, j, v);
    kroky.push({ a, i, b, j, v, dovod, ...extra });
    return true;
  };
  const casy = (E) => {
    if (E[0] === T) return [E[1]];
    const r = [];
    for (let k = 0; k < n; k++) if (daj(g, E[0], E[1], T, k) !== -1) r.push(k);
    return r;
  };
  const vylucCas = (E, k, dovod, extra) => (E[0] === T ? (spor = true, false) : nastav(E[0], E[1], T, k, -1, dovod, extra));
  const rozni = (E1, E2, dovod) => (E1[0] === E2[0] ? false : nastav(E1[0], E1[1], E2[0], E2[1], -1, dovod));

  // Priame stopy raz na začiatku. „Neither A nor B ... C“ hovorí len A != C a B != C (A a B môžu byť tá istá osoba).
  stopy.forEach((st, ix) => {
    if (st.typ === 'rovnaky') nastav(st.e[0][0], st.e[0][1], st.e[1][0], st.e[1][1], 1, ix);
    if (st.typ === 'rozny') nastav(st.e[0][0], st.e[0][1], st.e[1][0], st.e[1][1], -1, ix);
    if (st.typ === 'jedenZ') {
      const [E, X1, X2] = st.e;
      for (let k = 0; k < n; k++) if (k !== X1[1] && k !== X2[1]) nastav(E[0], E[1], X1[0], k, -1, ix);
    }
    if (st.typ === 'aniAni') { rozni(st.e[0], st.e[2], ix); rozni(st.e[1], st.e[2], ix); }
    // „X set off earlier than Y“ a „exactly one hour after“ porovnávajú dvoch rôznych ľudí (nikto nie je skôr ako on sám)
    if (st.typ === 'skor' || st.typ === 'hodinaPo') rozni(st.e[0], st.e[1], ix);
  });

  let zmena = true;
  while (zmena && !spor) {
    zmena = false;
    // R1, R2: v riadku aj stĺpci práve jedno áno.
    for (let a = 0; a < m; a++) for (let b = a + 1; b < m; b++) {
      for (let i = 0; i < n; i++) {
        let ano = -1, nezname = [], pocetAno = 0;
        for (let j = 0; j < n; j++) { const s = daj(g, a, i, b, j); if (s === 1) { ano = j; pocetAno++; } else if (s === 0) nezname.push(j); }
        if (pocetAno > 1) spor = true;
        if (ano >= 0) for (const j of nezname) zmena = nastav(a, i, b, j, -1, 'riadok', { ano: [a, i, b, ano] }) || zmena;
        else if (nezname.length === 1) zmena = nastav(a, i, b, nezname[0], 1, 'posledna', { os: 'riadok' }) || zmena;
        else if (nezname.length === 0) spor = true;
      }
      for (let j = 0; j < n; j++) {
        let ano = -1, nezname = [], pocetAno = 0;
        for (let i = 0; i < n; i++) { const s = daj(g, a, i, b, j); if (s === 1) { ano = i; pocetAno++; } else if (s === 0) nezname.push(i); }
        if (pocetAno > 1) spor = true;
        if (ano >= 0) for (const i of nezname) zmena = nastav(a, i, b, j, -1, 'riadok', { ano: [a, ano, b, j] }) || zmena;
        else if (nezname.length === 1) zmena = nastav(a, nezname[0], b, j, 1, 'posledna', { os: 'stlpec' }) || zmena;
        else if (nezname.length === 0) spor = true;
      }
    }
    // R3: keď A_i = B_j, majú rovnaký vzťah ku každej tretej kategórii.
    for (let a = 0; a < m; a++) for (let b = a + 1; b < m; b++) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (daj(g, a, i, b, j) !== 1) continue;
      for (let c = 0; c < m; c++) {
        if (c === a || c === b) continue;
        for (let k = 0; k < n; k++) {
          const x = daj(g, a, i, c, k), y = daj(g, b, j, c, k);
          if (x !== 0 && y === 0) zmena = nastav(b, j, c, k, x, 'spojenie', { link: [a, i, b, j], znama: [a, i, c, k, x] }) || zmena;
          else if (y !== 0 && x === 0) zmena = nastav(a, i, c, k, y, 'spojenie', { link: [a, i, b, j], znama: [b, j, c, k, y] }) || zmena;
          else if (x !== 0 && y !== 0 && x !== y) spor = true;
        }
      }
    }
    // R6: ak dve entity nemôžu mať v tretej kategórii nič spoločné, nie sú tá istá osoba.
    for (let a = 0; a < m; a++) for (let b = a + 1; b < m; b++) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (daj(g, a, i, b, j) !== 0) continue;
      for (let c = 0; c < m; c++) {
        if (c === a || c === b) continue;
        const moz1 = [], moz2 = [];
        for (let k = 0; k < n; k++) { if (daj(g, a, i, c, k) !== -1) moz1.push(k); if (daj(g, b, j, c, k) !== -1) moz2.push(k); }
        if (!moz1.some((k) => moz2.includes(k))) { zmena = nastav(a, i, b, j, -1, 'vylucenie', { kat: c, moz1, moz2 }) || zmena; break; }
      }
    }
    // Stopy, ktoré sa dajú použiť opakovane.
    stopy.forEach((st, ix) => {
      if (spor) return;
      if (st.typ === 'jedenZ') {
        const [E, X1, X2] = st.e;
        const s1 = daj(g, E[0], E[1], X1[0], X1[1]), s2 = daj(g, E[0], E[1], X2[0], X2[1]);
        if (s1 === -1) zmena = nastav(E[0], E[1], X2[0], X2[1], 1, ix, { nie: [E[0], E[1], X1[0], X1[1]] }) || zmena;
        if (s2 === -1) zmena = nastav(E[0], E[1], X1[0], X1[1], 1, ix, { nie: [E[0], E[1], X2[0], X2[1]] }) || zmena;
      }
      if (st.typ === 'skor' || st.typ === 'hodinaPo') {
        const [E1, E2] = st.e;
        const c1 = casy(E1), c2 = casy(E2);
        if (!c1.length || !c2.length) { spor = true; return; }
        for (const k of c1) {
          const ok = st.typ === 'skor' ? c2.some((t) => t > k) : c2.includes(k - 1);
          if (!ok) zmena = vylucCas(E1, k, ix, { iny: E2, moznosti: c2 }) || zmena;
        }
        for (const k of c2) {
          const ok = st.typ === 'skor' ? c1.some((t) => t < k) : c1.includes(k + 1);
          if (!ok) zmena = vylucCas(E2, k, ix, { iny: E1, moznosti: c1 }) || zmena;
        }
      }
    });
  }
  let vyriesene = !spor;
  if (vyriesene) outer: for (let b = 1; b < m; b++) for (let i = 0; i < n; i++) {
    let ano = 0;
    for (let j = 0; j < n; j++) if (daj(g, 0, i, b, j) === 1) ano++;
    if (ano !== 1) { vyriesene = false; break outer; }
  }
  return { g, vyriesene, spor, kroky };
}

// ---------- nezávislé úplné prehľadávanie (na testy) ----------
function* permutacie(n) {
  const p = [...Array(n).keys()];
  const c = new Array(n).fill(0);
  yield p.slice();
  let i = 0;
  while (i < n) {
    if (c[i] < i) { const k = i % 2 ? c[i] : 0; [p[k], p[i]] = [p[i], p[k]]; yield p.slice(); c[i]++; i = 0; }
    else { c[i] = 0; i++; }
  }
}
export function pocetRieseni(pripad, stopy, limit = 2) {
  const { n, m } = pripad;
  const perms = [...permutacie(n)];
  const kat = (st) => Math.max(...st.e.map((E) => E[0]), st.T !== undefined && (st.typ === 'skor' || st.typ === 'hodinaPo') ? st.T : 0);
  const podla = Array.from({ length: m }, () => []);
  for (const st of stopy) podla[kat(st)].push(st);
  const ries = [[...Array(n).keys()]];
  let pocet = 0;
  const krok = (c) => {
    if (pocet >= limit) return;
    if (c === m) { pocet++; return; }
    for (const p of perms) {
      ries[c] = p;
      if (podla[c].every((st) => plati(st, ries))) krok(c + 1);
      if (pocet >= limit) return;
    }
  };
  if (podla[0].every((st) => plati(st, ries))) krok(1);
  return pocet;
}

// ---------- text stôp ----------
const KAT_NAZOV = { who: 'Who', what: 'Borrowed', where: 'Went to', when: 'Set off' };
export function nazvy(pripad) { return pripad.kategorie.map((k) => KAT_NAZOV[k.id]); }
function kto(p, E) {
  const k = p.kategorie[E[0]], x = k.polozky[E[1]];
  if (k.id === 'who') return x;
  if (k.id === 'what') return 'whoever borrowed ' + x;
  if (k.id === 'where') return 'whoever went to ' + x;
  return 'whoever set off at ' + x;
}
function co(p, E, zaporne) {
  const k = p.kategorie[E[0]], x = k.polozky[E[1]];
  if (k.id === 'what') return (zaporne ? 'did not borrow ' : 'borrowed ') + x;
  if (k.id === 'where') return (zaporne ? 'did not go to ' : 'went to ') + x;
  if (k.id === 'when') return (zaporne ? 'did not set off at ' : 'set off at ') + x;
  return (zaporne ? 'is not ' : 'is ') + x;
}
function coAleboCo(p, E1, E2) {
  const k = p.kategorie[E1[0]];
  const a = k.polozky[E1[1]], b = k.polozky[E2[1]];
  if (k.id === 'what') return 'borrowed either ' + a + ' or ' + b;
  if (k.id === 'where') return 'went to either ' + a + ' or ' + b;
  return 'set off at either ' + a + ' or ' + b;
}
const velke = (s) => s[0].toUpperCase() + s.slice(1);
export function textStopy(p, st) {
  switch (st.typ) {
    case 'rovnaky': return velke(kto(p, st.e[0])) + ' ' + co(p, st.e[1]) + '.';
    case 'rozny': return velke(kto(p, st.e[0])) + ' ' + co(p, st.e[1], true) + '.';
    case 'jedenZ': return velke(kto(p, st.e[0])) + ' ' + coAleboCo(p, st.e[1], st.e[2]) + '.';
    case 'skor': return velke(kto(p, st.e[0])) + ' set off earlier than ' + kto(p, st.e[1]) + '.';
    case 'hodinaPo': return velke(kto(p, st.e[0])) + ' set off exactly one hour after ' + kto(p, st.e[1]) + '.';
    case 'aniAni': return 'Neither ' + kto(p, st.e[0]) + ' nor ' + kto(p, st.e[1]) + ' ' + co(p, st.e[2]) + '.';
    default: return '';
  }
}

// ---------- generátor ----------
function kandidati(p, ries, r) {
  const { n, m, T } = p;
  const vsetky = [];
  const ent = [];
  for (let c = 0; c < m; c++) for (let v = 0; v < n; v++) ent.push([c, v]);
  const o = (E) => pravdivaEntita(ries, E);
  const cas = (E) => (T === E[0] ? E[1] : ries[T][o(E)]);
  for (const E1 of ent) for (const E2 of ent) {
    if (E1[0] >= E2[0]) continue;
    if (o(E1) === o(E2)) vsetky.push({ typ: 'rovnaky', e: [E1, E2] });
    else vsetky.push({ typ: 'rozny', e: [E1, E2] });
  }
  for (const E of ent) for (let c = 0; c < m; c++) {
    if (c === E[0] || c === 0) continue;
    const pravda = ries[c][o(E)];
    for (let v = 0; v < n; v++) if (v !== pravda) {
      const dvojica = r() < 0.5 ? [[c, pravda], [c, v]] : [[c, v], [c, pravda]];
      vsetky.push({ typ: 'jedenZ', e: [E, ...dvojica] });
    }
  }
  if (T !== undefined) for (const E1 of ent) for (const E2 of ent) {
    if (E1[0] === T || E2[0] === T || o(E1) === o(E2)) continue;
    if (cas(E1) < cas(E2)) vsetky.push({ typ: 'skor', e: [E1, E2], T });
    if (cas(E1) === cas(E2) + 1) vsetky.push({ typ: 'hodinaPo', e: [E1, E2], T });
  }
  for (const E1 of ent) for (const E2 of ent) for (const E3 of ent) {
    if (E1[0] > E2[0] || (E1[0] === E2[0] && E1[1] >= E2[1])) continue;
    if (E3[0] === E1[0] || E3[0] === E2[0] || E3[0] === 0) continue;
    if (o(E1) === o(E2) || o(E1) === o(E3) || o(E2) === o(E3)) continue;
    vsetky.push({ typ: 'aniAni', e: [E1, E2, E3] });
  }
  // Najprv typ podľa váhy, potom náhodná stopa toho typu; inak by typ s najviac kombináciami (aniAni) prevážil.
  const VAHY = { rovnaky: 0.3, rozny: 1, jedenZ: 1.1, skor: 1.3, hodinaPo: 0.8, aniAni: 0.7 };
  const skupiny = {};
  for (const s of vsetky) (skupiny[s.typ] ||= []).push(s);
  for (const t in skupiny) skupiny[t] = zamiesaj(skupiny[t], r);
  const poradie = [];
  for (;;) {
    const typy = Object.keys(skupiny).filter((t) => skupiny[t].length);
    if (!typy.length) break;
    const spolu = typy.reduce((x, t) => x + VAHY[t], 0);
    let h = r() * spolu, t = typy[0];
    for (const u of typy) { h -= VAHY[u]; if (h <= 0) { t = u; break; } }
    poradie.push(skupiny[t].pop());
  }
  return poradie;
}

export function pripadDna(datum) {
  const r = rng('olive-case-' + datum);
  const den = TYZDEN[denVTyzdni(datum)];
  const n = den.n;
  const kategorie = [{ id: 'who', polozky: zamiesaj(LUDIA, r).slice(0, n) }];
  for (const id of den.kat) {
    if (id === 'what') kategorie.push({ id, polozky: zamiesaj(VECI, r).slice(0, n) });
    if (id === 'where') kategorie.push({ id, polozky: zamiesaj(MIESTA, r).slice(0, n) });
    if (id === 'when') kategorie.push({ id, polozky: CASY.slice(0, n), poradie: true });
  }
  const m = kategorie.length;
  const T = kategorie.findIndex((k) => k.id === 'when');
  const pripad = { datum, cislo: cisloPripadu(datum), den: den.nazov, n, m, T: T >= 0 ? T : undefined, kategorie };
  // Riešenie: ries[c][osoba] = index položky v kategórii c.
  const ries = [[...Array(n).keys()]];
  for (let c = 1; c < m; c++) ries.push(zamiesaj([...Array(n).keys()], r));
  const pool = kandidati(pripad, ries, r);
  const stopy = [];
  const rovnakaOtazka = (x, st) => x.typ === 'jedenZ' && st.typ === 'jedenZ' && x.e[0][0] === st.e[0][0] && x.e[0][1] === st.e[0][1] && x.e[1][0] === st.e[1][0];
  for (const st of pool) {
    if (stopy.some((x) => rovnakaOtazka(x, st))) continue; // dve „either … or“ o tom istom pôsobia ako chyba
    stopy.push(st);
    if (vyvod(pripad, stopy).vyriesene) break;
  }
  // Minimalizácia: odstráň každú stopu, bez ktorej to stále ide.
  for (let i = stopy.length - 1; i >= 0; i--) {
    const bez = stopy.slice(0, i).concat(stopy.slice(i + 1));
    if (vyvod(pripad, bez).vyriesene) stopy.splice(i, 1);
  }
  const vysledne = zamiesaj(stopy, r).map(({ vaha, ...st }) => ({ ...st, text: '' }));
  for (const st of vysledne) st.text = textStopy(pripad, st);
  return { ...pripad, stopy: vysledne, riesenie: ries };
}

// ---------- hra: kontrola a nápoveda ----------
// Stav hráča: mriežka rovnakého tvaru (1 fajka, -1 krížik, 0 prázdne).
export function chyby(pripad, stav) {
  const zle = [];
  const { n, m } = pripad;
  const pravda = (a, i, b, j) => (pravdivaEntita(pripad.riesenie, [a, i]) === pravdivaEntita(pripad.riesenie, [b, j]) ? 1 : -1);
  for (let a = 0; a < m; a++) for (let b = a + 1; b < m; b++) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const s = daj(stav, a, i, b, j);
    if (s !== 0 && s !== pravda(a, i, b, j)) zle.push({ a, i, b, j });
  }
  return zle;
}
// Odpovede sú mriežky „kto“ proti každej kategórii: pre každú osobu práve jedna fajka. Ostatné mriežky
// (napríklad vec proti miestu) sú len poznámky hráča a na uzavretie prípadu netreba ich vyplniť.
export function chybajuce(pripad, stav) {
  const { n, m } = pripad, r = [];
  for (let i = 0; i < n; i++) for (let b = 1; b < m; b++) {
    let ano = 0;
    for (let j = 0; j < n; j++) if (daj(stav, 0, i, b, j) === 1) ano++;
    if (ano !== 1) r.push({ i, b });
  }
  return r;
}
export function hotovo(pripad, stav) { return chybajuce(pripad, stav).length === 0; }
export function chybyOdpovedi(pripad, stav) { return chyby(pripad, stav).filter((c) => c.a === 0); }
// Nápoveda: z hráčových správnych značiek nájde ďalší platný krok a jeho dôvod.
export function napoveda(pripad, stav) {
  const cista = kopiaMriezky(stav);
  for (const c of chyby(pripad, stav)) zapis(cista, c.a, c.i, c.b, c.j, 0);
  const { kroky } = vyvod(pripad, pripad.stopy, cista);
  const krok = kroky.find((k) => daj(stav, k.a, k.i, k.b, k.j) !== k.v);
  if (!krok) return null;
  return { ...krok, stopa: typeof krok.dovod === 'number' ? krok.dovod : null };
}
export { zapis as zapisBunku };
export { kto as ktoText };
