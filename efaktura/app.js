/* E-faktura: kontrola, nahlad a generator UBL 2.1.
 *
 * Vsetko sa deje v prehliadaci. Subor sa cita cez FileReader, pravidla bezia
 * tu (pravidla.mjs), XML vznika tu (ubl.js) a doklad sa vykresluje tu
 * (nahlad.js). Na server neodchadza nic okrem overenia platby: po navrate zo
 * Stripe (?session_id=) sa worker spyta, ci je session zaplatena a na aku sumu
 * (GET /v1/kontrola/status). Rovnaky postup ako na /gdpr-dokumenty/.
 *
 * Slovenska, ceska aj nemecka stranka pouzivaju tento jeden skript; lisia sa
 * len textami v objekte T a atributom lang na <html>.
 *
 * Udalosti do Umami (ak bezi): efaktura_kontrola, efaktura_nahlad,
 * efaktura_vytvorit_nahlad, efaktura_kupa_click, efaktura_zaplatene,
 * efaktura_stiahnute, plus spolocne nastroj_pouzity a cena_videna.
 */
import { skontroluj, protokol } from './pravidla.mjs';
import * as K from './kodovniky.mjs';
import { parsujXml } from './parser.mjs';
import { vytvorUbl, prepocitaj, prazdnaFaktura, zCentov } from './ubl.js';
import { vykresliNahlad } from './nahlad.js';

const LANG = document.documentElement.lang === 'cs' ? 'cs' : document.documentElement.lang === 'de' ? 'de' : 'sk';

/* Skloňovanie počtov v súhrnnom riadku.
 * Slovenčina a čeština majú tri tvary: 1 kus, 2 až 4 kusy, ostatné (vrátane 0).
 * Nemčina má dva: 1 kus a ostatné. */
const tvar3 = (n, jeden, malo, vela) => (n === 1 ? jeden : n >= 2 && n <= 4 ? malo : vela);
const tvar2 = (n, jeden, viac) => (n === 1 ? jeden : viac);

/* ── Texty obrazovky ────────────────────────────────────────────────────── */
const T = {
  sk: {
    locale: 'sk-SK',
    legendaDodavatel: 'Dodávateľ', legendaOdberatel: 'Odberateľ', legendaFaktura: 'Faktúra', legendaPolozky: 'Položky',
    zavaznost: { chyba: 'Chyba', varovanie: 'Varovanie', informacia: 'Informácia' },
    sumarProfil: 'Profil', sumarTyp: 'Typ dokladu',
    sumarChyby: (n) => tvar3(n, 'chyba', 'chyby', 'chýb'),
    sumarVarovania: (n) => tvar3(n, 'varovanie', 'varovania', 'varovaní'),
    sumarInformacie: (n) => tvar3(n, 'informácia', 'informácie', 'informácií'),
    bezChyb: 'Nenašli sme žiadnu chybu ani varovanie. Súbor prešiel tými pravidlami, ktoré kontrolujeme.',
    maChyby: (n) => 'Našli sme ' + n + (n === 1 ? ' chybu.' : n < 5 ? ' chyby.' : ' chýb.') + ' Opravte ich a skúste znova.',
    povodneZnenie: 'Pôvodné znenie pravidla (anglicky)',
    xpathPopis: 'Cesta k prvku',
    hodnotaPopis: 'Hodnota v súbore',
    nacitajteSubor: 'Najprv načítajte súbor alebo vložte XML.',
    citam: 'Čítam súbor…',
    prilisVelky: (mb) => 'Súbor má viac ako ' + mb + ' MB. Taká e-faktúra sa v praxi nevyskytuje; ak ju naozaj máte, napíšte na andrej@arling.sk.',
    nacitane: (n, kb) => 'Načítané: ' + n + ' (' + kb + ' kB).',
    vzorNacitany: 'Načítali sme vzorovú faktúru. Je vymyslená, ale prejde kontrolou.',
    skopirovane: 'Skopírované.',
    kopirovanieZlyhalo: 'Kopírovanie sa nepodarilo, označte text myšou.',
    prazdnyNahlad: 'Načítajte súbor a doklad sa vykreslí tu.',
    typNieJeUbl: 'Doklad vieme vykresliť len z UBL 2.1 (Invoice alebo CreditNote). Čo je v súbore, píšeme v záložke Kontrola.',
    // generator
    pridatRiadok: 'Pridať riadok',
    zmazatRiadok: 'Zmazať',
    pNazov: 'Názov položky', pMnozstvo: 'Množstvo', pJednotka: 'Jednotka', pCena: 'Cena bez DPH', pSadzba: 'Sadzba DPH', pKategoria: 'Kategória DPH',
    sadzbaNeznama: 'Pre túto krajinu dodávateľa sadzby DPH neponúkame, lebo ich nemáme overené na oficiálnom zdroji. Sadzbu zapíšte sami, v percentách.',
    sadzbaNeistota: 'Sadzby pre krajinu {k} v ponuke sú z odborných zdrojov, nie z priamo načítanej vládnej stránky. Pred odoslaním faktúry si sadzbu overte sami. Slovenské sadzby máme overené priamo na financnasprava.sk.',
    napovedaEndpoint: 'Adresa v sieti Peppol. Pri kóde 0245 je to slovenské DIČ, presne 10 číslic bez predpony SK. Pri kóde 9930 nemecké USt-IdNr.',
    suctyZaklad: 'Základ', suctyDph: 'DPH', suctySpolu: 'Spolu s DPH', suctyUhrada: 'Na úhradu',
    ulozDodavatela: 'Uložiť dodávateľa do prehliadača',
    ulozOdberatela: 'Uložiť odberateľa do adresára',
    vybratOdberatela: 'Vybrať z adresára',
    ulozene: 'Uložené v tomto prehliadači.',
    adresarPrazdny: 'Adresár je zatiaľ prázdny.',
    vymazatVsetko: 'Vymazať údaje z prehliadača',
    vymazatOtazka: 'Vymazať vyplnené údaje a adresár z tohto prehliadača?',
    stiahnutXml: 'Stiahnuť XML',
    ulozitPdf: 'Uložiť ako PDF',
    generatorChyby: 'XML sme vytvorili, ale neprešlo našou vlastnou kontrolou. Nesťahujeme ho, aby ste neposlali chybnú faktúru. Opravte toto:',
    generatorOk: 'XML prešlo našou kontrolou bez chýb.',
    // platba
    kupaJedna: 'Kúpiť jednu faktúru za 2,90 €',
    kupa30: 'Odomknúť na 30 dní za 9,90 €',
    zapina: 'Platba sa práve zapína. Napíšte na andrej@arling.sk a pošlem vám XML e-mailom.',
    overujem: 'Overujem platbu…',
    zaplateneJedna: '<b>Zaplatené, ďakujeme.</b> Sťahovanie XML je odomknuté v tomto prehliadači na 24 hodín, aby ste faktúru mohli opraviť a stiahnuť znova.',
    zaplatene30: '<b>Zaplatené, ďakujeme.</b> Sťahovanie XML je odomknuté v tomto prehliadači na 30 dní, bez obmedzenia počtu faktúr.',
    inaSuma: 'Platba prišla, ale na inú sumu. Napíšte na andrej@arling.sk, vyriešime to ručne.',
    nepotvrdene: 'Platbu sa zatiaľ nepodarilo potvrdiť. Skúšame znova; ak ste zaplatili, sťahovanie sa odomkne, len čo Stripe odpovie. Ak to trvá dlhšie než pár minút, napíšte na andrej@arling.sk s číslom objednávky z e-mailu od Stripe.',
    overZnova: 'Overiť platbu znova',
    siet: 'Overenie platby zlyhalo (sieť). Obnovte stránku; ak to pretrvá, napíšte na andrej@arling.sk.',
    testCudzi: 'Toto je testovacia platba zo Stripe test módu. Odomkne sťahovanie len v prehliadači, ktorý test spustil cez ?test=1.',
    testPoznamka: '(Testovací režim: platba bola v Stripe test móde, žiadne peniaze neprišli.)',
    odomknuteDo: (d) => 'Odomknuté do ' + d + '.',
    mailtoPredmet: 'E-faktúra: XML na stiahnutie',
    mailtoTelo: 'Dobrý deň,\n\nplatba za XML z arling.sk/efaktura/ sa ešte zapína. Vyplnenú faktúru mám pripravenú v prehliadači. Poprosím o pokyny.\n\nĎakujem',
  },
  cs: {
    locale: 'cs-CZ',
    legendaDodavatel: 'Dodavatel', legendaOdberatel: 'Odběratel', legendaFaktura: 'Faktura', legendaPolozky: 'Položky',
    zavaznost: { chyba: 'Chyba', varovanie: 'Varování', informacia: 'Informace' },
    sumarProfil: 'Profil', sumarTyp: 'Typ dokladu',
    sumarChyby: (n) => tvar3(n, 'chyba', 'chyby', 'chyb'),
    sumarVarovania: () => 'varování',
    sumarInformacie: (n) => tvar3(n, 'informace', 'informace', 'informací'),
    bezChyb: 'Nenašli jsme žádnou chybu ani varování. Soubor prošel těmi pravidly, která kontrolujeme.',
    maChyby: (n) => 'Našli jsme ' + n + (n === 1 ? ' chybu.' : n < 5 ? ' chyby.' : ' chyb.') + ' Opravte je a zkuste to znovu.',
    povodneZnenie: 'Původní znění pravidla (anglicky)',
    xpathPopis: 'Cesta k prvku',
    hodnotaPopis: 'Hodnota v souboru',
    nacitajteSubor: 'Nejprve načtěte soubor nebo vložte XML.',
    citam: 'Čtu soubor…',
    prilisVelky: (mb) => 'Soubor má víc než ' + mb + ' MB. Taková e-faktura se v praxi nevyskytuje; pokud ji opravdu máte, napište na andrej@arling.sk.',
    nacitane: (n, kb) => 'Načteno: ' + n + ' (' + kb + ' kB).',
    vzorNacitany: 'Načetli jsme vzorovou fakturu. Je vymyšlená, ale projde kontrolou.',
    skopirovane: 'Zkopírováno.',
    kopirovanieZlyhalo: 'Kopírování se nepodařilo, označte text myší.',
    prazdnyNahlad: 'Načtěte soubor a doklad se vykreslí tady.',
    typNieJeUbl: 'Doklad umíme vykreslit jen z UBL 2.1 (Invoice nebo CreditNote). Co je v souboru, píšeme v záložce Kontrola.',
    pridatRiadok: 'Přidat řádek',
    zmazatRiadok: 'Smazat',
    pNazov: 'Název položky', pMnozstvo: 'Množství', pJednotka: 'Jednotka', pCena: 'Cena bez DPH', pSadzba: 'Sazba DPH', pKategoria: 'Kategorie DPH',
    sadzbaNeznama: 'Pro tuto zemi dodavatele sazby DPH nenabízíme, protože je nemáme ověřené na oficiálním zdroji. Sazbu zapište sami, v procentech.',
    sadzbaNeistota: 'Sazby pro zemi {k} v nabídce pocházejí z odborných zdrojů, ne z přímo načtené vládní stránky. Před odesláním faktury si sazbu ověřte sami. Slovenské sazby máme ověřené přímo na financnasprava.sk.',
    napovedaEndpoint: 'Adresa v síti Peppol. U kódu 0245 je to slovenské DIČ, přesně 10 číslic bez předpony SK. U kódu 9930 německé USt-IdNr.',
    suctyZaklad: 'Základ', suctyDph: 'DPH', suctySpolu: 'Celkem s DPH', suctyUhrada: 'K úhradě',
    ulozDodavatela: 'Uložit dodavatele do prohlížeče',
    ulozOdberatela: 'Uložit odběratele do adresáře',
    vybratOdberatela: 'Vybrat z adresáře',
    ulozene: 'Uloženo v tomto prohlížeči.',
    adresarPrazdny: 'Adresář je zatím prázdný.',
    vymazatVsetko: 'Smazat údaje z prohlížeče',
    vymazatOtazka: 'Smazat vyplněné údaje a adresář z tohoto prohlížeče?',
    stiahnutXml: 'Stáhnout XML',
    ulozitPdf: 'Uložit jako PDF',
    generatorChyby: 'XML jsme vytvořili, ale neprošlo naší vlastní kontrolou. Nestahujeme ho, abyste neposlali chybnou fakturu. Opravte toto:',
    generatorOk: 'XML prošlo naší kontrolou bez chyb.',
    kupaJedna: 'Koupit jednu fakturu za 2,90 €',
    kupa30: 'Odemknout na 30 dní za 9,90 €',
    zapina: 'Platba se právě zapíná. Napište na andrej@arling.sk a pošlu vám XML e-mailem.',
    overujem: 'Ověřuji platbu…',
    zaplateneJedna: '<b>Zaplaceno, děkujeme.</b> Stahování XML je odemčené v tomto prohlížeči na 24 hodin, abyste fakturu mohli opravit a stáhnout znovu.',
    zaplatene30: '<b>Zaplaceno, děkujeme.</b> Stahování XML je odemčené v tomto prohlížeči na 30 dní, bez omezení počtu faktur.',
    inaSuma: 'Platba přišla, ale na jinou částku. Napište na andrej@arling.sk, vyřešíme to ručně.',
    nepotvrdene: 'Platbu se zatím nepodařilo potvrdit. Zkoušíme znovu; pokud jste zaplatili, stahování se odemkne, jakmile Stripe odpoví. Pokud to trvá déle než pár minut, napište na andrej@arling.sk s číslem objednávky z e-mailu od Stripe.',
    overZnova: 'Ověřit platbu znovu',
    siet: 'Ověření platby selhalo (síť). Obnovte stránku; pokud to přetrvává, napište na andrej@arling.sk.',
    testCudzi: 'Toto je testovací platba ze Stripe test módu. Odemkne stahování jen v prohlížeči, který test spustil přes ?test=1.',
    testPoznamka: '(Testovací režim: platba byla ve Stripe test módu, žádné peníze nepřišly.)',
    odomknuteDo: (d) => 'Odemčeno do ' + d + '.',
    mailtoPredmet: 'E-faktura: XML ke stažení',
    mailtoTelo: 'Dobrý den,\n\nplatba za XML z arling.sk/efaktura/ se ještě zapíná. Vyplněnou fakturu mám připravenou v prohlížeči. Poprosím o pokyny.\n\nDěkuji',
  },
  de: {
    locale: 'de-DE',
    legendaDodavatel: 'Verkäufer', legendaOdberatel: 'Käufer', legendaFaktura: 'Rechnung', legendaPolozky: 'Positionen',
    zavaznost: { chyba: 'Fehler', varovanie: 'Warnung', informacia: 'Hinweis' },
    sumarProfil: 'Profil', sumarTyp: 'Belegart',
    sumarChyby: () => 'Fehler',
    sumarVarovania: (n) => tvar2(n, 'Warnung', 'Warnungen'),
    sumarInformacie: (n) => tvar2(n, 'Hinweis', 'Hinweise'),
    bezChyb: 'Wir haben weder Fehler noch Warnungen gefunden. Die Datei hat die Regeln bestanden, die wir prüfen.',
    maChyby: (n) => n === 1
      ? 'Wir haben 1 Fehler gefunden. Bitte beheben Sie ihn und prüfen Sie erneut.'
      : 'Wir haben ' + n + ' Fehler gefunden. Bitte beheben Sie sie und prüfen Sie erneut.',
    povodneZnenie: 'Originalwortlaut der Regel (englisch)',
    xpathPopis: 'Pfad zum Element',
    hodnotaPopis: 'Wert in der Datei',
    nacitajteSubor: 'Laden Sie zuerst eine Datei oder fügen Sie XML ein.',
    citam: 'Datei wird gelesen…',
    prilisVelky: (mb) => 'Die Datei ist größer als ' + mb + ' MB. So große E-Rechnungen kommen in der Praxis nicht vor; falls doch, schreiben Sie an andrej@arling.sk.',
    nacitane: (n, kb) => 'Geladen: ' + n + ' (' + kb + ' kB).',
    vzorNacitany: 'Wir haben eine Beispielrechnung geladen. Sie ist erfunden, besteht aber die Prüfung.',
    skopirovane: 'Kopiert.',
    kopirovanieZlyhalo: 'Das Kopieren ist fehlgeschlagen, markieren Sie den Text mit der Maus.',
    prazdnyNahlad: 'Laden Sie eine Datei, dann erscheint der Beleg hier.',
    typNieJeUbl: 'Wir können den Beleg nur aus UBL 2.1 darstellen (Invoice oder CreditNote). Was in der Datei steht, sagen wir im Tab Prüfung.',
    pridatRiadok: 'Zeile hinzufügen',
    zmazatRiadok: 'Löschen',
    pNazov: 'Bezeichnung', pMnozstvo: 'Menge', pJednotka: 'Einheit', pCena: 'Preis netto', pSadzba: 'Steuersatz', pKategoria: 'Steuerkategorie',
    sadzbaNeznama: 'Für dieses Land des Verkäufers bieten wir keine Steuersätze an, weil wir sie nicht an einer amtlichen Quelle geprüft haben. Bitte tragen Sie den Satz selbst in Prozent ein.',
    sadzbaNeistota: 'Die angebotenen Sätze für das Land {k} stammen aus Fachquellen, nicht aus einer direkt abgerufenen amtlichen Seite. Bitte prüfen Sie den Satz vor dem Versand der Rechnung selbst. Die slowakischen Sätze haben wir direkt bei financnasprava.sk geprüft.',
    napovedaEndpoint: 'Adresse im Peppol-Netz. Beim Code 0245 ist es die slowakische Steuernummer DIČ, genau 10 Ziffern ohne Präfix SK. Beim Code 9930 die deutsche USt-IdNr.',
    suctyZaklad: 'Netto', suctyDph: 'USt.', suctySpolu: 'Brutto', suctyUhrada: 'Zahlbetrag',
    ulozDodavatela: 'Verkäufer im Browser speichern',
    ulozOdberatela: 'Käufer im Adressbuch speichern',
    vybratOdberatela: 'Aus dem Adressbuch wählen',
    ulozene: 'In diesem Browser gespeichert.',
    adresarPrazdny: 'Das Adressbuch ist noch leer.',
    vymazatVsetko: 'Daten aus dem Browser löschen',
    vymazatOtazka: 'Eingegebene Daten und Adressbuch aus diesem Browser löschen?',
    stiahnutXml: 'XML herunterladen',
    ulozitPdf: 'Als PDF speichern',
    generatorChyby: 'Wir haben das XML erzeugt, aber es hat unsere eigene Prüfung nicht bestanden. Wir laden es nicht herunter, damit Sie keine fehlerhafte Rechnung versenden. Bitte beheben Sie das:',
    generatorOk: 'Das XML hat unsere Prüfung ohne Fehler bestanden.',
    kupaJedna: 'Eine Rechnung für 2,90 € kaufen',
    kupa30: 'Für 30 Tage freischalten, 9,90 €',
    zapina: 'Die Zahlung wird gerade aktiviert. Schreiben Sie an andrej@arling.sk, dann sende ich Ihnen das XML per E-Mail.',
    overujem: 'Zahlung wird geprüft…',
    zaplateneJedna: '<b>Bezahlt, vielen Dank.</b> Der XML-Download ist in diesem Browser 24 Stunden freigeschaltet, damit Sie die Rechnung korrigieren und erneut herunterladen können.',
    zaplatene30: '<b>Bezahlt, vielen Dank.</b> Der XML-Download ist in diesem Browser 30 Tage freigeschaltet, ohne Begrenzung der Rechnungsanzahl.',
    inaSuma: 'Die Zahlung ist eingegangen, aber über einen anderen Betrag. Schreiben Sie an andrej@arling.sk, wir klären das manuell.',
    nepotvrdene: 'Die Zahlung konnte bisher nicht bestätigt werden. Wir versuchen es erneut; falls Sie bezahlt haben, wird der Download freigeschaltet, sobald Stripe antwortet. Falls das länger als ein paar Minuten dauert, schreiben Sie an andrej@arling.sk mit der Bestellnummer aus der E-Mail von Stripe.',
    overZnova: 'Zahlung erneut prüfen',
    siet: 'Die Prüfung der Zahlung ist fehlgeschlagen (Netzwerk). Laden Sie die Seite neu; falls das anhält, schreiben Sie an andrej@arling.sk.',
    testCudzi: 'Dies ist eine Testzahlung aus dem Stripe-Testmodus. Sie schaltet den Download nur in dem Browser frei, der den Test über ?test=1 gestartet hat.',
    testPoznamka: '(Testmodus: die Zahlung erfolgte im Stripe-Testmodus, es wurde kein Geld überwiesen.)',
    odomknuteDo: (d) => 'Freigeschaltet bis ' + d + '.',
    mailtoPredmet: 'E-Rechnung: XML zum Herunterladen',
    mailtoTelo: 'Guten Tag,\n\ndie Zahlung für das XML von arling.sk/efaktura/ wird noch aktiviert. Die ausgefüllte Rechnung liegt in meinem Browser bereit. Bitte um Hinweise.\n\nVielen Dank',
  },
}[LANG];

/* Menovky poli formulara. Drzime ich pri T, aby sa preklad robil na jednom mieste. */
const MENOVKY = {
  sk: {
    nazov: 'Názov', ico: 'IČO', icDph: 'IČ DPH', ulica: 'Ulica a číslo', mesto: 'Mesto', psc: 'PSČ',
    krajina: 'Krajina', email: 'E-mail', telefon: 'Telefón', kontakt: 'Kontaktná osoba',
    iban: 'IBAN', bic: 'BIC', endpoint: 'Elektronická adresa', endpointSchema: 'Kód adresy (schemeID)',
    cislo: 'Číslo faktúry', typ: 'Typ dokladu', datumVystavenia: 'Dátum vystavenia', datumDodania: 'Dátum dodania',
    datumSplatnosti: 'Splatnosť', mena: 'Mena', variabilnySymbol: 'Variabilný symbol',
    referenciaOdberatela: 'Referencia odberateľa', poznamka: 'Poznámka', sposobPlatby: 'Spôsob platby',
    profil: 'Profil (CustomizationID)', zaplatene: 'Zaplatená záloha',
    platobnePodmienky: 'Platobné podmienky (text na doklade)',
  },
  cs: {
    nazov: 'Název', ico: 'IČO', icDph: 'DIČ (plátce DPH)', ulica: 'Ulice a číslo', mesto: 'Město', psc: 'PSČ',
    krajina: 'Země', email: 'E-mail', telefon: 'Telefon', kontakt: 'Kontaktní osoba',
    iban: 'IBAN', bic: 'BIC', endpoint: 'Elektronická adresa', endpointSchema: 'Kód adresy (schemeID)',
    cislo: 'Číslo faktury', typ: 'Typ dokladu', datumVystavenia: 'Datum vystavení', datumDodania: 'Datum dodání',
    datumSplatnosti: 'Splatnost', mena: 'Měna', variabilnySymbol: 'Variabilní symbol',
    referenciaOdberatela: 'Reference odběratele', poznamka: 'Poznámka', sposobPlatby: 'Způsob platby',
    profil: 'Profil (CustomizationID)', zaplatene: 'Zaplacená záloha',
    platobnePodmienky: 'Platební podmínky (text na dokladu)',
  },
  de: {
    nazov: 'Name', ico: 'Registernummer', icDph: 'USt-IdNr.', ulica: 'Straße und Nummer', mesto: 'Ort', psc: 'PLZ',
    krajina: 'Land', email: 'E-Mail', telefon: 'Telefon', kontakt: 'Ansprechpartner',
    iban: 'IBAN', bic: 'BIC', endpoint: 'Elektronische Adresse', endpointSchema: 'Adresscode (schemeID)',
    cislo: 'Rechnungsnummer', typ: 'Belegart', datumVystavenia: 'Rechnungsdatum', datumDodania: 'Lieferdatum',
    datumSplatnosti: 'Fälligkeit', mena: 'Währung', variabilnySymbol: 'Verwendungszweck',
    referenciaOdberatela: 'Leitweg-ID / Käuferreferenz', poznamka: 'Hinweis', sposobPlatby: 'Zahlungsart',
    profil: 'Profil (CustomizationID)', zaplatene: 'Anzahlung',
    platobnePodmienky: 'Zahlungsbedingungen (Text auf dem Beleg)',
  },
}[LANG];

/* ── Pomocky ────────────────────────────────────────────────────────────── */
const API = 'https://arling-asistent.arling.workers.dev';
const CENA_JEDNA = 290;
const CENA_30DNI = 990;
const PLATNOST = { jedna: 24 * 3600 * 1000, '30dni': 30 * 86400 * 1000 };
const MAX_MB = 12;

const $ = (id) => document.getElementById(id);
const track = (n, d) => { try { if (window.umami && typeof window.umami.track === 'function') window.umami.track(n, d); } catch (e) { /* nic */ } };
const nacitaj = (k) => { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : null; } catch (e) { return null; } };
const uloz = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* bez uloziska to bezi dalej */ } };
const zmaz = (k) => { try { localStorage.removeItem(k); } catch (e) { /* nic */ } };

function el(meno, trieda, text) {
  const e = document.createElement(meno);
  if (trieda) e.className = trieda;
  if (text !== undefined && text !== null && text !== '') e.textContent = String(text);
  return e;
}
function vycisti(uzol) { while (uzol && uzol.firstChild) uzol.removeChild(uzol.firstChild); }

function stiahni(nazov, obsah, typ) {
  const blob = new Blob([obsah], { type: typ || 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nazov;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}

/* ── Vzorova faktura ─────────────────────────────────────────────────────
 * Vlastny vzor, nic prevzate. Vymyslena firma, dve polozky, sadzba 23 %.
 * Musi prejst kontrolou bez chyb (kontroluje to test 12 v tests.mjs cez
 * rovnaky generator, tu je XML zapisane natvrdo, aby vzor nezavisel od formulara). */
const VZOR_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>2026-0142</cbc:ID>
  <cbc:IssueDate>2026-09-11</cbc:IssueDate>
  <cbc:DueDate>2026-09-25</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:Note>Vzorová faktúra z arling.sk/efaktura/. Údaje sú vymyslené.</cbc:Note>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cbc:BuyerReference>OBJ-2026-77</cbc:BuyerReference>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cbc:EndpointID schemeID="0245">2120000001</cbc:EndpointID>
      <cac:PostalAddress>
        <cbc:StreetName>Krivánska 4</cbc:StreetName>
        <cbc:CityName>Banská Bystrica</cbc:CityName>
        <cbc:PostalZone>97401</cbc:PostalZone>
        <cac:Country>
          <cbc:IdentificationCode>SK</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>SK2120000001</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>Vzorová dielna s. r. o.</cbc:RegistrationName>
        <cbc:CompanyID>51234567</cbc:CompanyID>
      </cac:PartyLegalEntity>
      <cac:Contact>
        <cbc:Name>Jana Vzorová</cbc:Name>
        <cbc:Telephone>+421 900 000 000</cbc:Telephone>
        <cbc:ElectronicMail>fakturacia@vzorovadielna.sk</cbc:ElectronicMail>
      </cac:Contact>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cbc:EndpointID schemeID="0245">2130000002</cbc:EndpointID>
      <cac:PostalAddress>
        <cbc:StreetName>Námestie 12</cbc:StreetName>
        <cbc:CityName>Košice</cbc:CityName>
        <cbc:PostalZone>04001</cbc:PostalZone>
        <cac:Country>
          <cbc:IdentificationCode>SK</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>SK2130000002</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>Odberateľ Východ a. s.</cbc:RegistrationName>
        <cbc:CompanyID>36000002</cbc:CompanyID>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:Delivery>
    <cbc:ActualDeliveryDate>2026-09-10</cbc:ActualDeliveryDate>
  </cac:Delivery>
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>58</cbc:PaymentMeansCode>
    <cbc:PaymentID>20260142</cbc:PaymentID>
    <cac:PayeeFinancialAccount>
      <cbc:ID>SK3112000000198742637541</cbc:ID>
      <cbc:Name>Vzorová dielna s. r. o.</cbc:Name>
    </cac:PayeeFinancialAccount>
  </cac:PaymentMeans>
  <cac:PaymentTerms>
    <cbc:Note>Splatnosť 14 dní od vystavenia.</cbc:Note>
  </cac:PaymentTerms>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="EUR">103.50</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="EUR">450.00</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="EUR">103.50</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>23.00</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">450.00</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="EUR">450.00</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">553.50</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="EUR">553.50</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  <cac:InvoiceLine>
    <cbc:ID>1</cbc:ID>
    <cbc:InvoicedQuantity unitCode="HUR">6</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="EUR">270.00</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>Servis obrábacieho stroja</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>23.00</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="EUR">45.00</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>
  <cac:InvoiceLine>
    <cbc:ID>2</cbc:ID>
    <cbc:InvoicedQuantity unitCode="C62">4</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="EUR">180.00</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>Náhradné ložiská</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>23.00</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="EUR">45.00</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>
</Invoice>
`;

/* ── Zalozky ────────────────────────────────────────────────────────────── */
const PANELY = ['kontrola', 'nahlad', 'vytvorit'];
let aktivna = 'kontrola';

function prepni(meno, zapisHash) {
  if (PANELY.indexOf(meno) === -1) meno = 'kontrola';
  aktivna = meno;
  for (const p of PANELY) {
    const panel = $('panel-' + p);
    if (panel) panel.hidden = p !== meno;
    const tl = document.querySelector('.zalozka[data-tab="' + p + '"]');
    if (tl) {
      tl.classList.toggle('aktivna', p === meno);
      tl.setAttribute('aria-selected', p === meno ? 'true' : 'false');
    }
  }
  // vstupny blok (pretiahnutie, vyber suboru, vlozenie XML) je jeden a sťahuje sa do aktivneho panela
  const slot = document.querySelector('#panel-' + meno + ' .vstup-slot');
  if (slot && vstupBlok) slot.appendChild(vstupBlok);
  if (zapisHash) { try { history.replaceState(null, '', '#' + meno); } catch (e) { /* nic */ } }
  if (meno === 'nahlad') vykresliVstupnyDoklad();
  if (meno === 'vytvorit') prekresliGenerator();
}

/* ── Spolocny vstup: subor, pretiahnutie, vlozene XML ───────────────────── */
const vstupBlok = $('vstup');
let xmlText = '';
let nazovSuboru = '';

function stavVstupu(text) { const s = $('vstup-stav'); if (s) s.textContent = text; }

function prijmiText(text, nazov) {
  xmlText = text;
  nazovSuboru = nazov || '';
  const ta = $('xml');
  if (ta && ta.value !== text) ta.value = text;
  stavVstupu(T.nacitane(nazov || 'XML', Math.max(1, Math.round(text.length / 1024))));
  track('nastroj_pouzity', { produkt: 'efaktura', jazyk: LANG });
  if (aktivna === 'nahlad') vykresliVstupnyDoklad(); else spustiKontrolu();
}

function prijmiSubor(f) {
  if (!f) return;
  if (f.size > MAX_MB * 1024 * 1024) { stavVstupu(T.prilisVelky(MAX_MB)); return; }
  stavVstupu(T.citam);
  const r = new FileReader();
  r.onload = () => prijmiText(String(r.result || ''), f.name);
  r.onerror = () => stavVstupu(T.nacitajteSubor);
  r.readAsText(f, 'utf-8');
}

if (vstupBlok) {
  const dz = $('dropzone');
  const subor = $('subor');
  if (dz) {
    dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('nad'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('nad'));
    dz.addEventListener('drop', (e) => {
      e.preventDefault();
      dz.classList.remove('nad');
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) prijmiSubor(f);
    });
    dz.addEventListener('click', () => subor && subor.click());
    dz.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (subor) subor.click(); } });
  }
  if (subor) subor.addEventListener('change', () => prijmiSubor(subor.files && subor.files[0]));
  const vybrat = $('vybrat');
  if (vybrat) vybrat.addEventListener('click', () => subor && subor.click());
  const vzor = $('vzor');
  if (vzor) vzor.addEventListener('click', () => { prijmiText(VZOR_XML, 'vzor-efaktura.xml'); stavVstupu(T.vzorNacitany); });
  const spustit = $('spustit');
  if (spustit) spustit.addEventListener('click', () => {
    const ta = $('xml');
    const t = ta ? ta.value : '';
    if (!t.trim()) { stavVstupu(T.nacitajteSubor); return; }
    prijmiText(t, nazovSuboru || 'vlozene.xml');
  });
}

/* ── Zalozka 1: kontrola ────────────────────────────────────────────────── */
let poslednyVysledok = null;

function riadokNalezu(n) {
  const box = el('article', 'nalez nalez-' + n.zavaznost);
  const hlava = el('p', 'nalez-hlava');
  hlava.appendChild(el('span', 'nalez-znacka', T.zavaznost[n.zavaznost] || n.zavaznost));
  hlava.appendChild(el('code', 'nalez-kod', n.kod));
  box.appendChild(hlava);
  box.appendChild(el('p', 'nalez-veta', n.sprava[LANG] || n.sprava.sk));
  if (n.hodnota) {
    const h = el('p', 'nalez-meta');
    h.appendChild(el('span', 'nalez-popis', T.hodnotaPopis + ': '));
    h.appendChild(el('code', null, n.hodnota));
    box.appendChild(h);
  }
  if (n.xpath) {
    const x = el('p', 'nalez-meta');
    x.appendChild(el('span', 'nalez-popis', T.xpathPopis + ': '));
    x.appendChild(el('code', null, n.xpath));
    box.appendChild(x);
  }
  if (n.original) {
    const d = el('details', 'nalez-original');
    d.appendChild(el('summary', null, T.povodneZnenie));
    d.appendChild(el('p', null, n.original));
    box.appendChild(d);
  }
  return box;
}

function spustiKontrolu() {
  const cielSumar = $('sumar');
  const cielNalezy = $('nalezy');
  const akcie = $('akcie');
  if (!cielSumar || !cielNalezy) return;
  if (!xmlText.trim()) {
    vycisti(cielSumar); vycisti(cielNalezy);
    cielSumar.appendChild(el('p', 'poznamka', T.nacitajteSubor));
    if (akcie) akcie.hidden = true;
    return;
  }
  const v = skontroluj(xmlText);
  poslednyVysledok = v;
  vycisti(cielSumar);
  const s = v.sumar;
  const stav = el('p', 'sumar-stav ' + (s.chyby ? 'je-chyba' : 'je-ok'), s.chyby ? T.maChyby(s.chyby) : T.bezChyb);
  cielSumar.appendChild(stav);
  const meta = el('p', 'sumar-meta');
  meta.appendChild(el('span', null, T.sumarProfil + ': ' + v.profilNazov));
  meta.appendChild(el('span', null, T.sumarTyp + ': ' + v.typ));
  meta.appendChild(el('span', null, s.chyby + ' ' + T.sumarChyby(s.chyby)));
  meta.appendChild(el('span', null, s.varovania + ' ' + T.sumarVarovania(s.varovania)));
  meta.appendChild(el('span', null, s.informacie + ' ' + T.sumarInformacie(s.informacie)));
  cielSumar.appendChild(meta);
  vycisti(cielNalezy);
  for (const n of v.nalezy) cielNalezy.appendChild(riadokNalezu(n));
  if (akcie) akcie.hidden = false;
  track('efaktura_kontrola', { vysledok: s.chyby ? 'chyby' : 'ok', profil: v.profil, produkt: 'efaktura', jazyk: LANG });
}

const btnProtokol = $('protokol');
if (btnProtokol) btnProtokol.addEventListener('click', () => {
  if (!poslednyVysledok) return;
  stiahni('protokol-efaktura.txt', protokol(poslednyVysledok, LANG, nazovSuboru));
});
const btnKopirovat = $('kopirovat');
if (btnKopirovat) btnKopirovat.addEventListener('click', async () => {
  if (!poslednyVysledok) return;
  const text = protokol(poslednyVysledok, LANG, nazovSuboru);
  try {
    await navigator.clipboard.writeText(text);
    stavVstupu(T.skopirovane);
  } catch (e) {
    stavVstupu(T.kopirovanieZlyhalo);
  }
});

/* ── Zalozka 2: nahlad ──────────────────────────────────────────────────── */
function vykresliVstupnyDoklad() {
  const ciel = $('doklad');
  const stav = $('nahlad-stav');
  const tlacidlo = $('pdf');
  if (!ciel) return;
  if (!xmlText.trim()) {
    vycisti(ciel);
    if (stav) stav.textContent = T.prazdnyNahlad;
    if (tlacidlo) tlacidlo.hidden = true;
    return;
  }
  const p = parsujXml(xmlText);
  if (!p.ok || (p.koren.local !== 'Invoice' && p.koren.local !== 'CreditNote')) {
    vycisti(ciel);
    if (stav) stav.textContent = T.typNieJeUbl;
    if (tlacidlo) tlacidlo.hidden = true;
    return;
  }
  vykresliNahlad(p.koren, ciel, LANG);
  if (stav) stav.textContent = '';
  if (tlacidlo) tlacidlo.hidden = false;
  track('efaktura_nahlad', { produkt: 'efaktura', jazyk: LANG });
}

/* Tlac: doklad sa naklonuje do samostatneho bloku, aby na papier islo len on. */
function tlac(zdroj) {
  const ciel = $('tlac');
  if (!ciel || !zdroj) return;
  vycisti(ciel);
  ciel.appendChild(zdroj.cloneNode(true));
  document.body.classList.add('tlaci');
  const koniec = () => { document.body.classList.remove('tlaci'); window.removeEventListener('afterprint', koniec); };
  window.addEventListener('afterprint', koniec);
  window.print();
  setTimeout(koniec, 3000);
}
const btnPdf = $('pdf');
if (btnPdf) btnPdf.addEventListener('click', () => tlac($('doklad').firstElementChild));

/* ── Zalozka 3: generator ───────────────────────────────────────────────── */
const KLUC_NAVRH = 'efaktura:navrh:' + LANG;
const KLUC_DODAVATEL = 'efaktura:dodavatel';
const KLUC_ODBERATELIA = 'efaktura:odberatelia';

const KRAJINY = ['SK', 'CZ', 'DE', 'AT', 'PL', 'HU'];
const MENY = ['EUR', 'CZK', 'PLN', 'HUF', 'USD', 'GBP'];
const KATEGORIE = ['S', 'Z', 'E', 'AE', 'K', 'G', 'O'];
const SCHEMEID = [
  { kod: '0245', popis: 'SK: DIČ' },
  { kod: '9930', popis: 'DE: USt-IdNr.' },
  { kod: '0204', popis: 'DE: Leitweg-ID' },
  { kod: '0088', popis: 'GLN (GS1)' },
];

const POLIA_DODAVATEL = ['nazov', 'ico', 'icDph', 'ulica', 'mesto', 'psc', 'krajina', 'email', 'telefon', 'kontakt', 'iban', 'bic', 'endpoint', 'endpointSchema'];
const POLIA_ODBERATEL = ['nazov', 'ico', 'icDph', 'ulica', 'mesto', 'psc', 'krajina', 'email', 'endpoint', 'endpointSchema'];
const POLIA_FAKTURA = ['cislo', 'typ', 'profil', 'datumVystavenia', 'datumDodania', 'datumSplatnosti', 'mena', 'variabilnySymbol', 'referenciaOdberatela', 'sposobPlatby', 'zaplatene', 'platobnePodmienky', 'poznamka'];

// Predvolena krajina podla jazyka stranky: SK, CZ alebo DE (DE zaroven nastavi profil XRechnung).
const KRAJINA_JAZYKA = LANG === 'de' ? 'DE' : LANG === 'cs' ? 'CZ' : 'SK';
function novaFaktura() {
  const f = prazdnaFaktura(KRAJINA_JAZYKA);
  // ceska firma fakturuje spravidla v korunach; pouzivatel to vie prepnut
  if (KRAJINA_JAZYKA === 'CZ') f.mena = 'CZK';
  return f;
}
let faktura = nacitaj(KLUC_NAVRH) || novaFaktura();
if (!Array.isArray(faktura.polozky) || !faktura.polozky.length) faktura = novaFaktura();
const ulozenyDodavatel = nacitaj(KLUC_DODAVATEL);
if (ulozenyDodavatel && !faktura.dodavatel.nazov) faktura.dodavatel = Object.assign({}, faktura.dodavatel, ulozenyDodavatel);

function polePodla(meno, hodnota, onZmena) {
  const l = el('label', 'pole');
  l.appendChild(el('span', null, MENOVKY[meno] || meno));
  let vstup;
  if (meno === 'krajina' || meno === 'typ' || meno === 'mena' || meno === 'sposobPlatby' || meno === 'profil' || meno === 'endpointSchema') {
    vstup = document.createElement('select');
    const moznosti =
      meno === 'krajina' ? KRAJINY.map((k) => [k, k])
      : meno === 'mena' ? MENY.map((k) => [k, k])
      : meno === 'typ' ? K.TYPY_DOKLADU.map((x) => [x.kod, x.kod + ' ' + (x[LANG] || x.sk)])
      : meno === 'sposobPlatby' ? K.SPOSOBY_PLATBY.map((x) => [x.kod, x.kod + ' ' + (x[LANG] || x.sk)])
      : meno === 'profil' ? [['peppol', 'Peppol BIS Billing 3.0'], ['xrechnung', 'XRechnung 3.x'], ['en16931', 'EN 16931']]
      : [['', '-']].concat(SCHEMEID.map((x) => [x.kod, x.kod + ' ' + x.popis]));
    for (const [k, t] of moznosti) {
      const o = document.createElement('option');
      o.value = k; o.textContent = t;
      if (String(hodnota) === k) o.selected = true;
      vstup.appendChild(o);
    }
  } else {
    vstup = document.createElement('input');
    vstup.type = meno.startsWith('datum') ? 'date' : meno === 'email' ? 'email' : 'text';
    vstup.value = hodnota === undefined || hodnota === null ? '' : String(hodnota);
  }
  vstup.addEventListener('input', () => onZmena(vstup.value));
  vstup.addEventListener('change', () => onZmena(vstup.value));
  l.appendChild(vstup);
  if (meno === 'endpoint') l.appendChild(el('small', 'pole-napoveda', T.napovedaEndpoint));
  return l;
}

function postavFormular() {
  const form = $('formular');
  if (!form) return;
  vycisti(form);

  const zmena = () => { ulozNavrh(); prekresliGenerator(); };

  // dodavatel
  const fsD = el('fieldset');
  fsD.appendChild(el('legend', null, T.legendaDodavatel));
  for (const m of POLIA_DODAVATEL) {
    fsD.appendChild(polePodla(m, faktura.dodavatel[m], (v) => {
      faktura.dodavatel[m] = v;
      if (m === 'krajina') { faktura.dodavatel.endpointSchema = (K.ODPORUCANE_SCHEMEID[v] || {}).kod || faktura.dodavatel.endpointSchema; postavFormular(); }
      zmena();
    }));
  }
  const paD = el('div', 'formular-pata');
  const bD = el('button', 'btn btn-line', T.ulozDodavatela);
  bD.type = 'button';
  bD.addEventListener('click', () => { uloz(KLUC_DODAVATEL, faktura.dodavatel); stavGeneratora(T.ulozene); });
  paD.appendChild(bD);
  fsD.appendChild(paD);
  form.appendChild(fsD);

  // odberatel
  const fsO = el('fieldset');
  fsO.appendChild(el('legend', null, T.legendaOdberatel));
  const adresar = nacitaj(KLUC_ODBERATELIA) || [];
  const vyber = el('label', 'pole');
  vyber.appendChild(el('span', null, T.vybratOdberatela));
  const sel = document.createElement('select');
  const prazdna = document.createElement('option');
  prazdna.value = ''; prazdna.textContent = adresar.length ? '-' : T.adresarPrazdny;
  sel.appendChild(prazdna);
  adresar.forEach((o, i) => {
    const opt = document.createElement('option');
    opt.value = String(i); opt.textContent = o.nazov || ('#' + (i + 1));
    sel.appendChild(opt);
  });
  sel.addEventListener('change', () => {
    const i = Number(sel.value);
    if (!Number.isNaN(i) && adresar[i]) { faktura.odberatel = Object.assign({}, adresar[i]); postavFormular(); zmena(); }
  });
  vyber.appendChild(sel);
  fsO.appendChild(vyber);
  for (const m of POLIA_ODBERATEL) {
    fsO.appendChild(polePodla(m, faktura.odberatel[m], (v) => { faktura.odberatel[m] = v; zmena(); }));
  }
  const paO = el('div', 'formular-pata');
  const bO = el('button', 'btn btn-line', T.ulozOdberatela);
  bO.type = 'button';
  bO.addEventListener('click', () => {
    const zoz = (nacitaj(KLUC_ODBERATELIA) || []).filter((x) => x.nazov !== faktura.odberatel.nazov);
    zoz.unshift(Object.assign({}, faktura.odberatel));
    uloz(KLUC_ODBERATELIA, zoz.slice(0, 20));
    stavGeneratora(T.ulozene);
    postavFormular();
  });
  paO.appendChild(bO);
  fsO.appendChild(paO);
  form.appendChild(fsO);

  // faktura
  const fsF = el('fieldset');
  fsF.appendChild(el('legend', null, T.legendaFaktura));
  for (const m of POLIA_FAKTURA) {
    fsF.appendChild(polePodla(m, faktura[m], (v) => { faktura[m] = v; zmena(); }));
  }
  form.appendChild(fsF);

  // polozky
  const fsP = el('fieldset', 'fs-polozky');
  fsP.appendChild(el('legend', null, T.legendaPolozky));
  const zoznam = el('div');
  zoznam.id = 'polozky';
  fsP.appendChild(zoznam);
  const paP = el('div', 'formular-pata');
  const bP = el('button', 'btn btn-line', T.pridatRiadok);
  bP.type = 'button';
  bP.addEventListener('click', () => {
    const posl = faktura.polozky[faktura.polozky.length - 1] || {};
    faktura.polozky.push({ nazov: '', mnozstvo: 1, jednotka: 'C62', cena: 0, sadzba: posl.sadzba !== undefined ? posl.sadzba : 23, kategoria: posl.kategoria || 'S' });
    postavPolozky();
    zmena();
  });
  paP.appendChild(bP);
  const bZ = el('button', 'btn btn-line', T.vymazatVsetko);
  bZ.type = 'button';
  bZ.addEventListener('click', () => {
    if (!window.confirm(T.vymazatOtazka)) return;
    zmaz(KLUC_NAVRH); zmaz(KLUC_DODAVATEL); zmaz(KLUC_ODBERATELIA);
    faktura = novaFaktura();
    postavFormular();
    prekresliGenerator();
  });
  paP.appendChild(bZ);
  fsP.appendChild(paP);
  form.appendChild(fsP);

  postavPolozky();
}

function postavPolozky() {
  const ciel = $('polozky');
  if (!ciel) return;
  vycisti(ciel);
  // Sadzby ponukame len pre krajiny, ktore mame zdrojovane v ops/efaktura/fakty.md.
  // Pre ostatne krajiny nehadame: pole na sadzbu je volne a pod polozkami to napiseme.
  const sadzby = K.SADZBY_DPH[faktura.dodavatel.krajina] || null;
  faktura.polozky.forEach((p, i) => {
    const riadok = el('div', 'polozka');
    riadok.appendChild(el('p', 'polozka-cislo', String(i + 1)));
    const pole = (menovka, typ, hodnota, onZmena, moznosti) => {
      const l = el('label', 'pole pole-' + typ);
      l.appendChild(el('span', null, menovka));
      let v;
      if (moznosti) {
        v = document.createElement('select');
        for (const [k, t] of moznosti) {
          const o = document.createElement('option');
          o.value = String(k); o.textContent = t;
          if (String(hodnota) === String(k)) o.selected = true;
          v.appendChild(o);
        }
      } else {
        v = document.createElement('input');
        v.type = typ === 'cislo' ? 'text' : 'text';
        v.inputMode = typ === 'cislo' ? 'decimal' : 'text';
        v.value = hodnota === undefined || hodnota === null ? '' : String(hodnota);
      }
      v.addEventListener('input', () => { onZmena(v.value); ulozNavrh(); prekresliGenerator(); });
      v.addEventListener('change', () => { onZmena(v.value); ulozNavrh(); prekresliGenerator(); });
      l.appendChild(v);
      return l;
    };
    riadok.appendChild(pole(T.pNazov, 'text', p.nazov, (v) => { p.nazov = v; }));
    riadok.appendChild(pole(T.pMnozstvo, 'cislo', p.mnozstvo, (v) => { p.mnozstvo = v; }));
    riadok.appendChild(pole(T.pJednotka, 'text', p.jednotka, (v) => { p.jednotka = v; }, K.JEDNOTKY.map((j) => [j.kod, (j[LANG] || j.sk) + ' (' + j.kod + ')'])));
    riadok.appendChild(pole(T.pCena, 'cislo', p.cena, (v) => { p.cena = v; }));
    riadok.appendChild(pole(T.pSadzba, 'cislo', p.sadzba, (v) => { p.sadzba = v; }, sadzby ? sadzby.map((s) => [s, s + ' %']) : null));
    riadok.appendChild(pole(T.pKategoria, 'text', p.kategoria, (v) => { p.kategoria = v; }, KATEGORIE.map((k) => {
      const n = K.KATEGORIE_DPH.find((x) => x.kod === k);
      return [k, k + ' ' + (n ? (n[LANG] || n.sk) : '')];
    })));
    const zmazat = el('button', 'btn btn-line polozka-zmazat', T.zmazatRiadok);
    zmazat.type = 'button';
    zmazat.disabled = faktura.polozky.length < 2;
    zmazat.addEventListener('click', () => {
      faktura.polozky.splice(i, 1);
      if (!faktura.polozky.length) faktura.polozky.push({ nazov: '', mnozstvo: 1, jednotka: 'C62', cena: 0, sadzba: sadzby ? sadzby[0] : 0, kategoria: 'S' });
      postavPolozky();
      ulozNavrh();
      prekresliGenerator();
    });
    riadok.appendChild(zmazat);
    ciel.appendChild(riadok);
  });
  if (!sadzby) ciel.appendChild(el('p', 'poznamka-sadzba', T.sadzbaNeznama));
  else if (K.SADZBY_ISTOTA[faktura.dodavatel.krajina] !== 'iste') {
    ciel.appendChild(el('p', 'poznamka-sadzba', T.sadzbaNeistota.replace('{k}', faktura.dodavatel.krajina)));
  }
}

function ulozNavrh() { uloz(KLUC_NAVRH, faktura); }
function stavGeneratora(text) { const s = $('generator-stav'); if (s) s.textContent = text; }

let posledneXml = '';
let generatorPouzity = false;

function prekresliGenerator() {
  const ciel = $('nahlad-zivy');
  if (!ciel) return;
  let xml = '';
  try {
    xml = vytvorUbl(faktura, { profil: faktura.profil || 'peppol', jazyk: LANG });
  } catch (e) {
    posledneXml = '';
    return;
  }
  posledneXml = xml;
  const p = parsujXml(xml);
  if (p.ok) vykresliNahlad(p.koren, ciel, LANG);

  // sucty v jednom riadku nad nahladom
  const v = prepocitaj(faktura);
  const mena = faktura.mena || 'EUR';
  const sucty = $('sucty');
  if (sucty) {
    vycisti(sucty);
    const par = (m, c) => { const s = el('span'); s.appendChild(el('b', null, m + ': ')); s.appendChild(document.createTextNode(zCentov(c) + ' ' + mena)); return s; };
    sucty.appendChild(par(T.suctyZaklad, v.zakladCenty));
    sucty.appendChild(par(T.suctyDph, v.danCenty));
    sucty.appendChild(par(T.suctySpolu, v.sDphCenty));
    sucty.appendChild(par(T.suctyUhrada, v.naUhraduCenty));
  }
  if (!generatorPouzity && faktura.dodavatel.nazov && faktura.polozky.some((x) => x.nazov)) {
    generatorPouzity = true;
    track('efaktura_vytvorit_nahlad', { produkt: 'efaktura', jazyk: LANG });
    track('nastroj_pouzity', { produkt: 'efaktura', jazyk: LANG });
  }
  ukazPlatbu();
}

const btnPdf2 = $('pdf-generator');
if (btnPdf2) btnPdf2.addEventListener('click', () => tlac($('nahlad-zivy').firstElementChild));

/* ── Platba ─────────────────────────────────────────────────────────────── */
function testRezim() {
  try {
    if (new URL(location.href).searchParams.get('test') === '1') sessionStorage.setItem('efaktura:test', '1');
    return sessionStorage.getItem('efaktura:test') === '1';
  } catch (e) { return false; }
}
/** Vrati 'jedna', '30dni' alebo null podla toho, co je zaplatene a este plati. */
function odomknute() {
  const z = nacitaj('efaktura:zaplatene');
  if (!z || !z.session || !z.typ) return null;
  const doKedy = (z.t || 0) + (PLATNOST[z.typ] || 0);
  if (Date.now() > doKedy) return null;
  return z.typ;
}
function odkazNaKupu(btn) {
  const u = (testRezim() ? btn.dataset.linkTest : btn.dataset.link) || '';
  return u && u.startsWith('https://') ? u : '';
}
function mailtoOdkaz() {
  return 'mailto:andrej@arling.sk?subject=' + encodeURIComponent(T.mailtoPredmet) + '&body=' + encodeURIComponent(T.mailtoTelo);
}

const stavPlatby = $('stav-platby');
const btnJedna = $('kupa-jedna');
const btnTrid = $('kupa-30dni');
const btnStiahnut = $('stiahnut-xml');
const blokChyb = $('chyby-generatora');

function ukazPlatbu() {
  const typ = odomknute();
  const brana = $('brana');
  if (brana) brana.hidden = !!typ;
  if (btnStiahnut) btnStiahnut.hidden = !typ;
  const odomkBlok = $('odomknute');
  if (odomkBlok) {
    odomkBlok.hidden = !typ;
    if (typ) {
      const z = nacitaj('efaktura:zaplatene') || {};
      const doKedy = new Date((z.t || 0) + (PLATNOST[typ] || 0));
      odomkBlok.textContent = T.odomknuteDo(doKedy.toLocaleDateString(T.locale) + ' ' + doKedy.toLocaleTimeString(T.locale, { hour: '2-digit', minute: '2-digit' }));
    }
  }
}

function klikNaKupu(btn, typ, cena) {
  track('efaktura_kupa_click', { cena, typ, produkt: 'efaktura', jazyk: LANG });
  const u = odkazNaKupu(btn);
  if (!u) {
    if (stavPlatby) stavPlatby.textContent = T.zapina;
    location.href = mailtoOdkaz();
    return;
  }
  location.href = u;
}
if (btnJedna) btnJedna.addEventListener('click', () => klikNaKupu(btnJedna, 'jedna', CENA_JEDNA));
if (btnTrid) btnTrid.addEventListener('click', () => klikNaKupu(btnTrid, '30dni', CENA_30DNI));

/* Stiahnutie XML: vygenerovane XML najprv prezenieme vlastnym validatorom.
 * Ked ma chybu, nestahujeme ho a ukazeme nalezy. Radsej ziadny subor nez zly. */
if (btnStiahnut) btnStiahnut.addEventListener('click', () => {
  if (!posledneXml || !blokChyb) return;
  // brana: bez zaplatenia sa nestahuje nic, aj keby sa tlacidlo objavilo inak
  if (!odomknute()) { ukazPlatbu(); return; }
  const v = skontroluj(posledneXml);
  vycisti(blokChyb);
  if (v.sumar.chyby > 0) {
    blokChyb.hidden = false;
    blokChyb.appendChild(el('p', 'poznamka', T.generatorChyby));
    for (const n of v.nalezy.filter((x) => x.zavaznost === 'chyba')) blokChyb.appendChild(riadokNalezu(n));
    return;
  }
  blokChyb.hidden = false;
  blokChyb.appendChild(el('p', 'poznamka je-ok', T.generatorOk));
  const meno = 'faktura-' + String(faktura.cislo || 'bez-cisla').replace(/[^A-Za-z0-9._-]+/g, '-') + '.xml';
  stiahni(meno, posledneXml, 'application/xml;charset=utf-8');
  track('efaktura_stiahnute', { profil: faktura.profil || 'peppol', produkt: 'efaktura', jazyk: LANG });
});

const CAKAJUCA = 'efaktura:cakajuca';
let overovanie = null;
async function overPlatbu(sid, pokus) {
  if (!stavPlatby) return false;
  stavPlatby.textContent = T.overujem + (pokus > 1 ? ' (' + pokus + ')' : '');
  let st = null, siet = false;
  try {
    const r = await fetch(API + '/v1/kontrola/status?session_id=' + encodeURIComponent(sid));
    if (r.ok) st = await r.json();
    else if (r.status >= 500 || r.status === 429) siet = true;
  } catch (e) { siet = true; }
  // Suma pred zlavovym kodom (amount_subtotal); starsi worker ju neposiela, vtedy plati amount_total.
  const zaklad = st && typeof st.amount_subtotal === 'number' ? st.amount_subtotal : st && st.amount_total;
  if (st && st.paid && typeof zaklad === 'number' && zaklad >= CENA_JEDNA) {
    const typ = zaklad >= CENA_30DNI ? '30dni' : 'jedna';
    uloz('efaktura:zaplatene', { session: sid, t: Date.now(), typ, test: st.livemode === false });
    zmaz(CAKAJUCA);
    stavPlatby.innerHTML = (typ === '30dni' ? T.zaplatene30 : T.zaplateneJedna) + (st.livemode === false ? ' ' + T.testPoznamka : '');
    track('efaktura_zaplatene', { typ, test: st.livemode === false, produkt: 'efaktura', jazyk: LANG });
    ukazPlatbu();
    return true;
  }
  if (st && st.paid) {
    zmaz(CAKAJUCA);
    stavPlatby.textContent = T.inaSuma;
    return false;
  }
  if (st && !st.paid && !siet) siet = true;
  uloz(CAKAJUCA, { session: sid, t: Date.now() });
  const dalsi = Math.min(30000, 3000 * pokus);
  stavPlatby.innerHTML = T.nepotvrdene + ' <button type="button" class="btn btn-line" id="over-znova">' + T.overZnova + '</button>';
  const btn = $('over-znova');
  if (btn) btn.addEventListener('click', () => { clearTimeout(overovanie); overPlatbu(sid, 1); });
  if (pokus < 8) overovanie = setTimeout(() => overPlatbu(sid, pokus + 1), dalsi);
  return false;
}
function poNavrate() {
  let sid = '';
  try { sid = new URL(location.href).searchParams.get('session_id') || ''; } catch (e) { /* nic */ }
  const test = testRezim();
  if (sid) { try { history.replaceState(null, '', location.pathname + (location.hash || '')); } catch (e) { /* nic */ } }
  if (!sid) {
    const c = nacitaj(CAKAJUCA);
    if (c && c.session && !odomknute()) sid = c.session;
  }
  if (!sid) return;
  if (sid.startsWith('cs_test_') && !test) { if (stavPlatby) stavPlatby.textContent = T.testCudzi; return; }
  prepni('vytvorit', true);
  overPlatbu(sid, 1);
}

function sledujCenuVidenu() {
  try {
    const box = $('brana');
    if (!box || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((zaznamy) => {
      for (const z of zaznamy) if (z.isIntersecting) { track('cena_videna', { produkt: 'efaktura', jazyk: LANG }); io.disconnect(); }
    }, { threshold: 0.5 });
    io.observe(box);
  } catch (e) { /* nic */ }
}

/* ── Start ──────────────────────────────────────────────────────────────── */
for (const b of document.querySelectorAll('.zalozka')) {
  b.addEventListener('click', () => prepni(b.dataset.tab, true));
}
window.addEventListener('hashchange', () => prepni((location.hash || '').replace('#', ''), false));

postavFormular();
prepni((location.hash || '').replace('#', '') || 'kontrola', false);
spustiKontrolu();
prekresliGenerator();
ukazPlatbu();
poNavrate();
sledujCenuVidenu();
