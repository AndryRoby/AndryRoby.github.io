import { slova } from '../jadro/delenie.js';
import { merajText } from '../jadro/meranie.js';
import ukazky from './ukazky.js';
import { texty, jazyky } from './texty.js?v=1.2';
import { suhrn, oznaceny, opravy, podrobnosti, sprava, pasmoText, typy, meraniaTypov } from './zobrazenie.js?v=1.2';
import { ziveMeranie, kopiruj } from './zive.js';
import { zaznamenaj } from './analytika.js';
import { oznacTyp, zapojRytmus } from './ovladanie.js?v=1.2';

const $=id=>document.getElementById(id), lang=document.documentElement.lang, t=texty[lang];
const text=$('text'), jazyk=$('jazyk'), stav=$('stav'), tip=$('bublina');
let r=null, priklad=text.value===ukazky[lang], prikladJazyk=lang, zaloha=null, posledneHlasenie='', poslednaUdalost='', chyba='', aktivny=null, pripnuty=false, zatvorCas;
let prvyIndex=true, zvolenyTyp=null;
const html=(id,markup)=>{
  // Všetok vstup je escapovaný v zobrazenie.js, vrátane úvodzoviek a HTML.
  const parsed=new DOMParser().parseFromString(markup,'text/html');
  $(id).replaceChildren(...parsed.body.childNodes);
};
function zavri() { clearTimeout(zatvorCas); tip.hidden=true; aktivny=null; pripnuty=false; }
function ukazTip(button,pin=false) {
  clearTimeout(zatvorCas); aktivny=button; pripnuty=pin; tip.replaceChildren();
  for(const typ of button.dataset.typy.split(' ')) {
    const i=typy.indexOf(typ), h=document.createElement('strong'), p=document.createElement('p');
    h.textContent=t.types[i]; p.textContent=t.advice[meraniaTypov[i]].join(' '); tip.append(h,p);
  }
  tip.hidden=false;
  umiestniTip();
}
function umiestniTip() {
  if(!aktivny) return;
  const b=aktivny.getBoundingClientRect(), w=tip.getBoundingClientRect();
  tip.style.left=Math.max(12,Math.min(b.left,innerWidth-w.width-12))+'px';
  tip.style.top=Math.max(12,Math.min(b.bottom+8,innerHeight-w.height-12))+'px';
}
function ohlas() {
  const s=chyba || (r ? t.done+' '+t.index+': '+r.index+'/100, '+pasmoText(r,t)+'.' : '');
  if(s!==posledneHlasenie) { stav.textContent=s; posledneHlasenie=s; }
}
function zmeraj(explicitne=false) {
  zavri();
  try { r=merajText(text.value,jazyk.value==='auto'?{}:{jazyk:jazyk.value}); }
  catch { r=null; chyba=t.error; }
  if(r) chyba=r.chyba==='vyber_jazyk'?(slova(text.value).length<30?t.low:t.choose):r.chyba?t.low:'';
  $('chyba').hidden=!chyba; $('chyba').textContent=chyba;
  text.setAttribute('aria-invalid',chyba?'true':'false');
  $('vysledok').hidden=!!chyba; $('dalsie').hidden=!!chyba; $('kopirovat').disabled=!!chyba;
  $('jazyk-stav').textContent=r?.jazyk?(jazyk.value==='auto'?t.detected:t.selected)+': '+jazyky[r.jazyk]:t.choose;
  $('povod').textContent=texty[prikladJazyk].provenance; $('povod').hidden=!priklad; $('povod-stitok').hidden=!priklad; $('okno-stitok').hidden=!priklad;
  if(chyba) { r=null; if(explicitne) (jazyk.value==='auto'&&chyba===t.choose?jazyk:text).focus(); return; }
  html('suhrn',suhrn(r,t,text.value,prvyIndex)); prvyIndex=false;
  html('oznaceny-text',oznaceny(text.value,r,t));
  if(!oznacTyp($('suhrn'),$('oznaceny-text'),zvolenyTyp)) zvolenyTyp=null;
  $('oznaceny-text').lang=r.jazyk;
  html('opravy',opravy(r,t)); html('podrobnosti',podrobnosti(r,t));
  $('orezanie').hidden=!r.orezane;
  // Len vlastný vstup, raz pre kombináciu metadát. Príklad nie je použitie nástroja.
  if(!priklad) {
    const w=r.slov, data={jazyk:r.jazyk,slov_vedro:w<80?'30-79':w<200?'80-199':w<500?'200-499':w<2000?'500-1999':'2000+',pasmo:r.pasmo};
    const kluc=JSON.stringify(data);
    if(kluc!==poslednaUdalost) { zaznamenaj('rukopis_meranie',data); poslednaUdalost=kluc; }
  }
}
const zive=ziveMeranie(zmeraj,ohlas);
text.addEventListener('input',()=>{priklad=false;zive.vstup();});
text.addEventListener('compositionstart',zive.zacni);
text.addEventListener('compositionend',zive.dokonci);
jazyk.addEventListener('change',()=>zive.teraz());
$('formular').addEventListener('submit',e=>{e.preventDefault();zive.teraz();});
function odloz() { zaloha={text:text.value,jazyk:jazyk.value,priklad,prikladJazyk}; $('spat').hidden=false; }
$('vlastny').addEventListener('click',()=>{
  odloz(); text.value=''; priklad=false; jazyk.value='auto'; zive.teraz(); text.focus();
});
$('spat').addEventListener('click',()=>{
  if(!zaloha) return;
  text.value=zaloha.text; jazyk.value=zaloha.jazyk; priklad=zaloha.priklad; prikladJazyk=zaloha.prikladJazyk; zaloha=null;
  $('spat').hidden=true; zive.teraz(); text.focus();
});
$('ukazka').addEventListener('click',()=>{
  odloz(); const j=jazyk.value==='auto'?lang:jazyk.value;
  text.value=ukazky[j]; priklad=true; prikladJazyk=j;
  zive.teraz(); zaznamenaj('rukopis_ukazka_klik',{jazyk:j});
});
const area=$('oznaceny-text');
zapojRytmus($('suhrn'),t.rhythmHint);
$('suhrn').addEventListener('click',e=>{
  const b=e.target.closest('[data-filter]');
  if(!b) return;
  zvolenyTyp=b.getAttribute('aria-pressed')==='true'?null:b.dataset.filter;
  const prvy=oznacTyp($('suhrn'),area,zvolenyTyp);
  if(prvy) {
    prvy.focus({preventScroll:true});
    prvy.scrollIntoView({block:'nearest',behavior:'instant'});
    ukazTip(prvy,true);
  } else zavri();
});
// Natívny select má stále jeden názov a jednu hodnotu, mení sa iba dlhý popis.
const merac=document.createElement('canvas').getContext('2d');
function upravPopisJazyka() {
  if(!merac) return;
  const css=getComputedStyle(jazyk);
  merac.font=css.font;
  const dostupne=jazyk.clientWidth-parseFloat(css.paddingLeft)-parseFloat(css.paddingRight);
  const sirka=merac.measureText(t.auto).width+(parseFloat(css.letterSpacing)||0)*t.auto.length;
  jazyk.options[0].textContent=sirka<=dostupne?t.auto:t.autoShort;
}
if(typeof ResizeObserver!=='undefined') new ResizeObserver(upravPopisJazyka).observe(jazyk);
window.addEventListener('resize',upravPopisJazyka);
document.fonts?.ready.then(upravPopisJazyka);
upravPopisJazyka();
area.addEventListener('focusin',e=>{const b=e.target.closest('.rk-nalez');if(b)ukazTip(b);});
area.addEventListener('focusout',()=>{if(!pripnuty)zavri();});
area.addEventListener('pointerover',e=>{const b=e.target.closest('.rk-nalez');if(b && e.pointerType!=='touch' && !pripnuty)ukazTip(b);});
area.addEventListener('pointerout',()=>{if(!pripnuty)zatvorCas=setTimeout(zavri,200);});
tip.addEventListener('pointerenter',()=>clearTimeout(zatvorCas));
tip.addEventListener('pointerleave',()=>{if(!pripnuty)zavri();});
area.addEventListener('click',e=>{const b=e.target.closest('.rk-nalez');if(b){if(pripnuty&&aktivny===b)zavri();else ukazTip(b,true);}});
document.addEventListener('click',e=>{
  const skok=e.target.closest('[data-skok]');
  if(e.target.closest('[data-filter]')) return;
  if(skok) {
    const b=$('nalez-'+skok.dataset.skok);
    if(b) {e.preventDefault();b.focus({preventScroll:true});b.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});ukazTip(b,true);}
  } else if(!e.target.closest('.rk-nalez')&&!tip.contains(e.target)) zavri();
});
document.addEventListener('keydown',e=>{if(e.key==='Escape')zavri();});
window.addEventListener('resize',zavri);
window.addEventListener('scroll',umiestniTip,{passive:true,capture:true});
$('kopia').setAttribute('aria-labelledby','kopia-nadpis');
$('kopia').addEventListener('close',()=>$('kopirovat').focus());
$('kopirovat').addEventListener('click',async()=>{
  if(!r) return;
  const ok=await kopiruj(sprava(r,t),navigator.clipboard,s=>{
    $('sprava').value=s; $('kopia').showModal(); $('sprava').focus(); $('sprava').select();
  });
  if(ok) {stav.textContent=t.copied;posledneHlasenie='';}
});
for(const id of ['zmerat','vlastny','ukazka','kopirovat']) $(id).disabled=false;
// SSR ukážka je viditeľná aj bez JS. Hydratácia ju znovu zmeria bez hlásenia a analytiky.
zmeraj();
