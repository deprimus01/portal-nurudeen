'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckSquare } from 'lucide-react';
import { api } from '../../lib/api';
import { DashboardWidget, RangeTabs } from '../ui/DashboardWidget';
import { EmptyState } from '../ui/EmptyState';
import { Donut } from '../ui/charts/Donut';
import { TrendLine } from '../ui/charts/TrendLine';
import { getErrorMessage } from '../../lib/errors';

interface AttendanceRecord {
  id: string;
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
}

type Range = '30' | '90' | 'all';

function isoWeek(d: Date) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Attendance summary for a single student, built entirely from
 * /api/attendance/student/:id (the same endpoint the Attendance page
 * already uses) - no new endpoints, no invented figures.
 */
export function AttendanceWidget({ studentId, href, title = 'Attendance' }: { studentId: string; href: string; title?: string }) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<Range>('30');

  useEffect(() => {
    if (!studentId) return;
    setLoading(true);
    setError(null);
    api
      .get<AttendanceRecord[]>(`/api/attendance/student/${studentId}`)
      .then(setRecords)
      .catch((err) => setError(getErrorMessage(err, 'Failed to load attendance.')))
      .finally(() => setLoading(false));
  }, [studentId]);

  const filtered = useMemo(() => {
    if (range === 'all') return records;
    const days = range === '30' ? 30 : 90;
    const cutoff = Date.now() - days * 86400000;
    return records.filter((r) => new Date(r.date).getTime() >= cutoff);
  }, [records, range]);

  const summary = useMemo(() => {
    const counts = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 } as Record<string, number>;
    for (const r of filtered) counts[r.status] = (counts[r.status] || 0) + 1;
    const total = filtered.length;
    const rate = total > 0 ? Math.round((counts.PRESENT / total) * 100) : 0;
    return { counts, total, rate };
  }, [filtered]);

  const trend = useMemo(() => {
    const byWeek = new Map<string, { present: number; total: number }>();
    for (const r of filtered) {
      const d = new Date(r.date);
      const key = `${d.getFullYear()}-W${isoWeek(d)}`;
      const entry = byWeek.get(key) || { present: 0, total: 0 };
      entry.total += 1;
      if (r.status === 'PRESENT') entry.present += 1;
      byWeek.set(key, entry);
    }
    const sortedKeys = Array.from(byWeek.keys()).sort();
    return sortedKeys.slice(-8).map((key, i, arr) => {
      const entry = byWeek.get(key)!;
      return {
        x: `Wk ${i + 1}`,
        fullLabel: key.replace('-W', ', week '),
        y: entry.total > 0 ? Math.round((entry.present / entry.total) * 100) : 0,
      };
    });
  }, [filtered]);

  const segments = [
    { label: 'Present', value: summary.counts.PRESENT, color: 'var(--success)' },
    { label: 'Absent', value: summary.counts.ABSENT, color: 'var(--danger)' },
    { label: 'Late', value: summary.counts.LATE, color: 'var(--warn)' },
    { label: 'Excused', value: summary.counts.EXCUSED, color: 'var(--gold)' },
  ];

  return (
    <DashboardWidget
      title={title}
      icon={CheckSquare}
      href={href}
      linkLabel="View attendance"
      loading={loading}
      error={error}
      controls={
        <RangeTabs<Range>
          value={range}
          onChange={setRange}
          options={[
            { value: '30', label: '30d' },
            { value: '90', label: '90d' },
            { value: 'all', label: 'All' },
          ]}
        />
      }
    >
      {summary.total === 0 ? (
        <EmptyState icon={CheckSquare} title="No attendance yet" description="Attendance for this range will appear here once it's recorded." tone="muted" compact />
      ) : (
        <>
          <Donut segments={segments} centerLabel="attendance rate" centerValue={`${summary.rate}%`} />
          {trend.length > 1 && (
            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 6, fontWeight: 600 }}>
                Weekly attendance rate
              </div>
              <TrendLine points={trend} suffix="%" height={100} />
            </div>
          )}
        </>
      )}
    </DashboardWidget>
  );
}
