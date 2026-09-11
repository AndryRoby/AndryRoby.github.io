// tests.mjs - testy validatora, generatora a nahladu e-faktury.
// Spustenie: node products/arling-sk/efaktura/tests.mjs
// Vsetky fixtury su nase vlastne, nie su prevzate z cudzich stranok ani z oficialnych prikladov.

import { skontroluj, protokol, IMPLEMENTOVANE, NEIMPLEMENTOVANE, platnyIban } from './pravidla.mjs';
import { parsujXml, txt, hod } from './parser.mjs';
import { vytvorUbl, prepocitaj, prazdnaFaktura, naCenty, zCentov } from './ubl.js';
import { vykresliNahlad, precitajDoklad } from './nahlad.js';
import * as K from './kodovniky.mjs';
import { readFileSync } from 'node:fs';

let prebehlo = 0;
let zlyhalo = 0;
const zlyhania = [];

function ok(popis, podmienka, detail) {
  prebehlo += 1;
  if (podmienka) return;
  zlyhalo += 1;
  zlyhania.push(popis + (detail ? '\n      ' + detail : ''));
}

function kody(vysledok, zavaznost) {
  return vysledok.nalezy.filter((n) => !zavaznost || n.zavaznost === zavaznost).map((n) => n.kod);
}

function vypisChyby(vysledok) {
  return vysledok.nalezy
    .filter((n) => n.zavaznost === 'chyba')
    .map((n) => n.kod + ': ' + n.sprava.sk + ' [' + n.xpath + ']')
    .join('\n      ');
}

// ---------------------------------------------------------------- fixtury

const MP =
  ' xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"' +
  ' xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"';

const IBAN_SK = 'SK3112000000198742637541';
const IBAN_DE = 'DE02120300000000202051';

function dodavatelSk() {
  return `  <cac:AccountingSupplierParty>
    <cac:Party>
      <cbc:EndpointID schemeID="0245">1234567890</cbc:EndpointID>
      <cac:PostalAddress>
        <cbc:StreetName>Slnecna 12</cbc:StreetName>
        <cbc:CityName>Bratislava</cbc:CityName>
        <cbc:PostalZone>81101</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>SK</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>SK2020000000</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>Vzorovy dodavatel s. r. o.</cbc:RegistrationName>
        <cbc:CompanyID>12345678</cbc:CompanyID>
      </cac:PartyLegalEntity>
      <cac:Contact>
        <cbc:Name>Jana Vzorova</cbc:Name>
        <cbc:Telephone>+421 900 123 456</cbc:Telephone>
        <cbc:ElectronicMail>fakturacia@vzor.sk</cbc:ElectronicMail>
      </cac:Contact>
    </cac:Party>
  </cac:AccountingSupplierParty>`;
}

function odberatelSk() {
  return `  <cac:AccountingCustomerParty>
    <cac:Party>
      <cbc:EndpointID schemeID="0245">9876543210</cbc:EndpointID>
      <cac:PostalAddress>
        <cbc:StreetName>Nadrazna 5</cbc:StreetName>
        <cbc:CityName>Kosice</cbc:CityName>
        <cbc:PostalZone>04001</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>SK</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>SK2023456789</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>Vzorovy odberatel a. s.</cbc:RegistrationName>
        <cbc:CompanyID>87654321</cbc:CompanyID>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>`;
}

// 1. spravna faktura (SK, Peppol BIS 3.0)
const F1_SPRAVNA = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"${MP}>
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>2026-0001</cbc:ID>
  <cbc:IssueDate>2026-09-11</cbc:IssueDate>
  <cbc:DueDate>2026-09-25</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:Note>Dakujeme za spolupracu.</cbc:Note>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cbc:BuyerReference>OBJ-2026-77</cbc:BuyerReference>
${dodavatelSk()}
${odberatelSk()}
  <cac:Delivery>
    <cbc:ActualDeliveryDate>2026-09-10</cbc:ActualDeliveryDate>
  </cac:Delivery>
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>58</cbc:PaymentMeansCode>
    <cbc:PaymentID>20260001</cbc:PaymentID>
    <cac:PayeeFinancialAccount>
      <cbc:ID>${IBAN_SK}</cbc:ID>
      <cbc:Name>Vzorovy dodavatel s. r. o.</cbc:Name>
    </cac:PayeeFinancialAccount>
  </cac:PaymentMeans>
  <cac:PaymentTerms>
    <cbc:Note>Splatnost 14 dni.</cbc:Note>
  </cac:PaymentTerms>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="EUR">46.00</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="EUR">200.00</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="EUR">46.00</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>23.00</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">200.00</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="EUR">200.00</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">246.00</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="EUR">246.00</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  <cac:InvoiceLine>
    <cbc:ID>1</cbc:ID>
    <cbc:InvoicedQuantity unitCode="HUR">10</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="EUR">150.00</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>Programatorske prace</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>23.00</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="EUR">15.00</cbc:PriceAmount></cac:Price>
  </cac:InvoiceLine>
  <cac:InvoiceLine>
    <cbc:ID>2</cbc:ID>
    <cbc:InvoicedQuantity unitCode="C62">2</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="EUR">50.00</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>Licencia na nastroj</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>23.00</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="EUR">25.00</cbc:PriceAmount></cac:Price>
  </cac:InvoiceLine>
</Invoice>
`;

// 2. dobropis
const F2_DOBROPIS = `<?xml version="1.0" encoding="UTF-8"?>
<CreditNote xmlns="urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2"${MP}>
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>2026-D001</cbc:ID>
  <cbc:IssueDate>2026-09-12</cbc:IssueDate>
  <cbc:CreditNoteTypeCode>381</cbc:CreditNoteTypeCode>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cbc:BuyerReference>OBJ-2026-77</cbc:BuyerReference>
  <cac:BillingReference>
    <cac:InvoiceDocumentReference>
      <cbc:ID>2026-0001</cbc:ID>
      <cbc:IssueDate>2026-09-11</cbc:IssueDate>
    </cac:InvoiceDocumentReference>
  </cac:BillingReference>
${dodavatelSk()}
${odberatelSk()}
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>58</cbc:PaymentMeansCode>
    <cac:PayeeFinancialAccount><cbc:ID>${IBAN_SK}</cbc:ID></cac:PayeeFinancialAccount>
  </cac:PaymentMeans>
  <cac:PaymentTerms>
    <cbc:Note>Dobropis k fakture 2026-0001.</cbc:Note>
  </cac:PaymentTerms>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="EUR">11.50</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="EUR">50.00</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="EUR">11.50</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>23.00</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">50.00</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="EUR">50.00</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">61.50</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="EUR">61.50</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  <cac:CreditNoteLine>
    <cbc:ID>1</cbc:ID>
    <cbc:CreditedQuantity unitCode="C62">2</cbc:CreditedQuantity>
    <cbc:LineExtensionAmount currencyID="EUR">50.00</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>Licencia na nastroj, vratenie</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>23.00</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="EUR">25.00</cbc:PriceAmount></cac:Price>
  </cac:CreditNoteLine>
</CreditNote>
`;

// 3. chybajuce povinne prvky
const F3_CHYBAJUCE = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"${MP}>
  <cbc:CustomizationID>urn:cen.eu:en16931:2017</cbc:CustomizationID>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyLegalEntity><cbc:RegistrationName>Dodavatel bez udajov</cbc:RegistrationName></cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
</Invoice>
`;

// 4. zly sucet: DPH a suma s DPH nesedia
function fZlySucet() {
  return F1_SPRAVNA.replace('<cbc:TaxInclusiveAmount currencyID="EUR">246.00</cbc:TaxInclusiveAmount>',
    '<cbc:TaxInclusiveAmount currencyID="EUR">250.00</cbc:TaxInclusiveAmount>');
}

// 5. zla mena
function fZlaMena() {
  return F1_SPRAVNA.replace('<cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>',
    '<cbc:DocumentCurrencyCode>EURO</cbc:DocumentCurrencyCode>');
}

// 6. zly IBAN
function fZlyIban() {
  return F1_SPRAVNA.replace(IBAN_SK, 'SK3112000000198742637500');
}

// 7. zla kategoria DPH v riadku
function fZlaKategoria() {
  return F1_SPRAVNA.replace('<cbc:ID>S</cbc:ID>\n        <cbc:Percent>23.00</cbc:Percent>\n        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>\n      </cac:ClassifiedTaxCategory>',
    '<cbc:ID>SS</cbc:ID>\n        <cbc:Percent>23.00</cbc:Percent>\n        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>\n      </cac:ClassifiedTaxCategory>');
}

// 8. XRechnung bez referencie odberatela
const F8_XRECHNUNG = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"${MP}>
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>DE-2026-9</cbc:ID>
  <cbc:IssueDate>2026-09-11</cbc:IssueDate>
  <cbc:DueDate>2026-09-25</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cbc:EndpointID schemeID="9930">DE123456789</cbc:EndpointID>
      <cac:PostalAddress>
        <cbc:StreetName>Hauptstrasse 3</cbc:StreetName>
        <cbc:CityName>Berlin</cbc:CityName>
        <cbc:PostalZone>10115</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>DE123456789</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity><cbc:RegistrationName>Muster Verkaeufer GmbH</cbc:RegistrationName></cac:PartyLegalEntity>
      <cac:Contact>
        <cbc:Name>Max Muster</cbc:Name>
        <cbc:Telephone>+49 30 123456</cbc:Telephone>
        <cbc:ElectronicMail>rechnung@muster.de</cbc:ElectronicMail>
      </cac:Contact>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cbc:EndpointID schemeID="0204">04011000-12345-34</cbc:EndpointID>
      <cac:PostalAddress>
        <cbc:StreetName>Amtsweg 1</cbc:StreetName>
        <cbc:CityName>Bonn</cbc:CityName>
        <cbc:PostalZone>53111</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyLegalEntity><cbc:RegistrationName>Muster Amt</cbc:RegistrationName></cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:Delivery><cbc:ActualDeliveryDate>2026-09-10</cbc:ActualDeliveryDate></cac:Delivery>
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>58</cbc:PaymentMeansCode>
    <cac:PayeeFinancialAccount><cbc:ID>${IBAN_DE}</cbc:ID></cac:PayeeFinancialAccount>
  </cac:PaymentMeans>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="EUR">19.00</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="EUR">100.00</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="EUR">19.00</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>19.00</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">100.00</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="EUR">100.00</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">119.00</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="EUR">119.00</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  <cac:InvoiceLine>
    <cbc:ID>1</cbc:ID>
    <cbc:InvoicedQuantity unitCode="C62">1</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="EUR">100.00</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>Beratungsleistung</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>19.00</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="EUR">100.00</cbc:PriceAmount></cac:Price>
  </cac:InvoiceLine>
</Invoice>
`;

// 9. CII subor
const F9_CII = `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100">
  <rsm:ExchangedDocument>
    <ram:ID>CII-2026-1</ram:ID>
  </rsm:ExchangedDocument>
</rsm:CrossIndustryInvoice>
`;

// 10. nie je to XML
const F10_NIE_XML = 'Toto je obycajny text, nie faktura. Cislo 2026-0001, suma 246 EUR.';

// 11. prazdny subor
const F11_PRAZDNY = '   \n  ';

// 12. obrovsky subor
function fObrovsky(pocet) {
  const riadky = [];
  let centy = 0;
  for (let i = 1; i <= pocet; i += 1) {
    const cenaCentov = 100 + (i % 37);
    centy += cenaCentov;
    riadky.push(`  <cac:InvoiceLine>
    <cbc:ID>${i}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="C62">1</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="EUR">${zCentov(cenaCentov)}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>Polozka cislo ${i}</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>23.00</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="EUR">${zCentov(cenaCentov)}</cbc:PriceAmount></cac:Price>
  </cac:InvoiceLine>`);
  }
  const dan = naCenty((centy / 100) * 0.23);
  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"${MP}>
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>2026-VELKA</cbc:ID>
  <cbc:IssueDate>2026-09-11</cbc:IssueDate>
  <cbc:DueDate>2026-10-11</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cbc:BuyerReference>OBJ-VELKA</cbc:BuyerReference>
${dodavatelSk()}
${odberatelSk()}
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>58</cbc:PaymentMeansCode>
    <cac:PayeeFinancialAccount><cbc:ID>${IBAN_SK}</cbc:ID></cac:PayeeFinancialAccount>
  </cac:PaymentMeans>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="EUR">${zCentov(dan)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="EUR">${zCentov(centy)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="EUR">${zCentov(dan)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>23.00</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">${zCentov(centy)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="EUR">${zCentov(centy)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">${zCentov(centy + dan)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="EUR">${zCentov(centy + dan)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
${riadky.join('\n')}
</Invoice>
`;
}

// ---------------------------------------------------------------- maly DOM pre testy nahladu

function malyDom() {
  const vyrob = (meno) => {
    const uzol = {
      meno,
      className: '',
      _vlastnyText: '',
      deti: [],
      atr: {},
      appendChild(d) { this.deti.push(d); return d; },
      removeChild(d) {
        const i = this.deti.indexOf(d);
        if (i >= 0) this.deti.splice(i, 1);
        return d;
      },
      setAttribute(k, v) { this.atr[k] = v; },
      get firstChild() { return this.deti.length ? this.deti[0] : null; },
      set textContent(v) { this._vlastnyText = String(v); this.deti = []; },
      get textContent() {
        return this._vlastnyText + this.deti.map((d) => d.textContent).join(' ');
      }
    };
    return uzol;
  };
  return { createElement: vyrob, createTextNode: (t) => { const u = vyrob('#text'); u.textContent = t; return u; } };
}

// ---------------------------------------------------------------- testy

console.log('Testy e-faktury\n');

// --- fixtura 1
{
  const v = skontroluj(F1_SPRAVNA);
  ok('1. spravna SK faktura: profil Peppol', v.profil === 'peppol', 'profil=' + v.profil);
  ok('1. spravna SK faktura: typ Invoice', v.typ === 'Invoice');
  ok('1. spravna SK faktura: ziadna chyba', v.sumar.chyby === 0, vypisChyby(v));
}

// --- fixtura 2
{
  const v = skontroluj(F2_DOBROPIS);
  ok('2. dobropis: typ CreditNote', v.typ === 'CreditNote');
  ok('2. dobropis: ziadna chyba', v.sumar.chyby === 0, vypisChyby(v));
}

// --- fixtura 3
{
  const v = skontroluj(F3_CHYBAJUCE);
  const k = kody(v, 'chyba');
  for (const ocakavany of ['BR-02', 'BR-03', 'BR-04', 'BR-05', 'BR-07', 'BR-08', 'BR-10', 'BR-16', 'BR-CO-18', 'BR-CO-26']) {
    ok('3. chybajuce prvky: hlasi ' + ocakavany, k.includes(ocakavany), 'nasli sme: ' + k.join(', '));
  }
  ok('3. chybajuce prvky: chyby su aspon 10', v.sumar.chyby >= 10, 'chyb=' + v.sumar.chyby);
}

// --- fixtura 4
{
  const v = skontroluj(fZlySucet());
  const k = kody(v, 'chyba');
  ok('4. zly sucet: hlasi BR-CO-15', k.includes('BR-CO-15'), k.join(', '));
  ok('4. zly sucet: hlasi BR-CO-16', k.includes('BR-CO-16'), k.join(', '));
}

// --- fixtura 5
{
  const v = skontroluj(fZlaMena());
  const k = kody(v, 'chyba');
  ok('5. zla mena: hlasi BR-CL-04', k.includes('BR-CL-04'), k.join(', '));
}

// --- fixtura 6
{
  const v = skontroluj(fZlyIban());
  const k = kody(v, 'chyba');
  ok('6. zly IBAN: hlasi ARL-IBAN', k.includes('ARL-IBAN'), k.join(', '));
  const nalez = v.nalezy.find((n) => n.kod === 'ARL-IBAN');
  ok('6. zly IBAN: sprava obsahuje mod 97', nalez && nalez.sprava.sk.includes('mod 97'));
}

// --- fixtura 7
{
  const v = skontroluj(fZlaKategoria());
  const k = kody(v, 'chyba');
  ok('7. zla kategoria DPH: hlasi BR-CL-18', k.includes('BR-CL-18'), k.join(', '));
}

// --- fixtura 8
{
  const v = skontroluj(F8_XRECHNUNG);
  ok('8. XRechnung: profil xrechnung', v.profil === 'xrechnung', 'profil=' + v.profil);
  const k = kody(v, 'chyba');
  ok('8. XRechnung bez BuyerReference: hlasi BR-DE-15', k.includes('BR-DE-15'), k.join(', '));
  ok('8. XRechnung: iba tato chyba', v.sumar.chyby === 1, vypisChyby(v));
}

// --- fixtura 9
{
  const v = skontroluj(F9_CII);
  ok('9. CII: typ CII', v.typ === 'CII');
  ok('9. CII: hlasi CII-01', kody(v).includes('CII-01'));
  const n = v.nalezy[0];
  ok('9. CII: presna veta o UBL', n.sprava.sk.includes('CII') && n.sprava.sk.includes('UBL 2.1'), n.sprava.sk);
  ok('9. CII: veta aj po nemecky', n.sprava.de.includes('CII-Syntax'), n.sprava.de);
}

// --- fixtura 10
{
  const v = skontroluj(F10_NIE_XML);
  ok('10. nie XML: hlasi XML-01', kody(v).includes('XML-01'), kody(v).join(', '));
  ok('10. nie XML: dobreTvarovane je false', v.sumar.dobreTvarovane === false);
}

// --- fixtura 11
{
  const v = skontroluj(F11_PRAZDNY);
  ok('11. prazdny subor: hlasi XML-01', kody(v).includes('XML-01'));
  ok('11. prazdny subor: sprava hovori o prazdnom subore', v.nalezy[0].sprava.sk.toLowerCase().includes('prazdny'));
}

// --- fixtura 12
{
  const xml = fObrovsky(1500);
  const zaciatok = Date.now();
  const v = skontroluj(xml);
  const trvanie = Date.now() - zaciatok;
  ok('12. obrovsky subor: 1500 riadkov bez chyby', v.sumar.chyby === 0, vypisChyby(v).slice(0, 600));
  ok('12. obrovsky subor: kontrola do 15 sekund', trvanie < 15000, 'trvalo ' + trvanie + ' ms');
  console.log('   (obrovsky subor: ' + Math.round(xml.length / 1024) + ' kB, kontrola ' + trvanie + ' ms)');
}

// --- nespravne tvarovane XML
{
  const v = skontroluj('<Invoice><cbc:ID>1</cbc:ID></Faktura>');
  ok('13. neuzavrete znacky: hlasi XML-01', kody(v).includes('XML-01'), kody(v).join(', '));
}

// --- generator pre SK, DE a CZ
function fakturaSk() {
  return {
    typ: '380', profil: 'peppol', cislo: 'SK-2026-100',
    datumVystavenia: '2026-09-11', datumDodania: '2026-09-10', datumSplatnosti: '2026-09-25',
    mena: 'EUR', referenciaOdberatela: 'OBJ-1', variabilnySymbol: '2026100',
    poznamka: 'Fakturujeme podla zmluvy.',
    dodavatel: {
      nazov: 'ARLing vzor s. r. o.', ico: '11223344', icDph: 'SK1122334455',
      ulica: 'Slnecna 12', mesto: 'Bratislava', psc: '81101', krajina: 'SK',
      kontakt: 'Jana Vzorova', telefon: '+421 900 123 456', email: 'fakturacia@vzor.sk',
      iban: IBAN_SK, endpoint: '1122334455', endpointSchema: '0245'
    },
    odberatel: {
      nazov: 'Odberatel SK a. s.', ico: '99887766', icDph: 'SK9988776655',
      ulica: 'Nadrazna 5', mesto: 'Kosice', psc: '04001', krajina: 'SK',
      endpoint: '9988776655', endpointSchema: '0245'
    },
    sposobPlatby: '58',
    polozky: [
      { nazov: 'Konzultacie', mnozstvo: 7, jednotka: 'HUR', cena: 45, sadzba: 23, kategoria: 'S' },
      { nazov: 'Kniha', mnozstvo: 3, jednotka: 'C62', cena: 12.9, sadzba: 5, kategoria: 'S' }
    ]
  };
}

function fakturaDe() {
  const f = fakturaSk();
  return Object.assign(f, {
    profil: 'xrechnung', cislo: 'DE-2026-100', mena: 'EUR',
    referenciaOdberatela: '04011000-12345-34',
    dodavatel: Object.assign({}, f.dodavatel, {
      nazov: 'Muster Verkaeufer GmbH', icDph: 'DE123456789', krajina: 'DE',
      ulica: 'Hauptstrasse 3', mesto: 'Berlin', psc: '10115',
      email: 'rechnung@muster.de', telefon: '+49 30 123456', kontakt: 'Max Muster',
      iban: IBAN_DE, endpoint: 'DE123456789', endpointSchema: '9930'
    }),
    odberatel: Object.assign({}, f.odberatel, {
      nazov: 'Muster Amt', icDph: '', krajina: 'DE',
      ulica: 'Amtsweg 1', mesto: 'Bonn', psc: '53111',
      endpoint: '04011000-12345-34', endpointSchema: '0204'
    }),
    polozky: [
      { nazov: 'Beratungsleistung', mnozstvo: 4, jednotka: 'HUR', cena: 95, sadzba: 19, kategoria: 'S' },
      { nazov: 'Handbuch', mnozstvo: 2, jednotka: 'C62', cena: 24.5, sadzba: 7, kategoria: 'S' }
    ]
  });
}

function fakturaCz() {
  const f = fakturaSk();
  return Object.assign(f, {
    profil: 'peppol', cislo: 'CZ-2026-100', mena: 'CZK',
    dodavatel: Object.assign({}, f.dodavatel, {
      nazov: 'Vzorovy dodavatel s. r. o.', icDph: 'CZ12345678', krajina: 'CZ',
      ulica: 'Dlouha 7', mesto: 'Praha', psc: '11000',
      iban: 'CZ6508000000192000145399', endpoint: '0001234567895', endpointSchema: '0088'
    }),
    odberatel: Object.assign({}, f.odberatel, {
      nazov: 'Odberatel CZ s. r. o.', icDph: 'CZ87654321', krajina: 'CZ',
      ulica: 'Kratka 2', mesto: 'Brno', psc: '60200',
      endpoint: '0001234567901', endpointSchema: '0088'
    }),
    polozky: [
      { nazov: 'Sluzby', mnozstvo: 5, jednotka: 'HUR', cena: 1200, sadzba: 21, kategoria: 'S' },
      { nazov: 'Prirucka', mnozstvo: 1, jednotka: 'C62', cena: 349, sadzba: 12, kategoria: 'S' }
    ]
  });
}

for (const [meno, faktura] of [['SK', fakturaSk()], ['DE', fakturaDe()], ['CZ', fakturaCz()]]) {
  const xml = vytvorUbl(faktura);
  const v = skontroluj(xml);
  ok('14. generator ' + meno + ': vygenerovane XML je bez chyby', v.sumar.chyby === 0, vypisChyby(v));
  ok('14. generator ' + meno + ': spravny profil', v.profil === (faktura.profil === 'xrechnung' ? 'xrechnung' : 'peppol'), 'profil=' + v.profil);
}

// --- dobropis z generatora
{
  const f = fakturaSk();
  f.typ = '381';
  f.cislo = 'SK-2026-D1';
  f.predchadzajucaFaktura = { cislo: 'SK-2026-100', datum: '2026-09-11' };
  const xml = vytvorUbl(f);
  const v = skontroluj(xml);
  ok('15. generator dobropis: bez chyby', v.sumar.chyby === 0, vypisChyby(v));
  ok('15. generator dobropis: typ CreditNote', v.typ === 'CreditNote');
}

// --- generator s prenesenim danovej povinnosti a s dodanim do EU
{
  const f = fakturaSk();
  f.cislo = 'SK-2026-AE';
  f.polozky = [{ nazov: 'Stavebne prace', mnozstvo: 1, jednotka: 'C62', cena: 1000, sadzba: 0, kategoria: 'AE' }];
  const v = skontroluj(vytvorUbl(f));
  ok('16. generator prenesenie danovej povinnosti: bez chyby', v.sumar.chyby === 0, vypisChyby(v));

  const g = fakturaSk();
  g.cislo = 'SK-2026-IC';
  g.odberatel = Object.assign({}, g.odberatel, { krajina: 'AT', icDph: 'ATU12345678', mesto: 'Wien', psc: '1010' });
  g.polozky = [{ nazov: 'Tovar do Rakuska', mnozstvo: 2, jednotka: 'C62', cena: 500, sadzba: 0, kategoria: 'K' }];
  const w = skontroluj(vytvorUbl(g));
  ok('16. generator dodanie do EU: bez chyby', w.sumar.chyby === 0, vypisChyby(w));
}

// --- sucty na haliere
{
  const f = fakturaSk();
  f.polozky = [
    { nazov: 'A', mnozstvo: 3, jednotka: 'C62', cena: 33.33, sadzba: 23, kategoria: 'S' },
    { nazov: 'B', mnozstvo: 7, jednotka: 'C62', cena: 1.015, sadzba: 23, kategoria: 'S' },
    { nazov: 'C', mnozstvo: 1, jednotka: 'C62', cena: 0.005, sadzba: 5, kategoria: 'S' }
  ];
  const v = prepocitaj(f);
  ok('17. sucty: riadok 3 x 33.33 je 99.99', v.riadky[0].centy === 9999, String(v.riadky[0].centy));
  ok('17. sucty: riadok 7 x 1.015 je 7.11', v.riadky[1].centy === 711, String(v.riadky[1].centy));
  ok('17. sucty: riadok 1 x 0.005 je 0.01', v.riadky[2].centy === 1, String(v.riadky[2].centy));
  ok('17. sucty: zaklad je 107.11', v.zakladCenty === 9999 + 711 + 1, String(v.zakladCenty));
  const dph23 = naCenty(((9999 + 711) / 100) * 0.23);
  const dph5 = naCenty((1 / 100) * 0.05);
  ok('17. sucty: DPH spolu sedi', v.danCenty === dph23 + dph5, v.danCenty + ' vs ' + (dph23 + dph5));
  ok('17. sucty: s DPH je zaklad plus DPH', v.sDphCenty === v.zakladCenty + v.danCenty);
  ok('17. sucty: na uhradu je s DPH', v.naUhraduCenty === v.sDphCenty);

  const xml = vytvorUbl(f);
  const vy = skontroluj(xml);
  ok('17. sucty: vygenerovane XML prejde kontrolou', vy.sumar.chyby === 0, vypisChyby(vy));
  ok('17. sucty: v XML je LineExtensionAmount 107.11', xml.includes('<cbc:LineExtensionAmount currencyID="EUR">107.11</cbc:LineExtensionAmount>'));
}

// --- zaloha a suma na uhradu
{
  const f = fakturaSk();
  f.zaplatene = 100;
  const v = prepocitaj(f);
  const xml = vytvorUbl(f);
  const vy = skontroluj(xml);
  ok('18. zaloha: na uhradu je s DPH minus zaloha', v.naUhraduCenty === v.sDphCenty - 10000, String(v.naUhraduCenty));
  ok('18. zaloha: XML prejde kontrolou', vy.sumar.chyby === 0, vypisChyby(vy));
}

// --- roundtrip nahladu
{
  const f = fakturaSk();
  f.polozky = [
    { nazov: 'Konzultacie k e-fakture', mnozstvo: 7, jednotka: 'HUR', cena: 45, sadzba: 23, kategoria: 'S' },
    { nazov: 'Kniha o UBL', mnozstvo: 3, jednotka: 'C62', cena: 12.9, sadzba: 5, kategoria: 'S' },
    { nazov: 'Doprava', mnozstvo: 1, jednotka: 'C62', cena: 9.9, sadzba: 23, kategoria: 'S' }
  ];
  const xml = vytvorUbl(f);
  const p = parsujXml(xml);
  ok('19. nahlad: XML sa da rozparsovat', p.ok === true, p.ok ? '' : p.chyba.sk);

  const dok = malyDom();
  const ciel = dok.createElement('div');
  const D = vykresliNahlad(p.koren, ciel, 'sk', dok);
  const text = ciel.textContent;

  ok('19. nahlad: precitalo vsetky polozky', D.riadky.length === 3, 'riadkov=' + D.riadky.length);
  for (const pol of f.polozky) {
    ok('19. nahlad obsahuje polozku ' + pol.nazov, text.includes(pol.nazov), '');
  }
  ok('19. nahlad obsahuje cislo faktury', text.includes('SK-2026-100'));
  ok('19. nahlad obsahuje dodavatela', text.includes('ARLing vzor s. r. o.'));
  ok('19. nahlad obsahuje odberatela', text.includes('Odberatel SK a. s.'));
  ok('19. nahlad obsahuje IBAN', text.includes(IBAN_SK));
  ok('19. nahlad obsahuje sumu na uhradu', text.includes('Na úhradu'));
  const v = prepocitaj(f);
  ok('19. nahlad obsahuje spravnu sumu', text.includes(zCentov(v.sDphCenty)), zCentov(v.sDphCenty));

  const cielDe = dok.createElement('div');
  vykresliNahlad(p.koren, cielDe, 'de', dok);
  ok('19. nahlad po nemecky ma nemecke nadpisy', cielDe.textContent.includes('Fälliger Betrag'));

  // vykreslenie dvakrat do toho isteho ciela nesmie zdvojit obsah
  const pocetPred = ciel.deti.length;
  vykresliNahlad(p.koren, ciel, 'sk', dok);
  ok('19. nahlad: opakovane vykreslenie nezdvoji obsah', ciel.deti.length === pocetPred, ciel.deti.length + ' vs ' + pocetPred);
}

// --- nahlad nespusta cudzi obsah ako HTML
{
  const f = fakturaSk();
  f.polozky = [{ nazov: '<img src=x onerror=alert(1)> & "uvodzovky"', mnozstvo: 1, jednotka: 'C62', cena: 1, sadzba: 23, kategoria: 'S' }];
  const xml = vytvorUbl(f);
  ok('20. generator unika znaky', xml.includes('&lt;img src=x onerror=alert(1)&gt; &amp; &quot;uvodzovky&quot;'), '');
  const p = parsujXml(xml);
  const dok = malyDom();
  const ciel = dok.createElement('div');
  vykresliNahlad(p.koren, ciel, 'sk', dok);
  ok('20. nahlad vrati text, nie HTML', ciel.textContent.includes('<img src=x onerror=alert(1)>'), '');
}

// --- IBAN mod 97
{
  ok('21. IBAN: platny SK prejde', platnyIban(IBAN_SK) === true);
  ok('21. IBAN: platny DE prejde', platnyIban(IBAN_DE) === true);
  ok('21. IBAN: s medzerami prejde', platnyIban('SK31 1200 0000 1987 4263 7541') === true);
  ok('21. IBAN: zmenena cislica neprejde', platnyIban('SK3112000000198742637542') === false);
  ok('21. IBAN: nezmysel neprejde', platnyIban('ABC') === false);
}

// --- kazdy nalez ma vsetky styri jazyky a nepouziva pomlcky
{
  const vzorky = [F1_SPRAVNA, F2_DOBROPIS, F3_CHYBAJUCE, fZlySucet(), fZlaMena(), fZlyIban(),
    fZlaKategoria(), F8_XRECHNUNG, F9_CII, F10_NIE_XML, F11_PRAZDNY];
  let bezJazyka = 0;
  let sPomlckou = 0;
  let bezXpath = 0;
  let spolu = 0;
  for (const x of vzorky) {
    for (const n of skontroluj(x).nalezy) {
      spolu += 1;
      if (!n.sprava.sk || !n.sprava.cs || !n.sprava.de || !n.sprava.en) bezJazyka += 1;
      if (/[–—]/.test(n.sprava.sk + n.sprava.cs + n.sprava.de + n.sprava.en)) sPomlckou += 1;
      if (!n.xpath) bezXpath += 1;
      if (!n.kod || !n.zavaznost) bezJazyka += 1;
    }
  }
  ok('22. vsetky nalezy maju sk, cs, de aj en', bezJazyka === 0, 'chybnych=' + bezJazyka + ' zo ' + spolu);
  // anglicka sprava nema prepadnut do slovenciny alebo cestiny: hladame diakritiku, ktoru anglictina nepozna
  const DIAKRITIKA = /[áäčďéěíľĺňóôřŕšťúůýžÁÄČĎÉĚÍĽĹŇÓÔŘŔŠŤÚŮÝŽ]/;
  let slovenske = 0;
  const ukazky = [];
  for (const x of vzorky) {
    for (const n of skontroluj(x).nalezy) {
      if (DIAKRITIKA.test(n.sprava.en)) { slovenske += 1; if (ukazky.length < 3) ukazky.push(n.kod + ': ' + n.sprava.en.slice(0, 90)); }
    }
  }
  ok('22. anglicka sprava neprepadne do slovenciny', slovenske === 0, ukazky.join(' | '));
  ok('22. ziadny text nema dlhu pomlcku', sPomlckou === 0, 'najdenych=' + sPomlckou);
  ok('22. vsetky nalezy maju XPath', bezXpath === 0, 'chybnych=' + bezXpath);
  console.log('   (skontrolovanych nalezov: ' + spolu + ')');
}

// --- citacia povodneho znenia pravidla
{
  const v = skontroluj(F3_CHYBAJUCE);
  const br02 = v.nalezy.find((n) => n.kod === 'BR-02');
  ok('23. nalez nesie povodne znenie pravidla', br02 && br02.original.includes('[BR-02]'), br02 ? br02.original : 'chyba nalez');
  const de15 = skontroluj(F8_XRECHNUNG).nalezy.find((n) => n.kod === 'BR-DE-15');
  ok('23. BR-DE-15 nesie nemecke znenie', de15 && de15.original.includes('BR-DE-15'), de15 ? de15.original : 'chyba nalez');
}

// --- protokol
{
  const v = skontroluj(fZlySucet());
  for (const jazyk of ['sk', 'cs', 'de']) {
    const t = protokol(v, jazyk, 'faktura.xml');
    ok('24. protokol ' + jazyk + ': obsahuje kod pravidla', t.includes('BR-CO-15'));
    ok('24. protokol ' + jazyk + ': obsahuje upozornenie o neuplnosti', t.length > 200 && /nie je úplná|není úplná|keine vollständige/.test(t));
  }
}

// --- vynutenie profilu
{
  const v = skontroluj(F1_SPRAVNA, { profil: 'xrechnung' });
  ok('25. vynuteny profil xrechnung: hlasi BR-DE-21', kody(v).includes('BR-DE-21'), kody(v).join(', '));
}

// --- neznamy profil
{
  const x = F1_SPRAVNA.replace('urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0', 'urn:nieco:ine');
  const v = skontroluj(x);
  ok('26. neznamy profil: hlasi ARL-PROFIL', kody(v).includes('ARL-PROFIL'), kody(v).join(', '));
  ok('26. neznamy profil: spadne na EN 16931', v.profil === 'en16931', v.profil);
}

// --- kodovniky
{
  ok('27. kodovniky: EUR je platna mena', K.platnaMena('EUR') === true);
  ok('27. kodovniky: EURO nie je platna mena', K.platnaMena('EURO') === false);
  ok('27. kodovniky: C62 je platna jednotka', K.platnaJednotka('C62') === true);
  ok('27. kodovniky: KUS nie je platna jednotka', K.platnaJednotka('KUS') === false);
  ok('27. kodovniky: SK je platna krajina', K.platnaKrajina('SK') === true);
  ok('27. kodovniky: 0245 je v zozname EAS', K.EAS.has('0245') && K.EAS_PEPPOL.has('0245'));
  ok('27. kodovniky: 9930 je v zozname EAS', K.EAS.has('9930') && K.EAS_PEPPOL.has('9930'));
  ok('27. kodovniky: 0204 je v zozname EAS', K.EAS.has('0204') && K.EAS_PEPPOL.has('0204'));
  ok('27. kodovniky: 0088 je v zozname EAS', K.EAS.has('0088') && K.EAS_PEPPOL.has('0088'));
  ok('27. kodovniky: 380 je typ faktury', K.UNTDID_1001_FAKTURA.has('380'));
  ok('27. kodovniky: 381 je typ dobropisu', K.UNTDID_1001_DOBROPIS.has('381'));
  ok('27. kodovniky: nazov jednotky po nemecky', K.nazovJednotky('HUR', 'de') === 'Stunde');
  ok('27. kodovniky: nazov kategorie po cesky', K.nazovKategorieDph('AE', 'cs').length > 0);
}

// --- zoznamy pravidiel
{
  ok('28. zoznam implementovanych nie je prazdny', IMPLEMENTOVANE.length > 250, String(IMPLEMENTOVANE.length));
  ok('28. zoznam implementovanych je bez duplicit', new Set(IMPLEMENTOVANE).size === IMPLEMENTOVANE.length,
    'duplicit=' + (IMPLEMENTOVANE.length - new Set(IMPLEMENTOVANE).size));
  ok('28. zoznam neimplementovanych ma dovody', NEIMPLEMENTOVANE.every((x) => x.kod && x.dovod));
  console.log('   (implementovanych kodov: ' + IMPLEMENTOVANE.length + ', skupin neimplementovanych: ' + NEIMPLEMENTOVANE.length + ')');
}

// --- kontrola, ze vsetky kody, ktore validator naozaj hlasi, su v zozname IMPLEMENTOVANE
{
  const zoznam = new Set(IMPLEMENTOVANE);
  const chybajuce = new Set();
  const vzorky = [F1_SPRAVNA, F2_DOBROPIS, F3_CHYBAJUCE, fZlySucet(), fZlaMena(), fZlyIban(),
    fZlaKategoria(), F8_XRECHNUNG, F9_CII, F10_NIE_XML, F11_PRAZDNY,
    F1_SPRAVNA.replace('urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0', 'urn:nieco:ine')];
  for (const x of vzorky) for (const n of skontroluj(x).nalezy) if (!zoznam.has(n.kod)) chybajuce.add(n.kod);
  ok('29. vsetky hlasene kody su v zozname IMPLEMENTOVANE', chybajuce.size === 0, [...chybajuce].join(', '));
}

// --- parser: DOCTYPE a entity odmietame
{
  const s = '<!DOCTYPE Invoice [<!ENTITY x "y">]><Invoice/>';
  const v = skontroluj(s);
  ok('30. parser odmietne DOCTYPE', kody(v).includes('XML-01'), kody(v).join(', '));
  const e = skontroluj('<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"><cbc:ID>&neznama;</cbc:ID></Invoice>');
  ok('30. parser odmietne neznamu entitu', kody(e).includes('XML-01'), kody(e).join(', '));
}

// --- prazdna faktura z formulara
{
  const f = prazdnaFaktura('SK');
  ok('31. prazdna faktura: profil peppol', f.profil === 'peppol');
  ok('31. prazdna faktura: schemeID dodavatela 0245', f.dodavatel.endpointSchema === '0245');
  const g = prazdnaFaktura('DE');
  ok('31. prazdna faktura DE: profil xrechnung', g.profil === 'xrechnung');
  ok('31. prazdna faktura DE: sadzba 19', g.polozky[0].sadzba === 19);
}


// ---------------------------------------------------------------- cielene testy jednotlivych pravidiel
// Kazdy pripad je mala zmena spravnej faktury. Overujeme, ze pravidlo naozaj vystreli
// (aby v kode nezostal nespusteny kus) a ze sa neozve na spravnej fakture.

function zmen(zaklad, co, naCo) {
  if (zaklad.indexOf(co) === -1) throw new Error('fixtura neobsahuje: ' + co);
  return zaklad.replace(co, naCo);
}

const PRIPADY = [
  // EN 16931, zakladne
  ['BR-23', () => zmen(F1_SPRAVNA, '<cbc:InvoicedQuantity unitCode="HUR">10</cbc:InvoicedQuantity>', '<cbc:InvoicedQuantity>10</cbc:InvoicedQuantity>')],
  ['BR-25', () => zmen(F1_SPRAVNA, '<cbc:Name>Programatorske prace</cbc:Name>', '<cbc:Name> </cbc:Name>')],
  ['BR-27', () => zmen(F1_SPRAVNA, '<cbc:PriceAmount currencyID="EUR">15.00</cbc:PriceAmount>', '<cbc:PriceAmount currencyID="EUR">-15.00</cbc:PriceAmount>')],
  ['BR-29', () => zmen(F1_SPRAVNA, '<cbc:BuyerReference>OBJ-2026-77</cbc:BuyerReference>',
    '<cbc:BuyerReference>OBJ-2026-77</cbc:BuyerReference>\n  <cac:InvoicePeriod><cbc:StartDate>2026-09-30</cbc:StartDate><cbc:EndDate>2026-09-01</cbc:EndDate></cac:InvoicePeriod>')],
  ['BR-49', () => zmen(F1_SPRAVNA, '<cbc:PaymentMeansCode>58</cbc:PaymentMeansCode>\n    <cbc:PaymentID>20260001</cbc:PaymentID>', '<cbc:PaymentID>20260001</cbc:PaymentID>')],
  ['BR-62', () => zmen(F1_SPRAVNA, '<cbc:EndpointID schemeID="0245">1234567890</cbc:EndpointID>', '<cbc:EndpointID>1234567890</cbc:EndpointID>')],
  ['BR-CO-09', () => zmen(F1_SPRAVNA, '<cbc:CompanyID>SK2020000000</cbc:CompanyID>', '<cbc:CompanyID>XX2020000000</cbc:CompanyID>')],
  ['BR-CO-10', () => zmen(F1_SPRAVNA, '<cbc:LineExtensionAmount currencyID="EUR">200.00</cbc:LineExtensionAmount>', '<cbc:LineExtensionAmount currencyID="EUR">201.00</cbc:LineExtensionAmount>')],
  ['BR-CO-14', () => zmen(F1_SPRAVNA, '<cbc:TaxAmount currencyID="EUR">46.00</cbc:TaxAmount>\n    <cac:TaxSubtotal>', '<cbc:TaxAmount currencyID="EUR">47.00</cbc:TaxAmount>\n    <cac:TaxSubtotal>')],
  ['BR-CO-25', () => zmen(zmen(F1_SPRAVNA, '<cbc:DueDate>2026-09-25</cbc:DueDate>\n', ''),
    '<cac:PaymentTerms>\n    <cbc:Note>Splatnost 14 dni.</cbc:Note>\n  </cac:PaymentTerms>\n', '')],
  ['BR-DEC-23', () => zmen(F1_SPRAVNA, '<cbc:LineExtensionAmount currencyID="EUR">150.00</cbc:LineExtensionAmount>', '<cbc:LineExtensionAmount currencyID="EUR">150.001</cbc:LineExtensionAmount>')],
  ['BR-CL-16', () => zmen(F1_SPRAVNA, '<cbc:PaymentMeansCode>58</cbc:PaymentMeansCode>', '<cbc:PaymentMeansCode>999</cbc:PaymentMeansCode>')],
  ['BR-CL-23', () => zmen(F1_SPRAVNA, 'unitCode="HUR"', 'unitCode="HODINA"')],
  ['BR-CL-25', () => zmen(F1_SPRAVNA, '<cbc:EndpointID schemeID="0245">1234567890</cbc:EndpointID>', '<cbc:EndpointID schemeID="ZZZ9">1234567890</cbc:EndpointID>')],
  ['BR-CL-14', () => zmen(F1_SPRAVNA, '<cac:Country><cbc:IdentificationCode>SK</cbc:IdentificationCode></cac:Country>', '<cac:Country><cbc:IdentificationCode>SVK</cbc:IdentificationCode></cac:Country>')],
  // kategorie DPH
  ['BR-S-09', () => zmen(F1_SPRAVNA, '<cbc:TaxAmount currencyID="EUR">46.00</cbc:TaxAmount>\n      <cac:TaxCategory>', '<cbc:TaxAmount currencyID="EUR">60.00</cbc:TaxAmount>\n      <cac:TaxCategory>')],
  ['BR-S-05', () => zmen(F1_SPRAVNA,
    '<cac:ClassifiedTaxCategory>\n        <cbc:ID>S</cbc:ID>\n        <cbc:Percent>23.00</cbc:Percent>',
    '<cac:ClassifiedTaxCategory>\n        <cbc:ID>S</cbc:ID>\n        <cbc:Percent>0.00</cbc:Percent>')],
  ['BR-S-10', () => zmen(F1_SPRAVNA, '<cbc:ID>S</cbc:ID>\n        <cbc:Percent>23.00</cbc:Percent>\n        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>\n      </cac:TaxCategory>',
    '<cbc:ID>S</cbc:ID>\n        <cbc:Percent>23.00</cbc:Percent>\n        <cbc:TaxExemptionReason>Nepatri sem</cbc:TaxExemptionReason>\n        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>\n      </cac:TaxCategory>')],
  ['BR-E-10', () => F1_SPRAVNA.split('<cbc:ID>S</cbc:ID>').join('<cbc:ID>E</cbc:ID>')],
  ['BR-Z-01', () => zmen(F1_SPRAVNA, '<cac:ClassifiedTaxCategory>\n        <cbc:ID>S</cbc:ID>', '<cac:ClassifiedTaxCategory>\n        <cbc:ID>Z</cbc:ID>')],
  // Peppol
  ['PEPPOL-EN16931-R003', () => zmen(F1_SPRAVNA, '<cbc:BuyerReference>OBJ-2026-77</cbc:BuyerReference>\n', '')],
  ['PEPPOL-EN16931-R008', () => zmen(F1_SPRAVNA, '<cbc:Note>Dakujeme za spolupracu.</cbc:Note>', '<cbc:Note></cbc:Note>')],
  ['PEPPOL-EN16931-R120', () => zmen(F1_SPRAVNA, '<cbc:PriceAmount currencyID="EUR">15.00</cbc:PriceAmount>', '<cbc:PriceAmount currencyID="EUR">17.00</cbc:PriceAmount>')],
  ['PEPPOL-EN16931-R051', () => zmen(F1_SPRAVNA, '<cbc:PriceAmount currencyID="EUR">25.00</cbc:PriceAmount>', '<cbc:PriceAmount currencyID="CZK">25.00</cbc:PriceAmount>')],
  ['PEPPOL-EN16931-R053', () => zmen(F1_SPRAVNA, '<cac:TaxTotal>\n    <cbc:TaxAmount currencyID="EUR">46.00</cbc:TaxAmount>',
    '<cac:TaxTotal>\n    <cbc:TaxAmount currencyID="EUR">0.00</cbc:TaxAmount>\n    <cac:TaxSubtotal><cbc:TaxableAmount currencyID="EUR">0.00</cbc:TaxableAmount><cbc:TaxAmount currencyID="EUR">0.00</cbc:TaxAmount><cac:TaxCategory><cbc:ID>S</cbc:ID><cbc:Percent>23.00</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal>\n  </cac:TaxTotal>\n  <cac:TaxTotal>\n    <cbc:TaxAmount currencyID="EUR">46.00</cbc:TaxAmount>')],
  ['PEPPOL-EN16931-R004', () => zmen(F1_SPRAVNA, 'urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0', 'urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:9.9'), { profil: 'peppol' }],
  ['PEPPOL-EN16931-R007', () => zmen(F1_SPRAVNA, '<cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>', '<cbc:ProfileID>bezny proces</cbc:ProfileID>')],
  ['PEPPOL-EN16931-F001', () => zmen(F1_SPRAVNA, '<cbc:IssueDate>2026-09-11</cbc:IssueDate>', '<cbc:IssueDate>11.09.2026</cbc:IssueDate>')],
  ['PEPPOL-COMMON-R040', () => zmen(F1_SPRAVNA, '<cbc:EndpointID schemeID="0245">1234567890</cbc:EndpointID>', '<cbc:EndpointID schemeID="0088">1234567890123</cbc:EndpointID>')],
  // XRechnung
  ['BR-DE-2', () => zmen(F8_XRECHNUNG, '<cac:Contact>\n        <cbc:Name>Max Muster</cbc:Name>\n        <cbc:Telephone>+49 30 123456</cbc:Telephone>\n        <cbc:ElectronicMail>rechnung@muster.de</cbc:ElectronicMail>\n      </cac:Contact>\n', '')],
  ['BR-DE-6', () => zmen(F8_XRECHNUNG, '<cbc:Telephone>+49 30 123456</cbc:Telephone>\n', '')],
  ['BR-DE-27', () => zmen(F8_XRECHNUNG, '<cbc:Telephone>+49 30 123456</cbc:Telephone>', '<cbc:Telephone>volajte</cbc:Telephone>')],
  ['BR-DE-28', () => zmen(F8_XRECHNUNG, '<cbc:ElectronicMail>rechnung@muster.de</cbc:ElectronicMail>', '<cbc:ElectronicMail>rechnung(at)muster.de</cbc:ElectronicMail>')],
  ['BR-DE-4', () => zmen(F8_XRECHNUNG, '<cbc:PostalZone>10115</cbc:PostalZone>\n', '')],
  ['BR-DE-19', () => zmen(F8_XRECHNUNG, IBAN_DE, 'DE02120300000000202050')],
  ['BR-DE-14', () => zmen(F8_XRECHNUNG, '<cbc:ID>S</cbc:ID>\n        <cbc:Percent>19.00</cbc:Percent>\n        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>\n      </cac:TaxCategory>', '<cbc:ID>S</cbc:ID>\n        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>\n      </cac:TaxCategory>')],
  ['BR-DE-21', () => zmen(F8_XRECHNUNG, 'urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0', 'urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_2.3')],
  // nase kontroly navyse
  ['ARL-DATUM', () => zmen(F1_SPRAVNA, '<cbc:IssueDate>2026-09-11</cbc:IssueDate>', '<cbc:IssueDate>2026-02-30</cbc:IssueDate>')],
  ['ARL-DATUM-PORADIE', () => zmen(F1_SPRAVNA, '<cbc:DueDate>2026-09-25</cbc:DueDate>', '<cbc:DueDate>2026-09-01</cbc:DueDate>')],
  ['ARL-ICDPH', () => zmen(F1_SPRAVNA, '<cbc:CompanyID>SK2020000000</cbc:CompanyID>', '<cbc:CompanyID>SK202000000</cbc:CompanyID>')],
  ['ARL-SK-SCHEMEID', () => zmen(F1_SPRAVNA, '<cbc:EndpointID schemeID="0245">1234567890</cbc:EndpointID>', '<cbc:EndpointID schemeID="0088">1234567890128</cbc:EndpointID>')],
  ['ARL-SK-DIC-TVAR', () => zmen(F1_SPRAVNA, '<cbc:EndpointID schemeID="0245">1234567890</cbc:EndpointID>', '<cbc:EndpointID schemeID="0245">SK2120000001</cbc:EndpointID>')],
  ['ARL-LEITWEG', () => zmen(F8_XRECHNUNG, '<cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>', '<cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>\n  <cbc:BuyerReference>04011000-12345-3</cbc:BuyerReference>')]
];

{
  const zaklad = new Set(kody(skontroluj(F1_SPRAVNA)).concat(kody(skontroluj(F8_XRECHNUNG))));
  for (const [kod, uprav, volby] of PRIPADY) {
    let najdene;
    try {
      najdene = kody(skontroluj(uprav(), volby || {}));
    } catch (e) {
      ok('32. pripad ' + kod + ': fixtura sa da pripravit', false, String(e.message));
      continue;
    }
    ok('32. pripad ' + kod + ': pravidlo vystreli', najdene.includes(kod), 'nasli sme: ' + [...new Set(najdene)].join(', '));
    ok('32. pripad ' + kod + ': na spravnej fakture nie je', !zaklad.has(kod), '');
  }
  console.log('   (cielenych pripadov pravidiel: ' + PRIPADY.length + ')');
}

// --- IGIC (L) a IPSI (M): nulova sadzba je podla schematronu platna
// BR-AF-05/06/07 a BR-AG-05/06/07 maju test "(cbc:Percent) >= 0", nie "> 0".
{
  for (const [kod, meno] of [['L', 'IGIC'], ['M', 'IPSI']]) {
    const skupina = kod === 'L' ? 'BR-AF' : 'BR-AG';

    const nula = fakturaSk();
    nula.cislo = 'SK-2026-' + kod + '0';
    nula.polozky = [{ nazov: 'Tovar ' + meno, mnozstvo: 2, jednotka: 'C62', cena: 50, sadzba: 0, kategoria: kod }];
    const vNula = skontroluj(vytvorUbl(nula));
    ok('35. ' + meno + ' so sadzbou 0 %: ' + skupina + '-05 sa neozve',
      !kody(vNula).includes(skupina + '-05'), vypisChyby(vNula));
    ok('35. ' + meno + ' so sadzbou 0 %: doklad je bez chyby', vNula.sumar.chyby === 0, vypisChyby(vNula));

    const kladna = fakturaSk();
    kladna.cislo = 'SK-2026-' + kod + '7';
    kladna.polozky = [{ nazov: 'Tovar ' + meno, mnozstvo: 2, jednotka: 'C62', cena: 50, sadzba: 7, kategoria: kod }];
    const vKladna = skontroluj(vytvorUbl(kladna));
    ok('35. ' + meno + ' so sadzbou 7 %: doklad je bez chyby', vKladna.sumar.chyby === 0, vypisChyby(vKladna));

    // chybajuca sadzba pravidlo stale porusuje
    const bezSadzby = vytvorUbl(nula).split('<cbc:Percent>0.00</cbc:Percent>\n        ').join('');
    ok('35. ' + meno + ' bez sadzby: ' + skupina + '-05 vystreli',
      kody(skontroluj(bezSadzby)).includes(skupina + '-05'), kody(skontroluj(bezSadzby)).join(', '));
  }
}

// --- platobne podmienky v jazyku stranky a s diakritikou
{
  const f = fakturaSk();
  const sk = vytvorUbl(f, { jazyk: 'sk' });
  const cs = vytvorUbl(f, { jazyk: 'cs' });
  const de = vytvorUbl(f, { jazyk: 'de' });
  ok('36. platobne podmienky sk maju makky znak', sk.includes('<cbc:Note>Splatnosť ' + f.datumSplatnosti + '</cbc:Note>'), sk.match(/<cac:PaymentTerms>[\s\S]*?<\/cac:PaymentTerms>/)[0]);
  ok('36. platobne podmienky cs su ceske', cs.includes('<cbc:Note>Splatnost ' + f.datumSplatnosti + '</cbc:Note>'));
  ok('36. platobne podmienky de su nemecke', de.includes('<cbc:Note>Fällig am ' + f.datumSplatnosti + '</cbc:Note>'));
  ok('36. bez volby jazyka je slovencina', vytvorUbl(f).includes('Splatnosť '));

  const g = fakturaSk();
  g.platobnePodmienky = 'Zahlbar innerhalb von 14 Tagen ohne Abzug.';
  ok('36. vlastne platobne podmienky prebiju nahradny text',
    vytvorUbl(g, { jazyk: 'sk' }).includes('<cbc:Note>Zahlbar innerhalb von 14 Tagen ohne Abzug.</cbc:Note>'));
  ok('36. prazdna faktura ma pole platobnePodmienky', 'platobnePodmienky' in prazdnaFaktura('SK'));
  ok('36. vygenerovane XML s vlastnymi podmienkami prejde kontrolou', skontroluj(vytvorUbl(g, { jazyk: 'de' })).sumar.chyby === 0);
}

// --- validator neskonci vynimkou na poskodenych vstupoch
{
  const zaklad = F1_SPRAVNA;
  let padov = 0;
  for (let i = 0; i < 200; i += 1) {
    const rez = Math.floor((zaklad.length * i) / 200);
    const kusy = [zaklad.slice(0, rez), zaklad.slice(rez).replace(/</g, '&lt;'), zaklad.slice(rez, rez + 50)];
    for (const k of kusy) {
      try { skontroluj(k); } catch (e) { padov += 1; }
    }
  }
  ok('33. validator neskonci vynimkou ani na poskodenom vstupe', padov === 0, 'padov=' + padov);
}

// --- nahlad znesie aj neuplny doklad
{
  const p = parsujXml(F3_CHYBAJUCE);
  const dok = malyDom();
  const ciel = dok.createElement('div');
  let padlo = false;
  try { vykresliNahlad(p.koren, ciel, 'cs', dok); } catch (e) { padlo = true; }
  ok('34. nahlad znesie neuplny doklad', padlo === false);
  ok('34. nahlad neuplneho dokladu nieco vypise', ciel.textContent.length > 10);
}

// --- kazde pravidlo nesie aj anglicku spravu (staticka kontrola zdrojov)
//
// Preco staticky: funkcia pridaj() dostava spravy ako poziciove argumenty, takze pravidlo,
// ktore sa v beznych fixturach nespusti, by nam v behovom teste vypadlo. Prechadzame teda
// vsetky volania pridaj() a pomocnych funkcii, ktore spravy dalej podavaju, a overujeme,
// ze maju miesto pre anglictinu a ze v nom nie je omylom XPath.
{
  const SUBORY = ['pravidla.mjs', 'pravidla-en16931.mjs', 'pravidla-kategorie.mjs',
    'pravidla-peppol.mjs', 'pravidla-xrechnung.mjs'];
  // meno funkcie -> najmensi pocet argumentov, ked uz je anglictina na mieste
  const ARITA = { pridaj: 9, P: 7, kodovnik: 9 };
  // co v slote pre anglictinu nesmie byt: nahradna cesta k prvku
  const CESTA = /^(kdeKoren|cesta_|nahradnaCesta|c|kde)$|^xpath\(/;

  function volania(zdroj) {
    const out = [];
    const re = /(^|[^A-Za-z0-9_$.])(pridaj|P|kodovnik)\s*\(/g;
    let m;
    while ((m = re.exec(zdroj))) {
      const meno = m[2];
      let i = m.index + m[0].length;
      let hlbka = 1;
      let q = null;
      let zac = i;
      const args = [];
      while (i < zdroj.length && hlbka > 0) {
        const c = zdroj[i];
        if (q) {
          if (c === '\\') { i += 2; continue; }
          if (c === q) q = null;
        } else if (c === "'" || c === '"' || c === '`') q = c;
        else if (c === '(' || c === '[' || c === '{') hlbka += 1;
        else if (c === ')' || c === ']' || c === '}') {
          hlbka -= 1;
          if (hlbka === 0) { args.push(zdroj.slice(zac, i).trim()); break; }
        } else if (c === ',' && hlbka === 1) { args.push(zdroj.slice(zac, i).trim()); zac = i + 1; }
        i += 1;
      }
      out.push({ meno, riadok: zdroj.slice(0, m.index).split('\n').length, args });
    }
    return out;
  }

  // anglicka veta nesmie obsahovat slovensku ani ceskú diakritiku (okrem nazvov ako XRechnung)
  const DIAKRITIKA_ZDROJ = /[áäčďéěíľĺňóôřŕšťúůýžÁÄČĎÉĚÍĽĹŇÓÔŘŔŠŤÚŮÝŽ]/;

  let malo = 0;
  let cesta = 0;
  let slovensky = 0;
  let spolu = 0;
  const zle = [];
  for (const f of SUBORY) {
    const zdroj = readFileSync(new URL('./' + f, import.meta.url), 'utf8');
    for (const v of volania(zdroj)) {
      // preskoc definiciu pomocnej lambdy: const P = (kod, uzol, ...) => pridaj(...)
      if (/^\s*const\s/.test(zdroj.split('\n')[v.riadok - 1] || '') && v.meno !== 'pridaj') continue;
      spolu += 1;
      const n = ARITA[v.meno];
      if (v.args.length < n) { malo += 1; zle.push(f + ':' + v.riadok + ' ' + v.meno + ' ma ' + v.args.length + ' argumentov'); continue; }
      const en = v.args.slice(n - 1).join(', ');
      if (CESTA.test(v.args[n - 1] || '')) { cesta += 1; zle.push(f + ':' + v.riadok + ' ' + v.meno + ' ma v anglickom slote cestu'); continue; }
      if (DIAKRITIKA_ZDROJ.test(en)) { slovensky += 1; zle.push(f + ':' + v.riadok + ' ' + v.meno + ' ma v anglickej vete diakritiku'); }
    }
  }
  ok('35. kazde pravidlo ma miesto pre anglicku spravu', malo === 0, zle.slice(0, 5).join('; '));
  ok('35. anglicky slot nikde nedrzi XPath', cesta === 0, zle.slice(0, 5).join('; '));
  ok('35. anglicka veta nikde neprepadne do slovenciny', slovensky === 0, zle.slice(0, 5).join('; '));
  console.log('   (skontrolovanych volani pravidiel: ' + spolu + ')');
}

// --- T.en a MENOVKY.en v app.js maju rovnake kluce ako slovencina
{
  const zdroj = readFileSync(new URL('./app.js', import.meta.url), 'utf8');
  const vyber = (meno) => {
    const zac = zdroj.indexOf('const ' + meno + ' = {');
    const kon = zdroj.indexOf('}[LANG];', zac);
    return zdroj.slice(zac + ('const ' + meno + ' = ').length, kon + 1);
  };
  // rovnake pomocky ako v app.js, aby sedelo aj sklonovanie
  const tvar3 = (n, jeden, malo, vela) => (n === 1 ? jeden : n >= 2 && n <= 4 ? malo : vela);
  const tvar2 = (n, jeden, viac) => (n === 1 ? jeden : viac);
  const T_ALL = new Function('tvar2', 'tvar3', 'return ' + vyber('T'))(tvar2, tvar3);
  const M_ALL = new Function('return ' + vyber('MENOVKY'))();

  for (const [meno, obj] of [['T', T_ALL], ['MENOVKY', M_ALL]]) {
    const sk = Object.keys(obj.sk).sort();
    for (const jazyk of ['cs', 'de', 'en']) {
      const iny = Object.keys(obj[jazyk] || {}).sort();
      const chyba = sk.filter((k) => iny.indexOf(k) === -1);
      const navyse = iny.filter((k) => sk.indexOf(k) === -1);
      ok('35. ' + meno + '.' + jazyk + ' ma rovnake kluce ako ' + meno + '.sk',
        chyba.length === 0 && navyse.length === 0,
        'chyba: ' + chyba.join(', ') + ' | navyse: ' + navyse.join(', '));
    }
  }
  // mnozne cisla v anglictine: error/errors, warning/warnings, note/notes
  ok('35. T.en sklonuje chyby', T_ALL.en.sumarChyby(1) === 'error' && T_ALL.en.sumarChyby(2) === 'errors');
  ok('35. T.en sklonuje varovania', T_ALL.en.sumarVarovania(1) === 'warning' && T_ALL.en.sumarVarovania(3) === 'warnings');
  ok('35. T.en sklonuje informacie', T_ALL.en.sumarInformacie(1) === 'note' && T_ALL.en.sumarInformacie(0) === 'notes');
  ok('35. T.en ma anglicku vetu bez pomlciek', !/[–—]/.test(JSON.stringify(T_ALL.en)));
}

// --- anglicky vzor faktury prejde kontrolou bez chyb
{
  const zdroj = readFileSync(new URL('./app.js', import.meta.url), 'utf8');
  const zac = zdroj.indexOf('const VZOR_XML_EN = `');
  const xml = zdroj.slice(zdroj.indexOf('<?xml', zac), zdroj.indexOf('\n`;', zac));
  const v = skontroluj(xml);
  ok('35. anglicky vzor je Peppol a nema chybu', v.profil === 'peppol' && v.sumar.chyby === 0, vypisChyby(v));
  ok('35. anglicky vzor nema ani varovanie', v.sumar.varovania === 0, kody(v, 'varovanie').join(', '));
  ok('35. anglicky vzor je v EUR', xml.includes('<cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>'));
  ok('35. anglicky vzor pouziva GLN so schemeID 0088', xml.includes('schemeID="0088"'));
  const protokolEn = protokol(v, 'en', 'sample.xml');
  ok('35. protokol po anglicky ma anglicku hlavicku', protokolEn.includes('E-invoice check report') && protokolEn.includes('Errors:'), protokolEn.slice(0, 120));

  // pokazeny anglicky vzor: hlasenia z kodovnikov nesmu prepadnut do slovenciny
  const pokazeny = xml
    .replace('unitCode="HUR"', 'unitCode="XXX"')
    .replace('<cbc:DocumentCurrencyCode>EUR', '<cbc:DocumentCurrencyCode>EURO')
    .replace('<cbc:InvoiceTypeCode>380', '<cbc:InvoiceTypeCode>999')
    .replace('<cbc:PaymentMeansCode>58', '<cbc:PaymentMeansCode>777')
    .replace('<cbc:IdentificationCode>IE', '<cbc:IdentificationCode>XX')
    .replace('VATEX-EU-AE', 'VATEX-ZZ-QQ')
    .replace('schemeID="0088">5390000000014', 'schemeID="9999">5390000000014');
  const vp = skontroluj(pokazeny);
  const DIAK = /[áäčďéěíľĺňóôřŕšťúůýžÁÄČĎÉĚÍĽĹŇÓÔŘŔŠŤÚŮÝŽ]/;
  const zleEn = vp.nalezy.filter((n) => DIAK.test(n.sprava.en)).map((n) => n.kod + ': ' + n.sprava.en.slice(0, 70));
  ok('35. pokazeny anglicky vzor hlasi kodovniky po anglicky', zleEn.length === 0, zleEn.slice(0, 3).join(' | '));
  ok('35. pokazeny anglicky vzor hlasi kodovnikove pravidla', kody(vp).some((k) => k.startsWith('BR-CL-')), kody(vp).join(', '));
}

// ---------------------------------------------------------------- vysledok

console.log('');
if (zlyhalo === 0) {
  console.log('Vsetkych ' + prebehlo + ' testov preslo.');
  process.exit(0);
} else {
  console.log(zlyhalo + ' z ' + prebehlo + ' testov zlyhalo:');
  for (const z of zlyhania) console.log('  - ' + z);
  process.exit(1);
}
