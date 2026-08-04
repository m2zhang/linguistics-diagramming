import { create } from 'zustand';
import {
  completeOnboarding,
  fetchMe,
  login as apiLogin,
  logout as apiLogout,
  signup as apiSignup,
  updateProfile as apiUpdateProfile,
  type AuthUser,
  type Role,
} from '../data/authClient';
import { useUiStore } from './uiStore';

export type { AuthUser, Role };

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  user: AuthUser | null;
  status: AuthStatus;
  /** Re-checks the session against the server and syncs uiStore.appMode
   *  from the result. Called once on app mount (AuthGate) and again after
   *  a successful login/signup. */
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  signup: (input: {
    email: string;
    password: string;
    displayName: string;
  }) => Promise<{ needsEmailConfirmation: boolean }>;
  logout: () => Promise<void>;
  updateProfile: (displayName: string) => Promise<void>;
  finishOnboarding: (input: {
    role: Role;
    displayName: string;
    institution: string | null;
    program: string | null;
    department: string | null;
  }) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  status: 'loading',

  refresh: async () => {
    try {
      const user = await fetchMe();
      set({ user, status: 'authenticated' });
      // The stored role is what drives student vs instructor mode on every
      // sign-in, so it is applied here rather than anywhere in the UI.
      useUiStore.getState().setAppMode(user.role);
    } catch {
      set({ user: null, status: 'unauthenticated' });
    }
  },

  login: async (email, password) => {
    await apiLogin({ email, password });
    await get().refresh();
  },

  signup: async (input) => {
    const { needsEmailConfirmation } = await apiSignup(input);
    if (needsEmailConfirmation) return { needsEmailConfirmation: true };
    await get().refresh();
    return { needsEmailConfirmation: false };
  },

  logout: async () => {
    await apiLogout();
    set({ user: null, status: 'unauthenticated' });
  },

  updateProfile: async (displayName) => {
    const user = await apiUpdateProfile({ displayName });
    set({ user });
  },

  finishOnboarding: async (input) => {
    const user = await completeOnboarding(input);
    set({ user });
    // Onboarding is where the role is first set, so the app mode has to be
    // re-synced here — refresh() won't run again until the next load.
    useUiStore.getState().setAppMode(user.role);
  },
}));
