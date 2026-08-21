import { FEATURE_BUNDLES, FEATURE_DND_TYPE, featureColor } from '../model/features';
import { findNode, useTreeStore } from '../store/treeStore';
import { useUiStore } from '../store/uiStore';

/**
 * The three draggable, colour-coded syntactic features.
 *
 * Drag a chip onto any node to attach it, or click to apply it to the current
 * selection. The colour on the chip is the colour the tag renders in on the
 * canvas — both come from featureColor(), so they cannot drift apart.
 *
 * The library is fixed at FEATURE_BUNDLES: no free-text field, no way to add a
 * fourth tag from here. Keeping it closed is what makes the three hues mean
 * something — a colour on a node is one of three known features, not whatever
 * the last person happened to invent.
 *
 * Deliberately NOT gated on appMode: the chips are a shortcut, not a privilege.
 */
export function FeatureBundleLibrary() {
  const tree = useTreeStore((s) => s.tree);
  const selectedIds = useTreeStore((s) => s.selectedIds);
  const addNodeFeature = useTreeStore((s) => s.addNodeFeature);
  const toast = useUiStore((s) => s.toast);
  const locked = useUiStore((s) => s.locked);

  const onDragStart = (e: React.DragEvent, label: string) => {
    e.dataTransfer.setData(FEATURE_DND_TYPE, label);
    // Intentionally no text/plain: TreeCanvas falls back to that for symbol
    // drops, which would rename the node instead of tagging it.
    e.dataTransfer.effectAllowed = 'copy';
  };

  /** Apply to every selected tree node, so a whole layer can be tagged at once. */
  const applyToSelection = (label: string) => {
    // Checked before the empty-selection case, so a locked canvas says it is
    // locked rather than telling the user to select a node that would not take
    // the tag anyway. The drop path is already guarded in TreeCanvas.
    if (locked) {
      toast('Editing is locked — unlock it in the top bar to tag nodes.', 'error');
      return;
    }
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

  return (
    <div className="section feature-bundle-library">
      <div className="panel-header" style={{ marginBottom: '12px' }}>
        <div className="panel-title" style={{ margin: 0 }}>Feature Bundles</div>
      </div>

      <div className={`feature-bundle-list${locked ? ' read-only' : ''}`}>
        {FEATURE_BUNDLES.map((b) => (
          <div
            key={b.label}
            className="feature-bundle"
            style={{ '--tag-color': featureColor(b.label) } as React.CSSProperties}
            draggable={!locked}
            onDragStart={(e) => onDragStart(e, b.label)}
            onClick={() => applyToSelection(b.label)}
            title={`${b.description} — drag onto a node, or click to tag the selection`}
          >
            <span className="feature-bundle-id">{b.id}</span>
            <span className="feature-bundle-label">[{b.label}]</span>
          </div>
        ))}
      </div>

      <div className="hint" style={{ marginTop: '10px' }}>
        {locked ? (
          <>Editing is locked. Unlock it in the top bar to tag nodes.</>
        ) : (
          <>
            Drag a tag onto any node, or select nodes and click. These three tags
            and their colours are fixed — the pen and highlighter use a different
            palette.
          </>
        )}
      </div>
    </div>
  );
}
