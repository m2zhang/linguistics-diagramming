import { jsPDF } from 'jspdf';
import { svg2pdf } from 'svg2pdf.js';
import { TreeNode } from '../model/types';
import { buildExportSvg } from './prepareSvg';
import { appendPdfMarker, currentProjectState, encodeState } from './projectState';

/**
 * Export the tree as a vector PDF using jsPDF + svg2pdf.js. The page is sized to
 * the drawing (in points) with a small margin so the tree always fits.
 */
export async function exportPdf(tree: TreeNode): Promise<void> {
  const { svg, width, height } = buildExportSvg(tree);
  const margin = 24;
  const pageW = width + margin * 2;
  const pageH = height + margin * 2;

  const pdf = new jsPDF({
    orientation: pageW >= pageH ? 'landscape' : 'portrait',
    unit: 'pt',
    format: [pageW, pageH],
  });

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
    a.download = 'syntax-tree.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } finally {
    svg.remove();
  }
}
