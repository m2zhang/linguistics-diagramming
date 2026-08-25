import { useEffect, useRef, useState } from 'react';
import { useTreeStore } from '../store/treeStore';
import { saveDraft, saveDraftBeacon } from '../data/submissions';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * How long to wait after the last edit before writing to the database.
 *
 * This is a debounce, not an interval: every edit resets the timer, so a
 * student typing continuously produces one write when they pause, not one
 * every DEBOUNCE_MS. Raised from 600ms because a cohort of ~1000 students each
 * pausing every few seconds is a sustained write load, and each write upserts
 * the whole tree + annotations blob.
 *
 * The cost of raising it is the unsaved window: work done in the last
 * DEBOUNCE_MS lives only in the browser. flushNow() on unmount and the
 * beforeunload beacon below are what close that window.
 */
const DEBOUNCE_MS = 3000;

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

  /**
   * The payload as last written. Two jobs:
   *  - skip no-op writes, so a re-render or an edit that lands back on the
   *    previous state does not cost a round trip;
   *  - give the unmount/beforeunload paths something to flush without reading
   *    React state that may already be torn down.
   */
  const pending = useRef<string | null>(null);
  const lastSaved = useRef<string | null>(null);

  // Skip the very first render's save — that's the initial load (draft or
  // template just fetched and placed into the store by the caller), not a
  // real edit yet.
  useEffect(() => {
    ready.current = true;
  }, []);

  useEffect(() => {
    if (!assignmentId || !ready.current) return;

    const payload = JSON.stringify({ tree, annotations, version: '1.0' });
    // Nothing actually changed — don't arm a timer or flash "saving".
    if (payload === lastSaved.current) return;
    pending.current = payload;

    setStatus('saving');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      try {
        await saveDraft(assignmentId, JSON.parse(payload));
        lastSaved.current = payload;
        pending.current = null;
        setStatus('saved');
      } catch {
        setStatus('error');
      }
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId, tree, annotations, treeRevision]);

  // Leaving the editor inside the app (route change, closing the assignment).
  // The effect cleanup above only *cancels* the pending timer, which would
  // silently drop up to DEBOUNCE_MS of work — so write it out instead.
  useEffect(() => {
    if (!assignmentId) return;
    return () => {
      window.clearTimeout(timer.current);
      const payload = pending.current;
      if (!payload || payload === lastSaved.current) return;
      // Fire-and-forget: the component is going away and there is nothing left
      // to show an error to. The beforeunload beacon is the backstop if the
      // whole page is closing rather than just this view.
      void saveDraft(assignmentId, JSON.parse(payload)).catch(() => {});
      lastSaved.current = payload;
    };
  }, [assignmentId]);

  // Leaving the page entirely (tab close, reload, external navigation). React
  // cleanup is not guaranteed to run, and a normal request would be killed
  // mid-flight as the page tears down — hence the keepalive beacon.
  useEffect(() => {
    if (!assignmentId) return;
    const onBeforeUnload = () => {
      const payload = pending.current;
      if (!payload || payload === lastSaved.current) return;
      saveDraftBeacon(assignmentId, payload);
      lastSaved.current = payload;
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [assignmentId]);

  return status;
}
