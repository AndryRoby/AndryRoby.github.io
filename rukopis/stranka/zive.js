// Dva časy: rýchla vizuálna odozva, hlásenie až po prestávke v písaní.
export function ziveMeranie(zmeraj, oznam, hodiny = globalThis) {
  let meranie, hlasenie, sklada = false;
  const zrus = () => { hodiny.clearTimeout(meranie); hodiny.clearTimeout(hlasenie); };
  const vstup = () => {
    zrus();
    if(sklada) return;
    meranie=hodiny.setTimeout(()=>zmeraj(false),350);
    hlasenie=hodiny.setTimeout(oznam,1500);
  };
  return { vstup, zacni:()=>{sklada=true;zrus();}, dokonci:()=>{sklada=false;vstup();},
    teraz:()=>{zrus();zmeraj(true);oznam();}, zrus };
}
export async function kopiruj(sprava, clipboard, nahrada) {
  try { if(!clipboard?.writeText) throw Error('clipboard'); await clipboard.writeText(sprava); return true; }
  catch { nahrada(sprava); return false; }
}
