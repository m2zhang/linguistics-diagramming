import { describe, expect, it } from 'vitest';
import { PRESETS } from '../components/NodeLibrary';
import { parseBracket } from './bracketParser';
import { serializeBracket } from './bracketSerializer';
import {
  featureColor,
  isThetaGrid,
  LINK_FEATURE_GRID,
  nodeTagColor,
  resolveFeatureColor,
  THETA_ROLE_GRID,
} from './features';
import { featureDrop, featureLineY, featureUnderlineRule, PositionedNode } from './layout';
import { carryOverDecorations, cloneWithNewIds, TreeNode } from './types';

function preset(id: string) {
  const p = PRESETS.find((x) => x.id === id);
  if (!p) throw new Error(`no preset ${id}`);
  return p;
}

describe('theta grid presets', () => {
  it('tag the node they are dropped on instead of adding children', () => {
    // The whole point of the rework: a grid belongs to the head that assigns
    // it, so dropping on V must annotate V, not hang a new node beneath it.
    for (const id of ['theta-role', 'link-feature']) {
      expect(preset(id).feature).toBeTruthy();
      expect(preset(id).build).toBeUndefined();
    }
  });

  it('carry the TreeForm labels', () => {
    expect(preset('theta-role').feature).toBe('<θ, θ>');
    expect(preset('link-feature').feature).toBe('<θ>');
  });

  it('still leave the branching presets building nodes', () => {
    for (const id of ['down', 'binary', 'ternary']) {
      expect(preset(id).build).toBeTypeOf('function');
      expect(preset(id).feature).toBeUndefined();
    }
  });
});

describe('isThetaGrid', () => {
  it('recognises both built-in grids', () => {
    expect(isThetaGrid(THETA_ROLE_GRID)).toBe(true);
    expect(isThetaGrid(LINK_FEATURE_GRID)).toBe(true);
  });

  it('recognises a renamed grid, so the rule survives editing', () => {
    expect(isThetaGrid('<Agent, Theme>')).toBe(true);
  });

  it('leaves ordinary feature bundles alone', () => {
    for (const f of ['+wh', '+CASE', '+past', 'uCase:nom']) {
      expect(isThetaGrid(f)).toBe(false);
    }
  });
});

describe('theta grid as a feature', () => {
  const node = (features: string[]): PositionedNode => ({
    id: 'n',
    label: 'V',
    features,
    isLeaf: false,
    x: 0,
    y: 0,
    depth: 0,
    step: 0,
  });

  it('keeps the space after the comma — features bypass the bracket parser', () => {
    // A space is fatal in a *label* (whitespace-delimited grammar) but fine in
    // a feature, because serializeBracket() emits labels only. This is what
    // lets the grid read as `<θ, θ>` rather than `<θ,θ>`.
    const root: TreeNode = {
      id: 'r',
      label: 'VP',
      children: [{ id: 'v', label: 'V', children: [], features: [THETA_ROLE_GRID] }],
    };
    const reparsed = parseBracket(serializeBracket(root));
    expect(reparsed.errors).toEqual([]);
    // The node did not split despite the space in its feature.
    expect(reparsed.tree?.children).toHaveLength(1);

    const restored = carryOverDecorations(root, reparsed.tree!);
    expect(restored.children[0].features).toEqual([THETA_ROLE_GRID]);
  });

  it('draws its rule below the grid text but inside the row', () => {
    const n = node([THETA_ROLE_GRID]);
    const rule = featureUnderlineRule(n, 0, THETA_ROLE_GRID);
    expect(rule.y).toBeGreaterThan(featureLineY(n, 0));
    // Must not bleed into where a second feature line would start.
    expect(rule.y).toBeLessThan(featureLineY(n, 1));
  });

  it('sizes the rule to the grid text', () => {
    const n = node([THETA_ROLE_GRID]);
    const short = featureUnderlineRule(n, 0, LINK_FEATURE_GRID);
    const long = featureUnderlineRule(n, 0, '<Agent, Theme>');
    expect(long.halfWidth).toBeGreaterThan(short.halfWidth);
  });

  it('offsets the rule per feature row', () => {
    const n = node(['+wh', THETA_ROLE_GRID]);
    expect(featureUnderlineRule(n, 1, THETA_ROLE_GRID).y).toBeGreaterThan(
      featureUnderlineRule(n, 0, THETA_ROLE_GRID).y,
    );
  });
});

describe('editing a theta grid', () => {
  /** Mirrors NodeInspector.splitFeatures — the comma in a grid is notation,
   *  not a separator, so it must not split the way a tag bundle does. */
  const splitFeatures = (draft: string): string[] => {
    const whole = draft.trim();
    if (isThetaGrid(whole)) return [whole];
    return draft.split(',').map((s) => s.trim()).filter(Boolean);
  };

  it('keeps a renamed grid whole instead of splitting on its comma', () => {
    expect(splitFeatures('<Agent, Theme>')).toEqual(['<Agent, Theme>']);
    expect(splitFeatures(THETA_ROLE_GRID)).toEqual([THETA_ROLE_GRID]);
  });

  it('still splits ordinary tag bundles', () => {
    expect(splitFeatures('+wh, +CASE')).toEqual(['+wh', '+CASE']);
  });
});

describe('feature colour overrides', () => {
  it('falls back to the derived hue when nothing is set', () => {
    expect(resolveFeatureColor('+wh')).toBe(featureColor('+wh'));
    expect(resolveFeatureColor(THETA_ROLE_GRID, {})).toBe(featureColor(THETA_ROLE_GRID));
  });

  it('lets an explicit colour win', () => {
    expect(resolveFeatureColor(THETA_ROLE_GRID, { [THETA_ROLE_GRID]: '#dc2626' })).toBe('#dc2626');
  });

  it('is per-feature, not per-node', () => {
    const overrides = { [THETA_ROLE_GRID]: '#dc2626' };
    // A second tag on the same node keeps resolving the derived way.
    expect(resolveFeatureColor('+wh', overrides)).toBe(featureColor('+wh'));
  });

  it('drives the node tag colour too, so label and tag agree', () => {
    const features = [THETA_ROLE_GRID, '+wh'];
    expect(nodeTagColor(features, { [THETA_ROLE_GRID]: '#dc2626' })).toBe('#dc2626');
    expect(nodeTagColor(features)).toBe(featureColor(THETA_ROLE_GRID));
  });

  it('survives the clone used when a preset or template is inserted', () => {
    const n: TreeNode = {
      id: 'n',
      label: 'V',
      children: [],
      features: [THETA_ROLE_GRID],
      featureColors: { [THETA_ROLE_GRID]: '#dc2626' },
    };
    expect(cloneWithNewIds(n).featureColors).toEqual({ [THETA_ROLE_GRID]: '#dc2626' });
  });

  it('survives a bracket-editor rebuild', () => {
    const from: TreeNode = {
      id: 'r',
      label: 'VP',
      children: [
        {
          id: 'v',
          label: 'V',
          children: [],
          features: [THETA_ROLE_GRID],
          featureColors: { [THETA_ROLE_GRID]: '#dc2626' },
        },
      ],
    };
    const reparsed = parseBracket(serializeBracket(from));
    const restored = carryOverDecorations(from, reparsed.tree!);
    expect(restored.children[0].featureColors).toEqual({ [THETA_ROLE_GRID]: '#dc2626' });
  });
});

describe('a grid stacked with other tags', () => {
  const withFeatures = (features: string[]): PositionedNode => ({
    id: 'n', label: 'V', features, isLeaf: false, x: 0, y: 0, depth: 0, step: 0,
  });

  it('never lets the rule reach the tag below it', () => {
    // The reported bug: with a second tag under the grid, the rule struck
    // through it. The rule must clear the next row's text entirely.
    const n = withFeatures([THETA_ROLE_GRID, '+wh']);
    const rule = featureUnderlineRule(n, 0, THETA_ROLE_GRID);
    expect(rule.y).toBeLessThan(featureLineY(n, 1));
  });

  it('holds for a grid in any position in the stack', () => {
    const n = withFeatures(['+wh', THETA_ROLE_GRID, '+past']);
    const rule = featureUnderlineRule(n, 1, THETA_ROLE_GRID);
    expect(rule.y).toBeGreaterThan(featureLineY(n, 1));
    expect(rule.y).toBeLessThan(featureLineY(n, 2));
  });

  it('reserves the extra height on the node box, not just the gap', () => {
    // If featureDrop did not grow, the rule would be drawn outside the box and
    // the branch leaving this node would start on top of it.
    const plain = featureDrop({ features: ['+wh', '+past'] });
    const withGrid = featureDrop({ features: [THETA_ROLE_GRID, '+past'] });
    expect(withGrid).toBeGreaterThan(plain);
  });

  it('costs nothing for nodes with no grid', () => {
    expect(featureDrop({ features: ['+wh', '+past'] })).toBe(
      featureDrop({ features: ['+CASE', '+past'] }),
    );
  });
});
