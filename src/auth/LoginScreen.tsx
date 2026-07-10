import { useState } from 'react';
import { signInWithGoogle } from './authClient';
import { supabaseConfigured } from '../lib/supabase';

/** Full-screen sign-in gate shown when no user is authenticated. */
export function LoginScreen() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogle() {
    setBusy(true);
    setError(null);
    const { error } = await signInWithGoogle();
    if (error) {
      setError(error.message);
      setBusy(false);
    }
    // On success the browser redirects to the OAuth provider, so no need to reset busy.
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1 className="auth-title">SyntaxTree</h1>
        <p className="auth-tagline">Diagram linguistic structures. Sign in to save your trees.</p>

        {supabaseConfigured ? (
          <>
            <button className="btn primary auth-provider-btn" onClick={handleGoogle} disabled={busy}>
              <GoogleIcon />
              {busy ? 'Redirecting…' : 'Sign in with Google'}
            </button>
            {error && <p className="auth-error">{error}</p>}
          </>
        ) : (
          <p className="auth-error">
            Supabase isn’t configured yet. Copy <code>.env.example</code> to{' '}
            <code>.env.local</code>, fill in your project URL and anon key, then restart the dev
            server.
          </p>
        )}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.34A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.02-2.34z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.9 11.42 0 9 0A9 9 0 0 0 .96 4.94l3.02 2.34C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}
