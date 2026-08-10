import { BracketEditor } from './components/BracketEditor';
import { LatexOutput } from './components/LatexOutput';
import { NodeInspector } from './components/NodeInspector';
import { FeatureBundleLibrary } from './components/FeatureBundleLibrary';
import { NodeLibrary } from './components/NodeLibrary';
import { SymbolLibrary } from './components/SymbolLibrary';
import { TemplatePicker } from './components/TemplatePicker';
import { ToastHost } from './components/ToastHost';
import { Toolbar } from './components/Toolbar';
import { TreeCanvas } from './components/TreeCanvas';
import { SaveToLectureBanner } from './components/lecture/SaveToLectureBanner';
import { CreateAssignmentBanner } from './components/assignment/CreateAssignmentBanner';
import { AssignmentWorkBanner } from './components/assignment/AssignmentWorkBanner';
import { GradingPanel } from './components/assignment/GradingPanel';
import { useLibraryShortcuts } from './hooks/useLibraryShortcuts';
import { usePersistence } from './hooks/usePersistence';
import { useUiStore } from './store/uiStore';

export default function App() {
  // usePersistence replaced useCloudSync in the Supabase move — same job
  // (restore the session tree, save it back), so only one of them runs.
  usePersistence();
  useLibraryShortcuts();

  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const rightpaneOpen = useUiStore((s) => s.rightpaneOpen);
  const appMode = useUiStore((s) => s.appMode);
  
  // Detect if we are in grading mode
  const searchParams = new URLSearchParams(window.location.search);
  const isGrading = !!searchParams.get('grade');

  let gridCols = '';
  if (sidebarOpen && !isGrading) gridCols += '244px ';
  gridCols += '1fr';
  if (rightpaneOpen || isGrading) gridCols += ' 340px';

  return (
    <div className="app">
      <Toolbar />
      <div className="layout" style={{ gridTemplateColumns: gridCols }}>
        {sidebarOpen && !isGrading && (
          <aside className="sidebar">
            <NodeLibrary />
            <SymbolLibrary />
            <FeatureBundleLibrary />
            <TemplatePicker />
          </aside>
        )}

        <main style={{ minWidth: 0, position: 'relative' }}>
          <TreeCanvas />
          <SaveToLectureBanner />
          <CreateAssignmentBanner />
          <AssignmentWorkBanner />
        </main>

        {(rightpaneOpen || isGrading) && (
          <aside className="rightpane flex flex-col">
            {isGrading ? (
              <GradingPanel />
            ) : (
              <>
                <NodeInspector />
                <BracketEditor />
                {appMode === 'instructor' && <LatexOutput />}
              </>
            )}
          </aside>
        )}
      </div>
      <ToastHost />
    </div>
  );
}
