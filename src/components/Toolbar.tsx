import { useTreeStore } from '../store/treeStore';
import { useUiStore } from '../store/uiStore';
import {
  DownloadIcon,
  ImageIcon,
  MoonIcon,
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
  const toast = useUiStore((s) => s.toast);

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

  const doSaveProject = () => {
    if (!guard()) return;
    try {
      const state = useTreeStore.getState();
      const projectData = {
        tree: state.tree,
        annotations: state.annotations,
        version: '1.0'
      };
      const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'syntax-tree-project.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast('Project JSON downloaded', 'success');
    } catch {
      toast('Project save failed', 'error');
    }
  };

  return (
    <header className="topbar">
      <div className="brand">
        <TreeLogo className="logo" />
        SyntaxTree
        <span className="sub">Modern linguistics tree editor</span>
      </div>
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
      <button className="btn" onClick={doSaveProject} title="Save the current tree and all annotations to a JSON file">
        <DownloadIcon /> Save Project
      </button>
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
    </header>
  );
}
