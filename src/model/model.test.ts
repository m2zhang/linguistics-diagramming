import { describe, expect, it } from 'vitest';
import { parseBracket } from './bracketParser';
import { serializeBracket } from './bracketSerializer';
import { toForest, toQtree, formatLabel, toFullDocument } from './latex';
import { layoutTree } from './layout';
import { carryOverDecorations, cloneWithNewIds, effectiveStyle, TreeNode } from './types';

const SAMPLE = '[S [NP [D the] [N cat]] [VP [V sat]]]';

/** Strip ids so two trees can be compared by shape + labels. */
function shape(node: TreeNode): unknown {
  return { label: node.label, children: node.children.map(shape) };
}

describe('bracketParser', () => {
  it('parses a nested sentence', () => {
    const { tree, errors } = parseBracket(SAMPLE);
    expect(errors).toHaveLength(0);
    expect(tree).not.toBeNull();
    expect(tree!.label).toBe('S');
    expect(tree!.children.map((c) => c.label)).toEqual(['NP', 'VP']);
    expect(tree!.children[0].children.map((c) => c.label)).toEqual(['D', 'N']);
    // 'the' and 'cat' are terminals (leaves).
    expect(tree!.children[0].children[0].children[0].label).toBe('the');
  });

  it('returns null tree for empty input without throwing', () => {
    expect(parseBracket('   ').tree).toBeNull();
  });

  it('reports an unclosed bracket but still recovers a tree', () => {
    const { tree, errors } = parseBracket('[S [NP the]');
    expect(tree).not.toBeNull();
    expect(errors.some((e) => /unclosed/i.test(e.message))).toBe(true);
  });

  it('handles a bare label with no children', () => {
    const { tree } = parseBracket('[NP]');
    expect(tree!.label).toBe('NP');
    expect(tree!.children).toHaveLength(0);
  });
});

describe('round-trip parse <-> serialize', () => {
  it('serialize(parse(x)) reproduces the normalized source', () => {
    const { tree } = parseBracket(SAMPLE);
    expect(serializeBracket(tree!)).toBe(SAMPLE);
  });

  it('is stable across a second round-trip', () => {
    const once = serializeBracket(parseBracket(SAMPLE).tree!);
    const twice = serializeBracket(parseBracket(once).tree!);
    expect(twice).toBe(once);
  });
});

describe('latex qtree', () => {
  it('emits a \\Tree expression that re-parses to the same shape', () => {
    const { tree } = parseBracket(SAMPLE);
    const latex = toQtree(tree!);
    expect(latex.startsWith('\\Tree ')).toBe(true);
    // Convert qtree's `[.X` back to bracket `[X` and drop trailing-space closes.
    const asBracket = latex
      .replace(/^\\Tree\s+/, '')
      .replace(/\[\.(\S+)/g, '[$1')
      .replace(/\s+\]/g, ']');
    const reparsed = parseBracket(asBracket).tree!;
    expect(shape(reparsed)).toEqual(shape(tree!));
  });
});

describe('latex forest', () => {
  it('emits a forest environment with correct nodes', () => {
    const { tree } = parseBracket('[S [NP a] [VP b]]');
    const latex = toForest(tree!);
    expect(latex).toContain('\\begin{forest}');
    expect(latex).toContain('\\end{forest}');
    expect(latex).toContain('[S');
    expect(latex).toContain('[NP');
    expect(latex).toContain('[a]');
    expect(latex).toContain('[VP');
    expect(latex).toContain('[b]');
  });
});

describe('formatLabel', () => {
  it('escapes standard LaTeX characters', () => {
    expect(formatLabel('NP & VP')).toBe('{NP \\& VP}');
  });

  it('maps greek characters to math mode', () => {
    expect(formatLabel('α')).toBe('$\\alpha$');
    expect(formatLabel('β')).toBe('$\\beta$');
    expect(formatLabel('φ')).toBe('$\\phi$');
  });

  it('wraps labels containing spaces, commas, brackets, or colons in curly braces', () => {
    expect(formatLabel('the cat')).toBe('{the cat}');
    expect(formatLabel('[+F]')).toBe('{[+F]}');
    expect(formatLabel('NP,VP')).toBe('{NP,VP}');
    expect(formatLabel('C:0')).toBe('{C:0}');
  });
});

describe('toFullDocument', () => {
  it('wraps LaTeX content in a standalone template', () => {
    const doc = toFullDocument('\\Tree [.S A ]', 'qtree');
    expect(doc).toContain('\\documentclass{standalone}');
    expect(doc).toContain('\\usepackage{qtree}');
    expect(doc).toContain('\\begin{document}');
    expect(doc).toContain('\\Tree [.S A ]');
  });
});

describe('layoutTree', () => {
  it('gives leaves strictly increasing, non-overlapping x', () => {
    const { tree } = parseBracket(SAMPLE);
    const { nodes } = layoutTree(tree!);
    const leafXs = nodes.filter((n) => n.isLeaf).map((n) => n.x);
    for (let i = 1; i < leafXs.length; i++) {
      expect(leafXs[i]).toBeGreaterThan(leafXs[i - 1]);
    }
  });

  it('centres a parent over its children', () => {
    const { tree } = parseBracket('[X [A a] [B b]]');
    const { nodes } = layoutTree(tree!);
    const byLabel = (l: string) => nodes.find((n) => n.label === l)!;
    const x = byLabel('X').x;
    expect(x).toBeCloseTo((byLabel('A').x + byLabel('B').x) / 2);
  });

  it('produces one edge per parent-child link', () => {
    const { tree } = parseBracket(SAMPLE);
    const { edges } = layoutTree(tree!);
    // S->NP, S->VP, NP->D, NP->N, D->the, N->cat, VP->V, V->sat = 8
    expect(edges).toHaveLength(8);
  });

  it('carries node style and features through to positioned nodes', () => {
    const { tree } = parseBracket('[X [A a] [B b]]');
    tree!.children[0].style = { fontSize: 30 };
    tree!.children[0].features = ['+wh'];

    const { nodes } = layoutTree(tree!);
    const a = nodes.find((n) => n.label === 'A')!;
    expect(a.style).toEqual({ fontSize: 30 });
    expect(a.features).toEqual(['+wh']);
  });

  it('widens leaf spacing so an enlarged label cannot collide with its sibling', () => {
    const { tree } = parseBracket('[X [A determiner] [B b]]');
    const before = layoutTree(tree!);
    const gapBefore =
      before.nodes.find((n) => n.label === 'b')!.x -
      before.nodes.find((n) => n.label === 'determiner')!.x;

    // Blow up the first leaf; it must push its sibling further right.
    tree!.children[0].children[0].style = { fontSize: 34 };
    const after = layoutTree(tree!);
    const gapAfter =
      after.nodes.find((n) => n.label === 'b')!.x -
      after.nodes.find((n) => n.label === 'determiner')!.x;

    expect(gapAfter).toBeGreaterThan(gapBefore);
  });

  it('reserves vertical room for feature lines', () => {
    const { tree } = parseBracket('[X [A a] [B b]]');
    const before = layoutTree(tree!).height;
    tree!.children[0].children[0].features = ['+wh', 'uCase:nom'];
    expect(layoutTree(tree!).height).toBeGreaterThan(before);
  });
});

describe('node decorations', () => {
  it('renders features into the LaTeX label, brace-wrapped', () => {
    const { tree } = parseBracket('[S [NP a] [VP b]]');
    tree!.children[0].features = ['+wh', 'uCase:nom'];

    expect(toForest(tree!)).toContain('[{NP [+wh, uCase:nom]}');
    expect(toQtree(tree!)).toContain('[.{NP [+wh, uCase:nom]}');
  });

  it('leaves featureless nodes untouched in LaTeX', () => {
    const { tree } = parseBracket('[S [NP a] [VP b]]');
    expect(toForest(tree!)).toContain('[NP');
  });

  it('cloneWithNewIds deep-copies style and features', () => {
    const { tree } = parseBracket('[S [NP a]]');
    tree!.children[0].style = { fontSize: 22 };
    tree!.children[0].features = ['+wh'];

    const copy = cloneWithNewIds(tree!);
    expect(copy.children[0].id).not.toBe(tree!.children[0].id);
    expect(copy.children[0].style).toEqual({ fontSize: 22 });
    copy.children[0].features!.push('mutated');
    expect(tree!.children[0].features).toEqual(['+wh']);
  });

  it('carryOverDecorations matches by position, not by id', () => {
    const { tree: old } = parseBracket('[S [NP a] [VP b]]');
    old!.children[1].style = { color: '#dc2626' };
    old!.children[1].features = ['+past'];

    const { tree: fresh } = parseBracket('[S [NP a] [VP sat]]');
    const merged = carryOverDecorations(old!, fresh!);

    expect(merged.children[1].style).toEqual({ color: '#dc2626' });
    expect(merged.children[1].features).toEqual(['+past']);
    expect(merged.children[1].children[0].label).toBe('sat');
    // Ids come from the fresh parse — only decorations are carried over.
    expect(merged.children[1].id).toBe(fresh!.children[1].id);
    expect(merged.children[0].style).toBeUndefined();
  });

  it('carryOverDecorations tolerates a newly added subtree', () => {
    const { tree: old } = parseBracket('[S [NP a]]');
    old!.children[0].features = ['+wh'];
    const { tree: fresh } = parseBracket('[S [NP a] [VP b]]');

    const merged = carryOverDecorations(old!, fresh!);
    expect(merged.children[0].features).toEqual(['+wh']);
    expect(merged.children[1].features).toBeUndefined();
  });

  it('effectiveStyle falls back to leaf vs internal defaults', () => {
    expect(effectiveStyle(undefined, false)).toMatchObject({ font: 'display', italic: false });
    expect(effectiveStyle(undefined, true)).toMatchObject({ font: 'sans', italic: true });
    expect(effectiveStyle({ italic: false, fontSize: 20 }, true)).toMatchObject({
      font: 'sans',
      italic: false,
      fontSize: 20,
    });
  });
});
