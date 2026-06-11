import { describe, expect, it } from 'vitest';
import { parseBracket } from './bracketParser';
import { serializeBracket } from './bracketSerializer';
import { toForest, toQtree, formatLabel, toFullDocument } from './latex';
import { layoutTree } from './layout';
import { TreeNode } from './types';

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
});
