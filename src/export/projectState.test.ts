import { describe, expect, it } from 'vitest';
import {
  appendPdfMarker,
  decodeState,
  embedPngText,
  encodeState,
  extractPdfMarker,
  extractPngText,
  PNG_KEYWORD,
  ProjectState,
} from './projectState';

const STATE: ProjectState = {
  tree: { id: 'r', label: 'S', children: [{ id: 'c', label: 'NP φ Ø tᵢ', children: [] }] },
  annotations: { strokes: [], notes: [{ id: 'n', x: 1, y: 2, text: 'note' }] } as never,
  version: '1.0',
};

/** Minimal structurally-valid PNG: signature + IHDR + IEND. */
function fakePng(): Uint8Array {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const ihdr = new Uint8Array(4 + 4 + 13 + 4);
  new DataView(ihdr.buffer).setUint32(0, 13);
  ihdr.set([0x49, 0x48, 0x44, 0x52], 4); // 'IHDR'
  const iend = new Uint8Array(12);
  iend.set([0x49, 0x45, 0x4e, 0x44], 4); // 'IEND'
  return new Uint8Array([...sig, ...ihdr, ...iend]);
}

describe('project state embedding', () => {
  it('base64 round-trips unicode state', () => {
    const decoded = decodeState(encodeState(STATE));
    expect(decoded).toEqual(STATE);
  });

  it('rejects garbage base64', () => {
    expect(decodeState('not-valid-@@@')).toBeNull();
    expect(decodeState(btoa('{"no":"tree"}'))).toBeNull();
  });

  it('PNG tEXt chunk round-trips', () => {
    const b64 = encodeState(STATE);
    const png = embedPngText(fakePng(), PNG_KEYWORD, b64);
    expect(extractPngText(png, PNG_KEYWORD)).toBe(b64);
    expect(decodeState(extractPngText(png, PNG_KEYWORD)!)).toEqual(STATE);
  });

  it('PNG without the chunk returns null', () => {
    expect(extractPngText(fakePng(), PNG_KEYWORD)).toBeNull();
  });

  it('PDF marker round-trips', async () => {
    const fakePdf = new TextEncoder().encode('%PDF-1.4\n...content...\n%%EOF').buffer;
    const blob = appendPdfMarker(fakePdf, encodeState(STATE));
    // jsdom's Blob lacks arrayBuffer(); read it with FileReader instead.
    const bytes: Uint8Array = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(new Uint8Array(fr.result as ArrayBuffer));
      fr.onerror = () => reject(fr.error);
      fr.readAsArrayBuffer(blob);
    });
    const marker = extractPdfMarker(bytes);
    expect(marker).not.toBeNull();
    expect(decodeState(marker!)).toEqual(STATE);
  });
});
