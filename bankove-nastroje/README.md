# Banking tools for accountants (Bankové nástroje): one Pro licence for three tools

Banking tools is the page where accountants and companies that work with SEPA payment files and camt.053 bank statements buy and manage one Pro licence that works in three ARLing browser tools: SEPA pain.001 Generator, camt.053 to Excel and Payment matcher. The licence costs €9 a month or €79 a year, VAT included, at https://arling.sk/bankove-nastroje/; the fourth tool, SEPA pain.001 Doctor, is free and needs no licence.

Live: https://arling.sk/bankove-nastroje/ (Slovak) · https://arling.sk/bankove-nastroje/en/ (English) · https://arling.sk/bankove-nastroje/de/ (German)

The four tools:

- [SEPA pain.001 Doctor](https://arling.sk/sepa-pain001-doctor/): checks
  a finished pain.001 XML batch payment file against bank-specific
  rules (Tatra banka, SLSP, VÚB, ČSOB). Free, no licence. Its optional
  automatic file fix for 29 € is a separate purchase on the Doctor page.
- [SEPA pain.001 Generator](https://arling.sk/sepa-pain001-generator/):
  builds a pain.001 XML batch payment file from Excel/CSV. Building
  and checking files is free, up to 5,000 payments per file (the same
  limit applies with Pro); Pro adds saved payer
  profiles, several files at once, Pohoda/Omega/Money S3 presets and
  history.
- [camt.053 to Excel](https://arling.sk/camt053-to-excel/): converts a
  camt.053 bank statement into a CSV/Excel table. Conversion is free;
  without a licence the download holds the first 20 rows. Pro adds the
  full download, MT940 and DATEV Buchungsstapel exports, several files
  at once and history.
- [Payment matcher](https://arling.sk/parovac-platieb/): matches a bank
  statement against issued invoices. Matching and the tables on screen
  are free; without a licence the download holds the first 20 rows.
  Pro adds the full download, several statements at once, saved
  mapping, Pohoda/Omega/Money S3 export and history.

Every tool runs in the browser; statements and payment files are not
uploaded.

## What you pay and who sells it

- Pro: €9 a month or €79 a year, VAT included, one licence for three
  tools, no limit on the number of your own devices. One licence
  covers one company or one person and cannot be resold.
- The licence is sold through Stripe Managed Payments. The merchant of
  record is Link (Sold through Link, LLC, which provides that service
  for Stripe): the checkout says "Sold through Link", Link sends the
  receipt and the invoice as a PDF, and Stripe calculates and remits
  the VAT. ARLing s. r. o. delivers the tools and the licence key.
- Cancel or change the subscription at any time in the Stripe customer
  portal (https://billing.stripe.com/p/login/3cIaER9M63hNeFcg8B4ko00,
  log in with the e-mail you paid with); it stays active until the end
  of the paid period.
- For a monthly or yearly subscription, ARLing refunds the payment on
  request within 14 days of purchase, without you giving a reason:
  write to support@arling.sk.
- Full terms: https://arling.sk/podmienky/en/ (sections 4 to 6).

Separate, not part of this licence: the SEPA file check by a person
for 149 €, ordered through the form at https://arling.sk/kontrola-suboru/en/
and invoiced by ARLing s. r. o. only after delivery, payable by bank
transfer.

## How the page works

This page does not process any bank data itself. It sells the licence
(Stripe Payment Link, plan `sepa-pro`) and lets a visitor activate,
inspect, or remove it (`licence.js`, the same Ed25519/WebCrypto
mechanism used by the other ARLing tools). Because the tools are served
from the same `arling.sk` origin, a key saved here is visible to the
three tools with Pro via shared `localStorage`; each of them accepts
the plan `sepa-pro` (see their own `licence.js`), so the same key works
in all three without extra configuration. If that does not happen (a
different browser, cleared site data), the key can be pasted by hand
on this page or in any of the three tools.

## Files

- `index.html`: the page itself (hero, tool index, Pro benefits,
  pricing, licence management, subscribe form, FAQ, JSON-LD).
- `licence.js`: licence parsing/verification/storage/claim, identical
  mechanism to the other tools' `licence.js`, plan `sepa-pro`.
- `subscribe.js`: shared mailing-list form wiring (unchanged copy from
  the sibling tools).
- Hygiene: `robots.txt`, `sitemap.xml`, `manifest.json`, `favicon.svg` /
  `favicon.ico`, `icon-192.png` / `icon-512.png`, `404.html`,
  `health.json`, `.nojekyll`, `llms.txt`, `llms-full.txt`.

The live page, with its English and German versions, is published from
the arling.sk site repository; this repository holds the Slovak page
and the licence code.

## Running it locally

No build step. It's static files.

```bash
git clone https://github.com/AndryRoby/bankove-nastroje.git
cd bankove-nastroje
npx serve .
# or just open index.html directly in a browser
```

## About

Built by ARLing s. r. o. (Bratislava, Slovakia). support@arling.sk
