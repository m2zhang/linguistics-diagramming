-- Onboarding: role-specific profile details collected right after signup.
--
-- Separate migration because 0001 is already applied. Run this whole file in
-- the SQL Editor the same way.
--
-- `onboarded` is the gate: AuthGate sends any signed-in user whose flag is
-- still false to /onboarding before they can reach the rest of the app. That
-- is what makes Google sign-up work properly — Google supplies name and email
-- but has no way to ask "student or teacher?", so the answer is collected here
-- instead of being guessed at.

alter table public.profiles
  add column if not exists institution text,
  add column if not exists program     text,   -- students: major / programme
  add column if not exists department  text,   -- instructors: department
  add column if not exists onboarded   boolean not null default false;

-- Existing accounts predate onboarding, so they are flagged incomplete and
-- will be walked through it on next sign-in. Flip these to true instead if you
-- would rather leave current test accounts alone:
--   update public.profiles set onboarded = true;

-- Signup metadata may carry the role (email path) — keep honouring it, and
-- record an explicit onboarded=false so the gate is unambiguous for new rows.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name, role, onboarded)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data->>'display_name', ''),
      nullif(new.raw_user_meta_data->>'full_name', ''),   -- Google sends full_name
      nullif(new.raw_user_meta_data->>'name', ''),
      split_part(new.email, '@', 1)
    ),
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'student'),
    false
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- profiles_update_own (0001) already allows a user to update their own row,
-- which covers writing these columns and flipping `onboarded`. Role is part of
-- that same row: a user picks their own role at signup today, so onboarding
-- setting it is not a new privilege.
