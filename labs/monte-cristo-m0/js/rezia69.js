/* Rezia kapitoly 69: kde kto je, svetlo, kamera, ukony, ciele Pozornosti a gesta k tonom.
 * Vsetko tu je NAVRH inscenacie. Repliky a rozpravanie su len v data-69.json (doslovne,
 * s riadkom); vlastny text hry (vyzvy) je anglicky a nikdy sa nepodava ako citat. */
import { SVETY69 } from './kulisy/pariz.js';

const B = SVETY69.busoni, W = SVETY69.wilmore;
const HORE = B.horna, DOLE = B.dolna, WP = W.podlaha;

export const KAPITOLA = 69;
export const TON_KTO = 'Busoni';

/* cesty: body po svete, m = chod */
export const CESTY = {
  /* vyslanec vecer: od dveri po schodoch do kniznice */
  hore: [{ x: 300, y: DOLE }, { x: 356, y: DOLE }, { x: 500, y: HORE }, { x: 596, y: HORE }],
  /* Busoni odprevadi hosta dolu k dveram */
  dolu: [{ x: 756, y: HORE }, { x: 596, y: HORE }, { x: 500, y: HORE }, { x: 356, y: DOLE }, { x: 318, y: DOLE }],
};

const BUSONI_ODEV = ['rucho', 'kapuca', 'okuliare'];
const VECER_B = { tint: 0.42, tma: 0.62, lampa: 1, tienidlo: 0, cervenie: 0, lampy: 0 };
const KNIZNICA = {
  kulisa: 'dom', svet: 'busoni', kam: { x: 392 },
  svetlo: VECER_B,
  dom: { dvere: 0, okienko: 0, kocarX: -300, lampa: true, lampaX: 690 },
  herci: {
    grof: { vid: true, x: B.stolickaB, y: HORE, smer: -1, poza: 'sedStol', vrstvy: BUSONI_ODEV, okuliare: true },
    vyslanec: { vid: true, x: B.stolickaV, y: HORE, smer: 1, poza: 'sedStol' },
    komornik: { vid: true, x: 690, y: DOLE, smer: -1, poza: 'sed' },
    sluha: { vid: false },
  },
  opis: 'The library in Busoni’s house, cut open like a doll’s house. The abbé in his monk’s dress and cowl sits at a table under a lamp with a large shade; the stranger sits opposite, his face in the shadow of his hat. The rest of the room is in partial darkness.',
};
const SALON = {
  kulisa: 'dom', svet: 'wilmore', kam: { x: 212 },
  svetlo: { tint: 0.38, tma: 0.3, lampy: 0.9, lampa: 0, tienidlo: 0, cervenie: 0 },
  dom: { dvereW: 1 },
  herci: {
    grof: { vid: true, x: 606, y: WP, smer: -1, poza: 'stoj', vrstvy: 'jadro' },
    vyslanec: { vid: true, x: W.kreslo + 2, y: WP, smer: 1, poza: 'sedStrnuly' },
    komornik: { vid: false }, sluha: { vid: false },
  },
  opis: 'Lord Wilmore’s drawing-room: a mantelpiece with two Sèvres vases and a clock with Cupid, a mirror between two engravings, grayish paper, red and black upholstery, lamps with ground-glass shades. Lord Wilmore stands by the fireplace; the envoy sits in an armchair.',
};

export const BEATY = {
  c01: { kulisa: 'tablo', tablo: 'tablo:69prolog', dron: false, opis: 'Two notes on a dark desk by candlelight: the report from M. de Boville, and the details of the abbé Busoni and Lord Wilmore.' },
  c02: {
    kulisa: 'dom', svet: 'busoni', kam: { x: 40 },
    svetlo: { tint: 0, tma: 0, lampa: 0, tienidlo: 0, cervenie: 0, lampy: 0 },
    dom: { dvere: 0, okienko: 0, kocarX: -6, lampa: false, lampaX: 668 },
    herci: {
      vyslanec: { vid: true, x: 240, y: DOLE, smer: 1, poza: 'stoj' },
      komornik: { vid: true, x: 348, y: DOLE, smer: -1, poza: 'okienko' },
      grof: { vid: false }, sluha: { vid: false },
    },
    opis: 'Morning in the Rue Férou. A carriage waits at the corner; a man knocks at an olive-green door. Inside, in the house cut open like a doll’s house, the valet looks out through a small wicket.',
  },
  c03: {
    kulisa: 'dom', svet: 'busoni', kam: { x: 520 },
    svetlo: { tint: 0.42, tma: 0.3, lampa: 0, tienidlo: 0, cervenie: 0, lampy: 0 },
    dom: { dvere: 0, okienko: 0, kocarX: -300, lampa: true, lampaX: 668 },
    herci: {
      grof: { vid: true, x: 1040, y: HORE, smer: -1, poza: 'stoj', vrstvy: [] },
      komornik: { vid: true, x: 690, y: DOLE, smer: -1, poza: 'sed' },
      vyslanec: { vid: false }, sluha: { vid: false },
    },
    opis: 'Evening upstairs in Busoni’s house: the library with its books and parchments, and the bedroom with a bed without curtains, a yellow sofa and a prie-dieu. The count, in his own clothes, holds a sealed paper. A monk’s dress and a cowl hang on a peg.',
  },
  c04: {
    kulisa: 'dom', svet: 'busoni', kam: { x: 70 },
    svetlo: { tint: 0.42, tma: 0.62, lampa: 1, tienidlo: 0, cervenie: 0, lampy: 0 },
    dom: { dvere: 0, okienko: 0, kocarX: 64, lampa: true, lampaX: 690 },
    herci: {
      vyslanec: { vid: true, x: 214, y: DOLE, smer: 1, poza: 'stoj' },
      komornik: { vid: true, x: 352, y: DOLE, smer: -1, poza: 'stoj' },
      grof: { vid: true, x: 742, y: HORE, smer: -1, poza: 'stojRuky', vrstvy: BUSONI_ODEV, okuliare: false },
      sluha: { vid: false },
    },
    opis: 'Evening in the Rue Férou. The carriage drives up to the green door. Upstairs a single lamp burns in the library.',
  },
  c05: KNIZNICA,
  c06: { kulisa: 'mapa69', dron: false, opis: 'A map of Paris. From the Rue Férou behind Saint-Sulpice a dotted red line runs to the house of M. de Villefort in the Faubourg Saint-Honoré, and on to No. 5, Rue Fontaine-Saint-Georges.' },
  c07: {
    kulisa: 'dom', svet: 'wilmore', kam: { x: 0 },
    svetlo: { tint: 0.38, tma: 0.3, lampy: 0.9, lampa: 0, tienidlo: 0, cervenie: 0 },
    dom: { dvereW: 0 },
    herci: {
      grof: { vid: true, x: 250, y: WP, smer: 1, poza: 'stoj', vrstvy: [] },
      vyslanec: { vid: true, x: W.kreslo + 2, y: WP, smer: 1, poza: 'sedStrnuly' },
      komornik: { vid: false }, sluha: { vid: false },
    },
    opis: 'Lord Wilmore’s hired apartment in section: on the left the bedroom, where the count dresses; on the right, behind a closed door, the drawing-room where the envoy waits.',
  },
  c08: {
    kulisa: 'dom', svet: 'wilmore', kam: { x: 200 },
    svetlo: { tint: 0.38, tma: 0.3, lampy: 0.9, lampa: 0, tienidlo: 0, cervenie: 0 },
    dom: { dvereW: 0 },
    herci: {
      grof: { vid: true, x: 378, y: WP, smer: 1, poza: 'stoj', vrstvy: 'jadro' },
      vyslanec: { vid: true, x: W.kreslo + 2, y: WP, smer: 1, poza: 'sedStrnuly' },
      sluha: { vid: true, x: 858, y: WP, smer: -1, poza: 'stoj' },
      komornik: { vid: false },
    },
    opis: 'The drawing-room, lit by lamps with ground-glass shades. The envoy waits in an armchair; behind the door on the left, Lord Wilmore waits for the clock.',
  },
  c09: SALON,
  c10: SALON,
  c11: {
    kulisa: 'dom', svet: 'wilmore', kam: { x: 0 },
    svetlo: { tint: 0.38, tma: 0.34, lampy: 0.9, lampa: 0, tienidlo: 0, cervenie: 0 },
    dom: { dvereW: 1 },
    herci: {
      grof: { vid: true, x: 470, y: WP, smer: -1, poza: 'stoj', vrstvy: 'jadro', golier: true },
      vyslanec: { vid: false }, komornik: { vid: false }, sluha: { vid: false },
    },
    opis: 'Lord Wilmore goes back into his bedroom. The drawing-room behind him is empty.',
  },
  c12: { kulisa: 'villefort', dron: false, opis: 'Night in the house of M. de Villefort. He sleeps. His gold spectacles lie beside the lamp; on the chair, a hat and a dark coat, the envoy’s clothes.' },
};

/* Ciele Pozornosti: v liste (riadok knihy), vo svete (x, y) alebo na hercovi (v krokoch). */
export const CIELE = {
  p_d01: { list: 37286, en: 'never a word of French' },
  p_d02: { list: 37272, en: 'the wicket' },
  p_d03: { list: 37276, en: 'alms through the wicket' },
  p_u1: { herec: 'vyslanec', en: 'his face', kroky: ['n_cervenie'], nad: true },
  p_u2: { herec: 'vyslanec', en: 'his hand before his eyes', kroky: ['r_oci', 'a_tienidlo_dole'], nad: true },
  p_rytiny: { x: 706, y: 150, en: 'the two engravings', nad: true },
  p_lampy: { x: 474, y: 212, en: 'the ground-glass shades' },
};

/* Gesta k tonom (NAVRH, v scenar-69.md) */
export const GESTA = {
  't69a:vlidne': { vyslanec: { poza: 'sedPredklon' } },
  't69a:vazne': { vyslanec: { poza: 'sedStrnuly' } },
  't69a:chladne': { vyslanec: { poza: 'sedStrnuly' }, grof: { poza: 'sedStrnuly' } },
  't69b:jemne': { vyslanec: { poza: 'stoj', rek: null } },
  't69b:pevne': { vyslanec: { poza: 'uklon' } },
  't69b:mlcky': { grof: { poza: 'uklon' } },
};

/* Pocuvanie: zvuk podla mena funkcie v zvuk.js */
export const POCUVANIE = {
  o_okienko: { zvuk: 'hlasy', smer: -0.4, auto: 5 },
  o_hodiny: { zvuk: 'tikot', smer: 0.7, auto: 4, volitelne: true },
  o_dvere: { zvuk: 'dvereZatvor', smer: 0.8, auto: 3 },
};

/* Ukony. druh: drzat, stlacit, cesta, prevlek, kniha. efekt = co sa pri drzani deje v scene. */
export const AKCIE = {
  a_papier: { druh: 'drzat', detail: 'pecat', trvanie: 1.4, udrzat: 0.5, vyzva: 'Hold to break the seal and unfold the paper', poznamka: 'The book does not give its words.' },
  a_obliect_busoni: { druh: 'prevlek', rezim: 'busoni' },
  a_lampa_polozit: { druh: 'drzat', efekt: 'lampa', trvanie: 1.8, vyzva: 'Hold to set the lamp on the table and turn it up' },
  a_kniha_svedkov: { druh: 'kniha' },
  a_okuliare: { druh: 'stlacit', vyzva: 'Put on your spectacles and sit down' },
  a_tienidlo_hore: { druh: 'drzat', efekt: 'tienidlo', trvanie: 1.3, udrzat: 0.3, vyzva: 'Hold to press down your side of the shade' },
  a_tienidlo_dole: { druh: 'stlacit', vyzva: 'Lower the shade when you are ready' },
  a_odprevadit: { druh: 'cesta', kto: 'grof', cesta: 'dolu', vyzva: 'Walk your guest down to the door', nasleduje: { meno: 'vyslanec', odstup: -36 }, samoKoniec: true },
  a_uklon_busoni: { druh: 'stlacit', vyzva: 'Open the door and bow' },
  a_cesta: { druh: 'drzat', efekt: 'mapa', trvanie: 3, vyzva: 'Hold to drive to the Rue Fontaine-Saint-Georges before him' },
  a_list_vyslanca: { druh: 'drzat', detail: 'list69', trvanie: 1.4, udrzat: 0.5, vyzva: 'Hold to take the letter and read it', poznamka: 'The book does not give its words.' },
  a_golier: { druh: 'stlacit', vyzva: 'Turn down your shirt collar' },
  a_uklon_wilmore: { druh: 'stlacit', vyzva: 'Bow stiffly, as an Englishman bows' },
  a_jednou_rukou: { druh: 'stlacit', vyzva: 'With one hand, pull it all off' },
};

/* Kratke nazvy vrstiev prevleku pre vlastny text hry (nie citat). */
export const VRSTVY_EN = {
  rucho: 'the monk’s dress', kapuca: 'the cowl', okuliare: 'the spectacles',
  nohavice: 'the pantaloons', vesta: 'the waistcoat', jazva: 'the wound', kabat: 'the coat',
  plet: 'the complexion', vlasy: 'the hair', bokombrady: 'the whiskers', celust: 'the false jaw',
};

/* Vysvetlenie navratu na kontrolny bod (vlastny text). */
export const NAVRATY = {
  prevlek: (res) => `The book describes Lord Wilmore at the door with ${res.chybaju.map((q) => VRSTVY_EN[q] || q).join(', ')}. The envoy would see a different man. Dress again.`,
  neskoro: () => 'The ten minutes are gone and Lord Wilmore is not dressed. He is punctuality itself, so the evening begins again in the bedroom.',
  uder: () => 'Lord Wilmore returns as the clock strikes, not before and not after. Wait by the door again for the strokes.',
  jazva: () => 'You turn down the collar and there is nothing under it. Lord Wilmore must be dressed again, the wound under the collar before the coat.',
  S_nepriatel: () => 'The Book of Witnesses will not close: the friend never named the count’s enemy, so nothing explains why Lord Wilmore hates him. Back to the envoy’s question about enemies.',
  S_auteuil: () => 'The Book of Witnesses will not close: nothing explains why the garden at Auteuil was dug. Back to the envoy’s question about the house.',
  S_presnost: () => 'Lord Wilmore was not punctual. Back to the clock.',
  S_jazyk: () => 'Lord Wilmore spoke French. Back to the bedroom.',
};

/* Scena pri jednotlivych krokoch (volane z hra.js pri kazdom zobrazenom kroku). */
export function priKroku(x, hra) {
  const k = x.k, sc = hra.scena, st = sc.st, z = hra.zvuk;
  const r0 = k.r && k.r[0];
  if (x.beat.id === 'c02') {
    if (k.typ === 'rozpravanie' && r0 === 37290) { hra.ui.titulok(z.klepanie(-0.5), -0.5); }
    if (k.typ === 'replika' && r0 === 37295) { st.dom.okienko = 1; hra.ui.titulok(z.okienko(-0.3), -0.3); }
    if (k.typ === 'replika' && r0 === 37303) { st.herci.vyslanec.rek = { rukaP: { meno: 'rek69:list', uhol: -0.6 } }; hra.pozaNa('vyslanec', hra.P.ukazat2 || hra.P.dvere, 0.5); }
    if (k.typ === 'replika' && r0 === 37308) { st.herci.vyslanec.rek = null; hra.pozaNa('vyslanec', hra.P.stoj, 0.4); st.dom.okienko = 0; }
  }
  if (x.beat.id === 'c04') {
    if (r0 === 37311) { sc.tween(st.dom, 'kocarX', 64, 0.01); hra.ui.titulok(z.kocar(-0.6), -0.6); setTimeout(() => { if (hra.x === x) { hra.ui.titulok(z.klepanie(-0.3), -0.3); sc.tween(st.dom, 'dvere', 1, 0.5); hra.pozaNa('komornik', hra.P.uklon, 0.6); } }, 1600); }
    if (r0 === 37317) { st.dom.dvere = 1; }
    if (r0 === 37320 && k.typ === 'rozpravanie') {
      st.dom.dvere = 1;
      hra.pozaNa('komornik', hra.P.stoj, 0.3);
      hra.chodCestou('vyslanec', CESTY.hore, () => { st.kam.sleduj = null; st.kam.ciel = 392; });
      st.kam.sleduj = 'vyslanec';
      hra.ui.titulok(z.kroky(0, 7), 0);
    }
    if (r0 === 37326) {
      /* hosť uz stoji v kniznici, aj ked hrac preskocil chodzu */
      hra.dokonciCestu('vyslanec', CESTY.hore);
      st.kam.sleduj = null; st.kam.ciel = 392;
      Object.assign(st.herci.komornik, { x: 690, poza: hra.P.sed });
      st.dom.dvere = 0;
    }
    if (k.id === 'n_cervenie') sc.tween(st.svetlo, 'cervenie', 1, 0.8);
    else if (st.svetlo.cervenie > 0 && x.beat.id === 'c04' && r0 !== 37336) sc.tween(st.svetlo, 'cervenie', 0, 1.2);
    if (k.id === 'r_oci') hra.pozaNa('vyslanec', hra.P.sedClona, 0.5);
  }
  if (x.beat.id === 'c05') {
    if (r0 === 37563 && k.typ === 'rozpravanie') hra.pozaNa('grof', hra.P.sedPredklon, 0.6);
    if (r0 === 37566) { hra.pozaNa('grof', hra.P.sedStol, 0.4); hra.pozaNa('vyslanec', hra.P.stoj, 0.8); }
    if (r0 === 37569) { st.herci.vyslanec.rek = { rukaP: { meno: 'rek69:mesec', uhol: -0.2 } }; hra.pozaNa('vyslanec', hra.P.dvere, 0.5); }
    if (r0 === 37582) { sc.tween(st.dom, 'dvere', 1, 0.5); }
  }
  if (x.beat.id === 'c06') {
    if (k.id === 'n_kocar') { hra.ui.titulok(z.kocar(0), 0); sc.tween(st.m69, 'kocar', 1, sc.znizeny ? 0 : 3.2); }
    if (r0 === 37586) { st.m69.kocar = 1; hra.ui.titulok(z.kocar(0.2), 0.2); sc.tween(st.m69, 'kocar2', 1, sc.znizeny ? 0 : 3.2); }
  }
  if (x.beat.id === 'c08') {
    if (k.typ === 'rozpravanie' && r0 === 37593) setTimeout(() => { if (hra.x === x) hra.chod('sluha', 950, hra.P.stoj); }, 900);
    if (r0 === 37601) {
      st.herci.sluha.vid = false;
      st.dom.dvereW = 1;
      Object.assign(st.herci.grof, { x: 410, smer: 1 });
      hra.chod('grof', 470, hra.P.stoj);
    }
    if (r0 === 37603) { st.dom.dvereW = 1; Object.assign(st.herci.grof, { x: 470, smer: 1, poza: hra.P.stoj }); }
  }
  if (x.beat.id === 'c09' || x.beat.id === 'c10') {
    if (x.beat.id === 'c09' && k.id === 'W0') { Object.assign(st.herci.grof, { x: 606, smer: -1 }); }
    if (r0 === 37709) { hra.pozaNa('vyslanec', hra.P.stoj, 0.8); }
  }
  if (x.beat.id === 'c11' && k.typ === 'pocuvanie') {
    hra.chod('grof', 262, hra.P.stoj);
    st.kam.ciel = 0;
    setTimeout(() => { if (hra.x === x) sc.tween(st.dom, 'dvereW', 0, 0.3); }, 1800);
  }
  if (x.beat.id === 'c12' && k.typ === 'rozpravanie' && r0 === 37718) { st.vlampa = 1; }
}

/* Po dokonceni ukonu (pred posunom jadra). Vrati Promise. */
export async function poAkcii(id, hra) {
  const sc = hra.scena, st = sc.st, z = hra.zvuk;
  const cakaj = (ms) => new Promise((r) => setTimeout(r, sc.znizeny ? Math.min(ms, 150) : ms));
  const g = st.herci.grof;
  if (id === 'a_papier') { sc.detail = null; hra.ui.titulok(AKCIE.a_papier.poznamka, 0); await cakaj(400); }
  if (id === 'a_list_vyslanca') { sc.detail = null; hra.ui.titulok(AKCIE.a_list_vyslanca.poznamka, 0); await cakaj(400); }
  if (id === 'a_obliect_busoni') { st.kam.sleduj = 'grof'; await hra.chod('grof', 742, hra.P.stojRuky); st.kam.sleduj = null; st.kam.ciel = 392; }
  if (id === 'a_okuliare') {
    g.okuliareNaOciach = true;
    hra.pozaNa('grof', hra.P.ukazat, 0.5);
    await cakaj(500);
    Object.assign(g, { x: B.stolickaB });
    hra.pozaNa('grof', hra.P.sedStol, 0.6);
    await hra.chod('vyslanec', B.stolickaV, hra.P.stoj);
    st.herci.vyslanec.smer = 1;
    hra.pozaNa('vyslanec', hra.P.sedStol, 0.6);
    await cakaj(500);
  }
  if (id === 'a_tienidlo_dole') { hra.ui.titulok(z.cvak(), 0); sc.tween(st.svetlo, 'tienidlo', 0, 0.6); hra.pozaNa('vyslanec', hra.P.sedStol, 0.6); hra.pozaNa('grof', hra.P.sedStol, 0.5); await cakaj(500); }
  if (id === 'a_uklon_busoni') {
    hra.pozaNa('grof', hra.P.uklon, 0.5);
    hra.pozaNa('vyslanec', hra.P.uklon, 0.5);
    await cakaj(900);
    hra.pozaNa('grof', hra.P.stojRuky, 0.5);
    st.herci.vyslanec.rek = null;
    hra.pozaNa('vyslanec', hra.P.stoj, 0.4);
    await hra.chod('vyslanec', 170, hra.P.stoj);
    st.herci.vyslanec.vid = false;
    sc.tween(st.dom, 'dvere', 0, 0.4);
  }
  if (id === 'a_golier') { g.golierDole = true; hra.pozaNa('grof', hra.P.golierStoj || hra.P.golier, 0.5); await cakaj(1100); }
  if (id === 'a_uklon_wilmore') {
    hra.pozaNa('grof', hra.P.uklonStrnuly, 0.35);
    hra.pozaNa('vyslanec', hra.P.uklon, 0.5);
    await cakaj(800);
    hra.pozaNa('grof', hra.P.stoj, 0.35);
    hra.pozaNa('vyslanec', hra.P.stoj, 0.4);
    await hra.chod('vyslanec', 930, hra.P.stoj);
    st.herci.vyslanec.vid = false;
  }
  if (id === 'a_jednou_rukou') {
    hra.pozaNa('grof', hra.P.strhnut, 0.4);
    await cakaj(380);
    hra.ui.titulok(z.latka(0), 0);
    await new Promise((res) => sc.tween(g, 'strhava', 1, sc.znizeny ? 0 : 1.1, res));
    for (const q of ['vlasy', 'bokombrady', 'celust', 'jazva', 'plet']) g.vrstvy.delete(q);
    g.strhava = 0;
    hra.pozaNa('grof', hra.P.stoj, 0.6);
    await cakaj(700);
  }
}

/* Drzanie s efektom v scene: p = 0 az 1. */
export function efekt(meno, p, hra) {
  const st = hra.scena.st;
  if (meno === 'lampa') {
    st.dom.lampa = true;
    st.dom.lampaX = 668 + 22 * Math.min(1, p * 1.4);
    st.svetlo.lampa = Math.max(0, (p - 0.3) / 0.7);
    st.svetlo.tma = 0.3 + 0.32 * st.svetlo.lampa;
  } else if (meno === 'tienidlo') {
    st.svetlo.tienidlo = p;
    const vy = st.herci.vyslanec;
    if (p > 0.55 && vy.poza !== hra.P.sedClona && !hra.anim.has('vyslanec')) hra.pozaNa('vyslanec', hra.P.sedClona, 0.5);
    if (p > 0.1 && st.herci.grof.poza !== hra.P.sedTienidlo && !hra.anim.has('grof')) hra.pozaNa('grof', hra.P.sedTienidlo, 0.3);
  } else if (meno === 'mapa') st.m69.grof = p;
}

/* Scena pred zaciatkom beatu, ktora zavisi od stavu jadra (prevlek). */
export function vrstvyGrofa(beatId, jadro) {
  const r = BEATY[beatId];
  const h = r && r.herci && r.herci.grof;
  if (!h) return null;
  if (h.vrstvy === 'jadro') return [...jadro.st.vrstvy];
  return h.vrstvy || [];
}
