import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';
import { canReadCourse, ownsCourse } from '../middleware/ownership';
import { generateUniqueJoinCode } from '../lib/joinCode';

export const coursesRouter = Router();

coursesRouter.use(requireAuth);

// Course color is a per-user preference (see course_preferences), not a
// property of the course itself — an instructor and every enrolled student
// can each pick their own color for the same course. Stored as a short key,
// not a hex value, so the frontend controls the actual palette/theming.
const COLOR_KEYS = ['red', 'orange', 'amber', 'green', 'teal', 'blue', 'indigo', 'purple', 'pink'];

function randomColor(): string {
  return COLOR_KEYS[Math.floor(Math.random() * COLOR_KEYS.length)];
}

/** Makes sure every course `userId` can currently see (owns or is enrolled
 *  in) has a course_preferences row, assigning a random color the first
 *  time. Self-healing — covers courses created/joined before this feature
 *  existed, and any future path that adds visibility without going through
 *  create/join. Called before every read so the frontend never has to
 *  handle a "no preference yet" case.
 *
 *  The color pick happens in SQL (random() evaluated per row of the SELECT)
 *  rather than passing one JS-generated value as a query parameter — a
 *  parameter is a single scalar, so every row inserted by one statement
 *  would otherwise get the exact same color when more than one course needs
 *  a preference row in the same sweep. */
async function ensurePreferences(userId: string): Promise<void> {
  await pool.query(
    `INSERT INTO course_preferences (user_id, course_id, color)
     SELECT $1, c.id,
            (ARRAY['red','orange','amber','green','teal','blue','indigo','purple','pink'])
              [1 + floor(random() * 9)::int]
     FROM courses c
     WHERE c.instructor_id = $1
        OR EXISTS (SELECT 1 FROM enrollments e WHERE e.course_id = c.id AND e.student_id = $1)
     ON CONFLICT (user_id, course_id) DO NOTHING`,
    [userId],
  );
}

/** Same idea as ensurePreferences, but for exactly one course right after
 *  creating or joining it, so the response can include a color immediately
 *  instead of waiting for the next list refresh. */
async function ensurePreferenceFor(userId: string, courseId: string): Promise<void> {
  await pool.query(
    `INSERT INTO course_preferences (user_id, course_id, color)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, course_id) DO NOTHING`,
    [userId, courseId, randomColor()],
  );
}

const COURSE_SELECT = `
  SELECT c.id, c.instructor_id, c.title, c.description, c.join_code, c.created_at,
         u.display_name AS instructor_name,
         u.email AS instructor_email,
         (SELECT count(*)::int FROM enrollments e WHERE e.course_id = c.id) AS student_count,
         (SELECT role FROM enrollments e WHERE e.course_id = c.id AND e.student_id = $1) AS my_role,
         cp.color, cp.favorite, cp.archived
  FROM courses c
  JOIN users u ON u.id = c.instructor_id
  LEFT JOIN course_preferences cp ON cp.course_id = c.id AND cp.user_id = $1
`;

const createCourseSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
});

coursesRouter.post('/', requireRole('instructor'), async (req, res) => {
  const parsed = createCourseSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'invalid request' });
    return;
  }
  const { title, description } = parsed.data;
  const userId = req.session.userId!;

  const joinCode = await generateUniqueJoinCode();
  const { rows } = await pool.query(
    `INSERT INTO courses (instructor_id, title, description, join_code)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [userId, title, description ?? null, joinCode],
  );
  await ensurePreferenceFor(userId, rows[0].id);

  const { rows: full } = await pool.query(`${COURSE_SELECT} WHERE c.id = $2`, [userId, rows[0].id]);
  res.status(201).json(toCourseJson(full[0]));
});

// Every course the caller teaches (instructor) or is enrolled in (student).
coursesRouter.get('/', async (req, res) => {
  const userId = req.session.userId!;
  await ensurePreferences(userId);
  const { rows } = await pool.query(
    `${COURSE_SELECT}
     WHERE c.instructor_id = $1
        OR EXISTS (SELECT 1 FROM enrollments e WHERE e.course_id = c.id AND e.student_id = $1)
     ORDER BY c.created_at DESC`,
    [userId],
  );
  res.json(rows.map(toCourseJson));
});

coursesRouter.get('/:id', async (req, res) => {
  const userId = req.session.userId!;
  const courseId = req.params.id;

  if (!(await canReadCourse(userId, courseId))) {
    res.status(403).json({ error: 'not a member of this course' });
    return;
  }
  await ensurePreferenceFor(userId, courseId);

  const { rows } = await pool.query(`${COURSE_SELECT} WHERE c.id = $2`, [userId, courseId]);
  const course = rows[0];
  if (!course) {
    res.status(404).json({ error: 'course not found' });
    return;
  }
  res.json(toCourseJson(course));
});

const patchCourseSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
});

coursesRouter.patch('/:id', async (req, res) => {
  const userId = req.session.userId!;
  const courseId = req.params.id;

  if (!(await ownsCourse(userId, courseId))) {
    res.status(403).json({ error: 'not your course' });
    return;
  }

  const parsed = patchCourseSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'invalid request' });
    return;
  }
  const { title, description } = parsed.data;

  await pool.query(
    `UPDATE courses
     SET title = COALESCE($2, title),
         description = CASE WHEN $3::boolean THEN $4 ELSE description END
     WHERE id = $1`,
    [courseId, title ?? null, description !== undefined, description ?? null],
  );
  const { rows } = await pool.query(`${COURSE_SELECT} WHERE c.id = $2`, [userId, courseId]);
  res.json(toCourseJson(rows[0]));
});

const preferencesSchema = z.object({
  color: z.enum(COLOR_KEYS as [string, ...string[]]).optional(),
  favorite: z.boolean().optional(),
  archived: z.boolean().optional(),
});

// Personal color/favorite/archived for a course — any member (instructor or
// enrolled student) can set their own, independent of everyone else's.
coursesRouter.put('/:id/preferences', async (req, res) => {
  const userId = req.session.userId!;
  const courseId = req.params.id;

  if (!(await canReadCourse(userId, courseId))) {
    res.status(403).json({ error: 'not a member of this course' });
    return;
  }
  const parsed = preferencesSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'invalid request' });
    return;
  }
  const { color, favorite, archived } = parsed.data;

  await pool.query(
    `INSERT INTO course_preferences (user_id, course_id, color, favorite, archived)
     VALUES ($1, $2, COALESCE($3, $5), COALESCE($4, false), COALESCE($6, false))
     ON CONFLICT (user_id, course_id) DO UPDATE SET
       color = COALESCE($3, course_preferences.color),
       favorite = COALESCE($4, course_preferences.favorite),
       archived = COALESCE($6, course_preferences.archived)`,
    [userId, courseId, color ?? null, favorite ?? null, randomColor(), archived ?? null],
  );

  const { rows } = await pool.query(`${COURSE_SELECT} WHERE c.id = $2`, [userId, courseId]);
  res.json(toCourseJson(rows[0]));
});

// Regenerate a course's join code (e.g. after accidentally sharing it publicly).
coursesRouter.post('/:id/join-code/regenerate', async (req, res) => {
  const userId = req.session.userId!;
  const courseId = req.params.id;

  if (!(await ownsCourse(userId, courseId))) {
    res.status(403).json({ error: 'not your course' });
    return;
  }

  const joinCode = await generateUniqueJoinCode();
  await pool.query('UPDATE courses SET join_code = $2 WHERE id = $1', [courseId, joinCode]);
  res.json({ joinCode });
});

const joinSchema = z.object({
  code: z.string().trim().min(1).max(20),
});

// Students never pass a course id here — only the code they were given, so
// they can never enroll in a course whose code they don't actually have.
coursesRouter.post('/join', requireRole('student'), async (req, res) => {
  const parsed = joinSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'a join code is required' });
    return;
  }
  const code = parsed.data.code.trim().toUpperCase();
  const userId = req.session.userId!;

  const { rows: courseRows } = await pool.query(
    'SELECT id FROM courses WHERE join_code = $1 AND archived = false',
    [code],
  );
  const course = courseRows[0];
  if (!course) {
    res.status(404).json({ error: 'invalid join code' });
    return;
  }

  await pool.query(
    `INSERT INTO enrollments (course_id, student_id) VALUES ($1, $2)
     ON CONFLICT (course_id, student_id) DO NOTHING`,
    [course.id, userId],
  );
  await ensurePreferenceFor(userId, course.id);
  res.status(201).json({ courseId: course.id });
});

coursesRouter.get('/:id/roster', async (req, res) => {
  const userId = req.session.userId!;
  const courseId = req.params.id;

  if (!(await ownsCourse(userId, courseId))) {
    res.status(403).json({ error: 'not your course' });
    return;
  }

  const { rows } = await pool.query(
    `SELECT u.id, u.display_name, u.email, e.created_at AS joined_at, e.role
     FROM enrollments e
     JOIN users u ON u.id = e.student_id
     WHERE e.course_id = $1
     ORDER BY e.created_at ASC`,
    [courseId],
  );
  res.json(rows.map((r) => ({
    id: r.id,
    displayName: r.display_name,
    email: r.email,
    role: r.role,
    joinedAt: r.joined_at,
  })));
});

const roleSchema = z.object({
  role: z.enum(['student', 'ta']),
});

coursesRouter.patch('/:id/roster/:studentId/role', async (req, res) => {
  const userId = req.session.userId!;
  const courseId = req.params.id;
  const studentId = req.params.studentId;

  if (!(await ownsCourse(userId, courseId))) {
    res.status(403).json({ error: 'not your course' });
    return;
  }

  const parsed = roleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'invalid request' });
    return;
  }

  await pool.query('UPDATE enrollments SET role = $1 WHERE course_id = $2 AND student_id = $3', [
    parsed.data.role,
    courseId,
    studentId,
  ]);
  res.sendStatus(204);
});

coursesRouter.delete('/:id/roster/:studentId', async (req, res) => {
  const userId = req.session.userId!;
  const courseId = req.params.id;

  if (!(await ownsCourse(userId, courseId))) {
    res.status(403).json({ error: 'not your course' });
    return;
  }

  await pool.query('DELETE FROM enrollments WHERE course_id = $1 AND student_id = $2', [
    courseId,
    req.params.studentId,
  ]);
  res.sendStatus(204);
});

function toCourseJson(row: {
  id: string;
  instructor_id: string;
  title: string;
  description: string | null;
  join_code: string;
  created_at: Date;
  instructor_name?: string;
  instructor_email?: string;
  student_count?: number;
  my_role?: 'student' | 'ta' | null;
  color: string | null;
  favorite: boolean | null;
  archived: boolean | null;
}) {
  return {
    id: row.id,
    instructorId: row.instructor_id,
    instructorName: row.instructor_name,
    instructorEmail: row.instructor_email,
    title: row.title,
    description: row.description,
    joinCode: row.join_code,
    createdAt: row.created_at,
    studentCount: row.student_count,
    myRole: row.my_role ?? undefined,
    color: row.color ?? 'blue',
    favorite: row.favorite ?? false,
    archived: row.archived ?? false,
  };
}
