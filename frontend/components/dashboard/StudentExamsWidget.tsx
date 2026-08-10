'use client';

import { useEffect, useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import { api } from '../../lib/api';
import type { Exam } from '../../lib/types';
import { EmptyState } from '../ui/EmptyState';
import { DashboardWidget } from '../ui/DashboardWidget';
import { getErrorMessage } from '../../lib/errors';

/**
 * Upcoming exams for one student's current class, built from
 * /api/exams/for-student/:id - the same guardian-scoped endpoint the
 * report card picker already uses. /api/exams itself is admin/teacher
 * only, so this (not ExamsWidget) is what student/guardian dashboards
 * use. "Upcoming" vs "completed" is derived from the exam's term end
 * date, same approximation ExamsWidget uses elsewhere.
 */
export function StudentExamsWidget({ studentId, href, title = 'Upcoming exams' }: { studentId: string; href: string; title?: string }) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId) return;
    setLoading(true);
    setError(null);
    api
      .get<Exam[]>(`/api/exams/for-student/${studentId}`)
      .then(setExams)
      .catch((err) => setError(getErrorMessage(err, 'Failed to load exams.')))
      .finally(() => setLoading(false));
  }, [studentId]);

  const upcoming = useMemo(() => {
    const now = Date.now();
    return (exams as any[])
      .filter((e) => !e.term?.endDate || new Date(e.term.endDate).getTime() >= now)
      .slice(0, 6);
  }, [exams]);

  return (
    <DashboardWidget title={title} icon={FileText} href={href} linkLabel="View exams" loading={loading} error={error}>
      {upcoming.length === 0 ? (
        <EmptyState icon={FileText} title="No upcoming exams" description="Exams scheduled for your current class will appear here." tone="muted" compact />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {upcoming.map((exam: any) => (
            <div key={exam.id} className="today-item">
              <div className="today-icon" style={{ background: 'rgba(0,85,251,0.1)', color: 'var(--blue)' }}>
                <FileText size={15} />
              </div>
              <div className="ti-text">
                <div className="ti-title">{exam.name}</div>
                <div className="ti-sub">{exam.term?.session?.name} {exam.term?.name}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardWidget>
  );
}
