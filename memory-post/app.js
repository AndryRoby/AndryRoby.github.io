/* Memory Post: darcekove predplatne, ktore z jednej otazky tyzdenne spravi knihu.
 *
 * Co tato stranka robi so serverom, presne a uplne:
 *   1. po navrate zo Stripe sa spyta workera, ci je session zaplatena a na aku
 *      sumu (GET /v1/kontrola/status, vracia paid, amount_subtotal a livemode,
 *      ziadne osobne udaje) - to iste ako products/arling-sk/puzzle-post/app.js,
 *   2. ked kupujuci vyplni formular, poslie licencnej sluzbe meno prijemcu,
 *      jeho e-mail, den prvej otazky a jazyk (POST /licence/api/memory-post/recipient).
 * Nic ine. Meno kupujuceho ("od koho") sa na server NEPOSIELA: sluzi len na
 * vytlacenu kartu a ostava v tomto prehliadaci (sessionStorage).
 *
 * Zastupky odkazov: data-link a data-link-test v index.html su prazdne, kym ich
 * nedosadi ops/stripe/memory-post.mjs --zapis. Kym su prazdne, tlacidlo nikam
 * nevedie a povie to nahlas; nikdy sa nepresmeruje na nieco, co nie je odkaz Stripe.
 *
 * Udalosti do Umami (ak bezi): cena_videna, kupa_click, ukazka, zaplatene a
 * darcek_nastaveny. cena_videna a kupa_click maju spolocne meno s ostatnymi
 * produktmi kvoli reportu EUR na 100 navstev.
 */

const API = 'https://arling-asistent.arling.workers.dev';
const LICENCIE = 'https://homelab.tailbf8f27.ts.net/licence/api';

/* Centy pred zlavovym kodom. Musia sediet s ops/stripe/memory-post.mjs. */
const CENY = { yearly: 3900, monthly: 490 };
const NAJMENSIA = Math.min(CENY.yearly, CENY.monthly);

const CAKAJUCA = 'memory:cakajuca';
const ODKOHO = 'memory:od';

const T = {
  overujem: 'Checking the payment',
  zaplatene: '<b>Paid, thank you.</b> One thing left: tell us who the gift is for.',
  nepotvrdene: 'We have not been able to confirm the payment yet. We keep trying; if you paid, this line changes as soon as Stripe answers. If it takes longer than a few minutes, write to andrej@arling.sk with the order number from the Stripe e-mail.',
  overZnova: 'Check again',
  inaSuma: 'The payment went through, but not for an amount we recognise. Write to andrej@arling.sk and we will sort it out by hand.',
  zapina: 'This plan is still being switched on. Write to andrej@arling.sk and we will set the gift up for you by hand.',
  testChyba: 'Test mode is on, but this plan has no test link yet. Run ops/stripe/memory-post.mjs --test --zapis, or open this page without ?test=1.',
  testCudzi: 'This is a payment from Stripe test mode. No money was taken and no gift was set up.',
  testPoznamka: '(Test mode: no money was taken.)',
  ukladam: 'Saving',
  /* Musi byt jednoznacne, kedy otazka pride. Povodne „on its way“ znelo ako „teraz“
     a kupujuci cakal e-mail, ktory mal prist az vo zvoleny den (nahlasene 18. 9. 2026). */
  hotovo: 'Saved. Nothing arrives yet: the first question goes to {email} on {datum}, and then one every week. Print the card below and put it in an envelope.',
  hotovoNezaplatene: 'Saved. We have not seen the payment from Stripe yet, so nothing is sent until it lands. If it does not within an hour, write to andrej@arling.sk with the order number.',
  chybaMeno: 'Please write their first name; it goes on the cover of the book.',
  chybaMail: 'Please write their e-mail address. It is the only place the question is sent.',
  chybaDatum: 'Please choose the day the first question should arrive.',
  chybaSiet: 'We could not reach our server. Nothing is lost: try again in a minute, or write to andrej@arling.sk with the recipient name, e-mail and start date and we will set it up by hand.',
  chybaSluzba: 'Our server refused that. Write to andrej@arling.sk with the recipient name, e-mail and start date and we will set it up by hand.',
};

function $(id) { return document.getElementById(id); }
function track(name, data) { try { if (window.umami && typeof window.umami.track === 'function') window.umami.track(name, data); } catch (e) { /* nic */ } }
function nacitaj(k) { try { const s = sessionStorage.getItem(k); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function uloz(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* bez uloziska to bezi dalej */ } }
function zabudni(k) { try { sessionStorage.removeItem(k); } catch (e) { /* nic */ } }

/* ── Menu a podrobnosti ──────────────────────────────────────────────────
   Bolo to vlozene <script> priamo v stranke; tu je to preto, aby stranka
   nemala ani jeden vlozeny skript a CSP nepotrebovala ziadny sha256. */
(function menu() {
  const bar = document.querySelector('header .bar');
  const btn = bar && bar.querySelector('.menu-btn');
  if (bar && btn) {
    const prepni = (otvor) => {
      bar.setAttribute('data-menu', otvor ? 'otvorene' : 'zavrete');
      btn.setAttribute('aria-expanded', otvor ? 'true' : 'false');
    };
    btn.addEventListener('click', (e) => { e.stopPropagation(); prepni(bar.getAttribute('data-menu') !== 'otvorene'); });
    document.addEventListener('click', (e) => { if (bar.getAttribute('data-menu') === 'otvorene' && !bar.contains(e.target)) prepni(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && bar.getAttribute('data-menu') === 'otvorene') { prepni(false); btn.focus(); } });
  }
  if (window.innerWidth <= 760) for (const d of document.querySelectorAll('details[data-uzke]')) d.open = false;
})();

const stavPlatby = $('stav-platby');
const stavNastav = $('stav-nastav');

/* ── Test mod ─────────────────────────────────────────────────────────────
   ?test=1 prepne tento prehliadac na Stripe test mod (testovacia karta
   4242..., ziadne peniaze). Tlacidla potom idu na data-link-test a navrat
   s cs_test_... sa prijme len v tomto prehliadaci. */
function testRezim() {
  try {
    if (new URL(location.href).searchParams.get('test') === '1') sessionStorage.setItem('memory:test', '1');
    return sessionStorage.getItem('memory:test') === '1';
  } catch (e) { return false; }
}
function odkazNaKupu(btn) {
  const u = (testRezim() ? btn.dataset.linkTest : btn.dataset.link) || '';
  return u.startsWith('https://') ? u : '';
}

/* V HTML je od 25. 9. 2026 len prazdny skryty #test-odznak: skrytu vetu o test
   mode a karte 4242 citali nastroje AI ako fakt o stranke (audit
   ops/audit/2026-09-25-celkovy/00-AUDIT.md, akcia 5). Text sa vlozi az tu. */
const VETA_ODZNAKU = 'Both buttons lead to Stripe test mode. Use the card 4242 4242 4242 4242, any future date and any CVC. No money is taken and no real e-mail is promised to anybody.';
function naplnOdznak(el, veta) {
  const d = el.ownerDocument;
  if (!d || el.firstChild) return;
  const b = d.createElement('b');
  b.textContent = 'Test mode';
  el.append(b, veta);
}
(function ukazTestOdznak() {
  const el = $('test-odznak');
  if (!el) return;
  el.hidden = !testRezim();
  if (!el.hidden) naplnOdznak(el, VETA_ODZNAKU);
})();

for (const btn of document.querySelectorAll('[data-plan]')) {
  btn.addEventListener('click', () => {
    const plan = btn.dataset.plan;
    track('kupa_click', { plan: plan, cena: CENY[plan] || 0, produkt: 'memory-post' });
    const u = odkazNaKupu(btn);
    if (!u) {
      stavPlatby.textContent = testRezim() ? T.testChyba : T.zapina;
      stavPlatby.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    location.href = u;
  });
}
for (const a of document.querySelectorAll('a[data-ukazka]')) {
  a.addEventListener('click', () => track('ukazka', { kde: a.dataset.ukazka, produkt: 'memory-post' }));
}

(function sledujCenu() {
  const el = $('price');
  if (!el || typeof IntersectionObserver !== 'function') return;
  const io = new IntersectionObserver((z) => {
    for (const e of z) if (e.isIntersecting) { track('cena_videna', { produkt: 'memory-post' }); io.disconnect(); }
  }, { threshold: 0.25 });
  io.observe(el);
})();

/* ── Darcekova karta ─────────────────────────────────────────────────────
   Stranka si ju vysadzi sama a prehliadac ju vytlaci. Ziadne PDF, ziadny
   server, takze meno kupujuceho nikdy neopusti tento prehliadac. */
const MESIACE = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function datumSlovom(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(iso || '');
  return Number(m[3]) + ' ' + MESIACE[Number(m[2]) - 1] + ' ' + m[1];
}

/* Texty darcekovej kartičky vo vsetkych jazykoch, prevzate z ops/spomienky/texty.<lang>.json
   (kluce gift.* a dates.months). Karticka sa tlaci v jazyku, ktory kupujuci zvolil;
   dovtedy bola natvrdo po anglicky aj pri slovenskom darceku (nahlasene 18. 9. 2026). */
const KARTA_TEXTY = {
 "en": {
  "znacka": "Memory Post",
  "komu": "For",
  "od": "From",
  "kedy": "The first question arrives on",
  "text": "Every week one question about your life arrives by e-mail. Answer it in a few words or a few pages, whichever suits you. Every month the answers are typeset into a book with your name on the cover.",
  "bez": "There is nothing to install and no password to remember. The e-mail has one button.",
  "mesiace": [
   "January",
   "February",
   "March",
   "April",
   "May",
   "June",
   "July",
   "August",
   "September",
   "October",
   "November",
   "December"
  ]
 },
 "sk": {
  "znacka": "Memory Post",
  "komu": "Pre",
  "od": "Od",
  "kedy": "Prvá otázka príde",
  "text": "Každý týždeň príde e-mailom jedna otázka o vašom živote. Odpovedzte na pár slov alebo na pár strán, ako vám vyhovuje. Každý mesiac sa odpovede vysádžu do knihy s vaším menom na obálke.",
  "bez": "Nič sa neinštaluje a žiadne heslo si nemusíte pamätať. E-mail má jedno tlačidlo.",
  "mesiace": [
   "januára",
   "februára",
   "marca",
   "apríla",
   "mája",
   "júna",
   "júla",
   "augusta",
   "septembra",
   "októbra",
   "novembra",
   "decembra"
  ]
 },
 "cs": {
  "znacka": "Memory Post",
  "komu": "Pro",
  "od": "Od",
  "kedy": "První otázka přijde",
  "text": "Každý týden přijde e-mailem jedna otázka o vašem životě. Odpovězte pár slovy nebo na několik stránek, jak je vám libo. Každý měsíc se odpovědi vysázejí do knihy, která má na obálce vaše jméno.",
  "bez": "Není co instalovat a není si co pamatovat za heslo. V e-mailu je jedno tlačítko.",
  "mesiace": [
   "ledna",
   "února",
   "března",
   "dubna",
   "května",
   "června",
   "července",
   "srpna",
   "září",
   "října",
   "listopadu",
   "prosince"
  ]
 },
 "de": {
  "znacka": "Memory Post",
  "komu": "Für",
  "od": "Von",
  "kedy": "Die erste Frage kommt am",
  "text": "Jede Woche kommt eine Frage über Ihr Leben per E-Mail. Beantworten Sie sie in ein paar Worten oder auf ein paar Seiten, ganz wie es Ihnen passt. Jeden Monat werden die Antworten zu einem Buch gesetzt, mit Ihrem Namen auf dem Umschlag.",
  "bez": "Es gibt nichts zu installieren und kein Passwort zu merken. Die E-Mail hat einen einzigen Knopf.",
  "mesiace": [
   "Januar",
   "Februar",
   "März",
   "April",
   "Mai",
   "Juni",
   "Juli",
   "August",
   "September",
   "Oktober",
   "November",
   "Dezember"
  ]
 },
 "pl": {
  "znacka": "Memory Post",
  "komu": "Dla kogo",
  "od": "Od kogo",
  "kedy": "Pierwsze pytanie przyjdzie",
  "text": "Co tydzień e-mailem przychodzi jedno pytanie o własne życie. Odpowiedź może mieć kilka słów albo kilka stron, jak wygodniej. Co miesiąc odpowiedzi zostają złożone w książkę z imieniem na okładce.",
  "bez": "Nie trzeba niczego instalować ani pamiętać żadnego hasła. W e-mailu jest jeden przycisk.",
  "mesiace": [
   "stycznia",
   "lutego",
   "marca",
   "kwietnia",
   "maja",
   "czerwca",
   "lipca",
   "sierpnia",
   "września",
   "października",
   "listopada",
   "grudnia"
  ]
 }
};

function vyplnKartu({ meno, od, start, jazyk }) {
  const obal = $('karta-obal');
  if (!obal) return;
  const t = KARTA_TEXTY[jazyk] || KARTA_TEXTY.en;
  const den = (iso) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    if (!m) return String(iso || '');
    return Number(m[3]) + ' ' + t.mesiace[Number(m[2]) - 1] + ' ' + m[1];
  };
  const naplnit = (id, hodnota) => { const e = $(id); if (e) e.textContent = hodnota; };
  naplnit('karta-meno', meno || '');
  naplnit('karta-text', t.text);
  naplnit('karta-bez', t.bez);
  const znacka = obal.querySelector('.znacka'); if (znacka) znacka.textContent = t.znacka;
  const komu = obal.querySelector('.komu'); if (komu) komu.textContent = t.komu;
  $('karta-od').textContent = od ? t.od + ' ' + od : '';
  $('karta-od').hidden = !od;
  naplnit('karta-kedy', start ? t.kedy + ' ' + den(start) : '');
  obal.hidden = false;
}

(function tlac() {
  const b = $('tlacit');
  if (!b) return;
  b.addEventListener('click', () => { track('karta_tlac', { produkt: 'memory-post' }); window.print(); });
})();

/* ── Formular po zaplateni ───────────────────────────────────────────────── */

function ukazNastavenie(sid, jeTest) {
  const n = $('nastav');
  if (!n) return;
  n.hidden = false;
  const start = $('start');
  if (start && !start.value) {
    /* Predvoleny den: zajtra. Dnesok by znamenal, ze prva otazka odide este
       dnes, a kupujuci zvycajne chce, aby prisla az po tom, co daruje kartu. */
    const d = new Date(Date.now() + 86400000);
    const iso = d.toISOString().slice(0, 10);
    start.value = iso;
    start.min = new Date().toISOString().slice(0, 10);
  }
  const ulozit = $('ulozit');
  if (!ulozit || ulozit.dataset.hotovo === '1') return;
  ulozit.dataset.hotovo = '1';
  ulozit.addEventListener('click', () => posliPrijemcu(sid, jeTest));
  n.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function posliPrijemcu(sid, jeTest) {
  const meno = ($('meno').value || '').trim();
  const email = ($('email').value || '').trim();
  const start = ($('start').value || '').trim();
  const lang = ($('lang').value || 'en').trim();
  const od = ($('od').value || '').trim();
  if (!meno) { stavNastav.textContent = T.chybaMeno; $('meno').focus(); return; }
  if (!email || email.indexOf('@') < 1) { stavNastav.textContent = T.chybaMail; $('email').focus(); return; }
  if (!start) { stavNastav.textContent = T.chybaDatum; $('start').focus(); return; }
  uloz(ODKOHO, { od: od, meno: meno, start: start });
  stavNastav.textContent = T.ukladam;
  let r = null, siet = false;
  try {
    const odpoved = await fetch(LICENCIE + '/memory-post/recipient', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sid, name: meno, email: email, start: start, lang: lang }),
    });
    r = await odpoved.json().catch(() => null);
    if (!odpoved.ok && !r) siet = odpoved.status >= 500;
  } catch (e) { siet = true; }
  if (siet || !r) { stavNastav.textContent = T.chybaSiet; return; }
  if (!r.ok) { stavNastav.textContent = T.chybaSluzba; return; }
  zabudni(CAKAJUCA);
  const hotovoText = T.hotovo.replace('{email}', email).replace('{datum}', datumSlovom(start));
  stavNastav.textContent = (r.paid ? hotovoText : T.hotovoNezaplatene) + (jeTest ? ' ' + T.testPoznamka : '');
  track('darcek_nastaveny', { jazyk: lang, test: !!jeTest, produkt: 'memory-post' });
  vyplnKartu({ meno: meno, od: od, start: start, jazyk: lang });
  $('karta-obal').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── Po navrate zo Stripe ─────────────────────────────────────────────────
   Kym odpoved nie je jasne ano alebo jasne nie, session ostava v
   sessionStorage, aby sa pri vypadku siete alebo obnoveni stranky nestratila. */
let overovanie = null;
async function overPlatbu(sid, plan, pokus) {
  stavPlatby.textContent = T.overujem + (pokus > 1 ? ' (' + pokus + ')' : '');
  let st = null, siet = false;
  try {
    const r = await fetch(API + '/v1/kontrola/status?session_id=' + encodeURIComponent(sid));
    if (r.ok) st = await r.json();
    else if (r.status >= 500 || r.status === 429) siet = true;
  } catch (e) { siet = true; }
  const zaklad = st && typeof st.amount_subtotal === 'number' ? st.amount_subtotal : st && st.amount_total;
  if (st && st.paid) {
    const jeTest = st.livemode === false;
    const treba = CENY[plan] || NAJMENSIA;
    if (typeof zaklad === 'number' && zaklad >= treba) {
      stavPlatby.innerHTML = T.zaplatene + (jeTest ? ' ' + T.testPoznamka : '');
      track('zaplatene', { plan: plan || '', test: jeTest, produkt: 'memory-post' });
      ukazNastavenie(sid, jeTest);
      return true;
    }
    zabudni(CAKAJUCA);
    stavPlatby.textContent = T.inaSuma;
    return false;
  }
  if (st && !st.paid && !siet) siet = true; /* Checkout vracia spat az po platbe, je to oneskorenie */
  uloz(CAKAJUCA, { session: sid, plan: plan || '', t: Date.now() });
  stavPlatby.innerHTML = T.nepotvrdene + '<br><button type="button" class="btn btn-line" id="over-znova">' + T.overZnova + '</button>';
  const btn = $('over-znova');
  if (btn) btn.addEventListener('click', () => { clearTimeout(overovanie); overPlatbu(sid, plan, 1); });
  if (pokus < 8) overovanie = setTimeout(() => overPlatbu(sid, plan, pokus + 1), Math.min(30000, 3000 * pokus));
  return false;
}

function poNavrate() {
  let sid = '', plan = '';
  try {
    const q = new URL(location.href).searchParams;
    sid = q.get('session_id') || '';
    plan = q.get('plan') || '';
  } catch (e) { /* nic */ }
  if (!CENY[plan]) plan = '';
  testRezim(); /* pred zahodenim dotazu: ?test=1 moze stat vedla session_id */
  if (sid) history.replaceState(null, '', location.pathname + '#price');
  if (!sid) {
    const c = nacitaj(CAKAJUCA);
    if (c && c.session) { sid = c.session; plan = c.plan || ''; }
  }
  if (!sid) return;
  if (sid.startsWith('cs_test_') && !testRezim()) { stavPlatby.textContent = T.testCudzi; return; }
  overPlatbu(sid, plan, 1);
}

poNavrate();
