import type { ProjectState } from '../export/projectState';

export interface Draft {
  content: ProjectState;
  updatedAt: string;
}

export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  content: ProjectState;
  submittedAt: string;
  grade: number | null;
  feedback: string | null;
  gradedAt: string | null;
  gradedBy: string | null;
}

export interface SubmissionWithStudent extends Submission {
  studentName: string;
  studentEmail: string;
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

export function saveDraft(assignmentId: string, content: ProjectState) {
  return request<void>(`/assignments/${assignmentId}/draft`, { method: 'PUT', body: JSON.stringify({ content }) });
}

/** Returns null (not an error) when the student has no draft yet. */
export async function getDraft(assignmentId: string): Promise<Draft | null> {
  try {
    return await request<Draft>(`/assignments/${assignmentId}/draft`);
  } catch {
    return null;
  }
}

export function submitAssignment(assignmentId: string, content: ProjectState) {
  return request<Submission>(`/assignments/${assignmentId}/submissions`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

export function getMySubmission(assignmentId: string) {
  return request<Submission | null>(`/assignments/${assignmentId}/my-submission`);
}

export function listSubmissions(assignmentId: string) {
  return request<SubmissionWithStudent[]>(`/assignments/${assignmentId}/submissions`);
}

export function getSubmission(submissionId: string) {
  return request<SubmissionWithStudent>(`/submissions/${submissionId}`);
}

export function gradeSubmission(submissionId: string, input: { grade: number | null; feedback: string | null }) {
  return request<Submission>(`/submissions/${submissionId}`, { method: 'PATCH', body: JSON.stringify(input) });
}
