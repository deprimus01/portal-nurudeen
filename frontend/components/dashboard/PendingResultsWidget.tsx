'use client';

import { useEffect, useMemo, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { api } from '../../lib/api';
import type { Exam, Subject } from '../../lib/types';
import { EmptyState } from '../ui/EmptyState';
import { DashboardWidget } from '../ui/DashboardWidget';
import { getErrorMessage } from '../../lib/errors';

interface RosterEntry {
  studentId: string;
  firstName: string;
  lastName: string;
  score: number | null;
}

/**
 * How many students still need a score, for a chosen exam + subject.
 * Built from the exact /api/results/roster endpoint the "Enter results"
 * screen already uses - the same roster ClassPerformanceWidget reads,
 * just counting the null scores instead of charting the entered ones.
 */
export function PendingResultsWidget({
  exams,
  subjects,
  href,
  title = 'Pending results',
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

  const pending = useMemo(() => roster.filter((r) => r.score === null), [roster]);

  if (exams.length === 0 || subjects.length === 0) return null;

  return (
    <DashboardWidget
      title={title}
      icon={ClipboardList}
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
      {roster.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No roster yet" description="Once students are enrolled for this exam's class, they'll appear here." tone="muted" compact />
      ) : pending.length === 0 ? (
        <EmptyState icon={ClipboardList} title="All scores entered" description="Every student has a score for this exam and subject." tone="green" compact />
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
            <span className="mono" style={{ fontSize: 26, fontWeight: 700 }}>{pending.length}</span>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>of {roster.length} students still need a score</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 150, overflowY: 'auto' }}>
            {pending.slice(0, 8).map((r) => (
              <div key={r.studentId} className="today-item" style={{ padding: '8px 0' }}>
                <div className="ti-text">
                  <div className="ti-title" style={{ fontSize: 12.5 }}>{r.firstName} {r.lastName}</div>
                </div>
                <span className="badge badge-warn" style={{ fontSize: 10 }}>No score</span>
              </div>
            ))}
          </div>
        </>
      )}
    </DashboardWidget>
  );
}
