'use client';

import { useEffect, useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import { api } from '../../lib/api';
import type { Exam } from '../../lib/types';
import { EmptyState } from '../ui/EmptyState';
import { DashboardWidget } from '../ui/DashboardWidget';
import { Donut } from '../ui/charts/Donut';
import { getErrorMessage } from '../../lib/errors';

/**
 * Exam overview built from /api/exams (already used on the Exams page).
 * An exam doesn't carry its own date, only a term, so "upcoming" /
 * "completed" is derived from that term's end date - an honest
 * approximation, not a precise per-exam schedule the backend doesn't
 * expose. Clicking a segment filters the list below to that bucket.
 */
export function ExamsWidget({ href, title = 'Exams' }: { href: string; title?: string }) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'Upcoming' | 'Completed' | null>(null);

  useEffect(() => {
    api
      .get<Exam[]>('/api/exams')
      .then(setExams)
      .catch((err) => setError(getErrorMessage(err, 'Failed to load exams.')))
      .finally(() => setLoading(false));
  }, []);

  const classified = useMemo(() => {
    const now = Date.now();
    return exams.map((e: any) => ({
      exam: e,
      bucket: e.term?.endDate && new Date(e.term.endDate).getTime() < now ? ('Completed' as const) : ('Upcoming' as const),
    }));
  }, [exams]);

  const upcoming = classified.filter((c) => c.bucket === 'Upcoming');
  const completed = classified.filter((c) => c.bucket === 'Completed');

  const segments = [
    { label: 'Upcoming', value: upcoming.length, color: 'var(--blue)' },
    { label: 'Completed', value: completed.length, color: 'var(--success)' },
  ];

  const visible = filter ? classified.filter((c) => c.bucket === filter) : classified;

  return (
    <DashboardWidget title={title} icon={FileText} href={href} linkLabel="Manage exams" loading={loading} error={error}>
      {exams.length === 0 ? (
        <EmptyState icon={FileText} title="No exams yet" description="Exams you create will show their status here." tone="muted" compact />
      ) : (
        <>
          <Donut
            segments={segments}
            centerLabel="total exams"
            centerValue={String(exams.length)}
            onSegmentSelect={(seg) => setFilter(seg ? (seg.label as 'Upcoming' | 'Completed') : null)}
          />
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 140, overflowY: 'auto' }}>
            {visible.slice(0, 6).map(({ exam, bucket }: any) => (
              <div key={exam.id} className="today-item" style={{ padding: '8px 0' }}>
                <div className="ti-text">
                  <div className="ti-title" style={{ fontSize: 12.5 }}>
                    {exam.class?.name} · {exam.name}
                  </div>
                  <div className="ti-sub">{exam.term?.session?.name} {exam.term?.name}</div>
                </div>
                <span className={`badge ${bucket === 'Completed' ? 'badge-success' : ''}`} style={{ fontSize: 10 }}>
                  {bucket}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </DashboardWidget>
  );
}
