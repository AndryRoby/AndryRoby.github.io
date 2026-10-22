// Testy kontroly na stránkach povinností EÚ (relácia 213). Spustenie: node --test products/arling-sk/kontrola-povinnosti/
// Čisté funkcie a malý falošný DOM (bez innerHTML: falošný prvok pri ňom vyhodí chybu, takže test zachytí vkladanie HTML).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import * as K from './kontrola.mjs';
import {texty,euTexty,JAZYKY,STRANKY_PRAVIDIEL,PLNA_KONTROLA,sablonaTexty} from './texty.mjs';
import {EU_UI,UI} from '../feed-doctor/agent-ready/i18n.mjs';

const TU=fileURLToPath(new URL('./',import.meta.url));
const fx=(n)=>JSON.parse(readFileSync(TU+'fixtures/'+n,'utf8'));
const INE=fx('ine-stavy.json');
const kopia=(x)=>JSON.parse(JSON.stringify(x));

/* ---------- falošný DOM ---------- */
const camel=(s)=>s.replace(/-([a-z])/g,(m,c)=>c.toUpperCase());
class Uzol{
  constructor(tag,doc){this.tagName=tag.toUpperCase();this.children=[];this.parent=null;this._t='';this.attrs={};this.dataset={};this.hidden=false;
    this.className='';this.listeners={};this.doc=doc;this.disabled=false;this.value='';this.id='';this.href='';this.rel='';this.target='';}
  get textContent(){return this.tagName==='#TEXT'?this._t:this.children.map((c)=>c.textContent).join('');}
  set textContent(v){for(const c of this.children)c.parent=null;this.children=[];if(this.tagName==='#TEXT'){this._t=String(v);return;}if(v!=null&&v!=='')this.append(String(v));}
  set innerHTML(v){throw new Error('innerHTML je zakázané');}
  get innerHTML(){throw new Error('innerHTML je zakázané');}
  insertAdjacentHTML(){throw new Error('insertAdjacentHTML je zakázané');}
  append(...xs){for(const x of xs){const n=typeof x==='string'?this.doc.createTextNode(x):x;if(n.parent)n.parent.children=n.parent.children.filter((c)=>c!==n);n.parent=this;this.children.push(n);}}
  replaceChildren(...xs){for(const c of this.children)c.parent=null;this.children=[];this.append(...xs);}
  setAttribute(k,v){this.attrs[k]=String(v);if(k==='id')this.id=String(v);}
  getAttribute(k){return Object.hasOwn(this.attrs,k)?this.attrs[k]:null;}
  removeAttribute(k){delete this.attrs[k];}
  addEventListener(t,f){(this.listeners[t]||(this.listeners[t]=[])).push(f);}
  dispatch(t){const e={type:t,target:this,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}};for(let n=this;n;n=n.parent)for(const f of n.listeners[t]||[])f(e);return e;}
  matches(s){const m=s.match(/^([a-z]*)(?:\[([a-z-]+)\])?$/);if(!m)throw new Error('selektor '+s);const [,tag,attr]=m;
    if(tag&&this.tagName!==tag.toUpperCase())return false;
    if(attr){if(attr.startsWith('data-'))return Object.hasOwn(this.dataset,camel(attr.slice(5)));return Object.hasOwn(this.attrs,attr);}return true;}
  closest(s){const casti=s.split(',').map((x)=>x.trim());for(let n=this;n;n=n.parent)if(n.tagName!=='#TEXT'&&casti.some((c)=>n.matches(c)))return n;return null;}
  potomkovia(){const out=[];const ch=(n)=>{for(const c of n.children){if(c.tagName!=='#TEXT'){out.push(c);ch(c);}}};ch(this);return out;}
  get isConnected(){let n=this;while(n.parent)n=n.parent;return n===this.doc.koren;}
  focus(){this.doc.fokus=this;}
  scrollIntoView(){}
}
class Dokument{
  constructor(lang){this.koren=new Uzol('html',this);this.documentElement=this.koren;this.koren.lang=lang;this.fokus=null;this.body=new Uzol('body',this);}
  // Ako prehliadač: skrytý alebo zakázaný prvok fokus stratí a aktívny je body.
  get activeElement(){const f=this.fokus;return f&&!f.hidden&&!f.disabled&&f.isConnected?f:this.body;}
  createElement(t){return new Uzol(t,this);}
  createTextNode(s){const n=new Uzol('#text',this);n._t=String(s);return n;}
  getElementById(id){return this.koren.potomkovia().find((n)=>n.id===id)||null;}
  querySelectorAll(s){const [a,b]=s.split(/\s+/);const prve=this.koren.potomkovia().filter((n)=>n.matches(a));if(!b)return prve;return [...new Set(prve.flatMap((n)=>n.potomkovia().filter((x)=>x.matches(b))))];}
  querySelector(s){return this.querySelectorAll(s)[0]||null;}
}
function strankaDom(lang,kod){
  const d=new Dokument(lang),u=(tag,id,rodic=d.koren)=>{const n=d.createElement(tag);if(id)n.id=id;rodic.append(n);return n;};
  const main=u('main'),sekcia=u('section',null,main),form=u('form','pk-form',sekcia);form.dataset.pravidlo=kod;
  u('input','pk-adresa',form);u('button','pk-tlacidlo',form);const zr=u('button','pk-zrusit',form);zr.hidden=true;
  u('p','pk-stav',sekcia);const v=u('div','pk-vysledok',sekcia);v.hidden=true;
  const plna=u('a',null,sekcia);plna.dataset.pkPlna='';plna.href=PLNA_KONTROLA[lang];
  const straz=u('section',null,main);straz.dataset.straz='';straz.hidden=true;const sa=u('a',null,straz);sa.href='/straz-eshopu/';
  return {d,form,input:d.getElementById('pk-adresa'),tlacidlo:d.getElementById('pk-tlacidlo'),zrusit:zr,stav:d.getElementById('pk-stav'),vysledok:v,plna,straz,strazOdkaz:sa};
}

/* ---------- prostredie testu: hodiny, fetch, Umami, Stráž ---------- */
const POVODNE={...K.deps};
function prostredie({search='',session={},umami=true,straz=null,dotyk=false}={}){
  const casovace=new Map();let n=0;
  const udalosti=[],dopyty=[],ss={...session};
  // (pointer: coarse) podľa voľby dotyk; ostatné dotazy (prefers-reduced-motion) áno.
  const win={matchMedia:(q)=>({matches:/pointer:\s*coarse/.test(q)?dotyk:true})};
  if(umami)win.umami={track:(name,data)=>udalosti.push([name,data])};
  Object.assign(K.deps,POVODNE,{
    setTimeout:(f,ms)=>{const id=++n;casovace.set(id,{f,ms});return id;},
    clearTimeout:(id)=>{casovace.delete(id);},
    win:()=>win,doc:()=>null,search:()=>search,
    session:()=>({getItem:(k)=>Object.hasOwn(ss,k)?ss[k]:null,setItem:(k,v)=>{ss[k]=String(v);}}),
    importStraz:straz||(async()=>({strazOn:async()=>false,buildStrazBox:()=>{throw new Error('nemá sa volať');}})),
    fetch:(url,init)=>new Promise((ok,zle)=>{dopyty.push({url,init,ok,zle});}),
  });
  const spustCasovace=(ms)=>{for(const [id,c] of [...casovace]){if(ms==null||c.ms===ms){casovace.delete(id);c.f();}}};
  return {udalosti,dopyty,win,casovace,spustCasovace,ss};
}
const pockaj=async(k=6)=>{for(let i=0;i<k;i++)await new Promise((r)=>setImmediate(r));};
const odpoved=(data,status=200)=>({ok:status>=200&&status<300,status,json:async()=>kopia(data)});
const texty_=(uzol)=>uzol.potomkovia().map((x)=>x.textContent);
test.afterEach(()=>{Object.assign(K.deps,POVODNE);});

/* ---------- 1. adresa ---------- */
test('adresa obchodu ako app.mjs: doplní https, len https, bez mena, hesla, # a ?', ()=>{
  assert.equal(K.adresaObchodu('obchod.example.sk')?.href,'https://obchod.example.sk/');
  assert.equal(K.adresaObchodu('  HTTPS://Obchod.Example.SK  ')?.href,'https://obchod.example.sk/');
  assert.equal(K.adresaObchodu('https://obchod.example.sk/produkt/hrnek')?.href,'https://obchod.example.sk/produkt/hrnek');
  assert.equal(K.adresaObchodu('https://obchod.example.sk:443/')?.href,'https://obchod.example.sk/');
  for(const zla of ['','   ','http://obchod.example.sk','ftp://obchod.example.sk','https://a:b@obchod.example.sk','https://obchod.example.sk/#kotva',
    'https://obchod.example.sk/?a=1','https://obchod.example.sk/?','https://obchod.example.sk/#','localhost','https://192.168.1.10/','https://[::1]/',
    'https://obchod.example.sk:8443/','javascript:alert(1)','https://'+'a'.repeat(2050)+'.sk'])
    assert.equal(K.adresaObchodu(zla),null,zla);
});

/* ---------- 2. tvar odpovede ---------- */
test('tvar odpovede: version 1.0.0, eu.version 1, známe kódy a stavy, pravidlo stránky', ()=>{
  for(const n of ['odstupenie-najdene.json','odstupenie-podobny.json','zaruka-najdena.json']){
    assert.ok(K.platnaSprava(fx(n),'eu_withdrawal'),n);assert.ok(K.platnaSprava(fx(n),'eu_guarantee_notice'),n);}
  assert.ok(K.platnaSprava(INE.link_found,'eu_withdrawal'),'link_found z relácie 208 sa prijme');
  assert.ok(K.platnaSprava(INE.nedalo_sa,'eu_guarantee_notice'));
  for(const k of ['zla_verzia','zly_stav','bez_eu','eu_null','zla_eu_verzia','neznamy_kod','dvakrat','bez_pravidla','zle_stranky'])
    assert.equal(K.platnaSprava(INE[k],'eu_withdrawal'),false,k);
  assert.equal(K.platnaSprava(null,'eu_withdrawal'),false);assert.equal(K.platnaSprava('{}','eu_withdrawal'),false);
  const zaruka=kopia(INE.link_found);zaruka.eu.rules[1].status='link_found';
  assert.equal(K.platnaSprava(zaruka,'eu_guarantee_notice'),false,'link_found pri záruke nie je známy stav');
});

/* ---------- 3. stavy oboch pravidiel ---------- */
const odst=(data)=>K.pravidloZ(data,'eu_withdrawal'),zar=(data)=>K.pravidloZ(data,'eu_guarantee_notice');
const vsetkyTexty=(m)=>[m.badge,m.title,m.applies,m.manual,m.shoptet,...m.lines.map((l)=>l.text)].filter(Boolean).join(' | ');

test('odstúpenie found: odznak, nápis, stránka, odkaz len https, ručné overenie (sk ako celá kontrola)', ()=>{
  const m=K.vyhodnot(odst(fx('odstupenie-najdene.json')),'sk'),x=EU_UI.sk.rules.eu_withdrawal;
  assert.equal(m.tone,'ok');assert.equal(m.badge,x.status.found);assert.equal(m.manual,x.manualFound);
  assert.match(m.lines[0].text,/„Odstúpiť od zmluvy tu“/);assert.match(m.lines[0].text,/úvodnej stránke/);
  assert.equal(m.lines[0].href,'https://obchod.example.sk/odstupenie/');assert.equal(m.pages,4);assert.equal(m.shoptet,null);assert.equal(m.podobny,false);
});
test('odstúpenie not_found bez podobného: review, veta o Shoptete na sk a cs', ()=>{
  const r=odst(fx('zaruka-najdena.json'));
  for(const lang of ['sk','cs']){const m=K.vyhodnot(r,lang);assert.equal(m.tone,'review');assert.match(m.shoptet,lang==='sk'?/\/moja-objednavka\//:/\/moje-objednavka\//);}
  const de=K.vyhodnot(r,'de');assert.equal(de.badge,EU_UI.de.rules.eu_withdrawal.status.not_found);assert.equal(de.shoptet,null);
});
test('česká stránka: „Odstoupit od smlouvy“ je nápis podľa § 1830a odst. 2 OZ, nie chyba', ()=>{
  const m=K.vyhodnot(odst(fx('odstupenie-podobny.json')),'cs');
  assert.equal(m.tone,'ok');assert.equal(m.badge,texty('cs').zakonStatus);assert.equal(m.podobny,true);
  assert.match(m.lines[0].text,/„Odstoupit od smlouvy“.*§ 1830a odst\. 2/);assert.equal(m.lines[0].href,'https://obchod.example.cz/odstoupeni/');
  assert.ok(m.lines.some((l)=>l.muted&&/Odstúpenie od kúpy/.test(l.text)),'ostatné podobné ostanú ako podobné');
  assert.ok(K.maFrazu('Chci odstoupit od smlouvy zde','Odstoupit od smlouvy'));
  assert.equal(K.maFrazu('Jak a kdy můžete odstoupit od smlouvy online','Odstoupit od smlouvy'),false,'najviac dve slová navyše');
  assert.equal(K.maFrazu('Odstoupení od smlouvy','Odstoupit od smlouvy'),false);
});
test('slovenská stránka: „Odstúpiť od zmluvy“ bez „tu“ je obdobná formulácia podľa § 20a ods. 2, overte', ()=>{
  const m=K.vyhodnot(odst(fx('odstupenie-podobny.json')),'sk');
  assert.equal(m.tone,'unknown');assert.equal(m.badge,EU_UI.sk.rules.eu_withdrawal.status.check);assert.equal(m.podobny,true);
  assert.ok(m.lines.some((l)=>/„Odstúpiť od zmluvy“.*§ 20a ods\. 2/.test(l.text)&&!l.muted));
  assert.ok(m.lines.some((l)=>l.muted&&/„Odstoupit od smlouvy“/.test(l.text)),'český nápis je na slovenskej stránke len podobný');
  assert.equal(m.manual,EU_UI.sk.rules.eu_withdrawal.manualNotFound);
});
test('iný podobný nápis: podobný odkaz, overte (de a en bez osobitných prípadov)', ()=>{
  for(const lang of ['de','en']){const m=K.vyhodnot(odst(fx('odstupenie-podobny.json')),lang);
    assert.equal(m.tone,'unknown');assert.equal(m.badge,EU_UI[lang].rules.eu_withdrawal.status.check);
    assert.equal(m.lines.filter((l)=>l.muted).length,3);assert.ok(!/1830a|20a/.test(vsetkyTexty(m)));}
});
test('link_found (relácia 208) a unknown', ()=>{
  const m=K.vyhodnot(odst(INE.link_found),'sk');
  assert.equal(m.tone,'unknown');assert.equal(m.podobny,true);assert.match(m.lines[0].text,/Shoptet/);assert.equal(m.lines[0].href,'https://obchod.example.sk/moja-objednavka/');
  const cs=K.vyhodnot(odst(INE.link_found),'cs');assert.equal(cs.badge,'Odkaz nalezen, funkčnost neověřena');
  for(const lang of JAZYKY){const u=K.vyhodnot(odst(INE.nedalo_sa),lang);assert.equal(u.tone,'unknown');assert.equal(u.lines.length,1);assert.equal(u.manual,null);}
});
test('záruka: found (text aj alt), not_applicable, not_found, Your Europe bez vety, unknown', ()=>{
  const f=K.vyhodnot(zar(fx('zaruka-najdena.json')),'de'),x=EU_UI.de.rules.eu_guarantee_notice;
  assert.equal(f.tone,'ok');assert.equal(f.lines[0].text,x.foundAlt.replace('{page}',EU_UI.de.pages.product));assert.equal(f.lines[1].text,x.found.replace('{page}',EU_UI.de.pages.home));
  const na=K.vyhodnot(zar(INE.link_found),'en');assert.equal(na.tone,'ok');assert.equal(na.badge,EU_UI.en.rules.eu_guarantee_notice.status.not_applicable);
  const nf=K.vyhodnot(zar(fx('odstupenie-najdene.json')),'sk');assert.equal(nf.tone,'review');assert.equal(nf.manual,EU_UI.sk.rules.eu_guarantee_notice.manual);
  for(const lang of JAZYKY){const ye=K.vyhodnot(zar(fx('odstupenie-podobny.json')),lang);
    assert.equal(ye.tone,'unknown');assert.equal(ye.podobny,true);assert.equal(ye.badge,texty(lang).overteRucne);
    assert.ok(ye.lines.some((l)=>l.text===texty(lang).yourEurope));assert.ok(ye.lines.some((l)=>l.href&&l.href.startsWith('https://europa.eu/')));}
  const u=K.vyhodnot(zar(INE.nedalo_sa),'cs');assert.equal(u.badge,'Nepodařilo se přečíst');
});
test('všetky stavy vo všetkých jazykoch: žiadny prázdny text, žiadne {label}, predpis s https', ()=>{
  const pripady=[fx('odstupenie-najdene.json'),fx('odstupenie-podobny.json'),fx('zaruka-najdena.json'),INE.link_found,INE.nedalo_sa,INE.skodlivy];
  for(const lang of JAZYKY)for(const data of pripady)for(const kod of ['eu_withdrawal','eu_guarantee_notice']){
    const m=K.vyhodnot(K.pravidloZ(data,kod),lang),t=vsetkyTexty(m);
    assert.ok(m.badge&&m.title&&m.lines.length,lang+kod);assert.ok(!/\{(label|page)\}|undefined|null/.test(t),lang+kod+t);
    assert.ok(m.law.length>=1&&m.law.every(([a,h])=>a&&h.startsWith('https://')),lang+kod);
  }
  assert.ok(K.vyhodnot(odst(INE.nedalo_sa),'de').law[0][0].startsWith('§ 356a BGB'));
  assert.ok(K.vyhodnot(zar(INE.nedalo_sa),'de').law[0][0].startsWith('Art. 246a § 1 Abs. 1 Satz 1 Nr. 11 EGBGB'));
  assert.ok(K.vyhodnot(odst(INE.nedalo_sa),'cs').law[0][0].startsWith('§ 1830a'));
  assert.ok(K.vyhodnot(zar(INE.nedalo_sa),'sk').law.some(([a])=>a.startsWith('§ 5 ods. 1 písm. f)')));
  assert.ok(K.vyhodnot(odst(INE.nedalo_sa),'en').law[0][0].startsWith('Art. 11a'));
});
test('sk, en, de hovoria slovo od slova ako celá kontrola (EU_UI a UI); EU_UI sa nemení', ()=>{
  const pred=JSON.stringify(EU_UI);
  for(const lang of ['sk','en','de']){const e=euTexty(lang),t=texty(lang);
    // Výnimky kola 1: sk notFound (netvrdí neprítomnosť) a en applies (výhrada pre Česko); ostatné slovo od slova.
    if(lang!=='sk')assert.equal(e.rules.eu_withdrawal.notFound,EU_UI[lang].rules.eu_withdrawal.notFound);
    assert.equal(e.rules.eu_guarantee_notice.manual,EU_UI[lang].rules.eu_guarantee_notice.manual);
    if(lang!=='en')assert.equal(e.rules.eu_guarantee_notice.applies,EU_UI[lang].rules.eu_guarantee_notice.applies);
    assert.equal(e.rules.eu_withdrawal.applies,EU_UI[lang].rules.eu_withdrawal.applies);
    assert.equal(t.busy,UI[lang].busy);assert.equal(t.cancelled,UI[lang].cancelled);}
  euTexty('de').rules.eu_withdrawal.law.push(['x','https://x.example']);
  assert.equal(JSON.stringify(EU_UI),pred);
});

/* ---------- 3b. opravy kola 1 ---------- */
const sPodobnym=(labels)=>{const d=kopia(fx('odstupenie-podobny.json'));const r=d.eu.rules.find((x)=>x.code==='eu_withdrawal');
  r.similar=labels.map((label,i)=>({page:'home',url:'https://obchod.example.cz/',label,href:'https://obchod.example.cz/o'+i+'/'}));return d;};
test('cs: zelený „Nápis podle zákona nalezen“ len povoleným zoznamom; otázky, zápor a dodatky sú „Ověřte odkaz“', ()=>{
  // Brána kolo 2 (audit/kolo2-fraza.mjs): zápor, podmienky, poučenie a pdf dostávali pri maFrazu(...,1) falošne zelený odznak.
  for(const l of ['Jak odstoupit od smlouvy','Kdy můžete odstoupit od smlouvy','Jak a kdy odstoupit od smlouvy','Nelze odstoupit od smlouvy',
    'Podmínky odstoupit od smlouvy','Odstoupit od smlouvy poučení','Odstoupit od smlouvy (pdf)','Online odstoupit od smlouvy']){
    const m=K.vyhodnot(odst(sPodobnym([l])),'cs');assert.equal(m.tone,'unknown',l);assert.equal(m.badge,'Ověřte odkaz',l);assert.notEqual(m.badge,texty('cs').zakonStatus);}
  for(const l of ['Odstoupit od smlouvy','Odstoupit od smlouvy zde','ODSTOUPIT OD SMLOUVY','Odstoupit od smlouvy »','Odstoupit od smlouvy tady']){
    const m=K.vyhodnot(odst(sPodobnym([l])),'cs');assert.equal(m.tone,'ok',l);assert.equal(m.badge,texty('cs').zakonStatus,l);}
  assert.equal(K.vyhodnot(odst(sPodobnym(['Odstoupit od smlouvy'])),'sk').badge,EU_UI.sk.rules.eu_withdrawal.status.check,'len česká stránka');
});
test('sk not_found: veta netvrdí, že odkaz „nie je“; pri podobnom nápise bez odseku o Shoptete', ()=>{
  const nf=euTexty('sk').rules.eu_withdrawal.notFound;assert.ok(!/nie je/.test(nf));assert.match(nf,/sme na prečítaných stránkach nenašli/);
  const m=K.vyhodnot(odst(fx('odstupenie-podobny.json')),'sk');assert.equal(m.lines[0].text,nf);assert.equal(m.shoptet,null);
  assert.ok(K.vyhodnot(odst(fx('zaruka-najdena.json')),'sk').shoptet,'bez podobného nápisu odsek o Shoptete ostáva');
});
test('Shoptet (kolo 3): poznámka hovorí, že „Moja objednávka“ nestačí, a pri odkaze na stránku objednávky sa neukáže', ()=>{
  const sk=K.vyhodnot(odst(fx('zaruka-najdena.json')),'sk').shoptet,cs=K.vyhodnot(odst(fx('zaruka-najdena.json')),'cs').shoptet;
  assert.match(sk,/„Moja objednávka“ však o odstúpení nehovorí/);assert.match(sk,/„odstúpiť od zmluvy tu“ alebo obdobnú jednoznačnú formuláciu/);assert.match(sk,/na \/moja-objednavka\//);
  assert.match(cs,/„Moje objednávka“ ale o odstoupení nemluví/);assert.match(cs,/„Odstoupit od smlouvy“ nebo jinou odpovídající jednoznačnou formulaci/);assert.match(cs,/na \/moje-objednavka\//);
  assert.ok(!/neznamená chybu|nemusí rozpoznať|nemusí rozpoznat/.test(sk+cs),'poznámka netvrdí, že výsledok nie je chyba');
  // Relácia 208: API pošle pri not_found pole orderPage (odkaz „Moja objednávka“); poznámka by opakovala vetu orderPage.
  const d=kopia(fx('zaruka-najdena.json')),r=d.eu.rules.find((x)=>x.code==='eu_withdrawal');
  r.status='not_found';r.similar=[];r.orderPage=[{page:'home',label:'Moja objednávka',href:'https://obchod.example.sk/moja-objednavka/'}];
  for(const lang of ['sk','cs']){const m=K.vyhodnot(odst(d),lang);
    assert.equal(m.shoptet,null,lang);assert.ok(m.lines.some((l)=>/Shoptet/.test(l.text)&&l.href==='https://obchod.example.sk/moja-objednavka/'),lang);
    assert.equal(m.manual,euTexty(lang).rules.eu_withdrawal.manualOrderPage,lang);}
  const {obsah}=K.vysledokObsah(strankaDom('sk','eu_withdrawal').d,d,'eu_withdrawal','sk');
  assert.ok(!obsah.potomkovia().some((n)=>n.className.includes('pk-v-shoptet')),'odsek o Shoptete sa nevloží');
});
test('en záruka: platnosť s výhradou pre Česko (anglická stránka je pre celú EÚ)', ()=>{
  const m=K.vyhodnot(zar(fx('zaruka-najdena.json')),'en');assert.match(m.applies,/Slovakia and Germany/);assert.match(m.applies,/Czechia/);
  assert.notEqual(m.applies,EU_UI.en.rules.eu_guarantee_notice.applies);
  assert.equal(K.vyhodnot(zar(fx('zaruka-najdena.json')),'de').applies,EU_UI.de.rules.eu_guarantee_notice.applies);
});

test('en stránka záruky: výsledok vo všetkých stavoch píše „shop“, nikdy „store“ (jazyk kolo 2)', ()=>{
  const pripady=[fx('odstupenie-najdene.json'),fx('odstupenie-podobny.json'),fx('zaruka-najdena.json'),INE.link_found,INE.nedalo_sa];
  for(const data of pripady){const {d}=strankaDom('en','eu_guarantee_notice');const {obsah}=K.vysledokObsah(d,data,'eu_guarantee_notice','en');
    assert.ok(!/\bstores?\b/i.test(obsah.textContent),obsah.textContent);}
  assert.equal(K.vyhodnot(zar(INE.nedalo_sa),'en').lines[0].text,'We could not read any page of the shop.');
});

/* ---------- 4. vkladanie ---------- */
test('škodlivý nápis ostane textom, odkaz len https, adresa obchodu len https', ()=>{
  const {d}=strankaDom('sk','eu_withdrawal');
  const {obsah}=K.vysledokObsah(d,INE.skodlivy,'eu_withdrawal','sk');
  const vsetko=obsah.potomkovia();
  assert.ok(!vsetko.some((n)=>n.tagName==='IMG'||n.tagName==='SCRIPT'),'žiadny img ani script');
  assert.ok(texty_(obsah).some((t)=>t.includes('<img src=x onerror=alert(1)>')),'nápis je viditeľný ako text');
  const odkazy=vsetko.filter((n)=>n.tagName==='A');
  assert.ok(odkazy.length>0&&odkazy.every((a)=>a.href.startsWith('https://')||a.href.startsWith('/')),odkazy.map((a)=>a.href).join());
  assert.ok(!odkazy.some((a)=>/javascript:|data:|http:\/\//.test(a.href)));
  assert.ok(!vsetko.some((n)=>n.className.includes('pk-v-obchod')),'adresa javascript: sa neukáže');
  for(const a of odkazy)if(a.href.startsWith('https://'))assert.equal(a.rel,'noopener');
});

/* ---------- 5. tok na stránke ---------- */
test('platná adresa: GET s credentials omit a cache no-store, výsledok, tlačidlo späť, Umami bez adresy', async()=>{
  const env=prostredie();const s=strankaDom('cs','eu_withdrawal');const c=K.spusti(s.d);
  assert.equal(c.lang,'cs');assert.deepEqual(env.udalosti[0],['ar_duty_view',{rule:'eu_withdrawal',lang:'cs'}]);
  s.input.value='obchod.example.cz';s.form.dispatch('submit');
  assert.equal(s.tlacidlo.disabled,true);assert.equal(s.zrusit.hidden,false);assert.equal(s.stav.textContent,texty('cs').busy);
  const q=env.dopyty[0];assert.equal(q.url,K.API+'?url='+encodeURIComponent('https://obchod.example.cz/'));
  assert.equal(q.init.credentials,'omit');assert.equal(q.init.cache,'no-store');assert.ok(q.init.signal);
  q.ok(odpoved(fx('odstupenie-podobny.json')));await pockaj();
  assert.equal(s.vysledok.hidden,false);assert.equal(s.stav.textContent,'');assert.equal(s.tlacidlo.disabled,false);assert.equal(s.zrusit.hidden,true);
  assert.equal(s.input.value,'https://obchod.example.cz/');assert.equal(s.d.fokus,s.vysledok);
  const t=s.vysledok.textContent;assert.match(t,/§\s1830a odst\.\s2/,'skratka a číslo s nezlomiteľnou medzerou');assert.match(t,/Oznámení o zákonné záruce:/);
  const ved=s.vysledok.potomkovia().find((n)=>n.dataset.pkPravidlo);assert.equal(ved.href,STRANKY_PRAVIDIEL.eu_guarantee_notice.cs);
  assert.deepEqual(env.udalosti.map((u)=>u[0]),['ar_duty_view','ar_duty_check','ar_duty_result']);
  assert.deepEqual(env.udalosti[2][1],{rule:'eu_withdrawal',lang:'cs',status:'not_found',podobny:'ano'});
  assert.ok(!JSON.stringify(env.udalosti).includes('example'),'Umami nikdy nedostane adresu obchodu');
  for(const a of s.vysledok.potomkovia().filter((n)=>n.dataset.pkPlna!==undefined))assert.equal(a.href,'/feed-doctor/agent-ready/sk/');
  s.vysledok.potomkovia().find((n)=>n.className==='pk-v-plna').children.at(-1).dispatch('click');
  assert.deepEqual(env.udalosti.at(-1),['ar_duty_to_check',{rule:'eu_withdrawal',lang:'cs'}]);
});
test('nemecká stránka záruky: vedľajší riadok s § 356a BGB a celou kontrolou', async()=>{
  const env=prostredie();const s=strankaDom('de','eu_guarantee_notice');K.spusti(s.d);
  s.input.value='https://kerzen.example.de';s.form.dispatch('submit');env.dopyty[0].ok(odpoved(fx('zaruka-najdena.json')));await pockaj();
  const ved=s.vysledok.potomkovia().find((n)=>n.className==='pk-v-vedlajsi');
  const a=ved.children.filter((n)=>n.tagName==='A');assert.equal(a[0].href,'https://www.gesetze-im-internet.de/bgb/__356a.html');assert.equal(a[1].href,'/feed-doctor/agent-ready/de/');
  assert.deepEqual(env.udalosti.at(-1)[1],{rule:'eu_guarantee_notice',lang:'de',status:'found',podobny:'nie'});
});
for(const poradie of ['nová prvá','stará prvá']){
  test(`súbeh: dve odpovede, ${poradie}, stará nič neprepíše`, async()=>{
    const env=prostredie();const s=strankaDom('sk','eu_withdrawal');K.spusti(s.d);
    s.input.value='https://a.example.sk';s.form.dispatch('submit');
    s.input.value='https://b.example.sk';s.input.dispatch('input');s.form.dispatch('submit');
    const A={...fx('odstupenie-najdene.json'),storeUrl:'https://a.example.sk/'},B={...fx('odstupenie-podobny.json'),storeUrl:'https://b.example.sk/'};
    assert.ok(env.dopyty[0].init.signal.aborted,'prvý dopyt je zrušený');
    if(poradie==='nová prvá'){env.dopyty[1].ok(odpoved(B));await pockaj();env.dopyty[0].ok(odpoved(A));await pockaj();}
    else{env.dopyty[0].ok(odpoved(A));await pockaj();assert.equal(s.vysledok.hidden,true,'stará odpoveď sa neukáže');env.dopyty[1].ok(odpoved(B));await pockaj();}
    assert.match(s.vysledok.textContent,/b\.example\.sk/);assert.ok(!s.vysledok.textContent.includes('a.example.sk'));
    assert.equal(env.udalosti.filter((u)=>u[0]==='ar_duty_result').length,1);
  });
}
test('súbeh bez úpravy poľa: druhé odoslanie nahradí prvé', async()=>{
  const env=prostredie();const s=strankaDom('sk','eu_withdrawal');const c=K.spusti(s.d);
  s.input.value='https://a.example.sk';const p1=c.skontroluj();s.input.value='https://b.example.sk';const p2=c.skontroluj();
  env.dopyty[1].ok(odpoved({...fx('odstupenie-najdene.json'),storeUrl:'https://b.example.sk/'}));
  env.dopyty[0].zle(new Error('AbortError'));await Promise.all([p1,p2]);
  assert.match(s.vysledok.textContent,/b\.example\.sk/);assert.equal(s.stav.textContent,'');assert.equal(s.tlacidlo.disabled,false);
});
const CHYBY=[
  ['429',(q)=>q.ok(odpoved({error:'rate_limited'},429)),'rate'],
  ['503',(q)=>q.ok(odpoved({error:'not_available'},503)),'nedostupna'],
  ['400',(q)=>q.ok(odpoved({error:'invalid_public_url'},400)),'adresaServer'],
  ['502',(q)=>q.ok(odpoved({error:'scan_failed'},502)),'server'],
  ['sieť',(q)=>q.zle(new TypeError('Failed to fetch')),'siet'],
  ['zlý JSON',(q)=>q.ok({ok:true,status:200,json:async()=>{throw new SyntaxError('x');}}),'tvar'],
  ['zlý tvar',(q)=>q.ok(odpoved(INE.zla_verzia)),'tvar'],
  ['bez eu',(q)=>q.ok(odpoved(INE.bez_eu)),'tvar'],
];
for(const [nazov,akcia,kluc] of CHYBY){
  test(`chyba ${nazov}: veta s ďalším krokom, adresa ostane, nič sa neukáže ako hotové`, async()=>{
    const env=prostredie();const s=strankaDom('en','eu_guarantee_notice');K.spusti(s.d);
    s.input.value='https://shop.example.com/';s.form.dispatch('submit');akcia(env.dopyty[0]);await pockaj();
    assert.equal(s.stav.textContent,texty('en').chyby[kluc]);assert.equal(s.vysledok.hidden,true);assert.equal(s.vysledok.children.length,0);
    assert.equal(s.input.value,'https://shop.example.com/');assert.equal(s.tlacidlo.disabled,false);assert.equal(s.zrusit.hidden,true);
    assert.ok(!env.udalosti.some((u)=>u[0]==='ar_duty_result'));
  });
}
test('časový limit 65 s: veta o limite, neskorá odpoveď sa zahodí', async()=>{
  const env=prostredie();const s=strankaDom('sk','eu_guarantee_notice');K.spusti(s.d);
  s.input.value='https://obchod.example.sk';s.form.dispatch('submit');
  assert.ok([...env.casovace.values()].some((c)=>c.ms===65000));
  env.spustCasovace(65000);assert.equal(s.stav.textContent,texty('sk').chyby.limit);assert.ok(env.dopyty[0].init.signal.aborted);assert.equal(s.tlacidlo.disabled,false);
  env.dopyty[0].ok(odpoved(fx('odstupenie-najdene.json')));await pockaj();
  assert.equal(s.vysledok.hidden,true);assert.equal(s.stav.textContent,texty('sk').chyby.limit);
});
test('Zrušiť: veta, adresa ostane, neskorá odpoveď sa zahodí', async()=>{
  const env=prostredie();const s=strankaDom('sk','eu_withdrawal');K.spusti(s.d);
  s.input.value='https://obchod.example.sk';s.form.dispatch('submit');s.zrusit.dispatch('click');
  assert.equal(s.stav.textContent,texty('sk').cancelled);assert.equal(s.zrusit.hidden,true);
  env.dopyty[0].ok(odpoved(fx('odstupenie-najdene.json')));await pockaj();
  assert.equal(s.vysledok.hidden,true);assert.equal(s.input.value,'https://obchod.example.sk/');
});
test('fokus (myš a klávesnica): beh na Zrušiť, Zrušiť, chyba a limit do poľa adresy, výsledok na výsledok, nikdy body', async()=>{
  // Odoslanie z tlačidla: tlačidlo sa zakáže, fokus prejde na Zrušiť (brána kolo 2), nie do poľa.
  let env=prostredie();let s=strankaDom('cs','eu_withdrawal');K.spusti(s.d);
  s.input.value='https://obchod.example.cz';s.tlacidlo.focus();s.form.dispatch('submit');
  assert.equal(s.tlacidlo.disabled,true);assert.equal(s.d.activeElement,s.zrusit,'po odoslaní tlačidlom');
  // Zrušiť: tlačidlo Zrušiť sa skryje, fokus ide do poľa.
  s.zrusit.focus();s.zrusit.dispatch('click');assert.equal(s.zrusit.hidden,true);assert.equal(s.d.activeElement,s.input,'po Zrušiť');
  // Chyba 503 s fokusom na body.
  env=prostredie();s=strankaDom('de','eu_guarantee_notice');K.spusti(s.d);
  s.input.value='https://shop.example.de';s.form.dispatch('submit');s.d.fokus=null;
  env.dopyty[0].ok(odpoved({error:'not_available'},503));await pockaj();
  assert.equal(s.d.activeElement,s.input,'po chybe');assert.equal(s.stav.dataset.tone,'chyba');
  // Ďalší beh: tón chyby zmizne, kým beží kontrola, a po výsledku je fokus na výsledku.
  s.form.dispatch('submit');assert.equal(s.stav.dataset.tone,undefined);assert.equal(s.stav.textContent,texty('de').busy);
  env.dopyty[1].ok(odpoved(fx('zaruka-najdena.json')));await pockaj();assert.equal(s.d.activeElement,s.vysledok);
  // Limit 65 s.
  env=prostredie();s=strankaDom('sk','eu_guarantee_notice');K.spusti(s.d);
  s.input.value='https://obchod.example.sk';s.tlacidlo.focus();s.form.dispatch('submit');s.d.fokus=null;env.spustCasovace(65000);
  assert.equal(s.d.activeElement,s.input,'po limite');assert.equal(s.stav.dataset.tone,'chyba');
  // Neplatná adresa je tiež chyba.
  s.input.value='http://x';s.form.dispatch('submit');assert.equal(s.stav.dataset.tone,'chyba');
  s.input.dispatch('input');assert.equal(s.stav.dataset.tone,undefined);
  // Enter v poli pri myši a klávesnici: fokus ostane v poli.
  env=prostredie();s=strankaDom('sk','eu_withdrawal');K.spusti(s.d);
  s.input.value='https://obchod.example.sk';s.input.focus();s.form.dispatch('submit');assert.equal(s.d.activeElement,s.input,'Enter v poli');
});
test('fokus na dotyku (pointer: coarse): pole nikdy počas behu ani po ňom, beh na Zrušiť, chyba na stavovú vetu', async()=>{
  // Ťuknutie na tlačidlo (iOS: fokus na body, Android: na tlačidle) aj Enter zo softvérovej klávesnice (fokus v poli).
  for(const zaciatok of ['body','tlacidlo','pole']){
    const env=prostredie({dotyk:true});const s=strankaDom('sk','eu_withdrawal');K.spusti(s.d);
    s.input.value='https://obchod.example.sk';
    if(zaciatok==='tlacidlo')s.tlacidlo.focus();else if(zaciatok==='pole')s.input.focus();else s.d.fokus=null;
    s.form.dispatch('submit');
    assert.equal(s.d.activeElement,s.zrusit,'beh: '+zaciatok);assert.notEqual(s.d.activeElement,s.input);
    env.dopyty[0].ok(odpoved({error:'not_available'},503));await pockaj();
    assert.equal(s.stav.textContent,texty('sk').chyby.nedostupna);assert.equal(s.d.activeElement,s.stav,'chyba: '+zaciatok);
    assert.equal(s.stav.getAttribute('tabindex'),'-1');
    // Druhý beh s výsledkom: fokus na výsledku, nie v poli.
    s.form.dispatch('submit');assert.equal(s.d.activeElement,s.zrusit);
    env.dopyty[1].ok(odpoved(fx('odstupenie-najdene.json')));await pockaj();assert.equal(s.d.activeElement,s.vysledok,'výsledok: '+zaciatok);
  }
  // Limit 65 s na dotyku: stavová veta, nie pole.
  const env=prostredie({dotyk:true});const s=strankaDom('cs','eu_guarantee_notice');K.spusti(s.d);
  s.input.value='https://obchod.example.cz';s.tlacidlo.focus();s.form.dispatch('submit');env.spustCasovace(65000);
  assert.equal(s.stav.textContent,texty('cs').chyby.limit);assert.equal(s.d.activeElement,s.stav,'po limite');
  // Zlá adresa a Zrušiť: používateľ chce písať, fokus do poľa aj na dotyku.
  s.input.value='http://x';s.form.dispatch('submit');assert.equal(s.d.activeElement,s.input,'zlá adresa');
  s.input.value='https://obchod.example.cz';s.tlacidlo.focus();s.form.dispatch('submit');s.zrusit.dispatch('click');assert.equal(s.d.activeElement,s.input,'Zrušiť');
});
test('fokus pri chybe s myšou: stavová veta má tabindex -1, ale fokus ide do poľa', async()=>{
  const env=prostredie();const s=strankaDom('en','eu_guarantee_notice');K.spusti(s.d);
  s.input.value='https://shop.example.com';s.tlacidlo.focus();s.form.dispatch('submit');assert.equal(s.d.activeElement,s.zrusit);
  env.dopyty[0].ok(odpoved({error:'rate_limited'},429));await pockaj();assert.equal(s.d.activeElement,s.input);
});
test('skok z úvodu: posunie na kontrolu a dá fokus do poľa', ()=>{
  prostredie();const s=strankaDom('cs','eu_withdrawal');
  const sekcia=s.form.parent;sekcia.id='kontrola';let posun=null;sekcia.scrollIntoView=(o)=>{posun=o;};
  const a=s.d.createElement('a');a.dataset.pkSkok='';a.href='#kontrola';s.d.koren.append(a);
  K.spusti(s.d);const e=a.dispatch('click');
  assert.equal(e.defaultPrevented,true);assert.deepEqual(posun,{behavior:'auto',block:'start'});assert.equal(s.d.activeElement,s.input);
});
test('neplatná adresa: žiadny dopyt, veta, aria-invalid; úprava poľa ju zmaže', ()=>{
  const env=prostredie();const s=strankaDom('de','eu_guarantee_notice');K.spusti(s.d);
  s.input.value='http://shop.example.de/?x=1';s.form.dispatch('submit');
  assert.equal(env.dopyty.length,0);assert.equal(s.stav.textContent,texty('de').chyby.adresa);assert.equal(s.input.getAttribute('aria-invalid'),'true');
  assert.equal(s.input.value,'http://shop.example.de/?x=1');assert.ok(!env.udalosti.some((u)=>u[0]==='ar_duty_check'));
  s.input.dispatch('input');assert.equal(s.input.getAttribute('aria-invalid'),null);assert.equal(s.stav.textContent,'');
});

/* ---------- 6. Umami ---------- */
test('Umami ticho pri ?test aj pri sessionStorage straz:test', async()=>{
  for(const opt of [{search:'?test'},{search:'?a=1&test=0'},{session:{'straz:test':'1'}}]){
    const env=prostredie(opt);const s=strankaDom('sk','eu_withdrawal');K.spusti(s.d);
    s.input.value='https://obchod.example.sk';s.form.dispatch('submit');env.dopyty[0].ok(odpoved(fx('odstupenie-najdene.json')));await pockaj();
    s.plna.dispatch('click');s.strazOdkaz.dispatch('click');
    assert.equal(s.vysledok.hidden,false);assert.deepEqual(env.udalosti,[],JSON.stringify(opt));assert.equal(env.win.__pkFronta,undefined);
  }
});
test('Umami fronta: udalosti počkajú na načítanie skriptu a pôjdu bez adresy', async()=>{
  const env=prostredie({umami:false});const s=strankaDom('en','eu_guarantee_notice');K.spusti(s.d);
  s.input.value='https://shop.example.com';s.form.dispatch('submit');env.dopyty[0].ok(odpoved(fx('zaruka-najdena.json')));await pockaj();
  assert.deepEqual(env.win.__pkFronta.map((x)=>x[0]),['ar_duty_view','ar_duty_check','ar_duty_result']);
  env.spustCasovace(500);assert.equal(env.win.__pkFronta.length,3,'Umami ešte nie je');
  const prijate=[];env.win.umami={track:(n,d)=>prijate.push([n,d])};env.spustCasovace(500);
  assert.deepEqual(prijate.map((x)=>x[0]),['ar_duty_view','ar_duty_check','ar_duty_result']);assert.equal(env.win.__pkFronta.length,0);
  for(const [,d] of prijate){assert.ok(Object.keys(d).every((k)=>['rule','lang','status','podobny','place'].includes(k)));assert.ok(!JSON.stringify(d).includes('example'));}
});

/* ---------- 7. Stráž ---------- */
function strazMock(zaznam,on=true){
  return async()=>({strazOn:async()=>on,buildStrazBox:(L,place,platform,report)=>{zaznam.push({L,place,platform,report});
    const box=new Dokument('sk').createElement('section');box.doc=zaznam.doc;box.dataset.place=place;box.className='ar-straz';
    const b=zaznam.doc.createElement('button');box.append(b);zaznam.tlacidlo=b;return box;}});
}
for(const [lang,L] of [['cs','sk'],['sk','sk'],['de','de'],['en','en']]){
  test(`Stráž pri strazOn true (${lang}): odkrytá ponuka a box s jazykom ${L}`, async()=>{
    const zaznam=[];const s=strankaDom(lang,'eu_guarantee_notice');zaznam.doc=s.d;
    const env=prostredie({straz:strazMock(zaznam)});K.spusti(s.d);await pockaj();
    assert.equal(s.straz.hidden,false);
    s.input.value='https://obchod.example.sk';s.form.dispatch('submit');env.dopyty[0].ok(odpoved(fx('odstupenie-najdene.json')));await pockaj();
    assert.equal(zaznam.length,1);assert.deepEqual([zaznam[0].L,zaznam[0].place,zaznam[0].platform],[L,'result','unknown']);assert.equal(zaznam[0].report.storeUrl,'https://obchod.example.sk/');
    const jazyk=s.vysledok.potomkovia().find((n)=>n.className==='pk-v-straz-jazyk');
    if(lang==='cs')assert.equal(jazyk.textContent,texty('cs').strazJazyk);else assert.equal(jazyk,undefined);
    zaznam.tlacidlo.dispatch('click');assert.deepEqual(env.udalosti.at(-1),['ar_duty_straz',{rule:'eu_guarantee_notice',lang,place:'box'}]);
    s.strazOdkaz.dispatch('click');assert.deepEqual(env.udalosti.at(-1),['ar_duty_straz',{rule:'eu_guarantee_notice',lang,place:'ponuka'}]);
  });
}
for(const [nazov,imp] of [
  ['strazOn false',async()=>({strazOn:async()=>false,buildStrazBox:()=>{throw new Error('x');}})],
  ['chyba importu',async()=>{throw new Error('404');}],
  ['strazOn vráti reťazec',async()=>({strazOn:async()=>'true',buildStrazBox:()=>{throw new Error('x');}})],
]){
  test(`Stráž sa neukáže nikde: ${nazov}`, async()=>{
    const env=prostredie({straz:imp});const s=strankaDom('sk','eu_withdrawal');K.spusti(s.d);await pockaj();
    s.input.value='https://obchod.example.sk';s.form.dispatch('submit');env.dopyty[0].ok(odpoved(fx('odstupenie-najdene.json')));await pockaj();
    assert.equal(s.straz.hidden,true);assert.equal(s.vysledok.hidden,false);assert.ok(!s.vysledok.potomkovia().some((n)=>n.className==='ar-straz'));
  });
}
test('Stráž pomalá: po 4 s rozhodnuté nie, neskoré áno sa už neukáže', async()=>{
  let pusti;const zaznam=[];
  const env=prostredie({straz:()=>new Promise((ok)=>{pusti=ok;})});const s=strankaDom('sk','eu_withdrawal');zaznam.doc=s.d;K.spusti(s.d);
  env.spustCasovace(4000);await pockaj();
  pusti(await strazMock(zaznam)());await pockaj();
  s.input.value='https://obchod.example.sk';s.form.dispatch('submit');env.dopyty[0].ok(odpoved(fx('odstupenie-najdene.json')));await pockaj();
  assert.equal(s.straz.hidden,true);assert.equal(zaznam.length,0);assert.equal(s.vysledok.hidden,false);
});

/* ---------- 8. súbory ---------- */
const POMLCKY=new RegExp('['+String.fromCharCode(0x2013,0x2014)+']');
test('zdrojové súbory: žiadne pomlčky em a en, žiadne innerHTML ani eval', ()=>{
  for(const n of ['kontrola.mjs','texty.mjs','kontrola.css','kontrola.test.mjs']){
    const s=readFileSync(TU+n,'utf8');assert.ok(!POMLCKY.test(s),n);
    if(n!=='kontrola.test.mjs')assert.ok(!/innerHTML|insertAdjacentHTML|eval\(|new Function/.test(s),n);
  }
  for(const lang of JAZYKY){const t=JSON.stringify(sablonaTexty(lang))+JSON.stringify(euTexty(lang));assert.ok(!POMLCKY.test(t),lang);}
});
test('mapy stránok a celej kontroly', ()=>{
  assert.deepEqual(PLNA_KONTROLA,{sk:'/feed-doctor/agent-ready/sk/',cs:'/feed-doctor/agent-ready/sk/',de:'/feed-doctor/agent-ready/de/',en:'/feed-doctor/agent-ready/'});
  assert.deepEqual(Object.keys(STRANKY_PRAVIDIEL.eu_withdrawal),['sk','cs']);assert.deepEqual(Object.keys(STRANKY_PRAVIDIEL.eu_guarantee_notice),['sk','cs','de','en']);
  assert.equal(K.STRAZ_MODUL,'/feed-doctor/agent-ready/straz.mjs?v=2');
});
