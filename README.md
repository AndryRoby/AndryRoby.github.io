# ARLing

Small, free, browser-only tools for one exact developer problem each, plus a home-library app.

Live: https://arling.sk/

## What it is

This repository is the source for the hub page at arling.sk, the page every ARLing tool links back to. It is one static site:

- `index.html`: the page itself. Lists the 7 live tools, each with what you see, what you get, and a link. Has a "notify me about new tools" email form and three JSON-LD blocks (`Organization`, `WebSite`, `ItemList` of the 7 tools) so the company and the tool list are machine-readable.
- `how-we-work/index.html`: the method page. What Andrej decides, what AI agents do, how the company makes money, a 404 page for the section.
- `privacy/index.html`: what is collected (anonymous visit counts, an optional e-mail address) and what never is (anything typed into a tool).
- `llms.txt`: the same tool list in plain text for AI agents, with a one-paragraph summary of each tool and a link to that tool's own `llms.txt` / `llms-full.txt`.
- `sitemap.xml` and `sitemap-index.xml`: this domain's own pages, plus an index that points at every tool's own `sitemap.xml` (each tool is a separate repository with its own sitemap).
- `robots.txt`: `Allow: /` for everyone, with GPTBot, ClaudeBot, PerplexityBot, Google-Extended, Bingbot and Applebot listed explicitly.
- `CNAME`: `arling.sk`. This repo is named `AndryRoby.github.io` (GitHub's naming convention for a user's default Pages site) and GitHub Pages serves it at the custom domain in that file.
- `subscribe.js`: wires the email form to a self-hosted subscribe API. No inline event handlers, since the CSP in `index.html` has no `unsafe-inline` for scripts.
- `google053b559de11f5b40.html` and `25d148747bb8560e7423770bf741ecbe.txt`: Google Search Console and IndexNow verification files.

## What it does not do

- It runs no checks itself. Every diagnostic lives in its own tool, in its own repository, with its own engine and its own tests.
- No accounts, no login, no cookies of its own.
- It does not store what anyone types into a tool. The one thing it does store, if you submit the form, is an email address for the "new tools" list, held by the subscribe service, not in this repo.
- It has no backend of its own. The only network call this repo's code makes is the subscribe form's POST, to a self-hosted endpoint outside this repo.

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

There is no `tests.mjs` in this repository: a static index page with no engine has nothing to unit-test. Each tool it links to has its own `tests.mjs`, in its own repository.

## Privacy

Everything on this page runs in your browser except one thing: submitting the subscribe form, which is opt-in. Visit counts and which link was clicked are collected with a self-hosted Umami instance that runs without cookies; the content of anything typed into a tool linked from this page never reaches this domain, since each tool is client-side on its own page. Full policy: https://arling.sk/privacy/.

## Sources

This repo has no diagnostic rules to cite, only public specs it follows for discoverability:

- schema.org `Organization` / `WebSite` / `ItemList` (JSON-LD): https://schema.org/
- Sitemaps XML protocol: https://www.sitemaps.org/protocol.html
- IndexNow protocol: https://www.indexnow.org/
- robots.txt crawler directives: each bot's own published user agent (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, Bingbot, Applebot).

## Report a problem

A broken link, a wrong number on the hub page, or a tool missing from the list: open an issue on this repo, or write to andrej@arling.sk with the URL and what's wrong.

## License

All rights reserved, ARLing s. r. o. Reading this code to see how the hub page works, or to learn from it, is fine. Deploying a copy of it as your own site is not. Each tool repository carries its own `LICENSE-NOTICE.md` with the exact terms; this repo follows the same policy even though the file isn't copied into it yet.

---

ARLing s. r. o., Bratislava, Slovakia. Company ID 56583486, VAT ID SK2122352100. andrej@arling.sk

The tools this hub links to, each its own repository:

- https://arling.sk/google-oauth-redirect-doctor/
- https://arling.sk/expo-supabase-auth-doctor/
- https://arling.sk/supabase-redirect-doctor/
- https://arling.sk/flutter-supabase-doctor/
- https://arling.sk/expo-universal-links-doctor/
- https://arling.sk/sepa-pain001-doctor/
- https://arling.sk/bookapp/
