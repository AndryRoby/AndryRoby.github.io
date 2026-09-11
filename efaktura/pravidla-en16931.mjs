// pravidla-en16931.mjs - zakladne pravidla EN 16931 v syntaxi UBL 2.1:
// BR-01 az BR-65, BR-CO-*, BR-DEC-*, BR-CL-*, BR-B-*.
// Nova implementacia v JavaScripte podla znenia pravidiel, nie prepis schematronu.

import * as K from './kodovniky.mjs';
import {
  deti, prve, cesta, jeden, txt, hod, atr, vsetky, xpath,
  cis, r2, desatinne, doJednotky, katVat, pridaj
} from './pravidla-jadro.mjs';

const CH = 'chyba';
const VAR = 'varovanie';

// ---------------------------------------------------------------- povinne prvky dokladu

function zakladne(ctx) {
  const d = ctx.koren;
  const P = (kod, uzol, hodnota, sk, cs, de, en, cesta_) => pridaj(ctx, kod, CH, uzol, hodnota, sk, cs, de, en, cesta_);
  const kdeKoren = xpath(d);

  if (hod(d, 'cbc:CustomizationID') === '') {
    P('BR-01', d, '',
      'Chýba identifikátor špecifikácie (BT-24, prvok cbc:CustomizationID). Doplňte ho hneď do koreňového prvku, pre Peppol je to urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0.',
      'Chybí identifikátor specifikace (BT-24, prvek cbc:CustomizationID). Doplňte jej hned do kořenového prvku, pro Peppol je to urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0.',
      'Die Spezifikationskennung (BT-24, Element cbc:CustomizationID) fehlt. Ergänzen Sie sie im Wurzelelement, für Peppol lautet sie urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0.',
      'The specification identifier (BT-24, element cbc:CustomizationID) is missing. Add it to the root element; for Peppol BIS Billing 3.0 the value is urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0.',
      kdeKoren);
  }
  if (hod(d, 'cbc:ID') === '') {
    P('BR-02', d, '',
      'Chýba číslo faktúry (BT-1, prvok cbc:ID). Doplňte číslo dokladu.',
      'Chybí číslo faktury (BT-1, prvek cbc:ID). Doplňte číslo dokladu.',
      'Die Rechnungsnummer (BT-1, Element cbc:ID) fehlt. Ergänzen Sie die Belegnummer.',
      'The invoice number (BT-1, element cbc:ID) is missing. Add the document number.',
      kdeKoren);
  }
  if (hod(d, 'cbc:IssueDate') === '') {
    P('BR-03', d, '',
      'Chýba dátum vystavenia (BT-2, prvok cbc:IssueDate) v tvare RRRR-MM-DD.',
      'Chybí datum vystavení (BT-2, prvek cbc:IssueDate) ve tvaru RRRR-MM-DD.',
      'Das Rechnungsdatum (BT-2, Element cbc:IssueDate) im Format JJJJ-MM-TT fehlt.',
      'The issue date (BT-2, element cbc:IssueDate) is missing. Write it as YYYY-MM-DD.',
      kdeKoren);
  }
  if (hod(d, 'cbc:InvoiceTypeCode') === '' && hod(d, 'cbc:CreditNoteTypeCode') === '') {
    P('BR-04', d, '',
      'Chýba kód typu dokladu (BT-3). Do faktúry patrí cbc:InvoiceTypeCode s hodnotou 380, do dobropisu cbc:CreditNoteTypeCode s hodnotou 381.',
      'Chybí kód typu dokladu (BT-3). Do faktury patří cbc:InvoiceTypeCode s hodnotou 380, do dobropisu cbc:CreditNoteTypeCode s hodnotou 381.',
      'Der Rechnungstyp-Code (BT-3) fehlt. In die Rechnung gehört cbc:InvoiceTypeCode mit 380, in die Gutschrift cbc:CreditNoteTypeCode mit 381.',
      'The invoice type code (BT-3) is missing. An invoice needs cbc:InvoiceTypeCode with the value 380, a credit note needs cbc:CreditNoteTypeCode with 381.',
      kdeKoren);
  }
  if (hod(d, 'cbc:DocumentCurrencyCode') === '') {
    P('BR-05', d, '',
      'Chýba mena faktúry (BT-5, prvok cbc:DocumentCurrencyCode), napríklad EUR.',
      'Chybí měna faktury (BT-5, prvek cbc:DocumentCurrencyCode), například EUR.',
      'Die Rechnungswährung (BT-5, Element cbc:DocumentCurrencyCode) fehlt, zum Beispiel EUR.',
      'The invoice currency code (BT-5, element cbc:DocumentCurrencyCode) is missing, for example EUR.',
      kdeKoren);
  }
  if (hod(d, 'cac:AccountingSupplierParty/cac:Party/cac:PartyLegalEntity/cbc:RegistrationName') === '') {
    P('BR-06', jeden(d, 'cac:AccountingSupplierParty/cac:Party') || d, '',
      'Chýba obchodné meno dodávateľa (BT-27). Patrí do cac:AccountingSupplierParty/cac:Party/cac:PartyLegalEntity/cbc:RegistrationName.',
      'Chybí obchodní jméno dodavatele (BT-27). Patří do cac:AccountingSupplierParty/cac:Party/cac:PartyLegalEntity/cbc:RegistrationName.',
      'Der Name des Verkäufers (BT-27) fehlt. Er gehört in cac:AccountingSupplierParty/cac:Party/cac:PartyLegalEntity/cbc:RegistrationName.',
      'The seller name (BT-27) is missing. It belongs in cac:AccountingSupplierParty/cac:Party/cac:PartyLegalEntity/cbc:RegistrationName.',
      kdeKoren);
  }
  if (hod(d, 'cac:AccountingCustomerParty/cac:Party/cac:PartyLegalEntity/cbc:RegistrationName') === '') {
    P('BR-07', jeden(d, 'cac:AccountingCustomerParty/cac:Party') || d, '',
      'Chýba obchodné meno odberateľa (BT-44). Patrí do cac:AccountingCustomerParty/cac:Party/cac:PartyLegalEntity/cbc:RegistrationName.',
      'Chybí obchodní jméno odběratele (BT-44). Patří do cac:AccountingCustomerParty/cac:Party/cac:PartyLegalEntity/cbc:RegistrationName.',
      'Der Name des Käufers (BT-44) fehlt. Er gehört in cac:AccountingCustomerParty/cac:Party/cac:PartyLegalEntity/cbc:RegistrationName.',
      'The buyer name (BT-44) is missing. It belongs in cac:AccountingCustomerParty/cac:Party/cac:PartyLegalEntity/cbc:RegistrationName.',
      kdeKoren);
  }
  if (!jeden(d, 'cac:AccountingSupplierParty/cac:Party/cac:PostalAddress')) {
    P('BR-08', jeden(d, 'cac:AccountingSupplierParty/cac:Party') || d, '',
      'Chýba poštová adresa dodávateľa (BG-5, prvok cac:PostalAddress).',
      'Chybí poštovní adresa dodavatele (BG-5, prvek cac:PostalAddress).',
      'Die Postanschrift des Verkäufers (BG-5, Element cac:PostalAddress) fehlt.',
      'The seller postal address (BG-5, element cac:PostalAddress) is missing.',
      kdeKoren);
  }
  if (!jeden(d, 'cac:AccountingCustomerParty/cac:Party/cac:PostalAddress')) {
    P('BR-10', jeden(d, 'cac:AccountingCustomerParty/cac:Party') || d, '',
      'Chýba poštová adresa odberateľa (BG-8, prvok cac:PostalAddress).',
      'Chybí poštovní adresa odběratele (BG-8, prvek cac:PostalAddress).',
      'Die Postanschrift des Käufers (BG-8, Element cac:PostalAddress) fehlt.',
      'The buyer postal address (BG-8, element cac:PostalAddress) is missing.',
      kdeKoren);
  }
  if (!ctx.riadky.length) {
    P('BR-16', d, '',
      'Faktúra nemá ani jeden riadok (BG-25). Doplňte aspoň jeden prvok cac:InvoiceLine, v dobropise cac:CreditNoteLine.',
      'Faktura nemá ani jeden řádek (BG-25). Doplňte alespoň jeden prvek cac:InvoiceLine, v dobropisu cac:CreditNoteLine.',
      'Die Rechnung hat keine einzige Position (BG-25). Ergänzen Sie mindestens ein cac:InvoiceLine, in der Gutschrift cac:CreditNoteLine.',
      'The invoice has no lines at all (BG-25). Add at least one cac:InvoiceLine, or cac:CreditNoteLine in a credit note.',
      kdeKoren);
  }

  // adresy a kody krajin
  const adrD = jeden(d, 'cac:AccountingSupplierParty/cac:Party/cac:PostalAddress');
  if (adrD && hod(adrD, 'cac:Country/cbc:IdentificationCode') === '') {
    P('BR-09', adrD, '',
      'V adrese dodávateľa chýba kód krajiny (BT-40) v cac:Country/cbc:IdentificationCode, napríklad SK.',
      'V adrese dodavatele chybí kód země (BT-40) v cac:Country/cbc:IdentificationCode, například CZ.',
      'In der Anschrift des Verkäufers fehlt der Ländercode (BT-40) in cac:Country/cbc:IdentificationCode, zum Beispiel DE.',
      'The seller address is missing the country code (BT-40) in cac:Country/cbc:IdentificationCode, for example IE. Use the two letter ISO 3166-1 code.');
  }
  const adrO = jeden(d, 'cac:AccountingCustomerParty/cac:Party/cac:PostalAddress');
  if (adrO && hod(adrO, 'cac:Country/cbc:IdentificationCode') === '') {
    P('BR-11', adrO, '',
      'V adrese odberateľa chýba kód krajiny (BT-55) v cac:Country/cbc:IdentificationCode.',
      'V adrese odběratele chybí kód země (BT-55) v cac:Country/cbc:IdentificationCode.',
      'In der Anschrift des Käufers fehlt der Ländercode (BT-55) in cac:Country/cbc:IdentificationCode.',
      'The buyer address is missing the country code (BT-55) in cac:Country/cbc:IdentificationCode.');
  }
  for (const adr of cesta(d, 'cac:Delivery/cac:DeliveryLocation/cac:Address')) {
    if (!jeden(adr, 'cac:Country/cbc:IdentificationCode')) {
      P('BR-57', adr, '',
        'V adrese miesta dodania (BG-15) chýba kód krajiny (BT-80) v cac:Country/cbc:IdentificationCode.',
        'V adrese místa dodání (BG-15) chybí kód země (BT-80) v cac:Country/cbc:IdentificationCode.',
        'In der Lieferanschrift (BG-15) fehlt der Ländercode (BT-80) in cac:Country/cbc:IdentificationCode.',
        'The deliver to address (BG-15) is missing the country code (BT-80) in cac:Country/cbc:IdentificationCode.');
    }
  }

  // elektronicke adresy
  const epD = jeden(d, 'cac:AccountingSupplierParty/cac:Party/cbc:EndpointID');
  if (epD && atr(epD, 'schemeID') === undefined) {
    P('BR-62', epD, txt(epD),
      'Elektronická adresa dodávateľa (BT-34) musí mať atribút schemeID, napríklad schemeID="0245" pre slovenské DIČ.',
      'Elektronická adresa dodavatele (BT-34) musí mít atribut schemeID, například schemeID="0245" pro slovenské DIČ nebo schemeID="9930" pro německé USt-IdNr. Kód pro jinou zemi najdete v seznamu CEF EAS.',
      'Die elektronische Adresse des Verkäufers (BT-34) braucht das Attribut schemeID, zum Beispiel schemeID="9930" für die USt-IdNr.',
      'The seller electronic address (BT-34) needs a schemeID attribute, for example schemeID="0088" for a GS1 GLN. Pick the code for your identifier from the CEF EAS code list.');
  }
  const epO = jeden(d, 'cac:AccountingCustomerParty/cac:Party/cbc:EndpointID');
  if (epO && atr(epO, 'schemeID') === undefined) {
    P('BR-63', epO, txt(epO),
      'Elektronická adresa odberateľa (BT-49) musí mať atribút schemeID.',
      'Elektronická adresa odběratele (BT-49) musí mít atribut schemeID.',
      'Die elektronische Adresse des Käufers (BT-49) braucht das Attribut schemeID.',
      'The buyer electronic address (BT-49) needs a schemeID attribute from the CEF EAS code list.');
  }

  // prijemca platby (BG-10)
  for (const pp of deti(d, 'cac:PayeeParty')) {
    const meno = hod(pp, 'cac:PartyName/cbc:Name');
    const menoDod = hod(d, 'cac:AccountingSupplierParty/cac:Party/cac:PartyName/cbc:Name');
    const idPp = hod(pp, 'cac:PartyIdentification/cbc:ID');
    const idDod = hod(d, 'cac:AccountingSupplierParty/cac:Party/cac:PartyIdentification/cbc:ID');
    if (meno === '' || (meno !== '' && meno === menoDod) || (idPp !== '' && idPp === idDod)) {
      P('BR-17', pp, meno,
        'Príjemca platby (BG-10) musí mať vlastné meno v cac:PartyName/cbc:Name a musí sa líšiť od dodávateľa. Ak je príjemcom platby dodávateľ, prvok cac:PayeeParty vynechajte.',
        'Příjemce platby (BG-10) musí mít vlastní jméno v cac:PartyName/cbc:Name a musí se lišit od dodavatele. Pokud je příjemcem platby dodavatel, prvek cac:PayeeParty vynechejte.',
        'Der Zahlungsempfänger (BG-10) braucht einen eigenen Namen in cac:PartyName/cbc:Name und muss sich vom Verkäufer unterscheiden. Ist der Verkäufer der Zahlungsempfänger, lassen Sie cac:PayeeParty weg.',
        'The payee (BG-10) needs its own name in cac:PartyName/cbc:Name and it has to differ from the seller. If the seller is the payee, leave cac:PayeeParty out.');
    }
  }

  // danovy zastupca (BG-11)
  for (const tz of deti(d, 'cac:TaxRepresentativeParty')) {
    if (hod(tz, 'cac:PartyName/cbc:Name') === '') {
      P('BR-18', tz, '',
        'Daňový zástupca dodávateľa (BG-11) musí mať meno (BT-62) v cac:PartyName/cbc:Name.',
        'Daňový zástupce dodavatele (BG-11) musí mít jméno (BT-62) v cac:PartyName/cbc:Name.',
        'Der Steuervertreter des Verkäufers (BG-11) braucht einen Namen (BT-62) in cac:PartyName/cbc:Name.',
        'The seller tax representative (BG-11) needs a name (BT-62) in cac:PartyName/cbc:Name.');
    }
    if (!prve(tz, 'cac:PostalAddress')) {
      P('BR-19', tz, '',
        'Daňový zástupca dodávateľa (BG-11) musí mať poštovú adresu (BG-12, cac:PostalAddress).',
        'Daňový zástupce dodavatele (BG-11) musí mít poštovní adresu (BG-12, cac:PostalAddress).',
        'Der Steuervertreter (BG-11) braucht eine Postanschrift (BG-12, cac:PostalAddress).',
        'The seller tax representative (BG-11) needs a postal address (BG-12, cac:PostalAddress).');
    } else if (hod(prve(tz, 'cac:PostalAddress'), 'cac:Country/cbc:IdentificationCode') === '') {
      P('BR-20', prve(tz, 'cac:PostalAddress'), '',
        'V adrese daňového zástupcu chýba kód krajiny (BT-69).',
        'V adrese daňového zástupce chybí kód země (BT-69).',
        'In der Anschrift des Steuervertreters fehlt der Ländercode (BT-69).',
        'The tax representative address is missing the country code (BT-69).');
    }
    if (!katVat(tz, 'cac:PartyTaxScheme') && !cesta(tz, 'cac:PartyTaxScheme/cbc:CompanyID').length) {
      P('BR-56', tz, '',
        'Daňový zástupca (BG-11) musí mať IČ DPH (BT-63) v cac:PartyTaxScheme/cbc:CompanyID so schémou VAT.',
        'Daňový zástupce (BG-11) musí mít DIČ (BT-63) v cac:PartyTaxScheme/cbc:CompanyID se schématem VAT.',
        'Der Steuervertreter (BG-11) braucht eine USt-IdNr. (BT-63) in cac:PartyTaxScheme/cbc:CompanyID mit dem Schema VAT.',
        'The seller tax representative (BG-11) needs a VAT identifier (BT-63) in cac:PartyTaxScheme/cbc:CompanyID with the VAT tax scheme.');
    }
  }

  // predchadzajuca faktura (BG-3)
  for (const br of deti(d, 'cac:BillingReference')) {
    if (!jeden(br, 'cac:InvoiceDocumentReference/cbc:ID')) {
      P('BR-55', br, '',
        'Odkaz na predchádzajúcu faktúru (BG-3) musí obsahovať jej číslo (BT-25) v cac:InvoiceDocumentReference/cbc:ID.',
        'Odkaz na předchozí fakturu (BG-3) musí obsahovat její číslo (BT-25) v cac:InvoiceDocumentReference/cbc:ID.',
        'Der Verweis auf die vorausgegangene Rechnung (BG-3) braucht deren Nummer (BT-25) in cac:InvoiceDocumentReference/cbc:ID.',
        'A reference to a preceding invoice (BG-3) needs that invoice number (BT-25) in cac:InvoiceDocumentReference/cbc:ID.');
    }
  }

  // prilohy (BG-24)
  for (const adr of deti(d, 'cac:AdditionalDocumentReference')) {
    if (hod(adr, 'cbc:ID') === '') {
      P('BR-52', adr, '',
        'Každá príloha (BG-24) musí mať označenie (BT-122) v cbc:ID.',
        'Každá příloha (BG-24) musí mít označení (BT-122) v cbc:ID.',
        'Jede Anlage (BG-24) braucht eine Kennung (BT-122) in cbc:ID.',
        'Every supporting document (BG-24) needs a reference (BT-122) in cbc:ID.');
    }
  }

  // mena uctovania DPH (BT-6 a BT-111)
  if (ctx.menaDane !== '') {
    const maSumu = ctx.danCelkom.some((t) =>
      deti(t, 'cbc:TaxAmount').some((s) => atr(s, 'currencyID') === ctx.menaDane));
    if (!maSumu) {
      P('BR-53', d, ctx.menaDane,
        'Ak je uvedená mena účtovania DPH (BT-6, cbc:TaxCurrencyCode = ' + ctx.menaDane + '), musí byť uvedená aj suma DPH v tejto mene (BT-111): cac:TaxTotal/cbc:TaxAmount s currencyID="' + ctx.menaDane + '".',
        'Pokud je uvedena měna účtování DPH (BT-6, cbc:TaxCurrencyCode = ' + ctx.menaDane + '), musí být uvedena i částka DPH v této měně (BT-111): cac:TaxTotal/cbc:TaxAmount s currencyID="' + ctx.menaDane + '".',
        'Wenn der Steuerwährungscode (BT-6, cbc:TaxCurrencyCode = ' + ctx.menaDane + ') angegeben ist, muss auch der Steuerbetrag in dieser Währung (BT-111) angegeben werden: cac:TaxTotal/cbc:TaxAmount mit currencyID="' + ctx.menaDane + '".',
        'If the VAT accounting currency code is present (BT-6, cbc:TaxCurrencyCode = ' + ctx.menaDane + '), the invoice total VAT amount in that currency (BT-111) has to be given as well: cac:TaxTotal/cbc:TaxAmount with currencyID="' + ctx.menaDane + '".',
        kdeKoren);
    }
  }

  // vlastnosti polozky (BG-32)
  for (const vl of vsetky(d, 'cac:AdditionalItemProperty')) {
    if (!prve(vl, 'cbc:Name') || !prve(vl, 'cbc:Value')) {
      P('BR-54', vl, hod(vl, 'cbc:Name'),
        'Vlastnosť položky (BG-32) musí mať aj názov (BT-160, cbc:Name) aj hodnotu (BT-161, cbc:Value).',
        'Vlastnost položky (BG-32) musí mít název (BT-160, cbc:Name) i hodnotu (BT-161, cbc:Value).',
        'Ein Artikelattribut (BG-32) braucht sowohl den Namen (BT-160, cbc:Name) als auch den Wert (BT-161, cbc:Value).',
        'An item attribute (BG-32) needs both a name (BT-160, cbc:Name) and a value (BT-161, cbc:Value).');
    }
  }
  for (const n of vsetky(d, 'cac:StandardItemIdentification')) {
    const id = prve(n, 'cbc:ID');
    if (id && atr(id, 'schemeID') === undefined) {
      P('BR-64', id, txt(id),
        'Štandardný identifikátor položky (BT-157) musí mať atribút schemeID, napríklad schemeID="0160" pre GTIN.',
        'Standardní identifikátor položky (BT-157) musí mít atribut schemeID, například schemeID="0160" pro GTIN.',
        'Die Standardartikelnummer (BT-157) braucht das Attribut schemeID, zum Beispiel schemeID="0160" für GTIN.',
        'The item standard identifier (BT-157) needs a schemeID attribute, for example schemeID="0160" for a GTIN.');
    }
  }
  for (const n of vsetky(d, 'cac:CommodityClassification')) {
    const kod = prve(n, 'cbc:ItemClassificationCode');
    if (kod && atr(kod, 'listID') === undefined) {
      P('BR-65', kod, txt(kod),
        'Klasifikácia položky (BT-158) musí mať atribút listID, napríklad listID="STI" alebo "TSP".',
        'Klasifikace položky (BT-158) musí mít atribut listID, například listID="STI" nebo "TSP".',
        'Die Artikelklassifizierung (BT-158) braucht das Attribut listID, zum Beispiel listID="STI".',
        'The item classification identifier (BT-158) needs a listID attribute, for example listID="STI" or "TSP".');
    }
  }
}

// ---------------------------------------------------------------- riadky faktury

function riadky(ctx) {
  const P = (kod, uzol, hodnota, sk, cs, de, en) => pridaj(ctx, kod, CH, uzol, hodnota, sk, cs, de, en);
  ctx.riadky.forEach((r, i) => {
    const c = 'Riadok ' + (i + 1);
    const cCs = 'Řádek ' + (i + 1);
    const cDe = 'Position ' + (i + 1);
    const cEn = 'Line ' + (i + 1);
    if (hod(r, 'cbc:ID') === '') {
      P('BR-21', r, '',
        c + ' nemá označenie (BT-126). Doplňte cbc:ID, napríklad 1.',
        cCs + ' nemá označení (BT-126). Doplňte cbc:ID, například 1.',
        cDe + ' hat keine Kennung (BT-126). Ergänzen Sie cbc:ID, zum Beispiel 1.',
        cEn + ' has no identifier (BT-126). Add cbc:ID, for example 1.');
    }
    const mn = prve(r, 'cbc:InvoicedQuantity') || prve(r, 'cbc:CreditedQuantity');
    if (!mn) {
      P('BR-22', r, '',
        c + ' nemá množstvo (BT-129). Doplňte cbc:InvoicedQuantity, v dobropise cbc:CreditedQuantity.',
        cCs + ' nemá množství (BT-129). Doplňte cbc:InvoicedQuantity, v dobropisu cbc:CreditedQuantity.',
        cDe + ' hat keine Menge (BT-129). Ergänzen Sie cbc:InvoicedQuantity, in der Gutschrift cbc:CreditedQuantity.',
        cEn + ' has no quantity (BT-129). Add cbc:InvoicedQuantity, or cbc:CreditedQuantity in a credit note.');
    } else if (atr(mn, 'unitCode') === undefined) {
      P('BR-23', mn, txt(mn),
        c + ': množstvo musí mať kód jednotky (BT-130), atribút unitCode, napríklad unitCode="C62" pre kus.',
        cCs + ': množství musí mít kód jednotky (BT-130), atribut unitCode, například unitCode="C62" pro kus.',
        cDe + ': Die Menge braucht einen Einheitencode (BT-130), Attribut unitCode, zum Beispiel unitCode="C62" für Stück.',
        cEn + ': the quantity needs a unit of measure code (BT-130) in the unitCode attribute, for example unitCode="C62" for one piece.');
    }
    if (!prve(r, 'cbc:LineExtensionAmount')) {
      P('BR-24', r, '',
        c + ' nemá sumu bez DPH (BT-131). Doplňte cbc:LineExtensionAmount.',
        cCs + ' nemá částku bez DPH (BT-131). Doplňte cbc:LineExtensionAmount.',
        cDe + ' hat keinen Nettobetrag (BT-131). Ergänzen Sie cbc:LineExtensionAmount.',
        cEn + ' has no net amount (BT-131). Add cbc:LineExtensionAmount.');
    }
    if (hod(r, 'cac:Item/cbc:Name') === '') {
      P('BR-25', r, '',
        c + ' nemá názov položky (BT-153) v cac:Item/cbc:Name.',
        cCs + ' nemá název položky (BT-153) v cac:Item/cbc:Name.',
        cDe + ' hat keine Artikelbezeichnung (BT-153) in cac:Item/cbc:Name.',
        cEn + ' has no item name (BT-153) in cac:Item/cbc:Name.');
    }
    const cena = jeden(r, 'cac:Price/cbc:PriceAmount');
    if (!cena) {
      P('BR-26', r, '',
        c + ' nemá jednotkovú cenu bez DPH (BT-146) v cac:Price/cbc:PriceAmount.',
        cCs + ' nemá jednotkovou cenu bez DPH (BT-146) v cac:Price/cbc:PriceAmount.',
        cDe + ' hat keinen Nettopreis (BT-146) in cac:Price/cbc:PriceAmount.',
        cEn + ' has no item net price (BT-146) in cac:Price/cbc:PriceAmount.');
    } else if (cis(txt(cena)) < 0) {
      P('BR-27', cena, txt(cena),
        c + ': jednotková cena bez DPH (BT-146) nesmie byť záporná. Záporná suma patrí do dobropisu.',
        cCs + ': jednotková cena bez DPH (BT-146) nesmí být záporná. Záporná částka patří do dobropisu.',
        cDe + ': Der Nettopreis (BT-146) darf nicht negativ sein. Negative Beträge gehören in eine Gutschrift.',
        cEn + ': the item net price (BT-146) must not be negative. A negative amount belongs in a credit note.');
    }
    for (const zaklad of cesta(r, 'cac:Price/cac:AllowanceCharge/cbc:BaseAmount')) {
      if (cis(txt(zaklad)) < 0) {
        P('BR-28', zaklad, txt(zaklad),
          c + ': hrubá cena položky (BT-148) nesmie byť záporná.',
          cCs + ': hrubá cena položky (BT-148) nesmí být záporná.',
          cDe + ': Der Bruttopreis (BT-148) darf nicht negativ sein.',
          cEn + ': the item gross price (BT-148) must not be negative.');
      }
    }
    // BR-CO-04 kategoria DPH riadku
    const kat = katVat(jeden(r, 'cac:Item'), 'cac:ClassifiedTaxCategory');
    if (!kat || hod(kat, 'cbc:ID') === '') {
      P('BR-CO-04', r, '',
        c + ' nemá kategóriu DPH (BT-151). Doplňte cac:Item/cac:ClassifiedTaxCategory/cbc:ID, napríklad S, a cac:TaxScheme/cbc:ID s hodnotou VAT.',
        cCs + ' nemá kategorii DPH (BT-151). Doplňte cac:Item/cac:ClassifiedTaxCategory/cbc:ID, například S, a cac:TaxScheme/cbc:ID s hodnotou VAT.',
        cDe + ' hat keine Umsatzsteuerkategorie (BT-151). Ergänzen Sie cac:Item/cac:ClassifiedTaxCategory/cbc:ID, zum Beispiel S, und cac:TaxScheme/cbc:ID mit VAT.',
        cEn + ' has no VAT category code (BT-151). Add cac:Item/cac:ClassifiedTaxCategory/cbc:ID, for example S, together with cac:TaxScheme/cbc:ID set to VAT.');
    }
  });
}

// ---------------------------------------------------------------- zlavy a priplatky

function zlavyPriplatky(ctx) {
  const P = (kod, uzol, hodnota, sk, cs, de, en) => pridaj(ctx, kod, CH, uzol, hodnota, sk, cs, de, en);
  const skupiny = [
    { pole: ctx.zlavyDok, sumaKod: 'BR-31', katKod: 'BR-32', dovodKod: 'BR-33', coKod: 'BR-CO-21', zlava: true, uroven: 'dokladu' },
    { pole: ctx.priplatkyDok, sumaKod: 'BR-36', katKod: 'BR-37', dovodKod: 'BR-38', coKod: 'BR-CO-22', zlava: false, uroven: 'dokladu' },
    { pole: ctx.zlavyRiadkov, sumaKod: 'BR-41', katKod: null, dovodKod: 'BR-42', coKod: 'BR-CO-23', zlava: true, uroven: 'riadku' },
    { pole: ctx.priplatkyRiadkov, sumaKod: 'BR-43', katKod: null, dovodKod: 'BR-44', coKod: 'BR-CO-24', zlava: false, uroven: 'riadku' }
  ];
  for (const s of skupiny) {
    for (const ac of s.pole) {
      const slovoSk = s.zlava ? 'Zľava' : 'Príplatok';
      const slovoCs = s.zlava ? 'Sleva' : 'Příplatek';
      const slovoDe = s.zlava ? 'Der Abschlag' : 'Der Zuschlag';
      const slovoEn = s.zlava ? 'The allowance' : 'The charge';
      const kdeSk = s.uroven === 'dokladu' ? 'na úrovni dokladu' : 'na úrovni riadku';
      const kdeCs = s.uroven === 'dokladu' ? 'na úrovni dokladu' : 'na úrovni řádku';
      const kdeDe = s.uroven === 'dokladu' ? 'auf Dokumentebene' : 'auf Positionsebene';
      const kdeEn = s.uroven === 'dokladu' ? 'on document level' : 'on line level';
      if (!prve(ac, 'cbc:Amount')) {
        P(s.sumaKod, ac, '',
          slovoSk + ' ' + kdeSk + ' nemá sumu. Doplňte cbc:Amount.',
          slovoCs + ' ' + kdeCs + ' nemá částku. Doplňte cbc:Amount.',
          slovoDe + ' ' + kdeDe + ' hat keinen Betrag. Ergänzen Sie cbc:Amount.',
          slovoEn + ' ' + kdeEn + ' has no amount. Add cbc:Amount.');
      }
      if (s.katKod) {
        const kat = katVat(ac, 'cac:TaxCategory');
        if (!kat || hod(kat, 'cbc:ID') === '') {
          P(s.katKod, ac, '',
            slovoSk + ' ' + kdeSk + ' nemá kategóriu DPH. Doplňte cac:TaxCategory/cbc:ID a cac:TaxScheme/cbc:ID s hodnotou VAT.',
            slovoCs + ' ' + kdeCs + ' nemá kategorii DPH. Doplňte cac:TaxCategory/cbc:ID a cac:TaxScheme/cbc:ID s hodnotou VAT.',
            slovoDe + ' ' + kdeDe + ' hat keine Umsatzsteuerkategorie. Ergänzen Sie cac:TaxCategory/cbc:ID und cac:TaxScheme/cbc:ID mit VAT.',
            slovoEn + ' ' + kdeEn + ' has no VAT category code. Add cac:TaxCategory/cbc:ID together with cac:TaxScheme/cbc:ID set to VAT.');
        }
      }
      const maDovod = prve(ac, 'cbc:AllowanceChargeReason') || prve(ac, 'cbc:AllowanceChargeReasonCode');
      if (!maDovod) {
        const sk = slovoSk + ' ' + kdeSk + ' musí mať dôvod. Doplňte cbc:AllowanceChargeReason (text) alebo cbc:AllowanceChargeReasonCode (kód).';
        const cs = slovoCs + ' ' + kdeCs + ' musí mít důvod. Doplňte cbc:AllowanceChargeReason (text) nebo cbc:AllowanceChargeReasonCode (kód).';
        const de = slovoDe + ' ' + kdeDe + ' braucht einen Grund. Ergänzen Sie cbc:AllowanceChargeReason (Text) oder cbc:AllowanceChargeReasonCode (Code).';
        const en = slovoEn + ' ' + kdeEn + ' needs a reason. Add cbc:AllowanceChargeReason (text) or cbc:AllowanceChargeReasonCode (code).';
        P(s.dovodKod, ac, '', sk, cs, de, en);
        P(s.coKod, ac, '', sk, cs, de, en);
      }
    }
  }
}

// ---------------------------------------------------------------- obdobia a datumy

function obdobia(ctx) {
  const P = (kod, uzol, hodnota, sk, cs, de, en) => pridaj(ctx, kod, CH, uzol, hodnota, sk, cs, de, en);
  const skontrolujObdobie = (ob, kodPoradie, kodPritomnost, riadkove) => {
    const zac = hod(ob, 'cbc:StartDate');
    const kon = hod(ob, 'cbc:EndDate');
    if (zac !== '' && kon !== '' && kon < zac) {
      P(kodPoradie, ob, zac + ' .. ' + kon,
        'Koniec obdobia (' + kon + ') je skôr ako začiatok (' + zac + '). Opravte cbc:StartDate alebo cbc:EndDate.',
        'Konec období (' + kon + ') je dřív než začátek (' + zac + '). Opravte cbc:StartDate nebo cbc:EndDate.',
        'Das Ende des Zeitraums (' + kon + ') liegt vor dem Beginn (' + zac + '). Korrigieren Sie cbc:StartDate oder cbc:EndDate.',
        'The end of the period (' + kon + ') is earlier than its start (' + zac + '). Correct cbc:StartDate or cbc:EndDate.');
    }
    const maPopis = hod(ob, 'cbc:DescriptionCode') !== '';
    if (zac === '' && kon === '' && !(riadkove ? false : maPopis)) {
      P(kodPritomnost, ob, '',
        'Fakturačné obdobie je uvedené, ale je prázdne. Doplňte cbc:StartDate alebo cbc:EndDate.',
        'Fakturační období je uvedeno, ale je prázdné. Doplňte cbc:StartDate nebo cbc:EndDate.',
        'Der Abrechnungszeitraum ist angegeben, aber leer. Ergänzen Sie cbc:StartDate oder cbc:EndDate.',
        'The invoicing period is present but empty. Add cbc:StartDate or cbc:EndDate.');
    }
  };
  for (const ob of deti(ctx.koren, 'cac:InvoicePeriod')) skontrolujObdobie(ob, 'BR-29', 'BR-CO-19', false);
  for (const r of ctx.riadky) {
    for (const ob of deti(r, 'cac:InvoicePeriod')) skontrolujObdobie(ob, 'BR-30', 'BR-CO-20', true);
  }
  // BR-CO-03: BT-7 a BT-8 sa vylucuju
  const bt7 = prve(ctx.koren, 'cbc:TaxPointDate');
  const bt8 = jeden(ctx.koren, 'cac:InvoicePeriod/cbc:DescriptionCode');
  if (bt7 && bt8) {
    P('BR-CO-03', bt7, txt(bt7),
      'Dátum vzniku daňovej povinnosti (BT-7, cbc:TaxPointDate) a jeho kód (BT-8, cac:InvoicePeriod/cbc:DescriptionCode) sa nesmú použiť naraz. Nechajte len jeden.',
      'Datum uskutečnění zdanitelného plnění (BT-7, cbc:TaxPointDate) a jeho kód (BT-8, cac:InvoicePeriod/cbc:DescriptionCode) nelze použít současně. Nechte jen jeden.',
      'Der Steuerstichtag (BT-7, cbc:TaxPointDate) und sein Code (BT-8, cac:InvoicePeriod/cbc:DescriptionCode) dürfen nicht gleichzeitig verwendet werden. Lassen Sie nur eines stehen.',
      'The value added tax point date (BT-7, cbc:TaxPointDate) and its code (BT-8, cac:InvoicePeriod/cbc:DescriptionCode) are mutually exclusive. Keep only one of them.');
  }
}

// ---------------------------------------------------------------- platobne udaje

function platby(ctx) {
  const P = (kod, uzol, hodnota, sk, cs, de, en) => pridaj(ctx, kod, CH, uzol, hodnota, sk, cs, de, en);
  for (const pm of ctx.platby) {
    const kod = hod(pm, 'cbc:PaymentMeansCode');
    if (!prve(pm, 'cbc:PaymentMeansCode')) {
      P('BR-49', pm, '',
        'Platobné údaje (BG-16) musia mať kód spôsobu platby (BT-81) v cbc:PaymentMeansCode, napríklad 58 pre SEPA prevod.',
        'Platební údaje (BG-16) musí mít kód způsobu platby (BT-81) v cbc:PaymentMeansCode, například 58 pro SEPA převod.',
        'Die Zahlungsanweisung (BG-16) braucht den Zahlungsmittelcode (BT-81) in cbc:PaymentMeansCode, zum Beispiel 58 für SEPA-Überweisung.',
        'Payment instructions (BG-16) need a payment means code (BT-81) in cbc:PaymentMeansCode, for example 58 for a SEPA credit transfer or 30 for a credit transfer.');
    }
    if (kod === '30' || kod === '58') {
      const ucet = jeden(pm, 'cac:PayeeFinancialAccount/cbc:ID');
      if (!ucet) {
        P('BR-61', pm, kod,
          'Pri spôsobe platby ' + kod + ' (prevod) musí byť uvedené číslo účtu (BT-84) v cac:PayeeFinancialAccount/cbc:ID.',
          'Při způsobu platby ' + kod + ' (převod) musí být uvedeno číslo účtu (BT-84) v cac:PayeeFinancialAccount/cbc:ID.',
          'Bei Zahlungsart ' + kod + ' (Überweisung) muss die Kontokennung (BT-84) in cac:PayeeFinancialAccount/cbc:ID stehen.',
          'With payment means ' + kod + ' (credit transfer) the payment account identifier (BT-84) has to be given in cac:PayeeFinancialAccount/cbc:ID.');
      } else if (txt(ucet) === '') {
        P('BR-50', ucet, '',
          'Číslo účtu (BT-84) je prázdne. Doplňte IBAN do cac:PayeeFinancialAccount/cbc:ID.',
          'Číslo účtu (BT-84) je prázdné. Doplňte IBAN do cac:PayeeFinancialAccount/cbc:ID.',
          'Die Kontokennung (BT-84) ist leer. Ergänzen Sie die IBAN in cac:PayeeFinancialAccount/cbc:ID.',
          'The payment account identifier (BT-84) is empty. Add the IBAN to cac:PayeeFinancialAccount/cbc:ID.');
      }
    }
    const karta = jeden(pm, 'cac:CardAccount/cbc:PrimaryAccountNumberID');
    if (karta && txt(karta).length > 10) {
      pridaj(ctx, 'BR-51', VAR, karta, txt(karta),
        'Číslo platobnej karty (BT-87) má viac ako 10 znakov. Do faktúry patrí len začiatok a koniec čísla, napríklad 411111******1111.',
        'Číslo platební karty (BT-87) má více než 10 znaků. Do faktury patří jen začátek a konec čísla, například 411111******1111.',
        'Die Kartennummer (BT-87) hat mehr als 10 Zeichen. In die Rechnung gehören nur Anfang und Ende der Nummer, zum Beispiel 411111******1111.',
        'The payment card number (BT-87) is longer than 10 characters. An invoice should carry only the first six and last four digits, for example 411111******1111.');
    }
  }
}

// ---------------------------------------------------------------- sucty (BR-CO-10 az BR-CO-18)

function sucty(ctx) {
  const P = (kod, uzol, hodnota, sk, cs, de, en, c) => pridaj(ctx, kod, CH, uzol, hodnota, sk, cs, de, en, c);
  const S = ctx.sucty;
  const kdeKoren = xpath(ctx.koren);
  if (!S) {
    for (const kod of ['BR-12', 'BR-13', 'BR-14', 'BR-15']) {
      P(kod, ctx.koren, '',
        'Chýba skupina súčtov (cac:LegalMonetaryTotal). Bez nej sa nedajú skontrolovať súčty faktúry.',
        'Chybí skupina součtu (cac:LegalMonetaryTotal). Bez ní nelze zkontrolovat součty faktury.',
        'Die Summengruppe (cac:LegalMonetaryTotal) fehlt. Ohne sie lassen sich die Rechnungssummen nicht prüfen.',
        'The document totals group (cac:LegalMonetaryTotal) is missing. Without it the invoice totals cannot be checked.',
        kdeKoren);
    }
    return;
  }
  const povinne = [
    ['BR-12', 'cbc:LineExtensionAmount', 'BT-106', 'súčet suma riadkov bez DPH', 'součet částek řádku bez DPH', 'Summe der Nettobeträge der Positionen', 'the sum of invoice line net amounts'],
    ['BR-13', 'cbc:TaxExclusiveAmount', 'BT-109', 'základ dane spolu', 'základ daně celkem', 'Gesamtbetrag ohne Umsatzsteuer', 'the invoice total amount without VAT'],
    ['BR-14', 'cbc:TaxInclusiveAmount', 'BT-112', 'suma s DPH', 'částka s DPH', 'Gesamtbetrag mit Umsatzsteuer', 'the invoice total amount with VAT'],
    ['BR-15', 'cbc:PayableAmount', 'BT-115', 'suma na úhradu', 'částka k úhradě', 'Fälliger Betrag', 'the amount due for payment']
  ];
  for (const [kod, prvok, bt, sk, cs, de, en] of povinne) {
    if (!prve(S, prvok)) {
      P(kod, S, '',
        'Chýba ' + sk + ' (' + bt + '). Doplňte prvok ' + prvok + ' do cac:LegalMonetaryTotal.',
        'Chybí ' + cs + ' (' + bt + '). Doplňte prvek ' + prvok + ' do cac:LegalMonetaryTotal.',
        'Es fehlt: ' + de + ' (' + bt + '). Ergänzen Sie ' + prvok + ' in cac:LegalMonetaryTotal.',
        'Missing: ' + en + ' (' + bt + '). Add the element ' + prvok + ' to cac:LegalMonetaryTotal.');
    }
  }

  const suma = (pole, prvok) => pole.reduce((a, n) => {
    const v = cis(hod(n, prvok));
    return a + (Number.isFinite(v) ? v : 0);
  }, 0);

  const bt106 = cis(hod(S, 'cbc:LineExtensionAmount'));
  const bt107 = prve(S, 'cbc:AllowanceTotalAmount') ? cis(hod(S, 'cbc:AllowanceTotalAmount')) : null;
  const bt108 = prve(S, 'cbc:ChargeTotalAmount') ? cis(hod(S, 'cbc:ChargeTotalAmount')) : null;
  const bt109 = cis(hod(S, 'cbc:TaxExclusiveAmount'));
  const bt112 = cis(hod(S, 'cbc:TaxInclusiveAmount'));
  const bt113 = prve(S, 'cbc:PrepaidAmount') ? cis(hod(S, 'cbc:PrepaidAmount')) : null;
  const bt114 = prve(S, 'cbc:PayableRoundingAmount') ? cis(hod(S, 'cbc:PayableRoundingAmount')) : null;
  const bt115 = cis(hod(S, 'cbc:PayableAmount'));

  // BR-CO-10
  const sucetRiadkov = r2(suma(ctx.riadky, 'cbc:LineExtensionAmount'));
  if (Number.isFinite(bt106) && r2(bt106) !== sucetRiadkov) {
    P('BR-CO-10', prve(S, 'cbc:LineExtensionAmount'), hod(S, 'cbc:LineExtensionAmount'),
      'Súčet riadkov nesedí: cbc:LineExtensionAmount (BT-106) je ' + hod(S, 'cbc:LineExtensionAmount') + ', súčet suma riadkov je ' + sucetRiadkov.toFixed(2) + '. Opravte súčet alebo sumy riadkov.',
      'Součet řádku nesedí: cbc:LineExtensionAmount (BT-106) je ' + hod(S, 'cbc:LineExtensionAmount') + ', součet částek řádku je ' + sucetRiadkov.toFixed(2) + '. Opravte součet nebo částky řádku.',
      'Die Positionssumme stimmt nicht: cbc:LineExtensionAmount (BT-106) ist ' + hod(S, 'cbc:LineExtensionAmount') + ', die Summe der Positionen beträgt ' + sucetRiadkov.toFixed(2) + '.',
      'The line total does not add up: cbc:LineExtensionAmount (BT-106) is ' + hod(S, 'cbc:LineExtensionAmount') + ', the sum of the line net amounts is ' + sucetRiadkov.toFixed(2) + '. Correct the total or the line amounts.');
  }
  // BR-CO-11
  const sucetZliav = r2(suma(ctx.zlavyDok, 'cbc:Amount'));
  if (bt107 !== null && r2(bt107) !== sucetZliav) {
    P('BR-CO-11', prve(S, 'cbc:AllowanceTotalAmount'), hod(S, 'cbc:AllowanceTotalAmount'),
      'Súčet zliav nesedí: cbc:AllowanceTotalAmount (BT-107) je ' + hod(S, 'cbc:AllowanceTotalAmount') + ', súčet zliav na úrovni dokladu je ' + sucetZliav.toFixed(2) + '.',
      'Součet slev nesedí: cbc:AllowanceTotalAmount (BT-107) je ' + hod(S, 'cbc:AllowanceTotalAmount') + ', součet slev na úrovni dokladu je ' + sucetZliav.toFixed(2) + '.',
      'Die Abschlagssumme stimmt nicht: cbc:AllowanceTotalAmount (BT-107) ist ' + hod(S, 'cbc:AllowanceTotalAmount') + ', die Summe der Abschläge beträgt ' + sucetZliav.toFixed(2) + '.',
      'The allowance total does not add up: cbc:AllowanceTotalAmount (BT-107) is ' + hod(S, 'cbc:AllowanceTotalAmount') + ', the sum of the document level allowances is ' + sucetZliav.toFixed(2) + '.');
  } else if (bt107 === null && ctx.zlavyDok.length) {
    P('BR-CO-11', S, '',
      'Doklad má zľavy na úrovni dokladu, ale chýba ich súčet (BT-107, cbc:AllowanceTotalAmount). Súčet má byť ' + sucetZliav.toFixed(2) + '.',
      'Doklad má slevy na úrovni dokladu, ale chybí jejich součet (BT-107, cbc:AllowanceTotalAmount). Součet má být ' + sucetZliav.toFixed(2) + '.',
      'Der Beleg hat Abschläge auf Dokumentebene, aber die Summe (BT-107, cbc:AllowanceTotalAmount) fehlt. Sie beträgt ' + sucetZliav.toFixed(2) + '.',
      'The document has allowances on document level but their total (BT-107, cbc:AllowanceTotalAmount) is missing. It should be ' + sucetZliav.toFixed(2) + '.');
  }
  // BR-CO-12
  const sucetPripl = r2(suma(ctx.priplatkyDok, 'cbc:Amount'));
  if (bt108 !== null && r2(bt108) !== sucetPripl) {
    P('BR-CO-12', prve(S, 'cbc:ChargeTotalAmount'), hod(S, 'cbc:ChargeTotalAmount'),
      'Súčet príplatkov nesedí: cbc:ChargeTotalAmount (BT-108) je ' + hod(S, 'cbc:ChargeTotalAmount') + ', súčet príplatkov je ' + sucetPripl.toFixed(2) + '.',
      'Součet příplatku nesedí: cbc:ChargeTotalAmount (BT-108) je ' + hod(S, 'cbc:ChargeTotalAmount') + ', součet příplatku je ' + sucetPripl.toFixed(2) + '.',
      'Die Zuschlagssumme stimmt nicht: cbc:ChargeTotalAmount (BT-108) ist ' + hod(S, 'cbc:ChargeTotalAmount') + ', die Summe der Zuschläge beträgt ' + sucetPripl.toFixed(2) + '.',
      'The charge total does not add up: cbc:ChargeTotalAmount (BT-108) is ' + hod(S, 'cbc:ChargeTotalAmount') + ', the sum of the document level charges is ' + sucetPripl.toFixed(2) + '.');
  } else if (bt108 === null && ctx.priplatkyDok.length) {
    P('BR-CO-12', S, '',
      'Doklad má príplatky na úrovni dokladu, ale chýba ich súčet (BT-108, cbc:ChargeTotalAmount). Súčet má byť ' + sucetPripl.toFixed(2) + '.',
      'Doklad má příplatky na úrovni dokladu, ale chybí jejich součet (BT-108, cbc:ChargeTotalAmount). Součet má být ' + sucetPripl.toFixed(2) + '.',
      'Der Beleg hat Zuschläge auf Dokumentebene, aber die Summe (BT-108, cbc:ChargeTotalAmount) fehlt. Sie beträgt ' + sucetPripl.toFixed(2) + '.',
      'The document has charges on document level but their total (BT-108, cbc:ChargeTotalAmount) is missing. It should be ' + sucetPripl.toFixed(2) + '.');
  }
  // BR-CO-13
  if (Number.isFinite(bt106) && Number.isFinite(bt109)) {
    const ocak = r2(bt106 + (bt108 || 0) - (bt107 || 0));
    if (r2(bt109) !== ocak) {
      P('BR-CO-13', prve(S, 'cbc:TaxExclusiveAmount'), hod(S, 'cbc:TaxExclusiveAmount'),
        'Základ dane spolu (BT-109) má byť súčet riadkov minus zľavy plus príplatky, teda ' + ocak.toFixed(2) + ', v súbore je ' + hod(S, 'cbc:TaxExclusiveAmount') + '.',
        'Základ daně celkem (BT-109) má být součet řádku minus slevy plus příplatky, tedy ' + ocak.toFixed(2) + ', v souboru je ' + hod(S, 'cbc:TaxExclusiveAmount') + '.',
        'Der Gesamtbetrag ohne Umsatzsteuer (BT-109) soll Positionssumme minus Abschläge plus Zuschläge sein, also ' + ocak.toFixed(2) + ', in der Datei steht ' + hod(S, 'cbc:TaxExclusiveAmount') + '.',
        'The invoice total without VAT (BT-109) should be the line total minus allowances plus charges, that is ' + ocak.toFixed(2) + '; the file says ' + hod(S, 'cbc:TaxExclusiveAmount') + '.');
    }
  }
  // BR-CO-14 pre kazdy cac:TaxTotal so podsuhrnmi
  for (const tt of ctx.danCelkom) {
    const pods = deti(tt, 'cac:TaxSubtotal');
    if (!pods.length) continue;
    const celkom = cis(hod(tt, 'cbc:TaxAmount'));
    const sucetPod = r2(suma(pods, 'cbc:TaxAmount'));
    if (Number.isFinite(celkom) && r2(celkom) !== sucetPod) {
      P('BR-CO-14', prve(tt, 'cbc:TaxAmount'), hod(tt, 'cbc:TaxAmount'),
        'DPH spolu (BT-110, cac:TaxTotal/cbc:TaxAmount) je ' + hod(tt, 'cbc:TaxAmount') + ', ale súčet DPH v rozpise je ' + sucetPod.toFixed(2) + '.',
        'DPH celkem (BT-110, cac:TaxTotal/cbc:TaxAmount) je ' + hod(tt, 'cbc:TaxAmount') + ', ale součet DPH v rozpisu je ' + sucetPod.toFixed(2) + '.',
        'Der Gesamtsteuerbetrag (BT-110, cac:TaxTotal/cbc:TaxAmount) ist ' + hod(tt, 'cbc:TaxAmount') + ', die Summe der Steueraufschlüsselung beträgt aber ' + sucetPod.toFixed(2) + '.',
        'The invoice total VAT amount (BT-110, cac:TaxTotal/cbc:TaxAmount) is ' + hod(tt, 'cbc:TaxAmount') + ', but the VAT breakdown adds up to ' + sucetPod.toFixed(2) + '.');
    }
  }
  // BR-CO-15
  if (ctx.mena !== '') {
    const vMene = [];
    for (const tt of ctx.danCelkom) {
      for (const ta of deti(tt, 'cbc:TaxAmount')) {
        if (atr(ta, 'currencyID') === ctx.mena) vMene.push(ta);
      }
    }
    if (vMene.length !== 1) {
      P('BR-CO-15', ctx.koren, String(vMene.length),
        'V mene faktúry (' + ctx.mena + ') musí byť práve jedna suma DPH spolu (BT-110). Našli sme ich ' + vMene.length + '. Skontrolujte cac:TaxTotal/cbc:TaxAmount a atribút currencyID.',
        'V měně faktury (' + ctx.mena + ') musí být právě jedna částka DPH celkem (BT-110). Našli jsme jich ' + vMene.length + '. Zkontrolujte cac:TaxTotal/cbc:TaxAmount a atribut currencyID.',
        'In der Rechnungswährung (' + ctx.mena + ') muss es genau einen Gesamtsteuerbetrag (BT-110) geben. Gefunden: ' + vMene.length + '. Prüfen Sie cac:TaxTotal/cbc:TaxAmount und das Attribut currencyID.',
        'There has to be exactly one invoice total VAT amount (BT-110) in the invoice currency (' + ctx.mena + '). We found ' + vMene.length + '. Check cac:TaxTotal/cbc:TaxAmount and its currencyID attribute.',
        kdeKoren);
    } else if (Number.isFinite(bt109) && Number.isFinite(bt112)) {
      const dph = cis(txt(vMene[0]));
      const ocak = r2(bt109 + dph);
      if (r2(bt112) !== ocak) {
        P('BR-CO-15', prve(S, 'cbc:TaxInclusiveAmount'), hod(S, 'cbc:TaxInclusiveAmount'),
          'Suma s DPH (BT-112) má byť základ dane ' + bt109.toFixed(2) + ' plus DPH ' + dph.toFixed(2) + ', teda ' + ocak.toFixed(2) + '. V súbore je ' + hod(S, 'cbc:TaxInclusiveAmount') + '.',
          'Částka s DPH (BT-112) má být základ daně ' + bt109.toFixed(2) + ' plus DPH ' + dph.toFixed(2) + ', tedy ' + ocak.toFixed(2) + '. V souboru je ' + hod(S, 'cbc:TaxInclusiveAmount') + '.',
          'Der Gesamtbetrag mit Umsatzsteuer (BT-112) soll ' + bt109.toFixed(2) + ' plus ' + dph.toFixed(2) + ' sein, also ' + ocak.toFixed(2) + '. In der Datei steht ' + hod(S, 'cbc:TaxInclusiveAmount') + '.',
          'The invoice total with VAT (BT-112) should be the total without VAT ' + bt109.toFixed(2) + ' plus the VAT ' + dph.toFixed(2) + ', that is ' + ocak.toFixed(2) + '. The file says ' + hod(S, 'cbc:TaxInclusiveAmount') + '. Correct the total in the invoice header, not the individual lines.');
      }
    }
  }
  // BR-CO-16
  if (Number.isFinite(bt112) && Number.isFinite(bt115)) {
    const ocak = r2(bt112 - (bt113 || 0) + (bt114 || 0));
    if (r2(bt115) !== ocak) {
      P('BR-CO-16', prve(S, 'cbc:PayableAmount'), hod(S, 'cbc:PayableAmount'),
        'Suma na úhradu (BT-115) má byť suma s DPH ' + bt112.toFixed(2) + ' minus zaplatené ' + (bt113 || 0).toFixed(2) + ' plus zaokrúhlenie ' + (bt114 || 0).toFixed(2) + ', teda ' + ocak.toFixed(2) + '. V súbore je ' + hod(S, 'cbc:PayableAmount') + '.',
        'Částka k úhradě (BT-115) má být částka s DPH ' + bt112.toFixed(2) + ' minus zaplaceno ' + (bt113 || 0).toFixed(2) + ' plus zaokrouhlení ' + (bt114 || 0).toFixed(2) + ', tedy ' + ocak.toFixed(2) + '. V souboru je ' + hod(S, 'cbc:PayableAmount') + '.',
        'Der fällige Betrag (BT-115) soll ' + bt112.toFixed(2) + ' minus ' + (bt113 || 0).toFixed(2) + ' plus ' + (bt114 || 0).toFixed(2) + ' sein, also ' + ocak.toFixed(2) + '. In der Datei steht ' + hod(S, 'cbc:PayableAmount') + '.',
        'The amount due for payment (BT-115) should be the total with VAT ' + bt112.toFixed(2) + ' minus the paid amount ' + (bt113 || 0).toFixed(2) + ' plus the rounding amount ' + (bt114 || 0).toFixed(2) + ', that is ' + ocak.toFixed(2) + '. The file says ' + hod(S, 'cbc:PayableAmount') + '.');
    }
  }
  // BR-CO-25
  if (Number.isFinite(bt115) && bt115 > 0) {
    const maSplatnost = prve(ctx.koren, 'cbc:DueDate') || cesta(ctx.koren, 'cac:PaymentTerms/cbc:Note').length;
    if (!maSplatnost) {
      P('BR-CO-25', prve(S, 'cbc:PayableAmount'), hod(S, 'cbc:PayableAmount'),
        'Suma na úhradu je kladná, preto musí byť uvedený dátum splatnosti (BT-9, cbc:DueDate) alebo platobné podmienky (BT-20, cac:PaymentTerms/cbc:Note).',
        'Částka k úhradě je kladná, proto musí být uveden datum splatnosti (BT-9, cbc:DueDate) nebo platební podmínky (BT-20, cac:PaymentTerms/cbc:Note).',
        'Der fällige Betrag ist positiv, deshalb braucht die Rechnung ein Fälligkeitsdatum (BT-9, cbc:DueDate) oder Zahlungsbedingungen (BT-20, cac:PaymentTerms/cbc:Note).',
        'The amount due for payment is positive, so the invoice needs either a payment due date (BT-9, cbc:DueDate) or payment terms (BT-20, cac:PaymentTerms/cbc:Note).');
    }
  }
}

// ---------------------------------------------------------------- BR-CO-18 a BR-CO-26 (bezia vzdy)

function rozpisAIdentifikator(ctx) {
  const P = (kod, uzol, hodnota, sk, cs, de, en, c) => pridaj(ctx, kod, CH, uzol, hodnota, sk, cs, de, en, c);
  const kdeKoren = xpath(ctx.koren);
  if (!ctx.podsuhrny.length) {
    P('BR-CO-18', ctx.koren, '',
      'Chýba rozpis DPH (BG-23). Doplňte aspoň jeden cac:TaxTotal/cac:TaxSubtotal so základom dane, sumou dane a kategóriou.',
      'Chybí rozpis DPH (BG-23). Doplňte alespoň jeden cac:TaxTotal/cac:TaxSubtotal se základem daně, částkou daně a kategorií.',
      'Die Steueraufschlüsselung (BG-23) fehlt. Ergänzen Sie mindestens ein cac:TaxTotal/cac:TaxSubtotal mit Bemessungsgrundlage, Steuerbetrag und Kategorie.',
      'The VAT breakdown (BG-23) is missing. Add at least one cac:TaxTotal/cac:TaxSubtotal with a taxable amount, a tax amount and a category.',
      kdeKoren);
  }
  const dodS = jeden(ctx.koren, 'cac:AccountingSupplierParty');
  if (dodS) {
    const maId = cesta(dodS, 'cac:Party/cac:PartyIdentification/cbc:ID').length ||
      cesta(dodS, 'cac:Party/cac:PartyLegalEntity/cbc:CompanyID').length ||
      cesta(dodS, 'cac:Party/cac:PartyTaxScheme/cbc:CompanyID').length;
    if (!maId) {
      P('BR-CO-26', dodS, '',
        'Dodávateľ nemá žiadny identifikátor. Doplňte aspoň jedno: IČ DPH (BT-31, cac:PartyTaxScheme/cbc:CompanyID), IČO (BT-30, cac:PartyLegalEntity/cbc:CompanyID) alebo vlastný identifikátor (BT-29, cac:PartyIdentification/cbc:ID).',
        'Dodavatel nemá žádný identifikátor. Doplňte alespoň jedno: DIČ (BT-31, cac:PartyTaxScheme/cbc:CompanyID), IČO (BT-30, cac:PartyLegalEntity/cbc:CompanyID) nebo vlastní identifikátor (BT-29, cac:PartyIdentification/cbc:ID).',
        'Der Verkäufer hat keine Kennung. Ergänzen Sie mindestens eines: USt-IdNr. (BT-31, cac:PartyTaxScheme/cbc:CompanyID), Registernummer (BT-30, cac:PartyLegalEntity/cbc:CompanyID) oder eigene Kennung (BT-29, cac:PartyIdentification/cbc:ID).',
        'The seller carries no identifier. Add at least one of these: the VAT identifier (BT-31, cac:PartyTaxScheme/cbc:CompanyID), the legal registration identifier (BT-30, cac:PartyLegalEntity/cbc:CompanyID) or a seller identifier (BT-29, cac:PartyIdentification/cbc:ID).');
    }
  }
}

// ---------------------------------------------------------------- rozpis DPH (BR-45 az BR-48, BR-CO-17)

function rozpisDph(ctx) {
  const P = (kod, uzol, hodnota, sk, cs, de, en) => pridaj(ctx, kod, CH, uzol, hodnota, sk, cs, de, en);
  for (const ts of ctx.podsuhrny) {
    if (!prve(ts, 'cbc:TaxableAmount')) {
      P('BR-45', ts, '',
        'V rozpise DPH chýba základ dane (BT-116, cbc:TaxableAmount).',
        'V rozpisu DPH chybí základ daně (BT-116, cbc:TaxableAmount).',
        'In der Steueraufschlüsselung fehlt die Bemessungsgrundlage (BT-116, cbc:TaxableAmount).',
        'The VAT breakdown is missing the taxable amount (BT-116, cbc:TaxableAmount).');
    }
    if (!prve(ts, 'cbc:TaxAmount')) {
      P('BR-46', ts, '',
        'V rozpise DPH chýba suma dane (BT-117, cbc:TaxAmount).',
        'V rozpisu DPH chybí částka daně (BT-117, cbc:TaxAmount).',
        'In der Steueraufschlüsselung fehlt der Steuerbetrag (BT-117, cbc:TaxAmount).',
        'The VAT breakdown is missing the VAT category tax amount (BT-117, cbc:TaxAmount).');
    }
    const kat = katVat(ts, 'cac:TaxCategory');
    const kodKat = kat ? hod(kat, 'cbc:ID') : '';
    if (!kat || kodKat === '') {
      P('BR-47', ts, '',
        'V rozpise DPH chýba kategória DPH (BT-118). Doplňte cac:TaxCategory/cbc:ID a cac:TaxScheme/cbc:ID s hodnotou VAT.',
        'V rozpisu DPH chybí kategorie DPH (BT-118). Doplňte cac:TaxCategory/cbc:ID a cac:TaxScheme/cbc:ID s hodnotou VAT.',
        'In der Steueraufschlüsselung fehlt die Umsatzsteuerkategorie (BT-118). Ergänzen Sie cac:TaxCategory/cbc:ID und cac:TaxScheme/cbc:ID mit VAT.',
        'The VAT breakdown is missing the VAT category code (BT-118). Add cac:TaxCategory/cbc:ID together with cac:TaxScheme/cbc:ID set to VAT.');
    }
    const maSadzbu = kat && prve(kat, 'cbc:Percent');
    if (!maSadzbu && kodKat !== 'O') {
      P('BR-48', kat || ts, kodKat,
        'V rozpise DPH chýba sadzba dane (BT-119, cbc:Percent). Vynechať sa dá len pri kategórii O (nepodlieha DPH).',
        'V rozpisu DPH chybí sazba daně (BT-119, cbc:Percent). Vynechat lze jen u kategorie O (nepodléhá DPH).',
        'In der Steueraufschlüsselung fehlt der Steuersatz (BT-119, cbc:Percent). Weglassen darf man ihn nur bei Kategorie O.',
        'The VAT breakdown is missing the VAT category rate (BT-119, cbc:Percent). It may be left out only for category O, not subject to VAT.');
    }
    // BR-CO-17
    if (kat && maSadzbu) {
      const sadzba = cis(hod(kat, 'cbc:Percent'));
      const zaklad = cis(hod(ts, 'cbc:TaxableAmount'));
      const dan = cis(hod(ts, 'cbc:TaxAmount'));
      if (Number.isFinite(sadzba) && Number.isFinite(zaklad) && Number.isFinite(dan)) {
        const ocak = r2(Math.abs(zaklad) * (sadzba / 100));
        const okNula = Math.round(sadzba) === 0 && Math.round(dan) === 0;
        const okInak = Math.round(sadzba) !== 0 && doJednotky(dan, ocak);
        if (!okNula && !okInak) {
          P('BR-CO-17', prve(ts, 'cbc:TaxAmount'), hod(ts, 'cbc:TaxAmount'),
            'DPH v rozpise nesedí: základ ' + zaklad.toFixed(2) + ' krát sadzba ' + sadzba + ' % je ' + ocak.toFixed(2) + ', v súbore je ' + hod(ts, 'cbc:TaxAmount') + '.',
            'DPH v rozpisu nesedí: základ ' + zaklad.toFixed(2) + ' krát sazba ' + sadzba + ' % je ' + ocak.toFixed(2) + ', v souboru je ' + hod(ts, 'cbc:TaxAmount') + '.',
            'Der Steuerbetrag stimmt nicht: Bemessungsgrundlage ' + zaklad.toFixed(2) + ' mal ' + sadzba + ' % ergibt ' + ocak.toFixed(2) + ', in der Datei steht ' + hod(ts, 'cbc:TaxAmount') + '.',
            'The VAT in the breakdown does not match: taxable amount ' + zaklad.toFixed(2) + ' times ' + sadzba + ' % is ' + ocak.toFixed(2) + ', the file says ' + hod(ts, 'cbc:TaxAmount') + '.');
        }
      }
    }
  }
}

// ---------------------------------------------------------------- BR-CO-09 predpona IC DPH

function icDph(ctx) {
  for (const pts of vsetky(ctx.koren, 'cac:PartyTaxScheme')) {
    if (hod(pts, 'cac:TaxScheme/cbc:ID').toUpperCase() !== 'VAT') continue;
    const id = prve(pts, 'cbc:CompanyID');
    if (!id) continue;
    const v = txt(id);
    if (v === '') continue;
    const pred = v.slice(0, 2).toUpperCase();
    if (!K.ISO_3166_1.has(pred) && !K.PREDPONY_IC_DPH_NAVYSE.has(pred)) {
      pridaj(ctx, 'BR-CO-09', CH, id, v,
        'IČ DPH musí začínať kódom krajiny podľa ISO 3166-1 alfa-2, napríklad SK2020000000. Hodnota ' + v + ' začína na ' + pred + ', čo nie je platný kód krajiny (Grécko smie použiť EL).',
        'DIČ musí začínat kódem země podle ISO 3166-1 alfa-2, například CZ12345678. Hodnota ' + v + ' začíná na ' + pred + ', což není platný kód země (Řecko smí použít EL).',
        'Die USt-IdNr. muss mit einem Ländercode nach ISO 3166-1 alpha-2 beginnen, zum Beispiel DE123456789. Der Wert ' + v + ' beginnt mit ' + pred + ', das ist kein gültiger Ländercode (Griechenland darf EL verwenden).',
        'A VAT identifier has to start with a country code from ISO 3166-1 alpha-2, for example IE1234567X. The value ' + v + ' starts with ' + pred + ', which is not a valid country code (Greece may use EL).');
    }
  }
}

// ---------------------------------------------------------------- BR-DEC desatinne miesta

const DEC = [
  ['BR-DEC-01', 'zlavaD', 'cbc:Amount', 'BT-92', 'suma zľavy na úrovni dokladu', 'the document level allowance amount'],
  ['BR-DEC-02', 'zlavaD', 'cbc:BaseAmount', 'BT-93', 'základ zľavy na úrovni dokladu', 'the document level allowance base amount'],
  ['BR-DEC-05', 'priplD', 'cbc:Amount', 'BT-99', 'suma príplatku na úrovni dokladu', 'the document level charge amount'],
  ['BR-DEC-06', 'priplD', 'cbc:BaseAmount', 'BT-100', 'základ príplatku na úrovni dokladu', 'the document level charge base amount'],
  ['BR-DEC-09', 'sucty', 'cbc:LineExtensionAmount', 'BT-106', 'súčet suma riadkov', 'the sum of invoice line net amounts'],
  ['BR-DEC-10', 'sucty', 'cbc:AllowanceTotalAmount', 'BT-107', 'súčet zliav', 'the sum of allowances on document level'],
  ['BR-DEC-11', 'sucty', 'cbc:ChargeTotalAmount', 'BT-108', 'súčet príplatkov', 'the sum of charges on document level'],
  ['BR-DEC-12', 'sucty', 'cbc:TaxExclusiveAmount', 'BT-109', 'základ dane spolu', 'the invoice total amount without VAT'],
  ['BR-DEC-14', 'sucty', 'cbc:TaxInclusiveAmount', 'BT-112', 'suma s DPH', 'the invoice total amount with VAT'],
  ['BR-DEC-16', 'sucty', 'cbc:PrepaidAmount', 'BT-113', 'zaplatená záloha', 'the paid amount'],
  ['BR-DEC-17', 'sucty', 'cbc:PayableRoundingAmount', 'BT-114', 'zaokrúhlenie', 'the rounding amount'],
  ['BR-DEC-18', 'sucty', 'cbc:PayableAmount', 'BT-115', 'suma na úhradu', 'the amount due for payment'],
  ['BR-DEC-19', 'podsuhrn', 'cbc:TaxableAmount', 'BT-116', 'základ dane v rozpise', 'the VAT category taxable amount'],
  ['BR-DEC-20', 'podsuhrn', 'cbc:TaxAmount', 'BT-117', 'suma dane v rozpise', 'the VAT category tax amount'],
  ['BR-DEC-23', 'riadok', 'cbc:LineExtensionAmount', 'BT-131', 'suma riadku bez DPH', 'the invoice line net amount'],
  ['BR-DEC-24', 'zlavaR', 'cbc:Amount', 'BT-136', 'suma zľavy na riadku', 'the invoice line allowance amount'],
  ['BR-DEC-25', 'zlavaR', 'cbc:BaseAmount', 'BT-137', 'základ zľavy na riadku', 'the invoice line allowance base amount'],
  ['BR-DEC-27', 'priplR', 'cbc:Amount', 'BT-141', 'suma príplatku na riadku', 'the invoice line charge amount'],
  ['BR-DEC-28', 'priplR', 'cbc:BaseAmount', 'BT-142', 'základ príplatku na riadku', 'the invoice line charge base amount']
];

function desatinneMiesta(ctx) {
  const zdroj = {
    zlavaD: ctx.zlavyDok,
    priplD: ctx.priplatkyDok,
    zlavaR: ctx.zlavyRiadkov,
    priplR: ctx.priplatkyRiadkov,
    riadok: ctx.riadky,
    podsuhrn: ctx.podsuhrny,
    sucty: ctx.sucty ? [ctx.sucty] : []
  };
  for (const [kod, kde, prvok, bt, popis, popisEn] of DEC) {
    for (const rodic of zdroj[kde]) {
      for (const n of deti(rodic, prvok)) {
        const v = txt(n);
        if (v === '') continue;
        if (desatinne(v) > 2) {
          pridaj(ctx, kod, CH, n, v,
            'Suma ' + popis + ' (' + bt + ', ' + prvok + ') má viac ako 2 desatinné miesta: ' + v + '. Zaokrúhlite na halier.',
            'Částka (' + bt + ', ' + prvok + ') má více než 2 desetinná místa: ' + v + '. Zaokrouhlete na haléře.',
            'Der Betrag (' + bt + ', ' + prvok + ') hat mehr als 2 Nachkommastellen: ' + v + '. Runden Sie auf zwei Stellen.',
            'The amount for ' + popisEn + ' (' + bt + ', ' + prvok + ') has more than 2 decimals: ' + v + '. Round it to two decimal places.');
        }
      }
    }
  }
  // BR-DEC-13 a BR-DEC-15 pre DPH spolu v mene faktury a v mene uctovania
  for (const tt of ctx.danCelkom) {
    for (const ta of deti(tt, 'cbc:TaxAmount')) {
      const v = txt(ta);
      if (v === '' || desatinne(v) <= 2) continue;
      const c = atr(ta, 'currencyID');
      const kod = c === ctx.menaDane && ctx.menaDane !== '' ? 'BR-DEC-15' : 'BR-DEC-13';
      pridaj(ctx, kod, CH, ta, v,
        'DPH spolu (cac:TaxTotal/cbc:TaxAmount) má viac ako 2 desatinné miesta: ' + v + '.',
        'DPH celkem (cac:TaxTotal/cbc:TaxAmount) má více než 2 desetinná místa: ' + v + '.',
        'Der Gesamtsteuerbetrag (cac:TaxTotal/cbc:TaxAmount) hat mehr als 2 Nachkommastellen: ' + v + '.',
        'The invoice total VAT amount (cac:TaxTotal/cbc:TaxAmount) has more than 2 decimals: ' + v + '. Round it to two decimal places.');
    }
  }
}

// ---------------------------------------------------------------- BR-CL kodovniky

function kodovnik(ctx, kod, uzol, hodnota, nazovKodovnika, kdeSk, kdeCs, kdeDe, kdeEn, nazovEn) {
  pridaj(ctx, kod, CH, uzol, hodnota,
    kdeSk + ' má neplatnú hodnotu "' + hodnota + '". Použite kód z kódovníka ' + nazovKodovnika + '.',
    kdeCs + ' má neplatnou hodnotu "' + hodnota + '". Použijte kód z číselníku ' + nazovKodovnika + '.',
    kdeDe + ' hat den ungültigen Wert "' + hodnota + '". Verwenden Sie einen Code aus der Codeliste ' + nazovKodovnika + '.',
    (kdeEn || kdeSk) + ' has the invalid value "' + hodnota + '". Use a code from the ' + (nazovEn || nazovKodovnika) + ' code list.');
}

function kodovniky(ctx) {
  const d = ctx.koren;

  // BR-CL-01 typ dokladu
  for (const n of deti(d, 'cbc:InvoiceTypeCode')) {
    const v = txt(n);
    if (v !== '' && !K.UNTDID_1001_FAKTURA.has(v)) {
      kodovnik(ctx, 'BR-CL-01', n, v, 'UNTDID 1001 pre faktúru (napríklad 380)',
        'Kód typu dokladu (BT-3)', 'Kód typu dokladu (BT-3)', 'Der Rechnungstyp-Code (BT-3)', 'The invoice type code (BT-3)',
        'UNTDID 1001 for invoices (for example 380)');
    }
  }
  for (const n of deti(d, 'cbc:CreditNoteTypeCode')) {
    const v = txt(n);
    if (v !== '' && !K.UNTDID_1001_DOBROPIS.has(v)) {
      kodovnik(ctx, 'BR-CL-01', n, v, 'UNTDID 1001 pre dobropis (napríklad 381)',
        'Kód typu dokladu (BT-3)', 'Kód typu dokladu (BT-3)', 'Der Rechnungstyp-Code (BT-3)', 'The credit note type code (BT-3)',
        'UNTDID 1001 for credit notes (for example 381)');
    }
  }
  // BR-CL-03 vsetky atributy currencyID
  const sCurrency = [];
  (function zbieraj(n) {
    if (n.atr && n.atr.currencyID !== undefined) sCurrency.push(n);
    for (const x of n.deti) zbieraj(x);
  })(d);
  for (const n of sCurrency) {
    const v = n.atr.currencyID;
    if (!K.ISO_4217.has(String(v).trim())) {
      kodovnik(ctx, 'BR-CL-03', n, v, 'ISO 4217 alfa-3 (napriklad EUR)',
        'Atribut currencyID prvku ' + n.meno, 'Atribut currencyID prvku ' + n.meno, 'Das Attribut currencyID von ' + n.meno, 'The currencyID attribute of ' + n.meno,
        'ISO 4217 alpha-3 (for example EUR)');
    }
  }
  // BR-CL-04 a BR-CL-05
  for (const n of deti(d, 'cbc:DocumentCurrencyCode')) {
    const v = txt(n);
    if (v !== '' && !K.ISO_4217.has(v)) {
      kodovnik(ctx, 'BR-CL-04', n, v, 'ISO 4217 alfa-3 (napriklad EUR)',
        'Mena faktury (BT-5)', 'Mena faktury (BT-5)', 'Die Rechnungswährung (BT-5)', 'The invoice currency code (BT-5)',
        'ISO 4217 alpha-3 (for example EUR)');
    }
  }
  for (const n of deti(d, 'cbc:TaxCurrencyCode')) {
    const v = txt(n);
    if (v !== '' && !K.ISO_4217.has(v)) {
      kodovnik(ctx, 'BR-CL-05', n, v, 'ISO 4217 alfa-3',
        'Mena účtovania DPH (BT-6)', 'Měna účtování DPH (BT-6)', 'Der Steuerwährungscode (BT-6)', 'The VAT accounting currency code (BT-6)',
        'ISO 4217 alpha-3');
    }
  }
  // BR-CL-06
  for (const ob of vsetky(d, 'cac:InvoicePeriod')) {
    for (const n of deti(ob, 'cbc:DescriptionCode')) {
      const v = txt(n);
      if (v !== '' && !K.UNTDID_2005.has(v)) {
        kodovnik(ctx, 'BR-CL-06', n, v, 'UNTDID 2005 v rozsahu 3, 35, 432',
          'Kód dátumu vzniku daňovej povinnosti (BT-8)', 'Kód data uskutečnění plnění (BT-8)', 'Der Code des Steuerstichtags (BT-8)', 'The value added tax point date code (BT-8)',
          'UNTDID 2005 limited to 3, 35 and 432');
      }
    }
  }
  // BR-CL-07
  for (const dr of vsetky(d, 'cac:AdditionalDocumentReference|cac:DocumentReference')) {
    if (hod(dr, 'cbc:DocumentTypeCode') !== '130') continue;
    for (const n of deti(dr, 'cbc:ID')) {
      const v = n.atr.schemeID;
      if (v !== undefined && !K.UNTDID_1153.has(String(v).trim())) {
        kodovnik(ctx, 'BR-CL-07', n, v, 'UNTDID 1153',
          'Atribút schemeID identifikátora predmetu faktúry (BT-18)', 'Atribut schemeID identifikátoru předmětu faktury (BT-18)', 'Das Attribut schemeID der Objektkennung (BT-18)', 'The schemeID attribute of the invoiced object identifier (BT-18)');
      }
    }
  }
  // BR-CL-08 kod predmetu poznamky
  for (const n of deti(d, 'cbc:Note')) {
    const v = txt(n);
    const i = v.indexOf('#');
    if (i !== 0) continue;
    const j = v.indexOf('#', 1);
    if (j !== 4) continue;
    const kodP = v.slice(1, 4);
    if (!K.UNTDID_4451.has(kodP)) {
      kodovnik(ctx, 'BR-CL-08', n, kodP, 'UNTDID 4451',
        'Kód predmetu poznámky (BT-21) na začiatku cbc:Note', 'Kód předmětu poznámky (BT-21) na začátku cbc:Note', 'Der Bemerkungs-Betreffcode (BT-21) am Anfang von cbc:Note', 'The invoice note subject code (BT-21) at the start of cbc:Note');
    }
  }
  // BR-CL-10 a BR-CL-11 a BR-CL-21 a BR-CL-26
  const schemaTest = [
    ['BR-CL-10', 'cac:PartyIdentification', 'cbc:ID', K.ICD, 'ISO 6523 ICD', 'Atribút schemeID identifikátora strany (BT-29 alebo BT-46)', 'Atribut schemeID identifikátoru strany (BT-29 nebo BT-46)', 'Das Attribut schemeID der Parteikennung (BT-29 oder BT-46)', 'The schemeID attribute of the party identifier (BT-29 or BT-46)'],
    ['BR-CL-11', 'cac:PartyLegalEntity', 'cbc:CompanyID', K.ICD, 'ISO 6523 ICD', 'Atribút schemeID registračného čísla (BT-30 alebo BT-47)', 'Atribut schemeID registračního čísla (BT-30 nebo BT-47)', 'Das Attribut schemeID der Registernummer (BT-30 oder BT-47)', 'The schemeID attribute of the legal registration identifier (BT-30 or BT-47)'],
    ['BR-CL-21', 'cac:StandardItemIdentification', 'cbc:ID', K.ICD, 'ISO 6523 ICD', 'Atribút schemeID štandardného identifikátora položky (BT-157)', 'Atribut schemeID standardního identifikátoru položky (BT-157)', 'Das Attribut schemeID der Standardartikelnummer (BT-157)', 'The schemeID attribute of the item standard identifier (BT-157)'],
    ['BR-CL-26', 'cac:DeliveryLocation', 'cbc:ID', K.ICD, 'ISO 6523 ICD', 'Atribút schemeID identifikátora miesta dodania (BT-71)', 'Atribut schemeID identifikátoru místa dodání (BT-71)', 'Das Attribut schemeID der Lieferortkennung (BT-71)', 'The schemeID attribute of the deliver to location identifier (BT-71)']
  ];
  for (const [kod, rodicK, dietaK, zoznam, nazovKod, sk, cs, de, en] of schemaTest) {
    for (const rodic of vsetky(d, rodicK)) {
      for (const n of deti(rodic, dietaK)) {
        const v = n.atr.schemeID;
        if (v === undefined) continue;
        const t = String(v).trim();
        // Peppol pripusta schemeID SEPA pri identifikatore veritela inkasa
        if (kod === 'BR-CL-10' && t === 'SEPA') continue;
        if (!zoznam.has(t)) kodovnik(ctx, kod, n, v, nazovKod, sk, cs, de, en);
      }
    }
  }
  // BR-CL-13 listID klasifikacie
  for (const cc of vsetky(d, 'cac:CommodityClassification')) {
    for (const n of deti(cc, 'cbc:ItemClassificationCode')) {
      const v = n.atr.listID;
      if (v !== undefined && !K.UNTDID_7143.has(String(v).trim())) {
        kodovnik(ctx, 'BR-CL-13', n, v, 'UNTDID 7143',
          'Atribút listID klasifikácie položky (BT-158)', 'Atribut listID klasifikace položky (BT-158)', 'Das Attribut listID der Artikelklassifizierung (BT-158)', 'The listID attribute of the item classification identifier (BT-158)');
      }
    }
  }
  // BR-CL-14 a BR-CL-15 kody krajin
  for (const kr of vsetky(d, 'cac:Country')) {
    for (const n of deti(kr, 'cbc:IdentificationCode')) {
      const v = txt(n);
      if (v !== '' && !K.ISO_3166_1.has(v)) {
        kodovnik(ctx, 'BR-CL-14', n, v, 'ISO 3166-1 alfa-2 (napriklad SK, CZ, DE)',
          'Kód krajiny', 'Kód země', 'Der Ländercode', 'The country code',
          'ISO 3166-1 alpha-2 (for example IE, NL, DE)');
      }
    }
  }
  for (const kr of vsetky(d, 'cac:OriginCountry')) {
    for (const n of deti(kr, 'cbc:IdentificationCode')) {
      const v = txt(n);
      if (v !== '' && !K.ISO_3166_1.has(v)) {
        kodovnik(ctx, 'BR-CL-15', n, v, 'ISO 3166-1 alfa-2',
          'Kód krajiny pôvodu položky (BT-159)', 'Kód země původu položky (BT-159)', 'Der Ursprungslandcode (BT-159)', 'The item country of origin code (BT-159)',
          'ISO 3166-1 alpha-2');
      }
    }
  }
  // BR-CL-16 sposob platby
  for (const pm of ctx.platby) {
    for (const n of deti(pm, 'cbc:PaymentMeansCode')) {
      const v = txt(n);
      if (v !== '' && !K.UNTDID_4461.has(v)) {
        kodovnik(ctx, 'BR-CL-16', n, v, 'UNTDID 4461 (napríklad 58 pre SEPA prevod)',
          'Kód spôsobu platby (BT-81)', 'Kód způsobu platby (BT-81)', 'Der Zahlungsmittelcode (BT-81)', 'The payment means code (BT-81)',
          'UNTDID 4461 (for example 58 for a SEPA credit transfer)');
      }
    }
  }
  // BR-CL-17 a BR-CL-18 kategorie DPH
  for (const tk of vsetky(d, 'cac:TaxCategory')) {
    for (const n of deti(tk, 'cbc:ID')) {
      const v = txt(n);
      if (v !== '' && !K.UNTDID_5305.has(v)) {
        kodovnik(ctx, 'BR-CL-17', n, v, 'UNTDID 5305 (S, Z, E, AE, K, G, O, L, M, B)',
          'Kategória DPH', 'Kategorie DPH', 'Die Umsatzsteuerkategorie', 'The VAT category code');
      }
    }
  }
  for (const tk of vsetky(d, 'cac:ClassifiedTaxCategory')) {
    for (const n of deti(tk, 'cbc:ID')) {
      const v = txt(n);
      if (v !== '' && !K.UNTDID_5305.has(v)) {
        kodovnik(ctx, 'BR-CL-18', n, v, 'UNTDID 5305 (S, Z, E, AE, K, G, O, L, M, B)',
          'Kategória DPH riadku (BT-151)', 'Kategorie DPH řádku (BT-151)', 'Die Umsatzsteuerkategorie der Position (BT-151)', 'The invoiced item VAT category code (BT-151)');
      }
    }
  }
  // BR-CL-19 a BR-CL-20 dovody zliav a priplatkov
  for (const [pole, kod, zoznam, nazovKod, sk, cs, de, en] of [
    [ctx.zlavyDok.concat(ctx.zlavyRiadkov), 'BR-CL-19', K.UNTDID_5189, 'UNCL 5189', 'Kód dôvodu zľavy', 'Kód důvodu slevy', 'Der Abschlagsgrundcode', 'The allowance reason code'],
    [ctx.priplatkyDok.concat(ctx.priplatkyRiadkov), 'BR-CL-20', K.UNTDID_7161, 'UNCL 7161', 'Kód dôvodu príplatku', 'Kód důvodu příplatku', 'Der Zuschlagsgrundcode', 'The charge reason code']
  ]) {
    for (const ac of pole) {
      for (const n of deti(ac, 'cbc:AllowanceChargeReasonCode')) {
        const v = txt(n);
        if (v !== '' && !zoznam.has(v)) kodovnik(ctx, kod, n, v, nazovKod, sk, cs, de, en);
      }
    }
  }
  // BR-CL-22 kody oslobodenia
  for (const n of vsetky(d, 'cbc:TaxExemptionReasonCode')) {
    const v = txt(n).toUpperCase();
    if (v !== '' && !K.VATEX.has(v)) {
      kodovnik(ctx, 'BR-CL-22', n, txt(n), 'CEF VATEX (napriklad VATEX-EU-AE)',
        'Kód dôvodu oslobodenia od DPH (BT-121)', 'Kód důvodu osvobození od DPH (BT-121)', 'Der Code des Steuerbefreiungsgrundes (BT-121)', 'The VAT exemption reason code (BT-121)',
        'CEF VATEX (for example VATEX-EU-AE)');
    }
  }
  // BR-CL-23 jednotky
  const sUnit = [];
  (function zbieraj(n) {
    if (n.atr && n.atr.unitCode !== undefined) sUnit.push(n);
    for (const x of n.deti) zbieraj(x);
  })(d);
  for (const n of sUnit) {
    const v = String(n.atr.unitCode).trim();
    if (!K.REC20.has(v)) {
      kodovnik(ctx, 'BR-CL-23', n, v, 'UN/ECE Rec. 20 (napríklad C62 pre kus, HUR pre hodinu)',
        'Atribut unitCode prvku ' + n.meno, 'Atribut unitCode prvku ' + n.meno, 'Das Attribut unitCode von ' + n.meno, 'The unitCode attribute of ' + n.meno,
        'UN/ECE Rec. 20 (for example C62 for one piece, HUR for an hour)');
    }
  }
  // BR-CL-24 MIME prilohy
  for (const n of vsetky(d, 'cbc:EmbeddedDocumentBinaryObject')) {
    const v = n.atr.mimeCode;
    if (v !== undefined && !K.MIME_PRILOHY.has(String(v).trim())) {
      kodovnik(ctx, 'BR-CL-24', n, v, 'MIMEMediaType (application/pdf, image/png, image/jpeg, text/csv, xlsx, ods)',
        'Atribút mimeCode prílohy (BT-125)', 'Atribut mimeCode přílohy (BT-125)', 'Das Attribut mimeCode der Anlage (BT-125)', 'The mimeCode attribute of the attached document (BT-125)');
    }
  }
  // BR-CL-25 schemeID elektronickej adresy
  for (const n of vsetky(d, 'cbc:EndpointID')) {
    const v = n.atr.schemeID;
    if (v !== undefined && !K.EAS.has(String(v).trim())) {
      kodovnik(ctx, 'BR-CL-25', n, v, 'CEF EAS (napríklad 0245 pre slovenské DIČ, 9930 pre nemecké USt-IdNr.)',
        'Atribút schemeID elektronickej adresy', 'Atribut schemeID elektronické adresy', 'Das Attribut schemeID der elektronischen Adresse', 'The schemeID attribute of the electronic address',
        'CEF EAS (for example 0088 for a GS1 GLN, 9930 for a German VAT number, 0245 for a Slovak tax number)');
    }
  }
}

// ---------------------------------------------------------------- BR-B rozdelena platba

function rozdelenaPlatba(ctx) {
  const d = ctx.koren;
  const maB = vsetky(d, 'cac:TaxCategory|cac:ClassifiedTaxCategory').some((k) => hod(k, 'cbc:ID') === 'B');
  if (!maB) return;
  const krajiny = vsetky(d, 'cbc:IdentificationCode').map((n) => txt(n)).filter((x) => x !== '');
  if (krajiny.some((x) => x !== 'IT')) {
    pridaj(ctx, 'BR-B-01', CH, d, krajiny.join(', '),
      'Kategória DPH B (rozdelená platba) sa dá použiť len na tuzemskej talianskej faktúre. V doklade sú kódy krajín ' + krajiny.join(', ') + '.',
      'Kategorie DPH B (rozdělená platba) lze použít jen na tuzemské italské faktuře. V dokladu jsou kódy zemí ' + krajiny.join(', ') + '.',
      'Die Umsatzsteuerkategorie B (Split payment) ist nur bei einer italienischen Inlandsrechnung zulässig. Im Beleg stehen die Ländercodes ' + krajiny.join(', ') + '.',
      'VAT category B (split payment) may only be used on a domestic Italian invoice. The document carries the country codes ' + krajiny.join(', ') + '.',
      xpath(d));
  }
  const maS = vsetky(d, 'cac:TaxCategory|cac:ClassifiedTaxCategory').some((k) => hod(k, 'cbc:ID') === 'S');
  if (maS) {
    pridaj(ctx, 'BR-B-02', CH, d, 'B + S',
      'Doklad používa naraz kategóriu B (rozdelená platba) a kategóriu S (základná sadzba). To sa nesmie kombinovať.',
      'Doklad používá současně kategorii B (rozdělená platba) a kategorii S (základní sazba). To nelze kombinovat.',
      'Der Beleg verwendet gleichzeitig die Kategorie B (Split payment) und die Kategorie S (Regelsatz). Das ist nicht zulässig.',
      'The document uses VAT category B (split payment) and category S (standard rate) at the same time. These two must not be combined.',
      xpath(d));
  }
}

export function pravidlaEn16931(ctx) {
  zakladne(ctx);
  riadky(ctx);
  zlavyPriplatky(ctx);
  obdobia(ctx);
  platby(ctx);
  sucty(ctx);
  rozpisAIdentifikator(ctx);
  rozpisDph(ctx);
  icDph(ctx);
  desatinneMiesta(ctx);
  kodovniky(ctx);
  rozdelenaPlatba(ctx);
}
