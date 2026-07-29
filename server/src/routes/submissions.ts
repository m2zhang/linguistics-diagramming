import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';
import {
  isEnrolled,
  courseIdForAssignment,
  ownsAssignment,
  ownsSubmission,
} from '../middleware/ownership';

export const submissionsRouter = Router();
submissionsRouter.use(requireAuth);

const projectStateSchema = z.object({
  tree: z.unknown(),
  annotations: z.unknown().optional(),
  version: z.string(),
});

/** Confirms the caller is a student actually enrolled in the assignment's
 *  course — used by every draft/submission route below, since drafts and
 *  submissions are always scoped to "myself, and only if I'm enrolled". */
async function assertEnrolledInAssignment(userId: string, assignmentId: string): Promise<boolean> {
  const courseId = await courseIdForAssignment(assignmentId);
  return courseId !== null && (await isEnrolled(userId, courseId));
}

// --- Drafts (autosave working copy; upserted, one per student per assignment) ---

submissionsRouter.put('/assignments/:id/draft', requireRole('student'), async (req, res) => {
  const assignmentId = req.params.id;
  if (!(await assertEnrolledInAssignment(req.session.userId!, assignmentId))) {
    res.status(403).json({ error: 'not enrolled in this course' });
    return;
  }
  const parsed = projectStateSchema.safeParse(req.body.content);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid draft content' });
    return;
  }

  await pool.query(
    `INSERT INTO drafts (assignment_id, student_id, content, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (assignment_id, student_id)
     DO UPDATE SET content = EXCLUDED.content, updated_at = now()`,
    [assignmentId, req.session.userId, JSON.stringify(parsed.data)],
  );
  res.status(204).send();
});

submissionsRouter.get('/assignments/:id/draft', requireRole('student'), async (req, res) => {
  const assignmentId = req.params.id;
  if (!(await assertEnrolledInAssignment(req.session.userId!, assignmentId))) {
    res.status(403).json({ error: 'not enrolled in this course' });
    return;
  }
  const { rows } = await pool.query(
    `SELECT content, updated_at FROM drafts WHERE assignment_id = $1 AND student_id = $2`,
    [assignmentId, req.session.userId],
  );
  if (!rows[0]) {
    res.status(404).json({ error: 'no draft yet' });
    return;
  }
  res.json({ content: rows[0].content, updatedAt: rows[0].updated_at });
});

// The calling student's own latest submission for this assignment, or null.
submissionsRouter.get('/assignments/:id/my-submission', requireRole('student'), async (req, res) => {
  const assignmentId = req.params.id;
  if (!(await assertEnrolledInAssignment(req.session.userId!, assignmentId))) {
    res.status(403).json({ error: 'not enrolled in this course' });
    return;
  }
  const { rows } = await pool.query(
    `SELECT id, assignment_id, student_id, content, submitted_at, grade, feedback, graded_at, graded_by
     FROM submissions WHERE assignment_id = $1 AND student_id = $2
     ORDER BY submitted_at DESC LIMIT 1`,
    [assignmentId, req.session.userId],
  );
  res.json(rows[0] ? toSubmissionJson(rows[0]) : null);
});

// --- Submissions (insert-only from the student side; resubmit = new row) ---

submissionsRouter.post('/assignments/:id/submissions', requireRole('student'), async (req, res) => {
  const assignmentId = req.params.id;
  if (!(await assertEnrolledInAssignment(req.session.userId!, assignmentId))) {
    res.status(403).json({ error: 'not enrolled in this course' });
    return;
  }
  const parsed = projectStateSchema.safeParse(req.body.content);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid submission content' });
    return;
  }

  const { rows } = await pool.query(
    `INSERT INTO submissions (assignment_id, student_id, content)
     VALUES ($1, $2, $3)
     RETURNING id, assignment_id, student_id, content, submitted_at, grade, feedback, graded_at, graded_by`,
    // student_id always comes from the session, never the request body —
    // a student can never submit on another student's behalf.
    [assignmentId, req.session.userId, JSON.stringify(parsed.data)],
  );
  res.status(201).json(toSubmissionJson(rows[0]));
});

// Instructor: every submission for an assignment, latest first.
submissionsRouter.get('/assignments/:id/submissions', requireRole('instructor'), async (req, res) => {
  const assignmentId = req.params.id;
  if (!(await ownsAssignment(req.session.userId!, assignmentId))) {
    res.status(403).json({ error: 'not your assignment' });
    return;
  }
  const { rows } = await pool.query(
    `SELECT s.id, s.assignment_id, s.student_id, s.content, s.submitted_at, s.grade, s.feedback,
            s.graded_at, s.graded_by, u.display_name AS student_name, u.email AS student_email
     FROM submissions s
     JOIN users u ON u.id = s.student_id
     WHERE s.assignment_id = $1
     ORDER BY s.submitted_at DESC`,
    [assignmentId],
  );
  res.json(
    rows.map((r) => ({
      ...toSubmissionJson(r),
      studentName: r.student_name,
      studentEmail: r.student_email,
    })),
  );
});

// Single submission — the owning student or the course's instructor.
submissionsRouter.get('/submissions/:id', async (req, res) => {
  const submissionId = req.params.id;
  const userId = req.session.userId!;

  const { rows } = await pool.query(
    `SELECT s.id, s.assignment_id, s.student_id, s.content, s.submitted_at, s.grade, s.feedback,
            s.graded_at, s.graded_by, u.display_name AS student_name, u.email AS student_email
     FROM submissions s
     JOIN users u ON u.id = s.student_id
     WHERE s.id = $1`,
    [submissionId],
  );
  const submission = rows[0];
  if (!submission) {
    res.status(404).json({ error: 'submission not found' });
    return;
  }
  const allowed = submission.student_id === userId || (await ownsSubmission(userId, submissionId));
  if (!allowed) {
    res.status(403).json({ error: 'not your submission' });
    return;
  }
  res.json({ ...toSubmissionJson(submission), studentName: submission.student_name, studentEmail: submission.student_email });
});

const gradeSchema = z.object({
  grade: z.number().min(0).max(999.99).nullable().optional(),
  feedback: z.string().trim().max(20000).nullable().optional(),
});

submissionsRouter.patch('/submissions/:id', requireRole('instructor'), async (req, res) => {
  const submissionId = req.params.id;
  if (!(await ownsSubmission(req.session.userId!, submissionId))) {
    res.status(403).json({ error: 'not your submission to grade' });
    return;
  }
  const parsed = gradeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'invalid request' });
    return;
  }
  const { grade, feedback } = parsed.data;

  const { rows } = await pool.query(
    `UPDATE submissions
     SET grade = $2, feedback = $3, graded_at = now(), graded_by = $4
     WHERE id = $1
     RETURNING id, assignment_id, student_id, content, submitted_at, grade, feedback, graded_at, graded_by`,
    [submissionId, grade ?? null, feedback ?? null, req.session.userId],
  );
  res.json(toSubmissionJson(rows[0]));
});

function toSubmissionJson(row: {
  id: string;
  assignment_id: string;
  student_id: string;
  content: unknown;
  submitted_at: Date;
  grade: string | null;
  feedback: string | null;
  graded_at: Date | null;
  graded_by: string | null;
}) {
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    studentId: row.student_id,
    content: row.content,
    submittedAt: row.submitted_at,
    grade: row.grade === null ? null : Number(row.grade),
    feedback: row.feedback,
    gradedAt: row.graded_at,
    gradedBy: row.graded_by,
  };
}
