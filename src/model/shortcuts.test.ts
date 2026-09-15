import { describe, expect, it } from 'vitest';
import {
  PRESET_KEYS,
  resolveShortcut,
  SHORTCUT_GROUPS,
  TEMPLATE_KEYS,
  type ShortcutContext,
  type ShortcutEvent,
} from './shortcuts';
import { PRESETS } from '../components/NodeLibrary';
import { TEMPLATES } from './templates';

const BASE: ShortcutContext = {
  typing: false,
  selectionCount: 0,
  canUseInstructorTools: true,
  locked: false,
};

const press = (key: string, e: Partial<ShortcutEvent> = {}, ctx: Partial<ShortcutContext> = {}) =>
  resolveShortcut({ key, ...e }, { ...BASE, ...ctx });

describe('resolveShortcut', () => {
  it('switches tools on bare letters', () => {
    expect(press('v')).toEqual({ kind: 'selectTool', tool: 'select' });
    expect(press('p')).toEqual({ kind: 'selectTool', tool: 'draw' });
    expect(press('h')).toEqual({ kind: 'selectTool', tool: 'highlight' });
    expect(press('t')).toEqual({ kind: 'selectTool', tool: 'text' });
    expect(press('b')).toEqual({ kind: 'selectTool', tool: 'box' });
    expect(press('a')).toEqual({ kind: 'selectTool', tool: 'arrow' });
    expect(press('e')).toEqual({ kind: 'selectTool', tool: 'erase' });
  });

  it('is case-insensitive for tools but ignores Shift-modified letters', () => {
    expect(press('V')).toEqual({ kind: 'selectTool', tool: 'select' });
    // Shift is not part of any letter binding; treating it as one would fire
    // actions while the user is capitalising something.
    expect(press('V', { shiftKey: true })).toBeNull();
  });

  it('leaves instructor tools inert for a student', () => {
    const asStudent = { canUseInstructorTools: false };
    expect(press('p', {}, asStudent)).toBeNull();
    expect(press('b', {}, asStudent)).toBeNull();
    expect(press('a', {}, asStudent)).toBeNull();
    // The shared tools still work.
    expect(press('h', {}, asStudent)).toEqual({ kind: 'selectTool', tool: 'highlight' });
    expect(press('e', {}, asStudent)).toEqual({ kind: 'selectTool', tool: 'erase' });
  });

  it('ignores everything but Escape while typing', () => {
    const typing = { typing: true };
    expect(press('v', {}, typing)).toBeNull();
    expect(press('Delete', {}, { ...typing, selectionCount: 1 })).toBeNull();
    expect(press('z', { ctrlKey: true }, typing)).toBeNull();
    expect(press('F2', {}, typing)).toBeNull();
    // Escape is how you get out of an edit, so it must survive.
    expect(press('Escape', {}, typing)).toEqual({ kind: 'deselect' });
  });

  it('handles undo and both redo spellings', () => {
    expect(press('z', { ctrlKey: true })).toEqual({ kind: 'undo' });
    expect(press('z', { ctrlKey: true, shiftKey: true })).toEqual({ kind: 'redo' });
    expect(press('y', { ctrlKey: true })).toEqual({ kind: 'redo' });
    expect(press('z', { metaKey: true })).toEqual({ kind: 'undo' });
  });

  it('leaves other Ctrl combos to the browser', () => {
    for (const key of ['r', 't', 'w', 'l', 'p']) {
      expect(press(key, { ctrlKey: true })).toBeNull();
    }
  });

  it('walks the tree with arrows and pans with Shift', () => {
    const selected = { selectionCount: 1 };
    expect(press('ArrowUp', {}, selected)).toEqual({ kind: 'moveSelection', direction: 'up' });
    expect(press('ArrowDown', {}, selected)).toEqual({ kind: 'moveSelection', direction: 'down' });
    expect(press('ArrowLeft', {}, selected)).toEqual({ kind: 'moveSelection', direction: 'left' });
    expect(press('ArrowRight', {}, selected)).toEqual({ kind: 'moveSelection', direction: 'right' });

    expect(press('ArrowUp', { shiftKey: true }, selected)).toEqual({ kind: 'pan', direction: 'up' });
    // Nothing selected: there is no selection to walk, so arrows pan instead.
    expect(press('ArrowUp')).toEqual({ kind: 'pan', direction: 'up' });
  });

  it('covers zoom and fit', () => {
    expect(press('+')).toEqual({ kind: 'zoomIn' });
    expect(press('=')).toEqual({ kind: 'zoomIn' });
    expect(press('-')).toEqual({ kind: 'zoomOut' });
    expect(press('0')).toEqual({ kind: 'fitToView' });
    expect(press('?')).toEqual({ kind: 'openShortcuts' });
  });

  it('guards actions that need a particular selection', () => {
    expect(press('Delete')).toBeNull();
    expect(press('Delete', {}, { selectionCount: 1 })).toEqual({ kind: 'deleteSelection' });
    expect(press('Backspace', {}, { selectionCount: 2 })).toEqual({ kind: 'deleteSelection' });

    expect(press('Enter')).toBeNull();
    expect(press('Enter', {}, { selectionCount: 1 })).toEqual({ kind: 'renameSelection' });
    expect(press('Enter', {}, { selectionCount: 2 })).toBeNull();

    // Connecting is defined for exactly two things.
    expect(press('c', {}, { selectionCount: 1 })).toBeNull();
    expect(press('c', {}, { selectionCount: 2 })).toEqual({ kind: 'connectSelection' });
    expect(press('c', {}, { selectionCount: 3 })).toBeNull();
  });

  /** Presentation lock: annotations stay editable, tree structure does not. */
  it('refuses structural edits while locked', () => {
    const locked = { locked: true, selectionCount: 2 };
    expect(press('Enter', {}, { ...locked, selectionCount: 1 })).toBeNull();
    expect(press('n', {}, locked)).toBeNull();
    expect(press('c', {}, locked)).toBeNull();
    // Deleting still resolves — TreeCanvas narrows it to annotations.
    expect(press('Delete', {}, locked)).toEqual({ kind: 'deleteSelection' });
    // And navigating/viewing is untouched.
    expect(press('0', {}, locked)).toEqual({ kind: 'fitToView' });
    expect(press('v', {}, locked)).toEqual({ kind: 'selectTool', tool: 'select' });
  });

  it('maps the library function keys', () => {
    expect(press('F1')).toEqual({ kind: 'insertPreset', index: 0 });
    expect(press('F3')).toEqual({ kind: 'insertPreset', index: 2 });
    expect(press('F4')).toEqual({ kind: 'insertPreset', index: 3 });
    expect(press('F5')).toEqual({ kind: 'insertPreset', index: 4 });
    expect(PRESETS[4].id).toBe('x-bar');
    expect(press('F5', {}, { typing: true })).toBeNull();
    expect(press('F11')).toEqual({ kind: 'loadTemplate', index: 0 });
    expect(press('F10')).toEqual({ kind: 'loadTemplate', index: 5 });
  });

  it('returns null for keys it does not claim', () => {
    for (const key of ['q', 'j', 'F12', 'Tab', 'PageUp', ']']) {
      expect(press(key)).toBeNull();
    }
  });
});

describe('X-Bar shortcut regression', () => {
  it.each([true, false])('allows F5 for instructor access = %s', (canUseInstructorTools) => {
    const action = press('F5', {}, { canUseInstructorTools });
    expect(action?.kind).toBe('insertPreset');
    if (action?.kind !== 'insertPreset') throw new Error('Expected a preset');
    expect(PRESETS[action.index].name).toBe('X-Bar');
    expect(PRESETS[action.index].build()).toMatchObject({
      label: 'XP',
      children: [
        { label: 'Spec', children: [] },
        { label: 'X′', children: [{ label: 'X', children: [] }, { label: 'Comp', children: [] }] },
      ],
    });
  });

  it.each(['F5', 'F11'])('ignores %s while typing or using browser modifiers', (key) => {
    expect(press(key, {}, { typing: true })).toBeNull();
    for (const modifier of ['ctrlKey', 'metaKey', 'altKey']) {
      expect(press(key, { [modifier]: true })).toBeNull();
    }
  });

  it('keeps Simple Sentence accessible through F11', () => {
    const action = press('F11');
    expect(action?.kind).toBe('loadTemplate');
    if (action?.kind !== 'loadTemplate') throw new Error('Expected a template');
    expect(TEMPLATES[action.index].name).toBe('Simple Sentence (S)');
  });

  it('keeps preset and template keys distinct', () => {
    expect(Object.keys(PRESET_KEYS).filter((key) => key in TEMPLATE_KEYS)).toEqual([]);
  });

  it.each([
    ['F6', 1], ['F7', 2], ['F8', 3], ['F9', 4], ['F10', 5],
  ])('preserves the existing %s template shortcut', (key, index) => {
    expect(press(key as string)).toEqual({ kind: 'loadTemplate', index });
  });

  it('documents the new assignments', () => {
    const entries = SHORTCUT_GROUPS.find((group) => group.title === 'Library')!.entries;
    expect(entries.filter((entry) => entry.keys.includes('F5'))).toEqual([
      { keys: ['F5'], label: 'Add X-Bar' },
    ]);
    expect(entries.filter((entry) => entry.keys.includes('F11'))).toEqual([
      { keys: ['F11'], label: 'Load Simple Sentence' },
    ]);
  });
});

describe('the shortcut reference', () => {
  /** The reference exists to be trusted, so every key it prints must resolve. */
  it('lists nothing the resolver ignores', () => {
    const printed = SHORTCUT_GROUPS.filter((g) => g.title !== 'Presentation').flatMap((g) => g.entries);
    expect(printed.length).toBeGreaterThan(0);

    // Keycaps are display text; map them back to the KeyboardEvent.key values.
    const asEvent: Record<string, ShortcutEvent> = {
      Enter: { key: 'Enter' },
      Delete: { key: 'Delete' },
      Esc: { key: 'Escape' },
      '?': { key: '?' },
      '↑': { key: 'ArrowUp' },
      '↓': { key: 'ArrowDown' },
      '←': { key: 'ArrowLeft' },
      '→': { key: 'ArrowRight' },
      '↑ ↓ ← →': { key: 'ArrowUp', shiftKey: true },
    };

    for (const entry of printed) {
      const keys = entry.keys;
      const ctrl = keys.includes('Ctrl');
      const shift = keys.includes('Shift');
      const main = keys.filter((k) => k !== 'Ctrl' && k !== 'Shift');

      for (const cap of main) {
        const base = asEvent[cap] ?? { key: cap };
        const event = { ...base, ctrlKey: ctrl || base.ctrlKey, shiftKey: shift || base.shiftKey };

        // Selection size is part of what makes a binding apply — Enter wants
        // exactly one node, C wants exactly two — so a printed key passes if
        // it resolves under any reachable selection, not one fixed count.
        const resolved = [0, 1, 2].some(
          (selectionCount) =>
            resolveShortcut(event, { ...BASE, selectionCount, canUseInstructorTools: true }) !==
            null,
        );
        expect(resolved, `"${entry.label}" prints ${cap} but nothing handles it`).toBe(true);
      }
    }
  });

  /** The F-key indexes point into real presets and templates. */
  it('does not promise library entries that do not exist', () => {
    for (const index of Object.values(PRESET_KEYS)) {
      expect(PRESETS[index]).toBeDefined();
    }
    for (const index of Object.values(TEMPLATE_KEYS)) {
      expect(TEMPLATES[index]).toBeDefined();
    }
    // And the reference lists exactly as many as are bound.
    const library = SHORTCUT_GROUPS.find((g) => g.title === 'Library');
    expect(library?.entries).toHaveLength(
      Object.keys(PRESET_KEYS).length + Object.keys(TEMPLATE_KEYS).length,
    );
  });
});
