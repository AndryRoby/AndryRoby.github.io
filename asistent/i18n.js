// i18n.js: SK/EN/DE dictionary and tiny rendering engine for the ARLing Asistent
// landing page. No framework: every visible string lives in the DICT object
// below, keyed by {sk, en, de}; index.html marks translatable elements with
// data-i18n* attributes, and applyI18n() below fills them in. Pattern follows
// products/camt053-to-excel/i18n.js.
//
// 28. 9. 2026 (svetlá prerábka stránky podľa widgetu v2): slovník prepísaný na
// nové časti stránky a doplnený o nemčinu, takže /asistent/de/ už nie je ručne
// písaná stará stránka, ale vzniká z toho istého zdroja ako /asistent/en/
// (node build-i18n.mjs). Odkazy vnútri textov sú absolútne (/asistent/...):
// applyI18n() ich vkladá cez innerHTML aj na /en/ a /de/, kde by relatívna
// adresa viedla do neexistujúceho priečinka.
//
// app.js (the trial-form wiring) writes its own status texts in the page
// language (STATUS_TEXT sk/en/de, from <html lang>). Its error-code texts are
// Slovak only; the MutationObserver bridge below swaps them to English on the
// English page. German keeps app.js's own German status texts.
//
// Split in two halves on purpose, same as camt053-to-excel/i18n.js:
//  - pure helpers (t, tf, langFromLocale, detectLang's query/storage logic,
//    translateStatusText) never touch the DOM.
//  - DOM-touching code (applyI18n, setLang, the status-text bridge, the
//    bootstrap at the bottom) is guarded behind `typeof document !==
//    'undefined'` so importing this file under Node never throws.

export const LANGS = ['sk', 'en', 'de'];
export const DEFAULT_LANG = 'en';
export const STORAGE_KEY = 'arling_lang';

// ─────────────────────────────── dictionary ────────────────────────────────
// Every value has all three languages (findIncompleteEntries() below; the
// build of en/ and de/ fails on a missing translation).

const DPA = 'https://github.com/AndryRoby/arling-asistent/blob/main/legal/dpa-sk.md';
const STRIPE_PORTAL = 'https://billing.stripe.com/p/login/3cIaER9M63hNeFcg8B4ko00';

export const DICT = {
  // ── header: page links and language switch ────────────────────────────
  'nav.how': { sk: 'Ako to funguje', en: 'How it works', de: 'So funktioniert es' },
  'nav.pricing': { sk: 'Cenník', en: 'Pricing', de: 'Preise' },
  'nav.install': { sk: 'Inštalácia', en: 'Install', de: 'Installation' },
  'nav.try': { sk: 'Vyskúšať', en: 'Try it', de: 'Testen' },
  'nav.faq': { sk: 'Otázky', en: 'FAQ', de: 'Fragen' },
  'lang.switch.aria': { sk: 'Jazyk stránky', en: 'Page language', de: 'Sprache der Seite' },
  // Prístupný názov musí obsahovať viditeľný text odkazu (SK, EN, DE), inak hlasové ovládanie „klikni SK“ nenájde.
  'lang.sk.aria': { sk: 'SK, slovenčina', en: 'SK, Slovak', de: 'SK, Slowakisch' },
  'lang.en.aria': { sk: 'EN, angličtina', en: 'EN, English', de: 'EN, Englisch' },
  'lang.de.aria': { sk: 'DE, nemčina', en: 'DE, German', de: 'DE, Deutsch' },

  // ── hero ─────────────────────────────────────────────────────────────
  'hero.kicker': { sk: 'AI predajný asistent pre e-shopy', en: 'AI sales assistant for online shops', de: 'KI-Verkaufsberater für Onlineshops' },
  'hero.h1': {
    sk: '<span class="l">Zákazník sa pýta.</span> <span class="l">Asistent odpovie</span> <span class="l">vašimi produktmi.</span>',
    en: '<span class="l">A shopper asks.</span> <span class="l">The assistant answers</span> <span class="l">with your products.</span>',
    de: '<span class="l">Der Kunde fragt.</span> <span class="l">Der Assistent antwortet</span> <span class="l">mit Ihren Produkten.</span>',
  },
  'hero.lead': {
    sk: 'Okno na okraji vášho e-shopu, ktoré radí pri výbere z vášho produktového feedu. Odpovie v jazyku zákazníka, aj večer, a pod odpoveď pridá výrobky s fotkou, cenou a odkazom.',
    en: 'A panel at the edge of your shop that helps people choose from your product feed. It answers in the shopper’s language, in the evening too, and puts your products with photo, price and link right under the answer.',
    de: 'Ein Fenster am Rand Ihres Shops, das bei der Auswahl aus Ihrem Produktfeed berät. Es antwortet in der Sprache des Kunden, auch abends, und zeigt unter der Antwort Ihre Produkte mit Foto, Preis und Link.',
  },
  'hero.price': {
    sk: '<b>Zadarmo do 100 rozhovorov mesačne.</b> Potom od 19&nbsp;€ mesačne. Bez karty, zrušíte kedykoľvek.',
    en: '<b>Free up to 100 conversations a month.</b> Then from €19 a month. No card, cancel any time.',
    de: '<b>Kostenlos bis 100 Gespräche im Monat.</b> Danach ab 19&nbsp;€ im Monat. Ohne Karte, jederzeit kündbar.',
  },
  'cta.tryOwn': { sk: 'Vyskúšať na vlastnom feede', en: 'Try it on your own feed', de: 'Mit eigenem Feed testen' },
  'cta.demo.href': { sk: '/asistent/ukazka/', en: '/asistent/ukazka/en/', de: '/asistent/ukazka/de/' },
  'cta.demo': { sk: 'Opýtať sa v ukážkovom obchode', en: 'Ask in the demo shop', de: 'Im Demoshop fragen' },
  'hero.fact.platforms': { sk: 'WooCommerce · Shoptet · Upgates · Shopify', en: 'WooCommerce · Shoptet · Upgates · Shopify', de: 'WooCommerce · Shoptet · Upgates · Shopify' },
  'hero.fact.langs': { sk: 'SK · CS · EN · DE', en: 'SK · CS · EN · DE', de: 'SK · CS · EN · DE' },
  'hero.fact.stored': { sk: '<b>0</b> uložených rozhovorov', en: '<b>0</b> conversations stored', de: '<b>0</b> gespeicherte Gespräche' },

  // ── hero: the widget v2 in four states (motion Tabs) ─────────────────
  'shots.aria': { sk: 'Stavy widgetu', en: 'Widget states', de: 'Zustände des Widgets' },
  'shots.tab.answer': { sk: 'Odpoveď', en: 'Answer', de: 'Antwort' },
  'shots.tab.gift': { sk: 'Darček', en: 'Gift', de: 'Geschenk' },
  'shots.tab.compare': { sk: 'Porovnanie', en: 'Compare', de: 'Vergleich' },
  'shots.tab.welcome': { sk: 'Úvod', en: 'Welcome', de: 'Start' },
  'shots.alt.answer': {
    sk: 'Panel asistenta v ukážkovom obchode Dobrá domácnosť. Zákazník sa pýta: Mám indukčnú platňu. Ktorý hrniec mi bude na nej fungovať? Asistent odpovie, že na indukcii budú fungovať hrnce Ferrum Hron Inox FH-20 za 34,90 € a FH-24 za 44,90 € aj liatinová panvica za 49,90 €, a pod odpoveďou sú ich karty s fotkou, cenou a odkazom Pozrieť.',
    en: 'The assistant panel in the Slovak demo shop Dobrá domácnosť. The shopper asks in Slovak which pot will work on an induction hob. The assistant answers that the Ferrum Hron Inox FH-20 pot at €34.90, the FH-24 at €44.90 and a cast iron pan at €49.90 all work on induction, and under the answer are their product cards with photo, price and a View link.',
    de: 'Das Assistenten-Fenster im slowakischen Demoshop Dobrá domácnosť. Der Kunde fragt auf Slowakisch, welcher Topf auf einem Induktionsherd funktioniert. Der Assistent antwortet, dass die Töpfe Ferrum Hron Inox FH-20 für 34,90 € und FH-24 für 44,90 € sowie eine Gusseisenpfanne für 49,90 € auf Induktion funktionieren, darunter stehen ihre Produktkarten mit Foto, Preis und dem Link Ansehen.',
  },
  'shots.alt.gift': {
    sk: 'Hľadač darčekov v paneli asistenta: pre mamu do 50 €. Päť návrhov s fotkou, cenou a krátkou vetou, prečo poteší: ručný mlynček na kávu za 34,90 €, dvojstenné poháre za 22,90 €, ručne točená keramická miska za 32,90 €, bylinkový čaj za 21,90 € a sada medu za 24,90 €.',
    en: 'The gift finder in the assistant panel: for Mum, up to €50. Five suggestions with photo, price and a short line on why she will like it: a hand coffee grinder at €34.90, double wall glasses at €22.90, a hand thrown ceramic bowl at €32.90, a herbal tea box at €21.90 and a honey gift set at €24.90.',
    de: 'Der Geschenkefinder im Assistenten-Fenster: für Mama, bis 50 €. Fünf Vorschläge mit Foto, Preis und einem kurzen Satz, warum sie sich freut: eine Handkaffeemühle für 34,90 €, doppelwandige Gläser für 22,90 €, eine handgedrehte Keramikschale für 32,90 €, eine Kräutertee-Box für 21,90 € und ein Honig-Geschenkset für 24,90 €.',
  },
  'shots.alt.compare': {
    sk: 'Porovnanie dvoch hrncov v paneli: odpoveď uvádza priemer, objem a cenu oboch a pod ňou sú Ferrum Hron Inox FH-20 za 34,90 € a FH-24 za 44,90 € vedľa seba s fotkami, pod lacnejším štítok o 10,00 € lacnejší.',
    en: 'A comparison of two pots in the panel: the answer gives the diameter, volume and price of both, and under it the Ferrum Hron Inox FH-20 at €34.90 and the FH-24 at €44.90 stand side by side with photos, with a label under the cheaper one saying it costs €10.00 less.',
    de: 'Vergleich von zwei Töpfen im Fenster: die Antwort nennt Durchmesser, Volumen und Preis beider, darunter stehen Ferrum Hron Inox FH-20 für 34,90 € und FH-24 für 44,90 € nebeneinander mit Fotos, unter dem günstigeren der Hinweis, dass er 10,00 € weniger kostet.',
  },
  'shots.alt.welcome': {
    sk: 'Úvod panela asistenta: pozdrav obchodu, veta Odpovedám len z produktov tohto obchodu, rozhovor sa neukladá, dlaždice Nájsť darček, Porovnať a Doprava, kategórie s fotkami a príklady otázok.',
    en: 'The opening view of the assistant panel: a greeting from the shop, the line “I answer only from this shop’s products, the conversation is not stored”, tiles for Find a gift, Compare and Delivery, categories with photos and example questions.',
    de: 'Die Startansicht des Assistenten-Fensters: Begrüßung des Shops, der Satz „Ich antworte nur aus den Produkten dieses Shops, das Gespräch wird nicht gespeichert“, Kacheln für Geschenk finden, Vergleichen und Versand, Kategorien mit Fotos und Beispielfragen.',
  },
  'shots.caption': {
    sk: 'Widget v2 v <a href="/asistent/ukazka/">ukážkovom obchode Dobrá domácnosť</a>. Obchod je vymyslený a fotky výrobkov vytvorila AI. Na snímkach sú skutočné odpovede Asistenta z 29. 9. 2026 zo 64 výrobkov feedu ukážky. Vlastné otázky si vyskúšate v ukážkovom obchode.',
    en: 'The screenshots show real answers in Slovak from 29 September 2026, using the 64 products in our fictional demo shop Dobrá domácnosť. The product photos were made with AI. Try your own questions in English in <a href="/asistent/ukazka/en/">Good Home, the English demo shop</a>.',
    de: 'Die Aufnahmen zeigen echte Antworten auf Slowakisch vom 29. September 2026 zu den 64 Produkten unseres erfundenen Demoshops Dobrá domácnosť. Die Produktfotos wurden mit KI erstellt. Stellen Sie eigene Fragen auf Deutsch in <a href="/asistent/ukazka/de/">Gutes Zuhause, dem deutschen Demoshop</a>.',
  },

  // ── how it works ─────────────────────────────────────────────────────
  'how.kicker': { sk: 'Ako to funguje', en: 'How it works', de: 'So funktioniert es' },
  'how.h2': { sk: 'Z feedu, ktorý už máte, za pár minút', en: 'From the feed you already have, in a few minutes', de: 'Aus dem Feed, den Sie schon haben, in wenigen Minuten' },
  'how.1.t': { sk: 'Vložíte adresu feedu', en: 'Enter your feed URL', de: 'Feed-URL eingeben' },
  'how.1.d': {
    sk: 'Heureka a Zboží.cz XML, Google Nákupy, Shopify, WooCommerce alebo bežný XML. Najviac 5 000 výrobkov.',
    en: 'Heureka and Zboží.cz XML, Google Shopping, Shopify, WooCommerce or a generic XML feed. Up to 5,000 products.',
    de: 'Heureka- und Zboží.cz-XML, Google Shopping, Shopify, WooCommerce oder ein einfacher XML-Feed. Bis 5.000 Produkte.',
  },
  'how.2.t': { sk: 'Asistent si výrobky načíta', en: 'The assistant reads your products', de: 'Der Assistent liest Ihre Produkte' },
  'how.2.d': {
    sk: 'Rozdelí ich na časti a pripraví na vyhľadávanie, zvyčajne za pár minút. Z feedu ich potom sám obnovuje.',
    en: 'It splits them into parts and prepares them for search, usually within a few minutes. After that it refreshes them from the feed by itself.',
    de: 'Er teilt sie in Abschnitte und bereitet sie für die Suche vor, meist in wenigen Minuten. Danach aktualisiert er sie selbst aus dem Feed.',
  },
  'how.3.t': { sk: 'Vložíte jeden riadok kódu', en: 'Add one line of code', de: 'Eine Codezeile einfügen' },
  'how.3.d': {
    sk: 'Pred <code>&lt;/body&gt;</code>, alebo doplnok pre WooCommerce. Farbu tlačidla a logo obchodu nastavíte v tom istom riadku.',
    en: 'Before <code>&lt;/body&gt;</code>, or the WooCommerce plugin. The button colour and your shop logo are set in the same line.',
    de: 'Vor <code>&lt;/body&gt;</code>, oder das WooCommerce-Plugin. Die Farbe des Knopfs und Ihr Shop-Logo stellen Sie in derselben Zeile ein.',
  },
  'how.code.label': { sk: 'Riadok kódu, číslo účtu dostanete po skúške', en: 'The line of code, your account ID comes after the trial', de: 'Die Codezeile, Ihre Konto-ID bekommen Sie nach dem Test' },
  'how.code.aria': { sk: 'Ukážka riadku kódu', en: 'Sample line of code', de: 'Beispiel der Codezeile' },

  // ── answers with product cards ───────────────────────────────────────
  'cards.kicker': { sk: 'V rozhovore', en: 'In the conversation', de: 'Im Gespräch' },
  'cards.h2': { sk: 'Odpoveď s fotkou, cenou a odkazom', en: 'An answer with photo, price and link', de: 'Eine Antwort mit Foto, Preis und Link' },
  'cards.sub': {
    sk: 'Zákazník nemusí nič hľadať. Výrobky, o ktorých asistent hovorí, sú hneď pod odpoveďou a jedným klikom vedú na vašu stránku výrobku.',
    en: 'The shopper does not have to search. The products the assistant talks about sit right under the answer, and one click takes them to your product page.',
    de: 'Der Kunde muss nichts suchen. Die Produkte, von denen der Assistent spricht, stehen direkt unter der Antwort und führen mit einem Klick auf Ihre Produktseite.',
  },
  'cards.phone.alt': {
    sk: 'Asistent na telefóne ako list zospodu obrazovky: otázka Mám indukčnú platňu. Ktorý hrniec mi bude na nej fungovať?, odpoveď s cenami a pod ňou veľké karty hrncov s fotkou, cenou a odkazom Pozrieť. Pole na písanie je dole a nič ho neprekrýva.',
    en: 'The assistant on a phone as a sheet from the bottom of the screen: the question about a pot for an induction hob, an answer with prices and large product cards with photo, price and a View link underneath. The input field is at the bottom and nothing covers it.',
    de: 'Der Assistent auf dem Handy als Blatt vom unteren Bildschirmrand: die Frage nach einem Topf für den Induktionsherd, eine Antwort mit Preisen und darunter große Produktkarten mit Foto, Preis und dem Link Ansehen. Das Eingabefeld ist unten und wird von nichts verdeckt.',
  },
  'cards.1.t': { sk: 'Karty výrobkov priamo z feedu', en: 'Product cards straight from the feed', de: 'Produktkarten direkt aus dem Feed' },
  'cards.1.d': {
    sk: 'Názov, fotka, cena a odkaz sa berú z vášho feedu, nie z textu, ktorý napíše AI.',
    en: 'Name, photo, price and link come from your feed, not from text the AI writes.',
    de: 'Name, Foto, Preis und Link kommen aus Ihrem Feed, nicht aus dem Text der KI.',
  },
  'cards.2.t': { sk: 'Porovnanie dvoch výrobkov', en: 'Two products compared', de: 'Zwei Produkte im Vergleich' },
  'cards.2.d': {
    sk: 'Na požiadanie postaví dva výrobky vedľa seba a ukáže rozdiel v cene.',
    en: 'On request it puts two products side by side and shows the price difference.',
    de: 'Auf Wunsch stellt er zwei Produkte nebeneinander und zeigt den Preisunterschied.',
  },
  'cards.3.t': { sk: 'Hľadač darčekov', en: 'Gift finder', de: 'Geschenkefinder' },
  'cards.3.d': {
    sk: 'Pre koho a za koľko, potom päť návrhov s krátkym dôvodom.',
    en: 'Who it is for and how much to spend, then five suggestions with a short reason.',
    de: 'Für wen und wie viel, dann fünf Vorschläge mit kurzer Begründung.',
  },
  'cards.4.t': { sk: 'Keď tovar nemáte, povie to', en: 'When you do not stock it, it says so', de: 'Wenn Sie etwas nicht führen, sagt er es' },
  'cards.4.d': {
    sk: 'Odpovedá z vášho feedu a zákazníka pošle na váš kontakt. AI sa môže pomýliť, preto si odpovede pred zapnutím vyskúšajte.',
    en: 'It answers from your feed and sends the shopper to your contact. AI can make mistakes, so try its answers before you switch it on.',
    de: 'Er antwortet aus Ihrem Feed und verweist den Kunden auf Ihren Kontakt. KI kann sich irren, probieren Sie die Antworten vor dem Einschalten aus.',
  },
  'teaser.alt': {
    sk: 'Zatvorený asistent: medené tlačidlo Odpovedá AI v rohu obchodu a nad ním biela karta Poradiť vám s výberom? Odpovedám z produktov tohto obchodu, s krížikom na zavretie.',
    en: 'The assistant when closed: a copper Odpovedá AI (AI answers) button in the corner of the shop and above it a white card asking in Slovak whether it can help you choose, with a close button.',
    de: 'Der geschlossene Assistent: ein kupferfarbener Knopf Odpovedá AI (KI antwortet) in der Ecke des Shops und darüber eine weiße Karte mit der slowakischen Frage, ob er bei der Auswahl helfen darf, mit einem Schließen-Knopf.',
  },
  'teaser.t': { sk: 'Kým ho nikto nepotrebuje, je to jedno tlačidlo', en: 'Until someone needs it, it is one button', de: 'Solange ihn niemand braucht, ist er ein Knopf' },
  'teaser.d': {
    sk: 'Upútavka sa ukáže najviac raz za návštevu, dá sa zavrieť a po chvíli sama zmizne. Nič nebliká a nič neodpočítava. Ak ju nechcete, vypnete ju atribútom <code>data-upoutavka="0"</code>.',
    en: 'The prompt card shows at most once per visit, can be closed and disappears by itself after a while. Nothing blinks and nothing counts down. If you do not want it, switch it off with <code>data-upoutavka="0"</code>.',
    de: 'Der Hinweis erscheint höchstens einmal pro Besuch, lässt sich schließen und verschwindet nach kurzer Zeit von selbst. Nichts blinkt, nichts zählt herunter. Wenn Sie ihn nicht möchten, schalten Sie ihn mit <code>data-upoutavka="0"</code> ab.',
  },

  // ── languages ────────────────────────────────────────────────────────
  'langs.kicker': { sk: 'Jazyky', en: 'Languages', de: 'Sprachen' },
  'langs.h2': { sk: 'Po slovensky, česky, anglicky aj nemecky', en: 'In Slovak, Czech, English and German', de: 'Auf Slowakisch, Tschechisch, Englisch und Deutsch' },
  'langs.sub': {
    sk: 'Okno má texty v štyroch jazykoch. S nastavením <code>data-lang="auto"</code> odpovedá v jazyku, v ktorom zákazník napíše. Názvy výrobkov ostávajú tak, ako sú vo feede.',
    en: 'The panel has its texts in four languages. With <code>data-lang="auto"</code> it answers in the language the shopper writes in. Product names stay as they are in your feed.',
    de: 'Das Fenster hat seine Texte in vier Sprachen. Mit <code>data-lang="auto"</code> antwortet es in der Sprache, in der der Kunde schreibt. Produktnamen bleiben so, wie sie im Feed stehen.',
  },
  'langs.sk': { sk: 'slovenčina', en: 'Slovak', de: 'Slowakisch' },
  'langs.cs': { sk: 'čeština', en: 'Czech', de: 'Tschechisch' },
  'langs.en': { sk: 'angličtina', en: 'English', de: 'Englisch' },
  'langs.de': { sk: 'nemčina', en: 'German', de: 'Deutsch' },

  // ── privacy ──────────────────────────────────────────────────────────
  'privacy.kicker': { sk: 'Súkromie', en: 'Privacy', de: 'Datenschutz' },
  'privacy.h2': { sk: 'Rozhovory sa neukladajú', en: 'Conversations are not stored', de: 'Gespräche werden nicht gespeichert' },
  'privacy.1.t': { sk: 'Obsah správ nikde nepretrváva', en: 'Message content is kept nowhere', de: 'Nachrichteninhalte bleiben nirgends' },
  'privacy.1.d': {
    sk: 'Ani u nás, ani v databáze. Ukladáme len denné počítadlá rozhovorov a kliknutí na výrobok, kvôli limitu a fakturácii.',
    en: 'Not with us, not in any database. We keep only daily counters of conversations and product clicks, for the limit and billing.',
    de: 'Weder bei uns noch in einer Datenbank. Wir speichern nur tägliche Zähler für Gespräche und Produktklicks, für das Limit und die Abrechnung.',
  },
  'privacy.2.t': { sk: 'Žiadne cookies ani localStorage', en: 'No cookies, no localStorage', de: 'Keine Cookies, kein localStorage' },
  'privacy.2.d': {
    sk: 'V sessionStorage karty prehliadača je len náhodný identifikátor relácie, podpísaný token rozhovoru a značka, že upútavka už bola. Po zatvorení karty zmiznú.',
    en: 'The browser tab’s sessionStorage holds only a random session ID, a signed conversation token and a flag that the prompt card was already shown. They disappear when the tab is closed.',
    de: 'Im sessionStorage des Browser-Tabs liegen nur eine zufällige Sitzungs-ID, ein signiertes Gesprächstoken und ein Merker, dass der Hinweis schon kam. Mit dem Schließen des Tabs sind sie weg.',
  },
  'privacy.3.t': { sk: 'Zmluva podľa čl. 28 GDPR', en: 'GDPR Article 28 agreement', de: 'Vertrag nach Art. 28 DSGVO' },
  'privacy.3.d': {
    sk: `ARLing s. r. o. je pri správach návštevníkov vášho e-shopu sprostredkovateľom. <a href="${DPA}" target="_blank" rel="noopener">Vzor zmluvy (DPA)</a>.`,
    en: `ARLing s. r. o. is the processor for messages from your shop’s visitors. <a href="${DPA}" target="_blank" rel="noopener">Template agreement (DPA)</a> in Slovak, with an <a href="/asistent/dpa/en/" target="_blank" rel="noopener">English translation</a>.`,
    de: `ARLing s. r. o. ist für die Nachrichten Ihrer Shop-Besucher Auftragsverarbeiter. <a href="${DPA}" target="_blank" rel="noopener">Vorlage (AVV, DPA)</a> auf Slowakisch, mit <a href="/asistent/dpa/en/" target="_blank" rel="noopener">englischer Übersetzung</a>.`,
  },
  'privacy.4.t': { sk: 'Beh na sieti Cloudflare', en: 'Runs on Cloudflare’s network', de: 'Läuft im Netz von Cloudflare' },
  'privacy.4.d': {
    sk: 'Spracovanie len v EÚ Cloudflare verejne negarantuje, zmluva preto počíta so štandardnými zmluvnými doložkami (SCC) a EU Cloud Code of Conduct.',
    en: 'Cloudflare does not publicly guarantee EU-only processing, so the agreement relies on Standard Contractual Clauses (SCC) and the EU Cloud Code of Conduct.',
    de: 'Eine Verarbeitung nur in der EU garantiert Cloudflare nicht öffentlich, der Vertrag stützt sich daher auf Standardvertragsklauseln (SCC) und den EU Cloud Code of Conduct.',
  },
  'privacy.owner.summary': { sk: 'Čo ukladáme o vás ako majiteľovi obchodu', en: 'What we store about you as the shop owner', de: 'Was wir über Sie als Shopbetreiber speichern' },
  'privacy.owner': {
    sk: 'Pri vytvorení Asistenta ukladáme váš e-mail, doménu, adresu feedu, zvolený jazyk, odkiaľ účet vznikol (formulár alebo doplnok) a udalosti účtu: pripravený, zapojený na webe, prvá otázka, limit, plán, overenie adresy a ktoré e-maily sme poslali. Zapojenie zisťujeme z domény stránky, ktorá Asistenta načíta; o návštevníkoch tým nič neukladáme. <b>E-maily:</b> len na adresu overenú 6-miestnym kódom (alebo firemnú adresu na doméne obchodu), najviac štyri za celý čas z týchto typov: návod na zapojenie, správa, ak sa výrobky nenačítajú, potvrdenie zapojenia, jedna pripomienka, upozornenie pri 80 % bezplatného limitu. Odkaz v každom z nich zastaví všetky ďalšie; ak ste Asistenta nevytvárali vy, na tej istej stránke to oznámite a na vašu adresu už nepríde nič. <b>Právny základ:</b> návod a správy o účte, ktorý ste si vytvorili, sú plnenie zmluvy (čl. 6 ods. 1 písm. b GDPR); potvrdenie zapojenia, pripomienka a upozornenie na limit sú náš oprávnený záujem (písm. f), ktorý odkazom v e-maile kedykoľvek odmietnete. <b>Kto údaje spracúva s nami:</b> Cloudflare (beh služby a databáza), Resend, Inc. z USA (odosielanie e-mailov, adresa a obsah e-mailu preto prechádzajú do USA) a náš vlastný CRM na našom serveri. <b>Ako dlho:</b> udalosti účtu 24 mesiacov, účet s e-mailom, kým ho nezrušíte; pri platenom pláne doklady po dobu, ktorú vyžaduje zákon o účtovníctve. Zmazanie účtu a údajov do 7 dní, vrátane záznamu v CRM: napíšte na podpora@arling.sk.',
    en: 'When you create an assistant we store your e-mail address, domain, feed URL, chosen language, where the account came from (form or plugin) and account events: ready, live on your site, first question, limit, plan, address verification and which e-mails we sent. We learn that the assistant is live from the domain of the page that loads it; we store nothing about your visitors that way. <b>E-mails:</b> only to an address verified with a 6-digit code (or a company address on the shop’s own domain), at most four in total, chosen from these types: setup instructions, a message if the products do not load, a live confirmation, one reminder, a notice at 80% of the free limit. The link in each of them stops all further ones; if you did not create the assistant, you can say so on the same page and nothing more will reach your address. <b>Legal basis:</b> the setup instructions and messages about the account you created are performance of a contract (Art. 6(1)(b) GDPR); the live confirmation, reminder and limit notice are our legitimate interest (Art. 6(1)(f)), which you can refuse at any time with the link in the e-mail. <b>Who processes the data with us:</b> Cloudflare (running the service and the database), Resend, Inc. in the USA (sending e-mails, so the address and the e-mail content are transferred to the USA) and our own CRM on our own server. <b>How long:</b> account events 24 months, the account with your e-mail until you cancel it; for a paid plan, accounting records for as long as the accounting law requires. To have your account and data deleted within 7 days, including the CRM record, write to support@arling.sk.',
    de: 'Wenn Sie einen Assistenten anlegen, speichern wir Ihre E-Mail-Adresse, die Domain, die Feed-URL, die gewählte Sprache, woher das Konto kommt (Formular oder Plugin) und Kontoereignisse: bereit, auf der Website eingebunden, erste Frage, Limit, Tarif, Bestätigung der Adresse und welche E-Mails wir geschickt haben. Dass der Assistent eingebunden ist, erkennen wir an der Domain der Seite, die ihn lädt; über Ihre Besucher speichern wir dabei nichts. <b>E-Mails:</b> nur an eine mit einem 6-stelligen Code bestätigte Adresse (oder eine Firmenadresse auf der Domain des Shops), insgesamt höchstens vier aus diesen Arten: Anleitung zur Einbindung, eine Nachricht, falls die Produkte nicht geladen werden, Bestätigung der Einbindung, eine Erinnerung, ein Hinweis bei 80 % des kostenlosen Limits. Der Link in jeder davon stoppt alle weiteren; haben nicht Sie den Assistenten angelegt, teilen Sie das auf derselben Seite mit, und an Ihre Adresse kommt nichts mehr. <b>Rechtsgrundlage:</b> Anleitung und Nachrichten zu dem Konto, das Sie angelegt haben, sind Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO); Bestätigung der Einbindung, Erinnerung und Limit-Hinweis sind unser berechtigtes Interesse (lit. f), dem Sie mit dem Link in der E-Mail jederzeit widersprechen. <b>Wer die Daten mit uns verarbeitet:</b> Cloudflare (Betrieb des Dienstes und Datenbank), Resend, Inc. in den USA (Versand der E-Mails, Adresse und Inhalt der E-Mail gehen daher in die USA) und unser eigenes CRM auf unserem eigenen Server. <b>Wie lange:</b> Kontoereignisse 24 Monate, das Konto mit E-Mail, bis Sie es kündigen; bei einem bezahlten Tarif Buchungsbelege so lange, wie es das Buchführungsgesetz verlangt. Löschung von Konto und Daten innerhalb von 7 Tagen, einschließlich des CRM-Eintrags: schreiben Sie an support@arling.sk.',
  },

  // ── pricing ──────────────────────────────────────────────────────────
  'pricing.kicker': { sk: 'Cenník', en: 'Pricing', de: 'Preise' },
  'pricing.h2': { sk: 'Platíte podľa počtu rozhovorov', en: 'You pay by the number of conversations', de: 'Sie zahlen nach Anzahl der Gespräche' },
  'pricing.sub': {
    sk: 'Zadarmo navždy do 100 rozhovorov mesačne, bez karty. Nad tento limit mesačné predplatné, ročné zatiaľ neponúkame.',
    en: 'Free forever up to 100 conversations a month, no card. Above that a monthly subscription; we do not offer yearly plans yet.',
    de: 'Dauerhaft kostenlos bis 100 Gespräche im Monat, ohne Karte. Darüber ein Monatsabo, Jahrestarife bieten wir noch nicht an.',
  },
  'pricing.perMonth': { sk: 'mesačne', en: 'a month', de: 'im Monat' },
  'plan.free.limit': { sk: 'do 100 rozhovorov mesačne', en: 'up to 100 conversations a month', de: 'bis 100 Gespräche im Monat' },
  'plan.starter.limit': { sk: 'do 1 000 rozhovorov mesačne', en: 'up to 1,000 conversations a month', de: 'bis 1.000 Gespräche im Monat' },
  'plan.pro.limit': { sk: 'do 3 000 rozhovorov mesačne', en: 'up to 3,000 conversations a month', de: 'bis 3.000 Gespräche im Monat' },
  'plan.free.note': { sk: 'Navždy, bez platobnej karty.', en: 'Forever, no payment card.', de: 'Dauerhaft, ohne Zahlungskarte.' },
  'plan.paid.note': { sk: 'Kartou cez Stripe, zrušíte kedykoľvek.', en: 'By card via Stripe, cancel any time.', de: 'Per Karte über Stripe, jederzeit kündbar.' },
  'cta.startFree': { sk: 'Začať zadarmo', en: 'Start free', de: 'Kostenlos starten' },
  'pricing.note': {
    sk: 'Každý plán začína skúškou zadarmo. Na platený plán prejdete zo stránky svojho účtu, jej odkaz dostanete hneď po vytvorení Asistenta.',
    en: 'Every plan starts with the free trial. You move to a paid plan from your account page; you get its link as soon as the assistant is created.',
    de: 'Jeder Tarif beginnt mit dem kostenlosen Test. Zum bezahlten Tarif wechseln Sie auf Ihrer Kontoseite, den Link bekommen Sie direkt nach dem Anlegen des Assistenten.',
  },

  // ── install ──────────────────────────────────────────────────────────
  'install.kicker': { sk: 'Inštalácia', en: 'Install', de: 'Installation' },
  'install.h2': { sk: 'Na vašej platforme', en: 'On your platform', de: 'Auf Ihrer Plattform' },
  'install.woo.d': {
    sk: 'Doplnok z wordpress.org: Pluginy, Pridať nový, hľadať ARLing. Výrobky si načíta z obchodu sám.',
    en: 'Plugin from wordpress.org: Plugins, Add New, search for ARLing. It reads the products from your shop by itself.',
    de: 'Plugin von wordpress.org: Plugins, Installieren, nach ARLing suchen. Die Produkte liest es selbst aus dem Shop.',
  },
  'install.woo.href': { sk: '/asistent/woocommerce/', en: '/asistent/woocommerce/en/', de: '/asistent/woocommerce/en/' },
  'install.shoptet.d': {
    sk: 'Feed pre Heureku, ktorý obchod generuje sám, a jeden riadok vložený ako HTML kód v administrácii.',
    en: 'The Heureka feed your shop already generates, and one line added as HTML code in the admin.',
    de: 'Der Heureka-Feed, den Ihr Shop schon erzeugt, und eine Zeile als HTML-Code in der Administration.',
  },
  'install.upgates.d': {
    sk: 'Rovnaký postup ako Shoptet: feed pre Heureku a riadok kódu v administrácii.',
    en: 'The same steps as Shoptet: the Heureka feed and the line of code in the admin.',
    de: 'Genauso wie bei Shoptet: Heureka-Feed und die Codezeile in der Administration.',
  },
  'install.shopify.d': {
    sk: 'Jeden riadok v šablóne, výrobky z <code>/products.json</code>. Aplikáciu v Shopify App Store nemáme.',
    en: 'One line in your theme, products from <code>/products.json</code>. We have no app in the Shopify App Store.',
    de: 'Eine Zeile im Theme, Produkte aus <code>/products.json</code>. Eine App im Shopify App Store haben wir nicht.',
  },
  'install.shopify.href': { sk: '/asistent/shopify/', en: '/asistent/shopify/en/', de: '/asistent/shopify/en/' },
  'install.other.t': { sk: 'Iný e-shop', en: 'Any other shop', de: 'Jeder andere Shop' },
  'install.other.d': {
    sk: 'Jeden riadok pred <code>&lt;/body&gt;</code>. Presný riadok s číslom vášho účtu dostanete po skúške.',
    en: 'One line before <code>&lt;/body&gt;</code>. You get the exact line with your account ID after the trial.',
    de: 'Eine Zeile vor <code>&lt;/body&gt;</code>. Die genaue Zeile mit Ihrer Konto-ID bekommen Sie nach dem Test.',
  },
  'install.guide': { sk: 'Návod', en: 'Guide', de: 'Anleitung' },
  'install.guide.sk': { sk: 'Návod', en: 'Guide in Slovak', de: 'Anleitung auf Slowakisch' },
  'install.try': { sk: 'Vyskúšať', en: 'Try it', de: 'Testen' },
  'install.source': {
    sk: 'Zdrojový kód widgetu aj servera je <a href="https://github.com/AndryRoby/arling-asistent" target="_blank" rel="noopener">verejný na GitHube</a>.',
    en: 'The source code of the widget and the server is <a href="https://github.com/AndryRoby/arling-asistent" target="_blank" rel="noopener">public on GitHub</a>.',
    de: 'Der Quellcode von Widget und Server ist <a href="https://github.com/AndryRoby/arling-asistent" target="_blank" rel="noopener">öffentlich auf GitHub</a>.',
  },

  // ── trial form (ids and wiring in app.js) ────────────────────────────
  's3.kicker': { sk: 'Skúška zadarmo', en: 'Free trial', de: 'Kostenloser Test' },
  's3.h2': { sk: 'Vyskúšajte na vlastnom feede', en: 'Try it on your own feed', de: 'Mit Ihrem eigenen Feed testen' },
  's3.sub': {
    sk: 'Zadajte adresu feedu a e-mail. Za pár minút sa vpravo dole na tejto stránke objaví asistent s vašimi vlastnými výrobkami. Doménu odvodíme z adresy feedu.',
    en: 'Enter your feed URL and an e-mail address. Within a few minutes an assistant with your own products appears in the bottom right of this page. The domain is taken from the feed URL.',
    de: 'Geben Sie die Feed-URL und eine E-Mail-Adresse ein. In wenigen Minuten erscheint unten rechts auf dieser Seite ein Assistent mit Ihren eigenen Produkten. Die Domain leiten wir aus der Feed-URL ab.',
  },
  's3.label.feed': { sk: 'Adresa feedu produktov', en: 'Product feed URL', de: 'URL des Produktfeeds' },
  's3.placeholder.feed': { sk: 'https://vasobchod.sk/feed.xml', en: 'https://yourstore.com/feed.xml', de: 'https://ihrshop.de/feed.xml' },
  's3.label.email': { sk: 'E-mail', en: 'E-mail', de: 'E-Mail' },
  's3.placeholder.email': { sk: 'vy@vasobchod.sk', en: 'you@yourstore.com', de: 'sie@ihrshop.de' },
  's3.label.lang': { sk: 'Jazyk asistenta a e-mailov', en: 'Assistant and e-mail language', de: 'Sprache von Assistent und E-Mails' },
  // Veta o e-mailoch pod formulárom (ops/asistent/zivotny-cyklus.md 6.2): typov je päť, pošleme najviac štyri.
  's3.emailNote': {
    sk: 'Na zadaný e-mail najprv pošleme 6-miestny kód na overenie adresy. Až po overení vám k tomuto Asistentovi pošleme najviac štyri e-maily z týchto typov: návod na zapojenie alebo správa, prečo sa výrobky nenačítali, potvrdenie zapojenia, jedna pripomienka, upozornenie pri 80 % limitu. Každý má odkaz na zastavenie. Nič iné. <a href="#privacy">Čo o vás ukladáme</a>.',
    en: 'We first send a 6-digit code to this e-mail address to verify it. Only after that do we send at most four e-mails about this assistant, chosen from these types: setup instructions or why the products did not load, a live confirmation, one reminder, a notice at 80% of the limit. Each has a stop link. Nothing else. <a href="#privacy">What we store about you</a>.',
    de: 'An diese Adresse schicken wir zuerst einen 6-stelligen Code zur Bestätigung. Erst danach senden wir zu diesem Assistenten höchstens vier E-Mails aus diesen Arten: Anleitung zur Einbindung oder warum die Produkte nicht geladen wurden, Bestätigung der Einbindung, eine Erinnerung, ein Hinweis bei 80 % des Limits. Jede hat einen Link zum Abbestellen. Sonst nichts. <a href="#privacy">Was wir über Sie speichern</a>.',
  },
  's3.submit': { sk: 'Spustiť skúšobnú verziu', en: 'Start the trial', de: 'Test starten' },
  's3.hint': {
    sk: 'Feed sa použije len na vytvorenie skúšobného asistenta. Samotný rozhovor v chate sa nikde neukladá. Zadarmo do 100 rozhovorov mesačne, žiadna platobná karta.',
    en: 'The feed is used only to create a trial assistant. The chat conversation itself is never stored anywhere. Free up to 100 conversations a month, no payment card.',
    de: 'Der Feed dient nur dazu, einen Test-Assistenten anzulegen. Das Gespräch im Chat selbst wird nirgends gespeichert. Kostenlos bis 100 Gespräche im Monat, keine Zahlungskarte.',
  },
  's3.widgetNote': {
    sk: 'Asistent je pripravený. Hľadajte tlačidlo vpravo dole na tejto stránke.',
    en: 'The assistant is ready. Look for the button in the bottom right of this page.',
    de: 'Der Assistent ist bereit. Sie finden den Knopf unten rechts auf dieser Seite.',
  },
  's3.embed.title': { sk: 'Váš kód na vloženie', en: 'Your embed code', de: 'Ihr Einbindungscode' },
  's3.embed.idLabel': { sk: 'ID skúšobného účtu', en: 'Trial account ID', de: 'ID des Testkontos' },
  's3.embed.snippetLabel': { sk: 'Kód na vloženie do stránky', en: 'Code to paste into your page', de: 'Code zum Einfügen in Ihre Seite' },
  's3.embed.copy': { sk: 'Kopírovať', en: 'Copy', de: 'Kopieren' },
  's3.embed.copied': { sk: 'Skopírované', en: 'Copied', de: 'Kopiert' },
  's3.embed.note': {
    sk: 'Vložte pred </body> vo vašej šablóne, alebo použite doplnok pre WooCommerce.',
    en: 'Paste before </body> in your theme, or use the WooCommerce plugin.',
    de: 'Fügen Sie ihn vor </body> in Ihr Theme ein oder nutzen Sie das WooCommerce-Plugin.',
  },
  's3.embed.tenantPage': { sk: 'Používanie a prechod na platený plán:', en: 'Usage and upgrade:', de: 'Nutzung und Wechsel zum bezahlten Tarif:' },

  // ── FAQ (JSON-LD FAQPage is built from the *.q / *.a keys by build-i18n.mjs) ──
  'faq.kicker': { sk: 'Otázky', en: 'FAQ', de: 'Fragen' },
  'faq.h2': { sk: 'Na čo sa pýtajú majitelia obchodov', en: 'What shop owners ask us', de: 'Was Shopbetreiber uns fragen' },
  'faq.ai.q': { sk: 'Čo keď AI povie hlúposť?', en: 'What if the AI says something wrong?', de: 'Was, wenn die KI Unsinn antwortet?' },
  'faq.ai.a': {
    sk: 'Môže sa pomýliť, aj vo výbere výrobku, preto má pevné mantinely. Odpovedá len z vášho feedu a kontaktu, text výrobkov berie ako dáta, nie ako pokyny, a keď tovar nemáte, povie to. Názov, cena a odkaz na karte idú priamo z feedu, nie z textu, ktorý napíše AI. Najlepšie to posúdite na vlastných výrobkoch: skúška je zadarmo a na web ho vložíte, až keď sa vám odpovede páčia.',
    en: 'It can make mistakes, including in which product it picks, so it has firm limits. It answers only from your feed and contact details, treats product text as data and never as instructions, and says so when you do not stock something. The name, price and link on a product card come straight from the feed, not from text the AI writes. The best test is your own products: the trial is free, and you add it to your site only once you like the answers.',
    de: 'Er kann sich irren, auch bei der Wahl des Produkts, deshalb hat er feste Grenzen. Er antwortet nur aus Ihrem Feed und Ihren Kontaktdaten, behandelt Produkttexte als Daten und nie als Anweisungen und sagt es offen, wenn Sie etwas nicht führen. Name, Preis und Link auf der Produktkarte kommen direkt aus dem Feed, nicht aus dem Text der KI. Am besten prüfen Sie es an Ihren eigenen Produkten: Der Test ist kostenlos, und auf Ihre Website kommt er erst, wenn Ihnen die Antworten gefallen.',
  },
  'faq.budget.q': { sk: 'Dodrží rozpočet zákazníka?', en: 'Does it respect the shopper’s budget?', de: 'Hält er das Budget des Kunden ein?' },
  'faq.budget.a': {
    sk: 'Pri otázke „do 30 €“ môže Asistent odporučiť aj drahší výrobok. Cenový strop v bežnom chate zatiaľ nie je spoľahlivý filter. Ceny na kartách výrobkov preberáme z vášho feedu. Pred zapnutím si odpovede overte na vlastných výrobkoch.',
    en: 'When asked for something “under €30”, the assistant may still suggest a more expensive product. A price ceiling in the normal chat is not yet a reliable filter. Prices on the product cards come from your feed. Check the answers on your own products before you switch it on.',
    de: 'Bei einer Frage wie „bis 30 €“ kann der Assistent trotzdem ein teureres Produkt empfehlen. Eine Preisobergrenze im normalen Chat ist noch kein verlässlicher Filter. Die Preise auf den Produktkarten stammen aus Ihrem Feed. Prüfen Sie die Antworten vor dem Einschalten an Ihren eigenen Produkten.',
  },
  'faq.setup.q': { sk: 'Ako dlho trvá nastavenie?', en: 'How long does setup take?', de: 'Wie lange dauert die Einrichtung?' },
  'faq.setup.a': {
    sk: 'Vložíte adresu feedu a e-mail. Server feed stiahne, rozdelí na časti a pripraví na vyhľadávanie, zvyčajne do pár minút podľa veľkosti katalógu (najviac 5 000 výrobkov). Potom vložíte jeden riadok <code>&lt;script&gt;</code> do e-shopu alebo nainštalujete doplnok pre WooCommerce.',
    en: 'You enter your feed URL and an e-mail address. The server downloads the feed, splits it into parts and prepares it for search, usually within a few minutes depending on the catalogue size (up to 5,000 products). Then you add one <code>&lt;script&gt;</code> line to your shop or install the WooCommerce plugin.',
    de: 'Sie geben die Feed-URL und eine E-Mail-Adresse ein. Der Server lädt den Feed, teilt ihn in Abschnitte und bereitet ihn für die Suche vor, je nach Katalog meist in wenigen Minuten (bis 5.000 Produkte). Danach fügen Sie eine <code>&lt;script&gt;</code>-Zeile in Ihren Shop ein oder installieren das WooCommerce-Plugin.',
  },
  'faq.formats.q': { sk: 'Aké formáty feedu podporujete?', en: 'Which feed formats do you support?', de: 'Welche Feed-Formate unterstützen Sie?' },
  'faq.formats.a': {
    sk: 'Heureka a Zboží.cz XML (značky <code>SHOP/SHOPITEM</code>, exportuje ho napríklad Shoptet alebo Upgates), Google Nákupy RSS alebo XML (značky <code>g:</code>), Shopify <code>/products.json</code>, WooCommerce REST alebo Store API JSON a bežný XML feed so značkami <code>item/name/price/url/description/image</code>. Iný formát vyskúšajte vo formulári; ak ho spracovanie odmietne, napíšte na podpora@arling.sk s ukážkou feedu.',
    en: 'Heureka and Zboží.cz XML (<code>SHOP/SHOPITEM</code> tags, exported by Shoptet or Upgates, for example), Google Shopping RSS or XML (<code>g:</code> tags), Shopify <code>/products.json</code>, WooCommerce REST or Store API JSON, and a generic XML feed with <code>item/name/price/url/description/image</code> tags. Try any other format in the form; if processing rejects it, write to support@arling.sk with a sample of your feed.',
    de: 'Heureka- und Zboží.cz-XML (Tags <code>SHOP/SHOPITEM</code>, exportiert zum Beispiel von Shoptet oder Upgates), Google Shopping RSS oder XML (Tags <code>g:</code>), Shopify <code>/products.json</code>, WooCommerce REST oder Store API JSON und ein einfacher XML-Feed mit den Tags <code>item/name/price/url/description/image</code>. Andere Formate probieren Sie im Formular aus; lehnt die Verarbeitung es ab, schreiben Sie mit einem Auszug des Feeds an support@arling.sk.',
  },
  'faq.stored.q': { sk: 'Ukladáte rozhovory zákazníkov?', en: 'Do you store customer conversations?', de: 'Speichern Sie Kundengespräche?' },
  'faq.stored.a': {
    sk: 'Nie. Obsah rozhovoru sa nikde neukladá, ani u nás, ani v databáze. Ukladáme len počítadlá: koľko rozhovorov a kliknutí na výrobok sa za deň udialo, kvôli fakturácii a mesačnému limitu.',
    en: 'No. The content of a conversation is not stored anywhere, not with us and not in any database. We keep only counters: how many conversations and product clicks happened each day, for billing and the monthly limit.',
    de: 'Nein. Der Inhalt eines Gesprächs wird nirgends gespeichert, weder bei uns noch in einer Datenbank. Wir speichern nur Zähler: wie viele Gespräche und Produktklicks es pro Tag gab, für die Abrechnung und das Monatslimit.',
  },
  'faq.lang.q': { sk: 'V akých jazykoch odpovedá?', en: 'Which languages does it answer in?', de: 'In welchen Sprachen antwortet er?' },
  'faq.lang.a': {
    sk: 'Okno má texty v slovenčine, češtine, angličtine a nemčine. S riadkom kódu z formulára (<code>data-lang="auto"</code>) odpovedá v jazyku, v ktorom zákazník napíše otázku. Názvy výrobkov ostávajú tak, ako sú vo vašom feede.',
    en: 'The panel has its texts in Slovak, Czech, English and German. With the line of code from the form (<code>data-lang="auto"</code>) it answers in the language the shopper writes the question in. Product names stay as they are in your feed.',
    de: 'Das Fenster hat seine Texte auf Slowakisch, Tschechisch, Englisch und Deutsch. Mit der Codezeile aus dem Formular (<code>data-lang="auto"</code>) antwortet es in der Sprache, in der der Kunde fragt. Produktnamen bleiben so, wie sie in Ihrem Feed stehen.',
  },
  'faq.cantanswer.q': { sk: 'Čo ak asistent nevie odpovedať?', en: 'What if the assistant cannot answer?', de: 'Was, wenn der Assistent nicht antworten kann?' },
  'faq.cantanswer.a': {
    sk: 'Ak sa vo feede nenájde nič, čo k otázke patrí, asistent to jasne povie a odporučí zákazníkovi napísať obchodu cez kontaktnú stránku na jeho webe. E-mail, ktorý zadáte pri nastavení, zákazníkom neukazuje.',
    en: 'If nothing in the feed fits the question, the assistant says so clearly and suggests contacting the shop through the contact page on its website. The e-mail address you give during setup is never shown to shoppers.',
    de: 'Passt nichts im Feed zur Frage, sagt der Assistent das klar und empfiehlt, den Shop über die Kontaktseite auf seiner Website zu kontaktieren. Die E-Mail-Adresse, die Sie bei der Einrichtung angeben, sehen Kunden nie.',
  },
  'faq.platforms.q': { sk: 'Funguje to na Shoptete, WooCommerce alebo Shopify?', en: 'Does it work on Shoptet, WooCommerce or Shopify?', de: 'Funktioniert es mit Shoptet, WooCommerce oder Shopify?' },
  'faq.platforms.a': {
    sk: 'Áno. Riadok kódu funguje na akomkoľvek e-shope, vložíte ho v administrácii alebo v šablóne. <a href="/asistent/woocommerce/">Doplnok pre WooCommerce</a> je schválený na wordpress.org. Na <a href="/asistent/shopify/">Shopify</a> sa asistent pridáva jedným riadkom v šablóne; aplikáciu v Shopify App Store nemáme. Pre Shoptet a Upgates je <a href="/asistent/shoptet/">samostatný návod</a>: feed pre Heureku z administrácie a riadok kódu ako HTML kód.',
    en: 'Yes. The line of code works on any shop, you add it in the admin or in your theme. The <a href="/asistent/woocommerce/en/">WooCommerce plugin</a> is approved on wordpress.org. On <a href="/asistent/shopify/en/">Shopify</a> you add the assistant with one line in your theme; we have no app in the Shopify App Store. For Shoptet and Upgates there is a <a href="/asistent/shoptet/">separate guide</a> in Slovak: the Heureka feed from the admin and the line of code as HTML code.',
    de: 'Ja. Die Codezeile funktioniert in jedem Shop, Sie fügen sie in der Administration oder im Theme ein. Das <a href="/asistent/woocommerce/en/">WooCommerce-Plugin</a> ist auf wordpress.org freigegeben. Bei <a href="/asistent/shopify/en/">Shopify</a> binden Sie den Assistenten mit einer Zeile im Theme ein; eine App im Shopify App Store haben wir nicht. Für Shoptet und Upgates gibt es eine <a href="/asistent/shoptet/">eigene Anleitung</a> auf Slowakisch: Heureka-Feed aus der Administration und die Codezeile als HTML-Code.',
  },
  'faq.gdpr.q': { sk: 'Máte zmluvu podľa čl. 28 GDPR?', en: 'Do you have a GDPR Article 28 agreement?', de: 'Haben Sie einen Vertrag nach Art. 28 DSGVO?' },
  'faq.gdpr.a': {
    sk: `Áno. ARLing s. r. o. je pri spracúvaní správ návštevníkov vášho e-shopu sprostredkovateľom. Vzor zmluvy: <a href="${DPA}" target="_blank" rel="noopener">Zmluva o spracúvaní osobných údajov (DPA)</a>.`,
    en: `Yes. ARLing s. r. o. acts as processor for the messages your shop’s visitors send. Template: <a href="${DPA}" target="_blank" rel="noopener">Data Processing Agreement (DPA)</a>, written in Slovak, with an <a href="/asistent/dpa/en/" target="_blank" rel="noopener">English translation</a> (the Slovak version prevails).`,
    de: `Ja. ARLing s. r. o. ist bei der Verarbeitung der Nachrichten Ihrer Shop-Besucher Auftragsverarbeiter. Vorlage: <a href="${DPA}" target="_blank" rel="noopener">Auftragsverarbeitungsvertrag (AVV, DPA)</a>, auf Slowakisch verfasst, mit <a href="/asistent/dpa/en/" target="_blank" rel="noopener">englischer Übersetzung</a> (maßgeblich ist die slowakische Fassung).`,
  },
  'faq.datalocation.q': { sk: 'Kde bežia dáta?', en: 'Where does the data run?', de: 'Wo laufen die Daten?' },
  'faq.datalocation.a': {
    sk: 'Na globálnej sieti Cloudflare (Workers, Vectorize, D1). Presnú lokalitu spracovania len v EÚ Cloudflare verejne negarantuje, preto zmluva o spracúvaní osobných údajov (DPA) medzi ARLingom a e-shopom počíta so štandardnými zmluvnými doložkami (SCC) a Cloudflare EU Cloud Code of Conduct.',
    en: 'On Cloudflare’s global network (Workers, Vectorize, D1). Cloudflare does not publicly guarantee an EU-only processing location, so the data processing agreement (DPA) between ARLing and your shop relies on Standard Contractual Clauses (SCC) and the Cloudflare EU Cloud Code of Conduct.',
    de: 'Im globalen Netz von Cloudflare (Workers, Vectorize, D1). Einen Verarbeitungsort nur in der EU garantiert Cloudflare nicht öffentlich, deshalb stützt sich der Auftragsverarbeitungsvertrag (DPA) zwischen ARLing und Ihrem Shop auf Standardvertragsklauseln (SCC) und den Cloudflare EU Cloud Code of Conduct.',
  },
  'faq.billing.q': { sk: 'Ako funguje platba a fakturácia?', en: 'How do payment and invoicing work?', de: 'Wie funktionieren Zahlung und Rechnung?' },
  'faq.billing.a': {
    sk: 'Do 100 rozhovorov mesačne je používanie úplne zadarmo, bez karty. Nad tento limit prejdete na plán Starter (19 € mesačne, do 1 000 rozhovorov) alebo Pro (39 € mesačne, do 3 000 rozhovorov) zo stránky svojho účtu, ktorej odkaz dostanete hneď po vytvorení účtu. Platíte kartou cez Stripe, potvrdenie a faktúru pošle e-mailom Link (Sold through Link, LLC), predajca pri platbe, zrušiť sa dá kedykoľvek.',
    en: 'Up to 100 conversations a month it is completely free, no card. Above that limit you move to Starter (€19 a month, up to 1,000 conversations) or Pro (€39 a month, up to 3,000 conversations) from your account page, whose link you get right after creating the account. You pay by card via Stripe, Link (Sold through Link, LLC), the merchant of record, e-mails the receipt and invoice, and you can cancel any time.',
    de: 'Bis 100 Gespräche im Monat ist die Nutzung völlig kostenlos, ohne Karte. Darüber wechseln Sie auf Ihrer Kontoseite, deren Link Sie direkt nach dem Anlegen bekommen, zu Starter (19 € im Monat, bis 1.000 Gespräche) oder Pro (39 € im Monat, bis 3.000 Gespräche). Sie zahlen per Karte über Stripe, Bestätigung und Rechnung schickt Link (Sold through Link, LLC), der Verkäufer der Zahlung, per E-Mail, kündbar jederzeit.',
  },
  'faq.cancel.q': { sk: 'Ako zrušiť, keď mi to nesadne?', en: 'How do I cancel if it is not for me?', de: 'Wie kündige ich, wenn es nicht passt?' },
  'faq.cancel.a': {
    sk: `Voľný plán do 100 rozhovorov mesačne nemá žiadny záväzok ani kartu, jednoducho ho prestanete používať. Platený plán nad týmto limitom je predplatné cez Stripe. Zrušíte alebo zmeníte ho kedykoľvek na <a href="${STRIPE_PORTAL}">portáli Stripe</a> (prihlásenie e-mailom, ktorým ste platili); platí do konca zaplateného obdobia.`,
    en: `The free plan up to 100 conversations a month has no commitment and no card, you simply stop using it. A paid plan above that limit is a Stripe subscription. You can cancel or change it any time in the <a href="${STRIPE_PORTAL}">Stripe customer portal</a> (log in with the e-mail you paid with); it stays active until the end of the paid period.`,
    de: `Der kostenlose Tarif bis 100 Gespräche im Monat hat keine Bindung und keine Karte, Sie hören einfach auf, ihn zu nutzen. Ein bezahlter Tarif darüber ist ein Abo über Stripe. Sie kündigen oder ändern es jederzeit im <a href="${STRIPE_PORTAL}">Stripe-Kundenportal</a> (Anmeldung mit der E-Mail, mit der Sie bezahlt haben); es läuft bis zum Ende des bezahlten Zeitraums.`,
  },

  // ── subscribe ────────────────────────────────────────────────────────
  'subscribe.ask': { sk: 'Chcete e-mail, keď pribudnú nové funkcie ARLing Asistenta?', en: 'Want an e-mail when new ARLing Shopping Assistant features arrive?', de: 'Möchten Sie eine E-Mail, wenn der ARLing Shopping Assistant neue Funktionen bekommt?' },
  'subscribe.label': { sk: 'Váš e-mail', en: 'Your e-mail', de: 'Ihre E-Mail' },
  'subscribe.email.placeholder': { sk: 'vas@email.sk', en: 'you@email.com', de: 'sie@email.de' },
  'subscribe.btn': { sk: 'Dajte mi vedieť', en: 'Notify me', de: 'Benachrichtigen' },
  'subscribe.privacy': {
    sk: 'Len e-mail o novinkách k ARLing Asistentovi. Odhlásite sa odpoveďou na ktorýkoľvek náš e-mail.',
    en: 'Only e-mail about ARLing Shopping Assistant news. Unsubscribe by replying to any of our e-mails.',
    de: 'Nur E-Mails zu Neuigkeiten des ARLing Shopping Assistant. Abmelden können Sie sich mit einer Antwort auf eine beliebige E-Mail von uns.',
  },
  'subscribe.thanks': { sk: 'Ďakujeme, ozveme sa.', en: 'Thanks, we’ll be in touch.', de: 'Danke, wir melden uns.' },
  'subscribe.error': {
    sk: 'Niečo sa pokazilo, skúste to prosím znova alebo napíšte na podpora@arling.sk.',
    en: 'Something went wrong, please try again or write to support@arling.sk.',
    de: 'Etwas ist schiefgegangen, bitte versuchen Sie es erneut oder schreiben Sie an support@arling.sk.',
  },
  'subscribe.hp.aria': { sk: 'Toto pole nevypĺňajte', en: 'Leave this field empty', de: 'Dieses Feld leer lassen' },

  // ── closing CTA and sticky mobile bar ────────────────────────────────
  'closing.h2': { sk: 'Vyskúšajte ho na vlastných výrobkoch', en: 'Try it on your own products', de: 'Testen Sie ihn mit Ihren eigenen Produkten' },
  'closing.sub': {
    sk: 'Vložte adresu feedu a e-mail. Zadarmo do 100 rozhovorov mesačne, bez platobnej karty.',
    en: 'Enter your feed URL and an e-mail address. Free up to 100 conversations a month, no payment card.',
    de: 'Feed-URL und E-Mail eingeben. Kostenlos bis 100 Gespräche im Monat, ohne Zahlungskarte.',
  },
  'sticky.text': { sk: 'Zadarmo do 100 rozhovorov mesačne.', en: 'Free up to 100 conversations a month.', de: 'Kostenlos bis 100 Gespräche im Monat.' },
  'sticky.close.aria': { sk: 'Zavrieť lištu', en: 'Close bar', de: 'Leiste schließen' },
  'cta.tryShort': { sk: 'Vyskúšať', en: 'Try it', de: 'Testen' },

  // ── meta / SEO ───────────────────────────────────────────────────────
  'meta.title': {
    sk: 'ARLing Asistent: AI predajný asistent pre e-shopy',
    en: 'ARLing Shopping Assistant: AI sales assistant for online shops',
    de: 'ARLing Shopping Assistant: KI-Verkaufsberater für Onlineshops',
  },
  'meta.description': {
    sk: 'AI predajný asistent pre váš e-shop, nastavený z produktového feedu za pár minút. Odpovedá v jazyku zákazníka, ukazuje výrobky s fotkou a cenou a neukladá rozhovory. Zadarmo do 100 rozhovorov mesačne, potom od 19 EUR mesačne.',
    en: 'An AI sales assistant for your online shop, set up from your product feed in minutes. It answers in the shopper’s language, shows products with photo and price, and stores no conversations. Free up to 100 conversations a month, then from 19 EUR a month.',
    de: 'Ein KI-Verkaufsberater für Ihren Onlineshop, in wenigen Minuten aus dem Produktfeed eingerichtet. Er antwortet in der Sprache des Kunden, zeigt Produkte mit Foto und Preis und speichert keine Gespräche. Kostenlos bis 100 Gespräche im Monat, danach ab 19 EUR im Monat.',
  },
};

// ─────────────────────────────── pure helpers ───────────────────────────────

// The page's "active" language. Every helper below that takes an optional
// `lang` argument falls back to this, NOT to DEFAULT_LANG, when `lang` is
// omitted or unrecognized. Stays 'en' (DEFAULT_LANG) under Node.
let currentLang = DEFAULT_LANG;

/** Current active language. */
export function getLang() {
  return currentLang;
}

function resolveLang(lang) {
  return LANGS.includes(lang) ? lang : currentLang;
}

/** Resolves a locale tag (e.g. "sk-SK", "cs-CZ", "de-AT", "fr-FR") to one of LANGS.
 * sk/cs -> sk, de -> de, everything else -> DEFAULT_LANG (en). */
export function langFromLocale(tag) {
  const s = String(tag || '').toLowerCase();
  if (s.startsWith('sk') || s.startsWith('cs')) return 'sk';
  if (s.startsWith('de')) return 'de';
  return DEFAULT_LANG;
}

/** Translates one dictionary key. Unknown key returns the key itself so a
 * missing translation is visible instead of silently blank. Omitting
 * `lang` uses the page's current active language. */
export function t(key, lang) {
  const l = resolveLang(lang);
  const entry = DICT[key];
  if (!entry) return key;
  return entry[l] || entry.en || entry.sk || key;
}

/** Same lookup, but with {placeholders} filled in from `vars`. */
export function tf(key, vars, lang) {
  let s = t(key, lang);
  if (vars) {
    Object.keys(vars).forEach((k) => {
      s = s.split('{' + k + '}').join(String(vars[k]));
    });
  }
  return s;
}

/** Every DICT entry has a non-empty string for every LANGS member. */
export function findIncompleteEntries() {
  const bad = [];
  Object.keys(DICT).forEach((key) => {
    const entry = DICT[key];
    LANGS.forEach((l) => {
      if (typeof entry[l] !== 'string' || !entry[l].trim()) bad.push(`${key}.${l}`);
    });
  });
  return bad;
}

/** Reads ?lang= from a query string (no DOM/location dependency). */
export function langFromQueryString(search) {
  try {
    const params = new URLSearchParams(search || '');
    const q = (params.get('lang') || '').toLowerCase();
    return LANGS.includes(q) ? q : null;
  } catch (e) {
    return null;
  }
}

export function ogLocaleForLang(lang) {
  const l = resolveLang(lang);
  return l === 'sk' ? 'sk_SK' : l === 'de' ? 'de_DE' : 'en_US';
}

// ── status text bridge ──────────────────────────────────────────────────
// app.js writes its error-code texts (TENANT_ERROR_MESSAGES) in Slovak only.
// translateStatusText() swaps them to English on the English page. The other
// status texts app.js already writes in the page language.

export const STATUS_TRANSLATIONS = [
  ['Sťahujeme a spracúvame váš feed produktov...', 'Downloading and processing your product feed...'],
  ['Hotovo. Otvorte chat vpravo dole a opýtajte sa niečo o vašich produktoch.', 'Done. Open the chat in the bottom right and ask something about your products.'],
  ['Feed sa nepodarilo spracovať. Skontrolujte URL feedu, alebo napíšte na podpora@arling.sk.', 'The feed could not be processed. Check the feed URL, or write to support@arling.sk.'],
  ['Spracovanie feedu trva dlhšie ako obvykle. Skúste obnoviť stránku o chvíľu, alebo napíšte na podpora@arling.sk.', 'Processing the feed is taking longer than usual. Try refreshing the page in a moment, or write to support@arling.sk.'],
  ['URL feedu musí byť platná adresa (https://vaseshop.sk/feed.xml).', 'The feed URL must be a valid address (https://yourstore.com/feed.xml).'],
  ['Nepodarilo sa vytvoriť skúšobný účet: ', 'Could not create a trial account: '],
  ['Nepodarilo sa vytvoriť skúšobný účet. Skontrolujte internetové pripojenie a skúste znova.', 'Could not create a trial account. Check your internet connection and try again.'],
  ['Neplatná požiadavka (poškodené dáta formulára).', 'Invalid request (corrupted form data).'],
  ['Skontrolujte polia formulára.', 'Check the form fields.'],
  ['Táto stránka nemá povolený prístup k API (CORS).', 'This page is not allowed to access the API (CORS).'],
  ['Príliš veľa požiadaviek naraz. Skúste to o chvíľu.', 'Too many requests at once. Try again in a moment.'],
  ['Požiadavka je príliš veľká.', 'The request is too large.'],
  ['Dnešný limit skúšobných účtov bol dosiahnutý.', 'Today’s limit of trial accounts has been reached.'],
  ['Nastala chyba na strane servera.', 'A server-side error occurred.'],
];

/** Pure string transform, sk -> en, exported so it can be unit-tested
 * without a DOM. Used by the MutationObserver below. */
export function translateStatusText(text) {
  return localizeStatusText(text, 'en');
}

/** Translates a status string TOWARD `lang`: sk -> en for English, en -> sk
 * for Slovak. German is left alone (app.js already writes German). Idempotent
 * either way, since the entries are never substrings of each other within
 * the same language. */
export function localizeStatusText(text, lang) {
  const l = LANGS.includes(lang) ? lang : currentLang;
  let out = String(text || '');
  if (l === 'de') return out;
  STATUS_TRANSLATIONS.forEach(([sk, en]) => {
    out = l === 'en' ? out.split(sk).join(en) : out.split(en).join(sk);
  });
  return out;
}

// ─────────────────────────────── DOM engine ────────────────────────────────
// Everything below touches document/window/localStorage/navigator and only
// ever runs in a browser; every access is guarded so importing this module
// under Node is side-effect-free beyond the pure helpers above.

function readStoredLang() {
  try {
    if (typeof localStorage === 'undefined' || !localStorage) return null;
    const v = localStorage.getItem(STORAGE_KEY);
    return LANGS.includes(v) ? v : null;
  } catch (e) {
    return null;
  }
}

/** Explicit query and page language win over remembered/browser preferences.
 * Opening the Slovak URL must not silently turn it (and its home link) English. */
export function detectLang() {
  try {
    if (typeof location !== 'undefined') {
      const fromQuery = langFromQueryString(location.search);
      if (fromQuery) return fromQuery;
    }
  } catch (e) {}
  try {
    // A translated route is explicit even if an older generated header differs.
    const route = typeof location !== 'undefined'
      ? String(location.pathname || '').match(/\/(sk|cs|en|de)(?:\/index\.html|\/)?$/i)
      : null;
    const routed = route && (route[1].toLowerCase() === 'cs' ? 'sk' : route[1].toLowerCase());
    if (LANGS.includes(routed)) return routed;
    if (typeof document !== 'undefined' && document.documentElement) {
      const page = String(document.documentElement.lang || '').toLowerCase().split('-')[0];
      const normalized = page === 'cs' ? 'sk' : page;
      if (LANGS.includes(normalized)) return normalized;
    }
  } catch (e) {}
  const stored = readStoredLang();
  if (stored) return stored;
  try {
    if (typeof navigator !== 'undefined' && navigator.language) return langFromLocale(navigator.language);
  } catch (e) {}
  return DEFAULT_LANG;
}

function setMetaByName(name, value) {
  const el = document.querySelector(`meta[name="${name}"]`);
  if (el) el.setAttribute('content', value);
}
function setMetaByProperty(prop, value) {
  const el = document.querySelector(`meta[property="${prop}"]`);
  if (el) el.setAttribute('content', value);
}

function updateUrlLang(lang) {
  try {
    if (typeof history === 'undefined' || typeof location === 'undefined') return;
    const url = new URL(location.href);
    url.searchParams.set('lang', lang);
    history.replaceState(null, '', url.pathname + '?' + url.searchParams.toString() + url.hash);
  } catch (e) {}
}

/** Fills in every data-i18n* element and the document-level bits (title,
 * meta description/OG, <html lang>, language-switch state) for the given
 * (already-resolved) language. Pure DOM sync, no persistence. */
export function applyI18n(lang) {
  if (typeof document === 'undefined') return;
  const l = LANGS.includes(lang) ? lang : currentLang;
  currentLang = l;

  document.documentElement.setAttribute('lang', l);

  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.getAttribute('data-i18n'), l); });
  document.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.getAttribute('data-i18n-html'), l); });
  document.querySelectorAll('[data-i18n-alt]').forEach((el) => { el.setAttribute('alt', t(el.getAttribute('data-i18n-alt'), l)); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => { el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder'), l)); });
  document.querySelectorAll('[data-i18n-aria-label]').forEach((el) => { el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria-label'), l)); });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => { el.setAttribute('title', t(el.getAttribute('data-i18n-title'), l)); });
  document.querySelectorAll('[data-i18n-th]').forEach((el) => { el.setAttribute('data-th', t(el.getAttribute('data-i18n-th'), l)); });
  document.querySelectorAll('[data-i18n-href]').forEach((el) => { el.setAttribute('href', t(el.getAttribute('data-i18n-href'), l)); });
  document.querySelectorAll('[data-i18n-src]').forEach((el) => {
    const v = t(el.getAttribute('data-i18n-src'), l);
    if (el.getAttribute('src') !== v) el.setAttribute('src', v);
  });

  document.title = t('meta.title', l);
  setMetaByName('description', t('meta.description', l));
  setMetaByProperty('og:title', t('meta.title', l));
  setMetaByProperty('og:description', t('meta.description', l));
  setMetaByProperty('og:locale', ogLocaleForLang(l));

  // Prepínač: odkazy na jazykové adresy (aria-current), staršie tlačidlá (aria-pressed).
  document.querySelectorAll('[data-set-lang]').forEach((el) => {
    const active = el.getAttribute('data-set-lang') === l;
    if (el.tagName === 'A') {
      if (active) el.setAttribute('aria-current', 'true');
      else el.removeAttribute('aria-current');
    } else {
      el.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
    el.classList.toggle('lang-active', active);
  });

  document.querySelectorAll('form[data-subscribe]').forEach((f) => f.setAttribute('data-lang', l));

  // Re-translate whatever app.js has already written into the status line.
  const statusEl = document.getElementById('trial-status');
  if (statusEl && statusEl.textContent) {
    const translated = localizeStatusText(statusEl.textContent, l);
    if (translated !== statusEl.textContent) {
      statusObserverIgnoreNext = true;
      statusEl.textContent = translated;
    }
  }

  try { document.dispatchEvent(new CustomEvent('arling:langchange', { detail: { lang: l } })); } catch (e) {}
}

/** Sets the active language, persists it, syncs the URL and re-renders. */
export function setLang(lang) {
  if (!LANGS.includes(lang)) return;
  currentLang = lang;
  try { if (typeof localStorage !== 'undefined' && localStorage) localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
  applyI18n(lang);
  updateUrlLang(lang);
}

// Odkaz na jazykovú adresu (/asistent/, /asistent/en/, /asistent/de/) prehliadač normálne otvorí;
// tu sa len zapamätá voľba. Tlačidlo bez adresy (staršia podoba) prepne jazyk na mieste.
function wireLangSwitch() {
  document.querySelectorAll('[data-set-lang]').forEach((el) => {
    el.addEventListener('click', () => {
      const lang = el.getAttribute('data-set-lang');
      if (el.tagName === 'A' && el.getAttribute('href')) {
        try { if (typeof localStorage !== 'undefined' && localStorage && LANGS.includes(lang)) localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
        return;
      }
      setLang(lang);
    });
  });
}

// MutationObserver on #trial-status: swaps app.js's Slovak error-code texts
// to English on the English page. statusObserverIgnoreNext guards against
// re-triggering on our own rewrite.
let statusObserverIgnoreNext = false;
function setupStatusObserver() {
  if (typeof MutationObserver === 'undefined') return;
  const statusEl = document.getElementById('trial-status');
  if (!statusEl) return;
  const observer = new MutationObserver(() => {
    if (statusObserverIgnoreNext) { statusObserverIgnoreNext = false; return; }
    if (currentLang !== 'en') return;
    const current = statusEl.textContent;
    const translated = translateStatusText(current);
    if (translated !== current) {
      statusObserverIgnoreNext = true;
      statusEl.textContent = translated;
    }
  });
  observer.observe(statusEl, { childList: true, characterData: true, subtree: true });
}

// Exposed for app.js (copy button texts) and any future inline code.
if (typeof window !== 'undefined') {
  window.ASISTENT_I18N = { t, tf, getLang, setLang, translateStatusText, localizeStatusText, LANGS, DEFAULT_LANG };
}

if (typeof document !== 'undefined') {
  const boot = () => {
    wireLangSwitch();
    setupStatusObserver();
    // Stránka už je v jazyku svojej adresy (/asistent/ sk, /en/, /de/): len sa zosynchronizuje, bez ?lang= v adrese.
    // Iný jazyk (?lang=en na slovenskej adrese) sa prepne na mieste ako doteraz.
    const lang = detectLang();
    const root = document.documentElement;
    const stranky = String(root.getAttribute('data-lang-static') || root.getAttribute('lang') || '').slice(0, 2).toLowerCase();
    let zDotazu = null;
    try { zDotazu = typeof location !== 'undefined' ? langFromQueryString(location.search) : null; } catch (e) {}
    if (lang === stranky && !zDotazu) {
      applyI18n(lang);
      return;
    }
    setLang(lang);
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}
