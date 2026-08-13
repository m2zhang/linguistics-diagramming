import { useState } from 'react';
import { signInWithGoogle } from '../data/authClient';
import { GoogleMark } from '../components/profile/GoogleMark';

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
        <GoogleMark />
        {busy ? 'Redirecting…' : label}
      </button>
      <div className="auth-divider">
        <span>or</span>
      </div>
    </>
  );
}
