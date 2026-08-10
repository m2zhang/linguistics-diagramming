import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, SkipForward } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { ProfileAvatar } from '../ui/avatar';
import { BackButton } from '../ui/back-button';
import {
  getSubmission,
  gradeSubmission,
  listSubmissions,
  type SubmissionWithStudent,
} from '../../data/submissions';
import { getAssignment, type Assignment } from '../../data/assignments';
import { useTreeStore } from '../../store/treeStore';
import { EMPTY_ANNOTATIONS } from '../../model/types';
import { useUiStore } from '../../store/uiStore';
import { primeEditorSession } from '../../hooks/usePersistence';

export function GradingPanel() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useUiStore((s) => s.toast);

  const submissionId = params.get('grade');
  const courseId = params.get('courseId');
  const assignmentId = params.get('assignmentId');

  const [submission, setSubmission] = useState<SubmissionWithStudent | null>(null);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [grade, setGrade] = useState('');
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);
  const [roster, setRoster] = useState<SubmissionWithStudent[] | null>(null);

  useEffect(() => {
    if (!submissionId) return;
    getSubmission(submissionId).then((s) => {
      setSubmission(s);
      setGrade(s.grade !== null ? String(s.grade) : '');
      setFeedback(s.feedback ?? '');
      const annotations = s.content.annotations ?? EMPTY_ANNOTATIONS;
      useTreeStore.getState().replaceTree(s.content.tree);
      useTreeStore.getState().setAnnotations(annotations);
      primeEditorSession(s.content.tree, annotations);
    });
  }, [submissionId]);

  useEffect(() => {
    if (!assignmentId) return;
    getAssignment(assignmentId).then(setAssignment);
    listSubmissions(assignmentId).then((all) => {
      const latestByStudent = Array.from(new Map(all.map((s) => [s.studentId, s])).values());
      setRoster(latestByStudent);
    });
  }, [assignmentId]);

  if (!submissionId) return null;

  const backPath = courseId && assignmentId ? `/courses/${courseId}/assignments/${assignmentId}` : '/dashboard';

  const goToGrade = (id: string) => {
    navigate(`/editor?grade=${id}&courseId=${courseId ?? ''}&assignmentId=${assignmentId ?? ''}`);
  };

  const currentIndex = roster?.findIndex((s) => s.id === submissionId) ?? -1;
  const hasPrev = !!roster && currentIndex > 0;
  const hasNext = !!roster && currentIndex >= 0 && currentIndex < roster.length - 1;
  const nextUngradedWrapped =
    roster?.find((s, i) => i > currentIndex && s.grade === null) ??
    roster?.find((s) => s.id !== submissionId && s.grade === null);

  const onSave = async () => {
    setSaving(true);
    try {
      await gradeSubmission(submissionId, {
        grade: grade.trim() === '' ? null : Number(grade),
        feedback: feedback.trim() || null,
      });
      setRoster(
        (prev) =>
          prev?.map((s) =>
            s.id === submissionId
              ? { ...s, grade: grade.trim() === '' ? null : Number(grade), feedback: feedback.trim() || null }
              : s,
          ) ?? prev,
      );
      toast('Grade saved', 'success');
      navigate(backPath);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save grade', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-bg-panel border-l border-border p-4 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <BackButton to={backPath} label="Back to Submissions" />
      </div>

      <div className="mb-6 flex flex-col items-center justify-center rounded-xl bg-accent-soft p-4">
        {submission ? (
          <ProfileAvatar seed={submission.studentId} name={submission.studentName} className="mb-2 h-12 w-12 text-lg" />
        ) : (
          <div className="mb-2 h-12 w-12 rounded-full bg-border" />
        )}
        <span className="font-[family-name:var(--font-display)] text-lg font-bold text-text">
          {submission ? submission.studentName : 'Loading…'}
        </span>
        {roster && currentIndex >= 0 && (
          <span className="mt-1 text-xs font-semibold uppercase tracking-wider text-accent">
            Student {currentIndex + 1} of {roster.length}
          </span>
        )}
      </div>

      <div className="mb-6 flex flex-col gap-2">
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            className="flex-1"
            size="sm"
            disabled={!hasPrev}
            onClick={() => roster && goToGrade(roster[currentIndex - 1].id)}
            title="Previous submission"
          >
            <ChevronLeft size={16} className="mr-1" /> Prev
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            size="sm"
            disabled={!hasNext}
            onClick={() => roster && goToGrade(roster[currentIndex + 1].id)}
            title="Next submission"
          >
            Next <ChevronRight size={16} className="ml-1" />
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={!nextUngradedWrapped}
          onClick={() => nextUngradedWrapped && goToGrade(nextUngradedWrapped.id)}
          title="Jump to the next ungraded submission"
        >
          <SkipForward size={14} className="mr-2" /> Next ungraded
        </Button>
      </div>

      <div className="mb-6 flex flex-col gap-4 border-t border-border pt-6">
        <h3 className="font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-wider text-text-dim">
          Grading Rubric
        </h3>

        <div className="flex flex-col gap-2">
          <Label htmlFor="grade-input" className="text-sm font-semibold">
            Score {assignment?.maxGrade ? `(out of ${assignment.maxGrade})` : ''}
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="grade-input"
              type="number"
              min={0}
              max={assignment?.maxGrade ?? 999.99}
              step={0.01}
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              placeholder="0.00"
              className="w-24 text-center font-mono text-lg font-bold"
            />
            {assignment?.maxGrade && <span className="font-mono text-lg text-text-faint">/ {assignment.maxGrade}</span>}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="feedback-input" className="text-sm font-semibold">
            Feedback / Comments
          </Label>
          <textarea
            id="feedback-input"
            rows={4}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Optional note for the student..."
            className="rounded-[var(--radius-sm)] border border-border bg-bg-input px-3 py-2 text-sm text-text placeholder:text-text-faint focus-visible:outline-none focus-visible:border-accent"
          />
        </div>
      </div>

      <div className="mt-auto pt-6">
        <Button className="w-full py-6 text-base font-bold shadow-md" disabled={saving} onClick={onSave}>
          {saving ? 'Saving…' : 'Save Grade'}
        </Button>
      </div>
    </div>
  );
}
