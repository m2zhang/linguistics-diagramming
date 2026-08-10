import { FormEvent, useState } from 'react';
import { AppHeader } from '../components/layout/AppHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { ProfileAvatar } from '../components/ui/avatar';
import { BackButton } from '../components/ui/back-button';
import { useAuthStore } from '../store/authStore';
import { useUiStore } from '../store/uiStore';

export function Profile() {
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const toast = useUiStore((s) => s.toast);

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [submitting, setSubmitting] = useState(false);

  if (!user) return null;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await updateProfile(displayName);
      toast('Profile updated', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not update profile', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-full bg-bg">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-6 py-8">
        <BackButton to="/dashboard" label="Back to courses" className="mb-4" />

        <div className="mb-6 flex items-center gap-4">
          <ProfileAvatar seed={user.id} name={user.displayName} className="h-14 w-14 text-lg" />
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">{user.displayName}</h1>
            <Badge variant="default" className="mt-1 capitalize">
              {user.role}
            </Badge>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>
              Member since {new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="profile-name">Display name</Label>
                <Input
                  id="profile-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="profile-email">Email</Label>
                <Input id="profile-email" value={user.email} disabled />
                <p className="text-xs text-text-faint">Email can't be changed.</p>
              </div>
              <div>
                <Button type="submit" disabled={submitting || displayName === user.displayName}>
                  {submitting ? 'Saving…' : 'Save changes'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
