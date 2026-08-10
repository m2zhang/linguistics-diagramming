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

describe('presentation steps', () => {
  const reset = () => {
    useTreeStore.setState({
      tree: null,
      annotations: EMPTY_ANNOTATIONS,
      past: [],
      future: [],
      selectedId: null,
      selectedIds: [],
      parseErrors: [],
      currentStep: 0,
      stepLabels: {},
    });
  };
  const root = () => useTreeStore.getState().tree!;

  beforeEach(reset);

  it('puts the first tree typed into an empty document on step 0', () => {
    useTreeStore.getState().setTreeFromBracket('[S [NP a] [VP b]]');
    expect(root().step).toBe(0);
    expect(root().children.map((c) => c.step)).toEqual([0, 0]);
    expect(useTreeStore.getState().currentStep).toBe(0);
  });

  it('opens a new step per added child, stamping only the new node', () => {
    useTreeStore.getState().setTreeFromBracket('[S [NP a]]');
    useTreeStore.getState().addChild(root().id, 'VP');
    useTreeStore.getState().addChild(root().id, 'PP');

    expect(root().step).toBe(0);
    expect(root().children.map((c) => c.step)).toEqual([0, 1, 2]);
    expect(useTreeStore.getState().currentStep).toBe(2);
  });

  it('reveals an attached preset as a single step', () => {
    useTreeStore.getState().setTreeFromBracket('[S [NP a]]');
    useTreeStore.getState().attachPreset(root().id, {
      id: 'p',
      label: 'VP',
      children: [
        { id: 'p1', label: 'V', children: [] },
        { id: 'p2', label: 'NP', children: [] },
      ],
    });
    const attached = root().children[1];
    expect(attached.label).toBe('V');
    // Every node the preset brought reveals together.
    expect(root().children.slice(1).map((c) => c.step)).toEqual([1, 1]);
  });

  it('keeps step stamps through a bracket re-parse', () => {
    useTreeStore.getState().setTreeFromBracket('[S [NP a]]');
    useTreeStore.getState().addChild(root().id, 'VP');
    expect(root().children[1].step).toBe(1);

    // Retyping the text rebuilds every node from scratch.
    useTreeStore.getState().setTreeFromBracket('[S [NP a] [VP]]');
    expect(root().children.map((c) => c.step)).toEqual([0, 1]);
  });

  it('does not open a step for an edit that adds no nodes', () => {
    useTreeStore.getState().setTreeFromBracket('[S [NP a]]');
    useTreeStore.getState().addChild(root().id, 'VP');
    const before = useTreeStore.getState().currentStep;

    useTreeStore.getState().setTreeFromBracket('[TP [NP a] [VP]]'); // rename only
    expect(useTreeStore.getState().currentStep).toBe(before);
    expect(root().label).toBe('TP');
    expect(root().children.map((c) => c.step)).toEqual([0, 1]);
  });

  it('stamps annotations with the step being authored, without opening one', () => {
    useTreeStore.getState().setTreeFromBracket('[S [NP a]]');
    useTreeStore.getState().addChild(root().id, 'VP'); // step 1
    useTreeStore.getState().addNote({ x: 0, y: 0, text: 'note' });

    expect(useTreeStore.getState().annotations.notes[0].step).toBe(1);
    expect(useTreeStore.getState().currentStep).toBe(1);
  });

  it('leaves no trace of a deleted annotation in the deck', () => {
    useTreeStore.getState().setTreeFromBracket('[S [NP a]]');
    useTreeStore.getState().newStep();
    useTreeStore.getState().addNote({ x: 0, y: 0, text: 'keep' });
    useTreeStore.getState().addNote({ x: 1, y: 1, text: 'drop' });
    const drop = useTreeStore.getState().annotations.notes[1].id;
    useTreeStore.getState().removeAnnotation(drop);

    const notes = useTreeStore.getState().annotations.notes;
    expect(notes.map((n) => n.text)).toEqual(['keep']);
    expect(notes[0].step).toBe(1);
  });

  it('spends the step reserved by newStep instead of opening another', () => {
    useTreeStore.getState().setTreeFromBracket('[S [NP a]]');
    useTreeStore.getState().newStep();
    expect(useTreeStore.getState().currentStep).toBe(1);
    useTreeStore.getState().addChild(root().id, 'VP');
    expect(root().children[1].step).toBe(1);
  });

  it('merges a step into the one before it and closes the gap', () => {
    useTreeStore.getState().setTreeFromBracket('[S [NP a]]');
    useTreeStore.getState().addChild(root().id, 'VP'); // 1
    useTreeStore.getState().addChild(root().id, 'PP'); // 2
    useTreeStore.getState().renameStep(2, 'third');

    useTreeStore.getState().mergeStepWithPrevious(1);
    expect(root().children.map((c) => c.step)).toEqual([0, 0, 1]);
    // The merged step's name goes with it; later names shift down.
    expect(useTreeStore.getState().stepLabels).toEqual({ 1: 'third' });
    expect(useTreeStore.getState().currentStep).toBe(1);
  });

  it('moves a selection onto another step', () => {
    useTreeStore.getState().setTreeFromBracket('[S [NP a] [VP b]]');
    const vpId = root().children[1].id;
    useTreeStore.getState().setNodeStep([vpId], 2);
    expect(root().children[1].step).toBe(2);
    // Its own children are untouched: layout clamps them to the parent instead.
    expect(root().children[1].children[0].step).toBe(0);
  });

  it('restores steps on undo without the deck outliving the tree', () => {
    useTreeStore.getState().setTreeFromBracket('[S [NP a]]');
    useTreeStore.getState().addChild(root().id, 'VP');
    expect(useTreeStore.getState().currentStep).toBe(1);

    useTreeStore.getState().undo();
    expect(root().children).toHaveLength(1);
    expect(useTreeStore.getState().currentStep).toBe(0);

    useTreeStore.getState().redo();
    expect(root().children[1].step).toBe(1);
    expect(useTreeStore.getState().currentStep).toBe(1);
  });
});

describe('replacing the tree from a drawing', () => {
  beforeEach(() => {
    useTreeStore.setState({
      tree: null,
      annotations: EMPTY_ANNOTATIONS,
      past: [],
      future: [],
      selectedId: null,
      selectedIds: [],
      currentStep: 0,
      stepLabels: {},
    });
  });

  it('restarts the deck instead of stacking onto the old step numbers', () => {
    // Build a tree across several steps, as a normal editing session would.
    useTreeStore.getState().setTreeFromBracket('[S [NP a]]');
    const rootId = useTreeStore.getState().tree!.id;
    useTreeStore.getState().addChild(rootId, 'VP');
    useTreeStore.getState().addChild(rootId, 'PP');
    useTreeStore.getState().renameStep(1, 'old name');

    // Recognition replaces the whole thing with a single node.
    useTreeStore.getState().applyDrawingResult({ id: 'n', label: 'N', children: [] }, []);

    const tree = useTreeStore.getState().tree!;
    expect(tree.label).toBe('N');
    expect(tree.step).toBe(0);
    expect(useTreeStore.getState().currentStep).toBe(0);
    // Names belonged to steps that no longer exist.
    expect(useTreeStore.getState().stepLabels).toEqual({});
  });

  it('keeps surviving annotations in order behind the new tree', () => {
    useTreeStore.getState().setTreeFromBracket('[S [NP a]]');
    useTreeStore.getState().newStep();
    useTreeStore.getState().addNote({ x: 0, y: 0, text: 'kept' }); // step 1

    useTreeStore.getState().applyDrawingResult({ id: 'n', label: 'N', children: [] }, []);

    expect(useTreeStore.getState().tree!.step).toBe(0);
    // The note was on step 1 of the old numbering; it closes up to step 1 of the new.
    expect(useTreeStore.getState().annotations.notes[0].step).toBe(1);
    expect(useTreeStore.getState().currentStep).toBe(1);
  });
});
