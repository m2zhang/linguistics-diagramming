import { describe, expect, it } from 'vitest';
import {
  FEATURE_BUNDLES,
  featureColor,
  findBundle,
  PEN_COLORS,
  textNoteColor,
} from './features';

describe('feature bundles', () => {
  it('gives the three required tags their specified colours', () => {
    expect(featureColor('+CASE')).toBe('#dc2626'); // red
    expect(featureColor('+past')).toBe('#2563eb'); // blue
    expect(featureColor('+wh')).toBe('#059669'); // green
  });

  /** The library is a closed set of exactly three. Without this, a fourth
   *  bundle can drift back in and the sidebar silently grows a tag again. */
  it('offers exactly these three bundles and no others', () => {
    expect(FEATURE_BUNDLES.map((b) => b.label)).toEqual(['+CASE', '+past', '+wh']);
  });

  it('numbers every bundle uniquely', () => {
    const ids = FEATURE_BUNDLES.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every bundle its own colour', () => {
    const colors = FEATURE_BUNDLES.map((b) => b.color);
    expect(new Set(colors).size).toBe(colors.length);
  });

  /** The point of the whole palette split: a pen, highlighter or text-note mark
   *  must never be mistakable for a tag. PEN_COLORS is the entire palette the
   *  canvas toolbar offers the text tool, so this is the check that keeps the
   *  three tag hues out of it. */
  it('keeps the toolbar palette disjoint from every tag colour', () => {
    const tagColors = new Set(FEATURE_BUNDLES.map((b) => b.color.toLowerCase()));
    for (const pen of PEN_COLORS) {
      expect(tagColors.has(pen.value.toLowerCase())).toBe(false);
    }
  });

  /** The palette array being disjoint is not enough on its own: the canvas
   *  shares one stroke colour across tools, and the pen/highlighter colour wheel
   *  can pick any hex. This is the check on the live value the text tool ends up
   *  holding after a wheel pick carries over. */
  it('snaps a text note off a tag colour picked with the custom wheel', () => {
    const palette = PEN_COLORS.map((p) => p.value);
    for (const tag of FEATURE_BUNDLES.map((b) => b.color)) {
      expect(textNoteColor(tag)).not.toBe(tag);
      expect(palette).toContain(textNoteColor(tag));
    }
    // Any other off-palette wheel pick is clamped too, not just tag hues.
    expect(palette).toContain(textNoteColor('#123456'));
    // A colour already on the palette is left exactly as chosen.
    for (const pen of palette) {
      expect(textNoteColor(pen)).toBe(pen);
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
