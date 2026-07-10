import { ReactNode } from 'react';
import { useUser } from './useUser';
import { LoginScreen } from './LoginScreen';

/** Renders `children` only when a user is signed in; otherwise the login screen.
 *  Shows a brief loading state while the initial session check resolves. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useUser();

  if (loading) {
    return (
      <div className="auth-screen">
        <div className="auth-spinner" aria-label="Loading" />
      </div>
    );
  }

  if (!user) return <LoginScreen />;

  return <>{children}</>;
}
