import { useState } from 'react';
import { useTreeStore, findNode } from '../store/treeStore';
import { useUiStore } from '../store/uiStore';

const COMMON_SYMBOLS = ['S', 'NP', 'VP', 'PP', 'DP', 'N', 'V', 'Adj'];

interface SymbolCategory {
  category: string;
  symbols: string[];
}

const CATEGORIZED_SYMBOLS: SymbolCategory[] = [
  {
    category: 'Phrasal Categories',
    symbols: ['S', 'NP', 'VP', 'PP', 'CP', 'TP', 'DP', 'AP', 'AdjP', 'AdvP', 'QP', 'IP', 'NegP', 'AuxP'],
  },
  {
    category: 'Lexical Categories',
    symbols: ['N', 'V', 'P', 'D', 'C', 'T', 'A', 'Adj', 'Adv', 'Pron', 'Conj', 'Aux', 'Deg', 'Q', 'Neg', 'I'],
  },
  {
    category: 'X-Bar Syntax',
    symbols: ['XP', "X'", "N'", "V'", "P'", "A'", "T'", "C'", "D'", "I'", 'Spec', 'Comp'],
  },
  {
    category: 'Traces & Null Elements',
    symbols: ['t', 'tᵢ', 'tⱼ', 'PRO', 'pro', 'e', 'Ø', 'OP'],
  },
  {
    category: 'Features & Variables',
    symbols: ['φ', '[+F]', '[−F]', '[+wh]', '[−wh]', 'α', 'β', 'λ'],
  },
];

export function SymbolLibrary() {
  const tree = useTreeStore((s) => s.tree);
  const selectedId = useTreeStore((s) => s.selectedId);
  const renameNode = useTreeStore((s) => s.renameNode);
  const updateNote = useTreeStore((s) => s.updateNote);
  const notes = useTreeStore((s) => s.annotations.notes);
  const toast = useUiStore((s) => s.toast);

  const [expanded, setExpanded] = useState(false);

  const onDragStart = (e: React.DragEvent, symbol: string) => {
    e.dataTransfer.setData('application/x-symbol', symbol);
    e.dataTransfer.setData('text/plain', symbol);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const onSymbolClick = (symbol: string) => {
    if (!selectedId) {
      toast('Select a node or text note to apply, or drag the symbol onto the canvas.', 'info');
      return;
    }

    // Check if selectedId is a node in the tree
    const targetNode = findNode(tree, selectedId);
    if (targetNode) {
      renameNode(selectedId, symbol);
      toast(`Renamed node to "${symbol}"`, 'success');
      return;
    }

    // Check if selectedId is a text note
    const targetNote = notes.find((n) => n.id === selectedId);
    if (targetNote) {
      updateNote(selectedId, { text: symbol });
      toast(`Updated text note to "${symbol}"`, 'success');
      return;
    }

    toast('Select a node or text note to apply, or drag the symbol onto the canvas.', 'info');
  };

  return (
    <div className="section symbol-library">
      <div className="panel-header" style={{ marginBottom: '12px' }}>
        <div className="panel-title" style={{ margin: 0 }}>Symbol Library</div>
      </div>

      {!expanded ? (
        <>
          <div className="symbol-grid">
            {COMMON_SYMBOLS.map((sym) => (
              <button
                key={sym}
                className="symbol-btn"
                draggable
                onDragStart={(e) => onDragStart(e, sym)}
                onClick={() => onSymbolClick(sym)}
                title="Click to rename selected element, or drag onto canvas"
              >
                {sym}
              </button>
            ))}
          </div>
          <button
            className="btn ghost full-width"
            style={{ marginTop: '10px' }}
            onClick={() => setExpanded(true)}
          >
            + All Symbols
          </button>
        </>
      ) : (
        <div className="all-symbols-container">
          {CATEGORIZED_SYMBOLS.map((cat) => (
            <div key={cat.category} className="symbol-category-group">
              <div className="symbol-category-title">{cat.category}</div>
              <div className="symbol-grid mini">
                {cat.symbols.map((sym) => (
                  <button
                    key={sym}
                    className="symbol-btn mini"
                    draggable
                    onDragStart={(e) => onDragStart(e, sym)}
                    onClick={() => onSymbolClick(sym)}
                    title="Click to rename selected element, or drag onto canvas"
                  >
                    {sym}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button
            className="btn ghost full-width"
            style={{ marginTop: '12px' }}
            onClick={() => setExpanded(false)}
          >
            - Show Less
          </button>
        </div>
      )}

      <div className="hint" style={{ marginTop: '10px' }}>
        Click to label selected node/note, or drag onto the canvas to insert.
      </div>
    </div>
  );
}
