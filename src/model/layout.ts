import { effectiveStyle, isLeaf, NodeStyle, TreeNode } from './types';

export interface PositionedNode {
  id: string;
  label: string;
  x: number;
  y: number;
  isLeaf: boolean;
  depth: number;
  style?: NodeStyle;
  features?: string[];
  /**
   * Presentation step this node appears on, clamped so it is never earlier than
   * its parent's — a child revealed before its parent would hang in mid-air.
   */
  step: number;
}

export interface Edge {
  from: { x: number; y: number };
  to: { x: number; y: number };
  parentId: string;
  childId: string;
}

export interface LayoutResult {
  nodes: PositionedNode[];
  edges: Edge[];
  width: number;
  height: number;
}

export interface LayoutOptions {
  /** Horizontal gap between adjacent leaves. */
  leafGap?: number;
  /** Vertical gap between tree levels. */
  levelGap?: number;
  /** Outer padding around the whole drawing. */
  padding?: number;
}

const DEFAULTS: Required<LayoutOptions> = {
  leafGap: 90,
  levelGap: 88,
  padding: 40,
};

/** Line height of one feature line rendered under a label. */
export const FEATURE_LINE_H = 12;
/** Font size features render at. */
export const FEATURE_FONT_SIZE = 10;

const MIN_NODE_W = 54;
const MIN_NODE_HALF_H = 13;

/** Vertical space the feature lines occupy below a label (0 when there are none). */
export function featureDrop(n: { features?: string[] }): number {
  const count = n.features?.length ?? 0;
  return count === 0 ? 0 : count * FEATURE_LINE_H + 3;
}

/**
 * Rough text metrics. There is no DOM here (layout is pure and unit-tested), so
 * widths are estimated from character count — accurate enough for spacing,
 * hit-boxes and the selection highlight.
 */
export function nodeBox(n: {
  label: string;
  features?: string[];
  style?: NodeStyle;
  isLeaf: boolean;
  x: number;
  y: number;
}): { x: number; y: number; w: number; h: number } {
  const s = effectiveStyle(n.style, n.isLeaf);
  const labelW = n.label.length * s.fontSize * 0.62;
  let featureW = 0;
  for (const f of n.features ?? []) {
    featureW = Math.max(featureW, f.length * FEATURE_FONT_SIZE * 0.58);
  }
  const w = Math.max(MIN_NODE_W, Math.max(labelW, featureW) + 18);
  const halfH = Math.max(MIN_NODE_HALF_H, s.fontSize * 0.8);
  return { x: n.x - w / 2, y: n.y - halfH, w, h: halfH * 2 + featureDrop(n) };
}

/** Where a branch leaves a parent — below its label and any feature lines. */
export function edgeStartY(parent: PositionedNode): number {
  return parent.y + effectiveStyle(parent.style, parent.isLeaf).fontSize * 0.5 + 1 + featureDrop(parent);
}

/** Where a branch meets a child — just above its label. */
export function edgeEndY(child: PositionedNode): number {
  return child.y - (effectiveStyle(child.style, child.isLeaf).fontSize * 0.5 + 5);
}

/** Baseline (hanging) of the i-th feature line under a node. */
export function featureLineY(n: PositionedNode, i: number): number {
  return n.y + effectiveStyle(n.style, n.isLeaf).fontSize * 0.5 + 3 + i * FEATURE_LINE_H;
}

/**
 * Tidy bottom-up layout (Knuth/Reingold-Tilford simplified):
 *  - leaves get sequential x positions left to right,
 *  - every internal node is centred over its children,
 *  - y is determined by depth.
 *
 * Leaf spacing widens past `leafGap` when a label is too big to fit, so bumping
 * a node's font size in the inspector doesn't make it collide with its sibling.
 *
 * Pure function, no DOM — unit tested. Returns absolute coordinates already
 * offset by `padding`, plus the total drawing width/height.
 */
export function layoutTree(root: TreeNode, options: LayoutOptions = {}): LayoutResult {
  const { leafGap, levelGap, padding } = { ...DEFAULTS, ...options };

  const xById = new Map<string, number>();
  const depthById = new Map<string, number>();
  let nextLeafX = 0;
  let maxDepth = 0;

  function assign(node: TreeNode, depth: number): number {
    depthById.set(node.id, depth);
    if (depth > maxDepth) maxDepth = depth;

    let x: number;
    if (isLeaf(node)) {
      x = nextLeafX;
      const { w } = nodeBox({ ...node, isLeaf: true, x: 0, y: 0 });
      nextLeafX += Math.max(leafGap, w + 14);
    } else {
      const childXs = node.children.map((c) => assign(c, depth + 1));
      x = (childXs[0] + childXs[childXs.length - 1]) / 2;
    }
    xById.set(node.id, x);
    return x;
  }

  assign(root, 0);

  const nodes: PositionedNode[] = [];
  const edges: Edge[] = [];

  function collect(node: TreeNode, parentStep = 0) {
    const x = (xById.get(node.id) ?? 0) + padding;
    const depth = depthById.get(node.id) ?? 0;
    const y = depth * levelGap + padding;
    const step = Math.max(node.step ?? 0, parentStep);
    nodes.push({
      id: node.id,
      label: node.label,
      x,
      y,
      isLeaf: isLeaf(node),
      depth,
      style: node.style,
      features: node.features,
      step,
    });

    for (const child of node.children) {
      const cx = (xById.get(child.id) ?? 0) + padding;
      const cDepth = depthById.get(child.id) ?? 0;
      const cy = cDepth * levelGap + padding;
      edges.push({
        from: { x, y },
        to: { x: cx, y: cy },
        parentId: node.id,
        childId: child.id,
      });
      collect(child, step);
    }
  }

  collect(root);

  // Size the drawing to the actual boxes so wide labels and feature lines are
  // not clipped in exports.
  let right = 0;
  let bottom = 0;
  for (const n of nodes) {
    const box = nodeBox(n);
    right = Math.max(right, box.x + box.w);
    bottom = Math.max(bottom, box.y + box.h);
  }

  return { nodes, edges, width: right + padding, height: bottom + padding };
}
