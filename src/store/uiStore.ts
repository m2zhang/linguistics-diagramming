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
  /** Feature labels the user added beyond FEATURE_BUNDLES, so their chips stay
   *  in the library across a sidebar toggle. Only the *list* is session-scoped:
   *  a custom feature already on a node keeps its colour forever, because
   *  featureColor() derives it from the label rather than reading it back. */
  customFeatures: string[];
  toggleTheme: () => void;
  toggleSidebar: () => void;
  toggleRightpane: () => void;
  setAppMode: (mode: AppMode) => void;
  addCustomFeature: (label: string) => void;
  removeCustomFeature: (label: string) => void;
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
  customFeatures: [],

  toggleTheme: () =>
    set((s) => {
      const theme = s.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', theme);
      return { theme };
    }),

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleRightpane: () => set((s) => ({ rightpaneOpen: !s.rightpaneOpen })),
  setAppMode: (appMode) => set({ appMode }),

  addCustomFeature: (label) =>
    set((s) => {
      const value = label.trim().replace(/^\[|\]$/g, '').trim();
      if (!value) return s;
      const clash = (l: string) => l.toLowerCase() === value.toLowerCase();
      if (s.customFeatures.some(clash)) return s;
      return { customFeatures: [...s.customFeatures, value] };
    }),

  removeCustomFeature: (label) =>
    set((s) => ({ customFeatures: s.customFeatures.filter((l) => l !== label) })),

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
