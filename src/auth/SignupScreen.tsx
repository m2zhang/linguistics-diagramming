import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { TreeLogo } from '../components/icons';
import { AuthLayout } from '../components/layout/AuthLayout';
import { GoogleButton } from './GoogleButton';

export function SignupScreen() {
  const signup = useAuthStore((s) => s.signup);
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmEmail, setConfirmEmail] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { needsEmailConfirmation } = await signup({ email, password, displayName });
      if (needsEmailConfirmation) {
        setConfirmEmail(true);
        return;
      }
      // Role is chosen during onboarding, which AuthGate routes to next.
      navigate('/onboarding', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (confirmEmail) {
    return (
      <AuthLayout>
        <div className="auth-card">
          <div className="auth-title">
            <TreeLogo style={{ width: 20, height: 20, verticalAlign: 'middle', marginRight: 8 }} />
            Confirm your email
          </div>
          <p className="auth-subtitle">
            We sent a confirmation link to <strong>{email}</strong>. Click it, then sign in to
            finish setting up your account.
          </p>
          <div className="auth-switch">
            <Link to="/login">Back to sign in</Link>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="auth-card">
        <div className="auth-title">
          <TreeLogo style={{ width: 20, height: 20, verticalAlign: 'middle', marginRight: 8 }} />
          Create account
        </div>
        <p className="auth-subtitle">Set up your SyntaxTree account.</p>

        {error && <div className="auth-error">{error}</div>}

        {/* No role picker here — both signup paths converge on /onboarding,
            which is the only place Google users can be asked. */}
        <GoogleButton label="Sign up with Google" />

        <form onSubmit={onSubmit}>
          <div className="auth-field">
            <label htmlFor="signup-name">Name</label>
            <input
              id="signup-name"
              type="text"
              autoComplete="name"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div className="auth-field">
            <label htmlFor="signup-email">Email</label>
            <input
              id="signup-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="auth-field">
            <label htmlFor="signup-password">Password</label>
            <input
              id="signup-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button type="submit" className="btn primary auth-submit" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <div className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
      </div>
    </AuthLayout>
  );
}
