import { useMemo, useState } from 'react';
import { toForest, toQtree, toFullDocument } from '../model/latex';
import { useTreeStore } from '../store/treeStore';
import { useUiStore } from '../store/uiStore';
import { CopyIcon } from './icons';
import { copyText } from '../utils/clipboard';

export function LatexOutput() {
  const tree = useTreeStore((s) => s.tree);
  const toast = useUiStore((s) => s.toast);
  const [format, setFormat] = useState<'forest' | 'tikz-qtree' | 'qtree'>('forest');
  const [fullDoc, setFullDoc] = useState(false);

  const latex = useMemo(() => {
    if (!tree) return '';
    const code = format === 'forest' ? toForest(tree) : toQtree(tree);
    return fullDoc ? toFullDocument(code, format) : code;
  }, [tree, format, fullDoc]);

  const copy = async () => {
    if (await copyText(latex)) {
      toast('LaTeX copied to clipboard', 'success');
    } else {
      toast('Copy failed — select and copy manually', 'error');
    }
  };

  return (
    <div className="output-pane" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div
        className="panel-header"
        style={{ marginBottom: '8px' }}
      >
        <div className="panel-title" style={{ margin: 0 }}>LaTeX Export</div>
        <button className="btn ghost" style={{ padding: '4px 8px' }} onClick={copy} disabled={!tree}>
          <CopyIcon /> Copy
        </button>
      </div>

      <div className="latex-tabs" style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
        <button
          className={`btn ghost${format === 'forest' ? ' active' : ''}`}
          style={{ padding: '4px 6px', fontSize: '10.5px', flex: 1, justifyContent: 'center' }}
          onClick={() => setFormat('forest')}
        >
          Forest (Modern)
        </button>
        <button
          className={`btn ghost${format === 'tikz-qtree' ? ' active' : ''}`}
          style={{ padding: '4px 6px', fontSize: '10.5px', flex: 1, justifyContent: 'center' }}
          onClick={() => setFormat('tikz-qtree')}
        >
          TikZ-Qtree
        </button>
        <button
          className={`btn ghost${format === 'qtree' ? ' active' : ''}`}
          style={{ padding: '4px 6px', fontSize: '10.5px', flex: 1, justifyContent: 'center' }}
          onClick={() => setFormat('qtree')}
        >
          Qtree (Classic)
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', padding: '0 2px' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-dim)', fontWeight: 500 }}>
          Full document wrapper
        </span>
        <label style={{ position: 'relative', display: 'inline-block', width: '36px', height: '20px' }}>
          <input
            type="checkbox"
            checked={fullDoc}
            onChange={(e) => setFullDoc(e.target.checked)}
            style={{ opacity: 0, width: 0, height: 0 }}
          />
          <span style={{
            position: 'absolute',
            cursor: 'pointer',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: fullDoc ? 'var(--accent)' : 'var(--border-strong)',
            transition: '.3s',
            borderRadius: '20px'
          }}>
            <span style={{
              position: 'absolute',
              content: '""',
              height: '14px',
              width: '14px',
              left: fullDoc ? '19px' : '3px',
              bottom: '3px',
              backgroundColor: 'white',
              transition: '.3s',
              borderRadius: '50%'
            }} />
          </span>
        </label>
      </div>

      <pre className="code-block" style={{ flex: 1, minHeight: '120px' }}>
        {latex || '% Build a tree to generate LaTeX'}
      </pre>

      <div className="hint" style={{ margin: '8px 2px 0', fontSize: '11px', lineHeight: '1.4', color: 'var(--text-faint)' }}>
        {fullDoc ? (
          <>
            Copy the full standalone document template and paste directly into a new blank Overleaf file.
          </>
        ) : (
          <>
            {format === 'forest' && (
              <>
                Add <code>\usepackage[linguistics]&#123;forest&#125;</code> to your LaTeX document preamble.
              </>
            )}
            {format === 'tikz-qtree' && (
              <>
                Add <code>\usepackage&#123;tikz-qtree&#125;</code> to your LaTeX document preamble.
              </>
            )}
            {format === 'qtree' && (
              <>
                Add <code>\usepackage&#123;qtree&#125;</code> to your LaTeX document preamble. (Note: <b>Forest</b> or <b>TikZ-Qtree</b> is highly recommended for professional rendering!)
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

