# Slitherlink Pattern 01: evaluation sample

Three actual items from the fixed 25-puzzle pack. Download for inspection and layout evaluation. Commercial publication terms are not offered in this preview.

Each 7 x 7 puzzle has a separate puzzle SVG, solution SVG and JSON record. Manifest JSON/CSV records file names, clue count, solver steps and SHA-256 fingerprints. SVG dimensions are 760 x 760 units including 30 units of padding; there is no page furniture or watermark. Black lines and grey answer clues; transparent background. Arial/Helvetica/sans-serif digits remain editable text. Fonts are not embedded: check appearance in your layout application.

Rules: draw one closed loop along grid edges. No branches or crossings. Each number tells how many of its four edges belong to the loop. Blank cells have no number constraint.

Pattern is this pack's own label: every item was solved by the engine using local and pattern rules (layers 1 and 2), without its trial layer. It is not an external difficulty rating. Each puzzle has exactly one solution according to the exhaustive solver with a limit of two. No claims of exclusivity, hand authorship or worldwide novelty.

JSON schema v1: clues is a row-major array of 49 numbers (0..3) or null. solution.h has 56 values: h[row * 7 + col], row 0..7, col 0..6. solution.v has 56 values: v[row * 8 + col], row 0..6, col 0..7. A value of 1 is a loop edge; 0 is absent. IDs stay stable. manifest.json has no solution data; the per-item JSON includes the answer. Do not give answer JSON to readers before they finish.

For layout: place *-puzzle.svg on the puzzle page, and the same ID's *-solution.svg on the answer page. Preserve aspect ratio. JSON is data, not a generator or an application. No network or AI is needed to open these exports.
