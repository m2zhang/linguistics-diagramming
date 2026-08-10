/**
 * Colour-coded syntactic feature bundles.
 *
 * A bundle is just a label that lands in `TreeNode.features` — the node model
 * stores plain strings and nothing here changes that, so trees saved before
 * bundles existed keep loading and a bundle dropped on a node is
 * indistinguishable from one typed into the inspector.
 *
 * Colour is therefore *derived from the label*, never stored. That is the
 * whole design: a student opening the instructor's tree resolves `+wh` to the
 * same green without the file carrying a palette, and no persistence format
 * (lecture trees, drafts, submissions, exported SVG metadata) has to change.
 */

export interface FeatureBundle {
  /** Stable number identifying the bundle — shown on the chip, and the drag payload. */
  id: number;
  /** Text stored on the node; renders between the brackets on the canvas. */
  label: string;
  /** Concrete hex, not a CSS var: it is written straight into exported SVG. */
  color: string;
  /** Tooltip copy in the sidebar. */
  description: string;
}

/**
 * The three reserved tag hues — this list is deliberately closed. The sidebar
 * offers exactly these and no way to add a fourth; see FeatureBundleLibrary.
 *
 * PEN_COLORS shares none of these, so a red mark on the canvas is never
 * mistakable for a [+CASE] tag.
 */
export const FEATURE_BUNDLES: FeatureBundle[] = [
  { id: 1, label: '+CASE', color: '#dc2626', description: 'Structural case' },
  { id: 2, label: '+past', color: '#2563eb', description: 'Past tense' },
  { id: 3, label: '+wh', color: '#059669', description: 'Wh / interrogative' },
];

/**
 * Freehand/annotation colours. Kept disjoint from every FEATURE_BUNDLES colour
 * so the tag hues stay unambiguous — the reason the palette is ink/orange/cyan/
 * pink/slate rather than the red/blue/green/amber set it replaced.
 */
export const PEN_COLORS: { name: string; value: string }[] = [
  { name: 'Ink', value: 'var(--text)' },
  { name: 'Orange', value: '#ea580c' },
  { name: 'Cyan', value: '#0891b2' },
  { name: 'Pink', value: '#db2777' },
  { name: 'Slate', value: '#64748b' },
];

const PEN_VALUES = new Set(PEN_COLORS.map((c) => c.value.toLowerCase()));

/** Whether a colour came from the fixed palette rather than the custom wheel. */
export function isPenColor(value: string): boolean {
  return PEN_VALUES.has(value.toLowerCase());
}

/**
 * The colour a text note may actually be written in.
 *
 * The canvas keeps one shared stroke colour across every annotation tool, and
 * the custom colour wheel — offered for the pen and highlighter — can pick any
 * hex at all, including a reserved tag hue. Switching to the text tool afterward
 * would otherwise carry that colour over and put a note on the canvas in
 * [+CASE] red. Text is confined to PEN_COLORS; anything else snaps back to ink.
 */
export function textNoteColor(current: string): string {
  return isPenColor(current) ? current : PEN_COLORS[0].value;
}

/**
 * Colours handed to features that are not one of the three bundles. The sidebar
 * can no longer create these, but the Node Inspector still lets a feature be
 * typed onto a node, and older trees may already carry one — so every feature
 * string still has to resolve to something. Disjoint from PEN_COLORS, so
 * anything rendered as a tag reads as a tag whatever it is called.
 */
const CUSTOM_FEATURE_COLORS = ['#0f766e', '#4338ca', '#a16207', '#be123c', '#4d7c0f'];

/** Case- and bracket-insensitive, so `[+WH]`, `+wh` and ` +Wh ` are one bundle. */
function normalize(label: string): string {
  return label.trim().replace(/^\[|\]$/g, '').trim().toLowerCase();
}

const BY_LABEL = new Map(FEATURE_BUNDLES.map((b) => [normalize(b.label), b]));

/** The built-in bundle a label names, if any. */
export function findBundle(label: string): FeatureBundle | undefined {
  return BY_LABEL.get(normalize(label));
}

/**
 * Colour for any feature string. Built-ins get their reserved hue; anything
 * else gets a stable pick from CUSTOM_FEATURE_COLORS, hashed from the label so
 * the same custom feature is the same colour in every session and for every
 * viewer — without a palette having to travel with the file.
 */
export function featureColor(label: string): string {
  const bundle = BY_LABEL.get(normalize(label));
  if (bundle) return bundle.color;

  const key = normalize(label);
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return CUSTOM_FEATURE_COLORS[hash % CUSTOM_FEATURE_COLORS.length];
}

/**
 * The colour a tagged node itself reads as — its label and its outline — or null
 * when it carries no features.
 *
 * The *first* tag wins rather than a blend or the last one: a node has one
 * identity at a glance, and scanning a tree for "the case nodes" only works if
 * that identity is stable when a second tag is added. Each tag line underneath
 * still renders in its own colour, so nothing is lost on a multi-tag node.
 */
export function nodeTagColor(features?: string[]): string | null {
  const first = features?.[0];
  return first ? featureColor(first) : null;
}

/** MIME type for a feature dragged out of the sidebar onto a node. */
export const FEATURE_DND_TYPE = 'application/x-feature';
