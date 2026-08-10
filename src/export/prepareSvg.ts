import {
  edgeEndY,
  edgeStartY,
  FEATURE_FONT_SIZE,
  featureLineY,
  layoutTree,
  PositionedNode,
} from '../model/layout';
import { effectiveStyle, FONT_STACKS, TreeNode } from '../model/types';
import { currentProjectState } from './projectState';

export interface PreparedSvg {
  svg: SVGSVGElement;
  width: number;
  height: number;
}

/** Resolve a CSS variable to a concrete colour against the document root. */
function cssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/**
 * Build a standalone, self-contained <svg> of the tree for export — independent
 * of the on-screen pan/zoom. Colours are inlined (no CSS vars) and fonts are set
 * explicitly so the serialized markup renders identically off-DOM.
 */
export function buildExportSvg(tree: TreeNode, opts?: { background?: string | null }): PreparedSvg {
  const layout = layoutTree(tree, { padding: 36 });
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('xmlns', NS);
  svg.setAttribute('width', String(layout.width));
  svg.setAttribute('height', String(layout.height));
  svg.setAttribute('viewBox', `0 0 ${layout.width} ${layout.height}`);

  // Embed the complete project state as a metadata attribute. Step stamps ride
  // on the nodes themselves, so a re-imported SVG still presents step by step.
  const stateJson = JSON.stringify(currentProjectState(tree));
  svg.setAttribute('data-syntax-tree-state', stateJson);

  const colInternal = cssVar('--node-internal', '#2f3a7a');
  const colLeaf = cssVar('--node-leaf', '#1d8a6a');
  const colConnector = cssVar('--connector', '#9aa1b8');
  const colFeature = cssVar('--text-dim', '#5b6076');

  if (opts?.background) {
    const bg = document.createElementNS(NS, 'rect');
    bg.setAttribute('width', String(layout.width));
    bg.setAttribute('height', String(layout.height));
    bg.setAttribute('fill', opts.background);
    svg.appendChild(bg);
  }

  const byId = new Map<string, PositionedNode>(layout.nodes.map((n) => [n.id, n]));

  for (const e of layout.edges) {
    const parent = byId.get(e.parentId);
    const child = byId.get(e.childId);
    if (!parent || !child) continue;
    const line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', String(e.from.x));
    line.setAttribute('y1', String(edgeStartY(parent)));
    line.setAttribute('x2', String(e.to.x));
    line.setAttribute('y2', String(edgeEndY(child)));
    line.setAttribute('stroke', colConnector);
    line.setAttribute('stroke-width', String(effectiveStyle(child.style, child.isLeaf).branchWidth));
    svg.appendChild(line);
  }

  for (const n of layout.nodes) {
    const s = effectiveStyle(n.style, n.isLeaf);
    const text = document.createElementNS(NS, 'text');
    text.setAttribute('x', String(n.x));
    text.setAttribute('y', String(n.y));
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'central');
    text.setAttribute('font-size', String(s.fontSize));
    text.setAttribute('font-weight', String(s.fontWeight));
    text.setAttribute('font-family', FONT_STACKS[s.font]);
    if (s.italic) text.setAttribute('font-style', 'italic');
    text.setAttribute('fill', s.color ?? (n.isLeaf ? colLeaf : colInternal));
    text.textContent = n.label;
    svg.appendChild(text);

    (n.features ?? []).forEach((f, i) => {
      const feat = document.createElementNS(NS, 'text');
      feat.setAttribute('x', String(n.x));
      feat.setAttribute('y', String(featureLineY(n, i)));
      feat.setAttribute('text-anchor', 'middle');
      feat.setAttribute('dominant-baseline', 'hanging');
      feat.setAttribute('font-size', String(FEATURE_FONT_SIZE));
      feat.setAttribute('font-family', FONT_STACKS.mono);
      feat.setAttribute('fill', colFeature);
      feat.textContent = `[${f}]`;
      svg.appendChild(feat);
    });
  }

  return { svg, width: layout.width, height: layout.height };
}

export function serializeSvg(svg: SVGSVGElement): string {
  return new XMLSerializer().serializeToString(svg);
}
