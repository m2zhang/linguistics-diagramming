import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '../../components/ui/card';
import { AddLectureDialog } from '../../components/lecture/AddLectureDialog';
import { listLectures, type Lecture } from '../../data/lectures';
import { courseColorHex } from '../../lib/courseColors';
import { useUiStore } from '../../store/uiStore';
import type { CourseOutletContext } from './CourseShell';

export function CourseLectures() {
  const { course, role } = useOutletContext<CourseOutletContext>();
  const [lectures, setLectures] = useState<Lecture[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const toast = useUiStore((s) => s.toast);
  const navigate = useNavigate();

  useEffect(() => {
    setError(null);
    listLectures(course.id)
      .then(setLectures)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load lectures'));
  }, [course.id]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">Lectures</h2>
        {role === 'instructor' && (
          <AddLectureDialog
            courseId={course.id}
            onCreated={(lecture) => {
              setLectures((prev) => [...(prev ?? []), lecture]);
              toast('Lecture created', 'success');
            }}
          />
        )}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      {!error && lectures === null && <p className="text-sm text-text-dim">Loading…</p>}

      {lectures?.length === 0 && (
        <div className="rounded-[var(--radius)] border border-dashed border-border p-10 text-center text-text-dim">
          {role === 'instructor'
            ? 'No lectures yet. Add one to share notes and trees with your students.'
            : "Your instructor hasn't published any lectures yet — check back soon."}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {lectures?.map((lecture) => (
          <Card
            key={lecture.id}
            className="cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(40,50,90,0.12)] border-l-4 overflow-hidden rounded-xl bg-bg-elevated/80 backdrop-blur-sm"
            style={{ borderLeftColor: courseColorHex(course.color) }}
            onClick={() => navigate(lecture.id)}
          >
            <CardHeader className="flex-row items-center gap-4 space-y-0 p-5">
              <div 
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent shadow-sm"
                style={{ backgroundColor: `${courseColorHex(course.color)}20`, color: courseColorHex(course.color) }}
              >
                <BookOpen size={20} />
              </div>
              <div>
                <CardTitle>{lecture.title}</CardTitle>
                {lecture.notes && (
                  <p className="mt-0.5 line-clamp-1 text-sm text-text-dim">{lecture.notes}</p>
                )}
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
