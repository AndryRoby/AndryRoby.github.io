# Hedgehogs: film nakreslený kódom

25. 9. 2026, Fable. Stránka `https://arling.sk/games/hedgehogs/film/` (zatiaľ bez odkazov z iných stránok,
nenasadená; priečinok má `.gitignore` s `*`, aby ho nočná úloha nezverejnila, pred nasadením ho Fable
odstráni). Engine: `ops/video/kodfilm/` (kópia v `engine/`, obnoví ju
`node ops/video/kodfilm/kopiruj.mjs products/arling-sk/games/hedgehogs/film`).

## Súbory

| Súbor | Čo je |
|---|---|
| `index.html` | stránka v hube: hlavička, päta, CSP bez vložených skriptov, Umami, JSON-LD (WebPage, WebApplication, FAQPage), popis scén pre čítačky, tlačidlo „Play today's garden“ |
| `film.css` | plátno 16:9 na počítači, 9:16 do 760 px, ovládače (vzor Prism 5, teplé farby hry) |
| `strana.js`, `render.html`, `render.js` | vstup stránky a len plátno pre `render.mjs` (noindex) |
| `film.js` | film: záhrada, overenie pri načítaní, časová os, vrstvy, scény, partitúra |
| `jezko.js` | ježko kódom: ten istý obrys ako v hre (`--hviezda` v `games/hedgehogs/index.html`), telo, bodliny, tvár, žiara |

Obrázok `og:image` zatiaľ ukazuje na `og.png` hry (`/games/hedgehogs/og.png`); vlastný obrázok filmu nie je.

## Záhrada a dedukcia (pravdivosť)

- Záhrada: archívny deň **2026-06-01** (Easy, 8 x 8, 8 záhonov), z `games/hedgehogs/dni/2026-06.json`, teda z
  generátora hry. Je verejná v archíve (`/games/hedgehogs/2026-06-01/`), nie je to dnešná ani budúca záhrada.
- Overené 25. 9. 2026 skriptom (scratchpad `filmy/over-zahradu.mjs`, volá kód hry): `solve()` z
  `generator.mjs` našiel práve 1 riešenie pri úplnom prehľadaní a je zhodné s uloženým, `checkSolution()`
  0 chýb, `jeVyriesene()` z `logika.mjs` true.
- `film.js` pri načítaní znova overí: 2 ježkovia v každom riadku, stĺpci a záhone, žiadni sa nedotýkajú; stav
  pred dedukciou je podmnožina riešenia; v riadku 3 z pravidiel (dotyk, plný stĺpec, plný záhon) ostane
  práve bunka 17 a film vylučuje presne tie bunky, ktoré vylučujú pravidlá. Pri chybe film vyhodí výnimku.
- Dedukcia: pred ňou stojí 10 ježkov (32, 3, 62, 19, 48, 1, 29, 60, 31, 50, poradie je naše kvôli hudbe).
  Riadok 3 má ježka v bunke 19 a potrebuje druhého. Bunky 18 a 20 sa dotýkajú ježka 19, bunky 20, 21 a 22
  ježka 29, bunky 22 a 23 ježka 31; bunka 16 je v stĺpci 1, ktorý už má ježkov 32 a 48. Ostane bunka 17.
  Hra sama by na tomto stave radila najprv bodky okolo ježkov (`napoveda` = „susedia“), čo je ten istý dôvod.

## Zmeny po kritike (25. 9. 2026 v noci)

- Hák: snímka 0 je priblíženie kamery 2,2x na ježkov 32 a 34 (34 poskočí), do 1,15 s sa kamera vzdiali na
  celú záhradu; názov je pod záhradou od snímky 0. Na konci (18,15 až 19 s) sa kamera znova priblíži, takže
  slučka nadväzuje. Kamera má vlastnú ostrú záhradu a ježka (bez rozmazania pri 2,2x), orezaná na rám záhrady.
- Záhony 0,30 namiesto 0,16 a karta #221c17 (záhrada menej ponurá), ježko 1,2 bunky.
- Titulky bez medzier: 1,45 až 14,2 s, nový „Five more, and the garden is solved.“ (12,25 až 14,2).
- Štítok „DAILY LOGIC PUZZLE“ 36 px+, tiráž pre vývojárov vypadla, veta2 36 px+, názov v 9:16 do 0,74 šírky.
- Výkon po zmene nemeraný (kamera kreslí 2 vrstvy navyše len do 1,15 s a od 18,15 s).

## Časová os (19 s, pôvodná verzia; zmeny vyššie)

| Čas | Obraz | Zvuk |
|---|---|---|
| 0 až 1,3 | hák: vyriešená záhrada v koncovej polohe, svetelná vlna po uhlopriečke a ježkovia v nej poskakujú, dýchajú; „Hedgehogs“ (odlesk), „A new garden every day.“, „Two hedgehogs in every row, column and flowerbed, never touching.“ | dopad, akord G, zvony G5 D6 G6, ťuky poskokov |
| 1,15 až 1,55 | text háku klesne a zmizne | švih nadol |
| 1,3 až 1,95 | ježkovia po uhlopriečkach vyskočia a schovajú sa, prázdna záhrada sa zväčší | klesajúce zvončeky |
| 2,1 až 5,95 | titulok „Two hedgehogs in every row, column and flowerbed.“, 10 ježkov dopadne, každý riadok svoj tón | plocha G, zvony a ťuky |
| 6,2 až 8,0 | stlmenie okrem riadku 3 (prerušovaný žltý rámik ako nápoveda v hre), 7 duchov ježka; „Where does this row's second hedgehog go?“ | Em, sklz |
| 8,05 až 9,5 | „Not next to a hedgehog, not even at a corner.“ zóny bodlín okolo 19, 29, 31; 5 buniek blysne krížikom a stane sa bodkou (ako v hre) | šum, zvony B4 D5 E5, ťuky |
| 9,6 až 10,9 | „Not in a column that already has two.“ rámik stĺpca 1, lúč od ježka 48 nahor, bunka 16 bodkou | sklz D4 D5 |
| 10,95 až 12,4 | „Only one cell is left.“ žltý pulz, ježko dopadne do bunky 17 | C, jasný zvon D5 a D6 |
| 12,2 až 13,0 | posledných 5 ježkov | stúpajúce zvony |
| 13,2 až 14,3 | svetelná vlna, ježkovia poskočia, rám záhrady zazelenie (farba „hotovo“ v hre) | nádych a zvonkohra |
| 13,95 až 19 | záhrada do koncovej polohy (rovnaké zloženie ako hák, slučka), názov, vety, tlačidlo „Free at arling.sk/games“ (odkaz na `/games/hedgehogs/`), tiráž; občasný poskok jedného ježka | akord, zvon G3 |

Rozloženie: 9:16, 4:5 a 1:1 pod sebou, 16:9 záhrada vľavo a text vpravo. Pri 9:16 je všetok text v pásme
x 12 až 88 % a y 8 až 80 % (skontrolované snímkami so zónami); záhrada zasahuje do pravých 12 % o 7 px
(pri 1080 px), dedukcia (stĺpce 1 a 2) je vľavo.

## Výkon (zmerané 25. 9. 2026 večer, `ops/video/kodfilm/meraj.mjs`, headless Chrome, PC s 16 vláknami)

CPU = prírastok `Performance.getMetrics` TaskDuration hlavného vlákna za sekundu (percento jedného jadra).
Headless Chrome beží na 75 Hz, preto okolo 75 snímok za sekundu.

| Scenár | Pokoj pred ťuknutím | Prehrávanie (6 s) | Mimo obrazovky | Po konci |
|---|---|---|---|---|
| Mobil 390x844, DPR 2 | 0,1 %, rAF stojí | 6,7 % CPU, 74,6 fps, interval p95 13,5 ms, max 40 ms (jedna snímka pri štarte), kresba 0,25 ms na snímku (max 1,5 ms) | 0,0 %, rAF stojí | 0,0 %, rAF stojí, stav koniec |
| Počítač 1440x900, DPR 1 | 0,0 % | 6,2 % CPU, 74,8 fps, p95 13,5 ms, max 26,7 ms, kresba 0,24 ms | 0,0 % | 0,1 % |
| Mobil so spomalením CPU 6x | 0,2 % | 50,4 % CPU, 74,4 fps, p95 13,5 ms, max 53,3 ms, kresba 2,2 ms (max 9,9 ms) | 0,2 % | 0,1 % |
| Znížený pohyb | 0,0 %, statický plagát, film len na tlačidlo | | | |

Čo to znamená: v pokoji film neberie nič; pri hraní okolo 6 až 7 % jedného jadra (Prism 5 mal 4,5 až 4,8 %,
Hedgehogs má 64 buniek, 16 ježkov a zóny bodlín). Pri 6x pomalšom procesore snímky nepadajú (p95 13,5 ms),
jednotlivé snímky do 53 ms. Nie je v tom práca GPU procesu; headless Chrome kreslí bez skutočnej GPU.
Pozor pri meraní: prvé meranie (pred opravou) našlo výnimku `arcTo` so záporným polomerom v prvej snímke
zóny bodlín, ktorá zastavila rAF (film ostal visieť v stave hra). Opravené v `film.js`; overené skriptom,
ktorý nakreslí každú snímku 0 až 19 s po 1/60 s vo všetkých 4 formátoch bez výnimky.

Veľkosť: JavaScript spolu 86 KB, gzip 29 KB (film.js 36 KB, jezko.js 4 KB, engine 46 KB). Žiadny obrázok.

## Render (25. 9. 2026 večer, po oprave)

`node ops/video/kodfilm/render.mjs --url http://127.0.0.1:8871/games/hedgehogs/film/render.html --nazov hedgehogs --fps 30 --snimky 0,1,1.6,4,7,8.9,10.3,11.7,13.6,17 --harok --out ops/video/out/kodfilm/hedgehogs`

| Formát | Súbor v `ops/video/out/kodfilm/hedgehogs/` | Veľkosť | Hlasitosť (ffmpeg loudnorm) |
|---|---|---|---|
| 1080x1920 | `hedgehogs-1080x1920.mp4` | 16,2 MB | -14,1 LUFS, špička -1,5 dBTP |
| 1920x1080 | `hedgehogs-1920x1080.mp4` | 15,6 MB | -14,1 LUFS, -1,6 dBTP |
| 1080x1080 | `hedgehogs-1080x1080.mp4` | 10,5 MB | -14,1 LUFS, -1,6 dBTP |
| 1080x1350 | `hedgehogs-1080x1350.mp4` | 12,8 MB | -14,1 LUFS, -1,8 dBTP |

Každé MP4: 19,000 s, H.264 30 fps, AAC 48 kHz (ffprobe). Hárky `hedgehogs-<formát>-harok.png` a snímky
`hedgehogs-<formát>-t*.png` v tom istom priečinku. Kontrolné snímky so zónami: scratchpad `filmy/h1`, `filmy/h2`.
Známa chyba nástroja: `render.mjs` po zapísaní všetkých súborov nevyšiel (visel pri `browser.close()`,
headless Chrome už nebežal) a JSON výsledok nevypísal; proces som po overení súborov ukončil. Stalo sa dvakrát.
