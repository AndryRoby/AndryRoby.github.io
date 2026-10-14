// Optional panel on the existing English monitor page. Existing billing and
// subscriptions stay unchanged. No messages are sent from this module.
import {createLatest} from './controller.mjs';
import {RULES} from './core.mjs';
const params=new URLSearchParams(location.search),id=params.get('id'),key=params.get('key');
const latest=createLatest();
const element=(tag,text)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;return e;};
if(id&&key){
 const endpoint=new URL('https://feed-monitor.arling.workers.dev/v1/agent-ready/monitors/'+encodeURIComponent(id));endpoint.searchParams.set('key',key);
 const panel=element('section');panel.id='agent-ready-weekly';panel.className='wrap in';panel.hidden=true;document.querySelector('main').append(panel);
 async function load(notice=''){const req=latest.begin();try{const res=await fetch(endpoint,{signal:req.signal,credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer'});if(!req.current()||!res.ok)return;const data=await res.json();if(req.current())render(data,notice);}catch{}}
 function render(data,notice){panel.replaceChildren();panel.hidden=false;panel.append(element('h2','Weekly Agent Ready report'),element('p','An optional public-page sample for this Pro monitor. No report emails are sent. Up to 20 feed products and 3 product pages; no product contents are stored.'));
  const form=element('form'),store=element('input'),product=element('input');store.type=product.type='url';store.autocomplete=product.autocomplete='url';store.inputMode=product.inputMode='url';store.required=true;store.maxLength=product.maxLength=2048;store.id='weekly-store';product.id='weekly-product';store.value=data.settings?.store_url||'';product.value=data.settings?.product_url||'';
  const label=element('label','Public store address');label.htmlFor=store.id;const plabel=element('label','Product URL on the same store (optional)');plabel.htmlFor=product.id;
  const button=element('button','Save weekly sample');button.type='submit';button.className='btn btn-solid';const status=element('p');status.setAttribute('role','status');status.textContent=notice;form.append(label,store,plabel,product,button,status);panel.append(form);
  form.addEventListener('submit',async e=>{e.preventDefault();const req=latest.begin();button.disabled=store.disabled=product.disabled=true;status.textContent='Saving...';try{
    const res=await fetch(endpoint,{method:'POST',signal:req.signal,credentials:'omit',referrerPolicy:'no-referrer',headers:{'content-type':'application/json'},body:JSON.stringify({store_url:store.value,product_url:product.value,revision:data.settings?.revision||0})});
    if(!req.current())return;if(!res.ok){status.textContent=res.status===409?'These settings changed in another request. Reload this page before saving again.':'Could not save. Check the HTTPS addresses and try again.';return;}
    status.textContent='Saved. The next scheduled run will prepare the report.';await load('Saved. The next scheduled run will prepare the report.');
   }catch{if(req.current())status.textContent='Could not save. Your entries are still here.';}finally{button.disabled=store.disabled=product.disabled=false;}});
  if(data.report){const r=data.report;panel.append(element('h3','Latest report'),element('p',`${new Date(r.at).toLocaleDateString('en-GB')}: ${r.score}/100, ${r.coverage}% coverage. This is a heuristic, not an AI ranking.`));const list=element('ul');for(const result of r.rules||[]){if(result.status!=='fail')continue;const def=RULES.find(x=>x.code===result.code);if(def)list.append(element('li',def.title+': '+def.fix));}panel.append(list);}
  else panel.append(element('p',data.status==='failed'?'The last attempt failed. No successful report was recorded; the next scheduled run can retry.':'No completed report yet.'));
 }
 load();
}
