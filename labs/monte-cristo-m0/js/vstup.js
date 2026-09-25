/* Akcna vrstva: preklada mys, klavesnicu, dotyk a gamepad na akcie hry.
 * Jednorazove akcie: interakcia, volba (1 az 4), dennik, pauza, mapa, spat, hore, dole,
 * vlavo, vpravo, klik (s poziciou v platne). Drzane akcie: pozornost, pocuvanie, ruky;
 * s nastavenim "Hold to toggle" ich prve stlacenie zapne a druhe vypne.
 * os = chodza (-1 az 1) z klaves, packy alebo z ciela kliknutia (to riesi hra). */
export function vytvorVstup(koren, platno, nastavenia, na) {
  const drzi = { pozornost: false, pocuvanie: false, ruky: false };
  const zdroje = { pozornost: new Set(), pocuvanie: new Set(), ruky: new Set() };
  const klavOs = { l: false, p: false };
  let padOs = 0, padTlacidla = [], padInterval = 0, padAktivny = false;

  function nastavDrzanie(akcia, zdroj, zap) {
    const z = zdroje[akcia];
    if (nastavenia.prepinac && zdroj !== 'mys-ruky' && zdroj !== 'dotyk-ruky') {
      if (!zap) return;
      if (z.size) z.clear(); else z.add(zdroj);
    } else if (zap) z.add(zdroj); else z.delete(zdroj);
    const nove = z.size > 0;
    if (nove !== drzi[akcia]) { drzi[akcia] = nove; na(nove ? akcia + ':start' : akcia + ':stop'); }
  }
  const vPolicku = (e) => { const t = e.target; return t && t.closest && t.closest('input, textarea, select'); };
  const naTlacidle = (e) => { const t = e.target; return t && t.closest && t.closest('button, a, summary, [role="button"]'); };

  const klavesy = (e, dole) => {
    if (vPolicku(e)) { if (dole && e.key === 'Escape') { e.target.blur(); na('pauza'); } return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    const kl = k.length === 1 ? k.toLowerCase() : k;
    const zdroj = 'klav-' + kl;
    if (kl === 'a' || k === 'ArrowLeft') { klavOs.l = dole; if (dole && !e.repeat) na('vlavo'); if (k === 'ArrowLeft') e.preventDefault(); return; }
    if (kl === 'd' || k === 'ArrowRight') { klavOs.p = dole; if (dole && !e.repeat) na('vpravo'); if (k === 'ArrowRight') e.preventDefault(); return; }
    if (k === 'ArrowUp' || kl === 'w') { if (dole) { na('hore'); e.preventDefault(); } return; }
    if (k === 'ArrowDown') { if (dole) { na('dole'); e.preventDefault(); } return; }
    if (kl === 'f') { if (!e.repeat) nastavDrzanie('pozornost', zdroj, dole); return; }
    if (kl === 's') { if (!e.repeat) nastavDrzanie('pocuvanie', zdroj, dole); return; }
    if (kl === 'e' || k === ' ' || k === 'Enter') {
      /* tlacidlo v DOM si medzernik a Enter vybavi samo; E ho stlaci tiez */
      if (naTlacidle(e)) { if (kl === 'e' && dole && !e.repeat) { const b = e.target.closest('button'); if (b && !b.closest('.mc-drz')) { e.preventDefault(); b.click(); } } return; }
      e.preventDefault();
      if (dole && !e.repeat) na('interakcia');
      if (!e.repeat) nastavDrzanie('ruky', zdroj, dole);
      return;
    }
    if (!dole) return;
    if (/^[1-9]$/.test(k)) { na('volba', Number(k)); return; }
    if (k === 'Tab') {
      const t = e.target;
      const naScene = t === window || t === document.body || t === koren || (t && t.classList && t.classList.contains('mc-plocha'));
      if (naScene) { e.preventDefault(); na('dennik'); }
      return;
    }
    if (kl === 'j') { na('dennik'); return; }
    if (kl === 'm') { na('mapa'); return; }
    if (k === 'Escape') { na('pauza'); return; }
    if (k === 'Backspace') { e.preventDefault(); na('spat'); return; }
  };
  window.addEventListener('keydown', (e) => klavesy(e, true));
  window.addEventListener('keyup', (e) => klavesy(e, false));
  window.addEventListener('blur', () => { for (const a of Object.keys(zdroje)) { zdroje[a].clear(); if (drzi[a]) { drzi[a] = false; na(a + ':stop'); } } klavOs.l = klavOs.p = false; });

  /* mys a dotyk na platne */
  const dotyky = new Map();
  let dlhyCas = 0, dlhyZdroj = null;
  const poz = (e) => { const r = platno.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }; };
  platno.addEventListener('contextmenu', (e) => e.preventDefault());
  platno.addEventListener('pointerdown', (e) => {
    try { platno.setPointerCapture(e.pointerId); } catch {}
    if (e.pointerType === 'mouse') {
      if (e.button === 2) { nastavDrzanie('pozornost', 'mys-p', true); return; }
      if (e.button !== 0) return;
      na('klik', poz(e));
      nastavDrzanie('ruky', 'mys-ruky', true);
      return;
    }
    dotyky.set(e.pointerId, { ...poz(e), t: performance.now(), pohyb: false });
    if (dotyky.size === 2) { clearTimeout(dlhyCas); nastavDrzanie('pozornost', 'dotyk-2', true); return; }
    na('klik', poz(e));
    nastavDrzanie('ruky', 'dotyk-ruky', true);
    clearTimeout(dlhyCas);
    dlhyCas = setTimeout(() => { const d = dotyky.get(e.pointerId); if (d && !d.pohyb && dotyky.size === 1) { dlhyZdroj = 'dotyk-dlhy'; na('dlhy-dotyk'); } }, 500);
  });
  platno.addEventListener('pointermove', (e) => {
    const d = dotyky.get(e.pointerId);
    if (d) { const p = poz(e); if (Math.hypot(p.x - d.x, p.y - d.y) > 0.03) d.pohyb = true; }
    if (e.buttons & 1 || d) na('tah', poz(e));
  });
  const koniec = (e) => {
    if (e.pointerType === 'mouse') {
      if (e.button === 2) nastavDrzanie('pozornost', 'mys-p', false);
      else nastavDrzanie('ruky', 'mys-ruky', false);
      return;
    }
    dotyky.delete(e.pointerId);
    clearTimeout(dlhyCas);
    if (dotyky.size < 2) nastavDrzanie('pozornost', 'dotyk-2', false);
    if (!dotyky.size) { nastavDrzanie('ruky', 'dotyk-ruky', false); if (dlhyZdroj) { dlhyZdroj = null; na('dlhy-dotyk:stop'); } }
  };
  platno.addEventListener('pointerup', koniec);
  platno.addEventListener('pointercancel', koniec);
  platno.addEventListener('wheel', (e) => { if (e.deltaY < -20) na('spat'); }, { passive: true });

  /* tlacidla v pase (oko, ucho, ruka) funguju ako drzanie mysou aj dotykom */
  function drzaneTlacidlo(el, akcia) {
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch {} nastavDrzanie(akcia, 'tl-' + akcia, true); });
    const stop = () => nastavDrzanie(akcia, 'tl-' + akcia, false);
    el.addEventListener('pointerup', stop);
    el.addEventListener('pointercancel', stop);
    el.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); e.stopPropagation(); nastavDrzanie(akcia, 'tlk-' + akcia, true); } });
    el.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); nastavDrzanie(akcia, 'tlk-' + akcia, false); } });
  }

  /* gamepad: citanie len ked je pripojeny; v slucke kazdu snimku, v pokoji 8-krat za sekundu */
  const MAPA = { 0: 'interakcia', 3: 'dennik', 9: 'pauza', 8: 'mapa', 4: 'vlavo', 5: 'vpravo', 12: 'hore', 13: 'dole', 14: 'vlavo', 15: 'vpravo' };
  function citajPad() {
    const pady = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
    const p = pady[0];
    if (!p) return;
    const t = p.buttons.map((b) => b.pressed || b.value > 0.5);
    t.forEach((dole, i) => {
      if (dole === !!padTlacidla[i]) return;
      if (dole && MAPA[i]) na(MAPA[i], i);
      if (i === 0) nastavDrzanie('ruky', 'pad-a', dole);
      if (i === 7) nastavDrzanie('ruky', 'pad-rt', dole);
      if (i === 6) nastavDrzanie('pozornost', 'pad-lt', dole);
      if (i === 1) nastavDrzanie('pocuvanie', 'pad-b', dole);
      if (dole) na('zobud');
    });
    padTlacidla = t;
    const x = p.axes[0] || 0;
    const nove = Math.abs(x) > 0.25 ? x : 0;
    if (nove !== padOs) { padOs = nove; na('zobud'); }
    const y = p.axes[1] || 0;
    if (y < -0.6 && !padAktivny) { padAktivny = true; na('hore'); } else if (y > 0.6 && !padAktivny) { padAktivny = true; na('dole'); } else if (Math.abs(y) < 0.3) padAktivny = false;
  }
  window.addEventListener('gamepadconnected', () => { clearInterval(padInterval); padInterval = setInterval(citajPad, 125); na('gamepad', true); });
  window.addEventListener('gamepaddisconnected', () => { if (!(navigator.getGamepads && [...navigator.getGamepads()].some(Boolean))) { clearInterval(padInterval); padInterval = 0; padOs = 0; na('gamepad', false); } });
  if (navigator.getGamepads && [...navigator.getGamepads()].some(Boolean)) padInterval = setInterval(citajPad, 125);

  return {
    drzi,
    os: () => (klavOs.p ? 1 : 0) - (klavOs.l ? 1 : 0) || padOs,
    citajPad: () => { if (padInterval) citajPad(); },
    drzaneTlacidlo,
    uvolni(akcia) { zdroje[akcia].clear(); if (drzi[akcia]) { drzi[akcia] = false; na(akcia + ':stop'); } },
  };
}
