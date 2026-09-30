// AI to SI: ovládanie stránky /super-intelligence/. Logika je v jadro.js, tu je len DOM, súbor, schránka a stiahnutie.
// Text neopúšťa prehliadač: nič sa neposiela ani neukladá. Umami počíta len kliky na tlačidlá s data-umami-event
// (bez textu); data-umami-event-vstup rozlíši ukážku od vlastného textu, aby sa naše skúšky nepočítali ako použitie.
import { najdi, vysledok, pocty, okolie, kluce, navrhPre, htmlNaText, povolenySubor, jeHtmlSubor, pripona,
  nazovVysledku, NAZVY_DOVODOV, UKAZKA, MAX_ZNAKOV, MAX_BAJTOV } from './jadro.js?v=1.1';

const $ = (id) => document.getElementById(id);
const pole = $('text'), okno = $('oznaceny-text'), stav = $('stav'), chyba = $('chyba'), zoznam = $('zoznam-ponechane');
const cislo = new Intl.NumberFormat('en-US');
// Viac tlačidiel naraz by stránku spomalilo. Kópia a stiahnutie berú vždy všetky nálezy.
const MAX_ZVYRAZNENI = 5000, MAX_ZOZNAM = 1000;
const znizenyPohyb = () => !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Predvolený tvar určuje stránka (zaškrtnutá voľba): „Super Intelligence, as in the order“.
const zvolenyTvar = () => { const r = document.querySelector('input[name="velke"]:checked'); return !r || r.value !== 'nie'; };
let text = '', nalezy = [], zapnute = [], klucePoli = [], velke = zvolenyTvar(), siUz = 0;
let nazovSuboru = '', csv, zaloha = null, casMerania, casHlasenia, skladanie = false;
const volby = new Map(); // kľúč nálezu -> voľba človeka, keď sa líši od predvolenej (prežije úpravu textu)

function prvok(tag, trieda, obsah) {
  const e = document.createElement(tag);
  if (trieda) e.className = trieda;
  if (obsah != null) e.textContent = obsah;
  return e;
}
function ohlas(veta) {
  stav.textContent = '';
  requestAnimationFrame(() => { stav.textContent = veta; });
}
// Brána pokus 2, nález A: text, ktorý definuje AI inak (avian influenza (AI)), podrží všetky AI na posúdenie.
// Okno výsledku povie prečo hneď pod počtami a jedným ťukom zmení všetky okrem samotnej definície.
const DEF_DOVOD = 'Your text defines AI as “';
function definiciaZDovodu(n) { return n.ponechat === 'vyznam' && n.dovod && n.dovod.startsWith(DEF_DOVOD) ? n.dovod.slice(DEF_DOVOD.length, n.dovod.indexOf('”', DEF_DOVOD.length)) : null; }
function jeSamaDefinicia(n, vyraz) {
  const pred = text.slice(Math.max(0, n.od - vyraz.length - 3), n.od).replace(/\s+/g, ' ').toLowerCase();
  const za = text.slice(n.do, n.do + vyraz.length + 3).replace(/\s+/g, ' ').toLowerCase();
  return (pred.endsWith(vyraz.toLowerCase() + ' (') && text[n.do] === ')') || (text[n.od - 1] !== '(' && za.startsWith(' (' + vyraz.toLowerCase()));
}
function suhrnVeta() {
  if (!text.trim()) return 'The text box is empty.';
  const p = pocty(nalezy, zapnute);
  if (!p.najdene) return 'No AI, A.I. or artificial intelligence found.';
  return `${cislo.format(p.najdene)} found: ${cislo.format(p.zmeni)} will change, ${cislo.format(p.ponechane)} kept for review.`;
}
// Krátke potvrdenie priamo na tlačidle, kam sa človek pozerá; potom sa vráti pôvodný text.
function potvrd(b, veta) {
  clearTimeout(b.siCas);
  if (b.dataset.popis === undefined) b.dataset.popis = b.textContent;
  b.textContent = veta;
  b.siCas = setTimeout(() => { b.textContent = b.dataset.popis; delete b.dataset.popis; if (b.id === 'prijat') oznacPrijat(); }, 1800);
}
// Andrej 1. 10. 2026: „nech funguje Accept all suggestions“. Návrhy sú zapnuté hneď po kontrole, takže tlačidlo
// väčšinou nemalo čo zapnúť („All 4 suggestions were already on“) a pôsobilo mŕtvo. Teraz robí vždy to, čo hovorí:
// keď je niektorý návrh vypnutý, zapne všetky návrhy; keď sú zapnuté, ponúkne zmeniť aj ponechané na kontrolu
// (názvy zákonov, mená, citáty, skoršie dokumenty, iný význam); webové adresy, hashtagy a účty a samotnú definíciu
// nezmení nikdy, lebo zmena by ich pokazila; keď už nie je čo zmeniť, povie to a je neaktívne.
const NIKDY_NEMENIT = new Set(['odkaz', 'identifikator']);
function mozeZmenitPonechany(n, vyraz) { return !!n.ponechat && !NIKDY_NEMENIT.has(n.ponechat) && !(vyraz && jeSamaDefinicia(n, vyraz)); }
function stavPrijat() {
  const vyraz = nalezy.map(definiciaZDovodu).find(Boolean) || null;
  let vypnuteNavrhy = 0, vypnutePonechane = 0;
  nalezy.forEach((n, i) => {
    if (zapnute[i]) return;
    if (!n.ponechat) vypnuteNavrhy++;
    else if (mozeZmenitPonechany(n, vyraz)) vypnutePonechane++;
  });
  return { vypnuteNavrhy, vypnutePonechane, vyraz };
}
function oznacPrijat() {
  const b = $('prijat');
  if (!b || b.dataset.popis !== undefined) return;
  const s = stavPrijat();
  b.disabled = !s.vypnuteNavrhy && !s.vypnutePonechane;
  b.textContent = s.vypnuteNavrhy ? 'Accept all suggestions'
    : s.vypnutePonechane ? `Change the ${cislo.format(s.vypnutePonechane)} kept ${s.vypnutePonechane === 1 ? 'one' : 'ones'} too`
      : 'All suggestions accepted';
}
function ukazChybu(veta, vPoli = false) {
  chyba.textContent = veta;
  chyba.hidden = false;
  if (vPoli) pole.setAttribute('aria-invalid', 'true');
  ohlas(veta);
}
function skryChybu() {
  chyba.hidden = true;
  chyba.textContent = '';
  pole.removeAttribute('aria-invalid');
}

// ── Vykreslenie ──────────────────────────────────────────────────────────────
function vyplnNalez(b, n, zap) {
  const nove = navrhPre(n, velke);
  b.setAttribute('aria-pressed', String(zap));
  b.setAttribute('aria-label', `${n.text} to ${nove}` + (n.ponechat ? `, ${NAZVY_DOVODOV[n.ponechat].toLowerCase()}` : ''));
  b.replaceChildren(...(zap ? [prvok('span', 'si-stare', n.text), prvok('span', 'si-nove', nove)] : [prvok('span', 'si-povodne', n.text)]));
}
// Zvýraznenie je span s role="button" (nie <button>): prehliadač kreslí <button> ako inline-block, takže dlhý
// nález by vytrhol vetu na samostatný riadok (brána pokus 1, nález 8). Span ostane v toku textu.
function vykresliText() {
  const frag = document.createDocumentFragment();
  const limit = Math.min(nalezy.length, MAX_ZVYRAZNENI);
  let p = 0;
  for (let i = 0; i < limit; i++) {
    const n = nalezy[i];
    if (n.od > p) frag.append(text.slice(p, n.od));
    const b = prvok('span', 'si-nalez');
    b.setAttribute('role', 'button');
    b.setAttribute('tabindex', '0');
    b.id = 'n-' + i;
    b.dataset.i = String(i);
    if (n.ponechat) b.dataset.dovod = n.ponechat;
    b.setAttribute('aria-describedby', 'napoveda-text');
    vyplnNalez(b, n, zapnute[i]);
    frag.append(b);
    p = n.do;
  }
  if (p < text.length) frag.append(text.slice(p));
  okno.replaceChildren(frag);
  okno.hidden = !text;
  const vela = $('vela');
  vela.hidden = nalezy.length <= MAX_ZVYRAZNENI;
  if (!vela.hidden) vela.textContent = `Highlights show the first ${cislo.format(MAX_ZVYRAZNENI)} of ${cislo.format(nalezy.length)} findings. Copy and download include every change.`;
}
function vykresliZoznam() {
  const frag = document.createDocumentFragment();
  let pocet = 0;
  for (const n of nalezy) {
    if (!n.ponechat) continue;
    if (++pocet > MAX_ZOZNAM) break;
    const li = prvok('li', 'si-polozka');
    li.dataset.dovod = n.ponechat;
    const o = okolie(text, n);
    const kontext = prvok('p', 'si-kontext');
    kontext.append(o.pred, prvok('mark', null, o.jadro), o.po);
    const riadok = prvok('div', 'si-riadok');
    const label = prvok('label', 'si-prepnut');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = 'p-' + n.i;
    cb.dataset.i = String(n.i);
    cb.checked = zapnute[n.i];
    label.append(cb, prvok('span', null, `Change to “${navrhPre(n, velke)}”`));
    riadok.append(label);
    if (n.i < MAX_ZVYRAZNENI) {
      const a = prvok('a', 'si-skok', 'Show in text');
      a.href = '#n-' + n.i;
      a.dataset.skok = String(n.i);
      riadok.append(a);
    }
    li.append(kontext, prvok('p', 'si-dovod', n.dovod), riadok);
    frag.append(li);
  }
  zoznam.replaceChildren(frag);
  zoznam.hidden = pocet === 0;
  const prazdne = $('posudit-prazdne');
  prazdne.hidden = pocet > 0 && pocet <= MAX_ZOZNAM;
  prazdne.textContent = pocet > MAX_ZOZNAM ? `The list shows the first ${cislo.format(MAX_ZOZNAM)} kept findings. Copy and download include your choices for all of them.`
    : nalezy.length ? 'Nothing is held back. Every finding will change.'
      : 'Nothing to review: no AI, A.I. or artificial intelligence in the text.';
}
// Brána pokus 3, nález F: veta o definícii a nápoveda pri Accept all sa obnovia po každom ťuku aj po tlačidle.
function obnovDefiniciu() {
  const vyraz = nalezy.map(definiciaZDovodu).find(Boolean) || null;
  const ine = vyraz ? nalezy.map((n, i) => [n, i]).filter(([n]) => definiciaZDovodu(n) && !jeSamaDefinicia(n, vyraz)) : [];
  const zapnutych = ine.filter(([, i]) => zapnute[i]).length;
  $('definicia').hidden = !vyraz || !ine.length;
  $('zmenit-definicia').hidden = zapnutych === ine.length;
  if (vyraz) $('definicia-veta').textContent = zapnutych === ine.length
    ? `Your text defines AI as “${vyraz}”. The other ${cislo.format(ine.length)} now change to SI; the definition stays as it is.`
    : `Your text defines AI as “${vyraz}”, so every AI is kept for your review. If the other ${cislo.format(ine.length)} mean the technology, change them in one tap; the definition stays.`;
  const nicSaNemeni = nalezy.length > 0 && !nalezy.some((n) => !n.ponechat) && !zapnute.some(Boolean);
  const napoveda = $('napoveda-text').firstChild;
  if (napoveda && napoveda.nodeType === 3) napoveda.textContent = nicSaNemeni ? 'Every finding here is kept for your review. Tap a highlight to change one, or change them all with the button below. ' : 'Tap a highlight to switch between the change and your original wording.';
}
function vykresliPocty() {
  const p = pocty(nalezy, zapnute);
  $('pocet-najdene').textContent = cislo.format(p.najdene);
  $('pocet-zmeni').textContent = cislo.format(p.zmeni);
  $('pocet-ponechane').textContent = cislo.format(p.ponechane);
  $('suhrn-riadok').hidden = !text.trim();
  $('suhrn-veta').textContent = suhrnVeta();
  if (nalezy.length) obnovDefiniciu();
  oznacPrijat();
}
function vykresli() {
  const ukazka = text === UKAZKA;
  for (const id of ['povod-stitok', 'okno-stitok', 'povod']) $(id).hidden = !ukazka;
  for (const id of ['kopirovat', 'stiahnut']) {
    $(id).disabled = !text;
    $(id).dataset.umamiEventVstup = ukazka ? 'ukazka' : 'vlastny';
  }
  obnovDefiniciu();
  $('moznost-velke').hidden = !nalezy.some((n) => n.navrhVelke);
  const pozor = $('si-pozor');
  pozor.hidden = !(siUz && nalezy.length);
  if (!pozor.hidden) {
    pozor.textContent = `“SI” already appears ${siUz === 1 ? 'once' : cislo.format(siUz) + ' times'} in your text, before any change. `
      + 'SI can also mean SI units, so check that the new SI reads clearly.';
  }
  const prazdne = $('prazdne');
  prazdne.hidden = nalezy.length > 0;
  prazdne.textContent = text.trim() ? 'No AI, A.I. or artificial intelligence found. Nothing to change.'
    : 'Paste text, open a file or load the sample. The result appears here.';
  vykresliPocty();
  vykresliText();
  vykresliZoznam();
}
// Po zmene voľby alebo „Accept all“ sa prekreslia len stavy, nie celý text (fokus ostane na mieste).
function aktualizujStavy() {
  nalezy.forEach((n, i) => {
    const b = $('n-' + i);
    if (b) vyplnNalez(b, n, zapnute[i]);
    const cb = $('p-' + i);
    if (cb) cb.checked = zapnute[i];
  });
  vykresliPocty();
}

// ── Kontrola ─────────────────────────────────────────────────────────────────
function skontroluj({ ohlasit = false } = {}) {
  clearTimeout(casMerania);
  clearTimeout(casHlasenia);
  const t = pole.value;
  if (t.length > MAX_ZNAKOV) {
    text = ''; nalezy = []; zapnute = []; klucePoli = []; siUz = 0;
    vykresli();
    $('prazdne').textContent = `Nothing was checked: the text is over the ${cislo.format(MAX_ZNAKOV)} character limit.`;
    ukazChybu(`This text has ${cislo.format(t.length)} characters. The checker takes up to ${cislo.format(MAX_ZNAKOV)} at once, so check it in parts.`, true);
    return;
  }
  skryChybu();
  text = t;
  const r = najdi(text, { csv });
  nalezy = r.nalezy;
  siUz = r.siUz;
  klucePoli = kluce(nalezy);
  zapnute = nalezy.map((n, i) => (volby.has(klucePoli[i]) ? volby.get(klucePoli[i]) : !n.ponechat));
  vykresli();
  if (ohlasit) ohlas(suhrnVeta());
}
function prepni(i, zap) {
  const n = nalezy[i];
  if (!n) return;
  zapnute[i] = zap;
  if (zap === !n.ponechat) volby.delete(klucePoli[i]); else volby.set(klucePoli[i], zap);
  const b = $('n-' + i);
  if (b) vyplnNalez(b, n, zap);
  const cb = $('p-' + i);
  if (cb) cb.checked = zap;
  vykresliPocty();
}
function naplanuj() {
  clearTimeout(casMerania);
  clearTimeout(casHlasenia);
  if (skladanie) return;
  const dlhy = pole.value.length > 100000;
  casMerania = setTimeout(() => skontroluj(), dlhy ? 900 : 300);
  casHlasenia = setTimeout(() => ohlas(suhrnVeta()), dlhy ? 2000 : 1500);
}
// Pred prepísaním vlastného textu (ukážka, súbor, prázdne pole) sa dá vrátiť späť.
function odloz() {
  if (!pole.value || pole.value === UKAZKA) return;
  zaloha = { text: pole.value, nazovSuboru, csv, volby: new Map(volby) };
  $('spat').hidden = false;
}
function novyText(hodnota, subor = '') {
  pole.value = hodnota;
  nazovSuboru = subor;
  csv = subor ? pripona(subor) === 'csv' : undefined;
  volby.clear();
}

// ── Súbor: prečíta ho prehliadač (FileReader), nič sa nenahráva ──────────────
function otvorSubor(f) {
  const info = $('subor-info');
  if (!povolenySubor(f.name)) {
    ukazChybu(`“${f.name}” is not a .txt, .md, .html or .csv file. Open one of those, or paste the text.`);
    return;
  }
  if (f.size > MAX_BAJTOV) {
    ukazChybu(`“${f.name}” is ${(f.size / 1048576).toFixed(1)} MB. Open files up to 5 MB, or paste part of the text.`);
    return;
  }
  const citac = new FileReader();
  citac.onload = () => {
    const html = jeHtmlSubor(f.name);
    const obsah = html ? htmlNaText(String(citac.result ?? '')) : String(citac.result ?? '');
    odloz();
    novyText(obsah, f.name);
    skontroluj();
    info.textContent = `Opened ${f.name}.` + (html ? ' Only the text is checked: tags and attributes are left out, and the result is plain text.'
      : csv ? ' Quotation marks around CSV fields are not treated as quotations.' : '');
    info.hidden = false;
    ohlas(info.textContent + ' ' + suhrnVeta());
  };
  citac.onerror = () => ukazChybu(`“${f.name}” could not be read. Try again, or paste the text.`);
  citac.readAsText(f);
}
$('subor').addEventListener('change', () => {
  const f = $('subor').files && $('subor').files[0];
  if (f) otvorSubor(f);
  $('subor').value = '';
});
const maSubory = (e) => Array.from((e.dataTransfer && e.dataTransfer.types) || []).includes('Files');
for (const typ of ['dragenter', 'dragover']) {
  pole.addEventListener(typ, (e) => { if (!maSubory(e)) return; e.preventDefault(); pole.classList.add('si-nad'); });
}
for (const typ of ['dragleave', 'dragend']) pole.addEventListener(typ, () => pole.classList.remove('si-nad'));
pole.addEventListener('drop', (e) => {
  pole.classList.remove('si-nad');
  const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (f) { e.preventDefault(); otvorSubor(f); return; }
  const pusteny = pole.value === UKAZKA && e.dataTransfer ? e.dataTransfer.getData('text/plain') : '';
  if (pusteny) { e.preventDefault(); nahradUkazku(pusteny); }
});

// Ukážka je skutočný obsah poľa. Prvé vloženie, prvý napísaný znak alebo pustený text ju celú nahradí
// (brána pokus 1, nález 10); inak by sa vlastný text zmiešal s vymysleným memom a Copy result skopíroval oboje.
function nahradUkazku(novy) {
  novyText(novy);
  $('subor-info').hidden = true;
  try { pole.setSelectionRange(novy.length, novy.length); } catch { /* prehliadač bez výberu v poli */ }
  skontroluj();
  ohlas('Sample replaced with your text. ' + suhrnVeta());
}
pole.addEventListener('paste', (e) => {
  if (pole.value !== UKAZKA) return;
  const vlozene = e.clipboardData ? e.clipboardData.getData('text/plain') : '';
  if (!vlozene) return;
  e.preventDefault();
  nahradUkazku(vlozene);
});
pole.addEventListener('beforeinput', (e) => {
  if (pole.value !== UKAZKA || skladanie || e.isComposing) return;
  if (e.inputType !== 'insertText' && e.inputType !== 'insertLineBreak') return;
  e.preventDefault();
  nahradUkazku(e.inputType === 'insertLineBreak' ? '\n' : e.data || '');
});

// ── Ovládanie ────────────────────────────────────────────────────────────────
$('formular').addEventListener('submit', (e) => {
  e.preventDefault();
  skontroluj({ ohlasit: true });
  if (!chyba.textContent) potvrd($('skontrolovat'), 'Checked');
});
pole.addEventListener('input', naplanuj);
pole.addEventListener('compositionstart', () => { skladanie = true; });
pole.addEventListener('compositionend', () => { skladanie = false; naplanuj(); });

$('vlastny').addEventListener('click', () => {
  odloz();
  novyText('');
  $('subor-info').hidden = true;
  skontroluj();
  pole.focus();
  ohlas('The text box is empty. Paste your text or open a file.');
});
$('ukazka').addEventListener('click', () => {
  odloz();
  novyText(UKAZKA);
  $('subor-info').hidden = true;
  skontroluj({ ohlasit: true });
});
$('spat').addEventListener('click', () => {
  if (!zaloha) return;
  const z = zaloha;
  zaloha = null;
  novyText(z.text, z.nazovSuboru);
  csv = z.csv;
  z.volby.forEach((v, k) => volby.set(k, v));
  $('spat').hidden = true;
  skontroluj({ ohlasit: true });
  pole.focus();
});

okno.addEventListener('click', (e) => {
  const b = e.target.closest('.si-nalez');
  if (b) prepni(Number(b.dataset.i), b.getAttribute('aria-pressed') !== 'true');
});
// Span s role="button" musí na klávesnici fungovať ako tlačidlo: Enter aj medzerník (bez posunu stránky).
okno.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
  const b = e.target.closest && e.target.closest('.si-nalez');
  if (!b) return;
  e.preventDefault();
  prepni(Number(b.dataset.i), b.getAttribute('aria-pressed') !== 'true');
});
zoznam.addEventListener('change', (e) => {
  const cb = e.target.closest('input[type="checkbox"][data-i]');
  if (cb) prepni(Number(cb.dataset.i), cb.checked);
});
zoznam.addEventListener('click', (e) => {
  const a = e.target.closest('[data-skok]');
  if (!a) return;
  e.preventDefault();
  const b = $('n-' + a.dataset.skok);
  if (!b) return;
  b.scrollIntoView({ block: 'center', behavior: znizenyPohyb() ? 'auto' : 'smooth' });
  b.focus({ preventScroll: true });
});
$('zmenit-definicia').addEventListener('click', () => {
  const vyraz = nalezy.map(definiciaZDovodu).find(Boolean);
  if (!vyraz) return;
  let zmenene = 0;
  nalezy.forEach((n, i) => {
    if (!definiciaZDovodu(n) || jeSamaDefinicia(n, vyraz) || zapnute[i]) return;
    prepni(i, true);
    zmenene++;
  });
  potvrd($('zmenit-definicia'), zmenene ? 'Changed' : 'Already changed');
  ohlas(zmenene ? `${cislo.format(zmenene)} changed to SI. The definition “${vyraz} (AI)” stays.` : 'Those AIs were already changed.');
});
$('prijat').addEventListener('click', () => {
  const s = stavPrijat();
  if (s.vypnuteNavrhy) {
    let navrhov = 0;
    nalezy.forEach((n, i) => {
      if (n.ponechat) return;
      navrhov++;
      zapnute[i] = true;
      volby.delete(klucePoli[i]);
    });
    aktualizujStavy();
    potvrd($('prijat'), 'All suggestions on');
    ohlas(`All ${cislo.format(navrhov)} suggestions are on.` + (s.vypnutePonechane
      ? ` ${cislo.format(s.vypnutePonechane)} kept for review stay as they are; press the button again to change those too.` : ''));
    return;
  }
  if (!s.vypnutePonechane) return;
  let zmenene = 0;
  nalezy.forEach((n, i) => {
    if (zapnute[i] || !mozeZmenitPonechany(n, s.vyraz)) return;
    zapnute[i] = true;
    volby.set(klucePoli[i], true);
    zmenene++;
  });
  const ostava = zapnute.filter((z) => !z).length;
  aktualizujStavy();
  potvrd($('prijat'), 'Changed');
  ohlas(`${cislo.format(zmenene)} kept ${zmenene === 1 ? 'one' : 'ones'} changed too.`
    + (ostava ? ` ${cislo.format(ostava)} stay unchanged: web addresses, hashtags and the definition itself would break.` : '')
    + ' Tap any highlight to undo it.');
});
for (const r of document.querySelectorAll('input[name="velke"]')) {
  r.addEventListener('change', () => {
    velke = zvolenyTvar();
    aktualizujStavy();
    vykresliZoznam();
    ohlas(velke ? 'Lowercase artificial intelligence becomes Super Intelligence, as in the order.' : 'Lowercase artificial intelligence becomes super intelligence.');
  });
}

// Kopírovať: schránka, a keď ju prehliadač nedovolí, okno s označeným textom na ručné skopírovanie.
$('kopirovat').addEventListener('click', async () => {
  if (pole.value !== text) skontroluj();
  if (!text) return;
  const vystup = vysledok(text, nalezy, zapnute, { velke });
  const p = pocty(nalezy, zapnute);
  try {
    if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('schranka');
    await navigator.clipboard.writeText(vystup);
    potvrd($('kopirovat'), 'Copied');
    ohlas(`Copied the result with ${cislo.format(p.zmeni)} ${p.zmeni === 1 ? 'change' : 'changes'}.`);
  } catch {
    const d = $('kopia'), t = $('kopia-text');
    t.value = vystup;
    if (!d.open) { if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', ''); }
    t.focus();
    t.select();
  }
});
$('kopia').addEventListener('close', () => $('kopirovat').focus());

// Stiahnuť: Blob a odkaz vznikne až po kliknutí, súbor skladá prehliadač.
$('stiahnut').addEventListener('click', () => {
  if (pole.value !== text) skontroluj();
  if (!text) return;
  const vystup = vysledok(text, nalezy, zapnute, { velke });
  const nazov = nazovSuboru ? nazovVysledku(nazovSuboru) : text === UKAZKA ? 'ai-to-si-sample.txt' : 'ai-to-si-result.txt';
  const url = URL.createObjectURL(new Blob([vystup], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nazov;
  a.hidden = true;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  potvrd($('stiahnut'), 'Downloaded');
  ohlas(`Downloaded ${nazov}.`);
});

for (const id of ['skontrolovat', 'vlastny', 'subor', 'ukazka']) $(id).disabled = false;
skontroluj();
