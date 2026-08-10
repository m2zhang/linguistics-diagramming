import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../ui/button';
import { addLectureTree } from '../../data/lectures';
import { useTreeStore } from '../../store/treeStore';
import { currentProjectState } from '../../export/projectState';
import { useUiStore } from '../../store/uiStore';
import { PENDING_LECTURE_TREE_KEY, type PendingLectureTree } from './AddTreeDialog';

/** Shown over the editor when it was opened from a lecture's "+ Add tree"
 *  dialog (/editor?saveToLecture=<id>&courseId=<id>) — lets the instructor
 *  build a tree with the normal canvas, then save it back to that lecture
 *  as a lesson tree instead of just exporting/downloading it. The title was
 *  already settled in AddTreeDialog before the canvas opened, so this only
 *  needs a Save/Cancel pair, not another text field on top of the canvas. */
export function SaveToLectureBanner() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useUiStore((s) => s.toast);
  const [saving, setSaving] = useState(false);

  const lectureId = params.get('saveToLecture');
  const courseId = params.get('courseId');
  if (!lectureId) return null;

  const raw = sessionStorage.getItem(PENDING_LECTURE_TREE_KEY);
  const pending: PendingLectureTree | null = raw ? JSON.parse(raw) : null;
  if (!pending) return null;

  const backTo = courseId ? `/courses/${courseId}/lectures/${lectureId}` : '/dashboard';

  const onSave = async () => {
    const tree = useTreeStore.getState().tree;
    if (!tree) {
      toast('Build a tree first', 'error');
      return;
    }
    setSaving(true);
    try {
      await addLectureTree(lectureId, { title: pending.title, content: currentProjectState(tree) });
      sessionStorage.removeItem(PENDING_LECTURE_TREE_KEY);
      toast('Saved to lecture', 'success');
      navigate(backTo);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save tree', 'error');
    } finally {
      setSaving(false);
    }
  };

  const onCancel = () => {
    sessionStorage.removeItem(PENDING_LECTURE_TREE_KEY);
    navigate(backTo);
  };

  return (
    <div className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-3 rounded-[var(--radius)] border border-accent bg-bg-panel px-3 py-2 shadow-[var(--shadow)]">
      <span className="text-xs font-semibold text-text-dim">
        Building lesson tree <span className="text-text">"{pending.title}"</span>
      </span>
      <Button size="sm" disabled={saving} onClick={onSave}>
        {saving ? 'Saving…' : 'Save as lesson tree'}
      </Button>
      {/* Not a BackButton (a <Link>) — cancelling needs to clear the pending
          tree from sessionStorage before navigating away, same reasoning as
          CreateAssignmentBanner's cancel button. */}
      <button
        onClick={onCancel}
        className="inline-flex items-center gap-1.5 rounded-full border border-accent bg-bg-elevated px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent hover:text-white"
      >
        Cancel
      </button>
    </div>
  );
}
