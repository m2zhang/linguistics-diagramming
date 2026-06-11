import { layoutTree } from '../model/layout';
import { TreeNode } from '../model/types';
import { useTreeStore } from '../store/treeStore';

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

  // Embed the complete project state as a metadata attribute
  const stateJson = JSON.stringify({
    tree,
    annotations: useTreeStore.getState().annotations,
    version: '1.0'
  });
  svg.setAttribute('data-syntax-tree-state', stateJson);

  const colInternal = cssVar('--node-internal', '#2f3a7a');
  const colLeaf = cssVar('--node-leaf', '#1d8a6a');
  const colConnector = cssVar('--connector', '#9aa1b8');

  if (opts?.background) {
    const bg = document.createElementNS(NS, 'rect');
    bg.setAttribute('width', String(layout.width));
    bg.setAttribute('height', String(layout.height));
    bg.setAttribute('fill', opts.background);
    svg.appendChild(bg);
  }

  for (const e of layout.edges) {
    const line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', String(e.from.x));
    line.setAttribute('y1', String(e.from.y + 9));
    line.setAttribute('x2', String(e.to.x));
    line.setAttribute('y2', String(e.to.y - 13));
    line.setAttribute('stroke', colConnector);
    line.setAttribute('stroke-width', '1.5');
    svg.appendChild(line);
  }

  for (const n of layout.nodes) {
    const text = document.createElementNS(NS, 'text');
    text.setAttribute('x', String(n.x));
    text.setAttribute('y', String(n.y));
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'central');
    text.setAttribute('font-size', '16');
    text.setAttribute('font-weight', '600');
    if (n.isLeaf) {
      text.setAttribute('fill', colLeaf);
      text.setAttribute('font-style', 'italic');
      text.setAttribute('font-family', 'Inter, sans-serif');
    } else {
      text.setAttribute('fill', colInternal);
      text.setAttribute('font-family', 'Montserrat, Inter, sans-serif');
    }
    text.textContent = n.label;
    svg.appendChild(text);
  }

  return { svg, width: layout.width, height: layout.height };
}

export function serializeSvg(svg: SVGSVGElement): string {
  return new XMLSerializer().serializeToString(svg);
}
