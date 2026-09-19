// A-096: do dopytu patria iba údaje vedome vyplnené vo formulári.
// Tento modul nepristupuje k faktúre, súboru, výsledkom kontroly ani localStorage.
const FREKVENCIE=new Set(['daily','weekly','monthly','less','unknown']);
export function zlozSpravu({software,frequency,problem}){
  const s=String(software||'').trim(),p=String(problem||'').trim();
  if(!s||s.length>100||!p||p.length>1000||!FREKVENCIE.has(frequency))return '';
  return 'Software: '+s+'\nFrequency: '+frequency+'\nRecurring task / current process:\n'+p;
}

function meraj(nazov){
  try{
    if(new URL(location.href).searchParams.get('test')==='1')return;
    window.umami?.track(nazov,{source:'efaktura-repeat-'+document.documentElement.lang});
  }catch{/* Meranie nikdy neblokuje nástroj. */}
}

export function zobrazOpakovanie(vlastnaKontrola){
  const blok=document.getElementById('opakovanie-cta');
  if(!blok)return;
  blok.hidden=!vlastnaKontrola;
  if(vlastnaKontrola)meraj('efaktura_opakovanie_vysledok');
}

function zapoj(){
  const form=document.querySelector('form[data-efaktura-opakovanie]');
  const otvor=document.getElementById('opakovanie-otvor');
  const panel=document.getElementById('opakovanie-panel');
  if(!form||!otvor||!panel)return;
  const software=form.querySelector('[name="software"]');
  const frequency=form.querySelector('[name="frequency"]');
  const problem=form.querySelector('[name="problem"]');
  const sprava=form.querySelector('[name="sprava"]');
  otvor.addEventListener('click',()=>{
    const prvy=panel.hidden;
    panel.hidden=false;otvor.setAttribute('aria-expanded','true');
    if(prvy)meraj('efaktura_opakovanie_otvor');
    if(!form.hidden)software.focus();
    else document.getElementById('opakovanie-thanks')?.focus();
  });
  // Capture beží pred existujúcim dopyt.js bez ohľadu na poradie načítania.
  form.addEventListener('submit',e=>{
    sprava.value='';
    const hp=form.querySelector('[name="website"]');
    if(hp?.value||!form.checkValidity()){
      e.preventDefault();e.stopImmediatePropagation();return;
    }
    sprava.value=zlozSpravu({software:software.value,frequency:frequency.value,problem:problem.value});
    if(!sprava.value){e.preventDefault();e.stopImmediatePropagation();problem.focus();return;}
    const chyba=document.getElementById('opakovanie-error');
    if(chyba)chyba.hidden=true;
  },true);
  for(const id of ['opakovanie-thanks','opakovanie-error']){
    const target=document.getElementById(id);
    if(target)new MutationObserver(()=>{if(!target.hidden)target.focus();}).observe(target,{attributes:true,attributeFilter:['hidden']});
  }
}
if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',zapoj,{once:true});
  else zapoj();
}
