// z-ubl.mjs - opacny smer k ubl.js: z e-faktury v UBL 2.1 (Invoice alebo CreditNote) urobi objekt
// faktury v presne tom tvare, s akym pracuje formular v app.js a generator vytvorUbl() v ubl.js.
//
// Zasady:
// 1. Nic nevymyslame. Co v subore chyba, ostane prazdne, aby to clovek vo formulari doplnil
//    (casto je to prave ta chyba, pre ktoru subor neprechadza kontrolou). Chybna hodnota
//    (zly IBAN, zly datum, sadzba 20 %) prejde do formulara tak, ako je, a kontrola ju ukaze.
// 2. Nic sa nestrati potichu. Z objektu hned vytvorime nove XML tym istym generatorom, aky
//    pouziva formular, a porovname ho so suborom prvok po prvku:
//    - co v novom XML chyba, je v zozname `neprenesene` (formular to nevie),
//    - co v nom vyjde inak alebo co generator doplni sam, je v zozname `rozdiely`
//      (napriklad sucty, ktore formular pocita z poloziek, alebo chybajuca krajina, za ktoru
//      generator zapise SK),
//    - co formular prenesie a zapise, ale neukazuje v poliach, je v zozname `skryte`.
// 3. CII (CrossIndustryInvoice) neprenasame, formular robi len UBL. Vratime jasnu chybu.
//
// Vsetko bezi v prehliadaci (a v Node pri testoch z-ubl.test.mjs), nic sa nikam neposiela.
// Vystupom su len data; na stranke ich app.js vypisuje cez textContent, nikdy ako HTML.

import * as K from './kodovniky.mjs';
import { parsujXml, deti, prve, jeden, txt, hod, atr } from './parser.mjs';
import { vytvorUbl, TEXT_SPLATNOSTI, PREDVOLENE_OSLOBODENIE } from './ubl.js';

const JAZYKY = ['sk', 'cs', 'de', 'en'];
const J = { sk: 0, cs: 1, de: 2, en: 3 };
const CISLO = /^[+-]?\d+(?:\.\d+)?$/;
const CISELNE_PRVKY = /(Amount|Quantity|Percent)$/;

// ---------------------------------------------------------------- chyby

const CHYBY = {
  cii: {
    sk: 'Súbor je v syntaxi CII (CrossIndustryInvoice). Formulár vytvára len UBL 2.1 (Invoice alebo CreditNote), preto tento súbor doň preniesť nevieme.',
    cs: 'Soubor je v syntaxi CII (CrossIndustryInvoice). Formulář vytváří jen UBL 2.1 (Invoice nebo CreditNote), proto tento soubor do něj přenést neumíme.',
    de: 'Die Datei ist in der Syntax CII (CrossIndustryInvoice). Das Formular erzeugt nur UBL 2.1 (Invoice oder CreditNote), deshalb können wir diese Datei nicht übernehmen.',
    en: 'The file uses the CII syntax (CrossIndustryInvoice). The form only produces UBL 2.1 (Invoice or CreditNote), so we cannot move this file into it.'
  },
  koren: (m) => ({
    sk: 'Hlavný prvok súboru je ' + m + ', nie Invoice ani CreditNote. Do formulára vieme preniesť len e-faktúru v UBL 2.1.',
    cs: 'Hlavní prvek souboru je ' + m + ', ne Invoice ani CreditNote. Do formuláře umíme přenést jen e-fakturu v UBL 2.1.',
    de: 'Das Wurzelelement der Datei ist ' + m + ', weder Invoice noch CreditNote. Ins Formular übernehmen wir nur E-Rechnungen in UBL 2.1.',
    en: 'The root element of the file is ' + m + ', not Invoice or CreditNote. We can only move an e-invoice in UBL 2.1 into the form.'
  }),
  vnutorna: {
    sk: 'Súbor sa do formulára nepodarilo preniesť. Napíšte nám na podpora@arling.sk.',
    cs: 'Soubor se do formuláře nepodařilo přenést. Napište nám na podpora@arling.sk.',
    de: 'Die Datei ließ sich nicht ins Formular übernehmen. Schreiben Sie uns an support@arling.sk.',
    en: 'The file could not be moved into the form. Write to us at support@arling.sk.'
  }
};

// ---------------------------------------------------------------- nazvy prvkov pre ludi

// Prvy prvok cesty: komu alebo k comu udaj patri. [sk, cs, de, en]
const ROLA = {
  'cac:AccountingSupplierParty': ['dodávateľ', 'dodavatel', 'Verkäufer', 'seller'],
  'cac:AccountingCustomerParty': ['odberateľ', 'odběratel', 'Käufer', 'buyer'],
  'cac:PayeeParty': ['príjemca platby', 'příjemce platby', 'Zahlungsempfänger', 'payee'],
  'cac:TaxRepresentativeParty': ['daňový zástupca', 'daňový zástupce', 'Steuervertreter', 'tax representative'],
  'cac:Delivery': ['dodanie', 'dodání', 'Lieferung', 'delivery'],
  'cac:PaymentMeans': ['platba', 'platba', 'Zahlung', 'payment'],
  'cac:PaymentTerms': ['platobné podmienky', 'platební podmínky', 'Zahlungsbedingungen', 'payment terms'],
  'cac:InvoiceLine': ['riadok', 'řádek', 'Position', 'line'],
  'cac:TaxTotal': ['rozpis DPH', 'rozpis DPH', 'Steueraufschlüsselung', 'VAT breakdown'],
  'cac:LegalMonetaryTotal': ['súčty', 'součty', 'Summen', 'totals'],
  'cac:AllowanceCharge': ['zľava alebo príplatok k celému dokladu', 'sleva nebo příplatek k celému dokladu', 'Nachlass oder Zuschlag auf den ganzen Beleg', 'allowance or charge on the whole document'],
  'cac:AdditionalDocumentReference': ['príloha alebo odkaz na dokument', 'příloha nebo odkaz na dokument', 'Anlage oder Dokumentverweis', 'attachment or document reference'],
  'cac:InvoicePeriod': ['fakturačné obdobie', 'fakturační období', 'Abrechnungszeitraum', 'invoicing period'],
  'cac:OrderReference': ['objednávka', 'objednávka', 'Bestellung', 'purchase order'],
  'cac:BillingReference': ['predchádzajúca faktúra', 'předchozí faktura', 'vorausgegangene Rechnung', 'preceding invoice'],
  'cac:DespatchDocumentReference': ['dodací list', 'dodací list', 'Lieferschein', 'despatch advice'],
  'cac:ReceiptDocumentReference': ['príjemka', 'příjemka', 'Wareneingangsmeldung', 'receiving advice'],
  'cac:OriginatorDocumentReference': ['súťaž alebo výberové konanie', 'zadávací řízení', 'Vergabeverfahren', 'tender or lot'],
  'cac:ContractDocumentReference': ['zmluva', 'smlouva', 'Vertrag', 'contract'],
  'cac:ProjectReference': ['projekt', 'projekt', 'Projekt', 'project'],
  'cac:PrepaidPayment': ['údaje o zálohe', 'údaje o záloze', 'Angaben zur Anzahlung', 'prepayment details'],
  'cac:Signature': ['podpis', 'podpis', 'Signatur', 'signature'],
  'ext:UBLExtensions': ['rozšírenia UBL (napríklad elektronický podpis)', 'rozšíření UBL (například elektronický podpis)', 'UBL-Erweiterungen (zum Beispiel eine Signatur)', 'UBL extensions (for example a signature)']
};

// Presna cesta od korena dokladu.
const KOREN = {
  'cbc:CustomizationID': ['profil (CustomizationID)', 'profil (CustomizationID)', 'Profil (CustomizationID)', 'profile (CustomizationID)'],
  'cbc:ProfileID': ['proces (ProfileID)', 'proces (ProfileID)', 'Prozess (ProfileID)', 'process (ProfileID)'],
  'cbc:ID': ['číslo faktúry', 'číslo faktury', 'Rechnungsnummer', 'invoice number'],
  'cbc:IssueDate': ['dátum vystavenia', 'datum vystavení', 'Rechnungsdatum', 'issue date'],
  'cbc:DueDate': ['dátum splatnosti', 'datum splatnosti', 'Fälligkeitsdatum', 'due date'],
  'cbc:InvoiceTypeCode': ['typ dokladu', 'typ dokladu', 'Belegart', 'document type'],
  'cbc:TaxPointDate': ['dátum zdaniteľného plnenia', 'datum zdanitelného plnění', 'Steuerdatum', 'tax point date'],
  'cbc:DocumentCurrencyCode': ['mena', 'měna', 'Währung', 'currency'],
  'cbc:TaxCurrencyCode': ['mena na vyúčtovanie DPH', 'měna pro vyúčtování DPH', 'Steuerwährung', 'VAT accounting currency'],
  'cbc:AccountingCost': ['účtovná referencia odberateľa', 'účetní reference odběratele', 'Buchungsreferenz des Käufers', 'buyer accounting reference'],
  'cbc:BuyerReference': ['referencia odberateľa', 'reference odběratele', 'Käuferreferenz', 'buyer reference'],
  'cac:PaymentTerms/cbc:Note': ['platobné podmienky', 'platební podmínky', 'Zahlungsbedingungen', 'payment terms'],
  'cac:InvoicePeriod/cbc:StartDate': ['začiatok fakturačného obdobia', 'začátek fakturačního období', 'Beginn des Abrechnungszeitraums', 'invoicing period start'],
  'cac:InvoicePeriod/cbc:EndDate': ['koniec fakturačného obdobia', 'konec fakturačního období', 'Ende des Abrechnungszeitraums', 'invoicing period end'],
  'cac:OrderReference/cbc:ID': ['číslo objednávky', 'číslo objednávky', 'Bestellnummer', 'purchase order number'],
  'cac:BillingReference/cac:InvoiceDocumentReference/cbc:ID': ['číslo predchádzajúcej faktúry', 'číslo předchozí faktury', 'Nummer der vorausgegangenen Rechnung', 'preceding invoice number'],
  'cac:BillingReference/cac:InvoiceDocumentReference/cbc:IssueDate': ['dátum predchádzajúcej faktúry', 'datum předchozí faktury', 'Datum der vorausgegangenen Rechnung', 'preceding invoice date']
};

// Koniec cesty: ktory udaj. Vyhrava najdlhsia zhoda.
const POLE = {
  'cbc:EndpointID': ['elektronická adresa', 'elektronická adresa', 'elektronische Adresse', 'electronic address'],
  'cac:PartyIdentification': ['identifikátor', 'identifikátor', 'Kennung', 'identifier'],
  'cac:PartyIdentification/cbc:ID': ['identifikátor', 'identifikátor', 'Kennung', 'identifier'],
  'cac:PartyName': ['obchodné meno', 'obchodní jméno', 'Handelsname', 'trading name'],
  'cac:PartyName/cbc:Name': ['obchodné meno', 'obchodní jméno', 'Handelsname', 'trading name'],
  'cac:PostalAddress': ['adresa', 'adresa', 'Anschrift', 'address'],
  'cbc:StreetName': ['ulica', 'ulice', 'Straße', 'street'],
  'cbc:AdditionalStreetName': ['doplnok adresy', 'doplněk adresy', 'Adresszusatz', 'additional street'],
  'cbc:CityName': ['mesto', 'město', 'Ort', 'city'],
  'cbc:PostalZone': ['PSČ', 'PSČ', 'PLZ', 'post code'],
  'cbc:CountrySubentity': ['kraj alebo región', 'kraj nebo region', 'Region', 'region'],
  'cac:AddressLine': ['ďalší riadok adresy', 'další řádek adresy', 'weitere Adresszeile', 'further address line'],
  'cac:Country/cbc:IdentificationCode': ['krajina', 'země', 'Land', 'country'],
  'cac:PartyTaxScheme': ['daňová registrácia', 'daňová registrace', 'Steuerregistrierung', 'tax registration'],
  'cac:PartyTaxScheme/cbc:CompanyID': ['IČ DPH alebo iné daňové číslo', 'DIČ nebo jiné daňové číslo', 'USt-IdNr. oder Steuernummer', 'VAT or other tax number'],
  'cac:PartyTaxScheme/cac:TaxScheme/cbc:ID': ['druh daňovej registrácie', 'druh daňové registrace', 'Art der Steuerregistrierung', 'tax scheme'],
  'cac:PartyLegalEntity': ['právne údaje', 'právní údaje', 'rechtliche Angaben', 'legal details'],
  'cac:PartyLegalEntity/cbc:RegistrationName': ['názov', 'název', 'Name', 'name'],
  'cac:PartyLegalEntity/cbc:CompanyID': ['IČO', 'IČO', 'Registernummer', 'registration number'],
  'cac:PartyLegalEntity/cbc:CompanyLegalForm': ['doplňujúce právne údaje', 'doplňující právní údaje', 'weitere rechtliche Angaben', 'additional legal information'],
  'cac:Contact': ['kontakt', 'kontakt', 'Kontakt', 'contact'],
  'cac:Contact/cbc:Name': ['kontaktná osoba', 'kontaktní osoba', 'Ansprechpartner', 'contact person'],
  'cac:Contact/cbc:Telephone': ['telefón', 'telefon', 'Telefon', 'phone'],
  'cac:Contact/cbc:ElectronicMail': ['e-mail', 'e-mail', 'E-Mail', 'e-mail'],
  'cbc:ActualDeliveryDate': ['dátum dodania', 'datum dodání', 'Lieferdatum', 'delivery date'],
  'cac:DeliveryLocation': ['miesto dodania', 'místo dodání', 'Lieferort', 'delivery location'],
  'cac:DeliveryLocation/cbc:ID': ['identifikátor miesta dodania', 'identifikátor místa dodání', 'Kennung des Lieferorts', 'delivery location identifier'],
  'cac:DeliveryParty': ['príjemca tovaru', 'příjemce zboží', 'Warenempfänger', 'receiving party'],
  'cbc:PaymentMeansCode': ['spôsob platby', 'způsob platby', 'Zahlungsart', 'payment means'],
  'cac:PaymentMeans/cbc:PaymentMeansCode': ['spôsob platby', 'způsob platby', 'Zahlungsart', 'payment means'],
  'cbc:PaymentID': ['variabilný symbol', 'variabilní symbol', 'Verwendungszweck', 'payment reference'],
  'cac:PaymentMeans/cbc:PaymentID': ['variabilný symbol', 'variabilní symbol', 'Verwendungszweck', 'payment reference'],
  'cac:PaymentMeans/cac:PayeeFinancialAccount/cbc:ID': ['IBAN', 'IBAN', 'IBAN', 'IBAN'],
  'cac:PaymentMeans/cac:PayeeFinancialAccount/cbc:Name': ['názov účtu', 'název účtu', 'Kontoinhaber', 'account name'],
  'cac:PaymentMeans/cac:PayeeFinancialAccount/cac:FinancialInstitutionBranch/cbc:ID': ['BIC', 'BIC', 'BIC', 'BIC'],
  'cbc:PaymentDueDate': ['dátum splatnosti', 'datum splatnosti', 'Fälligkeitsdatum', 'due date'],
  'cbc:PaymentChannelCode': ['platobný kanál', 'platební kanál', 'Zahlungskanal', 'payment channel'],
  'cbc:InstructionNote': ['pokyn k platbe', 'pokyn k platbě', 'Zahlungsanweisung', 'payment instruction'],
  'cac:PayeeFinancialAccount': ['účet', 'účet', 'Konto', 'account'],
  'cac:PayeeFinancialAccount/cbc:ID': ['IBAN', 'IBAN', 'IBAN', 'IBAN'],
  'cac:PayeeFinancialAccount/cbc:Name': ['názov účtu', 'název účtu', 'Kontoinhaber', 'account name'],
  'cac:FinancialInstitutionBranch': ['banka', 'banka', 'Bank', 'bank'],
  'cac:FinancialInstitutionBranch/cbc:ID': ['BIC', 'BIC', 'BIC', 'BIC'],
  'cac:CardAccount': ['platobná karta', 'platební karta', 'Zahlungskarte', 'payment card'],
  'cac:PaymentMandate': ['mandát na inkaso', 'mandát k inkasu', 'Lastschriftmandat', 'direct debit mandate'],
  'cbc:Note': ['poznámka', 'poznámka', 'Hinweis', 'note'],
  'cbc:TaxAmount': ['DPH', 'DPH', 'Steuerbetrag', 'VAT amount'],
  'cac:TaxTotal/cbc:TaxAmount': ['DPH spolu', 'DPH celkem', 'Steuer gesamt', 'total VAT'],
  'cac:TaxSubtotal': ['riadok rozpisu DPH', 'řádek rozpisu DPH', 'Zeile der Steueraufschlüsselung', 'VAT breakdown line'],
  'cac:TaxSubtotal/cbc:TaxableAmount': ['základ dane', 'základ daně', 'Bemessungsgrundlage', 'taxable amount'],
  'cac:TaxSubtotal/cbc:TaxAmount': ['DPH za kategóriu', 'DPH za kategorii', 'Steuer je Kategorie', 'VAT per category'],
  'cac:TaxCategory': ['kategória DPH', 'kategorie DPH', 'Steuerkategorie', 'VAT category'],
  'cac:TaxCategory/cbc:ID': ['kategória DPH', 'kategorie DPH', 'Steuerkategorie', 'VAT category'],
  'cac:ClassifiedTaxCategory': ['kategória DPH', 'kategorie DPH', 'Steuerkategorie', 'VAT category'],
  'cac:ClassifiedTaxCategory/cbc:ID': ['kategória DPH', 'kategorie DPH', 'Steuerkategorie', 'VAT category'],
  'cbc:Percent': ['sadzba DPH', 'sazba DPH', 'Steuersatz', 'VAT rate'],
  'cbc:TaxExemptionReason': ['dôvod oslobodenia', 'důvod osvobození', 'Befreiungsgrund', 'exemption reason'],
  'cbc:TaxExemptionReasonCode': ['kód dôvodu oslobodenia', 'kód důvodu osvobození', 'Code des Befreiungsgrunds', 'exemption reason code'],
  'cac:LegalMonetaryTotal/cbc:LineExtensionAmount': ['súčet riadkov', 'součet řádků', 'Summe der Positionen', 'sum of lines'],
  'cac:LegalMonetaryTotal/cbc:TaxExclusiveAmount': ['suma bez DPH', 'částka bez DPH', 'Gesamtbetrag netto', 'total without VAT'],
  'cac:LegalMonetaryTotal/cbc:TaxInclusiveAmount': ['suma s DPH', 'částka s DPH', 'Gesamtbetrag brutto', 'total with VAT'],
  'cac:LegalMonetaryTotal/cbc:AllowanceTotalAmount': ['zľavy spolu', 'slevy celkem', 'Nachlässe gesamt', 'total allowances'],
  'cac:LegalMonetaryTotal/cbc:ChargeTotalAmount': ['príplatky spolu', 'příplatky celkem', 'Zuschläge gesamt', 'total charges'],
  'cac:LegalMonetaryTotal/cbc:PrepaidAmount': ['zaplatená záloha', 'zaplacená záloha', 'Anzahlung', 'amount already paid'],
  'cac:LegalMonetaryTotal/cbc:PayableRoundingAmount': ['zaokrúhlenie', 'zaokrouhlení', 'Rundungsbetrag', 'rounding amount'],
  'cac:LegalMonetaryTotal/cbc:PayableAmount': ['suma na úhradu', 'částka k úhradě', 'Zahlbetrag', 'amount due'],
  'cac:InvoiceLine/cbc:ID': ['číslo riadku', 'číslo řádku', 'Positionsnummer', 'line number'],
  'cac:InvoiceLine/cbc:Note': ['poznámka k riadku', 'poznámka k řádku', 'Hinweis zur Position', 'line note'],
  'cac:InvoiceLine/cbc:InvoicedQuantity': ['množstvo', 'množství', 'Menge', 'quantity'],
  'cac:InvoiceLine/cbc:LineExtensionAmount': ['suma riadku bez DPH', 'částka řádku bez DPH', 'Nettobetrag der Position', 'line net amount'],
  'cac:InvoiceLine/cbc:AccountingCost': ['účtovná referencia riadku', 'účetní reference řádku', 'Buchungsreferenz der Position', 'line accounting reference'],
  'cac:InvoiceLine/cac:InvoicePeriod': ['obdobie riadku', 'období řádku', 'Zeitraum der Position', 'line period'],
  'cac:InvoiceLine/cac:OrderLineReference': ['riadok objednávky', 'řádek objednávky', 'Bestellposition', 'order line reference'],
  'cac:InvoiceLine/cac:DocumentReference': ['odkaz na dokument', 'odkaz na dokument', 'Dokumentverweis', 'document reference'],
  'cac:InvoiceLine/cac:AllowanceCharge': ['zľava alebo príplatok v riadku', 'sleva nebo příplatek v řádku', 'Nachlass oder Zuschlag der Position', 'line allowance or charge'],
  'cac:Item/cbc:Name': ['názov položky', 'název položky', 'Bezeichnung', 'item name'],
  'cac:Item/cbc:Description': ['popis položky', 'popis položky', 'Beschreibung', 'item description'],
  'cac:BuyersItemIdentification': ['kód položky u odberateľa', 'kód položky u odběratele', 'Artikelnummer des Käufers', 'buyer item code'],
  'cac:SellersItemIdentification': ['kód položky u dodávateľa', 'kód položky u dodavatele', 'Artikelnummer des Verkäufers', 'seller item code'],
  'cac:StandardItemIdentification': ['kód položky (napríklad EAN)', 'kód položky (například EAN)', 'Artikelkennung (zum Beispiel GTIN)', 'standard item code (for example GTIN)'],
  'cac:OriginCountry': ['krajina pôvodu', 'země původu', 'Ursprungsland', 'country of origin'],
  'cac:CommodityClassification': ['klasifikácia položky', 'klasifikace položky', 'Artikelklassifizierung', 'item classification'],
  'cac:AdditionalItemProperty': ['vlastnosť položky', 'vlastnost položky', 'Artikeleigenschaft', 'item attribute'],
  'cac:Price/cbc:PriceAmount': ['jednotková cena', 'jednotková cena', 'Einzelpreis', 'unit price'],
  'cac:Price/cbc:BaseQuantity': ['základné množstvo ceny', 'základní množství ceny', 'Basismenge des Preises', 'price base quantity'],
  'cac:Price/cac:AllowanceCharge': ['zľava z ceny', 'sleva z ceny', 'Preisnachlass', 'price discount'],
  'cac:AllowanceCharge': ['zľava alebo príplatok', 'sleva nebo příplatek', 'Nachlass oder Zuschlag', 'allowance or charge']
};

const ATR = {
  unitCode: ['jednotka', 'jednotka', 'Einheit', 'unit'],
  currencyID: ['mena sumy', 'měna částky', 'Währung des Betrags', 'currency of the amount'],
  schemeID: ['kód schémy', 'kód schématu', 'Schema', 'scheme'],
  name: ['text', 'text', 'Text', 'text'],
  mimeCode: ['typ súboru', 'typ souboru', 'Dateityp', 'file type'],
  filename: ['názov súboru', 'název souboru', 'Dateiname', 'file name'],
  listID: ['číselník', 'číselník', 'Codeliste', 'code list']
};

/** Citatelny nazov udaja podla cesty (bez indexov, riadky dokladu ako cac:InvoiceLine). */
function nazov(cesta, j, riadok) {
  const m = /\/@([^/]+)$/.exec(cesta);
  const zaklad = m ? cesta.slice(0, m.index) : cesta;
  const a = m ? m[1] : '';
  const seg = zaklad.split('/');
  const prva = seg[0];
  const pripoj = (text) => (a && a !== 'unitCode' && a !== 'currencyID' ? text + ', ' + (ATR[a] ? ATR[a][j] : a) : text);
  let pole = '';
  let kluc = '';
  if (a === 'unitCode' || a === 'currencyID') pole = ATR[a][j];
  else if (KOREN[zaklad]) return pripoj(KOREN[zaklad][j]);
  else if (seg.length === 1 && ROLA[prva]) return pripoj(ROLA[prva][j]);
  else {
    for (const k of Object.keys(POLE)) {
      if (k.length > kluc.length && (zaklad === k || zaklad.endsWith('/' + k))) kluc = k;
    }
    if (kluc) pole = POLE[kluc][j];
  }
  let rola = ROLA[prva] ? ROLA[prva][j] : '';
  if (prva === 'cac:InvoiceLine' && riadok) rola = ROLA[prva][j] + ' ' + riadok;
  else if (kluc && kluc.split('/')[0] === prva) rola = '';
  if (!pole) pole = seg[seg.length - 1];
  return pripoj(rola && seg.length > 1 ? pole + ' (' + rola + ')' : pole);
}

// Vety pre rozdiely, ktore nie su jednym prvkom. [sk, cs, de, en]
const VETY = {
  druh: (a, b) => [
    'Druh dokladu: v súbore ' + a + ', formulár vytvorí ' + b + '. Dobropis (CreditNote) formulár vytvorí len pri type dokladu 381.',
    'Druh dokladu: v souboru ' + a + ', formulář vytvoří ' + b + '. Dobropis (CreditNote) formulář vytvoří jen u typu dokladu 381.',
    'Belegart: in der Datei ' + a + ', das Formular erzeugt ' + b + '. Eine Gutschrift (CreditNote) erzeugt das Formular nur mit dem Belegtyp 381.',
    'Document kind: the file has ' + a + ', the form creates ' + b + '. The form only creates a credit note (CreditNote) with document type 381.'
  ],
  poznamky: (n) => [
    'Poznámky k faktúre (' + n + ') formulár spojí do jednej, lebo má na ne jedno pole.',
    'Poznámky k faktuře (' + n + ') formulář spojí do jedné, protože má pro ně jedno pole.',
    'Die ' + n + ' Hinweise zur Rechnung fasst das Formular zu einem zusammen, weil es dafür ein Feld hat.',
    'The form joins the ' + n + ' invoice notes into one, because it has a single field for them.'
  ],
  prazdne: (n) => [
    'Prázdne prvky zo súboru (' + n + ') formulár vynechá.',
    'Prázdné prvky ze souboru (' + n + ') formulář vynechá.',
    'Leere Elemente aus der Datei (' + n + ') lässt das Formular weg.',
    'The form leaves out the empty elements from the file (' + n + ').'
  ]
};

// Co formular prenesie a zapise do XML, hoci na to nema pole. Hlasi sa, len ked to bolo v subore.
const SKRYTE = [
  ['cac:InvoiceLine/cac:Item/cbc:Description', ['popis položky', 'popis položky', 'Beschreibung der Position', 'item description']],
  ['cac:InvoicePeriod', ['fakturačné obdobie', 'fakturační období', 'Abrechnungszeitraum', 'invoicing period']],
  ['cac:OrderReference', ['číslo objednávky', 'číslo objednávky', 'Bestellnummer', 'purchase order number']],
  ['cac:BillingReference', ['predchádzajúca faktúra', 'předchozí faktura', 'vorausgegangene Rechnung', 'preceding invoice']],
  ['cac:Delivery/cac:DeliveryLocation', ['miesto dodania', 'místo dodání', 'Lieferort', 'delivery location']],
  ['*/cac:Party/cac:PartyName', ['obchodné meno', 'obchodní jméno', 'Handelsname', 'trading name']],
  ['*/cac:PostalAddress/cbc:AdditionalStreetName', ['doplnok adresy', 'doplněk adresy', 'Adresszusatz', 'additional street']],
  ['*/cac:Party/cac:PartyIdentification', ['identifikátor strany', 'identifikátor strany', 'Kennung der Partei', 'party identifier']],
  ['cac:AccountingCustomerParty/cac:Party/cac:Contact/cbc:Name', ['kontaktná osoba odberateľa', 'kontaktní osoba odběratele', 'Ansprechpartner des Käufers', 'buyer contact person']],
  ['cac:AccountingCustomerParty/cac:Party/cac:Contact/cbc:Telephone', ['telefón odberateľa', 'telefon odběratele', 'Telefon des Käufers', 'buyer phone']],
  ['*/cbc:TaxExemptionReason', ['dôvod oslobodenia od DPH', 'důvod osvobození od DPH', 'Grund der Steuerbefreiung', 'VAT exemption reason']],
  ['*/cbc:TaxExemptionReasonCode', ['kód dôvodu oslobodenia', 'kód důvodu osvobození', 'Code des Befreiungsgrunds', 'exemption reason code']]
];

// Co generator doplni sam, ked to v subore chyba. Taka hodnota nie je zo suboru, preto ju ukazeme.
// Sucty a sumy tu nie su: tie formular vzdy pocita z poloziek a povie to vseobecne.
const DOPLNENE = [
  'cbc:CustomizationID', 'cbc:ProfileID', 'cbc:InvoiceTypeCode', 'cbc:DocumentCurrencyCode',
  '*/cac:Country/cbc:IdentificationCode', 'cac:PaymentMeans/cbc:PaymentMeansCode',
  'cac:Delivery/cbc:ActualDeliveryDate', 'cac:Delivery/cac:DeliveryLocation/cac:Address/cbc:StreetName',
  'cac:Delivery/cac:DeliveryLocation/cac:Address/cbc:CityName', 'cac:Delivery/cac:DeliveryLocation/cac:Address/cbc:PostalZone',
  '*/cac:TaxCategory/cbc:ID', '*/cac:ClassifiedTaxCategory/cbc:ID', '*/cbc:Percent',
  'cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cbc:TaxExemptionReason',
  'cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cbc:TaxExemptionReasonCode',
  '*/@unitCode'
];

const zhoda = (vzor, c) => (vzor.startsWith('*/') ? c === vzor.slice(2) || c.endsWith(vzor.slice(1)) : c === vzor);

// ---------------------------------------------------------------- pomocky

/**
 * Skrati dlhy text na zobrazenie, s trojbodkou v strede, aby bolo vidiet zaciatok aj koniec
 * (pri CustomizationID sa verzie lisia prave na konci). Data sa neskracuju, len zobrazenie.
 */
export function skrat(text, max = 60) {
  const s = String(text == null ? '' : text);
  if (s.length <= max) return s;
  const koniec = Math.floor((max - 1) / 2);
  return s.slice(0, max - 1 - koniec) + '…' + s.slice(s.length - koniec);
}

/** Cislo z cisteho zapisu v XML (45.00, 6, 23), inak text tak, ako je, aby chyba ostala vidiet. */
function cis(t) {
  return CISLO.test(t) ? Number(t) : t;
}

function profilZ(cust) {
  // rovnake poradie ako zistiProfil v pravidla.mjs, aby formular a kontrola videli ten isty profil
  if (cust.startsWith(K.PROFILY.xrechnungPredpona)) return 'xrechnung';
  if (cust.startsWith('urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung')) return 'xrechnung';
  if (cust.startsWith(K.PROFILY.peppol)) return 'peppol';
  if (cust.startsWith(K.PROFILY.en16931)) return 'en16931';
  return '';
}

// Danova kategoria so schemou VAT, inak prva (rovnako ako nahlad.js).
function katVat(u, kluc) {
  const kandidati = deti(u, kluc);
  const sVat = kandidati.filter((k) => hod(k, 'cac:TaxScheme/cbc:ID').toUpperCase() === 'VAT');
  return sVat.length ? sVat[0] : (kandidati[0] || null);
}

function citajStranu(party) {
  const a = jeden(party, 'cac:PostalAddress');
  const ep = prve(party, 'cbc:EndpointID');
  const vat = deti(party, 'cac:PartyTaxScheme').find((x) => hod(x, 'cac:TaxScheme/cbc:ID').toUpperCase() === 'VAT');
  const pid = jeden(party, 'cac:PartyIdentification/cbc:ID');
  const s = {
    nazov: hod(party, 'cac:PartyLegalEntity/cbc:RegistrationName'),
    ico: hod(party, 'cac:PartyLegalEntity/cbc:CompanyID'),
    icDph: vat ? hod(vat, 'cbc:CompanyID') : '',
    ulica: hod(a, 'cbc:StreetName'),
    mesto: hod(a, 'cbc:CityName'),
    psc: hod(a, 'cbc:PostalZone'),
    krajina: hod(a, 'cac:Country/cbc:IdentificationCode'),
    email: hod(party, 'cac:Contact/cbc:ElectronicMail'),
    telefon: hod(party, 'cac:Contact/cbc:Telephone'),
    kontakt: hod(party, 'cac:Contact/cbc:Name'),
    endpoint: ep ? txt(ep) : '',
    endpointSchema: ep ? String(atr(ep, 'schemeID') || '').trim() : ''
  };
  // Udaje, ktore generator vie zapisat, ale formular na ne nema pole: len ked su v subore.
  const volitelne = {
    obchodneMeno: hod(party, 'cac:PartyName/cbc:Name'),
    ulica2: hod(a, 'cbc:AdditionalStreetName'),
    identifikator: pid ? txt(pid) : '',
    identifikatorSchema: pid ? String(atr(pid, 'schemeID') || '').trim() : ''
  };
  for (const k of Object.keys(volitelne)) if (volitelne[k]) s[k] = volitelne[k];
  return s;
}

// ---------------------------------------------------------------- citanie dokladu

function precitaj(koren, jazyk) {
  const jeDobropis = koren.local === 'CreditNote';
  const pm = prve(koren, 'cac:PaymentMeans');
  const ucet = jeden(pm, 'cac:PayeeFinancialAccount');
  const dodanie = prve(koren, 'cac:Delivery');
  const adresaDodania = jeden(dodanie, 'cac:DeliveryLocation/cac:Address');
  const obdobie = prve(koren, 'cac:InvoicePeriod');
  const predchadzajuca = jeden(koren, 'cac:BillingReference/cac:InvoiceDocumentReference');
  const sucty = prve(koren, 'cac:LegalMonetaryTotal');

  const dodavatel = citajStranu(jeden(koren, 'cac:AccountingSupplierParty/cac:Party'));
  dodavatel.iban = hod(ucet, 'cbc:ID');
  dodavatel.bic = hod(ucet, 'cac:FinancialInstitutionBranch/cbc:ID');
  const odberatel = citajStranu(jeden(koren, 'cac:AccountingCustomerParty/cac:Party'));

  // Splatnost: pri dobropise ju UBL 2.1 nesie v platobnych udajoch.
  const datumSplatnosti = hod(koren, 'cbc:DueDate') || (jeDobropis ? hod(pm, 'cbc:PaymentDueDate') : '');
  // Vetu "Splatnosť 2026-09-25" pise nas generator sam, ked pouzivatel podmienky nevyplni.
  // Taku vetu nechame prazdnu, aby sa pri zmene splatnosti vo formulari zmenila s nou.
  let platobnePodmienky = hod(koren, 'cac:PaymentTerms/cbc:Note');
  if (datumSplatnosti && platobnePodmienky === (TEXT_SPLATNOSTI[jazyk] + datumSplatnosti).trim()) platobnePodmienky = '';

  // Rozpis DPH: dovod oslobodenia moze byt len pri kategorii v rozpise, nie v riadku.
  const subtotaly = [];
  for (const tt of deti(koren, 'cac:TaxTotal')) {
    for (const ts of deti(tt, 'cac:TaxSubtotal')) {
      const k = katVat(ts, 'cac:TaxCategory');
      if (k) subtotaly.push({ kat: hod(k, 'cbc:ID'), sadzba: hod(k, 'cbc:Percent'), dovod: hod(k, 'cbc:TaxExemptionReason'), kod: hod(k, 'cbc:TaxExemptionReasonCode') });
    }
  }
  const sDovodom = new Set(PREDVOLENE_OSLOBODENIE.kategorie);
  const kodyKategorii = new Map();
  const zapisKod = (kat, kod) => {
    if (!sDovodom.has(kat)) return;
    if (!kodyKategorii.has(kat)) kodyKategorii.set(kat, new Set());
    if (kod) kodyKategorii.get(kat).add(kod);
  };
  for (const s of subtotaly) zapisKod(s.kat, s.kod);
  const rovnakaSadzba = (x, y) => String(cis(x)) === String(cis(y));

  const polozky = deti(koren, 'cac:InvoiceLine|cac:CreditNoteLine').map((r) => {
    const mn = prve(r, 'cbc:InvoicedQuantity|cbc:CreditedQuantity');
    const item = prve(r, 'cac:Item');
    const k = katVat(item, 'cac:ClassifiedTaxCategory');
    const kategoria = k ? hod(k, 'cbc:ID') : '';
    const sadzba = k ? hod(k, 'cbc:Percent') : '';
    const p = {
      nazov: hod(item, 'cbc:Name'),
      mnozstvo: cis(mn ? txt(mn) : ''),
      jednotka: mn ? String(atr(mn, 'unitCode') || '').trim() : '',
      cena: cis(hod(r, 'cac:Price/cbc:PriceAmount')),
      sadzba: cis(sadzba),
      kategoria
    };
    const popis = hod(item, 'cbc:Description');
    if (popis) p.popis = popis;
    if (sDovodom.has(kategoria)) {
      zapisKod(kategoria, k ? hod(k, 'cbc:TaxExemptionReasonCode') : '');
      const sub = subtotaly.find((s) => s.kat === kategoria && rovnakaSadzba(s.sadzba, sadzba));
      let dovod = (k ? hod(k, 'cbc:TaxExemptionReason') : '') || (sub ? sub.dovod : '');
      // predvoleny text generatora nechame prazdny, generator ho pri tej istej kategorii zapise znova
      if (dovod === PREDVOLENE_OSLOBODENIE.texty[kategoria]) dovod = '';
      if (dovod) p.dovodOslobodenia = dovod;
    }
    return p;
  });

  // Kod dovodu oslobodenia ma formular jeden na cely doklad. Prenesieme ho, len ked ho tak
  // da zapisat bez zmeny: vsade predvoleny (nechame prazdny), alebo vsade ten isty.
  let kodOslobodenia = '';
  const kategorie = [...kodyKategorii.keys()];
  const vsadePredvoleny = kategorie.every((kat) => [...kodyKategorii.get(kat)].every((kod) => kod === (PREDVOLENE_OSLOBODENIE.kody[kat] || '')));
  if (!vsadePredvoleny) {
    const vsetky = new Set();
    for (const kat of kategorie) for (const kod of kodyKategorii.get(kat)) vsetky.add(kod);
    if (vsetky.size === 1 && kategorie.every((kat) => kodyKategorii.get(kat).size === 1)) kodOslobodenia = [...vsetky][0];
  }

  const faktura = {
    typ: hod(koren, 'cbc:InvoiceTypeCode|cbc:CreditNoteTypeCode'),
    profil: profilZ(hod(koren, 'cbc:CustomizationID')),
    cislo: hod(koren, 'cbc:ID'),
    datumVystavenia: hod(koren, 'cbc:IssueDate'),
    datumDodania: hod(dodanie, 'cbc:ActualDeliveryDate'),
    datumSplatnosti,
    mena: hod(koren, 'cbc:DocumentCurrencyCode'),
    platobnePodmienky,
    poznamka: deti(koren, 'cbc:Note').map((n) => txt(n)).filter((t) => t !== '').join(' '),
    variabilnySymbol: hod(pm, 'cbc:PaymentID'),
    referenciaOdberatela: hod(koren, 'cbc:BuyerReference'),
    dodavatel,
    odberatel,
    sposobPlatby: hod(pm, 'cbc:PaymentMeansCode'),
    zaplatene: cis(hod(sucty, 'cbc:PrepaidAmount')),
    polozky
  };

  const proces = hod(koren, 'cbc:ProfileID');
  if (proces && proces !== K.PROFILY.peppolProces) faktura.proces = proces;
  const od = hod(obdobie, 'cbc:StartDate');
  const doDna = hod(obdobie, 'cbc:EndDate');
  if (od) faktura.obdobieOd = od;
  if (doDna) faktura.obdobieDo = doDna;
  const objednavka = hod(koren, 'cac:OrderReference/cbc:ID');
  if (objednavka) faktura.objednavka = objednavka;
  if (hod(predchadzajuca, 'cbc:ID')) {
    faktura.predchadzajucaFaktura = { cislo: hod(predchadzajuca, 'cbc:ID'), datum: hod(predchadzajuca, 'cbc:IssueDate') };
  }
  if (adresaDodania) {
    const m = {
      ulica: hod(adresaDodania, 'cbc:StreetName'),
      mesto: hod(adresaDodania, 'cbc:CityName'),
      psc: hod(adresaDodania, 'cbc:PostalZone'),
      krajina: hod(adresaDodania, 'cac:Country/cbc:IdentificationCode')
    };
    if (m.ulica || m.mesto || m.psc || m.krajina) faktura.miestoDodania = m;
  }
  if (kodOslobodenia) faktura.kodOslobodenia = kodOslobodenia;
  return faktura;
}

// ---------------------------------------------------------------- porovnanie so suborom

// Dobropis a faktura maju pre riadky ine mena prvkov; pri porovnani su jedno.
const PREMENUJ = {
  'cac:CreditNoteLine': 'cac:InvoiceLine',
  'cbc:CreditedQuantity': 'cbc:InvoicedQuantity',
  'cbc:CreditNoteTypeCode': 'cbc:InvoiceTypeCode'
};
// Poznamky dokladu riesime zvlast (formular ich spoji do jednej). UBLVersionID je technicky
// udaj bez obsahu faktury, Peppol ho nepouziva a generator ho nepise.
const VYNECHAJ = new Set(['cbc:Note', 'cbc:UBLVersionID']);

/** Listy stromu (prvky bez deti a atributy) s cestou bez indexov a s cislom riadku dokladu. */
function zber(koren) {
  const listy = [];
  const cesty = new Set();
  let riadok = 0;
  const zasobnik = [];
  for (let i = koren.deti.length - 1; i >= 0; i -= 1) zasobnik.push([koren.deti[i], '', 0]);
  while (zasobnik.length) {
    const [u, rodic, r0] = zasobnik.pop();
    const k = PREMENUJ[u.k] || u.k;
    if (!rodic && VYNECHAJ.has(k)) continue;
    const r = !rodic && k === 'cac:InvoiceLine' ? (riadok += 1) : r0;
    const c = rodic ? rodic + '/' + k : k;
    cesty.add(c);
    for (const a of Object.keys(u.atr)) {
      if (a === 'xmlns' || a.startsWith('xmlns:') || a.startsWith('xsi:')) continue;
      listy.push({ cesta: c + '/@' + a, hodnota: String(u.atr[a]).trim(), uzol: u, atr: a, riadok: r });
    }
    if (u.deti.length) {
      for (let i = u.deti.length - 1; i >= 0; i -= 1) zasobnik.push([u.deti[i], c, r]);
    } else {
      listy.push({ cesta: c, hodnota: txt(u), uzol: u, atr: '', riadok: r });
    }
  }
  return { listy, cesty };
}

function porovnaj(koren, faktura, jazyk) {
  const j = J[jazyk];
  const novy = parsujXml(vytvorUbl(faktura, { profil: faktura.profil || 'peppol', jazyk })).koren;
  const O = zber(koren);
  const R = zber(novy);

  // Sumy, mnozstva a sadzby porovnavame ako cisla (450 je to iste ako 450.00).
  const porovnatelna = (e) => (!e.atr && CISELNE_PRVKY.test(e.cesta) && CISLO.test(e.hodnota) ? String(Number(e.hodnota)) : e.hodnota);
  const kluc = (e) => e.riadok + '|' + e.cesta + '|' + porovnatelna(e);
  const klucCesty = (e) => e.riadok + '|' + e.cesta;

  // 1. rovnaky udaj na rovnakom mieste
  const podlaHodnoty = new Map();
  for (const e of R.listy) {
    const k = kluc(e);
    if (!podlaHodnoty.has(k)) podlaHodnoty.set(k, []);
    podlaHodnoty.get(k).push(e);
  }
  const zvysok = [];
  for (const e of O.listy) {
    const q = podlaHodnoty.get(kluc(e));
    if (q && q.length) q.pop().pouzity = true;
    else zvysok.push(e);
  }

  // 2. to iste miesto, ina hodnota = zmena; miesto, ktore nove XML nema = neprenesene
  const podlaCesty = new Map();
  for (const e of R.listy) {
    if (e.pouzity || e.hodnota === '') continue;
    const k = klucCesty(e);
    if (!podlaCesty.has(k)) podlaCesty.set(k, { q: [], i: 0 });
    podlaCesty.get(k).q.push(e);
  }
  const zmenene = [];
  const stratene = [];
  let prazdnych = deti(koren, 'cbc:Note').filter((n) => txt(n) === '').length;
  for (const e of zvysok) {
    if (e.hodnota === '') { prazdnych += 1; continue; }
    const z = podlaCesty.get(klucCesty(e));
    if (z && z.i < z.q.length) {
      const r = z.q[z.i];
      z.i += 1;
      r.pouzity = true;
      zmenene.push({ o: e, r });
    } else {
      stratene.push(e);
    }
  }
  const pridane = R.listy.filter((e) => !e.pouzity && e.hodnota !== '' && DOPLNENE.some((v) => zhoda(v, e.cesta)));

  // neprenesene: zoskupime podla prveho prvku, ktory nove XML vobec nema (priloha, zlava...)
  const ids = new Map();
  const idUzla = (u) => { if (!ids.has(u)) ids.set(u, ids.size + 1); return ids.get(u); };
  const skupiny = new Map();
  for (const e of stratene) {
    const seg = e.cesta.split('/');
    const prvkov = e.atr ? seg.length - 1 : seg.length;
    let n = seg.length;
    for (let i = 1; i <= prvkov; i += 1) {
      if (!R.cesty.has(seg.slice(0, i).join('/'))) { n = i; break; }
    }
    const kod = seg.slice(0, n).join('/');
    let id;
    if (n <= prvkov) {
      let u = e.uzol;
      for (let d = prvkov; d > n; d -= 1) u = u.rodic;
      id = 'u' + idUzla(u);
    } else {
      id = 'u' + idUzla(e.uzol) + '@' + e.atr;
    }
    let s = skupiny.get(kod);
    if (!s) { s = { kod, ids: new Set(), riadky: new Set(), priklad: '', list: n === seg.length }; skupiny.set(kod, s); }
    s.ids.add(id);
    if (e.riadok) s.riadky.add(e.riadok);
    if (s.list && !s.priklad) s.priklad = e.hodnota;
  }
  const neprenesene = [...skupiny.values()].map((s) => ({
    kod: s.kod,
    text: nazov(s.kod, j, s.riadky.size === 1 ? [...s.riadky][0] : 0),
    pocet: s.ids.size,
    priklad: s.list && s.ids.size === 1 ? s.priklad : ''
  }));

  // rozdiely
  const rozdiely = [];
  if (koren.local !== novy.local) {
    const veta = VETY.druh(koren.local, novy.local)[j];
    rozdiely.push({ druh: 'veta', kod: 'druh-dokladu', text: veta, veta, pocet: 1, vSubore: koren.local, formular: novy.local });
  }
  const skupinyR = new Map();
  const pridajRozdiel = (druh, e, vSubore, formular) => {
    const k = druh + '|' + e.cesta;
    let s = skupinyR.get(k);
    if (!s) { s = { druh, kod: e.cesta, pocet: 0, riadky: new Set(), vSubore, formular }; skupinyR.set(k, s); }
    s.pocet += 1;
    if (e.riadok) s.riadky.add(e.riadok);
  };
  for (const { o, r } of zmenene) pridajRozdiel('zmena', o, o.hodnota, r.hodnota);
  for (const r of pridane) pridajRozdiel('doplnene', r, '', r.hodnota);
  for (const s of skupinyR.values()) {
    rozdiely.push({
      druh: s.druh,
      kod: s.kod,
      text: nazov(s.kod, j, s.riadky.size === 1 ? [...s.riadky][0] : 0),
      veta: '',
      pocet: s.pocet,
      vSubore: s.vSubore,
      formular: s.formular
    });
  }
  const poznamok = deti(koren, 'cbc:Note').filter((n) => txt(n) !== '').length;
  if (poznamok > 1) {
    const veta = VETY.poznamky(poznamok)[j];
    rozdiely.push({ druh: 'veta', kod: 'poznamky', text: veta, veta, pocet: poznamok, vSubore: '', formular: '' });
  }
  if (prazdnych) {
    const veta = VETY.prazdne(prazdnych)[j];
    rozdiely.push({ druh: 'veta', kod: 'prazdne', text: veta, veta, pocet: prazdnych, vSubore: '', formular: '' });
  }

  // skryte: bolo v subore, ostane v XML, ale formular na to nema pole
  const skryte = [];
  for (const [vzor, texty] of SKRYTE) {
    for (const c of O.cesty) {
      if (zhoda(vzor, c) && R.cesty.has(c)) { skryte.push({ kod: vzor, text: texty[j] }); break; }
    }
  }

  return { neprenesene, rozdiely, skryte };
}

// ---------------------------------------------------------------- hlavna funkcia

function zlyhanie(kod, texty, jazyk) {
  return {
    ok: false,
    chyba: { kod, sk: texty.sk, cs: texty.cs, de: texty.de, en: texty.en, text: texty[jazyk] || texty.sk },
    faktura: null,
    neprenesene: [],
    rozdiely: [],
    skryte: []
  };
}

/**
 * Z UBL 2.1 XML (Invoice alebo CreditNote) urobi objekt faktury pre formular.
 * @param {string} xmlText obsah suboru
 * @param {{jazyk?: 'sk'|'cs'|'de'|'en'}} [volby] jazyk textov v zoznamoch a jazyk stranky,
 *   v ktorom generator pise nahradne platobne podmienky
 * @returns {{ok:boolean, chyba:null|{kod:string, sk:string, cs:string, de:string, en:string, text:string},
 *   faktura:object|null, neprenesene:Array<{kod:string, text:string, pocet:number, priklad:string}>,
 *   rozdiely:Array<{druh:'zmena'|'doplnene'|'veta', kod:string, text:string, veta:string, pocet:number,
 *   vSubore:string, formular:string}>, skryte:Array<{kod:string, text:string}>}}
 */
export function zUbl(xmlText, volby = {}) {
  const jazyk = volby && JAZYKY.includes(volby.jazyk) ? volby.jazyk : 'sk';
  let p;
  try { p = parsujXml(xmlText); } catch (e) { return zlyhanie('vnutorna', CHYBY.vnutorna, jazyk); }
  if (!p.ok) return zlyhanie('xml', p.chyba, jazyk);
  const koren = p.koren;
  if (koren.local === 'CrossIndustryInvoice') return zlyhanie('cii', CHYBY.cii, jazyk);
  if (koren.local !== 'Invoice' && koren.local !== 'CreditNote') return zlyhanie('koren', CHYBY.koren(skrat(koren.meno, 40)), jazyk);
  try {
    const faktura = precitaj(koren, jazyk);
    return Object.assign({ ok: true, chyba: null, faktura }, porovnaj(koren, faktura, jazyk));
  } catch (e) {
    return zlyhanie('vnutorna', CHYBY.vnutorna, jazyk);
  }
}
