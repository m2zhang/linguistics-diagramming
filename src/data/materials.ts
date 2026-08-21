import { supabase } from '../lib/supabase';

export interface Material {
  id: string;
  lectureId: string | null;
  assignmentId: string | null;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

interface MaterialRow {
  id: string;
  lecture_id: string | null;
  assignment_id: string | null;
  original_name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

const BUCKET = 'materials';
const COLS =
  'id, lecture_id, assignment_id, original_name, storage_path, mime_type, size_bytes, created_at';

function toMaterial(row: MaterialRow): Material {
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

export async function listLectureMaterials(lectureId: string): Promise<Material[]> {
  const { data, error } = await supabase
    .from('materials')
    .select(COLS)
    .eq('lecture_id', lectureId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data as MaterialRow[]).map(toMaterial);
}

/** Two steps now: the bytes go to Storage, then a metadata row goes to the
 *  table. The object path starts with the course id because the Storage RLS
 *  policies key membership off that first path segment. */
export async function uploadMaterial(lectureId: string, file: File): Promise<Material> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) throw new Error('not authenticated');

  const { data: lecture, error: lectureError } = await supabase
    .from('lectures')
    .select('course_id')
    .eq('id', lectureId)
    .single();
  if (lectureError) throw new Error(lectureError.message);

  const safeName = file.name.replace(/[^\w.\-]+/g, '_');
  const storagePath = `${lecture.course_id}/${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { contentType: file.type || 'application/octet-stream' });
  if (uploadError) throw new Error(uploadError.message);

  const { data, error } = await supabase
    .from('materials')
    .insert({
      lecture_id: lectureId,
      uploaded_by: userId,
      original_name: file.name,
      storage_path: storagePath,
      mime_type: file.type || 'application/octet-stream',
      size_bytes: file.size,
    })
    .select(COLS)
    .single();
  if (error) {
    // Don't leave an orphaned object behind if the metadata insert is rejected.
    await supabase.storage.from(BUCKET).remove([storagePath]);
    throw new Error(error.message);
  }
  return toMaterial(data as MaterialRow);
}

export async function deleteMaterial(materialId: string): Promise<void> {
  const { data: row, error: readError } = await supabase
    .from('materials')
    .select('storage_path')
    .eq('id', materialId)
    .single();
  if (readError) throw new Error(readError.message);

  const { error } = await supabase.from('materials').delete().eq('id', materialId);
  if (error) throw new Error(error.message);

  await supabase.storage.from(BUCKET).remove([row.storage_path as string]);
}

/** Async now — the bucket is private, so this mints a short-lived signed URL
 *  instead of pointing at an authenticated Express route. */
export async function materialDownloadUrl(materialId: string): Promise<string> {
  const { data: row, error: readError } = await supabase
    .from('materials')
    .select('storage_path')
    .eq('id', materialId)
    .single();
  if (readError) throw new Error(readError.message);

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(row.storage_path as string, 60);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
