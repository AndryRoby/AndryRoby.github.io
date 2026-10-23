# Feed Doctor Agent Ready

Local implementation, 13 October 2026; live since 14 October 2026 (worker flag on, pages on arling.sk).
Handoff and evidence: `ops/strategia/2026-10-13-agent-ready/STAV.md`. Release hardening and the
Shopify next step, 18 October 2026: `ops/strategia/2026-10-18-arling-2/stavba/agent-ready-vydanie/`.

## Contract

`core.mjs` reads a snapshot of public responses and returns 27 rule results, a
heuristic score, weighted coverage, sample sizes and resource evidence. It does
not call an LLM or assess AI recommendations, private catalogs, checkout
eligibility or review authenticity. Unknown evidence is excluded from the score.
No score is issued without a readable product/feed sample. Partial page coverage
reduces coverage. Optional llms.txt, ChatGPT-User and Google-Extended are not
scoring penalties. Missing public GTIN and image alt fields remain unknown.

EN is the primary page; SK and DE are translations. The EN checklist is a separate
article. `postav.mjs` in the handoff directory regenerates pages and the explicitly
fictional sample. It supports `--dry`. Existing Feed Doctor pages link here.

Reports carry `shopify: {detected, signals}` from evidence already read (no extra
request): `export` (Shopify-shaped public product export), `robots` (Shopify default
robots.txt header, the current "# Shopify storefront." or the older line) and `assets` (one store page with both cdn.shopify.com and a
myshopify.com name). A text mention alone is not a signal. `prechod.mjs` turns that
into a calm next step to Agentic Product Check (https://arling.sk/agent-ready/ with
fixed UTM, Umami event `ar_check_to_app` with `lang` and `source` only). The step is
shown only while `HEAD /agent-ready/` answers 2xx; `prechod.mjs` is loaded
dynamically, so a missing file only hides the step. Reports from older workers fall
back to the public export signal. Stores without signals keep the Monitor Pro path.

All parsers are linear in input size (18 October 2026): the former regular
expressions could backtrack on hostile markup. `fixtures/povodne-parsery.mjs` keeps
the old implementation as a test oracle; generated cases must give identical output.
robots.txt is parsed once per text; files over 500 KiB or with more than 5000 rules
are not evaluated (`robotsReadable` false: no further reads, robots rules unknown).

Microdata as a fallback (relation 208, 22 October 2026). Shoptet, which runs most Slovak shops, has no JSON-LD
Product on its product pages: the product, its offers and shipping terms are Microdata (7 of 7 measured shops), and
the PrestaShop 1.6 and 1.7 pages were the same (`ops/druhy-ucet/208/zber/`). `scanHtml` reads Microdata items in the
same pass over the tags (`microdataReader`) and turns them into objects shaped like JSON-LD nodes: `itemtype` is
`@type`, each `itemprop` name a key, a repeated one a list, a nested `itemscope` an object; values by element as in the
HTML standard (meta content, href and src through `httpUrl`, data and meter value, time datetime, else the text), plus
a `content` attribute on any other element, which schema.org allows and the default PrestaShop themes use for the
price (1.6 default-bootstrap `<span itemprop="price" content="{$productPrice}">`, 1.7 classic
`<span itemprop="price" content="{$product.price_amount}">`); without it every PrestaShop price would read "19,90 €". They are
used only when the page has no JSON-LD Product or ProductGroup candidate: then the top-level items join the same
breadth-first walk, so offers, organizations, policies and ratings work exactly as for JSON-LD, and a page with a
JSON-LD Product gives exactly the result it gave before. Products differ in one point (F1): with Microdata the products
of a page are only the Product or ProductGroup items whose url names its path; when none does, only the first such item
in document order, and only when it has no url. The others are side items, as JSON-LD nodes under `isRelatedTo`, because
the default PrestaShop 1.7 theme (classic) marks every related product (accessories, products of the same category) as a
top-level Product without url and offer. JSON-LD keeps its rule (every candidate without url or with this path). `itemref` and `itemid` are not
followed and RDFa is not read. Bounded like the other parsers: a stack of at most 4096 open elements (a closing tag
finds the nearest open element of its name through a list per name, so a tag costs O(1) amortised), 300 items, 3000
values, 2000 characters a text read from at most 16 000 characters of markup, and 1 000 000 characters of text a page.
The scan carries `micro: {items, used, products}` outside `page`, whose shape the oracle compares; the report adds
`sample.microdata`, the number of read product pages whose products came from Microdata. The `jsonld_product` fix says
so in EN, SK and DE. Tests: the `Microdata 208` block of `core.test.mjs`, with byte copies of the collected samples in
`fixtures/208/*.html.txt` (text, so that arling.sk never serves them as pages with product markup).

Version of reading (F2, relation 208): every report carries `sample.scan` (`SCAN`, 3 since relation 218 (2 since relation 208);
reports from before relation 208 have none and count as 1). Raise `SCAN` with every change of what or how the check reads, or of
how it judges what it read, that changes results while the store stays the same (relation 218: the Irish labels are found); the
weekly comparison of the monitor (`report-mail.mjs` `compareReports`) does not compare two reports of different versions, so the
first week after such a change sends no "broke" or "fixed" e-mail and shows no change on the Shop Guard page. It is in
`sample` because the weekly report stores `sample` whole and only some other fields. `VERSION` stays 1.0.0.
Foreign JSON (JSON-LD blocks and the public export) is read by `parseForeign`: `JSON.parse` and one iterative walk that drops
keys of its own named `toString`, `valueOf` and `toJSON`; Microdata skips those `itemprop` names. A node `{"toString":"x"}` made
`String()`, `Number()`, a RegExp test or `Array.join` throw and ended the whole check (60 of 243 places of the good-shop sample
before, 0 after). A JSON.parse reviver was measured and not used: 4 to 40 times slower on 2 MB (the walk adds about a tenth)
and a RangeError past 1600 levels of nesting, which would have turned valid deep JSON-LD into invalid. Tests: the `F2 208` block
of `core.test.mjs`.

19 October 2026, after a study of 113 Shopify stores: llms.txt is accepted as text/plain,
text/markdown or text/x-markdown (Shopify serves Markdown); `jsonld_identity` asks a
ProductGroup only for a name (Google product variants documentation) while every Product,
variants included, still needs a name and an image; a product page follows one redirect
when it stays on the same origin and robots.txt allows the target; contact falls back to
/pages/contact-us when /pages/contact is missing or redirects. Links found on the home and
product pages are tried first, as before.

20 October 2026, store-wide return and shipping policies (`jsonld_returns`, `jsonld_shipping`;
details and sources in `ops/shopify/predspustenie-2026-10-20/OPRAVA-DORUCENIE.md`). Google
recommends one policy for the whole shop under `Organization` (`hasMerchantReturnPolicy`;
`hasShippingService` holding a `ShippingService`), written on "a single page" of the site, with
Offer-level markup as the override and a bare `@id` reference from an Offer to a policy on another
page. The rules are judged offer by offer (gate 1, P2): an offer that carries a policy of its own,
inline or by reference, passes only if that policy is complete, and the store-wide policy never
rescues it (Google uses the offer's policy); an offer without one is covered by a valid policy on an
Organization node of the product page, or of the home, return, shipping or contact page, which are
read only when a product page needs them. Every offer of a page counts (two variants, one without
any policy, is a gap), but only Offer nodes (gate 2, P8: "merchant listings require an Offer", so an
AggregateOffer is not judged when the page has an Offer; a page with nothing but AggregateOffer nodes
is judged as before, the store-wide policy deciding; N21: with no Offer of its own, the Offers inside
`AggregateOffer.offers` are the ones judged). An empty object that names its type
(`{"@type":"MerchantReturnPolicy"}`) is an incomplete policy of the offer's own (N14), a bare `@id`
reference to nowhere is not. They add no request (`collectStore` already holds those pages). A page that
was tried and could not be read (a timeout, an HTTP error other than 404 or 410, a redirect we do
not follow, a page robots.txt closes to our check but not to Googlebot), or a reference to a policy
that no page we read defines, or a spent reference budget, makes the result `unknown`, never `fail`;
a page that is missing, has no link or is closed to every crawler by robots.txt cannot carry markup
Google would use and is no obstacle. Organization means Organization and its subtypes (Corporation,
LocalBusiness, the Store and Shop kinds). An OfferShippingDetails on an offer needs deliveryTime too
(gate 1, P3: Google lists deliveryTime, shippingDestination and shippingRate as required for the
shipping details enhancement; handlingTime or transitTime as a QuantitativeValue with whole
minValue and maxValue and unitCode DAY or d); a ShippingService under Organization does not.
Return settings in Merchant Center, Search Console or the Content API outrank all markup and are
not public; the finding texts say so.

Foreign markup is bounded like the parsers above (gate 1, P1; the first version took 15 s on 24 KB
of repeated `@id` references): a list is read at most 200 entries long and each distinct `@id` once,
a bare reference is looked up once per reader and page, every node is judged once per reader (an
offer's policy, a ShippingService, each ShippingConditions, a deliveryTime; one reader for the
product pages alone, one for the shop's other pages, shared by all pages of the call), and one
`analyzeStore` call may spend 2 000 000 units of work in all (gate 2, P9: 16 for each `@id` looked
up, 1 for each list entry walked, because walking lists from memory is cheap but not free, and 1
for each key of a definition that is copied into a reference; the gate's worst shape, 1.4 MB with
150 services of 150 conditions each, uses about 717 000 of them). When the units are spent what is
still undecided is `unknown`. The budget can be lowered with the second argument,
`analyzeStore(snapshot, {policyBudget: 100000})`, which the tests use; the report does not change.
Nodes that share an `@id` are merged into one copy of our own, added to in place (copying the whole
merged node for each of them took 83 s for 3 000 nodes). The breadth-first walk over the JSON-LD
tree reads its queue by an index instead of `Array.shift()` (which moved every element of a 90 000
entry queue each time). `extractHtml` keeps its public shape (the test oracle in `fixtures/`
compares it); the JSON-LD nodes come from the internal `scanHtml`. `VERSION` stays 1.0.0 because the
Shopify app's parity test compares it with its own copy.

The old Feed Doctor Fetch remains a direct browser request. Agent Ready calls
the existing Feed Monitor worker because arbitrary shop HTML cannot generally
be read cross origin in a browser.

## Worker API

Implementation: `products/feed-doctor/monitor/src/agent-ready-*.mjs`.

- GET `/v1/agent-ready/check?url=https%3A...&product=https%3A...` returns a report.
  Six accepted attempts per IP/hour (IPv6 counted per /64), atomically claimed in D1;
  expired rows go on the next claim and in the daily cron. CORS allows only
  https://arling.sk unless `AGENT_READY_ORIGINS` is set. Invalid input is
  rejected; missing D1 or client IP fails closed. No raw IP or shop URL is stored
  in the limiter. The input URL is in the request, so infrastructure logging must
  be reviewed separately. Umami receives event names and non-URL metadata only.
- GET `/v1/agent-ready/monitors/:id?key=...` returns active Pro settings and the
  latest report for their current revision.
- POST at the same URL saves `{store_url, product_url, revision}`. Origin must be
  an HTTPS public origin; the product URL must have the same origin. Revision 0
  creates settings. Subsequent writes use compare-and-swap; conflict returns409.

Existing monitor authentication is reused. Flags `AGENT_READY_ENABLED` and
`AGENT_READY_WEEKLY` must both remain unset/false until release checks pass.
No configuration, Stripe price, plan, secret or cron schedule was changed.

## Public reads and remaining runtime requirement

HTTPS domain names only, DNS A/AAAA preflight, public address checks, no
credentials, only bare/www canonical redirects, robots respected for our own
agent, no page redirect followed implicitly. Maximum 20 feed products, 3 product
pages, 2,000,000 bytes per response, 14 shop requests, 8s per read and 55s per scan.
Each shop read also makes two DNS calls, at most42 network calls. No browser JS
rendering. Blocked or oversized resources are reported as unknown.

**DNS preflight does not pin the subsequent fetch to the checked IP.** Runtime
SSRF/rebinding isolation must be demonstrated in Cloudflare before enabling
arbitrary public checks. Do not run the reader as a customer-facing service on a
machine with private-network access. No runtime safety guarantee is made by the
Node tests. Measured locally on 18 October 2026 (Node 22, same V8): a worst-case check with 2 MB of
hostile markup per page uses about 0.94 s CPU, at most 44 subrequests and about 85 MB of
peak heap; Workers Paid allows 30 s CPU by default, 10,000 subrequests and 128 MB.

## Weekly report

The existing daily cron optionally runs `refreshWeekly`. It selects up to50
eligible monitors without repeatedly selecting completed rows. It stops starting
scans after480s; the last bounded scan can take another55s. Verify the shared cron
limits and existing account plan before enabling it; no paid-plan upgrade is
authorized. A large backlog can take multiple daily runs and is not a scheduling
SLA.

Stable `(monitor_id, week)` identity, settings revision, random claim token and
120s lease prevent duplicate writes and old responses from replacing newer
settings/results. Each later monitor gets a fresh claim time. Errors keep retry
state and never mark the report done. Changing plan/status or deleting the
monitor while scanning prevents the result from being saved. Deletion triggers
remove these settings/reports as well.

Only minimal scored results are stored, not product-page bodies. The panel shows
the latest report and concrete rule fixes. History rows stay until monitor
deletion; this is not a new customer-facing history-retention promise. Weekly
email delivery is not implemented or advertised. Existing billing is unchanged.

## Verification and release

`node --experimental-sqlite --test products/feed-doctor/monitor/test/*.test.mjs products/arling-sk/feed-doctor/agent-ready/core.test.mjs`

Node22.12 requires the SQLite flag. The D1 adapter uses actual SQLite SQL,
including conflict clauses and triggers; this does not replace a real D1 check.
See the handoff for browser QA, public samples, the independent review and
release order. Deploy only web runtime files. Tests, fixture inputs, private
browser profiles and downloaded shop samples are development evidence.

## EU rules for online shops, 2026 (20 October 2026, A-189)

`analyzeStore` adds `eu: {version: 1, rules: [...]}` to every report: three findings, separate from `rules`, score
and coverage (no weight, the 27 scoring rules are unchanged, `VERSION` stays 1.0.0 for the Shopify app parity test).
Each says only what was found in the pages the check already reads (home, up to 3 product pages, returns, shipping and
contact page, up to 20 export products); no request is added and nothing is decided by an AI.

- `eu_withdrawal`: a link, button, submit input or aria-label with the label of Art. 11a of Directive 2011/83/EU
  (inserted by Directive (EU) 2023/2673) in its EN, DE, SK, CS, PL, FR, IT, ES or NL wording, words in order and at most
  two more; `found` or `not_found` (with links about withdrawal that are not the function as hints), `unknown` without pages.
- `eu_guarantee_notice`: the main sentence of the harmonised notice (Annex I of Implementing Regulation (EU) 2025/1960,
  read from its EN, DE, SK and CS images) in visible text, alt text or aria-label; a Your Europe guarantee link is only a
  hint; `not_applicable` when every sampled export variant has `requires_shipping: false`.
- `eu_green_claims`: the examples of recitals 9 and 12 of Directive (EU) 2024/825 in EN, DE, SK and CS (65 patterns with
  inflections, `GREEN_TERMS`) in product titles and descriptions; "green", "grün", "zelené" and "bio" alone are left out on
  purpose. Capped at 12 findings with a total count.

Relation 208 (22 October 2026): `eu_withdrawal` has a fourth status, `link_found`. A link with a similar label that leads, on the
host of its page (a leading `www.` aside), to the order page of a shop platform (`ORDER_PAGES`, today Shoptet `/moja-objednavka`
and `/moje-objednavka`, read decoded, in lower case, without a trailing slash) goes to `system` (`{page, url, label, href,
platform}`, at most 3, unique by `href`), never to `similar`: Shoptet draws the withdrawal form there with JavaScript, so the
result is "link found, function not verified" in a neutral tone, never `not_found` (an official label there stays `found`).
`similar` also takes the Slovak and Czech words for returning goods and links whose own address is about withdrawal or returns
(`/odstupenie-od-zmluvy/`), not terms, complaints or shipping pages. `EU_VERSION` stays 1. Texts: `EU_UI` `status.link_found`,
`rules.eu_withdrawal.status.link_found`, `linkFound`, `linkFoundNote`, `manualLinkFound`; with an older cached `i18n.mjs`
`eu-zobraz.mjs` falls back to "Check the link". Deploy arling.sk before the worker, or an older `eu-zobraz.mjs` rejects the status.

Relation 208, agent M2 (22 October 2026): the order page counts only with evidence of its platform. `analyzeStore` adds
`shoptet: {detected, signals}` next to `shopify`, read only from the pages it already holds with plain `includes()`: `assets`
(`cdn.myshoptet.com`) and `datalayer` (`dataLayer` with an object `{"shoptet":`); a mention of Shoptet or a link to shoptet.sk is
not a signal. `analyzeEu` gets `{shoptet: detected}`: without it a link to `/moja-objednavka/` is an ordinary link (a similar
label is `similar`, as before relation 208). `ORDER_PAGES.shoptet` also has the Hungarian `/rendelesem`, and `similar` the Hungarian
words "elállás" (at the start of a word) and "visszaküldés". `system` and the new `orderPage` keep one entry per host (`www.` aside)
and path. `orderPage` (`{page, url, label, href, platform}`, at most 3) lists links to the order page whose labels are neither
official nor similar, such as "Moja objednávka" (the first text, aria-label or title with a letter or digit, never with consent or
cookie words); it changes no status. On `not_found` the page shows them right after `notFound` and before similar links (texts
`rules.eu_withdrawal.orderPage` and `manualOrderPage`); the worker sends `weekly.eu[].order {label, page}`, the Shop Guard page and the
e-mails give the same sentence, and the tone of `not_found` stays "review" in the week comparison. With an older cached `i18n.mjs`
the order row is left out and the manual check stays `manualNotFound`.

`scanHtml` collects labels of links and buttons, image alt texts and visible text in the same linear pass, bounded
(`CONTROL_SPAN`, `CONTROL_CAP`, `ALT_CAP`, `EU_TEXT_CAP`); `extractHtml` keeps its public shape. Rendering:
`eu-zobraz.mjs` (no DOM, tests in `eu-zobraz.test.mjs`) and `app.mjs`; texts `EU_UI` in `i18n.mjs`. A report without `eu`
(the worker not yet redeployed) shows an honest note instead. The Pro waitlist is `cakacia.mjs` (existing list
`POST /subscribe/api/subscribe`, source `agent-ready-pro`); a result without Shopify signals shows neither the waitlist nor a
sentence about the app (relation 218, gate D2), `buildNote` stays only for older cached `app.mjs`. The EU calendar, the snippets on the three check pages and
`sample-report.json` are built by `ops/strategia/2026-10-20-trendy-2027/postav.mjs` (not by the older `postav.mjs` of
13 October, whose page template is outdated). Sources and decisions: `ops/strategia/2026-10-20-trendy-2027/STAVBA-TESTU.md`.

The live check runs in the Feed Monitor worker, which bundles this file: the EU findings appear on arling.sk only after
`npx wrangler deploy` in `products/feed-doctor/monitor` (done by Fable, never by agents).
