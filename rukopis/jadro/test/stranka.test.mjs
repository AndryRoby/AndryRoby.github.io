import test from 'node:test';
import assert from 'node:assert/strict';
import { zaznamenaj } from '../../stranka/analytika.js';
import { kusky } from '../../stranka/zvyraznenia.js';

test('Umami dostane len povolené metadáta, nikdy text ani URL parametre', () => {
  const sent=[];
  const env={
    location:{hostname:'arling.sk',pathname:'/rukopis/en/',search:'?secret=PRIVATE_TEXT'},
    navigator:{doNotTrack:'0'},
    fetch:(url,options)=>{sent.push({url,options});return Promise.resolve({ok:true});}
  };
  const input={jazyk:'sk',slov_vedro:'80-199',pasmo:'zmiesany',text:'PRIVATE_TEXT',email:'PRIVATE_MAIL'};
  zaznamenaj('rukopis_meranie',input,env);
  zaznamenaj('rukopis_ukazka_klik',input,env);
  assert.equal(sent.length,2);
  const p=JSON.parse(sent[0].options.body).payload;
  assert.deepEqual(p.data,{jazyk:'sk',slov_vedro:'80-199',pasmo:'zmiesany'});
  assert.deepEqual(JSON.parse(sent[1].options.body).payload.data,{jazyk:'sk'});
  assert.equal(p.url,'/rukopis/en/');
  assert.equal(p.referrer,'');
  assert.equal(sent[0].options.credentials,'omit');
  assert.equal(sent[0].options.referrerPolicy,'no-referrer');
  assert.ok(!JSON.stringify(sent).includes('PRIVATE'));
  env.location.search='?test=1';
  zaznamenaj('rukopis_meranie',input,env);
  env.location.search='';
  env.navigator.doNotTrack='1';
  zaznamenaj('rukopis_meranie',input,env);
  env.navigator.doNotTrack='0';
  env.location.hostname='localhost';
  zaznamenaj('rukopis_meranie',input,env);
  assert.equal(sent.length,2);
});
test('Analytika odmieta cudzie hodnoty a jej chyba nezastaví meranie', () => {
  let n=0;
  const env={location:{hostname:'arling.sk',pathname:'/rukopis/',search:''},navigator:{},fetch:()=>{n++;throw Error('offline');}};
  assert.doesNotThrow(()=>zaznamenaj('rukopis_ukazka_klik',{jazyk:'en'},env));
  zaznamenaj('cudzia_udalost',{jazyk:'en'},env);
  zaznamenaj('rukopis_meranie',{jazyk:'en',slov_vedro:'PRIVATE_TEXT',pasmo:'zivy'},env);
  zaznamenaj('rukopis_ukazka_klik',{jazyk:'PRIVATE_TEXT'},env);
  assert.equal(n,1);
});
test('Zvýraznenia zachovajú HTML ako text a nezahodia prekryvy', () => {
  const text='<img src=x onerror=alert(1)> 🙂 e\u0301\r\nKoniec';
  const r=kusky(text,[{od:0,do:12,typ:'fraza'},{od:5,do:15,typ:'pointa'},{od:7,do:9,typ:'fraza'}]);
  assert.equal(r.map(k=>k.text).join(''),text);
  assert.ok(r.some(k=>k.typy.includes('fraza')&&k.typy.includes('pointa')));
  assert.deepEqual(kusky('abc',[]),[{text:'abc',typy:[]}]);
  assert.equal(kusky('abc',[{od:-1,do:2,typ:'fraza'}]).map(k=>k.text).join(''),'abc');
});
