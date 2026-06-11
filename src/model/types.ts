export interface TreeNode {
  id: string;
  label: string;
  children: TreeNode[];
}

let _idCounter = 0;
/** Monotonic id generator; safe for a single-session client app. */
export function makeId(): string {
  _idCounter += 1;
  return `n${_idCounter}_${Math.random().toString(36).slice(2, 7)}`;
}

export function makeNode(label: string, children: TreeNode[] = []): TreeNode {
  return { id: makeId(), label, children };
}

/** True when a node has no children (a terminal / leaf). */
export function isLeaf(node: TreeNode): boolean {
  return node.children.length === 0;
}

/** Freehand pen stroke drawn on the canvas, in world (tree) coordinates. */
export interface Stroke {
  id: string;
  points: { x: number; y: number }[];
  color: string;
  width: number;
}

/** Floating text note placed on the canvas, in world coordinates. */
export interface TextNote {
  id: string;
  x: number;
  y: number;
  text: string;
  color?: string;
}

/** Bounding box annotation drawn on the canvas, in world coordinates. */
export interface Box {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

/** Connector line (arrow) drawn on the canvas, in world coordinates. */
export interface Connector {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color: string;
}

export interface Annotations {
  strokes: Stroke[];
  notes: TextNote[];
  boxes?: Box[];
  connectors?: Connector[];
}

export const EMPTY_ANNOTATIONS: Annotations = { strokes: [], notes: [], boxes: [], connectors: [] };

/** Deep clone, assigning fresh ids (used when inserting templates/presets). */
export function cloneWithNewIds(node: TreeNode): TreeNode {
  return {
    id: makeId(),
    label: node.label,
    children: node.children.map(cloneWithNewIds),
  };
}
