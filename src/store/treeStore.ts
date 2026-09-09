import { create } from 'zustand';
import { parseBracket, ParseError } from '../model/bracketParser';
import { serializeBracketPretty } from '../model/bracketSerializer';
import {
  Annotations,
  Box,
  carryOverDecorations,
  cloneWithNewIds,
  collectAnnotationSteps,
  collectTreeSteps,
  Connector,
  EMPTY_ANNOTATIONS,
  hasUnstampedNodes,
  isEmptyDocument,
  makeId,
  makeNode,
  mapNodeSteps,
  maxStep,
  normalizeFeatures,
  normalizeStyle,
  NodeStyle,
  remapAnnotationSteps,
  remapTreeSteps,
  stampNewNodes,
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
  currentStep: number;
}

const HISTORY_LIMIT = 100;

/**
 * Bracket-editor commits closer together than this fold into one presentation
 * step. Typing commits every 250 ms, so without this a single typed subtree
 * would become a dozen slides; a pause long enough to think is a step boundary.
 *
 * Only text edits coalesce. Clicking "+ Child" twice is two deliberate acts,
 * and merging them would be the app second-guessing the author.
 */
const STEP_COALESCE_MS = 1500;
const COALESCING_KIND = 'bracket';

/** Timestamp + kind of the last stamped edit, for the coalescing window above. */
let lastStampAt = 0;
let lastStampKind: string | null = null;
/** Step claimed by "New step" that nothing has been stamped with yet. */
let reservedStep: number | null = null;

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
  /**
   * Identifies the last mutation so a run of like changes (e.g. dragging the
   * font-size slider) collapses into a single undo step. `null` = don't merge.
   */
  lastActionKey: string | null;

  /**
   * Presentation step new nodes and annotations are stamped with. Advances by
   * itself as the tree is built, so presenting replays how it was made; the
   * Steps panel is there to merge the runs that turned out too fine-grained.
   *
   * Deliberately independent of `past`/`future`: undo must not rewrite a deck.
   */
  currentStep: number;
  /** Optional presenter-facing names, keyed by step number. */
  stepLabels: Record<number, string>;

  setTreeFromBracket: (text: string, forceRevisionBump?: boolean) => void;
  replaceTree: (tree: TreeNode | null) => void;
  select: (id: string | null, keepExisting?: boolean) => void;
  renameNode: (id: string, label: string) => void;
  deleteNode: (id: string) => void;
  deleteMultiple: (ids: string[]) => void;
  addChild: (parentId: string, label?: string) => void;
  setNodeStyle: (ids: string[], patch: NodeStyle, coalesceKey?: string) => void;
  setNodeTriangle: (ids: string[], triangle: boolean) => void;
  setNodeFeatures: (id: string, features: string[]) => void;
  /**
   * Override the colour one feature renders in, across every given node that
   * carries it. `undefined` clears the override and returns it to the hue
   * featureColor() derives from the text.
   */
  setNodeFeatureColor: (ids: string[], feature: string, color: string | undefined) => void;
  /** Append one feature to a node. Returns false when the node already had it. */
  addNodeFeature: (id: string, feature: string) => boolean;
  attachPreset: (targetId: string, preset: TreeNode) => void;
  clear: () => void; //for clearing both annotations and tree
  clearAnnotations: () => void; //creating a separate one for just clearing annotations only

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

  /** Start a fresh step: whatever is built next reveals on its own. */
  newStep: () => void;
  /** Put the given nodes on `step` (clamped at 0). */
  setNodeStep: (ids: string[], step: number) => void;
  /** Fold `step` into the one before it; later steps shift down to close the gap. */
  mergeStepWithPrevious: (step: number) => void;
  renameStep: (step: number, name: string) => void;
  /** Restore step metadata from a saved project. */
  loadStepMeta: (currentStep: number | undefined, labels: Record<number, string> | undefined) => void;

  undo: () => void;
  redo: () => void;

  bracketText: () => string;
}

type SnapshotSource = {
  tree: TreeNode | null;
  annotations: Annotations;
  past: Snapshot[];
  lastActionKey: string | null;
  currentStep: number;
};

export const useTreeStore = create<TreeState>((set, get) => {
  /**
   * Push the current state onto the undo stack and clear redo.
   *
   * Passing `key` merges this change into the previous history entry when the
   * previous change carried the same key, so a slider drag is one undo step.
   */
  const snapshot = (s: SnapshotSource, key: string | null = null) => {
    if (key !== null && key === s.lastActionKey) {
      return { past: s.past, future: [] as Snapshot[], lastActionKey: key };
    }
    return {
      past: [
        ...s.past.slice(-(HISTORY_LIMIT - 1)),
        { tree: s.tree, annotations: s.annotations, currentStep: s.currentStep },
      ],
      future: [] as Snapshot[],
      lastActionKey: key,
    };
  };

   //The step a structural edit of this `kind` should stamp its new nodes with.
  const stampFor = (s: SnapshotSource, kind: string): number => {
    const now = Date.now();
    const continues =
      kind === COALESCING_KIND && kind === lastStampKind && now - lastStampAt < STEP_COALESCE_MS;
    lastStampAt = now;
    lastStampKind = kind;
    // "New step" reserved a number that nothing has used yet — spend it.
    if (reservedStep !== null) {
      const step = reservedStep;
      reservedStep = null;
      return step;
    }
    if (continues) return s.currentStep;
    // The first thing ever built belongs on step 0, not step 1.
    if (isEmptyDocument(s.tree, s.annotations)) return 0;
    return maxStep(s.tree, s.annotations) + 1;
  };

  /**
   * Annotations join the step being authored instead of opening a new one:
   * circling a node is part of that beat, not a beat of its own.
   */
  const annotationStamp = (s: SnapshotSource): number => {
    reservedStep = null;
    return s.currentStep;
  };

  return {
    tree: null,
    annotations: EMPTY_ANNOTATIONS,
    selectedId: null,
    selectedIds: [],
    parseErrors: [],
    treeRevision: 0,
    past: [],
    future: [],
    lastActionKey: null,
    currentStep: 0,
    stepLabels: {},

    setTreeFromBracket: (text, forceRevisionBump = false) => {
      const { tree, errors } = parseBracket(text);
      const isEmpty = text.trim() === '';
      set((s) => {
        // Re-parsing rebuilds every node, so re-apply the inspector's styling —
        // and the step stamps, which carryOverDecorations matches positionally.
        const carried = isEmpty ? null : tree ? carryOverDecorations(s.tree, tree) : s.tree;
        // Only an edit that actually introduced nodes opens a step — retyping a
        // label leaves the deck alone.
        const added = carried ? hasUnstampedNodes(carried) : false;
        const step = added ? stampFor(s, 'bracket') : s.currentStep;
        return {
          ...snapshot(s),
          tree: carried && added ? stampNewNodes(carried, step) : carried,
          currentStep: step,
          parseErrors: errors,
          treeRevision: forceRevisionBump ? s.treeRevision + 1 : s.treeRevision,
        };
      });
    },

    replaceTree: (tree) =>
      set((s) => ({
        ...snapshot(s),
        tree,
        // Wholesale replacement (open, import, template): adopt the document's
        // own step numbering rather than carrying over the last one's.
        currentStep: maxStep(tree, s.annotations),
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

    addChild: (parentId, label = 'X') => {
      // Built outside the updater so the id is available for the selection below.
      const child = makeNode(label);
      set((s) => {
        if (!s.tree) return s;
        const step = stampFor(s, 'addChild');
        return {
          ...snapshot(s),
          tree: updateNode(s.tree, parentId, (n) => ({
            ...n,
            children: [...n.children, { ...child, step }],
          })),
          currentStep: step,
          // Select the new child so it can be renamed straight away.
          selectedId: child.id,
          selectedIds: [child.id],
          treeRevision: s.treeRevision + 1,
        };
      });
    },

    setNodeStyle: (ids, patch, coalesceKey) =>
      set((s) => {
        if (!s.tree || ids.length === 0) return s;
        let tree = s.tree;
        for (const id of ids) {
          tree = updateNode(tree, id, (n) => ({
            ...n,
            style: normalizeStyle({ ...n.style, ...patch }),
          }));
        }
        if (tree === s.tree) return s;
        // No treeRevision bump: styling changes neither the structure nor the
        // bracket text, and bumping would re-fit the view on every slider tick.
        return { ...snapshot(s, coalesceKey ?? null), tree };
      }),

    setNodeTriangle: (ids, triangle) =>
      set((s) => {
        if (!s.tree || ids.length === 0) return s;
        let tree = s.tree;
        for (const id of ids) {
          tree = updateNode(tree, id, (n) => ({
            ...n,
            triangle: triangle || undefined,
          }));
        }
        if (tree === s.tree) return s;
        return { ...snapshot(s), tree, treeRevision: s.treeRevision + 1 };
      }),

    setNodeFeatures: (id, features) =>
      set((s) => {
        if (!s.tree) return s;
        const next = normalizeFeatures(features);
        const tree = updateNode(s.tree, id, (n) => {
          // Drop overrides for features the node no longer carries, so a
          // removed-and-retyped tag does not silently inherit an old colour.
          const kept = Object.fromEntries(
            Object.entries(n.featureColors ?? {}).filter(([k]) => (next ?? []).includes(k)),
          );
          return {
            ...n,
            features: next,
            featureColors: Object.keys(kept).length > 0 ? kept : undefined,
          };
        });
        if (tree === s.tree) return s;
        return { ...snapshot(s), tree };
      }),

    setNodeFeatureColor: (ids, feature, color) =>
      set((s) => {
        if (!s.tree) return s;
        let tree = s.tree;
        for (const id of ids) {
          tree = updateNode(tree, id, (n) => {
            // Only touch nodes that actually carry the feature, so applying a
            // colour across a multi-selection cannot invent overrides for tags
            // a node does not have.
            if (!(n.features ?? []).includes(feature)) return n;
            const map = { ...(n.featureColors ?? {}) };
            // `undefined` means "back to the derived hue", which is a delete
            // rather than storing a null the render path would have to handle.
            if (color === undefined) delete map[feature];
            else map[feature] = color;
            return { ...n, featureColors: Object.keys(map).length > 0 ? map : undefined };
          });
        }
        if (tree === s.tree) return s;
        return { ...snapshot(s), tree };
      }),

    // Separate from setNodeFeatures because the caller (a drop, a click in the
    // bundle library) has one feature and no view of the node's current list,
    // and needs to know whether anything actually changed so it can say so.
    addNodeFeature: (id, feature) => {
      const value = feature.trim();
      if (!value) return false;
      const node = findNode(get().tree, id);
      if (!node) return false;
      if ((node.features ?? []).includes(value)) return false;
      get().setNodeFeatures(id, [...(node.features ?? []), value]);
      return true;
    },

    attachPreset: (targetId, preset) =>
      set((s) => {
        // A preset arrives whole, so the subtree it brings is one step.
        const step = stampFor(s, 'preset');
        if (!s.tree) {
          return {
            ...snapshot(s),
            tree: stampNewNodes(cloneWithNewIds(preset), step),
            currentStep: step,
            treeRevision: s.treeRevision + 1,
          };
        }
        const attached = stampNewNodes(cloneWithNewIds(preset), step);
        return {
          ...snapshot(s),
          tree: updateNode(s.tree, targetId, (n) => ({
            ...n,
            children: [...n.children, ...attached.children],
          })),
          currentStep: step,
          treeRevision: s.treeRevision + 1,
        };
      }),

    clear: () =>
      set((s) => {
        reservedStep = null;
        lastStampKind = null;
        return {
          ...snapshot(s),
          tree: null,
          annotations: EMPTY_ANNOTATIONS,
          currentStep: 0,
          stepLabels: {},
          selectedId: null,
          selectedIds: [],
          parseErrors: [],
          treeRevision: s.treeRevision + 1,
        };
      }),
    //A function of just clearing the annotations by removing the parts about the tree from clear()
    clearAnnotations: () =>
      set((s) => ({
        ...snapshot(s),
        annotations: EMPTY_ANNOTATIONS,
        selectedId: null,
        selectedIds: [],
      })),

    addStroke: (stroke) =>
      set((s) => ({
        ...snapshot(s),
        annotations: {
          ...s.annotations,
          strokes: [...s.annotations.strokes, { step: annotationStamp(s), ...stroke, id: makeId() }],
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
          notes: [...s.annotations.notes, { step: annotationStamp(s), ...note, id: makeId() }],
        },
      })),

    addBox: (box) =>
      set((s) => ({
        ...snapshot(s),
        annotations: {
          ...s.annotations,
          boxes: [...(s.annotations.boxes || []), { step: annotationStamp(s), ...box, id: makeId() }],
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
          connectors: [
            ...(s.annotations.connectors || []),
            { step: annotationStamp(s), ...connector, id: makeId() },
          ],
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

    // Loading a document's annotations can bring steps the tree doesn't have
    // (a note on its own step), so keep the authoring cursor past them.
    setAnnotations: (annotations) =>
      set((s) => ({
        annotations,
        currentStep: Math.max(s.currentStep, maxStep(null, annotations)),
      })),

    applyDrawingResult: (tree, usedIds) => {
      const used = new Set(usedIds);
      set((s) => {
        // This replaces the whole tree, so the old numbering goes with it: the
        // recognised nodes are step 0 of a new deck, not a step after the last
        // one.
        const nextTree = stampNewNodes(tree, 0);
        const annotations = {
          strokes: s.annotations.strokes.filter((st) => !used.has(st.id)),
          notes: s.annotations.notes.filter((n) => !used.has(n.id)),
          boxes: s.annotations.boxes || [],
          connectors: (s.annotations.connectors || []).filter((c) => !used.has(c.id)),
        };
        const order = [
          ...new Set([...collectTreeSteps(nextTree), ...collectAnnotationSteps(annotations)]),
        ].sort((a, b) => a - b);
        const shift = (n: number) => order.indexOf(n);
        reservedStep = null;
        lastStampKind = null;
        return {
          ...snapshot(s),
          tree: remapTreeSteps(nextTree, shift),
          annotations: remapAnnotationSteps(annotations, shift),
          stepLabels: {},
          currentStep: Math.max(0, order.length - 1),
          selectedId: null,
          selectedIds: [],
          parseErrors: [],
          treeRevision: s.treeRevision + 1,
        };
      });
    },

    // ---- Presentation steps ----

    newStep: () =>
      set((s) => {
        const next = maxStep(s.tree, s.annotations) + 1;
        // Claim the number: the next thing built spends it instead of opening
        // yet another step. Also ends any coalescing run in progress.
        reservedStep = next;
        lastStampKind = null;
        return { currentStep: next };
      }),

    setNodeStep: (ids, step) =>
      set((s) => {
        if (!s.tree || ids.length === 0) return s;
        const target = Math.max(0, step);
        const tree = mapNodeSteps(s.tree, new Set(ids), () => target);
        if (tree === s.tree) return s;
        reservedStep = null;
        // Annotations are stamped too, so keep them in range when a node moves.
        const set2 = new Set(ids);
        const annotations = {
          strokes: s.annotations.strokes.map((x) => (set2.has(x.id) ? { ...x, step: target } : x)),
          notes: s.annotations.notes.map((x) => (set2.has(x.id) ? { ...x, step: target } : x)),
          boxes: (s.annotations.boxes ?? []).map((x) => (set2.has(x.id) ? { ...x, step: target } : x)),
          connectors: (s.annotations.connectors ?? []).map((x) =>
            set2.has(x.id) ? { ...x, step: target } : x,
          ),
        };
        return { ...snapshot(s), tree, annotations, currentStep: Math.max(s.currentStep, target) };
      }),

    mergeStepWithPrevious: (step) =>
      set((s) => {
        if (step <= 0) return s;
        // Everything on `step` joins `step - 1`; later steps close the gap.
        const shift = (n: number) => (n === step ? step - 1 : n > step ? n - 1 : n);
        const labels: Record<number, string> = {};
        for (const [k, v] of Object.entries(s.stepLabels)) {
          const n = Number(k);
          // The merged step's own name is dropped; the one it joins keeps its.
          if (n !== step) labels[shift(n)] = v;
        }
        reservedStep = null;
        lastStampKind = null;
        return {
          ...snapshot(s),
          tree: s.tree ? remapTreeSteps(s.tree, shift) : s.tree,
          annotations: remapAnnotationSteps(s.annotations, shift),
          stepLabels: labels,
          currentStep: Math.max(0, s.currentStep > step ? s.currentStep - 1 : s.currentStep),
        };
      }),

    renameStep: (step, name) =>
      set((s) => {
        const labels = { ...s.stepLabels };
        if (name.trim()) labels[step] = name.trim();
        else delete labels[step];
        return { stepLabels: labels };
      }),

    loadStepMeta: (currentStep, labels) =>
      set((s) => ({
        currentStep: currentStep ?? maxStep(s.tree, s.annotations),
        stepLabels: labels ?? {},
      })),

    undo: () =>
      set((s) => {
        const prev = s.past[s.past.length - 1];
        if (!prev) return s;
        lastStampKind = null;
        return {
          past: s.past.slice(0, -1),
          future: [
            ...s.future,
            { tree: s.tree, annotations: s.annotations, currentStep: s.currentStep },
          ],
          lastActionKey: null,
          tree: prev.tree,
          annotations: prev.annotations,
          currentStep: prev.currentStep,
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
        lastStampKind = null;
        return {
          future: s.future.slice(0, -1),
          past: [
            ...s.past,
            { tree: s.tree, annotations: s.annotations, currentStep: s.currentStep },
          ],
          lastActionKey: null,
          tree: next.tree,
          annotations: next.annotations,
          currentStep: next.currentStep,
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
