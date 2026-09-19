/* Fictional browser-only demonstration. No files, names or comments are sent. */
(() => {
  'use strict';
  const demo=document.querySelector('[data-proof-demo]');
  if(!demo)return;
  const copy=JSON.parse(demo.dataset.proofDemo);
  const action=demo.querySelector('[data-demo-action]');
  const check=demo.querySelector('[data-demo-check]');
  let step=0;
  function render(){
    demo.querySelector('[data-demo-version]').textContent=copy.version+' '+(step<2?'1':'2');
    demo.querySelector('[data-demo-status]').textContent=copy.statuses[step];
    demo.querySelector('[data-demo-state]').textContent=copy.hints[step];
    demo.querySelector('[data-demo-hours]').textContent=step<2?'08:00 - 18:00':'07:30 - 18:00';
    demo.querySelector('[data-demo-comment]').hidden=step===0;
    demo.querySelector('[data-demo-pin]').hidden=step===0;
    demo.querySelector('[data-demo-check-wrap]').hidden=step!==2;
    demo.querySelectorAll('[data-demo-history]').forEach((li,i)=>li.dataset.done=String(i<=step));
    action.textContent=copy.actions[step];
    action.disabled=step===2&&!check.checked;
  }
  action.addEventListener('click',()=>{
    if(step===2&&!check.checked)return;
    step=(step+1)%4;check.checked=false;render();
    try{window.umami?.track('proof-demo-step',{step});}catch{}
  });
  check.addEventListener('change',render);
  action.disabled=false;render();
  // Only known campaign labels are measured, never arbitrary query values or form data.
  const query=new URLSearchParams(location.search),source=query.get('utm_source');
  if(['notes','hub','pinterest','linkedin','bluesky','search','qr','newsletter'].includes(source)){
    window.addEventListener('load',()=>{try{window.umami?.track('proof-campaign',{source});}catch{}},{once:true});
  }
})();
