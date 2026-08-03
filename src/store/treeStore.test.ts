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
  //Unit Test for the trashcan for annotations
  it('clears annotations without changing the tree', () => {
    const treeBeforeClear = useTreeStore.getState().tree;

    useTreeStore.getState().addStroke({
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ],
      color: '#f00',
      width: 2,
    });

    useTreeStore.getState().addNote({
      x: 5,
      y: 5,
      text: 'annotation',
    });

    useTreeStore.getState().clearAnnotations();

    expect(useTreeStore.getState().annotations).toEqual(EMPTY_ANNOTATIONS);
    expect(useTreeStore.getState().tree).toBe(treeBeforeClear);
  });
});

describe('node styling', () => {
  beforeEach(() => {
    useTreeStore.setState({
      // tree must be nulled first: setTreeFromBracket carries decorations over
      // from the current tree, which would leak styling between tests.
      tree: null,
      past: [],
      future: [],
      lastActionKey: null,
      annotations: EMPTY_ANNOTATIONS,
      selectedId: null,
      selectedIds: [],
      parseErrors: [],
    });
    useTreeStore.getState().setTreeFromBracket('[S [NP a] [VP b]]');
    useTreeStore.setState({ past: [], future: [], lastActionKey: null });
  });

  const root = () => useTreeStore.getState().tree!;

  it('applies a style patch to every id passed', () => {
    const [np, vp] = root().children;
    useTreeStore.getState().setNodeStyle([np.id, vp.id], { fontSize: 24, branchWidth: 3 });

    const after = root().children;
    expect(after[0].style).toEqual({ fontSize: 24, branchWidth: 3 });
    expect(after[1].style).toEqual({ fontSize: 24, branchWidth: 3 });
    // Untouched nodes keep no style at all, so saved files stay small.
    expect(root().style).toBeUndefined();
  });

  it('merges patches and drops a field reset to undefined', () => {
    const id = root().id;
    const s = useTreeStore.getState();
    s.setNodeStyle([id], { fontSize: 20 });
    s.setNodeStyle([id], { color: '#dc2626' });
    expect(root().style).toEqual({ fontSize: 20, color: '#dc2626' });

    useTreeStore.getState().setNodeStyle([id], { color: undefined });
    expect(root().style).toEqual({ fontSize: 20 });
  });

  it('collapses a run of same-key style changes into one undo step', () => {
    const id = root().id;
    for (const size of [17, 18, 19, 20]) {
      useTreeStore.getState().setNodeStyle([id], { fontSize: size }, `fontSize:${id}`);
    }
    expect(root().style).toEqual({ fontSize: 20 });
    expect(useTreeStore.getState().past).toHaveLength(1);

    useTreeStore.getState().undo();
    expect(root().style).toBeUndefined();
  });

  it('starts a new undo step when a different change interrupts', () => {
    const id = root().id;
    const key = `fontSize:${id}`;
    useTreeStore.getState().setNodeStyle([id], { fontSize: 20 }, key);
    useTreeStore.getState().renameNode(id, 'TP');
    useTreeStore.getState().setNodeStyle([id], { fontSize: 28 }, key);
    expect(useTreeStore.getState().past).toHaveLength(3);

    useTreeStore.getState().undo();
    expect(root().style).toEqual({ fontSize: 20 });
    expect(root().label).toBe('TP');
  });

  it('adds, normalizes and removes features', () => {
    const id = root().id;
    // Blank and duplicate entries are dropped.
    useTreeStore.getState().setNodeFeatures(id, ['+wh', '  ', 'uCase:nom', '+wh']);
    expect(root().features).toEqual(['+wh', 'uCase:nom']);

    useTreeStore.getState().setNodeFeatures(id, []);
    expect(root().features).toBeUndefined();

    useTreeStore.getState().undo();
    expect(root().features).toEqual(['+wh', 'uCase:nom']);
  });

  it('selects the node created by addChild', () => {
    const leaf = root().children[0].children[0];
    useTreeStore.getState().addChild(leaf.id, 'Y');

    const added = useTreeStore.getState().tree!.children[0].children[0].children[0];
    expect(added.label).toBe('Y');
    expect(useTreeStore.getState().selectedId).toBe(added.id);
    expect(useTreeStore.getState().selectedIds).toEqual([added.id]);
  });

  it('keeps styles and features when the bracket text is re-parsed', () => {
    const npId = root().children[0].id;
    useTreeStore.getState().setNodeStyle([npId], { fontSize: 22, color: '#4361ff' });
    useTreeStore.getState().setNodeFeatures(npId, ['+wh']);

    // Editing the bracket editor rebuilds every node from scratch.
    useTreeStore.getState().setTreeFromBracket('[S [NP the] [VP b]]');

    const np = root().children[0];
    expect(np.children[0].label).toBe('the');
    expect(np.style).toEqual({ fontSize: 22, color: '#4361ff' });
    expect(np.features).toEqual(['+wh']);
  });
});
