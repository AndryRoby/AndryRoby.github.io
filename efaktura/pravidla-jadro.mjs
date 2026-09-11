// pravidla-jadro.mjs - spolocne pomocky pre kontrolu e-faktury.
// Kontext = rozparsovany doklad pripraveny tak, aby sa jednotlive pravidla dali napisat kratko.

import { deti, prve, cesta, jeden, txt, hod, atr, vsetky, xpath } from './parser.mjs';
import { povodneZnenie } from './pravidla-texty.mjs';

export { deti, prve, cesta, jeden, txt, hod, atr, vsetky, xpath };

/** Cislo z textu UBL (bodka ako desatinna ciarka). NaN, ak to nie je cislo. */
export function cis(s) {
  const t = String(s == null ? '' : s).trim();
  if (t === '' || !/^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(t)) return NaN;
  return Number(t);
}

/** Zaokruhlenie na 2 desatinne miesta, pol nahor od nuly, s poistkou proti chybe plavajucej ciarky. */
export function r2(x) {
  if (!Number.isFinite(x)) return NaN;
  const z = x < 0 ? -1 : 1;
  return (z * Math.round(Math.abs(x) * 100 + 1e-6)) / 100;
}

/** Pocet desatinnych miest zapisanych v texte (tak, ako to ratá schematron). */
export function desatinne(s) {
  const t = String(s == null ? '' : s);
  const i = t.indexOf('.');
  return i === -1 ? 0 : t.length - i - 1;
}

/** Rovnaju sa sumy po zaokruhleni na halier? */
export function rovnake2(a, b) {
  return Number.isFinite(a) && Number.isFinite(b) && r2(a) === r2(b);
}

/** Tolerancia EN 16931 pre sucin zaklad krat sadzba: rozdiel musi byt mensi ako 1 jednotka meny. */
export function doJednotky(suma, ocakavane) {
  if (!Number.isFinite(suma) || !Number.isFinite(ocakavane)) return false;
  const o = r2(ocakavane);
  return Math.abs(suma) - 1 < o && Math.abs(suma) + 1 > o;
}

/** Tolerancia Peppol (u:slack). */
export function volne(a, b, tolerancia) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) <= tolerancia + 1e-9;
}

/** Je to platny kalendarny datum v tvare RRRR-MM-DD? */
export function platnyDatum(s) {
  const t = String(s == null ? '' : s).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (!m) return false;
  const rok = Number(m[1]);
  const mes = Number(m[2]);
  const den = Number(m[3]);
  if (mes < 1 || mes > 12 || den < 1) return false;
  const dni = new Date(Date.UTC(rok, mes, 0)).getUTCDate();
  return den <= dni;
}

/** Danova kategoria (cac:TaxCategory alebo cac:ClassifiedTaxCategory) so schemou VAT. */
export function katVat(u, kluc) {
  const kandidati = deti(u, kluc);
  const sVat = kandidati.filter((k) => hod(k, 'cac:TaxScheme/cbc:ID').toUpperCase() === 'VAT');
  if (sVat.length) return sVat[0];
  return kandidati.length ? kandidati[0] : null;
}

/** Kod kategorie DPH riadku faktury (BT-151). */
export function katRiadku(riadok) {
  const k = katVat(jeden(riadok, 'cac:Item'), 'cac:ClassifiedTaxCategory');
  return k ? hod(k, 'cbc:ID') : '';
}

/** Sadzba DPH riadku faktury (BT-152) ako text. */
export function sadzbaRiadku(riadok) {
  const k = katVat(jeden(riadok, 'cac:Item'), 'cac:ClassifiedTaxCategory');
  return k ? hod(k, 'cbc:Percent') : '';
}

/** Kod kategorie DPH zlavy alebo priplatku (BT-95 / BT-102). */
export function katZlavy(ac) {
  const k = katVat(ac, 'cac:TaxCategory');
  return k ? hod(k, 'cbc:ID') : '';
}

/** Sadzba DPH zlavy alebo priplatku ako text. */
export function sadzbaZlavy(ac) {
  const k = katVat(ac, 'cac:TaxCategory');
  return k ? hod(k, 'cbc:Percent') : '';
}

/**
 * Postavi kontext dokladu.
 * @param {object} koren korenovy uzol UBL Invoice alebo CreditNote
 */
export function vytvorKontext(koren) {
  const jeDobropis = koren.local === 'CreditNote';
  const riadky = deti(koren, 'cac:InvoiceLine|cac:CreditNoteLine');
  const acDok = deti(koren, 'cac:AllowanceCharge');
  const jeZlava = (ac) => hod(ac, 'cbc:ChargeIndicator').toLowerCase() === 'false';
  const jePriplatok = (ac) => hod(ac, 'cbc:ChargeIndicator').toLowerCase() === 'true';
  const danCelkom = deti(koren, 'cac:TaxTotal');
  const podsuhrny = [];
  for (const t of danCelkom) for (const p of deti(t, 'cac:TaxSubtotal')) podsuhrny.push(p);
  const acRiadkov = [];
  for (const r of riadky) for (const ac of deti(r, 'cac:AllowanceCharge')) acRiadkov.push(ac);

  return {
    koren,
    jeDobropis,
    typDokladu: koren.local,
    riadky,
    zlavyDok: acDok.filter(jeZlava),
    priplatkyDok: acDok.filter(jePriplatok),
    acDok,
    acRiadkov,
    zlavyRiadkov: acRiadkov.filter(jeZlava),
    priplatkyRiadkov: acRiadkov.filter(jePriplatok),
    danCelkom,
    podsuhrny,
    sucty: prve(koren, 'cac:LegalMonetaryTotal'),
    mena: hod(koren, 'cbc:DocumentCurrencyCode'),
    menaDane: hod(koren, 'cbc:TaxCurrencyCode'),
    dodavatel: jeden(koren, 'cac:AccountingSupplierParty/cac:Party'),
    odberatel: jeden(koren, 'cac:AccountingCustomerParty/cac:Party'),
    danZastupca: prve(koren, 'cac:TaxRepresentativeParty'),
    platby: deti(koren, 'cac:PaymentMeans'),
    nalezy: [],
    profil: 'en16931'
  };
}

/**
 * Prida nalez.
 * @param {object} ctx kontext
 * @param {string} kod kod pravidla (BR-01, PEPPOL-EN16931-R010, ARL-IBAN, ...)
 * @param {'chyba'|'varovanie'|'informacia'} zavaznost
 * @param {object|null} uzol uzol, ktoreho sa nalez tyka (pre XPath)
 * @param {string} hodnota hodnota, ktoru sme nasli
 * @param {string} sk sprava po slovensky
 * @param {string} cs sprava po cesky
 * @param {string} de sprava po nemecky
 * @param {string} [nahradnaCesta] XPath, ak uzol neexistuje
 */
export function pridaj(ctx, kod, zavaznost, uzol, hodnota, sk, cs, de, nahradnaCesta) {
  ctx.nalezy.push({
    kod,
    zavaznost,
    xpath: uzol ? xpath(uzol) : nahradnaCesta || (ctx.koren ? xpath(ctx.koren) : ''),
    hodnota: hodnota == null ? '' : String(hodnota),
    sprava: { sk, cs, de },
    original: povodneZnenie(kod) || ''
  });
}
