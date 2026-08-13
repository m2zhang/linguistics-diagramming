import type { TreeNode } from './types';
import type { Direction } from './shortcuts';

/** The node whose children include `id`, or null for the root / a missing id. */
export function findParent(root: TreeNode | null, id: string): TreeNode | null {
  if (!root) return null;
  for (const child of root.children) {
    if (child.id === id) return root;
    const deeper = findParent(child, id);
    if (deeper) return deeper;
  }
  return null;
}

/** Every node id, in the order they are laid out left to right. */
export function allNodeIds(root: TreeNode | null): string[] {
  if (!root) return [];
  return [root.id, ...root.children.flatMap(allNodeIds)];
}

/**
 * Where an arrow key moves the selection: up to the parent, down to the first
 * child, left/right between siblings.
 *
 * Returns null when there is nowhere to go — at the root pressing up, on a leaf
 * pressing down — so the caller can leave the selection alone rather than
 * jumping somewhere arbitrary. Siblings deliberately do not wrap: holding → to
 * scan a layer should stop at the end, not cycle forever.
 */
export function neighborId(
  root: TreeNode | null,
  id: string | null,
  direction: Direction,
): string | null {
  if (!root || !id) return null;

  if (direction === 'up') {
    return findParent(root, id)?.id ?? null;
  }

  if (direction === 'down') {
    const node = findById(root, id);
    return node?.children[0]?.id ?? null;
  }

  const parent = findParent(root, id);
  if (!parent) return null; // the root has no siblings

  const index = parent.children.findIndex((c) => c.id === id);
  const next = direction === 'left' ? index - 1 : index + 1;
  return parent.children[next]?.id ?? null;
}

function findById(root: TreeNode, id: string): TreeNode | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const hit = findById(child, id);
    if (hit) return hit;
  }
  return null;
}
