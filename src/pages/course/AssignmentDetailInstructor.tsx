import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { GitBranch, Trash2, Users } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { BackButton } from '../../components/ui/back-button';
import { deleteAssignment, getAssignment, type Assignment } from '../../data/assignments';
import { useTreeStore } from '../../store/treeStore';
import { EMPTY_ANNOTATIONS } from '../../model/types';
import { useUiStore } from '../../store/uiStore';
import { primeEditorSession } from '../../hooks/usePersistence';

export function AssignmentDetailInstructor({ courseId }: { courseId: string }) {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const toast = useUiStore((s) => s.toast);
  const navigate = useNavigate();

  useEffect(() => {
    if (!assignmentId) return;
    setError(null);
    getAssignment(assignmentId)
      .then(setAssignment)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load assignment'));
  }, [assignmentId]);

  const onViewTemplate = () => {
    if (!assignment?.templateContent) return;
    const { tree, annotations } = assignment.templateContent;
    const withAnnotations = annotations ?? EMPTY_ANNOTATIONS;
    useTreeStore.getState().replaceTree(tree);
    useTreeStore.getState().setAnnotations(withAnnotations);
    primeEditorSession(tree, withAnnotations);
    // viewAssignment (not the student "assignment" work param) tells the
    // editor's back button where to return to.
    navigate(`/editor?viewAssignment=${assignment!.id}&courseId=${courseId}`);
  };

  const onDelete = async () => {
    if (!assignmentId) return;
    setDeleting(true);
    try {
      await deleteAssignment(assignmentId);
      toast('Assignment deleted', 'success');
      navigate(`/courses/${courseId}/assignments`);
    } catch {
      toast('Could not delete assignment', 'error');
    } finally {
      setDeleting(false);
    }
  };

  if (error) {
    return (
      <div>
        <p className="text-sm text-danger">{error}</p>
        <BackButton to={`/courses/${courseId}/assignments`} label="Back to assignments" className="mt-3" />
      </div>
    );
  }

  if (!assignment) return <p className="text-sm text-text-dim">Loading…</p>;

  return (
    <div>
      <BackButton to={`/courses/${courseId}/assignments`} label="Back to assignments" className="mb-4" />

      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">{assignment.title}</h2>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="secondary">{assignment.mode === 'template' ? 'Template' : 'Blank canvas'}</Badge>
            {assignment.dueAt && (
              <span className="text-xs text-text-dim">Due {new Date(assignment.dueAt).toLocaleString()}</span>
            )}
          </div>
        </div>
        <Button variant="destructive" size="sm" onClick={() => setConfirmOpen(true)}>
          <Trash2 size={14} /> Delete
        </Button>
      </div>

      {assignment.instructions && (
        <Card className="mb-4">
          <CardContent className="whitespace-pre-wrap pt-4 text-sm text-text">{assignment.instructions}</CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {assignment.mode === 'template' && (
          <Button variant="outline" onClick={onViewTemplate}>
            <GitBranch size={14} /> View template tree
          </Button>
        )}
        <Button onClick={() => navigate(`/courses/${courseId}/assignments/${assignment.id}/submissions`)}>
          <Users size={14} /> View submissions
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete "${assignment.title}"?`}
        description="Student drafts and submissions are removed too. This can't be undone."
        confirmLabel="Delete"
        destructive
        confirming={deleting}
        onConfirm={onDelete}
      />
    </div>
  );
}
