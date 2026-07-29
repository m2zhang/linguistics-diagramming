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
export function CourseSidebar() {
  return (
    <nav className="flex-1 py-3">
      <ul className="flex flex-col gap-0.5 px-3">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-full px-3.5 py-2 text-sm font-semibold tracking-tight no-underline transition-colors',
                  'font-[family-name:var(--font-display)]',
                  isActive
                    ? 'bg-accent text-white'
                    : 'text-text-dim hover:bg-bg-input hover:text-text',
                )
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
