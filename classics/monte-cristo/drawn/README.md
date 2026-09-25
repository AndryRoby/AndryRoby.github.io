# The Count of Monte Cristo, drawn in code

Page: `https://arling.sk/classics/monte-cristo/drawn/` (not linked from anywhere yet; links, sitemap and og:image are Fable's).
Written 25. 9. 2026 by Claude (Opus 5.5) in three parts: part 1 made the press and 12 scenes from volumes one and two, part 2 added 12 from volumes three and four (parts V and VI), part 3 added 13 from volume five and the end (parts VII and VIII), a closing coda, blend-free drums and versioned scene loading. **37 scenes, all five volumes, every story line.**

A long page styled as a risograph poster: three inks (sunflower yellow, bright red, medium blue) on paper, halftone dots, slightly out of register. Every scene is drawn by code (canvas, no image, no library, no CDN), each with a word for word quotation, the chapter and a note on what comes from the book and what we chose. Below the scenes: all 117 chapters, one sentence each, and a chart of chapter lengths. At the end a quiet invitation to the e-ink edition (`/classics/monte-cristo/`, 4.90 €, free sample).

## Files

| File | What it does |
|---|---|
| `index.html` | the page: site shell (copied from `games/escape/lighthouse/`), masthead, parts with plates, timeline, edition, about. No inline script (CSP). |
| `drawn.css` | the poster. Every rule is under `.poster` so the site's `body.noc` rules never win. |
| `drawn.js` | main thread, 10 kB (3.7 kB gzipped): IntersectionObserver queue, sends print jobs to the worker, runs the drum animation once, keeps the finished print as an `<img>` (blob URL). Passes its own `?v=N` on to the worker and the scene list. |
| `press-worker.js` | the background thread: draws the scene into OffscreenCanvas, screens it, returns a WebP and, for the drums, three opaque stages of the print (yellow; yellow and red; all three). Loads `scenes/index.js` with the page's version. |
| `ink.js` | the press: drawing kit `k`, halftone screen per ink, paper, `lay()`. Runs in the worker and on the main thread (fallback). |
| `parts.js` | ink mixes `C`, people with clothes (`person`, `seated`), crowds, waves, stars, stonework, clouds, gulls. Hats: `top`, `bicorne`, `cap`, `bonnet`, and since part 2 also `broad`, `tricorne`, `fez` (red, blue tassel), `varnished`; `o.hood` draws a monk's cowl; arm pose `shake` (handshake). |
| `salon.js` | part 2: Paris in 1838. `lady` (bell skirt, wide sleeves, hair in bands and a knot; poses `down`, `clasp`, `offer`, `reach`, `read`, `plead`, `veil`; options `scarf`, `sash`, `flounce`, `veil`, `veilBack`; returns the hands), `haydee` (the Greek dress of ch. 49, with `burnous` or `veilHeld`), `PALE` skin for the count, `parquet`, `drape`, `chandelier`, `frame` (gilt), `books`, `armchair` (with casters), `lampCone`. |
| `sea.js` | sky, sun and moon, sea, light paths, ships: `ship` (three-master), `tartan` (lateen sail), `boat`, `sitter`. |
| `arch.js` | rock, crenels, towers, walls, `chateauIf`, Marseilles `houses`, `arcade`, `candle`, `table`, `bottle`, `glass`, `lantern`. |
| `scenes/v1.js`, `scenes/v2.js` | the scenes of volumes one and two. |
| `scenes/v3.js`, `scenes/v4.js` | part 2: the scenes of volumes three and four (`v4.js` also has `horse` and `carriage`). |
| `scenes/v5.js` | part 3: the 13 scenes of volume five and the end, plus small figure helpers (`F`, `arm` with an outlined sleeve, `crouch`, `bowed`, `tomb`, `yew`). |
| `scenes/ride.js` | `horse` and `carriage`, moved out of `v4.js` in part 3 so volumes four and five share them (a new file, so a cached old `v4.js` can never break `v5.js`). |
| `scenes/index.js` | registry: every scene by id, v1 to v5. |
| `timeline.mjs` | build tool, not loaded by the page: regenerates the 117 chapter block in `index.html` between `<!--TL` and `<!--/TL-->`. Run `node timeline.mjs` in this folder after adding plates. |

## Scenes (part 1: volumes one and two, 12 scenes)

Quotations are from `ops/klasika/data/monte-cristo.txt` (Gutenberg #1184), checked word for word by script (whitespace and `_italics_` normalised). "r." is the line in that file.

| # | id | Chapter | Shape | Quotation (r.) | What is drawn; book or our choice |
|---|---|---|---|---|---|
| 1 | `arrival` | 1 Marseilles, The Arrival (vol. 1) | pano | r. 178 | Fort Saint-Jean ramparts "covered with spectators" (r. 184), the Pharaon "under topsails, jib, and spanker" (r. 193), Morrel's skiff (r. 206), Notre-Dame de la Garde, the Château d'If far off. Morning light is ours. |
| 2 | `catalans` | 3 The Catalans (vol. 1) | tall | r. 1031 | Whitewashed house, dead-leaf coloured village (r. 1029), Mercédès against the wainscot with heath, bare brown arms, red stockings with grey and blue clocks (r. 1031 to 1040), Fernand on a chair on two legs at a worm-eaten table (r. 1040 to 1042). Dress colours and Fernand's clothes: ours (caption says so). |
| 3 | `conspiracy` | 4 Conspiracy (vol. 1) | wide | r. 1701 | Arbour of La Réserve (r. 1233), Danglars writing with the left hand (r. 1703), Fernand reading, Caderousse drunk. Sunset: ours (mapa-kapitol mood). |
| 4 | `to-if` | 8 The Château d'If (vol. 1) | pano | r. 3625 | Night boat with gendarmes, the "black and frowning rock". Lantern: ours, said in the caption. |
| 5 | `faria` | 15 Number 34 and Number 27 (vol. 1) | tall | r. 6705 | The floor gives way, Faria's head and shoulders; Faria as in postavy.md Š54 (white hair, black beard to the breast, grey brows). |
| 6 | `abbe` | 17 The Abbé's Chamber (vol. 1) | wide | r. 7277 | Linen strips 4 by 18 inches, numbered, "finis" on the 68th (r. 7270 to 7276), cartilage pens (r. 7286 to 7290), lamp of melted fat (r. 7322), rope ladder. |
| 7 | `cemetery` | 20 The Cemetery of the Château d'If (vol. 1) | tall | r. 9483 | Storm, rampart, two grave-diggers with a lantern, rings of foam. The fall itself is never shown. |
| 8 | `tiboulen` | 21 The Island of Tiboulen (vol. 1) | pano | r. 9658 | Dawn, the tartan with lateen sail, the rocks, a swimmer in the red cap from the wreck (Š04). He is naked in the book: only head and one arm above water. |
| 9 | `treasure` | 24 The Secret Cave (vol. 1) | wide | r. 10883 | The coffer with three compartments: coin, bars, diamonds, pearls, rubies; torch, pickaxe, Edmond kneeling. |
| 10 | `pharaon` | 30 The Fifth of September (vol. 2) | wide | r. 14206 | New Pharaon in front of the tower of Saint-Jean, name on the stern, crowd on the pier, Morrel and Maximilian embracing (r. 14216), the man with the black beard behind the sentry-box (r. 14217 to 14220), the yacht leaving. |
| 11 | `colosseum` | 34 The Colosseum (vol. 2) | pano | r. 16973 | Moonlit arches, hanging shoots (r. 17069 to 17071), the man in the large brown mantle, fold over the left shoulder, broad-brimmed hat, polished boots (r. 17076 to 17083), Franz hidden. |
| 12 | `carnival` | 36 The Carnival at Rome (vol. 2) | tall | r. 19652 | The Corso, palaces with carpets and damask on the balconies (r. 19001 to 19002, 18654), the moccoletti (r. 19628 to 19650), confetti and violets. |

Timeline anchors: `#ch-1` to `#ch-117`; scene links appear automatically for every plate with `data-chapter`.

## Scenes (part 2: volumes three and four, 12 scenes)

Two new parts on the page: **V Paris and Auteuil** (`#part-paris`, ch. 51 to 71) and **VI Janina and the challenge** (`#part-janina`, ch. 77 to 90). All 12 quotations checked word for word against monte-cristo.txt by script (the same normalisation as part 1).

| # | id | Chapter | Shape | Quotation (r.) | What is drawn; book or our choice |
|---|---|---|---|---|---|
| 13 | `gate` | 51 Pyramus and Thisbe (vol. 3) | tall | r. 27717 | Chestnut trees with pink and white blossom above the walls, stone vases with scarlet geraniums on two square pilasters, the Louis XIII iron gate boarded to six feet with planks "not so closely adjusted" (r. 27619 to 27660), the bench with book, parasol and work-basket with the embroidered cambric handkerchief (r. 27695 to 27698), Valentine in the white robe and blue sash (r. 27718 to 27719), Maximilian as a gardener in grey blouse and velvet cap (r. 27707), seen only as a cap above the boards and through the chinks. Colour of the cap and the evening light: ours. |
| 14 | `opera` | 53 Robert le Diable (vol. 3) | pano | r. 29311 | The house seen from the pit, the pit standing and staring (r. 29300 to 29303), the count in deep black and Haydée in Eastern dress with diamonds in the box that was the Russian ambassador's, her white cashmere burnous with pearls and coral (r. 29753 to 29754, worn when she leaves; here on). Three tiers, the chandelier, the opera glasses: ours. |
| 15 | `noirtier` | 58 M. Noirtier de Villefort (vol. 3) | wide | r. 32171 | The whole plate is what the great glass in front of him sees (r. 32156 to 32159), in a gilt frame. Armchair on casters (r. 32154), long white hair over the shoulders, eyes with thick black lashes (r. 32176 to 32178), Valentine, Villefort and his wife at the door (r. 32150 to 32152). Rug and dress colours: ours. |
| 16 | `telegraph` | 61 How a Gardener May Get Rid of the Dormice (vol. 3) | tall | r. 33554 | Tower with ivy and wall-flowers, the telegraph's "great bony arms" (r. 33538), red gravel path in a figure of 8 edged with box, twenty rose-trees, tank with a frog and a toad, black earth (r. 33561 to 33580), the hedge whose flowers have turned to green fruit, the gate on willow hinges with a nail and string (r. 33542 to 33547), the gardener rising from behind a wheelbarrow of leaves with strawberries on grape leaves (r. 33591 to 33596), the sun-dial (r. 33643). Gardener's clothes and apron: ours. |
| 17 | `feast` | 63 The Dinner (vol. 3) | wide | r. 34498 | Fruit in vases from China and jars from Japan, rare birds keeping their plumage, enormous fish on massive silver dishes, bottles of grotesque shape (r. 34494 to 34505); the sterlet and the lamprey (r. 34536 to 34546); four servants with two casks covered with water plants, a live fish in each (r. 34573 to 34574). Damask walls, livery colours, the chandelier: ours. |
| 18 | `busoni` | 69 The Inquiry (vol. 3) | wide | r. 37360 | Library of theological books and parchments (r. 37269 to 37271), the lamp with a large shade, the abbé in a monk's dress with a cowl (r. 37320 to 37324), the shade pressed down on his side so the light falls on the visitor (r. 37360 to 37365). The visitor's raised hand against the glare: ours, from "the light tries my eyes very much". |
| 19 | `hothouse` | 71 Bread and Salt (vol. 3) | tall | r. 38260 | The greenhouse at the end of the linden grove, fruit ripened by artificial heat, a bunch of Muscatel grapes, the peach on the wall, Mercédès in a light dress and gauze scarf (r. 38215 to 38256). The ball's lit windows through the glass and all colours: ours. |
| 20 | `janina` | 77 Haydée (vol. 4) | pano | r. 42343 | Pindus, the white angular castle of Yanina, the black vegetation like lichens (r. 42342 to 42347), the kiosk on the lake with a ground floor and an upper floor of lattice-work (r. 42258, 42313 to 42316, 42387), Ali with a long white beard (r. 42156), Vasiliki beside him, the child at his feet, black specks on the lake (r. 42338). Nothing of what came after is drawn. Kiosk colours: ours. |
| 21 | `treport` | 85 The Journey (vol. 4) | wide | r. 47231 | Albert's window on a terrace with the sea in front (r. 47227 to 47229), the sloop with narrow keel and high masts, the Monte Cristo arms on its flag (a mountain or on a sea azure, a cross gules in chief), fishing boats round it (r. 47231 to 47242). Chalk cliffs, curtains: ours. |
| 22 | `trial` | 86 The Trial (vol. 4) | tall | r. 47681 | Haydée having thrown aside the large veil, in the Grecian costume (r. 47678 to 47683), the seat the president placed for her, which she declined, Morcerf fallen on his chair (r. 47700 to 47703) in his uniform buttoned up to the chin (r. 47582), Beauchamp in a box concealed by a column (r. 47577 to 47578). Uniform colour, columns and windows: ours. |
| 23 | `letter` | 89 The Night (vol. 4) | tall | r. 48775 | Mercédès veiled, the veil thrown back (r. 48675, 48697), the secretaire with the drawer opened by a spring and Danglars' letter, its paper yellowed and its ink rusty (r. 48774 to 48778). The pistols and swords on the table (r. 48662 to 48677) are left out on purpose. The lamp and the wax lights are from the same night (r. 49010). |
| 24 | `vincennes` | 90 The Meeting (vol. 4) | pano | r. 49544 | The wood of Vincennes at eight, a carriage under the trees (r. 49326 to 49333), Albert on horseback with a servant, open coat and white waistcoat (r. 49442 to 49454), the four young men and the count's two seconds, the handshake. No weapon is drawn. Colours of coats and horses: ours. |

Values kept: the poisonings (ch. 52, 72, 79), the burglary and Caderousse's death (ch. 82, 83) and the fall of Janina are not drawn; Janina appears only as Haydée remembers it before the end.

## Scenes (part 3: volume five and the end, 13 scenes)

Two new parts: **VII The reckoning** (`#part-reckoning`, ch. 97 to 110) and **VIII Wait and hope** (`#part-end`, ch. 112 to 117), then a coda: the book's last two words set large, like the masthead (`#coda`). All 13 quotations checked word for word by the same script as parts 1 and 2 (`quotes5.json` in the session scratchpad); cuts are marked with "…" only, which is also how a dash in the source is left out.

| # | id | Chapter | Shape | Quotation (r.) | What is drawn; book or our choice |
|---|---|---|---|---|---|
| 25 | `eugenie` | 97 The Departure for Belgium | tall | r. 52278 | The man's costume "from the boots to the coat", waistcoat buttoned to the throat (r. 52264 to 52270), the left hand holding the hair, long scissors in the right, the hair falling at her feet (r. 52277 to 52284), the portmanteau and padlock (r. 52228 to 52237), the man's hat (r. 52275), Louise in the wadded violet silk travelling cloak (r. 52239 to 52243). Coat, waistcoat and room colours, the framed music: ours. |
| 26 | `roofs` | 98 The Bell and Bottle Tavern | wide | r. 52739 | The smoke "like the dull vapor from a volcano" (r. 52735), Andrea against the chimney-pots (r. 52739), the Hôtel de Ville "a massive sixteenth century building" with openings in the tower and a gendarme’s head at a little window (r. 52751 to 52766), the crowd and gendarmes in the court (r. 52631 to 52660). Andrea's light hair and red beard: r. 30967. Tiles, coat colour, belfry shape: ours. |
| 27 | `apparition` | 100 The Apparition | tall | r. 53489 | The night-lamp (r. 53452), alabaster, on the chimney-piece (r. 53423), the library door "in the recess by the chimney-piece" opening (r. 53454 to 53456), the figure "more protecting than menacing" holding the glass to the light (r. 53488 to 53490), four nights of watching (r. 53590). Valentine's chestnut hair: postavy.md Š59. Room colours: ours. The poison is only a glass held to a lamp. |
| 28 | `lachaise` | 105 The Cemetery of Père-Lachaise | pano | r. 55231 | Dull stormy weather, cold wind, the last yellow leaves (r. 55177 to 55179), the vault "The families of Saint-Méran and Villefort" (r. 55186 to 55187), yew-trees and white avenues (r. 55229 to 55233), the tomb of Abélard and Héloïse (r. 55239), Morrel against a tree above the mausoleum, coat buttoned to the throat, crushing his hat (r. 55245 to 55249), the count watching only him. Other monuments: ours. |
| 29 | `assizes` | 110 The Indictment | wide | r. 57610 | A brilliant September day (r. 57323 to 57326), the accused with one hand on his hat and the other in his white waistcoat (r. 57609 to 57611), the oaken rail of the dock (r. 57769), Villefort "half bowed over in his chair" (r. 57762), gendarmes. Robes and coat colour: ours. |
| 30 | `villejuif` | 112 The Departure | pano | r. 58518 | Starlight night, the top of the hill Villejuif, Paris as a sombre sea of phosphoric waves (r. 58516 to 58523), the count alone with folded arms, the carriage sent on a short distance, Ali the Nubian (r. 58512 to 58527). Which domes rise over the city, Ali's red cap: ours. |
| 31 | `garden` | 112 The Departure | tall | r. 58695 | The house in the Allées de Meilhan, the passage paved with bricks, the sunny garden (r. 58669 to 58699), Mercédès under the arbour of Virginia jessamine with long purple flowers, veil raised, face in her hands (r. 58704 to 58708), the count entering without knocking. Dress colour: ours. |
| 32 | `ifsunset` | 113 The Past | pano | r. 58994 | The pleasure-boat with striped awning from the Consigne (r. 58985 to 58990), the red flaming sun, a sea smooth as crystal, leaping fish, white fishing boats and merchant vessels on the horizon (r. 58993 to 59000), the count wrapped in his cloak (r. 59002 to 59004). A deliberate echo of plate 4 (`to-if`). Awning colours: ours. |
| 33 | `cell` | 113 The Past | tall | r. 59044 | The dull light through the narrow opening, the place of the bed, the new stones over Faria's breach, the log of wood (r. 59044 to 59049), the concierge’s torch in the corridor (r. 59063 to 59064), the hand pressed to his heart (r. 59068). Concierge's clothes: ours. |
| 34 | `fowl` | 115 Luigi Vampa's Bill of Fare | wide | r. 60149 | The whitewashed cell (r. 60000), the lamp through ill-joined planks (r. 60032 to 60034), Peppino opposite the door with the earthen pan of chick-peas and bacon, the basket of grapes and the flask of Orvieto (r. 60088 to 60092), the young man with the fowl on his head (r. 60148 to 60151), the worm-eaten table, stool and goat-skin (r. 60156 to 60158), the draft that pays for it (r. 60293 to 60305). Danglars' blue coat and white waistcoat r. 25179 to 25186, the fresh ribbon r. 59524 to 59527. Peppino's clothes: ours. |
| 35 | `stream` | 116 The Pardon | wide | r. 60572 | The road, the post-chaise, the tree he leaned against all night, the stream at daylight, the white hair (r. 60566 to 60573). The hunger and the scene in the catacombs are only told in the caption. The aqueduct: ours. |
| 36 | `dawnletter` | 117 The Fifth of October | tall | r. 61187 | Daybreak, a few remaining stars, the grotto door opened, Jacopo among the rocks (r. 61139 to 61153), the letter: its last lines are written on the sheet word for word (r. 61183 to 61190); line breaks and the red of the two words are ours. |
| 37 | `sail` | 117 The Fifth of October | pano | r. 61216 | Jacopo points to the horizon, the large white sail on the blue line between sky and sea (r. 61210 to 61217). What the count wore and Valentine's dress: not in the book, kept quiet. |

Values kept in part 3: Villefort's wife and son (ch. 108, 111), Morrel's despair with the pistols (ch. 105) and the knife (ch. 117), Danglars' hunger (ch. 116) are not drawn; the page shows a glass held to a lamp, a shut bronze door, new stones in a wall and white hair.

## Rules for adding scenes

**Where the page could go next.** The gaps are volume two (ch. 37 to 47: the catacombs, the breakfast, the house at Auteuil, the dappled grays) and ch. 5 to 7 (the marriage feast, the arrest). Add each new part to the list in `.mast-toc` and update the fallback number in `<span data-scene-count>` (JS counts the plates anyway). Keep the page in the order of the book.

**Adding a scene**
1. Write `draw(k)` in the volume's module (`scenes/v1.js` to `v5.js`) and export it in `SCENES`; a new module goes into `scenes/index.js`. Never add an export to an existing module that a new module then imports: a browser may hold the old file for a few minutes after deploy. Put shared helpers in a new file instead (as `ride.js`), and bump `?v=` on `drawn.js` in `index.html`.
2. Size must match the plate shape: `pano` 1400x700, `wide` 1200x800, `tall` 1000x1250. Give it a `seed` (the start line of its chapter is our habit).
3. Add the `<figure class="plate" id="s-ID" data-scene="ID" data-chapter="N" data-shape="...">` in the right part, in the same structure as the existing ones: `.art` with `role="img"` and a full `aria-label` describing the picture, `.art-alt` short text, `figcaption.cap` with `.cap-n`, `.cap-t` ("Chapter N, volume x" + title span), `blockquote`, `p.drawn`.
4. Alternate `flip` on wide and tall plates so the captions zigzag; pano plates never flip.
5. Run `node timeline.mjs` (adds the scene link and the dot on the chart).
6. Check the scene draws without errors (a Node smoke test with a mock 2D context is enough to catch NaN and typos), then look at it.

**Quotations.** Word for word from monte-cristo.txt, curly quotes and apostrophes as in the file, `_x_` becomes `<i>x</i>`, a cut is marked with "…" and nothing else. One quotation per scene, short enough to read in one breath (the treasure is the upper limit). The line number goes into this README.

**Captions.** `p.drawn` says what comes from the book (with a short quote in “ ” when useful) and what we chose where the book is silent. Never claim something the book does not say.

**Values.** No naturalistic cruelty: prison, poison, the duel, the suicide, the executions and deaths are shown only by a sign (a lantern, a ring on the water, an empty chair, a closed door). No occult imagery (the "hashish" of chapter 31 is not drawn). No fake urgency in the invitation. No em dash or en dash anywhere in text for people.

**Drawing style**
* Only the kit: `k.fill` (replaces what is under it, like a separation), `k.add` (glaze on top), `k.stroke`, `k.cut` (back to paper: light, foam, stars, highlights), `k.clip`, `k.lin`, `k.rad`, `k.blob` for organic shapes. Densities 0 to 1 per ink; use the mixes in `C` (`parts.js`) so the whole poster shares one palette. Over about 0.86 an ink prints solid.
* Light is made by cutting: a lamp or the moon is `k.cut(circle, k.rad(...))` then `k.add({ y: k.rad(...) })`. Draw a light's glow before the figures in front of it (a later cut erases them; the lantern helper takes size 0.01 for glow only, then call it again with glow 0 for the body).
* Night: `{ b: 0.95, r: 0.5, y: 0.08 }`. Warm stone: `{ y: 0.46, r: 0.2, b: 0.1 }`. Shade adds blue and a little red.
* People are flat poster figures (`person`, `seated`, `sitter`, `kneel` in v1.js) about 80 to 400 units tall; faces stay simple (eyes as dots at most). Clothes and disguises follow `ops/monte-cristo/postavy.md` (Š numbers): for example Busoni in black with a three-cornered hat (`hat: 'tricorne'`), Sinbad with the red cap and blue tassel (`hat: 'fez'`), the count in Paris dark and plain (`hat: 'top'`), Lord Wilmore in a blue coat with gold buttons (`buttons: C.gold`), the man in the Colosseum with `mantle` + `muffle` + `hat: 'broad'`.
* Composition: one clear subject, a strong light, big planes of colour, detail only where the eye goes. Leave paper showing somewhere in every scene.
* Keep a scene under about 500 ms in the worker at 1.4 megapixels (the 12 here take 100 to 450 ms). Thousands of tiny paths are fine; per pixel loops inside a scene are not.

**Performance rules (what keeps the page at 0 % at rest)**
* No `mix-blend-mode`, `filter` or `backdrop-filter` anywhere, including the drums. A blend on the masthead made every scrolled frame recomposite the whole poster (30 fps instead of 60, part 1). The drums used `multiply` on three full-size layers until part 3: at 1440 that cost 22 to 42 dropped frames per full scroll (0 with the drums hidden). Since part 3 the worker sends three opaque stages of the print instead, and a later drum always trails the one before, so the look is the same with plain compositing: 0 dropped frames.
* No timers, no `requestAnimationFrame` loops. The drum animation is Web Animations on `transform` only (compositor), once per plate, finished at once when the plate leaves the screen or the tab is hidden.
* Do not use `<header>` inside `main` (the site styles every `header` as the fixed site bar).

## Performance after part 3, measured 25. 9. 2026 (37 scenes, the whole page)

Same harness (`measure.mjs` in the session scratchpad, now with `REST_WAIT` and `REST_S`), one headless Chrome at a time (new headless, `--disable-gpu`, software raster, so a real GPU has more headroom), local server port 8871: scroll the whole page in steps of 35 % of the viewport every 260 ms while recording every `requestAnimationFrame` interval, wait for every plate, then read `Performance.getMetrics` over the rest window.

| | 1440 x 900, dpr 1 | 390 x 844, dpr 2 (mobile) |
|---|---|---|
| page height | 43 921 px | 46 903 px |
| frames while scrolling the whole page | 60 fps, median 16.7 ms, p95 16.8 ms, **0 frames over 33 ms** in 2234 | 60 fps, median 16.7 ms, p95 16.7 ms, **0 frames over 33 ms** in 2539 |
| main thread busy while scrolling | 2340 ms in 37.2 s (6.3 %) | 2692 ms in 42.3 s (6.4 %) |
| Long Animation Frames of 50 ms or more (main thread) | 0 | not run |
| at rest after the last print | 50 ms task time in 5 s (1 %), ScriptDuration 0, 0 layouts, 0 style recalcs; another run 0 ms | 3 ms task time in 10 s (**0.03 %**), ScriptDuration 0, 0 layouts, 0 style recalcs |
| drum passes shown | 37 of 37 | 37 of 37 |
| print time per scene in the worker | 145 to 462 ms for all 37; the 13 new ones 145 to 353 ms | 120 to 503 ms; the new ones 124 to 502 ms |
| print size kept per scene | WebP 289 to 581 kB, 14.3 MB for 37 | 160 to 483 kB, 10.9 MB for 37 |
| JS heap | 0.8 MB | 0.8 MB |
| errors in the console, failed plates | 0, 0 | 0, 0 |

The rest figure at 1440 is Chrome's own housekeeping (no script, no layout, no style); the 390 run, with a longer wait before the window, measured 0.03 %.

The drums before and after the part 3 change, 1440, same harness: with `multiply` blended layers 22, 24 and 42 frames over 33 ms in three runs (p95 still 16.8 ms and 0 Long Animation Frames of 50 ms or more, so compositor and raster, not script); drums hidden 0; opaque stages 0.

Also checked in part 3: without OffscreenCanvas (printing on the main thread in 6 ms slices) every plate prints, the 13 new ones in 88 to 247 ms each, 0 errors; with `prefers-reduced-motion: reduce` every plate appears with no drum pass (0 animated), 0 errors. Drawing alone (vector shapes before the screen) takes 0.6 to 4.1 ms per new scene in the Node smoke test (no NaN); a full press at 460 px on the main thread 37 to 85 ms per new scene.

JS: the main thread still loads only `drawn.js` (3.7 kB gzipped) and `ink.js` (4.6 kB). The worker loads the drawing kit and all scene modules after the page is up, about 78 kB gzipped in total; `v5.js` is 65 kB raw, 18.9 kB gzipped.

Screenshots checked in part 3 (6, the limit): two contact sheets of the 13 new scenes at 460 px. The second came after fixes: Andrea was lost on the roof and is now larger, in a colour that stands off the tiles; Danglars at the stream read as a blob and is now a kneeling figure half as big again; the figures in the catacomb were too small; a yellow glaze over the blue sea turned green in the last plate and is gone; Valentine's hand on the letter read as a napkin and is gone; the new stones in the cell were too bright and are toned down. Then 1440 at the head of part VII and at the coda (the coda's second line wrapped badly; now `text-wrap: balance`), and 390 at the letter and at the last plate with the coda (pano captions on narrow screens had 2 px between the quotation and the note; now 14 px, which helps all 11 pano plates). Seen only in the Node smoke test after the last fixes: the count at 760 instead of 820 units in `apparition` and larger in `villejuif`.

## Performance after part 2, measured 25. 9. 2026 (24 scenes)

Same harness as below (`measure.mjs` in the session scratchpad, now waiting for every plate on the page instead of 12), one headless Chrome at a time, local server port 8871.

| | 1440 x 900, dpr 1 | 390 x 844, dpr 2 (mobile) |
|---|---|---|
| page height | 31 754 px | 36 218 px |
| frames while scrolling the whole page | 59.9 fps, median 16.7 ms, p95 16.8 ms, 3 frames over 33 ms in 1605 | 60 fps, median 16.7 ms, p95 16.8 ms, 0 frames over 33 ms in 1958 |
| main thread busy while scrolling | 1089 ms in 26.8 s (4.1 %) | 1091 ms in 32.6 s (3.3 %) |
| at rest, 5 s after the last print | TaskDuration 0 ms, ScriptDuration 0 ms, 0 layouts, 0 style recalcs: **0 % CPU** | same: **0 % CPU** |
| print time per scene in the worker | 120 to 248 ms for all 24; the 12 new ones 120 to 240 ms | 73 to 256 ms |
| print size kept per scene | WebP 289 to 565 kB, 9.4 MB for 24 | 161 to 483 kB, 7.2 MB for 24 |
| JS heap | 0.8 MB | 0.9 MB |
| errors in the console, failed plates | 0, 0 | 0, 0 |

Drawing alone (vector shapes, before the halftone screen) takes 1.5 to 11 ms per new scene in the Node smoke test; in a contact sheet on the main thread the full press took 37 to 83 ms per new scene at 460 px. JS for the worker is now about 53 kB gzipped in total (was 28 kB): `v3.js` 42 kB and `v4.js` 26 kB raw, `salon.js` 5.5 kB gzipped. The main thread still loads only `drawn.js` and `ink.js`. The 3 long frames at 1440 were single frames while a finished print was decoded; p95 stayed at 16.8 ms.

Checked on screenshots (6, the limit): two contact sheets of the 12 new scenes (the second after fixes: telegraph arms were cut off at the top, grape bunches read as triangles, Haydée was too small at the Opera, Noirtier's eyes were too weak, the chestnut crowns looked like lollipops, the Vincennes canopy looked like a curtain; all fixed), 1440 at the head of part V and at the night study, 390 at Noirtier and at Vincennes. Seen only in the Node smoke test after the last small fixes: Noirtier's eyes at 1440, the count's darker hands in the night study, the far trunks at Vincennes at 1440. Not seen on a screenshot at all: the hats that part 2 added to `person()` (`broad`, `varnished`) also appear now in part 1, on the man in the Colosseum, the man behind the sentry-box and the sailors of the new Pharaon, as part 1 intended (they were silently missing before). Worth one look.

Cache note for deployment (fixed in part 3): `drawn.js?v=N` now passes its `?v=N` to `press-worker.js` and to `scenes/index.js` (worker and main-thread fallback), so a new version always loads a fresh scene list. The modulepreload of `ink.js` had a `?v=1` that the import never used, so `ink.js` was fetched twice; it now matches.

## Performance, measured 25. 9. 2026 (part 1, 12 scenes)

Headless Chrome (new headless, `--disable-gpu`, software raster) through the Chrome DevTools Protocol, local server port 8871, script in the session scratchpad (`measure.mjs`): scroll the whole page in steps of 35 % of the viewport every 260 ms while recording every `requestAnimationFrame` interval, then wait for all prints and read `Performance.getMetrics` twice, 5 s apart.

| | 1440 x 900, dpr 1 | 390 x 844, dpr 2 (mobile) |
|---|---|---|
| frames while scrolling the whole page | 60 fps, median 16.7 ms, p95 16.7 ms, 0 frames over 33 ms | 60 fps, median 16.7 ms, p95 16.7 ms, 0 frames over 33 ms |
| main thread busy while scrolling | 678 ms in 17.5 s (3.9 %) | 958 ms in 23.7 s (4.0 %) |
| at rest, 5 s after the last print | TaskDuration 0 ms, ScriptDuration 0 ms, 0 layouts, 0 style recalcs: **0 % CPU** | same: **0 % CPU** |
| print time per scene in the worker | 150 to 447 ms (12 scenes, 2.6 s in total, off the main thread) | 99 to 394 ms |
| print size kept per scene | WebP 289 to 565 kB (4.8 MB for 12) | 161 to 483 kB (3.4 MB) |
| JS heap | 0.8 MB | 0.8 MB |
| errors in the console | 0 | 0 |

Also checked: without OffscreenCanvas (fallback on the main thread in 6 ms slices) all 12 print, 175 to 521 ms each; with `prefers-reduced-motion: reduce` all 12 appear without animation. Print resolution: CSS width x devicePixelRatio (at most 2), capped at 1.4 megapixels; halftone cell about 4 CSS px. Weak devices (4 cores or less, or 2 GB memory or less) get a shorter drum pass.

For comparison, the existing edition page `/classics/monte-cristo/` in the same harness: 60 fps, 0 % at rest.

JS sent: `drawn.js` + `ink.js` 7.7 kB gzipped on the main thread; the worker loads `press-worker.js`, `ink.js`, `parts.js`, `sea.js`, `arch.js` and the scenes, 28 kB gzipped together, after the page is up.

## Open

* Part 3: nothing links to the new parts yet except the page's own table of contents; links from `/classics/monte-cristo/`, sitemap, llms.txt and og:image are Fable's. `drawn.js` and `drawn.css` are at `?v=2`.

* og:image (a 1200x630 print of one scene) and links from `/classics/monte-cristo/`, `/classics/`, sitemap, llms.txt: Fable.
* Screenshots checked (6, the limit for this run): contact sheet of all 12 scenes; 1440 masthead, plates, timeline; 390 masthead and a plate with its caption. The 1440 shots showed two bugs (the masthead was a `<header>` and became fixed, the site's `body.noc h1` turned the title white); both are fixed, and the fix was checked at 1440 by computed styles (title blue, masthead static, no horizontal overflow) and at 390 on a screenshot. A fresh 1440 screenshot of the masthead is still worth taking before release.
* Scene fixes after the contact sheet (Fernand's cap, the lantern glow no longer erasing the grave-diggers, Faria's beard and nose, the treasure scene with Edmond kneeling, a bigger boat to If, the swimmer, Mercédès's kerchief) all pass the Node smoke test; on a screenshot only the grave-diggers under the lantern (1440) and Fernand's cap (390) were seen after the fix. The others still need one look.
