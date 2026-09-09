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
  const [width, setWidth] = useState(240);
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = moveEvent.clientX;
      if (newWidth < 120) {
        setCollapsed(true);
      } else {
        setCollapsed(false);
        setWidth(Math.min(Math.max(newWidth, 180), 420));
      }
    };

    const onMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return (
    <aside
      style={{ width: collapsed ? 64 : width }}
      className={cn(
        'relative flex shrink-0 flex-col border-r border-border app-rail py-4 select-none',
        !isResizing && 'transition-[width] duration-200'
      )}
    >
      {/* Boundary Slider / Resizer Handle */}
      <div
        onMouseDown={startResizing}
        onDoubleClick={() => setCollapsed((c) => !c)}
        title="Drag boundary to resize sidebar (double-click to toggle)"
        className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize flex items-center justify-center group z-20"
      >
        <div className="w-1 h-12 rounded-full bg-border/80 group-hover:bg-accent group-hover:h-16 group-hover:w-1.5 transition-all shadow-sm" />
      </div>

      <div className={cn("flex items-center pb-3 mb-1 px-3 border-b border-border/40", collapsed ? "justify-center" : "justify-between")}>
        {!collapsed && <span className="text-xs font-semibold uppercase tracking-wider text-text-dim/70">Menu</span>}
        <button
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={() => setCollapsed((c) => !c)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-text-dim hover:bg-bg-input hover:text-text transition-colors"
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      <nav>
        <ul className={cn('flex flex-col gap-0.5 list-none', collapsed ? 'px-2' : 'px-3')}>
          {ITEMS.map(({ key, label, icon: Icon }) => (
            <li key={key}>
              <button
                title={label}
                onClick={() => onChange(key)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-full py-2 text-left text-sm font-semibold tracking-tight transition-colors',
                  'font-[family-name:var(--font-display)]',
                  collapsed ? 'justify-center px-0' : 'px-3.5',
                  view === key ? 'bg-accent text-white' : 'text-text hover:bg-bg-input hover:text-text',
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
