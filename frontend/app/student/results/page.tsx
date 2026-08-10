'use client';

import { useEffect, useState } from 'react';
import { Award } from 'lucide-react';
import { useAuth } from '../../../lib/auth-context';
import { api } from '../../../lib/api';
import type { Exam, ReportCard } from '../../../lib/types';
import { ReportCardView } from '../../../components/ui/ReportCardView';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { useLanguage } from '../../../lib/i18n/language-context';
import { getErrorMessage } from '../../../lib/errors';

export default function StudentResultsPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const studentId = (user?.profile as { id?: string } | null)?.id;
  const [exams, setExams] = useState<Exam[]>([]);
  const [examId, setExamId] = useState(() => {
    if (typeof window === 'undefined') return '';
    // Deep-link support for the global search feature.
    return new URLSearchParams(window.location.search).get('examId') || '';
  });
  const [report, setReport] = useState<ReportCard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId) return;
    api.get<Exam[]>(`/api/exams/for-student/${studentId}`).then(setExams).catch(() => {});
  }, [studentId]);

  function loadReport() {
    if (!studentId || !examId) return;
    setLoading(true);
    setError(null);
    api.get<ReportCard>(`/api/results/report-card?studentId=${studentId}&examId=${examId}`)
      .then(setReport)
      .catch((err) => setError(getErrorMessage(err, 'Failed to load report card.')))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, examId]);

  return (
    <div>
      <div className="topbar no-print"><h1 className="page-title">{t('nav.results')}</h1></div>

      <div className="card no-print" style={{ marginBottom: '1.5rem' }}>
        <div className="field" style={{ marginBottom: 0, maxWidth: '280px' }}>
          <label htmlFor="sExam">{t('fields.exam')}</label>
          <select id="sExam" value={examId} onChange={(e) => setExamId(e.target.value)} disabled={exams.length === 0}>
            <option value="" disabled>{exams.length === 0 ? 'No exams yet' : 'Select…'}</option>
            {exams.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="card no-print"><div className="skeleton" style={{ height: 200 }} /></div>
      ) : report ? (
        <ReportCardView report={report} />
      ) : error ? (
        <div className="card no-print">
          <ErrorState description={error} onRetry={loadReport} />
        </div>
      ) : (
        <div className="card no-print">
          <EmptyState icon={Award} title="No report card selected" description="Select an exam to view your report card." />
        </div>
      )}
    </div>
  );
}
