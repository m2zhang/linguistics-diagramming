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
import { useTreeStore } from '../../store/treeStore';
import { EMPTY_ANNOTATIONS } from '../../model/types';
import { useUiStore } from '../../store/uiStore';
import { primeEditorSession } from '../../hooks/usePersistence';

/** Shown over the editor when an instructor opened it to review a student's
 *  submission (/editor?grade=<submissionId>&courseId=&assignmentId=). The
 *  tree is loaded read-only-in-spirit (nothing stops clicking around, but
 *  edits here are never persisted back to the submission) — only grade and
 *  feedback are saved. A proper two-row card (identity row, then labeled
 *  fields) rather than one cramped horizontal strip — that squeezed the
 *  feedback field down to a few visible characters. */
export function GradeBanner() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useUiStore((s) => s.toast);

  const submissionId = params.get('grade');
  const courseId = params.get('courseId');
  const assignmentId = params.get('assignmentId');

  const [submission, setSubmission] = useState<SubmissionWithStudent | null>(null);
  const [grade, setGrade] = useState('');
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);
  // Latest-per-student submission list for the assignment, used to drive the
  // Previous/Next/Next-ungraded navigation without leaving the editor.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId]);

  useEffect(() => {
    if (!assignmentId) return;
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
  const nextUngraded = roster?.find((s, i) => i > currentIndex && s.grade === null);
  const nextUngradedWrapped = nextUngraded ?? roster?.find((s) => s.id !== submissionId && s.grade === null);

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
    <div className="absolute left-1/2 top-3 z-10 w-[480px] -translate-x-1/2 rounded-[var(--radius)] border border-accent bg-bg-panel p-3 shadow-[var(--shadow)]">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {submission && <ProfileAvatar seed={submission.studentId} name={submission.studentName} className="h-7 w-7" />}
          <span className="text-sm font-semibold text-text">
            {submission ? submission.studentName : 'Loading…'}
          </span>
          {roster && currentIndex >= 0 && (
            <span className="text-xs text-text-faint">
              {currentIndex + 1} of {roster.length}
            </span>
          )}
        </div>
        <BackButton to={backPath} label="Submissions" />
      </div>

      <div className="mb-3 flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          disabled={!hasPrev}
          onClick={() => roster && goToGrade(roster[currentIndex - 1].id)}
          title="Previous submission"
        >
          <ChevronLeft size={14} /> Prev
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!hasNext}
          onClick={() => roster && goToGrade(roster[currentIndex + 1].id)}
          title="Next submission"
        >
          Next <ChevronRight size={14} />
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!nextUngradedWrapped}
          onClick={() => nextUngradedWrapped && goToGrade(nextUngradedWrapped.id)}
          title="Jump to the next ungraded submission"
        >
          <SkipForward size={14} /> Next ungraded
        </Button>
      </div>

      <div className="flex items-end gap-2">
        <div className="flex w-20 flex-col gap-1">
          <Label htmlFor="grade-input">Grade</Label>
          <Input
            id="grade-input"
            type="number"
            min={0}
            max={999.99}
            step={0.01}
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            placeholder="—"
          />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <Label htmlFor="feedback-input">Feedback</Label>
          <Input
            id="feedback-input"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Optional note for the student"
          />
        </div>
      </div>

      <Button className="mt-3 w-full" disabled={saving} onClick={onSave}>
        {saving ? 'Saving…' : 'Save grade'}
      </Button>
    </div>
  );
}
