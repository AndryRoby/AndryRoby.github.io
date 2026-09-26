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
];

export const TEMA = Object.fromEntries(TEMY.map((t) => [t.id, t]));
