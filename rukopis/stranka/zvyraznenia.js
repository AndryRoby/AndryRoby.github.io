// Prekryvy rozdelíme na disjunktné kúsky bez straty jediného znaku.
export function kusky(text, hits) {
  const udalosti = new Map([[0,[]],[text.length,[]]]);
  const pridaj = (i,typ,zmena) => {
    if (!udalosti.has(i)) udalosti.set(i,[]);
    udalosti.get(i).push([typ,zmena]);
  };
  for (const h of hits) {
    if (!Number.isInteger(h.od) || !Number.isInteger(h.do) || h.od < 0 || h.do > text.length || h.od >= h.do) continue;
    pridaj(h.od,h.typ,1); pridaj(h.do,h.typ,-1);
  }
  const body = [...udalosti.keys()].sort((a,b)=>a-b), aktivne = new Map(), out = [];
  const poradie = ['pointa','trojica','fraza','nominalizacia','pomlcka','konkretnost','otvorenost','mimo'];
  for(let i=0;i<body.length-1;i++) {
    const od=body[i], koniec=body[i+1];
    for(const [typ,n] of udalosti.get(od)) aktivne.set(typ,(aktivne.get(typ)||0)+n);
    out.push({ text:text.slice(od,koniec), typy:poradie.filter(t=>aktivne.get(t)>0) });
  }
  return out;
}
