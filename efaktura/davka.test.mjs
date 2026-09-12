import test from 'node:test';
import assert from 'node:assert/strict';
import { citajCsv, zostavDavku, davkaJePripravena, davkaJeOdomknuta, VZOR_CSV, POVINNE, VOLITELNE } from './davka.mjs';
import { vytvorZip, crc32 } from './davka-zip.mjs';
import { TEXTY_DAVKY } from './davka-texty.mjs';
import { parsujXml, txt } from './parser.mjs';

const zaklad = { profil: 'xrechnung', sposobPlatby: '58',
  dodavatel: { nazov: 'Fiktivny dodavatel', ulica: 'Vzorova 1', mesto: 'Berlin', psc: '10115', krajina: 'DE',
    ico: 'HRB12345', icDph: 'DE123456789', kontakt: 'Example Contact', email: 'invoice@example.com', telefon: '+49 30 1234567',
    iban: 'DE02120300000000202051', endpoint: 'DE123456789', endpointSchema: '9930' }
};
const kopia = () => structuredClone(zaklad);
const csv = (riadky, hlavicka = POVINNE.concat('buyer_reference')) => '\uFEFF' + hlavicka.join(';') + '\n' + riadky.join('\n') + '\n';
const vzorRiadky = VZOR_CSV.trim().split('\r\n').slice(1);
const kody = v => v.chyby.map(e => e.kod);

test('2 faktury, 3 riadky, presne sumy, bez mutacie dodavatela', () => {
  const f = kopia(), before = JSON.stringify(f), v = zostavDavku(VZOR_CSV, f, 'de');
  assert.equal(v.faktury.length, 2); assert.equal(v.faktury[0].faktura.polozky.length, 2);
  assert.equal(v.faktury[0].sucty.naUhraduCenty, 20349);
  assert.equal(v.faktury[1].sucty.naUhraduCenty, 10710);
  assert.equal(JSON.stringify(f), before);
  assert.ok(davkaJePripravena(v), JSON.stringify(v.faktury.map(f => f.kontrola.nalezy.filter(n => n.zavaznost === 'chyba'))));
  assert.notEqual(v.faktury[0].faktura.dodavatel, f.dodavatel);
});
test('rovnaky vysledok a podporovana kontrola pre 4 jazyky a oba profily', () => {
  for (const jazyk of ['sk','cs','de','en']) for (const profil of ['xrechnung','peppol']) {
    const v = zostavDavku(VZOR_CSV, { ...kopia(), profil }, jazyk);
    assert.ok(davkaJePripravena(v)); assert.equal(v.faktury[0].sucty.naUhraduCenty, 20349);
  }
});
test('CSV ciarka, quoted delimiter, newline a escapovane uvodzovky', () => {
  const r = citajCsv(VZOR_CSV)[0].data; r.description = 'A, B\n"Quoted"'; r.unit_price = '75,50';
  const esc = v => '"' + v.replaceAll('"', '""') + '"';
  const text = Object.keys(r).join(',') + '\n' + Object.values(r).map(esc).join(',');
  const v = zostavDavku(text, kopia());
  assert.ok(davkaJePripravena(v)); assert.equal(v.faktury[0].faktura.polozky[0].nazov, r.description);
  assert.equal(v.faktury[0].faktura.polozky[0].cena, 75.5);
});
test('chybne uvodzovky a rozdielny pocet stlpcov sa nezamlcia', () => {
  assert.throws(() => citajCsv(VZOR_CSV + '"oops'), { kod: 'quotes' });
  assert.throws(() => citajCsv(VZOR_CSV + 'a;b'), { kod: 'columns' });
});
test('chybne a opakovane hlavicky sa odmietnu', () => {
  assert.throws(() => citajCsv(VZOR_CSV.replace('unit_price;', 'price;')), { kod: 'header_unknown' });
  assert.throws(() => citajCsv(VZOR_CSV.replace('unit_price;', 'quantity;')), { kod: 'header_duplicate' });
  assert.throws(() => citajCsv(VZOR_CSV.replace('unit_price;', 'unit;')), { kod: 'header_missing' });
});
test('nan, exponent, zaporna cena, tisicovy oddelovac a prilis vela desatinnych miest su chyby', () => {
  for (const cena of ['NaN','1e3','-5','1 000','1,000.50','1.12345','Infinity','']) {
    const v = zostavDavku(VZOR_CSV.replace('75.50', cena), kopia());
    assert.ok(v.chyby.some(e => ['number','required'].includes(e.kod)), cena);
    assert.equal(davkaJePripravena(v), false);
  }
});
test('nulova cena povolena, nulove mnozstvo zamietnute', () => {
  assert.ok(davkaJePripravena(zostavDavku(VZOR_CSV.replace('75.50', '0'), kopia())));
  const v = zostavDavku(VZOR_CSV.replace(';2;75.50;', ';0;75.50;'), kopia());
  assert.ok(kody(v).includes('number'));
});
test('neexistujuci datum a splatnost pred vystavenim', () => {
  assert.ok(kody(zostavDavku(VZOR_CSV.replaceAll('2026-09-12','2026-02-30'), kopia())).includes('date'));
  assert.ok(kody(zostavDavku(VZOR_CSV.replaceAll('2026-09-26','2026-09-01'), kopia())).includes('due_date'));
});
test('duplicita a rovnake cislo s inym kupujucim zastavia celu davku', () => {
  assert.ok(kody(zostavDavku(csv([...vzorRiadky, vzorRiadky[0]]), kopia())).includes('duplicate'));
  const v = zostavDavku(csv([vzorRiadky[0], vzorRiadky[1].replace('Berlin','Bonn')]), kopia());
  assert.ok(kody(v).includes('conflict')); assert.equal(davkaJePripravena(v), false);
});
test('nesusediace polozky jednej faktury sa spoja a zachovaju cisla riadkov', () => {
  const v = zostavDavku(csv([vzorRiadky[0], vzorRiadky[2], vzorRiadky[1]]), kopia());
  assert.deepEqual(v.faktury[0].riadky, [2,4]); assert.ok(davkaJePripravena(v));
});
test('nepreberie zalohu, poznamku ani typ dobropisu zo single formulara', () => {
  const v = zostavDavku(VZOR_CSV, { ...kopia(), typ: '381', zaplatene: 100, poznamka: 'private', variabilnySymbol: 'old' });
  assert.equal(v.faktury[0].faktura.typ, '380'); assert.equal(v.faktury[0].sucty.zaplateneCenty, 0);
  assert.ok(!v.faktury[0].xml.includes('private')); assert.ok(!v.faktury[0].xml.includes('old'));
});
test('DPH je explicitna, neznama kategoria a nesulad sadzby sa odmietnu', () => {
  for (const x of [';0;S;', ';19;Z;', ';19;K;']) {
    const v = zostavDavku(VZOR_CSV.replace(';19;S;',x), kopia());
    assert.equal(davkaJePripravena(v),false); assert.ok(v.chyby.length);
  }
});
test('UBL chyby dodavatela viditelne pred platenim', () => {
  const f = kopia(); f.dodavatel.nazov = ''; 
  const v = zostavDavku(VZOR_CSV,f); assert.equal(davkaJePripravena(v), false);
  assert.ok(v.faktury.every(f => f.kontrola.sumar.chyby > 0));
});
test('XML obsah je escapovany a nulove prefixy identifikatorov zostavaju', () => {
  const v = zostavDavku(VZOR_CSV.replace('Consulting','<img src=x onerror=alert(1)>').replaceAll('DEMO-001','00001'),kopia());
  assert.equal(v.faktury[0].faktura.cislo, '00001');
  assert.ok(v.faktury[0].xml.includes('&lt;img')); assert.ok(!v.faktury[0].xml.includes('<img'));
  assert.ok(parsujXml(v.faktury[0].xml).ok);
});
test('limity velkosti a poctu faktur sa neprekrocia potichu', () => {
  assert.throws(() => citajCsv('a'.repeat(1000001)), { kod:'size' });
  const lines = Array.from({length:101},(_,i)=>vzorRiadky[0].replace('DEMO-001','I'+i));
  const v = zostavDavku(csv(lines),kopia()); assert.ok(kody(v).includes('invoices')); assert.equal(davkaJePripravena(v),false);
  assert.throws(() => citajCsv(csv(Array(501).fill(vzorRiadky[0]))), { kod:'rows' });
});
test('30 dni vyzaduje zhodny rezim a cas, jedna faktura neodomkne ZIP', () => {
  const now=1800000000000, paid={typ:'30dni',session:'cs_live_ABC123',t:now-1000,test:false};
  assert.equal(davkaJeOdomknuta(paid,false,now),true);
  for (const z of [null, {...paid,typ:'jedna'}, {...paid,t:now+1}, {...paid,t:now-30*86400000}, {...paid,session:'oops'}, {...paid,test:true}, {...paid,t:'x'}]) assert.equal(davkaJeOdomknuta(z,false,now),false);
  assert.equal(davkaJeOdomknuta({...paid,session:'cs_test_ABC123',test:true},false,now),false);
  assert.equal(davkaJeOdomknuta({...paid,session:'cs_test_ABC123',test:true},true,now),true);
});
test('ZIP CRC znamy vektor, lokalne hlavicky, centralny adresar a UTF-8 obsah', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')),0xcbf43926);
  const text='<Invoice>Žluťoučký kôň</Invoice>', data=new TextEncoder().encode(text);
  const zip=vytvorZip([{meno:'001-invoice.xml',text}]), view=new DataView(zip.buffer);
  assert.equal(view.getUint32(0,true),0x04034b50);
  assert.equal(view.getUint32(14,true),crc32(data));
  const start=30+view.getUint16(26,true); assert.equal(new TextDecoder().decode(zip.slice(start,start+data.length)),text);
  const end=zip.length-22, central=view.getUint32(end+16,true);
  assert.equal(view.getUint32(central,true),0x02014b50); assert.equal(view.getUint16(end+10,true),1);
});
test('ZIP zablokuje priechody priecinkami a koliziu mien', () => {
  assert.throws(()=>vytvorZip([{meno:'../file.xml',text:''}]));
  assert.throws(()=>vytvorZip([{meno:'one.xml',text:''},{meno:'ONE.xml',text:''}]));
});
test('styri jazyky maju vsetky spravy aj chybove kody; cenu nevkladaju rucne', () => {
  for(const lang of ['sk','cs','de','en']) {
    assert.deepEqual(Object.keys(TEXTY_DAVKY[lang]),Object.keys(TEXTY_DAVKY.en));
    assert.deepEqual(Object.keys(TEXTY_DAVKY[lang].problems),Object.keys(TEXTY_DAVKY.en.problems));
    assert.ok(TEXTY_DAVKY[lang].price.includes('{price}')); assert.ok(TEXTY_DAVKY[lang].buy.includes('{price}'));
  }
});

test('kratky ucet pri SEPA sa zablokuje aj ked ho vseobecny XML checker nepovazuje za IBAN', () => {
  const f=kopia();f.dodavatel.iban='DE123';const v=zostavDavku(VZOR_CSV,f);
  assert.ok(kody(v).includes('iban'));assert.equal(davkaJePripravena(v),false);
});
