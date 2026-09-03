import { useEffect, useMemo, useState } from 'react';
import { effectiveStyle, FONT_LABELS, NodeFont, NodeStyle } from '../model/types';
import { featureColor } from '../model/features';
import { findNode, useTreeStore } from '../store/treeStore';
import { useUiStore } from '../store/uiStore';

/** Concrete hexes, not CSS vars — an explicit colour must survive theme switches and export. */
const COLORS: { name: string; value: string }[] = [
  { name: 'Ink', value: '#1a1d27' },
  { name: 'Blue', value: '#4361ff' },
  { name: 'Green', value: '#1d8a6a' },
  { name: 'Red', value: '#dc2626' },
  { name: 'Purple', value: '#7c3aed' },
  { name: 'Amber', value: '#b45309' },
];

const FONTS: NodeFont[] = ['display', 'sans', 'serif', 'mono'];

/**
 * Only the two weights that visibly differ. Medium (500) and Semibold (600)
 * were indistinguishable from their neighbours, so they are not offered.
 */
const WEIGHTS: { label: string; value: number }[] = [
  { label: 'Regular', value: 400 },
  { label: 'Bold', value: 700 },
];

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

/**
 * Properties panel for the selected node: label, children, typography, branch
 * thickness and syntactic features.
 *
 * Typography and branch thickness apply to every selected node so a whole layer
 * can be restyled at once; label, features and Add child act on the primary
 * selection only.
 */
export function NodeInspector() {
  const tree = useTreeStore((s) => s.tree);
  const selectedId = useTreeStore((s) => s.selectedId);
  const selectedIds = useTreeStore((s) => s.selectedIds);
  const renameNode = useTreeStore((s) => s.renameNode);
  const addChild = useTreeStore((s) => s.addChild);
  const setNodeStyle = useTreeStore((s) => s.setNodeStyle);
  const setNodeTriangle = useTreeStore((s) => s.setNodeTriangle);
  const setNodeFeatures = useTreeStore((s) => s.setNodeFeatures);
  const setNodeStep = useTreeStore((s) => s.setNodeStep);
  const locked = useUiStore((s) => s.locked);
  const usedSteps = useUiStore((s) => s.usedSteps);

  const node = useMemo(() => findNode(tree, selectedId ?? ''), [tree, selectedId]);
  /** Selected ids that are actually tree nodes (the rest are annotations). */
  const nodeIds = useMemo(
    () => selectedIds.filter((id) => findNode(tree, id) !== null),
    [tree, selectedIds],
  );

  const [labelDraft, setLabelDraft] = useState('');
  const [featureDraft, setFeatureDraft] = useState('');

  // Re-sync the drafts whenever the selection (or its label) changes elsewhere.
  useEffect(() => {
    setLabelDraft(node?.label ?? '');
    setFeatureDraft('');
  }, [node?.id, node?.label]);

  if (!node) {
    return (
      <div className="inspector">
        <div className="panel-header">
          <div className="panel-title" style={{ margin: 0 }}>
            Node Inspector
          </div>
        </div>
        <div className="hint" style={{ margin: '2px' }}>
          Select a node on the canvas to rename it, add children, change its
          typography or edit its features.
        </div>
      </div>
    );
  }

  const style = effectiveStyle(node.style, node.children.length === 0);
  // Fall back to the primary node so styling never silently no-ops if the
  // multi-selection list has gone stale.
  const targets = nodeIds.length > 0 ? nodeIds : [node.id];
  const multi = targets.length > 1;

  /** Apply a style patch to every selected node. `key` merges slider drags into one undo step. */
  const patch = (p: NodeStyle, key?: string) =>
    setNodeStyle(targets, p, key ? `${key}:${targets.join(',')}` : undefined);

  const ownStep = node.step ?? 0;
  const nodeSlide = Math.max(
    0,
    usedSteps.filter((s) => s < ownStep).length,
  );
  const prevStep = usedSteps[nodeSlide - 1] ?? 0;
  const nextStep = usedSteps[nodeSlide + 1] ?? ownStep + 1;

  const commitLabel = () => {
    const v = labelDraft.trim();
    if (v && v !== node.label) renameNode(node.id, v);
    else setLabelDraft(node.label);
  };

  const addFeature = () => {
    // Accept "a, b" so a whole bundle can be pasted in one go.
    const parts = featureDraft.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0) return;
    setNodeFeatures(node.id, [...(node.features ?? []), ...parts]);
    setFeatureDraft('');
  };

  const removeFeature = (f: string) =>
    setNodeFeatures(node.id, (node.features ?? []).filter((x) => x !== f));

  return (
    <div className={`inspector${locked ? ' read-only' : ''}`}>
      {locked && <div className="locked-note">Editing locked — annotations only</div>}
      <div className="panel-header">
        <div className="panel-title" style={{ margin: 0 }}>
          Node Inspector
        </div>
        {multi && <span className="insp-badge">{nodeIds.length} selected</span>}
      </div>

      {/* ---- Label + children ---- */}
      <div className="insp-group">
        <label className="insp-label" htmlFor="insp-label-input">
          Label
        </label>
        <div className="insp-row">
          <input
            id="insp-label-input"
            className="insp-input"
            value={labelDraft}
            spellCheck={false}
            onChange={(e) => setLabelDraft(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') {
                setLabelDraft(node.label);
                e.currentTarget.blur();
              }
            }}
          />
          <button
            className="btn ghost"
            style={{ padding: '5px 9px', whiteSpace: 'nowrap' }}
            title="Add a child node below this one"
            onClick={() => addChild(node.id)}
          >
            <PlusIcon /> Child
          </button>
        </div>
      </div>

      {/* ---- Typography ---- */}
      <div className="insp-group">
        <label className="insp-label" htmlFor="insp-font">
          Typography{multi && ' (all selected)'}
        </label>
        <div className="insp-row">
          <select
            id="insp-font"
            className="insp-input"
            value={style.font}
            onChange={(e) => patch({ font: e.target.value as NodeFont })}
          >
            {FONTS.map((f) => (
              <option key={f} value={f}>
                {FONT_LABELS[f]}
              </option>
            ))}
          </select>
          <select
            className="insp-input"
            aria-label="Font weight"
            // The stylesheet default is 600, which is not on offer — show it as
            // Bold rather than leaving the select blank.
            value={style.fontWeight >= 600 ? 700 : 400}
            onChange={(e) => patch({ fontWeight: Number(e.target.value) })}
          >
            {WEIGHTS.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
              </option>
            ))}
          </select>
        </div>

        <div className="insp-row">
          <input
            className="insp-range"
            type="range"
            min={9}
            max={40}
            step={1}
            aria-label="Font size"
            value={style.fontSize}
            onChange={(e) => patch({ fontSize: Number(e.target.value) }, 'fontSize')}
          />
          <span className="insp-value">{style.fontSize}px</span>
          <button
            className={`btn ghost${style.italic ? ' active' : ''}`}
            style={{ padding: '4px 10px', fontStyle: 'italic', fontFamily: 'Georgia, serif' }}
            title="Italic"
            aria-pressed={style.italic}
            onClick={() => patch({ italic: !style.italic })}
          >
            I
          </button>
        </div>

        <div className="insp-row" style={{ gap: '6px' }}>
          <button
            className={`insp-swatch default${style.color === undefined ? ' active' : ''}`}
            title="Theme default"
            onClick={() => patch({ color: undefined })}
          />
          {COLORS.map((c) => (
            <button
              key={c.value}
              className={`insp-swatch${style.color === c.value ? ' active' : ''}`}
              style={{ backgroundColor: c.value }}
              title={c.name}
              onClick={() => patch({ color: c.value })}
            />
          ))}
        </div>
      </div>

      {/* ---- Presentation step ---- */}
      <div className="insp-group">
        <label className="insp-label">
          Appears on step{multi && ' (all selected)'}
        </label>
        <div className="insp-row">
          <button
            className="btn ghost"
            style={{ padding: '4px 10px' }}
            title="Reveal one step earlier"
            disabled={nodeSlide === 0}
            onClick={() => setNodeStep(targets, prevStep)}
          >
            −
          </button>
          <span className="insp-value" style={{ minWidth: '52px' }}>
            Step {nodeSlide + 1}
          </span>
          <button
            className="btn ghost"
            style={{ padding: '4px 10px' }}
            title="Reveal one step later"
            onClick={() => setNodeStep(targets, nextStep)}
          >
            +
          </button>
        </div>
        <div className="hint" style={{ margin: '2px 2px 0' }}>
          {nodeSlide > 0
            ? `Hidden until step ${nodeSlide + 1} of ${usedSteps.length}. Children never appear before their parent.`
            : 'Visible from the first step.'}
        </div>
      </div>

      {/* ---- Branch thickness & style ---- */}
      <div className="insp-group">
        <label className="insp-label" htmlFor="insp-branch">
          Branch
        </label>
        <div className="insp-row" style={{ marginBottom: '8px', gap: '6px' }}>
          <button
            className={`btn ghost${!node.triangle ? ' active' : ''}`}
            style={{ flex: 1, fontSize: '12px', padding: '4px 8px' }}
            onClick={() => setNodeTriangle(targets, false)}
          >
            Line
          </button>
          <button
            className={`btn ghost${node.triangle ? ' active' : ''}`}
            style={{ flex: 1, fontSize: '12px', padding: '4px 8px' }}
            onClick={() => setNodeTriangle(targets, true)}
          >
            ▲ Triangle
          </button>
        </div>
        <div className="insp-row">
          <input
            id="insp-branch"
            className="insp-range"
            type="range"
            min={0.5}
            max={6}
            step={0.5}
            value={style.branchWidth}
            onChange={(e) => patch({ branchWidth: Number(e.target.value) }, 'branchWidth')}
          />
          <span className="insp-value">{style.branchWidth}</span>
        </div>
        <div className="hint" style={{ margin: '2px 2px 0' }}>
          Sets the branch running down into {multi ? 'each selected node' : 'this node'} from its
          parent.
        </div>
      </div>

      {/* ---- Features ---- */}
      <div className="insp-group">
        <label className="insp-label" htmlFor="insp-feature">
          Features
        </label>
        {(node.features ?? []).length > 0 && (
          <div className="feature-chips">
            {(node.features ?? []).map((f) => (
              // Same colour the tag renders in on the canvas, so the inspector
              // and the tree agree at a glance.
              <span
                key={f}
                className="feature-chip"
                style={{ '--tag-color': featureColor(f) } as React.CSSProperties}
              >
                {f}
                <button
                  className="feature-chip-x"
                  title={`Remove ${f}`}
                  aria-label={`Remove feature ${f}`}
                  onClick={() => removeFeature(f)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="insp-row">
          <input
            id="insp-feature"
            className="insp-input"
            placeholder="+wh, uCase:nom"
            spellCheck={false}
            value={featureDraft}
            onChange={(e) => setFeatureDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addFeature();
              }
            }}
          />
          <button
            className="btn ghost"
            style={{ padding: '5px 9px' }}
            disabled={!featureDraft.trim()}
            onClick={addFeature}
          >
            <PlusIcon /> Add
          </button>
        </div>
      </div>
    </div>
  );
}
