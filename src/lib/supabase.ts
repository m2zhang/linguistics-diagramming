import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/** True when both Supabase env vars are present. Lets the UI show a helpful hint
 *  instead of crashing when `.env.local` hasn't been filled in yet. */
export const supabaseConfigured = Boolean(url && publishableKey);

if (!supabaseConfigured) {
  // Not fatal — the login screen surfaces this — but loud in the console during setup.
  console.warn(
    'Supabase is not configured. Copy .env.example to .env.local and set ' +
      'VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, then restart `npm run dev`.',
  );
}

/** Single shared Supabase client. Uses placeholder values when unconfigured so the
 *  module still imports; any actual call will fail until env vars are set. */
export const supabase = createClient(url ?? 'http://localhost', publishableKey ?? 'public-anon-key');
