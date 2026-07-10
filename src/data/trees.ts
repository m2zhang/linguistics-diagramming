import { supabase } from '../lib/supabase';
import type { ProjectState } from '../export/projectState';

/** Lightweight metadata for the dashboard grid — never includes the heavy `content`. */
export interface TreeFileMeta {
  id: string;
  title: string;
  thumbnail: string | null;
  updated_at: string;
}

/** All of the current user's trees, newest first. RLS scopes this to the owner. */
export async function listTrees(): Promise<TreeFileMeta[]> {
  const { data, error } = await supabase
    .from('tree_files')
    .select('id, title, thumbnail, updated_at')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Fetch one tree's full content (the serialized ProjectState). */
export async function loadTree(id: string): Promise<ProjectState> {
  const { data, error } = await supabase
    .from('tree_files')
    .select('content')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data.content as ProjectState;
}

/** Create a new tree. owner_id defaults to auth.uid() in the DB, so we don't set it. */
export async function createTree(title: string, content: ProjectState): Promise<TreeFileMeta> {
  const { data, error } = await supabase
    .from('tree_files')
    .insert({ title, content })
    .select('id, title, thumbnail, updated_at')
    .single();
  if (error) throw error;
  return data;
}

/** Overwrite a tree's content (and optionally title / thumbnail); touch updated_at. */
export async function saveTree(
  id: string,
  content: ProjectState,
  extra?: { title?: string; thumbnail?: string },
): Promise<void> {
  const patch: Record<string, unknown> = {
    content,
    updated_at: new Date().toISOString(),
  };
  if (extra?.title !== undefined) patch.title = extra.title;
  if (extra?.thumbnail !== undefined) patch.thumbnail = extra.thumbnail;
  const { error } = await supabase.from('tree_files').update(patch).eq('id', id);
  if (error) throw error;
}

export async function renameTree(id: string, title: string): Promise<void> {
  const { error } = await supabase.from('tree_files').update({ title }).eq('id', id);
  if (error) throw error;
}

export async function deleteTree(id: string): Promise<void> {
  const { error } = await supabase.from('tree_files').delete().eq('id', id);
  if (error) throw error;
}
