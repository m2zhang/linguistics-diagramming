import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { TreeLogo } from '../components/icons';
import { AuthLayout } from '../components/layout/AuthLayout';

export function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setDevToken(null);
    setSubmitting(true);
    
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to request password reset');
      }
      
      setSuccessMessage(data.message);
      if (data.devToken) {
        setDevToken(data.devToken);
      }
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
          <div style={{ color: 'green', marginBottom: '1rem', fontSize: '0.9rem' }}>
            {successMessage}
            {devToken && (
              <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#eef2ff', borderRadius: '4px', wordBreak: 'break-all' }}>
                <strong>Dev Token:</strong> {devToken}
                <br/>
                <Link to={`/reset-password?token=${devToken}`} style={{textDecoration: 'underline'}}>Click here to reset</Link>
              </div>
            )}
          </div>
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
