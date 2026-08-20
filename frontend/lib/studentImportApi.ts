import { api, API_BASE_URL, getToken, ApiError } from './api';
import type { ImportBatch, ImportBatchDetail, ImportCommitResult, ImportRecord } from './types';

// Uploads use FormData, so this bypasses `api.post` (which always sends
// JSON) and talks to fetch directly — but keeps the same error-shape
// contract (ApiError with a friendly message) so callers can use
// getErrorMessage() exactly like everywhere else in the app.
export async function uploadImportFile(file: File): Promise<{ batchId: string; status: string }> {
  const token = getToken();
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE_URL}/api/students/import/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const rawMessage = data?.error || 'Something went wrong.';
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error(`[API ${res.status}] /api/students/import/upload ->`, rawMessage);
    }
    // Upload errors (bad file type, too large, corrupted) are already
    // written by the backend to be shown as-is — no further translation
    // needed the way 401/403/500 defaults are elsewhere.
    throw new ApiError(rawMessage, res.status, undefined, rawMessage);
  }

  return data;
}

export function getImportBatch(batchId: string, page = 1, pageSize = 50) {
  return api.get<ImportBatchDetail>(`/api/students/import/${batchId}?page=${page}&pageSize=${pageSize}`);
}

export interface ImportRecordCorrection {
  firstName?: string;
  lastName?: string;
  otherNames?: string;
  dateOfBirth?: string;
  gender?: 'MALE' | 'FEMALE';
  classId?: string;
  guardianId?: string | null;
  guardianFirstName?: string;
  guardianLastName?: string;
  guardianPhone?: string;
  guardianEmail?: string;
  guardianRelationship?: 'FATHER' | 'MOTHER' | 'GUARDIAN' | 'OTHER';
  skip?: boolean;
}

export function correctImportRecord(batchId: string, recordId: string, body: ImportRecordCorrection) {
  return api.patch<{ record: ImportRecord }>(`/api/students/import/${batchId}/records/${recordId}`, body);
}

export function commitImportBatch(batchId: string) {
  return api.post<ImportCommitResult>(`/api/students/import/${batchId}/commit`, {});
}

export function getImportHistory(page = 1, pageSize = 20) {
  return api.get<{ batches: ImportBatch[]; total: number; page: number; pageSize: number }>(
    `/api/students/import/history?page=${page}&pageSize=${pageSize}`,
  );
}

export function cancelImportBatch(batchId: string) {
  return api.delete<void>(`/api/students/import/${batchId}`);
}

// Template download is a binary response, not JSON — same reasoning as
// uploadImportFile for going around the `api` helper.
export async function downloadImportTemplate(): Promise<void> {
  const token = getToken();
  const res = await fetch(`${API_BASE_URL}/api/students/import/template`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!res.ok) {
    throw new ApiError('Could not download the template. Please try again.', res.status);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'student-import-template.xlsx';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// Client-side CSV of failed rows — built from data already in hand
// (the commit response), no extra request needed.
export function downloadFailedRowsCsv(failedRows: { rowNumber: number; reason: string }[], fileName: string) {
  const header = 'Row,Reason\n';
  const body = failedRows
    .map((r) => `${r.rowNumber},"${r.reason.replace(/"/g, '""')}"`)
    .join('\n');
  const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// Fetches the stored source image (or a rendered PDF page) for visual
// verification, as an object URL the browser can use directly in an
// <img>. Auth-gated exactly like every other batch endpoint — never a
// plain <img src> to the raw API URL, since that would bypass the
// Authorization header and the server's ownership check entirely.
// Callers must call URL.revokeObjectURL on the result when done with it
// to avoid leaking memory across a long preview session.
export async function fetchImportSourceImageUrl(batchId: string, pdfPage?: number): Promise<string> {
  const token = getToken();
  const query = pdfPage ? `?pdfPage=${pdfPage}` : '';
  const res = await fetch(`${API_BASE_URL}/api/students/import/${batchId}/source${query}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(data?.error || 'Could not load the source document.', res.status);
  }

  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
