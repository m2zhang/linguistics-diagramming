import { jsPDF } from 'jspdf';
import { svg2pdf } from 'svg2pdf.js';
import { TreeNode } from '../model/types';
import { buildExportSvg } from './prepareSvg';
import { appendPdfMarker, currentProjectState, encodeState } from './projectState';
import { PDF_UNICODE_FONT_BASE64 } from './pdfUnicodeFont';
import { PDF_UNICODE_FONT_NAME } from './pdfFontName';

/**
 * Rewrite `dominant-baseline="hanging"` text into an explicit alphabetic
 * baseline, for the PDF path only.
 *
 * svg2pdf maps `hanging` through to jsPDF, but jsPDF's notion of that baseline
 * does not agree with a browser's: the text lands roughly a line higher in the
 * PDF than it does on screen. The feature rows are positioned that way, so in a
 * PDF the theta grid's rule — drawn at an absolute y, and therefore correct —
 * appeared to float far below its grid, and struck through the tag underneath
 * when a node carried two.
 *
 * The alphabetic baseline is the one both renderers agree on, so this converts
 * to it: shift y down by the ascent that `hanging` implied, then drop the
 * attribute. Applied to a throwaway copy of the SVG inside exportPdf, so the
 * PNG and SVG exports — which the browser renders correctly already — are
 * untouched.
 */
export function flattenHangingBaselines(svg: SVGSVGElement): void {
  for (const text of Array.from(svg.querySelectorAll('text'))) {
    if (text.getAttribute('dominant-baseline') !== 'hanging') continue;
    const size = Number(text.getAttribute('font-size')) || 0;
    const y = Number(text.getAttribute('y')) || 0;
    // 0.8em is the usual ascent for the Latin faces in FONT_STACKS, and is what
    // a browser effectively uses to place a hanging baseline.
    text.setAttribute('y', String(y + size * 0.8));
    text.removeAttribute('dominant-baseline');
  }
}

/**
 * Make the embedded Unicode font available to svg2pdf.
 *
 * Registered under every style, all pointing at the same regular file: jsPDF
 * resolves a font by (name, style), so a bold or italic label containing θ
 * would otherwise miss the lookup and fall back to a standard font — the exact
 * failure this exists to prevent. A synthetic weight is a far smaller problem
 * than an unreadable label, and shipping four real weights would quadruple the
 * embedded size.
 */
function registerUnicodeFont(pdf: jsPDF): void {
  const file = `${PDF_UNICODE_FONT_NAME}.ttf`;
  pdf.addFileToVFS(file, PDF_UNICODE_FONT_BASE64);
  for (const style of ['normal', 'bold', 'italic', 'bolditalic']) {
    pdf.addFont(file, PDF_UNICODE_FONT_NAME, style);
  }
}

/**
 * Export the tree as a vector PDF using jsPDF + svg2pdf.js. The page is sized to
 * the drawing (in points) with a small margin so the tree always fits.
 */
export async function exportPdf(tree: TreeNode, filename = 'syntax-tree.pdf'): Promise<void> {
  const { svg, width, height } = buildExportSvg(tree);
  const margin = 24;
  const pageW = width + margin * 2;
  const pageH = height + margin * 2;

  const pdf = new jsPDF({
    orientation: pageW >= pageH ? 'landscape' : 'portrait',
    unit: 'pt',
    format: [pageW, pageH],
  });

  registerUnicodeFont(pdf);
  flattenHangingBaselines(svg);

  // svg2pdf needs the node attached to the DOM to read computed geometry.
  svg.style.position = 'fixed';
  svg.style.left = '-10000px';
  svg.style.top = '0';
  document.body.appendChild(svg);
  try {
    await svg2pdf(svg, pdf, { x: margin, y: margin, width, height });
    // Append the project state as a trailing comment so the PDF can be
    // re-imported and restored exactly (readers ignore data after %%EOF).
    const blob = appendPdfMarker(
      pdf.output('arraybuffer'),
      encodeState(currentProjectState(tree)),
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } finally {
    svg.remove();
  }
}
