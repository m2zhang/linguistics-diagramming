import { useState } from 'react';
import { LayoutGrid, Star, Archive, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { cn } from '../../lib/utils';

export type DashboardView = 'mine' | 'favorites' | 'archived';

const ITEMS: { key: DashboardView; label: string; icon: typeof LayoutGrid }[] = [
  { key: 'mine', label: 'My Courses', icon: LayoutGrid },
  { key: 'favorites', label: 'Favorites', icon: Star },
  { key: 'archived', label: 'Archived', icon: Archive },
];

/** Left rail for the dashboards — filters the course grid by the viewer's
 *  own preferences (favorite/archived), not a route change, since it's just
 *  a client-side filter over an already-fetched list. Collapsible to an
 *  icon-only rail; the icon itself keeps a native title tooltip so the
 *  label is still reachable on hover once collapsed. */
export function DashboardSidebar({ view, onChange }: { view: DashboardView; onChange: (v: DashboardView) => void }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col border-r border-border bg-bg-panel py-4 transition-[width]',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      <div className={cn('mb-2 flex px-3', collapsed ? 'justify-center' : 'justify-end')}>
        <button
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={() => setCollapsed((c) => !c)}
          className="flex h-8 w-8 items-center justify-center rounded-full text-text-dim transition-colors hover:bg-bg-input hover:text-text"
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      <nav>
        <ul className={cn('flex flex-col gap-0.5', collapsed ? 'px-2' : 'px-3')}>
          {ITEMS.map(({ key, label, icon: Icon }) => (
            <li key={key}>
              <button
                title={label}
                onClick={() => onChange(key)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-full py-2 text-left text-sm font-semibold tracking-tight transition-colors',
                  'font-[family-name:var(--font-display)]',
                  collapsed ? 'justify-center px-0' : 'px-3.5',
                  view === key ? 'bg-accent text-white' : 'text-text-dim hover:bg-bg-input hover:text-text',
                )}
              >
                <Icon size={16} className="shrink-0" />
                {!collapsed && label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
