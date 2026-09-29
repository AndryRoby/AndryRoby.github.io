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
      slow: 'Spracovanie feedu trvá dlhšie ako obvykle. O chvíľu odošlite formulár znova a skontrolujeme stav, alebo napíšte na podpora@arling.sk.',
      ready: 'Hotovo. Chat s vaším asistentom je vpravo dole na tejto stránke (okrúhle tlačidlo). Opýtajte sa ho niečo o vašich produktoch.',
      readyAgain: 'Váš asistent už beží vpravo dole na tejto stránke (okrúhle tlačidlo). Stačí naň kliknúť.',
      failed: 'Feed sa nepodarilo spracovať. Opravte URL feedu a odošlite formulár znova, alebo napíšte na podpora@arling.sk.',
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
      feedNotSaved: 'Novú adresu feedu sme neuložili: tento obchod už Asistenta má a feed z inej adresy mu takto zmeniť nevieme. Ak je obchod váš, napíšte na podpora@arling.sk.',
      domainTaken: 'Tento obchod už má Asistenta, založeného s inou e-mailovou adresou. Pripojiť ho alebo zmeniť feed môže len majiteľ tej adresy: zadá ju do formulára a potvrdí ju kódom, ktorý mu na ňu pošleme. Ak je obchod váš a adresu nepoznáte, napíšte na podpora@arling.sk.',
    },
    en: {
      slow: 'Processing your feed is taking longer than usual. Submit the form again in a moment and we will check the status, or write to support@arling.sk.',
      ready: 'Done. Your assistant is in the bottom right corner of this page (the round button). Ask it something about your products.',
      readyAgain: 'Your assistant is already running in the bottom right corner of this page (the round button). Just click it.',
      failed: 'We could not process the feed. Correct the feed URL and submit the form again, or write to support@arling.sk.',
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
      feedNotSaved: 'We did not save the new feed URL: this shop already has an assistant and we cannot switch it to a feed from another address this way. If the shop is yours, write to support@arling.sk.',
      domainTaken: 'This shop already has an assistant, set up with a different e-mail address. Only the owner of that address can connect it or change the feed: they enter it in this form and confirm it with the code we send there. If the shop is yours and you do not know the address, write to support@arling.sk.',
    },
    de: {
      slow: 'Die Verarbeitung des Feeds dauert länger als üblich. Senden Sie das Formular gleich erneut ab, dann prüfen wir den Stand, oder schreiben Sie an support@arling.sk.',
      ready: 'Fertig. Ihr Assistent ist unten rechts auf dieser Seite (der runde Knopf). Fragen Sie ihn etwas zu Ihren Produkten.',
      readyAgain: 'Ihr Assistent läuft bereits unten rechts auf dieser Seite (der runde Knopf). Einfach anklicken.',
      failed: 'Der Feed konnte nicht verarbeitet werden. Korrigieren Sie die Feed-URL und senden Sie das Formular erneut ab, oder schreiben Sie an support@arling.sk.',
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
      feedNotSaved: 'Die neue Feed-URL haben wir nicht gespeichert: Dieser Shop hat bereits einen Assistenten, und auf einen Feed von einer anderen Adresse können wir ihn so nicht umstellen. Wenn der Shop Ihnen gehört, schreiben Sie an support@arling.sk.',
      domainTaken: 'Für diesen Shop gibt es bereits einen Assistenten, eingerichtet mit einer anderen E-Mail-Adresse. Verbinden oder den Feed ändern kann nur der Inhaber dieser Adresse: Er gibt sie in dieses Formular ein und bestätigt sie mit dem Code, den wir dorthin senden. Wenn der Shop Ihnen gehört und Sie die Adresse nicht kennen, schreiben Sie an support@arling.sk.',
    },
  };
  function T(key) {
    var d = STATUS_TEXT[PAGE_LANG] || STATUS_TEXT.en;
    return d[key] || STATUS_TEXT.en[key];
  }

  // 400 feed_other_domain (worker onboarding.js, druhé kolo bezpečnostnej kontroly 29. 9. 2026):
  // adresa feedu musí byť na doméne obchodu alebo jej subdoméne. Formulár berie doménu z adresy
  // feedu, takže sem príde len adresa na spoločnej doméne platformy (napríklad myshopify.com,
  // github.io) alebo bez bodky. Veta patrí poľu URL feedu, v jazyku stránky (sk, cs, en, de).
  var FEED_INA_DOMENA = {
    sk: 'Adresa feedu musí byť na vlastnej doméne obchodu, napríklad https://vasobchod.sk/feed.xml. Adresa na spoločnej doméne platformy (napríklad myshopify.com alebo github.io) nestačí, lebo pod ňou majú weby rôzni majitelia. Ak váš feed vytvára iná služba, napíšte na podpora@arling.sk.',
    cs: 'Adresa feedu musí být na vlastní doméně obchodu, například https://vasobchod.cz/feed.xml. Adresa na společné doméně platformy (například myshopify.com nebo github.io) nestačí, protože pod ní mají weby různí majitelé. Pokud váš feed vytváří jiná služba, napište na podpora@arling.sk.',
    en: 'The feed URL must be on the shop\'s own domain, for example https://yourshop.com/feed.xml. An address on a platform\'s shared domain (such as myshopify.com or github.io) is not enough, because websites under it belong to different owners. If another service creates your feed, write to support@arling.sk.',
    de: 'Die Feed-URL muss auf der eigenen Domain des Shops liegen, zum Beispiel https://ihrshop.de/feed.xml. Eine Adresse auf der gemeinsamen Domain einer Plattform (etwa myshopify.com oder github.io) reicht nicht, weil Websites darunter verschiedenen Inhabern gehören. Wenn ein anderer Dienst Ihren Feed erstellt, schreiben Sie an support@arling.sk.',
  };

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
    sk: {
      invalid_json: 'Neplatná požiadavka (poškodené dáta formulára).',
      validation_failed: 'Skontrolujte polia formulára.',
      origin_not_allowed: 'Táto stránka nemá povolený prístup k API (CORS).',
      rate_limited: 'Príliš veľa požiadaviek naraz. Skúste to o chvíľu.',
      payload_too_large: 'Požiadavka je príliš veľká.',
      quota_exceeded: 'Dnešný limit skúšobných účtov bol dosiahnutý.',
      internal_error: 'Nastala chyba na strane servera.',
      domain_taken: STATUS_TEXT.sk.domainTaken,
      feed_other_domain: FEED_INA_DOMENA.sk,
    },
    en: {
      invalid_json: 'Invalid request (the form data is damaged).',
      validation_failed: 'Check the form fields.',
      origin_not_allowed: 'This page is not allowed to use the API (CORS).',
      rate_limited: 'Too many requests at once. Try again in a moment.',
      payload_too_large: 'The request is too large.',
      quota_exceeded: 'Today\'s limit of trial accounts has been reached.',
      internal_error: 'Something went wrong on our server.',
      domain_taken: STATUS_TEXT.en.domainTaken,
      feed_other_domain: FEED_INA_DOMENA.en,
    },
    de: {
      invalid_json: 'Ungültige Anfrage (die Formulardaten sind beschädigt).',
      validation_failed: 'Prüfen Sie die Formularfelder.',
      origin_not_allowed: 'Diese Seite darf die API nicht verwenden (CORS).',
      rate_limited: 'Zu viele Anfragen auf einmal. Versuchen Sie es gleich noch einmal.',
      payload_too_large: 'Die Anfrage ist zu groß.',
      quota_exceeded: 'Das heutige Limit für Testkonten ist erreicht.',
      internal_error: 'Auf unserem Server ist ein Fehler aufgetreten.',
      domain_taken: STATUS_TEXT.de.domainTaken,
      feed_other_domain: FEED_INA_DOMENA.de,
    },
  };

  /** Turn a POST /v1/tenants error response body into a Slovak-language detail string, or null if there is nothing usable to show. */
  function describeTenantError(err) {
    if (!err) return null;
    var code = typeof err === 'string' ? err : err.error;
    if (!code) return null;
    var spravy = TENANT_ERROR_MESSAGES[pageLang()] || TENANT_ERROR_MESSAGES.en;
    var text = spravy[code] || code;
    // domain_taken a feed_other_domain: worker posiela v issues to isté vysvetlenie (pre plugin), tu je už v texte.
    var issues = code !== 'domain_taken' && code !== 'feed_other_domain' && err && Array.isArray(err.issues) && err.issues.length ? ' (' + err.issues.join(', ') + ')' : '';
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

  var feedErrorEl = document.getElementById('trial-feed-error');

  // aria-invalid len tam, kde prvok atribúty má (zjednodušené prvky v testoch hub-overenie ich nemajú)
  function nastavNeplatne(el, ano) {
    if (!el) return;
    if (ano && typeof el.setAttribute === 'function') el.setAttribute('aria-invalid', 'true');
    if (!ano && typeof el.removeAttribute === 'function') el.removeAttribute('aria-invalid');
  }
  function jeNeplatne(el) {
    return !!el && typeof el.getAttribute === 'function' && el.getAttribute('aria-invalid') === 'true';
  }

  function oznacChybuFeedu(text) {
    nastavNeplatne(feedInput, true);
    if (feedErrorEl) {
      feedErrorEl.textContent = text;
      feedErrorEl.hidden = false;
    } else {
      setStatus(text, 'error');
    }
    if (typeof feedInput.focus === 'function') feedInput.focus();
  }

  function zrusChybuFeedu() {
    nastavNeplatne(feedInput, false);
    nastavNeplatne(emailInput, false);
    if (feedErrorEl) {
      feedErrorEl.hidden = true;
      feedErrorEl.textContent = '';
    }
  }

  // Oprava poľa ruší chybový stav hneď pri písaní, nie až pri ďalšom odoslaní.
  if (typeof feedInput.addEventListener === 'function') {
    feedInput.addEventListener('input', function () {
      if (jeNeplatne(feedInput)) zrusChybuFeedu();
    });
  }
  if (typeof emailInput.addEventListener === 'function') {
    emailInput.addEventListener('input', function () {
      if (jeNeplatne(emailInput) && emailInput.checkValidity()) nastavNeplatne(emailInput, false);
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

  // Opätovné odoslanie formulára (oprava feedu, nový kód) začne nové sledovanie;
  // staré sa zastaví, aby jeho neskorá odpoveď neprepísala nový stav.
  var pollGen = 0;

  function poll(tenantId, lang, triesLeft, gen) {
    if (gen !== pollGen) return;
    if (triesLeft <= 0) {
      setStatus(T('slow'), 'warn');
      submitBtn.disabled = false;
      return;
    }
    fetch(ENDPOINT + '/v1/tenants/' + encodeURIComponent(tenantId) + '/status')
      .then(function (res) {
        if (!res.ok) throw new Error('status_failed_' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (gen !== pollGen) return;
        if (data.status === 'ready') {
          var novy = injectWidget(tenantId, lang);
          setStatus(T(novy ? 'ready' : 'readyAgain'), 'ok');
          track('trial_ready', { lang: lang });
          showEmbedCode(tenantId);
        } else if (data.status === 'error') {
          setStatus(T('failed'), 'error');
          submitBtn.disabled = false;
          nastavNeplatne(feedInput, true);
          feedInput.focus();
          track('trial_error', { lang: lang });
        } else {
          setTimeout(function () { poll(tenantId, lang, triesLeft - 1, gen); }, POLL_INTERVAL_MS);
        }
      })
      .catch(function () {
        setTimeout(function () { poll(tenantId, lang, triesLeft - 1, gen); }, POLL_INTERVAL_MS);
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

  // Id skúšok vytvorených v tomto prehliadači: živá ukážka (live/live.js) ukáže
  // taký obchod aj bez ďalšieho overenia (bezpečnostná kontrola 29. 9. 2026,
  // cudzie id z odkazu už nie). Len id, najviac SKUSKY_MAX posledných.
  var SKUSKY_KEY = 'arling_asistent_skusky';
  var SKUSKY_MAX = 10;

  function zapamatajSkusku(tenantId) {
    if (!tenantId) return;
    try {
      var zoznam = JSON.parse(window.localStorage.getItem(SKUSKY_KEY) || '[]');
      if (!Array.isArray(zoznam)) zoznam = [];
      zoznam = zoznam.filter(function (x) { return x !== tenantId; });
      zoznam.push(String(tenantId));
      window.localStorage.setItem(SKUSKY_KEY, JSON.stringify(zoznam.slice(-SKUSKY_MAX)));
    } catch (e) { /* súkromné okno: ukážka potom len pre obchody, ktoré to dovolia */ }
  }

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

  // Pole na kód patrí jednému odoslaniu formulára (gen). Oneskorená odpoveď staršieho pokusu
  // nesmie zmeniť nové pole, jeho hlásenie ani ovládanie (brána 29. 9., pokus 2, nález 2).
  function jeAktualne(gen, box) { return gen === pollGen && (box === undefined || box === verifyBox); }

  function zobrazOverenie(tenantId, email, lang, gen) {
    odstranOverenie();
    verifyBox = document.createElement('div');
    var box = verifyBox;
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
      var sprava = function (text, tone) { if (jeAktualne(gen, box)) overenieSprava(text, tone); };
      fetch(ENDPOINT + '/v1/ucet/over', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, kod: kod }),
      })
        .then(function (res) { return res.json().then(function (body) { return { ok: res.ok, body: body }; }); })
        .then(function (r) {
          if (!jeAktualne(gen, box)) return null;
          if (!r.ok || !r.body || !r.body.token) {
            var chyba = r.body && r.body.error;
            var vyprsal = chyba === 'no_code' || (chyba === 'bad_code' && r.body.remaining === 0);
            sprava(T(vyprsal ? 'verifyExpired' : 'verifyBad'), 'error');
            if (vyprsal) submitBtn.disabled = false; // nový kód príde po opätovnom odoslaní formulára
            btn.disabled = false;
            return null;
          }
          ulozToken(email, r.body.token);
          return potvrdVerejne(tenantId, email, r.body.token).then(function (ok) {
            if (!jeAktualne(gen, box)) return;
            if (ok) {
              f.hidden = true;
              sprava(T('verifyOk'), 'ok');
              track('trial_verified', { lang: lang });
            } else {
              sprava(T('verifyFailed'), 'warn');
              btn.disabled = false;
            }
          });
        })
        .catch(function () {
          if (!jeAktualne(gen, box)) return;
          sprava(T('verifyFailed'), 'warn');
          btn.disabled = false;
        });
    });
  }

  /** Po vytvorení účtu: ak worker adresu už overil (platný uložený token), nič; inak pošle kód a ukáže pole na jeho zadanie. */
  function overAdresu(tenantId, email, lang, uzOvereny, gen) {
    if (uzOvereny) return;
    fetch(ENDPOINT + '/v1/ucet/kod', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, jazyk: lang }),
    })
      .then(function (res) {
        if (!jeAktualne(gen)) return;
        if (!res.ok) throw new Error('kod_' + res.status);
        zobrazOverenie(tenantId, email, lang, gen);
        track('trial_code_sent', { lang: lang });
      })
      .catch(function () {
        if (!jeAktualne(gen)) return;
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

    zrusChybuFeedu();
    if (!feedInput.checkValidity()) { nastavNeplatne(feedInput, true); feedInput.reportValidity(); return; }
    if (!emailInput.checkValidity()) { nastavNeplatne(emailInput, true); emailInput.reportValidity(); return; }
    if (!domain) {
      // Chyba patrí poľu: text pod formulárom je cez aria-describedby prepojený s poľom URL,
      // pole má aria-invalid a dostane fokus (Z-36 pokus 3, brána Astry 2, nález 6).
      // jazyk podľa aktuálneho <html lang> (prepínač SK/EN mení jazyk bez načítania stránky)
      oznacChybuFeedu((STATUS_TEXT[pageLang()] || {}).badUrl || T('badUrl'));
      return;
    }

    submitBtn.disabled = true;
    var gen = ++pollGen;
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
        if (!jeAktualne(gen)) return;
        zapamatajSkusku(tenant.id);
        // Uložený token mohol medzitým prestať platiť (odhlásenie všade): worker
        // vtedy vráti overeny: false a pýtame kód znova.
        if (token && tenant.overeny !== true) zabudniToken();
        if (tenant.feed_treba_overit) {
          // Nový feed sa neuložil (worker onboarding.js, druhé kolo kontroly 29. 9. 2026:
          // feed na doméne obchodu sa ukladá bez kódu, toto príde len pre feed z iného
          // servera a ten nepomôže uložiť ani kód). Stav sa nesleduje, inak by „Asistent
          // už beží“ zakrylo, že nový feed uložený nie je; kód sa nepýta, nič by nezmenil.
          setStatus(T('feedNotSaved'), 'warn');
          submitBtn.disabled = false;
          track('trial_feed_not_saved', { lang: lang });
          return;
        }
        poll(tenant.id, lang, POLL_MAX_TRIES, gen);
        overAdresu(tenant.id, emailNorm, lang, tenant.overeny === true, gen);
      })
      .catch(function (err) {
        if (!jeAktualne(gen)) return;
        if (err && err.error === 'domain_taken') {
          // Doménu má obchod s iným e-mailom: celá veta s ďalším krokom, bez predpony o skúšobnom účte.
          setStatus(T('domainTaken'), 'error');
          submitBtn.disabled = false;
          track('trial_domain_taken', { lang: lang });
          return;
        }
        if (err && err.error === 'feed_other_domain') {
          // Chyba patrí poľu URL feedu (ako zlá adresa): veta v jazyku stránky, pole označené, bez sledovania stavu.
          setStatus('', '');
          oznacChybuFeedu(FEED_INA_DOMENA[pageLang()] || FEED_INA_DOMENA.en);
          submitBtn.disabled = false;
          track('trial_feed_other_domain', { lang: lang });
          return;
        }
        var detail = describeTenantError(err);
        var message = detail
          ? T('createFailed') + detail
          : T('createFailedNet');
        setStatus(message, 'error');
        submitBtn.disabled = false;
      });
  });
})();
