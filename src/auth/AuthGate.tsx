import { ReactNode, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { AuthLayout } from '../components/layout/AuthLayout';

/** Wraps any route tree that requires a signed-in user. Redirects to /login
 *  (preserving the attempted location) when the session check fails. */
export function AuthGate({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const refresh = useAuthStore((s) => s.refresh);
  const location = useLocation();

  useEffect(() => {
    // Runs once per app load; LoginScreen/SignupScreen call refresh() themselves
    // after a successful auth action, so this doesn't need to re-run on route change.
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  return <>{children}</>;
}
