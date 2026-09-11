// pravidla-peppol.mjs - doplnkove pravidla Peppol BIS Billing 3.0 (PEPPOL-EN16931-R*, PEPPOL-COMMON-R*,
// PEPPOL-EN16931-CL*, PEPPOL-EN16931-P0*, PEPPOL-EN16931-F001).
// Nova implementacia v JavaScripte podla znenia pravidiel.

import * as K from './kodovniky.mjs';
import {
  deti, prve, cesta, jeden, txt, hod, atr, vsetky, xpath,
  cis, r2, volne, platnyDatum, pridaj
} from './pravidla-jadro.mjs';

const CH = 'chyba';
const VAR = 'varovanie';

// ---- kontrolne cislice pouzivane v PEPPOL-COMMON pravidlach

function gln(v) {
  if (!/^\d{8,14}$/.test(v)) return false;
  const c = v.split('').reverse().map(Number);
  let s = 0;
  for (let i = 1; i < c.length; i += 1) s += c[i] * (i % 2 === 1 ? 3 : 1);
  return (10 - (s % 10)) % 10 === c[0];
}

function mod11No(v) {
  if (!/^\d{9}$/.test(v)) return false;
  const w = [3, 2, 7, 6, 5, 4, 3, 2];
  let s = 0;
  for (let i = 0; i < 8; i += 1) s += Number(v[i]) * w[i];
  const z = s % 11;
  const k = z === 0 ? 0 : 11 - z;
  return k < 10 && k === Number(v[8]);
}

function mod97Be(v) {
  if (!/^\d{10}$/.test(v)) return false;
  const zaklad = Number(v.slice(0, 8));
  const kontrola = Number(v.slice(8));
  return 97 - (zaklad % 97) === kontrola;
}

function luhn(v) {
  if (!/^\d+$/.test(v)) return false;
  let s = 0;
  let dvoj = false;
  for (let i = v.length - 1; i >= 0; i -= 1) {
    let c = Number(v[i]);
    if (dvoj) { c *= 2; if (c > 9) c -= 9; }
    s += c;
    dvoj = !dvoj;
  }
  return s % 10 === 0;
}

function abnAu(v) {
  if (!/^\d{11}$/.test(v)) return false;
  const w = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  let s = (Number(v[0]) - 1) * w[0];
  for (let i = 1; i < 11; i += 1) s += Number(v[i]) * w[i];
  return s % 89 === 0;
}

function pivaIt(v) {
  if (!/^\d{11}$/.test(v)) return false;
  return luhn(v);
}

function codiceFiscaleIt(v) {
  if (/^\d{11}$/.test(v)) return pivaIt(v);
  return /^[A-Za-z]{6}\d{2}[A-Za-z]\d{2}[A-Za-z]\d{3}[A-Za-z]$/.test(v);
}

// ---- pomocky

function jeDe(ctx, ktora) {
  const c = ktora === 'dodavatel' ? 'cac:AccountingSupplierParty' : 'cac:AccountingCustomerParty';
  return hod(ctx.koren, c + '/cac:Party/cac:PostalAddress/cac:Country/cbc:IdentificationCode') === 'DE';
}

// vsetky uzly s danym atributom
function sAtributom(koren, meno) {
  const out = [];
  (function chod(n) {
    if (n.atr && n.atr[meno] !== undefined) out.push(n);
    for (const d of n.deti) chod(d);
  })(koren);
  return out;
}

export function pravidlaPeppol(ctx) {
  const d = ctx.koren;
  const kdeKoren = xpath(d);
  const obeDe = jeDe(ctx, 'dodavatel') && jeDe(ctx, 'odberatel');

  // R004 identifikator specifikacie
  const cust = hod(d, 'cbc:CustomizationID');
  if (!cust.startsWith(K.PROFILY.peppol)) {
    pridaj(ctx, 'PEPPOL-EN16931-R004', CH, prve(d, 'cbc:CustomizationID') || d, cust,
      'Pre Peppol musí cbc:CustomizationID (BT-24) začínať hodnotou ' + K.PROFILY.peppol + '. V súbore je "' + cust + '".',
      'Pro Peppol musí cbc:CustomizationID (BT-24) začínat hodnotou ' + K.PROFILY.peppol + '. V souboru je "' + cust + '".',
      'Für Peppol muss cbc:CustomizationID (BT-24) mit ' + K.PROFILY.peppol + ' beginnen. In der Datei steht "' + cust + '".',
      kdeKoren);
  }
  // R001 a R007 obchodny proces
  const profil = prve(d, 'cbc:ProfileID');
  if (!profil || txt(profil) === '') {
    pridaj(ctx, 'PEPPOL-EN16931-R001', CH, d, '',
      'Chýba obchodný proces (BT-23, cbc:ProfileID). Pre bežné fakturovanie doplňte ' + K.PROFILY.peppolProces + '.',
      'Chybí obchodní proces (BT-23, cbc:ProfileID). Pro běžné fakturování doplňte ' + K.PROFILY.peppolProces + '.',
      'Der Geschäftsprozess (BT-23, cbc:ProfileID) fehlt. Für die normale Rechnungsstellung ergänzen Sie ' + K.PROFILY.peppolProces + '.',
      kdeKoren);
  } else if (!/^urn:fdc:peppol\.eu:2017:poacc:billing:\d{2}:1\.0$/.test(txt(profil))) {
    pridaj(ctx, 'PEPPOL-EN16931-R007', CH, profil, txt(profil),
      'Obchodný proces (BT-23, cbc:ProfileID) musí mať tvar urn:fdc:peppol.eu:2017:poacc:billing:NN:1.0, kde NN je číslo procesu, napríklad 01.',
      'Obchodní proces (BT-23, cbc:ProfileID) musí mít tvar urn:fdc:peppol.eu:2017:poacc:billing:NN:1.0, kde NN je číslo procesu, například 01.',
      'Der Geschäftsprozess (BT-23, cbc:ProfileID) muss die Form urn:fdc:peppol.eu:2017:poacc:billing:NN:1.0 haben, wobei NN die Prozessnummer ist, zum Beispiel 01.');
  }
  // R002 pocet poznamok
  const poznamky = deti(d, 'cbc:Note');
  if (poznamky.length > 1 && !obeDe) {
    pridaj(ctx, 'PEPPOL-EN16931-R002', CH, poznamky[1], String(poznamky.length),
      'Na úrovni dokladu smie byť najviac jedna poznámka (BT-22, cbc:Note). V súbore ich je ' + poznamky.length + '. Spojte ich do jednej.',
      'Na úrovni dokladu smí být nejvýše jedna poznámka (BT-22, cbc:Note). V souboru jich je ' + poznamky.length + '. Spojte je do jedne.',
      'Auf Dokumentebene ist höchstens eine Bemerkung (BT-22, cbc:Note) erlaubt. In der Datei sind es ' + poznamky.length + '. Fassen Sie sie zusammen.');
  }
  // R003 referencia odberatela alebo objednavka
  if (hod(d, 'cbc:BuyerReference') === '' && hod(d, 'cac:OrderReference/cbc:ID') === '') {
    pridaj(ctx, 'PEPPOL-EN16931-R003', CH, d, '',
      'Doplňte referenciu odberateľa (BT-10, cbc:BuyerReference) alebo číslo objednávky (BT-13, cac:OrderReference/cbc:ID). Aspoň jedno z toho Peppol vyžaduje.',
      'Doplňte referenci odběratele (BT-10, cbc:BuyerReference) nebo číslo objednávky (BT-13, cac:OrderReference/cbc:ID). Alespoň jedno z toho Peppol vyžaduje.',
      'Ergänzen Sie die Leitweg- oder Käuferreferenz (BT-10, cbc:BuyerReference) oder die Bestellnummer (BT-13, cac:OrderReference/cbc:ID). Peppol verlangt mindestens eines davon.',
      kdeKoren);
  }
  // R005 mena uctovania DPH
  const mDane = prve(d, 'cbc:TaxCurrencyCode');
  if (mDane && txt(mDane) === ctx.mena && ctx.mena !== '') {
    pridaj(ctx, 'PEPPOL-EN16931-R005', CH, mDane, txt(mDane),
      'Mena účtovania DPH (BT-6) sa musí líšiť od meny faktúry (BT-5). Ak sú rovnaké, cbc:TaxCurrencyCode vynechajte.',
      'Měna účtování DPH (BT-6) se musí lišit od měny faktury (BT-5). Pokud jsou stejné, cbc:TaxCurrencyCode vynechejte.',
      'Der Steuerwährungscode (BT-6) muss sich von der Rechnungswährung (BT-5) unterscheiden. Sind sie gleich, lassen Sie cbc:TaxCurrencyCode weg.');
  }
  // R008 prazdne prvky
  const prazdne = [];
  (function chod(n) {
    if (n !== d && n.deti.length === 0 && n._text.trim() === '') prazdne.push(n);
    for (const x of n.deti) chod(x);
  })(d);
  for (const n of prazdne) {
    pridaj(ctx, 'PEPPOL-EN16931-R008', CH, n, '',
      'Prvok ' + n.meno + ' je prázdny. Peppol prázdne prvky nepovoluje: buď ho vyplňte, alebo celý odstráňte.',
      'Prvek ' + n.meno + ' je prázdný. Peppol prázdné prvky nepovoluje: buď jej vyplňte, nebo celý odstraňte.',
      'Das Element ' + n.meno + ' ist leer. Peppol erlaubt keine leeren Elemente: füllen Sie es aus oder entfernen Sie es ganz.');
  }
  // R010 a R020 elektronicke adresy
  if (!jeden(d, 'cac:AccountingCustomerParty/cac:Party/cbc:EndpointID')) {
    pridaj(ctx, 'PEPPOL-EN16931-R010', CH, jeden(d, 'cac:AccountingCustomerParty/cac:Party') || d, '',
      'Chýba elektronická adresa odberateľa (BT-49, cbc:EndpointID so schemeID). Bez nej sa faktúra cez Peppol nedoručuje.',
      'Chybí elektronická adresa odběratele (BT-49, cbc:EndpointID se schemeID). Bez ní se faktura přes Peppol nedoručuje.',
      'Die elektronische Adresse des Käufers (BT-49, cbc:EndpointID mit schemeID) fehlt. Ohne sie wird die Rechnung über Peppol nicht zugestellt.',
      kdeKoren);
  }
  if (!jeden(d, 'cac:AccountingSupplierParty/cac:Party/cbc:EndpointID')) {
    pridaj(ctx, 'PEPPOL-EN16931-R020', CH, jeden(d, 'cac:AccountingSupplierParty/cac:Party') || d, '',
      'Chýba elektronická adresa dodávateľa (BT-34, cbc:EndpointID so schemeID).',
      'Chybí elektronická adresa dodavatele (BT-34, cbc:EndpointID se schemeID).',
      'Die elektronische Adresse des Verkäufers (BT-34, cbc:EndpointID mit schemeID) fehlt.',
      kdeKoren);
  }
  // R040 az R043 zlavy a priplatky
  const vsetkyAc = ctx.acDok.concat(ctx.acRiadkov);
  for (const ac of vsetkyAc) {
    const maNasobok = !!prve(ac, 'cbc:MultiplierFactorNumeric');
    const maZaklad = !!prve(ac, 'cbc:BaseAmount');
    if (maNasobok && !maZaklad) {
      pridaj(ctx, 'PEPPOL-EN16931-R041', CH, ac, hod(ac, 'cbc:MultiplierFactorNumeric'),
        'Ak je uvedené percento zľavy alebo príplatku (cbc:MultiplierFactorNumeric), musí byť uvedený aj základ (cbc:BaseAmount).',
        'Pokud je uvedeno procento slevy nebo příplatku (cbc:MultiplierFactorNumeric), musí být uveden i základ (cbc:BaseAmount).',
        'Wenn der Prozentsatz (cbc:MultiplierFactorNumeric) angegeben ist, muss auch der Grundbetrag (cbc:BaseAmount) angegeben werden.');
    }
    if (maZaklad && !maNasobok) {
      pridaj(ctx, 'PEPPOL-EN16931-R042', CH, ac, hod(ac, 'cbc:BaseAmount'),
        'Ak je uvedený základ zľavy alebo príplatku (cbc:BaseAmount), musí byť uvedené aj percento (cbc:MultiplierFactorNumeric).',
        'Pokud je uveden základ slevy nebo příplatku (cbc:BaseAmount), musí být uvedeno i procento (cbc:MultiplierFactorNumeric).',
        'Wenn der Grundbetrag (cbc:BaseAmount) angegeben ist, muss auch der Prozentsatz (cbc:MultiplierFactorNumeric) angegeben werden.');
    }
    if (maZaklad && maNasobok) {
      const suma = prve(ac, 'cbc:Amount') ? cis(hod(ac, 'cbc:Amount')) : 0;
      const ocak = cis(hod(ac, 'cbc:BaseAmount')) * cis(hod(ac, 'cbc:MultiplierFactorNumeric')) / 100;
      if (!volne(suma, ocak, 0.02)) {
        pridaj(ctx, 'PEPPOL-EN16931-R040', CH, prve(ac, 'cbc:Amount') || ac, hod(ac, 'cbc:Amount'),
          'Suma zľavy alebo príplatku má byť základ krát percento delené 100, teda ' + (Number.isFinite(ocak) ? ocak.toFixed(2) : '?') + '. V súbore je ' + hod(ac, 'cbc:Amount') + '.',
          'Částka slevy nebo příplatku má být základ krát procento děleno 100, tedy ' + (Number.isFinite(ocak) ? ocak.toFixed(2) : '?') + '. V souboru je ' + hod(ac, 'cbc:Amount') + '.',
          'Der Abschlags- oder Zuschlagsbetrag soll Grundbetrag mal Prozentsatz geteilt durch 100 sein, also ' + (Number.isFinite(ocak) ? ocak.toFixed(2) : '?') + '. In der Datei steht ' + hod(ac, 'cbc:Amount') + '.');
      }
    }
    const ind = hod(ac, 'cbc:ChargeIndicator');
    if (ind !== 'true' && ind !== 'false') {
      pridaj(ctx, 'PEPPOL-EN16931-R043', CH, prve(ac, 'cbc:ChargeIndicator') || ac, ind,
        'cbc:ChargeIndicator musí mať hodnotu true (príplatok) alebo false (zľava). V súbore je "' + ind + '".',
        'cbc:ChargeIndicator musí mít hodnotu true (příplatek) nebo false (sleva). V souboru je "' + ind + '".',
        'cbc:ChargeIndicator muss true (Zuschlag) oder false (Abschlag) sein. In der Datei steht "' + ind + '".');
    }
  }
  // R044 a R046 zlava na urovni ceny
  for (const r of ctx.riadky) {
    for (const ac of cesta(r, 'cac:Price/cac:AllowanceCharge')) {
      if (hod(ac, 'cbc:ChargeIndicator') !== 'false') {
        pridaj(ctx, 'PEPPOL-EN16931-R044', CH, ac, hod(ac, 'cbc:ChargeIndicator'),
          'Na úrovni ceny sa príplatok nepripúšťa. cac:Price/cac:AllowanceCharge musí mať cbc:ChargeIndicator s hodnotou false.',
          'Na úrovni ceny se příplatek nepřipouští. cac:Price/cac:AllowanceCharge musí mít cbc:ChargeIndicator s hodnotou false.',
          'Auf Preisebene ist kein Zuschlag erlaubt. cac:Price/cac:AllowanceCharge muss cbc:ChargeIndicator false haben.');
      }
      if (prve(ac, 'cbc:BaseAmount')) {
        const cena = cis(hod(r, 'cac:Price/cbc:PriceAmount'));
        const ocak = cis(hod(ac, 'cbc:BaseAmount')) - cis(hod(ac, 'cbc:Amount'));
        if (!(Number.isFinite(cena) && Number.isFinite(ocak) && r2(cena) === r2(ocak))) {
          pridaj(ctx, 'PEPPOL-EN16931-R046', CH, ac, hod(r, 'cac:Price/cbc:PriceAmount'),
            'Cena bez DPH (BT-146) má byť hrubá cena minus zľava, teda ' + (Number.isFinite(ocak) ? ocak.toFixed(2) : '?') + '. V súbore je ' + hod(r, 'cac:Price/cbc:PriceAmount') + '.',
            'Cena bez DPH (BT-146) má být hrubá cena minus sleva, tedy ' + (Number.isFinite(ocak) ? ocak.toFixed(2) : '?') + '. V souboru je ' + hod(r, 'cac:Price/cbc:PriceAmount') + '.',
            'Der Nettopreis (BT-146) soll Bruttopreis minus Abschlag sein, also ' + (Number.isFinite(ocak) ? ocak.toFixed(2) : '?') + '. In der Datei steht ' + hod(r, 'cac:Price/cbc:PriceAmount') + '.');
        }
      }
    }
  }
  // R051 mena vsetkych suma
  if (ctx.mena !== '') {
    for (const n of sAtributom(d, 'currencyID')) {
      const c = n.atr.currencyID;
      if (c === ctx.mena) continue;
      // vynimka: suma DPH v mene uctovania (BT-111)
      if (ctx.menaDane !== '' && c === ctx.menaDane && n.k === 'cbc:TaxAmount') continue;
      pridaj(ctx, 'PEPPOL-EN16931-R051', CH, n, c,
        'Všetky sumy musia byť v mene faktúry (' + ctx.mena + '). Prvok ' + n.meno + ' má currencyID="' + c + '".',
        'Všechny částky musí být v měně faktury (' + ctx.mena + '). Prvek ' + n.meno + ' má currencyID="' + c + '".',
        'Alle Beträge müssen in der Rechnungswährung (' + ctx.mena + ') stehen. Das Element ' + n.meno + ' hat currencyID="' + c + '".');
    }
  }
  // R053 a R054 pocet skupin dane
  const sPodsuhrnmi = ctx.danCelkom.filter((t) => deti(t, 'cac:TaxSubtotal').length > 0);
  const bezPodsuhrnov = ctx.danCelkom.filter((t) => deti(t, 'cac:TaxSubtotal').length === 0);
  if (sPodsuhrnmi.length !== 1) {
    pridaj(ctx, 'PEPPOL-EN16931-R053', CH, d, String(sPodsuhrnmi.length),
      'Doklad musí mať práve jednu skupinu cac:TaxTotal s rozpisom DPH (cac:TaxSubtotal). Našli sme ich ' + sPodsuhrnmi.length + '.',
      'Doklad musí mít právě jednu skupinu cac:TaxTotal s rozpisem DPH (cac:TaxSubtotal). Našli jsme jich ' + sPodsuhrnmi.length + '.',
      'Der Beleg braucht genau eine cac:TaxTotal-Gruppe mit Steueraufschlüsselung (cac:TaxSubtotal). Gefunden: ' + sPodsuhrnmi.length + '.',
      kdeKoren);
  }
  const ocakBez = ctx.menaDane !== '' ? 1 : 0;
  if (bezPodsuhrnov.length !== ocakBez) {
    pridaj(ctx, 'PEPPOL-EN16931-R054', CH, d, String(bezPodsuhrnov.length),
      'Skupina cac:TaxTotal bez rozpisu DPH smie byť len vtedy, keď je uvedená mena účtovania DPH (BT-6). Očakávali sme ' + ocakBez + ', našli sme ' + bezPodsuhrnov.length + '.',
      'Skupina cac:TaxTotal bez rozpisu DPH smí být jen tehdy, když je uvedena měna účtování DPH (BT-6). Očekávali jsme ' + ocakBez + ', našli jsme ' + bezPodsuhrnov.length + '.',
      'Eine cac:TaxTotal-Gruppe ohne Steueraufschlüsselung ist nur zulässig, wenn der Steuerwährungscode (BT-6) angegeben ist. Erwartet: ' + ocakBez + ', gefunden: ' + bezPodsuhrnov.length + '.',
      kdeKoren);
  }
  // R055 zhodne znamienko
  if (ctx.menaDane !== '' && ctx.mena !== '') {
    const vDani = [];
    const vFaktura = [];
    for (const t of ctx.danCelkom) {
      for (const ta of deti(t, 'cbc:TaxAmount')) {
        if (atr(ta, 'currencyID') === ctx.menaDane) vDani.push(cis(txt(ta)));
        if (atr(ta, 'currencyID') === ctx.mena) vFaktura.push(cis(txt(ta)));
      }
    }
    if (vDani.length && vFaktura.length) {
      const a = vDani[0];
      const b = vFaktura[0];
      const rovnake = (a <= 0 && b <= 0) || (a >= 0 && b >= 0);
      if (!rovnake) {
        pridaj(ctx, 'PEPPOL-EN16931-R055', CH, d, a + ' / ' + b,
          'Suma DPH v mene faktúry (BT-110) a v mene účtovania DPH (BT-111) musia mať rovnaké znamienko.',
          'Částka DPH v měně faktury (BT-110) a v měně účtování DPH (BT-111) musí mít stejné znaménko.',
          'Der Steuerbetrag in Rechnungswährung (BT-110) und in Steuerwährung (BT-111) müssen dasselbe Vorzeichen haben.',
          kdeKoren);
      }
    }
  }
  // R061 mandat pri inkase
  for (const pm of ctx.platby) {
    const kod = hod(pm, 'cbc:PaymentMeansCode');
    if ((kod === '49' || kod === '59') && !jeden(pm, 'cac:PaymentMandate/cbc:ID')) {
      pridaj(ctx, 'PEPPOL-EN16931-R061', CH, pm, kod,
        'Pri inkase (spôsob platby ' + kod + ') musí byť uvedený referenčný údaj mandátu (BT-89) v cac:PaymentMandate/cbc:ID.',
        'Při inkasu (způsob platby ' + kod + ') musí být uveden referenční údaj mandátu (BT-89) v cac:PaymentMandate/cbc:ID.',
        'Bei Lastschrift (Zahlungsart ' + kod + ') muss die Mandatsreferenz (BT-89) in cac:PaymentMandate/cbc:ID stehen.');
    }
  }
  // R080 pocet odkazov na projekt
  const projekty = deti(d, 'cac:AdditionalDocumentReference').filter((n) => hod(n, 'cbc:DocumentTypeCode') === '50');
  if (projekty.length > 1) {
    pridaj(ctx, 'PEPPOL-EN16931-R080', CH, projekty[1], String(projekty.length),
      'Na úrovni dokladu smie byť najviac jeden odkaz na projekt (BT-11). Našli sme ich ' + projekty.length + '.',
      'Na úrovni dokladu smí být nejvýše jeden odkaz na projekt (BT-11). Našli jsme jich ' + projekty.length + '.',
      'Auf Dokumentebene ist höchstens ein Projektverweis (BT-11) erlaubt. Gefunden: ' + projekty.length + '.');
  }
  // R100, R101, R110, R111, R120, R121, R130 na urovni riadku
  const obdZac = hod(d, 'cac:InvoicePeriod/cbc:StartDate');
  const obdKon = hod(d, 'cac:InvoicePeriod/cbc:EndDate');
  ctx.riadky.forEach((r, i) => {
    const cisloR = i + 1;
    const odkazy = deti(r, 'cac:DocumentReference');
    if (odkazy.length > 1) {
      pridaj(ctx, 'PEPPOL-EN16931-R100', CH, odkazy[1], String(odkazy.length),
        'Riadok ' + cisloR + ': na jeden riadok smie byť najviac jeden odkaz na fakturovaný objekt (cac:DocumentReference).',
        'Řádek ' + cisloR + ': na jeden řádek smí být nejvýše jeden odkaz na fakturovaný objekt (cac:DocumentReference).',
        'Position ' + cisloR + ': Pro eine Position ist höchstens ein Objektverweis (cac:DocumentReference) erlaubt.');
    }
    for (const o of odkazy) {
      if (hod(o, 'cbc:DocumentTypeCode') !== '130') {
        pridaj(ctx, 'PEPPOL-EN16931-R101', CH, o, hod(o, 'cbc:DocumentTypeCode'),
          'Riadok ' + cisloR + ': cac:DocumentReference sa v riadku používa len na fakturovaný objekt a musí mať cbc:DocumentTypeCode s hodnotou 130.',
          'Řádek ' + cisloR + ': cac:DocumentReference se v řádku používá jen na fakturovaný objekt a musí mít cbc:DocumentTypeCode s hodnotou 130.',
          'Position ' + cisloR + ': cac:DocumentReference dient in der Position nur der Objektkennung und braucht cbc:DocumentTypeCode 130.');
      }
    }
    const rZac = hod(r, 'cac:InvoicePeriod/cbc:StartDate');
    const rKon = hod(r, 'cac:InvoicePeriod/cbc:EndDate');
    if (obdZac !== '' && rZac !== '' && rZac < obdZac) {
      pridaj(ctx, 'PEPPOL-EN16931-R110', CH, jeden(r, 'cac:InvoicePeriod/cbc:StartDate'), rZac,
        'Riadok ' + cisloR + ': začiatok obdobia riadku (' + rZac + ') je pred začiatkom obdobia faktúry (' + obdZac + ').',
        'Řádek ' + cisloR + ': začátek období řádku (' + rZac + ') je před začátkem období faktury (' + obdZac + ').',
        'Position ' + cisloR + ': Der Beginn des Positionszeitraums (' + rZac + ') liegt vor dem Beginn des Rechnungszeitraums (' + obdZac + ').');
    }
    if (obdKon !== '' && rKon !== '' && rKon > obdKon) {
      pridaj(ctx, 'PEPPOL-EN16931-R111', CH, jeden(r, 'cac:InvoicePeriod/cbc:EndDate'), rKon,
        'Riadok ' + cisloR + ': koniec obdobia riadku (' + rKon + ') je po konci obdobia faktúry (' + obdKon + ').',
        'Řádek ' + cisloR + ': konec období řádku (' + rKon + ') je po konci období faktury (' + obdKon + ').',
        'Position ' + cisloR + ': Das Ende des Positionszeitraums (' + rKon + ') liegt nach dem Ende des Rechnungszeitraums (' + obdKon + ').');
    }
    // R120 suma riadku
    const mn = prve(r, 'cbc:InvoicedQuantity') || prve(r, 'cbc:CreditedQuantity');
    const cena = cis(hod(r, 'cac:Price/cbc:PriceAmount'));
    const zakl = prve(jeden(r, 'cac:Price') || r, 'cbc:BaseQuantity');
    const zaklMn = zakl ? cis(txt(zakl)) : 1;
    const suma = cis(hod(r, 'cbc:LineExtensionAmount'));
    if (mn && Number.isFinite(cena) && Number.isFinite(suma) && Number.isFinite(zaklMn) && zaklMn !== 0) {
      const q = cis(txt(mn));
      const zl = deti(r, 'cac:AllowanceCharge').filter((a) => hod(a, 'cbc:ChargeIndicator') === 'false');
      const pr = deti(r, 'cac:AllowanceCharge').filter((a) => hod(a, 'cbc:ChargeIndicator') === 'true');
      const sucet = (pole) => pole.reduce((s, a) => {
        const v = cis(hod(a, 'cbc:Amount'));
        return s + (Number.isFinite(v) ? v : 0);
      }, 0);
      if (Number.isFinite(q)) {
        const ocak = q * (cena / zaklMn) + sucet(pr) - sucet(zl);
        if (!volne(suma, ocak, 0.02)) {
          pridaj(ctx, 'PEPPOL-EN16931-R120', CH, prve(r, 'cbc:LineExtensionAmount'), hod(r, 'cbc:LineExtensionAmount'),
            'Riadok ' + cisloR + ': suma riadku má byť množstvo ' + q + ' krát cena ' + cena + (zaklMn !== 1 ? ' delené základným množstvom ' + zaklMn : '') +
              ' plus príplatky minus zľavy, teda ' + ocak.toFixed(2) + '. V súbore je ' + hod(r, 'cbc:LineExtensionAmount') + '.',
            'Řádek ' + cisloR + ': částka řádku má být množství ' + q + ' krát cena ' + cena + (zaklMn !== 1 ? ' děleno základním množstvím ' + zaklMn : '') +
              ' plus příplatky minus slevy, tedy ' + ocak.toFixed(2) + '. V souboru je ' + hod(r, 'cbc:LineExtensionAmount') + '.',
            'Position ' + cisloR + ': Der Positionsbetrag soll Menge ' + q + ' mal Preis ' + cena + (zaklMn !== 1 ? ' geteilt durch die Basismenge ' + zaklMn : '') +
              ' plus Zuschläge minus Abschläge sein, also ' + ocak.toFixed(2) + '. In der Datei steht ' + hod(r, 'cbc:LineExtensionAmount') + '.');
        }
      }
    }
    if (zakl && !(Number.isFinite(zaklMn) && zaklMn > 0)) {
      pridaj(ctx, 'PEPPOL-EN16931-R121', CH, zakl, txt(zakl),
        'Riadok ' + cisloR + ': základné množstvo ceny (BT-149, cac:Price/cbc:BaseQuantity) musí byť väčšie ako nula.',
        'Řádek ' + cisloR + ': základní množství ceny (BT-149, cac:Price/cbc:BaseQuantity) musí být větší než nula.',
        'Position ' + cisloR + ': Die Preisbasismenge (BT-149, cac:Price/cbc:BaseQuantity) muss größer als null sein.');
    }
    if (zakl && atr(zakl, 'unitCode') !== undefined && mn && atr(mn, 'unitCode') !== undefined) {
      if (atr(zakl, 'unitCode') !== atr(mn, 'unitCode')) {
        pridaj(ctx, 'PEPPOL-EN16931-R130', CH, zakl, String(atr(zakl, 'unitCode')),
          'Riadok ' + cisloR + ': jednotka základného množstva (' + atr(zakl, 'unitCode') + ') musí byť rovnaká ako jednotka fakturovaného množstva (' + atr(mn, 'unitCode') + ').',
          'Řádek ' + cisloR + ': jednotka základního množství (' + atr(zakl, 'unitCode') + ') musí být stejná jako jednotka fakturovaného množství (' + atr(mn, 'unitCode') + ').',
          'Position ' + cisloR + ': Die Einheit der Basismenge (' + atr(zakl, 'unitCode') + ') muss der Einheit der berechneten Menge (' + atr(mn, 'unitCode') + ') entsprechen.');
      }
    }
  });

  // ---- PEPPOL-COMMON-R040 az R053: formaty narodnych identifikatorov
  const identifikatory = [];
  for (const n of vsetky(d, 'cbc:EndpointID')) identifikatory.push(n);
  for (const p of vsetky(d, 'cac:PartyIdentification')) for (const n of deti(p, 'cbc:ID')) identifikatory.push(n);
  for (const n of vsetky(d, 'cbc:CompanyID')) identifikatory.push(n);

  const narodne = [
    { schemy: ['0088'], kod: 'PEPPOL-COMMON-R040', zav: CH, test: gln, sk: 'GLN', popisSk: 'GLN musí mať platnú kontrolnú číslicu podľa pravidiel GS1.', popisCs: 'GLN musí mít platnou kontrolní číslici podle pravidel GS1.', popisDe: 'Die GLN braucht eine gültige Prüfziffer nach GS1-Regeln.' },
    { schemy: ['0192'], kod: 'PEPPOL-COMMON-R041', zav: CH, test: mod11No, sk: 'nórske organizačné číslo', popisSk: 'Nórske organizačné číslo musí mať 9 číslic a platnú kontrolnú číslicu (mod 11).', popisCs: 'Norské organizační číslo musí mít 9 číslic a platnou kontrolní číslici (mod 11).', popisDe: 'Die norwegische Organisationsnummer braucht 9 Ziffern und eine gültige Prüfziffer (Modulo 11).' },
    { schemy: ['0184'], kod: 'PEPPOL-COMMON-R042', zav: CH, test: (v) => /^\d{8}$/.test(v) || /^DK\d{8}$/.test(v), sk: 'dánske CVR', popisSk: 'Dánske číslo CVR musí byť 8 číslic alebo DK a 8 číslic.', popisCs: 'Dánské číslo CVR musí být 8 číslic nebo DK a 8 číslic.', popisDe: 'Die dänische CVR-Nummer besteht aus 8 Ziffern oder DK und 8 Ziffern.' },
    { schemy: ['0096'], kod: 'PEPPOL-COMMON-R052', zav: VAR, test: (v) => /^\d{10}$/.test(v), sk: 'dánske číslo P', popisSk: 'Dánske číslo P má mať 10 číslic.', popisCs: 'Dánské číslo P má mít 10 číslic.', popisDe: 'Die dänische P-Nummer soll 10 Ziffern haben.' },
    { schemy: ['0198'], kod: 'PEPPOL-COMMON-R053', zav: VAR, test: (v) => /^DK\d{8}$/.test(v), sk: 'dánske číslo SE', popisSk: 'Dánske číslo SE má mať tvar DK a 8 číslic.', popisCs: 'Dánské číslo SE má mít tvar DK a 8 číslic.', popisDe: 'Die dänische SE-Nummer soll die Form DK und 8 Ziffern haben.' },
    { schemy: ['0208'], kod: 'PEPPOL-COMMON-R043', zav: CH, test: mod97Be, sk: 'belgické číslo podniku', popisSk: 'Belgické číslo podniku musí mať 10 číslic a platnú kontrolu mod 97.', popisCs: 'Belgické číslo podniku musí mít 10 číslic a platnou kontrolu mod 97.', popisDe: 'Die belgische Unternehmensnummer braucht 10 Ziffern und eine gültige Modulo-97-Prüfung.' },
    { schemy: ['0201'], kod: 'PEPPOL-COMMON-R044', zav: VAR, test: (v) => /^[A-Za-z0-9]{6}$/.test(v), sk: 'taliansky kód IPA', popisSk: 'Taliansky kód IPA má mať 6 alfanumerických znakov.', popisCs: 'Italský kód IPA má mít 6 alfanumerických znaků.', popisDe: 'Der italienische IPA-Code soll 6 alphanumerische Zeichen haben.' },
    { schemy: ['0210'], kod: 'PEPPOL-COMMON-R045', zav: VAR, test: codiceFiscaleIt, sk: 'taliansky Codice Fiscale', popisSk: 'Taliansky Codice Fiscale má mať 16 znakov alebo 11 číslic s platnou kontrolnou číslicou.', popisCs: 'Italský Codice Fiscale má mít 16 znaků nebo 11 číslic s platnou kontrolní číslicí.', popisDe: 'Der italienische Codice Fiscale soll 16 Zeichen oder 11 Ziffern mit gültiger Prüfziffer haben.' },
    { schemy: ['9907'], kod: 'PEPPOL-COMMON-R046', zav: VAR, test: codiceFiscaleIt, sk: 'taliansky Codice Fiscale', popisSk: 'Taliansky Codice Fiscale má mať 16 znakov alebo 11 číslic s platnou kontrolnou číslicou.', popisCs: 'Italský Codice Fiscale má mít 16 znaků nebo 11 číslic s platnou kontrolní číslicí.', popisDe: 'Der italienische Codice Fiscale soll 16 Zeichen oder 11 Ziffern mit gültiger Prüfziffer haben.' },
    { schemy: ['0211'], kod: 'PEPPOL-COMMON-R047', zav: VAR, test: (v) => pivaIt(v.replace(/^IT/i, '')), sk: 'talianska Partita IVA', popisSk: 'Talianska Partita IVA má mať 11 číslic s platnou kontrolnou číslicou.', popisCs: 'Italská Partita IVA má mít 11 číslic s platnou kontrolní číslicí.', popisDe: 'Die italienische Partita IVA soll 11 Ziffern mit gültiger Prüfziffer haben.' },
    { schemy: ['9906'], kod: 'PEPPOL-COMMON-R048', zav: VAR, test: (v) => pivaIt(v.replace(/^IT/i, '')), sk: 'talianska Partita IVA', popisSk: 'Talianska Partita IVA má mať 11 číslic s platnou kontrolnou číslicou.', popisCs: 'Italská Partita IVA má mít 11 číslic s platnou kontrolní číslicí.', popisDe: 'Die italienische Partita IVA soll 11 Ziffern mit gültiger Prüfziffer haben.' },
    { schemy: ['0007'], kod: 'PEPPOL-COMMON-R049', zav: CH, test: (v) => /^\d{10}$/.test(v) && luhn(v), sk: 'švédske organizačné číslo', popisSk: 'Švédske organizačné číslo musí mať 10 číslic a platnú kontrolnú číslicu.', popisCs: 'Švédské organizační číslo musí mít 10 číslic a platnou kontrolní číslici.', popisDe: 'Die schwedische Organisationsnummer braucht 10 Ziffern und eine gültige Prüfziffer.' },
    { schemy: ['0151'], kod: 'PEPPOL-COMMON-R050', zav: CH, test: abnAu, sk: 'austrálske ABN', popisSk: 'Austrálske číslo ABN musí mať 11 číslic a platnú kontrolu.', popisCs: 'Australské číslo ABN musí mít 11 číslic a platnou kontrolu.', popisDe: 'Die australische ABN braucht 11 Ziffern und eine gültige Prüfung.' }
  ];
  for (const n of identifikatory) {
    const schema = n.atr.schemeID;
    if (schema === undefined) continue;
    const v = txt(n);
    if (v === '') continue;
    for (const p of narodne) {
      if (p.schemy.indexOf(String(schema).trim()) === -1) continue;
      if (!p.test(v)) {
        pridaj(ctx, p.kod, p.zav, n, v,
          p.popisSk + ' Hodnota "' + v + '" pri schemeID="' + schema + '" tomu nezodpovedá.',
          p.popisCs + ' Hodnota "' + v + '" při schemeID="' + schema + '" tomu neodpovídá.',
          p.popisDe + ' Der Wert "' + v + '" bei schemeID="' + schema + '" entspricht dem nicht.');
      }
    }
  }

  // ---- kodovnikove pravidla Peppol
  for (const n of vsetky(d, 'cbc:EmbeddedDocumentBinaryObject')) {
    const v = n.atr.mimeCode;
    if (v !== undefined && !K.MIME_PRILOHY.has(String(v).trim())) {
      pridaj(ctx, 'PEPPOL-EN16931-CL001', CH, n, v,
        'Typ súboru prílohy (mimeCode="' + v + '") nie je v zozname povolených. Peppol pripúšťa application/pdf, image/png, image/jpeg, text/csv, xlsx a ods.',
        'Typ souboru přílohy (mimeCode="' + v + '") není v seznamu povolených. Peppol připouští application/pdf, image/png, image/jpeg, text/csv, xlsx a ods.',
        'Der Dateityp der Anlage (mimeCode="' + v + '") ist nicht zugelassen. Peppol erlaubt application/pdf, image/png, image/jpeg, text/csv, xlsx und ods.');
    }
  }
  for (const [pole, kod, zoznam, nazovKod] of [
    [ctx.zlavyDok.concat(ctx.zlavyRiadkov), 'PEPPOL-EN16931-CL002', K.UNTDID_5189, 'UNCL 5189'],
    [ctx.priplatkyDok.concat(ctx.priplatkyRiadkov), 'PEPPOL-EN16931-CL003', K.UNTDID_7161, 'UNCL 7161']
  ]) {
    for (const ac of pole) {
      for (const n of deti(ac, 'cbc:AllowanceChargeReasonCode')) {
        const v = txt(n);
        if (v !== '' && !zoznam.has(v)) {
          pridaj(ctx, kod, CH, n, v,
            'Kód dôvodu "' + v + '" nie je v kódovníku ' + nazovKod + '.',
            'Kód důvodu "' + v + '" není v číselníku ' + nazovKod + '.',
            'Der Grundcode "' + v + '" steht nicht in der Codeliste ' + nazovKod + '.');
        }
      }
    }
  }
  for (const ob of vsetky(d, 'cac:InvoicePeriod')) {
    for (const n of deti(ob, 'cbc:DescriptionCode')) {
      const v = txt(n);
      if (v !== '' && !K.UNTDID_2005.has(v)) {
        pridaj(ctx, 'PEPPOL-EN16931-CL006', CH, n, v,
          'Kód dátumu vzniku daňovej povinnosti (BT-8) musí byť 3, 35 alebo 432.',
          'Kód data uskutečnění plnění (BT-8) musí být 3, 35 nebo 432.',
          'Der Code des Steuerstichtags (BT-8) muss 3, 35 oder 432 sein.');
      }
    }
  }
  for (const n of sAtributom(d, 'currencyID')) {
    const v = String(n.atr.currencyID).trim();
    if (!K.ISO_4217.has(v)) {
      pridaj(ctx, 'PEPPOL-EN16931-CL007', CH, n, v,
        'Atribút currencyID prvku ' + n.meno + ' musí byť kód meny podľa ISO 4217, napríklad EUR.',
        'Atribut currencyID prvku ' + n.meno + ' musí být kód měny podle ISO 4217, například EUR.',
        'Das Attribut currencyID von ' + n.meno + ' muss ein Währungscode nach ISO 4217 sein, zum Beispiel EUR.');
    }
  }
  for (const n of vsetky(d, 'cbc:EndpointID')) {
    const v = n.atr.schemeID;
    if (v !== undefined && !K.EAS_PEPPOL.has(String(v).trim())) {
      pridaj(ctx, 'PEPPOL-EN16931-CL008', CH, n, v,
        'schemeID="' + v + '" nie je v zozname CEF EAS, ktorý Peppol pripúšťa pre elektronickú adresu. Pre slovenské DIČ použite 0245, pre nemecké USt-IdNr. 9930.',
        'schemeID="' + v + '" není v seznamu CEF EAS, který Peppol připouští pro elektronickou adresu. Pro slovenské DIČ použijte 0245, pro německé USt-IdNr. 9930. Kód pro jinou zemi najdete v seznamu CEF EAS.',
        'schemeID="' + v + '" steht nicht in der CEF-EAS-Liste, die Peppol für die elektronische Adresse zulässt. Für die deutsche USt-IdNr. verwenden Sie 9930.');
    }
  }
  // P0100 a P0101 typ dokladu pre proces 01
  const cisloProcesu = /billing:(\d{2}):1\.0$/.exec(hod(d, 'cbc:ProfileID'));
  if (cisloProcesu && cisloProcesu[1] === '01') {
    const povoleneF = new Set('71 80 82 84 102 218 219 326 331 380 382 383 384 386 388 393 395 553 575 623 780 817 870 875 876 877'.split(' '));
    const povoleneD = new Set(['381', '396', '81', '83', '532']);
    for (const n of deti(d, 'cbc:InvoiceTypeCode')) {
      const v = txt(n);
      if (v !== '' && !povoleneF.has(v)) {
        pridaj(ctx, 'PEPPOL-EN16931-P0100', CH, n, v,
          'V procese 01 nie je kód typu faktúry ' + v + ' povolený. Pre bežnú faktúru použite 380.',
          'V procesu 01 není kód typu faktury ' + v + ' povolen. Pro běžnou fakturu použijte 380.',
          'Im Prozess 01 ist der Rechnungstyp-Code ' + v + ' nicht zugelassen. Für eine normale Rechnung verwenden Sie 380.');
      }
    }
    for (const n of deti(d, 'cbc:CreditNoteTypeCode')) {
      const v = txt(n);
      if (v !== '' && !povoleneD.has(v)) {
        pridaj(ctx, 'PEPPOL-EN16931-P0101', CH, n, v,
          'V procese 01 nie je kód typu dobropisu ' + v + ' povolený. Pre bežný dobropis použite 381.',
          'V procesu 01 není kód typu dobropisu ' + v + ' povolen. Pro běžný dobropis použijte 381.',
          'Im Prozess 01 ist der Gutschrifttyp-Code ' + v + ' nicht zugelassen. Für eine normale Gutschrift verwenden Sie 381.');
      }
    }
  }
  // P0112 kody 326 a 384 len medzi nemeckymi stranami
  for (const n of deti(d, 'cbc:InvoiceTypeCode')) {
    const v = txt(n);
    if ((v === '326' || v === '384') && !obeDe) {
      pridaj(ctx, 'PEPPOL-EN16931-P0112', CH, n, v,
        'Kód typu dokladu ' + v + ' sa v Peppole používa len vtedy, keď sú dodávateľ aj odberateľ z Nemecka.',
        'Kód typu dokladu ' + v + ' se v Peppolu používá jen tehdy, když jsou dodavatel i odběratel z Německa.',
        'Der Rechnungstyp-Code ' + v + ' ist in Peppol nur zulässig, wenn Verkäufer und Käufer aus Deutschland sind.');
    }
  }
  // P0104 az P0111 kod oslobodenia musi sediet s kategoriou
  const parySVatex = [
    ['VATEX-EU-G', 'G', 'PEPPOL-EN16931-P0104'],
    ['VATEX-EU-O', 'O', 'PEPPOL-EN16931-P0105'],
    ['VATEX-EU-IC', 'K', 'PEPPOL-EN16931-P0106'],
    ['VATEX-EU-AE', 'AE', 'PEPPOL-EN16931-P0107'],
    ['VATEX-EU-D', 'E', 'PEPPOL-EN16931-P0108'],
    ['VATEX-EU-F', 'E', 'PEPPOL-EN16931-P0109'],
    ['VATEX-EU-I', 'E', 'PEPPOL-EN16931-P0110'],
    ['VATEX-EU-J', 'E', 'PEPPOL-EN16931-P0111']
  ];
  for (const tk of vsetky(d, 'cac:TaxCategory')) {
    const kodOsl = hod(tk, 'cbc:TaxExemptionReasonCode').toUpperCase();
    if (kodOsl === '') continue;
    for (const [vatex, kat, kodPravidla] of parySVatex) {
      if (kodOsl !== vatex) continue;
      const idKat = hod(tk, 'cbc:ID');
      if (idKat !== kat) {
        pridaj(ctx, kodPravidla, CH, tk, idKat,
          'Kód oslobodenia ' + vatex + ' patrí ku kategórii DPH ' + kat + ', v súbore je kategória ' + idKat + '.',
          'Kód osvobození ' + vatex + ' patří ke kategorii DPH ' + kat + ', v souboru je kategorie ' + idKat + '.',
          'Der Befreiungscode ' + vatex + ' gehört zur Umsatzsteuerkategorie ' + kat + ', in der Datei steht ' + idKat + '.');
      }
    }
  }
  // F001 format datumov
  const datumove = 'cbc:IssueDate|cbc:DueDate|cbc:TaxPointDate|cbc:StartDate|cbc:EndDate|cbc:ActualDeliveryDate|cbc:PaymentDueDate';
  for (const n of vsetky(d, datumove)) {
    const v = txt(n);
    if (v === '') continue;
    if (v.length !== 10 || !platnyDatum(v)) {
      pridaj(ctx, 'PEPPOL-EN16931-F001', CH, n, v,
        'Dátum v prvku ' + n.meno + ' musí byť v tvare RRRR-MM-DD a musí existovať v kalendári. V súbore je "' + v + '".',
        'Datum v prvku ' + n.meno + ' musí být ve tvaru RRRR-MM-DD a musí existovat v kalendáři. V souboru je "' + v + '".',
        'Das Datum in ' + n.meno + ' muss das Format JJJJ-MM-TT haben und im Kalender existieren. In der Datei steht "' + v + '".');
    }
  }
}
