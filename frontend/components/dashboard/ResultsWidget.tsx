'use client';

import { useEffect, useMemo, useState } from 'react';
import { Award } from 'lucide-react';
import { api } from '../../lib/api';
import type { Exam, ReportCard } from '../../lib/types';
import { DashboardWidget } from '../ui/DashboardWidget';
import { EmptyState } from '../ui/EmptyState';
import { BarList } from '../ui/charts/BarList';
import { Donut } from '../ui/charts/Donut';
import { getErrorMessage } from '../../lib/errors';

function gradeColor(grade: string | null) {
  if (!grade) return 'var(--muted-2)';
  const g = grade.trim().toUpperCase();
  if (g.startsWith('A')) return 'var(--gold)';
  if (g.startsWith('B')) return 'var(--blue)';
  if (g.startsWith('C')) return 'var(--warn)';
  return 'var(--danger)';
}

/**
 * Academic performance for a single student, built from the exams list
 * (/api/exams/for-student/:id) and the report card endpoint
 * (/api/results/report-card) that the Results page already uses. The
 * exam picker doubles as the "filtering" control - no invented scores.
 */
export function ResultsWidget({ studentId, href, title = 'Academic performance' }: { studentId: string; href: string; title?: string }) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [examId, setExamId] = useState('');
  const [report, setReport] = useState<ReportCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId) return;
    setLoading(true);
    setReport(null);
    api
      .get<Exam[]>(`/api/exams/for-student/${studentId}`)
      .then((list) => {
        setExams(list);
        setExamId(list.length > 0 ? list[list.length - 1].id : '');
      })
      .catch((err) => setError(getErrorMessage(err, 'Failed to load exams.')))
      .finally(() => setLoading(false));
  }, [studentId]);

  useEffect(() => {
    if (!studentId || !examId) return;
    setLoading(true);
    setError(null);
    api
      .get<ReportCard>(`/api/results/report-card?studentId=${studentId}&examId=${examId}`)
      .then(setReport)
      .catch((err) => setError(getErrorMessage(err, 'Failed to load report card.')))
      .finally(() => setLoading(false));
  }, [studentId, examId]);

  const subjectBars = useMemo(
    () =>
      (report?.rows || [])
        .filter((r) => r.score !== null)
        .map((r) => ({ label: r.subject, value: r.score as number, color: gradeColor(r.grade), sublabel: r.grade || undefined })),
    [report],
  );

  const gradeDist = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of report?.rows || []) {
      if (!r.grade) continue;
      counts.set(r.grade, (counts.get(r.grade) || 0) + 1);
    }
    return Array.from(counts.entries()).map(([grade, value]) => ({ label: grade, value, color: gradeColor(grade) }));
  }, [report]);

  return (
    <DashboardWidget
      title={title}
      icon={Award}
      href={href}
      linkLabel="View results"
      loading={loading}
      error={error}
      controls={
        exams.length > 1 ? (
          <select value={examId} onChange={(e) => setExamId(e.target.value)} aria-label="Select exam">
            {exams.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        ) : undefined
      }
    >
      {exams.length === 0 ? (
        <EmptyState icon={Award} title="No results yet" description="Results will appear here after they have been entered and published." tone="muted" compact />
      ) : !report ? (
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem', margin: 0 }}>Select an exam to view performance.</p>
      ) : subjectBars.length === 0 ? (
        <EmptyState icon={Award} title="No scores yet" description="Scores for this exam haven't been entered yet." tone="muted" compact />
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
            <span className="mono" style={{ fontSize: 26, fontWeight: 700 }}>
              {report.average !== null ? report.average.toFixed(1) : '—'}
            </span>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>average score{report.complete ? '' : ' · incomplete'}</span>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 8, fontWeight: 600 }}>Subject scores</div>
          <BarList data={subjectBars} maxValue={100} formatValue={(v) => `${v}`} />
          {gradeDist.length > 1 && (
            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 8, fontWeight: 600 }}>Grade distribution</div>
              <Donut segments={gradeDist} size={100} strokeWidth={12} centerLabel="subjects" />
            </div>
          )}
        </>
      )}
    </DashboardWidget>
  );
}
