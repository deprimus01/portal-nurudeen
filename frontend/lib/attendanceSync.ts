import { api, ApiError } from './api';
import { listPendingAttendance, removePendingAttendance, markPendingAttendanceError, type PendingAttendanceSubmission } from './db';

export interface FlushResult {
  synced: number;
  stillPending: number;
}

// Replays queued attendance submissions (see AttendanceEntry.tsx - a save
// that fails because the device is offline gets queued here instead of
// showing an error) once connectivity is back. Safe to call speculatively
// (e.g. on mount, on the browser's 'online' event) - if the queue is
// empty this is a no-op.
export async function flushPendingAttendance(): Promise<FlushResult> {
  const queued = await listPendingAttendance();
  let synced = 0;

  for (const entry of queued) {
    try {
      await api.post('/api/attendance', {
        classId: entry.classId,
        date: entry.date,
        records: entry.records,
      });
      await removePendingAttendance(entry.id!);
      synced += 1;
    } catch (err) {
      // A real validation/permission error (ApiError) means this entry
      // will never succeed as-is - stop retrying it automatically and
      // leave it queued so the teacher can see and address it, rather
      // than silently dropping a day's attendance. A network failure just
      // means we're still offline - stop the whole flush and try again
      // next time.
      if (err instanceof ApiError) {
        await markPendingAttendanceError(entry.id!, err.message);
        continue;
      }
      break;
    }
  }

  const remaining = await listPendingAttendance();
  return { synced, stillPending: remaining.length };
}

export type { PendingAttendanceSubmission };
