import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { AssignmentEditorDialog } from '../../components/assignment/AssignmentEditor';
import { listAssignments, type Assignment } from '../../data/assignments';
import { useUiStore } from '../../store/uiStore';
import type { CourseOutletContext } from './CourseShell';

function isOverdue(dueAt: string | null): boolean {
  return !!dueAt && new Date(dueAt).getTime() < Date.now();
}

export function CourseAssignments() {
  const { course, role } = useOutletContext<CourseOutletContext>();
  const [assignments, setAssignments] = useState<Assignment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const toast = useUiStore((s) => s.toast);
  const navigate = useNavigate();

  useEffect(() => {
    setError(null);
    listAssignments(course.id)
      .then(setAssignments)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load assignments'));
  }, [course.id]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">Assignments</h2>
        {role === 'instructor' && (
          <AssignmentEditorDialog
            courseId={course.id}
            onCreated={(a) => {
              setAssignments((prev) => [...(prev ?? []), a]);
              toast('Assignment created', 'success');
            }}
          />
        )}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      {!error && assignments === null && <p className="text-sm text-text-dim">Loading…</p>}

      {assignments?.length === 0 && (
        <div className="rounded-[var(--radius)] border border-dashed border-border p-10 text-center text-text-dim">
          {role === 'instructor'
            ? 'No assignments yet. Create one from a blank canvas or a template tree.'
            : "Your instructor hasn't published any assignments yet — check back soon."}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {assignments?.map((a) => (
          <Card
            key={a.id}
            className="cursor-pointer transition-shadow hover:shadow-[0_8px_30px_rgba(40,50,90,0.18)]"
            onClick={() => navigate(a.id)}
          >
            <CardHeader className="flex-row items-center gap-3 space-y-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] bg-accent-soft text-accent">
                <ClipboardList size={16} />
              </div>
              <div className="flex-1">
                <CardTitle>{a.title}</CardTitle>
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant="secondary">{a.mode === 'template' ? 'Template' : 'Blank canvas'}</Badge>
                  {a.dueAt && (
                    <span className={`text-xs ${isOverdue(a.dueAt) ? 'text-danger' : 'text-text-dim'}`}>
                      Due {new Date(a.dueAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
