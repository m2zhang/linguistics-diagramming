import { FormEvent, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Keyboard, Mail, Shield, User } from 'lucide-react';
import { AppHeader } from '../components/layout/AppHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { ProfileAvatar } from '../components/ui/avatar';
import { BackButton } from '../components/ui/back-button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { SecurityTab } from '../components/profile/SecurityTab';
import { ShortcutsReference } from '../components/profile/ShortcutsReference';
import { useAuthStore } from '../store/authStore';
import { useUiStore } from '../store/uiStore';

const TABS = ['profile', 'security', 'shortcuts'] as const;
type TabKey = (typeof TABS)[number];

export function Profile() {
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const toast = useUiStore((s) => s.toast);

  // The tab lives in the URL so the Google link redirect can come back to
  // /profile?tab=security instead of dumping the user on the Profile tab.
  const [searchParams, setSearchParams] = useSearchParams();
  const paramTab = searchParams.get('tab');
  const tab: TabKey = TABS.includes(paramTab as TabKey) ? (paramTab as TabKey) : 'profile';

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [institution, setInstitution] = useState(user?.institution ?? '');
  const [program, setProgram] = useState(user?.program ?? '');
  const [department, setDepartment] = useState(user?.department ?? '');
  const [submitting, setSubmitting] = useState(false);

  if (!user) return null;

  const isInstructor = user.role === 'instructor';
  const roleField = isInstructor ? department : program;
  const setRoleField = isInstructor ? setDepartment : setProgram;

  const dirty =
    displayName !== user.displayName ||
    institution !== (user.institution ?? '') ||
    (isInstructor
      ? department !== (user.department ?? '')
      : program !== (user.program ?? ''));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await updateProfile({
        displayName: displayName.trim(),
        institution: institution.trim() || null,
        // Only the field this role actually shows, so the hidden one keeps
        // whatever onboarding put there.
        ...(isInstructor
          ? { department: department.trim() || null }
          : { program: program.trim() || null }),
      });
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
      <main className="mx-auto max-w-3xl px-6 py-8">
        <BackButton to="/dashboard" label="Back to courses" className="mb-5" />

        {/* ---- Identity header ---- */}
        <header className="mb-6 flex flex-wrap items-center gap-5">
          <ProfileAvatar
            seed={user.id}
            name={user.displayName}
            className="h-16 w-16 shrink-0 text-xl"
          />
          <div className="min-w-0">
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold leading-tight">
              {user.displayName}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <Badge variant="default" className="capitalize">
                {user.role}
              </Badge>
              <span className="flex items-center gap-1.5 text-sm text-text-dim">
                <Mail size={13} /> {user.email}
              </span>
              <span className="text-sm text-text-faint">
                Member since{' '}
                {new Date(user.createdAt).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'long',
                })}
              </span>
            </div>
          </div>
        </header>

        <Tabs
          value={tab}
          onValueChange={(next) =>
            setSearchParams(next === 'profile' ? {} : { tab: next }, { replace: true })
          }
        >
          <TabsList className="mb-5">
            <TabsTrigger value="profile">
              <User size={15} /> Profile
            </TabsTrigger>
            <TabsTrigger value="security">
              <Shield size={15} /> Security
            </TabsTrigger>
            <TabsTrigger value="shortcuts">
              <Keyboard size={15} /> Shortcuts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Account details</CardTitle>
                <CardDescription>
                  How you appear to everyone else in your courses.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-4">
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
                    <Label htmlFor="profile-institution">School or university</Label>
                    <Input
                      id="profile-institution"
                      placeholder="University of Toronto"
                      value={institution}
                      onChange={(e) => setInstitution(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="profile-role-field">
                      {isInstructor ? 'Department' : 'Programme or major'}
                    </Label>
                    <Input
                      id="profile-role-field"
                      placeholder={isInstructor ? 'Department of Linguistics' : 'Linguistics'}
                      value={roleField}
                      onChange={(e) => setRoleField(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="profile-email">Email</Label>
                    <Input id="profile-email" value={user.email} disabled />
                    <p className="text-xs text-text-faint">
                      Email can't be changed. It is how you sign in.
                    </p>
                  </div>

                  <div>
                    <Button type="submit" disabled={submitting || !dirty}>
                      {submitting ? 'Saving...' : 'Save changes'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <SecurityTab />
          </TabsContent>

          <TabsContent value="shortcuts">
            <ShortcutsReference />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
