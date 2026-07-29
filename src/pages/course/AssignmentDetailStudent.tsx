import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { BackButton } from '../../components/ui/back-button';
import { getAssignment, type Assignment } from '../../data/assignments';
import { getDraft, getMySubmission, type Submission } from '../../data/submissions';
import { useTreeStore } from '../../store/treeStore';
import { cloneWithNewIds, EMPTY_ANNOTATIONS } from '../../model/types';
import { useUiStore } from '../../store/uiStore';
import { primeEditorSession } from '../../hooks/usePersistence';

export function AssignmentDetailStudent({ courseId }: { courseId: string }) {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useUiStore((s) => s.toast);
  const navigate = useNavigate();

  useEffect(() => {
    if (!assignmentId) return;
    setError(null);
    Promise.all([getAssignment(assignmentId), getMySubmission(assignmentId), getDraft(assignmentId)])
      .then(([a, s, d]) => {
        setAssignment(a);
        setSubmission(s);
        setHasDraft(d !== null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load assignment'));
  }, [assignmentId]);

  const onOpenEditor = async () => {
    if (!assignment) return;
    try {
      const draft = await getDraft(assignment.id);
      let tree = null as ReturnType<typeof cloneWithNewIds> | null;
      let annotations = EMPTY_ANNOTATIONS;
      if (draft) {
        tree = draft.content.tree;
        annotations = draft.content.annotations ?? EMPTY_ANNOTATIONS;
      } else if (assignment.mode === 'template' && assignment.templateContent) {
        tree = assignment.templateContent.tree ? cloneWithNewIds(assignment.templateContent.tree) : null;
        annotations = assignment.templateContent.annotations ?? EMPTY_ANNOTATIONS;
      }
      useTreeStore.getState().replaceTree(tree);
      useTreeStore.getState().setAnnotations(annotations);
      primeEditorSession(tree, annotations);
      navigate(`/editor?assignment=${assignment.id}&courseId=${courseId}`);
    } catch {
      toast('Could not open editor', 'error');
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

  const overdue = !!assignment.dueAt && new Date(assignment.dueAt).getTime() < Date.now();

  return (
    <div>
      <BackButton to={`/courses/${courseId}/assignments`} label="Back to assignments" className="mb-4" />

      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">{assignment.title}</h2>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="secondary">{assignment.mode === 'template' ? 'Template' : 'Blank canvas'}</Badge>
            {assignment.dueAt && (
              <span className={`text-xs ${overdue ? 'text-danger' : 'text-text-dim'}`}>
                Due {new Date(assignment.dueAt).toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </div>

      {assignment.instructions && (
        <Card className="mb-4">
          <CardContent className="whitespace-pre-wrap pt-4 text-sm text-text">{assignment.instructions}</CardContent>
        </Card>
      )}

      {submission && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Your submission</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-text-dim">Submitted {new Date(submission.submittedAt).toLocaleString()}</p>
            {submission.grade !== null ? (
              <div className="mt-2 flex items-center gap-2">
                <Badge variant="success">Grade: {submission.grade}</Badge>
              </div>
            ) : (
              <p className="mt-2 text-xs text-text-faint">Not graded yet.</p>
            )}
            {submission.feedback && <p className="mt-2 text-sm text-text">{submission.feedback}</p>}
          </CardContent>
        </Card>
      )}

      <Button onClick={onOpenEditor}>
        {submission ? 'Edit and resubmit' : hasDraft ? 'Continue draft' : 'Start assignment'}
      </Button>
    </div>
  );
}
