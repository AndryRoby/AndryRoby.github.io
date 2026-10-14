import {RULES} from './core.mjs';
import {UI,localRule} from './i18n.mjs';
import {createLatest} from './controller.mjs';
const lang=document.documentElement.lang,copy=UI[lang]||UI.en;
const $=id=>document.getElementById(id),form=$('check-form'),report=$('report'),status=$('status'),latest=createLatest();
const API='https://feed-monitor.arling.workers.dev/v1/agent-ready/check';
let currentReport=null;
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
function render(data,sample){
  if(!data||data.version!=='1.0.0'||!Array.isArray(data.rules)||!data.sample||!data.rules.every(r=>RULES.some(def=>def.code===r.code)&&['pass','fail','unknown','info'].includes(r.status)&&Number.isInteger(r.checked)&&Number.isInteger(r.affected)))throw new Error('invalid_report');
  currentReport=data;report.replaceChildren();report.hidden=false;
  if(sample)report.append(node('p',copy.sample,'ar-status'));
  report.append(node('h2',copy.result),node('p',`${data.storeUrl} · ${new Date(data.at).toLocaleString(lang)}`,'ar-context'));
  const scoreline=node('dl',null,'ar-scoreline');for(const [label,value,cls] of [[copy.score,data.score==null?'?':data.score+'/100',''],[copy.coverage,data.coverage+'%',''],[copy.scope,`${data.sample.products} ${copy.products}, ${data.sample.pages}/${data.sample.attemptedPages} ${copy.pages}`,'ar-scope']]){const group=node('div',null,cls);group.append(node('dt',label),node('dd',value));scoreline.append(group);}report.append(scoreline,node('p',data.score==null?copy.noScore:copy.limit,'ar-muted'));
  if(data.coverage<100||data.sample.pages<data.sample.attemptedPages)report.append(node('p',copy.unknown,'ar-status'));
  if(data.noindexPages?.length)report.append(node('p',copy.noindex,'ar-status'));
  const failing=data.rules.filter(r=>r.status==='fail').sort((a,b)=>RULES.find(r=>r.code===b.code).weight-RULES.find(r=>r.code===a.code).weight);
  report.append(node('h3',copy.fixes));const ul=node('ul',null,'ar-list');for(const r of failing)ul.append(ruleElement(r));if(!failing.length)report.append(node('p',copy.empty));else report.append(ul);
  const all=node('details');all.append(node('summary',copy.all));const allList=node('ul',null,'ar-list');for(const r of data.rules)allList.append(ruleElement(r));all.append(allList);report.append(all);
  const proof=node('details');proof.append(node('summary',copy.proof));const urls=node('ul',null,'ar-proof');for(const e of data.evidence||[]){const li=node('li');const href=safeLink(e.url),a=node(href?'a':'span',e.url||'');if(href){a.href=href;a.rel='noopener';a.target='_blank';}li.append(a,node('span',` · HTTP ${e.status||'?'}${e.error?' · '+e.error:''}`));urls.append(li);}proof.append(urls);report.append(proof);
  const download=node('button',copy.download,'ar-quiet');download.type='button';download.addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(currentReport,null,2)],{type:'application/json'}));const a=node('a');a.href=url;a.download='agent-ready-report.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});const actions=node('div',null,'ar-actions');actions.append(download);report.append(actions);
  report.focus({preventScroll:true});report.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
}
async function run(sample=false){const request=latest.begin();busy(true);status.textContent=copy.busy;report.hidden=true;let timer;
 try{let url;
  if(sample)url=new URL('./sample-report.json',import.meta.url);
  else{let value=$('store-url').value.trim();if(!/^https?:\/\//i.test(value))value='https://'+value;const store=new URL(value);if(store.protocol!=='https:'||store.username||store.password||store.hash||store.search)throw new Error('invalid_url');$('store-url').value=store.href;url=new URL(API);url.searchParams.set('url',store.href);const product=$('product-url').value.trim();if(product){const p=new URL(product);if(p.origin!==store.origin||p.protocol!=='https:'||p.username||p.password||p.hash)throw new Error('invalid_url');url.searchParams.set('product',p.href);}}
  timer=setTimeout(()=>{if(request.current()){latest.cancel();busy(false);status.textContent=copy.error;}},65000);
  const response=await fetch(url,{signal:request.signal,credentials:'omit',cache:'no-store'});if(!request.current())return;
  if(!response.ok)throw new Error(response.status===503?'unavailable':response.status===429?'rate':'fetch');
  const data=await response.json();if(!request.current())return;render(data,sample);status.textContent='';track(sample?'agent_ready_sample':'agent_ready_check',{score:data.score,coverage:data.coverage,products:data.sample.products,pages:data.sample.pages,lang});
 }catch(e){if(request.current()){status.textContent=copy[e.message]||copy.error;report.hidden=true;}}finally{clearTimeout(timer);if(request.current())busy(false);}}
form.addEventListener('submit',e=>{e.preventDefault();run();});$('sample').addEventListener('click',()=>run(true));
$('cancel').addEventListener('click',()=>{latest.cancel();busy(false);status.textContent=copy.cancelled;report.hidden=true;});
for(const id of ['store-url','product-url'])$(id).addEventListener('input',()=>{latest.cancel();busy(false);status.textContent='';report.hidden=true;});
document.querySelector('[data-pro-link]').addEventListener('click',()=>track('kupa_click',{product:'feed-monitor-pro',place:'agent-ready',lang}));
