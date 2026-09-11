// ubl.js - generator e-faktury v syntaxi UBL 2.1 (Invoice a CreditNote).
// Vstup je obycajny objekt faktury, vystup je retazec s XML. Vsetko vznika v prehliadaci.
// Sucty sa ratia v centoch (celociselne), aby sedeli na halier a presli pravidlami BR-CO-10 az BR-CO-16.

import * as K from './kodovniky.mjs';

// Nahradne platobne podmienky (cbc:Note v cac:PaymentTerms), ked si ich pouzivatel nevyplni.
// Jazyk urcuje volba "jazyk" pri vytvorUbl, inak slovencina.
export const TEXT_SPLATNOSTI = {
  sk: 'Splatnosť ',
  cs: 'Splatnost ',
  de: 'Fällig am '
};

// ---------------------------------------------------------------- cisla a zaokruhlovanie

/** Cislo z pola formulara. Prijme aj ciarku ako desatinnu znacku. */
export function cislo(vstup) {
  if (typeof vstup === 'number') return Number.isFinite(vstup) ? vstup : 0;
  const t = String(vstup == null ? '' : vstup).trim().replace(/\s+/g, '').replace(',', '.');
  if (t === '') return 0;
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

/** Zaokruhli na centy, pol nahor od nuly. Vracia cele cislo centov. */
export function naCenty(x) {
  const z = x < 0 ? -1 : 1;
  return z * Math.round(Math.abs(x) * 100 + 1e-6);
}

/** Centy na text s dvomi desatinnymi miestami. */
export function zCentov(c) {
  const z = c < 0 ? '-' : '';
  const a = Math.abs(c);
  return z + Math.floor(a / 100) + '.' + String(a % 100).padStart(2, '0');
}

/** Suma na text s dvomi desatinnymi miestami (BR-DEC-*). */
export function suma2(x) {
  return zCentov(naCenty(x));
}

/** Mnozstvo na text. Necha max 4 desatinne miesta a odreze zbytocne nuly. */
export function mnozstvo4(x) {
  const n = cislo(x);
  let t = n.toFixed(4);
  if (t.indexOf('.') >= 0) t = t.replace(/0+$/, '').replace(/\.$/, '');
  return t === '' || t === '-0' ? '0' : t;
}

/** Jednotkova cena. Ponecha az 4 desatinne miesta, pretoze BT-146 nema limit 2. */
export function cena4(x) {
  const n = cislo(x);
  let t = n.toFixed(4);
  t = t.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  if (t.indexOf('.') === -1) t += '.00';
  return t;
}

// ---------------------------------------------------------------- XML zapisovac

function unik(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

class Zapisovac {
  constructor() {
    this.r = [];
    this.hlbka = 0;
  }

  odsad() { return '  '.repeat(this.hlbka); }

  otvor(meno, atr) {
    this.r.push(this.odsad() + '<' + meno + this.atr(atr) + '>');
    this.hlbka += 1;
  }

  zavri(meno) {
    this.hlbka -= 1;
    this.r.push(this.odsad() + '</' + meno + '>');
  }

  atr(atr) {
    if (!atr) return '';
    let s = '';
    for (const [k, v] of Object.entries(atr)) {
      if (v === undefined || v === null || v === '') continue;
      s += ' ' + k + '="' + unik(v) + '"';
    }
    return s;
  }

  // Prvok s textom. Prazdne hodnoty vynechava, aby nevznikli prazdne prvky (PEPPOL-EN16931-R008).
  prvok(meno, hodnota, atr) {
    const h = hodnota == null ? '' : String(hodnota);
    if (h.trim() === '') return;
    this.r.push(this.odsad() + '<' + meno + this.atr(atr) + '>' + unik(h) + '</' + meno + '>');
  }

  text() { return this.r.join('\n'); }
}

// ---------------------------------------------------------------- vypocet suctov

/**
 * Prepocita fakturu. Nemeni vstupny objekt.
 * @returns {{riadky:Array, rozpis:Array, zakladCenty:number, danCenty:number, sDphCenty:number,
 *   zaplateneCenty:number, naUhraduCenty:number}}
 */
export function prepocitaj(faktura) {
  const polozky = Array.isArray(faktura.polozky) ? faktura.polozky : [];
  const riadky = polozky.map((p, i) => {
    const mn = cislo(p.mnozstvo);
    const cena = cislo(p.cena);
    const centy = naCenty(mn * cena);
    return {
      poradie: i + 1,
      nazov: p.nazov || '',
      popis: p.popis || '',
      mnozstvo: mn,
      jednotka: p.jednotka || 'C62',
      cena,
      sadzba: cislo(p.sadzba),
      kategoria: p.kategoria || 'S',
      dovodOslobodenia: p.dovodOslobodenia || '',
      centy
    };
  });

  // rozpis DPH podla dvojice kategoria a sadzba
  const mapa = new Map();
  for (const r of riadky) {
    const kluc = r.kategoria + '|' + r.sadzba;
    if (!mapa.has(kluc)) {
      mapa.set(kluc, {
        kategoria: r.kategoria,
        sadzba: r.sadzba,
        zakladCenty: 0,
        danCenty: 0,
        dovodOslobodenia: r.dovodOslobodenia
      });
    }
    const s = mapa.get(kluc);
    s.zakladCenty += r.centy;
    if (!s.dovodOslobodenia && r.dovodOslobodenia) s.dovodOslobodenia = r.dovodOslobodenia;
  }
  const rozpis = [...mapa.values()];
  for (const s of rozpis) {
    s.danCenty = s.kategoria === 'S' || s.kategoria === 'L' || s.kategoria === 'M'
      ? naCenty((s.zakladCenty / 100) * (s.sadzba / 100))
      : 0;
  }
  rozpis.sort((a, b) => (a.kategoria === b.kategoria ? b.sadzba - a.sadzba : a.kategoria.localeCompare(b.kategoria)));

  const zakladCenty = riadky.reduce((a, r) => a + r.centy, 0);
  const danCenty = rozpis.reduce((a, s) => a + s.danCenty, 0);
  const sDphCenty = zakladCenty + danCenty;
  const zaplateneCenty = naCenty(cislo(faktura.zaplatene));
  return {
    riadky,
    rozpis,
    zakladCenty,
    danCenty,
    sDphCenty,
    zaplateneCenty,
    naUhraduCenty: sDphCenty - zaplateneCenty
  };
}

// ---------------------------------------------------------------- pomocky pre XML

const KATEGORIE_S_DOVODOM = new Set(['E', 'AE', 'K', 'G', 'O']);

const PREDVOLENY_KOD_OSLOBODENIA = {
  AE: 'VATEX-EU-AE',
  K: 'VATEX-EU-IC',
  G: 'VATEX-EU-G',
  O: 'VATEX-EU-O'
};

const PREDVOLENY_TEXT_OSLOBODENIA = {
  E: 'Oslobodene od dane',
  AE: 'Prenesenie danovej povinnosti',
  K: 'Dodanie do ineho clenskeho statu EU',
  G: 'Vyvoz mimo EU',
  O: 'Nepodlieha DPH'
};

function zapisAdresu(z, strana) {
  z.otvor('cac:PostalAddress');
  z.prvok('cbc:StreetName', strana.ulica);
  z.prvok('cbc:AdditionalStreetName', strana.ulica2);
  z.prvok('cbc:CityName', strana.mesto);
  z.prvok('cbc:PostalZone', strana.psc);
  z.otvor('cac:Country');
  z.prvok('cbc:IdentificationCode', strana.krajina || 'SK');
  z.zavri('cac:Country');
  z.zavri('cac:PostalAddress');
}

function zapisStranu(z, obal, strana, jeDodavatel) {
  z.otvor(obal);
  z.otvor('cac:Party');
  if (strana.endpoint) {
    z.prvok('cbc:EndpointID', strana.endpoint, { schemeID: strana.endpointSchema || '' });
  }
  if (strana.identifikator && strana.identifikatorSchema) {
    z.otvor('cac:PartyIdentification');
    z.prvok('cbc:ID', strana.identifikator, { schemeID: strana.identifikatorSchema });
    z.zavri('cac:PartyIdentification');
  }
  if (strana.obchodneMeno) {
    z.otvor('cac:PartyName');
    z.prvok('cbc:Name', strana.obchodneMeno);
    z.zavri('cac:PartyName');
  }
  zapisAdresu(z, strana);
  if (strana.icDph) {
    z.otvor('cac:PartyTaxScheme');
    z.prvok('cbc:CompanyID', strana.icDph);
    z.otvor('cac:TaxScheme');
    z.prvok('cbc:ID', 'VAT');
    z.zavri('cac:TaxScheme');
    z.zavri('cac:PartyTaxScheme');
  }
  z.otvor('cac:PartyLegalEntity');
  z.prvok('cbc:RegistrationName', strana.nazov);
  z.prvok('cbc:CompanyID', strana.ico);
  z.zavri('cac:PartyLegalEntity');
  const maKontakt = strana.kontakt || strana.telefon || strana.email;
  if (maKontakt && (jeDodavatel || strana.email)) {
    z.otvor('cac:Contact');
    z.prvok('cbc:Name', strana.kontakt);
    z.prvok('cbc:Telephone', strana.telefon);
    z.prvok('cbc:ElectronicMail', strana.email);
    z.zavri('cac:Contact');
  }
  z.zavri('cac:Party');
  z.zavri(obal);
}

function zapisDanovuKategoriu(z, meno, kategoria, sadzba, dovodKod, dovodText) {
  z.otvor(meno);
  z.prvok('cbc:ID', kategoria);
  if (kategoria !== 'O') z.prvok('cbc:Percent', suma2(sadzba));
  if (KATEGORIE_S_DOVODOM.has(kategoria)) {
    const kod = dovodKod || PREDVOLENY_KOD_OSLOBODENIA[kategoria] || '';
    if (kod) z.prvok('cbc:TaxExemptionReasonCode', kod);
    z.prvok('cbc:TaxExemptionReason', dovodText || PREDVOLENY_TEXT_OSLOBODENIA[kategoria] || '');
  }
  z.otvor('cac:TaxScheme');
  z.prvok('cbc:ID', 'VAT');
  z.zavri('cac:TaxScheme');
  z.zavri(meno);
}

// ---------------------------------------------------------------- hlavny generator

/**
 * Vytvori UBL 2.1 XML z objektu faktury.
 * @param {object} faktura
 * @param {{profil?: 'peppol'|'xrechnung'|'en16931', jazyk?: 'sk'|'cs'|'de'}} [volby]
 * @returns {string} XML
 */
export function vytvorUbl(faktura, volby = {}) {
  const profil = volby.profil || faktura.profil || 'peppol';
  const jazyk = TEXT_SPLATNOSTI[volby.jazyk] ? volby.jazyk : 'sk';
  const jeDobropis = String(faktura.typ || '380') === '381';
  const koren = jeDobropis ? 'CreditNote' : 'Invoice';
  const mp = jeDobropis ? K.MP.dobropis : K.MP.faktura;
  const v = prepocitaj(faktura);
  const mena = faktura.mena || 'EUR';
  const m = { currencyID: mena };

  const custom = profil === 'xrechnung'
    ? K.PROFILY.xrechnung
    : profil === 'en16931' ? K.PROFILY.en16931 : K.PROFILY.peppol;

  const z = new Zapisovac();
  z.r.push('<?xml version="1.0" encoding="UTF-8"?>');
  z.otvor(koren, {
    xmlns: mp,
    'xmlns:cac': K.MP.cac,
    'xmlns:cbc': K.MP.cbc
  });

  z.prvok('cbc:CustomizationID', custom);
  if (profil !== 'en16931') z.prvok('cbc:ProfileID', faktura.proces || K.PROFILY.peppolProces);
  z.prvok('cbc:ID', faktura.cislo);
  z.prvok('cbc:IssueDate', faktura.datumVystavenia);
  if (!jeDobropis) z.prvok('cbc:DueDate', faktura.datumSplatnosti);
  z.prvok(jeDobropis ? 'cbc:CreditNoteTypeCode' : 'cbc:InvoiceTypeCode', faktura.typ || '380');
  z.prvok('cbc:Note', faktura.poznamka);
  z.prvok('cbc:DocumentCurrencyCode', mena);
  z.prvok('cbc:BuyerReference', faktura.referenciaOdberatela);

  if (faktura.obdobieOd || faktura.obdobieDo) {
    z.otvor('cac:InvoicePeriod');
    z.prvok('cbc:StartDate', faktura.obdobieOd);
    z.prvok('cbc:EndDate', faktura.obdobieDo);
    z.zavri('cac:InvoicePeriod');
  }
  if (faktura.objednavka) {
    z.otvor('cac:OrderReference');
    z.prvok('cbc:ID', faktura.objednavka);
    z.zavri('cac:OrderReference');
  }
  if (faktura.predchadzajucaFaktura && faktura.predchadzajucaFaktura.cislo) {
    z.otvor('cac:BillingReference');
    z.otvor('cac:InvoiceDocumentReference');
    z.prvok('cbc:ID', faktura.predchadzajucaFaktura.cislo);
    z.prvok('cbc:IssueDate', faktura.predchadzajucaFaktura.datum);
    z.zavri('cac:InvoiceDocumentReference');
    z.zavri('cac:BillingReference');
  }

  zapisStranu(z, 'cac:AccountingSupplierParty', faktura.dodavatel || {}, true);
  zapisStranu(z, 'cac:AccountingCustomerParty', faktura.odberatel || {}, false);

  // dodanie: povinne pri kategorii K (BR-IC-11 a BR-IC-12), inak ho pisememe, ak mame datum dodania
  const maK = v.rozpis.some((s) => s.kategoria === 'K');
  const miesto = faktura.miestoDodania || {};
  if (faktura.datumDodania || maK) {
    z.otvor('cac:Delivery');
    z.prvok('cbc:ActualDeliveryDate', faktura.datumDodania || faktura.datumVystavenia);
    if (maK || miesto.krajina) {
      z.otvor('cac:DeliveryLocation');
      z.otvor('cac:Address');
      z.prvok('cbc:StreetName', miesto.ulica || (faktura.odberatel || {}).ulica);
      z.prvok('cbc:CityName', miesto.mesto || (faktura.odberatel || {}).mesto);
      z.prvok('cbc:PostalZone', miesto.psc || (faktura.odberatel || {}).psc);
      z.otvor('cac:Country');
      z.prvok('cbc:IdentificationCode', miesto.krajina || (faktura.odberatel || {}).krajina || 'SK');
      z.zavri('cac:Country');
      z.zavri('cac:Address');
      z.zavri('cac:DeliveryLocation');
    }
    z.zavri('cac:Delivery');
  }

  // platobne udaje
  const sposob = faktura.sposobPlatby || '58';
  const iban = String((faktura.dodavatel || {}).iban || '').replace(/\s+/g, '').toUpperCase();
  if (iban || sposob) {
    z.otvor('cac:PaymentMeans');
    z.prvok('cbc:PaymentMeansCode', sposob);
    z.prvok('cbc:PaymentID', faktura.variabilnySymbol);
    if (iban) {
      z.otvor('cac:PayeeFinancialAccount');
      z.prvok('cbc:ID', iban);
      z.prvok('cbc:Name', (faktura.dodavatel || {}).nazov);
      if ((faktura.dodavatel || {}).bic) {
        z.otvor('cac:FinancialInstitutionBranch');
        z.prvok('cbc:ID', faktura.dodavatel.bic);
        z.zavri('cac:FinancialInstitutionBranch');
      }
      z.zavri('cac:PayeeFinancialAccount');
    }
    z.zavri('cac:PaymentMeans');
  }

  // platobne podmienky: pri dobropise nahradzaju datum splatnosti (BR-CO-25).
  // Ak si ich pouzivatel nevyplni, doplnime kratku vetu v jazyku stranky.
  const vlastne = String(faktura.platobnePodmienky === undefined || faktura.platobnePodmienky === null ? '' : faktura.platobnePodmienky).trim();
  const podmienky = vlastne ||
    (faktura.datumSplatnosti ? TEXT_SPLATNOSTI[jazyk] + faktura.datumSplatnosti : '');
  if (podmienky) {
    z.otvor('cac:PaymentTerms');
    z.prvok('cbc:Note', podmienky);
    z.zavri('cac:PaymentTerms');
  }

  // rozpis DPH
  z.otvor('cac:TaxTotal');
  z.prvok('cbc:TaxAmount', zCentov(v.danCenty), m);
  for (const s of v.rozpis) {
    z.otvor('cac:TaxSubtotal');
    z.prvok('cbc:TaxableAmount', zCentov(s.zakladCenty), m);
    z.prvok('cbc:TaxAmount', zCentov(s.danCenty), m);
    zapisDanovuKategoriu(z, 'cac:TaxCategory', s.kategoria, s.sadzba, faktura.kodOslobodenia, s.dovodOslobodenia || faktura.dovodOslobodenia);
    z.zavri('cac:TaxSubtotal');
  }
  z.zavri('cac:TaxTotal');

  // sucty
  z.otvor('cac:LegalMonetaryTotal');
  z.prvok('cbc:LineExtensionAmount', zCentov(v.zakladCenty), m);
  z.prvok('cbc:TaxExclusiveAmount', zCentov(v.zakladCenty), m);
  z.prvok('cbc:TaxInclusiveAmount', zCentov(v.sDphCenty), m);
  if (v.zaplateneCenty !== 0) z.prvok('cbc:PrepaidAmount', zCentov(v.zaplateneCenty), m);
  z.prvok('cbc:PayableAmount', zCentov(v.naUhraduCenty), m);
  z.zavri('cac:LegalMonetaryTotal');

  // riadky
  const menoRiadku = jeDobropis ? 'cac:CreditNoteLine' : 'cac:InvoiceLine';
  const menoMnozstva = jeDobropis ? 'cbc:CreditedQuantity' : 'cbc:InvoicedQuantity';
  for (const r of v.riadky) {
    z.otvor(menoRiadku);
    z.prvok('cbc:ID', String(r.poradie));
    z.prvok(menoMnozstva, mnozstvo4(r.mnozstvo), { unitCode: r.jednotka });
    z.prvok('cbc:LineExtensionAmount', zCentov(r.centy), m);
    z.otvor('cac:Item');
    z.prvok('cbc:Description', r.popis);
    z.prvok('cbc:Name', r.nazov);
    zapisDanovuKategoriu(z, 'cac:ClassifiedTaxCategory', r.kategoria, r.sadzba, faktura.kodOslobodenia, r.dovodOslobodenia || faktura.dovodOslobodenia);
    z.zavri('cac:Item');
    z.otvor('cac:Price');
    z.prvok('cbc:PriceAmount', cena4(r.cena), m);
    z.zavri('cac:Price');
    z.zavri(menoRiadku);
  }

  z.zavri(koren);
  return z.text() + '\n';
}

// ---------------------------------------------------------------- prazdna faktura pre formular

/** Prazdna faktura s rozumnymi predvolbami (pre formular na stranke). */
export function prazdnaFaktura(krajina = 'SK') {
  const dnes = new Date().toISOString().slice(0, 10);
  const o14 = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  return {
    typ: '380',
    profil: krajina === 'DE' ? 'xrechnung' : 'peppol',
    cislo: '',
    datumVystavenia: dnes,
    datumDodania: dnes,
    datumSplatnosti: o14,
    mena: 'EUR',
    platobnePodmienky: '',
    poznamka: '',
    variabilnySymbol: '',
    referenciaOdberatela: '',
    dodavatel: { nazov: '', ico: '', icDph: '', ulica: '', mesto: '', psc: '', krajina, email: '', telefon: '', kontakt: '', iban: '', bic: '', endpoint: '', endpointSchema: (K.ODPORUCANE_SCHEMEID[krajina] || {}).kod || '' },
    odberatel: { nazov: '', ico: '', icDph: '', ulica: '', mesto: '', psc: '', krajina, email: '', endpoint: '', endpointSchema: '' },
    sposobPlatby: '58',
    zaplatene: 0,
    polozky: [{ nazov: '', mnozstvo: 1, jednotka: 'C62', cena: 0, sadzba: (K.SADZBY_DPH[krajina] || [23])[0], kategoria: 'S' }]
  };
}
