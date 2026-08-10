'use client';

import { useEffect, useState } from 'react';
import { CalendarCheck } from 'lucide-react';
import { useAuth } from '../../../lib/auth-context';
import { api, ApiError } from '../../../lib/api';
import { useLanguage } from '../../../lib/i18n/language-context';
import { EmptyState } from '../../../components/ui/EmptyState';

interface AttendanceRecord {
  id: string;
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
}

export default function StudentAttendancePage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const studentId = (user?.profile as { id?: string } | null)?.id;
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId) return;
    api.get<AttendanceRecord[]>(`/api/attendance/student/${studentId}`)
      .then(setRecords)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load.'))
      .finally(() => setLoading(false));
  }, [studentId]);

  const summary = records.reduce(
    (acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }),
    {} as Record<string, number>,
  );

  return (
    <div>
      <div className="topbar"><h1 style={{ fontSize: '1.4rem' }}>{t('pages.attendance.title')}</h1></div>

      {error && <p className="error-text">{error}</p>}

      {!loading && records.length > 0 && (
        <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <span className="badge badge-success">{t('status.present')}: {summary.PRESENT || 0}</span>
          <span className="badge badge-danger">{t('status.absent')}: {summary.ABSENT || 0}</span>
          <span className="badge">{t('status.late')}: {summary.LATE || 0}</span>
          <span className="badge">{t('status.excused')}: {summary.EXCUSED || 0}</span>
        </div>
      )}

      <div className="card">
        {loading ? (
          <p style={{ color: 'var(--muted)' }}>{t('common.loading')}</p>
        ) : records.length === 0 ? (
          <EmptyState
            icon={CalendarCheck}
            title="No attendance recorded yet"
            description="Attendance marked by your teacher will appear here."
            tone="green"
          />
        ) : (
          <div className="table-wrap">
          <table>
            <thead><tr><th>{t('fields.date')}</th><th>{t('fields.status')}</th></tr></thead>
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
