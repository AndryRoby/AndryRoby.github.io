/* E-faktura: kontrola, nahlad a generator UBL 2.1.
 *
 * Vsetko sa deje v prehliadaci. Subor sa cita cez FileReader, pravidla bezia
 * tu (pravidla.mjs), XML vznika tu (ubl.js) a doklad sa vykresluje tu
 * (nahlad.js). Faktura sa nenahrava. Stav platby sa overuje po navrate zo
 * Stripe (?session_id=) sa worker spyta, ci je session zaplatena a na aku sumu
 * (GET /v1/kontrola/status). Samostatny dobrovolny dopyt odosiela dopyt.js,
 * iba z vedome vyplnenych poli; faktura sa k nemu nepriklada.
 *
 * Slovenska, ceska aj nemecka stranka pouzivaju tento jeden skript; lisia sa
 * len textami v objekte T a atributom lang na <html>.
 *
 * Udalosti do Umami (ak bezi): efaktura_kontrola, efaktura_nahlad,
 * efaktura_vytvorit_nahlad, efaktura_kupa_click, efaktura_zaplatene,
 * efaktura_stiahnute, kupa_click_vysledok, plus spolocne nastroj_pouzity a cena_videna.
 */
import { skontroluj, protokol, IMPLEMENTOVANE } from './pravidla.mjs';
import * as K from './kodovniky.mjs';
import { parsujXml } from './parser.mjs';
import { vytvorUbl, prepocitaj, prazdnaFaktura, zCentov } from './ubl.js';
import { vykresliNahlad } from './nahlad.js';
import { zapojDavku } from './davka-ui.js';
import { zobrazOpakovanie } from './dopyt-opakovanie.js';
let davkaUI = null;

/* Jazyk berieme z cesty (/cs/, /de/, /en/), lebo tak je stranka rozdelena; atribut lang
 * na <html> je zaloha, keby sa stranka otvorila z ineho miesta. */
const CESTA_JAZYKA = (location.pathname.match(/\/efaktura\/(cs|de|en)\//) || [])[1] || '';
const LANG = CESTA_JAZYKA
  || (['cs', 'de', 'en'].indexOf(document.documentElement.lang) !== -1 ? document.documentElement.lang : 'sk');

/* Skloňovanie počtov v súhrnnom riadku.
 * Slovenčina a čeština majú tri tvary: 1 kus, 2 až 4 kusy, ostatné (vrátane 0).
 * Nemčina a angličtina majú dva: 1 kus a ostatné (error/errors, warning/warnings, note/notes). */
const tvar3 = (n, jeden, malo, vela) => (n === 1 ? jeden : n >= 2 && n <= 4 ? malo : vela);
const tvar2 = (n, jeden, viac) => (n === 1 ? jeden : viac);

/* Kolko pravidiel sa pre dany profil naozaj vyhodnoti.
 * Cislo sa pocita zo zoznamu IMPLEMENTOVANE v pravidla.mjs podla toho, ktore sady
 * funkcia skontroluj() pre profil spusti: jadro EN 16931 a vlastne kontroly vzdy,
 * pravidla Peppol len pri profile peppol, pravidla XRechnung len pri profile xrechnung.
 * Ked v pravidla.mjs pribudne alebo ubudne kod, cislo na stranke sa zmeni samo.
 * Kody XML-01, XML-02 a CII-01 sa vyhodnocuju este pred vyberom profilu, preto sa nepocitaju.
 * Pozor: 755 pravidiel UBL-CR/UBL-SR/UBL-DT nekontrolujeme, to cislo sa von nedava. */
const PRED_PROFILOM = ['XML-01', 'XML-02', 'CII-01'];
const jePeppolKod = (k) => k.indexOf('PEPPOL-') === 0;
const jeNemeckyKod = (k) => /^BR-DE-|^BR-DEX-|^BR-TMP-/.test(k);
const POCET_PRAVIDIEL = {
  jadro: IMPLEMENTOVANE.filter((k) => !jePeppolKod(k) && !jeNemeckyKod(k) && PRED_PROFILOM.indexOf(k) === -1).length,
  peppol: IMPLEMENTOVANE.filter(jePeppolKod).length,
  xrechnung: IMPLEMENTOVANE.filter(jeNemeckyKod).length,
};
const pocetPravidiel = (profil) => POCET_PRAVIDIEL.jadro
  + (profil === 'peppol' ? POCET_PRAVIDIEL.peppol : 0)
  + (profil === 'xrechnung' ? POCET_PRAVIDIEL.xrechnung : 0);

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
    sumarPravidla: (n) => 'Pre tento profil sme vyhodnotili ' + n + ' ' + tvar3(n, 'pravidlo', 'pravidlá', 'pravidiel') + '.',
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
    kupaJedna: 'Kúpiť jednu faktúru za 2,90 € bez DPH',
    kupa30: 'Odomknúť na 30 dní za 9,90 € bez DPH',
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
    testVodoznakXml: 'TESTOVACIA FAKTURA: odomknuta platbou v Stripe test mode, ziadne peniaze neprisli. Nepouzivajte tento subor ako skutocny doklad.',
    testStiahnutie: 'V testovacom režime sa sťahuje výslovne označené testovacie XML: názov súboru začína na TEST- a v poznámke dokladu stojí veta o testovacej faktúre. Ostré XML vydáva len zaplatená živá platba.',
    odomknuteDo: (d) => 'Odomknuté do ' + d + '.',
    platnostSkoncila: (d) => 'Platba je overená, ale jej platnosť skončila ' + d + '. Odkaz odomyká sťahovanie len počas zaplatenej doby (24 hodín alebo 30 dní od platby). Na ďalšie XML si kúpte nové odomknutie; ak si myslíte, že ide o chybu, napíšte na andrej@arling.sk s číslom objednávky.',
    testZakazany: 'Testovacie platby odomykajú len skúšky prevádzkovateľa stránky. Táto testovacia platba nič neodomkne a žiadne peniaze neprišli.',
    odkazNadpis: 'Uložte si tento odkaz.',
    odkazText: 'Týmto odkazom sa k zaplatenému sťahovaniu dostanete aj v inom prehliadači alebo na inom počítači, kým platnosť trvá. Stránka si platbu overí znova priamo u Stripe, takže odkaz sa dá použiť opakovane.',
    odkazMail: 'Poslať mi odkaz e-mailom',
    odkazPravda: 'Vyplnená faktúra ostáva len v tomto prehliadači a nikam sa neposiela. V inom prehliadači sa sťahovanie odomkne, ale údaje faktúry si zadáte znova. Od nás vám o tomto nákupe žiadny e-mail nepríde, doklad vám pošle Link.',
    odkazPredmet: 'Odkaz na moje zaplatené XML z arling.sk',
    odkazTelo: (u) => 'Odkaz na zaplatené sťahovanie XML:\n\n' + u + '\n\nOdkaz si odložte. Po jeho otvorení sa sťahovanie odomkne aj v inom prehliadači.',
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
    sumarPravidla: (n) => 'Pro tento profil jsme vyhodnotili ' + n + ' ' + tvar3(n, 'pravidlo', 'pravidla', 'pravidel') + '.',
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
    kupaJedna: 'Koupit jednu fakturu za 2,90 € bez DPH',
    kupa30: 'Odemknout na 30 dní za 9,90 € bez DPH',
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
    testVodoznakXml: 'TESTOVACI FAKTURA: odemcena platbou ve Stripe test modu, zadne penize neprisly. Nepouzivejte tento soubor jako skutecny doklad.',
    testStiahnutie: 'V testovacím režimu se stahuje výslovně označené testovací XML: název souboru začíná na TEST- a v poznámce dokladu stojí věta o testovací faktuře. Ostré XML vydá jen zaplacená živá platba.',
    odomknuteDo: (d) => 'Odemčeno do ' + d + '.',
    platnostSkoncila: (d) => 'Platba je ověřená, ale její platnost skončila ' + d + '. Odkaz odemyká stahování jen po zaplacenou dobu (24 hodin nebo 30 dní od platby). Na další XML si kupte nové odemčení; pokud jde podle vás o chybu, napište na andrej@arling.sk s číslem objednávky.',
    testZakazany: 'Testovací platby odemykají jen zkoušky provozovatele stránky. Tato testovací platba nic neodemkne a žádné peníze nepřišly.',
    odkazNadpis: 'Uložte si tento odkaz.',
    odkazText: 'Tímto odkazem se k zaplacenému stahování dostanete i v jiném prohlížeči nebo na jiném počítači, dokud platnost trvá. Stránka si platbu ověří znovu přímo u Stripe, takže odkaz lze použít opakovaně.',
    odkazMail: 'Poslat mi odkaz e-mailem',
    odkazPravda: 'Vyplněná faktura zůstává jen v tomto prohlížeči a nikam se neodesílá. V jiném prohlížeči se stahování odemkne, ale údaje faktury zadáte znovu. Od nás vám o tomto nákupu žádný e-mail nepřijde, doklad vám pošle Link.',
    odkazPredmet: 'Odkaz na moje zaplacené XML z arling.sk',
    odkazTelo: (u) => 'Odkaz na zaplacené stahování XML:\n\n' + u + '\n\nOdkaz si uložte. Po jeho otevření se stahování odemkne i v jiném prohlížeči.',
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
    sumarPravidla: (n) => 'Für dieses Profil haben wir ' + n + ' ' + tvar2(n, 'Regel', 'Regeln') + ' ausgewertet.',
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
    kupaJedna: 'Eine Rechnung für 2,90 € zzgl. MwSt. kaufen',
    kupa30: 'Für 30 Tage freischalten, 9,90 € zzgl. MwSt.',
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
    testVodoznakXml: 'TESTRECHNUNG: durch eine Zahlung im Stripe-Testmodus freigeschaltet, es wurde kein Geld ueberwiesen. Verwenden Sie diese Datei nicht als echten Beleg.',
    testStiahnutie: 'Im Testmodus wird ausdrücklich gekennzeichnetes Test-XML heruntergeladen: der Dateiname beginnt mit TEST- und im Hinweis des Belegs steht der Satz über die Testrechnung. Echtes XML gibt nur eine bezahlte Livezahlung frei.',
    odomknuteDo: (d) => 'Freigeschaltet bis ' + d + '.',
    platnostSkoncila: (d) => 'Die Zahlung ist bestätigt, ihr Zeitraum endete aber am ' + d + '. Der Link schaltet den Download nur für den bezahlten Zeitraum frei (24 Stunden oder 30 Tage ab Zahlung). Für weitere XML-Dateien kaufen Sie eine neue Freischaltung; falls Sie einen Fehler vermuten, schreiben Sie an andrej@arling.sk mit Ihrer Bestellnummer.',
    testZakazany: 'Testzahlungen schalten nur Tests des Seitenbetreibers frei. Diese Testzahlung schaltet nichts frei, es wurde kein Geld überwiesen.',
    odkazNadpis: 'Bewahren Sie diesen Link auf.',
    odkazText: 'Mit diesem Link kommen Sie auch in einem anderen Browser oder an einem anderen Rechner an den bezahlten Download, solange die Freischaltung gilt. Die Seite prüft die Zahlung erneut direkt bei Stripe, der Link lässt sich also mehrfach verwenden.',
    odkazMail: 'Link per E-Mail an mich senden',
    odkazPravda: 'Die ausgefüllte Rechnung bleibt nur in diesem Browser und wird nirgendwohin gesendet. In einem anderen Browser wird der Download freigeschaltet, die Rechnungsdaten geben Sie dort erneut ein. Von uns kommt zu diesem Kauf keine E-Mail, den Beleg schickt Ihnen Link.',
    odkazPredmet: 'Link zu meinem bezahlten XML von arling.sk',
    odkazTelo: (u) => 'Link zum bezahlten XML-Download:\n\n' + u + '\n\nBewahren Sie den Link auf. Beim Öffnen wird der Download auch in einem anderen Browser freigeschaltet.',
    mailtoPredmet: 'E-Rechnung: XML zum Herunterladen',
    mailtoTelo: 'Guten Tag,\n\ndie Zahlung für das XML von arling.sk/efaktura/ wird noch aktiviert. Die ausgefüllte Rechnung liegt in meinem Browser bereit. Bitte um Hinweise.\n\nVielen Dank',
  },
  en: {
    locale: 'en-IE',
    legendaDodavatel: 'Seller', legendaOdberatel: 'Buyer', legendaFaktura: 'Invoice', legendaPolozky: 'Lines',
    zavaznost: { chyba: 'Error', varovanie: 'Warning', informacia: 'Note' },
    sumarProfil: 'Profile', sumarTyp: 'Document type',
    sumarChyby: (n) => tvar2(n, 'error', 'errors'),
    sumarVarovania: (n) => tvar2(n, 'warning', 'warnings'),
    sumarInformacie: (n) => tvar2(n, 'note', 'notes'),
    sumarPravidla: (n) => 'For this profile we evaluated ' + n + ' ' + tvar2(n, 'rule', 'rules') + '.',
    bezChyb: 'We found no errors and no warnings. The file passed the rules we check.',
    maChyby: (n) => n === 1
      ? 'We found 1 error. Fix it and check again.'
      : 'We found ' + n + ' errors. Fix them and check again.',
    povodneZnenie: 'Original wording of the rule',
    xpathPopis: 'Path to the element',
    hodnotaPopis: 'Value in the file',
    nacitajteSubor: 'Load a file first, or paste the XML.',
    citam: 'Reading the file…',
    prilisVelky: (mb) => 'The file is larger than ' + mb + ' MB. E-invoices that big do not occur in practice; if you really have one, write to andrej@arling.sk.',
    nacitane: (n, kb) => 'Loaded: ' + n + ' (' + kb + ' kB).',
    vzorNacitany: 'We loaded a sample invoice. The data is made up, but it passes the check.',
    skopirovane: 'Copied.',
    kopirovanieZlyhalo: 'Copying failed, select the text with the mouse instead.',
    prazdnyNahlad: 'Load a file and the document will be drawn here.',
    typNieJeUbl: 'We can only draw the document from UBL 2.1 (Invoice or CreditNote). What is in the file we say in the Check tab.',
    // generator
    pridatRiadok: 'Add line',
    zmazatRiadok: 'Delete',
    pNazov: 'Item name', pMnozstvo: 'Quantity', pJednotka: 'Unit', pCena: 'Price without VAT', pSadzba: 'VAT rate', pKategoria: 'VAT category',
    sadzbaNeznama: 'We do not offer VAT rates for this country of the seller, because we have not verified them at an official source. Enter the rate yourself, in percent.',
    sadzbaNeistota: 'The rates offered for {k} come from expert sources, not from a government page we fetched ourselves. Check the rate yourself before you send the invoice. The Slovak rates we verified directly at financnasprava.sk.',
    napovedaEndpoint: 'Your address in the Peppol network. With code 0088 it is a GS1 GLN, with 0245 the Slovak tax number DIC (exactly 10 digits, no SK prefix), with 9930 the German VAT number. For other countries look the code up in the CEF EAS code list.',
    suctyZaklad: 'Net', suctyDph: 'VAT', suctySpolu: 'Total with VAT', suctyUhrada: 'Amount due',
    ulozDodavatela: 'Save the seller in this browser',
    ulozOdberatela: 'Save the buyer to the address book',
    vybratOdberatela: 'Pick from the address book',
    ulozene: 'Saved in this browser.',
    adresarPrazdny: 'The address book is still empty.',
    vymazatVsetko: 'Erase the data from this browser',
    vymazatOtazka: 'Erase the filled in data and the address book from this browser?',
    stiahnutXml: 'Download XML',
    ulozitPdf: 'Save as PDF',
    generatorChyby: 'We built the XML, but it did not pass our own check. We are not downloading it, so that you do not send a broken invoice. Fix this:',
    generatorOk: 'The XML passed our check with no errors.',
    // platba
    kupaJedna: 'Buy one invoice for 2.90 € excl. VAT',
    kupa30: 'Unlock for 30 days, 9.90 € excl. VAT',
    zapina: 'Payment is still being switched on. Write to andrej@arling.sk and I will send you the XML by e-mail.',
    overujem: 'Checking the payment…',
    zaplateneJedna: '<b>Paid, thank you.</b> The XML download is unlocked in this browser for 24 hours, so you can correct the invoice and download it again.',
    zaplatene30: '<b>Paid, thank you.</b> The XML download is unlocked in this browser for 30 days, with no limit on the number of invoices.',
    inaSuma: 'The payment arrived, but for a different amount. Write to andrej@arling.sk and we will sort it out by hand.',
    nepotvrdene: 'We could not confirm the payment yet. We keep trying; if you have paid, the download unlocks as soon as Stripe answers. If this takes longer than a few minutes, write to andrej@arling.sk with the order number from the Stripe e-mail.',
    overZnova: 'Check the payment again',
    siet: 'Checking the payment failed (network). Reload the page; if it keeps happening, write to andrej@arling.sk.',
    testCudzi: 'This is a test payment from Stripe test mode. It unlocks the download only in the browser that started the test with ?test=1.',
    testPoznamka: '(Test mode: the payment was in Stripe test mode, no money changed hands.)',
    testVodoznakXml: 'TEST INVOICE: unlocked by a payment in Stripe test mode, no money changed hands. Do not use this file as a real document.',
    testStiahnutie: 'In test mode the download is an explicitly marked test XML: the file name starts with TEST- and the document note carries the sentence about a test invoice. Only a paid live payment produces the real XML.',
    odomknuteDo: (d) => 'Unlocked until ' + d + '.',
    platnostSkoncila: (d) => 'The payment is confirmed, but its period ended on ' + d + '. The link unlocks the download only for the paid period (24 hours or 30 days from payment). For more XML files, buy a new unlock; if you think this is a mistake, write to andrej@arling.sk with your order number.',
    testZakazany: 'Test payments only unlock the site owner\'s own rehearsals. This test payment unlocks nothing, and no money changed hands.',
    odkazNadpis: 'Save this link.',
    odkazText: 'This link takes you back to the paid download in another browser or on another computer, for as long as the unlock lasts. The page checks the payment again straight with Stripe, so the link works more than once.',
    odkazMail: 'E-mail the link to me',
    odkazPravda: 'The invoice you filled in stays in this browser only and is never sent anywhere. In another browser the download unlocks, but you enter the invoice data again. We send you no e-mail about this purchase; the receipt comes from Stripe.',
    odkazPredmet: 'Link to my paid XML from arling.sk',
    odkazTelo: (u) => 'Link to the paid XML download:\n\n' + u + '\n\nKeep this link. Opening it unlocks the download in another browser too.',
    mailtoPredmet: 'E-invoice: XML download',
    mailtoTelo: 'Hello,\n\nthe payment for the XML from arling.sk/efaktura/ is still being switched on. The filled in invoice is ready in my browser. Please advise.\n\nThank you',
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
  en: {
    nazov: 'Name', ico: 'Registration number', icDph: 'VAT number', ulica: 'Street and number', mesto: 'City', psc: 'Post code',
    krajina: 'Country', email: 'E-mail', telefon: 'Phone', kontakt: 'Contact person',
    iban: 'IBAN', bic: 'BIC', endpoint: 'Electronic address', endpointSchema: 'Address code (schemeID)',
    cislo: 'Invoice number', typ: 'Document type', datumVystavenia: 'Issue date', datumDodania: 'Delivery date',
    datumSplatnosti: 'Due date', mena: 'Currency', variabilnySymbol: 'Payment reference',
    referenciaOdberatela: 'Buyer reference', poznamka: 'Note', sposobPlatby: 'Payment means',
    profil: 'Profile (CustomizationID)', zaplatene: 'Amount already paid',
    platobnePodmienky: 'Payment terms (text on the document)',
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
 * Anglicka stranka ma vlastny vzor nizsie (VZOR_XML_EN): cezhranicna sluzba
 * z Irska do Holandska s prenesenim danovej povinnosti, aby sme nikde
 * netvrdili narodnu sadzbu DPH, ktoru nemame overenu na oficialnom zdroji.
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

/* Anglicky vzor: irsky dodavatel, holandsky odberatel, EUR, prenesenie danovej
 * povinnosti (kategoria AE, sadzba 0 %) s kodom oslobodenia VATEX-EU-AE.
 * Elektronicke adresy su GLN so schemeID 0088 (kod je v zozname CEF EAS aj v
 * Peppol EAS, pozri kodovniky.mjs EAS_PEPPOL); kontrolne cislice GLN sedia,
 * takze prejde aj pravidlo PEPPOL-COMMON-R040. Vsetky udaje su vymyslene. */
const VZOR_XML_EN = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>2026-0142</cbc:ID>
  <cbc:IssueDate>2026-09-11</cbc:IssueDate>
  <cbc:DueDate>2026-09-25</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:Note>Sample invoice from arling.sk/efaktura/. All data is made up.</cbc:Note>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cbc:BuyerReference>PO-2026-77</cbc:BuyerReference>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cbc:EndpointID schemeID="0088">5390000000014</cbc:EndpointID>
      <cac:PostalAddress>
        <cbc:StreetName>12 Sample Quay</cbc:StreetName>
        <cbc:CityName>Dublin</cbc:CityName>
        <cbc:PostalZone>D02 XY45</cbc:PostalZone>
        <cac:Country>
          <cbc:IdentificationCode>IE</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>IE1234567FA</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>Sample Workshop Limited</cbc:RegistrationName>
        <cbc:CompanyID>512345</cbc:CompanyID>
      </cac:PartyLegalEntity>
      <cac:Contact>
        <cbc:Name>Jane Sample</cbc:Name>
        <cbc:Telephone>+353 1 000 0000</cbc:Telephone>
        <cbc:ElectronicMail>billing@sampleworkshop.example</cbc:ElectronicMail>
      </cac:Contact>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cbc:EndpointID schemeID="0088">8710000000017</cbc:EndpointID>
      <cac:PostalAddress>
        <cbc:StreetName>Voorbeeldstraat 8</cbc:StreetName>
        <cbc:CityName>Amsterdam</cbc:CityName>
        <cbc:PostalZone>1011 AB</cbc:PostalZone>
        <cac:Country>
          <cbc:IdentificationCode>NL</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>NL123456789B01</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>Sample Buyer B.V.</cbc:RegistrationName>
        <cbc:CompanyID>34000002</cbc:CompanyID>
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
      <cbc:ID>IE29AIBK93115212345678</cbc:ID>
      <cbc:Name>Sample Workshop Limited</cbc:Name>
    </cac:PayeeFinancialAccount>
  </cac:PaymentMeans>
  <cac:PaymentTerms>
    <cbc:Note>Due within 14 days of the issue date.</cbc:Note>
  </cac:PaymentTerms>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="EUR">0.00</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="EUR">1500.00</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="EUR">0.00</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>AE</cbc:ID>
        <cbc:Percent>0.00</cbc:Percent>
        <cbc:TaxExemptionReasonCode>VATEX-EU-AE</cbc:TaxExemptionReasonCode>
        <cbc:TaxExemptionReason>Reverse charge</cbc:TaxExemptionReason>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">1500.00</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="EUR">1500.00</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">1500.00</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="EUR">1500.00</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  <cac:InvoiceLine>
    <cbc:ID>1</cbc:ID>
    <cbc:InvoicedQuantity unitCode="HUR">12</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="EUR">1080.00</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>Machine servicing, on site</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>AE</cbc:ID>
        <cbc:Percent>0.00</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="EUR">90.00</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>
  <cac:InvoiceLine>
    <cbc:ID>2</cbc:ID>
    <cbc:InvoicedQuantity unitCode="C62">1</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="EUR">420.00</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>Spare bearings, set</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>AE</cbc:ID>
        <cbc:Percent>0.00</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="EUR">420.00</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>
</Invoice>
`;

const VZOR = LANG === 'en' ? VZOR_XML_EN : VZOR_XML;

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
let vstupJeUkazka = false;

function stavVstupu(text) { const s = $('vstup-stav'); if (s) s.textContent = text; }

function prijmiText(text, nazov, ukazka = false) {
  xmlText = text;
  vstupJeUkazka = ukazka || text.trim() === VZOR.trim();
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
  if (vzor) vzor.addEventListener('click', () => { prijmiText(VZOR, LANG === 'en' ? 'sample-e-invoice.xml' : 'vzor-efaktura.xml', true); stavVstupu(T.vzorNacitany); });
  const spustit = $('spustit');
  if (spustit) spustit.addEventListener('click', () => {
    const ta = $('xml');
    const t = ta ? ta.value : '';
    if (!t.trim()) { stavVstupu(T.nacitajteSubor); return; }
    prijmiText(t, nazovSuboru || 'vlozene.xml');
  });
}

/* Spustenie nastroja z prvej obrazovky. Nemecka stranka ma tieto tlacidla nad zahybom,
 * lebo vstup nastroja bol na 390 px az na y=1824 pri okne vysokom 844 px. Ostatne
 * jazyky tieto prvky zatial nemaju, preto sa vsetko kontroluje cez if. */
function kNastroju() {
  const c = $('nastroj');
  if (c && c.scrollIntoView) { try { c.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { c.scrollIntoView(); } }
}
const heroVzor = $('hero-vzor');
if (heroVzor) heroVzor.addEventListener('click', () => {
  prepni('kontrola', true);
  prijmiText(VZOR, LANG === 'en' ? 'sample-e-invoice.xml' : 'vzor-efaktura.xml', true);
  stavVstupu(T.vzorNacitany);
  kNastroju();
});
const heroSubor = $('hero-subor');
if (heroSubor) heroSubor.addEventListener('click', () => {
  prepni('kontrola', true);
  kNastroju();
  const s = $('subor');
  if (s) s.click();
});
const heroVytvorit = $('hero-vytvorit');
if (heroVytvorit) heroVytvorit.addEventListener('click', () => { prepni('vytvorit', true); kNastroju(); });

/* Kto hlada "e-rechnung freiberufler", ma najcastejsie v prilohe XML od dodavatela
 * a chce ho precitat, nie zoznam nalezov. hero-subor otvara zalozku Prufung,
 * preto samostatne tlacidlo na Vorschau: prepneme panel EST pred vyberom suboru,
 * lebo prijmiText() sa riadi tym, ktora zalozka je prave aktivna (r. 698). */
const heroCitat = $('hero-citat');
if (heroCitat) heroCitat.addEventListener('click', () => {
  prepni('nahlad', true);
  kNastroju();
  const s = $('subor');
  if (s) s.click();
});

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
  const kupaBlok = $('kupa-vysledok-blok');
  if (!xmlText.trim()) {
    vycisti(cielSumar); vycisti(cielNalezy);
    cielSumar.appendChild(el('p', 'poznamka', T.nacitajteSubor));
    if (akcie) akcie.hidden = true;
    if (kupaBlok) kupaBlok.hidden = true;
    zobrazOpakovanie(false);
    return;
  }
  const v = skontroluj(xmlText);
  poslednyVysledok = v;
  vycisti(cielSumar);
  const s = v.sumar;
  const stav = el('p', 'sumar-stav ' + (s.chyby ? 'je-chyba' : 'je-ok'), s.chyby ? T.maChyby(s.chyby) : T.bezChyb);
  cielSumar.appendChild(stav);
  const meta = el('p', 'sumar-meta');
  meta.appendChild(el('span', null, T.sumarProfil + ': ' + (LANG === 'en' ? (v.profilNazovEn || v.profilNazov) : v.profilNazov)));
  meta.appendChild(el('span', null, T.sumarTyp + ': ' + v.typ));
  meta.appendChild(el('span', null, s.chyby + ' ' + T.sumarChyby(s.chyby)));
  meta.appendChild(el('span', null, s.varovania + ' ' + T.sumarVarovania(s.varovania)));
  meta.appendChild(el('span', null, s.informacie + ' ' + T.sumarInformacie(s.informacie)));
  cielSumar.appendChild(meta);
  // Pravidla bezia len nad UBL 2.1; pri CII alebo pri chybe XML by cislo klamalo.
  const bezaliPravidla = v.typ === 'Invoice' || v.typ === 'CreditNote';
  // Kolko pravidiel na tento subor naozaj beralo; cislo je z pravidla.mjs, nie natvrdo.
  if (bezaliPravidla) cielSumar.appendChild(el('p', 'sumar-meta sumar-pravidla', T.sumarPravidla(pocetPravidiel(v.profil))));
  vycisti(cielNalezy);
  for (const n of v.nalezy) cielNalezy.appendChild(riadokNalezu(n));
  if (akcie) akcie.hidden = false;
  // Platene tlacidlo hned pod uspesnym vysledkom bezplatnej kontroly (len tam, kde ho stranka ma).
  if (kupaBlok) kupaBlok.hidden = !(bezaliPravidla && s.chyby === 0);
  zobrazOpakovanie(bezaliPravidla && !vstupJeUkazka);
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

const KRAJINY = ['SK', 'CZ', 'DE', 'AT', 'PL', 'HU', 'IE', 'NL', 'BE', 'FR', 'IT', 'ES', 'SE', 'NO', 'DK', 'FI'];
const MENY = ['EUR', 'CZK', 'PLN', 'HUF', 'USD', 'GBP'];
const KATEGORIE = ['S', 'Z', 'E', 'AE', 'K', 'G', 'O'];
// Uvadzame len kody, ktore mame dolozene v ops/efaktura/fakty.md (body 1.9, 2.5) a
// v kodovniky.mjs (EAS_PEPPOL). Pre ine krajiny kod nehadame.
const SCHEMEID = LANG === 'en'
  ? [
    { kod: '0088', popis: 'GLN (GS1), any country' },
    { kod: '0245', popis: 'SK: tax number DIC' },
    { kod: '9930', popis: 'DE: VAT number' },
    { kod: '0204', popis: 'DE: Leitweg-ID' },
  ]
  : [
    { kod: '0245', popis: 'SK: DIČ' },
    { kod: '9930', popis: 'DE: USt-IdNr.' },
    { kod: '0204', popis: 'DE: Leitweg-ID' },
    { kod: '0088', popis: 'GLN (GS1)' },
  ];

const POLIA_DODAVATEL = ['nazov', 'ico', 'icDph', 'ulica', 'mesto', 'psc', 'krajina', 'email', 'telefon', 'kontakt', 'iban', 'bic', 'endpoint', 'endpointSchema'];
const POLIA_ODBERATEL = ['nazov', 'ico', 'icDph', 'ulica', 'mesto', 'psc', 'krajina', 'email', 'endpoint', 'endpointSchema'];
const POLIA_FAKTURA = ['cislo', 'typ', 'profil', 'datumVystavenia', 'datumDodania', 'datumSplatnosti', 'mena', 'variabilnySymbol', 'referenciaOdberatela', 'sposobPlatby', 'zaplatene', 'platobnePodmienky', 'poznamka'];

// Predvolena krajina podla jazyka stranky: SK, CZ alebo DE (DE zaroven nastavi profil XRechnung).
// Anglicka stranka je globalna, preto zacina na Irsku ako vo vzorovej fakture; sadzbu DPH
// tam neponukame (nemame ju overenu), stranka to pod polozkami napise.
const KRAJINA_JAZYKA = LANG === 'de' ? 'DE' : LANG === 'cs' ? 'CZ' : LANG === 'en' ? 'IE' : 'SK';
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
  if (!z || !['jedna', '30dni'].includes(z.typ) || typeof z.session !== 'string' || !/^cs_(test|live)_[a-zA-Z0-9]+$/.test(z.session)) return null;
  if (z.test !== testRezim() || !z.session.startsWith(testRezim() ? 'cs_test_' : 'cs_live_')) return null;
  if (!Number.isFinite(z.t) || z.t > Date.now()) return null;
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
/* Odomkla stahovanie testovacia platba? odomknute() uz ziada, aby sa z.test
 * rovnal rezimu tohto prehliadaca, takze odomknute v testovom rezime je vzdy
 * testovacia platba. Vtedy z generatora vyjde vyslovne oznacene testovacie XML
 * (nazov TEST-... a veta v poznamke dokladu), nikdy ostre. Nalez N1 auditu
 * z 21. 9. 2026: verejny parameter ?test=1 vydaval ostre XML. */
function testovyNakup() {
  return !!odomknute() && testRezim();
}
/* Kopia faktury s vetou o teste v poznamke dokladu (cbc:Note). Vlastnu
 * poznamku pouzivatela neprepise, len sa pred nu pripoji. Ciste, bez DOM:
 * testuje sa v products/arling-sk/efaktura/platba.test.mjs. */
function fakturaSTestomVPoznamke(f, veta) {
  const p = String((f && f.poznamka) || '').trim();
  return Object.assign({}, f, { poznamka: p ? veta + ' ' + p : veta });
}
function oznacXmlAkoTest(f) {
  try {
    return vytvorUbl(fakturaSTestomVPoznamke(f, T.testVodoznakXml), { profil: f.profil || 'peppol', jazyk: LANG });
  } catch (e) { return ''; }
}
/* Je odpoved workera platbou presne za tento produkt a presne v tomto rezime?
 * Vracia 'jedna', '30dni' alebo null. Presna suma a mena z registra
 * (ops/stripe/efaktura-odkazy.json: 290 a 990 centov, EUR) a livemode zhodny
 * s rezimom prehliadaca; testovacia platba tak nikdy neodomkne ostry rezim
 * a ziva platba neodomkne testovaci. Ciste, bez DOM a bez siete. */
function jeNasaPlatba(st, jeTest) {
  if (!st || typeof st !== 'object' || !st.paid) return null;
  if (st.livemode !== !jeTest) return null;
  if (st.currency !== 'eur') return null;
  const zaklad = typeof st.amount_subtotal === 'number' ? st.amount_subtotal : st.amount_total;
  if (zaklad === CENA_30DNI) return '30dni';
  if (zaklad === CENA_JEDNA) return 'jedna';
  return null;
}
/* Od kedy plati odomknutie, v milisekundach. Worker vracia created zo Stripe
 * session (sekundy od 1970, okamih otvorenia pokladne, platba nasleduje o par
 * minut). Do 24. 9. 2026 sa tu bral okamih OVERENIA (Date.now()), takze kazde
 * otvorenie navratoveho odkazu spustilo 24 hodin alebo 30 dni odznova a jedna
 * platba 2,90 EUR bola trvala licencia (ops/stripe/zmena-cien-2026-09-22.md,
 * cast 6, "Netesniaca brana"). Cas z buducnosti platnost nepredlzi. Chybajuci
 * created znamena starsi worker: vtedy ostava okamih overenia, preto sa worker
 * nasadzuje pred touto strankou. Ciste, testuje platba.test.mjs. */
function zaciatokPlatnosti(st, teraz) {
  const c = st && typeof st.created === 'number' && Number.isFinite(st.created) && st.created > 0 ? st.created * 1000 : null;
  return c === null ? teraz : Math.min(c, teraz);
}
function platnostDo(t, typ) {
  return t + (PLATNOST[typ] || 0);
}
/* Navrat k nakupu bez e-mailu (nalez N5 auditu). Ten isty koncovy bod, ktory
 * stranka vola po platbe (GET /v1/kontrola/status), je len citanie session
 * v Stripe a da sa volat opakovane, takze tento odkaz odomkne stahovanie aj
 * v inom prehliadaci, kym platnost trva. Ziadne odosielanie z nasho servera:
 * tlacidlo otvori vlastneho postoveho klienta cez mailto:. */
function odkazNaNakup() {
  const z = nacitaj('efaktura:zaplatene');
  if (!z || !z.session) return '';
  try {
    const u = new URL(location.href);
    u.hash = '';
    u.search = '';
    u.searchParams.set('session_id', z.session);
    if (z.test) u.searchParams.set('test', '1');
    return u.toString();
  } catch (e) { return ''; }
}
function postavOdkazSpat(koren) {
  const url = odkazNaNakup();
  if (!koren || !url) return;
  const el2 = (tag, trieda, text) => { const x = document.createElement(tag); if (trieda) x.className = trieda; if (text) x.textContent = text; return x; };
  koren.appendChild(el2('h3', null, T.odkazNadpis));
  koren.appendChild(el2('p', null, T.odkazText));
  const pa = el2('p', 'odkaz-spat-url');
  // Dlhe session id sa na telefone musi zalomit, inak by rozbilo rozlozenie.
  pa.style.overflowWrap = 'anywhere';
  const a = document.createElement('a');
  a.href = url;
  a.rel = 'nofollow';
  a.textContent = url;
  pa.appendChild(a);
  koren.appendChild(pa);
  const cta = el2('p');
  const mail = el2('a', 'btn btn-line', T.odkazMail);
  mail.href = 'mailto:?subject=' + encodeURIComponent(T.odkazPredmet) + '&body=' + encodeURIComponent(T.odkazTelo(url));
  mail.addEventListener('click', () => track('efaktura_odkaz_mailto', { produkt: 'efaktura', jazyk: LANG }));
  cta.appendChild(mail);
  koren.appendChild(cta);
  koren.appendChild(el2('p', 'pomoc', T.odkazPravda));
  if (testovyNakup()) koren.appendChild(el2('p', 'pomoc', T.testStiahnutie));
}

const stavPlatby = $('stav-platby');
const btnJedna = $('kupa-jedna');
const btnTrid = $('kupa-30dni');
const btnStiahnut = $('stiahnut-xml');
const blokChyb = $('chyby-generatora');

function ukazPlatbu() {
  if (davkaUI) davkaUI.obnovPlatbu();
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
      odomkBlok.textContent = '';
      const prvy = document.createElement('p');
      prvy.textContent = T.odomknuteDo(doKedy.toLocaleDateString(T.locale) + ' ' + doKedy.toLocaleTimeString(T.locale, { hour: '2-digit', minute: '2-digit' }));
      odomkBlok.appendChild(prvy);
      postavOdkazSpat(odomkBlok);
    }
  }
}

/* miesto: 'dole' je tlacidlo v brane pod generatorom, 'vysledok' to iste tlacidlo
 * hned pod uspesnou bezplatnou kontrolou. Obe posielaju efaktura_kupa_click, takze
 * sucet klikov ostava jeden; tlacidlo pri vysledku navyse posle kupa_click_vysledok,
 * aby bolo vidiet, ktore miesto ludia klikaju. */
function klikNaKupu(btn, typ, cena, miesto) {
  const kde = miesto || 'dole';
  track('efaktura_kupa_click', { cena, typ, miesto: kde, produkt: 'efaktura', jazyk: LANG });
  if (kde === 'vysledok') track('kupa_click_vysledok', { cena, typ, produkt: 'efaktura', jazyk: LANG });
  const u = odkazNaKupu(btn);
  if (!u) {
    if (stavPlatby) stavPlatby.textContent = T.zapina;
    location.href = mailtoOdkaz();
    return;
  }
  location.href = u;
}
if (btnJedna) btnJedna.addEventListener('click', () => klikNaKupu(btnJedna, 'jedna', CENA_JEDNA, 'dole'));
if (btnTrid) btnTrid.addEventListener('click', () => klikNaKupu(btnTrid, '30dni', CENA_30DNI, 'dole'));
const btnVysledok = $('kupa-vysledok');
if (btnVysledok) btnVysledok.addEventListener('click', () => klikNaKupu(btnVysledok, 'jedna', CENA_JEDNA, 'vysledok'));

/* Stiahnutie XML: vygenerovane XML najprv prezenieme vlastnym validatorom.
 * Ked ma chybu, nestahujeme ho a ukazeme nalezy. Radsej ziadny subor nez zly. */
if (btnStiahnut) btnStiahnut.addEventListener('click', () => {
  if (!posledneXml || !blokChyb) return;
  // brana: bez zaplatenia sa nestahuje nic, aj keby sa tlacidlo objavilo inak
  if (!odomknute()) { ukazPlatbu(); return; }
  /* Testovacia platba nesmie vydat ostre XML. Poznamka dokladu (cbc:Note)
     nesie vetu o testovacej fakture, nazov suboru zacina na TEST-. Vlastnu
     poznamku pouzivatela to neprepise, len sa pred nu pripoji. */
  const jeTest = testovyNakup();
  const xml = jeTest ? oznacXmlAkoTest(faktura) : posledneXml;
  if (!xml) return;
  const v = skontroluj(xml);
  vycisti(blokChyb);
  if (v.sumar.chyby > 0) {
    blokChyb.hidden = false;
    blokChyb.appendChild(el('p', 'poznamka', T.generatorChyby));
    for (const n of v.nalezy.filter((x) => x.zavaznost === 'chyba')) blokChyb.appendChild(riadokNalezu(n));
    return;
  }
  blokChyb.hidden = false;
  blokChyb.appendChild(el('p', 'poznamka je-ok', T.generatorOk));
  if (jeTest) blokChyb.appendChild(el('p', 'poznamka', T.testStiahnutie));
  const meno = (jeTest ? 'TEST-' : '') + 'faktura-' + String(faktura.cislo || 'bez-cisla').replace(/[^A-Za-z0-9._-]+/g, '-') + '.xml';
  stiahni(meno, xml, 'application/xml;charset=utf-8');
  track('efaktura_stiahnute', { profil: faktura.profil || 'peppol', test: jeTest, produkt: 'efaktura', jazyk: LANG });
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
  const typ = jeNasaPlatba(st, testRezim());
  if (typ) {
    const teraz = Date.now();
    const t = zaciatokPlatnosti(st, teraz);
    zmaz(CAKAJUCA);
    if (teraz >= platnostDo(t, typ)) {
      // Zaplatene, ale platnost uz skoncila: odkaz sa neda pouzit donekonecna.
      const skoncila = new Date(platnostDo(t, typ));
      stavPlatby.textContent = T.platnostSkoncila(skoncila.toLocaleDateString(T.locale) + ' ' + skoncila.toLocaleTimeString(T.locale, { hour: '2-digit', minute: '2-digit' }));
      track('efaktura_platnost_skoncila', { typ, test: st.livemode === false, produkt: 'efaktura', jazyk: LANG });
      ukazPlatbu();
      return false;
    }
    uloz('efaktura:zaplatene', { session: sid, t, typ, test: st.livemode === false });
    stavPlatby.innerHTML = (typ === '30dni' ? T.zaplatene30 : T.zaplateneJedna) + (st.livemode === false ? ' ' + T.testPoznamka : '');
    track('efaktura_zaplatene', { typ, test: st.livemode === false, produkt: 'efaktura', jazyk: LANG });
    /* Jediny oznam von: platba je overena u Stripu. Meranie konverzii Google Ads
     * pocuva na tuto udalost vo vlozenom skripte na navratovej stranke
     * (products/arling-sk/efaktura/de/index.html a .../en/index.html, cast
     * "Konverzia Google Ads"). Ked stranka meranie nema, nikto nepocuva a
     * nedeje sa nic. Suma je v centoch, presne ako ju vratil Stripe. */
    try {
      window.dispatchEvent(new CustomEvent('arling:platba-overena', {
        detail: { session: sid, suma: zaklad, mena: st.currency, test: st.livemode === false },
      }));
    } catch (e) { /* nic */ }
    ukazPlatbu();
    return true;
  }
  if (st && st.paid) {
    zmaz(CAKAJUCA);
    stavPlatby.textContent = T.inaSuma;
    return false;
  }
  if (st && st.reason === 'test_disabled') {
    // Worker testovaciu platbu cudzej adresy odmietol (TEST_EMAILS, nalez N1):
    // to je jasne nie, nie oneskorenie, preto sa neopakuje.
    zmaz(CAKAJUCA);
    stavPlatby.textContent = T.testZakazany;
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
window.addEventListener('hashchange', () => { const m = (location.hash || '').replace('#', ''); prepni(m, false); if (PANELY.includes(m)) kNastroju(); });

postavFormular();
prepni((location.hash || '').replace('#', '') || document.body.dataset.efakturaStart || 'kontrola', false);
spustiKontrolu();
prekresliGenerator();
ukazPlatbu();
davkaUI = zapojDavku({ jazyk: LANG, zaklad: () => faktura, platba: () => nacitaj('efaktura:zaplatene'),
  testRezim, cena: CENA_30DNI, track, testVeta: T.testVodoznakXml, kupit: () => klikNaKupu(btnTrid, '30dni', CENA_30DNI, 'davka') });
poNavrate();
sledujCenuVidenu();
