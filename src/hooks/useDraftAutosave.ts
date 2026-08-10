import { useEffect, useRef, useState } from 'react';
import { useTreeStore } from '../store/treeStore';
import { saveDraft } from '../data/submissions';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const DEBOUNCE_MS = 600;

/** Debounced autosave of the current canvas to an assignment's draft row —
 *  same shape as the app's pre-existing debounced-save patterns (e.g.
 *  usePersistence), just pointed at the server instead of sessionStorage. */
export function useDraftAutosave(assignmentId: string | null) {
  const tree = useTreeStore((s) => s.tree);
  const annotations = useTreeStore((s) => s.annotations);
  const treeRevision = useTreeStore((s) => s.treeRevision);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const timer = useRef<number | undefined>(undefined);
  const ready = useRef(false);

  // Skip the very first render's save — that's the initial load (draft or
  // template just fetched and placed into the store by the caller), not a
  // real edit yet.
  useEffect(() => {
    ready.current = true;
  }, []);

  useEffect(() => {
    if (!assignmentId || !ready.current) return;

    setStatus('saving');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      try {
        await saveDraft(assignmentId, { tree, annotations, version: '1.0' });
        setStatus('saved');
      } catch {
        setStatus('error');
      }
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId, tree, annotations, treeRevision]);

  return status;
}
