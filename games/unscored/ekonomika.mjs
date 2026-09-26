// UNSCORED: ekonomika. Čistý modul bez DOM: stav, ceny, krok(stav, dt), nepritomnost(stav, sekundy),
// uloženie a migrácia. Konštanty presne podľa NAVRH.md časti 3.3 a 3.8.

export const VERZIA = 1;
export const KLUC = 'unscored.v1';

export const K = {
  tuk: 1,
  posluchac: { cena: 10, rast: 1.15, dava: 0.25, milniky: [25, 50, 100] },
  kurier: { od: 8, cena: 60, rast: 1.2, berie: 0.5, dava: 0.15 },
  tlaciar: { cena: 80, rast: 1.3, berie: 0.4, dava: 0.01, pozornost: 0.08 },
  pozornost: { zaPozvanku: 1, od: 15, pokles: 0.2, klop: 100, poKlope: 40, strata: 0.12, navratPod: 50, navratKazdych: 10 },
  potichu: { trvanie: 30, pokles: 1 },
  voditko: { prve: 270, kazdych: 90, ludia: 2, odstup: 30 },
  prepocet: { prvy: 600, kazdych: 600, trvanie: 180 },
  akt2: 25,
  rozdelenie: 150,
  kontakt: 0.25,
  nepritomnostMax: 8 * 3600,
};

export const NASTROJE = [
  { id: 'zapisnik', cena: 10 },
  { id: 'krieda', cena: 30 },
  { id: 'bicykel', cena: 90 },
  { id: 'pisaci', cena: 180 },
  { id: 'kopirak', cena: 450 },
  { id: 'zadna', cena: 800 },
];

// Scenárové vodítka v M1 (texty v pribeh.mjs). Každé: +2 poslucháči, pomenovaná postava, bonus podľa voľby.
export const VODITKA = [
  { id: 'mira', cena: 50, volby: { a: { tukPlus: 1 }, b: { posluchaci: 2 } } },
  { id: 'tomas', cena: 150, volby: { a: { nahlad: true }, b: { pokles: 1.25 } } },
  { id: 'ruth', cena: 300, volby: { a: { kopirak: true, tlaciari: 1 }, b: { kopirak: true, kurieri: 2 } } },
];

export function novyStav() {
  return {
    v: VERZIA,
    hra: 0,
    sepoty: 0,
    papier: 0,
    posluchaci: 0,
    kurieri: 0,
    tlaciari: 0,
    stichnuti: 0,
    kupeneP: 0,
    kupeneK: 0,
    kupeneT: 0,
    nastroje: {},
    pozornost: 0,
    potichu: 0,
    navratZlomok: 0,
    tlacZlomok: 0,
    kontakty: 0,
    pridaniVBehu: 0,
    voditka: {},
    voditkaPocet: 0,
    voditkoCaka: null,
    dalsieVoditko: K.voditko.prve,
    bonusy: { tukPlus: 0, nahlad: false, kopirak: false, pokles: 1 },
    akt: 1,
    prepocetDo: 0,
    dalsiPrepocet: K.prepocet.prvy,
    odomknute: {},
    stat: { tuky: 0, klopania: 0, potichu: 0, maxLudi: 0, sepotySpolu: 0, poslednaVeta: 0, oznamy: 0 },
    videne: {},
  };
}

export const ludia = (s) => s.posluchaci + s.kurieri + s.tlaciari;
export const ma = (s, id) => !!s.nastroje[id];

export function cenaPosluchaca(n) {
  return K.posluchac.cena * K.posluchac.rast ** n;
}
export function cenaKuriera(n) {
  return K.kurier.cena * K.kurier.rast ** n;
}
export function cenaTlaciara(n) {
  return K.tlaciar.cena * K.tlaciar.rast ** n;
}

/** Cena za `pocet` kusov od aktuálneho počtu kúpených. */
export function cena(s, typ, pocet = 1) {
  const f = typ === 'p' ? cenaPosluchaca : typ === 'k' ? cenaKuriera : cenaTlaciara;
  const b = typ === 'p' ? s.kupeneP : typ === 'k' ? s.kupeneK : s.kupeneT;
  let sum = 0;
  for (let i = 0; i < pocet; i++) sum += f(b + i);
  return sum;
}

export const zdroj = (typ) => (typ === 't' ? 'papier' : 'sepoty');

/** Koľko kusov si hráč môže dovoliť (najviac 1000). */
export function maxKusov(s, typ) {
  const f = typ === 'p' ? cenaPosluchaca : typ === 'k' ? cenaKuriera : cenaTlaciara;
  let b = typ === 'p' ? s.kupeneP : typ === 'k' ? s.kupeneK : s.kupeneT;
  let mam = s[zdroj(typ)];
  let n = 0;
  while (n < 1000 && mam >= f(b)) {
    mam -= f(b);
    b++;
    n++;
  }
  return n;
}

export function mnozitelPosluchacov(s, sPrepoctom = true) {
  let m = 1;
  for (const x of K.posluchac.milniky) if (s.posluchaci >= x) m *= 2;
  if (ma(s, 'krieda')) m *= 2;
  m *= 1 + K.kontakt * s.kontakty;
  if (sPrepoctom && s.prepocetDo > s.hra) m *= 2;
  return m;
}

export function mnozitelKurierov(s) {
  let m = 1;
  if (ma(s, 'bicykel')) m *= 2;
  return m * (1 + K.kontakt * s.kontakty);
}

export const mnozitelTlaciarov = (s) => (ma(s, 'kopirak') ? 3 : 1);

export const hodnotaTuku = (s) => K.tuk + (ma(s, 'zapisnik') ? 1 : 0) + s.bonusy.tukPlus;

/** Čisté toky za sekundu pri plnej účinnosti (pre UI). */
export function toky(s) {
  const sepotyHrubo = s.posluchaci * K.posluchac.dava * mnozitelPosluchacov(s);
  const kurieriBeru = s.kurieri * K.kurier.berie;
  const papierHrubo = s.kurieri * K.kurier.dava * mnozitelKurierov(s);
  const tlaciariBeru = s.potichu > 0 ? 0 : s.tlaciari * K.tlaciar.berie;
  return {
    sepoty: sepotyHrubo - kurieriBeru,
    papier: papierHrubo - tlaciariBeru,
    ludiaZaMinutu: s.potichu > 0 ? 0 : s.tlaciari * K.tlaciar.dava * mnozitelTlaciarov(s) * 60,
    pozornost: (s.potichu > 0 ? -K.potichu.pokles : (s.akt >= 2 ? s.tlaciari * K.tlaciar.pozornost : 0) - poklesPozornosti(s)),
  };
}

export const poklesPozornosti = (s) => K.pozornost.pokles * (ma(s, 'zadna') ? 2 : 1) * s.bonusy.pokles;

function udalost(ev, typ, data) {
  if (ev) ev.push(data ? { typ, ...data } : { typ });
}

function skontrolujOdomknutia(s, ev) {
  const o = s.odomknute;
  if (!o.kurier && s.posluchaci >= K.kurier.od) {
    o.kurier = true;
    udalost(ev, 'odomknute', { co: 'kurier' });
  }
  if (!o.papier && s.papier > 0) {
    o.papier = true;
    udalost(ev, 'odomknute', { co: 'papier' });
  }
  if (!o.nastroje && s.papier >= NASTROJE[0].cena * 0.5) {
    o.nastroje = true;
    udalost(ev, 'odomknute', { co: 'nastroje' });
  }
  if (s.akt === 1 && ludia(s) >= K.akt2) {
    s.akt = 2;
    udalost(ev, 'akt', { akt: 2 });
  }
  const l = ludia(s);
  if (l > s.stat.maxLudi) s.stat.maxLudi = l;
  for (const m of K.posluchac.milniky) {
    const kluc = 'x2_' + m;
    if (!o[kluc] && s.posluchaci >= m) {
      o[kluc] = true;
      udalost(ev, 'milnik', { co: kluc });
    }
  }
  if (!o.rozdelenie && s.pridaniVBehu >= K.rozdelenie) {
    o.rozdelenie = true;
    udalost(ev, 'odomknute', { co: 'rozdelenie' });
  }
}

/**
 * Aktívny krok hry o dt sekúnd (dt najviac 1). Mení stav, vracia pole udalostí.
 */
export function krok(s, dt, ev = []) {
  if (!(dt > 0)) return ev;
  if (dt > 1) dt = 1;
  // poslucháči
  const hrubo = s.posluchaci * K.posluchac.dava * mnozitelPosluchacov(s) * dt;
  s.sepoty += hrubo;
  s.stat.sepotySpolu += hrubo;
  // kuriéri menia šepoty na papier, nikdy do mínusu
  if (s.kurieri > 0) {
    const chce = s.kurieri * K.kurier.berie * dt;
    const berie = Math.min(chce, s.sepoty);
    const ucinnost = chce > 0 ? berie / chce : 0;
    s.sepoty -= berie;
    s.papier += s.kurieri * K.kurier.dava * mnozitelKurierov(s) * ucinnost * dt;
  }
  // tlačiari: papier na poslucháčov, hlasná činnosť; stoja pri „potichu“
  if (s.tlaciari > 0 && s.potichu <= 0) {
    const chce = s.tlaciari * K.tlaciar.berie * dt;
    const berie = Math.min(chce, s.papier);
    const ucinnost = chce > 0 ? berie / chce : 0;
    s.papier -= berie;
    s.tlacZlomok += s.tlaciari * K.tlaciar.dava * mnozitelTlaciarov(s) * ucinnost * dt;
    while (s.tlacZlomok >= 1) {
      s.tlacZlomok -= 1;
      s.posluchaci += 1;
      s.pridaniVBehu += 1;
      udalost(ev, 'tlac');
    }
    if (s.akt >= 2) s.pozornost += s.tlaciari * K.tlaciar.pozornost * ucinnost * dt;
  }
  // pozornosť
  if (s.potichu > 0) {
    s.pozornost -= K.potichu.pokles * dt;
    s.potichu = Math.max(0, s.potichu - dt);
    if (s.potichu === 0) udalost(ev, 'potichuKoniec');
  } else s.pozornost -= poklesPozornosti(s) * dt;
  if (s.pozornost < 0) s.pozornost = 0;
  if (s.pozornost >= K.pozornost.klop) zaklopanie(s, ev);
  // stíchnutí sa vracajú po jednom, keď je ticho
  if (s.stichnuti > 0 && s.pozornost < K.pozornost.navratPod) {
    s.navratZlomok += dt;
    while (s.navratZlomok >= K.pozornost.navratKazdych && s.stichnuti > 0) {
      s.navratZlomok -= K.pozornost.navratKazdych;
      s.stichnuti -= 1;
      s.posluchaci += 1;
      udalost(ev, 'navrat');
    }
  } else if (s.stichnuti === 0) s.navratZlomok = 0;
  // čas hry: vodítka a deň prepočtu
  s.hra += dt;
  if (!s.voditkoCaka && s.voditkaPocet < VODITKA.length && s.hra >= s.dalsieVoditko) {
    s.voditkoCaka = VODITKA[s.voditkaPocet].id;
    s.voditkaPocet += 1;
    udalost(ev, 'voditko', { id: s.voditkoCaka });
  }
  if (s.akt >= 2 && s.hra >= s.dalsiPrepocet) {
    s.prepocetDo = s.hra + K.prepocet.trvanie;
    s.dalsiPrepocet = s.hra + K.prepocet.kazdych;
    udalost(ev, 'prepocet');
  }
  skontrolujOdomknutia(s, ev);
  return ev;
}

export function zaklopanie(s, ev) {
  const strata = Math.floor(s.posluchaci * K.pozornost.strata * (ma(s, 'zadna') ? 0.5 : 1));
  s.posluchaci -= strata;
  s.stichnuti += strata;
  s.pozornost = K.pozornost.poKlope;
  s.navratZlomok = 0;
  s.stat.klopania += 1;
  udalost(ev, 'klop', { strata });
}

// ------------------------------------------------------------------ činy hráča

export function tuk(s, ev = []) {
  const h = hodnotaTuku(s);
  s.sepoty += h;
  s.stat.tuky += 1;
  s.stat.sepotySpolu += h;
  udalost(ev, 'tuk', { h });
  skontrolujOdomknutia(s, ev);
  return ev;
}

export function mozeKupit(s, typ) {
  if (typ === 'p') return s.potichu <= 0;
  if (typ === 'k') return s.potichu <= 0 && !!s.odomknute.kurier;
  if (typ === 't') return ma(s, 'pisaci');
  return false;
}

/** Pridá o koľko pozornosti by nákup zvýšil (náhľad Tomasa aj logika). */
export function pozornostZaNakup(s, typ, pocet = 1) {
  if (s.akt < 2 || typ !== 'p') return 0;
  let p = 0;
  for (let i = 0; i < pocet; i++) if (s.posluchaci + i + 1 > K.pozornost.od) p += K.pozornost.zaPozvanku;
  return p;
}

/** Kúpi `pocet` ľudí danej roly (p poslucháč, k kuriér, t tlačiar). Vracia počet kúpených. */
export function kup(s, typ, pocet = 1, ev = []) {
  if (!mozeKupit(s, typ) || pocet < 1) return 0;
  const z = zdroj(typ);
  const c = cena(s, typ, pocet);
  if (s[z] < c) return 0;
  const pz = pozornostZaNakup(s, typ, pocet);
  s[z] -= c;
  if (typ === 'p') {
    s.posluchaci += pocet;
    s.kupeneP += pocet;
  } else if (typ === 'k') {
    s.kurieri += pocet;
    s.kupeneK += pocet;
  } else {
    s.tlaciari += pocet;
    s.kupeneT += pocet;
  }
  s.pridaniVBehu += pocet;
  s.pozornost += pz;
  udalost(ev, 'kup', { rola: typ, pocet });
  if (s.pozornost >= K.pozornost.klop) zaklopanie(s, ev);
  skontrolujOdomknutia(s, ev);
  return pocet;
}

export function nastrojViditelny(s, id) {
  if (ma(s, id)) return false;
  if (!s.odomknute.nastroje) return false;
  if (id === 'kopirak') return s.bonusy.kopirak && ma(s, 'pisaci');
  if (id === 'zadna') return ma(s, 'pisaci');
  const i = NASTROJE.findIndex((n) => n.id === id);
  // vidno najbližšie dva nekúpené v poradí
  let pred = 0;
  for (let j = 0; j < i; j++) if (!ma(s, NASTROJE[j].id) && NASTROJE[j].id !== 'kopirak' && NASTROJE[j].id !== 'zadna') pred++;
  return pred < 2;
}

export function kupNastroj(s, id, ev = []) {
  const n = NASTROJE.find((x) => x.id === id);
  if (!n || ma(s, id) || s.papier < n.cena) return false;
  if (id === 'kopirak' && !s.bonusy.kopirak) return false;
  s.papier -= n.cena;
  s.nastroje[id] = true;
  udalost(ev, 'nastroj', { id });
  skontrolujOdomknutia(s, ev);
  return true;
}

export function potichu(s, ev = []) {
  if (s.akt < 2 || s.potichu > 0) return false;
  s.potichu = K.potichu.trvanie;
  s.stat.potichu += 1;
  udalost(ev, 'potichu');
  return true;
}

export const voditko = (id) => VODITKA.find((v) => v.id === id);

/** Rozhovor s čakajúcim vodítkom a voľba a alebo b. */
export function vyberVoditko(s, volba, ev = []) {
  const v = voditko(s.voditkoCaka);
  if (!v || !v.volby[volba] || s.sepoty < v.cena) return false;
  s.sepoty -= v.cena;
  const e = v.volby[volba];
  let pridane = K.voditko.ludia;
  if (e.posluchaci) pridane += e.posluchaci;
  s.posluchaci += pridane;
  s.pridaniVBehu += pridane;
  if (e.kurieri) {
    s.kurieri += e.kurieri;
    s.pridaniVBehu += e.kurieri;
  }
  if (e.tlaciari) {
    s.tlaciari += e.tlaciari;
    s.pridaniVBehu += e.tlaciari;
  }
  if (e.tukPlus) s.bonusy.tukPlus += e.tukPlus;
  if (e.nahlad) s.bonusy.nahlad = true;
  if (e.pokles) s.bonusy.pokles *= e.pokles;
  if (e.kopirak) s.bonusy.kopirak = true;
  s.voditka[v.id] = volba;
  s.voditkoCaka = null;
  s.dalsieVoditko = Math.max(K.voditko.prve + K.voditko.kazdych * s.voditkaPocet, s.hra + K.voditko.odstup);
  udalost(ev, 'voditkoVzate', { id: v.id, volba, pridane });
  skontrolujOdomknutia(s, ev);
  return true;
}

// ------------------------------------------------------------------ neprítomnosť

/**
 * Hráč nebol pri hre `sekundy`. Sieť ide potichu: šepoty a papier naplno, tlačiari stoja,
 * pozornosť klesá, stíchnutí sa vrátia všetci. Žiadna strata. Orezané na 8 h.
 */
export function nepritomnost(s, sekundy) {
  const T = Math.max(0, Math.min(K.nepritomnostMax, Math.floor(sekundy)));
  const pred = { sepoty: s.sepoty, papier: s.papier, spolu: s.stat.sepotySpolu };
  const vratili = s.stichnuti;
  s.posluchaci += s.stichnuti;
  s.stichnuti = 0;
  s.navratZlomok = 0;
  const lm = mnozitelPosluchacov(s, false);
  const km = mnozitelKurierov(s);
  const sepotyZaS = s.posluchaci * K.posluchac.dava * lm;
  const chce = s.kurieri * K.kurier.berie;
  const papierZaS = s.kurieri * K.kurier.dava * km;
  const pokles = poklesPozornosti(s);
  for (let i = 0; i < T; i++) {
    s.sepoty += sepotyZaS;
    s.stat.sepotySpolu += sepotyZaS;
    if (chce > 0) {
      const berie = Math.min(chce, s.sepoty);
      s.sepoty -= berie;
      s.papier += papierZaS * (berie / chce);
    }
    if (s.pozornost > 0) s.pozornost = Math.max(0, s.pozornost - pokles);
  }
  if (T > 0) s.potichu = 0;
  return {
    sekundy: T,
    orezane: sekundy > K.nepritomnostMax,
    sepoty: s.sepoty - pred.sepoty,
    papier: s.papier - pred.papier,
    rozhovory: s.stat.sepotySpolu - pred.spolu,
    vratili,
  };
}

// ------------------------------------------------------------------ uloženie a migrácia

function platneCislo(x) {
  return typeof x === 'number' && Number.isFinite(x) && x >= 0;
}

/** Migrácia podľa verzie; každé pole sa overí proti typu v novom stave. Neznáma verzia vráti null. */
export function migruj(obal) {
  if (!obal || typeof obal !== 'object') return null;
  if (obal.v !== 1) return null;
  const vzor = novyStav();
  const z = obal.stav;
  if (!z || typeof z !== 'object') return null;
  const s = novyStav();
  for (const k of Object.keys(vzor)) {
    const d = vzor[k];
    const x = z[k];
    if (typeof d === 'number') s[k] = platneCislo(x) ? x : d;
    else if (d === null) s[k] = typeof x === 'string' && voditko(x) ? x : null;
    else if (typeof d === 'object') {
      if (x && typeof x === 'object' && !Array.isArray(x)) {
        for (const kk of Object.keys(x)) {
          const hodnota = x[kk];
          if (kk in d) {
            if (typeof d[kk] === 'number') s[k][kk] = platneCislo(hodnota) ? hodnota : d[kk];
            else if (typeof d[kk] === 'boolean') s[k][kk] = !!hodnota;
          } else if (typeof hodnota === 'boolean' || typeof hodnota === 'string') s[k][kk] = hodnota;
        }
      }
    }
  }
  s.v = VERZIA;
  s.akt = s.akt >= 2 ? 2 : 1;
  for (const k of ['posluchaci', 'kurieri', 'tlaciari', 'stichnuti', 'kupeneP', 'kupeneK', 'kupeneT', 'voditkaPocet']) s[k] = Math.floor(s[k]);
  return s;
}

export function serializuj(s, teraz = Date.now()) {
  return JSON.stringify({ v: VERZIA, ulozene: teraz, stav: s });
}

/** Vráti { stav, ulozene } alebo { chyba }. Nikdy nehodí výnimku. */
export function nacitaj(text) {
  try {
    const obal = JSON.parse(text);
    if (obal && typeof obal === 'object' && obal.v !== 1) return { chyba: 'verzia' };
    const stav = migruj(obal);
    if (!stav) return { chyba: 'poskodene' };
    return { stav, ulozene: platneCislo(obal.ulozene) ? obal.ulozene : Date.now() };
  } catch {
    return { chyba: 'poskodene' };
  }
}

const b64 = {
  en: (t) => (typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(t))) : Buffer.from(t, 'utf8').toString('base64')),
  de: (t) => (typeof atob === 'function' ? decodeURIComponent(escape(atob(t))) : Buffer.from(t, 'base64').toString('utf8')),
};

export function exportKod(s) {
  return 'UNSCORED1.' + b64.en(serializuj(s));
}

export function importKod(kod) {
  try {
    const t = String(kod || '').trim();
    if (!t.startsWith('UNSCORED1.')) return { chyba: 'kod' };
    return nacitaj(b64.de(t.slice(10)));
  } catch {
    return { chyba: 'kod' };
  }
}

/** Úložisko s try/catch: keď zlyhá (súkromné okno), hra beží ďalej a vráti false. */
export function uloz(uloziste, s, teraz = Date.now()) {
  try {
    uloziste.setItem(KLUC, serializuj(s, teraz));
    return true;
  } catch {
    return false;
  }
}

export function nacitajZ(uloziste) {
  try {
    const t = uloziste.getItem(KLUC);
    if (t === null || t === undefined) return { prazdne: true };
    return nacitaj(t);
  } catch {
    return { chyba: 'uloziste' };
  }
}
