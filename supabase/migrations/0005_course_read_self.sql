-- Fix: creating a course failed with
--   new row violates row-level security policy for table "courses"
-- even though the INSERT policy itself passed.
--
-- The client inserts with `.select('id')`, i.e. INSERT ... RETURNING, and
-- Postgres applies the SELECT policy to the returned row on top of the INSERT
-- WITH CHECK. The SELECT policy was `is_course_member(id)`, which re-queries
-- `courses` for that same id. The function is STABLE, so it runs under the
-- snapshot taken when the INSERT began — a snapshot that does not contain the
-- row being inserted. The lookup found nothing, the SELECT policy said no, and
-- the statement was reported as an RLS violation.
--
-- Fix: test the row's own `instructor_id` column first. It reads straight off
-- the new row, so no snapshot-dependent lookup is involved. is_course_member()
-- stays as the fallback that covers students and TAs, and being SECURITY
-- DEFINER it still keeps the enrollments lookup out of RLS's way.

drop policy if exists courses_read on public.courses;

create policy courses_read on public.courses for select to authenticated
  using (instructor_id = auth.uid() or is_course_member(id));
