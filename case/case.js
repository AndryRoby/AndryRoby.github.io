/* Vyzdvihnutie personalizovaného prípadu (Fable, 2. 10. 2026; okamžité doručenie, brána pokus 2; overenie pred
 * spustením 3. 10.): pýta sa case.arling.workers.dev na stav objednávky, kým sa prípad stavia, pýta sa znova sama,
 * pri "ready" ukáže odkazy na PDF, počet použitých mien a vynechané mená, pri "needs_help" formulár na mená.
 * Objednávka môže mať viac prípadov (cases); hotový prípad sa dá raz opraviť (pôvodné súbory platia, kým nie sú
 * nové). Výsledok sa po akcii posunie do zorného poľa (na mobile bol pod okrajom). Nič sa neukladá v prehliadači.
 * Dve ponuky (Claude 2, relácia 99, 3. 10. 2026): /status vracia pri každom prípade theme (halloween | vianoce) a
 * title; kicker a štítok hore sa nastavia podľa nich, pri viacerých prípadoch má každý blok názov svojho prípadu.
 * Bez theme (starší worker) ostáva neutrálny nadpis „Your friends as witnesses“.
 * Druhý produkt (Claude 2, relácia 105, 3. 10. 2026): krížovka z vlastných slov. Kupujúci hore zvolí, čo kúpil
 * (alebo príde odkazom /case/?p=crossword zo súboru Start here); podľa toho sa zmení nadpis, druhé pole (prvé slovo
 * zoznamu namiesto priezviska prvého hosťa) a pomoc. Výsledok sa vždy kreslí podľa poľa product z /status
 * (crossword; bez neho detektívka), takže objednávka s oboma produktmi ukáže oba. Krížovka má vlastný formulár na
 * slová (#krizovka-oprava, /fix s poľami words, words2, title, dedication). Texty detektívky ostávajú doslova.
 * Tretí produkt (Claude 2, relácia 115b, 8. 10. 2026): adventná hra na poklad (product advent, odkaz /case/?p=advent).
 * Overenie menom prvého dieťaťa; štyri súbory (part game | guide, každý v A4 a US Letter); formulár #advent-oprava
 * (/fix s poľami kids, spots, letter, siblings), dôvody KIDS, AGE, NAME, FEW_SPOTS, NO_KIDS, NO_SPOTS, TOO_LONG. */
(function () {
  var API = 'https://case.arling.workers.dev';
  var form = document.getElementById('case-form');
  var out = document.getElementById('case-vysledok');
  var oprava = document.getElementById('case-oprava');
  var opravaUvod = document.getElementById('oprava-uvod');
  var opravaStav = document.getElementById('oprava-vysledok');
  var kOprava = document.getElementById('krizovka-oprava');
  var kUvod = document.getElementById('krizovka-uvod');
  var kStav = document.getElementById('krizovka-vysledok');
  var kPocet = document.getElementById('krizovka-pocet');
  var aOprava = document.getElementById('advent-oprava');
  var aUvod = document.getElementById('advent-uvod');
  var aStav = document.getElementById('advent-vysledok');
  var aPocet = document.getElementById('advent-pocet');
  var casEl = document.getElementById('case-cas');
  var kickEl = document.getElementById('case-kick');
  var miestoEl = document.getElementById('case-miesto');
  var nadpisEl = document.getElementById('case-nadpis');
  var leadEl = document.getElementById('case-lead');
  var slovoLabel = document.getElementById('case-surname-label');
  if (!form || !out) return;
  var FORMATY = { a4: 'A4', letter: 'US Letter', eink: 'E-ink' };
  // témy ako v products/eliminacia/vyzdvihnutie/temy.mjs; title príde z /status, miesto je len na stránke
  var TEMY = {
    halloween: { title: 'Murder at the Lantern Ball', miesto: 'Grand Marlowe Hotel · Lantern Ball' },
    vianoce: { title: 'Murder at the Mistletoe Ball', miesto: 'Royal Alder Hotel · Mistletoe Ball' }
  };
  var NEUTRALNE = { kick: 'Your friends as witnesses', miesto: 'Personalized case file' };
  /* Texty podľa toho, čo kupujúci zvolil hore (kým /status nepovie, čo objednávka naozaj obsahuje). */
  var PRODUKTY = {
    mystery: {
      kick: NEUTRALNE.kick, miesto: NEUTRALNE.miesto, nadpis: 'Download your case', vec: 'case', tlacidlo: 'Find my case',
      lead: 'Bought the personalized case on Etsy? Enter your Etsy order number and the surname of the first guest on your list (or your own surname from the order).',
      label: 'Surname of the first guest on your list, or yours', priklad: 'for example Walsh', co: 'surname',
      over: 'use the surname of the first guest on your list, or your own surname as it appears on the Etsy order'
    },
    crossword: {
      kick: 'Custom crossword from your words', miesto: 'Personalized crossword', nadpis: 'Download your crossword', vec: 'crossword', tlacidlo: 'Find my crossword',
      lead: 'Bought the custom crossword on Etsy? Enter your Etsy order number and the first word on your list (or your own surname from the order).',
      label: 'First word on your list, or your surname', priklad: 'for example Lisbon', co: 'word',
      over: 'use the first word on your list (the word before the first colon), or your own surname as it appears on the Etsy order'
    },
    advent: {
      kick: 'Personalized advent treasure hunt', miesto: 'December 1 to 24', nadpis: 'Download your hunt', vec: 'hunt', tlacidlo: 'Find my hunt',
      lead: 'Bought the personalized advent treasure hunt on Etsy? Enter your Etsy order number and the first name of the first child on your list (or your own surname from the order).',
      label: 'First name of the first child on your list, or your surname', priklad: 'for example Emma', co: 'name',
      over: 'use the first name of the first child on your list, as you typed it with your order, or your own surname as it appears on the Etsy order'
    }
  };
  var ZMIESANE = { kick: 'Your personalized files', miesto: 'Personalized files' };
  // kódy dôvodov z products/eliminacia/vlastne.mjs (DOVODY) a MALO_MIEN
  var DOVODY = {
    JEDNO_SLOVO: 'it was only one word (we need a first name and a surname, like Emma Walsh)',
    SPOJENE: 'it looked like several names without commas between them',
    PRILIS_DLHE: 'it was too long to print (at most 20 letters in one word and in the surname)',
    ZNAKY: 'it had characters we cannot print (letters, apostrophes and hyphens work)',
    PRAZDNE: 'it had only a title or an initial, like Mr. or J.',
    PRILIS_KRATKE: 'a part of it was too short to print',
    DUPLICITA: 'it was the same as another name on your list',
    PRILIS_VELA: 'a case has room for 14 friends'
  };
  // kódy dôvodov krížovky z products/eliminacia/vyzdvihnutie/krizovka/vstup-etsy.mjs (DOVODY)
  var DOVODY_SLOV = {
    bez_slova: 'it has a clue but no word before the colon',
    bez_napovedy: 'it has no clue (write it as WORD: clue)',
    neplatne_znaky: 'the word has numbers or symbols (letters, spaces, hyphens and apostrophes work)',
    prilis_kratke: 'the word is shorter than 2 letters',
    prilis_dlhe: 'the word is longer than 15 letters',
    zopakovane: 'the same word is already on your list',
    nad_limit: 'a crossword has room for 25 words',
    neda_sa_prekrizit: 'it could not be connected to the other words in the grid'
  };
  var POLICKA = { 1: 'the first box', 2: 'the second box', 3: 'the title box', 4: 'the dedication box' };
  // adventná hra: kódy z products/eliminacia/vyzdvihnutie/krizovka/vstup-etsy.mjs (DOVODY) pri číslach úkrytov
  var DOVODY_MIEST = {
    miesto_neexistuje: 'it is not a number from the Hiding Spot Menu (1 to 50)',
    zopakovane: 'the same number is already on your list'
  };
  var POLICKA_ADVENT = { 1: 'the names box', 2: 'the hiding spots box', 3: 'the letter box', 4: 'the siblings box' };
  var ADVENT_CAST = { game: 'Clue cards', guide: 'Grown-ups Guide' };
  var ETSY = 'message us on Etsy (ARLing Puzzles); we reply within one working day';
  var CAKANIE = 15000, CAKAJ_HOTOVE = 15 * 60000, CAKAJ_NEZNAME = 5 * 60000;
  var casovac = null, zaciatok = 0, podpis = '';
  var ticho = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function prvok(tag, trieda, text) {
    var e = document.createElement(tag);
    if (trieda) e.className = trieda;
    if (text != null) e.textContent = text;
    return e;
  }
  function zastav() { if (casovac) { clearTimeout(casovac); casovac = null; } }
  function ukaz(el) {
    if (el && el.scrollIntoView) { try { el.scrollIntoView({ behavior: ticho ? 'auto' : 'smooth', block: 'nearest' }); } catch (e) { el.scrollIntoView(false); } }
  }
  function sprava(t, trieda) {
    podpis = '';
    out.className = 'case-vysledok';
    out.textContent = '';
    return out.appendChild(prvok('p', trieda || '', t));
  }
  function cas(t) { if (casEl) casEl.textContent = t || ''; }
  function skontrolovane() {
    cas('Last checked at ' + new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' }) + '.');
  }
  function mb(b) { return b < 1e6 ? Math.max(1, Math.round(b / 1000)) + ' kB' : (b / 1e6).toFixed(1) + ' MB'; }
  function vynechane(zoznam) {
    return zoznam.map(function (v) { return 'name ' + v.position + ', because ' + (DOVODY[v.reason] || 'we could not read it'); }).join('; ');
  }
  /* Vynechané položky krížovky: „entry 3 in the first box, because it has no clue“; position 0 = celé políčko. */
  function vynechaneSlova(zoznam) {
    return zoznam.map(function (v) {
      var kde = POLICKA[v.box] || 'your list';
      if (!v.position || v.reason === 'odpoved_orezana') return 'the end of ' + kde + ', because the text was longer than 1,024 characters';
      return 'entry ' + v.position + ' in ' + kde + ', because ' + (DOVODY_SLOV[v.reason] || 'we could not read it');
    }).join('; ');
  }
  function datum(d) {
    var dt = new Date(d + 'T12:00:00Z');
    return isNaN(dt) ? d : dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  }
  function stavDo(el, t, trieda) {
    if (!el) return;
    el.className = 'oprava-stav ' + (trieda || '');
    el.textContent = t;
    ukaz(el);
  }
  function stav(t, trieda) { stavDo(opravaStav, t, trieda); }
  function kStavNapis(t, trieda) { stavDo(kStav, t, trieda); }
  function aStavNapis(t, trieda) { stavDo(aStav, t, trieda); }
  /* Vynechané čísla úkrytov: „entry 4 in the hiding spots box, because it is not a number from the menu“. */
  function vynechaneMiesta(zoznam) {
    return zoznam.map(function (v) {
      var kde = POLICKA_ADVENT[v.box] || 'your answers';
      if (!v.position || v.reason === 'odpoved_orezana') return 'the end of ' + kde + ', because the text was longer than the box allows';
      return 'entry ' + v.position + ' in ' + kde + ', because ' + (DOVODY_MIEST[v.reason] || 'we could not read it');
    }).join('; ');
  }

  function fokus(el) { if (el) { try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } } }

  /* Čo kupujúci zvolil hore: mystery (predvolené, ako doteraz) alebo crossword. */
  function zvoleny() {
    var v = form.elements.produkt;
    var k = v && v.value;
    return PRODUKTY[k] ? k : 'mystery';
  }
  var jeKrizovka = function (c) { return c && c.product === 'crossword'; };
  var jeAdvent = function (c) { return c && c.product === 'advent'; };
  var jeProdukt = function (c) { return jeKrizovka(c) || jeAdvent(c); };
  function skryOpravy(okrem) {
    [oprava, kOprava, aOprava].forEach(function (f) { if (f && f !== okrem && !f.hidden) f.hidden = true; });
  }
  function nastavVolbu() {
    var P = PRODUKTY[zvoleny()];
    if (nadpisEl) nadpisEl.textContent = P.nadpis;
    if (leadEl) leadEl.textContent = P.lead;
    if (slovoLabel) slovoLabel.textContent = P.label;
    form.elements.surname.setAttribute('placeholder', P.priklad);
    form.querySelector('button[type="submit"]').textContent = P.tlacidlo;
    var bloky = document.querySelectorAll('[data-len]');
    for (var i = 0; i < bloky.length; i++) bloky[i].hidden = bloky[i].getAttribute('data-len') !== zvoleny();
    hlavicka([]);
  }

  /* Názov prípadu: z /status (title), inak podľa témy, inak nič (starší worker bez theme). */
  function nazovPripadu(c) {
    if (c.title) return c.title;
    return c.theme && TEMY[c.theme] ? TEMY[c.theme].title : '';
  }
  /* Kicker a štítok hore podľa prípadov objednávky: jedna téma = jej názov a hotel; rôzne témy alebo bez témy = neutrálne.
   * Krížovka: vlastný kicker; detektívka aj krížovka v jednej objednávke: „Your personalized files“. Bez prípadov podľa voľby hore. */
  function hlavicka(cases) {
    var krizovky = cases.filter(jeKrizovka).length, adventy = cases.filter(jeAdvent).length;
    var text;
    if (!cases.length) text = PRODUKTY[zvoleny()];
    else if (krizovky === cases.length) text = PRODUKTY.crossword;
    else if (adventy === cases.length) text = PRODUKTY.advent;
    else if (krizovky || adventy) text = ZMIESANE;
    else {
      var temy = [];
      cases.forEach(function (c) { if (c.theme && TEMY[c.theme] && temy.indexOf(c.theme) < 0) temy.push(c.theme); });
      var jedna = temy.length === 1 ? TEMY[temy[0]] : null;
      text = { kick: jedna ? (nazovPripadu(cases[0]) || jedna.title) + ' · ' + NEUTRALNE.kick : NEUTRALNE.kick, miesto: jedna ? jedna.miesto : NEUTRALNE.miesto };
    }
    if (kickEl) kickEl.textContent = text.kick;
    if (miestoEl) miestoEl.textContent = text.miesto;
  }

  /* Formulár na mená pod výsledkom: pre prípad, ktorý čaká na mená, alebo pre jednu opravu hotového prípadu.
   * akcia: 'fokus' (kurzor do prvého poľa), 'skok' (aj posun k formuláru, po ťuknutí na odkaz), inak nič.
   * Krížovka má vlastný formulár na slová; naraz je otvorený len jeden. */
  function otvorOpravu(c, order, viac, akcia) {
    var f = jeKrizovka(c) ? kOprava : jeAdvent(c) ? aOprava : oprava;
    if (!f) return;
    skryOpravy(f);
    var ten = f.elements['case'].value === (c.id || '') && !f.hidden;
    f.hidden = false;
    f.elements.order.value = order;
    f.elements['case'].value = c.id || '';
    if (jeAdvent(c)) {
      var ktora2 = viac && c.number ? ' for hunt ' + c.number : '';
      if (aUvod) {
        aUvod.textContent = c.status === 'ready'
          ? 'Type all your answers again' + ktora2 + ', the way they should be in your hunt. Tip: copy them from your Etsy order and correct them here. Your current files stay on this page and keep working until the new ones are ready. You can do this once.'
          : 'Type your answers' + ktora2 + ' below. Tip: copy them from your Etsy order and correct them here. Your hunt is built right away, in about a minute.';
      }
      if (aStav && !ten) { aStav.textContent = ''; aStav.className = 'oprava-stav'; }
    } else if (jeKrizovka(c)) {
      var ktora = viac && c.number ? ' for crossword ' + c.number : '';
      if (kUvod) {
        kUvod.textContent = c.status === 'ready'
          ? 'Type your full list again' + ktora + ', the way it should be in your crossword. Tip: copy it from your Etsy order and correct it here. Your current files stay on this page and keep working until the new ones are ready. You can do this once.'
          : 'Type your words and clues' + ktora + ' below. Tip: copy your list from your Etsy order and correct it here. Your crossword is built right away, in about a minute.';
      }
      if (kStav && !ten) { kStav.textContent = ''; kStav.className = 'oprava-stav'; }
    } else {
      var ktory = viac && c.number ? ' for personalized case ' + c.number + (nazovPripadu(c) ? ' (' + nazovPripadu(c) + ')' : '') : '';
      if (opravaUvod) {
        opravaUvod.textContent = c.status === 'ready'
          ? 'Type the full list of guests again' + ktory + ', the way it should be in your case. Your current files stay on this page and keep working until the new ones are ready. You can do this once.'
          : 'Type the guest names' + ktory + ' below. Your case is built right away, in about a minute.';
      }
      // pri opakovanom vykreslení toho istého prípadu ostane posledná správa formulára (napríklad chyba mien)
      if (opravaStav && !ten) { opravaStav.textContent = ''; opravaStav.className = 'oprava-stav'; }
    }
    if (akcia === 'skok') ukaz(f);
    if (akcia) fokus(f.elements.buyer);
  }
  function tlacidloOpravy(text, c, order, viac) {
    var b = prvok('button', 'case-odkaz', text);
    b.type = 'button';
    b.setAttribute('data-umami-event', 'case_fix_open');
    b.addEventListener('click', function () { otvorOpravu(c, order, viac, 'skok'); });
    return b;
  }

  function odkazy(blok, c) {
    var ul = prvok('ul');
    (c.files || []).forEach(function (f) {
      var li = prvok('li');
      // adventná hra má dve časti v každom formáte: „Clue cards, A4 PDF“ a „Grown-ups Guide, A4 PDF“
      var a = prvok('a', '', (f.part && ADVENT_CAST[f.part] ? ADVENT_CAST[f.part] + ', ' : '') + (FORMATY[f.format] || f.format) + ' PDF');
      a.href = f.url;
      a.setAttribute('download', f.name);
      a.setAttribute('data-umami-event', 'case_download');
      a.setAttribute('data-umami-event-format', f.format);
      if (c.theme) a.setAttribute('data-umami-event-theme', c.theme);
      if (c.product) a.setAttribute('data-umami-event-product', c.product);
      if (f.part) a.setAttribute('data-umami-event-part', f.part);
      li.appendChild(a);
      li.appendChild(prvok('span', '', mb(f.bytes)));
      ul.appendChild(li);
    });
    blok.appendChild(ul);
  }
  function hotovyBlok(blok, c, order, viac) {
    blok.classList.add('hotovo');
    if (jeKrizovka(c)) { hotovaKrizovka(blok, c, order, viac); return; }
    if (jeAdvent(c)) { hotovyAdvent(blok, c, order, viac); return; }
    blok.appendChild(prvok('p', '', 'Your case is ready. Download all three files and keep them; the links work until ' + datum(c.expires) + '.'));
    odkazy(blok, c);
    var skip = c.skipped || [];
    var t = c.used != null ? 'We used ' + c.used + ' names from your list.' : '';
    if (skip.length) t += ' Counting each person on your list separately, we left out ' + vynechane(skip) + '.';
    if (t) blok.appendChild(prvok('p', 'pozn', t.trim()));
    if (c.detectiveSkipped) blok.appendChild(prvok('p', 'pozn', 'We could not use the detective name you typed (it was too long or had characters we cannot print), so your case uses our own detective.'));
    if (c.fixing) blok.appendChild(prvok('p', 'pozn', 'We are building your corrected case now. Your current files stay here and keep working until the new ones are ready.'));
    else if (c.fixable) blok.appendChild(tlacidloOpravy('A name is wrong? You can fix the names once', c, order, viac));
    else blok.appendChild(prvok('p', 'pozn', 'You have already fixed the names of this case once. If a name is still wrong, ' + ETSY + '.'));
  }
  function hotovaKrizovka(blok, c, order, viac) {
    blok.appendChild(prvok('p', '', 'Your crossword is ready. Download both files and keep them; the links work until ' + datum(c.expires) + '.'));
    odkazy(blok, c);
    var skip = c.skipped || [];
    var t = 'Each file has 5 pages: cover, how to play, the puzzle, the solution and a keepsake page to frame.';
    if (c.used != null) t += ' Your crossword has ' + c.used + ' words.';
    blok.appendChild(prvok('p', 'pozn', t));
    if (skip.length) blok.appendChild(prvok('p', 'pozn', 'We left out ' + vynechaneSlova(skip) + '.' + (c.fixable ? ' You can correct your list once with the link below.' : '')));
    if (c.fixing) blok.appendChild(prvok('p', 'pozn', 'We are building your corrected crossword now. Your current files stay here and keep working until the new ones are ready.'));
    else if (c.fixable) blok.appendChild(tlacidloOpravy('A word or clue is wrong? You can fix your list once', c, order, viac));
    else blok.appendChild(prvok('p', 'pozn', 'You have already fixed this crossword once. If something is still wrong, ' + ETSY + '.'));
  }

  function hotovyAdvent(blok, c, order, viac) {
    blok.appendChild(prvok('p', '', 'Your advent treasure hunt is ready. Download the clue cards and the Grown-ups Guide in one paper size and keep them; the links work until ' + datum(c.expires) + '.'));
    odkazy(blok, c);
    var skip = c.skipped || [];
    var t = 'The clue cards have 7 pages: cover, how to play, 24 cards to cut out and the Day 24 letter. The Grown-ups Guide has 3 pages: where to hide each card, and the answers. Keep the guide away from the children.';
    if (c.kids != null && c.spots != null) t += ' Your hunt is for ' + c.kids + (c.kids === 1 ? ' child' : ' children') + ' and uses ' + c.spots + (c.defaultSpots ? ' everyday hiding spots (you left the box empty); your guide lists them.' : ' hiding spots.');
    blok.appendChild(prvok('p', 'pozn', t));
    if (skip.length) blok.appendChild(prvok('p', 'pozn', 'We left out ' + vynechaneMiesta(skip) + '.' + (c.fixable ? ' You can correct your answers once with the link below.' : '')));
    if (c.fixing) blok.appendChild(prvok('p', 'pozn', 'We are building your corrected hunt now. Your current files stay here and keep working until the new ones are ready.'));
    else if (c.fixable) blok.appendChild(tlacidloOpravy('A name, age or spot is wrong? You can fix your answers once', c, order, viac));
    else blok.appendChild(prvok('p', 'pozn', 'You have already fixed this hunt once. If something is still wrong, ' + ETSY + '.'));
  }

  var POMOC = {
    INTERRUPTED: 'Your last try did not finish, so this case was not built. Please type the names again below; it takes about a minute.',
    BUILD_FAILED: 'Building this case from the names you typed failed, and we have been notified. Please try once more below. If it fails again, ' + ETSY + '.'
  };
  var POMOC_SLOVA = {
    INTERRUPTED: 'Your last try did not finish, so this crossword was not built. Please send your words again below; it takes about a minute.',
    BUILD_FAILED: 'Building this crossword from the words you sent failed, and we have been notified. Please try once more below. If it fails again, ' + ETSY + '.',
    EMPTY: 'We did not find any words and clues in your order, so there is nothing to build yet.',
    TOO_LONG: 'Your words and clues do not fit on one page. Try shortening each clue to 40 characters or fewer for 21 to 25 words, or 60 characters or fewer for 10 to 20 words, including spaces and punctuation. If it still does not fit, send fewer words.'
  };
  /* Prečo krížovka čaká na kupujúceho: dôvod, počet použiteľných slov a položky, ktoré sa nedali použiť. */
  function dovodSlov(d) {
    var t = d.reason === 'FEW_WORDS'
      ? 'A crossword needs at least 10 words, each with a clue' + (d.valid != null ? '; we could use ' + d.valid + ' from your list.' : '.')
      : (POMOC_SLOVA[d.reason] || 'We could not build a crossword from the words in your order.');
    var skip = d.skipped || [];
    if (skip.length) t += ' We could not use ' + vynechaneSlova(skip) + '.';
    return t;
  }
  var POMOC_ADVENT = {
    INTERRUPTED: 'Your last try did not finish, so this hunt was not built. Please send your answers again below; it takes about a minute.',
    BUILD_FAILED: 'Building this hunt from your answers failed, and we have been notified. Please try once more below. If it fails again, ' + ETSY + '.',
    NO_KIDS: 'We did not find the children’s names and ages in your order, so there is nothing to build yet.',
    NO_SPOTS: 'We did not find any hiding spot numbers in your order, so there is nothing to build yet.',
    KIDS: 'A hunt is for 1 to 4 children, each written as a first name and an age (for example Emma 5, Leo 8).',
    AGE: 'Every child needs an age from 4 to 12 right after the name (for example Emma 5, Leo 8).',
    NAME: 'A name was longer than 20 letters or had characters we cannot print (letters, spaces, apostrophes and hyphens work).',
    TOO_LONG: 'The names together did not fit on the clue cards. Please try shorter names, for example nicknames. If your names are already short, ' + ETSY + ' and we will fix it.'
  };
  /* Prečo adventná hra čaká na kupujúceho: dôvod, počet platných úkrytov a čísla, ktoré sa nedali použiť. */
  function dovodAdventu(d) {
    var t = d.reason === 'FEW_SPOTS'
      ? 'A hunt needs at least 12 different numbers from the Hiding Spot Menu' + (d.valid != null ? '; we could use ' + d.valid + ' from your order.' : '.') + ' Or leave the box empty and we use our 16 everyday spots.'
      : (POMOC_ADVENT[d.reason] || 'We could not build a hunt from the answers in your order.');
    var skip = d.skipped || [];
    if (skip.length) t += ' We could not use ' + vynechaneMiesta(skip) + '.';
    return t;
  }
  function pomocBlok(blok, c, order, viac) {
    blok.classList.add('zle');
    if (jeAdvent(c)) {
      blok.appendChild(prvok('p', '', dovodAdventu(c) + ' Send your answers again below and your hunt is built right away.'));
      if (viac) blok.appendChild(tlacidloOpravy('Type the answers for this hunt', c, order, viac));
      return;
    }
    if (jeKrizovka(c)) {
      blok.appendChild(prvok('p', '', dovodSlov(c) + ' Send your list again below and your crossword is built right away.'));
      if (viac) blok.appendChild(tlacidloOpravy('Type the words for this crossword', c, order, viac));
      return;
    }
    blok.appendChild(prvok('p', '', POMOC[c.reason] || 'We could not read at least 3 names (first name and surname) from your order. Type them again below and your case is built right away.'));
    if (viac) blok.appendChild(tlacidloOpravy('Type the names for this case', c, order, viac));
  }

  /* Vykreslí všetky prípady objednávky. Vráti true, keď sa má stránka pýtať znova (stavba beží). */
  function vykresli(d, order, uplynulo, sFokusom) {
    var cases = d.cases && d.cases.length ? d.cases : [d];
    var viac = cases.length > 1;
    var cakat = false, pomoc = null;
    var novy = JSON.stringify(d) + (uplynulo >= CAKAJ_HOTOVE ? '+' : '');
    if (novy === podpis) {
      cases.forEach(function (c) { if (c.status === 'pending' || c.fixing) cakat = true; });
      return cakat && uplynulo < CAKAJ_HOTOVE;
    }
    podpis = novy;
    hlavicka(cases);
    out.className = 'case-vysledok';
    out.textContent = '';
    cases.forEach(function (c, i) {
      var blok = prvok('div', 'pripad');
      var vec = jeKrizovka(c) ? 'crossword' : jeAdvent(c) ? 'hunt' : 'case';
      // pri viacerých prípadoch (aj Halloween a Vianoce v jednej objednávke) má každý blok názov svojho prípadu
      if (viac) blok.appendChild(prvok('h2', 'pripad-nazov', (jeProdukt(c) ? 'Personalized file ' : 'Personalized case ') + (c.number || i + 1) + ' of ' + cases.length + (nazovPripadu(c) ? ' · ' + nazovPripadu(c) : '')));
      if (c.status === 'ready') { hotovyBlok(blok, c, order, viac); if (c.fixing) cakat = true; }
      else if (c.status === 'needs_help') { pomocBlok(blok, c, order, viac); if (!pomoc) pomoc = c; }
      else if (c.status === 'delayed') {
        blok.classList.add('zle');
        blok.appendChild(prvok('p', '', 'Something went wrong while building your ' + vec + ', and we have been notified. We will build it again within one working day, and your files will appear on this page. You can also ' + ETSY + '.'));
      } else if (uplynulo < CAKAJ_HOTOVE) {
        blok.appendChild(prvok('p', '', 'We are building your ' + vec + ' right now. This usually takes a few minutes. This page checks again by itself, so you can leave it open.'));
        cakat = true;
      } else {
        blok.appendChild(prvok('p', '', 'Your ' + vec + ' is taking longer than usual. Please check again in an hour, or ' + ETSY + '.'));
      }
      out.appendChild(blok);
    });
    if (d.others) {
      out.appendChild(prvok('p', 'pozn', cases.some(jeProdukt)
        ? 'This order has ' + d.others + ' more personalized file' + (d.others > 1 ? 's' : '') + '. To see ' + (d.others > 1 ? 'them' : 'it') + ' too, use your own surname as it appears on the Etsy order.'
        : 'This order has ' + d.others + ' more personalized case' + (d.others > 1 ? 's' : '') + '. To see ' + (d.others > 1 ? 'them' : 'it') + ' too, use your own surname as it appears on the Etsy order, or the surname of the first guest on that list.'));
    }
    // jediný prípad, ktorý čaká na mená: formulár hneď (ako doteraz); pri viacerých tlačidlom pri prípade
    if (pomoc && !viac) otvorOpravu(pomoc, order, false, sFokusom ? 'fokus' : '');
    else if (!pomoc && !cases.some(function (c) { return c.status === 'ready' && c.fixable; })) skryOpravy(null);
    return cakat && uplynulo < CAKAJ_HOTOVE;
  }

  /* Neznáma objednávka: hneď povie, že preklep vyzerá rovnako, a ponúkne priezvisko kupujúceho z Etsy.
   * Vykreslí sa len pri zmene (pred a po 5 minútach), aby ťukanie na tlačidlo neprerušilo každé hľadanie. */
  function nezname(uplynulo) {
    var neskoro = uplynulo >= CAKAJ_NEZNAME;
    var P = PRODUKTY[zvoleny()];
    if (podpis === 'unknown' + neskoro) return;
    if (!neskoro) {
      sprava('We cannot find a ' + P.vec + ' for this order number and ' + P.co + ' yet. If you paid just now, it appears here within a few minutes, and this page keeps checking. A typo in the order number or in the ' + P.co + ' looks exactly the same, so please check both now: ' + P.over + '.');
    } else {
      sprava('We still cannot find a ' + P.vec + ' for this order number and ' + P.co + '. Please check the order number, and try your own surname as it appears on the Etsy order. Files are kept for 30 days after a ' + P.vec + ' is built. If you ordered earlier, or nothing works, ' + ETSY + '. Press ' + P.tlacidlo + ' to check again.', 'zle');
    }
    var b = prvok('button', 'case-odkaz', 'Try my own surname from the Etsy order');
    b.type = 'button';
    b.addEventListener('click', function () {
      zastav();
      cas('');
      form.elements.surname.value = '';
      form.elements.surname.setAttribute('placeholder', 'your surname, as on the Etsy order');
      ukaz(form.elements.surname);
      fokus(form.elements.surname);
    });
    out.appendChild(b);
    podpis = 'unknown' + neskoro;
  }

  /* zaloha: hotový prípad z /fix, keby sa /status nepodaril (aby kupujúci videl odkazy hneď). */
  function zisti(order, surname, tlacidlo, rolovat, zaloha) {
    zastav();
    fetch(API + '/status?order=' + encodeURIComponent(order) + '&surname=' + encodeURIComponent(surname), { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var uplynulo = Date.now() - zaciatok;
        if (d.status === 'invalid') { cas(''); sprava('Please check the order number (digits only) and the ' + PRODUKTY[zvoleny()].co + '.', 'zle'); }
        else if (d.status === 'unknown' && zaloha) { cas(''); vykresli({ cases: [zaloha] }, order, 0, false); }
        else if (d.status === 'unknown') {
          nezname(uplynulo);
          if (uplynulo < CAKAJ_NEZNAME) { skontrolovane(); casovac = setTimeout(function () { zisti(order, surname); }, CAKANIE); } else cas('');
        } else if (vykresli(d, order, uplynulo, !!rolovat)) {
          skontrolovane();
          casovac = setTimeout(function () { zisti(order, surname); }, CAKANIE);
        } else cas('');
        if (rolovat) ukaz(out);
      })
      .catch(function () {
        if (zaloha) { vykresli({ cases: [zaloha] }, order, 0, false); if (rolovat) ukaz(out); return; }
        sprava('The download service did not answer. Please try again in a minute.', 'zle');
        cas('');
        if (rolovat) ukaz(out);
      })
      .then(function () { if (tlacidlo) tlacidlo.disabled = false; });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var order = String(form.elements.order.value || '').replace(/\D/g, '');
    var surname = String(form.elements.surname.value || '').trim();
    if (order.length < 6 || surname.length < 2) { sprava('Please enter the order number (digits only) and the ' + PRODUKTY[zvoleny()].co + '.', 'zle'); ukaz(out); return; }
    var tlacidlo = form.querySelector('button[type="submit"]');
    tlacidlo.disabled = true;
    skryOpravy(null);
    hlavicka([]); // nové hľadanie: neutrálny nadpis, kým /status nepovie tému
    zaciatok = Date.now();
    sprava('Looking for your ' + PRODUKTY[zvoleny()].vec + '...');
    zisti(order, surname, tlacidlo, true);
  });

  if (oprava) oprava.addEventListener('submit', function (e) {
    e.preventDefault();
    var telo = {
      order: String(oprava.elements.order.value || '').replace(/\D/g, ''),
      'case': String(oprava.elements['case'].value || ''),
      buyer: String(oprava.elements.buyer.value || '').trim(),
      names: String(oprava.elements.names.value || '').trim(),
      detective: String(oprava.elements.detective.value || '').trim()
    };
    if (telo.buyer.length < 2 || telo.names.length < 5) { stav('Please fill in your surname and the guest names.', 'zle'); return; }
    var tlacidlo = oprava.querySelector('button[type="submit"]');
    tlacidlo.disabled = true;
    zastav();
    cas('');
    stav('Building your case. This takes about a minute; please keep this page open.');
    fetch(API + '/fix', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(telo) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.status === 'ready') {
          oprava.hidden = true;
          zaciatok = Date.now();
          sprava('Your case is ready.');
          zisti(telo.order, telo.buyer, null, true, d);
          fokus(out); // fokus bol vo formulári, ktorý sa skryl
          return;
        }
        if (d.status === 'wrong_buyer') stav('That surname does not match the name on this Etsy order. Type your own surname exactly as it appears on the Etsy receipt, not a guest’s surname. If you ordered it as a gift, or it still does not match, ' + ETSY + ', and we will unlock this form for you.', 'zle');
        else if (d.status === 'already_fixed') stav('You have already used the one fix for this case, so it cannot be built again here. If a name is still wrong, ' + ETSY + '.', 'zle');
        else if (d.status === 'names') {
          var t = d.reason === 'MALO_MIEN'
            ? 'We need at least 3 guests, each with a first name and a surname' + (d.valid != null ? '; we could use ' + d.valid + ' from this list.' : '.')
            : 'We could not read this list.';
          var skip = d.skipped || [];
          if (skip.length) t += ' Counting each person separately, we could not use ' + vynechane(skip) + '.';
          t += ' Please write 3 to 14 guests, each as a first name and a surname, separated by commas (for example Emma Walsh, Liam Turner, Olivia Brooks), and press Build my case again.';
          stav(t, 'zle');
        } else if (d.status === 'pending') {
          stav('This case is already being built. It appears above as soon as it is ready.');
          zaciatok = Date.now();
          zisti(telo.order, telo.buyer, null, true);
        } else if (d.status === 'unknown') stav('We cannot find a case waiting for names under this order number anymore. Please press Find my case again.', 'zle');
        else if (d.status === 'invalid') stav('Please check your surname and the guest names.', 'zle');
        else if (d.kept) stav('Building your corrected case failed, and we have been notified. Your current files are unchanged and still work. Please try again in a few minutes; if it fails again, ' + ETSY + '.', 'zle');
        else stav('Building your case failed, and we have been notified. Please press Build my case once more. If it fails again, ' + ETSY + '.', 'zle');
      })
      .catch(function () {
        // spojenie spadlo počas stavby: stavba môže bežať ďalej, preto sa stránka spýta na stav namiesto chyby
        stav('We lost the connection while your case was being built. Checking where it stands...');
        zaciatok = Date.now();
        casovac = setTimeout(function () { zisti(telo.order, telo.buyer, null, true); }, 5000);
      })
      .then(function () { tlacidlo.disabled = false; });
  });

  /* Krížovka: počítadlo položiek pod políčkami (koľko riadkov má slovo aj nápovedu), aby kupujúci videl 10 až 25 skôr, než odošle. */
  function pocetSlov() {
    if (!kOprava || !kPocet) return 0;
    var riadky = (String(kOprava.elements.words.value || '') + '\n' + String(kOprava.elements.words2.value || '')).split(/\n/);
    var n = riadky.filter(function (r) { return /\S\s*[:=]\s*\S|\S\s+[-–—]\s*\S|\S\s*[-–—]\s+\S/.test(r); }).length;
    kPocet.textContent = n + (n === 1 ? ' word with a clue' : ' words with clues') + ' so far. A crossword needs 10 to 25.';
    kPocet.className = 'case-tip case-pocet' + (n >= 10 && n <= 25 ? ' dost' : '');
    return n;
  }
  if (kOprava) {
    kOprava.elements.words.addEventListener('input', pocetSlov);
    kOprava.elements.words2.addEventListener('input', pocetSlov);
    pocetSlov();
    kOprava.addEventListener('submit', function (e) {
      e.preventDefault();
      var telo = {
        order: String(kOprava.elements.order.value || '').replace(/\D/g, ''),
        'case': String(kOprava.elements['case'].value || ''),
        buyer: String(kOprava.elements.buyer.value || '').trim(),
        words: String(kOprava.elements.words.value || '').trim(),
        words2: String(kOprava.elements.words2.value || '').trim(),
        title: String(kOprava.elements.title.value || '').trim(),
        dedication: String(kOprava.elements.dedication.value || '').trim()
      };
      if (telo.buyer.length < 2 || telo.words.length < 5) { kStavNapis('Please fill in your surname and your words and clues (the first box).', 'zle'); return; }
      var tlacidlo = kOprava.querySelector('button[type="submit"]');
      tlacidlo.disabled = true;
      zastav();
      cas('');
      kStavNapis('Building your crossword. This takes about a minute; please keep this page open.');
      fetch(API + '/fix', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(telo) })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.status === 'ready') {
            kOprava.hidden = true;
            zaciatok = Date.now();
            sprava('Your crossword is ready.');
            zisti(telo.order, telo.buyer, null, true, d);
            fokus(out);
            return;
          }
          if (d.status === 'wrong_buyer') kStavNapis('That surname does not match the name on this Etsy order. Type your own surname exactly as it appears on the Etsy receipt. If you ordered it as a gift, or it still does not match, ' + ETSY + ', and we will unlock this form for you.', 'zle');
          else if (d.status === 'already_fixed') kStavNapis('You have already used the one fix for this crossword, so it cannot be built again here. If something is still wrong, ' + ETSY + '.', 'zle');
          else if (d.status === 'words') {
            kStavNapis(dovodSlov(d) + (d.kept ? ' Your current files are unchanged and still work.' : '') + ' Please write 10 to 25 words, one per line, each as WORD: clue (for example PARIS: Where we got engaged), and press Build my crossword again.', 'zle');
          } else if (d.status === 'pending') {
            kStavNapis('This crossword is already being built. It appears above as soon as it is ready.');
            zaciatok = Date.now();
            zisti(telo.order, telo.buyer, null, true);
          } else if (d.status === 'unknown') kStavNapis('We cannot find a crossword waiting for words under this order number anymore. Please press Find my crossword again.', 'zle');
          else if (d.status === 'invalid') kStavNapis('Please check your surname and your words.', 'zle');
          else if (d.kept) kStavNapis('Building your corrected crossword failed, and we have been notified. Your current files are unchanged and still work. Please try again in a few minutes; if it fails again, ' + ETSY + '.', 'zle');
          else kStavNapis('Building your crossword failed, and we have been notified. Please press Build my crossword once more. If it fails again, ' + ETSY + '.', 'zle');
        })
        .catch(function () {
          kStavNapis('We lost the connection while your crossword was being built. Checking where it stands...');
          zaciatok = Date.now();
          casovac = setTimeout(function () { zisti(telo.order, telo.buyer, null, true); }, 5000);
        })
        .then(function () { tlacidlo.disabled = false; });
    });
  }

  /* Adventná hra: počítadlo rôznych čísel úkrytov 1 až 50 pod políčkom (aspoň 12), aby kupujúci videl počet skôr, než odošle. */
  function pocetMiest() {
    if (!aOprava || !aPocet) return 0;
    var cisla = [];
    (String(aOprava.elements.spots.value || '').match(/\d+/g) || []).forEach(function (k) {
      var n = Number(k);
      if (n >= 1 && n <= 50 && cisla.indexOf(n) < 0) cisla.push(n);
    });
    var n = cisla.length;
    var prazdne = !String(aOprava.elements.spots.value || '').trim();
    // prázdne pole = 16 predvolených úkrytov (worker, PREDVOLENE_MIESTA); vyplnené potrebuje aspoň 12 čísel
    aPocet.textContent = prazdne
      ? 'Empty: we use our 16 everyday spots.'
      : n + (n === 1 ? ' different spot' : ' different spots') + ' from the menu so far. A hunt needs at least 12, or leave the box empty.';
    aPocet.className = 'case-tip case-pocet' + (prazdne || n >= 12 ? ' dost' : '');
    return n;
  }
  if (aOprava) {
    aOprava.elements.spots.addEventListener('input', pocetMiest);
    pocetMiest();
    aOprava.addEventListener('submit', function (e) {
      e.preventDefault();
      var telo = {
        order: String(aOprava.elements.order.value || '').replace(/\D/g, ''),
        'case': String(aOprava.elements['case'].value || ''),
        buyer: String(aOprava.elements.buyer.value || '').trim(),
        kids: String(aOprava.elements.kids.value || '').trim(),
        spots: String(aOprava.elements.spots.value || '').trim(),
        letter: String(aOprava.elements.letter.value || ''),
        siblings: String(aOprava.elements.siblings.value || '')
      };
      if (telo.buyer.length < 2 || !telo.kids) { aStavNapis('Please fill in your surname and the children’s names and ages.', 'zle'); return; }
      var tlacidlo = aOprava.querySelector('button[type="submit"]');
      tlacidlo.disabled = true;
      zastav();
      cas('');
      aStavNapis('Building your hunt. This takes about a minute; please keep this page open.');
      fetch(API + '/fix', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(telo) })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.status === 'ready') {
            aOprava.hidden = true;
            zaciatok = Date.now();
            sprava('Your hunt is ready.');
            zisti(telo.order, telo.buyer, null, true, d);
            fokus(out);
            return;
          }
          if (d.status === 'wrong_buyer') aStavNapis('That surname does not match the name on this Etsy order. Type your own surname exactly as it appears on the Etsy receipt, not a child’s name. If you ordered it as a gift, or it still does not match, ' + ETSY + ', and we will unlock this form for you.', 'zle');
          else if (d.status === 'already_fixed') aStavNapis('You have already used the one fix for this hunt, so it cannot be built again here. If something is still wrong, ' + ETSY + '.', 'zle');
          else if (d.status === 'answers') aStavNapis(dovodAdventu(d) + (d.kept ? ' Your current files are unchanged and still work.' : '') + ' Please correct it above and press Build my hunt again.', 'zle');
          else if (d.status === 'pending') {
            aStavNapis('This hunt is already being built. It appears above as soon as it is ready.');
            zaciatok = Date.now();
            zisti(telo.order, telo.buyer, null, true);
          } else if (d.status === 'unknown') aStavNapis('We cannot find a hunt waiting for answers under this order number anymore. Please press Find my hunt again.', 'zle');
          else if (d.status === 'invalid') aStavNapis('Please check your surname and your answers.', 'zle');
          else if (d.kept) aStavNapis('Building your corrected hunt failed, and we have been notified. Your current files are unchanged and still work. Please try again in a few minutes; if it fails again, ' + ETSY + '.', 'zle');
          else aStavNapis('Building your hunt failed, and we have been notified. Please press Build my hunt once more. If it fails again, ' + ETSY + '.', 'zle');
        })
        .catch(function () {
          aStavNapis('We lost the connection while your hunt was being built. Checking where it stands...');
          zaciatok = Date.now();
          casovac = setTimeout(function () { zisti(telo.order, telo.buyer, null, true); }, 5000);
        })
        .then(function () { tlacidlo.disabled = false; });
    });
  }

  /* Voľba produktu: odkaz /case/?p=crossword alebo ?p=advent (zo súboru Start here) ju predvolí; zmena voľby vyčistí výsledok. */
  var volby = form.querySelectorAll('input[name="produkt"]');
  var zOdkazu = (location.search.match(/[?&]p=(crossword|advent)\b/) || [])[1] || (location.hash === '#crossword' ? 'crossword' : location.hash === '#advent' ? 'advent' : '');
  for (var i = 0; i < volby.length; i++) {
    if (zOdkazu && volby[i].value === zOdkazu) volby[i].checked = true;
    volby[i].addEventListener('change', function () {
      zastav();
      cas('');
      podpis = '';
      out.className = 'case-vysledok';
      out.textContent = '';
      skryOpravy(null);
      nastavVolbu();
    });
  }
  nastavVolbu();
})();
