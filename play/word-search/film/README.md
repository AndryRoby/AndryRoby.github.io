# Word Search: film nakreslený kódom

25. 9. 2026, Fable. Stránka `https://arling.sk/play/word-search/film/` (zatiaľ bez odkazov z iných stránok,
nenasadená). Engine: `ops/video/kodfilm/` (kópia v `engine/`, obnoví ju
`node ops/video/kodfilm/kopiruj.mjs products/arling-sk/play/word-search/film`).
Predmet: Android hra Word Search: Calm Word Puzzles (`products/word-search-android`), ešte nie je v Google Play.

## Súbory

| Súbor | Čo je |
|---|---|
| `index.html` | stránka v hube: hlavička, päta, CSP bez vložených skriptov, Umami, JSON-LD (WebPage, MobileApplication, FAQPage), popis scén pre čítačky |
| `film.css` | plátno 16:9 na počítači, 9:16 do 760 px; tlačidlo prehrať v zelenej appky na papieri |
| `strana.js` | vstup stránky (prehrávač s ovládačmi) |
| `render.html`, `render.js` | len plátno na celé okno pre `render.mjs` (noindex) |
| `film.js` | film: doska, časová os, vrstvy, scény, partitúra |
| `pismena.js` | písmená dosky, šesť zvýrazňovačov (prepis `Board.kt` highlight), prst, pilulka s písmenami, načítanie Nunito |
| `nunito-*.woff2`, `nunito-OFL.txt` | písmo appky (Nunito 400, 600, 700; podmnožina Latin cez pyftsubset, 8 KB na rez), licencia OFL |
| `og.jpg` | 1200x630, záverečná snímka zo 16:9 MP4 (19,5 s) |

## Čo je z appky a čo je naše

Z kódu appky: Ink `#203E45`, Paper `#F5F2E9`, Green `#137A68`, osem pásov (`Play.kt:13-22`), biela doska so
zaoblením 22dp (`BoardFrame`), písmená Nunito SemiBold, nájdené písmená biele s obrysom Ink 10 %
(`Board.kt`), ťah v akcente témy s alfou 0,7, zelený kruh pod prstom, pilulka s písmenami nad doskou
(`TracePill`, zelená s bielym textom po nájdení), konfety 36 krížikov (`celebration`), šesť štýlov
zvýrazňovača Classic, Chalk, Glow, Marker, Stitch, Ribbon (`Board.kt:61`, `Wallet.kt:173`), 15 mincí za
bežnú úroveň (`Play.kt:586`), mince sa počítajú nahlas troma ťukmi o dva poltóny vyššie (`Feel.coinTicks`),
50 mincí na začiatku (snímka obchodu `board.png`), texty „Level complete“ a „WORDS TO FIND“.
Slová DAISY, FERN, ROSE, TULIP sú z témy Garden (`ops/games/word-search/themes.tsv`).

Naše: rozloženie dosky 6 x 6 a výplňové písmená (film.js pri načítaní overí, že každé slovo na doske leží),
prst, poradie a smery slov (štyri smery naraz, v hre šikmé od úrovne 4 a pospiatky od 13), zvuky
(syntéza, nie súbory appky), karta bez času a bez čísla úrovne (nevymýšľame čas ani úroveň).
Bonusové slovo SUN (v riadku 2 pospiatky) vzniklo náhodou; v hre by bolo platné bonusové slovo.

## Časová os (20 s)

| Čas | Obraz | Zvuk |
|---|---|---|
| 0 až 1,3 | hák: doska v koncovej polohe, tri slová nájdené, prst už na D ťahom nájde DAISY (0,7 s), písmená stúpnu vo vlne; „Word Search“ (odlesk), „Find a word. Find your flow.“, „Calm word puzzles in 150 topics.“ | dopad, akord C, zvony, tón každého písmena, akord slova |
| 1,15 až 1,9 | text háku odíde, zvýraznenia zhasnú, prázdna doska sa zväčší do polohy príbehu | klesajúce zvončeky |
| 1,6 až 2,05 | hlavička Garden 0/4, WORDS TO FIND, 50 coins, štyri čipy | plocha C |
| 2,2 až 5,0 | „Swipe across the letters to find a word.“; prst nájde TULIP (2,85 až 3,75), pilulka TUL, TULIP | pentatonika nahor, akord |
| 5,1 až 7,9 | „Later levels hide words in all eight directions.“ (appka: úrovne 1 až 3 len vodorovne a zvislo, MainActivity.kt:882); FERN šikmo nahor | plocha Am |
| 7,4 až 9,5 | ROSE nahor, prst sa presunie na D, DAISY; 4/4 | plocha F |
| 9,25 až 12,05 | konfety, karta „Level complete“, „Every word found!“, „+15 coins“ sa napočíta, pruh kapitoly o desatinu, 50 až 65 coins; „Finish a level, earn coins.“ | zvonkohra, tri ťuky mincí |
| 12,15 až 15,45 | „Coins unlock new highlighter styles.“; pásy prejdú Chalk, Marker, Stitch, Ribbon a späť Classic (Glow vypadol, na telefóne pôsobil ako rozmazanie), pilulka s menom štýlu | švih a tón pri každom štýle |
| 15,55 až 20 | doska do koncovej polohy (zloženie ako hák, film ide v slučke), vlna po písmenách, názov, vety, zelené tlačidlo „Coming soon to Google Play“ (odkaz na `#about`, nie do obchodu), tiráž | akord C, zvony |

Plagát (`film.plagat`) je 1,0 s: DAISY práve nájdené, prst preč, názov čitateľný. Tlačidlo prehrať je nad
stredom dosky.

Rozloženie: 9:16, 4:5 a 1:1 pod sebou (hlavička, doska, zoznam slov, titulok), 16:9 doska vľavo a všetko
ostatné v pravom stĺpci. Pri 9:16 je všetok text v pásme x 12 až 88 % a y 8 až 80 % (overené snímkami so
zónami). Prst pri ťahu v riadku 5 krátko prekryje čipy pod doskou; je to skutočná ruka nad hrou, nie text.

## Render (25. 9. 2026, `ops/video/out/kodfilm/word-search/`)

`node ops/video/kodfilm/render.mjs --url http://127.0.0.1:8871/play/word-search/film/render.html --nazov word-search --snimky 0,0.6,1.0,1.6,3.3,6.0,8.0,10.5,13.2,17.0,19.5 --harok --fps 30 --out ops/video/out/kodfilm/word-search`

| Súbor | Rozmer | Dĺžka | Hlasitosť (ffmpeg loudnorm) | Veľkosť |
|---|---|---|---|---|
| `word-search-1080x1920.mp4` | 9:16 | 20,000 s | -14,3 LUFS, špička -1,7 dBTP | 10,6 MB |
| `word-search-1920x1080.mp4` | 16:9 | 20,000 s | -14,3 LUFS, špička -1,9 dBTP | 10,5 MB |
| `word-search-1080x1080.mp4` | 1:1 | 20,000 s | -14,3 LUFS, špička -1,7 dBTP | 6,8 MB |
| `word-search-1080x1350.mp4` | 4:5 | 20,000 s | -14,3 LUFS, špička -1,7 dBTP | 8,0 MB |

H.264 yuv420p 30 fps, AAC 48 kHz (ffprobe). Hárky `word-search-<formát>-harok.png` (11 snímok). Všetky štyri
MP4 sa zapísali celé (posledný o 20:51), ale `render.mjs` potom visel pri `browser.close()` (Chrome už nebežal)
a ukončil ho až môj časový limit, takže JSON s časmi rendra nevypísal. Rovnaká chyba ako pri Hedgehogs.

## Výkon (zmerané 25. 9. 2026, `ops/video/kodfilm/meraj.mjs`, headless Chrome, PC s 16 vláknami)

CPU = prírastok TaskDuration hlavného vlákna za sekundu (percento jedného jadra). Headless Chrome beží na 75 Hz.

| Scenár | Pokoj pred ťuknutím | Prehrávanie (6 s) | Mimo obrazovky | Po konci |
|---|---|---|---|---|
| Mobil 390x844, DPR 2 | 0,1 %, rAF stojí | 7,5 % CPU, 74,9 fps, interval p95 13,5 ms, max 13,9 ms, kresba 0,35 ms (max 0,9) | 0,0 %, rAF stojí | 0,0 %, rAF stojí |
| Počítač 1440x900, DPR 1 | 0,1 % | 7,9 % CPU, 74,9 fps, p95 13,5 ms, kresba 0,35 ms (max 1,1) | 0,0 % | 0,0 % |
| Mobil so spomalením CPU 6x | 0,1 % | 68,6 % CPU, 74,9 fps, p95 13,5 ms, max 13,6 ms, kresba 3,8 ms (max 8,8) | 0,2 % | 0,1 % |
| Znížený pohyb | 0,1 %, statický plagát, film len na tlačidlo | | | |

Oproti Prism 5 (0,18 ms na snímku) kreslí Word Search asi dvakrát dlhšie: zvýraznenia (4 slová, pri Chalk a
Stitch s pomlčkami) a 36 písmen sú ťahy a drawImage každú snímku, lebo sa v príbehu stále menia. Snímky
nepadajú ani pri 6x pomalšom procesore. Ďalší krok, ak by bolo treba: statickú dosku s hotovými
zvýrazneniami (koniec 16,35 až 20 s) kresliť raz do vrstvy. Prvé meranie so spomalením 6x skončilo na mojom
časovom limite 140 s bez výsledku, druhé s limitom 280 s prešlo.

Veľkosť: JavaScript 93 KB, gzip 35 KB (film.js 13 KB, pismena.js 3,5 KB, engine 18 KB), písmo 3 x 8 KB,
`og.jpg` 67 KB.

Stránka (`ops/video/kodfilm/over-stranku.mjs`): bez chýb na mobile aj počítači; odkaz nad tlačidlom pri
prejdení myšou farba rgba(0,0,0,0), bez podčiarknutia, kurzor pointer; pri Tab rámik 3 px.

## Pre Fable pri nasadení

- Odkaz na film z `play/` (a neskôr zo stránky hry), sitemap a llms.txt.
- `play/word-search/` nemá vlastnú stránku, len `privacy/`; film preto odkazuje na `#about` na sebe.
- `film.css?v=1`, `strana.js?v=1`; film.js, pismena.js a engine sa importujú bez verzie.
