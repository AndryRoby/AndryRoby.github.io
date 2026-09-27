// Puzzle Village: film na 19 sekúnd, nakreslený a ozvučený kódom (kodfilm engine).
//
// Kreslí ho samotná dedinka: tie isté moduly ako hra (../svet.js, ../miesta.js, ../iso.js, ../riso.js,
// ../moja.js, všetky s ?v=7 ako vo village.js, teda jedna inštancia), takže ostrov, atramenty, zrno,
// domčeky, zvieratká, okná, svetlušky aj zvonček sú presne tie z hry. Film pridáva len kameru, poradie
// svetiel, štítky, titulky, názov a hudbu.
//
// Dej je jeden deň dedinky a ide v slučke bez skoku. Hák je podvečer so všetkými 14 oknami, svetluškami,
// názvom, vetou a adresou: tá istá snímka, akou film končí. Od 1,3 s príde ráno kruhom z okien Hedgehogs
// a okná zhasnú (pravidlo hry „tomorrow starts dark“). Kamera sa spustí k trom domom (Hedgehogs, Swans,
// Herons); pri každom sa okno naplní atramentom (kruh zo stredu okna, pružina snappy 360 ms ako v hre),
// dosadne štítok (mierka 1,3 na 1, pružina press) a rodina zahrá scénku (tie isté ACT scénky ako pri
// otvorení domu). Kamera pri dome stojí aj po atramente (aspoň 0,45 s pokoja), kým scénka aspoň polovicu
// času nehrá; pri poslednom dome takmer celú (dohrá pri 90 % priblíženia). Magpies je vo vlne: jeho
// scénka je jedno políčko tabule, ktoré tabuľa aj bez nej bliká, takže by ju nikto nevidel. Potom sa
// kamera zdvihne, preletí ponad dedinku a zvyšných jedenásť okien sa rozsvieti, každé až keď je celé v
// zábere vo všetkých štyroch formátoch (rozvrh sa počíta z kamery, odstup aspoň 140 ms ako v hre). Keď
// svieti všetkých 14, príde podvečer kruhom z posledného okna, vyletia svetlušky a kamera sa zdvihne k
// celému ostrovu. Záver sa pomaly približuje po tej istej rampe ako hák a skončí v stave snímky 0.
//
// Čistá funkcia času t: stav dedinky (ACT z miesta.js) sa nastaví z t pred kreslením každého domu,
// zvieratká bežia na hodinách t + ZIVOT (podvečer háku na hodinách konca, t + DLZKA + ZIVOT, aby slučka
// nadväzovala), nikde Date.now ani Math.random. Tlač ostrova (dlaždice 512 px pre tri úrovne priblíženia,
// deň a podvečer) sa v rendri vytlačí vo vrstvy() a kresli() ju len skladá. Cieľ kamery ide hladko medzi
// zastaveniami (pri každom dome stojí) a kamera za ním ako kriticky tlmená pružina (tlmenie 1, bez prekmitu).

import { okno, obmedz, ease, obalka } from './engine/cas.js';
import { platno, zaoblene, pismo } from './engine/kresba.js';
import { hak, format, zona, minPismo, zmestPismo, vyvazZalom } from './engine/hak.js';
import { pridajNastroj } from './engine/zvuk.js';
import { Pen, OPT } from '../riso.js?v=7';
import { build, drawStatic, HALO, panel } from '../svet.js?v=7';
import { PLACES, ambient, ACT } from '../miesta.js?v=7';
import { atrament, CASY, DENNE_SKLO, HRY, meno } from '../moja.js?v=7';
import { PRESETS, spring, springStep } from '../../../motion/src/core.js';

/** Verzia modulov dedinky, ktoré film importuje (test ju porovná s village.js v index.html). */
export const VERZIA_DEDINKY = '7';

const DLZKA = 19;
const TAU = Math.PI * 2;
const TILE = 512;                 // dlaždica tlače v pixeloch zariadenia (ako v hre)
const ZIVOT = 12.3;               // hodiny zvieratiek: t + 12,3 s (tá istá chvíľa ako tFrozen v hre)
const HAK = hak({ drz: 1.3, odchod: 0.6 });
const W_KAM = 8;                  // kamera: pružina s tlmením 1 za hladkým cieľom (oneskorenie 2 / 8 = 0,25 s)
const KROK_TRASY = 0.1;           // hladké úseky cieľa sa rozložia na úsečky po 0,1 s (pružina ich zahladí)
// Len na porovnanie kontrolných snímok (render.html?blizko=2.2&svetluska=1.4): iné priblíženie pri domoch
// a iná veľkosť svetlušiek; bez parametra platí to, čo overuje test.
const parameter = (kluc, od, po, inak) => {
  try { const v = Number(new URLSearchParams((globalThis.location && globalThis.location.search) || '').get(kluc)); return v >= od && v <= po ? v : inak; } catch { return inak; }
};
const BLIZKO = parameter('blizko', 2, 3.4, 3.0);   // pri domoch príbehu: px na jednotku sveta pri 1080 (ježko okolo 55 px)
const DYCH = 0.35;                // cestou medzi domami sa kamera vzdiali (log, na 270 jednotiek cesty) a znova priblíži
const STREDNA = 1.35;             // stredná úroveň tlače (px na jednotku pri 1080): prelet počas vlny ide 1,5 až 1,1
const ZAVER = 0.14;               // záver a hák: tá istá pomalá rampa priblíženia (e^0,14 = o 15 %)
const SCENA = 2.6;                // scénka rodiny po rozsvietení (najdlhšia, Herons, dohrá 1,85 s po svetle)
const SVETLUSKA = parameter('svetluska', 1, 3, 2.2);   // svetlušky 2,2-krát väčšie ako v hre (film ich ukazuje z celého ostrova)
const RANO_SP = spring(0.9, 1);   // polomer rána: pružina bez prekmitu, snímku pokryje asi za 0,7 s
const VECER_SP = spring(2.0, 1);  // polomer podvečera: pružina bez prekmitu; ostrov kryje asi za 0,7 s
const REG = [0.034, 0.022];       // posun ružového bubna názvu v em (karta dedinky: 3,6 a 2,4 px pri 112 px)
const INK = CASY.okno.ms / 1000;  // atrament okna: 0,36 s (moja.js)
const ODSTUP = CASY.odstup / 1000; // vlna: najmenej 140 ms medzi dvoma oknami (moja.js)
const PRED = 0.1;                 // okno vlny je celé v zábere aspoň 0,1 s predtým, než sa rozsvieti

const NAZOV = 'Puzzle Village';
const VETA = '14 daily logic puzzles. Free.';
const ADRESA = 'arling.sk/games';
const DAYLIT = 'rgb(' + DENNE_SKLO.join(',') + ')';

// ---------- dedinka (tá istá stavba ako v hre) ----------

const SVET = build(PLACES);
const MIESTO = new Map(PLACES.map((p) => [p.kluc, p]));
const OSTROV = SVET.island;       // ostrov so stromami a koreňmi, bez rámu plagátu
const OSTROV_W = OSTROV[2] - OSTROV[0], OSTROV_H = OSTROV[3] - OSTROV[1];
const OSTROV_C = [(OSTROV[0] + OSTROV[2]) / 2, (OSTROV[1] + OSTROV[3]) / 2];

// sprity domov bez izby (izba s padajúcou stenou patrí karte domu; vo filme by skryla okno)
const SPRITY_MIEST = [];
for (const pl of PLACES) for (const s of pl.sprites()) { if (s.focus) continue; s.pl = pl; SPRITY_MIEST.push(s); }
const AMB_DEN = ambient(SVET, false), AMB_VECER = ambient(SVET, true);
const SVETLUSKY = AMB_VECER.slice(AMB_DEN.length);   // podvečer pridá na koniec desať svetlušiek
SVETLUSKY.forEach((s, n) => { s.svetluska = n; });
const SPRITY_DEN = [...SPRITY_MIEST, ...AMB_DEN];
const SPRITY_VECER = [...SPRITY_MIEST, ...AMB_VECER];

const stredOkien = (k) => { const L = SVET.lights.get(k); return [(L.bb[0] + L.bb[2]) / 2, (L.bb[1] + L.bb[3]) / 2]; };
const RANO_BOD = stredOkien('hedgehogs');   // ráno príde kruhom z okien domu, kam kamera letí

// ---------- časová os (sekundy) ----------

// Cieľ kamery: príchod k domu (pri) a odchod (od). Svetlo príde 0,3 s po príchode cieľa, keď kamera pri
// dome takmer stojí. Odchod najskôr 0,85 s po svetle: atrament trvá 0,36 s a po ňom ostane aspoň 0,45 s
// pokoja; scénka rodiny (začne 0,15 s po svetle) hrá aspoň polovicu času pri stojacej kamere. Posledný dom
// (Herons) čaká, kým scénka takmer dohrá (tri dráhy letu, 1,85 s po svetle); cieľ sa pohne 0,35 s pred jej
// koncom, pružina kameru vtedy ešte drží blízko (pri konci scénky 2,68 z 3,0, test pustí najmenej 2,5) a
// zdvih je o to pomalší (0,75 s na 1,25).
// von = štítok zhasne, keď kamera odchádza (okno času); kotva štítku je nad domom.
// vlnaOd = najskôr vtedy môže svietiť okno vlny (scénka Herons dohrala).
// prelet = [čas, x, y, priblíženie pri 1080]: kamera sa nad domom Herons zdvihne a preletí ponad dedinku
// (okná vlny sa rozsvietia, keď sú celé v zábere); zdvih = odtiaľ sa kamera dvíha k celému ostrovu;
// zaver = cieľ je na celom ostrove o ZAVER ďalej a odtiaľ ide pomalá rampa háku.
const T = {
  rano: HAK.drz,
  domy: [
    { kluc: 'hedgehogs', pri: 3.05, svetlo: 3.35, od: 4.2 },
    { kluc: 'swans', pri: 5.45, svetlo: 5.75, od: 6.7 },
    { kluc: 'herons', pri: 7.95, svetlo: 8.25, od: 9.75 },
  ],
  vlnaOd: 10.1,
  prelet: [[10.5, 220, 485, 1.25], [11.65, -210, 468, 1.1]],
  zdvih: 12.55,
  zaver: 14.05,
  nazov: 14.85, veta: 15.25, adresa: 15.65,
};
for (const d of T.domy) d.von = [d.od - 0.05, d.od + 0.25];   // štítok zhasne, keď sa kamera pohne

const SVETLA = new Map(T.domy.map((d) => [d.kluc, d.svetlo]));   // dom -> čas rozsvietenia
const PRIBEH = new Set(SVETLA.keys());

// Titulky na obraze (nadväzujú bez medzier; čas čítania aspoň slová / 3 + 0,5 s).
// Zmena titulku padne do pohybu kamery (7,2 medzi Swans a Herons, 10,4 na konci zdvihu, keď začína vlna),
// nikdy nie na svetlo domu príbehu.
const TITULKY = [
  { od: T.domy[0].svetlo, do: 7.2, text: 'Solve a house’s puzzle today and its window lights up.' },
  { od: 7.2, do: 10.4, text: 'A new puzzle in every house, every day.' },
  { od: 10.4, do: T.nazov - 0.15, text: 'Evening comes when all fourteen are lit.' },
];

// Scénka rodiny začne 0,15 s po rozsvietení: predstih = oneskorenie act() v miesta.js mínus 0,15 s.
const ONESKORENIE = { hedgehogs: 0.9, dormice: 0.45, badgers: 0.6, hares: 0.5, voles: 0.5, swans: 0.5, cranes: 0.5, herons: 0.5, magpies: 0.45, squirrels: 0.5 };
const predstih = (k) => Math.max(0, (ONESKORENIE[k] || 0) - 0.15);
// Kedy scénka domu dohrá, v sekundách od ACT.t0 (miesta.js): Hedgehogs act('hedgehogs', t, 0.9, 0.9)
// = 0,9 + 0,9; Swans trace s predvolenými delay 0.5 a dur 1.4 = 1,9; Herons tri trace s 0.5 + n * 0.45 a 0.8
// = 0,5 + 0,9 + 0,8. Vo filme teda 1,05, 1,55 a 1,85 s po svetle. Magpies (len pre test): políčko tabule
// sa prepne, keď act('magpies', t) prejde 0,3, teda 0,45 + 0,33 s; inak ho ukazuje blikanie tabule.
const DOHRA = { hedgehogs: 1.8, swans: 1.9, herons: 2.2, magpies: 0.78 };
const scenka = (k) => { const tL = SVETLA.get(k), t0 = tL - predstih(k); return [t0 + (ONESKORENIE[k] || 0), t0 + DOHRA[k]]; };

// ---------- rozloženie podľa formátu ----------

let L = null;          // vrstvy pre aktuálny rozmer
let GEN = 0;           // generácia tlače (nový rozmer zruší dotláčanie starého)
let NALIEHAVO = false; // stránka: po ťuknutí na Play sa zvyšok tlače dotlačí hneď
const PERA = new WeakMap();

/** 9:16, 4:5 a 1:1: názov nad ostrovom, veta a adresa pod ním. 16:9: ostrov vľavo, texty vpravo. */
function rozlozenie(Wc, Hc) {
  const F = format(Wc, Hc), Z = zona(Wc, Hc), u = Math.min(Wc, Hc) / 1080, mp = minPismo(Wc, Hc);
  const m = platno(4, 4).getContext('2d');
  const R = { F, Z, u, mp, W: Wc, H: Hc, siroky: F.druh === 'siroky' };
  R.stitokPx = Math.max(40 * u, mp);
  R.titulokPx = Math.max((F.druh === 'vysoky' ? 44 : 42) * u, mp);
  if (!R.siroky) {
    const nazovPx = Math.max(mp, zmestPismo(NAZOV, 700, 132 * u, Z.w * 0.92));
    const vetaPx = Math.max(mp, (F.druh === 'vysoky' ? 50 : 46) * u);
    m.font = pismo(600, vetaPx);
    const vetaRiadky = vyvazZalom(m, VETA, Z.w);
    const adrPx = Math.max(mp, 44 * u);
    const nazovH = nazovPx * 1.24, vetaH = vetaPx * 1.3 * vetaRiadky.length, adrH = adrPx * 2.1;
    const gT = 34 * u, gI = 34 * u, gV = 24 * u;
    const ine = nazovH + gT + gI + vetaH + gV + adrH;
    const s = Math.min((Wc - 20 * u) / OSTROV_W, (Z.h - ine) / OSTROV_H);
    const spolu = ine + OSTROV_H * s;
    let y = Z.y0 + (Z.h - spolu) / 2;
    R.nazov = { x: Z.x0, y, px: nazovPx, riadky: [NAZOV], zarovnanie: 'center', sirka: Z.w, h: nazovH };
    y += nazovH + gT;
    R.domov = { s, cx: Wc / 2, cy: y + (OSTROV_H * s) / 2 };
    y += OSTROV_H * s + gI;
    R.veta = { x: Z.x0, y, px: vetaPx, riadky: vetaRiadky, zarovnanie: 'center', sirka: Z.w };
    y += vetaH + gV;
    R.adresa = { stred: Wc / 2, y, px: adrPx };
    R.kotva = [Wc / 2, Hc * (F.druh === 'vysoky' ? 0.44 : F.druh === 'portret' ? 0.43 : 0.42)];
  } else {
    const colW = Z.w * 0.34, colX = Z.x1 - colW;
    const riadky = ['Puzzle', 'Village'];
    const nazovPx = Math.max(mp, Math.min(...riadky.map((r) => zmestPismo(r, 700, 124 * u, colW * 0.92))));
    const vetaPx = Math.max(mp, 42 * u);
    m.font = pismo(600, vetaPx);
    const vetaRiadky = vyvazZalom(m, VETA, colW);
    const adrPx = Math.max(mp, 42 * u);
    const nazovH = nazovPx * 1.08 * (riadky.length - 1) + nazovPx * 1.24, vetaH = vetaPx * 1.3 * vetaRiadky.length, adrH = adrPx * 2.1;
    const gN = 30 * u, gV = 26 * u;
    const blok = nazovH + gN + vetaH + gV + adrH;
    let y = Hc / 2 - blok / 2;
    R.nazov = { x: colX, y, px: nazovPx, riadky, zarovnanie: 'left', sirka: colW, h: nazovH };
    y += nazovH + gN;
    R.veta = { x: colX, y, px: vetaPx, riadky: vetaRiadky, zarovnanie: 'left', sirka: colW };
    y += vetaH + gV;
    R.adresa = { vlavo: colX, y, px: adrPx };
    const x0 = Z.x0 - 60 * u, x1 = colX - 50 * u;
    const s = Math.min((x1 - x0) / OSTROV_W, Z.h / OSTROV_H);
    R.domov = { s, cx: (x0 + x1) / 2, cy: Hc / 2 };
    R.kotva = [Wc / 2, Hc * 0.45];
  }
  R.blizko = BLIZKO * u;                               // pri domoch príbehu
  R.stredna = STREDNA * u;                             // stredná úroveň tlače
  R.kotvaVlny = [Z.cx, (Z.y0 + Z.y1) / 2];             // počas preletu je stred zóny stredom pohľadu
  R.titulok = { stred: Wc / 2, spodok: Z.y1 - 14 * u, maxW: R.siroky ? Z.w * 0.66 : Z.w };
  R.pasTitulkov = R.titulok.spodok - 3.5 * R.titulokPx; // nad týmto sú okná vlny (titulok má najviac 2 riadky)
  // kotva štítku (svet): nad domom a nad jeho oknami; fokus kamery: stred domu so štítkom
  R.kotvaStitku = {}; R.fokus = {};
  const stitokH = R.stitokPx * 1.75 + 14 * u;
  for (const d of T.domy) {
    const pl = MIESTO.get(d.kluc), Lw = SVET.lights.get(d.kluc), b = pl.bb || [-190, -170, 190, 110];
    const ky = Math.min(pl.top[1], Lw.bb[1]) - 6, kx = (pl.top[0] + (Lw.bb[0] + Lw.bb[2]) / 2) / 2;
    R.kotvaStitku[d.kluc] = [kx, ky];
    const x0 = pl.x + b[0], x1 = pl.x + b[2], y1 = pl.y + b[3];
    const y0 = Math.min(pl.y + b[1], ky - stitokH / R.blizko);
    R.fokus[d.kluc] = [(x0 + x1) / 2, (y0 + y1) / 2];
  }
  return R;
}

// ---------- kamera ----------

/** Odozva pružiny s tlmením 1 na skok (S) a na rampu (Rr) cieľa; w = uhlová frekvencia. */
const skok = (tau, w) => (tau <= 0 ? 0 : 1 - (1 + w * tau) * Math.exp(-w * tau));
const rampa = (tau, w) => (tau <= 0 ? 0 : tau - 2 / w + (tau + 2 / w) * Math.exp(-w * tau));

/** Hodnota kanála: cieľ ide po úsečkach medzi krokmi, kamera za ním ako kriticky tlmená pružina. */
function kanal(kroky, pole, t, w) {
  let y = kroky[0][pole];
  for (let i = 0; i + 1 < kroky.length; i++) {
    const a = kroky[i], b = kroky[i + 1], dv = b[pole] - a[pole];
    if (dv === 0) continue;
    const dt = b.t - a.t;
    if (dt <= 1e-9) { y += dv * skok(t - a.t, w); continue; }
    y += (dv / dt) * (rampa(t - a.t, w) - rampa(t - b.t, w));
  }
  return y;
}

const hladko = (p) => p * p * (3 - 2 * p);   // smoothstep: rýchlosť nulová na oboch koncoch
const KANALY = ['x', 'y', 'lz', 'ax', 'ay'];

/**
 * Kroky cieľa kamery. Medzi zastaveniami ide cieľ hladko (smoothstep, cestou medzi domami sa vzdiali),
 * takže kamera príde k domu takmer bez zvyšku pohybu a svetlo príde, keď stojí. Hák a záver sú tá istá
 * rampa (z celého ostrova o ZAVER ďalej na celý ostrov), v háku posunutá o dĺžku filmu: kamera pred ňou
 * stojí, takže v čase DLZKA je presne tam, kde v čase 0.
 */
function postavKroky(R) {
  const dom = { x: OSTROV_C[0], y: OSTROV_C[1], ax: R.domov.cx, ay: R.domov.cy };
  const lzD = Math.log(R.domov.s), lzA = lzD - ZAVER, lzB = Math.log(R.blizko);
  const pri = (k) => ({ x: R.fokus[k][0], y: R.fokus[k][1], lz: lzB, ax: R.kotva[0], ay: R.kotva[1] });
  const vlna = ([, x, y, z]) => ({ x, y, lz: Math.log(z * R.u), ax: R.kotvaVlny[0], ay: R.kotvaVlny[1] });
  const kroky = [{ t: T.zaver - DLZKA, ...dom, lz: lzA }, { t: HAK.drz, ...dom, lz: lzD }];
  /** Hladký úsek z posledného kroku do cieľa c v čase t; dych = o koľko sa cestou vzdiali (log). */
  const hladkoDo = (t, c, dych = 0) => {
    const a = kroky[kroky.length - 1], n = Math.max(1, Math.round((t - a.t) / KROK_TRASY));
    for (let j = 1; j <= n; j++) {
      const p = j / n, e = hladko(p), k = { t: a.t + (t - a.t) * p };
      for (const q of KANALY) k[q] = a[q] + (c[q] - a[q]) * e;
      k.lz -= dych * Math.sin(Math.PI * p);
      kroky.push(k);
    }
  };
  const stoj = (t) => kroky.push({ ...kroky[kroky.length - 1], t });
  // spustenie do dedinky a tri domy príbehu (pri každom kamera stojí od pri do od)
  let pred = null;
  for (const d of T.domy) {
    const c = pri(d.kluc), dlzkaCesty = pred ? Math.hypot(c.x - pred.x, c.y - pred.y) : 0;
    hladkoDo(d.pri, c, DYCH * Math.min(1, dlzkaCesty / 270));
    stoj(d.od);
    pred = c;
  }
  // vlna: zdvih nad domom Herons, prelet ponad dedinku, kamera stojí do zdvihu k celému ostrovu
  for (const b of T.prelet) hladkoDo(b[0], vlna(b));
  stoj(T.zdvih);
  // podvečer: zdvih k celému ostrovu (o ZAVER ďalej) a odtiaľ pomalá rampa háku (končí až po konci filmu)
  hladkoDo(T.zaver, { ...dom, lz: lzA });
  kroky.push({ t: DLZKA + HAK.drz, ...dom, lz: lzD });
  return kroky;
}

/** Kamera v čase t: svetový bod (x, y) leží na obrazovke v (ax, ay), z = px na jednotku sveta. */
function kameraK(K, t) {
  return { x: kanal(K, 'x', t, W_KAM), y: kanal(K, 'y', t, W_KAM), z: Math.exp(kanal(K, 'lz', t, W_KAM)), ax: kanal(K, 'ax', t, W_KAM), ay: kanal(K, 'ay', t, W_KAM) };
}
const kamera = (t) => kameraK(L.kroky, t);
const naObrazovku = (kam, q) => [kam.ax + (q[0] - kam.x) * kam.z, kam.ay + (q[1] - kam.y) * kam.z];
function pohlad(kam, okraj = 0) {
  return [kam.x - kam.ax / kam.z - okraj, kam.y - kam.ay / kam.z - okraj, kam.x + (L.W - kam.ax) / kam.z + okraj, kam.y + (L.H - kam.ay) / kam.z + okraj];
}
const prekryv = (a, b) => !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);

/** Obdĺžnik svetla domu na obrazovke: okná aj teplý kruh okolo nich (svet.js lightsOf, HALO). */
function svetloNaObrazovke(kam, k) {
  const b = SVET.lights.get(k).bb, [x0, y0] = naObrazovku(kam, [b[0], b[1]]), [x1, y1] = naObrazovku(kam, [b[2], b[3]]);
  return { x0, y0, x1, y1 };
}
/** Okno smie svietiť len celé v bezpečnej zóne a nad pásom titulkov (v 9:16 teda nie pod rozhraním Shorts). */
const vZabere = (R, r) => r.x0 >= R.Z.x0 && r.x1 <= R.Z.x1 && r.y0 >= R.Z.y0 && r.y1 <= R.pasTitulkov;

// ---------- vlna: rozvrh podľa toho, kedy je okno celé v zábere ----------

// Rozvrh platí pre všetky štyri formáty naraz (zvuk je jeden). Kamera počas vlny nezávisí od písma (texty
// menia len polohu celého ostrova, ktorá sa v kamere prejaví až pri zdvihu), takže stránka, render aj test
// vypočítajú ten istý rozvrh. Okno sa rozsvieti najskôr 0,1 s po tom, čo je vo všetkých formátoch celé v
// zábere, a ostane v ňom počas celého atramentu; spomedzi takých ide prvé to, ktoré zo záberu odíde skôr,
// pri zhode to najbližšie k naposledy rozsvietenému. Odstup aspoň 140 ms (CASY.odstup).
const FORMATY = [[1080, 1920], [1920, 1080], [1080, 1080], [1080, 1350]];
function rozvrhVlny() {
  const VZ = 1 / 120, t0 = T.vlnaOd - PRED, n = Math.round((T.zdvih - t0) / VZ);
  const kandidati = HRY.filter((k) => !PRIBEH.has(k));
  const vid = new Map(kandidati.map((k) => [k, new Uint8Array(n + 1).fill(1)]));
  for (const [W, H] of FORMATY) {
    const R = rozlozenie(W, H), K = postavKroky(R);
    for (let i = 0; i <= n; i++) {
      const kam = kameraK(K, t0 + i * VZ);
      for (const k of kandidati) if (!vZabere(R, svetloNaObrazovke(kam, k))) vid.get(k)[i] = 0;
    }
  }
  const nPred = Math.round(PRED / VZ), nPo = Math.ceil(INK / VZ) + 2, krok = Math.round(ODSTUP / VZ);
  const moze = (k, i) => { const v = vid.get(k); for (let j = i - nPred; j <= i + nPo; j++) if (j < 0 || j > n || !v[j]) return false; return true; };
  const odide = (k, i) => { const v = vid.get(k); let j = i; while (j < n && v[j + 1]) j++; return j; };
  const vzd = (a, b) => { const p = stredOkien(a), q = stredOkien(b); return Math.hypot(p[0] - q[0], p[1] - q[1]); };
  const ostava = [...kandidati], rozvrh = [];
  let posledny = T.domy[T.domy.length - 1].kluc;
  for (let i = nPred; i <= n && ostava.length;) {
    const mozne = ostava.filter((k) => moze(k, i));
    if (!mozne.length) { i++; continue; }
    mozne.sort((a, b) => odide(a, i) - odide(b, i) || vzd(a, posledny) - vzd(b, posledny) || HRY.indexOf(a) - HRY.indexOf(b));
    const k = mozne[0];
    rozvrh.push({ k, t: Math.round((t0 + i * VZ) * 1e4) / 1e4 });
    ostava.splice(ostava.indexOf(k), 1);
    posledny = k;
    i += krok;
  }
  // okno, ktoré nikdy nie je celé v zábere, sa rozsvieti na konci vlny (test to hlási ako chybu)
  let tp = rozvrh.length ? rozvrh[rozvrh.length - 1].t : T.vlnaOd;
  for (const k of ostava) rozvrh.push({ k, t: (tp += ODSTUP) });
  return { rozvrh, chyba: ostava };
}
const VLNA_R = rozvrhVlny();
const VLNA = VLNA_R.rozvrh.map((o) => o.k);
for (const o of VLNA_R.rozvrh) SVETLA.set(o.k, o.t);
T.vsetky = Math.max(...SVETLA.values()) + INK;   // svieti všetkých 14
T.vecer = T.vsetky + 0.25;                       // podvečer z okna, ktoré sa rozsvietilo posledné
const VECER_BOD = stredOkien(VLNA[VLNA.length - 1]);

// Svetlušky vyletia podľa vzdialenosti od bodu, odkiaľ prišiel podvečer (rovnako vo všetkých formátoch).
const SVETLUSKY_T = SVETLUSKY.map((s) => {
  const b = s.box(T.vecer + ZIVOT);
  return Math.hypot((b[0] + b[2]) / 2 - VECER_BOD[0], (b[1] + b[3]) / 2 - VECER_BOD[1]);
});
{ const dMax = Math.max(...SVETLUSKY_T); SVETLUSKY_T.forEach((d, n) => { SVETLUSKY_T[n] = T.vecer + 0.35 + (1.1 * d) / dMax; }); }

// Tón zvončeka každého domu: ten istý ako v hre (village.js ring: 392 Hz krát pentatonika podľa poradia miest).
const STUPNE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31, 33];
const tonDomu = (k) => 392 * Math.pow(2, STUPNE[PLACES.indexOf(MIESTO.get(k)) % STUPNE.length] / 12);
const panDomu = (k) => obmedz(((stredOkien(k)[0] - OSTROV_C[0]) / (OSTROV_W / 2)) * 0.6, -0.6, 0.6);

// ---------- ráno a podvečer: kruh z bodu, farba neprejde cez sivú ----------

function najdalej(kam, bod) {
  const [x, y] = naObrazovku(kam, bod);
  return Math.max(Math.hypot(x, y), Math.hypot(L.W - x, y), Math.hypot(x, L.H - y), Math.hypot(L.W - x, L.H - y));
}
const polomerRana = (t) => (t < T.rano ? 0 : L.ranoR * springStep(RANO_SP, t - T.rano));
const polomerVecera = (t) => (t < T.vecer ? 0 : L.vecerR * springStep(VECER_SP, t - T.vecer));
function najdalejV(od, dokedy, bod) {
  let r = 0;
  for (let n = Math.ceil(od * 60); n <= dokedy * 60; n++) r = Math.max(r, najdalej(kamera(n / 60), bod));
  return r;
}
/** Prvý čas, od ktorého kruh pokrýva celú snímku až do konca úseku (vzorky každú 1/120 s, rezerva 1 %). */
function pokrytieOd(od, dokedy, polomer, bod) {
  let t0 = od;
  for (let n = Math.ceil(od * 120); n / 120 <= dokedy; n++) {
    const t = n / 120;
    if (polomer(t) < 1.01 * najdalej(kamera(t), bod)) t0 = (n + 1) / 120;
  }
  return t0;
}
/**
 * Čo sa v čase t kreslí: spodok celý a nad ním kruh druhého svetla.
 * Hák: podvečer (od 1,3 s ho prekryje ráno kruhom z okien Hedgehogs); po 14 oknách: podvečer kruhom
 * z posledného okna, a keď prikryje celú snímku, deň sa už nekreslí.
 */
function faza(t) {
  if (t < T.rano) return { spodok: 'vecer', kruh: null };
  if (t < T.vecer) return t >= L.ranoDo ? { spodok: 'den', kruh: null } : { spodok: 'vecer', kruh: { vecer: false, bod: RANO_BOD, r: polomerRana(t) } };
  return t >= L.vecerDo ? { spodok: 'vecer', kruh: null } : { spodok: 'den', kruh: { vecer: true, bod: VECER_BOD, r: polomerVecera(t) } };
}

// ---------- tlač ostrova: dlaždice pre tri úrovne priblíženia, deň a podvečer ----------

/** Ktoré úrovne kresliť pri priblížení zd (px tlače na jednotku, z * L.dprT): [[index, alfa]], hrubšia prvá. */
function urovne(zd) {
  const U = L.urovne, n = U.length - 1;
  if (zd <= U[0].S) return [[0, 1]];
  if (zd >= U[n].S) return [[n, 1]];
  let i = 0;
  while (zd > U[i + 1].S) i++;
  const q = Math.log(zd / U[i].S) / Math.log(U[i + 1].S / U[i].S);
  const a0 = obmedz((q - 0.2) / 0.6), a = a0 * a0 * (3 - 2 * a0);
  if (a <= 0) return [[i, 1]];
  if (a >= 1) return [[i + 1, 1]];
  return [[i, 1], [i + 1, a]];
}
function rozsahDlazdic(S, v) {
  const span = TILE / S;
  return [Math.floor(v[0] / span), Math.floor(v[1] / span), Math.floor(v[2] / span), Math.floor(v[3] / span)];
}
/** Zoznam dlaždíc, ktoré film naozaj ukáže (vzorky každú 1/60 s), v poradí, v akom ich treba. */
function potrebneDlazdice() {
  const videne = new Set(), fronta = [];
  for (let n = 0; n <= DLZKA * 60; n++) {
    const t = n / 60, kam = kamera(t), zd = kam.z * L.dprT, f = faza(t);
    const pasy = [f.spodok === 'vecer' ? 1 : 0];
    if (f.kruh) pasy.push(f.kruh.vecer ? 1 : 0);
    for (const e of pasy) {
      // úroveň 0 (celý ostrov) vždy: na stránke leží pod ostrejšou, kým sa ostrejšia dotláča
      const idx = new Set([0, ...urovne(zd).map((v) => v[0])]);
      for (const i of idx) {
        const S = L.urovne[i].S, span = TILE / S, [a, b, c, d] = rozsahDlazdic(S, pohlad(kam, 24 / S));
        for (let ty = b; ty <= d; ty++) for (let tx = a; tx <= c; tx++) {
          const k = e + '|' + i + '|' + tx + '|' + ty;
          if (videne.has(k)) continue;
          videne.add(k);
          // mimo ostrova je len papier (a v podvečer dva bubny): taká dlaždica je všade rovnaká
          const papier = !prekryv([tx * span, ty * span, (tx + 1) * span, (ty + 1) * span], [OSTROV[0] - 4, OSTROV[1] - 4, OSTROV[2] + 4, OSTROV[3] + 4]);
          fronta.push({ e, i, tx, ty, papier });
        }
      }
    }
  }
  return fronta;
}
/** Jedna dlaždica tlače: presne ako renderTile vo village.js (bez rámu plagátu, p.bare).
    Papier sa opakuje po 128 px a dlaždica má 512 px, preto je každá dlaždica mimo ostrova na tej
    istej úrovni pixel po pixeli rovnaká: vytlačí sa raz a použije všade. */
function vytlac(q) {
  const mapa = L.dlazdice[q.e][q.i], kluc = q.tx + ',' + q.ty;
  if (mapa.has(kluc)) return;
  if (q.papier && L.papier[q.e][q.i]) { mapa.set(kluc, L.papier[q.e][q.i]); return; }
  const S = L.urovne[q.i].S, span = TILE / S, wx = q.tx * span, wy = q.ty * span;
  const c = platno(TILE, TILE), g = c.getContext('2d', { alpha: false });
  const p = new Pen(g);
  g.setTransform(S, 0, 0, S, -wx * S, -wy * S);
  p.scale(S); p.bare = true;
  drawStatic(p, SVET, [wx, wy, wx + span, wy + span], q.e === 1);
  p.bare = false;
  if (q.papier) L.papier[q.e][q.i] = c;
  mapa.set(kluc, c);
}
/**
 * Render: celá tlač hneď. Stránka: hneď len celý ostrov (plagát aj ráno), ostrejšie úrovne až v nečinnosti
 * prehliadača (requestIdleCallback, dlaždica len keď ostáva aspoň 30 ms voľna) alebo po ťuknutí na Play
 * (dotlac: po kúskoch najviac 8 ms). Kým ostrejšia úroveň chýba, leží pod ňou celý ostrov.
 */
function tlac(env) {
  const gen = ++GEN, fronta = L.fronta;
  if (env.render) { for (const q of fronta) vytlac(q); L.zvysok = []; return; }
  for (const q of fronta) if (q.i === 0) vytlac(q);
  L.zvysok = fronta.filter((q) => q.i !== 0);
  if (NALIEHAVO) { dotlac(); return; }
  if (typeof requestIdleCallback !== 'function') return;   // bez nečinnosti (Safari): až po ťuknutí
  const krok = (d) => {
    if (gen !== GEN || !L || NALIEHAVO) return;
    while (L.zvysok.length && d.timeRemaining() > 30) vytlac(L.zvysok.shift());
    if (L.zvysok.length) requestIdleCallback(krok);
  };
  requestIdleCallback(krok);
}
/** Stránka po ťuknutí na Play: zvyšok tlače hneď, po kúskoch najviac 8 ms (film ho čoskoro ukáže). */
function dotlac() {
  NALIEHAVO = true;
  if (!L || !L.zvysok || !L.zvysok.length) return;
  const gen = GEN;
  const krok = () => {
    if (gen !== GEN || !L || !L.zvysok.length) return;
    const t0 = performance.now();
    do vytlac(L.zvysok.shift()); while (L.zvysok.length && performance.now() - t0 < 8);
    if (L.zvysok.length) setTimeout(krok, 16);
  };
  setTimeout(krok, 0);
}
function uplna(mapa, S, kam) {
  const [a, b, c, d] = rozsahDlazdic(S, pohlad(kam, 2 / S));
  for (let ty = b; ty <= d; ty++) for (let tx = a; tx <= c; tx++) if (!mapa.has(tx + ',' + ty)) return false;
  return true;
}
function kresliUroven(ctx, mapa, S, kam, alfa) {
  const zd = kam.z * L.dpr, span = TILE / S;
  const ox = L.dpr * (kam.ax - kam.x * kam.z), oy = L.dpr * (kam.ay - kam.y * kam.z);
  const [a, b, c, d] = rozsahDlazdic(S, pohlad(kam, 2 / S));
  ctx.globalAlpha = alfa;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = zd < S * 0.97 ? 'high' : 'low';
  for (let ty = b; ty <= d; ty++) for (let tx = a; tx <= c; tx++) {
    const dl = mapa.get(tx + ',' + ty);
    if (!dl) continue;
    // hrany zaokrúhlené rovnako pre susedov: žiadna škára medzi dlaždicami
    const x0 = Math.round(tx * span * zd + ox), x1 = Math.round((tx + 1) * span * zd + ox);
    const y0 = Math.round(ty * span * zd + oy), y1 = Math.round((ty + 1) * span * zd + oy);
    if (x1 > x0 && y1 > y0) ctx.drawImage(dl, x0, y0, x1 - x0, y1 - y0);
  }
  ctx.globalAlpha = 1;
}
function kresliTlac(ctx, kam, vecer) {
  const volby = urovne(kam.z * L.dprT), mapy = L.dlazdice[vecer ? 1 : 0];
  // na stránke sa ostrejšia úroveň môže ešte dotláčať: pod ňu celý ostrov (v rendri je všetko hotové)
  if (volby.some(([i]) => i !== 0 && !uplna(mapy[i], L.urovne[i].S, kam))) kresliUroven(ctx, mapy[0], L.urovne[0].S, kam, 1);
  for (const [i, a] of volby) kresliUroven(ctx, mapy[i], L.urovne[i].S, kam, a);
}

// ---------- okná, zvieratká, svetlušky ----------

// Hák: svetelná vlna prejde oknami zľava doprava (teplý kruh sa na chvíľu zväčší a zosilní), vrcholy od
// 0,3 do 0,95 s; na snímke 0 aj pri príchode rána (1,3 s) je nulová, takže slučka ostáva čistá.
const PORADIE_X = new Map([...SVET.lights.keys()].filter((k) => SVET.lights.get(k).polys.length).sort((a, b) => stredOkien(a)[0] - stredOkien(b)[0]).map((k, i) => [k, i]));
function vlnaHaku(k, t) {
  if (t >= HAK.drz || !PORADIE_X.has(k)) return 0;
  const x = (t - 0.3 - 0.05 * PORADIE_X.get(k)) / 0.14, v = Math.exp(-x * x);
  return v < 0.02 ? 0 : v;
}
/** Rozsvietené okno ako lightUp vo village.js: deň plochá teplá tabuľka, podvečer plné svetlo s kruhom
    (vlna = svetelná vlna háku, 0 až 1, kruh o 60 % väčší a silnejší; zablesk = mierka teplého záblesku
    pri rozsvietení cez deň, vo vlne 2, lebo kamera je vtedy dva až trikrát ďalej ako pri domoch príbehu). */
function rozsviet(p, Lw, a, vecer, vlna = 0, zablesk = 1) {
  const c = p.c;
  for (const w of Lw.polys) {
    if (vecer) {
      c.globalCompositeOperation = 'screen'; c.globalAlpha = 1;
      const r = HALO * (1 + 0.6 * vlna);
      const g = c.createRadialGradient(w.cx, w.cy, 0, w.cx, w.cy, r);
      g.addColorStop(0, 'rgba(255,196,110,' + (0.4 * a + 0.35 * vlna).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,196,110,0)');
      c.fillStyle = g; c.beginPath(); c.arc(w.cx, w.cy, r, 0, TAU); c.fill();
    } else if (a < 1) p.circle('sun', 0.34 * Math.sin(Math.PI * a), w.cx, w.cy, HALO * a * zablesk);
    c.save();
    if (a < 1) { c.beginPath(); c.arc(w.cx, w.cy, Math.max(0.01, w.R * a), 0, TAU); c.clip(); }
    c.globalCompositeOperation = 'source-over';
    if (vecer) panel(c, w, 1); else panel(c, w, 1, DAYLIT);
    c.restore();
  }
  p.reset();
}
/** Scénky rodín: pred kreslením domu sa ACT nastaví z času. V podvečere háku sú všetky dohrané. */
function stavScen(t, hakV) {
  ACT.done.clear();
  for (const [k, tL] of SVETLA) if (hakV || t >= tL + SCENA) ACT.done.add(k);
}
function aktivuj(k, t, hakV) {
  const tL = SVETLA.get(k);
  if (!hakV && tL != null && t >= tL && t - tL < SCENA) { ACT.k = k; ACT.t0 = tL - predstih(k) + ZIVOT; }
  else ACT.k = null;
}
function svetluska(p, s, t, tl, hakV) {
  const e = hakV ? 1 : springStep(PRESETS.gentle, t - SVETLUSKY_T[s.svetluska]);
  if (e <= 0) return;
  const b = s.box(tl), x = (b[0] + b[2]) / 2, y = (b[1] + b[3]) / 2, k = SVETLUSKA * (0.35 + 0.65 * e);
  const c = p.c;
  c.save();
  c.translate(x, y + (1 - e) * 14); c.scale(k, k); c.translate(-x, -y);
  s.draw(p, tl);
  c.restore();
}
/**
 * Jedno svetlo celej scény (deň alebo podvečer). Podvečer pred T.vecer je hák: všetkých 14 okien svieti,
 * scénky sú dohrané, svetlušky vonku a zvieratká bežia na hodinách konca filmu (t + DLZKA + ZIVOT).
 */
function scena(ctx, pen, t, kam, vecer) {
  const hakV = vecer && t < T.vecer;
  stavScen(t, hakV);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  kresliTlac(ctx, kam, vecer);
  const zd = kam.z * L.dpr;
  ctx.setTransform(zd, 0, 0, zd, L.dpr * (kam.ax - kam.x * kam.z), L.dpr * (kam.ay - kam.y * kam.z));
  pen.scale(zd); pen.eve = vecer;
  const v = pohlad(kam, 30 / kam.z);
  // dnešné svetlá cez tlač, pod všetkým, čo sa hýbe (ako drawSprites v hre)
  for (const [k, tL] of SVETLA) {
    const a = hakV ? 1 : t < tL ? 0 : atrament((t - tL) * 1000);
    if (a <= 0) continue;
    const Lw = SVET.lights.get(k);
    if (!Lw || !Lw.bb || !prekryv(Lw.bb, v)) continue;
    rozsviet(pen, Lw, a, vecer, hakV ? vlnaHaku(k, t) : 0, PRIBEH.has(k) ? 1 : 2);
  }
  const tl = t + ZIVOT + (hakV ? DLZKA : 0), zoznam = [];
  for (const s of vecer ? SPRITY_VECER : SPRITY_DEN) {
    const b = typeof s.box === 'function' ? s.box(tl) : s.box;
    if (prekryv(b, v)) zoznam.push([b[3], s]);
  }
  zoznam.sort((a, b) => a[0] - b[0]);
  for (const [, s] of zoznam) {
    if (s.svetluska != null) { svetluska(pen, s, t, tl, hakV); continue; }
    if (s.pl) aktivuj(s.pl.kluc, t, hakV); else ACT.k = null;
    s.draw(pen, tl);
  }
  ACT.k = null;
  pen.reset();
}

// ---------- texty (sprity sa kreslia raz vo vrstvy) ----------

/** Sprite textu filmu, kreslený raz v pixeloch zariadenia (ako sprite v hak.js). Značka textFilmu
    odlíši v teste text filmu od drobných nápisov tlače dedinky, ktoré sú kresba. */
function spriteTextu(dpr, w, h, kresli) {
  const c = platno(Math.ceil(w * dpr), Math.ceil(h * dpr));
  c.textFilmu = true;
  const x = c.getContext('2d');
  x.scale(dpr, dpr);
  kresli(x);
  // rozmer celých pixelov: sprite sa skladá 1 : 1, písmo sa nezmenší ani o zlomok
  return { c, w: c.width / dpr, h: c.height / dpr };
}
function sirkaTextu(text, vaha, px) { const m = platno(4, 4).getContext('2d'); m.font = pismo(vaha, px); return m.measureText(text).width; }

/** Riadky textu tlačené jedným bubnom risografu (zrno atramentu z riso.js, pixel zrna = pixel zariadenia). */
function bubon(dpr, B, ink, a, vaha, riadkovanie) {
  const lh = B.px * riadkovanie, h = lh * (B.riadky.length - 1) + B.px * 1.24;
  const sp = spriteTextu(dpr, B.sirka, h, (x) => {
    const p = new Pen(x);
    p.scale(dpr);
    p.ink(ink, a);
    x.font = pismo(vaha, B.px); x.textBaseline = 'top'; x.textAlign = B.zarovnanie;
    const x0 = B.zarovnanie === 'center' ? B.sirka / 2 : 0;
    B.riadky.forEach((r, i) => x.fillText(r, x0, B.px * 0.06 + i * lh));
    p.reset();
  });
  return sp;
}
/** Pilulka ako menovka domu v hre (.vl-lab-in s .vl-lab-okno), zväčšená na video. */
function spriteStitku(dpr, R, text) {
  const px = R.stitokPx, u = px / 12;
  const gw = 7 * u, gh = 9 * u, gap = 5 * u, padX = 7 * u, padT = 4 * u, padB = 5 * u, sh = 2 * u, rad = 7 * u;
  const w = padX + gw + gap + sirkaTextu(text, 700, px) + padX, h = padT + px + padB;
  const okraj = 2;
  const sp = spriteTextu(dpr, w + sh + okraj * 2, h + sh + okraj * 2, (x) => {
    x.translate(okraj, okraj);
    zaoblene(x, sh, sh, w, h, rad); x.fillStyle = 'rgba(255,104,150,0.6)'; x.fill();
    zaoblene(x, 0, 0, w, h, rad); x.fillStyle = 'rgb(251,246,234)'; x.fill();
    x.lineWidth = u; x.strokeStyle = 'rgba(40,48,70,0.14)'; x.stroke();
    // teplé okienko v tmavom ráme: dom dnes svieti
    const gx = padX, gy = (h - gh) / 2, f = 1.5 * u;
    zaoblene(x, gx, gy, gw, gh, u); x.fillStyle = '#283046'; x.fill();
    zaoblene(x, gx + f, gy + f, gw - 2 * f, gh - 2 * f, u * 0.4); x.fillStyle = '#ffc454'; x.fill();
    x.font = pismo(700, px); x.textBaseline = 'middle'; x.textAlign = 'left'; x.fillStyle = '#283046';
    x.fillText(text, padX + gw + gap, h / 2 + px * 0.04);
  });
  sp.kotva = [okraj + w / 2, okraj + h];
  return sp;
}
/** Titulok ako tmavá pilulka dedinky (.vl-hint s tieňom .vl-tip). */
function spriteTitulku(dpr, R, text) {
  let px = R.titulokPx;
  const m = platno(4, 4).getContext('2d');
  const padX = () => px * 0.8, padY = () => px * 0.5;
  m.font = pismo(600, px);
  let riadky = vyvazZalom(m, text, R.titulok.maxW - 2 * padX());
  while (riadky.length > 2 && px > R.mp) { px = Math.max(R.mp, px * 0.95); m.font = pismo(600, px); riadky = vyvazZalom(m, text, R.titulok.maxW - 2 * padX()); }
  const lh = px * 1.28, sirky = riadky.map((r) => m.measureText(r).width);
  const w = Math.max(...sirky) + 2 * padX(), h = lh * (riadky.length - 1) + px * 1.18 + 2 * padY(), sh = px * 0.22, rad = px * 0.36;
  const sp = spriteTextu(dpr, w + sh + 4, h + sh + 4, (x) => {
    x.translate(2, 2);
    zaoblene(x, sh, sh, w, h, rad); x.fillStyle = 'rgba(255,104,150,0.7)'; x.fill();
    zaoblene(x, 0, 0, w, h, rad); x.fillStyle = 'rgba(40,48,70,0.96)'; x.fill();
    x.font = pismo(600, px); x.textBaseline = 'top'; x.textAlign = 'center'; x.fillStyle = '#f4ecd9';
    riadky.forEach((r, i) => x.fillText(r, w / 2, padY() + px * 0.06 + i * lh));
  });
  sp.px = px; sp.riadky = riadky.length;
  return sp;
}
/** Adresa ako tmavá pilulka s papierovým písmom (knockout z nočného atramentu). */
function spriteAdresy(dpr, px) {
  const padX = px * 0.8, h = px * 2.0, w = sirkaTextu(ADRESA, 600, px) + 2 * padX, sh = px * 0.18, rad = px * 0.42;
  const sp = spriteTextu(dpr, w + sh + 4, h + sh + 4, (x) => {
    x.translate(2, 2);
    zaoblene(x, sh, sh, w, h, rad); x.fillStyle = 'rgba(255,104,150,0.7)'; x.fill();
    zaoblene(x, 0, 0, w, h, rad); x.fillStyle = '#283046'; x.fill();
    x.font = pismo(600, px); x.textBaseline = 'middle'; x.textAlign = 'center'; x.fillStyle = '#f4ecd9';
    x.fillText(ADRESA, w / 2, h / 2 + px * 0.04);
  });
  sp.pw = w; sp.ph = h;
  return sp;
}
function stavTexty(R, dpr) {
  // názov je vždy na podvečernom papieri (hák aj záver): modrý bubon plný (1,0), inak by mal kontrast len 3,3 : 1
  const nazov = { ruzova: bubon(dpr, R.nazov, 'pink', 0.9, 700, 1.08), modra: bubon(dpr, R.nazov, 'blue', 1, 700, 1.08) };
  const veta = bubon(dpr, R.veta, 'night', 0.92, 600, 1.3);
  const adresa = spriteAdresy(dpr, R.adresa.px);
  const ax = R.adresa.vlavo != null ? R.adresa.vlavo - 2 : R.adresa.stred - adresa.pw / 2 - 2;
  const stitky = {};
  for (const d of T.domy) stitky[d.kluc] = spriteStitku(dpr, R, meno(d.kluc));
  const titulky = TITULKY.map((c) => ({ ...c, sp: spriteTitulku(dpr, R, c.text) }));
  return { nazov, veta, adresa, adresaXY: [ax, R.adresa.y - 2], stitky, titulky };
}

// ---------- kreslenie textov ----------

/** Štítok domu: od rozsvietenia, dosadne z 1,3 na 1 (pružina press ako menovka v hre), drží sa v zóne. */
function stitokRect(k, kam, mier) {
  const sp = L.texty.stitky[k], [ax, ay] = naObrazovku(kam, L.R.kotvaStitku[k]);
  const w = sp.w * mier, h = sp.h * mier, Z = L.R.Z, m = 4 * L.R.u;
  const x = obmedz(ax - sp.kotva[0] * mier, Z.x0 + m, Z.x1 - m - w);
  const y = obmedz(ay - 12 * L.R.u - sp.kotva[1] * mier, Z.y0 + m, Z.y1 - m - h);
  return { x, y, w, h };
}
function stitokStav(d, t) {
  if (t < d.svetlo || t > d.von[1]) return null;
  const alfa = obmedz((t - d.svetlo) / 0.12) * (1 - ease.inOutQuad(okno(t, d.von[0], d.von[1])));
  return alfa > 0 ? { alfa, mier: 1.3 - 0.3 * springStep(PRESETS.press, t - d.svetlo) } : null;
}
function kresliStitky(ctx, t, kam) {
  for (const d of T.domy) {
    const s = stitokStav(d, t);
    if (!s) continue;
    const r = stitokRect(d.kluc, kam, s.mier);
    ctx.globalAlpha = s.alfa;
    ctx.drawImage(L.texty.stitky[d.kluc].c, r.x, r.y, r.w, r.h);
  }
  ctx.globalAlpha = 1;
}
function titulokRect(c, t) {
  const sp = c.sp, vstup = ease.outCubic(okno(t, c.od, c.od + 0.4));
  return { x: L.R.titulok.stred - sp.w / 2, y: L.R.titulok.spodok - sp.h + (1 - vstup) * 10 * L.R.u, w: sp.w, h: sp.h };
}
function kresliTitulky(ctx, t) {
  for (const c of L.texty.titulky) {
    const a = obalka(t, c.od, c.do, 0.28, 0.25);
    if (a <= 0) continue;
    const r = titulokRect(c, t);
    ctx.globalAlpha = a;
    ctx.drawImage(c.sp.c, r.x, r.y, r.w, r.h);
  }
  ctx.globalAlpha = 1;
}
/**
 * Hlavička (názov v dvoch bubnoch, veta, adresa). V háku je celá od snímky 0 a odchádza (veta o chvíľu
 * skôr); v závere prichádza (ružový bubon sa dotlačí do registra, adresa dosadne) a na konci je v presne
 * tom istom stave ako na snímke 0, takže slučka nadväzuje.
 */
const von = (t, o = 0) => ease.inOutCubic(okno(t, HAK.drz - 0.15 - o, HAK.drz + 0.25 - o));
function stavHlavicky(t) {
  if (t < HAK.koniec) {
    const v = von(t), vv = von(t, 0.08);
    return { a: 1 - v, f: 1, dy: v * 0.25, av: 1 - vv, dv: vv * 0.4, aa: 1 - v, sa: 1 - 0.06 * v };
  }
  const q = ease.outCubic(okno(t, T.veta, T.veta + 0.6)), p = springStep(PRESETS.enter, t - T.adresa);
  return {
    a: ease.outCubic(okno(t, T.nazov, T.nazov + 0.35)), f: 1 + 2.4 * (1 - springStep(PRESETS.gentle, t - T.nazov)), dy: 0,
    av: t < T.veta ? 0 : obmedz(q * 1.5), dv: (1 - q) * 0.5,
    aa: t < T.adresa ? 0 : obmedz(p * 1.6), sa: 0.9 + 0.1 * p,
  };
}
function kresliHlavicku(ctx, t) {
  const R = L.R, X = L.texty, s = stavHlavicky(t);
  if (s.a > 0) {
    const px = R.nazov.px, dy = s.dy * R.nazov.h;
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = s.a;
    const { ruzova, modra } = X.nazov;
    ctx.drawImage(ruzova.c, R.nazov.x + REG[0] * px * s.f, R.nazov.y + REG[1] * px * s.f + dy, ruzova.w, ruzova.h);
    ctx.drawImage(modra.c, R.nazov.x, R.nazov.y + dy, modra.w, modra.h);
    ctx.restore();
  }
  if (s.av > 0) {
    ctx.save();
    ctx.beginPath(); ctx.rect(R.veta.x - 10, R.veta.y - 4, X.veta.w + 20, X.veta.h + 8); ctx.clip();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = s.av;
    ctx.drawImage(X.veta.c, R.veta.x, R.veta.y + s.dv * X.veta.h, X.veta.w, X.veta.h);
    ctx.restore();
  }
  if (s.aa > 0) {
    const sp = X.adresa, [x, y] = X.adresaXY, cx = x + sp.w / 2, cy = y + sp.h / 2;
    ctx.globalAlpha = s.aa;
    ctx.drawImage(sp.c, cx - (sp.w * s.sa) / 2, cy - (sp.h * s.sa) / 2, sp.w * s.sa, sp.h * s.sa);
    ctx.globalAlpha = 1;
  }
}

// ---------- vrstvy ----------

function zahod() {
  GEN++;
  if (!L || !L.dlazdice) return;
  for (const svetlo of L.dlazdice) for (const mapa of svetlo) { for (const c of new Set(mapa.values())) { c.width = 0; c.height = 0; } mapa.clear(); }
}
function stavVrstiev(Wc, Hc, dpr, env) {
  zahod();
  const R = rozlozenie(Wc, Hc);
  L = { W: Wc, H: Hc, dpr, R };
  L.kroky = postavKroky(R);
  // tlač v pixeloch zariadenia; na širokom plátne stránky (počítač) najviac 1,5 px na CSS px, inak by pri
  // DPR 2 držala asi 137 plátien po 1 MB (render a telefón tlačia v plnom rozlíšení)
  L.dprT = env.render || Wc < 761 ? dpr : Math.min(dpr, 1.5);
  L.urovne = [R.domov.s, R.stredna, R.blizko].map((z) => ({ z, S: z * L.dprT }));
  // kruhy rána a podvečera: polomer pokryje najvzdialenejší roh snímky, nech je kamera v úseku kdekoľvek;
  // od času pokrytia sa kreslí už len nové svetlo (ráno do 2,5 s po začiatku, podvečer do konca filmu)
  L.ranoR = 1.02 * najdalejV(T.rano, T.rano + 2.5, RANO_BOD);
  L.vecerR = 1.02 * najdalejV(T.vecer, DLZKA, VECER_BOD);
  L.ranoDo = pokrytieOd(T.rano, T.rano + 2.5, polomerRana, RANO_BOD);
  L.vecerDo = pokrytieOd(T.vecer, DLZKA, polomerVecera, VECER_BOD);
  L.texty = stavTexty(R, dpr);
  L.dlazdice = [[new Map(), new Map(), new Map()], [new Map(), new Map(), new Map()]];
  L.papier = [[null, null, null], [null, null, null]];
  L.fronta = potrebneDlazdice();
  tlac(env);
}
function penPre(ctx) {
  let p = PERA.get(ctx);
  if (!p) { p = new Pen(ctx); PERA.set(ctx, p); }
  return p;
}

// ---------- film ----------

const film = {
  dlzka: DLZKA,
  // Plagát (pred ťuknutím a pri zníženom pohybe) je snímka tesne pred koncom: to isté zloženie ako hák
  // (slučka), ale odkaz nad adresou už platí (od T.adresa), takže pri zníženom pohybe sa dá kliknúť, a Play
  // pokračuje snímkou 0 bez skoku. Svetelná vlna háku (0,2 až 1,1 s) na plagáte nie je.
  plagat: DLZKA - 0.05,
  titulky: [
    { od: 0, text: 'Puzzle Village. The whole island in the evening, printed like a risograph poster: all fourteen windows are lit and fireflies drift over the meadows and the water. 14 daily logic puzzles. Free. arling.sk/games' },
    { od: T.rano, text: 'Morning comes back in a circle from the hedgehogs’ cottage and every window goes dark: tomorrow starts dark. The view glides down into the village.' },
    { od: T.domy[0].svetlo, text: 'Hedgehogs: the cottage windows fill with light and a sleeping hedgehog climbs out of the leaves. Solve a house’s puzzle today and its window lights up.' },
    { od: T.domy[1].svetlo, text: 'Swans: the lantern at the end of the jetty lights up and a loop is drawn round the lake.' },
    { od: T.domy[2].svetlo, text: 'Herons: the window of the lookout lights up and three flight paths are drawn over the marsh, one after another. A new puzzle in every house, every day.' },
    { od: T.domy[2].od, text: 'The view rises and sweeps across the village, and the other eleven windows light up one after another as they come into view.' },
    { od: T.vecer, text: 'Evening comes when all fourteen are lit: it pours over the print from the last window, fireflies come out and the view rises over the whole island.' },
    { od: T.nazov, text: 'Puzzle Village. 14 daily logic puzzles. Free. arling.sk/games' },
  ],
  async pripravit(env) {
    // Firefox: čiary a písmo tlače ako výplne (ten istý dôvod a tá istá cesta ako vo village.js)
    if (!env.render && typeof navigator !== 'undefined' && /\bGecko\/\d/.test(navigator.userAgent || '')) OPT.fillStrokes = true;
    if (typeof document !== 'undefined' && document.fonts && document.fonts.load) {
      await Promise.all([document.fonts.load(pismo(700, 40)), document.fonts.load(pismo(600, 40))]).catch(() => {});
    }
  },
  vrstvy: stavVrstiev,
  kresli(ctx, t, Wc, Hc, env) {
    if (!L) return;
    const kam = kamera(t), pen = penPre(ctx), f = faza(t);
    scena(ctx, pen, t, kam, f.spodok === 'vecer');
    if (f.kruh) {
      // ráno aj podvečer prichádzajú kruhom z bodu (farba neprejde cez sivú)
      ctx.save();
      const [bx, by] = naObrazovku(kam, f.kruh.bod);
      ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
      ctx.beginPath(); ctx.arc(bx, by, Math.max(0.01, f.kruh.r), 0, TAU); ctx.clip();
      scena(ctx, pen, t, kam, f.kruh.vecer);
      ctx.restore();
    }
    ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    kresliStitky(ctx, t, kam);
    kresliTitulky(ctx, t);
    kresliHlavicku(ctx, t);
    ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
  },
  // tlačidlo prehrať na plagáte: stred ostrova
  stredPlagatu() { return [L.R.domov.cx, L.R.domov.cy]; },
  odkazy() {
    const sp = L.texty.adresa, [x, y] = L.texty.adresaXY;
    return [{ x: x + 2, y: y + 2, w: sp.pw, h: sp.ph, href: '/games/', text: 'Play our free daily logic puzzles at arling.sk/games', od: T.adresa, udalost: 'village_film_cta' }];
  },
  // stránka volá po ťuknutí na Play (strana.js): zvyšok tlače ostrova hneď
  dotlac,
  zvuk: [],
};

// ---------- zvuk ----------

// Zvonček dedinky (village.js ring): sínus a čiastkový tón 4,02 krát silou 0,18, kvinta o 90 ms neskôr,
// nábeh 8 ms, doznenie za 1,1 s. Film ho pošle aj do dozvuku a do stereo poľa.
pridajNastroj('zvoncek', (g, e, k) => {
  const ctx = g.ctx;
  for (const [pol, oneskor, sila] of [[0, 0, 1], [7, 0.09, 0.5625]]) {
    const f = e.f * Math.pow(2, pol / 12), t0 = k + oneskor, h = (e.hlas ?? 0.16) * sila;
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), gg = ctx.createGain(), g2 = ctx.createGain();
    o.type = 'sine'; o.frequency.value = f; o2.type = 'sine'; o2.frequency.value = f * 4.02;
    g2.gain.value = 0.18;
    o2.connect(g2); g2.connect(gg); o.connect(gg);
    gg.gain.setValueAtTime(0, t0);
    gg.gain.linearRampToValueAtTime(h, t0 + 0.008);
    gg.gain.exponentialRampToValueAtTime(Math.max(1e-5, h * 0.005), t0 + 1.1);
    let out = gg;
    if (e.pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = e.pan; gg.connect(p); out = p; }
    out.connect(g.suchy);
    if (e.dozvuk) { const s = ctx.createGain(); s.gain.value = e.dozvuk; out.connect(s); s.connect(g.dozvuk); }
    o.start(t0); o2.start(t0); o.stop(t0 + 1.2); o2.stop(t0 + 1.2);
  }
});

// Akord háku a konca: ten istý G dur, aby snímka 0 v slučke bola nové zaznenie akordu, ktorý práve znel.
const AKORD_HAKU = ['G2', 'D3', 'B3', 'D4'];
const HLAS_HAKU = 0.8;            // hak.js: plocha háku má hlas 0,2 x HLAS_HAKU, filter 1500 Hz na začiatku
const CVRK = { dlzka: 0.045, krok: 0.065 };   // jedno cvrknutie a odstup cvrknutí v trojici

// Cvrčky: [frekvencia, stereo, prvá trojica po začiatku podvečera, perióda trojíc] v sekundách.
const CVRCKY = [[4700, -0.45, 0.9, 0.93], [5200, 0.5, 1.35, 1.07]];

/** Cvrčky: trojice cvrknutí každý svojím tempom od podvečera. Každé cvrknutie, ktoré by začalo po konci,
    zaznie v háku (čas mínus dĺžka filmu), takže v slučke žiadne nechýba; v háku do 1,0 s. Cvrknutie, ktoré
    by šev prekročilo, zaznie celé hneď na snímke 0 (o najviac 45 ms neskôr, pod úderom akordu háku). */
function cvrkyCvrckov() {
  const out = [];
  for (const [f, pan, od, per] of CVRCKY) {
    for (let n = 0; ; n++) {
      const t0 = T.vecer + od + n * per;
      if (t0 - DLZKA > T.rano - 0.3) break;
      for (let j = 0; j < 3; j++) {
        let t = t0 + j * CVRK.krok;
        if (t < DLZKA && t + CVRK.dlzka > DLZKA) t = 0;   // na šve by sa odrezalo
        else if (t >= DLZKA) t -= DLZKA;
        out.push({ t, typ: 'sum', filter: 'bandpass', f0: f, f1: f * 0.99, q: 14, dlzka: CVRK.dlzka, nabeh: 0.004, hlas: 0.02, pan, dozvuk: 0.15, odkial: (n * 0.37 + j * 0.11) % 1.8, cvrcok: f });
      }
    }
  }
  return out;
}

function partitura() {
  const u = [];
  // hák (podvečer): G dur od prvej snímky (akord, zvony, trblietka), pri príchode rána švih nadol. Ťuk na
  // snímke 0 má tretinu sily: v slučke dopadne na koncovú plochu toho istého akordu, nie do ticha.
  u.push(...HAK.zvuk({ akord: AKORD_HAKU, zvony: ['G5', 'D6', 'B6'], hlas: HLAS_HAKU }).map((e) => (e.typ === 'tuk' && e.t === 0 ? { ...e, hlas: e.hlas * 0.35 } : e)));
  // ráno: jeden tichý vysoký zvon, keď kruh rána prejde cez prvé okná
  u.push({ t: T.rano + 0.3, typ: 'zvon', f: 'E6', pomer: 2, index: 0.3, dlzka: 1.4, hlas: 0.03, dozvuk: 0.6 });
  // tichá hudba cez deň: C, Em, D, G (G dur, v ktorej zvonia domy); plocha nastúpi pred príletom k domu
  // a trvá do nástupu ďalšej (s presahom 0,4 s); G príde so zdvihom nad Herons a drží cez vlnu do podvečera
  const plochy = [[1.85, ['C3', 'G3', 'B3', 'E4'], 850, 1200], [T.domy[1].pri - 0.5, ['E2', 'B2', 'D3', 'G3'], 800, 1100], [T.domy[2].pri - 0.5, ['D3', 'A3', 'D4', 'E4'], 850, 1150], [T.domy[2].od - 0.25, ['G2', 'D3', 'G3', 'B3'], 950, 1300]];
  plochy.forEach(([t, noty, f1, f2], i) => {
    const dalsia = i + 1 < plochy.length ? plochy[i + 1][0] : T.vecer;
    u.push({ t, typ: 'pad', noty, dlzka: dalsia + 0.4 - t, nabeh: 0.9, dobeh: 1.0, hlas: 0.11, filter: f1, filter2: f2 });
  });
  // okná: zvonček dedinky, každý dom svojím tónom; tri domy príbehu hlasnejšie, vlna jemnejšie;
  // vysoké domy (Herons D7, Foxes E7) tichšie, aby zvonček nepišťal (ucho je pri 2 až 3 kHz najcitlivejšie)
  const casyZvoncekov = [...SVETLA.values()];
  for (const [k, tL] of SVETLA) {
    const f = tonDomu(k);
    u.push({ t: tL, typ: 'zvoncek', f, hlas: (PRIBEH.has(k) ? 0.16 : 0.1) * obmedz(Math.pow(1000 / f, 0.4), 0.55, 1), pan: panDomu(k), dozvuk: 0.35 });
  }
  // hracia skrinka: riedke tóny pentatoniky, dva pri každom dome príbehu (keď rodina hrá), tri v podvečer
  // a tri v závere; nikdy nie spolu so zvončekom okna
  const [dH, dS, dR] = T.domy;
  const skrinka = [[2.15, 'E5'], [2.75, 'G5'], [dH.svetlo + 0.8, 'B5'], [dH.svetlo + 1.4, 'G5'], [dS.svetlo + 0.65, 'E5'], [dS.svetlo + 1.25, 'D5'], [dR.svetlo + 0.65, 'A5'], [dR.svetlo + 1.3, 'E5'],
    [T.vecer + 0.4, 'E5'], [T.vecer + 1.1, 'D5'], [T.vecer + 1.8, 'B4'], [16.4, 'D5'], [17.25, 'B4'], [18.05, 'G4']]
    .filter(([t]) => !casyZvoncekov.some((tL) => Math.abs(tL - t) < 0.12));
  skrinka.forEach(([t, f], i) => u.push({ t, typ: 'zvon', f, pomer: 2, index: 0.35, dlzka: 1.1, hlas: 0.032, pan: i % 2 ? 0.25 : -0.25, dozvuk: 0.5 }));
  // podvečer: tichý nádych, nižšia plocha C s nónou, hlboký zvon
  u.push({ t: T.vecer - 0.1, typ: 'sum', filter: 'lowpass', f0: 1200, f1: 260, q: 0.5, dlzka: 1.9, nabeh: 0.6, tvar: 'narast', hlas: 0.05, dozvuk: 0.5 });
  u.push({ t: T.vecer, typ: 'pad', noty: ['C3', 'G3', 'B3', 'D4', 'E4'], dlzka: T.nazov - T.vecer + 0.2, nabeh: 0.8, dobeh: 1.1, hlas: 0.12, filter: 700, filter2: 520 });
  u.push({ t: T.vecer + 0.05, typ: 'zvon', f: 'G3', index: 0.3, dlzka: 3.2, hlas: 0.06, dozvuk: 0.6 });
  // svetlušky: tiché vysoké trblietky, keď vyletia
  SVETLUSKY_T.forEach((t, n) => u.push({ t, typ: 'zvon', f: ['E6', 'G6', 'A6', 'B6', 'D7'][n % 5], pomer: 2, index: 0.25, dlzka: 0.7, hlas: 0.016, pan: n % 2 ? 0.4 : -0.4, dozvuk: 0.6 }));
  // cvrčky: dva, trojice krátkych cvrknutí, každý svojím tempom; v háku pokračujú presne v rytme konca
  u.push(...cvrkyCvrckov());
  // záver: plocha akordu háku pod názvom; znie až do konca v sile plochy háku a jej filter sa otvára k 1500 Hz
  // háku, v posledných 0,3 s dobehne, takže snímka 0 akord len znova udrie. Dozvuk po 19,0 s render odreže,
  // preto ide do dozvuku len 0,15 (iné plochy 0,35): odrezaný chvost na šve je o 7 dB tichší (20 log 0,15/0,35)
  u.push({ t: T.nazov - 0.25, typ: 'pad', noty: AKORD_HAKU, dlzka: DLZKA - (T.nazov - 0.25), nabeh: 1.0, dobeh: 0.3, hlas: 0.2 * HLAS_HAKU, filter: 800, filter2: 1500, dozvuk: 0.15 });
  u.push({ t: T.nazov, typ: 'zvon', f: 'G4', index: 0.5, dlzka: 3.5, hlas: 0.11, dozvuk: 0.55 });
  u.push({ t: T.nazov + 0.02, typ: 'zvon', f: 'D5', index: 0.4, dlzka: 3.0, hlas: 0.05, dozvuk: 0.55 });
  u.push({ t: T.veta, typ: 'zvon', f: 'B4', index: 0.4, dlzka: 1.6, hlas: 0.045, dozvuk: 0.5 });
  u.push({ t: T.adresa + 0.05, typ: 'tuk', f: 320, dlzka: 0.07, hlas: 0.05 });
  u.push({ t: T.adresa + 0.05, typ: 'zvon', f: 'B5', index: 0.5, dlzka: 0.9, hlas: 0.045, dozvuk: 0.5 });
  return u.sort((a, b) => a.t - b.t);
}
film.zvuk = partitura();

// ---------- pre test (bez prehliadača) ----------

film.kontrola = {
  T, TITULKY, SVETLA, VLNA, VLNA_CHYBA: VLNA_R.chyba, VECER_BOD, RANO_BOD, SCENA, INK, PRED, ODSTUP, BLIZKO, SVETLUSKA,
  DOHRA, ONESKORENIE, AKORD_HAKU, HLAS_HAKU, CVRK, CVRCKY,
  // scénka domu príbehu vo filmovom čase: [začiatok, koniec] (miesta.js act a trace, pozri DOHRA)
  scenka: (k) => scenka(k),
  // sprity domu k (bez izby) v čase t: so scénkou filmu, alebo ako keby ešte nezačala (bezSceny); test tak
  // overí, že scénka pri stojacej kamere naozaj niečo zmení (tabuľa Magpies bez nej aj tak bliká)
  kresliDom: (ctx, k, t, bezSceny) => {
    const pen = penPre(ctx), tl = t + ZIVOT;
    stavScen(t, false);
    if (bezSceny) ACT.done.delete(k);
    pen.scale(1); pen.eve = false;
    for (const s of SPRITY_MIEST) {
      if (s.pl.kluc !== k) continue;
      if (bezSceny) ACT.k = null; else aktivuj(k, t, false);
      s.draw(pen, tl);
    }
    ACT.k = null;
    pen.reset();
  },
  texty: [NAZOV, 'Puzzle', 'Village', VETA, ADRESA, ...T.domy.map((d) => meno(d.kluc)), ...TITULKY.map((c) => c.text)],
  kroky: () => L.kroky,
  kamera: (t) => kamera(t),
  faza: (t) => { const f = faza(t); return { spodok: f.spodok, kruh: f.kruh ? { vecer: f.kruh.vecer, r: f.kruh.r } : null }; },
  pokrytie: () => ({ ranoDo: L.ranoDo, vecerDo: L.vecerDo, ranoR: L.ranoR, vecerR: L.vecerR }),
  rozlozenie: () => ({ druh: L.R.F.druh, domov: L.R.domov, blizko: L.R.blizko, stredna: L.R.stredna, nazovPx: L.R.nazov.px, vetaPx: L.R.veta.px, adresaPx: L.R.adresa.px, stitokPx: L.R.stitokPx, titulokPx: L.texty.titulky.map((c) => c.sp.px), fokus: L.R.fokus, kotva: L.R.kotva, kotvaVlny: L.R.kotvaVlny, pasTitulkov: L.R.pasTitulkov, ranoR: L.ranoR, vecerR: L.vecerR }),
  // vytlačené plátna (papier mimo ostrova je jedno plátno na úroveň) a miesta, kde ležia
  dlazdice: () => L.dlazdice.map((svetlo) => svetlo.map((m) => new Set(m.values()).size + ':' + m.size)),
  // obdĺžniky na obrazovke (CSS px), aby test vedel, či štítok ani titulok nezakrývajú rozsvietené okno
  stitok: (k, t) => { const d = T.domy.find((x) => x.kluc === k), s = stitokStav(d, t); return s ? stitokRect(k, kamera(t), s.mier) : null; },
  stitky: (t) => T.domy.map((d) => { const s = stitokStav(d, t); return s ? { k: d.kluc, ...stitokRect(d.kluc, kamera(t), s.mier) } : null; }).filter(Boolean),
  // kde by štítok bol bez zovretia do zóny (spodný stred nad domom), aby test videl, či sa neodtrhol od domu
  kotvaStitku: (k, t) => { const [x, y] = naObrazovku(kamera(t), L.R.kotvaStitku[k]); return [x, y - 12 * L.R.u]; },
  titulok: (t) => { const c = L.texty.titulky.find((x) => t >= x.od && t <= x.do); return c ? titulokRect(c, t) : null; },
  okna: (k, t) => {
    const kam = kamera(t), Lw = SVET.lights.get(k);
    return Lw.polys.map((w) => { const [x, y] = naObrazovku(kam, [w.cx, w.cy]); const r = w.R * kam.z; return { x: x - r, y: y - r, w: 2 * r, h: 2 * r }; });
  },
  svetlo: (k, t) => svetloNaObrazovke(kamera(t), k),
  vZabere: (r) => vZabere(L.R, r),
  hlavicka: (t) => stavHlavicky(t),
  zvysokTlace: () => (L.zvysok ? L.zvysok.length : 0),
  naObrazovku: (t, q) => naObrazovku(kamera(t), q),
};

export default film;
