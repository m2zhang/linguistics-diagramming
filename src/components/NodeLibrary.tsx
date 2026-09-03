import { cloneWithNewIds, TreeNode } from '../model/types';
import { BinaryIcon, NodeDownIcon, TernaryIcon, TriangleIcon } from './icons';
import { useUiStore } from '../store/uiStore';
import { findNode, useTreeStore } from '../store/treeStore';

function ChevronLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

export interface Preset {
  id: string;
  name: string;
  desc: string;
  icon: JSX.Element;
  /** Skeleton attached to the drop target's children (ids are placeholders). */
  build: () => TreeNode;
}

// Note: ids here are placeholders; attachPreset() re-ids via cloneWithNewIds.
const node = (label: string, children: TreeNode[] = []): TreeNode => ({
  id: 'preset',
  label,
  children,
});

export const PRESETS: Preset[] = [
  {
    id: 'down',
    name: 'Node Down',
    desc: 'One child below',
    icon: <NodeDownIcon className="preset-icon" />,
    build: () => node('X', [node('Y')]),
  },
  {
    id: 'binary',
    name: 'Binary Branch',
    desc: 'Two children',
    icon: <BinaryIcon className="preset-icon" />,
    build: () => node('X', [node('Y'), node('Z')]),
  },
  {
    id: 'ternary',
    name: 'Ternary Branch',
    desc: 'Three children',
    icon: <TernaryIcon className="preset-icon" />,
    build: () => node('X', [node('A'), node('B'), node('C')]),
  },
  {
    id: 'triangle',
    name: 'Triangle',
    desc: 'Phrase with triangle',
    icon: <TriangleIcon className="preset-icon" />,
    build: () => node('XP', [{ id: 'preset', label: 'text', children: [], triangle: true }]),
  },
];

export function NodeLibrary() {
  const onDragStart = (e: React.DragEvent, preset: Preset) => {
    // The dragged payload is a single wrapper node whose CHILDREN get attached.
    e.dataTransfer.setData('application/x-preset', JSON.stringify(preset.build()));
    e.dataTransfer.effectAllowed = 'copy';
  };
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const locked = useUiStore((s) => s.locked);
  const toast = useUiStore((s) => s.toast);

  const tree = useTreeStore((s) => s.tree);
  const selectedId = useTreeStore((s) => s.selectedId);
  const attachPreset = useTreeStore((s) => s.attachPreset);
  const replaceTree = useTreeStore((s) => s.replaceTree);

  const handlePresetClick = (preset: Preset) => {
    if (locked) return;
    const built = preset.build();
    if (selectedId && findNode(tree, selectedId)) {
      attachPreset(selectedId, built);
    } else if (tree) {
      attachPreset(tree.id, built);
    } else {
      replaceTree(cloneWithNewIds(built));
    }
    toast(`Added ${preset.name}`, 'success');
  };

  return (
    <div className="section">
      <div className="panel-header" style={{ marginBottom: '12px' }}>
        <div className="panel-title" style={{ margin: 0 }}>Node Library</div>
        <button
          className="btn icon ghost"
          title="Hide left sidebar"
          onClick={toggleSidebar}
        >
          <ChevronLeftIcon />
        </button>
      </div>
      <div className={`preset-grid${locked ? ' read-only' : ''}`}>
        {PRESETS.map((p, index) => (
          <div
            key={p.id}
            className="preset"
            draggable={!locked}
            onDragStart={(e) => onDragStart(e, p)}
            onClick={() => handlePresetClick(p)}
          >
            {p.icon}
            <div>
              <div className="preset-name">{p.name}</div>
              <div className="preset-desc">{p.desc}</div>
            </div>
            <span className="shortcut-hint">F{index + 1}</span>
          </div>
        ))}
      </div>
      <div className="hint">
        {locked ? (
          <>Editing is locked. Unlock it in the top bar to change the tree.</>
        ) : (
          <>
            Drag a preset onto any node to add branches. Double-click a node to
            rename it, press <kbd>Delete</kbd> to remove it.
          </>
        )}
      </div>
    </div>
  );
}
