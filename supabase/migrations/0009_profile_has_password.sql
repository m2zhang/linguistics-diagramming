-- Track whether an account has a password of its own.
--
-- Supabase cannot answer this. Both candidate signals are dead ends, verified
-- against this stack: `auth.identities` lists an `email` identity even for a
-- user created without any password, and `auth.users.encrypted_password` is a
-- 60-char bcrypt hash in that same case (GoTrue fills it with a random one).
-- So the flag has to be ours.
--
-- It exists for one product rule: a Google account must not be able to
-- disconnect Google and lock itself out. The Security tab only offers
-- "Disconnect" once has_password is true, and /onboarding collects a password
-- from anyone arriving without one — so "signed up with Google" still ends up
-- with a way back in.
--
-- This is a UX guard, not a security boundary: profiles_update_own lets a user
-- write their own row, so the flag is as trustworthy as the client that sets
-- it. The actual safety net is GoTrue itself, which refuses to unlink an
-- account's last identity.

alter table public.profiles
  add column if not exists has_password boolean not null default false;

-- Signup metadata carries the answer: the email+password form sets
-- has_password, and an OAuth signup has no way to. Reading it here rather than
-- from a later client update means it is correct even when "Confirm email" is
-- on and signUp() returns no session to write with.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name, role, onboarded, has_password)
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
    false,
    coalesce((new.raw_user_meta_data->>'has_password')::boolean, false)
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- Backfill: an account with no Google identity can only have been created
-- through the email+password form, so it has one. Anything Google-linked keeps
-- the default false and is walked through setting a password.
update public.profiles p
   set has_password = true
 where not exists (
   select 1 from auth.identities i
    where i.user_id = p.id and i.provider = 'google'
 );
