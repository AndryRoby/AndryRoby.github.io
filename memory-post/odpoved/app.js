/* Stranka, na ktorej clovek odpoveda na jednu otazku Memory Post.
 *
 * Pre koho je pisana: niekto, kto ma osemdesiat a tablet na kolenach. Preto
 * velke pismo, velke tlacidlo, jeden stlpec a ziadny pohyb. Ziadny ramec,
 * ziadne konto, ziadne heslo: v adrese je token z e-mailu a nic viac.
 *
 * Ziadna analytika. Na tejto stranke nie je Umami, ziadny skript tretej strany
 * ani ziadne cookie. Je to napisane aj na stranke a plati to doslova: jedine
 * dve volania na siet su GET otazky a POST odpovede na nasu licencnu sluzbu.
 *
 * Koncept sa priebezne uklada do localStorage tohto zariadenia, kazde tri
 * sekundy a pri kazdej zmene s oneskorenim. Ked server nie je dostupny,
 * nestrati sa nic: text ostane v zariadeni a tlacidlo ponukne poslat si ho
 * e-mailom sebe.
 *
 * Texty stranky (vsetky viditelne retazce okrem tychto v HTML) prichadzaju zo
 * sluzby v jazyku darceka: en, sk, cs, de alebo pl. HTML nesie anglicke
 * znenie ako zalohu pre pripad, ze by sa dotaz nepodaril.
 */
(function () {
  'use strict';

  var LICENCIE = 'https://homelab.tailbf8f27.ts.net/licence/api';
  var KONCEPT = 'memory-post:draft:';
  var AUTOSAVE_MS = 3000;

  function $(id) { return document.getElementById(id); }

  var token = '';
  try { token = (new URL(location.href).searchParams.get('t') || '').trim(); } catch (e) { token = ''; }

  var texty = null;      /* page z texty.<jazyk>.json */
  var otazka = '';
  var mameOdpoved = false;

  var elText = $('text');
  var elStav = $('stav');
  var elKoncept = $('koncept');
  var elUlozit = $('ulozit');
  var elMailto = $('mailto');

  function nastavStav(sprava, dobre) {
    elStav.textContent = sprava || '';
    elStav.className = 'stav' + (dobre ? ' ok' : '');
  }

  function konceptKluc() { return KONCEPT + (token || 'bez-tokenu'); }

  function ulozKoncept() {
    try { localStorage.setItem(konceptKluc(), elText.value); } catch (e) { /* privatne okno, bezi dalej */ }
  }
  function nacitajKoncept() {
    try { return localStorage.getItem(konceptKluc()); } catch (e) { return null; }
  }
  function zabudniKoncept() {
    try { localStorage.removeItem(konceptKluc()); } catch (e) { /* nic */ }
  }

  /* Autosave: pri pisani s oneskorenim a k tomu kazde tri sekundy, aby sa nic
     nestratilo ani vtedy, ked tablet zaspi uprostred vety. */
  var caka = null;
  elText.addEventListener('input', function () {
    if (caka) clearTimeout(caka);
    caka = setTimeout(function () { ulozKoncept(); ukazKoncept(); }, 700);
  });
  setInterval(function () { if (elText.value) ulozKoncept(); }, AUTOSAVE_MS);
  window.addEventListener('beforeunload', ulozKoncept);

  function ukazKoncept() {
    if (!texty || !elText.value) { elKoncept.textContent = ''; return; }
    elKoncept.textContent = texty.draftKept || '';
  }

  /* Poslanie sebe e-mailom: zaloha pre pripad, ze server nie je dostupny.
     Prijemca ostava prazdny, adresu si clovek doplni sam; jeho adresu na tejto
     stranke zamerne nemame. */
  function pripravMailto() {
    var predmet = otazka || 'Memory Post';
    var telo = (otazka ? otazka + '\n\n' : '') + elText.value;
    elMailto.href = 'mailto:?subject=' + encodeURIComponent(predmet) + '&body=' + encodeURIComponent(telo);
  }

  function dosad(sablona, hodnoty) {
    return String(sablona || '').replace(/\{(\w+)\}/g, function (m, k) {
      return Object.prototype.hasOwnProperty.call(hodnoty, k) ? String(hodnoty[k]) : m;
    });
  }

  function vypniFormular() {
    elText.disabled = true;
    elUlozit.disabled = true;
    elUlozit.hidden = true;
    $('pokyn').hidden = true;
    elKoncept.textContent = '';
  }

  function nasadTexty(t, lang) {
    texty = t || null;
    if (lang) document.documentElement.setAttribute('lang', lang);
    if (!t) return;
    if (t.writeHere) $('pokyn').textContent = t.writeHere;
    if (t.save) elUlozit.textContent = t.save;
    if (t.mailto) elMailto.textContent = t.mailto;
    if (t.privacyHeading) $('sukromie-nadpis').textContent = t.privacyHeading;
    if (t.privacy) {
      /* Text sa vklada ako textContent a adresa sa pripoji ako skutocny odkaz,
         takze z odpovede servera sa nikdy neda vyrobit znacka. */
      var p = $('sukromie-text');
      p.textContent = '';
      var kusy = String(t.privacy).split('andrej@arling.sk');
      for (var i = 0; i < kusy.length; i++) {
        p.appendChild(document.createTextNode(kusy[i]));
        if (i < kusy.length - 1) {
          var a = document.createElement('a');
          a.href = 'mailto:andrej@arling.sk';
          a.textContent = 'andrej@arling.sk';
          p.appendChild(a);
        }
      }
    }
    if (t.noAnalytics) $('ziadna').textContent = t.noAnalytics;
    if (t.back) $('znacka').textContent = t.back;
  }

  function ukazOtazku(d) {
    nasadTexty(d.texts, d.lang);
    otazka = d.question || '';
    $('otazka').textContent = otazka;
    document.title = otazka || 'Memory Post';
    $('cislo').textContent = d.texts && d.texts.questionLabel ? dosad(d.texts.questionLabel, { n: d.number }) : '';
    $('preskocit').textContent = d.skip ? ((d.texts && d.texts.skipLead ? d.texts.skipLead + ' ' : '') + d.skip) : '';

    mameOdpoved = !!(d.answer && d.answer.length);
    var koncept = nacitajKoncept();
    if (koncept !== null && koncept !== '' && koncept !== d.answer) {
      elText.value = koncept;
    } else {
      elText.value = d.answer || '';
    }
    if (mameOdpoved && d.texts && d.texts.already) {
      nastavStav(dosad(d.texts.already, { date: d.answeredWords || d.answeredAt || '' }));
    }
    ukazKoncept();
    pripravMailto();
    elText.focus({ preventScroll: true });
  }

  function chybaBezOtazky(d, dovod) {
    nasadTexty(d && d.texts, d && d.lang);
    var t = (d && d.texts) || {};
    $('cislo').textContent = '';
    $('preskocit').textContent = '';
    var sprava = dovod === 'expired' ? (t.expired || 'This subscription has ended, so there are no new questions. Everything already written is still yours; write to andrej@arling.sk for the book and the files.')
      : (t.unknown || 'This link is not one of ours, or it has been used up. Write to andrej@arling.sk and we will send you a new one.');
    $('otazka').textContent = (t.back || 'Memory Post');
    vypniFormular();
    elText.hidden = true;
    nastavStav(sprava);
  }

  function nedostupne() {
    /* Server sa neozval. Ziadny text sa nemaze: koncept ostava v zariadeni a
       tlacidlo ponukne poslat si ho sebe e-mailom. */
    var t = texty || {};
    $('otazka').textContent = t.back || 'Memory Post';
    $('cislo').textContent = '';
    nastavStav(t.offline || 'We cannot reach our server right now. What you have written is kept on this device and nothing is lost. Try Save again in a minute, or send it to yourself with the button below.');
    elMailto.hidden = false;
    pripravMailto();
    var koncept = nacitajKoncept();
    if (koncept && !elText.value) elText.value = koncept;
    ukazKoncept();
  }

  async function nacitaj() {
    if (!token) { chybaBezOtazky(null, 'unknown'); return; }
    var r = null, odpoved = null;
    try {
      odpoved = await fetch(LICENCIE + '/memory-post/question?t=' + encodeURIComponent(token));
      r = await odpoved.json();
    } catch (e) { nedostupne(); return; }
    if (!r) { nedostupne(); return; }
    if (r.ok) { ukazOtazku(r); return; }
    if (r.reason === 'expired' || r.reason === 'unknown') { chybaBezOtazky(r, r.reason); return; }
    nedostupne();
  }

  elUlozit.addEventListener('click', async function () {
    var text = elText.value;
    if (!text.trim()) { elText.focus(); return; }
    ulozKoncept();
    elUlozit.disabled = true;
    nastavStav((texty && texty.saving) || 'Saving');
    var r = null;
    try {
      var odpoved = await fetch(LICENCIE + '/memory-post/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ t: token, text: text }),
      });
      r = await odpoved.json();
    } catch (e) { r = null; }
    elUlozit.disabled = false;
    if (!r) { nedostupne(); return; }
    if (!r.ok) {
      if (r.reason === 'expired' || r.reason === 'unknown') { chybaBezOtazky(r, r.reason); return; }
      nedostupne();
      return;
    }
    zabudniKoncept();
    mameOdpoved = true;
    elKoncept.textContent = '';
    nastavStav(r.message || (texty && texty.saved) || 'Saved.', true);
    pripravMailto();
  });

  nacitaj();
})();
