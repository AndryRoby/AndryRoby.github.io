/*
 * app.js
 *
 * Wires the "try it now" form on the ARLing Shopping Assistant demo page: submits the
 * visitor's own feed URL + e-mail to the worker's POST /v1/tenants, polls
 * GET /v1/tenants/:id/status until ingestion finishes, then injects the
 * real widget/widget.js <script> tag on this same page pointed at the new
 * tenant, so the visitor can chat with their own shop's assistant without
 * leaving arling.sk. No build step, no inline <script> (see the CSP meta
 * tag in index.html), no dependencies.
 *
 * The worker runs at the default ENDPOINT below. For local testing against
 * `wrangler dev`, append ?endpoint=http://localhost:8787 to this page's URL
 * (and temporarily add that origin to the CSP meta's connect-src).
 *
 * Paid plans are not bought from this page: the Stripe Payment Link needs
 * the tenant id in client_reference_id, so the "Your embed code" block links
 * to the per-tenant page (demo/tenant/, served at arling.sk/asistent/tenant/
 * ?t=ID) where the usage bar and the two upgrade buttons live. The pricing
 * table buttons here all start the free trial.
 */
(function () {
  'use strict';

  // Base URL of this script (arling.sk/asistent/). The page lives at /asistent/, /asistent/en/ and
  // /asistent/de/ but loads this one file, so widget.js and tenant/ are resolved against the script,
  // never against the page: on 25 Sep 2026 a relative './widget.js' was a 404 on /asistent/en/ and the
  // first real shop could not see its own trial chat.
  var SCRIPT_BASE = new URL('.', (document.currentScript && document.currentScript.src) || window.location.href).href;
  var PAGE_LANG = ((document.documentElement.getAttribute('lang') || 'sk').slice(0, 2)).toLowerCase();
  var STATUS_TEXT = {
    sk: {
      slow: 'Spracovanie feedu trvá dlhšie ako obvykle. Skúste obnoviť stránku o chvíľu, alebo napíšte na podpora@arling.sk.',
      ready: 'Hotovo. Chat s vaším asistentom je vpravo dole na tejto stránke (okrúhle tlačidlo). Opýtajte sa ho niečo o vašich produktoch.',
      readyAgain: 'Váš asistent už beží vpravo dole na tejto stránke (okrúhle tlačidlo). Stačí naň kliknúť.',
      failed: 'Feed sa nepodarilo spracovať. Skontrolujte URL feedu, alebo napíšte na podpora@arling.sk.',
      badUrl: 'URL feedu musí byť platná adresa (https://vaseshop.sk/feed.xml).',
      working: 'Sťahujeme a spracúvame váš feed produktov...',
      createFailed: 'Nepodarilo sa vytvoriť skúšobný účet: ',
      createFailedNet: 'Nepodarilo sa vytvoriť skúšobný účet. Skontrolujte internetové pripojenie a skúste znova.',
      verifyIntro: 'Na {email} sme poslali 6-miestny kód. Zadajte ho, aby sme vám mohli poslať návod na zapojenie. Bez overenia vám na túto adresu nepošleme nič.',
      verifyLabel: 'Kód z e-mailu',
      verifyButton: 'Overiť adresu',
      verifyOk: 'Adresa je overená. Návod na zapojenie vám príde e-mailom, keď budú produkty načítané.',
      verifyBad: 'Kód nesedí. Skontrolujte ho a skúste znova.',
      verifyExpired: 'Kód už neplatí. Odošlite formulár znova, pošleme nový.',
      verifyFailed: 'Adresu sa nepodarilo overiť. Asistent funguje aj tak, kód na vloženie nájdete nižšie.',
      codeFailed: 'Kód na overenie adresy sa nepodarilo poslať. Asistent funguje aj tak, kód na vloženie nájdete nižšie; ak chcete návod e-mailom, napíšte na podpora@arling.sk.',
    },
    en: {
      slow: 'Processing your feed is taking longer than usual. Reload the page in a moment, or write to support@arling.sk.',
      ready: 'Done. Your assistant is in the bottom right corner of this page (the round button). Ask it something about your products.',
      readyAgain: 'Your assistant is already running in the bottom right corner of this page (the round button). Just click it.',
      failed: 'We could not process the feed. Check the feed URL, or write to support@arling.sk.',
      badUrl: 'The feed URL must be a valid address (https://yourshop.com/feed.xml).',
      working: 'Downloading and processing your product feed...',
      createFailed: 'Could not create the trial account: ',
      createFailedNet: 'Could not create the trial account. Check your internet connection and try again.',
      verifyIntro: 'We sent a 6-digit code to {email}. Enter it so we can e-mail you the setup instructions. Without it we send nothing to this address.',
      verifyLabel: 'Code from the e-mail',
      verifyButton: 'Verify address',
      verifyOk: 'Your address is verified. The setup instructions will arrive by e-mail once the products are loaded.',
      verifyBad: 'That code does not match. Check it and try again.',
      verifyExpired: 'The code has expired. Submit the form again and we will send a new one.',
      verifyFailed: 'We could not verify the address. The assistant works anyway; the embed code is below.',
      codeFailed: 'We could not send the verification code. The assistant works anyway and the embed code is below; if you want the instructions by e-mail, write to support@arling.sk.',
    },
    de: {
      slow: 'Die Verarbeitung des Feeds dauert länger als üblich. Laden Sie die Seite gleich neu oder schreiben Sie an support@arling.sk.',
      ready: 'Fertig. Ihr Assistent ist unten rechts auf dieser Seite (der runde Knopf). Fragen Sie ihn etwas zu Ihren Produkten.',
      readyAgain: 'Ihr Assistent läuft bereits unten rechts auf dieser Seite (der runde Knopf). Einfach anklicken.',
      failed: 'Der Feed konnte nicht verarbeitet werden. Prüfen Sie die Feed-URL oder schreiben Sie an support@arling.sk.',
      badUrl: 'Die Feed-URL muss eine gültige Adresse sein (https://ihrshop.de/feed.xml).',
      working: 'Ihr Produktfeed wird geladen und verarbeitet...',
      createFailed: 'Das Testkonto konnte nicht erstellt werden: ',
      createFailedNet: 'Das Testkonto konnte nicht erstellt werden. Prüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.',
      verifyIntro: 'Wir haben einen 6-stelligen Code an {email} geschickt. Geben Sie ihn ein, damit wir Ihnen die Anleitung per E-Mail senden können. Ohne Bestätigung senden wir an diese Adresse nichts.',
      verifyLabel: 'Code aus der E-Mail',
      verifyButton: 'Adresse bestätigen',
      verifyOk: 'Ihre Adresse ist bestätigt. Die Anleitung kommt per E-Mail, sobald die Produkte geladen sind.',
      verifyBad: 'Der Code stimmt nicht. Prüfen Sie ihn und versuchen Sie es erneut.',
      verifyExpired: 'Der Code ist abgelaufen. Senden Sie das Formular erneut ab, wir schicken einen neuen.',
      verifyFailed: 'Die Adresse konnte nicht bestätigt werden. Der Assistent funktioniert trotzdem, den Einbindungscode finden Sie unten.',
      codeFailed: 'Der Bestätigungscode konnte nicht gesendet werden. Der Assistent funktioniert trotzdem, den Einbindungscode finden Sie unten; wenn Sie die Anleitung per E-Mail möchten, schreiben Sie an support@arling.sk.',
    },
  };
  function T(key) {
    var d = STATUS_TEXT[PAGE_LANG] || STATUS_TEXT.en;
    return d[key] || STATUS_TEXT.en[key];
  }

  var DEFAULT_ENDPOINT = 'https://arling-asistent.arling.workers.dev';
  var ENDPOINT = (new URLSearchParams(window.location.search).get('endpoint') || DEFAULT_ENDPOINT).replace(/\/$/, '');
  var POLL_INTERVAL_MS = 3000;
  var POLL_MAX_TRIES = 40; // ~2 minutes

  // Slovak text for every error code POST /v1/tenants can return (see
  // worker/src/index.js and worker/src/onboarding.js), so a rejected trial
  // signup tells the visitor (or Andrej, debugging live) what actually went
  // wrong instead of always showing the same generic "check the fields"
  // text regardless of cause.
  var TENANT_ERROR_MESSAGES = {
    invalid_json: 'Neplatná požiadavka (poškodené dáta formulára).',
    validation_failed: 'Skontrolujte polia formulára.',
    origin_not_allowed: 'Táto stránka nemá povolený prístup k API (CORS).',
    rate_limited: 'Príliš veľa požiadaviek naraz. Skúste to o chvíľu.',
    payload_too_large: 'Požiadavka je príliš veľká.',
    quota_exceeded: 'Dnešný limit skúšobných účtov bol dosiahnutý.',
    internal_error: 'Nastala chyba na strane servera.',
  };

  /** Turn a POST /v1/tenants error response body into a Slovak-language detail string, or null if there is nothing usable to show. */
  function describeTenantError(err) {
    if (!err) return null;
    var code = typeof err === 'string' ? err : err.error;
    if (!code) return null;
    var text = TENANT_ERROR_MESSAGES[code] || code;
    var issues = err && Array.isArray(err.issues) && err.issues.length ? ' (' + err.issues.join(', ') + ')' : '';
    return text + issues;
  }

  var form = document.getElementById('trial-form');
  if (!form) return;

  var feedInput = document.getElementById('trial-feed-url');
  var emailInput = document.getElementById('trial-email');
  var langSelect = document.getElementById('trial-lang');
  var submitBtn = document.getElementById('trial-submit');
  var statusEl = document.getElementById('trial-status');
  var widgetMount = document.getElementById('trial-widget-note');

  // Jazyk Asistenta a našich e-mailov. Predvolený je jazyk stránky (en/ -> en,
  // koreň -> sk), nie prvá možnosť zoznamu: do 25. 9. 2026 mala aj anglická
  // stránka predvolenú slovenčinu a worker jazyk vôbec nedostal. Kým ho
  // návštevník sám nezmení, drží sa jazyka stránky aj po prepnutí jazyka.
  var JAZYKY = ['sk', 'cs', 'en', 'de'];
  var langTouched = false;
  function pageLang() {
    var l = String(document.documentElement.getAttribute('lang') || 'sk').slice(0, 2).toLowerCase();
    return JAZYKY.indexOf(l) >= 0 ? l : 'en';
  }
  if (langSelect) {
    langSelect.value = pageLang();
    langSelect.addEventListener('change', function () { langTouched = true; });
  }

  // ── ?feed= prefill: handoff from Product Feed Doctor ─────────────────
  // arling.sk/feed-doctor/ links here as ?feed=<encoded url>#playground
  // after analysing a feed fetched from a URL. Fill the feed URL field,
  // bring the form into view and put the cursor in the e-mail field. The
  // form is never submitted on the visitor's behalf; only http(s) URLs are
  // accepted and anything else is ignored.
  function feedUrlFromQueryString(search) {
    var raw = '';
    try {
      raw = (new URLSearchParams(search || '').get('feed') || '').trim();
    } catch (e) {
      return '';
    }
    if (!raw) return '';
    try {
      var parsed = new URL(raw);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
      return parsed.href;
    } catch (e) {
      return '';
    }
  }

  var prefillFeedUrl = feedUrlFromQueryString(window.location.search);
  if (prefillFeedUrl && feedInput) {
    feedInput.value = prefillFeedUrl;
    track('feed_prefill');
    var revealPrefill = function () {
      try {
        feedInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (emailInput) emailInput.focus({ preventScroll: true });
      } catch (e) {
        /* scrolling is a convenience only */
      }
    };
    if (document.readyState === 'complete') revealPrefill();
    else window.addEventListener('load', revealPrefill);
  }

  // ── "Your embed code" block ──────────────────────────────────────────
  // Shown once the trial tenant is ready (see poll() below): the tenant id
  // (for reference / support) and the real <script> snippet a visitor
  // pastes into their own theme, each with its own Copy button. The
  // widget.js origin here is always the production one, independent of the
  // ?endpoint= override used to test this demo page itself against
  // `wrangler dev` (see the file header comment).
  var WIDGET_SCRIPT_ORIGIN = 'https://arling-asistent.arling.workers.dev';
  var embedBlock = document.getElementById('trial-embed');
  var embedIdInput = document.getElementById('trial-embed-id');
  var embedSnippetPre = document.getElementById('trial-embed-snippet');
  var embedCopyIdBtn = document.getElementById('trial-embed-copy-id');
  var embedCopySnippetBtn = document.getElementById('trial-embed-copy-snippet');
  var tenantLink = document.getElementById('trial-tenant-link');
  var TENANT_PAGE_DISPLAY = 'arling.sk/asistent/tenant/?t=';

  /** Relative link to the per-tenant usage/upgrade page for this tenant (works on GitHub Pages and locally). */
  function tenantPageHrefFor(tenantId) {
    return new URL('tenant/?t=' + encodeURIComponent(tenantId), SCRIPT_BASE).href;
  }

  function embedSnippetFor(tenantId) {
    return '<script src="' + WIDGET_SCRIPT_ORIGIN + '/widget.js" data-tenant="' + tenantId + '" data-lang="auto" defer></script>';
  }

  function showEmbedCode(tenantId) {
    if (!embedBlock) return;
    if (embedIdInput) embedIdInput.value = tenantId;
    if (embedSnippetPre) embedSnippetPre.textContent = embedSnippetFor(tenantId);
    if (tenantLink) {
      tenantLink.setAttribute('href', tenantPageHrefFor(tenantId));
      tenantLink.textContent = TENANT_PAGE_DISPLAY + tenantId;
    }
    embedBlock.hidden = false;
  }

  function copyLabel() {
    return (window.ASISTENT_I18N && typeof window.ASISTENT_I18N.t === 'function') ? window.ASISTENT_I18N.t('s3.embed.copy') : 'Kopírovať';
  }

  function copiedLabel() {
    return (window.ASISTENT_I18N && typeof window.ASISTENT_I18N.t === 'function') ? window.ASISTENT_I18N.t('s3.embed.copied') : 'Skopírované';
  }

  /** Copies `text` to the clipboard and flashes the triggering button's label to "Copied" for 1.5s. */
  function copyToClipboard(text, btn) {
    function flash(ok) {
      if (!btn) return;
      btn.textContent = ok ? copiedLabel() : copyLabel();
      setTimeout(function () { btn.textContent = copyLabel(); }, 1500);
    }
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text).then(function () { flash(true); }, function () { flash(false); });
      return;
    }
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      flash(true);
    } catch (e) {
      flash(false);
    }
  }

  if (embedCopyIdBtn) {
    embedCopyIdBtn.addEventListener('click', function () {
      copyToClipboard(embedIdInput ? embedIdInput.value : '', embedCopyIdBtn);
    });
  }
  if (embedCopySnippetBtn) {
    embedCopySnippetBtn.addEventListener('click', function () {
      copyToClipboard(embedSnippetPre ? embedSnippetPre.textContent : '', embedCopySnippetBtn);
    });
  }

  function setStatus(text, tone) {
    statusEl.textContent = text;
    statusEl.className = 'trial-status' + (tone ? ' trial-status-' + tone : '');
    statusEl.hidden = !text;
  }

  function track(event, data) {
    try {
      if (window.umami && typeof window.umami.track === 'function') window.umami.track(event, data || {});
    } catch (e) {
      /* analytics must never break the demo */
    }
  }

  function domainFromFeedUrl(feedUrl) {
    try {
      return new URL(feedUrl).hostname;
    } catch (e) {
      return '';
    }
  }

  function injectWidget(tenantId, lang) {
    if (window.__arlingAsistentInit) return false; // already injected once on this page
    var script = document.createElement('script');
    script.src = new URL('widget.js', SCRIPT_BASE).href;
    script.setAttribute('data-tenant', tenantId);
    script.setAttribute('data-lang', lang || 'sk');
    script.setAttribute('data-color', 'auto');
    script.setAttribute('data-endpoint', ENDPOINT);
    script.defer = true;
    document.body.appendChild(script);
    if (widgetMount) widgetMount.hidden = false;
    return true;
  }

  function poll(tenantId, lang, triesLeft) {
    if (triesLeft <= 0) {
      setStatus(T('slow'), 'warn');
      return;
    }
    fetch(ENDPOINT + '/v1/tenants/' + encodeURIComponent(tenantId) + '/status')
      .then(function (res) {
        if (!res.ok) throw new Error('status_failed_' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (data.status === 'ready') {
          var novy = injectWidget(tenantId, lang);
          setStatus(T(novy ? 'ready' : 'readyAgain'), 'ok');
          track('trial_ready', { lang: lang });
          showEmbedCode(tenantId);
        } else if (data.status === 'error') {
          setStatus(T('failed'), 'error');
          track('trial_error', { lang: lang });
        } else {
          setTimeout(function () { poll(tenantId, lang, triesLeft - 1); }, POLL_INTERVAL_MS);
        }
      })
      .catch(function () {
        setTimeout(function () { poll(tenantId, lang, triesLeft - 1); }, POLL_INTERVAL_MS);
      });
  }

  // ── Overenie e-mailovej adresy 6-miestnym kódom ──────────────────────
  // Worker pošle automatický e-mail (návod, chyba katalógu) len adrese, ktorú
  // majiteľ potvrdil kódom (products/arling-asistent/worker/src/zivotny-cyklus.js,
  // adverzárna kontrola 25. 9. 2026: formulár dovolil zadať cudziu adresu).
  // Kód posiela tá istá cesta ako prihlásenie na arling.sk/ucet (POST
  // /v1/ucet/kod a /v1/ucet/over). Token sa pamätá len v tomto prehliadači,
  // aby ďalší obchod s tou istou adresou nepýtal kód znova. Chat na tejto
  // stránke funguje aj bez overenia.
  var TOKEN_KEY = 'arling_asistent_overenie';

  function ulozenyToken(email) {
    try {
      var z = JSON.parse(window.localStorage.getItem(TOKEN_KEY) || 'null');
      return z && z.email === email && z.token ? z.token : '';
    } catch (e) {
      return '';
    }
  }

  function ulozToken(email, token) {
    try { window.localStorage.setItem(TOKEN_KEY, JSON.stringify({ email: email, token: token })); } catch (e) { /* súkromné okno */ }
  }

  function zabudniToken() {
    try { window.localStorage.removeItem(TOKEN_KEY); } catch (e) { /* nič */ }
  }

  var verifyBox = null;

  function odstranOverenie() {
    if (verifyBox && verifyBox.parentNode) verifyBox.parentNode.removeChild(verifyBox);
    verifyBox = null;
  }

  function overenieSprava(text, tone) {
    if (!verifyBox) return;
    var p = verifyBox.querySelector('.trial-verify-msg');
    p.textContent = text;
    p.className = 'trial-verify-msg trial-status' + (tone ? ' trial-status-' + tone : '');
    p.hidden = !text;
  }

  function potvrdVerejne(tenantId, email, token) {
    return fetch(ENDPOINT + '/v1/tenants/' + encodeURIComponent(tenantId) + '/overenie', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token },
    }).then(function (res) {
      if (res.status === 401) zabudniToken();
      return res.ok;
    });
  }

  function zobrazOverenie(tenantId, email, lang) {
    odstranOverenie();
    verifyBox = document.createElement('div');
    verifyBox.className = 'trial-verify';
    var intro = document.createElement('p');
    intro.textContent = T('verifyIntro').replace('{email}', email);
    var f = document.createElement('form');
    f.setAttribute('novalidate', '');
    f.className = 'trial-verify-form';
    var wrap = document.createElement('div');
    wrap.className = 'field';
    var label = document.createElement('label');
    label.setAttribute('for', 'trial-verify-code');
    label.textContent = T('verifyLabel');
    var input = document.createElement('input');
    input.id = 'trial-verify-code';
    input.type = 'text';
    input.inputMode = 'numeric';
    input.autocomplete = 'one-time-code';
    input.pattern = '[0-9]{6}';
    input.maxLength = 6;
    input.required = true;
    wrap.appendChild(label);
    wrap.appendChild(input);
    var btn = document.createElement('button');
    btn.type = 'submit';
    btn.className = 'btn btn-solid';
    btn.textContent = T('verifyButton');
    f.appendChild(wrap);
    f.appendChild(btn);
    var msg = document.createElement('p');
    msg.className = 'trial-verify-msg';
    msg.setAttribute('role', 'status');
    msg.hidden = true;
    verifyBox.appendChild(intro);
    verifyBox.appendChild(f);
    verifyBox.appendChild(msg);
    statusEl.parentNode.insertBefore(verifyBox, statusEl.nextSibling);

    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var kod = input.value.replace(/\D/g, '');
      if (kod.length !== 6) { input.focus(); return; }
      btn.disabled = true;
      fetch(ENDPOINT + '/v1/ucet/over', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, kod: kod }),
      })
        .then(function (res) { return res.json().then(function (body) { return { ok: res.ok, body: body }; }); })
        .then(function (r) {
          if (!r.ok || !r.body || !r.body.token) {
            var chyba = r.body && r.body.error;
            overenieSprava(T(chyba === 'no_code' || (chyba === 'bad_code' && r.body.remaining === 0) ? 'verifyExpired' : 'verifyBad'), 'error');
            btn.disabled = false;
            return null;
          }
          ulozToken(email, r.body.token);
          return potvrdVerejne(tenantId, email, r.body.token).then(function (ok) {
            if (ok) {
              f.hidden = true;
              overenieSprava(T('verifyOk'), 'ok');
              track('trial_verified', { lang: lang });
            } else {
              overenieSprava(T('verifyFailed'), 'warn');
              btn.disabled = false;
            }
          });
        })
        .catch(function () {
          overenieSprava(T('verifyFailed'), 'warn');
          btn.disabled = false;
        });
    });
  }

  /** Po vytvorení účtu: ak worker adresu už overil (platný uložený token), nič; inak pošle kód a ukáže pole na jeho zadanie. */
  function overAdresu(tenantId, email, lang, uzOvereny) {
    if (uzOvereny) return;
    fetch(ENDPOINT + '/v1/ucet/kod', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, jazyk: lang }),
    })
      .then(function (res) {
        if (!res.ok) throw new Error('kod_' + res.status);
        zobrazOverenie(tenantId, email, lang);
        track('trial_code_sent', { lang: lang });
      })
      .catch(function () {
        odstranOverenie();
        verifyBox = document.createElement('div');
        verifyBox.className = 'trial-verify';
        var msg = document.createElement('p');
        msg.className = 'trial-verify-msg';
        msg.setAttribute('role', 'status');
        verifyBox.appendChild(msg);
        statusEl.parentNode.insertBefore(verifyBox, statusEl.nextSibling);
        overenieSprava(T('codeFailed'), 'warn');
      });
  }

  form.addEventListener('submit', function (evt) {
    evt.preventDefault();

    var feedUrl = feedInput.value.trim();
    var email = emailInput.value.trim();
    if (langSelect && !langTouched) langSelect.value = pageLang();
    var lang = langSelect ? langSelect.value : pageLang();
    var domain = domainFromFeedUrl(feedUrl);

    if (!feedInput.checkValidity()) { feedInput.reportValidity(); return; }
    if (!emailInput.checkValidity()) { emailInput.reportValidity(); return; }
    if (!domain) {
      setStatus(T('badUrl'), 'error');
      return;
    }

    submitBtn.disabled = true;
    setStatus(T('working'), 'pending');
    track('trial_start', { lang: lang });
    odstranOverenie();

    var emailNorm = email.toLowerCase();
    var token = ulozenyToken(emailNorm);
    var hlavicky = { 'Content-Type': 'application/json' };
    if (token) hlavicky.Authorization = 'Bearer ' + token;

    fetch(ENDPOINT + '/v1/tenants', {
      method: 'POST',
      headers: hlavicky,
      // lang: jazyk e-mailov od ARLingu, zdroj: odkiaľ účet vznikol
      // (worker/src/zivotny-cyklus.js v products/arling-asistent).
      body: JSON.stringify({ feed_url: feedUrl, domain: domain, email: email, lang: lang, zdroj: 'formular' }),
    })
      .then(function (res) {
        if (!res.ok) return res.json().then(function (body) { throw body; });
        return res.json();
      })
      .then(function (tenant) {
        poll(tenant.id, lang, POLL_MAX_TRIES);
        // Uložený token mohol medzitým prestať platiť (odhlásenie všade): worker
        // vtedy vráti overeny: false a pýtame kód znova.
        if (token && tenant.overeny !== true) zabudniToken();
        overAdresu(tenant.id, emailNorm, lang, tenant.overeny === true);
      })
      .catch(function (err) {
        var detail = describeTenantError(err);
        var message = detail
          ? T('createFailed') + detail
          : T('createFailedNet');
        setStatus(message, 'error');
        submitBtn.disabled = false;
      });
  });
})();
