import { useRef, useState } from 'react';
import { useTreeStore } from '../store/treeStore';
import { useUiStore } from '../store/uiStore';
import { DownloadIcon } from './icons';

export function ImportProject() {
  const replaceTree = useTreeStore((s) => s.replaceTree);
  const toast = useUiStore((s) => s.toast);
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

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
          const data = JSON.parse(stateAttr);
          replaceTree(data.tree);
          if (data.annotations) {
            useTreeStore.getState().setAnnotations(data.annotations);
          }
          toast('Project restored from SVG metadata', 'success');
          return;
        } else {
          toast('SVG does not contain saved syntax tree project metadata', 'error');
        }
      } catch (err) {
        toast('Failed to read SVG file', 'error');
      }
      return;
    }

    toast('Please choose a valid file (.json, .svg, or .txt)', 'error');
  };

  return (
    <div className="section">
      <div className="panel-title" style={{ marginBottom: '8px' }}>
        Import Project
      </div>

      <div
        className={`dropzone${over ? ' over' : ''}`}
        onClick={() => inputRef.current?.click()}
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
        <DownloadIcon style={{ width: 22, height: 22, opacity: 0.7 }} />
        <div style={{ marginTop: 6, fontSize: '12.5px', lineHeight: '1.4' }}>
          Drop a saved <b>JSON</b>, <b>SVG</b>, or <b>TXT</b> tree file, or click to choose
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".json,.txt,.bracket,.svg"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = '';
          }}
        />
      </div>

      <div className="hint" style={{ marginTop: '8px' }}>
        Supports standard project JSON backups, exported SVGs containing embedded tree data, or plain text bracket notation files.
      </div>
    </div>
  );
}
