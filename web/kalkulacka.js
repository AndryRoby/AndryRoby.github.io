// Kalkulačka ceny webu a krátky dopyt na /web/ (linka web-cennik, cenník 4.1, 23. 11. 2026). ES modul; načíta ho web.js
// lenivo: keď je kalkulačka blízko, pri kotve #kalkulacka alebo #dopyt, pri ?ukazka= alebo ?b= a pri prvom dotyku výzvy.
// Sumy počíta len /web/cennik.js (globalThis.ArlingCennik) z ops/weby-na-mieru/cennik.json; adresa nesie len voľby
// (ops/weby-na-mieru/web-cennik/SPEC.md časť 2.4), nič sa neukladá v prehliadači a adresa stránky sa nemení (R33).
// Krátky dopyt ide tým istým koncovým bodom ako dotazník (ops/weby-na-mieru/v2/dotaznik-server/KONTRAKT.md). Kontaktnú
// adresu modul nemá v kóde: číta ju z atribútu data-adresa sekcie #kalkulacka, ktorý píše generátor z cennik.json
// (dopyt.adresa), takže je na jednom mieste.
// AGENTS.md bod 12: každý pokus má poradie a stará odpoveď neprepíše novší stav, dvojklik pošle jednu požiadavku, pri
// zlyhaní sa nič neoznačí ako odoslané a polia ostanú vyplnené, do stránky ide text len cez textContent, do mailto len cez
// encodeURIComponent. Čisté funkcie sú exportované; testuje ich ops/weby-na-mieru/web-cennik/testy/kalkulacka.test.mjs
// s podvrhnutým fetch a časom (na ostrý server sa pri testoch nič neposiela).

export const SERVER = 'https://api.arling.workers.dev/subscribe/api/dotaznik-web';
export const CAS_LIMIT_MS = 45000;
// server zahodí dopyt odoslaný skôr než 5 s od otvorenia (pasca na roboty); stránka radšej počká, než by klamala o čase
export const PASCA_MS = 5500;
export const ZNOVA_PO_LIMITE_MS = 60000;
export const MAX = { meno: 120, firma: 120, telefon: 40, poznamka: 600, email: 254 };
// dlhší mailto sa v niektorých poštových programoch neotvorí (dotaznik.js má 1 900 na počítači)
export const MAILTO_LIMIT = 1800;
const EMAIL_VZOR = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;
const CISLO_VZOR = /^D-\d{8}-[A-Z2-9]{4}$/;
const BALIKY = ['jednostrankovy', 'firemny', 'referencie', 'eshop'];
const WEBY = ['jednostrankovy', 'firemny', 'referencie'];

// Texty pre zákazníka; a = kontaktná adresa zo stránky.
export function texty(a) {
  return {
    email: 'Skontrolujte e-mail. Má tvar meno@firma.sk, bez medzier a bez diakritiky.',
    najviac: (n) => `Najviac ${n} znakov.`,
    poslat: 'Poslať dopyt',
    odosiela: 'Odosiela sa…',
    znova: 'Skúsiť znova',
    chyba: `Dopyt sa cez stránku nepodarilo odoslať. Pošlite ho e-mailom: tlačidlo Otvoriť e-mail ho pripraví, stačí ho odoslať. Ak sa e-mail neotvorí, skopírujte text a pošlite ho na ${a}.`,
    limit: `Práve prišlo priveľa dopytov naraz. O minútu ho skúste odoslať znova, alebo ho pošlite e-mailom. Ak sa e-mail neotvorí, skopírujte text a pošlite ho na ${a}.`,
    siet: `Spojenie sa prerušilo a nevieme, či dopyt prišiel. Skúste ho odoslať znova. Ak by k nám prišiel dvakrát, nič sa nedeje. Ak to nepôjde, pošlite ho e-mailom, a ak sa e-mail neotvorí, skopírujte text a pošlite ho na ${a}.`,
    poMailto: `Ak sa e-mail neotvoril, skopírujte text a pošlite ho na ${a}.`,
    skopirovane: `Text dopytu je skopírovaný. Vložte ho do e-mailu na ${a}.`,
    neskopirovane: 'Kopírovanie nevyšlo. Text je označený, skopírujte ho ručne.',
    rozpisSkopirovany: 'Rozpis je skopírovaný.',
    rozpisNeskopirovany: 'Kopírovanie nevyšlo. Rozpis je označený pod tlačidlom, skopírujte ho ručne.',
    adresaSkopirovana: `Adresa ${a} je skopírovaná.`,
    adresaNeskopirovana: `Kopírovanie nevyšlo. Adresa je ${a}.`,
    potvrdenie: (email) => `Potvrdenie sme poslali na ${email}. Ak ho nevidíte, pozrite sa aj do priečinka Spam alebo Reklamy.`,
    bezPotvrdenia: 'Potvrdenie e-mailom vám tentoraz nemusí prísť, dopyt však máme.',
    mailtoKratke: 'Text dopytu je v schránke, vložte ho sem.',
    predmet: 'Web na mieru: krátky dopyt',
  };
}

// Pevné medzery v texte, ktorý skript vkladá (generátor stránky ich dáva do HTML, cennik.js píše obyčajné medzery).
const JEDNOTKY = /(\d)\s+(€|%|stránok|stránky|stránku|stránka|prvok|prvky|príspevkov|fotiek|produktov|zákaziek|mesiace|mesačne|ročne|hodín|hodinu|dní|pracovných|pracovného|zmien|kategórií|kolá|znakov)/g;
export function pevne(t) {
  const predlozky = /(^|[\s(„])([aiouvkszAIOUVKSZ])[ \t\r\n]+/g;
  return String(t == null ? '' : t)
    .replace(predlozky, '$1$2\u00a0')
    .replace(predlozky, '$1$2\u00a0')
    .replace(/(\d) (?=\d{3}(?!\d))/g, '$1\u00a0')
    .replace(JEDNOTKY, '$1\u00a0$2');
}
export function eur(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0') + '\u00a0€';
}

// Dĺžka v znakoch Unicode ako na serveri (emoji má v JavaScripte dĺžku 2).
export function dlzka(s) { return Array.from(s || '').length; }

// Neviditeľné formátovacie znaky; \p{Cf} nie ako literál, starý prehliadač by na ňom zhodil celý modul (KONTRAKT.md 2).
let NEVIDITELNE = null;
try { NEVIDITELNE = new RegExp('\\p{Cf}', 'gu'); } catch (e) { NEVIDITELNE = null; }

// Riadiace znaky, ktoré server neprijme, a osamotené náhradné znaky (KONTRAKT.md 4.9); tabulátor a konce riadkov ostávajú.
export function bezRiadiacich(s) {
  return Array.from(String(s == null ? '' : s)).filter((z) => {
    const k = z.charCodeAt(0);
    if (z.length === 1 && k >= 0xD800 && k <= 0xDFFF) return false;
    return !(k <= 0x08 || k === 0x0B || k === 0x0C || (k >= 0x0E && k <= 0x1F) || (k >= 0x7F && k <= 0x9F));
  }).join('');
}
// Jednoriadkové pole pre server: bez riadiacich a neviditeľných znakov, „=?“ rozdelené, medzery zlúčené.
export function jednoriadok(s) {
  let x = bezRiadiacich(s);
  if (NEVIDITELNE) x = x.replace(NEVIDITELNE, '');
  return x.split('=?').join('= ?').replace(/[\s\u2028\u2029]+/g, ' ').trim();
}
export function viacriadkov(s) {
  let x = bezRiadiacich(s).replace(/\r\n?/g, '\n');
  if (NEVIDITELNE) x = x.replace(NEVIDITELNE, '');
  return x.trim();
}
// E-mail: orezať a doménu s diakritikou previesť na punycode; časť pred @ sa nemení.
export function upravEmail(s) {
  let x = String(s == null ? '' : s).trim();
  const i = x.lastIndexOf('@');
  if (i > 0) {
    const domena = x.slice(i + 1);
    if (/[^\x00-\x7F]/.test(domena) && !/[\s/\\?#@:]/.test(domena)) {
      try { x = x.slice(0, i + 1) + new URL('http://' + domena).hostname; } catch (e) { /* server ju odmietne kódom email */ }
    }
  }
  return x;
}
export function platnyEmail(s) { return typeof s === 'string' && dlzka(s) <= MAX.email && EMAIL_VZOR.test(s); }

// Polia dopytu z formulára (vstup prijať voľne, R73): očistené, ale nič sa potichu neskracuje.
export function pripravUdaje(surove) {
  const o = surove && typeof surove === 'object' ? surove : {};
  const txt = (k) => (typeof o[k] === 'string' ? o[k] : '');
  return {
    meno: jednoriadok(txt('meno')),
    firma: jednoriadok(txt('firma')),
    email: upravEmail(bezRiadiacich(txt('email'))),
    telefon: jednoriadok(txt('telefon')),
    poznamka: viacriadkov(txt('poznamka')),
    hp: txt('hp'),
  };
}
// Kontrola pred odoslaním: zoznam chýb pri poliach (R69), prázdny zoznam = môže sa posielať.
export function kontrola(u, T) {
  const t = T || texty('');
  const chyby = [];
  if (!platnyEmail(u.email)) chyby.push({ pole: 'email', sprava: t.email });
  for (const k of ['meno', 'firma', 'telefon', 'poznamka']) {
    if (dlzka(u[k]) > MAX[k]) chyby.push({ pole: k, sprava: t.najviac(MAX[k]) });
  }
  return chyby;
}
// Telo požiadavky presne podľa KONTRAKT.md časť 2; text a zdroj skladá len cennik.js (SPEC 2.4).
export function telo(C, u, volby, search, t) {
  return {
    email: u.email,
    text: C.textDopytu({ meno: u.meno, firma: u.firma, email: u.email, telefon: u.telefon, poznamka: u.poznamka }, volby),
    nazov: u.firma,
    meno: u.meno,
    telefon: u.telefon,
    zdroj: C.zdroj(search, volby),
    lang: 'sk',
    hp: u.hp,
    t: Math.max(0, Math.round(Number(t) || 0)),
  };
}
// Spracovanie odpovede servera (KONTRAKT.md časť 3). Úspech len pri HTTP 200, ok === true a čísle D-RRRRMMDD-XXXX (R56).
// znova: 'hned' (Skúsiť znova hneď), 'po60' (až po 60 s), 'nie' (opakovanie by dopadlo rovnako, ostáva záloha).
export function vyhodnot(stavHttp, data, T) {
  const t = T || texty('');
  const d = data && typeof data === 'object' ? data : {};
  if (stavHttp === 200 && d.ok === true && typeof d.id === 'string' && CISLO_VZOR.test(d.id)) {
    const potvrdenie = d.potvrdenie === true;
    return { druh: 'uspech', id: d.id, potvrdenie, meranie: potvrdenie ? 'ok' : 'potvrdenie_nie' };
  }
  const zaloha = (veta, znova, meranie) => ({ druh: 'zaloha', veta, znova, meranie });
  if (!stavHttp) return zaloha('siet', 'hned', 'siet');
  if (stavHttp === 200) return zaloha('chyba', 'hned', d.ok === true ? 'bez_id' : 'chyba');
  if (stavHttp === 429) return zaloha('limit', 'po60', 'limit');
  if (stavHttp === 502) return zaloha('chyba', 'hned', 'posta');
  if (stavHttp === 400) {
    if (d.chyba === 'email') return { druh: 'pole', pole: 'email', sprava: t.email, meranie: 'chyba' };
    return zaloha('chyba', d.chyba === 'pole' && d.pole === 'json' ? 'hned' : 'nie', 'chyba');
  }
  if (stavHttp === 403) return zaloha('chyba', 'nie', 'chyba');
  return zaloha('chyba', 'hned', 'chyba');
}
export function vAppkeFacebooku(ua) { return /FBAN|FBAV|Instagram/.test(ua || ''); }
// mailto: adresa len platná, predmet a text cez encodeURIComponent; pridlhý text ide do schránky a do e-mailu krátka veta.
export function mailtoOdkaz(text, adresa, limit = MAILTO_LIMIT) {
  if (!platnyEmail(adresa)) return { href: '', cely: false };
  const T = texty(adresa);
  const zaklad = 'mailto:' + adresa + '?subject=' + encodeURIComponent(T.predmet) + '&body=';
  const plny = zaklad + encodeURIComponent(text);
  if (plny.length <= limit) return { href: plny, cely: true };
  return { href: zaklad + encodeURIComponent(T.mailtoKratke), cely: false };
}

// Odosielač s poradím pokusov (AGENTS.md bod 12a): kým beží pokus, ďalší klik nič nepošle; odpoveď staršieho pokusu
// (aj tá, ktorá príde po časovom limite) sa zahodí. Pasca: pred 5,5 s od načítania stránky sa čaká, čas t je skutočný.
export function odosielac(o) {
  const fetchFn = o.fetchFn;
  const teraz = o.teraz;
  const cakaj = o.cakaj;
  const server = o.server || SERVER;
  const limitMs = o.limitMs || CAS_LIMIT_MS;
  const pascaMs = o.pascaMs === undefined ? PASCA_MS : o.pascaMs;
  const Ovladac = o.AbortController || null;
  let posledny = 0;
  let bezi = false;
  return {
    get bezi() { return bezi; },
    get posledny() { return posledny; },
    async posli(vyrobTelo, naCakanie) {
      if (bezi) return null;
      bezi = true;
      const pokus = ++posledny;
      try {
        const t0 = teraz();
        if (t0 < pascaMs) {
          if (naCakanie) naCakanie();
          await cakaj(pascaMs - t0);
        }
        if (pokus !== posledny) return { pokus, zastaraly: true };
        const body = JSON.stringify(vyrobTelo(teraz()));
        const ovladac = Ovladac ? new Ovladac() : null;
        const poziadavka = Promise.resolve().then(() => fetchFn(server, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          credentials: 'omit',
          cache: 'no-store',
          signal: ovladac ? ovladac.signal : undefined,
        })).then(async (r) => {
          let data = null;
          try { data = await r.json(); } catch (e) { data = null; }
          return { stav: Number(r.status) || 0, data };
        }, () => ({ stav: 0, data: null }));
        const odpoved = await Promise.race([poziadavka, cakaj(limitMs).then(() => {
          if (ovladac) { try { ovladac.abort(); } catch (e) { /* nič */ } }
          return { stav: 0, data: null };
        })]);
        if (pokus !== posledny) return { pokus, zastaraly: true };
        return { pokus, vysledok: vyhodnot(odpoved.stav, odpoved.data, o.texty) };
      } finally {
        if (pokus === posledny) bezi = false;
      }
    },
  };
}

// ---------------------------------------------------------------- DOM
export function spusti(koren, p) {
  const pr = p || {};
  if (!koren || !koren.ownerDocument) return null;
  const d = koren.ownerDocument;
  const w = d.defaultView || globalThis;
  const C = pr.cennik || w.ArlingCennik;
  if (!C || typeof C.spocitaj !== 'function') return null;
  const adresa = (koren.getAttribute('data-adresa') || '').trim();
  if (!platnyEmail(adresa)) return null;
  const T = texty(adresa);
  const $ = (id) => d.getElementById(id);
  const form = $('kalk-form');
  const vysl = $('kalk-vysledok');
  const dForm = $('dopyt-form');
  if (!form || !vysl || !dForm) return null;
  const MQ = (q) => (w.matchMedia ? w.matchMedia(q) : { matches: false });
  const pokoj = () => MQ('(prefers-reduced-motion: reduce)').matches;
  const teraz = pr.teraz || (() => (w.performance && w.performance.now ? w.performance.now() : 0));
  const cakaj = pr.cakaj || ((ms) => new Promise((r) => w.setTimeout(r, ms)));
  const zmeraj = (udalost, data) => {
    try { if (w.umami && typeof w.umami.track === 'function') w.umami.track(udalost, data); } catch (e) { /* meranie nesmie zastaviť kalkulačku */ }
  };
  const text = (el, t) => { if (el) el.textContent = pevne(t); };
  const novy = (tag, cls, t) => {
    const x = d.createElement(tag);
    if (cls) x.className = cls;
    if (t !== undefined) x.textContent = pevne(t);
    return x;
  };
  const D = C.data;

  // ------------------------------------------------ výber: formulár a voľby (cennik.js ocisti)
  const vstup = (name) => form.querySelector(`input[name="${name}"]:checked`);
  const hodnota = (name, def) => { const x = vstup(name); return x ? x.value : def; };
  const zaskrtnute = (name) => { const x = form.querySelector(`input[name="${name}"]`); return Boolean(x && x.checked); };
  const selStranky = $('kv-stranky');
  const selUkazka = $('kv-ukazka');
  function citaj() {
    const balik = hodnota('balik', 'jednostrankovy');
    return {
      balik,
      stranky: selStranky ? Number(selStranky.value) : 0,
      produkty: Number(hodnota('produkty', '30')),
      prvok: Number(hodnota('prvok', '0')),
      portfolio: zaskrtnute('portfolio'),
      prenos: Number(hodnota('prenos', '0')),
      jazyk: Number(hodnota('jazyk', '0')),
      rezervacie: zaskrtnute('rezervacie'),
      google: zaskrtnute('google'),
      posta: zaskrtnute('posta'),
      sluzba: balik === 'eshop' ? hodnota('sprava', 'bez') : hodnota('sluzba', 'mesacne'),
      ukazka: selUkazka && selUkazka.value ? selUkazka.value : null,
    };
  }
  function nastavRadio(name, value) {
    for (const x of form.querySelectorAll(`input[name="${name}"]`)) x.checked = x.value === String(value);
  }
  function nastavCheck(name, on) {
    const x = form.querySelector(`input[name="${name}"]`);
    if (x) x.checked = Boolean(on);
  }
  function zobraz(c) {
    for (const el of koren.querySelectorAll('[data-pre]')) {
      const pre = (el.getAttribute('data-pre') || '').split(' ');
      el.hidden = pre.indexOf(c.balik) === -1;
    }
    if (selStranky) {
      const min = D.baliky[c.balik].strankyMin || 2;
      for (const opt of selStranky.options) {
        const mimo = Number(opt.value) < min;
        opt.disabled = mimo;
        opt.hidden = mimo;
      }
    }
    for (const el of koren.querySelectorAll('[data-text-' + c.balik + ']')) text(el, el.getAttribute('data-text-' + c.balik));
    const bez = $('kv-bez');
    if (bez) bez.hidden = !(WEBY.indexOf(c.balik) !== -1 && c.sluzba === 'bez');
  }
  function nastav(c) {
    nastavRadio('balik', c.balik);
    if (selStranky && c.stranky) selStranky.value = String(c.nadRozsah ? D.baliky[c.balik].strankyMax + 1 : c.stranky);
    nastavRadio('produkty', c.produkty || 30);
    nastavRadio('prvok', c.prvok);
    nastavCheck('portfolio', c.portfolio);
    nastavRadio('prenos', c.prenos);
    nastavRadio('jazyk', c.jazyk);
    nastavCheck('rezervacie', c.rezervacie);
    nastavCheck('google', c.google);
    nastavCheck('posta', c.posta);
    if (c.balik === 'eshop') nastavRadio('sprava', c.sluzba); else nastavRadio('sluzba', c.sluzba);
    if (selUkazka) selUkazka.value = c.ukazka || '';
    zobraz(c);
  }

  // ------------------------------------------------ výsledok
  const cisloEl = $('kvv-cislo');
  let cislo = null;
  let cisloSlub = null;
  let posledny = null;
  let volby = null;
  function sumaNaStranke(n) {
    if (cislo) { cislo.set(n); return; }
    text(cisloEl, eur(n));
    if (!cisloSlub && !pokoj() && cisloEl) {
      // pretáčané číslo z ARLing Motion (/motion/, MIT); počiatočná suma je hneď skutočná, nepočíta sa od nuly
      cisloSlub = import('/motion/components/number/number.js').then((m) => {
        cislo = m.createNumber({ el: cisloEl, value: posledny ? posledny.jednorazovo : n, decimals: 0, suffix: '\u00a0€', locale: 'sk' });
      }).catch(() => { cislo = null; });
    }
  }
  const oznam = $('kvv-oznam');
  let oznamCas = 0;
  function render(c, odkial) {
    volby = c;
    const s = C.spocitaj(c);
    posledny = s;
    sumaNaStranke(s.jednorazovo);
    const B = D.baliky[s.balik];
    const O = D.mesacne[B.sluzba].obdobia[c.sluzba];
    const sluzbaEl = $('kvv-sluzba');
    if (sluzbaEl) {
      const t = O && O.rozpis ? O.rozpis : '';
      sluzbaEl.hidden = !t;
      text(sluzbaEl, t);
    }
    const ukEl = $('kvv-ukazka');
    if (ukEl) {
      ukEl.hidden = !s.ukazka;
      if (s.ukazka) text(ukEl, D.texty.podlaUkazky + ' ' + s.ukazka.meno);
    }
    const pred = $('kv-predvolba');
    if (pred) {
      const v = s.ukazka && D.ukazky[s.ukazka.slug] ? D.ukazky[s.ukazka.slug].predvolbaVeta : '';
      pred.hidden = !v;
      text(pred, v || '');
    }
    const zoz = $('kvv-polozky');
    if (zoz) {
      const nove = [];
      s.polozky.forEach((po, i) => {
        const li = novy('li');
        li.appendChild(novy('span', null, po.nazov + (po.pocet > 1 ? ` (${po.pocet} × ${eur(po.kus)})` : '')));
        li.appendChild(novy('b', null, eur(po.cena)));
        nove.push(li);
        if (i === 0 && s.vCene) nove.push(novy('li', 'kvv-vcene', D.texty.vCene + ': ' + s.vCene));
      });
      zoz.replaceChildren(...nove);
    }
    const zal = $('kvv-zaloha');
    if (zal) {
      zal.hidden = !s.zaloha;
      if (s.zaloha) text(zal, `${D.texty.zaloha} ${eur(s.zaloha)}, ${D.texty.zvysok.toLowerCase()} ${eur(s.zvysok)}.`);
    }
    const nah = $('kvv-nahlad');
    if (nah) nah.replaceChildren(novy('b', null, D.texty.nahlad), d.createTextNode(' ' + pevne(s.nahlad + '. ' + s.stavka)));
    const poz = $('kvv-poznamky');
    if (poz) poz.replaceChildren(...s.poznamky.map((t) => novy('li', null, t)));
    const mini = $('kv-mini-c');
    if (mini) text(mini, eur(s.jednorazovo));
    const miniS = $('kv-mini-s');
    if (miniS) text(miniS, s.mesacne ? `a ${eur(s.mesacne)} mesačne` : (s.rocne ? `a ${eur(s.rocne)} ročne` : ''));
    // odkazy na dotazník nesú výber (SPEC 2.4), utm len povolené z aktuálnej adresy
    const naDotaznik = C.adresa(c, 'dotaznik', w.location.search);
    for (const id of ['dopyt-dotaznik', 'du-dotaznik']) { const a = $(id); if (a) a.setAttribute('href', naDotaznik); }
    const roz = $('kvv-rozpis');
    if (roz && !roz.hidden) roz.value = C.rozpis(c);
    if (oznam && odkial !== 'start') {
      w.clearTimeout(oznamCas);
      const veta = `Jednorazovo ${eur(s.jednorazovo)}` + (s.mesacne ? `, mesačne ${eur(s.mesacne)}` : '') + (s.rocne ? `, ročne ${eur(s.rocne)}` : '') + '.';
      oznamCas = w.setTimeout(() => { oznam.textContent = pevne(veta); }, 350);
    }
    if (!pokoj() && odkial === 'zmena' && zoz && zoz.animate) {
      try { zoz.animate([{ opacity: 0.4, transform: 'translateY(3px)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'cubic-bezier(.23,1,.32,1)' }); } catch (e) { /* bez pohybu */ }
    }
  }
  function prepocitaj(raw, odkial) {
    const c = C.ocisti(raw);
    nastav(c);
    render(c, odkial);
    return c;
  }

  form.addEventListener('submit', (e) => e.preventDefault());
  form.addEventListener('change', (e) => {
    const t = e.target;
    const raw = citaj();
    if (t && t.name === 'ukazka') {
      const pv = t.value ? C.predvolba(t.value) : null;
      if (pv) { prepocitaj(pv, 'zmena'); return; }
      raw.ukazka = null;
    }
    if (volby && raw.balik !== volby.balik) {
      // nová služba podľa balíka: „bez“ správy e-shopu nesmie po prepnutí na web znamenať „bez starostlivosti“ (SPEC 3.3)
      delete raw.sluzba;
      zmeraj('web_kalk_balik', { target: raw.balik });
    }
    if (t && (t.name === 'sluzba' || t.name === 'sprava')) zmeraj('web_kalk_sluzba', { target: t.value });
    prepocitaj(raw, 'zmena');
  });

  // štart: výber z adresy (?b=, ?ukazka=), inak to, čo je vo formulári (človek mohol klikať, kým sa modul načítal)
  let start = null;
  try { start = C.zAdresy(w.location.search); } catch (e) { start = null; }
  prepocitaj(start || citaj(), 'start');

  // ------------------------------------------------ kopírovanie
  async function skopiruj(t, poleEl) {
    try {
      if (w.navigator && w.navigator.clipboard && w.navigator.clipboard.writeText) {
        await w.navigator.clipboard.writeText(t);
        return true;
      }
    } catch (e) { /* záloha nižšie */ }
    try {
      if (poleEl) {
        poleEl.hidden = false;
        poleEl.value = t;
        poleEl.focus();
        poleEl.select();
        return Boolean(d.execCommand && d.execCommand('copy'));
      }
    } catch (e) { /* ručne */ }
    return false;
  }
  const kopia = $('kvv-kopia');
  const stav = $('kvv-stav');
  const rozpisPole = $('kvv-rozpis');
  if (kopia) {
    kopia.addEventListener('click', async () => {
      const t = C.rozpis(volby);
      const ok = await skopiruj(t, rozpisPole);
      if (!ok && rozpisPole) { rozpisPole.hidden = false; rozpisPole.value = t; rozpisPole.focus(); rozpisPole.select(); }
      text(stav, ok ? T.rozpisSkopirovany : T.rozpisNeskopirovany);
      zmeraj('web_kalk_kopia', { vysledok: ok ? 'ok' : 'rucne' });
    });
  }
  const naDopyt = $('kvv-dopyt');
  const dopytEl = $('dopyt');
  if (naDopyt && dopytEl) {
    naDopyt.addEventListener('click', (e) => {
      e.preventDefault();
      dopytEl.scrollIntoView({ behavior: pokoj() ? 'auto' : 'smooth', block: 'start' });
      w.setTimeout(() => { try { dopytEl.focus({ preventScroll: true }); } catch (er) { dopytEl.focus(); } }, pokoj() ? 0 : 450);
      zmeraj('web_kalk_dopyt', {});
    });
  }

  // ------------------------------------------------ krátky dopyt
  const POLIA = ['meno', 'firma', 'email', 'telefon', 'poznamka'];
  const pole = (k) => $('d-' + k);
  const hp = $('d-pasca');
  const tlacidlo = $('dopyt-poslat');
  const dStav = $('dopyt-stav');
  const uspech = $('dopyt-uspech');
  const zaloha = $('dopyt-zaloha');
  const zText = $('dz-text');
  const zVeta = $('dz-veta');
  const zKopia = $('dz-kopia');
  const zMailto = $('dz-mailto');
  const zPomoc = $('dz-pomoc');
  const zTl = $('dz-tlacidla');
  const posielac = odosielac({
    fetchFn: pr.fetch || ((u, o) => w.fetch(u, o)),
    teraz,
    cakaj,
    AbortController: pr.AbortController || w.AbortController,
    texty: T,
  });
  let hotovo = false;
  let pisal = false;
  dForm.addEventListener('submit', (e) => e.preventDefault());
  function chybaPri(k, sprava) {
    const vstupEl = pole(k);
    const chEl = $('d-' + k + '-chyba');
    if (!vstupEl || !chEl) return;
    const pomoc = $('d-' + k + '-pomoc');
    if (sprava) {
      text(chEl, sprava);
      chEl.hidden = false;
      vstupEl.setAttribute('aria-invalid', 'true');
      vstupEl.setAttribute('aria-describedby', (pomoc ? pomoc.id + ' ' : '') + chEl.id);
    } else if (!chEl.hidden) {
      chEl.hidden = true;
      chEl.textContent = '';
      vstupEl.removeAttribute('aria-invalid');
      if (pomoc) vstupEl.setAttribute('aria-describedby', pomoc.id); else vstupEl.removeAttribute('aria-describedby');
    }
  }
  dForm.addEventListener('input', (e) => {
    const k = ((e.target && e.target.id) || '').replace('d-', '');
    if (POLIA.indexOf(k) === -1) return;
    if (!pisal) { pisal = true; zmeraj('web_dopyt_krok', { krok: 'prvy-znak' }); }
    chybaPri(k, '');
  });
  function tlacidloStav(s) {
    if (!tlacidlo) return;
    const t = tlacidlo.querySelector('span') || tlacidlo;
    if (s === 'odosiela') {
      t.textContent = T.odosiela;
      tlacidlo.disabled = true;
      tlacidlo.setAttribute('aria-busy', 'true');
    } else {
      t.textContent = s === 'znova' ? T.znova : T.poslat;
      tlacidlo.disabled = s === 'zamknute';
      tlacidlo.removeAttribute('aria-busy');
    }
    tlacidlo.hidden = s === 'skryte';
  }
  function udaje() {
    const o = {};
    for (const k of POLIA) { const x = pole(k); o[k] = x ? x.value : ''; }
    o.hp = hp ? hp.value : '';
    return pripravUdaje(o);
  }
  function ukazUspech(v, u) {
    hotovo = true;
    if (zaloha) zaloha.hidden = true;
    dForm.hidden = true;
    tlacidloStav('skryte');
    text(dStav, '');
    text($('du-cislo'), v.id);
    text($('du-potvrdenie'), v.potvrdenie ? T.potvrdenie(u.email) : T.bezPotvrdenia);
    if (!uspech) return;
    uspech.hidden = false;
    const h = $('du-nadpis');
    if (h) { try { h.focus({ preventScroll: false }); } catch (e) { h.focus(); } }
    if (!pokoj() && uspech.animate) {
      [...uspech.querySelectorAll('.du-os li')].forEach((li, i) => {
        try { li.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 320, delay: 80 + i * 70, easing: 'cubic-bezier(.23,1,.32,1)', fill: 'backwards' }); } catch (e) { /* bez pohybu */ }
      });
    }
  }
  function ukazZalohu(v, u, c, pokus) {
    const t = C.textDopytu(u, c);
    if (zText) zText.value = t;
    if (zVeta) text(zVeta, v.veta === 'limit' ? T.limit : (v.veta === 'siet' ? T.siet : T.chyba));
    if (zMailto) zMailto.setAttribute('href', mailtoOdkaz(t, adresa).href);
    if (zTl && zKopia && zMailto) {
      // v appke Facebooku a Instagramu sa mailto často neotvorí: kopírovanie ide prvé
      if (vAppkeFacebooku(w.navigator && w.navigator.userAgent)) zTl.insertBefore(zKopia, zMailto); else zTl.insertBefore(zMailto, zKopia);
    }
    if (zPomoc) zPomoc.hidden = true;
    if (zaloha) zaloha.hidden = false;
    text(dStav, '');
    if (v.znova === 'hned') tlacidloStav('znova');
    else if (v.znova === 'po60') {
      tlacidloStav('zamknute');
      w.setTimeout(() => { if (pokus === posielac.posledny && !hotovo && !posielac.bezi) tlacidloStav('znova'); }, ZNOVA_PO_LIMITE_MS);
    } else tlacidloStav('skryte');
  }
  if (tlacidlo) {
    tlacidlo.addEventListener('click', async () => {
      if (hotovo || posielac.bezi) return;
      for (const k of POLIA) chybaPri(k, '');
      const u = udaje();
      const chyby = kontrola(u, T);
      if (chyby.length) {
        chyby.forEach((x) => chybaPri(x.pole, x.sprava));
        const prvy = pole(chyby[0].pole);
        if (prvy) prvy.focus();
        zmeraj('web_dopyt_vysledok', { vysledok: 'kontrola' });
        return;
      }
      const c = volby;
      tlacidloStav('odosiela');
      zmeraj('web_dopyt_odoslat', { sposob: 'server' });
      const r = await posielac.posli((t) => telo(C, u, c, w.location.search, t), null);
      if (!r || r.zastaraly) return;
      const v = r.vysledok;
      zmeraj('web_dopyt_vysledok', { vysledok: v.meranie });
      if (v.druh === 'uspech') ukazUspech(v, u);
      else if (v.druh === 'pole') {
        chybaPri(v.pole, v.sprava);
        const x = pole(v.pole);
        if (x) x.focus();
        tlacidloStav('poslat');
      } else ukazZalohu(v, u, c, r.pokus);
    });
  }
  if (zKopia) {
    zKopia.addEventListener('click', async () => {
      const t = zText ? zText.value : '';
      const ok = await skopiruj(t, zText);
      if (!ok && zText) { zText.focus(); zText.select(); }
      text(dStav, ok ? T.skopirovane : T.neskopirovane);
      zmeraj('web_dopyt_odoslat', { sposob: 'kopia' });
    });
  }
  if (zMailto) {
    zMailto.addEventListener('click', () => {
      const t = zText ? zText.value : '';
      if (!mailtoOdkaz(t, adresa).cely) skopiruj(t, null).catch(() => {});
      if (zPomoc) { text(zPomoc, T.poMailto); zPomoc.hidden = false; }
      zmeraj('web_dopyt_odoslat', { sposob: 'mailto' });
    });
  }
  const kopiaAdresy = $('du-kopia-adresa');
  if (kopiaAdresy) {
    kopiaAdresy.addEventListener('click', async () => {
      const ok = await skopiruj(adresa, null);
      text($('du-stav'), ok ? T.adresaSkopirovana : T.adresaNeskopirovana);
    });
  }
  const duDotaznik = $('du-dotaznik');
  if (duDotaznik) duDotaznik.addEventListener('click', () => zmeraj('web_dopyt_dotaznik', { miesto: 'uspech' }));
  const dDotaznik = $('dopyt-dotaznik');
  if (dDotaznik) dDotaznik.addEventListener('click', () => zmeraj('web_dopyt_dotaznik', { miesto: 'dopyt' }));

  koren.classList.add('kalk-pripravena');
  return {
    balik(b) {
      if (BALIKY.indexOf(b) === -1) return;
      const raw = citaj();
      if (raw.balik !== b) { raw.balik = b; delete raw.sluzba; zmeraj('web_kalk_balik', { target: b }); }
      prepocitaj(raw, 'zmena');
    },
    volby() { return volby; },
  };
}
