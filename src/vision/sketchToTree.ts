import Tesseract from 'tesseract.js';
import { drawingToTree, DrawingTreeResult } from '../model/drawingToTree';
import { Annotations, Stroke, TextNote } from '../model/types';

/**
 * Understands a tree drawn ON the canvas with the pen tool: handwritten
 * labels are OCR'd (Tesseract, fully client-side), straight strokes become
 * branches, and the combined result goes through the same drawingToTree
 * inference used for typed notes.
 */

const SCALE = 3; // rasterize at 3x for better OCR on thin pen strokes
const PAD = 30; // world-unit padding around the drawing

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function strokeBounds(strokes: Stroke[]): Rect {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of strokes) {
    for (const p of s.points) {
      x0 = Math.min(x0, p.x);
      y0 = Math.min(y0, p.y);
      x1 = Math.max(x1, p.x);
      y1 = Math.max(y1, p.y);
    }
  }
  return { x0, y0, x1, y1 };
}

/** Share of a stroke's points that fall inside a rect (slightly expanded). */
function overlapRatio(stroke: Stroke, r: Rect, margin: number): number {
  let inside = 0;
  for (const p of stroke.points) {
    if (p.x >= r.x0 - margin && p.x <= r.x1 + margin && p.y >= r.y0 - margin && p.y <= r.y1 + margin) {
      inside += 1;
    }
  }
  return inside / stroke.points.length;
}

export async function sketchToTree(
  ann: Annotations,
  onProgress?: (progress: number) => void,
): Promise<DrawingTreeResult> {
  if (ann.strokes.length === 0) return drawingToTree(ann);

  // Rasterize all pen strokes (black on white) for OCR.
  const b = strokeBounds(ann.strokes);
  const w = b.x1 - b.x0 + PAD * 2;
  const h = b.y1 - b.y0 + PAD * 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * SCALE));
  canvas.height = Math.max(1, Math.round(h * SCALE));
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2.5 * SCALE;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const toCanvas = (p: { x: number; y: number }) => ({
    x: (p.x - b.x0 + PAD) * SCALE,
    y: (p.y - b.y0 + PAD) * SCALE,
  });
  for (const s of ann.strokes) {
    ctx.beginPath();
    s.points.forEach((p, i) => {
      const c = toCanvas(p);
      if (i === 0) ctx.moveTo(c.x, c.y);
      else ctx.lineTo(c.x, c.y);
    });
    ctx.stroke();
  }

  const result = await Tesseract.recognize(canvas, 'eng', {
    logger: (m) => {
      if (m.status === 'recognizing text') onProgress?.(m.progress);
    },
  });
  type Word = { text: string; bbox: { x0: number; y0: number; x1: number; y1: number }; confidence: number };
  const words: Word[] = ((result.data as unknown as { words?: Word[] }).words ?? []).filter(
    (wd) => wd.text.trim().length > 0 && /[A-Za-z'’]/.test(wd.text) && wd.confidence > 20,
  );

  // Map recognized words back into world coordinates as synthetic labels.
  const toWorldRect = (r: Rect): Rect => ({
    x0: r.x0 / SCALE + b.x0 - PAD,
    y0: r.y0 / SCALE + b.y0 - PAD,
    x1: r.x1 / SCALE + b.x0 - PAD,
    y1: r.y1 / SCALE + b.y0 - PAD,
  });
  const ocrNotes: TextNote[] = [];
  const wordRects: Rect[] = [];
  words.forEach((wd, i) => {
    const r = toWorldRect(wd.bbox);
    wordRects.push(r);
    ocrNotes.push({
      id: `ocr_${i}`,
      x: (r.x0 + r.x1) / 2,
      y: (r.y0 + r.y1) / 2,
      text: wd.text.trim(),
    });
  });

  // Strokes mostly inside a recognized word's box are handwriting, not branches.
  const textStrokeIds: string[] = [];
  const edgeStrokes: Stroke[] = [];
  for (const s of ann.strokes) {
    const isText = wordRects.some((r) => overlapRatio(s, r, 8) >= 0.6);
    if (isText) textStrokeIds.push(s.id);
    else edgeStrokes.push(s);
  }

  const res = drawingToTree({
    strokes: edgeStrokes,
    notes: [...ann.notes, ...ocrNotes],
    boxes: ann.boxes,
    connectors: ann.connectors,
  });

  if (res.tree) {
    // Consume the handwriting strokes too; drop synthetic note ids (not real annotations).
    res.usedIds = [...res.usedIds.filter((id) => !id.startsWith('ocr_')), ...textStrokeIds];
  }
  return res;
}
