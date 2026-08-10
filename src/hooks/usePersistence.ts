import { useEffect, useRef } from 'react';
import { useTreeStore } from '../store/treeStore';
import { Annotations, TreeNode } from '../model/types';

const KEY = 'syntaxtree.session.v1';

/**
 * Call this immediately before navigating to /editor with pre-loaded content
 * (a lecture tree, an assignment template/draft, a submission to grade) —
 * anything that puts specific content in the store via replaceTree/
 * setAnnotations rather than letting the editor start from whatever the user
 * was last doing. Without this, usePersistence's restore-on-mount effect
 * below runs *after* the navigation and silently overwrites the pre-loaded
 * content with the last sessionStorage snapshot, since App only mounts (and
 * usePersistence only restores) once the route actually changes.
 */
export function primeEditorSession(tree: TreeNode | null, annotations: Annotations): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ tree, annotations }));
  } catch {
    /* quota / serialization issues are non-fatal — the direct store write still applies */
  }
}

/**
 * Persist the tree to sessionStorage so a refresh keeps the user's work (US.6).
 * Restores once on mount, then writes on every tree change (debounced).
 */
export function usePersistence() {
  const tree = useTreeStore((s) => s.tree);
  const annotations = useTreeStore((s) => s.annotations);
  const treeRevision = useTreeStore((s) => s.treeRevision);
  const currentStep = useTreeStore((s) => s.currentStep);
  const stepLabels = useTreeStore((s) => s.stepLabels);
  const restored = useRef(false);
  const saveTimer = useRef<number | undefined>(undefined);

  // Restore once, before first paint of meaningful interaction.
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          tree: TreeNode | null;
          annotations?: Annotations;
          currentStep?: number;
          stepLabels?: Record<number, string>;
        };
        useTreeStore.getState().replaceTree(parsed.tree);
        if (parsed.annotations) {
          // Drop geometry-identical duplicate strokes (older sessions saved
          // each stroke twice due to a StrictMode double-commit bug).
          const seen = new Set<string>();
          const strokes = parsed.annotations.strokes.filter((s) => {
            const key = JSON.stringify(s.points);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          useTreeStore.getState().setAnnotations({ ...parsed.annotations, strokes });
        }
        // After the tree and annotations, so the fallback can read their stamps.
        useTreeStore.getState().loadStepMeta(parsed.currentStep, parsed.stepLabels);
      }
    } catch {
      /* ignore corrupt session data */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save on changes.
  useEffect(() => {
    if (!restored.current) return;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      try {
        sessionStorage.setItem(KEY, JSON.stringify({ tree, annotations, currentStep, stepLabels }));
      } catch {
        /* quota / serialization issues are non-fatal */
      }
    }, 300);
  }, [tree, annotations, treeRevision, currentStep, stepLabels]);
}

