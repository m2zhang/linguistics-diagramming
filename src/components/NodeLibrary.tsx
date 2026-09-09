import { FEATURE_DND_TYPE, LINK_FEATURE_GRID, THETA_ROLE_GRID } from '../model/features';
import { PRESET_KEYS } from '../model/shortcuts';
import { BinaryIcon, CaseIcon, LinkFeatureIcon, NodeDownIcon, TernaryIcon, ThetaRoleIcon, TriangleIcon, XBarIcon } from './icons';
import { cloneWithNewIds, TreeNode } from '../model/types';
import { useState } from 'react';
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
  build?: () => TreeNode;
  /**
   * Tagged onto the node it is dropped on instead of adding children. A theta
   * grid belongs to the head that assigns it, so dropping one on V has to
   * annotate V rather than hang a new node beneath it.
   */
  feature?: string;
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
    id: 'theta-role',
    name: 'Theta Role',
    desc: `Tag ${THETA_ROLE_GRID}`,
    icon: <ThetaRoleIcon className="preset-icon" />,
    feature: THETA_ROLE_GRID,
  },
  {
    id: 'link-feature',
    name: 'Link Feature',
    desc: `Tag ${LINK_FEATURE_GRID}`,
    icon: <LinkFeatureIcon className="preset-icon" />,
    feature: LINK_FEATURE_GRID,
  },
  {
    id: 'triangle',
    name: 'Triangle',
    desc: 'Phrase with triangle',
    icon: <TriangleIcon className="preset-icon" />,
    build: () => node('XP', [{ id: 'preset', label: 'text', children: [], triangle: true }]),
  },
  {
    id: 'x-bar',
    name: 'X-Bar',
    desc: 'Specifier, head, and complement',
    icon: <XBarIcon className="preset-icon" />,
    build: () => node('XP', [node('Spec'), node('X′', [node('X'), node('Comp')])]),
  },
];

/** F-key advertised on a preset chip, or null when it has no binding.
 *  Derived from PRESET_KEYS rather than the row index: F4+ already load
 *  templates, so an index-based hint would promise a key that does something
 *  else entirely. */
function presetKey(index: number): string | null {
  const hit = Object.entries(PRESET_KEYS).find(([, i]) => i === index);
  return hit ? hit[0] : null;
}

export function NodeLibrary() {
  const onDragStart = (e: React.DragEvent, preset: Preset) => {
    if (preset.feature) {
      // Same payload the Feature Bundle chips use, so TreeCanvas's existing
      // drop handler tags the target node rather than adding children.
      e.dataTransfer.setData(FEATURE_DND_TYPE, preset.feature);
    } else if (preset.build) {
      // The dragged payload is a single wrapper node whose CHILDREN get attached.
      e.dataTransfer.setData('application/x-preset', JSON.stringify(preset.build()));
    }
    e.dataTransfer.effectAllowed = 'copy';
  };
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const locked = useUiStore((s) => s.locked);
  const toast = useUiStore((s) => s.toast);

  const tree = useTreeStore((s) => s.tree);
  const selectedId = useTreeStore((s) => s.selectedId);
  const attachPreset = useTreeStore((s) => s.attachPreset);
  const replaceTree = useTreeStore((s) => s.replaceTree);
  const addNodeFeature = useTreeStore((s) => s.addNodeFeature);
  const [caseText, setCaseText] = useState('');
  const caseLabel = caseText.trim().replace(/^\[|\]$/g, '').trim();

  const handleCaseClick = () => {
    if (locked) return;
    if (!caseLabel) {
      toast('Enter a case label first.', 'info');
      return;
    }
    const target = selectedId ? findNode(tree, selectedId) ?? tree : tree;
    if (!target) {
      replaceTree(cloneWithNewIds({ ...node('X'), features: [caseLabel] }));
    } else if (!addNodeFeature(target.id, caseLabel)) {
      toast(`Already tagged [${caseLabel}]`, 'info');
      return;
    }
    toast(`Added [${caseLabel}]`, 'success');
  };

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
            {presetKey(index) && <span className="shortcut-hint">{presetKey(index)}</span>}
          </div>
        ))}
        <label className="case-label-field">
          Case label
          <input
            type="text"
            value={caseText}
            onChange={(e) => setCaseText(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCaseClick();
              }
            }}
            placeholder="e.g. NOM, ACC, +CASE"
            disabled={locked}
          />
        </label>
        <div
          className="preset"
          role="button"
          tabIndex={locked ? -1 : 0}
          aria-disabled={locked || !caseLabel}
          draggable={!locked && !!caseLabel}
          onDragStart={(e) => {
            if (locked || !caseLabel) {
              e.preventDefault();
              return;
            }
            e.dataTransfer.setData(FEATURE_DND_TYPE, caseLabel);
            e.dataTransfer.effectAllowed = 'copy';
          }}
          onClick={handleCaseClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              handleCaseClick();
            }
          }}
          title="Fill in a case label, then click or drag onto a node"
        >
          <CaseIcon className="preset-icon" label={caseLabel || '…'} />
          <div>
            <div className="preset-name">Case</div>
            <div className="preset-desc">{caseLabel ? `Add [${caseLabel}] below a node` : 'Fill in the label above'}</div>
          </div>
        </div>
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
