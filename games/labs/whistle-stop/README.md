# Whistle Stop M0 „Pocit v ruke“ (labs, noindex)

Interný test pocitu pre Andreja podľa `ops/hry/western/GDD.md` časť 6.1 a rozhodnutia Fabla 28. 9. 2026 okolo 03:25 (`ops/ai/rozhodnutia.md`). Nie je to produkt na zverejnenie; zverejnenie ide cez bránu 8,5. Anglicky, čistý JavaScript, 2D plátno a obrázky kreslené kódom, CSP `self` (obrázky vrstiev ako `blob:` z vlastného kódu), žiadne CDN, žiadne AI obrázky, zvuk syntézou.

Otázky pre Andreja: `OTAZKY.md`. Brána: pokus 1 NEPREJDE (`ops/ai/kontrola/2026-09-28-western-m0-gdd-p3.md`), pokus 2 NEPREJDE (`ops/ai/kontrola/2026-09-28-western-m0-pokus2.md`), toto je **pokus 3, posledný** (28. 9. 2026, Claude 2). Zisk (7,0) je pri internom teste M0 z podstaty pod 8,5 (príspevok do 1. 10. je 0 €); na tom sa nič nemení a nič sa tu nepredstiera.

## Pokus 3: čo sa zmenilo podľa nálezov brány

| Nález pokusu 2 | Príčina | Oprava | Dôkaz |
|---|---|---|---|
| 1 obchádzanie pultu | `chod` pridal jeden obchádzkový bod; pri pôvodnom rozostavení ani neexistovala ulička okolo pultu (medzera pult a váha 48, pult a sudy 52 jednotiek, človek s vrecom má na šírku 58) | Nový `trasy.mjs`: prekážky sú všetky miesta nábytku (aj prázdne) zväčšené o polomer postavy 29 a rezervu 3, pult aj so zónou predavača; trasa je najkratšia cesta grafom viditeľnosti rohov (Dijkstra), počíta sa len pri novom cieli. Nové rozostavenie: ulička vľavo aj vpravo od pultu, chodba za ním k policiam, skladu a peci; váha a sudy v dolných rohoch. Vrece v ruke bližšie k plecu. | test `trasy v interiéri`: **3 058 trás** (dvere, 23 miest pred pultom, pohľady na 5 kusov pri 4 mierkach menoviek, všetky dvojice tam aj späť, a 176 bodov z polovice cesty do dverí a ku každému kusu, lebo kúpa pošle človeka pozrieť hneď), každá úsečka po 1 jednotke: vzdialenosť od každého kusu aj predavača aspoň polomer postavy, steny, dvere; test `človek zhora sa celý zmestí do polomeru`. Snímky `ops/hry/western/m0/snimky/390-dnu-1..8.png` a `1440-dnu-1..8.png` (8 snímok po 0,7 s počas obsluhy, poloha ľudí v logu). |
| 2 menovky počas obsluhy | menovky boli v podlahe pod ľuďmi | Menovky sú samostatný obrázok `<img id="i-menovky">` **nad** živou vrstvou s ľuďmi (obrázok, nie plátno, kvôli výkonu). Miesta, kde ľudia stoja (pred pultom, pri kuse), sú navyše mimo menoviek: bod pohľadu na kus sa hľadá podľa skutočne nakreslených štítkov. | test `menovky čitateľné počas obsluhy` (poradie v DOM, kreslenie mimo podlahy) a v teste trás: žiadny bod státia pod štítkom pri mierkach 0,508; 0,8; 1,15. Snímky `390-dnu-*`, `1440-dnu-*`, `fx-1440-dnu.png` (Firefox). |
| 3 výkon otvoreného interiéru | nemeraný | Scenár `?demo&interier` (cyklus 10 s: otvorenie v 0,5 s, obsluha, kúpa kusu v 2, 3,5, 5 a 6,5 s, návrat na ulicu v 8 s); meranie vypíše počet otvorení, kúp, návratov a snímok s otvoreným interiérom. Popri tom: podlaha interiéru je obrázok (plátna v stránke už len 3), plátna na kreslenie obrázkov sa používajú znova, pôdorys vyjde až po dekódovaní obrázkov. | tabuľka „Namerané, pokus 3“ nižšie |

## Pokus 2: čo sa zmenilo podľa nálezov brány

| Nález | Oprava | Dôkaz |
|---|---|---|
| 1 výkon pri švihu | Príčina podľa stopy Chrome (tracing hlavného vlákna, nie odhad): každé `<canvas>` v stránke Chrome v softvérovom režime kopíruje kompozítoru pri **každom** commite, aj nezmenené (`Canvas2DResourceProvider::ProduceCanvasResource` 4 436 ms z 8 000 ms pri 4x spomalení, 11 volaní na snímku = 11 plátien). Teraz: nebo, hory, trať, ulica, budovy, lopatky a popredie sú `<img>` nakreslené raz do `OffscreenCanvas` a zakódované mimo snímky; švih a paralaxa menia len `transform` (kompozítor); diely bábok sú `ImageBitmap`; živé plátno je len pás chodcov (277 jednotiek sveta namiesto celého okna); mince a nárazy vetra letia cez Web Animations API; lišta cyklu je `scaleX`; v snímke sa nečíta rozloženie. | tabuľka meraní nižšie; test `výkon (nález 1 brány M0)` v `test/vzhlad.test.mjs` |
| 2 snímka mobilného interiéru | Interiér je samostatný panel nad scénou, fasáda sa zdvihne mimo obrazovku; nová snímka po poslednej zmene a funkčný test: otvorenie, výber Shelves skutočným ťuknutím do pôdorysu, kúpa, návrat na ulicu. | `ops/hry/western/m0/snimky/390-interier.png`, `390-funkcia-1-interier.png`, `-2-kupa.png`, `-3-ulica.png` (aj 1440) |
| 3 interiér priblížiť, živý svet | Interiér sa zo stopy obchodu zväčší do voľnej plochy (FLIP, len transform): počítač 1440 x 900 mierka 1,15, pôdorys 828 x 621 px (predtým 274 px); mobil 390 mierka 0,51, 366 x 274 px. Predmety prekreslené (pokladňa, poháre s viečkami, sudy s vekom, váha s miskami, liatinová pec s rúrou, debny a vrecia), menovky 16 px (mobil) a 17 px (počítač), výber ťuknutím aj myšou s obrysom pri prejdení. Na ulici: zákazník príde k obchodu, pri obsadenom pulte čaká v rade, vystúpi na chodník, dvere sa otvoria, vo výklade príde k pultu, predavač mu podá vrece, vyjde s vrecom; pri búde (úroveň 1 až 9) ho obslúžia cez okienko priamo na ulici. V interiéri predavač za pultom ide k zákazníkovi, zákazník dostane vrece, pozrie si kus nábytku a odíde. | sekvencie `390-obsluha-1..5`, `1440-obsluha-1..5`, `390-buda-1..5`; test `interiér (nález 3 brány M0)` |
| 4 text prvého cieľa | Čistá funkcia `dalsieCiele(n)` v `ekonomika.mjs`: najbližšia vizuálna zmena (fasáda, ďalší pracovník, interiér) a míľnik príjmu zvlášť, spolu v jednom riadku len keď padnú na tú istú úroveň. Úroveň 1 a 9: „Level 10: false front“ a „Level 25: income x2“; 10 a 24: „Level 25: income x2, porch, second clerk, interior“. | test `karta: najbližšia vizuálna zmena…` v `test/logika.test.mjs`; v Chrome prečítané z karty pre 1, 9, 10, 24 |
| 5 posluch zvuku | Neviem splniť (nepočujem). Presný postup pre Andreja je v časti „Posluch zvuku“ nižšie, otázka 4 v `OTAZKY.md`. | nič |

## Rozsah M0 (GDD 6.1) a čo je v kóde

| Časť GDD 6.1 | Kde |
|---|---|
| ulica s tromi budovami (Well, General Store, Barber) kreslenými kódom v palete | `scena.mjs` (`kresliObchod`, `kresliStudnu`, `kresliHolica`) |
| funguje len General Store: ťuk spustí cyklus, kúpa x1 a x10 | `stav.mjs` (`tukObchod`, `krok`, `kupUroven`), karta v `hra.mjs` |
| najatý pracovník za pultom pri úrovni 25, manažér, ktorý ťuká za hráča | `ekonomika.mjs` `pracovnikov`, `stav.mjs` `najmiManazera`; manažérka sedí na verande |
| poschodia (fasáda rastie s míľnikmi 1, 10, 25, 50, 100, 200, 300) | `ekonomika.mjs` `FASADA`, `scena.mjs` |
| interiér jednej budovy zhora (6 miest x 3 stupne), priblížený | `scena.mjs` `kresliPodlahu`, `kresliKus`, `kresliMenovky`, `kresliClovekaZhora`; `hra.mjs` `cielInterieru`, `postavInterier`, `krokLudi`; `trasy.mjs` (trasy okolo nábytku) |
| chodci ako bábky zo 6 dielov, zákazníci s obsluhou | `babky.mjs` (stavy `STAV`), `hra.mjs` `krokChodcov`, `kresliDvere` |
| švih medzi 3 budovami so snapom na mobile, celá ulica na počítači | `kamera.mjs`, `hra.mjs` `polohaVrstiev` |
| paralaxa 4 vrstiev, prach spod nôh | `scena.mjs` (kulisy), `hra.mjs` |
| vietor, veterník, ťuk, minca | `zvuk.mjs` |
| prepínač deň a noc (na skúšku) | `hra.mjs`, `paleta.mjs` |
| `ekonomika.mjs` pre jednu budovu s testami, uloženie | `test/logika.test.mjs`, `ulozenie.mjs` |

## Vizuálna špecifikácia M0 (čísla, podľa GDD 4 a skillu arling-appka)

**Smer:** „Papierové divadlo na Západe“. Vrstvy ako vystrihnutý papier, ploché farby, obrys atramentom, žiadne tiene, rozmazanie ani prechody farieb.

**Paleta (GDD 4.1, kontrast overuje `test/vzhlad.test.mjs`):** papier #F3E6CC, piesok #E2B878, skala #B4472E, hlina #6B2E22, salvia #7F8F5E, nebo #8DB4C8, noc #1F2640, atrament #2A1D16, lampa #F4B63F, drevo #8F5E3A. Text UI je atrament na papieri (13,2 : 1) alebo papier na noci (12,1 : 1). Text nikdy na skale ani na salvii.

**Písmo:** ARLing Draw Text (`ARLingDrawText-VF.woff2`, 34,8 kB, vlastné písmo firmy, `ops/pismo/vystup/`), nadpisy 600, UI 500. Stupnica: názov budovy 28 px, peniaze 22 px, tlačidlá 17 px, popis 16 px, menovky v interiéri 16 px (mobil) a 17 px (počítač); nič pod 16 px.

**Tvary:** obrys 4 jednotky sveta, hĺbka stupňom povrchu, tlačidlá so zaoblením 6 px a obrysom 2 px, ciele aspoň 48 px (miesta v interiéri s toleranciou 24 jednotiek aspoň 48 px aj na mobile, test).

**Rozloženie:** mobil na výšku (šírka pod 760 px): jedna budova na 80 % šírky, zem v 60 % výšky, karta v spodnej tretine, bezpečné okraje `env(safe-area-inset-*)`; pri otvorenom interiéri sa skryjú šípky (zakryli by predmety pri stene). Počítač: celá ulica vľavo, karta vpravo dole 400 px, interiér vľavo od karty.

**Pohyb (pružiny z `/motion/src/core.js`, krivky z GDD a skillu animate):**

| Dej | Nástroj a krivka | Čas | Znížený pohyb |
|---|---|---|---|
| ťuk na budovu, kúpa | transform scale, 1,0 na 0,97 na 1,0 | 150 ms | bez mierky, zvuk ostáva |
| minca z dverí | WAAPI: oblúk 40 px hore `cubic-bezier(0.2, 0, 0, 1)`, potom k počítadlu `cubic-bezier(0.77, 0, 0.175, 1)` | 400 + 350 ms | minca sa neukáže, číslo sa zmení |
| nový stupeň fasády | modul vyjde zdola, pružina enter, prach z okrajov; štart až po dekódovaní nového obrázka | 350 ms + prach 500 ms | modul je hneď |
| švih medzi budovami | transform vrstiev, pružina camera (0,62; 1), bez prekmitu | asi 600 ms | skok |
| interiér | fasáda hore a pôdorys zo stopy obchodu do cieľa (FLIP: translate + scale), pružina enter; späť rovnakou cestou | asi 350 ms | prepnutie |
| nábytok dosadne | pružina press, mierka 0,85 na 1 | 312 ms | bez mierky |
| obsluha zákazníka | krok na chodník 0,4 s (ease-out), vo výklade k pultu 0,35 s, vrece letí 0,35 s po oblúku, od pultu 0,35 s, krok späť 0,4 s; spolu asi 2,25 s | 2,25 s | bábky chodia (sú obsah), vrece letí |
| náraz vetra | WAAPI, lineárne (stály pohyb) | 1,2 s každých 8 až 20 s | vypnutý |
| počítadlo peňazí | snappy | 400 ms | konečné číslo |

Chôdza bábky (GDD 4.3): nohy 22° x sin(2π t f) v protifáze, f = rýchlosť / krok (krok 0,283 výšky postavy), ruky opačne 14°, trup 2 px x |sin|, klobúk dobieha pružinou (tuhosť 400, tlmenie 0,6). Zákazník na chodníku pri dverách je o 6 % menší (hĺbka), vo výklade v mierke predavačov (1,5x).

**Moment výsledku v M0:** nový stupeň fasády: 0 ms zvuk troch úderov kladiva, modul vyjde zdola (350 ms), prach z okrajov (500 ms); žiadne okno, hra ide ďalej, ťuk nič neblokuje.

**Zvuk a haptika (GDD 4.7, len syntéza):** vietor −28 dBFS stále, veterník vŕzga každých 6 až 12 s, ťuk drevo 60 ms (pentatonika podľa budovy), minca 80 ms (pri manažérovi každá 3.), kúpa kladivo 90 ms, míľnik tri údery 400 ms, najatie zvonček, nábytok drevený dosad, studňa vedro. Zvuk sa zapne po prvom ťuku (pravidlo prehliadača); prepínač zvuku v rohu. Haptika na webe nie je (Android M2).

**Pravidlá kreslenia (GDD 5.4, poučenia Village, stopa Chrome z pokusu 2):**
- Statické veci (nebo, hory, trať, ulica, budovy, lopatky, popredie, od pokusu 3 aj podlaha interiéru s nábytkom a menovky interiéru) sú `<img>`: kreslia sa do `OffscreenCanvas` (pre ten istý obrázok a rozmer vždy to isté) pri zmene stupňa fasády, nábytku, dňa a noci alebo rozmeru, zakódujú sa `convertToBlob` mimo snímky a nový obrázok sa ukáže až po `decode()`. Plátna v stránke sú len 3: pás chodcov (každú snímku), dvere a výklad (len počas obsluhy, inak skryté), živá vrstva interiéru s ľuďmi (len pri otvorenom interiéri). Test stráži, že ich nie je viac.
- Interiér: ľudia chodia len po trasách z `trasy.mjs` (okolo nábytku, počítané pri novom cieli, nie v snímke); menovky sú nad ľuďmi.
- Švih kamery a paralaxa: len `transform: translate3d` na 4 vrstvách a skupine ulice, zarovnané na celé pixely zariadenia; veterník sa otáča cez `transform: rotate`.
- Bábky z hotových dielov (`ImageBitmap`) cez `drawImage` s transformáciou; žiadne alokácie plátien v snímke.
- Žiadne `createPattern`, tiene, filtre, `source-in` ani prechody farieb. Hustota pixelov najviac 2 (slabé zariadenie 1,5). Chodcov najviac 6 na mobile a 14 na počítači, častíc najviac 40. Po 30 s bez vstupu 30 snímok za s, po 3 min 15, v skrytej karte 0.
- V snímke sa nečíta rozloženie (test prejde telá funkcií snímky); rozmery sa čítajú len pri zmene okna, štarte a otvorení interiéru.

**Znížený pohyb:** bez mierky, kamery, prachu, mincí a vetra; bábky chodia (sú obsah), veterník stojí; časy na čítanie ostávajú.

## Spustenie a overenie

- Testy: `node --test --experimental-test-isolation=none products/arling-sk/games/labs/whistle-stop/test/logika.test.mjs products/arling-sk/games/labs/whistle-stop/test/vzhlad.test.mjs ops/hry/western/sim.test.mjs` = **32/32** (M0 28, simulácia 4), 28. 9. 2026 po poslednej zmene.
- Lokálne: `python -m http.server` NESTAČÍ (`.mjs` ako text/plain). Použi `ops/hry/western/m0/server.mjs` (skripty ho spúšťajú samy). `?demo` hrá samo a švihá, `?demo&interier` meria otvorený interiér (cyklus 10 s), `?meranie` zapisuje intervaly snímok do `window.__ws` (aj špičky nad 50 ms s fázou scenára), `?novy` ignoruje uloženie, `?slabe` vynúti slabé zariadenie.
- Skripty (len cez `python ops/druhy-ucet/cakaj-zamok.py`): `ops/hry/western/m0/snimka.mjs snimka|meraj|funkcia ...` (Chrome cez CDP; `meraj 390 844 4 12 "demo&interier"`; `snimka 390 844 <vystup.png> dnu` nafotí 8 snímok obsluhy v interiéri; `meraj ... demo stopa` vypíše stopu hlavného vlákna), `ops/hry/western/m0/fx.mjs` (skutočné okno Firefoxu, dočasný profil, voliteľne rám `390x844`; `fx.mjs 1440 900 15 "demo&interier" -`).

## Namerané 28. 9. 2026, pokus 3: otvorený interiér (nález 3)

Scenár `?demo&interier`: v každom behu 1 otvorenie (FLIP), 5 až 7 kúp kusu nábytku (dosadnutie, nový obrázok podlahy, na počítači aj menoviek, človek ide kus pozrieť), 1 až 2 návraty na ulicu, zákazníci chodia a sú obsluhovaní; interiér otvorený v 554 až 928 snímkach z behu (počty vypisuje meranie). Chrome headless, softvérové kreslenie, CDP 4x spomalenie, 1,5 s na spomalenie, 12 s záznamu. Firefox 156 skutočné okno, dočasný profil, 15 s. Na finálnom kóde.

| Kde | Behy | Výsledok | p95 do 17,5 ms |
|---|---|---|---|
| Chrome 4x, 390 x 844 (DPR 2) | 3 | 58 až 60 snímok/s, p95 16,7 až 16,8 ms, nad 20 ms 6 až 19 z 702 až 714, max 33,4 ms, JS p95 2,3 až 2,5 ms | **splnené 3 z 3** |
| Chrome 4x, 1440 x 900 | 3 | 59 až 60 snímok/s, p95 16,8 ms, nad 20 ms 5 až 11 z 709 až 715, max 33,4 až 33,5 ms, JS p95 2,5 až 2,6 ms | **splnené 3 z 3** |
| Firefox okno 1440 x 815 | 1 | 74 snímok/s (monitor 75 Hz), p95 13,36 ms, nad 20 ms 4 z 1 111, **max 146,8 ms (1 snímka)**, JS max 4 ms | splnené |
| Firefox okno, rám 390 x 844 | 1 | 74 snímok/s, p95 13,36 ms, nad 20 ms 1 z 1 114, **max 146,8 ms (1 snímka)**, JS max 2 ms | splnené |

Pred poslednými úpravami (podlaha ako obrázok) rovnako: Chrome 4x 390 3 z 3 p95 16,7 ms, 1440 3 z 3 p95 16,8 ms. Kontrola ulice po úpravách (`?demo`): Chrome 4x 390 p95 16,7 až 16,8 ms (3 behy, v jednom max 83 ms, v ďalších dvoch 33,3 ms), 1440 p95 16,8 ms, Firefox 1440 p95 13,36 ms, max 13,36 ms.

**Poctivo k Firefoxu:** v každom behu s kúpami je práve jedna snímka 147 až 187 ms, raz za reláciu (32 s beh, 13 kúp: stále len jedna), pri kúpe kusu okolo 12 s po načítaní. JS snímky je pritom do 6 ms, zastavenie je mimo skriptu hry. Pokusmi som vylúčil: zvuk (beh bez Web Audio), prekreslenie obrázkov pri kúpe (beh bez neho), animáciu dosadnutia kusu (beh bez nej), fázu scenára (posun o 5 s: špička sa posunula s časom, nie s fázou), plátno podlahy (zmenené na obrázok) a novú alokáciu plátien (teraz sa používajú znova). Bez kúp (`20 s`, 2 otvorenia) špička nie je. Príčinu bez profilera Firefoxu nepotvrdím; p95 splnené, ale hráč to môže raz za reláciu vidieť ako zášklb pri prvej kúpe.

## Namerané 28. 9. 2026, pokus 2 (rovnaký scenár ako pokus 1)

Scenár: `?demo` (ťuk každých 0,3 s, kúpa x10, manažér, na mobile švih každých 2,2 s), 1,5 s na spomalenie, potom 12 s záznamu. Chrome headless, softvérové kreslenie (`--disable-gpu`), CDP `Emulation.setCPUThrottlingRate 4`.

| Kde | Behy | Výsledok | Akceptácia p95 do 17,5 ms |
|---|---|---|---|
| Chrome 4x, 390 x 844 (DPR 2) | 4 + 1 kontrolný na finálnom kóde | každý beh 59 až 60 snímok/s, p95 16,7 až 16,8 ms, nad 20 ms 1 až 5 snímok z 713 až 719, max 33,3 až 50 ms, JS p95 2,0 až 2,3 ms | **splnené 5 z 5** |
| Chrome 4x, 1440 x 900 | 4 + 1 kontrolný | 59 až 60 snímok/s, p95 16,7 až 16,8 ms, nad 20 ms 1 až 6 z 711 až 719, max 33,2 až 50 ms | **splnené 5 z 5** |
| Firefox 156, skutočné okno 1440 x 815, dočasný profil, 15 s | 1 | 75 snímok/s (monitor 75 Hz), p95 13,36 ms, max 13,36 ms, 0 nad 20 ms | splnené |
| Firefox 156, skutočné okno, hra v ráme **390 x 844** (okno 600 x 915), dočasný profil, 15 s | 1 | 75 snímok/s, p95 13,36 ms, max 13,36 ms, 0 nad 20 ms | splnené |
| Firefox 156, skutočné okno 500 x 759 (najužšie), 15 s | 1 | 75 snímok/s, p95 13,36 ms, max 13,46 ms | splnené |

Pre porovnanie pokus 1 (ten istý scenár): Chrome 4x pri 390 p95 33,3 ms v 3 zo 4 behov, pri 1440 v 2 zo 4. Stopa pokusu 2 pred opravou: hlavné vlákno obsadené 7 950 ms z 8 000 ms; po oprave 4 470 ms z 8 000 ms.

Poctivo k meraniu: CPU spomalenie v Chrome brzdí hlavné vlákno stránky, nie kompozítor; oprava presúva prácu na kompozítor, čo je presne jeho úloha aj na telefóne s GPU. Firefox pod 500 CSS px okno nedovolí ani so zmenenou hustotou pixelov (overené: okno sa samo rozšírilo), preto rám 390 x 844 v skutočnom okne. Režim otvoreného interiéru a skutočný telefón som nemeral.

Funkčný test v Chrome (`snimka.mjs funkcia 390 844` aj `1440 900`, skutočné klepnutia a kliky): ťuk spustí cyklus, po 2,5 s 24 $, kúpa za 60 bez peňazí nejde, úroveň 2, manažérka za 1 500 $ zarába sama, interiér: panel otvorený, fasáda zdvihnutá (`translateY(-566px)` pri 390), karta v režime interiéru, ťuknutie (390) a klik myšou (1440) do pôdorysu vyberie Shelves, kúpa Shelves I, späť na ulicu (panel skrytý, fasáda `none`), uloženie 331 B, texty cieľov pre úrovne 1, 9, 10, 24, žiadne chyby v konzole.

## Posluch zvuku (nález 5, len Andrej)

AI zvuk nepočuje; kód syntézy nedokazuje príjemný zvuk. Postup (asi 5 min, slúchadlá alebo reproduktor telefónu na 50 % hlasitosti):
1. Otvor odkaz, ťukni na General Store. Od prvého ťuku má byť počuť **vietor**: tichý šum, ktorý sa pomaly nadúva (cyklus asi 14 s). Otázka: je tichší než ťuk a neruší?
2. Počkaj 10 s bez ťukania: **vŕzganie veterníka** má prísť každých 6 až 12 s, dvojité (hore a dolu). Otázka: neznie ako chyba alebo píšťala?
3. Ťukaj 10-krát rýchlo za sebou na obchod: **ťuk** je krátky drevený klop, pri bežiacom cykle tlmený. Otázka: po 10 ťukoch neunavuje?
4. Nechaj obchod dokončiť cyklus: **minca** je dvojité cinknutie; po najatí manažérky znie len každá tretia. Otázka: nie je ostrá alebo príliš častá?
5. Kúp úroveň (kladivo) a dosiahni úroveň 10 (**míľnik**: tri stúpajúce údery). Otázka: je míľnik zreteľne slávnostnejší než bežná kúpa?
6. Prepni na inú kartu prehliadača alebo zamkni telefón a vráť sa: zvuk musí **stíchnuť hneď** a po návrate sa vrátiť. Otázka: stíchol?
7. Tlačidlo Sound off musí stíšiť všetko do 0,1 s.

Odpoveď stačí áno alebo nie ku každému bodu a jedna veta, čo vadí (otázka 4 v `OTAZKY.md`).

## Slabiny, ktoré viem (pre bránu)

- Nábytok je drahý podľa GDD (3 K, 86 K, 2,5 M ...); v M0 s jedinou budovou si hráč za 10 min kúpi 1 až 2 kusy.
- Zákazník vo výklade je malý (asi 14 px hlava a plecia pri 390 px); obsluhu čítať pomôže otvorenie dverí a vrece v ruke pri odchode, samotný výklad je detail.
- Mince letia z miesta, kde sa pustili; keď hráč počas letu mince (0,75 s) švihne kamerou, minca nejde s ulicou.
- Nový obrázok budovy (míľnik) sa ukáže po dekódovaní, asi 1 až 3 snímky po kliknutí; zvuk míľnika zaznie hneď.
- Veta manažérky je text v karte, portrét nie je (portréty sú M1).
- Na mobile sa obchod od úrovne 100 (balkón) a 300 (tretie poschodie) dotkne hlavičky; v 10-minútovom teste sa tam hráč nedostane.
- Zvuk posluchom NEOVERENÝ, skutočný telefón NEOVERENÝ. Výkon otvoreného interiéru zmeraný (pokus 3), vo Firefoxe jedna snímka 147 až 187 ms raz za reláciu pri kúpe, príčina nepotvrdená (vyššie).
- Ľudia v interiéri sa navzájom neobchádzajú (trasy obchádzajú nábytok, predavača a steny, nie iných zákazníkov); pri rade dvoch pred pultom sa môžu prekryť.
- Pri prázdnom pulte (stupeň 0) stojí predavač za vyznačeným miestom pultu.
