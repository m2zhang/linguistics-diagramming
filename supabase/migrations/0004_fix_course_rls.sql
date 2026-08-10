-- Fix course creation RLS policy to allow any authenticated user to create a course where they are the instructor
DROP POLICY IF EXISTS courses_insert ON public.courses;

CREATE POLICY courses_insert ON public.courses FOR INSERT TO authenticated
  WITH CHECK (instructor_id = auth.uid());
