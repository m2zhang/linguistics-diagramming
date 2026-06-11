import { Annotations, Stroke, TreeNode } from './types';

/**
 * Infers a syntax tree from a hand-built canvas drawing:
 * text notes become node labels, and connector arrows / line-like
 * freehand strokes become parent->child edges (parent = higher endpoint).
 */

export interface DrawingTreeResult {
  tree: TreeNode | null;
  /** Annotation ids consumed by the conversion (notes + edges used). */
  usedIds: string[];
  warnings: string[];
}

interface Pt {
  x: number;
  y: number;
}

/** Max distance from an edge endpoint to the note it snaps to. */
const SNAP_DIST = 90;

function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Perpendicular distance from point p to segment ab. */
export function pointToSegment(p: Pt, a: Pt, b: Pt): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (len2 === 0) return dist(p, a);
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  return dist(p, { x: a.x + t * abx, y: a.y + t * aby });
}

/** A freehand stroke counts as an edge if it's basically a straight line. */
export function isLineLike(stroke: Stroke): boolean {
  const pts = stroke.points;
  if (pts.length < 2) return false;
  const a = pts[0];
  const b = pts[pts.length - 1];
  const len = dist(a, b);
  if (len < 25) return false;
  const tolerance = Math.max(14, len * 0.18);
  return pts.every((p) => pointToSegment(p, a, b) <= tolerance);
}

interface Edge {
  id: string;
  top: Pt; // higher endpoint (smaller y) -> parent side
  bottom: Pt; // lower endpoint -> child side
}

export function drawingToTree(ann: Annotations): DrawingTreeResult {
  const warnings: string[] = [];
  const notes = ann.notes;
  if (notes.length === 0) {
    return { tree: null, usedIds: [], warnings: ['No text labels found — add notes for node labels.'] };
  }

  // Collect candidate edges from connectors and straight freehand strokes.
  const edges: Edge[] = [];
  for (const c of ann.connectors ?? []) {
    const s = { x: c.startX, y: c.startY };
    const e = { x: c.endX, y: c.endY };
    edges.push(s.y <= e.y ? { id: c.id, top: s, bottom: e } : { id: c.id, top: e, bottom: s });
  }
  for (const st of ann.strokes) {
    if (!isLineLike(st)) continue;
    const a = st.points[0];
    const b = st.points[st.points.length - 1];
    edges.push(a.y <= b.y ? { id: st.id, top: a, bottom: b } : { id: st.id, top: b, bottom: a });
  }

  const nearestNote = (p: Pt) => {
    let best: { id: string; d: number } | null = null;
    for (const n of notes) {
      const d = dist(p, { x: n.x, y: n.y });
      if (d <= SNAP_DIST && (!best || d < best.d)) best = { id: n.id, d };
    }
    return best?.id ?? null;
  };

  // Build nodes keyed by note id; children resolved via edges.
  const nodes = new Map<string, TreeNode>();
  for (const n of notes) nodes.set(n.id, { id: n.id, label: n.text.trim() || 'X', children: [] });

  const parentOf = new Map<string, string>();
  const usedEdgeIds: string[] = [];

  const isAncestor = (maybeAncestor: string, of: string): boolean => {
    let cur: string | undefined = of;
    while (cur) {
      if (cur === maybeAncestor) return true;
      cur = parentOf.get(cur);
    }
    return false;
  };

  for (const edge of edges) {
    const parentId = nearestNote(edge.top);
    const childId = nearestNote(edge.bottom);
    if (!parentId || !childId || parentId === childId) {
      warnings.push('A line could not be matched to two labels and was ignored.');
      continue;
    }
    if (parentOf.has(childId)) {
      warnings.push(`"${nodes.get(childId)!.label}" has more than one incoming line; extra one ignored.`);
      continue;
    }
    if (isAncestor(childId, parentId)) {
      warnings.push('A line would create a cycle and was ignored.');
      continue;
    }
    parentOf.set(childId, parentId);
    nodes.get(parentId)!.children.push(nodes.get(childId)!);
    usedEdgeIds.push(edge.id);
  }

  // Roots = notes with no parent. Topmost becomes the tree root; any other
  // roots are attached under it so no labels are silently dropped.
  const noteById = new Map(notes.map((n) => [n.id, n]));
  const roots = notes.filter((n) => !parentOf.has(n.id));
  roots.sort((a, b) => a.y - b.y || a.x - b.x);
  const root = nodes.get(roots[0].id)!;
  for (const extra of roots.slice(1)) {
    root.children.push(nodes.get(extra.id)!);
    if (edges.length > 0) {
      warnings.push(`"${nodes.get(extra.id)!.label}" wasn't connected; attached under the root.`);
    }
  }

  // Order every node's children left-to-right by their drawn x position.
  const sortChildren = (n: TreeNode) => {
    n.children.sort((a, b) => (noteById.get(a.id)?.x ?? 0) - (noteById.get(b.id)?.x ?? 0));
    n.children.forEach(sortChildren);
  };
  sortChildren(root);

  return {
    tree: root,
    usedIds: [...notes.map((n) => n.id), ...usedEdgeIds],
    warnings,
  };
}
