/* Vzory zmlúv: formulár, náhľad a sťahovanie. Zadarmo, bez zámku, bez platby.
 *
 * Všetko sa deje v prehliadači. Formulár každého dokumentu má vlastný kľúč
 * v localStorage (vzory:formular:<id>), zmluva sa skladá tu (dokumenty-sk.js)
 * a DOCX sa zapisuje tu (docx.js). Na server neodchádza nič, žiadne volanie.
 *
 * Vzory sú magnet, nie produkt: náhľad je celá zmluva a DOCX aj ZIP so
 * všetkými piatimi sa sťahujú bez platby. Zarábame na GDPR balíku
 * (arling.sk/gdpr-dokumenty/) a na kontrole e-faktúry (arling.sk/efaktura/),
 * o čom je veta pri stiahnutí. Staré kľúče vzory:zaplatene a
 * vzory:zaplatene:zoznam z čias, keď sa tu platilo, sa už nečítajú.
 *
 * Udalosti do Umami (ak beží): vzory_nahlad, vzory_stiahnute, každá s
 * vlastnosťou dokument. Popri nich spoločné mená nastroj_pouzity a
 * cena_videna, ktoré používajú aj ostatné nástroje, aby sa dal počítať
 * zárobok na sto návštev.
 */
import { docx, html, zip } from './docx.js';
import { DOKUMENTY, dokumentPodlaId, prazdnyFormular, chybajucePovinne } from './dokumenty-sk.js';

const $ = (id) => document.getElementById(id);
const zalozky = $('zalozky');
const polia = $('polia');
const nahlad = $('nahlad');
const stiahnutDocx = $('stiahnut-docx');
const stiahnutVsetko = $('stiahnut-vsetko');
const chyby = $('chyby');
const poznamka = $('nahlad-poznamka');
const opory = $('opory');

function track(name, data) { try { if (window.umami && typeof window.umami.track === 'function') window.umami.track(name, data); } catch (e) { /* nič */ } }
function nacitaj(k) { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function uloz(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* bez úložiska to beží ďalej */ } }
function zabudni(k) { try { localStorage.removeItem(k); } catch (e) { /* nič */ } }

/* === Ktorý dokument je otvorený ======================================== */

/* Adresa pri príchode. Drží sa bokom, lebo stránka si hneď po štarte prepíše
 * adresu na čistú podobu s ?vzor=<id> (zdieľateľný odkaz na jednu zmluvu). */
const PRVOTNA_URL = location.href;
function zUrl(kluc) {
  try { return new URL(PRVOTNA_URL).searchParams.get(kluc) || ''; } catch (e) { return ''; }
}
let vybrany = DOKUMENTY.some((x) => x.id === zUrl('vzor')) ? zUrl('vzor') : DOKUMENTY[0].id;
let dok = dokumentPodlaId(vybrany);
let d = {};

/* === Formulár ========================================================= */

/* Dnešok podľa hodín návštevníka, nie podľa UTC: o polnoci by inak vo
 * formulári svietil včerajší dátum podpisu. */
function dnes() {
  const t = new Date();
  const dve = (n) => String(n).padStart(2, '0');
  return t.getFullYear() + '-' + dve(t.getMonth() + 1) + '-' + dve(t.getDate());
}

function poleId(id) { return 'p-' + id.replace(/\./g, '-'); }

/* Formulár sa stavia zo zoznamu polí dokumentu: polia sa zoskupia podľa
 * sekcie, aby človek videl zmluvu po častiach (strany, byt, peniaze,
 * podpis) a nie ako jeden dlhý stĺpec. */
function postavFormular() {
  polia.textContent = '';
  const skupiny = [];
  for (const p of dok.polia) {
    const nazov = p.sekcia || 'Základné nastavenie';
    let s = skupiny.find((x) => x.nazov === nazov);
    if (!s) { s = { nazov, zoznam: [] }; skupiny.push(s); }
    s.zoznam.push(p);
  }
  for (const s of skupiny) {
    const fs = document.createElement('fieldset');
    const lg = document.createElement('legend');
    lg.textContent = s.nazov;
    fs.appendChild(lg);
    for (const p of s.zoznam) fs.appendChild(polePrvok(p));
    polia.appendChild(fs);
  }
}
function polePrvok(p) {
  const obal = document.createElement('div');
  obal.className = 'pole-obal';
  if (p.typ === 'zaskrtnutie') {
    const l = document.createElement('label');
    l.className = 'zaskrtnutie';
    const i = document.createElement('input');
    i.type = 'checkbox'; i.name = p.id; i.id = poleId(p.id);
    i.checked = !!p.predvolene;
    l.appendChild(i);
    l.appendChild(document.createTextNode(' ' + p.popis));
    obal.appendChild(l);
  } else {
    const l = document.createElement('label');
    l.className = 'pole';
    l.htmlFor = poleId(p.id);
    const s = document.createElement('span');
    s.textContent = p.popis;
    if (p.povinne) { const h = document.createElement('i'); h.className = 'hviezda'; h.textContent = ' *'; h.title = 'povinný údaj'; s.appendChild(h); }
    l.appendChild(s);
    let vstup;
    if (p.typ === 'vyber') {
      vstup = document.createElement('select');
      for (const m of p.moznosti || []) {
        const o = document.createElement('option');
        o.value = m.hodnota; o.textContent = m.text;
        vstup.appendChild(o);
      }
      vstup.value = p.predvolene || (p.moznosti && p.moznosti[0] ? p.moznosti[0].hodnota : '');
    } else {
      vstup = document.createElement('input');
      vstup.type = p.typ === 'datum' ? 'date' : 'text';
      if (p.typ === 'cislo') vstup.inputMode = 'decimal';
      if (p.predvolene) vstup.placeholder = String(p.predvolene);
      if (p.id === 'datum') vstup.value = dnes();
    }
    vstup.name = p.id;
    vstup.id = poleId(p.id);
    l.appendChild(vstup);
    obal.appendChild(l);
  }
  if (p.pomoc) {
    const pom = document.createElement('p');
    pom.className = 'pomoc';
    pom.textContent = p.pomoc;
    obal.appendChild(pom);
  }
  if (p.upozornenie) {
    const u = document.createElement('p');
    u.className = 'upozornenie';
    u.id = poleId(p.id) + '-upoz';
    u.textContent = p.upozornenie;
    u.hidden = true;
    obal.appendChild(u);
  }
  return obal;
}

function precitajFormular() {
  const out = {};
  for (const p of dok.polia) {
    const el = document.getElementById(poleId(p.id));
    if (!el) continue;
    if (p.typ === 'zaskrtnutie') { out[p.id] = el.checked; continue; }
    out[p.id] = String(el.value || '').trim();
  }
  return out;
}
function naplnFormular(ulozene) {
  if (!ulozene) return;
  for (const p of dok.polia) {
    const el = document.getElementById(poleId(p.id));
    if (!el || !Object.prototype.hasOwnProperty.call(ulozene, p.id)) continue;
    if (p.typ === 'zaskrtnutie') { el.checked = ulozene[p.id] === true; continue; }
    if (ulozene[p.id] !== undefined && ulozene[p.id] !== null) el.value = String(ulozene[p.id]);
  }
}

/* === Náhľad =========================================================== */

const PATA = () => 'Vytvorené na arling.sk/vzory-zmluv/ dňa ' + new Date().toLocaleDateString('sk-SK')
  + '. Vzor, nie právne poradenstvo: pred podpisom si ho prečítajte a upravte podľa svojej situácie.';

function prekresli() {
  d = precitajFormular();
  uloz('vzory:formular:' + vybrany, d);
  postavZalozky();
  const bloky = dok.fn(d);
  nahlad.innerHTML = '<div class="papier">' + html(bloky) + '<p class="pata">' + PATA() + '</p></div>';

  poznamka.innerHTML = '<b>Zadarmo:</b> celá zmluva, na stiahnutie vo Worde. Formulár môžete ďalej upravovať, dokument sa prepíše.'
    + ' Ak vám vzor pomohol, pozrite si <a href="https://arling.sk/gdpr-dokumenty/">GDPR balík pre firmu za 39 €</a> alebo <a href="https://arling.sk/efaktura/">kontrolu e-faktúry</a>.';

  ukazChyby();
  ukazOpory();
  oznamPouzitie();
}

function postavZalozky() {
  zalozky.textContent = '';
  for (const x of DOKUMENTY) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'zalozka' + (x.id === vybrany ? ' aktivna' : '');
    b.textContent = x.nazov;
    b.title = x.popis;
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', x.id === vybrany ? 'true' : 'false');
    b.addEventListener('click', () => prepni(x.id));
    zalozky.appendChild(b);
  }
}
/* Adresa nesie vybraný vzor, aby sa dal poslať odkaz priamo na jednu zmluvu
 * (a aby si ho stránka pamätala pri obnovení). */
function adresa() {
  try { history.replaceState(null, '', location.pathname + '?vzor=' + vybrany); } catch (e) { /* nič */ }
}
function prepni(id) {
  if (id === vybrany) return;
  vybrany = id;
  dok = dokumentPodlaId(id);
  dotknute = false;
  postavFormular();
  naplnFormular(nacitaj('vzory:formular:' + id));
  adresa();
  prekresli();
  track('vzory_nahlad', { dokument: id, produkt: 'vzory' });
}

/* Chýbajúce povinné údaje. Nie sú to výmysly: bez nich je zmluva neúplná
 * alebo sa podanie zamietne, preto sa bez nich DOCX nesťahuje.
 *
 * Zoznam sa neukáže hneď po príchode. Prázdny formulár nie je chyba a červený
 * odstavec pri prvom pohľade by len strašil; povinné polia sú aj tak označené
 * hviezdičkou. Objaví sa, až keď človek začne písať alebo si pýta súbor. */
let dotknute = false;
function ukazChyby() {
  const chyba = chybajucePovinne(dok.zdroj, d);
  for (const p of dok.polia) {
    const u = document.getElementById(poleId(p.id) + '-upoz');
    if (u) u.hidden = !(p.upozornenie && chyba.some((x) => x.id === p.id));
  }
  if (!chyba.length || !dotknute) { chyby.hidden = true; chyby.textContent = ''; return; }
  chyby.hidden = false;
  chyby.textContent = 'Ešte chýba: ' + chyba.map((p) => p.popis).join(', ') + '.';
}

function ukazOpory() {
  const casti = [];
  casti.push('<h3>Na čom vzor stojí</h3><ul class="paragrafy">'
    + dok.paragrafy.map((x) => '<li>' + escapuj(x) + '</li>').join('') + '</ul>');
  casti.push('<h3>Čo vzor nerieši</h3><p>' + escapuj(dok.poznamka) + '</p>');
  casti.push('<h3>Otázky k tomuto vzoru</h3>'
    + dok.faq.map((x) => '<details><summary>' + escapuj(x.otazka) + '</summary><p>' + escapuj(x.odpoved) + '</p></details>').join(''));
  opory.innerHTML = casti.join('');
}
function escapuj(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* === Meranie ========================================================== */

let pouzite = false;
function oznamPouzitie() {
  if (pouzite) return;
  const vyplnene = dok.polia.some((p) => p.typ !== 'zaskrtnutie' && p.typ !== 'vyber' && p.id !== 'datum' && String(d[p.id] || '').trim() !== '');
  if (!vyplnene) return;
  pouzite = true;
  track('nastroj_pouzity', { produkt: 'vzory', dokument: vybrany });
}
function sledujCenuVidenu() {
  try {
    const box = document.querySelector('.cena');
    if (!box || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((zaznamy) => {
      for (const z of zaznamy) if (z.isIntersecting) { track('cena_videna', { produkt: 'vzory' }); io.disconnect(); }
    }, { threshold: 0.5 });
    io.observe(box);
  } catch (e) { /* nič */ }
}

/* === Sťahovanie ======================================================= */

function stiahni(nazov, bajty, typ) {
  const blob = new Blob([bajty], { type: typ || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nazov;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}
const bezDiakritiky = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
function subor(x) { return bezDiakritiky(x.nazov).slice(0, 60) + '.docx'; }

stiahnutDocx.addEventListener('click', () => {
  const chyba = chybajucePovinne(dok.zdroj, d);
  if (chyba.length) {
    dotknute = true;
    chyby.hidden = false;
    chyby.textContent = 'Bez týchto údajov by bola zmluva neúplná, doplňte ich: ' + chyba.map((p) => p.popis).join(', ') + '.';
    const prve = document.getElementById(poleId(chyba[0].id));
    if (prve) { prve.scrollIntoView({ behavior: 'smooth', block: 'center' }); prve.focus(); }
    return;
  }
  stiahni(subor(dok), docx(dok.fn(d), PATA()));
  track('vzory_stiahnute', { dokument: vybrany, produkt: 'vzory' });
});
stiahnutVsetko.addEventListener('click', () => {
  const subory = DOKUMENTY.map((x) => {
    const udaje = x.id === vybrany ? d : (nacitaj('vzory:formular:' + x.id) || prazdnyFormular(x.zdroj));
    return [subor(x), docx(x.fn(udaje), PATA())];
  });
  stiahni('vzory-zmluv-arling.zip', zip(subory), 'application/zip');
  track('vzory_stiahnute', { dokument: 'balik', pocet: subory.length, produkt: 'vzory' });
});

/* === Štart ============================================================ */

postavFormular();
naplnFormular(nacitaj('vzory:formular:' + vybrany));
polia.addEventListener('input', () => { dotknute = true; prekresli(); });
polia.addEventListener('change', () => { dotknute = true; prekresli(); });
$('formular').addEventListener('submit', (e) => e.preventDefault());
$('zmazat').addEventListener('click', () => {
  if (!window.confirm('Vymazať vyplnené údaje tejto zmluvy z tohto prehliadača?')) return;
  zabudni('vzory:formular:' + vybrany);
  postavFormular();
  prekresli();
});
prekresli();
adresa();
sledujCenuVidenu();
track('vzory_nahlad', { dokument: vybrany, produkt: 'vzory' });
