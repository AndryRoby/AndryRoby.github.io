# Detective kit: film nakreslený kódom

25. 9. 2026, Fable. Stránka `https://arling.sk/shop/detective-kit/film/` (zatiaľ bez odkazov z iných stránok,
doplní Fable pri nasadení). Predmet: tlačiteľná hra „The Case of the Missing Birthday Cake“, 6,90 EUR,
stránka `/shop/detective-kit/`. Engine: `ops/video/kodfilm/` (kópia v `engine/`, obnoví ju
`node ops/video/kodfilm/kopiruj.mjs products/arling-sk/shop/detective-kit/film`).

**Vinník sa vo filme ani na stránke neprezradí.** Film ukáže jednu stopu, ktorá vylúči jednu zo 5 postáv
(Olive), a cvičný kód zo strany s kotúčom, nie Dotin odkaz z karty 8.

## Súbory

| Súbor | Čo je |
|---|---|
| `index.html` | stránka v hube: hlavička, päta, CSP bez vložených skriptov, Umami (web shopu), JSON-LD (WebPage, FAQPage), popis scén pre čítačky |
| `film.css` | plátno 16:9 na počítači, 9:16 do 760 px, ovládače, tlačidlo prehrať na plagáte |
| `strana.js` | vstup stránky (prehrávač s ovládačmi) |
| `render.html`, `render.js` | len plátno na celé okno pre `render.mjs` (noindex) |
| `film.js` | film: časová os, rozloženie pre 4 formáty, vrstvy, scény, partitúra |
| `kresby.js` | vygenerované SVG zo sady (5 podozrivých, karty dôkazov 1 až 5), `node ops/video/kodfilm/detective-kit/postav-kresby.mjs`; needitovať ručne |
| `og.jpg` | 1200x630, záverečná snímka 16:9 (19,5 s) |

Kresby sú tie isté vektory ako v PDF (`ops/produkty/detektiv-sada/kresby.mjs`). Film ich načíta ako
`data:image/svg+xml` (CSP `img-src data:`) a pri stavbe vrstiev ich raz vykreslí do offscreen plátien
v presnej veľkosti. Plátno sa tým nezašpiní, `toDataURL` v rendri funguje.

## Zmeny po kritike (25. 9. 2026 v noci)

- Snímka 0 (obal v IG a FB feede): štyri karty už ležia na stole, karta 2 v strede padá kolmo z výšky
  (dopadne pri 0,34 s), žiadna karta neletí cez podtitul a v 9:16 nič nejde za 88 % šírky.
- Cena „6.90 EUR at arling.sk/shop“ je už v háku (rovnaké zloženie ako záver). Na konci (19,35 až 20 s) sa
  karta 2 zdvihne do výšky zo snímky 0, takže slučka nemá skok.
- 1:1 a 4:5: blok textu končí na 90 % výšky (výzva aspoň 10 % od spodku). Kicker 36 px+, názov s rezervou 6 %.

## Časová os (20 s, pôvodná verzia; zmeny vyššie)

| Čas | Obraz | Zvuk |
|---|---|---|
| 0 až 1,3 | hák: 5 kariet dôkazov dopadá na orechový stôl (2 už ležia, 3 letia zdola a zboku), „THE CASE OF THE / Missing Birthday Cake“ s odleskom, „Printable detective party game, ages 8 to 12.“ | dopad, akord Am, zvony A4 E5 A5, dopady kariet |
| 1,15 až 1,9 | text háku odíde, karty sa zosunú zo stola von | švih nadol |
| 1,6 až 3,75 | fotka kuchynského okna (kresba karty 4: prázdny tanier), „The kitchen window at 3:20“, titulok „Granny Badger’s birthday cake has vanished.“ | dopad, Am, zvony E5 C5 |
| 3,6 až 6,35 | rozdá sa 5 kariet podozrivých (3 + 2), „Five helpers. Only one was at the kitchen window.“ | každá karta svoj tón A4 C5 D5 E5 G5, plocha C |
| 6,4 až 7,0 | podozriví sa zmenšia, karta dôkazu 2 „Footprints in the soil“ priletí zľava | Am |
| 7,0 až 8,4 | lupa prejde po stopách (zväčšené blany), „Clue 2: webbed footprints in the vegetable patch.“ | sklz, šum |
| 8,3 až 10,7 | ostatní stmavnú, červená niť k Olive, karta sa zdvihne, pečiatka „NOT AT THE WINDOW“; „Only Olive has webbed feet. She was not at the window.“ | sklz, zvon A5, úder pečiatky |
| 10,55 až 14,4 | kódový kotúč, vnútorný kruh 5 cvaknutí (kľúč 5, „inner A under F“), výsek ukazuje písmená, MTSJD HFPJ sa rozlúšti na HONEY CAKE; „Turn the code wheel and crack the secret code.“ | 5 cvaknutí, stúpajúca pentatonika C5 až G6, trblietka |
| 14,2 až 16,4 | zapečatená obálka „Top secret / A letter from the helper who was at the kitchen window.“ (text strany 14 sady), pečať dvakrát pulzuje; „The answer waits in a sealed letter.“ | Dm, dva údery srdca |
| 16,55 až 20 | karty znova dopadnú (rovnaké zloženie ako hák, slučka), názov, veta, štítok „6.90 EUR at arling.sk/shop“ s odleskom | dopady, akord C, zvony C4 G4 E5 G5 C6 |

Štítok s cenou je na stránke neviditeľný odkaz na `/shop/detective-kit/` (udalosť `detective_film_to_kit`),
viditeľný od 18,15 s. Pravdivosť: čísla a texty sú zo sady (`pripad.mjs`, stránka shopu): 6,90 EUR,
8 až 12 rokov, 5 podozrivých, karta 2 (blanité stopy v zeleninovom záhone), cvičný kód HONEY CAKE s kľúčom 5
(`CVIK`), obálka strany 14. `film.js` pri načítaní overí, že kód sedí a že blany má jediná postava.

Rozloženie: 9:16, 4:5 a 1:1 pod sebou (titulok hore, obsah pod ním), 16:9 obsah vľavo, text vpravo. Pri 9:16
je všetok text aj karty háku v pásme x 12 až 88 % a y 8 až 80 % (`engine/hak.js`, zóny skontrolované
`render.mjs --zony`). V scéne stopy sa plocha delí: na výšku karta hore a podozriví dole, inak karta vľavo.

## Výstupy (25. 9. 2026)

`ops/video/out/kodfilm/detective-kit/`: `detective-kit-1080x1920.mp4`, `-1920x1080.mp4`, `-1080x1080.mp4`,
`-1080x1350.mp4`, každé 20,000 s, H.264 + AAC 48 kHz, -14,1 LUFS, skutočná špička -1,7 dBTP (ffprobe
a loudnorm), 17 až 28 MB; hárky `detective-kit-<formát>-harok.png` a snímky `-t<čas>.png`.

## Výkon (zmerané 25. 9. 2026, `ops/video/kodfilm/meraj.mjs`, headless Chrome, PC so 16 vláknami)

CPU = prírastok TaskDuration hlavného vlákna za sekundu (percento jedného jadra). Headless beží na 75 Hz.

| Scenár | Pokoj pred ťuknutím | Prehrávanie (6 s) | Mimo obrazovky | Po konci |
|---|---|---|---|---|
| Mobil 390x844, DPR 2 | 0,0 %, rAF stojí | 5,2 % CPU, 74,9 fps, interval p95 13,5 ms, max 13,6 ms, kresba 0,16 ms (max 0,5) | 0,0 %, rAF stojí | 0,0 %, rAF stojí |
| Počítač 1440x900, DPR 1 | 0,0 % | 6,1 % CPU, 74,9 fps, p95 13,5 ms, kresba 0,19 ms (max 0,5) | | 0,0 % |
| Mobil so spomalením CPU 6x | 0,2 % | 36,3 % CPU, 74,9 fps, p95 13,4 ms, kresba 1,37 ms (max 3,9) | | 0,1 % |
| Znížený pohyb | 0,0 %, statický plagát, film len na tlačidlo | | | |

Po návrate na obrazovku (mobil) 73,4 fps, jeden interval 66,7 ms pri obnovení (prvá snímka po pauze).
Nezapočítaná je práca GPU procesu. Stránka: `over-stranku.mjs` bez chýb v konzole, odkaz nad štítkom pri
prejdení myšou farba rgba(0,0,0,0), bez podčiarknutia, kurzor pointer, fokus Tab rámik 3 px.

Veľkosť: JavaScript spolu 122 KB, gzip 38 KB (film.js 51 KB / 16 KB, kresby.js 25 KB / 4 KB, engine 46 KB /
18 KB), okrem `og.jpg` žiadny obrázok.

## Známe veci

- `render.mjs` aj tu po poslednom MP4 visel pri zatváraní prehliadača (Chrome už nebežal); všetky 4 MP4
  a hárky boli hotové, proces ukončil môj časový limit. `meraj.mjs --sirka 1440` prvý raz neskončil do
  200 s, druhý beh s 280 s prešiel.
- Pri 1:1 je scéna stopy menšia (karty podozrivých okolo 170 px), text kariet je čitateľný len na väčšej
  obrazovke; hlavnú správu nesie titulok.
