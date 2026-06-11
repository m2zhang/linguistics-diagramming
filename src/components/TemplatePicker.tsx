import { TEMPLATES, templateToTree } from '../model/templates';
import { useTreeStore } from '../store/treeStore';
import { useUiStore } from '../store/uiStore';

export function TemplatePicker() {
  const replaceTree = useTreeStore((s) => s.replaceTree);
  const toast = useUiStore((s) => s.toast);

  return (
    <div className="section">
      <div className="panel-title">Templates</div>
      <div className="template-list">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            className="template"
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
