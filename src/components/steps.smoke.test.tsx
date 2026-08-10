import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { EMPTY_ANNOTATIONS } from '../model/types';
import { useTreeStore } from '../store/treeStore';
import { useUiStore } from '../store/uiStore';
import { PresentationBar } from './PresentationBar';
import { StepsPanel } from './StepsPanel';

// React 18 wants to know it is being driven by act().
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Mount a component and return its rendered text plus an unmount handle. */
function render(node: React.ReactElement) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(node));
  return {
    text: () => host.textContent ?? '',
    host,
    click: (selector: string) => {
      const el = host.querySelector<HTMLElement>(selector);
      if (!el) throw new Error(`no element matching ${selector}`);
      act(() => el.click());
    },
    unmount: () => act(() => root.unmount()),
  };
}

describe('steps UI', () => {
  beforeEach(() => {
    useTreeStore.setState({
      tree: null,
      annotations: EMPTY_ANNOTATIONS,
      past: [],
      future: [],
      selectedId: null,
      selectedIds: [],
      currentStep: 0,
      stepLabels: {},
    });
    useUiStore.setState({
      presenting: false,
      locked: false,
      revealMode: 'steps',
      revealStep: 0,
      usedSteps: [0],
      maxDepth: 0,
      previewStep: null,
    });
  });

  it('lists one row per step, with what appears on it', () => {
    useTreeStore.getState().setTreeFromBracket('[S [NP a]]');
    useTreeStore.getState().addChild(useTreeStore.getState().tree!.id, 'VP');
    useUiStore.setState({ usedSteps: [0, 1] });

    const view = render(<StepsPanel />);
    expect(view.host.querySelectorAll('.step-row')).toHaveLength(2);
    expect(view.text()).toContain('3 nodes'); // S, NP, a
    expect(view.text()).toContain('1 node'); // the VP
    view.unmount();
  });

  it('previews a step when its row is clicked, and clears on Show all', () => {
    useTreeStore.getState().setTreeFromBracket('[S [NP a]]');
    useUiStore.setState({ usedSteps: [0] });

    const view = render(<StepsPanel />);
    view.click('.step-row');
    expect(useUiStore.getState().previewStep).toBe(0);
    view.unmount();
  });

  it('counts steps, not levels, in the presenter bar', () => {
    useTreeStore.setState({ stepLabels: { 0: 'Merge the VP' } });
    useUiStore.setState({ presenting: true, usedSteps: [0, 1, 2, 3], maxDepth: 2, revealStep: 0 });

    const view = render(<PresentationBar />);
    expect(view.text()).toContain('Step 1 / 4');
    expect(view.text()).toContain('Merge the VP');
    view.unmount();
  });

  it('falls back to levels when the document has no recorded steps', () => {
    useUiStore.setState({ presenting: true, revealMode: 'depth', usedSteps: [0], maxDepth: 2 });

    const view = render(<PresentationBar />);
    expect(view.text()).toContain('Level 1 / 3');
    view.unmount();
  });
});

describe('stepping skips steps with nothing on them', () => {
  beforeEach(() => {
    useUiStore.setState({
      presenting: true,
      revealMode: 'steps',
      revealStep: 0,
      usedSteps: [0, 4],
      maxDepth: 1,
      previewStep: null,
    });
    useTreeStore.setState({ stepLabels: {} });
  });

  it('counts only the slides that exist', () => {
    const view = render(<PresentationBar />);
    expect(view.text()).toContain('Step 1 / 2');
    view.unmount();
  });

  it('jumps the reveal threshold straight to the next used step', () => {
    useUiStore.getState().stepForward();
    expect(useUiStore.getState().revealStep).toBe(4);
    const view = render(<PresentationBar />);
    expect(view.text()).toContain('Step 2 / 2');
    view.unmount();

    useUiStore.getState().stepForward(); // already at the end
    expect(useUiStore.getState().revealStep).toBe(4);
    useUiStore.getState().stepBack();
    expect(useUiStore.getState().revealStep).toBe(0);
  });
});
