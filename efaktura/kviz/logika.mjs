// logika.mjs: čistá logika kvízu „Týka sa ma e-faktúra?“ (bez DOM, bez textov pre človeka).
//
// Prečo samostatne: každá kombinácia odpovedí musí viesť na výsledok so zdrojom a to sa dá
// overiť len vtedy, keď logika beží aj v node (ops/rast/quiz-funnel/kviz.test.mjs).
// Texty sú v kviz/texty.mjs (SK) a en/quiz/texts.mjs (EN), UI v kviz/ui.mjs.
//
// Fakty: FAQ Finančného riaditeľstva SR 9/DPH/2025/IM, verzia z 15. 9. 2026
// (text v ops/efaktura/faq-straz/tests/fixtures/faq-2026-09-15.txt; test overí,
// že každý citát nižšie je v tomto texte na uvedenej strane), zákon č. 385/2025 Z. z.
// (novela zákona o DPH č. 222/2004 Z. z., § 85o a § 76a, účinnosť 1. 1. 2027).
// Kvíz nie je právne poradenstvo; neisté prípady majú istotu 'overit'.

export const VERZIA_FAKTOV = { faq: '2026-09-15', overene: '2026-09-26' };
export const MAX_OTAZOK = 6;

// Otázky a kódy odpovedí. Kódy idú do merania (Umami), preto sú krátke a bez osobných údajov.
export const OTAZKY = [
  { id: 'q1', cislo: 1, moznosti: ['platitel', 'par7', 'neplatitel', 'par5', 'neviem'] }, // stav DPH
  { id: 'q2', cislo: 2, moznosti: ['firmy', 'obom', 'ludia'] },                           // komu fakturujete
  { id: 'q3', cislo: 3, moznosti: ['sk', 'sk_de', 'sk_zahr', 'zahr'] },                   // kde sú odberatelia
  { id: 'q4', cislo: 4, moznosti: ['excel', 'appka', 'softver', 'neviem'] },              // čím fakturujete
  { id: 'q5', cislo: 5, moznosti: ['niekto', 'sam', 'neviem'] },                          // kto pošle cez poštára
  { id: 'q6', cislo: 6, moznosti: ['1_3', '4_20', 'nad_20'] },                            // faktúr za mesiac
];

// Vetvenie. 'R' = výsledok. Poradie q5 (kto) pred q6 (počet) je zámerné: kto to má vyriešené,
// na počet sa nemusí pýtať, cesta je o otázku kratšia (NAVRH mal počet ako Q5).
const PRECHODY = {
  q1: { platitel: 'q2', par7: 'R', neplatitel: 'R', par5: 'R', neviem: 'R' },
  q2: { firmy: 'q3', obom: 'q3', ludia: 'R' },
  q3: { sk: 'q4', sk_de: 'q4', sk_zahr: 'q4', zahr: 'R' },
  q4: { excel: 'q5', appka: 'q5', softver: 'R', neviem: 'q5' },
  q5: { niekto: 'R', sam: 'q6', neviem: 'q6' },
  q6: { '1_3': 'R', '4_20': 'R', nad_20: 'R' },
};

const ma = (obj, kluc) => obj != null && Object.prototype.hasOwnProperty.call(obj, kluc);

export function otazka(id) {
  return OTAZKY.find((o) => o.id === id) || null;
}

// Prejde odpovede od q1. Vráti cestu (navštívené otázky), odpovede len z tejto cesty
// (staré odpovede z inej vetvy zahodí), či je hotovo a ktorá otázka je na rade.
export function prejdi(odpovede) {
  const cesta = [];
  const ciste = {};
  let id = 'q1';
  while (id !== 'R') {
    cesta.push(id);
    const o = ma(odpovede, id) ? odpovede[id] : undefined;
    const dalsi = typeof o === 'string' && ma(PRECHODY[id], o) ? PRECHODY[id][o] : undefined;
    if (!dalsi) return { cesta, ciste, hotovo: false, aktualna: id };
    ciste[id] = o;
    id = dalsi;
  }
  return { cesta, ciste, hotovo: true, aktualna: null };
}

// ── Zdroje ───────────────────────────────────────────────────────────────────
// dok: faq | zakon385 | zakon222 | bmf | kosit | arling.
// Pri FAQ: cast (I alebo II), priklad, strana PDF a doslovný citát (test ho hľadá vo fixture
// na tej istej strane). Pri arling_*: doslovný citát je v textoch jazyka a test ho hľadá
// v products/arling-sk/efaktura/index.html (SK) alebo en/index.html (EN).
export const DOKUMENTY = {
  faq: 'https://www.financnasprava.sk/_img/pfsedit/Dokumenty_PFS/Zverejnovanie_dok/Aktualne/DPH/2026/2026.09.15_eFak_FaQ.pdf',
  zakon385: 'https://www.slov-lex.sk/ezbierky/pravne-predpisy/SK/ZZ/2025/385/',
  zakon222: 'https://www.slov-lex.sk/ezbierky/pravne-predpisy/SK/ZZ/2004/222/?ucinnost=01.01.2027#paragraf-85o.nadpis',
  bmf: 'https://www.bundesfinanzministerium.de/Content/DE/FAQ/e-rechnung.html',
  kosit: 'https://xeinkauf.de/xrechnung/',
};

export const ZDROJE = {
  faq_uvod: { dok: 'faq', cast: 'I', priklad: null, strana: 1,
    citat: 'S účinnosťou od 1. januára 2027 bude v novelizovanom zákone o DPH zavedená povinnosť pre platiteľov DPH vyhotoviť a prijímať faktúry z tuzemských dodaní tovarov a služieb v ustanovenom elektronickom formáte.' },
  faq_1: { dok: 'faq', cast: 'I', priklad: 1, strana: 1,
    citat: 'v štruktúrovanom elektronickom formáte XML podľa európskeho štandardu EN16931 v štandarde UBL alebo CII' },
  faq_3: { dok: 'faq', cast: 'I', priklad: 3, strana: 2,
    citat: 'PDF faktúra je len obrazový dokument, zatiaľ čo eFaktúra je štruktúrovaný XML súbor' },
  faq_4: { dok: 'faq', cast: 'I', priklad: 4, strana: 2,
    citat: 'Nie. V súčasnosti sa eFaktúra vzťahuje len na fakturáciu medzi podnikmi (B2B) a medzi podnikmi a verejnou správou (B2G).' },
  faq_6: { dok: 'faq', cast: 'I', priklad: 6, strana: 2,
    citat: 'Digitálneho poštára si vyberiete Vy z ponuky na trhu.' },
  faq_7: { dok: 'faq', cast: 'I', priklad: 7, strana: 2,
    citat: 'Elektronické faktúry musí vedieť prijímať každá právnická osoba a každá zdaniteľná osoba (podnikateľ) od 1.1.2027.' },
  faq_10: { dok: 'faq', cast: 'I', priklad: 10, strana: 3,
    citat: 'Predpokladáme, že predplatné takejto jednoduchej aplikácie Digitálneho poštára nebude stáť viac ako je priemer v EÚ vo výške od 5 eur - 12 eur mesačne.' },
  faq_14_maly: { dok: 'faq', cast: 'I', priklad: 14, strana: 4,
    citat: 'Vzhľadom na veľkosť a charakter podnikateľskej činnosti daňového subjektu, ktorý vystavuje, či prijíma iba pár desiatok faktúr, nie je potrebný drahý automatický systém.' },
  faq_14_softver: { dok: 'faq', cast: 'I', priklad: 14, strana: 4,
    citat: 'Spýtajte sa dodávateľa účtovného systému, či ich systém bude vedieť vystaviť elektronickú faktúru, ktorú následne Vy, alebo Váš účtovník iba nahrá a pošle cez aplikáciu Digitálneho poštára.' },
  faq_15: { dok: 'faq', cast: 'I', priklad: 15, strana: 4,
    citat: 'Prechodné obdobie pre zavedenie tuzemskej elektronickej fakturácie je od 1. januára 2026 do 31. decembra 2026.' },
  faq_16: { dok: 'faq', cast: 'I', priklad: 16, strana: 4,
    citat: 'Systém eFaktúra je v súčasnosti určený len na výmenu faktúr v rámci Slovenskej republiky.' },
  faq_17: { dok: 'faq', cast: 'I', priklad: 17, strana: 4,
    citat: 'Povinnosť fakturovať transakcie B2B a B2G na Slovensku bude platiť od 1.1.2027.' },
  faq_38: { dok: 'faq', cast: 'I', priklad: 38, strana: 10,
    citat: 'má tuzemský platiteľ dane (§ 4, 4b alebo 4c) povinnosť vyhotoviť elektronickú faktúru' },
  faq_51: { dok: 'faq', cast: 'I', priklad: 51, strana: 15,
    citat: 'platiteľ DPH nebude po 1.1.2027 povinný vyhotoviť elektronickú faktúru, ak je dodanie tovaru alebo služby oslobodené od dane podľa § 28 až 43 a 47 alebo ak platiteľ vyhotoví pri dodaní tovaru alebo služby zjednodušenú faktúru podľa § 74 ods. 3 písm. a) alebo písm. b) zákona o DPH (doklad do 100 eur alebo doklad z eKasy).' },
  faq_57: { dok: 'faq', cast: 'I', priklad: 57, strana: 17,
    citat: 'S účinnosťou od 1.1.2027 sa povinnosť vyhotoviť elektronickú faktúru v zmysle ustanovenia § 85o nevzťahuje na zdaniteľnú osobu, ktorá nie je platiteľom DPH.' },
  faq_62_spotrebitelia: { dok: 'faq', cast: 'I', priklad: 62, strana: 19,
    citat: 'Koho sa povinnosť týkať vôbec nebude: Koncoví spotrebitelia' },
  faq_62_2030: { dok: 'faq', cast: 'I', priklad: 62, strana: 19,
    citat: 'Od 1. júla 2030 sa očakáva rozšírenie povinnosti aj na cezhraničné dodania tovarov a služieb (EÚ aj tretie krajiny).' },
  faq_63: { dok: 'faq', cast: 'I', priklad: 63, strana: 19,
    citat: 'Áno, do systému elektronickej fakturácie sa môžu dobrovoľne zapojiť aj subjekty, ktoré nemajú zákonnú povinnosť (napr. neplatitelia DPH).' },
  faq_66: { dok: 'faq', cast: 'I', priklad: 66, strana: 21,
    citat: 'ak platiteľ vyhotoví zjednodušenú faktúru pokladnicou eKasa (do 400 eur), nie je povinný vyhotoviť elektronickú faktúru.' },
  faq_83: { dok: 'faq', cast: 'I', priklad: 83, strana: 32,
    citat: 'platiteľ nesmie vyhotoviť elektronickú faktúru podľa odseku 4 ustanovenia § 85o zákona o DPH, ak je príjemcom plnenia Slovenská informačná služba, Vojenské spravodajstvo alebo ak je plnenie spojené s utajovanou skutočnosťou' },
  faq_ii15_zakon: { dok: 'faq', cast: 'II', priklad: 15, strana: 38,
    citat: 'Novelou zákona o DPH vyhlásenej v Zbierke zákonov pod číslom 385/2025 Z. z. sa s účinnosťou od 1.1.2027 zavádza povinnosť vyhotovovať pri tuzemských zdaniteľných obchodoch medzi tuzemskými osobami elektronickú faktúru' },
  faq_ii29_tuzemske: { dok: 'faq', cast: 'II', priklad: 29, strana: 45,
    citat: 'Toto prechodné ustanovenie sa týka len tuzemských osôb a tuzemských transakcií (Slovensko → Slovensko).' },
  faq_ii29_par5: { dok: 'faq', cast: 'II', priklad: 29, strana: 45,
    citat: 'Osoba registrovaná podľa § 5 zákona č. 222/2004 Z.z. nie je povinná v zmysle tohto prechodného ustanovenia vystaviť elektronickú faktúru, ani nie je povinná zabezpečiť prijímanie elektronických faktúr doručovacou službou v období od 1.1.2027 do 30.6.2030.' },
  zakon_385: { dok: 'zakon385' },
  zakon_85o: { dok: 'zakon222' },
  // Nemecko: overené 11. 9. 2026 na bundesfinanzministerium.de a xeinkauf.de, zápis ops/efaktura/fakty.md 2.1 a 2.3.
  bmf_prijem: { dok: 'bmf' },
  kosit_xrechnung: { dok: 'kosit' },
  // Naše stránky (ceny overené v ops/stripe/cennik.md riadok 9).
  arling_kontrola: { dok: 'arling', kotva: '#kontrola' },
  arling_cena_jedna: { dok: 'arling', kotva: '#cennik' },
  arling_cena_30: { dok: 'arling', kotva: '#cennik' },
  arling_cennik: { dok: 'arling', kotva: '#cennik' },
  arling_bez_peppol: { dok: 'arling', kotva: '#pre-koho' },
  arling_nahlad: { dok: 'arling', kotva: '#nahlad' },
  arling_xrechnung: { dok: 'arling', kotva: '#pre-koho' },
};

// ── Výzvy ────────────────────────────────────────────────────────────────────
// Kam výsledok vedie. cena je najnižšia cena v eurách bez DPH ako reťazec kvôli meraniu
// ('0' = zadarmo). 'znova' nie je odkaz, ale tlačidlo, ktoré spustí kvíz od začiatku.
// Žiadny vlastný checkout: platené výzvy vedú na existujúci formulár (NAVRH časť 1).
export const CIELE = ['kontrola', 'nahlad', 'vytvorit_jedna', 'vytvorit_30', 'vytvorit_xrechnung', 'info', 'znova'];
export const CENA_CIELA = { kontrola: '0', nahlad: '0', vytvorit_jedna: '2.90', vytvorit_30: '9.90', vytvorit_xrechnung: '2.90', info: '0', znova: '0' };

// ── Výsledky ─────────────────────────────────────────────────────────────────
// odseky: pre každý odsek textu (v tom istom poradí ako v texty.mjs a texts.mjs) zoznam zdrojov.
// Prázdny zoznam = rada, nie tvrdenie o povinnosti (napríklad „overte u poradcu“).
// uvod: pred odsekmi výsledku sa zobrazí spoločný úvod TYKA_SA_UVOD.
// istota: 'iste' = FAQ to hovorí priamo; 'overit' = odporúčame overiť u daňového poradcu.
export const TYKA_SA_UVOD = [
  ['faq_uvod', 'faq_17', 'faq_38', 'faq_1', 'faq_3', 'faq_ii15_zakon', 'zakon_385'],
  ['faq_7', 'faq_15'],
];

export const SEGMENTY = {
  nie_platitel: { istota: 'iste', uvod: false, odseky: [['faq_57'], ['faq_7', 'faq_63'], ['arling_nahlad']], ciele: ['nahlad', 'info'] },
  registracia_7a: { istota: 'overit', uvod: false, odseky: [['faq_38', 'zakon_85o'], ['faq_7']], ciele: ['nahlad', 'info'] },
  registracia_5: { istota: 'iste', uvod: false, odseky: [['faq_ii29_par5', 'zakon_85o'], []], ciele: ['nahlad', 'info'] },
  neviem_status: { istota: 'overit', uvod: false, odseky: [['faq_uvod', 'faq_57'], ['faq_7'], []], ciele: ['znova', 'info'] },
  len_spotrebitelia: { istota: 'iste', uvod: false, odseky: [['faq_4', 'faq_62_spotrebitelia'], ['faq_17'], ['faq_7', 'arling_nahlad']], ciele: ['nahlad', 'info'] },
  len_zahranicie: { istota: 'overit', uvod: false, odseky: [['faq_ii29_tuzemske', 'faq_16', 'faq_62_2030'], ['faq_7'], ['arling_xrechnung']], ciele: ['kontrola', 'nahlad'] },
  tyka_sa_riesenie: { istota: 'iste', uvod: true, odseky: [['faq_14_softver'], ['arling_kontrola']], ciele: ['kontrola', 'info'] },
  tyka_sa_malo: { istota: 'iste', uvod: true, odseky: [['arling_cena_jedna']], ciele: ['vytvorit_jedna', 'kontrola'] },
  tyka_sa_stredne: { istota: 'iste', uvod: true, odseky: [['arling_cena_30', 'arling_cennik']], ciele: ['vytvorit_30', 'kontrola'] },
  tyka_sa_vela: { istota: 'iste', uvod: true, odseky: [['arling_cena_30', 'arling_cennik'], ['faq_14_maly']], ciele: ['vytvorit_30', 'kontrola'] },
};

// Poznámky pripojené k výsledku podľa odpovedí (každá je jeden odsek).
export const POZNAMKY = {
  vynimky: { zdroje: ['faq_51', 'faq_66', 'faq_83'] },
  postar: { zdroje: ['faq_6', 'arling_bez_peppol', 'faq_10', 'faq_14_softver'] },
  aj_spotrebitelia: { zdroje: ['faq_4', 'faq_62_spotrebitelia'] },
  zahranicie: { zdroje: ['faq_ii29_tuzemske', 'faq_62_2030'] },
  nemecko: { zdroje: ['bmf_prijem', 'kosit_xrechnung', 'arling_xrechnung'] },
  spytajte_softver: { zdroje: ['faq_14_softver'] },
};

const PODLA_POCTU = { '1_3': 'tyka_sa_malo', '4_20': 'tyka_sa_stredne', nad_20: 'tyka_sa_vela' };
const JEDNODUCHE = { par7: 'registracia_7a', neplatitel: 'nie_platitel', par5: 'registracia_5', neviem: 'neviem_status' };

// Hlavná funkcia: z odpovedí urobí výsledok. Pri nedokončenom kvíze vráti null.
// bloky: poradie odsekov na zobrazenie; UI k nim nájde text podľa typu a id.
export function vyhodnot(odpovede) {
  const { ciste: q, hotovo } = prejdi(odpovede);
  if (!hotovo) return null;

  let segment;
  if (q.q1 !== 'platitel') segment = JEDNODUCHE[q.q1];
  else if (q.q2 === 'ludia') segment = 'len_spotrebitelia';
  else if (q.q3 === 'zahr') segment = 'len_zahranicie';
  else if (q.q4 === 'softver' || q.q5 === 'niekto') segment = 'tyka_sa_riesenie';
  else segment = PODLA_POCTU[q.q6];

  const poznamky = [];
  const tykaSa = segment.startsWith('tyka_sa_');
  if (tykaSa) poznamky.push('vynimky');
  if (q.q2 === 'obom') poznamky.push('aj_spotrebitelia');
  if (tykaSa && (q.q3 === 'sk_de' || q.q3 === 'sk_zahr')) poznamky.push('zahranicie');
  if (tykaSa && q.q3 === 'sk_de') poznamky.push('nemecko');
  if (tykaSa && q.q4 === 'neviem') poznamky.push('spytajte_softver');
  if (segment === 'tyka_sa_malo' || segment === 'tyka_sa_stredne' || segment === 'tyka_sa_vela') poznamky.push('postar');

  const def = SEGMENTY[segment];
  const bloky = [];
  if (def.uvod) TYKA_SA_UVOD.forEach((zdroje, index) => bloky.push({ typ: 'uvod', id: 'uvod', index, zdroje }));
  def.odseky.forEach((zdroje, index) => bloky.push({ typ: 'segment', id: segment, index, zdroje }));
  for (const p of poznamky) bloky.push({ typ: 'poznamka', id: p, index: 0, zdroje: POZNAMKY[p].zdroje });

  const zdroje = [];
  for (const b of bloky) for (const id of b.zdroje) if (!zdroje.includes(id)) zdroje.push(id);

  let ciele = def.ciele.slice();
  // Kto fakturuje aj do Nemecka a vytvára si faktúry sám, dostane ako druhú výzvu XRechnung.
  if (q.q3 === 'sk_de' && ciele[0].startsWith('vytvorit')) ciele = [ciele[0], 'vytvorit_xrechnung', ...ciele.slice(1)];

  return {
    segment,
    istota: def.istota,
    poznamky,
    bloky,
    zdroje,
    ciele: ciele.map((ciel, i) => ({ ciel, cena: CENA_CIELA[ciel], poradie: i === 0 ? 'hlavna' : 'vedlajsia' })),
    odpovede: q,
  };
}

// Cenový prah, ktorý stojí za rozdelením 1 až 3 / 4 a viac (ceny bez DPH, v centoch).
export const CENA_JEDNA_CENTY = 290;
export const CENA_30_DNI_CENTY = 990;
export function vyhodnejsie30Dni(pocetZaMesiac) {
  return pocetZaMesiac * CENA_JEDNA_CENTY > CENA_30_DNI_CENTY;
}

// ── Meranie ──────────────────────────────────────────────────────────────────
// Názvy a vlastnosti udalostí sú opísané v ops/rast/quiz-funnel/MERANIE.md.
export const UDALOSTI = {
  start: 'quiz_start',
  spat: 'quiz_back',
  vysledok: 'quiz_result_view',
  vyzva: 'quiz_offer_click',
  znova: 'quiz_restart',
  odchod: 'quiz_abandon',
  preskocenie: 'quiz_skip_click',
  zdroj: 'quiz_source_click',
};
export function udalostOtazky(cislo, typ) {
  if (!Number.isInteger(cislo) || cislo < 1 || cislo > MAX_OTAZOK) throw new Error('zlé číslo otázky');
  if (typ !== 'view' && typ !== 'answer') throw new Error('zlý typ udalosti');
  return `quiz_q${cislo}_${typ}`;
}

// Odkiaľ prišiel návštevník (?z=...), len bezpečné krátke kódy, inak 'priamo'.
export function cistyZdroj(z) {
  return typeof z === 'string' && /^[a-z0-9_-]{1,32}$/.test(z) ? z : 'priamo';
}

// ── Varianty textu jednej otázky (A/B) ────────────────────────────────────────
// Zapnutá je len kontrolná varianta A. Dôvod: pri ~82 návštevách týždenne na e-faktúru
// by test trval mesiace (VYSKUM.md časť 5, NAVRH.md časť 4). Najprv meriame odchody.
// Kým je experiment vypnutý, UI nevytvorí ani neuloží žiadne ID (nič v localStorage).
// Pred zapnutím: ops/rast/quiz-funnel/MERANIE.md, časť Varianty (ID v localStorage a súhlas).
export const EXPERIMENT = {
  id: 'q1_znenie_2026_09',
  otazka: 'q1',
  zapnuty: false,
  // true: ID sa uloží do localStorage (rovnaká varianta aj pri návrate). false: ID len pre jedno
  // načítanie stránky, nič sa neukladá. Pred zapnutím s true overiť súhlas (MERANIE.md, Varianty).
  ulozitId: true,
  varianty: [{ kod: 'A', podiel: 50 }, { kod: 'B', podiel: 50 }],
};
export const KONTROLNA = 'A';

// FNV-1a 32 bit: deterministický, rýchly, rovnaký v node aj prehliadači.
export function hash32(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function priradVariantu(id, experiment = EXPERIMENT) {
  if (!experiment || !experiment.zapnuty || typeof id !== 'string' || id === '') return KONTROLNA;
  const sucet = experiment.varianty.reduce((s, v) => s + v.podiel, 0);
  if (sucet <= 0) return KONTROLNA;
  const kos = hash32(experiment.id + ':' + id) % sucet;
  let hranica = 0;
  for (const v of experiment.varianty) {
    hranica += v.podiel;
    if (kos < hranica) return v.kod;
  }
  return KONTROLNA;
}

// Náhodné ID prehliadača: 16 hex znakov z 8 náhodných bajtov. nahodneBajty(n) dodá volajúci
// (v prehliadači crypto.getRandomValues), aby sa to dalo testovať.
export function noveId(nahodneBajty) {
  const b = nahodneBajty(8);
  return Array.from(b, (x) => (x & 255).toString(16).padStart(2, '0')).join('');
}
export function platneId(id) {
  return typeof id === 'string' && /^[0-9a-f]{16}$/.test(id);
}

// Ručný náhľad varianty pre kontrolu vzhľadu (?varianta=B). Do merania ide ako 'B-nahlad'.
export function vynutenaVarianta(parameter, experiment = EXPERIMENT) {
  return experiment.varianty.some((v) => v.kod === parameter) ? parameter : null;
}
