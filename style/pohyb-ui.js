/* pohyb-ui.js: mikro-interakcie papierového systému (paper.css, sekcia 21).
   Zapína sa triedou pu na <body>. Bez závislostí, štýly len cez triedy a CSSOM
   (CSP style-src 'self'). Pružiny sú CSS krivky --pu-* z ops/video/pohyb/web/pruziny-css.mjs.
   Návrh: ops/video/pohyb/WEB-STAVBA.md, časť 1.

   window.PohybUI = {
     zalozky(el)            indikátor na dvoch pružinách pre skupinu [data-pu-zalozky] (volá sa samo)
     uspech(tlacidlo, text) morf tlačidla na potvrdenie (kruh atramentu, šírka, fajka)
     chyba(pole, veta, o)   aria-invalid, veta pod poľom, fokus na pole; o.oznam = role="alert" (len pri odoslaní)
     bezChyby(pole)         zruší chybu poľa
     toast(text)            jedna krátka správa dole v strede, najviac jedna naraz
   } */
(function (root) {
  'use strict';

  // ------------------------------------------------------------ jadro (čisté, testuje sa v Node)

  /** Smer pohybu indikátora: predný okraj je ten v smere pohybu. */
  function smer(stare, nove) {
    if (!stare) return '';
    if (stare.l === nove.l && stare.r === nove.r) return '';
    return nove.l + nove.r >= stare.l + stare.r ? 'vpravo' : 'vlavo';
  }

  /** Kroky morfu na potvrdenie. Pri zníženom pohybe len výmena textu. */
  function krokyUspechu(znizeny) {
    return znizeny ? ['text'] : ['odchod', 'atrament', 'sirka', 'vstup', 'fajka'];
  }

  /** Polomer kruhu, ktorý z bodu (x, y) pokryje celý obdĺžnik w x h. */
  function polomer(w, h, x, y) {
    return Math.max(Math.hypot(x, y), Math.hypot(w - x, y), Math.hypot(x, h - y), Math.hypot(w - x, h - y));
  }

  /** Nová šírka tlačidla: pôvodná šírka bez starého obsahu plus nový obsah. */
  function novaSirka(w0, stary, novy) {
    return Math.max(0, Math.round((w0 - stary + novy) * 100) / 100);
  }

  var HOTOVO = { sk: 'Uložené', cs: 'Uloženo', en: 'Saved', de: 'Gespeichert' };
  function textHotovo(lang) {
    var l = String(lang || 'en').slice(0, 2).toLowerCase();
    return HOTOVO[l] || HOTOVO.en;
  }

  /** Sekundy z CSS dĺžky (".294s" alebo "294ms"). */
  function sekundy(s, zaloha) {
    s = String(s || '').trim();
    var m = /^(-?[\d.]+)(ms|s)$/.exec(s);
    if (!m) return zaloha;
    return m[2] === 'ms' ? parseFloat(m[1]) / 1000 : parseFloat(m[1]);
  }

  var jadro = { smer: smer, krokyUspechu: krokyUspechu, polomer: polomer, novaSirka: novaSirka, textHotovo: textHotovo, sekundy: sekundy };

  var doc = root.document;
  if (!doc) {
    // Node: len jadro kvôli testom
    if (typeof module !== 'undefined' && module.exports) module.exports = { _jadro: jadro };
    return;
  }

  // ------------------------------------------------------------ pomocné pre DOM

  function znizeny() {
    try { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  }
  function cas(meno, zaloha) {
    try { return sekundy(root.getComputedStyle(doc.documentElement).getPropertyValue('--pu-' + meno + '-t'), zaloha) * 1000; } catch (e) { return zaloha * 1000; }
  }
  function jazyk(el) {
    var n = el && el.closest ? el.closest('[lang]') : null;
    return (n && n.getAttribute('lang')) || doc.documentElement.getAttribute('lang') || 'en';
  }
  function zapnutePu() { return !!(doc.body && doc.body.classList.contains('pu')); }
  function dalsiaSnimka(fn) {
    // dve snímky: prvá zapíše východiskový stav, druhá spustí prechod
    if (root.requestAnimationFrame) root.requestAnimationFrame(function () { root.requestAnimationFrame(fn); });
    else root.setTimeout(fn, 32);
  }

  // posledné stlačenie: odtiaľ vyrastie kruh atramentu
  var posledne = null;
  // Na dotyku sa :active ukáže neskoro alebo vôbec, preto trieda pu-stlacene hneď pri pointerdown.
  var TLACIDLA = '.btn,.icon-btn,.tab-btn,[data-pu],header.site-header .site-cta,footer.site-footer .site-cta';
  var stlacene = null;
  function zapamatajStlacenie(e) {
    posledne = { el: e.target, x: e.clientX, y: e.clientY };
    if (e.pointerType === 'mouse' || !e.target || !e.target.closest) return;
    var b = e.target.closest(TLACIDLA);
    if (!b || b.disabled || b.getAttribute('aria-disabled') === 'true') return;
    pustStlacene();
    stlacene = b;
    b.classList.add('pu-stlacene');
  }
  function pustStlacene() {
    if (stlacene) stlacene.classList.remove('pu-stlacene');
    stlacene = null;
  }

  // ------------------------------------------------------------ záložky a prepínače

  var VYBRANY = '[aria-selected="true"],[aria-current]:not([aria-current="false"]),[aria-pressed="true"],.on';

  function zalozky(el) {
    if (!el || el._puZalozky) return el && el._puZalozky;
    var ind = doc.createElement('span');
    ind.className = 'pu-ind';
    ind.setAttribute('aria-hidden', 'true');
    el.appendChild(ind);
    var stare = null;
    var pilulka = el.getAttribute('data-pu-zalozky') === 'pilulka';

    function vybrany() {
      var deti = el.children;
      for (var i = 0; i < deti.length; i++) if (deti[i] !== ind && deti[i].matches(VYBRANY)) return deti[i];
      return null;
    }
    function meraj(anim) {
      var b = vybrany();
      if (!b) { ind.style.setProperty('visibility', 'hidden'); stare = null; return; }
      ind.style.removeProperty('visibility');
      var nove = { l: b.offsetLeft, r: b.offsetLeft + b.offsetWidth };
      if (!pilulka) {
        // linka len pod textom, nie pod výplňou tlačidla
        var cs = root.getComputedStyle(b);
        nove.l += parseFloat(cs.paddingLeft) || 0;
        nove.r -= parseFloat(cs.paddingRight) || 0;
      }
      var s = anim && !znizeny() ? smer(stare, nove) : '';
      if (stare && !s && stare.l === nove.l && stare.r === nove.r) return;
      ind.classList.toggle('vpravo', s === 'vpravo');
      ind.classList.toggle('vlavo', s === 'vlavo');
      if (pilulka) {
        ind.style.setProperty('top', b.offsetTop + 'px');
        ind.style.setProperty('height', b.offsetHeight + 'px');
      }
      ind.style.setProperty('--pu-l', nove.l + 'px');
      ind.style.setProperty('--pu-r', nove.r + 'px');
      stare = nove;
    }
    meraj(false);
    if (root.MutationObserver) {
      new root.MutationObserver(function (zoznam) {
        for (var i = 0; i < zoznam.length; i++) if (zoznam[i].target !== ind) { meraj(true); return; }
      }).observe(el, { subtree: true, attributes: true, attributeFilter: ['aria-selected', 'aria-current', 'aria-pressed', 'class'] });
    }
    if (root.ResizeObserver) new root.ResizeObserver(function () { meraj(false); }).observe(el);
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { meraj(false); });
    el._puZalozky = { meraj: meraj, ind: ind };
    return el._puZalozky;
  }

  // ------------------------------------------------------------ morf tlačidla na potvrdenie

  var FAJKA = '<svg class="pu-fajka" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  function zabal(btn) {
    var s = doc.createElement('span');
    s.className = 'pu-obsah';
    while (btn.firstChild) s.appendChild(btn.firstChild);
    btn.appendChild(s);
    return s;
  }

  function uspech(btn, text) {
    if (!btn || btn.classList.contains('pu-hotovo') || btn._puMorf) return;
    btn._puMorf = true;
    text = text || btn.getAttribute('data-pu-hotovo') || textHotovo(jazyk(btn));
    var kroky = krokyUspechu(znizeny());
    if ('disabled' in btn) btn.disabled = true; else btn.setAttribute('aria-disabled', 'true');

    var novy = doc.createElement('span');
    novy.className = 'pu-obsah pu-novy';
    novy.innerHTML = FAJKA;
    novy.appendChild(doc.createTextNode(text));

    if (kroky.length === 1) {
      // znížený pohyb: bez kruhu, bez zmeny šírky, len nový text
      btn.classList.add('pu-morf', 'pu-hotovo');
      while (btn.firstChild) btn.removeChild(btn.firstChild);
      novy.classList.add('on');
      btn.appendChild(novy);
      return;
    }

    var r = btn.getBoundingClientRect();
    var stary = zabal(btn);
    var sirkaStareho = stary.getBoundingClientRect().width;
    btn.classList.add('pu-morf');
    btn.style.setProperty('width', r.width + 'px');

    // kruh atramentu z miesta posledného stlačenia (inak zo stredu)
    var x = r.width / 2, y = r.height / 2;
    if (posledne && btn.contains(posledne.el)) {
      x = Math.min(Math.max(posledne.x - r.left, 0), r.width);
      y = Math.min(Math.max(posledne.y - r.top, 0), r.height);
    }
    var R = polomer(r.width, r.height, x, y);
    var a = doc.createElement('span');
    a.className = 'pu-atrament';
    a.setAttribute('aria-hidden', 'true');
    a.style.setProperty('--pu-d', 2 * R + 'px');
    a.style.setProperty('--pu-x', x - R + 'px');
    a.style.setProperty('--pu-y', y - R + 'px');
    btn.insertBefore(a, btn.firstChild);

    stary.classList.add('pu-prec');
    dalsiaSnimka(function () { a.classList.add('on'); });

    var tOdchod = cas('odchod', 0.294);
    var tVstup = cas('vstup', 0.507);
    root.setTimeout(function () {
      // nový obsah zmerať mimo toku, potom plynulo zmeniť šírku
      stary.parentNode && btn.removeChild(stary);
      novy.classList.add('pu-meraj');
      btn.appendChild(novy);
      var w1 = novaSirka(r.width, sirkaStareho, novy.getBoundingClientRect().width);
      novy.classList.remove('pu-meraj');
      btn.style.setProperty('width', w1 + 'px');
      dalsiaSnimka(function () { novy.classList.add('on'); });
    }, Math.round(tOdchod * 0.7));
    root.setTimeout(function () {
      btn.classList.add('pu-hotovo');
      if (a.parentNode) a.parentNode.removeChild(a);
    }, Math.round(tVstup + 40));
  }

  // ------------------------------------------------------------ chyba poľa

  var poradie = 0;
  function vetaPola(pole, vytvor) {
    var ids = (pole.getAttribute('aria-describedby') || '').split(/\s+/);
    for (var i = 0; i < ids.length; i++) {
      var n = ids[i] && doc.getElementById(ids[i]);
      if (n && n.classList.contains('pu-chyba')) return n;
    }
    var s = pole.nextElementSibling;
    if (s && s.classList.contains('pu-chyba')) { prepoj(pole, s); return s; }
    if (!vytvor) return null;
    var p = doc.createElement('p');
    p.className = 'pu-chyba';
    pole.insertAdjacentElement('afterend', p);
    prepoj(pole, p);
    return p;
  }
  function prepoj(pole, veta) {
    if (!veta.id) veta.id = 'pu-chyba-' + ++poradie;
    var d = (pole.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
    if (d.indexOf(veta.id) < 0) { d.push(veta.id); pole.setAttribute('aria-describedby', d.join(' ')); }
  }
  function ukazChybu(pole, veta, oznam) {
    var v = vetaPola(pole, true);
    if (oznam) v.setAttribute('role', 'alert'); else v.removeAttribute('role');
    v.textContent = veta || pole.getAttribute('data-pu-chyba') || pole.validationMessage || '';
    v.classList.add('on');
  }
  function skryChybu(pole) {
    var v = vetaPola(pole, false);
    if (!v) return;
    v.classList.remove('on');
    v.removeAttribute('role');
  }
  function chyba(pole, veta, o) {
    if (!pole) return;
    pole._puVeta = veta;
    pole.setAttribute('aria-invalid', 'true');
    ukazChybu(pole, veta, !!(o && o.oznam));
    if (!o || o.fokus !== false) { try { pole.focus(); } catch (e) { /* bez fokusu */ } }
  }
  function bezChyby(pole) {
    if (!pole) return;
    pole._puVeta = null;
    pole.removeAttribute('aria-invalid');
    skryChybu(pole);
  }

  // ------------------------------------------------------------ toast

  var tost = null, tostCas = 0;
  function toast(text) {
    if (!doc.body) return;
    if (!tost) {
      tost = doc.createElement('div');
      tost.className = 'pu-toast';
      tost.setAttribute('role', 'status');
      tost.addEventListener('click', zavriToast);
      doc.body.appendChild(tost);
    }
    root.clearTimeout(tostCas);
    var zobraz = function () {
      tost.textContent = text;
      tost.classList.add('on');
      tostCas = root.setTimeout(zavriToast, 3200);
    };
    if (tost.classList.contains('on')) zobraz();
    else dalsiaSnimka(zobraz);
  }
  function zavriToast() {
    root.clearTimeout(tostCas);
    if (tost) tost.classList.remove('on');
  }

  // ------------------------------------------------------------ automatické napojenie

  function napojOdber(form) {
    var thanks = doc.getElementById(form.getAttribute('data-thanks') || '');
    if (!thanks || !root.MutationObserver) return;
    new root.MutationObserver(function () {
      if (thanks.hidden) return;
      var btn = form.querySelector('button[type="submit"],button:not([type])');
      if (!form.hidden && btn) { uspech(btn); return; }
      // subscribe.js po úspechu skryje celý formulár: vtedy len vstup poďakovania
      if (!thanks.classList.contains('pu-zjav')) {
        thanks.classList.add('pu-zjav');
        dalsiaSnimka(function () { thanks.classList.add('on'); });
      }
    }).observe(thanks, { attributes: true, attributeFilter: ['hidden'] });
  }

  function start() {
    var P = root.PohybUI;
    if (!zapnutePu()) return;
    // iOS Safari ukáže :active len so živým poslucháčom dotyku
    doc.addEventListener('touchstart', function () {}, { passive: true });
    doc.addEventListener('pointerdown', zapamatajStlacenie, { capture: true, passive: true });
    ['pointerup', 'pointercancel', 'dragstart'].forEach(function (t) { doc.addEventListener(t, pustStlacene, { capture: true, passive: true }); });
    root.addEventListener('blur', pustStlacene);
    var zs = doc.querySelectorAll('[data-pu-zalozky]');
    for (var i = 0; i < zs.length; i++) zalozky(zs[i]);
    var fs = doc.querySelectorAll('form[data-subscribe][data-thanks]');
    for (var j = 0; j < fs.length; j++) napojOdber(fs[j]);
    if (root.MutationObserver) {
      new root.MutationObserver(function (zoznam) {
        for (var k = 0; k < zoznam.length; k++) {
          var m = zoznam[k], el = m.target;
          if (m.attributeName === 'aria-invalid' && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) {
            if (el.getAttribute('aria-invalid') === 'true') { if (!vetaPola(el, false) || !vetaPola(el, false).classList.contains('on')) ukazChybu(el, el._puVeta, false); }
            else skryChybu(el);
          } else if (m.type === 'childList') {
            for (var n = 0; n < m.addedNodes.length; n++) {
              var u = m.addedNodes[n];
              if (u.nodeType !== 1) continue;
              if (u.matches('[data-pu-zalozky]')) zalozky(u);
              var vnut = u.querySelectorAll ? u.querySelectorAll('[data-pu-zalozky]') : [];
              for (var q = 0; q < vnut.length; q++) zalozky(vnut[q]);
            }
          }
        }
      }).observe(doc.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-invalid'] });
    }
    // po oprave poľa (natívna kontrola) chyba odíde pri písaní, bez role="alert"
    doc.addEventListener('input', function (e) {
      var el = e.target;
      if (el && el.getAttribute && el.getAttribute('aria-invalid') === 'true' && el.checkValidity && el.checkValidity()) bezChyby(el);
    });
    return P;
  }

  var PohybUI = { zalozky: zalozky, uspech: uspech, chyba: chyba, bezChyby: bezChyby, toast: toast, _jadro: jadro };
  root.PohybUI = PohybUI;
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start);
  else start();
})(typeof window !== 'undefined' ? window : globalThis);
