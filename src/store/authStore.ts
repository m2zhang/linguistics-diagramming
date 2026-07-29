import { create } from 'zustand';
import {
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
  signup: (input: { email: string; password: string; displayName: string; role: Role }) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (displayName: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  status: 'loading',

  refresh: async () => {
    try {
      const user = await fetchMe();
      set({ user, status: 'authenticated' });
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
    await apiSignup(input);
    await get().refresh();
  },

  logout: async () => {
    await apiLogout();
    set({ user: null, status: 'unauthenticated' });
  },

  updateProfile: async (displayName) => {
    const user = await apiUpdateProfile({ displayName });
    set({ user });
  },
}));
