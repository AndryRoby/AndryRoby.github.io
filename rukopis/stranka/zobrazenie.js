import { JAZYKY } from '../jadro/meranie.js?v=1.3';
import { kusky } from './zvyraznenia.js?v=1.3';
import { normalizuj, priprav, DOVODY } from '../jadro/delenie.js?v=1.3';
export const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const typy = ['fraza','pointa','trojica','nominalizacia','pomlcka','konkretnost','otvorenost'];
export const meraniaTypov = [5,2,8,7,6,3,4];
export const pasmoText = (r,t) => t.bands[['zivy','zmiesany','prilis_uhladeny'].indexOf(r.pasmo)] + (r.ciastocny ? ' · '+t.partial : '');
export const doplnit = (s,v) => s.replace(/\{(\w+)\}/g,(m,k)=>v[k] ?? m);
// Gramatický tvar podľa čísla: 1 slovo, 3 slová, 12,1 slova, 5 slov.
export const tvar = (n,jazyk,formy,desatinne=false) => formy[new Intl.PluralRules(jazyk,desatinne?{minimumFractionDigits:1}:{}).select(n)] ?? formy.other;
const cislo = (n,jazyk,d=0) => new Intl.NumberFormat(jazyk,{minimumFractionDigits:d,maximumFractionDigits:d}).format(n);
export function nalezy(r) {
  return typy.slice(0,5).map((typ,i) => {
    const id = 'M'+(meraniaTypov[i]+1), m = r.merania[id];
    const hits = r.zvyraznenia.filter(h => h.typ === typ);
    return {typ,i,id,hits,vaha: (m?.skore ?? 0)*JAZYKY[r.jazyk].VAHY[id]};
  }).filter(p => p.hits.length).sort((a,b) => b.vaha-a.vaha || a.i-b.i);
}
export const priority = r => nalezy(r).filter(p => p.vaha > 0).slice(0,3);
export const nazovNalezu = (p,t) => t.types[p.i]+': '+(p.typ === 'pointa' ? p.hits[0].text : p.hits.length);
// Rovnaké delenie ako v jadre, vrátane NFC, nadpisu, zoznamov, vynechaných riadkov a limitu 5 000 slov.
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
// Nad 60 viet by stĺpce po vetách boli nečitateľné; ukážeme rozloženie dĺžok.
export const HISTOGRAM_OD = 60;
export const KOSE = [[1,5],[6,10],[11,15],[16,20],[21,25],[26,35],[36,Infinity]];
export const histogram = dl => KOSE.map(([a,b]) => ({a,b,n:dl.filter(x => x>=a && x<=b).length}));
export function grafRytmu(r,t,original) {
  const dl=r.dlzky_viet ?? [], d=rytmusData(r), j=r.jazyk, hist=dl.length>HISTOGRAM_OD;
  const percent=n=>(n/d.max*100).toFixed(3);
  const priemer=t.average+': '+cislo(d.priemer,j,1)+' '+tvar(d.priemer,j,t.wordForms,true);
  const vysvetlenie=hist ? doplnit(t.rhythmExplainHist,{n:dl.length+' '+tvar(dl.length,j,t.sentenceForms)}) : t.rhythmExplain;
  let html='<figure class="rk-rytmus" aria-labelledby="rytmus-nadpis" aria-describedby="rytmus-vysvetlenie"><figcaption>'+
    '<h3 id="rytmus-nadpis">'+esc(t.rhythmTitle)+'</h3><p class="small" id="rytmus-vysvetlenie">'+esc(vysvetlenie)+'</p>'+
    '<p class="rk-verdikt" id="rytmus-popis">'+esc(t[d.popis])+'</p></figcaption>';
  if(hist) {
    const kose=histogram(dl), max=Math.max(1,...kose.map(k=>k.n)), podiel=new Intl.NumberFormat(j,{style:'percent'});
    return html+'<p class="small rk-legenda rk-legenda-text"><span>'+esc(priemer)+'</span></p>'+
      '<div class="rk-graf-posun"><div class="rk-graf rk-histogram">'+kose.map((k,i)=>{
        const rozsah=k.b===Infinity ? doplnit(t.binLast,{a:k.a}) : doplnit(t.binRange,{a:k.a,b:k.b});
        const popis=rozsah+': '+k.n+' '+tvar(k.n,j,t.sentenceForms)+' ('+podiel.format(k.n/dl.length)+')';
        return '<button type="button" class="rk-stlpec" data-kos="'+i+'" aria-pressed="false" style="--podiel:'+(k.n/max).toFixed(3)+'">'+
          '<span class="rk-kos-pocet" aria-hidden="true">'+k.n+'</span><span class="rk-stlpec-kresba" aria-hidden="true"></span>'+
          '<span class="rk-kos-popis" aria-hidden="true">'+(k.b===Infinity?k.a+'+':k.a+'-'+k.b)+'</span><span class="rk-sr">'+esc(popis)+'</span></button>';
      }).join('')+'</div></div><p class="small rk-veta-detail" id="rytmus-detail" data-navod="'+esc(t.rhythmHintHist)+'" aria-live="polite" aria-atomic="true">'+esc(t.rhythmHintHist)+'</p></figure>';
  }
  const vety=vetyGrafu(original,r);
  return html+'<p class="small rk-legenda"><span>'+esc(priemer)+'</span><span>'+esc(t.uniform)+' ±15 %</span></p>'+
    '<div class="rk-graf-posun"><div class="rk-graf" style="--priemer:'+percent(d.priemer)+'%;--dolna:'+percent(d.dolna)+'%;--pas:'+percent(d.horna-d.dolna)+'%">'+
    '<span class="rk-priemer" aria-hidden="true"></span><span class="rk-rovnomerne" aria-hidden="true"></span>'+
    dl.map((n,i)=>'<button type="button" class="rk-stlpec" data-veta="'+i+'" aria-pressed="false" style="--vyska:'+percent(n)+'%"><span class="rk-stlpec-kresba" aria-hidden="true"></span><span class="rk-sr">'+esc(t.sentence)+' '+(i+1)+': '+n+' '+esc(tvar(n,j,t.wordForms))+'. <span lang="'+j+'">'+esc(vety[i]??'')+'</span></span></button>').join('')+
    '</div></div><p class="small rk-veta-detail" id="rytmus-detail" data-navod="'+esc(t.rhythmHint)+'" aria-live="polite" aria-atomic="true">'+esc(t.rhythmHint)+'</p></figure>';
}
// Koľko riadkov z PDF alebo Wordu sme vynechali a prečo; zlepené slová s príkladom.
export function vynechaneHtml(r,t) {
  const v=r.vynechane ?? [], z=r.zlepene ?? [], j=r.jazyk;
  if(!v.length && !z.length) return '';
  const pocty=DOVODY.map(d=>[d,v.filter(x=>x.dovod===d).length]).filter(([,n])=>n);
  return '<div class="rk-vynechane" id="vynechane">'+
    (v.length ? '<p><strong>'+esc(doplnit(t.skipped,{n:v.length+' '+tvar(v.length,j,t.lineForms)}))+'</strong> '+esc(t.skippedWhy)+'</p>'+
      '<ul>'+pocty.map(([d,n])=>'<li><span>'+esc(t.reasons[d])+'</span><b>'+n+'</b></li>').join('')+'</ul>' : '')+
    (z.length ? '<p>'+esc(doplnit(t.glued,{n:z.length,w:z[0]}))+'</p>' : '')+'</div>';
}
export function suhrn(r,t,original='',animovat=false) {
  const top=nalezy(r), pasma=['zivy','zmiesany','prilis_uhladeny'];
  return '<p class="small" id="index-nazov">'+esc(t.index)+'</p><div class="rk-index"><p class="cislo"><span id="index">'+r.index+'</span><small> / 100</small></p><div><p id="pasmo" class="rk-pasmo" data-pasmo="'+r.pasmo+'">'+esc(t.bands[pasma.indexOf(r.pasmo)])+'</p>'+(r.ciastocny?'<p class="small rk-ciastocny">'+esc(t.partial)+'</p>':'')+'</div></div>'+
    '<div class="rk-stupnica" role="meter" aria-labelledby="index-nazov" aria-describedby="kalibracia" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+r.index+'" aria-valuetext="'+esc(r.index+' / 100, '+pasmoText(r,t))+'"><div class="rk-pasma" aria-hidden="true">'+pasma.map(p=>'<span data-pasmo="'+p+'"></span>').join('')+'</div><span class="rk-znacka'+(animovat?' rk-znacka-vstup':'')+'" style="--hodnota:'+r.index+'" aria-hidden="true"></span></div>'+
    '<div class="rk-stupnica-popisy">'+t.bands.map((b,i)=>'<span>'+esc(b)+'<small>'+['0 - 34','35 - 64','65 - 100'][i]+'</small></span>').join('')+'</div><p class="small" id="kalibracia">'+esc(t.meaning)+' '+esc(t.calibration)+'</p>'+
    vynechaneHtml(r,t)+
    '<ul class="rk-cipy" aria-label="'+esc(t.findings)+'">'+top.map(p=>'<li><button type="button" class="rk-cip typ-'+p.typ+'" data-filter="'+p.typ+'" aria-pressed="false" aria-controls="oznaceny-text"><span class="rk-typ-bod" aria-hidden="true"></span><span>'+esc(t.metrics[meraniaTypov[p.i]])+'</span><span class="rk-pocet">'+p.hits.length+'</span></button></li>').join('')+'</ul>'+
    (top.length ? '<p class="small rk-na-vysvetlenie"><a href="#opravy-nadpis">'+esc(t.explainLink)+'</a></p>' : '')+
    grafRytmu(r,t,original);
}
export function oznaceny(original,r,t) {
  let od=0;
  const hits=[...r.zvyraznenia,...(r.vynechane ?? []).map(v=>({...v,typ:'mimo'}))];
  return kusky(original.slice(0,r.merane_do),hits).map(k=>{
    const id=od, typyKusku=k.typy.filter(x=>x!=='mimo'); od+=k.text.length;
    if(typyKusku.length) return '<button type="button" class="rk-nalez typ-'+typyKusku[0]+'" id="nalez-'+id+'" data-typy="'+typyKusku.join(' ')+'" aria-describedby="bublina">'+esc(k.text)+'</button>';
    return k.typy.length ? '<span class="rk-mimo">'+esc(k.text)+'</span>' : esc(k.text);
  }).join('');
}
// Úryvok okolo prvého výskytu: najviac 70 znakov na každú stranu, v rámci odseku, celé slová.
export function ukazka(original,h,vynechane=[]) {
  // Vynechané riadky (čísla strán, nadpisy, vzorce) do úryvku nepatria.
  const bez=(a,b)=>{
    let s='', i=a;
    for(const v of vynechane) {
      if(v.do<=i || v.od>=b) continue;
      if(v.od>i) s+=original.slice(i,v.od);
      i=Math.max(i,v.do);
    }
    return i<b ? s+original.slice(i,b) : s;
  };
  const DOSAH=70, odsek=/\r?\n[ \t]*\r?\n/;
  const predKusy=bez(0,h.od).split(odsek), poKusy=bez(h.do,original.length).split(odsek);
  let pred=predKusy.pop(), po=poKusy[0];
  // Úryvok drží hranice vety, ak sú v dosahu; inak ho skráti na celé slová s tromi bodkami.
  const zaciatokVety=[...pred.matchAll(/[.!?…]["'“”»)]*\s+/gu)].pop();
  if(zaciatokVety && pred.length-(zaciatokVety.index+zaciatokVety[0].length)<=DOSAH) pred=pred.slice(zaciatokVety.index+zaciatokVety[0].length);
  const koniecVety=po.match(/^[\s\S]*?[.!?…]["'“”»)]*(?=\s|$)/u);
  if(koniecVety && koniecVety[0].length<=DOSAH) po=koniecVety[0];
  if(pred.length>DOSAH) pred='…'+pred.slice(-DOSAH).replace(/^\S*\s+/,'');
  if(po.length>DOSAH) po=po.slice(0,DOSAH).replace(/\s+\S*$/,'')+'…';
  const riadok=s=>esc(s.replace(/\s+/g,' '));
  return riadok(pred).trimStart()+'<mark>'+riadok(h.text)+'</mark>'+riadok(po).trimEnd();
}
export function opravy(r,t,original='') {
  const zoznam=nalezy(r), j=r.jazyk;
  if(!zoznam.length) return '<p>'+esc(t.nofindings)+'</p>';
  return '<p class="small rk-opravy-uvod">'+esc(t.firstLead)+'</p><ol class="rk-opravy">'+zoznam.map(p=>{
    const m=meraniaTypov[p.i], n=p.hits.length, h=p.hits[0];
    const pocet=n+' '+tvar(n,j,t.hitForms)+(r.slov>=300?' · '+doplnit(t.perHundred,{n:cislo(n/r.slov*100,j,1)}):'');
    return '<li class="rk-typ typ-'+p.typ+'"><div class="rk-typ-hlava"><h3><span class="rk-typ-bod" aria-hidden="true"></span>'+esc(t.metrics[m])+'</h3><p class="rk-typ-pocet">'+esc(pocet)+'</p></div>'+
      '<div class="rk-typ-telo"><p>'+esc(t.advice[m][0])+'</p>'+
      (original ? '<figure class="rk-ukazka"><figcaption>'+esc(t.inText)+'</figcaption><blockquote lang="'+j+'">'+ukazka(original,h,r.vynechane)+'</blockquote></figure>' : '')+
      '<p><strong>'+esc(t.todo)+':</strong> '+esc(t.advice[m][1])+'</p><a class="btn btn-line" href="#nalez-'+h.od+'" data-skok="'+h.od+'">'+esc(t.jump)+'</a></div></li>';
  }).join('')+'</ol>';
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

// Samostatná správa na stiahnutie (29. 9. 2026): celý výsledok v jednom HTML súbore s vloženým štýlom, bez skriptov
// a bez odkazov na náš server; dá sa uložiť, poslať ďalej alebo vytlačiť do PDF. Tlačidlá z oznaceny/opravy sa menia
// na obyčajné značky, lebo v súbore by nič nerobili.
const FARBY={fraza:'#c4471f',pointa:'#9a6a2a',trojica:'#2e7d5b',nominalizacia:'#d9783f',pomlcka:'#5b5a55'};
export function spravaHtml(r,t,original,datum,jazykStranky) {
  const text=oznaceny(original,r,t)
    .replace(/<button type="button" class="rk-nalez (typ-[a-z]+)"[^>]*>/g,'<mark class="$1">').replace(/<\/button>/g,'</mark>');
  const zoznam=opravy(r,t,original).replace(/<a class="btn btn-line"[^>]*>[\s\S]*?<\/a>/g,'');
  const legenda=nalezy(r).map(p=>'<li><mark class="typ-'+p.typ+'">'+esc(t.metrics[meraniaTypov[p.i]])+'</mark> '+p.hits.length+'</li>').join('');
  const css='*{box-sizing:border-box}body{margin:0;padding:32px 20px 48px;background:#faf9f5;color:#2b2a27;font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}'+
    'main{max-width:760px;margin:0 auto}h1{font-size:30px;line-height:1.15;margin:0 0 6px;color:#141413}h2{font-size:20px;margin:36px 0 10px;color:#141413}h3{font-size:17px;margin:0 0 4px}'+
    '.malo{font-size:14px;color:#66645e}.index{display:flex;align-items:baseline;gap:14px;margin:18px 0 6px}.index b{font-size:56px;line-height:1;color:#141413}'+
    '.pasmo{font-weight:600}ol{padding-left:20px}li{margin:0 0 18px}blockquote{margin:8px 0;padding:8px 14px;border-left:3px solid #d8d4c8;background:#fff}'+
    'figure{margin:0}figcaption{font-size:13px;color:#66645e}.text{white-space:pre-wrap;overflow-wrap:anywhere;background:#fff;border:1px solid #e4e1d8;border-radius:12px;padding:18px 20px}'+
    'mark{background:#f3e7c2;border-radius:3px;padding:1px 0}'+Object.entries(FARBY).map(([k,v])=>'mark.typ-'+k+'{background:'+v+'26;box-shadow:inset 0 -2px 0 '+v+'}').join('')+
    '.rk-mimo{text-decoration:line-through;color:#8a877f}.rk-typ-bod{display:none}.legenda{list-style:none;padding:0;display:flex;flex-wrap:wrap;gap:8px 18px}'+
    '.legenda li{margin:0}footer{margin-top:40px;padding-top:14px;border-top:1px solid #e4e1d8}@media print{body{background:#fff;padding:0}}';
  return '<!doctype html><html lang="'+esc(jazykStranky)+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<title>'+esc(t.reportTitle)+'</title><style>'+css+'</style></head><body><main>'+
    '<h1>'+esc(t.reportTitle)+'</h1><p class="malo">'+esc(t.reportIntro)+'</p>'+
    '<p class="malo">'+esc(t.reportDate)+': '+esc(datum)+' · '+r.slov+' '+esc(t.words)+' · '+r.viet+' '+esc(t.sentences)+' · '+esc(t.version)+' '+esc(r.verzia)+'</p>'+
    '<div class="index"><b>'+r.index+'</b><span>/ 100</span><span class="pasmo">'+esc(pasmoText(r,t))+'</span></div>'+
    '<p>'+esc(t.meaning)+' '+esc(t.calibration)+'</p>'+
    '<h2>'+esc(t.first)+'</h2>'+zoznam+
    '<h2>'+esc(t.reportText)+'</h2>'+(legenda?'<p class="malo">'+esc(t.legend)+'</p><ul class="legenda">'+legenda+'</ul>':'')+'<div class="text" lang="'+esc(r.jazyk)+'">'+text+'</div>'+
    '<footer class="malo">'+esc(t.reportPrivacy)+' Rukopis, ARLing s. r. o., https://arling.sk/rukopis/</footer></main></body></html>';
}
