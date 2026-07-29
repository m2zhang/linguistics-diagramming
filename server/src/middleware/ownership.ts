import { pool } from '../db/pool';

/** True if `userId` is the instructor who owns `courseId`. There is no RLS
 *  in this app (plain Postgres, no Supabase) — every mutating route must
 *  call one of these helpers explicitly before touching course-scoped data. */
export async function ownsCourse(userId: string, courseId: string): Promise<boolean> {
  const { rows } = await pool.query(
    'SELECT 1 FROM courses WHERE id = $1 AND instructor_id = $2',
    [courseId, userId],
  );
  return rows.length > 0;
}

/** True if `userId` is a student enrolled in `courseId`. */
export async function isEnrolled(userId: string, courseId: string): Promise<boolean> {
  const { rows } = await pool.query(
    'SELECT 1 FROM enrollments WHERE course_id = $1 AND student_id = $2',
    [courseId, userId],
  );
  return rows.length > 0;
}

/** True if `userId` can read `courseId` — either owns it (instructor) or is
 *  enrolled in it (student). The common check for GET routes. */
export async function canReadCourse(userId: string, courseId: string): Promise<boolean> {
  return (await ownsCourse(userId, courseId)) || (await isEnrolled(userId, courseId));
}

/** Looks up the course_id a lecture belongs to, or null if it doesn't exist. */
export async function courseIdForLecture(lectureId: string): Promise<string | null> {
  const { rows } = await pool.query('SELECT course_id FROM lectures WHERE id = $1', [lectureId]);
  return rows[0]?.course_id ?? null;
}

export async function ownsLecture(userId: string, lectureId: string): Promise<boolean> {
  const courseId = await courseIdForLecture(lectureId);
  return courseId !== null && (await ownsCourse(userId, courseId));
}

export async function canReadLecture(userId: string, lectureId: string): Promise<boolean> {
  const courseId = await courseIdForLecture(lectureId);
  return courseId !== null && (await canReadCourse(userId, courseId));
}

/** Looks up the course_id that owns a material, whichever parent (lecture or
 *  assignment) it's attached to. Assignment materials arrive in a later phase
 *  — the assignment_id branch is here now so this helper doesn't need to
 *  change again once assignments exist. */
export async function courseIdForMaterial(materialId: string): Promise<string | null> {
  const { rows } = await pool.query(
    `SELECT COALESCE(l.course_id, a.course_id) AS course_id
     FROM materials m
     LEFT JOIN lectures l ON l.id = m.lecture_id
     LEFT JOIN assignments a ON a.id = m.assignment_id
     WHERE m.id = $1`,
    [materialId],
  );
  return rows[0]?.course_id ?? null;
}

export async function ownsMaterial(userId: string, materialId: string): Promise<boolean> {
  const courseId = await courseIdForMaterial(materialId);
  return courseId !== null && (await ownsCourse(userId, courseId));
}

export async function canReadMaterial(userId: string, materialId: string): Promise<boolean> {
  const courseId = await courseIdForMaterial(materialId);
  return courseId !== null && (await canReadCourse(userId, courseId));
}

/** Looks up the course_id an assignment belongs to, or null if it doesn't exist. */
export async function courseIdForAssignment(assignmentId: string): Promise<string | null> {
  const { rows } = await pool.query('SELECT course_id FROM assignments WHERE id = $1', [assignmentId]);
  return rows[0]?.course_id ?? null;
}

export async function ownsAssignment(userId: string, assignmentId: string): Promise<boolean> {
  const courseId = await courseIdForAssignment(assignmentId);
  return courseId !== null && (await ownsCourse(userId, courseId));
}

export async function canReadAssignment(userId: string, assignmentId: string): Promise<boolean> {
  const courseId = await courseIdForAssignment(assignmentId);
  return courseId !== null && (await canReadCourse(userId, courseId));
}

/** Looks up the course_id a submission belongs to, via its assignment. */
export async function courseIdForSubmission(submissionId: string): Promise<string | null> {
  const { rows } = await pool.query(
    `SELECT a.course_id FROM submissions s JOIN assignments a ON a.id = s.assignment_id WHERE s.id = $1`,
    [submissionId],
  );
  return rows[0]?.course_id ?? null;
}

export async function ownsSubmission(userId: string, submissionId: string): Promise<boolean> {
  const courseId = await courseIdForSubmission(submissionId);
  return courseId !== null && (await ownsCourse(userId, courseId));
}
