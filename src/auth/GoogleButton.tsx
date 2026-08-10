import { useState } from 'react';
import { signInWithGoogle } from '../data/authClient';

/** Google sign-in, offered alongside email+password on both auth screens.
 *  New Google accounts land unonboarded, so AuthGate routes them to
 *  /onboarding to pick a role before anything else renders. */
export function GoogleButton({ label }: { label: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    setError(null);
    setBusy(true);
    try {
      await signInWithGoogle();
      // On success the browser is redirecting to Google; leave `busy` set so
      // the button stays disabled for the moment before navigation.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start Google sign-in');
      setBusy(false);
    }
  };

  return (
    <>
      {error && <div className="auth-error">{error}</div>}
      <button type="button" className="auth-provider-btn" onClick={onClick} disabled={busy}>
        <GoogleIcon />
        {busy ? 'Redirecting…' : label}
      </button>
      <div className="auth-divider">
        <span>or</span>
      </div>
    </>
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
      <path fill="#FBBC05" d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.02-2.34z" />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.9 11.42 0 9 0A9 9 0 0 0 .96 4.94l3.02 2.34C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}
