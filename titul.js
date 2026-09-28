/* Jednorazovy predaj jedneho titulu na hube (Morning Quiet, Ben-Hur,
 * The Count of Monte Cristo, cislo Puzzle Post, balik e-ink hlavolamov).
 *
 * Rovnaky vzor ako products/arling-sk/puzzle-books/app.js, len pre jeden titul
 * na stranku a bez mapy hier:
 *   1. tlacidlo [data-titul] vedie na Stripe Payment Link (data-link, v testovom
 *      rezime data-link-test),
 *   2. Stripe vrati cloveka na stranku titulu s ?titul=<id>&session_id=cs_...,
 *   3. stranka sa spyta workera GET /v1/kontrola/status, ci je session
 *      zaplatena a na aku sumu (vracia paid, amount_subtotal, livemode; ziadne
 *      osobne udaje),
 *   4. po kladnej odpovedi sa odomknutie ulozi do localStorage a na mieste
 *      tlacidla sa vykresli panel so subormi (vykresliPanel nizsie).
 *
 * Odkial su subory (od 24. 9. 2026 len jeden zdroj):
 *   licencna sluzba na homelabe,
 *   GET /licence/api/purchase/links?session_id=cs_... -> { ok:true,
 *   product, title, files:[{label, url, bytes}], email, week }. Kazdy url je
 *   podpisany odkaz na /licence/api/download s platnostou 7 dni; subor posle
 *   sluzba zo svojho disku az po overenej platbe. Pri kazdom otvoreni stranky sa
 *   pyta znova, takze odkazy su vzdy cerstve.
 *   Ked sluzba neodpovie (vypadok, 503 "downloads-off", siet), panel povie
 *   pokojne, ze odkazy sa nenacitali, da tlacidlo "Try again", cislo platby
 *   (session id) a adresu support@arling.sk. Ziadny nahradny odkaz neexistuje.
 *
 * Preco uz nie blok titul-data: do 24. 9. 2026 lezali platene subory verejne na
 * GitHub Pages v priecinku files/<16 znakov> a presna cesta stala v bloku
 * <script type="application/json" id="titul-data"> (pole "cesta"). Kto si
 * otvoril zdroj stranky, stiahol si tovar bez platby. Blok dnes nesie len
 * identitu titulu a nazvy suborov, nie cestu; stranka z neho odkaz nevyraba.
 *
 * Preco panel a nie odrazky: 17. 9. 2026 Andrej zaplatil trikrat v test mode a
 * stranka po platbe vyzerala takmer rovnako ako pred nou. Riadok "Paid, thank
 * you" mal velkost drobneho textu, odkazy na subory boli odrazky a po tlacidle
 * ostala diera. Odvtedy je po platbe na mieste tlacidla panel s nadpisom, s
 * jednym velkym tlacidlom na kazdy subor a s drobnostami (ukazka, e-mail,
 * cislo objednavky) pod nimi. Vzhlad panela je v products/arling-sk/style/hub.css,
 * cast 9; tu vznika len jeho obsah.
 *
 * Tento subor sam od seba nic nerobi: stranka si zavola nastav(). Vdaka tomu sa
 * ciste funkcie daju testovat v Node (products/arling-sk/titul.test.mjs).
 */

export const API = 'https://arling-asistent.arling.workers.dev';
/* Licencna sluzba na homelabe. Ta ista adresa ako /style/ucet.js pre workera a
   subscribe.js pre homelab; v CSP stranok uz stoji v connect-src. */
export const LICENCIE = 'https://api.arling.workers.dev/licence/api';
export const KLUC_ODOMKNUTE = 'titul:zaplatene';
export const KLUC_CAKAJUCA = 'titul:cakajuca';
export const KLUC_TEST = 'titul:test';

export const T = {
  overujem: 'Checking the payment',
  inaSuma: 'The payment went through, but not for an amount we recognise. Write to support@arling.sk and we will sort it out by hand.',
  nepotvrdene: 'We have not been able to confirm the payment yet. We keep trying; if you paid, the files unlock as soon as Stripe answers. If it takes longer than a few minutes, write to support@arling.sk with the order number from the Stripe e-mail.',
  overZnova: 'Check again',
  zapina: 'Buying this title here is still being switched on. It is on sale on Etsy today, or write to support@arling.sk and we will send you the files.',
  testChyba: 'Test mode is on, but this title has no test link yet. Run ops/stripe/tituly.mjs --test --zapis, or open this page without ?test=1 to buy it for real.',
  testCudzi: 'This is a payment from Stripe test mode. It unlocks files only in the browser that started the test with ?test=1.',
  /* Text odznaku testu. V HTML je od 25. 9. 2026 len prazdny skryty prvok
     #test-odznak: skryta veta o test mode a karte 4242 citali nastroje AI ako
     fakt o stranke (audit ops/audit/2026-09-25-celkovy/00-AUDIT.md, akcia 5).
     Vlozi ju az naplnOdznak() v testovom rezime. */
  odznak: 'The buy button leads to Stripe test mode. Use the card 4242 4242 4242 4242, any future date and any CVC. No money is taken; the files below are the real ones.',
};

/** Naplni prazdny odznak testu: nadpis "Test mode" a veta. Len raz, bez innerHTML. */
export function naplnOdznak(el, veta) {
  const d = el && el.ownerDocument;
  if (!d || el.firstChild) return;
  const b = d.createElement('b');
  b.textContent = 'Test mode';
  el.append(b, veta);
}

/* Texty panela po zaplateni. Jazyk trhu je anglictina, rovnako ako stranky. */
export const PANEL = {
  znacka: 'Paid, thank you',
  nadpis: 'Your files',
  stiahnut: 'Download ',
  ukazka: 'Free sample',
  /* Veta o e-maile sa smie povedať len vtedy, keď licenčná služba potvrdí, že
   * e-mail naozaj odišiel (pole emailed v odpovedi /api/purchase/links). Kým
   * také pole nepríde, platí mailNeisty: nič sa netvrdí, len sa povie, čo robiť.
   * Nález N4 a N8 auditu z 21. 9. 2026: stránka hovorila „were also sent to“
   * aj vtedy, keď odkazy prišli zo samotnej stránky a žiadny e-mail neodišiel. */
  mailPred: 'These links stay in this browser and were also sent to ',
  mailBez: 'the e-mail address you paid with',
  mailPo: '.',
  mailNeisty: 'Download the files now: these buttons stay in this browser only, and each link works for 7 days. We cannot confirm here whether the e-mail with the links has gone out, so if nothing arrives within a few minutes, write to support@arling.sk with the order number below and we will send the files by hand.',
  objednavka: 'Order ',
  test: 'Test mode: the payment was made in Stripe test mode, no money is taken; the files below are the real ones.',
  /* Licencna sluzba neodpovedala. Nic sa neslubuje okrem toho, co vieme splnit:
     skusit znova a napisat nam. Ziadny nahradny odkaz, ten by viedol na verejny subor. */
  cakame: 'Your payment is confirmed, but the download links did not load just now. Wait a minute and press Try again.',
  cakamePomoc: 'If they still do not appear, write to support@arling.sk with the payment reference below and we will send you the files.',
  cakamePomocBez: 'If they still do not appear, write to support@arling.sk from the e-mail address you paid with and we will send you the files.',
  znova: 'Try again',
  referencia: 'Payment reference ',
};

/* ── Ciste funkcie (testovane v Node) ──────────────────────────────────── */

/** Suma pred zlavovym kodom; starsi worker ju neposiela, vtedy plati amount_total. */
export function zakladnaSuma(st) {
  if (!st || typeof st !== 'object') return null;
  if (typeof st.amount_subtotal === 'number') return st.amount_subtotal;
  if (typeof st.amount_total === 'number') return st.amount_total;
  return null;
}

/** Rozhodnutie o jednej odpovedi workera. Vracia stav, nie text. */
export function posudPlatbu(st, cena) {
  if (!st || typeof st !== 'object') return { stav: 'caka' };
  if (!st.paid) return { stav: 'caka' };
  const suma = zakladnaSuma(st);
  if (typeof suma !== 'number') return { stav: 'inaSuma', test: st.livemode === false };
  if (suma < cena) return { stav: 'inaSuma', test: st.livemode === false };
  return { stav: 'zaplatene', test: st.livemode === false };
}

/** Zaznam o odomknuti z localStorage do rovnakeho tvaru, nech tam stalo cokolvek. */
export function stavZoZaznamu(raw) {
  let s = raw;
  if (typeof s === 'string') { try { s = JSON.parse(s); } catch (e) { s = null; } }
  if (!s || typeof s !== 'object') return { tituly: {}, sessions: {}, test: false };
  const tituly = (s.tituly && typeof s.tituly === 'object') ? s.tituly : {};
  const sessions = (s.sessions && typeof s.sessions === 'object') ? s.sessions : {};
  const von = {}, relacie = {};
  for (const k of Object.keys(tituly)) if (tituly[k]) von[k] = true;
  // Session sa uklada az od 18. 9. 2026; starsi zaznam ju nema a panel potom
  // ostane bez cisla objednavky, nic sa tym nerozbije.
  for (const k of Object.keys(sessions)) if (von[k] && typeof sessions[k] === 'string' && sessions[k]) relacie[k] = sessions[k];
  return { tituly: von, sessions: relacie, test: !!s.test };
}

/** Na Stripe sa ide len cez odkaz Stripe. Prazdna alebo cudzia hodnota nikam nevedie. */
export function platnyOdkaz(url) {
  const u = String(url || '');
  return /^https:\/\/buy\.stripe\.com\//.test(u) ? u : '';
}

/** Kam vedie tlacidlo kupy (data-link, data-link-test). V teste len test_ odkaz, nikdy zivy. */
export function odkazTlacidla(dataset, test) {
  const d = dataset || {};
  const u = platnyOdkaz(test ? d.linkTest : d.link);
  if (test && !/^https:\/\/buy\.stripe\.com\/test_/.test(u)) return '';
  return u;
}

/* Reklama (26. 9. 2026, rovnaky vzor ako sepa-pain001-doctor): UTM z prichodu sa ulozia do
 * sessionStorage a pri kupe idu do odkazu Stripe ako utm_* a client_reference_id
 * (gads_<kampan>_<obsah>), aby sa platba dala priradit kampani. Licencna sluzba pri tituloch
 * cita z client_reference_id len predponu ig_<postava>_ (e-mail postavy, tituly.py), gads_ nie.
 * Aktualne UTM z adresy maju prednost pred ulozenymi (STAV-57).
 * Len pismena, cislice, _ a -; bez UTM sa odkaz nemeni. */
const UTM_KLUC = 'arling_utm';
const UTM_POLIA = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

export function utmZAdresy(adresa) {
  const u = {};
  try {
    const q = new URL(adresa).searchParams;
    for (const k of UTM_POLIA) { const v = q.get(k); if (v) u[k] = v.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80); }
  } catch (e) { /* zla adresa: bez UTM */ }
  return u;
}

/* Obchody postav (STAV-57, posudok ops/ai/kontrola/2026-09-28-stranky-postav-jednoduche.md, nalez P2):
 * odkaz z detailu na arling.sk/walt|june|olive/ vedie sem s ?postava=<postava>. Kupa potom dostane
 * client_reference_id ig_<postava>_<titul>, podla ktoreho licencna sluzba (tituly.py) vyberie e-mail
 * postavy. Instagram bez postavy nedostane gads_ (to je len Google Ads). */
const POSTAVA_KLUC = 'arling_postava';
export const POSTAVY = ['walt', 'june', 'olive'];

export function postavaZAdresy(adresa) {
  try { const p = new URL(adresa).searchParams.get('postava') || ''; return POSTAVY.includes(p) ? p : ''; } catch (e) { return ''; }
}

export function sOdkazomReklamy(odkaz, u, { postava = '', titul = '' } = {}) {
  const utm = u && typeof u === 'object' ? u : {};
  const ig = POSTAVY.includes(postava) && /^[a-z0-9-]+$/.test(titul);
  if (!odkaz || (!utm.utm_campaign && !ig)) return odkaz;
  try {
    const url = new URL(odkaz);
    for (const k of UTM_POLIA) if (utm[k]) url.searchParams.set(k, utm[k]);
    let ref = '';
    if (ig) ref = 'ig_' + postava + '_' + titul;
    else if (!/^(ig|instagram)$/i.test(utm.utm_source || '')) ref = 'gads_' + utm.utm_campaign + (utm.utm_content ? '_' + utm.utm_content : '');
    if (ref) url.searchParams.set('client_reference_id', ref.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 150));
    return url.toString();
  } catch (e) { return odkaz; }
}

function zapamatajUtm() {
  try {
    const u = utmZAdresy(location.href);
    if (Object.keys(u).length) {
      // Keď zápis novej kampane zlyhá, stará kampaň sa zmaže, aby ďalšia stránka nepripísala nákup starej
      // (brána 28. 9., ops/ai/kontrola/2026-09-28-stranky-postav-bez-pamate.md).
      try { sessionStorage.setItem(UTM_KLUC, JSON.stringify(u)); }
      catch (e) { try { sessionStorage.removeItem(UTM_KLUC); } catch (e2) { /* uloziste nefunguje, nic sa neobnovi */ } }
    }
    // Postava sa od 28. 9. neukladá (brána pokus 3: pri zlyhaní zápisu ostávala stará postava a kradla atribúciu);
    // nesie ju len adresa (?postava= z odkazov stránky postavy). Starý záznam sa pri prvej príležitosti zmaže.
    sessionStorage.removeItem(POSTAVA_KLUC);
  } catch (e) { /* bez uloziska sa kampan nepriradi, platba ide normalne */ }
}

function ulozeneUtm() {
  try { return JSON.parse(sessionStorage.getItem(UTM_KLUC) || 'null'); } catch (e) { return null; }
}

/** Prichod tejto navstevy: UTM a postava z aktualnej adresy, uloziste len ked v adrese nie su. */
export function prichod(adresa, ulozene = {}) {
  const u = utmZAdresy(adresa);
  // Postava len z adresy, nikdy z úložiska (brány 28. 9., ops/ai/kontrola/2026-09-28-stranky-postav-pokus2.md
  // a -pokus3.md): uložená postava vedela prepísať neskoršiu kampaň, aj keď zlyhal zápis do úložiska.
  const postava = postavaZAdresy(adresa);
  return { utm: Object.keys(u).length ? u : (ulozene.utm && typeof ulozene.utm === 'object' ? ulozene.utm : {}), postava };
}

function ulozenyPrichod() {
  return { utm: ulozeneUtm(), postava: '' };
}

/** Titul z navratovej adresy sa prijme len vtedy, ked patri tejto stranke. */
export function titulZDotazu(hodnota, mojTitul) {
  const t = String(hodnota || '');
  return t && t === mojTitul ? t : '';
}

/** Cislo objednavky pre cloveka: poslednych osem znakov session id. */
export function cisloObjednavky(sid) {
  const s = String(sid || '');
  return s.length > 8 ? s.slice(-8) : s;
}

/** Velkost suboru pre tlacidlo. Bez pouzitelneho cisla radsej nic. */
export function velkostSuboru(bytes) {
  const b = Number(bytes);
  if (!Number.isFinite(b) || b <= 0) return '';
  if (b < 1024 * 1024) return Math.round(b / 1024) + ' KB';
  return (b / (1024 * 1024)).toFixed(2) + ' MB';
}

/**
 * Adresa suboru z cudzej odpovede. Odkaz smie viest len k nam alebo byt
 * relativny; cudzia schema (javascript:, data:) a cudzia domena su nic.
 */
export function platnaAdresaSuboru(url) {
  const u = String(url || '').trim();
  if (!u) return '';
  // files.arling.workers.dev: od 27. 9. 2026 dáva licenčná služba odkazy na sťahovanie cez tento Worker
  // (ops/workers/files, DOWNLOAD_BASE). Bez neho panel po platbe hlásil „odkazy sa nenačítali“ (paper v3 pokus 4,
  // integračný testovací nákup detektívnej sady).
  if (/^https:\/\/(api\.arling\.workers\.dev|files\.arling\.workers\.dev|arling\.sk)\//.test(u)) return u;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(u)) return '';
  if (u.startsWith('//')) return '';
  return u;
}

/**
 * Subory z odpovede licencnej sluzby. Prazdne pole znamena "odpoved sa neda
 * pouzit" a panel vtedy povie, ze odkazy sa nenacitali (ziadny nahradny zdroj).
 * Produkt sa nekontroluje zamerne: odkazy viaze session id, nie meno produktu,
 * a mena sa medzi sluzbou a strankou casom rozidu.
 */
export function suboryZoSluzby(odpoved) {
  if (!odpoved || typeof odpoved !== 'object' || odpoved.ok !== true) return [];
  const zoznam = Array.isArray(odpoved.files) ? odpoved.files : [];
  const von = [];
  for (const f of zoznam) {
    if (!f || typeof f !== 'object') continue;
    const href = platnaAdresaSuboru(f.url);
    if (!href) continue;
    von.push({ nazov: String(f.label || '').trim(), href, velkost: velkostSuboru(f.bytes), popis: '' });
  }
  return von;
}

/* ── Odkazy len zo sluzby ──────────────────────────────────────────────── */

/**
 * Odkazy z licencnej sluzby, alebo null. Nikdy nevyhodi vynimku: ked sluzba
 * nebezi, nie je nasadena alebo odpovie ok:false, volajuci ukaze vetu o
 * cakani s tlacidlom Try again. fetch sa da podstrcit (volby.fetch), aby sa to
 * dalo testovat.
 */
export async function odkazyZoSluzby(sid, volby = {}) {
  // Podstrceny fetch plati aj ked je null: test tym overi stav "prehliadac
  // fetch nema" bez toho, aby sa cokolvek pytalo siete.
  const vlastny = Object.prototype.hasOwnProperty.call(volby, 'fetch');
  const posli = vlastny ? volby.fetch : (typeof fetch === 'function' ? fetch : null);
  if (!posli || !sid) return null;
  let odpoved = null;
  try {
    const r = await posli(LICENCIE + '/purchase/links?session_id=' + encodeURIComponent(sid));
    if (!r || !r.ok) return null;
    odpoved = await r.json();
  } catch (e) { return null; }
  const subory = suboryZoSluzby(odpoved);
  if (!subory.length) return null;
  return {
    subory,
    email: typeof odpoved.email === 'string' ? odpoved.email : '',
    // Len jasne potvrdene odoslanie. Chybajuce pole znamena "nevieme", nie "ano".
    emailed: odpoved.emailed === true,
    tyzden: typeof odpoved.week === 'string' ? odpoved.week : '',
    nazov: typeof odpoved.title === 'string' ? odpoved.title : '',
    produkt: typeof odpoved.product === 'string' ? odpoved.product : '',
  };
}

/**
 * Subory len zo sluzby. Vracia vzdy ten isty tvar; zdroj "caka" znamena, ze
 * sluzba neodpovedala a odkazy nie su (ziadne nahradne zo stranky, tie viedli
 * na verejny subor, ktory si mohol stiahnut ktokolvek).
 */
export async function zdrojSuborov(sid, volby = {}) {
  const zo = await odkazyZoSluzby(sid, volby);
  if (zo) return { zdroj: 'sluzba', subory: zo.subory, email: zo.email, emailed: zo.emailed, tyzden: zo.tyzden, nazov: zo.nazov };
  return { zdroj: 'caka', subory: [], email: '', emailed: false, tyzden: '', nazov: '' };
}

/* ── Panel po zaplateni ────────────────────────────────────────────────── */

/**
 * Vykresli panel so subormi do daneho prvku. Stav:
 *   { subory, email, session, test, nadpis, znacka, ukazka:{href,text}, znova }
 * Bez suborov (sluzba neodpovedala) povie, ze odkazy sa nenacitali, ukaze
 * cele cislo platby a tlacidlo Try again, ktore zavola stav.znova().
 * Nic nefarbi ani nepozicuje, vzhlad je v hub.css casti 9.
 */
export function vykresliPanel(koren, stav = {}) {
  if (!koren) return null;
  const d = typeof document !== 'undefined' ? document : null;
  if (!d) return null;
  const prvok = (tag, trieda, text) => {
    const x = d.createElement(tag);
    if (trieda) x.className = trieda;
    if (text) x.textContent = text;
    return x;
  };

  koren.textContent = '';
  koren.className = 'hotovo hotovo-panel';
  koren.appendChild(prvok('p', 'hotovo-znacka', stav.znacka || PANEL.znacka));
  koren.appendChild(prvok('h3', 'hotovo-nadpis', stav.nadpis || PANEL.nadpis));
  if (stav.test) koren.appendChild(prvok('p', 'hotovo-riadok', PANEL.test));
  if (stav.poznamka) koren.appendChild(prvok('p', 'hotovo-riadok', stav.poznamka));

  const subory = (Array.isArray(stav.subory) ? stav.subory : []).filter((s) => s && s.href);
  if (subory.length) {
    const ul = prvok('ul', 'hotovo-subory');
    for (const s of subory) {
      const li = d.createElement('li');
      const a = prvok('a', 'btn btn-solid subor');
      a.setAttribute('href', s.href);
      a.setAttribute('download', '');
      if (s.format) a.dataset.format = s.format;
      a.appendChild(prvok('span', 'subor-nazov', PANEL.stiahnut + (s.nazov || '')));
      const meta = [s.velkost, s.popis].filter(Boolean).join(' · ');
      if (meta) a.appendChild(prvok('span', 'subor-meta', meta));
      li.appendChild(a);
      ul.appendChild(li);
    }
    koren.appendChild(ul);
  } else {
    // Zaplatene je, ale licencna sluzba odkazy nedala (vypadok, vypnute stahovanie,
    // siet). Ziadny nahradny odkaz: povieme pokojne, co robit, a dame skusit znova.
    koren.appendChild(prvok('p', 'hotovo-riadok', PANEL.cakame));
    if (typeof stav.znova === 'function') {
      const p = prvok('p', 'hotovo-znova');
      const b = prvok('button', 'btn btn-line', PANEL.znova);
      b.setAttribute('type', 'button');
      b.addEventListener('click', () => { b.disabled = true; stav.znova(); });
      p.appendChild(b);
      koren.appendChild(p);
    }
    koren.appendChild(prvok('p', 'hotovo-riadok', stav.session ? PANEL.cakamePomoc : PANEL.cakamePomocBez));
    if (stav.session) {
      // Cele session id, nie len chvost: podla neho sa da platba najst v Stripe a
      // subory doposlat (python tituly.py --session ...). Je to kupujuceho vlastna platba.
      const p = prvok('p', 'hotovo-cislo');
      p.appendChild(d.createTextNode(PANEL.referencia));
      const b = d.createElement('b');
      b.textContent = String(stav.session);
      p.appendChild(b);
      koren.appendChild(p);
    }
  }

  if (stav.ukazka && stav.ukazka.href) {
    const p = prvok('p', 'hotovo-ukazka');
    const a = d.createElement('a');
    a.setAttribute('href', stav.ukazka.href);
    a.textContent = stav.ukazka.text || PANEL.ukazka;
    p.appendChild(a);
    koren.appendChild(p);
  }

  // Bez odkazov nie je co ulozit ani o com hovorit v suvislosti s e-mailom; cislo
  // platby uz stoji cele vyssie.
  if (!subory.length) {
    koren.hidden = false;
    return koren;
  }

  /* O e-maile sa hovori len to, co je dokazane. emailed === true prichadza
     z licencnej sluzby a znamena, ze e-mail bol naozaj odoslany; cokolvek ine
     (stare API bez toho pola, vypadok sluzby, zlyhany Resend) je "nevieme". */
  const mail = prvok('p', 'hotovo-mail');
  if (stav.emailed === true) {
    mail.appendChild(d.createTextNode(PANEL.mailPred));
    const kto = d.createElement('b');
    kto.textContent = stav.email ? String(stav.email) : PANEL.mailBez;
    mail.appendChild(kto);
    mail.appendChild(d.createTextNode(PANEL.mailPo));
  } else {
    mail.textContent = PANEL.mailNeisty;
  }
  koren.appendChild(mail);

  const cislo = cisloObjednavky(stav.session);
  if (cislo) {
    const p = prvok('p', 'hotovo-cislo');
    p.appendChild(d.createTextNode(PANEL.objednavka));
    const b = d.createElement('b');
    b.textContent = cislo;
    p.appendChild(b);
    koren.appendChild(p);
  }

  koren.hidden = false;
  return koren;
}

/* ── Stranka ───────────────────────────────────────────────────────────── */

function bezpecneNacitaj(store, k) { try { return store ? store.getItem(k) : null; } catch (e) { return null; } }
function bezpecneUloz(store, k, v) { try { if (store) store.setItem(k, v); } catch (e) { /* bez uloziska to bezi dalej */ } }
function bezpecneZabudni(store, k) { try { if (store) store.removeItem(k); } catch (e) { /* nic */ } }
function track(name, data) { try { if (window.umami && typeof window.umami.track === 'function') window.umami.track(name, data); } catch (e) { /* nic */ } }
function doklad() { return typeof document !== 'undefined' ? document : null; }

/** Udaje titulu z bloku <script type="application/json" id="titul-data">. */
export function nacitajUdaje(doc) {
  const el = (doc || document).getElementById('titul-data');
  if (!el) return null;
  try { return JSON.parse(el.textContent || '{}'); } catch (e) { return null; }
}

/**
 * Je tento prehliadac v testovom rezime Stripe? ?test=1 ho zapne na reláciu.
 * STAV-52 (posudok obchodov postav pokus 2, nalez 1): rozhoduje adresa, uloziste rezim len drzi
 * medzi strankami. Predtym vynimka zo sessionStorage (sukromne okno, zakazane uloziste) vratila
 * false aj pri vyslovnom ?test=1 a tlacidlo potom vybralo zivy odkaz.
 */
export function testRezimZ(adresa, store) {
  let q = '';
  try { q = new URL(String(adresa || '')).searchParams.get('test') || ''; } catch (e) { q = ''; }
  if (q === '1') { bezpecneUloz(store, KLUC_TEST, '1'); return true; }
  return bezpecneNacitaj(store, KLUC_TEST) === '1';
}

function trvaleUloziste() {
  // Rovnako ako pri sessionStorage: zakazane uloziste vyhodi uz pri citani window.localStorage.
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch (e) { return null; }
}

function relacneUloziste() {
  // Uz samotne citanie window.sessionStorage vyhodi SecurityError, ked prehliadac uloziste zakaze.
  try { return typeof sessionStorage === 'undefined' ? null : sessionStorage; } catch (e) { return null; }
}

export function testRezim() {
  return testRezimZ(typeof location === 'undefined' ? '' : location.href, relacneUloziste());
}

/** Odkaz, ktory v testovom rezime nesmie viest nikam: zivy Stripe (nie test_) a kazdy Etsy. */
export function zivaPlatba(href) {
  const u = String(href || '').trim();
  if (/^https:\/\/buy\.stripe\.com\//i.test(u)) return !/^https:\/\/buy\.stripe\.com\/test_/.test(u);
  return /^https?:\/\/([a-z0-9-]+\.)*etsy\.com(\/|$)/i.test(u);
}

export const TEST_VYPNUTE = 'Switched off in test mode: this leads to a real payment.';

/**
 * V testovom rezime vypne kazdy odkaz na stranke, ktory by viedol na zivu platbu (napr. "Or on Etsy"):
 * bez href, aria-disabled a klik sa zastavi aj keby href niekto vratil. Vracia pocet vypnutych.
 */
export function vypniZivePlatby(doc) {
  const d = doc || doklad();
  if (!d) return 0;
  let n = 0;
  for (const a of d.querySelectorAll('a[href]')) {
    if (!zivaPlatba(a.getAttribute('href'))) continue;
    a.removeAttribute('href');
    a.setAttribute('aria-disabled', 'true');
    a.setAttribute('title', TEST_VYPNUTE);
    a.dataset.testVypnute = '1';
    // viditelne aj bez stylu (CSP stranok nepovoli vlozeny styl): odkaz uz nevyzera ako cesta dalej
    if (typeof a.textContent === 'string' && !/test mode\)$/.test(a.textContent.trim())) a.textContent = a.textContent.trim() + ' (switched off in test mode)';
    n++;
  }
  if (!d.__testStraz && typeof d.addEventListener === 'function') {
    d.__testStraz = true;
    d.addEventListener('click', (e) => {
      const a = e.target && typeof e.target.closest === 'function' ? e.target.closest('a') : null;
      if (a && (a.dataset.testVypnute === '1' || zivaPlatba(a.getAttribute('href')))) e.preventDefault();
    }, true);
  }
  return n;
}

export function odomknute() {
  return stavZoZaznamu(bezpecneNacitaj(trvaleUloziste(), KLUC_ODOMKNUTE));
}

export function jeOdomknuty(id) {
  return !!odomknute().tituly[id];
}

export function sessionTitulu(id) {
  return odomknute().sessions[id] || '';
}

export function odomkni(id, jeTest, sid) {
  const s = odomknute();
  s.tituly[id] = true;
  if (sid) s.sessions[id] = String(sid);
  if (jeTest) s.test = true;
  s.t = Date.now();
  bezpecneUloz(trvaleUloziste(), KLUC_ODOMKNUTE, JSON.stringify(s));
}

/** Ukazka pri tlacidle kupy, aby sa dala po platbe zopakovat ako tichy odkaz. */
export function ukazkaZoStranky(titul, doc) {
  const d = doc || doklad();
  if (!d) return null;
  const btn = d.querySelector('[data-titul="' + titul + '"]');
  const obal = btn && typeof btn.closest === 'function' ? btn.closest('.akcie') : null;
  const a = (obal || d).querySelector('a[data-ukazka]');
  if (!a) return null;
  const href = a.getAttribute('href') || '';
  if (!href) return null;
  return { href, text: (a.textContent || '').trim() || PANEL.ukazka };
}

/** Po platbe ide prec cely riadok s tlacidlom, nielen tlacidlo samo. */
export function skryNakup(titul, doc) {
  const d = doc || doklad();
  if (!d || !titul) return;
  for (const b of d.querySelectorAll('[data-titul="' + titul + '"]')) {
    b.hidden = true;
    const obal = typeof b.closest === 'function' ? b.closest('.akcie') : null;
    if (obal) obal.hidden = true;
  }
}

/**
 * Cely stav po zaplateni: subory zo sluzby, panel na mieste tlacidla a
 * schovany riadok kupy. Pouzivaju to vsetky stranky s jednorazovym titulom aj
 * cislo Puzzle Post. Ked sluzba neodpovie, panel ma tlacidlo Try again, ktore
 * spusti presne toto iste volanie znova.
 * volby: { blok, titul, sid, test, nadpis, ukazka, fetch } (data sa uz nepouziva)
 */
export async function ukazPoPlatbe(volby = {}) {
  const ukazka = volby.ukazka === null ? null : (volby.ukazka || ukazkaZoStranky(volby.titul));
  const zdroj = await zdrojSuborov(volby.sid, volby);
  vykresliPanel(volby.blok, {
    subory: zdroj.subory,
    email: zdroj.email,
    emailed: zdroj.emailed,
    session: volby.sid,
    test: !!volby.test,
    nadpis: volby.nadpis,
    znacka: volby.znacka,
    poznamka: volby.poznamka,
    ukazka,
    znova: zdroj.subory.length ? null : () => ukazPoPlatbe(volby),
  });
  skryNakup(volby.titul, volby.doc);
  return zdroj;
}

/**
 * Cela obsluha jednej stranky titulu.
 * volby: { data, tlacidlo, stav, blokSuborov, poPlatbe }
 */
export function nastav(volby = {}) {
  const data = volby.data || nacitajUdaje(document);
  if (!data || !data.titul) return null;
  const cena = Number(data.cena) || 490;
  const stavEl = volby.stav || document.getElementById('stav-platby');
  const blok = volby.blokSuborov || document.getElementById('subory-hotovo');
  const test = testRezim();
  if (test) vypniZivePlatby(document);

  const odznak = document.getElementById('test-odznak');
  if (odznak) {
    odznak.hidden = !test;
    if (test) naplnOdznak(odznak, T.odznak);
  }

  let panelHotovy = false;
  function panel(sid, jeTest) {
    panelHotovy = true;
    return ukazPoPlatbe({ blok, data, titul: data.titul, sid, test: jeTest });
  }

  function prekresli() {
    const hotovo = jeOdomknuty(data.titul);
    if (!hotovo) {
      if (blok) blok.hidden = true;
      return;
    }
    skryNakup(data.titul);
    const kupa = document.getElementById('kupa-hotova');
    if (kupa) kupa.hidden = false;
    // Po obnoveni stranky sa panel postavi znova. Session si pamata zaznam o
    // odomknuti, takze sa da znova spytat sluzby na e-mail a cerstve odkazy.
    if (!panelHotovy) panel(sessionTitulu(data.titul), odomknute().test);
  }

  // pred poNavrate, ktory z adresy zmaze dotaz
  const odkial = prichod(typeof location === 'undefined' ? '' : location.href, ulozenyPrichod());
  zapamatajUtm();
  for (const btn of document.querySelectorAll('[data-titul]')) {
    btn.addEventListener('click', () => {
      track('kupa_click', { titul: btn.dataset.titul, cena: cena, produkt: data.produkt || data.titul });
      const u = odkazTlacidla(btn.dataset, test);
      if (!u) {
        if (stavEl) { stavEl.textContent = test ? T.testChyba : T.zapina; stavEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        return;
      }
      location.href = sOdkazomReklamy(u, odkial.utm, { postava: odkial.postava, titul: btn.dataset.titul });
    });
  }
  for (const a of document.querySelectorAll('a[data-ukazka]')) {
    a.addEventListener('click', () => track('ukazka', { kde: a.dataset.ukazka, produkt: data.produkt || data.titul }));
  }

  /* Cena videna: spolocne meno s ostatnymi produktmi (report EUR na 100 navstev). */
  const cenaEl = document.getElementById('price');
  if (cenaEl && typeof IntersectionObserver === 'function') {
    const io = new IntersectionObserver((z) => {
      for (const e of z) if (e.isIntersecting) { track('cena_videna', { produkt: data.produkt || data.titul }); io.disconnect(); }
    }, { threshold: 0.4 });
    io.observe(cenaEl);
  }

  let cakanie = null;
  async function over(sid, pokus) {
    if (stavEl) stavEl.textContent = T.overujem + (pokus > 1 ? ' (' + pokus + ')' : '');
    let st = null;
    try {
      const r = await fetch(API + '/v1/kontrola/status?session_id=' + encodeURIComponent(sid));
      if (r.ok) st = await r.json();
    } catch (e) { /* siet, skusame dalej */ }
    const v = posudPlatbu(st, cena);
    if (v.stav === 'zaplatene') {
      odomkni(data.titul, v.test, sid);
      bezpecneZabudni(trvaleUloziste(), KLUC_CAKAJUCA);
      // Panel povie "Paid, thank you" sam a nahlas, riadok stavu uz nema co dodat.
      if (stavEl) { stavEl.textContent = ''; stavEl.innerHTML = ''; }
      track('zaplatene', { titul: data.titul, test: !!v.test, produkt: data.produkt || data.titul });
      await panel(sid, v.test);
      prekresli();
      if (blok) blok.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (typeof volby.poPlatbe === 'function') volby.poPlatbe(v);
      return true;
    }
    if (v.stav === 'inaSuma') {
      bezpecneZabudni(trvaleUloziste(), KLUC_CAKAJUCA);
      if (stavEl) stavEl.textContent = T.inaSuma;
      return false;
    }
    // Stripe odpovedal, ze zaplatene nie je, alebo neodpovedal. Payment link
    // vracia spat az po uspesnej platbe, takze je to skoro vzdy oneskorenie.
    bezpecneUloz(trvaleUloziste(), KLUC_CAKAJUCA, JSON.stringify({ session: sid, titul: data.titul, test: test, t: Date.now() }));
    if (stavEl) {
      stavEl.innerHTML = T.nepotvrdene + ' <button type="button" class="btn btn-line" id="over-znova">' + T.overZnova + '</button>';
      const b = document.getElementById('over-znova');
      if (b) b.addEventListener('click', () => { clearTimeout(cakanie); over(sid, 1); });
    }
    if (pokus < 8) cakanie = setTimeout(() => over(sid, pokus + 1), Math.min(30000, 3000 * pokus));
    return false;
  }

  function poNavrate() {
    let sid = '', titulVDotaze = '', cudziTitul = false;
    try {
      const q = new URL(location.href).searchParams;
      sid = q.get('session_id') || '';
      titulVDotaze = q.get('titul') || '';
      cudziTitul = !!titulVDotaze && !titulZDotazu(titulVDotaze, data.titul);
    } catch (e) { /* nic */ }
    if (sid) history.replaceState(null, '', location.pathname);
    // Navrat zo Stripe vedie vzdy na stranku toho titulu, ktory sa kupoval.
    // Ked v adrese stoji cudzi titul, je to rucne upravena adresa a nic sa neodomyka.
    if (cudziTitul) return;
    if (!sid) {
      const c = bezpecneNacitaj(trvaleUloziste(), KLUC_CAKAJUCA);
      let z = null;
      try { z = c ? JSON.parse(c) : null; } catch (e) { z = null; }
      if (z && z.session && z.titul === data.titul && !jeOdomknuty(data.titul)) sid = z.session;
    }
    if (!sid) return;
    if (sid.startsWith('cs_test_') && !test) { if (stavEl) stavEl.textContent = T.testCudzi; return; }
    over(sid, 1);
  }

  prekresli();
  poNavrate();
  return { prekresli, over, panel };
}
