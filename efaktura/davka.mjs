// A-015: CSV sa neodhaduje. Explicitne stlpce, sadzby, riadky chyb; ziadne API.
import { vytvorUbl, prepocitaj } from './ubl.js';
import { skontroluj, platnyIban } from './pravidla.mjs';

export const LIMIT = { znaky: 1000000, riadky: 500, faktury: 100 };
export const POVINNE = ['invoice_number', 'issue_date', 'due_date', 'currency', 'buyer_name', 'buyer_street', 'buyer_city', 'buyer_postcode', 'buyer_country', 'buyer_endpoint', 'buyer_scheme', 'description', 'quantity', 'unit_price', 'vat_rate', 'vat_category'];
export const VOLITELNE = ['buyer_reference', 'buyer_vat_id', 'buyer_company_id', 'buyer_email', 'unit', 'delivery_date', 'exemption_reason', 'order_number'];
const HLAVICKA = [...POVINNE, ...VOLITELNE];
const POLOZKA = new Set(['description', 'quantity', 'unit_price', 'vat_rate', 'vat_category', 'unit', 'exemption_reason']);

export class ChybaCsv extends Error {
  constructor(kod, riadok = 1, pole = '') {
    super(kod); this.name = 'ChybaCsv'; this.kod = kod; this.riadok = riadok; this.pole = pole;
  }
}

export function citajCsv(text) {
  if (typeof text !== 'string' || text.length > LIMIT.znaky) throw new ChybaCsv('size');
  text = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  if (!text.trim()) throw new ChybaCsv('empty');
  // Nazvy stlpcov neobsahuju oddelovace, preto rozhoduje iba prvy riadok.
  const prvy = text.split('\n')[0];
  const odd = prvy.includes(';') ? ';' : ',';
  const vysledok = [];
  let polia = [], hodnota = '', stav = 'start', riadok = 1, zaciatok = 1;
  function bunka() { polia.push(hodnota.trim()); hodnota = ''; stav = 'start'; }
  function zapis() {
    bunka();
    if (polia.some(Boolean)) vysledok.push({ polia, riadok: zaciatok });
    polia = []; zaciatok = riadok + 1;
    if (vysledok.length > LIMIT.riadky + 1) throw new ChybaCsv('rows', riadok);
  }
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (stav === 'quoted') {
      if (c === '"') {
        if (text[i + 1] === '"') { hodnota += '"'; i++; }
        else stav = 'closed';
      } else { hodnota += c; if (c === '\n') riadok++; }
      continue;
    }
    if (c === odd) { bunka(); continue; }
    if (c === '\n') { zapis(); riadok++; continue; }
    if (stav === 'closed') {
      if (c === ' ' || c === '\t') continue;
      throw new ChybaCsv('quotes', riadok);
    }
    if (c === '"') {
      if (hodnota.trim()) throw new ChybaCsv('quotes', riadok);
      hodnota = ''; stav = 'quoted';
    } else { hodnota += c; stav = 'plain'; }
  }
  if (stav === 'quoted') throw new ChybaCsv('quotes', riadok);
  if (hodnota || polia.length || stav === 'closed') zapis();
  if (vysledok.length < 2) throw new ChybaCsv('empty');
  const hlavicka = vysledok.shift().polia.map(p => p.toLowerCase());
  if (new Set(hlavicka).size !== hlavicka.length) throw new ChybaCsv('header_duplicate');
  for (const p of hlavicka) if (!HLAVICKA.includes(p)) throw new ChybaCsv('header_unknown', 1, p);
  for (const p of POVINNE) if (!hlavicka.includes(p)) throw new ChybaCsv('header_missing', 1, p);
  return vysledok.map(({ polia, riadok }) => {
    if (polia.length !== hlavicka.length) throw new ChybaCsv('columns', riadok);
    for (const p of polia) if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/.test(p)) throw new ChybaCsv('characters', riadok);
    return { riadok, data: Object.fromEntries(hlavicka.map((p, i) => [p, polia[i]])) };
  });
}

function cislo(t, riadok, pole, minimum, maximum, desatinne = 4) {
  // Bez tisicovych oddelovacov, exponentov, Infinity a ticheho prekladu chyby na 0.
  if (!new RegExp('^\\d+(?:[.,]\\d{1,' + desatinne + '})?$').test(t)) throw new ChybaCsv('number', riadok, pole);
  const n = Number(t.replace(',', '.'));
  if (!Number.isFinite(n) || n < minimum || n > maximum) throw new ChybaCsv('number', riadok, pole);
  return n;
}
function datum(t, riadok, pole) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) throw new ChybaCsv('date', riadok, pole);
  const d = new Date(t + 'T00:00:00Z');
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== t) throw new ChybaCsv('date', riadok, pole);
  return t;
}

export function zostavDavku(text, zaklad, jazyk = 'en') {
  const chyby = [], mapa = new Map(), unikatne = new Set();
  let vstup;
  try { vstup = citajCsv(text); }
  catch (e) { if (!(e instanceof ChybaCsv)) throw e; return { chyby: [e], faktury: [] }; }
  if (String(zaklad.sposobPlatby || '58') === '58' && !platnyIban(String(zaklad.dodavatel?.iban || ''))) {
    chyby.push(new ChybaCsv('iban', 1, 'seller.iban'));
  }
  for (const { data: d, riadok } of vstup) {
    try {
      for (const p of POVINNE) if (!d[p]) throw new ChybaCsv('required', riadok, p);
      if (d.invoice_number.length > 80) throw new ChybaCsv('length', riadok, 'invoice_number');
      if (!/^[A-Z]{3}$/.test(d.currency)) throw new ChybaCsv('currency', riadok, 'currency');
      if (!/^[A-Z]{2}$/.test(d.buyer_country)) throw new ChybaCsv('country', riadok, 'buyer_country');
      datum(d.issue_date, riadok, 'issue_date'); datum(d.due_date, riadok, 'due_date');
      if (d.due_date < d.issue_date) throw new ChybaCsv('due_date', riadok, 'due_date');
      if (d.delivery_date) datum(d.delivery_date, riadok, 'delivery_date');
      if (!['S', 'Z', 'E', 'AE', 'O'].includes(d.vat_category)) throw new ChybaCsv('category', riadok, 'vat_category');
      const p = {
        nazov: d.description,
        mnozstvo: cislo(d.quantity, riadok, 'quantity', 0.0001, 1000000),
        cena: cislo(d.unit_price, riadok, 'unit_price', 0, 100000000),
        sadzba: cislo(d.vat_rate, riadok, 'vat_rate', 0, 100, 2),
        kategoria: d.vat_category, jednotka: d.unit || 'C62', dovodOslobodenia: d.exemption_reason || ''
      };
      if ((p.kategoria === 'S' && p.sadzba === 0) || (p.kategoria !== 'S' && p.sadzba !== 0)) throw new ChybaCsv('rate_category', riadok, 'vat_rate');
      if (p.kategoria === 'E' && !p.dovodOslobodenia) throw new ChybaCsv('required', riadok, 'exemption_reason');
      if (p.cena * p.mnozstvo > 1000000000) throw new ChybaCsv('amount', riadok, 'unit_price');
      const rovnaky = JSON.stringify(HLAVICKA.map(k => d[k] || ''));
      if (unikatne.has(rovnaky)) throw new ChybaCsv('duplicate', riadok);
      unikatne.add(rovnaky);
      const hlavicka = JSON.stringify(HLAVICKA.filter(k => !POLOZKA.has(k)).map(k => d[k] || ''));
      let zaznam = mapa.get(d.invoice_number);
      if (zaznam && zaznam.hlavicka !== hlavicka) throw new ChybaCsv('conflict', riadok, 'invoice_number');
      if (!zaznam) {
        if (mapa.size >= LIMIT.faktury) throw new ChybaCsv('invoices', riadok);
        zaznam = { hlavicka, riadky: [], faktura: {
          typ: '380', profil: zaklad.profil || 'peppol', cislo: d.invoice_number,
          datumVystavenia: d.issue_date, datumSplatnosti: d.due_date,
          datumDodania: d.delivery_date || '', mena: d.currency,
          referenciaOdberatela: d.buyer_reference || '', objednavka: d.order_number || '',
          dodavatel: structuredClone(zaklad.dodavatel || {}),
          odberatel: { nazov: d.buyer_name, ulica: d.buyer_street, mesto: d.buyer_city, psc: d.buyer_postcode,
            krajina: d.buyer_country, endpoint: d.buyer_endpoint, endpointSchema: d.buyer_scheme,
            icDph: d.buyer_vat_id || '', ico: d.buyer_company_id || '', email: d.buyer_email || '' },
          sposobPlatby: zaklad.sposobPlatby || '58', polozky: []
        } };
        mapa.set(d.invoice_number, zaznam);
      }
      zaznam.faktura.polozky.push(p); zaznam.riadky.push(riadok);
    } catch (e) { if (!(e instanceof ChybaCsv)) throw e; chyby.push(e); }
  }
  const faktury = [...mapa.values()].map(z => {
    const xml = vytvorUbl(z.faktura, { jazyk });
    const kontrola = skontroluj(xml);
    return { faktura: z.faktura, riadky: z.riadky, xml, kontrola, sucty: prepocitaj(z.faktura) };
  });
  return { chyby, faktury };
}

export function davkaJePripravena(v) {
  return !!v && v.chyby.length === 0 && v.faktury.length > 0 && v.faktury.every(f => f.kontrola.sumar.chyby === 0);
}

export function davkaJeOdomknuta(z, test, teraz = Date.now()) {
  if (!z || z.typ !== '30dni' || !Number.isFinite(z.t) || z.t > teraz || z.t + 30 * 86400000 <= teraz) return false;
  if (typeof z.session !== 'string' || !/^cs_(test|live)_[a-zA-Z0-9]+$/.test(z.session)) return false;
  return z.test === test && z.session.startsWith(test ? 'cs_test_' : 'cs_live_');
}

// Vlastny CSV vzor: fiktivni odberatelia, tri riadky, dve faktury. Dodavatel je z formulara.
export const VZOR_CSV = '\uFEFF' + [...POVINNE, 'buyer_reference'].join(';') + '\r\n' + [
  'DEMO-001;2026-09-12;2026-09-26;EUR;Example Customer One;Example Street 1;Berlin;10115;DE;DE123456789;9930;Consulting;2;75.50;19;S;ORDER-001',
  'DEMO-001;2026-09-12;2026-09-26;EUR;Example Customer One;Example Street 1;Berlin;10115;DE;DE123456789;9930;Documentation;1;20.00;19;S;ORDER-001',
  'DEMO-002;2026-09-12;2026-09-26;EUR;Example Customer Two;Example Street 2;Hamburg;20095;DE;DE987654321;9930;Consulting;1;90.00;19;S;ORDER-002'
].join('\r\n') + '\r\n';
