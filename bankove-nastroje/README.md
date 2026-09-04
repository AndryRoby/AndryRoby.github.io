# Bankové nástroje pre účtovníkov

Live: https://arling.sk/bankove-nastroje/

Static bundle page that sells and manages one Pro licence for four
free, client-side ARLing tools Slovak accountants use for bank files:

- [SEPA pain.001 Doctor](https://arling.sk/sepa-pain001-doctor/): checks
  a finished pain.001 XML batch payment file against bank-specific
  rules (Tatra banka, SLSP, VÚB, ČSOB).
- [SEPA pain.001 Generátor](https://arling.sk/sepa-pain001-generator/):
  builds a pain.001 XML batch payment file from Excel/CSV.
- [camt.053 do Excelu](https://arling.sk/camt053-to-excel/): converts a
  camt.053 bank statement into a CSV/Excel table.
- [Párovač platieb](https://arling.sk/parovac-platieb/): matches a bank
  statement against issued invoices.

This page does not process any bank data itself. It only sells one
licence (Stripe Checkout, plan `sepa-pro`) and lets a visitor activate,
inspect, or remove it (`licence.js`, same Ed25519/WebCrypto mechanism
used by the other ARLing tools). Because every ARLing tool is served
from the same `arling.sk` origin, a key saved here is already visible to
the four tools via shared `localStorage`; each of them additionally
accepts the plan `sepa-pro` (see their own `licence.js`), so the same
key works everywhere without extra configuration.

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

## Running it locally

No build step. It's static files.

```bash
git clone https://github.com/AndryRoby/bankove-nastroje.git
cd bankove-nastroje
npx serve .
# or just open index.html directly in a browser
```

## About

Built by ARLing s. r. o. (Bratislava, Slovakia). andrej@arling.sk
