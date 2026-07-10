import { create } from 'zustand';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/** Tracks which cloud tree-file is open and its save state. Kept separate from
 *  treeStore (the tree content) so routing/dashboard can drive the open file. */
interface FileState {
  currentFileId: string | null;
  title: string;
  saveStatus: SaveStatus;
  setCurrentFile: (id: string | null, title: string) => void;
  setTitle: (title: string) => void;
  setSaveStatus: (status: SaveStatus) => void;
}

export const useFileStore = create<FileState>((set) => ({
  currentFileId: null,
  title: 'Untitled tree',
  saveStatus: 'idle',
  setCurrentFile: (currentFileId, title) => set({ currentFileId, title }),
  setTitle: (title) => set({ title }),
  setSaveStatus: (saveStatus) => set({ saveStatus }),
}));
