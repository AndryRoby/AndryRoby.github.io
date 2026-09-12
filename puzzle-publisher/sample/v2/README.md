# Slitherlink Pattern 01: 3-puzzle evaluation sample

This evaluation sample contains the first three items from the 25-puzzle pack. It does not grant a commercial publication license.

## Files

- SVG: separate puzzle and solution artwork per ID, 760 x 760 units including a 30-unit margin; transparent background. Editable Arial/Helvetica/sans-serif digits, no font files embedded.
- PNG: the same individual artwork at 1520 x 1520 pixels, with a white background. Preserve aspect ratio. At 300 pixels per inch this corresponds to about 129 mm square; the pixel dimensions are authoritative.
- PDF: puzzles.pdf and solutions.pdf, A4 portrait, one item per page in matching ID order. 3 pages each. Vector artwork, ID and page number. Print at actual size.
- JSON: one record per ID containing clues and solution edges. Do not give answer JSON to readers before they finish.
- manifest.json and manifest.csv: filenames, SHA-256, dimensions or page counts; the JSON also maps every puzzle ID to its matching files and PDF page.

## Rules and difficulty

Draw one closed loop along the grid edges, without branches or crossings. Each number specifies how many of its four cell edges belong to the loop. Blank cells have no number constraint.

Pattern is our own label: each 7 x 7 puzzle was solved by our engine with local and pattern rules, without its trial layer. Each has exactly one solution according to the exhaustive solver with a limit of two. This is not a human-panel difficulty rating.

## Data format

Schema v1 uses a row-major clues array of 49 numbers (0..3) or null. solution.h contains 56 values: h[row * 7 + column], rows 0..7, columns 0..6. solution.v contains 56 values: v[row * 8 + column], rows 0..6, columns 0..7. A value of 1 is a loop edge; 0 is absent. The ID in each filename identifies the same puzzle in all four formats.

## Layout

Place the file ending -puzzle on the puzzle page and its matching -solution on the answer page. SVG preserves editable text; confirm digit appearance in your layout application. PNG supplies a fixed raster rendering. The PDF sheets provide a separate ready-to-print reference. Review your final publication proof after any resize or layout change.

These are static exports. No account, generator, API or AI service is needed to open them. No exclusivity or worldwide originality is claimed.
