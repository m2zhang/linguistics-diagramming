import { BracketEditor } from './components/BracketEditor';
import { LatexOutput } from './components/LatexOutput';
import { NodeInspector } from './components/NodeInspector';
import { NodeLibrary } from './components/NodeLibrary';
import { SymbolLibrary } from './components/SymbolLibrary';
import { TemplatePicker } from './components/TemplatePicker';
import { ToastHost } from './components/ToastHost';
import { Toolbar } from './components/Toolbar';
import { TreeCanvas } from './components/TreeCanvas';
import { SaveToLectureBanner } from './components/lecture/SaveToLectureBanner';
import { CreateAssignmentBanner } from './components/assignment/CreateAssignmentBanner';
import { AssignmentWorkBanner } from './components/assignment/AssignmentWorkBanner';
import { GradeBanner } from './components/assignment/GradeBanner';
import { usePersistence } from './hooks/usePersistence';
import { useUiStore } from './store/uiStore';

export default function App() {
  usePersistence();
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const rightpaneOpen = useUiStore((s) => s.rightpaneOpen);
  const appMode = useUiStore((s) => s.appMode);

  let gridCols = '';
  if (sidebarOpen) gridCols += '244px ';
  gridCols += '1fr';
  if (rightpaneOpen) gridCols += ' 340px';

  return (
    <div className="app">
      <Toolbar />
      <div className="layout" style={{ gridTemplateColumns: gridCols }}>
        {sidebarOpen && (
          <aside className="sidebar">
            <NodeLibrary />
            <SymbolLibrary />
            <TemplatePicker />
          </aside>
        )}

        <main style={{ minWidth: 0, position: 'relative' }}>
          <TreeCanvas />
          <SaveToLectureBanner />
          <CreateAssignmentBanner />
          <AssignmentWorkBanner />
          <GradeBanner />
        </main>

        {rightpaneOpen && (
          <aside className="rightpane">
            <NodeInspector />
            <BracketEditor />
            {appMode === 'instructor' && <LatexOutput />}
          </aside>
        )}
      </div>
      <ToastHost />
    </div>
  );
}
