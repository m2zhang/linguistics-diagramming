import { ReactNode, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

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
      <div className="auth-screen">
        <div className="auth-spinner" aria-label="Loading" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
