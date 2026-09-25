/* Snimky na poziadanie. Ziadna vecna slucka: vyziadaj() naplanuje jednu snimku,
   a slucka bezi, kym snimka vrati true (nieco sa hybe). Okolite pohyby (dych postav)
   bezia 10 snimok za sekundu cez casovac, 20 s po poslednom vstupe scena zaspi.
   Pri document.hidden sa vsetko zastavi. window.__m0 je meranie pre testy. */
export function vytvorSlucku(snimka, o = {}) {
  const m = (window.__m0 = { snimky: 0, msSnimka: 0, msPriemer: 0, aktivne: false, spi: false });
  let raf = 0, posledny = 0, okolie = 0, vstupCas = performance.now(), okolieZap = !!o.okolie;
  function beh(t) {
    raf = 0;
    const t0 = performance.now();
    const dt = posledny ? Math.min(0.1, (t - posledny) / 1000) : 1 / 60;
    posledny = t;
    const dalej = snimka(dt, t / 1000);
    const ms = performance.now() - t0;
    m.snimky++; m.msSnimka = ms; m.msPriemer = m.msPriemer ? m.msPriemer * 0.95 + ms * 0.05 : ms;
    m.aktivne = !!dalej;
    if (dalej) vyziadaj(); else posledny = 0;
  }
  function vyziadaj() { if (!raf && !document.hidden) raf = requestAnimationFrame(beh); }
  function planujOkolie() {
    clearInterval(okolie); okolie = 0;
    if (!okolieZap || document.hidden) return;
    m.spi = false;
    okolie = setInterval(() => {
      if (performance.now() - vstupCas > 20000) { clearInterval(okolie); okolie = 0; m.spi = true; return; }
      if (!raf) { posledny = 0; vyziadaj(); }
    }, 100);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = 0; clearInterval(okolie); okolie = 0; posledny = 0; }
    else { vyziadaj(); planujOkolie(); }
  });
  return {
    vyziadaj,
    zobud() { vstupCas = performance.now(); if (!okolie) planujOkolie(); vyziadaj(); },
    okolie(zap) { okolieZap = zap; planujOkolie(); },
    spi: () => m.spi,
  };
}
