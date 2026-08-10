import { TEMPLATES, templateToTree } from '../model/templates';
import { useTreeStore } from '../store/treeStore';
import { useUiStore } from '../store/uiStore';

export function TemplatePicker() {
  const replaceTree = useTreeStore((s) => s.replaceTree);
  const toast = useUiStore((s) => s.toast);
  const locked = useUiStore((s) => s.locked);

  return (
    <div className="section">
      <div className="panel-title">Templates</div>
      <div className="template-list">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            className="template"
            disabled={locked}
            title={locked ? 'Editing is locked' : undefined}
            onClick={() => {
              replaceTree(templateToTree(t));
              toast(`Loaded "${t.name}"`, 'success');
            }}
          >
            <div className="t-name">{t.name}</div>
            <div className="t-desc">{t.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
