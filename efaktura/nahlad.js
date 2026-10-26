// nahlad.js - z rozparsovaneho UBL urobi citatelny doklad v DOM.
// Ziadny innerHTML: vsetko cez createElement a textContent, aby sa obsah cudzieho suboru
// nikdy nespustil ako HTML ani ako skript.

import * as K from './kodovniky.mjs';
import { deti, prve, cesta, jeden, txt, hod, atr } from './parser.mjs';

// ---------------------------------------------------------------- texty

const T = {
  sk: {
    faktura: 'Faktúra', dobropis: 'Dobropis', doklad: 'Doklad',
    cislo: 'Číslo', vystavena: 'Dátum vystavenia', dodanie: 'Dátum dodania', splatnost: 'Splatnosť',
    obdobie: 'Fakturačné obdobie', dodavatel: 'Dodávateľ', odberatel: 'Odberateľ',
    ico: 'IČO', dic: 'DIČ', icDph: 'IČ DPH', email: 'E-mail', telefon: 'Telefón',
    elektronickaAdresa: 'Elektronická adresa', kontakt: 'Kontakt',
    polozky: 'Položky', pPoradie: 'Čís.', pNazov: 'Názov', pMnozstvo: 'Množstvo', pJednotka: 'Jednotka',
    pCena: 'Cena za jednotku', pSadzba: 'DPH', pSuma: 'Suma bez DPH',
    rozpis: 'Rozpis DPH', rKategoria: 'Kategória', rSadzba: 'Sadzba', rZaklad: 'Základ dane', rDan: 'DPH', rDovod: 'Dôvod oslobodenia',
    sucty: 'Súčty', sZaklad: 'Spolu bez DPH', sDph: 'DPH spolu', sSDph: 'Spolu s DPH',
    sZaplatene: 'Už zaplatené', sZaokruhlenie: 'Zaokrúhlenie', sUhrada: 'Na úhradu',
    platba: 'Platobné údaje', pSposob: 'Spôsob platby', pIban: 'IBAN', pBic: 'BIC', pVs: 'Variabilný symbol',
    pPodmienky: 'Platobné podmienky', pVeritel: 'Identifikátor veriteľa', pMandat: 'Mandát',
    poznamky: 'Poznámky', prilohy: 'Prílohy', referencia: 'Referencia odberateľa', objednavka: 'Objednávka',
    predchadzajuca: 'Predchádzajúci doklad', miestoDodania: 'Miesto dodania',
    profil: 'Profil', bajtov: 'B', neuvedene: 'neuvedené'
  },
  cs: {
    faktura: 'Faktura', dobropis: 'Dobropis', doklad: 'Doklad',
    cislo: 'Číslo', vystavena: 'Datum vystavení', dodanie: 'Datum dodání', splatnost: 'Splatnost',
    obdobie: 'Fakturační období', dodavatel: 'Dodavatel', odberatel: 'Odběratel',
    ico: 'IČO', dic: 'DIČ', icDph: 'DIČ (DPH)', email: 'E-mail', telefon: 'Telefon',
    elektronickaAdresa: 'Elektronická adresa', kontakt: 'Kontakt',
    polozky: 'Položky', pPoradie: 'Č.', pNazov: 'Název', pMnozstvo: 'Množství', pJednotka: 'Jednotka',
    pCena: 'Cena za jednotku', pSadzba: 'DPH', pSuma: 'Částka bez DPH',
    rozpis: 'Rozpis DPH', rKategoria: 'Kategorie', rSadzba: 'Sazba', rZaklad: 'Základ daně', rDan: 'DPH', rDovod: 'Důvod osvobození',
    sucty: 'Součty', sZaklad: 'Celkem bez DPH', sDph: 'DPH celkem', sSDph: 'Celkem s DPH',
    sZaplatene: 'Již zaplaceno', sZaokruhlenie: 'Zaokrouhlení', sUhrada: 'K úhradě',
    platba: 'Platební údaje', pSposob: 'Způsob platby', pIban: 'IBAN', pBic: 'BIC', pVs: 'Variabilní symbol',
    pPodmienky: 'Platební podmínky', pVeritel: 'Identifikátor věřitele', pMandat: 'Mandát',
    poznamky: 'Poznámky', prilohy: 'Přílohy', referencia: 'Reference odběratele', objednavka: 'Objednávka',
    predchadzajuca: 'Předchozí doklad', miestoDodania: 'Místo dodání',
    profil: 'Profil', bajtov: 'B', neuvedene: 'neuvedeno'
  },
  de: {
    faktura: 'Rechnung', dobropis: 'Gutschrift', doklad: 'Beleg',
    cislo: 'Nummer', vystavena: 'Rechnungsdatum', dodanie: 'Lieferdatum', splatnost: 'Fällig am',
    obdobie: 'Abrechnungszeitraum', dodavatel: 'Verkäufer', odberatel: 'Käufer',
    ico: 'Registernummer', dic: 'Steuernummer', icDph: 'USt-IdNr.', email: 'E-Mail', telefon: 'Telefon',
    elektronickaAdresa: 'Elektronische Adresse', kontakt: 'Ansprechpartner',
    polozky: 'Positionen', pPoradie: 'Nr.', pNazov: 'Bezeichnung', pMnozstvo: 'Menge', pJednotka: 'Einheit',
    pCena: 'Einzelpreis', pSadzba: 'USt.', pSuma: 'Nettobetrag',
    rozpis: 'Steueraufschlüsselung', rKategoria: 'Kategorie', rSadzba: 'Satz', rZaklad: 'Bemessungsgrundlage', rDan: 'Steuer', rDovod: 'Befreiungsgrund',
    sucty: 'Summen', sZaklad: 'Gesamt netto', sDph: 'Umsatzsteuer', sSDph: 'Gesamt brutto',
    sZaplatene: 'Bereits gezahlt', sZaokruhlenie: 'Rundung', sUhrada: 'Fälliger Betrag',
    platba: 'Zahlungsangaben', pSposob: 'Zahlungsart', pIban: 'IBAN', pBic: 'BIC', pVs: 'Verwendungszweck',
    pPodmienky: 'Zahlungsbedingungen', pVeritel: 'Gläubiger-ID', pMandat: 'Mandatsreferenz',
    poznamky: 'Bemerkungen', prilohy: 'Anlagen', referencia: 'Leitweg- oder Käuferreferenz', objednavka: 'Bestellung',
    predchadzajuca: 'Vorausgegangener Beleg', miestoDodania: 'Lieferort',
    profil: 'Profil', bajtov: 'B', neuvedene: 'nicht angegeben'
  },
  en: {
    faktura: 'Invoice', dobropis: 'Credit note', doklad: 'Document',
    cislo: 'Number', vystavena: 'Issue date', dodanie: 'Delivery date', splatnost: 'Due date',
    obdobie: 'Invoicing period', dodavatel: 'Seller', odberatel: 'Buyer',
    ico: 'Registration number', dic: 'Tax number', icDph: 'VAT number', email: 'E-mail', telefon: 'Phone',
    elektronickaAdresa: 'Electronic address', kontakt: 'Contact',
    polozky: 'Lines', pPoradie: 'No.', pNazov: 'Description', pMnozstvo: 'Quantity', pJednotka: 'Unit',
    pCena: 'Unit price', pSadzba: 'VAT', pSuma: 'Net amount',
    rozpis: 'VAT breakdown', rKategoria: 'Category', rSadzba: 'Rate', rZaklad: 'Taxable amount', rDan: 'VAT', rDovod: 'Exemption reason',
    sucty: 'Totals', sZaklad: 'Total without VAT', sDph: 'Total VAT', sSDph: 'Total with VAT',
    sZaplatene: 'Already paid', sZaokruhlenie: 'Rounding', sUhrada: 'Amount due',
    platba: 'Payment details', pSposob: 'Payment means', pIban: 'IBAN', pBic: 'BIC', pVs: 'Payment reference',
    pPodmienky: 'Payment terms', pVeritel: 'Creditor identifier', pMandat: 'Mandate reference',
    poznamky: 'Notes', prilohy: 'Attachments', referencia: 'Buyer reference', objednavka: 'Purchase order',
    predchadzajuca: 'Preceding invoice', miestoDodania: 'Deliver to',
    profil: 'Profile', bajtov: 'B', neuvedene: 'not given'
  }
};

// ---------------------------------------------------------------- citanie dokladu

function citajStranu(uzol) {
  if (!uzol) return null;
  const adresa = jeden(uzol, 'cac:PostalAddress');
  const danove = deti(uzol, 'cac:PartyTaxScheme');
  const vat = danove.find((p) => hod(p, 'cac:TaxScheme/cbc:ID').toUpperCase() === 'VAT');
  const ine = danove.find((p) => hod(p, 'cac:TaxScheme/cbc:ID').toUpperCase() !== 'VAT');
  const ep = prve(uzol, 'cbc:EndpointID');
  return {
    nazov: hod(uzol, 'cac:PartyLegalEntity/cbc:RegistrationName') || hod(uzol, 'cac:PartyName/cbc:Name'),
    obchodneMeno: hod(uzol, 'cac:PartyName/cbc:Name'),
    ico: hod(uzol, 'cac:PartyLegalEntity/cbc:CompanyID'),
    icDph: vat ? hod(vat, 'cbc:CompanyID') : '',
    dic: ine ? hod(ine, 'cbc:CompanyID') : '',
    ulica: adresa ? [hod(adresa, 'cbc:StreetName'), hod(adresa, 'cbc:AdditionalStreetName')].filter(Boolean).join(', ') : '',
    mesto: adresa ? hod(adresa, 'cbc:CityName') : '',
    psc: adresa ? hod(adresa, 'cbc:PostalZone') : '',
    krajina: adresa ? hod(adresa, 'cac:Country/cbc:IdentificationCode') : '',
    email: hod(uzol, 'cac:Contact/cbc:ElectronicMail'),
    telefon: hod(uzol, 'cac:Contact/cbc:Telephone'),
    kontakt: hod(uzol, 'cac:Contact/cbc:Name'),
    endpoint: ep ? txt(ep) : '',
    endpointSchema: ep ? (atr(ep, 'schemeID') || '') : ''
  };
}

function katVat(u, kluc) {
  const kandidati = deti(u, kluc);
  const sVat = kandidati.filter((k) => hod(k, 'cac:TaxScheme/cbc:ID').toUpperCase() === 'VAT');
  return sVat.length ? sVat[0] : (kandidati[0] || null);
}

/**
 * Precita UBL doklad do jednoducheho objektu, ktory sa da vykreslit alebo vypisat.
 * @param {object} koren korenovy uzol z parsujXml
 */
export function precitajDoklad(koren) {
  const jeDobropis = koren.local === 'CreditNote';
  const mena = hod(koren, 'cbc:DocumentCurrencyCode');
  const riadky = deti(koren, 'cac:InvoiceLine|cac:CreditNoteLine').map((r, i) => {
    const mn = prve(r, 'cbc:InvoicedQuantity') || prve(r, 'cbc:CreditedQuantity');
    const kat = katVat(jeden(r, 'cac:Item'), 'cac:ClassifiedTaxCategory');
    return {
      poradie: hod(r, 'cbc:ID') || String(i + 1),
      nazov: hod(r, 'cac:Item/cbc:Name'),
      popis: hod(r, 'cac:Item/cbc:Description'),
      mnozstvo: mn ? txt(mn) : '',
      jednotka: mn ? (atr(mn, 'unitCode') || '') : '',
      cena: hod(r, 'cac:Price/cbc:PriceAmount'),
      zakladneMnozstvo: hod(r, 'cac:Price/cbc:BaseQuantity'),
      kategoria: kat ? hod(kat, 'cbc:ID') : '',
      sadzba: kat ? hod(kat, 'cbc:Percent') : '',
      suma: hod(r, 'cbc:LineExtensionAmount'),
      obdobieOd: hod(r, 'cac:InvoicePeriod/cbc:StartDate'),
      obdobieDo: hod(r, 'cac:InvoicePeriod/cbc:EndDate')
    };
  });

  const rozpis = [];
  for (const tt of deti(koren, 'cac:TaxTotal')) {
    for (const ts of deti(tt, 'cac:TaxSubtotal')) {
      const kat = katVat(ts, 'cac:TaxCategory');
      rozpis.push({
        kategoria: kat ? hod(kat, 'cbc:ID') : '',
        sadzba: kat ? hod(kat, 'cbc:Percent') : '',
        zaklad: hod(ts, 'cbc:TaxableAmount'),
        dan: hod(ts, 'cbc:TaxAmount'),
        dovodKod: kat ? hod(kat, 'cbc:TaxExemptionReasonCode') : '',
        dovodText: kat ? hod(kat, 'cbc:TaxExemptionReason') : ''
      });
    }
  }

  const S = prve(koren, 'cac:LegalMonetaryTotal');
  const platby = deti(koren, 'cac:PaymentMeans').map((pm) => ({
    kod: hod(pm, 'cbc:PaymentMeansCode'),
    identifikator: deti(pm, 'cbc:PaymentID').map((n) => txt(n)).join(', '),
    iban: hod(pm, 'cac:PayeeFinancialAccount/cbc:ID'),
    nazovUctu: hod(pm, 'cac:PayeeFinancialAccount/cbc:Name'),
    bic: hod(pm, 'cac:PayeeFinancialAccount/cac:FinancialInstitutionBranch/cbc:ID'),
    karta: hod(pm, 'cac:CardAccount/cbc:PrimaryAccountNumberID'),
    mandat: hod(pm, 'cac:PaymentMandate/cbc:ID'),
    ucetPlatitela: hod(pm, 'cac:PaymentMandate/cac:PayerFinancialAccount/cbc:ID')
  }));

  const prilohy = [];
  for (const adr of deti(koren, 'cac:AdditionalDocumentReference')) {
    const bin = jeden(adr, 'cac:Attachment/cbc:EmbeddedDocumentBinaryObject');
    const odkaz = hod(adr, 'cac:Attachment/cac:ExternalReference/cbc:URI');
    const obsah = bin ? txt(bin) : '';
    prilohy.push({
      id: hod(adr, 'cbc:ID'),
      popis: hod(adr, 'cbc:DocumentDescription'),
      nazovSuboru: bin ? (atr(bin, 'filename') || '') : '',
      typ: bin ? (atr(bin, 'mimeCode') || '') : '',
      odkaz,
      bajtov: obsah ? Math.floor((obsah.replace(/\s+/g, '').length * 3) / 4) : 0
    });
  }

  const miesto = jeden(koren, 'cac:Delivery/cac:DeliveryLocation/cac:Address');

  return {
    jeDobropis,
    typDokladu: hod(koren, 'cbc:InvoiceTypeCode') || hod(koren, 'cbc:CreditNoteTypeCode'),
    profil: hod(koren, 'cbc:CustomizationID'),
    proces: hod(koren, 'cbc:ProfileID'),
    cislo: hod(koren, 'cbc:ID'),
    datumVystavenia: hod(koren, 'cbc:IssueDate'),
    datumSplatnosti: hod(koren, 'cbc:DueDate'),
    datumDodania: hod(koren, 'cac:Delivery/cbc:ActualDeliveryDate'),
    obdobieOd: hod(koren, 'cac:InvoicePeriod/cbc:StartDate'),
    obdobieDo: hod(koren, 'cac:InvoicePeriod/cbc:EndDate'),
    mena,
    referenciaOdberatela: hod(koren, 'cbc:BuyerReference'),
    objednavka: hod(koren, 'cac:OrderReference/cbc:ID'),
    predchadzajuca: cesta(koren, 'cac:BillingReference/cac:InvoiceDocumentReference')
      .map((n) => [hod(n, 'cbc:ID'), hod(n, 'cbc:IssueDate')].filter(Boolean).join(', ')).join('; '),
    // To isté po častiach, aby sa dátum dal zapísať podľa jazyka bez hádania v spojenom texte.
    predchadzajuce: cesta(koren, 'cac:BillingReference/cac:InvoiceDocumentReference')
      .map((n) => ({ id: hod(n, 'cbc:ID'), datum: hod(n, 'cbc:IssueDate') })),
    poznamky: deti(koren, 'cbc:Note').map((n) => txt(n)),
    dodavatel: citajStranu(jeden(koren, 'cac:AccountingSupplierParty/cac:Party')),
    odberatel: citajStranu(jeden(koren, 'cac:AccountingCustomerParty/cac:Party')),
    prijemcaPlatby: citajStranu(prve(koren, 'cac:PayeeParty')),
    miestoDodania: miesto ? {
      ulica: hod(miesto, 'cbc:StreetName'),
      mesto: hod(miesto, 'cbc:CityName'),
      psc: hod(miesto, 'cbc:PostalZone'),
      krajina: hod(miesto, 'cac:Country/cbc:IdentificationCode')
    } : null,
    riadky,
    rozpis,
    danSpolu: deti(koren, 'cac:TaxTotal').map((t) => hod(t, 'cbc:TaxAmount')).filter(Boolean),
    sucty: S ? {
      zaklad: hod(S, 'cbc:LineExtensionAmount'),
      bezDph: hod(S, 'cbc:TaxExclusiveAmount'),
      sDph: hod(S, 'cbc:TaxInclusiveAmount'),
      zlavy: hod(S, 'cbc:AllowanceTotalAmount'),
      priplatky: hod(S, 'cbc:ChargeTotalAmount'),
      zaplatene: hod(S, 'cbc:PrepaidAmount'),
      zaokruhlenie: hod(S, 'cbc:PayableRoundingAmount'),
      naUhradu: hod(S, 'cbc:PayableAmount')
    } : null,
    platby,
    platobnePodmienky: cesta(koren, 'cac:PaymentTerms/cbc:Note').map((n) => txt(n)),
    prilohy
  };
}

// ---------------------------------------------------------------- vykreslenie

function el(dok, meno, trieda, text) {
  const e = dok.createElement(meno);
  if (trieda) e.className = trieda;
  if (text !== undefined && text !== null && text !== '') e.textContent = String(text);
  return e;
}

function riadokUdaju(dok, popis, hodnota) {
  if (hodnota === undefined || hodnota === null || String(hodnota).trim() === '') return null;
  const r = el(dok, 'div', 'efa-udaj');
  r.appendChild(el(dok, 'span', 'efa-popis', popis));
  r.appendChild(el(dok, 'span', 'efa-hodnota', hodnota));
  return r;
}

function pridajAkJe(rodic, uzol) {
  if (uzol) rodic.appendChild(uzol);
}

function blokStrany(dok, t, nadpis, strana) {
  const b = el(dok, 'section', 'efa-strana');
  b.appendChild(el(dok, 'h3', null, nadpis));
  if (!strana) {
    b.appendChild(el(dok, 'p', 'efa-chyba', t.neuvedene));
    return b;
  }
  b.appendChild(el(dok, 'p', 'efa-nazov', strana.nazov || t.neuvedene));
  const adresa = [strana.ulica, [strana.psc, strana.mesto].filter(Boolean).join(' '), strana.krajina]
    .filter((x) => x && String(x).trim() !== '');
  for (const r of adresa) b.appendChild(el(dok, 'p', 'efa-adresa', r));
  pridajAkJe(b, riadokUdaju(dok, t.ico, strana.ico));
  pridajAkJe(b, riadokUdaju(dok, t.dic, strana.dic));
  pridajAkJe(b, riadokUdaju(dok, t.icDph, strana.icDph));
  pridajAkJe(b, riadokUdaju(dok, t.kontakt, strana.kontakt));
  pridajAkJe(b, riadokUdaju(dok, t.telefon, strana.telefon));
  pridajAkJe(b, riadokUdaju(dok, t.email, strana.email));
  if (strana.endpoint) {
    pridajAkJe(b, riadokUdaju(dok, t.elektronickaAdresa,
      strana.endpoint + (strana.endpointSchema ? ' (' + strana.endpointSchema + ')' : '')));
  }
  return b;
}

// Každá bunka nesie popis stĺpca v data-th (relácia 246, P5 brány): na úzkej obrazovke sa riadok dokladu skladá
// do bloku s popiskami (efaktura-v4.css), takže sumy sú čitateľné bez vodorovného posúvania. Tlač ostáva tabuľkou.
function tabulka(dok, hlavicky, riadky, trieda) {
  const tab = el(dok, 'table', trieda);
  const thead = el(dok, 'thead');
  const hr = el(dok, 'tr');
  for (const h of hlavicky) hr.appendChild(el(dok, 'th', null, h));
  thead.appendChild(hr);
  tab.appendChild(thead);
  const tbody = el(dok, 'tbody');
  for (const r of riadky) {
    const tr = el(dok, 'tr');
    r.forEach((b, i) => {
      const td = el(dok, 'td', null, b);
      if (hlavicky[i] && typeof td.setAttribute === 'function') td.setAttribute('data-th', hlavicky[i]);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  }
  tab.appendChild(tbody);
  return tab;
}

// ---------------------------------------------------------------- zápis čísel, dátumov a IBAN
// Relácia 246 (R55 v ops/ai/ZNALOSTI-UI.md, nález R1 brány): nemecký doklad píše dátum 11.09.2026 a sumu 1.234,50 €.
// Mení sa len zápis, nie hodnota: desatinné miesta ostávajú, koľko ich je v súbore, nič sa nezaokrúhľuje a hodnota,
// ktorá nie je číslo alebo dátum v tvare XML, sa vypíše presne tak, ako je v súbore. Ostatné jazyky zatiaľ ostávajú
// pri zápise zo súboru (2026-09-11, 450.00 EUR); medzera pred menou a percentom je nezlomiteľná.
const ZAPIS = {
  de: { datum: (r, m, d) => d + '.' + m + '.' + r, desatinna: ',', tisice: '.', meny: { EUR: '€' }, rozsah: ' bis ' }
};
const NBSP = '\u00a0';

function zapisCisla(hodnota, jazyk) {
  const s = String(hodnota).trim();
  const z = ZAPIS[jazyk];
  const m = z ? /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(s) : null;
  if (!m) return s;
  const cele = m[2].replace(/\B(?=(\d{3})+(?!\d))/g, z.tisice);
  return (m[1] === '-' ? '-' : '') + cele + (m[3] !== undefined ? z.desatinna + m[3] : '');
}

function zapisDatumu(hodnota, jazyk) {
  const s = String(hodnota || '').trim();
  const z = ZAPIS[jazyk];
  const m = z ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(s) : null;
  return m ? z.datum(m[1], m[2], m[3]) : s;
}

// IBAN po skupinách po štyroch znakoch, ako na papieri (ISO 13616); vo všetkých jazykoch.
function zapisIban(iban) {
  const s = String(iban || '').replace(/\s+/g, '');
  return /^[A-Za-z]{2}[0-9]{2}[A-Za-z0-9]+$/.test(s) ? s.replace(/(.{4})(?=.)/g, '$1 ') : String(iban || '');
}

// Exportovaná ako zapisSumy: riadok súčtov nad živým náhľadom generátora (app.js) píše sumu presne tak ako doklad pod ním
// (relácia 246, N2 brány: na nemeckej stránke stálo „0.00 EUR“ nad „0,00 €“).
function suma(hodnota, mena, jazyk) {
  if (hodnota === undefined || hodnota === null || String(hodnota).trim() === '') return '';
  const z = ZAPIS[jazyk];
  if (!z) return String(hodnota) + (mena ? ' ' + mena : '');
  const znak = mena ? (z.meny[mena] || mena) : '';
  return zapisCisla(hodnota, jazyk) + (znak ? NBSP + znak : '');
}

function sadzba(hodnota, jazyk) {
  if (hodnota === undefined || hodnota === null || String(hodnota).trim() === '') return '';
  return ZAPIS[jazyk] ? zapisCisla(hodnota, jazyk) + NBSP + '%' : hodnota + ' %';
}

/**
 * Vykresli citatelny doklad do ciela.
 * @param {object} vstup korenovy uzol UBL alebo uz precitany doklad z precitajDoklad
 * @param {HTMLElement} ciel prvok, do ktoreho sa vykresli (jeho obsah sa nahradi)
 * @param {'sk'|'cs'|'de'|'en'} jazyk
 * @param {Document} [dokument] pouzije sa v testoch mimo prehliadaca
 * @returns {object} precitany doklad
 */
export function vykresliNahlad(vstup, ciel, jazyk = 'sk', dokument) {
  const dok = dokument || (typeof document !== 'undefined' ? document : null);
  if (!dok) throw new Error('Nahlad potrebuje DOM.');
  const t = T[jazyk] || T.sk;
  const D = vstup && vstup.riadky && !vstup.deti ? vstup : precitajDoklad(vstup);

  while (ciel.firstChild) ciel.removeChild(ciel.firstChild);
  const koren = el(dok, 'article', 'efa-doklad');

  // hlavicka
  const hlava = el(dok, 'header', 'efa-hlavicka');
  const nazovTypu = K.nazovTypuDokladu(D.typDokladu, jazyk) ||
    (D.jeDobropis ? t.dobropis : t.faktura);
  hlava.appendChild(el(dok, 'h2', null, nazovTypu + ' ' + (D.cislo || '')));
  const datum = (x) => zapisDatumu(x, jazyk);
  pridajAkJe(hlava, riadokUdaju(dok, t.vystavena, datum(D.datumVystavenia)));
  pridajAkJe(hlava, riadokUdaju(dok, t.dodanie, datum(D.datumDodania)));
  pridajAkJe(hlava, riadokUdaju(dok, t.splatnost, datum(D.datumSplatnosti)));
  if (D.obdobieOd || D.obdobieDo) {
    pridajAkJe(hlava, riadokUdaju(dok, t.obdobie, [datum(D.obdobieOd), datum(D.obdobieDo)].filter(Boolean)
      .join(ZAPIS[jazyk] ? ZAPIS[jazyk].rozsah : ' .. ')));
  }
  pridajAkJe(hlava, riadokUdaju(dok, t.referencia, D.referenciaOdberatela));
  pridajAkJe(hlava, riadokUdaju(dok, t.objednavka, D.objednavka));
  pridajAkJe(hlava, riadokUdaju(dok, t.predchadzajuca, Array.isArray(D.predchadzajuce)
    ? D.predchadzajuce.map((p) => [p.id, datum(p.datum)].filter(Boolean).join(', ')).join('; ')
    : D.predchadzajuca));
  koren.appendChild(hlava);

  // strany
  const strany = el(dok, 'div', 'efa-strany');
  strany.appendChild(blokStrany(dok, t, t.dodavatel, D.dodavatel));
  strany.appendChild(blokStrany(dok, t, t.odberatel, D.odberatel));
  if (D.prijemcaPlatby) strany.appendChild(blokStrany(dok, t, t.platba, D.prijemcaPlatby));
  koren.appendChild(strany);

  if (D.miestoDodania) {
    const md = el(dok, 'section', 'efa-miesto');
    md.appendChild(el(dok, 'h3', null, t.miestoDodania));
    const riadkyMd = [D.miestoDodania.ulica, [D.miestoDodania.psc, D.miestoDodania.mesto].filter(Boolean).join(' '), D.miestoDodania.krajina]
      .filter((x) => x && String(x).trim() !== '');
    for (const r of riadkyMd) md.appendChild(el(dok, 'p', 'efa-adresa', r));
    koren.appendChild(md);
  }

  // polozky
  const sekciaP = el(dok, 'section', 'efa-polozky');
  sekciaP.appendChild(el(dok, 'h3', null, t.polozky));
  const riadkyP = D.riadky.map((r) => [
    r.poradie,
    r.popis ? r.nazov + ' (' + r.popis + ')' : r.nazov,
    r.mnozstvo === '' ? '' : zapisCisla(r.mnozstvo, jazyk),
    K.nazovJednotky(r.jednotka, jazyk) || r.jednotka,
    suma(r.cena, D.mena, jazyk),
    (r.sadzba !== '' ? sadzba(r.sadzba, jazyk) : '') + (r.kategoria ? ' ' + r.kategoria : ''),
    suma(r.suma, D.mena, jazyk)
  ]);
  sekciaP.appendChild(tabulka(dok, [t.pPoradie, t.pNazov, t.pMnozstvo, t.pJednotka, t.pCena, t.pSadzba, t.pSuma], riadkyP, 'efa-tabulka'));
  koren.appendChild(sekciaP);

  // rozpis DPH
  if (D.rozpis.length) {
    const sekciaR = el(dok, 'section', 'efa-rozpis');
    sekciaR.appendChild(el(dok, 'h3', null, t.rozpis));
    const riadkyR = D.rozpis.map((r) => [
      r.kategoria + (K.nazovKategorieDph(r.kategoria, jazyk) ? ' ' + K.nazovKategorieDph(r.kategoria, jazyk) : ''),
      r.sadzba !== '' ? sadzba(r.sadzba, jazyk) : '',
      suma(r.zaklad, D.mena, jazyk),
      suma(r.dan, D.mena, jazyk),
      [r.dovodKod, r.dovodText].filter(Boolean).join(' ')
    ]);
    sekciaR.appendChild(tabulka(dok, [t.rKategoria, t.rSadzba, t.rZaklad, t.rDan, t.rDovod], riadkyR, 'efa-tabulka'));
    koren.appendChild(sekciaR);
  }

  // sucty
  if (D.sucty) {
    const sekciaS = el(dok, 'section', 'efa-sucty');
    sekciaS.appendChild(el(dok, 'h3', null, t.sucty));
    pridajAkJe(sekciaS, riadokUdaju(dok, t.sZaklad, suma(D.sucty.bezDph || D.sucty.zaklad, D.mena, jazyk)));
    pridajAkJe(sekciaS, riadokUdaju(dok, t.sDph, suma(D.danSpolu[0], D.mena, jazyk)));
    pridajAkJe(sekciaS, riadokUdaju(dok, t.sSDph, suma(D.sucty.sDph, D.mena, jazyk)));
    pridajAkJe(sekciaS, riadokUdaju(dok, t.sZaplatene, suma(D.sucty.zaplatene, D.mena, jazyk)));
    pridajAkJe(sekciaS, riadokUdaju(dok, t.sZaokruhlenie, suma(D.sucty.zaokruhlenie, D.mena, jazyk)));
    const uhrada = el(dok, 'p', 'efa-uhrada');
    uhrada.appendChild(el(dok, 'span', 'efa-popis', t.sUhrada));
    uhrada.appendChild(el(dok, 'strong', 'efa-hodnota', suma(D.sucty.naUhradu, D.mena, jazyk)));
    sekciaS.appendChild(uhrada);
    koren.appendChild(sekciaS);
  }

  // platba
  if (D.platby.length || D.platobnePodmienky.length) {
    const sekciaPl = el(dok, 'section', 'efa-platba');
    sekciaPl.appendChild(el(dok, 'h3', null, t.platba));
    for (const p of D.platby) {
      pridajAkJe(sekciaPl, riadokUdaju(dok, t.pSposob,
        (K.nazovSposobuPlatby(p.kod, jazyk) || '') + (p.kod ? ' (' + p.kod + ')' : '')));
      pridajAkJe(sekciaPl, riadokUdaju(dok, t.pIban, zapisIban(p.iban)));
      pridajAkJe(sekciaPl, riadokUdaju(dok, t.pBic, p.bic));
      pridajAkJe(sekciaPl, riadokUdaju(dok, t.pVs, p.identifikator));
      pridajAkJe(sekciaPl, riadokUdaju(dok, t.pMandat, p.mandat));
    }
    for (const n of D.platobnePodmienky) pridajAkJe(sekciaPl, riadokUdaju(dok, t.pPodmienky, n));
    koren.appendChild(sekciaPl);
  }

  // poznamky
  if (D.poznamky.length) {
    const sekciaN = el(dok, 'section', 'efa-poznamky');
    sekciaN.appendChild(el(dok, 'h3', null, t.poznamky));
    for (const n of D.poznamky) sekciaN.appendChild(el(dok, 'p', null, n));
    koren.appendChild(sekciaN);
  }

  // prilohy
  if (D.prilohy.length) {
    const sekciaA = el(dok, 'section', 'efa-prilohy');
    sekciaA.appendChild(el(dok, 'h3', null, t.prilohy));
    const zoznam = el(dok, 'ul');
    for (const p of D.prilohy) {
      const popis = [p.nazovSuboru || p.id, p.typ, p.bajtov ? p.bajtov + ' ' + t.bajtov : '', p.odkaz]
        .filter((x) => x && String(x).trim() !== '').join(', ');
      zoznam.appendChild(el(dok, 'li', null, popis));
    }
    sekciaA.appendChild(zoznam);
    koren.appendChild(sekciaA);
  }

  // profil na konci, aby bolo vidiet, podla coho sme doklad citali
  const pata = el(dok, 'footer', 'efa-pata');
  pridajAkJe(pata, riadokUdaju(dok, t.profil, D.profil));
  koren.appendChild(pata);

  ciel.appendChild(koren);
  return D;
}

// ---------------------------------------------------------------- odkaz "Zobrazit nahlad" (mobil)
// Odkaz je normalny <a href="#nahlad-zivy">, ale klik na neho by zmenil URL hash
// na "nahlad-zivy". App.js pocuva "hashchange" a bere kazdy hash ako meno
// zalozky (kontrola/nahlad/vytvorit); nezname meno spadne na "kontrola", takze
// by sa cely panel Vytvorit aj s nahladom hned skryl namiesto toho, aby sa naň
// odscrolovalo. Preto tu vlastny scroll a zabranenie skutocnej zmene hashu.
// Od relacie 246 app.js nezname kotvy ignoruje (panelZKotvy); vlastny okamzity
// posun tu ostava, lebo plynuly by pri dlhom formulari trval sekundy.
if (typeof document !== 'undefined') {
  const odkazNahlad = document.querySelector('.zobrazit-nahlad');
  if (odkazNahlad) {
    odkazNahlad.addEventListener('click', (e) => {
      const id = (odkazNahlad.getAttribute('href') || '').replace('#', '');
      const ciel = id && document.getElementById(id);
      if (!ciel) return;
      e.preventDefault();
      // "instant", nie "smooth": html ma globalne scroll-behavior:smooth a
      // formular vie byt na mobile aj niekolko tisic px dlhy, take skrolovanie
      // by trvalo sekundy. Tlacidlo ma preniest hned, nie postupne odrolovat.
      ciel.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
  }
}

export { T as TEXTY_NAHLADU, suma as zapisSumy };
