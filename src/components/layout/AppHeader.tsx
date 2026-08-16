import { Link } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { TreeLogo } from '../icons';
import { Button } from '../ui/button';
import { UserMenu } from './UserMenu';
import { ShortcutsDialog } from '../ShortcutsDialog';
import { useUiStore } from '../../store/uiStore';

/** Header for the Tailwind-based screens (dashboards, course/lecture pages) —
 *  distinct from the SVG-canvas Toolbar.tsx used inside the editor itself.
 *  Includes its own theme toggle since the editor's Toolbar is the only
 *  other place one exists, and these screens are usually reached first. */
export function AppHeader({ children }: { children?: React.ReactNode }) {
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

      <ShortcutsDialog />

      <Button
        variant="ghost"
        size="sm"
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        onClick={toggleTheme}
      >
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </Button>

      <UserMenu />
    </header>
  );
}
