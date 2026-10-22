import {RULES} from './core.mjs';
import {UI,localRule,EU_UI} from './i18n.mjs?v=2';
import {createLatest} from './controller.mjs';
const lang=document.documentElement.lang,copy=UI[lang]||UI.en,euCopy=EU_UI[lang]||EU_UI.en;
const $=id=>document.getElementById(id),form=$('check-form'),report=$('report'),status=$('status'),latest=createLatest();
const API='https://feed-monitor.arling.workers.dev/v1/agent-ready/check';
let currentReport=null;
// Optional module: if prechod.mjs is missing or fails, only the next step for Shopify stores is hidden.
const transition=import('./prechod.mjs').then(m=>({m,live:m.createAppPageCheck()}),()=>null);
// EU 2026 findings (A-189, 20. 10. 2026) and the Pro waitlist: optional modules too; without them the check works as before.
// cakacia.mjs also wires the waitlist form already on the page as soon as it loads.
const euModule=import('./eu-zobraz.mjs').catch(()=>null);
const waitlist=import('./cakacia.mjs').catch(()=>null);
// Stráž e-shopu (relácia 209): optional; null unless /straz-eshopu/stav.json is live or the test mode is on.
const strazModule=import('./straz.mjs?v=2').then(m=>m.strazOn().then(on=>on?m:null)).catch(()=>null);
function node(tag,text,cls){const el=document.createElement(tag);if(text!=null)el.textContent=String(text);if(cls)el.className=cls;return el;}
function track(name,data){if(new URLSearchParams(location.search).has('test'))return;try{window.umami?.track(name,data);}catch{}}
function safeLink(url){try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}}
function busy(value){$('check').disabled=value;$('cancel').hidden=!value;form.setAttribute('aria-busy',String(value));}
function ruleElement(result){const index=RULES.findIndex(r=>r.code===result.code);if(index<0)return null;const r={...result,...localRule(RULES[index],index,lang)};
  const item=node('li',null,'ar-rule'),head=node('div',null,'ar-rule-head');head.append(node('h3',r.title));const badge=node('span',copy.status[r.status]||copy.status.unknown,'ar-badge');badge.dataset.status=r.status;head.append(badge);item.append(head,node('code',r.code),node('p',r.fix));
  item.append(node('p',`${copy.severity[r.severity]} · ${r.affected} ${copy.affected} / ${r.checked} ${copy.checked}`,'ar-muted'));
  if(r.affectedIds?.length)item.append(node('p',r.affectedIds.join(', '),'ar-evidence'));
  const a=node('a',copy.source);a.href=r.source;a.rel='noopener';a.target='_blank';item.append(a);return item;
}
// Limits of the check, next to the result (same text as below the form).
function limitsBlock(){const box=node('div',null,'ar-limits');box.append(node('h3',copy.readsTitle),node('p',copy.privacy,'ar-muted'));return box;}
// Calm next step for stores with Shopify signals; the store address never leaves this page in the event.
function appBlock(app,sample){const c=copy.app,box=node('div',null,'ar-next'),title=node('h3',c.title);
  const link=node('a',c.cta,'ar-next-link');link.href=app.url;link.addEventListener('click',()=>track('ar_check_to_app',app.clickData(lang,sample)));
  const why=app.signals.map(s=>c.signals?.[s]).filter(Boolean);
  const reason=sample?c.sampleWhy:why.length?c.why+' '+why.join(', ')+'.':'';
  box.append(title,node('p',c.text),node('p',c.terms,'ar-muted'),link);if(reason)box.append(node('p',reason,'ar-muted ar-why'));return box;}
// Result without a single product page read (score null or 0 pages); kept here, i18n.mjs belongs to session 208.
const NO_PAGES={
 sk:['Neprečítali sme žiadnu produktovú stránku, preto údaje pre AI asistentov nehodnotíme.','Povinnosti EÚ nižšie sme skontrolovali.'],
 en:['We could not read any product page, so we do not evaluate the data for AI assistants.','We did check the EU duties below.'],
 de:['Wir konnten keine Produktseite lesen, daher bewerten wir die Daten für KI-Assistenten nicht.','Die EU-Pflichten unten haben wir geprüft.']};
const quote=s=>lang==='en'?`“${s}”`:`„${s}“`;
function outLink(text,href){const a=node('a',text);a.href=href;a.rel='noopener';a.target='_blank';return a;}
// EU rules for online shops, 2026: one row per finding, each with what we found, a manual check, the law and its link.
function euBlock(rows,sz=null){
  const box=node('section',null,'ar-eu');box.setAttribute('aria-labelledby','ar-eu-nadpis');
  const h=node('h3',euCopy.title);h.id='ar-eu-nadpis';box.append(h);
  if(!Array.isArray(rows)){box.append(node('p',rows==='failed'?euCopy.failed:euCopy.missing,'ar-status'));return box;}
  box.append(node('p',euCopy.intro,'ar-eu-intro'));
  const list=node('ol',null,'ar-eu-list');
  for(const r of rows){
    const li=node('li',null,'ar-eu-item'),head=node('div',null,'ar-eu-head');
    const badge=node('span',r.badge,'ar-eu-badge');badge.dataset.tone=r.tone;
    head.append(node('h4',r.title),badge);li.append(head,node('p',r.applies,'ar-eu-applies'),node('p',r.what,'ar-eu-what'));
    const result=node('div',null,'ar-eu-result');
    for(const l of r.lines){
      if(l.finding){const f=l.finding,p=node('div',null,'ar-eu-finding');
        p.append(node('p',quote(f.term),'ar-eu-term'),node('p',f.where,'ar-eu-where'));
        if(f.context)p.append(node('p',f.context,'ar-eu-context'));
        p.append(node('p',f.example,'ar-muted'));for(const n of f.notes)p.append(node('p',n,'ar-muted'));
        result.append(p);continue;}
      const p=node('p',l.text,l.muted?'ar-muted':null);
      if(l.href){p.append(' ');p.append(outLink(l.href.replace(/^https:\/\//,'').slice(0,80),l.href));}
      result.append(p);
    }
    li.append(result);
    if(r.manual){const m=node('p',null,'ar-eu-manual');m.append(node('strong',euCopy.manual+':'),' '+r.manual);li.append(m);}
    const law=node('p',null,'ar-eu-law');law.append(node('span',euCopy.law+': '));
    r.law.forEach(([text,href],i)=>{if(i)law.append('; ');law.append(outLink(text,href));});
    li.append(law);if(sz&&(r.tone==='review'||r.tone==='unknown'))li.append(sz.strazLink(r.code,lang));list.append(li);
  }
  box.append(list,node('p',euCopy.footer,'ar-muted ar-eu-footer'));
  const cal=node('a',euCopy.calendar[0],'ar-eu-calendar');cal.href=euCopy.calendar[1];cal.dataset.umamiEvent='ar_check_to_calendar';
  box.append(cal);
  return box;
}
function render(data,sample,app=null,eu=null,wl=null,platform='unknown',sz=null){
  if(!data||data.version!=='1.0.0'||!Array.isArray(data.rules)||!data.sample||!data.rules.every(r=>RULES.some(def=>def.code===r.code)&&['pass','fail','unknown','info'].includes(r.status)&&Number.isInteger(r.checked)&&Number.isInteger(r.affected)))throw new Error('invalid_report');
  currentReport=data;report.replaceChildren();report.hidden=false;
  if(sample)report.append(node('p',copy.sample,'ar-status'));
  report.append(node('h2',copy.result),node('p',`${data.storeUrl} · ${new Date(data.at).toLocaleString(lang)}`,'ar-context'));
  const scoreline=node('dl',null,'ar-scoreline');for(const [label,value,cls] of [[copy.score,data.score==null?'?':data.score+'/100',''],[copy.coverage,data.coverage+'%',''],[copy.scope,`${data.sample.products} ${copy.products}, ${data.sample.pages}/${data.sample.attemptedPages} ${copy.pages}`,'ar-scope']]){const group=node('div',null,cls);group.append(node('dt',label),node('dd',value));scoreline.append(group);}report.append(scoreline,node('p',data.score==null?copy.noScore:copy.limit,'ar-muted'));
  const noPages=data.score==null||data.sample.pages===0;
  if(!noPages&&(data.coverage<100||data.sample.pages<data.sample.attemptedPages))report.append(node('p',copy.unknown,'ar-status'));
  if(data.noindexPages?.length)report.append(node('p',copy.noindex,'ar-status'));
  const failing=data.rules.filter(r=>r.status==='fail').sort((a,b)=>RULES.find(r=>r.code===b.code).weight-RULES.find(r=>r.code===a.code).weight);
  // No product page read: one neutral sentence instead of "no failing checks" and the high-score warning (gate 209, finding 6).
  if(noPages&&!failing.length){const t=NO_PAGES[lang]||NO_PAGES.en,euOk=Boolean(eu&&eu.euState(data)==='ok');report.append(node('p',euOk?t[0]+' '+t[1]:t[0],'ar-status ar-no-pages'));}
  else{report.append(node('h3',copy.fixes));const ul=node('ul',null,'ar-list');for(const r of failing){const li=ruleElement(r);if(sz&&li)li.append(sz.strazLink(r.code,lang));ul.append(li);}if(!failing.length)report.append(node('p',copy.empty));else report.append(ul);}
  if(copy.readsTitle)report.append(limitsBlock());
  if(eu){const state=eu.euState(data);report.append(euBlock(state==='ok'?eu.euView(data.eu,euCopy):state,sz));}
  if(sz){const box=sz.buildStrazBox(lang,sample?'sample':'result',platform,data);if(box)report.append(box);}
  // Pro je appka pre Shopify: obchod bez znakov Shopify dostane vetu namiesto formulára (brána A-189 pokus 1, nález 9b).
  if(wl)report.append(platform==='no'?wl.buildNote(lang):wl.buildWaitlist(lang,sample?'sample':'result',platform));
  if(app&&copy.app)report.append(appBlock(app,sample));
  const all=node('details');all.append(node('summary',copy.all));const allList=node('ul',null,'ar-list');for(const r of data.rules)allList.append(ruleElement(r));all.append(allList);report.append(all);
  const proof=node('details');proof.append(node('summary',copy.proof));const urls=node('ul',null,'ar-proof');for(const e of data.evidence||[]){const li=node('li');const href=safeLink(e.url),a=node(href?'a':'span',e.url||'');if(href){a.href=href;a.rel='noopener';a.target='_blank';}li.append(a,node('span',` · HTTP ${e.status||'?'}${e.error?' · '+e.error:''}`));urls.append(li);}proof.append(urls);report.append(proof);
  const download=node('button',copy.download,'ar-quiet');download.type='button';download.addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(currentReport,null,2)],{type:'application/json'}));const a=node('a');a.href=url;a.download='agent-ready-report.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});const actions=node('div',null,'ar-actions');actions.append(download);report.append(actions);
  report.focus({preventScroll:true});report.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
}
async function run(sample=false){const request=latest.begin();busy(true);status.textContent=copy.busy;report.hidden=true;let timer;
 transition.then(t=>t?.live()); // GET /agent-ready/stranka.json starts with the check, so the result renders once, without a late jump
 try{let url;
  if(sample)url=new URL('./sample-report.json',import.meta.url);
  else{let value=$('store-url').value.trim();if(!/^https?:\/\//i.test(value))value='https://'+value;const store=new URL(value);if(store.protocol!=='https:'||store.username||store.password||store.hash||store.search)throw new Error('invalid_url');$('store-url').value=store.href;url=new URL(API);url.searchParams.set('url',store.href);const product=$('product-url').value.trim();if(product){const p=new URL(product);if(p.origin!==store.origin||p.protocol!=='https:'||p.username||p.password||p.hash)throw new Error('invalid_url');url.searchParams.set('product',p.href);}
   // Umami: a check that was sent (not the sample, not an invalid address); language only, never the store address.
   track('ar_check_start',{lang});}
  timer=setTimeout(()=>{if(request.current()){latest.cancel();busy(false);status.textContent=copy.error;}},65000);
  const response=await fetch(url,{signal:request.signal,credentials:'omit',cache:'no-store'});if(!request.current())return;
  if(!response.ok)throw new Error(response.status===503?'unavailable':response.status===429?'rate':'fetch');
  const data=await response.json();if(!request.current())return;
  const t=await transition,next=t?t.m.shopifyEvidence(data):{shopify:false,signals:[]};
  const showApp=next.shopify&&Boolean(copy.app)&&await t.live();if(!request.current())return;
  const [eu,wl,sz]=await Promise.all([euModule,waitlist,strazModule]);if(!request.current())return;
  const platform=t?(next.shopify?'yes':'no'):'unknown';
  render(data,sample,showApp?{...next,url:t.m.APP_URL,clickData:t.m.appClickData}:null,eu,wl,platform,sz);status.textContent='';
  const euEvent=eu?eu.euEvent(data.eu,lang):null;
  track(sample?'agent_ready_sample':'agent_ready_check',{score:data.score,coverage:data.coverage,products:data.sample.products,pages:data.sample.pages,lang,eu:euEvent?'yes':'no'});
  // Umami: EU findings that need a look (statuses and their count only); the sample is never counted.
  if(!sample&&euEvent&&euEvent.review>0)track('ar_eu_finding',euEvent);
 }catch(e){if(request.current()){status.textContent=copy[e.message]||copy.error;report.hidden=true;}}finally{clearTimeout(timer);if(request.current())busy(false);}}
form.addEventListener('submit',e=>{e.preventDefault();run();});$('sample').addEventListener('click',()=>run(true));
$('cancel').addEventListener('click',()=>{latest.cancel();busy(false);status.textContent=copy.cancelled;report.hidden=true;});
for(const id of ['store-url','product-url'])$(id).addEventListener('input',()=>{latest.cancel();busy(false);status.textContent='';report.hidden=true;});
// Link to the Stráž e-shopu page; not a purchase, so not kupa_click (that one counts as a buy click in the morning report).
document.querySelector('[data-pro-link]')?.addEventListener('click',()=>track('ar_straz_link',{lang,place:'result'}));
