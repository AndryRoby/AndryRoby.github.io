// Odber upozornení na novú verziu FAQ k e-faktúre (ops/efaktura/faq-straz, bod 3 v top-10.md).
// Používa existujúcu službu /subscribe/api/subscribe na homelabe, bez jej zmeny:
//   prihlásenie      source "efaktura-faq"
//   potvrdenie       source "faq-ok-<podpis>"   (podpis je v odkaze z potvrdzovacieho e-mailu)
//   odhlásenie       source "faq-off-<podpis>"  (odkaz v každom e-maile)
// Podpis overuje skript na homelabe (faq_odber.py); táto stránka ho len prenesie.
// Žiadne inline skripty (CSP), meranie cez Umami len ak je načítané, nikdy neblokuje formulár.

export const ENDPOINT = 'https://homelab.tailbf8f27.ts.net/subscribe/api/subscribe';
export const ZDROJ = 'efaktura-faq';
const EMAIL_RE = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;
const TOKEN_RE = /^[0-9a-f]{32}$/;

export function platnyEmail(adresa) {
  const a = String(adresa || '').trim();
  return a.length > 0 && a.length <= 254 && EMAIL_RE.test(a);
}

export function platnyToken(token) {
  return TOKEN_RE.test(String(token || ''));
}

export function telo(email, zdroj, jazyk = 'sk') {
  return { email: String(email).trim().toLowerCase(), source: zdroj, lang: jazyk, hp: '' };
}

// Z fragmentu #e=...&t=... urobí {email, token} alebo null, keď odkaz nie je celý.
// Adresa a podpis sú zámerne vo fragmente, nie v ?query: fragment prehliadač neposiela na server
// a Umami ho na týchto stránkach nezbiera (data-exclude-hash, data-exclude-search).
export function citajOdkaz(hash) {
  const q = new URLSearchParams(String(hash || '').replace(/^#/, ''));
  const email = (q.get('e') || '').trim().toLowerCase();
  const token = (q.get('t') || '').trim().toLowerCase();
  if (!platnyEmail(email) || !platnyToken(token)) return null;
  return { email, token };
}

// 200 = uložené, 409 = už existuje (rovnaký výsledok pre človeka). Všetko ostatné je chyba.
export async function posli(data, fetchImpl) {
  const f = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!f) return false;
  try {
    const res = await f(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.ok || res.status === 409;
  } catch {
    return false;
  }
}

function meraj(nazov, vlastnosti) {
  try {
    if (new URL(location.href).searchParams.get('test') === '1') return;
    if (window.umami && typeof window.umami.track === 'function') window.umami.track(nazov, vlastnosti || {});
  } catch {
    /* meranie nikdy neblokuje odber */
  }
}

function najdiVedla(form, selektor) {
  const obal = form.closest('[data-faq-obal]') || form.parentElement;
  return obal ? obal.querySelector(selektor) : null;
}

export function zapojFormular(form, fetchImpl) {
  const email = form.querySelector('input[type="email"]');
  const pasca = form.querySelector('input[name="website"]');
  const tlacidlo = form.querySelector('button[type="submit"]');
  const dakujeme = najdiVedla(form, '[data-faq-dakujeme]');
  const chyba = najdiVedla(form, '[data-faq-chyba]');
  const miesto = form.getAttribute('data-miesto') || 'stranka';
  if (!email || !tlacidlo) return;
  const text = tlacidlo.textContent;
  form.addEventListener('submit', async (udalost) => {
    udalost.preventDefault();
    if (pasca && pasca.value) return; // robot: ticho nič
    if (!platnyEmail(email.value)) {
      email.setCustomValidity('Zadajte e-mailovú adresu v tvare meno@firma.sk.');
      email.reportValidity();
      email.setCustomValidity('');
      return;
    }
    tlacidlo.disabled = true;
    tlacidlo.textContent = 'Ukladám…';
    if (chyba) chyba.hidden = true;
    const ok = await posli(telo(email.value, ZDROJ), fetchImpl);
    if (ok) {
      form.hidden = true;
      if (dakujeme) { dakujeme.hidden = false; dakujeme.focus(); }
      meraj('faq_odber_start', { miesto });
    } else {
      tlacidlo.disabled = false;
      tlacidlo.textContent = text;
      if (chyba) { chyba.hidden = false; chyba.focus(); }
      meraj('faq_odber_chyba', { miesto });
    }
  });
}

// Rámček na /efaktura/ sa ukáže až pod výsledkom kontroly (hero dostane data-vysledok="1").
function zapojRamcek() {
  const ramcek = document.querySelector('[data-faq-po-vysledku]');
  const hero = document.getElementById('hero');
  if (!ramcek || !hero) return;
  let ukazany = false;
  const stav = () => {
    const je = hero.getAttribute('data-vysledok') === '1';
    ramcek.hidden = !je;
    if (je && !ukazany) { ukazany = true; meraj('faq_ramcek_videny', { miesto: 'kontrola' }); }
  };
  stav();
  if ('MutationObserver' in window) new MutationObserver(stav).observe(hero, { attributes: true, attributeFilter: ['data-vysledok'] });
}

function zapojAkciu(koren, predpona, automaticky, udalost) {
  const odkaz = citajOdkaz(location.hash);
  const tlacidlo = koren.querySelector('[data-faq-akcia-tlacidlo]');
  const hotovo = koren.querySelector('[data-faq-hotovo]');
  const chyba = koren.querySelector('[data-faq-chyba]');
  const zlyOdkaz = koren.querySelector('[data-faq-zly-odkaz]');
  const caka = koren.querySelector('[data-faq-caka]');
  const adresa = koren.querySelector('[data-faq-adresa]');
  if (!odkaz) {
    if (tlacidlo) tlacidlo.hidden = true;
    if (caka) caka.hidden = true;
    if (zlyOdkaz) zlyOdkaz.hidden = false;
    return;
  }
  if (adresa) {
    adresa.querySelector('[data-faq-email]').textContent = odkaz.email;
    adresa.hidden = false;
  }
  let bezi = false;
  const spusti = async () => {
    if (bezi) return;
    bezi = true;
    if (tlacidlo) tlacidlo.disabled = true;
    if (chyba) chyba.hidden = true;
    const ok = await posli(telo(odkaz.email, predpona + odkaz.token));
    bezi = false;
    if (caka) caka.hidden = true;
    if (ok) {
      if (tlacidlo) tlacidlo.hidden = true;
      if (hotovo) { hotovo.hidden = false; hotovo.focus(); }
      meraj(udalost);
    } else {
      if (tlacidlo) { tlacidlo.disabled = false; tlacidlo.hidden = false; }
      if (chyba) { chyba.hidden = false; chyba.focus(); }
    }
  };
  if (tlacidlo) tlacidlo.addEventListener('click', spusti);
  if (automaticky) spusti();
}

function zapojHistoriu() {
  if (!document.querySelector('[data-faq-historia]')) return;
  meraj('faq_historia_zobrazena');
  document.querySelectorAll('details.faq-zmena').forEach((d) => {
    let merane = false;
    d.addEventListener('toggle', () => {
      if (d.open && !merane) {
        merane = true;
        meraj('faq_rozdiel_otvoreny', { verzia: d.getAttribute('data-verzia'), jednotka: d.getAttribute('data-jednotka') });
      }
    });
  });
  // Odkaz #v-2026-09-15 z e-mailu: otvorí zmeny tej verzie, aby človek hneď videl rozdiel.
  const ciel = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (ciel && ciel.classList.contains('faq-verzia')) {
    ciel.querySelectorAll('details.faq-zmena').forEach((d, i) => { if (i < 3) d.open = true; });
  }
}

function start() {
  document.querySelectorAll('form[data-faq-odber]').forEach((f) => zapojFormular(f));
  zapojRamcek();
  const potvrdit = document.querySelector('[data-faq-potvrdit]');
  if (potvrdit) zapojAkciu(potvrdit, 'faq-ok-', false, 'faq_odber_potvrdeny');
  const odhlasit = document.querySelector('[data-faq-odhlasit]');
  if (odhlasit) zapojAkciu(odhlasit, 'faq-off-', true, 'faq_odhlaseny');
  zapojHistoriu();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
}
