import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { SHORTCUT_GROUPS } from '../../model/shortcuts';
import { useUiStore } from '../../store/uiStore';

/** One keycap. */
function Key({ children }: { children: string }) {
  return (
    <kbd className="inline-flex min-w-[26px] items-center justify-center rounded-[5px] border border-border-strong border-b-2 bg-bg-elevated px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[11px] font-semibold text-text">
      {children}
    </kbd>
  );
}

/**
 * The full canvas keyboard reference, rendered straight from SHORTCUT_GROUPS —
 * the same table TreeCanvas dispatches on, so this cannot list a binding that
 * does not work.
 *
 * Instructor-only tools are filtered out for students rather than shown
 * greyed: a student pressing P gets nothing, and a list that says otherwise is
 * worse than a shorter list.
 */
export function ShortcutsReference() {
  const appMode = useUiStore((s) => s.appMode);
  const isInstructor = appMode === 'instructor';

  const groups = SHORTCUT_GROUPS.map((group) => ({
    ...group,
    entries: group.entries.filter((e) => isInstructor || !e.instructorOnly),
  })).filter((group) => group.entries.length > 0);

  // Distribute groups into two balanced vertical columns to avoid CSS grid row-stretching gaps
  const col1: typeof groups = [];
  const col2: typeof groups = [];
  let col1Count = 0;
  let col2Count = 0;

  for (const group of groups) {
    if (col1Count <= col2Count) {
      col1.push(group);
      col1Count += group.entries.length + 2;
    } else {
      col2.push(group);
      col2Count += group.entries.length + 2;
    }
  }

  const renderGroup = (group: (typeof groups)[number]) => (
    <section key={group.title} className="rounded-xl border border-border/70 bg-bg-panel/70 p-3.5 shadow-sm">
      <div className="mb-2 flex items-center justify-between border-b border-border/40 pb-1.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-text-dim">
          {group.title}
        </h3>
        <span className="text-[11px] font-medium text-text-faint">{group.entries.length} items</span>
      </div>
      <dl className="flex flex-col">
        {group.entries.map((entry) => (
          <div
            key={entry.label}
            className="flex items-baseline justify-between gap-4 border-b border-border/30 py-2 last:border-0"
          >
            <dt className="min-w-0 text-sm font-medium text-text">
              {entry.label}
              {entry.note && (
                <span className="block text-xs text-text-dim mt-0.5">{entry.note}</span>
              )}
            </dt>
            <dd className="flex shrink-0 items-center gap-1">
              {entry.keys.map((key) => (
                <Key key={key}>{key}</Key>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Canvas Keyboard Shortcuts</CardTitle>
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent">
            Canvas Workspace
          </span>
        </div>
        <CardDescription>
          These keyboard shortcuts apply exclusively to the tree canvas editor. Keys are ignored while you are typing in a field or renaming a node.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-4">
            {col1.map(renderGroup)}
          </div>
          <div className="flex flex-col gap-4">
            {col2.map(renderGroup)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
