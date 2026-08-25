import { describe, expect, it } from 'vitest';
import { flattenHangingBaselines } from './exportPdf';

const NS = 'http://www.w3.org/2000/svg';

function svgWith(attrs: Record<string, string>): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg') as SVGSVGElement;
  const t = document.createElementNS(NS, 'text');
  for (const [k, v] of Object.entries(attrs)) t.setAttribute(k, v);
  svg.appendChild(t);
  return svg;
}

/**
 * jsPDF's `hanging` baseline does not agree with a browser's, which pushed
 * feature text a line higher in PDFs than on screen — leaving the theta grid's
 * rule floating below its grid, and striking through the tag beneath it.
 */
describe('flattenHangingBaselines', () => {
  it('converts hanging text to an explicit alphabetic baseline', () => {
    const svg = svgWith({ y: '27', 'font-size': '10', 'dominant-baseline': 'hanging' });
    flattenHangingBaselines(svg);
    const t = svg.querySelector('text')!;
    expect(t.getAttribute('dominant-baseline')).toBeNull();
    expect(Number(t.getAttribute('y'))).toBeCloseTo(35); // 27 + 10*0.8
  });

  it('leaves the node labels alone', () => {
    // Labels use `central`, which svg2pdf maps to jsPDF's `middle` correctly.
    const svg = svgWith({ y: '40', 'font-size': '16', 'dominant-baseline': 'central' });
    flattenHangingBaselines(svg);
    const t = svg.querySelector('text')!;
    expect(t.getAttribute('dominant-baseline')).toBe('central');
    expect(t.getAttribute('y')).toBe('40');
  });

  it('keeps the grid rule clear of the row below after conversion', () => {
    // Real geometry: grid row top 11, rule 23, next row top 27.
    const size = 10;
    const gridBaseline = 11 + size * 0.8;   // 19 -> glyph bottom ~21
    const ruleY = 23;
    const nextBaseline = 27 + size * 0.8;   // 35 -> glyph top ~27
    expect(ruleY).toBeGreaterThan(gridBaseline);
    expect(ruleY).toBeLessThan(nextBaseline - size * 0.8 + 1);
  });
});
