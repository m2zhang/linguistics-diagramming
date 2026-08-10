-- Fix: creating a course still fails with
--   new row violates row-level security policy for table "courses"
-- even though 0004 and 0005 exist in the repo to fix exactly this.
--
-- Same situation as 0003 vs 0006: those files were never applied to the live
-- project, so the database still holds the original 0001 policies. This file
-- re-applies both, idempotently, so the live state matches the repo. It also
-- covers a second cause introduced by 0007: backfilled profiles default to
-- role 'student', and the 0001 insert policy required 'instructor'.
--
-- Run the whole file in the Supabase SQL Editor.

-- 1. INSERT (supersedes 0004) ------------------------------------------------
-- Any authenticated user may create a course they own. The profiles.role check
-- from 0001 is deliberately gone: role is a UI affordance, not an authz gate,
-- and it locked out anyone whose profile predates or was backfilled without it.
drop policy if exists courses_insert on public.courses;
create policy courses_insert on public.courses for insert to authenticated
  with check (instructor_id = auth.uid());

-- 2. SELECT (supersedes 0005) ------------------------------------------------
-- `.insert(...).select('id')` is INSERT ... RETURNING, and Postgres applies the
-- SELECT policy to the returned row on top of the INSERT WITH CHECK. Testing
-- instructor_id reads straight off the new row; is_course_member() is STABLE
-- and re-queries `courses` under a snapshot that predates the insert, so on its
-- own it never sees the row and the statement is reported as an RLS violation.
drop policy if exists courses_read on public.courses;
create policy courses_read on public.courses for select to authenticated
  using (instructor_id = auth.uid() or is_course_member(id));

-- Verify — expect courses_insert WITH CHECK on instructor_id only, and
-- courses_read USING with the instructor_id disjunct present:
--   select policyname, cmd, qual, with_check
--     from pg_policies
--    where schemaname = 'public' and tablename = 'courses'
--    order by policyname;
