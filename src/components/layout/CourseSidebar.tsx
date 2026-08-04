import { NavLink } from 'react-router-dom';
import { BookOpen, ClipboardList, Users } from 'lucide-react';
import { cn } from '../../lib/utils';

const NAV_ITEMS = [
  { to: 'lectures', label: 'Lectures', icon: BookOpen },
  { to: 'assignments', label: 'Assignments', icon: ClipboardList },
  { to: 'participants', label: 'Participants', icon: Users },
];

/** The nav-link portion of the course's left rail — rendered inside
 *  CourseShell's <aside>, below the course identity block. Not its own
 *  bordered column; the parent <aside> owns the border/width/background so
 *  the whole rail (identity + nav) reads as one continuous surface. */
export function CourseSidebar({ role, collapsed = false }: { role: 'student' | 'instructor', collapsed?: boolean }) {
  const items = NAV_ITEMS.filter((item) => role === 'instructor' || item.to !== 'participants');

  return (
    <nav className="flex-1 py-3">
      <ul className={cn("flex flex-col gap-0.5 list-none", collapsed ? "px-2" : "px-3")}>
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-full px-3.5 py-2 text-sm font-semibold tracking-tight no-underline transition-colors',
                  'font-[family-name:var(--font-display)]',
                  collapsed ? 'justify-center px-0' : 'px-3.5',
                  isActive
                    ? 'bg-accent text-white'
                    : 'text-text-dim dark:text-gray-200 hover:bg-bg-input hover:text-text dark:hover:text-white',
                )
              }
            >
              <Icon size={16} className="shrink-0" />
              {!collapsed && label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
