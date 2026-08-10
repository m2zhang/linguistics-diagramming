import { useEffect, useState } from 'react';
import { AppHeader } from '../components/layout/AppHeader';
import { DashboardSidebar, type DashboardView } from '../components/layout/DashboardSidebar';
import { CourseCard } from '../components/course/CourseCard';
import { CreateCourseDialog } from '../components/course/CreateCourseDialog';
import { listCourses, type Course } from '../data/courses';

const EMPTY_MESSAGE: Record<DashboardView, string> = {
  mine: "You haven't created a course yet.",
  favorites: 'Star a course to pin it here.',
  archived: "You haven't archived any courses.",
};

import { useAuthStore } from '../store/authStore';

export function InstructorDashboard() {
  const user = useAuthStore((s) => s.user);
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<DashboardView>('mine');

  useEffect(() => {
    listCourses()
      .then(setCourses)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load your courses'));
  }, []);

  const updateOne = (updated: Course) => {
    setCourses((prev) => prev?.map((c) => (c.id === updated.id ? updated : c)) ?? prev);
  };

  const visible = courses?.filter((c) => {
    if (view === 'archived') return c.archived;
    if (c.archived) return false;
    return view === 'mine' || c.favorite;
  });

  return (
    <div className="flex min-h-full flex-col bg-bg">
      <AppHeader />
      <div className="flex min-h-0 flex-1">
        <DashboardSidebar view={view} onChange={setView} />
        <main className="flex-1 overflow-y-auto px-8 py-6">
          {/* Hero Banner */}
          <div className="mb-4 relative overflow-hidden rounded-xl bg-gradient-to-r from-accent to-accent-strong px-5 py-3 text-white shadow-sm">
            <div className="absolute top-[-50%] right-[-10%] w-[60%] h-[200%] rounded-full bg-white/10 blur-3xl mix-blend-overlay" />
            <div className="relative z-10 flex items-center justify-between gap-4">
              <div>
                <h1 className="font-[family-name:var(--font-display)] text-lg font-bold tracking-tight mb-0.5">
                  Welcome back, {user?.displayName}!
                </h1>
                <p className="text-white/85 text-xs">
                  {view === 'mine' ? 'Manage lectures, materials, and assignments for your courses.' : view === 'favorites' ? 'Your pinned favorite courses.' : 'Your archived courses.'}
                </p>
              </div>
              <div className="shrink-0">
                <CreateCourseDialog onCreated={(course) => setCourses((prev) => [course, ...(prev ?? [])])} />
              </div>
            </div>
          </div>

          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-text">
              {view === 'mine' ? 'Your courses' : view === 'favorites' ? 'Favorite courses' : 'Archived courses'}
            </h2>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}
          {!error && courses === null && <p className="text-sm text-text-dim">Loading…</p>}

          {visible?.length === 0 && (
            <div className="rounded-[var(--radius)] border border-dashed border-border p-12 text-center text-text-dim">
              {EMPTY_MESSAGE[view]}
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {visible?.map((course) => (
              <CourseCard key={course.id} course={course} role="instructor" onChange={updateOne} />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
