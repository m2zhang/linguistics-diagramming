import Tesseract from 'tesseract.js';
import { TreeNode } from '../model/types';
import { loadImage, preprocess } from './preprocess';
import { inferTree, OcrBox } from './structureInfer';

export interface RecognizeResult {
  tree: TreeNode | null;
  confidence: number;
  rawText: string;
  boxCount: number;
}

export type ProgressCb = (stage: string, progress: number) => void;

/**
 * Full client-side pipeline: file → preprocess → Tesseract OCR → structure
 * inference → editable TreeNode. Runs entirely in-browser (Tesseract ships a
 * WASM worker + bundled traineddata); the result is a best guess for the student
 * to correct, not a final answer.
 */
export async function imageToTree(file: File, onProgress?: ProgressCb): Promise<RecognizeResult> {
  onProgress?.('Reading image', 0.05);
  const img = await loadImage(file);

  onProgress?.('Cleaning up', 0.15);
  const { canvas } = preprocess(img);

  onProgress?.('Recognizing text', 0.25);
  const result = await Tesseract.recognize(canvas, 'eng', {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        onProgress?.('Recognizing text', 0.25 + m.progress * 0.65);
      }
    },
  });

  // Tesseract.js v5 exposes word-level boxes on data.words.
  const words: Array<{ text: string; bbox: { x0: number; y0: number; x1: number; y1: number }; confidence: number }> =
    (result.data as unknown as { words?: typeof words }).words ?? [];

  const boxes: OcrBox[] = words.map((w) => ({
    text: w.text,
    x0: w.bbox.x0,
    y0: w.bbox.y0,
    x1: w.bbox.x1,
    y1: w.bbox.y1,
    confidence: w.confidence,
  }));

  onProgress?.('Building tree', 0.95);
  const { tree, confidence } = inferTree(boxes);

  onProgress?.('Done', 1);
  return {
    tree,
    confidence,
    rawText: result.data.text,
    boxCount: boxes.length,
  };
}
