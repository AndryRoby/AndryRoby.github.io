// Zobrazenie troch nálezov EÚ (A-189, 20. 10. 2026) bez DOM: z poľa `eu` správy (core.mjs analyzeEu) a textov EU_UI vyrobí riadky,
// ktoré app.mjs len vloží cez textContent. Testy: eu-zobraz.test.mjs. Správa prichádza zo servera a mohla vzniknúť v staršej verzii,
// preto sa tvar overí a neznáme hodnoty sa zahodia; odkaz z nálezu sa ukáže len ako https adresa.
export const EU_CODES=['eu_withdrawal','eu_guarantee_notice','eu_green_claims'];
// link_found (relácia 208): odkaz na stránku objednávky platformy (core.mjs ORDER_PAGES), funkčnosť neoverená. Agent M2: pri not_found
// pole orderPage (odkaz „Moja objednávka“ na tú stránku s textom bez odstúpenia), stav sa ním nemení.
const STATUSES=['found','not_found','not_applicable','unknown','link_found'];
// Tón stavu pre farbu odznaku (text odznaku hovorí stav vždy aj slovom): ok = nič na kontrolu, review = pozrite sa, unknown = nevieme.
const TONE={eu_withdrawal:{found:'ok',not_found:'review',link_found:'unknown'},eu_guarantee_notice:{found:'ok',not_found:'review',not_applicable:'ok'},eu_green_claims:{found:'review',not_found:'ok'}};
export const toneOf=(code,status)=>status==='unknown'?'unknown':TONE[code]?.[status]||'unknown';
const fill=(s,v)=>String(s).replace(/\{(\w+)\}/g,(m,k)=>Object.hasOwn(v,k)?String(v[k]):m);
const str=(x,n=200)=>typeof x==='string'?x.replace(/\s+/g,' ').trim().slice(0,n):'';
const int=x=>Number.isInteger(x)&&x>=0?x:0;
export function safeHttps(url){try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}}
export function validEu(eu){return Boolean(eu&&typeof eu==='object'&&eu.version===1&&Array.isArray(eu.rules)&&eu.rules.length===EU_CODES.length
  &&eu.rules.every((r,i)=>r&&r.code===EU_CODES[i]&&STATUSES.includes(r.status)));}
const ENERGY=/^(?:energy efficient|energieeffizient|energeticky účinné|energeticky úsporné)$/;

/** Stav časti EÚ v správe: missing (správa pole eu nemá, starý worker), failed (eu je null alebo neznámeho tvaru), ok. */
export const euState=(report)=>!report||typeof report!=='object'||!Object.hasOwn(report,'eu')?'missing':validEu(report.eu)?'ok':'failed';
/** Riadky na zobrazenie alebo null, keď správa pole eu nemá alebo má neznámy tvar (stará verzia servera). */
export function euView(eu,t){
  if(!validEu(eu))return null;
  return eu.rules.map(r=>{
    // Len známy kľúč stránky (vlastná vlastnosť t.pages); zdedený kľúč ako „constructor“ zo správy iného tvaru je stránka produktu (M2).
    const x=t.rules[r.code],page=k=>typeof k==='string'&&Object.hasOwn(t.pages,k)?t.pages[k]:t.pages.product,lines=[];
    let manual=null;
    if(r.code==='eu_withdrawal'){
      const found=(Array.isArray(r.found)?r.found:[]).slice(0,3),similar=(Array.isArray(r.similar)?r.similar:[]).slice(0,3);
      if(r.status==='found'){for(const f of found)lines.push({text:fill(x.found,{label:str(f.label,120),page:page(f.page)}),href:safeHttps(f.href)});lines.push({text:x.foundNote,muted:true});manual=x.manualFound;}
      else if(r.status==='not_found'){
        lines.push({text:x.notFound});
        // orderPage (relácia 208, agent M2): odkaz ako „Moja objednávka“ na stránku objednávky platformy, ktorú stránky ukazujú (Shoptet),
        // s textom bez odstúpenia. Riadky idú hneď po notFound a pred podobné odkazy, ručná kontrola povie, ako pridať jasný odkaz; odznak
        // a tón ostávajú ako pri not_found. Starý i18n.mjs z vyrovnávacej pamäte nemá text orderPage: riadok sa vynechá a ručná kontrola
        // ostane manualNotFound, nikdy undefined ani {label}.
        const orders=typeof x.orderPage==='string'?(Array.isArray(r.orderPage)?r.orderPage:[]).filter(f=>f&&typeof f==='object'&&str(f.label,120)).slice(0,3):[];
        for(const f of orders)lines.push({text:fill(x.orderPage,{label:str(f.label,120),page:page(f.page)}),href:safeHttps(f.href)});
        for(const f of similar)lines.push({text:fill(x.similar,{label:str(f.label,120),page:page(f.page)}),href:safeHttps(f.href),muted:true});
        manual=orders.length&&typeof x.manualOrderPage==='string'?x.manualOrderPage:x.manualNotFound;
      }
      else if(r.status==='link_found'){
        // Odkaz na stránku objednávky platformy (relácia 208): formulár sa tam načítava JavaScriptom, preto „odkaz nájdený, funkčnosť
        // neoverená“. Prehliadač môže mať až 10 minút starý i18n.mjs bez nových kľúčov: vtedy veta o podobnom odkaze a ručná kontrola
        // ako pri not_found, nikdy undefined ani {label}.
        const system=(Array.isArray(r.system)?r.system:[]).filter(f=>f&&typeof f==='object'&&str(f.label,120)).slice(0,3);
        const text=typeof x.linkFound==='string'?x.linkFound:x.similar;
        for(const f of system)lines.push({text:fill(text,{label:str(f.label,120),page:page(f.page)}),href:safeHttps(f.href)});
        if(typeof x.linkFoundNote==='string')lines.push({text:x.linkFoundNote,muted:true});
        manual=typeof x.manualLinkFound==='string'?x.manualLinkFound:x.manualNotFound;
      }
      else lines.push({text:x.unknown});
    }else if(r.code==='eu_guarantee_notice'){
      const found=(Array.isArray(r.found)?r.found:[]).slice(0,3),links=(Array.isArray(r.links)?r.links:[]).slice(0,3);
      if(r.status==='found'){for(const f of found)lines.push({text:fill(f.in==='alt'?x.foundAlt:x.found,{page:page(f.page)})});lines.push({text:x.foundNote,muted:true});}
      else if(r.status==='not_applicable')lines.push({text:x.notApplicable});
      else if(r.status==='not_found'){lines.push({text:x.notFound});for(const l of links)lines.push({text:fill(x.links,{page:page(l.page)}),href:safeHttps(l.href),muted:true});}
      else lines.push({text:x.unknown});
      if(r.status!=='unknown')manual=x.manual;
    }else{
      const findings=(Array.isArray(r.findings)?r.findings:[]).slice(0,12),total=Math.max(int(r.total),findings.length);
      if(r.status==='found'){
        lines.push({text:fill(x.found,{products:int(r.products),with:int(r.withClaims),total})});
        for(const f of findings){const example=str(f.example,80),name=str(f.name,120)||str(f.product,120),context=str(f.context,200);
          lines.push({finding:{term:str(f.term,80),where:(t.fields[f.field]||t.fields.description)+': '+name,
          // Pri náleze v názve je úryvok sám názov produktu; neopakuje sa.
          context:context===name?'':context,example:fill(x.example,{example,point:f.point==='4c'?'4c':'4a'}),
          notes:[f.organic===true?'organic':null,ENERGY.test(example)?'energy':null].filter(Boolean).map(k=>x[k])}});}
        if(total>findings.length)lines.push({text:fill(x.more,{shown:findings.length,total}),muted:true});
      }else if(r.status==='not_found')lines.push({text:fill(x.notFound,{products:int(r.products)})});
      else lines.push({text:x.unknown});
      if(r.status!=='unknown')manual=x.manual;
    }
    // Pri náleze, ktorý môže opisovať certifikované bio, aj odkaz na nariadenie o ekologickej výrobe.
    const organic=lines.some(l=>l.finding&&l.finding.notes.includes(x.organic));
    // Odznak hovorí stav slovami toho pravidla (brána A-189 pokus 1, nález 7: „našli sme“ nesmie raz znamenať v poriadku a raz pozrite sa).
    // Podobný odkaz pri funkcii na odstúpenie nie je verdikt (nález 3): odznak „Overte odkaz“ a neutrálny tón.
    const podobny=r.code==='eu_withdrawal'&&r.status==='not_found'&&Array.isArray(r.similar)&&r.similar.length>0;
    // link_found: „Odkaz nájdený, funkčnosť neoverená“; so starým i18n.mjs bez toho kľúča „Overte odkaz“ (relácia 208).
    const badge=r.status==='link_found'?x.status?.link_found||x.status?.check||t.status.link_found||t.status.unknown
      :podobny&&x.status?.check?x.status.check:x.status?.[r.status]||t.status[r.status];
    return {code:r.code,status:r.status,tone:podobny?'unknown':toneOf(r.code,r.status),badge,title:x.title,applies:x.applies,what:x.what,lines,manual,
      law:organic&&t.organicLink?[...x.law,t.organicLink]:x.law};
  });
}
/** Stavy pre Umami (len kódy stavov a jazyk, nikdy adresy ani texty obchodu). */
export function euEvent(eu,lang){
  if(!validEu(eu))return null;
  const [w,n,c]=eu.rules.map(r=>r.status);
  return {lang,withdrawal:w,notice:n,claims:c,review:eu.rules.filter(r=>toneOf(r.code,r.status)==='review').length};
}
