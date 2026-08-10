import { create } from 'zustand';

export type ToastKind = 'info' | 'success' | 'error';
export interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

/**
 * What one press of → advances through.
 *  - `steps`: the build history — nodes appear on the step they were made on.
 *  - `depth`: one tree level at a time (the fallback for documents with no
 *    stamps, e.g. anything made before stepping existed).
 */
export type RevealMode = 'steps' | 'depth';

interface UiState {
  theme: 'dark' | 'light';
  toasts: Toast[];
  validatorOn: boolean;
  sidebarOpen: boolean;
  rightpaneOpen: boolean;

  /** Lecture mode: chrome hidden, tree revealed step by step, structure locked. */
  presenting: boolean;
  /**
   * Structural edits (rename, add/delete node, bracket editing, templates) are
   * refused while true. Annotations stay available — that is the point during a
   * lecture. Settable on its own, so a tree can be handed out read-only without
   * entering presentation mode.
   */
  locked: boolean;
  revealMode: RevealMode;
  /**
   * Reveal threshold: everything stamped at or below this is on screen. It is a
   * step *number*, not a slide index — the two differ once a step has been
   * emptied out, and `revealTargets` is what bridges them.
   */
  revealStep: number;
  /**
   * Step numbers that something is actually stamped with, ascending. Stepping
   * walks this list, so a step whose nodes were all deleted (or a run left
   * behind when the tree was replaced) can never show up as a blank slide.
   */
  usedSteps: number[];
  /** Depth of the deepest node in the current tree; the canvas keeps this current. */
  maxDepth: number;
  /**
   * Step being previewed while authoring (not presenting). Lets the Steps panel
   * show what the class will see without entering the mode.
   */
  previewStep: number | null;

  toggleTheme: () => void;
  toggleSidebar: () => void;
  toggleRightpane: () => void;
  toggleLocked: () => void;
  startPresenting: () => void;
  stopPresenting: () => void;
  setRevealMode: (mode: RevealMode) => void;
  setRevealBounds: (bounds: { usedSteps: number[]; maxDepth: number }) => void;
  setPreviewStep: (step: number | null) => void;
  stepForward: () => void;
  stepBack: () => void;
  revealAll: () => void;
  collapseToRoot: () => void;
  toast: (message: string, kind?: ToastKind) => void;
  dismissToast: (id: number) => void;
}

type RevealState = { revealMode: RevealMode; usedSteps: number[]; maxDepth: number };

/**
 * Every threshold the reveal can stop at, in order — one per slide.
 *
 * Levels are contiguous by construction; steps are not, so the two modes need
 * different lists. Everything else about stepping is shared.
 */
export function revealTargets(s: RevealState): number[] {
  if (s.revealMode === 'depth') return Array.from({ length: s.maxDepth + 1 }, (_, i) => i);
  return s.usedSteps.length > 0 ? s.usedSteps : [0];
}

/** Which slide the current threshold sits on (0-based). */
export function revealIndex(s: RevealState & { revealStep: number }): number {
  const targets = revealTargets(s);
  const exact = targets.indexOf(s.revealStep);
  if (exact !== -1) return exact;
  // Between targets (mid-edit): count the ones already passed.
  let i = 0;
  while (i < targets.length && targets[i] <= s.revealStep) i++;
  return Math.max(0, i - 1);
}

/** Snap a threshold onto the nearest valid target at or below it. */
function clampToTarget(s: RevealState & { revealStep: number }): number {
  return revealTargets(s)[revealIndex(s)];
}

let toastId = 0;

/** Workspace state captured on entering presentation so exiting can restore it. */
let beforePresenting: { sidebarOpen: boolean; rightpaneOpen: boolean; locked: boolean } | null =
  null;

export const useUiStore = create<UiState>((set) => ({
  theme: 'light',
  toasts: [],
  validatorOn: false,
  sidebarOpen: true,
  rightpaneOpen: true,

  presenting: false,
  locked: false,
  revealMode: 'steps',
  revealStep: 0,
  usedSteps: [0],
  maxDepth: 0,
  previewStep: null,

  toggleTheme: () =>
    set((s) => {
      const theme = s.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', theme);
      return { theme };
    }),

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleRightpane: () => set((s) => ({ rightpaneOpen: !s.rightpaneOpen })),
  toggleLocked: () => set((s) => ({ locked: !s.locked })),

  startPresenting: () =>
    set((s) => {
      beforePresenting = {
        sidebarOpen: s.sidebarOpen,
        rightpaneOpen: s.rightpaneOpen,
        locked: s.locked,
      };
      return {
        presenting: true,
        sidebarOpen: false,
        rightpaneOpen: false,
        locked: true,
        // A document with only one step has nothing to replay — fall back to
        // revealing a level at a time rather than showing one static slide.
        revealMode: s.usedSteps.length > 1 ? 'steps' : 'depth',
        revealStep: 0,
        previewStep: null,
      };
    }),

  stopPresenting: () => {
    const restore = beforePresenting ?? { sidebarOpen: true, rightpaneOpen: true, locked: false };
    beforePresenting = null;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    set({ presenting: false, ...restore });
  },

  setRevealMode: (mode) =>
    set((s) => {
      const next = { ...s, revealMode: mode };
      return { revealMode: mode, revealStep: clampToTarget(next) };
    }),

  // Clamp the current position: switching to a shorter deck or a shallower tree
  // must not leave the reveal pointing past the end, which looks like a stuck slide.
  setRevealBounds: ({ usedSteps, maxDepth }) =>
    set((s) => {
      const same =
        s.maxDepth === maxDepth &&
        s.usedSteps.length === usedSteps.length &&
        s.usedSteps.every((step, i) => step === usedSteps[i]);
      if (same) return s;
      const next = { ...s, usedSteps, maxDepth };
      return {
        usedSteps,
        maxDepth,
        revealStep: clampToTarget(next),
        previewStep:
          s.previewStep === null ? null : clampToTarget({ ...next, revealStep: s.previewStep }),
      };
    }),

  setPreviewStep: (step) => set({ previewStep: step }),

  // Stepping walks the target list rather than counting by one, so emptied-out
  // step numbers are skipped instead of showing as blank slides.
  stepForward: () =>
    set((s) => {
      const targets = revealTargets(s);
      return { revealStep: targets[Math.min(revealIndex(s) + 1, targets.length - 1)] };
    }),
  stepBack: () =>
    set((s) => ({ revealStep: revealTargets(s)[Math.max(revealIndex(s) - 1, 0)] })),
  revealAll: () =>
    set((s) => {
      const targets = revealTargets(s);
      return { revealStep: targets[targets.length - 1] };
    }),
  collapseToRoot: () => set((s) => ({ revealStep: revealTargets(s)[0] })),

  toast: (message, kind = 'info') =>
    set((s) => {
      const id = ++toastId;
      // Auto-dismiss after 2.6s.
      setTimeout(() => {
        useUiStore.setState((st) => ({ toasts: st.toasts.filter((t) => t.id !== id) }));
      }, 2600);
      return { toasts: [...s.toasts, { id, message, kind }] };
    }),

  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
