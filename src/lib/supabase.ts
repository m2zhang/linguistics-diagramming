import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfigured = Boolean(url && publishableKey);

if (!supabaseConfigured) {
  // Fail loudly in the console rather than throwing at import time — the login
  // screen stays renderable and tells the user what's missing.
  console.error(
    'Supabase is not configured. Copy .env.example to .env.local and fill in ' +
      'VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, then restart the dev server.',
  );
}

export const supabase = createClient(url ?? 'http://localhost', publishableKey ?? 'missing-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // needed for the Google OAuth redirect back
  },
});

/** PostgREST/Storage errors carry the useful text on `.message`; normalize so
 *  callers can keep using `err instanceof Error ? err.message : …`. */
export function raise(error: { message: string } | null): never | void {
  if (error) throw new Error(error.message);
}
