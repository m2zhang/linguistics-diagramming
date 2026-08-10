import { create } from 'zustand';

export type ToastKind = 'info' | 'success' | 'error';
export interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

export type AppMode = 'student' | 'instructor';

interface UiState {
  theme: 'dark' | 'light';
  toasts: Toast[];
  validatorOn: boolean;
  sidebarOpen: boolean;
  rightpaneOpen: boolean;
  /** Mirrors the signed-in user's role (see src/store/authStore.ts) — not an
   *  independent user-facing toggle. Gates the editor's advanced tools. */
  appMode: AppMode;
  toggleTheme: () => void;
  toggleSidebar: () => void;
  toggleRightpane: () => void;
  setAppMode: (mode: AppMode) => void;
  toast: (message: string, kind?: ToastKind) => void;
  dismissToast: (id: number) => void;
}

let toastId = 0;

export const useUiStore = create<UiState>((set) => ({
  theme: 'light',
  toasts: [],
  validatorOn: false,
  sidebarOpen: true,
  rightpaneOpen: true,
  appMode: 'student',

  toggleTheme: () =>
    set((s) => {
      const theme = s.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', theme);
      return { theme };
    }),

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleRightpane: () => set((s) => ({ rightpaneOpen: !s.rightpaneOpen })),
  setAppMode: (appMode) => set({ appMode }),

  toast: (message, kind = 'info') =>
    set((s) => {
      const id = ++toastId;
      // Auto-dismiss after 2.6s.
      setTimeout(() => {
        useUiStore.setState((st) => ({ toasts: st.toasts.filter((t) => t.id !== id) }));
      }, 2600);
      return { toasts: [...s.toasts, { id, message, kind }] };
    }),

  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
