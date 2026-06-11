/**
 * Client-side image preprocessing for OCR. All work happens on a <canvas> in the
 * browser — no uploads, no network. Steps: downscale to a sane width, grayscale,
 * then Otsu-threshold binarization to maximise OCR contrast on pencil sketches.
 */

const MAX_WIDTH = 1400;

export interface PreprocessResult {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

export async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Could not read image'));
      img.src = url;
    });
    return img;
  } finally {
    // Revoke after the image has loaded into memory.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

/** Compute an Otsu threshold (0..255) from a grayscale histogram. */
function otsuThreshold(histogram: number[], total: number): number {
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * histogram[i];
  let sumB = 0;
  let wB = 0;
  let maxVar = 0;
  let threshold = 127;
  for (let t = 0; t < 256; t++) {
    wB += histogram[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * histogram[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > maxVar) {
      maxVar = between;
      threshold = t;
    }
  }
  return threshold;
}

export function preprocess(img: HTMLImageElement): PreprocessResult {
  const scale = img.width > MAX_WIDTH ? MAX_WIDTH / img.width : 1;
  const width = Math.round(img.width * scale);
  const height = Math.round(img.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, width, height);

  const data = ctx.getImageData(0, 0, width, height);
  const px = data.data;
  const histogram = new Array(256).fill(0);

  // Grayscale pass + histogram.
  for (let i = 0; i < px.length; i += 4) {
    const gray = Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]);
    px[i] = px[i + 1] = px[i + 2] = gray;
    histogram[gray] += 1;
  }

  const threshold = otsuThreshold(histogram, width * height);

  // Binarize: dark strokes -> black, paper -> white.
  for (let i = 0; i < px.length; i += 4) {
    const v = px[i] < threshold ? 0 : 255;
    px[i] = px[i + 1] = px[i + 2] = v;
  }

  ctx.putImageData(data, 0, 0);
  return { canvas, width, height };
}
