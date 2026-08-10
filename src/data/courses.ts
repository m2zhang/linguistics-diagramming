import type { CourseColorKey } from '../lib/courseColors';
import { supabase } from '../lib/supabase';

export interface Course {
  id: string;
  instructorId: string;
  instructorName?: string;
  instructorEmail?: string;
  title: string;
  description: string | null;
  /** Only readable by course staff — RLS on course_join_codes enforces this,
   *  so for a student the embedded row simply comes back empty. */
  joinCode?: string;
  createdAt: string;
  studentCount?: number;
  myRole?: 'student' | 'ta';
  /** Personal to the viewer — not a property of the course itself. */
  color: CourseColorKey;
  favorite: boolean;
  archived: boolean;
}

export interface RosterEntry {
  id: string;
  displayName: string;
  email: string;
  role: 'student' | 'ta';
  joinedAt: string;
}

const COURSE_SELECT = `
  id, instructor_id, title, description, created_at,
  instructor:profiles!courses_instructor_id_fkey ( display_name, email ),
  code:course_join_codes ( code ),
  prefs:course_preferences ( color, favorite, archived ),
  enrollments ( count )
`;

interface CourseRow {
  id: string;
  instructor_id: string;
  title: string;
  description: string | null;
  created_at: string;
  instructor: { display_name: string; email: string } | null;
  code: { code: string }[] | { code: string } | null;
  prefs: { color: string; favorite: boolean; archived: boolean }[];
  enrollments: { count: number }[];
}

function first<T>(v: T[] | T | null | undefined): T | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

function toCourse(row: CourseRow, myRole?: 'student' | 'ta'): Course {
  const prefs = first(row.prefs);
  return {
    id: row.id,
    instructorId: row.instructor_id,
    instructorName: row.instructor?.display_name,
    instructorEmail: row.instructor?.email,
    title: row.title,
    description: row.description,
    joinCode: first(row.code)?.code,
    createdAt: row.created_at,
    studentCount: first(row.enrollments)?.count,
    myRole,
    color: (prefs?.color ?? 'blue') as CourseColorKey,
    favorite: prefs?.favorite ?? false,
    archived: prefs?.archived ?? false,
  };
}

/** My enrolment role per course, used to fill Course.myRole. Kept as its own
 *  query because embedding it would need a self-filtered join that PostgREST
 *  can't express cleanly. */
async function myRoles(): Promise<Map<string, 'student' | 'ta'>> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) return new Map();

  const { data, error } = await supabase
    .from('enrollments')
    .select('course_id, role')
    .eq('student_id', userId);
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((r) => [r.course_id as string, r.role as 'student' | 'ta']));
}

export async function listCourses(): Promise<Course[]> {
  const [roles, { data, error }] = await Promise.all([
    myRoles(),
    supabase.from('courses').select(COURSE_SELECT).order('created_at', { ascending: false }),
  ]);
  if (error) throw new Error(error.message);
  return (data as unknown as CourseRow[]).map((row) => toCourse(row, roles.get(row.id)));
}

export async function getCourse(id: string): Promise<Course> {
  const [roles, { data, error }] = await Promise.all([
    myRoles(),
    supabase.from('courses').select(COURSE_SELECT).eq('id', id).single(),
  ]);
  if (error) throw new Error(error.message);
  return toCourse(data as unknown as CourseRow, roles.get(id));
}

export async function createCourse(input: { title: string; description?: string }): Promise<Course> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) throw new Error('not authenticated');

  // A trigger generates the join code and the instructor's colour preference.
  const { data, error } = await supabase
    .from('courses')
    .insert({ instructor_id: userId, title: input.title, description: input.description ?? null })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return getCourse(data.id as string);
}

export async function updateCourse(
  id: string,
  input: { title?: string; description?: string | null },
): Promise<Course> {
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description;

  const { error } = await supabase.from('courses').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
  return getCourse(id);
}

/** Personal preferences (color / favorite / archived-from-my-dashboard) —
 *  any member of the course can set their own, instructor or student. */
export async function updateCoursePreferences(
  id: string,
  input: { color?: CourseColorKey; favorite?: boolean; archived?: boolean },
): Promise<Course> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) throw new Error('not authenticated');

  const { error } = await supabase.from('course_preferences').upsert(
    {
      user_id: userId,
      course_id: id,
      ...(input.color !== undefined ? { color: input.color } : { color: 'blue' }),
      ...(input.favorite !== undefined ? { favorite: input.favorite } : {}),
      ...(input.archived !== undefined ? { archived: input.archived } : {}),
    },
    { onConflict: 'user_id,course_id' },
  );
  if (error) throw new Error(error.message);
  return getCourse(id);
}

export async function regenerateJoinCode(id: string): Promise<{ joinCode: string }> {
  const { data, error } = await supabase.rpc('regenerate_join_code', { p_course: id });
  if (error) throw new Error(error.message);
  return { joinCode: data as string };
}

export async function joinCourse(code: string): Promise<{ courseId: string }> {
  const { data, error } = await supabase.rpc('join_course', { p_code: code });
  if (error) throw new Error(error.message.includes('invalid join code') ? 'Invalid join code' : error.message);
  return { courseId: data as string };
}

export async function getRoster(courseId: string): Promise<RosterEntry[]> {
  const { data, error } = await supabase
    .from('enrollments')
    .select('role, created_at, student:profiles!enrollments_student_id_fkey ( id, display_name, email )')
    .eq('course_id', courseId);
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const student = first(row.student as unknown as { id: string; display_name: string; email: string }[]);
    return {
      id: student?.id ?? '',
      displayName: student?.display_name ?? '',
      email: student?.email ?? '',
      role: row.role as 'student' | 'ta',
      joinedAt: row.created_at as string,
    };
  });
}

export async function updateParticipantRole(courseId: string, studentId: string, role: 'student' | 'ta') {
  const { error } = await supabase
    .from('enrollments')
    .update({ role })
    .eq('course_id', courseId)
    .eq('student_id', studentId);
  if (error) throw new Error(error.message);
}

export async function removeStudent(courseId: string, studentId: string) {
  const { error } = await supabase
    .from('enrollments')
    .delete()
    .eq('course_id', courseId)
    .eq('student_id', studentId);
  if (error) throw new Error(error.message);
}
