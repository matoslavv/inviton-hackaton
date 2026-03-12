const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export async function uploadPdf(file: File): Promise<{ path: string }> {
  const formData = new FormData();
  formData.append('pdf', file);

  const res = await fetch(`${API_URL}/upload/pdf`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `Upload failed: ${res.status}`);
  }

  return res.json() as Promise<{ path: string }>;
}
