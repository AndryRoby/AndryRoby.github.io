# The Pumpkin Fair Mix-Up: film nakreslený kódom

26. 9. 2026, Fable (agent). Stránka `https://arling.sk/shop/pumpkin-escape-kids/film/` (zatiaľ bez odkazov z iných
stránok, doplní Fable pri nasadení). Predmet: tlačiteľná úniková hra pre deti „The Pumpkin Fair Mix-Up“, 6,90 €,
stránka `/shop/pumpkin-escape-kids/`, na ktorú vedú reklamy Google Ads v USA a UK. Použitie: stránka sady,
YouTube Short s odkazom na kúpu, Reels. Engine: `ops/video/kodfilm/` (kópia v `engine/`, obnoví ju
`node ops/video/kodfilm/kopiruj.mjs products/arling-sk/shop/pumpkin-escape-kids/film`), stavba ako film
`shop/detective-kit/film/`.

**Film neprezradí, kde je Big Marigold, kto vozík odviezol, ani žiadnu odpoveď kariet 1 až 7.** Jediná odpoveď
vo filme je cvičné slovo OWL, ktoré sada sama tlačí vyriešené na karte 1 („Warm up. Kite is O, heart is W,
cloud is L: the word is OWL.“, `ops/produkty/pumpkin-escape-kids/strany.mjs` riadok 518).

## Súbory

| Súbor | Čo je |
|---|---|
| `index.html` | stránka v hube: hlavička a päta zo stránky sady, CSP bez vložených skriptov (hash len pre JSON-LD), Umami (web shopu, udalosti `pumpkin_film_*`), JSON-LD WebPage a FAQPage, popis scén pre čítačky |
| `film.css` | plátno 16:9 na počítači, 9:16 do 760 px, ovládače, tlačidlo prehrať na plagáte |
| `strana.js` | vstup stránky (prehrávač s ovládačmi) |
| `render.html`, `render.js` | len plátno na celé okno pre `render.mjs` (noindex) |
| `film.js` | film: 21 s, časová os `T`, rozloženie pre 4 formáty, vrstvy kreslené raz do spritov, scény, partitúra, `FAKTY` |
| `kresby.js` | vygenerované SVG zo sady (27 kresieb, žiadna s `<text>`), `node ops/video/kodfilm/pumpkin-escape-kids/postav-kresby.mjs`; needitovať ručne |
| `test.mjs` | test bez prehliadača: `node test.mjs` v tomto priečinku |
| `engine/` | kópia kodfilm enginu |

Kresby sú tie isté vektory ako v PDF (`ops/produkty/pumpkin-escape-kids/kresby.mjs`: `vozik`, `olive`, `juniper`,
`bramble`, `tekvica`, `lampionTvar`, `ikonaKarty`, `ikonaKodu`, `pecat`, `stuha`, `tekvicka`). Film ich načíta ako
`data:image/svg+xml` (CSP `img-src data:`) a pri stavbe vrstiev ich raz vykreslí do offscreen plátien. Čo
film kreslí sám (zjednodušené, stránka filmu to tak aj hovorí): koleso vozíka (kópia `koleso()` zo sady, aby
sa mohlo točiť), štítok „Where is Big Marigold?“, papierové karty (karta 1 = Olive a tri dlaždice cvičného
kódu, prehnuté karty = pás s obrázkom zo sady, text kariet sú sivé pásy), odznak a certifikát (rozloženie
podľa strán 14 a 15, ale len texty, ktoré sa zmestia v 36 px), lístie, články reťaze. Pečať `pecat` je
kresba sady bez nápisu po kružnici (vo filme by mal 8 až 11 px); miesto neho bodkovaný krúžok.

Hák (kolo 1 kontroly): snímka 0 ukazuje produkt, nie prázdny vozík. V korbe vozíka je kus sady: karta 1
(Olive's coded note s cvičným kite, heart, cloud, tá istá ako na strane 4, ktorá je verejná na stránke sady)
a za ňou vejár troch prehnutých kariet s pásmi pinecone, acorn, mitten (spodky kariet skryté za korbou, ako
keď rodič drží kôpku). Záver má to isté zloženie (vozík sa vráti s tým istým nákladom).

## Časová os (21 s)

| Čas (s) | Obraz | Titulok na plátne | Zvuk |
|---|---|---|---|
| 0 až 1,9 | hák: červený vozík s kartou 1 a vejárom troch prehnutých kariet v korbe (karty sa jemne kývu), štítok „Where is / Big Marigold?“ sa hojdá na rúčke, lampióny, padá lístie; názov „The Pumpkin Fair / Mix-Up“ (odlesk, priblíženie 1,035 klesá na 1), „A printable Halloween escape room for kids“, „Ages 6 to 10, 2 to 8 players“, štítok „6.90 € at arling.sk/shop“. Od 1,12 zmizne štítok a text, 1,32 až 1,95 vozík s kartami odíde doprava | | ťuk, akord C, zvony E5 G5 C6 od snímky 0; drevené ťuky kolies |
| 1,85 až 4,5 | Farmer Juniper príde zľava, Olive the Owl vyskočí, bublina s „?“, stopy kolies idú z obrazu | The prize pumpkin has gone missing. (1,9 až 4,45) | Am7, pochod 120 BPM (basový a vysoký ťuk) do 17,8 s |
| 4,45 až 7,2 | 7 hier dopadne na stôl: karta 1 (Olive's coded note) a 6 prehnutých kariet s obrázkom v premiešanom poradí (mitten, acorn, pinecone, pear, basket, leaf; nie poradie sady), 6,02 až 6,6 ich spoja články reťaze | Seven fair games in a chain. (4,45 až 7,05) | Fmaj7, každá karta tón C5 D5 E5 G5 A5 C6 D6, cinknutia článkov |
| 6,95 až 12,75 | karta 1 sa zväčší, tri dlaždice kite, heart, cloud, prázdne okienka, CODE KEY (hat A, kite O, sun T, heart W, bell I, cloud L, hotový v 8,35); 8,75, 9,45 a 10,15: krúžok na dvojici v kľúči, čiarkovaný oblúk k okienku, písmeno O, W, L (dopady 9,2, 9,9, 10,6); 10,65 žiara OWL, Olive poskočí (na výšku) | Warm up with Olive's picture code. (7,05 až 10,65), The word is OWL. (10,65 až 12,7, až keď OWL stojí v okienkach) | C dur, zvony dlaždíc, F pod písmenami, ceruzka, E5 G5 C6 na písmená, akord a trblietka na OWL |
| 12,8 až 15,3 | Olive's Answer Board so skrytými odpoveďami (sivé pásy), riadok s obrázkom acorn sa zakrúžkuje, prehnutá karta Acorn priletí a otvorí sa (Mrs Bramble a skrytý text) | Every answer opens the next card. (12,7 až 15,3) | Am, ceruzka, zvon A5, švih, papier (praskot), F a zvon C6 |
| 15,35 až 17,82 | odznak Fair Helper (NAME, COSTUME, rámik, pečať), certifikát Official Fair Helper, modrá stuha sa pripne | Fair Helper badges and certificates, too. (15,3 až 17,85) | F, G, zvony E5 G5 C6 |
| 17,85 až 21 | vozík sa vráti zľava s tým istým nákladom kariet (18,6 stojí), štítok sa zavesí; názov 18,15 (od 19,0 sa pomaly priblíži na 1,035 ako na snímke 0), veta 18,55, vek a hráči 18,8, štítok s cenou 19,15, odlesk 19,75. Posledná snímka = snímka 0 (kyvadlá, lampióny a lístie majú periódy, ktoré delia 21 s; test.mjs porovná skladanie oboch snímok do 1 px) | | kolesá, dopad, C dur, zvony C4 G4 E5 G5 C6 |

`film.plagat` = 1,0 s (hák, všetko čitateľné), tlačidlo prehrať nad stredom vozíka. Štítok s cenou je na stránke
neviditeľný odkaz na `/shop/pumpkin-escape-kids/` (udalosť `pumpkin_film_to_kit`), viditeľný od 19,15 s.
V háku je cena tiež (rovnaké zloženie ako záver), bez „buy now“ a bez naliehavosti.

Rozloženie: 9:16, 4:5 a 1:1 pod sebou (titulok hore, obsah pod ním), 16:9 obsah vľavo, text vpravo. Plocha na
výšku (9:16) dáva karty v 2 stĺpcoch a Answer Board nad kartou, inak 3 stĺpce a veci vedľa seba. Text len v
zóne `zona(W, H)`; texty s písmom sa zjavujú len z mierky 0,96 (bez prekmitu mimo svojej plochy), preto
`R.mp` = 36 px x 1,05.

## Fakty vo filme a ich zdroje

| Fakt vo filme | Zdroj |
|---|---|
| názov „The Pumpkin Fair Mix-Up“ | `ops/produkty/pumpkin-escape-kids/pripad.mjs` r. 13 (`HRA.nazov`) |
| „A printable Halloween escape room for kids“ | `pripad.mjs` r. 14 (`HRA.podnazov`, bez „6 to 10“), stránka sady r. 65 a meta r. 17 |
| „Ages 6 to 10“ | `pripad.mjs` r. 15 (`HRA.vek`), stránka sady r. 366 |
| „2 to 8 players“ | `pripad.mjs` r. 16 (`HRA.hracov`), stránka sady r. 366 |
| „6.90 € at arling.sk/shop“ | `ops/stripe/sady.mjs` r. 114 (`suma: 690` pri `pumpkin-escape-kids`), stránka sady r. 389 |
| „Seven fair games in a chain“, „Every answer opens the next card“ | `pripad.mjs` r. 367 až 438 (`ZAMKY`, 7 kariet, `otvori`), stránka sady r. 370 („7 fair games in a chain, and every answer opens the next card“) |
| karta 1 leží na stole, karty 2 až 7 majú obrázky acorn, leaf, pear, mitten, basket, pinecone (vo filme premiešané, na stránke filmu abecedne) | `pripad.mjs` r. 369 až 429 (`karta`) |
| štítok „Where is Big Marigold?“ (otázka, nie tvrdenie; vozík vo filme nesie sadu) | príbeh `pripad.mjs` r. 55 (`PRIBEH`: vozík zmizol aj s tekvicou) |
| odpoveď karty 1 otvorí kartu Acorn, na nej Mrs Bramble | `pripad.mjs` r. 369 (`otvori: 'acorn'`), r. 379 až 380 |
| kľúč hat A, kite O, sun T, heart W, bell I, cloud L; cvičné OWL | `pripad.mjs` r. 112 (`KOD`), r. 117 (`CVIK`), `strany.mjs` r. 518 |
| „The prize pumpkin“ | stránka sady meta r. 17 („a missing prize pumpkin“), `pripad.mjs` r. 57 (Big Pumpkin Contest) |
| odznaky Fair Helper a certifikáty Official Fair Helper | `strany.mjs` r. 44 a 45, 572 až 600; stránka sady r. 438 a 450 |
| postavy Farmer Juniper (ježko) a Olive the Owl | `pripad.mjs` r. 26 až 32 |

`test.mjs` tieto fakty porovnáva priamo so `pripad.mjs`, `sady.mjs` a stránkou sady (riadky sa môžu posunúť,
test nie).

## Čo film zámerne neukazuje (spoilery)

- kde je Big Marigold a kto vozík odviezol (koniec, strana 11): žiadne `koniecScena`, `basilVcela`, stodola, včielka, Basil
- odpovede kariet 1 až 7 (PLUM, 635, LIGHTS, GLOW, BASIL, BARN, 5763): žiadna polica s koláčmi, bludisko, stan, fotky z prehliadky, nálepky ani zámok; Olive's note (THE WORD IS PLUM) sa neukazuje, len cvičné OWL
- `marigoldScena` zo strany 2: na stopke sú 3 listy, čo je číslo zámku; Big Marigold vo filme nie je vôbec
- poradie kariet 2 až 7 (kľúč, podľa ktorého rodič vydáva karty): v reťazi premiešané, žiadni dvaja susedia
  ako v sade, náklad vozíka tiež nie za sebou; na stránke filmu abecedne
- Answer Board: odpovede sú skryté sivými pásmi a poradie obrázkov vo filme nie je poradie v sade (scarf, feather, acorn, boot, pear), takže zakrúžkovaný riadok nenapovedá odpoveď
- karta Carrot (koniec) nie je medzi siedmimi hrami a ani v `kresby.js`
- `test.mjs` hľadá odpovede a slová barn, basil, bee, bumblebee, wagons vo všetkých textoch filmu aj v
  `index.html` a kontroluje, že `kresby.js` obsahuje len povolené kresby bez `<text>`

Poctivo: vo filme nie je „kids love it“, „tested“, recenzie ani naliehavosť. Stránka filmu hovorí, že čas hry
30 až 45 minút je odhad a hru ešte nikto nehral (ako `predaj.md` a `pripad.mjs` r. 21).

## Test

`node test.mjs` (26. 9. 2026, po kole 1 kontroly): OK, 4 formáty x 631 snímok (po 1/30 s), 14 366 textov,
najmenšie písmo 36,4 px, 185 zvukov, fakty sedia so sadou, bez spoilerov. Overuje: výnimky ako v prehliadači,
NaN, text v zóne, písmo aspoň 36 px (plus žiadny `<text>` v kresbách, ten by meranie nevidelo), prekryvy textov
(aj vo vnútri spritov; rovnaké texty z rôznych spritov sa tiež kontrolujú), napoly zamaskovaný text, slučku
(snímka 0 a posledná skladajú tie isté obrázky do 1 px; overené aj naschvál pokazenou mierkou názvu, test
zlyhal), časy a nástroje zvukov, čas čítania titulkov, pomlčky, fakty, poradie kariet a spoilery vo filme aj
v `index.html` (vek, hráči, 16 strán, A4 a US Letter, 6.90 €, „nobody has played it yet“, zakázané slová).

Čo test neoverí a treba to pozrieť na kontrolných snímkach s `--zony`: prekryv textu s kresbou (vozík, náklad,
štítok, Olive proti CODE KEY) a skutočnú šírku písma (šírka je odhad a rozloženie ju meria tou istou
funkciou, takže kontrola šírky je kruhová).

## Pre Fabla: kontrolné snímky a render

Statický server z `products/arling-sk` na porte 8871 (ako pri iných filmoch), potom z koreňa repa:

```
node ops/video/kodfilm/render.mjs --url http://127.0.0.1:8871/shop/pumpkin-escape-kids/film/render.html --nazov pumpkin-escape-kids --snimky 0,1,1.5,3,5.5,6.6,8.5,9.5,10.9,12.2,13.8,14.9,16.6,18.4,21 --harok --zony --bez-videa --out <scratchpad>
```

Pozrieť hlavne: náklad kariet v korbe v háku (či je karta 1 čitateľná ako kus sady a pásy vejára vidno vo
všetkých formátoch), prechod z háku (1,1 až 1,9: text a štítok zmiznú skôr, ako vozík odíde), veľkosť názvu v
9:16 (skutočné pätkové písmo), štítok na rúčke v 1:1 (prekryv s pravou kartou vejára je zámerný, štítok visí
vpredu), pečať `pecat` bez nápisu, karty v 1:1.
Potom render všetkých 4 formátov (na pozadí, nič iné ťažké popri tom):

```
node ops/video/kodfilm/render.mjs --url http://127.0.0.1:8871/shop/pumpkin-escape-kids/film/render.html --nazov pumpkin-escape-kids --out ops/video/out/kodfilm/pumpkin-escape-kids
```

Po rendri: 3 snímky z MP4 (ffmpeg `-ss`), ffprobe a hlasitosť z JSON (-14 LUFS, špička pod -1 dBTP), verzia
`-yt` 1440p s popisom a UTM odkazom na `/shop/pumpkin-escape-kids/`, stránka `over-stranku.mjs` a `meraj.mjs`
(výsledky sem). `og:image` stránky filmu zatiaľ ukazuje `og.jpg` sady; vlastný `film/og.jpg` (záverečná snímka
16:9, 1200 x 630) doplní Fable po rendri a upraví `og:image`. JSON-LD VideoObject pribudne až s URL videa na
YouTube a dátumom nahratia (teraz by nemal reálne hodnoty). CSP hash JSON-LD je po kole 1 prepočítaný ručne
(sha256 obsahu bloku cez `node:crypto`, tá istá metóda dala pred zmenou pôvodný hash); `csp-hash.mjs` agent
nespúšťal, Fable ho pred nasadením pustí na overenie. JSON-LD `about` je teraz `Product` s `name` a `url`
stránky sady (stránka sady nemá `@id #product`).

## Čo agent nevedel overiť

- film nikto nevidel v prehliadači: rozloženie som pozrel len cez vlastný prevod volaní plátna do SVG a resvg
  (scratchpad, bez šumu papiera, zrna a skutočného merania písma), po kole 1 hák vo všetkých 4 formátoch a
  9:16 v časoch 0, 2,8, 6,6, 9,5, 11, 13,8, 16,6, 18,4, 21; zvuk nikto nepočul
- skutočná šírka písma ARLing Serif a Sans v prehliadači (test ráta odhad)
- hlasitosť, render, výkon stránky, `og.jpg` filmu
