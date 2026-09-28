/* ARLing TikTok Publisher (arling.sk/social/tiktok/).
   Stranka nedrzi ziadne tajomstvo: client_key je verejny (config.json), vsetko s client_secret
   alebo tokenom robi sluzba products/tiktok-service na homelabe. Pravidla:
   Login Kit for Web:   https://developers.tiktok.com/doc/login-kit-web
   Direct Post UX:      https://developers.tiktok.com/doc/content-sharing-guidelines
   Direct Post API:     https://developers.tiktok.com/doc/content-posting-api-reference-direct-post
   Inbox upload:        https://developers.tiktok.com/doc/content-posting-api-reference-upload-video
   PKCE sa nerobi: code_verifier je podla oauth-user-access-token-management
   "Required for mobile and desktop app only". */
(function () {
  'use strict';

  var AUTH_URL = 'https://www.tiktok.com/v2/auth/authorize/';
  var MUSIC_URL = 'https://www.tiktok.com/legal/page/global/music-usage-confirmation/en';
  var BRANDED_URL = 'https://www.tiktok.com/legal/page/global/bc-policy/en';
  var PLACEHOLDER = 'PASTE_TIKTOK_CLIENT_KEY_HERE';
  var STATE_MAX_MS = 10 * 60 * 1000;
  var PRIVACY_LABEL = {
    PUBLIC_TO_EVERYONE: 'Everyone',
    MUTUAL_FOLLOW_FRIENDS: 'Friends',
    FOLLOWER_OF_CREATOR: 'Followers',
    SELF_ONLY: 'Only me'
  };
  var PRIVATE_BRANDED = 'Branded content visibility cannot be set to private.';
  var ERR = {
    config: 'This page is not set up yet: the TikTok client key is missing in config.json.',
    operator_key_missing: 'Enter the operator key first.',
    operator_token_invalid: 'The operator key is not correct.',
    operator_token_not_configured: 'The ARLing server has no operator key set, so nothing can be connected or posted.',
    rate_limited: 'Too many wrong keys. Wait a minute and try again.',
    network: 'The ARLing server did not answer. Try again in a moment.',
    not_connected: 'TikTok is not connected. Use Connect TikTok.',
    state_mismatch: 'The answer from TikTok does not belong to this browser tab, so it was ignored. Nothing was saved. Use Connect TikTok again.',
    service_not_configured: 'The ARLing server is missing the TikTok app keys.',
    invalid_grant: 'TikTok did not accept the sign in code. Use Connect TikTok again.',
    access_token_invalid: 'The TikTok sign in has expired. Use Connect TikTok again.',
    scope_not_authorized: 'TikTok did not grant the permission this needs. Connect TikTok again and allow all permissions.',
    spam_risk_too_many_posts: 'This account has reached its posting limit for now. Try again later.',
    spam_risk_user_banned_from_posting: 'TikTok does not allow this account to post right now.',
    reached_active_user_cap: 'This app has reached its daily limit on TikTok. Try again tomorrow.',
    unaudited_client_can_only_post_to_private_accounts: 'Until TikTok reviews this app, it can only post to a private TikTok account. Switch the account to private in TikTok settings and choose Only me.',
    privacy_level_option_mismatch: 'This privacy option is not available for the account. Choose again.',
    cannot_post_now: 'This account cannot post right now. Try again later.',
    title_required: 'Write a title.',
    title_too_long: 'The title is longer than 2200 characters.',
    privacy_level_required: 'Choose who can view this video.',
    disclosure_choice_required: 'You need to indicate if your content promotes yourself, a third party, or both.',
    branded_content_cannot_be_private: PRIVATE_BRANDED,
    video_too_long: 'The video is longer than this account may post.',
    consent_required: 'Click the post button to agree and post.',
    unknown_video: 'That video is not in the server folder any more. Reload the page.',
    video_too_big: 'The video is too big for TikTok.',
    unexpected_init_response: 'TikTok answered in an unexpected way. Nothing was uploaded.',
    upload_failed: 'Uploading the file to TikTok failed.'
  };

  var cfg = null;
  var me = null;
  var creator = null;
  var videos = [];
  var duration = { d: null, i: null };
  var objectUrl = { d: null, i: null };
  var busy = { d: false, i: false };

  function $(id) { return document.getElementById(id); }
  function ss() { try { return window.sessionStorage; } catch (e) { return null; } }
  function sget(k) { try { var s = ss(); return s ? s.getItem(k) : null; } catch (e) { return null; } }
  function sset(k, v) { try { var s = ss(); if (s) s.setItem(k, v); } catch (e) { /* bez ulozenia */ } }
  function sdel(k) { try { var s = ss(); if (s) s.removeItem(k); } catch (e) { /* nic */ } }
  function text(code) { return ERR[code] || ('Something went wrong (' + code + ').'); }
  function chyba(code) { var e = new Error(code); e.code = code; return e; }

  function say(id, message, kind) {
    var el = $(id);
    el.textContent = message || '';
    if (kind) el.setAttribute('data-kind', kind); else el.removeAttribute('data-kind');
    el.hidden = !message;
  }

  function b64url(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function randomState() {
    var b = new Uint8Array(32);
    window.crypto.getRandomValues(b);
    return b64url(b);
  }

  function mb(bytes) { return (bytes / 1048576).toFixed(1) + ' MB'; }

  function api(method, path, body) {
    var key = sget('tt_op');
    if (!key) return Promise.reject(chyba('operator_key_missing'));
    var opts = { method: method, headers: { 'X-Operator-Token': key }, credentials: 'omit', cache: 'no-store' };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    return fetch(cfg.api_base + path, opts).catch(function () { throw chyba('network'); }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (!r.ok || data.ok === false) throw chyba(data.error || ('http_' + r.status));
        return data;
      });
    });
  }

  /* ------------------------------------------------------------ operator key */

  function renderKey() {
    var has = !!sget('tt_op');
    $('op-stav').textContent = has ? 'Key saved in this tab. It is forgotten when you close the tab.' : 'No key in this tab yet.';
    $('op-zabudni').hidden = !has;
  }

  $('op-uloz').addEventListener('click', function () {
    var v = $('op').value.trim();
    if (!v) { $('op').focus(); return; }
    sset('tt_op', v);
    $('op').value = '';
    renderKey();
    loadMe();
  });
  $('op').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('op-uloz').click(); });
  $('op-zabudni').addEventListener('click', function () {
    sdel('tt_op');
    renderKey();
    showDisconnected();
  });

  /* ------------------------------------------------------------ Login Kit */

  $('pripoj').addEventListener('click', function () {
    if (!cfg || !cfg.client_key || cfg.client_key === PLACEHOLDER) { say('pripoj-sprava', text('config'), 'chyba'); return; }
    if (!sget('tt_op')) { say('pripoj-sprava', text('operator_key_missing'), 'chyba'); $('op').focus(); return; }
    var state = randomState();
    sset('tt_state', state);
    sset('tt_state_t', String(Date.now()));
    var q = new URLSearchParams({
      client_key: cfg.client_key,
      scope: cfg.scopes,
      response_type: 'code',
      redirect_uri: cfg.redirect_uri,
      state: state
    });
    window.location.assign(AUTH_URL + '?' + q.toString());
  });

  function handleCallback() {
    var p = new URLSearchParams(window.location.search);
    if (!p.has('code') && !p.has('error')) return Promise.resolve(false);
    var expected = sget('tt_state');
    var started = parseInt(sget('tt_state_t') || '0', 10);
    sdel('tt_state');
    sdel('tt_state_t');
    // Kod nesmie ostat v adrese (historia, zalozky, snimka obrazovky v deme).
    try { window.history.replaceState(null, '', window.location.pathname); } catch (e) { /* nic */ }
    if (!expected || p.get('state') !== expected || Date.now() - started > STATE_MAX_MS) {
      say('pripoj-sprava', text('state_mismatch'), 'chyba');
      return Promise.resolve(true);
    }
    if (p.has('error')) {
      say('pripoj-sprava', 'TikTok sign in was not completed: ' + (p.get('error_description') || p.get('error')), 'chyba');
      return Promise.resolve(true);
    }
    say('pripoj-sprava', 'Finishing the TikTok sign in...', null);
    return api('POST', '/api/auth/exchange', { code: p.get('code') }).then(function (data) {
      say('pripoj-sprava', 'TikTok is connected.', 'ok');
      showConnected(data);
      return true;
    }).catch(function (e) {
      say('pripoj-sprava', text(e.code), 'chyba');
      return true;
    });
  }

  function loadMe() {
    if (!sget('tt_op')) { showDisconnected(); return; }
    api('GET', '/api/me').then(function (data) {
      if (data.connected) showConnected(data); else showDisconnected();
    }).catch(function (e) {
      showDisconnected();
      say('pripoj-sprava', text(e.code), 'chyba');
    });
  }

  function showConnected(data) {
    me = data;
    $('ucet').hidden = false;
    $('pripoj').hidden = true;
    $('ucet-meno').textContent = data.display_name || 'your TikTok account';
    if (data.avatar_url) { $('ucet-avatar').src = data.avatar_url; $('ucet-avatar').alt = 'Profile picture of ' + (data.display_name || 'the account'); }
    var missing = data.missing_scopes || [];
    $('ucet-scopes').textContent = missing.length
      ? 'TikTok did not grant: ' + missing.join(', ') + '. Disconnect and connect again with all permissions.'
      : 'Granted: ' + (data.scopes || []).join(', ');
    loadCreator();
    loadVideos();
  }

  function showDisconnected() {
    me = null;
    creator = null;
    $('ucet').hidden = true;
    $('pripoj').hidden = false;
    $('tvorca').hidden = true;
    ['d-video', 'i-video'].forEach(function (id) {
      var s = $(id);
      s.innerHTML = '';
      s.appendChild(new Option('Connect TikTok first', ''));
      s.disabled = true;
    });
    fillPrivacy([]);
    ['d', 'i'].forEach(clearPreview);
    update();
  }

  $('odpoj').addEventListener('click', function () {
    api('POST', '/api/auth/disconnect', {}).then(function () {
      say('pripoj-sprava', 'TikTok is disconnected and the sign in was removed from our server.', 'ok');
      showDisconnected();
    }).catch(function (e) { say('pripoj-sprava', text(e.code), 'chyba'); });
  });

  /* ------------------------------------------------------------ creator info (Direct Post) */

  function loadCreator() {
    say('tvorca-sprava', '', null);
    return api('GET', '/api/creator-info').then(function (c) {
      creator = c;
      $('tvorca').hidden = false;
      $('tvorca-meno').textContent = c.creator_nickname + (c.creator_username ? ' (@' + c.creator_username + ')' : '');
      if (c.creator_avatar_url) { $('tvorca-avatar').src = c.creator_avatar_url; $('tvorca-avatar').alt = 'Profile picture of ' + c.creator_nickname; }
      $('tvorca-limit').textContent = c.max_video_post_duration_sec
        ? 'This account can post videos up to ' + c.max_video_post_duration_sec + ' seconds long.'
        : '';
      fillPrivacy(c.privacy_level_options || []);
      setInteraction('komentar', c.comment_disabled);
      setInteraction('duet', c.duet_disabled);
      setInteraction('stitch', c.stitch_disabled);
      if (!(c.privacy_level_options || []).length) say('tvorca-sprava', text('cannot_post_now'), 'chyba');
      update();
    }).catch(function (e) {
      // Guidelines: ked tvorca prave nemoze postovat, zastavit a povedat, nech skusi neskor.
      creator = null;
      $('tvorca').hidden = true;
      say('tvorca-sprava', text(e.code), 'chyba');
      update();
    });
  }

  function fillPrivacy(options) {
    var s = $('d-sukromie');
    s.innerHTML = '';
    var ph = new Option('Select who can view this video', '');
    ph.disabled = true;
    s.appendChild(ph);
    options.forEach(function (o) { s.appendChild(new Option(PRIVACY_LABEL[o] || o, o)); });
    s.value = '';
    s.disabled = !options.length;
    brandPrivacyRules();
  }

  function setInteraction(name, disabledByCreator) {
    var box = $('d-' + name);
    var row = $('v-' + name);
    box.checked = false;
    box.disabled = !!disabledByCreator;
    row.classList.toggle('vypnuta', !!disabledByCreator);
    row.querySelector('[data-vypnute]').textContent = disabledByCreator ? 'Turned off in this account\'s TikTok settings.' : '';
  }

  /* ------------------------------------------------------------ videa a nahlad */

  function loadVideos() {
    return api('GET', '/api/videos').then(function (data) {
      videos = data.videos || [];
      ['d-video', 'i-video'].forEach(function (id) {
        var s = $(id);
        s.innerHTML = '';
        var ph = new Option(videos.length ? 'Choose a video' : 'No videos in the server folder yet', '');
        ph.disabled = true;
        s.appendChild(ph);
        videos.forEach(function (v) { s.appendChild(new Option(v.name + ' (' + mb(v.bytes) + ')', v.name)); });
        s.value = '';
        s.disabled = !videos.length;
      });
      update();
    }).catch(function (e) { say('tvorca-sprava', text(e.code), 'chyba'); });
  }

  function clearPreview(k) {
    if (objectUrl[k]) { URL.revokeObjectURL(objectUrl[k]); objectUrl[k] = null; }
    var v = $(k + '-prehravac');
    v.removeAttribute('src');
    try { v.load(); } catch (e) { /* nic */ }
    $(k + '-nahlad').hidden = true;
    duration[k] = null;
  }

  function preview(k) {
    var name = $(k + '-video').value;
    clearPreview(k);
    update();
    if (!name) return;
    var info = $(k + '-info');
    $(k + '-nahlad').hidden = false;
    info.textContent = 'Loading preview...';
    var key = sget('tt_op');
    fetch(cfg.api_base + '/api/videos/' + encodeURIComponent(name), { headers: { 'X-Operator-Token': key }, credentials: 'omit', cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw chyba('unknown_video'); return r.blob(); })
      .then(function (blob) {
        if ($(k + '-video').value !== name) return;
        objectUrl[k] = URL.createObjectURL(blob);
        var v = $(k + '-prehravac');
        v.onloadedmetadata = function () {
          duration[k] = isFinite(v.duration) ? v.duration : null;
          var meta = videos.filter(function (x) { return x.name === name; })[0] || {};
          var parts = ['This is exactly the file that will be sent.', mb(meta.bytes || blob.size)];
          if (duration[k] !== null) parts.push(duration[k].toFixed(1) + ' seconds');
          if (k === 'd' && tooLong()) parts.push('Too long for this account: the limit is ' + creator.max_video_post_duration_sec + ' seconds.');
          info.textContent = parts.join(' · ');
          update();
        };
        v.src = objectUrl[k];
      })
      .catch(function (e) { info.textContent = text(e.code || 'network'); });
  }

  function tooLong() {
    var d = duration.d;
    if (d === null) {
      var meta = videos.filter(function (x) { return x.name === $('d-video').value; })[0];
      d = meta ? meta.duration_s : null;
    }
    return !!(creator && creator.max_video_post_duration_sec && d !== null && d > creator.max_video_post_duration_sec);
  }

  $('d-video').addEventListener('change', function () { preview('d'); });
  $('i-video').addEventListener('change', function () { preview('i'); });

  /* ------------------------------------------------------------ Direct Post pravidla */

  function brandPrivacyRules() {
    var disclose = $('d-zverejni').checked;
    var branded = disclose && $('d-platena').checked;
    var organic = disclose && $('d-vlastna').checked;
    var s = $('d-sukromie');
    // Branded content nemoze byt sukromny: "Only me" sa vypne a naopak.
    for (var i = 0; i < s.options.length; i++) {
      var o = s.options[i];
      if (o.value === 'SELF_ONLY') {
        o.disabled = branded;
        o.title = branded ? PRIVATE_BRANDED : '';
        o.textContent = branded ? 'Only me (not available for branded content)' : PRIVACY_LABEL.SELF_ONLY;
      }
    }
    if (branded && s.value === 'SELF_ONLY') s.value = '';
    var privateChosen = s.value === 'SELF_ONLY';
    $('d-platena').disabled = privateChosen;
    $('v-platena').classList.toggle('vypnuta', privateChosen);
    $('v-platena').title = privateChosen ? PRIVATE_BRANDED : '';
    $('d-platena-pomoc').textContent = privateChosen
      ? PRIVATE_BRANDED + ' Choose another option under Who can view this video first.'
      : 'You are promoting another brand or a third party. This content will be classified as Branded Content.';
    if (privateChosen && $('d-platena').checked) $('d-platena').checked = false;
    $('d-sukromie-pomoc').textContent = branded ? PRIVATE_BRANDED : 'There is no default. You have to choose.';

    $('d-zverejnenie').hidden = !disclose;
    var label = '';
    if (disclose) {
      if (branded) label = 'Your video will be labeled as "Paid partnership".';
      else if (organic) label = 'Your video will be labeled as "Promotional content".';
      else label = ERR.disclosure_choice_required + '.';
    }
    $('d-stitok').textContent = label;

    var decl = $('d-vyhlasenie');
    decl.innerHTML = '';
    decl.appendChild(document.createTextNode('By posting, you agree to TikTok\'s '));
    if (branded) {
      decl.appendChild(link(BRANDED_URL, 'Branded Content Policy'));
      decl.appendChild(document.createTextNode(' and '));
    }
    decl.appendChild(link(MUSIC_URL, 'Music Usage Confirmation'));
    decl.appendChild(document.createTextNode('.'));
  }

  function link(href, label) {
    var a = document.createElement('a');
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = label;
    return a;
  }

  function directProblems() {
    var p = [];
    if (!me) p.push('Connect TikTok.');
    else if (!creator) p.push('TikTok does not allow posting from this account right now.');
    if (!$('d-video').value) p.push('Choose a video.');
    else if (tooLong()) p.push(ERR.video_too_long);
    var t = $('d-titul').value;
    if (!t.trim()) p.push(ERR.title_required);
    if (t.length > 2200) p.push(ERR.title_too_long);
    if (!$('d-sukromie').value) p.push(ERR.privacy_level_required);
    if ($('d-zverejni').checked && !$('d-vlastna').checked && !$('d-platena').checked) p.push(ERR.disclosure_choice_required + '.');
    return p;
  }

  function update() {
    brandPrivacyRules();
    $('d-titul-pocet').textContent = String($('d-titul').value.length);
    var p = directProblems();
    $('d-posli').disabled = busy.d || p.length > 0;
    var ul = $('d-chyba');
    ul.innerHTML = '';
    p.forEach(function (x) { var li = document.createElement('li'); li.textContent = x; ul.appendChild(li); });
    $('i-posli').disabled = busy.i || !me || !$('i-video').value;
  }

  ['d-titul', 'd-sukromie', 'd-zverejni', 'd-vlastna', 'd-platena', 'd-komentar', 'd-duet', 'd-stitch'].forEach(function (id) {
    $(id).addEventListener(id === 'd-titul' ? 'input' : 'change', update);
  });

  /* ------------------------------------------------------------ odoslanie a stav */

  $('d-posli').addEventListener('click', function () {
    if (directProblems().length) { update(); return; }
    busy.d = true;
    update();
    say('d-sprava', 'Sending the video to TikTok...', null);
    var disclose = $('d-zverejni').checked;
    api('POST', '/api/publish', {
      mode: 'direct',
      video: $('d-video').value,
      title: $('d-titul').value,
      privacy_level: $('d-sukromie').value,
      allow_comment: $('d-komentar').checked && !$('d-komentar').disabled,
      allow_duet: $('d-duet').checked && !$('d-duet').disabled,
      allow_stitch: $('d-stitch').checked && !$('d-stitch').disabled,
      disclose: disclose,
      brand_organic: disclose && $('d-vlastna').checked,
      brand_content: disclose && $('d-platena').checked,
      is_aigc: $('d-aigc').checked,
      consent: true
    }).then(function (data) {
      say('d-sprava', 'Sent. It may take a few minutes for the content to process and appear on the profile.', 'ok');
      poll('d', data.publish_id, 0);
    }).catch(function (e) {
      busy.d = false;
      update();
      say('d-sprava', text(e.code), 'chyba');
      if (e.code === 'spam_risk_too_many_posts' || e.code === 'reached_active_user_cap') loadCreator();
    });
  });

  $('i-posli').addEventListener('click', function () {
    if (!me || !$('i-video').value) return;
    busy.i = true;
    update();
    say('i-sprava', 'Sending the video to your TikTok inbox...', null);
    api('POST', '/api/publish', { mode: 'inbox', video: $('i-video').value }).then(function (data) {
      say('i-sprava', 'Sent. It may take a few minutes to process. Then open TikTok and tap the inbox notification to continue editing and post the video.', 'ok');
      poll('i', data.publish_id, 0);
    }).catch(function (e) {
      busy.i = false;
      update();
      say('i-sprava', text(e.code), 'chyba');
    });
  });

  var STATUS_TEXT = {
    PROCESSING_UPLOAD: 'TikTok is receiving and processing the video. This can take a few minutes.',
    PROCESSING_DOWNLOAD: 'TikTok is processing the video. This can take a few minutes.',
    SEND_TO_USER_INBOX: 'Done. The draft is in your TikTok inbox. Open TikTok and tap the notification to continue editing and post it.',
    PUBLISH_COMPLETE: 'Done. TikTok has posted the video to the profile.'
  };

  function poll(k, publishId, n) {
    var box = k + '-sprava';
    api('GET', '/api/status?publish_id=' + encodeURIComponent(publishId)).then(function (s) {
      var local = s.local || {};
      var tt = s.tiktok || {};
      var done = false;
      var msg;
      if (local.state === 'failed') {
        msg = text(local.error || 'upload_failed');
        done = true;
      } else if (tt.status === 'FAILED') {
        msg = 'TikTok could not finish the post' + (tt.fail_reason ? ' (' + tt.fail_reason + ')' : '') + '.';
        done = true;
      } else if (tt.status && STATUS_TEXT[tt.status] && (tt.status === 'PUBLISH_COMPLETE' || tt.status === 'SEND_TO_USER_INBOX')) {
        msg = STATUS_TEXT[tt.status];
        done = true;
      } else if (local.state === 'uploading' && local.video_size) {
        msg = 'Uploading to TikTok: ' + mb(local.uploaded_bytes || 0) + ' of ' + mb(local.video_size) + '.';
      } else {
        msg = STATUS_TEXT[tt.status] || 'It may take a few minutes for the content to process.';
      }
      say(box, msg + ' Status: ' + (tt.status || local.state || 'sent') + '.', done ? (local.state === 'failed' || tt.status === 'FAILED' ? 'chyba' : 'ok') : null);
      if (!done && n < 120) setTimeout(function () { poll(k, publishId, n + 1); }, 5000);
      else { busy[k] = false; update(); }
    }).catch(function () {
      if (n < 120) setTimeout(function () { poll(k, publishId, n + 1); }, 10000);
      else { busy[k] = false; update(); }
    });
  }

  /* ------------------------------------------------------------ start */

  renderKey();
  showDisconnected();
  fetch('config.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (c) {
    cfg = c;
    cfg.scopes = cfg.scopes || 'user.info.basic,video.publish,video.upload';
    if (!cfg.client_key || cfg.client_key === PLACEHOLDER) say('pripoj-sprava', text('config'), 'chyba');
    return handleCallback();
  }).then(function (handled) {
    if (!handled) loadMe();
  }).catch(function () { say('pripoj-sprava', text('config'), 'chyba'); });
})();
