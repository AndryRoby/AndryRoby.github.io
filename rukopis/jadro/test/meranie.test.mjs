import test from 'node:test';
import assert from 'node:assert/strict';
import { merajText, lin, pasmo, zhody } from '../meranie.js';
import { normalizuj, priprav, vety } from '../delenie.js';
import sk from '../jazyky/sk.js';
import en from '../jazyky/en.js';
import skVzorky from './vzorky/sk.mjs';
import enVzorky from './vzorky/en.mjs';

const zlate = {
  sk: [
    [108,[9,15,11,11,8,4,17,10,10,13],[24,30,31,23],.3202151197368626,10,3,['Na záver','Nezabúdajte']],
    [38,[6,8,8,5,5,6],[38],.19692933614599692,0,0,[]],
    [40,[9,9,4,8,4,6],[40],.32015621187164245,0,0,[]],
    [40,[5,13,2,5,11,4],[40],.5916079783099616,0,0,[]],
    [32,[10,9,10,3],[32],.3644344934278313,0,1,[]]
  ],
  en: [
    [113,[10,17,11,10,8,6,14,16,11,10],[27,29,36,21],.28825659247614743,11,3,['Ultimately','Remember']],
    [42,[6,8,13,8,7],[42],.2876915707998708,0,0,[]],
    [43,[11,10,5,8,5,4],[43],.3728190591135208,0,0,[]],
    [43,[6,14,3,5,11,4],[43],.5547376949710029,0,0,[]],
    [35,[13,6,16],[35],.35913728828504393,0,1,[]]
  ]
};
const vypln = (jazyk, n) => Array(n).fill(jazyk === 'sk' ? 'slovo' : 'word').join(' ') + '.';

for (const [jazyk, j, vzorky] of [['sk',sk,skVzorky], ['en',en,enVzorky]]) {
  const meraj = text => merajText(text, { jazyk });
  test(jazyk + ': 1 determinizmus a poradie volaní', () => {
    const prve = JSON.stringify(meraj(vzorky[0]));
    meraj(vzorky[2]);
    assert.equal(JSON.stringify(meraj(vzorky[0])), prve);
    const RealDate = globalThis.Date;
    try {
      globalThis.Date = class { constructor() { throw Error('Meranie nesmie čítať čas'); } static now() { throw Error('Čas'); } };
      assert.equal(JSON.stringify(meraj(vzorky[0])), prve);
    } finally { globalThis.Date = RealDate; }
  });
  for (let i = 0; i < vzorky.length; i++) test(jazyk + ': 2 zlatá vzorka ' + i, () => {
    const r = meraj(vzorky[i]);
    const [w,dl,od,cv,f,t,z] = zlate[jazyk][i];
    assert.equal(r.slov,w);
    assert.equal(r.viet,dl.length);
    assert.deepEqual(r.dlzky_viet,dl);
    assert.deepEqual(r.dlzky_odsekov,od);
    assert.ok(Math.abs(r.vektor.veta_cv-cv) < 1e-12);
    assert.equal(r.merania.M6.pocet,f);
    assert.equal(r.merania.M9.pocet,t);
    assert.deepEqual(r.merania.M3?.znacky ?? [],z);
    if (i === 0) {
      assert.equal(r.merania.M4.cisla,0);
      assert.equal(r.merania.M4.mena,1); // PDF podľa zadanej heuristiky.
      assert.equal(r.merania.M5.otazky,0);
    }
    for (const h of r.zvyraznenia) {
      assert.ok(h.od >= 0 && h.do > h.od && h.do <= vzorky[i].length);
      assert.equal(vzorky[i].slice(h.od,h.do),h.text);
    }
    for (const m of Object.values(r.merania)) assert.ok(Number.isFinite(m.skore) && m.skore >= 0 && m.skore <= 100);
    const entries = Object.entries(r.merania);
    assert.equal(r.index,Math.round(entries.reduce((s,[id,m])=>s+j.VAHY[id]*m.skore,0)/entries.reduce((s,[id])=>s+j.VAHY[id],0)));
  });
  test(jazyk + ': 3 skratky, dátum, desatinné čísla a citácie', () => {
    for (const skratka of j.SKRATKY) assert.equal(vety('Text ' + skratka + ' Peter. Hotovo.',j).length,2,skratka);
    assert.equal(vety('Text 29. 9. 2026. Cena 1.5 eur. „Dve slová!“ Hotovo.',j).length,4);
    assert.equal(vety('🙂 Text. „Nová veta.“ Koniec.',j).length,3);
  });
  test(jazyk + ': 3 nadpis a zoznam mimo rytmu', () => {
    const p = priprav('Titul\n\n' + vypln(jazyk,80) + '\n- ' + vypln(jazyk,7) + '\n* ' + vypln(jazyk,8) + '\n• ' + vypln(jazyk,9) + '\n1) ' + vypln(jazyk,10),j);
    assert.equal(p.rytmus.length,1);
    assert.deepEqual(p.dlzkyOdsekov,[80]);
    assert.equal(p.vsetky.length,5);
    assert.ok(p.slova.length > 80);
  });
  test(jazyk + ': 4 dĺžkové hranice a vynechané merania', () => {
    assert.equal(meraj(vypln(jazyk,29)).chyba,'malo_slov');
    const kratke = meraj(vypln(jazyk,30));
    assert.equal(kratke.ciastocny,true);
    assert.deepEqual(Object.keys(kratke.merania),['M6','M7','M8','M9']);
    const osemdesiat = meraj(vypln(jazyk,80));
    assert.ok(osemdesiat.merania.M3);
    assert.equal(osemdesiat.merania.M1,undefined);
    assert.equal(osemdesiat.merania.M2,undefined);
    assert.equal(meraj(vzorky[0]).ciastocny,false);
    const dlhe = meraj(vypln(jazyk,5001));
    assert.equal(dlhe.slov,5000);
    assert.equal(dlhe.povodne_slov,5001);
    assert.equal(dlhe.orezane,true);
    assert.equal(meraj(vypln(jazyk,5000)).orezane,false);
  });
  test(jazyk + ': 5 najdlhšie frázy, hranice slov a opakovanie', () => {
    assert.ok(j.FRAZY.length >= 80);
    assert.equal(new Set(j.FRAZY).size,j.FRAZY.length);
    const fraza = jazyk === 'sk' ? 'posunúť na ďalšiu úroveň' : 'take it to the next level';
    const r = zhody(fraza + '. ' + fraza,j.FRAZY,j.KONSTRUKCIE);
    assert.equal(r.length,2);
    assert.equal(r[0].text,fraza);
    assert.equal(zhody('xx' + fraza + 'xx', [fraza]).length,0);
    const real = meraj(vzorky[0]).zvyraznenia.filter(h=>h.typ==='fraza');
    for (let i=1;i<real.length;i++) assert.ok(real[i-1].do<=real[i].od);
  });
  test(jazyk + ': pozície po NFC, CRLF, apostrofoch a emoji', () => {
    const text = ('🙂\r\n\r\n' + vzorky[0]).normalize('NFD').replace(/'/g,'’').replace(/\n/g,'\r\n');
    const r = meraj(text);
    assert.equal(r.merania.M9.pocet,3);
    for (const h of r.zvyraznenia) assert.equal(text.slice(h.od,h.do),h.text);
    assert.equal(normalizuj(text).text, text.normalize('NFC').replace(/\r\n/g,'\n').replace(/[’‘]/g,"'"));
  });
  test(jazyk + ': 7 číselné zápisy sa počítajú bez prepisu', () => {
    const r = meraj('Cena 1 000; 1000; 1.000; 1,5; 1.5; 15 %. ' + vypln(jazyk,80));
    assert.equal(r.merania.M4.cisla,6);
  });
  test(jazyk + ': nominalizácie a výnimky', () => {
    const slovo = jazyk === 'sk' ? 'zabezpečenie' : 'implementation';
    assert.equal(meraj(slovo + ' ' + vypln(jazyk,30)).merania.M8.pocet,1);
    if(jazyk==='en') assert.equal(meraj('science audience comment ' + vypln(jazyk,30)).merania.M8.pocet,0);
  });
  test(jazyk + ': pomlčky a otázka s explicitnou odpoveďou', () => {
    assert.equal(meraj('Text\u2014text 2\u20133 text \u2013 text -- text. ' + vypln(jazyk,80)).merania.M7.pocet,3);
    const ano = jazyk === 'sk' ? 'Áno' : 'Yes';
    assert.equal(meraj('Test? '+ano+'. '+vypln(jazyk,80)).merania.M5.otazky,0);
    assert.equal(meraj(vypln(jazyk,80)+' Test?').merania.M5.otazky,1);
  });
  test.skip(jazyk + ': 6 profil hlasu, mimo kroku 1', () => {});
  test.skip(jazyk + ': 7 kontroly prepisu C1 až C9, mimo kroku 1', () => {});
}
test('lin a hranice pásiem', () => {
  assert.equal(lin(.6,.6,.25),0);
  assert.equal(lin(.25,.6,.25),100);
  assert.equal(lin(-1,0,1),0);
  assert.equal(lin(2,0,1),100);
  assert.deepEqual([0,34,35,64,65,100].map(n=>pasmo(n)),['zivy','zivy','zmiesany','zmiesany','prilis_uhladeny','prilis_uhladeny']);
});
test('jazyk a vstupné chyby', () => {
  assert.equal(merajText('Text').chyba,'vyber_jazyk');
  assert.equal(merajText(vypln('en',30)).chyba,'vyber_jazyk');
  assert.equal(merajText('the and of '.repeat(15)).jazyk,'en');
  assert.equal(merajText('a že sa '.repeat(15)).jazyk,'sk');
  assert.throws(()=>merajText('x',{jazyk:'de'}),RangeError);
  assert.throws(()=>merajText(null),TypeError);
});

test('Citácie zachované po normalizácii apostrofov', () => {
  const r=merajText('Text ‚dve slová‘ a „ďalšie slová“. '+vypln('sk',80),{jazyk:'sk'});
  assert.equal(r.merania.M4.citacie,2);
  assert.ok(r.zvyraznenia.some(h=>h.text==='‚dve slová‘'));
});
