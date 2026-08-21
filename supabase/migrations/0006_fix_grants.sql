-- Fix: every REST call 403s with
--   {"code":"42501","message":"permission denied for table profiles"}
-- even for the user's own row, which policy profiles_read plainly allows.
--
-- Grants and RLS are two separate gates, checked in that order. Postgres asks
-- "does this role hold SELECT on the table?" *before* it ever evaluates a
-- policy, so with no grant the request dies at the first gate and PostgREST
-- reports 42501 / 403. An RLS *denial* looks completely different: the rows are
-- filtered out silently and you get 200 [] (or a 406 from .single()).
--
-- 0003_grants.sql exists to close this, but was evidently never applied to the
-- live project — nothing else in 0001-0005 grants table privileges.
--
-- Nor is there any implicit grant to fall back on. Supabase used to auto-expose
-- everything `postgres` created in public to the Data API roles; new projects
-- default to the opposite (see auto_expose_new_tables in config.toml, which is
-- unset here and disappears entirely on 2026-10-30 when always-revoked becomes
-- permanent). So on this project every table needs its grant written out, and a
-- table added by a later migration starts life unreadable until it gets one.
--
-- This supersedes 0003. Differences:
--   * Privileges are spelled out per role instead of ALL PRIVILEGES to both.
--     anon gets SELECT and nothing else: every policy is `to authenticated`,
--     so anon still reads zero rows, but a future policy that forgets its role
--     clause can then leak reads at worst, never writes.
--   * TRUNCATE/REFERENCES/TRIGGER are not DML and no client needs them.
--   * The ALTER DEFAULT PRIVILEGES lines are repeated so tables added by later
--     migrations inherit the same grants without another round of this.
--
-- Idempotent: safe to run again, and safe to run even if 0003 did apply.
-- Run the whole file in the Supabase SQL Editor.

grant usage on schema public to anon, authenticated, service_role;

-- Signed-in users. RLS is what decides *which* rows they reach; this only says
-- the tables are visible to the role in the first place.
grant select, insert, update, delete on all tables    in schema public to authenticated;
grant usage, select                  on all sequences in schema public to authenticated;
grant execute                        on all routines  in schema public to authenticated;

-- service_role deliberately bypasses RLS and is server-side only.
grant all privileges on all tables    in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant all privileges on all routines  in schema public to service_role;

-- Anonymous callers, i.e. logged-out visitors and anyone whose token expired.
-- SELECT is granted so those requests come back as an empty result the client
-- can handle, instead of the same opaque 403 this migration exists to fix. No
-- policy admits anon today, so the rows are filtered to nothing regardless.
grant select  on all tables   in schema public to anon;

-- Same grants for anything created later, so a new table is not born broken.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
alter default privileges in schema public
  grant select on tables to anon;
alter default privileges in schema public
  grant execute on routines to authenticated;
alter default privileges in schema public
  grant all privileges on tables to service_role;
alter default privileges in schema public
  grant all privileges on sequences to service_role;
alter default privileges in schema public
  grant all privileges on routines to service_role;

-- Verify (expect one row per table for `authenticated`, 4 privilege types):
--   select table_name, grantee, privilege_type
--     from information_schema.role_table_grants
--    where table_schema = 'public' and grantee = 'authenticated'
--    order by table_name, privilege_type;
