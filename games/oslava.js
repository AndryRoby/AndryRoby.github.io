/* Moment vyriešenia denných hier: atrament a vlna po doske, potom veta
 * výsledku a karta. Fable, 27. 9. 2026 (M-plán A, M1:
 * ops/games/VYLEPSENIA-HIER-2026-09-27.md časť 3.5 a 6, vizuálna
 * špecifikácia ops/games/denne-karta/SPEC.md, testy ops/games/oslava.test.mjs;
 * kolo 2 po kontrole ops/games/denne-karta/KONTROLA-1.md).
 *
 * Zdieľané pre všetkých 14 denných hier. Predtým tu boli konfety cez celú
 * obrazovku a pulz, ktorý v 13 hrách zasiahol celé <body> (game.js mu dávali
 * document.querySelector('.hra') a telo má triedu hra). Oslava sa teraz deje
 * na doske, kam sa hráč pozerá, a skončí v tom istom stave, ako keď sa
 * vyriešený deň otvorí znova (zelené značky, rámik --ok).
 *
 * Časová os, T0 = hra zistí, že je vyriešené (všetky časy v tabuľke CASY):
 *   0 ms       rámik dosky na --ok za 120 ms, lineárne (hra.css)
 *   40 ms      atrament: kruh farby --ok s alfou 0,08 sa rozleje z bunky,
 *              ktorú posledný ťah zmenil, pružina morph; základ sa prepne, až
 *              keď kruh pokryje dosku (ink() z core.js), takže nič neprejde
 *              kalnou zmesou farieb
 *   40 ms a ďalej  vlna: každá značka sa zafarbí a raz dosadne (1 na 1,15 na 1,
 *              pružina press) presne vtedy, keď ju čelo kruhu minie; plochy
 *              (voda v slučke Otters a Swans) sa naplnia pod čelom
 *   700 ms     veta výsledku (#stav) príde a čas v nej sa dopočíta od nuly
 *   900 ms     karta príde zdola (náhľad a Share v lište, bez rozmazania),
 *              atrament zmizne
 *   od 400 ms  ťuk alebo kláves kdekoľvek skočí na koniec
 * Pri zníženom pohybe alebo vypnutej Celebration nič z toho: farba sa prepne
 * naraz, veta aj karta sú hneď, čas na čítanie ostáva.
 *
 * Použitie v game.js, v skontroluj() po uložení vyriešeného dňa:
 *   const pokojne = !nastavenia.oslava || prefers-reduced-motion;
 *   oslava(doska, {
 *     znacky,          prvky, ktoré dosadnú vo vlne (bunky, hrany, ostrovy);
 *                      každý dostane --oslava-d, čas, keď ho čelo minie
 *     pop: { kto, co } ktoré z nich sa raz zväčšia: kto je selektor prvku
 *                      (napr. '[data-v="2"]', nič = všetky), co je '::after',
 *                      selektor detí (všetky zhody, napr. '.hniezdo, .cislo')
 *                      alebo nič (prvok sám)
 *     plochy,          voliteľné: plochy, ktoré sa naplnia pod čelom atramentu
 *                      (fill-opacity 0 na 1 podľa toho, koľko z nich kruh pokryl)
 *     posledna,        voliteľné: index do znacky, prvok alebo bod na doske;
 *                      inak ho oslava zistí sama (nižšie, „Odkiaľ atrament“)
 *     veta, cas,       #stav a čas tak, ako ho hra píše do vety ('4:37')
 *     nahlad,          prvok alebo zoznam prvkov, ktoré prídu s kartou
 *                      (karta.nahlad({ poVlne: !pokojne }) z karta.js)
 *     redukovany,      pokojne
 *   });
 * Staré volanie oslava(document.querySelector('.hra'), …) z game.js, ktorý
 * prehliadač ešte drží v pamäti, si dosku nájde samo a na <body> nesiahne.
 * Farby a pohyb značiek sú v /style/hra.css pod .doska.oslava-vlna.
 * V Node bez DOM sa modul načíta a nerobí nič.
 *
 * Pružiny sú z produktu motion (/motion/src/core.js) a načítavajú sa
 * dynamicky (kontrola 2, nález 11): keby sa tam súbor presunul alebo zmenil
 * export, statický import by zastavil celých 14 hier; takto vypadne len
 * moment (oslava potom len prepne farby, ako pri zníženom pohybe). Kto
 * potrebuje pružiny hneď (testy), počká na `pripravene`.
 */
let PRESETS, springStep, settleTime, track, ink, paintInk, cover, presence, applyPresence, driver;
let pohyb = null;
export const pripravene = import('../motion/src/core.js').then((m) => {
  ({ PRESETS, springStep, settleTime, track, ink, paintInk, cover, presence, applyPresence, driver } = m);
  const chyba = ['springStep', 'settleTime', 'track', 'ink', 'paintInk', 'cover', 'presence', 'applyPresence', 'driver'].find((k) => typeof m[k] !== 'function');
  if (chyba || !PRESETS || !PRESETS.morph || !PRESETS.press || !PRESETS.enter || !PRESETS.exit) return false;
  pohyb = m;
  return true;
}, () => false);

/* Jedna tabuľka všetkých časov (ms). Začiatky do 900 ms (strop oslavy),
 * trvania do 400 ms; pri pružinách viditeľná časť (95 %) do 400 ms. */
export const CASY = Object.freeze({
  ramik: Object.freeze({ od: 0, trvanie: 120 }),
  atrament: Object.freeze({ od: 40, pruzina: 'morph' }),
  vlna: Object.freeze({ od: 40, strop: 600 }),
  dosadnutie: Object.freeze({ trvanie: 240, vrchol: 1.15 }),
  veta: Object.freeze({ od: 700, pruzina: 'enter' }),
  pocitadlo: Object.freeze({ od: 700, trvanie: 400 }),
  karta: Object.freeze({ od: 900, pruzina: 'enter' }),
  zmiznutie: Object.freeze({ od: 900, pruzina: 'exit' }),
  preskocenie: Object.freeze({ od: 400 }),
});

const ALFA_ATRAMENTU = 0.08;
/* Veta len stmavne do plnej farby, bez posunu: #stav sleduje hra-ui.js
 * (IntersectionObserver lišty), posun by lištu zbytočne prepínal. */
const POSUN_VETY = 0;
const POSUN_KARTY = 14;        // px zdola
const MIERKA_KARTY = 0.94;
/* Dosadnutie ako dva kroky pružiny press: hore k 1,2 a po 60 ms späť k 1.
 * Vrchol vyjde 1,15 v 66 ms, ku koncu 240 ms je späť na 1 (test 6b). */
const DOSADNUTIE_CIEL = 1.2;
const DOSADNUTIE_SPAT = 0.06;
const KROKY_KRIVKY = 20;       // zastávky po 5 % v @keyframes oslava-dosadni

/* ── Čisté funkcie (testuje ops/games/oslava.test.mjs) ────────────────── */

/* Čas v ms od začiatku atramentu, keď jeho čelo dosiahne podiel p polomeru:
 * prvý čas, keď springStep(morph) dosiahne p (krok pružiny rastie až po
 * prvý vrchol, takže prvé prekročenie je jediné). */
function casCela(p) {
  if (p <= 0) return 0;
  const sp = PRESETS[CASY.atrament.pruzina];
  let hore = 0.01;
  while (springStep(sp, hore) < p && hore < 3) hore += 0.01;
  let dole = hore - 0.01;
  for (let i = 0; i < 30; i++) {
    const s = (dole + hore) / 2;
    if (springStep(sp, s) < p) dole = s; else hore = s;
  }
  return Math.min(CASY.vlna.strop, hore * 1000);
}
const naDesatiny = (x) => Math.round(x * 10) / 10;

/* Časová os oslavy pre dosku sirka x vyska.
 *   bunky      stredy značiek na doske, [{ x, y }]
 *   posledna   index do bunky, bod { x, y } alebo nič (stred dosky)
 * Vráti oneskorenia vlny v ms od jej začiatku (CASY.vlna.od), začiatky vety a
 * karty v ms od T0, atrament (bod a polomer) a odkedy sa smie preskočiť. */
export function casovaOs({ bunky = [], posledna = null, sirka = 0, vyska = 0, redukovany = false } = {}) {
  const n = bunky.length;
  if (redukovany) {
    return { oneskorenia: new Array(n).fill(0), koniecVlny: 0, ramik: 0, veta: 0, karta: 0, zmiznutie: 0, atrament: null, preskocenie: 0 };
  }
  let O;
  if (typeof posledna === 'number' && bunky[posledna]) O = bunky[posledna];
  else if (posledna && Number.isFinite(posledna.x) && Number.isFinite(posledna.y)) O = posledna;
  else O = { x: sirka / 2, y: vyska / 2 };
  const R = Math.max(1, cover(O.x, O.y, sirka, vyska));
  const oneskorenia = bunky.map((b) => naDesatiny(casCela(Math.min(1, Math.hypot(b.x - O.x, b.y - O.y) / R))));
  const najviac = n ? Math.max(...oneskorenia) : 0;
  return {
    oneskorenia,
    koniecVlny: CASY.vlna.od + najviac,
    ramik: CASY.ramik.od,
    veta: CASY.veta.od,
    karta: CASY.karta.od,
    zmiznutie: CASY.zmiznutie.od,
    atrament: { od: CASY.atrament.od, x: O.x, y: O.y, R },
    preskocenie: CASY.preskocenie.od,
  };
}

/* Ťuk skočí na koniec až od CASY.preskocenie, aby ťuk, ktorý hru vyriešil,
 * alebo ten hneď po ňom oslavu nezmazal (ako SkipGate v Dueli). */
export function smiePreskocit(os, ms) {
  return !!os && os.preskocenie > 0 && ms >= os.preskocenie;
}

/* Krivka dosadnutia značky pre @keyframes oslava-dosadni v hra.css:
 * [[podiel času, mierka]], z pružiny press v core.js. */
export function krivkaDosadnutia(kroky = KROKY_KRIVKY) {
  const sp = PRESETS.press;
  const t = track(1, sp).to(0, DOSADNUTIE_CIEL).to(DOSADNUTIE_SPAT, 1);
  const T = CASY.dosadnutie.trvanie / 1000;
  const out = [];
  for (let k = 0; k <= kroky; k++) {
    const x = k / kroky;
    const s = k === 0 || k === kroky ? 1 : Math.round(t.at(x * T) * 10000) / 10000;
    out.push([x, s]);
  }
  return out;
}

/* Čas, ktorý sa dopočítava od nuly: rastie a nikdy necúva, bez prekmitu. */
export function hodnotaPocitadla(ciel, ms) {
  const x = Math.max(0, Math.min(1, ms / CASY.pocitadlo.trvanie));
  if (x >= 1) return ciel;
  return Math.min(ciel, Math.round(ciel * (1 - Math.pow(1 - x, 3))));
}

/* Rovnaký zápis času ako v hrách: 4:37, 1:02:05. */
export function formatCas(sek) {
  const h = Math.floor(sek / 3600), m = Math.floor((sek % 3600) / 60), s = sek % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
}
function naSekundy(text) {
  if (typeof text !== 'string' || !/^\d+(:\d{2}){1,2}$/.test(text)) return null;
  return text.split(':').reduce((a, x) => a * 60 + Number(x), 0);
}

/* Koľko z plochy (obdĺžnik x0, y0, x1, y1) má kruh s polomerom r z bodu O
 * za sebou: 0, kým ju čelo nedosiahne, 1, keď prejde jej najvzdialenejší roh,
 * medzi tým rovnomerne podľa polomeru. */
export function podielPlochy(r, blizko, daleko) {
  if (!(r > blizko)) return 0;
  if (r >= daleko) return 1;
  return Math.max(0, Math.min(1, (r - blizko) / Math.max(1, daleko - blizko)));
}
function vzdialenostiPlochy(O, x0, y0, x1, y1) {
  const dx = Math.max(x0 - O.x, 0, O.x - x1), dy = Math.max(y0 - O.y, 0, O.y - y1);
  const daleko = Math.max(Math.hypot(x0 - O.x, y0 - O.y), Math.hypot(x1 - O.x, y0 - O.y), Math.hypot(x0 - O.x, y1 - O.y), Math.hypot(x1 - O.x, y1 - O.y));
  return { blizko: Math.hypot(dx, dy), daleko };
}

/* ── Odkiaľ atrament ──────────────────────────────────────────────────── *
 * Atrament ide z bunky, ktorú zmenil ťah, ktorý hru vyriešil (M-plán A:
 * „z poslednej bunky“), nech bol ťukom, ťahom prsta (Herons, Swans, Otters,
 * Cranes), klávesom, druhým stlačením Hint alebo padom s číslami:
 *   1. MutationObserver na #doska zapisuje zmeny značiek (data-v, data-x,
 *      data-p, d, obsah bunky); oslava ich prečíta synchrónne (takeRecords),
 *      takže sú to presne zmeny ťahu, ktorý ju spustil. Počíta sa len zmena
 *      značky (prvok zo znacky alebo prvok v nej), nikdy plocha (voda v
 *      slučke Otters a Swans) ani jej rodič: voda sa pri ťahu prekreslí
 *      celá a jej stred nie je miesto ťahu (kontrola 2, nález 3). Z nich
 *      platí tá, ktorá je najbližšie k prstu alebo fokusu (bod 2), inak
 *      prvá; zmena na tú istú hodnotu a prvok, ktorý nie je vidieť, sa
 *      nepočítajú.
 *   2. Keď zmenu nevidno (žiadna, alebo prehliadač bez MutationObserver):
 *      posledná poloha prsta alebo myši na doske (stlačenie, ťah so stlačeným
 *      tlačidlom, pustenie) alebo prvok s fokusom na doske po klávese, podľa
 *      toho, čo bolo neskôr. Ťuk mimo dosky (Hint, pad) bod na doske neprepíše.
 *      Bod sa zapíše voči doske v chvíli dotyku, takže posun stránky medzi
 *      ťukom na bunku a číslom z padu ho neposunie (kontrola 2, nález 8).
 *   3. Inak stred dosky.
 * Všetko len číta, pasívne, v zachytávacej fáze; hre nič neberie. */
const ATRIBUTY_ZNACIEK = ['data-v', 'data-x', 'data-p', 'd'];
let poradie = 0;
let dotyk = null;     // { doska, x, y, n }: x a y v px voči doske v chvíli dotyku
let klaves = null;    // { n }
let pozorovatel = null;
let sledovana = null;
function sledujDosku() {
  if (sledovana || typeof MutationObserver !== 'function' || typeof document === 'undefined' || !document || typeof document.getElementById !== 'function') return;
  const d = document.getElementById('doska');
  if (!d) return;
  try {
    // Záznamy číta len oslava (takeRecords); spätné volanie ich zahodí.
    const mo = new MutationObserver(() => {});
    mo.observe(d, { subtree: true, childList: true, characterData: true, attributes: true, attributeOldValue: true, attributeFilter: ATRIBUTY_ZNACIEK });
    pozorovatel = mo;
    sledovana = d;
  } catch (e) { /* the pointer still tells where */ }
}
if (typeof document !== 'undefined' && document && typeof document.addEventListener === 'function') {
  const moznosti = { capture: true, passive: true };
  const zapis = (e) => {
    const ciel = e && e.target;
    const d = ciel && typeof ciel.closest === 'function' ? ciel.closest('#doska, .doska') : null;
    if (!d || !Number.isFinite(e.clientX) || !Number.isFinite(e.clientY) || typeof d.getBoundingClientRect !== 'function') return;
    let r = null;
    try { r = d.getBoundingClientRect(); } catch (err) { return; }
    // Voči doske teraz, nie v súradniciach okna (kontrola 2, nález 8).
    dotyk = { doska: d, x: e.clientX - r.left, y: e.clientY - r.top, n: ++poradie };
  };
  document.addEventListener('pointerdown', (e) => { sledujDosku(); zapis(e); }, moznosti);
  // Ťah: hra sa vyrieši uprostred ťahu (Herons, Swans) alebo pri pustení
  // (Cranes), preto platí posledná poloha prsta, nie miesto, kde ťah začal.
  document.addEventListener('pointermove', (e) => { if (e && e.buttons) zapis(e); }, moznosti);
  document.addEventListener('pointerup', zapis, moznosti);
  document.addEventListener('keydown', () => { sledujDosku(); klaves = { n: ++poradie }; }, moznosti);
  sledujDosku();
}

/* ── Oslava nad DOM ───────────────────────────────────────────────────── */
const bezia = new WeakMap();   // doska → koniec práve bežiacej oslavy

function jeDoska(el) {
  return !!el && (el.id === 'doska' || (el.classList && typeof el.classList.contains === 'function' && el.classList.contains('doska')));
}
function obsahuje(a, b) {
  return !!a && !!b && (a === b || (typeof a.contains === 'function' && a.contains(b)));
}
function stredPrvku(el, rD) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2 - rD.left, y: r.top + r.height / 2 - rD.top };
}
function sedi(el, sel) {
  if (!sel) return true;
  try { return typeof el.matches === 'function' && el.matches(sel); } catch (e) { return false; }
}
function styl(el) {
  try { return typeof getComputedStyle === 'function' ? getComputedStyle(el) : null; } catch (e) { return null; }
}
const px = (x) => Math.round(x * 100) / 100 + 'px';
const ms = (x) => Math.round(x * 10) / 10 + 'ms';
const orez = (x, a, b) => Math.max(a, Math.min(b, x));

/* Farba atramentu: --ok stránky s alfou 0,08. */
function farbaAtramentu(doska) {
  const s = styl(doska);
  const v = s && typeof s.getPropertyValue === 'function' ? String(s.getPropertyValue('--ok') || '').trim() : '';
  let r = 94, g = 207, b = 154;
  const hex = /^#([0-9a-f]{6})$/i.exec(v);
  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(v);
  if (hex) { r = parseInt(hex[1].slice(0, 2), 16); g = parseInt(hex[1].slice(2, 4), 16); b = parseInt(hex[1].slice(4, 6), 16); }
  else if (rgb) { r = +rgb[1]; g = +rgb[2]; b = +rgb[3]; }
  return 'rgba(' + r + ',' + g + ',' + b + ',' + ALFA_ATRAMENTU + ')';
}

/* Značky, ktoré zmenil ťah, ktorý práve hru vyriešil (bod 1 vyššie), v
 * poradí zmien. Zmena na tú istú hodnotu (hra prekresľuje celú dosku) sa
 * nepočíta, ani prvok, ktorý nie je vidieť (hrana, ktorú ťah zmazal).
 * Kandidát je vždy značka zo znacky (prvok sám alebo značka, v ktorej je);
 * zmena mimo značiek, plocha a jej rodič (skupina vody Otters, ktorej hra
 * prepíše obsah) sa nepočítajú (kontrola 2, nález 3). */
const NAJVIAC_ZMIEN = 64;
function zmenyTahu(doska, znacky = [], plochy = []) {
  if (!pozorovatel || !sledovana) return [];
  let zaznamy = [];
  try { zaznamy = pozorovatel.takeRecords() || []; } catch (e) { return []; }
  if (!obsahuje(doska, sledovana) && !obsahuje(sledovana, doska)) return [];
  const mnozina = new Set(znacky);
  const out = [];
  for (const z of zaznamy) {
    let el = z && z.target;
    if (!el) continue;
    if (z.type === 'attributes') {
      try { if (el.getAttribute(z.attributeName) === z.oldValue) continue; } catch (e) { continue; }
    } else if (z.type === 'characterData') {
      el = el.parentNode;
    } else if (z.type === 'childList') {
      if (!(z.addedNodes && z.addedNodes.length) && !(z.removedNodes && z.removedNodes.length)) continue;
    }
    if (!el || el.nodeType !== 1 || el === doska || el === sledovana || typeof el.getBoundingClientRect !== 'function') continue;
    if (!obsahuje(doska, el)) continue;
    // Plocha alebo prvok, ktorý nejakú plochu obsahuje (jej skupina): nikdy.
    if (plochy.some((p) => obsahuje(el, p))) continue;
    let znacka = null;
    for (let x = el; x && x !== doska; x = x.parentNode) if (mnozina.has(x)) { znacka = x; break; }
    if (!znacka || out.includes(znacka)) continue;
    const r = el.getBoundingClientRect();
    if (!(r.width > 0 || r.height > 0)) continue;
    out.push(znacka);
    if (out.length >= NAJVIAC_ZMIEN) break;
  }
  return out;
}

/* Bod, odkiaľ sa rozleje atrament (poradie v „Odkiaľ atrament“). Keď ťah
 * zmenil viac značiek (automatické bodky a krížiky, Hint na viac buniek),
 * platí tá, ktorá je najbližšie k prstu alebo fokusu; inak prvá zmenená. */
function povod(doska, rD, volby, znacky, plochy) {
  const p = volby.posledna;
  if (typeof p === 'number' && znacky[p]) return p;
  if (p && typeof p.getBoundingClientRect === 'function') return stredPrvku(p, rD);
  if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) return { x: p.x, y: p.y };
  const zmenene = zmenyTahu(doska, znacky, plochy);
  const bod = bodVstupu(doska, rD);
  if (!zmenene.length) return bod;
  let naj = stredPrvku(zmenene[0], rD);
  if (!bod) return naj;
  let najD = Math.hypot(naj.x - bod.x, naj.y - bod.y);
  for (const el of zmenene.slice(1)) {
    const s = stredPrvku(el, rD);
    const d = Math.hypot(s.x - bod.x, s.y - bod.y);
    if (d < najD) { najD = d; naj = s; }
  }
  return naj;
}
/* Posledná poloha prsta alebo myši na doske, alebo fokus klávesnice na nej,
 * podľa toho, čo bolo neskôr (bod 2 v „Odkiaľ atrament“). */
function bodVstupu(doska, rD) {
  const akt = document.activeElement;
  const fokusNaDoske = !!akt && akt !== doska && obsahuje(doska, akt) && typeof akt.getBoundingClientRect === 'function';
  const dotykTu = !!dotyk && (obsahuje(doska, dotyk.doska) || obsahuje(dotyk.doska, doska));
  const klavesNovsi = !!klaves && (!dotykTu || klaves.n > dotyk.n);
  if (fokusNaDoske && klavesNovsi) return stredPrvku(akt, rD);
  if (dotykTu) {
    // Bod je voči prvku, na ktorý prst ťukol (doska alebo doska v nej); keď
    // je to iný prvok než táto doska, pripočíta sa ich dnešný odstup.
    let dx = 0, dy = 0;
    if (dotyk.doska !== doska && typeof dotyk.doska.getBoundingClientRect === 'function') {
      try { const r = dotyk.doska.getBoundingClientRect(); dx = r.left - rD.left; dy = r.top - rD.top; } catch (e) { dx = 0; dy = 0; }
    }
    // Prst mohol pri ťahu s pointer capture zísť za okraj dosky: bod na doske.
    return { x: orez(dotyk.x + dx, 0, rD.width), y: orez(dotyk.y + dy, 0, rD.height) };
  }
  if (fokusNaDoske) return stredPrvku(akt, rD);
  return null;
}

/* Veta výsledku: čas v nej sa dopočíta. Číslo, ktoré sa mení, je pre
 * čítačku skryté a hneď vedľa je konečný čas, takže #stav (aria-live) oznámi
 * výsledok raz, nie každú snímku. Skrytie je aj priamo v štýle prvku, nielen
 * v hra.css: prehliadač môže mať 10 minút v pamäti starý hra.css. */
function pripravPocitadlo(veta, cas) {
  const ciel = naSekundy(cas);
  if (ciel === null || !veta) return null;
  const najdi = (uzol) => {
    for (const c of Array.from(uzol.childNodes || [])) {
      if (c.nodeType === 3) {
        const t = c.data || '';
        let i = t.indexOf(cas);
        while (i >= 0) {
          const pred = t.charAt(i - 1), po = t.charAt(i + cas.length);
          if (!/[\d:]/.test(pred) && !/[\d:]/.test(po)) return { uzol: c, i };
          i = t.indexOf(cas, i + 1);
        }
      } else if (c.nodeType === 1) {
        const r = najdi(c);
        if (r) return r;
      }
    }
    return null;
  };
  const kde = najdi(veta);
  if (!kde) return null;
  const { uzol, i } = kde;
  const rodic = uzol.parentNode;
  const obal = document.createElement('span');
  obal.className = 'oslava-cas';
  const pocet = document.createElement('span');
  pocet.className = 'oslava-pocet';
  pocet.setAttribute('aria-hidden', 'true');
  pocet.textContent = formatCas(0);
  const sr = document.createElement('span');
  sr.className = 'oslava-sr';
  const s = sr.style;
  s.position = 'absolute'; s.width = '1px'; s.height = '1px'; s.padding = '0'; s.margin = '-1px';
  s.overflow = 'hidden'; s.clipPath = 'inset(50%)'; s.whiteSpace = 'nowrap'; s.border = '0';
  sr.textContent = cas;
  obal.appendChild(pocet);
  obal.appendChild(sr);
  const t = uzol.data;
  if (i > 0) rodic.insertBefore(document.createTextNode(t.slice(0, i)), uzol);
  rodic.insertBefore(obal, uzol);
  if (i + cas.length < t.length) rodic.insertBefore(document.createTextNode(t.slice(i + cas.length)), uzol);
  rodic.removeChild(uzol);
  return { pocet, ciel, cas };
}

function ukazVetu(el, s) {
  el.style.opacity = String(Math.round(s.opacity * 1000) / 1000);
  el.style.transform = Math.abs(s.y) > 0.01 ? 'translateY(' + s.y.toFixed(2) + 'px)' : '';
}
function upracStyl(el, ...vlastnosti) {
  for (const v of vlastnosti) el.style[v] = '';
}
/* nahlad: jeden prvok alebo zoznam (náhľad karty a Share v lište). */
function zoznamPrvkov(x) {
  const zoznam = Array.isArray(x) ? x : [x];
  return zoznam.filter((el) => !!el && typeof el === 'object' && !!el.style);
}

export function oslava(doska, volby = {}) {
  if (typeof document === 'undefined' || !document || !doska || typeof doska !== 'object') return null;
  if (!jeDoska(doska)) {
    const vnutri = typeof doska.querySelector === 'function' ? doska.querySelector('#doska') : null;
    if (!vnutri) return null;
    doska = vnutri;
  }
  if (bezia.has(doska)) bezia.get(doska)();
  volby = volby || {};
  if (volby.redukovany || !pohyb) {
    // Nič sa neskrýva a nič sa nehýbe; farby prepla hra triedou hotovo.
    // Rovnako, keď sa pružiny z motion nenačítali (súbor chýba, zlý export).
    // Zmeny ťahu sa zahodia, aby ich neskoršia oslava nečítala.
    if (pozorovatel) { try { pozorovatel.takeRecords(); } catch (e) { /* nothing */ } }
    doska.classList.add('hotovo');
    return { preskoc() {}, redukovany: true };
  }
  try {
    return spusti(doska, volby);
  } catch (e) {
    // Oslava nikdy nezastaví hru ani neschová výsledok: späť do stavu
    // vyriešeného dňa, ako keď sa otvorí znova.
    zachran(doska, volby);
    return null;
  }
}

function zachran(doska, volby) {
  const bez = (f) => { try { f(); } catch (e) { /* the next step still runs */ } };
  bez(() => bezia.delete(doska));
  bez(() => { const obal = doska.parentElement; if (obal) for (const el of Array.from(obal.querySelectorAll('.oslava-atrament'))) el.remove(); });
  bez(() => doska.classList.remove('oslava-vlna'));
  bez(() => doska.style.removeProperty('--oslava-t'));
  bez(() => {
    for (const el of Array.from(volby.znacky || [])) {
      el.style.removeProperty('--oslava-d');
      el.classList.remove('oslava-z', 'oslava-za');
      for (const x of Array.from(el.querySelectorAll ? el.querySelectorAll('.oslava-z') : [])) x.classList.remove('oslava-z');
    }
  });
  bez(() => { for (const el of Array.from(volby.plochy || [])) el.style.removeProperty('fill-opacity'); });
  bez(() => { if (volby.veta) upracStyl(volby.veta, 'opacity', 'transform'); });
  bez(() => { for (const el of zoznamPrvkov(volby.nahlad)) upracStyl(el, 'opacity', 'transform', 'visibility', 'filter'); });
  bez(() => doska.classList.add('hotovo'));
}

function spusti(doska, volby) {
  const veta = volby.veta || null;
  const nahlady = zoznamPrvkov(volby.nahlad);
  const hodiny = typeof volby.hodiny === 'function' ? volby.hodiny
    : () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
  const T0 = hodiny();
  const znacky = Array.from(volby.znacky || []).filter((el) => el && typeof el.getBoundingClientRect === 'function');
  const plochy = Array.from(volby.plochy || []).filter((el) => el && el.style && typeof el.getBoundingClientRect === 'function');
  let hotovo = false;   // skôr než čokoľvek, čo sa zavolá neskôr (ResizeObserver, mikroúloha)

  // 1. Doska na chvíľu bez triedy hotovo: meranie, oneskorenia, prechody.
  doska.classList.remove('hotovo');
  const rD = doska.getBoundingClientRect();
  const stredy = znacky.map((el) => stredPrvku(el, rD));
  const os = casovaOs({ bunky: stredy, posledna: povod(doska, rD, volby, znacky, plochy), sirka: rD.width, vyska: rD.height });
  const pop = volby.pop || null;
  const popnute = [];
  znacky.forEach((el, i) => {
    el.style.setProperty('--oslava-d', ms(CASY.vlna.od + os.oneskorenia[i]));
    if (!pop || !sedi(el, pop.kto)) return;
    if (pop.co === '::after') { el.classList.add('oslava-za'); popnute.push([el, 'oslava-za']); return; }
    let ciele = [el];
    if (pop.co) { try { ciele = Array.from(el.querySelectorAll(pop.co)); } catch (e) { ciele = []; } }
    for (const c of ciele) { c.classList.add('oslava-z'); popnute.push([c, 'oslava-z']); }
  });
  // Plochy (voda v slučke): priehľadné, kým ich čelo atramentu neprejde.
  const O = os.atrament;
  const plochyStav = O ? plochy.map((el) => {
    const r = el.getBoundingClientRect();
    const x0 = r.left - rD.left, y0 = r.top - rD.top;
    const { blizko, daleko } = vzdialenostiPlochy(O, x0, y0, x0 + r.width, y0 + r.height);
    el.style.setProperty('fill-opacity', '0');
    return { el, blizko, daleko, q: 0 };
  }) : [];
  doska.style.setProperty('--oslava-t', CASY.dosadnutie.trvanie + 'ms');
  doska.classList.add('oslava-vlna');
  // Štýl s prechodmi a ešte starými farbami, až potom hotovo: farby sa
  // prepnú každá vo svojom čase (transition-delay: var(--oslava-d)).
  void doska.getBoundingClientRect();
  doska.classList.add('hotovo');

  // 2. Atrament: vrstva nad doskou v jej ráme (vo vnútri okraja), ťuky ňou prejdú.
  let vrstva = null, kruh = null, obal = null, obalPoloha = null, atrament = null, zmiz = null, sledujRozmer = null;
  if (O && doska.parentElement) {
    obal = doska.parentElement;
    const rO = obal.getBoundingClientRect();
    const s = styl(doska);
    const hrana = (k) => (s ? parseFloat(s[k]) || 0 : 0);
    const bl = hrana('borderLeftWidth'), bt = hrana('borderTopWidth'), br = hrana('borderRightWidth'), bb = hrana('borderBottomWidth');
    vrstva = document.createElement('div');
    vrstva.className = 'oslava-atrament';
    vrstva.setAttribute('aria-hidden', 'true');
    const v = vrstva.style;
    v.position = 'absolute';
    const polozVrstvu = (rd, ro) => {
      v.left = px(rd.left - ro.left + bl);
      v.top = px(rd.top - ro.top + bt);
      v.width = px(Math.max(0, rd.width - bl - br));
      v.height = px(Math.max(0, rd.height - bt - bb));
    };
    polozVrstvu(rD, rO);
    // Vrstva drží dosku celý moment: keď sa doska počas vlny zmenší (lišta
    // pri prvom vyriešení narastie o riadok série a hra-ui.js prepočíta
    // šírku dosky), atrament z nej nevytŕča (kontrola 2, nález 4).
    if (typeof ResizeObserver === 'function') {
      try {
        sledujRozmer = new ResizeObserver(() => {
          // Po konci (aj po záchrane pri chybe, keď vrstva už nie je v stránke) sa odpojí.
          if (hotovo || !vrstva || !vrstva.parentNode) { try { sledujRozmer.disconnect(); } catch (e) { /* nothing */ } return; }
          try { polozVrstvu(doska.getBoundingClientRect(), obal.getBoundingClientRect()); } catch (e) { /* the layer keeps its size */ }
        });
        sledujRozmer.observe(doska);
      } catch (e) { sledujRozmer = null; }
    }
    v.borderRadius = px(Math.max(0, hrana('borderTopLeftRadius') - bl));
    v.overflow = 'hidden';
    v.pointerEvents = 'none';
    v.zIndex = '1';
    kruh = document.createElement('i');
    const k = kruh.style;
    k.position = 'absolute';
    k.left = '0'; k.top = '0'; k.right = '0'; k.bottom = '0';
    k.visibility = 'hidden';
    vrstva.appendChild(kruh);
    const so = styl(obal);
    if (so && so.position === 'static') { obalPoloha = obal.style.position || ''; obal.style.position = 'relative'; }
    obal.appendChild(vrstva);
    const t0 = T0 / 1000;
    atrament = ink('transparent').to(t0 + O.od / 1000, farbaAtramentu(doska), O.x - bl, O.y - bt, O.R);
    zmiz = track(1, PRESETS[CASY.zmiznutie.pruzina]).to(t0 + os.zmiznutie / 1000, 0);
  }

  // 3. Veta a karta čakajú; veta ostáva čitateľná pre čítačku (len priehľadnosť).
  const t0 = T0 / 1000;
  const pVeta = veta ? presence(false, { blur: 0, dyIn: POSUN_VETY, scaleFrom: 1 }).enter(t0 + os.veta / 1000, PRESETS[CASY.veta.pruzina]) : null;
  const pKarta = nahlady.length ? presence(false, { blur: 0, dyIn: POSUN_KARTY, scaleFrom: MIERKA_KARTY }).enter(t0 + os.karta / 1000, PRESETS[CASY.karta.pruzina]) : null;
  let pocitadlo = null;
  if (veta) {
    // Hra píše vetu hneď po návrate zo skontroluj(); čas v nej sa obalí potom.
    const zapis = () => { if (!hotovo) pocitadlo = pripravPocitadlo(veta, volby.cas); };
    if (typeof queueMicrotask === 'function') queueMicrotask(zapis); else Promise.resolve().then(zapis);
  }

  const koniec = t0 + Math.max(
    os.koniecVlny / 1000 + CASY.dosadnutie.trvanie / 1000,
    (CASY.pocitadlo.od + CASY.pocitadlo.trvanie) / 1000,
    os.veta / 1000 + settleTime(PRESETS[CASY.veta.pruzina]),
    os.karta / 1000 + settleTime(PRESETS[CASY.karta.pruzina]),
    os.zmiznutie / 1000 + settleTime(PRESETS[CASY.zmiznutie.pruzina]),
  );

  function kresli(t) {
    if (hotovo) return;
    try {
      if (vrstva) {
        paintInk(atrament.at(t, false, 1), vrstva, [kruh]);
        vrstva.style.opacity = String(Math.max(0, Math.min(1, Math.round(zmiz.at(t) * 1000) / 1000)));
      }
      if (plochyStav.length) {
        const r = O.R * springStep(PRESETS[CASY.atrament.pruzina], t - t0 - O.od / 1000);
        for (const p of plochyStav) {
          const q = Math.round(podielPlochy(r, p.blizko, p.daleko) * 100) / 100;
          if (q !== p.q) { p.q = q; p.el.style.setProperty('fill-opacity', String(q)); }
        }
      }
      if (pVeta) ukazVetu(veta, pVeta.at(t));
      if (pocitadlo) pocitadlo.pocet.textContent = formatCas(hodnotaPocitadla(pocitadlo.ciel, (t - t0) * 1000 - CASY.pocitadlo.od));
      if (pKarta) { const s = pKarta.at(t); for (const el of nahlady) applyPresence(el, s); }
    } catch (e) { dokonci(); return; }   // výsledok sa nikdy neschová, ani keď pohyb zlyhá
    if (t >= koniec) dokonci();
  }

  // Poistka: keď snímky nechodia (karta na pozadí, zlyhanie), koniec aj tak príde.
  const poistka = setTimeout(() => dokonci(), Math.ceil((koniec - t0) * 1000) + 600);

  function dokonci() {
    if (hotovo) return;
    hotovo = true;
    const bez = (f) => { try { f(); } catch (e) { /* the rest of the clean up still runs */ } };
    clearTimeout(poistka);
    bez(() => d.stop());
    bez(() => { if (sledujRozmer) sledujRozmer.disconnect(); });
    document.removeEventListener('pointerdown', preskoc, true);
    document.removeEventListener('keydown', preskoc, true);
    bezia.delete(doska);
    bez(() => { if (vrstva) vrstva.remove(); });
    bez(() => { if (obal && obalPoloha !== null) obal.style.position = obalPoloha; });
    bez(() => doska.classList.remove('oslava-vlna'));
    bez(() => doska.style.removeProperty('--oslava-t'));
    for (const el of znacky) bez(() => el.style.removeProperty('--oslava-d'));
    for (const [el, trieda] of popnute) bez(() => el.classList.remove(trieda));
    for (const p of plochyStav) bez(() => p.el.style.removeProperty('fill-opacity'));
    bez(() => doska.classList.add('hotovo'));
    bez(() => { if (veta) upracStyl(veta, 'opacity', 'transform'); });
    bez(() => { if (pocitadlo) pocitadlo.pocet.textContent = pocitadlo.cas; });
    for (const el of nahlady) bez(() => upracStyl(el, 'opacity', 'transform', 'visibility', 'filter'));
  }

  function preskoc() {
    if (smiePreskocit(os, hodiny() - T0)) dokonci();
  }

  const d = driver(kresli, { clock: () => hodiny() / 1000, reduced: false });
  d.busy = (t) => !hotovo && t < koniec + 0.05;
  document.addEventListener('pointerdown', preskoc, true);
  document.addEventListener('keydown', preskoc, true);
  bezia.set(doska, dokonci);
  kresli(t0);          // prvý stav hneď, bez bliknutia vety alebo karty
  d.kick();
  return { preskoc: dokonci, os };
}
