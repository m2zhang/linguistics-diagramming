import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { TreeLogo } from '../components/icons';
import { AuthLayout } from '../components/layout/AuthLayout';
import { requestPasswordReset } from '../data/authClient';

export function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setSubmitting(true);

    try {
      // Supabase emails the recovery link; there is no token for us to handle.
      await requestPasswordReset(email);
      setSuccessMessage('If that email exists, a reset link is on its way. Check your inbox.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <div className="auth-card">
        <div className="auth-title">
          <TreeLogo style={{ width: 20, height: 20, verticalAlign: 'middle', marginRight: 8 }} />
          Reset Password
        </div>
        <p className="auth-subtitle">Enter your email to receive a reset link.</p>

        {error && <div className="auth-error">{error}</div>}
        {successMessage && (
          <div style={{ color: 'green', marginBottom: '1rem', fontSize: '0.9rem' }}>{successMessage}</div>
        )}

        <form onSubmit={onSubmit}>
          <div className="auth-field">
            <label htmlFor="reset-email">Email</label>
            <input
              id="reset-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <button type="submit" className="btn primary auth-submit" disabled={submitting}>
            {submitting ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        <div className="auth-switch">
          Remember your password? <Link to="/login">Sign in</Link>
        </div>
      </div>
    </AuthLayout>
  );
}
