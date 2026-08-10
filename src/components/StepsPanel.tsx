import { useMemo, useState } from 'react';
import { TreeNode } from '../model/types';
import { useTreeStore } from '../store/treeStore';
import { useUiStore } from '../store/uiStore';

interface StepTally {
  nodes: number;
  marks: number;
}

/**
 * Count what appears on each step.
 *
 * Nodes are counted against their *effective* step — clamped to their parent's,
 * exactly as the canvas reveals them — so the tally matches what a class sees.
 */
function tallySteps(tree: TreeNode | null, marks: { step?: number }[]): Map<number, StepTally> {
  const out = new Map<number, StepTally>();
  const bump = (step: number, key: keyof StepTally) => {
    const row = out.get(step) ?? { nodes: 0, marks: 0 };
    row[key] += 1;
    out.set(step, row);
  };
  const walk = (node: TreeNode, parentStep: number) => {
    const step = Math.max(node.step ?? 0, parentStep);
    bump(step, 'nodes');
    for (const c of node.children) walk(c, step);
  };
  if (tree) walk(tree, 0);
  for (const m of marks) bump(m.step ?? 0, 'marks');
  return out;
}

function MergeUpIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="18 15 12 9 6 15" />
      <line x1="4" y1="5" x2="20" y2="5" />
    </svg>
  );
}

/**
 * Authoring side of presentation steps.
 *
 * Steps are recorded automatically as the tree is built — one per structural
 * edit — which is finer than any lecture wants. This panel is where that raw
 * history gets shaped: preview a step in place, merge the ones that belong
 * together, name them, or move a selection onto a different step.
 */
export function StepsPanel() {
  const tree = useTreeStore((s) => s.tree);
  const annotations = useTreeStore((s) => s.annotations);
  const selectedIds = useTreeStore((s) => s.selectedIds);
  const stepLabels = useTreeStore((s) => s.stepLabels);
  const currentStep = useTreeStore((s) => s.currentStep);
  const newStep = useTreeStore((s) => s.newStep);
  const setNodeStep = useTreeStore((s) => s.setNodeStep);
  const mergeStepWithPrevious = useTreeStore((s) => s.mergeStepWithPrevious);
  const renameStep = useTreeStore((s) => s.renameStep);

  const usedSteps = useUiStore((s) => s.usedSteps);
  const previewStep = useUiStore((s) => s.previewStep);
  const setPreviewStep = useUiStore((s) => s.setPreviewStep);
  const locked = useUiStore((s) => s.locked);

  const [renaming, setRenaming] = useState<{ step: number; value: string } | null>(null);

  const tally = useMemo(
    () =>
      tallySteps(tree, [
        ...annotations.strokes,
        ...annotations.notes,
        ...(annotations.boxes ?? []),
        ...(annotations.connectors ?? []),
      ]),
    [tree, annotations],
  );

  /**
   * One row per slide. Rows are numbered by position, not by the underlying step
   * number: deleting everything on a step retires it, and the presenter skips it
   * rather than sitting on a blank slide, so the raw numbers are internal.
   */
  const steps = usedSteps;

  /** Slide number of the previewed step, for wording that matches the rows. */
  const previewSlide = previewStep === null ? null : steps.indexOf(previewStep) + 1;

  const commitRename = () => {
    if (renaming) renameStep(renaming.step, renaming.value);
    setRenaming(null);
  };

  return (
    <div className="steps-panel">
      <div className="panel-header">
        <div className="panel-title" style={{ margin: 0 }}>
          Presentation Steps
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            className="btn ghost"
            style={{ padding: '4px 8px', fontSize: '11.5px' }}
            disabled={locked}
            title="Start a new step — whatever you build next is revealed on its own"
            onClick={newStep}
          >
            + Step
          </button>
        </div>
      </div>

      {!tree ? (
        <div className="hint" style={{ margin: '2px' }}>
          Steps record themselves as you build the tree, so presenting replays how it came
          together.
        </div>
      ) : (
        <>
          {previewStep !== null && (
            // Preview dims part of the canvas, which would be alarming if the
            // reason weren't stated somewhere.
            <div className="locked-note" style={{ margin: 0 }}>
              Previewing step {previewSlide} — later steps are hidden on the canvas.
            </div>
          )}
          <div className="step-list">
            {steps.map((step, slide) => {
              const row = tally.get(step);
              const active = previewStep === step;
              const name = stepLabels[step];
              return (
                <div
                  key={step}
                  className={`step-row${active ? ' active' : ''}`}
                  onClick={() => setPreviewStep(active ? null : step)}
                  title={active ? 'Click to stop previewing' : 'Preview what the class sees here'}
                >
                  <span className="step-num">{slide + 1}</span>
                  <div className="step-body">
                    {renaming?.step === step ? (
                      <input
                        className="insp-input step-rename"
                        autoFocus
                        value={renaming.value}
                        placeholder="Name this step"
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setRenaming({ step, value: e.target.value })}
                        onBlur={commitRename}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename();
                          if (e.key === 'Escape') setRenaming(null);
                        }}
                      />
                    ) : (
                      <button
                        className="step-name"
                        title="Rename this step"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenaming({ step, value: name ?? '' });
                        }}
                      >
                        {name ?? <span className="step-name-empty">Step {slide + 1}</span>}
                      </button>
                    )}
                    <span className="step-meta">
                      {row
                        ? [
                            row.nodes > 0 && `${row.nodes} node${row.nodes === 1 ? '' : 's'}`,
                            row.marks > 0 && `${row.marks} mark${row.marks === 1 ? '' : 's'}`,
                          ]
                            .filter(Boolean)
                            .join(' · ')
                        : 'nothing yet'}
                      {step === currentStep && ' · adding here'}
                    </span>
                  </div>
                  {slide > 0 && (
                    <button
                      className="btn icon ghost step-merge"
                      disabled={locked}
                      title={`Merge into step ${slide}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        mergeStepWithPrevious(step);
                      }}
                    >
                      <MergeUpIcon />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="insp-row" style={{ gap: '6px' }}>
            <button
              className="btn ghost"
              style={{ padding: '5px 9px', fontSize: '12px' }}
              disabled={previewStep === null}
              onClick={() => setPreviewStep(null)}
            >
              Show all
            </button>
            <button
              className="btn ghost"
              style={{ padding: '5px 9px', fontSize: '12px' }}
              disabled={locked || selectedIds.length === 0 || previewStep === null}
              title={
                previewStep === null
                  ? 'Preview a step first, then move the selection onto it'
                  : `Move the selected nodes to step ${previewSlide}`
              }
              onClick={() => {
                if (previewStep !== null) setNodeStep(selectedIds, previewStep);
              }}
            >
              Move selection here
            </button>
          </div>

          <div className="hint" style={{ margin: '2px' }}>
            Merging folds a step into the one above it. Anything you delete leaves the deck
            entirely — only what survives is presented.
          </div>
        </>
      )}
    </div>
  );
}
