// i18n.js: SK/EN dictionary and tiny rendering engine for the ARLing Asistent
// landing page, so the same page works for Slovak visitors and for
// wordpress.org / Shopify app-store visitors who read English. No framework:
// every visible string lives in the DICT object below, keyed by {sk, en};
// index.html marks translatable elements with data-i18n* attributes, and
// applyI18n() below fills them in. Pattern follows
// products/camt053-to-excel/i18n.js, trimmed to two languages.
//
// app.js (the trial-form wiring) and widget.js are not edited by this file's
// author: app.js hardcodes a handful of Slovak status strings and writes
// them into #trial-status via textContent at runtime (feed processing,
// success, error messages). Rather than touching app.js, this module
// attaches a MutationObserver to #trial-status (see "status text bridge"
// below) and swaps in the English text after app.js writes it, whenever the
// page's active language is English. The exact Slovak strings are mirrored
// from demo/app.js on purpose; if app.js's wording ever changes, update the
// STATUS_TRANSLATIONS list below to match.
//
// Split in two halves on purpose, same as camt053-to-excel/i18n.js:
//  - pure helpers (t, tf, langFromLocale, detectLang's query/storage logic,
//    translateStatusText) never touch the DOM.
//  - DOM-touching code (applyI18n, setLang, the status-text bridge, the
//    bootstrap at the bottom) is guarded behind `typeof document !==
//    'undefined'` so importing this file under Node never throws.

export const LANGS = ['sk', 'en'];
export const DEFAULT_LANG = 'en';
export const STORAGE_KEY = 'arling_lang';

// ─────────────────────────────── dictionary ────────────────────────────────
// Every value has both languages. verify-i18n-asistent.mjs (scratch check
// script run during development) asserts this exhaustively.

export const DICT = {
  // ── header / nav / language switch ────────────────────────────────────
  'skip': { sk: 'Skočiť na skúšobnú verziu', en: 'Skip to the trial form' },
  'brand.sub': { sk: 'nástroj ARLing', en: 'an ARLing tool' },
  'nav.how': { sk: 'Ako sa zapína', en: 'Switching on' },
  'nav.try': { sk: 'Vyskúšať', en: 'Try it' },
  'nav.demo': { sk: 'Ukážka', en: 'Demo shop' },
  'nav.pricing': { sk: 'Cenník', en: 'Pricing' },
  'nav.privacy': { sk: 'Súkromie', en: 'Privacy' },
  'nav.faq': { sk: 'Otázky', en: 'FAQ' },
  'lang.switch.aria': { sk: 'Jazyk stránky', en: 'Page language' },
  // Prístupný názov musí obsahovať viditeľný text tlačidla (SK, EN, DE), inak hlasové ovládanie „klikni SK“ nenájde (Lighthouse label-content-name-mismatch).
  'lang.sk.aria': { sk: 'SK, slovenčina', en: 'SK, Slovak' },
  'lang.en.aria': { sk: 'EN, angličtina', en: 'EN, English' },
  'lang.de.aria': { sk: 'DE, nemčina (samostatná stránka)', en: 'DE, German (separate page)' },

  // ── hero ─────────────────────────────────────────────────────────────
  // Nadpis úvodu nesie vlastné lomenie riadkov (<span class="l">), preto ho stránka číta
  // cez data-i18n-html. Mení sa len zápis, slová sú rovnaké ako predtým.
  // Z-36 (28. 9. 2026): nadpis hovorí výsledok pre zákazníka obchodu, cena je v úvode hneď pod leadom.
  'hero.h1': {
    sk: '<span class="l">Zákazník sa pýta.</span> <span class="l">Asistent odpovie</span> <span class="l">vašimi produktmi.</span>',
    en: '<span class="l">A shopper asks.</span> <span class="l">The assistant answers</span> <span class="l">with your products.</span>',
  },
  'hero.lead': {
    // Z-36 pokus 2: karty sú najviac tri na odpoveď (worker/src/chat.js reconcileProducts, MAX_PRODUCTS_IN_ANSWER)
    sk: 'Okienko v rohu e-shopu, ktoré radí pri výbere z vášho produktového feedu. Odpovedá v jazyku zákazníka aj večer, keď nikto nie je pri telefóne, a pod odpoveď pridá karty najviac troch odporúčaných produktov s cenou a odkazom.',
    en: 'A small chat in the corner of your e-shop that helps shoppers choose from your product feed. It answers in the shopper’s language, even in the evening when nobody is at the phone, and adds cards for up to three suggested products, with price and link, below the answer.',
  },
  'hero.price': {
    sk: '<b>Zadarmo do 100 rozhovorov mesačne.</b> Potom od 19&nbsp;€ mesačne. Bez karty, zrušíte kedykoľvek.',
    en: '<b>Free up to 100 conversations a month.</b> Then from 19&nbsp;EUR a month. No card, cancel any time.',
  },
  'cta.tryOwn': { sk: 'Vyskúšať na vlastnom feede', en: 'Try it on your own feed' },
  'cta.tryShort': { sk: 'Vyskúšať', en: 'Try it' },
  'hero.demo': { sk: 'Opýtať sa v ukážkovom obchode', en: 'Ask the demo shop yourself' },
  'hero.fact.platforms': { sk: 'WooCommerce · Shoptet · Upgates · Shopify', en: 'WooCommerce · Shoptet · Upgates · Shopify' },
  'nav.answers': { sk: 'Odpovede', en: 'Answers' },
  'cta.startFree': { sk: 'Začať zadarmo', en: 'Start for free' },
  'hero.source': { sk: 'Zdrojový kód na GitHube', en: 'Source code on GitHub' },
  // Snímka v úvode: alt aj popiska pod ňou sa musia prepnúť spolu so stránkou, inak by
  // anglický návštevník čítal slovenský popis obrázka. Text popisuje presne to, čo na
  // snímke je: ukážkový obchod Dobrá domácnosť s otvoreným chatom.
  // Z-36 pokus 2: v úvode snímka s kávovarmi (obe odporúčania majú parnú trysku v popise, dva produkty, dve karty);
  // snímka s hrncami menovala štyri produkty, ukázala tri karty a medzi hrncami panvicu, preto zo stránky zmizla.
  // Z-36 pokus 3 (brána Astry 2, nález 5): anglická stránka má v úvode skutočný anglický rozhovor (snímka
  // odpoved-anglicky, ops/asistent/snimky/odpovede.json), nie slovenský. Cesty absolútne: platia v /asistent/ aj /asistent/en/.
  'hero.shot.src': { sk: '/asistent/snimky/odpoved-kavovar.webp', en: '/asistent/snimky/odpoved-anglicky.webp' },
  'hero.shot.alt': {
    sk: 'Snímka chatu v ukážkovom obchode Dobrá domácnosť. Zákazník píše: Chcem si robiť cappuccino doma. Ktorý kávovar má parnú trysku na mlieko? Asistent ponúkne automatický kávovar Orava Uno s mlynčekom za 249 EUR a pákový kávovar Orava 15 bar za 189 EUR, pod odpoveďou sú ich dve karty produktov.',
    en: 'Screenshot of the chat in the Slovak demo shop Dobrá domácnosť. The shopper writes in English: Do you have a small gift for my grandmother? The assistant answers in English and suggests a honey gift set for 24.90 EUR and a herbal tea gift box for 21.90 EUR, with their two product cards below the answer.',
  },
  'hero.shot.caption': {
    sk: 'Skutočná odpoveď z <a href="ukazka/">ukážkového obchodu</a>, 28. 9. 2026',
    en: 'A real English answer from the <a href="ukazka/">Slovak demo shop</a>, 28 Sep 2026. Product names stay as they are in the shop’s feed.',
  },
  'prepis.summary': { sk: 'Prepis rozhovoru', en: 'Transcript' },
  'prepis.full': { sk: 'Snímka v plnej veľkosti', en: 'Full-size screenshot' },
  'hero.prepis': {
    sk: '<dl><dt>Zákazník</dt><dd>Chcem si robiť cappuccino doma. Ktorý kávovar má parnú trysku na mlieko?</dd><dt>Asistent</dt><dd>Na výrobu cappuccina doma s parnou tryskou na mlieko odporúčam kávovar Orava Uno s mlynčekom, ktorý stojí 249.00 EUR, alebo pákový kávovar Orava 15 bar za 189.00 EUR.</dd><dt>Karty produktov</dt><dd>Automatický kávovar Orava Uno s mlynčekom, 249.00 EUR · Pákový kávovar Orava 15 bar, 189.00 EUR</dd></dl>',
    en: '<dl><dt>Shopper</dt><dd>Do you have a small gift for my grandmother?</dd><dt>Assistant</dt><dd>Yes, I can help you with that. You can consider the Darčeková sada medu z podhoria, 3 × 250 g for 24.90 EUR or the Bylinkový čaj darčekový box, 4 druhy for 21.90 EUR.</dd><dt>Product cards</dt><dd><span lang="sk">Darčeková sada medu z podhoria, 3 × 250 g</span> (honey gift set), 24.90 EUR · <span lang="sk">Bylinkový čaj darčekový box, 4 druhy</span> (herbal tea gift box), 21.90 EUR</dd></dl>',
  },
  // ── skutočné odpovede (snímky ops/asistent/snimky-widgetu.mjs, 28. 9. 2026) ──
  'ans.h2': { sk: 'Takto odpovedá vašim zákazníkom', en: 'How it answers your shoppers' },
  'ans.sub': {
    sk: 'Dve ďalšie skutočné snímky z ukážkového obchodu Dobrá domácnosť. Obchod aj jeho 64 výrobkov sú vymyslené, odpovede nie sú upravené, len orezané na okno chatu.',
    en: 'Two more real screenshots from the same demo shop. The shop and its 64 products are made up; the answers are not edited, only cropped to the chat window. These two were asked in Slovak, so each has an English translation in its transcript.',
  },
  'ans.2.t': { sk: 'Tovar nemáte', en: 'You do not sell it' },
  'ans.2.d': { sk: 'Povie to rovno a pošle zákazníka na váš kontakt. V ukážke je kontaktom náš e-mail.', en: 'It says so plainly and points the shopper to your contact. In the demo the contact is our own e-mail.' },
  'ans.2.alt': {
    sk: 'Zákazník píše: Máte aj mikrovlnnú rúru? Asistent odpovedá, že o mikrovlnnej rúre v katalógu nemá informáciu, a odkáže na kontaktný e-mail obchodu. Nezobrazí žiadny produkt.',
    en: 'The shopper asks (in Slovak) whether the shop also sells a microwave oven. The assistant answers that the catalogue has no microwave and points to the shop’s contact e-mail. No product is shown.',
  },
  'ans.2.prepis': {
    sk: '<dl><dt>Zákazník</dt><dd>Máte aj mikrovlnnú rúru?</dd><dt>Asistent</dt><dd>Nemám informáciu o mikrovlnnej rúre v našom katalógu, môžete sa obrátiť na andrej@arling.sk.</dd><dt>Karty produktov</dt><dd>žiadne</dd></dl>',
    en: '<dl><dt>Shopper (in Slovak)</dt><dd><span lang="sk">Máte aj mikrovlnnú rúru?</span><br>Translation: Do you also sell a microwave oven?</dd><dt>Assistant (in Slovak)</dt><dd><span lang="sk">Nemám informáciu o mikrovlnnej rúre v našom katalógu, môžete sa obrátiť na andrej@arling.sk.</span><br>Translation: I have no information about a microwave oven in our catalogue, you can contact andrej@arling.sk.</dd><dt>Product cards</dt><dd>none</dd></dl>',
  },
  // ans.3: slovenská stránka ukazuje anglický rozhovor, anglická (ten je už v úvode) slovenský s kávovarmi.
  'ans.3.src': { sk: '/asistent/snimky/odpoved-anglicky.webp', en: '/asistent/snimky/odpoved-kavovar.webp' },
  'ans.3.t': { sk: 'Píše po anglicky', en: 'Picks by a feature' },
  'ans.3.d': { sk: 'Odpoveď príde v jazyku zákazníka, produkty a ceny ostanú tie z vášho feedu.', en: 'Asked for a milk steam wand, it names only the two machines whose description has one, each with a product card.' },
  'ans.3.alt': {
    sk: 'Zákazník píše po anglicky: Do you have a small gift for my grandmother? Asistent odpovie po anglicky a ponúkne darčekovú sadu medu za 24.90 EUR a darčekový box bylinkových čajov za 21.90 EUR, s kartami produktov.',
    en: 'The shopper asks in Slovak: I want to make cappuccino at home, which coffee machine has a milk steam wand? The assistant suggests the Orava Uno automatic machine with grinder for 249 EUR and the Orava 15 bar lever machine for 189 EUR, with their two product cards.',
  },
  'ans.3.prepis': {
    sk: '<dl><dt>Zákazník</dt><dd lang="en">Do you have a small gift for my grandmother?</dd><dt>Asistent</dt><dd lang="en">Yes, I can help you with that. You can consider the Darčeková sada medu z podhoria, 3 × 250 g for 24.90 EUR or the Bylinkový čaj darčekový box, 4 druhy for 21.90 EUR.</dd><dt>Karty produktov</dt><dd>Darčeková sada medu z podhoria, 3 × 250 g, 24.90 EUR · Bylinkový čaj darčekový box, 4 druhy, 21.90 EUR</dd></dl>',
    en: '<dl><dt>Shopper (in Slovak)</dt><dd><span lang="sk">Chcem si robiť cappuccino doma. Ktorý kávovar má parnú trysku na mlieko?</span><br>Translation: I want to make cappuccino at home. Which coffee machine has a milk steam wand?</dd><dt>Assistant (in Slovak)</dt><dd><span lang="sk">Na výrobu cappuccina doma s parnou tryskou na mlieko odporúčam kávovar Orava Uno s mlynčekom, ktorý stojí 249.00 EUR, alebo pákový kávovar Orava 15 bar za 189.00 EUR.</span><br>Translation: For making cappuccino at home with a milk steam wand I recommend the Orava Uno coffee machine with grinder, which costs 249.00 EUR, or the Orava 15 bar lever machine for 189.00 EUR.</dd><dt>Product cards</dt><dd><span lang="sk">Automatický kávovar Orava Uno s mlynčekom</span>, 249.00 EUR · <span lang="sk">Pákový kávovar Orava 15 bar</span>, 189.00 EUR</dd></dl>',
  },
  'ans.note': {
    sk: 'Odpovede tvorí AI nad vašimi produktmi, pri opakovaní sa môžu v znení trochu líšiť. Názov, cena a odkaz na karte sa berú priamo z feedu. <a href="ukazka/" data-umami-event="ukazka_click" data-umami-event-place="odpovede">Opýtajte sa sami v ukážkovom obchode</a>.',
    en: 'Answers are written by AI over your products, so the wording can differ slightly when asked again. The name, price and link on each card come straight from your feed. <a href="ukazka/" data-umami-event="ukazka_click" data-umami-event-place="odpovede">Ask the demo shop yourself</a>.',
  },
  'hero.shot.source': {
    sk: 'Skutočná snímka z <a href="/asistent/ukazka/" data-umami-event="ukazka_click" data-umami-event-place="hero-caption">ukážkového obchodu</a>',
    en: 'Real screenshot from the <a href="/asistent/ukazka/" data-umami-event="ukazka_click" data-umami-event-place="hero-caption">Slovak demo shop</a>',
  },
  'hero.fact.formats': { sk: '<b>5</b> formátov feedu', en: '<b>5</b> feed formats' },
  'hero.fact.stored': { sk: '<b>0</b> rozhovorov sa ukladá', en: '<b>0</b> conversations stored' },
  'hero.fact.free': { sk: '<b>100</b> rozhovorov/mesiac zadarmo', en: '<b>100</b> conversations/month free' },
  'hero.fact.langs': { sk: 'SK · CS · EN · DE', en: 'SK · CS · EN · DE' },
  'hero.fact.infra': { sk: 'beží na Cloudflare Workers', en: 'runs on Cloudflare Workers' },
  // ilustrácia nad prvou veľkou sekciou (vyrobená generátorom obrázkov podľa nášho zadania)
  'ilu.alt': {
    sk: 'Malý grafitový stolový zvonček s medeným lemom pri podstavci, vedľa neho stojí zložená biela kartička ako strieška.',
    en: 'A small graphite desk bell with a copper rim around its base, next to a folded white card standing like a tent.',
  },
  'ilu.caption': {
    sk: 'Niekto pri pulte, aj keď vy práve nemôžete.',
    en: 'Someone at the counter, even when you cannot be.',
  },

  // ── section 01: how it works ────────────────────────────────────────
  's1.h2': { sk: 'Ako sa zapína', en: 'How to switch it on' },
  's1.sub': {
    // „každú noc“ neplatí všeobecne (worker/src/cron.js: aktívne a neaktívne obchody, rozpočtový limit), brána Z-36 nález 4
    sk: 'Produkty si Asistent berie z feedu, ktorý váš e-shop už má, a automaticky ich z neho obnovuje. Na stránku ho dostanete jedným z troch spôsobov.',
    en: 'The assistant takes your products from the feed your e-shop already has and refreshes them from it automatically. You put it on your site in one of three ways.',
  },
  // Z-36: tri spôsoby zapnutia namiesto troch technických krokov (staré texty s1.r1 až s1.r3 nahradené).
  's1.r1.title': { sk: 'WooCommerce', en: 'WooCommerce' },
  's1.r1.body': {
    sk: 'Doplnok z wordpress.org: v administrácii Pluginy, Pridať nový, hľadať „ARLing“. Produkty si načíta z obchodu sám. <a href="woocommerce/">Návod pre WooCommerce</a>',
    en: 'A plugin from wordpress.org: in your admin go to Plugins, Add New and search for &quot;ARLing&quot;. It loads the products from your shop by itself. <a href="woocommerce/">WooCommerce guide</a>',
  },
  's1.r2.title': { sk: 'Shoptet a Upgates', en: 'Shoptet and Upgates' },
  's1.r2.body': {
    sk: 'Feed pre Heureku, ktorý e-shop generuje sám, a jeden riadok kódu vložený ako HTML kód v administrácii. <a href="shoptet/">Návod pre Shoptet a Upgates</a>',
    en: 'The Heureka feed your shop already generates, plus one line of code added as HTML code in the admin. <a href="shoptet/">Shoptet and Upgates guide</a> (Slovak)',
  },
  's1.r3.title': { sk: 'Akýkoľvek iný e-shop', en: 'Any other e-shop' },
  's1.r3.body': {
    sk: 'Jeden riadok pred <code>&lt;/body&gt;</code>. Presný riadok s číslom vášho účtu dostanete po skúške nižšie. Na <a href="shopify/">Shopify</a> rovnako, v šablóne.',
    en: 'One line before <code>&lt;/body&gt;</code>. You get the exact line with your account number after the trial below. On <a href="shopify/">Shopify</a> the same way, in the theme.',
  },
  's1.formats': {
    sk: 'Formáty feedu: Heureka a Zboží.cz XML, Google Nákupy, Shopify <code>/products.json</code>, WooCommerce a bežný XML, najviac 5 000 produktov. Zdrojový kód widgetu aj servera je <a href="https://github.com/AndryRoby/arling-asistent" target="_blank" rel="noopener" data-umami-event="github_click" data-umami-event-place="how">verejný na GitHube</a>.',
    en: 'Feed formats: Heureka and Zboží.cz XML, Google Shopping, Shopify <code>/products.json</code>, WooCommerce and generic XML, up to 5,000 products. The source code of the widget and the server is <a href="https://github.com/AndryRoby/arling-asistent" target="_blank" rel="noopener" data-umami-event="github_click" data-umami-event-place="how">public on GitHub</a>.',
  },
  // Feed formats: Heureka/Zbozi.cz XML is the SHOP/SHOPITEM format
  // (https://sluzby.heureka.sk/napoveda/xml-feed/). Shoptet exports it as a
  // system feed (https://podpora.shoptet.sk/xml-feedy/) and Upgates generates
  // it automatically (https://www.upgates.cz/a/export-produktu-na-heureku);
  // both help pages read 2026-09-05.

  // ── section 02: pricing ──────────────────────────────────────────────
  's2.h2': { sk: 'Cenník', en: 'Pricing' },
  's2.sub': {
    sk: 'Zadarmo navždy do 100 rozhovorov mesačne, bez karty. Nad tento limit jednoduchá cena podľa počtu rozhovorov za mesiac. Ročné predplatné zatiaľ neponúkame, len mesačné.',
    en: 'Free forever up to 100 conversations a month, no card. Above that, a simple price by monthly conversation volume. No annual plan yet, monthly billing only.',
  },
  's2.th.plan': { sk: 'Plán', en: 'Plan' },
  's2.th.price': { sk: 'Cena', en: 'Price' },
  's2.th.conversations': { sk: 'Rozhovory / mesiac', en: 'Conversations / month' },
  // Prípona ceny v tabuľke. Medzera na začiatku je zámerná, oddeľuje ju od sumy.
  'pricing.perMonth': { sk: ' / mesiac', en: ' / month' },
  'pricing.limit.free': { sk: 'do 100', en: 'up to 100' },
  'pricing.limit.starter': { sk: 'do 1 000', en: 'up to 1,000' },
  'pricing.limit.growth': { sk: 'do 3 000', en: 'up to 3,000' },
  's2.note': {
    sk: 'Do 100 rozhovorov mesačne zadarmo, navždy, bez platobnej karty. Nad tento limit prejde e-shop na plán Starter (19 € mesačne, do 1 000 rozhovorov) alebo Pro (39 € mesačne, do 3 000) zo stránky svojho účtu, ktorej odkaz dostane hneď po vytvorení účtu. Platba kartou cez Stripe, zrušiť kedykoľvek. Ročné predplatné zatiaľ nie je v ponuke.',
    en: 'Free up to 100 conversations a month, forever, no payment card. Above that, the shop upgrades to Starter (19 EUR a month, up to 1,000 conversations) or Pro (39 EUR a month, up to 3,000) from its account page, linked right after the account is created. Card payment through Stripe, cancel any time. No annual plan yet.',
  },
  's2.objections.label': { sk: 'Predtým, než začnete', en: 'Before you start' },
  's2.th.action': { sk: 'Začať', en: 'Start' },
  'obj.h2': { sk: 'Na čo sa nás pýtajú majitelia obchodov', en: 'What shop owners ask us' },
  'objai.q': { sk: 'Čo keď AI povie hlúposť?', en: 'What if the AI says something wrong?' },
  // Z-36 pokus 2 (brána Astry 2, nález 2): chyba nie je len v znení; cenový strop má vlastnú otázku objbudget.
  'objai.a': {
    sk: 'Môže sa pomýliť, aj vo výbere produktu, preto má pevné mantinely. Odpovedá len z vášho feedu a kontaktu, text produktov berie ako dáta, nie ako pokyny, a keď tovar nemáte, povie to (snímka vyššie). Názov, cena a odkaz na karte produktu idú priamo z feedu, nie z textu, ktorý napíše AI. Najlepšie to posúdite na vlastných produktoch: skúška je zadarmo a na web ho vložíte, až keď sa vám odpovede páčia.',
    en: 'It can make mistakes, including in which product it picks, so it runs inside firm limits. It answers only from your feed and your contact details, treats product text as data, never as instructions, and when you do not sell something it says so (see the screenshot above). The name, price and link on every product card come straight from your feed, not from the text the AI writes. The best test is your own products: the trial is free and you add it to your site only once you like the answers.',
  },
  // Otvorená chyba ops/asistent/chyby-2026-09-25.md bod 2; po jej oprave a overení odpoveď zmeniť.
  'objbudget.q': { sk: 'Dodrží rozpočet zákazníka?', en: 'Does it stick to the shopper’s budget?' },
  'objbudget.a': {
    sk: 'Pri otázke „do 30 €“ môže Asistent odporučiť aj drahší produkt. Cenový strop v bežnom chate zatiaľ nie je spoľahlivý filter. Ceny na produktových kartách preberáme z vášho feedu. Pred zapnutím si odpovede overte na vlastných produktoch.',
    en: 'When asked for something &quot;under 30 EUR&quot;, the assistant may still suggest a more expensive product. A price cap in the normal chat is not yet a reliable filter. The prices on the product cards come from your feed. Check the answers on your own products before you switch it on.',
  },
  'objlang.q': { sk: 'V akých jazykoch odpovedá?', en: 'Which languages does it answer in?' },
  'objlang.a': {
    sk: 'Okienko má texty v slovenčine, češtine, angličtine a nemčine. S riadkom kódu z formulára (<code>data-lang="auto"</code>) odpovedá v jazyku, v ktorom zákazník napíše otázku; na snímke vyššie angličtina v slovenskom obchode. Názvy produktov ostávajú tak, ako sú vo vašom feede.',
    en: 'The chat window has its texts in Slovak, Czech, English and German. With the line of code from the form (<code>data-lang="auto"</code>) it answers in the language the shopper writes in; the screenshot above shows English on a Slovak shop. Product names stay exactly as they are in your feed.',
  },

  'obj1.q': { sk: 'Ukladáte rozhovory zákazníkov?', en: 'Do you store customer conversations?' },
  'obj1.a': {
    sk: 'Nie. Obsah rozhovoru sa nikde neukladá, ani u nás, ani v databáze. Ukladáme len počítadlá: koľko rozhovorov a kliknutí na produkt sa za deň udialo, kvôli fakturácii a mesačnému limitu.',
    en: 'No. The content of a conversation is never stored, not by us, not in any database. We only keep counters: how many conversations and product clicks happened per day, for billing and the monthly limit.',
  },
  'obj2.q': { sk: 'Máte zmluvu podľa čl. 28 GDPR?', en: 'Do you have a GDPR Article 28 agreement?' },
  'obj2.a': {
    sk: 'Áno. ARLing s. r. o. je pri spracúvaní správ návštevníkov vášho e-shopu sprostredkovateľom. Vzor zmluvy: <a href="https://github.com/AndryRoby/arling-asistent/blob/main/legal/dpa-sk.md" target="_blank" rel="noopener">Zmluva o spracúvaní osobných údajov (DPA)</a>.',
    en: 'Yes. ARLing s. r. o. acts as processor for the messages your e-shop’s visitors send. Template agreement: <a href="https://github.com/AndryRoby/arling-asistent/blob/main/legal/dpa-sk.md" target="_blank" rel="noopener">Data Processing Agreement (DPA)</a>. The template is written in Slovak; an English translation is available on request at support@arling.sk.',
  },
  'obj3.q': { sk: 'Ako zrušiť, keď mi to nesadne?', en: 'How do I cancel if it does not work out?' },
  'obj3.a': {
    sk: 'Voľný plán do 100 rozhovorov mesačne nemá žiadny záväzok ani kartu, jednoducho ho prestanete používať. Platený plán nad týmto limitom je predplatné cez Stripe. Predplatné zrušíte alebo zmeníte kedykoľvek na <a href="https://billing.stripe.com/p/login/3cIaER9M63hNeFcg8B4ko00">portáli Stripe</a> (prihlásenie e-mailom, ktorým ste platili); platí do konca zaplateného obdobia.',
    en: 'The free plan up to 100 conversations a month has no commitment and no card, you simply stop using it. A paid plan above that limit is a Stripe subscription. You can cancel or change the subscription at any time in the <a href="https://billing.stripe.com/p/login/3cIaER9M63hNeFcg8B4ko00">Stripe customer portal</a> (log in with the e-mail you paid with); it stays active until the end of the paid period.',
  },
  'obj4.q': { sk: 'Čo ak môj feed nie je v žiadnom z podporovaných formátov?', en: 'What if my feed is not in any of the supported formats?' },
  'obj4.a': {
    sk: 'Podporujeme Heureka/Zboží.cz XML (značky <code>SHOP/SHOPITEM</code>, exportuje ho napríklad Shoptet alebo Upgates), Google Shopping RSS/XML (značky <code>g:</code>), Shopify <code>/products.json</code>, WooCommerce REST/Store API JSON a bežný XML feed so značkami <code>item/name/price/url/description/image</code>. Iný formát vyskúšajte vo formulári vyššie; ak ho spracovanie odmietne, napíšte na podpora@arling.sk s ukážkou feedu.',
    en: 'We support Heureka/Zboží.cz XML (<code>SHOP/SHOPITEM</code> tags, exported by Shoptet or Upgates, for example), Google Shopping RSS/XML (<code>g:</code> tags), Shopify <code>/products.json</code>, WooCommerce REST/Store API JSON, and a generic XML feed with <code>item/name/price/url/description/image</code> tags. Try a different format in the form above; if processing rejects it, write to support@arling.sk with a sample of your feed.',
  },

  // ── section 03: playground / trial form ─────────────────────────────
  's3.h2': { sk: 'Vyskúšajte na vlastnom feede', en: 'Try it on your own feed' },
  's3.sub': {
    sk: 'Zadajte URL feedu produktov a e-mail. Za pár minút sa vpravo dole na tejto stránke objaví chat s vašimi vlastnými produktmi. Doménu odvodíme automaticky z URL feedu.',
    en: 'Enter your product feed URL and an email address. Within a few minutes a chat with your own products appears in the bottom right of this page. The domain is derived automatically from the feed URL.',
  },
  's3.label.feed': { sk: 'URL feedu produktov', en: 'Product feed URL' },
  's3.placeholder.feed': { sk: 'https://vasobchod.sk/feed.xml', en: 'https://yourstore.com/feed.xml' },
  's3.label.email': { sk: 'E-mail', en: 'Email' },
  's3.placeholder.email': { sk: 'vy@vasobchod.sk', en: 'you@yourstore.com' },
  's3.label.lang': { sk: 'Jazyk Asistenta a e-mailov', en: 'Assistant and e-mail language' },
  // Veta o e-mailoch pod formulárom (ops/asistent/zivotny-cyklus.md 6.2).
  // Pod formulárom, nie priamo pod poľom: mriežka .trial-grid zarovnáva polia
  // na spodok a riadok navyše pod jedným poľom by rozhodil ostatné.
  's3.emailNote': {
    // Z-36 pokus 3 (brána Astry 2): typov je päť, kód pošle najviac štyri, preto „z týchto typov“
    sk: 'Na zadaný e-mail najprv pošleme 6-miestny kód na overenie adresy. Až po overení vám k tomuto Asistentovi pošleme najviac štyri e-maily z týchto typov: návod na zapojenie alebo správa, prečo sa produkty nenačítali, potvrdenie zapojenia, jedna pripomienka, upozornenie pri 80 % limitu. Každý má odkaz na zastavenie. Nič iné. <a href="#privacy">Čo o vás ukladáme</a>.',
    en: 'We first send a 6-digit code to this e-mail address to verify it. Only after that do we send at most four e-mails about this assistant, chosen from these types: setup instructions or why the products did not load, a live confirmation, one reminder, a notice at 80% of the limit. Each has a stop link. Nothing else. <a href="#privacy">What we store about you</a>.',
  },
  's3.submit': { sk: 'Spustiť skúšobnú verziu', en: 'Start the trial' },
  's3.hint': {
    sk: 'Feed sa použije len na vytvorenie skúšobného asistenta pre túto ukážku. Samotný rozhovor v chate sa nikde neukladá. Zadarmo do 100 rozhovorov mesačne, žiadna platobná karta.',
    en: 'The feed is used only to create a trial assistant for this demo. The chat conversation itself is never stored anywhere. Free up to 100 conversations a month, no payment card.',
  },
  's3.widgetNote': { sk: 'Asistent je pripravený. Hľadajte okrúhle tlačidlo vpravo dole na tejto stránke.', en: 'The assistant is ready. Look for the round button in the bottom right of this page.' },
  's3.embed.title': { sk: 'Váš embed kód', en: 'Your embed code' },
  's3.embed.idLabel': { sk: 'ID skúšobného účtu', en: 'Trial account ID' },
  's3.embed.snippetLabel': { sk: 'Kód na vloženie do stránky', en: 'Code to paste into your page' },
  's3.embed.copy': { sk: 'Kopírovať', en: 'Copy' },
  's3.embed.copied': { sk: 'Skopírované', en: 'Copied' },
  's3.embed.note': {
    sk: 'Vložte pred </body> vo vašej šablóne, alebo použite WooCommerce plugin.',
    en: 'Paste before </body> in your theme, or use the WooCommerce plugin.',
  },
  's3.embed.tenantPage': { sk: 'Používanie a prechod na platený plán:', en: 'Usage and upgrade:' },

  // ── section 04: privacy ──────────────────────────────────────────────
  's4.h2': { sk: 'Súkromie ako vlastnosť, nie dodatok', en: 'Privacy as a feature, not an afterthought' },
  's4.sub': { sk: 'Widget je postavený tak, aby o návštevníkoch vášho e-shopu vedel čo najmenej.', en: 'The widget is built to know as little as possible about your e-shop’s visitors.' },
  's4.item1': {
    sk: '<b>Rozhovory sa neukladajú.</b> Obsah správ nikde nepretrváva, ani u nás, ani v databáze. Ukladáme len denné počítadlá rozhovorov a kliknutí na produkt, kvôli mesačnému limitu a fakturácii.',
    en: '<b>Conversations are not stored.</b> The content of messages never persists anywhere, not with us, not in any database. We only keep daily counters of conversations and product clicks, for the monthly limit and billing.',
  },
  's4.item2': {
    // widget.js: náhodné id relácie a podpísaný token rozhovoru v sessionStorage (bez obsahu správ), brána Z-36 nález 4
    sk: '<b>Žiadne cookies ani localStorage.</b> Aby rozhovor v tej istej karte pokračoval, widget si v sessionStorage prehliadača drží len náhodný identifikátor relácie a podpísaný token rozhovoru, nie obsah správ. Po zatvorení karty zmiznú.',
    en: '<b>No cookies and no localStorage.</b> So that a conversation can continue in the same tab, the widget keeps only a random session identifier and a signed conversation token in the browser’s sessionStorage, not the content of messages. They disappear when the tab is closed.',
  },
  's4.item3': {
    sk: '<b>Feed produktov je jediný zdroj pravdy.</b> Asistent odpovedá len z toho, čo je vo vašom feede a v kontaktných údajoch, a text produktov berie ako dáta, nie ako pokyny. Aj tak sa môže pomýliť, preto si odpovede pred zapnutím vyskúšajte.',
    en: '<b>Your product feed is the single source of truth.</b> The assistant answers only from what is in your feed and your contact details, and treats product text as data, never as instructions. It can still make mistakes, so try the answers before you switch it on.',
  },
  's4.item4': {
    sk: '<b>Zmluva podľa čl. 28 GDPR.</b> ARLing s. r. o. je pri spracúvaní správ návštevníkov vášho e-shopu sprostredkovateľom. Vzor zmluvy: <a href="https://github.com/AndryRoby/arling-asistent/blob/main/legal/dpa-sk.md" target="_blank" rel="noopener">Zmluva o spracúvaní osobných údajov (DPA)</a>.',
    en: '<b>GDPR Article 28 agreement.</b> ARLing s. r. o. acts as processor for the messages your e-shop’s visitors send. Template agreement: <a href="https://github.com/AndryRoby/arling-asistent/blob/main/legal/dpa-sk.md" target="_blank" rel="noopener">Data Processing Agreement (DPA)</a>, written in Slovak; an English translation is available on request.',
  },
  's4.item5': {
    sk: '<b>Beh na globálnej sieti Cloudflare.</b> Presná EU-only lokalita spracovania Workers AI nie je Cloudflare verejne garantovaná; DPA preto počíta so štandardnými zmluvnými doložkami (SCC) a certifikáciou Cloudflare podľa EU Cloud Code of Conduct.',
    en: '<b>Runs on Cloudflare’s global network.</b> Cloudflare does not publicly guarantee EU-only processing location for Workers AI; the DPA therefore relies on Standard Contractual Clauses (SCC) and Cloudflare’s certification under the EU Cloud Code of Conduct.',
  },
  // Údaje o majiteľovi obchodu (životný cyklus, ops/asistent/zivotny-cyklus.md 6.2).
  's4.item6': {
    sk: '<b>Údaje o vás ako majiteľovi obchodu.</b> Pri vytvorení Asistenta ukladáme váš e-mail, doménu, adresu feedu, zvolený jazyk, odkiaľ účet vznikol (formulár alebo plugin) a udalosti účtu: pripravený, zapojený na webe, prvá otázka, limit, plán, overenie adresy a ktoré e-maily sme poslali. Zapojenie zisťujeme z domény stránky, ktorá Asistenta načíta; o návštevníkoch tým nič neukladáme. <b>E-maily:</b> len na adresu overenú 6-miestnym kódom (alebo firemnú adresu na doméne obchodu), najviac štyri za celý čas z týchto typov: návod na zapojenie, správa, ak sa produkty nenačítajú, potvrdenie zapojenia, jedna pripomienka, upozornenie pri 80 % bezplatného limitu. Odkaz v každom z nich zastaví všetky ďalšie; ak ste Asistenta nevytvárali vy, na tej istej stránke to oznámite a na vašu adresu už nepríde nič. <b>Právny základ:</b> návod a správy o účte, ktorý ste si vytvorili, sú plnenie zmluvy (čl. 6 ods. 1 písm. b GDPR); potvrdenie zapojenia, pripomienka a upozornenie na limit sú náš oprávnený záujem (písm. f), ktorý odkazom v e-maile kedykoľvek odmietnete. <b>Kto údaje spracúva s nami:</b> Cloudflare (beh služby a databáza), Resend, Inc. z USA (odosielanie e-mailov, adresa a obsah e-mailu preto prechádzajú do USA) a náš vlastný CRM na našom serveri. <b>Ako dlho:</b> udalosti účtu 24 mesiacov, účet s e-mailom, kým ho nezrušíte; pri platenom pláne doklady po dobu, ktorú vyžaduje zákon o účtovníctve. Zmazanie účtu a údajov do 7 dní, vrátane záznamu v CRM: napíšte na podpora@arling.sk.',
    en: '<b>Data about you as the shop owner.</b> When you create an assistant we store your e-mail address, domain, feed URL, chosen language, where the account came from (form or plugin) and account events: ready, live on your site, first question, limit, plan, address verification and which e-mails we sent. We learn that the assistant is live from the domain of the page that loads it; we store nothing about your visitors that way. <b>E-mails:</b> only to an address verified with a 6-digit code (or a company address on the shop’s own domain), at most four in total, chosen from these types: setup instructions, a message if the products do not load, a live confirmation, one reminder, a notice at 80% of the free limit. The link in each of them stops all further ones; if you did not create the assistant, you can say so on the same page and nothing more will reach your address. <b>Legal basis:</b> the setup instructions and messages about the account you created are performance of a contract (Art. 6(1)(b) GDPR); the live confirmation, reminder and limit notice are our legitimate interest (Art. 6(1)(f)), which you can refuse at any time with the link in the e-mail. <b>Who processes the data with us:</b> Cloudflare (running the service and the database), Resend, Inc. in the USA (sending e-mails, so the address and the e-mail content are transferred to the USA) and our own CRM on our own server. <b>How long:</b> account events 24 months, the account with your e-mail until you cancel it; for a paid plan, accounting records for as long as the accounting law requires. To have your account and data deleted within 7 days, including the CRM record, write to support@arling.sk.',
  },

  // ── FAQ section ──────────────────────────────────────────────────────
  'faqs.h2': { sk: 'Otázky', en: 'FAQ' },
  'faq.setup.q': { sk: 'Ako dlho trvá nastavenie?', en: 'How long does setup take?' },
  'faq.setup.a': {
    sk: 'Vložíte URL feedu produktov a e-mail. Worker feed stiahne, rozdelí na časti a uloží ako embeddings, zvyčajne do pár minút podľa veľkosti katalógu (limit je 5000 produktov). Potom stačí vložiť jeden <code>&lt;script&gt;</code> tag do e-shopu.',
    en: 'Paste your product feed URL and email. A Worker downloads the feed, chunks it, and stores it as embeddings, usually within a few minutes depending on catalogue size (the limit is 5,000 products). Then you add one <code>&lt;script&gt;</code> tag to your e-shop.',
  },
  'faq.formats.q': { sk: 'Aké formáty feedu podporujete?', en: 'Which feed formats do you support?' },
  'faq.formats.a': {
    sk: 'Heureka/Zboží.cz XML (značky <code>SHOP/SHOPITEM</code>, exportuje ho napríklad Shoptet alebo Upgates), Google Shopping RSS/XML (značky <code>g:</code>), Shopify <code>/products.json</code>, WooCommerce REST/Store API JSON a bežný XML feed so značkami <code>item/name/price/url/description/image</code>.',
    en: 'Heureka/Zboží.cz XML (<code>SHOP/SHOPITEM</code> tags, exported by Shoptet or Upgates, for example), Google Shopping RSS/XML (<code>g:</code> tags), Shopify <code>/products.json</code>, WooCommerce REST/Store API JSON, and a generic XML feed with <code>item/name/price/url/description/image</code> tags.',
  },
  'faq.lang.q': { sk: 'V akom jazyku asistent odpovedá?', en: 'What language does the assistant reply in?' },
  'faq.lang.a': {
    sk: 'Slovensky, česky, anglicky alebo nemecky, podľa nastavenia widgetu na stránke (<code>data-lang</code>). Odporúča len produkty z vášho feedu.',
    en: 'Slovak, Czech, English or German, depending on the widget’s <code>data-lang</code> setting on the page. It suggests only products from your feed.',
  },
  'faq.cantanswer.q': { sk: 'Čo ak asistent nevie odpovedať?', en: 'What if the assistant cannot answer?' },
  'faq.cantanswer.a': {
    sk: 'Ak sa vo feede nenájde nič relevantné k otázke, asistent to jasne povie a odporučí zákazníkovi kontaktovať obchod priamo, na e-mail zadaný pri nastavení.',
    en: 'If nothing relevant to the question is found in the feed, the assistant says so clearly and points the customer to contact the shop directly, at the email address entered during setup.',
  },
  'faq.platforms.q': { sk: 'Funguje to aj na Shoptete, WooCommerce alebo Shopify?', en: 'Does this work on Shoptet, WooCommerce or Shopify?' },
  'faq.platforms.a': {
    sk: 'Skript funguje na akomkoľvek e-shope hneď, stačí vložiť jeden <code>&lt;script&gt;</code> tag do administrácie alebo šablóny. Samostatný <a href="woocommerce/">WooCommerce plugin</a> je schválený na wordpress.org, nainštalujete ho priamo v administrácii cez Plugins, Add New, vyhľadaním „ARLing“. Na <a href="shopify/">Shopify</a> sa asistent pridáva rovnako, jedným script tagom v šablóne; aplikáciu v Shopify App Store nemáme. Pre Shoptet a Upgates je samostatný <a href="shoptet/">návod</a>: Heureka XML feed z administrácie a script tag cez HTML kód. Ako widget vyzerá na slovenskom e-shope, ukazuje <a href="ukazka/">ukážkový obchod Dobrá domácnosť</a>.',
    en: 'The script works on any e-shop right away, you just add one <code>&lt;script&gt;</code> tag to the admin or theme. The dedicated <a href="woocommerce/">WooCommerce plugin</a> is approved on wordpress.org, install it right from the admin under Plugins, Add New, by searching for &quot;ARLing&quot;. On <a href="shopify/">Shopify</a> the assistant is added the same way, with one script tag in the theme; we do not have an app in the Shopify App Store. Shoptet and Upgates shops have a separate <a href="shoptet/">guide</a> (Heureka XML feed from the admin, script tag through the HTML code editor). The <a href="ukazka/">Slovak demo shop</a> shows the widget on a fictional Slovak store.',
  },
  'faq.free.q': { sk: 'Čo je zadarmo?', en: 'What is free?' },
  'faq.free.a': {
    sk: 'Do 100 rozhovorov mesačne, navždy, bez platobnej karty. Vyskúšať si to môžete priamo na tejto stránke s vlastným feedom, chat sa objaví vpravo dole.',
    en: 'Up to 100 conversations a month, forever, no payment card. You can try it right on this page with your own feed, the chat appears in the bottom right.',
  },
  'faq.datalocation.q': { sk: 'Kde bežia dáta?', en: 'Where does the data run?' },
  'faq.datalocation.a': {
    sk: 'Na globálnej sieti Cloudflare (Workers, Vectorize, D1). Presná EU-only lokalita spracovania nie je Cloudflare verejne garantovaná, preto zmluva o spracúvaní osobných údajov (DPA) medzi ARLingom a e-shopom počíta so štandardnými zmluvnými doložkami (SCC) a Cloudflare EU Cloud Code of Conduct.',
    en: 'On Cloudflare’s global network (Workers, Vectorize, D1). Cloudflare does not publicly guarantee an EU-only processing location, so the Data Processing Agreement (DPA) between ARLing and the e-shop relies on Standard Contractual Clauses (SCC) and Cloudflare’s EU Cloud Code of Conduct.',
  },
  'faq.billing.q': { sk: 'Ako funguje platba a fakturácia?', en: 'How does payment and billing work?' },
  'faq.billing.a': {
    sk: 'Do 100 rozhovorov mesačne je používanie úplne zadarmo, bez karty. Nad tento limit prejdete na plán Starter (19 € mesačne, do 1 000 rozhovorov) alebo Pro (39 € mesačne, do 3 000 rozhovorov) zo stránky svojho účtu (arling.sk/asistent/tenant/?t=id účtu), ktorej odkaz dostanete hneď po vytvorení účtu. Platíte kartou cez Stripe, potvrdenie a faktúru pošle Stripe e-mailom, zrušiť sa dá kedykoľvek.',
    en: 'Up to 100 conversations a month, use is completely free, no card. Above that you upgrade to Starter (19 EUR a month, up to 1,000 conversations) or Pro (39 EUR a month, up to 3,000) from your account page (arling.sk/asistent/tenant/?t=your account id), linked right after the account is created. You pay by card through Stripe, Stripe e-mails the receipt and invoice, and you can cancel any time.',
  },

  'subscribe.ask': { sk: 'Chcete e-mail, keď pribudnú nové funkcie ARLing Asistenta?', en: 'Want an email when new ARLing Assistant features arrive?' },
  'subscribe.label': { sk: 'Váš e-mail', en: 'Your e-mail' },
  'subscribe.email.placeholder': { sk: 'vas@email.sk', en: 'you@email.com' },
  'subscribe.btn': { sk: 'Dajte mi vedieť', en: 'Notify me' },
  'subscribe.privacy': { sk: 'Len e-mail o novinkách k ARLing Asistentovi. Odhlásenie kedykoľvek jedným klikom.', en: 'Only email about ARLing Shopping Assistant news. Unsubscribe any time with one click.' },
  'subscribe.thanks': { sk: 'Ďakujeme, ozveme sa.', en: 'Thanks, we’ll be in touch.' },
  'subscribe.error': {
    sk: 'Niečo sa pokazilo, skúste to prosím znova alebo napíšte na podpora@arling.sk.',
    en: 'Something went wrong, please try again or write to support@arling.sk.',
  },

  // ── closing CTA ──────────────────────────────────────────────────────
  'closing.h2': { sk: 'Vyskúšajte ho na vlastných produktoch', en: 'Try it on your own products' },
  'closing.sub': { sk: 'Vložte URL feedu a e-mail. Zadarmo do 100 rozhovorov mesačne, bez platobnej karty.', en: 'Paste your feed URL and email. Free up to 100 conversations a month, no payment card.' },

  // ── footer ───────────────────────────────────────────────────────────
  'footer.tool': { sk: 'nástroj', en: 'a tool by' },
  'footer.regIds': { sk: 'IČO 56583486 · IČ DPH SK2122352100', en: 'Company ID (IČO) 56583486 · VAT ID (IČ DPH) SK2122352100' },
  'footer.sourceCode': { sk: 'Zdrojový kód (GitHub)', en: 'Source code (GitHub)' },
  'footer.dpa': { sk: 'DPA (GDPR čl. 28)', en: 'DPA (GDPR Art. 28)' },
  'footer.compare': { sk: 'Porovnanie (EN)', en: 'Compare' },
  'footer.demoSk': { sk: 'Slovenská ukážka', en: 'Slovak demo shop' },
  'footer.shoptet': { sk: 'Shoptet a Upgates', en: 'Shoptet and Upgates (Slovak, Czech)' },
  'footer.giftFinder.text': { sk: 'Hľadač darčekov', en: 'Gift Finder' },
  'footer.giftFinder.href': { sk: 'darceky/', en: 'gift-finder/' },
  'footer.note': { sk: 'Návštevnosť meriame vlastným, cookie-free nástrojom Umami. Neukladá cookies ani odtlačok prehliadača.', en: 'We measure traffic with our own cookie-free tool, Umami. It stores no cookies and no browser fingerprint.' },

  // ── sticky mobile CTA bar ────────────────────────────────────────────
  'sticky.text': { sk: 'Zadarmo do 100 rozhovorov mesačne.', en: 'Free up to 100 conversations a month.' },
  'sticky.close.aria': { sk: 'Zavrieť lištu', en: 'Close bar' },

  // ── meta / SEO ───────────────────────────────────────────────────────
  'meta.title': { sk: 'ARLing Asistent: AI predajný asistent pre e-shopy', en: 'ARLing Shopping Assistant: AI shopping assistant for e-shops' },
  'meta.description': {
    sk: 'Predajný asistent pre váš e-shop, nastavený za 10 minút z produktového feedu. Beží na Cloudflare Workers, neukladá rozhovory zákazníkov. Zadarmo do 100 rozhovorov mesačne, potom od 19 EUR mesačne.',
    en: 'A shopping assistant for your e-shop, set up from your product feed in 10 minutes. Runs on Cloudflare Workers, stores no customer conversations. Free up to 100 conversations a month, then from 19 EUR a month.',
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

/** Resolves a locale tag (e.g. "sk-SK", "cs-CZ", "fr-FR") to one of LANGS.
 * Per the brief: sk/cs -> sk, everything else -> DEFAULT_LANG (en). */
export function langFromLocale(tag) {
  const s = String(tag || '').toLowerCase();
  if (s.startsWith('sk') || s.startsWith('cs')) return 'sk';
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
  return l === 'sk' ? 'sk_SK' : 'en_US';
}

// ── status text bridge ──────────────────────────────────────────────────
// app.js (not edited here) writes these exact Slovak strings into
// #trial-status via textContent at runtime. translateStatusText() below
// does a plain substring swap, longest/most-specific entries first isn't
// required since none of these phrases are substrings of one another
// except the two "Nepodarilo sa vytvoriť skúšobný účet" variants (one ends
// in ": ", the other in "."), which are handled as distinct entries.

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
 * without a DOM. Used by the MutationObserver below, which only ever fires
 * this direction (app.js always writes Slovak). */
export function translateStatusText(text) {
  return localizeStatusText(text, 'en');
}

/** Bidirectional version: translates a status string TOWARD `lang` (sk or
 * en), whichever direction that is. Idempotent either way: running the
 * sk->en pass over already-English text (or vice versa) matches nothing
 * and returns the input unchanged, since STATUS_TRANSLATIONS entries are
 * never substrings of each other within the same language. Used by
 * applyI18n() so that switching the language switch back and forth also
 * flips whatever status text app.js already wrote into #trial-status. */
export function localizeStatusText(text, lang) {
  const l = LANGS.includes(lang) ? lang : currentLang;
  let out = String(text || '');
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
 * meta description/OG, <html lang>, language-switch button state) for the
 * given (already-resolved) language. Pure DOM sync, no persistence. */
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
  // data-th nesie popis stĺpca, ktorý tabuľka cenníka ukáže na mobile pred každou bunkou.
  document.querySelectorAll('[data-i18n-th]').forEach((el) => { el.setAttribute('data-th', t(el.getAttribute('data-i18n-th'), l)); });
  document.querySelectorAll('[data-i18n-href]').forEach((el) => { el.setAttribute('href', t(el.getAttribute('data-i18n-href'), l)); });
  // snímka ukážky v jazyku stránky (Z-36 pokus 3); mení sa len pri inej adrese, aby sa obrázok zbytočne nenačítal znova
  document.querySelectorAll('[data-i18n-src]').forEach((el) => {
    const v = t(el.getAttribute('data-i18n-src'), l);
    if (el.getAttribute('src') !== v) el.setAttribute('src', v);
  });

  document.title = t('meta.title', l);
  setMetaByName('description', t('meta.description', l));
  setMetaByProperty('og:title', t('meta.title', l));
  setMetaByProperty('og:description', t('meta.description', l));
  setMetaByProperty('og:locale', ogLocaleForLang(l));

  document.querySelectorAll('[data-set-lang]').forEach((btn) => {
    const active = btn.getAttribute('data-set-lang') === l;
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    btn.classList.toggle('lang-active', active);
  });

  document.querySelectorAll('form[data-subscribe]').forEach((f) => f.setAttribute('data-lang', l));

  // Re-translate whatever app.js has already written into the status line
  // (see "status text bridge" above), since applyI18n() also runs once on
  // initial load, after which the MutationObserver below takes over.
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

function wireLangSwitch() {
  document.querySelectorAll('[data-set-lang]').forEach((btn) => {
    btn.addEventListener('click', () => setLang(btn.getAttribute('data-set-lang')));
  });
}

// MutationObserver on #trial-status: app.js sets statusEl.textContent
// directly (Slovak strings), so this catches every future write (feed
// processing, ready, error, polling timeout) and swaps in the English text
// when the page's active language is English. statusObserverIgnoreNext
// guards against re-triggering on our own rewrite.
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

// Exposed for app.js or any future inline code to read translations without
// this module needing to be edited again; not required by app.js today
// (see the MutationObserver bridge above), kept for forward compatibility.
if (typeof window !== 'undefined') {
  window.ASISTENT_I18N = { t, tf, getLang, setLang, translateStatusText, localizeStatusText, LANGS, DEFAULT_LANG };
}

if (typeof document !== 'undefined') {
  const boot = () => {
    wireLangSwitch();
    setupStatusObserver();
    setLang(detectLang());
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}
