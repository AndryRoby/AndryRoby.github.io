/* Technológie webov / Stacklog: jediný skript stránky.
 *
 * Pravidlá, ktoré tento súbor drží:
 *   - žiadny vložený skript, žiadna knižnica, žiadna cudzia doména okrem homelabu,
 *   - každý reťazec z odpovede prejde cez esc() skôr, než sa dostane do HTML,
 *   - texty sú v <script type="application/json" id="th-txt">, aby preklad ostal
 *     v ops/technologie/data.mjs a skript bol pre oba jazyky jeden,
 *   - DOM sa zapisuje raz na celý blok, nie po riadkoch (žiadne trhanie rozloženia),
 *   - keď sa služba neozve, stránka to povie vetou, nie prázdnym miestom.
 */
(function () {
  'use strict';
  var uzol = document.getElementById('th-txt');
  if (!uzol) return;
  var C;
  try { C = JSON.parse(uzol.textContent); } catch (e) { return; }
  var T = C.t, API = C.api, LANG = C.lang || 'en';

  /* ── pomocné ─────────────────────────────────────────────────────────── */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (z) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[z];
    });
  }
  function cislo(n) { return typeof n === 'number' ? n.toLocaleString(LANG) : ''; }
  function pct(n, d) {
    if (typeof n !== 'number') return '';
    return n.toLocaleString(LANG, { minimumFractionDigits: d == null ? 1 : d, maximumFractionDigits: d == null ? 1 : d });
  }
  function cas(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return isNaN(d) ? String(iso) : d.toLocaleString(LANG, { dateStyle: 'medium', timeStyle: 'short' });
  }
  function den(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return isNaN(d) ? String(iso) : d.toLocaleDateString(LANG, { day: 'numeric', month: 'short', year: 'numeric' });
  }
  /* Rovnaké pravidlo ako v generátore: pod 0,05 pb rozpätia rovná čiara,
     aby sa šum nezväčšil na celú výšku a nevyzeral ako nameraný pohyb. */
  function krivka(body, smer) {
    if (!body || body.length < 2) return '';
    var v = body.map(function (b) { return typeof b === 'number' ? b : b.usage_pct; }).filter(function (x) { return typeof x === 'number'; });
    if (v.length < 2) return '';
    var min = Math.min.apply(null, v), max = Math.max.apply(null, v), r = max - min, k = 72 / (v.length - 1);
    var d = v.map(function (x, i) {
      return (i * k).toFixed(1) + ',' + (r < 0.05 ? '10.0' : (17 - (x - min) / r * 14).toFixed(1));
    }).join(' ');
    var trieda = smer > 0 ? 'hore' : smer < 0 ? 'dole' : 'nula';
    return '<svg class="th-spark ' + trieda + '" viewBox="0 0 72 20" width="72" height="20" aria-hidden="true" focusable="false"><polyline points="' + d + '"/></svg>';
  }

  /* ── 1. Kontrola jednej domény ───────────────────────────────────────── */
  var form = document.getElementById('th-form');
  var vysl = document.getElementById('th-vysledok');
  var stavR = document.getElementById('th-stav');
  var uvodne = document.getElementById('th-uvodne');

  function stav(text, chyba) {
    if (!stavR) return;
    stavR.className = chyba ? 'th-chyba' : 'th-stav-riadok';
    stavR.innerHTML = chyba ? '<b>' + esc(chyba) + '</b>' + esc(text) : esc(text);
    stavR.hidden = !text && !chyba;
  }

  function cistaDomena(s) {
    s = String(s || '').trim().toLowerCase();
    s = s.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].split('?')[0].split('#')[0];
    return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(s) ? s : '';
  }

  function chybaVety(kod, sprava) {
    var v = C.err && C.err[kod];
    return v || sprava || T.nedostupne;
  }

  function vykresli(r, ciastocny) {
    if (!r || r.ok === false) {
      stav(chybaVety(r && r.error, r && r.message), T.chyba);
      return;
    }
    var h = [];
    h.push('<div class="th-hlava"><h2>' + esc(r.domain || '') + '</h2><dl>');
    if (r.final_url) h.push('<div><dt>URL</dt><dd>' + esc(r.final_url) + '</dd></div>');
    if (r.fetched_at) h.push('<div><dt>' + esc(T.meranie) + '</dt><dd>' + esc(cas(r.fetched_at)) + '</dd></div>');
    if (r.http && r.http.status) h.push('<div><dt>HTTP</dt><dd>' + esc(r.http.status) + (r.http.alpn ? ' ' + esc(r.http.alpn) : '') + '</dd></div>');
    if (typeof r.elapsed_ms === 'number') h.push('<div><dt>' + esc(T.cas) + '</dt><dd>' + cislo(r.elapsed_ms) + ' ms</dd></div>');
    h.push('</dl><p class="th-stav-riadok"><span class="th-stav' + (r.cached ? '' : ' zivy') + '">' + esc(r.cached ? T.cached : T.zivy) + '</span></p></div>');

    if (r.changes && r.changes.length) {
      h.push('<h3 class="th-sek th-zmeny-h">' + esc(T.zmeny) + '</h3><ul class="th-ledger">');
      r.changes.slice(0, 12).forEach(function (z) {
        h.push('<li><time datetime="' + esc(z.ts) + '">' + esc(den(z.ts)) + '</time><div><b>' +
          esc(z.to || z.slug || '') + '</b><p>' + esc(C.kat[z.category] || z.category || '') +
          (z.from ? ' <span class="th-od">' + esc(T.z) + ' ' + esc(z.from) + '</span>' : '') + '</p></div></li>');
      });
      h.push('</ul>');
    }

    h.push('<div class="th-grid"><div><table class="th-nalezy" id="th-nalezy"><caption>' + esc(T.nalezy) +
      '</caption><thead><tr><th scope="col">' + esc(T.kat) + '</th><th scope="col">' + esc(T.tech) +
      '</th><th scope="col">' + esc(T.istota) + '</th><th scope="col"><span class="th-sr-only"></span></th></tr></thead><tbody>');
    var i = 0, prazdne = true;
    (r.categories || []).forEach(function (k) {
      (k.findings || []).forEach(function (f) {
        prazdne = false;
        var id = 'd' + (i++);
        h.push('<tr><td class="th-kat">' + esc(C.kat[k.id] || k.label || k.id) + '</td><td><span class="meno">' +
          esc(f.name || f.slug) + '</span>' + (f.version ? ' <span class="verzia">' + esc(f.version) + '</span>' : '') +
          '</td><td class="th-istota ' + esc(f.confidence || '') + '">' + esc((C.istoty && C.istoty[f.confidence]) || f.confidence || '') + '</td><td>');
        if (f.evidence && f.evidence.length) {
          h.push('<button type="button" class="th-dokaz" aria-expanded="false" aria-controls="' + id + '" data-cil="' + id + '">' + esc(T.dokaz) + '</button>');
        }
        h.push('</td></tr>');
        if (f.evidence && f.evidence.length) {
          h.push('<tr class="th-dokazy" id="' + id + '" hidden><td colspan="4"><ul>');
          f.evidence.forEach(function (d) {
            h.push('<li><dfn>' + esc((C.sig && C.sig[d.type]) || d.type || '') + '</dfn><code>' +
              esc((d.key ? d.key + ': ' : '') + (d.value == null ? '' : d.value)) + '</code></li>');
          });
          h.push('</ul></td></tr>');
        }
      });
    });
    if (prazdne) h.push('<tr><td colspan="4">' + esc(T.nic) + '</td></tr>');
    h.push('</tbody></table></div><div>');

    var se = r.site_elements;
    if (se) {
      h.push('<div class="th-rail"><h3>' + esc(T.prvky) + '</h3><dl>');
      var prvky = [
        ['HTTPS', r.http && r.http.tls], ['HTTP/2', se.alpn === 'h2' ? 'h2' : null],
        ['HTTP/3', se.http3 && se.http3.advertised ? T.ohlasene : null],
        [T.kompresia, se.compression], ['HSTS', se.hsts && se.hsts.present ? 'max-age ' + cislo(se.hsts.max_age) : null],
        ['IPv6', typeof se.ipv6 === 'boolean' ? (se.ipv6 ? T.ano : T.nie) : null]
      ];
      prvky.forEach(function (p) { if (p[1]) h.push('<div><dt>' + esc(p[0]) + '</dt><dd>' + esc(p[1]) + '</dd></div>'); });
      (se.cookies || []).slice(0, 4).forEach(function (c) {
        h.push('<div><dt>cookie</dt><dd>' + esc(c.name) + (c.secure ? ' Secure' : '') + (c.httponly ? ' HttpOnly' : '') +
          (c.samesite ? ' SameSite=' + esc(c.samesite) : '') + '</dd></div>');
      });
      h.push('</dl></div>');
    }
    var hy = r.hygiene;
    if (hy && hy.checks) {
      h.push('<div class="th-rail"><h3>' + esc(T.hygiena) + ' <span class="th-istota">' + cislo(hy.passed) + '/' + cislo(hy.total) + '</span></h3><ul>');
      hy.checks.forEach(function (c) {
        h.push('<li><span class="co">' + esc((C.hyg && C.hyg[c.id]) || c.id) + '</span><span class="stav ' + esc(c.state || '') + '">' +
          esc(T[c.state] || c.state || '') + '</span>' + (c.why ? '<p class="preco">' + esc(c.why) + '</p>' : '') + '</li>');
      });
      h.push('</ul></div>');
    }
    h.push('</div></div>');

    if (r.notes && r.notes.length) h.push('<p class="th-stav-riadok">' + esc(r.notes.join(' ')) + '</p>');
    if (r.quota && typeof r.quota.remaining === 'number') {
      h.push('<p class="th-stav-riadok">' + esc(T.zostava.replace('{n}', cislo(r.quota.remaining))) + '</p>');
    }
    if (r.partial || ciastocny) h.push('<p class="th-stav-riadok">' + esc(T.ciastocne) + '</p>');
    h.push('<p class="th-stav-riadok"><a class="th-tichy" href="' + esc(API + '/api/site/' + encodeURIComponent(r.domain || '')) + '">' + esc(T.odkaz) + '</a></p>');

    vysl.innerHTML = h.join('');
    vysl.hidden = false;
    vysl.classList.remove('th-usadenie');
    void vysl.offsetWidth;
    vysl.classList.add('th-usadenie');
    if (uvodne && !ciastocny) uvodne.hidden = true;
    stav('');
  }

  function json(url, hotovo) {
    fetch(url, { headers: { accept: 'application/json' } })
      .then(function (o) { return o.json().catch(function () { return { ok: false, error: 'unreachable' }; }); })
      .then(hotovo)
      .catch(function () { hotovo({ ok: false, error: 'unreachable' }); });
  }

  function kontroluj(d, tichy) {
    var url = API + '/api/site/' + encodeURIComponent(d);
    stav(T.hladam);
    if (!tichy && history.replaceState) history.replaceState(null, '', '?d=' + encodeURIComponent(d));
    var hotovo = false;
    var koniec = function (r) { if (!hotovo) { hotovo = true; vykresli(r); } };
    if (window.EventSource) {
      var es = new EventSource(url + '?stream=1');
      var doba = setTimeout(function () { es.close(); if (!hotovo) json(url, koniec); }, 8500);
      es.addEventListener('cached', function (e) {
        try { if (!hotovo) vykresli(JSON.parse(e.data), true); } catch (x) { /* ďalšia udalosť to prepíše */ }
      });
      es.addEventListener('done', function (e) {
        clearTimeout(doba); es.close();
        try { koniec(JSON.parse(e.data)); } catch (x) { json(url, koniec); }
      });
      es.onerror = function () { clearTimeout(doba); es.close(); if (!hotovo) json(url, koniec); };
    } else json(url, koniec);
  }

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var pole = document.getElementById('th-domena');
      var d = cistaDomena(pole && pole.value);
      if (!d) { stav(chybaVety('invalid_domain'), T.chyba); if (pole) pole.focus(); return; }
      kontroluj(d);
    });
    var zaciatok = new URLSearchParams(location.search).get('d');
    var prva = cistaDomena(zaciatok);
    if (prva) {
      var p = document.getElementById('th-domena');
      if (p) p.value = prva;
      kontroluj(prva, true);
    }
  }

  /* Dôkazy: jeden poslucháč na celú tabuľku, nie jeden na riadok. */
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('.th-dokaz') : null;
    if (!b) return;
    var r = document.getElementById(b.getAttribute('data-cil'));
    if (!r) return;
    var otvor = r.hidden;
    r.hidden = !otvor;
    b.setAttribute('aria-expanded', otvor ? 'true' : 'false');
    b.textContent = otvor ? T.skryt : T.dokaz;
  });

  /* ── 2. Denník zmien na úvodnej stránke ──────────────────────────────── */
  var denik = document.getElementById('th-zmeny');
  if (denik && C.live) {
    json(API + '/api/changes?limit=8', function (r) {
      if (!r || r.ok === false || !r.items || !r.items.length) return;
      var h = r.items.slice(0, 8).map(function (z) {
        return '<li><time datetime="' + esc(z.ts) + '">' + esc(den(z.ts)) + '</time><div><b>' + esc(z.domain) +
          '</b><p>' + esc(C.kat[z.category] || z.category || '') + ': ' + esc(z.to || '') +
          (z.from ? ' <span class="th-od">' + esc(T.z) + ' ' + esc(z.from) + '</span>' : '') + '</p></div></li>';
      }).join('');
      denik.innerHTML = h;
      denik.hidden = false;
      var pr = document.getElementById('th-zmeny-prazdne');
      if (pr) pr.hidden = true;
    });
  }

  /* ── 3. Triedenie tabuliek štatistík ─────────────────────────────────── */
  function tried(tab, kluc, smer) {
    var telo = tab.tBodies[0];
    var riadky = Array.prototype.slice.call(telo.rows);
    riadky.sort(function (a, b) {
      var x = a.dataset[kluc], y = b.dataset[kluc];
      var cx = parseFloat(x), cy = parseFloat(y);
      if (!isNaN(cx) && !isNaN(cy)) return smer * (cx - cy);
      return smer * String(x || '').localeCompare(String(y || ''), LANG);
    });
    var f = document.createDocumentFragment();
    riadky.forEach(function (r) { f.appendChild(r); });
    telo.appendChild(f);
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('.th-sort') : null;
    if (!b) return;
    var th = b.parentNode, tab = th.closest('table'), kluc = b.getAttribute('data-k');
    if (!tab || !kluc) return;
    var dole = th.getAttribute('aria-sort') !== 'ascending';
    Array.prototype.forEach.call(tab.tHead.rows[0].cells, function (c) { c.removeAttribute('aria-sort'); });
    th.setAttribute('aria-sort', dole ? 'descending' : 'ascending');
    tried(tab, kluc, dole ? -1 : 1);
  });

  /* ── 4. Štatistiky zo živej služby, keď sa ozve ──────────────────────── */
  var stat = document.getElementById('th-stat');
  if (stat && C.live) {
    json(API + '/api/stats.json', function (r) {
      if (!r || r.ok === false || !r.as_of || r.as_of === stat.getAttribute('data-as-of')) return;
      var tld = stat.getAttribute('data-tld');
      var data = r.tlds ? r.tlds[tld] : (r.tld === tld ? r : null);
      if (!data || !data.categories) return;
      data.categories.forEach(function (k) {
        var tab = document.getElementById('th-tab-' + k.id);
        if (!tab) return;
        var max = 0;
        k.items.forEach(function (p) { if (typeof p.usage_pct === 'number' && p.usage_pct > max) max = p.usage_pct; });
        tab.tBodies[0].innerHTML = k.items.map(function (p) {
          var smer = Math.sign(p.change_30d_pp || 0), hore = smer > 0;
          return '<tr data-nazov="' + esc(p.name) + '" data-usage="' + (p.usage_pct == null ? -1 : p.usage_pct) +
            '" data-share="' + (p.share_pct == null ? -1 : p.share_pct) + '" data-zmena="' + (p.change_30d_pp == null ? 0 : p.change_30d_pp) +
            '" data-n="' + (p.n || 0) + '"><td class="nazov">' + esc(p.name) + '</td><td class="n">' +
            (p.usage_pct == null ? '<span class="th-malo">' + esc(T.malo) + '</span>' : pct(p.usage_pct) + ' %<span class="th-bar"><i style="width:' +
              (max ? Math.round(p.usage_pct / max * 100) : 0) + '%"></i></span>') + '</td><td class="n">' +
            (p.share_pct == null ? '' : pct(p.share_pct) + ' %') + '</td><td class="n th-zmena ' + (smer > 0 ? 'hore' : smer < 0 ? 'dole' : 'nula') + '">' +
            (p.change_30d_pp == null ? '' : (hore ? '+' : '') + pct(p.change_30d_pp, 1) + ' pb') + '</td><td class="n">' +
            cislo(p.n || 0) + '</td><td class="n">' + krivka(p.series, smer) + '</td></tr>';
        }).join('');
      });
      var d = document.getElementById('th-asof');
      if (d) d.textContent = den(r.as_of);
      stat.setAttribute('data-as-of', r.as_of);
    });
  }
})();
