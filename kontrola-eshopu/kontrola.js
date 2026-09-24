/*
 * kontrola.js: stránka https://arling.sk/kontrola-eshopu/
 *
 * Pošle adresu e-shopu na worker (POST /v1/eshop/kontrola), vykreslí sedem
 * riadkov so stavom a zdrojom a pri nálezoch ponúkne balík GDPR predvyplnený
 * nájdenými službami. Všetok text z workera ide do stránky cez textContent,
 * nikdy ako HTML. Meranie: Umami udalosti z bodu 2 v
 * ops/strategia/2026-09-24/napady/top-10.md.
 *
 * ?ukazka=1 (alebo tlačidlo Ukážka) načíta ukazka.json: skutočný výstup
 * motora nad vymysleným e-shopom z testov, bez volania workera.
 */
(function () {
  'use strict';

  var API = 'https://arling-asistent.arling.workers.dev/v1/eshop/kontrola';
  var BALIK = '/gdpr-dokumenty/gdpr-dokumenty-eshop/';

  var CHYBY = {
    adresa_neplatna: 'Toto nevyzerá ako adresa webu. Skúste napríklad mojobchod.sk.',
    adresa_schema: 'Kontrolujeme len adresy, ktoré začínajú http:// alebo https://.',
    adresa_ip: 'Zadajte doménu e-shopu (napríklad mojobchod.sk), nie IP adresu.',
    adresa_port: 'Adresa s neštandardným portom sa nedá skontrolovať. Zadajte bežnú adresu e-shopu.',
    adresa_nepovolena: 'Túto adresu nekontrolujeme: vedie do súkromnej alebo internej siete. Zadajte verejnú adresu e-shopu.',
    domena_neexistuje: 'Táto doména v DNS neexistuje. Skontrolujte, či je napísaná správne.',
    stranka_blokuje: 'Stránka odmietla našu automatickú návštevu (ochrana proti robotom). V tomto prípade kontrolu spraviť nevieme; skúste to neskôr, alebo prejdite zoznam nižšie ručne.',
    stranka_chyba: 'Stránka vrátila chybu. Skontrolujte adresu a skúste to znova.',
    stranka_nedostupna: 'Na stránku sme sa nedostali. Skontrolujte adresu alebo to skúste o chvíľu.',
    stranka_pomala: 'Stránka odpovedala príliš pomaly (limit je 8 sekúnd na stránku). Skúste to o chvíľu znova.',
    nie_html: 'Na tejto adrese nie je webová stránka (napríklad je to PDF). Zadajte úvodnú stránku e-shopu.',
    vela_presmerovani: 'Stránka nás presmerovala príliš veľakrát za sebou. Zadajte presnú adresu úvodnej stránky.',
    rate_limited: 'Z vašej siete prišlo veľa kontrol za sebou. Počkajte minútu a skúste to znova.',
    rate_limited_ciel: 'Tento e-shop sa za poslednú hodinu kontroloval už desaťkrát. Skúste to o hodinu.',
    denny_strop: 'Dnes sme dosiahli denný počet kontrol. Skúste to zajtra, prosím.',
    payload_too_large: 'Adresa je príliš dlhá.',
    siet: 'Kontrolu sa nepodarilo spustiť (sieť alebo náš server). Skúste to znova o chvíľu.',
  };
  var STAVY = { ok: 'V poriadku', nalez: 'Nález', nevieme: 'Nevieme overiť' };

  var $ = function (id) { return document.getElementById(id); };
  var form = $('kontrola-form');
  var pole = $('kontrola-adresa');
  var tlacidlo = $('kontrola-spustit');
  var stav = $('kontrola-stav');
  var vysledok = $('vysledok');
  var obsah = $('vysledok-obsah');
  var posledna = '';
  var bezi = false;

  function track(meno, data) {
    try { if (window.umami && typeof window.umami.track === 'function') window.umami.track(meno, data); } catch (e) { /* nič */ }
  }
  function el(tag, trieda, text) {
    var e = document.createElement(tag);
    if (trieda) e.className = trieda;
    if (text !== undefined && text !== null) e.textContent = String(text);
    return e;
  }
  function slovo(n, jeden, dva, pat) { return n === 1 ? jeden : (n >= 2 && n <= 4 ? dva : pat); }
  function hostitel(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return url; } }

  function nastavStav(text, jeChyba) {
    stav.textContent = text || '';
    stav.classList.toggle('chyba', !!jeChyba);
  }

  function odkazNaBalik(v) {
    var p = new URLSearchParams();
    var pred = v.predvyplnenie || {};
    p.set('z', 'kontrola');
    if (pred.nastroje && pred.nastroje.length) p.set('n', pred.nastroje.join(','));
    if (pred.cookies && pred.cookies.length) p.set('c', pred.cookies.join(','));
    if (pred.cinnosti && pred.cinnosti.length) p.set('a', pred.cinnosti.join(','));
    (pred.ine || []).forEach(function (x) { p.append('i', x); });
    if (pred.web && !v.ukazka) p.set('w', pred.web);
    return BALIK + '#' + p.toString();
  }

  function vykresli(v) {
    obsah.textContent = '';
    var s = v.suhrn || { ok: 0, nalez: 0, nevieme: 0 };

    var hlava = el('div', 'vys-hlava');
    var h2 = el('h2', null, (v.ukazka ? 'Ukážka: ' : 'Výsledok pre ') + hostitel(v.adresa));
    h2.id = 'vysledok-nadpis';
    h2.tabIndex = -1;
    hlava.appendChild(h2);
    var suhrn = el('p', 'vys-suhrn');
    [['nalez', s.nalez, slovo(s.nalez, 'nález', 'nálezy', 'nálezov')],
      ['ok', s.ok, 'v poriadku'],
      ['nevieme', s.nevieme, 'nevieme overiť']].forEach(function (x, i) {
      if (i) suhrn.appendChild(document.createTextNode(' · '));
      var b = el('b', 'znak-' + x[0], x[1] + ' ' + x[2]);
      suhrn.appendChild(b);
    });
    hlava.appendChild(suhrn);
    var kedy = new Date(v.cas);
    var precitane = (v.stranky || []).filter(function (x) { return x.precitana; }).length;
    var meta = el('p', 'vys-meta', slovo(precitane, 'Prečítaná ', 'Prečítané ', 'Prečítaných ') + precitane + ' ' + slovo(precitane, 'stránka', 'stránky', 'stránok') + ' na ' + hostitel(v.adresa)
      + (isNaN(kedy) ? '' : ', ' + kedy.toLocaleString('sk-SK', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }))
      + (v.platforma ? '. Platforma podľa kódu: ' + v.platforma : '') + '.');
    hlava.appendChild(meta);
    if (v.ukazka) hlava.appendChild(el('p', 'vys-meta', 'Vymyslený e-shop z našich testov. Text riadkov je doslovný výstup kontroly nad jeho vzorovou stránkou.'));
    obsah.appendChild(hlava);

    var ol = el('ol', 'riadky');
    (v.riadky || []).forEach(function (r) {
      var li = el('li', 'riadok stav-' + r.stav);
      var znacka = el('span', 'znacka-stavu', STAVY[r.stav] || r.stav);
      li.appendChild(znacka);
      var telo = el('div', 'riadok-telo');
      telo.appendChild(el('h3', null, r.nazov));
      telo.appendChild(el('p', null, r.text));
      if (r.zdroj && r.zdroj.url) {
        var z = el('p', 'riadok-zdroj');
        z.appendChild(document.createTextNode('Zdroj: '));
        var a = el('a', null, r.zdroj.nazov);
        a.href = r.zdroj.url;
        a.rel = 'noopener';
        a.target = '_blank';
        z.appendChild(a);
        telo.appendChild(z);
      }
      li.appendChild(telo);
      ol.appendChild(li);
      if (r.stav === 'nalez' && !v.ukazka) track('eshop_nalez', { typ: r.typ || r.id });
    });
    obsah.appendChild(ol);

    obsah.appendChild(ponuka(v));

    var akcie = el('p', 'vys-akcie');
    var znova = el('button', 'btn btn-line', v.ukazka ? 'Skontrolovať vlastný e-shop' : 'Skontrolovať znova');
    znova.type = 'button';
    znova.addEventListener('click', function () {
      if (v.ukazka) { pole.focus(); form.scrollIntoView({ block: 'center' }); return; }
      spusti(posledna);
    });
    akcie.appendChild(znova);
    obsah.appendChild(akcie);
    obsah.appendChild(el('p', 'vys-pravne', v.upozornenie || 'Automatická kontrola verejnej stránky, nie právne poradenstvo.'));

    vysledok.hidden = false;
    try { h2.focus({ preventScroll: true }); } catch (e) { /* nič */ }
    vysledok.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    sledujCenu();
  }

  function ponuka(v) {
    var riadky = v.riadky || [];
    var nalez = function (id) { return riadky.some(function (r) { return r.id === id && r.stav !== 'ok'; }); };
    var mena = (v.sluzby || []).map(function (x) { return x.nazov; });
    var box = el('div', 'cena ponuka');
    box.appendChild(el('h3', null, mena.length ? 'Zásady a cookie lišta s vašimi službami' : 'Zásady ochrany osobných údajov pre e-shop'));
    var veta = mena.length
      ? 'Balík GDPR otvoríme s predvyplnenými službami, ktoré kontrola našla: ' + mena.join(', ') + '. Doplníte názov firmy a to, čo automatická kontrola nevidí (účtovník, kuriér, hosting).'
      : 'Kontrola na úvodnej stránke nenašla žiadnu zo sledovaných služieb. V balíku si zaškrtnete tie, ktoré používate.';
    box.appendChild(el('p', 'zaco', veta));
    if (nalez('zasady') || nalez('prijemcovia') || nalez('cookies')) {
      box.appendChild(el('p', 'zaco', 'Toto rieši riadky o zásadách, príjemcoch a cookies. Zásady ochrany osobných údajov sú zadarmo; celý balík vo Worde (zásady cookies s textom lišty, záznamy o spracovateľských činnostiach, sprostredkovateľská zmluva a ďalšie) stojí 39 € s DPH.'));
    } else {
      box.appendChild(el('p', 'zaco', 'Zásady ochrany osobných údajov sú zadarmo; celý balík vo Worde stojí 39 € s DPH.'));
    }
    var a = el('a', 'btn btn-solid', 'Poskladať zásady a cookie lištu s týmito službami');
    if (!mena.length) a.textContent = 'Otvoriť balík GDPR pre e-shop';
    a.href = odkazNaBalik(v);
    a.addEventListener('click', function () {
      track('eshop_do_balika', { sluzby: (v.sluzby || []).length, ukazka: v.ukazka ? 1 : 0 });
    });
    box.appendChild(a);
    if (nalez('odstupenie')) {
      box.appendChild(el('p', 'fineprint', 'Funkciu na odstúpenie od zmluvy balík GDPR nerieši, tá patrí do samotného e-shopu. Ak ho máte na platforme, pozrite sa najprv, či ju už nepripravila; inak ju doplní ten, kto vám e-shop spravuje.'));
    }
    box.appendChild(el('p', 'fineprint', 'Predávajúci: ARLing s. r. o., IČO 56583486, Bratislava. Platbu spracuje Stripe. Dokumenty sú vzory vyplnené vašimi údajmi, nie právne poradenstvo.'));
    return box;
  }

  var cenaVidena = false;
  function sledujCenu() {
    if (cenaVidena || !('IntersectionObserver' in window)) return;
    var box = obsah.querySelector('.ponuka');
    if (!box) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting && !cenaVidena) {
          cenaVidena = true;
          track('cena_videna', { produkt: 'gdpr', miesto: 'kontrola-eshopu' });
          io.disconnect();
        }
      });
    }, { threshold: 0.5 });
    io.observe(box);
  }

  function spusti(adresa) {
    if (bezi) return;
    adresa = String(adresa || '').trim();
    if (!adresa) { nastavStav('Zadajte adresu e-shopu, napríklad mojobchod.sk.', true); pole.focus(); return; }
    posledna = adresa;
    bezi = true;
    tlacidlo.disabled = true;
    tlacidlo.textContent = 'Kontrolujem…';
    form.setAttribute('aria-busy', 'true');
    nastavStav('Načítavame úvodnú stránku a najviac tri ďalšie. Zvyčajne to trvá do 10 sekúnd.', false);
    track('eshop_kontrola_spustena', {});

    var ac = typeof AbortController === 'function' ? new AbortController() : null;
    var casovac = ac ? setTimeout(function () { ac.abort(); }, 30000) : null;
    fetch(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: adresa }),
      signal: ac ? ac.signal : undefined,
      referrerPolicy: 'no-referrer',
    }).then(function (res) {
      return res.json().catch(function () { return { error: 'siet' }; }).then(function (data) { return { ok: res.ok, data: data }; });
    }).then(function (x) {
      if (!x.ok || !x.data || x.data.error) {
        var kod = (x.data && x.data.error) || 'siet';
        nastavStav(CHYBY[kod] || CHYBY.siet, true);
        track('eshop_kontrola_chyba', { kod: kod });
        return;
      }
      nastavStav('', false);
      track('eshop_kontrola_hotova', { nalezy: (x.data.suhrn || {}).nalez || 0 });
      vykresli(x.data);
    }).catch(function () {
      nastavStav(CHYBY.siet, true);
      track('eshop_kontrola_chyba', { kod: 'siet' });
    }).then(function () {
      if (casovac) clearTimeout(casovac);
      bezi = false;
      tlacidlo.disabled = false;
      tlacidlo.textContent = 'Skontrolovať zadarmo';
      form.removeAttribute('aria-busy');
    });
  }

  function ukazka() {
    nastavStav('Načítavame ukážku…', false);
    fetch('ukazka.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (v) {
      v.ukazka = true;
      nastavStav('', false);
      track('eshop_ukazka', {});
      vykresli(v);
    }).catch(function () { nastavStav('Ukážku sa nepodarilo načítať.', true); });
  }

  form.addEventListener('submit', function (e) { e.preventDefault(); spusti(pole.value); });
  var ukazkaBtn = $('kontrola-ukazka');
  if (ukazkaBtn) ukazkaBtn.addEventListener('click', ukazka);

  try {
    var q = new URL(location.href).searchParams;
    var a = q.get('adresa');
    if (a) pole.value = a.slice(0, 200);
    if (q.get('ukazka') === '1') ukazka();
  } catch (e) { /* nič */ }
})();
