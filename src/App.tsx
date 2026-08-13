import { BracketEditor } from './components/BracketEditor';
import { LatexOutput } from './components/LatexOutput';
import { NodeInspector } from './components/NodeInspector';
import { FeatureBundleLibrary } from './components/FeatureBundleLibrary';
import { NodeLibrary } from './components/NodeLibrary';
import { PresentationBar } from './components/PresentationBar';
import { StepsPanel } from './components/StepsPanel';
import { SymbolLibrary } from './components/SymbolLibrary';
import { TemplatePicker } from './components/TemplatePicker';
import { ToastHost } from './components/ToastHost';
import { Toolbar } from './components/Toolbar';
import { TreeCanvas } from './components/TreeCanvas';
import { SaveToLectureBanner } from './components/lecture/SaveToLectureBanner';
import { CreateAssignmentBanner } from './components/assignment/CreateAssignmentBanner';
import { AssignmentWorkBanner } from './components/assignment/AssignmentWorkBanner';
import { GradingPanel } from './components/assignment/GradingPanel';
import { usePersistence } from './hooks/usePersistence';
import { useUiStore } from './store/uiStore';

export default function App() {
  // usePersistence replaced useCloudSync in the Supabase move — same job
  // (restore the session tree, save it back), so only one of them runs.
  // F1-F9 used to be bound here by useLibraryShortcuts; TreeCanvas now owns
  // every canvas key so they cannot fire twice and so the locked/presenting
  // rules apply to them too.
  usePersistence();

  const appMode = useUiStore((s) => s.appMode);
  
  // Detect if we are in grading mode
  const searchParams = new URLSearchParams(window.location.search);
  const isGrading = !!searchParams.get('grade');
  const presenting = useUiStore((s) => s.presenting);
  // Presenting always runs edge-to-edge, whatever the panels were set to.
  const sidebarOpen = useUiStore((s) => s.sidebarOpen) && !presenting;
  const rightpaneOpen = useUiStore((s) => s.rightpaneOpen) && !presenting;

  let gridCols = '';
  if (sidebarOpen && !isGrading) gridCols += '244px ';
  gridCols += '1fr';
  if (rightpaneOpen || isGrading) gridCols += ' 340px';

  return (
    <div className={`app${presenting ? ' presenting' : ''}`}>
      {presenting ? <PresentationBar /> : <Toolbar />}
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
                <StepsPanel />
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
