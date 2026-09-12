import { zostavDavku, davkaJePripravena, davkaJeOdomknuta, VZOR_CSV, POVINNE, VOLITELNE, LIMIT } from './davka.mjs';
import { vytvorZip } from './davka-zip.mjs';
import { TEXTY_DAVKY } from './davka-texty.mjs';
import { parsujXml } from './parser.mjs';
import { vykresliNahlad } from './nahlad.js';
import { zCentov } from './ubl.js';

export function zapojDavku({ jazyk, zaklad, platba, testRezim, kupit, cena, track }) {
  const panel = document.getElementById('panel-vytvorit');
  if (!panel) return null;
  const T = TEXTY_DAVKY[jazyk] || TEXTY_DAVKY.en;
  const cenaText = new Intl.NumberFormat(jazyk, { style: 'currency', currency: 'EUR' }).format(cena / 100);
  const kluc = 'efaktura:davka:' + jazyk;
  const el = (tag, text, cls) => { const e = document.createElement(tag); if (text) e.textContent = text; if (cls) e.className = cls; return e; };
  const box = el('details', '', 'davka'); box.id = 'csv-davka';
  box.append(el('summary', T.title));
  const obsah = el('div', '', 'davka-obsah'); box.append(obsah);
  obsah.append(el('p', T.intro), el('p', T.scope, 'pomoc'));
  const seller = el('a', T.seller); seller.href = '#formular'; obsah.append(seller);
  const akcie = el('div', '', 'cta'); obsah.append(akcie);
  const button = (text, id, parent = akcie) => { const b = el('button', text, 'btn btn-line'); b.type = 'button'; b.id = id; parent.append(b); return b; };
  const vzor = button(T.sample, 'davka-vzor'), priklad = button(T.load, 'davka-priklad');
  const label = el('label', T.file, 'pole'); label.htmlFor = 'davka-subor'; obsah.append(label);
  const file = el('input'); file.type = 'file'; file.accept = '.csv,text/csv'; file.id = 'davka-subor'; label.append(file);
  const tl = el('label', T.paste); tl.htmlFor = 'davka-csv'; obsah.append(tl);
  const vstup = el('textarea'); vstup.id = 'davka-csv'; vstup.rows = 6; vstup.spellcheck = false; vstup.maxLength = LIMIT.znaky; obsah.append(vstup);
  obsah.append(el('p', T.format, 'pomoc'), el('p', T.privacy, 'pomoc'));
  const schema = el('details'); schema.append(el('summary', T.columns), el('p', POVINNE.join(', '), 'davka-stlpce'), el('b', T.optional), el('p', VOLITELNE.join(', '), 'davka-stlpce')); obsah.append(schema);
  const tlacidla = el('div', '', 'cta'); obsah.append(tlacidla);
  const kontrola = button(T.check, 'davka-kontrola', tlacidla); kontrola.className = 'btn btn-solid';
  const vymaz = button(T.clear, 'davka-vymaz', tlacidla);
  const stav = el('p', T.fresh); stav.id = 'davka-stav'; stav.setAttribute('role', 'status'); obsah.append(stav);
  const vysledky = el('div'); vysledky.id = 'davka-vysledky'; obsah.append(vysledky);
  const ponuka = el('div', '', 'davka-ponuka'); obsah.append(ponuka);
  ponuka.append(el('p', T.price.replace('{price}', cenaText)), el('p', T.return, 'pomoc'));
  const kup = button(T.buy.replace('{price}', cenaText), 'davka-kupa', ponuka);
  const zip = button(T.download, 'davka-zip', ponuka); zip.className = 'btn btn-solid';
  const odomk = el('p', '', 'pomoc'); ponuka.append(odomk);
  panel.insertBefore(box, panel.querySelector('.dielna'));
  let vysledok = null, overenyZaklad = '', overeneCsv = '', bezi = false;
  function fingerprint() { const f = zaklad(); return JSON.stringify([f.dodavatel, f.profil, f.sposobPlatby]); }
  function send(event, data = {}) { track(event, { produkt: 'efaktura', jazyk, test: testRezim(), ...data }); }
  function ulozit() {
    try { sessionStorage.setItem(kluc, JSON.stringify({ csv: vstup.value, t: Date.now() })); return true; }
    catch { return false; }
  }
  function aktualne() { return !bezi && davkaJePripravena(vysledok) && overenyZaklad === fingerprint() && overeneCsv === vstup.value; }
  function obnovPlatbu() {
    const ok = davkaJeOdomknuta(platba(), testRezim());
    zip.hidden = !ok; zip.disabled = !aktualne();
    kup.hidden = ok; kup.disabled = !aktualne();
    odomk.textContent = ok ? T.unlocked : '';
    if (vysledok && (overenyZaklad !== fingerprint() || overeneCsv !== vstup.value)) {
      stav.textContent = T.fresh; box.dataset.stage = 'changed';
    }
  }
  function invaliduj() { obnovPlatbu(); if (!ulozit()) stav.textContent = T.storage; }
  vstup.addEventListener('input', invaliduj);
  function stiahnut(meno, data, mime) {
    const u = URL.createObjectURL(new Blob([data], { type: mime }));
    const a = el('a'); a.href = u; a.download = meno; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 30000);
  }
  vzor.addEventListener('click', () => stiahnut('arling-invoices-template.csv', VZOR_CSV, 'text/csv;charset=utf-8'));
  priklad.addEventListener('click', () => { vstup.value = VZOR_CSV; invaliduj(); stav.textContent = T.example; send('efaktura_davka_priklad'); });
  file.addEventListener('change', async () => {
    const f = file.files[0]; if (!f) return;
    // Pred nacitanim noveho suboru zneplatnime aj predosly overeny vysledok.
    vysledok = null; vysledky.replaceChildren(); obnovPlatbu();
    if (f.size > LIMIT.znaky) { stav.textContent = T.problems.size; return; }
    try { vstup.value = new TextDecoder('utf-8', { fatal: true }).decode(await f.arrayBuffer()); invaliduj(); stav.textContent = T.fresh; }
    catch { vstup.value = ''; invaliduj(); stav.textContent = T.failure; }
  });
  vymaz.addEventListener('click', () => {
    vstup.value = ''; file.value = ''; vysledok = null; vysledky.replaceChildren();
    try { sessionStorage.removeItem(kluc); } catch {}
    stav.textContent = T.fresh; box.dataset.stage = 'empty'; obnovPlatbu();
  });
  function riadokChyby(e) { return `${T.row} ${e.riadok}${e.pole ? ' · ' + e.pole : ''}: ${T.problems[e.kod] || T.failure}`; }
  async function skontrolovat() {
    if (bezi) return;
    bezi = true; kontrola.disabled = true; obnovPlatbu(); stav.textContent = T.busy;
    await new Promise(r => setTimeout(r, 0));
    try {
      const csv = vstup.value, f = structuredClone(zaklad());
      overenyZaklad = fingerprint(); overeneCsv = csv;
      vysledok = zostavDavku(csv, f, jazyk); vysledky.replaceChildren();
      for (const e of vysledok.chyby) vysledky.append(el('p', riadokChyby(e), 'davka-chyba'));
      for (const f of vysledok.faktury) {
        const row = el('section', '', 'davka-riadok');
        row.append(el('h4', `${T.invoice} ${f.faktura.cislo}`));
        row.append(el('p', `${T.lines}: ${f.riadky.join(', ')} · ${T.total}: ${zCentov(f.sucty.naUhraduCenty)} ${f.faktura.mena}`));
        const nalezy = f.kontrola.nalezy.filter(n => n.zavaznost === 'chyba' || n.zavaznost === 'varovanie');
        row.append(el('p', `${T.errors}: ${f.kontrola.sumar.chyby} · ${T.warnings}: ${f.kontrola.sumar.varovania || 0}`, 'pomoc'));
        for (const n of nalezy) row.append(el('p', `${n.kod}: ${n.sprava[jazyk] || n.sprava.en || n.sprava.sk}`, n.zavaznost === 'chyba' ? 'davka-chyba' : 'pomoc'));
        const detail = el('details'); detail.append(el('summary', T.preview));
        const doklad = el('div', '', 'doklad-obal'); detail.append(doklad);
        detail.addEventListener('toggle', () => {
          if (detail.open && !doklad.firstChild) { const p = parsujXml(f.xml); if (p.ok) vykresliNahlad(p.koren, doklad, jazyk); }
        }); row.append(detail); vysledky.append(row);
      }
      const ready = davkaJePripravena(vysledok);
      stav.textContent = T.checked.replace('{n}', vysledok.faktury.length) + ' ' + (ready ? T.ready : T.blocked);
      box.dataset.stage = ready ? 'ready' : 'errors';
      if (!ulozit()) stav.textContent += ' ' + T.storage;
      send('efaktura_davka_kontrola', { pocet: vysledok.faktury.length, pripravene: ready });
    } catch { vysledok = null; stav.textContent = T.failure; box.dataset.stage = 'errors'; }
    finally { bezi = false; kontrola.disabled = false; obnovPlatbu(); }
  }
  kontrola.addEventListener('click', skontrolovat);
  kup.addEventListener('click', () => {
    if (!aktualne()) { obnovPlatbu(); return; }
    if (!ulozit()) { stav.textContent = T.storage; return; }
    send('efaktura_davka_kupa', { pocet: vysledok.faktury.length }); kupit();
  });
  zip.addEventListener('click', () => {
    // Kontrola aj v obsluhe: zmena DOM alebo expirovany pristup neobidu podmienky.
    if (!aktualne() || !davkaJeOdomknuta(platba(), testRezim())) { obnovPlatbu(); return; }
    const subory = vysledok.faktury.map((f, i) => ({
      meno: `${String(i + 1).padStart(3, '0')}-${f.faktura.cislo.replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 80)}.xml`, text: f.xml
    }));
    try { stiahnut('arling-invoices.zip', vytvorZip(subory), 'application/zip'); send('efaktura_davka_stiahnute', { pocet: subory.length }); }
    catch { stav.textContent = T.failure; }
  });
  try {
    const saved = JSON.parse(sessionStorage.getItem(kluc) || 'null');
    if (saved && typeof saved.csv === 'string' && saved.csv.length <= LIMIT.znaky && saved.t <= Date.now() && Date.now() - saved.t < 86400000) {
      vstup.value = saved.csv; box.open = !!saved.csv;
      if (saved.csv) skontrolovat();
    }
  } catch {}
  if (/\/(csv-xrechnung|csv-to-invoice)\//.test(location.pathname)) box.open = true;
  obnovPlatbu();
  return { obnovPlatbu };
}
