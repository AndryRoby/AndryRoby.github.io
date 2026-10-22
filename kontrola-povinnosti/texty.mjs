/*
 * Texty kontroly na stránkach povinností EÚ (relácia 213, ops/druhy-ucet/213/PLAN.md časť 2 a 3).
 * Výsledok pravidla v sk, en a de hovorí slovo od slova ako celá kontrola: berie sa z EU_UI v /feed-doctor/agent-ready/i18n.mjs
 * (ten istý súbor a tá istá adresa ?v=2 ako app.mjs, prehliadač ho má v pamäti len raz). Čeština v EU_UI nie je, preto je tu
 * vlastná (CS_EU). Ďalej sú tu texty, ktoré celá kontrola nemá: chyby s ďalším krokom, počet prečítaných stránok, osobitné prípady
 * podľa PLAN.md časť 3 a krátke texty šablóny stránky (nadpisy FAQ a zdrojov), ktoré používa aj generátor ops/seo/povinnosti-eu/.
 * Texty sa na stránke vkladajú len cez textContent (kontrola.mjs).
 */
import {UI,EU_UI} from '../feed-doctor/agent-ready/i18n.mjs?v=2';

export const JAZYKY=['sk','cs','de','en'];
export const PRAVIDLA=['eu_withdrawal','eu_guarantee_notice'];
/** Celá bezplatná kontrola: čeština ide na slovenskú verziu (českej niet, rovnako to robí obal hubu). */
export const PLNA_KONTROLA={sk:'/feed-doctor/agent-ready/sk/',cs:'/feed-doctor/agent-ready/sk/',de:'/feed-doctor/agent-ready/de/',en:'/feed-doctor/agent-ready/'};
/** Stránky pravidiel (PLAN.md časť 3); generátor overuje, že jeho tabuľka STRANKY sedí s touto mapou. */
export const STRANKY_PRAVIDIEL={
  eu_withdrawal:{sk:'/kontrola-tlacidla-na-odstupenie-od-zmluvy/',cs:'/kontrola-tlacidla-na-odstupenie-od-zmluvy/cs/'},
  eu_guarantee_notice:{sk:'/kontrola-oznamenia-o-zakonnej-zaruke/',cs:'/kontrola-oznamenia-o-zakonnej-zaruke/cs/',de:'/kontrola-oznamenia-o-zakonnej-zaruke/de/',en:'/kontrola-oznamenia-o-zakonnej-zaruke/en/'},
};

const EURLEX_CS=(celex)=>'https://eur-lex.europa.eu/legal-content/CS/TXT/HTML/?uri=CELEX:'+celex;

/** Čeština v tvare EU_UI (rovnaké kľúče, aby kontrola.mjs čítala všetky jazyky jedným kódom). */
const CS_EU={
  status:{found:'Našli jsme',not_found:'Nenašli jsme',not_applicable:'Nejspíš není třeba',unknown:'Nepodařilo se přečíst',link_found:'Odkaz jsme našli'},
  pages:{home:'úvodní stránce',product:'stránce produktu',returns:'stránce o vrácení zboží',shipping:'stránce o dopravě',contact:'stránce s kontakty'},
  manual:'Ověřte ručně',law:'Předpis',
  rules:{
    eu_withdrawal:{
      title:'Tlačítko pro odstoupení od smlouvy',
      applies:'V Česku platí od 1. ledna 2027 (§ 1830a občanského zákoníku).',
      status:{found:'Nápis jsme našli',not_found:'Nápis jsme nenašli',unknown:'Nepodařilo se přečíst',check:'Ověřte odkaz',link_found:'Odkaz nalezen, funkčnost neověřena'},
      found:'Na {page} jsme našli odkaz nebo tlačítko s nápisem „{label}“.',
      foundNote:'Nezkoušeli jsme, zda otevře funkční formulář.',
      notFound:'Odkaz ani tlačítko se samotným nápisem „Odstoupit od smlouvy“ ani se zněním směrnice „zde odstoupit od smlouvy“ jsme na přečtených stránkách nenašli. Znění hledáme v devíti jazycích EU včetně češtiny a slovenštiny.',
      similar:'Našli jsme odkaz o odstoupení s jiným zněním, než uvádí zákon: „{label}“ na {page}. Pokud otevírá formulář pro odstoupení od smlouvy, může jít o jinou odpovídající jednoznačnou formulaci; ověřte ho.',
      unknown:'Nepodařilo se přečíst žádnou stránku obchodu.',
      manualFound:'Klikněte na něj jednou jako zákazník, zadejte zkušební číslo objednávky a ověřte, že vám e-mailem přijde potvrzení s obsahem, datem a časem.',
      manualNotFound:'Otevřete obchod jako zákazník a podívejte se do patičky, do potvrzení objednávky a do zákaznického účtu. Funkce se může načíst až JavaScriptem nebo být vidět jen po přihlášení, a to tato kontrola nevidí.',
      linkFound:'Na {page} jsme našli odkaz s nápisem „{label}“. Vede na stránku objednávky platformy Shoptet, kde se načítá formulář pro odstoupení od smlouvy.',
      linkFoundNote:'Formulář se načítá JavaScriptem a ukáže se až po zadání čísla objednávky, proto jsme jeho funkčnost neověřili.',
      manualLinkFound:'Klikněte na odkaz jako zákazník, zadejte číslo a e-mail zkušební objednávky, odstupte od smlouvy a ověřte, že vám e-mailem přijde potvrzení s datem a časem.',
      orderPage:'Na {page} jsme našli odkaz s nápisem „{label}“. Vede na stránku objednávky platformy Shoptet, kde se načítá formulář pro odstoupení od smlouvy. Nápis o odstoupení nemluví, a tak ho zákazník, který chce odstoupit, nemusí najít.',
      manualOrderPage:'V administraci Shoptetu přidejte do menu nebo patičky odkaz na stránku Moje objednávka s nápisem, který mluví o odstoupení, například „Odstoupit od smlouvy“. Pak ho vyzkoušejte jako zákazník se zkušební objednávkou.',
      law:[['§ 1830a občanského zákoníku ve znění zákona č. 159/2026 Sb., účinný od 1. 1. 2027','https://www.zakonyprolidi.cz/cs/2026-159'],['čl. 11a směrnice 2011/83/EU ve znění směrnice (EU) 2023/2673',EURLEX_CS('32023L2673')]],
    },
    eu_guarantee_notice:{
      title:'Oznámení o zákonné záruce',
      applies:'V EU se uplatňuje od 27. září 2026. České provedení schválila Poslanecká sněmovna 14. října 2026, ke 22. říjnu 2026 ještě nebylo vyhlášeno.',
      status:{found:'Oznámení jsme našli',not_found:'Oznámení jsme nenašli',not_applicable:'Nejspíš není třeba',unknown:'Nepodařilo se přečíst'},
      found:'Text oznámení jsme našli na {page}.',
      foundAlt:'Text oznámení jsme našli v popisu obrázku na {page}.',
      foundNote:'Vzhled, barvy ani umístění jsme nekontrolovali.',
      notFound:'Text oznámení jsme na přečtených stránkách nenašli.',
      links:'Na {page} jsme našli odkaz na stránku EU o zárukách Your Europe, kam vede QR kód oznámení.',
      notApplicable:'Produkty v našem vzorku se neposílají (digitální produkty nebo služby). Oznámení se týká zboží; pokud prodáváte i zboží, platí pro ně.',
      unknown:'Nepodařilo se přečíst žádnou stránku obchodu.',
      manual:'Oznámení bývá obrázek. Jeho text přečteme, jen když je vypsaný na stránce nebo v popisu obrázku (alt). Projděte stránky produktů, košík a pokladnu a použijte oficiální soubor pro svůj jazyk bez úprav.',
      law:[['čl. 6 odst. 1 písm. l) a čl. 22a směrnice 2011/83/EU ve znění směrnice (EU) 2024/825',EURLEX_CS('32024L0825')],['příloha I prováděcího nařízení (EU) 2025/1960 (vzhled a text)','https://eur-lex.europa.eu/eli/reg_impl/2025/1960/oj']],
    },
  },
};

// Predpisy navyše k EU_UI: nemecká stránka menuje nemecký zákon (PLAN.md časť 3: § 356a BGB a Art. 246a § 1 Abs. 1 Nr. 11 EGBGB).
const DE_ZAKON={
  eu_withdrawal:['§ 356a BGB (elektronische Widerrufsfunktion)','https://www.gesetze-im-internet.de/bgb/__356a.html'],
  eu_guarantee_notice:['Art. 246a § 1 Abs. 1 Satz 1 Nr. 11 EGBGB','https://www.gesetze-im-internet.de/bgbeg/art_246a__1.html'],
};

// Vety EU_UI, ktoré stránka povinnosti mení (kontroly kola 1); i18n.mjs relácie 208 sa nemení.
// sk notFound: „…takto označený odkaz ani tlačidlo nie je“ tvrdí neprítomnosť a protirečí riadku o podobnom odkaze (brána).
// en applies: anglická stránka je pre celú EÚ, „Applies since 27 September 2026.“ bez výhrady je pre Česko nepravda (právo).
// en unknown: stránka píše všade „shop“, EU_UI „store“ (jazyk kolo 2).
const PREPISY_EU={
  sk:{eu_withdrawal:{notFound:'Odkaz ani tlačidlo s nápisom „odstúpiť od zmluvy tu“ sme na prečítaných stránkach nenašli. Znenie smernice hľadáme v slovenčine, češtine, angličtine, nemčine, poľštine, francúzštine, taliančine, španielčine a holandčine.'}},
  // en links: miesto nálezu stálo za vedľajšou vetou na konci (brána kolo 3).
  en:{eu_guarantee_notice:{applies:'Applies in Slovakia and Germany since 27 September 2026; in Czechia the law was not yet in force on 22 October 2026.',unknown:'We could not read any page of the shop.',links:'On {page} we found a link to the EU guarantee page on Your Europe, where the notice’s QR code leads.'}},
};

/** Texty, ktoré celá kontrola nemá (chyby s ďalším krokom, osobitné prípady, šablóna stránky). */
const VLASTNE={
  sk:{
    busy:null,cancelled:null,
    chyby:{
      adresa:'Toto nie je verejná adresa obchodu cez HTTPS. Napíšte ju v tvare https://vas-obchod.sk, bez časti za znakom ? alebo #.',
      adresaServer:'Server túto adresu neprijal. Kontrolujeme len verejné obchody na doméne s HTTPS, bez IP adresy a bez portu. Opravte adresu a skúste to znova.',
      rate:'Z vašej siete už v tejto hodine prebehlo 6 kontrol, viac server nepovolí. Skúste to znova po najbližšej celej hodine; adresa ostala vyplnená.',
      nedostupna:'Kontrola je teraz na strane servera nedostupná. Skúste to o pár minút; adresa ostala vyplnená.',
      siet:'Spojenie so serverom kontroly zlyhalo. Overte pripojenie na internet a skúste to znova.',
      limit:'Kontrola nestihla skončiť do 65 sekúnd. Obchod možno odpovedá pomaly; skúste to o chvíľu znova.',
      tvar:'Kontrolu sa nepodarilo vyhodnotiť: server vrátil odpoveď v neočakávanom formáte. Skúste to neskôr alebo otvorte celú bezplatnú kontrolu.',
      server:'Kontrola sa na serveri nedokončila. Skúste to znova; adresa ostala vyplnená.',
    },
    obchod:'Obchod:',
    precitane:(n)=>n===0?'Neprečítali sme žiadnu stránku obchodu.':n===1?'Prečítali sme 1 stránku obchodu.':n<5?`Prečítali sme ${n} stránky obchodu.`:`Prečítali sme ${n} stránok obchodu.`,
    // Slovenský zákon: „odstúpiť od zmluvy tu“ alebo obdobná formulácia (§ 20a ods. 2 zákona č. 108/2024 Z. z., zber/pravo-sk-cz.md r. 75).
    obdobna:'Na {page} sme našli odkaz s textom „{label}“. Podobá sa zákonnému zneniu „odstúpiť od zmluvy tu“ a § 20a ods. 2 pripúšťa aj označenie obdobnou formuláciou, ktorá jednoznačne vyjadruje, že jej použitím môže spotrebiteľ odstúpiť od zmluvy. Overte, že otvorí formulár na odstúpenie od zmluvy.',
    // Kolo 3 (právo): nápis „Moja objednávka“ nie je označenie podľa § 20a ods. 2; poznámka to hovorí výslovne a radí odkaz s nápisom o odstúpení.
    shoptet:'Ak obchod beží na Shoptete, funkcia môže byť na systémovej stránke /moja-objednavka/ (v českom Shoptete /moje-objednavka/), preto výsledok „Označenie sme nenašli“ ešte neznamená, že funkcia chýba. Nápis „Moja objednávka“ však o odstúpení nehovorí a zákon žiada označenie „odstúpiť od zmluvy tu“ alebo obdobnú jednoznačnú formuláciu. Pridajte do menu alebo pätičky externý odkaz s takým nápisom, napríklad „Odstúpiť od zmluvy tu“, ktorý vedie na /moja-objednavka/, a vyskúšajte ho ako zákazník.',
    yourEurope:'Odkaz na Your Europe bez vety oznámenia môže byť odkaz, ktorý oznámenie rozbalí (tak to ukazuje príručka Komisie), alebo odkaz, kam vedie QR kód. Overte ručne, či je na stránke celé oznámenie.',
    overteRucne:null,
    vedlajsiOdkaz:'Viac o tomto pravidle',
    plnaRiadok:'Ostatné výsledky (environmentálne tvrdenia a údaje pre AI nákupných asistentov) ukáže celá kontrola.',
    plna:'Otvoriť celú bezplatnú kontrolu obchodu',
    noscript:'Kontrola na tejto stránke potrebuje JavaScript. Bez neho použite celú bezplatnú kontrolu:',
    faqNadpis:'Časté otázky',zdrojeNadpis:'Zdroje',zdrojLabel:'Zdroj:',
    zdrojePozn:'Pri každom zdroji je dátum, keď sme ho čítali.',
    strazJazyk:null,
  },
  cs:{
    busy:'Čtu veřejné stránky obchodu. Kontrolu můžete zrušit.',
    cancelled:'Kontrola zrušena. Adresa zůstala vyplněná.',
    chyby:{
      adresa:'Toto není veřejná adresa e-shopu s HTTPS. Napište ji ve tvaru https://vas-eshop.cz, bez části za znakem ? nebo #.',
      adresaServer:'Server tuto adresu nepřijal. Kontrolujeme jen veřejné obchody na doméně s HTTPS, bez IP adresy a bez portu. Opravte adresu a zkuste to znovu.',
      rate:'Z vaší sítě už v této hodině proběhlo 6 kontrol, víc server nedovolí. Zkuste to znovu po nejbližší celé hodině; adresa zůstala vyplněná.',
      nedostupna:'Kontrola je teď na straně serveru nedostupná. Zkuste to za pár minut; adresa zůstala vyplněná.',
      siet:'Spojení se serverem kontroly selhalo. Ověřte připojení k internetu a zkuste to znovu.',
      limit:'Kontrola nestihla skončit do 65 sekund. Obchod možná odpovídá pomalu; zkuste to za chvíli znovu.',
      tvar:'Kontrolu se nepodařilo vyhodnotit: server vrátil odpověď v neočekávaném formátu. Zkuste to později nebo otevřete celou bezplatnou kontrolu.',
      server:'Kontrola se na serveru nedokončila. Zkuste to znovu; adresa zůstala vyplněná.',
    },
    obchod:'Obchod:',
    precitane:(n)=>n===0?'Nepřečetli jsme žádnou stránku obchodu.':n===1?'Přečetli jsme 1 stránku obchodu.':n<5?`Přečetli jsme ${n} stránky obchodu.`:`Přečetli jsme ${n} stránek obchodu.`,
    // Český zákon: nápis „Odstoupit od smlouvy“ (§ 1830a odst. 2 OZ); API ho hlási ako podobný, lebo hľadá znenie smernice „zde odstoupit od smlouvy“.
    zakon:'Na {page} jsme našli nápis „{label}“, který odpovídá § 1830a odst. 2 občanského zákoníku. Ověřte, zda otevře formulář pro odstoupení od smlouvy.',
    zakonStatus:'Nápis podle zákona nalezen',
    // Kolo 3 (právo): nápis „Moje objednávka“ nesplňuje § 1830a odst. 2; poznámka to říká výslovně a radí odkaz s nápisem o odstoupení.
    shoptet:'Běží-li obchod na Shoptetu, může být funkce na systémové stránce /moje-objednavka/ (na slovenském Shoptetu /moja-objednavka/), proto výsledek „Nápis jsme nenašli“ ještě neznamená, že funkce chybí. Nápis „Moje objednávka“ ale o odstoupení nemluví a zákon žádá nápis „Odstoupit od smlouvy“ nebo jinou odpovídající jednoznačnou formulaci. Přidejte do menu nebo patičky odkaz s takovým nápisem, který vede na /moje-objednavka/, a vyzkoušejte ho jako zákazník.',
    yourEurope:'Odkaz na Your Europe bez věty oznámení může být odkaz, který oznámení rozbalí (tak to ukazuje příručka Komise), nebo odkaz, kam vede QR kód. Ověřte ručně, zda je na stránce celé oznámení.',
    overteRucne:null,
    vedlajsiOdkaz:'Více o tomto pravidle',
    plnaRiadok:'Ostatní výsledky (environmentální tvrzení a údaje pro AI nákupní asistenty) ukáže celá kontrola (stránka je ve slovenštině).',
    plna:'Otevřít celou bezplatnou kontrolu obchodu',
    noscript:'Kontrola na této stránce potřebuje JavaScript. Bez něj použijte celou bezplatnou kontrolu (stránka je ve slovenštině):',
    faqNadpis:'Časté dotazy',zdrojeNadpis:'Zdroje',zdrojLabel:'Zdroj:',
    // Zákon č. 89/2012 Sb. je na stránke odstúpenia len odkaz na dohľadanie výnimiek, bez dátumu čítania (brána kolo 2).
    zdrojePozn:'U zdrojů, ze kterých citujeme, je datum, kdy jsme je četli.',
    // STAV-209.md: stránky Stráže SK EN DE, e-maily SK EN DE; box vo výsledku je na českej stránke slovensky.
    strazJazyk:'Stráž e-shopu zatím česky neumí: nabídka níže je ve slovenštině a stránka, nastavení i e-maily jsou ve slovenštině, angličtině nebo němčině.',
  },
  de:{
    busy:null,cancelled:null,
    chyby:{
      adresa:'Das ist keine öffentliche HTTPS-Adresse eines Shops. Geben Sie sie als https://ihr-shop.de ein, ohne den Teil nach ? oder #.',
      adresaServer:'Der Server hat diese Adresse nicht angenommen. Wir prüfen nur öffentliche Shops auf einer Domain mit HTTPS, ohne IP-Adresse und ohne Port. Korrigieren Sie die Adresse und versuchen Sie es erneut.',
      rate:'Aus Ihrem Netzwerk wurden in dieser Stunde bereits 6 Prüfungen gestartet; mehr lässt der Server nicht zu. Versuchen Sie es nach der nächsten vollen Stunde erneut; die Adresse bleibt eingetragen.',
      nedostupna:'Die Prüfung ist auf dem Server gerade nicht verfügbar. Versuchen Sie es in ein paar Minuten erneut; die Adresse bleibt eingetragen.',
      siet:'Die Verbindung zum Prüfserver ist fehlgeschlagen. Prüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.',
      limit:'Die Prüfung wurde nicht innerhalb von 65 Sekunden abgeschlossen. Der Shop antwortet vielleicht langsam; versuchen Sie es gleich noch einmal.',
      tvar:'Die Prüfung ließ sich nicht auswerten: Der Server hat eine Antwort in einem unerwarteten Format geliefert. Versuchen Sie es später erneut oder öffnen Sie die vollständige kostenlose Prüfung.',
      server:'Die Prüfung wurde auf dem Server nicht abgeschlossen. Versuchen Sie es erneut; die Adresse bleibt eingetragen.',
    },
    obchod:'Shop:',
    precitane:(n)=>n===0?'Wir konnten keine Seite des Shops lesen.':n===1?'Wir haben 1 Seite des Shops gelesen.':`Wir haben ${n} Seiten des Shops gelesen.`,
    yourEurope:'Ein Link zu Your Europe ohne den Text des Hinweises kann eine aufklappbare Darstellung nach den Leitlinien der Kommission oder der Link aus dem QR-Code sein. Prüfen Sie selbst, ob der vollständige Hinweis auf der Seite steht.',
    overteRucne:null,
    vedlajsiOdkaz:'In der vollständigen Prüfung ansehen',
    plnaRiadok:'Die übrigen Ergebnisse (Umweltaussagen und Daten für KI-Einkaufsassistenten) zeigt die vollständige Prüfung.',
    plna:'Vollständige kostenlose Shop-Prüfung öffnen',
    noscript:'Die Prüfung auf dieser Seite braucht JavaScript. Ohne JavaScript können Sie die vollständige kostenlose Prüfung nutzen:',
    faqNadpis:'Häufige Fragen',zdrojeNadpis:'Quellen',zdrojLabel:'Quelle:',
    zdrojePozn:'Bei jeder Quelle steht, wann wir sie gelesen haben.',
    strazJazyk:null,
  },
  en:{
    busy:null,cancelled:null,
    chyby:{
      adresa:'This is not a public HTTPS shop address. Enter it as https://your-shop.com, without the part after ? or #.',
      adresaServer:'The server did not accept this address. We check only public shops on a domain with HTTPS, without an IP address or port. Correct the address and try again.',
      rate:'Your network has already run 6 checks this hour, and the server allows no more. Try again after the next full hour; your address is still here.',
      nedostupna:'The check is not available on the server right now. Try again in a few minutes; your address is still here.',
      siet:'The connection to the check server failed. Check your internet connection and try again.',
      limit:'The check did not finish within 65 seconds. The shop may be responding slowly; try again in a moment.',
      tvar:'We could not evaluate the check: the server sent an answer in an unexpected format. Try again later or open the full free check.',
      server:'The check did not finish on the server. Try again; your address is still here.',
    },
    obchod:'Shop:',
    precitane:(n)=>n===0?'We could not read any page of the shop.':n===1?'We read 1 page of the shop.':`We read ${n} pages of the shop.`,
    yourEurope:'A link to Your Europe without the text of the notice may be an expandable notice as shown in the Commission guidelines, or the link from the QR code. Check by hand that the full notice is on the page.',
    overteRucne:null,
    vedlajsiOdkaz:'See it in the full check',
    plnaRiadok:'The other results (environmental claims and data for AI shopping assistants) are in the full check.',
    plna:'Open the full free shop check',
    noscript:'The check on this page needs JavaScript. Without it, use the full free check:',
    faqNadpis:'Frequently asked questions',zdrojeNadpis:'Sources',zdrojLabel:'Source:',
    zdrojePozn:'Each source shows the date we read it.',
    strazJazyk:null,
  },
};

const kopia=(law)=>Array.isArray(law)?law.map(([t,h])=>[t,h]):[];
/** Výsledkové texty EÚ v jazyku stránky (sk, en, de z EU_UI; cs vlastné). Vždy nový objekt, EU_UI sa nemení. */
export function euTexty(lang){
  if(lang==='cs')return CS_EU;
  const z=EU_UI[lang]||EU_UI.en,rules={};
  for(const kod of PRAVIDLA){const x=z.rules[kod];rules[kod]={...x,...(PREPISY_EU[lang]?.[kod]||{}),status:{...x.status},law:lang==='de'?[DE_ZAKON[kod],...kopia(x.law)]:kopia(x.law)};}
  return {status:z.status,pages:z.pages,manual:z.manual,law:z.law,rules};
}
/** Všetky texty jazyka: eu (výsledok), ostatné z VLASTNE, busy a cancelled z UI celej kontroly (sk, en, de). */
export function texty(lang){
  const L=JAZYKY.includes(lang)?lang:'en',v=VLASTNE[L],ui=UI[L]||UI.en,eu=euTexty(L);
  return {...v,lang:L,eu,busy:v.busy||ui.busy,cancelled:v.cancelled||ui.cancelled,overteRucne:v.overteRucne||eu.manual,plnaHref:PLNA_KONTROLA[L]};
}
/** Krátke texty šablóny stránky pre generátor (bez funkcií). */
export function sablonaTexty(lang){const t=texty(lang);return {faqNadpis:t.faqNadpis,zdrojeNadpis:t.zdrojeNadpis,zdrojLabel:t.zdrojLabel,zdrojePozn:t.zdrojePozn,plna:t.plna,noscript:t.noscript,plnaHref:t.plnaHref};}
