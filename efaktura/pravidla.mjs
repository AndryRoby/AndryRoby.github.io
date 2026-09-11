// pravidla.mjs - kontrola e-faktury v prehliadaci.
// Vstup: retazec s XML. Vystup: { profil, typ, nalezy, sumar }.
// Subor sa cita a kontroluje v prehliadaci, nikam sa neodosiela.
//
// Co kontrolujeme: pravidla EN 16931 (BR-*, BR-CO-*, BR-DEC-*, BR-CL-*, pravidla podla kategorie DPH),
// Peppol BIS Billing 3.0 (PEPPOL-*) a XRechnung (BR-DE-*), plus nase vlastne kontroly (ARL-*).
// Toto NIE JE uplny validator: nekontrolujeme XSD schemu UBL, pravidla UBL-CR/UBL-SR/UBL-DT,
// ani niektore pravidla uvedene nizsie v zozname NEIMPLEMENTOVANE. Prechod nasou kontrolou
// nezarucuje, ze fakturu prijme odberatel, jeho fakturacny system alebo siet Peppol.

import * as K from './kodovniky.mjs';
import { parsujXml, domDruhyNazor, txt, hod, atr, vsetky, deti, prve, jeden, xpath } from './parser.mjs';
import { vytvorKontext, pridaj, platnyDatum } from './pravidla-jadro.mjs';
import { pravidlaEn16931 } from './pravidla-en16931.mjs';
import { pravidlaKategorii } from './pravidla-kategorie.mjs';
import { pravidlaPeppol } from './pravidla-peppol.mjs';
import { pravidlaXrechnung, platnyIban } from './pravidla-xrechnung.mjs';

export { platnyIban };

const CH = 'chyba';
const VAR = 'varovanie';

const MAX_NALEZOV = 1000;

export const NAZVY_PROFILOV = {
  en16931: 'EN 16931',
  peppol: 'Peppol BIS Billing 3.0',
  xrechnung: 'XRechnung 3.x (Nemecko)',
  neznamy: 'neznamy profil'
};

// ---------------------------------------------------------------- vlastne kontroly navyse

// SK IC DPH: SK a 10 cislic. DE USt-IdNr.: DE a 9 cislic.
const IC_DPH_VZORY = {
  SK: { vzor: /^SK\d{10}$/, sk: 'SK a 10 číslic, napríklad SK2020000000', cs: 'SK a 10 číslic, například SK2020000000', de: 'SK und 10 Ziffern, zum Beispiel SK2020000000' },
  DE: { vzor: /^DE\d{9}$/, sk: 'DE a 9 číslic, napríklad DE123456789', cs: 'DE a 9 číslic, například DE123456789', de: 'DE und 9 Ziffern, zum Beispiel DE123456789' },
  CZ: { vzor: /^CZ\d{8,10}$/, sk: 'CZ a 8 až 10 číslic, napríklad CZ12345678', cs: 'CZ a 8 až 10 číslic, například CZ12345678', de: 'CZ und 8 bis 10 Ziffern, zum Beispiel CZ12345678' },
  AT: { vzor: /^ATU\d{8}$/, sk: 'ATU a 8 číslic, napríklad ATU12345678', cs: 'ATU a 8 číslic, například ATU12345678', de: 'ATU und 8 Ziffern, zum Beispiel ATU12345678' }
};

// Leitweg-ID: hruba adresa 2 az 12 cislic, volitelna jemna cast, na konci dvojciferna kontrola.
const LEITWEG = /^\d{2,12}(-[0-9A-Za-z][0-9A-Za-z\-.]{0,29})?-\d{2}$/;

function kontrolyNavyse(ctx) {
  const d = ctx.koren;
  const kdeKoren = xpath(d);

  // IBAN
  for (const ucet of vsetky(d, 'cac:PayeeFinancialAccount|cac:PayerFinancialAccount')) {
    for (const n of deti(ucet, 'cbc:ID')) {
      const v = txt(n).replace(/\s+/g, '');
      if (v === '') continue;
      // za IBAN povazujeme hodnotu v tvare dve pismena, dve cislice a dalej alfanumericke znaky
      if (!/^[A-Za-z]{2}\d{2}[A-Za-z0-9]{10,30}$/.test(v)) continue;
      if (!platnyIban(v)) {
        pridaj(ctx, 'ARL-IBAN', CH, n, txt(n),
          'IBAN "' + txt(n) + '" neprešiel kontrolou mod 97 podľa ISO 13616. Skontrolujte, či nie je preklep v čísle účtu.',
          'IBAN "' + txt(n) + '" neprošel kontrolou mod 97 podle ISO 13616. Zkontrolujte, zda není překlep v čísle účtu.',
          'Die IBAN "' + txt(n) + '" besteht die Modulo-97-Prüfung nach ISO 13616 nicht. Prüfen Sie die Kontonummer auf Tippfehler.');
      }
    }
  }
  // IC DPH podla krajiny
  for (const pts of vsetky(d, 'cac:PartyTaxScheme')) {
    if (hod(pts, 'cac:TaxScheme/cbc:ID').toUpperCase() !== 'VAT') continue;
    for (const n of deti(pts, 'cbc:CompanyID')) {
      const v = txt(n).replace(/\s+/g, '').toUpperCase();
      if (v === '') continue;
      const krajina = v.slice(0, 2);
      const pravidlo = IC_DPH_VZORY[krajina];
      if (!pravidlo) continue;
      if (!pravidlo.vzor.test(v)) {
        pridaj(ctx, 'ARL-ICDPH', CH, n, txt(n),
          'IČ DPH "' + txt(n) + '" nemá správny tvar pre krajinu ' + krajina + '. Očakávame ' + pravidlo.sk + '.',
          'DIČ "' + txt(n) + '" nemá správný tvar pro zemi ' + krajina + '. Očekáváme ' + pravidlo.cs + '.',
          'Die USt-IdNr. "' + txt(n) + '" hat für das Land ' + krajina + ' nicht das richtige Format. Erwartet wird: ' + pravidlo.de + '.');
      }
    }
  }
  // Leitweg-ID, ak je odberatel z Nemecka
  const krajinaO = hod(d, 'cac:AccountingCustomerParty/cac:Party/cac:PostalAddress/cac:Country/cbc:IdentificationCode');
  const ref = prve(d, 'cbc:BuyerReference');
  if (ref && krajinaO === 'DE') {
    const v = txt(ref);
    if (v !== '' && /^\d/.test(v) && v.indexOf('-') > 0 && !LEITWEG.test(v)) {
      pridaj(ctx, 'ARL-LEITWEG', VAR, ref, v,
        'Referencia odberateľa "' + v + '" vyzerá ako nemecké Leitweg-ID, ale nemá očakávaný tvar: 2 až 12 číslic, voliteľná jemná časť a na konci pomlčka s dvojcifernou kontrolou, napríklad 04011000-12345-34.',
        'Reference odběratele "' + v + '" vypadá jako německé Leitweg-ID, ale nemá očekávaný tvar: 2 až 12 číslic, volitelná jemná část a na konci pomlčka s dvojcifernou kontrolou, například 04011000-12345-34.',
        'Die Käuferreferenz "' + v + '" sieht wie eine Leitweg-ID aus, hat aber nicht die erwartete Form: 2 bis 12 Ziffern, optionale Feinadressierung und am Ende ein Bindestrich mit zweistelliger Prüfziffer, zum Beispiel 04011000-12345-34.');
    }
  }
  // datumy: musia existovat v kalendari
  const datumove = 'cbc:IssueDate|cbc:DueDate|cbc:TaxPointDate|cbc:StartDate|cbc:EndDate|cbc:ActualDeliveryDate|cbc:PaymentDueDate';
  for (const n of vsetky(d, datumove)) {
    const v = txt(n);
    if (v === '') continue;
    if (!platnyDatum(v)) {
      pridaj(ctx, 'ARL-DATUM', CH, n, v,
        'Dátum "' + v + '" v prvku ' + n.meno + ' nie je platný deň v tvare RRRR-MM-DD.',
        'Datum "' + v + '" v prvku ' + n.meno + ' není platný den ve tvaru RRRR-MM-DD.',
        'Das Datum "' + v + '" in ' + n.meno + ' ist kein gültiger Tag im Format JJJJ-MM-TT.');
    }
  }
  const vystavenie = hod(d, 'cbc:IssueDate');
  const splatnost = hod(d, 'cbc:DueDate');
  if (platnyDatum(vystavenie) && platnyDatum(splatnost) && splatnost < vystavenie) {
    pridaj(ctx, 'ARL-DATUM-PORADIE', VAR, prve(d, 'cbc:DueDate'), splatnost,
      'Dátum splatnosti (' + splatnost + ') je skôr ako dátum vystavenia (' + vystavenie + ').',
      'Datum splatnosti (' + splatnost + ') je dřív než datum vystavení (' + vystavenie + ').',
      'Das Fälligkeitsdatum (' + splatnost + ') liegt vor dem Rechnungsdatum (' + vystavenie + ').');
  }
  // mena: v profile bez Peppol pravidiel skontrolujeme zhodu sami
  if (ctx.profil === 'en16931' && ctx.mena !== '') {
    (function chod(n) {
      if (n.atr && n.atr.currencyID !== undefined && n.atr.currencyID !== ctx.mena) {
        if (!(ctx.menaDane !== '' && n.atr.currencyID === ctx.menaDane && n.k === 'cbc:TaxAmount')) {
          pridaj(ctx, 'ARL-MENA', VAR, n, n.atr.currencyID,
            'Prvok ' + n.meno + ' má menu ' + n.atr.currencyID + ', faktúra je v mene ' + ctx.mena + '. Skontrolujte, či je to zámer.',
            'Prvek ' + n.meno + ' má měnu ' + n.atr.currencyID + ', faktura je v měně ' + ctx.mena + '. Zkontrolujte, zda je to záměr.',
            'Das Element ' + n.meno + ' hat die Währung ' + n.atr.currencyID + ', die Rechnung lautet auf ' + ctx.mena + '. Prüfen Sie, ob das gewollt ist.');
        }
      }
      for (const x of n.deti) chod(x);
    })(d);
  }
  // odporucane schemeID pre slovenskeho dodavatela
  const krajinaD = hod(d, 'cac:AccountingSupplierParty/cac:Party/cac:PostalAddress/cac:Country/cbc:IdentificationCode');
  const ep = jeden(d, 'cac:AccountingSupplierParty/cac:Party/cbc:EndpointID');
  if (krajinaD === 'SK' && ep && atr(ep, 'schemeID') !== undefined && atr(ep, 'schemeID') !== '0245') {
    pridaj(ctx, 'ARL-SK-SCHEMEID', VAR, ep, String(atr(ep, 'schemeID')),
      'Dodávateľ je zo Slovenska. Podľa oficiálnych odpovedí Finančnej správy k eFaktúre je identifikátorom v sieti Peppol DIČ so schemeID="0245". V súbore je schemeID="' + atr(ep, 'schemeID') + '". Toto je naše odporúčanie, nie pravidlo zo schematronu.',
      'Dodavatel je ze Slovenska. Podle oficiálních odpovědí Finanční správy k eFaktuře je identifikátorem v síti Peppol DIČ se schemeID="0245". V souboru je schemeID="' + atr(ep, 'schemeID') + '". Toto je naše doporučení, ne pravidlo ze schematronu.',
      'Der Verkäufer sitzt in der Slowakei. Nach den offiziellen FAQ der slowakischen Finanzverwaltung ist die Peppol-Kennung die Steuernummer DIČ mit schemeID="0245". In der Datei steht schemeID="' + atr(ep, 'schemeID') + '". Das ist unsere Empfehlung, keine Schematron-Regel.');
  }
  // pri schemeID 0245 ma byt v hodnote DIC: presne 10 cislic, bez predpony SK
  for (const n of vsetky(d, 'cbc:EndpointID')) {
    if (atr(n, 'schemeID') !== '0245') continue;
    const v = txt(n).trim();
    if (v === '' || /^\d{10}$/.test(v)) continue;
    pridaj(ctx, 'ARL-SK-DIC-TVAR', CH, n, v,
      'Pri schemeID="0245" má byť v elektronickej adrese slovenské DIČ: presne 10 číslic, bez predpony SK a bez medzier. V súbore je "' + v + '". IČ DPH (SK a 10 číslic) sem nepatrí. Toto je naša kontrola podľa oficiálnych odpovedí Finančnej správy, nie pravidlo zo schematronu.',
      'Při schemeID="0245" má být v elektronické adrese slovenské DIČ: přesně 10 číslic, bez předpony SK a bez mezer. V souboru je "' + v + '". DIČ s předponou SK (tedy IČ DPH) sem nepatří. Toto je naše kontrola podle oficiálních odpovědí slovenské Finanční správy, ne pravidlo ze schematronu.',
      'Bei schemeID="0245" gehört in die elektronische Adresse die slowakische Steuernummer DIČ: genau 10 Ziffern, ohne das Präfix SK und ohne Leerzeichen. In der Datei steht "' + v + '". Das ist unsere Prüfung nach den offiziellen FAQ der slowakischen Finanzverwaltung, keine Schematron-Regel.');
  }
}

// ---------------------------------------------------------------- zistenie profilu

function zistiProfil(koren, volby) {
  if (volby && volby.profil && volby.profil !== 'auto') return volby.profil;
  const cust = hod(koren, 'cbc:CustomizationID');
  if (cust.startsWith(K.PROFILY.xrechnungPredpona)) return 'xrechnung';
  if (cust.startsWith('urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung')) return 'xrechnung';
  if (cust.startsWith(K.PROFILY.peppol)) return 'peppol';
  if (cust.startsWith(K.PROFILY.en16931)) return 'en16931';
  return 'neznamy';
}

// ---------------------------------------------------------------- hlavna funkcia

/**
 * Skontroluje e-fakturu.
 * @param {string} xmlText obsah suboru
 * @param {{profil?:string}} [volby] profil: auto (predvolene), en16931, peppol, xrechnung
 * @returns {{profil:string, profilNazov:string, typ:string, nalezy:Array, sumar:object}}
 */
export function skontroluj(xmlText, volby = {}) {
  const nalezy = [];
  const hotovo = (profil, typ, zoznam, poznamka) => {
    const orezane = zoznam.length > MAX_NALEZOV;
    const konecne = orezane ? zoznam.slice(0, MAX_NALEZOV) : zoznam;
    const chyby = konecne.filter((n) => n.zavaznost === 'chyba').length;
    const varovania = konecne.filter((n) => n.zavaznost === 'varovanie').length;
    const informacie = konecne.filter((n) => n.zavaznost === 'informacia').length;
    return {
      profil,
      profilNazov: NAZVY_PROFILOV[profil] || profil,
      typ,
      nalezy: konecne,
      sumar: {
        chyby,
        varovania,
        informacie,
        spolu: konecne.length,
        orezane,
        dobreTvarovane: typ !== 'nic' && typ !== 'chybaXml',
        poznamka: poznamka || ''
      }
    };
  };

  const vysledok = parsujXml(xmlText);
  if (!vysledok.ok) {
    const detail = domDruhyNazor(xmlText);
    nalezy.push({
      kod: 'XML-01',
      zavaznost: CH,
      xpath: '/',
      hodnota: detail || '',
      sprava: {
        sk: vysledok.chyba.sk,
        cs: vysledok.chyba.cs,
        de: vysledok.chyba.de
      },
      original: ''
    });
    return hotovo('neznamy', 'chybaXml', nalezy);
  }

  const koren = vysledok.koren;

  // CII rozpoznavame, ale zatial nekontrolujeme
  if (koren.local === 'CrossIndustryInvoice') {
    nalezy.push({
      kod: 'CII-01',
      zavaznost: 'informacia',
      xpath: xpath(koren),
      hodnota: koren.meno,
      sprava: {
        sk: 'Toto je e-faktúra v syntaxi CII (UN/CEFACT Cross Industry Invoice). Náš validátor zatiaľ kontroluje len syntax UBL 2.1 (Invoice a CreditNote). Súbor je čitateľný, ale pravidlá EN 16931 na ňom nespúšťame.',
        cs: 'Toto je e-faktura v syntaxi CII (UN/CEFACT Cross Industry Invoice). Náš validátor zatím kontroluje jen syntax UBL 2.1 (Invoice a CreditNote). Soubor je čitelný, ale pravidla EN 16931 na něm nespouštíme.',
        de: 'Dies ist eine E-Rechnung in der CII-Syntax (UN/CEFACT Cross Industry Invoice). Unser Prüfer unterstützt bisher nur die UBL-2.1-Syntax (Invoice und CreditNote). Die Datei ist lesbar, aber die EN-16931-Regeln werden darauf nicht angewendet.'
      },
      original: ''
    });
    return hotovo('neznamy', 'CII', nalezy);
  }

  if (koren.local !== 'Invoice' && koren.local !== 'CreditNote') {
    nalezy.push({
      kod: 'XML-02',
      zavaznost: CH,
      xpath: xpath(koren),
      hodnota: koren.meno,
      sprava: {
        sk: 'Hlavný prvok súboru je ' + koren.meno + '. E-faktúra v UBL 2.1 má mať hlavný prvok Invoice (faktúra) alebo CreditNote (dobropis) v mennom priestore ' + K.MP.faktura + '.',
        cs: 'Hlavní prvek souboru je ' + koren.meno + '. E-faktura v UBL 2.1 má mít hlavní prvek Invoice (faktura) nebo CreditNote (dobropis) ve jmenném prostoru ' + K.MP.faktura + '.',
        de: 'Das Wurzelelement der Datei ist ' + koren.meno + '. Eine UBL-2.1-E-Rechnung braucht als Wurzelelement Invoice oder CreditNote im Namensraum ' + K.MP.faktura + '.'
      },
      original: ''
    });
    return hotovo('neznamy', 'nic', nalezy);
  }

  // menny priestor hlavneho prvku
  const ocakavanyMp = koren.local === 'Invoice' ? K.MP.faktura : K.MP.dobropis;
  const ctx = vytvorKontext(koren);
  ctx.profil = zistiProfil(koren, volby);

  if (koren.ns !== ocakavanyMp) {
    pridaj(ctx, 'XML-03', CH, koren, koren.ns,
      'Hlavný prvok ' + koren.local + ' má byť v mennom priestore ' + ocakavanyMp + '. V súbore je "' + (koren.ns || 'žiadny') + '".',
      'Hlavní prvek ' + koren.local + ' má být ve jmenném prostoru ' + ocakavanyMp + '. V souboru je "' + (koren.ns || 'žádný') + '".',
      'Das Wurzelelement ' + koren.local + ' gehört in den Namensraum ' + ocakavanyMp + '. In der Datei steht "' + (koren.ns || 'keiner') + '".');
  }

  if (ctx.profil === 'neznamy') {
    pridaj(ctx, 'ARL-PROFIL', VAR, prve(koren, 'cbc:CustomizationID') || koren, hod(koren, 'cbc:CustomizationID'),
      'Identifikátor špecifikácie (BT-24) "' + hod(koren, 'cbc:CustomizationID') + '" nepoznám. Kontrolu sme spustili len v základnom rozsahu EN 16931, bez pravidiel Peppol a XRechnung.',
      'Identifikátor specifikace (BT-24) "' + hod(koren, 'cbc:CustomizationID') + '" neznám. Kontrolu jsme spustili jen v základním rozsahu EN 16931, bez pravidel Peppol a XRechnung.',
      'Die Spezifikationskennung (BT-24) "' + hod(koren, 'cbc:CustomizationID') + '" ist unbekannt. Geprüft wurde nur der EN-16931-Kern, ohne Peppol- und XRechnung-Regeln.',
      xpath(koren));
    ctx.profil = 'en16931';
  }

  pravidlaEn16931(ctx);
  pravidlaKategorii(ctx);
  if (ctx.profil === 'peppol') pravidlaPeppol(ctx);
  if (ctx.profil === 'xrechnung') pravidlaXrechnung(ctx);
  kontrolyNavyse(ctx);

  // usporiadanie: najprv chyby, potom varovania, potom informacie; v ramci toho podla kodu
  const poradie = { chyba: 0, varovanie: 1, informacia: 2 };
  ctx.nalezy.sort((a, b) => {
    const p = poradie[a.zavaznost] - poradie[b.zavaznost];
    if (p !== 0) return p;
    return a.kod.localeCompare(b.kod);
  });

  return hotovo(ctx.profil, koren.local, ctx.nalezy);
}

// ---------------------------------------------------------------- textovy protokol na stiahnutie

const HLAVICKY = {
  sk: { nadpis: 'Protokol kontroly e-faktúry', profil: 'Profil', typ: 'Typ dokladu', chyby: 'Chyby', varovania: 'Varovania', informacie: 'Informácie', ziadne: 'Nenašli sme žiadnu chybu ani varovanie.', poznamka: 'Toto nie je úplná kontrola. Nekontrolujeme XSD schému UBL ani všetky pravidlá. Prechod touto kontrolou nezaručuje prijatie faktúry odberateľom ani sieťou Peppol.' },
  cs: { nadpis: 'Protokol kontroly e-faktury', profil: 'Profil', typ: 'Typ dokladu', chyby: 'Chyby', varovania: 'Varování', informacie: 'Informace', ziadne: 'Nenašli jsme žádnou chybu ani varování.', poznamka: 'Toto není úplná kontrola. Nekontrolujeme XSD schéma UBL ani všechna pravidla. Průchod touto kontrolou nezaručuje přijetí faktury odběratelem ani síti Peppol.' },
  de: { nadpis: 'Prüfprotokoll E-Rechnung', profil: 'Profil', typ: 'Belegart', chyby: 'Fehler', varovania: 'Warnungen', informacie: 'Hinweise', ziadne: 'Wir haben weder Fehler noch Warnungen gefunden.', poznamka: 'Dies ist keine vollständige Prüfung. Wir prüfen weder das UBL-XSD-Schema noch alle Regeln. Ein Bestehen dieser Prüfung garantiert nicht die Annahme durch den Empfänger oder das Peppol-Netz.' }
};

/**
 * Textovy protokol na stiahnutie.
 * @param {object} vysledok vystup funkcie skontroluj
 * @param {'sk'|'cs'|'de'} jazyk
 * @param {string} [nazovSuboru]
 */
// Nazov zavaznosti v jazyku protokolu (vnutorne kody su slovenske).
const ZAVAZNOST_SLOVOM = {
  sk: { chyba: 'CHYBA', varovanie: 'VAROVANIE', informacia: 'INFORMÁCIA' },
  cs: { chyba: 'CHYBA', varovanie: 'VAROVÁNÍ', informacia: 'INFORMACE' },
  de: { chyba: 'FEHLER', varovanie: 'WARNUNG', informacia: 'HINWEIS' }
};

export function protokol(vysledok, jazyk = 'sk', nazovSuboru = '') {
  const H = HLAVICKY[jazyk] || HLAVICKY.sk;
  const r = [];
  r.push(H.nadpis);
  if (nazovSuboru) r.push(nazovSuboru);
  r.push(new Date().toISOString().slice(0, 19).replace('T', ' '));
  r.push('');
  r.push(H.profil + ': ' + vysledok.profilNazov);
  r.push(H.typ + ': ' + vysledok.typ);
  r.push(H.chyby + ': ' + vysledok.sumar.chyby + ', ' + H.varovania + ': ' + vysledok.sumar.varovania + ', ' + H.informacie + ': ' + vysledok.sumar.informacie);
  r.push('');
  if (!vysledok.nalezy.length) {
    r.push(H.ziadne);
  } else {
    for (const n of vysledok.nalezy) {
      const Z = ZAVAZNOST_SLOVOM[jazyk] || ZAVAZNOST_SLOVOM.sk;
      r.push('[' + (Z[n.zavaznost] || n.zavaznost.toUpperCase()) + '] ' + n.kod);
      r.push('  ' + (n.sprava[jazyk] || n.sprava.sk));
      r.push('  XPath: ' + n.xpath);
      if (n.hodnota) r.push('  ' + n.hodnota);
      if (n.original) r.push('  ' + n.original);
      r.push('');
    }
  }
  r.push(H.poznamka);
  return r.join('\n');
}

// ---------------------------------------------------------------- zoznam implementovanych pravidiel

function rozsah(predpona, od, do_, sirka = 2) {
  const out = [];
  for (let i = od; i <= do_; i += 1) out.push(predpona + String(i).padStart(sirka, '0'));
  return out;
}

const BR_ZAKLADNE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28,
  29, 30, 31, 32, 33, 36, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 61, 62, 63, 64, 65]
  .map((n) => 'BR-' + String(n).padStart(2, '0'));

const BR_CO = [3, 4, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26].map((n) => 'BR-CO-' + String(n).padStart(2, '0'));

const KATEGORIE_SKUPINY = ['BR-S', 'BR-Z', 'BR-E', 'BR-AE', 'BR-G', 'BR-IC', 'BR-O', 'BR-AF', 'BR-AG'];

export const IMPLEMENTOVANE = [].concat(
  BR_ZAKLADNE,
  BR_CO,
  ['BR-B-01', 'BR-B-02'],
  [1, 2, 5, 6, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 23, 24, 25, 27, 28].map((n) => 'BR-DEC-' + String(n).padStart(2, '0')),
  [1, 3, 4, 5, 6, 7, 8, 10, 11, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26].map((n) => 'BR-CL-' + String(n).padStart(2, '0')),
  KATEGORIE_SKUPINY.flatMap((s) => rozsah(s + '-', 1, 10)),
  ['BR-IC-11', 'BR-IC-12', 'BR-O-11', 'BR-O-12', 'BR-O-13', 'BR-O-14'],
  ['PEPPOL-EN16931-R001', 'PEPPOL-EN16931-R002', 'PEPPOL-EN16931-R003', 'PEPPOL-EN16931-R004',
    'PEPPOL-EN16931-R005', 'PEPPOL-EN16931-R007', 'PEPPOL-EN16931-R008', 'PEPPOL-EN16931-R010',
    'PEPPOL-EN16931-R020', 'PEPPOL-EN16931-R040', 'PEPPOL-EN16931-R041', 'PEPPOL-EN16931-R042',
    'PEPPOL-EN16931-R043', 'PEPPOL-EN16931-R044', 'PEPPOL-EN16931-R046', 'PEPPOL-EN16931-R051',
    'PEPPOL-EN16931-R053', 'PEPPOL-EN16931-R054', 'PEPPOL-EN16931-R055', 'PEPPOL-EN16931-R061',
    'PEPPOL-EN16931-R080', 'PEPPOL-EN16931-R100', 'PEPPOL-EN16931-R101', 'PEPPOL-EN16931-R110',
    'PEPPOL-EN16931-R111', 'PEPPOL-EN16931-R120', 'PEPPOL-EN16931-R121', 'PEPPOL-EN16931-R130'],
  ['PEPPOL-COMMON-R040', 'PEPPOL-COMMON-R041', 'PEPPOL-COMMON-R042', 'PEPPOL-COMMON-R043',
    'PEPPOL-COMMON-R044', 'PEPPOL-COMMON-R045', 'PEPPOL-COMMON-R046', 'PEPPOL-COMMON-R047',
    'PEPPOL-COMMON-R048', 'PEPPOL-COMMON-R049', 'PEPPOL-COMMON-R050', 'PEPPOL-COMMON-R052',
    'PEPPOL-COMMON-R053'],
  ['PEPPOL-EN16931-CL001', 'PEPPOL-EN16931-CL002', 'PEPPOL-EN16931-CL003', 'PEPPOL-EN16931-CL006',
    'PEPPOL-EN16931-CL007', 'PEPPOL-EN16931-CL008', 'PEPPOL-EN16931-F001',
    'PEPPOL-EN16931-P0100', 'PEPPOL-EN16931-P0101', 'PEPPOL-EN16931-P0104', 'PEPPOL-EN16931-P0105',
    'PEPPOL-EN16931-P0106', 'PEPPOL-EN16931-P0107', 'PEPPOL-EN16931-P0108', 'PEPPOL-EN16931-P0109',
    'PEPPOL-EN16931-P0110', 'PEPPOL-EN16931-P0111', 'PEPPOL-EN16931-P0112'],
  ['BR-DE-1', 'BR-DE-2', 'BR-DE-3', 'BR-DE-4', 'BR-DE-5', 'BR-DE-6', 'BR-DE-7', 'BR-DE-8', 'BR-DE-9',
    'BR-DE-10', 'BR-DE-11', 'BR-DE-14', 'BR-DE-15', 'BR-DE-16', 'BR-DE-17', 'BR-DE-18', 'BR-DE-19',
    'BR-DE-20', 'BR-DE-21', 'BR-DE-22', 'BR-DE-23-a', 'BR-DE-23-b', 'BR-DE-24-a', 'BR-DE-24-b',
    'BR-DE-25-a', 'BR-DE-25-b', 'BR-DE-26', 'BR-DE-27', 'BR-DE-28', 'BR-DE-30', 'BR-DE-31',
    'BR-DE-TMP-32', 'BR-TMP-2', 'BR-TMP-6'],
  ['BR-DEX-01', 'BR-DEX-04', 'BR-DEX-05', 'BR-DEX-06', 'BR-DEX-07', 'BR-DEX-08'],
  ['XML-01', 'XML-02', 'XML-03', 'CII-01',
    'ARL-IBAN', 'ARL-ICDPH', 'ARL-LEITWEG', 'ARL-DATUM', 'ARL-DATUM-PORADIE', 'ARL-MENA',
    'ARL-SK-SCHEMEID', 'ARL-SK-DIC-TVAR', 'ARL-PROFIL']
);

export const NEIMPLEMENTOVANE = [
  { kod: 'BR-34, BR-35, BR-39, BR-40, BR-58, BR-59, BR-60', dovod: 'Tieto čísla v aktuálnom schematrone EN 16931 neexistujú, sú vypustené alebo rezervované.' },
  { kod: 'BR-CO-01, BR-CO-02', dovod: 'Tieto čísla v aktuálnom schematrone neexistujú.' },
  { kod: 'BR-CO-05, BR-CO-06, BR-CO-07, BR-CO-08', dovod: 'Oficiálny schematron má pri nich test true(), teda nekontroluje nič. Ide o vecnú zhodu textu a kódu dôvodu zľavy alebo príplatku, ktorú stroj neposúdi.' },
  { kod: 'BR-DEC-03, BR-DEC-04, BR-DEC-07, BR-DEC-08, BR-DEC-21, BR-DEC-22, BR-DEC-26', dovod: 'Tieto čísla v schematrone pre UBL neexistujú (týkajú sa prvkov, ktoré UBL zapisuje inak).' },
  { kod: 'BR-CL-02, BR-CL-09, BR-CL-12', dovod: 'Tieto čísla v schematrone neexistujú.' },
  { kod: 'BR-DE-12, BR-DE-13, BR-DE-29', dovod: 'V XRechnung 3.x tieto čísla chýbajú (boli premenované na varianty BR-DE-23-a až BR-DE-25-b).' },
  { kod: 'BR-DE-CVD-01 az BR-DE-CVD-05, BR-TMP-CVD-01', dovod: 'Týkajú sa profilu Clean Vehicles Directive. Kódovník kategórií vozidiel a presný identifikátor profilu sú v súbore common.sch, ktorý nemáme stiahnutý, takže by sme hádali.' },
  { kod: 'BR-DEX-02, BR-DEX-03, BR-DEX-09 az BR-DEX-14', dovod: 'Týkajú sa podriadených riadkov a platby treťou stranou v rozšírení XRechnung. Tieto údaje sú v UBLExtensions, ktoré náš čítač zatiaľ nerozoberá.' },
  { kod: 'UBL-CR-*, UBL-SR-*, UBL-DT-*', dovod: 'Ide o 755 pravidiel zhody s jadrom EN 16931 v syntaxi UBL (napríklad "tento prvok UBL sa v EN 16931 nepoužíva"). Sú to prevažne varovania o nadbytočných prvkoch, nie chyby obsahu. Zatiaľ ich nekontrolujeme.' },
  { kod: 'XSD schema UBL 2.1', dovod: 'Nekontrolujeme poradie prvkov ani dátové typy podľa XSD. Na to by bol potrebný celý XSD validátor, ktorý v prehliadači nie je.' },
  { kod: 'Syntax CII (UN/CEFACT)', dovod: 'Súbor rozpoznáme a povieme to, ale pravidlá EN 16931 zatiaľ kontrolujeme len nad UBL 2.1.' }
];
