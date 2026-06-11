import { Annotations, TreeNode } from '../model/types';
import { useTreeStore } from '../store/treeStore';

export interface ProjectState {
  tree: TreeNode | null;
  annotations?: Annotations;
  version: string;
}

/** Snapshot the current project (tree + annotations) for embedding in exports. */
export function currentProjectState(tree: TreeNode): ProjectState {
  return { tree, annotations: useTreeStore.getState().annotations, version: '1.0' };
}

/** JSON → base64 (UTF-8 safe; PNG tEXt and PDF comments are Latin-1 only). */
export function encodeState(state: ProjectState): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(state))));
}

export function decodeState(b64: string): ProjectState | null {
  try {
    const json = decodeURIComponent(escape(atob(b64.trim())));
    const data = JSON.parse(json);
    return data && data.tree !== undefined ? (data as ProjectState) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// PNG tEXt chunk embedding
// ---------------------------------------------------------------------------

export const PNG_KEYWORD = 'syntaxtree';

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Insert a tEXt chunk (keyword + Latin-1 text) right after the IHDR chunk.
 * Returns a new PNG byte array; viewers ignore unknown ancillary chunks.
 */
export function embedPngText(png: Uint8Array, keyword: string, text: string): Uint8Array {
  // PNG signature (8) + IHDR: length(4) + type(4) + data + crc(4)
  const ihdrLen = new DataView(png.buffer, png.byteOffset + 8, 4).getUint32(0);
  const insertAt = 8 + 4 + 4 + ihdrLen + 4;

  const payload = new Uint8Array(keyword.length + 1 + text.length);
  for (let i = 0; i < keyword.length; i++) payload[i] = keyword.charCodeAt(i);
  payload[keyword.length] = 0; // null separator
  for (let i = 0; i < text.length; i++) payload[keyword.length + 1 + i] = text.charCodeAt(i) & 0xff;

  const typeAndData = new Uint8Array(4 + payload.length);
  typeAndData.set([0x74, 0x45, 0x58, 0x74]); // 'tEXt'
  typeAndData.set(payload, 4);

  const chunk = new Uint8Array(4 + typeAndData.length + 4);
  new DataView(chunk.buffer).setUint32(0, payload.length);
  chunk.set(typeAndData, 4);
  new DataView(chunk.buffer).setUint32(4 + typeAndData.length, crc32(typeAndData));

  const out = new Uint8Array(png.length + chunk.length);
  out.set(png.subarray(0, insertAt));
  out.set(chunk, insertAt);
  out.set(png.subarray(insertAt), insertAt + chunk.length);
  return out;
}

/** Scan a PNG for a tEXt chunk with the given keyword; return its text or null. */
export function extractPngText(png: Uint8Array, keyword: string): string | null {
  if (png.length < 8) return null;
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let pos = 8;
  while (pos + 12 <= png.length) {
    const len = view.getUint32(pos);
    const type = String.fromCharCode(png[pos + 4], png[pos + 5], png[pos + 6], png[pos + 7]);
    if (type === 'tEXt') {
      const data = png.subarray(pos + 8, pos + 8 + len);
      const nul = data.indexOf(0);
      if (nul > 0) {
        const kw = String.fromCharCode(...data.subarray(0, nul));
        if (kw === keyword) return String.fromCharCode(...data.subarray(nul + 1));
      }
    }
    if (type === 'IEND') break;
    pos += 12 + len;
  }
  return null;
}

// ---------------------------------------------------------------------------
// PDF marker embedding (trailing comment after %%EOF — readers ignore it)
// ---------------------------------------------------------------------------

export const PDF_MARKER = '%SYNTAXTREE:';

export function appendPdfMarker(pdf: ArrayBuffer, b64State: string): Blob {
  return new Blob([pdf, `\n${PDF_MARKER}${b64State}\n`], { type: 'application/pdf' });
}

export function extractPdfMarker(bytes: Uint8Array): string | null {
  // The marker is ASCII and near the end of the file; decode tail as Latin-1.
  const tail = new TextDecoder('latin1').decode(bytes.subarray(Math.max(0, bytes.length - 2_000_000)));
  const m = tail.match(/%SYNTAXTREE:([A-Za-z0-9+/=]+)/);
  return m ? m[1] : null;
}
