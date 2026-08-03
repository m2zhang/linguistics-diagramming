/** Font stacks a node label can use. Keys are stable — they end up in saved files. */
export type NodeFont = 'display' | 'sans' | 'serif' | 'mono';

/**
 * Concrete stacks rather than CSS vars: the export path (prepareSvg) serializes
 * markup off-DOM, where `var(--font-display)` would not resolve.
 */
export const FONT_STACKS: Record<NodeFont, string> = {
  display: "Montserrat, Inter, system-ui, sans-serif",
  sans: "Inter, system-ui, -apple-system, sans-serif",
  serif: "'Iowan Old Style', Palatino, Georgia, 'Times New Roman', serif",
  mono: "'SF Mono', 'Fira Code', ui-monospace, Menlo, Consolas, monospace",
};

export const FONT_LABELS: Record<NodeFont, string> = {
  display: 'Montserrat',
  sans: 'Inter',
  serif: 'Serif',
  mono: 'Mono',
};

/**
 * Per-node presentation. Every field is optional and an absent field means
 * "use the default for this node kind" — so untouched nodes stay tiny in saved
 * files and keep rendering from app.css.
 */
export interface NodeStyle {
  font?: NodeFont;
  /** Label size in px. */
  fontSize?: number;
  fontWeight?: number;
  italic?: boolean;
  /** Concrete colour (hex), not a CSS var — see FONT_STACKS. Absent = theme default. */
  color?: string;
  /** Stroke width of the branch running from this node's PARENT down to it. */
  branchWidth?: number;
}

/** A NodeStyle with every presentational field filled in. */
export interface ResolvedNodeStyle {
  font: NodeFont;
  fontSize: number;
  fontWeight: number;
  italic: boolean;
  branchWidth: number;
  color?: string;
}

/** Mirrors `.tnode-label` in app.css. */
const INTERNAL_DEFAULTS: ResolvedNodeStyle = {
  font: 'display',
  fontSize: 16,
  fontWeight: 600,
  italic: false,
  branchWidth: 1.5,
};

/** Mirrors `.tnode-label.leaf` in app.css. */
const LEAF_DEFAULTS: ResolvedNodeStyle = { ...INTERNAL_DEFAULTS, font: 'sans', italic: true };

/** Fill in whichever fields the node left unset. */
export function effectiveStyle(style: NodeStyle | undefined, leaf: boolean): ResolvedNodeStyle {
  const out = { ...(leaf ? LEAF_DEFAULTS : INTERNAL_DEFAULTS) };
  if (style) {
    for (const [k, v] of Object.entries(style)) {
      if (v !== undefined) (out as Record<string, unknown>)[k] = v;
    }
  }
  return out;
}

/** Drop unset fields; collapse an all-default style to `undefined`. */
export function normalizeStyle(style: NodeStyle | undefined): NodeStyle | undefined {
  if (!style) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(style)) {
    if (v !== undefined) out[k] = v;
  }
  return Object.keys(out).length > 0 ? (out as NodeStyle) : undefined;
}

/** Trim, drop blanks, de-duplicate. Returns undefined when nothing is left. */
export function normalizeFeatures(features: string[] | undefined): string[] | undefined {
  if (!features) return undefined;
  const seen = new Set<string>();
  for (const f of features) {
    const t = f.trim();
    if (t) seen.add(t);
  }
  return seen.size > 0 ? [...seen] : undefined;
}

export interface TreeNode {
  id: string;
  label: string;
  children: TreeNode[];
  /** Typography / branch overrides. Absent = stylesheet defaults. */
  style?: NodeStyle;
  /** Syntactic features shown under the label, e.g. ['+wh', 'uCase:nom']. */
  features?: string[];
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
  const copy: TreeNode = {
    id: makeId(),
    label: node.label,
    children: node.children.map(cloneWithNewIds),
  };
  if (node.style) copy.style = { ...node.style };
  if (node.features) copy.features = [...node.features];
  return copy;
}

/**
 * Copy style + features from `from` onto structurally-matching nodes of `to`.
 *
 * Re-parsing the bracket editor rebuilds the tree from scratch, which would
 * otherwise discard everything the inspector set. Matching is positional
 * (same index at the same depth), so relabelling a node keeps its formatting
 * while restructuring the tree drops it — the behaviour that surprises least.
 */
export function carryOverDecorations(from: TreeNode | null, to: TreeNode): TreeNode {
  if (!from) return to;
  const next: TreeNode = {
    ...to,
    children: to.children.map((c, i) =>
      from.children[i] ? carryOverDecorations(from.children[i], c) : c,
    ),
  };
  if (from.style) next.style = { ...from.style };
  if (from.features?.length) next.features = [...from.features];
  return next;
}
