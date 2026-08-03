import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { pool } from '../db/pool';
import { requireAuth } from '../middleware/requireAuth';
import { canReadLecture, canReadMaterial, ownsLecture, ownsMaterial } from '../middleware/ownership';
import { upload, UPLOAD_DIR } from '../lib/upload';

export const materialsRouter = Router();
materialsRouter.use(requireAuth);

materialsRouter.post('/materials', upload.single('file'), async (req, res) => {
  const { lectureId } = req.body as { lectureId?: string };
  const file = req.file;

  if (!lectureId || !file) {
    res.status(400).json({ error: 'lectureId and a file are required' });
    return;
  }
  if (!(await ownsLecture(req.session.userId!, lectureId))) {
    // Clean up the already-written temp file — the ownership check happens
    // after multer has saved it to disk, since multer needs to parse the
    // multipart body (including lectureId) before we know what to check.
    fs.unlink(file.path, () => {});
    res.status(403).json({ error: 'not your lecture' });
    return;
  }

  const { rows } = await pool.query(
    `INSERT INTO materials (lecture_id, uploaded_by, original_name, stored_name, mime_type, size_bytes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, lecture_id, assignment_id, original_name, mime_type, size_bytes, created_at`,
    [lectureId, req.session.userId, file.originalname, file.filename, file.mimetype, file.size],
  );
  res.status(201).json(toMaterialJson(rows[0]));
});

materialsRouter.get('/lectures/:lectureId/materials', async (req, res) => {
  const { lectureId } = req.params;
  if (!(await canReadLecture(req.session.userId!, lectureId))) {
    res.status(403).json({ error: 'not a member of this course' });
    return;
  }
  const { rows } = await pool.query(
    `SELECT id, lecture_id, assignment_id, original_name, mime_type, size_bytes, created_at
     FROM materials WHERE lecture_id = $1 ORDER BY created_at ASC`,
    [lectureId],
  );
  res.json(rows.map(toMaterialJson));
});

materialsRouter.get('/materials/:id/download', async (req, res) => {
  const materialId = req.params.id;
  if (!(await canReadMaterial(req.session.userId!, materialId))) {
    res.status(403).json({ error: 'not a member of this course' });
    return;
  }

  const { rows } = await pool.query(
    'SELECT original_name, stored_name, mime_type FROM materials WHERE id = $1',
    [materialId],
  );
  const material = rows[0];
  if (!material) {
    res.status(404).json({ error: 'material not found' });
    return;
  }

  const filePath = path.join(UPLOAD_DIR, material.stored_name);
  res.setHeader('Content-Type', material.mime_type);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(material.original_name)}"`);
  res.sendFile(filePath, (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: 'file missing on disk' });
  });
});

materialsRouter.delete('/materials/:id', async (req, res) => {
  const materialId = req.params.id;
  if (!(await ownsMaterial(req.session.userId!, materialId))) {
    res.status(403).json({ error: 'not your material' });
    return;
  }
  const { rows } = await pool.query('SELECT stored_name FROM materials WHERE id = $1', [materialId]);
  await pool.query('DELETE FROM materials WHERE id = $1', [materialId]);
  if (rows[0]) {
    fs.unlink(path.join(UPLOAD_DIR, rows[0].stored_name), () => {});
  }
  res.sendStatus(204);
});

function toMaterialJson(row: {
  id: string;
  lecture_id: string | null;
  assignment_id: string | null;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: Date;
}) {
  return {
    id: row.id,
    lectureId: row.lecture_id,
    assignmentId: row.assignment_id,
    originalName: row.original_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
  };
}
