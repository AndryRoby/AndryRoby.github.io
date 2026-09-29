import { JAZYKY } from '../jadro/meranie.js';
import { kusky } from './zvyraznenia.js';
import { normalizuj, priprav } from '../jadro/delenie.js';
export const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const typy = ['fraza','pointa','trojica','nominalizacia','pomlcka','konkretnost','otvorenost'];
export const meraniaTypov = [5,2,8,7,6,3,4];
export const pasmoText = (r,t) => t.bands[['zivy','zmiesany','prilis_uhladeny'].indexOf(r.pasmo)] + (r.ciastocny ? ' · '+t.partial : '');
export function nalezy(r) {
  return typy.slice(0,5).map((typ,i) => {
    const id = 'M'+(meraniaTypov[i]+1), m = r.merania[id];
    const hits = r.zvyraznenia.filter(h => h.typ === typ);
    return {typ,i,id,hits,vaha: (m?.skore ?? 0)*JAZYKY[r.jazyk].VAHY[id]};
  }).filter(p => p.hits.length).sort((a,b) => b.vaha-a.vaha || a.i-b.i);
}
export const priority = r => nalezy(r).filter(p => p.vaha > 0).slice(0,3);
export const nazovNalezu = (p,t) => t.types[p.i]+': '+(p.typ === 'pointa' ? p.hits[0].text : p.hits.length);
// Rovnaké delenie ako v jadre, vrátane NFC, nadpisu, zoznamov a limitu 5 000 slov.
export function vetyGrafu(original,r) {
  const norm=normalizuj(original), p=priprav(norm.text,JAZYKY[r.jazyk]);
  return p.rytmus.map(v=>{
    const rozsah=norm.rozsah(v.od,v.do);
    return original.slice(rozsah.od,rozsah.do);
  });
}
export function rytmusData(r) {
  const dl=r.dlzky_viet ?? [], priemer=dl.length?dl.reduce((a,b)=>a+b,0)/dl.length:0;
  const max=Math.max(1,...dl,priemer*1.15);
  return {priemer,max,dolna:priemer*.85,horna:priemer*1.15,
    popis:!r.merania.M1?'rhythmFew':r.merania.M1.skore>=50?'rhythmEven':'rhythmVaried'};
}
export function grafRytmu(r,t,original) {
  const dl=r.dlzky_viet ?? [], d=rytmusData(r), vety=vetyGrafu(original,r);
  const percent=n=>(n/d.max*100).toFixed(3);
  return '<figure class="rk-rytmus" aria-labelledby="rytmus-popis"><figcaption id="rytmus-popis">'+esc(t[d.popis])+'</figcaption>'+
    '<p class="small rk-legenda"><span>'+esc(t.average)+': '+esc(new Intl.NumberFormat(r.jazyk,{maximumFractionDigits:1}).format(d.priemer))+' '+esc(t.words)+'</span><span>'+esc(t.uniform)+' ±15 %</span></p>'+
    '<div class="rk-graf-posun"><div class="rk-graf" style="--priemer:'+percent(d.priemer)+'%;--dolna:'+percent(d.dolna)+'%;--pas:'+percent(d.horna-d.dolna)+'%">'+
    '<span class="rk-priemer" aria-hidden="true"></span><span class="rk-rovnomerne" aria-hidden="true"></span>'+
    dl.map((n,i)=>'<button type="button" class="rk-stlpec" data-veta="'+i+'" aria-pressed="false" style="--vyska:'+percent(n)+'%"><span class="rk-stlpec-kresba" aria-hidden="true"></span><span class="rk-sr">'+esc(t.sentence)+' '+(i+1)+': '+n+' '+esc(t.words)+'. <span lang="'+r.jazyk+'">'+esc(vety[i]??'')+'</span></span></button>').join('')+
    '</div></div><p class="small rk-veta-detail" id="rytmus-detail" aria-live="polite" aria-atomic="true">'+esc(t.rhythmHint)+'</p></figure>';
}
export function suhrn(r,t,original='',animovat=false) {
  const top=nalezy(r), pasma=['zivy','zmiesany','prilis_uhladeny'];
  return '<p class="small" id="index-nazov">'+esc(t.index)+'</p><div class="rk-index"><p class="cislo"><span id="index">'+r.index+'</span><small> / 100</small></p><div><p id="pasmo" class="rk-pasmo" data-pasmo="'+r.pasmo+'">'+esc(t.bands[pasma.indexOf(r.pasmo)])+'</p>'+(r.ciastocny?'<p class="small rk-ciastocny">'+esc(t.partial)+'</p>':'')+'</div></div>'+
    '<div class="rk-stupnica" role="meter" aria-labelledby="index-nazov" aria-describedby="kalibracia" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+r.index+'" aria-valuetext="'+esc(r.index+' / 100, '+pasmoText(r,t))+'"><div class="rk-pasma" aria-hidden="true">'+pasma.map(p=>'<span data-pasmo="'+p+'"></span>').join('')+'</div><span class="rk-znacka'+(animovat?' rk-znacka-vstup':'')+'" style="--hodnota:'+r.index+'" aria-hidden="true"></span></div>'+
    '<div class="rk-stupnica-popisy">'+t.bands.map((b,i)=>'<span>'+esc(b)+'<small>'+['0 - 34','35 - 64','65 - 100'][i]+'</small></span>').join('')+'</div><p class="small" id="kalibracia">'+esc(t.calibration)+'</p>'+
    '<ul class="rk-cipy" aria-label="'+esc(t.findings)+'">'+top.map(p=>'<li><button type="button" class="rk-cip typ-'+p.typ+'" data-filter="'+p.typ+'" aria-pressed="false" aria-controls="oznaceny-text"><span class="rk-typ-bod" aria-hidden="true"></span><span>'+esc(t.metrics[meraniaTypov[p.i]])+'</span><span class="rk-pocet">'+p.hits.length+'</span></button></li>').join('')+'</ul>'+
    grafRytmu(r,t,original);
}
export function oznaceny(original,r,t) {
  let od=0;
  return kusky(original.slice(0,r.merane_do),r.zvyraznenia).map(k=>{
    const id=od; od+=k.text.length;
    return k.typy.length ? '<button type="button" class="rk-nalez typ-'+k.typy[0]+'" id="nalez-'+id+'" data-typy="'+k.typy.join(' ')+'" aria-describedby="bublina">'+esc(k.text)+'</button>' : esc(k.text);
  }).join('');
}
export function opravy(r,t) {
  const top=priority(r);
  return top.length ? '<ol class="rk-opravy">'+top.map(p=>'<li><h3>'+esc(nazovNalezu(p,t))+'</h3><p>'+esc(t.advice[meraniaTypov[p.i]][1])+'</p><a class="btn btn-line" href="#nalez-'+p.hits[0].od+'" data-skok="'+p.hits[0].od+'">'+esc(t.jump)+'</a></li>').join('')+'</ol>' : '<p>'+esc(t.nofindings)+'</p>';
}
export function podrobnosti(r,t) {
  return '<p>'+esc(t.meaning)+'</p><p class="small">'+r.slov+' '+esc(t.words)+' · '+r.viet+' '+esc(t.sentences)+' · '+esc(t.version)+' '+esc(r.verzia)+'</p><ol id="ukazovatele">'+t.metrics.map((n,i)=>{
    const m=r.merania['M'+(i+1)];
    return '<li><h3>'+esc(n)+'</h3>'+(m ? '<p>'+Math.round(m.skore)+' / 100</p><meter min="0" max="100" value="'+m.skore+'" aria-label="'+esc(n)+'"></meter><p>'+esc(t.advice[i][0])+'</p>' : '<p>'+esc(t.unmeasured)+'</p>')+'</li>';
  }).join('')+'</ol><details><summary>'+esc(t.numbers)+'</summary><p>'+esc((r.dlzky_viet??[]).join(', '))+'</p></details>';
}
export function sprava(r,t) {
  return ['Rukopis · '+t.report,t.index+': '+r.index+'/100 · '+pasmoText(r,t),t.calibration,t.meaning,
    r.slov+' '+t.words+' · '+t.version+' '+r.verzia,
    ...priority(r).map(p=>nazovNalezu(p,t)+'\n'+t.advice[meraniaTypov[p.i]][1])].join('\n\n');
}
