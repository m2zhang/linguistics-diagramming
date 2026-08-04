import { supabase } from '../lib/supabase';

export type Role = 'student' | 'instructor';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  createdAt: string;
}

interface ProfileRow {
  id: string;
  email: string;
  display_name: string;
  role: Role;
  created_at: string;
}

function toAuthUser(row: ProfileRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    createdAt: row.created_at,
  };
}

/** display_name/role travel in user metadata; a trigger on auth.users copies
 *  them into public.profiles, which is what the rest of the app reads. */
export async function signup(input: { email: string; password: string; displayName: string; role: Role }) {
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: { display_name: input.displayName, role: input.role } },
  });
  if (error) throw new Error(error.message);
  return { id: data.user?.id ?? '', role: input.role };
}

export async function login(input: { email: string; password: string }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });
  if (error) throw new Error(error.message);
  return { id: data.user?.id ?? '' };
}

const PENDING_ROLE_KEY = 'syntaxtree.pendingRole';

/** OAuth gives us no way to ask "student or instructor?" mid-flow, and Google
 *  supplies the user metadata, so the signup screen's choice is stashed here
 *  and applied by applyPendingRole() once the user lands back. */
export async function signInWithGoogle(role?: Role) {
  if (role) localStorage.setItem(PENDING_ROLE_KEY, role);
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/dashboard` },
  });
  if (error) {
    localStorage.removeItem(PENDING_ROLE_KEY);
    throw new Error(error.message);
  }
}

/** Applies a role chosen on the signup screen before a Google redirect. Only
 *  ever upgrades a brand-new account still sitting on the trigger's 'student'
 *  default — it will not overwrite the role of an existing account. */
export async function applyPendingRole(current: AuthUser): Promise<AuthUser> {
  const pending = localStorage.getItem(PENDING_ROLE_KEY) as Role | null;
  if (!pending) return current;
  localStorage.removeItem(PENDING_ROLE_KEY);
  if (pending === current.role || current.role !== 'student') return current;

  const { data, error } = await supabase
    .from('profiles')
    .update({ role: pending })
    .eq('id', current.id)
    .select('id, email, display_name, role, created_at')
    .single();
  if (error) return current; // Not worth failing the login over.
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
    .select('id, email, display_name, role, created_at')
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
    .select('id, email, display_name, role, created_at')
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
