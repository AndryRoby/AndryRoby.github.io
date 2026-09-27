# ARLing Puzzle Village

Stránka `arling.sk/games/village/`. Izometrický ostrov ako risografický plagát: 14 miest, každé patrí jednej dennej hre a jej zvieratkám, plus námestie s tabuľou (odkaz na `/games/`). Všetko je nakreslené kódom na canvase, bez obrázkov, bez knižníc, bez CDN. Anglicky.

## Súbory

| súbor | čo robí | veľkosť (raw / gzip -9, kB = 1000 B, zmerané 27. 9. 2026 po kole 3) |
|---|---|---|
| `index.html` | obal hubu (hlavička, päta, CSP, Umami, JSON-LD `CollectionPage` + `ItemList`), riadok svetiel nad plagátom (miesto drží HTML), plátno, nástroje, karta domčeka, zoznam 14 domov ako odkazy | 29,7 / 7,2 kB |
| `village.css` | plagát v tmavej stránke, nástroje, karta, riadok svetiel, menovky s okienkom, zoznam, mobil | 13,1 / 4,0 kB |
| `village.js` | motor: dlaždice, sprity, kamera, vstup, karta, zvuk, šetrenie procesora; svetlá dňa (riadok počíta hneď, okno až keď je dom vidieť), riadok svetiel, karta dedinky | 84,7 / 28,2 kB |
| `moja.js` | „Tvoja dedinka“: čisté funkcie (ktoré domy dnes svietia, dátum v Bratislave, presný čas do polnoci, najbližší tmavý dom, nové svetlá, texty, koľko dedinky je vidieť, tabuľka časov, rozloženie a kreslenie karty 1080 x 1350) | 19,2 / 7,5 kB |
| `miesta.js` | 14 miest + námestie: statická scéna a sprity, voda, vodopád, svetlušky | 80,0 / 22,9 kB |
| `svet.js` | ostrov, rieka, jazerá, cesty, stromy, lampy, rámik plagátu, podvečer, svetlá domov (`lightsOf`) | 26,7 / 9,3 kB |
| `iso.js` | izometria, domčeky, stromy, 15 zvieratiek (vrátane líšky) | 30,7 / 7,1 kB |
| `riso.js` | atramenty: zrnité dlaždice 128 px, rastrový bod, posun registrácie, pero `Pen` | 24,9 / 8,7 kB |
| `/motion/src/core.js` | pružiny (spoločné jadro webu: `PRESETS`, `springStep`, `cssEasing`) | 14,6 / 5,3 kB |
| `/motion/components/number/number.js` a `.css` | počítadlo v riadku svetiel (spoločný komponent, číslice na pružine snappy) | 8,0 + 1,4 kB |
| `og.png` | náhľad na zdieľanie 1200 x 630, snímka tohto plátna (256 farieb); po nasadení pregenerovať (lampáše a okrúhle okná sú cez deň tmavé, riadok svetiel) | 294 kB |

JavaScript dedinky spolu 266,2 kB raw, 83,6 kB gzip (gzip -9, 27. 9. 2026 po kole 3), 6 modulov, k tomu jadro pohybu a počítadlo (všetko cez `modulepreload`, `?v=7`). Staršie čísla v tejto tabuľke (napr. `svet.js` 25 / 8,7) boli v KiB alebo pred poslednou zmenou; teraz je všetko v kB po 1000 B.

## Ako to funguje

* **Tlač v atramentoch.** Každá farba je „bubon“ risografu: zrnitá dlaždica, tlačená cez `multiply`, s posunom registrácie. Kde má byť čistá farba (voda, cesty, koruny stromov, strechy), najprv sa tlačí papier (knockout), inak by modrá cez zelenú dala blato.
* **Statická vrstva raz.** Papier, ostrov, voda, domy a stromy sa kreslia do dlaždíc 512 px pre danú úroveň priblíženia (úrovne po √2) a ukladajú sa (LRU, rozpočet v bajtoch: počítač 72 MiB, mobil alebo dotyk 48 MiB, slabé zariadenie 40 MiB; na obrazovke sa nikdy nevyhadzuje). Posun kamery len skladá hotové dlaždice.
* **Odolnosť voči GPU (26. 9. 2026).** Na Galaxy Z Fold 7 sa po otvorení ukázal šum a posunuté dlaždice: GPU stratilo obsah plátien a čiastočné prekresľovanie ho už nikdy neopravilo. Teraz: `contextlost` alebo `contextrestored` na hlavnom plátne, na doskách dlaždíc, na 128 px atramentoch aj na pomocných doskách zahodí všetky dlaždice, dosky a atramenty a vytlačí ich znova, hlavné plátno celé. Po návrate stránky (skrytá viac než 1 s, `pageshow` z bfcache, `resume`) a po zmene obrazovky (zloženie Foldu) sa dlaždice potichu pretlačia, staré ostanú vidieť, kým ich nové nenahradia. Po každom návrate, `focus`, zmene veľkosti či DPR a raz po upokojení pohľadu sa plátno poskladá celé z dlaždíc (len kópia). Doska z bazéna sa znova použije až keď na ňu neukazuje živý záznam ani prebiehajúci `createImageBitmap`; ImageBitmap sa pri vyradení vždy zatvorí; vyradená doska sa hneď zmenší na 0 x 0. ImageBitmap len vo Firefoxe (v Chrome prínos nemal). DPR sa nemení (Fold ostáva na 2), obraz je pixel po pixeli rovnaký ako pred opravou.
* **Pohyb len v malých spritoch.** Každý sprite vráti svoj stav ako pár čísel; prekreslí sa len vtedy, keď sa stav zmení aspoň o pol pixela. Prekresľuje sa iba jeho obdĺžnik: kópia dlaždíc pod ním a sprity v ňom. Dym, kruhy na vode, „zzz“ a vodopád bežia ako flip book 12 snímok za sekundu, odlesky na vode 4 za sekundu.
* **Slučka stojí, keď nič nie je treba.** Mimo obrazovky (IntersectionObserver) a v skrytej karte (`visibilitychange`) sa zastaví úplne. Pri pohybe kamery beží na frekvencii obrazovky; zvieratká (životná slučka) na každej n-tej snímke obrazovky, aspoň 30 za sekundu a rovnomerne (75 Hz: 37,5, každých 26,7 ms; 60 Hz: 30), a **po 40 s bez vstupu dedinka zastane ako tlač** (v pokojnej chvíli, žiadny zajac vo vzduchu). Do 25. 9. to bolo 24 a po 10 s 12 snímok za sekundu cez časovač, čo na 60 a 75 Hz obrazovke pôsobilo ako sekanie. Pohyb myši nad ňou, dotyk alebo kláves ju hneď prebudí. **Rolovanie stránky ju nebudí:** IntersectionObserver ju zobudí len pri príchode na obrazovku (z nevidno na vidno), jeho kroky po 5 % len pozrú, či môže prísť čakajúce svetlo (27. 9. v kole 2 budil každý krok: plná snímka a ďalších 40 s života pri každom rolovaní; opravené po kontrole 2, test C21).
* **Priblíženie.** Počas zoomu sa len naťahujú dlaždice, ostré sa tlačia až po zastavení, najviac jedna za snímku. Pod chýbajúce sa kladie hrubá vrstva celej mapy, ktorá sa predtlačí hneď po načítaní.
* **Slabé zariadenie.** `hardwareConcurrency <= 4` alebo `deviceMemory <= 4`, alebo priemerná snímka nad 9 ms: hustota pixelov najviac 1,5, animácie 20 / 15 / 6 Hz, nové ostré dlaždice sa počas ťahania netlačia.
* **Znížený pohyb** (`prefers-reduced-motion`): jedna statická snímka, slučka sa nespustí, kamera bez dobehu.
* **Deň a podvečer** podľa miestneho času (18:00 až 5:59 podvečer), prepínač v nástrojoch (pamätá si ho `localStorage`). Podvečer sú dva ďalšie bubny (slivka, modrá), svietia lampy pri cestách, každé okno domu má tlmené teplé svetlo (35 % plného, bez kruhu) a nad vodou lietajú svetlušky. Prechod medzi dňom a podvečerom: starý obraz leží nad novým a zmizne, keď sú nové dlaždice v pohľade vytlačené (len `opacity`, pružina gentle z `core.js` ako CSS `linear()`, viditeľne asi 700 ms; prehliadač bez `linear()` má z CSS obyčajných 700 ms); pri zníženom pohybe hneď.
* **Zvuk** je vypnutý, kým ho návštevník nezapne: krátky zvonček pri otvorení domčeka, syntetizovaný cez Web Audio, každý dom inak vysoko (pentatonika). AudioContext vzniká po kliknutí; pri príchode (svetlo domu) zaznie zvonček len vtedy, keď prehliadač stránke hrať už dovolí (klik cestou sem), inak mlčí a nikdy nezaznie neskôr.

## Tvoja dedinka (27. 9. 2026, M-plán D)

Dôvod prejsť z dedinky do hier a vracať sa: **okno domu svieti, keď hráč dnes vyriešil jeho hru.** Zajtra sa začína nanovo tmou, ako deň. Žiadne odmeny s náhodou, nič sa nedá stratiť.

* **Odkiaľ to vie.** 14 hier ukladá každý deň ako `localStorage` `<hra>:<RRRR-MM-DD>` = JSON s `done` (ms vyriešenia), dnešok je dátum v Europe/Bratislava ako v `todayBratislava` každej hry. `moja.js` → `svetlaDnes(kluce, dnes)`: rátajú sa len dnešné kľúče 14 hier; cvičné sady, séria, nastavenia, včerajšok, poškodený JSON ani chýbajúce alebo zablokované úložisko nič nerozsvietia a nič nerozbijú. Nič neodchádza z prehliadača.
* **Svetlá domov.** Každý dom má okná alebo lampáš, ktoré jeho tlač označí cez `p.glow` (chalupy v `iso.js`, `lantern()` a ostatné v `miesta.js`); okno si nesie aj svoje priečky (`pts.bars`: stredová priečka chalúp a Magpies, kríž okrúhlych okien Badgers a Foxes). `svet.js` → `lightsOf()` ich raz zozbiera tlačou miest na pero, ktoré nič nekreslí (`W.lights`). Tlač (dlaždice) má okná domov cez deň tmavé, podvečer tlmene teplé (`dusk()`, `TLMENE` 0,35, priečky tmavé). Plné svetlo kreslí `village.js` (`drawLights`) cez tlač, pod všetkým, čo sa hýbe: cez deň jedna plochá teplá farba skla (`DENNE_SKLO`, slnko 0,95 a oranžová 0,2 ako ich zmieša tlač), podvečer plné teplé svetlo s kruhom ako lampy; priečky ostanú tmavé cez svetlo (nočný atrament 0,6). Kreslí sa len v obdĺžnikoch, ktoré sa prekresľujú aj tak: **slučka snímky nemá ani jeden sprite navyše** a dedinka po 40 s zastane ako predtým, ani rolovanie ju potom nezobudí (testy C2 a C21). Zadarmo to nie je: každá plná snímka (ťah, zoom) vyplní rozsvietené tabuľky a priečky znova, pri 14 z 14 najviac 23 plochých výplní a 13 priečok; kruh okna (radiálny gradient) vznikne raz na okno a plátno a potom sa len použije (test C19). Nezmerané v prehliadači.
* **Nové domy, ktoré majú svetlo až teraz** (predtým bez okna): Dormice (lampáš vpravo od tabule), Swans (lampáš na konci móla), Cranes (lampáš na južnom brehu jazierka), Herons (chatka s oknom na rozhľadni), Squirrels (dve horné dutiny v dube), Beavers (vchody oboch bobrích hradov). Sklo lampášov (Badgers, Foxes, Owls) a okrúhle okná Badgers a Foxes sú teraz cez deň tmavé s bledým krížom, aby bolo vidieť, čo sa rozsvieti. Vyriešený dom ukáže aj dokončenú scénku svojej rodiny (slučka labutí, lávka žeriavov, cesty volaviek), ako po otvorení karty.
* **Príchod po vyriešení na dvoch miestach.** *Riadok nad plagátom* je vidieť hneď po príchode (aj na telefóne), preto hovorí pravdu hneď: 600 ms (`CASY.start`, oko dopadne) po prvej snímke dedinky, alebo po návrate stránky, sa číslo dopočíta na všetko dnes vyriešené (`motion/components/number`, krok za každý dom v poradí vyriešenia, rovnaký rytmus ako atrament) a čítačka počuje „Now lit: Hares and Swans. 2 of 14 lights today.“ (`countArrival` vo `village.js`). *Okno domu* sa rozsvieti až tam, kde ho vidno: svetlo, ktoré tento prehliadač dnes ešte nevidel (`vl-seen` = `{"d": deň, "k": [...]}`), ostane tmavé, kým nie je na obrazovke aspoň 60 % dedinky (alebo 60 % okna, keď je plátno vyššie; `CASY.videt`, `viditelne()` v `moja.js`) a kým jeho dom nie je v tej časti. Pozerá sa pri každom 5 % kroku IntersectionObserver, pri rolovaní (poslúcha sa len kým niečo čaká) a vždy, keď sa pohľad zastaví inde. Potom o 600 ms sa okno naplní atramentom: kruh z prostriedku okna 0 na 1 za 360 ms, pružina snappy, dom po dome v poradí vyriešenia (odstup 140 ms, vlna najviac 1,4 s). V tej chvíli menovka domu (pri oddialení) ukáže malé teplé okienko a raz dosadne (mierka 1,3 na 1, pružina press, `cssEasing` z `core.js`) a zazvoní zvonček domu (ak je zvuk zapnutý). Dom mimo pohľadu (pod ohybom, priblížené inde) čaká, kým k nemu pohľad príde; do `vl-seen` sa zapíše len to, čo sa naozaj rozsvietilo. Do kola 2 počítal riadok len okná rozsvietené na obrazovke, takže po návrate z hry na iPhone a bežnom notebooku (plagát z väčšej časti pod ohybom) písal „0 of 14“, kým človek nezroloval (kontrola 2, V1; test C20 s oknom 1366 x 650 a iPhonom 390 x 660). Všetky časy sú v tabuľke `CASY` v `moja.js`. Pri `prefers-reduced-motion` svietia okná od prvej snímky, bez atramentu, dosadnutia a prelínania, číslo je hneď konečné.
* **Menovky pri oddialení** (`placeLabels`, pod `LAB_Z`): rozsvietený dom má pred menom malé okienko `#ffc454` v tmavom ráme, takže aj z celého ostrova (okno 2 až 7 px) je vidieť, ktoré domy svietia. Dom vyriešený dnes drží miesto okienka od začiatku (kým svetlo čaká, je okienko skryté cez `visibility`) a dnes vyriešené menovky si miesto vyberajú prvé, takže sa škatuľka pri rozsvietení nehýbe ani nemení riadok, ani susedná (test C16, aj na plátne 1334 x 520, kde sa menovky Magpies a Squirrels dotknú). Miesto sa zmení len pri novom zápise hry (návrat stránky) alebo novom dni.
* **14 z 14:** dedinka prejde do podvečera so svetluškami (ak svetlo prišlo teraz, podvečer príde 400 ms po poslednom atramente cez prelínanie, až keď svieti všetkých 14 aj na obrazovke). Kto si v ten deň zvolí Deň, ostane mu do polnoci (`vl-day14`). Časovač polnoci je presný aj v dňoch zmeny času (hľadá sa polením, test A7 s 29. 3. a 25. 10. 2026).
* **Riadok svetiel nad plagátom** (na tmavej stránke, miesto drží `index.html`, takže sa nič neposunie): okienko, „5 of 14 lights today“ (číslo sa kotúľa; počíta všetko dnes vyriešené, nie len okná, ktoré už na plátne svietia), odkaz „Next: <dom>“ na najbližší tmavý dom od domu vyriešeného naposledy a tlačidlo „Save card“ (počítač) alebo „Share card“ (dotyk). Nič nevyriešené: „Light a window today“ a „Start: Hedgehogs“. Je vidieť hneď po príchode aj na telefóne a nikdy neleží cez tlač (predtým roh plagátu vľavo dole: pod ohybom a pri 1920 x 1200 cez tlačovú značku). Na telefóne dva riadky (počet, potom odkaz a karta), ciele na dotyk 44 px (aj nástroje). Karta domu hovorí, či jeho okno svieti; zoznam pod plagátom má pri rozsvietených domoch „Lit today“.
* **Karta „My village, <dátum>: N of 14 lights“** 1080 x 1350 (`rozlozenieKarty` a `kresliKartu` v `moja.js`): tlačové značky, „Puzzle Village“, nadpis „My village“ v dvoch bubnoch, dátum, ostrov vytlačený znova týmto motorom vo veľkosti karty (ostrý na každom displeji, rozsvietený ako teraz, zvieratká v pokojnej chvíli), počet svetiel a pod ním „One light per puzzle solved“ (cudzí človek vo feede pochopí, čo je svetlo), 14 okienok s menami (rozsvietené majú lúče, tmavé kríž; stav nie je len farbou), adresa `arling.sk/games/village`. Do karty ide len dátum a zoznam rozsvietených domov, žiadna doska, čas ani nápoveda, teda nič neprezradí riešenie. Karta sa vytlačí vopred v tichej chvíli (`requestIdleCallback`, inak časovač; nie počas rolovania stránky a 500 ms po ňom, atramentu, dopočítania čísla, pohybu kamery ani v skrytej karte), keď sa zmenia svetlá alebo svetlo dňa, **aj keď okno ešte čaká na pohľad** (karta ukazuje, čo je vyriešené; na telefóne svetlo po návrate často čaká na rolovanie, kontrola 2, D2), takže ťuk otvorí systémový hárok hneď (Safari ho dovolí len priamo z ťuku) a ťuk nezamrzne. Na počítači ju vytlačí hneď aj ruka na tlačidle (myš nad ním, fokus klávesnicou), ak ešte nie je. Plátno karty (5,8 MB) sa po vzniku PNG hneď zmenší na 0 x 0, rovnako závoj prelínania (kópia celého plátna, pri 1408 x 684 a DPR 2 asi 15 MB), ako vyradené dosky dlaždíc (kontrola 2, D3). Čas tlače je v `window.__village.kartaMs`. Na dotyku hárok s obrázkom (`navigator.share`); keby ho prehliadač po čakaní odmietol, karta je hotová a druhý ťuk ju pošle. Inak stiahnutie `my-village-RRRR-MM-DD.png` a text s odkazom do schránky („Saved as … . Link copied.“, ak schránka dovolí).
* **Umami:** `village_to_game` s `game` a `from` (`house` = tlačidlo v karte domu, `lights` = odkaz v riadku svetiel, `list` = zoznam pod plagátom), `village_share` s `how` (`image`, `download`), `village_open_ref` s `ref` pri príchode z odkazu na karte (`?ref=card`; počká na skript štatistík, ktorý sa načíta posledný, najviac 10 s). Meranie: pozri `ops/games/village/STAV.md` (menovateľ sú zobrazenia `/games/village/`, nie `village_open`, lebo odkaz v riadku `village_open` neposiela).
* **Pre kontrolu v prehliadači:** `window.__village.lights()` vráti stav (dátum, počet vyriešených, svietiace, `svieti` = okná rozsvietené na plátne, `riadok` = číslo v riadku, čakajúce `caka`, večer, počet spritov, `karta` = vopred vytlačená), `window.__village.kartaMs` čas poslednej tlače karty v ms, `await window.__village.karta()` kartu ako PNG blob. Stav 0, 5 a 14 z 14 sa nastaví zápisom kľúčov `<hra>:<dnes>` = `{"done": Date.now()}` do `localStorage` pred načítaním; `localStorage.removeItem('vl-seen')` znova prehrá atrament.
* **Testy:** `node --test ops/games/village.test.mjs` (čisté funkcie, svetlá 14 domov a motor v malom falošnom prehliadači).

## Ovládanie a prístupnosť

* Myš: ťahať, dvojklik približuje, `Ctrl` + koliesko (a pinch na touchpade) približuje; obyčajné koliesko roluje stránku a ukáže radu.
* Dotyk: jeden prst posúva, dva približujú, ťuk otvorí domček (karta ako spodný list).
* Klávesnica: plátno má fokus, šípky posúvajú, `+` `-` priblíženie, `0` alebo `Home` celý ostrov, `Tab` prechádza skutočné tlačidlá nad domčekmi (kamera k nim dobehne), `Enter` otvorí kartu (fokus na nadpis), `Esc` ju zavrie a vráti fokus.
* Plátno má `role="img"` s popisom; pod ním je celý zoznam 14 domov s pravidlom a odkazom (pre čítačky aj vyhľadávače). Bez JavaScriptu sa ukáže veta a zoznam.
* Odkazy: `/games/village/#hedgehogs` otvorí rovno ten domček; `#view=x,y,z` nastaví kameru (na testy a snímky).

## Meranie výkonu

Nástroj: headless Chrome 153 (Windows, `--headless=new`, softvérové kreslenie canvasu, teda horší prípad než bežný počítač s GPU), Chrome DevTools Protocol `Performance.getMetrics` (rozdiel `TaskDuration` a `ScriptDuration` za úsek), plynulosť cez intervaly `requestAnimationFrame` merané v stránke. Headless beží na 75 Hz, preto „74,9 fps“ znamená bez straty snímky. Čas jednej dlaždice meria samotný motor (`window.__village`). Skripty merania sú v dočasnom priečinku relácie (cdp.mjs, perf.json), nie v repe.

Počítač 1440 x 900, DPR 1, plátno 1408 x 684:

| situácia | hlavné vlákno | z toho náš JS | plynulosť |
|---|---|---|---|
| hneď po načítaní, pohľad na celý ostrov (30 Hz) | 5,5 % jadra | 2,7 % | |
| 20 až 30 s bez vstupu (30 Hz) | 5,3 % | 2,1 % | |
| 60 až 90 s bez vstupu (6 Hz) | 2,2 % | 0,6 % | |
| **po 90 s bez vstupu (dedinka zastane)** | **1,2 až 1,7 %** (šum Chrome, rovnaký ako bez dedinky) | **0 ms** | |
| po prebudení myšou | 7,1 % | 3,0 % | |
| ťahanie celého ostrova | 18,2 % | 7,3 % | 74,9 fps, p95 13,5 ms, max 13,7 ms |
| Ctrl + koliesko, priblíženie 3x v 10 krokoch | 13,8 % | 8,2 % | 70,6 fps, p95 13,5 ms, max 40 ms |
| Ctrl + koliesko, oddialenie | 9,2 % | 4,1 % | 74,9 fps, p95 13,4 ms |
| rýchle priblíženie 2,2x v 3 krokoch | 13,6 % | 7,7 % | 70,2 fps, p95 26,6 ms |
| ťahanie priblížene (z 2,3) | 12,0 % | 5,6 % | 71,9 fps, p95 13,6 ms |
| dedinka odrolovaná mimo obrazovky | 1,5 % (šum) | 0 ms | |
| `prefers-reduced-motion` | 0,1 až 1,5 % (šum) | 0 ms | |

Tlač dlaždíc: priemer 3,8 ms, najdlhšia 28 ms (512 x 512 px). Halda JS 2,5 až 4,7 MB.

Telefón 390 x 844, DPR 2, dotyk, **procesor spomalený 4x** (simulácia slabého telefónu):

| situácia | hlavné vlákno (spomaleného jadra) | plynulosť |
|---|---|---|
| prvých 5 s (vrátane predtlače mapy) | 23,4 % | |
| posun jedným prstom | 51,4 % | 74,5 fps, p95 13,5 ms, max 26,7 ms |
| animácie po posune (slabý režim sa sám zapol, DPR 1,5) | 14,8 % | |

Pred optimalizáciou to bolo: v pokoji 6,1 %, zoom 47,7 fps s trhnutím 187 ms, telefón 4x pri posune 54,8 fps s trhnutím 120 ms.

## Firefox (25. 9. 2026)

Firefox 156 kreslí plátno na GPU, ale **text vyplnený vzorom a čiara (stroke) vzorom** ho natrvalo prepnú do softvéru: potom stojí 24 kópií dlaždíc 7 ms namiesto 0,1 ms a čiara 60 µs. Maska so `source-in` (zjednotenie vody a ciest) navyše brzdila tlač dlaždíc (13 až 110 ms). Preto pre Gecko (podľa user agenta, sonda pri štarte to rozlíšiť nevedela):

* čiary sa tlačia ako výplň presného tvaru, ktorý čiara pokrýva (`riso.js`, `OPT.fillStrokes`, overené na 449 235 bodoch bez chyby),
* písmená idú cez malú nepriehľadnú pomocnú dosku (ten istý pixel, to isté vyhladzovanie), zložené násobením a pripočítaním,
* voda a cesty sú jedna výplň nonzero namiesto masky, geometria raz na úroveň priblíženia,
* dlaždice 256 px od začiatku, hotové ako ImageBitmap, plátna dlaždíc sa opakovane používajú.

Chrome a Safari kreslia ako predtým, snímky Chrome pred a po sú zhodné na pixel. Cesta pre Firefox, vykreslená v Chrome proti pôvodnej: líšia sa len hrany (priemerný rozdiel 0,003 až 0,2 z 255). Vo Firefoxe samom (stará cesta proti novej, 10 pohľadov): priemer 0,1 až 1,3 z 255, nad 8 úrovní najviac 1,8 % pixelov, voľným okom ani pri 6-násobnom zväčšení rozdiel nevidno (nová cesta ostáva na GPU, ktoré zaokrúhľuje o úroveň inak než softvér).

Skutočné okno Firefoxu, 75 Hz, DPR 1 (skript `fx.mjs` v dočasnom priečinku relácie):

| úsek | pred | po |
|---|---|---|
| ťah | 69 až 74 fps, p95 13,4 až 26,7 ms, max 40 | 75 fps, p95 13,4, max 13,4 |
| Ctrl + koliesko | 45 až 49 fps, p95 40 až 53, max 93 až 107, 22 snímok nad 50 ms | 75 fps, p95 13,4, max 26,7 |
| tlačidlá +/- | 42 až 49 fps, p95 27 až 40 | 75 fps, p95 13,4, max 26,7 |
| otvorenie domčeka | 57 až 69 fps, 1 až 4 snímky nad 50 ms | 74 až 75 fps, p95 13,4; prvé otvorenie občas jedna medzera 67 ms mimo kódu dedinky |
| zvieratká v pokoji | 24, po 10 s 12 snímok/s, nerovnomerne | 37,5 snímky/s, presne každých 26,7 ms |
| práca na snímku | 7 až 24 ms | 0,3 až 3 ms |

## Čo je slabé (úprimne)

* **V pokoji pred zastavením to nie je 0 %.** Prvú minútu po poslednom dotyku stojí animácia v softvérovom kreslení 5 až 5,5 % jadra (náš JS 2 až 2,7 %, zvyšok je kreslenie a skladanie Chrome), potom 2,2 %. Na počítači s GPU to bude menej, ale zmerané to nemám, headless beží bez GPU. Až po 90 s je náš podiel naozaj 0.
* **Pohľad zďaleka má drobné zvieratká** (8 až 15 px); hlavný zážitok je až po priblížení. Na mobile je ostrov širší než displej, bočné domy (Hares, Squirrels) treba doťahať.
* **Scény sú jednoduché ilustrácie**, nie sú to skutočné dnešné zadania hier; hlavolamy na tabuliach sú ozdobné (Voles, Otters, Herons, Badgers a Cranes sú ale platné malé riešenia).
* **Ťuk na miesto berie elipsu okolo domu**; pri priblížení je citlivá plocha veľká, pri oddialení môžu byť dva susedné domy blízko seba.
* **Na dotykovom displeji prst na plátne posúva dedinku, nie stránku** (`touch-action: none`). Plátno má preto na mobile najviac 64 % výšky okna, aby sa dalo rolovať okolo neho.
* Enter na tlačidle domčeka som v headless overiť nevedel (CDP neposiela kliknutie z klávesu); Tab, fokus s obrysom, dobeh kamery a Esc s návratom fokusu overené sú.
* `og.png` je snímka z headless Chrome, pri zmene kresby ju treba pregenerovať (po 27. 9. aj kvôli tmavým lampášom a tlmeným oknám podvečer).
* **Svetlo okna sa kreslí cez tlač**, teda aj cez predmet, ktorý by stál pred oknom (rovnako ako doteraz podvečerné okná v dlaždiciach); nové lampáše som umiestnil výpočtom súradníc, nie podľa snímky. Z celého ostrova má okno 2,5 px (telefón) až 6,5 px (počítač), lampáše Dormice, Swans a Cranes 1 až 3 px: atrament samotný je naplno vidieť až po priblížení, z diaľky nesie moment menovka (okienko a dosadnutie) a číslo v riadku svetiel.
* **Karta sa tlačí vopred** každému, kto má dnes aspoň jedno svetlo, aj keď ju nikdy nepošle: jedna dlhá úloha v tichej chvíli (odhad 100 až 600 ms na slabom telefóne, nemerané; v prehliadači ju ukáže `window.__village.kartaMs`) a PNG (odhad 1 až 3 MB) v pamäti; samotné plátno karty sa hneď uvoľní. Ťuk potom nezamrzne a Safari otvorí hárok. Keby meranie pri procesore 4x na počítači ukázalo nad 150 ms, dá sa tlač vopred na počítači vypnúť a nechať len tlač pri ruke na tlačidle (už je v kóde); riziko: kliknutie pred dokončením PNG uloží kartu až po čakaní a Chrome pri druhom takom stiahnutí môže spýtať povolenie na viac súborov.
* **Denné rozsvietené sklo je plochá farba**, nie zrnitý atrament (tri vzorové výplne na tabuľku by stáli na každej plnej snímke trikrát viac; zo zväčšenia to treba posúdiť na snímke).
* `index.html` je poskladaný z obalu stránky Grandpa's Lighthouse (hlavička a päta); keď sa zmení spoločná hlavička hubu, treba ju sem preniesť ako do ostatných stránok.

## Čo ostáva Fable

* Odkaz z `games/index.html`, zápis do `zoznam.json` (ak má dedinka byť v zozname), sitemap a IndexNow. Tieto súbory som nemenil.
* Umami udalosti: `village_open` (JS, `{game}`), `village_play` (tlačidlo v karte, `data-umami-event-game`), `village_list`, `village_list_play`, `village_to_games`, `village_to_lighthouse`, `games_to_puzzle_post`, `games_to_shop`; od 27. 9. aj `village_to_game` (`game`, `from`), `village_share` (`how`) a `village_open_ref` (`ref`).
