import { Link } from 'react-router-dom';
import { ChevronDown, GitBranch, LogOut, Moon, Sun, User } from 'lucide-react';
import { TreeLogo } from '../icons';
import { ProfileAvatar } from '../ui/avatar';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { useAuthStore } from '../../store/authStore';
import { useUiStore } from '../../store/uiStore';

/** Header for the Tailwind-based screens (dashboards, course/lecture pages) —
 *  distinct from the SVG-canvas Toolbar.tsx used inside the editor itself.
 *  Includes its own theme toggle since the editor's Toolbar is the only
 *  other place one exists, and these screens are usually reached first. */
export function AppHeader({ children }: { children?: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);

  return (
    <header className="flex items-center gap-4 border-b border-border bg-bg-panel px-6 py-2.5 shadow-[0_1px_0_rgba(40,50,90,0.04)]">
      <Link
        to="/dashboard"
        className="flex items-center gap-2 font-[family-name:var(--font-display)] text-[15px] font-bold text-text no-underline"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] bg-accent-soft text-accent">
          <TreeLogo style={{ width: 18, height: 18 }} />
        </span>
        SyntaxTree
      </Link>
      <div className="flex-1">{children}</div>
      {user && (
        <Link
          to="/editor"
          title="Open the free-form tree canvas"
          className="inline-flex items-center gap-1.5 rounded-full border border-accent bg-bg-elevated px-3 py-1.5 text-xs font-semibold text-accent no-underline transition-colors hover:bg-accent hover:text-white"
        >
          <GitBranch size={14} /> Canvas
        </Link>
      )}
      <Button
        variant="ghost"
        size="sm"
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        onClick={toggleTheme}
      >
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </Button>
      {user && (
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 outline-none transition-colors hover:bg-bg-input">
            <ProfileAvatar seed={user.id} name={user.displayName} className="h-8 w-8 ring-2 ring-bg-panel" />
            <ChevronDown size={14} className="text-text-faint" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>
              <div className="flex items-center gap-2">
                <ProfileAvatar seed={user.id} name={user.displayName} className="h-8 w-8" />
                <div>
                  <div className="font-semibold text-text">{user.displayName}</div>
                  <div className="font-normal capitalize text-text-dim">{user.role}</div>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/profile">
                <User size={14} /> Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => logout()}>
              <LogOut size={14} /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </header>
  );
}
