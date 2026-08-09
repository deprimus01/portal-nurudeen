'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../../lib/auth-context';
import { api, ApiError } from '../../../lib/api';
import { OfflineBanner } from '../../../components/ui/OfflineBanner';

interface AttendanceRecord {
  id: string;
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
}

export default function GuardianAttendancePage() {
  const { user } = useAuth();
  const profile = user?.profile as any;
  const children = profile?.studentGuardians?.map((sg: any) => sg.student) || [];
  const [studentId, setStudentId] = useState(children[0]?.id || '');
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cachedAt, setCachedAt] = useState<number | undefined>();

  useEffect(() => {
    if (!studentId) return;
    setLoading(true);
    setError(null);
    api.getWithCache<AttendanceRecord[]>(`/api/attendance/student/${studentId}`)
      .then((res) => {
        setRecords(res.data);
        setCachedAt(res.fromCache ? res.cachedAt : undefined);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load.'))
      .finally(() => setLoading(false));
  }, [studentId]);

  if (children.length === 0) {
    return (
      <div>
        <div className="topbar"><h1 style={{ fontSize: '1.4rem' }}>Attendance</h1></div>
        <div className="card"><p style={{ color: 'var(--muted)' }}>No students linked to your account yet.</p></div>
      </div>
    );
  }

  const summary = records.reduce(
    (acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }),
    {} as Record<string, number>,
  );

  return (
    <div>
      <div className="topbar">
        <h1 style={{ fontSize: '1.4rem' }}>Attendance</h1>
        {children.length > 1 && (
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)} style={{ maxWidth: '220px' }}>
            {children.map((c: any) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
          </select>
        )}
      </div>

      {error && <p className="error-text">{error}</p>}
      {cachedAt !== undefined && <OfflineBanner cachedAt={cachedAt} />}

      {!loading && records.length > 0 && (
        <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <span className="badge badge-success">Present: {summary.PRESENT || 0}</span>
          <span className="badge badge-danger">Absent: {summary.ABSENT || 0}</span>
          <span className="badge">Late: {summary.LATE || 0}</span>
          <span className="badge">Excused: {summary.EXCUSED || 0}</span>
        </div>
      )}

      <div className="card">
        {loading ? (
          <p style={{ color: 'var(--muted)' }}>Loading…</p>
        ) : records.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>No attendance recorded yet.</p>
        ) : (
          <div className="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Status</th></tr></thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.date).toLocaleDateString()}</td>
                  <td>
                    <span className={`badge ${r.status === 'PRESENT' ? 'badge-success' : r.status === 'ABSENT' ? 'badge-danger' : ''}`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
