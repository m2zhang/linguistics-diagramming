import type { ProjectState } from '../export/projectState';
import { supabase } from '../lib/supabase';

export interface Draft {
  content: ProjectState;
  updatedAt: string;
}

export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  content: ProjectState;
  submittedAt: string;
  grade: number | null;
  feedback: string | null;
  gradedAt: string | null;
  gradedBy: string | null;
}

export interface SubmissionWithStudent extends Submission {
  studentName: string;
  studentEmail: string;
}

interface SubmissionRow {
  id: string;
  assignment_id: string;
  student_id: string;
  content: ProjectState;
  submitted_at: string;
  grade: number | string | null;
  feedback: string | null;
  graded_at: string | null;
  graded_by: string | null;
  student?: { display_name: string; email: string }[] | { display_name: string; email: string } | null;
}

const COLS =
  'id, assignment_id, student_id, content, submitted_at, grade, feedback, graded_at, graded_by';
const COLS_WITH_STUDENT = `${COLS}, student:profiles!submissions_student_id_fkey ( display_name, email )`;

function first<T>(v: T[] | T | null | undefined): T | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

function toSubmission(row: SubmissionRow): Submission {
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    studentId: row.student_id,
    content: row.content,
    submittedAt: row.submitted_at,
    // numeric(5,2) arrives as a string over PostgREST.
    grade: row.grade === null ? null : Number(row.grade),
    feedback: row.feedback,
    gradedAt: row.graded_at,
    gradedBy: row.graded_by,
  };
}

function toSubmissionWithStudent(row: SubmissionRow): SubmissionWithStudent {
  const student = first(row.student);
  return {
    ...toSubmission(row),
    studentName: student?.display_name ?? '',
    studentEmail: student?.email ?? '',
  };
}

async function requireUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user?.id;
  if (!id) throw new Error('not authenticated');
  return id;
}

export async function saveDraft(assignmentId: string, content: ProjectState): Promise<void> {
  const studentId = await requireUserId();
  const { error } = await supabase.from('drafts').upsert(
    { assignment_id: assignmentId, student_id: studentId, content, updated_at: new Date().toISOString() },
    { onConflict: 'assignment_id,student_id' },
  );
  if (error) throw new Error(error.message);
}

/**
 * Last-gasp draft write for `beforeunload`, when the page is already tearing
 * down.
 *
 * saveDraft() cannot be used here: it awaits getSession() first, and the
 * browser kills in-flight work as the page unloads, so the request would be
 * cancelled before it left. This posts straight to PostgREST with
 * `keepalive: true`, which is the one mode the browser promises to finish
 * after the document goes away.
 *
 * Two consequences of that: the session has to be read synchronously from the
 * store supabase-js already persists, and there is no way to observe the
 * result. It is a best-effort backstop behind the unmount flush, not a
 * guaranteed write — deliberately silent on every failure path.
 *
 * `payload` is the already-serialized ProjectState, so the caller can compare
 * it against what it last wrote without re-stringifying here.
 */
export function saveDraftBeacon(assignmentId: string, payload: string): void {
  try {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return;

    // supabase-js persists the session under `sb-<project-ref>-auth-token`.
    // Derived from the URL so it tracks whichever project this build points at.
    const ref = new URL(url).hostname.split('.')[0];
    const raw = window.localStorage.getItem(`sb-${ref}-auth-token`);
    if (!raw) return;
    const session = JSON.parse(raw);
    const token = session?.access_token;
    const studentId = session?.user?.id;
    if (!token || !studentId) return;

    fetch(`${url}/rest/v1/drafts?on_conflict=assignment_id,student_id`, {
      method: 'POST',
      keepalive: true,
      headers: {
        apikey: key,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        // merge-duplicates makes this an upsert, matching saveDraft().
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        assignment_id: assignmentId,
        student_id: studentId,
        content: JSON.parse(payload),
        updated_at: new Date().toISOString(),
      }),
    }).catch(() => {});
  } catch {
    /* best effort only — never block the page from closing */
  }
}

/** Returns null (not an error) when the student has no draft yet. */
export async function getDraft(assignmentId: string): Promise<Draft | null> {
  try {
    const studentId = await requireUserId();
    const { data, error } = await supabase
      .from('drafts')
      .select('content, updated_at')
      .eq('assignment_id', assignmentId)
      .eq('student_id', studentId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return { content: data.content as ProjectState, updatedAt: data.updated_at as string };
  } catch {
    return null;
  }
}

export async function submitAssignment(assignmentId: string, content: ProjectState): Promise<Submission> {
  const studentId = await requireUserId();
  const { data, error } = await supabase
    .from('submissions')
    .insert({ assignment_id: assignmentId, student_id: studentId, content })
    .select(COLS)
    .single();
  if (error) throw new Error(error.message);
  return toSubmission(data as SubmissionRow);
}

export async function getMySubmission(assignmentId: string): Promise<Submission | null> {
  const studentId = await requireUserId();
  const { data, error } = await supabase
    .from('submissions')
    .select(COLS)
    .eq('assignment_id', assignmentId)
    .eq('student_id', studentId)
    .order('submitted_at', { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const row = (data as SubmissionRow[])[0];
  return row ? toSubmission(row) : null;
}

export async function listSubmissions(assignmentId: string): Promise<SubmissionWithStudent[]> {
  const { data, error } = await supabase
    .from('submissions')
    .select(COLS_WITH_STUDENT)
    .eq('assignment_id', assignmentId)
    .order('submitted_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data as unknown as SubmissionRow[]).map(toSubmissionWithStudent);
}

export async function getSubmission(submissionId: string): Promise<SubmissionWithStudent> {
  const { data, error } = await supabase
    .from('submissions')
    .select(COLS_WITH_STUDENT)
    .eq('id', submissionId)
    .single();
  if (error) throw new Error(error.message);
  return toSubmissionWithStudent(data as unknown as SubmissionRow);
}

export async function gradeSubmission(
  submissionId: string,
  input: { grade: number | null; feedback: string | null },
): Promise<Submission> {
  const graderId = await requireUserId();
  const { data, error } = await supabase
    .from('submissions')
    .update({
      grade: input.grade,
      feedback: input.feedback,
      graded_at: new Date().toISOString(),
      graded_by: graderId,
    })
    .eq('id', submissionId)
    .select(COLS)
    .single();
  if (error) throw new Error(error.message);
  return toSubmission(data as SubmissionRow);
}
