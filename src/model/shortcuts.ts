/**
 * Every keyboard shortcut the canvas understands, in one place.
 *
 * Two things read this module: TreeCanvas, which dispatches whatever
 * resolveShortcut() returns, and the Shortcuts reference in the profile area,
 * which renders SHORTCUT_GROUPS. Keeping both on the same source is the point —
 * a help screen that lists a binding nobody implemented is worse than no help
 * screen, and that is exactly what drifts when the two are written separately.
 *
 * resolveShortcut() is deliberately pure. The canvas cannot be exercised in a
 * unit test, so the decision of *which* action a keystroke means is separated
 * from the effect of performing it, and the decision half is covered directly.
 */

/** Canvas tools, in toolbar order. */
export type CanvasTool = 'select' | 'draw' | 'highlight' | 'text' | 'erase' | 'box' | 'arrow';

/** Tools only an instructor sees; their shortcuts are inert for students. */
export const INSTRUCTOR_TOOLS: ReadonlySet<CanvasTool> = new Set<CanvasTool>([
  'draw',
  'box',
  'arrow',
]);

/** Letter → tool. Single letters, no modifiers, in the Figma/Illustrator idiom. */
const TOOL_KEYS: Record<string, CanvasTool> = {
  v: 'select',
  p: 'draw',
  h: 'highlight',
  t: 'text',
  b: 'box',
  a: 'arrow',
  e: 'erase',
};

/** F1–F3 attach a node preset. Indexes into NodeLibrary's PRESETS. */
export const PRESET_KEYS: Record<string, number> = { F1: 0, F2: 1, F3: 2 };

/** F4–F9 load a starter tree. Indexes into model/templates' TEMPLATES. */
export const TEMPLATE_KEYS: Record<string, number> = {
  F4: 0,
  F5: 1,
  F6: 2,
  F7: 3,
  F8: 4,
  F9: 5,
};

export type Direction = 'up' | 'down' | 'left' | 'right';

export type ShortcutAction =
  | { kind: 'selectTool'; tool: CanvasTool }
  | { kind: 'undo' }
  | { kind: 'redo' }
  | { kind: 'deleteSelection' }
  | { kind: 'deselect' }
  | { kind: 'renameSelection' }
  | { kind: 'addChild' }
  | { kind: 'connectSelection' }
  | { kind: 'selectAll' }
  | { kind: 'moveSelection'; direction: Direction }
  | { kind: 'pan'; direction: Direction }
  | { kind: 'zoomIn' }
  | { kind: 'zoomOut' }
  | { kind: 'fitToView' }
  | { kind: 'insertPreset'; index: number }
  | { kind: 'loadTemplate'; index: number };

export interface ShortcutEvent {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}

export interface ShortcutContext {
  /** Focus is in a text field, or a node/note is being renamed in place. */
  typing: boolean;
  /** How many things are selected — some actions need exactly one or two. */
  selectionCount: number;
  /** Advanced tools are instructor-only; their keys must not switch a student. */
  canUseInstructorTools: boolean;
  /** Presentation lock: annotations stay editable, tree structure does not. */
  locked: boolean;
}

/**
 * The action a keystroke means, or null for "not a shortcut, leave it alone".
 *
 * Returning null rather than a no-op action matters: the caller uses it to
 * decide whether to preventDefault(), so an unhandled key still reaches the
 * browser.
 */
export function resolveShortcut(
  e: ShortcutEvent,
  ctx: ShortcutContext,
): ShortcutAction | null {
  const key = e.key;
  const lower = key.toLowerCase();
  const mod = !!(e.ctrlKey || e.metaKey);

  // Escape works even mid-edit — it is the way out of one.
  if (key === 'Escape') return { kind: 'deselect' };

  // Everything below is a bare key or a Ctrl-combo that would otherwise be
  // swallowed by, or corrupt, whatever is being typed.
  if (ctx.typing) return null;

  if (mod) {
    if (lower === 'z') return e.shiftKey ? { kind: 'redo' } : { kind: 'undo' };
    if (lower === 'y') return { kind: 'redo' };
    if (lower === 'a') return { kind: 'selectAll' };
    // Any other Ctrl-combo belongs to the browser (Ctrl+R, Ctrl+T, …).
    return null;
  }
  if (e.altKey) return null;

  const presetIndex = PRESET_KEYS[key];
  if (presetIndex !== undefined) return { kind: 'insertPreset', index: presetIndex };

  const templateIndex = TEMPLATE_KEYS[key];
  if (templateIndex !== undefined) return { kind: 'loadTemplate', index: templateIndex };

  // Arrows: Shift pans the viewport, plain arrows walk the tree. With nothing
  // selected there is nothing to walk, so they pan instead of doing nothing.
  const direction = arrowDirection(key);
  if (direction) {
    if (e.shiftKey || ctx.selectionCount === 0) return { kind: 'pan', direction };
    return { kind: 'moveSelection', direction };
  }

  if (key === '+' || key === '=') return { kind: 'zoomIn' };
  if (key === '-' || key === '_') return { kind: 'zoomOut' };
  if (key === '0') return { kind: 'fitToView' };

  if (key === 'Delete' || key === 'Backspace') {
    return ctx.selectionCount > 0 ? { kind: 'deleteSelection' } : null;
  }
  if (key === 'Enter') {
    return ctx.selectionCount === 1 && !ctx.locked ? { kind: 'renameSelection' } : null;
  }

  // Shift is not part of any binding below; letting it through would make
  // capital N and C fire the lowercase actions.
  if (e.shiftKey) return null;

  if (lower === 'n') return ctx.locked ? null : { kind: 'addChild' };
  if (lower === 'c') {
    return ctx.selectionCount === 2 && !ctx.locked ? { kind: 'connectSelection' } : null;
  }

  const tool = TOOL_KEYS[lower];
  if (tool) {
    if (INSTRUCTOR_TOOLS.has(tool) && !ctx.canUseInstructorTools) return null;
    return { kind: 'selectTool', tool };
  }

  return null;
}

function arrowDirection(key: string): Direction | null {
  switch (key) {
    case 'ArrowUp':
      return 'up';
    case 'ArrowDown':
      return 'down';
    case 'ArrowLeft':
      return 'left';
    case 'ArrowRight':
      return 'right';
    default:
      return null;
  }
}

// ------------------------------------------------------------------ reference

export interface ShortcutEntry {
  /** Rendered as separate keycaps; a '+' inside one string is a combo. */
  keys: string[];
  label: string;
  /** Shown only where it earns the space. */
  note?: string;
  /** Hidden from students, who do not have the tool. */
  instructorOnly?: boolean;
}

export interface ShortcutGroup {
  title: string;
  entries: ShortcutEntry[];
}

/** What the Shortcuts reference renders. Mirrors resolveShortcut() above. */
export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Tools',
    entries: [
      { keys: ['V'], label: 'Select and pan' },
      { keys: ['P'], label: 'Pen', instructorOnly: true },
      { keys: ['H'], label: 'Highlighter' },
      { keys: ['T'], label: 'Text note' },
      { keys: ['B'], label: 'Box', instructorOnly: true },
      { keys: ['A'], label: 'Arrow', instructorOnly: true },
      { keys: ['E'], label: 'Eraser' },
    ],
  },
  {
    title: 'Nodes',
    entries: [
      { keys: ['Enter'], label: 'Rename the selected node' },
      { keys: ['N'], label: 'Add a child to the selected node' },
      { keys: ['C'], label: 'Connect two nodes', note: 'Select exactly two first' },
      { keys: ['Delete'], label: 'Delete the selection', note: 'Backspace works too' },
    ],
  },
  {
    title: 'Selection',
    entries: [
      { keys: ['↑'], label: 'Select the parent' },
      { keys: ['↓'], label: 'Select the first child' },
      { keys: ['←', '→'], label: 'Select the previous or next sibling' },
      { keys: ['Ctrl', 'A'], label: 'Select every node' },
      { keys: ['Esc'], label: 'Clear the selection' },
    ],
  },
  {
    title: 'View',
    entries: [
      { keys: ['Shift', '↑ ↓ ← →'], label: 'Pan the canvas' },
      { keys: ['+'], label: 'Zoom in' },
      { keys: ['-'], label: 'Zoom out' },
      { keys: ['0'], label: 'Fit the tree to the window' },
    ],
  },
  {
    title: 'History',
    entries: [
      { keys: ['Ctrl', 'Z'], label: 'Undo' },
      { keys: ['Ctrl', 'Shift', 'Z'], label: 'Redo', note: 'Ctrl+Y works too' },
    ],
  },
  {
    title: 'Library',
    entries: [
      { keys: ['F1'], label: 'Add Node Down' },
      { keys: ['F2'], label: 'Add Binary Branch' },
      { keys: ['F3'], label: 'Add Ternary Branch' },
      { keys: ['F4'], label: 'Load Simple Sentence' },
      { keys: ['F5'], label: 'Load Noun Phrase' },
      { keys: ['F6'], label: 'Load NP with Adjective' },
      { keys: ['F7'], label: 'Load Transitive VP' },
      { keys: ['F8'], label: 'Load Prepositional Phrase' },
      { keys: ['F9'], label: 'Load Embedded Clause' },
    ],
  },
];
