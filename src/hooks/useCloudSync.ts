import { useEffect, useRef } from 'react';
import { useTreeStore } from '../store/treeStore';
import { useFileStore } from '../store/fileStore';
import { listTrees, loadTree, createTree, saveTree } from '../data/trees';
import { EMPTY_ANNOTATIONS } from '../model/types';
import type { ProjectState } from '../export/projectState';

const SAVE_DEBOUNCE_MS = 600;
const VERSION = '1.0';

/**
 * Phase 2: persist the tree to Supabase instead of sessionStorage.
 *
 * On mount, open the user's most recent tree (creating an empty one if they have
 * none), load it into the store, then debounce-save every change back to that row.
 * Phase 3 will replace the "pick most recent" step with an explicit file id from
 * the route.
 */
export function useCloudSync() {
  const tree = useTreeStore((s) => s.tree);
  const annotations = useTreeStore((s) => s.annotations);
  const treeRevision = useTreeStore((s) => s.treeRevision);

  const currentFileId = useFileStore((s) => s.currentFileId);
  const setCurrentFile = useFileStore((s) => s.setCurrentFile);
  const setSaveStatus = useFileStore((s) => s.setSaveStatus);

  const didInit = useRef(false);
  const ready = useRef(false);
  const saveTimer = useRef<number | undefined>(undefined);

  // Open (or create) the current tree once.
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    (async () => {
      try {
        const files = await listTrees();
        let meta = files[0];
        if (!meta) {
          const empty: ProjectState = { tree: null, annotations: EMPTY_ANNOTATIONS, version: VERSION };
          meta = await createTree('Untitled tree', empty);
        }

        const content = await loadTree(meta.id);
        useTreeStore.getState().replaceTree(content.tree ?? null);
        if (content.annotations) useTreeStore.getState().setAnnotations(content.annotations);

        setCurrentFile(meta.id, meta.title);
        setSaveStatus('saved');
        ready.current = true;
      } catch (err) {
        console.error('Failed to open cloud tree:', err);
        setSaveStatus('error');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced save on any change, once a file is open.
  useEffect(() => {
    if (!ready.current || !currentFileId) return;

    setSaveStatus('saving');
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      try {
        const content: ProjectState = { tree, annotations, version: VERSION };
        await saveTree(currentFileId, content);
        setSaveStatus('saved');
      } catch (err) {
        console.error('Failed to save tree:', err);
        setSaveStatus('error');
      }
    }, SAVE_DEBOUNCE_MS);
  }, [tree, annotations, treeRevision, currentFileId, setSaveStatus]);
}
