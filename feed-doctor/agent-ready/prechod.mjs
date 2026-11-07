// Prechod z verejnej kontroly na appku Agentic Product Check (B-02, 18. 10. 2026). Bez DOM, testy v core.test.mjs.
// Nový samostatný súbor: po nasadení ho nemôže prehliadač mať v starej kópii, kým sa obnovuje app.mjs.
// 19. 10. 2026 (brána 1 vstupnej stránky, nález 3): výzva sa riadi stavom /agent-ready/stranka.json, nie tým,
// či stránka existuje. Kým stranka.json nehovorí live (appka ešte nie je v Shopify App Store), výzva sa neukáže (inak by obchodník prešiel na stránku,
// ktorej hlavná akcia ho pošle späť na túto kontrolu).
export const APP_PAGE='/agent-ready/';
export const APP_STATE='/agent-ready/stranka.json';
export const APP_URL='https://arling.sk/agent-ready/?utm_source=agent-ready-check&utm_medium=result&utm_campaign=product-check';
// F5 (ops/shopify/pc-10-instalacii/PLAN.md, 7. 11. 2026): hlavné tlačidlo výsledku vedie priamo na zápis appky v Shopify App Store
// (zverejnená 2. 11. 2026, ops/shopify/den-schvalenia/STAV.md). UTM na apps.shopify.com bez GA4 v zápise nič nemeria
// (FAKTY-PRODUCT-CHECK.md časť 1); klik meria Umami udalosť ar_check_to_install v app.mjs.
export const INSTALL_URL='https://apps.shopify.com/arling-agentic-product-check?utm_source=arling&utm_medium=check-result&utm_campaign=product-check';
// Rovnaké pravidlo ako overKonfig v ops/strategia/2026-10-18-arling-2/stavba/landing-agent-ready/postav.mjs.
const APP_STORE=/^https:\/\/apps\.shopify\.com\/[a-z0-9][a-z0-9-]{1,80}(\?[A-Za-z0-9_=&.%-]{1,200})?$/;
const SIGNALS=['export','robots','assets'];
// Reports from the hardened worker carry report.shopify; older reports only say whether the
// public Shopify export was read. Unknown signal names are dropped, never rendered.
export function shopifyEvidence(report){
  if(report&&report.shopify&&typeof report.shopify==='object'){
    const signals=Array.isArray(report.shopify.signals)?SIGNALS.filter(s=>report.shopify.signals.includes(s)):[];
    return report.shopify.detected===true&&signals.length?{shopify:true,signals}:{shopify:false,signals:[]};
  }
  return report?.platform==='shopify-public-feed'?{shopify:true,signals:['export']}:{shopify:false,signals:[]};
}
// The app can be installed only when the landing page state says "live" with a Shopify App Store address.
export function appIsLive(state){
  return Boolean(state&&typeof state==='object'&&!Array.isArray(state)&&state.stav==='live'&&typeof state.appStoreUrl==='string'&&APP_STORE.test(state.appStoreUrl));
}
// One GET of the small state file per page view. The call to action appears only for a live app; an error,
// a 404, invalid JSON, any other state or a slow answer hides it (fails closed).
export function createAppPageCheck(fetchImpl=(url,init)=>fetch(url,init),url=APP_STATE,timeoutMs=1500){
  let pending=null;
  return function available(){
    if(!pending)pending=Promise.race([
      Promise.resolve().then(()=>fetchImpl(url,{cache:'no-store',credentials:'omit'})).then(r=>r?.ok===true?r.json():null).then(appIsLive,()=>false),
      new Promise(resolve=>setTimeout(()=>resolve(false),timeoutMs)),
    ]);
    return pending;
  };
}
// Umami data for the click: language and source only, never the store address or the score.
export function appClickData(lang,sample){return {lang:String(lang||'en').slice(0,5),source:sample?'sample':'check'};}
