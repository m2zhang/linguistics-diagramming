import { useAuthStore } from '../store/authStore';

/** Thin convenience hook — current user + auth status from authStore. */
export function useUser() {
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  return { user, status };
}
