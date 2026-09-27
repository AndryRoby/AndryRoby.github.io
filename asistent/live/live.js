/* Live demo page: reads ?t=<tenant id>&shop=<domain> and mounts the ARLing Asistent widget
   for that tenant. Texts follow the visitor's browser language (sk, cs, de, en).
   With a shop, the screenshot of our own demo shop is replaced by question buttons: ?q=... (up to 3,
   for example the questions of that shop's customers) or generic ones. ?u=1 marks a demo we prepared
   for a shop we wrote to (27. 9. 2026): it says so and when the demo is deleted. */
(function () {
  var q = new URLSearchParams(location.search);
  var tenant = (q.get('t') || '').replace(/[^A-Za-z0-9-]/g, '');
  var shop = (q.get('shop') || '').replace(/[^A-Za-z0-9.-]/g, '');
  var nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
  var lang = ['sk', 'cs', 'de', 'en'].indexOf(nav) >= 0 ? nav : 'en';
  var T = {
    sk: { title: 'Živé demo ARLing Asistenta', lead: 'Asistent nižšie odpovedá z verejného produktového feedu tohto obchodu. Nič, čo napíšete, sa neukladá.', try: 'Skúste sa opýtať na produkt, cenu alebo čo sa hodí na váš účel. Chat je vpravo dole.', cta: 'Chcete ARLing Asistenta pre svoj e-shop? Nastavenie z feedu za 10 minút, zadarmo do 100 rozhovorov mesačne.', missing: 'V odkaze chýba id ukážky. Otvorte demo zo stránky, ktorá ho vytvorila, alebo si spravte vlastné na arling.sk/asistent.' },
    cs: { title: 'Živé demo ARLing Asistenta', lead: 'Asistent níže odpovídá z veřejného produktového feedu tohoto obchodu. Nic, co napíšete, se neukládá.', try: 'Zkuste se zeptat na produkt, cenu nebo co se hodí pro váš účel. Chat je vpravo dole.', cta: 'Chcete ARLing Asistenta pro svůj e-shop? Nastavení z feedu za 10 minut, zdarma do 100 konverzací měsíčně.', missing: 'V odkazu chybí id ukázky. Otevřete demo ze stránky, která ho vytvořila, nebo si udělejte vlastní na arling.sk/asistent.' },
    de: { title: 'Live-Demo von ARLing Shopping Assistant', lead: 'Der Assistent unten antwortet aus dem öffentlichen Produktfeed dieses Shops. Nichts, was Sie schreiben, wird gespeichert.', try: 'Fragen Sie nach einem Produkt, einem Preis oder was zu Ihrem Bedarf passt. Der Chat öffnet sich unten rechts.', cta: 'ARLing Shopping Assistant für den eigenen Shop: in 10 Minuten aus dem Feed eingerichtet, kostenlos bis 100 Gespräche im Monat.', missing: 'Im Link fehlt die Demo-ID. Öffnen Sie die Demo von der Seite, die sie erstellt hat, oder starten Sie Ihre eigene auf arling.sk/asistent.' },
    en: { title: 'Live demo of ARLing Shopping Assistant', lead: 'The assistant below answers from this shop\'s public product feed. Nothing you type is stored.', try: 'Try it: ask about a product, a price, or what fits your need. Chat opens in the bottom right corner.', cta: 'Get ARLing Shopping Assistant for your own shop: set up from your feed in 10 minutes, free up to 100 conversations a month.', missing: 'No tenant id in the link. Open the demo from the page that created it, or start your own at arling.sk/asistent.' }
  };
  var Q = {
    sk: { nadpis: 'Skúste jednu z otázok', vseob: ['Čo mi odporučíte ako darček do 30 €?', 'Čo je u vás najobľúbenejšie?', 'Máte niečo pre začiatočníka?'], ukazka: 'Túto ukážku sme pripravili z verejného zoznamu produktov obchodu. Ak si Asistenta nezapnete, do 30 dní ju zmažeme.' },
    cs: { nadpis: 'Zkuste jednu z otázek', vseob: ['Co mi doporučíte jako dárek do 30 €?', 'Co je u vás nejoblíbenější?', 'Máte něco pro začátečníka?'], ukazka: 'Tuto ukázku jsme připravili z veřejného seznamu produktů obchodu. Pokud si Asistenta nezapnete, do 30 dnů ji smažeme.' },
    de: { nadpis: 'Probieren Sie eine Frage', vseob: ['Was empfehlen Sie als Geschenk bis 30 €?', 'Was ist bei Ihnen am beliebtesten?', 'Haben Sie etwas für Einsteiger?'], ukazka: 'Diese Vorschau haben wir aus der öffentlichen Produktliste des Shops erstellt. Wenn Sie Asistent nicht einschalten, löschen wir sie innerhalb von 30 Tagen.' },
    en: { nadpis: 'Try one of these questions', vseob: ['What would you suggest as a gift under 30 €?', 'What is your most popular product?', 'Do you have something for a beginner?'], ukazka: 'We prepared this demo from the shop’s public product list. If you do not switch Asistent on, we delete it within 30 days.' }
  };
  var t = T[lang];
  document.documentElement.lang = lang;
  var title = document.getElementById('title');
  title.textContent = t.title + (shop ? ': ' + shop : '');
  document.getElementById('lead').textContent = t.lead;
  document.getElementById('try').textContent = t.try;
  var cta = document.getElementById('cta');
  cta.textContent = '';
  var a = document.createElement('a');
  a.href = 'https://arling.sk/asistent/';
  a.textContent = t.cta;
  cta.appendChild(a);
  if (!tenant) {
    var m = document.getElementById('missing');
    m.textContent = t.missing;
    m.hidden = false;
    return;
  }
  if (shop) {
    var qq = Q[lang];
    var otazky = q.getAll('q').map(function (x) { return x.trim().slice(0, 140); }).filter(Boolean).slice(0, 3);
    if (!otazky.length) otazky = qq.vseob;
    document.getElementById('otazky-nadpis').textContent = qq.nadpis;
    var zoznam = document.getElementById('otazky-zoznam');
    otazky.forEach(function (text) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = text;
      b.addEventListener('click', function () {
        if (window.ArlingAsistent) { window.ArlingAsistent.open(); window.ArlingAsistent.ask(text); }
      });
      zoznam.appendChild(b);
    });
    if (q.get('u') === '1') {
      var pozn = document.getElementById('otazky-pozn');
      pozn.textContent = qq.ukazka;
      pozn.hidden = false;
    }
    document.getElementById('otazky').hidden = false;
    document.getElementById('shot').hidden = true;
  }
  var s = document.createElement('script');
  s.src = '../widget.js';
  s.setAttribute('data-tenant', tenant);
  s.setAttribute('data-lang', 'auto');
  s.setAttribute('data-endpoint', 'https://arling-asistent.arling.workers.dev');
  s.setAttribute('data-title', shop ? shop : 'ARLing Shopping Assistant');
  s.defer = true;
  document.body.appendChild(s);
})();
