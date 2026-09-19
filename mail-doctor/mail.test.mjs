// mail.test.mjs: the whole engine, against captured and hand written DNS answers.
// Run with: node --test products/arling-sk/mail-doctor/
//       or: node --test mail.test.mjs   (from this folder)
//
// Nothing here touches the network. Every fixture is a zone: a plain object of
// DNS answers in exactly the shape resolveDoh() produces, so what the tests
// exercise is what the page runs.
//
// Where a fixture is a real record it says so in a comment, with the date it
// was read. The rest are written by hand to reproduce a specific mistake.
//
// Production text does not duplicate a changing count of tests.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  analyse,
  analyseSpf,
  analyseDkim,
  analyseDmarc,
  analyseMx,
  analyseMtaSts,
  analyseTlsRpt,
  analyseBimi,
  makeZone,
  walkSpf,
  spfPending,
  parseSpf,
  parseTxtData,
  parseDmarcUris,
  dmarcAuthorisationName,
  organizationalDomain,
  dmarcPending,
  mergeSpfRecords,
  rsaBitsFromKey,
  base64ToBytes,
  normaliseDomainInput,
  looksLikeDomain,
  octetLength,
  runChecks,
  zoneGet,
  resolveDoh,
  normaliseDkimSelector,
  shareCheckUrl,
  readCheckUrl,
} from './mail.mjs';

// A-089 regression fixtures, independent of the public DNS and paid services.
test('DNS errors remain unknown across all areas, never missing with a repair', () => {
  for (const status of [-1, 1, 2, 4, 5, 16]) {
    const failed = { status, records: [] };
    const zone = makeZone(Object.fromEntries([
      'error.example|TXT', 'error.example|MX', '_dmarc.error.example|TXT',
      'google._domainkey.error.example|TXT', '_mta-sts.error.example|TXT',
      '_smtp._tls.error.example|TXT', 'default._bimi.error.example|TXT',
    ].map((key) => [key, failed])));
    const r = analyse('error.example', zone, { selectors: ['google'] });
    for (const [area, result] of Object.entries(r.areas)) assert.equal(result.state, 'unknown', `${status} ${area}`);
    assert.equal(r.findings.length, 0, `status ${status}`);
    assert.equal(r.verdict.level, 'unknown');
  }
});

test('a failed SPF include is unknown, not a nonexistent record to remove', () => {
  for (const status of [2, 5]) {
    const zone = makeZone({ 'include.example|TXT': ['v=spf1 include:provider.example -all'], 'provider.example|TXT': { status, records: [] } });
    const r = analyseSpf('include.example', zone);
    assert.equal(r.state, 'unknown');
    assert.equal(r.walk.pending.length, 1);
    assert.equal(r.walk.voidCount, 0);
    assert.ok(!has(r, 'spf_include_no_record'));
    assert.ok(!has(r, 'spf_lookup_ok'));
  }
});

test('SERVFAIL in external DMARC authorisation is unverified, not unauthorised', () => {
  const zone = makeZone({
    '_dmarc.sender.example|TXT': ['v=DMARC1; p=reject; rua=mailto:d@reports.other'],
    'sender.example._report._dmarc.reports.other|TXT': { status: 2, records: [] },
  });
  const r = analyseDmarc('sender.example', zone);
  assert.equal(r.present, true);
  assert.equal(r.state, 'unknown');
  assert.ok(!has(r, 'dmarc_external_unauthorised'));
  assert.ok(!has(r, 'dmarc_external_ok'));
});

test('failed MX address lookups are not a missing host address', () => {
  const r = analyseMx('mx-error.example', makeZone({
    'mx-error.example|MX': [[10, 'mx.provider.example']],
    'mx.provider.example|A': { status: 2 }, 'mx.provider.example|AAAA': { status: 5 }, 'mx.provider.example|CNAME': { status: 2 },
  }));
  assert.equal(r.state, 'unknown');
  assert.ok(!has(r, 'mx_unresolvable'));
  assert.ok(!has(r, 'mx_ok'));
});

test('shared SPF branches are counted for every use, without a false cycle', () => {
  const zone = makeZone({
    'diamond.example|TXT': ['v=spf1 include:a.example include:b.example -all'],
    'a.example|TXT': ['v=spf1 include:c.example -all'],
    'b.example|TXT': ['v=spf1 include:c.example -all'],
    'c.example|TXT': ['v=spf1 include:d.example -all'],
    'd.example|TXT': ['v=spf1 ip4:192.0.2.1 -all'],
  });
  const r = analyseSpf('diamond.example', zone);
  assert.deepEqual(r.walk.loops, []);
  assert.equal(r.walk.count, 6);
  assert.equal(r.walk.nodes.filter((n) => n.name === 'd.example').length, 2);
  assert.ok(!has(r, 'spf_loop'));
});

test('a true SPF cycle is still reported after branch-local traversal', () => {
  const zone = makeZone({ 'a.example|TXT': ['v=spf1 include:b.example -all'], 'b.example|TXT': ['v=spf1 include:a.example -all'] });
  const r = analyseSpf('a.example', zone);
  assert.deepEqual(r.walk.loops, ['a.example']);
  assert.ok(has(r, 'spf_loop'));
});

const dnsResponse = (Status, Answer = []) => ({ ok: true, status: 200, json: async () => ({ Status, Answer }) });
test('DoH retries a DNS SERVFAIL at the other provider and strips referrers', async () => {
  const calls = [];
  const r = await resolveDoh('error.example', 'TXT', { fetch: async (url, options) => {
    calls.push({ url, options });
    return calls.length === 1 ? dnsResponse(2) : dnsResponse(0, [{ type: 16, data: '"v=spf1 -all"' }]);
  } });
  assert.equal(calls.length, 2);
  assert.equal(r.records[0].text, 'v=spf1 -all');
  for (const c of calls) { assert.equal(c.options.referrerPolicy, 'no-referrer'); assert.equal(c.options.credentials, 'omit'); }
});

test('two failed DNS providers reject rather than returning an absent record', async () => {
  let calls = 0;
  await assert.rejects(resolveDoh('error.example', 'TXT', { fetch: async () => dnsResponse(++calls === 1 ? 2 : 5) }), /DNS status 5/);
  assert.equal(calls, 2);
});

test('a valid NXDOMAIN remains absent and needs no fallback', async () => {
  let calls = 0;
  const r = await resolveDoh('absent.example', 'TXT', { fetch: async () => { calls++; return dnsResponse(3); } });
  assert.equal(calls, 1);
  assert.equal(r.status, 3);
});

test('DoH timeouts are bounded and cancellation does not start a fallback', async () => {
  let calls = 0;
  await assert.rejects(resolveDoh('timeout.example', 'TXT', { timeoutMs: 5, fetch: async (_, { signal }) => {
    calls++;
    return new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
  } }), /timed out/);
  assert.equal(calls, 2);
  const controller = new AbortController(); controller.abort(new Error('test cancelled'));
  await assert.rejects(resolveDoh('cancel.example', 'TXT', { signal: controller.signal, fetch: async () => { throw new Error('must not run'); } }), /test cancelled/);
});

test('streamed DNS failures preserve the same uncertainty as pure analysis', async () => {
  const events = [];
  for await (const e of runChecks('failed.example', { selectors: ['customer2026'], resolve: async () => ({ status: 2, records: [] }) })) events.push(e);
  const done = events.at(-1);
  assert.equal(done.report.verdict.level, 'unknown');
  assert.equal(done.report.findings.length, 0);
  assert.ok(events.filter((e) => e.type === 'area').every((e) => e.result.state === 'unknown'));
});

test('a supplied DKIM selector is looked up directly and does not imply message verification', async () => {
  const questions = [];
  const events = [];
  for await (const e of runChecks('custom.example', { selectors: ['customer2026'], resolve: async (name, type) => {
    questions.push(name);
    if (name === 'customer2026._domainkey.custom.example') return makeZone({ [`${name}|TXT`]: ['v=DKIM1; k=rsa; p='] })[`${name}|TXT`];
    return { status: 3, records: [] };
  } })) events.push(e);
  assert.ok(questions.includes('customer2026._domainkey.custom.example'));
  assert.ok(!questions.includes('google._domainkey.custom.example'));
  assert.equal(events.at(-1).report.areas.dkim.found[0].selector, 'customer2026');
});

test('shared domains and custom selectors stay in fragments; old query links migrate', () => {
  const old = 'https://arling.sk/mail-doctor/?domain=Private.Example&selector=sales2026&utm_source=test';
  const parsed = readCheckUrl(old);
  assert.deepEqual(parsed, { domain: 'private.example', selector: 'sales2026', legacy: true });
  const share = new URL(shareCheckUrl(old, parsed.domain, parsed.selector));
  assert.ok(!share.searchParams.has('domain'));
  assert.ok(!share.searchParams.has('selector'));
  assert.ok(!`${share.pathname}${share.search}`.includes('private.example'));
  assert.equal(new URLSearchParams(share.hash.slice(1)).get('domain'), 'private.example');
  assert.deepEqual(readCheckUrl(share.href), { domain: 'private.example', selector: 'sales2026', legacy: false });
  assert.equal(share.searchParams.get('utm_source'), 'test');
  assert.equal(normaliseDkimSelector('s= March2026.Region;'), 'march2026.region');
  assert.equal(normaliseDkimSelector('x@example.com'), '');
  assert.equal(normaliseDkimSelector('x..y'), '');
});

test('the page has a custom selector and no analytics script that could capture fragment URLs', () => {
  const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  assert.match(html, /id="selector"/);
  assert.match(html, /<meta name="referrer" content="no-referrer">/);
  assert.ok(!/data-website-id=|<script[^>]+src="https?:/i.test(html));
  const app = readFileSync(new URL('./app.js', import.meta.url), 'utf8');
  assert.ok(!/searchParams\.set\(['"]domain/.test(app));
  assert.match(app, /shareCheckUrl\(window.location.href, domain, selector\)/);
});

// ───────────────────────── keys used by the fixtures ─────────────────────────
// Generated once with node:crypto (RSA SubjectPublicKeyInfo, base64), so the
// bit lengths the tests assert are real key sizes, not strings of the right
// shape.
const RSA_512 =
  'MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBAKfeBlMS+aaDdjq7mYjhsquywEPKlCPh8l1yF8aS7HQtWlwPzazHdZh06il4bMlwh/RHQ0myq+g/5KacCkstsxMCAwEAAQ==';
const RSA_1024 =
  'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC+GnjowP1DxcBaPmcDy3dysgeY6f54W9kweg82DIIVUIhJtiAi8KouQAzzlnzputBhKol1Y2VfmvL1X+uFGl3QZYqS+PtmsrXnX3aDoDT+Chqf5O9yeckriToOdfTLjsY6/pw0NiRf28F1QqKu89Ae982TCckktPbQWXJcfyBSOQIDAQAB';
const RSA_2048 =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA89AvC6ajKO74yxRpG+QdzRbOisRWLco87jsDo0oqZJIoRmyezeSjcebUctOfHJI+eMUSuUQGc9EDbdSGYZkRrYJtx+HtG6U42H9g/SXxgoHklPjeIKQXLETd7nQVfGoC8LLSuzzuV4eXWG1cp/IqCHU9fNqfaBkKUiKavjYCvoJGVzowAwt7e76yRCDNMNQYYpYS2n0S9xssKafH7Q1jaSgE6W034m9Sp4KObu5ZsCf0HEUgpmi0GsTvVvV1kZqOKoUeGzNZ8ufqjMEYX7dKH3c/mxobpyEfLZmLS/QwjWLS99CdScTGaNwfyx8QCCz3ff9wuGiv6fvJ0xd6rNvzgQIDAQAB';
const ED25519_32 = 'gL4WaavSdl0oAxw3fcbCrR7uQMrQm0AG+7D3cGJ/HJM=';

const GOOGLE_ONLY = [{ selector: 'google', vendor: 'Google Workspace' }];
const NX = { status: 3, records: [] };

const idsOf = (r) => r.findings.map((f) => f.id);
const pick = (r, id) => (r.findings || r).find((f) => f.id === id);
const has = (r, id) => Boolean(pick(r, id));

// ═══════════════════════════ 1. clean domain ═══════════════════════════

const cleanZone = makeZone({
  'clean.example|MX': [[10, 'mx1.clean.example'], [20, 'mx2.clean.example']],
  'mx1.clean.example|A': ['203.0.113.10'],
  'mx1.clean.example|AAAA': ['2001:db8::10'],
  'mx1.clean.example|CNAME': { status: 0, records: [] },
  'mx2.clean.example|A': ['203.0.113.11'],
  'mx2.clean.example|AAAA': { status: 0, records: [] },
  'mx2.clean.example|CNAME': { status: 0, records: [] },
  'clean.example|A': ['203.0.113.1'],
  'clean.example|AAAA': { status: 0, records: [] },
  'clean.example|TXT': ['v=spf1 include:_spf.provider.example -all'],
  '_spf.provider.example|TXT': ['v=spf1 ip4:203.0.113.0/24 ip6:2001:db8::/32 -all'],
  '_dmarc.clean.example|TXT': ['v=DMARC1; p=reject; rua=mailto:dmarc@clean.example'],
  'google._domainkey.clean.example|TXT': [`v=DKIM1; k=rsa; p=${RSA_2048}`],
  '_mta-sts.clean.example|TXT': ['v=STSv1; id=2026091801'],
  '_smtp._tls.clean.example|TXT': ['v=TLSRPTv1; rua=mailto:tlsrpt@clean.example'],
  'default._bimi.clean.example|TXT': NX,
});

test('a clean domain reports nothing critical and nothing high', () => {
  const r = analyse('clean.example', cleanZone, { selectors: GOOGLE_ONLY });
  assert.equal(r.counts.critical, 0, idsOf(r).join(', '));
  assert.equal(r.counts.high, 0, idsOf(r).join(', '));
  assert.equal(r.verdict.level, 'good');
  assert.match(r.verdict.sentence, /publishes SPF, a DKIM key and an enforcing DMARC policy/);
  assert.match(r.verdict.sentence, /real message is still needed/);
});

test('a clean domain names the passing checks with the record each came from', () => {
  const r = analyse('clean.example', cleanZone, { selectors: GOOGLE_ONLY });
  assert.ok(has(r, 'spf_all_fail'));
  assert.ok(has(r, 'dmarc_policy_reject'));
  assert.ok(has(r, 'dkim_key_ok'));
  assert.ok(has(r, 'mx_ok'));
  assert.equal(pick(r, 'dkim_key_ok').data.bits, 2048);
  assert.equal(pick(r, 'spf_lookup_ok').data.count, 1);
  assert.equal(pick(r, 'mx_ok').record.text, '10 mx1.clean.example\n20 mx2.clean.example');
});

test('every finding carries a rule, an RFC section and how binding it is', () => {
  const r = analyse('clean.example', cleanZone, { selectors: GOOGLE_ONLY });
  for (const f of r.findings) {
    assert.ok(f.rule && f.rule.length > 20, `${f.id} has no rule text`);
    assert.ok(/RFC \d+ section|Internet-Draft/.test(f.rfc), `${f.id} has no source: ${f.rfc}`);
    assert.ok(['must', 'should', 'optional', 'practice'].includes(f.level), `${f.id} level ${f.level}`);
    assert.ok(f.title && f.detail, `${f.id} is missing text`);
  }
});

// ═════════════════════════════ 2. SPF ══════════════════════════════════

test('two SPF records are a permanent error, and the suggestion merges them', () => {
  const zone = makeZone({
    'two.example|TXT': ['v=spf1 include:_spf.google.com ~all', 'v=spf1 include:sendgrid.net -all'],
    '_spf.google.com|TXT': ['v=spf1 ip4:35.190.247.0/24 -all'],
  });
  const r = analyseSpf('two.example', zone);
  const f = pick(r, 'spf_multiple');
  assert.ok(f, idsOf(r).join(', '));
  assert.equal(f.severity, 'critical');
  assert.equal(f.suggest.value, 'v=spf1 include:_spf.google.com include:sendgrid.net ~all');
  assert.equal(f.suggest.name, 'two.example');
  assert.equal(f.suggest.type, 'TXT');
});

test('merging keeps the gentler all qualifier so nothing starts bouncing', () => {
  assert.equal(mergeSpfRecords(['v=spf1 a -all', 'v=spf1 mx ~all']), 'v=spf1 a mx ~all');
  assert.equal(mergeSpfRecords(['v=spf1 a -all', 'v=spf1 mx -all']), 'v=spf1 a mx -all');
  assert.equal(mergeSpfRecords(['v=spf1 a +all', 'v=spf1 mx -all']), 'v=spf1 a mx ~all');
});

const manyZone = makeZone({
  'many.example|TXT': ['v=spf1 include:i1.example include:i2.example include:i3.example -all'],
  'i1.example|TXT': ['v=spf1 include:j1.example include:j2.example ip4:192.0.2.1 -all'],
  'i2.example|TXT': ['v=spf1 include:j3.example include:j4.example -all'],
  'i3.example|TXT': ['v=spf1 include:j5.example include:j6.example -all'],
  'j1.example|TXT': ['v=spf1 include:k1.example -all'],
  'j2.example|TXT': ['v=spf1 ip4:192.0.2.2 -all'],
  'j3.example|TXT': ['v=spf1 ip4:192.0.2.3 -all'],
  'j4.example|TXT': ['v=spf1 ip4:192.0.2.4 -all'],
  'j5.example|TXT': ['v=spf1 ip4:192.0.2.5 -all'],
  'j6.example|TXT': ['v=spf1 ip4:192.0.2.6 -all'],
  'k1.example|TXT': ['v=spf1 include:k2.example -all'],
  'k2.example|TXT': ['v=spf1 ip4:192.0.2.7 -all'],
  'many.example|A': { status: 0, records: [] },
  'many.example|AAAA': { status: 0, records: [] },
  'many.example|MX': { status: 0, records: [] },
});

test('the ten lookup limit is counted through nested includes', () => {
  const r = analyseSpf('many.example', manyZone);
  const f = pick(r, 'spf_lookup_limit');
  assert.ok(f, idsOf(r).join(', '));
  assert.equal(f.severity, 'critical');
  assert.equal(f.data.count, 11);
  assert.equal(f.data.limit, 10);
  assert.match(f.detail, /11 DNS lookups/);
});

test('the lookup count is listed term by term, in the order a receiver reads them', () => {
  const walk = walkSpf('many.example', manyZone);
  assert.deepEqual(
    walk.lookupTerms.map((t) => t.term),
    [
      'include:i1.example',
      'include:j1.example',
      'include:k1.example',
      'include:k2.example',
      'include:j2.example',
      'include:i2.example',
      'include:j3.example',
      'include:j4.example',
      'include:i3.example',
      'include:j5.example',
      'include:j6.example',
    ],
  );
});

test('exactly ten lookups is a warning, not a failure', () => {
  const zone = makeZone({
    'ten.example|TXT': ['v=spf1 include:t1.example include:t2.example -all'],
    't1.example|TXT': ['v=spf1 include:u1.example include:u2.example include:u3.example include:u4.example -all'],
    't2.example|TXT': ['v=spf1 include:u5.example include:u6.example include:u7.example include:u8.example -all'],
    'u1.example|TXT': ['v=spf1 ip4:192.0.2.1 -all'],
    'u2.example|TXT': ['v=spf1 ip4:192.0.2.2 -all'],
    'u3.example|TXT': ['v=spf1 ip4:192.0.2.3 -all'],
    'u4.example|TXT': ['v=spf1 ip4:192.0.2.4 -all'],
    'u5.example|TXT': ['v=spf1 ip4:192.0.2.5 -all'],
    'u6.example|TXT': ['v=spf1 ip4:192.0.2.6 -all'],
    'u7.example|TXT': ['v=spf1 ip4:192.0.2.7 -all'],
    'u8.example|TXT': ['v=spf1 ip4:192.0.2.8 -all'],
  });
  const r = analyseSpf('ten.example', zone);
  assert.ok(!has(r, 'spf_lookup_limit'));
  const f = pick(r, 'spf_lookup_at_limit');
  assert.equal(f.data.count, 10);
  assert.equal(f.severity, 'medium');
});

const redirZone = makeZone({
  'redir.example|TXT': ['v=spf1 include:r1.example redirect=r2.example'],
  'r1.example|TXT': ['v=spf1 ip4:198.51.100.1 -all'],
  'r2.example|TXT': [
    'v=spf1 include:s1.example include:s2.example include:s3.example include:s4.example include:s5.example include:s6.example include:s7.example include:s8.example include:s9.example -all',
  ],
  ...Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => [`s${n}.example|TXT`, [`v=spf1 ip4:198.51.100.${n} -all`]])),
});

test('a record that is only over the limit once the redirect is followed', () => {
  // With the redirect target not yet fetched the walk asks for it instead of
  // guessing: that is the whole reason the walk is restartable.
  const partial = makeZone({
    'redir.example|TXT': ['v=spf1 include:r1.example redirect=r2.example'],
    'r1.example|TXT': ['v=spf1 ip4:198.51.100.1 -all'],
  });
  assert.deepEqual(spfPending('redir.example', partial), [{ name: 'r2.example', type: 'TXT' }]);
  assert.equal(walkSpf('redir.example', partial).count, 2);

  const r = analyseSpf('redir.example', redirZone);
  const f = pick(r, 'spf_lookup_limit');
  assert.ok(f, idsOf(r).join(', '));
  assert.equal(f.data.count, 11);
});

test('a record with a redirect and no all is not told to add one', () => {
  const r = analyseSpf('redir.example', redirZone);
  assert.ok(!has(r, 'spf_no_all'));
});

test('+all is critical and the suggestion steps down to softfail, not straight to -all', () => {
  const zone = makeZone({
    'plusall.example|TXT': ['v=spf1 include:_spf.example.net +all'],
    '_spf.example.net|TXT': ['v=spf1 ip4:192.0.2.0/24 -all'],
  });
  const r = analyseSpf('plusall.example', zone);
  const f = pick(r, 'spf_all_pass');
  assert.equal(f.severity, 'critical');
  assert.equal(f.suggest.value, 'v=spf1 include:_spf.example.net ~all');
  assert.equal(f.rfc, 'RFC 7208 sections 4.6.2 and 5.1');
});

test('?all is treated as no policy at all', () => {
  const zone = makeZone({
    'qall.example|TXT': ['v=spf1 mx ?all'],
    'qall.example|MX': [[10, 'mx.qall.example']],
  });
  const r = analyseSpf('qall.example', zone);
  const f = pick(r, 'spf_all_neutral');
  assert.equal(f.severity, 'high');
  assert.equal(f.suggest.value, 'v=spf1 mx ~all');
});

test('~all is explained rather than flagged, and -all is offered as the next step', () => {
  const zone = makeZone({ 'soft.example|TXT': ['v=spf1 ip4:192.0.2.1 ~all'] });
  const r = analyseSpf('soft.example', zone);
  const f = pick(r, 'spf_all_softfail');
  assert.equal(f.severity, 'low');
  assert.equal(f.level, 'practice');
  assert.equal(f.suggest.value, 'v=spf1 ip4:192.0.2.1 -all');
});

test('a character-string over 255 octets is split, not shortened', () => {
  const term = 'ip4:203.0.113.1';
  const text = ['v=spf1', ...Array(16).fill(term), '-all'].join(' ');
  assert.equal(octetLength(text), 267);
  const zone = makeZone({ 'long.example|TXT': [text] });
  const r = analyseSpf('long.example', zone);
  const f = pick(r, 'spf_string_too_long');
  assert.equal(f.severity, 'high');
  assert.equal(f.title, 'A single string in the record is 267 octets');
  assert.equal(f.suggest.value, '"' + ['v=spf1', ...Array(15).fill(term)].join(' ') + ' " "' + term + ' -all"');
});

test('a record already split into several strings is joined with nothing between them', () => {
  const zone = makeZone({ 'split.example|TXT': [['v=spf1 include:a.example ', 'include:b.example -all']] });
  const r = analyseSpf('split.example', zone);
  assert.equal(r.record, 'v=spf1 include:a.example include:b.example -all');
  assert.ok(has(r, 'spf_multi_string'));
});

test('ptr is named as deprecated and dropped from the suggested record', () => {
  const zone = makeZone({
    'ptr.example|TXT': ['v=spf1 a mx ptr -all'],
    'ptr.example|A': ['192.0.2.1'],
    'ptr.example|AAAA': { status: 0, records: [] },
    'ptr.example|MX': [[10, 'mx.ptr.example']],
  });
  const r = analyseSpf('ptr.example', zone);
  const f = pick(r, 'spf_ptr_deprecated');
  assert.equal(f.level, 'should');
  assert.equal(f.rfc, 'RFC 7208 section 5.5');
  assert.equal(f.suggest.value, 'v=spf1 a mx -all');
});

test('an include of a name with no SPF record is a permanent error for the whole check', () => {
  const zone = makeZone({
    'noinc.example|TXT': ['v=spf1 include:gone.example -all'],
    'gone.example|TXT': NX,
  });
  const r = analyseSpf('noinc.example', zone);
  const f = pick(r, 'spf_include_no_record');
  assert.equal(f.severity, 'critical');
  assert.equal(f.suggest.value, 'v=spf1 -all');
  assert.match(f.title, /include:gone\.example/);
});

test('more than two void lookups is reported as a recommendation, not a requirement', () => {
  const zone = makeZone({
    'void.example|TXT': ['v=spf1 include:v1.example include:v2.example include:v3.example -all'],
    'v1.example|TXT': NX,
    'v2.example|TXT': NX,
    'v3.example|TXT': { status: 0, records: [] },
  });
  const r = analyseSpf('void.example', zone);
  const f = pick(r, 'spf_void_limit');
  assert.equal(f.data.voidCount, 3);
  assert.equal(f.level, 'should');
  assert.match(f.rule, /should limit void lookups to two/);
});

test('terms written after all are reported as dead and moved in the suggestion', () => {
  const zone = makeZone({
    'after.example|TXT': ['v=spf1 include:a.example -all include:b.example'],
    'a.example|TXT': ['v=spf1 ip4:192.0.2.1 -all'],
  });
  const r = analyseSpf('after.example', zone);
  const f = pick(r, 'spf_terms_after_all');
  assert.equal(f.severity, 'high');
  assert.equal(f.suggest.value, 'v=spf1 include:a.example include:b.example -all');
  assert.equal(f.rfc, 'RFC 7208 section 5.1');
});

test('a redirect is reported as ignored when the record also has all', () => {
  const zone = makeZone({ 'redig.example|TXT': ['v=spf1 redirect=other.example -all'] });
  const r = analyseSpf('redig.example', zone);
  const f = pick(r, 'spf_redirect_ignored');
  assert.equal(f.severity, 'high');
  assert.equal(f.suggest.value, 'v=spf1 redirect=other.example');
  // The ignored redirect costs no lookup, because it is never evaluated.
  assert.equal(pick(r, 'spf_lookup_ok').data.count, 0);
});

test('a record with no all and no redirect is only a neutral result', () => {
  const zone = makeZone({
    'noall.example|TXT': ['v=spf1 include:x.example'],
    'x.example|TXT': ['v=spf1 ip4:192.0.2.1 -all'],
  });
  const r = analyseSpf('noall.example', zone);
  const f = pick(r, 'spf_no_all');
  assert.equal(f.severity, 'high');
  assert.equal(f.suggest.value, 'v=spf1 include:x.example ~all');
});

test('a term that is not a mechanism makes the record a permanent error', () => {
  const zone = makeZone({ 'bad.example|TXT': ['v=spf1 includ:x.example -all'] });
  const r = analyseSpf('bad.example', zone);
  const f = pick(r, 'spf_syntax');
  assert.equal(f.severity, 'critical');
  assert.match(f.detail, /"includ:x\.example" is not a mechanism/);
});

test('a Sender ID record is not an SPF record', () => {
  const zone = makeZone({ 'sid.example|TXT': ['spf2.0/pra include:x.example -all'] });
  const r = analyseSpf('sid.example', zone);
  assert.ok(has(r, 'spf_missing'));
  assert.ok(has(r, 'spf_senderid_only'));
});

test('a missing SPF record is answered with one built from the real MX records', () => {
  const zone = makeZone({
    'nospf.example|TXT': { status: 0, records: [] },
    'nospf.example|MX': [[10, 'mx.zoho.eu'], [20, 'mx2.zoho.eu']],
  });
  const r = analyseSpf('nospf.example', zone);
  const f = pick(r, 'spf_missing');
  assert.equal(f.severity, 'critical');
  assert.equal(f.suggest.value, 'v=spf1 include:zohomail.eu ~all');
  assert.match(f.suggest.why, /Zoho Mail \(EU\)/);
});

test('no SPF and no recognisable MX gives no invented suggestion', () => {
  const zone = makeZone({
    'unknown.example|TXT': { status: 0, records: [] },
    'unknown.example|MX': [[10, 'mail.unknown-host.example']],
  });
  const f = pick(analyseSpf('unknown.example', zone), 'spf_missing');
  assert.equal(f.suggest, null);
});

test('the SPF parser reads qualifiers, values and CIDR lengths', () => {
  const p = parseSpf('v=spf1 +mx:mail.example.com/24 -ip4:192.0.2.0/24 redirect=x.example');
  assert.equal(p.errors.length, 0);
  assert.deepEqual(
    p.terms.map((t) => [t.kind, t.name, t.qualifier || null, t.value || null, t.cidr || null]),
    [
      ['mechanism', 'mx', '+', 'mail.example.com', '/24'],
      ['mechanism', 'ip4', '-', '192.0.2.0', '/24'],
      ['modifier', 'redirect', null, 'x.example', null],
    ],
  );
});

// ═════════════════════════════ 3. DKIM ═════════════════════════════════

const dkimZone = (selector, value) =>
  makeZone({ [`${selector}._domainkey.k.example|TXT`]: [value] });

test('a revoked key is recognised by its empty p tag', () => {
  const r = analyseDkim('k.example', dkimZone('google', 'v=DKIM1; k=rsa; p='), GOOGLE_ONLY);
  const f = pick(r, 'dkim_revoked');
  assert.equal(f.severity, 'high');
  assert.equal(f.record.name, 'google._domainkey.k.example');
  assert.match(f.rule, /empty value for the p tag means/);
});

test('a 1024 bit RSA key is valid and only a recommendation away from right', () => {
  const r = analyseDkim('k.example', dkimZone('google', `v=DKIM1; k=rsa; p=${RSA_1024}`), GOOGLE_ONLY);
  const f = pick(r, 'dkim_key_short');
  assert.equal(f.data.bits, 1024);
  assert.equal(f.severity, 'low');
  assert.equal(f.level, 'should');
  assert.equal(f.rfc, 'RFC 8301 section 3.2');
});

test('a key under 1024 bits fails outright', () => {
  const r = analyseDkim('k.example', dkimZone('google', `v=DKIM1; k=rsa; p=${RSA_512}`), GOOGLE_ONLY);
  const f = pick(r, 'dkim_key_too_short');
  assert.equal(f.data.bits, 512);
  assert.equal(f.severity, 'high');
});

test('a 2048 bit key passes and its size is read from the key itself', () => {
  const r = analyseDkim('k.example', dkimZone('google', `v=DKIM1; k=rsa; p=${RSA_2048}`), GOOGLE_ONLY);
  assert.equal(pick(r, 'dkim_key_ok').data.bits, 2048);
  assert.equal(rsaBitsFromKey(base64ToBytes(RSA_2048)), 2048);
  assert.equal(rsaBitsFromKey(base64ToBytes(RSA_1024)), 1024);
  assert.equal(rsaBitsFromKey(base64ToBytes(ED25519_32)), null);
});

test('an Ed25519 key is accepted at its own 32 byte length', () => {
  const r = analyseDkim('k.example', dkimZone('google', `v=DKIM1; k=ed25519; p=${ED25519_32}`), GOOGLE_ONLY);
  assert.ok(has(r, 'dkim_ed25519_ok'));
  assert.ok(!has(r, 'dkim_key_short'));
});

test('the testing flag is reported, and the suggestion is the same key without it', () => {
  const r = analyseDkim('k.example', dkimZone('google', `v=DKIM1; k=rsa; t=y; p=${RSA_2048}`), GOOGLE_ONLY);
  const f = pick(r, 'dkim_testing');
  assert.equal(f.severity, 'medium');
  assert.equal(f.suggest.value, `v=DKIM1; k=rsa; p=${RSA_2048}`);
});

test('a version tag that is not DKIM1 makes the key unusable', () => {
  const r = analyseDkim('k.example', dkimZone('google', `v=DKIM2; k=rsa; p=${RSA_2048}`), GOOGLE_ONLY);
  const f = pick(r, 'dkim_bad_version');
  assert.equal(f.severity, 'high');
  assert.equal(f.suggest.value, `v=DKIM1; k=rsa; p=${RSA_2048}`);
});

test('a key that allows only SHA-1 is reported against RFC 8301', () => {
  const r = analyseDkim('k.example', dkimZone('google', `v=DKIM1; h=sha1; k=rsa; p=${RSA_2048}`), GOOGLE_ONLY);
  const f = pick(r, 'dkim_sha1_only');
  assert.equal(f.rfc, 'RFC 8301 section 3.1');
  assert.equal(f.suggest.value, `v=DKIM1; h=sha256; k=rsa; p=${RSA_2048}`);
});

test('a truncated key is reported as unreadable rather than guessed at', () => {
  const r = analyseDkim('k.example', dkimZone('google', `v=DKIM1; k=rsa; p=${RSA_2048.slice(0, 120)}`), GOOGLE_ONLY);
  assert.ok(has(r, 'dkim_bad_key'));
});

test('no key at any selector tried says which selectors were tried', () => {
  const zone = makeZone({
    'google._domainkey.none.example|TXT': NX,
    'selector1._domainkey.none.example|TXT': NX,
  });
  const r = analyseDkim('none.example', zone, [
    { selector: 'google', vendor: 'Google Workspace' },
    { selector: 'selector1', vendor: 'Microsoft 365' },
  ]);
  const f = pick(r, 'dkim_none_found');
  // Not "high": a selector cannot be discovered from DNS, so the absence of an
  // answer is not evidence that the domain does not sign.
  assert.equal(f.severity, 'info');
  assert.equal(f.data.probed, 2);
  assert.match(f.detail, /Selectors requested: google, selector1\./);
  assert.match(f.detail, /DKIM-Signature s= value/);
  assert.equal(r.state, 'unknown');
});

test('selectors not yet looked up are reported as unknown, never as missing', () => {
  const r = analyseDkim('pending.example', makeZone({}), GOOGLE_ONLY);
  assert.equal(r.state, 'unknown');
  assert.equal(r.findings.length, 0);
});

// ════════════════════════════ 4. DMARC ═════════════════════════════════

test('p=none is reported as monitoring and the suggestion is the staged next step', () => {
  const zone = makeZone({ '_dmarc.none.example|TXT': ['v=DMARC1; p=none; rua=mailto:dmarc@none.example'] });
  const r = analyseDmarc('none.example', zone);
  const f = pick(r, 'dmarc_policy_none');
  assert.equal(f.severity, 'medium');
  assert.equal(f.level, 'practice');
  assert.equal(f.suggest.value, 'v=DMARC1; p=quarantine; pct=25; rua=mailto:dmarc@none.example');
});

test('p=none with no report address is told to add the report address first', () => {
  const zone = makeZone({ '_dmarc.blind.example|TXT': ['v=DMARC1; p=none'] });
  const r = analyseDmarc('blind.example', zone);
  assert.equal(pick(r, 'dmarc_policy_none').suggest.value, 'v=DMARC1; p=none; rua=mailto:dmarc@blind.example');
  assert.equal(pick(r, 'dmarc_no_rua').suggest.value, 'v=DMARC1; p=none; rua=mailto:dmarc@blind.example');
});

test('a percentage outside 0 to 100 is corrected by removing it', () => {
  const zone = makeZone({ '_dmarc.pct.example|TXT': ['v=DMARC1; p=quarantine; pct=150; rua=mailto:d@pct.example'] });
  const f = pick(analyseDmarc('pct.example', zone), 'dmarc_pct_invalid');
  assert.equal(f.severity, 'high');
  assert.equal(f.suggest.value, 'v=DMARC1; p=quarantine; rua=mailto:d@pct.example');
});

test('pct=0 is reported as a policy applied to nothing', () => {
  const zone = makeZone({ '_dmarc.zero.example|TXT': ['v=DMARC1; p=reject; pct=0; rua=mailto:d@zero.example'] });
  assert.ok(has(analyseDmarc('zero.example', zone), 'dmarc_pct_zero'));
});

test('an external report address with no authorisation record is reported with the exact record to publish', () => {
  const zone = makeZone({
    '_dmarc.ext.example|TXT': ['v=DMARC1; p=none; rua=mailto:x@reports.vendor.example'],
    'ext.example._report._dmarc.reports.vendor.example|TXT': NX,
  });
  const f = pick(analyseDmarc('ext.example', zone), 'dmarc_external_unauthorised');
  assert.equal(f.severity, 'high');
  assert.equal(f.rfc, 'RFC 7489 section 7.1');
  assert.equal(f.suggest.name, 'ext.example._report._dmarc.reports.vendor.example');
  assert.equal(f.suggest.value, 'v=DMARC1');
});

test('an external report address with the authorisation record in place passes', () => {
  const zone = makeZone({
    '_dmarc.ext.example|TXT': ['v=DMARC1; p=none; rua=mailto:x@reports.vendor.example'],
    'ext.example._report._dmarc.reports.vendor.example|TXT': ['v=DMARC1'],
  });
  const r = analyseDmarc('ext.example', zone);
  assert.ok(!has(r, 'dmarc_external_unauthorised'));
  assert.ok(has(r, 'dmarc_external_ok'));
});

test('a report address inside the same organizational domain needs no authorisation', () => {
  assert.equal(organizationalDomain('mail.shop.co.uk'), 'shop.co.uk');
  assert.equal(dmarcAuthorisationName('a.example', 'b.example'), 'a.example._report._dmarc.b.example');
  const zone = makeZone({ '_dmarc.news.shop.example|TXT': ['v=DMARC1; p=none; rua=mailto:d@shop.example'] });
  const r = analyseDmarc('news.shop.example', zone);
  assert.ok(!has(r, 'dmarc_external_unauthorised'));
});

test('a report address with no mailto scheme is never used by a receiver', () => {
  const zone = makeZone({ '_dmarc.scheme.example|TXT': ['v=DMARC1; p=none; rua=dmarc@scheme.example'] });
  const f = pick(analyseDmarc('scheme.example', zone), 'dmarc_rua_scheme');
  assert.equal(f.suggest.value, 'v=DMARC1; p=none; rua=mailto:dmarc@scheme.example');
});

test('a missing p tag is reported and the record is rebuilt with p=none', () => {
  const zone = makeZone({ '_dmarc.nop.example|TXT': ['v=DMARC1; rua=mailto:d@nop.example'] });
  const f = pick(analyseDmarc('nop.example', zone), 'dmarc_p_missing');
  assert.equal(f.severity, 'critical');
  assert.equal(f.suggest.value, 'v=DMARC1; p=none; rua=mailto:d@nop.example');
});

test('a policy value DMARC does not define is corrected to none', () => {
  const zone = makeZone({ '_dmarc.typo.example|TXT': ['v=DMARC1; p=rejected; rua=mailto:d@typo.example'] });
  const f = pick(analyseDmarc('typo.example', zone), 'dmarc_p_invalid');
  assert.equal(f.suggest.value, 'v=DMARC1; p=none; rua=mailto:d@typo.example');
});

test('two DMARC records mean DMARC is not applied at all', () => {
  const zone = makeZone({
    '_dmarc.dup.example|TXT': ['v=DMARC1; p=reject; rua=mailto:a@dup.example', 'v=DMARC1; p=none'],
  });
  const f = pick(analyseDmarc('dup.example', zone), 'dmarc_multiple');
  assert.equal(f.severity, 'critical');
  assert.equal(f.suggest.value, 'v=DMARC1; p=reject; rua=mailto:a@dup.example');
});

test('a DMARC record published at the domain itself is never read', () => {
  const zone = makeZone({
    'apex.example|TXT': ['v=DMARC1; p=reject; rua=mailto:d@apex.example'],
    '_dmarc.apex.example|TXT': NX,
  });
  const f = pick(analyseDmarc('apex.example', zone), 'dmarc_at_apex');
  assert.equal(f.severity, 'critical');
  assert.equal(f.suggest.name, '_dmarc.apex.example');
  assert.equal(f.suggest.value, 'v=DMARC1; p=reject; rua=mailto:d@apex.example');
});

test('a missing DMARC record is answered with the safe monitoring record', () => {
  const zone = makeZone({ '_dmarc.bare.example|TXT': NX });
  const f = pick(analyseDmarc('bare.example', zone), 'dmarc_missing');
  assert.equal(f.severity, 'critical');
  assert.equal(f.suggest.value, 'v=DMARC1; p=none; rua=mailto:dmarc@bare.example');
});

test('p=reject and guessed selectors do not establish absent DKIM or rejection', () => {
  const zone = makeZone({
    'harsh.example|TXT': NX,
    'harsh.example|MX': NX,
    'harsh.example|A': NX,
    'harsh.example|AAAA': NX,
    '_dmarc.harsh.example|TXT': ['v=DMARC1; p=reject; rua=mailto:d@harsh.example'],
    'google._domainkey.harsh.example|TXT': NX,
    '_mta-sts.harsh.example|TXT': NX,
    '_smtp._tls.harsh.example|TXT': NX,
    'default._bimi.harsh.example|TXT': NX,
  });
  const r = analyse('harsh.example', zone, { selectors: GOOGLE_ONLY });
  assert.ok(!has(r, 'dmarc_reject_without_auth'), idsOf(r).join(', '));
  assert.equal(r.areas.dkim.state, 'unknown');
  assert.equal(r.verdict.level, 'unknown');
  assert.ok(!r.findings.some((f) => /being refused at every receiver|neither SPF nor DKIM/.test(f.title + f.detail)));
});

test('the tags a receiver ignores are still pointed out as probable typos', () => {
  const zone = makeZone({ '_dmarc.tag.example|TXT': ['v=DMARC1; p=none; rua=mailto:d@tag.example; ruaa=mailto:x@tag.example'] });
  const f = pick(analyseDmarc('tag.example', zone), 'dmarc_unknown_tag');
  assert.equal(f.severity, 'low');
  assert.match(f.title, /ruaa/);
});

test('report URIs are parsed with their size limit suffix removed', () => {
  assert.deepEqual(parseDmarcUris('mailto:a@x.example!10m,mailto:b@y.example').map((u) => u.domain), ['x.example', 'y.example']);
});

// ══════════════════════════════ 5. MX ══════════════════════════════════

test('a null MX is read as a deliberate statement, not as a fault', () => {
  const zone = makeZone({ 'nullmx.example|MX': [[0, '.']] });
  const r = analyseMx('nullmx.example', zone);
  const f = pick(r, 'mx_null');
  assert.equal(f.severity, 'info');
  assert.equal(f.rfc, 'RFC 7505 section 3');
  assert.equal(r.nullMx, true);
});

test('a null MX mixed with real hosts is a contradiction', () => {
  const zone = makeZone({
    'mixed.example|MX': [[0, '.'], [10, 'mx.mixed.example']],
    'mx.mixed.example|A': ['192.0.2.1'],
    'mx.mixed.example|AAAA': { status: 0, records: [] },
    'mx.mixed.example|CNAME': { status: 0, records: [] },
  });
  assert.ok(has(analyseMx('mixed.example', zone), 'mx_null_mixed'));
});

test('an MX pointing at an alias is reported with the real host to publish instead', () => {
  const zone = makeZone({
    'cn.example|MX': [[10, 'mail.cn.example']],
    'mail.cn.example|CNAME': ['real.mailhost.example'],
    'mail.cn.example|A': ['192.0.2.20'],
    'mail.cn.example|AAAA': { status: 0, records: [] },
  });
  const f = pick(analyseMx('cn.example', zone), 'mx_cname');
  assert.equal(f.severity, 'high');
  assert.equal(f.rfc, 'RFC 2181 section 10.3');
  assert.equal(f.suggest.name, 'cn.example');
  assert.equal(f.suggest.type, 'MX');
  assert.equal(f.suggest.value, '10 real.mailhost.example');
});

test('an MX host with no address at all means mail bounces', () => {
  const zone = makeZone({
    'dead.example|MX': [[10, 'gone.dead.example']],
    'gone.dead.example|A': { status: 0, records: [] },
    'gone.dead.example|AAAA': { status: 0, records: [] },
    'gone.dead.example|CNAME': { status: 0, records: [] },
  });
  const f = pick(analyseMx('dead.example', zone), 'mx_unresolvable');
  assert.equal(f.severity, 'critical');
});

test('no MX on a domain that publishes SPF is a send only domain, not a failure', () => {
  const zone = makeZone({
    'send.example|MX': { status: 0, records: [] },
    'send.example|TXT': ['v=spf1 include:amazonses.com ~all'],
    'send.example|A': { status: 0, records: [] },
  });
  const f = pick(analyseMx('send.example', zone), 'mx_missing');
  assert.equal(f.severity, 'medium');
  assert.match(f.detail, /send only domain/);
});

// ═════════════════ 6. MTA-STS, TLS-RPT, BIMI, nothing ═════════════════

test('MTA-STS is offered as optional and its policy file is honestly out of reach', () => {
  const absent = analyseMtaSts('x.example', makeZone({ '_mta-sts.x.example|TXT': NX }), { hasMx: true });
  const f = pick(absent, 'mtasts_missing');
  assert.equal(f.level, 'optional');
  assert.match(f.suggest.value, /^v=STSv1; id=\d{10}$/);

  const present = analyseMtaSts('x.example', makeZone({ '_mta-sts.x.example|TXT': ['v=STSv1; id=2026091801'] }), { hasMx: true });
  assert.match(pick(present, 'mtasts_present').detail, /cannot fetch for you/);
});

test('an MTA-STS record with no usable id is reported', () => {
  const r = analyseMtaSts('x.example', makeZone({ '_mta-sts.x.example|TXT': ['v=STSv1; id=not a valid id!'] }), { hasMx: true });
  assert.ok(has(r, 'mtasts_bad_id'));
});

test('a TLS-RPT record without a usable rua does nothing', () => {
  const r = analyseTlsRpt('x.example', makeZone({ '_smtp._tls.x.example|TXT': ['v=TLSRPTv1; rua=tlsrpt@x.example'] }), { hasMx: true });
  const f = pick(r, 'tlsrpt_bad_rua');
  assert.equal(f.suggest.value, 'v=TLSRPTv1; rua=mailto:tlsrpt@x.example');
});

test('BIMI at p=none is reported as doing nothing yet, and never as an RFC', () => {
  const zone = makeZone({ 'default._bimi.b.example|TXT': ['v=BIMI1; l=https://b.example/logo.svg'] });
  const r = analyseBimi('b.example', zone, { dmarcPolicy: 'none' });
  const f = pick(r, 'bimi_needs_enforcement');
  assert.equal(f.severity, 'medium');
  assert.match(f.rfc, /Internet-Draft, not an RFC/);
});

test('a domain with nothing at all reports each missing record once', () => {
  const zone = makeZone({
    'nothing.example|MX': NX,
    'nothing.example|TXT': NX,
    'nothing.example|A': NX,
    'nothing.example|AAAA': NX,
    '_dmarc.nothing.example|TXT': NX,
    'google._domainkey.nothing.example|TXT': NX,
    '_mta-sts.nothing.example|TXT': NX,
    '_smtp._tls.nothing.example|TXT': NX,
    'default._bimi.nothing.example|TXT': NX,
  });
  const r = analyse('nothing.example', zone, { selectors: GOOGLE_ONLY });
  assert.ok(has(r, 'spf_missing'));
  assert.ok(has(r, 'dmarc_missing'));
  assert.ok(has(r, 'mx_missing'));
  assert.ok(has(r, 'dkim_none_found'));
  assert.equal(r.verdict.level, 'unknown');
  assert.match(r.verdict.sentence, /DKIM may use a selector/);
  // Ordered by damage: the critical ones come first.
  assert.equal(r.findings[0].severity, 'critical');
});

// ═══════════════════════ 7. helpers and plumbing ══════════════════════

test('TXT answers are split into their character-strings and joined without spaces', () => {
  assert.deepEqual(parseTxtData('"abc" "def"'), ['abc', 'def']);
  assert.deepEqual(parseTxtData('"v=spf1 -all"'), ['v=spf1 -all']);
  assert.deepEqual(parseTxtData('"he said \\"no\\""'), ['he said "no"']);
  assert.deepEqual(parseTxtData('plain'), ['plain']);
});

test('what a person types is turned into a domain the way a browser would', () => {
  assert.equal(normaliseDomainInput('https://Example.COM/path?x=1'), 'example.com');
  assert.equal(normaliseDomainInput('  andrej@ARLing.sk '), 'arling.sk');
  assert.equal(normaliseDomainInput('example.com.'), 'example.com');
  assert.equal(normaliseDomainInput('example.com:8080'), 'example.com');
  assert.equal(looksLikeDomain('example.com'), true);
  assert.equal(looksLikeDomain('localhost'), false);
  assert.equal(looksLikeDomain('not a domain'), false);
});

test('findings come back ordered by damage, worst first', () => {
  const r = analyse('clean.example', cleanZone, { selectors: GOOGLE_ONLY });
  const order = ['critical', 'high', 'medium', 'low', 'info', 'pass'];
  let last = -1;
  for (const f of r.findings) {
    const rank = order.indexOf(f.severity);
    assert.ok(rank >= last, `${f.id} (${f.severity}) came after a weaker finding`);
    last = rank;
  }
});

test('runChecks streams one area at a time and never asks the network itself', async () => {
  let asked = 0;
  const resolve = async (name, type) => {
    asked++;
    const a = zoneGet(cleanZone, name, type);
    return { status: a.status === -1 ? 3 : a.status, records: a.records };
  };
  const events = [];
  for await (const ev of runChecks('CLEAN.example', { resolve, selectors: GOOGLE_ONLY })) events.push(ev);

  const areas = events.filter((e) => e.type === 'area').map((e) => e.area);
  assert.deepEqual(areas, ['mx', 'spf', 'dmarc', 'mtasts', 'tlsrpt', 'bimi', 'dkim']);
  const done = events[events.length - 1];
  assert.equal(done.type, 'done');
  assert.equal(done.report.domain, 'clean.example');
  assert.equal(done.report.verdict.level, 'good');
  assert.ok(asked > 0);
  // The same answers through the streaming path give the same reading as the
  // one shot path, which is the only way the page and the tests can agree.
  assert.deepEqual(idsOf(done.report), idsOf(analyse('clean.example', cleanZone, { selectors: GOOGLE_ONLY })));
});

test('runChecks refuses something that is not a domain before asking anything', async () => {
  await assert.rejects(async () => {
    for await (const _ of runChecks('not a domain', { resolve: async () => ({ status: 0, records: [] }) })) void _;
  }, /does not look like a domain/);
});

// ══════════════════ 8. the real records of arling.sk ══════════════════
// Captured with DNS over HTTPS from Cloudflare on 18 September 2026. This is
// our own domain, and the fixture is here so that the reading of it is checked
// by the test suite rather than by memory.

const arlingZone = makeZone({
  'arling.sk|MX': [[10, 'mx.zoho.eu'], [20, 'mx2.zoho.eu'], [50, 'mx3.zoho.eu']],
  'mx.zoho.eu|A': ['185.230.212.85'],
  'mx.zoho.eu|AAAA': { status: 0, records: [] },
  'mx.zoho.eu|CNAME': { status: 0, records: [] },
  'mx2.zoho.eu|A': ['185.230.212.86'],
  'mx2.zoho.eu|AAAA': { status: 0, records: [] },
  'mx2.zoho.eu|CNAME': { status: 0, records: [] },
  'mx3.zoho.eu|A': ['185.230.212.87'],
  'mx3.zoho.eu|AAAA': { status: 0, records: [] },
  'mx3.zoho.eu|CNAME': { status: 0, records: [] },
  'arling.sk|A': ['185.199.108.153'],
  'arling.sk|AAAA': ['2606:50c0:8000::153'],
  'arling.sk|TXT': ['zoho-verification=zb34074740.zmverify.zoho.eu', 'v=spf1 include:zohomail.eu a mx include:_spf.m1.websupport.sk -all'],
  'zohomail.eu|TXT': ['v=spf1 include:spf.zohomail.eu -all', 'google-site-verification=rIJrvlQrrdEd1SYLHmSmX-mYWpPmDaDZtNkc2NF4tXo'],
  'spf.zohomail.eu|TXT': ['v=spf1 ip4:185.230.212.0/24 ip4:136.143.188.0/24 -all'],
  '_spf.m1.websupport.sk|TXT': ['v=spf1 ip4:37.9.172.128/25 ip4:37.9.169.0/25 ip4:45.13.137.0/25 ip6:2a00:4b40:aaaa:2101::/64 -all'],
  '_dmarc.arling.sk|TXT': ['v=DMARC1; p=none; rua=mailto:andrej@arling.sk'],
  'zmail._domainkey.arling.sk|TXT': [
    'v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCWmraJJ01Kn0Rmf1XeMrqE+PTDNRDCkEonZgnVFmXqDR7HVSb7pUo0hvQhVW5J8MVAATfzYmrRhvGeW7/wwrb7qpUF4vnOzHI1Uqtm3ITzXodekdIrNnxmngVOi3dE2VAeT+qBZY4hwttUfmd6P2r1oyq/iOOy1Hkd/fGg3YYKQQIDAQAB',
  ],
  'resend._domainkey.arling.sk|TXT': NX,
  '_mta-sts.arling.sk|TXT': NX,
  '_smtp._tls.arling.sk|TXT': NX,
  'default._bimi.arling.sk|TXT': NX,
});

test('arling.sk: our own records read the way we believe they do', () => {
  const r = analyse('arling.sk', arlingZone, {
    selectors: [{ selector: 'zmail', vendor: 'Zoho Mail' }, { selector: 'resend', vendor: 'Resend' }],
  });
  // SPF: include, a, mx, include at the top plus one inside zohomail.eu.
  assert.equal(pick(r, 'spf_lookup_ok').data.count, 5);
  assert.ok(has(r, 'spf_all_fail'));
  // Zoho publishes a 1024 bit key, which is valid and below the recommendation.
  assert.equal(pick(r, 'dkim_key_short').data.bits, 1024);
  // DMARC is monitoring only.
  assert.ok(has(r, 'dmarc_policy_none'));
  assert.equal(pick(r, 'dmarc_policy_none').suggest.value, 'v=DMARC1; p=quarantine; pct=25; rua=mailto:andrej@arling.sk');
  // No MTA-STS, no TLS-RPT, no BIMI.
  assert.ok(has(r, 'mtasts_missing'));
  assert.ok(has(r, 'tlsrpt_missing'));
  assert.ok(has(r, 'bimi_absent'));
  assert.equal(r.counts.critical, 0);
  assert.equal(r.verdict.level, 'ok');
});

test('mail.arling.sk: the Resend subdomain signs but has no SPF record of its own', () => {
  // Also captured on 18 September 2026: the sending subdomain has a DKIM key
  // and an MX for bounces, and no SPF record at all.
  const zone = makeZone({
    'mail.arling.sk|MX': [[10, 'inbound-smtp.eu-west-1.amazonaws.com']],
    'inbound-smtp.eu-west-1.amazonaws.com|A': ['52.94.5.1'],
    'inbound-smtp.eu-west-1.amazonaws.com|AAAA': { status: 0, records: [] },
    'inbound-smtp.eu-west-1.amazonaws.com|CNAME': { status: 0, records: [] },
    'mail.arling.sk|TXT': { status: 0, records: [] },
    'mail.arling.sk|A': { status: 0, records: [] },
    'mail.arling.sk|AAAA': { status: 0, records: [] },
    '_dmarc.mail.arling.sk|TXT': NX,
    '_dmarc.arling.sk|TXT': ['v=DMARC1; p=none; rua=mailto:andrej@arling.sk'],
    'resend._domainkey.mail.arling.sk|TXT': [
      'p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDz5LrYrIbyac11VBVZ15SoCCz8zvU61URzVGpyIysWuza5wGNDCslFH8PcUPVAdknXi7TC8MMWTT3INCrjdYOcnYkFiU0L0/ZmR/47aFwRqlj3cAlLySb87A5RChO5hEWcSuvnBdy5wZ1Q8Goccnkktoav0SmTCx/kvRgbdgzINwIDAQAB',
    ],
    '_mta-sts.mail.arling.sk|TXT': NX,
    '_smtp._tls.mail.arling.sk|TXT': NX,
    'default._bimi.mail.arling.sk|TXT': NX,
  });
  const r = analyse('mail.arling.sk', zone, { selectors: [{ selector: 'resend', vendor: 'Resend' }] });
  assert.ok(has(r, 'spf_missing'), idsOf(r).join(', '));
  // Not "no DMARC": a subdomain with no record of its own inherits the policy
  // of arling.sk, and saying otherwise would send someone to publish a record
  // they do not need.
  assert.ok(!has(r, 'dmarc_missing'));
  const inh = pick(r, 'dmarc_inherited');
  assert.equal(inh.data.inheritedFrom, 'arling.sk');
  assert.equal(inh.data.policy, 'none');
  assert.equal(inh.record.name, '_dmarc.arling.sk');
  // The key has no v tag, which is allowed: DKIM1 is the default.
  assert.equal(pick(r, 'dkim_key_short').data.bits, 1024);
  assert.ok(!has(r, 'dkim_bad_version'));
});

test('a missing SPF record never promises a suggested record it cannot build', () => {
  const unknownMx = makeZone({
    'odd.example|TXT': { status: 0, records: [] },
    'odd.example|MX': [[10, 'mail.some-host.example']],
  });
  const a = pick(analyseSpf('odd.example', unknownMx), 'spf_missing');
  assert.equal(a.suggest, null);
  assert.match(a.detail, /No record is suggested below/);

  const knownMx = makeZone({
    'known.example|TXT': { status: 0, records: [] },
    'known.example|MX': [[10, 'aspmx.l.google.com']],
  });
  const b = pick(analyseSpf('known.example', knownMx), 'spf_missing');
  assert.equal(b.suggest.value, 'v=spf1 include:_spf.google.com ~all');
  assert.match(b.detail, /the record suggested below is built from them/);
});

test('an enforcing domain with no discoverable selector is told why, not accused', () => {
  const zone = makeZone({
    'signed.example|MX': [[10, 'mx.signed.example']],
    'mx.signed.example|A': ['203.0.113.9'],
    'mx.signed.example|AAAA': { status: 0, records: [] },
    'mx.signed.example|CNAME': { status: 0, records: [] },
    'signed.example|A': ['203.0.113.1'],
    'signed.example|AAAA': { status: 0, records: [] },
    'signed.example|TXT': ['v=spf1 ip4:203.0.113.0/24 -all'],
    '_dmarc.signed.example|TXT': ['v=DMARC1; p=reject; rua=mailto:d@signed.example'],
    'google._domainkey.signed.example|TXT': NX,
    '_mta-sts.signed.example|TXT': NX,
    '_smtp._tls.signed.example|TXT': NX,
    'default._bimi.signed.example|TXT': NX,
  });
  const r = analyse('signed.example', zone, { selectors: GOOGLE_ONLY });
  assert.equal(r.counts.high, 0, idsOf(r).join(', '));
  assert.equal(r.verdict.level, 'unknown');
  assert.match(r.verdict.sentence, /DKIM may use a selector that was not checked/);
});

test('a subdomain inherits the organizational domain policy rather than having none', () => {
  const base = {
    'news.shop.example|MX': NX,
    'news.shop.example|TXT': ['v=spf1 include:sendgrid.net ~all'],
    'sendgrid.net|TXT': ['v=spf1 ip4:167.89.0.0/17 ~all'],
    'news.shop.example|A': NX,
    'news.shop.example|AAAA': NX,
    '_dmarc.news.shop.example|TXT': NX,
    'google._domainkey.news.shop.example|TXT': NX,
    '_mta-sts.news.shop.example|TXT': NX,
    '_smtp._tls.news.shop.example|TXT': NX,
    'default._bimi.news.shop.example|TXT': NX,
  };

  // The parent enforces through sp, so the subdomain is protected and is told so.
  const strict = analyse('news.shop.example', makeZone({ ...base, '_dmarc.shop.example|TXT': ['v=DMARC1; p=none; sp=reject; rua=mailto:d@shop.example'] }), { selectors: GOOGLE_ONLY });
  const a = pick(strict, 'dmarc_inherited');
  assert.equal(a.severity, 'pass');
  assert.equal(a.data.policy, 'reject');
  assert.equal(a.suggest, null);
  assert.ok(!has(strict, 'dmarc_missing'));

  // The parent only monitors, so the subdomain only monitors too.
  const loose = analyse('news.shop.example', makeZone({ ...base, '_dmarc.shop.example|TXT': ['v=DMARC1; p=none; rua=mailto:d@shop.example'] }), { selectors: GOOGLE_ONLY });
  const b = pick(loose, 'dmarc_inherited');
  assert.equal(b.severity, 'medium');
  assert.equal(b.data.policy, 'none');
  assert.equal(b.suggest.name, '_dmarc.news.shop.example');
  assert.equal(b.suggest.value, 'v=DMARC1; p=quarantine; rua=mailto:dmarc@shop.example');

  // The parent has nothing either, so there really is no policy.
  const none = analyse('news.shop.example', makeZone({ ...base, '_dmarc.shop.example|TXT': NX }), { selectors: GOOGLE_ONLY });
  assert.ok(has(none, 'dmarc_missing'));
  assert.ok(!has(none, 'dmarc_inherited'));
});

test('the DMARC lookup asks the organizational domain when a subdomain has no record', () => {
  const zone = makeZone({ '_dmarc.news.shop.example|TXT': NX });
  assert.deepEqual(dmarcPending('news.shop.example', zone), [{ name: '_dmarc.shop.example', type: 'TXT' }]);
  // Once the answer is in the zone, nothing more is needed.
  const filled = makeZone({ '_dmarc.news.shop.example|TXT': NX, '_dmarc.shop.example|TXT': ['v=DMARC1; p=reject'] });
  assert.deepEqual(dmarcPending('news.shop.example', filled), []);
});
