// Reality Hradba (ukážka webu od ARLing, vymyslená realitná kancelária v Nitre): detail ponuky v dialógu.
// Galéria (šípky, klávesnica, potiahnutie prstom, náhľady), schematický pôdorys v SVG, parametre, ilustračná splátka
// a kontakt na makléra. Načíta ho app.js až pri prvom otvorení detailu alebo keď prehliadač nemá čo robiť.
// Po kritike 19. 11. 2026: fotky galérie 800 a 1 600 px (úvodná aj 2 400) so `sizes` podľa skutočnej šírky galérie,
// náhľady 240 px; pôdorys, ktorého popisy by mali menej ako 10 px (názov) alebo 9 px (plocha), dostane v izbách čísla
// a pod galériou zoznam miestností s plochami v bežnom texte.
(function () {
  'use strict';
  var H = window.Hradba;
  if (!H || window.HradbaDetail) return;
  var NB = H.NB, nb = H.nb, cislo = H.cislo, euro = H.euro, plocha = H.plocha, el = H.el, $ = H.$, $$ = H.$$;
  var pokoj = H.pokoj, udaje = H.udaje, karty = H.karty, MAKLERI = H.MAKLERI, KALK = H.KALK, splatka = H.splatka;

  // Pôdorysy v decimetroch: w, h obrys; steny [x1,y1,x2,y2]; dvere [x,y,šírka,os,smer,strana otvárania];
  // okna [x1,y1,x2,y2] na obvodovej stene; izby [stred x, stred y, názov, plocha, šírka miestnosti]; vonku [x,y,w,h,názov,plocha].
  var PODORYSY = {
    1: { w: 125, h: 66,
      steny: [[50, 0, 50, 66], [50, 40, 125, 40], [88, 0, 88, 40], [96, 40, 96, 66], [96, 56, 125, 56]],
      dvere: [[64, 66, 9, 'x', 1, -1], [50, 46, 8, 'y', 1, -1], [56, 40, 8, 'x', 1, -1], [88, 40, 8, 'x', 1, -1], [96, 43, 7, 'y', 1, 1], [96, 58, 7, 'y', 1, 1]],
      okna: [[6, 0, 22, 0], [28, 0, 44, 0], [58, 0, 80, 0], [96, 0, 118, 0]],
      vonku: [[60, -9, 50, 8, 'Balkón', '4,0']],
      izby: [[25, 30, 'Obývačka s kuchyňou', '33,0', 50], [69, 20, 'Spálňa', '15,2', 38], [106.5, 20, 'Detská izba', '14,8', 37], [79, 50, 'Predsieň', '12,0', 30], [112, 49, 'Kúpeľňa', '4,6', 26], [110.5, 61.5, 'WC', '2,9', 29, 1]],
      vypln: [[0, 0, 50, 66], [50, 0, 38, 40], [88, 0, 37, 40]],
      nabytok: [[0, 46, 6, 20, 'linka'], [6, 60, 16, 6]] },
    2: { w: 135, h: 80,
      steny: [[55, 0, 55, 80], [55, 42, 135, 42], [95, 0, 95, 42], [55, 54, 95, 54], [75, 54, 75, 80], [95, 54, 95, 80], [107, 42, 107, 80]],
      dvere: [[97, 80, 9, 'x', 1, -1], [55, 44, 8, 'y', 1, -1], [70, 42, 8, 'x', 1, -1], [98, 42, 8, 'x', 1, -1], [107, 44, 8, 'y', 1, 1], [58, 54, 7, 'x', 1, 1], [80, 54, 7, 'x', 1, 1]],
      okna: [[6, 0, 48, 0], [62, 0, 88, 0], [102, 0, 128, 0], [135, 50, 135, 72], [0, 10, 0, 50]],
      vonku: [[-31, 0, 30, 80, 'Terasa', '24,0']],
      izby: [[27, 30, 'Obývačka s kuchyňou', '44,0', 55], [75, 21, 'Spálňa', '16,8', 40], [115, 21, 'Izba', '16,8', 40], [121, 62, 'Izba', '10,6', 28], [81, 48, 'Predsieň', '9,4', 52], [65, 67, 'Kúpeľňa', '5,2', 20], [85, 67, 'Kúpeľňa', '5,2', 20]],
      vypln: [[0, 0, 55, 80], [55, 0, 40, 42], [95, 0, 40, 42], [107, 42, 28, 38]],
      nabytok: [[0, 56, 6, 24, 'linka'], [6, 74, 22, 6], [16, 58, 20, 7, 'ostrov']] },
    3: { w: 120, h: 60,
      steny: [[54, 0, 54, 60], [54, 34, 120, 34], [88, 0, 88, 34], [96, 34, 96, 60]],
      dvere: [[66, 60, 9, 'x', 1, -1], [54, 40, 8, 'y', 1, -1], [60, 34, 8, 'x', 1, -1], [88, 34, 8, 'x', 1, -1], [96, 50, 7, 'y', 1, 1]],
      okna: [[8, 0, 46, 0], [60, 0, 82, 0], [94, 0, 114, 0]],
      vonku: [[8, -15, 36, 14, 'Loggia', '5,0']],
      izby: [[27, 26, 'Obývačka s kuchyňou', '32,4', 54], [71, 17, 'Spálňa', '11,6', 34], [104, 17, 'Izba', '10,9', 32], [80, 46, 'Predsieň', '10,9', 30], [109, 44, 'Kúpeľňa', '6,2', 22]],
      vypln: [[0, 0, 54, 60], [54, 0, 34, 34], [88, 0, 32, 34]],
      nabytok: [[0, 40, 6, 20, 'linka'], [6, 54, 16, 6]] },
    4: { w: 110, h: 80, titul: 'Pôdorys prízemia, v podkroví sú ďalšie 3 izby a kúpeľňa (68 m²)',
      steny: [[0, 42, 110, 42], [62, 0, 62, 42], [40, 42, 40, 80], [72, 42, 72, 80], [92, 42, 92, 80]],
      dvere: [[58, 80, 10, 'x', 1, -1], [44, 42, 9, 'x', 1, -1], [63, 42, 8, 'x', 1, -1], [40, 46, 8, 'y', 1, -1], [72, 46, 7, 'y', 1, 1], [110, 70, 8, 'y', 1, -1]],
      okna: [[8, 0, 28, 0], [34, 0, 54, 0], [72, 0, 100, 0], [0, 50, 0, 72], [10, 80, 30, 80], [110, 10, 110, 32]],
      schody: [[44, 56, 10, 22]],
      izby: [[31, 21, 'Obývačka', '26,0', 62], [86, 21, 'Izba', '20,2', 48], [20, 61, 'Kuchyňa s jedálňou', '15,2', 40], [63, 51, 'Hala', '12,2', 18], [82, 61, 'Kúpeľňa', '7,6', 20], [101, 56, 'Technika', '6,8', 18]],
      vypln: [[0, 0, 62, 42], [62, 0, 48, 42], [0, 42, 40, 38]],
      nabytok: [[0, 74, 24, 6, 'linka']] },
    5: { w: 100, h: 58,
      steny: [[0, 36, 100, 36], [54, 0, 54, 36], [36, 36, 36, 58], [72, 36, 72, 58]],
      dvere: [[50, 58, 9, 'x', 1, -1], [40, 36, 8, 'x', 1, -1], [68, 36, 8, 'x', -1, -1], [36, 41, 8, 'y', 1, -1], [72, 41, 7, 'y', 1, 1]],
      okna: [[6, 0, 48, 0], [62, 0, 92, 0], [0, 40, 0, 54]],
      vonku: [[14, -12, 28, 11, 'Balkón', '3,1']],
      izby: [[27, 19, 'Obývacia izba', '19,4', 54], [77, 19, 'Spálňa', '16,6', 46], [18, 46, 'Kuchyňa', '7,9', 36], [62, 45, 'Predsieň', '7,9', 18], [88, 50, 'Kúpeľňa', '6,2', 24]],
      vypln: [[0, 0, 54, 36], [54, 0, 46, 36]],
      nabytok: [[8, 52, 26, 6, 'linka']] },
    6: { w: 90, h: 40,
      steny: [[60, 0, 60, 40], [60, 23, 90, 23]],
      dvere: [[90, 5, 9, 'y', 1, -1], [60, 8, 8, 'y', 1, -1], [82, 23, 7, 'x', 1, 1]],
      okna: [[0, 4, 0, 17], [0, 21, 0, 36]],
      vonku: [[-16, 0, 15, 40, 'Balkón', '6,0']],
      izby: [[32, 22, 'Izba s kuchyňou', '24,0', 60], [71, 15, 'Predsieň', '6,9', 20], [71, 32, 'Kúpeľňa', '5,1', 20]],
      vypln: [[0, 0, 60, 40]],
      nabytok: [[34, 0, 26, 6, 'linka']] },
    7: { w: 120, h: 80, titul: 'Pôdorys prízemia, na poschodí sú 2 spálne, kúpeľňa a pracovný kút (72 m²)',
      steny: [[0, 48, 70, 48], [70, 0, 70, 36], [70, 36, 120, 36], [20, 48, 20, 80], [40, 48, 40, 80], [86, 36, 86, 80], [104, 36, 104, 80]],
      dvere: [[56, 80, 10, 'x', 1, -1], [74, 36, 8, 'x', 1, -1], [4, 48, 7, 'x', 1, 1], [40, 58, 7, 'y', 1, -1], [86, 66, 7, 'y', 1, 1], [120, 66, 8, 'y', 1, -1]],
      okna: [[6, 0, 30, 0], [36, 0, 62, 0], [78, 0, 112, 0], [0, 10, 0, 40], [120, 6, 120, 30]],
      schody: [[48, 58, 28, 10]],
      vonku: [[-25, 6, 24, 36, 'Terasa', '8,6']],
      izby: [[35, 22, 'Obývačka s kuchyňou', '33,6', 70], [95, 18, 'Izba', '18,0', 50], [76, 74, 'Hala', '16,6', 20], [10, 64, 'Špajza', '6,4', 20], [30, 64, 'Šatník', '6,4', 20], [95, 52, 'Kúpeľňa', '7,9', 18], [112, 52, 'Technika', '7,0', 16]],
      vypln: [[0, 0, 70, 48], [70, 0, 50, 36]],
      nabytok: [[0, 42, 26, 6, 'linka'], [8, 28, 18, 7, 'ostrov']] },
    8: { w: 100, h: 54,
      steny: [[0, 34, 100, 34], [52, 0, 52, 34], [32, 34, 32, 54], [72, 34, 72, 54]],
      dvere: [[46, 54, 9, 'x', 1, -1], [36, 34, 8, 'x', 1, -1], [66, 34, 8, 'x', -1, -1], [32, 38, 8, 'y', 1, -1], [72, 38, 7, 'y', 1, 1]],
      okna: [[10, 0, 42, 0], [62, 0, 90, 0], [0, 38, 0, 50]],
      izby: [[26, 18, 'Obývacia izba', '17,7', 52], [76, 18, 'Spálňa', '16,3', 48], [16, 45, 'Kuchyňa', '6,4', 32], [62, 44, 'Predsieň', '8,0', 18], [88, 47, 'Kúpeľňa', '5,6', 24]],
      vypln: [[0, 0, 52, 34], [52, 0, 48, 34]],
      nabytok: [[0, 48, 22, 6, 'linka']] }
  };

  var PONUKY = {
    1: { cislo: 'H-1041', makler: 'simona', fotky: [
        { s: 'uvod', w: [800, 1600, 2400], a: 'Obývačka s jedálňou, modrozelené steny a závesy, slnko na parketách' },
        { s: 'b1-sedacka', w: [800, 1600], a: 'Sedačka pri okne, mosadzné svietidlá a váza s vetvičkami' },
        { s: 'b1-spalna', w: [800, 1600], a: 'Spálňa s čalúneným čelom postele a sklenenou stenou' }],
      popis: 'Svetlý byt v tehlovom dome na pokojnej ulici, pár minút pešo od pešej zóny. Po rekonštrukcii v roku 2025 má nové rozvody, podlahy aj kúpeľňu a obývačka je spojená s kuchyňou. Balkón je do tichého vnútrobloku.',
      fakty: [['Poschodie', '2. z 4, bez výťahu'], ['Stav', 'po kompletnej rekonštrukcii (2025)'], ['Konštrukcia', 'tehla'], ['Balkón', '4,0 m², do vnútrobloku'], ['Parkovanie', 'rezidentské, na ulici'], ['Energetická trieda', 'B'], ['Vlastníctvo', 'osobné']] },
    2: { cislo: 'H-1042', makler: 'tomas', fotky: [
        { s: 'b5-kuchyna', w: [800, 1600], a: 'Biela kuchyňa s ostrovčekom a dubovým obkladom' },
        { s: 'b5-obyvacka', w: [800, 1600], a: 'Dlhá obývačka so sedačkou a kamenným obkladom steny' }],
      popis: 'Veľký byt na poslednom podlaží novostavby pod Zoborom. Z obývačky s kuchyňou sa vychádza na terasu s rozlohou 24 m², byt má dve kúpeľne a patria k nemu dve garážové státia.',
      fakty: [['Poschodie', '4. z 4, výťah'], ['Stav', 'novostavba (2024)'], ['Konštrukcia', 'železobetón a tehla'], ['Terasa', '24,0 m², na juhozápad'], ['Parkovanie', '2 garážové státia v cene'], ['Energetická trieda', 'A0'], ['Vlastníctvo', 'osobné']] },
    3: { cislo: 'H-1043', makler: 'simona', fotky: [
        { s: 'b3-obyvacka', w: [800, 1600], a: 'Obývačka spojená s kuchyňou, jedálenský stôl a veľké okná' },
        { s: 'b3-kuchyna', w: [800, 1600], a: 'Kuchynská linka s bielymi skrinkami a jedálenský stôl' }],
      popis: 'Prerobený byt v zateplenom paneláku s výťahom. Kuchyňa je spojená s obývačkou, z ktorej sa vychádza na loggiu. Pivnica patrí k bytu, škola aj obchody sú pár minút pešo.',
      fakty: [['Poschodie', '6. z 8, výťah'], ['Stav', 'kompletná rekonštrukcia (2024)'], ['Konštrukcia', 'panel, zateplený dom'], ['Loggia', '5,0 m²'], ['Parkovanie', 'pred domom'], ['Energetická trieda', 'B'], ['Vlastníctvo', 'osobné']] },
    4: { cislo: 'H-1044', makler: 'tomas', fotky: [
        { s: 'd6-dom', w: [800, 1600], a: 'Biely rodinný dom s hnedou strechou, dreveným štítom a vstupom pod stĺpmi' }],
      popis: 'Rodinný dom na tichej ulici v Dražovciach, zrekonštruovaný v roku 2023: nová strecha, okná aj kúrenie. Na prízemí je obývačka, kuchyňa s jedálňou a izba, v podkroví ďalšie tri izby. Garáž a záhrada so vzrastlými tujami.',
      fakty: [['Podlažia', 'prízemie a obytné podkrovie'], ['Stav', 'rekonštrukcia 2023 (strecha, okná, kúrenie)'], ['Konštrukcia', 'tehla'], ['Pozemok', '680 m²'], ['Parkovanie', 'garáž a státie na pozemku'], ['Energetická trieda', 'B'], ['Vlastníctvo', 'osobné']] },
    5: { cislo: 'H-1045', makler: 'simona', fotky: [
        { s: 'b8-balkon', w: [800, 1600], a: 'Obývačka s otvorenými dverami na balkón, rastliny a parkety' },
        { s: 'b8-kuchyna', w: [800, 1600], a: 'Biela kuchyňa s francúzskym oknom do zelene' }],
      popis: 'Útulný byt v tehlovom dome na Dieloch. Po rekonštrukcii v roku 2023 má novú kuchyňu, kúpeľňu aj podlahy, obývačka má dvere na malý balkón do zelene.',
      fakty: [['Poschodie', '3. z 4, bez výťahu'], ['Stav', 'po rekonštrukcii (2023)'], ['Konštrukcia', 'tehla'], ['Balkón', '3,1 m²'], ['Parkovanie', 'pred domom'], ['Energetická trieda', 'C'], ['Vlastníctvo', 'osobné']] },
    6: { cislo: 'H-1046', makler: 'veronika', fotky: [
        { s: 'b4-garsonka', w: [800, 1600], a: 'Biela izba s kuchynským kútom a dreveným barovým stolom' },
        { s: 'b4-kuchyna', w: [800, 1600], a: 'Kuchynský kút s bielym obkladom a dreveným stolom' }],
      popis: 'Garsónka v novostavbe z roku 2025, s balkónom a parkovacím státím v garáži v cene. Kuchynský kút so spotrebičmi a podlahové kúrenie. Hodí sa na prvé bývanie aj na prenájom.',
      fakty: [['Poschodie', '3. z 5, výťah'], ['Stav', 'novostavba (2025)'], ['Konštrukcia', 'tehla'], ['Balkón', '6,0 m²'], ['Parkovanie', 'státie v garáži v cene'], ['Energetická trieda', 'A0'], ['Vlastníctvo', 'osobné']] },
    7: { cislo: 'H-1047', makler: 'veronika', fotky: [
        { s: 'd7-dom', w: [800, 1600], a: 'Nový rodinný dom s drevenými trámami, upravenou záhradou a chodníkmi' }],
      popis: 'Novostavba z roku 2025 v Lužiankach, asi 10 minút autom od centra Nitry. Tepelné čerpadlo, podlahové kúrenie a rekuperácia. Upravená záhrada s terasou a dve parkovacie miesta na pozemku.',
      fakty: [['Podlažia', 'prízemie a poschodie'], ['Stav', 'novostavba (2025)'], ['Konštrukcia', 'tehla'], ['Pozemok', '720 m²'], ['Kúrenie', 'tepelné čerpadlo, podlahové'], ['Energetická trieda', 'A0'], ['Vlastníctvo', 'osobné']] },
    8: { cislo: 'H-1048', makler: 'tomas', fotky: [
        { s: 'b2-izba', w: [800, 1600], a: 'Prázdna svetlá izba so zabudovanou knižnicou, pohovkou a dvoma oknami' }],
      popis: 'Byt po rekonštrukcii, nezariadený a hneď voľný. Dve samostatné izby, kuchyňa s oknom a kúpeľňa so sprchovým kútom. Hodí sa na prvé bývanie aj na prenájom.',
      fakty: [['Poschodie', '3. z 4, bez výťahu'], ['Stav', 'po rekonštrukcii, nezariadený'], ['Konštrukcia', 'tehla'], ['Vonkajšie priestory', 'bez balkóna'], ['Parkovanie', 'pred domom'], ['Energetická trieda', 'C'], ['Vlastníctvo', 'osobné']] }
  };

  // ---------- Pôdorys (SVG) ----------
  var SVGNS = 'http://www.w3.org/2000/svg';
  function s(meno, attr, text) {
    var e = document.createElementNS(SVGNS, meno);
    if (attr) Object.keys(attr).forEach(function (k) { e.setAttribute(k, attr[k]); });
    if (text != null) e.textContent = text;
    return e;
  }
  function podorys(p, sirkaPx, vyskaPx) {
    var OBV = 2.1, VNU = 1.0, INK = '#1f1726';
    var minX = 0, minY = 0, maxX = p.w, maxY = p.h;
    (p.vonku || []).forEach(function (v) { minX = Math.min(minX, v[0]); minY = Math.min(minY, v[1]); maxX = Math.max(maxX, v[0] + v[2]); maxY = Math.max(maxY, v[1] + v[3]); });
    var m = 10, vbW = maxX - minX + 2 * m, vbH = maxY - minY + 2 * m;
    var mierka = Math.min((sirkaPx || 600) / vbW, (vyskaPx || 400) / vbH);
    var fs = Math.max(2.6, Math.min(4.2, 12.5 / mierka)), fs2 = fs * 0.88;
    var opis = p.izby.map(function (i) { return i[2] + ' ' + i[3] + ' m²'; }).join(', ');
    var svg = s('svg', { viewBox: [minX - m, minY - m, vbW, vbH].join(' '), class: 'podorys', role: 'img', 'aria-label': 'Pôdorys: ' + opis, preserveAspectRatio: 'xMidYMid meet' });
    svg.appendChild(s('rect', { x: minX - m, y: minY - m, width: vbW, height: vbH, fill: '#ffffff' }));
    (p.vonku || []).forEach(function (v) {
      svg.appendChild(s('rect', { x: v[0], y: v[1], width: v[2], height: v[3], fill: '#f7f4f9', stroke: '#9a8ea5', 'stroke-width': .5, 'stroke-dasharray': '1.6 1.2' }));
    });
    (p.vypln || []).forEach(function (r) { svg.appendChild(s('rect', { x: r[0], y: r[1], width: r[2], height: r[3], fill: '#f3eff6' })); });
    (p.nabytok || []).forEach(function (r) {
      svg.appendChild(s('rect', { x: r[0], y: r[1], width: r[2], height: r[3], fill: '#ffffff', stroke: r[4] === 'ostrov' ? '#c4b9cc' : '#a598b0', 'stroke-width': .5 }));
      if (r[4] !== 'linka') return;
      var vod = r[2] >= r[3], hr = Math.min(r[2], r[3]), dl = Math.max(r[2], r[3]), k = hr * .2;
      var bod = function (t, o) { return vod ? [r[0] + dl * t, r[1] + hr * o] : [r[0] + hr * o, r[1] + dl * t]; };
      [[.74, .32], [.74, .68], [.86, .32], [.86, .68]].forEach(function (q) { var c = bod(q[0], q[1]); svg.appendChild(s('circle', { cx: c[0], cy: c[1], r: k, fill: 'none', stroke: '#a598b0', 'stroke-width': .35 })); });
      var d = bod(.3, .5), sw = vod ? hr * 1.1 : hr * .6, sh = vod ? hr * .6 : hr * 1.1;
      svg.appendChild(s('rect', { x: d[0] - sw / 2, y: d[1] - sh / 2, width: sw, height: sh, rx: .6, fill: 'none', stroke: '#a598b0', 'stroke-width': .35 }));
    });
    (p.schody || []).forEach(function (r) {
      svg.appendChild(s('rect', { x: r[0], y: r[1], width: r[2], height: r[3], fill: '#ffffff', stroke: '#8b7f96', 'stroke-width': .5 }));
      var vodorovne = r[2] > r[3], krok = 2.6, i;
      if (vodorovne) { for (i = r[0] + krok; i < r[0] + r[2] - .5; i += krok) svg.appendChild(s('line', { x1: i, y1: r[1], x2: i, y2: r[1] + r[3], stroke: '#a598b0', 'stroke-width': .35 })); }
      else { for (i = r[1] + krok; i < r[1] + r[3] - .5; i += krok) svg.appendChild(s('line', { x1: r[0], y1: i, x2: r[0] + r[2], y2: i, stroke: '#a598b0', 'stroke-width': .35 })); }
    });
    p.steny.forEach(function (w) { svg.appendChild(s('line', { x1: w[0], y1: w[1], x2: w[2], y2: w[3], stroke: INK, 'stroke-width': VNU, 'stroke-linecap': 'square' })); });
    svg.appendChild(s('rect', { x: 0, y: 0, width: p.w, height: p.h, fill: 'none', stroke: INK, 'stroke-width': OBV }));
    (p.okna || []).forEach(function (o) {
      var vod = o[1] === o[3], t = OBV + .5;
      if (vod) {
        svg.appendChild(s('rect', { x: Math.min(o[0], o[2]), y: o[1] - t / 2, width: Math.abs(o[2] - o[0]), height: t, fill: '#ffffff' }));
        [-.8, .8].forEach(function (d) { svg.appendChild(s('line', { x1: o[0], y1: o[1] + d, x2: o[2], y2: o[3] + d, stroke: INK, 'stroke-width': .35 })); });
        [o[0], o[2]].forEach(function (x) { svg.appendChild(s('line', { x1: x, y1: o[1] - t / 2, x2: x, y2: o[1] + t / 2, stroke: INK, 'stroke-width': .6 })); });
      } else {
        svg.appendChild(s('rect', { x: o[0] - t / 2, y: Math.min(o[1], o[3]), width: t, height: Math.abs(o[3] - o[1]), fill: '#ffffff' }));
        [-.8, .8].forEach(function (d) { svg.appendChild(s('line', { x1: o[0] + d, y1: o[1], x2: o[2] + d, y2: o[3], stroke: INK, 'stroke-width': .35 })); });
        [o[1], o[3]].forEach(function (y) { svg.appendChild(s('line', { x1: o[0] - t / 2, y1: y, x2: o[0] + t / 2, y2: y, stroke: INK, 'stroke-width': .6 })); });
      }
    });
    (p.dvere || []).forEach(function (d) {
      var x = d[0], y = d[1], r = d[2], os = d[3], smer = d[4], str = d[5];
      var naObvode = os === 'x' ? (y === 0 || y === p.h) : (x === 0 || x === p.w);
      var t = (naObvode ? OBV : VNU) + .6;
      var O, L;
      if (os === 'x') {
        O = [x + smer * r, y]; L = [x, y + str * r];
        svg.appendChild(s('rect', { x: Math.min(x, O[0]), y: y - t / 2, width: r, height: t, fill: '#ffffff' }));
      } else {
        O = [x, y + smer * r]; L = [x + str * r, y];
        svg.appendChild(s('rect', { x: x - t / 2, y: Math.min(y, O[1]), width: t, height: r, fill: '#ffffff' }));
      }
      var kriz = (L[0] - x) * (O[1] - y) - (L[1] - y) * (O[0] - x);
      svg.appendChild(s('path', { d: 'M' + L[0] + ' ' + L[1] + ' A' + r + ' ' + r + ' 0 0 ' + (kriz > 0 ? 1 : 0) + ' ' + O[0] + ' ' + O[1], fill: 'none', stroke: '#8b7f96', 'stroke-width': .4 }));
      svg.appendChild(s('line', { x1: x, y1: y, x2: L[0], y2: L[1], stroke: INK, 'stroke-width': .6 }));
    });
    // Popis miestnosti: názov a plocha; dlhý názov sa zalomí na dva riadky, jedno dlhé slovo sa zmenší, aby nevyšlo zo steny.
    // Najprv sa všetky popisy len rozvrhnú. Ak by niektorý názov mal na obrazovke menej ako 10 px alebo plocha menej
    // ako 9 px (úzky mobil, široký byt), dostanú izby čísla a názvy s plochami sa ukážu pod galériou v bežnom texte.
    function rozvrh(cx, cy, nazov, plo, sir, vRiadku) {
      var f = fs, f2 = fs2, miesto = (sir || 40) - 3;
      if (vRiadku) {
        var t = nazov + ' ' + plo + NB + 'm²';
        f = Math.min(fs * .9, miesto / (t.length * .55));
        return { riadok: t, f: f, f2: f, cx: cx, cy: cy };
      }
      var riadky = [nazov];
      if (nazov.length * .56 * f > miesto && nazov.indexOf(' ') > 0) {
        var slova = nazov.split(' '), pol = Math.ceil(slova.length / 2);
        riadky = [slova.slice(0, pol).join(' '), slova.slice(pol).join(' ')];
      }
      var najdlhsi = Math.max.apply(null, riadky.map(function (r) { return r.length; }));
      if (najdlhsi * .56 * f > miesto) { var k = miesto / (najdlhsi * .56 * f); f *= k; f2 *= k; }
      return { riadky: riadky, plo: plo, f: f, f2: f2, cx: cx, cy: cy };
    }
    var miestnosti = p.izby.map(function (i) { return { nazov: i[2], plo: i[3], r: rozvrh(i[0], i[1], i[2], i[3], i[4], !!i[5]) }; })
      .concat((p.vonku || []).map(function (v) { return { nazov: v[4], plo: v[5], r: rozvrh(v[0] + v[2] / 2, v[1] + v[3] / 2, v[4], v[5], v[2], v[3] < 14) }; }));
    var najmensiNazov = Math.min.apply(null, miestnosti.map(function (m) { return m.r.f * mierka; }));
    var najmensiaPlocha = Math.min.apply(null, miestnosti.map(function (m) { return m.r.f2 * mierka; }));
    var cisla = najmensiNazov < 10 || najmensiaPlocha < 9;
    miestnosti.forEach(function (m, j) {
      var r = m.r;
      if (cisla) {
        var polomer = 11 / mierka;
        svg.appendChild(s('circle', { cx: r.cx, cy: r.cy, r: polomer, fill: INK }));
        svg.appendChild(s('text', { x: r.cx, y: r.cy + 4.1 / mierka, 'text-anchor': 'middle', 'font-size': 12 / mierka, 'font-weight': 700, class: 'c' }, String(j + 1)));
        return;
      }
      if (r.riadok) {
        svg.appendChild(s('text', { x: r.cx, y: r.cy + r.f * .34, 'text-anchor': 'middle', 'font-size': r.f, 'font-weight': 600 }, r.riadok));
        return;
      }
      var lh = r.f * 1.12, spolu = r.riadky.length + 1, y0 = r.cy - (spolu - 1) * lh / 2 + r.f * .34;
      r.riadky.forEach(function (t, i) { svg.appendChild(s('text', { x: r.cx, y: y0 + i * lh, 'text-anchor': 'middle', 'font-size': r.f, 'font-weight': 600 }, t)); });
      svg.appendChild(s('text', { x: r.cx, y: y0 + r.riadky.length * lh, 'text-anchor': 'middle', 'font-size': r.f2, fill: '#5d5367', 'font-variant-numeric': 'tabular-nums' }, r.plo + NB + 'm²'));
    });
    svg.zoznam = cisla ? miestnosti.map(function (m) { return { nazov: m.nazov, plo: m.plo }; }) : null;
    return svg;
  }

  // ---------- Detail ponuky s galériou ----------
  var dialog = $('#detail');
  var galeria = { snimky: [], i: 0, id: 0 };
  var odkialDetail = null;

  function srcset(f) { return f.w.map(function (w) { return 'img/' + f.s + '-' + w + '.webp ' + w + 'w'; }).join(', '); }
  function nahlad(f) { return 'img/' + f.s + '-240.webp'; }
  // Galéria má od 900 px 1,42 / 2,42 šírky dialógu (dialóg najviac 1 160 px, inak okno mínus 40 px), pod 900 px celé okno
  var SIZES = '(min-width: 1200px) 681px, (min-width: 900px) calc((100vw - 40px) * .587), 100vw';

  function rozmerScény() {
    var sc = $('#galeria-scena');
    var r = sc ? sc.getBoundingClientRect() : { width: 640, height: 427 };
    return { w: r.width || 640, h: r.height || 427 };
  }

  function ukaz(i, smer) {
    var n = galeria.snimky.length;
    if (!n) return;
    galeria.i = (i + n) % n;
    var sn = galeria.snimky[galeria.i];
    var scena = $('#galeria-scena');
    var novy;
    if (sn.typ === 'foto') {
      novy = el('img', { srcset: srcset(sn.f), sizes: SIZES, src: 'img/' + sn.f.s + '-' + sn.f.w[1] + '.webp', alt: sn.f.a, width: 1600, height: 1067, decoding: 'async' });
    } else {
      var r = rozmerScény();
      novy = podorys(PODORYSY[galeria.id], r.w, r.h);
    }
    // Nová snímka sa ukáže až po dekódovaní a jemne prelne cez starú (len opacity); pri obmedzenom pohybe hneď
    var vymen = function () {
      novy.style.opacity = '';
      $$('img, svg.podorys', scena).forEach(function (x) { if (x !== novy) x.remove(); });
      if (!novy.parentNode) scena.appendChild(novy);
      if (!pokoj() && typeof novy.animate === 'function') novy.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 280, easing: 'ease-out' });
    };
    if (novy.tagName === 'IMG' && novy.decode) {
      novy.style.opacity = '0';
      scena.appendChild(novy);
      novy.decode().catch(function () {}).then(function () { if (galeria.snimky[galeria.i] === sn) vymen(); else novy.remove(); });
    } else {
      vymen();
    }
    $('#galeria-pocet').textContent = (galeria.i + 1) + ' / ' + n;
    $('#galeria-popis').textContent = nb(sn.popis);
    var zoz = $('#galeria-miestnosti');
    if (zoz) {
      zoz.textContent = '';
      var polozky = sn.typ === 'podorys' && novy.zoznam;
      zoz.hidden = !polozky;
      if (polozky) novy.zoznam.forEach(function (m, j) {
        var li = el('li');
        li.appendChild(el('b', { 'aria-hidden': 'true' }, String(j + 1)));
        li.appendChild(el('i', null, nb(m.nazov)));
        li.appendChild(el('span', null, m.plo + NB + 'm²'));
        zoz.appendChild(li);
      });
    }
    $$('.galeria-nahlad', $('#galeria-nahlady')).forEach(function (b, j) { b.setAttribute('aria-current', j === galeria.i ? 'true' : 'false'); });
    var dalsi = galeria.snimky[(galeria.i + 1) % n];
    if (dalsi && dalsi.typ === 'foto') { var pre = new Image(); pre.decoding = 'async'; pre.sizes = SIZES; pre.srcset = srcset(dalsi.f); }
    var jedna = n < 2;
    $('#galeria-pred').hidden = jedna; $('#galeria-dalej').hidden = jedna;
  }

  function vyplnInfo(id) {
    var k = $('#ponuka-' + id), u = udaje(k), d = PONUKY[id], mk = MAKLERI[d.makler];
    var info = $('#detail-info');
    info.textContent = '';
    var miesto = el('p', { class: 'karta-miesto' });
    miesto.appendChild(el('span', { class: 'cislo', 'aria-hidden': 'true' }, String(id)));
    miesto.appendChild(document.createTextNode($('.karta-miesto', k).textContent.replace(/^\d+/, '').trim()));
    info.appendChild(miesto);
    info.appendChild(el('h2', { class: 'detail-nazov', id: 'detail-nazov' }, $('.karta-nazov', k).textContent));
    var cena = el('p', { class: 'detail-cena' });
    var c = el('span', { class: 'cena' }, cislo(u.cena) + NB);
    c.appendChild(el('span', { class: 'mena' }, '€'));
    cena.appendChild(c);
    cena.appendChild(el('span', { class: 'cena-m2' }, euro(u.cena / u.plocha) + '/m²'));
    info.appendChild(cena);
    info.appendChild(el('p', { class: 'detail-popis' }, nb(d.popis)));
    var par = $('#detail-parametre');
    par.textContent = '';
    par.appendChild(el('h3', { class: 'detail-h3' }, 'Parametre'));
    var dl = el('dl', { class: 'detail-fakty' });
    var zaklad = [['Úžitková plocha', plocha(u.plocha)], ['Izby', String(u.izby)]].concat(d.fakty);
    zaklad.forEach(function (f) { dl.appendChild(el('dt', null, f[0])); dl.appendChild(el('dd', null, nb(f[1]))); });
    par.appendChild(dl);

    var mes = splatka(u.cena * (1 - KALK.vlastne / 100), KALK.sadzba, KALK.roky);
    var sp = el('p', { class: 'detail-splatka' });
    sp.appendChild(document.createTextNode(nb('Ilustračná splátka približne ')));
    sp.appendChild(el('strong', null, euro(mes) + ' mesačne'));
    sp.appendChild(document.createTextNode(nb(' pri 20 % vlastných zdrojov, 30 rokoch a sadzbe 3,9 %. Nie je to ponuka úveru. ')));
    var kb = el('button', { class: 'odkaz', type: 'button' });
    kb.appendChild(document.createTextNode('Upraviť v kalkulačke'));
    kb.addEventListener('click', function () { doKalkulacky(u.cena); });
    sp.appendChild(kb);
    info.appendChild(sp);

    var bl = el('div', { class: 'detail-makler' });
    bl.appendChild(el('span', { class: 'makler-znak', 'aria-hidden': 'true' }, mk.znak));
    var mm = el('p', { class: 'detail-makler-meno' });
    mm.appendChild(el('strong', null, mk.meno));
    mm.appendChild(el('span', null, nb(mk.rola)));
    bl.appendChild(mm);
    var akcie = el('div', { class: 'detail-akcie' });
    var volat = el('button', { class: 'akcia akcia-plna akcia-mala', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'detail-cislo' }, 'Zavolať ' + mk.dativ);
    var predmet = 'Obhliadka ' + d.cislo + ': ' + $('.karta-nazov', k).textContent.replace(/ /g, ' ');
    var mail = el('a', { class: 'akcia akcia-obrys akcia-mala', href: 'mailto:' + mk.mail + '?subject=' + encodeURIComponent(predmet) }, 'Napísať e-mail');
    akcie.appendChild(volat); akcie.appendChild(mail);
    bl.appendChild(akcie);
    var odh = el('p', { class: 'odhalene', id: 'detail-cislo', hidden: '' });
    odh.appendChild(el('strong', null, '0XX XXX XXX'));
    odh.appendChild(document.createTextNode(nb('Na vašom webe sa číslo makléra vytočí jedným ťukom. V ukážke je vymyslené, preto sa nevytáča.')));
    bl.appendChild(odh);
    volat.addEventListener('click', function () {
      var otvor = odh.hidden;
      odh.hidden = !otvor;
      volat.setAttribute('aria-expanded', String(otvor));
    });
    info.appendChild(bl);
    var telo = $('.detail-telo', dialog);
    if (telo) telo.scrollTop = 0;
    $('#detail-cislo-ponuky').textContent = 'Ponuka ' + d.cislo + ', ' + id + ' z ' + karty.length;
  }

  function otvorDetail(id, odkial) {
    if (!dialog || typeof dialog.showModal !== 'function' || !PONUKY[id]) return false;
    var d = PONUKY[id];
    galeria.id = id;
    galeria.snimky = d.fotky.map(function (f, j) { return { typ: 'foto', f: f, popis: 'Fotka ' + (j + 1) + ': ' + f.a.charAt(0).toLowerCase() + f.a.slice(1) + '.' }; });
    galeria.snimky.push({ typ: 'podorys', popis: (PODORYSY[id].titul || 'Pôdorys') + '. Schematický, nie v mierke.' });
    var nahlady = $('#galeria-nahlady');
    nahlady.textContent = '';
    galeria.snimky.forEach(function (sn, j) {
      var b = el('button', { class: 'galeria-nahlad', type: 'button', 'aria-label': sn.typ === 'foto' ? 'Fotka ' + (j + 1) + ' z ' + galeria.snimky.length : 'Pôdorys' });
      if (sn.typ === 'foto') b.appendChild(el('img', { src: nahlad(sn.f), alt: '', width: 240, height: 160, decoding: 'async' }));
      else b.appendChild(el('span', null, 'Pôdorys'));
      b.addEventListener('click', function () { ukaz(j); });
      nahlady.appendChild(b);
    });
    vyplnInfo(id);
    odkialDetail = odkial || document.activeElement;
    dialog.showModal();
    ukaz(0);
    var z = $('#detail-zavriet');
    if (z) z.focus();
    return true;
  }

  function doKalkulacky(cena) {
    var k = $('#k-cena');
    if (!k) return;
    k.value = Math.max(+k.min, Math.min(+k.max, Math.round(cena / 1000) * 1000));
    k.dispatchEvent(new Event('input', { bubbles: true }));
    odkialDetail = null;
    dialog.close();
    var ciel = $('#hypoteka');
    if (ciel) ciel.scrollIntoView({ behavior: pokoj() ? 'auto' : 'smooth', block: 'start' });
    setTimeout(function () { k.focus({ preventScroll: true }); }, pokoj() ? 0 : 500);
  }

  if (dialog) {
    $('#detail-zavriet').addEventListener('click', function () { dialog.close(); });
    $('#galeria-pred').addEventListener('click', function () { ukaz(galeria.i - 1); });
    $('#galeria-dalej').addEventListener('click', function () { ukaz(galeria.i + 1); });
    dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });
    dialog.addEventListener('keydown', function (e) {
      var t = e.target && e.target.tagName;
      if (t === 'INPUT' || t === 'SELECT' || t === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); ukaz(galeria.i - 1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); ukaz(galeria.i + 1); }
    });
    dialog.addEventListener('close', function () {
      var o = odkialDetail;
      odkialDetail = null;
      if (o && o.isConnected && o.offsetParent !== null) o.focus({ preventScroll: true });
    });
    // Potiahnutie prstom po fotke
    var scena = $('#galeria-scena'), x0 = null, y0 = null;
    scena.addEventListener('pointerdown', function (e) { x0 = e.clientX; y0 = e.clientY; });
    scena.addEventListener('pointerup', function (e) {
      if (x0 == null) return;
      var dx = e.clientX - x0, dy = e.clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.3) ukaz(galeria.i + (dx < 0 ? 1 : -1));
    });
    scena.addEventListener('pointercancel', function () { x0 = null; });
    // Pri zmene veľkosti okna sa pôdorys prekreslí s čitateľným písmom
    var cas = 0;
    window.addEventListener('resize', function () {
      clearTimeout(cas);
      cas = setTimeout(function () { if (dialog.open && galeria.snimky[galeria.i] && galeria.snimky[galeria.i].typ === 'podorys') ukaz(galeria.i); }, 150);
    });
  }

  window.HradbaDetail = { otvor: otvorDetail };
})();
