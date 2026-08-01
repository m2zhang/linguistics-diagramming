import type { CourseColorKey } from '../lib/courseColors';

export interface Course {
  id: string;
  instructorId: string;
  instructorName?: string;
  instructorEmail?: string;
  title: string;
  description: string | null;
  joinCode: string;
  createdAt: string;
  studentCount?: number;
  myRole?: 'student' | 'ta';
  /** Personal to the viewer — not a property of the course itself. */
  color: CourseColorKey;
  favorite: boolean;
  archived: boolean;
}

export interface RosterEntry {
  id: string;
  displayName: string;
  email: string;
  role: 'student' | 'ta';
  joinedAt: string;
}

const BASE = '/api/courses';

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

export function listCourses() {
  return request<Course[]>('');
}

export function getCourse(id: string) {
  return request<Course>(`/${id}`);
}

export function createCourse(input: { title: string; description?: string }) {
  return request<Course>('', { method: 'POST', body: JSON.stringify(input) });
}

export function updateCourse(id: string, input: { title?: string; description?: string | null }) {
  return request<Course>(`/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

/** Personal preferences (color / favorite / archived-from-my-dashboard) —
 *  any member of the course can set their own, instructor or student. */
export function updateCoursePreferences(
  id: string,
  input: { color?: CourseColorKey; favorite?: boolean; archived?: boolean },
) {
  return request<Course>(`/${id}/preferences`, { method: 'PUT', body: JSON.stringify(input) });
}

export function regenerateJoinCode(id: string) {
  return request<{ joinCode: string }>(`/${id}/join-code/regenerate`, { method: 'POST' });
}

export function joinCourse(code: string) {
  return request<{ courseId: string }>('/join', { method: 'POST', body: JSON.stringify({ code }) });
}

export function getRoster(courseId: string) {
  return request<RosterEntry[]>(`/${courseId}/roster`);
}

export async function updateParticipantRole(courseId: string, studentId: string, role: 'student' | 'ta') {
  const res = await fetch(`/api/courses/${courseId}/roster/${studentId}/role`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || 'Failed to update role');
  }
}

export async function removeStudent(courseId: string, studentId: string) {
  return request<void>(`/${courseId}/roster/${studentId}`, { method: 'DELETE' });
}
