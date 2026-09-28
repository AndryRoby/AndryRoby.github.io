# Halloween Logic Puzzle Book: film nakreslený kódom

28. 9. 2026 v noci, agent (workflow Fabla). Stránka `https://arling.sk/puzzle-books/halloween-logic-puzzle-book/film/`
(zatiaľ bez odkazov z iných stránok, doplní Fable pri nasadení). Predmet: tlačiteľná kniha „Halloween Logic Puzzle
Book“, Etsy 4583729691, 4,90 €, stránka `/puzzle-books/halloween-logic-puzzle-book/`, zdroj `products/hlavolamy-halloween/`.
Použitie: YouTube Short (YouTube je náš najväčší zdroj návštev), Reels, Facebook, stránka knihy. Engine
`ops/video/kodfilm/` (kópia v `engine/`, obnoví ju `node ops/video/kodfilm/kopiruj.mjs products/arling-sk/puzzle-books/halloween-logic-puzzle-book/film`),
stavba ako `shop/pumpkin-escape-kids/film/` (hák, zóny, minPismo, test s falošným plátnom).

**Jedna vec, ktorú AI sama nespraví:** skutočný Nonogram 2 zo strany 6 knihy (čísla zo `zadania.json`) sa vyrieši
sám riešiteľom po riadkoch, 22 krokov, každý krok vyplní len istoty. Test to overí nezávisle (všetkých 2^10 riadkov).

## Súbory

| Súbor | Čo je |
|---|---|
| `film.js` | film 18 s: riešiteľ po riadkoch, časová os `T`, rozloženie pre 4 formáty, vrstvy kreslené raz, scény, partitúra, `FAKTY` |
| `test.mjs` | test bez prehliadača: `node test.mjs` v tomto priečinku (`--rozlozenie` vypíše rozloženie) |
| `index.html` | stránka v hube: hlavička a päta zo stránky knihy, CSP bez vložených skriptov (hash len pre JSON-LD), Umami udalosti `halloween_book_film_*`, JSON-LD WebPage a FAQPage, popis scén pre čítačky |
| `film.css` | plátno 16:9 na počítači, 9:16 do 760 px, tlačidlo prehrať v nočných farbách knihy |
| `strana.js`, `render.html`, `render.js` | vstup stránky a vstup pre `render.mjs` (kópie z Pumpkin filmu, render.html noindex) |
| `engine/` | kópia kodfilm enginu (nemenená) |

## Vizuálny jazyk (z knihy a Etsy obrázkov)

Nočné nebo z obálky (`kniha.mjs` r. 151 až 158: `#150f2b`, `#2c1a47`, `#3a1f3d`, mesiac `#f6c77a` do `#e8943a`,
netopiere `BAT_D`, kopce), HALLOWEEN oranžovou `#f28c28` s rozostupom a veľký krémový názov ako na `etsy/etsy-1.png`,
oranžový štítok ako „PRINTABLE PDF“ na tom istom obrázku. Strana knihy je kópia strany zadania (hlavička
NONOGRAM 2 a EASY · 10 × 10 s oranžovou čiarou `ORANZ #d2601a`, čísla, hrubé čiary každých 5 ako `strana-5.jpg`).
Pri riešení sú nové políčka oranžové a staršie čierne, presne ako strany „Your first moves“ v knihe
(`kniha.mjs` r. 203 a 210). Ikony kapitol (tekvica, mesiac, netopier, pavúk) sú `IKONY` z `kniha.mjs`.
Písmo ARLing Sans (hub `/fonts/`). Farba tmy a papiera sa mení len ostrým kruhom zo stredu tekvice, nikdy
prelínaním cez sivú (skill arling-film, bod 6).

## Časová os (18 s, 30 fps)

| Čas (s) | Obraz | Titulok na plátne | Zvuk |
|---|---|---|---|
| 0 až 1,9 | hák: strana 6 knihy s vyriešeným Nonogramom 2, mriežka je tmavá, tekvica oranžová, oči a ústa svietia ako sviečka (plameň z periód 0,6, 0,45, 0,25 s), iskry stúpajú, mesiac pulzuje, netopiere krúžia. HALLOWEEN, „Logic Puzzle Book“ (odlesk, priblíženie 1,035 klesá na 1), „80 Halloween logic puzzles, printable PDF“, štítok „arlingpuzzles.etsy.com“ (bez ceny). Text odíde 1,15 až 1,6 | | ťuk, Am7 (A2 E3 C4 G4), zvony E5 A5 C6 od snímky 0, švih pri odchode |
| 1,25 až 1,75 | papier sa šíri kruhom zo stredu, dlaždice tekvice zmiznú, ostane prázdne zadanie | The numbers hide a picture. (1,9 až 4,3) | zostupné glissando A5 do E4 |
| 2,35 až 10,4 | riešiteľ: 22 krokov (r3, r4, r5, r7, r8, r10, s1, s2, s4, s5, s6, s7, s9, s10, r1, r2, r3, r4, r6, r8, r9, r10; prvý v 2,35, posledný v 10,10), pilulka pod číslami riadku či stĺpca, pás cez mriežku, políčka po 35 ms oranžovo, potom čierne, bodky do prázdnych, hotové čísla stlmené | Line by line, without guessing. (4,3 až 7,3), Every puzzle has exactly one solution. (7,3 až 10,8) | tep 120 BPM, Am, F, G, každý krok ceruzka a tón pentatoniky (A C D E G), plný riadok zvon E6 |
| 10,4 až 10,8 | posledné políčka, ticho pred momentom | | nádych (šum narastá) |
| **10,8 (60 %)** | **tma sa šíri kruhom zo stredu (0,5 s), každé čierne políčko sa pri prechode kruhu ostro prepne na dlaždicu tekvice (zväčší sa z 0,9, prekmit 2,3 %), bodky zmiznú, tvár sa rozsvieti o 0,1 s po kruhu** | It was a pumpkin all along. (10,8 až 13,3) | hlboký dopad 55 Hz, C dur, zvony C6, G6, E6, trblietka, tiché praskanie sviečky |
| 12,95 až 15,85 | hlavička a čísla zmiznú, mriežka sa zmenší do ikony kapitoly 1, obsah knihy: Hidden Pictures (20 Nonograms), Moonlit Bridges (20 Hashi), Spooky Sums (20 Kakuro), Graveyard Loops (20 Slitherlink), riadky po 0,22 s | 80 puzzles in four chapters. (13,3 až 15,9) | Am, švih, ťuk a tón A4 C5 E5 G5 na každú kapitolu |
| 15,6 až 18 | mriežka narastie späť, hlavička a čísla sa vrátia, názov 16,0 (od 16,9 sa pomaly priblíži na 1,035), veta 16,45, štítok 16,8, odlesk štítka 17,25. Posledná snímka = snímka 0 (test porovná skladanie do 1 px; náhľad dal rozdiel len v popisku času) | | F, glissando, C dur, zvony C4 G4 E5, A5 na štítok, C6 na odlesk |

`film.plagat` = 1,0 s (hák, všetko čitateľné), tlačidlo prehrať nad stredom mriežky. Štítok s adresou obchodu je na
stránke neviditeľný odkaz priamo na ponuku Etsy 4583729691 s UTM `utm_medium=film` (udalosť `halloween_book_film_to_etsy`),
aktívny od 16,8 s. Bez „buy now“, bez naliehavosti, bez hodnotení. Cena vo filme nie je (pozri Opravy po kontrole).

Rozloženie: 9:16, 4:5 a 1:1 pod sebou (názov a titulky hore, strana v strede, veta a štítok dole; štítok má
rezervu 0,4 výšky nad spodkom zóny, lebo pri odchode háku klesne), 16:9 strana vľavo, text vpravo. 1:1 je bez
hlavičky strany (inak by políčko malo 33 px a čísla 38 px by sa prekrývali; teraz 38,8 px). Text len v `zona(W, H)`.

## Fakty vo filme a ich zdroje

| Fakt | Zdroj |
|---|---|
| Nonogram 2, easy, 10 × 10, čísla riadkov a stĺpcov, riešenie | `products/hlavolamy-halloween/zadania.json` `kapitoly[0].zoznam[1]` (meno Pumpkin) |
| obrázok Pumpkin (riadky `#` a `.`) | `products/hlavolamy-halloween/obrazky.mjs` r. 5 |
| strana 6 z 91 | `kniha.mjs` `rozvrh()` (test ho spustí), stránka knihy „91 pages“, `etsy/ponuka.json` popis „(91 pages)“ |
| 80 puzzles, 4 kapitoly po 20 | `zadania.json` (4 kapitoly, 20 zadaní v každej), stránka knihy r. 254 |
| Hidden Pictures, Moonlit Bridges, Spooky Sums, Graveyard Loops a ich ikony | `kniha.mjs` `TEXTY` r. 34 až 75, `IKONY` r. 79 až 89 |
| „Line by line, without guessing.“ | `kniha.mjs` r. 41 („you can reach it line by line, without guessing“), stránka knihy r. 327 |
| „Every puzzle has exactly one solution.“ | `kniha.mjs` r. 169, 180, 247 |
| „It was a pumpkin all along.“ | meno obrázka `Pumpkin` v `zadania.json`; overené, že riešiteľ dá presne tento obrázok |
| „printable PDF“, A4 a US Letter (stránka filmu) | stránka knihy (FAQ „Which files do I get?“), `etsy/ponuka.json` |
| 4.90 € (len stránka filmu a odkaz pre čítačky, nie plátno) | `etsy/ponuka.json` r. 22 (`listing_eur: 4.9`), stránka knihy JSON-LD r. 57 |
| štítok arlingpuzzles.etsy.com | `ops/social/zasobnik-q4.mjs` `ETSY_OBCHOD` (test ho porovná) |
| odkaz štítka na stránke: `etsy.com/listing/4583729691` | stránka knihy (tlačidlá „Buy on Etsy“), test porovná |
| 22 krokov, len istoty | vlastný riešiteľ `riesKrokmi` vo `film.js`, test overí každý krok nezávisle |

`test.mjs` všetko porovnáva priamo so zdrojmi (riadky sa môžu posunúť, test nie).

**Poctivo o spoileri:** film ukazuje riešenie Nonogramu 2. Je to tá istá hádanka, ktorú dáva zadarmo pin
`halloween-skus` (`piny.mjs` r. 58 až 61); riešenie Nonogramu 9 (strašidelný dom) je už verejne na `etsy-2.jpg`.
Zvyšných 19 obrázkov film ani stránka neukazuje. Stránka filmu to hovorí otvorene.

## Test

`node test.mjs` (28. 9. 2026): **OK**, 4 formáty × 541 snímok (po 1/30 s), 111 491 textov, najmenšie písmo 36,5 px,
119 zvukov, 22 krokov riešiteľa bez hádania, moment v 10,8 s (60 %), fakty sedia so zdrojmi. Overuje: výnimky ako
v prehliadači, NaN, text v zóne, písmo aspoň 36 px, prekryvy textov aj vo vnútri spritov, napoly zamaskovaný
text, hák (HALLOWEEN, názov, veta a štítok arlingpuzzles.etsy.com na snímke 0, bez ceny, názov preč v 1,9 s), odkaz štítka
priamo na ponuku Etsy, žiadna cena ani stará adresa v textoch filmu a titulkoch pre čítačky, slučku, partitúru, čas čítania
titulkov, pomlčky em a en, naliehavé slová, riešiteľa (nezávisle), moment okolo 60 % a po poslednom kroku,
fakty (zadania.json, obrazky.mjs, kniha.mjs vrátane rozvrhu, etsy/ponuka.json, stránka knihy, zasobnik-q4.mjs) a stránku filmu
(fakty, jediná cena 4.90, jediný počet strán 91, canonical, strana.js, predpona Umami udalostí).

Test má zuby (skúšané 28. 9.): zmenená cena vo filme (4.50) zlyhá na 8 miestach, zmenené číslo riadku zlyhá na
zdroji, názov bez priblíženia na konci zlyhá na slučke (posun 14,75 px). Po oprave štítka: vrátený starý štítok
„4.90 € · arling.sk/puzzle-books“ zlyhá na 9 miestach (chýba adresa obchodu, cena na snímke 0, cena v textoch filmu).

## Opravy po kontrole (28. 9. 2026)

Kontrolór: výzva „4.90 € · arling.sk/puzzle-books“ sa v Shorte nedá kliknúť a vedie cez 3 kroky (hub, stránka knihy,
Etsy); film Advent vedie priamo na arlingpuzzles.etsy.com a cenu vynecháva, lebo Etsy ukazuje cenu v mene diváka.

- `FAKTY.adresa` = `arlingpuzzles.etsy.com`, `CHIP` = len adresa (bez ceny), nový `FAKTY.url` = ponuka Etsy s UTM.
- `odkazy()` vedie priamo na ponuku Etsy 4583729691 (udalosť `halloween_book_film_to_etsy`, tá istá ako odkaz v texte stránky).
- Titulky pre čítačky (0 s a 16 s) bez ceny, s adresou obchodu; popis scény 1 v `index.html` tiež. Cena 4.90 € ostáva
  v texte stránky filmu (lead, „About“, FAQ).
- `test.mjs`: kontrola štítka proti `ETSY_OBCHOD` namiesto existencie `puzzle-books/index.html`, cena na snímke 0 a
  v textoch filmu zlyhá, odkaz musí ísť na ponuku 4583729691.

Test po oprave: `node test.mjs` OK, 4 formáty × 541 snímok, 111 491 textov, najmenšie písmo 36,5 px, 119 zvukov.
Kontrolné časy pre štítok: 0 a 1 (hák, štítok v zóne, pri 16:9 vpravo pod vetou), 16,8 a 17,3 (štítok v závere
a odlesk), 18 (slučka = snímka 0). Po 1. 11. 2026 ponuku Etsy skryjeme (sezóna, `data-etsy-skryt` na stránke
knihy), odkaz na stránke filmu potom treba zmeniť na obchod; adresa na plátne ostáva platná.

## Pokus 2 po bráne (28. 9. 2026, druhý Claude)

Kontrola pokus 1: `ops/ai/kontrola/2026-09-28-film-halloween-kniha.md` (NEPREJDE). Tabuľky vyššie opisujú pokus 1;
platí táto časová os. Film má teraz **20 s** (predtým 18).

| Čas (s) | Obraz | Titulok na plátne |
|---|---|---|
| 0 až 1,9 | hák ako predtým, nadpisy **ARLing Draw Text**, ponuka „80 printable puzzles, PDF“, štítok arlingpuzzles.etsy.com | |
| 1,9 až 3,5 | prázdne zadanie | The numbers hide a picture. (1,9 až 4,1) |
| 3,5 až 5,8 | **ukážka jedného kroku**: pilulka pri riadku 3 (číslo 6), pás 6 políčok vľavo, v 4,2 až 4,95 sa posunie doprava, východisko ostane ako prerušovaný obrys, prekryv (2 stredné políčka) sa zvýrazní, v 5,1 ich riešiteľ vyplní | The 6 always covers the middle two. (4,1 až 7,0) |
| 5,9 až 10,0 | zvyšných 21 krokov zrýchlene (0,3 s na 0,16 s), skutočné poradie riešiteľa | Line by line, without guessing. (7,0 až 9,3), Exactly one solution. (9,3 až 11,5) |
| 10,5 | dokončenie: rám mriežky raz zasvieti oranžovo, zvony A5 a E6 | |
| **11,5 (57,5 %, na dobe 120 BPM)** | moment: tma a rozsvietenie tekvice | It was a pumpkin all along. (11,5 až 14,05) |
| 12,4 až 16,2 | čísla zmiznú (12,4 až 12,7), až potom sa mriežka zmenší (12,7 až 13,4), riadky Nonograms, Hashi, Kakuro, Slitherlink vchádzajú od 13,45, všetky štyri ustálené do 16,05, odídu pred rastom | Four kinds, 20 puzzles each. (14,05 až 16,25) |
| 16,2 až 20 | mriežka narastie (16,2 až 16,9), názov 16,25, ponuka 16,35, štítok 16,45, všetko ustálené od 16,9; čísla sa vrátia 16,9 až 17,2; posledná snímka = snímka 0 | |

Zmeny v kóde (`film.js`): `T` a `TITULKY` nanovo; `UKAZKA` sa odvodí z prvého kroku riešiteľa (film spadne, ak prvý krok
nie je riadok s jedným číslom a dvoma istými políčkami, aby titulok nikdy neklamal); `kresliUkazku`; rám dokončenia;
obsah knihy len názvy druhov (`KAP_TEXT`, tituly kapitol ostávajú vo `FAKTY` pre test zdrojov); `VETA` skrátená;
ponuka 54 px pri 1080 (pravidlo písma 48 až 72 px pre údaj na predaj); periódy mesiaca, netopierov, plameňa a iskier
delia 20 s (slučka). Písmo: `ARLing Draw Text` (Draw s pripnutou osou DRAW = 1000, `ops/design/PISMO-PRAVIDLA.md`)
z `/asistent/pismo/ARLingDrawText-VF.woff2?v=684e70c1` cez `FontFace` v `pripravit`; v rendri chýbajúce písmo
vyhodí chybu. Názov 680 (tmavé pozadie), rozostup -0,015 em cez `ctx.letterSpacing` (zachová kerning),
HALLOWEEN 650 s rozostupom 0,3 em; riadkovanie názvu 1,2. Kreslenie osou DRAW som nepoužil: hák musí byť čitateľný
od snímky 0 a záver sa musí zhodovať so snímkou 0. Súbor `ops/design/paper/fonts/` Draw neobsahuje (len Sans a Serif).
`film.plagat` ostáva 1,0 s (test overí plný kontrast názvu, ponuky a adresy); `kontrola.mjs` treba spúšťať
s `--plagat 1.0`, pokus 1 poster vybral automaticky 15,833 s.

`index.html`: 20 s namiesto 18, popis scén (ukážka kroku, štyri druhy, nová ponuka), JSON-LD popis a jeho CSP hash
prepočítaný (`sha256-z89cw8ruuV/AovTVO0Pl77/WkXwXa22skGrCqRtfupQ=`, node:crypto). `csp-hash.mjs` som nespúšťal.

Test `node test.mjs` (28. 9.): **OK**, 4 formáty × 601 snímok, 116 921 textov, najmenšie písmo 36,5 px, 125 zvukov,
22 krokov bez hádania, moment 11,5 s (57 %). Nové kontroly: (13) žiadny viditeľný text v obdĺžniku mriežky v žiadnej
snímke, (14) záver spolu v plnom kontraste a na mieste **3,27 s** (min 3), (15) obsah knihy **2,03 s** (min 1,83),
(16) nadpisy písmom Draw na snímke 0 a v závere, plagát čitateľný. Zuby (skúšané, potom vrátené): riadky kapitol
od 13,0 s zlyhajú na kolízii s tekvicou, štítok od 17,2 s zlyhá na závere (2,50 s), názov v ARLing Sans zlyhá na písme.

Kontrolné snímky (Chrome cez `cakaj-zamok.py`, 2 kolá): `ops/video/out/kodfilm/halloween-kniha/kontrola-p2/`,
kolo 1 `halloween-p2-*-harok.png` (9:16 a 16:9 v 0, 1, 2,5, 6, 10,8, 13,5, 14,5, 16, 17,5 s), kolo 2
`halloween-p2-k2-1080x1920-harok.png` (3,8, 4,5, 5,0, 5,3, 12,9, 13,2, 16,3, 16,6, 19,99 s). Videné: ukážka kroku
čitateľná (pás, obrys, prekryv, vyplnenie), kapitoly až po zmenšení, pri raste už preč, záver v plnom kontraste,
19,99 s zhodné so snímkou 0. Bez nálezu v zóne.

### Skóre podľa kritika.txt (autor, nie brána; bránu hodnotí iná AI)

| Ohľad | Skóre | Dôvod |
|---|---:|---|
| hák v prvých 2 s | 8,5 | produkt, názov, ponuka a adresa na snímke 0, zvuk od 0; plagát 1,0 s plne čitateľný |
| čitateľnosť na mobile | 8,5 | najmenej 37,7 px pri 9:16 (36,5 px v ostatných), všetky titulky nad slová/3 + 0,5 s, kapitoly 2,03 s, záver 3,27 s |
| kvalita pohybu | 8,0 | pohyb som videl len na statických snímkach; MP4 pásy s `--sub auto` neexistujú (plný render nebol povolený) |
| pestrosť | 8,0 | nové každých 1,6 až 2,4 s okrem rýchleho riešenia 5,9 až 10,5 s (4,6 s rovnaké rámovanie, ale meniaci sa obsah) |
| kompozícia | 8,5 | zóny držia (test aj snímky); pás pod stranou v 9:16 počas príbehu ostáva prázdny (vedomý kompromis) |
| presnosť značky | 8,5 | nadpisy ARLing Draw Text, UI a strana ARLing Sans, jedna akcentová oranžová, skutočná strana knihy |
| synchron zvuku | 8,0 | moment presunutý na dobu (11,5 s), zvuky na ukážku, dokončenie a záver; zvuk nikto nepočul, LUFS po zmene nezmerané |

Čo ostáva: plný render (Fable), `kontrola.mjs --plagat 1.0` na MP4 (pásy 4,2 až 5,1, 12,7 až 13,5, 16,2 až 16,9, šev),
hlasitosť, posluch, a potom pokus 2 brány u Astry.

## Pokus 3 po bráne (28. 9. 2026, druhý Claude)

Kontrola pokus 2: `ops/ai/kontrola/2026-09-28-film-halloween-kniha-pokus2.md` (NEPREJDE tesne). Pokus 3 je posledný.
Film ostáva **20 s**. Platí táto časová os (tabuľky vyššie opisujú pokusy 1 a 2).

| Čas (s) | Obraz | Titulok na plátne |
|---|---|---|
| 0 až 1,9 | hák bez zmeny | |
| 1,9 až 4,0 | prázdne zadanie | The numbers hide a picture. (1,9 až 4,55) |
| 4,0 až 6,3 | ukážka kroku: pilulka riadku 3, posun pásu 4,7 až 5,45 (v plne čitateľnom titulku), vyplnenie 5,6 | The 6 always covers the middle two. (4,55 až 7,9) |
| 6,4 až 9,5 | zvyšných 21 krokov zrýchlene, poradie riešiteľa bez zmeny | One solution, no guessing. (7,9 až 10,35) |
| 10,0 | dokončenie: rám zasvieti | |
| **11,0 (55 %, doba 120 BPM)** | moment: tma a rozsvietenie tekvice | It was a pumpkin all along. (10,35 až 13,35) |
| 11,95 až 16,3 | čísla zmiznú 11,95 až 12,25, mriežka sa zmenší 12,25 až 12,85, štyri druhy vchádzajú od 12,9, ustálené 13,53, odídu 16,15 až 16,3 | 20 each. (13,35 až 16,35) |
| 16,3 až 20 | mriežka narastie 16,3 až 17,0, názov 16,35, ponuka 16,43, štítok 16,51, čísla späť 17,0 až 17,3; posledná snímka = snímka 0 | |

Zmeny (`film.js`): titulky majú prechod 0,2 s (nábeh aj miznutie, `PRECHOD`) a vstup zdola 0,3 s (`VSTUP_TITULKU`),
aby sa dĺžka v plnom kontraste zmestila do 20 s. „Line by line, without guessing.“ a „Exactly one solution.“ sú spojené do
„One solution, no guessing.“ (o jeden prechod menej; oba fakty ostávajú v `kniha.mjs` a v titulkoch pre čítačky).
„It was a pumpkin all along.“ začína 0,65 s pred zhasnutím, keď je čierna tekvica v mriežke už hotová. Posledný titulok
je „20 each.“ nad zoznamom druhov. Zvyšok riešenia od 6,4 po dokončenie v 10,0 trvá **3,6 s namiesto 4,6 s**; ušetrená
sekunda išla titulkom a obsahu knihy. Moment sa posunul z 11,5 na 11,0 s (55 %, test pripúšťa 55 až 65 %), inak by
titulok o tekvici, blok obsahu a záver 3 s nevyšli do 20 s. Partitúra sa posúva s časovou osou (akordy F a G od `T.ukazOd`
a `T.rychloOd`, akord obsahu od `T.zmensOd`). `index.html` bez zmeny (popis scén ostáva pravdivý, JSON-LD nemenený).

`test.mjs`: (9b) každý titulok meria po snímkach len v plnom kontraste (alfa aspoň 0,99) a na mieste (do 1 px od polohy
v strede titulku), teda bez nábehu, miznutia aj vstupu zdola; statická kontrola počíta `do - od - 2 * prechod`.
(15) titulok „20 each.“ a štyri riadky obsahu musia byť spolu v plnom kontraste aspoň max(2,5 s, slová / 3 + 0,5 s).
Zuby (skúšané, vrátené): vstup titulku 0,6 s namiesto 0,3 s zlyhá v každom formáte na troch titulkoch a na bloku obsahu
(2,80 s pri šestke, 2,43 s pri bloku).

### Čas každého titulku v plnom kontraste (`node test.mjs`, rovnaké vo všetkých 4 formátoch)

| Titulok | Plný kontrast (s) | Minimum slová / 3 + 0,5 (s) |
|---|---:|---:|
| The numbers hide a picture. | 2,23 | 2,17 |
| The 6 always covers the middle two. | 2,93 | 2,83 |
| One solution, no guessing. | 2,03 | 1,83 |
| It was a pumpkin all along. | 2,57 | 2,50 |
| 20 each. (sám) | 2,57 | 1,17 |
| 20 each. spolu s Nonograms, Hashi, Kakuro, Slitherlink | 2,57 | 2,50 |
| záver: názov, ponuka a adresa spolu | 3,20 | 3,00 |

Test `node test.mjs` (28. 9.): **OK**, 4 formáty × 601 snímok, 113 502 textov, najmenšie písmo 36,5 px, 123 zvukov,
22 krokov bez hádania, moment 11,0 s (55 %), fakty sedia so zdrojmi.

Kontrolné snímky (Chrome cez `cakaj-zamok.py`, 1080 × 1920, 0, 2, 4, 6, 8, 10, 12, 14, 15, 16, 17,5 s):
`ops/video/out/kodfilm/halloween-kniha/kontrola-p3/halloween-p3-1080x1920-harok.png`. Videné: v 2 a 8 s titulok práve
nabieha (zámerne v prechode), v 4 s pás šestky pri riadku 3, v 10 s hotová čierna tekvica s titulkom, v 12 s rozsvietená
tekvica a „It was a pumpkin all along.“, 14 až 16 s „20 each.“ nad štyrmi druhmi s ikonami, 17,5 s záver zhodný so
snímkou 0. Bez nálezu v zóne. Plný render ani posluch nerobil (nepovolené).

## Kontrolné časy snímok

`0, 1, 1.5, 1.9, 4, 8, 10.8, 11.3, 14, 16.6, 16.8, 17.3, 18`: 0 a 18 hák a slučka (štítok arlingpuzzles.etsy.com, bez ceny), 1 plagát, 1,5 odtok kruhom, 1,9 prázdne
zadanie po háku, 4 krok riešiteľa s pilulkou, 8 riešenie s bodkami, 10,8 tesne pred momentom, 11,3 rozsvietená
tekvica, 14 obsah knihy, 16,6 záver sa skladá, 16,8 a 17,3 štítok a jeho odlesk.

## Pre Fabla: kontrolné snímky a render

Statický server z `products/arling-sk` na porte 8871, potom z koreňa repa:

```
node ops/video/kodfilm/render.mjs --url http://127.0.0.1:8871/puzzle-books/halloween-logic-puzzle-book/film/render.html --nazov halloween-logic-puzzle-book --snimky 0,1,1.5,1.9,4,8,10.8,11.3,14,16.6,16.8,17.3,18 --harok --zony --bez-videa --out <scratchpad>
```

Pozrieť hlavne: skutočnú šírku písma ARLing Sans v hlavičke strany (EASY · 10 × 10 sa v 1:1 nezobrazuje, v ostatných
formátoch áno), kosák mesiaca v ikone Moonlit Bridges (`destination-out`, náhľad agenta ho nevedel ukázať), odtok
v 1,4 až 1,75 s a moment 10,8 až 11,3 s (ostrý kruh, žiadna sivá), čísla v 1:1 (políčko 38,8 px, čísla 37,8 px).
Potom render všetkých 4 formátov na pozadí:

```
node ops/video/kodfilm/render.mjs --url http://127.0.0.1:8871/puzzle-books/halloween-logic-puzzle-book/film/render.html --nazov halloween-logic-puzzle-book --out ops/video/out/kodfilm/halloween-logic-puzzle-book
```

Po rendri: 3 snímky z MP4 (ffmpeg `-ss`), ffprobe a hlasitosť z JSON (-14 LUFS, špička pod -1 dBTP), verzia `-yt`
1440p s popisom a UTM odkazom na ponuku Etsy 4583729691 (alebo arlingpuzzles.etsy.com po sezóne), `over-stranku.mjs` a `meraj.mjs` (výsledky
sem). `og:image` stránky filmu zatiaľ ukazuje `og.jpg` knihy; vlastný `film/og.jpg` doplní Fable po rendri. JSON-LD
VideoObject pribudne až s URL videa na YouTube. CSP hash JSON-LD je vypočítaný `node:crypto` (sha256 obsahu bloku);
`csp-hash.mjs` agent nespúšťal, Fable ho pred nasadením pustí na overenie. Odkaz na film zo stránky knihy, zo
`zoznam.json` a sitemapy doplní Fable pri nasadení.

## Čo agent nevedel overiť a známe slabiny

- Film nikto nevidel v prehliadači a nikto nepočul zvuk. Rozloženie som pozrel cez vlastný prevod volaní plátna do
  SVG a resvg so statickými rezmi ARLing Sans (z `fonts/arling-sans.woff2` cez fontTools, šírky znakov z písma), bez
  zrna, tieňov, `lighter` a `destination-out`. Hárky všetkých 4 formátov v 11 časoch prezreté, bez nálezu v zóne.
- Hlasitosť, render, výkon stránky a `og.jpg` filmu.
- 9:16: počas príbehu je pás pod stranou (nad hranicou 80 %) prázdny; 16:9: pravý stĺpec má veľa voľného miesta.
  Obe sú vedomé kompromisy (strana sa nehýbe, text sa nezmenšuje pod 36 px).
- Titulok na plátne v 10,8 s na okamih zmizne (prelínanie dvoch titulkov po 0,3 s), zámerne na moment.
