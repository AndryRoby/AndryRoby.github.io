// Prechod z verejnej kontroly na appku Agentic Product Check (B-02, 18. 10. 2026). Bez DOM, testy v core.test.mjs.
// Nový samostatný súbor: po nasadení ho nemôže prehliadač mať v starej kópii, kým sa obnovuje app.mjs.
export const APP_PAGE='/agent-ready/';
export const APP_URL='https://arling.sk/agent-ready/?utm_source=agent-ready-check&utm_medium=result&utm_campaign=product-check';
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
// One HEAD request per page view. The call to action appears only when the landing page answers
// with a 2xx status in time; an error, a 404 or a slow answer hides it (fails closed).
export function createAppPageCheck(fetchImpl=(url,init)=>fetch(url,init),url=APP_PAGE,timeoutMs=1500){
  let pending=null;
  return function available(){
    if(!pending)pending=Promise.race([
      Promise.resolve().then(()=>fetchImpl(url,{method:'HEAD',cache:'no-store',credentials:'omit'})).then(r=>r?.ok===true,()=>false),
      new Promise(resolve=>setTimeout(()=>resolve(false),timeoutMs)),
    ]);
    return pending;
  };
}
// Umami data for the click: language and source only, never the store address or the score.
export function appClickData(lang,sample){return {lang:String(lang||'en').slice(0,5),source:sample?'sample':'check'};}
