import { FormEvent, useEffect, useState } from 'react';
import { KeyRound, Link2, ShieldCheck, Unlink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { GoogleMark } from './GoogleMark';
import {
  connectGoogle,
  disconnectGoogle,
  listLinkedIdentities,
  type LinkedIdentity,
} from '../../data/authClient';
import { useAuthStore } from '../../store/authStore';
import { useUiStore } from '../../store/uiStore';

const MIN_PASSWORD = 8;

/**
 * Password management and connected accounts.
 *
 * The two halves are coupled by one rule: Google can only be disconnected once
 * the account has a password of its own, because otherwise disconnecting is a
 * lockout. The password card is rendered first for that reason, and a
 * Google-only account is told why the Disconnect button is disabled rather
 * than being left to guess.
 */
export function SecurityTab() {
  const user = useAuthStore((s) => s.user);
  const changePassword = useAuthStore((s) => s.changePassword);
  const setInitialPassword = useAuthStore((s) => s.setInitialPassword);
  const toast = useUiStore((s) => s.toast);

  const [identities, setIdentities] = useState<LinkedIdentity[] | null>(null);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [linking, setLinking] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  const hasPassword = user?.hasPassword ?? false;

  const loadIdentities = () => {
    listLinkedIdentities()
      .then((list) => {
        setIdentities(list);
        setIdentityError(null);
      })
      .catch((err) => {
        setIdentities([]);
        setIdentityError(err instanceof Error ? err.message : 'Could not load connected accounts');
      });
  };

  useEffect(loadIdentities, []);

  const google = identities?.find((i) => i.provider === 'google') ?? null;

  const onSubmitPassword = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (newPassword.length < MIN_PASSWORD) {
      setFormError(`Use at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setFormError('New passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      if (hasPassword) await changePassword(currentPassword, newPassword);
      else await setInitialPassword(newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast(hasPassword ? 'Password updated' : 'Password set', 'success');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not update password');
    } finally {
      setSaving(false);
    }
  };

  const onConnect = async () => {
    setLinking(true);
    try {
      await connectGoogle();
      // Success means the browser is navigating to Google. It comes back to
      // /profile, where the effect above re-reads the identity list.
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not connect Google', 'error');
      setLinking(false);
    }
  };

  const onDisconnect = async () => {
    setUnlinking(true);
    try {
      await disconnectGoogle();
      loadIdentities();
      toast('Google disconnected', 'success');
      setConfirmUnlink(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not disconnect Google', 'error');
    } finally {
      setUnlinking(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ---- Password ---- */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <KeyRound size={16} className="text-text-dim" />
                {hasPassword ? 'Change password' : 'Set a password'}
              </CardTitle>
              <CardDescription>
                {hasPassword
                  ? 'You need your current password to set a new one.'
                  : 'This account signs in with Google only. Add a password so you can still get in if you disconnect it.'}
              </CardDescription>
            </div>
            <Badge variant={hasPassword ? 'success' : 'warning'} className="shrink-0">
              {hasPassword ? 'Password set' : 'No password'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {formError && <div className="auth-error mb-3">{formError}</div>}

          <form onSubmit={onSubmitPassword} className="flex max-w-md flex-col gap-4">
            {hasPassword && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="current-password">Current password</Label>
                <Input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={MIN_PASSWORD}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <p className="text-xs text-text-faint">At least {MIN_PASSWORD} characters.</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <div>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : hasPassword ? 'Update password' : 'Set password'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ---- Connected accounts ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-text-dim" />
            Connected accounts
          </CardTitle>
          <CardDescription>Sign in to SyntaxTree with an account you already have.</CardDescription>
        </CardHeader>
        <CardContent>
          {identityError && <div className="auth-error mb-3">{identityError}</div>}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border border-border bg-bg-input px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-bg-elevated">
                <GoogleMark size={18} />
              </span>
              <div>
                <p className="text-sm font-semibold">Google</p>
                <p className="text-xs text-text-dim">
                  {identities === null
                    ? 'Checking...'
                    : google
                      ? `Connected${google.email ? ` as ${google.email}` : ''}`
                      : 'Not connected'}
                </p>
              </div>
            </div>

            {identities !== null &&
              (google ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasPassword}
                  title={
                    hasPassword
                      ? 'Disconnect Google from this account'
                      : 'Set a password first, or you would have no way to sign in'
                  }
                  onClick={() => setConfirmUnlink(true)}
                >
                  <Unlink size={14} /> Disconnect
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled={linking} onClick={onConnect}>
                  <Link2 size={14} /> {linking ? 'Redirecting...' : 'Connect'}
                </Button>
              ))}
          </div>

          {google && !hasPassword && (
            <p className="mt-3 text-xs text-warning">
              Set a password above before disconnecting Google. It is currently the only way into
              this account.
            </p>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmUnlink}
        onOpenChange={setConfirmUnlink}
        title="Disconnect Google?"
        description="You will sign in with your email and password from now on. You can reconnect Google at any time."
        confirmLabel="Disconnect"
        destructive
        confirming={unlinking}
        onConfirm={onDisconnect}
      />
    </div>
  );
}
