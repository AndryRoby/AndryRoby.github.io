/* Field Notes: témy, slová a fakty (M0, 26. 9. 2026).
 *
 * Každá veta faktu je preformulovaný citát zo stránky v `zdroj`, ktorú som
 * 26. 9. 2026 načítal. Citáty a poznámky sú v ops/hry/field-notes/ZDROJE.md;
 * test ops/hry/field-notes/tests.mjs drží, že každé slovo má fakt, zdroj
 * a kresbu a že text nemá pomlčky (em dash, en dash).
 *
 * slovo  to, čo sa hľadá v mriežke (len A až Z)
 * meno   ako sa exemplár volá na strane a na plagáte
 * kresba kľúč do kresby.mjs
 */

const W = 'https://en.wikipedia.org/wiki/';

export const TEMY = [
  {
    id: 'solar',
    nazov: 'The Solar System',
    podtitul: 'The Sun, its planets and our Moon',
    slova: [
      { slovo: 'SUN', meno: 'The Sun', kresba: 'sun', fakt: 'The Sun holds about 99.86% of all the mass in the Solar System.', zdroj: W + 'Sun' },
      { slovo: 'MERCURY', meno: 'Mercury', kresba: 'mercury', fakt: 'Mercury is the smallest planet and the closest to the Sun; one lap takes about 88 Earth days.', zdroj: W + 'Mercury_(planet)' },
      { slovo: 'VENUS', meno: 'Venus', kresba: 'venus', fakt: 'Venus is the hottest planet, and it spins the opposite way to most planets, Earth included.', zdroj: W + 'Venus' },
      { slovo: 'EARTH', meno: 'Earth', kresba: 'earth', fakt: 'Earth is the only world known to harbour life, and its ocean covers about 71% of the crust.', zdroj: W + 'Earth' },
      { slovo: 'MOON', meno: 'The Moon', kresba: 'moon', fakt: 'The Moon always turns the same side to Earth, from an average distance of about 384,400 km.', zdroj: W + 'Moon' },
      { slovo: 'MARS', meno: 'Mars', kresba: 'mars', fakt: 'Mars looks red because its surface is rich in iron oxide.', zdroj: W + 'Mars' },
      { slovo: 'JUPITER', meno: 'Jupiter', kresba: 'jupiter', fakt: 'Jupiter has nearly 2.5 times the mass of all the other planets put together.', zdroj: W + 'Jupiter' },
      { slovo: 'SATURN', meno: 'Saturn', kresba: 'saturn', fakt: 'Saturn is the only planet less dense than water, and its rings are mostly water ice.', zdroj: W + 'Saturn' },
      { slovo: 'URANUS', meno: 'Uranus', kresba: 'uranus', fakt: 'Uranus was the first planet found with the help of a telescope, by William Herschel in 1781.', zdroj: W + 'Uranus' },
      { slovo: 'NEPTUNE', meno: 'Neptune', kresba: 'neptune', fakt: 'Neptune has the strongest winds of any planet, up to about 2,100 km/h.', zdroj: W + 'Neptune' },
    ],
  },
  {
    id: 'trees',
    nazov: 'Trees of the Forest',
    podtitul: 'Leaves, seeds and fruit of ten trees',
    slova: [
      { slovo: 'OAK', meno: 'Oak', kresba: 'oak', fakt: "An oak's fruit is a nut called an acorn, which sits in a little cup.", zdroj: W + 'Oak' },
      { slovo: 'BIRCH', meno: 'Birch', kresba: 'birch', fakt: 'Birch bark often peels in thin papery plates; it was used for canoes and for ancient books in India.', zdroj: W + 'Birch' },
      { slovo: 'BEECH', meno: 'Beech', kresba: 'beech', fakt: 'Young beeches and clipped beech hedges often keep their dead leaves all winter, until spring.', zdroj: W + 'Fagus_sylvatica' },
      { slovo: 'PINE', meno: 'Pine', kresba: 'pine', fakt: 'A pine in California known as Methuselah is around 4,800 years old.', zdroj: W + 'Pine' },
      { slovo: 'WILLOW', meno: 'Willow', kresba: 'willow', fakt: 'Almost all willows take root readily, even from broken branches lying on the ground.', zdroj: W + 'Willow' },
      { slovo: 'MAPLE', meno: 'Maple', kresba: 'maple', fakt: 'Maple seeds come in winged pairs, shaped to spin as they fall and ride the wind.', zdroj: W + 'Maple' },
      { slovo: 'CHESTNUT', meno: 'Sweet chestnut', kresba: 'chestnut', fakt: 'Sweet chestnuts grow three to seven at a time inside a spiny case.', zdroj: W + 'Castanea_sativa' },
      { slovo: 'ASH', meno: 'Ash', kresba: 'ash', fakt: 'Ash wood is tough and hard to split, the classic wood for tool handles and hurling sticks.', zdroj: W + 'Fraxinus_excelsior' },
      { slovo: 'YEW', meno: 'Yew', kresba: 'yew', fakt: 'Every part of the yew is poisonous except the red flesh around the seed.', zdroj: W + 'Taxus_baccata' },
      { slovo: 'HOLLY', meno: 'Holly', kresba: 'holly', fakt: 'Only female holly trees bear berries, and they need a male tree nearby.', zdroj: W + 'Ilex_aquifolium' },
    ],
  },
  {
    id: 'birds',
    nazov: 'Birds of Europe',
    podtitul: 'Ten birds from gardens, rivers and coasts',
    slova: [
      { slovo: 'ROBIN', meno: 'Robin', kresba: 'robin', fakt: 'Both male and female robins sing all year round, even in winter.', zdroj: W + 'European_robin' },
      { slovo: 'WREN', meno: 'Wren', kresba: 'wren', fakt: 'Weight for weight, the tiny wren sings ten times louder than a cockerel.', zdroj: W + 'Eurasian_wren' },
      { slovo: 'MAGPIE', meno: 'Magpie', kresba: 'magpie', fakt: 'Magpies can recognise themselves in a mirror, something only a few species are known to do.', zdroj: W + 'Eurasian_magpie' },
      { slovo: 'HERON', meno: 'Grey heron', kresba: 'heron', fakt: 'A grey heron can stand motionless in the shallows, waiting for a fish to come within reach.', zdroj: W + 'Grey_heron' },
      { slovo: 'SWALLOW', meno: 'Barn swallow', kresba: 'swallow', fakt: 'Barn swallows build their cup nests from pellets of mud carried in their beaks.', zdroj: W + 'Barn_swallow' },
      { slovo: 'KINGFISHER', meno: 'Kingfisher', kresba: 'kingfisher', fakt: 'A kingfisher dives with its eyes open, shielded by a clear third eyelid.', zdroj: W + 'Common_kingfisher' },
      { slovo: 'OWL', meno: 'Barn owl', kresba: 'owl', fakt: 'A barn owl hears so precisely that it does not need sight to hunt.', zdroj: W + 'Western_barn_owl' },
      { slovo: 'STORK', meno: 'White stork', kresba: 'stork', fakt: "An adult white stork's main sound is the clatter of its bill; its voice is only a faint hiss.", zdroj: W + 'White_stork' },
      { slovo: 'PUFFIN', meno: 'Puffin', kresba: 'puffin', fakt: 'A puffin can catch several small fish in one dive, holding the first ones with its tongue.', zdroj: W + 'Atlantic_puffin' },
      { slovo: 'GOLDFINCH', meno: 'Goldfinch', kresba: 'goldfinch', fakt: 'Goldfinches use their tweezer-like bills to pull seeds out of thistles and teasels.', zdroj: W + 'European_goldfinch' },
    ],
  },
  /* M1 (26. 9. 2026): šesť ďalších tém. Poradie v zozname je poradie striedania; nové témy sú
     na konci, aby dnešná strana (26. 9.) a nekonečné strany 1 a 2 ostali rovnaké. */
  {
    id: 'instruments',
    nazov: 'Musical Instruments',
    podtitul: 'Strings, keys, brass, reeds and drums',
    slova: [
      { slovo: 'VIOLIN', meno: 'Violin', kresba: 'violin', fakt: 'Violin bow hair traditionally comes from the tail of a grey male horse.', zdroj: W + 'Violin' },
      { slovo: 'GUITAR', meno: 'Guitar', kresba: 'guitar', fakt: 'A guitar typically has six or twelve strings; the English word comes from the Spanish guitarra.', zdroj: W + 'Guitar' },
      { slovo: 'HARP', meno: 'Harp', kresba: 'harp', fakt: 'Harps date back at least to 3000 BCE, and the harp has been a symbol of Ireland for centuries.', zdroj: W + 'Harp' },
      { slovo: 'PIANO', meno: 'Piano', kresba: 'piano', fakt: 'A modern piano has 88 keys; pressing one makes a felt-coated hammer strike the strings.', zdroj: W + 'Piano' },
      { slovo: 'TRUMPET', meno: 'Trumpet', kresba: 'trumpet', fakt: "Some of the earliest trumpets are the bronze and silver ones found in Tutankhamun's grave in Egypt.", zdroj: W + 'Trumpet' },
      { slovo: 'FLUTE', meno: 'Flute', kresba: 'flute', fakt: 'A flute made from a vulture wing bone, found in a cave in Germany, is at least 35,000 years old.', zdroj: W + 'Flute' },
      { slovo: 'DRUM', meno: 'Drum', kresba: 'drum', fakt: 'Drums made with alligator skins, from between 5500 and 2350 BC, have been found in China.', zdroj: W + 'Drum' },
      { slovo: 'ACCORDION', meno: 'Accordion', kresba: 'accordion', fakt: 'Squeezing or pulling the bellows sends air across strips of brass or steel called reeds.', zdroj: W + 'Accordion' },
      { slovo: 'XYLOPHONE', meno: 'Xylophone', kresba: 'xylophone', fakt: 'Xylophone comes from the Greek words for wood and sound; its wooden bars are struck with mallets.', zdroj: W + 'Xylophone' },
      { slovo: 'SAXOPHONE', meno: 'Saxophone', kresba: 'saxophone', fakt: 'Adolphe Sax patented the saxophone in 1846; it is usually made of brass but uses a reed.', zdroj: W + 'Saxophone' },
    ],
  },
  {
    id: 'ocean',
    nazov: 'Ocean Life',
    podtitul: 'Ten animals of the sea, large and small',
    slova: [
      { slovo: 'WHALE', meno: 'Blue whale', kresba: 'whale', fakt: 'The blue whale is the largest animal known to have ever existed, up to about 30 m long.', zdroj: W + 'Blue_whale' },
      { slovo: 'DOLPHIN', meno: 'Bottlenose dolphin', kresba: 'dolphin', fakt: "Bottlenose dolphins address one another by copying each other's signature whistle.", zdroj: W + 'Common_bottlenose_dolphin' },
      { slovo: 'SHARK', meno: 'Shark', kresba: 'shark', fakt: "A shark's skeleton is made of cartilage, and its teeth are constantly replaced throughout life.", zdroj: W + 'Shark' },
      { slovo: 'OCTOPUS', meno: 'Octopus', kresba: 'octopus', fakt: 'An octopus has three hearts and bluish blood, and two thirds of its neurons are in its arms.', zdroj: W + 'Octopus' },
      { slovo: 'TURTLE', meno: 'Sea turtle', kresba: 'turtle', fakt: 'Sea turtles cannot pull their heads into their shells; females nest on the beach where they hatched.', zdroj: W + 'Sea_turtle' },
      { slovo: 'JELLYFISH', meno: 'Jellyfish', kresba: 'jellyfish', fakt: 'Most jellyfish have no central nervous system; the group has existed for at least 500 million years.', zdroj: W + 'Jellyfish' },
      { slovo: 'STARFISH', meno: 'Starfish', kresba: 'starfish', fakt: 'Most starfish have five arms, and some species can regrow an arm they have lost.', zdroj: W + 'Starfish' },
      { slovo: 'SEAHORSE', meno: 'Seahorse', kresba: 'seahorse', fakt: "A female seahorse lays up to 1,500 eggs in the male's pouch, and he gives birth to the young.", zdroj: W + 'Seahorse' },
      { slovo: 'CRAB', meno: 'Crab', kresba: 'crab', fakt: 'Many crabs can run swiftly sideways, though others walk forwards.', zdroj: W + 'Crab' },
      { slovo: 'WALRUS', meno: 'Walrus', kresba: 'walrus', fakt: 'A walrus uses its tusks to keep holes open in the ice and to climb out of the water onto it.', zdroj: W + 'Walrus' },
    ],
  },
  {
    id: 'inventions',
    nazov: 'Great Inventions',
    podtitul: 'Ten inventions that changed everyday life',
    slova: [
      { slovo: 'WHEEL', meno: 'Wheel', kresba: 'wheel', fakt: 'A wooden wheel and axle found in the Ljubljana Marshes in Slovenia is over 5,000 years old.', zdroj: W + 'Wheel' },
      { slovo: 'TELESCOPE', meno: 'Telescope', kresba: 'telescope', fakt: 'The oldest record of a telescope is a patent Hans Lipperhey submitted in the Netherlands in 1608.', zdroj: W + 'Telescope' },
      { slovo: 'TELEPHONE', meno: 'Telephone', kresba: 'telephone', fakt: 'In 1876, Alexander Graham Bell got the first US patent for a device that clearly reproduced a human voice.', zdroj: W + 'Telephone' },
      { slovo: 'MICROSCOPE', meno: 'Microscope', kresba: 'microscope', fakt: 'Compound microscopes appeared around 1620; in 1676 van Leeuwenhoek reported micro-organisms.', zdroj: W + 'Microscope' },
      { slovo: 'CAMERA', meno: 'Camera', kresba: 'camera', fakt: 'In the early days of photography, a single exposure often lasted several minutes.', zdroj: W + 'Camera' },
      { slovo: 'BICYCLE', meno: 'Bicycle', kresba: 'bicycle', fakt: 'The Rover, made in Coventry in 1885, is usually described as the first recognizably modern bicycle.', zdroj: W + 'Bicycle' },
      { slovo: 'LIGHTBULB', meno: 'Light bulb', kresba: 'lightbulb', fakt: 'A light bulb glows because its filament is heated; less than 5% of the energy becomes visible light.', zdroj: W + 'Incandescent_light_bulb' },
      { slovo: 'GRAMOPHONE', meno: 'Gramophone', kresba: 'gramophone', fakt: 'Emile Berliner coined the name gramophone for players of flat discs with a spiral groove.', zdroj: W + 'Phonograph' },
      { slovo: 'BALLOON', meno: 'Hot air balloon', kresba: 'balloon', fakt: 'The first untethered manned hot air balloon flight took place in Paris on 21 November 1783.', zdroj: W + 'Hot_air_balloon' },
      { slovo: 'CLOCK', meno: 'Pendulum clock', kresba: 'clock', fakt: 'Christiaan Huygens invented the pendulum clock in 1656, making clocks accurate to 15 seconds a day.', zdroj: W + 'Pendulum_clock' },
    ],
  },
  {
    id: 'mountains',
    nazov: 'Mountains of the World',
    podtitul: 'Peaks, volcanoes and one great rock',
    slova: [
      { slovo: 'EVEREST', meno: 'Mount Everest', kresba: 'everest', fakt: 'Tenzing Norgay and Edmund Hillary made the first documented climb of Everest, in 1953.', zdroj: W + 'Mount_Everest' },
      { slovo: 'MATTERHORN', meno: 'Matterhorn', kresba: 'matterhorn', fakt: 'The Matterhorn has four faces, each turned roughly north, south, east or west.', zdroj: W + 'Matterhorn' },
      { slovo: 'FUJI', meno: 'Mount Fuji', kresba: 'fuji', fakt: 'Mount Fuji, the highest mountain in Japan, is an active volcano that last erupted in 1707 and 1708.', zdroj: W + 'Mount_Fuji' },
      { slovo: 'ETNA', meno: 'Mount Etna', kresba: 'etna', fakt: "Mount Etna in Sicily is one of the world's most active volcanoes, in an almost constant state of activity.", zdroj: W + 'Mount_Etna' },
      { slovo: 'ELBRUS', meno: 'Mount Elbrus', kresba: 'elbrus', fakt: 'Elbrus, the highest mountain in Russia and Europe, is a dormant volcano with two summits.', zdroj: W + 'Mount_Elbrus' },
      { slovo: 'DENALI', meno: 'Denali', kresba: 'denali', fakt: 'Denali, the highest peak in North America, takes its name from a Koyukon word for high or tall.', zdroj: W + 'Denali' },
      { slovo: 'ACONCAGUA', meno: 'Aconcagua', kresba: 'aconcagua', fakt: 'Aconcagua, in the Andes of Argentina, is the highest mountain outside Asia, about 6,967 m high.', zdroj: W + 'Aconcagua' },
      { slovo: 'OLYMPUS', meno: 'Mount Olympus', kresba: 'olympus', fakt: 'Mount Olympus is the highest mountain in Greece and, in Greek myth, the home of the gods.', zdroj: W + 'Mount_Olympus' },
      { slovo: 'ULURU', meno: 'Uluru', kresba: 'uluru', fakt: 'Uluru, a sandstone rock in central Australia, seems to change colour and glows red at dawn and sunset.', zdroj: W + 'Uluru' },
      { slovo: 'VESUVIUS', meno: 'Mount Vesuvius', kresba: 'vesuvius', fakt: 'The eruption of Vesuvius in 79 AD destroyed the Roman cities of Pompeii and Herculaneum.', zdroj: W + 'Mount_Vesuvius' },
    ],
  },
  {
    id: 'vegetables',
    nazov: 'Garden Vegetables',
    podtitul: 'Roots, leaves, pods and fruit from the garden',
    slova: [
      { slovo: 'CARROT', meno: 'Carrot', kresba: 'carrot', fakt: 'In the 10th century carrots were purple; the orange carrot was created later by Dutch growers.', zdroj: W + 'Carrot' },
      { slovo: 'POTATO', meno: 'Potato', kresba: 'potato', fakt: 'Potatoes were domesticated 7,000 to 10,000 years ago; today there are over 5,000 varieties.', zdroj: W + 'Potato' },
      { slovo: 'TOMATO', meno: 'Tomato', kresba: 'tomato', fakt: 'The fruit of the tomato plant is an edible berry, yet it is eaten as a vegetable.', zdroj: W + 'Tomato' },
      { slovo: 'ONION', meno: 'Onion', kresba: 'onion', fakt: 'A freshly cut onion releases a volatile liquid that stings the eyes and brings tears.', zdroj: W + 'Onion' },
      { slovo: 'PEA', meno: 'Pea', kresba: 'pea', fakt: "Gregor Mendel's observations of pea pods led to the principles of Mendelian genetics.", zdroj: W + 'Pea' },
      { slovo: 'CABBAGE', meno: 'Cabbage', kresba: 'cabbage', fakt: 'Cabbage is closely related to broccoli and cauliflower; the heaviest one weighed 62.71 kg.', zdroj: W + 'Cabbage' },
      { slovo: 'PUMPKIN', meno: 'Pumpkin', kresba: 'pumpkin', fakt: 'The heaviest pumpkin on record, set in October 2023, weighed 1,246.9 kg.', zdroj: W + 'Pumpkin' },
      { slovo: 'BEETROOT', meno: 'Beetroot', kresba: 'beetroot', fakt: 'Betanin, the red colour of beetroot, is used to colour tomato paste, sauces, desserts and jams.', zdroj: W + 'Beetroot' },
      { slovo: 'BROCCOLI', meno: 'Broccoli', kresba: 'broccoli', fakt: 'The name broccoli comes from Italian for the flowering crest of a cabbage; we eat its flower head.', zdroj: W + 'Broccoli' },
      { slovo: 'AUBERGINE', meno: 'Aubergine', kresba: 'aubergine', fakt: "The word eggplant was first used for white aubergines, which look very much like hen's eggs.", zdroj: W + 'Eggplant' },
    ],
  },
  {
    id: 'minerals',
    nazov: 'Minerals and Gems',
    podtitul: 'Crystals and gemstones from the Earth',
    slova: [
      { slovo: 'QUARTZ', meno: 'Quartz', kresba: 'quartz', fakt: 'An ideal quartz crystal is a six-sided prism with a pyramid-like point at each end.', zdroj: W + 'Quartz' },
      { slovo: 'DIAMOND', meno: 'Diamond', kresba: 'diamond', fakt: 'Diamond is a form of carbon, like graphite; most natural diamonds are 1 to 3.5 billion years old.', zdroj: W + 'Diamond' },
      { slovo: 'RUBY', meno: 'Ruby', kresba: 'ruby', fakt: 'A ruby is red corundum, coloured by chromium; its name comes from ruber, Latin for red.', zdroj: W + 'Ruby' },
      { slovo: 'EMERALD', meno: 'Emerald', kresba: 'emerald', fakt: 'Emerald is green beryl; the mossy flaws inside it are called jardin, French for garden.', zdroj: W + 'Emerald' },
      { slovo: 'SAPPHIRE', meno: 'Sapphire', kresba: 'sapphire', fakt: 'Blue is the best-known colour, but sapphires also occur in yellow, green, purple, pink and more.', zdroj: W + 'Sapphire' },
      { slovo: 'AMETHYST', meno: 'Amethyst', kresba: 'amethyst', fakt: 'Amethyst is a violet variety of quartz; its Greek name means not intoxicated.', zdroj: W + 'Amethyst' },
      { slovo: 'PYRITE', meno: 'Pyrite', kresba: 'pyrite', fakt: "Pyrite is known as fool's gold; its Greek name means a stone which strikes fire.", zdroj: W + 'Pyrite' },
      { slovo: 'MALACHITE', meno: 'Malachite', kresba: 'malachite', fakt: 'Malachite, a green copper mineral, was used as a pigment in green paints from antiquity until about 1800.', zdroj: W + 'Malachite' },
      { slovo: 'TURQUOISE', meno: 'Turquoise', kresba: 'turquoise', fakt: 'The word turquoise comes from the Old French for Turkish; ancient Egyptians mined it in Sinai.', zdroj: W + 'Turquoise' },
      { slovo: 'OPAL', meno: 'Opal', kresba: 'opal', fakt: 'Opal holds water, 3% to 21% of its weight, and most precious opal comes from Australia.', zdroj: W + 'Opal' },
    ],
  },
];

export const TEMA = Object.fromEntries(TEMY.map((t) => [t.id, t]));
