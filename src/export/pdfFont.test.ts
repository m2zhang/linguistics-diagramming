import { describe, expect, it } from 'vitest';
import { PDF_UNICODE_FONT_BASE64 } from './pdfUnicodeFont';
import { PDF_UNICODE_FONT_NAME } from './pdfFontName';

/**
 * jsPDF's standard fonts use WinAnsiEncoding. Given any non-ASCII character it
 * silently re-encodes the entire text run as UTF-16BE, and with no embedded
 * font to render it the whole string comes out as garbage — `<θ, θ>` rendered
 * as `< ¸ ,  ¸ >`. These guard the embedded font that fixes it.
 */
describe('embedded PDF font', () => {
  it('is a real TrueType file', () => {
    const head = atob(PDF_UNICODE_FONT_BASE64.slice(0, 8));
    // TTF magic: 0x00010000. Catches a truncated or mis-generated blob.
    expect([...head.slice(0, 4)].map((c) => c.charCodeAt(0))).toEqual([0, 1, 0, 0]);
  });

  it('is big enough to actually contain glyphs but not bloated', () => {
    const bytes = (PDF_UNICODE_FONT_BASE64.length * 3) / 4;
    expect(bytes).toBeGreaterThan(20_000);
    expect(bytes).toBeLessThan(200_000);
  });

  it('uses a name that cannot resolve as a real CSS font', () => {
    // The whole scheme depends on browsers failing to find this and falling
    // through to the real stack, so PNG/SVG export is untouched.
    expect(PDF_UNICODE_FONT_NAME).toBe('InterUnicode');
  });
});
