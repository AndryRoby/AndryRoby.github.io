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
 */
import { DOKUMENTY, zoznamDokumentov, NASTROJE, CINNOSTI, LEHOTY_PREDVOLENE } from './dokumenty-sk.js';
import { docx, html, zip } from './docx.js';

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
  const popisy = { objednavky: 'Objednávky a doklady', kontakt: 'Dopyty a kontaktný formulár', newsletter: 'Newsletter', ucty: 'Používateľské účty', uchadzaci: 'Uchádzači o zamestnanie', zamestnanci: 'Zamestnanci', kamery: 'Kamerový záznam' };
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
const PATA = () => 'Vytvorené na arling.sk/gdpr-dokumenty/ dňa ' + new Date().toLocaleDateString('sk-SK') + '. Vzor vyplnený údajmi firmy, nie právne poradenstvo: pred použitím ho prečítajte a upravte podľa toho, čo firma skutočne robí.';

function odomknute() {
  const z = nacitaj('gdpr:zaplatene');
  return !!(z && z.session);
}
function prekresli() {
  d = precitajFormular();
  uloz('gdpr:formular', d);
  const zoznam = zoznamDokumentov(d);
  if (!zoznam.some((x) => x.id === vybrany)) vybrany = 'd1';
  zalozky.textContent = '';
  for (const x of zoznam) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'zalozka' + (x.id === vybrany ? ' aktivna' : '') + (x.zadarmo ? ' zadarmo' : '');
    b.textContent = x.nazov;
    b.title = x.popis;
    b.addEventListener('click', () => { vybrany = x.id; prekresli(); track('gdpr_nahlad', { dokument: x.id }); });
    zalozky.appendChild(b);
  }
  const dok = zoznam.find((x) => x.id === vybrany);
  const bloky = dok.fn(d);
  const odomk = odomknute() || dok.zadarmo;
  const ukazane = odomk ? bloky : bloky.slice(0, Math.min(bloky.length, 7));
  nahlad.innerHTML = '<div class="papier' + (odomk ? '' : ' zamknuty') + '">' + html(ukazane) + (odomk ? '<p class="pata">' + PATA() + '</p>' : '<div class="zamok"><p><b>Zvyšok dokumentu je v balíku.</b> Po zaplatení sa všetky dokumenty odomknú v tomto prehliadači a stiahnu sa ako DOCX.</p></div>') + '</div>';
  // sťahovanie
  const zadarmoBtn = $('stiahnut-zadarmo');
  zadarmoBtn.hidden = !dok.zadarmo;
  stiahnutBlok.hidden = !odomknute();
  if (odomknute()) postavStiahnutie(zoznam);
  $('pocet-dokumentov').textContent = zoznam.length;
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
    b.textContent = x.nazov + ' (DOCX)';
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
function odkazNaKupu() {
  const u = kupaBtn.dataset.link || '';
  return u && u.startsWith('https://') ? u : '';
}
kupaBtn.addEventListener('click', () => {
  const u = odkazNaKupu();
  track('gdpr_kupa_click', { cena: CENA_CENTY });
  if (!u) { stavPlatby.textContent = 'Platba sa práve zapína. Skúste to o chvíľu alebo napíšte na andrej@arling.sk.'; return; }
  location.href = u;
});
async function poNavrate() {
  let sid = '';
  try { sid = new URL(location.href).searchParams.get('session_id') || ''; } catch (e) { /* nič */ }
  if (!sid) return;
  history.replaceState(null, '', location.pathname);
  stavPlatby.textContent = 'Overujem platbu…';
  try {
    const r = await fetch(API + '/v1/kontrola/status?session_id=' + encodeURIComponent(sid));
    const st = r.ok ? await r.json() : null;
    if (st && st.paid && typeof st.amount_total === 'number' && st.amount_total >= CENA_CENTY) {
      uloz('gdpr:zaplatene', { session: sid, t: Date.now() });
      stavPlatby.innerHTML = '<b>Zaplatené, ďakujeme.</b> Dokumenty sú odomknuté v tomto prehliadači; doklad vám poslal Stripe e-mailom.';
      track('gdpr_zaplatene', {});
      prekresli();
      $('stiahnut').scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    stavPlatby.textContent = st && st.paid ? 'Platba prišla, ale na inú sumu. Napíšte na andrej@arling.sk, vyriešime to ručne.' : 'Platbu sa nepodarilo potvrdiť. Ak ste zaplatili, počkajte minútu a obnovte stránku, alebo napíšte na andrej@arling.sk.';
  } catch (e) {
    stavPlatby.textContent = 'Overenie platby zlyhalo (sieť). Obnovte stránku; ak to pretrvá, napíšte na andrej@arling.sk.';
  }
}

/* ── Štart ─────────────────────────────────────────────────────────────── */
postavZoznamy();
naplnFormular(nacitaj('gdpr:formular'));
if (!form.elements.datum.value) form.elements.datum.value = new Date().toISOString().slice(0, 10);
form.addEventListener('input', prekresli);
form.addEventListener('change', prekresli);
form.addEventListener('submit', (e) => e.preventDefault());
$('zmazat').addEventListener('click', () => {
  if (!window.confirm('Vymazať vyplnené údaje z tohto prehliadača?')) return;
  try { localStorage.removeItem('gdpr:formular'); } catch (e) { /* nič */ }
  form.reset();
  form.elements.datum.value = new Date().toISOString().slice(0, 10);
  prekresli();
});
prekresli();
poNavrate();
