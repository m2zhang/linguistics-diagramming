import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool';
import { requireAuth } from '../middleware/requireAuth';
import { canReadCourse, canReadAssignment, ownsAssignment, ownsCourse } from '../middleware/ownership';

export const assignmentsRouter = Router();
assignmentsRouter.use(requireAuth);

const projectStateSchema = z.object({
  tree: z.unknown(),
  annotations: z.unknown().optional(),
  version: z.string(),
});

const createAssignmentSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    instructions: z.string().trim().max(20000).optional(),
    mode: z.enum(['blank', 'template']),
    templateContent: projectStateSchema.optional(),
    dueAt: z.string().datetime().optional().nullable(),
    lectureId: z.string().uuid().optional().nullable(),
  })
  .refine((v) => v.mode !== 'template' || v.templateContent !== undefined, {
    message: 'templateContent is required when mode is "template"',
    path: ['templateContent'],
  });

assignmentsRouter.post('/courses/:courseId/assignments', async (req, res) => {
  const { courseId } = req.params;
  if (!(await ownsCourse(req.session.userId!, courseId))) {
    res.status(403).json({ error: 'not your course' });
    return;
  }
  const parsed = createAssignmentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'invalid request' });
    return;
  }
  const { title, instructions, mode, templateContent, dueAt, lectureId } = parsed.data;

  const { rows } = await pool.query(
    `INSERT INTO assignments (course_id, lecture_id, title, instructions, mode, template_content, due_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, course_id, lecture_id, title, instructions, mode, template_content, due_at, created_at`,
    [
      courseId,
      lectureId ?? null,
      title,
      instructions ?? null,
      mode,
      mode === 'template' ? JSON.stringify(templateContent) : null,
      dueAt ?? null,
    ],
  );
  res.status(201).json(toAssignmentJson(rows[0]));
});

assignmentsRouter.get('/courses/:courseId/assignments', async (req, res) => {
  const { courseId } = req.params;
  if (!(await canReadCourse(req.session.userId!, courseId))) {
    res.status(403).json({ error: 'not a member of this course' });
    return;
  }
  const { rows } = await pool.query(
    `SELECT id, course_id, lecture_id, title, instructions, mode, template_content, due_at, created_at
     FROM assignments WHERE course_id = $1 ORDER BY due_at ASC NULLS LAST, created_at ASC`,
    [courseId],
  );
  res.json(rows.map(toAssignmentJson));
});

assignmentsRouter.get('/assignments/:id', async (req, res) => {
  const assignmentId = req.params.id;
  if (!(await canReadAssignment(req.session.userId!, assignmentId))) {
    res.status(403).json({ error: 'not a member of this course' });
    return;
  }
  const { rows } = await pool.query(
    `SELECT id, course_id, lecture_id, title, instructions, mode, template_content, due_at, created_at
     FROM assignments WHERE id = $1`,
    [assignmentId],
  );
  const assignment = rows[0];
  if (!assignment) {
    res.status(404).json({ error: 'assignment not found' });
    return;
  }
  res.json(toAssignmentJson(assignment));
});

const patchAssignmentSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  instructions: z.string().trim().max(20000).nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
});

assignmentsRouter.patch('/assignments/:id', async (req, res) => {
  const assignmentId = req.params.id;
  if (!(await ownsAssignment(req.session.userId!, assignmentId))) {
    res.status(403).json({ error: 'not your assignment' });
    return;
  }
  const parsed = patchAssignmentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'invalid request' });
    return;
  }
  const { title, instructions, dueAt } = parsed.data;

  const { rows } = await pool.query(
    `UPDATE assignments SET
       title = COALESCE($2, title),
       instructions = CASE WHEN $3::boolean THEN $4 ELSE instructions END,
       due_at = CASE WHEN $5::boolean THEN $6 ELSE due_at END
     WHERE id = $1
     RETURNING id, course_id, lecture_id, title, instructions, mode, template_content, due_at, created_at`,
    [
      assignmentId,
      title ?? null,
      instructions !== undefined,
      instructions ?? null,
      dueAt !== undefined,
      dueAt ?? null,
    ],
  );
  res.json(toAssignmentJson(rows[0]));
});

assignmentsRouter.delete('/assignments/:id', async (req, res) => {
  const assignmentId = req.params.id;
  if (!(await ownsAssignment(req.session.userId!, assignmentId))) {
    res.status(403).json({ error: 'not your assignment' });
    return;
  }
  await pool.query('DELETE FROM assignments WHERE id = $1', [assignmentId]);
  res.sendStatus(204);
});

function toAssignmentJson(row: {
  id: string;
  course_id: string;
  lecture_id: string | null;
  title: string;
  instructions: string | null;
  mode: 'blank' | 'template';
  template_content: unknown;
  due_at: Date | null;
  created_at: Date;
}) {
  return {
    id: row.id,
    courseId: row.course_id,
    lectureId: row.lecture_id,
    title: row.title,
    instructions: row.instructions,
    mode: row.mode,
    templateContent: row.template_content,
    dueAt: row.due_at,
    createdAt: row.created_at,
  };
}
