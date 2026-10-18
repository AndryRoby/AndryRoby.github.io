/* Agent Ready v1. Pure, bounded inspection of public evidence, never an AI ranking. */
export const VERSION = '1.0.0';
export const SOURCES = Object.freeze({
  catalog: 'https://help.shopify.com/en/manual/online-sales-channels/agentic-storefronts/products',
  product: 'https://shopify.dev/docs/api/liquid/objects/product',
  variant: 'https://shopify.dev/docs/api/liquid/objects/variant',
  merchant: 'https://developers.google.com/search/docs/appearance/structured-data/merchant-listing',
  reviews: 'https://developers.google.com/search/docs/appearance/structured-data/review-snippet',
  openai: 'https://developers.openai.com/api/docs/bots',
  perplexity: 'https://docs.perplexity.ai/docs/resources/perplexity-crawlers',
  google: 'https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers#google-extended',
  llms: 'https://llmstxt.org/',
  robots: 'https://www.rfc-editor.org/rfc/rfc9309.html',
});
// [code, severity, weight, source, title, explanation and remedy]. Weights are ours.
export const RULES = [
  ['feed_title','error',3,'catalog','Product names','Give each sampled product a descriptive title, not just a code.'],
  ['feed_type','warning',1,'product','Product type','Fill in the product type. This is not the same field as Shopify product category.'],
  ['feed_vendor','warning',1,'product','Vendor or brand','Add the true manufacturer or brand; do not invent one.'],
  ['feed_description','warning',2,'catalog','Useful descriptions','Describe material, size and use. We flag fewer than 80 plain-text characters as a local heuristic, not a platform requirement.'],
  ['feed_options','warning',2,'variant','Named variant options','For products with multiple variants, publish option names and values that distinguish each variant.'],
  ['feed_price','error',3,'catalog','Variant prices','Publish a finite non-negative price for each variant. Currency is checked on the product page.'],
  ['feed_availability','error',3,'catalog','Variant availability','Publish an explicit true or false availability value for each variant. False means sold out, not an error.'],
  ['feed_gtin','warning',0,'variant','Barcode evidence','Check manufacturer-assigned GTINs in your admin. Missing public barcodes are unknown, not a failure; never invent identifiers. Invalid published GTIN checksums are flagged.'],
  ['feed_images','warning',2,'catalog','Product images','Publish at least one HTTPS image URL for each product. We check the URL, not the image contents.'],
  ['feed_alt','info',0,'product','Image descriptions','Where the public feed exposes alt text, describe the product image. An omitted alt field is unknown; an empty field needs review.'],
  ['jsonld_parse','error',2,'merchant','Readable JSON-LD','Repair invalid application/ld+json blocks. JSON-LD added only by JavaScript is outside this check.'],
  ['jsonld_product','error',3,'merchant','Product structured data','Include a Product or ProductGroup in the initial HTML of the sampled product page. This checker does not inspect Microdata or RDFa.'],
  ['jsonld_identity','warning',2,'merchant','Product name and image','Give every sampled Product a name and an HTTP(S) image URL that describe that product.'],
  ['jsonld_offer','error',3,'merchant','Product offers','Attach Offer or AggregateOffer data to the sampled Product, including through @id references or hasVariant.'],
  ['jsonld_price','error',3,'merchant','Price and currency','Use a numeric price and a three-letter currency on each offer. AggregateOffer needs a lowPrice; valid priceSpecification is supported.'],
  ['jsonld_availability','warning',2,'merchant','Offer availability','Use a recognized schema.org availability value on each Offer. AggregateOffer availability is not required here.'],
  ['jsonld_returns','warning',1,'merchant','Structured return policy','Publish a MerchantReturnPolicy on the product offer or Organization. Include applicableCountry and a returnPolicyCategory. Account-level settings cannot be read here.'],
  ['jsonld_shipping','warning',1,'merchant','Structured shipping','Add OfferShippingDetails with destination and shippingRate, or configure shipping in the merchant platform. This check cannot read private account settings.'],
  ['jsonld_rating','info',0,'reviews','Review claims need evidence','If you publish AggregateRating, keep the rating and positive review count valid and backed by real reviews visible to shoppers. We cannot authenticate reviews. No rating is required.'],
  ['policy_returns','warning',1,'catalog','Return information','Link to a readable return or refund policy on this shop. We check access and a minimum body, not legal sufficiency.'],
  ['policy_shipping','warning',1,'catalog','Delivery information','Link to readable shipping information on this shop. We do not verify its accuracy or delivery promises.'],
  ['policy_contact','warning',1,'catalog','Contact information','Link to a readable contact page on this shop so shoppers can find a way to reach you.'],
  ['robots_search','warning',2,'openai','OAI-SearchBot access','Review robots.txt rules for the sampled product paths. Allow OAI-SearchBot if you want ChatGPT search crawling; this does not guarantee inclusion.'],
  ['robots_perplexity','warning',1,'perplexity','PerplexityBot access','Review robots.txt for PerplexityBot on the sampled paths. Its search crawler is separate from foundation-model training.'],
  ['robots_user','info',0,'openai','ChatGPT-User preference','This is a user-triggered fetcher. A robots.txt preference does not establish whether user-triggered requests work.'],
  ['robots_google_extended','info',0,'google','Google-Extended preference','This token controls Gemini training and some grounding. It does not control inclusion or ranking in Google Search.'],
  ['llms','info',0,'llms','Optional llms.txt','This proposed context file is optional. Its absence has no score penalty and its presence is not a ranking guarantee.'],
].map(([code,severity,weight,source,title,fix])=>Object.freeze({code,severity,weight,source:SOURCES[source],title,fix}));

export const clean = x => typeof x === 'string' ? x.trim() : '';
const list = x => x == null ? [] : Array.isArray(x) ? x : [x];
export function decodeEntities(s) {
  return String(s).replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (_,v) => {
    if(v[0]!=='#') return {amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' '}[v.toLowerCase()];
    const n = v[1].toLowerCase()==='x' ? parseInt(v.slice(2),16) : Number(v.slice(1));
    return n>0 && n<=0x10ffff && !(n>=0xd800 && n<=0xdfff) ? String.fromCodePoint(n) : '\ufffd';
  });
}
/* Linear-time scanners (18. 10. 2026). Shop markup is attacker-controlled; the former
   regular expressions could backtrack quadratically and burn a whole Worker CPU limit.
   Each scanner returns exactly what its former expression returned (see core.test.mjs). */
// Former: s.replace(/<[^>]*>/g,' ')
function stripTags(s){let out='',i=0;for(;;){const lt=s.indexOf('<',i);if(lt<0)break;const gt=s.indexOf('>',lt+1);if(gt<0)break;out+=s.slice(i,lt)+' ';i=gt+1;}return out+s.slice(i);}
// Former: s.replace(/<!--[\s\S]*?-->/g,'')
function stripComments(s){let out='',i=0;for(;;){const a=s.indexOf('<!--',i);if(a<0)break;const b=s.indexOf('-->',a+4);if(b<0)break;out+=s.slice(i,a);i=b+3;}return out+s.slice(i);}
// Former: s.replace(/<(script|style|template|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'')
function stripRawBlocks(s){
  const open=/<(script|style|template|noscript)\b/gi,unclosed=Object.create(null);
  let out='',pos=0,gtFrom=-1,gtAt=-1,m;
  while((m=open.exec(s))){
    const from=open.lastIndex;
    if(!(gtAt>=from&&gtFrom<=from)){gtFrom=from;gtAt=s.indexOf('>',from);}
    if(gtAt<0)break; // no '>' left: no later block can match either
    const name=m[1].toLowerCase();
    if(name in unclosed&&unclosed[name]<=gtAt+1){open.lastIndex=m.index+1;continue;}
    const close=new RegExp('</'+name+'\\s*>','ig');close.lastIndex=gtAt+1;const e=close.exec(s);
    if(!e){unclosed[name]=gtAt+1;open.lastIndex=m.index+1;continue;}
    out+=s.slice(pos,m.index);pos=close.lastIndex;open.lastIndex=pos;
  }
  return out+s.slice(pos);
}
export function plain(s) { return decodeEntities(stripTags(String(s||''))).replace(/\s+/g,' ').trim(); }
export function httpUrl(s, base) { try {const u=new URL(s,base); return /^https?:$/.test(u.protocol)&&!u.username&&!u.password ? u.href : null;}catch{return null;} }
export function validGtin(value) {
  const s=String(value||''); if(!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(s)) return false;
  let sum=0; for(let i=s.length-2,w=3;i>=0;i--,w=4-w) sum+=Number(s[i])*w;
  return (10-sum%10)%10===Number(s.at(-1));
}
/* Former tokenizer: /<!--[\s\S]*?(?:-->|$)|<![^>]*>|<\/?[a-z][^>"']*(?:(?:"[^"]*"|'[^']*')[^>"']*)*>/gi
   with exec(). Same matches in linear time: a tag scan that runs into the end of input
   fails, and every (position, quote state) of a failed scan is remembered, so no later
   scan walks it again. Positions behind a successful match are never scanned again. */
const isLetter=c=>c>=65&&c<=90||c>=97&&c<=122;
function tagScanner(html){
  const n=html.length,dead=new Uint8Array(n+1);
  return function next(from){
    for(let i=from;;){
      const lt=html.indexOf('<',i);if(lt<0)return null;
      if(html.startsWith('<!--',lt)){const e=html.indexOf('-->',lt+4);return {start:lt,end:e<0?n:e+3,bang:true};}
      if(html.charCodeAt(lt+1)===33){const g=html.indexOf('>',lt+2);if(g>=0)return {start:lt,end:g+1,bang:true};i=lt+1;continue;}
      let p=lt+1;if(html.charCodeAt(p)===47)p++;
      if(!isLetter(html.charCodeAt(p))){i=lt+1;continue;}
      let state=0,end=-1; // 0 outside quotes, 1 inside "", 2 inside ''
      for(let q=p+1;q<n;q++){
        const bit=1<<state;if(dead[q]&bit)break;dead[q]|=bit;
        const c=html.charCodeAt(q);
        if(state===0){if(c===62){end=q+1;break;}if(c===34)state=1;else if(c===39)state=2;}
        else if(c===(state===1?34:39))state=0;
      }
      if(end>0)return {start:lt,end,bang:false};
      i=lt+1;
    }
  };
}
/* Bounded HTML tokenizer: quoted >, comments, raw script/style and inert template
   contents are handled. It extracts data only; fetched markup is never rendered. */
export function extractHtml(html, url) {
  html=String(html||''); if(html.length>2_100_000) throw new Error('html_limit');
  const tags=[], blocks=[], links=[]; let invalid=0, inert=0;
  const next=tagScanner(html);
  for(let t=next(0),pos=0;t;t=next(pos)){
    pos=t.end;
    if(t.bang)continue;
    const tag=html.slice(t.start,t.end);
    const name=/^<\/?([^\s/>]+)/.exec(tag)[1].toLowerCase(), closing=tag[1]==='/';
    if(name==='template'||name==='noscript'){inert=Math.max(0,inert+(closing?-1:1));continue;}
    if(closing)continue;
    const attrs=Object.create(null), ar=/([^\s=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
    const body=tag.slice(name.length+1,-1); let a;
    while((a=ar.exec(body))){const k=a[1].toLowerCase();if(!(k in attrs))attrs[k]=decodeEntities(a[2]??a[3]??a[4]??'');}
    if(name==='script'||name==='style'||name==='textarea'||name==='title'){
      const end=new RegExp('</'+name+'\\s*>','ig');end.lastIndex=pos;const e=end.exec(html);
      const raw=html.slice(pos,e?e.index:html.length);pos=e?end.lastIndex:html.length;
      if(!inert&&name==='script'&&clean(attrs.type).toLowerCase()==='application/ld+json'){
        try{blocks.push(JSON.parse(raw));}catch{invalid++;}
      }
      continue;
    }
    if(inert)continue;
    if(tags.length<15000)tags.push({name,attrs});
    if(name==='a'&&attrs.href&&links.length<2000){const href=httpUrl(attrs.href,url);if(href)links.push(href);}
  }
  const nodes=[],candidates=[]; const queue=blocks.map(x=>({x,depth:0,ancillary:false}));
  while(queue.length&&nodes.length<5000){const {x,depth,ancillary}=queue.shift();if(!x||typeof x!=='object'||depth>32)continue;
    if(!Array.isArray(x)){nodes.push(x);if(!ancillary)candidates.push(x);}
    for(const [key,value] of Object.entries(x))if(value&&typeof value==='object')queue.push({x:value,depth:depth+1,ancillary:ancillary||['itemListElement','isRelatedTo','isSimilarTo','isVariantOf','itemReviewed'].includes(key)});
  }
  const ids=new Map(nodes.filter(n=>typeof n['@id']==='string'&&Object.keys(n).length>1).map(n=>[n['@id'],n]));
  const resolve=x=>x&&typeof x==='object'&&x['@id']&&ids.has(x['@id']) ? {...ids.get(x['@id']),...x} : x;
  const typed=(x,type)=>list(x?.['@type']).some(t=>String(t).replace(/^https?:\/\/schema.org\//,'')===type);
  const products=candidates.filter(n=>(typed(n,'Product')||typed(n,'ProductGroup'))&&(!n.url||(()=>{try{return new URL(n.url,url).pathname===new URL(url).pathname;}catch{return false;}})()));
  const productOffers=products.map(p=>[...list(p.offers),...list(p.hasVariant).map(resolve).flatMap(v=>list(v?.offers))].map(resolve).filter(o=>typed(o,'Offer')||typed(o,'AggregateOffer')));
  const offers=productOffers.flat();
  const organizations=nodes.filter(n=>typed(n,'Organization')||typed(n,'OnlineStore'));
  const returns=[...offers,...organizations].flatMap(n=>list(n.hasMerchantReturnPolicy)).map(resolve);
  const shipping=offers.flatMap(n=>list(n.shippingDetails)).map(resolve);
  const ratings=products.flatMap(n=>list(n.aggregateRating)).map(resolve);
  const noindex=tags.some(t=>t.name==='meta'&&/^(robots|googlebot)$/i.test(t.attrs.name||'')&&/\bnoindex\b/i.test(t.attrs.content||''));
  return {blocks:blocks.length,invalid,products,productOffers,offers,returns,shipping,ratings,links:[...new Set(links)],noindex,
    textLength:plain(stripRawBlocks(stripComments(html))).length};
}
const typed=(x,type)=>list(x?.['@type']).some(t=>String(t).replace(/^https?:\/\/schema.org\//,'')===type);

function robotsPath(s){return s.replace(/%[\da-f]{2}/gi,m=>{const n=parseInt(m.slice(1),16);return /[A-Za-z0-9._~-]/.test(String.fromCharCode(n))?String.fromCharCode(n):m.toUpperCase();}).replace(/[^\x00-\x7F]/gu,c=>encodeURIComponent(c));}
/* robots.txt is parsed once per text (the scan asks about 35 times) and matched without
   regular expressions: '*' segments are found left to right, which is exact for '*'-only
   patterns, so hostile rules cannot backtrack. Files over 500 KiB (RFC 9309 section 2.5
   requires parsing at least that much) or with more than 5000 rules are not evaluated:
   robotsReadable() is false and callers treat robots as unknown, never as allowed. */
const ROBOTS_MAX_CHARS=512_000, ROBOTS_MAX_RULES=5_000;
let robotsMemo=null;
function parseRobots(text){
  const src=String(text);
  if(robotsMemo&&robotsMemo.src===src)return robotsMemo.parsed;
  const groups=[];let current=null, directives=false, rules=0, readable=src.length<=ROBOTS_MAX_CHARS;
  if(readable)for(const line of src.split(/\r?\n/)){
    // Former: /^\s*([\w-]+)\s*:\s*(.*?)\s*$/ on the part before '#'.
    const before=line.split('#')[0],colon=before.indexOf(':');if(colon<0)continue;
    const name=before.slice(0,colon).trim(),value=before.slice(colon+1).trim();
    if(!/^[\w-]+$/.test(name)||/[\r\u2028\u2029]/.test(value))continue;
    const key=name.toLowerCase();
    if(key==='user-agent') {if(!current||directives){current={agents:[],rules:[]};groups.push(current);directives=false;}current.agents.push(value.toLowerCase());}
    else if(current&&(key==='allow'||key==='disallow')){directives=true;if(value){
      if(++rules>ROBOTS_MAX_RULES){readable=false;break;}
      const path=robotsPath(value),anchored=path.endsWith('$'),raw=anchored?path.slice(0,-1):path;
      current.rules.push({allow:key==='allow',anchored,parts:raw.split('*'),size:new TextEncoder().encode(raw.replace(/\*/g,'')).length});
    }}
  }
  const parsed={readable,groups:readable?groups:[]};
  robotsMemo={src,parsed};return parsed;
}
// Former: new RegExp('^'+parts.map(escape).join('.*')+(anchored?'$':'')).test(path)
function robotsMatch(rule,path){
  const parts=rule.parts,last=parts.length-1;
  if(!path.startsWith(parts[0]))return false;
  if(last===0)return !rule.anchored||path.length===parts[0].length;
  const end=rule.anchored?path.length-parts[last].length:path.length;let pos=parts[0].length;
  if(rule.anchored&&(end<pos||!path.endsWith(parts[last])))return false;
  for(let i=1;i<last;i++){const at=path.indexOf(parts[i],pos);if(at<0||at+parts[i].length>end)return false;pos=at+parts[i].length;}
  return rule.anchored||path.indexOf(parts[last],pos)>=0;
}
export function robotsReadable(text){return parseRobots(text).readable;}
export function robotsAllows(text, agent, path='/') {
  const {groups}=parseRobots(text);
  const specific=groups.filter(g=>g.agents.includes(agent.toLowerCase()));
  const selected=specific.length?specific:groups.filter(g=>g.agents.includes('*'));
  let best=-1,allowed=true;path=robotsPath(path);
  for(const g of selected)for(const r of g.rules){
    if(robotsMatch(r,path)&&(r.size>best||(r.size===best&&r.allow))){best=r.size;allowed=r.allow;}
  }
  return allowed;
}
const numeric=v=>(typeof v==='number'||typeof v==='string'&&/^\d+(?:\.\d+)?$/.test(v))&&Number.isFinite(Number(v))&&Number(v)>=0;
const available=new Set(['BackOrder','Discontinued','InStock','InStoreOnly','LimitedAvailability','OnlineOnly','OutOfStock','PreOrder','PreSale','SoldOut']);
const goodResource=r=>r?.status===200&&typeof r.text==='string';

export function analyzeStore(snapshot) {
  const evidence=snapshot.resources||{}; const results=new Map();
  const put=(code,items,predicate,{unavailable=false,info=false}={})=>{
    const known=items.filter(x=>x!=null);const affected=known.filter(x=>!predicate(x));
    const state=unavailable||!known.length?'unknown':affected.length?'fail':info?'info':'pass';
    results.set(code,{code,status:state,checked:known.length,affected:affected.length,affectedIds:affected.slice(0,5).map(x=>String(x?.handle??x?.id??x?.url??x?.src??x?.barcode??x)).map(x=>x.slice(0,200))});
  };
  let feed=null; if(goodResource(evidence.feed)){try{feed=JSON.parse(evidence.feed.text);}catch{}}
  const products=Array.isArray(feed?.products)?feed.products.slice(0,20).filter(p=>p&&typeof p==='object'):[];
  const variants=products.flatMap(p=>Array.isArray(p.variants)?p.variants:[null]);
  put('feed_title',products,p=>clean(p.title).length>=3);
  put('feed_type',products,p=>!!clean(p.product_type));
  put('feed_vendor',products,p=>!!clean(p.vendor));
  put('feed_description',products,p=>plain(p.body_html).length>=80);
  put('feed_options',products,p=>!Array.isArray(p.variants)?false:p.variants.length<=1||Array.isArray(p.options)&&p.options.length>0&&p.options.every((o,i)=>clean(typeof o==='string'?o:o?.name)&&!/^title$/i.test(typeof o==='string'?o:o?.name)&&p.variants.every(v=>clean(v?.['option'+(i+1)])))&&new Set(p.variants.map(v=>JSON.stringify(p.options.map((_,i)=>v?.['option'+(i+1)])))).size===p.variants.length);
  put('feed_price',products,p=>Array.isArray(p.variants)&&p.variants.length>0&&p.variants.every(v=>numeric(v?.price)));
  put('feed_availability',products,p=>Array.isArray(p.variants)&&p.variants.length>0&&p.variants.every(v=>typeof v?.available==='boolean'));
  const barcodes=variants.filter(v=>v&&clean(String(v.barcode??'')));
  put('feed_gtin',barcodes,v=>validGtin(v.barcode));
  put('feed_images',products,p=>Array.isArray(p.images)&&p.images.some(i=>httpUrl(i?.src)?.startsWith('https:')));
  const images=products.flatMap(p=>Array.isArray(p.images)?p.images:[]).filter(i=>i&&Object.hasOwn(i,'alt'));
  put('feed_alt',images,i=>plain(i.alt).length>0,{info:true});

  const pageResources=(snapshot.productPages||[]).slice(0,3);
  const pages=pageResources.filter(goodResource).map(r=>({...extractHtml(r.text,r.url),url:r.url}));
  put('jsonld_parse',pages,p=>p.invalid===0);
  put('jsonld_product',pages,p=>p.products.length>0);
  put('jsonld_identity',pages.filter(p=>p.products.length),p=>p.products.every(x=>clean(x.name)&&list(x.image).some(i=>httpUrl(typeof i==='string'?i:i?.url))));
  put('jsonld_offer',pages.filter(p=>p.products.length),p=>p.productOffers.every(offers=>offers.length>0));
  put('jsonld_price',pages.filter(p=>p.offers.length),p=>p.offers.every(o=>{
    const price=o.price??(typed(o,'AggregateOffer')?o.lowPrice:undefined);
    if(price!=null)return numeric(price)&&/^[A-Z]{3}$/.test(o.priceCurrency||'');
    return list(o.priceSpecification).some(s=>numeric(s?.price)&&/^[A-Z]{3}$/.test(s?.priceCurrency||'')&&!s.priceType&&!s.validForMemberTier);
  }));
  put('jsonld_availability',pages.filter(p=>p.offers.some(o=>!typed(o,'AggregateOffer'))),p=>p.offers.filter(o=>!typed(o,'AggregateOffer')).every(o=>available.has(String(o.availability||'').replace(/^https?:\/\/schema.org\//,''))));
  put('jsonld_returns',pages.filter(p=>p.products.length),p=>p.returns.some(r=>typed(r,'MerchantReturnPolicy')&&r.applicableCountry&&/^https?:\/\/schema.org\/MerchantReturn(?:FiniteReturnWindow|NotPermitted|UnlimitedWindow)$/.test(r.returnPolicyCategory||'')&&(String(r.returnPolicyCategory).endsWith('FiniteReturnWindow')?numeric(r.merchantReturnDays):true)));
  put('jsonld_shipping',pages.filter(p=>p.offers.length),p=>p.shipping.some(s=>typed(s,'OfferShippingDetails')&&s.shippingDestination?.addressCountry&&s.shippingRate&&numeric(s.shippingRate.value)&&/^[A-Z]{3}$/.test(s.shippingRate.currency||'')));
  const ratings=pages.flatMap(p=>p.ratings);
  put('jsonld_rating',ratings,r=>{const n=Number(r.ratingValue),max=Number(r.bestRating??5),min=Number(r.worstRating??1),count=Number(r.reviewCount??r.ratingCount);return Number.isFinite(n)&&min<=n&&n<=max&&max>min&&Number.isInteger(count)&&count>0;},{info:true});
  for(const kind of ['returns','shipping','contact']){
    const r=evidence[kind];put('policy_'+kind,r?[r]:[],x=>goodResource(x)&&extractHtml(x.text,x.url).textLength>=80,{unavailable:r&&![200,404,410].includes(r.status)});
  }
  const robots=evidence.robots;
  const robotsKnown=goodResource(robots)&&robotsReadable(robots.text)||[404,410].includes(robots?.status);
  const paths=pageResources.map(r=>{try{const u=new URL(r.url);return u.pathname+u.search;}catch{return '/';}});
  if(!paths.length)paths.push('/');
  const access={};
  for(const [code,agent,informational] of [['robots_search','OAI-SearchBot',false],['robots_perplexity','PerplexityBot',false],['robots_user','ChatGPT-User',true],['robots_google_extended','Google-Extended',true]]){
    access[agent]=robotsKnown?paths.map(p=>({path:p,allowed:robotsAllows(robots?.text||'',agent,p)})):[];
    put(code,paths,p=>robotsAllows(robots?.text||'',agent,p),{unavailable:!robotsKnown,info:informational});
    if(informational&&robotsKnown)results.get(code).status='info';
  }
  const llms=evidence.llms;
  put('llms',llms?[llms]:[],r=>goodResource(r)&&/^#\s+\S/m.test(r.text),{unavailable:llms&&![200,404,410].includes(llms.status),info:true});
  if(results.get('llms').status==='fail')results.get('llms').status='info';
  const rules=RULES.map(r=>({...r,...results.get(r.code)}));
  const total=rules.reduce((n,r)=>n+r.weight,0), checked=rules.filter(r=>r.status==='pass'||r.status==='fail');
  const pageCoverage=pageResources.length?pages.length/pageResources.length:0;
  const effectiveWeight=r=>r.weight*(r.code.startsWith('jsonld_')?pageCoverage:1);
  const covered=checked.reduce((n,r)=>n+effectiveWeight(r),0), passed=checked.filter(r=>r.status==='pass').reduce((n,r)=>n+effectiveWeight(r),0);
  // Shopify signals, only from evidence already read (18. 10. 2026): a Shopify-shaped public export,
  // Shopify's default robots.txt line, or one store page carrying both Shopify CDN files and the
  // store's myshopify.com name. A text mention alone is not a signal. Plain includes(): linear.
  const shopify=[];
  if(products.some(p=>typeof p.handle==='string'&&Array.isArray(p.variants)&&['body_html','product_type','vendor','published_at'].some(k=>Object.hasOwn(p,k))))shopify.push('export');
  if(goodResource(robots)&&/^#\s*we use shopify as our ecommerce platform/im.test(robots.text))shopify.push('robots');
  if([evidence.home,evidence.returns,evidence.shipping,evidence.contact,...pageResources].some(r=>goodResource(r)&&r.text.includes('cdn.shopify.com')&&r.text.includes('.myshopify.com')))shopify.push('assets');
  return {version:VERSION,at:snapshot.at,storeUrl:snapshot.storeUrl,platform:products.length?'shopify-public-feed':'html-only',
    shopify:{detected:shopify.length>0,signals:shopify},
    score:covered&&(products.length||pages.length)?Math.round(100*passed/covered):null,coverage:Math.round(100*covered/total),
    sample:{products:products.length,pages:pages.length,attemptedPages:pageResources.length,limit:20,pageLimit:3},
    rules,access,noindexPages:pages.filter(p=>p.noindex).map(p=>p.url),
    evidence:Object.entries(evidence).map(([kind,r])=>({kind,url:r?.url,status:r?.status??0,error:r?.error||null})).concat(pageResources.map(r=>({kind:'product',url:r.url,status:r.status,error:r.error||null}))),
  };
}
