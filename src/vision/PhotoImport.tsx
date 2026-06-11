import { useRef, useState } from 'react';
import { useTreeStore } from '../store/treeStore';
import { useUiStore } from '../store/uiStore';
import { ImageIcon } from '../components/icons';

export function PhotoImport() {
  const replaceTree = useTreeStore((s) => s.replaceTree);
  const toast = useUiStore((s) => s.toast);
  const inputRef = useRef<HTMLInputElement>(null);

  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);

  const restoreState = (data: { tree: unknown; annotations?: unknown }, source: string) => {
    replaceTree(data.tree as Parameters<typeof replaceTree>[0]);
    if (data.annotations) {
      useTreeStore.getState().setAnnotations(data.annotations as never);
    }
    toast(`Project restored from ${source}`, 'success');
  };

  const handleFile = async (file: File) => {
    const name = file.name.toLowerCase();

    // 1. JSON project restore
    if (name.endsWith('.json') || file.type === 'application/json') {
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (data.tree !== undefined) {
          replaceTree(data.tree);
          if (data.annotations) {
            useTreeStore.getState().setAnnotations(data.annotations);
          }
          toast('Project restored from JSON successfully', 'success');
        } else {
          toast('Invalid project JSON file', 'error');
        }
      } catch (err) {
        toast('Failed to read JSON file', 'error');
      }
      return;
    }

    // 2. Bracket notation TXT file restore
    if (name.endsWith('.txt') || name.endsWith('.bracket') || file.type.startsWith('text/plain')) {
      try {
        const text = await file.text();
        const { parseBracket } = await import('../model/bracketParser');
        const { tree, errors } = parseBracket(text);
        if (tree) {
          replaceTree(tree);
          if (errors.length > 0) {
            toast(`Parsed bracket tree with ${errors.length} warning(s)`, 'info');
          } else {
            toast('Tree loaded from bracket notation file', 'success');
          }
        } else {
          toast('No valid bracket notation found in text file', 'error');
        }
      } catch (err) {
        toast('Failed to read text file', 'error');
      }
      return;
    }

    // 3. SVG project restore (from embedded metadata)
    if (name.endsWith('.svg') || file.type === 'image/svg+xml') {
      try {
        const text = await file.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'image/svg+xml');
        const svgEl = doc.querySelector('svg');
        const stateAttr = svgEl?.getAttribute('data-syntax-tree-state');
        if (stateAttr) {
          restoreState(JSON.parse(stateAttr), 'SVG');
          return;
        }
      } catch (err) {
        console.error('Failed to parse SVG metadata', err);
      }
      // If no metadata found, fall through to treat SVG as a standard image for OCR
    }

    // 4. PDF restore (from the trailing state marker our exporter appends)
    if (name.endsWith('.pdf') || file.type === 'application/pdf') {
      try {
        const { extractPdfMarker, decodeState } = await import('../export/projectState');
        const marker = extractPdfMarker(new Uint8Array(await file.arrayBuffer()));
        const data = marker ? decodeState(marker) : null;
        if (data) {
          restoreState(data, 'PDF');
        } else {
          toast('This PDF has no embedded tree data — only PDFs exported from this app can be restored', 'error');
        }
      } catch {
        toast('Failed to read PDF file', 'error');
      }
      return;
    }

    // 5. PNG restore (from the tEXt chunk our exporter embeds); falls through
    //    to OCR for PNGs that didn't come from this app.
    if (name.endsWith('.png') || file.type === 'image/png') {
      try {
        const { extractPngText, decodeState, PNG_KEYWORD } = await import('../export/projectState');
        const text = extractPngText(new Uint8Array(await file.arrayBuffer()), PNG_KEYWORD);
        const data = text ? decodeState(text) : null;
        if (data) {
          restoreState(data, 'PNG');
          return;
        }
      } catch {
        /* fall through to OCR */
      }
    }

    // 6. Default: Image OCR
    if (!file.type.startsWith('image/') && !name.endsWith('.svg')) {
      toast('Please choose a valid file (image, PDF, JSON, SVG, or txt)', 'error');
      return;
    }

    setPreview(URL.createObjectURL(file));
    setBusy(true);
    setProgress(0);
    try {
      // Lazy-load the OCR pipeline (Tesseract + WASM) only when actually used,
      // keeping it out of the initial bundle.
      const { imageToTree } = await import('./imageToTree');
      const res = await imageToTree(file, (s, p) => {
        setStage(s);
        setProgress(p);
      });
      if (!res.tree) {
        toast('Could not detect any labels — try a clearer photo', 'error');
        return;
      }
      replaceTree(res.tree);
      const pct = Math.round(res.confidence * 100);
      toast(`Recognized ${res.boxCount} labels (${pct}% confidence) — please review`, 'success');
    } catch (err) {
      console.error(err);
      toast('Recognition failed', 'error');
    } finally {
      setBusy(false);
      setStage('');
      setProgress(0);
    }
  };

  return (
    <div className="section">
      <div className="panel-title">
        Photo → Tree
        <span className="experimental-badge">Experimental</span>
      </div>

      <div
        className={`dropzone${over ? ' over' : ''}`}
        onClick={() => !busy && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files[0];
          if (f) handleFile(f);
        }}
      >
        <ImageIcon style={{ width: 22, height: 22, opacity: 0.7 }} />
        <div style={{ marginTop: 6 }}>
          {busy
            ? stage || 'Working…'
            : 'Drop a photo or an exported PNG / SVG / PDF / JSON file, or click to choose'}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.json,.txt,.bracket,.svg,.pdf"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = '';
          }}
        />
      </div>

      {busy && (
        <div className="progress">
          <div style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}

      {preview && (
        <div className="photo-preview">
          <img src={preview} alt="Uploaded sketch preview" />
        </div>
      )}

      <div className="hint">
        Recognition runs fully in your browser (no upload). It's a rough starting
        point — expect to fix labels and branches on the canvas afterwards. Works
        best on clear, printed-style handwriting.
      </div>
    </div>
  );
}
