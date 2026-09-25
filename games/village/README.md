# ARLing Puzzle Village

Stránka `arling.sk/games/village/`. Izometrický ostrov ako risografický plagát: 14 miest, každé patrí jednej dennej hre a jej zvieratkám, plus námestie s tabuľou (odkaz na `/games/`). Všetko je nakreslené kódom na canvase, bez obrázkov, bez knižníc, bez CDN. Anglicky.

## Súbory

| súbor | čo robí | veľkosť (raw / gzip) |
|---|---|---|
| `index.html` | obal hubu (hlavička, päta, CSP, Umami, JSON-LD `CollectionPage` + `ItemList`), plátno, nástroje, karta domčeka, zoznam 14 domov ako odkazy | 30 kB |
| `village.css` | plagát v tmavej stránke, nástroje, karta, zoznam, mobil | 6,6 / 2,3 kB |
| `village.js` | motor: dlaždice, sprity, kamera, vstup, karta, zvuk, šetrenie procesora | 31 / 9,6 kB |
| `miesta.js` | 14 miest + námestie: statická scéna a sprity, voda, vodopád, svetlušky | 63 / 17,4 kB |
| `svet.js` | ostrov, rieka, jazerá, cesty, stromy, lampy, rámik plagátu, podvečer | 21 / 7,0 kB |
| `iso.js` | izometria, domčeky, stromy, 15 zvieratiek (vrátane líšky) | 30 / 6,9 kB |
| `riso.js` | atramenty: zrnité dlaždice 128 px, rastrový bod, posun registrácie, pero `Pen` | 7,6 / 2,9 kB |
| `og.png` | náhľad na zdieľanie 1200 x 630, snímka tohto plátna (256 farieb) | 294 kB |

JavaScript spolu 152 kB raw, **41,8 kB gzip**, 5 modulov (preloadované cez `modulepreload`).

## Ako to funguje

* **Tlač v atramentoch.** Každá farba je „bubon“ risografu: zrnitá dlaždica, tlačená cez `multiply`, s posunom registrácie. Kde má byť čistá farba (voda, cesty, koruny stromov, strechy), najprv sa tlačí papier (knockout), inak by modrá cez zelenú dala blato.
* **Statická vrstva raz.** Papier, ostrov, voda, domy a stromy sa kreslia do dlaždíc 512 px pre danú úroveň priblíženia (úrovne po √2) a ukladajú sa (LRU, rozpočet v bajtoch: počítač 72 MiB, mobil alebo dotyk 48 MiB, slabé zariadenie 40 MiB; na obrazovke sa nikdy nevyhadzuje). Posun kamery len skladá hotové dlaždice.
* **Odolnosť voči GPU (26. 9. 2026).** Na Galaxy Z Fold 7 sa po otvorení ukázal šum a posunuté dlaždice: GPU stratilo obsah plátien a čiastočné prekresľovanie ho už nikdy neopravilo. Teraz: `contextlost` alebo `contextrestored` na hlavnom plátne, na doskách dlaždíc, na 128 px atramentoch aj na pomocných doskách zahodí všetky dlaždice, dosky a atramenty a vytlačí ich znova, hlavné plátno celé. Po návrate stránky (skrytá viac než 1 s, `pageshow` z bfcache, `resume`) a po zmene obrazovky (zloženie Foldu) sa dlaždice potichu pretlačia, staré ostanú vidieť, kým ich nové nenahradia. Po každom návrate, `focus`, zmene veľkosti či DPR a raz po upokojení pohľadu sa plátno poskladá celé z dlaždíc (len kópia). Doska z bazéna sa znova použije až keď na ňu neukazuje živý záznam ani prebiehajúci `createImageBitmap`; ImageBitmap sa pri vyradení vždy zatvorí; vyradená doska sa hneď zmenší na 0 x 0. ImageBitmap len vo Firefoxe (v Chrome prínos nemal). DPR sa nemení (Fold ostáva na 2), obraz je pixel po pixeli rovnaký ako pred opravou.
* **Pohyb len v malých spritoch.** Každý sprite vráti svoj stav ako pár čísel; prekreslí sa len vtedy, keď sa stav zmení aspoň o pol pixela. Prekresľuje sa iba jeho obdĺžnik: kópia dlaždíc pod ním a sprity v ňom. Dym, kruhy na vode, „zzz“ a vodopád bežia ako flip book 12 snímok za sekundu, odlesky na vode 4 za sekundu.
* **Slučka stojí, keď nič nie je treba.** Mimo obrazovky (IntersectionObserver) a v skrytej karte (`visibilitychange`) sa zastaví úplne. Pri pohybe kamery beží na frekvencii obrazovky; zvieratká (životná slučka) na každej n-tej snímke obrazovky, aspoň 30 za sekundu a rovnomerne (75 Hz: 37,5, každých 26,7 ms; 60 Hz: 30), a **po 40 s bez vstupu dedinka zastane ako tlač** (v pokojnej chvíli, žiadny zajac vo vzduchu). Do 25. 9. to bolo 24 a po 10 s 12 snímok za sekundu cez časovač, čo na 60 a 75 Hz obrazovke pôsobilo ako sekanie. Pohyb myši nad ňou, dotyk alebo kláves ju hneď prebudí.
* **Priblíženie.** Počas zoomu sa len naťahujú dlaždice, ostré sa tlačia až po zastavení, najviac jedna za snímku. Pod chýbajúce sa kladie hrubá vrstva celej mapy, ktorá sa predtlačí hneď po načítaní.
* **Slabé zariadenie.** `hardwareConcurrency <= 4` alebo `deviceMemory <= 4`, alebo priemerná snímka nad 9 ms: hustota pixelov najviac 1,5, animácie 20 / 15 / 6 Hz, nové ostré dlaždice sa počas ťahania netlačia.
* **Znížený pohyb** (`prefers-reduced-motion`): jedna statická snímka, slučka sa nespustí, kamera bez dobehu.
* **Deň a podvečer** podľa miestneho času (18:00 až 5:59 podvečer), prepínač v nástrojoch (pamätá si ho `localStorage`). Podvečer sú dva ďalšie bubny (slivka, modrá), svietia okná a lampy, nad vodou lietajú svetlušky.
* **Zvuk** je vypnutý, kým ho návštevník nezapne: krátky zvonček pri otvorení domčeka, syntetizovaný cez Web Audio, každý dom inak vysoko (pentatonika). AudioContext vzniká až po kliknutí.

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
* `og.png` je snímka z headless Chrome, pri zmene kresby ju treba pregenerovať.
* `index.html` je poskladaný z obalu stránky Grandpa's Lighthouse (hlavička a päta); keď sa zmení spoločná hlavička hubu, treba ju sem preniesť ako do ostatných stránok.

## Čo ostáva Fable

* Odkaz z `games/index.html`, zápis do `zoznam.json` (ak má dedinka byť v zozname), sitemap a IndexNow. Tieto súbory som nemenil.
* Umami udalosti: `village_open` (JS, `{game}`), `village_play` (tlačidlo v karte, `data-umami-event-game`), `village_list`, `village_list_play`, `village_to_games`, `village_to_lighthouse`, `games_to_puzzle_post`, `games_to_shop`.
