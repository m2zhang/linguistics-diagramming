import { useSearchParams } from 'react-router-dom';
import { useTreeStore } from '../store/treeStore';
import { useUiStore } from '../store/uiStore';
import { useAuthStore } from '../store/authStore';
import { BackButton } from './ui/back-button';
import { PENDING_ASSIGNMENT_KEY, type PendingAssignment } from './assignment/AssignmentEditor';
import {
  DownloadIcon,
  ImageIcon,
  LockIcon,
  MoonIcon,
  PresentIcon,
  SunIcon,
  TrashIcon,
  TreeLogo,
} from './icons';

function SidebarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
    </svg>
  );
}

function RightPaneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </svg>
  );
}

export function Toolbar() {
  const tree = useTreeStore((s) => s.tree);
  const clear = useTreeStore((s) => s.clear);
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const rightpaneOpen = useUiStore((s) => s.rightpaneOpen);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const toggleRightpane = useUiStore((s) => s.toggleRightpane);
  const appMode = useUiStore((s) => s.appMode);
  const locked = useUiStore((s) => s.locked);
  const toggleLocked = useUiStore((s) => s.toggleLocked);
  const startPresenting = useUiStore((s) => s.startPresenting);
  const toast = useUiStore((s) => s.toast);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [params] = useSearchParams();

  // The editor is entered from several different places (a lecture's tree,
  // an assignment's draft, grading a submission, authoring a brand-new
  // template), each of which stashes where it came from in the URL (or, for
  // the not-yet-created-assignment case, in sessionStorage — there's no
  // assignment id yet to put in the URL). The back button should return
  // there instead of always dumping the user at the dashboard.
  const courseId = params.get('courseId');
  const { backTo, backLabel } = (() => {
    if (params.get('assignment') && courseId) {
      return { backTo: `/courses/${courseId}/assignments/${params.get('assignment')}`, backLabel: 'Assignment' };
    }
    if (params.get('saveToLecture') && courseId) {
      return { backTo: `/courses/${courseId}/lectures/${params.get('saveToLecture')}`, backLabel: 'Lecture' };
    }
    if (params.get('viewLecture') && courseId) {
      return { backTo: `/courses/${courseId}/lectures/${params.get('viewLecture')}`, backLabel: 'Lecture' };
    }
    if (params.get('viewAssignment') && courseId) {
      return { backTo: `/courses/${courseId}/assignments/${params.get('viewAssignment')}`, backLabel: 'Assignment' };
    }
    if (params.get('grade') && courseId && params.get('assignmentId')) {
      return {
        backTo: `/courses/${courseId}/assignments/${params.get('assignmentId')}/submissions`,
        backLabel: 'Submissions',
      };
    }
    if (params.get('newAssignmentDraft')) {
      const raw = sessionStorage.getItem(PENDING_ASSIGNMENT_KEY);
      const pending: PendingAssignment | null = raw ? JSON.parse(raw) : null;
      if (pending) return { backTo: `/courses/${pending.courseId}/assignments`, backLabel: 'Assignments' };
    }
    return { backTo: '/dashboard', backLabel: 'Dashboard' };
  })();

  const guard = () => {
    if (!tree) {
      toast('Nothing to export yet', 'error');
      return false;
    }
    return true;
  };

  const doPng = async () => {
    if (!guard()) return;
    try {
      const { exportPng } = await import('../export/exportImage');
      await exportPng(tree!);
      toast('PNG downloaded', 'success');
    } catch {
      toast('PNG export failed', 'error');
    }
  };

  const doPdf = async () => {
    if (!guard()) return;
    try {
      const { exportPdf } = await import('../export/exportPdf');
      await exportPdf(tree!);
      toast('PDF downloaded', 'success');
    } catch {
      toast('PDF export failed', 'error');
    }
  };

  const doSvg = async () => {
    if (!guard()) return;
    const { exportSvgFile } = await import('../export/exportImage');
    exportSvgFile(tree!);
    toast('SVG downloaded', 'success');
  };

  return (
    <header className="topbar">
      <div className="brand">
        <TreeLogo className="logo" />
        SyntaxTree
        <span className="sub">Modern linguistics tree editor</span>
      </div>
      {user && <BackButton to={backTo} label={backLabel} />}
      <div className="topbar-spacer" />

      <button className="btn" onClick={doPng}>
        <ImageIcon /> PNG
      </button>
      <button className="btn" onClick={doPdf}>
        <DownloadIcon /> PDF
      </button>
      <button className="btn" onClick={doSvg}>
        <DownloadIcon /> SVG
      </button>
      {appMode === 'instructor' && (
        <button
          className="btn danger"
          title="Clear map to start fresh"
          onClick={() => {
            clear();
            toast('Canvas cleared');
          }}
        >
          <TrashIcon /> Clear Map
        </button>
      )}

      <span className="toolbar-divider" />

      <button
        className="btn"
        title="Present: hide the panels and reveal the tree level by level"
        onClick={() => {
          if (!tree) {
            toast('Nothing to present yet', 'error');
            return;
          }
          startPresenting();
          toast('Presenting — ← / → to step, Esc to exit', 'info');
        }}
      >
        <PresentIcon /> Present
      </button>

      <button
        className={`btn icon ghost${locked ? ' active' : ''}`}
        title={
          locked
            ? 'Editing locked — annotations still allowed. Click to unlock.'
            : 'Lock editing (annotations stay available)'
        }
        aria-pressed={locked}
        onClick={toggleLocked}
      >
        <LockIcon open={!locked} />
      </button>

      <span className="toolbar-divider" />

      {/* Workspace panel toggles */}
      <button
        className={`btn icon ghost${sidebarOpen ? ' active' : ''}`}
        title={sidebarOpen ? 'Hide left sidebar' : 'Show left sidebar'}
        onClick={toggleSidebar}
        aria-pressed={sidebarOpen}
      >
        <SidebarIcon />
      </button>
      
      <button
        className={`btn icon ghost${rightpaneOpen ? ' active' : ''}`}
        title={rightpaneOpen ? 'Hide right panel' : 'Show right panel'}
        onClick={toggleRightpane}
        aria-pressed={rightpaneOpen}
      >
        <RightPaneIcon />
      </button>

      <button
        className="btn icon ghost"
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        onClick={toggleTheme}
      >
        {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
      </button>

      {user && (
        <>
          <span className="toolbar-divider" />
          <span className="hint" title={user.email} style={{ marginRight: 4 }}>
            {user.displayName} · {appMode}
          </span>
          <button className="btn ghost" onClick={() => logout()}>
            Sign out
          </button>
        </>
      )}
    </header>
  );
}
