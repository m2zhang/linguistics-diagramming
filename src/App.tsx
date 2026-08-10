import { BracketEditor } from './components/BracketEditor';
import { LatexOutput } from './components/LatexOutput';
import { NodeInspector } from './components/NodeInspector';
import { NodeLibrary } from './components/NodeLibrary';
import { PresentationBar } from './components/PresentationBar';
import { StepsPanel } from './components/StepsPanel';
import { SymbolLibrary } from './components/SymbolLibrary';
import { TemplatePicker } from './components/TemplatePicker';
import { ToastHost } from './components/ToastHost';
import { Toolbar } from './components/Toolbar';
import { TreeCanvas } from './components/TreeCanvas';
import { useCloudSync } from './hooks/useCloudSync';
import { useUiStore } from './store/uiStore';

export default function App() {
  useCloudSync();
  const presenting = useUiStore((s) => s.presenting);
  // Presenting always runs edge-to-edge, whatever the panels were set to.
  const sidebarOpen = useUiStore((s) => s.sidebarOpen) && !presenting;
  const rightpaneOpen = useUiStore((s) => s.rightpaneOpen) && !presenting;

  let gridCols = '';
  if (sidebarOpen) gridCols += '244px ';
  gridCols += '1fr';
  if (rightpaneOpen) gridCols += ' 340px';

  return (
    <div className={`app${presenting ? ' presenting' : ''}`}>
      {presenting ? <PresentationBar /> : <Toolbar />}
      <div className="layout" style={{ gridTemplateColumns: gridCols }}>
        {sidebarOpen && (
          <aside className="sidebar">
            <NodeLibrary />
            <SymbolLibrary />
            <TemplatePicker />
          </aside>
        )}

        <main style={{ minWidth: 0 }}>
          <TreeCanvas />
        </main>

        {rightpaneOpen && (
          <aside className="rightpane">
            <NodeInspector />
            <StepsPanel />
            <BracketEditor />
            <LatexOutput />
          </aside>
        )}
      </div>
      <ToastHost />
    </div>
  );
}
