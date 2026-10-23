// jadro-218.test.mjs: relácia 218 (23. 10. 2026), stavač A-jadro. Spustenie: node --test products/arling-sk/feed-doctor/agent-ready/jadro-218.test.mjs
// (1) Írske zákonné nápisy „cancel contract here“ a „confirm cancellation“ (§ 115A Consumer Rights Act 2022, S.I. 309/2026) sú
// nájdené ako funkcia a potvrdenie; rakúska alternatíva „Vom Vertrag zurücktreten“ / „Rücktritt bestätigen“ a anglický predvolený
// nápis Shopware „Revoke a contract“ / „Confirm revocation“ sú podobné, nikdy nájdené; slová súhlasu nič; 9 jazykov smernice bez zmeny.
// (2) Shoptet bez odkazu na stránku objednávky: jadro nesie eu_withdrawal.platform, výsledok (eu-zobraz.mjs) a stránky 213 a 220
// (kontrola-povinnosti) povedia, že Shoptet má funkciu zabudovanú, a ukážu cestu v administrácii; nie pri link_found, found,
// odkaze „Moja objednávka“ ani na inej platforme. Každý test bez opravy zlyhá (overené mutantmi v scratchpade, správa
// ops/druhy-ucet/218/stavba/A-jadro.md). Len zástupné adresy.
import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeStore,WITHDRAWAL_LABELS} from './core.mjs';
import {euView,euEvent,shoptetBezOdkazu} from './eu-zobraz.mjs';
import {EU_UI} from './i18n.mjs';
import * as K from '../../kontrola-povinnosti/kontrola.mjs';
import {euTexty,texty} from '../../kontrola-povinnosti/texty.mjs';

const O='https://shop.example.org',res=(p,t,s=200)=>({url:O+p,text:t,status:s});
const report=(home='<p>x</p>')=>analyzeStore({at:'2026-10-23T08:00:00.000Z',storeUrl:O,
  resources:{robots:res('/robots.txt','User-agent: *\nAllow: /\n'),home:res('/',home),feed:res('/products.json','',404),returns:res('/r','<p>r</p>'),shipping:res('/s','<p>s</p>'),contact:res('/c','<p>c</p>'),llms:res('/llms.txt','',404)},
  productPages:[]});
const odkaz=label=>`<footer><a href="/info/">${label}</a></footer>`;
const w=rep=>rep.eu.rules[0];
const NEVER=/undefined|\{label\}|\{page\}/;
const LANGS=['en','sk','de'];

/* ---------- (1) nápisy ---------- */

test('218 IE: „cancel contract here“ je nájdená funkcia a „confirm cancellation“ nájdené potvrdenie (lang en), aj s dvoma slovami navyše', ()=>{
  for(const [label,kind] of [['Cancel contract here','function'],['cancel the contract here','function'],['CANCEL CONTRACT HERE','function'],
    ['Confirm cancellation','confirm'],['Confirm your cancellation','confirm']]){
    const r=w(report(odkaz(label)));
    assert.equal(r.status,'found',label);assert.equal(r.found.length,1,label);
    assert.deepEqual([r.found[0].label,r.found[0].kind,r.found[0].lang],[label,kind,'en'],label);
    assert.deepEqual(r.similar,[],label);
  }
  // Výsledok stránky: „Label found“ s írskym nápisom, tón ok.
  const v=euView(report(odkaz('Cancel contract here')).eu,EU_UI.en)[0];
  assert.equal(v.badge,EU_UI.en.rules.eu_withdrawal.status.found);assert.equal(v.tone,'ok');
  assert.equal(v.lines[0].text,'We found a link or button labelled “Cancel contract here” on the home page.');
});

test('218 IE: iné slová so „cancel“ nie sú nápis ani podobný odkaz („Cancel a Contract“, viac než 2 slová navyše, zrušenie súhlasu)', ()=>{
  for(const label of ['Cancel a Contract','Cancel order','Cancel your subscription contract right here now','Confirm cancellation of consent','Cancel contract here (cookie settings)']){
    const r=w(report(odkaz(label)));
    assert.equal(r.status,'not_found',label);assert.deepEqual(r.found,[],label);assert.deepEqual(r.similar,[],label);
  }
});

test('218 AT a Shopware: „Vom Vertrag zurücktreten“, „Rücktritt bestätigen“, „Revoke a contract“, „Confirm revocation“ sú podobné, nikdy nájdené', ()=>{
  for(const label of ['Vom Vertrag zurücktreten','VOM VERTRAG ZURÜCKTRETEN','Rücktritt bestätigen','Rücktrittsrecht','Revoke a contract','Confirm revocation','Revocation']){
    const r=w(report(odkaz(label)));
    assert.equal(r.status,'not_found',label);assert.deepEqual(r.found,[],label);
    assert.deepEqual(r.similar.map(s=>s.label),[label],label);
  }
  // Na stránke: „Link prüfen“ / „Check the link“, neutrálny tón, nikdy „Beschriftung gefunden“.
  const de=euView(report(odkaz('Vom Vertrag zurücktreten')).eu,EU_UI.de)[0];
  assert.equal(de.badge,EU_UI.de.rules.eu_withdrawal.status.check);assert.equal(de.tone,'unknown');
  const en=euView(report(odkaz('Revoke a contract')).eu,EU_UI.en)[0];
  assert.equal(en.badge,EU_UI.en.rules.eu_withdrawal.status.check);assert.equal(en.tone,'unknown');
});

test('218 súhlas a cookies: „Revoke consent“, „Einwilligung: Rücktritt“ a podobné nie sú nápis ani podobný odkaz', ()=>{
  for(const label of ['Revoke consent','Revoke cookie consent','Cookie-Einwilligung zurücktreten','Rücktritt von der Einwilligung','Zustimmung: Rücktritt bestätigen','Revoke your consent to cookies']){
    const r=w(report(odkaz(label)));
    assert.equal(r.status,'not_found',label);assert.deepEqual(r.found,[],label);assert.deepEqual(r.similar,[],label);
  }
});

test('218: 18 nápisov smernice v 9 jazykoch dáva ten istý výsledok ako pred reláciou (kind, lang), poradie jazykov sa nemení', ()=>{
  const OLD=[['en','withdraw from contract here','confirm withdrawal'],['de','Vertrag widerrufen','Widerruf bestätigen'],
    ['sk','odstúpiť od zmluvy tu','potvrdiť odstúpenie od zmluvy'],['cs','zde odstoupit od smlouvy','potvrdit odstoupení od smlouvy'],
    ['pl','odstąp od umowy tutaj','potwierdź odstąpienie od umowy'],['fr','renoncer au contrat ici','confirmer la rétractation'],
    ['it','recedere dal contratto qui','conferma recesso'],['es','desistir del contrato aquí','confirmar desistimiento'],
    ['nl','hier de overeenkomst herroepen','herroeping bevestigen']];
  assert.deepEqual(Object.keys(WITHDRAWAL_LABELS),OLD.map(x=>x[0]));
  for(const [lang,label,confirm] of OLD){
    for(const [text,kind] of [[label,'function'],[confirm,'confirm'],[label.toUpperCase(),'function']]){
      const r=w(report(odkaz(text)));
      assert.equal(r.status,'found',text);assert.deepEqual([r.found[0].kind,r.found[0].lang],[kind,lang],text);
    }
  }
  // Tvar konštanty: jazyk má pár alebo zoznam párov; prvý pár angličtiny je smernica, druhý Írsko.
  assert.deepEqual(WITHDRAWAL_LABELS.en.map(p=>[...p]),[['withdraw from contract here','confirm withdrawal'],['cancel contract here','confirm cancellation']]);
  assert.ok(Object.isFrozen(WITHDRAWAL_LABELS.en)&&WITHDRAWAL_LABELS.en.every(Object.isFrozen));
  for(const k of Object.keys(WITHDRAWAL_LABELS).filter(k=>k!=='en'))assert.equal(typeof WITHDRAWAL_LABELS[k][0],'string',k);
});

test('218: EU_UI netvrdí nič nepravdivé o počte jazykov (9 jazykov smernice, zoznam zhodný s WITHDRAWAL_LABELS)', ()=>{
  assert.equal(Object.keys(WITHDRAWAL_LABELS).length,9);
  assert.match(EU_UI.en.rules.eu_withdrawal.notFound,/English, German, Slovak, Czech, Polish, French, Italian, Spanish and Dutch\./);
  assert.match(EU_UI.sk.rules.eu_withdrawal.notFound,/slovenčine, češtine, angličtine, nemčine, poľštine, francúzštine, taliančine, španielčine a holandčine\./);
  assert.match(EU_UI.de.rules.eu_withdrawal.notFound,/Deutsch, Englisch, Slowakisch, Tschechisch, Polnisch, Französisch, Italienisch, Spanisch und Niederländisch\./);
  // Stránky 220 (de, en) už netvrdia, že kontrola írske alebo rakúske znenie nepozná.
  assert.ok(!/not recognised/.test(euTexty('en').rules.eu_withdrawal.notFound));
  assert.match(euTexty('en').rules.eu_withdrawal.notFound,/“cancel contract here” or “confirm cancellation”/);
  assert.ok(!/erkennt die Prüfung nicht/.test(euTexty('de').rules.eu_withdrawal.notFound));
  assert.match(euTexty('de').rules.eu_withdrawal.notFound,/als ähnlichen Link/);
});

/* ---------- (2) Shoptet bez odkazu na stránku objednávky ---------- */

const ST='<link href="https://cdn.myshoptet.com/tpl/webs/12/master/dist/css/shoptet.css" rel="stylesheet">';

test('218 jadro: eu_withdrawal nesie platform „shoptet“ len so signálom Shoptetu, v každom stave; iné pravidlá ho nemajú', ()=>{
  const bez=report(ST+'<p>x</p>');
  assert.equal(w(bez).status,'not_found');assert.equal(w(bez).platform,'shoptet');assert.deepEqual(w(bez).orderPage,[]);
  assert.equal(w(report(ST+'<a href="/moja-objednavka/">Odstúpenie od zmluvy</a>')).status,'link_found');
  assert.equal(w(report(ST+'<a href="/moja-objednavka/">Odstúpenie od zmluvy</a>')).platform,'shoptet');
  assert.equal(w(report(ST+odkaz('Odstúpiť od zmluvy tu'))).platform,'shoptet');
  for(const r of bez.eu.rules.slice(1))assert.ok(!Object.hasOwn(r,'platform'),r.code);
  // Bez signálu (iná platforma, zmienka „Shoptet“ v texte) pole chýba.
  for(const home of ['<p>x</p>','<p>Beží na Shoptet, shoptet.sk</p><a href="/moja-objednavka/">Moja objednávka</a>'])
    assert.ok(!Object.hasOwn(w(report(home)),'platform'),home);
});

test('218 výsledok (EN, SK, DE): Shoptet bez odkazu na stránku objednávky má vetu hneď po notFound a ručnú kontrolu s cestou v administrácii', ()=>{
  const rep=report(ST+'<p>x</p>');
  for(const lang of LANGS){const t=EU_UI[lang],x=t.rules.eu_withdrawal,v=euView(rep.eu,t)[0];
    assert.deepEqual(v.lines,[{text:x.notFound},{text:x.shoptetNoLink}],lang);
    assert.equal(v.manual,x.manualShoptetNoLink,lang);
    assert.equal(v.badge,x.status.not_found,lang);assert.equal(v.tone,'review',lang);
    assert.ok(!NEVER.test(JSON.stringify(v)),lang);}
  // Umami ostáva bez zmeny (stavy, review).
  assert.deepEqual(euEvent(rep.eu,'sk'),{lang:'sk',withdrawal:'not_found',notice:'not_found',claims:'unknown',review:2});
});

test('218 výsledok: s podobným odkazom „Overte odkaz“, veta o Shoptete pred podobným odkazom (rozhodnutie Fable)', ()=>{
  const rep=report(ST+'<a href="/vratenie-tovaru/">Vrátenie tovaru</a>');
  assert.equal(w(rep).similar.length,1);assert.deepEqual(w(rep).orderPage,[]);
  for(const lang of LANGS){const t=EU_UI[lang],x=t.rules.eu_withdrawal,v=euView(rep.eu,t)[0];
    assert.deepEqual(v.lines.map(l=>l.text),[x.notFound,x.shoptetNoLink,x.similar.replace('{label}','Vrátenie tovaru').replace('{page}',t.pages.home)],lang);
    assert.equal(v.lines[1].muted,undefined,lang);assert.equal(v.lines[2].muted,true,lang);
    assert.equal(v.badge,x.status.check,lang);assert.equal(v.tone,'unknown',lang);assert.equal(v.manual,x.manualShoptetNoLink,lang);}
});

test('218 výsledok: veta o Shoptete nie je pri link_found, found, odkaze „Moja objednávka“ ani bez signálu Shoptetu', ()=>{
  const pripady=[[ST+'<a href="/moja-objednavka/">Odstúpenie od zmluvy</a>','link_found','manualLinkFound'],
    [ST+odkaz('Odstúpiť od zmluvy tu'),'found','manualFound'],
    [ST+'<a href="/moja-objednavka/">Moja objednávka</a>','not_found','manualOrderPage'],
    ['<p>x</p>','not_found','manualNotFound']];
  for(const [home,status,manual] of pripady)for(const lang of LANGS){
    const t=EU_UI[lang],x=t.rules.eu_withdrawal,v=euView(report(home).eu,t)[0];
    assert.equal(v.status,status,home);assert.ok(!v.lines.some(l=>l.text===x.shoptetNoLink),lang+' '+home);assert.equal(v.manual,x[manual],lang+' '+home);}
  // Exportovaná podmienka sama: len eu_withdrawal, not_found, presne 'shoptet', bez odkazu objednávky a s textom.
  const x=EU_UI.sk.rules.eu_withdrawal,ok={code:'eu_withdrawal',status:'not_found',platform:'shoptet'};
  assert.equal(shoptetBezOdkazu(ok,x,0),true);
  for(const [r,t,n] of [[{...ok,status:'link_found'},x,0],[{...ok,status:'found'},x,0],[{...ok,status:'unknown'},x,0],[{...ok,code:'eu_guarantee_notice'},x,0],
    [{...ok,platform:'Shoptet'},x,0],[ok,x,1],[ok,{},0],[null,x,0]])assert.equal(shoptetBezOdkazu(r,t,n),false,JSON.stringify([r,n]));
  // Iná platforma v správe (budúca, neznáma) vetu nedostane.
  const rep=report('<p>x</p>'),eu={...rep.eu,rules:[{...w(rep),platform:'shopify'},...rep.eu.rules.slice(1)]};
  assert.ok(!euView(eu,EU_UI.sk)[0].lines.some(l=>l.text===EU_UI.sk.rules.eu_withdrawal.shoptetNoLink));
});

test('218 výsledok: starý i18n.mjs z vyrovnávacej pamäte bez nových kľúčov ukáže ako doteraz, nikdy undefined; odkaz objednávky sa počíta zo správy', ()=>{
  const rep=report(ST+'<p>x</p>'),mojaRep=report(ST+'<a href="/moja-objednavka/">Moja objednávka</a>');
  for(const lang of LANGS){
    const t=structuredClone(EU_UI[lang]),x=t.rules.eu_withdrawal;delete x.shoptetNoLink;delete x.manualShoptetNoLink;
    const v=euView(rep.eu,t)[0];
    assert.deepEqual(v.lines,[{text:x.notFound}],lang);assert.equal(v.manual,x.manualNotFound,lang);assert.ok(!NEVER.test(JSON.stringify(v)),lang);
    // Len manualShoptetNoLink chýba: veta áno, ručná kontrola všeobecná.
    const t2=structuredClone(EU_UI[lang]);delete t2.rules.eu_withdrawal.manualShoptetNoLink;
    assert.equal(euView(rep.eu,t2)[0].manual,t2.rules.eu_withdrawal.manualNotFound,lang);
    // i18n bez orderPage, správa s odkazom „Moja objednávka“: veta „odkaz sme nenašli“ by klamala, preto sa neukáže.
    const t3=structuredClone(EU_UI[lang]);delete t3.rules.eu_withdrawal.orderPage;delete t3.rules.eu_withdrawal.manualOrderPage;
    assert.deepEqual(euView(mojaRep.eu,t3)[0].lines,[{text:t3.rules.eu_withdrawal.notFound}],lang);
  }
});

test('218 texty Shoptetu: bez pomlčiek em a en, nemecky Sie, cesta, stránka Moja objednávka, nápis podľa zákona a lehota', ()=>{
  for(const lang of LANGS){const x=EU_UI[lang].rules.eu_withdrawal;
    for(const k of ['shoptetNoLink','manualShoptetNoLink']){const s=x[k];
      assert.equal(typeof s,'string',lang+' '+k);assert.ok(!/[–—]/.test(s),lang+' '+k);assert.match(s,/Shoptet/);assert.match(s,/\/moja-objednavka\//);assert.match(s,/Moja objednávka/);}
    assert.match(x.shoptetNoLink,/\/moje-objednavka\//,lang);}
  // Brána 218 V2: postup začína Externým odkazom s nápisom podľa zákona (prvý krok nesmie viesť do stavu, ktorý kontrola sama označí
  // za nedostatočný: systémová stránka s názvom „Moja objednávka“ dostane riadok orderPage), až potom veta, že systémovú stránku
  // premenovať nemožno.
  const sk=EU_UI.sk.rules.eu_withdrawal.manualShoptetNoLink;
  assert.match(sk,/Vzhľad a obsah → Menu → Pridať, typ položky Externý odkaz/);assert.match(sk,/\/moja-objednavka\//);
  assert.ok(sk.indexOf('Externý odkaz')<sk.indexOf('Systémové stránky'),'najprv externý odkaz');
  assert.match(sk,/„Odstúpiť od zmluvy tu“/);
  assert.match(sk,/Nastavenia → Objednávky → Ostatné nastavenia/);
  assert.match(EU_UI.sk.rules.eu_withdrawal.shoptetNoLink,/zabudovanú/);
  assert.match(EU_UI.en.rules.eu_withdrawal.manualShoptetNoLink,/Menu section/);assert.match(EU_UI.en.rules.eu_withdrawal.manualShoptetNoLink,/“withdraw from contract here”/);
  assert.match(EU_UI.de.rules.eu_withdrawal.manualShoptetNoLink,/\bSie\b/);assert.match(EU_UI.de.rules.eu_withdrawal.manualShoptetNoLink,/„Vertrag widerrufen“/);
  assert.match(EU_UI.de.rules.eu_withdrawal.manualShoptetNoLink,/Widerrufsfrist/);
  // EN a DE: externý odkaz pred zmienkou o systémovej stránke (oba texty musia byť v postupe, inak by indexOf -1 prešiel).
  const pred=(t,a,b,popis)=>{assert.ok(t.includes(a)&&t.includes(b),popis+': '+a+' / '+b);assert.ok(t.indexOf(a)<t.indexOf(b),popis);};
  pred(EU_UI.en.rules.eu_withdrawal.manualShoptetNoLink,'external link','“Moja objednávka”','en');
  pred(EU_UI.de.rules.eu_withdrawal.manualShoptetNoLink,'externen Link','„Moja objednávka“','de');
  pred(sk,'Externý odkaz','Systémové stránky','sk');
});

test('218 brána D7 a D8: funkciu zákazník otvorí cez stránku Moja objednávka (nie je „na“ nej); veta menuje aj maďarskú cestu /rendelesem/', ()=>{
  const vety={sk:[EU_UI.sk.rules.eu_withdrawal.shoptetNoLink,/zabudovanú; zákazník ju otvorí cez systémovú stránku Moja objednávka/,/zabudovanú na systémovej stránke/,/v maďarskom \/rendelesem\//],
    en:[EU_UI.en.rules.eu_withdrawal.shoptetNoLink,/built in; customers open it through the system page “Moja objednávka”/,/built in, on the system page/,/in Hungarian \/rendelesem\//],
    de:[EU_UI.de.rules.eu_withdrawal.shoptetNoLink,/eingebaut; Kunden öffnen sie über die Systemseite „Moja objednávka“/,/eingebaut, auf der Systemseite/,/auf Ungarisch \/rendelesem\//],
    cs:[euTexty('cs').rules.eu_withdrawal.shoptetNoLink,/vestavěnou; zákazník ji otevře přes systémovou stránku Moje objednávka/,/vestavěnou na systémové stránce/,/na maďarském \/rendelesem\//]};
  for(const [lang,[veta,nova,stara,hu]] of Object.entries(vety)){
    assert.match(veta,nova,lang);assert.ok(!stara.test(veta),lang+': staré znenie');assert.match(veta,hu,lang);
    assert.ok(!/[–—]/.test(veta),lang);}
  // Cesty sú tie, ktoré jadro pozná ako stránku objednávky Shoptetu (core.mjs ORDER_PAGES).
  for(const cesta of ['/moja-objednavka','/moje-objednavka','/rendelesem'])for(const [lang,[veta]] of Object.entries(vety))assert.ok(veta.includes(cesta+'/'),lang+' '+cesta);
});

/* ---------- stránky 213 a 220 (kontrola-povinnosti): tá istá veta v jazyku stránky ---------- */

test('218 stránky 213 a 220 (sk, cs, de, en): Shoptet bez odkazu má vetu a postup v jazyku stránky, bez podmienenej poznámky', ()=>{
  const data=report(ST+'<p>x</p>');
  for(const lang of ['sk','cs','de','en']){const x=euTexty(lang).rules.eu_withdrawal,m=K.vyhodnot(K.pravidloZ(data,'eu_withdrawal'),lang);
    assert.equal(typeof x.shoptetNoLink,'string',lang);
    assert.deepEqual(m.lines.map(l=>l.text),[x.notFound,x.shoptetNoLink],lang);
    assert.equal(m.manual,x.manualShoptetNoLink,lang);assert.equal(m.shoptet,null,lang);
    assert.equal(m.tone,'review',lang);assert.equal(m.badge,x.status.not_found,lang);
    assert.ok(!/[–—]/.test(x.shoptetNoLink+x.manualShoptetNoLink),lang);}
  // sk, de, en slovo od slova ako celá kontrola; čeština vlastná, s českou cestou v administrácii.
  for(const lang of ['sk','de','en'])assert.equal(euTexty(lang).rules.eu_withdrawal.shoptetNoLink,EU_UI[lang].rules.eu_withdrawal.shoptetNoLink,lang);
  const cs=euTexty('cs').rules.eu_withdrawal;
  assert.match(cs.shoptetNoLink,/Moje objednávka \(\/moje-objednavka\/, na slovenském Shoptetu \/moja-objednavka\/, na maďarském \/rendelesem\/\)/);
  // Brána 218 V2: najprv Externí odkaz s nápisom podľa zákona, potom systémová stránka.
  assert.match(cs.manualShoptetNoLink,/Vzhled a obsah → Menu → Přidat, typ položky Externí odkaz/);assert.match(cs.manualShoptetNoLink,/\/moje-objednavka\//);
  assert.ok(cs.manualShoptetNoLink.indexOf('Externí odkaz')<cs.manualShoptetNoLink.indexOf('Systémové stránky'),'najprv externí odkaz');
  assert.match(cs.manualShoptetNoLink,/Nastavení → Objednávky → Ostatní nastavení/);
  assert.match(cs.manualShoptetNoLink,/„Odstoupit od smlouvy“/);
});

test('218 stránky 213 a 220: s podobným odkazom veta tiež, pri odkaze „Moja objednávka“ a bez signálu Shoptetu nie (podmienená poznámka ostáva)', ()=>{
  const pod=report(ST+'<a href="/vratenie-tovaru/">Vrátenie tovaru</a>');
  for(const lang of ['sk','cs','de','en']){const x=euTexty(lang).rules.eu_withdrawal,m=K.vyhodnot(K.pravidloZ(pod,'eu_withdrawal'),lang);
    assert.equal(m.lines[1].text,x.shoptetNoLink,lang);assert.equal(m.badge,x.status.check,lang);assert.equal(m.manual,x.manualShoptetNoLink,lang);}
  const moja=report(ST+'<a href="/moja-objednavka/">Moja objednávka</a>'),nic=report('<p>x</p>');
  for(const lang of ['sk','cs','de','en']){const x=euTexty(lang).rules.eu_withdrawal;
    const a=K.vyhodnot(K.pravidloZ(moja,'eu_withdrawal'),lang),b=K.vyhodnot(K.pravidloZ(nic,'eu_withdrawal'),lang);
    assert.ok(!a.lines.some(l=>l.text===x.shoptetNoLink),lang);assert.equal(a.manual,x.manualOrderPage,lang);
    assert.ok(!b.lines.some(l=>l.text===x.shoptetNoLink),lang);assert.equal(b.manual,x.manualNotFound,lang);
    // Bez dôkazu platformy ostáva podmienená poznámka „Ak obchod beží na Shoptete…“ (sk, cs) ako doteraz.
    assert.equal(b.shoptet,texty(lang).shoptet??null,lang);}
});

test('218 brána D6: anglická stránka 220 pri nájdenom írskom nápise cituje aj § 115A Consumer Rights Act 2022 (S.I. No. 309/2026); iné jazyky a celá kontrola bez zmeny', ()=>{
  const IE=['section 115A of the Consumer Rights Act 2022, inserted by S.I. No. 309 of 2026 (Ireland)','https://www.irishstatutebook.ie/eli/2026/si/309/made/en/print'];
  const ie=report(odkaz('Cancel contract here')),m=K.vyhodnot(K.pravidloZ(ie,'eu_withdrawal'),'en');
  assert.equal(m.status,'found');assert.equal(m.tone,'ok');
  // Smernica ostáva prvá, írsky predpis za ňou (veta „Law: Art. 11a…“ už nie je jediná).
  assert.deepEqual(m.law,[...EU_UI.en.rules.eu_withdrawal.law.map(([t,h])=>[t,h]),IE]);
  assert.ok(!/[–—]/.test(IE[0]));
  // Ten istý zoznam pri nenájdenom nápise (anglická veta notFound írske znenie menuje).
  assert.deepEqual(K.vyhodnot(K.pravidloZ(report(),'eu_withdrawal'),'en').law.at(-1),IE);
  // sk, cs, de bez írskeho predpisu; nemecký zákon ostáva prvý; EU_UI (celá kontrola a Stráž) sa nemení.
  for(const lang of ['sk','cs','de'])assert.ok(!K.vyhodnot(K.pravidloZ(ie,'eu_withdrawal'),lang).law.some(([t])=>/115A/.test(t)),lang);
  assert.ok(K.vyhodnot(K.pravidloZ(ie,'eu_withdrawal'),'de').law[0][0].startsWith('§ 356a BGB'));
  assert.ok(!EU_UI.en.rules.eu_withdrawal.law.some(([t])=>/115A/.test(t)),'EU_UI bez írskeho predpisu');
  // Záruka v angličtine írsky predpis nedostane; euTexty vracia vždy nové pole.
  assert.ok(!euTexty('en').rules.eu_guarantee_notice.law.some(([t])=>/115A/.test(t)));
  const a=euTexty('en').rules.eu_withdrawal.law;a.push(['x','https://x.example']);a[a.length-2][0]='zmenené';
  assert.deepEqual(euTexty('en').rules.eu_withdrawal.law.at(-1),IE);
});
