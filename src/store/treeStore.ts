import { create } from 'zustand';
import { parseBracket, ParseError } from '../model/bracketParser';
import { serializeBracketPretty } from '../model/bracketSerializer';
import {
  Annotations,
  Box,
  cloneWithNewIds,
  Connector,
  EMPTY_ANNOTATIONS,
  makeId,
  makeNode,
  Stroke,
  TextNote,
  TreeNode,
} from '../model/types';

type Updater = (node: TreeNode) => TreeNode;

/** Return a new tree with `fn` applied to the node matching `id`. */
function updateNode(root: TreeNode, id: string, fn: Updater): TreeNode {
  if (root.id === id) return fn(root);
  let changed = false;
  const children = root.children.map((c) => {
    const next = updateNode(c, id, fn);
    if (next !== c) changed = true;
    return next;
  });
  return changed ? { ...root, children } : root;
}

/** Remove the node with `id`; its children are reattached to its parent. */
function removeNode(root: TreeNode, id: string): TreeNode {
  const children: TreeNode[] = [];
  for (const c of root.children) {
    if (c.id === id) {
      children.push(...c.children); // reattach grandchildren
    } else {
      children.push(removeNode(c, id));
    }
  }
  return { ...root, children };
}

function findNode(root: TreeNode | null, id: string): TreeNode | null {
  if (!root) return null;
  if (root.id === id) return root;
  for (const c of root.children) {
    const found = findNode(c, id);
    if (found) return found;
  }
  return null;
}

/** One undoable snapshot: the tree plus canvas annotations. */
interface Snapshot {
  tree: TreeNode | null;
  annotations: Annotations;
}

const HISTORY_LIMIT = 100;

interface TreeState {
  tree: TreeNode | null;
  annotations: Annotations;
  selectedId: string | null;
  selectedIds: string[];
  parseErrors: ParseError[];
  /** Bumped whenever the tree changes from a non-text source, so the editor re-syncs. */
  treeRevision: number;
  past: Snapshot[];
  future: Snapshot[];

  setTreeFromBracket: (text: string, forceRevisionBump?: boolean) => void;
  replaceTree: (tree: TreeNode | null) => void;
  select: (id: string | null, keepExisting?: boolean) => void;
  renameNode: (id: string, label: string) => void;
  deleteNode: (id: string) => void;
  deleteMultiple: (ids: string[]) => void;
  addChild: (parentId: string, label?: string) => void;
  attachPreset: (targetId: string, preset: TreeNode) => void;
  clear: () => void;

  addStroke: (stroke: Omit<Stroke, 'id'>) => void;
  moveStroke: (id: string, dx: number, dy: number) => void;
  addNote: (note: Omit<TextNote, 'id'>) => void;
  addBox: (box: Omit<Box, 'id'>) => void;
  moveBox: (id: string, dx: number, dy: number) => void;
  addConnector: (connector: Omit<Connector, 'id'>) => void;
  moveConnector: (id: string, dx: number, dy: number) => void;
  updateNote: (id: string, fields: Partial<Omit<TextNote, 'id'>>) => void;
  removeAnnotation: (id: string) => void;
  setAnnotations: (annotations: Annotations) => void;

  /** Apply a drawing→tree conversion: set the tree, consume used annotations (one undo step). */
  applyDrawingResult: (tree: TreeNode, usedIds: string[]) => void;

  undo: () => void;
  redo: () => void;

  bracketText: () => string;
}

export const useTreeStore = create<TreeState>((set, get) => {
  /** Push the current state onto the undo stack and clear redo. */
  const snapshot = (s: { tree: TreeNode | null; annotations: Annotations; past: Snapshot[] }) => ({
    past: [...s.past.slice(-(HISTORY_LIMIT - 1)), { tree: s.tree, annotations: s.annotations }],
    future: [] as Snapshot[],
  });

  return {
    tree: null,
    annotations: EMPTY_ANNOTATIONS,
    selectedId: null,
    selectedIds: [],
    parseErrors: [],
    treeRevision: 0,
    past: [],
    future: [],

    setTreeFromBracket: (text, forceRevisionBump = false) => {
      const { tree, errors } = parseBracket(text);
      const isEmpty = text.trim() === '';
      set((s) => ({
        ...snapshot(s),
        tree: isEmpty ? null : (tree ?? s.tree),
        parseErrors: errors,
        treeRevision: forceRevisionBump ? s.treeRevision + 1 : s.treeRevision,
      }));
    },

    replaceTree: (tree) =>
      set((s) => ({
        ...snapshot(s),
        tree,
        selectedId: null,
        selectedIds: [],
        parseErrors: [],
        treeRevision: s.treeRevision + 1,
      })),

    select: (id, keepExisting = false) =>
      set((s) => {
        if (id === null) {
          return { selectedId: null, selectedIds: [] };
        }
        if (keepExisting) {
          const nextIds = s.selectedIds.includes(id)
            ? s.selectedIds.filter((x) => x !== id)
            : [...s.selectedIds, id];
          return {
            selectedIds: nextIds,
            selectedId: nextIds[nextIds.length - 1] || null,
          };
        }
        return {
          selectedId: id,
          selectedIds: [id],
        };
      }),

    renameNode: (id, label) =>
      set((s) => ({
        ...snapshot(s),
        tree: s.tree ? updateNode(s.tree, id, (n) => ({ ...n, label })) : s.tree,
        treeRevision: s.treeRevision + 1,
      })),

    deleteNode: (id) =>
      set((s) => {
        if (!s.tree) return s;
        const isSelected = s.selectedIds.includes(id);
        const nextIds = s.selectedIds.filter((x) => x !== id);
        if (s.tree.id === id) {
          // Deleting the root clears the canvas.
          return {
            ...snapshot(s),
            tree: null,
            selectedId: isSelected ? null : s.selectedId,
            selectedIds: nextIds,
            treeRevision: s.treeRevision + 1,
          };
        }
        return {
          ...snapshot(s),
          tree: removeNode(s.tree, id),
          selectedId: s.selectedId === id ? null : s.selectedId,
          selectedIds: nextIds,
          treeRevision: s.treeRevision + 1,
        };
      }),

    deleteMultiple: (ids) =>
      set((s) => {
        if (
          !s.tree &&
          s.annotations.strokes.length === 0 &&
          s.annotations.notes.length === 0 &&
          (!s.annotations.boxes || s.annotations.boxes.length === 0) &&
          (!s.annotations.connectors || s.annotations.connectors.length === 0)
        ) {
          return s;
        }

        let currentTree = s.tree;
        let currentAnn = { ...s.annotations };

        for (const id of ids) {
          const isNote = currentAnn.notes.some((n) => n.id === id);
          const isStroke = currentAnn.strokes.some((st) => st.id === id);
          const isBox = (currentAnn.boxes || []).some((b) => b.id === id);
          const isConnector = (currentAnn.connectors || []).some((c) => c.id === id);

          if (isNote || isStroke || isBox || isConnector) {
            currentAnn = {
              strokes: currentAnn.strokes.filter((st) => st.id !== id),
              notes: currentAnn.notes.filter((n) => n.id !== id),
              boxes: (currentAnn.boxes || []).filter((b) => b.id !== id),
              connectors: (currentAnn.connectors || []).filter((c) => c.id !== id),
            };
          } else if (currentTree) {
            if (currentTree.id === id) {
              currentTree = null;
            } else {
              currentTree = removeNode(currentTree, id);
            }
          }
        }

        return {
          ...snapshot(s),
          tree: currentTree,
          annotations: currentAnn,
          selectedId: null,
          selectedIds: [],
          treeRevision: currentTree !== s.tree ? s.treeRevision + 1 : s.treeRevision,
        };
      }),

    addChild: (parentId, label = 'X') =>
      set((s) => ({
        ...snapshot(s),
        tree: s.tree
          ? updateNode(s.tree, parentId, (n) => ({
              ...n,
              children: [...n.children, makeNode(label)],
            }))
          : s.tree,
        treeRevision: s.treeRevision + 1,
      })),

    attachPreset: (targetId, preset) =>
      set((s) => {
        if (!s.tree) {
          return {
            ...snapshot(s),
            tree: cloneWithNewIds(preset),
            treeRevision: s.treeRevision + 1,
          };
        }
        return {
          ...snapshot(s),
          tree: updateNode(s.tree, targetId, (n) => ({
            ...n,
            children: [...n.children, ...cloneWithNewIds(preset).children],
          })),
          treeRevision: s.treeRevision + 1,
        };
      }),

    clear: () =>
      set((s) => ({
        ...snapshot(s),
        tree: null,
        annotations: EMPTY_ANNOTATIONS,
        selectedId: null,
        selectedIds: [],
        parseErrors: [],
        treeRevision: s.treeRevision + 1,
      })),

    addStroke: (stroke) =>
      set((s) => ({
        ...snapshot(s),
        annotations: {
          ...s.annotations,
          strokes: [...s.annotations.strokes, { ...stroke, id: makeId() }],
        },
      })),

    moveStroke: (id, dx, dy) =>
      set((s) => ({
        ...snapshot(s),
        annotations: {
          ...s.annotations,
          strokes: s.annotations.strokes.map((st) => {
            if (st.id !== id) return st;
            return {
              ...st,
              points: st.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
            };
          }),
        },
      })),

    addNote: (note) =>
      set((s) => ({
        ...snapshot(s),
        annotations: {
          ...s.annotations,
          notes: [...s.annotations.notes, { ...note, id: makeId() }],
        },
      })),

    addBox: (box) =>
      set((s) => ({
        ...snapshot(s),
        annotations: {
          ...s.annotations,
          boxes: [...(s.annotations.boxes || []), { ...box, id: makeId() }],
        },
      })),

    moveBox: (id, dx, dy) =>
      set((s) => ({
        ...snapshot(s),
        annotations: {
          ...s.annotations,
          boxes: (s.annotations.boxes || []).map((b) => {
            if (b.id !== id) return b;
            return { ...b, x: b.x + dx, y: b.y + dy };
          }),
        },
      })),

    addConnector: (connector) =>
      set((s) => ({
        ...snapshot(s),
        annotations: {
          ...s.annotations,
          connectors: [...(s.annotations.connectors || []), { ...connector, id: makeId() }],
        },
      })),

    moveConnector: (id, dx, dy) =>
      set((s) => ({
        ...snapshot(s),
        annotations: {
          ...s.annotations,
          connectors: (s.annotations.connectors || []).map((c) => {
            if (c.id !== id) return c;
            return {
              ...c,
              startX: c.startX + dx,
              startY: c.startY + dy,
              endX: c.endX + dx,
              endY: c.endY + dy,
            };
          }),
        },
      })),

    updateNote: (id, fields) =>
      set((s) => ({
        ...snapshot(s),
        annotations: {
          ...s.annotations,
          notes: s.annotations.notes
            .map((n) => (n.id === id ? { ...n, ...fields } : n))
            .filter((n) => n.text.trim()),
        },
      })),

    removeAnnotation: (id) =>
      set((s) => ({
        ...snapshot(s),
        annotations: {
          strokes: s.annotations.strokes.filter((st) => st.id !== id),
          notes: s.annotations.notes.filter((n) => n.id !== id),
          boxes: (s.annotations.boxes || []).filter((b) => b.id !== id),
          connectors: (s.annotations.connectors || []).filter((c) => c.id !== id),
        },
      })),

    setAnnotations: (annotations) => set({ annotations }),

    applyDrawingResult: (tree, usedIds) => {
      const used = new Set(usedIds);
      set((s) => ({
        ...snapshot(s),
        tree,
        annotations: {
          strokes: s.annotations.strokes.filter((st) => !used.has(st.id)),
          notes: s.annotations.notes.filter((n) => !used.has(n.id)),
          boxes: s.annotations.boxes || [],
          connectors: (s.annotations.connectors || []).filter((c) => !used.has(c.id)),
        },
        selectedId: null,
        selectedIds: [],
        parseErrors: [],
        treeRevision: s.treeRevision + 1,
      }));
    },

    undo: () =>
      set((s) => {
        const prev = s.past[s.past.length - 1];
        if (!prev) return s;
        return {
          past: s.past.slice(0, -1),
          future: [...s.future, { tree: s.tree, annotations: s.annotations }],
          tree: prev.tree,
          annotations: prev.annotations,
          selectedId: null,
          selectedIds: [],
          parseErrors: [],
          // Annotation-only undos shouldn't refit the view / resync the editor.
          treeRevision: prev.tree !== s.tree ? s.treeRevision + 1 : s.treeRevision,
        };
      }),

    redo: () =>
      set((s) => {
        const next = s.future[s.future.length - 1];
        if (!next) return s;
        return {
          future: s.future.slice(0, -1),
          past: [...s.past, { tree: s.tree, annotations: s.annotations }],
          tree: next.tree,
          annotations: next.annotations,
          selectedId: null,
          selectedIds: [],
          parseErrors: [],
          treeRevision: next.tree !== s.tree ? s.treeRevision + 1 : s.treeRevision,
        };
      }),

    bracketText: () => {
      const t = get().tree;
      return t ? serializeBracketPretty(t) : '';
    },
  };
});

export { findNode };
