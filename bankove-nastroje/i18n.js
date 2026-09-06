// i18n.js: SK/EN/DE dictionary and tiny rendering engine for Bankové
// nástroje pre účtovníkov (the bundle/licence page for the four ARLing bank
// tools), so the same page works for accountants in Slovakia, Germany,
// Austria and Switzerland. No framework: every visible string lives in one
// DICT object below, keyed by {sk, en, de}; index.html marks translatable
// elements with data-i18n* attributes, and applyI18n() below fills them in.
//
// Exact same shape as camt053-to-excel/i18n.js (see that file for the full
// rationale): pure helpers up top (side-effect-free, importable under
// Node), DOM-touching engine below, guarded behind `typeof document !==
// 'undefined'`. This page has no columns/templates to translate, so those
// parts of the sibling file are simply absent here.

export const LANGS = ['sk', 'en', 'de'];
export const DEFAULT_LANG = 'en';
export const STORAGE_KEY = 'arling_lang';

// ─────────────────────────────── dictionary ────────────────────────────────
// Every value has all three languages. findIncompleteEntries() below (and
// verify-i18n tooling) asserts this exhaustively.

export const DICT = {
  // ── header / nav / language switch ────────────────────────────────────
  'skip': { sk: 'Skočiť na nástroje', en: 'Skip to tools', de: 'Zu den Tools springen' },
  'wordmark': { sk: 'Bankové nástroje', en: 'Banking tools', de: 'Bankwerkzeuge' },
  'brand.sub': { sk: 'nástroj ARLing', en: 'an ARLing tool', de: 'ein ARLing-Tool' },
  'nav.tools': { sk: 'Nástroje', en: 'Tools', de: 'Tools' },
  'nav.pro': { sk: 'Cena', en: 'Pricing', de: 'Preise' },
  'nav.licence': { sk: 'Licencia', en: 'Licence', de: 'Lizenz' },
  'nav.faq': { sk: 'Otázky', en: 'FAQ', de: 'FAQ' },
  'lang.switch.aria': { sk: 'Jazyk stránky', en: 'Page language', de: 'Sprache der Seite' },
  'lang.sk.aria': { sk: 'Slovenčina', en: 'Slovak', de: 'Slowakisch' },
  'lang.en.aria': { sk: 'English', en: 'English', de: 'Englisch' },
  'lang.de.aria': { sk: 'Deutsch', en: 'German', de: 'Deutsch' },

  // ── hero ─────────────────────────────────────────────────────────────
  'hero.h1': {
    sk: 'Štyri nástroje pre prácu s bankou. Jedna licencia.',
    en: 'Four tools for working with your bank. One licence.',
    de: 'Vier Tools für die Arbeit mit der Bank. Eine Lizenz.',
  },
  'hero.lead': {
    sk: 'SEPA pain.001 Doctor, SEPA pain.001 Generátor, camt.053 do Excelu a Párovač platieb bežia celé vo vašom prehliadači: nič z toho, čo do nich vložíte, sa neodosiela. Jedna Pro licencia odomkne pohodlie vo všetkých štyroch naraz, free verzie ostávajú bez limitov navždy.',
    en: 'SEPA pain.001 Doctor, SEPA pain.001 Generator, camt.053 to Excel and Payment matcher run entirely in your browser: nothing you put into them is uploaded. They work with any bank that exports camt.053 or accepts pain.001, for example Sparkasse, Volksbank, Deutsche Bank, Commerzbank, Raiffeisen, Erste, UBS or PostFinance, as well as Slovak banks. One Pro licence unlocks convenience across all four at once; free versions stay unlimited forever.',
    de: 'SEPA pain.001 Doctor, SEPA-pain.001-Generator, camt.053 nach Excel und Zahlungsabgleich laufen vollständig in Ihrem Browser: nichts, was Sie eingeben, wird hochgeladen. Sie funktionieren mit jeder Bank, die camt.053 exportiert oder pain.001 akzeptiert, zum Beispiel Sparkasse, Volksbank, Deutsche Bank, Commerzbank, Raiffeisen, Erste, UBS oder PostFinance, sowie mit slowakischen Banken. Eine Pro-Lizenz schaltet den Komfort in allen vier gleichzeitig frei; die kostenlosen Versionen bleiben dauerhaft unbegrenzt.',
  },
  'hero.buy.yearly': { sk: 'Kúpiť za 79 € ročne', en: 'Buy for €79 a year', de: 'Kaufen für 79 €/Jahr' },
  'hero.buy.monthly': { sk: 'alebo 9 € mesačne', en: 'or €9 a month', de: 'oder 9 €/Monat' },
  'hero.see.tools': { sk: 'Pozrieť nástroje', en: 'See the tools', de: 'Tools ansehen' },
  'facts.tools.label': { sk: 'nástroje', en: 'tools', de: 'Tools' },
  'facts.tests.label': { sk: 'testov', en: 'tests', de: 'Tests' },
  'facts.privacy': { sk: 'beží v prehliadači, nič sa neodosiela', en: 'runs in your browser, nothing is uploaded', de: 'läuft im Browser, nichts wird hochgeladen' },

  // ── snímky nástrojov v úvode a v páse, bočný register (Paper v2) ─────
  'shot.alt': {
    sk: 'Snímka nástroja camt.053 do Excelu: výpis z banky prevedený na tabuľku so súhrnom a kontrolou zostatku',
    en: 'Screenshot of camt.053 to Excel: a bank statement turned into a table with a summary and a balance check',
    de: 'Screenshot von camt.053 nach Excel: ein Kontoauszug als Tabelle mit Zusammenfassung und Saldoprüfung',
  },
  'banner.alt': {
    sk: 'Snímka nástroja Párovač platieb: spárované faktúry, preplatky, platby po splatnosti a nespárované platby',
    en: 'Screenshot of Payment matcher: matched invoices, overpayments, overdue payments and unmatched payments',
    de: 'Screenshot des Zahlungsabgleichs: zugeordnete Rechnungen, Überzahlungen, überfällige Zahlungen und nicht zugeordnete Zahlungen',
  },
  'rail.hero': { sk: 'Úvod', en: 'Start', de: 'Anfang' },

  // ── section 01: tools index ─────────────────────────────────────────
  's1.h2': { sk: 'Štyri nástroje, jeden za druhým.', en: 'Four tools, one after another.', de: 'Vier Tools, eines nach dem anderen.' },
  's1.sub': {
    sk: 'Každý funguje samostatne a zadarmo. Licencia nižšie pridá Pro do všetkých štyroch naraz.',
    en: 'Each works on its own, for free. The licence below adds Pro to all four at once.',
    de: 'Jedes funktioniert für sich allein, kostenlos. Die Lizenz unten schaltet Pro in allen vieren gleichzeitig frei.',
  },
  'lbl.see': { sk: 'Máte', en: 'You have', de: 'Sie haben' },
  'lbl.get': { sk: 'Dostanete', en: 'You get', de: 'Sie bekommen' },
  'lang.soon': { sk: 'EN/DE čoskoro', en: 'English and German interface coming', de: 'Englische und deutsche Oberfläche folgt' },

  't1.name': { sk: 'SEPA pain.001 Doctor', en: 'SEPA pain.001 Doctor', de: 'SEPA pain.001 Doctor' },
  't1.who': { sk: 'Kontrola pain.001 pred importom do banky', en: 'Checks pain.001 before you import it into your bank', de: 'Prüft pain.001 vor dem Import in die Bank' },
  't1.see': {
    sk: 'Hotový hromadný príkaz v XML a neviete, či ho banka prijme.',
    en: 'You have a finished batch payment file in XML and do not know if your bank will accept it.',
    de: 'Sie haben eine fertige Sammelüberweisung im XML-Format und wissen nicht, ob die Bank sie annimmt.',
  },
  't1.get': {
    sk: 'Presný element, hodnotu a opravu podľa pravidiel Tatra banky, SLSP, VÚB a ČSOB.',
    en: 'The exact element, value and fix, checked against the rules of Tatra banka, SLSP, VÚB and ČSOB.',
    de: 'Das genaue Element, den Wert und die Korrektur nach den Regeln von Tatra banka, SLSP, VÚB und ČSOB.',
  },

  't2.name': { sk: 'SEPA pain.001 Generátor', en: 'SEPA pain.001 Generator', de: 'SEPA-pain.001-Generator' },
  't2.who': { sk: 'Excel alebo CSV → pain.001 XML', en: 'Excel or CSV to pain.001 XML', de: 'Excel oder CSV zu pain.001-XML' },
  't2.see': {
    sk: 'Zoznam platieb v Exceli a banka chce hromadný príkaz v XML.',
    en: 'You have a list of payments in Excel and your bank wants a batch file in XML.',
    de: 'Sie haben eine Zahlungsliste in Excel und die Bank möchte eine Sammelüberweisung im XML-Format.',
  },
  't2.get': {
    sk: 'Hotový pain.001 súbor, skontrolovaný Doctorom, na stiahnutie za minútu.',
    en: 'A finished pain.001 file, checked by Doctor, ready to download in a minute.',
    de: 'Eine fertige pain.001-Datei, geprüft von Doctor, in einer Minute zum Download bereit.',
  },

  't3.name': { sk: 'camt.053 do Excelu', en: 'camt.053 to Excel', de: 'camt.053 nach Excel' },
  't3.who': { sk: 'Výpis z banky → tabuľka', en: 'Bank statement to a table', de: 'Kontoauszug zur Tabelle' },
  't3.see': {
    sk: 'Výpis z internet bankingu v XML (camt.053) a účtovný softvér chce tabuľku.',
    en: 'You have a camt.053 XML statement from internet banking and your accounting software wants a table.',
    de: 'Sie haben einen camt.053-XML-Kontoauszug aus dem Online-Banking und Ihre Buchhaltungssoftware möchte eine Tabelle.',
  },
  't3.get': {
    sk: 'CSV alebo Excel s dátumami, sumami, protistranou a symbolmi, so súhrnom a kontrolou zostatku.',
    en: 'A CSV or Excel table with dates, amounts, the counterparty and reference numbers, plus a summary and a balance check.',
    de: 'Eine CSV- oder Excel-Tabelle mit Datum, Betrag, Gegenpartei und Verwendungszweck, mit Zusammenfassung und Saldoprüfung.',
  },

  't4.name': { sk: 'Párovač platieb', en: 'Payment matcher', de: 'Zahlungsabgleich' },
  't4.who': { sk: 'Výpis z banky × faktúry', en: 'Bank statement times invoices', de: 'Kontoauszug mal Rechnungen' },
  't4.see': {
    sk: 'Výpis z banky a zoznam vydaných faktúr, ktoré treba spárovať ručne.',
    en: 'You have a bank statement and a list of issued invoices that need matching by hand.',
    de: 'Sie haben einen Kontoauszug und eine Liste ausgestellter Rechnungen, die von Hand abgeglichen werden müssen.',
  },
  't4.get': {
    sk: 'Spárované platby, nezaplatené faktúry a preplatky automaticky, aj bez zhodného variabilného symbolu.',
    en: 'Matched payments, unpaid invoices and overpayments automatically, even without a matching payment reference.',
    de: 'Automatisch abgeglichene Zahlungen, unbezahlte Rechnungen und Überzahlungen, auch ohne übereinstimmenden Verwendungszweck.',
  },

  // ── section 02: Pro pricing ──────────────────────────────────────────
  's2.h2': { sk: '9 € mesačne, alebo 79 € ročne za všetky štyri.', en: '€9 a month, or €79 a year for all four.', de: '9 €/Monat oder 79 €/Jahr für alle vier.' },
  's2.sub': {
    sk: 'Jedna platba, jedna licencia, žiadne obmedzenie na počet nástrojov ani zariadení. DPH v cene, faktúru pošle Stripe hneď po zaplatení, zrušiť môžete kedykoľvek.',
    en: 'One payment, one licence, no limit on the number of tools or devices. VAT included, Stripe sends the invoice right after payment, cancel anytime.',
    de: 'Eine Zahlung, eine Lizenz, keine Begrenzung bei der Anzahl der Tools oder Geräte. Inklusive MwSt., die Rechnung stellt Stripe sofort nach der Zahlung, jederzeit kündbar.',
  },
  's2.badge.recommended': { sk: 'Odporúčané, ušetríte 29 €', en: 'Recommended, save €29', de: 'Empfohlen, sparen Sie 29 €' },
  's2.year.unit': { sk: '/ rok', en: '/ year', de: '/ Jahr' },
  's2.year.save': {
    sk: 'Oproti mesačnej platbe ušetríte 29 € za rok.',
    en: 'Compared to paying monthly, you save €29 a year.',
    de: 'Im Vergleich zur monatlichen Zahlung sparen Sie 29 € pro Jahr.',
  },
  's2.year.btn': { sk: 'Kúpiť Pro, 79 €/rok', en: 'Buy Pro, €79/year', de: 'Pro kaufen, 79 €/Jahr' },
  's2.fineprint': {
    sk: 'Platba cez Stripe. Zrušiť môžete kedykoľvek, ďalšie obdobie sa už nestrhne.',
    en: 'Payment via Stripe. Cancel anytime, the next period will not be charged.',
    de: 'Zahlung über Stripe. Jederzeit kündbar, der nächste Zeitraum wird dann nicht mehr abgebucht.',
  },
  's2.month.unit': { sk: '/ mesiac', en: '/ month', de: '/ Monat' },
  's2.month.btn': { sk: 'Kúpiť Pro, 9 €/mesiac', en: 'Buy Pro, €9/month', de: 'Pro kaufen, 9 €/Monat' },
  's2.objections.label': { sk: 'Predtým, než kúpite', en: 'Before you buy', de: 'Bevor Sie kaufen' },

  'obj1.q': { sk: 'Sú moje dáta v bezpečí?', en: 'Is my data safe?', de: 'Sind meine Daten sicher?' },
  'obj1.a': {
    sk: 'Táto stránka sama osebe nespracováva žiadne platby ani výpisy, len spravuje licenciu. Spracovanie IBAN, súm a výpisov beží v jednotlivých nástrojoch celé vo vašom prehliadači, nič z toho sa neodosiela.',
    en: 'This page itself does not process any payments or statements, it only manages the licence. Processing IBANs, amounts and statements runs entirely in your browser inside each tool; none of it is uploaded.',
    de: 'Diese Seite selbst verarbeitet keine Zahlungen oder Kontoauszüge, sie verwaltet nur die Lizenz. Die Verarbeitung von IBAN, Beträgen und Auszügen läuft in den einzelnen Tools vollständig in Ihrem Browser, nichts davon wird hochgeladen.',
  },
  'obj2.q': {
    sk: 'Čo ak mi Pro nesadne alebo niektorý nástroj nefunguje?',
    en: 'What if Pro is not for me, or a tool does not work?',
    de: 'Was, wenn mir Pro nicht zusagt oder ein Tool nicht funktioniert?',
  },
  'obj2.a': {
    sk: 'Napíšte na andrej@arling.sk. Chybu, ktorú niektorý z nástrojov spracoval zle, opravíme prednostne; ak vám Pro jednoducho nesadne, do 14 dní od kúpy peniaze vrátime bez zbytočných otázok.',
    en: 'Write to andrej@arling.sk. A bug in any of the tools gets fixed with priority; if Pro simply is not for you, we refund the payment within 14 days of purchase, no questions asked.',
    de: 'Schreiben Sie an andrej@arling.sk. Einen Fehler, den eines der Tools falsch verarbeitet hat, beheben wir bevorzugt; wenn Pro einfach nicht passt, erstatten wir die Zahlung innerhalb von 14 Tagen nach dem Kauf ohne weitere Fragen.',
  },
  'obj3.q': { sk: 'Ako predplatné zrušiť?', en: 'How do I cancel the subscription?', de: 'Wie kündige ich das Abo?' },
  'obj3.a': {
    sk: 'Mesačné aj ročné predplatné môžete kedykoľvek zrušiť cez odkaz na správu platby, ktorý dostanete v e-maile od Stripe po zaplatení. Ďalšie obdobie sa už nestrhne, nič netreba nám hlásiť.',
    en: 'Both the monthly and yearly subscription can be cancelled anytime via the payment management link you get in the email from Stripe after paying. The next period will not be charged; you do not need to tell us anything.',
    de: 'Sowohl das monatliche als auch das jährliche Abo können Sie jederzeit über den Link zur Zahlungsverwaltung kündigen, den Sie nach der Zahlung per E-Mail von Stripe erhalten. Der nächste Zeitraum wird dann nicht mehr abgebucht, Sie müssen uns nichts melden.',
  },
  'obj4.q': { sk: 'Čo presne je zadarmo?', en: 'What exactly is free?', de: 'Was genau ist kostenlos?' },
  'obj4.a': {
    sk: 'Každý zo štyroch nástrojov (SEPA pain.001 Doctor, SEPA pain.001 Generátor, camt.053 do Excelu, Párovač platieb) má free verziu bez limitu na počet použití, súborov ani stiahnutí, navždy. Pro pridáva len pohodlie pri opakovanom mesačnom spracovaní.',
    en: 'Each of the four tools (SEPA pain.001 Doctor, SEPA pain.001 Generator, camt.053 to Excel, Payment matcher) has a free version with no limit on uses, files or downloads, forever. Pro only adds convenience for repeated monthly processing.',
    de: 'Jedes der vier Tools (SEPA pain.001 Doctor, SEPA-pain.001-Generator, camt.053 nach Excel, Zahlungsabgleich) hat eine kostenlose Version ohne Limit bei Nutzung, Dateien oder Downloads, dauerhaft. Pro fügt nur Komfort für die wiederkehrende monatliche Verarbeitung hinzu.',
  },

  // ── section 03: Pro benefits ─────────────────────────────────────────
  's3.h2': { sk: 'Čo Pro pridá vo všetkých štyroch nástrojoch.', en: 'What Pro adds across all four tools.', de: 'Was Pro in allen vier Tools hinzufügt.' },
  's3.sub': {
    sk: 'Pohodlie pre opakované mesačné spracovanie, nie odomknutá funkčnosť. Free verzia každého nástroja ostáva bez limitov.',
    en: 'Convenience for repeated monthly processing, not unlocked functionality. The free version of every tool stays unlimited.',
    de: 'Komfort für die wiederkehrende monatliche Verarbeitung, keine freigeschaltete Funktion. Die kostenlose Version jedes Tools bleibt unbegrenzt.',
  },
  'r1.title': { sk: 'Uložené profily platiteľov.', en: 'Saved payer profiles.', de: 'Gespeicherte Zahlerprofile.' },
  'r1.body': {
    sk: 'Meno firmy, IBAN, BIC a banka na jeden klik v generátore aj v párovači, bez prepisovania pri každom použití.',
    en: 'Company name, IBAN, BIC and bank in one click in both the Generator and the matcher, no retyping every time.',
    de: 'Firmenname, IBAN, BIC und Bank per Klick im Generator und im Zahlungsabgleich, ohne erneutes Eintippen bei jeder Nutzung.',
  },
  'r2.title': { sk: 'Viac súborov a účtov naraz.', en: 'Several files and accounts at once.', de: 'Mehrere Dateien und Konten gleichzeitig.' },
  'r2.body': {
    sk: 'Viac výpisov, hromadných príkazov alebo bankových účtov v jednej dávke namiesto spracovania po jednom.',
    en: 'Several statements, batch payment files or bank accounts in one batch instead of processing them one by one.',
    de: 'Mehrere Auszüge, Sammelüberweisungen oder Bankkonten in einem Durchgang statt einzeln.',
  },
  'r3.title': { sk: 'Šablóny pre Pohodu, Omegu a Money S3.', en: 'Presets for Pohoda, Omega and Money S3.', de: 'Vorlagen für Pohoda, Omega und Money S3.' },
  'r3.body': {
    sk: 'Predvolené mapovanie stĺpcov pre exporty z týchto troch účtovných programov, na jeden klik namiesto ručného nastavovania.',
    en: 'Default column mapping for exports from these three Slovak/Czech accounting programs, in one click instead of setting it up by hand. camt.053 to Excel separately offers DATEV, Lexware and sevDesk presets.',
    de: 'Voreingestelltes Spalten-Mapping für Exporte aus diesen drei slowakischen/tschechischen Buchhaltungsprogrammen, per Klick statt manueller Einrichtung. camt.053 nach Excel bietet zusätzlich Vorlagen für DATEV, Lexware und sevDesk.',
  },
  'r6.title': { sk: 'MT940 a DATEV Buchungsstapel z camt.053.', en: 'MT940 and DATEV Buchungsstapel from camt.053.', de: 'MT940 und DATEV Buchungsstapel aus camt.053.' },
  'r6.body': {
    sk: 'Výpis vo formáte camt.053 prevediete aj na MT940 (.sta) alebo priamo na DATEV Buchungsstapel (EXTF CSV) v nástroji camt.053 do Excelu. <a href="https://arling.sk/camt053-to-excel/mt940/">Viac o MT940 a DATEV</a>.',
    en: 'Convert a camt.053 statement to MT940 (.sta) or straight to DATEV Buchungsstapel (EXTF CSV) in the camt.053 to Excel tool. <a href="https://arling.sk/camt053-to-excel/mt940/">More on MT940 and DATEV</a>.',
    de: 'Kontoauszug im Format camt.053 auch nach MT940 (.sta) oder direkt nach DATEV Buchungsstapel (EXTF CSV) umwandeln, im Tool camt.053 nach Excel. <a href="https://arling.sk/camt053-to-excel/mt940/">Mehr zu MT940 und DATEV</a>.',
  },
  'r4.title': { sk: 'História.', en: 'History.', de: 'Verlauf.' },
  'r4.body': {
    sk: 'Posledné spracovania v každom nástroji uložené vo vašom prehliadači, s možnosťou znova stiahnuť.',
    en: 'The most recent runs in every tool, stored in your browser, downloadable again anytime.',
    de: 'Die letzten Verarbeitungen in jedem Tool, in Ihrem Browser gespeichert, jederzeit erneut herunterladbar.',
  },
  'r5.title': { sk: 'Prednostná podpora e-mailom.', en: 'Priority email support.', de: 'Bevorzugter E-Mail-Support.' },
  'r5.body': {
    sk: 'Otázka alebo prípad, ktorý si niektorý z nástrojov pomýlil? Odpoveď prednostne, priamo od autora nástrojov.',
    en: 'A question, or a case one of the tools got wrong? A priority reply, directly from the tools’ author.',
    de: 'Eine Frage, oder ein Fall, den eines der Tools falsch verarbeitet hat? Eine bevorzugte Antwort, direkt vom Autor der Tools.',
  },
  's3.note': {
    sk: 'Free verzia každého zo štyroch nástrojov ostáva bez limitov na počet použití, súborov ani stiahnutí, navždy.',
    en: 'The free version of each of the four tools stays unlimited in uses, files and downloads, forever.',
    de: 'Die kostenlose Version jedes der vier Tools bleibt unbegrenzt bei Nutzung, Dateien und Downloads, dauerhaft.',
  },

  // ── section 04: licence ──────────────────────────────────────────────
  's4.h2': { sk: 'Aktivujte alebo spravujte licenciu.', en: 'Activate or manage your licence.', de: 'Lizenz aktivieren oder verwalten.' },
  's4.sub': {
    sk: 'Po zaplatení sa stránka vráti sem a licenciu aktivuje sama, nič netreba kopírovať. Licenciu z iného počítača vložte ručne nižšie.',
    en: 'After payment the page comes back here and activates the licence by itself, nothing to copy. Paste a licence from another computer manually below.',
    de: 'Nach der Zahlung kehrt die Seite hierher zurück und aktiviert die Lizenz von selbst, nichts muss kopiert werden. Eine Lizenz von einem anderen Computer fügen Sie unten manuell ein.',
  },
  's4.licence.manual.label': {
    sk: 'Licenciu ste kúpili na inom počítači? Vložte licenčný kľúč sem.',
    en: 'Bought the licence on another computer? Paste the licence key here.',
    de: 'Lizenz auf einem anderen Computer gekauft? Lizenzschlüssel hier einfügen.',
  },
  's4.licence.input.placeholder': {
    sk: 'Licenčný kľúč (dlhý reťazec s bodkou uprostred)',
    en: 'Licence key (a long string with a dot in the middle)',
    de: 'Lizenzschlüssel (langer Text mit Punkt in der Mitte)',
  },
  's4.licence.activate.btn': { sk: 'Aktivovať', en: 'Activate', de: 'Aktivieren' },
  's4.licence.remove.btn': { sk: 'Odstrániť licenciu', en: 'Remove licence', de: 'Lizenz entfernen' },
  's4.crosstool.p': {
    sk: 'Tento istý kľúč funguje aj priamo v každom zo štyroch nástrojov, stačí ho vložiť raz (tu alebo v ktoromkoľvek z nich):',
    en: 'This same key also works directly in each of the four tools, just paste it once (here or in any of them):',
    de: 'Derselbe Schlüssel funktioniert auch direkt in jedem der vier Tools, einmal einfügen genügt (hier oder in einem von ihnen):',
  },

  // ── section 05: ask / subscribe / business ──────────────────────────
  's5.h2': {
    sk: 'Dajte nám vedieť, alebo napíšte, čo potrebujete.',
    en: 'Let us know, or tell us what you need.',
    de: 'Sagen Sie uns Bescheid, oder schreiben Sie, was Sie brauchen.',
  },
  's5.sub': {
    sk: 'Free verzia každého nástroja ostáva bez limitov, bez účtu, bez platby.',
    en: 'The free version of every tool stays unlimited, no account, no payment.',
    de: 'Die kostenlose Version jedes Tools bleibt unbegrenzt, ohne Konto, ohne Zahlung.',
  },
  's5.subscribe.p': {
    sk: '<b>Dajte mi vedieť o novom nástroji.</b> Len nové nástroje. Žiadny newsletter, žiadne zdieľanie. Odhlásenie odpoveďou na mail.',
    en: '<b>Let me know about a new tool.</b> New tools only. No newsletter, no sharing. Unsubscribe by replying to the email.',
    de: '<b>Informieren Sie mich über ein neues Tool.</b> Nur neue Tools. Kein Newsletter, keine Weitergabe. Abmeldung per Antwort auf die E-Mail.',
  },
  's5.subscribe.email.placeholder': { sk: 'vas@email.sk', en: 'you@email.com', de: 'ihre@email.de' },
  's5.subscribe.email.aria': { sk: 'E-mailová adresa', en: 'Email address', de: 'E-Mail-Adresse' },
  's5.subscribe.btn': { sk: 'Dať vedieť', en: 'Notify me', de: 'Benachrichtigen' },
  's5.subscribe.thanks': {
    sk: 'Ďakujeme. Ozveme sa len vtedy, keď bude niečo nové.',
    en: 'Thanks. We will only write when there is something new.',
    de: 'Danke. Wir melden uns nur, wenn es etwas Neues gibt.',
  },
  's5.subscribe.error': {
    sk: 'Nepodarilo sa uložiť. Napíšte na <a href="mailto:andrej@arling.sk">andrej@arling.sk</a>.',
    en: 'Could not save it. Please write to <a href="mailto:andrej@arling.sk">andrej@arling.sk</a>.',
    de: 'Speichern fehlgeschlagen. Bitte schreiben Sie an <a href="mailto:andrej@arling.sk">andrej@arling.sk</a>.',
  },
  's5.subscribe.privacy': { sk: 'Súkromie', en: 'Privacy', de: 'Datenschutz' },
  's5.business.p': {
    sk: '<b>Potrebujete to pre firmu alebo účtovnú kanceláriu?</b> Viac licencií naraz, fakturácia na firmu, prípadne API. Napíšte, čo potrebujete, a odpovieme do 24 hodín.',
    en: '<b>Need this for a company or an accounting office?</b> Several licences at once, invoicing to a company, or an API. Tell us what you need and we will reply within 24 hours.',
    de: '<b>Brauchen Sie das für ein Unternehmen oder ein Buchhaltungsbüro?</b> Mehrere Lizenzen auf einmal, Rechnung an ein Unternehmen, eventuell eine API. Schreiben Sie uns Ihren Bedarf, wir antworten innerhalb von 24 Stunden.',
  },
  's5.business.btn': { sk: 'Napísať, čo potrebujem', en: 'Tell us what you need', de: 'Schreiben Sie uns Ihren Bedarf' },
  's5.business.subject': { sk: 'Bankové nástroje pre firmu', en: 'Banking tools for a business', de: 'Banktools für ein Unternehmen' },

  // ── section 06: FAQ ──────────────────────────────────────────────────
  's6.h2': { sk: 'Otázky, ktoré ľudia naozaj hľadajú.', en: 'Questions people actually search for.', de: 'Fragen, die wirklich gestellt werden.' },
  's6.sub': {
    sk: 'Priame odpovede o balíku a jednej licencii pre štyri nástroje.',
    en: 'Direct answers about the bundle and one licence for four tools.',
    de: 'Direkte Antworten zum Paket und einer Lizenz für vier Tools.',
  },
  'faq.q1': { sk: 'Čo presne dostanem v balíku Bankové nástroje?', en: 'What exactly do I get in the Banking tools bundle?', de: 'Was genau bekomme ich im Banktools-Paket?' },
  'faq.a1': {
    sk: 'Jednu Pro licenciu platnú vo všetkých štyroch nástrojoch naraz: SEPA pain.001 Doctor, SEPA pain.001 Generátor, camt.053 do Excelu a Párovač platieb. Free verzia každého z nich ostáva bez limitov navždy. Pro pridáva pohodlie: uložené profily platiteľov, viac súborov a účtov naraz, šablóny mapovania pre Pohodu, Omegu (KROS) a Money S3, históriu spracovaní a prednostnú e-mailovú podporu.',
    en: 'One Pro licence valid across all four tools at once: SEPA pain.001 Doctor, SEPA pain.001 Generator, camt.053 to Excel and Payment matcher. The free version of each stays unlimited forever. Pro adds convenience: saved payer profiles, several files and accounts at once, mapping presets for Pohoda, Omega (KROS) and Money S3, a processing history, and priority email support.',
    de: 'Eine Pro-Lizenz, gültig in allen vier Tools gleichzeitig: SEPA pain.001 Doctor, SEPA-pain.001-Generator, camt.053 nach Excel und Zahlungsabgleich. Die kostenlose Version jedes einzelnen bleibt dauerhaft unbegrenzt. Pro fügt Komfort hinzu: gespeicherte Zahlerprofile, mehrere Dateien und Konten gleichzeitig, Mapping-Vorlagen für Pohoda, Omega (KROS) und Money S3, einen Verarbeitungsverlauf und bevorzugten E-Mail-Support.',
  },
  'faq.q2': { sk: 'Ako funguje jedna licencia pre štyri nástroje?', en: 'How does one licence for four tools work?', de: 'Wie funktioniert eine Lizenz für vier Tools?' },
  'faq.a2': {
    sk: 'Po zaplatení sa vygeneruje jeden podpísaný licenčný kľúč, ktorý sa uloží do prehliadača. Všetky štyri nástroje bežia na tej istej doméne arling.sk, takže kľúč uložený na jednej z ich stránok automaticky funguje aj na ostatných. Ak sa to z nejakého dôvodu nestane samo (iný prehliadač, vymazané dáta stránky), kľúč sa dá kedykoľvek vložiť ručne v <a href="#licence">sekcii Licencia</a> vyššie alebo priamo v ktoromkoľvek zo štyroch nástrojov.',
    en: 'After payment, one signed licence key is generated and stored in your browser. All four tools run on the same domain, arling.sk, so a key stored on one of their pages automatically works on the rest. If that does not happen by itself for some reason (a different browser, cleared site data), the key can always be pasted in manually in the <a href="#licence">Licence section</a> above, or directly in any of the four tools.',
    de: 'Nach der Zahlung wird ein signierter Lizenzschlüssel erzeugt und im Browser gespeichert. Alle vier Tools laufen auf derselben Domain arling.sk, sodass ein auf einer ihrer Seiten gespeicherter Schlüssel automatisch auch auf den anderen funktioniert. Falls das aus irgendeinem Grund nicht von selbst geschieht (anderer Browser, gelöschte Website-Daten), kann der Schlüssel jederzeit manuell im <a href="#licence">Abschnitt Lizenz</a> oben oder direkt in einem der vier Tools eingefügt werden.',
  },
  'faq.q3': { sk: 'Odosielajú sa moje dáta niekam?', en: 'Is my data sent anywhere?', de: 'Werden meine Daten irgendwohin gesendet?' },
  'faq.a3': {
    sk: 'Táto stránka sama osebe nespracováva žiadne platby ani výpisy, len spravuje licenciu. Spracovanie IBAN, súm a výpisov beží v jednotlivých nástrojoch celé vo vašom prehliadači, nič z toho sa neodosiela. Jediná sieťová aktivita tejto stránky je overenie licenčného kľúča po zaplatení a anonymné počítadlo použitia cez self-hosted Umami.',
    en: 'This page itself does not process any payments or statements, it only manages the licence. Processing IBANs, amounts and statements runs entirely in your browser inside each tool; none of it is uploaded. The only network activity on this page is verifying the licence key after payment and an anonymous usage counter via self-hosted Umami.',
    de: 'Diese Seite selbst verarbeitet keine Zahlungen oder Kontoauszüge, sie verwaltet nur die Lizenz. Die Verarbeitung von IBAN, Beträgen und Auszügen läuft in den einzelnen Tools vollständig in Ihrem Browser, nichts davon wird hochgeladen. Die einzige Netzwerkaktivität dieser Seite ist die Überprüfung des Lizenzschlüssels nach der Zahlung und ein anonymer Nutzungszähler über das selbst gehostete Umami.',
  },
  'faq.q4': { sk: 'Čo ak chcem len jeden z nástrojov, nie všetky štyri?', en: 'What if I only want one of the tools, not all four?', de: 'Was, wenn ich nur eines der Tools möchte, nicht alle vier?' },
  'faq.a4': {
    sk: 'Každý zo štyroch nástrojov má free verziu bez limitu na počet použití, súborov ani stiahnutí, nezávisle od tejto stránky. Balík Bankové nástroje sa oplatí, keď opakovane používate aspoň dva z nich; ak vám na príležitostné použitie stačí jeden nástroj, free verzia je presne na to určená a Pro nepotrebujete.',
    en: 'Each of the four tools has a free version with no limit on uses, files or downloads, independent of this page. The Banking tools bundle pays off once you repeatedly use at least two of them; if the free version is enough for occasional use of one tool, that is exactly what it is for, and you do not need Pro.',
    de: 'Jedes der vier Tools hat eine kostenlose Version ohne Limit bei Nutzung, Dateien oder Downloads, unabhängig von dieser Seite. Das Banktools-Paket lohnt sich, sobald Sie mindestens zwei davon wiederholt nutzen; reicht Ihnen die kostenlose Version für die gelegentliche Nutzung eines Tools, ist genau dafür sie gedacht, und Sie brauchen Pro nicht.',
  },
  'faq.q5': { sk: 'Ako dostanem faktúru?', en: 'How do I get an invoice?', de: 'Wie bekomme ich eine Rechnung?' },
  'faq.a5': {
    sk: 'Faktúru vystaví a pošle na váš e-mail Stripe hneď po zaplatení. Pri tomto predaji je ARLing s. r. o. predajcom cez Stripe Managed Payments: DPH aj vystavenie dokladu rieši priamo Stripe.',
    en: 'Stripe issues and sends the invoice to your email right after payment. For this sale, ARLing s. r. o. sells through Stripe Managed Payments: Stripe handles both the VAT and issuing the document directly.',
    de: 'Stripe stellt die Rechnung aus und sendet sie sofort nach der Zahlung an Ihre E-Mail-Adresse. Bei diesem Verkauf tritt ARLing s. r. o. als Verkäufer über Stripe Managed Payments auf: Stripe übernimmt sowohl die MwSt. als auch die Ausstellung des Belegs direkt.',
  },
  'faq.q6': { sk: 'Môžem licenciu zrušiť alebo dostať peniaze naspäť?', en: 'Can I cancel the licence or get a refund?', de: 'Kann ich die Lizenz kündigen oder eine Rückerstattung bekommen?' },
  'faq.a6': {
    sk: 'Mesačné aj ročné predplatné môžete kedykoľvek zrušiť cez odkaz na správu platby, ktorý dostanete v e-maile od Stripe po zaplatení; ďalšie obdobie sa už nestrhne. Ak vám Pro nesadne, napíšte do 14 dní od kúpy na <a href="mailto:andrej@arling.sk?subject=Vr%C3%A1tenie%20Pro%20licencie">andrej@arling.sk</a> a peniaze vrátime bez zbytočných otázok.',
    en: 'Both the monthly and yearly subscription can be cancelled anytime via the payment management link you get in the email from Stripe after paying; the next period will not be charged. If Pro is not for you, write within 14 days of purchase to <a href="mailto:andrej@arling.sk?subject=Vr%C3%A1tenie%20Pro%20licencie">andrej@arling.sk</a> and we will refund the payment, no questions asked.',
    de: 'Sowohl das monatliche als auch das jährliche Abo können Sie jederzeit über den Link zur Zahlungsverwaltung kündigen, den Sie nach der Zahlung per E-Mail von Stripe erhalten; der nächste Zeitraum wird dann nicht mehr abgebucht. Wenn Pro nicht passt, schreiben Sie innerhalb von 14 Tagen nach dem Kauf an <a href="mailto:andrej@arling.sk?subject=Vr%C3%A1tenie%20Pro%20licencie">andrej@arling.sk</a>, und wir erstatten die Zahlung ohne weitere Fragen.',
  },

  // ── closing CTA ──────────────────────────────────────────────────────
  's7.sub': {
    sk: 'Štyri nástroje na prácu s bankou, jedna licencia za 9 € mesačne alebo 79 € ročne. Free verzie ostávajú bez limitov navždy.',
    en: 'Four tools for working with your bank, one licence for €9 a month or €79 a year. Free versions stay unlimited forever.',
    de: 'Vier Tools für die Arbeit mit der Bank, eine Lizenz für 9 €/Monat oder 79 €/Jahr. Die kostenlosen Versionen bleiben dauerhaft unbegrenzt.',
  },

  // ── sticky mobile buy bar ────────────────────────────────────────────
  'sticky.text': {
    sk: 'Pro pre všetky štyri nástroje: 9 €/mesiac alebo 79 €/rok.',
    en: 'Pro for all four tools: €9/month or €79/year.',
    de: 'Pro für alle vier Tools: 9 €/Monat oder 79 €/Jahr.',
  },
  'sticky.close.aria': { sk: 'Zavrieť lištu', en: 'Close the bar', de: 'Leiste schließen' },

  // ── footer ───────────────────────────────────────────────────────────
  'footer.tools.label': { sk: 'Štyri nástroje:', en: 'Four tools:', de: 'Vier Tools:' },
  'footer.all.tools': { sk: 'Všetky nástroje ARLing', en: 'All ARLing tools', de: 'Alle ARLing-Tools' },
  'footer.privacy': { sk: 'Súkromie', en: 'Privacy', de: 'Datenschutz' },
  'footer.country': { sk: 'Slovensko', en: 'Slovakia', de: 'Slowakei' },
  'footer.note': {
    sk: 'Nič neopúšťa váš prehliadač okrem anonymných počtov použitia cez self-hosted Umami, overenia licenčného kľúča po zaplatení a e-mailu, ak sa prihlásite na odber nižšie.',
    en: 'Nothing leaves your browser except anonymous usage counts via self-hosted Umami, verifying the licence key after payment, and an email address if you sign up for updates below.',
    de: 'Nichts verlässt Ihren Browser außer anonymen Nutzungszahlen über das selbst gehostete Umami, der Überprüfung des Lizenzschlüssels nach der Zahlung und einer E-Mail-Adresse, falls Sie sich unten anmelden.',
  },

  // ── dynamic JS strings (licence status, errors) ─────────────────────
  'js.status.noLicence': { sk: 'bez licencie', en: 'no licence', de: 'keine Lizenz' },
  'js.status.proActive': { sk: 'Pro aktívne', en: 'Pro active', de: 'Pro aktiv' },
  'js.status.activating': { sk: 'aktivujem…', en: 'activating…', de: 'aktiviere…' },

  'js.licence.reason.expired': { sk: 'licencia vypršala', en: 'licence expired', de: 'Lizenz abgelaufen' },
  'js.licence.reason.signature': { sk: 'neplatný kľúč', en: 'invalid key', de: 'ungültiger Schlüssel' },
  'js.licence.reason.plan': { sk: 'kľúč pre iný produkt', en: 'key for a different product', de: 'Schlüssel für ein anderes Produkt' },
  'js.licence.reason.malformed': { sk: 'neplatný kľúč', en: 'invalid key', de: 'ungültiger Schlüssel' },
  'js.licence.reason.unsupported': { sk: 'prehliadač nepodporovaný', en: 'browser not supported', de: 'Browser nicht unterstützt' },
  'js.licence.reason.default': { sk: 'neplatná licencia', en: 'invalid licence', de: 'ungültige Lizenz' },

  'js.licence.detail.unsupported': {
    sk: 'Overenie licencie vyžaduje aktuálny prehliadač s podporou WebCrypto Ed25519 (Chrome, Firefox alebo Safari 17+). Aktualizujte prehliadač a skúste znova.',
    en: 'Verifying the licence needs a current browser with WebCrypto Ed25519 support (Chrome, Firefox or Safari 17+). Update your browser and try again.',
    de: 'Die Überprüfung der Lizenz benötigt einen aktuellen Browser mit WebCrypto-Ed25519-Unterstützung (Chrome, Firefox oder Safari 17+). Aktualisieren Sie Ihren Browser und versuchen Sie es erneut.',
  },
  'js.licence.detail.expired': {
    sk: 'Táto licencia už vypršala. Kúpou novej licencie ju obnovíte.',
    en: 'This licence has already expired. Buying a new licence renews it.',
    de: 'Diese Lizenz ist bereits abgelaufen. Mit dem Kauf einer neuen Lizenz wird sie erneuert.',
  },
  'js.licence.detail.plan': {
    sk: 'Tento kľúč platí pre iný produkt ARLing, nie pre balík Bankové nástroje.',
    en: 'This key is valid for a different ARLing product, not the Banking tools bundle.',
    de: 'Dieser Schlüssel gilt für ein anderes ARLing-Produkt, nicht für das Banktools-Paket.',
  },
  'js.licence.detail.malformed': {
    sk: 'Kľúč sa nepodarilo prečítať, skontrolujte, či ste ho skopírovali celý.',
    en: 'The key could not be read. Check that you copied it in full.',
    de: 'Der Schlüssel konnte nicht gelesen werden. Prüfen Sie, ob Sie ihn vollständig kopiert haben.',
  },
  'js.licence.detail.default': { sk: 'Kľúč sa nepodarilo overiť.', en: 'The key could not be verified.', de: 'Der Schlüssel konnte nicht überprüft werden.' },

  'js.licence.validUntil': { sk: 'Licencia platná do {date}.', en: 'Licence valid until {date}.', de: 'Lizenz gültig bis {date}.' },
  'js.licence.removeConfirm': { sk: 'Odstrániť licenciu z tohto prehliadača?', en: 'Remove the licence from this browser?', de: 'Lizenz aus diesem Browser entfernen?' },

  'js.error.licenceKeyMissing': { sk: 'Vložte licenčný kľúč.', en: 'Paste a licence key.', de: 'Lizenzschlüssel einfügen.' },
  'js.error.activationFailed': {
    sk: 'Aktivácia zlyhala. Skúste vložiť kľúč ručne nižšie, alebo napíšte na andrej@arling.sk.',
    en: 'Activation failed. Try pasting the key manually below, or write to andrej@arling.sk.',
    de: 'Aktivierung fehlgeschlagen. Versuchen Sie, den Schlüssel unten manuell einzufügen, oder schreiben Sie an andrej@arling.sk.',
  },
  'js.already.note': {
    sk: 'Pro už máte aktívne, platná do {date}. Kúpou novej licencie predĺžite alebo zmeníte plán.',
    en: 'You already have Pro active, valid until {date}. Buying a new licence extends or changes the plan.',
    de: 'Sie haben Pro bereits aktiv, gültig bis {date}. Mit dem Kauf einer neuen Lizenz verlängern oder ändern Sie den Plan.',
  },

  // ── meta / SEO ───────────────────────────────────────────────────────
  'meta.title': {
    sk: 'Bankové nástroje pre účtovníkov: jedna Pro licencia pre štyri nástroje',
    en: 'Bank tools for accountants: one Pro licence for four tools',
    de: 'Bankwerkzeuge für die Buchhaltung: eine Pro-Lizenz für vier Tools',
  },
  'meta.description': {
    sk: 'SEPA pain.001 Doctor, SEPA pain.001 Generátor, camt.053 do Excelu a Párovač platieb: štyri nástroje na prácu s bankou, jedna Pro licencia za 9 € mesačne alebo 79 € ročne. Free verzie ostávajú bez limitov, nič sa neodosiela.',
    en: 'SEPA pain.001 Doctor, SEPA pain.001 Generator, camt.053 to Excel and Payment matcher: four tools for working with your bank, one Pro licence for €9 a month or €79 a year. Free versions stay unlimited, nothing is uploaded.',
    de: 'SEPA pain.001 Doctor, SEPA-pain.001-Generator, camt.053 nach Excel und Zahlungsabgleich: vier Tools für die Arbeit mit der Bank, eine Pro-Lizenz für 9 €/Monat oder 79 €/Jahr. Die kostenlosen Versionen bleiben unbegrenzt, nichts wird hochgeladen.',
  },
};

// ─────────────────────────────── pure helpers ───────────────────────────────

// The page's "active" language. Every helper below that takes an optional
// `lang` argument falls back to this, NOT to DEFAULT_LANG, when `lang` is
// omitted or unrecognized. Stays 'en' (DEFAULT_LANG) for the whole process
// under Node, so an explicit-lang assertion in a verify script is
// unaffected.
let currentLang = DEFAULT_LANG;

/** Current active language (see currentLang above). */
export function getLang() {
  return currentLang;
}

function resolveLang(lang) {
  return LANGS.includes(lang) ? lang : currentLang;
}

/** True/false without throwing on a non-string. */
function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

/** Resolves a locale tag (e.g. "de-DE", "cs-CZ", "fr-FR") to one of LANGS. */
export function langFromLocale(tag) {
  const s = String(tag || '').toLowerCase();
  if (s.startsWith('de')) return 'de';
  if (s.startsWith('sk') || s.startsWith('cs')) return 'sk';
  return DEFAULT_LANG;
}

/** Translates one dictionary key. Unknown key returns the key itself so a
 * missing translation is visible instead of silently blank. Omitting
 * `lang` uses the page's current active language (see resolveLang above). */
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

/** "2026-09-02" -> "02.09.2026" for sk/de, unchanged (already ISO) for en. */
export function formatDateForLang(iso, lang) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (!m) return iso || '';
  const l = resolveLang(lang);
  return l === 'en' ? `${m[1]}-${m[2]}-${m[3]}` : `${m[3]}.${m[2]}.${m[1]}`;
}

export function ogLocaleForLang(lang) {
  const l = resolveLang(lang);
  return l === 'sk' ? 'sk_SK' : l === 'de' ? 'de_DE' : 'en_US';
}

/** Every DICT entry has a non-empty string for every LANGS member. Used
 * both by a verify-i18n script and by anyone importing this module. */
export function findIncompleteEntries() {
  const bad = [];
  Object.keys(DICT).forEach((key) => {
    const entry = DICT[key];
    LANGS.forEach((l) => {
      if (!isNonEmptyString(entry[l])) bad.push(`${key}.${l}`);
    });
  });
  return bad;
}

/** Reads ?lang= from a query string (no DOM/location dependency), for
 * both the browser bootstrap below and any test script. */
export function langFromQueryString(search) {
  try {
    const params = new URLSearchParams(search || '');
    const q = (params.get('lang') || '').toLowerCase();
    return LANGS.includes(q) ? q : null;
  } catch (e) {
    return null;
  }
}

// ─────────────────────────────── DOM engine ────────────────────────────────
// Everything below touches document/window/localStorage/navigator and only
// ever runs in a browser; every access is guarded so importing this module
// under Node stays side-effect-free beyond the pure helpers above.

function readStoredLang() {
  try {
    if (typeof localStorage === 'undefined' || !localStorage) return null;
    const v = localStorage.getItem(STORAGE_KEY);
    return LANGS.includes(v) ? v : null;
  } catch (e) {
    return null;
  }
}

/** Query param wins, then localStorage, then navigator.language, then
 * DEFAULT_LANG ("en", per the brief: de -> DE, sk/cs -> SK, else EN). */
export function detectLang() {
  try {
    if (typeof location !== 'undefined') {
      const fromQuery = langFromQueryString(location.search);
      if (fromQuery) return fromQuery;
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
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => { el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder'), l)); });
  document.querySelectorAll('[data-i18n-aria-label]').forEach((el) => { el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria-label'), l)); });
  document.querySelectorAll('[data-i18n-alt]').forEach((el) => { el.setAttribute('alt', t(el.getAttribute('data-i18n-alt'), l)); });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => { el.setAttribute('title', t(el.getAttribute('data-i18n-title'), l)); });

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

  const businessLink = document.getElementById('business-link');
  if (businessLink) {
    businessLink.href = 'mailto:andrej@arling.sk?subject=' + encodeURIComponent(t('s5.business.subject', l));
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

if (typeof document !== 'undefined') {
  const boot = () => {
    wireLangSwitch();
    setLang(detectLang());
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}
