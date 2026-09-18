# rrweb: co sem patri, kto to sem musi vlozit a pod akou licenciou

Tento priecinok je **prazdny az na tento subor**. Stavba, ktora napisala
`products/arling-sk/zaznam.js` a `products/zaznam-sluzba/`, nesmela stiahnut ani
jeden bajt z internetu, takze rrweb nevlozila a ani ho nepredstierala. Nizsie je
presne to, co treba skopirovat, a preco.

## Preco vlastna kopia a nie CDN

Kazda stranka arling.sk ma `Content-Security-Policy` s `script-src 'self'` a
kontrolnym suctom pre kazdy vlozeny skript. Cudzi CDN by znamenal novy povoleny
pôvod v CSP na kazdej predajnej stranke, cudzi server by videl adresy nasich
navstevnikov, a `ops/design/sluby-kontrola.mjs` by to spravne oznacil ako
poziadavku mimo nasich domen. Vlastna kopia nic z toho nerobi.

## Ktore dva subory

| Subor sem | Z baliku npm | Na co |
| --- | --- | --- |
| `rrweb-record.min.js` | `rrweb` (alebo mensi balik `rrweb-record`), subor `dist/rrweb-record.min.js`, globalna premenna `rrweb` | zaznam na predajnych strankach; nacitava ho `zaznam.js` |
| `LICENSE` | ten isty balik, subor `LICENSE` | povinna kopia licencie, doslova ako je v baliku |

Prehravac (`rrweb-player`) sem **nepatri**. Ten potrebuje len prehliadac
majitela, takze lezi vedla sluzby, v `products/zaznam-sluzba/vendor/`, pozri
`products/zaznam-sluzba/README.md`.

## Licencia

rrweb je zverejneny pod licenciou **MIT**. MIT dovoluje kopiu, upravu aj
komercne pouzitie s jedinou podmienkou: kopia licencie a oznamenia o autorskom
prave musi byt prilozena. Preto je `LICENSE` v tabulke vyssie povinny, nie
volitelny, a preto sa jeho obsah **opisuje zo stiahnuteho baliku doslova**, nie
prepisuje rucne a nie odhadom.

Overit pred vlozenim, nie potom:

```bash
npm view rrweb license version
# ocakavane: MIT a cislo verzie
```

Ked by `npm view` niekedy vratil inu licenciu nez MIT, **nic sem nekopiruj** a
zapis rozpor do `ops/ai/rozhodnutia.md`. Zmena licencie kniznice je obchodne
rozhodnutie, nie technicky detail.

## Ako to sem dostat (robi clovek alebo Fable, nie tato stavba)

```bash
# v docasnom priecinku, nie v repozitari
npm pack rrweb
tar -xf rrweb-*.tgz

cp package/dist/rrweb-record.min.js "products/arling-sk/vendor/rrweb/rrweb-record.min.js"
cp package/LICENSE                  "products/arling-sk/vendor/rrweb/LICENSE"

# zapis si, co si vlozil: verziu a odtlacok suboru
npm view rrweb version
sha256sum products/arling-sk/vendor/rrweb/rrweb-record.min.js
```

Verziu a odtlacok dopis do tabulky nizsie. Bez nich sa o rok neda povedat, co na
stranke vlastne bezi.

| Vlozene dna | Verzia rrweb | sha256 `rrweb-record.min.js` |
| --- | --- | --- |
| (este nevlozene) | | |

## Co sa deje, kym tu kniznica nie je

Nic sa nerozbije. `zaznam.js` skusi subor nacitat, dostane 404 a pokracuje: kliky
so suradnicami sa zbieraju a posielaju dalej, mapa klikov je uplna, prehravanie
relacie je prazdne. Ziadna chyba v konzole navstevnika, ziadna poziadavka na
cudzi server.

Po vlozeni suborov netreba menit ani jednu stranku: adresa
`/vendor/rrweb/rrweb-record.min.js` uz v `zaznam.js` je a `script-src 'self'` ju
pokryva. Staci nasadit obsah `products/arling-sk`.
