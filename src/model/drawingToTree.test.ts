import { describe, expect, it } from 'vitest';
import { drawingToTree, isLineLike } from './drawingToTree';
import { Annotations } from './types';

const note = (id: string, x: number, y: number, text: string) => ({ id, x, y, text });
const arrow = (id: string, x1: number, y1: number, x2: number, y2: number) => ({
  id,
  startX: x1,
  startY: y1,
  endX: x2,
  endY: y2,
  color: '#f00',
});

describe('drawingToTree', () => {
  it('builds a tree from notes and arrows (parent above child)', () => {
    const ann: Annotations = {
      strokes: [],
      notes: [note('s', 100, 50, 'S'), note('np', 40, 150, 'NP'), note('vp', 160, 150, 'VP')],
      boxes: [],
      // One drawn downward, one drawn upward — both should resolve parent by height.
      connectors: [arrow('e1', 95, 60, 45, 140), arrow('e2', 165, 140, 110, 60)],
    };
    const { tree, usedIds, warnings } = drawingToTree(ann);
    expect(tree!.label).toBe('S');
    expect(tree!.children.map((c) => c.label)).toEqual(['NP', 'VP']); // ordered by x
    expect(usedIds).toContain('e1');
    expect(usedIds).toContain('e2');
    expect(warnings).toHaveLength(0);
  });

  it('uses straight freehand strokes as edges', () => {
    const ann: Annotations = {
      strokes: [
        {
          id: 'line',
          points: [
            { x: 100, y: 55 },
            { x: 90, y: 100 },
            { x: 80, y: 145 },
          ],
          color: '#f00',
          width: 2,
        },
      ],
      notes: [note('a', 100, 50, 'S'), note('b', 75, 155, 'NP')],
    };
    const { tree } = drawingToTree(ann);
    expect(tree!.label).toBe('S');
    expect(tree!.children[0].label).toBe('NP');
  });

  it('ignores squiggly strokes', () => {
    expect(
      isLineLike({
        id: 'sq',
        points: [
          { x: 0, y: 0 },
          { x: 50, y: 80 },
          { x: 100, y: 0 },
        ],
        color: '#f00',
        width: 2,
      }),
    ).toBe(false);
  });

  it('attaches unconnected labels under the topmost root with a warning', () => {
    const ann: Annotations = {
      strokes: [],
      notes: [note('s', 100, 50, 'S'), note('np', 40, 150, 'NP'), note('orphan', 300, 200, 'PP')],
      connectors: [arrow('e1', 100, 60, 40, 140)],
    };
    const { tree, warnings } = drawingToTree(ann);
    expect(tree!.label).toBe('S');
    expect(tree!.children.map((c) => c.label)).toContain('PP');
    expect(warnings.some((w) => w.includes('PP'))).toBe(true);
  });

  it('rejects second parent and cycles', () => {
    const ann: Annotations = {
      strokes: [],
      notes: [note('a', 100, 50, 'A'), note('b', 100, 150, 'B'), note('c', 200, 50, 'C')],
      connectors: [
        arrow('e1', 100, 55, 100, 145), // A -> B
        arrow('e2', 200, 55, 105, 145), // C -> B (second parent, ignored)
      ],
    };
    const { tree, warnings } = drawingToTree(ann);
    expect(tree!.label).toBe('A');
    expect(warnings.some((w) => w.includes('more than one'))).toBe(true);
  });

  it('returns null with no notes', () => {
    const { tree } = drawingToTree({ strokes: [], notes: [] });
    expect(tree).toBeNull();
  });
});
