import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool';
import { requireAuth } from '../middleware/requireAuth';
import { canReadCourse, canReadLecture, ownsCourse, ownsLecture } from '../middleware/ownership';

export const lecturesRouter = Router();
lecturesRouter.use(requireAuth);

const lectureSchema = z.object({
  title: z.string().trim().min(1).max(200),
  notes: z.string().trim().max(20000).optional(),
});

// Nested under /api/courses/:courseId/lectures
lecturesRouter.post('/courses/:courseId/lectures', async (req, res) => {
  const { courseId } = req.params;
  if (!(await ownsCourse(req.session.userId!, courseId))) {
    res.status(403).json({ error: 'not your course' });
    return;
  }
  const parsed = lectureSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'invalid request' });
    return;
  }

  const { rows } = await pool.query(
    `INSERT INTO lectures (course_id, title, notes, position)
     VALUES ($1, $2, $3, COALESCE((SELECT max(position) + 1 FROM lectures WHERE course_id = $1), 0))
     RETURNING id, course_id, title, notes, position, created_at`,
    [courseId, parsed.data.title, parsed.data.notes ?? null],
  );
  res.status(201).json(toLectureJson(rows[0]));
});

lecturesRouter.get('/courses/:courseId/lectures', async (req, res) => {
  const { courseId } = req.params;
  if (!(await canReadCourse(req.session.userId!, courseId))) {
    res.status(403).json({ error: 'not a member of this course' });
    return;
  }
  const { rows } = await pool.query(
    `SELECT id, course_id, title, notes, position, created_at FROM lectures
     WHERE course_id = $1 ORDER BY position ASC, created_at ASC`,
    [courseId],
  );
  res.json(rows.map(toLectureJson));
});

// Standalone /api/lectures/:id routes below.
lecturesRouter.get('/lectures/:id', async (req, res) => {
  const lectureId = req.params.id;
  if (!(await canReadLecture(req.session.userId!, lectureId))) {
    res.status(403).json({ error: 'not a member of this course' });
    return;
  }

  const { rows } = await pool.query(
    `SELECT id, course_id, title, notes, position, created_at FROM lectures WHERE id = $1`,
    [lectureId],
  );
  const lecture = rows[0];
  if (!lecture) {
    res.status(404).json({ error: 'lecture not found' });
    return;
  }

  const { rows: trees } = await pool.query(
    `SELECT id, lecture_id, title, content, position, created_at
     FROM lecture_trees WHERE lecture_id = $1 ORDER BY position ASC, created_at ASC`,
    [lectureId],
  );

  res.json({ ...toLectureJson(lecture), trees: trees.map(toTreeJson) });
});

lecturesRouter.patch('/lectures/:id', async (req, res) => {
  const lectureId = req.params.id;
  if (!(await ownsLecture(req.session.userId!, lectureId))) {
    res.status(403).json({ error: 'not your lecture' });
    return;
  }
  const parsed = lectureSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'invalid request' });
    return;
  }

  const { rows } = await pool.query(
    `UPDATE lectures SET title = COALESCE($2, title), notes = COALESCE($3, notes)
     WHERE id = $1
     RETURNING id, course_id, title, notes, position, created_at`,
    [lectureId, parsed.data.title ?? null, parsed.data.notes ?? null],
  );
  res.json(toLectureJson(rows[0]));
});

lecturesRouter.delete('/lectures/:id', async (req, res) => {
  const lectureId = req.params.id;
  if (!(await ownsLecture(req.session.userId!, lectureId))) {
    res.status(403).json({ error: 'not your lecture' });
    return;
  }
  await pool.query('DELETE FROM lectures WHERE id = $1', [lectureId]);
  res.sendStatus(204);
});

const treeSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.object({
    tree: z.unknown(),
    annotations: z.unknown().optional(),
    version: z.string(),
  }),
});

lecturesRouter.post('/lectures/:id/trees', async (req, res) => {
  const lectureId = req.params.id;
  if (!(await ownsLecture(req.session.userId!, lectureId))) {
    res.status(403).json({ error: 'not your lecture' });
    return;
  }
  const parsed = treeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'invalid request' });
    return;
  }

  const { rows } = await pool.query(
    `INSERT INTO lecture_trees (lecture_id, title, content, position)
     VALUES ($1, $2, $3, COALESCE((SELECT max(position) + 1 FROM lecture_trees WHERE lecture_id = $1), 0))
     RETURNING id, lecture_id, title, content, position, created_at`,
    [lectureId, parsed.data.title, JSON.stringify(parsed.data.content)],
  );
  res.status(201).json(toTreeJson(rows[0]));
});

lecturesRouter.delete('/lecture-trees/:id', async (req, res) => {
  const treeId = req.params.id;
  const { rows } = await pool.query(
    `SELECT lt.lecture_id FROM lecture_trees lt WHERE lt.id = $1`,
    [treeId],
  );
  const lectureId = rows[0]?.lecture_id;
  if (!lectureId || !(await ownsLecture(req.session.userId!, lectureId))) {
    res.status(403).json({ error: 'not your lecture' });
    return;
  }
  await pool.query('DELETE FROM lecture_trees WHERE id = $1', [treeId]);
  res.sendStatus(204);
});

function toLectureJson(row: {
  id: string;
  course_id: string;
  title: string;
  notes: string | null;
  position: number;
  created_at: Date;
}) {
  return {
    id: row.id,
    courseId: row.course_id,
    title: row.title,
    notes: row.notes,
    position: row.position,
    createdAt: row.created_at,
  };
}

function toTreeJson(row: {
  id: string;
  lecture_id: string;
  title: string;
  content: unknown;
  position: number;
  created_at: Date;
}) {
  return {
    id: row.id,
    lectureId: row.lecture_id,
    title: row.title,
    content: row.content,
    position: row.position,
    createdAt: row.created_at,
  };
}
