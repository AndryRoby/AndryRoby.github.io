# ARLing

arling.sk is the site of ARLing s. r. o. (Bratislava, Slovakia): browser tools for businesses, accountants, online shops and developers (e-invoice XML, SEPA pain.001 and camt.053 bank files, product feeds, auth and redirect errors), plus puzzle books and games, and this repository is the source of that site. Many tools are free; the paid paths have their price on each product page, for example the Banking tools Pro licence for 9 EUR a month or 79 EUR a year (https://arling.sk/bankove-nastroje/en/), the SEPA file check for 149 EUR invoiced only after delivery (https://arling.sk/kontrola-suboru/en/), and e-invoice XML downloads from 2.90 EUR excluding VAT (https://arling.sk/efaktura/en/).

Live: https://arling.sk/

## What it is

This repository is the GitHub Pages source for arling.sk. It holds the hub page and many of the product pages served under the same domain, for example `/efaktura/`, `/kontrola-suboru/`, `/bankove-nastroje/`, `/parovac-platieb/`, `/feed-doctor/`, `/asistent/`, `/gdpr-dokumenty/`, `/shop/`, `/games/`, `/notes/`, `/podmienky/` (terms) and `/privacy/`. Some tools (for example SEPA pain.001 Doctor, SEPA pain.001 Generator, camt.053 to Excel and the developer doctors) live in their own repositories and are served at `arling.sk/<repository>/`.

- `index.html`: the hub page with the product catalogue, an e-mail form for news, and JSON-LD so the company and the product list are machine-readable.
- `llms.txt`: the product list in plain text for AI agents, with links to each tool's own `llms.txt` / `llms-full.txt`.
- `sitemap.xml` and `sitemap-index.xml`: this domain's pages, plus an index that points at the sitemaps of tools that live in their own repositories.
- `robots.txt`: `Allow: /` for everyone, with AI crawlers listed explicitly.
- `CNAME`: `arling.sk`. This repo is named `AndryRoby.github.io` (GitHub's naming convention for a user's default Pages site) and GitHub Pages serves it at the custom domain in that file.
- `subscribe.js`: wires the e-mail form to a self-hosted subscribe API. No inline event handlers, since the CSP has no `unsafe-inline` for scripts.

## Payments, receipts and contact

Card payments for licences, subscriptions and digital products are sold through Stripe Managed Payments: the merchant of record is Link (Sold through Link, LLC, which provides that service for Stripe), Link sends the receipt and the invoice, and Stripe calculates and remits the VAT; ARLing s. r. o. delivers the product or service. The SEPA file check (149 EUR) is not paid through Stripe: ARLing s. r. o. invoices it after delivery, payable by bank transfer. Prices, withdrawal and refunds: terms of use, https://arling.sk/podmienky/en/. Contact: support@arling.sk.

## How it works

`index.html` is one static file: inline CSS, no framework, no build step, no client-side router. The only script beyond analytics is `subscribe.js`, which listens for `submit` on `form[data-subscribe]`, validates the email, and posts JSON to the subscribe endpoint. A 409 (already subscribed) is treated as success, not an error.

Example, from `subscribe.js`:

```
POST https://homelab.tailbf8f27.ts.net/subscribe/api/subscribe
Content-Type: application/json

{"email":"you@example.com","source":"hub","lang":"en","hp":""}
```

A 2xx or 409 response swaps the form for the "thanks" message; anything else swaps it for the error message, both already in `index.html` and just unhidden by the script.

## Run locally

No build step. Any static file server works:

```bash
git clone https://github.com/AndryRoby/AndryRoby.github.io.git
cd AndryRoby.github.io
python -m http.server
```

or open `index.html` directly in a browser. The subscribe form and the Umami script will fail closed (caught, logged, no crash) when the homelab endpoint is unreachable, which is expected when running offline.

Tools that live in their own repositories carry their own tests there.

## Privacy

Everything on the hub page runs in your browser except one thing: submitting the subscribe form, which is opt-in. Visit counts and which link was clicked are collected with a self-hosted Umami instance that runs without cookies; most tools process what you type only in your browser; the exceptions (for example the e-shop check and Feed Doctor Monitor) say so on their own pages. Full policy: https://arling.sk/privacy/en/.

## Sources

This repo has no diagnostic rules to cite, only public specs it follows for discoverability:

- schema.org `Organization` / `WebSite` / `ItemList` (JSON-LD): https://schema.org/
- Sitemaps XML protocol: https://www.sitemaps.org/protocol.html
- IndexNow protocol: https://www.indexnow.org/
- robots.txt crawler directives: each bot's own published user agent (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, Bingbot, Applebot).

## Report a problem

A broken link, a wrong number on the hub page, or a tool missing from the list: open an issue on this repo, or write to support@arling.sk with the URL and what's wrong.

## License

All rights reserved, ARLing s. r. o. Reading this code to see how the hub page works, or to learn from it, is fine. Deploying a copy of it as your own site is not. Each tool repository carries its own `LICENSE-NOTICE.md` with the exact terms; this repo follows the same policy even though the file isn't copied into it yet.

---

ARLing s. r. o., Bratislava, Slovakia. Company ID 56583486, VAT ID SK2122352100. support@arling.sk

Tools that live in their own repositories:

- https://arling.sk/sepa-pain001-doctor/ (github.com/AndryRoby/sepa-pain001-doctor)
- https://arling.sk/sepa-pain001-generator/ (github.com/AndryRoby/sepa-pain001-generator)
- https://arling.sk/camt053-to-excel/ (github.com/AndryRoby/camt053-to-excel)
- https://arling.sk/google-oauth-redirect-doctor/
- https://arling.sk/expo-supabase-auth-doctor/
- https://arling.sk/supabase-redirect-doctor/
- https://arling.sk/flutter-supabase-doctor/
- https://arling.sk/expo-universal-links-doctor/
- https://arling.sk/cors-doctor/
- https://arling.sk/jwt-doctor/
- https://arling.sk/cookie-samesite-doctor/
- https://arling.sk/redirect-loop-doctor/
- https://arling.sk/stripe-webhook-doctor/
- https://arling.sk/firebase-auth-domain-doctor/
- https://arling.sk/bookapp/
- https://arling.sk/janii/
