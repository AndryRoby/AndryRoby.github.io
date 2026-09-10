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
import * as ucet from '/style/ucet.js';

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
    nepotvrdene: 'Platbu sa zatiaľ nepodarilo potvrdiť. Skúšame znova; ak ste zaplatili, dokumenty sa odomknú, len čo Stripe odpovie. Ak to trvá dlhšie než pár minút, napíšte na andrej@arling.sk s číslom objednávky z e-mailu od Stripe.',
    overZnova: 'Overiť platbu znova',
    cenaZaplatene: 'Zaplatené.',
    cenaZaplatenePopis: 'Balík je odomknutý v tomto prehliadači. Formulár môžete ďalej upravovať, dokumenty sa prepíšu.',
    cenaKDokumentom: 'Prejsť k dokumentom',
    siet: 'Overenie platby zlyhalo (sieť). Obnovte stránku; ak to pretrvá, napíšte na andrej@arling.sk.',
    vymazat: 'Vymazať vyplnené údaje z tohto prehliadača?',
    testCudzi: 'Toto je testovacia platba zo Stripe test módu. Odomkne dokumenty len v prehliadači, ktorý test spustil cez ?test=1.',
    testPoznamka: '(Testovací režim: platba bola v Stripe test móde, žiadne peniaze neprišli.)',
    docxPripona: ' (DOCX)',
    locale: 'sk-SK',
    ucetOdosielam: 'Posielam kód…',
    ucetKodOdoslany: 'Kód sme poslali na e-mail, platí 15 minút.',
    ucetZlyEmail: 'Zadajte platný e-mail.',
    ucetLimit: 'Priveľa pokusov, skúste o hodinu.',
    ucetNedostupne: 'Odosielanie kódov sa ešte zapína, napíšte na andrej@arling.sk.',
    ucetChybaOdoslanie: 'Kód sa nepodarilo odoslať (sieť). Skúste znova alebo napíšte na andrej@arling.sk.',
    ucetBezKodu: 'Najprv si vyžiadajte kód.',
    ucetOverujem: 'Prihlasujem…',
    ucetZlyKod: (n) => 'Nesprávny kód, ešte ' + n + (n === 1 ? ' pokus.' : n < 5 ? ' pokusy.' : ' pokusov.'),
    ucetVycerpane: 'Kód vypršal alebo bol zadaný zle päťkrát, vyžiadajte nový.',
    ucetChybaPrihlasenie: 'Prihlásenie zlyhalo (sieť). Skúste znova.',
    ucetPrihlaseny: 'Prihlásený, kontrolujem vaše nákupy…',
    ucetOdomknute: '<b>Prihlásený, balík je odomknutý</b> podľa vášho nákupu.',
    ucetBezNakupu: 'Prihlásený, ale k tomuto e-mailu nevidíme nákup tohto balíka. Ak ste platili, napíšte na andrej@arling.sk.',
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
    nepotvrdene: 'Platbu se zatím nepodařilo potvrdit. Zkoušíme znovu; pokud jste zaplatili, dokumenty se odemknou, jakmile Stripe odpoví. Pokud to trvá déle než pár minut, napište na andrej@arling.sk s číslem objednávky z e-mailu od Stripe.',
    overZnova: 'Ověřit platbu znovu',
    cenaZaplatene: 'Zaplaceno.',
    cenaZaplatenePopis: 'Balíček je odemčený v tomto prohlížeči. Formulář můžete dál upravovat, dokumenty se přepíší.',
    cenaKDokumentom: 'Přejít k dokumentům',
    siet: 'Ověření platby selhalo (síť). Obnovte stránku; pokud to přetrvává, napište na andrej@arling.sk.',
    vymazat: 'Smazat vyplněné údaje z tohoto prohlížeče?',
    testCudzi: 'Toto je testovací platba ze Stripe test módu. Odemkne dokumenty jen v prohlížeči, který test spustil přes ?test=1.',
    testPoznamka: '(Testovací režim: platba byla ve Stripe test módu, žádné peníze nepřišly.)',
    docxPripona: ' (DOCX)',
    locale: 'cs-CZ',
    ucetOdosielam: 'Posílám kód…',
    ucetKodOdoslany: 'Kód jsme poslali na e-mail, platí 15 minut.',
    ucetZlyEmail: 'Zadejte platný e-mail.',
    ucetLimit: 'Příliš mnoho pokusů, zkuste to za hodinu.',
    ucetNedostupne: 'Odesílání kódů se ještě zapíná, napište na andrej@arling.sk.',
    ucetChybaOdoslanie: 'Kód se nepodařilo odeslat (síť). Zkuste to znovu nebo napište na andrej@arling.sk.',
    ucetBezKodu: 'Nejprve si vyžádejte kód.',
    ucetOverujem: 'Přihlašuji…',
    ucetZlyKod: (n) => 'Nesprávný kód, ještě ' + n + (n === 1 ? ' pokus.' : n < 5 ? ' pokusy.' : ' pokusů.'),
    ucetVycerpane: 'Kód vypršel nebo byl zadán špatně pětkrát, vyžádejte si nový.',
    ucetChybaPrihlasenie: 'Přihlášení selhalo (síť). Zkuste to znovu.',
    ucetPrihlaseny: 'Přihlášen, kontroluji vaše nákupy…',
    ucetOdomknute: '<b>Přihlášen, balíček je odemčený</b> podle vašeho nákupu.',
    ucetBezNakupu: 'Přihlášen, ale k tomuto e-mailu nevidíme nákup tohoto balíčku. Pokud jste platili, napište na andrej@arling.sk.',
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
const ucetEmail = $('ucet-email');
const ucetKod = $('ucet-kod');
const ucetPosliBtn = $('ucet-posli');
const ucetOverBtn = $('ucet-over');
const ucetStav = $('ucet-stav');
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
  ukazCenu();
}
/* The price box after a purchase: no more Buy button, a clear "paid" line
 * and a button that jumps to the downloads. Before a purchase: unchanged. */
function ukazCenu() {
  const je = odomknute();
  kupaBtn.hidden = je;
  const mam = document.querySelector('.cena .ucet-mam');
  if (mam) mam.hidden = je;
  let blok = $('cena-zaplatene');
  if (je && !blok) {
    blok = document.createElement('div');
    blok.id = 'cena-zaplatene';
    blok.className = 'cena-zaplatene';
    blok.innerHTML = '<p><b>' + T.cenaZaplatene + '</b> ' + T.cenaZaplatenePopis + '</p><a class="btn btn-solid" href="#stiahnut">' + T.cenaKDokumentom + '</a>';
    kupaBtn.insertAdjacentElement('afterend', blok);
    blok.querySelector('a').addEventListener('click', (e) => { e.preventDefault(); $('stiahnut').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  }
  if (blok) blok.hidden = !je;
  const zaco = document.querySelector('.cena .zaco');
  if (zaco) zaco.hidden = je;
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

/* ── Účet: „Mám kúpené (na inom zariadení)" ───────────────────────────────
 * Voliteľná cesta popri platbe v tomto prehliadači: zadá e-mail, dostane
 * 6-miestny kód, prihlási sa. Worker pri prihlásení sám dohľadá zaplatené
 * Stripe session na ten e-mail, takže tu stačí zavolať ja() a pozrieť sa,
 * či je medzi nákupmi GDPR balík. Bez účtu funguje stránka úplne ako doteraz;
 * chyby siete (worker ešte nie je nasadený) sa ukážu poctivo, nič nespadne. */
function ucetChybaKod(chyba) {
  const kod = chyba && chyba.data && chyba.data.error;
  if (kod === 'bad_email') return T.ucetZlyEmail;
  if (kod === 'rate_limited') return T.ucetLimit;
  if (kod === 'mail_unavailable') return T.ucetNedostupne;
  return T.ucetChybaOdoslanie;
}
function ucetChybaOver(chyba) {
  const d = chyba && chyba.data;
  const kod = d && d.error;
  if (kod === 'no_code') return T.ucetBezKodu;
  if (kod === 'rate_limited') return T.ucetLimit;
  if (kod === 'bad_code') return d.remaining ? T.ucetZlyKod(d.remaining) : T.ucetVycerpane;
  return T.ucetChybaPrihlasenie;
}
if (ucetPosliBtn) ucetPosliBtn.addEventListener('click', async () => {
  const mail = (ucetEmail.value || '').trim();
  if (!mail || !mail.includes('@')) { ucetStav.textContent = T.ucetZlyEmail; return; }
  ucetStav.textContent = T.ucetOdosielam;
  ucetPosliBtn.disabled = true;
  try {
    await ucet.posliKod(mail);
    ucetStav.textContent = T.ucetKodOdoslany;
  } catch (e) {
    ucetStav.textContent = ucetChybaKod(e);
  } finally {
    ucetPosliBtn.disabled = false;
  }
});
if (ucetOverBtn) ucetOverBtn.addEventListener('click', async () => {
  const mail = (ucetEmail.value || '').trim();
  const kod = (ucetKod.value || '').trim();
  if (!kod) { ucetStav.textContent = T.ucetBezKodu; return; }
  ucetStav.textContent = T.ucetOverujem;
  ucetOverBtn.disabled = true;
  try {
    await ucet.over(mail, kod);
    ucetStav.textContent = T.ucetPrihlaseny;
    try {
      const u = await ucet.ja();
      const nakup = ((u && u.nakupy) || []).find((x) => x && x.livemode && typeof x.produkt === 'string' && /gdpr/i.test(x.produkt));
      if (nakup) {
        uloz('gdpr:zaplatene', { session: nakup.session_id, t: Date.now(), ucet: true });
        prekresli();
        ucetStav.innerHTML = T.ucetOdomknute;
      } else {
        ucetStav.textContent = T.ucetBezNakupu;
      }
    } catch (e2) { /* ja() zlyhalo (sieť): ostávame prihlásení, len bez zoznamu nákupov */ }
  } catch (e) {
    ucetStav.textContent = ucetChybaOver(e);
  } finally {
    ucetOverBtn.disabled = false;
  }
});

/* After Stripe sends the customer back with ?session_id=, the worker is
 * asked whether that session is paid. The id is kept in localStorage
 * (gdpr:cakajuca) until the answer is a clear yes or a clear no, so a
 * dropped connection or a reload never loses a paid customer: the page
 * retries by itself and offers a button to try again. */
const CAKAJUCA = 'gdpr:cakajuca';
let overovanie = null;
async function overPlatbu(sid, test, pokus) {
  stavPlatby.textContent = T.overujem + (pokus > 1 ? ' (' + pokus + ')' : '');
  let st = null, siet = false;
  try {
    const r = await fetch(API + '/v1/kontrola/status?session_id=' + encodeURIComponent(sid));
    if (r.ok) st = await r.json();
    else if (r.status >= 500 || r.status === 429) siet = true;
  } catch (e) { siet = true; }
  if (st && st.paid && typeof st.amount_total === 'number' && st.amount_total >= CENA_CENTY) {
    uloz('gdpr:zaplatene', { session: sid, t: Date.now(), test: st.livemode === false });
    try { localStorage.removeItem(CAKAJUCA); } catch (e) { /* nič */ }
    stavPlatby.innerHTML = T.zaplatene + (st.livemode === false ? ' ' + T.testPoznamka : '');
    track('gdpr_zaplatene', { test: st.livemode === false });
    prekresli();
    $('stiahnut').scrollIntoView({ behavior: 'smooth', block: 'start' });
    return true;
  }
  if (st && st.paid) {
    // paid, but not this product: keep nothing, say so
    try { localStorage.removeItem(CAKAJUCA); } catch (e) { /* nič */ }
    stavPlatby.textContent = T.inaSuma;
    return false;
  }
  if (st && !st.paid && !siet) {
    // Stripe answered: not paid (yet). Payment links only redirect after a
    // successful payment, so this is almost always a delay; keep waiting.
    siet = true;
  }
  // Unclear (network, worker down, Stripe delay): keep the id and retry.
  uloz(CAKAJUCA, { session: sid, test: !!test, t: Date.now() });
  const dalsi = Math.min(30000, 3000 * pokus);
  stavPlatby.innerHTML = T.nepotvrdene + ' <button type="button" class="btn btn-line" id="over-znova">' + T.overZnova + '</button>';
  const btn = $('over-znova');
  if (btn) btn.addEventListener('click', () => { clearTimeout(overovanie); overPlatbu(sid, test, 1); });
  if (pokus < 8) overovanie = setTimeout(() => overPlatbu(sid, test, pokus + 1), dalsi);
  return false;
}
async function poNavrate() {
  let sid = '';
  try { sid = new URL(location.href).searchParams.get('session_id') || ''; } catch (e) { /* nič */ }
  const zUrl = !!sid; // true len pri skutočnom návrate zo Stripe, nie pri obnovenom čakaní z localStorage
  const test = testRezim(); // before the query is dropped: ?test=1 may sit next to session_id
  if (sid) history.replaceState(null, '', location.pathname);
  if (!sid) {
    const c = nacitaj(CAKAJUCA);
    if (c && c.session && !odomknute()) { sid = c.session; if (c.test) { try { sessionStorage.setItem('gdpr:test', '1'); } catch (e) { /* nič */ } } }
  }
  if (!sid) return;
  if (zUrl && ucet.prihlaseny()) {
    // priradí session k účtu nezávisle od miestneho odomknutia; chyby sa ignorujú
    try { ucet.priradSession(sid).catch(() => { /* nič */ }); } catch (e) { /* nič */ }
  }
  if (sid.startsWith('cs_test_') && !testRezim()) { stavPlatby.textContent = T.testCudzi; return; }
  overPlatbu(sid, testRezim(), 1);
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
