// app.js: the page around mail.mjs.
//
// It owns no rules. Everything it prints comes out of the engine, and every
// piece of text that came from DNS is put on the page with textContent, never
// as markup, because a TXT record is written by somebody else.
//
// The checks are streamed: each area is drawn the moment its lookups answer,
// and the whole list is re-sorted by damage on every update, so what is on
// screen is always in the right order even while the slow half is still running.

import { runChecks, sortFindings, normaliseDomainInput, normaliseDkimSelector, looksLikeDomain, shareCheckUrl, readCheckUrl, AREAS, DKIM_SELECTORS } from './mail.mjs';

const $ = (id) => document.getElementById(id);
const form = $('ask');
const input = $('domain');
const selectorInput = $('selector');
const runBtn = $('run');
const checksEl = $('checks');
const findingsEl = $('findings');
const placeholder = $('placeholder');
const verdictEl = $('verdict');
const verdictPill = $('verdict-pill');
const verdictText = $('verdict-text');
const verdictCounts = $('verdict-counts');
const errorEl = $('ask-error');
const permalinkRow = $('permalink-row');
const copyLinkBtn = $('copy-link');

if (!form) throw new Error('mail-doctor: the page is not the one this script belongs to');

let current = null; // AbortController of the run in flight

const LEVEL_WORD = {
  must: 'the standard requires this',
  should: 'the standard recommends this, it does not require it',
  optional: 'adopting this at all is optional',
  practice: 'our advice, not a rule in the standard',
};

const SEV_WORD = {
  critical: 'critical',
  high: 'serious',
  medium: 'worth fixing',
  low: 'worth knowing',
  info: 'for information',
  pass: 'passes',
};

// ───────────────────────────── small helpers ─────────────────────────────

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function showError(message) {
  if (!message) {
    errorEl.hidden = true;
    errorEl.textContent = '';
    return;
  }
  errorEl.textContent = message;
  errorEl.hidden = false;
}

async function copy(text, button, sourceEl) {
  const say = (ok) => {
    const was = button.textContent;
    button.textContent = ok ? 'Copied' : 'Selected, press Ctrl+C';
    window.setTimeout(() => {
      button.textContent = was;
    }, 2200);
    // When the browser refuses to write to the clipboard, at least leave the
    // record selected so the keyboard shortcut is one key press away.
    if (!ok && sourceEl) {
      try {
        const range = document.createRange();
        range.selectNodeContents(sourceEl);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      } catch {
        // A browser without Selection still shows the record on the page.
      }
    }
  };
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      say(true);
      return;
    }
  } catch {
    // fall through to the old way, which works without permission
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.top = '-1000px';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);
  say(ok);
}

// ───────────────────────────── the rail ─────────────────────────────

const railItems = new Map();

function buildRail() {
  checksEl.textContent = '';
  railItems.clear();
  for (const area of AREAS) {
    const li = el('li');
    li.dataset.state = 'waiting';
    li.appendChild(el('span', 'dot'));
    li.appendChild(el('span', null, area.label));
    const note = el('span', 'mono', '');
    li.appendChild(note);
    checksEl.appendChild(li);
    railItems.set(area.id, { li, note });
  }
}

function setRail(areaId, state, note) {
  const item = railItems.get(areaId);
  if (!item) return;
  item.li.dataset.state = state;
  item.note.textContent = note ? ' ' + note : '';
  const label = AREAS.find((a) => a.id === areaId);
  item.li.setAttribute('title', label ? label.title : '');
}

// ──────────────────────────── one finding ────────────────────────────

function renderFinding(f) {
  const art = el('article', 'finding');
  art.dataset.sev = f.severity;

  const head = el('div', 'f-head');
  head.appendChild(el('span', 'f-tag', SEV_WORD[f.severity] || f.severity));
  head.appendChild(el('span', 'f-area', f.area));
  head.appendChild(el('h3', null, f.title));
  art.appendChild(head);

  art.appendChild(el('p', 'f-detail', f.detail));

  if (f.record) {
    const block = el('div', 'f-block');
    const bh = el('div', 'f-block-head');
    bh.appendChild(el('span', null, 'what is published'));
    bh.appendChild(el('span', 'name', f.record.name + '  ' + f.record.type));
    bh.appendChild(el('span', 'spacer'));
    const btn = el('button', 'copy', 'Copy');
    btn.type = 'button';
    const pre = el('pre', null, f.record.text);
    btn.addEventListener('click', () => copy(f.record.text, btn, pre));
    bh.appendChild(btn);
    block.appendChild(bh);
    block.appendChild(pre);
    art.appendChild(block);
  }

  const rule = el('p', 'f-rule');
  rule.appendChild(el('span', null, f.rule));
  const src = el('span', 'src');
  src.textContent = f.rfc + '  ';
  const lvl = el('span', 'lvl', LEVEL_WORD[f.level] || f.level);
  src.appendChild(lvl);
  rule.appendChild(src);
  art.appendChild(rule);

  if (f.suggest) {
    const block = el('div', 'f-block f-fix');
    const bh = el('div', 'f-block-head');
    bh.appendChild(el('span', null, 'publish this instead'));
    bh.appendChild(el('span', 'name', f.suggest.name + '  ' + f.suggest.type));
    bh.appendChild(el('span', 'spacer'));
    const btn = el('button', 'copy', 'Copy record');
    btn.type = 'button';
    const pre = el('pre', null, f.suggest.value);
    btn.addEventListener('click', () => copy(f.suggest.value, btn, pre));
    bh.appendChild(btn);
    block.appendChild(bh);
    block.appendChild(pre);
    if (f.suggest.why) block.appendChild(el('p', 'f-why', f.suggest.why));
    art.appendChild(block);
  }

  return art;
}

// ─────────────────────────────── the run ───────────────────────────────

function setBusy(busy) {
  runBtn.disabled = busy;
  runBtn.textContent = busy ? 'Checking' : 'Check';
  input.setAttribute('aria-busy', busy ? 'true' : 'false');
}

async function check(rawDomain, { push } = {}) {
  const domain = normaliseDomainInput(rawDomain);
  showError('');
  if (!looksLikeDomain(domain)) {
    showError('That does not look like a domain name. Type something like example.com, or the part after the @ in your e-mail address.');
    input.focus();
    return;
  }
  if (input.value !== domain) input.value = domain;
  const selector = normaliseDkimSelector(selectorInput.value);
  if (selectorInput.value.trim() && !selector) {
    showError('Enter only the s= selector value from a DKIM-Signature header, such as google or mail2026. Use the d= signing domain in the domain field.');
    selectorInput.focus();
    return;
  }
  const selectors = selector ? [selector] : DKIM_SELECTORS;

  if (current) current.abort();
  const controller = new AbortController();
  current = controller;
  let timedOut = false;
  const timer = window.setTimeout(() => { timedOut = true; controller.abort(new Error('The check timed out')); }, 60000);

  setBusy(true);
  placeholder.hidden = true;
  permalinkRow.hidden = false;
  findingsEl.textContent = '';
  buildRail();
  verdictEl.hidden = false;
  verdictEl.dataset.level = 'unknown';
  verdictPill.textContent = 'reading';
  verdictText.textContent = 'Asking public DNS about ' + domain + '. The first answers appear as they arrive.';
  verdictCounts.textContent = '';

  if (push !== false) {
    try {
      window.history.replaceState(null, '', shareCheckUrl(window.location.href, domain, selector));
    } catch {
      // A browser that refuses the history write still has a working page.
    }
  }

  const byArea = new Map();
  const draw = () => {
    const all = sortFindings([...byArea.values()].flat());
    findingsEl.textContent = '';
    for (const f of all) findingsEl.appendChild(renderFinding(f));
  };

  const started = Date.now();
  let lookups = 0;
  try {
    for await (const ev of runChecks(domain, { signal: controller.signal, selectors })) {
      if (controller.signal.aborted) return;
      if (ev.type === 'progress' && ev.area === 'dkim') {
        setRail('dkim', 'waiting', ev.done + '/' + ev.total);
        continue;
      }
      if (ev.type === 'area') {
        byArea.set(ev.area, ev.result.findings);
        setRail(ev.area, railState(ev.area, ev.result), railNote(ev.area, ev.result));
        draw();
        continue;
      }
      if (ev.type === 'done') {
        lookups = ev.lookups;
        byArea.clear();
        byArea.set('all', ev.report.findings);
        draw();
        const v = ev.report.verdict;
        verdictEl.dataset.level = v.level;
        verdictPill.textContent = { good: 'checks passed', ok: 'not enforcing', weak: 'review findings', bad: 'issues found', unknown: 'unverified' }[v.level] || v.level;
        verdictText.textContent = v.sentence;
        const c = ev.report.counts;
        verdictCounts.textContent =
          `${c.critical} critical, ${c.high} serious, ${c.medium} worth fixing, ${c.low} worth knowing, ${c.pass} passing. `
          + `${lookups} DNS questions asked from your browser in ${((Date.now() - started) / 1000).toFixed(1)} seconds. `
          + (selector ? `The supplied DKIM selector ${selector} was checked.` : `${selectors.length} common DKIM selectors were requested. Other selectors may exist.`);
      }
    }
  } catch (err) {
    if (controller.signal.aborted && !timedOut) return;
    verdictEl.dataset.level = 'unknown';
    verdictPill.textContent = 'no answer';
    verdictText.textContent = timedOut ? 'The check reached its time limit. The findings already shown are partial; retry to check the remaining records.' : 'The lookups could not be finished: ' + (err && err.message ? err.message : String(err));
    verdictCounts.textContent = 'DNS errors and timeouts do not mean a record is missing. A network or browser extension may block DNS over HTTPS.';
  } finally {
    window.clearTimeout(timer);
    if (current === controller) {
      current = null;
      setBusy(false);
    }
  }
}

function railState(area, result) {
  if (result.state === 'unknown') return 'unknown';
  if (area === 'dkim') return result.found && result.found.length ? (result.state === 'ok' ? 'ok' : 'warn') : 'fail';
  if (result.state === 'absent') return 'absent';
  if (result.state === 'fail') return 'fail';
  if (result.state === 'warn') return 'warn';
  return 'ok';
}

function railNote(area, result) {
  if (result.state === 'unknown') return result.uncertainty === 'selector' ? 'selector not confirmed' : 'not fully verified';
  if (area === 'dkim') {
    const found = result.found || [];
    if (!found.length) return 'none found';
    const names = found.map((k) => k.selector);
    return names.length <= 3 ? names.join(', ') : names.slice(0, 2).join(', ') + ' and ' + (names.length - 2) + ' more';
  }
  if (area === 'mx') {
    if (result.nullMx) return 'null MX';
    const n = (result.hosts || []).length;
    return n ? n + (n === 1 ? ' host' : ' hosts') : 'none';
  }
  if (area === 'spf') return result.present ? 'found' : 'none';
  if (area === 'dmarc') return result.policy && result.policy.p ? 'p=' + result.policy.p : result.present ? 'found' : 'none';
  return result.present ? 'found' : 'none';
}

// ───────────────────────────── wiring ─────────────────────────────

form.addEventListener('submit', (e) => {
  e.preventDefault();
  check(input.value);
});

copyLinkBtn.addEventListener('click', () => {
  copy(window.location.href, copyLinkBtn);
});

// The Menu button in the header, the same behaviour as every other page on
// arling.sk. It lives here rather than inline so the page needs no script hash
// in its Content-Security-Policy.
(function menu() {
  const bar = document.querySelector('header .bar');
  const btn = bar && bar.querySelector('.menu-btn');
  if (!bar || !btn) return;
  const toggle = (open) => {
    bar.setAttribute('data-menu', open ? 'otvorene' : 'zavrete');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  };
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggle(bar.getAttribute('data-menu') !== 'otvorene');
  });
  document.addEventListener('click', (e) => {
    if (bar.getAttribute('data-menu') === 'otvorene' && !bar.contains(e.target)) toggle(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && bar.getAttribute('data-menu') === 'otvorene') {
      toggle(false);
      btn.focus();
    }
  });
  bar.addEventListener('click', (e) => {
    if (e.target.closest && e.target.closest('nav a')) toggle(false);
  });
})();

// A link that carries the domain runs the same lookups again, from whoever
// opened it. Nothing about the result travels in the link.
const fromUrl = readCheckUrl(window.location.href);
// An old query link was already sent to the host before JS could run. Remove
// it from the current URL immediately and only create fragment links now.
if (fromUrl.legacy) {
  try { window.history.replaceState(null, '', shareCheckUrl(window.location.href, fromUrl.domain, fromUrl.selector)); } catch { /* The form still works. */ }
}
if (fromUrl.domain) {
  input.value = fromUrl.domain;
  selectorInput.value = fromUrl.selector;
  check(fromUrl.domain, { push: false });
}
