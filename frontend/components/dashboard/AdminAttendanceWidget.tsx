'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckSquare } from 'lucide-react';
import { api } from '../../lib/api';
import { EmptyState } from '../ui/EmptyState';
import { DashboardWidget } from '../ui/DashboardWidget';
import { Donut } from '../ui/charts/Donut';
import { getErrorMessage } from '../../lib/errors';

interface AttendanceSummaryResponse {
  totalClasses: number;
  classesMarked: number;
  totalStudents: number;
  counts: { PRESENT: number; ABSENT: number; LATE: number; EXCUSED: number };
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * School-wide attendance for today, backed by GET /api/attendance/summary
 * — a single aggregate query computed server-side. Previously this fetched
 * every class then called /api/attendance/roster once per class (1 + N
 * requests), which got slower as the school added classes; the numbers
 * shown are unchanged, just computed in the database instead of the browser.
 */
export function AdminAttendanceWidget({ href, title = 'Attendance overview' }: { href: string; title?: string }) {
  const [summaryData, setSummaryData] = useState<AttendanceSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    api
      .get<AttendanceSummaryResponse>(`/api/attendance/summary?date=${todayISO()}`)
      .then(setSummaryData)
      .catch((err) => setError(getErrorMessage(err, 'Failed to load attendance.')))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const summary = useMemo(() => {
    const counts = summaryData?.counts ?? { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
    const marked = counts.PRESENT + counts.ABSENT + counts.LATE + counts.EXCUSED;
    const rate = marked > 0 ? Math.round((counts.PRESENT / marked) * 100) : 0;
    return {
      counts,
      totalStudents: summaryData?.totalStudents ?? 0,
      classesMarked: summaryData?.classesMarked ?? 0,
      rate,
    };
  }, [summaryData]);

  const totalClasses = summaryData?.totalClasses ?? 0;

  const segments = [
    { label: 'Present', value: summary.counts.PRESENT, color: 'var(--success)' },
    { label: 'Absent', value: summary.counts.ABSENT, color: 'var(--danger)' },
    { label: 'Late', value: summary.counts.LATE, color: 'var(--warn)' },
    { label: 'Excused', value: summary.counts.EXCUSED, color: 'var(--gold)' },
  ];

  const noData = totalClasses === 0 || summary.totalStudents === 0;

  return (
    <DashboardWidget title={title} icon={CheckSquare} href={href} linkLabel="Take attendance" loading={loading} error={error} onRetry={load}>
      {noData ? (
        <EmptyState icon={CheckSquare} title="No attendance marked today" description="Attendance recorded across classes today will summarize here." tone="muted" compact />
      ) : (
        <>
          <Donut segments={segments} centerLabel="present rate" centerValue={`${summary.rate}%`} />
          <div style={{ marginTop: 14, fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
            {summary.classesMarked} of {totalClasses} classes marked today
          </div>
        </>
      )}
    </DashboardWidget>
  );
}
