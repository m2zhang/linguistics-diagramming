import { isThetaGrid } from './features';
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
  /** Per-feature colour overrides, carried through so the canvas and the
   *  export path resolve a tag's colour identically. */
  featureColors?: Record<string, string>;
  /**
   * Presentation step this node appears on, clamped so it is never earlier than
   * its parent's — a child revealed before its parent would hang in mid-air.
   */
  step: number;
  triangle?: boolean;
}

export interface Edge {
  from: { x: number; y: number };
  to: { x: number; y: number };
  parentId: string;
  childId: string;
  triangle?: boolean;
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

/**
 * Extra height a theta-grid row claims for the rule drawn under it.
 *
 * Without this the rule sits in the row's own leading, 1px above where the next
 * feature hangs — which reads as a line struck through the tag below it. The
 * row has to actually get taller; nudging the rule up instead would just move
 * the collision onto the grid's own descenders.
 */
const GRID_RULE_SPACE = 4;

/** Height of one feature row, including a grid's rule when it has one. */
function featureRowH(feature: string | undefined): number {
  return FEATURE_LINE_H + (feature && isThetaGrid(feature) ? GRID_RULE_SPACE : 0);
}

/** Distance from the first feature row's top to the i-th row's top. */
function featureRowOffset(features: string[] | undefined, i: number): number {
  let y = 0;
  for (let j = 0; j < i; j += 1) y += featureRowH(features?.[j]);
  return y;
}

/** Vertical space the feature lines occupy below a label (0 when there are none). */
export function featureDrop(n: { features?: string[] }): number {
  const count = n.features?.length ?? 0;
  return count === 0 ? 0 : featureRowOffset(n.features, count) + 3;
}

/**
 * Rough text metrics. There is no DOM here (layout is pure and unit-tested), so
 * widths are estimated from character count — accurate enough for spacing,
 * hit-boxes and the selection highlight.
 */
/**
 * Estimated rendered width of a label. Shared by nodeBox() and the underline
 * rule so the two cannot drift apart when the estimate is tuned.
 */
export function labelWidth(label: string, fontSize: number): number {
  return label.length * fontSize * 0.62;
}

export function nodeBox(n: {
  label: string;
  features?: string[];
  style?: NodeStyle;
  isLeaf: boolean;
  x: number;
  y: number;
}): { x: number; y: number; w: number; h: number } {
  const s = effectiveStyle(n.style, n.isLeaf);
  const labelW = labelWidth(n.label, s.fontSize);
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
  return (
    n.y +
    effectiveStyle(n.style, n.isLeaf).fontSize * 0.5 +
    3 +
    featureRowOffset(n.features, i)
  );
}

/**
 * Rule under an underlined *label* (the inspector's U button): its y, and how
 * far it runs either side of the node's centre.
 *
 * Sits 1px above where featureLineY() hangs the first feature, so an underlined
 * node can still carry tags without the two colliding. The rule tracks the
 * label rather than the node box, which is padded by 18px and would leave the
 * line floating well past the text it belongs to.
 */
export function underlineRule(n: PositionedNode): { y: number; halfWidth: number } {
  const s = effectiveStyle(n.style, n.isLeaf);
  return {
    y: n.y + s.fontSize * 0.5 + 2,
    halfWidth: Math.max(labelWidth(n.label, s.fontSize), s.fontSize) / 2,
  };
}

/**
 * Rule under the i-th feature line — the theta grid's own underline.
 *
 * featureLineY() is a *hanging* baseline, so the text runs from there down by
 * FEATURE_FONT_SIZE; the rule goes 1px below that. FEATURE_LINE_H is 12 against
 * a 10px font, so the line lands inside the row's own leading and never touches
 * the next feature. featureDrop() already reserves the row, so the node box
 * covers the rule without any change to hit-testing.
 */
export function featureUnderlineRule(
  n: PositionedNode,
  i: number,
  feature: string,
): { y: number; halfWidth: number } {
  return {
    y: featureLineY(n, i) + FEATURE_FONT_SIZE + 2,
    halfWidth: Math.max(feature.length * FEATURE_FONT_SIZE * 0.58, FEATURE_FONT_SIZE) / 2,
  };
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
      featureColors: node.featureColors,
      step,
      triangle: node.triangle,
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
        triangle: child.triangle,
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
