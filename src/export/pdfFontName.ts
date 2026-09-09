/**
 * The name the embedded PDF font is registered under inside jsPDF.
 *
 * Deliberately its own module, separate from the ~100 KB base64 payload in
 * pdfUnicodeFont.ts. prepareSvg() needs only this string — it writes the name
 * into the SVG's font-family so svg2pdf can pick the font up — and prepareSvg
 * is shared by the PNG and SVG exports. Importing it from the same module as
 * the payload pulled the whole font into their chunk (3 KB -> 102 KB) for a
 * font they never use.
 *
 * The name is not a real CSS font: in a browser it fails to resolve and the
 * family list falls through to the actual stack, so PNG and SVG render exactly
 * as they did before. Only jsPDF, where it *is* registered, resolves it.
 */
export const PDF_UNICODE_FONT_NAME = 'InterUnicode';
