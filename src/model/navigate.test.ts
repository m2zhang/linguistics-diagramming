import { describe, expect, it } from 'vitest';
import { allNodeIds, findParent, neighborId } from './navigate';
import { makeNode, type TreeNode } from './types';

/**      S
 *     /   \
 *    NP    VP
 *   /  \    |
 *  D    N   V
 */
function sample() {
  const d = makeNode('D');
  const n = makeNode('N');
  const v = makeNode('V');
  const np = makeNode('NP', [d, n]);
  const vp = makeNode('VP', [v]);
  const s = makeNode('S', [np, vp]);
  return { s, np, vp, d, n, v };
}

describe('findParent', () => {
  it('finds the parent at any depth', () => {
    const { s, np, vp, d } = sample();
    expect(findParent(s, np.id)?.label).toBe('S');
    expect(findParent(s, vp.id)?.label).toBe('S');
    expect(findParent(s, d.id)?.label).toBe('NP');
  });

  it('returns null for the root and for ids that are not in the tree', () => {
    const { s } = sample();
    expect(findParent(s, s.id)).toBeNull();
    expect(findParent(s, 'nope')).toBeNull();
    expect(findParent(null, 'anything')).toBeNull();
  });
});

describe('neighborId', () => {
  it('walks up to the parent and down to the first child', () => {
    const { s, np, d } = sample();
    expect(neighborId(s, d.id, 'up')).toBe(np.id);
    expect(neighborId(s, np.id, 'up')).toBe(s.id);
    expect(neighborId(s, s.id, 'down')).toBe(np.id);
    expect(neighborId(s, np.id, 'down')).toBe(d.id);
  });

  it('walks between siblings', () => {
    const { s, np, vp, d, n } = sample();
    expect(neighborId(s, np.id, 'right')).toBe(vp.id);
    expect(neighborId(s, vp.id, 'left')).toBe(np.id);
    expect(neighborId(s, d.id, 'right')).toBe(n.id);
  });

  /** Stopping at the end is what makes holding an arrow key safe to do. */
  it('stops at the edges instead of wrapping', () => {
    const { s, np, vp, d, n, v } = sample();
    expect(neighborId(s, np.id, 'left')).toBeNull();
    expect(neighborId(s, vp.id, 'right')).toBeNull();
    expect(neighborId(s, d.id, 'left')).toBeNull();
    expect(neighborId(s, n.id, 'right')).toBeNull();
    expect(neighborId(s, s.id, 'up')).toBeNull(); // root has no parent
    expect(neighborId(s, v.id, 'down')).toBeNull(); // leaf has no child
    expect(neighborId(s, s.id, 'left')).toBeNull(); // root has no siblings
  });

  it('is safe with no tree or no selection', () => {
    const { s, d } = sample();
    expect(neighborId(null, d.id, 'up')).toBeNull();
    expect(neighborId(s, null, 'up')).toBeNull();
    expect(neighborId(s, 'ghost', 'up')).toBeNull();
  });
});

describe('allNodeIds', () => {
  it('returns every id once, root first', () => {
    const { s, np, vp, d, n, v } = sample();
    const ids = allNodeIds(s);
    expect(ids).toEqual([s.id, np.id, d.id, n.id, vp.id, v.id]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('handles an empty canvas', () => {
    expect(allNodeIds(null)).toEqual([]);
  });

  it('handles a lone node', () => {
    const only: TreeNode = makeNode('S');
    expect(allNodeIds(only)).toEqual([only.id]);
  });
});
