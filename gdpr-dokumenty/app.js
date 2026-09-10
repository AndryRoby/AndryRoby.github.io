/* GDPR dokumenty: formulár, náhľad, platba a sťahovanie.
 *
 * Všetko sa deje v prehliadači: údaje z formulára ostávajú v localStorage
 * (gdpr:formular), dokumenty sa skladajú tu (dokumenty-sk.js) a DOCX sa
 * zapisuje tu (docx.js). Na server neodchádza nič okrem overenia platby:
 * po návrate zo Stripe (?session_id=) sa worker spýta, či je session
 * zaplatená a na akú sumu (GET /v1/kontrola/status, vracia paid a
 * amount_total, žiadne osobné údaje). Odomknutie sa uloží ako
 * gdpr:zaplatene, aby sa dokumenty dali stiahnuť aj neskôr z tohto
 * prehliadača.
 *
 * Udalosti do Umami (ak beží): gdpr_nahlad, gdpr_kupa_click,
 * gdpr_zaplatene, gdpr_stiahnute, gdpr_zadarmo.
 * Slovenska aj ceska stranka pouzivaju tento jeden skript; lisia sa
 * sablonami (dokumenty-sk.js, dokumenty-cs.js) a textami v T.
 */
import { docx, html, zip } from './docx.js';

/* Jazyk stránky určuje šablóny (sk alebo cs) a texty tejto obrazovky. */
const LANG = document.documentElement.lang === 'cs' ? 'cs' : 'sk';
const { DOKUMENTY, zoznamDokumentov, NASTROJE, CINNOSTI, LEHOTY_PREDVOLENE } = await import(LANG === 'cs' ? './dokumenty-cs.js' : './dokumenty-sk.js');
const T = {
  sk: {
    lehoty: { objednavky: 'Objednávky a doklady', kontakt: 'Dopyty a kontaktný formulár', newsletter: 'Newsletter', ucty: 'Používateľské účty', uchadzaci: 'Uchádzači o zamestnanie', zamestnanci: 'Zamestnanci', kamery: 'Kamerový záznam' },
    pata: (d) => 'Vytvorené na arling.sk/gdpr-dokumenty/ dňa ' + d + '. Vzor vyplnený údajmi firmy, nie právne poradenstvo: pred použitím ho prečítajte a upravte podľa toho, čo firma skutočne robí.',
    zamok: '<b>Tento dokument je v platenom balíku.</b> Zadarmo sú len Zásady ochrany osobných údajov (prvá záložka). Po zaplatení 39 € sa všetkých ' + '{n}' + ' dokumentov odomkne v tomto prehliadači a stiahnu sa ako DOCX.',
    zamokTlacidlo: 'Kúpiť balík za 39 €',
    poznamka: (n) => '<b>Zadarmo:</b> Zásady ochrany osobných údajov (prvá záložka, celé). <span class="cena-poznamka">V balíku za 39 €:</span> ďalších ' + (n - 1) + ' dokumentov, v náhľade vidíte len ich začiatok.',
    poznamkaOdomknute: (n) => '<b>Odomknuté:</b> všetkých ' + n + ' dokumentov, celé, na stiahnutie nižšie.',
    zapina: 'Platba sa práve zapína. Skúste to o chvíľu alebo napíšte na andrej@arling.sk.',
    overujem: 'Overujem platbu…',
    zaplatene: '<b>Zaplatené, ďakujeme.</b> Dokumenty sú odomknuté v tomto prehliadači; doklad vám poslal Stripe e-mailom.',
    inaSuma: 'Platba prišla, ale na inú sumu. Napíšte na andrej@arling.sk, vyriešime to ručne.',
    nepotvrdene: 'Platbu sa nepodarilo potvrdiť. Ak ste zaplatili, počkajte minútu a obnovte stránku, alebo napíšte na andrej@arling.sk.',
    siet: 'Overenie platby zlyhalo (sieť). Obnovte stránku; ak to pretrvá, napíšte na andrej@arling.sk.',
    vymazat: 'Vymazať vyplnené údaje z tohto prehliadača?',
    testCudzi: 'Toto je testovacia platba zo Stripe test módu. Odomkne dokumenty len v prehliadači, ktorý test spustil cez ?test=1.',
    testPoznamka: '(Testovací režim: platba bola v Stripe test móde, žiadne peniaze neprišli.)',
    docxPripona: ' (DOCX)',
    locale: 'sk-SK',
  },
  cs: {
    lehoty: { objednavky: 'Objednávky a doklady', kontakt: 'Dotazy a kontaktní formulář', newsletter: 'Newsletter', ucty: 'Uživatelské účty', uchadzaci: 'Uchazeči o zaměstnání', zamestnanci: 'Zaměstnanci', kamery: 'Kamerový záznam' },
    pata: (d) => 'Vytvořeno na arling.sk/gdpr-dokumenty/cs/ dne ' + d + '. Vzor vyplněný údaji firmy, ne právní poradenství: před použitím si ho přečtěte a upravte podle toho, co firma skutečně dělá.',
    zamok: '<b>Tento dokument je v placeném balíčku.</b> Zdarma jsou jen Zásady ochrany osobních údajů (první záložka). Po zaplacení 39 € se všech ' + '{n}' + ' dokumentů odemkne v tomto prohlížeči a stáhnou se jako DOCX.',
    zamokTlacidlo: 'Koupit balíček za 39 €',
    poznamka: (n) => '<b>Zdarma:</b> Zásady ochrany osobních údajů (první záložka, celé). <span class="cena-poznamka">V balíčku za 39 €:</span> dalších ' + (n - 1) + ' dokumentů, v náhledu vidíte jen jejich začátek.',
    poznamkaOdomknute: (n) => '<b>Odemčeno:</b> všech ' + n + ' dokumentů, celé, ke stažení níže.',
    zapina: 'Platba se právě zapíná. Zkuste to za chvíli nebo napište na andrej@arling.sk.',
    overujem: 'Ověřuji platbu…',
    zaplatene: '<b>Zaplaceno, děkujeme.</b> Dokumenty jsou odemčené v tomto prohlížeči; doklad vám poslal Stripe e-mailem.',
    inaSuma: 'Platba přišla, ale na jinou částku. Napište na andrej@arling.sk, vyřešíme to ručně.',
    nepotvrdene: 'Platbu se nepodařilo potvrdit. Pokud jste zaplatili, počkejte minutu a obnovte stránku, nebo napište na andrej@arling.sk.',
    siet: 'Ověření platby selhalo (síť). Obnovte stránku; pokud to přetrvává, napište na andrej@arling.sk.',
    vymazat: 'Smazat vyplněné údaje z tohoto prohlížeče?',
    testCudzi: 'Toto je testovací platba ze Stripe test módu. Odemkne dokumenty jen v prohlížeči, který test spustil přes ?test=1.',
    testPoznamka: '(Testovací režim: platba byla ve Stripe test módu, žádné peníze nepřišly.)',
    docxPripona: ' (DOCX)',
    locale: 'cs-CZ',
  },
}[LANG];
const KLUC_FORM = 'gdpr:formular:' + LANG;

const API = 'https://arling-asistent.arling.workers.dev';
const CENA_CENTY = 3900;
const $ = (id) => document.getElementById(id);
const form = $('formular');
const nahlad = $('nahlad');
const zalozky = $('zalozky');
const stavPlatby = $('stav-platby');
const kupaBtn = $('kupa');
const stiahnutBlok = $('stiahnut');
function track(name, data) { try { if (window.umami && typeof window.umami.track === 'function') window.umami.track(name, data); } catch (e) { /* nič */ } }
function nacitaj(k) { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function uloz(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* bez úložiska to beží ďalej */ } }

/* ── Formulár: zoznamy sa stavajú z katalógu, aby stránka a šablóny sedeli ── */
function postavZoznamy() {
  const c = $('cinnosti');
  for (const x of CINNOSTI) {
    const l = document.createElement('label');
    l.innerHTML = '<input type="checkbox" name="cinnosti.' + x.id + '"> ' + x.nazov;
    c.appendChild(l);
  }
  const n = $('nastroje');
  const skupiny = new Map();
  for (const x of NASTROJE) { if (!skupiny.has(x.kategoria)) skupiny.set(x.kategoria, []); skupiny.get(x.kategoria).push(x); }
  for (const [kat, zoznam] of skupiny) {
    const h = document.createElement('p'); h.className = 'skupina'; h.textContent = kat.charAt(0).toUpperCase() + kat.slice(1);
    n.appendChild(h);
    for (const x of zoznam) {
      const l = document.createElement('label');
      l.innerHTML = '<input type="checkbox" name="nastroje" value="' + x.id + '"> ' + x.nazov;
      n.appendChild(l);
    }
  }
  const le = $('lehoty');
  const popisy = T.lehoty;
  for (const k of Object.keys(LEHOTY_PREDVOLENE)) {
    const l = document.createElement('label'); l.className = 'pole';
    l.innerHTML = '<span>' + popisy[k] + '</span><input type="text" name="lehoty.' + k + '" placeholder="' + LEHOTY_PREDVOLENE[k].replace(/"/g, '') + '">';
    le.appendChild(l);
  }
}

function precitajFormular() {
  const d = { firma: {}, zodpovednaOsoba: {}, cinnosti: {}, nastroje: [], cookies: {}, lehoty: {}, prenosMimoEU: 'nie', datum: '', nastrojeIne: '' };
  for (const el of form.elements) {
    if (!el.name) continue;
    const [a, b] = el.name.split('.');
    if (el.name === 'nastroje') { if (el.checked) d.nastroje.push(el.value); continue; }
    if (el.type === 'checkbox') { if (b) d[a][b] = el.checked; else d[a] = el.checked; continue; }
    if (el.type === 'radio') { if (el.checked) d[a] = el.value; continue; }
    const v = el.value.trim();
    if (b) { if (v) d[a][b] = v; } else d[a] = v;
  }
  d.zodpovednaOsoba.ma = !!d.zodpovednaOsoba.ma;
  return d;
}
function naplnFormular(d) {
  if (!d) return;
  for (const el of form.elements) {
    if (!el.name) continue;
    const [a, b] = el.name.split('.');
    if (el.name === 'nastroje') { el.checked = (d.nastroje || []).includes(el.value); continue; }
    const v = b ? (d[a] || {})[b] : d[a];
    if (el.type === 'checkbox') el.checked = !!v;
    else if (el.type === 'radio') el.checked = el.value === v;
    else if (v !== undefined) el.value = v;
  }
}

/* ── Náhľad ────────────────────────────────────────────────────────────── */
let vybrany = 'd1';
let d = null;
const PATA = () => T.pata(new Date().toLocaleDateString(T.locale));

function odomknute() {
  const z = nacitaj('gdpr:zaplatene');
  return !!(z && z.session);
}
function prekresli() {
  d = precitajFormular();
  uloz(KLUC_FORM, d);
  const zoznam = zoznamDokumentov(d);
  if (!zoznam.some((x) => x.id === vybrany)) vybrany = 'd1';
  zalozky.textContent = '';
  for (const x of zoznam) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'zalozka' + (x.id === vybrany ? ' aktivna' : '') + (x.zadarmo ? ' zadarmo' : (odomknute() ? '' : ' zamknuta'));
    b.textContent = x.nazov;
    b.title = x.popis;
    b.addEventListener('click', () => { vybrany = x.id; prekresli(); track('gdpr_nahlad', { dokument: x.id }); });
    zalozky.appendChild(b);
  }
  const dok = zoznam.find((x) => x.id === vybrany);
  const bloky = dok.fn(d);
  const odomk = odomknute() || dok.zadarmo;
  const ukazane = odomk ? bloky : bloky.slice(0, Math.min(bloky.length, 7));
  nahlad.innerHTML = '<div class="papier' + (odomk ? '' : ' zamknuty') + '">' + html(ukazane) + (odomk ? '<p class="pata">' + PATA() + '</p>' : '<div class="zamok"><p>' + T.zamok.replace('{n}', String(zoznam.length)) + '</p><a class="btn btn-solid" href="#hero" id="zamok-kupa">' + T.zamokTlacidlo + '</a></div>') + '</div>';
  const zk = $('zamok-kupa');
  if (zk) zk.addEventListener('click', (e) => { const u = odkazNaKupu(); if (u) { e.preventDefault(); track('gdpr_kupa_click', { cena: CENA_CENTY, odkial: 'zamok' }); location.href = u; } });
  // sťahovanie
  const zadarmoBtn = $('stiahnut-zadarmo');
  zadarmoBtn.hidden = !dok.zadarmo;
  stiahnutBlok.hidden = !odomknute();
  if (odomknute()) postavStiahnutie(zoznam);
  $('pocet-dokumentov').textContent = zoznam.length;
  const pozn = $('nahlad-poznamka');
  if (pozn) pozn.innerHTML = odomknute() ? T.poznamkaOdomknute(zoznam.length) : T.poznamka(zoznam.length);
}
function stiahni(nazov, bytes, typ) {
  const blob = new Blob([bytes], { type: typ || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nazov;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}
const bezDiakritiky = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
function subor(x) { return bezDiakritiky(x.nazov).slice(0, 60) + '.docx'; }
function postavStiahnutie(zoznam) {
  const ul = $('zoznam-stiahnutie');
  ul.textContent = '';
  for (const x of zoznam) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn btn-line';
    b.textContent = x.nazov + T.docxPripona;
    b.addEventListener('click', () => { stiahni(subor(x), docx(x.fn(d), PATA())); track('gdpr_stiahnute', { dokument: x.id }); });
    li.appendChild(b);
    ul.appendChild(li);
  }
}
$('stiahnut-zadarmo').addEventListener('click', () => {
  const x = DOKUMENTY[0];
  stiahni(subor(x), docx(x.fn(d), PATA()));
  track('gdpr_zadarmo', {});
});
$('stiahnut-vsetko').addEventListener('click', () => {
  const zoznam = zoznamDokumentov(d);
  const subory = zoznam.map((x) => [subor(x), docx(x.fn(d), PATA())]);
  stiahni('gdpr-dokumenty-' + bezDiakritiky((d.firma && d.firma.nazov) || 'firma') + '.zip', zip(subory), 'application/zip');
  track('gdpr_stiahnute', { dokument: 'zip', pocet: subory.length });
});

/* ── Platba ────────────────────────────────────────────────────────────── */
/* ?test=1 switches this browser to Stripe test mode (rehearsal, test card
 * 4242…, no money): the button uses data-link-test and the return is
 * accepted only in the same browser session that started the test. */
function testRezim() {
  try {
    if (new URL(location.href).searchParams.get('test') === '1') sessionStorage.setItem('gdpr:test', '1');
    return sessionStorage.getItem('gdpr:test') === '1';
  } catch (e) { return false; }
}
function odkazNaKupu() {
  const u = (testRezim() ? kupaBtn.dataset.linkTest : kupaBtn.dataset.link) || '';
  return u && u.startsWith('https://') ? u : '';
}
kupaBtn.addEventListener('click', () => {
  const u = odkazNaKupu();
  track('gdpr_kupa_click', { cena: CENA_CENTY });
  if (!u) { stavPlatby.textContent = T.zapina; return; }
  location.href = u;
});
async function poNavrate() {
  let sid = '';
  try { sid = new URL(location.href).searchParams.get('session_id') || ''; } catch (e) { /* nič */ }
  if (!sid) return;
  history.replaceState(null, '', location.pathname);
  if (sid.startsWith('cs_test_') && !testRezim()) { stavPlatby.textContent = T.testCudzi; return; }
  stavPlatby.textContent = T.overujem;
  try {
    const r = await fetch(API + '/v1/kontrola/status?session_id=' + encodeURIComponent(sid));
    const st = r.ok ? await r.json() : null;
    if (st && st.paid && typeof st.amount_total === 'number' && st.amount_total >= CENA_CENTY) {
      uloz('gdpr:zaplatene', { session: sid, t: Date.now(), test: st.livemode === false });
      stavPlatby.innerHTML = T.zaplatene + (st.livemode === false ? ' ' + T.testPoznamka : '');
      track('gdpr_zaplatene', {});
      prekresli();
      $('stiahnut').scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    stavPlatby.textContent = st && st.paid ? T.inaSuma : T.nepotvrdene;
  } catch (e) {
    stavPlatby.textContent = T.siet;
  }
}

/* ── Štart ─────────────────────────────────────────────────────────────── */
postavZoznamy();
naplnFormular(nacitaj(KLUC_FORM));
if (!form.elements.datum.value) form.elements.datum.value = new Date().toISOString().slice(0, 10);
form.addEventListener('input', prekresli);
form.addEventListener('change', prekresli);
form.addEventListener('submit', (e) => e.preventDefault());
$('zmazat').addEventListener('click', () => {
  if (!window.confirm(T.vymazat)) return;
  try { localStorage.removeItem(KLUC_FORM); } catch (e) { /* nič */ }
  form.reset();
  form.elements.datum.value = new Date().toISOString().slice(0, 10);
  prekresli();
});
prekresli();
poNavrate();
