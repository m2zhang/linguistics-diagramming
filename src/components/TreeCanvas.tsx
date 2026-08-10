import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  edgeEndY,
  edgeStartY,
  FEATURE_FONT_SIZE,
  featureLineY,
  layoutTree,
  nodeBox,
  PositionedNode,
} from '../model/layout';
import { useTreeStore } from '../store/treeStore';
import { useUiStore } from '../store/uiStore';
import { drawingToTree, pointToSegment } from '../model/drawingToTree';
import { sketchToTree } from '../vision/sketchToTree';
import {
  Annotations,
  Box,
  collectAnnotationSteps,
  Connector,
  effectiveStyle,
  EMPTY_ANNOTATIONS,
  FONT_STACKS,
  makeId,
  Stroke,
  TextNote,
} from '../model/types';
import {
  FEATURE_DND_TYPE,
  featureColor,
  nodeTagColor,
  PEN_COLORS,
  textNoteColor,
} from '../model/features';
import {
  CursorIcon,
  EraserIcon,
  FitIcon,
  MinusIcon,
  PenIcon,
  PlusIcon,
  RedoIcon,
  TextIcon,
  TreeLogo,
  UndoIcon,
} from './icons';

interface ViewState {
  scale: number;
  tx: number;
  ty: number;
}

type Tool = 'select' | 'draw' | 'highlight'| 'text' | 'erase' | 'box' | 'arrow';

function HighlighterIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <g transform="rotate(45 12 12)">
        {/* Rounded marker body */}
        <rect x="8" y="2" width="8" height="13" rx="3" />

        {/* Tapered section between the body and tip */}
        <path d="M8 13h8l-2 5h-4l-2-5Z" />

        {/* Chisel tip */}
        <path d="M10 18h4v4h-4Z" />

        {/* Band across the marker */}
        <path d="M8 13h8" />
      </g>
    </svg>
  );
}

function ClearAnnotationsIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="m19 6-1 14H6L5 6" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </svg>
  );
}

function BoxIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="19" x2="19" y2="5" />
      <polyline points="12 5 19 5 19 12" />
    </svg>
  );
}

/** The two short strokes forming an arrowhead at a connector's end point. */
function arrowHeadPath(c: { startX: number; startY: number; endX: number; endY: number }): string {
  const angle = Math.atan2(c.endY - c.startY, c.endX - c.startX);
  const len = 10;
  const spread = Math.PI / 6;
  const x3 = c.endX - len * Math.cos(angle - spread);
  const y3 = c.endY - len * Math.sin(angle - spread);
  const x4 = c.endX - len * Math.cos(angle + spread);
  const y4 = c.endY - len * Math.sin(angle + spread);
  return `M ${x3} ${y3} L ${c.endX} ${c.endY} L ${x4} ${y4}`;
}

/** Inline SVG presentation for a node's label, honouring its inspector style. */
function labelStyle(n: PositionedNode): React.CSSProperties {
  const s = effectiveStyle(n.style, n.isLeaf);
  return {
    fontFamily: FONT_STACKS[s.font],
    fontSize: `${s.fontSize}px`,
    fontWeight: s.fontWeight,
    fontStyle: s.italic ? 'italic' : 'normal',
    ...(s.color ? { fill: s.color } : null),
  };
}

export interface CanvasHandle {
  svg: SVGSVGElement | null;
}

/** Imperative ref so the export module can grab the live <svg>. */
export const canvasRef: CanvasHandle = { svg: null };

export function TreeCanvas() {
  const tree = useTreeStore((s) => s.tree);
  const annotations = useTreeStore((s) => s.annotations);
  const selectedId = useTreeStore((s) => s.selectedId);
  const selectedIds = useTreeStore((s) => s.selectedIds);
  const treeRevision = useTreeStore((s) => s.treeRevision);
  const canUndo = useTreeStore((s) => s.past.length > 0);
  const canRedo = useTreeStore((s) => s.future.length > 0);
  const select = useTreeStore((s) => s.select);
  const renameNode = useTreeStore((s) => s.renameNode);
  const deleteMultiple = useTreeStore((s) => s.deleteMultiple);
  const replaceTree = useTreeStore((s) => s.replaceTree);
  const attachPreset = useTreeStore((s) => s.attachPreset);
  const addStroke = useTreeStore((s) => s.addStroke);
  const moveStroke = useTreeStore((s) => s.moveStroke);
  const addNote = useTreeStore((s) => s.addNote);
  const addBox = useTreeStore((s) => s.addBox);
  const moveBox = useTreeStore((s) => s.moveBox);
  const addConnector = useTreeStore((s) => s.addConnector);
  const moveConnector = useTreeStore((s) => s.moveConnector);
  const updateNote = useTreeStore((s) => s.updateNote);
  const removeAnnotation = useTreeStore((s) => s.removeAnnotation);
  const clearAnnotations = useTreeStore((s) => s.clearAnnotations);
  const applyDrawingResult = useTreeStore((s) => s.applyDrawingResult);
  const addNodeFeature = useTreeStore((s) => s.addNodeFeature);
  const [recognizing, setRecognizing] = useState(false);
  const undo = useTreeStore((s) => s.undo);
  const redo = useTreeStore((s) => s.redo);
  const toast = useUiStore((s) => s.toast);
  const presenting = useUiStore((s) => s.presenting);
  const revealMode = useUiStore((s) => s.revealMode);
  const revealStep = useUiStore((s) => s.revealStep);
  const previewStep = useUiStore((s) => s.previewStep);
  const setRevealBounds = useUiStore((s) => s.setRevealBounds);
  const locked = useUiStore((s) => s.locked);

  const appMode = useUiStore((s) => s.appMode);

  const wrapRef = useRef<HTMLDivElement>(null);
  const svgEl = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<ViewState>({ scale: 1, tx: 0, ty: 0 });
  const [tool, setTool] = useState<Tool>('select');

  // Draw/box/arrow are instructor-only tools (see toolButton gating below).
  // If a mode switch happens mid-session while one of them is selected
  // (e.g. an instructor previewing as student), fall back to 'select' so
  // the canvas never ends up in a tool that no longer has a button for it.
  useEffect(() => {
    if (appMode === 'student' && (tool === 'draw' || tool === 'box' || tool === 'arrow')) {
      setTool('select');
    }
  }, [appMode, tool]);
  // Both defaults come from PEN_COLORS. They used to be --danger / #dc2626,
  // which is now [+CASE]'s reserved tag red — a pen must never open on it.
  const [strokeColor, setStrokeColor] = useState(PEN_COLORS[0].value);
  const [customStrokeColor, setCustomStrokeColor] = useState('#ea580c'); //customStrokeColor to remember the latest color changes

  // strokeColor is shared by every annotation tool, and the colour wheel (pen
  // and highlighter only) can pick any hex — including a reserved tag hue.
  // Without this, picking [+CASE] red with the highlighter and then switching to
  // text would write notes in a colour that reads as a tag. See textNoteColor().
  useEffect(() => {
    if (tool === 'text') setStrokeColor(textNoteColor);
  }, [tool]);
  const [panning, setPanning] = useState(false);
  const [liveBox, setLiveBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const boxStart = useRef<{ x: number; y: number } | null>(null);
  const [liveConnector, setLiveConnector] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
  const connectorStart = useRef<{ x: number; y: number } | null>(null);
  const noteDragStart = useRef<{ id: string; startX: number; startY: number; initialX: number; initialY: number } | null>(null);
  const strokeDragStart = useRef<{ id: string; startX: number; startY: number } | null>(null);
  const boxDragStart = useRef<{ id: string; startX: number; startY: number } | null>(null);
  const connectorDragStart = useRef<{ id: string; startX: number; startY: number } | null>(null);
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);
  const [editingNote, setEditingNote] = useState<{
    id: string | null; // null = creating a new note
    x: number;
    y: number;
    value: string;
  } | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [liveStroke, setLiveStroke] = useState<{ x: number; y: number }[] | null>(null);
  const panStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const drawing = useRef(false);
  // Ref mirrors of the live shapes: state can lag behind fast pointer events,
  // so commits on pointerup must read from these, never from render closures.
  const liveStrokeRef = useRef<{ x: number; y: number }[] | null>(null);
  const liveBoxRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const liveConnectorRef = useRef<{ startX: number; startY: number; endX: number; endY: number } | null>(null);

  const layout = useMemo(() => (tree ? layoutTree(tree) : null), [tree]);
  // Edges need their endpoints' styles (branch thickness, label size, features).
  const nodeById = useMemo(
    () => new Map((layout?.nodes ?? []).map((n) => [n.id, n])),
    [layout],
  );
  // ----- Step-by-step reveal -----
  const maxDepth = useMemo(
    () => (layout?.nodes ?? []).reduce((m, n) => Math.max(m, n.depth), 0),
    [layout],
  );
  /**
   * The steps this document actually uses, ascending — one slide each.
   *
   * Node steps come from the layout, so they are already clamped to their
   * parents': a child stamped earlier than its parent contributes the step it
   * will really appear on, not the one recorded on it.
   */
  const usedSteps = useMemo(() => {
    const steps = new Set<number>();
    for (const n of layout?.nodes ?? []) steps.add(n.step);
    for (const step of collectAnnotationSteps(annotations)) steps.add(step);
    return [...steps].sort((a, b) => a - b);
  }, [layout, annotations]);
  useEffect(() => {
    setRevealBounds({ usedSteps, maxDepth });
  }, [usedSteps, maxDepth, setRevealBounds]);

  /**
   * How far the reveal has got, or null when everything is on show. Presenting
   * drives it; while authoring, the Steps panel can preview a step in place.
   */
  const revealLimit = presenting ? revealStep : previewStep;
  /** Previewing is always about steps; only the presenter can pick depth mode. */
  const byDepth = presenting && revealMode === 'depth';

  /**
   * Unrevealed nodes are faded out rather than unmounted, so every node keeps
   * the position it has in the finished tree — nothing shifts as they appear.
   */
  const isHidden = useCallback(
    (n: { depth: number; step: number }) =>
      revealLimit !== null && (byDepth ? n.depth > revealLimit : n.step > revealLimit),
    [revealLimit, byDepth],
  );

  /** Annotations reveal on the step they were drawn on; depth mode ignores them. */
  const isAnnotationHidden = useCallback(
    (a: { step?: number }) => revealLimit !== null && !byDepth && (a.step ?? 0) > revealLimit,
    [revealLimit, byDepth],
  );

  /** Ids of everything on the annotation layer — the only things a locked canvas may delete. */
  const annotationIds = useMemo(() => {
    const ids = new Set<string>();
    for (const s of annotations.strokes) ids.add(s.id);
    for (const n of annotations.notes) ids.add(n.id);
    for (const b of annotations.boxes ?? []) ids.add(b.id);
    for (const c of annotations.connectors ?? []) ids.add(c.id);
    return ids;
  }, [annotations]);

  // ----- Scratch ink -----
  /**
   * Marks made *during* a lecture. They live outside the document: visible on
   * every step (never vanishing when the presenter steps back) and thrown away
   * on exit, so the saved deck is exactly what was authored.
   */
  const [scratch, setScratch] = useState<Annotations>(EMPTY_ANNOTATIONS);
  useEffect(() => {
    if (!presenting) setScratch(EMPTY_ANNOTATIONS);
  }, [presenting]);

  const hasScratch =
    scratch.strokes.length > 0 ||
    scratch.notes.length > 0 ||
    (scratch.boxes?.length ?? 0) > 0 ||
    (scratch.connectors?.length ?? 0) > 0;

  /** Drop a scratch mark by id, whichever layer it is on. */
  const eraseScratch = useCallback((id: string) => {
    setScratch((a) => ({
      strokes: a.strokes.filter((x) => x.id !== id),
      notes: a.notes.filter((x) => x.id !== id),
      boxes: (a.boxes ?? []).filter((x) => x.id !== id),
      connectors: (a.connectors ?? []).filter((x) => x.id !== id),
    }));
  }, []);

  // New annotations go to the document while authoring, to the ink while presenting.
  const putStroke = (stroke: Omit<Stroke, 'id'>) => {
    if (!presenting) return addStroke(stroke);
    setScratch((a) => ({ ...a, strokes: [...a.strokes, { ...stroke, id: makeId() }] }));
  };
  const putNote = (note: Omit<TextNote, 'id'>) => {
    if (!presenting) return addNote(note);
    setScratch((a) => ({ ...a, notes: [...a.notes, { ...note, id: makeId() }] }));
  };
  const putBox = (box: Omit<Box, 'id'>) => {
    if (!presenting) return addBox(box);
    setScratch((a) => ({ ...a, boxes: [...(a.boxes ?? []), { ...box, id: makeId() }] }));
  };
  const putConnector = (connector: Omit<Connector, 'id'>) => {
    if (!presenting) return addConnector(connector);
    setScratch((a) => ({
      ...a,
      connectors: [...(a.connectors ?? []), { ...connector, id: makeId() }],
    }));
  };

  //There are annotations if there is at least one stroke, note, box or connector
  const hasAnnotations =
  annotations.strokes.length > 0 ||
  annotations.notes.length > 0 ||
  (annotations.boxes?.length ?? 0) > 0 ||
  (annotations.connectors?.length ?? 0) > 0;

  // Expose svg element to the export module.
  useEffect(() => {
    canvasRef.svg = svgEl.current;
  });

  const fitToView = useCallback(() => {
    if (!layout || !wrapRef.current) return;
    const { clientWidth: cw, clientHeight: ch } = wrapRef.current;
    const scale = Math.min(cw / layout.width, ch / layout.height, 1.4);
    const tx = (cw - layout.width * scale) / 2;
    const ty = (ch - layout.height * scale) / 2;
    setView({ scale, tx, ty });
  }, [layout]);

  // Auto-fit when the tree structure changes from a non-text source.
  useEffect(() => {
    fitToView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treeRevision]);

  // Initial fit once layout is first available.
  useEffect(() => {
    if (layout) fitToView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout !== null]);

  // Entering/leaving presentation hides the side panels, so the canvas changes
  // size — refit on the frame after the grid has actually resized.
  useEffect(() => {
    const id = requestAnimationFrame(fitToView);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presenting]);

  /** Convert a pointer event to world (tree) coordinates. */
  const toWorld = (e: { clientX: number; clientY: number }) => {
    const rect = wrapRef.current!.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - view.tx) / view.scale,
      y: (e.clientY - rect.top - view.ty) / view.scale,
    };
  };

  /**
   * Forgiving one-click erase: find the closest erasable thing within a
   * tolerance of the click point (in world units) and remove it.
   */
  const eraseAt = (p: { x: number; y: number }): boolean => {
    const tol = 14 / view.scale;
    let best: { id: string; d: number; isNode: boolean; isScratch?: boolean } | null = null;
    const consider = (id: string, d: number, isNode = false, isScratch = false) => {
      if (d <= tol && (!best || d < best.d)) best = { id, d, isNode, isScratch };
    };

    for (const n of layout?.nodes ?? []) {
      // A locked canvas erases annotations only; unrevealed nodes aren't there yet.
      if (locked || isHidden(n)) continue;
      const b = nodeBox(n);
      const dx = Math.max(b.x - p.x, p.x - (b.x + b.w), 0);
      const dy = Math.max(b.y - p.y, p.y - (b.y + b.h), 0);
      consider(n.id, Math.hypot(dx, dy), true);
    }
    // Scratch ink erases like anything else — "let me rub that out" mid-lecture.
    for (const s of scratch.strokes) {
      let d = Infinity;
      if (s.points.length === 1) d = Math.hypot(p.x - s.points[0].x, p.y - s.points[0].y);
      for (let i = 1; i < s.points.length; i++) {
        d = Math.min(d, pointToSegment(p, s.points[i - 1], s.points[i]));
      }
      consider(s.id, d, false, true);
    }
    for (const n of scratch.notes) {
      const w = Math.max(20, n.text.length * 7.5);
      const dx = p.x < n.x ? n.x - p.x : Math.max(p.x - (n.x + w), 0);
      const dy = p.y < n.y - 14 ? n.y - 14 - p.y : Math.max(p.y - (n.y + 5), 0);
      consider(n.id, Math.hypot(dx, dy), false, true);
    }
    for (const b of scratch.boxes ?? []) {
      const dx = Math.max(b.x - p.x, p.x - (b.x + b.w), 0);
      const dy = Math.max(b.y - p.y, p.y - (b.y + b.h), 0);
      consider(b.id, Math.hypot(dx, dy), false, true);
    }
    for (const c of scratch.connectors ?? []) {
      consider(
        c.id,
        pointToSegment(p, { x: c.startX, y: c.startY }, { x: c.endX, y: c.endY }),
        false,
        true,
      );
    }
    for (const n of annotations.notes) {
      // Approximate text bbox: anchored at (x, y baseline), ~7.5px per char.
      const w = Math.max(20, n.text.length * 7.5);
      const dx = p.x < n.x ? n.x - p.x : Math.max(p.x - (n.x + w), 0);
      const dy = p.y < n.y - 14 ? n.y - 14 - p.y : Math.max(p.y - (n.y + 5), 0);
      consider(n.id, Math.hypot(dx, dy));
    }
    for (const s of annotations.strokes) {
      let d = Infinity;
      if (s.points.length === 1) d = Math.hypot(p.x - s.points[0].x, p.y - s.points[0].y);
      for (let i = 1; i < s.points.length; i++) {
        d = Math.min(d, pointToSegment(p, s.points[i - 1], s.points[i]));
      }
      consider(s.id, d);
    }
    for (const b of annotations.boxes ?? []) {
      const inside = p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
      let d: number;
      if (inside) {
        // Only the border region counts, so things inside the box stay erasable.
        d = Math.min(p.x - b.x, b.x + b.w - p.x, p.y - b.y, b.y + b.h - p.y);
      } else {
        const dx = Math.max(b.x - p.x, p.x - (b.x + b.w), 0);
        const dy = Math.max(b.y - p.y, p.y - (b.y + b.h), 0);
        d = Math.hypot(dx, dy);
      }
      consider(b.id, d);
    }
    for (const c of annotations.connectors ?? []) {
      consider(
        c.id,
        pointToSegment(p, { x: c.startX, y: c.startY }, { x: c.endX, y: c.endY }),
      );
    }

    if (!best) return false;
    const hit = best as { id: string; d: number; isNode: boolean; isScratch: boolean };
    if (hit.isScratch) eraseScratch(hit.id);
    else if (hit.isNode) deleteMultiple([hit.id]);
    else removeAnnotation(hit.id);
    return true;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    //Highlighter is allowed to start drawing
    if (tool === 'draw' || tool === 'highlight') {
      drawing.current = true; //records drawing has started
      liveStrokeRef.current = [toWorld(e)]; //stroke using the first coordinate
      setLiveStroke(liveStrokeRef.current);
      (e.target as Element).setPointerCapture?.(e.pointerId);
      return;
    }
    if (tool === 'box') {
      const p = toWorld(e);
      boxStart.current = p;
      liveBoxRef.current = { x: p.x, y: p.y, w: 0, h: 0 };
      setLiveBox(liveBoxRef.current);
      (e.target as Element).setPointerCapture?.(e.pointerId);
      return;
    }
    if (tool === 'arrow') {
      const p = toWorld(e);
      connectorStart.current = p;
      liveConnectorRef.current = { startX: p.x, startY: p.y, endX: p.x, endY: p.y };
      setLiveConnector(liveConnectorRef.current);
      (e.target as Element).setPointerCapture?.(e.pointerId);
      return;
    }
    if (tool === 'text') return;
    if (tool === 'erase') {
      eraseAt(toWorld(e));
      return;
    }
    // Locked: nodes don't consume the press, so dragging over one still pans.
    if (!locked && (e.target as Element).closest('.tnode-group')) return;
    select(null);
    setPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (noteDragStart.current) {
      const p = toWorld(e);
      const dx = p.x - noteDragStart.current.startX;
      const dy = p.y - noteDragStart.current.startY;
      updateNote(noteDragStart.current.id, {
        x: noteDragStart.current.initialX + dx,
        y: noteDragStart.current.initialY + dy,
      });
      return;
    }
    if (strokeDragStart.current) {
      const p = toWorld(e);
      const dx = p.x - strokeDragStart.current.startX;
      const dy = p.y - strokeDragStart.current.startY;
      moveStroke(strokeDragStart.current.id, dx, dy);
      strokeDragStart.current.startX = p.x;
      strokeDragStart.current.startY = p.y;
      return;
    }
    if (boxDragStart.current) {
      const p = toWorld(e);
      const dx = p.x - boxDragStart.current.startX;
      const dy = p.y - boxDragStart.current.startY;
      moveBox(boxDragStart.current.id, dx, dy);
      boxDragStart.current.startX = p.x;
      boxDragStart.current.startY = p.y;
      return;
    }
    if (connectorDragStart.current) {
      const p = toWorld(e);
      const dx = p.x - connectorDragStart.current.startX;
      const dy = p.y - connectorDragStart.current.startY;
      moveConnector(connectorDragStart.current.id, dx, dy);
      connectorDragStart.current.startX = p.x;
      connectorDragStart.current.startY = p.y;
      return;
    }
    //Adding that highlighter is allowed to continue drawing while pressed
    if ((tool === 'draw' || tool === 'highlight') && drawing.current) {
      const p = toWorld(e);
      liveStrokeRef.current = [...(liveStrokeRef.current ?? []), p];
      setLiveStroke(liveStrokeRef.current);
      return;
    }
    if (tool === 'box' && boxStart.current) {
      const p = toWorld(e);
      const x = Math.min(p.x, boxStart.current.x);
      const y = Math.min(p.y, boxStart.current.y);
      const w = Math.abs(p.x - boxStart.current.x);
      const h = Math.abs(p.y - boxStart.current.y);
      liveBoxRef.current = { x, y, w, h };
      setLiveBox(liveBoxRef.current);
      return;
    }
    if (tool === 'arrow' && connectorStart.current) {
      const p = toWorld(e);
      liveConnectorRef.current = liveConnectorRef.current
        ? { ...liveConnectorRef.current, endX: p.x, endY: p.y }
        : null;
      setLiveConnector(liveConnectorRef.current);
      return;
    }
    if (!panning || !panStart.current) return;
    setView((v) => ({
      ...v,
      tx: panStart.current!.tx + (e.clientX - panStart.current!.x),
      ty: panStart.current!.ty + (e.clientY - panStart.current!.y),
    }));
  };
  const onClick = (e: React.MouseEvent) => {
    if (tool === 'text') {
      if ((e.target as Element).closest('.tnode-group')) return;
      const p = toWorld(e);
      commitNote();
      setEditingNote({ id: null, x: p.x, y: p.y, value: '' });
    }
  };

  const onPointerUp = () => {
    if (noteDragStart.current) {
      noteDragStart.current = null;
      return;
    }
    if (strokeDragStart.current) {
      strokeDragStart.current = null;
      return;
    }
    if (boxDragStart.current) {
      boxDragStart.current = null;
      return;
    }
    if (connectorDragStart.current) {
      connectorDragStart.current = null;
      return;
    }
    // Commit live shapes OUTSIDE setState updaters: updaters must be pure
    // (StrictMode double-invokes them, which used to duplicate every shape).
    if (drawing.current) {
      drawing.current = false;
      const stroke = liveStrokeRef.current;
      liveStrokeRef.current = null;
      if (stroke && stroke.length > 1) {
        //Default values of the stroke. This is a ternary expression that just startes that if tool is a highlight, set it to 14. Otherwise, make it 2.
        putStroke({ points: stroke, color: strokeColor, width: tool === 'highlight'? 14: 2, opacity: tool === 'highlight'? 0.3: 1 });
      }
      setLiveStroke(null);
    }
    if (boxStart.current) {
      boxStart.current = null;
      const box = liveBoxRef.current;
      liveBoxRef.current = null;
      if (box && box.w > 4 && box.h > 4) {
        putBox({ ...box, color: strokeColor });
      }
      setLiveBox(null);
    }
    if (connectorStart.current) {
      connectorStart.current = null;
      const conn = liveConnectorRef.current;
      liveConnectorRef.current = null;
      if (conn && Math.hypot(conn.endX - conn.startX, conn.endY - conn.startY) > 6) {
        putConnector({ ...conn, color: strokeColor });
      }
      setLiveConnector(null);
    }
    setPanning(false);
    panStart.current = null;
  };

  // ----- Zoom (wheel, anchored at cursor) -----
  const onWheel = (e: React.WheelEvent) => {
    if (!wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    setView((v) => {
      const scale = Math.min(Math.max(v.scale * factor, 0.2), 3);
      const k = scale / v.scale;
      return { scale, tx: mx - (mx - v.tx) * k, ty: my - (my - v.ty) * k };
    });
  };

  const zoomBy = (factor: number) =>
    setView((v) => ({ ...v, scale: Math.min(Math.max(v.scale * factor, 0.2), 3) }));

  const getElementCenter = useCallback((id: string) => {
    if (layout) {
      const node = layout.nodes.find((n) => n.id === id);
      if (node) return { x: node.x, y: node.y };
    }
    const note = annotations.notes.find((n) => n.id === id);
    if (note) return { x: note.x, y: note.y };
    const box = (annotations.boxes || []).find((b) => b.id === id);
    if (box) return { x: box.x + box.w / 2, y: box.y + box.h / 2 };
    const stroke = annotations.strokes.find((s) => s.id === id);
    if (stroke && stroke.points.length > 0) {
      let xs = 0, ys = 0;
      for (const p of stroke.points) {
        xs += p.x;
        ys += p.y;
      }
      return { x: xs / stroke.points.length, y: ys / stroke.points.length };
    }
    return null;
  }, [layout, annotations]);

  const connectSelected = useCallback(() => {
    if (selectedIds.length !== 2) return;
    const p1 = getElementCenter(selectedIds[0]);
    const p2 = getElementCenter(selectedIds[1]);
    if (p1 && p2) {
      putConnector({
        startX: p1.x,
        startY: p1.y,
        endX: p2.x,
        endY: p2.y,
        color: strokeColor,
      });
      select(null);
    }
    // `presenting` decides whether the arrow is scratch ink or part of the deck.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, getElementCenter, addConnector, strokeColor, select, presenting]);

  // ----- Keyboard: Delete selected, Ctrl+Z / Ctrl+Y undo/redo -----
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA';
      if ((e.ctrlKey || e.metaKey) && !typing) {
        const key = e.key.toLowerCase();
        if (key === 'z') {
          e.preventDefault();
          if (e.shiftKey) redo();
          else undo();
          return;
        }
        if (key === 'y') {
          e.preventDefault();
          redo();
          return;
        }
      }
      if (e.key === 'Escape') {
        select(null);
      }
      if (editing || editingNote || typing) return;
      if (e.key.toLowerCase() === 'c' && selectedIds.length === 2) {
        e.preventDefault();
        connectSelected();
        return;
      }
      if (e.key === 'Enter' && selectedId) {
        const selectedNote = annotations.notes.find((n) => n.id === selectedId);
        if (selectedNote) {
          e.preventDefault();
          setEditingNote({ id: selectedNote.id, x: selectedNote.x, y: selectedNote.y, value: selectedNote.text });
          return;
        }
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
        // Locked: annotations are still the presenter's to erase, nodes are not.
        const targets = locked ? selectedIds.filter((id) => annotationIds.has(id)) : selectedIds;
        if (targets.length === 0) return;
        e.preventDefault();
        deleteMultiple(targets);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editing, editingNote, selectedId, selectedIds, deleteMultiple, undo, redo, annotations, removeAnnotation, select, connectSelected, locked, annotationIds]);

  const beginEdit = (n: PositionedNode) => {
    setEditing({ id: n.id, value: n.label });
  };
  const commitEdit = () => {
    if (editing) {
      const v = editing.value.trim();
      if (v) renameNode(editing.id, v);
    }
    setEditing(null);
  };

  const activeNoteRef = useRef<typeof editingNote>(null);
  useEffect(() => {
    activeNoteRef.current = editingNote;
  }, [editingNote]);

  const commitNote = () => {
    const currentNote = activeNoteRef.current;
    if (!currentNote) return;
    activeNoteRef.current = null; // Prevent double commit immediately

    const text = currentNote.value.trim();
    if (currentNote.id) {
      updateNote(currentNote.id, { text });
    } else if (text) {
      putNote({ x: currentNote.x, y: currentNote.y, text, color: strokeColor });
    }
    setEditingNote(null);
  };

  // ----- Drag-and-drop preset / symbol / feature onto a node -----
  const onNodeDragOver = (e: React.DragEvent, id: string) => {
    if (locked) return;
    if (
      e.dataTransfer.types.includes('application/x-preset') ||
      e.dataTransfer.types.includes('application/x-symbol') ||
      e.dataTransfer.types.includes(FEATURE_DND_TYPE)
    ) {
      e.preventDefault();
      setDropTarget(id);
    }
  };
  const onNodeDrop = (e: React.DragEvent, id: string) => {
    if (locked) return;
    // Features first: a symbol drop falls back to text/plain, so checking in
    // the other order would rename the node instead of tagging it.
    const rawFeature = e.dataTransfer.getData(FEATURE_DND_TYPE);
    const rawPreset = e.dataTransfer.getData('application/x-preset');
    const rawSymbol = e.dataTransfer.getData('application/x-symbol') || e.dataTransfer.getData('text/plain');
    setDropTarget(null);
    e.preventDefault();
    if (rawFeature) {
      if (addNodeFeature(id, rawFeature)) toast(`Added [${rawFeature}]`, 'success');
      else toast(`Already tagged [${rawFeature}]`, 'info');
    } else if (rawPreset) {
      try {
        const preset = JSON.parse(rawPreset);
        attachPreset(id, preset);
      } catch {
        /* ignore malformed payload */
      }
    } else if (rawSymbol) {
      renameNode(id, rawSymbol);
    }
  };

  const toScreen = (x: number, y: number) => ({
    left: x * view.scale + view.tx,
    top: y * view.scale + view.ty,
  });

  const eraserCursor = `url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNmODcxNzEiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMjAgMjBIN0wzIDE2QzIgMTUgMiAxMyAzIDEyTDEyIDNDMTMgMiAxNSAyIDE2IDNMMjEgOEMyMiA5IDIyIDExIDIxIDEyTDE2IDE3TDIwIDIwWiIvPjxsaW5lIHgxPSIxMiIgeTE9IjExIiB4Mj0iMTYiIHkyPSIxNSIvPjwvc3ZnPg==") 4 16, default`;
  const highlighterCursor =
  'url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2224%22 viewBox=%220 0 24 24%22%3E%3Cpath d=%22M9 2l12 5-6 14-12-5z%22 fill=%22none%22 stroke=%22%23000%22 stroke-width=%221.5%22 stroke-linejoin=%22round%22/%3E%3Cpath d=%22M3 16l12 5%22 stroke=%22%23000%22 stroke-width=%222%22 stroke-linecap=%22round%22/%3E%3C/svg%3E") 9 19, crosshair';

  const cursorFor: Record<Tool, string> = {
    select: panning || noteDragStart.current || strokeDragStart.current || boxDragStart.current || connectorDragStart.current ? 'grabbing' : 'grab',
    draw: 'crosshair',
    highlight: highlighterCursor, //when the tool is highlight, the cursor is the customized highlighterCursor
    text: 'text',
    erase: eraserCursor,
    box: 'crosshair',
    arrow: 'crosshair',
  };

  const toolButton = (t: Tool, icon: JSX.Element, title: string) => (
    <button
      className={`btn icon ghost${tool === t ? ' active' : ''}${t === 'erase' ? ' eraser-btn' : ''}`}
      title={title}
      aria-pressed={tool === t}
      onClick={() => setTool(t)}
    >
      {icon}
    </button>
  );

  return (
    <div
      className="canvas-wrap"
      ref={wrapRef}
      onDragOver={(e) => {
        // Allow dropping on empty canvas to seed/attach to root.
        if (locked) return;
        if (
          e.dataTransfer.types.includes('application/x-preset') ||
          e.dataTransfer.types.includes('application/x-symbol') ||
          e.dataTransfer.types.includes(FEATURE_DND_TYPE)
        ) {
          e.preventDefault();
        }
      }}
      onDrop={(e) => {
        if (locked || dropTarget) return;
        const rawFeature = e.dataTransfer.getData(FEATURE_DND_TYPE);
        const rawPreset = e.dataTransfer.getData('application/x-preset');
        const rawSymbol = e.dataTransfer.getData('application/x-symbol') || e.dataTransfer.getData('text/plain');
        e.preventDefault();

        // A feature has to land on a node — there is nothing to attach it to
        // out here, and silently dropping it would look like a bug.
        if (rawFeature) {
          toast('Drop a feature tag onto a node to attach it.', 'info');
          return;
        }

        if (rawPreset) {
          if (tree) {
            try {
              attachPreset(tree.id, JSON.parse(rawPreset));
            } catch {}
          } else {
            try {
              attachPreset('', JSON.parse(rawPreset));
            } catch {}
          }
        } else if (rawSymbol) {
          if (!tree) {
            replaceTree({ id: makeId(), label: rawSymbol, children: [] });
          } else {
            const p = toWorld(e);
            addNote({ x: p.x, y: p.y, text: rawSymbol, color: 'var(--accent)' });
          }
        }
      }}
    >
      <svg
        ref={svgEl}
        className={`canvas-svg tool-${tool}${locked ? ' locked' : ''}`}
        style={{ cursor: cursorFor[tool] }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={onWheel}
        onClick={onClick}
        xmlns="http://www.w3.org/2000/svg"
      >
        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.scale})`}>
          {layout?.edges.map((edge) => {
            const parent = nodeById.get(edge.parentId);
            const child = nodeById.get(edge.childId);
            if (!parent || !child) return null;
            // Branch thickness lives on the CHILD: it describes the branch
            // running down into that node, which is what selecting it implies.
            const width = effectiveStyle(child.style, child.isLeaf).branchWidth;
            return (
              <line
                key={`${edge.parentId}-${edge.childId}`}
                // A branch belongs to the child it leads down to, so it appears
                // exactly when that child does.
                className={`connector${isHidden(child) ? ' unrevealed' : ''}`}
                x1={edge.from.x}
                y1={edgeStartY(parent)}
                x2={edge.to.x}
                y2={edgeEndY(child)}
                // Inline, not a strokeWidth attribute: `.connector` sets
                // stroke-width in CSS, and any rule outranks a presentation
                // attribute — the branch would always render at 1.5.
                style={{ strokeWidth: width }}
              />
            );
          })}
          {layout?.nodes.map((n) => {
            const selected = selectedIds.includes(n.id) && !locked;
            const isDrop = n.id === dropTarget;
            const box = nodeBox(n);
            const tagColor = nodeTagColor(n.features);
            const hidden = isHidden(n);
            return (
              <g
                key={n.id}
                className={`tnode-group${tool === 'erase' && !locked ? ' erasable' : ''}${
                  hidden ? ' unrevealed' : ''
                }${tagColor ? ' tagged' : ''}`}
                // Drives the label fill and the outline stroke from CSS rather
                // than an inline fill, so :hover still wins the cascade.
                // .unrevealed hides via opacity on the group, so tagging a
                // hidden node cannot make it visible.
                style={tagColor ? ({ '--tag-color': tagColor } as React.CSSProperties) : undefined}
                onPointerDown={(e) => {
                  if (locked) return; // structure is read-only; let the canvas pan
                  if (tool === 'erase') {
                    e.stopPropagation();
                    deleteMultiple([n.id]);
                    return;
                  }
                  if (tool !== 'select') return;
                  e.stopPropagation();
                  select(n.id, e.ctrlKey || e.metaKey);
                }}
                onDoubleClick={(e) => {
                  if (locked || tool !== 'select') return;
                  e.stopPropagation();
                  beginEdit(n);
                }}
                // HTML5 DnD drop target
                onDragOver={(e) => onNodeDragOver(e, n.id)}
                onDragLeave={() => setDropTarget((d) => (d === n.id ? null : d))}
                onDrop={(e) => onNodeDrop(e, n.id)}
              >
                {/* Sits outside the selection box rather than under it, so a
                    tagged node still shows its tag colour while selected.
                    box.h already includes the feature lines (see nodeBox), so
                    the outline encloses the tags too. */}
                {tagColor && (
                  <rect
                    className="tnode-tag-outline"
                    x={box.x - 3}
                    y={box.y - 3}
                    width={box.w + 6}
                    height={box.h + 6}
                    rx={8}
                  />
                )}
                {(selected || isDrop) && (
                  <rect
                    className={isDrop ? 'drop-indicator' : 'tnode-box'}
                    x={box.x}
                    y={box.y}
                    width={box.w}
                    height={box.h}
                    rx={6}
                  />
                )}
                <rect
                  className="tnode-hit"
                  x={box.x}
                  y={box.y}
                  width={box.w}
                  height={box.h}
                />
                <text
                  className={`tnode-label${n.isLeaf ? ' leaf' : ''}`}
                  style={labelStyle(n)}
                  x={n.x}
                  y={n.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {n.label}
                </text>
                {(n.features ?? []).map((f, i) => (
                  <text
                    key={`${n.id}-f${i}`}
                    className="tnode-feature"
                    x={n.x}
                    y={featureLineY(n, i)}
                    fontSize={FEATURE_FONT_SIZE}
                    textAnchor="middle"
                    dominantBaseline="hanging"
                    // Inline style, not a fill attribute: `.tnode-feature` sets
                    // fill in CSS and any rule outranks a presentation
                    // attribute, which is what left every tag rendering
                    // --text-dim grey on canvas while exports came out right.
                    // Per-tag rather than the group's --tag-color, so a node
                    // carrying [+CASE] and [+past] shows red then blue.
                    style={{ fill: featureColor(f) }}
                  >
                    [{f}]
                  </text>
                ))}
              </g>
            );
          })}

          {/* ----- Annotation layer: freehand strokes ----- */}
          {annotations.strokes.map((s) => {
            const selected = selectedIds.includes(s.id);
            return (
              <g
                key={s.id}
                className={`ann-group${tool === 'erase' ? ' erasable-group' : ''}${isAnnotationHidden(s) ? ' unrevealed' : ''}`}
              >
                {/* Thick transparent polyline for easier hit testing */}
                <polyline
                  points={s.points.map((p) => `${p.x},${p.y}`).join(' ')}
                  stroke="transparent"
                  strokeWidth={16}
                  fill="none"
                  style={{ cursor: tool === 'select' ? 'grab' : tool === 'erase' ? 'inherit' : 'default' }}
                  onPointerDown={(e) => {
                    if (tool === 'erase') {
                      e.stopPropagation();
                      removeAnnotation(s.id);
                      return;
                    }
                    if (tool === 'select') {
                      e.stopPropagation();
                      select(s.id, e.ctrlKey || e.metaKey);
                      const p = toWorld(e);
                      strokeDragStart.current = {
                        id: s.id,
                        startX: p.x,
                        startY: p.y,
                      };
                      (e.target as Element).setPointerCapture?.(e.pointerId);
                    }
                  }}
                />
                {/* Visual polyline */}
                <polyline
                  className={`stroke${tool === 'erase' ? ' erasable' : ''}${tool === 'select' ? ' selectable' : ''}${selected ? ' selected' : ''}`}
                  points={s.points.map((p) => `${p.x},${p.y}`).join(' ')}
                  stroke={s.color}
                  strokeWidth={s.width}
                  strokeOpacity={s.opacity ?? 1} // Use s.opacity if it exists. Otherwise, use 1 which represents solid color
                  fill="none"
                  pointerEvents="none"
                />
              </g>
            );
          })}
          {liveStroke && (
            <polyline
              className="stroke"
              points={liveStroke.map((p) => `${p.x},${p.y}`).join(' ')}
              stroke={strokeColor}
              strokeWidth={tool === 'highlight' ? 14: 2}
              strokeOpacity={tool === 'highlight' ? 0.3:1}
              strokeLinecap="round" //SVG attributes of the stroke being round
              strokeLinejoin="round"
            />
          )}

          {/* ----- Annotation layer: text notes ----- */}
          {annotations.notes.map((n) =>
            editingNote?.id === n.id ? null : (
              <text
                key={n.id}
                className={`note${tool === 'erase' ? ' erasable' : ''}${selectedIds.includes(n.id) ? ' selected' : ''}${isAnnotationHidden(n) ? ' unrevealed' : ''}`}
                style={{ fill: n.color || 'var(--accent)' }}
                x={n.x}
                y={n.y}
                onPointerDown={(e) => {
                  if (tool === 'erase') {
                    e.stopPropagation();
                    removeAnnotation(n.id);
                    return;
                  }
                  if (tool === 'select') {
                    e.stopPropagation();
                    select(n.id, e.ctrlKey || e.metaKey);
                    const p = toWorld(e);
                    noteDragStart.current = {
                      id: n.id,
                      startX: p.x,
                      startY: p.y,
                      initialX: n.x,
                      initialY: n.y,
                    };
                    (e.target as Element).setPointerCapture?.(e.pointerId);
                  }
                }}
                onDoubleClick={(e) => {
                  if (tool !== 'select') return;
                  e.stopPropagation();
                  setEditingNote({ id: n.id, x: n.x, y: n.y, value: n.text });
                }}
              >
                {n.text}
              </text>
            ),
          )}

          {/* ----- Annotation layer: boxes ----- */}
          {(annotations.boxes || []).map((b) => (
            <rect
              key={b.id}
              className={`box-annotation${tool === 'erase' ? ' erasable' : ''}${tool === 'select' ? ' selectable' : ''}${selectedIds.includes(b.id) ? ' selected' : ''}${isAnnotationHidden(b) ? ' unrevealed' : ''}`}
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              fill="none"
              stroke={b.color}
              strokeWidth={2}
              strokeDasharray="4 3"
              rx={4}
              onPointerDown={(e) => {
                if (tool === 'erase') {
                  e.stopPropagation();
                  removeAnnotation(b.id);
                  return;
                }
                if (tool === 'select') {
                  e.stopPropagation();
                  select(b.id, e.ctrlKey || e.metaKey);
                  const p = toWorld(e);
                  boxDragStart.current = {
                    id: b.id,
                    startX: p.x,
                    startY: p.y,
                  };
                  (e.target as Element).setPointerCapture?.(e.pointerId);
                }
              }}
            />
          ))}
          {liveBox && (
            <rect
              className="box-annotation"
              x={liveBox.x}
              y={liveBox.y}
              width={liveBox.w}
              height={liveBox.h}
              fill="none"
              stroke={strokeColor}
              strokeWidth={2}
              strokeDasharray="4 3"
              rx={4}
            />
          )}

          {/* ----- Annotation layer: connectors (arrows) ----- */}
          {(annotations.connectors || []).map((c) => {
            const arrowPath = arrowHeadPath(c);
            const selected = selectedIds.includes(c.id);

            return (
              <g
                key={c.id}
                className={`ann-group${tool === 'erase' ? ' erasable-group' : ''}${isAnnotationHidden(c) ? ' unrevealed' : ''}`}
                onPointerDown={(e) => {
                  if (tool === 'erase') {
                    e.stopPropagation();
                    removeAnnotation(c.id);
                    return;
                  }
                  if (tool === 'select') {
                    e.stopPropagation();
                    select(c.id, e.ctrlKey || e.metaKey);
                    const p = toWorld(e);
                    connectorDragStart.current = {
                      id: c.id,
                      startX: p.x,
                      startY: p.y,
                    };
                    (e.target as Element).setPointerCapture?.(e.pointerId);
                  }
                }}
              >
                {/* Thick invisible line for easier selection */}
                <line
                  x1={c.startX}
                  y1={c.startY}
                  x2={c.endX}
                  y2={c.endY}
                  stroke="transparent"
                  strokeWidth={12}
                  style={{ cursor: tool === 'select' ? 'grab' : tool === 'erase' ? 'inherit' : 'default' }}
                />
                <line
                  className={`connector-line${selected ? ' selected' : ''}`}
                  x1={c.startX}
                  y1={c.startY}
                  x2={c.endX}
                  y2={c.endY}
                  stroke={c.color}
                  strokeWidth={2}
                />
                <path
                  className={`connector-arrow${selected ? ' selected' : ''}`}
                  d={arrowPath}
                  fill="none"
                  stroke={c.color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            );
          })}
          {liveConnector && (
            <g>
              <line
                x1={liveConnector.startX}
                y1={liveConnector.startY}
                x2={liveConnector.endX}
                y2={liveConnector.endY}
                stroke={strokeColor}
                strokeWidth={2}
              />
              <path
                d={arrowHeadPath(liveConnector)}
                fill="none"
                stroke={strokeColor}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          )}

          {/* ----- Scratch ink: drawn during the lecture, never saved ----- */}
          {hasScratch && (
            <g className="scratch-layer">
              {scratch.strokes.map((s) => (
                <polyline
                  key={s.id}
                  className={`stroke${tool === 'erase' ? ' erasable' : ''}`}
                  points={s.points.map((p) => `${p.x},${p.y}`).join(' ')}
                  stroke={s.color}
                  strokeWidth={s.width}
                  strokeOpacity={s.opacity ?? 1}
                  fill="none"
                  onPointerDown={(e) => {
                    if (tool !== 'erase') return;
                    e.stopPropagation();
                    eraseScratch(s.id);
                  }}
                />
              ))}
              {scratch.notes.map((n) => (
                <text
                  key={n.id}
                  className={`note${tool === 'erase' ? ' erasable' : ''}`}
                  style={{ fill: n.color || 'var(--accent)' }}
                  x={n.x}
                  y={n.y}
                  onPointerDown={(e) => {
                    if (tool !== 'erase') return;
                    e.stopPropagation();
                    eraseScratch(n.id);
                  }}
                >
                  {n.text}
                </text>
              ))}
              {(scratch.boxes ?? []).map((b) => (
                <rect
                  key={b.id}
                  className={`box-annotation${tool === 'erase' ? ' erasable' : ''}`}
                  x={b.x}
                  y={b.y}
                  width={b.w}
                  height={b.h}
                  fill="none"
                  stroke={b.color}
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  rx={4}
                  onPointerDown={(e) => {
                    if (tool !== 'erase') return;
                    e.stopPropagation();
                    eraseScratch(b.id);
                  }}
                />
              ))}
              {(scratch.connectors ?? []).map((c) => (
                <g
                  key={c.id}
                  className={tool === 'erase' ? 'erasable-group' : ''}
                  onPointerDown={(e) => {
                    if (tool !== 'erase') return;
                    e.stopPropagation();
                    eraseScratch(c.id);
                  }}
                >
                  <line
                    className="connector-line"
                    x1={c.startX}
                    y1={c.startY}
                    x2={c.endX}
                    y2={c.endY}
                    stroke={c.color}
                    strokeWidth={2}
                  />
                  <path
                    className="connector-arrow"
                    d={arrowHeadPath(c)}
                    fill="none"
                    stroke={c.color}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              ))}
            </g>
          )}
        </g>
      </svg>

      {!presenting &&
        !tree &&
        annotations.strokes.length === 0 &&
        annotations.notes.length === 0 &&
        (!annotations.boxes || annotations.boxes.length === 0) &&
        (!annotations.connectors || annotations.connectors.length === 0) && (
        <div className="canvas-empty">
          <TreeLogo style={{ width: 40, height: 40, opacity: 0.5 }} />
          <div>Your canvas is empty.</div>
          <div style={{ fontSize: 12 }}>
            Paste bracket notation, drag a node, or pick a template to begin.
          </div>
        </div>
      )}

      {editing &&
        (() => {
          const n = layout?.nodes.find((x) => x.id === editing.id);
          if (!n) return null;
          const pos = toScreen(n.x, n.y);
          const st = effectiveStyle(n.style, n.isLeaf);
          return (
            <input
              className="inline-edit"
              style={{
                left: pos.left,
                top: pos.top,
                // Match the node so the label doesn't jump when editing starts.
                fontFamily: FONT_STACKS[st.font],
                fontSize: `${st.fontSize * view.scale}px`,
                fontWeight: st.fontWeight,
                fontStyle: st.italic ? 'italic' : 'normal',
              }}
              autoFocus
              value={editing.value}
              onChange={(e) => setEditing({ id: editing.id, value: e.target.value })}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEdit();
                if (e.key === 'Escape') setEditing(null);
              }}
            />
          );
        })()}

      {editingNote &&
        (() => {
          const pos = toScreen(editingNote.x, editingNote.y);
          return (
            <input
              className="inline-edit note-edit"
              style={{
                left: pos.left,
                top: pos.top,
                color: editingNote.id
                  ? (annotations.notes.find((x) => x.id === editingNote.id)?.color || 'var(--accent)')
                  : strokeColor,
              }}
              autoFocus
              placeholder="Type a note…"
              value={editingNote.value}
              onChange={(e) => setEditingNote({ ...editingNote, value: e.target.value })}
              onBlur={commitNote}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitNote();
                if (e.key === 'Escape') {
                  activeNoteRef.current = null;
                  setEditingNote(null);
                }
              }}
            />
          );
        })()}

      {/* Tool palette: top-left of the canvas */}
      <div className="canvas-toolbar tools">
        {toolButton('select', <CursorIcon />, 'Select / pan (drag canvas, double-click to rename)')}
        {appMode === 'instructor' && toolButton('draw', <PenIcon />, 'Draw freehand')}
        {toolButton('highlight', <HighlighterIcon />, 'Highlight')}
        {toolButton('text', <TextIcon />, 'Add text note (click on canvas)')}
        {appMode === 'instructor' && toolButton('arrow', <ArrowIcon />, 'Draw connector arrow between elements')}
        {appMode === 'instructor' && toolButton('box', <BoxIcon />, 'Draw box around elements')}
        {toolButton('erase', <EraserIcon />, 'Eraser (click a drawing, note, box, or arrow)')}

        {(tool === 'draw' || tool === 'highlight' || tool === 'text' || tool === 'box' || tool === 'arrow') && (
          <>
            <span className="toolbar-divider" />
            <div className="color-picker">
              {PEN_COLORS.map((c) => (
                <button
                  type="button"
                  key={c.value}
                  className={`color-dot${strokeColor === c.value ? ' active' : ''}`}
                  style={{ backgroundColor: c.value === 'var(--text)' ? 'var(--text)' : c.value }}
                  title={c.name}
                  aria-label={`Use ${c.name.toLowerCase()}`}
                  onClick={() => setStrokeColor(c.value)}
                />
              ))}
              {(tool === 'draw' || tool === 'highlight') && (
                <label
                  className={`color-wheel${strokeColor === customStrokeColor ? ' active' : ''}`}
                  style={{ '--selected-color': customStrokeColor } as React.CSSProperties}
                  title="Choose a custom color"
                >
                  <input
                    type="color"
                    value={customStrokeColor}
                    aria-label={`Choose ${tool === 'draw' ? 'pen' : 'highlighter'} color`}
                    onChange={(e) => {
                      setCustomStrokeColor(e.target.value);
                      setStrokeColor(e.target.value);
                    }}
                  />
                </label>
              )}
            </div>
          </>
        )}

        <span className="toolbar-divider" />
        <button className="btn icon ghost" title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={undo}>
          <UndoIcon />
        </button>
        <button className="btn icon ghost" title="Redo (Ctrl+Y)" disabled={!canRedo} onClick={redo}>
          <RedoIcon />
        </button>
      {(presenting ? hasScratch : hasAnnotations) && (
        <>
        <span className="toolbar-divider" />
        <button
          className="btn icon ghost"
          title={presenting ? 'Clear the ink drawn during this lecture' : 'Clear annotations without changing the tree'}
          aria-label={presenting ? 'Clear ink' : 'Clear annotations'}
          onClick={() => {
            // Presenting: the deck's own annotations are not the presenter's to
            // wipe — only the ink drawn just now.
            if (presenting) {
              setScratch(EMPTY_ANNOTATIONS);
              return;
            }
            const confirmed = window.confirm(
            'Clear all annotations? Your syntax tree will not be changed.',
          );
          if (confirmed) {
            clearAnnotations();
          }
        }}
        >
        <ClearAnnotationsIcon />
        </button>
        </>
      )}
        {!locked && (annotations.notes.length > 0 || annotations.strokes.length > 0) && (
          <>
            <span className="toolbar-divider" />
            <button
              className="btn primary render-drawing"
              disabled={recognizing}
              title={`Convert your drawing into a tree: labels (typed notes or handwriting) become nodes, arrows and straight lines become branches (parent above, child below).${tree ? ' Replaces the tree you already have — you will be asked first.' : ''}`}
              onClick={async () => {
                const ann = useTreeStore.getState().annotations;
                try {
                  let result;
                  if (ann.notes.length > 0) {
                    // Typed labels: fast geometric inference.
                    result = drawingToTree(ann);
                  } else {
                    // Handwritten labels: OCR the pen strokes first.
                    setRecognizing(true);
                    toast('Reading your handwriting…', 'info');
                    result = await sketchToTree(ann);
                  }
                  if (!result.tree) {
                    toast('No labels found — write or type node labels first.', 'error');
                    return;
                  }
                  // Recognition REPLACES the tree. Say so before overwriting one:
                  // highlighting an existing tree and clicking this would
                  // otherwise silently swap it for whatever the strokes implied.
                  if (
                    tree &&
                    !window.confirm(
                      `Replace your current tree ("${tree.label}" and everything under it) with the drawn one?`,
                    )
                  ) {
                    return;
                  }
                  applyDrawingResult(result.tree, result.usedIds);
                  toast(
                    result.warnings[0] ?? 'Drawing rendered as a tree — undo with Ctrl+Z.',
                    result.warnings.length > 0 ? 'info' : 'success',
                  );
                } catch {
                  toast('Recognition failed — try the Text tool for labels.', 'error');
                } finally {
                  setRecognizing(false);
                }
              }}
            >
              <TreeLogo style={{ width: 14, height: 14 }} />
              {recognizing ? 'Recognizing…' : 'Render Drawing'}
            </button>
          </>
        )}
      </div>

      {/* Zoom controls: bottom-centre */}
      <div className="canvas-toolbar">
        <button className="btn icon ghost" title="Zoom out" onClick={() => zoomBy(1 / 1.2)}>
          <MinusIcon />
        </button>
        <button className="btn icon ghost" title="Fit to view" onClick={fitToView}>
          <FitIcon />
        </button>
        <button className="btn icon ghost" title="Zoom in" onClick={() => zoomBy(1.2)}>
          <PlusIcon />
        </button>
      </div>

      {/* Selection helper floating toolbar */}
      {selectedIds.length === 2 && (() => {
        const getElementLabel = (id: string) => {
          if (layout) {
            const node = layout.nodes.find((n) => n.id === id);
            if (node) return node.label;
          }
          const note = annotations.notes.find((n) => n.id === id);
          if (note) {
            const textVal = note.text.trim();
            return `"${textVal.slice(0, 10)}${textVal.length > 10 ? '...' : ''}"`;
          }
          const box = (annotations.boxes || []).find((b) => b.id === id);
          if (box) return 'Box';
          const stroke = annotations.strokes.find((s) => s.id === id);
          if (stroke) return 'Drawing';
          const connector = (annotations.connectors || []).find((c) => c.id === id);
          if (connector) return 'Arrow';
          return 'Element';
        };

        const label1 = getElementLabel(selectedIds[0]);
        const label2 = getElementLabel(selectedIds[1]);

        const swapSelectedDirection = () => {
          useTreeStore.setState({
            selectedIds: [selectedIds[1], selectedIds[0]],
            selectedId: selectedIds[0],
          });
        };

        return (
          <div className="selection-helper-floating">
            <div className="selection-helper-text">
              Connect <strong>{label1}</strong> &rarr; <strong>{label2}</strong>
            </div>
            <div className="selection-helper-actions">
              <button
                className="btn ghost"
                onClick={swapSelectedDirection}
                style={{ padding: '4px 8px', fontSize: '12px' }}
                title="Swap arrow direction"
              >
                &larr;&rarr; Swap
              </button>
              <button
                className="btn primary"
                onClick={connectSelected}
                style={{ padding: '4px 10px', fontSize: '12px' }}
                title="Connect selected elements with an arrow (C)"
              >
                <ArrowIcon /> Connect
              </button>
              <button
                className="btn ghost danger"
                onClick={() => select(null)}
                style={{ padding: '4px 8px', fontSize: '12px' }}
                title="Cancel selection"
              >
                Cancel
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
