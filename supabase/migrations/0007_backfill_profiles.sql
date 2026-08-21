-- Fix: login succeeded, then fetchMe() 406'd (PGRST116, "0 rows") because the
-- signed-in user had no row in public.profiles.
--
-- Every account is supposed to get one from the on_auth_user_created trigger.
-- Accounts created before that trigger existed — or while it was failing — have
-- an auth.users row and nothing else, and the app has no way to recover on its
-- own: profiles_read only matches `id = auth.uid()`, so a missing row is
-- indistinguishable from a forbidden one.
--
-- Two parts: recreate the trigger (idempotent, in case it was never installed),
-- then backfill anyone it missed.
-- Run the whole file in the Supabase SQL Editor.

-- The function itself is already correct as of 0002; just make sure the trigger
-- is actually attached to auth.users.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill. Mirrors handle_new_user()'s column logic exactly so a backfilled
-- account is indistinguishable from a freshly signed-up one.
insert into public.profiles (id, email, display_name, role, onboarded)
select
  u.id,
  u.email,
  coalesce(
    nullif(u.raw_user_meta_data->>'display_name', ''),
    nullif(u.raw_user_meta_data->>'full_name', ''),
    nullif(u.raw_user_meta_data->>'name', ''),
    split_part(u.email, '@', 1)
  ),
  coalesce((u.raw_user_meta_data->>'role')::public.user_role, 'student'),
  false   -- onboarded: these users get walked through /onboarding on next login
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
  and u.email is not null   -- profiles.email is NOT NULL; phone-only accounts can't be backfilled
on conflict (id) do nothing;

-- Verify (expect 0):
--   select count(*) from auth.users u
--     left join public.profiles p on p.id = u.id
--    where p.id is null and u.email is not null;
