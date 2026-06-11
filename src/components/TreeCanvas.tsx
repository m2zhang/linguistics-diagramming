import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { layoutTree, PositionedNode } from '../model/layout';
import { useTreeStore } from '../store/treeStore';
import { useUiStore } from '../store/uiStore';
import { drawingToTree, pointToSegment } from '../model/drawingToTree';
import { sketchToTree } from '../vision/sketchToTree';
import { makeId } from '../model/types';
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

type Tool = 'select' | 'draw' | 'text' | 'erase' | 'box' | 'arrow';

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

const NODE_W = 54;
const NODE_H = 26;

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
  const applyDrawingResult = useTreeStore((s) => s.applyDrawingResult);
  const [recognizing, setRecognizing] = useState(false);
  const undo = useTreeStore((s) => s.undo);
  const redo = useTreeStore((s) => s.redo);
  const toast = useUiStore((s) => s.toast);

  const wrapRef = useRef<HTMLDivElement>(null);
  const svgEl = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<ViewState>({ scale: 1, tx: 0, ty: 0 });
  const [tool, setTool] = useState<Tool>('select');
  const [strokeColor, setStrokeColor] = useState('var(--danger)');
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
    let best: { id: string; d: number; isNode: boolean } | null = null;
    const consider = (id: string, d: number, isNode = false) => {
      if (d <= tol && (!best || d < best.d)) best = { id, d, isNode };
    };

    for (const n of layout?.nodes ?? []) {
      const dx = Math.max(Math.abs(p.x - n.x) - NODE_W / 2, 0);
      const dy = Math.max(Math.abs(p.y - n.y) - NODE_H / 2, 0);
      consider(n.id, Math.hypot(dx, dy), true);
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
    const hit = best as { id: string; d: number; isNode: boolean };
    if (hit.isNode) deleteMultiple([hit.id]);
    else removeAnnotation(hit.id);
    return true;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (tool === 'draw') {
      drawing.current = true;
      liveStrokeRef.current = [toWorld(e)];
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
    if ((e.target as Element).closest('.tnode-group')) return;
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
    if (tool === 'draw' && drawing.current) {
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
        addStroke({ points: stroke, color: strokeColor, width: 2 });
      }
      setLiveStroke(null);
    }
    if (boxStart.current) {
      boxStart.current = null;
      const box = liveBoxRef.current;
      liveBoxRef.current = null;
      if (box && box.w > 4 && box.h > 4) {
        addBox({ ...box, color: strokeColor });
      }
      setLiveBox(null);
    }
    if (connectorStart.current) {
      connectorStart.current = null;
      const conn = liveConnectorRef.current;
      liveConnectorRef.current = null;
      if (conn && Math.hypot(conn.endX - conn.startX, conn.endY - conn.startY) > 6) {
        addConnector({ ...conn, color: strokeColor });
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
      addConnector({
        startX: p1.x,
        startY: p1.y,
        endX: p2.x,
        endY: p2.y,
        color: strokeColor,
      });
      select(null);
    }
  }, [selectedIds, getElementCenter, addConnector, strokeColor, select]);

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
        e.preventDefault();
        deleteMultiple(selectedIds);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editing, editingNote, selectedId, selectedIds, deleteMultiple, undo, redo, annotations, removeAnnotation, select, connectSelected]);

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
      addNote({ x: currentNote.x, y: currentNote.y, text, color: strokeColor });
    }
    setEditingNote(null);
  };

  // ----- Drag-and-drop preset onto a node -----
  const onNodeDragOver = (e: React.DragEvent, id: string) => {
    if (
      e.dataTransfer.types.includes('application/x-preset') ||
      e.dataTransfer.types.includes('application/x-symbol')
    ) {
      e.preventDefault();
      setDropTarget(id);
    }
  };
  const onNodeDrop = (e: React.DragEvent, id: string) => {
    const rawPreset = e.dataTransfer.getData('application/x-preset');
    const rawSymbol = e.dataTransfer.getData('application/x-symbol') || e.dataTransfer.getData('text/plain');
    setDropTarget(null);
    e.preventDefault();
    if (rawPreset) {
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

  const cursorFor: Record<Tool, string> = {
    select: panning || noteDragStart.current || strokeDragStart.current || boxDragStart.current || connectorDragStart.current ? 'grabbing' : 'grab',
    draw: 'crosshair',
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
        if (
          e.dataTransfer.types.includes('application/x-preset') ||
          e.dataTransfer.types.includes('application/x-symbol')
        ) {
          e.preventDefault();
        }
      }}
      onDrop={(e) => {
        if (dropTarget) return;
        const rawPreset = e.dataTransfer.getData('application/x-preset');
        const rawSymbol = e.dataTransfer.getData('application/x-symbol') || e.dataTransfer.getData('text/plain');
        e.preventDefault();

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
        className={`canvas-svg tool-${tool}`}
        style={{ cursor: cursorFor[tool] }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={onWheel}
        onClick={onClick}
        xmlns="http://www.w3.org/2000/svg"
      >
        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.scale})`}>
          {layout?.edges.map((edge) => (
            <line
              key={`${edge.parentId}-${edge.childId}`}
              className="connector"
              x1={edge.from.x}
              y1={edge.from.y + 9}
              x2={edge.to.x}
              y2={edge.to.y - 13}
            />
          ))}
          {layout?.nodes.map((n) => {
            const selected = selectedIds.includes(n.id);
            const isDrop = n.id === dropTarget;
            return (
              <g
                key={n.id}
                className={`tnode-group${tool === 'erase' ? ' erasable' : ''}`}
                onPointerDown={(e) => {
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
                  if (tool !== 'select') return;
                  e.stopPropagation();
                  beginEdit(n);
                }}
                // HTML5 DnD drop target
                onDragOver={(e) => onNodeDragOver(e, n.id)}
                onDragLeave={() => setDropTarget((d) => (d === n.id ? null : d))}
                onDrop={(e) => onNodeDrop(e, n.id)}
              >
                {(selected || isDrop) && (
                  <rect
                    className={isDrop ? 'drop-indicator' : 'tnode-box'}
                    x={n.x - NODE_W / 2}
                    y={n.y - NODE_H / 2}
                    width={NODE_W}
                    height={NODE_H}
                    rx={6}
                  />
                )}
                <rect
                  className="tnode-hit"
                  x={n.x - NODE_W / 2}
                  y={n.y - NODE_H / 2}
                  width={NODE_W}
                  height={NODE_H}
                />
                <text
                  className={`tnode-label${n.isLeaf ? ' leaf' : ''}`}
                  x={n.x}
                  y={n.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {n.label}
                </text>
              </g>
            );
          })}

          {/* ----- Annotation layer: freehand strokes ----- */}
          {annotations.strokes.map((s) => {
            const selected = selectedIds.includes(s.id);
            return (
              <g key={s.id} className={tool === 'erase' ? 'erasable-group' : ''}>
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
              strokeWidth={2}
            />
          )}

          {/* ----- Annotation layer: text notes ----- */}
          {annotations.notes.map((n) =>
            editingNote?.id === n.id ? null : (
              <text
                key={n.id}
                className={`note${tool === 'erase' ? ' erasable' : ''}${selectedIds.includes(n.id) ? ' selected' : ''}`}
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
              className={`box-annotation${tool === 'erase' ? ' erasable' : ''}${tool === 'select' ? ' selectable' : ''}${selectedIds.includes(b.id) ? ' selected' : ''}`}
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
            const angle = Math.atan2(c.endY - c.startY, c.endX - c.startX);
            const arrowLength = 10;
            const arrowAngle = Math.PI / 6;
            const x3 = c.endX - arrowLength * Math.cos(angle - arrowAngle);
            const y3 = c.endY - arrowLength * Math.sin(angle - arrowAngle);
            const x4 = c.endX - arrowLength * Math.cos(angle + arrowAngle);
            const y4 = c.endY - arrowLength * Math.sin(angle + arrowAngle);
            const arrowPath = `M ${x3} ${y3} L ${c.endX} ${c.endY} L ${x4} ${y4}`;
            const selected = selectedIds.includes(c.id);

            return (
              <g
                key={c.id}
                className={tool === 'erase' ? 'erasable-group' : ''}
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
          {liveConnector && (() => {
            const angle = Math.atan2(liveConnector.endY - liveConnector.startY, liveConnector.endX - liveConnector.startX);
            const arrowLength = 10;
            const arrowAngle = Math.PI / 6;
            const x3 = liveConnector.endX - arrowLength * Math.cos(angle - arrowAngle);
            const y3 = liveConnector.endY - arrowLength * Math.sin(angle - arrowAngle);
            const x4 = liveConnector.endX - arrowLength * Math.cos(angle + arrowAngle);
            const y4 = liveConnector.endY - arrowLength * Math.sin(angle + arrowAngle);
            const arrowPath = `M ${x3} ${y3} L ${liveConnector.endX} ${liveConnector.endY} L ${x4} ${y4}`;

            return (
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
                  d={arrowPath}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            );
          })()}
        </g>
      </svg>

      {!tree &&
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
          return (
            <input
              className="inline-edit"
              style={{ left: pos.left, top: pos.top }}
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
        {toolButton('draw', <PenIcon />, 'Draw freehand')}
        {toolButton('text', <TextIcon />, 'Add text note (click on canvas)')}
        {toolButton('arrow', <ArrowIcon />, 'Draw connector arrow between elements')}
        {toolButton('box', <BoxIcon />, 'Draw box around elements')}
        {toolButton('erase', <EraserIcon />, 'Eraser (click a drawing, note, box, or arrow)')}
        
        {(tool === 'draw' || tool === 'text' || tool === 'box' || tool === 'arrow') && (
          <>
            <span className="toolbar-divider" />
            <div className="color-picker">
              {[
                { name: 'Red', value: 'var(--danger)' },
                { name: 'Blue', value: 'var(--accent)' },
                { name: 'Green', value: 'var(--success)' },
                { name: 'Orange', value: 'var(--warning)' },
                { name: 'Dark', value: 'var(--text)' },
              ].map((c) => (
                <button
                  key={c.value}
                  className={`color-dot${strokeColor === c.value ? ' active' : ''}`}
                  style={{ backgroundColor: c.value === 'var(--text)' ? 'var(--text)' : c.value }}
                  title={c.name}
                  onClick={() => setStrokeColor(c.value)}
                />
              ))}
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

        {(annotations.notes.length > 0 || annotations.strokes.length > 0) && (
          <>
            <span className="toolbar-divider" />
            <button
              className="btn primary render-drawing"
              disabled={recognizing}
              title="Convert your drawing into a tree: labels (typed notes or handwriting) become nodes, arrows and straight lines become branches (parent above, child below)"
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
