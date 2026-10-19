// A-014: jedna konkretna kniha pri hre, bez udajov hraca alebo noveho trackera.
//
// 19. 10. 2026 (Andrej, „ARLING REVENUE EXECUTION MODE“, bod 2): navyse ticha ponuka knihy toho isteho typu
// hlavolamu az po vyrieseni (ponukaPoVyrieseni). Vola ju skontroluj() v game.js kazdej hry hned po oslave, teda len
// v okamihu, ked hrac dokonci hlavolam; otvoreny uz vyrieseny den ju neukaze, s vypnutou oslavou (nastavenie hry)
// sa neukaze vobec. Jeden riadok, jedno tlacidlo, ziadne okno, ziadne odpocitavanie; najviac raz za den na
// zariadenie (localStorage), bez zaznamu sa neukaze. Kanal (brana nakupov, ops/games/ponuka-knih-2026-10-19/
// BRANA.md, B1): 10 hier vedie na nasu stranku knihy /puzzle-books/<slug>/ (4,90 € s DPH cez Stripe, tam je aj
// Etsy), Owls, Dormice a Foxes na Etsy, lebo ich knihy su len tam. Meranie: data-umami-event="game_to_book"
// s vlastnostami hra, typ a kanal (skript Umami hubu meria klik na <a> s tymito atributmi, ako blok z
// ops/games/predaj.mjs) a pri zobrazeni game_book_offer_shown { hra, typ }, ak Umami na stranke bezi. Vyber knih,
// dovody a postup: ops/games/ponuka-knih-2026-10-19/STAV.md. Blok PONUKY (kniha a cena) pise len
// ops/games/ponuka-knih.mjs.
export const KNIHY = {
  "badgers": {
    "nazov": "Killer Sudoku",
    "etsy": "4573944950"
  },
  "cranes": {
    "nazov": "Hashi",
    "etsy": "4573945662"
  },
  "hares": {
    "nazov": "Anti-knight Sudoku",
    "etsy": "4573945922"
  },
  "hedgehogs": {
    "nazov": "Star Battle",
    "etsy": "4573926879"
  },
  "herons": {
    "nazov": "Numberlink",
    "etsy": "4573945860"
  },
  "magpies": {
    "nazov": "Nonogram",
    "etsy": "4573945426"
  },
  "otters": {
    "nazov": "Slitherlink",
    "etsy": "4573945496"
  },
  "squirrels": {
    "nazov": "Kakuro",
    "etsy": "4573927131"
  },
  "swans": {
    "nazov": "Masyu",
    "etsy": "4573945736"
  },
  "voles": {
    "nazov": "Nurikabe",
    "etsy": "4573945796"
  }
};

/* PONUKY:ZACIATOK generuje node ops/games/ponuka-knih.mjs --zapis z registra Stripe a snímky Etsy; ručne neupravovať, cena musí sedieť */
export const PONUKY_SNIMKA = "2026-10-18T21:44:22.634Z";
export const PONUKY = Object.freeze({
  "magpies": Object.freeze({"kanal":"web","typ":"nonogram","slug":"nonogram-puzzle-book","pocet":100,"nazov":"Nonograms","cena":4.9,"veta":"Magpies is a nonogram. Our PDF book has 100 more, from easy 8 × 8 to challenge 15 × 15, with all solutions."}),
  "cranes": Object.freeze({"kanal":"web","typ":"hashi","slug":"hashi-puzzle-book","pocet":100,"nazov":"Hashi puzzles","cena":4.9,"veta":"Cranes is a Hashi, the bridges puzzle. Our PDF book has 100 more, easy to challenge, with all solutions."}),
  "squirrels": Object.freeze({"kanal":"web","typ":"kakuro","slug":"kakuro-puzzle-book","pocet":100,"nazov":"Kakuro puzzles","cena":4.9,"veta":"Squirrels is a Kakuro, the cross sums puzzle. Our PDF book has 100 more, from easy 6 × 6 to challenge 12 × 12, with all solutions."}),
  "otters": Object.freeze({"kanal":"web","typ":"slitherlink","slug":"slitherlink-puzzle-book","pocet":100,"nazov":"Slitherlink puzzles","cena":4.9,"veta":"Otters is a Slitherlink. Our PDF book has 100 more, easy to challenge, with all solutions."}),
  "hedgehogs": Object.freeze({"kanal":"web","typ":"star-battle","slug":"star-battle-puzzle-book","pocet":100,"nazov":"Star Battle puzzles","cena":4.9,"veta":"Hedgehogs is a Star Battle. Our PDF book has 100 more, easy to challenge, one large grid per page, with all solutions."}),
  "herons": Object.freeze({"kanal":"web","typ":"numberlink","slug":"numberlink-puzzle-book","pocet":100,"nazov":"Numberlink puzzles","cena":4.9,"veta":"Herons is a Numberlink. Our PDF book has 100 more, easy to challenge, with all solutions."}),
  "swans": Object.freeze({"kanal":"web","typ":"masyu","slug":"masyu-puzzle-book","pocet":100,"nazov":"Masyu puzzles","cena":4.9,"veta":"Swans is a Masyu. Our PDF book has 100 more, easy to challenge, with all solutions."}),
  "voles": Object.freeze({"kanal":"web","typ":"nurikabe","slug":"nurikabe-puzzle-book","pocet":100,"nazov":"Nurikabe puzzles","cena":4.9,"veta":"Voles is a Nurikabe. Our PDF book has 100 more, from easy 6 × 6 to challenge 12 × 12, with all solutions."}),
  "badgers": Object.freeze({"kanal":"web","typ":"killer-sudoku","slug":"killer-sudoku-book","pocet":100,"nazov":"Killer Sudoku puzzles","cena":4.9,"veta":"Badgers is a Killer Sudoku. Our PDF book has 100 more, easy to challenge, with all solutions."}),
  "hares": Object.freeze({"kanal":"web","typ":"anti-knight-sudoku","slug":"anti-knight-sudoku-book","pocet":100,"nazov":"Anti-knight Sudoku puzzles","cena":4.9,"veta":"Hares is an Anti-knight Sudoku. Our PDF book has 100 more, easy to challenge, with all solutions."}),
  "owls": Object.freeze({"kanal":"etsy","typ":"binary","listing":"4586106587","pocet":100,"nazov":"binary puzzles","cena":6.9,"veta":"Owls is a binary puzzle. Our PDF book has 100 more, 6 × 6 to 10 × 10, with 0 and 1 in place of the owls and all solutions."}),
  "dormice": Object.freeze({"kanal":"etsy","typ":"logic-grid","listing":"4577011438","pocet":50,"nazov":"logic grid puzzles","cena":5.9,"veta":"Dormice is a logic grid puzzle. Our PDF book has 50 more dormouse stories, easy to challenge, with all solutions."}),
  "foxes": Object.freeze({"kanal":"etsy","typ":"where-is-the-fox","listing":"4586197650","pocet":50,"nazov":"fox lairs","cena":5.9,"veta":"Foxes on paper: our PDF book Where Is the Fox? has 50 more lairs, from easy 5 × 5 to hard 7 × 7, with all solutions."}),
});
/* PONUKY:KONIEC */

export function pridajKnihu(dokument = document, okno = window) {
  const hra = okno.location.pathname.split('/')[2];
  // Veta o statistikach az po game.js: karta.js v nom prepisuje tu istu vetu a hlada v nej „Nothing else.“
  naplanujVetuOStatistikach(dokument, okno, hra);
  const kniha = KNIHY[hra];
  const pravidla = dokument.querySelector('#rules');
  if (!kniha || !pravidla || dokument.getElementById('kniha-hry')) return;
  const panel = dokument.createElement('section');
  panel.id = 'kniha-hry';
  panel.className = 'deep';
  const obal = dokument.createElement('div');
  obal.className = 'wrap prose';
  const nadpis = dokument.createElement('h2');
  nadpis.textContent = kniha.nazov + ' on paper.';
  const popis = dokument.createElement('p');
  popis.textContent = '100 puzzles with solutions as a printable PDF in A4 and US Letter. See the book page for a free sample and current price.';
  const odkazy = dokument.createElement('p');
  for (const [kanal, href, text] of [
    ['arling', '/puzzle-books/#' + hra, 'View the ' + kniha.nazov + ' PDF book'],
    ['etsy', 'https://www.etsy.com/listing/' + kniha.etsy, 'Buy this PDF book on Etsy'],
  ]) {
    const a = dokument.createElement('a');
    a.href = href;
    a.textContent = text;
    a.dataset.knihaKanal = kanal;
    a.addEventListener('click', () => {
      try { okno.umami?.track('game_book_click', { hra, kanal }); } catch {}
    });
    if (odkazy.childNodes.length) odkazy.appendChild(dokument.createTextNode(' · '));
    odkazy.appendChild(a);
  }
  obal.append(nadpis, popis, odkazy);
  panel.appendChild(obal);
  pravidla.before(panel);
}

/* ── Veta o štatistikách v sekcii About ─────────────────────────────────────
 * Stránka hry sľubuje „… Nothing else.“ Kliky na knihy sa merajú, preto sa táto veta nahradí pravdivou. Beží až
 * po game.js (setTimeout 0, po celom grafe modulov): karta.js v tom istom odseku prepisuje vetu o Share a hľadá
 * v nej práve „Nothing else.“; keby tu zmizla skôr, veta o Share by ostala stará. */
export function vetaOStatistikach(hra) {
  const ma = (o) => Object.prototype.hasOwnProperty.call(o, hra);
  const panel = ma(KNIHY), ponuka = ma(PONUKY);
  if (!panel && !ponuka) return null;
  const zaznam = ' The day that offer last appeared stays in this browser, so it shows at most once a day.';
  if (panel && ponuka) return 'We also count clicks on the book links, with the game name and where the link goes (ARLing or Etsy), and for the book offer after a solved puzzle also that it appeared and the puzzle type. No puzzle entries or personal details are sent.' + zaznam;
  if (panel) return 'We also count clicks to the PDF book, with the game name and destination (ARLing or Etsy). No puzzle entries or personal details are sent with that click.';
  return 'We also count that the book offer appeared after a solved puzzle and clicks on it, with the game name, the puzzle type and where the link goes. No puzzle entries or personal details are sent.' + zaznam;
}
function naplanujVetuOStatistikach(dokument, okno, hra) {
  const veta = vetaOStatistikach(hra);
  if (!veta) return;
  const oprav = () => {
    try {
      for (const odsek of dokument.querySelectorAll('#about p')) {
        if (odsek.textContent.includes('Nothing else.')) odsek.textContent = odsek.textContent.replace('Nothing else.', veta);
      }
    } catch (e) { /* the page keeps its old words */ }
  };
  if (okno && typeof okno.setTimeout === 'function') okno.setTimeout(oprav, 0); else oprav();
}

/* ── Ponuka knihy po vyriešení ───────────────────────────────────────────── */
export const KLUC_PONUKY = 'games:book-offer';
/* Veta výsledku príde v 700 ms a karta v 900 ms (oslava.js, CASY); ponuka až po nich, pri zníženom pohybe hneď. */
export const ODKLAD_PONUKY = 1500;
const ID_PONUKY = 'ponuka-knihy';
const ID_POZNAMKY = 'ponuka-knihy-pozn';
const ID_STYLU = 'ponuka-knihy-styl';
/* Hry sú dnes len anglické (<html lang="en">). Stránka v inom jazyku ponuku nedostane, kým tu nebude jej text.
 * Vety o cene a DPH sú tie isté ako na stránkach kníh (puzzle-books/<slug>/: „VAT included, nothing added at
 * checkout“, „In the EU, Etsy adds local VAT (23 percent in Slovakia)“, „elsewhere Etsy may add local tax“). */
const TEXTY_PONUKY = Object.freeze({
  en: Object.freeze({
    oblast: 'Puzzle book',
    tlacidlo: (p) => 'Get ' + p.pocet + ' more ' + p.nazov + ' to print',
    cena: Object.freeze({ web: (c) => c + ' with VAT', etsy: (c) => c + ' on Etsy' }),
    pozn: Object.freeze({
      web: 'Opens our book page on arling.sk with a free five puzzle sample. VAT included, nothing added at checkout.',
      etsy: 'Opens our Etsy shop in a new tab. In the EU, Etsy adds local VAT (23 percent in Slovakia); elsewhere it may add local tax. Etsy shows the total before you pay.',
    }),
  }),
});
/* Štýl je tu, nie v /style/hra.css: denná prestavba pushuje len games/, takže ponuka a jej vzhľad idú naživo
 * spolu. Farby a písmo sú premenné papiera (paper.css), tlačidlo je obyčajné .btn.btn-line ako Share pred
 * vyriešením. Na telefóne ide cena pod akciu (oddeľovač ostáva čítačke), aby sa riadok nelámal náhodne. */
const STYL_PONUKY = '.ponuka-knihy{margin:18px 0 16px;padding:14px 0 0;border-top:1px solid var(--line);font-family:var(--ui)}'
  + '.ponuka-knihy p{margin:0;max-width:62ch}'
  + '.ponuka-knihy .pk-veta{font-size:14px;line-height:1.5;color:var(--body)}'
  + '.ponuka-knihy a.btn.pk-btn{display:inline-block;height:auto;min-height:48px;max-width:100%;margin:10px 0 0;padding:13px 18px;'
  + 'line-height:1.35;text-align:left;white-space:normal;text-decoration:none;box-sizing:border-box;border-radius:24px}'
  + '.ponuka-knihy .pk-cena{font-weight:500;white-space:nowrap}'
  + '.ponuka-knihy .pk-pozn{margin-top:8px;font-size:13px;line-height:1.45;color:var(--muted)}'
  + '@media (max-width:520px){.ponuka-knihy .pk-sep{position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;'
  + 'clip-path:inset(50%);white-space:nowrap}.ponuka-knihy .pk-cena{display:block;margin-top:3px}}'
  + '@media (prefers-reduced-motion:no-preference){.ponuka-knihy.pk-prichod{animation:pk-prichod .4s ease-out both}}'
  + '@keyframes pk-prichod{from{opacity:0}to{opacity:1}}';

/** Dnešný deň zariadenia (miestny čas) ako RRRR-MM-DD. */
export function denZariadenia(d = new Date()) {
  const dv = (x) => String(x).padStart(2, '0');
  return d.getFullYear() + '-' + dv(d.getMonth() + 1) + '-' + dv(d.getDate());
}
/** Smie sa dnes ponuka ukázať? Bez úložiska alebo pri chybe nie (raz za deň sa bez záznamu nedá dodržať). */
export function smieUkazatPonuku(ulozisko, den) {
  if (!ulozisko || typeof den !== 'string' || !den) return false;
  try { return ulozisko.getItem(KLUC_PONUKY) !== den; } catch (e) { return false; }
}
/** Zapíše dnešné ukázanie; true len keď sa zápis dá prečítať späť. */
export function zapisPonuku(ulozisko, den) {
  if (!ulozisko || typeof den !== 'string' || !den) return false;
  try { ulozisko.setItem(KLUC_PONUKY, den); return ulozisko.getItem(KLUC_PONUKY) === den; } catch (e) { return false; }
}
/** Cena na tlačidle: „7.90 €“ (zápis anglických stránok hubu); zlá hodnota dá null a ponuka sa neukáže. */
export function cenaPonuky(cena) {
  return typeof cena === 'number' && Number.isFinite(cena) && cena > 0 ? cena.toFixed(2) + ' €' : null;
}
/** Odkaz s UTM: na našu stránku knihy (kanal web, relatívna adresa na hube, utm.js ju zapamätá a polica z nej
 *  urobí client_reference_id platby Stripe) alebo priamo na ponuku Etsy (kanal etsy). null pri čomkoľvek inom. */
export function odkazPonuky(hra, p) {
  const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  if (!p || !slug.test(String(hra)) || !slug.test(String(p.typ))) return null;
  let u;
  if (p.kanal === 'web' && slug.test(String(p.slug))) u = new URL('https://arling.sk/puzzle-books/' + p.slug + '/');
  else if (p.kanal === 'etsy' && /^\d{6,12}$/.test(String(p.listing))) u = new URL('https://www.etsy.com/listing/' + p.listing);
  else return null;
  u.searchParams.set('utm_source', 'arling');
  u.searchParams.set('utm_medium', 'game');
  u.searchParams.set('utm_campaign', p.typ);
  u.searchParams.set('utm_content', hra);
  return p.kanal === 'web' ? u.pathname + u.search : u.toString();
}
/** Texty a odkaz ponuky pre hru a jazyk stránky; null, keď hra knihu nemá alebo jazyk nemá text. */
export function textPonuky(hra, jazyk = 'en') {
  const p = Object.prototype.hasOwnProperty.call(PONUKY, hra) ? PONUKY[hra] : null;
  const t = TEXTY_PONUKY[String(jazyk || '').slice(0, 2).toLowerCase()];
  const cena = p ? cenaPonuky(p.cena) : null;
  const href = p ? odkazPonuky(hra, p) : null;
  if (!p || !t || !cena || !href || !t.cena[p.kanal] || !t.pozn[p.kanal]) return null;
  return { hra, typ: p.typ, kanal: p.kanal, href, novaKarta: p.kanal === 'etsy', veta: p.veta, tlacidlo: t.tlacidlo(p),
    cena: t.cena[p.kanal](cena), pozn: t.pozn[p.kanal], oblast: t.oblast };
}

function prvySurodenec(el) {
  let x = el ? el.nextSibling : null;
  while (x && x.nodeType !== 1) x = x.nextSibling;
  return x || null;
}
/* Blok výsledku pod vetou #stav: rozuzlenie príbehu (Dormice, Foxes), Share s kartou (#zdielanie) alebo karta
 * v bloku pod vetou (.karta-blok, Cranes, Herons, Swans, Voles). Ponuka ide až za celý blok, nikdy doňho. */
function jeVysledok(el) {
  if (!el || el.nodeType !== 1) return false;
  if (el.id === 'zdielanie' || el.id === 'rozuzlenie') return true;
  return !!(el.classList && typeof el.classList.contains === 'function' && el.classList.contains('karta-blok'));
}
/** Kam ponuka patrí: za vetu výsledku a celý blok výsledku, teda pred pásik týždňa. */
export function miestoPonuky(dokument) {
  const stav = dokument.getElementById('stav');
  const rodic = stav ? stav.parentNode : null;
  if (!rodic) return null;
  let za = stav;
  for (let x = prvySurodenec(stav); jeVysledok(x); x = prvySurodenec(x)) za = x;
  return { rodic, pred: za.nextSibling || null };
}
function postavPonuku(dokument, t) {
  const obal = dokument.createElement('aside');
  obal.id = ID_PONUKY;
  obal.className = 'ponuka-knihy';
  obal.setAttribute('aria-label', t.oblast);
  const veta = dokument.createElement('p');
  veta.className = 'pk-veta';
  veta.textContent = t.veta;
  const a = dokument.createElement('a');
  a.className = 'btn btn-line pk-btn';
  a.setAttribute('href', t.href);
  // Novú kartu otvára len Etsy (cudzí obchod); naša stránka knihy sa otvára v tej istej karte, ako odkazy panelu A-014.
  if (t.novaKarta) {
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener');
  }
  a.setAttribute('aria-describedby', ID_POZNAMKY);
  a.setAttribute('data-umami-event', 'game_to_book');
  a.setAttribute('data-umami-event-hra', t.hra);
  a.setAttribute('data-umami-event-typ', t.typ);
  a.setAttribute('data-umami-event-kanal', t.kanal);
  const akcia = dokument.createElement('span');
  akcia.className = 'pk-akcia';
  akcia.textContent = t.tlacidlo;
  const cena = dokument.createElement('span');
  cena.className = 'pk-cena';
  cena.textContent = t.cena;
  const oddelovac = dokument.createElement('span');
  oddelovac.className = 'pk-sep';
  oddelovac.textContent = ', ';
  a.appendChild(akcia);
  a.appendChild(oddelovac);
  a.appendChild(cena);
  const pozn = dokument.createElement('p');
  pozn.id = ID_POZNAMKY;
  pozn.className = 'pk-pozn';
  pozn.textContent = t.pozn;
  obal.appendChild(veta);
  obal.appendChild(a);
  obal.appendChild(pozn);
  return obal;
}
function pridajStyl(dokument) {
  if (dokument.getElementById(ID_STYLU)) return;
  const s = dokument.createElement('style');
  s.id = ID_STYLU;
  s.textContent = STYL_PONUKY;
  (dokument.head || dokument.body).appendChild(s);
}
function ulozisko(okno) {
  try { return okno.localStorage || null; } catch (e) { return null; }
}
function pokojne(okno) {
  try { return !!(okno.matchMedia && okno.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
}
const naplanovane = new WeakSet();

/* Zobrazenie ponuky do Umami, len keď skript Umami na stránke beží; inak nič a bez chyby. */
function zapisZobrazenie(okno, t) {
  try {
    const u = okno && okno.umami;
    if (u && typeof u.track === 'function') u.track('game_book_offer_shown', { hra: t.hra, typ: t.typ });
  } catch (e) { /* statistics are not part of the game */ }
}

/**
 * Tichá ponuka knihy po vyriešení. Volá ju skontroluj() v game.js, keď sa hlavolam práve vyriešil.
 * Nikdy nevyhodí výnimku (ponuka nie je súčasť hry). Vráti true, keď je ponuka naplánovaná.
 * volby: bezOslavy (true, keď má hráč v nastaveniach hry vypnutú oslavu: vtedy sa ponuka neukáže vôbec);
 * kvôli testom dokument, okno, ulozisko, den, odklad.
 */
export function ponukaPoVyrieseni(hra, volby = {}) {
  try {
    if (volby && volby.bezOslavy === true) return false;
    const dokument = volby.dokument || (typeof document !== 'undefined' ? document : null);
    const okno = volby.okno || (typeof window !== 'undefined' ? window : null);
    if (!dokument || !okno) return false;
    const jazyk = (dokument.documentElement && dokument.documentElement.lang) || 'en';
    const t = textPonuky(hra, jazyk);
    if (!t || naplanovane.has(dokument) || dokument.getElementById(ID_PONUKY)) return false;
    const ul = volby.ulozisko !== undefined ? volby.ulozisko : ulozisko(okno);
    const den = volby.den || denZariadenia();
    if (!smieUkazatPonuku(ul, den)) return false;
    naplanovane.add(dokument);
    const tichy = pokojne(okno);
    const odklad = Number.isFinite(volby.odklad) ? volby.odklad : (tichy ? 0 : ODKLAD_PONUKY);
    const ukaz = () => {
      try {
        if (dokument.getElementById(ID_PONUKY)) return;
        const miesto = miestoPonuky(dokument);
        // Poradie zatvára: bez miesta nič; dnešný záznam pred vložením, bez záznamu sa neukáže (raz za deň).
        if (!miesto || !smieUkazatPonuku(ul, den) || !zapisPonuku(ul, den)) return;
        pridajStyl(dokument);
        const el = postavPonuku(dokument, t);
        if (!tichy) el.classList.add('pk-prichod');
        miesto.rodic.insertBefore(el, miesto.pred);
        zapisZobrazenie(okno, t);
      } catch (e) { /* the offer is not part of the game */ }
    };
    if (odklad > 0 && typeof okno.setTimeout === 'function') okno.setTimeout(ukaz, odklad); else ukaz();
    return true;
  } catch (e) {
    return false;
  }
}

if (typeof document !== 'undefined') {
  // Panel knihy nesmie zastaviť hru: chyba tu by zhodila celý graf modulov game.js.
  const spusti = () => { try { pridajKnihu(); } catch (e) { /* the game runs on without the panel */ } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', spusti, { once: true });
  else spusti();
}
