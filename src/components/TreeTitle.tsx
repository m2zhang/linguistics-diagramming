import { useEffect, useState } from 'react';
import { useFileStore } from '../store/fileStore';
import { renameTree } from '../data/trees';

/** Inline-editable name for the open tree. Commits on blur or Enter. */
export function TreeTitle() {
  const currentFileId = useFileStore((s) => s.currentFileId);
  const title = useFileStore((s) => s.title);
  const setTitle = useFileStore((s) => s.setTitle);
  const setSaveStatus = useFileStore((s) => s.setSaveStatus);
  const [draft, setDraft] = useState(title);

  // Re-sync when a different file becomes the open one.
  useEffect(() => {
    setDraft(title);
  }, [title]);

  const commit = async () => {
    const next = draft.trim() || 'Untitled tree';
    setDraft(next);
    if (!currentFileId || next === title) return;
    setTitle(next);
    try {
      setSaveStatus('saving');
      await renameTree(currentFileId, next);
      setSaveStatus('saved');
    } catch (err) {
      console.error('Failed to rename tree:', err);
      setSaveStatus('error');
    }
  };

  if (!currentFileId) return null;

  return (
    <input
      className="tree-title"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
      aria-label="Tree name"
      spellCheck={false}
    />
  );
}
