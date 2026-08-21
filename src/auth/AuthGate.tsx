import { ReactNode, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { AuthLayout } from '../components/layout/AuthLayout';

/** Wraps any route tree that requires a signed-in user. Redirects to /login
 *  (preserving the attempted location) when the session check fails. */
export function AuthGate({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const refresh = useAuthStore((s) => s.refresh);
  const location = useLocation();

  useEffect(() => {
    // Only do the initial session check once per app load (authStore starts at "loading").
    if (status !== 'loading') return;
    void refresh();
  }, [status, refresh]);

  if (status === 'loading') {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center justify-center space-y-6 py-12">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-border border-t-accent" />
          <p className="font-[family-name:var(--font-display)] text-sm font-semibold tracking-wide text-text-dim animate-pulse">
            Loading session...
          </p>
        </div>
      </AuthLayout>
    );
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // A signed-in account with no role chosen yet can't render a dashboard —
  // finish onboarding first. The /onboarding route itself is exempt, or this
  // would redirect to itself forever.
  if (user && !user.onboarded && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
