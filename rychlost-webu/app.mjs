export const pasmo = skore => skore < 50 ? 'pomaly' : skore < 90 ? 'zlepsit' : 'rychly';
const popisy = {pomaly:'Pomalý web',zlepsit:'Treba zlepšiť',rychly:'Web je rýchly'};
const API = 'https://arling-rychlost.arling.workers.dev';
export function overVysledok(r) {
  if (!r || !/^[a-f0-9]{32}$/.test(r.id) || !Number.isInteger(r.skore) || r.skore < 0 || r.skore > 100 ||
    ![r.lcpMs,r.vahaBajty].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0) ||
    typeof r.https !== 'boolean' || !Number.isFinite(Date.parse(r.meranie)) || typeof r.lighthouse !== 'string' ||
    !Array.isArray(r.nalezy) || r.nalezy.length > 3 || !r.nalezy.every(n => n && typeof n.nazov === 'string' && typeof n.vysvetlenie === 'string' && ['rychla oprava','vacsia prerabka'].includes(n.narocnost))) throw new Error('Výsledok sa nedá prečítať. Skúste meranie znova.');
  for (const url of [r.url,r.konecnaUrl]) {
    const u = new URL(url);
    if (!['http:','https:'].includes(u.protocol) || u.username || u.password) throw new Error('Výsledok obsahuje neplatnú adresu. Zmerajte web znova.');
  }
  return r;
}
export function zobrazNalezy(document, ciel, nalezy) {
  ciel.replaceChildren();
  for (const n of nalezy) {
    const li = document.createElement('li'), h = document.createElement('h4'), p = document.createElement('p'), narocnost = document.createElement('p');
    h.textContent = n.nazov; p.textContent = n.vysvetlenie;
    narocnost.className = 'rw-narocnost'; narocnost.textContent = n.narocnost === 'rychla oprava' ? 'Orientačne: rýchla oprava' : 'Orientačne: väčšia prerábka';
    li.append(h,p,narocnost); ciel.append(li);
  }
}
export function spusti(document, window, fetchFn = (...args) => fetch(...args)) {
  const $ = id => document.getElementById(id);
  // Lokálne API iba na explicitnom loopback hostiteľovi. Produkcia nemá demo režim.
  const local = window.location.hostname === '127.0.0.1' && window.location.port === '8891';
  const api = local ? '/__api' : API;
  let verzia = 0, aktualny = null, meranieController, timer, ziadostVerzia = 0, ziadostController, posiela = false;
  const track = (name, data = {}) => {
    if (local) return;
    try { window.umami?.track(name, data); } catch {}
  };
  const text = (id, value) => { $(id).textContent = value; };
  const chyba = (id, message) => { text(id,message); $(id).hidden = false; };
  async function poziadavka(path, options = {}) {
    let res;
    try { res = await fetchFn(api + path, options); }
    catch (e) {
      if (e?.name === 'AbortError') throw e;
      throw new Error('Spojenie so službou sa prerušilo. Skontrolujte pripojenie a skúste to znova.');
    }
    let data; try { data = await res.json(); } catch { throw new Error('Služba neposlala čitateľnú odpoveď. Skúste to neskôr.'); }
    if (!res.ok) throw new Error(typeof data.sprava === 'string' ? data.sprava : 'Požiadavka sa nepodarila. Skúste to znova.');
    return data;
  }
  function zastavCas() { window.clearInterval(timer); timer = null; }
  function resetZiadost() {
    ziadostVerzia++; ziadostController?.abort(); posiela = false;
    $('ziadost-polia').disabled = false; $('ziadost-stav').hidden = true; $('ziadost-chyba').hidden = true;
    text('odoslat','Vyžiadať odpoveď');
  }
  function zacni(zdielane = false) {
    verzia++; meranieController?.abort(); meranieController = new AbortController(); zastavCas(); resetZiadost();
    aktualny = null; $('vysledok').hidden = true; $('meranie-chyba').hidden = true;
    $('meranie-stav').hidden = false; $('meraj').disabled = true; $('meranie-form').setAttribute('aria-busy','true');
    text('meranie-sprava',zdielane ? 'Načítavame uložený výsledok.' : 'Google meria váš web.');
    text('meraj-text',zdielane ? 'Načítavame…' : 'Meriame…');
    $('adresa').blur(); $('meranie-stav').scrollIntoView({block:'nearest'});
    text('sekundy','0'); const start = Date.now();
    timer = window.setInterval(() => text('sekundy',String(Math.floor((Date.now()-start)/1000))),1000);
    return verzia;
  }
  function ukonci() {
    zastavCas(); $('meranie-stav').hidden = true; $('meraj').disabled = false; $('meranie-form').removeAttribute('aria-busy');
    text('meraj-text','Zmerať zadarmo');
  }
  function zobraz(r, zdielane = false) {
    aktualny = overVysledok(r);
    const band = pasmo(r.skore), dom = new URL(r.konecnaUrl).hostname;
    text('vysledok-nadpis',dom); text('vysledok-url',r.konecnaUrl); text('skore',String(r.skore));
    $('skore-kruh').dataset.pasmo = band; text('pasmo',popisy[band]);
    text('lcp',new Intl.NumberFormat('sk-SK',{maximumFractionDigits:1}).format(r.lcpMs/1000)+' s');
    text('vaha',new Intl.NumberFormat('sk-SK',{maximumFractionDigits:2}).format(r.vahaBajty/1000000)+' MB');
    text('vaha-kib','('+new Intl.NumberFormat('sk-SK',{maximumFractionDigits:0}).format(r.vahaBajty/1024)+' KiB)');
    text('https',r.https ? 'Áno' : 'Nie');
    text('merane',`${r.ulozene ? 'Uložený výsledok' : 'Zmerané'}: ${new Intl.DateTimeFormat('sk-SK',{dateStyle:'medium',timeStyle:'short'}).format(new Date(r.meranie))} · Lighthouse ${r.lighthouse}`);
    text('nalezy-nadpis','Čo na webe riešiť najskôr');
    $('nalezy-kontext').hidden = !r.nalezy.length; $('bez-nalezov').hidden = Boolean(r.nalezy.length);
    zobrazNalezy(document,$('nalezy'),r.nalezy);
    // Pri 90+ s nálezmi je pomoc voliteľná, až po vedomom otvorení.
    $('ponuka').hidden = r.skore >= 90; $('rychly-text').hidden = r.skore < 90;
    $('ukazat-pomoc').hidden = r.skore < 90 || !r.nalezy.length;
    $('ukazat-pomoc').setAttribute('aria-expanded','false');
    text('kopirovanie-stav',''); $('odkaz-rucne').hidden = true;
    $('vysledok').hidden = false; $('adresa').value = r.url;
    const url = new URL(window.location.href); url.searchParams.set('r',r.id); window.history.replaceState(null,'',url);
    $('vysledok-nadpis').focus({preventScroll:true}); $('vysledok').scrollIntoView({behavior:'instant',block:'start'});
    track('rychlost-vysledok',{pasmo:band,zdroj:zdielane?'odkaz':r.ulozene?'cache':'nove'});
  }
  $('meranie-form').addEventListener('submit',async e => {
    e.preventDefault(); const url = $('adresa').value.trim(); if (!url) return;
    const poradie = zacni(), controller = meranieController; track('rychlost-meraj');
    const timeout = window.setTimeout(() => controller.abort(),70000);
    try {
      const r = await poziadavka('/meraj',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url}),signal:controller.signal});
      if (poradie === verzia) zobraz(r);
    } catch(e) {
      if (poradie === verzia) chyba('meranie-chyba',e.name === 'AbortError' ? 'Čakanie trvalo príliš dlho. Adresa zostala vyplnená, skúste to znova.' : e.message || 'Spojenie sa prerušilo. Skúste to znova.');
    } finally { window.clearTimeout(timeout); if (poradie === verzia) ukonci(); }
  });
  $('zrusit').addEventListener('click',() => {verzia++;meranieController?.abort();ukonci();text('meranie-chyba','Čakanie je zrušené. Môžete zadať inú adresu. Už spustené meranie u Googlu sa môže dokončiť.');$('meranie-chyba').hidden=false;$('adresa').focus();});
  $('ziadost-form').addEventListener('focusin',() => track('rychlost-odpoved-formular'),{once:true});
  $('ziadost-form').addEventListener('submit',async e => {
    e.preventDefault(); if (!aktualny || posiela) return;
    const id = aktualny.id, poradie = ++ziadostVerzia;
    const data = {id,email:$('email').value,poznamka:$('poznamka').value,suhlas:$('suhlas').checked};
    posiela = true; ziadostController = new AbortController();
    const controller = ziadostController, timeout = window.setTimeout(() => controller.abort(),20000);
    $('ziadost-polia').disabled = true; $('ziadost-chyba').hidden = true; text('odoslat','Ukladáme žiadosť…');
    try {
      const r = await poziadavka('/ziadost',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data),signal:controller.signal});
      if (poradie !== ziadostVerzia || aktualny?.id !== id) return;
      if (r.ulozene !== true) throw new Error('Uloženie žiadosti nebolo potvrdené. Skúste to znova.');
      text('ziadost-stav','Žiadosť je uložená. Odpovieme do jedného pracovného dňa na váš e-mail. Nič ste si neobjednali.');
      $('ziadost-stav').hidden = false; $('ziadost-stav').focus(); text('odoslat','Žiadosť uložená'); track('rychlost-ziadost-odoslana');
    } catch(e) {
      if (poradie !== ziadostVerzia || aktualny?.id !== id) return;
      chyba('ziadost-chyba',e.name === 'AbortError' ? 'Potvrdenie nedorazilo. Skúste odoslať rovnakú žiadosť znova, nevytvorí sa druhá.' : e.message || 'Žiadosť sa nepodarila. Vaše údaje zostali vyplnené.');
      $('ziadost-polia').disabled = false; text('odoslat','Vyžiadať odpoveď');
    } finally {window.clearTimeout(timeout);if(poradie===ziadostVerzia)posiela=false;}
  });
  $('web290').addEventListener('click',() => track('rychlost-web290'));
  $('ukazat-pomoc').addEventListener('click',() => {$('ponuka').hidden=!$('ponuka').hidden;$('ukazat-pomoc').setAttribute('aria-expanded',String(!$('ponuka').hidden));});
  $('kopirovat').addEventListener('click',async () => {
    if (!aktualny) return;
    const id=aktualny.id, poradie=verzia, url=`https://arling.sk/rychlost-webu/?r=${id}`;
    try {
      await window.navigator.clipboard.writeText(url);
      if(poradie!==verzia||aktualny?.id!==id)return;
      text('kopirovanie-stav','Odkaz je skopírovaný. Môžete ho poslať správcovi webu.');track('rychlost-kopiruj-odkaz');
    } catch {
      if(poradie!==verzia||aktualny?.id!==id)return;
      $('odkaz-rucne').hidden=false;$('odkaz').value=url;$('odkaz').focus();$('odkaz').select();text('kopirovanie-stav','Prehliadač nepovolil kopírovanie. Skopírujte označený odkaz.');
    }
  });
  const shared = new URL(window.location.href).searchParams.get('r');
  if (shared) {
    if (!/^[a-f0-9]{32}$/.test(shared)) chyba('meranie-chyba','Odkaz na výsledok nie je platný. Zadajte adresu a zmerajte web znova.');
    else {
      const poradie = zacni(true), controller=meranieController;
      const timeout=window.setTimeout(()=>controller.abort(),15000);
      poziadavka('/vysledok/'+shared,{signal:controller.signal}).then(r=>{if(poradie===verzia)zobraz(r,true);}).catch(e=>{if(poradie===verzia)chyba('meranie-chyba',e.name==='AbortError'?'Výsledok sa nepodarilo načítať včas. Skúste to znova.':e.message);}).finally(()=>{window.clearTimeout(timeout);if(poradie===verzia)ukonci();});
    }
  }
  return {get aktualny(){return aktualny;}};
}
if (typeof document !== 'undefined' && document.getElementById('meranie-form')) spusti(document,window);
