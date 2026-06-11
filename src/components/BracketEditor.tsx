import { useEffect, useRef, useState } from 'react';
import { serializeBracketPretty } from '../model/bracketSerializer';
import { useTreeStore } from '../store/treeStore';
import { useUiStore } from '../store/uiStore';
import { CopyIcon } from './icons';
import { copyText } from '../utils/clipboard';

/**
 * Two-way bound bracket editor.
 *  - Typing parses (debounced) into the tree store.
 *  - Canvas edits bump `treeRevision`; we then re-serialize into the textarea,
 *    but only when the change did NOT originate from this textarea.
 */
function ExpandIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h6v6" />
      <path d="M9 21H3v-6" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}

function CollapseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 14h6v6" />
      <path d="M20 10h-6V4" />
      <line x1="14" y1="10" x2="21" y2="3" />
      <line x1="10" y1="14" x2="3" y2="21" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export function BracketEditor() {
  const tree = useTreeStore((s) => s.tree);
  const treeRevision = useTreeStore((s) => s.treeRevision);
  const parseErrors = useTreeStore((s) => s.parseErrors);
  const setTreeFromBracket = useTreeStore((s) => s.setTreeFromBracket);

  const [text, setText] = useState(() => (tree ? serializeBracketPretty(tree) : ''));
  const [isExpanded, setIsExpanded] = useState(false);
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const toggleRightpane = useUiStore((s) => s.toggleRightpane);
  const debounce = useRef<number | undefined>(undefined);
  const lastRevision = useRef(treeRevision);

  // When the tree changes from the canvas (revision bumped), refresh the text.
  useEffect(() => {
    if (treeRevision !== lastRevision.current) {
      lastRevision.current = treeRevision;
      setText(tree ? serializeBracketPretty(tree) : '');
    }
  }, [treeRevision, tree]);

  const onChange = (value: string) => {
    setText(value);
    window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(() => {
      // Mark this as a text-origin change so the effect above won't clobber it.
      lastRevision.current = useTreeStore.getState().treeRevision;
      setTreeFromBracket(value);
    }, 250);
  };

  const toast = useUiStore((s) => s.toast);
  const copy = async () => {
    if (await copyText(text)) {
      toast('Bracket notation copied to clipboard', 'success');
    } else {
      toast('Copy failed — select and copy manually', 'error');
    }
  };

  const hasErrors = parseErrors.length > 0;

  const expandedStyle = isExpanded ? { left: sidebarOpen ? '244px' : '0' } : undefined;

  return (
    <div className={`bracket-editor${isExpanded ? ' expanded' : ''}`} style={expandedStyle}>
      <div className="panel-header">
        <div className="panel-title" style={{ margin: 0 }}>
          Bracket Notation
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {!isExpanded && (
            <button
              className="btn icon ghost"
              title="Hide right panel"
              onClick={toggleRightpane}
            >
              <ChevronRightIcon />
            </button>
          )}
          <button
            className="btn icon ghost"
            title={isExpanded ? 'Collapse editor' : 'Expand editor'}
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <CollapseIcon /> : <ExpandIcon />}
          </button>
        </div>
      </div>
      <textarea
        spellCheck={false}
        value={text}
        onChange={(e) => onChange(e.target.value)}
        placeholder="[S [NP [D the] [N cat]] [VP [V sat]]]"
        aria-label="Bracket notation editor"
      />
      <div className="editor-footer">
        <button
          className="btn ghost"
          style={{ padding: '4px 8px' }}
          onClick={copy}
          disabled={!text.trim()}
          title="Copy bracket notation"
        >
          <CopyIcon /> Copy
        </button>
        <div className={`parse-status ${hasErrors ? 'err' : 'ok'}`}>
          {hasErrors ? (
            <>
              {parseErrors.length} issue{parseErrors.length > 1 ? 's' : ''}:
              <ul>
                {parseErrors.slice(0, 4).map((e, i) => (
                  <li key={i}>{e.message}</li>
                ))}
              </ul>
            </>
          ) : (
            tree && '✓ Parsed successfully'
          )}
        </div>
      </div>
    </div>
  );
}
