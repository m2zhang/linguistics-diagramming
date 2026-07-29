import multer from 'multer';
import { randomUUID } from 'crypto';
import path from 'path';

export const UPLOAD_DIR = path.join(__dirname, '../../uploads');

// Filenames on disk are always a fresh UUID + the original extension — never
// the client-supplied name, which could contain path-traversal characters.
// The human-readable name is stored separately (materials.original_name) and
// only ever used for display / the Content-Disposition header on download.
export const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => cb(null, `${randomUUID()}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
});
