import { useState } from 'react';
import {
  FEATURE_BUNDLES,
  FEATURE_DND_TYPE,
  featureColor,
  findBundle,
} from '../model/features';
import { findNode, useTreeStore } from '../store/treeStore';
import { useUiStore } from '../store/uiStore';

/**
 * Draggable, colour-coded syntactic features.
 *
 * Drag a chip onto any node to attach it, or click to apply it to the current
 * selection. The colour on the chip is the colour the tag renders in on the
 * canvas — both come from featureColor(), so they cannot drift apart.
 *
 * Deliberately NOT gated on appMode: the Node Inspector already lets a student
 * add features by typing, so hiding the chips would only make the same action
 * harder, not restrict it.
 */
export function FeatureBundleLibrary() {
  const tree = useTreeStore((s) => s.tree);
  const selectedIds = useTreeStore((s) => s.selectedIds);
  const addNodeFeature = useTreeStore((s) => s.addNodeFeature);
  const customFeatures = useUiStore((s) => s.customFeatures);
  const addCustomFeature = useUiStore((s) => s.addCustomFeature);
  const removeCustomFeature = useUiStore((s) => s.removeCustomFeature);
  const toast = useUiStore((s) => s.toast);

  const [draft, setDraft] = useState('');

  const onDragStart = (e: React.DragEvent, label: string) => {
    e.dataTransfer.setData(FEATURE_DND_TYPE, label);
    // Intentionally no text/plain: TreeCanvas falls back to that for symbol
    // drops, which would rename the node instead of tagging it.
    e.dataTransfer.effectAllowed = 'copy';
  };

  /** Apply to every selected tree node, so a whole layer can be tagged at once. */
  const applyToSelection = (label: string) => {
    const nodeIds = selectedIds.filter((id) => findNode(tree, id) !== null);
    if (nodeIds.length === 0) {
      toast('Select a node first, or drag the tag onto one.', 'info');
      return;
    }
    const added = nodeIds.filter((id) => addNodeFeature(id, label)).length;
    if (added === 0) {
      toast(`Already tagged [${label}]`, 'info');
    } else {
      toast(`Added [${label}] to ${added} node${added === 1 ? '' : 's'}`, 'success');
    }
  };

  const submitCustom = () => {
    const value = draft.trim().replace(/^\[|\]$/g, '').trim();
    if (!value) return;
    if (findBundle(value)) {
      toast(`[${value}] is already a built-in tag`, 'info');
      setDraft('');
      return;
    }
    addCustomFeature(value);
    setDraft('');
  };

  const chip = (label: string, id: number | null, description: string, custom = false) => {
    const color = featureColor(label);
    return (
      <div
        key={label}
        className="feature-bundle"
        style={{ '--tag-color': color } as React.CSSProperties}
        draggable
        onDragStart={(e) => onDragStart(e, label)}
        onClick={() => applyToSelection(label)}
        title={`${description} — drag onto a node, or click to tag the selection`}
      >
        <span className="feature-bundle-id">{id ?? '•'}</span>
        <span className="feature-bundle-label">[{label}]</span>
        {custom && (
          <button
            className="feature-bundle-x"
            title={`Remove [${label}] from the library`}
            aria-label={`Remove ${label} from the library`}
            onClick={(e) => {
              e.stopPropagation();
              removeCustomFeature(label);
            }}
          >
            ×
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="section feature-bundle-library">
      <div className="panel-header" style={{ marginBottom: '12px' }}>
        <div className="panel-title" style={{ margin: 0 }}>Feature Bundles</div>
      </div>

      <div className="feature-bundle-list">
        {FEATURE_BUNDLES.map((b) => chip(b.label, b.id, b.description))}
        {customFeatures.map((label) =>
          chip(label, null, 'Custom feature', true),
        )}
      </div>

      <div className="insp-row" style={{ marginTop: '10px' }}>
        <input
          className="insp-input"
          placeholder="+nom, φ:3sg…"
          aria-label="Add a custom feature"
          spellCheck={false}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submitCustom();
            }
          }}
        />
        <button
          className="btn ghost"
          style={{ padding: '5px 9px' }}
          disabled={!draft.trim()}
          onClick={submitCustom}
        >
          Add
        </button>
      </div>

      <div className="hint" style={{ marginTop: '10px' }}>
        Drag a tag onto any node, or select nodes and click. Tag colours are
        reserved — the pen and highlighter use a different palette.
      </div>
    </div>
  );
}
