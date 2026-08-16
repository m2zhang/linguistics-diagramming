import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { createAssignment } from '../../data/assignments';
import { PENDING_ASSIGNMENT_KEY, type PendingAssignment } from './AssignmentEditor';
import { useTreeStore } from '../../store/treeStore';
import { currentProjectState } from '../../export/projectState';
import { useUiStore } from '../../store/uiStore';
import { useState } from 'react';

/** Shown over the editor when it was opened to build the starting tree for a
 *  new template-mode assignment (/editor?newAssignmentDraft=1). Reads the
 *  pending title/instructions/due-date stashed by AssignmentEditorDialog in
 *  sessionStorage, then creates the assignment with both the metadata and
 *  the tree in one request once the instructor is happy with it. */
export function CreateAssignmentBanner() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useUiStore((s) => s.toast);
  const [saving, setSaving] = useState(false);

  if (!params.get('newAssignmentDraft')) return null;

  const raw = sessionStorage.getItem(PENDING_ASSIGNMENT_KEY);
  const pending: PendingAssignment | null = raw ? JSON.parse(raw) : null;
  if (!pending) return null;

  const onSave = async () => {
    const tree = useTreeStore.getState().tree;
    if (!tree) {
      toast('Build a starting tree first', 'error');
      return;
    }
    setSaving(true);
    try {
      await createAssignment(pending.courseId, {
        title: pending.title,
        instructions: pending.instructions,
        mode: 'template',
        templateContent: currentProjectState(tree),
        dueAt: pending.dueAt,
        maxGrade: pending.maxGrade,
      });
      sessionStorage.removeItem(PENDING_ASSIGNMENT_KEY);
      toast('Assignment created', 'success');
      navigate(`/courses/${pending.courseId}/assignments`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not create assignment', 'error');
    } finally {
      setSaving(false);
    }
  };

  const onCancel = () => {
    sessionStorage.removeItem(PENDING_ASSIGNMENT_KEY);
    navigate(`/courses/${pending.courseId}/assignments`);
  };

  return (
    <div className="absolute top-3.5 right-4 z-10 flex items-center gap-3 rounded-[var(--radius)] border border-accent/30 bg-bg-panel px-3.5 py-1.5 shadow-[var(--shadow)]">
      <span className="text-xs font-semibold text-text-dim">
        Building starting tree for <span className="text-text">"{pending.title}"</span>
      </span>
      <Button size="sm" disabled={saving} onClick={onSave}>
        {saving ? 'Creating…' : 'Save assignment'}
      </Button>
      {/* Not a BackButton (a <Link>) — cancelling needs to clear the pending
          assignment from sessionStorage before navigating away, so this
          stays a real button with the same pill styling for consistency. */}
      <button
        onClick={onCancel}
        className="inline-flex items-center gap-1.5 rounded-full border border-accent bg-bg-elevated px-3 py-1 text-xs font-semibold text-accent transition-colors hover:bg-accent hover:text-white"
      >
        Cancel
      </button>
    </div>
  );
}
