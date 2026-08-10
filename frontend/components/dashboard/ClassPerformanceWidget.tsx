'use client';

import { useEffect, useMemo, useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { api } from '../../lib/api';
import type { Exam, Subject } from '../../lib/types';
import { EmptyState } from '../ui/EmptyState';
import { DashboardWidget } from '../ui/DashboardWidget';
import { BarList } from '../ui/charts/BarList';
import { getErrorMessage } from '../../lib/errors';

interface RosterEntry {
  studentId: string;
  firstName: string;
  lastName: string;
  score: number | null;
}

/**
 * Per-subject class performance for a teacher, built from
 * /api/results/roster - the exact endpoint the "Enter results" screen
 * already uses to load and save scores. Picking an exam and subject is
 * the filter; nothing here is computed beyond what that roster returns.
 */
export function ClassPerformanceWidget({
  exams,
  subjects,
  href,
  title = 'Class performance',
}: {
  exams: Exam[];
  subjects: Subject[];
  href: string;
  title?: string;
}) {
  const [examId, setExamId] = useState(exams[0]?.id || '');
  const [subjectId, setSubjectId] = useState(subjects[0]?.id || '');
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!examId || !subjectId) return;
    setLoading(true);
    setError(null);
    api
      .get<{ roster: RosterEntry[] }>(`/api/results/roster?examId=${examId}&subjectId=${subjectId}`)
      .then((data) => setRoster(data.roster))
      .catch((err) => setError(getErrorMessage(err, 'Failed to load roster.')))
      .finally(() => setLoading(false));
  }, [examId, subjectId]);

  const scored = useMemo(() => roster.filter((r) => r.score !== null) as (RosterEntry & { score: number })[], [roster]);
  const average = scored.length > 0 ? scored.reduce((sum, r) => sum + r.score, 0) / scored.length : null;

  const bars = useMemo(
    () =>
      [...scored]
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)
        .map((r) => ({ label: `${r.firstName[0]}. ${r.lastName}`, value: r.score })),
    [scored],
  );

  if (exams.length === 0 || subjects.length === 0) return null;

  return (
    <DashboardWidget
      title={title}
      icon={GraduationCap}
      href={href}
      linkLabel="Enter results"
      loading={loading}
      error={error}
      controls={
        <div style={{ display: 'flex', gap: 6 }}>
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} aria-label="Select subject">
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select value={examId} onChange={(e) => setExamId(e.target.value)} aria-label="Select exam">
            {exams.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </div>
      }
    >
      {scored.length === 0 ? (
        <EmptyState icon={GraduationCap} title="No scores yet" description="Scores entered for this exam and subject will appear here." tone="muted" compact />
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
            <span className="mono" style={{ fontSize: 26, fontWeight: 700 }}>{average!.toFixed(1)}</span>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>class average · {scored.length}/{roster.length} scored</span>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 8, fontWeight: 600 }}>Top scores</div>
          <BarList data={bars} maxValue={100} />
        </>
      )}
    </DashboardWidget>
  );
}
