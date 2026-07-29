export type Role = 'student' | 'instructor';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  createdAt: string;
}

const BASE = '/api/auth';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // Non-JSON error body — keep the generic message.
    }
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function signup(input: { email: string; password: string; displayName: string; role: Role }) {
  return request<{ id: string; role: Role }>('/signup', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function login(input: { email: string; password: string }) {
  return request<{ id: string; role: Role }>('/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function logout() {
  return request<void>('/logout', { method: 'POST' });
}

export function fetchMe() {
  return request<AuthUser>('/me');
}

export function updateProfile(input: { displayName: string }) {
  return request<AuthUser>('/me', { method: 'PATCH', body: JSON.stringify(input) });
}
