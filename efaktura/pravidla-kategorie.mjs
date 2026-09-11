// pravidla-kategorie.mjs - pravidla EN 16931 podla kategorie DPH:
// BR-S (zakladna sadzba), BR-Z (nulova), BR-E (oslobodene), BR-AE (prenesenie danovej povinnosti),
// BR-G (vyvoz mimo EU), BR-IC (dodanie do EU, kod kategorie K), BR-O (nepodlieha DPH),
// BR-AF (IGIC, kod L) a BR-AG (IPSI, kod M).
// Pozor: skupina s nazvom "BR-K" v oficialnom schematrone neexistuje, pravidla pre kod K sa volaju BR-IC.

import {
  deti, prve, cesta, jeden, txt, hod, vsetky, xpath,
  cis, r2, katVat, pridaj
} from './pravidla-jadro.mjs';

const CH = 'chyba';

// Popis jednej kategorie DPH a toho, co od nej norma ziada.
const KATEGORIE = [
  {
    pre: 'BR-S', kod: 'S', sk: 'základná alebo znížená sadzba', cs: 'základní nebo snížená sazba', de: 'Regel- oder ermäßigter Satz',
    jedina: false, predajca: 'akykolvek', kupujuci: null, sadzba: 'kladna', sucet: 'podlaSadzby', dan: 'sucin', dovod: 'zakazany'
  },
  {
    pre: 'BR-Z', kod: 'Z', sk: 'nulová sadzba', cs: 'nulová sazba', de: 'Nullsatz',
    jedina: true, predajca: 'akykolvek', kupujuci: null, sadzba: 'nula', sucet: 'presny', dan: 'nula', dovod: 'zakazany'
  },
  {
    pre: 'BR-E', kod: 'E', sk: 'oslobodene od DPH', cs: 'osvobozeno od DPH', de: 'von der Umsatzsteuer befreit',
    jedina: true, predajca: 'akykolvek', kupujuci: null, sadzba: 'nula', sucet: 'presny', dan: 'nula', dovod: 'povinny'
  },
  {
    pre: 'BR-AE', kod: 'AE', sk: 'prenesenie daňovej povinnosti', cs: 'přenesení daňové povinnosti', de: 'Umkehrung der Steuerschuldnerschaft',
    jedina: true, predajca: 'akykolvek', kupujuci: 'vatAleboPravny', sadzba: 'nula', sucet: 'presny', dan: 'nula', dovod: 'povinny'
  },
  {
    pre: 'BR-G', kod: 'G', sk: 'vývoz mimo EU', cs: 'vývoz mimo EU', de: 'Ausfuhr außerhalb der EU',
    jedina: true, predajca: 'vat', kupujuci: null, sadzba: 'nula', sucet: 'presny', dan: 'nula', dovod: 'povinny'
  },
  {
    pre: 'BR-IC', kod: 'K', sk: 'dodanie do iného štátu EU', cs: 'dodání do jiného státu EU', de: 'innergemeinschaftliche Lieferung',
    jedina: true, predajca: 'vat', kupujuci: 'vat', sadzba: 'nula', sucet: 'presny', dan: 'nula', dovod: 'povinny'
  },
  {
    pre: 'BR-O', kod: 'O', sk: 'nepodlieha DPH', cs: 'nepodléhá DPH', de: 'nicht umsatzsteuerbar',
    jedina: true, predajca: 'ziadny', kupujuci: 'ziadny', sadzba: 'ziadna', sucet: 'presny', dan: 'nula', dovod: 'povinny'
  },
  {
    // BR-AF-05/06/07 maju v schematrone test "(cbc:Percent) >= 0", teda 0 % je platna sadzba IGIC.
    pre: 'BR-AF', kod: 'L', sk: 'IGIC, Kanárske ostrovy', cs: 'IGIC, Kanárské ostrovy', de: 'IGIC, Kanarische Inseln',
    jedina: false, predajca: 'akykolvek', kupujuci: null, sadzba: 'nezaporna', sucet: 'podlaSadzby', dan: 'sucin', dovod: 'zakazany'
  },
  {
    // BR-AG-05/06/07 maju v schematrone test "(cbc:Percent) >= 0", teda 0 % je platna sadzba IPSI.
    pre: 'BR-AG', kod: 'M', sk: 'IPSI, Ceuta a Melilla', cs: 'IPSI, Ceuta a Melilla', de: 'IPSI, Ceuta und Melilla',
    jedina: false, predajca: 'akykolvek', kupujuci: null, sadzba: 'nezaporna', sucet: 'podlaSadzby', dan: 'sucin', dovod: 'zakazany'
  }
];

// cislo pravidla v ramci skupiny, napriklad BR-S-01
const cislo = (pre, n) => pre + '-' + (n < 10 ? '0' + n : String(n));

function katRiadkuUzol(riadok) {
  return katVat(jeden(riadok, 'cac:Item'), 'cac:ClassifiedTaxCategory');
}

function sumaUzlov(pole, prvok) {
  return pole.reduce((a, n) => {
    const v = cis(hod(n, prvok));
    return a + (Number.isFinite(v) ? v : 0);
  }, 0);
}

// Identifikatory dodavatela a odberatela pre pravidla -02 az -04
function identifikatory(ctx) {
  const d = ctx.koren;
  const predajcaAkykolvek = cesta(d, 'cac:AccountingSupplierParty/cac:Party/cac:PartyTaxScheme/cbc:CompanyID')
    .some((n) => txt(n) !== '');
  const predajcaVat = cesta(d, 'cac:AccountingSupplierParty/cac:Party/cac:PartyTaxScheme')
    .filter((p) => hod(p, 'cac:TaxScheme/cbc:ID').toUpperCase() === 'VAT')
    .some((p) => hod(p, 'cbc:CompanyID') !== '');
  const zastupcaVat = cesta(d, 'cac:TaxRepresentativeParty/cac:PartyTaxScheme')
    .filter((p) => hod(p, 'cac:TaxScheme/cbc:ID').toUpperCase() === 'VAT')
    .some((p) => hod(p, 'cbc:CompanyID') !== '');
  const kupujuciVat = cesta(d, 'cac:AccountingCustomerParty/cac:Party/cac:PartyTaxScheme')
    .filter((p) => hod(p, 'cac:TaxScheme/cbc:ID').toUpperCase() === 'VAT')
    .some((p) => hod(p, 'cbc:CompanyID') !== '');
  const kupujuciPravny = cesta(d, 'cac:AccountingCustomerParty/cac:Party/cac:PartyLegalEntity/cbc:CompanyID')
    .some((n) => txt(n) !== '');
  return { predajcaAkykolvek, predajcaVat, zastupcaVat, kupujuciVat, kupujuciPravny };
}

export function pravidlaKategorii(ctx) {
  const d = ctx.koren;
  const id = identifikatory(ctx);

  // kde vsade sa kategoria pouziva
  const riadkyPodlaKat = new Map();
  for (const r of ctx.riadky) {
    const k = katRiadkuUzol(r);
    const kod = k ? hod(k, 'cbc:ID') : '';
    if (!riadkyPodlaKat.has(kod)) riadkyPodlaKat.set(kod, []);
    riadkyPodlaKat.get(kod).push({ riadok: r, kat: k });
  }
  const acPodlaKat = (pole) => {
    const m = new Map();
    for (const ac of pole) {
      const k = katVat(ac, 'cac:TaxCategory');
      const kod = k ? hod(k, 'cbc:ID') : '';
      if (!m.has(kod)) m.set(kod, []);
      m.get(kod).push({ ac, kat: k });
    }
    return m;
  };
  const zlavyPodlaKat = acPodlaKat(ctx.zlavyDok);
  const priplPodlaKat = acPodlaKat(ctx.priplatkyDok);

  const podsuhrnyPodlaKat = new Map();
  for (const ts of ctx.podsuhrny) {
    const k = katVat(ts, 'cac:TaxCategory');
    const kod = k ? hod(k, 'cbc:ID') : '';
    if (!podsuhrnyPodlaKat.has(kod)) podsuhrnyPodlaKat.set(kod, []);
    podsuhrnyPodlaKat.get(kod).push({ ts, kat: k });
  }

  for (const K of KATEGORIE) {
    const rk = riadkyPodlaKat.get(K.kod) || [];
    const zk = zlavyPodlaKat.get(K.kod) || [];
    const pk = priplPodlaKat.get(K.kod) || [];
    const sk = podsuhrnyPodlaKat.get(K.kod) || [];
    const pouzita = rk.length + zk.length + pk.length > 0;

    // dva slovenske tvary, aby vety sedeli pádom: "pri kategórii" a "má kategóriu".
    // Cestina ma pre oba pady rovnaky tvar "kategorii", nemcina tiez jeden.
    const nazovSk = 'kategórii DPH ' + K.kod + ' (' + K.sk + ')';
    const nazovSkA = 'kategóriu DPH ' + K.kod + ' (' + K.sk + ')';
    const nazovCs = 'kategorii DPH ' + K.kod + ' (' + K.cs + ')';
    const nazovDe = 'Umsatzsteuerkategorie ' + K.kod + ' (' + K.de + ')';

    // ---- -01: rozpis DPH musi obsahovat prislusny riadok
    if (pouzita) {
      const ok = K.jedina ? sk.length === 1 : sk.length >= 1;
      if (!ok) {
        pridaj(ctx, cislo(K.pre, 1), CH, d, String(sk.length),
          'Doklad používa ' + nazovSkA + ', preto musí rozpis DPH (BG-23) obsahovať ' +
            (K.jedina ? 'práve jeden' : 'aspoň jeden') + ' cac:TaxTotal/cac:TaxSubtotal s cac:TaxCategory/cbc:ID = ' + K.kod +
            '. Našli sme ich ' + sk.length + '.',
          'Doklad používá ' + nazovCs + ', proto musí rozpis DPH (BG-23) obsahovat ' +
            (K.jedina ? 'právě jeden' : 'alespoň jeden') + ' cac:TaxTotal/cac:TaxSubtotal s cac:TaxCategory/cbc:ID = ' + K.kod +
            '. Našli jsme jich ' + sk.length + '.',
          'Der Beleg verwendet die ' + nazovDe + ', deshalb muss die Steueraufschlüsselung (BG-23) ' +
            (K.jedina ? 'genau ein' : 'mindestens ein') + ' cac:TaxTotal/cac:TaxSubtotal mit cac:TaxCategory/cbc:ID = ' + K.kod +
            ' enthalten. Gefunden: ' + sk.length + '.',
          xpath(d));
      }
    }

    // ---- -02 az -04: identifikatory stran
    const chybaIdentifikator = () => {
      if (K.predajca === 'akykolvek') {
        if (!(id.predajcaAkykolvek || id.zastupcaVat)) return 'predajca';
      } else if (K.predajca === 'vat') {
        if (!(id.predajcaVat || id.zastupcaVat)) return 'predajcaVat';
      } else if (K.predajca === 'ziadny') {
        if (id.predajcaVat || id.zastupcaVat || id.kupujuciVat) return 'nesmieMat';
      }
      if (K.kupujuci === 'vatAleboPravny' && !(id.kupujuciVat || id.kupujuciPravny)) return 'kupujuci';
      if (K.kupujuci === 'vat' && !id.kupujuciVat) return 'kupujuciVat';
      return null;
    };
    const dovodId = chybaIdentifikator();
    if (dovodId) {
      const texty = {
        predajca: [
          'Pri ' + nazovSk + ' musí byť uvedené IČ DPH dodávateľa (BT-31), jeho daňové registračné číslo (BT-32) alebo IČ DPH daňového zástupcu (BT-63). V cac:AccountingSupplierParty/cac:Party/cac:PartyTaxScheme/cbc:CompanyID nie je nič.',
          'Při ' + nazovCs + ' musí být uvedeno DIČ dodavatele (BT-31), jeho daňové registrační číslo (BT-32) nebo DIČ daňového zástupce (BT-63). V cac:AccountingSupplierParty/cac:Party/cac:PartyTaxScheme/cbc:CompanyID není nic.',
          'Bei der ' + nazovDe + ' muss die USt-IdNr. des Verkäufers (BT-31), seine Steuernummer (BT-32) oder die USt-IdNr. des Steuervertreters (BT-63) angegeben sein. In cac:AccountingSupplierParty/cac:Party/cac:PartyTaxScheme/cbc:CompanyID steht nichts.'
        ],
        predajcaVat: [
          'Pri ' + nazovSk + ' musí byť uvedené IČ DPH dodávateľa (BT-31) alebo IČ DPH daňového zástupcu (BT-63), so schémou VAT.',
          'Při ' + nazovCs + ' musí být uvedeno DIČ dodavatele (BT-31) nebo DIČ daňového zástupce (BT-63), se schématem VAT.',
          'Bei der ' + nazovDe + ' muss die USt-IdNr. des Verkäufers (BT-31) oder des Steuervertreters (BT-63) mit dem Schema VAT angegeben sein.'
        ],
        kupujuci: [
          'Pri ' + nazovSk + ' musí byť uvedené IČ DPH odberateľa (BT-48) alebo jeho registračné číslo (BT-47).',
          'Při ' + nazovCs + ' musí být uvedeno DIČ odběratele (BT-48) nebo jeho registrační číslo (BT-47).',
          'Bei der ' + nazovDe + ' muss die USt-IdNr. des Käufers (BT-48) oder seine Registernummer (BT-47) angegeben sein.'
        ],
        kupujuciVat: [
          'Pri ' + nazovSk + ' musí byť uvedené IČ DPH odberateľa (BT-48) v cac:AccountingCustomerParty/cac:Party/cac:PartyTaxScheme/cbc:CompanyID so schémou VAT.',
          'Při ' + nazovCs + ' musí být uvedeno DIČ odběratele (BT-48) v cac:AccountingCustomerParty/cac:Party/cac:PartyTaxScheme/cbc:CompanyID se schématem VAT.',
          'Bei der ' + nazovDe + ' muss die USt-IdNr. des Käufers (BT-48) in cac:AccountingCustomerParty/cac:Party/cac:PartyTaxScheme/cbc:CompanyID mit dem Schema VAT stehen.'
        ],
        nesmieMat: [
          'Pri ' + nazovSk + ' nesmie doklad obsahovať IČ DPH dodávateľa (BT-31), daňového zástupcu (BT-63) ani odberateľa (BT-48). Odstráňte cac:PartyTaxScheme so schémou VAT.',
          'Při ' + nazovCs + ' nesmí doklad obsahovat DIČ dodavatele (BT-31), daňového zástupce (BT-63) ani odběratele (BT-48). Odstraňte cac:PartyTaxScheme se schématem VAT.',
          'Bei der ' + nazovDe + ' darf der Beleg keine USt-IdNr. des Verkäufers (BT-31), des Steuervertreters (BT-63) oder des Käufers (BT-48) enthalten. Entfernen Sie cac:PartyTaxScheme mit dem Schema VAT.'
        ]
      }[dovodId];
      if (rk.length) pridaj(ctx, cislo(K.pre, 2), CH, rk[0].riadok, K.kod, texty[0], texty[1], texty[2]);
      if (zk.length) pridaj(ctx, cislo(K.pre, 3), CH, zk[0].ac, K.kod, texty[0], texty[1], texty[2]);
      if (pk.length) pridaj(ctx, cislo(K.pre, 4), CH, pk[0].ac, K.kod, texty[0], texty[1], texty[2]);
    }

    // ---- -05 az -07: sadzba na riadku, na zlave a na priplatku
    const skontrolujSadzbu = (uzolKat, uzolChyby, kodPravidla, kdeSk, kdeCs, kdeDe) => {
      if (!uzolKat) return;
      const maSadzbu = !!prve(uzolKat, 'cbc:Percent');
      const s = cis(hod(uzolKat, 'cbc:Percent'));
      // spolocny zaciatok vety, aby sa slovo "ma" neopakovalo bez diakritiky
      const uvodSk = kdeSk + ' má ' + nazovSkA;
      const uvodCs = kdeCs + ' má ' + nazovCs;
      const uvodDe = kdeDe + ' hat die ' + nazovDe;
      if (K.sadzba === 'ziadna') {
        if (maSadzbu) {
          pridaj(ctx, kodPravidla, CH, prve(uzolKat, 'cbc:Percent'), hod(uzolKat, 'cbc:Percent'),
            uvodSk + ', preto tam nesmie byť sadzba DPH (cbc:Percent). Odstráňte ju.',
            uvodCs + ', proto tam nesmí být sazba DPH (cbc:Percent). Odstraňte ji.',
            uvodDe + ', deshalb darf dort kein Steuersatz (cbc:Percent) stehen. Entfernen Sie ihn.');
        }
        return;
      }
      if (K.sadzba === 'nula') {
        if (!maSadzbu || (Number.isFinite(s) && s !== 0)) {
          pridaj(ctx, kodPravidla, CH, uzolKat, hod(uzolKat, 'cbc:Percent'),
            uvodSk + ', preto musí mať sadzbu DPH 0 (cbc:Percent = 0).',
            uvodCs + ', proto musí mít sazbu DPH 0 (cbc:Percent = 0).',
            uvodDe + ', deshalb muss der Steuersatz 0 sein (cbc:Percent = 0).');
        }
        return;
      }
      if (K.sadzba === 'nezaporna') {
        // IGIC a IPSI: sadzba smie byť aj 0 %, nesmie len chýbať alebo byť záporná
        if (!maSadzbu || !(Number.isFinite(s) && s >= 0)) {
          pridaj(ctx, kodPravidla, CH, uzolKat, hod(uzolKat, 'cbc:Percent'),
            uvodSk + ', preto musí mať sadzbu DPH nula alebo väčšiu ako nula (cbc:Percent).',
            uvodCs + ', proto musí mít sazbu DPH nula nebo větší než nula (cbc:Percent).',
            uvodDe + ', deshalb muss der Steuersatz null oder größer als null sein (cbc:Percent).');
        }
        return;
      }
      if (K.sadzba === 'kladna') {
        if (!maSadzbu || !(Number.isFinite(s) && s > 0)) {
          pridaj(ctx, kodPravidla, CH, uzolKat, hod(uzolKat, 'cbc:Percent'),
            uvodSk + ', preto musí mať sadzbu DPH väčšiu ako nula (cbc:Percent).',
            uvodCs + ', proto musí mít sazbu DPH větší než nula (cbc:Percent).',
            uvodDe + ', deshalb muss der Steuersatz größer als null sein (cbc:Percent).');
        }
      }
    };
    rk.forEach((x, i) => skontrolujSadzbu(x.kat, x.riadok, cislo(K.pre, 5),
      'Riadok ' + (ctx.riadky.indexOf(x.riadok) + 1), 'Řádek ' + (ctx.riadky.indexOf(x.riadok) + 1), 'Position ' + (ctx.riadky.indexOf(x.riadok) + 1)));
    zk.forEach((x) => skontrolujSadzbu(x.kat, x.ac, cislo(K.pre, 6), 'Zľava na úrovni dokladu', 'Sleva na úrovni dokladu', 'Der Abschlag auf Dokumentebene'));
    pk.forEach((x) => skontrolujSadzbu(x.kat, x.ac, cislo(K.pre, 7), 'Príplatok na úrovni dokladu', 'Příplatek na úrovni dokladu', 'Der Zuschlag auf Dokumentebene'));

    // ---- -08 az -10: rozpis DPH
    for (const { ts, kat } of sk) {
      const zaklad = cis(hod(ts, 'cbc:TaxableAmount'));
      const dan = cis(hod(ts, 'cbc:TaxAmount'));
      const sadzba = kat ? cis(hod(kat, 'cbc:Percent')) : NaN;

      // -08 zaklad dane
      let ocakZaklad;
      if (K.sucet === 'podlaSadzby') {
        const rovnakaSadzba = (u) => {
          const p = cis(hod(u, 'cbc:Percent'));
          return Number.isFinite(p) && Number.isFinite(sadzba) && p === sadzba;
        };
        const rr = rk.filter((x) => x.kat && rovnakaSadzba(x.kat)).map((x) => x.riadok);
        const zz = zk.filter((x) => x.kat && rovnakaSadzba(x.kat)).map((x) => x.ac);
        const pp = pk.filter((x) => x.kat && rovnakaSadzba(x.kat)).map((x) => x.ac);
        ocakZaklad = r2(sumaUzlov(rr, 'cbc:LineExtensionAmount') + sumaUzlov(pp, 'cbc:Amount') - sumaUzlov(zz, 'cbc:Amount'));
      } else {
        ocakZaklad = r2(
          sumaUzlov(rk.map((x) => x.riadok), 'cbc:LineExtensionAmount') +
          sumaUzlov(pk.map((x) => x.ac), 'cbc:Amount') -
          sumaUzlov(zk.map((x) => x.ac), 'cbc:Amount')
        );
      }
      if (Number.isFinite(zaklad)) {
        const ok = K.sucet === 'podlaSadzby'
          ? (zaklad - 1 < ocakZaklad && zaklad + 1 > ocakZaklad)
          : r2(zaklad) === ocakZaklad;
        if (!ok) {
          pridaj(ctx, cislo(K.pre, 8), CH, prve(ts, 'cbc:TaxableAmount'), hod(ts, 'cbc:TaxableAmount'),
            'Základ dane pre ' + nazovSkA + (K.sucet === 'podlaSadzby' ? ' pri sadzbe ' + hod(kat || ts, 'cbc:Percent') + ' %' : '') +
              ' má byť ' + ocakZaklad.toFixed(2) + ' (súčet suma riadkov plus príplatky minus zľavy s touto kategóriou), v súbore je ' + hod(ts, 'cbc:TaxableAmount') + '.',
            'Základ daně pro ' + nazovCs + (K.sucet === 'podlaSadzby' ? ' při sazbě ' + hod(kat || ts, 'cbc:Percent') + ' %' : '') +
              ' má být ' + ocakZaklad.toFixed(2) + ' (součet částek řádku plus příplatky minus slevy s touto kategorií), v souboru je ' + hod(ts, 'cbc:TaxableAmount') + '.',
            'Die Bemessungsgrundlage für die ' + nazovDe + (K.sucet === 'podlaSadzby' ? ' beim Satz ' + hod(kat || ts, 'cbc:Percent') + ' %' : '') +
              ' soll ' + ocakZaklad.toFixed(2) + ' betragen (Summe der Positionen plus Zuschläge minus Abschläge mit dieser Kategorie), in der Datei steht ' + hod(ts, 'cbc:TaxableAmount') + '.');
        }
      }

      // -09 suma dane
      if (Number.isFinite(dan)) {
        if (K.dan === 'nula') {
          if (r2(dan) !== 0) {
            pridaj(ctx, cislo(K.pre, 9), CH, prve(ts, 'cbc:TaxAmount'), hod(ts, 'cbc:TaxAmount'),
              'Pri ' + nazovSk + ' musí byť suma DPH v rozpise nula (cbc:TaxAmount = 0), v súbore je ' + hod(ts, 'cbc:TaxAmount') + '.',
              'Při ' + nazovCs + ' musí být částka DPH v rozpisu nula (cbc:TaxAmount = 0), v souboru je ' + hod(ts, 'cbc:TaxAmount') + '.',
              'Bei der ' + nazovDe + ' muss der Steuerbetrag null sein (cbc:TaxAmount = 0), in der Datei steht ' + hod(ts, 'cbc:TaxAmount') + '.');
          }
        } else if (Number.isFinite(zaklad) && Number.isFinite(sadzba)) {
          const ocak = r2(Math.abs(zaklad) * (sadzba / 100));
          if (!(Math.abs(dan) - 1 < ocak && Math.abs(dan) + 1 > ocak)) {
            pridaj(ctx, cislo(K.pre, 9), CH, prve(ts, 'cbc:TaxAmount'), hod(ts, 'cbc:TaxAmount'),
              'Pri ' + nazovSk + ' má byť suma DPH základ ' + zaklad.toFixed(2) + ' krát sadzba ' + sadzba + ' %, teda ' + ocak.toFixed(2) + '. V súbore je ' + hod(ts, 'cbc:TaxAmount') + '.',
              'Při ' + nazovCs + ' má být částka DPH základ ' + zaklad.toFixed(2) + ' krát sazba ' + sadzba + ' %, tedy ' + ocak.toFixed(2) + '. V souboru je ' + hod(ts, 'cbc:TaxAmount') + '.',
              'Bei der ' + nazovDe + ' soll der Steuerbetrag ' + zaklad.toFixed(2) + ' mal ' + sadzba + ' % sein, also ' + ocak.toFixed(2) + '. In der Datei steht ' + hod(ts, 'cbc:TaxAmount') + '.');
          }
        }
      }

      // -10 dovod oslobodenia
      const maDovod = !!(kat && (prve(kat, 'cbc:TaxExemptionReason') || prve(kat, 'cbc:TaxExemptionReasonCode')));
      if (K.dovod === 'povinny' && !maDovod) {
        pridaj(ctx, cislo(K.pre, 10), CH, kat || ts, K.kod,
          'Pri ' + nazovSk + ' musí rozpis DPH obsahovať dôvod oslobodenia: cbc:TaxExemptionReasonCode (BT-121, napríklad VATEX-EU-AE) alebo cbc:TaxExemptionReason (BT-120, text).',
          'Při ' + nazovCs + ' musí rozpis DPH obsahovat důvod osvobození: cbc:TaxExemptionReasonCode (BT-121, například VATEX-EU-AE) nebo cbc:TaxExemptionReason (BT-120, text).',
          'Bei der ' + nazovDe + ' muss die Steueraufschlüsselung einen Befreiungsgrund enthalten: cbc:TaxExemptionReasonCode (BT-121, zum Beispiel VATEX-EU-AE) oder cbc:TaxExemptionReason (BT-120, Text).');
      }
      if (K.dovod === 'zakazany' && maDovod) {
        pridaj(ctx, cislo(K.pre, 10), CH, kat || ts, K.kod,
          'Pri ' + nazovSk + ' nesmie byť v rozpise DPH dôvod oslobodenia (BT-120 ani BT-121). Odstráňte cbc:TaxExemptionReason a cbc:TaxExemptionReasonCode.',
          'Při ' + nazovCs + ' nesmí být v rozpisu DPH důvod osvobození (BT-120 ani BT-121). Odstraňte cbc:TaxExemptionReason a cbc:TaxExemptionReasonCode.',
          'Bei der ' + nazovDe + ' darf in der Steueraufschlüsselung kein Befreiungsgrund stehen (weder BT-120 noch BT-121). Entfernen Sie cbc:TaxExemptionReason und cbc:TaxExemptionReasonCode.');
      }
    }
  }

  // ---- BR-IC-11 a BR-IC-12
  const maK = (podsuhrnyPodlaKat.get('K') || []).length > 0;
  if (maK) {
    const datum = hod(d, 'cac:Delivery/cbc:ActualDeliveryDate');
    const maObdobie = cesta(d, 'cac:InvoicePeriod').some((o) => o.deti.length > 0);
    if (datum === '' && !maObdobie) {
      pridaj(ctx, 'BR-IC-11', CH, d, '',
        'Pri dodaní do iného štátu EU (kategória K) musí byť uvedený dátum dodania (BT-72, cac:Delivery/cbc:ActualDeliveryDate) alebo fakturačné obdobie (BG-14, cac:InvoicePeriod).',
        'Při dodání do jiného státu EU (kategorie K) musí být uvedeno datum dodání (BT-72, cac:Delivery/cbc:ActualDeliveryDate) nebo fakturační období (BG-14, cac:InvoicePeriod).',
        'Bei innergemeinschaftlicher Lieferung (Kategorie K) muss das Lieferdatum (BT-72, cac:Delivery/cbc:ActualDeliveryDate) oder der Abrechnungszeitraum (BG-14, cac:InvoicePeriod) angegeben sein.',
        xpath(d));
    }
    const krajina = hod(d, 'cac:Delivery/cac:DeliveryLocation/cac:Address/cac:Country/cbc:IdentificationCode');
    if (krajina.length <= 1) {
      pridaj(ctx, 'BR-IC-12', CH, d, krajina,
        'Pri dodaní do iného štátu EU (kategória K) musí byť uvedená krajina dodania (BT-80) v cac:Delivery/cac:DeliveryLocation/cac:Address/cac:Country/cbc:IdentificationCode.',
        'Při dodání do jiného státu EU (kategorie K) musí být uvedena země dodání (BT-80) v cac:Delivery/cac:DeliveryLocation/cac:Address/cac:Country/cbc:IdentificationCode.',
        'Bei innergemeinschaftlicher Lieferung (Kategorie K) muss das Lieferland (BT-80) in cac:Delivery/cac:DeliveryLocation/cac:Address/cac:Country/cbc:IdentificationCode stehen.',
        xpath(d));
    }
  }

  // ---- BR-O-11 az BR-O-14
  const maO = (podsuhrnyPodlaKat.get('O') || []).length > 0;
  if (maO) {
    const ineRozpisy = ctx.podsuhrny.filter((ts) => {
      const k = katVat(ts, 'cac:TaxCategory');
      return k && hod(k, 'cbc:ID') !== 'O';
    });
    if (ineRozpisy.length) {
      pridaj(ctx, 'BR-O-11', CH, ineRozpisy[0], hod(katVat(ineRozpisy[0], 'cac:TaxCategory'), 'cbc:ID'),
        'Doklad má rozpis DPH s kategóriou O (nepodlieha DPH), preto nesmie mať žiadny iný rozpis DPH. Našli sme ich ' + ineRozpisy.length + '.',
        'Doklad má rozpis DPH s kategorií O (nepodléhá DPH), proto nesmí mít žádný jiný rozpis DPH. Našli jsme jich ' + ineRozpisy.length + '.',
        'Der Beleg hat eine Steueraufschlüsselung mit Kategorie O, deshalb darf es keine weitere Steueraufschlüsselung geben. Gefunden: ' + ineRozpisy.length + '.');
    }
    const ineRiadky = ctx.riadky.filter((r) => {
      const k = katRiadkuUzol(r);
      return k && hod(k, 'cbc:ID') !== 'O';
    });
    if (ineRiadky.length) {
      pridaj(ctx, 'BR-O-12', CH, ineRiadky[0], '',
        'Doklad má rozpis DPH s kategóriou O, preto musia mať všetky riadky kategóriu O. Riadok s inou kategóriou: ' + hod(ineRiadky[0], 'cbc:ID') + '.',
        'Doklad má rozpis DPH s kategorií O, proto musí mít všechny řádky kategorii O. Řádek s jinou kategorií: ' + hod(ineRiadky[0], 'cbc:ID') + '.',
        'Der Beleg hat eine Steueraufschlüsselung mit Kategorie O, deshalb müssen alle Positionen die Kategorie O haben. Abweichende Position: ' + hod(ineRiadky[0], 'cbc:ID') + '.');
    }
    const ineZlavy = ctx.zlavyDok.filter((ac) => {
      const k = katVat(ac, 'cac:TaxCategory');
      return k && hod(k, 'cbc:ID') !== 'O';
    });
    if (ineZlavy.length) {
      pridaj(ctx, 'BR-O-13', CH, ineZlavy[0], '',
        'Doklad má rozpis DPH s kategóriou O, preto musia mať všetky zľavy na úrovni dokladu kategóriu O.',
        'Doklad má rozpis DPH s kategorií O, proto musí mít všechny slevy na úrovni dokladu kategorii O.',
        'Der Beleg hat eine Steueraufschlüsselung mit Kategorie O, deshalb müssen alle Abschläge auf Dokumentebene die Kategorie O haben.');
    }
    const inePripl = ctx.priplatkyDok.filter((ac) => {
      const k = katVat(ac, 'cac:TaxCategory');
      return k && hod(k, 'cbc:ID') !== 'O';
    });
    if (inePripl.length) {
      pridaj(ctx, 'BR-O-14', CH, inePripl[0], '',
        'Doklad má rozpis DPH s kategóriou O, preto musia mať všetky príplatky na úrovni dokladu kategóriu O.',
        'Doklad má rozpis DPH s kategorií O, proto musí mít všechny příplatky na úrovni dokladu kategorii O.',
        'Der Beleg hat eine Steueraufschlüsselung mit Kategorie O, deshalb müssen alle Zuschläge auf Dokumentebene die Kategorie O haben.');
    }
  }
}

export { KATEGORIE };
