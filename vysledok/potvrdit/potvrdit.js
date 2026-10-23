/*
 * Stránka /vysledok/potvrdit/#k=<id>.<token>&j=<jazyk> (výsledok kontroly e-mailom, súhlas vysledok-v1, relácia 205, SPEC 5.4).
 * Odložený modul v hlave pred Umami (načítavač vkladá odložené skripty v poradí dokumentu s async=false, Umami je až na konci
 * tela): kľúč ako prvú vec odstráni z adresy (history.replaceState) a drží ho len v pamäti, aby nebol v histórii, na snímke
 * ani v meraní (Umami má navyše data-exclude-search a data-exclude-hash). Nič nepošle sama: skenery pošty, ktoré odkaz otvoria, nič nespustia; až tlačidlo
 * pošle POST /v1/vysledok/potvrd {k}. Naraz beží jeden dopyt, s časovým limitom 15 s. Texty len cez textContent.
 * Umami odber_vysledok_potvrdeny {nastroj} po odoslaní, nikdy kľúč ani adresa; nič pri ?test.
 * O3a (brána 205 O3, O4): vo fragmente ostane len jazyk odkazu pri en, de, cs (#j=), takže obnovená stránka bez kľúča povie
 * v jazyku odkazu, aby človek otvoril odkaz z e-mailu znova (stav bez_kluca), nie „odkaz neplatí“; po odoslaní nadpis
 * „Výsledok je na ceste“.
 */
import {
  CASOVY_LIMIT_MS, HOTOVE_STAVY, KONECNE_STAVY, TEXTY_POTVRDENIE, adresaApi, adresaNastroja, citajFragment, fragmentJazyka, maKluc,
  platnyKluc, stavPotvrdenia, textStavu,
} from '../vysledok-jadro.mjs?v=1';

export const deps = {
  fetch: (url, init) => fetch(url, init),
  setTimeout: (f, ms) => setTimeout(f, ms),
  clearTimeout: (t) => clearTimeout(t),
  timeoutMs: CASOVY_LIMIT_MS,
  track: (name, data, loc) => {
    try { if (new URLSearchParams(loc.search).has('test')) return; window.umami?.track(name, data); } catch { /* meranie nič nerozbije */ }
  },
};

/** Spustí stránku potvrdenia nad dokumentom. Vráti stav na testy. */
export function spusti(doc, loc, hist) {
  const f = citajFragment(loc.hash), sKlucom = maKluc(loc.hash);
  if (loc.hash) { try { hist.replaceState(null, '', loc.pathname + loc.search + fragmentJazyka(f.j)); } catch { /* starý prehliadač */ } }
  const koren = doc.querySelector('[data-vysledok-potvrdit]');
  if (!koren) return { kluc: false };
  const t = TEXTY_POTVRDENIE[f.j];
  doc.documentElement.lang = f.j;
  doc.title = t.titul;
  let nadpis = null; // h1 s data-t="nadpis": po odoslaní dostane text „Výsledok je na ceste“ (O4)
  for (const e of koren.querySelectorAll('[data-t]')) {
    const k = e.getAttribute('data-t');
    if (typeof t[k] === 'string') e.textContent = t[k];
    if (k === 'nadpis') nadpis = e;
  }
  const tlacidlo = koren.querySelector('[data-vys-tlacidlo]');
  const ok = koren.querySelector('[data-vys-stav]'), zle = koren.querySelector('[data-vys-chyba]');
  const spat = koren.querySelector('[data-vys-spat]'), nastroje = koren.querySelector('[data-vys-nastroje]');
  const text = koren.querySelector('[data-vys-text]');
  for (const a of nastroje.querySelectorAll('a[data-nastroj]')) {
    const n = a.getAttribute('data-nastroj');
    a.textContent = t.nastroje[n];
    a.setAttribute('href', adresaNastroja(n, f.j));
  }
  const ukaz = (stav, nastroj) => {
    const sprava = textStavu(t, stav), dobre = stav === 'odoslane' || stav === 'uz_odoslane' || stav === 'odosiela';
    ok.hidden = !dobre; zle.hidden = dobre;
    (dobre ? ok : zle).textContent = sprava;
    if (KONECNE_STAVY.includes(stav)) { tlacidlo.hidden = true; text.hidden = true; }
    if (HOTOVE_STAVY.includes(stav) && nadpis) nadpis.textContent = t.nadpisHotovo;
    const url = dobre && nastroj ? adresaNastroja(nastroj, f.j) : null;
    spat.hidden = !url;
    if (url) { const a = spat.querySelector('a'); a.textContent = t.spat[nastroj]; a.setAttribute('href', url); }
    nastroje.hidden = stav !== 'neplatny';
    koren.setAttribute('data-stav', stav);
    (dobre ? ok : zle).focus();
  };
  // Zlý alebo skrátený kľúč: neplatny (so zoznamom nástrojov); žiadny kľúč (obnovená stránka): bez_kluca.
  if (!platnyKluc(f.k)) { ukaz(sKlucom ? 'neplatny' : 'bez_kluca', null); return { kluc: false }; }
  const kluc = f.k;
  tlacidlo.hidden = false;
  koren.setAttribute('data-stav', 'caka');
  let bezi = false;
  tlacidlo.addEventListener('click', async () => {
    if (bezi) return;
    bezi = true;
    tlacidlo.disabled = true;
    tlacidlo.textContent = t.odosiela;
    const ovladac = typeof AbortController !== 'undefined' ? new AbortController() : null;
    let casovac = null;
    const limit = new Promise((_, nie) => { casovac = deps.setTimeout(() => { try { ovladac?.abort(); } catch { /* nič */ } nie(new Error('timeout')); }, deps.timeoutMs); });
    let vysledok;
    try {
      const dopyt = Promise.resolve().then(() => deps.fetch(adresaApi(loc, '/v1/vysledok/potvrd'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ k: kluc }),
        credentials: 'omit', cache: 'no-store', signal: ovladac ? ovladac.signal : undefined,
      }));
      dopyt.catch(() => {});
      const r = await Promise.race([dopyt, limit]);
      let data = null;
      try { data = await Promise.race([r.json(), limit]); } catch { data = null; }
      vysledok = stavPotvrdenia(r.status, data);
    } catch {
      vysledok = { stav: 'siet', nastroj: null };
    } finally {
      deps.clearTimeout(casovac);
    }
    bezi = false;
    tlacidlo.disabled = false;
    tlacidlo.textContent = t.tlacidlo;
    ukaz(vysledok.stav, vysledok.nastroj);
    if (vysledok.stav === 'odoslane') deps.track('odber_vysledok_potvrdeny', { nastroj: vysledok.nastroj || 'neznamy' }, loc);
  });
  return { kluc: true };
}

if (typeof document !== 'undefined' && typeof location !== 'undefined') spusti(document, location, history);
