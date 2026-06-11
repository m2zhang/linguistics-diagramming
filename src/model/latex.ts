import { isLeaf, TreeNode } from './types';

/** Escape characters that are special in LaTeX text. */
function escapeLatex(s: string): string {
  return s
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([&%$#_{}])/g, '\\$1')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}');
}

/**
 * Format a node label for LaTeX:
 * 1. Escape LaTeX special characters.
 * 2. Map Unicode Greek and linguistic characters to LaTeX math mode commands.
 * 3. Wrap in curly braces `{...}` if the label contains spaces, brackets, commas, or colons.
 */
export function formatLabel(label: string): string {
  // 1. Escape basic LaTeX characters
  let s = escapeLatex(label);

  // 2. Replace common Unicode linguistics symbols with LaTeX equivalents
  s = s
    .replace(/α/g, '$\\alpha$')
    .replace(/β/g, '$\\beta$')
    .replace(/φ/g, '$\\phi$')
    .replace(/θ/g, '$\\theta$')
    .replace(/λ/g, '$\\lambda$')
    .replace(/σ/g, '$\\sigma$')
    .replace(/γ/g, '$\\gamma$')
    .replace(/Δ/g, '$\\Delta$')
    .replace(/Ø|∅/g, '$\\emptyset$')
    .replace(/−/g, '-')
    .replace(/ᵢ/g, '$_i$')
    .replace(/ⱼ/g, '$_j$');

  // 3. Wrap in braces if it contains spaces, commas, brackets, or colons
  if (/[\s,\[\]:]/.test(label)) {
    return `{${s}}`;
  }
  return s;
}

/**
 * Emit qtree / tikz-qtree notation:
 *   \Tree [.S [.NP [.D the ] [.N cat ] ] [.VP [.V sat ] ] ]
 * Internal nodes use `[.LABEL ... ]`; leaves are bare escaped terminals.
 */
function nodeToQtree(node: TreeNode): string {
  const label = formatLabel(node.label);
  if (isLeaf(node)) {
    return label;
  }
  const children = node.children.map(nodeToQtree).join(' ');
  return `[.${label} ${children} ]`;
}

export function toQtree(tree: TreeNode): string {
  return `\\Tree ${nodeToQtree(tree)}`;
}

/** Pretty-print tikz forest notation recursively. */
function nodeToForest(node: TreeNode, indentLevel: number = 0): string {
  const indent = '  '.repeat(indentLevel);
  const label = formatLabel(node.label);

  if (isLeaf(node)) {
    return `${indent}[${label}]`;
  }

  const children = node.children
    .map((c) => nodeToForest(c, indentLevel + 1))
    .join('\n');

  return `${indent}[${label}\n${children}\n${indent}]`;
}

/**
 * Emit modern LaTeX forest notation:
 * \begin{forest}
 *   [S
 *     [NP
 *       [A]
 *       [Z]
 *     ]
 *     [Z]
 *   ]
 * \end{forest}
 */
export function toForest(tree: TreeNode): string {
  return `\\begin{forest}\n${nodeToForest(tree, 1)}\n\\end{forest}`;
}

/**
 * Wrap a LaTeX snippet in a full standalone document template.
 * @param body The LaTeX tree code (e.g. \begin{forest}...\end{forest} or \Tree...)
 * @param format The format type to determine the appropriate preamble packages.
 */
export function toFullDocument(body: string, format: 'forest' | 'tikz-qtree' | 'qtree'): string {
  let preamble = '';
  if (format === 'forest') {
    preamble = '\\usepackage[linguistics]{forest}';
  } else if (format === 'tikz-qtree') {
    preamble = '\\usepackage{tikz-qtree}';
  } else {
    preamble = '\\usepackage{qtree}';
  }

  return `\\documentclass{standalone}
${preamble}

\\begin{document}

${body}

\\end{document}`;
}
