import { useEffect, useState } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { AppHeader } from '../../components/layout/AppHeader';
import { CourseSidebar } from '../../components/layout/CourseSidebar';
import { BackButton } from '../../components/ui/back-button';
import { getCourse, type Course } from '../../data/courses';
import { courseColorHex } from '../../lib/courseColors';
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
  const user = useAuthStore((s) => s.user);
  
  // A user gets instructor UI if they own the course OR if they are a TA
  const role = course && user
    ? (course.instructorId === user.id || course.myRole === 'ta' ? 'instructor' : 'student')
    : user?.role;
    
  const [collapsed, setCollapsed] = useState(false);

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
        <aside 
          className={`relative flex shrink-0 flex-col border-r border-border bg-bg-panel transition-[width] ${collapsed ? 'w-16' : 'w-72'}`}
        >
          {/* Toggle Button */}
          <button
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={() => setCollapsed((c) => !c)}
            className="absolute -right-3 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-bg-elevated text-text-dim shadow-sm transition-colors hover:bg-accent hover:text-white hover:border-accent z-10"
          >
            <div className="text-[10px] font-bold">{collapsed ? '▶' : '◀'}</div>
          </button>

          <div className={`p-4 transition-opacity ${collapsed ? 'opacity-0 invisible h-16' : 'opacity-100 visible h-auto'}`}>
            <BackButton to="/dashboard" label="Your courses" className="mb-4" />
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius)] bg-accent-soft text-accent">
                <GraduationCap size={20} />
              </span>
              <div className="min-w-0">
                <h1 className="font-[family-name:var(--font-display)] text-lg font-bold leading-tight line-clamp-2">
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
          <CourseSidebar role={role} collapsed={collapsed} />
        </aside>

        <main className="flex-1 overflow-y-auto bg-bg">
          {/* Colorful Header matching course color */}
          <div 
            className="h-32 w-full opacity-80" 
            style={{ 
              background: `linear-gradient(to bottom right, ${courseColorHex(course.color)}, transparent)` 
            }} 
          />
          <div className="-mt-20 px-8 pb-8">
            <div className="rounded-2xl bg-bg-elevated shadow-lg border border-border/50 p-6 min-h-[500px]">
              <Outlet context={{ course, role, refreshCourse } satisfies CourseOutletContext} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
