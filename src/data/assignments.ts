import type { ProjectState } from '../export/projectState';

export type AssignmentMode = 'blank' | 'template';

export interface Assignment {
  id: string;
  courseId: string;
  lectureId: string | null;
  title: string;
  instructions: string | null;
  mode: AssignmentMode;
  templateContent: ProjectState | null;
  dueAt: string | null;
  createdAt: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
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

export function listAssignments(courseId: string) {
  return request<Assignment[]>(`/courses/${courseId}/assignments`);
}

export function getAssignment(assignmentId: string) {
  return request<Assignment>(`/assignments/${assignmentId}`);
}

export function createAssignment(
  courseId: string,
  input: {
    title: string;
    instructions?: string;
    mode: AssignmentMode;
    templateContent?: ProjectState;
    dueAt?: string | null;
    lectureId?: string | null;
  },
) {
  return request<Assignment>(`/courses/${courseId}/assignments`, { method: 'POST', body: JSON.stringify(input) });
}

export function updateAssignment(
  assignmentId: string,
  input: { title?: string; instructions?: string | null; dueAt?: string | null },
) {
  return request<Assignment>(`/assignments/${assignmentId}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function deleteAssignment(assignmentId: string) {
  return request<void>(`/assignments/${assignmentId}`, { method: 'DELETE' });
}
