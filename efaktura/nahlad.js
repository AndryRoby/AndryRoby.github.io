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
    for (const b of r) tr.appendChild(el(dok, 'td', null, b));
    tbody.appendChild(tr);
  }
  tab.appendChild(tbody);
  return tab;
}

function suma(hodnota, mena) {
  if (hodnota === undefined || hodnota === null || String(hodnota).trim() === '') return '';
  return String(hodnota) + (mena ? ' ' + mena : '');
}

/**
 * Vykresli citatelny doklad do ciela.
 * @param {object} vstup korenovy uzol UBL alebo uz precitany doklad z precitajDoklad
 * @param {HTMLElement} ciel prvok, do ktoreho sa vykresli (jeho obsah sa nahradi)
 * @param {'sk'|'cs'|'de'} jazyk
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
  pridajAkJe(hlava, riadokUdaju(dok, t.vystavena, D.datumVystavenia));
  pridajAkJe(hlava, riadokUdaju(dok, t.dodanie, D.datumDodania));
  pridajAkJe(hlava, riadokUdaju(dok, t.splatnost, D.datumSplatnosti));
  if (D.obdobieOd || D.obdobieDo) {
    pridajAkJe(hlava, riadokUdaju(dok, t.obdobie, [D.obdobieOd, D.obdobieDo].filter(Boolean).join(' .. ')));
  }
  pridajAkJe(hlava, riadokUdaju(dok, t.referencia, D.referenciaOdberatela));
  pridajAkJe(hlava, riadokUdaju(dok, t.objednavka, D.objednavka));
  pridajAkJe(hlava, riadokUdaju(dok, t.predchadzajuca, D.predchadzajuca));
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
    r.mnozstvo,
    K.nazovJednotky(r.jednotka, jazyk) || r.jednotka,
    suma(r.cena, D.mena),
    (r.sadzba !== '' ? r.sadzba + ' %' : '') + (r.kategoria ? ' ' + r.kategoria : ''),
    suma(r.suma, D.mena)
  ]);
  sekciaP.appendChild(tabulka(dok, [t.pPoradie, t.pNazov, t.pMnozstvo, t.pJednotka, t.pCena, t.pSadzba, t.pSuma], riadkyP, 'efa-tabulka'));
  koren.appendChild(sekciaP);

  // rozpis DPH
  if (D.rozpis.length) {
    const sekciaR = el(dok, 'section', 'efa-rozpis');
    sekciaR.appendChild(el(dok, 'h3', null, t.rozpis));
    const riadkyR = D.rozpis.map((r) => [
      r.kategoria + (K.nazovKategorieDph(r.kategoria, jazyk) ? ' ' + K.nazovKategorieDph(r.kategoria, jazyk) : ''),
      r.sadzba !== '' ? r.sadzba + ' %' : '',
      suma(r.zaklad, D.mena),
      suma(r.dan, D.mena),
      [r.dovodKod, r.dovodText].filter(Boolean).join(' ')
    ]);
    sekciaR.appendChild(tabulka(dok, [t.rKategoria, t.rSadzba, t.rZaklad, t.rDan, t.rDovod], riadkyR, 'efa-tabulka'));
    koren.appendChild(sekciaR);
  }

  // sucty
  if (D.sucty) {
    const sekciaS = el(dok, 'section', 'efa-sucty');
    sekciaS.appendChild(el(dok, 'h3', null, t.sucty));
    pridajAkJe(sekciaS, riadokUdaju(dok, t.sZaklad, suma(D.sucty.bezDph || D.sucty.zaklad, D.mena)));
    pridajAkJe(sekciaS, riadokUdaju(dok, t.sDph, suma(D.danSpolu[0], D.mena)));
    pridajAkJe(sekciaS, riadokUdaju(dok, t.sSDph, suma(D.sucty.sDph, D.mena)));
    pridajAkJe(sekciaS, riadokUdaju(dok, t.sZaplatene, suma(D.sucty.zaplatene, D.mena)));
    pridajAkJe(sekciaS, riadokUdaju(dok, t.sZaokruhlenie, suma(D.sucty.zaokruhlenie, D.mena)));
    const uhrada = el(dok, 'p', 'efa-uhrada');
    uhrada.appendChild(el(dok, 'span', 'efa-popis', t.sUhrada));
    uhrada.appendChild(el(dok, 'strong', 'efa-hodnota', suma(D.sucty.naUhradu, D.mena)));
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
      pridajAkJe(sekciaPl, riadokUdaju(dok, t.pIban, p.iban));
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

export { T as TEXTY_NAHLADU };
