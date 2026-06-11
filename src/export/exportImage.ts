import { TreeNode } from '../model/types';
import { buildExportSvg, serializeSvg } from './prepareSvg';
import { currentProjectState, embedPngText, encodeState, PNG_KEYWORD } from './projectState';

function triggerDownload(blobUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Rasterize the tree to a PNG at the given pixel scale and download it. */
export async function exportPng(tree: TreeNode, scale = 2): Promise<void> {
  const { svg, width, height } = buildExportSvg(tree, { background: '#ffffff' });
  const source = serializeSvg(svg);
  const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  try {
    const img = new Image();
    img.decoding = 'sync';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to render SVG to image'));
      img.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.drawImage(img, 0, 0);

    // Embed the project state as a PNG tEXt chunk so the file can be
    // re-imported later and restored exactly.
    const blob: Blob = await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encode failed'))), 'image/png'),
    );
    const raw = new Uint8Array(await blob.arrayBuffer());
    const withState = embedPngText(raw, PNG_KEYWORD, encodeState(currentProjectState(tree)));
    const pngUrl = URL.createObjectURL(
      new Blob([withState.buffer as ArrayBuffer], { type: 'image/png' }),
    );
    try {
      triggerDownload(pngUrl, 'syntax-tree.png');
    } finally {
      setTimeout(() => URL.revokeObjectURL(pngUrl), 1000);
    }
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Download the raw vector SVG file. */
export function exportSvgFile(tree: TreeNode): void {
  const { svg } = buildExportSvg(tree, { background: '#ffffff' });
  const source = serializeSvg(svg);
  const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, 'syntax-tree.svg');
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
