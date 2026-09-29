// Mení iba lokálny výber. Prekryv nálezov sa vyhodnocuje podľa všetkých typov.
export function oznacTyp(koren,area,typ) {
  const cipy=[...koren.querySelectorAll('[data-filter]')];
  const platny=cipy.some(b=>b.dataset.filter===typ)?typ:null;
  for(const b of cipy) b.setAttribute('aria-pressed',String(b.dataset.filter===platny));
  let prvy=null;
  for(const b of area.querySelectorAll('.rk-nalez')) {
    const vybrany=!!platny && b.dataset.typy.split(' ').includes(platny);
    b.classList.toggle('rk-vybrany',vybrany);
    if(vybrany) { b.style.setProperty('--rk-ton','var(--rk-'+platny+')'); prvy??=b; }
    else b.style.removeProperty('--rk-ton');
  }
  if(platny) area.dataset.filter=platny; else delete area.dataset.filter;
  return prvy;
}
export function zapojRytmus(koren,navod) {
  let zobrazena=null;
  const ukaz=b=>{
    if(b && b===zobrazena) return;
    zobrazena=b;
    const detail=koren.querySelector('#rytmus-detail');
    if(!detail) return;
    for(const x of koren.querySelectorAll('[data-veta],[data-kos]')) x.setAttribute('aria-pressed',String(x===b));
    if(b) detail.replaceChildren(...b.querySelector('.rk-sr').cloneNode(true).childNodes);
    else detail.textContent=detail.dataset?.navod ?? navod;
  };
  for(const event of ['focusin','click','pointerover']) koren.addEventListener(event,e=>{
    if(event==='pointerover' && e.pointerType==='touch') return;
    const b=e.target.closest('[data-veta],[data-kos]');
    if(b && koren.contains(b)) ukaz(b);
  });
  koren.addEventListener('keydown',e=>{if(e.key==='Escape')ukaz(null);});
}
