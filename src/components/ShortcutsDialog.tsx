import { Keyboard } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { SHORTCUT_GROUPS } from '../model/shortcuts';
import { useUiStore } from '../store/uiStore';

function Key({ children }: { children: string }) {
  return (
    <kbd className="inline-flex min-w-[24px] items-center justify-center rounded-[5px] border border-border-strong border-b-2 bg-bg-elevated px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[11px] font-semibold text-text shadow-sm">
      {children}
    </kbd>
  );
}

export function ShortcutsDialog({ trigger }: { trigger?: React.ReactNode }) {
  const open = useUiStore((s) => s.shortcutsOpen);
  const setOpen = useUiStore((s) => s.setShortcutsOpen);
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
    <section key={group.title} className="flex flex-col rounded-xl border border-border/70 bg-bg-panel/70 p-3 shadow-sm">
      <div className="mb-1.5 flex items-center justify-between border-b border-border/40 pb-1.5">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-text-dim">
          {group.title}
        </h3>
        <span className="text-[10px] font-medium text-text-faint">{group.entries.length} items</span>
      </div>
      <dl className="flex flex-col">
        {group.entries.map((entry) => (
          <div
            key={entry.label}
            className="flex items-center justify-between gap-3 border-b border-border/30 py-1.5 last:border-0"
          >
            <dt className="min-w-0 text-xs font-medium text-text leading-tight">
              {entry.label}
              {entry.note && (
                <span className="block text-[10px] text-text-dim mt-0.5">{entry.note}</span>
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            className="btn icon ghost"
            title="Keyboard shortcuts (?)"
            aria-label="Keyboard shortcuts"
          >
            <Keyboard size={16} />
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-5 sm:p-6">
        <DialogHeader className="mb-0">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <Keyboard size={18} />
            </span>
            <div className="flex-1 pr-6">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base font-bold text-text">Canvas Keyboard Shortcuts</DialogTitle>
                <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent">
                  Canvas Workspace
                </span>
              </div>
              <DialogDescription className="mt-1 text-xs text-text-dim leading-relaxed">
                These shortcuts are active <strong>exclusively on the tree canvas</strong>. Keys are ignored while typing in text fields or renaming nodes.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="overflow-y-auto pr-1 mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="flex flex-col gap-3.5">
            {col1.map(renderGroup)}
          </div>
          <div className="flex flex-col gap-3.5">
            {col2.map(renderGroup)}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
