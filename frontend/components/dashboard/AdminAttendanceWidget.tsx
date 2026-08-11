'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckSquare } from 'lucide-react';
import { api } from '../../lib/api';
import type { SchoolClass } from '../../lib/types';
import { EmptyState } from '../ui/EmptyState';
import { DashboardWidget } from '../ui/DashboardWidget';
import { Donut } from '../ui/charts/Donut';
import { getErrorMessage } from '../../lib/errors';

interface RosterEntry {
  studentId: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' | null;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * School-wide attendance for today, built by calling the same
 * /api/attendance/roster?classId&date endpoint the class attendance
 * screen already uses, once per class. There's no separate whole-school
 * aggregate endpoint, so this composes one from real per-class rosters
 * rather than inventing a summary figure.
 */
export function AdminAttendanceWidget({ href, title = 'Attendance overview' }: { href: string; title?: string }) {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [rosters, setRosters] = useState<Map<string, RosterEntry[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    const date = todayISO();
    api
      .get<SchoolClass[]>('/api/classes')
      .then(async (list) => {
        setClasses(list);
        const entries = await Promise.all(
          list.map((c) =>
            api
              .get<{ roster: RosterEntry[] }>(`/api/attendance/roster?classId=${c.id}&date=${date}`)
              .then((res): readonly [string, RosterEntry[]] => [c.id, res.roster])
              .catch((): readonly [string, RosterEntry[]] => [c.id, []]),
          ),
        );
        setRosters(new Map(entries));
      })
      .catch((err) => setError(getErrorMessage(err, 'Failed to load attendance.')))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const summary = useMemo(() => {
    const counts = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 } as Record<string, number>;
    let totalStudents = 0;
    let classesMarked = 0;
    for (const [, roster] of rosters) {
      if (roster.length === 0) continue;
      totalStudents += roster.length;
      const anyMarked = roster.some((r) => r.status);
      if (anyMarked) classesMarked += 1;
      for (const r of roster) {
        if (r.status) counts[r.status] = (counts[r.status] || 0) + 1;
      }
    }
    const marked = counts.PRESENT + counts.ABSENT + counts.LATE + counts.EXCUSED;
    const rate = marked > 0 ? Math.round((counts.PRESENT / marked) * 100) : 0;
    return { counts, totalStudents, classesMarked, rate };
  }, [rosters]);

  const segments = [
    { label: 'Present', value: summary.counts.PRESENT, color: 'var(--success)' },
    { label: 'Absent', value: summary.counts.ABSENT, color: 'var(--danger)' },
    { label: 'Late', value: summary.counts.LATE, color: 'var(--warn)' },
    { label: 'Excused', value: summary.counts.EXCUSED, color: 'var(--gold)' },
  ];

  const noData = classes.length === 0 || summary.totalStudents === 0;

  return (
    <DashboardWidget title={title} icon={CheckSquare} href={href} linkLabel="Take attendance" loading={loading} error={error} onRetry={load}>
      {noData ? (
        <EmptyState icon={CheckSquare} title="No attendance marked today" description="Attendance recorded across classes today will summarize here." tone="muted" compact />
      ) : (
        <>
          <Donut segments={segments} centerLabel="present rate" centerValue={`${summary.rate}%`} />
          <div style={{ marginTop: 14, fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
            {summary.classesMarked} of {classes.length} classes marked today
          </div>
        </>
      )}
    </DashboardWidget>
  );
}
