// Testy Stráže e-shopu (relácia 209, 22. 10. 2026): node --test products/arling-sk/straz-eshopu/app.test.mjs
// Čistá logika app.mjs (stavový automat, adresy, návrat, polling s falošnými hodinami, sanitizácia, Umami),
// logika navrat.mjs zo starej stránky monitora a statické kontroly troch stránok (CSP, noindex, hreflang, texty).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import * as A from './app.mjs';
import vm from 'node:vm';
import {TEXTY} from './texty.mjs?v=5';
import * as N from '../feed-doctor/monitor/navrat.mjs';
import {EU_UI,localRule} from '../feed-doctor/agent-ready/i18n.mjs?v=2';
import {toneOf,EU_CODES} from '../feed-doctor/agent-ready/eu-zobraz.mjs';
import {RULES} from '../feed-doctor/agent-ready/core.mjs';
import {createLatest} from '../feed-doctor/agent-ready/controller.mjs';

const ID='3f2b8c1e-9a4d-4e2b-8f6a-1c2d3e4f5a6b',KEY='a'.repeat(64),ID2='m_1761130000000_abc123';
const zdroje={EU_UI,toneOf,EU_CODES,RULES,localRule};
const subor=p=>readFileSync(fileURLToPath(new URL(p,import.meta.url)),'utf8');
function pamat(){const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),m};}
const zlomena={getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');}};

test('rezim: bez id a key predaj, s platnými správa, s neúplnými alebo zlými chyba', ()=>{
  assert.equal(A.rezim(A.parametre('')),'predaj');
  assert.equal(A.rezim(A.parametre(`?id=${ID}&key=${KEY}`)),'sprava');
  assert.equal(A.rezim(A.parametre(`?id=${ID2}&key=${KEY}&paid=1`)),'sprava');
  assert.equal(A.rezim(A.parametre(`?id=${ID}`)),'chyba');
  assert.equal(A.rezim(A.parametre(`?id=${ID}&key=${'A'.repeat(64)}`)),'chyba');
  assert.equal(A.rezim(A.parametre(`?id=${encodeURIComponent('x"><img src=x onerror=alert(1)>')}&key=${KEY}`)),'chyba');
  assert.equal(A.parametre(`?id=${ID}&key=${KEY}&paid=1`).paid,true);
  assert.equal(A.parametre(`?id=${ID}&key=${KEY}&paid=true`).paid,false);
});

test('test režim: ?test=1 sa zapíše, z úložiska platí aj bez parametra, pri teste sa nemeria, zlé úložisko nevyhodí', ()=>{
  const s=pamat();
  assert.deepEqual(A.testRezim('?test=1',s),{test:true,merat:false});
  assert.equal(s.getItem('straz:test'),'1');
  assert.deepEqual(A.testRezim('',s),{test:true,merat:false});
  assert.deepEqual(A.testRezim('',pamat()),{test:false,merat:true});
  assert.deepEqual(A.testRezim('?test=0',pamat()),{test:false,merat:false});
  assert.deepEqual(A.testRezim('?test=1',zlomena),{test:true,merat:false});
  assert.deepEqual(A.testRezim('',null),{test:false,merat:true});
});

test('ponuka: len live === true alebo test; iný tvar stav.json ju skryje', ()=>{
  assert.equal(A.ponukaViditelna({live:true},false),true);
  assert.equal(A.ponukaViditelna({live:false},false),false);
  assert.equal(A.ponukaViditelna({live:'true'},false),false);
  assert.equal(A.ponukaViditelna([{live:true}],false),false);
  assert.equal(A.ponukaViditelna(null,false),false);
  assert.equal(A.ponukaViditelna(null,true),true);
});

test('stav.json: chyba, 404, zlý JSON aj pomalá odpoveď dajú null; prvé nasadenie má live false', async ()=>{
  assert.deepEqual(await A.nacitajStav(async()=>({ok:true,json:async()=>({live:true})})),{live:true});
  assert.equal(await A.nacitajStav(async()=>{throw new Error('net');}),null);
  assert.equal(await A.nacitajStav(async()=>({ok:false,json:async()=>({live:true})})),null);
  assert.equal(await A.nacitajStav(async()=>({ok:true,json:async()=>{throw new SyntaxError('x');}})),null);
  let spust;const pomaly=A.nacitajStav(()=>new Promise(()=>{}),'/x',4000,fn=>{spust=fn;});spust();
  assert.equal(await pomaly,null);
  assert.deepEqual(JSON.parse(subor('./stav.json')),{live:false});
});

test('adresa obchodu: voľný vstup, výstup presne (pôvod s https), nebezpečné a súkromné adresy odmietne', ()=>{
  assert.equal(A.normalizujObchod('vas-obchod.sk'),'https://vas-obchod.sk/');
  assert.equal(A.normalizujObchod('  https://Vas-Obchod.sk/kategoria?x=1 '),'https://vas-obchod.sk/');
  assert.equal(A.normalizujObchod('http://obchod.sk'),'https://obchod.sk/');
  assert.equal(A.normalizujObchod('https://www.obchod.cz:443/'),'https://www.obchod.cz/');
  for(const zle of ['','javascript:alert(1)','https://user:pw@obchod.sk','localhost','https://obchod.sk:8080','ftp://obchod.sk','https://127.0.0.1','obchod sk','https://x'])
    assert.equal(A.normalizujObchod(zle),null,zle);
});

test('feed: nepovinný, prázdny = bez feedu, inak verejná http(s) adresa', ()=>{
  assert.equal(A.normalizujFeed(''),'');
  assert.equal(A.normalizujFeed('   '),'');
  assert.equal(A.normalizujFeed('https://obchod.sk/export/productsComplete.xml?hash=abc'),'https://obchod.sk/export/productsComplete.xml?hash=abc');
  assert.equal(A.normalizujFeed('http://obchod.sk/feed.xml'),'http://obchod.sk/feed.xml');
  assert.equal(A.normalizujFeed('obchod.sk/feed.xml'),'https://obchod.sk/feed.xml');
  for(const zle of ['javascript:alert(1)','data:text/xml,<a/>','https://u:p@obchod.sk/f','ftp://obchod.sk/f','https://intranet/f'])assert.equal(A.normalizujFeed(zle),null,zle);
});

test('formulár: chyby v poradí polí, telo podľa zmluvy POST /v1/straz', ()=>{
  assert.deepEqual(A.pripravTelo({obchod:'',email:'zle',feed:'ftp://x.sk',lang:'sk',test:false}).chyby,['store_url','email','feed_url']);
  assert.deepEqual(A.pripravTelo({obchod:'obchod.sk',email:' ja@obchod.sk ',feed:'',lang:'xx',test:true}),
    {chyby:[],telo:{store_url:'https://obchod.sk/',email:'ja@obchod.sk',lang:'sk',feed_url:'',test:true}});
  assert.equal(A.pripravTelo({obchod:'obchod.sk',email:'ja@obchod.sk',feed:'',lang:'de',test:'1'}).telo.test,false);
  assert.equal(A.platnyEmail('a@b'),null);assert.equal(A.platnyEmail('a b@c.sk'),null);assert.equal(A.platnyEmail('<a@b.sk>'),null);
  assert.equal(A.platnyEmail('x'.repeat(250)+'@b.sk'),null);
});

test('checkout: len https://buy.stripe.com/, inak sa nepresmeruje', ()=>{
  assert.equal(A.bezpecnyCheckout('https://buy.stripe.com/8x214he2mbOj1Sq2hL4ko05?client_reference_id=x'),'https://buy.stripe.com/8x214he2mbOj1Sq2hL4ko05?client_reference_id=x');
  assert.equal(A.bezpecnyCheckout('https://buy.stripe.com/test_abc'),'https://buy.stripe.com/test_abc');
  for(const zle of ['https://buy.stripe.com.zle.sk/x','http://buy.stripe.com/x','javascript:alert(1)','https://a@buy.stripe.com/x','//buy.stripe.com/x',null,42])assert.equal(A.bezpecnyCheckout(zle),null,String(zle));
});

test('odpoveď POST /v1/straz: úspech len s platným id, key a checkout; chyby 400, 409, 429, 503 a ostatné', ()=>{
  const dobre={id:ID,key:KEY,checkout_url:'https://buy.stripe.com/x?client_reference_id='+ID,plan:'free',status:'pending_payment'};
  assert.deepEqual(A.vysledokOdoslania(201,dobre),{ok:true,id:ID,key:KEY,checkout:dobre.checkout_url});
  assert.equal(A.vysledokOdoslania(200,dobre).ok,true);
  assert.equal(A.vysledokOdoslania(201,{...dobre,checkout_url:'https://zle.sk/'}).chyba,'server');
  assert.equal(A.vysledokOdoslania(201,{...dobre,key:'kratky'}).chyba,'server');
  assert.equal(A.vysledokOdoslania(201,null).chyba,'server');
  assert.deepEqual(A.vysledokOdoslania(400,{error:'validation_failed',issues:[{field:'email'},'store_url: invalid']}),{ok:false,chyba:'validation',polia:['store_url','email']});
  assert.deepEqual(A.vysledokOdoslania(400,{issues:[{path:'feed_url'}]}).polia,['feed_url']);
  assert.deepEqual(A.vysledokOdoslania(400,{issues:'zle'}).polia,[]);
  assert.equal(A.vysledokOdoslania(409,{error:'already_active',message:'x'}).chyba,'already_active');
  assert.equal(A.vysledokOdoslania(409,{error:'iny'}).chyba,'server');
  assert.equal(A.vysledokOdoslania(429,{}).chyba,'rate');
  assert.equal(A.vysledokOdoslania(503,null).chyba,'unavailable');
  assert.equal(A.vysledokOdoslania(500,null).chyba,'server');
});

test('každý kód chyby a pole má text v SK, EN aj DE', ()=>{
  for(const l of A.JAZYKY){
    for(const k of ['validation','already_active','rate','unavailable','network','server'])assert.ok(TEXTY[l].form.chyby[k],l+k);
    for(const k of ['store_url','email','feed_url'])assert.ok(TEXTY[l].form.polia[k],l+k);
    for(const k of Object.keys(TEXTY.sk.sprava.hlasenia))assert.ok(TEXTY[l].sprava.hlasenia[k],l+k);
    for(const k of Object.keys(TEXTY.sk.sprava))assert.ok(TEXTY[l].sprava[k]!=null,l+k);
    for(const k of ['nenajdene','nedostupne','chybaNacitania','siet'])assert.ok(TEXTY[l].sprava[k],l+k);
  }
});

test('návrat: záznam pred odchodom na Stripe má tvar {id,key,lang,at} a zlý tvar sa neuloží', ()=>{
  const z=JSON.parse(A.navratZaznam(ID,KEY,'de',new Date('2026-10-22T10:00:00Z')));
  assert.deepEqual(z,{id:ID,key:KEY,lang:'de',at:'2026-10-22T10:00:00.000Z'});
  assert.equal(JSON.parse(A.navratZaznam(ID,KEY,'fr')).lang,'sk');
  assert.equal(A.navratZaznam('zle',KEY,'sk'),null);
  assert.equal(A.navratZaznam(ID,'',"sk"),null);
  // Rovnaký zápis musí vedieť prečítať navrat.mjs na starej stránke.
  assert.deepEqual(N.precitajNavrat(A.navratZaznam(ID,KEY,'en',new Date(1000)),2000),{id:ID,key:KEY,lang:'en'});
});

test('adresy: cesta podľa jazyka, parametre zakódované, paid sa odstráni a ostatné ostanú', ()=>{
  assert.equal(A.cestaStraze('sk'),'/straz-eshopu/');assert.equal(A.cestaStraze('en'),'/straz-eshopu/en/');assert.equal(A.cestaStraze('xx'),'/straz-eshopu/');
  assert.equal(A.adresaStatusu('a/b','k&y'),'https://feed-monitor.arling.workers.dev/v1/monitors/a%2Fb?key=k%26y');
  assert.equal(A.adresaAkcie(ID,KEY,'cancel'),`https://feed-monitor.arling.workers.dev/v1/monitors/${ID}/cancel?key=${KEY}`);
  assert.equal(A.adresaAgentReady(ID,KEY,true),`https://feed-monitor.arling.workers.dev/v1/agent-ready/monitors/${ID}/run?key=${KEY}`);
  assert.equal(A.bezPaid(`https://arling.sk/straz-eshopu/de/?id=${ID}&key=${KEY}&paid=1&test=1#zmazat`),`/straz-eshopu/de/?id=${ID}&key=${KEY}&test=1#zmazat`);
});

test('stav monitora: overený tvar a plán (pro, zrušené pro, čaká na platbu, free)', ()=>{
  assert.equal(A.platnyStav({id:ID,plan:'pro'},ID),true);
  assert.equal(A.platnyStav({id:'iny',plan:'pro'},ID),false);
  assert.equal(A.platnyStav([],ID),false);
  assert.equal(A.planStav({plan:'pro',cancel_at:null}),'pro');
  assert.equal(A.planStav({plan:'pro',cancel_at:'2026-11-22T10:00:00Z'}),'pro_zrusene');
  assert.equal(A.planStav({plan:'free',status:'pending_payment'}),'caka');
  assert.equal(A.planStav({plan:'free',status:'active'}),'free');
  assert.match(A.datum('2026-11-22T10:00:00Z','sk'),/22.*2026/);
  assert.equal(A.datum('zle','sk'),'');assert.equal(A.datum(null,'en'),'');
});

test('sanitizácia: text zo servera len ako reťazec bez riadiacich znakov, čísla len v rozsahu', ()=>{
  assert.equal(A.cistyText('<b>obchod</b>\u0000\n  x'),'<b>obchod</b> x');
  assert.equal(A.cistyText({toString(){return 'zle';}}),'');
  assert.equal(A.cistyText('x'.repeat(500),10).length,10);
  const w=A.weeklyStav({status:'done',at:'2026-10-22T05:00:00Z',score:120,coverage:'80',eu:'x',failing:null});
  assert.deepEqual([w.score,w.coverage,w.eu,w.failing,w.changed],[null,null,[],[],[]]);
  assert.equal(A.weeklyStav({status:'hotovo'}),null);
  assert.equal(A.weeklyStav(null),null);
  const h=A.historiaFeedu(Array.from({length:12},(_,i)=>({date:'2026-10-'+String(i+1).padStart(2,'0'),score:90+i,error:i,warning:-1})));
  assert.equal(h.length,10);assert.equal(h[0].datum,'2026-10-12');assert.equal(h[0].upozornenia,null);
  assert.deepEqual(A.historiaFeedu('zle'),[]);
  assert.equal(A.produktTehoIstehoObchodu('https://obchod.sk/p/1','https://obchod.sk/'),'https://obchod.sk/p/1');
  assert.equal(A.produktTehoIstehoObchodu('https://iny.sk/p/1','https://obchod.sk/'),'');
  assert.equal(A.produktTehoIstehoObchodu('javascript:alert(1)','https://obchod.sk/'),'');
});

test('EÚ nálezy cez eu-zobraz.mjs a i18n.mjs: známe kódy a stavy, tón, neznáme sa zahodia', ()=>{
  const r=A.euRiadky([{code:'eu_green_claims',state:'found'},{code:'eu_withdrawal',state:'not_found'},{code:'eu_guarantee_notice',state:'vymyslene'},{code:'<script>',state:'found'}],'sk',zdroje);
  assert.deepEqual(r.map(x=>x.code),['eu_withdrawal','eu_green_claims']);
  assert.equal(r[0].tone,'review');assert.equal(r[1].tone,'review');
  assert.equal(r[0].title,EU_UI.sk.rules.eu_withdrawal.title);
  assert.equal(r[0].badge,EU_UI.sk.rules.eu_withdrawal.status.not_found);
  assert.equal(A.euRiadky([{code:'eu_guarantee_notice',state:'not_applicable'}],'de',zdroje)[0].tone,'ok');
  assert.deepEqual(A.euRiadky('zle','sk',zdroje),[]);
});

test('pravidlá a zmeny cez RULES z core.mjs: neznáme a duplicitné kódy sa zahodia, poradie podľa váhy', ()=>{
  const kody=RULES.slice(0,3).map(r=>r.code);
  const out=A.nazvyPravidiel([...kody,kody[0],'neexistuje',{code:kody[1]},7],'sk',zdroje);
  assert.equal(out.length,3);
  const vahy=out.map(o=>RULES.find(r=>r.code===o.code).weight||0);
  assert.deepEqual(vahy,[...vahy].sort((a,b)=>b-a));
  const i=RULES.findIndex(r=>r.code===out[0].code);assert.equal(out[0].title,localRule(RULES[i],i,'sk').title);
});

test('zmeny podľa smeru (S drobné): Pokazilo sa a Opravilo sa podľa weekly.changed {code, from, to} ako v e-maile', ()=>{
  const zmeny=[
    {code:'policy_shipping',from:'pass',to:'fail'},            // pravidlo sa pokazilo
    {code:'jsonld_offer',from:null,to:'fail'},                  // nové zlyhanie bez minulého stavu
    {code:'policy_returns',from:'fail',to:'pass'},              // opravilo sa
    {code:'llms',from:'pass',to:'unknown'},                     // iná zmena: v e-maile nie je, tu tiež nie
    {code:'eu_guarantee_notice',from:'found',to:'not_found'},   // EÚ ok -> review: pokazilo sa
    {code:'eu_withdrawal',from:'not_found',to:'found'},         // EÚ review -> ok: opravilo sa
    {code:'eu_green_claims',from:'vymyslene',to:'found'},       // neznámy stav sa zahodí
    'policy_contact',{code:'neexistuje',from:'pass',to:'fail'},{code:'policy_shipping',from:'pass',to:'fail'}];
  const z=A.zmenyPodlaSmeru(zmeny,'sk',zdroje);
  assert.deepEqual(z.pokazene.map(x=>x.code),['policy_shipping','jsonld_offer','eu_guarantee_notice']);
  assert.deepEqual(z.opravene.map(x=>x.code),['policy_returns','eu_withdrawal']);
  assert.equal(z.pokazene[2].title,EU_UI.sk.rules.eu_guarantee_notice.title);
  const i=RULES.findIndex(r=>r.code==='policy_returns');assert.equal(z.opravene[0].title,localRule(RULES[i],i,'sk').title);
  assert.deepEqual(A.zmenyPodlaSmeru('zle','sk',zdroje),{pokazene:[],opravene:[]});
  for(const l of A.JAZYKY)assert.ok(TEXTY[l].sprava.pokaziloNadpis&&TEXTY[l].sprava.opraviloNadpis);
});

function hodiny(){let t=0;return {now:()=>t,spi:async ms=>{t+=ms;},posun:ms=>{t+=ms;}};}

test('polling po platbe: pri pro skončí hneď, inak GET každé 3 s najviac 120 s', async ()=>{
  const h=hodiny();let volania=0;
  const r=await A.cakajNaPro({nacitaj:async()=>(++volania<3?{plan:'free',status:'pending_payment'}:{plan:'pro'}),now:h.now,spi:h.spi});
  assert.equal(r.vysledok,'pro');assert.equal(volania,3);assert.equal(h.now(),6000);
  const h2=hodiny();const casy=[];
  const r2=await A.cakajNaPro({nacitaj:async()=>{casy.push(h2.now());return {plan:'free'};},now:h2.now,spi:h2.spi});
  assert.equal(r2.vysledok,'cas');assert.deepEqual(r2.data,{plan:'free'});
  assert.equal(casy.length,41);assert.equal(casy.at(-1),120000);assert.ok(casy.every((c,i)=>c===i*3000));
});

test('polling: chyba siete pokračuje, priStave dostane každý stav, zrušenie zastaví bez ďalšieho volania', async ()=>{
  const h=hodiny();let n=0;const videne=[];
  const r=await A.cakajNaPro({nacitaj:async()=>{n++;if(n===1)throw new Error('net');if(n===2)return null;return {plan:'pro'};},now:h.now,spi:h.spi,priStave:d=>videne.push(d.plan)});
  assert.equal(r.vysledok,'pro');assert.deepEqual(videne,['pro']);
  let aktualne=true,m=0;
  const r2=await A.cakajNaPro({nacitaj:async()=>{m++;aktualne=false;return {plan:'pro'};},now:hodiny().now,spi:async()=>{},aktualne:()=>aktualne});
  assert.equal(r2.vysledok,'zrusene');assert.equal(m,1);
  // Pomalá odpoveď, ktorá príde až po limite, sa ešte vyhodnotí, ďalšie volanie už nepríde.
  const h3=hodiny();let k=0;
  const r3=await A.cakajNaPro({nacitaj:async()=>{k++;h3.posun(130000);return {plan:'free'};},now:h3.now,spi:h3.spi});
  assert.equal(r3.vysledok,'cas');assert.equal(k,1);
});

test('stará odpoveď neprepíše novšiu (createLatest z agent-ready/controller.mjs)', async ()=>{
  const latest=createLatest(),zobrazene=[];
  async function nacitaj(hodnota,ms){const req=latest.begin();await new Promise(r=>setTimeout(r,ms));if(req.current())zobrazene.push(hodnota);return req.signal.aborted;}
  const [prvaZrusena,druhaZrusena]=await Promise.all([nacitaj('stara',30),nacitaj('nova',5)]);
  assert.deepEqual(zobrazene,['nova']);assert.equal(prvaZrusena,true);assert.equal(druhaZrusena,false);
});

test('ar_straz_paid raz za monitor; bez úložiska sa nevyhodí výnimka', ()=>{
  const s=pamat();
  assert.equal(A.zaplateneRaz(s,ID),true);assert.equal(A.zaplateneRaz(s,ID),false);assert.equal(A.zaplateneRaz(s,ID2),true);
  assert.equal(A.zaplateneRaz(zlomena,ID),true);
});

test('Umami: v teste nič, pred načítaním do fronty, po načítaní odoslanie, pri správe adresa bez kľúča, nikdy výnimka', async ()=>{
  const w1={};const t1=A.createTracker(w1,{merat:false});
  assert.equal(await t1.track('ar_straz_offer_view',{lang:'sk',place:'page'}),false);assert.equal(w1.__strazFronta,undefined);
  const w2={},t2=A.createTracker(w2,{merat:true});
  await t2.track('ar_straz_offer_view',{lang:'sk',place:'page'});
  assert.equal(w2.__strazFronta.length,1);
  const poslane=[];w2.umami={track:(n,d)=>{poslane.push([n,d]);}};t2.flush();
  assert.deepEqual(poslane,[['ar_straz_offer_view',{lang:'sk',place:'page'}]]);assert.equal(w2.__strazFronta.length,0);
  assert.equal(await t2.track('ar_straz_subscribe_click',{lang:'sk',place:'page'}),true);
  const w3={location:{pathname:'/straz-eshopu/en/',search:`?id=${ID}&key=${KEY}`},umami:{track:fn=>{w3.payload=fn({website:'w',url:'/straz-eshopu/en/?id=x&key=y',referrer:'r'});}}};
  await A.createTracker(w3,{merat:true,cista:true}).track('ar_straz_paid',{lang:'en'});
  assert.deepEqual(w3.payload,{website:'w',url:'/straz-eshopu/en/',referrer:'',name:'ar_straz_paid',data:{lang:'en'}});
  const w4={umami:{track:()=>{throw new Error('umami');}}};
  assert.equal(await A.createTracker(w4,{merat:true}).track('x',{}),false);
});

/* ---------------- navrat.mjs ---------------- */
test('navrat.mjs: záznam platí 24 h, z budúcnosti a zlého tvaru sa zahodí', ()=>{
  const at=Date.parse('2026-10-22T10:00:00Z'),raw=JSON.stringify({id:ID,key:KEY,lang:'de',at:'2026-10-22T10:00:00Z'});
  assert.deepEqual(N.precitajNavrat(raw,at+N.MAX_VEK),{id:ID,key:KEY,lang:'de'});
  assert.equal(N.precitajNavrat(raw,at+N.MAX_VEK+1),null);
  assert.equal(N.precitajNavrat(raw,at-10*60*1000),null);
  assert.equal(N.precitajNavrat('{zle',at),null);
  assert.equal(N.precitajNavrat(null,at),null);
  assert.equal(N.precitajNavrat(JSON.stringify({id:'../x',key:KEY,at:'2026-10-22T10:00:00Z'}),at),null);
  assert.equal(N.precitajNavrat(JSON.stringify({id:ID,key:KEY,lang:'fr',at:'2026-10-22T10:00:00Z'}),at).lang,'en');
});

test('navrat.mjs: ?paid=1 bez id a key presmeruje na Stráž v jazyku záznamu a zachová test=1', ()=>{
  const now=Date.parse('2026-10-22T10:05:00Z'),raw=N.zaznamNavratu(ID,KEY,'sk',new Date('2026-10-22T10:00:00Z'));
  assert.equal(N.cielPoPlatbe('?paid=1',raw,now),`/straz-eshopu/?id=${ID}&key=${KEY}&paid=1`);
  assert.equal(N.cielPoPlatbe('?paid=1&test=1&session_id=cs_test_x',N.zaznamNavratu(ID,KEY,'en',new Date(now)),now),`/straz-eshopu/en/?id=${ID}&key=${KEY}&paid=1&test=1`);
  assert.equal(N.cielPoPlatbe('',raw,now),null);
  assert.equal(N.cielPoPlatbe(`?paid=1&id=${ID}&key=${KEY}`,raw,now),null);
  assert.equal(N.cielPoPlatbe('?paid=1&demo=1',raw,now),null);
  assert.equal(N.cielPoPlatbe('?paid=1',null,now),null);
});

test('navrat.mjs: monitor s plánom pro alebo zo Stráže ide na stránku Stráže, bezplatný feed monitor ostane', ()=>{
  const s=`?id=${ID}&key=${KEY}`;
  assert.equal(N.cielPreMonitor(s,{id:ID,plan:'pro',lang:'de'}),`/straz-eshopu/de/?id=${ID}&key=${KEY}`);
  assert.equal(N.cielPreMonitor(s+'&paid=1&test=1',{id:ID,plan:'free',source:'straz',lang:'sk'}),`/straz-eshopu/?id=${ID}&key=${KEY}&paid=1&test=1`);
  assert.equal(N.cielPreMonitor(s,{id:ID,plan:'pro'}),`/straz-eshopu/en/?id=${ID}&key=${KEY}`);
  assert.equal(N.cielPreMonitor(s,{id:ID,plan:'free',source:null}),null);
  assert.equal(N.cielPreMonitor(s,{id:'iny',plan:'pro'}),null);
  assert.equal(N.cielPreMonitor(`?id=${ID}&key=zly`,{id:ID,plan:'pro'}),null);
  assert.equal(N.cielPreMonitor(s,null),null);
});

test('navrat.mjs: zápis pri kliku na upgrade overí tvar id a kľúča regexom', ()=>{
  const z=JSON.parse(N.zaznamNavratu(ID2,KEY,'en',new Date('2026-10-22T10:00:00Z')));
  assert.deepEqual(z,{id:ID2,key:KEY,lang:'en',at:'2026-10-22T10:00:00.000Z'});
  assert.equal(N.zaznamNavratu(ID,KEY.slice(1),'en'),null);
  assert.equal(N.zaznamNavratu(`${ID}"`,KEY,'en'),null);
  assert.equal(N.zaznamNavratu(null,null,'en'),null);
  assert.equal(N.ID_RE.source,A.ID_RE.source);assert.equal(N.KEY_RE.source,A.KEY_RE.source);
});

/* ---------------- statické kontroly stránok ---------------- */
const STRANKY=[['sk','./index.html','https://arling.sk/straz-eshopu/','/feed-doctor/agent-ready/sk/','/privacy/#s4','/podmienky/','Príklad'],
  ['en','./en/index.html','https://arling.sk/straz-eshopu/en/','/feed-doctor/agent-ready/','/privacy/en/#s4','/podmienky/en/','Example'],
  ['de','./de/index.html','https://arling.sk/straz-eshopu/de/','/feed-doctor/agent-ready/de/','/privacy/de/#s4','/podmienky/de/','Beispiel']];

for(const [lang,cesta,canonical,zadarmo,sukromie,podmienky,priklad] of STRANKY){
  test(`stránka ${lang}: noindex, canonical, hreflang, CSP, rám, odkazy a texty`, ()=>{
    const t=subor(cesta);
    assert.match(t,new RegExp(`<html lang="${lang}">`));
    assert.match(t,/<meta name="robots" content="noindex">/);
    assert.ok(t.includes(`<link rel="canonical" href="${canonical}">`));
    for(const [h,u] of [['sk','https://arling.sk/straz-eshopu/'],['en','https://arling.sk/straz-eshopu/en/'],['de','https://arling.sk/straz-eshopu/de/'],['x-default','https://arling.sk/straz-eshopu/en/']])
      assert.ok(t.includes(`<link rel="alternate" hreflang="${h}" href="${u}">`),h);
    const csp=t.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
    assert.match(csp,/connect-src [^;]*https:\/\/feed-monitor\.arling\.workers\.dev/);
    assert.match(csp,/form-action 'none'/);assert.doesNotMatch(csp,/unsafe-inline/);
    // Každý vložený skript (načítavač a JSON-LD) musí mať odtlačok v CSP; iné vložené skripty nie sú.
    const vlozene=[...t.matchAll(/<script(?: type="application\/ld\+json")?>([\s\S]*?)<\/script>/g)];
    assert.equal(vlozene.length,3);
    for(const [,obsah] of vlozene)assert.ok(csp.includes(`'sha256-${createHash('sha256').update(obsah,'utf8').digest('base64')}'`));
    for(const [,obsah] of vlozene.slice(1))JSON.parse(obsah);
    assert.ok(t.includes('"price":"9.00","priceCurrency":"EUR"')&&t.includes('"@type":"FAQPage"'));
    assert.doesNotMatch(t,/\sstyle="/);assert.doesNotMatch(t,/\son[a-z]+="/);
    assert.ok(t.includes('<script type="text/plain" data-odlozene="module" src="/straz-eshopu/app.mjs?v=4"></script>'));
    assert.ok(t.includes('/straz-eshopu/straz.css?v=4')&&t.includes('<h1 id="st-nadpis">'));
    assert.ok(t.includes(`/style/menu-${lang}.js`));assert.ok(t.includes('class="site-footer"'));
    assert.ok(t.includes(`href="${zadarmo}"`));assert.ok(t.includes(`href="${sukromie}"`));assert.ok(t.includes(`href="${podmienky}"`));
    assert.ok(t.includes(`<p class="st-priklad-stitok">${priklad}</p>`));
    assert.ok(t.includes('Sold through Link, LLC')&&t.includes('Feed Doctor Monitor'));
    for(const id of ['predaj','sprava','straz-form','st-obchod','st-email','st-feed','st-odoslat','st-stav','st-chyba','st-test','objednat'])assert.ok(t.includes(`id="${id}"`),id);
    assert.match(t,/<form id="straz-form"[^>]* data-ponuka hidden/);assert.match(t,/data-coskoro hidden/);
    const faq=(t.match(/<details><summary>/g)||[]).length;assert.ok(faq>=4&&faq<=6,String(faq));
    const main=t.slice(t.indexOf('<main'),t.indexOf('</main>'));
    assert.doesNotMatch(main,/[–—]/);
  });
}

test('texty.mjs a app.mjs bez pomlčiek em a en', ()=>{
  for(const p of ['./texty.mjs','./app.mjs','../feed-doctor/monitor/navrat.mjs'])assert.doesNotMatch(subor(p),/[–—]/,p);
});

test('stará stránka monitora: navrat.mjs načítaný, tlačidlo Shop Guard, odtlačok vloženého modulu sedí s CSP', ()=>{
  const t=subor('../feed-doctor/monitor/index.html');
  // Nález brány 4: skutočný tvar je odložený načítavač (type text/plain, data-odlozene module), nie priamy modul.
  assert.ok(t.includes('<script type="text/plain" data-odlozene="module" src="/feed-doctor/monitor/navrat.mjs?v=2"></script>'));
  assert.ok(!t.includes('<script type="module" src="/feed-doctor/monitor/navrat.mjs'));
  assert.ok(t.includes('>Upgrade to Shop Guard, 9 EUR / month</a>'));assert.ok(!t.includes('Upgrade to Pro, 9 EUR'));
  const csp=t.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
  for(const [,obsah] of t.matchAll(/<script(?: type="module")?>([\s\S]*?)<\/script>/g))
    assert.ok(csp.includes(`'sha256-${createHash('sha256').update(obsah,'utf8').digest('base64')}'`));
  // Načítavač, ktorý z data-odlozene="module" urobí type module, je vložený skript s odtlačkom v CSP; bez neho by navrat.mjs nebežal.
  const nacitavac=[...t.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(x=>x.includes('arlingNacitavac'));
  assert.ok(nacitavac,'načítavač chýba');
  assert.ok(nacitavac.includes(`getAttribute('data-odlozene')==='module')s.type='module'`));
  assert.ok(csp.includes(`'sha256-${createHash('sha256').update(nacitavac,'utf8').digest('base64')}'`),'odtlačok načítavača nie je v CSP');
  assert.ok(t.indexOf('<script>'+nacitavac)<t.indexOf('navrat.mjs?v=2'));
});

// Relácia 205 (23. 10. 2026): znenie zásad sa po 22. 10. zmenilo (odsek #vysledok-emailom), preto dátum 22. 10. 2026 alebo neskôr.
test('zásady súkromia časť 4: veta o Stráži v SK, EN, DE a dátum znenia od 22. 10. 2026', ()=>{
  for(const [p,veta,datum] of [['../privacy/index.html','Stráž e-shopu je platený plán',/Znenie z (2[2-9]|3[01])\. októbra 2026|Znenie z \d{1,2}\. (novembra|decembra) 2026/],
    ['../privacy/en/index.html','Shop Guard is the paid plan',/Version of (2[2-9]|3[01]) October 2026|Version of \d{1,2} (November|December) 2026/],
    ['../privacy/de/index.html','Der Shop-Wächter ist der kostenpflichtige Tarif',/Fassung vom (2[2-9]|3[01])\. Oktober 2026|Fassung vom \d{1,2}\. (November|Dezember) 2026/]]){
    const t=subor(p),s4=t.slice(t.indexOf('<h2 id="s4"'),t.indexOf('<h2 id="s5"'));
    assert.ok(s4.includes(veta),p);assert.ok(/Stripe/.test(s4),p);assert.match(t,datum,p);
  }
});

test('zásady súkromia časť 4 (Z2): nezaplatené objednávky Stráže sa zmažú po 7 dňoch, v SK, EN aj DE', ()=>{
  for(const [p,veta] of [['../privacy/index.html','Nezaplatené objednávky Stráže (e-mail, adresu obchodu a feedu) zmažeme po 7 dňoch.'],
    ['../privacy/en/index.html','Unpaid Shop Guard orders (the e-mail and the store and feed addresses) are deleted after 7 days.'],
    ['../privacy/de/index.html','Nicht bezahlte Bestellungen des Shop-Wächters (E-Mail-Adresse, Shop- und Feed-Adresse) löschen wir nach 7 Tagen.']]){
    const t=subor(p),s4=t.slice(t.indexOf('<h2 id="s4"'),t.indexOf('<h2 id="s5"'));
    assert.ok(s4.includes(veta),p);assert.doesNotMatch(s4,/[–—]/,p);
  }
});

/* ---------------- kolo 1 opráv: čistá logika ---------------- */
test('Z2: prev_id a prev_key z localStorage straz:navrat len pri zázname mladšom ako 24 h a platnom tvare', ()=>{
  const at=Date.parse('2026-10-22T10:00:00Z'),raw=A.navratZaznam(ID,KEY,'sk',new Date(at));
  assert.deepEqual(A.predoslyNavrat(raw,at+60000),{prev_id:ID,prev_key:KEY});
  assert.deepEqual(A.predoslyNavrat(raw,at+A.NAVRAT_MAX_VEK-1),{prev_id:ID,prev_key:KEY});
  assert.equal(A.predoslyNavrat(raw,at+A.NAVRAT_MAX_VEK),null);
  assert.equal(A.predoslyNavrat(raw,at-10*60*1000),null);
  for(const zle of [null,'{zle',JSON.stringify({id:'../x',key:KEY,at:'2026-10-22T10:00:00Z'}),JSON.stringify({id:ID,key:'k',at:'2026-10-22T10:00:00Z'}),JSON.stringify({id:ID,key:KEY})])
    assert.equal(A.predoslyNavrat(zle,at),null,String(zle));
  const s=pripravTeloPre({predosly:A.predoslyNavrat(raw,at)});
  assert.equal(s.prev_id,ID);assert.equal(s.prev_key,KEY);
  assert.ok(!('prev_id' in pripravTeloPre({predosly:null})));
  assert.ok(!('prev_id' in pripravTeloPre({predosly:{prev_id:'zle',prev_key:KEY}})));
});
function pripravTeloPre(x){return A.pripravTelo({obchod:'obchod.sk',email:'ja@obchod.sk',feed:'',lang:'sk',test:false,...x}).telo;}

test('Z1: 403 test_not_allowed má vlastnú vetu v SK, EN, DE (testovací režim je len pre ARLing)', ()=>{
  assert.deepEqual(A.vysledokOdoslania(403,{error:'test_not_allowed'}),{ok:false,chyba:'test_not_allowed',polia:[]});
  assert.equal(A.vysledokOdoslania(403,{error:'iny'}).chyba,'server');
  assert.match(TEXTY.sk.form.chyby.test_not_allowed,/len pre ARLing/);
  assert.match(TEXTY.en.form.chyby.test_not_allowed,/only for ARLing/);
  assert.match(TEXTY.de.form.chyby.test_not_allowed,/nur für ARLing/);
});

test('história feedu: celý ISO čas zo servera sa ukáže ako dátum podľa jazyka, nikdy orezaný ISO reťazec', ()=>{
  // W4: stĺpec Produkty namiesto Skóre; skóre feedu sa do bunky nikdy nedostane.
  const h=A.historiaFeedu([{date:'2026-10-22T05:00:00.000Z',score:91,error:2,warning:0,products:7}]);
  assert.equal(h[0].datum,'2026-10-22T05:00:00.000Z');
  assert.deepEqual(A.bunkyHistorie(h[0],'sk'),['22. 10. 2026','7','2','0']);
  assert.deepEqual(A.bunkyHistorie(h[0],'de'),['22.10.2026','7','2','0']);
  assert.ok(!A.bunkyHistorie(h[0],'sk').includes('91'));
  assert.equal(A.bunkyHistorie(h[0],'en')[0],'22/10/2026');
  for(const l of A.JAZYKY)assert.doesNotMatch(A.bunkyHistorie(h[0],l)[0],/T05|\.$/);
  assert.equal(A.bunkyHistorie({datum:'zle',skore:null,chyby:null,upozornenia:null},'sk')[0],'zle');
  assert.match(A.datumCas('2026-10-22T12:05:00Z','sk'),/22\. 10\. 2026.*14:05/);
  assert.equal(A.datumCas('zle','sk'),'');
});

const S_SK=TEXTY.sk.sprava;
test('Z4: Skontrolovať obchod teraz: hotovo len pri fresh true, stará správa s dátumom, 429 s dátumom poslednej kontroly', ()=>{
  assert.deepEqual(A.vysledokKontroly(200,{status:'done',fresh:true,report:{at:'2026-10-22T10:00:00Z'}},'sk',S_SK),{text:S_SK.hlasenia.kontrolaHotova,obnov:true});
  const stara=A.vysledokKontroly(200,{status:'done',report:{at:'2026-10-20T10:00:00Z'}},'sk',S_SK);
  assert.equal(stara.chyba,true);assert.ok(stara.text.includes(A.datum('2026-10-20T10:00:00Z','sk')));assert.notEqual(stara.text,S_SK.hlasenia.kontrolaHotova);
  assert.equal(A.vysledokKontroly(200,{status:'running'},'sk',S_SK).neskor,true);
  assert.equal(A.vysledokKontroly(200,{status:'failed'},'sk',S_SK).text,S_SK.hlasenia.kontrolaZlyhala);
  const limit=A.vysledokKontroly(429,{error:'rate_limited',last_at:'2026-10-22T12:05:00Z'},'sk',S_SK);
  assert.ok(limit.text.includes(A.datumCas('2026-10-22T12:05:00Z','sk')));assert.equal(limit.chyba,true);
  assert.equal(A.vysledokKontroly(429,{error:'rate_limited'},'sk',S_SK).text,S_SK.hlasenia.kontrolaLimit);
  assert.equal(A.vysledokKontroly(500,null,'sk',S_SK),null);
});

test('zmazanie podľa odpovede servera: subscription_cancelled false a 502 nikdy ako tiché „zmazané“', ()=>{
  assert.deepEqual(A.vysledokZmazania(200,{ok:true,subscription_cancelled:true}),{zmazane:true,nezrusene:false});
  assert.deepEqual(A.vysledokZmazania(200,{ok:true,subscription_cancelled:false}),{zmazane:true,nezrusene:true});
  assert.deepEqual(A.vysledokZmazania(200,null),{zmazane:true,nezrusene:false});
  assert.deepEqual(A.vysledokZmazania(404,null),{zmazane:true,nezrusene:false});
  assert.deepEqual(A.vysledokZmazania(502,{error:'subscription_cancel_failed'}),{zmazane:false,portal:true});
  assert.equal(A.vysledokZmazania(500,null),null);
});

test('Z5: kontakt podľa jazyka, SK podpora@arling.sk, EN a DE support@arling.sk (texty aj stránky)', ()=>{
  const sk=JSON.stringify(TEXTY.sk),en=JSON.stringify(TEXTY.en),de=JSON.stringify(TEXTY.de);
  assert.ok(sk.includes('podpora@arling.sk')&&!sk.includes('support@arling.sk'));
  for(const x of [en,de])assert.ok(x.includes('support@arling.sk')&&!x.includes('podpora@arling.sk'));
  for(const [p,ok,zle] of [['./index.html','podpora@','support@'],['./en/index.html','support@','podpora@'],['./de/index.html','support@','podpora@']]){
    const t=subor(p);assert.ok(t.includes(ok+'arling.sk'),p);assert.ok(!t.includes(zle+'arling.sk'),p);
  }
});

test('nové texty kola 1 existujú v SK, EN aj DE a nemajú pomlčky em ani en', ()=>{
  for(const l of A.JAZYKY){
    const s=TEXTY[l].sprava;
    for(const k of ['skoreNull','skoreNullVysvetlenie','zmazatVetaZrusit'])assert.ok(s[k],l+k);
    for(const k of ['kontrolaStara','kontrolaZlyhala','kontrolaLimitDatum','zmazaneNezrusene','zmazanieZlyhalo'])assert.ok(s.hlasenia[k],l+k);
    assert.ok(s.paid.netrebaZnova&&TEXTY[l].coskoroNadpis,l);
    assert.doesNotMatch(s.zmazatVeta,/Zrušiť predplatné|Cancel the subscription|Abo kündigen/,l);
    assert.doesNotMatch(TEXTY[l].form.polia.feed_url,/začínajúca|starting with|mit https/,l);
  }
});

const PRIKLAD={sk:['./index.html','https://vas-obchod.sk/','podpora@arling.sk'],en:['./en/index.html','https://your-shop.com/','support@arling.sk'],de:['./de/index.html','https://ihr-shop.de/','support@arling.sk']};
test('príklad e-mailu na stránke je presne výstup reportEmail z workera (predmet, Pokazilo sa, Opravilo sa, bez vety o minulej stránke)', async ()=>{
  const {reportEmail}=await import('../../feed-doctor/monitor/src/mail.js');
  for(const [lang,[cesta,obchod,kontakt]] of Object.entries(PRIKLAD)){
    const t=subor(cesta),fig=t.slice(t.indexOf('<figure class="st-priklad">'),t.indexOf('</figure>'));
    const telo=fig.slice(fig.indexOf('<div class="st-priklad-telo">'),fig.indexOf('</div>'));
    const riadky=[...telo.matchAll(/<(p|li)>([\s\S]*?)<\/\1>/g)].map(m=>m[2].replace(/<[^>]+>/g,'').trim());
    const m=reportEmail({lang,storeUrl:obchod,first:false,summary:{score:78,coverage:90,failing:[],eu:[]},previousScore:71,broke:[{code:'eu_guarantee_notice'}],fixed:[{code:'policy_shipping'}],manageUrl:'https://arling.sk/straz-eshopu/?id=x&key=y'});
    // Blok odkazu „štítok:\nadresa“ sa na stránke ukazuje so štítkom a opisom odkazu; kontakt podľa Z5.
    const ocakavane=m.text.split('\n\n').flatMap(b=>b.startsWith('- ')?b.split('\n').map(x=>x.slice(2)):b.includes('\nhttps://')?[b.split('\n')[0]]:[b]).map(x=>x.replace(/(podpora|support)@arling\.sk/g,kontakt));
    assert.equal(riadky.length,ocakavane.length,lang+': '+riadky.join(' | '));
    for(let i=0;i<riadky.length;i++)assert.ok(riadky[i].startsWith(ocakavane[i]),`${lang} ${i}: ${riadky[i]} / ${ocakavane[i]}`);
    assert.equal(fig.match(/<p class="st-priklad-hlava"><span>[^<]+<\/span> ([^<]+)<\/p>/)[1],m.subject,lang);
    assert.doesNotMatch(fig,/Minule bolo|Last time it was|Beim letzten Mal stand/);
  }
});

test('predajná stránka (Z3): pri údajoch pre AI veta, že sa hodnotia pri čitateľných produktových stránkach', ()=>{
  for(const [p,veta] of [['./index.html','Hodnotíme ich, keď na obchode nájdeme čitateľné produktové stránky'],['./en/index.html','We evaluate this data when we find readable product pages'],['./de/index.html','wenn wir in Ihrem Shop lesbare Produktseiten finden']]){
    const t=subor(p),bod=t.slice(t.indexOf('<ol class="st-body">'),t.indexOf('</ol>'));assert.ok(bod.includes(veta),p);
  }
});

test('straz.css: sekcie prebíjajú body.noc section, história ostáva tabuľkou do 600 px, ciele dotyku 44 px, tlačidlá Nastavení pod sebou', ()=>{
  const c=subor('./straz.css');
  for(const r of ['.ar-page .st-sekcia{padding:36px 0 0}','.ar-page .st-blok{padding:28px 0 0}','.ar-page .st-sprava{padding:0;border-top:0}','.ar-page .st-faq{padding:36px 0 0}',
    '.ar-page .st-spat a{display:inline-flex;align-items:center;min-height:44px}','.ar-page .st-sukromie a{color:var(--ink);padding:11px 0}',
    '.ar-page .st-nastavenia>button,.ar-page .st-zmazat button{flex:1 1 100%}','.ar-page .st-blok>h3+button{margin-top:12px}','.ar-page .st-suma{margin-top:12px}'])
    assert.ok(c.includes(r),r);
  const m600=c.slice(c.indexOf('@media(max-width:600px){'));
  for(const r of ['.ar-page .st-tabulka tr{display:table-row','.ar-page .st-tabulka td::before{content:none','.ar-page .st-tabulka thead{display:table-header-group}'])assert.ok(m600.includes(r),r);
  assert.match(c,/\.st-form\{[^}]*margin-top:20px/);
});

/* ---------------- kolo 1 opráv: správa a predaj v DOM (falošný DOM, bez prehliadača a siete) ---------------- */
const pockaj=(ms=30)=>new Promise(r=>setTimeout(r,ms));
function falosnyDom(){
  const doc={activeElement:null};
  class E{
    constructor(tag){
      this.tagName=String(tag).toUpperCase();this.childNodes=[];this.parentNode=null;this.attrs=new Map();this.dataset={};this.hidden=false;
      this.className='';this.id='';this.listeners={};this._t='';this.disabled=false;this.value='';this.href='';
      const ja=this;this.classList={add:(...c)=>{const s=new Set(ja.className.split(/\s+/).filter(Boolean));for(const x of c)s.add(x);ja.className=[...s].join(' ');},contains:c=>ja.className.split(/\s+/).includes(c)};
    }
    get textContent(){return this.tagName==='#TEXT'?this._t:this.childNodes.map(c=>c.textContent).join('');}
    set textContent(v){for(const c of this.childNodes)c.parentNode=null;this.childNodes=[];const s=String(v??'');if(s)this.append(s);}
    append(...xs){for(let x of xs){if(typeof x==='string'){const t=new E('#text');t._t=x;x=t;}if(x.parentNode)x.parentNode.childNodes.splice(x.parentNode.childNodes.indexOf(x),1);x.parentNode=this;this.childNodes.push(x);}}
    replaceChildren(...xs){for(const c of this.childNodes)c.parentNode=null;this.childNodes=[];this.append(...xs);}
    insertBefore(n,ref){if(n.parentNode)n.parentNode.childNodes.splice(n.parentNode.childNodes.indexOf(n),1);const i=this.childNodes.indexOf(ref);n.parentNode=this;this.childNodes.splice(i<0?this.childNodes.length:i,0,n);}
    setAttribute(k,v){this.attrs.set(k,String(v));}getAttribute(k){return this.attrs.has(k)?this.attrs.get(k):null;}removeAttribute(k){this.attrs.delete(k);}
    addEventListener(t,f){(this.listeners[t]??=[]).push(f);}
    fire(t){const ev={type:t,target:this,preventDefault(){}};for(const f of this.listeners[t]||[])f(ev);}
    click(){this.fire('click');}
    focus(){doc.activeElement=this;}scrollIntoView(){this.posunute=true;}
    closest(sel){let n=this;while(n){if(sel.startsWith('.')&&n.classList?.contains(sel.slice(1)))return n;n=n.parentNode;}return null;}
    get isConnected(){let n=this;while(n.parentNode)n=n.parentNode;return n===doc.documentElement;}
    *vsetky(){for(const c of this.childNodes)if(c.tagName!=='#TEXT'){yield c;yield* c.vsetky();}}
    querySelectorAll(sel){const m=/^\[data-([a-z-]+)(?:="([^"]*)")?\]$/.exec(sel);if(!m)throw new Error('selektor '+sel);const k=m[1].replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
      return [...this.vsetky()].filter(e=>Object.hasOwn(e.dataset,k)&&(m[2]===undefined||e.dataset[k]===m[2]));}
    querySelector(sel){return this.querySelectorAll(sel)[0]||null;}
  }
  doc.documentElement=new E('html');doc.body=new E('body');doc.documentElement.append(doc.body);
  doc.createElement=t=>new E(t);
  doc.getElementById=id=>[...doc.documentElement.vsetky()].find(e=>e.id===id)||null;
  doc.querySelectorAll=s=>doc.documentElement.querySelectorAll(s);
  doc.el=(tag,vlastnosti={},rodic=doc.body)=>{const e=new E(tag);const {dataset,...ine}=vlastnosti;Object.assign(e,ine);if(dataset)Object.assign(e.dataset,dataset);rodic.append(e);return e;};
  doc.vsetky=()=>[...doc.documentElement.vsetky()];
  return doc;
}
/** Globály prehliadača pre jeden test; router(z, doc) vráti {status, data} pre každé volanie fetch. */
function prostredie({search='',pathname='/straz-eshopu/',router,ulozene={}}){
  const doc=falosnyDom(),volania=[],nahradene=[],pam=pamat();
  for(const [k,v] of Object.entries(ulozene))pam.setItem(k,v);
  const mena=['document','location','history','localStorage','fetch','addEventListener'],povodne=Object.fromEntries(mena.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  const nastav=(k,v)=>Object.defineProperty(globalThis,k,{value:v,configurable:true,writable:true});
  nastav('document',doc);
  nastav('location',{pathname,search,hash:'',href:'https://arling.sk'+pathname+search,hostname:'localhost',assign:u=>volania.push({assign:u})});
  nastav('history',{replaceState:(a,b,u)=>nahradene.push(u)});
  nastav('localStorage',pam);nastav('addEventListener',()=>{});
  nastav('fetch',async(url,init={})=>{
    const z={url:String(url),method:init.method||'GET',body:init.body?JSON.parse(init.body):undefined};volania.push(z);
    const r=(await router(z,doc))||{status:404,data:{error:'not_found'}};const status=r.status??200;
    return {ok:status>=200&&status<300,status,json:async()=>{if(r.data===undefined)throw new SyntaxError('bez tela');return r.data;}};
  });
  return {doc,volania,nahradene,pam,obnov(){for(const k of mena){if(povodne[k])Object.defineProperty(globalThis,k,povodne[k]);else delete globalThis[k];}}};
}
const zaklad=(x={})=>({id:ID,plan:'pro',status:'active',cancel_at:null,store_url:'https://obchod.sk/',feed_url:'',email_masked:'j***@obchod.sk',mail_off:false,lang:'sk',source:'straz',weekly:null,history:[],
  upgrade_url:`https://buy.stripe.com/live_x?client_reference_id=${ID}`,upgrade_url_test:`https://buy.stripe.com/test_x?client_reference_id=${ID}`,...x});
const odkazyNaPlatbu=doc=>doc.vsetky().filter(e=>e.tagName==='A'&&String(e.href).startsWith('https://buy.stripe.com/'));
const tlacidloS=(doc,text)=>doc.vsetky().find(e=>e.tagName==='BUTTON'&&e.textContent===text&&e.isConnected);
const tichyTracker=()=>A.createTracker({},{merat:false});
async function spravaPre(search,router,{opt={},lang='sk',test=false,ulozene,nadpis=false}={}){
  const env=prostredie({search,router,ulozene});
  if(nadpis)env.h1=env.doc.el('h1',{id:'st-nadpis',textContent:TEXTY[lang].nazov});
  env.doc.el('div',{id:'predaj'});env.doc.el('section',{id:'sprava',hidden:true});
  env.beh=A.spustSpravu(TEXTY[lang],lang,A.parametre(search),{test,merat:false},tichyTracker(),opt);
  await env.beh;await pockaj(20);
  return env;
}

test('blokujúci S: paid=1 a čakajúci monitor: počas overovania ani po vypršaní 120 s nie je odkaz na buy.stripe.com, len veta netreba platiť znova', async ()=>{
  const h=hodiny(),pohlady=[];
  const env=await spravaPre(`?id=${ID}&key=${KEY}&paid=1&test=1`,(z,doc)=>{
    if(z.url.includes('/paid-return'))return {data:{ok:true,plan:'free'}};
    if(z.method==='GET'&&z.url.includes(`/v1/monitors/${ID}?`)){pohlady.push({odkazy:odkazyNaPlatbu(doc).length,text:doc.body.textContent});return {data:zaklad({plan:'free',status:'pending_payment'})};}
  },{test:true,opt:{interval:3000,limit:9000,now:h.now,spi:async ms=>{h.posun(ms);await pockaj(15);}}});
  try{
    const t3=TEXTY.sk.sprava.paid;
    assert.equal(pohlady.length,4);
    assert.ok(pohlady.every(p=>p.odkazy===0),JSON.stringify(pohlady.map(p=>p.odkazy)));
    assert.ok(pohlady.slice(1).some(p=>p.text.includes(t3.netrebaZnova)),'počas overovania sa ukáže veta');
    assert.equal(odkazyNaPlatbu(env.doc).length,0);
    const text=env.doc.body.textContent;
    assert.ok(text.includes(t3.netrebaZnova)&&text.includes(t3.caka));
    assert.ok(!text.includes(TEXTY.sk.sprava.dokoncitPlatbu)&&!text.includes(TEXTY.sk.sprava.cakaVeta));
    assert.equal(env.volania.filter(z=>z.url.includes('/paid-return')).length,1);
  }finally{env.obnov();}
});

test('paid=1 pri bezplatnom monitore z feed monitora (plan free, active): ani výzva Zapnúť Stráž, kým sa platba neoverí', async ()=>{
  const h=hodiny();
  const env=await spravaPre(`?id=${ID}&key=${KEY}&paid=1`,z=>{
    if(z.url.includes('/paid-return'))return {data:{ok:true,plan:'free'}};
    if(z.method==='GET')return {data:zaklad({plan:'free',status:'active',source:null})};
  },{opt:{interval:3000,limit:3000,now:h.now,spi:async ms=>{h.posun(ms);await pockaj(15);}}});
  try{assert.equal(odkazyNaPlatbu(env.doc).length,0);assert.ok(!env.doc.body.textContent.includes(TEXTY.sk.sprava.zapnutStraz));}
  finally{env.obnov();}
});

test('bez paid=1 čakajúci monitor ponúka dokončenie platby (odkaz ostáva) a paid=1 s pro ukáže zapnutie bez odkazu', async ()=>{
  let env=await spravaPre(`?id=${ID}&key=${KEY}`,z=>z.method==='GET'?{data:zaklad({plan:'free',status:'pending_payment'})}:null);
  try{assert.equal(odkazyNaPlatbu(env.doc).length,1);assert.ok(env.doc.body.textContent.includes(TEXTY.sk.sprava.dokoncitPlatbu));}finally{env.obnov();}
  const h=hodiny();let n=0;
  env=await spravaPre(`?id=${ID}&key=${KEY}&paid=1`,z=>z.method==='GET'?{data:++n<2?zaklad({plan:'free',status:'pending_payment'}):zaklad()}:null,{opt:{now:h.now,spi:async ms=>{h.posun(ms);await pockaj(15);}}});
  try{
    assert.equal(odkazyNaPlatbu(env.doc).length,0);assert.ok(env.doc.body.textContent.includes(TEXTY.sk.sprava.paid.zapnute));
    assert.deepEqual(env.nahradene,[`/straz-eshopu/?id=${ID}&key=${KEY}`]);
  }finally{env.obnov();}
});

async function zmazVSprave(odpoved){
  const env=await spravaPre(`?id=${ID}&key=${KEY}`,z=>{if(z.method==='DELETE')return odpoved;if(z.method==='GET')return {data:zaklad()};});
  tlacidloS(env.doc,S_SK.zmazat).click();
  tlacidloS(env.doc,S_SK.zmazatAno).click();await pockaj(30);
  return env;
}
test('zmazanie: 200 so subscription_cancelled false povie, že predplatné beží, s odkazom na portál Stripe', async ()=>{
  const env=await zmazVSprave({status:200,data:{ok:true,subscription_cancelled:false,message:'x'}});
  try{
    const text=env.doc.body.textContent;assert.ok(text.includes(S_SK.hlasenia.zmazane)&&text.includes(S_SK.hlasenia.zmazaneNezrusene));
    assert.ok(env.doc.vsetky().some(e=>e.tagName==='A'&&e.href===A.PORTAL&&e.isConnected));
  }finally{env.obnov();}
});
test('zmazanie: 502 subscription_cancel_failed nič neukáže ako zmazané a dá odkaz na portál; 200 s cancelled true bez portálu', async ()=>{
  let env=await zmazVSprave({status:502,data:{error:'subscription_cancel_failed'}});
  try{
    const text=env.doc.body.textContent;assert.ok(text.includes(S_SK.hlasenia.zmazanieZlyhalo));assert.ok(!text.includes(S_SK.hlasenia.zmazane));
    assert.ok(env.doc.vsetky().some(e=>e.tagName==='A'&&e.href===A.PORTAL&&e.isConnected));
  }finally{env.obnov();}
  env=await zmazVSprave({status:200,data:{ok:true,subscription_cancelled:true}});
  try{assert.ok(env.doc.body.textContent.includes(S_SK.hlasenia.zmazane));assert.ok(!env.doc.vsetky().some(e=>e.tagName==='A'&&e.href===A.PORTAL&&e.isConnected));}
  finally{env.obnov();}
});

test('Z4 v DOM: Skontrolovať teraz s fresh true načíta stav znova a povie hotovo; 429 povie dátum poslednej kontroly', async ()=>{
  let beh=0;const odp=[{status:200,data:{status:'done',fresh:true,report:{at:'2026-10-22T10:00:00Z'}}},{status:429,data:{error:'rate_limited',last_at:'2026-10-22T12:05:00Z'}}];
  const env=await spravaPre(`?id=${ID}&key=${KEY}`,z=>{if(z.url.includes('/run?'))return odp[beh++];if(z.method==='GET')return {data:zaklad()};});
  try{
    const pred=env.volania.filter(z=>z.method==='GET').length;
    tlacidloS(env.doc,S_SK.skontrolovat).click();await pockaj(30);
    assert.ok(env.doc.body.textContent.includes(S_SK.hlasenia.kontrolaHotova));
    assert.equal(env.volania.filter(z=>z.method==='GET').length,pred+1);
    tlacidloS(env.doc,S_SK.skontrolovat).click();await pockaj(30);
    assert.ok(env.doc.body.textContent.includes(A.datumCas('2026-10-22T12:05:00Z','sk')));
  }finally{env.obnov();}
});

test('Z3 v DOM: skóre null je pravdivá veta (údaje pre AI sa nedali vyhodnotiť, EÚ sledujeme), žiadne „?“ ani „bez nálezov“', async ()=>{
  const weekly={status:'done',at:'2026-10-22T10:00:00Z',score:null,coverage:null,eu:[{code:'eu_withdrawal',state:'not_found'}],failing:[],changed:[]};
  const env=await spravaPre(`?id=${ID}&key=${KEY}`,z=>z.method==='GET'?{data:zaklad({weekly})}:null);
  try{
    const text=env.doc.body.textContent;
    assert.ok(text.includes(A.vypln(S_SK.skoreNull,{datum:A.datum(weekly.at,'sk')})));assert.ok(text.includes(S_SK.skoreNullVysvetlenie));
    assert.ok(!text.includes(S_SK.zlyhaneZiadne)&&!text.includes('splnené kontroly ?'));
    assert.ok(text.includes(EU_UI.sk.rules.eu_withdrawal.title));
  }finally{env.obnov();}
});

test('správa v DOM: Pokazilo sa a Opravilo sa podľa smeru, dátum v histórii feedu, veta o Zrušiť len pri bežiacom predplatnom', async ()=>{
  const weekly={status:'done',at:'2026-10-22T10:00:00Z',score:80,coverage:90,eu:[],failing:[],changed:[{code:'eu_guarantee_notice',from:'found',to:'not_found'},{code:'policy_returns',from:'fail',to:'pass'}]};
  const history=[{date:'2026-10-21T05:00:00.000Z',score:90,error:1,warning:2},{date:'2026-10-22T05:00:00.000Z',score:91,error:0,warning:2}];
  let env=await spravaPre(`?id=${ID}&key=${KEY}`,z=>z.method==='GET'?{data:zaklad({weekly,history,feed_url:'https://obchod.sk/feed.xml',last_score:91,last_counts:{error:0,warning:2}})}:null);
  try{
    const h4=env.doc.vsetky().filter(e=>e.tagName==='H4').map(e=>e.textContent);
    assert.ok(h4.includes(S_SK.pokaziloNadpis)&&h4.includes(S_SK.opraviloNadpis));
    const po=n=>{const i=env.doc.vsetky().findIndex(e=>e.tagName==='H4'&&e.textContent===n);return env.doc.vsetky().slice(i+1).find(e=>e.tagName==='UL').textContent;};
    assert.equal(po(S_SK.pokaziloNadpis),EU_UI.sk.rules.eu_guarantee_notice.title);
    const i=RULES.findIndex(r=>r.code==='policy_returns');assert.equal(po(S_SK.opraviloNadpis),localRule(RULES[i],i,'sk').title);
    const td=env.doc.vsetky().filter(e=>e.tagName==='TD');
    assert.equal(td[0].textContent,'22. 10. 2026');assert.ok(td.every(e=>!/T05|Z$/.test(e.textContent)));assert.ok(td.every(e=>!('th' in e.dataset)));
    assert.ok(env.doc.body.textContent.includes(S_SK.zmazatVetaZrusit));
  }finally{env.obnov();}
  env=await spravaPre(`?id=${ID}&key=${KEY}`,z=>z.method==='GET'?{data:zaklad({cancel_at:'2026-11-22T10:00:00Z'})}:null);
  try{const text=env.doc.body.textContent;assert.ok(text.includes(S_SK.zmazatVeta));assert.ok(!text.includes(S_SK.zmazatVetaZrusit));}finally{env.obnov();}
});

test('predaj v DOM: bez ponuky (live false) nadpis nevyzýva na zapnutie; pri live true ostane', async ()=>{
  for(const [live,ocakavany] of [[false,TEXTY.sk.coskoroNadpis],[true,'Zapnúť Stráž e-shopu']]){
    const env=prostredie({router:z=>z.url.includes('stav.json')?{data:{live}}:null});
    try{
      const nad=env.doc.el('h2',{id:'st-objednat-nadpis',textContent:'Zapnúť Stráž e-shopu'});env.doc.el('p',{dataset:{coskoro:''},hidden:true});
      await A.spustPredaj(TEXTY.sk,'sk',{test:false,merat:false},tichyTracker());
      assert.equal(nad.textContent,ocakavany);
    }finally{env.obnov();}
  }
});

test('predaj v DOM (Z1, Z2): POST /v1/straz nesie prev_id a prev_key zo straz:navrat mladšieho ako 24 h; 403 test_not_allowed ukáže vetu', async ()=>{
  for(const [vek,ma] of [[60*1000,true],[25*3600*1000,false]]){
    const navrat=A.navratZaznam(ID,KEY,'sk',new Date(Date.now()-vek));
    const env=prostredie({search:'?test=1',ulozene:{'straz:navrat':navrat},router:z=>{if(z.url.includes('stav.json'))return {data:{live:false}};if(z.url.endsWith('/v1/straz'))return {status:403,data:{error:'test_not_allowed'}};}});
    try{
      const d=env.doc,form=d.el('form',{id:'straz-form'});
      for(const [id,value] of [['st-obchod','obchod.sk'],['st-email','ja@obchod.sk'],['st-feed','']])d.el('input',{id,value},form);
      d.el('button',{id:'st-odoslat'},form);d.el('p',{id:'st-stav'},form);const chyba=d.el('p',{id:'st-chyba',hidden:true},form);
      await A.spustPredaj(TEXTY.sk,'sk',{test:true,merat:false},tichyTracker());
      form.fire('submit');await pockaj(30);
      const post=env.volania.find(z=>z.method==='POST');
      assert.equal(post.body.test,true);
      if(ma){assert.equal(post.body.prev_id,ID);assert.equal(post.body.prev_key,KEY);}else assert.ok(!('prev_id' in post.body)&&!('prev_key' in post.body));
      assert.equal(chyba.textContent,TEXTY.sk.form.chyby.test_not_allowed);assert.equal(chyba.hidden,false);
      assert.ok(!env.volania.some(z=>z.assign));
    }finally{env.obnov();}
  }
});

/* ---------------- kolo 1 opráv: stará stránka monitora a navrat.mjs ---------------- */
test('navrat.mjs: #zmazat ostane pri presmerovaní na Stráž, iná kotva nie', ()=>{
  const s=`?id=${ID}&key=${KEY}`;
  assert.equal(N.cielPreMonitor(s,{id:ID,plan:'free',source:'straz',lang:'en'},'#zmazat'),`/straz-eshopu/en/?id=${ID}&key=${KEY}#zmazat`);
  assert.equal(N.cielPreMonitor(s,{id:ID,plan:'pro',lang:'sk'},'#x"><img'),`/straz-eshopu/?id=${ID}&key=${KEY}`);
  assert.equal(N.cielPreMonitor(s,{id:ID,plan:'pro',lang:'sk'}),`/straz-eshopu/?id=${ID}&key=${KEY}`);
});

test('navrat.mjs: pri #zmazat počká na tlačidlo zmazania, posunie naň, zvýrazní ho a dá mu fokus; bez tlačidla po limite false', async ()=>{
  const doc=falosnyDom();let mo=null;
  class MO{constructor(fn){this.fn=fn;mo=this;}observe(){this.pozoruje=true;}disconnect(){this.pozoruje=false;}}
  const p=N.pripravZmazanie(doc,{MO,casovac:()=>{}});
  assert.equal(mo.pozoruje,true);
  mo.fn();// zmena DOM bez tlačidla: nič
  const riadok=doc.el('div',{className:'delete-row'}),b=doc.el('button',{id:'delete-btn'},riadok);
  mo.fn();
  assert.equal(await p,true);
  assert.equal(doc.activeElement,b);assert.equal(b.posunute,true);assert.ok(b.classList.contains('navrat-ciel'));assert.ok(riadok.classList.contains('navrat-ciel'));assert.equal(mo.pozoruje,false);
  const doc2=falosnyDom();let spust;const p2=N.pripravZmazanie(doc2,{MO,casovac:fn=>{spust=fn;}});spust();
  assert.equal(await p2,false);
  // tlačidlo už je na stránke: hneď, bez pozorovania
  const doc3=falosnyDom(),b3=doc3.el('button',{id:'delete-btn'});assert.equal(await N.pripravZmazanie(doc3,{MO:null,casovac:()=>{}}),true);assert.equal(doc3.activeElement,b3);
});

/** Spustí vložený modul starej stránky monitora vo vm s falošným #app a vráti vykreslené HTML. */
async function staraStranka(search,data){
  const kod=subor('../feed-doctor/monitor/index.html').match(/<script type="module">([\s\S]*?)<\/script>/)[1];
  const app={innerHTML:''};
  vm.runInNewContext(kod,{document:{getElementById:id=>id==='app'?app:null,body:{contains:()=>false}},location:{search,reload(){}},window:{},URLSearchParams,
    fetch:async()=>({ok:true,status:200,json:async()=>data})});
  await pockaj(20);return app.innerHTML;
}
test('stará stránka monitora: veta, meta a banner o Shop Guard; po platbe bez tlačidla na platbu; #zmazat má štýl', async ()=>{
  const t=subor('../feed-doctor/monitor/index.html');
  for(const stare of ['Pro: daily checks','90 days of history','upgrade to Pro','Pro is now active'])assert.ok(!t.includes(stare),stare);
  assert.match(t,/<meta name="description" content="[^"]*Shop Guard[^"]*">/);
  assert.ok(t.includes('#delete-btn.navrat-ciel{'));
  const free={id:ID,plan:'free',status:'active',feed_url:'https://obchod.sk/feed.xml',history:[],upgrade_url:'https://buy.stripe.com/8x214he2mbOj1Sq2hL4ko05?client_reference_id='+ID};
  const bezne=await staraStranka(`?id=${ID}&key=${KEY}`,free);
  assert.ok(bezne.includes('id="upgrade-btn"'));
  assert.ok(bezne.includes('Shop Guard: your store checked once a week for EU obligations')&&bezne.includes('In the Stripe checkout the item is called Feed Doctor Monitor.'));
  const poPlatbe=await staraStranka(`?id=${ID}&key=${KEY}&paid=1`,free);
  assert.ok(!poPlatbe.includes('upgrade-btn')&&!poPlatbe.includes('buy.stripe.com'));
  assert.ok(poPlatbe.includes('there is no need to pay again'));
  assert.ok((await staraStranka(`?id=${ID}&key=${KEY}&paid=1`,{...free,plan:'pro'})).includes('Thanks. Shop Guard is now active on this monitor.'));
});

/* ---------------- kolo 2 opráv (brána pokus 1, zmeny zmluvy C1 až C3) ---------------- */
// Shoptet: odkaz <a href="/moja-objednavka/">Odstúpenie od zmluvy</a> nemá znenie smernice, analýza ho vráti ako podobný.
const SHOPTET_EU=[{code:'eu_withdrawal',state:'not_found',similar:{label:'Odstúpenie od zmluvy',page:'home'}},{code:'eu_guarantee_notice',state:'not_found'},{code:'eu_green_claims',state:'not_found'}];
test('nález 1 (C1): odstúpenie not_found s podobným odkazom ukáže Overte odkaz a tón unknown ako bezplatná kontrola (eu-zobraz.mjs)', async ()=>{
  const {euView}=await import('../feed-doctor/agent-ready/eu-zobraz.mjs');
  for(const lang of A.JAZYKY){
    const t=EU_UI[lang],r=A.euRiadky(SHOPTET_EU,lang,zdroje)[0];
    assert.equal(r.badge,t.rules.eu_withdrawal.status.check,lang);assert.equal(r.tone,'unknown',lang);
    assert.notEqual(r.badge,t.rules.eu_withdrawal.status.not_found,lang);
    assert.equal(r.veta,t.rules.eu_withdrawal.similar.replace('{label}','Odstúpenie od zmluvy').replace('{page}',t.pages.home),lang);
    // Rovnaký štítok a tón ako bezplatná kontrola pre ten istý obchod.
    const plna=euView({version:1,rules:[{code:'eu_withdrawal',status:'not_found',similar:[{label:'Odstúpenie od zmluvy',page:'home',href:'https://obchod.sk/moja-objednavka/'}]},{code:'eu_guarantee_notice',status:'not_found'},{code:'eu_green_claims',status:'not_found'}]},t)[0];
    assert.deepEqual([r.badge,r.tone],[plna.badge,plna.tone],lang);
  }
  // Bez podobného odkazu ostáva Označenie sme nenašli; pole similar, neznáma stránka a zlý tvar nič nepokazia.
  assert.equal(A.euRiadky([{code:'eu_withdrawal',state:'not_found'}],'sk',zdroje)[0].tone,'review');
  assert.equal(A.euRiadky([{code:'eu_withdrawal',state:'not_found',similar:[{label:'Odstúpenie',page:'constructor'}]}],'sk',zdroje)[0].veta.includes(EU_UI.sk.pages.product),true);
  assert.equal(A.euRiadky([{code:'eu_withdrawal',state:'not_found',similar:'zle'}],'sk',zdroje)[0].tone,'review');
  assert.equal(A.euRiadky([{code:'eu_withdrawal',state:'found',similar:{label:'x'}}],'sk',zdroje)[0].tone,'ok');
  assert.equal(A.euRiadky([{code:'eu_green_claims',state:'not_found',similar:{label:'x'}}],'sk',zdroje)[0].badge,EU_UI.sk.rules.eu_green_claims.status.not_found);
  assert.equal(A.podobnyOdkaz({similar:{label:'a\u0000b',page:'<x>'}}).page,'');
  // Porovnanie týždňov: found -> not_found s podobným odkazom nie je Pokazilo sa.
  const zmena=[{code:'eu_withdrawal',from:'found',to:'not_found'}];
  assert.deepEqual(A.zmenyPodlaSmeru(zmena,'sk',zdroje,{eu:SHOPTET_EU}).pokazene,[]);
  assert.deepEqual(A.zmenyPodlaSmeru([{...zmena[0],similar:{label:'x',page:'home'}}],'sk',zdroje).pokazene,[]);
  assert.equal(A.zmenyPodlaSmeru(zmena,'sk',zdroje,{eu:[{code:'eu_withdrawal',state:'not_found'}]}).pokazene.length,1);
});

test('nález 1 v DOM: Shoptet bez skóre nikdy neukáže „nenašli“ pri odstúpení ani Pokazilo sa, štítok má tón unknown', async ()=>{
  const weekly={status:'done',at:'2026-10-22T10:00:00Z',score:null,coverage:null,eu:SHOPTET_EU,failing:[],changed:[{code:'eu_withdrawal',from:'found',to:'not_found'}]};
  for(const lang of A.JAZYKY){
    const env=await spravaPre(`?id=${ID}&key=${KEY}`,z=>z.method==='GET'?{data:zaklad({weekly,lang})}:null,{lang});
    try{
      const s=TEXTY[lang].sprava,t=EU_UI[lang].rules.eu_withdrawal,text=env.doc.body.textContent;
      assert.ok(text.includes(t.status.check),lang);assert.ok(!text.includes(t.status.not_found),lang);
      assert.ok(text.includes('Odstúpenie od zmluvy'),lang);
      const badge=env.doc.vsetky().find(e=>e.className==='ar-eu-badge'&&e.textContent===t.status.check);assert.equal(badge.dataset.tone,'unknown',lang);
      assert.ok(!env.doc.vsetky().some(e=>e.tagName==='H4'&&e.textContent===s.pokaziloNadpis),lang);
    }finally{env.obnov();}
  }
});

test('nález 8 (C2): Na opravu a Pokazilo sa nesú prvú vetu opravy z localRule a len https adresu miesta; starý tvar reťazca ostáva', ()=>{
  const out=A.nazvyPravidiel([{code:'policy_shipping',where:'https://obchod.sk/doprava'},{code:'jsonld_offer',where:'javascript:alert(1)'},'feed_title',{code:'policy_contact',where:'http://obchod.sk/kontakt'},{code:'policy_returns',where:'https://u:p@obchod.sk/x'}],'sk',zdroje);
  const po=c=>out.find(x=>x.code===c);
  const i=RULES.findIndex(r=>r.code==='policy_shipping');
  assert.equal(po('policy_shipping').fix,'Odkážte na čitateľné informácie o doprave.');
  assert.ok(localRule(RULES[i],i,'sk').fix.startsWith(po('policy_shipping').fix));
  assert.equal(po('policy_shipping').where,'https://obchod.sk/doprava');
  for(const c of ['jsonld_offer','feed_title','policy_contact','policy_returns'])assert.equal(po(c).where,'',c);
  assert.ok(po('feed_title').fix.length>0);
  assert.equal(A.nazvyPravidiel(['policy_shipping'],'en',zdroje)[0].fix,'Link to readable shipping information on this shop.');
  assert.equal(A.prvaVeta('Prvá veta. Druhá veta.'),'Prvá veta.');assert.equal(A.prvaVeta('Bez bodky'),'Bez bodky');assert.equal(A.prvaVeta(null),'');
  assert.ok(A.prvaVeta('x'.repeat(400)).length<=300);
  assert.equal(A.adresaMiesta(['https://obchod.sk/p/1']),'https://obchod.sk/p/1');assert.equal(A.adresaMiesta(42),'');
  // Pokazilo sa: veta opravy a miesto z aktuálneho weekly.failing.
  const z=A.zmenyPodlaSmeru([{code:'policy_shipping',from:'pass',to:'fail'},{code:'policy_returns',from:'fail',to:'pass'}],'sk',zdroje,{failing:[{code:'policy_shipping',where:'https://obchod.sk/doprava'}]});
  assert.equal(z.pokazene[0].fix,po('policy_shipping').fix);assert.equal(z.pokazene[0].where,'https://obchod.sk/doprava');
  assert.ok(!('fix' in z.opravene[0]));
});

test('nález 8 v DOM: položka ukáže vetu opravy a odkaz len na https, javascript: nikdy ako odkaz', async ()=>{
  const weekly={status:'done',at:'2026-10-22T10:00:00Z',score:70,coverage:90,eu:[],
    failing:[{code:'policy_shipping',where:'https://obchod.sk/doprava'},{code:'policy_contact',where:'javascript:alert(1)'}],changed:[{code:'policy_shipping',from:'pass',to:'fail'}]};
  const env=await spravaPre(`?id=${ID}&key=${KEY}`,z=>z.method==='GET'?{data:zaklad({weekly})}:null);
  try{
    const text=env.doc.body.textContent,odkazy=env.doc.vsetky().filter(e=>e.tagName==='A'&&e.href==='https://obchod.sk/doprava');
    assert.ok(text.includes('Odkážte na čitateľné informácie o doprave.'));assert.ok(text.includes(S_SK.kde));
    assert.equal(odkazy.length,2,'Na opravu aj Pokazilo sa');assert.equal(odkazy[0].textContent,'obchod.sk/doprava');
    assert.ok(!env.doc.vsetky().some(e=>e.tagName==='A'&&/javascript/i.test(String(e.href))));assert.ok(!text.includes('javascript:'));
  }finally{env.obnov();}
});

test('nález 5: veta skóre hovorí skóre a pokrytie, nie počet splnených kontrol zo 100', ()=>{
  const v={datum:'22. 10. 2026',skore:62,pokrytie:80};
  assert.equal(A.vypln(TEXTY.sk.sprava.skore,v),'22. 10. 2026: skóre 62 zo 100, pokrytie 80 %.');
  assert.equal(A.vypln(TEXTY.en.sprava.skore,v),'22. 10. 2026: score 62 of 100, coverage 80%.');
  assert.equal(A.vypln(TEXTY.de.sprava.skore,v),'22. 10. 2026: Bewertung 62 von 100, Abdeckung 80 %.');
  for(const l of A.JAZYKY)assert.doesNotMatch(TEXTY[l].sprava.skore,/splnené kontroly|checks passed|Prüfungen erfüllt/);
  for(const l of A.JAZYKY)assert.ok(TEXTY[l].sprava.skoreVysvetlenie,l);
});

test('nález 7: počas overovania platby plán Platba sa overuje, veta o prvej kontrole a bez Zmazať; po 120 s sa Zmazať vráti', async ()=>{
  const h=hodiny(),pohlady=[];
  const env=await spravaPre(`?id=${ID}&key=${KEY}&paid=1`,(z,doc)=>{
    if(z.url.includes('/paid-return'))return {data:{ok:true,plan:'free'}};
    if(z.method==='GET'){pohlady.push({text:doc.body.textContent,zmazat:Boolean(tlacidloS(doc,S_SK.zmazat)),sekcia:Boolean(doc.getElementById('zmazat'))});return {data:zaklad({plan:'free',status:'pending_payment',weekly:null})};}
  },{opt:{interval:3000,limit:6000,now:h.now,spi:async ms=>{h.posun(ms);await pockaj(15);}}});
  try{
    assert.equal(pohlady.length,3);
    for(const p of pohlady.slice(1)){
      assert.ok(p.text.includes(S_SK.plan.overuje)&&!p.text.includes(S_SK.plan.caka));
      assert.ok(p.text.includes(S_SK.weekly.poPlatbe)&&!p.text.includes(S_SK.weekly.none));
      assert.equal(p.zmazat,false);assert.equal(p.sekcia,false);
    }
    assert.ok(tlacidloS(env.doc,S_SK.zmazat),'po vypršaní overovania je Zmazať späť');
    assert.equal(env.volania.filter(z=>z.method==='GET').length,3,'bez ďalšieho GET');
    assert.equal(odkazyNaPlatbu(env.doc).length,0);
  }finally{env.obnov();}
  // Bez paid=1 je čakajúci monitor ako doteraz: Čaká na platbu a Zmazať.
  const env2=await spravaPre(`?id=${ID}&key=${KEY}`,z=>z.method==='GET'?{data:zaklad({plan:'free',status:'pending_payment'})}:null);
  try{const text=env2.doc.body.textContent;assert.ok(text.includes(S_SK.plan.caka)&&text.includes(S_SK.weekly.none));assert.ok(tlacidloS(env2.doc,S_SK.zmazat));}
  finally{env2.obnov();}
  for(const l of A.JAZYKY)assert.ok(TEXTY[l].sprava.plan.overuje&&TEXTY[l].sprava.weekly.poPlatbe&&TEXTY[l].sprava.kde,l);
});

test('nález 10: h1 je Vaša Stráž e-shopu, h2 je adresa obchodu; Zmeniť adresu má plnú šírku; dátum v histórii písmom ARLing Sans', async ()=>{
  const env=await spravaPre(`?id=${ID}&key=${KEY}`,z=>z.method==='GET'?{data:zaklad()}:null,{nadpis:true});
  try{
    assert.equal(env.h1.textContent,S_SK.nadpis);
    const h2=env.doc.getElementById('sprava-nadpis');assert.equal(h2.textContent,'obchod.sk');assert.equal(h2.hidden,false);assert.notEqual(h2.textContent,S_SK.nadpis);
    assert.equal(env.doc.getElementById('sprava').getAttribute('aria-labelledby'),'st-nadpis');
    assert.ok(tlacidloS(env.doc,S_SK.zmenitObchod).className.split(' ').includes('st-plna'));
  }finally{env.obnov();}
  const c=subor('./straz.css'),m760=c.slice(c.indexOf('@media(max-width:760px){'));
  assert.ok(c.includes('.ar-page .st-tabulka td,.ar-page .st-tabulka th{font-family:var(--ui);font-variant-numeric:tabular-nums'));
  assert.ok(m760.includes('.ar-page .st-blok>button.st-plna{display:block;width:100%}'));
  assert.ok(c.includes('.ar-page .st-sprava .st-test{margin:16px 0 0}'));
  // Snímky kolo 2 bod 9: štítky EÚ v každom riadku rovnako (mriežka, do 760 px vždy pod názvom).
  assert.ok(c.includes('.st-eu li{display:grid;grid-template-columns:minmax(0,1fr) auto'));
  assert.ok(m760.includes('.st-eu li{grid-template-columns:minmax(0,1fr)}'));
});

test('nález 12: panel na starej stránke monitora píše o e-mailoch Shop Guard s odkazom na stránku Stráže a pri score null nie „null/100“', async ()=>{
  let n=0;
  async function panel(report){
    const env=prostredie({search:`?id=${ID}&key=${KEY}`,pathname:'/feed-doctor/monitor/',router:z=>z.url.includes('/v1/agent-ready/monitors/')?{data:{settings:{store_url:'https://obchod.sk/',revision:1},report}}:null});
    const main=env.doc.el('main');env.doc.querySelector=s=>s==='main'?main:null;
    try{await import('../feed-doctor/agent-ready/monitor.mjs?t='+(++n));await pockaj(30);
      const p=env.doc.getElementById('agent-ready-weekly');return {text:p.textContent,odkazy:[...p.vsetky()].filter(e=>e.tagName==='A').map(e=>e.href)};}
    finally{env.obnov();}
  }
  const bez=await panel({at:'2026-10-22T05:00:00Z',score:null,coverage:null,rules:[]});
  assert.ok(bez.text.includes('Shop Guard sends an e-mail when the result changes; settings and results are on the Shop Guard page.'));
  assert.ok(!bez.text.includes('No report emails are sent'));
  assert.ok(!bez.text.includes('null/100')&&!bez.text.includes('null%'));assert.ok(bez.text.includes('data for AI assistants could not be evaluated'));
  assert.deepEqual(bez.odkazy,[`/straz-eshopu/en/?id=${ID}&key=${KEY}`]);
  const so=await panel({at:'2026-10-22T05:00:00Z',score:80,coverage:90,rules:[]});
  assert.ok(so.text.includes('80/100, 90% coverage'));
  assert.doesNotMatch(subor('../feed-doctor/agent-ready/monitor.mjs'),/[–—]/);
});

test('nález 13: zásady súkromia časť 4 bez rozporu (zrušenie Stráže nič nemaže, odpoveď na e-mail nič neruší); FAQ Feed Doctor bez mono pri cene', ()=>{
  for(const [p,zle,veta] of [['../privacy/index.html','odpoveďou na upozornenie','Pri Stráži e-shopu zrušenie predplatného nič nemaže'],
    ['../privacy/en/index.html','by replying to an alert','For Shop Guard, cancelling the subscription deletes nothing'],
    ['../privacy/de/index.html','per Antwort auf eine Warn-E-Mail','Beim Shop-Wächter löscht die Kündigung des Abos nichts']]){
    const t=subor(p),s4=t.slice(t.indexOf('<h2 id="s4"'),t.indexOf('<h2 id="s5"'));
    assert.ok(!s4.includes(zle),p);assert.ok(s4.includes(veta),p);assert.doesNotMatch(s4,/[–—]/,p);
    assert.ok(!/zrušením sa zmaže|deleting removes the e-mail, feed URL and history\.<\/p>\s*<p>Shop/.test(s4),p);
  }
  for(const [p,veta] of [['../feed-doctor/index.html','a stojí 9 € mesačne'],['../feed-doctor/en/index.html','costs 9 EUR a month'],['../feed-doctor/de/index.html','kostet 9 EUR im Monat']]){
    const t=subor(p);assert.ok(t.includes(veta),p);assert.ok(!t.includes('<span class="mono">9'),p);
  }
  // Snímky kolo 2: „Bez e-mailu.“ pod tlačidlom v článku sa nerozdelí na dva riadky.
  assert.ok(subor('../oznamenie-o-zakonnej-zaruke-eshop/index.html').includes('vášho obchodu. <span class="ar-nowrap">Bez e-mailu.</span></p>'));
});

// W3 (22. 10. 2026): feed nad 8 MB worker vyhodnotí na prvých N produktoch (last_sample, last_products z GET /v1/monitors/:id).
test('W3: veta o vzorke feedu len pri last_sample true a kladnom počte, v SK, EN, DE bez pomlčiek, slovenské tvary čísla', ()=>{
  for(const l of ['sk','en','de']){
    const s=TEXTY[l].sprava,v=A.vetaVzorky({last_sample:true,last_products:12000},s);
    assert.ok(v.includes('12000')&&v.includes('8 MB'),l+': '+v);assert.doesNotMatch(v,/[–—]/);
    assert.equal(A.vetaVzorky({last_sample:false,last_products:12000},s),'');
    assert.equal(A.vetaVzorky({last_products:12000},s),'');
    assert.equal(A.vetaVzorky({last_sample:'true',last_products:12000},s),'');
    assert.equal(A.vetaVzorky({last_sample:true,last_products:0},s),'');
    assert.equal(A.vetaVzorky({last_sample:true,last_products:'12000'},s),'');
    assert.equal(A.vetaVzorky({last_sample:true,last_products:null},s),'');
  }
  const s=TEXTY.sk.sprava;
  assert.equal(A.vetaVzorky({last_sample:true,last_products:1},s),'Vyhodnotili sme prvý produkt z feedu, ktorý má viac ako 8 MB.');
  assert.equal(A.vetaVzorky({last_sample:true,last_products:3},s),'Vyhodnotili sme prvé 3 produkty z feedu, ktorý má viac ako 8 MB.');
  assert.equal(A.vetaVzorky({last_sample:true,last_products:5},s),'Vyhodnotili sme prvých 5 produktov z feedu, ktorý má viac ako 8 MB.');
  // Starý texty.mjs z vyrovnávacej pamäte (bez feedVzorka): nič, nikdy „undefined“.
  assert.equal(A.vetaVzorky({last_sample:true,last_products:5},{}),'');
});

test('W3 v DOM: pri last_sample veta pri feede pod skóre, bez vzorky nie; ostatné časti bloku feedu ostanú', async ()=>{
  const feed={feed_url:'https://obchod.sk/google/export/products.xml',last_score:88,last_counts:{error:1,warning:3},last_check_at:'2026-10-22T05:00:00Z'};
  const veta=A.vetaVzorky({last_sample:true,last_products:2400},S_SK);
  let env=await spravaPre(`?id=${ID}&key=${KEY}`,z=>z.method==='GET'?{data:zaklad({...feed,last_sample:true,last_products:2400})}:null);
  try{
    const p=env.doc.vsetky().filter(e=>e.tagName==='P'&&e.isConnected);
    // W4: hlavná veta feedu má počty pri N produktoch, nie skóre.
    const i=p.findIndex(e=>e.textContent.startsWith('Posledná kontrola ')&&e.textContent.includes(`chyby 1 a upozornenia 3 pri ${A.cislo(2400,'sk')} produktoch`));
    assert.ok(i>=0,'veta s počtami feedu');assert.equal(p[i+1].textContent,veta);assert.ok(p[i+1].className.includes('ar-muted'));
    assert.ok(!env.doc.body.textContent.includes('88 zo 100'));
  }finally{env.obnov();}
  env=await spravaPre(`?id=${ID}&key=${KEY}`,z=>z.method==='GET'?{data:zaklad({...feed,last_sample:false,last_products:2400})}:null);
  try{const text=env.doc.body.textContent;assert.ok(text.includes('chyby 1 a upozornenia 3'));assert.ok(!text.includes('88 zo 100'));assert.ok(!text.includes('8 MB'));}finally{env.obnov();}
  // Bez skóre (napr. feed sa nenačítal) sa veta o vzorke neukáže ani pri last_sample true.
  env=await spravaPre(`?id=${ID}&key=${KEY}`,z=>z.method==='GET'?{data:zaklad({...feed,last_score:null,last_sample:true,last_products:2400})}:null);
  try{const text=env.doc.body.textContent;assert.ok(text.includes(S_SK.feedZiadnaKontrola));assert.ok(!text.includes(veta));}finally{env.obnov();}
});

test('W4: app.mjs a test načítajú texty.mjs?v=5 (feedPocty a stĺpec Produkty nesmú prísť zo starej kópie)', ()=>{
  const app=readFileSync(new URL('./app.mjs',import.meta.url),'utf8');
  assert.ok(app.includes("from './texty.mjs?v=5'"));assert.ok(!/texty\.mjs\?v=[34]'/.test(app));
});

test('W4: veta feedu s počtami pri N produktoch v SK, EN, DE, bez N pri starej kontrole; texty bez skóre feedu', ()=>{
  const d={last_check_at:'2026-10-22T05:00:00Z',last_score:0,last_counts:{error:209,warning:1282},last_products:1282};
  const sk=A.vetaFeedu(d,TEXTY.sk.sprava,'sk'),en=A.vetaFeedu(d,TEXTY.en.sprava,'en'),de=A.vetaFeedu(d,TEXTY.de.sprava,'de');
  assert.ok(sk.endsWith(`chyby 209 a upozornenia ${A.cislo(1282,'sk')} pri ${A.cislo(1282,'sk')} produktoch.`),sk);
  assert.ok(en.endsWith('209 errors and 1,282 warnings across 1,282 products.'),en);
  assert.ok(de.endsWith('209 Fehler und 1.282 Warnungen bei 1.282 Produkten.'),de);
  for(const v of [sk,en,de])assert.doesNotMatch(v,/0 zo 100|0 of 100|0 von 100|skóre|score|Bewertung/i);
  const stara={...d,last_products:null};
  assert.ok(A.vetaFeedu(stara,TEXTY.sk.sprava,'sk').endsWith(`: chyby 209 a upozornenia ${A.cislo(1282,'sk')}.`));
  assert.doesNotMatch(A.vetaFeedu(stara,TEXTY.en.sprava,'en'),/across/);
  assert.match(A.vetaFeedu({...d,last_products:1,last_counts:{error:0,warning:1}},TEXTY.de.sprava,'de'),/bei 1 Produkt\.$/);
  assert.equal(A.vetaFeedu(d,{},'sk'),'');
  for(const l of A.JAZYKY){const s=TEXTY[l].sprava;assert.equal(s.feedSkore,undefined);assert.equal(s.historia.skore,undefined);assert.ok(s.historia.produkty&&s.feedProblemyNadpis);}
});

test('W4: stĺpce histórie feedu: Produkty len keď ho má aspoň jeden riadok, Skóre nikdy', ()=>{
  const s=A.historiaFeedu([{date:'2026-10-21T05:00:00Z',score:0,error:3,warning:9},{date:'2026-10-22T05:00:00Z',score:0,error:209,warning:1282,products:1282}]);
  assert.deepEqual(A.stlpceHistorie(s),['datum','produkty','chyby','upozornenia']);
  assert.deepEqual(A.bunkyHistorie(s[0],'en',A.stlpceHistorie(s)),['22/10/2026','1,282','209','1,282']);
  assert.deepEqual(A.bunkyHistorie(s[1],'en',A.stlpceHistorie(s)),['21/10/2026','','3','9']);
  const bez=A.historiaFeedu([{date:'2026-10-21T05:00:00Z',score:0,error:3,warning:9}]);
  assert.deepEqual(A.stlpceHistorie(bez),['datum','chyby','upozornenia']);
  assert.deepEqual(A.bunkyHistorie(bez[0],'sk',A.stlpceHistorie(bez)),['21. 10. 2026','3','9']);
});

test('W4: najčastejšie problémy feedu s názvom a počtom, len chyby a upozornenia so známym názvom', async ()=>{
  const fd=await import('../feed-doctor/feed-doctor.js');
  const top=[{rule:'missing_price',severity:'error',count:209},{rule:'missing_brand',severity:'warning',count:1282},{rule:'shipping_missing',severity:'info',count:40},{rule:'nezname',severity:'error',count:3}];
  const en=A.problemyFeedu(top,'en',A.nazvyPravidielFeedu(fd,'en'));
  assert.deepEqual(en.map(p=>`${p.nazov} (${p.pocet})`),['Missing price (209)','Missing brand (1,282)']);
  const sk=A.problemyFeedu(top,'sk',A.nazvyPravidielFeedu(fd,'sk'));
  assert.deepEqual(sk.map(p=>p.nazov),['Chýba cena','Chýba značka']);
  assert.deepEqual(A.problemyFeedu(top,'sk',null),[]);assert.deepEqual(A.problemyFeedu('zle','sk',new Map()),[]);
});

test('W4 v DOM: blok feedu bez skóre, s počtami, najčastejšími problémami a stĺpcom Produkty', async ()=>{
  const history=[{date:'2026-10-21T05:00:00.000Z',score:0,error:201,warning:1280,products:1280},{date:'2026-10-22T05:00:00.000Z',score:0,error:209,warning:1282,products:1282}];
  const data=zaklad({history,feed_url:'https://obchod.sk/google/export/products.xml',last_score:0,last_counts:{error:209,warning:1282},last_products:1282,last_check_at:'2026-10-22T05:00:00Z',
    last_top_issues:[{rule:'missing_price',severity:'error',count:209},{rule:'missing_brand',severity:'warning',count:1282}]});
  const env=await spravaPre(`?id=${ID}&key=${KEY}`,z=>z.method==='GET'?{data}:null);
  try{
    const text=env.doc.body.textContent;
    assert.ok(text.includes(`chyby 209 a upozornenia ${A.cislo(1282,'sk')} pri ${A.cislo(1282,'sk')} produktoch`),text);
    assert.ok(!text.includes('0 zo 100'));
    const h4=env.doc.vsetky().filter(e=>e.tagName==='H4'&&e.isConnected).map(e=>e.textContent);assert.ok(h4.includes(S_SK.feedProblemyNadpis));
    const li=env.doc.vsetky().filter(e=>e.tagName==='LI'&&e.isConnected).map(e=>e.textContent);
    assert.ok(li.includes('Chýba cena (209)')&&li.includes(`Chýba značka (${A.cislo(1282,'sk')})`),JSON.stringify(li));
    const th=env.doc.vsetky().filter(e=>e.tagName==='TH'&&e.isConnected).map(e=>e.textContent);
    assert.deepEqual(th,['Dátum','Produkty','Chyby','Upozornenia']);
  }finally{env.obnov();}
});

/* ---------------- relácia 208: odkaz na stránku objednávky platformy (zmluva 208, bod F) ---------------- */
// Worker (report-mail.mjs euRules) pri Shoptet odkaze „Odstúpenie od zmluvy“ na /moja-objednavka/ pošle stav link_found s link {label, page}.
const ODKAZ_EU=[{code:'eu_withdrawal',state:'link_found',link:{label:'Odstúpenie od zmluvy',page:'home'}},{code:'eu_guarantee_notice',state:'not_found'},{code:'eu_green_claims',state:'not_found'}];
const NIKDY=/undefined|\{label\}|\{page\}/;
test('208: euRiadky pri link_found ukáže „Odkaz nájdený, funkčnosť neoverená“, tón unknown a vetu z r.link; zmena s link_found nie je pokazené ani opravené', ()=>{
  for(const lang of A.JAZYKY){
    const t=EU_UI[lang],x=t.rules.eu_withdrawal,r=A.euRiadky(ODKAZ_EU,lang,zdroje)[0];
    assert.equal(r.code,'eu_withdrawal');assert.equal(r.badge,x.status.link_found,lang);assert.equal(r.tone,'unknown',lang);
    assert.equal(r.veta,x.linkFound.replace('{label}','Odstúpenie od zmluvy').replace('{page}',t.pages.home),lang);
    assert.ok(!NIKDY.test(JSON.stringify(r)),lang);
  }
  assert.equal(A.euRiadky(ODKAZ_EU,'sk',zdroje)[0].badge,'Odkaz nájdený, funkčnosť neoverená');
  // Bez r.link žiadna veta; zlý tvar, neznáma stránka a riadiace znaky nič nepokazia; link_found pri inom pravidle sa zahodí.
  const bez=A.euRiadky([{code:'eu_withdrawal',state:'link_found'}],'sk',zdroje)[0];assert.equal(bez.tone,'unknown');assert.equal(bez.veta,undefined);
  assert.equal(A.euRiadky([{code:'eu_withdrawal',state:'link_found',link:'zle'}],'sk',zdroje)[0].veta,undefined);
  const zvlastny=A.euRiadky([{code:'eu_withdrawal',state:'link_found',link:[{label:'A'+String.fromCharCode(0)+'B',page:'constructor'}]}],'sk',zdroje)[0];
  assert.ok(zvlastny.veta.startsWith('Na stránke produktu sme našli odkaz s textom „A B“.'),zvlastny.veta);
  assert.deepEqual(A.euRiadky([{code:'eu_green_claims',state:'link_found'}],'sk',zdroje),[]);
  assert.deepEqual(A.najdenyOdkaz({link:{label:'x',page:'<x>'}}),{label:'x',page:''});assert.equal(A.najdenyOdkaz({}),null);
  // Zmeny: link_found a not_found alebo found v ľubovoľnom smere nikdy nie sú Pokazilo sa ani Opravilo sa.
  for(const [from,to] of [['link_found','not_found'],['not_found','link_found'],['found','link_found'],['link_found','found'],[null,'link_found']]){
    assert.deepEqual(A.zmenyPodlaSmeru([{code:'eu_withdrawal',from,to}],'sk',zdroje,{eu:ODKAZ_EU}),{pokazene:[],opravene:[]},`${from} -> ${to}`);
  }
  // Aj keby toneOf (iná verzia eu-zobraz.mjs) dal link_found inú farbu, Stráž mu dá tón unknown.
  const ina={...zdroje,toneOf:(c,s)=>s==='link_found'?'ok':toneOf(c,s)};
  assert.deepEqual(A.zmenyPodlaSmeru([{code:'eu_withdrawal',from:'link_found',to:'not_found'}],'sk',ina),{pokazene:[],opravene:[]});
  assert.equal(A.euRiadky(ODKAZ_EU,'sk',ina)[0].tone,'unknown');
  // Bez link_found ostáva staré pravidlo: found -> not_found sa pokazilo.
  assert.equal(A.zmenyPodlaSmeru([{code:'eu_withdrawal',from:'found',to:'not_found'}],'sk',zdroje).pokazene.length,1);
});
test('208: so starým i18n.mjs?v=2 z vyrovnávacej pamäte (bez kľúčov link_found) Stráž ukáže „Overte odkaz“ a vetu o podobnom odkaze, nikdy undefined', ()=>{
  for(const lang of A.JAZYKY){
    const stare=structuredClone(EU_UI),x=stare[lang].rules.eu_withdrawal;
    delete stare[lang].status.link_found;delete x.status.link_found;delete x.linkFound;delete x.linkFoundNote;delete x.manualLinkFound;
    const r=A.euRiadky(ODKAZ_EU,lang,{...zdroje,EU_UI:stare})[0];
    assert.equal(r.badge,x.status.check,lang);assert.equal(r.tone,'unknown',lang);
    assert.equal(r.veta,x.similar.replace('{label}','Odstúpenie od zmluvy').replace('{page}',stare[lang].pages.home),lang);
    assert.ok(!NIKDY.test(JSON.stringify(r)),lang);
  }
});
test('208 v DOM: odkaz na stránku objednávky má štítok link_found s tónom unknown a vetu o odkaze, nikdy „nenašli“ ani Pokazilo sa', async ()=>{
  const weekly={status:'done',at:'2026-10-22T10:00:00Z',score:null,coverage:null,eu:ODKAZ_EU,failing:[],changed:[{code:'eu_withdrawal',from:'found',to:'link_found'}]};
  for(const lang of A.JAZYKY){
    const env=await spravaPre(`?id=${ID}&key=${KEY}`,z=>z.method==='GET'?{data:zaklad({weekly,lang,store_url:'https://www.obchod-a.sk/'})}:null,{lang});
    try{
      const s=TEXTY[lang].sprava,t=EU_UI[lang],x=t.rules.eu_withdrawal,text=env.doc.body.textContent;
      const badge=env.doc.vsetky().find(e=>e.className==='ar-eu-badge'&&e.textContent===x.status.link_found);
      assert.ok(badge,lang);assert.equal(badge.dataset.tone,'unknown',lang);
      assert.ok(text.includes(x.linkFound.replace('{label}','Odstúpenie od zmluvy').replace('{page}',t.pages.home)),lang);
      assert.ok(!text.includes(x.status.not_found),lang);assert.ok(!NIKDY.test(text),lang);
      assert.ok(!env.doc.vsetky().some(e=>e.tagName==='H4'&&(e.textContent===s.pokaziloNadpis||e.textContent===s.opraviloNadpis)),lang);
    }finally{env.obnov();}
  }
});

/* ---------------- relácia 208, agent M2: odkaz „Moja objednávka“ na stránku objednávky Shoptetu (weekly.eu[].order) ---------------- */
// Worker (report-mail.mjs euRules) pri not_found s orderPage pošle order {label, page}. Stráž ukáže vetu orderPage so štítkom a tónom
// not_found ako stránka kontroly; s podobným odkazom „Overte odkaz“, tón unknown a obe vety v poradí riadkov stránky kontroly.
const OBJ_EU=[{code:'eu_withdrawal',state:'not_found',order:{label:'Moja objednávka',page:'home'}},{code:'eu_guarantee_notice',state:'not_found'},{code:'eu_green_claims',state:'not_found'}];
test('208 M2: euRiadky pri not_found s order ukáže vetu o odkaze na stránku objednávky; s podobným odkazom „Overte odkaz“ a obe vety; starý i18n.mjs vetu vynechá', ()=>{
  for(const lang of A.JAZYKY){
    const t=EU_UI[lang],x=t.rules.eu_withdrawal,r=A.euRiadky(OBJ_EU,lang,zdroje)[0];
    const veta=x.orderPage.replace('{label}','Moja objednávka').replace('{page}',t.pages.home);
    assert.equal(r.badge,x.status.not_found,lang);assert.equal(r.tone,'review',lang);assert.equal(r.veta,veta,lang);
    const oba=A.euRiadky([{...OBJ_EU[0],similar:{label:'Reklamácie a vrátenie tovaru',page:'home'}},OBJ_EU[1],OBJ_EU[2]],lang,zdroje)[0];
    assert.equal(oba.badge,x.status.check,lang);assert.equal(oba.tone,'unknown',lang);
    assert.equal(oba.veta,veta+' '+x.similar.replace('{label}','Reklamácie a vrátenie tovaru').replace('{page}',t.pages.home),lang);
    assert.ok(!NIKDY.test(JSON.stringify([r,oba])),lang);
    // Prehliadač so starým i18n.mjs?v=2 (bez orderPage): veta o objednávke chýba, podobný odkaz ostane, nikdy undefined.
    const stare=structuredClone(EU_UI),s=stare[lang].rules.eu_withdrawal;delete s.orderPage;delete s.manualOrderPage;
    const r2=A.euRiadky(OBJ_EU,lang,{...zdroje,EU_UI:stare})[0],oba2=A.euRiadky([{...OBJ_EU[0],similar:{label:'Vrátenie tovaru',page:'home'}}],lang,{...zdroje,EU_UI:stare})[0];
    assert.equal(r2.veta,undefined,lang);assert.equal(r2.badge,s.status.not_found,lang);
    assert.equal(oba2.veta,s.similar.replace('{label}','Vrátenie tovaru').replace('{page}',stare[lang].pages.home),lang);
    assert.ok(!NIKDY.test(JSON.stringify([r2,oba2])),lang);
  }
  assert.equal(A.euRiadky(OBJ_EU,'sk',zdroje)[0].veta,'Na úvodnej stránke sme však našli odkaz s textom „Moja objednávka“. Vedie na stránku objednávky platformy Shoptet, kde sa načítava formulár na odstúpenie od zmluvy. Text odkazu o odstúpení nehovorí, preto ho zákazník, ktorý chce odstúpiť, nemusí nájsť.');
  // Zlý tvar, riadiace znaky a neznáma stránka nič nepokazia; order pri inom stave alebo pravidle sa nepoužije.
  assert.deepEqual(A.odkazObjednavky({order:{label:'x',page:'<x>'}}),{label:'x',page:''});assert.equal(A.odkazObjednavky({}),null);
  const zvlastny=A.euRiadky([{code:'eu_withdrawal',state:'not_found',order:[{label:'A'+String.fromCharCode(0)+'B',page:'constructor'}]}],'sk',zdroje)[0];
  assert.ok(zvlastny.veta.startsWith('Na stránke produktu sme však našli odkaz s textom „A B“.'),zvlastny.veta);
  for(const r of [{code:'eu_withdrawal',state:'not_found',order:'zle'},{code:'eu_withdrawal',state:'not_found',order:{label:'  '}},{code:'eu_withdrawal',state:'found',order:OBJ_EU[0].order}])
    assert.equal(A.euRiadky([r],'sk',zdroje)[0].veta,undefined,JSON.stringify(r));
  assert.equal(A.euRiadky([{code:'eu_green_claims',state:'not_found',order:OBJ_EU[0].order}],'sk',zdroje)[0].veta,undefined);
  // Porovnanie týždňov: order nemení pokazené ani opravené, tón not_found ostáva review.
  assert.deepEqual(A.zmenyPodlaSmeru([{code:'eu_withdrawal',from:'found',to:'not_found'}],'sk',zdroje,{eu:OBJ_EU}).pokazene.map(p=>p.code),['eu_withdrawal']);
  assert.deepEqual(A.zmenyPodlaSmeru([{code:'eu_withdrawal',from:'not_found',to:'found'}],'sk',zdroje,{eu:OBJ_EU}).opravene.map(p=>p.code),['eu_withdrawal']);
});
test('208 M2 v DOM: „Moja objednávka“ má štítok not_found s tónom review a pod ním vetu o odkaze na stránku objednávky', async ()=>{
  const weekly={status:'done',at:'2026-10-22T10:00:00Z',score:null,coverage:null,eu:OBJ_EU,failing:[],changed:[]};
  for(const lang of A.JAZYKY){
    const env=await spravaPre(`?id=${ID}&key=${KEY}`,z=>z.method==='GET'?{data:zaklad({weekly,lang,store_url:'https://www.obchod-a.sk/'})}:null,{lang});
    try{
      const t=EU_UI[lang],x=t.rules.eu_withdrawal,text=env.doc.body.textContent;
      const badge=env.doc.vsetky().find(e=>e.className==='ar-eu-badge'&&e.textContent===x.status.not_found);
      assert.ok(badge,lang);assert.equal(badge.dataset.tone,'review',lang);
      assert.ok(text.includes(x.orderPage.replace('{label}','Moja objednávka').replace('{page}',t.pages.home)),lang);
      assert.ok(!NIKDY.test(text),lang);
    }finally{env.obnov();}
  }
});
