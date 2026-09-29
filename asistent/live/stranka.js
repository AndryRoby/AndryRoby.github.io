/* Vzhľad a texty živej ukážky (28. 9. 2026, druhý Claude). live.js ostáva logikou ukážky (widget,
   otázky na jedno ťuknutie, slovníky T a Q); tento súbor beží po ňom a dopĺňa len stránku okolo:
   nadpis s názvom obchodu, texty nových sekcií v jazyku prehliadača (rovnaké pravidlo ako live.js:
   sk, cs, de, inak en) a odkaz na formulár zapnutia podľa jazyka (nemčina vedie na anglický formulár
   a povie to, čeština na slovenský; brána 28. 9., nález 6). Okno rozhovoru je skutočný widget vložený
   do stránky (live.js, data-mount), vlastné pole na otázku má v sebe. Nič neodosiela, nič neukladá.
   Ceny a čas sú z hlavnej stránky Asistenta (asistent/index.html: meta, cenník, otázky). */
(function () {
  var q = new URLSearchParams(location.search);
  var tenant = (q.get('t') || '').replace(/[^A-Za-z0-9-]/g, '');
  // Meno obchodu len overené workerom (live.js, udalosť arling-live:obchod), nikdy z odkazu
  // (bezpečnostná kontrola 29. 9. 2026, nález 4).
  var shop = '';
  var nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
  var lang = ['sk', 'cs', 'de', 'en'].indexOf(nav) >= 0 ? nav : 'en';

  var V = {
    sk: {
      kicker: 'Živá ukážka ARLing Asistenta',
      h1: ['Asistent pre ', ' je pripravený'], h1Bez: 'Váš Asistent je pripravený', h1Chyba: 'Tento odkaz na ukážku nie je celý', h1Nepovolena: 'Túto ukážku tu nevieme ukázať',
      titul: 'Asistent pre {shop}: živá ukážka', titulBez: 'Živá ukážka ARLing Asistenta',
      oknoPod: 'Odpovedá z produktov obchodu',
      heroPozn: 'Feed a e-mail, potom vložíte riadok kódu.',
      shotPopis: 'Skutočná odpoveď ukážkového obchodu Dobrá domácnosť z 28. 9. 2026 v súčasnom okne Asistenta',
      shotAlt: 'Snímka chatu v ukážkovom obchode Dobrá domácnosť. Zákazník píše: Chcem si robiť cappuccino doma. Ktorý kávovar má parnú trysku na mlieko? Asistent ponúkne automatický kávovar Orava Uno s mlynčekom za 249 EUR a pákový kávovar Orava 15 bar za 189 EUR, pod odpoveďou sú ich dve karty produktov.',
            cenaHero: '<b>Zadarmo do 100 rozhovorov mesačne.</b> Potom od 19&nbsp;€ mesačne. Bez karty, zrušíte kedykoľvek.',
      akoZapnut: 'Ako ho zapnete', chybaCta: 'Vyskúšať na vlastnom feede', chybaUkazka: 'Opýtať sa v ukážkovom obchode',
      fakt1: 'WooCommerce · Shoptet · Upgates · Shopify', fakt2: 'SK · CS · EN · DE',
      krokyH2: 'Na vašom webe za 10 minút',
      krokySub: 'Produkty si Asistent berie z feedu, ktorý váš e-shop už má, a sám ich z neho obnovuje.',
      k1cas: 'pár minút', k1h: 'Feed a e-mail',
      k1p: 'Vložíte adresu produktového feedu a e-mail. Heureka a Zboží.cz XML, Google Nákupy, Shopify, WooCommerce aj bežný XML, najviac 5 000 produktov.',
      k2cas: 'jeden riadok', k2h: 'Jeden riadok kódu',
      k2p: 'Vložíte ho pred <code>&lt;/body&gt;</code> alebo ako HTML kód v administrácii Shoptetu či Upgates. Na WooCommerce stačí doplnok z wordpress.org.',
      riadokAria: 'Ukážka riadku kódu',
      k3cas: 'hneď', k3h: 'Hotovo', k3p: 'Okienko vpravo dole odpovedá vašimi produktmi, s cenou a odkazom na kartu.',
      k3cena: '<b>0 €</b> do 100 rozhovorov mesačne<br><b>19 €</b> mesačne do 1 000 · <b>39 €</b> do 3 000',
      viditeH2: 'Čo uvidia zákazníci a čo vy',
      v1h: 'Zákazník', v1p: 'Okienko v rohu stránky. Odpoveď príde v jazyku, v ktorom píše, a pod ňou karty najviac troch vašich produktov s cenou a odkazom. Keď tovar nemáte, povie to.',
      v2h: 'Vy', v2p: 'Stránku účtu s počtom rozhovorov v mesiaci, počtom produktov v indexe, posledným obnovením feedu a plánom. Plán zmeníte cez Stripe, zrušíte kedykoľvek.',
      v3h: 'E-mail', v3p: 'Po vytvorení vám príde váš riadok kódu a návod na zapojenie. Najviac štyri e-maily, každý s odkazom na zastavenie.',
      s1Popis: 'Píše po anglicky, odpoveď príde po anglicky',
      s1Alt: 'Zákazník píše po anglicky: Do you have a small gift for my grandmother? Asistent odpovie po anglicky a ponúkne darčekovú sadu medu za 24.90 EUR a darčekový box bylinkových čajov za 21.90 EUR, s kartami produktov.',
      s2Popis: 'Tovar, ktorý obchod nemá: povie to a odkáže na kontakt',
      s2Alt: 'Zákazník sa pýta: Máte aj mikrovlnnú rúru? Asistent odpovie, že o mikrovlnnej rúre v katalógu nemá informáciu, a odkáže na e-mail obchodu. Karty produktov nie sú žiadne.',
      snimkyZdroj: 'Skutočné odpovede ukážkového obchodu Dobrá domácnosť z 28. 9. 2026, zobrazené v súčasnom okne Asistenta.',
      poctivoH2: 'Čo je dobré vedieť',
      p1h: 'Odpovedá z verejného feedu',
      p1p: 'Pozná len produkty z verejného zoznamu vášho obchodu. Názov, cena a odkaz na karte idú priamo z feedu, nie z textu, ktorý napíše AI.',
      p1pShop: 'Táto ukážka pozná len produkty z verejného zoznamu obchodu {shop}. Názov, cena a odkaz na karte idú priamo z feedu, nie z textu, ktorý napíše AI.',
      p2h: 'Nič sa neukladá', p2p: 'Obsah rozhovoru sa nikde neukladá, ani u nás, ani v databáze. Počítame len, koľko rozhovorov a kliknutí na produkt sa za deň udialo.',
      p3h: 'Môže sa pomýliť', p3p: 'Na vlastné otázky odpovedá AI, pri opakovaní sa odpovede môžu trochu líšiť a môže sa pomýliť aj vo výbere produktu. Pri otázke „do 30 €“ môže ponúknuť aj drahší. Pripravené otázky v tejto ukážke majú vopred skontrolované, uložené odpovede.',
      zaverH2: 'Zapnite Asistenta na svojom e-shope', zaverH2Shop: 'Zapnite Asistenta na {shop}',
      zaverSub: 'Vlastný účet s vaším feedom. Zadarmo do 100 rozhovorov mesačne, bez platobnej karty.',
      zaverCta: 'Zapnúť Asistenta zadarmo', zaverPozn: 'Otvorí formulár: adresa feedu a e-mail. Riadok kódu dostanete hneď potom.',
      kontaktFirma: 'ARLing s. r. o., Bratislava. Radi ho zapneme spolu s vami.',
      odkazZapnut: 'https://arling.sk/asistent/#playground'
    },
    cs: {
      kicker: 'Živá ukázka ARLing Asistenta',
      h1: ['Asistent pro ', ' je připravený'], h1Bez: 'Váš Asistent je připravený', h1Chyba: 'Tento odkaz na ukázku není celý', h1Nepovolena: 'Tuto ukázku tu neumíme zobrazit',
      titul: 'Asistent pro {shop}: živá ukázka', titulBez: 'Živá ukázka ARLing Asistenta',
      oknoPod: 'Odpovídá z produktů obchodu',
      heroPozn: 'Feed a e-mail, potom vložíte řádek kódu. Formulář je ve slovenštině.',
      shotPopis: 'Skutečná odpověď ukázkového obchodu Dobrá domácnosť z 28. 9. 2026 v současném okně Asistenta',
      shotAlt: 'Snímek chatu v ukázkovém obchodě Dobrá domácnosť. Zákazník píše slovensky, že si chce dělat cappuccino doma, a ptá se na kávovar s parní tryskou. Asistent nabídne automatický kávovar Orava Uno s mlýnkem za 249 EUR a pákový kávovar Orava 15 bar za 189 EUR, pod odpovědí jsou jejich dvě karty produktů.',
      cenaHero: '<b>Zdarma do 100 konverzací měsíčně.</b> Potom od 19&nbsp;€ měsíčně. Bez karty, zrušíte kdykoli.',
      akoZapnut: 'Jak ho zapnete', chybaCta: 'Vyzkoušet na vlastním feedu', chybaUkazka: 'Zeptat se v ukázkovém obchodě',
      fakt1: 'WooCommerce · Shoptet · Upgates · Shopify', fakt2: 'SK · CS · EN · DE',
      krokyH2: 'Na vašem webu za 10 minut',
      krokySub: 'Produkty si Asistent bere z feedu, který váš e-shop už má, a sám je z něj obnovuje.',
      k1cas: 'pár minut', k1h: 'Feed a e-mail',
      k1p: 'Vložíte adresu produktového feedu a e-mail. Heureka a Zboží.cz XML, Google Nákupy, Shopify, WooCommerce i běžné XML, nejvýše 5 000 produktů.',
      k2cas: 'jeden řádek', k2h: 'Jeden řádek kódu',
      k2p: 'Vložíte ho před <code>&lt;/body&gt;</code> nebo jako HTML kód v administraci Shoptetu či Upgates. Na WooCommerce stačí doplněk z wordpress.org.',
      riadokAria: 'Ukázka řádku kódu',
      k3cas: 'hned', k3h: 'Hotovo', k3p: 'Okénko vpravo dole odpovídá vašimi produkty, s cenou a odkazem na kartu.',
      k3cena: '<b>0 €</b> do 100 konverzací měsíčně<br><b>19 €</b> měsíčně do 1 000 · <b>39 €</b> do 3 000',
      viditeH2: 'Co uvidí zákazníci a co vy',
      v1h: 'Zákazník', v1p: 'Okénko v rohu stránky. Odpověď přijde v jazyce, ve kterém píše, a pod ní karty nejvýše tří vašich produktů s cenou a odkazem. Když zboží nemáte, řekne to.',
      v2h: 'Vy', v2p: 'Stránku účtu s počtem konverzací v měsíci, počtem produktů v indexu, posledním obnovením feedu a plánem. Plán změníte přes Stripe, zrušíte kdykoli.',
      v3h: 'E-mail', v3p: 'Po vytvoření vám přijde váš řádek kódu a návod na zapojení. Nejvýše čtyři e-maily, každý s odkazem na zastavení.',
      s1Popis: 'Píše anglicky, odpověď přijde anglicky',
      s1Alt: 'Zákazník píše anglicky: Do you have a small gift for my grandmother? Asistent odpoví anglicky a nabídne dárkovou sadu medu za 24.90 EUR a dárkový box bylinkových čajů za 21.90 EUR, s kartami produktů.',
      s2Popis: 'Zboží, které obchod nemá: řekne to a odkáže na kontakt',
      s2Alt: 'Zákazník se slovensky ptá, zda obchod má i mikrovlnnou troubu. Asistent odpoví, že o mikrovlnné troubě v katalogu nemá informaci, a odkáže na e-mail obchodu. Karty produktů nejsou žádné.',
      snimkyZdroj: 'Skutečné odpovědi ukázkového obchodu Dobrá domácnosť z 28. 9. 2026, zobrazené v současném okně Asistenta.',
      poctivoH2: 'Co je dobré vědět',
      p1h: 'Odpovídá z veřejného feedu',
      p1p: 'Zná jen produkty z veřejného seznamu vašeho obchodu. Název, cena a odkaz na kartě jdou přímo z feedu, ne z textu, který napíše AI.',
      p1pShop: 'Tato ukázka zná jen produkty z veřejného seznamu obchodu {shop}. Název, cena a odkaz na kartě jdou přímo z feedu, ne z textu, který napíše AI.',
      p2h: 'Nic se neukládá', p2p: 'Obsah konverzace se nikde neukládá, ani u nás, ani v databázi. Počítáme jen, kolik konverzací a kliknutí na produkt za den proběhlo.',
      p3h: 'Může se splést', p3p: 'Na vlastní otázky odpovídá AI, při opakování se odpovědi mohou trochu lišit a může se splést i ve výběru produktu. U otázky „do 30 €“ může nabídnout i dražší. Připravené otázky v této ukázce mají předem zkontrolované, uložené odpovědi.',
      zaverH2: 'Zapněte Asistenta na svém e-shopu', zaverH2Shop: 'Zapněte Asistenta na {shop}',
      zaverSub: 'Vlastní účet s vaším feedem. Zdarma do 100 konverzací měsíčně, bez platební karty.',
      zaverCta: 'Zapnout Asistenta zdarma', zaverPozn: 'Otevře formulář ve slovenštině: adresa feedu a e-mail. Řádek kódu dostanete hned potom.',
      kontaktFirma: 'ARLing s. r. o., Bratislava. Rádi ho zapneme spolu s vámi.',
      odkazZapnut: 'https://arling.sk/asistent/#playground'
    },
    de: {
      kicker: 'Live-Demo von ARLing Shopping Assistant',
      h1: ['Der Assistent für ', ' ist bereit'], h1Bez: 'Ihr Assistent ist bereit', h1Chyba: 'Dieser Demo-Link ist nicht vollständig', h1Nepovolena: 'Diese Demo können wir hier nicht zeigen',
      titul: 'Assistent für {shop}: Live-Demo', titulBez: 'Live-Demo von ARLing Shopping Assistant',
      oknoPod: 'Antwortet aus den Produkten des Shops',
      heroPozn: 'Feed und E-Mail, dann eine Zeile Code einfügen. Das Formular ist auf Englisch.',
      shotPopis: 'Echte Antwort des Demo-Shops Dobrá domácnosť vom 28. 9. 2026 im aktuellen Fenster des Assistenten',
      shotAlt: 'Chat im Demo-Shop Dobrá domácnosť. Ein Kunde schreibt auf Slowakisch, dass er zu Hause Cappuccino machen möchte, und fragt nach einer Kaffeemaschine mit Milchdüse. Der Assistent schlägt den Kaffeevollautomaten Orava Uno mit Mahlwerk für 249 EUR und die Siebträgermaschine Orava 15 bar für 189 EUR vor, darunter ihre zwei Produktkarten.',
      cenaHero: '<b>Kostenlos bis 100 Gespräche im Monat.</b> Danach ab 19&nbsp;€ im Monat. Ohne Karte, jederzeit kündbar.',
      akoZapnut: 'So schalten Sie ihn ein', chybaCta: 'Mit eigenem Feed testen', chybaUkazka: 'Im Demo-Shop fragen',
      fakt1: 'WooCommerce · Shoptet · Upgates · Shopify', fakt2: 'SK · CS · EN · DE',
      krokyH2: 'In 10 Minuten auf Ihrer Website',
      krokySub: 'Der Assistent nimmt die Produkte aus dem Feed, den Ihr Shop schon hat, und aktualisiert sie daraus selbst.',
      k1cas: 'einige Minuten', k1h: 'Feed und E-Mail',
      k1p: 'Sie geben die Adresse Ihres Produktfeeds und eine E-Mail an. Heureka und Zboží.cz XML, Google Shopping, Shopify, WooCommerce und allgemeines XML, höchstens 5 000 Produkte.',
      k2cas: 'eine Zeile', k2h: 'Eine Zeile Code',
      k2p: 'Sie fügen sie vor <code>&lt;/body&gt;</code> ein oder als HTML-Code in der Verwaltung von Shoptet oder Upgates. Für WooCommerce genügt das Plugin von wordpress.org.',
      riadokAria: 'Beispiel der Codezeile',
      k3cas: 'sofort', k3h: 'Fertig', k3p: 'Das Fenster unten rechts antwortet mit Ihren Produkten, mit Preis und Link zur Produktseite.',
      k3cena: '<b>0 €</b> bis 100 Gespräche im Monat<br><b>19 €</b> im Monat bis 1 000 · <b>39 €</b> bis 3 000',
      viditeH2: 'Was Ihre Kunden sehen und was Sie sehen',
      v1h: 'Kunde', v1p: 'Ein Fenster in der Ecke der Seite. Die Antwort kommt in der Sprache, in der er schreibt, darunter Karten mit höchstens drei Ihrer Produkte mit Preis und Link. Wenn Sie etwas nicht führen, sagt er es.',
      v2h: 'Sie', v2p: 'Eine Kontoseite mit der Zahl der Gespräche im Monat, der Zahl der Produkte im Index, der letzten Feed-Aktualisierung und Ihrem Plan. Den Plan ändern Sie über Stripe, jederzeit kündbar.',
      v3h: 'E-Mail', v3p: 'Nach dem Anlegen bekommen Sie Ihre Codezeile und eine Anleitung zum Einbinden. Höchstens vier E-Mails, jede mit einem Link zum Abbestellen.',
      s1Popis: 'Schreibt auf Englisch, die Antwort kommt auf Englisch',
      s1Alt: 'Ein Kunde schreibt auf Englisch: Do you have a small gift for my grandmother? Der Assistent antwortet auf Englisch und bietet ein Honig-Geschenkset für 24.90 EUR und eine Kräutertee-Geschenkbox für 21.90 EUR an, mit Produktkarten.',
      s2Popis: 'Ware, die der Shop nicht führt: er sagt es und verweist auf den Kontakt',
      s2Alt: 'Ein Kunde fragt auf Slowakisch, ob der Shop auch eine Mikrowelle hat. Der Assistent antwortet, dass er im Katalog keine Information zu einer Mikrowelle hat, und verweist auf die E-Mail des Shops. Keine Produktkarten.',
      snimkyZdroj: 'Echte Antworten des Demo-Shops Dobrá domácnosť vom 28. 9. 2026, im aktuellen Fenster des Assistenten.',
      poctivoH2: 'Gut zu wissen',
      p1h: 'Antwortet aus dem öffentlichen Feed',
      p1p: 'Er kennt nur die Produkte aus der öffentlichen Produktliste Ihres Shops. Name, Preis und Link auf der Karte kommen direkt aus dem Feed, nicht aus dem Text der KI.',
      p1pShop: 'Diese Demo kennt nur die Produkte aus der öffentlichen Produktliste von {shop}. Name, Preis und Link auf der Karte kommen direkt aus dem Feed, nicht aus dem Text der KI.',
      p2h: 'Nichts wird gespeichert', p2p: 'Der Inhalt eines Gesprächs wird nirgends gespeichert, weder bei uns noch in einer Datenbank. Wir zählen nur, wie viele Gespräche und Produktklicks es pro Tag gab.',
      p3h: 'Er kann sich irren', p3p: 'Eigene Fragen beantwortet eine KI. Bei Wiederholung können die Antworten leicht abweichen, und er kann sich auch bei der Produktwahl irren. Bei einer Frage „bis 30 €“ kann er auch ein teureres Produkt vorschlagen. Die vorbereiteten Fragen dieser Demo haben vorab geprüfte, gespeicherte Antworten.',
      zaverH2: 'Schalten Sie den Assistenten in Ihrem Shop ein', zaverH2Shop: 'Schalten Sie den Assistenten auf {shop} ein',
      zaverSub: 'Ein eigenes Konto mit Ihrem Feed. Kostenlos bis 100 Gespräche im Monat, ohne Kreditkarte.',
      zaverCta: 'Assistenten kostenlos einschalten', zaverPozn: 'Öffnet das Formular (auf Englisch): Feed-Adresse und E-Mail. Die Codezeile bekommen Sie gleich danach.',
      kontaktFirma: 'ARLing s. r. o., Bratislava. Wir schalten ihn gern gemeinsam mit Ihnen ein.',
      odkazZapnut: 'https://arling.sk/asistent/en/#playground'
    },
    en: {
      kicker: 'Live demo of ARLing Shopping Assistant',
      h1: ['The assistant for ', ' is ready'], h1Bez: 'Your assistant is ready', h1Chyba: 'This demo link is incomplete', h1Nepovolena: 'We cannot show this demo here',
      titul: 'Assistant for {shop}: live demo', titulBez: 'Live demo of ARLing Shopping Assistant',
      oknoPod: 'Answers from the shop’s products',
      heroPozn: 'Feed and email, then paste one line of code.',
      shotPopis: 'A real answer from the demo shop Dobrá domácnosť on 28 Sep 2026, in the current assistant window',
      shotAlt: 'Chat in the demo shop Dobrá domácnosť. A shopper writes in Slovak that they want to make cappuccino at home and asks for a coffee machine with a steam wand. The assistant suggests the Orava Uno bean-to-cup machine for 249 EUR and the Orava 15 bar espresso machine for 189 EUR, with their two product cards below.',
      cenaHero: '<b>Free up to 100 conversations a month.</b> Then from 19&nbsp;EUR a month. No card, cancel any time.',
      akoZapnut: 'How to switch it on', chybaCta: 'Try it on your own feed', chybaUkazka: 'Ask the demo shop yourself',
      fakt1: 'WooCommerce · Shoptet · Upgates · Shopify', fakt2: 'SK · CS · EN · DE',
      krokyH2: 'On your site in 10 minutes',
      krokySub: 'The assistant takes your products from the feed your shop already has and refreshes them from it automatically.',
      k1cas: 'a few minutes', k1h: 'Feed and email',
      k1p: 'Enter your product feed URL and an email address. Heureka and Zboží.cz XML, Google Shopping, Shopify, WooCommerce and generic XML, up to 5,000 products.',
      k2cas: 'one line', k2h: 'One line of code',
      k2p: 'Paste it before <code>&lt;/body&gt;</code>, or as HTML code in the Shoptet or Upgates admin. On WooCommerce the plugin from wordpress.org is enough.',
      riadokAria: 'Example of the code line',
      k3cas: 'right away', k3h: 'Done', k3p: 'The window in the bottom right answers with your products, with price and a link to the product page.',
      k3cena: '<b>0 EUR</b> up to 100 conversations a month<br><b>19 EUR</b> a month up to 1,000 · <b>39 EUR</b> up to 3,000',
      viditeH2: 'What your shoppers see, and what you see',
      v1h: 'Shopper', v1p: 'A window in the corner of the page. The answer comes in the language they write in, with cards for up to three of your products, with price and link. If you do not sell something, it says so.',
      v2h: 'You', v2p: 'An account page with conversations this month, products in the index, the last feed refresh and your plan. Change the plan through Stripe, cancel any time.',
      v3h: 'Email', v3p: 'Once it is created you get your code line and setup instructions. At most four emails, each with an unsubscribe link.',
      s1Popis: 'Writes in English, the answer comes in English',
      s1Alt: 'A shopper writes in English: Do you have a small gift for my grandmother? The assistant answers in English and suggests a honey gift set for 24.90 EUR and a herbal tea gift box for 21.90 EUR, with product cards.',
      s2Popis: 'Something the shop does not sell: it says so and points to the contact',
      s2Alt: 'A shopper asks in Slovak whether the shop also sells a microwave oven. The assistant answers that it has no information about a microwave oven in the catalogue and points to the shop email. No product cards.',
      snimkyZdroj: 'Real answers from the demo shop Dobrá domácnosť on 28 Sep 2026, shown in the current assistant window.',
      poctivoH2: 'Good to know',
      p1h: 'Answers from the public feed',
      p1p: 'It only knows the products in your shop’s public product list. Name, price and link on the card come straight from the feed, not from text the AI writes.',
      p1pShop: 'This demo only knows the products in the public product list of {shop}. Name, price and link on the card come straight from the feed, not from text the AI writes.',
      p2h: 'Nothing is stored', p2p: 'The content of a conversation is never stored, not by us, not in any database. We only count how many conversations and product clicks happened per day.',
      p3h: 'It can make mistakes', p3p: 'An AI answers your own questions. Answers can differ a little when repeated, and it can also pick the wrong product. Asked for something “under 30 EUR”, it may still suggest a pricier one. The prepared questions in this demo have answers that were checked in advance and stored.',
      zaverH2: 'Switch the assistant on for your shop', zaverH2Shop: 'Switch the assistant on for {shop}',
      zaverSub: 'Your own account with your feed. Free up to 100 conversations a month, no card.',
      zaverCta: 'Switch it on for free', zaverPozn: 'Opens the form: feed URL and email. You get your code line right after.',
      kontaktFirma: 'ARLing s. r. o., Bratislava. We are glad to switch it on together with you.',
      odkazZapnut: 'https://arling.sk/asistent/en/#playground'
    }
  };
  var v = V[lang];
  var body = document.body;
  body.classList.add('js-lv');
  var sShop = function (text) { return String(text).split('{shop}').join(shop); };

  // statické texty sekcií
  Array.prototype.forEach.call(document.querySelectorAll('[data-v]'), function (el) {
    var k = el.getAttribute('data-v');
    if (v[k] != null) el.textContent = v[k];
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-v-html]'), function (el) {
    var k = el.getAttribute('data-v-html');
    if (v[k] != null) el.innerHTML = v[k];
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-v-alt]'), function (el) {
    var k = el.getAttribute('data-v-alt');
    if (v[k] != null) el.alt = v[k];
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-v-href]'), function (el) {
    var k = el.getAttribute('data-v-href');
    if (v[k] != null) el.href = v[k];
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-v-aria]'), function (el) {
    var k = el.getAttribute('data-v-aria');
    if (v[k] != null) el.setAttribute('aria-label', v[k]);
  });

  // nadpis: kým worker obchod neoverí, všeobecný; po overení s názvom obchodu zo servera
  // (live.js arling-live:obchod); bez ukážky alebo keď ju obchod nedovolí, chybový stav
  var kicker = document.getElementById('title');
  if (kicker) kicker.textContent = v.kicker;
  var h1 = document.getElementById('h1-obchod');

  function chybovyStav(text) {
    h1.textContent = text;
    document.title = v.titulBez;
    body.classList.add('lv-stav-chyba', 'lv-stav-snimka');
    document.getElementById('akcie-chyba').hidden = false;
  }

  function sObchodom(meno) {
    shop = String(meno || '').replace(/[^A-Za-z0-9.-]/g, '');
    if (!shop) return;
    h1.textContent = '';
    h1.appendChild(document.createTextNode(v.h1[0]));
    var b = document.createElement('span');
    b.className = 'lv-obchod';
    b.textContent = shop;
    h1.style.setProperty('--dlzka', String(Math.max(shop.length, 8)));
    h1.appendChild(b);
    h1.appendChild(document.createTextNode(v.h1[1]));
    // Titulok karty ostáva bez domény obchodu: Umami posiela document.title pri každej udalosti
    // (brána oslovení 29. 9., pokus 4, nález 4).
    var meno2 = document.getElementById('okno-meno');
    if (meno2) meno2.textContent = shop;
    var p1 = document.getElementById('poctivo-1');
    if (p1) p1.textContent = sShop(v.p1pShop);
    var zaver = document.getElementById('zapnut-h2');
    if (zaver) zaver.textContent = sShop(v.zaverH2Shop);
  }

  if (!tenant) {
    chybovyStav(v.h1Chyba);
    return;
  }
  h1.textContent = v.h1Bez;
  document.title = v.titulBez;
  document.addEventListener('arling-live:obchod', function (e) { sObchodom(e && e.detail && e.detail.shop); });
  document.addEventListener('arling-live:nepovolena', function () { chybovyStav(v.h1Nepovolena); });
  // live.js mohol výsledok oznámiť skôr, než tento súbor začal počúvať.
  var uz = window.__arlingLive;
  if (uz && uz.stav === 'obchod') sObchodom(uz.detail && uz.detail.shop);
  if (uz && uz.stav === 'nepovolena') chybovyStav(v.h1Nepovolena);
})();
