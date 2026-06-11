import { isLeaf, TreeNode } from './types';

/** Escape literal brackets and whitespace inside a label so it round-trips. */
function escapeLabel(label: string): string {
  const cleaned = label.replace(/\[/g, '\\[').replace(/\]/g, '\\]');
  return cleaned.length === 0 ? '?' : cleaned;
}

/**
 * Serialize a tree to compact bracket notation:
 *   [S [NP [D the] [N cat]] [VP [V sat]]]
 * A leaf renders as just its bare label so terminals stay readable.
 */
export function serializeBracket(node: TreeNode): string {
  if (isLeaf(node)) {
    return escapeLabel(node.label);
  }
  const childStrings = node.children.map((c) =>
    isLeaf(c) ? escapeLabel(c.label) : serializeBracket(c),
  );
  return `[${escapeLabel(node.label)} ${childStrings.join(' ')}]`;
}

/** Pretty multi-line indented form, used as the canonical editor text. */
export function serializeBracketPretty(node: TreeNode, indent = 0): string {
  const pad = '  '.repeat(indent);
  if (isLeaf(node)) {
    return `${pad}${escapeLabel(node.label)}`;
  }
  // Keep a node whose children are all leaves on one line for compactness.
  if (node.children.every(isLeaf)) {
    return `${pad}${serializeBracket(node)}`;
  }
  const inner = node.children
    .map((c) => serializeBracketPretty(c, indent + 1))
    .join('\n');
  return `${pad}[${escapeLabel(node.label)}\n${inner}\n${pad}]`;
}
