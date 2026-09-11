/* Vzory zmlúv: formulár, náhľad, platba a sťahovanie.
 *
 * Všetko sa deje v prehliadači. Formulár každého dokumentu má vlastný kľúč
 * v localStorage (vzory:formular:<id>), zmluva sa skladá tu (dokumenty-sk.js)
 * a DOCX sa zapisuje tu (docx.js). Na server neodchádza nič okrem overenia
 * platby: po návrate zo Stripe (?session_id=) sa worker spýta, či je session
 * zaplatená a na akú sumu (GET /v1/kontrola/status, vracia paid,
 * amount_subtotal a livemode, žiadne osobné údaje).
 *
 * Odomknutie sa uloží ako vzory:zaplatene = { session, dokument }, kde
 * dokument je id jednej zmluvy alebo "balik" pre všetkých päť. Keď si niekto
 * kúpi druhú zmluvu samostatne, staré odomknutie neprepadne: každý nákup sa
 * pridá aj do zoznamu vzory:zaplatene:zoznam a stránka pozerá na oba kľúče.
 *
 * Udalosti do Umami (ak beží): vzory_nahlad, vzory_kupa_click,
 * vzory_zaplatene, vzory_stiahnute, každá s vlastnosťou dokument. Popri nich
 * spoločné mená nastroj_pouzity a cena_videna, ktoré používajú aj ostatné
 * nástroje, aby sa dal počítať zárobok na sto návštev.
 */
import { docx, html, zip } from './docx.js';
import { DOKUMENTY, dokumentPodlaId, prazdnyFormular, chybajucePovinne } from './dokumenty-sk.js';

const API = 'https://arling-asistent.arling.workers.dev';
const CENA_DOKUMENT = 690;   /* centy, 6,90 € za jednu zmluvu */
const CENA_BALIK = 1490;     /* centy, 14,90 € za všetkých päť */
const KLUC_ZAPLATENE = 'vzory:zaplatene';
const KLUC_ZOZNAM = 'vzory:zaplatene:zoznam';
const KLUC_KUPUJEM = 'vzory:kupujem';
const KLUC_CAKAJUCA = 'vzory:cakajuca';

const $ = (id) => document.getElementById(id);
const zalozky = $('zalozky');
const polia = $('polia');
const nahlad = $('nahlad');
const stavPlatby = $('stav-platby');
const kupaBalik = $('kupa-balik');
const kupaDokument = $('kupa-dokument');
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
 * adresu na čistú podobu s ?vzor=<id> (zdieľateľný odkaz na jednu zmluvu) a
 * návrat zo Stripe (?session_id=) by sa tým inak stratil. */
const PRVOTNA_URL = location.href;
function zUrl(kluc) {
  try { return new URL(PRVOTNA_URL).searchParams.get(kluc) || ''; } catch (e) { return ''; }
}
let vybrany = DOKUMENTY.some((x) => x.id === zUrl('vzor')) ? zUrl('vzor') : DOKUMENTY[0].id;
let dok = dokumentPodlaId(vybrany);
let d = {};

/* === Odomknutie ======================================================= */

function nakupy() {
  const zoznam = nacitaj(KLUC_ZOZNAM);
  const out = Array.isArray(zoznam) ? zoznam.slice() : [];
  const jeden = nacitaj(KLUC_ZAPLATENE);
  if (jeden && jeden.session) out.push(jeden);
  return out.filter((x) => x && x.session);
}
function odomknute(id) {
  return nakupy().some((x) => x.dokument === 'balik' || x.dokument === id);
}
function maBalik() {
  return nakupy().some((x) => x.dokument === 'balik');
}
function zapisNakup(sid, co, test) {
  const zapis = { session: sid, dokument: co, t: Date.now(), test: !!test };
  uloz(KLUC_ZAPLATENE, zapis);
  const zoznam = nacitaj(KLUC_ZOZNAM);
  const out = Array.isArray(zoznam) ? zoznam.filter((x) => x && x.session !== sid) : [];
  out.push(zapis);
  uloz(KLUC_ZOZNAM, out);
}

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

/* === Náhľad a zámok =================================================== */

/* Koľko textu ukázať zadarmo. Zhruba dve strany A4 v tom formáte, aký má
 * DOCX, a pri krátkych vzoroch najviac necelá polovica textu, aby náhľad
 * nikdy neukázal celú zmluvu. Posledné dva bloky (podpisy) sú vždy skryté. */
const STRANA = 2200;
function dlzkaBloku(b) {
  if (b.t) return b.t.length;
  if (b.p !== undefined) return b.p.length;
  if (b.ul) return b.ul.join(' ').length;
  if (b.tbl) return b.tbl.flat().join(' ').length;
  return 0;
}
function pocetVolnych(bloky) {
  const spolu = bloky.reduce((a, b) => a + dlzkaBloku(b), 0);
  const limit = Math.min(2 * STRANA, Math.round(spolu * 0.45));
  let n = 0, k = 0;
  for (const b of bloky) {
    const l = dlzkaBloku(b);
    if (n > 0 && k + l > limit) break;
    k += l; n++;
  }
  return Math.max(3, Math.min(n, bloky.length - 2));
}

const PATA = () => 'Vytvorené na arling.sk/vzory-zmluv/ dňa ' + new Date().toLocaleDateString('sk-SK')
  + '. Vzor, nie právne poradenstvo: pred podpisom si ho prečítajte a upravte podľa svojej situácie.';

function prekresli() {
  d = precitajFormular();
  uloz('vzory:formular:' + vybrany, d);
  postavZalozky();
  const bloky = dok.fn(d);
  const odomk = odomknute(vybrany);
  const ukazane = odomk ? bloky : bloky.slice(0, pocetVolnych(bloky));
  const zamok = odomk ? '' : '<div class="zamok">'
    + '<p><b>Zvyšok zmluvy je platený.</b> Vidíte prvé dve strany. Celý dokument vo Worde, s vašimi údajmi a na úpravu, stojí <b>6,90 €</b> za túto zmluvu alebo <b>14,90 €</b> za všetkých päť vzorov.</p>'
    + '<p><a class="btn btn-solid" href="#hero" id="zamok-kupa">Odomknúť túto zmluvu za 6,90 €</a> <a class="btn btn-line" href="#hero" id="zamok-balik">Všetkých päť za 14,90 €</a></p>'
    + '</div>';
  nahlad.innerHTML = '<div class="papier' + (odomk ? '' : ' zamknuty') + '">' + html(ukazane)
    + (odomk ? '<p class="pata">' + PATA() + '</p>' : '') + zamok + '</div>';
  const zk = $('zamok-kupa');
  if (zk) zk.addEventListener('click', (e) => { e.preventDefault(); kup(vybrany, 'zamok'); });
  const zb = $('zamok-balik');
  if (zb) zb.addEventListener('click', (e) => { e.preventDefault(); kup('balik', 'zamok'); });

  poznamka.innerHTML = odomk
    ? '<b>Odomknuté:</b> celá zmluva, na stiahnutie vo Worde. Formulár môžete ďalej upravovať, dokument sa prepíše.'
    : '<b>Náhľad zadarmo:</b> prvé dve strany celé, bez rozmazania. <span class="cena-poznamka">Celý dokument: 6,90 €</span>, všetkých päť vzorov 14,90 €.';

  stiahnutDocx.hidden = !odomk;
  kupaDokument.hidden = odomk;
  stiahnutVsetko.hidden = !maBalik();
  ukazChyby();
  ukazOpory();
  ukazCenu();
  oznamPouzitie();
}

function postavZalozky() {
  zalozky.textContent = '';
  for (const x of DOKUMENTY) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'zalozka' + (x.id === vybrany ? ' aktivna' : '') + (odomknute(x.id) ? ' odomknuta' : ' zamknuta');
    b.textContent = x.nazov;
    b.title = x.popis;
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', x.id === vybrany ? 'true' : 'false');
    b.addEventListener('click', () => prepni(x.id));
    zalozky.appendChild(b);
  }
}
/* Adresa nesie vybraný vzor, aby sa dal poslať odkaz priamo na jednu zmluvu
 * (a aby si ho stránka pamätala pri obnovení). Dotaz zo Stripe sa tým zahodí,
 * to je zámer: session_id v adrese už nemá čo robiť. */
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

/* Cenový box v úvode: po nákupe už žiadne tlačidlo Kúpiť, ale jasná veta
 * a odkaz späť k zmluve. */
function ukazCenu() {
  const vsetko = maBalik();
  kupaBalik.hidden = vsetko;
  const zaco = document.querySelector('.cena .zaco');
  if (zaco) zaco.hidden = vsetko;
  let blok = $('cena-zaplatene');
  if (!blok) {
    blok = document.createElement('div');
    blok.id = 'cena-zaplatene';
    blok.className = 'cena-zaplatene';
    blok.hidden = true;
    blok.innerHTML = '<p><b>Zaplatené.</b> Odomknuté v tomto prehliadači. Formulár môžete ďalej upravovať a zmluvu si stiahnuť znova, koľkokrát chcete.</p>'
      + '<a class="btn btn-solid" href="#dielna">Prejsť k zmluve</a>';
    kupaBalik.insertAdjacentElement('afterend', blok);
  }
  const nieco = nakupy().length > 0;
  blok.hidden = !nieco;
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
  if (!odomknute(vybrany)) return;
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
  if (!maBalik()) return;
  const subory = DOKUMENTY.map((x) => {
    const udaje = x.id === vybrany ? d : (nacitaj('vzory:formular:' + x.id) || prazdnyFormular(x.zdroj));
    return [subor(x), docx(x.fn(udaje), PATA())];
  });
  stiahni('vzory-zmluv-arling.zip', zip(subory), 'application/zip');
  track('vzory_stiahnute', { dokument: 'balik', pocet: subory.length, produkt: 'vzory' });
});

/* === Platba =========================================================== */

/* ?test=1 prepne tento prehliadač do Stripe test módu (nácvik, testovacia
 * karta 4242…, žiadne peniaze): tlačidlo použije data-link-test a návrat sa
 * prijme len v tom prehliadači, ktorý test spustil. */
function testRezim() {
  try {
    if (zUrl('test') === '1') sessionStorage.setItem('vzory:test', '1');
    return sessionStorage.getItem('vzory:test') === '1';
  } catch (e) { return false; }
}
function odkaz(co) {
  const el = co === 'balik' ? kupaBalik : document.querySelector('#odkazy-dokumenty [data-dokument="' + co + '"]');
  if (!el) return '';
  const u = (testRezim() ? el.dataset.linkTest : el.dataset.link) || '';
  return u.startsWith('https://') ? u : '';
}
function kup(co, odkial) {
  track('vzory_kupa_click', { dokument: co, cena: co === 'balik' ? CENA_BALIK : CENA_DOKUMENT, odkial: odkial || 'cena', produkt: 'vzory' });
  uloz(KLUC_KUPUJEM, co);
  const u = odkaz(co);
  if (!u) {
    stavPlatby.textContent = 'Platba sa práve zapína. Skúste to o chvíľu alebo napíšte na andrej@arling.sk.';
    stavPlatby.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  location.href = u;
}
kupaBalik.addEventListener('click', () => kup('balik', 'cena'));
kupaDokument.addEventListener('click', () => kup(vybrany, 'nahlad'));

let overovanie = null;
async function overPlatbu(sid, pokus) {
  stavPlatby.textContent = 'Overujem platbu…' + (pokus > 1 ? ' (' + pokus + ')' : '');
  let st = null, siet = false;
  try {
    const r = await fetch(API + '/v1/kontrola/status?session_id=' + encodeURIComponent(sid));
    if (r.ok) st = await r.json();
    else if (r.status >= 500 || r.status === 429) siet = true;
  } catch (e) { siet = true; }
  /* Suma pred zľavovým kódom; starší worker ju neposiela, vtedy platí amount_total. */
  const zaklad = st && typeof st.amount_subtotal === 'number' ? st.amount_subtotal : st && st.amount_total;
  if (st && st.paid && typeof zaklad === 'number' && zaklad >= CENA_DOKUMENT) {
    const chcel = nacitaj(KLUC_KUPUJEM);
    const co = zaklad >= CENA_BALIK ? 'balik' : (chcel && chcel !== 'balik' ? chcel : vybrany);
    zapisNakup(sid, co, st.livemode === false);
    zabudni(KLUC_CAKAJUCA);
    stavPlatby.innerHTML = '<b>Zaplatené, ďakujeme.</b> ' + (co === 'balik' ? 'Všetkých päť vzorov je' : 'Zmluva je')
      + ' odomknutých v tomto prehliadači; doklad vám poslal Stripe e-mailom.'
      + (st.livemode === false ? ' (Testovací režim: platba bola v Stripe test móde, žiadne peniaze neprišli.)' : '');
    track('vzory_zaplatene', { dokument: co, test: st.livemode === false, produkt: 'vzory' });
    if (co !== 'balik' && co !== vybrany) prepni(co);
    else prekresli();
    $('dielna').scrollIntoView({ behavior: 'smooth', block: 'start' });
    return true;
  }
  if (st && st.paid) {
    zabudni(KLUC_CAKAJUCA);
    stavPlatby.textContent = 'Platba prišla, ale na inú sumu. Napíšte na andrej@arling.sk, vyriešime to ručne.';
    return false;
  }
  if (st && !st.paid && !siet) siet = true; /* Stripe odpovedal, že ešte nie je zaplatené: takmer vždy je to zdržanie */
  uloz(KLUC_CAKAJUCA, { session: sid, test: testRezim(), t: Date.now() });
  stavPlatby.innerHTML = 'Platbu sa zatiaľ nepodarilo potvrdiť. Skúšame znova; ak ste zaplatili, zmluva sa odomkne, len čo Stripe odpovie. Ak to trvá dlhšie než pár minút, napíšte na andrej@arling.sk s číslom objednávky z e-mailu od Stripe. '
    + '<button type="button" class="btn btn-line" id="over-znova">Overiť platbu znova</button>';
  const btn = $('over-znova');
  if (btn) btn.addEventListener('click', () => { clearTimeout(overovanie); overPlatbu(sid, 1); });
  if (pokus < 8) overovanie = setTimeout(() => overPlatbu(sid, pokus + 1), Math.min(30000, 3000 * pokus));
  return false;
}
function poNavrate() {
  let sid = zUrl('session_id');
  const test = testRezim(); /* ?test=1 môže stáť vedľa session_id */
  if (!sid) {
    const c = nacitaj(KLUC_CAKAJUCA);
    if (c && c.session && !odomknute(vybrany)) {
      sid = c.session;
      if (c.test) { try { sessionStorage.setItem('vzory:test', '1'); } catch (e) { /* nič */ } }
    }
  }
  if (!sid) return;
  if (sid.startsWith('cs_test_') && !testRezim() && !test) {
    stavPlatby.textContent = 'Toto je testovacia platba zo Stripe test módu. Odomkne zmluvu len v prehliadači, ktorý test spustil cez ?test=1.';
    return;
  }
  overPlatbu(sid, 1);
}

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
poNavrate();
sledujCenuVidenu();
track('vzory_nahlad', { dokument: vybrany, produkt: 'vzory' });
