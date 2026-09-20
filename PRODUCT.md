# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: people who read and solve on paper or an e-ink tablet (Kindle Scribe, reMarkable, Boox, Supernote) and buy digital books to keep: logic puzzle books, classic novels with a notes margin, a Catholic morning journal. They arrive from Etsy, social posts, search, or a friend, mostly in English, some in Slovak and German. Their job: find a book worth the price, see a real sample, pay once, download.

Secondary, confirmed: small businesses and freelancers in Slovakia, Germany and English speaking markets who need one task done now (create or check an e-invoice such as XRechnung or Peppol, check a SEPA payment file, convert a bank statement). They arrive from Google Ads or search and want the tool, not the company story.

Tertiary, confirmed: people looking for a personal gift (Memory Post: weekly questions by e-mail that become a memory book) and publishers of newsletters or bulletins who need a ready puzzle every week (Puzzle Post Bulletin).

## Product Purpose

ARLing s. r. o. is an independent one-person digital publisher and tool maker in Bratislava. It sells digital books for e-ink and print, daily logic games in the browser (free), a puzzle generator (Puzzle Studio), a gift subscription (Memory Post) and practical browser tools for invoices and payments. Success today means the first paid orders: the company has had 0 € revenue as of 20. 9. 2026 and must reach 200 € within 10 days and 700 € soon after. The homepage's job is to make the offer intelligible in one viewport and route visitors to the shop or to the one tool they came for.

## Positioning

Every book and puzzle is typeset by our own programs, every puzzle has a proven unique solution, and every e-ink book is clickable (linked contents, form fields you can write in with the pen). We publish the full sample before purchase and sell without accounts or subscriptions for one-off titles. This is a real publisher with a program, not a printables shop; the AI covers are commissioned by the founder and disclosed. Competitor context: agencies with dark, purple, corporate sites; ARLing must not look like them.

## Operating Context

Static site on GitHub Pages, built from generators in ops/design (homepage: ops/design/postav-uvod.mjs + uvod-data.mjs, three languages sk/en/de, four intent entries all/work/read/play). Deployment pipeline: node ops/design/pred-nasadenim.mjs --zapis, obal.mjs, csp-hash.mjs, commit, push. Every page carries a strict CSP meta with script hashes. Payments through Stripe Checkout (payment links) and Etsy listings; delivery of files through a licence service on a homelab. Self-hosted Umami analytics (data-umami-event attributes on links). Pre-deploy checks block a page that states a price or claim not matching the manifests (ops/asistent-obchodu/kontrola.mjs) or a selling page not reachable from the shop or a homepage (ops/seo/dostupnost.mjs).

## Capabilities and Constraints

- Shop at /shop/ lists 11 items; product pages: /puzzle-post/, /puzzle-books/, /puzzle-books/eink-bundle/, /morning-quiet/, /classics/ben-hur/, /classics/monte-cristo/, /memory-post/, /puzzle-studio/, /puzzle-post/bulletin/. Book pages are in English.
- Prices are stated only on product pages and in the shop (kept consistent by the pre-deploy check); the homepage should not restate prices unless read from the same manifests.
- Free: daily games at /games/ (11 kinds, archive, hints), Puzzle Studio with a quota of 2 puzzles per day, samples of every book.
- Tools for work live under /efaktura/, /kontrola-suboru/, /camt053-to-excel/, /gdpr-dokumenty/, /sepa-pain001-generator/, /proof/, /renewals/ and more; developer doctors under /*-doctor/.
- No accounts required for books; licence links arrive by e-mail. Refund and terms pages exist (/terms/, /privacy/).
- Languages: sk (root), en (/en/), de (/de/); hreflang in place. Fonts: ARLing Sans and ARLing Serif (self-hosted, OFL).
- Undecided: whether the games and apps line (Android Word Search, AdMob) belongs on the homepage before it is on Google Play.

## Brand Commitments

Name ARLing (wordmark "ARLing" with a brick dot), mark in ops/design/brand/mark-inline.svg. Voice: plain, honest, specific; every claim sourced; no hype, no fake testimonials, no invented numbers. Visual system "ARLing Paper v2" (products/arling-sk/style/paper.css, rules in ops/design/paper-v2.md): warm paper ground, ink text, brick accent, serif body, sans display; real screenshots, no card grids, no decorative AI imagery. Catholic and honest values of the founder shape the tone (no manipulation, no pressure).

## Evidence on Hand

- Real product renders: /style/uvod-puzzle.webp and uvod-morning.webp (covers), /style/uvod-sample.webp (sample page), /puzzle-post/nahlad/strana.png, /morning-quiet/nahlad/vyrez.png, /memory-post/nahlad/strana.png and obalka.png, /puzzle-studio/nahlad/karta.jpg, /puzzle-books/nahlad/*.png (10 puzzle kinds), classics og.jpg covers.
- Verifiable numbers: 6 000 puzzles with unique solutions in the public Puzzle API, 11 daily game kinds, 107 published Notes articles, 80 active Etsy listings, 3 languages, form field counts per book (Morning Quiet 1 038, Puzzle Post 4 457).
- Company: ARLing s. r. o., Ivanská cesta 32E, 821 04 Bratislava, IČO 56583486, IČ DPH SK2122352100, contact andrej@arling.sk.
- Absent, must not be fabricated: customer testimonials, client logos, sales counts, ratings.

## Product Principles

1. One viewport must say what we sell and offer one primary action; everything else is secondary.
2. Prove with the real thing: a sample page, a real number, a real screenshot, never a claim.
3. Route by the visitor's job (buy a book, do a work task, play) without making the homepage a catalogue of everything.
4. Honest commerce: price, refund and what is free are always visible one click away.
5. Keep the paper identity; do not chase competitors' dark corporate look.
