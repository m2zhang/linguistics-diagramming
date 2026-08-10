import { describe, expect, it } from 'vitest';
import { FEATURE_BUNDLES, featureColor, findBundle, PEN_COLORS } from './features';

describe('feature bundles', () => {
  it('gives the three required tags their specified colours', () => {
    expect(featureColor('+CASE')).toBe('#dc2626'); // red
    expect(featureColor('+past')).toBe('#2563eb'); // blue
    expect(featureColor('+wh')).toBe('#059669'); // green
  });

  it('numbers every bundle uniquely', () => {
    const ids = FEATURE_BUNDLES.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every bundle its own colour', () => {
    const colors = FEATURE_BUNDLES.map((b) => b.color);
    expect(new Set(colors).size).toBe(colors.length);
  });

  /** The point of the whole palette split: a pen mark must never be mistakable
   *  for a tag. */
  it('keeps the pen palette disjoint from every tag colour', () => {
    const tagColors = new Set(FEATURE_BUNDLES.map((b) => b.color.toLowerCase()));
    for (const pen of PEN_COLORS) {
      expect(tagColors.has(pen.value.toLowerCase())).toBe(false);
    }
  });

  it('resolves a label however it is written', () => {
    // The canvas stores '+wh'; a user may type '[+WH]' or ' +Wh '.
    expect(featureColor('[+WH]')).toBe(featureColor('+wh'));
    expect(featureColor(' +Wh ')).toBe(featureColor('+wh'));
    expect(findBundle('[+case]')?.id).toBe(1);
  });

  it('is stable and pen-safe for custom features', () => {
    // Same label always resolves the same, so nothing has to be persisted.
    expect(featureColor('uCase:nom')).toBe(featureColor('uCase:nom'));

    const penValues = new Set(PEN_COLORS.map((p) => p.value.toLowerCase()));
    for (const label of ['uCase:nom', 'φ:3sg', '+PL', '+ACC', 'EPP', 'anything']) {
      expect(penValues.has(featureColor(label).toLowerCase())).toBe(false);
    }
  });

  it('does not hand a custom feature a built-in tag colour', () => {
    const tagColors = new Set(FEATURE_BUNDLES.map((b) => b.color.toLowerCase()));
    for (const label of ['uCase:nom', 'φ:3sg', '+PL', '+ACC', 'EPP', 'zzz']) {
      expect(tagColors.has(featureColor(label).toLowerCase())).toBe(false);
    }
  });
});
