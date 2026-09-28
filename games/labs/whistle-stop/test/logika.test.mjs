// node --test products/arling-sk/games/labs/whistle-stop/test/
// Logika M0: vzorce proti GDD 3.1 a 3.2, deje stavu, uloženie, kamera, tempo prvých 10 minút.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  OBCHOD, E, milnikov, dalsiMilnik, stupenFasady, pracovnikov, cenaUrovni, cenaManazera, cenaNabytku,
  prijemZaS, zaCyklus, kolkoZaPeniaze, fmt
} from '../ekonomika.mjs';
import { novyStav, tukObchod, krok, kupUroven, najmiManazera, kupNabytok, offline, zdravyStav, interierOtvoreny, cenaDalsiehoKusu } from '../stav.mjs';
import { vytvorUlozisko, pametoveUlozisko, fnv1a, KLUCE } from '../ulozenie.mjs';
import { cielSvihu, cielKlavesy, stredBudovy, rozlozenie, KROK } from '../kamera.mjs';

const blizko = (a, b, rel = 1e-9) => assert.ok(Math.abs(a - b) <= rel * Math.max(1, Math.abs(b)), `${a} != ${b}`);

test('čísla obchodu sú tie isté ako v sim.mjs a GDD 3.2', async () => {
  const sim = await import('../../../../../../ops/hry/western/sim.mjs');
  const b = sim.BUDOVY[1];
  assert.deepEqual([OBCHOD.c, OBCHOD.r, OBCHOD.prijem, OBCHOD.t], [b.c, b.r, b.prijem, b.t]);
  assert.deepEqual(E.milniky, sim.E.milniky);
  assert.equal(E.manazerCena, sim.E.manazerCena);
  assert.equal(E.nabytok.nasobok, sim.E.nabytok.nasobok);
  assert.equal(E.nabytok.cenaZaklad, sim.E.nabytok.cenaZaklad);
  assert.equal(E.nabytok.rastVUrovniach, sim.E.nabytok.rastVUrovniach);
  for (const n of [0, 1, 24, 25, 99, 100, 1000, 1249, 1250, 2000]) assert.equal(milnikov(n), sim.milnikov(n));
  for (const n of [0, 7, 30]) blizko(cenaUrovni(n, 10), sim.cenaUrovni(1, n, 10));
  for (const k of [0, 1, 5]) blizko(cenaNabytku(k), sim.cenaNabytku(1, k));
});

test('míľniky, fasáda a postavy za pultom (GDD 2.3, 2.6)', () => {
  assert.equal(milnikov(24), 0); assert.equal(milnikov(25), 1); assert.equal(milnikov(50), 2);
  assert.equal(dalsiMilnik(1), 25); assert.equal(dalsiMilnik(25), 50); assert.equal(dalsiMilnik(1000), 1250);
  assert.equal(stupenFasady(0), 0); assert.equal(stupenFasady(9), 1); assert.equal(stupenFasady(10), 2);
  assert.equal(stupenFasady(25), 3); assert.equal(stupenFasady(50), 4); assert.equal(stupenFasady(300), 7);
  assert.deepEqual([1, 24, 25, 99, 100, 300].map(pracovnikov), [1, 1, 2, 2, 3, 4]);
});

test('hromadná cena je súčet radu a x10 = desať x1 za sebou', () => {
  let sucet = 0;
  for (let i = 0; i < 10; i++) sucet += cenaUrovni(7 + i, 1);
  blizko(cenaUrovni(7, 10), sucet, 1e-12);
  blizko(cenaUrovni(0, 1), 60);
  assert.equal(cenaManazera(), 1500);
  const k = kolkoZaPeniaze(3, cenaUrovni(3, 12) + 1);
  assert.equal(k, 12);
});

test('príjem: 12 za úroveň, míľnik x2, kus nábytku x1,25', () => {
  assert.equal(prijemZaS(1, [0, 0, 0, 0, 0, 0]), 12);
  assert.equal(prijemZaS(24, [0, 0, 0, 0, 0, 0]), 288);
  assert.equal(prijemZaS(25, [0, 0, 0, 0, 0, 0]), 600);
  blizko(prijemZaS(25, [1, 1, 0, 0, 0, 0]), 600 * 1.25 * 1.25);
  assert.equal(zaCyklus(1, [0, 0, 0, 0, 0, 0]), 24);
});

test('bez manažéra: jeden ťuk = jeden cyklus 2 s, ďalší ťuk počas cyklu nič nespustí', () => {
  const s = novyStav(0);
  assert.equal(tukObchod(s, 0).typ, 'start');
  assert.equal(tukObchod(s, 100).typ, 'bezi');
  assert.deepEqual(krok(s, 1.9), { cyklov: 0, suma: 0 });
  const r = krok(s, 0.2);
  assert.equal(r.cyklov, 1); assert.equal(r.suma, 24); assert.equal(s.cyklus, -1);
  assert.deepEqual(krok(s, 5), { cyklov: 0, suma: 0 }, 'bez ťuku obchod stojí');
});

test('manažér beží sám, ťuk dá 10 % cyklu, najviac 8 ťukov za sekundu', () => {
  const s = novyStav(0); s.peniaze = 1500;
  assert.ok(najmiManazera(s)); assert.equal(s.peniaze, 0); assert.equal(s.man, true);
  assert.equal(najmiManazera(s), null, 'druhý manažér nie je');
  assert.equal(krok(s, 6.5).cyklov, 3);
  let mince = 0;
  for (let i = 0; i < 12; i++) if (tukObchod(s, 1000 + i * 10).typ === 'minca') mince++;
  assert.equal(mince, 8);
  assert.equal(tukObchod(s, 2200).typ, 'minca', 'po sekunde sa limit uvoľní');
  blizko(s.peniaze, 3 * 24 + 9 * 2.4);
});

test('nábytok: až od úrovne 25, cena podľa poradia kusu, najviac 3 stupne na miesto', () => {
  const s = novyStav(0); s.peniaze = 1e12;
  assert.equal(kupNabytok(s, 0), null);
  s.n = 25;
  assert.ok(interierOtvoreny(s));
  blizko(cenaDalsiehoKusu(s), 3000);
  for (let i = 0; i < 3; i++) assert.ok(kupNabytok(s, 0));
  assert.equal(kupNabytok(s, 0), null);
  blizko(cenaDalsiehoKusu(s), cenaNabytku(3));
});

test('kúpa úrovne hlási míľnik a nový stupeň fasády', () => {
  const s = novyStav(0); s.n = 24; s.peniaze = 1e9;
  const r = kupUroven(s, 1);
  assert.equal(r.milnik, true); assert.equal(r.fasada, true); assert.equal(s.n, 25);
  const s2 = novyStav(0);
  assert.equal(kupUroven(s2, 1), null, 'bez peňazí nič');
});

test('offline: len s manažérom, strop 3 h, hodiny späť nič nedajú ani nezoberú', () => {
  const s = novyStav(0);
  assert.equal(offline(s, 3600e3).suma, 0, 'bez manažéra offline nič');
  s.man = true; s.t = 0; s.peniaze = 0;
  const r = offline(s, 5 * 3600e3);
  blizko(r.suma, 12 * 3 * 3600); assert.equal(r.strop, true);
  const pred = s.peniaze;
  const spat = offline(s, 1000e3);
  assert.equal(spat.suma, 0); assert.equal(s.peniaze, pred); assert.equal(s.t, 1000e3, 'uložený čas sa prepíše');
});

test('uloženie: dva sloty, vyhrá novší platný, poškodený sa ignoruje, zablokované úložisko nezhodí hru', () => {
  const ls = pametoveUlozisko();
  const u = vytvorUlozisko(ls);
  const s = novyStav(0); s.n = 7; s.peniaze = 123;
  assert.ok(u.uloz(s, 10));
  s.n = 8; assert.ok(u.uloz(s, 20));
  assert.equal(u.nacitaj(30).n, 8);
  const b = JSON.parse(ls.getItem(KLUCE[1])); b.s.n = 999; ls.setItem(KLUCE[1], JSON.stringify(b));   // súčet nesedí
  assert.equal(vytvorUlozisko(ls).nacitaj(30).n, 7);
  ls.setItem(KLUCE[0], '{nie je json');
  assert.equal(vytvorUlozisko(ls).nacitaj(30), null);
  const z = vytvorUlozisko(pametoveUlozisko({ zablokovane: true }));
  assert.equal(z.funguje(), false); assert.equal(z.uloz(s, 1), false); assert.equal(z.nacitaj(1), null);
  assert.equal(fnv1a('a'), 'e40c292c');
});

test('uloženie: neznáma verzia sa nenačíta a nezmyselné hodnoty sa opravia', () => {
  const ls = pametoveUlozisko();
  const data = { peniaze: -5, n: 'x', man: 'ano', nab: [9, 0, 0, 0, 0, 0], zarobok: 0, prvy: 0, t: 0, vedier: 0 };
  ls.setItem(KLUCE[0], JSON.stringify({ v: 1, t: 1, s: data, h: fnv1a(JSON.stringify(data)) }));
  const s = vytvorUlozisko(ls).nacitaj(2);
  assert.equal(s.peniaze, 0); assert.equal(s.n, 1); assert.equal(s.man, false); assert.equal(s.nab[0], 3);
  ls.setItem(KLUCE[0], JSON.stringify({ v: 2, t: 1, s: data, h: fnv1a(JSON.stringify(data)) }));
  assert.equal(vytvorUlozisko(ls).nacitaj(2), null);
  assert.equal(zdravyStav(null).n, 1);
});

test('kamera: švih vždy skončí na celej budove, hybnosť preskočí najviac 2', () => {
  for (let a = 0; a < 3; a++) for (const v of [-5000, -1200, -300, 0, 300, 1200, 5000]) for (const d of [-400, 0, 400]) {
    const i = cielSvihu(stredBudovy(a) + d, v, a, 3);
    assert.ok(Number.isInteger(i) && i >= 0 && i <= 2 && Math.abs(i - a) <= 2);
  }
  assert.equal(cielSvihu(stredBudovy(0), 0, 0, 3), 0);
  assert.equal(cielSvihu(stredBudovy(0) + 20, 1500, 0, 3), 1, 'rýchly krátky švih posunie o jednu');
  assert.equal(cielSvihu(stredBudovy(0) + KROK * 0.6, 0, 0, 3), 1, 'pomalý ťah za polovicu dosadne na ďalšiu');
  assert.equal(cielSvihu(stredBudovy(0), 99999, 0, 10), 2, 'najviac 2');
  assert.equal(cielKlavesy('ArrowRight', 2, 3), 2); assert.equal(cielKlavesy('2', 0, 3), 1); assert.equal(cielKlavesy('7', 0, 3), 0);
  assert.equal(rozlozenie(390, 844, 3).jednaBudova, true);
  assert.equal(rozlozenie(1440, 900, 3).jednaBudova, false);
});

test('tempo M0: prvý nákup do 15 s, úroveň 25 a interiér do 5 min, druhé poschodie do 15 min (hráč ťuká)', () => {
  // Človek: ťukne, keď obchod stojí (0,4 s reakcia), s manažérom ťuká 4-krát za sekundu, nakupuje raz za sekundu.
  const s = novyStav(0);
  let t = 0, prvy = null, u25 = null, u50 = null, man = null, cakanie = 0;
  const dt = 0.1;
  let dalsiTuk = 0, posledny = 0, maxCakanie = 0;
  while (t < 1200 && u50 === null) {
    if (t >= dalsiTuk) { tukObchod(s, t * 1000); dalsiTuk = t + (s.man ? 0.25 : 0.4); }
    const r = krok(s, dt);
    if (!s.man && r.cyklov) dalsiTuk = t + 0.4;
    t += dt;
    if (Math.abs(t - Math.round(t)) < 1e-6) {
      let kupil = false;
      if (!s.man && s.peniaze >= cenaManazera() && s.n >= 10) { najmiManazera(s); man = man ?? t; kupil = true; }
      if (s.n >= 25 && s.peniaze >= cenaDalsiehoKusu(s) && cenaDalsiehoKusu(s) < cenaUrovni(s.n, 5)) {
        const volne = s.nab.findIndex(x => x < 3); if (volne >= 0) { kupNabytok(s, volne); kupil = true; }
      }
      const k = Math.max(1, Math.min(10, kolkoZaPeniaze(s.n, s.peniaze)));
      if (kupUroven(s, k)) kupil = true;
      if (kupil) { prvy = prvy ?? t; maxCakanie = Math.max(maxCakanie, t - posledny); posledny = t; }
      if (s.n >= 25 && u25 === null) u25 = t;
      if (s.n >= 50 && u50 === null) u50 = t;
    }
  }
  cakanie = maxCakanie;
  console.log(`tempo M0: prvý nákup ${prvy} s, manažér ${man} s, úroveň 25 ${u25} s, úroveň 50 ${u50} s, najdlhšie čakanie ${cakanie.toFixed(0)} s`);
  assert.ok(prvy <= 15, 'prvý nákup');
  assert.ok(u25 !== null && u25 <= 300, 'úroveň 25');
  assert.ok(u50 !== null && u50 <= 900, 'úroveň 50');
});

test('karta: najbližšia vizuálna zmena je oddelená od míľnika príjmu (nález 4 brány M0)', async () => {
  const { dalsieCiele } = await import('../ekonomika.mjs');
  // úrovne 1 a 9: štít pribudne pri 10, príjem x2 až pri 25 (predtým karta písala „Level 25: income x2, false front“)
  for (const n of [1, 9]) {
    const c = dalsieCiele(n);
    assert.equal(c.vzhlad.uroven, 10);
    assert.deepEqual(c.riadky, ['Level 10: false front', 'Level 25: income x2']);
  }
  // úrovne 10 a 24: pri 25 príde naraz príjem x2, veranda, druhý pracovník aj interiér, preto jeden riadok
  for (const n of [10, 24]) {
    const c = dalsieCiele(n);
    assert.equal(c.vzhlad.uroven, 25); assert.equal(c.prijem, 25);
    assert.deepEqual(c.riadky, ['Level 25: income x2, porch, second clerk, interior']);
  }
  assert.deepEqual(dalsieCiele(25).riadky, ['Level 50: income x2, second floor']);
  assert.deepEqual(dalsieCiele(100).riadky, ['Level 200: income x2, brick']);
  assert.deepEqual(dalsieCiele(300).riadky, ['Level 400: income x2']);
  // zhoda s tým, čo sa naozaj stane: fasáda alebo počet pracovníkov sa zmení práve na hlásenej úrovni, skôr nie
  const zmena = (a, b) => stupenFasady(a) !== stupenFasady(b) || pracovnikov(a) !== pracovnikov(b);
  for (const n of [1, 9, 10, 24, 25, 60, 150, 250]) {
    const u = dalsieCiele(n).vzhlad.uroven;
    assert.ok(zmena(u - 1, u), `na úrovni ${u} sa niečo zmení`);
    for (let k = n + 1; k < u; k++) assert.ok(!zmena(k - 1, k), `medzi ${n} a ${u} (úroveň ${k}) nič`);
  }
});

test('formát čísel', () => {
  assert.equal(fmt(12), '12'); assert.equal(fmt(1500), '1.50 K'); assert.equal(fmt(2.5e9), '2.50 B');
});
