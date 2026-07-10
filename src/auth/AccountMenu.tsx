import { useEffect, useRef, useState } from 'react';
import { useUser } from './useUser';
import { signOut } from './authClient';

/** Toolbar avatar button with a dropdown showing the signed-in email and Sign out. */
export function AccountMenu() {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  if (!user) return null;

  const email = user.email ?? '';
  const avatarUrl = (user.user_metadata?.avatar_url as string | undefined) ?? undefined;
  const initial = (email[0] ?? '?').toUpperCase();

  return (
    <div className="account-menu" ref={ref}>
      <button
        className="account-avatar"
        title={email}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {avatarUrl ? <img src={avatarUrl} alt="" /> : initial}
      </button>
      {open && (
        <div className="account-dropdown" role="menu">
          <div className="account-email">{email}</div>
          <button className="btn ghost account-signout" onClick={() => signOut()}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
