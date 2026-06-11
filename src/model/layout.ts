import { isLeaf, TreeNode } from './types';

export interface PositionedNode {
  id: string;
  label: string;
  x: number;
  y: number;
  isLeaf: boolean;
  depth: number;
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

/**
 * Tidy bottom-up layout (Knuth/Reingold-Tilford simplified):
 *  - leaves get sequential x positions left to right,
 *  - every internal node is centred over its children,
 *  - y is determined by depth.
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
      nextLeafX += leafGap;
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

  function collect(node: TreeNode) {
    const x = (xById.get(node.id) ?? 0) + padding;
    const depth = depthById.get(node.id) ?? 0;
    const y = depth * levelGap + padding;
    nodes.push({ id: node.id, label: node.label, x, y, isLeaf: isLeaf(node), depth });

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
      collect(child);
    }
  }

  collect(root);

  const width = Math.max(nextLeafX - leafGap, 0) + padding * 2;
  const height = maxDepth * levelGap + padding * 2;

  return { nodes, edges, width, height };
}
