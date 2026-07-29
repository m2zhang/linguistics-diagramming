import type { ProjectState } from '../export/projectState';

export interface Lecture {
  id: string;
  courseId: string;
  title: string;
  notes: string | null;
  position: number;
  createdAt: string;
}

export interface LectureTree {
  id: string;
  lectureId: string;
  title: string;
  content: ProjectState;
  position: number;
  createdAt: string;
}

export interface LectureDetail extends Lecture {
  trees: LectureTree[];
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

export function listLectures(courseId: string) {
  return request<Lecture[]>(`/courses/${courseId}/lectures`);
}

export function createLecture(courseId: string, input: { title: string; notes?: string }) {
  return request<Lecture>(`/courses/${courseId}/lectures`, { method: 'POST', body: JSON.stringify(input) });
}

export function getLecture(lectureId: string) {
  return request<LectureDetail>(`/lectures/${lectureId}`);
}

export function updateLecture(lectureId: string, input: { title?: string; notes?: string }) {
  return request<Lecture>(`/lectures/${lectureId}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function deleteLecture(lectureId: string) {
  return request<void>(`/lectures/${lectureId}`, { method: 'DELETE' });
}

export function addLectureTree(lectureId: string, input: { title: string; content: ProjectState }) {
  return request<LectureTree>(`/lectures/${lectureId}/trees`, { method: 'POST', body: JSON.stringify(input) });
}

export function deleteLectureTree(treeId: string) {
  return request<void>(`/lecture-trees/${treeId}`, { method: 'DELETE' });
}
