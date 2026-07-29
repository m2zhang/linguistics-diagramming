import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { PenLine, SkipForward } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { ProfileAvatar } from '../../components/ui/avatar';
import { BackButton } from '../../components/ui/back-button';
import { ExportMenu } from '../../components/submission/ExportMenu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { listSubmissions, type SubmissionWithStudent } from '../../data/submissions';
import { getAssignment, type Assignment } from '../../data/assignments';
import { exportTreeAs, type ExportFormat } from '../../lib/exportSubmission';
import { useUiStore } from '../../store/uiStore';
import type { CourseOutletContext } from './CourseShell';

export function SubmissionReview() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const { course } = useOutletContext<CourseOutletContext>();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionWithStudent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const toast = useUiStore((s) => s.toast);

  useEffect(() => {
    if (!assignmentId) return;
    setError(null);
    Promise.all([getAssignment(assignmentId), listSubmissions(assignmentId)])
      .then(([a, s]) => {
        setAssignment(a);
        setSubmissions(s);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load submissions'));
  }, [assignmentId]);

  // Latest submission per student only (resubmission = new row; grading the
  // newest one is the common case).
  const latestByStudent = submissions
    ? Array.from(new Map(submissions.map((s) => [s.studentId, s])).values())
    : null;

  const filenameFor = (s: SubmissionWithStudent) => `${s.studentName} - ${assignment?.title ?? 'submission'}`;

  const exportOne = async (s: SubmissionWithStudent, format: ExportFormat) => {
    try {
      await exportTreeAs(s.content, format, filenameFor(s));
    } catch {
      toast(`Could not export ${s.studentName}'s tree`, 'error');
    }
  };

  const exportMany = async (list: SubmissionWithStudent[], format: ExportFormat) => {
    if (list.length === 0) return;
    toast(`Exporting ${list.length} tree${list.length === 1 ? '' : 's'}…`, 'info');
    // Sequential, not parallel — each export briefly points the shared
    // treeStore at that submission's annotations (see exportTreeAs), so
    // running them concurrently would race and mix up which tree's
    // annotations end up embedded in which file.
    for (const s of list) {
      await exportOne(s, format);
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = !!latestByStudent?.length && selected.size === latestByStudent.length;
  const toggleAll = () => {
    if (!latestByStudent) return;
    setSelected(allSelected ? new Set() : new Set(latestByStudent.map((s) => s.id)));
  };

  const firstUngraded = latestByStudent?.find((s) => s.grade === null);
  const onGradeNextUngraded = () => {
    if (!firstUngraded) return;
    navigate(`/editor?grade=${firstUngraded.id}&courseId=${course.id}&assignmentId=${assignmentId}`);
  };

  if (error) {
    return (
      <div>
        <p className="text-sm text-danger">{error}</p>
        <BackButton to={`/courses/${course.id}/assignments`} label="Back to assignments" className="mt-3" />
      </div>
    );
  }

  return (
    <div>
      <BackButton to={`/courses/${course.id}/assignments/${assignmentId}`} label="Back to assignment" className="mb-4" />

      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">
            Submissions{assignment ? ` — ${assignment.title}` : ''}
          </h2>
          <p className="text-sm text-text-dim">
            {latestByStudent ? `${latestByStudent.length} student${latestByStudent.length === 1 ? '' : 's'} submitted` : '…'}
          </p>
        </div>
        {!!latestByStudent?.length && (
          <div className="flex items-center gap-2">
            {firstUngraded && (
              <Button size="sm" onClick={onGradeNextUngraded}>
                <SkipForward size={14} /> Grade next ungraded
              </Button>
            )}
            {selected.size > 0 && (
              <ExportMenu
                label={`Export selected (${selected.size})`}
                onExport={(fmt) => exportMany(latestByStudent.filter((s) => selected.has(s.id)), fmt)}
              />
            )}
            <ExportMenu label="Export all" onExport={(fmt) => exportMany(latestByStudent, fmt)} />
          </div>
        )}
      </div>

      {latestByStudent?.length === 0 && <p className="text-sm text-text-dim">No submissions yet.</p>}

      {latestByStudent && latestByStudent.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <input
                  type="checkbox"
                  className="accent-accent"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Grade</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {latestByStudent.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <input
                    type="checkbox"
                    className="accent-accent"
                    checked={selected.has(s.id)}
                    onChange={() => toggleOne(s.id)}
                    aria-label={`Select ${s.studentName}`}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <ProfileAvatar seed={s.studentId} name={s.studentName} className="h-7 w-7 text-[11px]" />
                    {s.studentName}
                  </div>
                </TableCell>
                <TableCell className="text-text-dim">{new Date(s.submittedAt).toLocaleString()}</TableCell>
                <TableCell>
                  {s.grade !== null ? <Badge variant="success">{s.grade}</Badge> : <Badge variant="secondary">Ungraded</Badge>}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1.5">
                    <ExportMenu label="Export" onExport={(fmt) => exportOne(s, fmt)} />
                    <Button
                      size="sm"
                      onClick={() => navigate(`/editor?grade=${s.id}&courseId=${course.id}&assignmentId=${assignmentId}`)}
                    >
                      <PenLine size={14} /> Grade
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
