import { makeNode, TreeNode } from '../model/types';

export interface OcrBox {
  text: string;
  /** Bounding box in image pixels. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  confidence: number;
}

interface PlacedNode {
  node: TreeNode;
  cx: number; // horizontal centre
  cy: number; // vertical centre
  row: number;
}

/**
 * Heuristic structure inference (no line tracing): treat vertical position as
 * tree depth and horizontal overlap as parent/child kinship.
 *
 *  1. Sort boxes top→bottom and cluster them into rows by y-proximity.
 *  2. Each row becomes a tree depth.
 *  3. Attach every node in a row to the nearest node in the row above whose
 *     horizontal span best contains/overlaps it.
 *
 * Returns a best-guess tree plus a 0..1 confidence the caller can surface. The
 * result is intentionally a *starting point* the student then corrects.
 */
export function inferTree(boxes: OcrBox[]): { tree: TreeNode | null; confidence: number } {
  const clean = boxes
    .map((b) => ({ ...b, text: b.text.trim() }))
    .filter((b) => b.text.length > 0 && /[A-Za-z'’]/.test(b.text));

  if (clean.length === 0) return { tree: null, confidence: 0 };

  // Median box height drives the row-clustering tolerance.
  const heights = clean.map((b) => b.y1 - b.y0).sort((a, b) => a - b);
  const medianH = heights[Math.floor(heights.length / 2)] || 20;
  const rowTol = medianH * 0.8;

  const sorted = [...clean].sort((a, b) => (a.y0 + a.y1) / 2 - (b.y0 + b.y1) / 2);

  // Cluster into rows.
  const rows: OcrBox[][] = [];
  for (const b of sorted) {
    const cy = (b.y0 + b.y1) / 2;
    const last = rows[rows.length - 1];
    if (last) {
      const lastCy =
        last.reduce((s, x) => s + (x.y0 + x.y1) / 2, 0) / last.length;
      if (Math.abs(cy - lastCy) <= rowTol) {
        last.push(b);
        continue;
      }
    }
    rows.push([b]);
  }

  // Build placed nodes row by row, sorted left→right within each row.
  const placedRows: PlacedNode[][] = rows.map((row, rowIdx) =>
    [...row]
      .sort((a, b) => (a.x0 + a.x1) / 2 - (b.x0 + b.x1) / 2)
      .map((b) => ({
        node: makeNode(b.text),
        cx: (b.x0 + b.x1) / 2,
        cy: (b.y0 + b.y1) / 2,
        row: rowIdx,
      })),
  );

  let linked = 0;
  let attempts = 0;

  // Link each non-top row to the nearest parent above by horizontal distance.
  for (let r = 1; r < placedRows.length; r++) {
    const parents = placedRows[r - 1];
    for (const child of placedRows[r]) {
      attempts += 1;
      if (parents.length === 0) continue;
      let best = parents[0];
      let bestDist = Math.abs(parents[0].cx - child.cx);
      for (const p of parents) {
        const d = Math.abs(p.cx - child.cx);
        if (d < bestDist) {
          best = p;
          bestDist = d;
        }
      }
      best.node.children.push(child.node);
      linked += 1;
    }
  }

  // Determine the root: prefer a single node in the top row; otherwise wrap.
  const topRow = placedRows[0];
  let tree: TreeNode;
  if (topRow.length === 1) {
    tree = topRow[0].node;
  } else {
    // Multiple top-row nodes — wrap them under a synthetic root for editing.
    tree = makeNode('S', topRow.map((p) => p.node));
  }

  // Confidence blends OCR confidence with how cleanly rows linked up.
  const avgOcr =
    clean.reduce((s, b) => s + (b.confidence || 0), 0) / clean.length / 100;
  const linkRatio = attempts === 0 ? 1 : linked / attempts;
  const confidence = Math.max(0, Math.min(1, 0.5 * avgOcr + 0.5 * linkRatio));

  return { tree, confidence };
}
