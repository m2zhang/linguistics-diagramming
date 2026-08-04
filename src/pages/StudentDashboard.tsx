import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from '../components/layout/AppHeader';
import { DashboardSidebar, type DashboardView } from '../components/layout/DashboardSidebar';
import { CourseCard } from '../components/course/CourseCard';
import { JoinCourseDialog } from '../components/course/JoinCourseDialog';
import { listCourses, type Course } from '../data/courses';
import { useUiStore } from '../store/uiStore';

const EMPTY_MESSAGE: Record<DashboardView, string> = {
  mine: "You haven't joined a course yet. Ask your instructor for a join code.",
  favorites: 'Star a course to pin it here.',
  archived: "You haven't archived any courses.",
};

import { useAuthStore } from '../store/authStore';

export function StudentDashboard() {
  const user = useAuthStore((s) => s.user);
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<DashboardView>('mine');
  const toast = useUiStore((s) => s.toast);
  const navigate = useNavigate();

  const refresh = () => {
    setError(null);
    listCourses()
      .then(setCourses)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load your courses'));
  };

  useEffect(refresh, []);

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
          <div className="mb-8 relative overflow-hidden rounded-2xl bg-gradient-to-br from-accent to-accent-strong p-8 text-white shadow-lg">
            <div className="absolute top-[-50%] right-[-10%] w-[60%] h-[200%] rounded-full bg-white/10 blur-3xl mix-blend-overlay" />
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-tight mb-2">
                  Welcome back, {user?.displayName}!
                </h1>
                <p className="text-white/90 text-sm">
                  {view === 'mine' ? 'Access lectures, materials, and assignments for your courses.' : view === 'favorites' ? 'Your pinned favorite courses.' : 'Your archived courses.'}
                </p>
              </div>
              <div className="shrink-0">
                <JoinCourseDialog
                  onJoined={(courseId) => {
                    toast('Joined course', 'success');
                    refresh();
                    navigate(`/courses/${courseId}`);
                  }}
                />
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
              <CourseCard key={course.id} course={course} role="student" onChange={updateOne} />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
