// pravidla-xrechnung.mjs - doplnkove pravidla nemeckej CIUS XRechnung 3.x:
// BR-DE-1 az BR-DE-31 (vratane variantov -a a -b), BR-DE-TMP-32, BR-TMP-2, BR-TMP-6,
// a vybrane pravidla rozsirenia BR-DEX-*.
// Nova implementacia v JavaScripte podla znenia pravidiel (itplr-kosit/xrechnung-schematron, Apache 2.0).

import * as K from './kodovniky.mjs';
import {
  deti, prve, cesta, jeden, txt, hod, atr, vsetky, xpath,
  katVat, pridaj
} from './pravidla-jadro.mjs';

const CH = 'chyba';
const VAR = 'varovanie';
const INF = 'informacia';

// Kontrola IBAN podla mod 97 (ISO 13616). Pouziva ju BR-DE-19, BR-DE-20 aj nasa kontrola navyse.
export function platnyIban(vstup) {
  const v = String(vstup || '').replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(v)) return false;
  const preusporiadane = v.slice(4) + v.slice(0, 4);
  let zvysok = 0;
  for (const znak of preusporiadane) {
    const kod = znak.charCodeAt(0);
    const kus = kod >= 65 ? String(kod - 55) : znak;
    for (const c of kus) zvysok = (zvysok * 10 + Number(c)) % 97;
  }
  return zvysok === 1;
}

// Skonto podla BR-DE-18. Presny regex $XR-SKONTO-REGEX je v common.sch, ktory nemame stiahnuty,
// preto je tento vzor zostaveny podla slovneho popisu pravidla. Hlasime ho ako varovanie.
const SKONTO = /^#SKONTO#TAGE=\d+#PROZENT=\d+\.\d{2}#(BASISBETRAG=-?\d+\.\d{2}#)?$/;

const TELEFON = /(\d[^\d]*){3,}/;
const EMAIL = /^[^\s@.][^\s@]*[^\s@.]@[^\s@.][^\s@]*[^\s@.]$/;

export function pravidlaXrechnung(ctx) {
  const d = ctx.koren;
  const kdeKoren = xpath(d);

  // BR-DE-1 platobne udaje
  if (!ctx.platby.length) {
    pridaj(ctx, 'BR-DE-1', CH, d, '',
      'XRechnung vyžaduje platobné údaje (BG-16). Doplňte cac:PaymentMeans s kódom spôsobu platby.',
      'XRechnung vyžaduje platební údaje (BG-16). Doplňte cac:PaymentMeans s kódem způsobu platby.',
      'XRechnung verlangt Zahlungsangaben (BG-16). Ergänzen Sie cac:PaymentMeans mit dem Zahlungsmittelcode.',
      'XRechnung requires payment instructions (BG-16). Add cac:PaymentMeans with a payment means code.',
      kdeKoren);
  }
  // BR-DE-15 referencia odberatela
  if (hod(d, 'cbc:BuyerReference') === '') {
    pridaj(ctx, 'BR-DE-15', CH, d, '',
      'XRechnung vyžaduje referenciu odberateľa (BT-10, cbc:BuyerReference). Pri nemeckej verejnej správe je to Leitweg-ID, napríklad 04011000-12345-34.',
      'XRechnung vyžaduje referenci odběratele (BT-10, cbc:BuyerReference). U německé veřejné správy je to Leitweg-ID, například 04011000-12345-34.',
      'XRechnung verlangt die Leitweg-ID beziehungsweise Käuferreferenz (BT-10, cbc:BuyerReference), zum Beispiel 04011000-12345-34.',
      'XRechnung requires a buyer reference (BT-10, cbc:BuyerReference). For German public bodies this is the Leitweg-ID, for example 04011000-12345-34.',
      kdeKoren);
  }
  // BR-DE-16 identifikator predajcu pri pouzitych kategoriach DPH
  const podporovane = new Set(['S', 'Z', 'E', 'AE', 'K', 'G', 'L', 'M']);
  const pouzite = new Set();
  for (const r of ctx.riadky) {
    const k = katVat(jeden(r, 'cac:Item'), 'cac:ClassifiedTaxCategory');
    if (k) pouzite.add(hod(k, 'cbc:ID'));
  }
  for (const ac of ctx.acDok) {
    const k = katVat(ac, 'cac:TaxCategory');
    if (k) pouzite.add(hod(k, 'cbc:ID'));
  }
  const trafene = [...pouzite].filter((x) => podporovane.has(x));
  if (trafene.length) {
    const maId = cesta(d, 'cac:AccountingSupplierParty/cac:Party/cac:PartyTaxScheme/cbc:CompanyID').some((n) => txt(n) !== '');
    const maZastupcu = !!prve(d, 'cac:TaxRepresentativeParty');
    if (!maId && !maZastupcu) {
      pridaj(ctx, 'BR-DE-16', CH, jeden(d, 'cac:AccountingSupplierParty/cac:Party') || d, trafene.join(', '),
        'Doklad používa kategórie DPH ' + trafene.join(', ') + ', preto musí obsahovať IČ DPH dodávateľa (BT-31), jeho daňové registračné číslo (BT-32) alebo skupinu daňového zástupcu (BG-11).',
        'Doklad používá kategorie DPH ' + trafene.join(', ') + ', proto musí obsahovat DIČ dodavatele (BT-31), jeho daňové registrační číslo (BT-32) nebo skupinu daňového zástupce (BG-11).',
        'Der Beleg verwendet die Steuercodes ' + trafene.join(', ') + ', deshalb muss die USt-IdNr. (BT-31), die Steuernummer (BT-32) oder die Gruppe SELLER TAX REPRESENTATIVE PARTY (BG-11) angegeben sein.',
        'The document uses VAT categories ' + trafene.join(', ') + ', so it has to carry the seller VAT identifier (BT-31), the seller tax registration identifier (BT-32) or the seller tax representative group (BG-11).',
        kdeKoren);
    }
  }
  // BR-DE-17 kod typu dokladu
  const povoleneDe = new Set(['326', '380', '384', '389', '381', '875', '876', '877']);
  const typ = hod(d, 'cbc:InvoiceTypeCode') || hod(d, 'cbc:CreditNoteTypeCode');
  if (typ !== '' && !povoleneDe.has(typ)) {
    pridaj(ctx, 'BR-DE-17', VAR, prve(d, 'cbc:InvoiceTypeCode') || prve(d, 'cbc:CreditNoteTypeCode') || d, typ,
      'XRechnung očakáva kód typu dokladu (BT-3) z užšieho zoznamu: 326, 380, 381, 384, 389, 875, 876, 877. V súbore je ' + typ + '.',
      'XRechnung očekává kód typu dokladu (BT-3) z užšího seznamu: 326, 380, 381, 384, 389, 875, 876, 877. V souboru je ' + typ + '.',
      'XRechnung erwartet einen Rechnungstyp-Code (BT-3) aus der engeren Liste: 326, 380, 381, 384, 389, 875, 876, 877. In der Datei steht ' + typ + '.',
      'XRechnung expects an invoice type code (BT-3) from a narrower list: 326, 380, 381, 384, 389, 875, 876, 877. The file says ' + typ + '.',
      kdeKoren);
  }
  // BR-DE-18 zapis skonta
  const podmienky = jeden(d, 'cac:PaymentTerms/cbc:Note');
  if (podmienky) {
    const riadkyP = txt(podmienky).split(/\r?\n/).map((x) => x.trim()).filter((x) => x.startsWith('#'));
    for (const riadok of riadkyP) {
      if (!SKONTO.test(riadok)) {
        pridaj(ctx, 'BR-DE-18', VAR, podmienky, riadok,
          'Zápis skonta v platobných podmienkach (BT-20) má mať tvar #SKONTO#TAGE=14#PROZENT=2.00# a môže končiť #BASISBETRAG=100.00#. Riadok "' + riadok + '" tomu nezodpovedá. Presný regulárny výraz je v súbore common.sch špecifikácie XRechnung, ktorý nemáme stiahnutý, preto to hlásime ako varovanie.',
          'Zápis skonta v platebních podmínkách (BT-20) má mít tvar #SKONTO#TAGE=14#PROZENT=2.00# a může končit #BASISBETRAG=100.00#. Řádek "' + riadok + '" tomu neodpovídá. Přesný regulární výraz je v souboru common.sch specifikace XRechnung, který nemáme stažený, proto to hlásíme jako varování.',
          'Die Skonto-Angabe in den Zahlungsbedingungen (BT-20) soll die Form #SKONTO#TAGE=14#PROZENT=2.00# haben und darf mit #BASISBETRAG=100.00# enden. Die Zeile "' + riadok + '" entspricht dem nicht. Der exakte reguläre Ausdruck steht in der Datei common.sch, die uns nicht vorliegt, deshalb melden wir dies als Warnung.',
          'An early payment discount in the payment terms (BT-20) should be written as #SKONTO#TAGE=14#PROZENT=2.00# and may end with #BASISBETRAG=100.00#. The line "' + riadok + '" does not match that. The exact regular expression lives in the XRechnung file common.sch, which we do not have, so we report this as a warning rather than an error.');
      }
    }
  }
  // BR-DE-21 identifikator specifikacie
  const cust = hod(d, 'cbc:CustomizationID');
  if (!cust.startsWith(K.PROFILY.xrechnungPredpona)) {
    pridaj(ctx, 'BR-DE-21', VAR, prve(d, 'cbc:CustomizationID') || d, cust,
      'Pre XRechnung má cbc:CustomizationID (BT-24) začínať na ' + K.PROFILY.xrechnungPredpona + ', napríklad ' + K.PROFILY.xrechnung + '.',
      'Pro XRechnung má cbc:CustomizationID (BT-24) začínat na ' + K.PROFILY.xrechnungPredpona + ', například ' + K.PROFILY.xrechnung + '.',
      'Für XRechnung soll cbc:CustomizationID (BT-24) mit ' + K.PROFILY.xrechnungPredpona + ' beginnen, zum Beispiel ' + K.PROFILY.xrechnung + '.',
      'For XRechnung, cbc:CustomizationID (BT-24) should start with ' + K.PROFILY.xrechnungPredpona + ', for example ' + K.PROFILY.xrechnung + '.',
      kdeKoren);
  }
  // BR-DE-22 jedinecne nazvy suborov priloh
  const nazvy = new Map();
  for (const adr of deti(d, 'cac:AdditionalDocumentReference')) {
    for (const bin of cesta(adr, 'cac:Attachment/cbc:EmbeddedDocumentBinaryObject')) {
      const f = atr(bin, 'filename');
      if (f === undefined) continue;
      if (nazvy.has(f)) {
        pridaj(ctx, 'BR-DE-22', CH, bin, f,
          'Názov súboru prílohy "' + f + '" sa v doklade opakuje. Každá príloha musí mať iný atribút filename.',
          'Název souboru přílohy "' + f + '" se v dokladu opakuje. Každá příloha musí mít jiný atribut filename.',
          'Der Dateiname der Anlage "' + f + '" kommt mehrfach vor. Jede Anlage braucht ein eigenes filename-Attribut.',
          'The attachment file name "' + f + '" appears more than once in the document. Every attachment needs its own filename attribute.');
      }
      nazvy.set(f, bin);
    }
  }
  // BR-DE-26 opravna faktura ma odkazovat na povodnu
  if (typ === '384' && !cesta(d, 'cac:BillingReference/cac:InvoiceDocumentReference').length) {
    pridaj(ctx, 'BR-DE-26', VAR, d, typ,
      'Pri opravnej faktúre (kód 384) má byť uvedený odkaz na pôvodnú faktúru (BG-3, cac:BillingReference/cac:InvoiceDocumentReference).',
      'U opravného dokladu (kód 384) má být uveden odkaz na původní fakturu (BG-3, cac:BillingReference/cac:InvoiceDocumentReference).',
      'Bei einer Rechnungskorrektur (Code 384) soll der Verweis auf die vorausgegangene Rechnung (BG-3, cac:BillingReference/cac:InvoiceDocumentReference) angegeben sein.',
      'A corrected invoice (type code 384) should reference the preceding invoice (BG-3, cac:BillingReference/cac:InvoiceDocumentReference).',
      kdeKoren);
  }
  // BR-DE-30 a BR-DE-31 inkaso
  const maMandat = cesta(d, 'cac:PaymentMeans/cac:PaymentMandate').length > 0;
  if (maMandat) {
    const maVeritela =
      cesta(d, 'cac:AccountingSupplierParty/cac:Party/cac:PartyIdentification/cbc:ID').some((n) => atr(n, 'schemeID') === 'SEPA') ||
      cesta(d, 'cac:PayeeParty/cac:PartyIdentification/cbc:ID').some((n) => atr(n, 'schemeID') === 'SEPA');
    if (!maVeritela) {
      pridaj(ctx, 'BR-DE-30', CH, d, '',
        'Pri inkase (BG-19) musí byť uvedený identifikátor veriteľa (BT-90) v cac:PartyIdentification/cbc:ID s atribútom schemeID="SEPA".',
        'Při inkasu (BG-19) musí být uveden identifikátor věřitele (BT-90) v cac:PartyIdentification/cbc:ID s atributem schemeID="SEPA".',
        'Bei Lastschrift (BG-19) muss die Gläubiger-Identifikationsnummer (BT-90) in cac:PartyIdentification/cbc:ID mit schemeID="SEPA" stehen.',
        'With a direct debit (BG-19) the bank assigned creditor identifier (BT-90) has to be given in cac:PartyIdentification/cbc:ID with schemeID="SEPA".',
        kdeKoren);
    }
    if (!cesta(d, 'cac:PaymentMeans/cac:PaymentMandate/cac:PayerFinancialAccount/cbc:ID').length) {
      pridaj(ctx, 'BR-DE-31', CH, d, '',
        'Pri inkase (BG-19) musí byť uvedené číslo účtu platiteľa (BT-91) v cac:PaymentMandate/cac:PayerFinancialAccount/cbc:ID.',
        'Při inkasu (BG-19) musí být uvedeno číslo účtu plátce (BT-91) v cac:PaymentMandate/cac:PayerFinancialAccount/cbc:ID.',
        'Bei Lastschrift (BG-19) muss die Kontokennung des Zahlers (BT-91) in cac:PaymentMandate/cac:PayerFinancialAccount/cbc:ID stehen.',
        'With a direct debit (BG-19) the debited account identifier (BT-91) has to be given in cac:PaymentMandate/cac:PayerFinancialAccount/cbc:ID.',
        kdeKoren);
    }
  }
  // BR-DE-TMP-32 datum dodania
  const maDatum = hod(d, 'cac:Delivery/cbc:ActualDeliveryDate') !== '';
  const maObdobie = deti(d, 'cac:InvoicePeriod').length > 0;
  const vsetkyRiadkyObdobie = ctx.riadky.length > 0 && ctx.riadky.every((r) => deti(r, 'cac:InvoicePeriod').length > 0);
  if (!maDatum && !maObdobie && !vsetkyRiadkyObdobie) {
    pridaj(ctx, 'BR-DE-TMP-32', INF, d, '',
      'Doklad by mal uvádzať dátum dodania: buď BT-72 (cac:Delivery/cbc:ActualDeliveryDate), BG-14 (cac:InvoicePeriod), alebo obdobie v každom riadku.',
      'Doklad by měl uvádět datum dodání: buď BT-72 (cac:Delivery/cbc:ActualDeliveryDate), BG-14 (cac:InvoicePeriod), nebo období v každém řádku.',
      'Der Beleg sollte das Liefer- oder Leistungsdatum angeben: entweder BT-72 (cac:Delivery/cbc:ActualDeliveryDate), BG-14 (cac:InvoicePeriod) oder einen Zeitraum in jeder Position.',
      'The document should state when the supply took place: either BT-72 (cac:Delivery/cbc:ActualDeliveryDate), BG-14 (cac:InvoicePeriod), or a period on every line.',
      kdeKoren);
  }
  // BR-DE-2 kontakt dodavatela
  const dod = jeden(d, 'cac:AccountingSupplierParty');
  if (dod && !jeden(dod, 'cac:Party/cac:Contact')) {
    pridaj(ctx, 'BR-DE-2', CH, dod, '',
      'XRechnung vyžaduje kontakt dodávateľa (BG-6). Doplňte cac:AccountingSupplierParty/cac:Party/cac:Contact s menom, telefónom a e-mailom.',
      'XRechnung vyžaduje kontakt dodavatele (BG-6). Doplňte cac:AccountingSupplierParty/cac:Party/cac:Contact se jménem, telefonem a e-mailem.',
      'XRechnung verlangt die Verkäufer-Kontaktangaben (BG-6). Ergänzen Sie cac:AccountingSupplierParty/cac:Party/cac:Contact mit Name, Telefon und E-Mail.',
      'XRechnung requires seller contact details (BG-6). Add cac:AccountingSupplierParty/cac:Party/cac:Contact with a name, a phone number and an e-mail address.');
  }
  // BR-DE-3, BR-DE-4 adresa dodavatela
  const adrD = jeden(d, 'cac:AccountingSupplierParty/cac:Party/cac:PostalAddress');
  if (adrD) {
    if (hod(adrD, 'cbc:CityName') === '') {
      pridaj(ctx, 'BR-DE-3', CH, adrD, '',
        'V adrese dodávateľa chýba mesto (BT-37, cbc:CityName).',
        'V adrese dodavatele chybí město (BT-37, cbc:CityName).',
        'In der Verkäuferanschrift fehlt der Ort (BT-37, cbc:CityName).',
        'The seller address is missing the city (BT-37, cbc:CityName).');
    }
    if (hod(adrD, 'cbc:PostalZone') === '') {
      pridaj(ctx, 'BR-DE-4', CH, adrD, '',
        'V adrese dodávateľa chýba PSČ (BT-38, cbc:PostalZone).',
        'V adrese dodavatele chybí PSČ (BT-38, cbc:PostalZone).',
        'In der Verkäuferanschrift fehlt die Postleitzahl (BT-38, cbc:PostalZone).',
        'The seller address is missing the post code (BT-38, cbc:PostalZone).');
    }
  }
  // BR-DE-5 az BR-DE-7, BR-DE-27, BR-DE-28 kontakt
  const kontakt = jeden(d, 'cac:AccountingSupplierParty/cac:Party/cac:Contact');
  if (kontakt) {
    if (hod(kontakt, 'cbc:Name') === '') {
      pridaj(ctx, 'BR-DE-5', CH, kontakt, '',
        'V kontakte dodávateľa chýba meno kontaktnej osoby (BT-41, cbc:Name).',
        'V kontaktu dodavatele chybí jméno kontaktní osoby (BT-41, cbc:Name).',
        'In den Verkäufer-Kontaktangaben fehlt der Ansprechpartner (BT-41, cbc:Name).',
        'The seller contact details are missing the contact point name (BT-41, cbc:Name).');
    }
    if (hod(kontakt, 'cbc:Telephone') === '') {
      pridaj(ctx, 'BR-DE-6', CH, kontakt, '',
        'V kontakte dodávateľa chýba telefón (BT-42, cbc:Telephone).',
        'V kontaktu dodavatele chybí telefon (BT-42, cbc:Telephone).',
        'In den Verkäufer-Kontaktangaben fehlt die Telefonnummer (BT-42, cbc:Telephone).',
        'The seller contact details are missing the telephone number (BT-42, cbc:Telephone).');
    } else if (!TELEFON.test(hod(kontakt, 'cbc:Telephone'))) {
      pridaj(ctx, 'BR-DE-27', VAR, prve(kontakt, 'cbc:Telephone'), hod(kontakt, 'cbc:Telephone'),
        'Telefón dodávateľa (BT-42) má obsahovať aspoň tri číslice. V súbore je "' + hod(kontakt, 'cbc:Telephone') + '".',
        'Telefon dodavatele (BT-42) má obsahovat alespoň tři číslice. V souboru je "' + hod(kontakt, 'cbc:Telephone') + '".',
        'Die Telefonnummer des Verkäufers (BT-42) soll mindestens drei Ziffern enthalten. In der Datei steht "' + hod(kontakt, 'cbc:Telephone') + '".',
        'The seller telephone number (BT-42) should contain at least three digits. The file says "' + hod(kontakt, 'cbc:Telephone') + '".');
    }
    if (hod(kontakt, 'cbc:ElectronicMail') === '') {
      pridaj(ctx, 'BR-DE-7', CH, kontakt, '',
        'V kontakte dodávateľa chýba e-mail (BT-43, cbc:ElectronicMail).',
        'V kontaktu dodavatele chybí e-mail (BT-43, cbc:ElectronicMail).',
        'In den Verkäufer-Kontaktangaben fehlt die E-Mail-Adresse (BT-43, cbc:ElectronicMail).',
        'The seller contact details are missing the e-mail address (BT-43, cbc:ElectronicMail).');
    } else if (!EMAIL.test(hod(kontakt, 'cbc:ElectronicMail'))) {
      pridaj(ctx, 'BR-DE-28', VAR, prve(kontakt, 'cbc:ElectronicMail'), hod(kontakt, 'cbc:ElectronicMail'),
        'E-mail dodávateľa (BT-43) má mať práve jeden znak @, aspoň dva znaky na oboch stranách a nesmie začínať ani končiť bodkou. V súbore je "' + hod(kontakt, 'cbc:ElectronicMail') + '".',
        'E-mail dodavatele (BT-43) má mít právě jeden znak @, alespoň dva znaky na obou stranách a nesmí začínat ani končit tečkou. V souboru je "' + hod(kontakt, 'cbc:ElectronicMail') + '".',
        'Die E-Mail-Adresse des Verkäufers (BT-43) soll genau ein @ enthalten, mindestens zwei Zeichen auf beiden Seiten haben und nicht mit einem Punkt beginnen oder enden. In der Datei steht "' + hod(kontakt, 'cbc:ElectronicMail') + '".',
        'The seller e-mail address (BT-43) should contain exactly one @, at least two characters on each side of it, and must not start or end with a dot. The file says "' + hod(kontakt, 'cbc:ElectronicMail') + '".');
    }
  }
  // BR-DE-8 a BR-DE-9 adresa odberatela
  const adrO = jeden(d, 'cac:AccountingCustomerParty/cac:Party/cac:PostalAddress');
  if (adrO) {
    if (hod(adrO, 'cbc:CityName') === '') {
      pridaj(ctx, 'BR-DE-8', CH, adrO, '',
        'V adrese odberateľa chýba mesto (BT-52, cbc:CityName).',
        'V adrese odběratele chybí město (BT-52, cbc:CityName).',
        'In der Käuferanschrift fehlt der Ort (BT-52, cbc:CityName).',
        'The buyer address is missing the city (BT-52, cbc:CityName).');
    }
    if (hod(adrO, 'cbc:PostalZone') === '') {
      pridaj(ctx, 'BR-DE-9', CH, adrO, '',
        'V adrese odberateľa chýba PSČ (BT-53, cbc:PostalZone).',
        'V adrese odběratele chybí PSČ (BT-53, cbc:PostalZone).',
        'In der Käuferanschrift fehlt die Postleitzahl (BT-53, cbc:PostalZone).',
        'The buyer address is missing the post code (BT-53, cbc:PostalZone).');
    }
  }
  // BR-DE-10 a BR-DE-11 adresa miesta dodania
  for (const adr of cesta(d, 'cac:Delivery/cac:DeliveryLocation/cac:Address')) {
    if (hod(adr, 'cbc:CityName') === '') {
      pridaj(ctx, 'BR-DE-10', CH, adr, '',
        'V adrese miesta dodania chýba mesto (BT-77, cbc:CityName).',
        'V adrese místa dodání chybí město (BT-77, cbc:CityName).',
        'In der Lieferanschrift fehlt der Ort (BT-77, cbc:CityName).',
        'The deliver to address is missing the city (BT-77, cbc:CityName).');
    }
    if (hod(adr, 'cbc:PostalZone') === '') {
      pridaj(ctx, 'BR-DE-11', CH, adr, '',
        'V adrese miesta dodania chýba PSČ (BT-78, cbc:PostalZone).',
        'V adrese místa dodání chybí PSČ (BT-78, cbc:PostalZone).',
        'In der Lieferanschrift fehlt die Postleitzahl (BT-78, cbc:PostalZone).',
        'The deliver to address is missing the post code (BT-78, cbc:PostalZone).');
    }
  }
  // BR-DE-19, BR-DE-20, BR-DE-23, BR-DE-24, BR-DE-25 podla sposobu platby
  for (const pm of ctx.platby) {
    const kod = hod(pm, 'cbc:PaymentMeansCode');
    if (kod === '30' || kod === '58') {
      if (kod === '58') {
        const iban = hod(pm, 'cac:PayeeFinancialAccount/cbc:ID');
        if (!platnyIban(iban)) {
          pridaj(ctx, 'BR-DE-19', VAR, jeden(pm, 'cac:PayeeFinancialAccount/cbc:ID') || pm, iban,
            'Pri SEPA prevode (kód 58) má byť v cac:PayeeFinancialAccount/cbc:ID platný IBAN. "' + iban + '" nesedí na kontrolu mod 97.',
            'Při SEPA převodu (kód 58) má být v cac:PayeeFinancialAccount/cbc:ID platný IBAN. "' + iban + '" nesedí na kontrolu mod 97.',
            'Bei SEPA-Überweisung (Code 58) soll in cac:PayeeFinancialAccount/cbc:ID eine gültige IBAN stehen. "' + iban + '" besteht die Modulo-97-Prüfung nicht.',
            'With a SEPA credit transfer (code 58) cac:PayeeFinancialAccount/cbc:ID should hold a valid IBAN. "' + iban + '" fails the mod 97 check.');
        }
      }
      if (!jeden(pm, 'cac:PayeeFinancialAccount')) {
        pridaj(ctx, 'BR-DE-23-a', CH, pm, kod,
          'Pri prevode (kód ' + kod + ') musí byť uvedená skupina cac:PayeeFinancialAccount (BG-17).',
          'Při převodu (kód ' + kod + ') musí být uvedena skupina cac:PayeeFinancialAccount (BG-17).',
          'Bei Überweisung (Code ' + kod + ') muss die Gruppe cac:PayeeFinancialAccount (BG-17) angegeben sein.',
          'With a credit transfer (code ' + kod + ') the group cac:PayeeFinancialAccount (BG-17) has to be present.');
      }
      if (jeden(pm, 'cac:CardAccount') || jeden(pm, 'cac:PaymentMandate')) {
        pridaj(ctx, 'BR-DE-23-b', CH, pm, kod,
          'Pri prevode (kód ' + kod + ') nesmie byť uvedená karta (BG-18) ani inkasný mandát (BG-19).',
          'Při převodu (kód ' + kod + ') nesmí být uvedena karta (BG-18) ani inkasní mandát (BG-19).',
          'Bei Überweisung (Code ' + kod + ') dürfen weder Karte (BG-18) noch Lastschriftmandat (BG-19) angegeben sein.',
          'With a credit transfer (code ' + kod + ') neither the card group (BG-18) nor the direct debit mandate (BG-19) may be present.');
      }
    }
    if (kod === '48' || kod === '54' || kod === '55') {
      if (!jeden(pm, 'cac:CardAccount')) {
        pridaj(ctx, 'BR-DE-24-a', CH, pm, kod,
          'Pri platbe kartou (kód ' + kod + ') musí byť uvedená skupina cac:CardAccount (BG-18).',
          'Při platbě kartou (kód ' + kod + ') musí být uvedena skupina cac:CardAccount (BG-18).',
          'Bei Kartenzahlung (Code ' + kod + ') muss die Gruppe cac:CardAccount (BG-18) angegeben sein.',
          'With a card payment (code ' + kod + ') the group cac:CardAccount (BG-18) has to be present.');
      }
      if (jeden(pm, 'cac:PayeeFinancialAccount') || jeden(pm, 'cac:PaymentMandate')) {
        pridaj(ctx, 'BR-DE-24-b', CH, pm, kod,
          'Pri platbe kartou (kód ' + kod + ') nesmie byť uvedený bankový účet (BG-17) ani inkasný mandát (BG-19).',
          'Při platbě kartou (kód ' + kod + ') nesmí být uveden bankovní účet (BG-17) ani inkasní mandát (BG-19).',
          'Bei Kartenzahlung (Code ' + kod + ') dürfen weder Bankkonto (BG-17) noch Lastschriftmandat (BG-19) angegeben sein.',
          'With a card payment (code ' + kod + ') neither the bank account group (BG-17) nor the direct debit mandate (BG-19) may be present.');
      }
    }
    if (kod === '59') {
      const iban = hod(pm, 'cac:PaymentMandate/cac:PayerFinancialAccount/cbc:ID');
      if (!platnyIban(iban)) {
        pridaj(ctx, 'BR-DE-20', VAR, jeden(pm, 'cac:PaymentMandate/cac:PayerFinancialAccount/cbc:ID') || pm, iban,
          'Pri SEPA inkase (kód 59) má byť v cac:PaymentMandate/cac:PayerFinancialAccount/cbc:ID platný IBAN. "' + iban + '" nesedí na kontrolu mod 97.',
          'Při SEPA inkasu (kód 59) má být v cac:PaymentMandate/cac:PayerFinancialAccount/cbc:ID platný IBAN. "' + iban + '" nesedí na kontrolu mod 97.',
          'Bei SEPA-Lastschrift (Code 59) soll in cac:PaymentMandate/cac:PayerFinancialAccount/cbc:ID eine gültige IBAN stehen. "' + iban + '" besteht die Modulo-97-Prüfung nicht.',
          'With a SEPA direct debit (code 59) cac:PaymentMandate/cac:PayerFinancialAccount/cbc:ID should hold a valid IBAN. "' + iban + '" fails the mod 97 check.');
      }
      if (!jeden(pm, 'cac:PaymentMandate')) {
        pridaj(ctx, 'BR-DE-25-a', CH, pm, kod,
          'Pri inkase (kód 59) musí byť uvedená skupina cac:PaymentMandate (BG-19).',
          'Při inkasu (kód 59) musí být uvedena skupina cac:PaymentMandate (BG-19).',
          'Bei Lastschrift (Code 59) muss die Gruppe cac:PaymentMandate (BG-19) angegeben sein.',
          'With a direct debit (code 59) the group cac:PaymentMandate (BG-19) has to be present.');
      }
      if (jeden(pm, 'cac:PayeeFinancialAccount') || jeden(pm, 'cac:CardAccount')) {
        pridaj(ctx, 'BR-DE-25-b', CH, pm, kod,
          'Pri inkase (kód 59) nesmie byť uvedený bankový účet príjemcu (BG-17) ani karta (BG-18).',
          'Při inkasu (kód 59) nesmí být uveden bankovní účet příjemce (BG-17) ani karta (BG-18).',
          'Bei Lastschrift (Code 59) dürfen weder das Konto des Zahlungsempfängers (BG-17) noch eine Karte (BG-18) angegeben sein.',
          'With a direct debit (code 59) neither the payee account group (BG-17) nor the card group (BG-18) may be present.');
      }
    }
  }
  // BR-DE-14 sadzba DPH v rozpise
  for (const ts of ctx.podsuhrny) {
    const kat = katVat(ts, 'cac:TaxCategory');
    if (!kat || hod(kat, 'cbc:Percent') === '') {
      pridaj(ctx, 'BR-DE-14', CH, ts, '',
        'XRechnung vyžaduje sadzbu DPH (BT-119) v každom rozpise DPH: cac:TaxCategory/cbc:Percent. Pri oslobodení uveďte 0.',
        'XRechnung vyžaduje sazbu DPH (BT-119) v každém rozpisu DPH: cac:TaxCategory/cbc:Percent. Při osvobození uveďte 0.',
        'XRechnung verlangt den Steuersatz (BT-119) in jeder Steueraufschlüsselung: cac:TaxCategory/cbc:Percent. Bei Befreiung geben Sie 0 an.',
        'XRechnung requires the VAT rate (BT-119) in every VAT breakdown: cac:TaxCategory/cbc:Percent. For an exempt category write 0.');
    }
  }
  // BR-TMP-2 odkaz na externy dokument
  for (const ext of vsetky(d, 'cac:ExternalReference')) {
    const uri = hod(ext, 'cbc:URI');
    if (uri !== '' && !/^[A-Za-z][A-Za-z0-9+.-]*:\/\/[^\s]+$/.test(uri) && !/^(mailto|urn):[^\s]+$/.test(uri)) {
      pridaj(ctx, 'BR-TMP-2', CH, prve(ext, 'cbc:URI') || ext, uri,
        'Odkaz na externý dokument (BT-124, cbc:URI) musí byť úplná adresa aj so schémou, napríklad https://priklad.sk/priloha.pdf.',
        'Odkaz na externí dokument (BT-124, cbc:URI) musí být úplná adresa i se schématem, například https://priklad.cz/priloha.pdf.',
        'Der Verweis auf ein externes Dokument (BT-124, cbc:URI) muss eine vollständige URL mit Schema sein, zum Beispiel https://beispiel.de/anlage.pdf.',
        'The external document location (BT-124, cbc:URI) has to be a full address including the scheme, for example https://example.com/attachment.pdf.');
    }
  }
  // BR-TMP-6 format datumov
  for (const n of vsetky(d, 'cbc:IssueDate|cbc:DueDate|cbc:StartDate|cbc:EndDate|cbc:ActualDeliveryDate|cbc:TaxPointDate|cbc:PaymentDueDate')) {
    const v = txt(n);
    if (v !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      pridaj(ctx, 'BR-TMP-6', VAR, n, v,
        'Dátum v prvku ' + n.meno + ' musí byť v tvare RRRR-MM-DD, bez času a bez časového pásma. V súbore je "' + v + '".',
        'Datum v prvku ' + n.meno + ' musí být ve tvaru RRRR-MM-DD, bez času a bez časového pásma. V souboru je "' + v + '".',
        'Das Datum in ' + n.meno + ' muss im Format JJJJ-MM-TT stehen, ohne Uhrzeit und Zeitzone. In der Datei steht "' + v + '".',
        'The date in ' + n.meno + ' has to be written as YYYY-MM-DD, with no time and no time zone. The file says "' + v + '".');
    }
  }
  // ---- rozsirenie XRechnung: BR-DEX-01 a BR-DEX-04 az BR-DEX-08
  if (cust === K.PROFILY.xrechnungRozsirenie) {
    for (const n of vsetky(d, 'cbc:EmbeddedDocumentBinaryObject')) {
      const v = n.atr.mimeCode;
      if (v === undefined) continue;
      const t = String(v).trim();
      if (!K.MIME_PRILOHY.has(t) && !K.MIME_PRILOHY_ROZSIRENIE.has(t)) {
        pridaj(ctx, 'BR-DEX-01', CH, n, v,
          'V rozšírení XRechnung je okrem bežných typov povolený navyše len application/xml. Príloha má mimeCode="' + v + '".',
          'V rozšíření XRechnung je kromě běžných typu povolen navíc jen application/xml. Příloha má mimeCode="' + v + '".',
          'In der XRechnung-Extension ist zusätzlich nur application/xml erlaubt. Die Anlage hat mimeCode="' + v + '".',
          'The XRechnung extension allows only application/xml on top of the usual attachment types. This attachment has mimeCode="' + v + '".');
      }
    }
    const icd = [
      ['BR-DEX-04', 'cac:PartyIdentification', 'cbc:ID'],
      ['BR-DEX-05', 'cac:PartyLegalEntity', 'cbc:CompanyID'],
      ['BR-DEX-06', 'cac:StandardItemIdentification', 'cbc:ID'],
      ['BR-DEX-08', 'cac:DeliveryLocation', 'cbc:ID']
    ];
    for (const [kod, rodicK, dietaK] of icd) {
      for (const rodic of vsetky(d, rodicK)) {
        for (const n of deti(rodic, dietaK)) {
          const v = n.atr.schemeID;
          if (v === undefined) continue;
          const t = String(v).trim();
          if (t === 'SEPA') continue;
          if (!K.ICD.has(t)) {
            pridaj(ctx, kod, CH, n, v,
              'V rozšírení XRechnung musí byť schemeID="' + v + '" kódom zo zoznamu ISO 6523 ICD.',
              'V rozšíření XRechnung musí být schemeID="' + v + '" kódem ze seznamu ISO 6523 ICD.',
              'In der XRechnung-Extension muss schemeID="' + v + '" ein Code aus der ISO-6523-ICD-Liste sein.',
              'In the XRechnung extension, schemeID="' + v + '" has to be a code from the ISO 6523 ICD list.');
          }
        }
      }
    }
    for (const n of vsetky(d, 'cbc:EndpointID')) {
      const v = n.atr.schemeID;
      if (v !== undefined && !K.EAS.has(String(v).trim())) {
        pridaj(ctx, 'BR-DEX-07', CH, n, v,
          'V rozšírení XRechnung musí byť schemeID elektronickej adresy z kódovníka CEF EAS. V súbore je "' + v + '".',
          'V rozšíření XRechnung musí být schemeID elektronické adresy z číselníku CEF EAS. V souboru je "' + v + '".',
          'In der XRechnung-Extension muss die schemeID der elektronischen Adresse aus der CEF-EAS-Liste stammen. In der Datei steht "' + v + '".',
          'In the XRechnung extension, the schemeID of the electronic address has to come from the CEF EAS code list. The file says "' + v + '".');
      }
    }
  }
}
