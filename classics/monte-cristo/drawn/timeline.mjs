// Build tool, not loaded by the page. Regenerates the 117 chapter timeline
// (chapter length chart + list) inside index.html between <!--TL...--> and <!--/TL-->.
// Scene links come from the plates: every <figure ... data-scene="id" data-chapter="n">.
// Titles from the contents of Gutenberg #1184; sentences written in our own words.
// Usage (from this folder): node timeline.mjs
import { readFileSync, writeFileSync } from 'node:fs';
const PAGE = new URL('./index.html', import.meta.url);
const html = readFileSync(PAGE, 'utf8');
const starts = [176,630,1007,1469,1794,2493,3001,3452,3892,4142,4549,4950,5285,5614,6064,6713,7214,8253,8808,9256,9490,9934,10227,10562,10926,11272,11983,12643,12991,13555,14252,15319,15579,16936,18260,18899,19697,20565,20948,21305,22424,23007,23249,23582,24587,25175,25833,26455,26952,27188,27617,28127,28888,29764,30318,30959,31607,32144,32579,33033,33532,34047,34466,34943,35379,35830,36338,36843,37242,37725,38213,38432,39014,40258,40666,41157,41663,42674,43723,44354,44610,45581,46264,46550,46860,47373,47896,48196,48652,49004,49581,49845,50258,50597,51158,51556,52086,52402,52933,53383,53686,53948,54206,54612,55175,55777,56461,56824,57285,57590,57927,58319,58943,59519,59994,60312,60577];
const END = 61232;
const C = [
['Marseilles, The Arrival','The Pharaon sails into Marseilles with young Edmond Dantès in command after her captain died at sea, and the owner Morrel promises him the captaincy.','m'],
['Father and Son','Edmond hurries home to his old father, who has gone short of food after paying a debt to the neighbour, Caderousse.','m'],
['The Catalans','In the fishing village of the Catalans, Mercédès tells her cousin Fernand that she loves Edmond, and Edmond walks in on them.','m'],
['Conspiracy','Under the arbour of La Réserve, Danglars writes an anonymous denunciation with his left hand while Fernand watches and Caderousse drinks.','m'],
['The Marriage Feast','Edmond’s betrothal feast is cut short when a commissary comes in and arrests him.','m'],
['The Deputy Procureur du Roi','At his own betrothal party, the royalist deputy prosecutor Villefort is called away to examine the arrested sailor.','m'],
['The Examination','Villefort sees that the letter Edmond carried is addressed to his own father, Noirtier, burns it, and keeps the young man locked up to protect himself.','m'],
['The Château d’If','Edmond is rowed out at night to the fortress on its rock and shut in a cell without a trial.','i'],
['The Evening of the Betrothal','Villefort leaves for Paris, while Mercédès and old Dantès wait for news that does not come.','m'],
['The King’s Closet at the Tuileries','Villefort warns Louis XVIII that Napoleon is about to leave Elba.','p'],
['The Corsican Ogre','News comes that Napoleon has landed in France, and Villefort’s warning wins him the king’s favour.','p'],
['Father and Son','Noirtier, a Bonapartist, visits his royalist son in Paris, and each protects the other.','p'],
['The Hundred Days','Morrel pleads for Edmond while Napoleon is back, Villefort turns the plea against him, and old Dantès dies alone.','m'],
['The Two Prisoners','An inspector visits the Château d’If and hears both Edmond and the “mad” Abbé Faria, who offers millions for his freedom.','i'],
['Number 34 and Number 27','Close to despair, Edmond hears scraping in the wall, and the abbé tunnels up into his cell.','i'],
['A Learned Italian','Faria explains his escape plans and begins to teach Edmond.','i'],
['The Abbé’s Chamber','Faria shows his book written on linen, his pens, lamp and tools made from almost nothing, and works out who betrayed Edmond.','i'],
['The Treasure','Faria tells Edmond the secret of Cardinal Spada’s treasure, hidden on the island of Monte Cristo.','i'],
['The Third Attack','A last seizure takes the abbé, who leaves Edmond his secret.','i'],
['The Cemetery of the Château d’If','Edmond takes the abbé’s place in the burial sack and is thrown into the sea.','i'],
['The Island of Tiboulen','He frees himself, swims through the storm to the rock of Tiboulen and is taken aboard a smugglers’ tartan.','s'],
['The Smugglers','Calling himself a Maltese sailor, Edmond joins the crew of La Jeune Amélie and learns he has been a prisoner for fourteen years.','s'],
['The Island of Monte Cristo','He pretends to be hurt so that the smugglers leave him alone on Monte Cristo.','s'],
['The Secret Cave','Following Spada’s clues, he opens the cave and finds the coffer of gold and jewels.','s'],
['The Unknown','Now rich, Edmond sells stones, buys a yacht and learns that his father is dead and Mercédès gone.','m'],
['The Pont du Gard Inn','Dressed as an abbé, he visits Caderousse, now a poor innkeeper, with a diamond to give away.','m'],
['The Story','Caderousse tells the whole story of the betrayal and what became of everyone in it.','m'],
['The Prison Register','As an Englishman from Thomson & French, he buys up Morrel’s debts and reads the prison records of Edmond and Faria.','m'],
['The House of Morrel & Son','The firm is close to ruin, and the Englishman gives Morrel three more months.','m'],
['The Fifth of September','On the last day, a stranger’s red silk purse pays the debt, and a new Pharaon sails into the harbour.','m'],
['Italy: Sinbad the Sailor','Years later, Franz d’Épinay lands on Monte Cristo and dines in a hidden palace with a host who calls himself Sinbad.','s'],
['The Waking','Franz wakes on the shore, and his host has sailed away.','s'],
['Roman Bandits','In Rome, the innkeeper Pastrini tells Franz and Albert de Morcerf the story of the bandit Luigi Vampa.','r'],
['The Colosseum','In the Colosseum by moonlight, Franz overhears a cloaked stranger arrange to save a condemned man.','r'],
['La Mazzolata','The Count of Monte Cristo gives the young men a window on the Piazza del Popolo, where the bandit Peppino is pardoned at the last moment.','r'],
['The Carnival at Rome','The carnival fills the Corso with confetti and flowers and ends in the battle of the little candles, the moccoletti.','r'],
['The Catacombs of Saint Sebastian','Albert is taken by Vampa’s men, and the count frees him from the catacombs with a word.','r'],
['The Rendezvous','Albert invites the count to Paris, and they set a day three months ahead.','r'],
['The Guests','In his pavilion in Paris, Albert gathers his friends to wait for the count.','p'],
['The Breakfast','The count arrives to the minute, and Albert introduces him to Maximilian Morrel and the others.','p'],
['The Presentation','Albert presents the count to his parents, and the Countess de Morcerf, once Mercédès, turns pale.','p'],
['Monsieur Bertuccio','The count tells his steward Bertuccio about the house he has bought at Auteuil, and Bertuccio is afraid.','a'],
['The House at Auteuil','At the house, the steward recognises the garden and cannot go on.','a'],
['The Vendetta','Bertuccio tells how he followed Villefort for revenge and what he found buried in the Auteuil garden one night.','a'],
['The Rain of Blood','He tells how a jeweller who came for the diamond was killed at Caderousse’s inn, and how Caderousse went to the galleys.','a'],
['Unlimited Credit','The count asks the banker, Baron Danglars, for unlimited credit and gets it.','p'],
['The Dappled Grays','Madame Danglars’s horses bolt with Madame de Villefort and her son, and the count’s servant Ali stops them with a lasso.','a'],
['Ideology','Villefort calls on the count, and they argue about justice, pride and Providence.','p'],
['Haydée','The count visits Haydée, the young Greek woman in his care, and they speak in her language.','p'],
['The Morrel Family','The count visits Julie, Emmanuel and Maximilian, who keep the red silk purse under glass and still do not know who saved them.','p'],
['Pyramus and Thisbe','Maximilian and Valentine de Villefort meet in secret, talking through the gate of her garden.','p'],
['Toxicology','Madame de Villefort draws the count into a long talk about poisons and their remedies.','p'],
['Robert le Diable','At the Opera, all Paris turns its glasses on the count and the Greek woman in his box.','p'],
['A Flurry in Stocks','Albert admits he does not want to marry Eugénie Danglars, and the talk turns to her father’s losses on the exchange.','p'],
['Major Cavalcanti','An Italian who calls himself Major Cavalcanti arrives and is taught the part of a rich father.','p'],
['Andrea Cavalcanti','The major meets the young man he is to call his son, Andrea.','p'],
['In the Lucern Patch','In the field by the Villefort garden, Maximilian waits at the gate, and Valentine tells him about Eugénie and her own engagement to Franz.','p'],
['M. Noirtier de Villefort','Old Noirtier cannot move or speak, but he talks with his eyes, and Valentine understands him.','p'],
['The Will','Noirtier makes a new will before notaries to stop Valentine’s marriage to Franz.','p'],
['The Telegraph','The count calls on the Villeforts, hears about the will and speaks of his wish to see a telegraph.','p'],
['How a Gardener May Get Rid of the Dormice that Eat His Peaches','The count pays the telegraph man at Montlhéry to send a false message, and Danglars loses a fortune on it.','p'],
['Ghosts','As the guests arrive for dinner at Auteuil, Bertuccio recognises faces from that night in the garden.','a'],
['The Dinner','At Auteuil, the count shows his guests the room and the garden where a secret was once buried, and watches Villefort and Madame Danglars.','a'],
['The Beggar','On the way home, Andrea is stopped by a beggar who knows him from the galleys: Caderousse.','p'],
['A Conjugal Scene','Danglars quarrels with his wife over the money her speculations have lost.','p'],
['Matrimonial Projects','Danglars asks the count about the Cavalcanti fortune, and the count suggests he write to Janina about Morcerf.','p'],
['The Office of the King’s Attorney','Madame Danglars visits Villefort in secret, and they fear what the count knows about the Auteuil garden.','p'],
['A Summer Ball','Albert brings the count an invitation to his mother’s ball.','p'],
['The Inquiry','Villefort, in disguise, asks the Abbé Busoni and Lord Wilmore who the count is, not knowing both are the count.','p'],
['The Ball','On a hot night at the Morcerf ball, Mercédès notices that the count takes nothing in her house.','p'],
['Bread and Salt','In the hothouse she offers him fruit, and he will not take it.','p'],
['Madame de Saint-Méran','Valentine’s grandmother arrives with the news that her husband has died on the road, and falls ill herself.','p'],
['The Promise','Valentine promises to leave with Maximilian, then cannot, and old Noirtier takes the lovers’ side.','p'],
['The Villefort Family Vault','After the funeral at Père-Lachaise, Valentine’s marriage contract is to be signed.','p'],
['A Signed Statement','Noirtier has Franz read an old statement: Franz’s father died in a duel with Noirtier, and the marriage is broken off.','p'],
['Progress of Cavalcanti the Younger','Andrea charms the Danglars house and sets his heart on Eugénie’s fortune.','p'],
['Haydée','Haydée tells Albert how her father, Ali Pasha of Janina, was betrayed by a French officer.','j'],
['We Hear From Yanina','A newspaper says a Frenchman named Fernand betrayed Ali Pasha, and Albert demands that Beauchamp’s paper take it back.','j'],
['The Lemonade','Noirtier’s old servant Barrois drinks from the carafe meant for his master, and the doctor suspects poison.','p'],
['The Accusation','Doctor d’Avrigny tells Villefort that someone in his house is using poison.','p'],
['The Room of the Retired Baker','Andrea secures the marriage and a loan from Danglars, while Caderousse, living as a retired baker, squeezes him for money.','p'],
['The Burglary','Caderousse breaks into the count’s house at Auteuil, where the count, dressed as Busoni, is waiting for him.','a'],
['The Hand of God','Struck down by Andrea as he leaves, Caderousse learns who the count is before he dies.','a'],
['Beauchamp','Beauchamp returns from Janina with proof that the story is true, and burns it for Albert’s sake.','j'],
['The Journey','The count takes Albert to the Normandy coast behind thirty-two horses in relays.','p'],
['The Trial','The story appears in another paper, and before the Chamber of Peers, Haydée gives her evidence against Morcerf.','j'],
['The Challenge','Albert learns the count is behind the story and resolves to challenge him.','p'],
['The Insult','At the Opera, Albert insults the count in public, and a duel is set for the morning.','p'],
['The Night','Mercédès comes to the count at night, calls him Edmond and begs for her son’s life.','p'],
['The Meeting','At the duelling ground Albert apologises in front of everyone, because his mother has told him the truth.','p'],
['Mother and Son','Albert and Mercédès give up the name, the house and the money of Morcerf.','p'],
['The Suicide','The count shows Fernand who he really is, and Fernand, seeing his wife and son leave, takes his own life.','p'],
['Valentine','Valentine falls ill in her grandfather’s room, and Maximilian fears for her.','p'],
['Maximilian’s Avowal','Maximilian tells the count he loves Valentine, and the count promises to save her.','p'],
['Father and Daughter','Danglars tells Eugénie the marriage must go ahead to save his credit, and she agrees on her own terms.','p'],
['The Contract','At the signing of the marriage contract, the police come for Andrea, the escaped convict Benedetto.','p'],
['The Departure for Belgium','Eugénie cuts her hair, dresses as a young man and leaves Paris with her friend Louise d’Armilly.','p'],
['The Bell and Bottle Tavern','Andrea flees north and is caught at an inn in Compiègne.','p'],
['The Law','Madame Danglars asks Villefort for help, and he is left alone with his suspicion.','p'],
['The Apparition','At night Valentine sees a figure beside her bed change the glass of her drink: the count, watching over her.','p'],
['Locusta','The count tells Valentine who is poisoning her and gives her a pill that will make her seem dead.','p'],
['Valentine','In the morning Valentine is found without life, and the house goes into mourning.','p'],
['Maximilian','Maximilian bursts into the house of mourning, and the count learns that Valentine was the woman he loved.','p'],
['Danglars’ Signature','Danglars pays the count five million francs, money that belonged to the hospitals, and gets ready to run.','p'],
['The Cemetery of Père-Lachaise','At Valentine’s funeral, the count stops Maximilian from despair and tells him who he is.','p'],
['Dividing the Proceeds','Danglars has fled; his wife and Debray divide their gains, and Mercédès and Albert leave with nothing.','p'],
['The Lions’ Den','In La Force prison, Andrea learns that he has a powerful protector.','p'],
['The Judge','Villefort, preparing the case against Benedetto, understands who the poisoner in his house is.','p'],
['The Assizes','All Paris crowds into the court for the trial of Benedetto.','p'],
['The Indictment','In court, Benedetto names his father: the king’s attorney, Villefort.','p'],
['Expiation','Villefort hurries home and is too late; the count tells him he is Edmond Dantès, and Villefort loses his reason.','p'],
['The Departure','The count leaves Paris with Maximilian for Marseilles.','m'],
['The Past','In Marseilles he finds Mercédès alone, sees Albert leave as a soldier, and visits his old cell in the Château d’If.','m'],
['Peppino','Danglars flees to Italy with the hospitals’ money and is taken by Vampa’s men.','r'],
['Luigi Vampa’s Bill of Fare','Shut in a cell, Danglars pays a fortune for every meal.','r'],
['The Pardon','The count shows himself to Danglars and forgives him.','r'],
['The Fifth of October','On the island of Monte Cristo, the count brings Maximilian and Valentine together and sails away, leaving them two words: wait and hope.','s'],
];
const LINES = { m: 'Marseilles and Provence', i: 'The Château d’If', s: 'The sea and the island', r: 'Rome', p: 'Paris', a: 'Auteuil', j: 'Janina' };
const SCENES = {};
for (const m of html.matchAll(/data-scene="([a-z0-9-]+)" data-chapter="(\d+)"/g)) if (!SCENES[+m[2]]) SCENES[+m[2]] = m[1];
const VOLS = [[1, 27], [28, 47], [48, 73], [74, 95], [96, 117]];
const VNAME = ['one', 'two', 'three', 'four', 'five'];
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const len = (n) => (n < 117 ? starts[n] : END) - starts[n - 1];
if (C.length !== 117) throw new Error('chapters ' + C.length);
// chart
const max = Math.max(...C.map((_, i) => len(i + 1)));
const bw = 8, gap = 2, H = 120;
let svg = `<svg class="tl-chart" viewBox="0 0 ${117 * (bw + gap)} ${H + 26}" role="img" aria-labelledby="tl-chart-t"><title id="tl-chart-t">The length of each of the 117 chapters in lines of the source text, coloured by where the chapter takes place. The longest is chapter ${C.map((_, i) => len(i + 1)).indexOf(max) + 1}.</title>`;
for (let n = 1; n <= 117; n++) {
  const h = Math.max(3, Math.round((len(n) / max) * H));
  const x = (n - 1) * (bw + gap);
  svg += `<a href="#ch-${n}"><rect class="tl-${C[n - 1][2]}" x="${x}" y="${H - h}" width="${bw}" height="${h}"><title>Chapter ${n}. ${esc(C[n - 1][0])}: ${len(n)} lines</title></rect></a>`;
  if (SCENES[n]) svg += `<circle class="tl-dot" cx="${x + bw / 2}" cy="${H + 8}" r="3"/>`;
}
for (const [i, [a]] of VOLS.entries()) { const x = (a - 1) * (bw + gap); svg += `<text x="${x}" y="${H + 24}">${['I', 'II', 'III', 'IV', 'V'][i]}</text>`; }
svg += '</svg>';
let out = svg + '\n<ul class="tl-legend">' + Object.entries(LINES).map(([k, v]) => `<li><i class="tl-${k}"></i>${esc(v)}</li>`).join('') + '<li><i class="tl-dotkey"></i>drawn on this page</li></ul>\n<div class="tl-vols">\n';
VOLS.forEach(([a, b], vi) => {
  out += `<section class="tl-vol" aria-labelledby="tl-v${vi + 1}"><h3 id="tl-v${vi + 1}">Volume ${VNAME[vi]}<span>chapters ${a} to ${b}</span></h3>\n<ol start="${a}">\n`;
  for (let n = a; n <= b; n++) {
    const [t, s, l] = C[n - 1];
    out += `<li id="ch-${n}" class="tl-${l}"><span class="tl-n">${n}</span><div><b>${esc(t)}</b> ${esc(s)}${SCENES[n] ? ` <a class="tl-scene" href="#s-${SCENES[n]}" data-umami-event="drawn_timeline_scene" data-umami-event-kapitola="${n}">See the scene</a>` : ''}</div></li>\n`;
  }
  out += '</ol></section>\n';
});
out += '</div>';
const a = html.indexOf('<!--TL'), b = html.indexOf('<!--/TL-->');
if (a < 0 || b < 0) throw new Error('TL markers missing');
const head = html.slice(a, html.indexOf('-->', a) + 3);
writeFileSync(PAGE, html.slice(0, a) + head + "\n" + out + "\n" + html.slice(b));
console.log('timeline: 117 chapters, scenes at chapters', Object.keys(SCENES).join(', '));
