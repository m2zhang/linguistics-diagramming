import { useEffect, useState, type CSSProperties } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { GraduationCap, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
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
  const [width, setWidth] = useState(288);
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = moveEvent.clientX;
      if (newWidth < 120) {
        setCollapsed(true);
      } else {
        setCollapsed(false);
        setWidth(Math.min(Math.max(newWidth, 180), 450));
      }
    };

    const onMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

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
          style={{ width: collapsed ? 64 : width }}
          className={`relative flex shrink-0 flex-col border-r border-border app-rail select-none ${!isResizing ? 'transition-[width] duration-200' : ''}`}
        >
          {/* Boundary Slider / Resizer Handle */}
          <div
            onMouseDown={startResizing}
            onDoubleClick={() => setCollapsed((c) => !c)}
            title="Drag boundary to resize sidebar (double-click to toggle)"
            className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize flex items-center justify-center group z-20"
          >
            <div className="w-1 h-12 rounded-full bg-border/80 group-hover:bg-accent group-hover:h-16 group-hover:w-1.5 transition-all shadow-sm" />
          </div>

          {/* Top header bar inside sidebar with toggle */}
          <div className="flex items-center justify-end p-2 px-3 border-b border-border/40">
            <button
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              onClick={() => setCollapsed((c) => !c)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-text-dim hover:bg-bg-input hover:text-text transition-colors"
            >
              {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
          </div>

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

        {/* The course colour reaches the pages as `--course-color` rather than
            as a full-bleed band drawn here: PageHeader paints it as its own
            rounded panel, so the colour has a shape instead of bleeding to the
            window edges and stopping at an arbitrary line. Passing it as a
            custom property means every page picks it up without prop drilling
            — the assignment pages only receive a courseId, not the course.

            The pages own their cards too; a single wrapper card here made the
            heading look like that card's title. */}
        <main className="flex-1 overflow-y-auto bg-bg">
          <div
            className="mx-auto w-full max-w-6xl px-8 pb-12 pt-6"
            style={{ '--course-color': courseColorHex(course.color) } as CSSProperties}
          >
            <Outlet context={{ course, role, refreshCourse } satisfies CourseOutletContext} />
          </div>
        </main>
      </div>
    </div>
  );
}
