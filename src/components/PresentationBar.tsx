import { useEffect, useState } from 'react';
import { useTreeStore } from '../store/treeStore';
import { revealIndex, revealTargets, useUiStore } from '../store/uiStore';
import { LockIcon } from './icons';

function ChevronLeft() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function EnterFullscreenIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function ExitFullscreenIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3v3a2 2 0 0 1-2 2H3M16 3v3a2 2 0 0 0 2 2h3M8 21v-3a2 2 0 0 0-2-2H3M16 21v-3a2 2 0 0 1 2-2h3" />
    </svg>
  );
}

/**
 * Presenter controls, shown in place of the top bar while presenting.
 *
 * Owns the presentation keyboard map as well: it is only mounted in
 * presentation mode, so the shortcuts cannot leak into normal editing.
 */
export function PresentationBar() {
  // No named file to show since the cloud file store went away — the root
  // node's label is what the class recognises the tree by.
  const title = useTreeStore((s) => s.tree?.label) ?? 'Untitled tree';
  const revealStep = useUiStore((s) => s.revealStep);
  const slide = useUiStore(revealIndex);
  const slideCount = useUiStore((s) => revealTargets(s).length);
  const revealMode = useUiStore((s) => s.revealMode);
  const setRevealMode = useUiStore((s) => s.setRevealMode);
  const stepCount = useUiStore((s) => s.usedSteps.length);
  const stepName = useTreeStore((s) => s.stepLabels[revealStep]);
  const locked = useUiStore((s) => s.locked);
  const stepForward = useUiStore((s) => s.stepForward);
  const stepBack = useUiStore((s) => s.stepBack);
  const revealAll = useUiStore((s) => s.revealAll);
  const collapseToRoot = useUiStore((s) => s.collapseToRoot);
  const toggleLocked = useUiStore((s) => s.toggleLocked);
  const stopPresenting = useUiStore((s) => s.stopPresenting);

  const [fullscreen, setFullscreen] = useState(() => !!document.fullscreenElement);

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      // A note being typed on the canvas owns the keyboard.
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
        case ' ':
          e.preventDefault();
          stepForward();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          e.preventDefault();
          stepBack();
          break;
        case 'Home':
          e.preventDefault();
          collapseToRoot();
          break;
        case 'End':
          e.preventDefault();
          revealAll();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
        case '?':
          e.preventDefault();
          useUiStore.getState().toggleShortcuts();
          break;
        case 'Escape':
          // Browsers swallow Escape to leave fullscreen; leave the mode on the
          // next press rather than doing both at once.
          if (!document.fullscreenElement) stopPresenting();
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [stepForward, stepBack, revealAll, collapseToRoot, stopPresenting, toggleFullscreen]);

  const unit = revealMode === 'steps' ? 'Step' : 'Level';

  return (
    <header className="presentation-bar">
      <div className="pres-title">{title}</div>

      <div className="pres-steps">
        <button
          className="btn icon ghost"
          title={`Previous ${unit.toLowerCase()} (←)`}
          disabled={slide === 0}
          onClick={stepBack}
        >
          <ChevronLeft />
        </button>
        <span className="pres-counter" aria-live="polite">
          {unit} {slide + 1} / {slideCount}
          {stepName && revealMode === 'steps' && <em className="pres-step-name">{stepName}</em>}
        </span>
        <button
          className="btn icon ghost"
          title={`Next ${unit.toLowerCase()} (→ or Space)`}
          disabled={slide >= slideCount - 1}
          onClick={stepForward}
        >
          <ChevronRight />
        </button>
      </div>

      <div className="pres-actions">
        <button
          className="btn ghost"
          // Only worth offering when the document actually has a build history.
          disabled={stepCount < 2}
          title={
            stepCount < 2
              ? 'This tree has no recorded steps — revealing by level instead'
              : revealMode === 'steps'
                ? 'Revealing how the tree was built. Click to reveal one level at a time instead.'
                : 'Revealing one level at a time. Click to replay how the tree was built.'
          }
          onClick={() => setRevealMode(revealMode === 'steps' ? 'depth' : 'steps')}
        >
          By {revealMode === 'steps' ? 'history' : 'level'}
        </button>
        <span className="toolbar-divider" />
        <button className="btn ghost" title="Back to the start (Home)" onClick={collapseToRoot}>
          Reset
        </button>
        <button className="btn ghost" title="Reveal everything (End)" onClick={revealAll}>
          Reveal all
        </button>
        <span className="toolbar-divider" />
        <button
          className={`btn icon ghost${locked ? ' active' : ''}`}
          title={locked ? 'Editing locked — click to unlock the tree' : 'Editing unlocked — click to lock'}
          aria-pressed={locked}
          onClick={toggleLocked}
        >
          <LockIcon open={!locked} />
        </button>
        <button
          className="btn icon ghost"
          title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          onClick={toggleFullscreen}
        >
          {fullscreen ? <ExitFullscreenIcon /> : <EnterFullscreenIcon />}
        </button>
        <button className="btn" title="Exit presentation (Esc)" onClick={stopPresenting}>
          Exit
        </button>
      </div>
    </header>
  );
}
