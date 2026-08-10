import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { TreeLogo } from '../components/icons';
import { AuthLayout } from '../components/layout/AuthLayout';
import { updatePassword } from '../data/authClient';

export function ResetPasswordScreen() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      // Following the emailed recovery link already established a session
      // (detectSessionInUrl), so this is just a password change on it — there
      // is no token for the user to paste any more.
      await updatePassword(password);
      setSuccess(true);
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-title">Password Reset</div>
          <p className="auth-subtitle" style={{ color: 'green' }}>Your password has been successfully reset. Redirecting to login...</p>
          <div className="auth-switch">
            <Link to="/login">Click here if you are not redirected</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AuthLayout>
      <div className="auth-card">
        <div className="auth-title">
          <TreeLogo style={{ width: 20, height: 20, verticalAlign: 'middle', marginRight: 8 }} />
          Choose New Password
        </div>
        <p className="auth-subtitle">Enter your new password below.</p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={onSubmit}>
          <div className="auth-field">
            <label htmlFor="new-password">New Password</label>
            <div className="auth-password-wrapper">
              <input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                minLength={8}
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
            {submitting ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
        
        <div className="auth-switch">
          <Link to="/login">Back to Sign in</Link>
        </div>
      </div>
    </AuthLayout>
  );
}
