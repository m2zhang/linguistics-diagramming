#!/usr/bin/env python3
"""Regenerate src/export/pdfUnicodeFont.ts.

The PDF export embeds a Unicode-capable font because jsPDF's built-in fonts are
the 14 standard PDF fonts, which use WinAnsiEncoding and have no Greek or IPA.
See the header of the generated file for the full explanation.

Source is @fontsource/inter's own .woff subsets — already a dependency, and OFL
licensed. The .woff (not .woff2) files are used deliberately: woff2 needs brotli
to decode, which fontTools does not always have available.

Usage:
    pip install fonttools
    python3 scripts/build-pdf-font.py
"""

import base64
import os
import tempfile

from fontTools import subset
from fontTools.merge import Merger
from fontTools.ttLib import TTFont

# latin  -> ASCII and the angle brackets a theta grid is written with
# latin-ext -> IPA-adjacent letters and stress marks (ə, ˈ)
# greek  -> θ itself
SUBSETS = ["latin", "latin-ext", "greek"]

# Everything a syntax tree can plausibly contain, and nothing else — the font
# is inlined as base64, so every unused range is dead weight in the bundle.
RANGES = ",".join(
    [
        "U+0020-007E",  # ASCII
        "U+00A0-00FF",  # Latin-1 supplement
        "U+0100-024F",  # Latin Extended-A/B
        "U+0250-02AF",  # IPA Extensions
        "U+02B0-02FF",  # Spacing modifiers (stress, length marks)
        "U+0370-03FF",  # Greek
        "U+2000-206F",  # General punctuation
    ]
)

# Sanity check: characters that must survive, or the export is still broken.
REQUIRED = "θəˈ<>[]Az"

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "src", "export", "pdfUnicodeFont.ts")

HEADER = '''/**
 * Inter (Latin + Latin-Ext + Greek), subsetted, base64 TTF — embedded so the
 * PDF export can render non-ASCII text.
 *
 * WHY THIS EXISTS. jsPDF's built-in fonts are the 14 standard PDF fonts, which
 * use WinAnsiEncoding — a Latin-1 charset with no Greek and no IPA. Handed a
 * string containing one non-ASCII character, jsPDF silently re-encodes the
 * WHOLE text run as UTF-16BE; with no font embedded that can render it, the
 * entire run comes out as garbage, not just the offending glyph. That broke
 * every theta grid (`<θ, θ>`) and, long before those existed, any IPA in a node
 * label — a schwa in a leaf was enough to mangle it.
 *
 * Built from @fontsource/inter's own woff subsets (OFL, already a dependency),
 * merged and subsetted to the ranges a syntax tree can actually contain:
 * ASCII, Latin-1/Extended, IPA Extensions, spacing modifiers (stress marks),
 * Greek and general punctuation. It rides in the export chunk, which is already
 * dynamically imported — nothing is added to the initial load.
 *
 * GENERATED FILE — do not edit. Regenerate with scripts/build-pdf-font.py.
 */
/** The font name lives in pdfFontName.ts so modules that need only the name
 *  (prepareSvg, and through it the PNG/SVG exports) do not pull this payload
 *  into their chunk. */
export const PDF_UNICODE_FONT_BASE64 =
  '''


def main() -> None:
    tmp = tempfile.mkdtemp()
    paths = []
    for name in SUBSETS:
        src = os.path.join(
            ROOT, "node_modules", "@fontsource", "inter", "files",
            f"inter-{name}-400-normal.woff",
        )
        font = TTFont(src)
        font.flavor = None  # woff -> plain ttf, which is what jsPDF wants
        path = os.path.join(tmp, f"{name}.ttf")
        font.save(path)
        paths.append(path)

    merged = os.path.join(tmp, "merged.ttf")
    Merger().merge(paths).save(merged)

    out = os.path.join(tmp, "subset.ttf")
    subset.main([
        merged,
        f"--unicodes={RANGES}",
        f"--output-file={out}",
        "--layout-features=",
        "--no-hinting",
        "--desubroutinize",
        "--drop-tables+=GSUB,GPOS,GDEF,DSIG",
    ])

    cmap = TTFont(out).getBestCmap()
    missing = [c for c in REQUIRED if ord(c) not in cmap]
    if missing:
        raise SystemExit(f"subset is missing required characters: {missing!r}")

    raw = open(out, "rb").read()
    b64 = base64.b64encode(raw).decode()
    with open(OUT, "w") as fh:
        fh.write(HEADER + "'" + b64 + "';\n")

    print(f"glyphs {len(cmap)}, {len(raw):,} bytes ttf, {len(b64):,} base64 -> {OUT}")


if __name__ == "__main__":
    main()
