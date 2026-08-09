import Dexie, { type Table } from 'dexie';

// Phase 6 offline support. Mirrors the ScholarLog approach: cache
// last-known-good GET responses locally so read views (attendance,
// results, fees, announcements) stay usable with no connection, and
// queue writes that fail because the device is offline so they can be
// replayed automatically once it's back.
//
// This is deliberately NOT a full offline-first rewrite (PRD §2.5 puts
// data correctness ahead of aesthetics, and results/fees are the kind of
// data that must never be silently wrong) - it's a pragmatic cache-aside
// layer: always try the network first, fall back to cache only on a
// genuine network failure, and always label cached data as such in the
// UI so nobody mistakes a stale attendance record for a live one.

export interface CachedResponse {
  /** The API path (including query string) this response is keyed by. */
  key: string;
  data: unknown;
  cachedAt: number;
}

export interface PendingAttendanceSubmission {
  id?: number;
  classId: string;
  date: string;
  records: { studentId: string; status: string }[];
  createdAt: number;
  /** Set once a sync attempt fails with a real (non-network) error, so the UI can surface it instead of retrying forever. */
  lastError?: string;
}

class OfflineDB extends Dexie {
  cachedResponses!: Table<CachedResponse, string>;
  pendingAttendance!: Table<PendingAttendanceSubmission, number>;

  constructor() {
    super('nuruddeen-sms-offline');
    this.version(1).stores({
      cachedResponses: 'key',
      pendingAttendance: '++id, createdAt',
    });
  }
}

// IndexedDB doesn't exist during SSR/build - guard construction so this
// module can be safely imported from anywhere, including server code.
export const db = typeof window !== 'undefined' ? new OfflineDB() : (null as unknown as OfflineDB);

export async function getCachedResponse(key: string): Promise<CachedResponse | undefined> {
  if (!db) return undefined;
  try {
    return await db.cachedResponses.get(key);
  } catch {
    return undefined;
  }
}

export async function setCachedResponse(key: string, data: unknown): Promise<void> {
  if (!db) return;
  try {
    await db.cachedResponses.put({ key, data, cachedAt: Date.now() });
  } catch {
    // Cache writes are best-effort - storage full/private-mode failures
    // should never break the actual request that triggered them.
  }
}

export async function queuePendingAttendance(
  entry: Omit<PendingAttendanceSubmission, 'id' | 'createdAt'>,
): Promise<number> {
  return db.pendingAttendance.add({ ...entry, createdAt: Date.now() });
}

export async function listPendingAttendance(): Promise<PendingAttendanceSubmission[]> {
  if (!db) return [];
  return db.pendingAttendance.orderBy('createdAt').toArray();
}

export async function removePendingAttendance(id: number): Promise<void> {
  if (!db) return;
  await db.pendingAttendance.delete(id);
}

export async function markPendingAttendanceError(id: number, message: string): Promise<void> {
  if (!db) return;
  await db.pendingAttendance.update(id, { lastError: message });
}
