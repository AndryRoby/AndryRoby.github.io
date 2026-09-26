// texty.mjs: slovenské texty kvízu „Týka sa ma e-faktúra?“.
// Každá veta o povinnosti má zdroj v logika.mjs (SEGMENTY, POZNAMKY, ZDROJE).
// Bez pomlčiek, bez odpočtov a bez naliehania; dátum 1. 1. 2027 je skutočný (FAQ príklad 17).

const NASTROJ = '/efaktura/';

export default {
  jazyk: 'sk',
  ui: {
    postup: (n, max) => `Otázka ${n} zo ${max}`,
    spat: 'Späť',
    klavesy: 'Klávesnica: číslo vyberie odpoveď, Backspace vráti o krok.',
    nacitava: 'Kvíz sa načítava.',
    vysledok: 'Výsledok',
    istota: {
      iste: 'Podľa FAQ Finančnej správy to platí priamo.',
      overit: 'Tento prípad odporúčame overiť u daňového poradcu alebo účtovníka.',
    },
    coRobit: 'Čo odporúčame',
    zdrojeNadpis: 'Zdroje k výsledku',
    zdrojeUvod: 'FAQ znamená: Finančné riaditeľstvo SR, Najčastejšie otázky a odpovede k eFaktúre, 9/DPH/2025/IM, verzia z 15. 9. 2026. Citáty sú doslovné, strany patria k PDF tejto verzie, overené 26. 9. 2026.',
    odpovedeNadpis: 'Vaše odpovede',
    zmenit: 'Zmeniť odpovede',
    znova: 'Začať znova',
    otvorit: 'otvoriť',
    preklad: '',
    uvodzovky: ['„', '“'],
  },

  otazky: {
    q1: {
      nadpis: 'Ste platiteľom DPH na Slovensku?',
      pomoc: 'Od toho závisí, či e-faktúry musíte vystavovať, alebo len prijímať.',
      moznosti: {
        platitel: { text: 'Áno, som platiteľ DPH', pomoc: 'Registrácia podľa § 4 zákona o DPH, na faktúrach zvyčajne účtujete DPH.' },
        par7: { text: 'Mám IČ DPH len podľa § 7 alebo § 7a', pomoc: 'Napríklad kvôli službám zo zahraničia, bez toho, aby som bol platiteľ.' },
        neplatitel: { text: 'Nie, nie som platiteľ DPH' },
        par5: { text: 'Sme zahraničná firma registrovaná na Slovensku podľa § 5' },
        neviem: { text: 'Neviem' },
      },
      // Varianta B sa zobrazí len pri zapnutom experimente (logika.mjs EXPERIMENT, teraz vypnutý).
      varianty: {
        B: { nadpis: 'Ako ste na Slovensku registrovaný pre DPH?' },
      },
    },
    q2: {
      nadpis: 'Komu vystavujete faktúry?',
      pomoc: 'Úrady, obce, spolky a nadácie sa počítajú ako organizácie.',
      moznosti: {
        firmy: { text: 'Firmám, živnostníkom, úradom alebo organizáciám' },
        obom: { text: 'Firmám aj súkromným osobám' },
        ludia: { text: 'Len súkromným osobám (spotrebiteľom)' },
      },
    },
    q3: {
      nadpis: 'Kde majú sídlo vaši odberatelia?',
      pomoc: 'Myslíme firmy, živnostníkov a organizácie, ktorým fakturujete.',
      moznosti: {
        sk: { text: 'Len na Slovensku' },
        sk_de: { text: 'Na Slovensku aj v Nemecku' },
        sk_zahr: { text: 'Na Slovensku aj inde v zahraničí' },
        zahr: { text: 'Len v zahraničí' },
      },
    },
    q4: {
      nadpis: 'Čím dnes vystavujete faktúry?',
      moznosti: {
        excel: { text: 'Excel, Word alebo na papieri' },
        appka: { text: 'Fakturačná aplikácia alebo program bez e-faktúry' },
        softver: { text: 'Účtovný program, ktorý e-faktúru už vie' },
        neviem: { text: 'Neviem, či môj program e-faktúru zvládne' },
      },
    },
    q5: {
      nadpis: 'Kto u vás bude e-faktúry posielať cez Digitálneho poštára?',
      pomoc: 'Digitálny poštár je certifikovaný poskytovateľ, ktorý e-faktúry doručuje v sieti Peppol.',
      moznosti: {
        niekto: { text: 'Účtovník alebo IT, už to rieši' },
        sam: { text: 'Ja sám alebo sama' },
        neviem: { text: 'Zatiaľ neviem' },
      },
    },
    q6: {
      nadpis: 'Koľko faktúr vystavíte približne za mesiac?',
      moznosti: {
        '1_3': { text: '1 až 3' },
        '4_20': { text: '4 až 20' },
        nad_20: { text: 'Viac ako 20' },
      },
    },
  },

  // Spoločný úvod pre všetky výsledky „týka sa“.
  tykaSaUvod: [
    'Ako platiteľ DPH budete faktúry pre firmy, živnostníkov, úrady a organizácie na Slovensku od 1. januára 2027 vystavovať ako e-faktúru: štruktúrovaný súbor XML podľa normy EN 16931, nie PDF. Základom je zákon č. 385/2025 Z. z., ktorý mení zákon o DPH.',
    'E-faktúry od svojich dodávateľov musíte od toho istého dňa vedieť aj prijímať. Rok 2026 je prechodný: e-faktúry môžete posielať dobrovoľne, ak má Digitálneho poštára aj váš odberateľ.',
  ],

  segmenty: {
    nie_platitel: {
      nadpis: 'Vystavovať e-faktúry nemusíte. Prijímať ich od 1. 1. 2027 musíte vedieť.',
      odseky: [
        'Povinnosť vystaviť e-faktúru sa od 1. 1. 2027 nevzťahuje na podnikateľa, ktorý nie je platiteľom DPH.',
        'Prijímať e-faktúry však musí od 1. 1. 2027 vedieť každá právnická osoba a každý podnikateľ, preto si budete musieť zazmluvniť Digitálneho poštára. Dobrovoľne sa zapojiť a e-faktúry aj posielať môžete, povinnosť posielať všetky faktúry vám tým nevznikne.',
        'Keď vám príde e-faktúra ako súbor XML, zadarmo si ju u nás prečítate ako bežný doklad a uložíte do PDF.',
      ],
    },
    registracia_7a: {
      nadpis: 'Váš prípad FAQ Finančnej správy výslovne nerieši.',
      odseky: [
        'Podľa znenia § 85o ods. 2 zákona o DPH, ktoré Finančná správa cituje, má povinnosť vystaviť e-faktúru tuzemský platiteľ dane registrovaný podľa § 4, 4b alebo 4c. Registrácia podľa § 7 alebo § 7a v tomto výpočte nie je a FAQ ju samostatne nerieši.',
        'Isté je jedno: prijímať e-faktúry musí od 1. 1. 2027 vedieť každý podnikateľ, teda aj vy.',
      ],
    },
    registracia_5: {
      nadpis: 'Ako firma registrovaná podľa § 5 nemusíte e-faktúry vystavovať ani prijímať cez doručovaciu službu do 30. 6. 2030.',
      odseky: [
        'Finančná správa píše, že osoba registrovaná podľa § 5 nie je povinná vystaviť elektronickú faktúru ani zabezpečiť jej prijímanie doručovacou službou v období od 1. 1. 2027 do 30. 6. 2030.',
        'Postup po 30. 6. 2030 si overte u daňového poradcu.',
      ],
    },
    neviem_status: {
      nadpis: 'Najprv zistite, či ste platiteľ DPH. Od toho závisí takmer všetko.',
      odseky: [
        'Ak ste platiteľ DPH, faktúry pre firmy, živnostníkov a úrady na Slovensku budete od 1. 1. 2027 vystavovať ako e-faktúru. Ak platiteľ nie ste, vystavovať ju nemusíte.',
        'Prijímať e-faktúry musí od 1. 1. 2027 vedieť každý podnikateľ bez ohľadu na DPH.',
        'Opýtajte sa účtovníka a potom si kvíz prejdite znova.',
      ],
    },
    len_spotrebitelia: {
      nadpis: 'Faktúry súkromným osobám ako e-faktúru vystavovať nemusíte. Prijímať e-faktúry musíte vedieť.',
      odseky: [
        'E-faktúra sa podľa Finančnej správy týka len faktúr medzi podnikmi (B2B) a medzi podnikmi a verejnou správou (B2G). Koncových spotrebiteľov sa netýka.',
        'Keď začnete fakturovať firme, živnostníkovi alebo úradu na Slovensku, tie faktúry už budú e-faktúry.',
        'E-faktúry od svojich dodávateľov musíte od 1. 1. 2027 vedieť prijímať. Keď vám príde súbor XML, zadarmo si ho u nás prečítate ako bežný doklad.',
      ],
    },
    len_zahranicie: {
      nadpis: 'Pri faktúrach len do zahraničia sa vás vystavovanie e-faktúr od 1. 1. 2027 zatiaľ netýka. Prijímanie áno.',
      odseky: [
        'Povinnosť od 1. 1. 2027 sa týka len tuzemských osôb a tuzemských obchodov, slovenský systém e-faktúr je zatiaľ len pre faktúry v rámci Slovenska. Rozšírenie na cezhraničné dodania Finančná správa očakáva od 1. júla 2030.',
        'E-faktúry od slovenských dodávateľov musíte od 1. 1. 2027 vedieť prijímať.',
        'Či je miesto dodania vašich služieb alebo tovaru naozaj v zahraničí, overte u daňového poradcu. Ak vaši odberatelia chcú e-faktúru (napríklad XRechnung v Nemecku), súbor si u nás pred odoslaním skontrolujete zadarmo.',
      ],
    },
    tyka_sa_riesenie: {
      nadpis: 'Áno, e-faktúra sa vás týka od 1. januára 2027. Riešenie už pravdepodobne máte.',
      uvod: true,
      odseky: [
        'Podľa vašich odpovedí e-faktúru zvládne váš program alebo ju rieši účtovník či IT. Overte si u dodávateľa programu, či bude vedieť e-faktúru aj odoslať a prijať cez Digitálneho poštára.',
        'Od nás nič kupovať nemusíte. XML z vášho programu si pred odoslaním môžete zadarmo skontrolovať podľa pravidiel EN 16931 a Peppol BIS Billing 3.0.',
      ],
    },
    tyka_sa_malo: {
      nadpis: 'Áno, e-faktúra sa vás týka od 1. januára 2027.',
      uvod: true,
      odseky: [
        'Pri 1 až 3 faktúrach mesačne vám vyjde lacnejšie platiť po jednej: XML jednej faktúry stojí u nás 2,90 € bez DPH, tri faktúry teda 8,70 € bez DPH, kým 30 dní stojí 9,90 € bez DPH. Formulár a náhľad sú zadarmo, platíte až pri stiahnutí hotového XML.',
      ],
    },
    tyka_sa_stredne: {
      nadpis: 'Áno, e-faktúra sa vás týka od 1. januára 2027.',
      uvod: true,
      odseky: [
        'Pri 4 a viac faktúrach mesačne vám vyjde lacnejšie 30 dní bez obmedzenia počtu faktúr za 9,90 € bez DPH. Štyri faktúry po jednej by stáli 11,60 € bez DPH. Je to jednorazová platba, bez predplatného. Formulár a náhľad sú zadarmo.',
      ],
    },
    tyka_sa_vela: {
      nadpis: 'Áno, e-faktúra sa vás týka od 1. januára 2027.',
      uvod: true,
      odseky: [
        'Pri viac ako 20 faktúrach mesačne sa oplatí 30 dní za 9,90 € bez DPH, vrátane dávky z CSV do jedného ZIP. Je to jednorazová platba, bez predplatného.',
        'Finančná správa pri podnikoch s pár desiatkami faktúr píše, že drahý automatický systém netreba. Ak ich máte oveľa viac a pribúdajú, zvážte účtovný program, ktorý e-faktúru vytvorí aj odošle sám.',
      ],
    },
  },

  poznamky: {
    vynimky: {
      nadpis: 'Výnimky z povinnosti',
      text: 'E-faktúru nemusíte vystaviť pri dodaní oslobodenom od dane podľa § 28 až 43 a 47 zákona o DPH a keď vystavíte zjednodušenú faktúru (doklad z eKasy do 400 € alebo doklad do 100 €). Vystaviť ju nesmiete, ak je odberateľom Slovenská informačná služba alebo Vojenské spravodajstvo, alebo ak plnenie súvisí s utajovanou skutočnosťou. Ak sa vás niektorá výnimka týka, postup si overte u daňového poradcu.',
      rozbalit: true,
    },
    postar: {
      nadpis: 'Na odoslanie potrebujete Digitálneho poštára',
      text: 'Digitálneho poštára si vyberiete sami. Náš nástroj XML vytvorí a skontroluje, do siete Peppol ho však neposiela. Finančná správa odhaduje predplatné jednoduchej aplikácie Digitálneho poštára najviac na priemer EÚ, 5 až 12 € mesačne, a opisuje aj postup, keď XML vytvoríte inde a v aplikácii poštára ho len nahráte a pošlete. Či to váš poštár umožňuje, overte u neho.',
    },
    aj_spotrebitelia: {
      nadpis: 'Faktúry súkromným osobám',
      text: 'Faktúr súkromným osobám (spotrebiteľom) sa povinnosť netýka. Týka sa faktúr firmám, živnostníkom, úradom a organizáciám.',
    },
    zahranicie: {
      nadpis: 'Faktúry do zahraničia',
      text: 'Faktúry odberateľom v zahraničí do povinnosti od 1. 1. 2027 nepatria, týka sa len tuzemských osôb a tuzemských obchodov. Rozšírenie na cezhraničné dodania Finančná správa očakáva od 1. júla 2030.',
    },
    nemecko: {
      nadpis: 'Odberatelia v Nemecku',
      text: 'Pre Nemecko platia nemecké pravidlá a tie sme pre dodávateľa zo Slovenska neoverovali. Zo zdroja vieme toto: firmy v Nemecku musia vedieť e-faktúru prijať od 1. januára 2025 a jedným z nemeckých formátov e-faktúry je XRechnung. Ak ho váš odberateľ žiada, v našom nástroji ho vytvoríte aj skontrolujete. Či ho vystavovať musíte, overte u daňového poradcu.',
    },
    spytajte_softver: {
      nadpis: 'Neviete, či to zvládne váš program?',
      text: 'Finančná správa radí spýtať sa dodávateľa účtovného systému, či bude vedieť vystaviť e-faktúru, ktorú potom nahráte a pošlete cez aplikáciu Digitálneho poštára.',
    },
  },

  ciele: {
    kontrola: { href: NASTROJ + '?z=kviz#kontrola', text: 'Skontrolovať XML zadarmo', popis: 'Bez registrácie, súbor ostáva vo vašom prehliadači.' },
    nahlad: { href: NASTROJ + '?z=kviz#nahlad', text: 'Prečítať e-faktúru zadarmo', popis: 'Súbor XML od dodávateľa uvidíte ako bežný doklad a uložíte do PDF.' },
    vytvorit_jedna: { href: NASTROJ + '?z=kviz#vytvorit', text: 'Vytvoriť faktúru vo formulári', popis: 'Formulár a náhľad zadarmo. XML jednej faktúry 2,90 € bez DPH.' },
    vytvorit_30: { href: NASTROJ + '?z=kviz#vytvorit', text: 'Vytvoriť faktúry vo formulári', popis: 'Formulár a náhľad zadarmo. 30 dní bez obmedzenia za 9,90 € bez DPH.' },
    vytvorit_xrechnung: { href: NASTROJ + '?z=kviz#vytvorit', text: 'Vytvoriť XRechnung pre Nemecko', popis: 'Ten istý formulár, profil XRechnung 3.x vrátane Leitweg-ID.' },
    info: { href: '/efaktura/e-faktura-2027/', text: 'Čo sa mení od 1. 1. 2027', popis: 'Prehľad povinnosti na jednej stránke.' },
    znova: { text: 'Prejsť kvíz znova' },
  },

  dokumenty: {
    faq: 'FAQ 9/DPH/2025/IM',
    zakon385: 'Zákon č. 385/2025 Z. z., ktorým sa mení zákon č. 222/2004 Z. z. o DPH (slov-lex.sk)',
    zakon222: 'Zákon č. 222/2004 Z. z. o DPH, § 85o v znení účinnom od 1. 1. 2027 (slov-lex.sk)',
    bmf: 'Bundesministerium der Finanzen, FAQ k povinnej e-faktúre od 1. 1. 2025 (overené 11. 9. 2026)',
    kosit: 'KoSIT, XRechnung, nemecký štandard e-faktúry (xeinkauf.de, overené 11. 9. 2026)',
    arling: 'ARLing, E-faktúra (arling.sk/efaktura/)',
  },
  miesto: (z) => (z.priklad == null ? `časť ${z.cast}, úvod, s. ${z.strana}` : `časť ${z.cast}, príklad ${z.priklad}, s. ${z.strana}`),

  // Texty k zdrojom bez citátu vo FAQ. citat pri arling_* je doslovne z products/arling-sk/efaktura/index.html (test).
  zdroje: {
    bmf_prijem: { popis: 'Firmy v Nemecku musia vedieť e-faktúru prijať od 1. 1. 2025.' },
    kosit_xrechnung: { popis: 'XRechnung je nemecká špecifikácia e-faktúry nad normou EN 16931.' },
    zakon_385: { popis: 'Novela zákona o DPH, účinnosť 1. 1. 2027.' },
    zakon_85o: { popis: 'Prechodné ustanovenie o povinnej elektronickej faktúre.' },
    arling_kontrola: { citat: 'Vložte XML a hneď uvidíte, ktoré pravidlo EN 16931, Peppol alebo XRechnung súbor porušuje a kde. Zadarmo, bez registrácie, súbor neopustí váš prehliadač.' },
    arling_cena_jedna: { citat: 'Formulár aj náhľad sú zadarmo. Za stiahnutie hotového XML sa platí: 2,90 € bez DPH za jednu faktúru' },
    arling_cena_30: { citat: 'alebo 9,90 € bez DPH na 30 dní bez obmedzenia počtu faktúr' },
    arling_cennik: { citat: 'Ľubovoľný počet faktúr vrátane dávky z CSV do jedného ZIP. Jednorazová platba, bez predplatného.' },
    arling_bez_peppol: { citat: 'Samotné doručenie do siete Peppol súčasťou nástroja nie je.' },
    arling_nahlad: { citat: 'Hodí sa, keď vám príde súbor od dodávateľa a potrebujete ho prečítať bez účtovného programu.' },
    arling_xrechnung: { citat: 'Nemecký profil XRechnung 3.x tu skontrolujete aj vytvoríte, vrátane poľa pre Leitweg-ID.' },
  },
  // Názvy odpovedí v súhrne „Vaše odpovede“ berie UI z otazky.*.moznosti.
};
