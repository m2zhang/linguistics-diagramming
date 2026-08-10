import { FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { TreeLogo } from '../components/icons';
import { AuthLayout } from '../components/layout/AuthLayout';
import { GoogleButton } from './GoogleButton';

export function LoginScreen() {
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Keep the query string: editor deep links carry the lecture/assignment
  // context there (?saveToLecture=…&courseId=…), and dropping it silently
  // sends the user to a blank canvas after signing in.
  const attempted = (location.state as { from?: { pathname: string; search?: string; hash?: string } } | null)?.from;
  const from = attempted
    ? `${attempted.pathname}${attempted.search ?? ''}${attempted.hash ?? ''}`
    : '/dashboard';

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <div className="auth-card">
        <div className="auth-title">
          <TreeLogo style={{ width: 20, height: 20, verticalAlign: 'middle', marginRight: 8 }} />
          Sign in
        </div>
        <p className="auth-subtitle">Welcome back to SyntaxTree.</p>

        {error && <div className="auth-error">{error}</div>}

        <GoogleButton label="Sign in with Google" />

        <form onSubmit={onSubmit}>
          <div className="auth-field">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="auth-field">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <label htmlFor="login-password">Password</label>
              <Link to="/forgot-password" style={{ fontSize: '0.85rem' }}>Forgot password?</Link>
            </div>
            <div className="auth-password-wrapper">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn primary auth-submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="auth-switch">
          No account yet? <Link to="/signup">Sign up</Link>
        </div>
      </div>
    </AuthLayout>
  );
}
