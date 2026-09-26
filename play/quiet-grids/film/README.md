# Quiet Grids: film nakreslený kódom

26. 9. 2026, agent pre Fabla. Stránka `https://arling.sk/play/quiet-grids/film/` (zatiaľ bez odkazov z iných
stránok, nenasadená, nerenderovaná). Engine: `ops/video/kodfilm/` (kópia v `engine/`, obnoví ju
`node ops/video/kodfilm/kopiruj.mjs products/arling-sk/play/quiet-grids/film`).
Predmet: Android appka Quiet Grids: 11 Logic Games (`products/hlavolamy-android`, balík `sk.arling.quietgrids`),
ešte nie je verejne v Google Play.

## Súbory

| Súbor | Čo je |
|---|---|
| `index.html` | stránka v hube: hlavička a päta hubu, CSP bez vložených skriptov, Umami, JSON-LD (WebPage, MobileApplication, FAQPage), canonical na seba, robots index, textový popis scén |
| `film.css` | plátno 16:9 na počítači, 9:16 do 760 px; tlačidlo prehrať v zelenej appky na papieri |
| `strana.js` | vstup stránky (prehrávač s ovládačmi) |
| `render.html`, `render.js` | len plátno na celé okno pre `render.mjs` (noindex); `?zaver=google-play` alebo `?zaver=obchod` prepne záver |
| `film.js` | film: časová os, rozloženie 4 formátov, kreslenie troch dosiek, ťahy prsta, zoznam jedenástich typov, partitúra, prepínač záveru |
| `hlavolamy.js` | tri zadania ako doslovné riadky banky appky a prepis `Unpack.kt`, `Puzzles.kt` (Paths, Bridges, PictureGrid) a `Hint.kt` (reťazec) |
| `kresby.js` | paleta, texty v Nunito, znak typu (disk a hlava zvieraťa, prepis `Ui.kt animalHead`), sprite prsta |
| `test.mjs` | test bez prehliadača (falošné 2D plátno): `node products/arling-sk/play/quiet-grids/film/test.mjs` |
| `nunito-*.woff2`, `nunito-OFL.txt` | písmo appky (Nunito 400, 600, 700; podmnožina Latin, rovnaké súbory ako vo filme Word Search, TTF appky má rovnaký sha256), licencia OFL |

Chýba (robí Fable): `og.jpg` 1200x630 (záver zo 16:9 MP4, napríklad 17,9 s), kontrolné snímky, render, meranie
výkonu. CSP hash v `index.html` je zatiaľ prevzatý z Word Search; opraví ho skript hubu pred nasadením
(pri filme Duel to urobil sám, 26. 9. 15:07).

## Zadania (skutočné, z banky appky)

| Typ | Zadanie | Riadok banky | Ťah vo filme | Prečo je to skutočný ťah |
|---|---|---|---|---|
| Herons (Numberlink) | 2. 9. 2026, medium, 6 x 6, 5 párov | `assets/bank/herons.txt:17` | posledná cesta páru 2 (žltá): z bunky 32 pozdĺž spodku, hore pravým okrajom a hore doľava do hniezda v bunke 2, 11 krokov | bunky sú krok 10 reťazca Hintu appky (`cell-needs-all`); ostatné cesty sú hotové, test prehľadá všetky priradenia párov týmto 10 bunkám a nájde práve jedno riešenie |
| Cranes (Hashi) | 26. 8. 2026, medium, 9 x 9, 18 ostrovov | `assets/bank/cranes.txt:10` | ťah 3 -> 4 -> 2 (ostrovy v (0,6), (0,8), (2,8)) dvakrát: dvojité mosty z rohovej 4 | prvý krok reťazca Hintu appky: `all-double` na páry 3-4 a 4-8 s hodnotou 2 (rohová 4 má len dvoch susedov, 4 = 2 + 2); zhoduje sa s riešením v banke |
| Magpies (Nonogram) | 24. 8. 2026, easy, 8 x 8 | `assets/bank/magpies.txt:8` | dolný riadok zľava doprava (8 políčok), potom pravý stĺpec zdola nahor od prázdneho políčka (7) | nápoveda riadku aj stĺpca je 8 pri šírke 8, takže sú celé plné; test overí, že tie políčka sú v riešení |

Každé zadanie test porovná s riadkom súboru banky a overí pravidlami appky (`isSolved` prepísané z Kotlinu).
Generátor prijal len zadania s jediným riešením (`Puzzles.kt`, hlavička rozhrania Puzzle; store listing: „Every
board has exactly one answer, checked by a solver before the app was packed“).

## Časová os (18,3 s, 30 fps)

| Čas (s) | Obraz | Zvuk |
|---|---|---|
| 0 až 1,3 | hák: hotová mriežka Herons na bielej karte (menšia poloha), svetlý lesk po nej od snímky 0; „Quiet Grids“ s odleskom, „Draw, reason, solve.“, „No countdowns, no rush.“ | akord a zvony háku (A), zvonkohra vyriešenej dosky (board_chime) |
| 1,15 až 1,95 | text háku odíde, doska prejde do polohy príbehu, žltá cesta sa zmotá späť k bunke 32; hlavička „Herons / Numberlink“ so znakom | klesajúce glissando |
| 1,95 až 4,95 | titulok „Join each pair and fill every square.“; prst príde (2,0), ťahá cestu 2,45 až 3,65, zelený ťah pod prstom (GreenDeep .70), pustí 3,7, cesta zožltne, lesk | 12 tónov marimby po stupnici nahor, zvonkohra vyriešenej dosky |
| 4,95 až 8,65 | Cranes / Hashi, titulok „Each island takes the number of bridges it shows.“; ťah 6,0 až 6,7 (jednoduché mosty), znova 7,25 až 7,85 (dvojité); rohová 4 a 2 pod ňou zozelenejú (ostrov má všetky mosty) | 2 x 3 tóny ťahu |
| 8,65 až 11,9 | Magpies / Nonogram, titulok „The clues count the filled blocks in order.“; dolný riadok 9,55 až 10,35 a vlna hotovej jednotky, pravý stĺpec 10,85 až 11,45 a vlna | 8 tónov, akord jednotky, 7 tónov, akord |
| 11,85 až 14,4 | jedenásť typov: znak, meno a klasický názov, riadky naskočia po jednom; titulok „Eleven logic puzzles a day.“ | tiché tóny po stupnici (film) |
| 14,45 až 18,3 | zoznam zmizne do 14,35, hotová mriežka Herons sa vráti do polohy konca (zloženie ako hák) a dosadne v 15,0, lesk; až potom texty bez masky (rozžiaria sa a zdvihnú o najviac 12 px): 15,05 „Quiet Grids“, 15,4 veta, 15,7 druhá veta, 16,0 „Coming soon to Google Play“ (bez pilulky a bez ▶), 16,35 „arling.sk“ | akord a zvony názvu, jemná zvonkohra |

Plagát (`film.plagat`) je 1,0 s: hotová mriežka a čitateľný názov, tlačidlo prehrať nad stredom dosky.

Rozloženie: 9:16, 1:1 a 4:5 pod sebou, ale naopak ako Word Search: navrchu titulok a hlavička, pod nimi doska,
lebo prst prichádza sprava zdola a jeho ruka tak nikdy neprejde cez text (test to stráži). Na konci a v háku je
navrchu blok názvu a pod ním doska. 16:9 doska vľavo, text vpravo, prst zľava zdola. Čísla rozloženia vypíše
`node products/arling-sk/play/quiet-grids/film/test.mjs --rozlozenie` (9:16: doska 821 px, bunka Herons 134 px,
Cranes 89 px, Magpies 81 px).

## Prepínač záveru (deň spustenia)

`film.js`: `ZAVER_PREDVOLENY = 'coming-soon'`; `coming-soon` (odkaz `#about`), `google-play` („Get it on Google Play“,
odkaz `https://play.google.com/store/apps/details?id=sk.arling.quietgrids`, až keď stránka obchodu vráti 200),
`obchod` („Plays offline. No account.“, do záznamu v Google Play bez výzvy). Render bez zmeny kódu:
`render.html?zaver=google-play`. Film nekreslí napodobeninu odznaku Google Play.

## Čo je z appky (zdroj) a čo je naše

Cesty sú v `products/hlavolamy-android/app/src/main/java/sk/arling/quietgrids/`, ak nie je uvedené inak.

| Fakt vo filme | Zdroj |
|---|---|
| Ink `#203E45`, Paper `#F5F2E9`, Green `#137A68`, GreenDeep `#0F6355`, tlmený text Ink .78, značka Ink .64 | `core/Layout.kt:314-338` |
| farby jedenástich typov (a farby párov v Paths) | `core/Layout.kt:350-352` |
| papier Paper: karta biela, akcent `#9FDAC7` | `core/Shop.kt:30` |
| karta dosky s rohom 20 dp, obrys Ink .08, vankúš 4 dp | `BoardScreen.kt:250-252`, `core/Layout.kt:44` |
| hlavička: meno zvieraťa a klasický názov | `BoardScreen.kt:196-201`, `core/Names.kt:28-43` |
| Paths: pás .30 bunky vo farbe páru, hniezdo biele s obrysom 2,4 dp a číslom .46 bunky, tenká mriežka Ink .18 | `BoardScreen.kt:1447-1479`, `BoardScreen.kt:1148-1156` |
| Bridges: most GreenDeep 3,5 dp, dvojitý posunutý o .11 bunky, ostrov biely s obrysom 2,4 dp, hotový ostrov obrys GreenDeep a číslo tlmené | `BoardScreen.kt:1538-1572` |
| ťah cez viac ostrovov pridá most každej dvojici, druhý ťah z neho urobí dvojitý | `core/Input.kt:271-285` |
| Picture Grid: nápovedy v páse, plné políčko perom Round (kruh .42 bunky v akcente), čiary .18 a hrubé .5 pri piatej | `BoardScreen.kt:1309-1379`, `Ui.kt:359-373`, `core/Shop.kt:47`, `core/Shop.kt:99` |
| ťah pod prstom: GreenDeep .70, šírka .18 bunky (most 3,4 dp), krúžok na hlave a začiatku, svetlý kruh pod prstom; po pustení usadenie 120 ms | `BoardScreen.kt:1077-1117`, `core/Layout.kt:389` |
| vlna hotovej jednotky: akcent .45 po políčkach, spolu najviac 320 ms | `BoardScreen.kt:1122-1135`, `core/Layout.kt:396`, `core/Layout.kt:422` |
| ktorá jednotka je hotová (riadok a stĺpec Picture Grid; Paths a Bridges vlnu nemajú) | `core/Feel.kt:253-309` |
| zvuk: marimba (čiastkové tóny 1, 3,94, 9,2), cell_tone A4 120 ms, unit_chord A4 E5 A5 420 ms, board_chime A4, C#5, E5 900 ms | `ops/games/hlavolamy/zvuky.mjs:27-122` |
| kedy znie: prvé políčko ťahu o oktávu nižšie, každé ďalšie o stupeň pentatoniky vyššie, jednotka akord, vyriešenie zvonkohra | `core/Feel.kt:130-141`, `core/Feel.kt:203-211`, `GridSounds.kt` (begin, step) |
| znak typu: disk vo farbe typu a hlava zvieraťa | `Ui.kt:181-201`, `Ui.kt:225-355` (kresba v kóde) |
| vety titulkov Herons, Cranes, Magpies (karta RULE) | `core/Teach.kt:44`, `:52`, `:56` |
| „Eleven logic puzzles a day.“, „Draw, reason, solve.“, „no rush“ | `ops/games/hlavolamy/store-listing-en.md:17` |
| „No countdowns“ | `ops/games/hlavolamy/store-listing-en.md:67` |
| „Plays offline. No account.“ (verzia do obchodu) | `ops/games/hlavolamy/store-listing-en.md:25` („nothing needs the internet to play“), `:69` |
| mená a klasické názvy jedenástich typov | `core/Names.kt:28-43` |
| stránka: o polnoci UTC jedenásť nových dosiek, posledných 30 dní v kalendári, nič nepotrebuje internet | `ops/games/hlavolamy/store-listing-en.md:25` |
| stránka: každá doska má práve jedno riešenie, overené riešiteľom pred zabalením | `ops/games/hlavolamy/store-listing-en.md:25`, `core/Puzzles.kt:57-61` |
| stránka: Check a Hint sú zadarmo a nikdy nevpíšu políčko | `ops/games/hlavolamy/store-listing-en.md:49`, `BoardScreen.kt` (nástroj Hint, komentár 22. 9. 2026) |
| stránka: bez účtu | `ops/games/hlavolamy/store-listing-en.md:69` |
| stránka: zásady ochrany súkromia už zverejnené | `products/arling-sk/play/quiet-grids/privacy/index.html` |

Naše: prst, lesk po hotovej doske, spätný chod žltej cesty, poradie ťahov a ich časy, zoznam jedenástich typov
ako obraz (v appke sú to dlaždice Today v dvoch stĺpcoch), hudba filmu pod zvukmi appky.

Vedomé zjednodušenia (len vynechávajú alebo zväčšujú, nič nepridávajú):
- Znak typu je záložná hlava zvieraťa z kódu (`Ui.kt animalHead`); appka pri type, ktorý má kresbu, ukazuje
  Andrejovu kresbu (PNG). Stránka to hovorí.
- Bez panela nástrojov (Undo, Redo, Check, Hint, Open 1), bez hodín a mincí v hlavičke, bez karty Finished
  po vyriešení (karta má čas riešenia a mince; vymyslený čas by bolo falošné číslo). Vyriešenie nesie zvonkohra
  appky a filmový lesk.
- Čísla na doskách a nápovedy sú najmenej 36 px vo videu 1080 px; pás nápovied Magpies je preto širší ako
  v appke (150 px namiesto najviac sedminy dosky).

## Test (bez prehliadača)

`node products/arling-sk/play/quiet-grids/film/test.mjs` (26. 9. 2026: zelený)

- 4 formáty x 550 snímok (0 až 18,3 s po 1/30 s), plus závery `google-play` a `obchod` od 13,8 s,
- žiadna výnimka, žiadne NaN, save a restore v páre, záporné polomery a zlé prechody hádžu ako v prehliadači,
- každý text (aj zapečený v sprite, s clipom) v zóne `zona(W, H)`, najmenšie písmo 36,1 px (minimum 36),
- prst nikdy neprekryje text mimo dosky (titulky, hlavičky, názov, záver),
- záver 14,4 až 18,3 s: žiadny text mimo dosky sa nedotkne obdĺžnika viditeľnej dosky a žiadny nie je napoly
  zamaskovaný (oprava po renderi 26. 9.: „arling.sk“ vystupoval spoza masky tesne nad doskou a pôsobil zakrytý),
- partitúra (69 udalostí) v čase 0 až 18,3 s, známe nástroje; titulky s časom čítania slová / 3 + 0,5 s,
- bez pomlčiek em a en,
- tri zadania = doslovné riadky banky appky, riešenia prejdú pravidlami appky, ťah Herons ide po susedných
  bunkách a je krok 10 reťazca, doplnenie je jediné (prehľadanie), prvý krok reťazca Cranes je all-double 3-4 a
  4-8, riadok a stĺpec Magpies majú nápovedu 8.

## Pre Fable

1. Kontrolné snímky so zónami (server nad `products/arling-sk` na 8871):
   `node ops/video/kodfilm/render.mjs --url http://127.0.0.1:8871/play/quiet-grids/film/render.html --nazov quiet-grids --snimky 0,1.7,3.0,7.95,11.6,13.2,14.7,15.2,16.0,16.5,17.0,18.2 --harok --zony --bez-videa --out <scratchpad>/filmy/qg2`
   Po oprave záveru (26. 9.): 14,7 doska sa vracia bez textu, 15,2 až 17,0 texty sa rozžiaria nad usadenou doskou
   bez masky, 16,5 „arling.sk“ celý nad doskou.
   Pozrieť hlavne: 1,7 (prechod háku, názov a doska, spätný chod cesty), 3,0 (ťah pod prstom), 7,95 (dvojité
   mosty, zelené ostrovy), 10,0 a 11,6 (Magpies, vlna), 13,2 (zoznam jedenástich, šírky mien), 15,2 (záver).
2. Render všetkých 4 formátov (na pozadí, nič iné ťažké popri tom):
   `node ops/video/kodfilm/render.mjs --url http://127.0.0.1:8871/play/quiet-grids/film/render.html --nazov quiet-grids --snimky 0,1.0,3.0,7.95,11.6,13.2,18.2 --harok --fps 30 --out ops/video/out/kodfilm/quiet-grids`
   Deň spustenia: `--url ...render.html?zaver=google-play --nazov quiet-grids-google-play`; do záznamu obchodu
   `--url ...render.html?zaver=obchod --nazov quiet-grids-obchod --formaty 1920x1080`.
3. `og.jpg` 1200x630 zo 16:9 MP4 pri 17,9 s; potom `over-stranku.mjs` a `meraj.mjs` a výsledky sem.
4. Nasadenie: odkaz z `play/`, sitemap, llms.txt; `play/quiet-grids/` nemá stránku appky (len `privacy/`),
   preto `#about`. `test.mjs` stránka nenačíta, pri nasadení ho možno vynechať.
