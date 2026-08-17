import { appUrl } from '../lib/appUrl';
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
  /** Whether the account has a password of its own — see migration 0006 for
   *  why this is tracked here instead of being read back from Supabase. */
  hasPassword: boolean;
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
  has_password: boolean;
}

const PROFILE_COLS =
  'id, email, display_name, role, created_at, institution, program, department, onboarded, has_password';

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
    hasPassword: row.has_password,
  };
}

/** display_name travels in user metadata; a trigger on auth.users copies it
 *  into public.profiles. No role is set here — the account starts unonboarded
 *  and picks a role at /onboarding, the one step both signup paths share. */
export async function signup(input: { email: string; password: string; displayName: string }) {
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    // has_password is read by the handle_new_user trigger. It travels in
    // metadata rather than being written after the fact because with "Confirm
    // email" on there is no session here to write with.
    options: { data: { display_name: input.displayName, has_password: true } },
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
    options: { redirectTo: appUrl('/dashboard') },
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

/** Institution/programme/department are collected at /onboarding and were
 *  previously unreachable afterwards, so they are editable here. Only the keys
 *  actually passed are written, which keeps the role-specific field the user
 *  cannot see (a student has no department) from being nulled behind them. */
export async function updateProfile(input: {
  displayName?: string;
  institution?: string | null;
  program?: string | null;
  department?: string | null;
}) {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) throw new Error('not authenticated');

  const patch: Record<string, unknown> = {};
  if (input.displayName !== undefined) patch.display_name = input.displayName;
  if (input.institution !== undefined) patch.institution = input.institution;
  if (input.program !== undefined) patch.program = input.program;
  if (input.department !== undefined) patch.department = input.department;

  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
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
    redirectTo: appUrl('/reset-password'),
  });
  if (error) throw new Error(error.message);
}

export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------- identities

export interface LinkedIdentity {
  id: string;
  provider: string;
  email?: string;
  createdAt?: string;
}

/** OAuth providers linked to this account. An `email` identity is not evidence
 *  of a password — see migration 0006 — so it is filtered out here rather than
 *  being shown as a connected account. */
export async function listLinkedIdentities(): Promise<LinkedIdentity[]> {
  const { data, error } = await supabase.auth.getUserIdentities();
  if (error) throw new Error(error.message);
  return (data?.identities ?? [])
    .filter((i) => i.provider !== 'email')
    .map((i) => ({
      id: i.identity_id ?? i.id,
      provider: i.provider,
      email: (i.identity_data?.email as string | undefined) ?? undefined,
      createdAt: i.created_at,
    }));
}

/** Redirects to Google and back to /profile. Needs auth.enable_manual_linking
 *  in supabase/config.toml, and the google provider configured. */
export async function connectGoogle() {
  const { error } = await supabase.auth.linkIdentity({
    provider: 'google',
    options: { redirectTo: appUrl('/profile') },
  });
  if (error) throw new Error(describeProviderError(error.message));
}

export async function disconnectGoogle() {
  const { data, error } = await supabase.auth.getUserIdentities();
  if (error) throw new Error(error.message);

  const google = (data?.identities ?? []).find((i) => i.provider === 'google');
  if (!google) throw new Error('Google is not connected to this account');

  const { error: unlinkError } = await supabase.auth.unlinkIdentity(google);
  if (unlinkError) throw new Error(describeProviderError(unlinkError.message));
}

/** Turns the provider's terse errors into something a user can act on. */
function describeProviderError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('manual linking') || m.includes('not enabled')) {
    return 'Account linking is disabled on this Supabase project. Enable auth.enable_manual_linking and restart the stack.';
  }
  if (m.includes('provider is not enabled') || m.includes('unsupported provider')) {
    return 'Google sign-in is not configured on this Supabase project yet.';
  }
  return message;
}

// ----------------------------------------------------------------- passwords

/** Mirrors a password change into profiles.has_password. Separate from
 *  updateUser() because Supabase has no field of its own for it. */
async function markHasPassword() {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) throw new Error('not authenticated');

  const { data, error } = await supabase
    .from('profiles')
    .update({ has_password: true })
    .eq('id', userId)
    .select(PROFILE_COLS)
    .single();
  if (error) throw new Error(error.message);
  return toAuthUser(data as ProfileRow);
}

/**
 * Change an existing password.
 *
 * updateUser() alone would let anyone who walked up to an unlocked session
 * take the account over, so the current password is checked first. Supabase
 * has no verify endpoint; signing in with it is the check, and it is safe to
 * do here because on success it returns the same session the user already had.
 */
export async function changePassword(input: {
  email: string;
  currentPassword: string;
  newPassword: string;
}): Promise<AuthUser> {
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.currentPassword,
  });
  if (reauthError) throw new Error('Current password is incorrect');

  const { error } = await supabase.auth.updateUser({ password: input.newPassword });
  if (error) throw new Error(error.message);
  return markHasPassword();
}

/** First password for an account that signed up through Google. There is
 *  nothing to re-authenticate against, so the live session is the proof. */
export async function setInitialPassword(password: string): Promise<AuthUser> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(error.message);
  return markHasPassword();
}
