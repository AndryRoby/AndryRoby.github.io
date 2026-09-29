// Kompletné preklady; ceny, ID, obrázky, značky, EAN a varianty vždy zo SK feedu.
// node asistent/ukazka/build-feeds.mjs --dry
// node asistent/ukazka/build-feeds.mjs --zapis
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Zmena SK údajov vyžaduje kontrolu prekladov, nie tiché použitie starého textu.
const ZDROJ_SHA256 = '4ab0ccd197d42ce7276c02fe95f7612216fb0869864b5b1fc5d984ed7345d023';
// ID, názov EN, názov DE, popis EN, popis DE.
const PREKLADY = [
  ["KUC-001","Ferrum Hron Inox FH-20, 20 cm, 3.5 l","Ferrum Hron Inox FH-20, 20 cm, 3,5 l","Stainless steel pot with a three-layer sandwich base, suitable for induction, ceramic and gas cooktops. Diameter 20 cm, capacity 3.5 litres, glass lid with a steam vent. The handles are welded rather than screwed on. The whole pot is dishwasher safe.","Edelstahltopf mit dreischichtigem Sandwichboden, geeignet für Induktions-, Glaskeramik- und Gasherde. Durchmesser 20 cm, Volumen 3,5 Liter, Glasdeckel mit Dampföffnung. Die Griffe sind angeschweißt statt angeschraubt. Der gesamte Topf ist spülmaschinengeeignet."],
  ["KUC-002","Ferrum Hron Inox FH-24, 24 cm, 6 l","Ferrum Hron Inox FH-24, 24 cm, 6 l","Larger stainless steel pot from the same Inox range as the FH-20, for soup or pasta for the whole family. Diameter 24 cm, capacity 6 litres. Sandwich base suitable for induction, ceramic and gas cooktops. Glass lid, welded handles, dishwasher safe.","Größerer Edelstahltopf aus derselben Inox-Serie wie der FH-20, für Suppe oder Nudeln für die ganze Familie. Durchmesser 24 cm, Volumen 6 Liter. Sandwichboden für Induktions-, Glaskeramik- und Gasherde. Glasdeckel, angeschweißte Griffe, spülmaschinengeeignet."],
  ["KUC-003","Cast iron frying pan, 26 cm","Gusseisenpfanne, 26 cm","Heavy cast iron frying pan, 26 cm in diameter with a 5 mm base. Suitable for induction, gas, the oven and grill. Retains heat and sears a crust on meat. Supplied seasoned with linseed oil. Wipe clean and lightly oil after use.","Schwere Gusseisenpfanne mit 26 cm Durchmesser und 5 mm starkem Boden. Für Induktion, Gas, Backofen und Grill geeignet. Speichert Wärme und brät Fleisch mit Kruste. Mit Leinöl eingebrannt geliefert. Nach Gebrauch auswischen und leicht einölen."],
  ["KUC-004","Ferrum Hron Ceramica Nova CN-28, 28 cm","Ferrum Hron Ceramica Nova CN-28, 28 cm","Lightweight aluminium frying pan with a PFAS-free ceramic non-stick coating. Diameter 28 cm, base thickness 4.5 mm, suitable for induction. The Bakelite handle stays cool. Oven safe up to 160 °C only.","Leichte Aluminiumpfanne mit keramischer Antihaftbeschichtung ohne PFAS. Durchmesser 28 cm, Bodenstärke 4,5 mm, induktionsgeeignet. Der Bakelitgriff bleibt kühl. Nur bis 160 °C backofengeeignet."],
  ["KUC-005","Oak chopping board, 40 × 28 cm","Schneidebrett aus Eiche, 40 × 28 cm","Solid oak board, 3 cm thick, with a juice groove around the edge. Measures 40 × 28 cm, treated with linseed oil and beeswax. Not dishwasher safe. Oil once a month.","Massives Eichenbrett, 3 cm stark, mit umlaufender Saftrille. Maße 40 × 28 cm, mit Leinöl und Bienenwachs behandelt. Nicht in die Spülmaschine geben. Einmal im Monat einölen."],
  ["KUC-006","Three-piece kitchen knife set","Küchenmesserset, 3-teilig","A 20 cm chef's knife, 13 cm utility knife and 9 cm paring knife made from X50CrMoV15 steel with a hardness of 56 HRC. Riveted black polymer composite handles. Supplied in a cardboard gift box.","Kochmesser 20 cm, Universalmesser 13 cm und Schälmesser 9 cm aus X50CrMoV15-Stahl mit 56 HRC Härte. Vernietete Griffe aus schwarzem Polymer-Verbundwerkstoff. Lieferung in einer Geschenkbox aus Karton."],
  ["KUC-007","Digital kitchen scale, up to 5 kg","Digitale Küchenwaage bis 5 kg","Flat scale with an 18 × 18 cm glass surface, 1 g precision and 5 kg capacity. Tare function, switches between grams and millilitres, automatic shut-off. Powered by 2 × AAA batteries, included.","Flache Waage mit 18 × 18 cm großer Glasfläche, 1 g Genauigkeit und 5 kg Tragkraft. Tara-Funktion, Umschaltung zwischen Gramm und Millilitern, automatische Abschaltung. Betrieb mit 2 × AAA-Batterien, im Lieferumfang enthalten."],
  ["KUC-008","Glass food storage jars, set of 5","Vorratsgläser, 5er-Set","Five borosilicate glass jars with capacities of 0.3, 0.5, 0.8, 1.0 and 1.5 litres. Bamboo lids with silicone seals keep them airtight. The glass is freezer, microwave (without the lid) and dishwasher safe.","Fünf Vorratsgläser aus Borosilikatglas mit 0,3, 0,5, 0,8, 1,0 und 1,5 Liter Volumen. Bambusdeckel mit Silikondichtung schließen luftdicht. Das Glas ist gefriergeeignet sowie mikrowellengeeignet ohne Deckel und spülmaschinengeeignet."],
  ["KUC-009","Cast iron bread baker with lid","Gusseiserner Brotbacktopf mit Deckel","Oval enamelled bread baker, 30 × 22 cm, with a 4.5-litre capacity and a heavy lid for baking crusty bread. Suitable for ovens up to 260 °C and induction cooktops. The enamel needs no seasoning. Hand wash.","Ovaler emaillierter Bräter, 30 × 22 cm, mit 4,5 Liter Volumen und schwerem Deckel für knuspriges Brot. Bis 260 °C backofengeeignet und für Induktion geeignet. Die Emaille muss nicht eingebrannt werden. Von Hand spülen."],
  ["KUC-010","Linen kitchen towels, set of 3","Leinen-Geschirrtücher, 3er-Set","Three 50 × 70 cm kitchen towels in heavier 220 g/m² linen, woven in Europe. Linen absorbs quickly and leaves no lint on glasses. Wash at 60 °C before first use. Slight shrinkage is expected.","Drei Geschirrtücher, 50 × 70 cm, aus kräftigem Leinen mit 220 g/m², in Europa gewebt. Leinen saugt schnell und hinterlässt keine Fusseln auf Gläsern. Vor dem ersten Gebrauch bei 60 °C waschen. Die Tücher laufen etwas ein."],
  ["KUC-011","Springform cake pan, 26 cm","Springform, 26 cm","Cake pan, 26 cm in diameter and 7 cm high, with a removable base released by a side clasp. PFOA-free non-stick coating. Oven safe up to 230 °C. Hand wash, as the coating dulls over time in a dishwasher.","Kuchenform mit 26 cm Durchmesser und 7 cm Höhe. Der Boden lässt sich über den seitlichen Verschluss lösen. Antihaftbeschichtung ohne PFOA, bis 230 °C backofengeeignet. Von Hand spülen, da die Oberfläche in der Spülmaschine mit der Zeit matt wird."],
  ["KAV-001","Orava espresso machine, 15 bar","Orava Siebträgermaschine, 15 bar","Espresso machine with a 15-bar pump, heated cup tray and milk steam wand. Water tank 1.5 l, 51 mm metal portafilter with two baskets for single and double espresso. Measures 30 × 21 × 33 cm, power 1350 W.","Siebträgermaschine mit 15-Bar-Pumpe, beheizter Tassenablage und Dampfdüse für Milch. Wassertank 1,5 l, Metallsiebträger mit 51 mm Durchmesser und zwei Sieben für einfachen und doppelten Espresso. Maße 30 × 21 × 33 cm, Leistung 1350 W."],
  ["KAV-002","Orava Uno automatic coffee machine with grinder","Orava Uno Kaffeevollautomat mit Mahlwerk","Fully automatic coffee machine with a ceramic grinder and 13 grind settings. Espresso, lungo and hot water at the touch of a button, plus a milk steam wand. Water tank 1.8 l, bean hopper 200 g, descaling programme.","Kaffeevollautomat mit Keramikmahlwerk und 13 Mahlgradeinstellungen. Espresso, Lungo und heißes Wasser auf Knopfdruck, dazu eine Dampfdüse für Milch. Wassertank 1,8 l, Bohnenbehälter 200 g, Entkalkungsprogramm."],
  ["KAV-003","Orava Mini capsule coffee machine, red","Orava Mini Kapselmaschine, rot","Small coffee machine for standard-size aluminium capsules, with 19-bar pressure and a 25-second warm-up. Water tank 0.7 l, automatic shut-off after 9 minutes, two cup sizes. Only 11 cm wide, it fits small kitchens.","Kleine Kaffeemaschine für Aluminiumkapseln in gängiger Größe, mit 19 Bar Druck und 25 Sekunden Aufheizzeit. Wassertank 0,7 l, automatische Abschaltung nach 9 Minuten, zwei Tassengrößen. Nur 11 cm breit, passt auch in kleine Küchen."],
  ["KAV-004","Orava Mini capsule coffee machine, white","Orava Mini Kapselmaschine, weiß","The same coffee machine in white: standard-size aluminium capsules, 19-bar pressure and a 25-second warm-up. Water tank 0.7 l, automatic shut-off, two cup sizes. Width 11 cm.","Dieselbe Kaffeemaschine in Weiß: Aluminiumkapseln in gängiger Größe, 19 Bar Druck und 25 Sekunden Aufheizzeit. Wassertank 0,7 l, automatische Abschaltung, zwei Tassengrößen. Breite 11 cm."],
  ["KAV-005","Manual coffee grinder with ceramic burrs","Handkaffeemühle mit Keramikmahlwerk","Manual grinder with a ceramic conical burr mechanism and grind settings from espresso to French press. The stainless steel body is 5 cm in diameter and fits in a backpack. Holds 30 g of coffee. Grinding one serving takes about a minute.","Handmühle mit konischem Keramikmahlwerk und einstellbarem Mahlgrad von Espresso bis French Press. Das Edelstahlgehäuse mit 5 cm Durchmesser passt in einen Rucksack. Behälter für 30 g Kaffee. Eine Portion ist in etwa einer Minute gemahlen."],
  ["KAV-006","Borosilicate glass French press, 1 l","French Press aus Borosilikatglas, 1 l","A 1-litre French press for about 4 cups, with a glass vessel and stainless steel frame and plunger. The double filter catches finer grounds too. The glass is replaceable; replacements are supplied separately.","French Press mit 1 Liter Volumen für etwa 4 Tassen, Glasbehälter sowie Edelstahlrahmen und Stempel. Das doppelte Sieb hält auch feineres Kaffeepulver zurück. Das Glas ist austauschbar; Ersatzglas wird separat angeboten."],
  ["KAV-007","Gooseneck kettle for pour-over coffee, 0.9 l","Schwanenhalskessel für Filterkaffee, 0,9 l","Kettle with a narrow spout for precise pouring when making filter coffee. Capacity 0.9 l, suitable for induction and gas, without a thermometer. The wooden handle and lid knob stay cool.","Kessel mit schmalem Ausguss zum präzisen Aufgießen von Filterkaffee. Volumen 0,9 l, für Induktion und Gas geeignet, ohne Thermometer. Holzgriff und Deckelknopf bleiben kühl."],
  ["KAV-008","Temperature-control electric kettle, 1.7 l","Wasserkocher mit Temperaturwahl, 1,7 l","Kettle with temperature settings from 40 to 100 °C in 5-degree steps, for green tea and coffee. Capacity 1.7 l, keeps water warm for 30 minutes, power 2200 W. All-stainless steel interior, with no plastic touching the water.","Wasserkocher mit Temperaturwahl von 40 bis 100 °C in 5-Grad-Schritten, für grünen Tee und Kaffee. Volumen 1,7 l, Warmhaltefunktion für 30 Minuten, Leistung 2200 W. Innen vollständig aus Edelstahl, kein Kunststoff in Kontakt mit dem Wasser."],
  ["KAV-009","Cast iron teapot with infuser, 0.8 l","Gusseiserne Teekanne mit Sieb, 0,8 l","Japanese-style cast iron teapot with an enamelled interior and stainless steel infuser for loose-leaf tea. Capacity 0.8 l, retains heat for about 40 minutes. Not for boiling water on a stove. Fill with water that is already hot.","Gusseiserne Teekanne im japanischen Stil mit Innenemaillierung und Edelstahlsieb für losen Tee. Volumen 0,8 l, hält etwa 40 Minuten warm. Nicht zum Wasserkochen auf dem Herd geeignet. Bereits heißes Wasser einfüllen."],
  ["KAV-010","Assam loose-leaf black tea, 100 g","Loser Assam-Schwarztee, 100 g","Whole-leaf black tea from Assam, second flush, with a full malty flavour. A 100 g resealable bag makes about 40 cups. Steep for 3 to 4 minutes in water at 95 °C.","Ganzblättriger Schwarztee aus Assam aus der zweiten Ernte mit kräftigem, malzigem Geschmack. 100 g im wiederverschließbaren Beutel, ausreichend für etwa 40 Tassen. Bei 95 °C Wassertemperatur 3 bis 4 Minuten ziehen lassen."],
  ["KAV-011","Double-walled coffee glasses, 250 ml, set of 4","Doppelwandige Kaffeegläser, 250 ml, 4er-Set","Four double-walled glasses that stay comfortable to hold and do not develop condensation. Capacity 250 ml, for cappuccino or tea. Hand-blown glass, dishwasher and microwave safe.","Vier doppelwandige Gläser, die außen nicht heiß werden und kein Kondenswasser bilden. Volumen 250 ml, für Cappuccino oder Tee. Mundgeblasenes Glas, spülmaschinen- und mikrowellengeeignet."],
  ["ZAH-001","Two-handed garden loppers, 60 cm","Garten-Astschere, 60 cm","Loppers for branches up to 35 mm in diameter, with a geared mechanism that reduces the force needed. Aluminium handles, 60 cm long, with soft grips. Weight 900 g. Hardened steel blade with a non-stick coating.","Astschere für Äste bis 35 mm Durchmesser mit kraftsparendem Getriebe. 60 cm lange Aluminiumgriffe mit weichen Griffzonen, Gewicht 900 g. Klinge aus gehärtetem Stahl mit Antihaftbeschichtung."],
  ["ZAH-002","Hand pruning shears","Gartenschere","Pruning shears for roses and twigs up to 20 mm, with a precise double-sided blade. Spring and safety catch, handle suitable for right- and left-handed use. Length 21 cm, weight 220 g.","Gartenschere für Rosen und Zweige bis 20 mm mit präziser, beidseitiger Klinge. Mit Feder und Sicherung, Griff für Rechts- und Linkshänder geeignet. Länge 21 cm, Gewicht 220 g."],
  ["ZAH-003","Larch raised garden bed, 120 × 80 cm","Hochbeet aus Lärchenholz, 120 × 80 cm","Collapsible raised bed made from 28 mm larch boards, without chemical treatment. Measures 120 × 80 × 40 cm and holds about 380 litres of growing medium. Assembles without tools in 15 minutes.","Zusammensteckbares Hochbeet aus 28 mm starken Lärchenbrettern ohne chemische Behandlung. Maße 120 × 80 × 40 cm, Fassungsvermögen etwa 380 Liter Substrat. In 15 Minuten ohne Werkzeug aufgebaut."],
  ["ZAH-004","Galvanised watering can, 10 l","Verzinkte Gießkanne, 10 l","Galvanised sheet metal watering can with a removable sprinkler head. Capacity 10 litres, two handles for comfortable carrying and pouring. Does not rust and lasts for years outdoors.","Gießkanne aus verzinktem Blech mit abnehmbarem Brausekopf. Volumen 10 Liter, zwei Griffe zum bequemen Tragen und Gießen. Rostet nicht und hält jahrelang im Freien."],
  ["ZAH-005","Garden hose with fittings, 20 m","Gartenschlauch mit Anschlussset, 20 m","Three-layer hose, 1/2 inch (13 mm) in diameter and 20 m long, for pressure up to 20 bar. Includes quick connectors, a tap connector and an adjustable spray gun. UV- and kink-resistant.","Dreilagiger Schlauch mit 1/2 Zoll (13 mm) Durchmesser, 20 m Länge und bis zu 20 Bar Druckbelastbarkeit. Mit Schnellkupplungen, Hahnanschluss und einstellbarer Sprühpistole. UV- und knickbeständig."],
  ["ZAH-006","Recycled plastic compost bin, 300 l","Komposter aus recyceltem Kunststoff, 300 l","Recycled plastic compost bin with a 300-litre capacity, side ventilation openings and a lower hatch for removing compost. Measures 80 × 80 × 82 cm. Open base, placed directly on the ground. Assembles without tools.","Komposter aus recyceltem Kunststoff mit 300 Liter Volumen, seitlichen Belüftungsöffnungen und einer unteren Entnahmeklappe. Maße 80 × 80 × 82 cm, ohne Boden, steht direkt auf der Erde. Aufbau ohne Werkzeug."],
  ["ZAH-007","Herb garden seeds, 6 varieties","Kräutergarten-Saatgut, 6 Sorten","Six seed packets: basil, parsley, chives, dill, thyme and rocket (arugula). Sow from April to July, in balcony planters or garden beds. Each packet includes sowing instructions and planting depth.","Sechs Samentüten: Basilikum, Petersilie, Schnittlauch, Dill, Thymian und Rucola. Für die Aussaat von April bis Juli auf dem Balkon oder im Beet. Jede Tüte enthält eine Aussaatanleitung mit Saattiefe."],
  ["ZAH-008","Acacia wood patio armchair","Terrassensessel aus Akazienholz","Folding armchair made from oiled acacia wood, with a 120 kg load capacity. Measures 58 × 62 × 88 cm, weight 6 kg. We recommend storing it under cover for winter and oiling once a year.","Klappbarer Sessel aus geöltem Akazienholz, belastbar bis 120 kg. Maße 58 × 62 × 88 cm, Gewicht 6 kg. Im Winter empfehlen wir eine überdachte Lagerung und einmal jährlich das Einölen."],
  ["ZAH-009","Goatskin gardening gloves, size M","Gartenhandschuhe aus Ziegenleder, Größe M","Goatskin gloves with cotton backs for working with roses and thorny shrubs. Extended cuffs protect the wrists. Size M fits a palm circumference of 20 to 22 cm.","Handschuhe aus Ziegenleder mit Baumwollrücken für Arbeiten an Rosen und dornigen Sträuchern. Die verlängerte Stulpe schützt das Handgelenk. Größe M entspricht einem Handumfang von 20 bis 22 cm."],
  ["ZAH-010","Goatskin gardening gloves, size L","Gartenhandschuhe aus Ziegenleder, Größe L","Goatskin gloves with cotton backs for working with roses and thorny shrubs. Extended cuffs protect the wrists. Size L fits a palm circumference of 22 to 24 cm.","Handschuhe aus Ziegenleder mit Baumwollrücken für Arbeiten an Rosen und dornigen Sträuchern. Die verlängerte Stulpe schützt das Handgelenk. Größe L entspricht einem Handumfang von 22 bis 24 cm."],
  ["ZAH-011","Solar garden lights, set of 4","Solar-Gartenleuchten, 4er-Set","Four stake lights, 38 cm high, with warm white 3000 K light. The solar panel charges the battery on a sunny day, providing 6 to 8 hours of light. IP44 protection, suitable for rain.","Vier Erdspießleuchten, 38 cm hoch, mit warmweißem Licht bei 3000 K. Das Solarpanel lädt den Akku an einem sonnigen Tag; die Leuchten leuchten 6 bis 8 Stunden. Schutzart IP44, regenfest."],
  ["UPR-001","Flat mop and bucket with wringer","Flachmopp mit Eimer und Auswringfunktion","A 33 cm flat mop with two microfibre pads and a bucket with a foot-operated wringer. Bucket capacity 8 litres, telescopic handle from 80 to 130 cm. Pads washable at 60 °C.","Flachmopp, 33 cm breit, mit zwei Mikrofaserbezügen und Eimer mit fußbedienter Auswringmechanik. Eimervolumen 8 Liter, Teleskopstiel von 80 bis 130 cm. Bezüge bei 60 °C waschbar."],
  ["UPR-002","Microfibre cleaning cloths, set of 10","Mikrofasertücher, 10er-Set","Ten 30 × 30 cm microfibre cloths, 300 g/m², for dusting, glass and kitchen cleaning. Colour-coded by room. Wash at 60 °C without fabric softener. Last for about 300 washes.","Zehn Mikrofasertücher, 30 × 30 cm, mit 300 g/m², für Staub, Glas und Küche. Nach Raum farblich unterscheidbar. Bei 60 °C ohne Weichspüler waschen. Halten etwa 300 Wäschen."],
  ["UPR-003","Cordless stick vacuum cleaner","Akku-Staubsauger","Cordless vacuum with 40 minutes of runtime per charge and 22 kPa suction. Motorised floor head with LED light, crevice nozzle and upholstery brush. Weight 2.4 kg, dust container 0.6 l, charges in 4 hours.","Kabelloser Staubsauger mit 40 Minuten Laufzeit pro Ladung und 22 kPa Saugkraft. Motorisierte Bodendüse mit LED-Licht, Fugendüse und Polsterbürste. Gewicht 2,4 kg, Behälter 0,6 l, Ladezeit 4 Stunden."],
  ["UPR-004","Wood and coconut fibre dish brush set","Spülbürstenset aus Holz und Kokosfasern","Dish brush, bottle brush and vegetable brush with beech handles and coconut fibre bristles. The dish brush has a replaceable head. Hang to dry. Do not leave standing in water.","Spülbürste, Flaschenbürste und Gemüsebürste mit Buchengriffen und Kokosfaserborsten. Die Spülbürste hat einen austauschbaren Kopf. Hängend trocknen lassen, nicht im Wasser stehen lassen."],
  ["UPR-005","Dehumidifier, 12 l per day","Luftentfeuchter, 12 l pro Tag","Compressor dehumidifier for rooms up to 25 m². Removes 12 litres of water per day at 30 °C and 80% humidity. A 2 l tank with automatic shut-off, plus continuous hose drainage option. Noise level 42 dB, power 220 W.","Kompressor-Luftentfeuchter für Räume bis 25 m². Entzieht bei 30 °C und 80 % Luftfeuchtigkeit 12 Liter Wasser pro Tag. 2-l-Tank mit automatischer Abschaltung, Dauerablauf per Schlauch möglich. Geräuschpegel 42 dB, Leistung 220 W."],
  ["UPR-006","Seagrass laundry basket, 60 l","Wäschekorb aus Seegras, 60 l","Handwoven 60-litre basket with a removable, washable cotton liner. Measures 40 × 40 × 55 cm, with two handles. Keep dry; seagrass is not suited to a damp bathroom.","Handgeflochtener Korb mit 60 Liter Volumen und herausnehmbarem, waschbarem Baumwollsack. Maße 40 × 40 × 55 cm, zwei Griffe. Trocken halten; Seegras verträgt kein feuchtes Badezimmer."],
  ["UPR-007","Window squeegee with telescopic handle","Fensterabzieher mit Teleskopstiel","Squeegee with a 35 cm rubber blade and a double-sided head: microfibre for washing on one side, rubber for removing water on the other. Telescopic handle from 1 to 2 m with a hanging hook. For windows and shower enclosures.","Abzieher mit 35 cm breiter Gummilippe und doppelseitigem Kopf: Mikrofaser zum Waschen auf der einen, Gummi zum Abziehen auf der anderen Seite. Teleskopstiel von 1 bis 2 m mit Aufhängehaken. Für Fenster und Duschkabinen geeignet."],
  ["UPR-008","Concentrated dishwashing liquid, 1 l","Konzentriertes Spülmittel, 1 l","Concentrated dishwashing liquid based on sugar surfactants, without fragrance or dyes, biodegradable. One 1 l bottle lasts for about 200 washes. Also suitable for sensitive skin.","Spülmittelkonzentrat auf Basis von Zuckertensiden, ohne Duft- und Farbstoffe, biologisch abbaubar. Eine 1-l-Flasche reicht für etwa 200 Spülgänge. Auch für empfindliche Haut geeignet."],
  ["UPR-009","Folding drying rack, 18 m","Klappbarer Wäscheständer, 18 m","Folding drying rack with 18 metres of drying space and two folding wings. Measures 180 × 55 × 100 cm when open and is only 8 cm thick when folded. Load capacity 20 kg, legs with wheels.","Klappbarer Wäscheständer mit 18 Metern Trockenlänge und zwei klappbaren Flügeln. Aufgestellt 180 × 55 × 100 cm, zusammengeklappt nur 8 cm dick. Tragkraft 20 kg, Beine mit Rollen."],
  ["DET-001","Wooden shapes and colours puzzle","Holz-Steckpuzzle mit Formen und Farben","A 30 × 22 cm board with twelve graspable geometric shapes, painted with water-based paints. For children from 12 months, to practise fine motor skills and colour names. Sanded edges, no small parts.","Brett, 30 × 22 cm, mit zwölf greifbaren geometrischen Formen, mit Farben auf Wasserbasis bemalt. Für Kinder ab 12 Monaten, zum Üben der Feinmotorik und der Farbnamen. Geschliffene Kanten, keine Kleinteile."],
  ["DET-002","Children's preschool backpack, 8 l, blue","Kindergartenrucksack, 8 l, blau","An 8-litre preschool backpack for a snack, bottle and pyjamas. Padded shoulder straps, chest strap and an internal name label. Measures 30 × 24 × 12 cm, weight 250 g, machine washable at 30 °C.","Kindergartenrucksack mit 8 Liter Volumen für Brotdose, Flasche und Schlafanzug. Gepolsterte Schultergurte, Brustgurt und Namensschild innen. Maße 30 × 24 × 12 cm, Gewicht 250 g, bei 30 °C maschinenwaschbar."],
  ["DET-003","Children's preschool backpack, 8 l, yellow","Kindergartenrucksack, 8 l, gelb","The same backpack in yellow: 8-litre capacity, padded shoulder straps, chest strap and an internal name label. Measures 30 × 24 × 12 cm, weight 250 g, machine washable at 30 °C.","Derselbe Rucksack in Gelb: 8 Liter Volumen, gepolsterte Schultergurte, Brustgurt und Namensschild innen. Maße 30 × 24 × 12 cm, Gewicht 250 g, bei 30 °C maschinenwaschbar."],
  ["DET-004","Children's stainless steel cutlery, 4 pieces","Kinderbesteck aus Edelstahl, 4-teilig","Spoon, fork, knife and teaspoon with shorter handles for children from age 3. Rounded tips and a blunt knife that still cuts soft food. Dishwasher safe, supplied in a gift box.","Löffel, Gabel, Messer und Teelöffel mit kürzeren Griffen für Kinder ab 3 Jahren. Abgerundete Spitzen und ein stumpfes Messer, das weiche Speisen schneidet. Spülmaschinengeeignet, in Geschenkverpackung."],
  ["DET-005","Children's water bottle with straw, 350 ml","Kinder-Trinkflasche mit Strohhalm, 350 ml","Stainless steel bottle, 350 ml, with a silicone straw, BPA-free. Cap with a dust cover, keeps drinks cold for 8 hours. For children from age 2. Hand wash the bottle; the straw is dishwasher safe.","Edelstahlflasche mit 350 ml Volumen und Silikonstrohhalm, BPA-frei. Verschluss mit Staubschutz, hält Getränke 8 Stunden kalt. Für Kinder ab 2 Jahren. Flasche von Hand spülen, Strohhalm spülmaschinengeeignet."],
  ["DET-006","Wooden play kitchen","Kinderküche aus Holz","Play kitchen, 92 cm high, with two cooking rings, an oven with a window, a sink and a shelf. The knobs turn and click. For children from age 3. Assembly takes about 45 minutes, weight 12 kg.","Kinderküche, 92 cm hoch, mit zwei Kochplatten, Backofen mit Sichtfenster, Spüle und Regal. Die Knöpfe lassen sich drehen und klicken. Für Kinder ab 3 Jahren, Montage etwa 45 Minuten, Gewicht 12 kg."],
  ["DET-007","Wooden building blocks, 100 pieces","Holzbausteine, 100 Stück","One hundred untreated beech blocks based on a 3 cm module: cubes, rectangular blocks, cylinders and arches. Supplied in a canvas drawstring bag. For children from 18 months.","Hundert Bausteine aus unbehandeltem Buchenholz im 3-cm-Grundraster: Würfel, Quader, Zylinder und Bögen. Lieferung im Stoffbeutel mit Kordelzug. Für Kinder ab 18 Monaten."],
  ["DET-008","Rabbit night light","Hasen-Nachtlicht","Rabbit-shaped silicone light, 18 cm high, soft to the touch and suitable for taking into bed. Warm white light with three brightness levels and a 30-minute timer. USB-C charging, 10-hour runtime.","Silikonlampe in Hasenform, 18 cm hoch, weich und zum Mitnehmen ins Bett geeignet. Warmweißes Licht mit drei Helligkeitsstufen und 30-Minuten-Timer. Aufladung über USB-C, Laufzeit 10 Stunden."],
  ["DET-009","Mountain animals matching game","Tier-Memo aus den Bergen","Matching game with 32 pairs of animals living in the Tatra Mountains, illustrated in watercolour. Cards measure 6 × 6 cm and are made from thick cardboard with rounded corners. For children from age 3, for 2 to 6 players.","Memo-Spiel mit 32 Tierpaaren aus der Tatra, mit Aquarellillustrationen. Karten, 6 × 6 cm, aus dickem Karton mit abgerundeten Ecken. Für Kinder ab 3 Jahren, für 2 bis 6 Spieler."],
  ["DET-010","Adjustable beech children's chair","Mitwachsender Kinderstuhl aus Buchenholz","Beech chair with an adjustable seat and footrest, from 6 months to adulthood, with a 100 kg load capacity. Includes a tray, straps and a soft cushion. Measures 47 × 50 × 80 cm.","Mitwachsender Stuhl aus Buchenholz mit verstellbarem Sitz und Fußstütze, ab 6 Monaten bis ins Erwachsenenalter, belastbar bis 100 kg. Mit Tischbrett, Gurten und weichem Kissen. Maße 47 × 50 × 80 cm."],
  ["DAR-001","Foothills honey gift set, 3 × 250 g","Honig-Geschenkset aus dem Bergvorland, 3 × 250 g","Three 250 g glass jars of honey: linden, forest and blossom, from beekeepers in the foothills. Packed in a wooden box with wood wool filling. The honey is raw and unfiltered and may crystallise over time.","Drei Honiggläser mit je 250 g: Linden-, Wald- und Blütenhonig von Imkern aus dem Bergvorland. In einer Holzkiste mit Holzwolle verpackt. Der Honig ist roh und ungefiltert und kann mit der Zeit kristallisieren."],
  ["DAR-002","Wool blanket, 130 × 180 cm, grey","Wolldecke, 130 × 180 cm, grau","Woven merino wool blanket, 130 × 180 cm, weighing 1.1 kg, with fringes. Keeps you warm even in a cold cabin, and the wool does not absorb odours. Hand wash in lukewarm water or dry clean.","Gewebte Merinowolldecke, 130 × 180 cm, Gewicht 1,1 kg, mit Fransen. Wärmt auch in einer kalten Hütte; die Wolle nimmt keine Gerüche auf. Mit lauwarmem Wasser von Hand waschen oder chemisch reinigen."],
  ["DAR-003","Wool blanket, 130 × 180 cm, terracotta","Wolldecke, 130 × 180 cm, terrakotta","The same merino wool blanket in terracotta, 130 × 180 cm, weighing 1.1 kg, with fringes. Hand wash in lukewarm water or dry clean.","Dieselbe Merinowolldecke in Terrakotta, 130 × 180 cm, Gewicht 1,1 kg, mit Fransen. Mit lauwarmem Wasser von Hand waschen oder chemisch reinigen."],
  ["DAR-004","Soy wax candle, pine and resin","Sojawachskerze, Kiefer und Harz","Candle in a 200 ml glass jar with a pine and resin scent. The wooden wick crackles gently as it burns. Burn time about 40 hours. Paraffin-free wax. Once used up, wash the jar and reuse it for pencils.","Kerze im 200-ml-Glas mit Kiefern- und Harzduft. Der Holzdocht knistert beim Brennen leise. Brenndauer etwa 40 Stunden. Wachs ohne Paraffin. Nach dem Abbrennen das Glas auswaschen und als Stiftehalter nutzen."],
  ["DAR-005","Hand-thrown ceramic bowl, 18 cm","Handgedrehte Keramikschale, 18 cm","Wheel-thrown bowl, 18 cm in diameter, with slight variations between pieces. Stoneware with a blue glaze, dishwasher and oven safe. For soup, porridge or fruit.","Auf der Töpferscheibe gedrehte Schale mit 18 cm Durchmesser, jedes Stück ist etwas anders. Steinzeug mit blauer Glasur, spülmaschinen- und backofengeeignet. Für Suppe, Haferbrei oder Obst."],
  ["DAR-006","Leather-bound A5 notebook","A5-Notizbuch mit Ledereinband","A5 notebook with 192 pages of 100 g/m² dotted paper, a soft leather cover and an elastic closure. The leather darkens and develops a patina over time. A gift for a new job or course of study.","A5-Notizbuch mit 192 Seiten punktiertem Papier mit 100 g/m², weichem Ledereinband und Gummiband. Das Leder wird mit der Zeit dunkler und bekommt Patina. Als Geschenk zum neuen Arbeitsplatz oder Studium geeignet."],
  ["DAR-007","Herbal tea gift box, 4 varieties","Kräutertee-Geschenkbox, 4 Sorten","Four loose herbal teas, 30 g each: linden, mint, lemon balm and rosehip, shade-dried without heat. Packed in a paper box with a brief description of their effects. Steep for 8 minutes, covered.","Vier lose Kräutertees mit je 30 g: Linde, Minze, Melisse und Hagebutte, ohne Erwärmung im Schatten getrocknet. In einer Papierbox mit kurzer Beschreibung ihrer Wirkungen verpackt. Zugedeckt 8 Minuten ziehen lassen."],
  ["DAR-008","Folding wooden chess set, 40 cm","Klappbares Holzschachspiel, 40 cm","Folding beech chessboard, 40 × 40 cm, with burned-in squares. Hornbeam pieces, king height 8 cm. Felt-lined compartments inside hold the pieces. Suitable for grandma and grandchild, played by two people.","Klappbares Schachbrett aus Buchenholz, 40 × 40 cm, mit eingebrannten Feldern. Figuren aus Hainbuche, Königshöhe 8 cm. Innen mit Filz ausgekleidete Figurenfächer. Für Oma und Enkel geeignet, gespielt wird zu zweit."],
  ["DAR-009","Lavender bath salts, 1 kg","Badesalz mit Lavendel, 1 kg","Coarse sea salt with dried lavender and lavender oil in a glass jar with a cork stopper. Use 3 tablespoons per bath; the jar lasts for about 20 baths. No dyes or synthetic fragrances.","Grobkörniges Meersalz mit getrocknetem Lavendel und Lavendelöl im Glas mit Korkverschluss. Pro Bad 3 Esslöffel verwenden; das Glas reicht für etwa 20 Bäder. Ohne Farbstoffe und synthetische Duftstoffe."],
  ["DAR-010","Slovak mountains wall calendar 2027","Wandkalender Slowakische Berge 2027","Calendar for 2027 with twelve photographs of Slovak mountains, A3 landscape format, spiral binding. Matte 200 g/m² paper, holidays marked. The photographs can be framed after the year ends.","Kalender für 2027 mit zwölf Fotografien slowakischer Berge, A3 im Querformat, Spiralbindung. Mattes Papier mit 200 g/m², Feiertage markiert. Die Fotografien lassen sich nach Jahresende einrahmen."],
  ["DAR-011","Wool slippers, size 40 to 41","Wollhausschuhe, Größe 40 bis 41","Warm, breathable slippers made from felted sheep's wool with leather soles. The wool adapts to the shape of your feet over time. Choose your usual size. Wear barefoot or with thin socks.","Warme, atmungsaktive Hausschuhe aus gefilzter Schafwolle mit Ledersohle. Die Wolle passt sich mit der Zeit der Fußform an. Wählen Sie Ihre übliche Größe. Barfuß oder mit dünnen Socken tragen."],
  ["DAR-012","Wool slippers, size 42 to 43","Wollhausschuhe, Größe 42 bis 43","The same felted sheep's wool slippers with leather soles in size 42 to 43. The wool adapts to the shape of your feet over time. Choose your usual size.","Dieselben Hausschuhe aus gefilzter Schafwolle mit Ledersohle in Größe 42 bis 43. Die Wolle passt sich mit der Zeit der Fußform an. Wählen Sie Ihre übliche Größe."]
];
// Slovenský text, anglický text, nemecký text.
const SLOVA = [
  ["Kuchyňa","Kitchen","Küche"],
  ["Hrnce a panvice","Pots and pans","Töpfe und Pfannen"],
  ["Príprava jedla","Food preparation","Speisenzubereitung"],
  ["Skladovanie","Storage","Aufbewahrung"],
  ["Pečenie","Baking","Backen"],
  ["Textil","Textiles","Textilien"],
  ["Kávovary a čaj","Coffee and tea","Kaffee und Tee"],
  ["Kávovary","Coffee machines","Kaffeemaschinen"],
  ["Mlynčeky","Grinders","Kaffeemühlen"],
  ["Príprava kávy","Coffee preparation","Kaffeezubereitung"],
  ["Kanvice","Kettles","Wasserkocher"],
  ["Čaj","Tea","Tee"],
  ["Šálky a poháre","Cups and glasses","Tassen und Gläser"],
  ["Záhrada","Garden","Garten"],
  ["Náradie","Tools","Werkzeuge"],
  ["Pestovanie","Growing","Pflanzenanzucht"],
  ["Polievanie","Watering","Bewässerung"],
  ["Nábytok","Furniture","Möbel"],
  ["Osvetlenie","Lighting","Beleuchtung"],
  ["Upratovanie","Cleaning","Reinigung"],
  ["Podlahy","Floors","Böden"],
  ["Utierky","Cloths","Tücher"],
  ["Vysávače","Vacuum cleaners","Staubsauger"],
  ["Vzduch","Air","Raumluft"],
  ["Bielizeň","Laundry","Wäsche"],
  ["Okná","Windows","Fenster"],
  ["Deti","Children","Kinder"],
  ["Hračky","Toys","Spielzeug"],
  ["Batohy a tašky","Backpacks and bags","Rucksäcke und Taschen"],
  ["Stolovanie","Mealtimes","Essen und Trinken"],
  ["Do izby","For the bedroom","Fürs Kinderzimmer"],
  ["Hry","Games","Spiele"],
  ["Darčeky","Gifts","Geschenke"],
  ["Jedlé darčeky","Food gifts","Kulinarische Geschenke"],
  ["Do domácnosti","For the home","Für Zuhause"],
  ["Papiernictvo","Stationery","Schreibwaren"],
  ["Kúpeľ","Bath","Baden"],
  ["Materiál","Material","Material"],
  ["Objem","Capacity","Volumen"],
  ["Farba","Colour","Farbe"],
  ["Priemer","Diameter","Durchmesser"],
  ["Rozmery","Dimensions","Maße"],
  ["Príkon","Power","Leistung"],
  ["Hmotnosť","Weight","Gewicht"],
  ["Pôvod","Origin","Herkunft"],
  ["Dĺžka","Length","Länge"],
  ["Obsah","Contents","Inhalt"],
  ["Nosnosť","Load capacity","Tragkraft"],
  ["Veľkosť","Size","Größe"],
  ["Výška","Height","Höhe"],
  ["Výdrž","Runtime","Laufzeit"],
  ["Vôňa","Scent","Duft"],
  ["Vek","Age","Alter"],
  ["nerezová oceľ 18/10","18/10 stainless steel","Edelstahl 18/10"],
  ["strieborná","silver","silber"],
  ["liatina","cast iron","Gusseisen"],
  ["čierna","black","schwarz"],
  ["hliník s keramickým povrchom","aluminium with ceramic coating","Aluminium mit Keramikbeschichtung"],
  ["krémová","cream","creme"],
  ["dub","oak","Eiche"],
  ["prírodná","natural","natur"],
  ["nerezová oceľ X50CrMoV15","X50CrMoV15 stainless steel","Edelstahl X50CrMoV15"],
  ["tvrdené sklo","tempered glass","gehärtetes Glas"],
  ["biela","white","weiß"],
  ["borosilikátové sklo, bambus","borosilicate glass, bamboo","Borosilikatglas, Bambus"],
  ["0,3 až 1,5 l","0.3 to 1.5 l","0,3 bis 1,5 l"],
  ["priehľadná","clear","transparent"],
  ["smaltovaná liatina","enamelled cast iron","emailliertes Gusseisen"],
  ["tmavomodrá","dark blue","dunkelblau"],
  ["100 % ľan, 220 g/m²","100% linen, 220 g/m²","100 % Leinen, 220 g/m²"],
  ["prírodná s modrým pásom","natural with a blue stripe","natur mit blauem Streifen"],
  ["uhlíková oceľ s nepriľnavou vrstvou","carbon steel with non-stick coating","Kohlenstoffstahl mit Antihaftbeschichtung"],
  ["sivá","grey","grau"],
  ["nerezová oceľ","stainless steel","Edelstahl"],
  ["plast, nerezová oceľ","plastic, stainless steel","Kunststoff, Edelstahl"],
  ["plast","plastic","Kunststoff"],
  ["červená","red","rot"],
  ["nerezová oceľ, keramika","stainless steel, ceramic","Edelstahl, Keramik"],
  ["borosilikátové sklo, nerezová oceľ","borosilicate glass, stainless steel","Borosilikatglas, Edelstahl"],
  ["matná čierna","matte black","mattschwarz"],
  ["liatina so smaltom","enamelled cast iron","emailliertes Gusseisen"],
  ["zelená","green","grün"],
  ["India, Assam","India, Assam","Indien, Assam"],
  ["borosilikátové sklo","borosilicate glass","Borosilikatglas"],
  ["kalená oceľ, hliník","hardened steel, aluminium","gehärteter Stahl, Aluminium"],
  ["kalená oceľ, plast","hardened steel, plastic","gehärteter Stahl, Kunststoff"],
  ["modrín","larch","Lärche"],
  ["pozinkovaný plech","galvanised sheet metal","verzinktes Blech"],
  ["PVC s výstužou","reinforced PVC","verstärktes PVC"],
  ["recyklovaný plast","recycled plastic","recycelter Kunststoff"],
  ["bazalka, petržlen, pažítka, kôpor, tymian, rukola","basil, parsley, chives, dill, thyme, rocket (arugula)","Basilikum, Petersilie, Schnittlauch, Dill, Thymian, Rucola"],
  ["akácia","acacia","Akazie"],
  ["hnedá","brown","braun"],
  ["kozia koža, bavlna","goatskin, cotton","Ziegenleder, Baumwolle"],
  ["nerezová oceľ, plast","stainless steel, plastic","Edelstahl, Kunststoff"],
  ["plast, mikrovlákno","plastic, microfibre","Kunststoff, Mikrofaser"],
  ["mikrovlákno 300 g/m²","microfibre 300 g/m²","Mikrofaser 300 g/m²"],
  ["mix farieb","assorted colours","verschiedene Farben"],
  ["modrá","blue","blau"],
  ["40 minút","40 minutes","40 Minuten"],
  ["bukové drevo, kokosové vlákno","beech wood, coconut fibre","Buchenholz, Kokosfasern"],
  ["morská tráva, bavlna","seagrass, cotton","Seegras, Baumwolle"],
  ["hliník, guma, mikrovlákno","aluminium, rubber, microfibre","Aluminium, Gummi, Mikrofaser"],
  ["1 až 2 m","1 to 2 m","1 bis 2 m"],
  ["bez parfumu","fragrance-free","ohne Duftstoffe"],
  ["oceľ s práškovou farbou","powder-coated steel","pulverbeschichteter Stahl"],
  ["bukové drevo","beech wood","Buchenholz"],
  ["farebná","multicoloured","bunt"],
  ["od 1 roka","from 1 year","ab 1 Jahr"],
  ["recyklovaný polyester","recycled polyester","recyceltes Polyester"],
  ["žltá","yellow","gelb"],
  ["od 3 rokov","from 3 years","ab 3 Jahren"],
  ["nerezová oceľ, silikón","stainless steel, silicone","Edelstahl, Silikon"],
  ["od 2 rokov","from 2 years","ab 2 Jahren"],
  ["preglejka, bukové drevo","plywood, beech wood","Sperrholz, Buchenholz"],
  ["od 18 mesiacov","from 18 months","ab 18 Monaten"],
  ["silikón","silicone","Silikon"],
  ["kartón","cardboard","Karton"],
  ["lipový, lesný, kvetový med","linden, forest and blossom honey","Linden-, Wald- und Blütenhonig"],
  ["100 % merino vlna","100% merino wool","100 % Merinowolle"],
  ["terakotová","terracotta","terrakotta"],
  ["sójový vosk, sklo, drevený knôt","soy wax, glass, wooden wick","Sojawachs, Glas, Holzdocht"],
  ["kamenina","stoneware","Steinzeug"],
  ["modrá glazúra","blue glaze","blaue Glasur"],
  ["hovädzia koža, papier 100 g/m²","cowhide, paper 100 g/m²","Rindsleder, Papier 100 g/m²"],
  ["A5, 192 strán","A5, 192 pages","A5, 192 Seiten"],
  ["lipa, mäta, medovka, šípka","linden, mint, lemon balm, rosehip","Linde, Minze, Melisse, Hagebutte"],
  ["bukové a hrabové drevo","beech and hornbeam wood","Buchen- und Hainbuchenholz"],
  ["morská soľ, sušená levanduľa","sea salt, dried lavender","Meersalz, getrockneter Lavendel"],
  ["fialová","purple","violett"],
  ["papier 200 g/m²","paper 200 g/m²","Papier 200 g/m²"],
  ["A3 na šírku","A3 landscape","A3 Querformat"],
  ["plstená ovčia vlna, koža","felted sheep's wool, leather","gefilzte Schafwolle, Leder"],
  ["40 až 41","40 to 41","40 bis 41"],
  ["42 až 43","42 to 43","42 bis 43"]
];
const slovnik = new Map(SLOVA.map(([sk, en, de]) => [sk, { en, de }]));
const produkty = new Map(PREKLADY.map(([id, en, de, enPopis, dePopis]) => [id, {
  en: { nazov: en, popis: enPopis }, de: { nazov: de, popis: dePopis }
}]));
const xmlText = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const pole = (s, tag) => (s.match(new RegExp('<' + tag + '>([\\s\\S]*?)</' + tag + '>')) || [])[1] || '';
function prelozSlovo(s, lang) {
  if (slovnik.has(s)) return slovnik.get(s)[lang];
  if (/^(?:[0-9., ×]+(?:cm|mm|kg|g|ml|l|W|m)|M|L)$/.test(s)) {
    return lang === 'en' ? s.replace(/(\d),(\d)/g, '$1.$2') : s;
  }
  throw new Error('Chýba preklad: ' + s);
}
export function prelozFeed(xml, lang) {
  if (!['en', 'de'].includes(lang)) throw new Error('Nepodporovaný jazyk');
  xml = xml.replaceAll('\r\n', '\n');
  if (createHash('sha256').update(xml).digest('hex') !== ZDROJ_SHA256) {
    throw new Error('SK feed sa zmenil. Skontrolujte preklady a až potom aktualizujte ZDROJ_SHA256.');
  }
  const bloky = [...xml.matchAll(/<SHOPITEM>([\s\S]*?)<\/SHOPITEM>/g)].map((m) => m[1]);
  if (bloky.length !== 64 || produkty.size !== 64) throw new Error('Očakávam 64 výrobkov');
  const videne = new Set();
  const hotove = bloky.map((blok) => {
    const id = pole(blok, 'ITEM_ID');
    if (videne.has(id) || !produkty.has(id)) throw new Error('Neznáme alebo duplicitné ID: ' + id);
    videne.add(id);
    const t = produkty.get(id)[lang];
    let out = blok.replace(/<PRODUCTNAME>[\s\S]*?<\/PRODUCTNAME>/,
      '<PRODUCTNAME>' + xmlText(t.nazov) + '</PRODUCTNAME>\n  <PRODUCT>' + xmlText(t.nazov) + '</PRODUCT>');
    out = out.replace(/<DESCRIPTION>[\s\S]*?<\/DESCRIPTION>/, '<DESCRIPTION>' + xmlText(t.popis) + '</DESCRIPTION>');
    out = out.replace(/<CATEGORYTEXT>(.*?)<\/CATEGORYTEXT>/, (_, s) =>
      '<CATEGORYTEXT>' + s.split(' | ').map((v) => xmlText(prelozSlovo(v, lang))).join(' | ') + '</CATEGORYTEXT>');
    for (const tag of ['PARAM_NAME', 'VAL']) {
      out = out.replace(new RegExp('<' + tag + '>(.*?)</' + tag + '>', 'g'), (_, s) =>
        '<' + tag + '>' + xmlText(prelozSlovo(s, lang)) + '</' + tag + '>');
    }
    out = out.replace('https://arling.sk/asistent/ukazka/#p-', 'https://arling.sk/asistent/ukazka/' + lang + '/#p-');
    return '<SHOPITEM>' + out.trim().replace(/>\s+</g, '><') + '</SHOPITEM>';
  });
  const oznam = lang === 'en'
    ? 'Good Home: fictional ARLing Assistant demo shop. Products, brands, prices and EAN codes are made up. Nothing can be bought. Prices in EUR including VAT.'
    : 'Gutes Zuhause: erfundener Demoshop des ARLing Assistenten. Produkte, Marken, Preise und EAN-Codes sind erfunden. Hier kann man nichts kaufen. Preise in EUR inklusive Mehrwertsteuer.';
  return '<?xml version="1.0" encoding="UTF-8"?>\n<!-- ' + oznam + ' -->\n<SHOP>\n' + hotove.join('\n') + '\n</SHOP>\n';
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const zapis = process.argv.includes('--zapis') && !process.argv.includes('--dry');
  const zdroj = readFileSync(new URL('feed.xml', import.meta.url), 'utf8');
  for (const lang of ['en', 'de']) {
    const xml = prelozFeed(zdroj, lang);
    const cesta = new URL(lang + '/feed.xml', import.meta.url);
    if (zapis && (!existsSync(cesta) || readFileSync(cesta, 'utf8') !== xml)) {
      mkdirSync(new URL(lang + '/', import.meta.url), { recursive: true });
      writeFileSync(cesta, xml, 'utf8');
    }
    console.log(lang + '/feed.xml: 64 výrobkov, ' + (zapis ? 'zapísané alebo aktuálne' : 'bez zápisu'));
  }
}
