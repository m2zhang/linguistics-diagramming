export interface Material {
  id: string;
  lectureId: string | null;
  assignmentId: string | null;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, { credentials: 'include', ...init });

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

export function listLectureMaterials(lectureId: string) {
  return request<Material[]>(`/lectures/${lectureId}/materials`);
}

export function uploadMaterial(lectureId: string, file: File) {
  const form = new FormData();
  form.append('lectureId', lectureId);
  form.append('file', file);
  return request<Material>('/materials', { method: 'POST', body: form });
}

export function deleteMaterial(materialId: string) {
  return request<void>(`/materials/${materialId}`, { method: 'DELETE' });
}

export function materialDownloadUrl(materialId: string) {
  return `/api/materials/${materialId}/download`;
}
