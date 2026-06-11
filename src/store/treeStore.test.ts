import { beforeEach, describe, expect, it } from 'vitest';
import { EMPTY_ANNOTATIONS } from '../model/types';
import { useTreeStore } from './treeStore';

describe('treeStore undo/redo', () => {
  beforeEach(() => {
    // Reset to a known state between tests.
    useTreeStore.setState({
      past: [],
      future: [],
      annotations: EMPTY_ANNOTATIONS,
      selectedId: null,
      parseErrors: [],
    });
    useTreeStore.getState().setTreeFromBracket('[S [NP a] [VP b]]');
    useTreeStore.setState({ past: [], future: [] });
  });

  it('undoes and redoes a rename', () => {
    const s = useTreeStore.getState();
    const rootId = s.tree!.id;
    s.renameNode(rootId, 'TP');
    expect(useTreeStore.getState().tree!.label).toBe('TP');

    useTreeStore.getState().undo();
    expect(useTreeStore.getState().tree!.label).toBe('S');

    useTreeStore.getState().redo();
    expect(useTreeStore.getState().tree!.label).toBe('TP');
  });

  it('undoes a stroke without touching the tree', () => {
    const before = useTreeStore.getState().tree;
    useTreeStore.getState().addStroke({
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ],
      color: '#f00',
      width: 2,
    });
    expect(useTreeStore.getState().annotations.strokes).toHaveLength(1);

    useTreeStore.getState().undo();
    expect(useTreeStore.getState().annotations.strokes).toHaveLength(0);
    expect(useTreeStore.getState().tree).toBe(before);
  });

  it('undoes note add/edit/erase as separate steps', () => {
    const st = useTreeStore.getState();
    st.addNote({ x: 5, y: 5, text: 'head' });
    const noteId = useTreeStore.getState().annotations.notes[0].id;
    useTreeStore.getState().updateNote(noteId, { text: 'head movement' });
    useTreeStore.getState().removeAnnotation(noteId);
    expect(useTreeStore.getState().annotations.notes).toHaveLength(0);

    useTreeStore.getState().undo(); // un-erase
    expect(useTreeStore.getState().annotations.notes[0].text).toBe('head movement');
    useTreeStore.getState().undo(); // un-edit
    expect(useTreeStore.getState().annotations.notes[0].text).toBe('head');
    useTreeStore.getState().undo(); // un-add
    expect(useTreeStore.getState().annotations.notes).toHaveLength(0);
  });

  it('redo stack clears after a new change', () => {
    const s = useTreeStore.getState();
    s.renameNode(s.tree!.id, 'TP');
    useTreeStore.getState().undo();
    expect(useTreeStore.getState().future).toHaveLength(1);
    useTreeStore.getState().addNote({ x: 0, y: 0, text: 'n' });
    expect(useTreeStore.getState().future).toHaveLength(0);
  });

  it('handles multi-selection and deleteMultiple', () => {
    const s = useTreeStore.getState();
    const rootId = s.tree!.id;
    
    // Select root node
    s.select(rootId);
    expect(useTreeStore.getState().selectedIds).toEqual([rootId]);
    expect(useTreeStore.getState().selectedId).toBe(rootId);
    
    // Add a note and select it keeping existing selection
    s.addNote({ x: 10, y: 20, text: 'floating note' });
    const noteId = useTreeStore.getState().annotations.notes[0].id;
    s.select(noteId, true);
    
    expect(useTreeStore.getState().selectedIds).toContain(rootId);
    expect(useTreeStore.getState().selectedIds).toContain(noteId);
    expect(useTreeStore.getState().selectedIds).toHaveLength(2);
    
    // Batch delete them
    s.deleteMultiple([rootId, noteId]);
    expect(useTreeStore.getState().tree).toBeNull();
    expect(useTreeStore.getState().annotations.notes).toHaveLength(0);
    expect(useTreeStore.getState().selectedIds).toHaveLength(0);
    expect(useTreeStore.getState().selectedId).toBeNull();
    
    // Undo batch deletion
    useTreeStore.getState().undo();
    expect(useTreeStore.getState().tree).not.toBeNull();
    expect(useTreeStore.getState().annotations.notes).toHaveLength(1);
  });

  it('undo with empty history is a no-op', () => {
    const before = useTreeStore.getState().tree;
    useTreeStore.getState().undo();
    expect(useTreeStore.getState().tree).toBe(before);
  });
});
