/* Vzory zmlúv: skladanie dokumentov z textov v data-sk.js.
 *
 * Rovnaký tvar ako pri GDPR dokumentoch: každý dokument je záznam s funkciou
 * fn(d), ktorá z údajov formulára vráti zoznam blokov
 * { h: úroveň, t: text }, { p: text }, { ul: [texty] }, { tbl: [[bunky]] }.
 * Ten istý zoznam kreslí náhľad na stránke (app.js) aj súbor DOCX (docx.js),
 * takže obe podoby sú vždy rovnaké. Tučné písmo sa píše medzi dve hviezdičky.
 *
 * Údaje formulára sú plochý objekt: kľúč je presné id poľa z JSON, aj keď
 * obsahuje bodku ("prenajimatel.meno"). Prázdne pole má hodnotu "" a v texte
 * ho nahradí zástupný text v hranatých zátvorkách, aby bolo v náhľade jasne
 * vidieť, čo ešte treba doplniť.
 *
 * Právny stav textov a zoznam predpisov je v DATA.pravnyStav; stránka ho
 * vypisuje v časti Zdroje, aby si to čitateľ vedel overiť na slov-lex.sk.
 *
 * Toto nie je právne poradenstvo. Sú to všeobecné vzory, ktoré si má človek
 * pred podpisom prečítať a upraviť podľa svojej situácie.
 */
import { DATA } from './data-sk.js';

export const VERZIA = DATA.verzia;
export const PRAVNY_STAV = DATA.pravnyStav;

/* === Hodnoty polí ===================================================== */

/* Dátum z poľa typu datum do slovenského tvaru: 2026-09-11 na 11. 9. 2026. */
export function datumSK(iso) {
  const [y, m, dd] = String(iso || '').split('-');
  return y && m && dd ? `${+dd}. ${+m}. ${y}` : String(iso || '');
}

const MAPY = new WeakMap();
function polePodlaId(dok, id) {
  let m = MAPY.get(dok);
  if (!m) { m = new Map(dok.polia.map((p) => [p.id, p])); MAPY.set(dok, m); }
  return m.get(id) || null;
}

/* Surová hodnota poľa: pri zaškrtnutí boolean, inak text.
 * Keď človek pole nechal tak, ako mu ho stránka predvyplnila, platí
 * predvolená hodnota z JSON; vďaka tomu dáva zmysel aj úplne prázdny
 * formulár (výber režimu, doby, spôsobu platby a podobne). */
export function hodnota(dok, d, id) {
  const p = polePodlaId(dok, id);
  const je = d && Object.prototype.hasOwnProperty.call(d, id);
  const surova = je ? d[id] : undefined;
  if (p && p.typ === 'zaskrtnutie') {
    if (surova === undefined || surova === null || surova === '') return !!(p && p.predvolene);
    return surova === true || surova === 'true' || surova === 'ano';
  }
  let v = surova === undefined || surova === null ? '' : String(surova).trim();
  if (!v && p && p.predvolene) v = String(p.predvolene);
  return v;
}

/* Text vybranej možnosti pri poli typu vyber ({{pole@text}}). */
function textMoznosti(dok, d, id) {
  const p = polePodlaId(dok, id);
  const v = hodnota(dok, d, id);
  if (!p || !p.moznosti || !p.moznosti.length) return String(v || '');
  const m = p.moznosti.find((x) => x.hodnota === v);
  return m ? m.text : '';
}

/* Hodnota tak, ako sa vkladá do vety. */
function doVety(dok, d, id) {
  const p = polePodlaId(dok, id);
  const v = hodnota(dok, d, id);
  if (p && p.typ === 'zaskrtnutie') return v ? 'áno' : 'nie';
  if (p && p.typ === 'datum') return v ? datumSK(v) : '';
  return String(v || '');
}

/* === Podmienky ======================================================== */

export function podmienkaPlati(dok, d, c) {
  if (!c) return true;
  if (Array.isArray(c)) return c.every((x) => podmienkaPlati(dok, d, x));
  if (c.alebo) return c.alebo.some((x) => podmienkaPlati(dok, d, x));
  if (!c.pole) return true;
  const v = hodnota(dok, d, c.pole);
  if (Object.prototype.hasOwnProperty.call(c, 'rovna')) return v === c.rovna;
  if (Object.prototype.hasOwnProperty.call(c, 'nerovna')) return v !== c.nerovna;
  if (Object.prototype.hasOwnProperty.call(c, 'vZozname')) return (c.vZozname || []).includes(v);
  if (Object.prototype.hasOwnProperty.call(c, 'vyplnene')) {
    const ma = v === true || (typeof v === 'string' && v.trim() !== '');
    return c.vyplnene ? ma : !ma;
  }
  return true;
}

/* === Zástupné hodnoty v texte ========================================= */

/* {{pole}}, {{pole|náhrada}}, {{pole@text}}, {{pole@text|náhrada}}.
 * Náhrada sa vypíše v hranatých zátvorkách, teda [meno prenajímateľa]. */
export function doplnText(dok, d, s) {
  return String(s === undefined || s === null ? '' : s).replace(/\{\{([^}]+)\}\}/g, (cele, vnutro) => {
    const zvisla = vnutro.indexOf('|');
    const cesta = (zvisla >= 0 ? vnutro.slice(0, zvisla) : vnutro).trim();
    const nahrada = zvisla >= 0 ? vnutro.slice(zvisla + 1).trim() : '';
    const zaText = cesta.endsWith('@text');
    const id = zaText ? cesta.slice(0, -5) : cesta;
    const v = zaText ? textMoznosti(dok, d, id) : doVety(dok, d, id);
    if (v) return v;
    return nahrada ? '[' + nahrada + ']' : '';
  });
}

/* === Bloky dokumentu ================================================== */

export function blokyDokumentu(dok, d) {
  const out = [];
  for (const b of dok.bloky) {
    if (!podmienkaPlati(dok, d, b.ak)) continue;
    if (b.h) { out.push({ h: b.h, t: doplnText(dok, d, b.t) }); continue; }
    if (b.p !== undefined) { out.push({ p: doplnText(dok, d, b.p) }); continue; }
    if (b.ul) {
      const polozky = [];
      for (const it of b.ul) {
        if (typeof it === 'string') { polozky.push(doplnText(dok, d, it)); continue; }
        if (podmienkaPlati(dok, d, it.ak)) polozky.push(doplnText(dok, d, it.t));
      }
      if (polozky.length) out.push({ ul: polozky });
      continue;
    }
    if (b.tbl) out.push({ tbl: b.tbl.map((r) => r.map((c) => doplnText(dok, d, c))) });
  }
  return out;
}

/* === Povinné polia ==================================================== */

/* Pole je povinné, keď má "povinne": true, alebo keď platí jeho "povinneAk".
 * Zoznam používa formulár (červené upozornenie) aj sťahovanie: bez povinných
 * údajov je zmluva neúplná a nemá zmysel ju sťahovať. */
export function jePovinne(dok, d, p) {
  if (p.povinne) return true;
  if (p.povinneAk) return podmienkaPlati(dok, d, p.povinneAk);
  return false;
}

export function chybajucePovinne(dok, d) {
  const out = [];
  for (const p of dok.polia) {
    if (!jePovinne(dok, d, p)) continue;
    const v = hodnota(dok, d, p.id);
    const ma = v === true || (typeof v === 'string' && v.trim() !== '');
    if (!ma) out.push(p);
  }
  return out;
}

/* === Zoznam dokumentov ================================================ */

export const DOKUMENTY = DATA.dokumenty.map((dok) => ({
  id: dok.id,
  nazov: dok.nazov,
  popis: dok.popis,
  polia: dok.polia,
  faq: dok.faq,
  paragrafy: dok.paragrafy,
  poznamka: dok.poznamka,
  zdroj: dok,
  fn: (d) => blokyDokumentu(dok, d || {}),
}));

export function dokumentPodlaId(id) {
  return DOKUMENTY.find((x) => x.id === id) || DOKUMENTY[0];
}

/* Pri GDPR sa zoznam menil podľa zaškrtnutého (zamestnanci, kamery).
 * Tu je päť dokumentov vždy; funkcia ostáva kvôli rovnakému tvaru app.js. */
export function zoznamDokumentov() {
  return DOKUMENTY;
}

/* Predvyplnený formulár: predvolené hodnoty z JSON. Používa ho stránka pri
 * prvom otvorení dokumentu aj testy. */
export function prazdnyFormular(dok) {
  const d = {};
  for (const p of dok.polia) {
    if (p.typ === 'zaskrtnutie') d[p.id] = !!p.predvolene;
    else d[p.id] = p.predvolene === undefined || p.predvolene === null ? '' : String(p.predvolene);
  }
  return d;
}
