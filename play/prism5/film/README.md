# Prism 5: film nakreslený kódom

25. 9. 2026, Fable. Stránka `https://arling.sk/play/prism5/film/` (zatiaľ bez odkazov z iných stránok,
doplní Fable pri nasadení). Engine: `ops/video/kodfilm/` (tu je jeho kópia v `engine/`, obnoví ju
`node ops/video/kodfilm/kopiruj.mjs products/arling-sk/play/prism5/film`).

## Súbory

| Súbor | Čo je |
|---|---|
| `index.html` | stránka v hube: hlavička, päta, CSP bez vložených skriptov, Umami, JSON-LD (WebPage, MobileApplication, FAQPage), popis scén pre čítačky |
| `film.css` | plátno 16:9 na počítači (výška podľa okna), 9:16 do 760 px, ovládače |
| `strana.js` | vstup stránky (prehrávač s ovládačmi) |
| `render.html`, `render.js` | len plátno na celé okno pre `render.mjs` (noindex) |
| `film.js` | film: časová os, vrstvy, scény, partitúra |
| `drahokamy.js` | päť drahokamov kódom (fazety, lesk, žiara) |
| `og.jpg` | 1200x630, snímka STAREJ verzie filmu (s oblasťami); treba nahradiť snímkou z novej (napr. 16 s z 1920x1080, orezanou) |

## Časová os (14 s, verzia 3 z 25. 9. 2026 v noci: hák bez „slidu“, bez prázdnej mriežky)

Pravidlá vo filme: každý z 5 drahokamov raz v každom riadku a stĺpci. Žiadne oblasti, žiadna námraza.
Oproti verzii 2 (18 s) vypadlo státie hotovej dosky 0 až 1,3 s, prázdna mriežka pri 2 s a 5 s dopadu
16 drahokamov; zadanie vznikne rovno z hotovej dosky.

| Čas | Obraz | Zvuk |
|---|---|---|
| 0 až 0,55 | hák: drahokamy po uhlopriečkach padajú do mriežky (na snímke 0 sú 3 uhlopriečky dole, 3 vo vzduchu), vedľa „Prism 5“ (odlesk), „Five gems. One daily grid.“, „Each gem once in every row and column.“ | dopad, akord C, zvony, tón každej uhlopriečky (pentatonika nahor) |
| 0,5 až 1,3 | svetelná vlna po hotovej doske, trblietky | trblietanie |
| 1,15 až 1,55 | text háku klesne a zmizne | švih nadol |
| 1,3 až 2,0 | 9 drahokamov vyskočí, ostane zadanie (16), doska sa zväčší do stredu | klesajúce zvončeky |
| 1,45 až 3,75 | štítok DAILY GEM PUZZLE, titulok „Every row and every column holds each gem once.“, trblietky na zadaní | plocha C |
| 3,55 až 6,75 | stlmenie okrem riadku 4 (zhora) a troch hviezd; „Where can the star go in this row?“; lúče z hviezd zhasnú tri bunky; „Only one place for the star.“, hviezda dopadne | Am, sklzy, F, jasný zvon G5 a G6 |
| 6,95 až 8,15 | posledných 8 drahokamov | stúpajúce arpeggio |
| 8,15 až 9,25 | svetelná vlna po doske | nádych a zvonkohra |
| 8,9 až 14 | doska do koncovej polohy, názov, vety, nápis „Coming soon to Google Play“ (bez pilulky a bez ▶, nevyzerá ako odznak obchodu), adresa arling.sk (69 px pri 1080x1920) | akord C, zvon C4 |

Kritik (25. 9.): za tento film neplatiť v Meta Ads, kým appka nie je v Google Play; organicky ho
zverejniť až v deň vydania s odkazom na Play.

Riešenie `QTDCS / DCSTQ / CSTQD / TDQSC / SQCDT` je platný latinský štvorec (film.js to pri načítaní
overí); nie je to denná mriežka appky, lebo appka nové pravidlá ešte nemá (`ops/games/prism5/rs-stav.md`).
Poradie dopadu je naše, dedukcia hviezdy je platná pre stav, ktorý film ukazuje.
Štítok „Coming soon to Google Play“ nevedie do obchodu (appka tam nie je), ale na `#about`.
Veta „Reasoned, not guessed“ vypadla: pre pravidlá bez oblastí zatiaľ nie je overené, že každá denná
mriežka sa dá vyriešiť bez hádania.

Rozloženie: 9:16, 4:5 a 1:1 pod sebou (doska, pod ňou text), 16:9 doska vľavo a text vpravo. Pri 9:16 je
všetok text v pásme x 12 až 88 % a y 8 až 80 % (bezpečná zóna Shorts a Reels, `engine/hak.js`).

Výkon nižšie je zmeraný na verzii 1 (20 s, s oblasťami); verzia 2 kreslí o vrstvu menej (bez hraníc
oblastí), nová meraním zatiaľ nie je.

## Výkon (zmerané 25. 9. 2026, `ops/video/kodfilm/meraj.mjs`, headless Chrome 153, PC s 16 vláknami)

CPU = prírastok `Performance.getMetrics` TaskDuration hlavného vlákna za sekundu (percento jedného jadra).
Headless Chrome beží na 75 Hz, preto 75 snímok za sekundu.

| Scenár | Pokoj pred ťuknutím | Prehrávanie (6 s) | Mimo obrazovky | Po konci |
|---|---|---|---|---|
| Mobil 390x844, DPR 2 | 0,0 %, rAF stojí | 4,8 % CPU, 74,9 fps, interval p95 13,5 ms, max 13,6 ms, kresba 0,18 ms na snímku | 0,0 %, rAF stojí | 0,0 %, rAF stojí |
| Počítač 1440x900, DPR 1 | 0,1 % | 4,5 % CPU, 74,9 fps, p95 13,5 ms, kresba 0,16 ms | | 0,0 % |
| Mobil so spomalením CPU 6x | 0,3 % | 40,2 % CPU, 74,9 fps, p95 13,4 ms, kresba 1,66 ms (max 4,3 ms) | | 0,1 % |
| Znížený pohyb | 0,0 %, statický plagát, film len na tlačidlo | | | |

Čo to znamená: v pokoji film neberie nič, počas 20 s hrania na bežnom počítači okolo 5 % jedného jadra
hlavného vlákna a snímky nepadajú ani pri 6x pomalšom procesore. Nie je v tom započítaná práca GPU
procesu (skladanie plátna); headless Chrome kreslí bez skutočnej GPU, na telefóne s GPU to býva lacnejšie.
Skryté karty (`document.hidden`) pauzujú film aj zvuk (`AudioContext.suspend`); v headless som to
nemeral, logika je v `engine/prehravac.js`.

Veľkosť: JavaScript spolu 79 KB, gzip 26 KB (film.js 12 KB, engine 13 KB, drahokamy 2 KB), žiadny obrázok
okrem `og.jpg` pre sociálne siete.

## Skúšobný render (2 s, 25. 9. 2026)

`node ops/video/kodfilm/render.mjs --url http://127.0.0.1:8871/play/prism5/film/render.html --nazov prism5-film --formaty 1080x1920,1920x1080 --fps 30 --do 2`

| Formát | Súbor | Snímok | Render | Veľkosť |
|---|---|---|---|---|
| 1080x1920 | `ops/video/out/kodfilm/prism5-film-1080x1920-0-2s.mp4` | 60 | 4,5 s (13,2 snímky/s), zvuk 0,17 s | 2,7 MB |
| 1920x1080 | `ops/video/out/kodfilm/prism5-film-1920x1080-0-2s.mp4` | 60 | 4,5 s (13,3 snímky/s), zvuk 0,17 s | 2,7 MB |

H.264 yuv420p 30 fps, AAC 48 kHz stereo, dĺžka presne 2,000 s (ffprobe). Celý 20 s zvuk: priemer -25 dB,
špička -4,8 dB, bez orezania. Celý film: rovnaký príkaz bez `--do 2` (odhad 45 s na formát).
