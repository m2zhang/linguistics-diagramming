import { supabase } from '../lib/supabase';

/**
 * The ONLY module that knows which OAuth provider is used. Keeping the provider
 * choice isolated here means adding Microsoft (Entra ID) later is a one-line change
 * plus a new button — no other file references the provider.
 */

/** Start the Google OAuth flow. Redirects back to the app when complete. */
export function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
}

// Phase 5 — uncomment and add a button; no other changes needed.
// export function signInWithMicrosoft() {
//   return supabase.auth.signInWithOAuth({
//     provider: 'azure',
//     options: { scopes: 'email', redirectTo: window.location.origin },
//   });
// }

export function signOut() {
  return supabase.auth.signOut();
}
