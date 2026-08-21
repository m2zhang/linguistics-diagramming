import type { ProjectState } from '../export/projectState';
import { supabase } from '../lib/supabase';

export interface Lecture {
  id: string;
  courseId: string;
  title: string;
  notes: string | null;
  position: number;
  createdAt: string;
}

export interface LectureTree {
  id: string;
  lectureId: string;
  title: string;
  content: ProjectState;
  position: number;
  createdAt: string;
}

export interface LectureDetail extends Lecture {
  trees: LectureTree[];
}

interface LectureRow {
  id: string;
  course_id: string;
  title: string;
  notes: string | null;
  position: number;
  created_at: string;
}

interface TreeRow {
  id: string;
  lecture_id: string;
  title: string;
  content: ProjectState;
  position: number;
  created_at: string;
}

const LECTURE_COLS = 'id, course_id, title, notes, position, created_at';
const TREE_COLS = 'id, lecture_id, title, content, position, created_at';

function toLecture(row: LectureRow): Lecture {
  return {
    id: row.id,
    courseId: row.course_id,
    title: row.title,
    notes: row.notes,
    position: row.position,
    createdAt: row.created_at,
  };
}

function toTree(row: TreeRow): LectureTree {
  return {
    id: row.id,
    lectureId: row.lecture_id,
    title: row.title,
    content: row.content,
    position: row.position,
    createdAt: row.created_at,
  };
}

/** Positions were assigned by a SQL subquery in the old Express handler;
 *  with no server there any more, compute the next one client-side. */
async function nextPosition(table: 'lectures' | 'lecture_trees', column: string, id: string): Promise<number> {
  const { data, error } = await supabase
    .from(table)
    .select('position')
    .eq(column, id)
    .order('position', { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const top = (data as { position: number }[] | null)?.[0];
  return top ? top.position + 1 : 0;
}

export async function listLectures(courseId: string): Promise<Lecture[]> {
  const { data, error } = await supabase
    .from('lectures')
    .select(LECTURE_COLS)
    .eq('course_id', courseId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data as LectureRow[]).map(toLecture);
}

export async function createLecture(
  courseId: string,
  input: { title: string; notes?: string },
): Promise<Lecture> {
  const position = await nextPosition('lectures', 'course_id', courseId);
  const { data, error } = await supabase
    .from('lectures')
    .insert({ course_id: courseId, title: input.title, notes: input.notes ?? null, position })
    .select(LECTURE_COLS)
    .single();
  if (error) throw new Error(error.message);
  return toLecture(data as LectureRow);
}

export async function getLecture(lectureId: string): Promise<LectureDetail> {
  const [lectureRes, treesRes] = await Promise.all([
    supabase.from('lectures').select(LECTURE_COLS).eq('id', lectureId).single(),
    supabase
      .from('lecture_trees')
      .select(TREE_COLS)
      .eq('lecture_id', lectureId)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true }),
  ]);
  if (lectureRes.error) throw new Error(lectureRes.error.message);
  if (treesRes.error) throw new Error(treesRes.error.message);

  return {
    ...toLecture(lectureRes.data as LectureRow),
    trees: (treesRes.data as TreeRow[]).map(toTree),
  };
}

export async function updateLecture(
  lectureId: string,
  input: { title?: string; notes?: string },
): Promise<Lecture> {
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.notes !== undefined) patch.notes = input.notes;

  const { data, error } = await supabase
    .from('lectures')
    .update(patch)
    .eq('id', lectureId)
    .select(LECTURE_COLS)
    .single();
  if (error) throw new Error(error.message);
  return toLecture(data as LectureRow);
}

export async function deleteLecture(lectureId: string): Promise<void> {
  const { error } = await supabase.from('lectures').delete().eq('id', lectureId);
  if (error) throw new Error(error.message);
}

export async function addLectureTree(
  lectureId: string,
  input: { title: string; content: ProjectState },
): Promise<LectureTree> {
  const position = await nextPosition('lecture_trees', 'lecture_id', lectureId);
  const { data, error } = await supabase
    .from('lecture_trees')
    .insert({ lecture_id: lectureId, title: input.title, content: input.content, position })
    .select(TREE_COLS)
    .single();
  if (error) throw new Error(error.message);
  return toTree(data as TreeRow);
}

export async function deleteLectureTree(treeId: string): Promise<void> {
  const { error } = await supabase.from('lecture_trees').delete().eq('id', treeId);
  if (error) throw new Error(error.message);
}
