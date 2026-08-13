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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Keyboard shortcuts</CardTitle>
        <CardDescription>
          Everything the tree canvas responds to. Keys are ignored while you are typing in a
          field or renaming a node.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
          {groups.map((group) => (
            <section key={group.title}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-dim">
                {group.title}
              </h3>
              <dl className="flex flex-col">
                {group.entries.map((entry) => (
                  <div
                    key={entry.label}
                    className="flex items-baseline justify-between gap-4 border-b border-border/60 py-1.5 last:border-0"
                  >
                    <dt className="min-w-0 text-sm">
                      {entry.label}
                      {entry.note && (
                        <span className="block text-xs text-text-faint">{entry.note}</span>
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
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
