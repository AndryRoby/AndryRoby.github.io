// mail.mjs: Mail Doctor core logic.
//
// Given DNS answers, check supported record rules. DNS alone cannot establish
// authentication of a particular message, alignment, or inbox placement.
//
// Everything below the "network" section at the bottom is pure: the analysers
// take a plain object of DNS answers ("a zone") and return findings. Only
// resolveDoh() touches the network, so the whole engine can be tested offline
// against captured answers.
//
// Every rule here is a reading of a published standard against a real record.
// Findings use deterministic rules; common DKIM selector names are probes,
// not evidence that other selectors do not exist. Sources in the rule text of
// each finding:
//   RFC 7208  Sender Policy Framework (SPF) for Authorizing Use of Domains in Email
//   RFC 6376  DomainKeys Identified Mail (DKIM) Signatures
//   RFC 8301  Cryptographic Algorithm and Key Usage Update to DKIM
//   RFC 8463  A New Cryptographic Signature Method for DKIM (Ed25519)
//   RFC 7489  Domain-based Message Authentication, Reporting, and Conformance (DMARC)
//   RFC 8461  SMTP MTA Strict Transport Security (MTA-STS)
//   RFC 8460  SMTP TLS Reporting (TLS-RPT)
//   RFC 7505  A "Null MX" No Service Resource Record for Domains That Accept No Mail
//   RFC 2181  Clarifications to the DNS Specification (aliases in MX data)
//   RFC 1035  Domain Names: Implementation and Specification (255 octet strings)
// BIMI has no RFC. It is an IETF Internet-Draft
// (draft-blank-ietf-bimi), and every BIMI finding says so.
//
// Works as an ES module in the browser and in Node with no dependencies.

// ───────────────────────────── severities ─────────────────────────────

// Ordered by how much damage the finding does, worst first. "pass" is a check
// that came out clean and is worth showing; "info" is context, not a problem.
export const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info', 'pass'];
const SEV_RANK = Object.fromEntries(SEVERITY_ORDER.map((s, i) => [s, i]));

// How binding the rule is. The page prints this next to the finding so a
// recommendation is never presented as an error.
//   must        the standard says MUST / MUST NOT
//   should      the standard says SHOULD / RECOMMENDED
//   optional    the standard is optional to adopt at all
//   practice    not in any standard: operational advice, labelled as such
export const LEVELS = ['must', 'should', 'optional', 'practice'];

// ───────────────────────────── DNS types ──────────────────────────────

export const DNS_TYPE = { A: 1, NS: 2, CNAME: 5, MX: 15, TXT: 16, AAAA: 28 };
const TYPE_NAME = Object.fromEntries(Object.entries(DNS_TYPE).map(([k, v]) => [v, k]));

// DNS RCODEs we care about. 0 = ok (possibly with no answers, "NODATA"),
// 3 = name does not exist ("NXDOMAIN"). -1 is ours: the lookup was not made or
// failed, which is never the same thing as "the record is not there".
export const RCODE = { OK: 0, SERVFAIL: 2, NXDOMAIN: 3, REFUSED: 5, NOT_LOOKED_UP: -1 };

// ─────────────────────────── string helpers ───────────────────────────

function str(v) {
  return typeof v === 'string' ? v : '';
}

/** Lower-case, no trailing dot, no surrounding space. */
export function normaliseName(name) {
  return str(name).trim().replace(/\.+$/, '').toLowerCase();
}

/**
 * Turn what a person typed into a domain name we can look up.
 * Accepts "example.com", "https://example.com/path", "user@example.com",
 * "EXAMPLE.COM." and an internationalised name, which the URL parser converts
 * to its punycode form the same way a browser would.
 * Returns '' when nothing usable is left.
 */
export function normaliseDomainInput(raw) {
  let s = str(raw).trim();
  if (!s) return '';
  if (s.includes('@')) s = s.slice(s.lastIndexOf('@') + 1);
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  s = s.split('/')[0].split('?')[0].split('#')[0];
  s = s.replace(/:\d+$/, '');
  s = s.replace(/\.+$/, '');
  if (!s) return '';
  try {
    const host = new URL('https://' + s).hostname;
    if (host) s = host;
  } catch {
    // Not parseable as a host: fall through with what we have and let the
    // shape check below reject it.
  }
  s = s.replace(/^\[|\]$/g, '').toLowerCase();
  return s;
}

/** A domain we are willing to look up: at least two labels, no spaces. */
export function looksLikeDomain(name) {
  const s = normaliseName(name);
  if (!s || s.length > 253) return false;
  if (/\s/.test(s)) return false;
  const labels = s.split('.');
  if (labels.length < 2) return false;
  return labels.every((l) => l.length >= 1 && l.length <= 63 && /^[a-z0-9_-]+$/.test(l) && !l.startsWith('-') && !l.endsWith('-'));
}

/** Optional s= value from a real DKIM-Signature, never a whole header. */
export function normaliseDkimSelector(raw) {
  const s = normaliseName(raw).replace(/^s\s*=\s*/, '').replace(/;$/, '');
  return s && s.length <= 253 && s.split('.').every((p) => p.length > 0 && p.length <= 63 && /^[a-z0-9_-]+$/.test(p)) ? s : '';
}

/** The fragment is local to the browser; domain/selector are never query parameters. */
export function shareCheckUrl(href, domain, selector = '') {
  const url = new URL(href);
  url.searchParams.delete('domain');
  url.searchParams.delete('selector');
  const fragment = new URLSearchParams();
  const d = normaliseDomainInput(domain);
  if (looksLikeDomain(d)) fragment.set('domain', d);
  const s = normaliseDkimSelector(selector);
  if (s) fragment.set('selector', s);
  url.hash = fragment.toString();
  return url.toString();
}

export function readCheckUrl(href) {
  const url = new URL(href);
  const fragment = new URLSearchParams(url.hash.slice(1));
  const domain = normaliseDomainInput(fragment.get('domain') || url.searchParams.get('domain') || '');
  const selector = normaliseDkimSelector(fragment.get('selector') || url.searchParams.get('selector') || '');
  return { domain: looksLikeDomain(domain) ? domain : '', selector, legacy: url.searchParams.has('domain') || url.searchParams.has('selector') };
}

/**
 * Split the `data` field of a DoH TXT answer into its character-strings.
 * DNS TXT records are made of one or more strings, each at most 255 octets
 * (RFC 1035 section 3.3.14). Both Cloudflare and Google hand them back quoted
 * and space separated: "part one" "part two".
 */
export function parseTxtData(data) {
  const s = str(data);
  if (!s.includes('"')) return [s];
  const out = [];
  let cur = '';
  let inside = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\' && inside && i + 1 < s.length) {
      cur += s[i + 1];
      i++;
      continue;
    }
    if (c === '"') {
      if (inside) out.push(cur);
      cur = '';
      inside = !inside;
      continue;
    }
    if (inside) cur += c;
  }
  if (inside) out.push(cur);
  return out.length ? out : [s];
}

/** The octet length of a string as DNS counts it (UTF-8 bytes). */
export function octetLength(s) {
  let n = 0;
  for (const ch of str(s)) {
    const cp = ch.codePointAt(0);
    n += cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
  }
  return n;
}

// ───────────────────────────── base64 / DER ───────────────────────────

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Decode base64 to bytes without depending on atob or Buffer. */
export function base64ToBytes(input) {
  const s = str(input).replace(/[\s\r\n]+/g, '').replace(/=+$/, '');
  if (!s) return new Uint8Array(0);
  if (/[^A-Za-z0-9+/]/.test(s)) return null;
  const out = new Uint8Array(Math.floor((s.length * 3) / 4));
  let acc = 0;
  let bits = 0;
  let o = 0;
  for (const ch of s) {
    const v = B64.indexOf(ch);
    if (v < 0) return null;
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (acc >> bits) & 0xff;
    }
  }
  return out.subarray(0, o);
}

/** Read one DER tag-length-value at `pos`. Returns null on a malformed one. */
function derRead(bytes, pos) {
  if (!bytes || pos + 1 >= bytes.length) return null;
  const tag = bytes[pos];
  let len = bytes[pos + 1];
  let hdr = 2;
  if (len & 0x80) {
    const n = len & 0x7f;
    if (n === 0 || n > 4 || pos + 2 + n > bytes.length) return null;
    len = 0;
    for (let i = 0; i < n; i++) len = (len << 8) | bytes[pos + 2 + i];
    hdr = 2 + n;
  }
  const start = pos + hdr;
  const end = start + len;
  if (end > bytes.length) return null;
  return { tag, start, end, next: end };
}

/** Bit length of a big-endian unsigned integer held in `bytes`. */
function intBits(bytes) {
  let i = 0;
  while (i < bytes.length && bytes[i] === 0) i++;
  if (i >= bytes.length) return 0;
  let bits = (bytes.length - i - 1) * 8;
  let b = bytes[i];
  while (b) {
    bits++;
    b >>= 1;
  }
  return bits;
}

/**
 * Modulus size in bits of an RSA public key held in a DKIM p= value.
 * Accepts a SubjectPublicKeyInfo (what every provider publishes) and a bare
 * PKCS#1 RSAPublicKey. Returns null when the bytes are not an RSA key.
 */
export function rsaBitsFromKey(bytes) {
  if (!bytes || bytes.length < 16) return null;
  const outer = derRead(bytes, 0);
  if (!outer || outer.tag !== 0x30) return null;
  let inner = derRead(bytes, outer.start);
  if (!inner) return null;
  if (inner.tag === 0x30) {
    // SubjectPublicKeyInfo: AlgorithmIdentifier, then a BIT STRING that wraps
    // the RSAPublicKey sequence after one leading "unused bits" octet.
    const bitstr = derRead(bytes, inner.next);
    if (!bitstr || bitstr.tag !== 0x03) return null;
    const seq = derRead(bytes, bitstr.start + 1);
    if (!seq || seq.tag !== 0x30) return null;
    inner = derRead(bytes, seq.start);
    if (!inner) return null;
  }
  if (inner.tag !== 0x02) return null;
  return intBits(bytes.subarray(inner.start, inner.end));
}

/** The algorithm OID of a SubjectPublicKeyInfo, as a dotted string, or null. */
export function spkiAlgorithmOid(bytes) {
  const outer = derRead(bytes, 0);
  if (!outer || outer.tag !== 0x30) return null;
  const alg = derRead(bytes, outer.start);
  if (!alg || alg.tag !== 0x30) return null;
  const oid = derRead(bytes, alg.start);
  if (!oid || oid.tag !== 0x06) return null;
  const v = bytes.subarray(oid.start, oid.end);
  if (!v.length) return null;
  const parts = [Math.floor(v[0] / 40), v[0] % 40];
  let acc = 0;
  for (let i = 1; i < v.length; i++) {
    acc = acc * 128 + (v[i] & 0x7f);
    if (!(v[i] & 0x80)) {
      parts.push(acc);
      acc = 0;
    }
  }
  return parts.join('.');
}

// ───────────────────────────── the zone ───────────────────────────────
//
// A zone is a plain object keyed "<name>|<TYPE>". Every value is
// { status, records }. A key that is absent means "not looked up yet", which
// the analysers report as unknown rather than as missing.

export function zoneKey(name, type) {
  return normaliseName(name) + '|' + String(type).toUpperCase();
}

/**
 * Build a zone from a readable literal, which is what the fixtures use:
 *   { 'example.com|TXT': ['v=spf1 -all'], 'example.com|MX': [[10,'mx.x.net']] }
 * A plain array is status 0 with those records. `{ status: 3 }` is NXDOMAIN.
 */
export function makeZone(literal) {
  const zone = {};
  for (const [k, v] of Object.entries(literal || {})) {
    const [rawName, rawType] = k.split('|');
    const type = String(rawType || 'TXT').toUpperCase();
    const key = zoneKey(rawName, type);
    if (v && !Array.isArray(v) && typeof v === 'object') {
      zone[key] = { status: v.status == null ? RCODE.OK : v.status, records: normaliseRecords(type, v.records || []) };
      continue;
    }
    zone[key] = { status: RCODE.OK, records: normaliseRecords(type, v || []) };
  }
  return zone;
}

function normaliseRecords(type, list) {
  return (list || []).map((r) => {
    if (type === 'TXT') {
      const strings = Array.isArray(r) ? r.map(str) : typeof r === 'object' && r ? (r.strings || [str(r.text)]) : [str(r)];
      return { strings, text: strings.join('') };
    }
    if (type === 'MX') {
      if (Array.isArray(r)) return { preference: Number(r[0]), exchange: normaliseName(r[1]) };
      if (typeof r === 'string') {
        const m = r.trim().match(/^(\d+)\s+(\S+)$/);
        return m ? { preference: Number(m[1]), exchange: m[2] === '.' ? '' : normaliseName(m[2]) } : { preference: 0, exchange: normaliseName(r) };
      }
      return { preference: Number(r.preference) || 0, exchange: r.exchange === '.' ? '' : normaliseName(r.exchange) };
    }
    if (type === 'CNAME') return { target: normaliseName(typeof r === 'string' ? r : r.target) };
    return { address: str(typeof r === 'string' ? r : r.address).trim() };
  });
}

/** The answer for one name and type, or a "not looked up" placeholder. */
export function zoneGet(zone, name, type) {
  const hit = (zone || {})[zoneKey(name, type)];
  if (hit) return hit;
  return { status: RCODE.NOT_LOOKED_UP, records: [] };
}

const isUnknown = (a) => a.status !== RCODE.OK && a.status !== RCODE.NXDOMAIN;
/** A "void lookup" in RFC 7208 section 4.6.4: NXDOMAIN, or ok with no answers. */
const isVoid = (a) => a.status === RCODE.NXDOMAIN || (a.status === RCODE.OK && a.records.length === 0);

/** All TXT record texts at a name, each with its character-strings kept. */
export function txtAt(zone, name) {
  return zoneGet(zone, name, 'TXT').records;
}

// ───────────────────────────── findings ───────────────────────────────

function finding(f) {
  return {
    id: f.id,
    area: f.area,
    severity: f.severity,
    weight: f.weight == null ? 50 : f.weight,
    title: f.title,
    detail: f.detail,
    // The exact record this reading came from, so nothing is asserted about a
    // record the visitor cannot see for themselves.
    record: f.record || null,
    rule: f.rule,
    rfc: f.rfc,
    level: f.level || 'must',
    // The exact record to publish instead, ready to copy, or null when no
    // single record can honestly be written for them.
    suggest: f.suggest || null,
    data: f.data || null,
  };
}

export function sortFindings(list) {
  return list
    .map((f, i) => ({ f, i }))
    .sort((a, b) => SEV_RANK[a.f.severity] - SEV_RANK[b.f.severity] || a.f.weight - b.f.weight || a.i - b.i)
    .map((x) => x.f);
}

function rec(name, type, text) {
  return { name: normaliseName(name), type, text };
}

// ═══════════════════════════════ SPF ══════════════════════════════════

export const SPF_LOOKUP_LIMIT = 10;
export const SPF_VOID_LIMIT = 2;
const SPF_MECHANISMS = ['all', 'include', 'a', 'mx', 'ptr', 'ip4', 'ip6', 'exists'];
const SPF_LOOKUP_MECHANISMS = ['include', 'a', 'mx', 'ptr', 'exists'];

/** Parse one SPF record into its terms. Pure, no DNS. */
export function parseSpf(text) {
  const raw = str(text).trim();
  const out = { version: null, terms: [], errors: [] };
  const parts = raw.split(/\s+/).filter(Boolean);
  if (!parts.length) {
    out.errors.push('The record is empty.');
    return out;
  }
  if (!/^v=spf1$/i.test(parts[0])) {
    out.errors.push('The record does not start with the version token v=spf1.');
    return out;
  }
  out.version = parts[0];
  for (let i = 1; i < parts.length; i++) {
    const raw2 = parts[i];
    const mod = raw2.match(/^([A-Za-z][A-Za-z0-9._-]*)=(.*)$/);
    if (mod) {
      out.terms.push({ raw: raw2, kind: 'modifier', name: mod[1].toLowerCase(), value: mod[2] });
      continue;
    }
    const m = raw2.match(/^([+\-?~]?)([A-Za-z][A-Za-z0-9_-]*)(?::(.*?))?(\/\/?[0-9]{1,3}(?:\/\/[0-9]{1,3})?)?$/);
    if (!m) {
      out.terms.push({ raw: raw2, kind: 'unknown' });
      out.errors.push(`"${raw2}" is not a valid SPF term.`);
      continue;
    }
    const name = m[2].toLowerCase();
    // A "/" in the term is a CIDR length for a, mx, ip4 and ip6.
    let value = m[3] == null ? null : m[3];
    let cidr = m[4] || null;
    if (value && value.includes('/') && (name === 'ip4' || name === 'ip6' || name === 'a' || name === 'mx')) {
      const cut = value.indexOf('/');
      cidr = value.slice(cut);
      value = value.slice(0, cut);
    }
    if (!SPF_MECHANISMS.includes(name)) {
      out.terms.push({ raw: raw2, kind: 'unknown', name });
      out.errors.push(`"${raw2}" is not a mechanism defined in RFC 7208 and makes the whole record a permanent error.`);
      continue;
    }
    const term = { raw: raw2, kind: 'mechanism', name, qualifier: m[1] || '+', value, cidr };
    if ((name === 'include' || name === 'exists') && !value) {
      out.errors.push(`"${raw2}" needs a domain after a colon, for example ${name}:example.com.`);
      term.malformed = true;
    }
    if ((name === 'ip4' || name === 'ip6') && !value) {
      out.errors.push(`"${raw2}" needs an address after a colon.`);
      term.malformed = true;
    }
    if (name === 'ip4' && value && !isIpv4(value)) {
      out.errors.push(`"${raw2}" does not contain a valid IPv4 address.`);
      term.malformed = true;
    }
    if (name === 'ip6' && value && !isIpv6(value)) {
      out.errors.push(`"${raw2}" does not contain a valid IPv6 address.`);
      term.malformed = true;
    }
    if (name === 'all' && value) {
      out.errors.push(`"${raw2}" is not valid: the all mechanism takes no value.`);
      term.malformed = true;
    }
    out.terms.push(term);
  }
  return out;
}

function isIpv4(s) {
  const p = str(s).split('.');
  return p.length === 4 && p.every((x) => /^\d{1,3}$/.test(x) && Number(x) <= 255);
}

function isIpv6(s) {
  return /^[0-9a-f:]+$/i.test(str(s)) && s.includes(':') && (s.match(/::/g) || []).length <= 1;
}

/** The SPF records published at a name (there must be exactly one). */
export function spfRecordsAt(zone, name) {
  return txtAt(zone, name).filter((r) => /^v=spf1(\s|$)/i.test(r.text.trim()));
}

/** Records that claim to be Sender ID (RFC 4406), which is not SPF. */
function senderIdRecordsAt(zone, name) {
  return txtAt(zone, name).filter((r) => /^spf2\.0\//i.test(r.text.trim()));
}

const MACRO = /%\{/;

/**
 * Walk the SPF record of `domain` through its includes and redirect, counting
 * the DNS lookups the way RFC 7208 section 4.6.4 counts them.
 *
 * The walk is pure: it reads `zone` only. Names it needs but does not find in
 * the zone come back in `pending`, so the caller can fetch them and walk again.
 */
export function walkSpf(domain, zone) {
  const state = {
    root: normaliseName(domain),
    count: 0,
    voidCount: 0,
    voidTerms: [],
    lookupTerms: [],
    pending: [],
    nodes: [],
    permErrors: [],
    loops: [],
    truncated: false,
  };
  const want = (name, type) => {
    const a = zoneGet(zone, name, type);
    if (isUnknown(a) && !state.pending.some((p) => p.name === normaliseName(name) && p.type === type)) {
      state.pending.push({ name: normaliseName(name), type });
    }
    return a;
  };

  function visit(name, depth, via, ancestors = new Set()) {
    const n = normaliseName(name);
    const node = { name: n, depth, via, record: null, terms: [], state: 'ok' };
    state.nodes.push(node);
    if (ancestors.has(n)) {
      node.state = 'loop';
      state.loops.push(n);
      return node;
    }
    // Each recursive branch owns its ancestor path. Shared includes in a
    // diamond are counted again, while only returning to an ancestor loops.
    const branch = new Set(ancestors).add(n);

    const answer = want(n, 'TXT');
    if (isUnknown(answer)) {
      node.state = 'pending';
      return node;
    }
    const records = spfRecordsAt(zone, n);
    if (isVoid(answer)) {
      state.voidCount++;
      state.voidTerms.push({ name: n, why: answer.status === RCODE.NXDOMAIN ? 'the name does not exist' : 'the name exists but has no TXT record' });
    }
    if (!records.length) {
      node.state = 'no-record';
      if (depth > 0) state.permErrors.push({ name: n, via, why: 'there is no SPF record at this name' });
      return node;
    }
    if (records.length > 1) {
      node.state = 'multiple';
      node.records = records.map((r) => r.text);
      if (depth > 0) state.permErrors.push({ name: n, via, why: 'more than one SPF record is published at this name' });
      return node;
    }
    node.record = records[0].text;
    node.strings = records[0].strings;
    const parsed = parseSpf(node.record);
    node.parsed = parsed;
    node.terms = parsed.terms;

    const hasAll = parsed.terms.some((t) => t.kind === 'mechanism' && t.name === 'all');

    for (const t of parsed.terms) {
      // RFC 7208 section 5.1: all always matches, so nothing after it is ever
      // evaluated and nothing after it costs a lookup.
      if (t.kind === 'mechanism' && t.name === 'all') break;
      const isRedirect = t.kind === 'modifier' && t.name === 'redirect';
      if (isRedirect && hasAll) continue; // ignored, see RFC 7208 section 5.1
      const isLookup = (t.kind === 'mechanism' && SPF_LOOKUP_MECHANISMS.includes(t.name)) || isRedirect;
      if (!isLookup) continue;
      if (t.malformed) continue;
      state.count++;
      state.lookupTerms.push({ term: t.raw, at: n, depth, index: state.count });
      if (state.count > 60) {
        state.truncated = true;
        return node;
      }
      const target = isRedirect ? t.value : t.value;
      const hasMacro = MACRO.test(str(target));
      if (t.kind === 'mechanism' && (t.name === 'ptr' || t.name === 'exists')) continue; // needs the sending IP, cannot be resolved here
      if (hasMacro) continue;
      if (t.kind === 'mechanism' && t.name === 'a') {
        const an = target || n;
        const a4 = want(an, 'A');
        const a6 = want(an, 'AAAA');
        if (!isUnknown(a4) && !isUnknown(a6) && isVoid(a4) && isVoid(a6)) {
          state.voidCount++;
          state.voidTerms.push({ name: an, why: 'there is no A or AAAA record at this name, so the term can never match' });
        }
        continue;
      }
      if (t.kind === 'mechanism' && t.name === 'mx') {
        const mn = target || n;
        const mx = want(mn, 'MX');
        if (!isUnknown(mx) && isVoid(mx)) {
          state.voidCount++;
          state.voidTerms.push({ name: mn, why: 'there is no MX record at this name, so the term can never match' });
        }
        continue;
      }
      if (t.kind === 'mechanism' && t.name === 'include') {
        visit(target, depth + 1, t.raw, branch);
        continue;
      }
      if (isRedirect) {
        visit(target, depth + 1, t.raw, branch);
      }
    }
    return node;
  }

  visit(state.root, 0, null);
  return state;
}

/** Names the SPF walk still needs. Fetch them, add them to the zone, repeat. */
export function spfPending(domain, zone) {
  return walkSpf(domain, zone).pending;
}

/** Strictness order used when a record has to be merged or tightened. */
const ALL_QUALIFIERS = { '+': 'pass', '?': 'neutral', '~': 'softfail', '-': 'fail' };

function allTermOf(parsed) {
  return (parsed.terms || []).find((t) => t.kind === 'mechanism' && t.name === 'all') || null;
}

/** Rebuild a record's text from its terms, with the all term replaced. */
function rewriteAll(parsed, qualifier) {
  const kept = parsed.terms.filter((t) => !(t.kind === 'mechanism' && t.name === 'all'));
  return ['v=spf1', ...kept.map((t) => t.raw), qualifier + 'all'].join(' ');
}

function withoutTerms(parsed, drop) {
  const kept = parsed.terms.filter((t) => !drop.includes(t));
  return ['v=spf1', ...kept.map((t) => t.raw)].join(' ');
}

/**
 * Read the SPF side of a domain. Pure.
 * @returns {{present:boolean, record:string|null, findings:Array, walk:object}}
 */
export function analyseSpf(domain, zone) {
  const d = normaliseName(domain);
  const out = [];
  const answer = zoneGet(zone, d, 'TXT');
  const walk = walkSpf(d, zone);
  const records = spfRecordsAt(zone, d);
  const senderId = senderIdRecordsAt(zone, d);

  if (isUnknown(answer)) {
    return { present: false, record: null, state: 'unknown', findings: [], walk };
  }

  if (!records.length) {
    const mx = zoneGet(zone, d, 'MX');
    const suggest = spfSuggestionFor(d, zone);
    out.push(finding({
      id: 'spf_missing',
      area: 'spf',
      severity: 'critical',
      weight: 1,
      title: 'No SPF record',
      detail:
        'Nothing at this domain says which servers may send mail as it. A receiver has no list to check the sending server against, so the SPF result is "none" and the message has to be judged on reputation alone. This is the single cheapest thing to fix, and it is also the thing most often missing on a domain whose mail lands in spam.'
        + (suggest && suggest.fromMx
          ? ' Your MX records name the provider that receives mail for you, so the record suggested below is built from them.'
          : mx.status === RCODE.OK && mx.records.length
            ? ' No record is suggested below, because your MX records point at a host this page does not recognise and inventing an include for the wrong provider would break more than it fixes. Every sending service documents the include it needs; put those in one record ending in ~all.'
            : ' No record is suggested below, because nothing in DNS says who sends for this domain. Every sending service documents the include it needs; put those in one record ending in ~all.'),
      record: rec(d, 'TXT', answer.records.length ? answer.records.map((r) => r.text).join(' | ') : '(no TXT records)'),
      rule: 'A domain that sends mail publishes one TXT record starting with v=spf1 listing the hosts allowed to send for it.',
      rfc: 'RFC 7208 sections 3.1 and 4.5',
      level: 'must',
      suggest,
    }));
    if (senderId.length) {
      out.push(finding({
        id: 'spf_senderid_only',
        area: 'spf',
        severity: 'medium',
        weight: 20,
        title: 'Only a Sender ID record is published',
        detail: 'This record starts with spf2.0/ which is Sender ID (RFC 4406), a different and long abandoned protocol. SPF checkers ignore it completely, so it gives you no protection. It is safe to keep, but it is not an SPF record.',
        record: rec(d, 'TXT', senderId[0].text),
        rule: 'An SPF record is a TXT record whose first token is exactly v=spf1. Records starting spf2.0/ are not SPF.',
        rfc: 'RFC 7208 section 3.1',
        level: 'must',
        suggest,
      }));
    }
    return { present: false, record: null, state: 'fail', findings: out, walk };
  }

  if (records.length > 1) {
    out.push(finding({
      id: 'spf_multiple',
      area: 'spf',
      severity: 'critical',
      weight: 2,
      title: `${records.length} SPF records published`,
      detail: 'When a receiver finds more than one record starting v=spf1 it does not pick one or merge them: the check ends with a permanent error, which most receivers treat as no SPF at all. Both of your records are wasted. They have to be merged into one.',
      record: rec(d, 'TXT', records.map((r) => r.text).join('\n')),
      rule: 'If the TXT records at a domain contain more than one record starting v=spf1, check_host() returns permerror.',
      rfc: 'RFC 7208 section 4.5',
      level: 'must',
      suggest: {
        name: d,
        type: 'TXT',
        value: mergeSpfRecords(records.map((r) => r.text)),
        why: 'One record with the mechanisms of both, keeping the gentler of the two all qualifiers so that nothing which is delivered today starts being rejected.',
      },
    }));
  }

  const record = records[0];
  const parsed = parseSpf(record.text);

  // Character-string limit, RFC 1035 section 3.3.14.
  for (const s of record.strings) {
    if (octetLength(s) > 255) {
      out.push(finding({
        id: 'spf_string_too_long',
        area: 'spf',
        severity: 'high',
        weight: 6,
        title: `A single string in the record is ${octetLength(s)} octets`,
        detail: 'One character-string inside a DNS TXT record may be at most 255 octets. Most DNS interfaces refuse a longer one outright, and those that accept it produce a record that some resolvers cannot read. The fix is not to shorten the policy but to split it into several quoted strings inside the same record: a receiver joins them with nothing in between.',
        record: rec(d, 'TXT', record.text),
        rule: 'A TXT record is made of character-strings of at most 255 octets each; a record longer than that must be published as several strings, which are concatenated without adding spaces.',
        rfc: 'RFC 1035 section 3.3.14 and RFC 7208 section 3.3',
        level: 'must',
        suggest: { name: d, type: 'TXT', value: splitIntoStrings(record.text).map((x) => '"' + x + '"').join(' '), why: 'The same policy, published as several strings inside one record.' },
      }));
      break;
    }
  }

  if (record.strings.length > 1) {
    out.push(finding({
      id: 'spf_multi_string',
      area: 'spf',
      severity: 'info',
      weight: 70,
      title: 'The record is published as several strings',
      detail: `This record is stored as ${record.strings.length} character-strings, which receivers join together with nothing in between. That is correct and normal for a long record. It is worth knowing because a stray space at a join is a common way to break a record that looks right in a control panel.`,
      record: rec(d, 'TXT', record.text),
      rule: 'Several character-strings in one TXT record are treated as if concatenated without adding spaces.',
      rfc: 'RFC 7208 section 3.3',
      level: 'must',
    }));
  }

  if (octetLength(record.text) > 450) {
    out.push(finding({
      id: 'spf_record_long',
      area: 'spf',
      severity: 'low',
      weight: 60,
      title: `The record is ${octetLength(record.text)} octets long`,
      detail: 'A long record makes the DNS answer large enough that it may not fit in a single UDP packet, which forces some resolvers to retry over TCP and makes the check slower and less reliable. The standard asks for the answer to stay under 512 octets, and it says should, not must.',
      record: rec(d, 'TXT', record.text),
      rule: 'The published SPF record should remain small enough that the answer to a query for it fits within 512 octets.',
      rfc: 'RFC 7208 section 3.4',
      level: 'should',
    }));
  }

  for (const err of parsed.errors) {
    out.push(finding({
      id: 'spf_syntax',
      area: 'spf',
      severity: 'critical',
      weight: 3,
      title: 'Syntax error in the record',
      detail: err + ' A receiver that cannot parse the record returns a permanent error for the whole check, so every mechanism in the record, including the ones that are written correctly, is thrown away.',
      record: rec(d, 'TXT', record.text),
      rule: 'A record with a term that is not a defined mechanism or modifier makes check_host() return permerror.',
      rfc: 'RFC 7208 sections 4.6 and 4.6.4',
      level: 'must',
    }));
  }

  // The all mechanism.
  const all = allTermOf(parsed);
  const hasRedirect = parsed.terms.some((t) => t.kind === 'modifier' && t.name === 'redirect');
  if (all) {
    const q = all.qualifier;
    if (q === '+') {
      out.push(finding({
        id: 'spf_all_pass',
        area: 'spf',
        severity: 'critical',
        weight: 4,
        title: 'The record ends in +all, which authorises the entire internet',
        detail: 'A plus qualifier means "this host is allowed". On the all mechanism, which matches every host there is, it tells every receiver in the world that any machine anywhere may send mail as your domain and that SPF says it is legitimate. It is worse than having no SPF record at all, because a receiver now has a written authorisation for the forger. Note that a bare "all" with no qualifier means the same thing: plus is the default.',
        record: rec(d, 'TXT', record.text),
        rule: 'The default qualifier is "+"; a "+" result is pass, meaning the client is authorised to send mail for the domain. The all mechanism always matches.',
        rfc: 'RFC 7208 sections 4.6.2 and 5.1',
        level: 'must',
        suggest: { name: d, type: 'TXT', value: rewriteAll(parsed, '~'), why: 'Softfail marks unlisted senders without rejecting them, so nothing that is delivered today starts bouncing. Move to -all once your DMARC reports show every legitimate sender on the list.' },
      }));
    } else if (q === '?') {
      out.push(finding({
        id: 'spf_all_neutral',
        area: 'spf',
        severity: 'high',
        weight: 8,
        title: 'The record ends in ?all, which says nothing at all',
        detail: 'A question mark is the neutral qualifier, and the standard says a neutral result has to be treated exactly like having no SPF record. Everything before the all mechanism still lists your own senders, but for anyone else the record makes no statement, so a forger is neither allowed nor refused. The record is doing half the work it looks like it is doing.',
        record: rec(d, 'TXT', record.text),
        rule: 'A "?" qualifier gives a neutral result, and a neutral result must be treated exactly like a none result, as if no SPF record existed.',
        rfc: 'RFC 7208 sections 4.6.2 and 5.1',
        level: 'must',
        suggest: { name: d, type: 'TXT', value: rewriteAll(parsed, '~'), why: 'Softfail asks the receiver to accept but mark mail from anything not on your list. It is the safe step before -all.' },
      }));
    } else if (q === '~') {
      out.push(finding({
        id: 'spf_all_softfail',
        area: 'spf',
        severity: 'low',
        weight: 62,
        title: 'The record ends in ~all (softfail)',
        detail: 'Softfail means "this host is probably not allowed to send for me, accept the message but mark it". It is the correct setting while you are still finding out which services send mail as you. Once your DMARC reports show every legitimate sender is on the list, -all is the stronger statement: it tells the receiver the message is not from you.',
        record: rec(d, 'TXT', record.text),
        rule: 'A "~" qualifier gives softfail, a weak statement that the host is not authorised; "-" gives fail, a strong statement. The standard defines both and requires neither: which one to publish is yours to choose.',
        rfc: 'RFC 7208 section 4.6.2',
        level: 'practice',
        suggest: { name: d, type: 'TXT', value: rewriteAll(parsed, '-'), why: 'Only after your DMARC reports show that every legitimate sender is listed. Publishing this while a sender is missing will get that sender rejected.' },
      }));
    } else {
      out.push(finding({
        id: 'spf_all_fail',
        area: 'spf',
        severity: 'pass',
        weight: 10,
        title: 'The record ends in -all',
        detail: 'Anything not listed in the record is declared not to be you. This is the strongest SPF statement and the right end state, as long as every service that sends mail as you really is on the list.',
        record: rec(d, 'TXT', record.text),
        rule: 'A "-" qualifier gives fail: the SPF record specifies that the host is not authorised to send mail for the domain.',
        rfc: 'RFC 7208 section 4.6.2',
        level: 'must',
      }));
    }

    const idx = parsed.terms.indexOf(all);
    const after = parsed.terms.slice(idx + 1).filter((t) => !(t.kind === 'modifier' && (t.name === 'exp' || t.name === 'redirect')));
    if (after.length) {
      out.push(finding({
        id: 'spf_terms_after_all',
        area: 'spf',
        severity: 'high',
        weight: 12,
        title: `${after.length} term${after.length > 1 ? 's are' : ' is'} written after the all mechanism and never used`,
        detail: `The all mechanism matches every host, so evaluation stops there and ${after.map((t) => '"' + t.raw + '"').join(', ')} ${after.length > 1 ? 'are' : 'is'} never read. If any of those name a service that sends mail as you, that service is not authorised at all, whatever the record looks like.`,
        record: rec(d, 'TXT', record.text),
        rule: 'Mechanisms after "all" will never be tested and must be ignored.',
        rfc: 'RFC 7208 section 5.1',
        level: 'must',
        suggest: { name: d, type: 'TXT', value: ['v=spf1', ...parsed.terms.filter((t) => t !== all && !after.includes(t)).map((t) => t.raw), ...after.map((t) => t.raw), all.qualifier + 'all'].join(' '), why: 'The same terms, with all moved to the end where it belongs.' },
      }));
    }

    if (hasRedirect) {
      const r = parsed.terms.find((t) => t.kind === 'modifier' && t.name === 'redirect');
      out.push(finding({
        id: 'spf_redirect_ignored',
        area: 'spf',
        severity: 'high',
        weight: 14,
        title: 'The redirect modifier is ignored because the record also has all',
        detail: `"${r.raw}" looks like it hands the policy over to ${r.value}, but the standard says a redirect must be ignored whenever the record contains an all mechanism, wherever the two appear in the record. Everything in ${r.value} is therefore not part of your policy.`,
        record: rec(d, 'TXT', record.text),
        rule: 'Any redirect modifier must be ignored when there is an all mechanism in the record, regardless of the relative ordering of the terms.',
        rfc: 'RFC 7208 section 5.1',
        level: 'must',
        suggest: { name: d, type: 'TXT', value: withoutTerms(parsed, [all]), why: 'Keep the redirect and drop all, so the policy really is handed over. Keep all and drop the redirect if the other way round is what you meant.' },
      }));
    }
  } else if (!hasRedirect) {
    out.push(finding({
      id: 'spf_no_all',
      area: 'spf',
      severity: 'high',
      weight: 9,
      title: 'The record has no all mechanism',
      detail: 'When no mechanism matches and there is no redirect, the result is neutral, which a receiver has to treat exactly as if you had published nothing. Your own servers still pass, but the record makes no statement about anyone else, which is the part that stops forgery.',
      record: rec(d, 'TXT', record.text),
      rule: 'If none of the mechanisms match and there is no redirect modifier, check_host() returns neutral, which must be treated like none.',
      rfc: 'RFC 7208 sections 4.7 and 4.6.2',
      level: 'must',
      suggest: { name: d, type: 'TXT', value: record.text.trim().replace(/\s+/g, ' ') + ' ~all', why: 'Softfail first. Tighten to -all when your reports show every sender is listed.' },
    }));
  }

  // Deprecated ptr.
  const ptrs = parsed.terms.filter((t) => t.kind === 'mechanism' && t.name === 'ptr');
  if (ptrs.length) {
    out.push(finding({
      id: 'spf_ptr_deprecated',
      area: 'spf',
      severity: 'medium',
      weight: 30,
      title: 'The record uses ptr, which the standard tells you not to use',
      detail: 'The ptr mechanism asks the receiver to do a reverse lookup on the sending address and then a forward lookup on the answer. It is slow, it fails in ways the other mechanisms do not, and it loads the reverse DNS servers of the whole internet. Some receivers skip it entirely, so it is not even reliable protection. It also costs one of your ten lookups.',
      record: rec(d, 'TXT', record.text),
      rule: 'The ptr mechanism is slow, is not as reliable as other mechanisms in cases of DNS errors, and places a large burden on the .arpa name servers; it should not be used.',
      rfc: 'RFC 7208 section 5.5',
      level: 'should',
      suggest: { name: d, type: 'TXT', value: withoutTerms(parsed, ptrs), why: 'The same record without ptr. List the sending hosts with ip4, ip6 or include instead.' },
    }));
  }

  // The ten lookup limit.
  const pendingNow = walk.pending.length > 0;
  if (!pendingNow) {
    const count = walk.count;
    if (count > SPF_LOOKUP_LIMIT) {
      out.push(finding({
        id: 'spf_lookup_limit',
        area: 'spf',
        severity: 'critical',
        weight: 5,
        title: `${count} DNS lookups, and the limit is ${SPF_LOOKUP_LIMIT}`,
        detail:
          `Following every include and redirect to the end, this record costs ${count} DNS lookups. The standard puts a hard ceiling of ten on that count, and exceeding it is a permanent error: a receiver that hits the eleventh lookup stops and throws the whole record away, so even your own servers stop passing SPF. `
          + `The count is the worst case, which is what a receiver pays when nothing matches earlier in the record. The terms that cost a lookup, in the order they are read: ${walk.lookupTerms.map((t) => t.term + (t.at === d ? '' : ' (inside ' + t.at + ')')).join(', ')}.`,
        record: rec(d, 'TXT', record.text),
        rule: 'An implementation must limit the total number of mechanisms and modifiers that do DNS lookups to at most 10 per SPF check, including lookups caused by include and redirect. Exceeding the limit produces a permerror.',
        rfc: 'RFC 7208 section 4.6.4',
        level: 'must',
        suggest: spfTrimSuggestion(d, zone, parsed, ptrs),
        data: { count, limit: SPF_LOOKUP_LIMIT, terms: walk.lookupTerms },
      }));
    } else if (count === SPF_LOOKUP_LIMIT) {
      out.push(finding({
        id: 'spf_lookup_at_limit',
        area: 'spf',
        severity: 'medium',
        weight: 32,
        title: `${count} DNS lookups, exactly on the limit`,
        detail: 'The record is at the ceiling of ten. It works today, but it will break the moment any provider you include adds one include of their own inside their own record, which happens without warning and without anything changing on your side.',
        record: rec(d, 'TXT', record.text),
        rule: 'At most 10 mechanisms and modifiers that do DNS lookups per SPF check.',
        rfc: 'RFC 7208 section 4.6.4',
        level: 'must',
        data: { count, limit: SPF_LOOKUP_LIMIT, terms: walk.lookupTerms },
      }));
    } else {
      out.push(finding({
        id: 'spf_lookup_ok',
        area: 'spf',
        severity: 'pass',
        weight: 12,
        title: `${count} of ${SPF_LOOKUP_LIMIT} DNS lookups used`,
        detail: 'Counted by following every include and redirect to the end, which is the worst case a receiver pays.',
        record: rec(d, 'TXT', record.text),
        rule: 'At most 10 mechanisms and modifiers that do DNS lookups per SPF check.',
        rfc: 'RFC 7208 section 4.6.4',
        level: 'must',
        data: { count, limit: SPF_LOOKUP_LIMIT, terms: walk.lookupTerms },
      }));
    }

    if (walk.voidCount > SPF_VOID_LIMIT) {
      out.push(finding({
        id: 'spf_void_limit',
        area: 'spf',
        severity: 'medium',
        weight: 34,
        title: `${walk.voidCount} of the lookups find nothing at all`,
        detail:
          `A lookup that comes back empty or with a name that does not exist is a void lookup. The standard recommends stopping after two of them and calling the record a permanent error, and most large receivers do. Found: ${walk.voidTerms.map((v) => v.name + ' (' + v.why + ')').join('; ')}.`
          + ' This is a recommendation in the standard, not a requirement, so some receivers will still evaluate the record. It is usually a leftover include for a service you no longer use.',
        record: rec(d, 'TXT', record.text),
        rule: 'Implementations should limit void lookups to two; a default of two is recommended, and exceeding it produces a permerror.',
        rfc: 'RFC 7208 section 4.6.4',
        level: 'should',
        data: { voidCount: walk.voidCount, limit: SPF_VOID_LIMIT, terms: walk.voidTerms },
      }));
    }

    for (const e of walk.permErrors) {
      out.push(finding({
        id: 'spf_include_no_record',
        area: 'spf',
        severity: 'critical',
        weight: 7,
        title: `"${e.via}" points at a name with no usable SPF record`,
        detail: `Evaluating "${e.via}" means fetching the SPF record at ${e.name}, and ${e.why}. That is a permanent error, and a permanent error inside an include is a permanent error for your whole record: nothing in it counts any more, including the parts that are correct.`,
        record: rec(d, 'TXT', record.text),
        rule: 'If no SPF record is found at the target of an include or redirect, or if the target is malformed, the result is permerror.',
        rfc: 'RFC 7208 sections 5.2 and 6.1',
        level: 'must',
        suggest: { name: d, type: 'TXT', value: withoutTerms(parsed, parsed.terms.filter((t) => t.raw === e.via)), why: `The same record without "${e.via}". Remove it if you no longer use that service, or ask the service why their record is missing.` },
      }));
    }

    for (const loop of walk.loops) {
      out.push(finding({
        id: 'spf_loop',
        area: 'spf',
        severity: 'high',
        weight: 16,
        title: `The includes come back to ${loop}`,
        detail: 'One of the records you include includes you again. Receivers stop this with the ten lookup limit, which means the record ends in a permanent error rather than looping forever, but it is always a mistake.',
        record: rec(d, 'TXT', record.text),
        rule: 'The 10 lookup limit exists partly to protect against denial of service through recursive include chains.',
        rfc: 'RFC 7208 sections 4.6.4 and 11.1',
        level: 'must',
      }));
    }
  }

  const state = out.some((f) => f.severity === 'critical') ? 'fail' : out.some((f) => f.severity === 'high' || f.severity === 'medium') ? 'warn' : 'ok';
  return { present: true, record: record.text, state: pendingNow ? 'unknown' : state, findings: out, walk };
}

/** Split a long record into 255 octet quoted strings on term boundaries. */
function splitIntoStrings(text) {
  const words = str(text).trim().split(/\s+/);
  const out = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? cur + ' ' + w : w;
    if (octetLength(next) > 255 && cur) {
      out.push(cur + ' ');
      cur = w;
    } else {
      cur = next;
    }
  }
  if (cur) out.push(cur);
  return out;
}

/** Merge several SPF records into one, keeping the gentler all qualifier. */
export function mergeSpfRecords(texts) {
  const terms = [];
  const quals = [];
  for (const t of texts) {
    const p = parseSpf(t);
    for (const term of p.terms) {
      if (term.kind === 'mechanism' && term.name === 'all') {
        quals.push(term.qualifier);
        continue;
      }
      if (!terms.some((x) => x.raw.toLowerCase() === term.raw.toLowerCase())) terms.push(term);
    }
  }
  // Never suggest +all or ?all. Between softfail and fail, take softfail, so
  // that merging cannot start rejecting mail that is delivered today.
  const q = quals.includes('~') ? '~' : quals.includes('-') && !quals.includes('+') && !quals.includes('?') ? '-' : '~';
  return ['v=spf1', ...terms.map((t) => t.raw), q + 'all'].join(' ');
}

/** Providers we can read straight off an MX record. Nothing is guessed. */
const MX_TO_SPF = [
  [/(^|\.)zoho\.eu$/, 'include:zohomail.eu', 'Zoho Mail (EU)'],
  [/(^|\.)zoho\.com$/, 'include:zoho.com', 'Zoho Mail'],
  [/(^|\.)google\.com$|(^|\.)googlemail\.com$/, 'include:_spf.google.com', 'Google Workspace'],
  [/(^|\.)outlook\.com$/, 'include:spf.protection.outlook.com', 'Microsoft 365'],
  [/(^|\.)messagingengine\.com$/, 'include:spf.messagingengine.com', 'Fastmail'],
  [/(^|\.)protonmail\.ch$|(^|\.)proton\.me$/, 'include:_spf.protonmail.ch', 'Proton Mail'],
  [/(^|\.)mailgun\.org$/, 'include:mailgun.org', 'Mailgun'],
  [/(^|\.)improvmx\.com$/, 'include:spf.improvmx.com', 'ImprovMX'],
  [/(^|\.)yandex\.net$/, 'include:_spf.yandex.net', 'Yandex 360'],
  [/(^|\.)mimecast\.com$/, 'include:_netblocks.mimecast.com', 'Mimecast'],
  [/(^|\.)icloud\.com$|(^|\.)me\.com$/, 'include:icloud.com', 'iCloud Mail'],
];

/** A first SPF record for a domain that has none, built from its real MX. */
function spfSuggestionFor(domain, zone) {
  const mx = zoneGet(zone, domain, 'MX');
  if (mx.status !== RCODE.OK || !mx.records.length) return null;
  if (mx.records.length === 1 && !mx.records[0].exchange) {
    return { name: domain, type: 'TXT', value: 'v=spf1 -all', why: 'Your MX record says this domain accepts no mail. If it sends none either, this record says so and stops anyone forging it.' };
  }
  const includes = [];
  const named = [];
  for (const r of mx.records) {
    for (const [re, inc, who] of MX_TO_SPF) {
      if (re.test(r.exchange) && !includes.includes(inc)) {
        includes.push(inc);
        named.push(who);
      }
    }
  }
  if (!includes.length) return null;
  return {
    name: domain,
    type: 'TXT',
    fromMx: true,
    value: ['v=spf1', ...includes, '~all'].join(' '),
    why: `Built from your own MX records, which point at ${[...new Set(named)].join(' and ')}. Add an include for every other service that sends mail as you before you tighten ~all to -all.`,
  };
}

/** Only suggest dropping terms we can prove can never match. */
function spfTrimSuggestion(domain, zone, parsed, ptrs) {
  const drop = [...ptrs];
  for (const t of parsed.terms) {
    if (t.kind !== 'mechanism') continue;
    if (t.name === 'a' && !t.value) {
      const a4 = zoneGet(zone, domain, 'A');
      const a6 = zoneGet(zone, domain, 'AAAA');
      if (a4.status === RCODE.OK && a6.status === RCODE.OK && !a4.records.length && !a6.records.length) drop.push(t);
    }
    if (t.name === 'mx' && !t.value) {
      const mx = zoneGet(zone, domain, 'MX');
      if (mx.status === RCODE.OK && !mx.records.length) drop.push(t);
    }
  }
  if (!drop.length) return null;
  return {
    name: domain,
    type: 'TXT',
    value: withoutTerms(parsed, drop),
    why: `Drops ${drop.map((t) => '"' + t.raw + '"').join(' and ')}, which cannot match anything: ${drop.length > 1 ? 'those names have' : 'that name has'} no matching record today. That is ${drop.length} lookup${drop.length > 1 ? 's' : ''} back. If it is still over ten, the rest has to come from removing includes for services you no longer use.`,
  };
}

// ══════════════════════════════ DKIM ══════════════════════════════════

// Selectors cannot be discovered from DNS: there is no way to list the names
// under _domainkey. The only honest thing to do is probe the selectors the
// common senders use, and say which ones were tried.
export const DKIM_SELECTORS = [
  { selector: 'google', vendor: 'Google Workspace' },
  { selector: 'selector1', vendor: 'Microsoft 365' },
  { selector: 'selector2', vendor: 'Microsoft 365' },
  { selector: 'k1', vendor: 'Mailchimp, Mandrill' },
  { selector: 'k2', vendor: 'Mailchimp' },
  { selector: 'k3', vendor: 'Mailchimp' },
  { selector: 'mandrill', vendor: 'Mandrill' },
  { selector: 's1', vendor: 'SendGrid, Amazon SES, many others' },
  { selector: 's2', vendor: 'SendGrid, Amazon SES, many others' },
  { selector: 'smtpapi', vendor: 'SendGrid (legacy)' },
  { selector: 'resend', vendor: 'Resend' },
  { selector: 'pm', vendor: 'Postmark' },
  { selector: 'pm1', vendor: 'Postmark' },
  { selector: 'pm2', vendor: 'Postmark' },
  { selector: 'zoho', vendor: 'Zoho Mail' },
  { selector: 'zmail', vendor: 'Zoho Mail' },
  { selector: 'amazonses', vendor: 'Amazon SES' },
  { selector: 'protonmail', vendor: 'Proton Mail' },
  { selector: 'protonmail2', vendor: 'Proton Mail' },
  { selector: 'protonmail3', vendor: 'Proton Mail' },
  { selector: 'fm1', vendor: 'Fastmail' },
  { selector: 'fm2', vendor: 'Fastmail' },
  { selector: 'fm3', vendor: 'Fastmail' },
  { selector: 'mailjet', vendor: 'Mailjet' },
  { selector: 'mx', vendor: 'Mailgun' },
  { selector: 'smtp', vendor: 'Mailgun, generic' },
  { selector: 'krs', vendor: 'Mailgun' },
  { selector: 'sig1', vendor: 'iCloud Mail' },
  { selector: 'zendesk1', vendor: 'Zendesk' },
  { selector: 'zendesk2', vendor: 'Zendesk' },
  { selector: 'ctct1', vendor: 'Constant Contact' },
  { selector: 'ctct2', vendor: 'Constant Contact' },
  { selector: 'titan1', vendor: 'Titan Mail' },
  { selector: 'default', vendor: 'generic, self-hosted' },
  { selector: 'dkim', vendor: 'generic, self-hosted' },
  { selector: 'mail', vendor: 'generic, self-hosted' },
];

export function dkimName(selector, domain) {
  return `${selector}._domainkey.${normaliseName(domain)}`;
}

/** Parse a DKIM key record into its tags. Pure. */
export function parseDkimKey(text) {
  const out = { tags: {}, order: [], errors: [] };
  const s = str(text).trim();
  if (!s) {
    out.errors.push('The record is empty.');
    return out;
  }
  for (const part of s.split(';')) {
    const p = part.trim();
    if (!p) continue;
    const eq = p.indexOf('=');
    if (eq < 0) {
      out.errors.push(`"${p}" is not a tag=value pair.`);
      continue;
    }
    const name = p.slice(0, eq).trim();
    const value = p.slice(eq + 1).trim();
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) {
      out.errors.push(`"${name}" is not a valid tag name.`);
      continue;
    }
    if (name in out.tags) {
      out.errors.push(`The tag "${name}" appears more than once.`);
      continue;
    }
    out.tags[name] = value;
    out.order.push(name);
  }
  return out;
}

/**
 * Read one DKIM key record. Pure.
 * @returns {{selector, name, text, findings, key:{type,bits,revoked,testing}}}
 */
export function analyseDkimKey(domain, selector, record) {
  const name = dkimName(selector, domain);
  const out = [];
  const parsed = parseDkimKey(record.text);
  const t = parsed.tags;
  const key = { type: (t.k || 'rsa').toLowerCase(), bits: null, revoked: false, testing: false, strict: false };

  for (const e of parsed.errors) {
    out.push(finding({
      id: 'dkim_syntax',
      area: 'dkim',
      severity: 'high',
      weight: 20,
      title: `Syntax error in the ${selector} key record`,
      detail: e + ' A verifier that cannot read the key record treats the signature as if there were no key, and the signature fails.',
      record: rec(name, 'TXT', record.text),
      rule: 'A DKIM key record is a sequence of tag=value pairs separated by semicolons.',
      rfc: 'RFC 6376 sections 3.2 and 3.6.1',
      level: 'must',
    }));
  }

  if ('v' in t) {
    if (t.v !== 'DKIM1') {
      out.push(finding({
        id: 'dkim_bad_version',
        area: 'dkim',
        severity: 'high',
        weight: 21,
        title: `The ${selector} key record has v=${t.v}`,
        detail: 'If the version tag is present it has to be exactly DKIM1, and it has to be the first tag in the record. Anything else and a verifier must ignore the key, so every message signed with it fails.',
        record: rec(name, 'TXT', record.text),
        rule: 'If the v tag is specified it must be set to DKIM1, and it must be the first tag in the record.',
        rfc: 'RFC 6376 section 3.6.1',
        level: 'must',
        suggest: { name, type: 'TXT', value: record.text.replace(/v\s*=\s*[^;]*/i, 'v=DKIM1'), why: 'The same key with the version tag corrected.' },
      }));
    } else if (parsed.order[0] !== 'v') {
      out.push(finding({
        id: 'dkim_version_not_first',
        area: 'dkim',
        severity: 'medium',
        weight: 36,
        title: `The version tag is not first in the ${selector} key record`,
        detail: 'The version tag is present but something else comes before it. Most verifiers accept this, but the standard asks for it to be first and some strict implementations will refuse the key.',
        record: rec(name, 'TXT', record.text),
        rule: 'If the v tag is specified it must be the first tag in the record.',
        rfc: 'RFC 6376 section 3.6.1',
        level: 'must',
      }));
    }
  }

  if (!('p' in t)) {
    out.push(finding({
      id: 'dkim_no_p',
      area: 'dkim',
      severity: 'high',
      weight: 22,
      title: `The ${selector} key record has no p tag`,
      detail: 'The p tag carries the public key itself, and it is required. Without it there is nothing for a verifier to check a signature against.',
      record: rec(name, 'TXT', record.text),
      rule: 'p is the public key data, and it is required in a DKIM key record.',
      rfc: 'RFC 6376 section 3.6.1',
      level: 'must',
    }));
    return { selector, name, text: record.text, findings: out, key, tags: t };
  }

  if (t.p === '') {
    key.revoked = true;
    out.push(finding({
      id: 'dkim_revoked',
      area: 'dkim',
      severity: 'high',
      weight: 23,
      title: `The ${selector} key is published as revoked`,
      detail: 'An empty p tag is the way a key is withdrawn: it tells verifiers that this key must no longer be trusted. Any message still signed with this selector fails DKIM. That is correct after a key rotation, and a problem if the service is still signing with it.',
      record: rec(name, 'TXT', record.text),
      rule: 'An empty value for the p tag means that this public key has been revoked.',
      rfc: 'RFC 6376 section 3.6.1',
      level: 'must',
    }));
    return { selector, name, text: record.text, findings: out, key, tags: t };
  }

  const bytes = base64ToBytes(t.p);
  if (!bytes || !bytes.length) {
    out.push(finding({
      id: 'dkim_bad_key',
      area: 'dkim',
      severity: 'high',
      weight: 24,
      title: `The ${selector} public key is not readable`,
      detail: 'The p tag does not decode as base64. The usual cause is a line break or a space that a DNS control panel inserted into the middle of a long key, or a key pasted into two TXT records instead of two strings in one record.',
      record: rec(name, 'TXT', record.text),
      rule: 'The p tag carries the public key encoded in base64.',
      rfc: 'RFC 6376 section 3.6.1',
      level: 'must',
    }));
    return { selector, name, text: record.text, findings: out, key, tags: t };
  }

  if (key.type === 'ed25519') {
    if (bytes.length === 32) {
      out.push(finding({
        id: 'dkim_ed25519_ok',
        area: 'dkim',
        severity: 'pass',
        weight: 24,
        title: `${selector}: a valid Ed25519 key`,
        detail: 'Ed25519 keys are 32 bytes, so they fit in DNS without splitting and they are far cheaper to verify than RSA. Not every receiver supports them yet, so they are normally published alongside an RSA selector rather than instead of one.',
        record: rec(name, 'TXT', record.text),
        rule: 'For k=ed25519 the p tag is the base64 encoding of the 32 octet Ed25519 public key.',
        rfc: 'RFC 8463 section 3',
        level: 'must',
      }));
    } else {
      out.push(finding({
        id: 'dkim_ed25519_bad_length',
        area: 'dkim',
        severity: 'high',
        weight: 24,
        title: `${selector}: the Ed25519 key is ${bytes.length} bytes, not 32`,
        detail: 'An Ed25519 public key in a DKIM record is the raw 32 byte key, not a wrapped one. A key of any other length cannot be used and every signature made with it fails.',
        record: rec(name, 'TXT', record.text),
        rule: 'For k=ed25519 the p tag is the base64 encoding of the 32 octet Ed25519 public key.',
        rfc: 'RFC 8463 section 3',
        level: 'must',
      }));
    }
  } else if (key.type === 'rsa') {
    const bits = rsaBitsFromKey(bytes);
    key.bits = bits;
    if (!bits) {
      out.push(finding({
        id: 'dkim_bad_key',
        area: 'dkim',
        severity: 'high',
        weight: 24,
        title: `The ${selector} public key is not a readable RSA key`,
        detail: 'The p tag decodes from base64 but the bytes are not an RSA public key in the form DKIM expects. The usual cause is a truncated key: DNS control panels often cut a 2048 bit key at 255 characters.',
        record: rec(name, 'TXT', record.text),
        rule: 'The p tag carries the public key, encoded in base64, in the form required for the key type in k.',
        rfc: 'RFC 6376 section 3.6.1',
        level: 'must',
      }));
    } else if (bits < 1024) {
      out.push(finding({
        id: 'dkim_key_too_short',
        area: 'dkim',
        severity: 'high',
        weight: 25,
        title: `${selector}: the RSA key is only ${bits} bits`,
        detail: 'A key under 1024 bits must be rejected outright by a verifier, so every message signed with this selector fails DKIM as surely as if it were unsigned. Ask the service that owns this selector to rotate to a 2048 bit key.',
        record: rec(name, 'TXT', record.text),
        rule: 'Verifiers must not consider signatures using RSA keys of less than 1024 bits as valid.',
        rfc: 'RFC 8301 section 3.2',
        level: 'must',
        data: { bits },
      }));
    } else if (bits < 2048) {
      out.push(finding({
        id: 'dkim_key_short',
        area: 'dkim',
        severity: 'low',
        weight: 55,
        title: `${selector}: the RSA key is ${bits} bits`,
        detail: 'This is a valid key and signatures made with it verify: 1024 bits is the floor a verifier must accept. The standard asks for at least 2048 bits, and the reason it is still common to see 1024 is that a 2048 bit key does not fit in one 255 character DNS string, so some control panels quietly refuse it. This is a recommendation, not a failure.',
        record: rec(name, 'TXT', record.text),
        rule: 'Signers must use RSA keys of at least 1024 bits and should use RSA keys of at least 2048 bits.',
        rfc: 'RFC 8301 section 3.2',
        level: 'should',
        data: { bits },
      }));
    } else {
      out.push(finding({
        id: 'dkim_key_ok',
        area: 'dkim',
        severity: 'pass',
        weight: 24,
        title: `${selector}: a valid ${bits} bit RSA key`,
        detail: 'At or above the 2048 bits the standard asks for.',
        record: rec(name, 'TXT', record.text),
        rule: 'Signers should use RSA keys of at least 2048 bits.',
        rfc: 'RFC 8301 section 3.2',
        level: 'should',
        data: { bits },
      }));
    }
  } else {
    out.push(finding({
      id: 'dkim_unknown_type',
      area: 'dkim',
      severity: 'medium',
      weight: 38,
      title: `${selector}: unknown key type k=${key.type}`,
      detail: 'The only key types defined for DKIM are rsa and ed25519. A verifier that does not recognise the type must treat the key as unusable.',
      record: rec(name, 'TXT', record.text),
      rule: 'Verifiers must ignore any DKIM key record with an unrecognised key type.',
      rfc: 'RFC 6376 section 3.6.1 and RFC 8463 section 3',
      level: 'must',
    }));
  }

  if ('h' in t) {
    const hashes = t.h.split(':').map((x) => x.trim().toLowerCase()).filter(Boolean);
    if (hashes.length && hashes.every((h) => h === 'sha1')) {
      out.push(finding({
        id: 'dkim_sha1_only',
        area: 'dkim',
        severity: 'high',
        weight: 26,
        title: `${selector}: the key allows only SHA-1`,
        detail: 'SHA-1 was withdrawn from DKIM. A verifier that follows the current standard must not validate an rsa-sha1 signature, so this selector produces signatures that modern receivers treat as broken.',
        record: rec(name, 'TXT', record.text),
        rule: 'Signers must not sign with rsa-sha1, and verifiers must not validate signatures using rsa-sha1.',
        rfc: 'RFC 8301 section 3.1',
        level: 'must',
        suggest: { name, type: 'TXT', value: record.text.replace(/h\s*=\s*[^;]*/i, 'h=sha256'), why: 'The same key limited to SHA-256 instead. The signing service has to be switched to SHA-256 as well.' },
      }));
    }
  }

  if ('t' in t) {
    const flags = t.t.split(':').map((x) => x.trim().toLowerCase()).filter(Boolean);
    if (flags.includes('y')) {
      key.testing = true;
      out.push(finding({
        id: 'dkim_testing',
        area: 'dkim',
        severity: 'medium',
        weight: 39,
        title: `${selector}: the key is flagged as being in test mode`,
        detail: 'The y flag tells receivers that you are still testing, and that they must not treat a message from you any differently because its signature failed. It is meant to be removed once signing works. Left in place it quietly cancels the protection DKIM gives you.',
        record: rec(name, 'TXT', record.text),
        rule: 'The y flag means the domain is testing DKIM; verifiers must not treat messages from signers in testing mode differently from unsigned email.',
        rfc: 'RFC 6376 section 3.6.1',
        level: 'must',
        suggest: { name, type: 'TXT', value: record.text.replace(/;?\s*t\s*=\s*[^;]*/i, '').replace(/;\s*$/, ''), why: 'The same key with the testing flag removed, once you have confirmed that your signatures verify.' },
      }));
    }
    if (flags.includes('s')) key.strict = true;
  }

  return { selector, name, text: record.text, findings: out, key, tags: t };
}

/**
 * Read every selector we probed for. Pure: it only reads the zone.
 * `selectors` is the list that was actually probed, so the page can say so.
 */
export function analyseDkim(domain, zone, selectors = DKIM_SELECTORS) {
  const d = normaliseName(domain);
  const out = [];
  const found = [];
  let probed = 0;
  let unknown = 0;

  for (const entry of selectors) {
    const sel = typeof entry === 'string' ? entry : entry.selector;
    const vendor = typeof entry === 'string' ? '' : entry.vendor;
    const name = dkimName(sel, d);
    const answer = zoneGet(zone, name, 'TXT');
    if (isUnknown(answer)) {
      unknown++;
      continue;
    }
    probed++;
    const keys = answer.records.filter((r) => /(^|;)\s*(v\s*=\s*DKIM|p\s*=)/i.test(r.text));
    if (!keys.length) continue;
    if (keys.length > 1) {
      out.push(finding({
        id: 'dkim_multiple',
        area: 'dkim',
        severity: 'high',
        weight: 19,
        title: `${keys.length} key records at the ${sel} selector`,
        detail: 'Only one key record may live at a selector. With two, a verifier has no way to know which one the signature was made with, and most give up.',
        record: rec(name, 'TXT', keys.map((k) => k.text).join('\n')),
        rule: 'A selector name is used to locate a single key record; more than one is an error.',
        rfc: 'RFC 6376 section 3.6.2',
        level: 'must',
      }));
    }
    const read = analyseDkimKey(d, sel, keys[0]);
    read.vendor = vendor;
    found.push(read);
    out.push(...read.findings);
  }

  if (unknown && !probed) {
    return { found: [], probed: 0, state: 'unknown', uncertainty: 'dns', findings: [], selectors };
  }

  if (!found.length) {
    out.push(finding({
      id: 'dkim_none_found',
      area: 'dkim',
      // Deliberately not high. A selector cannot be discovered from DNS, so
      // "we found none" is a statement about what we could ask, not about
      // whether the domain signs its mail. Calling it serious would be a
      // confident claim we have no way to make.
      severity: 'info',
      weight: 18,
      title: `No DKIM key at any of the ${probed} selectors tried`,
      detail:
        'No key was found at the selector names checked. This does not establish whether the domain signs mail: it may use another selector. '
        + (unknown ? `${unknown} selector lookup(s) could not be completed. ` : '')
        + 'Look at a message you actually sent: enter its DKIM-Signature s= value as the optional selector, and use its d= signing domain in the domain field. Selectors requested: '
        + selectors.map((s) => (typeof s === 'string' ? s : s.selector)).join(', ') + '.',
      record: rec('<selector>._domainkey.' + d, 'TXT', '(no record at any selector tried)'),
      rule: 'A DKIM public key lives in a TXT record at <selector>._domainkey.<domain>, and the selector is carried in the s= tag of the signature, not in DNS.',
      rfc: 'RFC 6376 sections 3.6.2 and 6.1.2',
      level: 'must',
      data: { probed },
    }));
  }

  const state = out.some((f) => f.severity === 'critical') ? 'fail' : out.some((f) => f.severity === 'high') ? 'fail' : out.some((f) => f.severity === 'medium') ? 'warn' : 'ok';
  return { found, probed, state: !found.length || unknown ? 'unknown' : state, uncertainty: unknown ? 'dns' : !found.length ? 'selector' : null, findings: out, selectors };
}

// ══════════════════════════════ DMARC ═════════════════════════════════

const DMARC_TAGS = ['v', 'p', 'sp', 'rua', 'ruf', 'adkim', 'aspf', 'pct', 'fo', 'rf', 'ri', 'np'];

/** Parse a DMARC record into its tags. Pure. */
export function parseDmarc(text) {
  const out = { tags: {}, order: [], errors: [] };
  const s = str(text).trim();
  for (const part of s.split(';')) {
    const p = part.trim();
    if (!p) continue;
    const eq = p.indexOf('=');
    if (eq < 0) {
      out.errors.push(`"${p}" is not a tag=value pair. DMARC tags are separated by semicolons, not by commas or spaces.`);
      continue;
    }
    const name = p.slice(0, eq).trim().toLowerCase();
    const value = p.slice(eq + 1).trim();
    if (name in out.tags) {
      out.errors.push(`The tag "${name}" appears more than once.`);
      continue;
    }
    out.tags[name] = value;
    out.order.push(name);
  }
  return out;
}

/** The addresses in a rua or ruf tag, with their domains. */
export function parseDmarcUris(value) {
  return str(value)
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .map((raw) => {
      const noLimit = raw.replace(/!\d+[kmgt]?$/i, '');
      const m = noLimit.match(/^mailto:(.+)$/i);
      if (!m) return { raw, scheme: noLimit.includes(':') ? noLimit.slice(0, noLimit.indexOf(':')).toLowerCase() : null, address: null, domain: null };
      const addr = m[1].trim();
      const at = addr.lastIndexOf('@');
      return { raw, scheme: 'mailto', address: addr, domain: at > 0 ? normaliseName(addr.slice(at + 1)) : null };
    });
}

/**
 * The name at which an external report receiver has to authorise us.
 * RFC 7489 section 7.1.
 */
export function dmarcAuthorisationName(ourDomain, theirDomain) {
  return `${normaliseName(ourDomain)}._report._dmarc.${normaliseName(theirDomain)}`;
}

/**
 * Crude organizational domain: the last two labels, or the last three when the
 * second to last is a known two part public suffix. Used only to decide whether
 * a report address counts as external, and the page says so.
 */
export function organizationalDomain(name) {
  const labels = normaliseName(name).split('.');
  if (labels.length <= 2) return labels.join('.');
  const twoPart = ['co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'com.au', 'net.au', 'org.au', 'co.nz', 'co.za', 'com.br', 'co.jp', 'or.jp', 'ne.jp', 'com.tr', 'co.in', 'com.mx', 'com.ar', 'co.kr'];
  const last2 = labels.slice(-2).join('.');
  if (twoPart.includes(last2)) return labels.slice(-3).join('.');
  return last2;
}

/** Names the DMARC check still needs (external report authorisations). */
export function dmarcPending(domain, zone) {
  const d = normaliseName(domain);
  const org = organizationalDomain(d);
  const answer = zoneGet(zone, '_dmarc.' + d, 'TXT');
  if (isUnknown(answer)) return [{ name: '_dmarc.' + d, type: 'TXT' }];
  const records = answer.records.filter((r) => /^v=DMARC1\s*;?/i.test(r.text.trim()));
  if (!records.length) {
    // A subdomain with no record of its own is not unprotected: policy
    // discovery falls back to the organizational domain. RFC 7489 section 6.6.3.
    if (org !== d && isUnknown(zoneGet(zone, '_dmarc.' + org, 'TXT'))) return [{ name: '_dmarc.' + org, type: 'TXT' }];
    return [];
  }
  const parsed = parseDmarc(records[0].text);
  const out = [];
  for (const tag of ['rua', 'ruf']) {
    for (const uri of parseDmarcUris(parsed.tags[tag])) {
      if (!uri.domain) continue;
      if (organizationalDomain(uri.domain) === org) continue;
      const name = dmarcAuthorisationName(d, uri.domain);
      if (isUnknown(zoneGet(zone, name, 'TXT')) && !out.some((x) => x.name === name)) out.push({ name, type: 'TXT' });
    }
  }
  return out;
}

/** Read the DMARC side of a domain. Pure. */
export function analyseDmarc(domain, zone, context = {}) {
  const d = normaliseName(domain);
  const name = '_dmarc.' + d;
  const out = [];
  let unresolvedAuthorisation = false;
  const answer = zoneGet(zone, name, 'TXT');
  if (isUnknown(answer)) return { present: false, record: null, state: 'unknown', findings: [], policy: null };

  const records = answer.records.filter((r) => /^v=DMARC1\b/i.test(r.text.trim()));

  if (!records.length) {
    // The single most common DMARC mistake: the record at the apex.
    const apex = txtAt(zone, d).find((r) => /^v=DMARC1\b/i.test(r.text.trim()));
    if (apex) {
      out.push(finding({
        id: 'dmarc_at_apex',
        area: 'dmarc',
        severity: 'critical',
        weight: 1,
        title: 'The DMARC record is published at the domain itself, not at _dmarc',
        detail: `A receiver looks for the record only at ${name}. Nothing looks at the apex, so this record is never read and the domain has no DMARC policy at all. The record itself is fine; it is in the wrong place.`,
        record: rec(d, 'TXT', apex.text),
        rule: 'A DMARC policy is published as a TXT record at the subdomain _dmarc of the domain it applies to.',
        rfc: 'RFC 7489 sections 6.1 and 6.6.3',
        level: 'must',
        suggest: { name, type: 'TXT', value: apex.text.trim(), why: 'The same record, at the name a receiver actually queries. Delete the one at the apex afterwards.' },
      }));
      return { present: false, record: null, state: 'fail', findings: out, policy: null };
    }

    const org = organizationalDomain(d);
    if (org !== d) {
      const orgAnswer = zoneGet(zone, '_dmarc.' + org, 'TXT');
      if (isUnknown(orgAnswer)) return { present: false, record: null, state: 'unknown', findings: [], policy: null };
      const orgRecords = orgAnswer.records.filter((r) => /^v=DMARC1\b/i.test(r.text.trim()));
      if (orgRecords.length === 1) {
        const orgParsed = parseDmarc(orgRecords[0].text);
        const effective = ((orgParsed.tags.sp || orgParsed.tags.p || '') + '').toLowerCase();
        const enforcing = effective === 'quarantine' || effective === 'reject';
        out.push(finding({
          id: 'dmarc_inherited',
          area: 'dmarc',
          severity: enforcing ? 'pass' : 'medium',
          weight: enforcing ? 22 : 29,
          title: `No record of its own: this name inherits p=${effective || 'none'} from ${org}`,
          detail:
            `There is no record at _dmarc.${d}, and that is not the same as having no policy. When a receiver finds nothing at a subdomain it looks at the organizational domain, ${org}, and applies its ${orgParsed.tags.sp ? 'sp tag' : 'p tag'}. The effective policy for mail from ${d} is therefore ${effective || 'none'}. `
            + (enforcing
              ? 'That is real protection, inherited rather than published here, which is normal and needs nothing from you.'
              : 'Monitoring only: a forged message from this name is delivered exactly as it would be without DMARC. A subdomain used by one sending service is the easiest place to tighten first, because you know every legitimate sender on it.'),
          record: rec('_dmarc.' + org, 'TXT', orgRecords[0].text),
          rule: 'If no DMARC record is found at the subdomain, the receiver queries the organizational domain and applies its sp tag, or its p tag when sp is absent.',
          rfc: 'RFC 7489 sections 6.3 and 6.6.3',
          level: 'must',
          suggest: enforcing
            ? null
            : { name: '_dmarc.' + d, type: 'TXT', value: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${org}`, why: `A record of its own for ${d}, stricter than the one it inherits. Publish this only for a subdomain where you know every sender, and read a month of reports for ${org} first.` },
          data: { inheritedFrom: org, policy: effective || 'none' },
        }));
        return {
          present: true,
          inherited: org,
          record: orgRecords[0].text,
          state: enforcing ? 'ok' : 'warn',
          findings: out,
          policy: {
            p: effective || 'none',
            sp: null,
            pct: orgParsed.tags.pct == null ? null : orgParsed.tags.pct,
            adkim: (orgParsed.tags.adkim || 'r').toLowerCase(),
            aspf: (orgParsed.tags.aspf || 'r').toLowerCase(),
            rua: parseDmarcUris(orgParsed.tags.rua),
            ruf: parseDmarcUris(orgParsed.tags.ruf),
          },
        };
      }
    }

    {
      out.push(finding({
        id: 'dmarc_missing',
        area: 'dmarc',
        severity: 'critical',
        weight: 2,
        title: 'No DMARC record',
        detail:
          'DMARC is what turns SPF and DKIM into something that protects you. Without it a receiver has no instruction about what to do with a message that claims to be from you and fails both checks, and you get no reports, so you cannot see who is sending as you. Start at p=none, which changes nothing about delivery and only asks receivers to send you a daily summary.',
        record: rec(name, 'TXT', answer.status === RCODE.NXDOMAIN ? '(the name does not exist)' : '(no TXT record)'),
        rule: 'A Domain Owner advertises DMARC participation by adding a DNS TXT record at _dmarc.<domain>.',
        rfc: 'RFC 7489 section 6.1',
        level: 'must',
        suggest: { name, type: 'TXT', value: `v=DMARC1; p=none; rua=mailto:dmarc@${d}`, why: 'p=none changes nothing about how your mail is delivered. It only asks receivers to send a daily report to the address in rua, which is the only way to find out who is sending as you before you tighten the policy.' },
      }));
    }
    return { present: false, record: null, state: 'fail', findings: out, policy: null };
  }

  if (records.length > 1) {
    out.push(finding({
      id: 'dmarc_multiple',
      area: 'dmarc',
      severity: 'critical',
      weight: 3,
      title: `${records.length} DMARC records published`,
      detail: 'When more than one record starting v=DMARC1 is found, policy discovery stops and DMARC is simply not applied to your mail. Two records are the same as no record.',
      record: rec(name, 'TXT', records.map((r) => r.text).join('\n')),
      rule: 'If the remaining record set contains multiple records, policy discovery terminates and DMARC processing is not applied to the message.',
      rfc: 'RFC 7489 section 6.6.3',
      level: 'must',
      suggest: { name, type: 'TXT', value: records[0].text.trim(), why: 'Keep one record and delete the rest. This is the first of the ones found; check it is the one you meant before you delete the other.' },
    }));
  }

  const record = records[0];
  const parsed = parseDmarc(record.text);
  const t = parsed.tags;
  const policy = {
    p: (t.p || '').toLowerCase() || null,
    sp: (t.sp || '').toLowerCase() || null,
    pct: 'pct' in t ? t.pct : null,
    adkim: (t.adkim || 'r').toLowerCase(),
    aspf: (t.aspf || 'r').toLowerCase(),
    rua: parseDmarcUris(t.rua),
    ruf: parseDmarcUris(t.ruf),
  };

  for (const e of parsed.errors) {
    out.push(finding({
      id: 'dmarc_syntax',
      area: 'dmarc',
      severity: 'high',
      weight: 10,
      title: 'Syntax error in the DMARC record',
      detail: e,
      record: rec(name, 'TXT', record.text),
      rule: 'A DMARC record is a sequence of tag=value pairs separated by semicolons.',
      rfc: 'RFC 7489 section 6.4',
      level: 'must',
    }));
  }

  if (parsed.order[0] !== 'v') {
    out.push(finding({
      id: 'dmarc_v_not_first',
      area: 'dmarc',
      severity: 'critical',
      weight: 4,
      title: 'The version tag is not the first tag',
      detail: 'Policy discovery throws away any record that does not start with v=DMARC1. A record with the version anywhere else is discarded before anything else in it is read.',
      record: rec(name, 'TXT', record.text),
      rule: 'Records that do not start with a v= tag identifying the current version of DMARC are discarded.',
      rfc: 'RFC 7489 sections 6.3 and 6.6.3',
      level: 'must',
      suggest: { name, type: 'TXT', value: rebuildDmarc(parsed), why: 'The same tags with v=DMARC1 first.' },
    }));
  }

  if (!('p' in t)) {
    out.push(finding({
      id: 'dmarc_p_missing',
      area: 'dmarc',
      severity: 'critical',
      weight: 5,
      title: 'The record has no p tag',
      detail: 'The p tag is what makes this a policy record. Without it a receiver has no requested policy to apply, and most treat the record as unusable, so you get neither protection nor reports.',
      record: rec(name, 'TXT', record.text),
      rule: 'p is the requested Mail Receiver policy and is required for a policy record.',
      rfc: 'RFC 7489 section 6.3',
      level: 'must',
      suggest: { name, type: 'TXT', value: rebuildDmarc(parsed, { p: 'none' }), why: 'The same record with the policy set to none, which changes nothing about delivery and starts the reports.' },
    }));
  } else if (!['none', 'quarantine', 'reject'].includes(policy.p)) {
    out.push(finding({
      id: 'dmarc_p_invalid',
      area: 'dmarc',
      severity: 'critical',
      weight: 6,
      title: `p=${t.p} is not a policy a receiver understands`,
      detail: 'The only three values are none, quarantine and reject. Anything else and the record is unusable, which leaves the domain with no DMARC at all.',
      record: rec(name, 'TXT', record.text),
      rule: 'The p tag takes one of three values: none, quarantine or reject.',
      rfc: 'RFC 7489 section 6.3',
      level: 'must',
      suggest: { name, type: 'TXT', value: rebuildDmarc(parsed, { p: 'none' }), why: 'Corrected to none, the safe starting point. Move up once the reports look right.' },
    }));
  }

  if ('sp' in t && !['none', 'quarantine', 'reject'].includes(policy.sp)) {
    out.push(finding({
      id: 'dmarc_sp_invalid',
      area: 'dmarc',
      severity: 'high',
      weight: 12,
      title: `sp=${t.sp} is not a policy a receiver understands`,
      detail: 'The subdomain policy takes the same three values as p. An unreadable one makes the whole record unusable at some receivers.',
      record: rec(name, 'TXT', record.text),
      rule: 'The sp tag requests a policy for subdomains and takes none, quarantine or reject.',
      rfc: 'RFC 7489 section 6.3',
      level: 'must',
    }));
  }

  if ('pct' in t) {
    const n = Number(t.pct);
    if (!/^\d+$/.test(str(t.pct)) || n < 0 || n > 100) {
      out.push(finding({
        id: 'dmarc_pct_invalid',
        area: 'dmarc',
        severity: 'high',
        weight: 13,
        title: `pct=${t.pct} is not a whole number between 0 and 100`,
        detail: 'A receiver that cannot read pct may discard the record entirely, and those that do not will fall back to 100. Either way the record is not doing what it says.',
        record: rec(name, 'TXT', record.text),
        rule: 'pct is the percentage of messages to which the policy is applied, expressed as an integer from 0 to 100, default 100.',
        rfc: 'RFC 7489 section 6.3',
        level: 'must',
        suggest: { name, type: 'TXT', value: rebuildDmarc(parsed, { pct: null }), why: 'The same record with pct removed, which means 100 per cent, the default.' },
      }));
    } else if (n === 0) {
      out.push(finding({
        id: 'dmarc_pct_zero',
        area: 'dmarc',
        severity: 'medium',
        weight: 30,
        title: 'pct=0 means the policy is applied to nothing',
        detail: `The record says p=${policy.p}, but pct=0 tells receivers to apply it to none of your mail. Reports still arrive, so this is a legitimate way to stay in monitoring while looking like you have a policy, but it protects nobody.`,
        record: rec(name, 'TXT', record.text),
        rule: 'pct is the percentage of messages from the domain owner mail stream to which the DMARC policy is to be applied.',
        rfc: 'RFC 7489 section 6.3',
        level: 'must',
      }));
    } else if (n < 100 && policy.p !== 'none') {
      out.push(finding({
        id: 'dmarc_pct_partial',
        area: 'dmarc',
        severity: 'info',
        weight: 70,
        title: `The policy is applied to ${n} per cent of your mail`,
        detail: 'A deliberate staging step: the rest of your mail is treated as if the policy were the next weaker one. Worth remembering that the protection is partial until this reaches 100.',
        record: rec(name, 'TXT', record.text),
        rule: 'pct is the percentage of messages to which the DMARC policy is to be applied.',
        rfc: 'RFC 7489 section 6.3',
        level: 'must',
      }));
    }
  }

  for (const tag of ['adkim', 'aspf']) {
    if (tag in t && !['r', 's'].includes(String(t[tag]).toLowerCase())) {
      out.push(finding({
        id: 'dmarc_alignment_invalid',
        area: 'dmarc',
        severity: 'medium',
        weight: 32,
        title: `${tag}=${t[tag]} is not a valid alignment mode`,
        detail: 'Alignment takes r for relaxed, which allows a subdomain, or s for strict, which requires an exact match. Anything else is ignored and the default, relaxed, applies.',
        record: rec(name, 'TXT', record.text),
        rule: `${tag} sets the alignment mode and takes r (relaxed, the default) or s (strict).`,
        rfc: 'RFC 7489 section 6.3',
        level: 'must',
      }));
    }
  }

  if ('fo' in t) {
    const bad = t.fo.split(':').map((x) => x.trim()).filter((x) => x && !['0', '1', 'd', 's'].includes(x.toLowerCase()));
    if (bad.length) {
      out.push(finding({
        id: 'dmarc_fo_invalid',
        area: 'dmarc',
        severity: 'low',
        weight: 58,
        title: `fo=${t.fo} contains a value that is not defined`,
        detail: 'The failure reporting options are 0, 1, d and s, separated by colons. Unknown values are ignored, so this only costs you the forensic reports you thought you had asked for.',
        record: rec(name, 'TXT', record.text),
        rule: 'fo takes 0, 1, d or s, colon separated; the default is 0.',
        rfc: 'RFC 7489 section 6.3',
        level: 'must',
      }));
    }
  }

  if ('ri' in t && !/^\d+$/.test(str(t.ri))) {
    out.push(finding({
      id: 'dmarc_ri_invalid',
      area: 'dmarc',
      severity: 'low',
      weight: 59,
      title: `ri=${t.ri} is not a number of seconds`,
      detail: 'The reporting interval is an integer number of seconds. Receivers fall back to the default of 86400, one report a day.',
      record: rec(name, 'TXT', record.text),
      rule: 'ri is the requested interval between aggregate reports, in seconds, default 86400.',
      rfc: 'RFC 7489 section 6.3',
      level: 'must',
    }));
  }

  const unknownTags = parsed.order.filter((k) => !DMARC_TAGS.includes(k));
  if (unknownTags.length) {
    out.push(finding({
      id: 'dmarc_unknown_tag',
      area: 'dmarc',
      severity: 'low',
      weight: 57,
      title: `The record contains ${unknownTags.length === 1 ? 'a tag' : 'tags'} DMARC does not define: ${unknownTags.join(', ')}`,
      detail: 'Receivers ignore tags they do not know, so nothing breaks. It is worth a look anyway, because an ignored tag is usually a misspelling of one that would have done something.',
      record: rec(name, 'TXT', record.text),
      rule: 'Unknown tags are ignored by receivers.',
      rfc: 'RFC 7489 section 6.3',
      level: 'must',
    }));
  }

  // Report addresses.
  const ruaRaw = str(t.rua);
  if (!ruaRaw) {
    out.push(finding({
      id: 'dmarc_no_rua',
      area: 'dmarc',
      severity: 'high',
      weight: 11,
      title: 'The record asks for no reports',
      detail: 'Without a rua address nobody sends you the daily summary of who has been sending mail as your domain, and that summary is the only way to find out. A policy with no reports is a policy you cannot safely tighten, because you cannot see what you would break.',
      record: rec(name, 'TXT', record.text),
      rule: 'rua names the addresses to which aggregate feedback is sent. The standard makes it optional; it is also the only way a domain owner ever learns who sends mail as them.',
      rfc: 'RFC 7489 section 6.3',
      level: 'practice',
      suggest: { name, type: 'TXT', value: rebuildDmarc(parsed, { rua: `mailto:dmarc@${d}` }), why: 'Reports arrive daily as a small compressed XML attachment, one per receiving provider.' },
    }));
  } else {
    for (const uri of policy.rua.concat(policy.ruf)) {
      if (uri.scheme !== 'mailto') {
        out.push(finding({
          id: 'dmarc_rua_scheme',
          area: 'dmarc',
          severity: 'high',
          weight: 14,
          title: `"${uri.raw}" is not a URI a receiver will use`,
          detail: 'Report destinations are URIs, and in practice the only scheme any receiver supports is mailto. A bare e-mail address with no mailto: in front of it is ignored, so no reports are sent anywhere.',
          record: rec(name, 'TXT', record.text),
          rule: 'rua and ruf take a comma separated list of DMARC URIs; support for mailto is required of all receivers.',
          rfc: 'RFC 7489 sections 6.3 and 6.6.1',
          level: 'must',
          suggest: { name, type: 'TXT', value: rebuildDmarc(parsed, { rua: fixUris(t.rua), ruf: t.ruf ? fixUris(t.ruf) : undefined }), why: 'The same addresses with the mailto: scheme in front of them.' },
        }));
        break;
      }
    }
  }

  // External destination verification, RFC 7489 section 7.1.
  const org = organizationalDomain(d);
  for (const tag of ['rua', 'ruf']) {
    for (const uri of policy[tag]) {
      if (!uri.domain) continue;
      if (organizationalDomain(uri.domain) === org) continue;
      const authName = dmarcAuthorisationName(d, uri.domain);
      const auth = zoneGet(zone, authName, 'TXT');
      if (isUnknown(auth)) { unresolvedAuthorisation = true; continue; }
      const ok = auth.records.some((r) => /^v=DMARC1\b/i.test(r.text.trim()));
      if (ok) {
        out.push(finding({
          id: 'dmarc_external_ok',
          area: 'dmarc',
          severity: 'pass',
          weight: 20,
          title: `${uri.domain} has authorised you to send reports there`,
          detail: `Reports for ${d} go to an address at ${uri.domain}, which is a different domain, so that domain has to say it accepts them. It does.`,
          record: rec(authName, 'TXT', auth.records.map((r) => r.text).join('\n')),
          rule: 'When the domain of a report URI differs from the organizational domain of the record, the receiving domain must publish an authorisation record at <our-domain>._report._dmarc.<their-domain>.',
          rfc: 'RFC 7489 section 7.1',
          level: 'must',
        }));
      } else {
        out.push(finding({
          id: 'dmarc_external_unauthorised',
          area: 'dmarc',
          severity: 'high',
          weight: 15,
          title: `${uri.domain} has not authorised you to send reports there`,
          detail: `The ${tag} address ${uri.address} is at ${uri.domain}, which is outside your domain. To stop DMARC being used to flood a third party with reports, a receiver must first check that ${uri.domain} agrees, by looking for a record at ${authName}. There is nothing there, so most receivers will not send your reports at all. If you are using a DMARC reporting service, this is the record they should have told you to add on their side, or the one you add on yours if the address is yours.`,
          record: rec(name, 'TXT', record.text),
          rule: 'If the host part of a report URI is not within the organizational domain of the record, the receiver must query for an authorisation record and must not send reports without it.',
          rfc: 'RFC 7489 section 7.1',
          level: 'must',
          suggest: { name: authName, type: 'TXT', value: 'v=DMARC1', why: `This record is published by whoever runs ${uri.domain}, not by you. It is the whole record: those nine characters are enough.` },
        }));
      }
    }
  }

  // The policy itself.
  if (policy.p === 'none') {
    const hasRua = policy.rua.length > 0;
    out.push(finding({
      id: 'dmarc_policy_none',
      area: 'dmarc',
      severity: 'medium',
      weight: 28,
      title: 'p=none: receivers are asked to do nothing',
      detail:
        'This is monitoring, not protection. A message that claims to be from you and fails both SPF and DKIM is delivered exactly as it would be without DMARC. It is the correct place to start, and the wrong place to stay: the reports are there so you can find every legitimate sender, get them passing, and then move to quarantine and reject. '
        + (hasRua ? 'You are collecting reports, which is the part that matters. Read a month of them before you move.' : 'You are not even collecting reports, so this record is doing nothing at all.'),
      record: rec(name, 'TXT', record.text),
      rule: 'p=none requests that no specific action be taken regarding delivery of messages that fail the DMARC check. Moving beyond it is a deployment decision, not something the standard requires.',
      rfc: 'RFC 7489 section 6.3',
      level: 'practice',
      suggest: hasRua
        ? { name, type: 'TXT', value: rebuildDmarc(parsed, { p: 'quarantine', pct: '25' }), why: 'The next step, and only once a month of reports shows every legitimate sender passing. pct=25 applies it to a quarter of your mail so that a mistake is visible before it is expensive.' }
        : { name, type: 'TXT', value: rebuildDmarc(parsed, { rua: `mailto:dmarc@${d}` }), why: 'Add the report address first. Tightening the policy before you can see who sends as you is how legitimate mail gets lost.' },
    }));
  } else if (policy.p === 'quarantine') {
    out.push(finding({
      id: 'dmarc_policy_quarantine',
      area: 'dmarc',
      severity: 'pass',
      weight: 21,
      title: 'p=quarantine: failing mail is asked to be treated as suspicious',
      detail: 'A message that claims to be from you and fails DMARC is asked to be put in the spam folder rather than the inbox. This is real protection and the usual step before reject.',
      record: rec(name, 'TXT', record.text),
      rule: 'p=quarantine asks receivers to treat mail that fails the DMARC check as suspicious.',
      rfc: 'RFC 7489 section 6.3',
      level: 'must',
    }));
  } else if (policy.p === 'reject') {
    out.push(finding({
      id: 'dmarc_policy_reject',
      area: 'dmarc',
      severity: 'pass',
      weight: 20,
      title: 'p=reject: failing mail is asked to be refused',
      detail: 'This policy requests rejection of messages that fail DMARC. Receivers can apply their own local policy; DNS records alone do not show whether a particular message passes DMARC or is delivered.',
      record: rec(name, 'TXT', record.text),
      rule: 'p=reject asks receivers to refuse mail that fails the DMARC check.',
      rfc: 'RFC 7489 section 6.3',
      level: 'must',
    }));
    // No-selector-found is not proof of absent DKIM. Do not infer actual
    // message rejection from a finite set of guessed public key names.
  }

  if (!('sp' in t) && policy.p && policy.p !== 'none') {
    out.push(finding({
      id: 'dmarc_no_sp',
      area: 'dmarc',
      severity: 'info',
      weight: 72,
      title: `Subdomains inherit p=${policy.p}`,
      detail: 'With no sp tag, every subdomain gets the same policy as the domain itself. That is usually what you want. Add sp only if a subdomain needs a different one, and remember that a subdomain used by a newsletter service is exactly the case where people get this wrong.',
      record: rec(name, 'TXT', record.text),
      rule: 'If sp is absent the policy in p applies to subdomains as well.',
      rfc: 'RFC 7489 section 6.3',
      level: 'must',
    }));
  }

  const state = out.some((f) => f.severity === 'critical') ? 'fail' : out.some((f) => f.severity === 'high' || f.severity === 'medium') ? 'warn' : 'ok';
  return { present: true, record: record.text, state: unresolvedAuthorisation ? 'unknown' : state, findings: out, policy };
}

function fixUris(value) {
  return parseDmarcUris(value)
    .map((u) => (u.scheme === 'mailto' ? u.raw : 'mailto:' + u.raw))
    .join(',');
}

/** Rebuild a DMARC record with v first, in the canonical tag order. */
function rebuildDmarc(parsed, changes = {}) {
  const tags = { ...parsed.tags };
  for (const [k, v] of Object.entries(changes)) {
    if (v === null) delete tags[k];
    else if (v !== undefined) tags[k] = v;
  }
  tags.v = 'DMARC1';
  const order = ['v', 'p', 'sp', 'adkim', 'aspf', 'pct', 'fo', 'rf', 'ri', 'rua', 'ruf'];
  const seen = new Set();
  const parts = [];
  for (const k of order) {
    if (k in tags) {
      parts.push(`${k}=${tags[k]}`);
      seen.add(k);
    }
  }
  for (const k of Object.keys(tags)) if (!seen.has(k)) parts.push(`${k}=${tags[k]}`);
  return parts.join('; ');
}

// ═══════════════════════════════ MX ═══════════════════════════════════

/** Names the MX check still needs, to see whether each host resolves. */
export function mxPending(domain, zone) {
  const mx = zoneGet(zone, domain, 'MX');
  if (isUnknown(mx)) return [{ name: normaliseName(domain), type: 'MX' }];
  const out = [];
  for (const r of mx.records) {
    if (!r.exchange) continue;
    for (const type of ['A', 'AAAA', 'CNAME']) {
      if (isUnknown(zoneGet(zone, r.exchange, type))) out.push({ name: r.exchange, type });
    }
  }
  return out;
}

/** Read the MX side of a domain. Pure. */
export function analyseMx(domain, zone) {
  const d = normaliseName(domain);
  const out = [];
  const answer = zoneGet(zone, d, 'MX');
  if (isUnknown(answer)) return { present: false, hosts: [], state: 'unknown', findings: [] };

  const records = [...answer.records].sort((a, b) => a.preference - b.preference);

  if (!records.length) {
    const a4 = zoneGet(zone, d, 'A');
    const sends = spfRecordsAt(zone, d).length > 0;
    out.push(finding({
      id: 'mx_missing',
      area: 'mx',
      severity: sends ? 'medium' : 'high',
      weight: sends ? 40 : 17,
      title: 'No MX record',
      detail:
        'Nothing says where mail addressed to this domain should be delivered. A sender falls back to the address record of the domain itself, which for a web host means mail is thrown at a web server that does not accept it, and messages to you bounce. '
        + (sends
          ? 'This domain does publish an SPF record, so it looks like a send only domain, which is a normal and deliberate setup for a newsletter or transactional subdomain. If it is meant to receive mail as well, the MX record is missing.'
          : 'If this domain is not supposed to receive mail at all, say so deliberately with a null MX record rather than by leaving it empty.'),
      record: rec(d, 'MX', answer.status === RCODE.NXDOMAIN ? '(the name does not exist)' : '(no MX record)'),
      rule: 'Mail is routed to the hosts named in a domain MX records; a domain that accepts no mail says so with a single MX of preference 0 and an exchange of ".".',
      rfc: 'RFC 5321 section 5.1 and RFC 7505 section 3',
      level: 'must',
      suggest: sends || a4.records.length ? null : { name: d, type: 'MX', value: '0 .', why: 'The null MX record: it tells every sender that this domain accepts no mail, so they refuse the message immediately instead of queueing it for days.' },
    }));
    return { present: false, hosts: [], state: 'fail', findings: out };
  }

  const nullMx = records.length === 1 && !records[0].exchange && records[0].preference === 0;
  if (nullMx) {
    out.push(finding({
      id: 'mx_null',
      area: 'mx',
      severity: 'info',
      weight: 68,
      title: 'Null MX: this domain accepts no mail on purpose',
      detail: 'A single MX with preference 0 and an exchange of a lone dot is the standard way to say that a domain receives no mail. Senders refuse the message straight away instead of retrying for days. This is deliberate and correct for a domain that only sends, or only serves a website.',
      record: rec(d, 'MX', '0 .'),
      rule: 'A domain that accepts no mail publishes a single MX resource record with an RDATA section of "." and preference 0.',
      rfc: 'RFC 7505 section 3',
      level: 'must',
    }));
    return { present: true, hosts: [], nullMx: true, state: 'ok', findings: out };
  }

  if (records.some((r) => !r.exchange) && records.length > 1) {
    out.push(finding({
      id: 'mx_null_mixed',
      area: 'mx',
      severity: 'high',
      weight: 18,
      title: 'A null MX is published alongside real mail servers',
      detail: 'The null MX has to be the only MX record there is. Mixed with real hosts it is a contradiction, and different senders resolve the contradiction differently, so some of your mail is refused and some is delivered.',
      record: rec(d, 'MX', records.map((r) => `${r.preference} ${r.exchange || '.'}`).join('\n')),
      rule: 'The null MX record must be the only MX resource record for the domain.',
      rfc: 'RFC 7505 section 3',
      level: 'must',
    }));
  }

  const hosts = [];
  for (const r of records) {
    if (!r.exchange) continue;
    const host = { exchange: r.exchange, preference: r.preference, a: 0, aaaa: 0, cname: null, resolved: null };
    const cname = zoneGet(zone, r.exchange, 'CNAME');
    const a4 = zoneGet(zone, r.exchange, 'A');
    const a6 = zoneGet(zone, r.exchange, 'AAAA');
    host.a = a4.records.length;
    host.aaaa = a6.records.length;
    if (!isUnknown(cname) && cname.records.length) {
      host.cname = cname.records[0].target;
      out.push(finding({
        id: 'mx_cname',
        area: 'mx',
        severity: 'high',
        weight: 19,
        title: `The MX host ${r.exchange} is an alias, not a real name`,
        detail: `${r.exchange} is a CNAME pointing at ${host.cname}. The DNS specification says the name in an MX record must not be an alias. Most senders follow the alias anyway, so mail usually arrives, but strict ones refuse it, and the extra lookup is one more thing that can fail.`,
        record: rec(r.exchange, 'CNAME', host.cname),
        rule: 'The domain name used as the value of an MX resource record must not be an alias.',
        rfc: 'RFC 2181 section 10.3',
        level: 'must',
        suggest: { name: d, type: 'MX', value: `${r.preference} ${host.cname}`, why: `Point the MX record straight at ${host.cname} and delete the alias, or give ${r.exchange} its own address records instead of a CNAME.` },
      }));
    }
    if (!isUnknown(a4) && !isUnknown(a6) && !host.a && !host.aaaa && !host.cname) {
      out.push(finding({
        id: 'mx_unresolvable',
        area: 'mx',
        severity: 'critical',
        weight: 8,
        title: `The MX host ${r.exchange} has no address`,
        detail: 'There is no A or AAAA record for this host, so a sender has nowhere to connect. Mail routed to it cannot be delivered at all. If this is the only MX record, mail to the domain bounces.',
        record: rec(d, 'MX', `${r.preference} ${r.exchange}`),
        rule: 'A sender resolves the MX exchange to an address and connects to it; an exchange with no address record cannot receive mail.',
        rfc: 'RFC 5321 section 5.1',
        level: 'must',
      }));
    }
    host.unverified = isUnknown(a4) || isUnknown(a6) || isUnknown(cname);
    host.resolved = host.a > 0 || host.aaaa > 0;
    hosts.push(host);
  }

  const resolvedCount = hosts.filter((h) => h.resolved).length;
  if (hosts.length && resolvedCount === hosts.length) {
    out.push(finding({
      id: 'mx_ok',
      area: 'mx',
      severity: 'pass',
      weight: 22,
      title: `${hosts.length} mail server${hosts.length > 1 ? 's' : ''}, ${hosts.length > 1 ? 'all' : 'and it'} resolve${hosts.length > 1 ? '' : 's'}`,
      detail: hosts.map((h) => `${h.preference} ${h.exchange} (${h.a} IPv4, ${h.aaaa} IPv6)`).join('; ') + '.',
      record: rec(d, 'MX', records.map((r) => `${r.preference} ${r.exchange}`).join('\n')),
      rule: 'Mail is delivered to the MX host with the lowest preference that answers.',
      rfc: 'RFC 5321 section 5.1',
      level: 'must',
    }));
  }

  if (hosts.length === 1 && hosts[0].resolved) {
    out.push(finding({
      id: 'mx_single',
      area: 'mx',
      severity: 'info',
      weight: 74,
      title: 'Only one mail server is listed',
      detail: 'A second MX at a higher preference number gives senders somewhere to queue when the first one is unreachable. Most hosted providers give you two or three; if yours gave you one, that is their design and nothing is wrong.',
      record: rec(d, 'MX', `${hosts[0].preference} ${hosts[0].exchange}`),
      rule: 'A domain may list several MX hosts; senders try them in order of preference.',
      rfc: 'RFC 5321 section 5.1',
      level: 'practice',
    }));
  }

  const state = out.some((f) => f.severity === 'critical') ? 'fail' : out.some((f) => f.severity === 'high') ? 'warn' : 'ok';
  return { present: true, hosts, nullMx: false, state: hosts.some((h) => h.unverified) ? 'unknown' : state, findings: out };
}

// ═════════════════════ MTA-STS, TLS-RPT and BIMI ══════════════════════

export function analyseMtaSts(domain, zone, context = {}) {
  const d = normaliseName(domain);
  const name = '_mta-sts.' + d;
  const answer = zoneGet(zone, name, 'TXT');
  if (isUnknown(answer)) return { present: false, state: 'unknown', findings: [] };
  const records = answer.records.filter((r) => /^v=STSv1\b/i.test(r.text.trim()));
  const out = [];

  if (!records.length) {
    if (context.hasMx) {
      out.push(finding({
        id: 'mtasts_missing',
        area: 'mtasts',
        severity: 'low',
        weight: 64,
        title: 'No MTA-STS policy',
        detail:
          'MTA-STS is how you tell other mail servers that they must use TLS to reach you and must check your certificate. Without it, a sender that is intercepted on the way to you will quietly fall back to an unencrypted connection, because SMTP encryption is opportunistic by default. It is optional, it takes a DNS record and a small file served over HTTPS at mta-sts.'
          + d + ', and it is worth doing if you receive anything confidential.',
        record: rec(name, 'TXT', '(no record)'),
        rule: 'A domain advertises an MTA-STS policy with a TXT record at _mta-sts.<domain> and serves the policy at https://mta-sts.<domain>/.well-known/mta-sts.txt.',
        rfc: 'RFC 8461 sections 3.1 and 3.2',
        level: 'optional',
        suggest: { name, type: 'TXT', value: 'v=STSv1; id=' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '01', why: 'The DNS half. The policy file has to be published at https://mta-sts.' + d + '/.well-known/mta-sts.txt as well, and starting it in testing mode is the safe way in.' },
      }));
    }
    return { present: false, state: 'absent', findings: out };
  }

  const text = records[0].text.trim();
  const id = (text.match(/(^|;)\s*id\s*=\s*([^;]*)/i) || [])[2];
  if (!id || !/^[A-Za-z0-9]{1,32}$/.test(id.trim())) {
    out.push(finding({
      id: 'mtasts_bad_id',
      area: 'mtasts',
      severity: 'medium',
      weight: 42,
      title: 'The MTA-STS record has no usable id',
      detail: 'The id is what tells a sender that your policy has changed and has to be fetched again. It must be one to thirty two letters and digits, nothing else. Without a valid one, senders cannot tell when your policy is updated.',
      record: rec(name, 'TXT', text),
      rule: 'The id field is a short string used to track policy updates, consisting of one to thirty two alphanumeric characters.',
      rfc: 'RFC 8461 section 3.1',
      level: 'must',
    }));
  } else {
    out.push(finding({
      id: 'mtasts_present',
      area: 'mtasts',
      severity: 'pass',
      weight: 30,
      title: 'MTA-STS is advertised',
      detail: `The DNS half is in place with id ${id.trim()}. The other half is the policy file at https://mta-sts.${d}/.well-known/mta-sts.txt, which this page cannot fetch for you: a browser is not allowed to read a page on someone else domain, and that restriction is the same one that keeps this tool from ever seeing your data. Check that file yourself, and check that its mx lines match the MX records above.`,
      record: rec(name, 'TXT', text),
      rule: 'The TXT record advertises the policy; the policy itself is served over HTTPS and lists the permitted MX hosts.',
      rfc: 'RFC 8461 sections 3.1 and 3.2',
      level: 'optional',
    }));
  }
  return { present: true, state: out.some((f) => f.severity === 'medium') ? 'warn' : 'ok', findings: out };
}

export function analyseTlsRpt(domain, zone, context = {}) {
  const d = normaliseName(domain);
  const name = '_smtp._tls.' + d;
  const answer = zoneGet(zone, name, 'TXT');
  if (isUnknown(answer)) return { present: false, state: 'unknown', findings: [] };
  const records = answer.records.filter((r) => /^v=TLSRPTv1\b/i.test(r.text.trim()));
  const out = [];

  if (!records.length) {
    if (context.hasMx) {
      out.push(finding({
        id: 'tlsrpt_missing',
        area: 'tlsrpt',
        severity: 'low',
        weight: 66,
        title: 'No TLS reporting address',
        detail: 'TLS-RPT asks the servers that send you mail to report back when they could not reach you over a verified encrypted connection. It is one TXT record, it costs nothing, and it is the only way to find out that senders have been failing to reach you securely. It is optional and it is most useful next to MTA-STS.',
        record: rec(name, 'TXT', '(no record)'),
        rule: 'A domain requests TLS reports with a TXT record at _smtp._tls.<domain>.',
        rfc: 'RFC 8460 section 3',
        level: 'optional',
        suggest: { name, type: 'TXT', value: `v=TLSRPTv1; rua=mailto:tlsrpt@${d}`, why: 'Reports arrive as a daily JSON summary, one per sending provider.' },
      }));
    }
    return { present: false, state: 'absent', findings: out };
  }

  const text = records[0].text.trim();
  const rua = (text.match(/(^|;)\s*rua\s*=\s*([^;]*)/i) || [])[2];
  if (!rua || !/^(mailto:|https:)/i.test(rua.trim())) {
    out.push(finding({
      id: 'tlsrpt_bad_rua',
      area: 'tlsrpt',
      severity: 'medium',
      weight: 44,
      title: 'The TLS-RPT record has no usable rua',
      detail: 'The rua value has to be a mailto: or https: URI. Without one there is nowhere to send the reports, so the record does nothing.',
      record: rec(name, 'TXT', text),
      rule: 'rua carries a list of URIs, each either a mailto: or an https: URI, to which reports are sent.',
      rfc: 'RFC 8460 section 3',
      level: 'must',
      suggest: { name, type: 'TXT', value: `v=TLSRPTv1; rua=mailto:tlsrpt@${d}`, why: 'A working report address.' },
    }));
  } else {
    out.push(finding({
      id: 'tlsrpt_present',
      area: 'tlsrpt',
      severity: 'pass',
      weight: 31,
      title: 'TLS reports are requested',
      detail: `Senders that fail to reach you over a verified encrypted connection report it to ${rua.trim()}.`,
      record: rec(name, 'TXT', text),
      rule: 'A TLS-RPT record names where daily TLS delivery reports are sent.',
      rfc: 'RFC 8460 section 3',
      level: 'optional',
    }));
  }
  return { present: true, state: out.some((f) => f.severity === 'medium') ? 'warn' : 'ok', findings: out };
}

export function analyseBimi(domain, zone, context = {}) {
  const d = normaliseName(domain);
  const name = 'default._bimi.' + d;
  const answer = zoneGet(zone, name, 'TXT');
  if (isUnknown(answer)) return { present: false, state: 'unknown', findings: [] };
  const records = answer.records.filter((r) => /^v=BIMI1\b/i.test(r.text.trim()));
  const out = [];

  if (!records.length) {
    out.push(finding({
      id: 'bimi_absent',
      area: 'bimi',
      severity: 'info',
      weight: 78,
      title: 'No BIMI record',
      detail:
        'BIMI is what puts your logo next to your name in a supporting mailbox. It is worth knowing two things about it. It is not an RFC: it is an IETF Internet-Draft, so it can still change, and support is up to each mailbox provider. And it only starts working once DMARC is at quarantine or reject applied to all of your mail, which means it is the last step, never the first. Gmail and Apple Mail also want a Verified Mark Certificate, which is bought yearly and is not cheap.',
      record: rec(name, 'TXT', '(no record)'),
      rule: 'A BIMI record is a TXT record at default._bimi.<domain> naming an SVG logo and, for some receivers, a Verified Mark Certificate.',
      rfc: 'draft-blank-ietf-bimi (Internet-Draft, not an RFC)',
      level: 'optional',
    }));
    return { present: false, state: 'absent', findings: out };
  }

  const text = records[0].text.trim();
  const l = (text.match(/(^|;)\s*l\s*=\s*([^;]*)/i) || [])[2];
  if (!l || !/^https:\/\//i.test(l.trim())) {
    out.push(finding({
      id: 'bimi_bad_l',
      area: 'bimi',
      severity: 'medium',
      weight: 46,
      title: 'The BIMI record has no https logo address',
      detail: 'The l tag has to be an https URL pointing at an SVG in the Tiny Portable/Secure profile. Anything else and no mailbox will display the logo.',
      record: rec(name, 'TXT', text),
      rule: 'The l tag carries the location of the brand indicator file, which must be retrieved over HTTPS.',
      rfc: 'draft-blank-ietf-bimi (Internet-Draft, not an RFC)',
      level: 'optional',
    }));
  }
  if (context.dmarcPolicy && context.dmarcPolicy !== 'quarantine' && context.dmarcPolicy !== 'reject') {
    out.push(finding({
      id: 'bimi_needs_enforcement',
      area: 'bimi',
      severity: 'medium',
      weight: 45,
      title: `BIMI is published but DMARC is at p=${context.dmarcPolicy}`,
      detail: 'BIMI is only honoured for a domain whose DMARC policy is quarantine or reject and applies to all of its mail. At p=none the logo is simply never shown, so this record is doing nothing until the DMARC policy moves up.',
      record: rec(name, 'TXT', text),
      rule: 'A domain must have a DMARC policy of quarantine or reject, with pct at 100, for BIMI to be evaluated.',
      rfc: 'draft-blank-ietf-bimi (Internet-Draft, not an RFC)',
      level: 'optional',
    }));
  }
  if (!out.length) {
    out.push(finding({
      id: 'bimi_present',
      area: 'bimi',
      severity: 'pass',
      weight: 32,
      title: 'BIMI is published',
      detail: `Logo at ${str(l).trim()}. Whether it is displayed is up to each mailbox provider, and several of them also require a Verified Mark Certificate in the a tag.`,
      record: rec(name, 'TXT', text),
      rule: 'A BIMI record names the logo a supporting mailbox may display next to your messages.',
      rfc: 'draft-blank-ietf-bimi (Internet-Draft, not an RFC)',
      level: 'optional',
    }));
  }
  return { present: true, state: out.some((f) => f.severity === 'medium') ? 'warn' : 'ok', findings: out };
}

// ═══════════════════════════ the whole reading ════════════════════════

export const AREAS = [
  { id: 'mx', label: 'MX', title: 'Where your mail is delivered' },
  { id: 'spf', label: 'SPF', title: 'Who is allowed to send as you' },
  { id: 'dkim', label: 'DKIM', title: 'The signature on your messages' },
  { id: 'dmarc', label: 'DMARC', title: 'What receivers should do when both fail' },
  { id: 'mtasts', label: 'MTA-STS', title: 'Encryption on the way to you' },
  { id: 'tlsrpt', label: 'TLS-RPT', title: 'Reports about that encryption' },
  { id: 'bimi', label: 'BIMI', title: 'Your logo in the mailbox' },
];

/**
 * Read everything. Pure: `zone` holds every DNS answer.
 * @param {string} domain
 * @param {object} zone
 * @param {{selectors?:Array}} [opts]
 */
export function analyse(domain, zone, opts = {}) {
  const d = normaliseName(domain);
  const selectors = opts.selectors || DKIM_SELECTORS;

  const mx = analyseMx(d, zone);
  const spf = analyseSpf(d, zone);
  const dkim = analyseDkim(d, zone, selectors);
  const dmarc = analyseDmarc(d, zone);
  const hasMx = mx.present && !mx.nullMx;
  const mtasts = analyseMtaSts(d, zone, { hasMx });
  const tlsrpt = analyseTlsRpt(d, zone, { hasMx });
  const bimi = analyseBimi(d, zone, { dmarcPolicy: dmarc.policy ? dmarc.policy.p : null });

  const areas = { mx, spf, dkim, dmarc, mtasts, tlsrpt, bimi };
  const findings = sortFindings([...mx.findings, ...spf.findings, ...dkim.findings, ...dmarc.findings, ...mtasts.findings, ...tlsrpt.findings, ...bimi.findings]);
  const counts = Object.fromEntries(SEVERITY_ORDER.map((s) => [s, findings.filter((f) => f.severity === s).length]));

  return { domain: d, areas, findings, counts, verdict: verdict(d, areas, findings, counts) };
}

/** One sentence at the top, and a level the page can colour. */
export function verdict(domain, areas, findings, counts) {
  const { dkim, dmarc } = areas;
  const unknown = Object.values(areas).some((a) => a.state === 'unknown');
  if (unknown) return { level: 'unknown', sentence: `Some checks for ${domain} remain unverified. ${dkim.uncertainty === 'selector' ? 'DKIM may use a selector that was not checked. ' : 'Some DNS answers could not be obtained. '}Review the confirmed findings below; this does not determine whether a message is authenticated or delivered.` };

  const worst = findings.find((f) => f.severity === 'critical' || f.severity === 'high') || null;
  if (counts.critical > 0) {
    return {
      level: 'bad',
      sentence: `DNS checks for ${domain} found ${counts.critical} critical issue${counts.critical > 1 ? 's' : ''}, starting with ${lower(worst.title)}. Check the findings against your sending configuration before changing records.`,
    };
  }
  if (counts.high > 0) {
    return {
      level: 'weak',
      sentence: `${domain} is set up, but ${counts.high === 1 ? 'one thing is' : counts.high + ' things are'} weak enough to matter, starting with ${lower(worst.title)}.`,
    };
  }
  const enforcing = dmarc.policy && (dmarc.policy.p === 'quarantine' || dmarc.policy.p === 'reject');
  if (!enforcing) {
    return {
      level: 'ok',
      sentence: `The checked records for ${domain} have no critical or serious findings. Its DMARC policy does not request enforcement. Actual message authentication and delivery are not tested.`,
    };
  }
  return {
    level: 'good',
    sentence: `${domain} publishes SPF, a DKIM key and an enforcing DMARC policy. The supported DNS checks found no critical or serious issue${counts.medium ? `, with ${counts.medium} smaller thing${counts.medium > 1 ? 's' : ''} worth a look` : ''}. A real message is still needed to verify authentication and alignment.`,
  };
}

function lower(s) {
  return str(s).charAt(0).toLowerCase() + str(s).slice(1);
}

// ═════════════════════════════ network ═══════════════════════════════
//
// The only part of this file that touches the network. Everything above can
// be tested without it.

export const DOH_PROVIDERS = [
  { id: 'cloudflare', name: 'Cloudflare 1.1.1.1', url: 'https://cloudflare-dns.com/dns-query' },
  { id: 'google', name: 'Google 8.8.8.8', url: 'https://dns.google/resolve' },
];

/**
 * One DNS question over DNS over HTTPS, from wherever this code runs.
 * The visitor browser asks the public resolver directly: nothing goes to us.
 * @returns {Promise<{status:number, records:Array, provider:string}>}
 */
export async function resolveDoh(name, type, opts = {}) {
  const providers = opts.providers || DOH_PROVIDERS;
  const fetchImpl = opts.fetch || (typeof fetch === 'function' ? fetch : null);
  if (!fetchImpl) throw new Error('No fetch available');
  const t = String(type).toUpperCase();
  let lastError = null;
  for (const p of providers) {
    if (opts.signal?.aborted) throw opts.signal.reason || new Error('DNS lookup cancelled');
    const controller = new AbortController();
    const cancel = () => controller.abort(opts.signal.reason);
    opts.signal?.addEventListener('abort', cancel, { once: true });
    const timer = setTimeout(() => controller.abort(new Error('DNS lookup timed out')), opts.timeoutMs ?? 8000);
    try {
      const url = `${p.url}?name=${encodeURIComponent(normaliseName(name))}&type=${encodeURIComponent(t)}`;
      const res = await fetchImpl(url, { headers: { accept: 'application/dns-json' }, signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (!res.ok) {
        lastError = new Error(`${p.name} answered ${res.status}`);
        continue;
      }
      const json = await res.json();
      const status = typeof json.Status === 'number' ? json.Status : RCODE.NOT_LOOKED_UP;
      if (isUnknown({ status })) { lastError = new Error(`${p.name} returned DNS status ${status}`); continue; }
      return { status, records: answersToRecords(json, t), provider: p.name };
    } catch (err) {
      if (opts.signal?.aborted) throw opts.signal.reason || err;
      lastError = err;
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener('abort', cancel);
    }
  }
  throw lastError || new Error('No DNS provider answered');
}

/** Turn a DoH JSON answer into the record shapes the analysers expect. */
export function answersToRecords(json, type) {
  const t = String(type).toUpperCase();
  const want = DNS_TYPE[t];
  const answers = (json && json.Answer) || [];
  const out = [];
  for (const a of answers) {
    if (a.type !== want) continue; // skip the CNAMEs a resolver adds on the way
    if (t === 'TXT') {
      const strings = parseTxtData(a.data);
      out.push({ strings, text: strings.join('') });
    } else if (t === 'MX') {
      const m = String(a.data).trim().match(/^(\d+)\s+(\S+)$/);
      if (m) out.push({ preference: Number(m[1]), exchange: m[2] === '.' ? '' : normaliseName(m[2]) });
    } else if (t === 'CNAME') {
      out.push({ target: normaliseName(a.data) });
    } else {
      out.push({ address: String(a.data).trim() });
    }
  }
  return out;
}

/**
 * Run the whole check, reporting each area as soon as it can be read rather
 * than waiting for the slowest lookup. Yields events:
 *   {type:'lookup', name, type}     a question was asked
 *   {type:'area', area, result}     one area is finished
 *   {type:'done', report}           everything is finished
 *
 * @param {string} domain
 * @param {{resolve?:Function, selectors?:Array, signal?:AbortSignal, maxLookups?:number}} opts
 */
export async function* runChecks(domain, opts = {}) {
  const d = normaliseDomainInput(domain);
  if (!looksLikeDomain(d)) throw new Error('That does not look like a domain name.');
  const resolve = opts.resolve || ((name, type) => resolveDoh(name, type, { signal: opts.signal }));
  const selectors = opts.selectors || DKIM_SELECTORS;
  const maxLookups = opts.maxLookups || 120;
  const zone = {};
  let used = 0;

  async function ask(name, type) {
    if (opts.signal?.aborted) throw opts.signal.reason || new Error('DNS lookup cancelled');
    const key = zoneKey(name, type);
    if (key in zone) return zone[key];
    if (used >= maxLookups) {
      zone[key] = { status: RCODE.NOT_LOOKED_UP, records: [] };
      return zone[key];
    }
    used++;
    try {
      const r = await resolve(name, type);
      zone[key] = { status: r.status, records: r.records };
    } catch (err) {
      if (opts.signal?.aborted) throw opts.signal.reason || err;
      zone[key] = { status: RCODE.NOT_LOOKED_UP, records: [] };
    }
    return zone[key];
  }

  const askAll = (list) => Promise.all(list.map(({ name, type }) => ask(name, type)));

  // 1. The records at the domain itself: MX first, because everything else
  //    reads better once you know whether the domain receives mail at all.
  await askAll([
    { name: d, type: 'MX' },
    { name: d, type: 'TXT' },
    { name: d, type: 'A' },
    { name: d, type: 'AAAA' },
  ]);
  await askAll(mxPending(d, zone));
  yield { type: 'area', area: 'mx', result: analyseMx(d, zone) };

  // 2. SPF, following includes and redirects until nothing new is needed.
  for (let round = 0; round < 12; round++) {
    const pending = spfPending(d, zone);
    if (!pending.length) break;
    await askAll(pending);
  }
  const spf = analyseSpf(d, zone);
  yield { type: 'area', area: 'spf', result: spf };

  // 3. DMARC, then the external authorisation records it points at.
  await ask('_dmarc.' + d, 'TXT');
  await askAll(dmarcPending(d, zone));
  yield { type: 'area', area: 'dmarc', result: analyseDmarc(d, zone) };

  // 4. The three small ones, in parallel.
  await askAll([
    { name: '_mta-sts.' + d, type: 'TXT' },
    { name: '_smtp._tls.' + d, type: 'TXT' },
    { name: 'default._bimi.' + d, type: 'TXT' },
  ]);
  const mxNow = analyseMx(d, zone);
  const hasMx = mxNow.present && !mxNow.nullMx;
  const dmarcNow = analyseDmarc(d, zone);
  yield { type: 'area', area: 'mtasts', result: analyseMtaSts(d, zone, { hasMx }) };
  yield { type: 'area', area: 'tlsrpt', result: analyseTlsRpt(d, zone, { hasMx }) };
  yield { type: 'area', area: 'bimi', result: analyseBimi(d, zone, { dmarcPolicy: dmarcNow.policy ? dmarcNow.policy.p : null }) };

  // 5. DKIM last: it is the longest, because every selector is a separate
  //    question and DNS gives no way to list them.
  const batch = 8;
  for (let i = 0; i < selectors.length; i += batch) {
    const part = selectors.slice(i, i + batch);
    await askAll(part.map((s) => ({ name: dkimName(typeof s === 'string' ? s : s.selector, d), type: 'TXT' })));
    yield { type: 'progress', area: 'dkim', done: Math.min(i + batch, selectors.length), total: selectors.length };
  }
  const dkim = analyseDkim(d, zone, selectors);
  yield { type: 'area', area: 'dkim', result: dkim };

  yield { type: 'done', report: analyse(d, zone, { selectors }), zone, lookups: used };
}

// Also reachable from a console when the page has loaded the module.
if (typeof window !== 'undefined') {
  window.MailDoctor = { analyse, runChecks, resolveDoh, makeZone, DKIM_SELECTORS, normaliseDomainInput };
}
