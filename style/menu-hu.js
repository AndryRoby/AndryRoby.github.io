/* ARLing: plný katalóg v menu a päte (hu). Vyrobil ops/design/menu-skript.mjs z ops/design/uvod-katalog.mjs,
   ručne needitovať. Stránka má bez JS statickú náhradu (skupiny, stránka Všetko, Firma, tlačidlo);
   tento skript do stĺpcov skupín vloží plný katalóg a k odkazu Všetko počet položiek.
   Načítava sa s defer; panel menu je zatvorený, takže vloženie do menu nič neposunie.
   Päta sa rozvinie len vtedy, keď jej stĺpce ešte nie sú v obraze (dlhá stránka): vtedy sa pohne
   len to, čo človek nevidí, a posun rozloženia (CLS) je nula. Na krátkej stránke (404, kontakt),
   kde je päta v obraze hneď, ostane statická náhrada, ktorá vedie na každú skupinu a na stránku Všetko;
   keď ju neskôr obsah kreslený v JS odsunie pod obraz, rozvinie sa tiež. Otvorené menu sa neprepisuje,
   katalóg doň príde po zatvorení. */
(function () {
  'use strict';
  var menu = {
 "firmy": "<p>Cégek és könyvelők <em class=\"site-sk\">EN</em></p><ul><li><a href=\"https://arling.sk/super-intelligence/\"><b>AI to SI Checker</b><span>Az AI szót SI-re cseréli, a törvények címét meghagyja</span></a></li><li><a href=\"https://arling.sk/rukopis/en/\"><b>Rukopis</b><span>Megtalálja a sablonos fordulatokat a szövegében</span></a></li><li><a href=\"https://arling.sk/efaktura/en/\"><b>E-számla</b><span>Ellenőrzés, előnézet és XML készítése</span></a></li><li><a href=\"https://arling.sk/kontrola-suboru/en/\"><b>SEPA-fájl ellenőrzése</b><span>Címek és hibák, mielőtt a bank látná őket</span></a></li><li><a href=\"https://arling.sk/bankove-nastroje/en/\"><b>Banki eszközök Pro</b><span>Egy licenc, három eszköz</span></a></li></ul><a class=\"site-col-all\" href=\"https://arling.sk/vsetko/en/#firmy\" aria-label=\"A teljes csoport: Cégek és könyvelők (14)\" data-umami-event=\"shell_menu_group\" data-umami-event-target=\"firmy\"><span class=\"site-dlho\">A teljes csoport</span><span class=\"site-kratko\">Mind</span><b>14</b><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 12h13M13 6l6 6-6 6\"/></svg></a>",
 "eshopy": "<p>Webshopok és weboldalak <em class=\"site-sk\">EN</em></p><ul><li><a href=\"https://arling.sk/asistent/en/\"><b>Asistent</b><span>Értékesítési asszisztens webshopokhoz</span></a></li><li><a href=\"https://arling.sk/technologies/\"><b>Stacklog</b><span>Min fut egy weboldal, és mikor változott</span></a></li><li><a href=\"https://arling.sk/mail-doctor/\"><b>Mail Doctor</b><span>Egy domain SPF, DKIM és DMARC beállításai</span></a></li><li><a href=\"https://arling.sk/feed-doctor/en/\"><b>Feed Doctor</b><span>Termékfeed ellenőrzése</span></a></li></ul><a class=\"site-col-all\" href=\"https://arling.sk/vsetko/en/#eshopy\" aria-label=\"A teljes csoport: Webshopok és weboldalak (8)\" data-umami-event=\"shell_menu_group\" data-umami-event-target=\"eshopy\"><span class=\"site-dlho\">A teljes csoport</span><span class=\"site-kratko\">Mind</span><b>8</b><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 12h13M13 6l6 6-6 6\"/></svg></a>",
 "hry": "<p>Játékok és rejtvények <em class=\"site-sk\">EN</em></p><ul><li><a href=\"https://arling.sk/shop/escape-room-kids/\"><b>A sárkány, aki a kulcson aludt</b><span>Nyomtatható szabadulós játék 7 és 10 év közötti gyerekeknek, 7,90 €</span></a></li><li><a href=\"https://arling.sk/shop/escape-room-adults/\"><b>Az órásmester műhelye</b><span>Nyomtatható szabadulós játék felnőtteknek, 9,90 €</span></a></li><li><a href=\"https://arling.sk/shop/advent-treasure-hunt/\"><b>Advent treasure hunt<em class=\"site-nove\">Új</em></b><span>Adventi kincskeresés a gyerekei nevével, 11,90 € az Etsyn</span></a></li><li><a href=\"https://arling.sk/shop/advent-escape-room/\"><b>The Clock Tower Star</b><span>Szabadulós adventi naptár 6 és 10 év közötti gyerekeknek, 7,90 € az Etsyn</span></a></li><li><a href=\"https://arling.sk/shop/christmas-friends-as-witnesses/\"><b>Christmas murder mystery</b><span>Nyomtatható karácsonyi krimi a barátai nevével, 12,90 € az Etsyn</span></a></li></ul><a class=\"site-col-all\" href=\"https://arling.sk/vsetko/en/#hry\" aria-label=\"A teljes csoport: Játékok és rejtvények (25)\" data-umami-event=\"shell_menu_group\" data-umami-event-target=\"hry\"><span class=\"site-dlho\">A teljes csoport</span><span class=\"site-kratko\">Mind</span><b>25</b><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 12h13M13 6l6 6-6 6\"/></svg></a>",
 "knihy": "<p>Könyvek és ajándékok <em class=\"site-sk\">EN</em></p><ul><li><a href=\"https://arling.sk/shop/budget-2027/\"><b>Költségvetés 2027</b><span>Táblázat Excelhez és Google Sheetshez, 9,90 €</span></a></li><li><a href=\"https://arling.sk/shop/\"><b>Bolt</b><span>Könyvek, rejtvények és ajándékok</span></a></li><li><a href=\"https://arling.sk/puzzle-books/eink-bundle/\"><b>E-ink rejtvénycsomag</b><span>3000 rejtvény tíz könyvben</span></a></li><li><a href=\"https://arling.sk/classics/monte-cristo/drawn/\"><b>Monte Cristo képekben</b><span>Jelenetek a regényből, kóddal rajzolva</span></a></li><li><a href=\"https://arling.sk/world/\"><b>The World in Squares</b><span>Vegyen egy négyzetet a világtérképből, nevezze el, és rajzoljon bele</span></a></li></ul><a class=\"site-col-all\" href=\"https://arling.sk/vsetko/en/#knihy\" aria-label=\"A teljes csoport: Könyvek és ajándékok (15)\" data-umami-event=\"shell_menu_group\" data-umami-event-target=\"knihy\"><span class=\"site-dlho\">A teljes csoport</span><span class=\"site-kratko\">Mind</span><b>15</b><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 12h13M13 6l6 6-6 6\"/></svg></a>"
};
  var pata = {
 "firmy": "<p>Cégek és könyvelők</p><ul><li><a href=\"https://arling.sk/super-intelligence/\">AI to SI Checker<em class=\"site-sk\">EN</em></a></li><li><a href=\"https://arling.sk/rukopis/en/\">Rukopis<em class=\"site-sk\">EN</em></a></li><li><a href=\"https://arling.sk/efaktura/en/\">E-számla<em class=\"site-sk\">EN</em></a></li><li><a href=\"https://arling.sk/kontrola-suboru/en/\">SEPA-fájl ellenőrzése<em class=\"site-sk\">EN</em></a></li><li><a href=\"https://arling.sk/bankove-nastroje/en/\">Banki eszközök Pro<em class=\"site-sk\">EN</em></a></li><li><a href=\"https://arling.sk/proof/\">Proof<em class=\"site-sk\">EN</em></a></li><li><a href=\"https://arling.sk/renewals/\">Renewals<em class=\"site-sk\">EN</em></a></li><li><a href=\"https://arling.sk/parovac-platieb/en/\">Fizetéspárosító<em class=\"site-sk\">EN</em></a></li><li><a href=\"https://arling.sk/sepa-pain001-doctor/en/\">pain.001 ellenőrzés<em class=\"site-sk\">EN</em></a></li><li><a href=\"https://arling.sk/sepa-pain001-generator/en/\">pain.001 generátor<em class=\"site-sk\">EN</em></a></li><li><a href=\"https://arling.sk/camt053-to-excel/en/\">Kivonat Excelbe<em class=\"site-sk\">EN</em></a></li><li><a href=\"https://arling.sk/vzory-zmluv/\">Szerződésminták<em class=\"site-sk\">SK</em></a></li><li><a href=\"https://arling.sk/zivotopis/en/\">Önéletrajz<em class=\"site-sk\">EN</em></a></li><li><a href=\"https://arling.sk/sanctions-check/\">Uniós szankciós ellenőrzés<em class=\"site-sk\">EN</em></a></li></ul>",
 "eshopy": "<p>Webshopok és weboldalak</p><ul><li><a href=\"https://arling.sk/web/\">Gyors weboldal kisvállalkozásnak<em class=\"site-sk\">SK</em></a></li><li><a href=\"https://arling.sk/rychlost-webu/\">Website speed check<em class=\"site-sk\">SK</em></a></li><li><a href=\"https://arling.sk/asistent/en/\">Asistent<em class=\"site-sk\">EN</em></a></li><li><a href=\"https://arling.sk/gdpr-dokumenty/\">GDPR-dokumentumok<em class=\"site-sk\">SK</em></a></li><li><a href=\"https://arling.sk/kontrola-eshopu/\">Webshop-ellenőrzés<em class=\"site-sk\">SK</em></a></li><li><a href=\"https://arling.sk/technologies/\">Stacklog<em class=\"site-sk\">EN</em></a></li><li><a href=\"https://arling.sk/mail-doctor/\">Mail Doctor<em class=\"site-sk\">EN</em></a></li><li><a href=\"https://arling.sk/feed-doctor/en/\">Feed Doctor<em class=\"site-sk\">EN</em></a></li></ul>",
 "hry": "<p>Játékok és rejtvények <em class=\"site-sk\">EN</em></p><ul><li><a href=\"https://arling.sk/games/\">Böngészős játékok</a></li><li><a href=\"https://arling.sk/shop/detective-kit-2/\">Sáros lábnyomok</a></li><li><a href=\"https://arling.sk/shop/escape-room-kids/\">A sárkány, aki a kulcson aludt</a></li><li><a href=\"https://arling.sk/shop/escape-room-adults/\">Az órásmester műhelye</a></li><li><a href=\"https://arling.sk/shop/mystery-case-adults/\">Az ashgrove-i gém</a></li><li><a href=\"https://arling.sk/play/stop/\">Stop at the right frame</a></li><li><a href=\"https://arling.sk/games/owls/\">Owls</a></li><li><a href=\"https://arling.sk/games/beavers/\">Beavers</a></li><li><a href=\"https://arling.sk/games/foxes/\">Foxes</a></li><li><a href=\"https://arling.sk/games/field-notes/\">Field Notes</a></li><li><a href=\"https://arling.sk/shop/detective-kit/\">Nyomozós játék gyerekeknek</a></li><li><a href=\"https://arling.sk/shop/pumpkin-escape-kids/\">Tökvásári kalamajka</a></li><li><a href=\"https://arling.sk/shop/murder-lantern-ball/\">Murder at the Lantern Ball</a></li><li><a href=\"https://arling.sk/shop/your-friends-as-witnesses/\">Your friends as witnesses</a></li><li><a href=\"https://arling.sk/shop/custom-crossword/\">Custom crossword</a></li><li><a href=\"https://arling.sk/shop/advent-treasure-hunt/\">Advent treasure hunt</a></li><li><a href=\"https://arling.sk/shop/advent-escape-room/\">The Clock Tower Star</a></li><li><a href=\"https://arling.sk/shop/christmas-friends-as-witnesses/\">Christmas murder mystery</a></li><li><a href=\"https://arling.sk/play/\">Androidos játékok</a></li><li><a href=\"https://arling.sk/games/village/\">Puzzle Village</a></li><li><a href=\"https://arling.sk/games/escape/lighthouse/\">Grandpa's Lighthouse</a></li><li><a href=\"https://arling.sk/puzzle-video/\">Rejtvényvideó</a></li><li><a href=\"https://arling.sk/puzzle-studio/\">Puzzle Studio</a></li><li><a href=\"https://arling.sk/puzzle-post/bulletin/\">Puzzle Post Bulletin</a></li><li><a href=\"https://arling.sk/puzzle-publisher/\">Kiadói csomag</a></li></ul>",
 "knihy": "<p>Könyvek és ajándékok <em class=\"site-sk\">EN</em></p><ul><li><a href=\"https://arling.sk/shop/budget-2027/\">Költségvetés 2027</a></li><li><a href=\"https://arling.sk/shop/\">Bolt</a></li><li><a href=\"https://arling.sk/puzzle-books/eink-bundle/\">E-ink rejtvénycsomag</a></li><li><a href=\"https://arling.sk/classics/monte-cristo/drawn/\">Monte Cristo képekben</a></li><li><a href=\"https://arling.sk/world/\">The World in Squares</a></li><li><a href=\"https://arling.sk/printables/\">Nyomtatnivalók évszakonként</a></li><li><a href=\"https://arling.sk/puzzle-books/\">Rejtvénykönyvek</a></li><li><a href=\"https://arling.sk/puzzle-books/halloween-logic-puzzle-book/\">Halloweeni rejtvénykönyv</a></li><li><a href=\"https://arling.sk/puzzle-books/logic-puzzle-bundle-200/\">Logikai rejtvénycsomag</a></li><li><a href=\"https://arling.sk/puzzle-books/christmas-logic-puzzle-book/\">Karácsonyi rejtvénykönyv</a></li><li><a href=\"https://arling.sk/puzzle-books/printable-puzzle-advent-calendar-2026-48-christmas-logic/\">Adventi rejtvénynaptár 2026</a></li><li><a href=\"https://arling.sk/classics/\">Klasszikusok e-inkre</a></li><li><a href=\"https://arling.sk/morning-quiet/\">Morning Quiet</a></li><li><a href=\"https://arling.sk/puzzle-post/\">Puzzle Post</a></li><li><a href=\"https://arling.sk/memory-post/\">Memory Post</a></li></ul>"
};
  var vyvojari = "<span>Fejlesztőknek</span><a href=\"https://arling.sk/cors-doctor/\">CORS</a><a href=\"https://arling.sk/jwt-doctor/\">JWT</a><a href=\"https://arling.sk/cookie-samesite-doctor/\">Cookie SameSite</a><a href=\"https://arling.sk/redirect-loop-doctor/\">Redirect loop</a><a href=\"https://arling.sk/stripe-webhook-doctor/\">Stripe webhook</a><a href=\"https://arling.sk/firebase-auth-domain-doctor/\">Firebase auth</a><a href=\"https://arling.sk/google-oauth-redirect-doctor/\">Google OAuth</a><a href=\"https://arling.sk/supabase-redirect-doctor/\">Supabase redirect</a><a href=\"https://arling.sk/flutter-supabase-doctor/\">Flutter + Supabase</a><a href=\"https://arling.sk/expo-universal-links-doctor/\">Expo links</a><a href=\"https://arling.sk/expo-supabase-auth-doctor/\">Expo + Supabase</a><a href=\"https://arling.sk/api/\">Puzzle API</a><a href=\"https://arling.sk/motion/\">Motion components</a>";
  var pocet = "75";
  function vloz(obsah, prvky) {
    for (var i = 0; i < prvky.length; i++) {
      var html = obsah[prvky[i].getAttribute('data-skupina')];
      if (typeof html === 'string') prvky[i].innerHTML = html;
    }
  }
  function pocitadlo(a) {
    if (!a || a.querySelector('b')) return;
    var sipka = a.querySelector('svg');
    if (sipka) sipka.insertAdjacentHTML('beforebegin', '<b>' + pocet + '</b>');
    else a.insertAdjacentHTML('beforeend', '<b>' + pocet + '</b>');
  }
  function podObrazom(prvok) {
    var vyska = window.innerHeight || document.documentElement.clientHeight || 0;
    try { return prvok.getBoundingClientRect().top >= vyska; } catch (e) { return true; }
  }
  function naplnMenu() {
    vloz(menu, document.querySelectorAll('header.site-header .site-col[data-skupina]'));
    pocitadlo(document.querySelector('header.site-header .site-all a'));
  }
  // Otvorené menu (otvorenie myšou pred dobehnutím skriptu) sa neprepisuje: obsah by sa posunul
  // a fokus by spadol na body. Plný katalóg príde, keď sa panel zatvorí (zatvorený panel nemá
  // viditeľný obsah ani fokus vo vnútri).
  function menuPouziva(d) {
    return !!(d && d.open);
  }
  function rozvinPatu(stlpce) {
    vloz(pata, stlpce.querySelectorAll('[data-skupina]'));
    pocitadlo(document.querySelector('footer.site-footer .site-all a'));
    var dev = document.querySelector('footer.site-footer [data-site-vyvojari]');
    if (dev) { dev.innerHTML = vyvojari; dev.className = 'site-dev site-dev-zoznam'; }
  }
  // Lighthouse 28. 9. 2026: synchrónne meranie päty (getBoundingClientRect) pri DOMContentLoaded
  // vynútilo prvé rozloženie celej stránky v úlohe skriptu (menu-sk.js 400 až 520 ms blokovania na
  // /notes/ a /asistent/). Preto: katalóg menu až v nečinnosti alebo pri prvom priblížení k tlačidlu
  // Menu (dotyk, myš, fokus prídu pred otvorením), päta len cez IntersectionObserver (meria prehliadač
  // pri svojom vykreslení). Bez týchto API (starý prehliadač, testy) ostáva pôvodná synchrónna cesta.
  var naplnene = false;
  function naplnRaz() { if (naplnene) return; naplnene = true; naplnMenu(); }
  function spusti() {
    var d = document.querySelector('header.site-header details.site-menu');
    if (menuPouziva(d) && typeof d.addEventListener === 'function') {
      var cakaj = function () {
        if (d.open) return;
        d.removeEventListener('toggle', cakaj);
        naplnRaz();
      };
      d.addEventListener('toggle', cakaj);
    } else if (typeof window.requestIdleCallback === 'function' && d && typeof d.addEventListener === 'function') {
      var s = d.querySelector('summary') || d;
      s.addEventListener('pointerenter', naplnRaz);
      s.addEventListener('touchstart', naplnRaz, { passive: true });
      s.addEventListener('focusin', naplnRaz);
      window.requestIdleCallback(naplnRaz, { timeout: 3000 });
    } else naplnRaz();
    var stlpce = document.querySelector('footer.site-footer .site-foot-cols');
    if (!stlpce) return;
    // Päta sa rozvinie, len keď je pod spodným okrajom obrazovky (žiadny viditeľný posun). Na krátkej
    // stránke alebo pri obsahu, ktorý kreslí až JS, sa rozvinie neskôr, keď ju obsah odsunie dole.
    var IO = window.IntersectionObserver;
    if (typeof IO !== 'function') { if (podObrazom(stlpce)) rozvinPatu(stlpce); return; }
    var pozor = new IO(function (zaznamy) {
      for (var i = 0; i < zaznamy.length; i++) {
        var z = zaznamy[i];
        var vyska = window.innerHeight || document.documentElement.clientHeight || 0;
        if (!z.isIntersecting && z.boundingClientRect.top >= vyska) {
          pozor.disconnect();
          rozvinPatu(stlpce);
          return;
        }
      }
    });
    pozor.observe(stlpce);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', spusti);
  else spusti();
})();
