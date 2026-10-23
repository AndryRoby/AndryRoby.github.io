/*
 * Blok „Poslať si výsledok e-mailom“ pod výsledkom troch bezplatných nástrojov (kontrola e-shopu, kontrola e-faktúry,
 * SEPA pain.001 Doctor), súhlas vysledok-v1, relácia 205 (ops/druhy-ucet/205/SPEC.md časť 5, archív textov
 * ops/druhy-ucet/205/pravo/SUHLAS-VYSLEDOK.md). ES modul bez závislostí; nástroje ho volajú dynamickým importom:
 *
 *   import('/vysledok/vysledok-email.js?v=1').then((m) => m.ukaz(miesto, {nastroj, jazyk, vysledok, poOdoslani})).catch(() => {})
 *   import('/vysledok/vysledok-email.js?v=1').then((m) => m.skry(miesto)).catch(() => {})
 *
 * ukaz vždy vykreslí čerstvý blok do prázdneho elementu miesto (nahradí predošlý obsah) a vráti true; pri neznámom nástroji,
 * jazyku alebo zlom zhrnutí (SPEC časť 3) nič neukáže a vráti false (zlyhanie zatvára). CSS pripojí raz, už pri
 * načítaní modulu; kým nepríde, blok drží miesto neviditeľný (K1-1).
 * AGENTS.md bod 12: každé ukaz a skry zvýši poradové číslo a zruší bežiaci dopyt (AbortController); odpoveď, ktorá nepatrí
 * poslednému zobrazeniu, sa zahodí bez zmeny stránky, bez merania a bez poOdoslani. Počas odosielania je pole len na čítanie
 * a tlačidlo vypnuté, takže odpoveď vždy patrí k adrese v poli. Texty len cez textContent, nikdy innerHTML.
 * Umami (nikdy adresa, kľúč ani obsah výsledku; nič, keď adresa stránky má parameter test): vysledok_email_videny,
 * odber_vysledok, odber_vysledok_chyba {nastroj, dovod}.
 */
import {
  CASOVY_LIMIT_MS, TEXTY, adresaApi, adresaZasad, chybaAdresy, dovodChyby, normalizujEmail, platnyJazyk, spravcaPre,
  stavOdoslania, teloPoziadavky, uvodPre, zhrnutie,
} from './vysledok-jadro.mjs?v=1';

export const VERZIA_CSS = '1';
const testovaciRezim = () => {
  try { return typeof location !== 'undefined' && new URLSearchParams(location.search).has('test'); } catch { return false; }
};
// Závislosti, ktoré testy nahradia (sieť, časovače, meranie, adresa API).
export const deps = {
  fetch: (url, init) => fetch(url, init),
  setTimeout: (f, ms) => setTimeout(f, ms),
  clearTimeout: (t) => clearTimeout(t),
  timeoutMs: CASOVY_LIMIT_MS,
  // Poistka odkrytia bloku, keď CSS nepríde (3 s). Vlastný časovač, nie setTimeout vyššie: ten patrí len odosielaniu.
  // unref: v Node (testy) nedrží proces nažive; v prehliadači unref nie je.
  casovacCss: (f, ms) => { const t = setTimeout(f, ms); if (t && typeof t.unref === 'function') t.unref(); return t; },
  endpoint: () => adresaApi(typeof location !== 'undefined' ? location : null, '/v1/vysledok'),
  track: (name, data) => {
    if (testovaciRezim()) return;
    try { window.umami?.track(name, data); } catch { /* meranie nikdy nerozbije blok */ }
  },
};

let poradie = 0;
const miesta = new WeakMap(); // miesto -> {seq, ovladac}

function zastav(miesto) {
  const s = miesta.get(miesto);
  if (s && s.ovladac) { try { s.ovladac.abort(); } catch { /* nič */ } }
}

/** Pripojí CSS bloku raz (aj pri dvoch kópiách modulu) a vráti jeho link (existujúci alebo nový). Po load alebo error
 *  dostane data-vysledok-css="hotovo". Volá ho načítanie modulu (koniec súboru) aj ukaz. */
function pripojCss(doc) {
  const stary = doc.querySelector('link[data-vysledok-css]');
  if (stary) return stary;
  const l = doc.createElement('link');
  l.rel = 'stylesheet';
  l.href = new URL('./vysledok-email.css?v=' + VERZIA_CSS, import.meta.url).href;
  l.setAttribute('data-vysledok-css', '');
  const hotovo = () => l.setAttribute('data-vysledok-css', 'hotovo');
  l.addEventListener('load', hotovo, { once: true });
  l.addEventListener('error', hotovo, { once: true });
  (doc.head || doc.documentElement).appendChild(l);
  return l;
}

/** Je CSS bloku už načítané (alebo definitívne zlyhalo)? Kým nie, blok čaká neviditeľný na svojom mieste (V2 V3, K1-1). */
const cssHotove = (l) => !l || Boolean(l.sheet) || l.getAttribute('data-vysledok-css') === 'hotovo';

function el(doc, tag, cls, text) {
  const e = doc.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = String(text);
  return e;
}

/** Skryje blok a zahodí bežiace odoslanie (nová kontrola, vymazanie vstupu, chyba). */
export function skry(miesto) {
  if (!miesto) return;
  zastav(miesto);
  miesta.set(miesto, { seq: ++poradie, ovladac: null });
  miesto.replaceChildren();
  miesto.hidden = true;
}

/** Vykreslí blok pod skutočným výsledkom. Vráti true, ak sa blok ukázal. */
export function ukaz(miesto, { nastroj, jazyk, vysledok, poOdoslani } = {}) {
  if (!miesto) return false;
  skry(miesto);
  const z = zhrnutie(nastroj, vysledok);
  if (!platnyJazyk(nastroj, jazyk) || !z) return false;
  const doc = miesto.ownerDocument || document;
  const css = pripojCss(doc);
  const moje = miesta.get(miesto).seq;
  const aktualne = () => miesta.get(miesto)?.seq === moje;
  const t = TEXTY[jazyk], id = 'vys-email-' + moje;

  const sekcia = el(doc, 'section', 'vys-email');
  sekcia.setAttribute('aria-labelledby', id + '-nadpis');
  sekcia.setAttribute('data-vysledok-email', nastroj);
  const uvod = el(doc, 'div', 'vys-uvod');
  const h = el(doc, 'h3', 'vys-nadpis', t.nadpis); h.id = id + '-nadpis';
  // Úvodná veta podľa zhrnutia: pri výsledku bez nálezov bez „postupu opravy“ a „zoznamu nálezov“ (O8).
  const text = el(doc, 'p', 'vys-text', uvodPre(t, nastroj, z));
  const oddelenie = el(doc, 'p', 'vys-oddelenie', t.oddelenie);

  const form = el(doc, 'form', 'vys-form'); form.noValidate = true;
  const label = el(doc, 'label', 'vys-label', t.pole); label.htmlFor = id;
  const pole = el(doc, 'input', 'vys-pole');
  Object.assign(pole, { id, name: 'email', type: 'email', autocomplete: 'email', inputMode: 'email', spellcheck: false, required: true, maxLength: 254 });
  pole.setAttribute('aria-describedby', id + '-suhlas');
  const chyba = el(doc, 'p', 'vys-chyba'); chyba.id = id + '-chyba'; chyba.setAttribute('role', 'alert'); chyba.hidden = true;
  const suhlas = el(doc, 'p', 'vys-suhlas', t.suhlas); suhlas.id = id + '-suhlas';
  const tlacidlo = el(doc, 'button', 'btn btn-line vys-tlacidlo', t.tlacidlo); tlacidlo.type = 'submit';
  const spravca = el(doc, 'p', 'vys-spravca', spravcaPre(t, nastroj) + ' ' + t.zasadyPred);
  const odkaz = el(doc, 'a', null, t.zasady); odkaz.href = adresaZasad(jazyk);
  spravca.append(odkaz, t.zasadyPo);
  const pasca = el(doc, 'div', 'vys-pasca'); pasca.setAttribute('aria-hidden', 'true'); pasca.hidden = true;
  const pl = el(doc, 'label', null, 'Website'); pl.htmlFor = id + '-web';
  const pi = el(doc, 'input');
  Object.assign(pi, { id: id + '-web', name: 'website', type: 'text', tabIndex: -1, autocomplete: 'off' });
  pasca.append(pl, pi);
  form.append(label, pole, chyba, suhlas, tlacidlo, spravca, pasca);
  uvod.append(h, text, oddelenie, form);

  const hotovo = el(doc, 'div', 'vys-hotovo'); hotovo.setAttribute('role', 'status'); hotovo.hidden = true;
  const hh = el(doc, 'h3', 'vys-nadpis', t.hotovoNadpis); hh.tabIndex = -1;
  const [pred, po] = t.hotovoText.split('{adresa}');
  const ht = el(doc, 'p', 'vys-text'); const adresaEl = el(doc, 'b', 'vys-adresa');
  ht.append(pred, adresaEl, po);
  const hd = el(doc, 'p', 'vys-drobne', t.hotovoDrobne);
  const zmenit = el(doc, 'button', 'vys-zmenit', t.zmenit); zmenit.type = 'button';
  hotovo.append(hh, ht, hd, zmenit);
  sekcia.append(uvod, hotovo);

  const ukazChybu = (stav) => {
    chyba.textContent = t.chyby[stav] || t.chyby.server;
    chyba.hidden = false;
    pole.setAttribute('aria-invalid', 'true');
    pole.setAttribute('aria-describedby', id + '-chyba ' + id + '-suhlas');
    deps.track('odber_vysledok_chyba', { nastroj, dovod: dovodChyby(stav) });
  };
  const zrusChybu = () => {
    chyba.hidden = true; chyba.textContent = '';
    pole.removeAttribute('aria-invalid');
    pole.setAttribute('aria-describedby', id + '-suhlas');
  };
  let bezi = false;
  const zamkni = (ano) => {
    bezi = ano; pole.readOnly = ano; tlacidlo.disabled = ano;
    tlacidlo.textContent = ano ? t.odosiela : t.tlacidlo;
  };
  pole.addEventListener('input', () => { if (!chyba.hidden) zrusChybu(); });
  zmenit.addEventListener('click', () => {
    if (!aktualne()) return;
    hotovo.hidden = true; uvod.hidden = false;
    pole.focus();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (bezi || !aktualne()) return;
    zrusChybu();
    const adresa = normalizujEmail(pole.value);
    // Preklep: veta zla; adresa s tvarom e-mailu, ale so znakmi, ktoré mailer neprijme: veta tvar s hranicou (O7, R73).
    if (!adresa) { ukazChybu(chybaAdresy(pole.value) || 'zla'); pole.focus(); return; }
    const ovladac = typeof AbortController !== 'undefined' ? new AbortController() : null;
    miesta.set(miesto, { seq: moje, ovladac });
    zamkni(true);
    let casovac = null, vyprsalo = false;
    const limit = new Promise((_, zle) => {
      casovac = deps.setTimeout(() => { vyprsalo = true; try { ovladac?.abort(); } catch { /* nič */ } zle(new Error('timeout')); }, deps.timeoutMs);
    });
    let stav;
    try {
      const telo = teloPoziadavky({ email: adresa, nastroj, jazyk, zhrnutie: z, hp: String(pi.value || '') });
      const dopyt = Promise.resolve().then(() => deps.fetch(deps.endpoint(), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(telo),
        credentials: 'omit', cache: 'no-store', signal: ovladac ? ovladac.signal : undefined,
      }));
      dopyt.catch(() => {}); // neskorá chyba po vypršaní limitu nesmie skončiť ako neodchytená
      const r = await Promise.race([dopyt, limit]);
      let data = null;
      try { data = await Promise.race([r.json(), limit]); } catch { data = null; }
      stav = stavOdoslania(r.status, data);
    } catch {
      stav = vyprsalo ? 'cas' : 'siet';
    } finally {
      deps.clearTimeout(casovac);
    }
    if (!aktualne()) return; // odpoveď na staršie zobrazenie bloku: zahodiť, nič neprepísať
    miesta.set(miesto, { seq: moje, ovladac: null });
    zamkni(false);
    if (stav !== 'ok') { ukazChybu(stav); return; } // adresa ostáva v poli (R78)
    adresaEl.textContent = adresa;
    uvod.hidden = true; hotovo.hidden = false;
    hh.focus();
    deps.track('odber_vysledok', { nastroj, jazyk });
    if (typeof poOdoslani === 'function') { try { poOdoslani(adresa); } catch { /* chyba nástroja nerozbije blok */ } }
  });

  // Prvé zobrazenie bez CSS by blok vykreslilo nesformátovaný a po príchode CSS preskladalo (V2 V3, bod 9 kontroly
  // vzhľadu). Sekcia preto čaká na load alebo error linku (najviac 3 s) NEVIDITEĽNÁ, ale na svojom mieste: visibility
  // hidden drží výšku, takže obsah pod blokom (nálezy e-faktúry, box 149 €, limity) pri príchode CSS neposkočí o celú
  // výšku bloku, ako pri display none (K1-1). Vlastnosť cez CSSOM z JS: CSP style-src 'self' ju nezakazuje (atribút
  // style v HTML by zakázala). Odkryje sa len vtedy, keď je toto zobrazenie stále posledné.
  if (!cssHotove(css)) {
    sekcia.style.visibility = 'hidden';
    const odkry = () => { if (aktualne()) sekcia.style.visibility = ''; };
    css.addEventListener('load', odkry, { once: true });
    css.addEventListener('error', odkry, { once: true });
    deps.casovacCss(odkry, 3000);
  }
  miesto.replaceChildren(sekcia);
  miesto.hidden = false;
  deps.track('vysledok_email_videny', { nastroj, jazyk });
  return true;
}

// CSS bloku sa začne načítavať už pri načítaní modulu, nie až pod výsledkom (K1-1): e-faktúra modul načíta vopred
// (app.js prijmiText), takže CSS býva hotové skôr, než sa blok ukáže. Chyba tu nesmie zhodiť import (nástroje ho
// ticho ignorujú a blok by sa neukázal); ukaz si link pripojí sám.
if (typeof document !== 'undefined' && document) {
  try { pripojCss(document); } catch { /* ukaz pripojí CSS pri prvom zobrazení */ }
}
