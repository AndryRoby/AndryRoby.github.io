/* Blok „Poslať si výsledok e-mailom“ na kontrole e-faktúry (relácia 205, SPEC časti 3, 5.2 a 7.2).
 *
 * Tu sú len čisté funkcie a malý riadič, aby sa dali testovať v Node bez prehliadača
 * (vysledok-blok.test.mjs). Samotný blok (formulár, súhlas, odoslanie) je spoločný modul hubu
 * /vysledok/vysledok-email.js; app.js ho načíta dynamickým importom až pod skutočným výsledkom.
 *
 * Čo odíde na server: len zhrnutie z bieleho zoznamu (profil, typ, počty a kódy pravidiel s počtom
 * výskytov). Nikdy hodnota, správa (sprava obsahuje údaje z faktúry), xpath, názov súboru ani XML.
 * Zhrnutie sa skladá nanovo pole po poli, nič sa nekopíruje z objektu výsledku celé.
 */

export const POVOD_WORKERA = 'https://feed-monitor.arling.workers.dev';
export const MODUL_BLOKU = '/vysledok/vysledok-email.js?v=1';

const PROFILY = ['en16931', 'peppol', 'xrechnung', 'neznamy'];
const TYPY = ['Invoice', 'CreditNote', 'CII'];
// Poradie je zároveň poradie dôležitosti (chyba pred varovaním pred informáciou).
const ZAVAZNOSTI = ['chyba', 'varovanie', 'informacia'];
// Rovnaký regex ako jadro hubu (vysledok-jadro.mjs KOD_EF) a worker (vysledok.mjs EF_KOD): XRechnung má kódy s malou
// príponou (BR-DE-23-a až BR-DE-25-b, BR-DE-CVD-06-a, -b), ktoré musia ísť v oficiálnom zápise (O1 po V1 N1, V3 V3).
const KOD = /^(?=.{2,40}$)[A-Z][A-Z0-9-]*(?:-[a-z])?$/;
export const MAX_PRAVIDIEL = 60;
const MAX_POCET = 1000;

const celeCislo = (n, min, max) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.min(max, Math.max(min, Math.trunc(x)));
};

/** Smie sa blok ukázať? Len pod skutočným výsledkom UBL (Invoice, CreditNote) alebo CII, nikdy pod vzorom. */
export function blokSmie(v, jeUkazka) {
  return !!v && !jeUkazka && TYPY.indexOf(v.typ) !== -1;
}

/* Kód pravidla do zhrnutia presne tak, ako ho vydal validátor. Kódy XRechnung s malou príponou
 * (BR-DE-23-a) ostávajú malé: worker pri nich hľadá normatívne znenie (pravidla-texty.mjs povodneZnenie
 * rozlišuje veľkosť písmen) a e-mail má ukázať oficiálny kód. Čo regexu nesedí, do zhrnutia nejde. */
export function kodDoZhrnutia(kod) {
  const k = String(kod === undefined || kod === null ? '' : kod);
  return KOD.test(k) ? k : '';
}

/**
 * Načítanie modulu bloku s jednou kópiou sľubu (O1 po V2 D2): po zlyhaní importu (výpadok siete) sa sľub zabudne,
 * takže ďalšie zobrazenie skúsi import znova; inak by sa blok neukázal až do obnovenia stránky.
 *   importuj(): Promise s modulom (v app.js () => import(MODUL_BLOKU))
 */
export function nacitavacModulu(importuj) {
  let slub = null;
  return () => {
    if (!slub) {
      try { slub = Promise.resolve(importuj()); } catch (e) { slub = Promise.reject(e); }
      slub = slub.catch((e) => { slub = null; throw e; });
    }
    return slub;
  };
}

/**
 * Predčasné načítanie modulu bloku pri prvej práci so vstupom (K1-1 po O2). Kontrola e-faktúry beží synchrónne, takže
 * import spustený až v prijmiText nikdy nepríde pred vykreslením nálezov a blok ich pri prvom výsledku odsunie o svoju
 * výšku (meranie V2 po O2: 502 px pri 1280 px aj bez oneskorenia siete). Modul a s ním jeho CSS sa preto začnú
 * načítavať už pri ťuku, kliku, fokuse, klávese alebo vložení textu vo vstupe a pri pretiahnutí súboru nad stránku;
 * kým človek vyberie súbor alebo vloží XML, sú hotové. Nie pri vzore (tam sa blok neukáže).
 *   doc: document; ciel: selektor oblasti vstupu; vynechaj: selektor prvkov, pri ktorých sa nenačítava
 *   nacitaj(): spustí načítanie; zavolá sa najviac raz
 * Vracia funkciu, ktorá poslucháčov odpojí (zavolá sa aj sama po prvom načítaní).
 */
export const UDALOSTI_VSTUPU = Object.freeze(['pointerdown', 'focusin', 'keydown', 'input', 'paste', 'dragenter']);
export function nacitajPriVstupe({ doc, ciel, vynechaj = '', nacitaj }) {
  if (!doc || typeof doc.addEventListener !== 'function' || typeof nacitaj !== 'function' || !ciel) return () => {};
  let hotovo = false;
  const odpoj = () => { for (const u of UDALOSTI_VSTUPU) doc.removeEventListener(u, posluchac, true); };
  function posluchac(e) {
    if (hotovo) return;
    const t = e && e.target && typeof e.target.closest === 'function' ? e.target : null;
    // Pretiahnutie súboru nad stránku stačí (dropzone ho prevezme); inak len udalosť vo vstupe a mimo vzoru.
    if (!(e && e.type === 'dragenter')) {
      if (!t || !t.closest(ciel)) return;
      if (vynechaj && t.closest(vynechaj)) return;
    }
    hotovo = true;
    odpoj();
    try {
      const p = nacitaj();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (err) { /* blok nesmie zastaviť nástroj */ }
  }
  for (const u of UDALOSTI_VSTUPU) doc.addEventListener(u, posluchac, true);
  return odpoj;
}

/**
 * Zhrnutie výsledku pre POST /v1/vysledok (SPEC časť 3, efaktura). Nálezy sa zoskupia podľa kódu;
 * pri kóde s viacerými závažnosťami platí najvážnejšia. Poradie: chyby, varovania, informácie,
 * v rámci nich podľa prvého výskytu; najviac 60 pravidiel.
 */
export function zhrnutieVysledku(v) {
  // Iný typ (chybaXml, nic) nemá čo zhrnúť: radšej nič než vymyslený typ.
  if (!v || TYPY.indexOf(v.typ) === -1) return null;
  const s = v.sumar || {};
  const skupiny = new Map();
  let poradie = 0;
  for (const n of (Array.isArray(v.nalezy) ? v.nalezy : [])) {
    if (!n) continue;
    const kod = kodDoZhrnutia(n.kod);
    const z = ZAVAZNOSTI.indexOf(n.zavaznost);
    if (!kod || z === -1) continue;
    const g = skupiny.get(kod);
    if (g) {
      g.pocet += 1;
      if (z < g.z) g.z = z;
    } else {
      skupiny.set(kod, { kod, z, pocet: 1, i: poradie++ });
    }
  }
  const pravidla = [...skupiny.values()]
    .sort((a, b) => a.z - b.z || a.i - b.i)
    .slice(0, MAX_PRAVIDIEL)
    .map((g) => ({ kod: g.kod, zavaznost: ZAVAZNOSTI[g.z], pocet: Math.min(MAX_POCET, g.pocet) }));
  return {
    profil: PROFILY.indexOf(v.profil) !== -1 ? v.profil : 'neznamy',
    typ: v.typ,
    chyby: celeCislo(s.chyby, 0, MAX_POCET),
    varovania: celeCislo(s.varovania, 0, MAX_POCET),
    informacie: celeCislo(s.informacie, 0, MAX_POCET),
    pravidla,
  };
}

/** Obsahuje connect-src v texte CSP presne tento pôvod? Bez connect-src nie (zlyhanie zatvára). */
export function cspPovoluje(csp, povod = POVOD_WORKERA) {
  const smernice = String(csp || '').split(';').map((x) => x.trim());
  const connect = smernice.find((x) => /^connect-src(\s|$)/i.test(x));
  if (!connect) return false;
  return connect.split(/\s+/).slice(1).indexOf(povod) !== -1;
}

/** Text CSP z meta značky stránky (http-equiv bez ohľadu na veľkosť písmen), inak ''. */
export function cspStranky(doc) {
  if (!doc || typeof doc.querySelectorAll !== 'function') return '';
  for (const m of doc.querySelectorAll('meta[http-equiv]')) {
    if (String(m.getAttribute('http-equiv') || '').toLowerCase() === 'content-security-policy') return m.getAttribute('content') || '';
  }
  return '';
}

/**
 * Riadič bloku: drží poradie zobrazení, aby neskorý import alebo neskoré poOdoslani zo staršieho
 * výsledku neprepísali novší stav (AGENTS.md bod 12a). Každé ukaz a skry zvýši poradie; čo patrí
 * k staršiemu poradiu, sa zahodí.
 *   nacitaj(): Promise s modulom { ukaz(miesto, data), skry(miesto) }
 *   miesto: prázdny element, ktorý dodá app.js
 */
export function riadicBloku({ nacitaj, miesto }) {
  let poradie = 0;
  let modul = null;
  const aktualne = (moje) => moje === poradie;
  return {
    get poradie() { return poradie; },
    aktualne,
    ukaz(data) {
      const moje = ++poradie;
      const povodne = data && typeof data.poOdoslani === 'function' ? data.poOdoslani : null;
      const balik = Object.assign({}, data);
      if (povodne) balik.poOdoslani = (email) => { if (aktualne(moje)) povodne(email); };
      let p;
      try { p = Promise.resolve(nacitaj()); } catch (e) { p = Promise.reject(e); }
      return p.then((m) => {
        if (!aktualne(moje) || !m || typeof m.ukaz !== 'function') return false;
        modul = m;
        miesto.hidden = false;
        // Modul vráti false, keď zhrnutie odmietne (blok sa neukáže); vtedy ani tlačidlo v #akcie nemá kam viesť (P4).
        return m.ukaz(miesto, balik) !== false;
      }).catch(() => false);
    },
    skry() {
      poradie += 1;
      miesto.hidden = true;
      if (modul && typeof modul.skry === 'function') { try { modul.skry(miesto); } catch (e) { /* blok nesmie zastaviť kontrolu */ } }
    },
  };
}

/* ── Tlačidlo „Poslať e-mailom“ v #akcie (P4 brány 205, R57 a R75) ─────────────────────── */

/**
 * Formulár e-mailu stojí až za nálezmi (prvý nález je hneď pod akciami); do #akcie ide len vstup k nemu, tlačidlo
 * rovnakej rodiny ako Stiahnuť protokol a Skopírovať (btn btn-line, R67). app.js ho ukáže za rovnakých podmienok
 * ako blok (blokSmie a CSP pustí feed-monitor) a skryje pri skry. Vracia tlačidlo, na začiatku skryté.
 *   doc: document; akcie: element #akcie; text: popis tlačidla v jazyku stránky; idMiesta: id miesta bloku
 */
export const ID_TLACIDLA = 'ef-poslat-email';
export function pridajTlacidloEmailu(doc, akcie, text, idMiesta) {
  const tl = doc.createElement('button');
  tl.type = 'button';
  tl.className = 'btn btn-line';
  tl.id = ID_TLACIDLA;
  tl.textContent = text;
  tl.hidden = true;
  if (idMiesta) tl.setAttribute('aria-controls', idMiesta);
  akcie.appendChild(tl);
  return tl;
}

/**
 * Klik na „Poslať e-mailom“: posunie na blok a dá fokus do poľa e-mailu (input.vys-pole). Keď je blok už v stave
 * „Skontrolujte schránku“ (formulár skrytý), fokus dostane nadpis stavu. Pri zníženom pohybe bez animácie (R77);
 * fokus bez druhého posunu (preventScroll), aby nepreskočil plynulý posun. Vracia false, keď blok ešte nie je
 * vykreslený (modul sa načítava): app.js potom počká na zobrazenie.
 *   miesto: element bloku (#ef-vysledok-email); redukovanyPohyb: prefers-reduced-motion: reduce
 */
export function posunNaBlok(miesto, { redukovanyPohyb = false } = {}) {
  if (!miesto || miesto.hidden || typeof miesto.querySelector !== 'function') return false;
  const sekcia = miesto.querySelector('section.vys-email');
  if (!sekcia) return false;
  const skryte = (e) => { for (let x = e; x && x !== miesto; x = x.parentNode) { if (x.hidden) return true; } return false; };
  const pole = miesto.querySelector('input.vys-pole');
  const nadpis = miesto.querySelector('h3[tabindex="-1"]');
  const ciel = pole && !skryte(pole) ? pole : (nadpis && !skryte(nadpis) ? nadpis : null);
  try { sekcia.scrollIntoView({ behavior: redukovanyPohyb ? 'instant' : 'smooth', block: 'start' }); } catch (e) {
    try { sekcia.scrollIntoView(true); } catch (e2) { /* posun nesmie zastaviť fokus */ }
  }
  if (ciel && typeof ciel.focus === 'function') { try { ciel.focus({ preventScroll: true }); } catch (e) { /* nič */ } }
  return true;
}

/* ── Nadviazanie na odber FAQ (len SK stránka s #faq-odber, SPEC 7.2) ───────────────────── */

export const TEXTY_FAQ = {
  otazka: 'Chcete aj upozornenie, keď Finančná správa vydá novú verziu FAQ k e-faktúre? Pošleme e-mail len pri novej verzii, odhlásite sa jedným kliknutím.',
  tlacidlo: 'Upozorniť ma aj na FAQ',
  posiela: 'Posiela sa…',
  hotovo: 'Hotovo, potvrďte aj tento odber odkazom v e-maile.',
  chyba: 'Odber sa nepodarilo uložiť. Skúste to o chvíľu znova alebo napíšte na podpora@arling.sk.',
  // Samostatný súhlas potrebuje vlastnú informáciu a odkaz na zásady (O1 po V3 V6), ako starý rámik #faq-odber.
  poznamka: 'Príde vám e-mail s odkazom na potvrdenie. Adresu použijeme len na tieto upozornenia.',
  poznamkaOdkaz: 'Ochrana údajov',
  poznamkaHref: '/privacy/#s3',
};

/** Adresa skriptu odberu FAQ presne tak, ako ho načítava stránka (rovnaká adresa = ten istý modul,
 *  takže sa formulár odberu nezapojí druhýkrát). Bez skriptu na stránke ''. */
export function adresaOdberuFaq(doc) {
  if (!doc || typeof doc.querySelectorAll !== 'function') return '';
  for (const s of doc.querySelectorAll('script[src]')) {
    const src = s.getAttribute('src') || '';
    if (/^\/efaktura\/zmeny-faq\/odber\.js(\?v=[0-9a-f]+)?$/.test(src)) return src;
  }
  return '';
}

/**
 * Ponuka odberu FAQ pod stavom bloku po úspešnom odoslaní. Samostatné tlačidlo = samostatný súhlas;
 * nič nie je predvyplnené ani zaškrtnuté. Adresa sa nikde nezobrazí ani neuloží, len sa odovzdá posli.
 *   doc: document; ciel: element, do ktorého sa ponuka vykreslí (vyčistí sa)
 *   posli(): Promise<boolean> (odoslanie odberu FAQ na tú istú adresu)
 *   poUspechu(): zavolá sa po úspechu (skryje #faq-odber)
 *   zmenit: tlačidlo „Zmeniť adresu“ bloku (voliteľné). Ponuka je viazaná na odoslanú adresu, preto ju klik na
 *     „Zmeniť adresu“ zavrie (vyčistí a skryje) a už nič nepošle (O1 po V2 V2); potom zavolá poZatvoreni().
 * Vracia { tlacidlo, hotovo, chyba, poznamka, zatvor } kvôli testom.
 */
export function ukazPonukuFaq({ doc, ciel, posli, poUspechu, texty = TEXTY_FAQ, zmenit = null, poZatvoreni = null }) {
  while (ciel.firstChild) ciel.removeChild(ciel.firstChild);
  const p = (trieda, text) => { const e = doc.createElement('p'); if (trieda) e.className = trieda; e.textContent = text; return e; };
  const otazka = p('', texty.otazka);
  const tlacidlo = doc.createElement('button');
  tlacidlo.type = 'button';
  tlacidlo.className = 'btn btn-line';
  tlacidlo.textContent = texty.tlacidlo;
  // Drobné písmo pod tlačidlom: čo príde, na čo adresu použijeme, odkaz na zásady (ako starý rámik #faq-odber).
  const poznamka = p('ef-opak-small', texty.poznamka + ' ');
  const odkaz = doc.createElement('a');
  odkaz.setAttribute('href', texty.poznamkaHref);
  odkaz.textContent = texty.poznamkaOdkaz;
  poznamka.appendChild(odkaz);
  const hotovo = p('', texty.hotovo);
  hotovo.setAttribute('role', 'status');
  hotovo.tabIndex = -1;
  hotovo.hidden = true;
  const chyba = p('', texty.chyba);
  chyba.setAttribute('role', 'alert');
  chyba.hidden = true;
  ciel.appendChild(otazka);
  ciel.appendChild(tlacidlo);
  ciel.appendChild(poznamka);
  ciel.appendChild(hotovo);
  ciel.appendChild(chyba);
  ciel.hidden = false;
  let bezi = false;
  let hotove = false;
  let zatvorene = false;
  const zatvor = () => {
    if (zatvorene) return;
    zatvorene = true;
    while (ciel.firstChild) ciel.removeChild(ciel.firstChild);
    ciel.hidden = true;
    if (typeof poZatvoreni === 'function') { try { poZatvoreni(); } catch (e) { /* nic */ } }
  };
  if (zmenit && typeof zmenit.addEventListener === 'function') zmenit.addEventListener('click', zatvor, { once: true });
  tlacidlo.addEventListener('click', async () => {
    if (bezi || hotove || zatvorene) return;
    bezi = true;
    tlacidlo.disabled = true;
    tlacidlo.textContent = texty.posiela;
    chyba.hidden = true;
    let ok = false;
    try { ok = (await posli()) === true; } catch (e) { ok = false; }
    bezi = false;
    if (zatvorene) return;
    if (ok) {
      hotove = true;
      otazka.hidden = true;
      tlacidlo.hidden = true;
      hotovo.hidden = false;
      try { hotovo.focus(); } catch (e) { /* nic */ }
      try { poUspechu(); } catch (e) { /* nic */ }
    } else {
      tlacidlo.disabled = false;
      tlacidlo.textContent = texty.tlacidlo;
      chyba.hidden = false;
    }
  });
  return { tlacidlo, hotovo, chyba, poznamka, zatvor };
}
