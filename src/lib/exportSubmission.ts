import type { ProjectState } from '../export/projectState';
import { EMPTY_ANNOTATIONS } from '../model/types';
import { useTreeStore } from '../store/treeStore';

export type ExportFormat = 'png' | 'pdf' | 'svg';

function safeFilenamePart(s: string): string {
  return s.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'untitled';
}

/** Downloads a submission/lesson/template tree in the given format without
 *  navigating to the editor — reuses the existing export functions, which
 *  build their own off-DOM SVG straight from a TreeNode. The one wrinkle:
 *  currentProjectState() (used internally to embed round-trip metadata in
 *  the file) reads annotations from the live treeStore rather than taking
 *  them as an argument, so this briefly points the store at the content
 *  being exported first — harmless since it's the same store the editor
 *  itself reads/writes, just used here as a plain data source. */
export async function exportTreeAs(
  content: ProjectState,
  format: ExportFormat,
  filenameBase: string,
): Promise<void> {
  if (!content.tree) return;
  useTreeStore.getState().setAnnotations(content.annotations ?? EMPTY_ANNOTATIONS);

  const name = safeFilenamePart(filenameBase);
  if (format === 'png') {
    const { exportPng } = await import('../export/exportImage');
    await exportPng(content.tree, 2, `${name}.png`);
  } else if (format === 'pdf') {
    const { exportPdf } = await import('../export/exportPdf');
    await exportPdf(content.tree, `${name}.pdf`);
  } else {
    const { exportSvgFile } = await import('../export/exportImage');
    exportSvgFile(content.tree, `${name}.svg`);
  }
}
