import { supabase } from '../lib/supabase';

export type Role = 'student' | 'instructor';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  createdAt: string;
  institution: string | null;
  /** Students only. */
  program: string | null;
  /** Instructors only. */
  department: string | null;
  /** False until the user finishes /onboarding; AuthGate keys off this. */
  onboarded: boolean;
}

interface ProfileRow {
  id: string;
  email: string;
  display_name: string;
  role: Role;
  created_at: string;
  institution: string | null;
  program: string | null;
  department: string | null;
  onboarded: boolean;
}

const PROFILE_COLS =
  'id, email, display_name, role, created_at, institution, program, department, onboarded';

function toAuthUser(row: ProfileRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    createdAt: row.created_at,
    institution: row.institution,
    program: row.program,
    department: row.department,
    onboarded: row.onboarded,
  };
}

/** display_name travels in user metadata; a trigger on auth.users copies it
 *  into public.profiles. No role is set here — the account starts unonboarded
 *  and picks a role at /onboarding, the one step both signup paths share. */
export async function signup(input: { email: string; password: string; displayName: string }) {
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: { display_name: input.displayName } },
  });
  if (error) throw new Error(error.message);
  // With "Confirm email" enabled in Supabase, signUp returns a user but no
  // session — the caller must not send them into the app yet.
  return { id: data.user?.id ?? '', needsEmailConfirmation: data.session === null };
}

export async function login(input: { email: string; password: string }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });
  if (error) throw new Error(error.message);
  return { id: data.user?.id ?? '' };
}

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/dashboard` },
  });
  if (error) throw new Error(error.message);
}

/** Finishes /onboarding. This is where role is actually decided for both
 *  signup paths — Google can't be asked mid-redirect, so rather than guessing
 *  and patching up afterwards, neither path sets a role until here. */
export async function completeOnboarding(input: {
  role: Role;
  displayName: string;
  institution: string | null;
  program: string | null;
  department: string | null;
}): Promise<AuthUser> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) throw new Error('not authenticated');

  const { data, error } = await supabase
    .from('profiles')
    .update({
      role: input.role,
      display_name: input.displayName,
      institution: input.institution,
      // Keep the field that doesn't apply to this role null rather than
      // leaving a stale value behind if they switch role mid-flow.
      program: input.role === 'student' ? input.program : null,
      department: input.role === 'instructor' ? input.department : null,
      onboarded: true,
    })
    .eq('id', userId)
    .select(PROFILE_COLS)
    .single();
  if (error) throw new Error(error.message);
  return toAuthUser(data as ProfileRow);
}

export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

/** Throws when there is no session — callers treat that as "logged out". */
export async function fetchMe(): Promise<AuthUser> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) throw new Error('not authenticated');

  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLS)
    .eq('id', userId)
    .single();
  if (error) throw new Error(error.message);
  return toAuthUser(data as ProfileRow);
}

export async function updateProfile(input: { displayName: string }) {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) throw new Error('not authenticated');

  const { data, error } = await supabase
    .from('profiles')
    .update({ display_name: input.displayName })
    .eq('id', userId)
    .select(PROFILE_COLS)
    .single();
  if (error) throw new Error(error.message);
  return toAuthUser(data as ProfileRow);
}

/** Supabase emails a recovery link; the user lands back on /reset-password
 *  with a session already established, so no token is handled by us. */
export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw new Error(error.message);
}

export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(error.message);
}
