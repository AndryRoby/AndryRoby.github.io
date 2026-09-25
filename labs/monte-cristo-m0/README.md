# Monte Cristo: Wait and Hope, M0

Súkromný prototyp (noindex, nikde neodkázaný): kapitola 18 románu *The Count of Monte Cristo* ako hra v prehliadači. Postavil Fable (Claude) 25. 9. 2026 podľa `ops/monte-cristo/m0/technika.md`, `scenar-18.md` a `data-18.json`. Hra je len po anglicky.

Adresa na lokálnom serveri hubu: `http://localhost:8871/labs/monte-cristo-m0/`.

## Ako sa to hrá

1. Úvodná stránka: Château d'If za súmraku, kapitola 18 (69 sa ešte stavia), nastavenia. Ak je rozohraná kapitola, pribudne „Continue chapter 18“.
2. Kapitola začína ako kniha: titul, „Before“ (tri obrázky a tri vety), „What you know“.
3. Scéna je rez väzením: Edmondova cela, chodba pod stenou, Fariova cela. Hráč sa plazí chodbou, počúva, všíma si, drží veci v rukách, volí tón a číta listy. Každá replika a každé rozprávanie je doslovne z románu, s číslom riadku vpravo dole.
4. Faria rozpráva o Spadovcoch ako rytiny v červenom atramente; podčiarknutú vetu hráč zachytí podržaním Počúvania (alebo kliknutím na ňu) a tá mu neskôr pomôže pri liste.
5. M19, polospálený list: 14 útržkov Fariovho listu treba priložiť k 16 spáleným riadkom. Medzera za spáleným okrajom je presne taká dlhá ako správny útržok (pravítko v medzere, prečnievajúci útržok má červenú linku, krátky modrú). Po troch správnych riadkoch sa trojica zamkne. Pri najviac dvoch chybách sa ukáže „≈ almost“, pri viacerých sa zlé riadky vrátia, po dvoch neúspešných kontrolách sa Fariov list ukáže priesvitne na svojom mieste. Nič nie je na čas, game over neexistuje.
6. Koniec: mapa Stredomoria, atrament dokreslí bodkovanú cestu od If k ostrovu Monte Cristo a v Denníku sa otvorí celá kapitola (záložka Book).

## Ovládanie

| Akcia | Klávesnica a myš | Gamepad | Dotyk |
|---|---|---|---|
| chôdza, plazenie | A, D, šípky, klik na miesto | ľavá páčka, smerový kríž | ťuknutie na miesto |
| ďalej, interakcia | E, medzerník, Enter, ľavý klik, tlačidlo Continue | A | ťuknutie |
| držať (Ruky) | podržať E, medzerník alebo ľavé tlačidlo | podržať A alebo RT | podržať prst |
| Pozornosť | podržať F alebo pravé tlačidlo, alebo tlačidlo oka | LT | dva prsty, tlačidlo oka |
| Počúvanie | podržať S alebo tlačidlo ucha | B | dlhé podržanie, tlačidlo ucha |
| tón | 1, 2, 3 alebo klik | smerový kríž a A | ťuknutie |
| M19 | šípky hore a dole riadok, vľavo a vpravo útržok, E priloží, Backspace vráti, F nápoveda z Denníka; myšou ťahať alebo klik útržok a potom medzeru | páčka riadok, LB a RB útržok, A priloží, B vráti, LT nápoveda | ťahať alebo ťuknúť útržok a medzeru |
| Denník | Tab (keď je fokus na scéne) alebo J | Y | ikona knihy |
| predošlé repliky | Backspace, koliesko hore | | |
| pauza a nastavenia | Esc | Start | ikona pauzy |

Nastavenia (pauza): Hold to toggle (každé podržanie sa zmení na stlačenie), Reduce motion (bez parallaxu, dychu a prechodov, kamera strihá), Readable font, čísla riadkov, zvuk a hlasitosť. Uloženie: `localStorage` kľúč `arling-mc-m0`, v každom kontrolnom bode a po každom tóne; bez úložiska hra beží z pamäte a pauza to povie.

## Súbory

| Súbor | Čo robí |
|---|---|
| `index.html` | obal hubu podľa `games/escape/lighthouse/`, noindex, CSP bez cudzích zdrojov, žiadny inline skript |
| `m0.css` | celé rozhranie, všetko pod `.mc-obal` a `.mc-o` |
| `js/main.js` | štart, veľkosť plátna (mierka najviac 2,6, dpr najviac 2), poradie tlače, nastavenia |
| `js/jadro.js` | stavový automat nad dátami, bez DOM (to isté jadro hrajú roboty v Node) |
| `js/hra.js` | spája jadro, réžiu, scénu, rozhranie a vstupy; úkony, Pozornosť, Počúvanie, koniec |
| `js/rezia18.js` | réžia kapitoly 18: kde kto je, svetlo, kamera, úkony, ciele Pozornosti, gestá k tónom (všetko NÁVRH) |
| `js/scena.js` | skladanie vrstiev, kamera, svetlo, bábky, mapa |
| `js/slucka.js` | snímky na požiadanie, okolie 10 snímok za sekundu 20 s po vstupe, stop pri `document.hidden`, `window.__m0` |
| `js/tlac.js` | risografický lis: tri atramenty, raster, zrno, sútlač, maska pre vystrihnuté diely |
| `js/tlac-worker.js`, `js/lis-klient.js` | lis vo Web Workeri (OffscreenCanvas), inde po kúskoch na hlavnom vlákne |
| `js/kresby.js` | register všetkých kresieb podľa mena |
| `js/kulisy/vazenie.js` | rez väzením (zadná stena, rez a nábytok, lúče svetla) |
| `js/kulisy/tablo.js` | rytiny Fariovho príbehu (I až VI, prázdny prah), Rím 1807, obrázky „Before“, titul, mapa, úvod |
| `js/kulisy/detaily.js` | detaily pre úkony rukami (hárok, breviár, záložka, písmená) a kameň s rohožou |
| `js/postavy.js` | Edmond a Faria ako vytlačené bábky z dielov, pózy, chôdza, plazenie |
| `js/ruky.js` | výrez v kruhu pre úkony rukami |
| `js/mech/m19.js` | polospálený list |
| `js/ui.js`, `js/panely.js` | pás s replikou, stránky a listy, Denník, pauza, história |
| `js/vstup.js` | myš, klávesnica, dotyk, gamepad na akcie |
| `js/zvuk.js` | Web Audio: kroky, kvapky, papier, vlečenie, kameň, hlasy, praskanie, hodiny, dron |
| `js/ulozenie.js` | `localStorage` v try/catch |
| `data/`, `kniha/` | kópia dát a text kapitoly; **nikdy ručne**, vyrába ich `node ops/monte-cristo/m0/zostav.mjs` |

## Testy

Najprv Node (sekundy):

```
node ops/monte-cristo/m0/zostav.mjs
node ops/monte-cristo/m0/testy/verne.test.mjs
node ops/monte-cristo/m0/testy/pokrytie.test.mjs
node ops/monte-cristo/m0/testy/sprievodca.test.mjs
node ops/monte-cristo/m0/testy/dohratie.test.mjs
node ops/monte-cristo/m0/testy/jadro.test.mjs
node ops/monte-cristo/m0/testy/hra.test.mjs
```

`jadro.test.mjs` je T4 až T6 na skutočnom `js/jadro.js`: ideálny a chybujúci robot dohrajú obe kapitoly, uloženie v každom kontrolnom bode sa načíta a dohrá s rovnakým koncom, 200 náhodných behov dôjde do konca. `hra.test.mjs` je T9 a súvislosť: dáta v hre sú presná kópia, kniha sedí s románom, obal je noindex bez cudzích zdrojov a inline skriptu, v priečinku nie je rastrový súbor ani obrázok vložený v data URL, vo vlastnom texte nie je pomlčka, réžia pozná každý beat, úkon, cieľ Pozornosti a tón.

V prehliadači (jeden headless Chrome, port 8871): autopilot hrá cez skutočnú vstupnú vrstvu (udalosti klávesnice E, F, S, D, 1) celú kapitolu od titulu po mapu bez chyby v konzole. Snímky sú v `ops/monte-cristo/m0/snimky/` (1440 a 390 px).

## Výkon, zmerané 25. 9. 2026

Headless Chrome, 1440 x 900, dpr 1, softvérové vykresľovanie, CDP `Performance.getMetrics`:

| Meranie | Výsledok | Cieľ |
|---|---|---|
| pokoj (replika na obrazovke, 25 s bez vstupu, potom okno 10 s) | TaskDuration 0,035 % času, scéna spí (`__m0.spi`) | pod 1 % |
| skladanie snímky pri plazení a posune kamery | priemer 0,49 ms | pod 4 ms |
| tlač sveta (2 vrstvy 1400 x 360 jednotiek, 5 lúčov, 40 dielov bábok) | vo Web Workeri počas titulnej stránky | |

Ako zmerať znova: otvoriť stránku, spustiť kapitolu a v konzole sledovať `window.__m0` (`snimky`, `msSnimka`, `msPriemer`, `spi`). V pokoji sa `snimky` po 20 s prestanú meniť.

## Čo je slabé (poctivo)

* Gotické písmo papierov nemáme (hub má len ARLing Sans a Serif), listy sú v kurzíve ARLing Serif.
* Útržky v M19 sú písané po stĺpcoch, aby dĺžka sedela so stĺpcami knihy; kurzíva s rovnakou šírkou písmen vyzerá trochu ako písací stroj.
* Kulisy aj bábky kreslí kód jednoducho: tváre z profilu majú len oko a obočie, chôdza sú dve pózy. Vedľa Tails Noir je to papierové divadlo, nie ilustrácia.
* Zvuk je syntéza a v headless teste sa nedal počuť; hlasitosť a charakter treba overiť ušami.
* Gamepad a dotyk sú napojené podľa technika.md, ale overené len kódom a emuláciou dotyku na 390 px, nie skutočným ovládačom.
* Kapitola 69 v hre ešte nie je (jadro ju dohrá v teste, obraz, prevleky a karty chýbajú).
