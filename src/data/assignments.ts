import type { ProjectState } from '../export/projectState';
import { supabase } from '../lib/supabase';

export type AssignmentMode = 'blank' | 'template';

export interface Assignment {
  id: string;
  courseId: string;
  lectureId: string | null;
  title: string;
  instructions: string | null;
  mode: AssignmentMode;
  templateContent: ProjectState | null;
  dueAt: string | null;
  maxGrade: number | null;
  createdAt: string;
}

interface AssignmentRow {
  id: string;
  course_id: string;
  lecture_id: string | null;
  title: string;
  instructions: string | null;
  mode: AssignmentMode;
  template_content: ProjectState | null;
  due_at: string | null;
  max_grade: number | string | null;
  created_at: string;
}

const COLS =
  'id, course_id, lecture_id, title, instructions, mode, template_content, due_at, max_grade, created_at';

function toAssignment(row: AssignmentRow): Assignment {
  return {
    id: row.id,
    courseId: row.course_id,
    lectureId: row.lecture_id,
    title: row.title,
    instructions: row.instructions,
    mode: row.mode,
    templateContent: row.template_content,
    dueAt: row.due_at,
    // numeric(5,2) arrives as a string over PostgREST.
    maxGrade: row.max_grade === null ? null : Number(row.max_grade),
    createdAt: row.created_at,
  };
}

export async function listAssignments(courseId: string): Promise<Assignment[]> {
  const { data, error } = await supabase
    .from('assignments')
    .select(COLS)
    .eq('course_id', courseId)
    .order('due_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data as AssignmentRow[]).map(toAssignment);
}

export async function getAssignment(assignmentId: string): Promise<Assignment> {
  const { data, error } = await supabase.from('assignments').select(COLS).eq('id', assignmentId).single();
  if (error) throw new Error(error.message);
  return toAssignment(data as AssignmentRow);
}

export async function createAssignment(
  courseId: string,
  input: {
    title: string;
    instructions?: string;
    mode: AssignmentMode;
    templateContent?: ProjectState;
    dueAt?: string | null;
    lectureId?: string | null;
    maxGrade?: number | null;
  },
): Promise<Assignment> {
  const { data, error } = await supabase
    .from('assignments')
    .insert({
      course_id: courseId,
      lecture_id: input.lectureId ?? null,
      title: input.title,
      instructions: input.instructions ?? null,
      mode: input.mode,
      template_content: input.mode === 'template' ? input.templateContent ?? null : null,
      due_at: input.dueAt ?? null,
      max_grade: input.maxGrade ?? null,
    })
    .select(COLS)
    .single();
  if (error) throw new Error(error.message);
  return toAssignment(data as AssignmentRow);
}

export async function updateAssignment(
  assignmentId: string,
  input: { title?: string; instructions?: string | null; dueAt?: string | null; maxGrade?: number | null },
): Promise<Assignment> {
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.instructions !== undefined) patch.instructions = input.instructions;
  if (input.dueAt !== undefined) patch.due_at = input.dueAt;
  if (input.maxGrade !== undefined) patch.max_grade = input.maxGrade;

  const { data, error } = await supabase
    .from('assignments')
    .update(patch)
    .eq('id', assignmentId)
    .select(COLS)
    .single();
  if (error) throw new Error(error.message);
  return toAssignment(data as AssignmentRow);
}

export async function deleteAssignment(assignmentId: string): Promise<void> {
  const { error } = await supabase.from('assignments').delete().eq('id', assignmentId);
  if (error) throw new Error(error.message);
}
