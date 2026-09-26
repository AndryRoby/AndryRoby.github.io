# Duel: film nakreslený kódom

26. 9. 2026, agent pre Fabla. Stránka `https://arling.sk/play/duel/film/` (zatiaľ bez odkazov z iných stránok,
nenasadená, nerenderovaná). Engine: `ops/video/kodfilm/` (kópia v `engine/`, obnoví ju
`node ops/video/kodfilm/kopiruj.mjs products/arling-sk/play/duel/film`).
Predmet: Android hra Duel: 2 Player Party Games (`products/duel-android`, balík `sk.arling.duel`), ešte nie je
verejne v Google Play (`ops/video/kodfilm/DOSTUPNE-V-OBCHODE.md`).

## Súbory

| Súbor | Čo je |
|---|---|
| `index.html` | stránka v hube: hlavička a päta hubu, CSP bez vložených skriptov, Umami, JSON-LD (WebPage, MobileApplication, FAQPage), canonical na seba, robots index, textový popis scén |
| `film.css` | plátno 16:9 na počítači, 9:16 do 760 px; tlačidlo prehrať v accent `#FFD23F` |
| `strana.js` | vstup stránky (prehrávač s ovládačmi) |
| `render.html`, `render.js` | len plátno na celé okno pre `render.mjs` (noindex); `?zaver=google-play` alebo `?zaver=obchod` prepne záver |
| `film.js` | film: časová os, rozloženie 4 formátov, obrazovka telefónu v dp, kolá, moment výsledku, palce, partitúra, prepínač záveru |
| `kresby.js` | tokeny farieb, prepis ikon z `Icons.kt`, sprity textu v Nunito, sprite palca (dve ruky), načítanie písma |
| `test.mjs` | test bez prehliadača (falošné 2D plátno): `node products/arling-sk/play/duel/film/test.mjs` |
| `nunito-*.woff2`, `nunito-OFL.txt` | písmo appky (Nunito 400, 600, 700; podmnožina Latin, rovnaké súbory ako vo filme Word Search, TTF všetkých troch appiek majú rovnaký sha256), licencia OFL |

Chýba (robí Fable): `og.jpg` 1200x630 (záver zo 16:9 MP4, napríklad 18,6 s), kontrolné snímky, render, meranie výkonu.

## Časová os (19 s, 30 fps)

| Čas (s) | Obraz | Zvuk |
|---|---|---|
| 0 až 1,3 | hák začína v okamihu rozsvietenia (kolo White Flash sa rozhodlo 0,25 s pred snímkou 0: záblesk v −0,50, Orange ťukol v −0,27, teda 231 ms): na snímke 0 už svieti oranžová polovica (výplň, dva sústredné obrysy 12 dp .18 a 6 dp, rozjasnený pás), na nej pilulka „Lightning thumbs!“ a „231 ms“ v hornej tretine, modrá polovica stmavnutá s „Just a blink late“, doznievajúce vlnky pod palcami, palce sa práve zdvíhajú z padov a odchádzajú; 0,35 až 0,75 +1 letí z hlášky do oranžovej bodky; názov „Duel“ s odleskom, „One phone. Two thumbs.“, „27 mini-games. Plays offline.“ | akord a zvony háku a výhra kola (akord appky na C a G) na snímke 0 |
| 1,15 až 1,9 | text háku odíde, telefón sa zväčší do polohy príbehu | švih |
| 1,9 až 3,3 | karty kola 1 ostávajú; titulok „Lay the phone flat between you.“ | plocha C |
| 3,3 až 4,8 | Odd One Out: ikona a názov na oboch polovicách, na oranžovej navyše „Match point“ | tón intra kola 2 |
| 4,8 až 6,3 | odpočet: tri svetlá v pruhu po 375 ms, „Ready“, „Set“, „Go!“; titulok „Both halves get the same round.“ | tri tiky, tón Go |
| 6,3 až 7,26 | mriežka 3 x 3 šípok (jedna iná o 78,75°); oranžový palec zaváha nad dolnou pravou, 7,24 ťukne na zlú šípku v strednom rade (940 ms); modrý palec sa blíži k správnej | tik |
| 7,26 až 9,06 | modrá polovica sa rozsvieti s pruhmi, oranžová stmavne; oba palce do 7,55 odídu z telefónu; od 7,41 zelený prstenec na správnej šípke (horná tretina) na oboch polovicách a červený krížik na zlej (stredný rad); od 7,61 pilulky „Look first, tap second“ a „Cool as ice“ v dolnej tretine; 7,86 až 8,26 +1 do modrej bodky (1 : 1); titulok „A wrong tap gives the point away.“ | tón prehry, o 300 ms výhra |
| 9,06 až 10,56 | Bigger Circle, na oboch polovicách „Decider!“ | tón intra kola 3, plocha F |
| 10,56 až 12,06 | odpočet; titulok „27 quick games for two players.“ | tri tiky, Go |
| 12,06 až 12,66 | zelený a väčší fialový kruh; 12,64 Orange ťukne na väčší (580 ms), Blue sa ešte len blíži | tik |
| 12,66 až 15,26 | rozsvietenie oranžovej, palce do 12,95 preč, od 12,81 prstenec na väčšom kruhu, od 13,01 „Nailed it!“ a „580 ms“, „Almost!“ v dolnej tretine (mimo kruhov); 13,26 až 13,66 +1 do druhej oranžovej bodky (2 : 1); posledné kolo drží 2,6 s | výhra kola |
| 15,26 až 19 | obrazovka výsledku: „Winner“ a „2 : 1“ dole, „So close“ a „1 : 2“ hore, dve tlačidlá Rematch, konfety (písmo väčšie ako v appke, aby sa dalo prečítať aj v menšom telefóne); 15,45 až 16,05 sa telefón zmenší do polohy konca (zloženie ako hák); 16,05 „Duel“, 16,3 veta, 16,5 druhá veta, 16,75 „Coming soon to Google Play“ (bez pilulky a bez ▶), 17,1 „arling.sk“ | zvonkohra konca zápasu (level_chime), akord a zvony názvu |

Plagát (`film.plagat`) je 0,9 s: oranžová polovica svieti, hláška a čas čitateľné, +1 práve doletelo, názov
čitateľný. Tlačidlo prehrať je nad stredom hornej (stmavnutej) polovice.

Hlášky (vizual-spec 3.6, QuipPlacement): pilulka surface s rohom 16 dp v hornej tretine polovice hráča (pri páse);
ak tam leží zvýraznená odpoveď, ide do dolnej tretiny. Pri White Flash horná (dolu je pad), pri Odd One Out a
Bigger Circle dolná. Ukáže sa 0,35 s po rozhodnutí (appka 200 ms), aby palec, ktorý ťukol, stihol odísť;
alfa pilulky .92 namiesto .85, aby cez ňu vo videu nepresvitali šípky.

Obrazovka telefónu je 360 x 700 dp, najnižšie okno bez kompaktného rámu (`Frame.kt:128` COMPACT_BELOW_DP = 700),
aby bol telefón v 9:16 široký 667 px (81 % zóny, predtým 620) a pás hráča ostal 12 dp.

Rozloženie: 9:16 a 4:5 pod sebou (telefón, pod ním titulky; na konci a v háku menší telefón a pod ním blok
názvu), 16:9 a 1:1 telefón vľavo a text vpravo. Palce na výšku prichádzajú zboku (Orange sprava, Blue zľava,
bodová súmernosť cez stred ako sedia hráči), na šírku zdola a zhora. Čísla rozloženia vypíše
`node products/arling-sk/play/duel/film/test.mjs --rozlozenie` (9:16: telefón v príbehu 667 x 1264 px (horný
rámik siaha 30 px nad zónu, text v telefóne je v zóne), na konci a v háku 518 x 982 px (predtým 423), 1,755 px na
dp; hlášky kola 1 v háku 42 px, v príbehu 54 px, kolá 2 a 3 42 px; na konci Winner 50 px, skóre 92 px, Rematch
46 px vo videu).

## Prepínač záveru (deň spustenia)

`film.js`: `ZAVER_PREDVOLENY = 'coming-soon'`. Tri verzie, každá prejde testom:

| Verzia | Text záveru | Odkaz nad textom | Kedy |
|---|---|---|---|
| `coming-soon` | Coming soon to Google Play | `#about` na tej istej stránke | dnes |
| `google-play` | Get it on Google Play | `https://play.google.com/store/apps/details?id=sk.arling.duel` | až keď verejná stránka obchodu vráti 200 |
| `obchod` | No account. Nothing to buy. | `#about` | video v samotnom zázname Google Play (bez výzvy a bez „coming soon“) |

Render bez zmeny kódu: `render.html?zaver=google-play`. Film nekreslí napodobeninu odznaku Google Play (odznak sa
nesmie meniť); ak má byť v zázname oficiálny odznak, pridá ho Fable ako obrázok podľa
https://play.google.com/intl/en_us/badges/ a povie to v README.

## Čo je z appky (zdroj) a čo je naše

Cesty sú v `products/duel-android/app/src/main/java/sk/arling/duel/`, ak nie je uvedené inak.

| Fakt vo filme | Zdroj |
|---|---|
| farby chrómu bg `#101116`, surface `#1B1D27`, text `#FFF6E5`, textMuted `#B8B5C8`, accent `#FFD23F`, onAccent `#1A1400`, good `#3DDC97`, bad `#FF5C7A`, p1 `#FF9F1C`, p2 `#3DA5FF`, outline `#3A3E52` | `Ui.kt:12-28` |
| hráč 1 = kruh, hráč 2 = kosoštvorec, veľké plochy hráča 2 so šikmými pruhmi 45° | `Ui.kt:37-44`, `Icons.kt:224-225`, `MainActivity.kt:1197-1209` |
| téma dosky night: panel `#1C1E2A`, paper `#FFF6E5`, zelená `#3DDC97`, warm `#FFD23F`, cool `#7CC4FF`; Ink.PURPLE `#B79CFF`, Ink.WHITE biela | `Draw.kt:29`, `Draw.kt:41`, `Draw.kt:51` |
| písmo Nunito; veľkosti headlineMedium 22, headlineLarge 28, displayMedium 40, displayLarge 64, titleLarge 18, bodyLarge 16 sp | `MainActivity.kt:498-513` |
| obrazovka: pás v strede 10 % výšky, dve zrkadlové polovice, horná otočená o 180° | `MiniGame.kt:307-323` |
| rám dosky: okraj pri hráčovi 12 dp, pri páse 8 dp, bočný 8 dp; pás hráča v okraji, pri dotyku jas .45 -> .85 na 220 ms | `Frame.kt:29-31`, `MainActivity.kt:1286-1290` |
| pad TAP pri hrách na celú polovicu: 26 % dosky (najmenej 64 dp, najviac 34 %), výplň .22, obrys 2 dp, tvar hráča a slovo TAP | `Frame.kt:204-235`, `Draw.kt:107-135` |
| bodky skóre 12 dp, medzera 6, 16 dp od okraja, každý hráč pri svojom ľavom okraji; prázdna bodka = obrys 2 dp s alfou .5 | `MainActivity.kt:1495-1514` |
| odpočet 1500 ms, štyri doby: tri svetlá (polomer 7 dp, rozostup 22 dp) a Go; slová Ready, Set, Go! | `Ui.kt:178`, `Ui.kt:212-220`, `MainActivity.kt:1446-1451`, `MainActivity.kt:1518-1529`, `Words.kt:102-104` |
| vlnka pod palcom: polomer 18 -> 34 dp, alfa .35 -> 0 za 300 ms | `MainActivity.kt:1321-1326` |
| moment výsledku: zmrazená doska, záblesk .20 na 120 ms, rozsvietenie víťaza (nábeh 60 ms na .45, doznenie 400 ms na .30, dýchanie ±.04 pri 1,2 Hz), stmavenie porazeného na .55 za 250 ms, prstenec správnej odpovede (good 4 dp) a krížik zlého ťuku (bad), hláška na karte surface .85 s rohom 16 dp, +1 letí 400 ms do bodky | `ops/games/duel/vizual-spec.md` časť 3.5 a 3.6; v kóde `MainActivity.kt:1303-1309` (obrys 6 dp, stmavenie .55), `MainActivity.kt:1553-1576` (prstenec a krížik), `MainActivity.kt:1460-1469` (karta) |
| pauza po kole 1800 ms, po poslednom 2600 ms | `Ui.kt:181-183` |
| ťuk po rozhodnutí (okno remízy 20 ms) sa nepočíta, zlý ťuk dá bod súperovi | `Duel.kt:11`, `Round.kt:50-73`, `Round.kt:95` |
| zápas na 2 výhry (voľba Length „First to 2“): `Rules.target(3) = 2` | `Duel.kt:17`, `Words.kt:56` |
| „Match point“ na polovici hráča, ktorému chýba jedno kolo; „Decider!“ pri 1 : 1 | `MainActivity.kt:1416-1427`, `Words.kt:131-132` |
| White Flash: tmavý panel, po čakaní biely; ikona | `Light.kt:9-50`, `Icons.kt:182` |
| Odd One Out: kolo 2 = mriežka 3 x 3 (`GRID[1]`), rozdiel `ratio(90, 45, 2)` = 78,75°, všetky ostatné šípky rovnako, šípka = čiara a hrot ťahom 5 dp; ikona | `OddOne.kt:39-51`, `OddOne.kt:95`, `Draw.kt:241-250`, `Icons.kt:195` |
| Bigger Circle: kolo 3 = plocha menšieho menšia o `ratio(.55, .17, 3)` = 36 %, väčší .32 až .38 dosky, x .28 a .72, y .46, zelený a fialový; ikona | `Bigger.kt:149-168`, `Icons.kt:188` |
| metriky „231 ms“ a „580 ms“ = `plainTime` času ťuku od začiatku | `MiniGame.kt:110-115`, `Light.kt:63-66`, `Bigger.kt:195-198` |
| hlášky „Lightning thumbs!“, „Nailed it!“, „Cool as ice“ (WIN), „Look first, tap second“ (MISTAKE), „Just a blink late“, „Almost!“ (SLOWER) | `Result.kt:53-72` (sady), `Result.kt:95-102` (výber nálady) |
| obrazovka výsledku: polovica víťaza .30, „Winner“, „So close“, skóre „2 : 1“ a „1 : 2“ v displayMedium vo farbe hráča, Rematch 72 dp v accent s ikonou odvety, konfety 30 kúskov za 2600 ms vo farbách témy | `MainActivity.kt:1653-1698`, `MainActivity.kt:1700-1731`, `Wallet.kt:24-35`, `Words.kt:135-138`, `Icons.kt:232` |
| zvuky: tón C5 0,32 s, akord C5 E5 G5 0,65 s, zvonkohra 1,2 s, sínus s oktávou 12 %, nábeh 8 ms, doznievanie e^(-5x) | `ops/games/word-search/prepare-sounds.py:6-22`, WAV v `app/src/main/res/raw/` (README appky: tie isté ako Word Search) |
| kedy znejú: intro kola na pentatonike (index kolo + 2), tri tiky a tón Go, tik pri ťuku, výhra = akord na C a G naraz, prehra tón o kvartu nižšie a o 300 ms výhra, koniec zápasu zvonkohra | `DuelSounds.kt:11-28`, `DuelSounds.kt:53-59`, `MainActivity.kt:249`, `MainActivity.kt:262-264`, `MainActivity.kt:337-341`, `MainActivity.kt:362`, `MainActivity.kt:409-411` |
| „Lay the phone flat between you“ | `Words.kt:100` |
| „One phone. Two thumbs.“, „Both halves get the same round.“ (appka: „dealt the same task from the same seed“), „27 mini-games“, „No account. Nothing to buy.“ | `ops/games/duel/store-listing-en.md:38`, `:55`, `:42`, `:73` |
| „Plays offline“ | `Words.kt:187` („It plays offline on one phone, with no account.“) |
| „27 quick games for two players“ | `ops/games/duel/store-listing-en.md:114` (What's new 0.1.5) |
| „A wrong tap gives the point away.“ | `Round.kt:95` a `RuleBook.kt:7` (odznak „Wrong tap loses“) |
| stránka: zápas na 2, 3 alebo 5 vyhratých kôl | `Words.kt:56`, `ops/games/duel/store-listing-en.md:40` |
| stránka: 27 minihier v rodinách reflex, attention, sharp eyes, memory, timing, thinking | `Ui.kt:104-121` (Families), `ops/games/duel/store-listing-en.md:42-49` |
| stránka: offline, bez účtu, nič na kúpu | `Words.kt:187`, `ops/games/duel/store-listing-en.md:73-75` |
| stránka: reklamy nikdy počas kola, najviac jedna celoobrazovková pri odchode z dohraného zápasu, dve voliteľné | `Words.kt:190`, `ops/games/duel/store-listing-en.md:71` |
| stránka: zásady ochrany súkromia už zverejnené | `products/arling-sk/play/duel/privacy/index.html`, `Words.kt:197` |

Naše: dva palce (dve ruky, dve farby pleti), poradie hier a výsledky kôl, uhol šípok (200° a 278,75°), poloha inej
a zlej šípky, veľkosť väčšieho kruhu (.35), časy ťukov, stôl a svetlo lampy, zvuky filmu (akordy, zvony) pod
zvukmi appky.

Vedomé zjednodušenia (všetky len vynechávajú, nič nepridávajú):
- Hlášky bez emoji (písmo filmu ich nemá, v appke sú systémové emoji).
- Pod hláškou víťaza len jeho čas („231 ms“); appka píše „231 ms vs no tap“, lebo neskorší ťuk po okne 20 ms
  nezaznamená. Pri Odd One Out film čas nepíše vôbec.
- Intro kola ukazuje ikonu a názov (a Match point alebo Decider!), bez vety pravidla a bez 3 s ukážky; pauzy
  medzi kolami sú kratšie. Film začína uprostred kola 1 (hák), čakanie na záblesk (v kole 1 najmenej 1,5 s) nie je vidieť.
- Obrazovka výsledku bez riadku „Fastest thumb“, mince a akcií v strednom páse (text by bol pod 36 px).
- Rozsvietenie víťaza len na jeho polovici podľa `vizual-spec.md` 3.6 (v kóde `lightHalf` v `DuelScreen`
  kreslí cez celé plátno; to je pravdepodobne chyba appky, film ju nepreberá).
- Texty v telefóne sú väčšie ako v appke (najmenej 36 px vo videu 1080 px, pri zmenšenom telefóne na konci
  aj viac), aby boli čitateľné na mobile.

## Test (bez prehliadača)

`node products/arling-sk/play/duel/film/test.mjs` (26. 9. 2026: zelený)

- 4 formáty x 571 snímok (0 až 19 s po 1/30 s), plus závery `google-play` a `obchod` od 14,5 s,
- žiadna výnimka (falošné plátno hádže pri zápornom polomere arc, arcTo, ellipse, zlom offsete prechodu, NaN),
- žiadne NaN ani nekonečno v súradniciach a číselných vlastnostiach, save a restore v páre,
- každý text (aj zapečený v sprite, zložený cez drawImage, s ohľadom na clip) v zóne `zona(W, H)`,
- najmenšie písmo po transformáciách 36,2 px (minimum `minPismo` 36 px pri 1080),
- palec nikdy neprekryje text mimo telefónu (titulky, názov, záver),
- palec nikdy nezakryje hlášku ani čas a hláška nikdy neleží na prstenci ani krížiku (kolo opráv 26. 9.),
- prstenec správnej odpovede a krížik zlého ťuku sú celé vidno (os palca ďalej ako polomer palca plus cieľa)
  najmenej 1,60 s v kuse v každom formáte (požiadavka 0,6 s),
- partitúra (43 udalostí) v čase 0 až 19 s, známe nástroje; titulky na obraze s časom čítania slová / 3 + 0,5 s,
- texty bez pomlčiek em a en; fakty z kódu appky (metriky, okno remízy, sady hlášok, mriežka a uhly Odd One Out,
  plochy Bigger Circle, odpočet 1500 ms, skóre 2 : 1, posledné kolo 2600 ms).

Šírka textu je v teste odhad (0,55 em na znak), film meria v prehliadači skutočné písmo; preto treba
kontrolné snímky so zónami.

## Pre Fable

1. Kontrolné snímky so zónami (server nad `products/arling-sk` na 8871):
   `node ops/video/kodfilm/render.mjs --url http://127.0.0.1:8871/play/duel/film/render.html --nazov duel --snimky 0,0.5,1.6,2.6,5.4,7.0,7.7,8.1,12.5,13.2,15.5,18.9 --harok --zony --bez-videa --out <scratchpad>/filmy/duel2`
   Pozrieť hlavne: 0 (hák: svieti, hláška a 231 ms, názov), 0,5 (+1 letí), 1,6 (prechod háku), 7,7 (krížik,
   prstenec a hlášky naraz, palce preč), 13,2 (Nailed it! mimo kruhov), 18,9 (výsledok čitateľný).
2. Render všetkých 4 formátov (na pozadí, nič iné ťažké popri tom):
   `node ops/video/kodfilm/render.mjs --url http://127.0.0.1:8871/play/duel/film/render.html --nazov duel --snimky 0,0.9,5.4,7.7,13.2,15.8,18.9 --harok --fps 30 --out ops/video/out/kodfilm/duel`
   Verzia Google Play na deň spustenia: `--url http://127.0.0.1:8871/play/duel/film/render.html?zaver=google-play --nazov duel-google-play`
   a do záznamu obchodu `?zaver=obchod --nazov duel-obchod --formaty 1920x1080`.
3. `og.jpg` 1200x630 zo 16:9 MP4 pri 18,6 s; potom `over-stranku.mjs` a `meraj.mjs` a výsledky sem.
4. Nasadenie: odkaz z `play/`, sitemap, llms.txt; `play/duel/` nemá stránku hry (len `privacy/`), preto `#about`.
   `test.mjs` stránka nenačíta, pri nasadení ho možno vynechať.
