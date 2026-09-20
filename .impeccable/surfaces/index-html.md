---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: ["en/index.html","de/index.html"]
---

# Surface brief: arling.sk homepage (sk/en/de, intents all/work/read/play)

Scope: the homepage generator ops/design/postav-uvod.mjs + uvod-data.mjs + style/uvod.css. Visitor mode: Persuade.
Audience: readers who buy digital books for e-ink or print (primary), freelancers with one invoice task (secondary), gift buyers and bulletin publishers (tertiary).
Job and action: understand in one viewport that ARLing is a small publisher of books, puzzles and tools; open the shop or the one tool needed.
Proof on hand: real covers and sample pages, verifiable counts (6 000 unique-solution puzzles, 11 game kinds, 107 Notes, 3 languages, form-field counts), company registration. No testimonials, no client logos (absent, never invented).
Constraints: Paper v2 world (paper.css) is settled; light paper by default with body.noc dark support; prices only from manifests; CSP hashes; Umami events on links; pre-deploy checks (kontrola, dostupnost) must pass.

## Direction contract
Seed key: 3ee9cff7 (surface scope, mode persuade, dealt lead index 3 of the grounded list).
THESIS: The homepage is a publisher's catalogue sheet: a ruled paper order sheet that lists what ARLing publishes, with the lead title shown as a real page, and a single order path into the shop.
FIRST VIEWPORT: Masthead line (ARLing, vydavateľstvo a nástroje, Bratislava, since 2026), lead title block: a real e-ink page render at large scale with title, one sentence on what it is, format line (PDF for e-ink and print, sample first), primary button "Pozrieť obchod" and a quiet text link "Pre firmy: nástroje". No eyebrow labels, no section numbers.
VISITOR PATH: masthead → lead title → ruled catalogue list of all titles (title, one line, format, price from manifests, link) → "Zadarmo dnes" band with today's real puzzle and Puzzle Studio → ruled services list "Pre firmy" (tools by job) → gift (Memory Post) and publishers (Bulletin) as two short catalogue entries → Notes → colophon (tiráž): company data, how we work, secure payment, samples before purchase, contact.
SIGNATURE INTERACTION: the catalogue rows behave like a printed order sheet: hovering or focusing a row reveals its real page thumbnail in the margin (desktop) or inline (mobile); one authored reveal, no scattered effects.
CROSS-SURFACE REACH: the ruled-row catalogue pattern and the colophon block can be reused on /shop/ and product pages.
HONEST RISK: a catalogue can read as a list again; the lead title must be large and real, and the row count must be curated (books first, tools grouped by job, developer tools collapsed).
