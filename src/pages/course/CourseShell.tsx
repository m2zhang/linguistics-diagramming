import { useEffect, useState } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { AppHeader } from '../../components/layout/AppHeader';
import { CourseSidebar } from '../../components/layout/CourseSidebar';
import { BackButton } from '../../components/ui/back-button';
import { getCourse, type Course } from '../../data/courses';
import { useAuthStore } from '../../store/authStore';

export interface CourseOutletContext {
  course: Course;
  role: 'student' | 'instructor';
  refreshCourse: () => void;
}

/** Layout shell for everything under /courses/:courseId. The left rail is a
 *  single full-height surface — course identity (icon/title/description) at
 *  the top, section nav (Lectures/Assignments/Participants) below it in the
 *  same column — rather than a separate full-width banner above a shorter
 *  sidebar, so the main content column gets the full remaining width right
 *  under the header instead of a mostly-empty banner row. */
export function CourseShell() {
  const { courseId } = useParams<{ courseId: string }>();
  const [course, setCourse] = useState<Course | null>(null);
  const [error, setError] = useState<string | null>(null);
  const role = useAuthStore((s) => s.user?.role);

  const refreshCourse = () => {
    if (!courseId) return;
    setError(null);
    getCourse(courseId)
      .then(setCourse)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load course'));
  };

  useEffect(refreshCourse, [courseId]);

  if (error) {
    return (
      <div className="min-h-full bg-bg">
        <AppHeader />
        <main className="mx-auto max-w-4xl px-6 py-8">
          <p className="text-sm text-danger">{error}</p>
          <BackButton to="/dashboard" label="Back to courses" className="mt-3" />
        </main>
      </div>
    );
  }

  if (!course || !role) {
    return (
      <div className="min-h-full bg-bg">
        <AppHeader />
        <main className="px-6 py-8 text-sm text-text-dim">Loading…</main>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col bg-bg">
      <AppHeader />

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-72 shrink-0 flex-col border-r border-border bg-bg-panel">
          <div className="p-4">
            <BackButton to="/dashboard" label="Your courses" className="mb-4" />
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius)] bg-accent-soft text-accent">
                <GraduationCap size={20} />
              </span>
              <div className="min-w-0">
                <h1 className="font-[family-name:var(--font-display)] text-lg font-bold leading-tight">
                  {course.title}
                </h1>
                {role === 'student' && course.instructorName && (
                  <p className="mt-0.5 text-xs text-text-dim">Taught by {course.instructorName}</p>
                )}
              </div>
            </div>
            {course.description && <p className="mt-3 text-xs leading-relaxed text-text-dim">{course.description}</p>}
          </div>

          <div className="border-t border-border" />
          <CourseSidebar />
        </aside>

        <main className="flex-1 overflow-y-auto px-8 py-6">
          <Outlet context={{ course, role, refreshCourse } satisfies CourseOutletContext} />
        </main>
      </div>
    </div>
  );
}
