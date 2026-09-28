# Film: Advent Puzzle Calendar 2026 (kodfilm, 20 s)

28. 9. 2026. Film pre tlačiteľný adventný kalendár hlavolamov na Etsy (EN 4583815695, DE 4583815851,
4,90 €). Motor kodfilm (`ops/video/kodfilm/`), engine skopírovaný `node ops/video/kodfilm/kopiruj.mjs` do
`engine/`. Vzory: `play/prism5/film/`, `games/hedgehogs/film/`, test podľa `shop/pumpkin-escape-kids/film/test.mjs`.

Stránka filmu: `https://arling.sk/puzzle-books/advent-puzzle-calendar/film/` (index.html, odkazy na obe
ponuky Etsy a obchod arlingpuzzles.etsy.com). Nadradená stránka `puzzle-books/advent-puzzle-calendar/`
zatiaľ neexistuje; odkaz v hube, sitemape a menu doplní Fable pri nasadení.

**Pokus 2 (po bráne Astry, `ops/ai/kontrola/2026-09-28-film-advent-kalendar.md`):** kalendár s 24 dvierkami
je z filmu preč. Od snímky 0 po poslednú je hlavným predmetom jeden skutočný list PDF (1. december), pod ním
dva ďalšie listy (stoh výtlačkov). Dvierka nezostali ani ako metafora: pri 20 s a 2 x 3 s ponuky na ne nebol čas
bez pohybu kamery cez titulky, a produkt bez nich nevyvoláva dojem fyzického kalendára.

## Súbory

| Súbor | Čo robí |
|---|---|
| `film.js` | celý film: rozloženie pre 4 formáty, list so stohom, riadkový riešič Nonogramu, Hashi, štítok PRINTABLE PDF, texty, partitúra |
| `render.html`, `render.js` | vstup pre `ops/video/kodfilm/render.mjs` (len plátno) |
| `index.html`, `strana.js`, `film.css` | stránka filmu v hube (prehrávač, popis scén pre čítačky, FAQ JSON-LD) |
| `test.mjs` | test bez prehliadača (`node test.mjs`), pozri nižšie |
| `engine/` | kópia enginu kodfilm |

## Vizuálny jazyk (z kalendára, nie spoločný štýl)

Z `products/hlavolamy-advent/kniha.mjs` a obrázkov ponuky `etsy/en/etsy-1.png`, `etsy-2.png`: tmavozelená
noc `#0b2419`, `#123a2a`, `#0d2c20` so svetlom vpravo hore `#1e5a42`, krémový papier, červená `#b3261e`
(plné bunky Nonogramu, krúžok dňa, štítok PRINTABLE PDF), zlatá `#e2b85a` a `#c8942e` (hviezdy, linky,
pilulka adresy), snehový závej `#f3efe6` dole, nadpis v ARLing Serif (ako „Puzzle Calendar“ na obrázku
ponuky; Astra to uznala ako vedomú odchýlku od ARLing Draw), ostatné ARLing Sans. Hlavička listu ako v PDF:
červený krúžok s číslom dňa, „December 1“, tenká červená linka, zlatá hviezdička.

## Časová os (sekundy, doby 120 BPM)

| Čas | Scéna | Zvuk |
|---|---|---|
| 0 až 3,3 | **Hák:** list 1. decembra (mriežka, zadania, zvonček vyplnený červenou), pod ním dva listy s prázdnou mriežkou 15 x 15, sneh, po liste prejde teplý odlesk (0 až 1,3 s, pokračuje zo záveru). Texty: ADVENT 2026, Puzzle Calendar (odlesk), červený štítok s ikonou listu **PRINTABLE PDF**, ponuka „24 days, 48 logic puzzles“, pilulka arlingpuzzles.etsy.com. Plný kontrast štítka, ponuky a adresy do 3,15 až 3,2 s, preč v 3,55 s. | C dur, zvony E5 G5 C6, rolničky, tichý pad a rolničky v 1,5 s, švih pri odchode |
| 3,3 až 4,0 | Červené bunky odídu v šikmej vlne, list sa pružinou (zeta 0,75, prekmit 2,8 %) priblíži na K (9:16 a 4:5 1,12, od horného okraja nadol; 16:9 a 1:1 ostáva). | klesajúce ťuky, šum nahor |
| 3,65 až 6,45 | Titulok „December 1: find the picture.“ | pulz 120 BPM od 3,5 s, Am, F |
| 4,0 až 8,8 | **Jadro:** Nonogram sa sám vyrieši riadkovým riešičom, 21 krokov, prvé pomalšie; riadok alebo stĺpec sa zlato zvýrazní aj so zadaním, bunky zčervenajú (prekmit 2,3 %) alebo dostanú bodku. Titulok od 6,45 s „Line by line, without guessing.“ | tón na každý krok (riadky stúpajú, stĺpce klesajú), ceruzka, C, G |
| 9,0 (45 %) | **Uspokojivý moment:** mriežka a bodky zmiznú, zvonček, zlaté iskry, hojdanie. Titulok „A bell. 23 more to find.“ | zvon C6 s neharmonickým pomerom, tri údery pri hojdaní, C dur |
| 11,2 až 12,1 | Texty listu odídu, list sa otočí na prázdnu zadnú stranu (bez textu a bez ostrovov počas otáčania). | F, švih |
| 12,2 až 14,5 | Zadná strana: Hashi z 1. decembra, 10 ostrovov vyskočí po jednom s číslami. Titulok od 11,8 s „On the back: Hashi, Kakuro or Slitherlink.“ | ťuky stúpajú, zvon E6 |
| 14,55 až 14,85 | List sa otočí späť na prednú stranu so zvončekom. | švih |
| 14,9 až 15,7 | **Obnova:** mriežka a zadania sa vrátia, list sa pružinou vráti na miesto háku (súčet dvoch pružín, nie reštart). | švih nadol, G |
| 15,0 až 20,0 | **Záver** v zložení háku: ADVENT 2026 a názov 15,0, štítok 15,5, ponuka 15,9, adresa 16,0; plný kontrast od 16,1 až 16,2 s do konca (3,8 až 4,3 s). Názov sa priblíži na mierku snímky 0, odlesk začne v 19,1 s. Posledná snímka = snímka 0 (test). | C dur, zvony C5, E5, G5, tichý pad 17 s a rolničky 18 s |

Plagát stránky `film.plagat = 1,0 s`: list s hlavolamom a zvončekom, názov, štítok PRINTABLE PDF, ponuka a adresa
(test overí všetky v plnom kontraste).

## Formáty a bezpečné zóny

- 9:16: ADVENT 2026, názov, štítok (samostatný riadok), list, ponuka, pilulka pod sebou, v strede. Titulky v páse
  nad listom, list v príbehu rastie nadol na 1,12.
- 4:5: to isté, ale štítok v riadku s ADVENT 2026 (v samostatnom riadku by bunka mala 42 px a dvojice „10 10“ by
  sa dotýkali). Hviezdy vedľa listu, nie vpravo hore (tam je štítok).
- 16:9: list vľavo (57 % zóny), texty a titulky vpravo, názov na dva riadky.
- 1:1: list vľavo hore, vpravo ADVENT 2026, názov na dva riadky a štítok na dva riadky (PRINTABLE / PDF), pod
  listom ponuka a pilulka (najviac 90 % výšky); titulky pod listom.

Písmo: všetko aspoň `minPismo * 1,05` (zadania Nonogramu 37,8 px pri 1080). List v príbehu je vykreslený
v rozlíšení K, aby bol pri zväčšení ostrý.

Determinizmus: všetko je funkcia `t`; sneh a hviezdy majú periódy, ktoré delia 20 s; odlesk listu je funkcia fázy,
ktorá cez koniec filmu plynulo pokračuje do začiatku; náhodnosť len `hash(i, j)`.

## Jedna vec, ktorú AI sama nespraví

Skutočné zadanie 1. decembra z kalendára (Nonogram „Bell“ 10 x 10) a skutočný riadkový riešič vo `film.js`
(`riesRiadok`, `riesNonogram`): bunku vyplní len vtedy, keď ju riadok alebo stĺpec pri známych bunkách nepripúšťa
inak. Film pri načítaní overí, že riešič dá presne riešenie zo `zadania.json`. Iné riešenie film neukazuje.

## Fakty vo filme a na stránke (zdroje; test.mjs ich porovná)

| Fakt | Zdroj |
|---|---|
| 24 dní, 48 hlavolamov | `products/hlavolamy-advent/zadania.json`, `texty.mjs` `podtitul` |
| zadanie, riešenie a meno „Bell“ 1. decembra, 10 x 10 | `zadania.json` `dni[0].nonogram` |
| zadná strana 1. decembra je Hashi 7 x 7, ostrovy | `zadania.json` `dni[0].druhy` (`cranes`) |
| listy v stohu 15 x 15 (dni 9 až 24) | `zadania.json`, `texty.mjs` `uvod` |
| „line by line, without guessing“ | `texty.mjs` `uvod[2]`; film to dokazuje riešičom |
| zadné strany Hashi, Kakuro, Slitherlink | `texty.mjs` `druhy` |
| „23 more“ | 24 Nonogramov mínus 1. december |
| PRINTABLE PDF | `ponuka.json` „WHAT YOU GET“, `STAV.md` |
| arlingpuzzles.etsy.com | `ops/social/zasobnik-q4.mjs` `ETSY_OBCHOD` |
| ponuky EN a DE a ich adresy | `etsy/en/etsy.json`, `etsy/de/etsy.json` |
| 4,90 €, 63 strán, A4 a US Letter (len stránka) | `etsy/en/ponuka.json` |

## Test

`node test.mjs` (v tomto priečinku), 28. 9. 2026 po pokuse 2:

```
1080x1920 vysoky: 601 snímok, 13445 textov, najmenšie písmo 37.6 px (minimum 36); plný kontrast na začiatku a na konci: štítok PRINTABLE PDF 3.17 a 4.33 s, ponuka 3.15 a 3.90 s, adresa 3.20 a 3.83 s
1920x1080 siroky: 601 snímok, 14119 textov, najmenšie písmo 40.1 px (minimum 36); ... (rovnaké časy)
1080x1080 stvorec: 601 snímok, 14106 textov, najmenšie písmo 37.3 px (minimum 36); ...
1080x1350 portret: 601 snímok, 13351 textov, najmenšie písmo 37.6 px (minimum 36); ...

OK: 4 formáty x 601 snímok, 55021 textov, najmenšie písmo 37.3 px, 151 zvukov, 21 krokov riešenia bez hádania, fakty sedia so zdrojmi
```

Overuje: výnimky, NaN, texty v zóne, písmo aspoň 36 px po transformáciách, prekryvy textov, maskovanie, slučku
(snímka 0 = posledná snímka do 1 px), list PDF na obraze v každej štvrťsekunde, otočenie zo zadnej strany na prednú,
**plagát** (list s mriežkou, zadaniami, hlavičkou a zvončekom, názov, štítok, ponuka, adresa s alfou 1), **čas ponuky**
(nové: štítok, ponuka a adresa majú plný kontrast, alfa aspoň 0,99, najmenej max(3 s, slová / 3 + 0,5 s) súvisle od
snímky 0 aj do poslednej snímky, meraním každej 1/60 s zo skutočného kreslenia), titulky (čas čítania, nadväznosť,
nie s hákom ani záverom, pomlčky), žiadne „door“ v textoch, fakty proti zdrojom, stránku (fakty vrátane „20 seconds“,
cena, strany, pomlčky, naliehavosť). Neoveruje prekryv textu s kresbou a skutočnú šírku písma: na to kontrolné snímky.

## Kontrolné snímky pokusu 2 (druhý Claude, 2 kolá)

```
python ops/druhy-ucet/cakaj-zamok.py node ops/video/kodfilm/render.mjs --url http://127.0.0.1:8873/puzzle-books/advent-puzzle-calendar/film/render.html --nazov advent-p2 --formaty 1080x1920,1920x1080 --snimky 0,1,2.5,4.5,8,10.5,14,16,17.5,19 --harok --zony --bez-videa --out ops/video/out/kodfilm/advent-kalendar/kontrola-p2
```

Kolo 2 aj s `1080x1080,1080x1350`. Výsledok v `ops/video/out/kodfilm/advent-kalendar/kontrola-p2/`.

- **Kolo 1** (9:16, 16:9): hák a záver na liste fungujú, texty v zóne. Nálezy: (1) 0 až 3 s, 9:16: roh spodného
  listu stohu siahal až k ponuke; (2) 4,5 s: titulok „December 1: a picture to uncover.“ sa zalomil so sirotou „a“;
  (3) 4 až 8,8 s: zlaté zvýraznenie riadku končilo o okraj pred koncom mriežky (stará chyba šírky). Štítok v 16:9 malý.
  Zmena: menšie otočenie a posun stohu nahor, titulok „December 1: find the picture.“ (jeden riadok), šírka
  zvýraznenia `gx - pad/2 + 10c`, štítok 5 % kratšej strany.
- **Kolo 2** (všetky 4 formáty): stoh s medzerou k ponuke, titulok na jeden riadok, zvýraznenie po celej mriežke,
  1:1 so štítkom na dva riadky čitateľné. Nález: 4:5 v 1 s veľká hviezda zasahuje do pravého konca štítka.
  Zmena (bez ďalšieho kola Chrome, len dekorácia): v 4:5 hviezdy vedľa listu (y 30 a 38 % výšky, x mimo listu
  aj stohu, ktorý končí na x 870 pri šírke 1080), test zelený.

## Pokus 3 po bráne (28. 9. 2026, druhý Claude)

Brána `ops/ai/kontrola/2026-09-28-film-advent-kalendar-pokus2.md` (pokus 2 NEPREJDE tesne). Pokus 3 je posledný.

- **12,1 s, skok obsahu listu:** otočenie ukazovalo zadnú stranu so všetkými desiatimi kruhmi Hashi, scéna po ňom ich
  kreslila od nuly. Teraz sa list otáča na prázdnu zadnú stranu a ostrovy vzniknú až od 12,2 s. Časová os a partitúra
  bez zmeny. `listZadny` sa kreslí len pri otočení späť (14,55 s), kde sa obsah zhoduje so scénou pred ním.
  **Test:** na 11 hraniciach scén porovná obsah listu 1/240 s pred a po (ostrovy, čísla ostrovov, bunky zvončeka,
  alfa mriežky, hlavičky, zadaní); so starým kódom zlyhá „hranica flipDo (12.1 s): ostrovy 10 na 0“ vo všetkých formátoch.
- **Odkaz pilulky na webe:** `odkazy()` dáva okná `casy` (`CASY_ODKAZU`: 0 až 3,5 s v háku, od 16,0 s do konca)
  namiesto `od: T.url`. `engine/prehravac.js` (len táto kópia, nie `ops/video/kodfilm/engine`) okná podporuje, bez nich
  platí `od` ako predtým. Statický plagát pri zníženom pohybe (1,0 s) je v okne, odkaz je aktívny; pred ťuknutím
  (stav `obal`) ostáva skrytý, ťuk spúšťa film. **Test:** plagát v okne a každú 1/60 s: pilulka v plnom kontraste
  znamená aktívny odkaz, aktívny odkaz nikdy bez nakreslenej pilulky. Klik v prehliadači nevykonaný.
- `film.plagat = 1.0` bez zmeny; `poster.png` exportuje Fable pri kontrole.

`node test.mjs` po pokuse 3: OK, 4 formáty x 601 snímok, 55 021 textov, najmenšie písmo 37,3 px, 151 zvukov,
21 krokov riešenia bez hádania.

Kontrolné snímky 1080x1920 pri 1; 11,8; 11,95; 12,05; 12,1; 12,15; 12,25; 12,5 s:
`ops/video/out/kodfilm/advent-kalendar/kontrola-p3/advent-p3-1080x1920-harok.png`. Prezreté: 11,95 až 12,15 s prázdna
zadná strana, hlavička nabieha od 12,1 s, prvý ostrov 12,25 s, päť ostrovov 12,5 s; žiadne bliknutie kruhov.

## Skóre podľa `ops/video/studio/kritika.txt` (pokus 2, zo snímok, nie z MP4)

| Ohľad | Skóre | Dôvod |
|---|---|---|
| hák v prvých 2 s | 9 | snímka 0: skutočný list PDF s hlavolamom a zvončekom, názov, štítok PRINTABLE PDF, ponuka a adresa; zvuk od snímky 0 |
| čitateľnosť na mobile | 9 | ponuka a adresa 3,15 až 3,2 s na začiatku a 3,8 až 4,3 s na konci v plnom kontraste (test), písmo aspoň 37 px, titulky na čistej ploche |
| kvalita pohybu | 8,5 | reset, priblíženie a návrat listu pružinou v uzavretom tvare (prekmit 2,8 %), bunky s prekmitom 2,3 %; otočenie listu je stále kosínusové zúženie, nie 3D |
| pestrosť | 8,5 | nové každé 2 až 3 s (reset, riešenie, zvonček, otočenie, Hashi, obnova); hák a záver spolu 7,5 s rovnakého záberu, oživené odleskom a snehom |
| kompozícia | 9 | texty v zóne vo všetkých 4 formátoch (test), stoh s medzerou k textom, štítok bez kolízie aj v 4:5 po oprave |
| presnosť značky | 8,5 | vizuálny jazyk kalendára (Serif ako na obrázku ponuky, uznaná odchýlka), skutočné listy, zadanie aj riešenie; jedna akcentová červená |
| synchron zvuku | neoverené | reset 3,3, riešenie 4,0, zvonček 9,0, otočenie 11,5, záver 15,0 na dobách 120 BPM; LUFS a špičku zmeria až render (Fable) |

Tri najväčšie zvyšné problémy: (1) hlasitosť a špička nezmerané (render, Fable; partitúra sa zmenila, pridané tiché
pady v háku a závere); (2) 4:5 po presune hviezd nie je prezreté na snímke (len výpočet a test); (3) v 1:1 a 4:5 majú
dvojice „10 10“ v zadaniach stĺpcov bunku 48 až 51 px pri písme 37,8 px, čitateľné, ale tesné.

## Otvorené

- Render so `--sub auto`, `kontrola.mjs` na MP4 (plagát 1,0 s, šev, mobil), meranie hlasitosti a brána pokus 2 (Fable).
- `og:image` stránka zatiaľ nemá (obrázok z plagátu 1,0 s treba vyrenderovať); test zámerne zlyhá, ak ho niekto pridá.
- Ak sa zmení cena alebo ponuka na Etsy, test zlyhá na fakte (zámer).

## História

Pokus 1 (kalendár s 24 dvierkami, ponor kamery do okienka 1, 19 s) neprešiel bránou Astry 28. 9.: obraz predával
iné balenie než PDF, ponuka mala na čítanie 1,1 až 1,45 s, plagát ukazoval prázdny list. Opravy pokusu 1 (ponor bez
bliknutia, otočenie späť, titulky mimo pohybu kamery) sú v histórii súboru; s odchodom dvierok stratili význam.
