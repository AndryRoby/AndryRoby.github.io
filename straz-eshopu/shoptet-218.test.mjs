// shoptet-218.test.mjs: relácia 218 (23. 10. 2026), stavač A-jadro. Spustenie: node --test products/arling-sk/straz-eshopu/shoptet-218.test.mjs
// Stránka Stráže (euRiadky) pri weekly.eu {code:'eu_withdrawal', state:'not_found', shoptet:true} z workera (report-mail.mjs euRules):
// veta, že Shoptet má funkciu zabudovanú, pred podobným odkazom; postup v administrácii ako samostatné pole postup s nadpisom
// „Overte ručne“ (brána 218 D1: nie na konci tlmenej vety); štítok a tón ostávajú ako pri not_found. Nie pri r.order, inom stave,
// inom type príznaku ani so starým i18n.mjs bez týchto kľúčov. Bez opravy test zlyhá (vykreslenie: app.test.mjs „218 D1 v DOM“).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as A from './app.mjs';
import {EU_UI,localRule} from '../feed-doctor/agent-ready/i18n.mjs?v=3';
import {toneOf,EU_CODES} from '../feed-doctor/agent-ready/eu-zobraz.mjs';
import {RULES} from '../feed-doctor/agent-ready/core.mjs';

const zdroje={EU_UI,toneOf,EU_CODES,RULES,localRule};
const LANGS=['sk','en','de'];
const riadok=(eu,lang,z=zdroje)=>A.euRiadky(eu,lang,z).find(r=>r.code==='eu_withdrawal');

test('218 Stráž: Shoptet bez odkazu na stránku objednávky má vetu a postup v SK, EN, DE; štítok a tón not_found', ()=>{
  for(const lang of LANGS){const x=EU_UI[lang].rules.eu_withdrawal,r=riadok([{code:'eu_withdrawal',state:'not_found',shoptet:true}],lang);
    assert.equal(r.veta,x.shoptetNoLink,lang);
    // Brána 218 D1: postup je samostatný odsek s nadpisom ručnej kontroly (SK „Overte ručne“, EN „Check by hand“, DE „Selbst prüfen“).
    assert.equal(r.postup,x.manualShoptetNoLink,lang);assert.equal(r.postupNadpis,EU_UI[lang].manual,lang);
    assert.equal(r.badge,x.status.not_found,lang);assert.equal(r.tone,'review',lang);}
  assert.deepEqual(LANGS.map(l=>riadok([{code:'eu_withdrawal',state:'not_found',shoptet:true}],l).postupNadpis),['Overte ručne','Check by hand','Selbst prüfen']);
});

test('218 Stráž: s podobným odkazom „Overte odkaz“, veta o Shoptete pred podobným odkazom a postup samostatne', ()=>{
  for(const lang of LANGS){const t=EU_UI[lang],x=t.rules.eu_withdrawal;
    const r=riadok([{code:'eu_withdrawal',state:'not_found',similar:{label:'Vrátenie tovaru',page:'home'},shoptet:true}],lang);
    const podobny=x.similar.replace('{label}','Vrátenie tovaru').replace('{page}',t.pages.home);
    assert.equal(r.veta,`${x.shoptetNoLink} ${podobny}`,lang);assert.equal(r.postup,x.manualShoptetNoLink,lang);
    assert.equal(r.badge,x.status.check,lang);assert.equal(r.tone,'unknown',lang);}
});

test('218 Stráž: bez príznaku, s iným typom, v inom stave alebo s odkazom „Moja objednávka“ veta o Shoptete nie je', ()=>{
  for(const lang of LANGS){const x=EU_UI[lang].rules.eu_withdrawal;
    for(const e of [{code:'eu_withdrawal',state:'not_found'},{code:'eu_withdrawal',state:'not_found',shoptet:'true'},{code:'eu_withdrawal',state:'found',shoptet:true},
      {code:'eu_withdrawal',state:'link_found',link:{label:'Odstúpenie od zmluvy',page:'home'},shoptet:true},
      {code:'eu_withdrawal',state:'not_found',order:{label:'Moja objednávka',page:'home'},shoptet:true}]){
      const r=riadok([e],lang);assert.ok(!(r.veta||'').includes(x.shoptetNoLink),lang+' '+JSON.stringify(e));
      assert.equal(r.postup,undefined,lang+' '+JSON.stringify(e));assert.equal(r.postupNadpis,undefined,lang);}
    // Iné pravidlo s príznakom nič nedostane.
    const g=A.euRiadky([{code:'eu_guarantee_notice',state:'not_found',shoptet:true}],lang,zdroje)[0];
    assert.equal(g.veta,undefined,lang);}
});

test('218 Stráž: starý i18n.mjs?v=2 bez nových kľúčov nič nepridá, nikdy undefined', ()=>{
  const stary=structuredClone(EU_UI);
  for(const lang of LANGS){delete stary[lang].rules.eu_withdrawal.shoptetNoLink;delete stary[lang].rules.eu_withdrawal.manualShoptetNoLink;}
  for(const lang of LANGS){
    const r=riadok([{code:'eu_withdrawal',state:'not_found',shoptet:true}],lang,{...zdroje,EU_UI:stary});
    assert.equal(r.veta,undefined,lang);assert.equal(r.postup,undefined,lang);assert.equal(r.badge,stary[lang].rules.eu_withdrawal.status.not_found,lang);
    const s=riadok([{code:'eu_withdrawal',state:'not_found',similar:{label:'Vrátenie tovaru',page:'home'},shoptet:true}],lang,{...zdroje,EU_UI:stary});
    assert.ok(!/undefined/.test(s.veta),lang);assert.ok(s.veta.includes('Vrátenie tovaru'),lang);}
  // Len postup chýba: veta áno, odsek s postupom nie.
  const bezPostupu=structuredClone(EU_UI);
  for(const lang of LANGS){delete bezPostupu[lang].rules.eu_withdrawal.manualShoptetNoLink;
    const r=riadok([{code:'eu_withdrawal',state:'not_found',shoptet:true}],lang,{...zdroje,EU_UI:bezPostupu});
    assert.equal(r.veta,EU_UI[lang].rules.eu_withdrawal.shoptetNoLink,lang);assert.equal(r.postup,undefined,lang);assert.equal(r.postupNadpis,undefined,lang);}
});
