/* Dormice (mriežková dedukcia) pre knihu: celá strana zadania je jedno SVG.
 *
 * Prečo celá strana a nie len obrázok mriežky (ops/spec-hra-detektiv.md 6.2):
 * zadanie je próza (príbeh, obsadenie, číslovaný zoznam indícií) plus schodisko,
 * a keby prózu sádzalo HTML a mriežku SVG, museli by sa zmeniť `ram()`,
 * `rozvrh()` aj spoločná `sablona.html` a tlačená strana by sa mohla rozísť
 * s PDF. Takto ostáva zdieľaná rúra nedotknutá: `zadanie(p, f)` vracia jedno
 * SVG s pevným viewBoxom a `ram()` ho vloží presne tak, ako vkladá mriežku
 * ostatných desiatich hier.
 *
 * Cena je, že zalomenie textu robí tento súbor. Šírky znakov nie sú odhadnuté:
 * sú vyčítané z tabuľky `hmtx` našich písiem (ops/design/paper/fonts/
 * arling-serif.woff2 a arling-sans.woff2, cez fontTools) a prepočítané na em;
 * šírka číslice je navyše nameraná v Chrome, lebo sadzba ju berie tabuľkovú. K nameranej šírke sa pripočíta REZERVA, lebo kerning
 * (GPOS) tabuľka hmtx nepozná; `dormice-kniha.test.mjs` porovnáva náš odhad
 * s `getComputedTextLength()` v Chrome nad každým jedným riadkom strany.
 *
 * Pevný viewBox na úroveň (spec 6.2): `ram()` škáluje celé SVG vrátane písma,
 * takže keby viewBox rástol s počtom indícií, zadanie s trinástimi vetami by
 * bolo v tej istej knihe vysádzané menším písmom než zadanie s deviatimi.
 * Preto má každý formát pevný rám, každá úroveň pevne vyhradený textový blok
 * a `zadanie()` vyhodí výnimku, keď sa vysádzaný text do bloku nezmestí.
 * Jeden riadok navyše je dôvod na ďalší seed, nie na menšie písmo; edícia to
 * robí cez `zmestiSa()` v ops/puzzle-books/edicia.mjs.
 *
 * Jednotky sú zdieľané: S = 100 na políčko, TENKA a HRUBA zo spolocne.mjs,
 * písma sú tie zo sablona.html (Kniha Serif na prózu, Kniha Sans na štítky).
 * Pozor: `sablona.html` má pravidlo `.p text { font-family: 'Kniha Sans' }`,
 * a CSS pravidlo prebije prezentačný atribút, preto sa písmo zapisuje inline
 * cez style, nie cez atribút font-family.
 */
import { S, TENKA, HRUBA, STREDNA, obal, ciara, obdlznik, esc, c } from './spolocne.mjs';
import { textIndicie, NAZVY_KATEGORII, solveHuman } from '../../games/dormice/generator.mjs';

const SERIF = "'Kniha Serif',Georgia,serif";
const SANS = "'Kniha Sans',Arial,sans-serif";

/* ── Šírky znakov ────────────────────────────────────────────────────── *
 * Postup zberu (17. 9. 2026): fontTools otvorí woff2, instancer ho ustáli na
 * wght 400 (resp. 600 pre serif tučný a 700 pre sans tučný), a pre kódy 32 až
 * 126 sa vyčíta hmtx delené unitsPerEm. Čísla sú v tisícinách em. */
const SIRKY = {
  serif: [
    233, 289, 356, 526, 500, 880, 720, 183, 339, 339, 439, 530, 300, 312, 300, 330,
    500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 300, 300, 530, 530, 530, 416,
    835, 664, 629, 631, 710, 603, 579, 682, 788, 371, 374, 667, 596, 902, 735, 707,
    589, 707, 651, 512, 604, 727, 674, 962, 648, 633, 551, 320, 330, 320, 531, 512,
    400, 509, 577, 488, 567, 510, 354, 518, 601, 298, 277, 547, 298, 901, 606, 549,
    583, 557, 423, 434, 325, 583, 505, 764, 526, 512, 456, 344, 291, 344, 530,
  ],
  serifTucne: [
    224, 316, 398, 545, 520, 883, 720, 207, 357, 357, 435, 537, 300, 325, 300, 356,
    520, 520, 520, 520, 520, 520, 520, 520, 520, 520, 300, 300, 537, 537, 537, 431,
    861, 669, 639, 627, 708, 599, 579, 679, 777, 379, 384, 681, 589, 899, 732, 705,
    600, 705, 666, 526, 618, 729, 668, 971, 651, 629, 557, 333, 356, 333, 537, 525,
    400, 519, 592, 500, 580, 515, 358, 530, 609, 307, 291, 571, 310, 904, 611, 557,
    596, 569, 443, 444, 341, 594, 515, 776, 538, 522, 460, 341, 301, 341, 537,
  ],
  sans: [
    254, 240, 353, 654, 564, 850, 686, 199, 309, 309, 443, 635, 265, 488, 280, 444,
    611, 343, 572, 576, 584, 580, 595, 531, 579, 594, 280, 268, 635, 635, 635, 529,
    885, 700, 644, 703, 697, 585, 560, 718, 720, 354, 536, 660, 545, 868, 728, 770,
    615, 770, 633, 613, 644, 673, 678, 935, 652, 623, 595, 310, 444, 310, 635, 500,
    500, 551, 589, 551, 589, 573, 341, 555, 567, 242, 272, 552, 262, 873, 581, 597,
    590, 590, 401, 513, 340, 581, 554, 812, 559, 548, 504, 327, 239, 327, 635,
  ],
  sansTucne: [
    210, 281, 400, 719, 600, 911, 695, 221, 348, 348, 406, 635, 292, 463, 304, 480,
    632, 404, 597, 602, 627, 616, 616, 568, 612, 617, 304, 296, 635, 635, 635, 564,
    922, 738, 679, 717, 736, 606, 584, 730, 753, 426, 589, 726, 579, 936, 768, 768,
    672, 768, 689, 648, 689, 718, 714, 1008, 735, 659, 634, 362, 480, 362, 635, 500,
    500, 596, 628, 582, 627, 597, 370, 579, 604, 284, 303, 607, 298, 913, 617, 611,
    628, 628, 458, 544, 380, 617, 604, 880, 606, 609, 542, 360, 273, 359, 635,
  ],
};
/* Rezerva na kerning a na zaokrúhlenie: 2,5 percenta. Test v Chrome overuje,
   že odhad je nad nameranou dĺžkou každého riadka, nie pod ňou. */
export const REZERVA = 1.025;

/* `sablona.html` nastavuje `.p text { font-variant-numeric: tabular-nums }`,
   takže všetky číslice majú v sadzbe jednu šírku, nie svoju vlastnú, a tá
   šírka v tabuľke hmtx nie je. Namerané v Chrome nad stranou knihy, kde sú
   písma naozaj načítané (`getComputedTextLength` pri font-size 1000):
   Kniha Serif 500 pri oboch rezoch, Kniha Sans 634,77 pri oboch rezoch.
   Tučný serif necháva 520 z tabuľky, lebo Kniha Serif nemá HVAR a Chrome pri
   font-weight 700 kreslí šírky základného rezu; nadhodnotenie je bezpečné,
   podhodnotenie by pustilo riadok cez stĺpec. */
const CISLICA = { serif: 500, serifTucne: 520, sans: 635, sansTucne: 635 };
export function sirkaTextu(retazec, velkost, pismo = 'serif') {
  const meno = SIRKY[pismo] ? pismo : 'serif';
  const tab = SIRKY[meno];
  let em = 0;
  const s = String(retazec);
  for (let i = 0; i < s.length; i++) {
    const k = s.charCodeAt(i);
    if (k >= 48 && k <= 57) { em += CISLICA[meno]; continue; }
    // Znak mimo ASCII sa počíta ako najširší znak písma: radšej zalomiť skôr.
    em += (k >= 32 && k <= 126) ? tab[k - 32] : 1000;
  }
  return (em / 1000) * velkost * REZERVA;
}

/* Hladké zalomenie po slovách. Slovo, ktoré je samo širšie ako blok, dostane
   vlastný riadok a `presah` sa zapne: taká strana sa odmieta, nesádže. */
export function zalom(retazec, sirka, velkost, pismo = 'serif') {
  const slova = String(retazec).split(/\s+/).filter(Boolean);
  const riadky = [];
  let presah = false;
  let akt = '';
  for (const w of slova) {
    const skus = akt ? akt + ' ' + w : w;
    if (akt && sirkaTextu(skus, velkost, pismo) > sirka) {
      riadky.push(akt);
      akt = w;
    } else akt = skus;
    if (!akt.includes(' ') && sirkaTextu(akt, velkost, pismo) > sirka) presah = true;
  }
  if (akt) riadky.push(akt);
  return { riadky, presah };
}

/* ── Text do SVG ─────────────────────────────────────────────────────── *
 * Každý riadok nesie `data-odhad`: šírku, ktorú mu prisúdila naša tabuľka.
 * Nie je to dekorácia, je to to jediné, čo sa dá v Chrome porovnať
 * s `getComputedTextLength()`, a `dormice-kniha.test.mjs` to robí nad každým
 * riadkom každej strany. Keby bol odhad pod nameranou dĺžkou, riadok by
 * v tlači prešiel cez svoj stĺpec a nikto by sa to nedozvedel. */
export function pismoKluc(o = {}) {
  return (o.sans ? 'sans' : 'serif') + (o.tucne ? 'Tucne' : '');
}
function txt(x, y, s, velkost, o = {}) {
  const pismo = o.sans ? SANS : SERIF;
  const odhad = sirkaTextu(s, velkost, pismoKluc(o)) + (o.medzera ? o.medzera * String(s).length : 0);
  return '<text data-odhad="' + c(odhad) + '" x="' + c(x) + '" y="' + c(y) + '" font-size="' + c(velkost) + '"'
    + ' text-anchor="' + (o.kotva || 'start') + '" dominant-baseline="' + (o.zaklad || 'central') + '"'
    + ' fill="' + (o.farba || '#000') + '"'
    + (o.tucne ? ' font-weight="700"' : '')
    + (o.medzera ? ' letter-spacing="' + c(o.medzera) + '"' : '')
    + (o.otoc ? ' transform="rotate(-90 ' + c(x) + ' ' + c(y) + ')"' : '')
    + ' style="font-family:' + pismo + '">' + esc(s) + '</text>';
}

/* ── Rámy strán ──────────────────────────────────────────────────────── *
 * Rám je pevný na formát: šírka v jednotkách je zvolená tak, aby na A4 a na
 * Letter vyšlo políčko schodiska nad 6 mm, výška je dopočítaná z pomeru
 * obsahovej plochy mínus hlavička, päta a odstup, aby `ram()` nenechal na
 * strane pásy.
 *
 * Výpočet výšky: h = w * (obsahVyska(f) - HLAVA - päta - ODSTUP - 2) / obsahSirka(f).
 *   a4      176 x 246,5 mm   -> 2200 x 3081
 *   letter  181,9 x 228,9 mm -> 2200 x 2768
 *   kdp     127 x 191,7 mm   -> 1800 x 2717   (vnútorný okraj 12,7 mm, kniha do 100 strán)
 *   eink    141 x 182,5 mm   -> 1800 x 2330
 * Dva stĺpce indícií na A4 a Letter, jeden na 6 x 9 a na e-inku (spec 6.2).
 *
 * `blok` je pevne vyhradená výška textu, rovnaká pre všetky úrovne toho
 * formátu, takže sadzba prózy vyzerá na každej strane knihy rovnako. Hrana
 * políčka schodiska je zvyšok rámu delený počtom riadkov schodiska, teda je
 * pevná na dvojicu (formát, úroveň) a stranu vyplní. Namerané:
 *
 *   formát   blok        políčko easy (k 3, N 5)   políčko ostatné (k 4, N 4)
 *   a4       1564 = 125 mm   103 jednotiek = 8,26 mm    88 jednotiek = 7,04 mm
 *   letter   1452 = 120 mm    87 jednotiek = 7,18 mm    74 jednotiek = 6,12 mm
 *   kdp      1569 = 111 mm    73 jednotiek = 5,13 mm    62 jednotiek = 4,37 mm
 *   eink     1459 = 114 mm    49 jednotiek = 3,86 mm    42 jednotiek = 3,29 mm
 *
 * A4 aj Letter sú nad hranicou 6 mm, pri ktorej sa podľa komentára pri
 * `naStranu` v postav.mjs v tlači zlievajú znaky, a to sú tie dve PDF, ktoré
 * sa predávajú. Na 6 x 9 KDP (127 x 192 mm) a na e-inku (141 x 182 mm) hrana
 * pod hranicu klesá: strana tej veľkosti neunesie príbeh, obsadenie, jedenásť
 * indícií a schodisko trinásť a pol políčka vysoké naraz. Je to meranie, nie
 * odhad, a je to odchýlka od tabuľky v spec 6.2, ktorá sama hovorí, že je
 * výpočet, nie dôkaz.
 *
 * 6 x 9 nie je vec nastavenia `blok`, je to aritmetika (prepočítané nad
 * zadania.json štyroch edícií Dormice, 200 zadaní plus štyri príklady):
 *   výška rámu kdp                      2717 jednotiek
 *   otázka a riadok na doplnenie         167,92
 *   schodisko pri k = 4                  13,55 políčka
 *   milimeter                            1800 / 127 = 14,17 jednotky
 * Aj keby bol textový blok nulový a medzery okolo schodiska nulové, ostane
 * 2549,08 jednotky, teda políčko 2549,08 / 13,55 = 188,1 jednotky. Lenže
 * najdlhší vysádzaný text tých 204 zadaní má na kdp 1410 jednotiek, takže
 * reálne ostáva 1139,08 a políčko je 84,06 jednotky = 5,93 mm, aj pri nulových
 * medzerách. Hranicu 6 mm teda 6 x 9 pri tejto strane nedosiahne nijako.
 * Preto edície Dormice 6 x 9 interiér ani obálku nevyrábajú (`kdp: false`
 * v edicie-dormice.mjs) a rám tu ostáva len preto, aby zdieľaná rúra nespadla
 * a aby sa to číslo dalo kedykoľvek znova zmerať.
 */
export const RAMY = Object.freeze({
  a4: Object.freeze({ id: 'a4', w: 2200, h: 3081, stlpce: 2, telo: 44, titul: 62, mini: 36, blok: 1564 }),
  letter: Object.freeze({ id: 'letter', w: 2200, h: 2768, stlpce: 2, telo: 40, titul: 57, mini: 33, blok: 1452 }),
  kdp: Object.freeze({ id: 'kdp', w: 1800, h: 2717, stlpce: 1, telo: 38, titul: 54, mini: 32, blok: 1569 }),
  eink: Object.freeze({ id: 'eink', w: 1800, h: 2330, stlpce: 1, telo: 36, titul: 51, mini: 30, blok: 1459 }),
});
export function ramPre(f) {
  const id = f && f.id;
  return RAMY[id] || RAMY.a4;
}

/* Zvislé medzery a odstupy v jednotkách rámu. */
const RIADOK = 1.42;      // násobok veľkosti písma
const MEDZERA_BLOK = 38;  // medzi blokmi strany
const MEDZERA_INDICIA = 15;
const ZLAB = 90;          // medzi dvoma stĺpcami indícií
const ODSADENIE = 62;     // visiace odsadenie čísla indície
const STITOK = 300;       // šírka štítka kategórie v obsadení
const PRED_MRIEZKOU = 70;
const ZA_MRIEZKOU = 70;

/* ── Schodisko ───────────────────────────────────────────────────────── *
 * Rovnaký tvar ako na stránke (products/arling-sk/games/dormice/plocha.mjs):
 * stĺpcové skupiny sú kategórie 1 az k-1, riadkové bloky 0 a potom k-1 dolu
 * po 2, a blok i siaha len po skupiny pred svojím zrkadlom. Názvy kategórií
 * riadkových blokov sú otočené v ľavom stĺpci, nie vo vlastnom riadku: riadok
 * navyše na každý blok by na A4 zjedol tri milimetre z políčka. */
const POPIS_PAS = 0.55;   // výška pásu s názvom kategórie nad stĺpcami
const POPIS_STLPEC = 0.78; // šírka pásu s otočeným názvom kategórie vľavo
const ZNAK_STLPEC = 1.12;  // šírka stĺpca s jednoznakmi

export function poradieStlpcov(k) { const o = []; for (let a = 1; a < k; a++) o.push(a); return o; }
export function poradieRiadkov(k) { const o = [0]; for (let a = k - 1; a >= 2; a--) o.push(a); return o; }
export function jeTabulka(k, i, j) { return i === 0 || j < k - 1 - i; }
export function jednoznak(p, a, i) {
  return p.cats[a].id === 'when' ? String(i + 1) : p.cats[a].items[i].charAt(0).toUpperCase();
}
export const mriezkaStlpcov = (p) => POPIS_STLPEC + ZNAK_STLPEC + (p.k - 1) * p.N;
export const mriezkaRiadkov = (p) => POPIS_PAS + 1 + (p.k - 1) * p.N;

function schodisko(p, x0, y0, P) {
  const k = p.k, N = p.N;
  const stlpce = poradieStlpcov(k), riadky = poradieRiadkov(k);
  const xs = x0 + (POPIS_STLPEC + ZNAK_STLPEC) * P;  // ľavý okraj prvej skupiny
  const ys = y0 + (POPIS_PAS + 1) * P;               // horný okraj prvého bloku
  const out = [];
  const znak = P * 0.46;
  const popis = P * 0.36;

  stlpce.forEach((a, j) => {
    const x = xs + j * N * P;
    out.push(obdlznik(x, y0, N * P, POPIS_PAS * P, '#fff'));
    out.push(txt(x + (N * P) / 2, y0 + (POPIS_PAS * P) / 2, p.cats[a].label.toUpperCase(), popis,
      { sans: true, kotva: 'middle', medzera: popis * 0.1 }));
    for (let y = 0; y < N; y++) {
      out.push(txt(x + y * P + P / 2, y0 + POPIS_PAS * P + P / 2, jednoznak(p, a, y), znak, { sans: true, kotva: 'middle' }));
    }
    out.push(obdlznik(x, y0 + POPIS_PAS * P, N * P, P, 'none', '#000', HRUBA));
    for (let y = 1; y < N; y++) out.push(ciara(x + y * P, y0 + POPIS_PAS * P, x + y * P, ys, TENKA));
  });

  riadky.forEach((a, i) => {
    const y = ys + i * N * P;
    const sirkaBloku = (i === 0 ? (k - 1) : (k - 1 - i)) * N * P;
    out.push(txt(x0 + (POPIS_STLPEC * P) / 2, y + (N * P) / 2, p.cats[a].label.toUpperCase(), popis,
      { sans: true, kotva: 'middle', medzera: popis * 0.1, otoc: true }));
    for (let x = 0; x < N; x++) {
      out.push(txt(x0 + POPIS_STLPEC * P + (ZNAK_STLPEC * P) / 2, y + x * P + P / 2, jednoznak(p, a, x), znak, { sans: true, kotva: 'middle' }));
    }
    out.push(obdlznik(x0 + POPIS_STLPEC * P, y, ZNAK_STLPEC * P, N * P, 'none', '#000', HRUBA));
    for (let x = 1; x < N; x++) {
      out.push(ciara(x0 + POPIS_STLPEC * P, y + x * P, x0 + (POPIS_STLPEC + ZNAK_STLPEC) * P + sirkaBloku, y + x * P, TENKA));
    }
  });

  // Políčka: každá dvojica kategórií má práve jednu tabuľku N x N.
  riadky.forEach((a, i) => {
    stlpce.forEach((b, j) => {
      if (!jeTabulka(k, i, j)) return;
      const x = xs + j * N * P, y = ys + i * N * P;
      for (let u = 1; u < N; u++) out.push(ciara(x + u * P, y, x + u * P, y + N * P, TENKA));
      out.push(obdlznik(x, y, N * P, N * P, 'none', '#000', HRUBA));
    });
  });
  return out.join('');
}

/* ── Text zadania ────────────────────────────────────────────────────── */
const CISLOVKY = ['zero', 'one', 'two', 'three', 'four', 'five', 'six'];

export function nazovZadania(p) {
  return 'The missing ' + p.cats[1].items[p.question.what];
}

/* Príbeh: tri vety, jedna z nich o zmiznutej zásobe (spec 6.2 žiada tri až
   štyri). Vety sú naše šablóny nad objektom zadania, nikdy sa neprepisujú
   odinakiaľ (spec 7.3). Štvrtá veta („každá indícia je pravdivá a sedí práve
   jedno usporiadanie") je pravidlo, nie príbeh, a stojí raz na strane
   s pravidlami; na každej strane zadania by zabrala riadok, teda pol
   milimetra z hrany políčka schodiska. */
export function pribeh(p) {
  const kolko = CISLOVKY[p.N] || String(p.N);
  const co = p.cats[1].items[p.question.what];
  const vety = [
    kolko.charAt(0).toUpperCase() + kolko.slice(1) + ' dormice share one larder in the copse.',
    p.k === 4
      ? 'Each of them keeps a different store, sleeps in a different tree and woke in a different week.'
      : 'Each of them keeps a different store and sleeps in a different tree.',
    'The ' + co + ' went missing from the larder overnight.',
  ];
  return vety;
}

export function otazka(p) {
  const co = p.cats[1].items[p.question.what];
  return 'Who kept the ' + co + ', in which tree'
    + (p.k === 4 ? ' and in which week' : '') + '?';
}

/* Obsadenie po kategóriách. Jednoznaky mriežky sú prvé písmená mien, takže sa
   pri menách neopakujú; týždne majú číslo, preto sa pri nich mapovanie vypíše. */
export function obsadenie(p) {
  const out = [];
  for (let a = 0; a < p.k; a++) {
    const cat = p.cats[a];
    const polozky = cat.id === 'when'
      ? cat.items.map((t, i) => (i + 1) + ' = ' + t)
      : cat.items.slice();
    out.push({ label: cat.label, text: polozky.join(', ') });
  }
  return out;
}

/* Vysádzaný text zadania pre daný rám: zoznam riadkov aj s ich súradnicami
   voči začiatku textového bloku. Výška bloku je `vyska`, a `presah` hovorí,
   že sa jedno slovo nezmestilo ani samo. */
export function sadzbaTextu(p, ram) {
  const kusy = [];
  const sirka = ram.w;
  let y = 0;
  let presah = false;
  const pridaj = (riadky, x, velkost, o, medziriadok) => {
    for (const r of riadky) {
      kusy.push({ x, y: y + medziriadok / 2, text: r, velkost, ...o });
      y += medziriadok;
    }
  };

  // Názov zadania a linka pod ním.
  const titul = zalom(nazovZadania(p), sirka, ram.titul);
  presah = presah || titul.presah;
  pridaj(titul.riadky, 0, ram.titul, {}, ram.titul * 1.3);
  y += 12;
  kusy.push({ linka: true, x1: 0, y, x2: sirka, sirkaCiary: TENKA });
  y += MEDZERA_BLOK;

  // Príbeh.
  const p1 = zalom(pribeh(p).join(' '), sirka, ram.telo);
  presah = presah || p1.presah;
  pridaj(p1.riadky, 0, ram.telo, {}, ram.telo * RIADOK);
  y += MEDZERA_BLOK;

  // Obsadenie po kategóriách.
  for (const r of obsadenie(p)) {
    const zac = y;
    const o1 = zalom(r.text, sirka - STITOK, ram.telo);
    presah = presah || o1.presah;
    kusy.push({ x: 0, y: zac + (ram.telo * RIADOK) / 2, text: r.label.toUpperCase(), velkost: ram.mini, sans: true, medzera: ram.mini * 0.1 });
    pridaj(o1.riadky, STITOK, ram.telo, {}, ram.telo * RIADOK);
    y += 6;
  }
  y += MEDZERA_BLOK - 6;

  // Číslovaný zoznam indícií, jeden alebo dva stĺpce.
  kusy.push({ x: 0, y: y + (ram.mini * RIADOK) / 2, text: 'CLUES', velkost: ram.mini, sans: true, medzera: ram.mini * 0.1 });
  y += ram.mini * RIADOK + 14;
  const vety = p.clues.map((cl) => textIndicie(p, cl));
  const stlpcov = ram.stlpce;
  const sirkaStlpca = (sirka - (stlpcov - 1) * ZLAB) / stlpcov;
  const naStlpec = Math.ceil(vety.length / stlpcov);
  let najnizsie = y;
  for (let s = 0; s < stlpcov; s++) {
    const x0 = s * (sirkaStlpca + ZLAB);
    let yy = y;
    for (let i = s * naStlpec; i < Math.min(vety.length, (s + 1) * naStlpec); i++) {
      const z = zalom(vety[i], sirkaStlpca - ODSADENIE, ram.telo);
      presah = presah || z.presah;
      kusy.push({ x: x0 + ODSADENIE - 18, y: yy + (ram.telo * RIADOK) / 2, text: (i + 1) + '.', velkost: ram.telo, kotva: 'end' });
      for (const r of z.riadky) {
        kusy.push({ x: x0 + ODSADENIE, y: yy + (ram.telo * RIADOK) / 2, text: r, velkost: ram.telo });
        yy += ram.telo * RIADOK;
      }
      yy += MEDZERA_INDICIA;
    }
    if (yy > najnizsie) najnizsie = yy;
  }
  y = najnizsie - MEDZERA_INDICIA;
  return { kusy, vyska: y, presah };
}

/* Výška vyhradeného textového bloku a hotová geometria strany. Je pevná na
   dvojicu (formát, úroveň): schodisko má pevné políčko a pevný počet riadkov,
   otázka pevnú výšku, zvyšok rámu patrí textu. */
export function geometria(p, f) {
  const ram = ramPre(f);
  const otazkaV = ram.telo * RIADOK * 2 + 34 + 26;
  const blok = ram.blok;
  const vyskaMiesta = ram.h - blok - PRED_MRIEZKOU - ZA_MRIEZKOU - otazkaV;
  const P = Math.min(vyskaMiesta / mriezkaRiadkov(p), ram.w / mriezkaStlpcov(p));
  return { ram, P, mriezkaV: mriezkaRiadkov(p) * P, mriezkaS: mriezkaStlpcov(p) * P, otazkaV, blok };
}

/* Zmestí sa vysádzaný text zadania do vyhradeného bloku? Rozhodujú tie dva
   formáty, ktoré sa predávajú (A4 a Letter); rámy kdp a eink majú políčko
   menšie, takže ich blok je vždy voľnejší a kandidáta by nezamietli. */
export const FORMATY_KNIHY = Object.freeze(['a4', 'letter']);
export function zmestiSa(p, formaty = FORMATY_KNIHY) {
  for (const id of formaty) {
    const g = geometria(p, RAMY[id]);
    const s = sadzbaTextu(p, g.ram);
    if (s.presah || s.vyska > g.blok) return false;
  }
  return true;
}
/* Šírka obsahovej plochy formátu v milimetroch, teda to, čomu zodpovedá
   `RAMY[id].w` jednotiek. Je to jediný zdroj prepočtu jednotiek na milimetre;
   text ponuky (ops/etsy/banka-textov.mjs vetyDormice) aj testy ho berú odtiaľto,
   nie z vlastnej kópie čísel. Hodnoty sú tie, z ktorých je dopočítaná výška
   rámu vyššie. */
export const SIRKA_MM = Object.freeze({ a4: 176, letter: 181.9, kdp: 127, eink: 141 });

/* Hrana políčka schodiska v milimetroch pre dané zadanie a formát. */
export function hranaPolickaMm(p, id) {
  const ram = RAMY[id];
  if (!ram) throw new Error('Dormice: neznámy formát ' + id);
  return geometria(p, ram).P * (SIRKA_MM[id] / ram.w);
}

export function mieraTextu(p, id) {
  const g = geometria(p, RAMY[id]);
  const s = sadzbaTextu(p, g.ram);
  return { vyska: s.vyska, blok: g.blok, podiel: s.vyska / g.blok, presah: s.presah };
}

/* ── Strana zadania ──────────────────────────────────────────────────── */
export function zadanie(p, f) {
  const g = geometria(p, f);
  const ram = g.ram;
  const s = sadzbaTextu(p, ram);
  if (s.presah || s.vyska > g.blok) {
    throw new Error('Dormice: vysádzaný text zadania sa nezmestil do bloku ' + ram.id
      + ' (' + Math.round(s.vyska) + ' z ' + Math.round(g.blok) + ' jednotiek); zadanie sa odmieta, písmo sa nezmenšuje');
  }
  const out = [];
  for (const k of s.kusy) {
    if (k.linka) { out.push(ciara(k.x1, k.y, k.x2, k.y, k.sirkaCiary)); continue; }
    out.push(txt(k.x, k.y, k.text, k.velkost, { sans: k.sans, medzera: k.medzera, tucne: k.tucne, kotva: k.kotva }));
  }
  /* Schodisko sa vycentruje do voľného miesta medzi koncom skutočného textu
     a otázkou. Vyhradený blok je pevný, ale krátke zadanie ho nevyplní, a
     schodisko pribité o spodok bloku by na ľahkej strane nechalo v strane
     päťcentimetrovú dieru. Vodorovne je schodisko vždy v strane. */
  const gy = s.vyska + PRED_MRIEZKOU + (g.blok - s.vyska) / 2;
  const gx = (ram.w - g.mriezkaS) / 2;
  out.push(schodisko(p, gx, gy, g.P));

  /* Otázka a riadok na doplnenie sú na každej strane na tom istom mieste,
     pribité o spodok rámu, nie zavesené za schodiskom. */
  const oy = ram.h - g.otazkaV;
  const ot = zalom(otazka(p), ram.w, ram.telo);
  let yy = oy;
  for (const r of ot.riadky) {
    out.push(txt(0, yy + (ram.telo * RIADOK) / 2, r, ram.telo));
    yy += ram.telo * RIADOK;
  }
  // Riadok na doplnenie odpovede.
  out.push(ciara(0, ram.h - 8, ram.w, ram.h - 8, TENKA, STREDNA));
  return obal(ram.w, ram.h, out.join(''));
}

/* ── Strana riešení ──────────────────────────────────────────────────── *
 * Riešenie nie je vyplnená mriežka, ale tabuľka N x k s plnými menami (spec
 * 6.3): vyplnené schodisko by na šestine strany bola sivá kaša, z toho istého
 * dôvodu, ktorý je napísaný v kresli/badgers.mjs. Pod tabuľkou je tučná veta
 * odpovede na záverečnú otázku. */
/* Rám riešenia je pevný na úroveň: šírka 1200 jednotiek, výška dopočítaná
   z k a N, takže box tesne obopne tabuľku a `ram()` ju v bunke strany
   nezmenší kvôli prázdnemu miestu. Písmo je zvolené tak, aby sa aj najširšia
   položka bánk (`dandelion roots`, 720 jednotiek na 100 bodov písma) zmestila
   do stĺpca na jeden riadok; `dormice-kniha.test.mjs` to skúša nad celou
   zmrazenou sadou bánk. */
export const SIRKA_RIESENIA = 1200;
const R_PISMO = { 3: 50, 4: 36 };
const R_VNUTRI = 16;
const R_RIADOK = 1.34;
const R_VETA_RIADKOV = 2;
/* Krok predpokladu (vrstva 3) pod vetou odpovede: štítok a dva riadky vety.
   Dva riadky sú vyhradené pevne, nie dopočítané, lebo viewBox riešenia musí
   ostať pevný na úroveň; text, ktorý by sa do dvoch riadkov nezmestil, sa
   odmieta rovnako ako pretečené zadanie. Najdlhší nameraný krok cez 32
   challenge zadaní štyroch edícií má 102 znakov a pri písme 36 na šírku 1200
   jednotiek zaberie dva riadky (merané skriptom nad zadania.json). */
const R_KROK_RIADKOV = 2;
const R_KROK_PISMO = 0.92;
const R_KROK_STITOK = 'TRIAL STEP';

/* Má zadanie krok vrstvy 3? Príznak sa berie z nameraného `difficulty`, ktoré
   generátor uložil pri prijatí kandidáta (spec 4.5), takže sa solveHuman
   nepúšťa pri každom easy riešení knihy. */
export function maKrokPredpokladu(p) {
  return !!(p && p.difficulty && p.difficulty.layers && p.difficulty.layers['3'] > 0);
}

/* Veta o kroku predpokladu na stranu riešení (spec 6.5). Text je ten, ktorý
   vypíše ľudský riešiteľ pri prvom kroku vrstvy 3, nie náš prerozprávaný:
   strana riešení má ukázať presne ten krok, ktorý riešiteľ urobil.
   Výsledok sa drží v pamäti na objekt zadania, lebo to isté riešenie sa kreslí
   pre štyri formáty a solveHuman s vrstvou 3 stojí okolo dvoch milisekúnd
   (32 challenge zadaní za 65 ms, merané 17. 9. 2026). */
const KROKY = new WeakMap();
export function krokPredpokladu(p) {
  if (!maKrokPredpokladu(p)) return null;
  if (KROKY.has(p)) return KROKY.get(p);
  const r = solveHuman(p, { maxVrstva: '3' });
  const krok = r.steps.find((s) => s.layer === '3');
  if (!krok) throw new Error('Dormice: zadanie hlási vrstvu 3, ale riešiteľ žiadny taký krok neurobil');
  KROKY.set(p, krok.text);
  return krok.text;
}

export function ramRiesenia(p) {
  const f = R_PISMO[p.k] || R_PISMO[4];
  const hlavicka = f * 0.85 * 1.5;
  const riadok = f * R_RIADOK + 12;
  const krok = maKrokPredpokladu(p)
    ? 24 + f * 0.7 * 1.5 + R_KROK_RIADKOV * f * R_KROK_PISMO * R_RIADOK
    : 0;
  const h = Math.round(hlavicka + p.N * riadok + 30 + R_VETA_RIADKOV * f * R_RIADOK + krok);
  return { w: SIRKA_RIESENIA, h, pismo: f, hlavickaPismo: f * 0.85, hlavicka, riadok, krok };
}

/* Veta odpovede. Prepočítaná tu z riešenia, nie prevzatá z generátora: strana
   riešení má hovoriť to, čo je v tabuľke nad ňou. */
export function vetaOdpovede(p) {
  const x = p.solution[1].indexOf(p.question.what);
  const kto = p.cats[0].items[p.solution[0][x]];
  const co = p.cats[1].items[p.solution[1][x]];
  const kde = p.cats[2].items[p.solution[2][x]];
  let s = kto + ' had the ' + co + ', in the ' + kde;
  if (p.k === 4) s += ', in the week of ' + p.cats[3].items[p.solution[3][x]];
  return s + '.';
}

export function riesenie(p) {
  const r = ramRiesenia(p);
  const w = r.w, h = r.h, k = p.k, N = p.N;
  const sirkaStlpca = w / k;
  const veta = zalom(vetaOdpovede(p), w, r.pismo, 'serifTucne');
  const celkom = r.hlavicka + N * r.riadok + 30 + veta.riadky.length * r.pismo * R_RIADOK + r.krok;
  const y0 = Math.max(0, (h - celkom) / 2);
  const out = [];

  for (let a = 0; a < k; a++) {
    const meno = (NAZVY_KATEGORII[p.cats[a].id] || p.cats[a].label).toUpperCase();
    out.push(txt(a * sirkaStlpca + R_VNUTRI, y0 + r.hlavicka / 2, meno,
      r.hlavickaPismo, { sans: true, medzera: r.hlavickaPismo * 0.1, farba: '#1a1a1a' }));
  }
  out.push(ciara(0, y0 + r.hlavicka, w, y0 + r.hlavicka, HRUBA));
  for (let x = 0; x < N; x++) {
    const y = y0 + r.hlavicka + x * r.riadok;
    if (x) out.push(ciara(0, y, w, y, TENKA, STREDNA));
    for (let a = 0; a < k; a++) {
      const t = p.cats[a].items[p.solution[a][x]];
      const z = zalom(t, sirkaStlpca - 2 * R_VNUTRI, r.pismo);
      z.riadky.forEach((riadok, u) => {
        out.push(txt(a * sirkaStlpca + R_VNUTRI, y + 6 + (u + 0.5) * r.pismo * R_RIADOK, riadok, r.pismo));
      });
    }
  }
  const vy = y0 + r.hlavicka + N * r.riadok + 30;
  veta.riadky.forEach((riadok, u) => {
    out.push(txt(0, vy + (u + 0.5) * r.pismo * R_RIADOK, riadok, r.pismo, { tucne: true }));
  });
  /* Krok predpokladu. Je pod vetou odpovede, oddelený tenkou čiarou a malým
     štítkom, takže ho hľadá len ten, kto ho hľadá, a zvyšok strany ostáva
     tabuľkou a jednou odpoveďou. */
  const krokText = krokPredpokladu(p);
  if (krokText) {
    const ky = vy + veta.riadky.length * r.pismo * R_RIADOK;
    const kPismo = r.pismo * R_KROK_PISMO;
    const z = zalom(krokText, w, kPismo);
    if (z.presah || z.riadky.length > R_KROK_RIADKOV) {
      throw new Error('Dormice: krok predpokladu sa nezmestil do vyhradených ' + R_KROK_RIADKOV
        + ' riadkov (' + z.riadky.length + '); riešenie sa odmieta, písmo sa nezmenšuje');
    }
    out.push(ciara(0, ky + 12, w, ky + 12, TENKA, STREDNA));
    const sy = ky + 24;
    out.push(txt(0, sy + r.pismo * 0.7 * 0.75, R_KROK_STITOK, r.pismo * 0.7,
      { sans: true, medzera: r.pismo * 0.07, farba: '#1a1a1a' }));
    const ty = sy + r.pismo * 0.7 * 1.5;
    z.riadky.forEach((riadok, u) => {
      out.push(txt(0, ty + (u + 0.5) * kPismo * R_RIADOK, riadok, kPismo));
    });
  }
  return obal(w, h, out.join(''));
}

/* Popis mriežky do hlavičky strany (spec 6.4 bod 4): `4 x 4` by pri Dormice
   nepovedalo nič, lebo štyri kategórie po štyroch položkách nie sú štvorec. */
export const popisMriezky = (p) => p.N + ' dormice, ' + p.k + ' categories';
