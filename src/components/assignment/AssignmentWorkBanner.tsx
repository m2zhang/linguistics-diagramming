import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { BackButton } from '../ui/back-button';
import { useTreeStore } from '../../store/treeStore';
import { currentProjectState } from '../../export/projectState';
import { submitAssignment } from '../../data/submissions';
import { useDraftAutosave } from '../../hooks/useDraftAutosave';
import { useUiStore } from '../../store/uiStore';

const STATUS_LABEL: Record<string, string> = {
  idle: '',
  saving: 'Saving…',
  saved: 'Draft saved',
  error: 'Save failed',
};

/** Shown over the editor when a student opened it to work on an assignment
 *  (/editor?assignment=<id>&courseId=<id>) — autosaves the canvas as a draft
 *  on every change, and lets them submit explicitly when ready. The initial
 *  draft-or-template load happens once, before navigating here (see
 *  AssignmentDetailStudent), not inside this component. */
export function AssignmentWorkBanner() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useUiStore((s) => s.toast);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const assignmentId = params.get('assignment');
  const courseId = params.get('courseId');
  const status = useDraftAutosave(assignmentId);

  if (!assignmentId) return null;

  const onConfirmSubmit = async () => {
    const tree = useTreeStore.getState().tree;
    if (!tree) {
      toast('Build a tree before submitting', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await submitAssignment(assignmentId, currentProjectState(tree));
      setConfirmOpen(false);
      toast('Submitted', 'success');
      navigate(courseId ? `/courses/${courseId}/assignments/${assignmentId}` : '/dashboard');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Submit failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-4 rounded-full border border-accent/20 bg-bg-elevated/90 px-5 py-3 shadow-xl backdrop-blur-md">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-text-dim">
          {status === 'saving' && <Loader2 size={12} className="animate-spin" />}
          {status === 'saved' && <Check size={12} className="text-success" />}
          {STATUS_LABEL[status]}
        </span>
        <Button size="sm" onClick={() => setConfirmOpen(true)}>
          Submit
        </Button>
        <BackButton
          to={courseId ? `/courses/${courseId}/assignments/${assignmentId}` : '/dashboard'}
          label="Assignment"
        />
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Submit this diagram?"
        description="You can keep editing and resubmit later if needed — this just records your current tree as a submission for grading."
        confirmLabel="Submit"
        confirming={submitting}
        onConfirm={onConfirmSubmit}
      />
    </>
  );
}
